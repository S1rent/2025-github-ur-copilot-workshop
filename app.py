"""
Pomodoro Timer Application with Gamification Features.

This Flask application provides a Pomodoro timer with:
- Experience point (XP) system with levels
- Achievement badges
- Weekly/monthly statistics
- Streak tracking
"""

from flask import Flask, render_template, jsonify, request
from datetime import datetime, timedelta
import json
import os

app = Flask(__name__)

# Data file path for persistent storage
DATA_FILE = "pomodoro_data.json"


def load_data():
    """Load user data from JSON file."""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return get_default_data()


def save_data(data):
    """Save user data to JSON file."""
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_default_data():
    """Return default user data structure."""
    return {
        "total_pomodoros": 0,
        "xp": 0,
        "level": 1,
        "current_streak": 0,
        "longest_streak": 0,
        "last_completion_date": None,
        "achievements": [],
        "daily_completions": {},
        "total_focus_time_minutes": 0,
    }


def calculate_level(xp):
    """Calculate level based on XP.

    Level 1→2 requires 100 XP, and each subsequent level requires
    50 XP more than the previous (150 for level 3, 200 for level 4, etc.).
    """
    level = 1
    xp_needed = 100
    remaining_xp = xp
    while remaining_xp >= xp_needed:
        remaining_xp -= xp_needed
        level += 1
        xp_needed += 50
    return level


def get_xp_for_next_level(level):
    """Get XP required to reach the next level."""
    return 100 + (level - 1) * 50


def get_current_level_xp(xp, level):
    """Get XP progress within current level."""
    total_xp_for_level = 0
    for i in range(1, level):
        total_xp_for_level += 100 + (i - 1) * 50
    return xp - total_xp_for_level


def check_achievements(data):
    """Check and award achievements based on user progress."""
    achievements = []
    earned = data.get("achievements", [])

    # Achievement definitions
    achievement_checks = [
        {
            "id": "first_pomodoro",
            "name": "First Step",
            "description": "Complete your first Pomodoro",
            "icon": "🎯",
            "condition": lambda d: d["total_pomodoros"] >= 1,
        },
        {
            "id": "five_pomodoros",
            "name": "Getting Started",
            "description": "Complete 5 Pomodoros",
            "icon": "⭐",
            "condition": lambda d: d["total_pomodoros"] >= 5,
        },
        {
            "id": "ten_pomodoros",
            "name": "Focused Ten",
            "description": "Complete 10 Pomodoros",
            "icon": "🌟",
            "condition": lambda d: d["total_pomodoros"] >= 10,
        },
        {
            "id": "twenty_five_pomodoros",
            "name": "Quarter Century",
            "description": "Complete 25 Pomodoros",
            "icon": "💪",
            "condition": lambda d: d["total_pomodoros"] >= 25,
        },
        {
            "id": "fifty_pomodoros",
            "name": "Half Century",
            "description": "Complete 50 Pomodoros",
            "icon": "🏆",
            "condition": lambda d: d["total_pomodoros"] >= 50,
        },
        {
            "id": "hundred_pomodoros",
            "name": "Century Club",
            "description": "Complete 100 Pomodoros",
            "icon": "👑",
            "condition": lambda d: d["total_pomodoros"] >= 100,
        },
        {
            "id": "three_day_streak",
            "name": "Three Day Streak",
            "description": "Maintain a 3-day streak",
            "icon": "🔥",
            "condition": lambda d: d["current_streak"] >= 3
            or d["longest_streak"] >= 3,
        },
        {
            "id": "week_streak",
            "name": "Week Warrior",
            "description": "Maintain a 7-day streak",
            "icon": "🔥🔥",
            "condition": lambda d: d["current_streak"] >= 7
            or d["longest_streak"] >= 7,
        },
        {
            "id": "two_week_streak",
            "name": "Fortnight Fighter",
            "description": "Maintain a 14-day streak",
            "icon": "🔥🔥🔥",
            "condition": lambda d: d["current_streak"] >= 14
            or d["longest_streak"] >= 14,
        },
        {
            "id": "level_five",
            "name": "Rising Star",
            "description": "Reach Level 5",
            "icon": "⬆️",
            "condition": lambda d: d["level"] >= 5,
        },
        {
            "id": "level_ten",
            "name": "Productivity Pro",
            "description": "Reach Level 10",
            "icon": "🚀",
            "condition": lambda d: d["level"] >= 10,
        },
        {
            "id": "ten_weekly",
            "name": "Weekly Champion",
            "description": "Complete 10 Pomodoros in a week",
            "icon": "📅",
            "condition": lambda d: get_weekly_completions(d) >= 10,
        },
    ]

    for achievement in achievement_checks:
        if achievement["id"] not in earned and achievement["condition"](data):
            earned.append(achievement["id"])
            achievements.append(
                {
                    "id": achievement["id"],
                    "name": achievement["name"],
                    "description": achievement["description"],
                    "icon": achievement["icon"],
                    "earned_at": datetime.now().isoformat(),
                }
            )

    return earned, achievements


