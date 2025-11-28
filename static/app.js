// Pomodoro Timer with Gamification
class PomodoroTimer {
    constructor() {
        this.timerDisplay = document.getElementById('timer');
        this.startBtn = document.getElementById('start-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.focusTimeSelect = document.getElementById('focus-time');
        
        this.duration = 25 * 60; // 25 minutes in seconds
        this.timeRemaining = this.duration;
        this.isRunning = false;
        this.timerId = null;
        
        this.initEventListeners();
        this.loadUserStatus();
        this.loadAchievements();
        this.loadStatistics();
    }
    
    initEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.focusTimeSelect.addEventListener('change', () => this.updateDuration());
        
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }
    
    updateDuration() {
        const minutes = parseInt(this.focusTimeSelect.value);
        this.duration = minutes * 60;
        this.timeRemaining = this.duration;
        this.updateDisplay();
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.focusTimeSelect.disabled = true;
        
        this.timerId = setInterval(() => {
            this.timeRemaining--;
            this.updateDisplay();
            
            if (this.timeRemaining <= 0) {
                this.complete();
            }
        }, 1000);
    }
    
    pause() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        
        clearInterval(this.timerId);
    }
    
    reset() {
        this.pause();
        this.timeRemaining = this.duration;
        this.updateDisplay();
        this.focusTimeSelect.disabled = false;
    }
    
    updateDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        this.timerDisplay.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    async complete() {
        this.pause();
        this.focusTimeSelect.disabled = false;
        
        const focusMinutes = parseInt(this.focusTimeSelect.value);
        
        try {
            const response = await fetch('/api/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ focus_minutes: focusMinutes }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showXPGain(data.xp_earned);
                
                if (data.level_up) {
                    this.showLevelUp(data.level);
                }
                
                if (data.new_achievements && data.new_achievements.length > 0) {
                    data.new_achievements.forEach((achievement, index) => {
                        setTimeout(() => {
                            this.showAchievementNotification(achievement);
                        }, index * 2000);
                    });
                }
                
                this.loadUserStatus();
                this.loadAchievements();
                this.loadStatistics();
            }
        } catch (error) {
            console.error('Error completing pomodoro:', error);
        }
        
        this.reset();
        this.playCompletionSound();
    }
    
    playCompletionSound() {
        // Create a simple beep sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            
            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
            }, 200);
        } catch (e) {
            // Audio not supported or blocked
        }
    }
    
    showXPGain(xp) {
        // Create floating XP notification
        const notification = document.createElement('div');
        notification.className = 'xp-gain';
        notification.textContent = `+${xp} XP`;
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #f39c12, #e67e22);
            color: white;
            padding: 20px 40px;
            border-radius: 10px;
            font-size: 2rem;
            font-weight: bold;
            z-index: 1001;
            animation: fadeInUp 2s forwards;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }
    
    showLevelUp(level) {
        const notification = document.getElementById('level-up-notification');
        document.getElementById('new-level').textContent = level;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    showAchievementNotification(achievement) {
        const notification = document.getElementById('notification');
        document.getElementById('notification-icon').textContent = achievement.icon;
        document.getElementById('notification-title').textContent = achievement.name;
        document.getElementById('notification-message').textContent = achievement.description;
        
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    async loadUserStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            document.getElementById('user-level').textContent = data.level;
            document.getElementById('current-xp').textContent = data.current_level_xp;
            document.getElementById('next-level-xp').textContent = data.xp_for_next_level;
            document.getElementById('current-streak').textContent = data.current_streak;
            document.getElementById('total-pomodoros').textContent = data.total_pomodoros;
            
            // Update XP progress bar
            const progress = (data.current_level_xp / data.xp_for_next_level) * 100;
            document.getElementById('xp-progress').style.width = `${progress}%`;
        } catch (error) {
            console.error('Error loading user status:', error);
        }
    }
    
    async loadAchievements() {
        try {
            const response = await fetch('/api/achievements');
            const data = await response.json();
            
            const grid = document.getElementById('achievements-grid');
            grid.innerHTML = '';
            
            let earnedCount = 0;
            
            data.achievements.forEach(achievement => {
                if (achievement.earned) earnedCount++;
                
                const card = document.createElement('div');
                card.className = `achievement-card ${achievement.earned ? 'earned' : 'locked'}`;
                card.innerHTML = `
                    <span class="achievement-icon">${achievement.earned ? achievement.icon : '🔒'}</span>
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-description">${achievement.description}</div>
                    ${achievement.earned ? '<div class="achievement-status">✓ Earned</div>' : ''}
                `;
                grid.appendChild(card);
            });
            
            document.getElementById('achievements-earned').textContent = earnedCount;
            document.getElementById('achievements-total').textContent = data.achievements.length;
        } catch (error) {
            console.error('Error loading achievements:', error);
        }
    }
    
    async loadStatistics() {
        try {
            const response = await fetch('/api/statistics');
            const data = await response.json();
            
            // Update stat cards
            document.getElementById('stat-total').textContent = data.total_pomodoros;
            
            const hours = Math.floor(data.total_focus_time_minutes / 60);
            const mins = data.total_focus_time_minutes % 60;
            document.getElementById('stat-focus-time').textContent = 
                hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            
            document.getElementById('stat-avg-day').textContent = data.average_per_day;
            document.getElementById('stat-longest-streak').textContent = data.longest_streak;
            
            document.getElementById('weekly-total').textContent = data.weekly_total;
            document.getElementById('monthly-total').textContent = data.monthly_total;
            
            // Render weekly chart
            this.renderWeeklyChart(data.weekly_completions);
            
            // Render monthly heatmap
            this.renderMonthlyHeatmap(data.monthly_completions);
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }
    
    renderWeeklyChart(weeklyData) {
        const chart = document.getElementById('weekly-chart');
        chart.innerHTML = '';
        
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const values = Object.values(weeklyData);
        const maxValue = Math.max(...values, 1);
        
        Object.entries(weeklyData).forEach(([date, count], index) => {
            const height = (count / maxValue) * 120;
            const barItem = document.createElement('div');
            barItem.className = 'bar-item';
            barItem.innerHTML = `
                <div class="bar-value">${count}</div>
                <div class="bar" style="height: ${Math.max(height, 5)}px"></div>
                <div class="bar-label">${days[index]}</div>
            `;
            chart.appendChild(barItem);
        });
    }
    
    renderMonthlyHeatmap(monthlyData) {
        const heatmap = document.getElementById('monthly-chart');
        heatmap.innerHTML = '';
        
        Object.entries(monthlyData).forEach(([date, count]) => {
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            cell.title = `${date}: ${count} pomodoros`;
            
            if (count > 0) {
                if (count >= 4) {
                    cell.classList.add('level-4');
                } else if (count >= 3) {
                    cell.classList.add('level-3');
                } else if (count >= 2) {
                    cell.classList.add('level-2');
                } else {
                    cell.classList.add('level-1');
                }
            }
            
            heatmap.appendChild(cell);
        });
    }
    
    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabId}-tab`);
        });
    }
}

// Add CSS animation for XP gain
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        0% {
            opacity: 0;
            transform: translate(-50%, -30%);
        }
        20% {
            opacity: 1;
            transform: translate(-50%, -50%);
        }
        80% {
            opacity: 1;
            transform: translate(-50%, -50%);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -70%);
        }
    }
`;
document.head.appendChild(style);

// Initialize the timer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PomodoroTimer();
});
