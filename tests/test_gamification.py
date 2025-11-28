"""Tests for Pomodoro Timer Gamification Features."""

import pytest
import json
import os
from datetime import datetime, timedelta

from app import (
    app,
    calculate_level,
    get_xp_for_next_level,
    get_current_level_xp,
    get_default_data,
    check_achievements,
    update_streak,
    get_weekly_completions,
    get_statistics,
    DATA_FILE,
    save_data,
    load_data,
)


@pytest.fixture
def client():
    """Create a test client for the Flask application."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture(autouse=True)
def cleanup():
    """Clean up data file before and after each test."""
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
    yield
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)


class TestXPSystem:
    """Tests for the XP and leveling system."""

    def test_calculate_level_initial(self):
        """Level should be 1 with 0 XP."""
        assert calculate_level(0) == 1

    def test_calculate_level_first_level_up(self):
        """Level should be 2 with 100 XP."""
        assert calculate_level(100) == 2

    def test_calculate_level_progression(self):
        """Level should increase correctly with XP."""
        # Level 1: 0-99 XP (need 100 to level up)
        # Level 2: 100-249 XP (need 150 to level up)
        # Level 3: 250-449 XP (need 200 to level up)
        assert calculate_level(99) == 1
        assert calculate_level(100) == 2
        assert calculate_level(249) == 2
        assert calculate_level(250) == 3
        assert calculate_level(449) == 3
        assert calculate_level(450) == 4

    def test_xp_for_next_level(self):
        """XP requirements should increase by 50 each level."""
        assert get_xp_for_next_level(1) == 100
        assert get_xp_for_next_level(2) == 150
        assert get_xp_for_next_level(3) == 200
        assert get_xp_for_next_level(4) == 250

    def test_current_level_xp(self):
        """Current level XP should be calculated correctly."""
        # At 0 XP, level 1, current XP in level should be 0
        assert get_current_level_xp(0, 1) == 0
        # At 50 XP, level 1, current XP in level should be 50
        assert get_current_level_xp(50, 1) == 50
        # At 100 XP, level 2, current XP in level should be 0
        assert get_current_level_xp(100, 2) == 0
        # At 150 XP, level 2, current XP in level should be 50
        assert get_current_level_xp(150, 2) == 50


class TestStreakSystem:
    """Tests for the streak tracking system."""

    def test_first_completion_starts_streak(self):
        """First completion should start a streak of 1."""
        data = get_default_data()
        data = update_streak(data)
        assert data["current_streak"] == 1
        assert data["last_completion_date"] == datetime.now().date().isoformat()

    def test_same_day_completion_maintains_streak(self):
        """Multiple completions on same day should not increase streak."""
        data = get_default_data()
        data["current_streak"] = 1
        data["last_completion_date"] = datetime.now().date().isoformat()
        data = update_streak(data)
        assert data["current_streak"] == 1

    def test_consecutive_day_increases_streak(self):
        """Completing on consecutive days should increase streak."""
        data = get_default_data()
        yesterday = (datetime.now().date() - timedelta(days=1)).isoformat()
        data["current_streak"] = 3
        data["last_completion_date"] = yesterday
        data = update_streak(data)
        assert data["current_streak"] == 4

    def test_broken_streak_resets(self):
        """Missing a day should reset streak to 1."""
        data = get_default_data()
        two_days_ago = (datetime.now().date() - timedelta(days=2)).isoformat()
        data["current_streak"] = 5
        data["last_completion_date"] = two_days_ago
        data = update_streak(data)
        assert data["current_streak"] == 1

    def test_longest_streak_updated(self):
        """Longest streak should be updated when current streak exceeds it."""
        data = get_default_data()
        yesterday = (datetime.now().date() - timedelta(days=1)).isoformat()
        data["current_streak"] = 5
        data["longest_streak"] = 5
        data["last_completion_date"] = yesterday
        data = update_streak(data)
        assert data["current_streak"] == 6
        assert data["longest_streak"] == 6


class TestAchievements:
    """Tests for the achievement system."""

    def test_first_pomodoro_achievement(self):
        """First Pomodoro achievement should unlock after 1 completion."""
        data = get_default_data()
        data["total_pomodoros"] = 1
        earned, new = check_achievements(data)
        assert "first_pomodoro" in earned
        assert len(new) == 1
        assert new[0]["id"] == "first_pomodoro"

    def test_multiple_achievements_at_once(self):
        """Multiple achievements can be unlocked at once."""
        data = get_default_data()
        data["total_pomodoros"] = 10
        data["current_streak"] = 3
        earned, new = check_achievements(data)
        assert "first_pomodoro" in earned
        assert "five_pomodoros" in earned
        assert "ten_pomodoros" in earned
        assert "three_day_streak" in earned

    def test_achievements_not_duplicated(self):
        """Already earned achievements should not be awarded again."""
        data = get_default_data()
        data["total_pomodoros"] = 5
        data["achievements"] = ["first_pomodoro", "five_pomodoros"]
        earned, new = check_achievements(data)
        assert len(new) == 0
        assert len(earned) == 2

    def test_level_based_achievement(self):
        """Level-based achievements should unlock at correct levels."""
        data = get_default_data()
        data["level"] = 5
        earned, new = check_achievements(data)
        assert "level_five" in earned


class TestWeeklyCompletions:
    """Tests for weekly completion tracking."""

    def test_get_weekly_completions_empty(self):
        """Empty data should return 0 weekly completions."""
        data = get_default_data()
        assert get_weekly_completions(data) == 0

    def test_get_weekly_completions_current_week(self):
        """Should count completions from current week only."""
        data = get_default_data()
        today = datetime.now().date()
        data["daily_completions"] = {
            today.isoformat(): 3,
            (today - timedelta(days=1)).isoformat(): 2,
        }
        count = get_weekly_completions(data)
        assert count >= 3  # At least today's completions


class TestStatistics:
    """Tests for statistics calculation."""

    def test_statistics_empty_data(self):
        """Statistics should handle empty data."""
        data = get_default_data()
        stats = get_statistics(data)
        assert stats["total_pomodoros"] == 0
        assert stats["weekly_total"] == 0
        assert stats["monthly_total"] == 0
        assert stats["average_per_day"] == 0

    def test_statistics_with_data(self):
        """Statistics should calculate correctly with data."""
        data = get_default_data()
        today = datetime.now().date().isoformat()
        data["total_pomodoros"] = 10
        data["total_focus_time_minutes"] = 250
        data["current_streak"] = 3
        data["longest_streak"] = 5
        data["daily_completions"] = {today: 5}
        
        stats = get_statistics(data)
        assert stats["total_pomodoros"] == 10
        assert stats["current_streak"] == 3
        assert stats["longest_streak"] == 5
        assert stats["average_focus_time"] == 25.0


class TestAPIEndpoints:
    """Tests for Flask API endpoints."""

    def test_index_route(self, client):
        """Index route should return 200."""
        response = client.get('/')
        assert response.status_code == 200

    def test_status_endpoint(self, client):
        """Status endpoint should return user data."""
        response = client.get('/api/status')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "level" in data
        assert "xp" in data
        assert "current_streak" in data

    def test_complete_endpoint(self, client):
        """Complete endpoint should award XP and update stats."""
        response = client.post(
            '/api/complete',
            json={"focus_minutes": 25}
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True
        assert data["xp_earned"] == 25
        assert data["total_pomodoros"] == 1

    def test_complete_endpoint_bonus_xp(self, client):
        """Complete endpoint should award bonus XP for longer sessions."""
        response = client.post(
            '/api/complete',
            json={"focus_minutes": 45}
        )
        data = json.loads(response.data)
        # 25 base + 5 (30+ min) + 10 (45+ min) = 40 XP
        assert data["xp_earned"] == 40

    def test_achievements_endpoint(self, client):
        """Achievements endpoint should return all achievements."""
        response = client.get('/api/achievements')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "achievements" in data
        assert len(data["achievements"]) == 12

    def test_statistics_endpoint(self, client):
        """Statistics endpoint should return stats data."""
        response = client.get('/api/statistics')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "total_pomodoros" in data
        assert "weekly_completions" in data
        assert "monthly_completions" in data

    def test_reset_endpoint(self, client):
        """Reset endpoint should clear all data."""
        # First complete a pomodoro
        client.post('/api/complete', json={"focus_minutes": 25})
        
        # Then reset
        response = client.post('/api/reset')
        assert response.status_code == 200
        
        # Check data is reset
        status = client.get('/api/status')
        data = json.loads(status.data)
        assert data["total_pomodoros"] == 0
        assert data["level"] == 1


class TestDataPersistence:
    """Tests for data persistence."""

    def test_data_persists_between_calls(self, client):
        """Data should persist between API calls."""
        # Complete a pomodoro
        client.post('/api/complete', json={"focus_minutes": 25})
        
        # Check status
        response = client.get('/api/status')
        data = json.loads(response.data)
        assert data["total_pomodoros"] == 1
        
        # Complete another
        client.post('/api/complete', json={"focus_minutes": 25})
        
        # Check again
        response = client.get('/api/status')
        data = json.loads(response.data)
        assert data["total_pomodoros"] == 2
        assert data["xp"] == 50

    def test_level_up_on_completion(self, client):
        """Level should increase after earning enough XP."""
        # Complete 4 pomodoros (4 * 25 = 100 XP = Level 2)
        for _ in range(4):
            response = client.post('/api/complete', json={"focus_minutes": 25})
        
        data = json.loads(response.data)
        assert data["level"] == 2