def get_weekly_completions(data):
    """Get number of completions in the current week."""
    today = datetime.now().date()
    start_of_week = today - timedelta(days=today.weekday())
    weekly_count = 0

    daily_completions = data.get("daily_completions", {})
    for date_str, count in daily_completions.items():
        try:
            date = datetime.fromisoformat(date_str).date()
            if start_of_week <= date <= today:
                weekly_count += count
        except ValueError:
            continue

    return weekly_count


def update_streak(data):
    """Update streak based on last completion date."""
    today = datetime.now().date().isoformat()
    yesterday = (datetime.now().date() - timedelta(days=1)).isoformat()
    last_date = data.get("last_completion_date")

    if last_date == today:
        # Already completed today, no change
        pass
    elif last_date == yesterday:
        # Continuing streak
        data["current_streak"] += 1
    elif last_date is None or last_date < yesterday:
        # Streak broken or first completion
        data["current_streak"] = 1

    data["last_completion_date"] = today

    if data["current_streak"] > data["longest_streak"]:
        data["longest_streak"] = data["current_streak"]

    return data


def get_statistics(data):
    """Calculate comprehensive statistics."""
    today = datetime.now().date()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_month = today.replace(day=1)

    daily_completions = data.get("daily_completions", {})

    # Weekly completions
    weekly_completions = {}
    weekly_total = 0
    for i in range(7):
        day = start_of_week + timedelta(days=i)
        day_str = day.isoformat()
        count = daily_completions.get(day_str, 0)
        weekly_completions[day_str] = count
        weekly_total += count

    # Monthly completions
    monthly_completions = {}
    monthly_total = 0
    current_day = start_of_month
    while current_day <= today:
        day_str = current_day.isoformat()
        count = daily_completions.get(day_str, 0)
        monthly_completions[day_str] = count
        monthly_total += count
        current_day += timedelta(days=1)

    # Calculate averages
    days_active = len([c for c in daily_completions.values() if c > 0])
    avg_per_day = (
        data["total_pomodoros"] / days_active if days_active > 0 else 0
    )
    avg_focus_time = (
        data["total_focus_time_minutes"] / data["total_pomodoros"]
        if data["total_pomodoros"] > 0
        else 25
    )

    return {
        "total_pomodoros": data["total_pomodoros"],
        "total_focus_time_minutes": data["total_focus_time_minutes"],
        "weekly_completions": weekly_completions,
        "weekly_total": weekly_total,
        "monthly_completions": monthly_completions,
        "monthly_total": monthly_total,
        "average_per_day": round(avg_per_day, 1),
        "average_focus_time": round(avg_focus_time, 1),
        "current_streak": data["current_streak"],
        "longest_streak": data["longest_streak"],
    }


def get_all_achievements():
    """Return all available achievements with their status."""
    data = load_data()
    earned = data.get("achievements", [])

    all_achievements = [
        {
            "id": "first_pomodoro",
            "name": "First Step",
            "description": "Complete your first Pomodoro",
            "icon": "🎯",
            "earned": "first_pomodoro" in earned,
        },
        {
            "id": "five_pomodoros",
            "name": "Getting Started",
            "description": "Complete 5 Pomodoros",
            "icon": "⭐",
            "earned": "five_pomodoros" in earned,
        },
        {
            "id": "ten_pomodoros",
            "name": "Focused Ten",
            "description": "Complete 10 Pomodoros",
            "icon": "🌟",
            "earned": "ten_pomodoros" in earned,
        },
        {
            "id": "twenty_five_pomodoros",
            "name": "Quarter Century",
            "description": "Complete 25 Pomodoros",
            "icon": "💪",
            "earned": "twenty_five_pomodoros" in earned,
        },
        {
            "id": "fifty_pomodoros",
            "name": "Half Century",
            "description": "Complete 50 Pomodoros",
            "icon": "🏆",
            "earned": "fifty_pomodoros" in earned,
        },
        {
            "id": "hundred_pomodoros",
            "name": "Century Club",
            "description": "Complete 100 Pomodoros",
            "icon": "👑",
            "earned": "hundred_pomodoros" in earned,
        },
        {
            "id": "three_day_streak",
            "name": "Three Day Streak",
            "description": "Maintain a 3-day streak",
            "icon": "🔥",
            "earned": "three_day_streak" in earned,
        },
        {
            "id": "week_streak",
            "name": "Week Warrior",
            "description": "Maintain a 7-day streak",
            "icon": "🔥🔥",
            "earned": "week_streak" in earned,
        },
        {
            "id": "two_week_streak",
            "name": "Fortnight Fighter",
            "description": "Maintain a 14-day streak",
            "icon": "🔥🔥🔥",
            "earned": "two_week_streak" in earned,
        },
        {
            "id": "level_five",
            "name": "Rising Star",
            "description": "Reach Level 5",
            "icon": "⬆️",
            "earned": "level_five" in earned,
        },
        {
            "id": "level_ten",
            "name": "Productivity Pro",
            "description": "Reach Level 10",
            "icon": "🚀",
            "earned": "level_ten" in earned,
        },
        {
            "id": "ten_weekly",
            "name": "Weekly Champion",
            "description": "Complete 10 Pomodoros in a week",
            "icon": "📅",
            "earned": "ten_weekly" in earned,
        },
    ]

    return all_achievements


@app.route("/")
def index():
    """Render the main page."""
    return render_template("index.html")


@app.route("/api/status")
def get_status():
    """Get current user status including XP, level, streak, etc."""
    data = load_data()

    xp_for_next = get_xp_for_next_level(data["level"])
    current_level_xp = get_current_level_xp(data["xp"], data["level"])

    return jsonify(
        {
            "total_pomodoros": data["total_pomodoros"],
            "xp": data["xp"],
            "level": data["level"],
            "xp_for_next_level": xp_for_next,
            "current_level_xp": current_level_xp,
            "current_streak": data["current_streak"],
            "longest_streak": data["longest_streak"],
            "achievements_count": len(data.get("achievements", [])),
            "total_focus_time_minutes": data["total_focus_time_minutes"],
        }
    )


@app.route("/api/complete", methods=["POST"])
def complete_pomodoro():
    """Record a completed Pomodoro and award XP."""
    data = load_data()

    # Get focus duration from request (default 25 minutes)
    focus_minutes = request.json.get("focus_minutes", 25) if request.json else 25

    # Update pomodoro count
    data["total_pomodoros"] += 1
    data["total_focus_time_minutes"] += focus_minutes

    # Award XP (25 XP per pomodoro + bonus for longer sessions)
    xp_earned = 25
    if focus_minutes >= 30:
        xp_earned += 5
    if focus_minutes >= 45:
        xp_earned += 10

    data["xp"] += xp_earned

    # Update level
    new_level = calculate_level(data["xp"])
    level_up = new_level > data["level"]
    data["level"] = new_level

    # Update streak
    data = update_streak(data)

    # Update daily completions
    today = datetime.now().date().isoformat()
    if "daily_completions" not in data:
        data["daily_completions"] = {}
    data["daily_completions"][today] = (
        data["daily_completions"].get(today, 0) + 1
    )

    # Check achievements
    data["achievements"], new_achievements = check_achievements(data)

    # Save data
    save_data(data)

    return jsonify(
        {
            "success": True,
            "xp_earned": xp_earned,
            "total_xp": data["xp"],
            "level": data["level"],
            "level_up": level_up,
            "current_streak": data["current_streak"],
            "new_achievements": new_achievements,
            "total_pomodoros": data["total_pomodoros"],
        }
    )


@app.route("/api/achievements")
def get_achievements():
    """Get all achievements and their status."""
    return jsonify({"achievements": get_all_achievements()})


@app.route("/api/statistics")
def get_stats():
    """Get detailed statistics."""
    data = load_data()
    stats = get_statistics(data)
    return jsonify(stats)


@app.route("/api/reset", methods=["POST"])
def reset_data():
    """Reset all user data (for testing purposes)."""
    save_data(get_default_data())
    return jsonify({"success": True, "message": "Data reset successfully"})


if __name__ == "__main__":
    import os
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug_mode, port=5000)
