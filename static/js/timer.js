/**
 * Pomodoro Timer Application
 * Features:
 * - Flexible focus time (15, 25, 35, 45 minutes)
 * - Custom break time (5, 10, 15 minutes)
 * - Theme switching (Dark, Light, Focus)
 * - Sound settings (Start, End, Ticking sounds)
 */

// Audio Context for generating sounds
let audioContext = null;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// Generate beep sound
function playBeep(frequency = 440, duration = 0.2, volume = 0.3) {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, ctx.currentTime + duration);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
        console.log('Audio not supported:', e);
    }
}

// Sound functions
function playStartSound() {
    playBeep(660, 0.15, 0.3);
    setTimeout(() => playBeep(880, 0.15, 0.3), 150);
}

function playEndSound() {
    playBeep(880, 0.2, 0.4);
    setTimeout(() => playBeep(660, 0.2, 0.4), 200);
    setTimeout(() => playBeep(880, 0.3, 0.4), 400);
}

function playTickSound() {
    playBeep(200, 0.05, 0.1);
}

// Timer State
const state = {
    focusDuration: 25,
    breakDuration: 5,
    timeRemaining: 25 * 60,
    isRunning: false,
    isBreak: false,
    currentSession: 1,
    totalSessions: 4,
    intervalId: null,
    settings: {
        theme: 'dark',
        startSound: true,
        endSound: true,
        tickingSound: false
    }
};

// DOM Elements
const minutesDisplay = document.getElementById('minutes');
const secondsDisplay = document.getElementById('seconds');
const timerLabel = document.getElementById('timerLabel');
const sessionCount = document.getElementById('sessionCount');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModal = document.getElementById('closeModal');

// Setting buttons
const focusDurationBtns = document.querySelectorAll('#focusDuration .option-btn');
const breakDurationBtns = document.querySelectorAll('#breakDuration .option-btn');
const themeBtns = document.querySelectorAll('#themeSelection .option-btn');
const startSoundToggle = document.getElementById('startSound');
const endSoundToggle = document.getElementById('endSound');
const tickingSoundToggle = document.getElementById('tickingSound');

// Initialize
function init() {
    loadSettings();
    updateDisplay();
    attachEventListeners();
}

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem('pomodoroSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        state.focusDuration = settings.focusDuration || 25;
        state.breakDuration = settings.breakDuration || 5;
        state.settings.theme = settings.theme || 'dark';
        state.settings.startSound = settings.startSound !== false;
        state.settings.endSound = settings.endSound !== false;
        state.settings.tickingSound = settings.tickingSound || false;
        
        // Apply settings to UI
        applyTheme(state.settings.theme);
        updateSettingsUI();
        
        // Set initial time
        state.timeRemaining = state.focusDuration * 60;
    }
}

// Save settings to localStorage
function saveSettings() {
    const settings = {
        focusDuration: state.focusDuration,
        breakDuration: state.breakDuration,
        theme: state.settings.theme,
        startSound: state.settings.startSound,
        endSound: state.settings.endSound,
        tickingSound: state.settings.tickingSound
    };
    localStorage.setItem('pomodoroSettings', JSON.stringify(settings));
}

// Update settings UI to match state
function updateSettingsUI() {
    // Update focus duration buttons
    focusDurationBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.value) === state.focusDuration);
    });
    
    // Update break duration buttons
    breakDurationBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.value) === state.breakDuration);
    });
    
    // Update theme buttons
    themeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === state.settings.theme);
    });
    
    // Update sound toggles
    startSoundToggle.checked = state.settings.startSound;
    endSoundToggle.checked = state.settings.endSound;
    tickingSoundToggle.checked = state.settings.tickingSound;
}

// Apply theme
function applyTheme(theme) {
    document.body.className = `theme-${theme}`;
    state.settings.theme = theme;
}

// Update timer display
function updateDisplay() {
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = state.timeRemaining % 60;
    
    minutesDisplay.textContent = String(minutes).padStart(2, '0');
    secondsDisplay.textContent = String(seconds).padStart(2, '0');
    
    timerLabel.textContent = state.isBreak ? 'Break Time' : 'Focus Time';
    sessionCount.textContent = `Session: ${state.currentSession}/${state.totalSessions}`;
    
    // Update page title
    document.title = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} - Pomodoro Timer`;
}

// Start timer
function startTimer() {
    if (state.isRunning) return;
    
    state.isRunning = true;
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    
    if (state.settings.startSound) {
        playStartSound();
    }
    
    state.intervalId = setInterval(() => {
        if (state.timeRemaining > 0) {
            state.timeRemaining--;
            updateDisplay();
            
            if (state.settings.tickingSound) {
                playTickSound();
            }
        } else {
            timerComplete();
        }
    }, 1000);
}

// Pause timer
function pauseTimer() {
    if (!state.isRunning) return;
    
    state.isRunning = false;
    clearInterval(state.intervalId);
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

// Reset timer
function resetTimer() {
    pauseTimer();
    state.isBreak = false;
    state.timeRemaining = state.focusDuration * 60;
    state.currentSession = 1;
    updateDisplay();
}

// Timer complete handler
function timerComplete() {
    pauseTimer();
    
    if (state.settings.endSound) {
        playEndSound();
    }
    
    if (state.isBreak) {
        // Break finished, start new focus session
        state.isBreak = false;
        if (state.currentSession < state.totalSessions) {
            state.currentSession++;
        } else {
            state.currentSession = 1;
        }
        state.timeRemaining = state.focusDuration * 60;
    } else {
        // Focus finished, start break
        state.isBreak = true;
        state.timeRemaining = state.breakDuration * 60;
    }
    
    updateDisplay();
}

// Event Listeners
function attachEventListeners() {
    // Timer controls
    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    resetBtn.addEventListener('click', resetTimer);
    
    // Settings modal
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
    });
    
    closeModal.addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });
    
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });
    
    // Focus duration buttons
    focusDurationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = parseInt(btn.dataset.value);
            state.focusDuration = value;
            
            focusDurationBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Reset timer if not running and not on break
            if (!state.isRunning && !state.isBreak) {
                state.timeRemaining = value * 60;
                updateDisplay();
            }
            
            saveSettings();
        });
    });
    
    // Break duration buttons
    breakDurationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = parseInt(btn.dataset.value);
            state.breakDuration = value;
            
            breakDurationBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update display if on break
            if (state.isBreak && !state.isRunning) {
                state.timeRemaining = value * 60;
                updateDisplay();
            }
            
            saveSettings();
        });
    });
    
    // Theme buttons
    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.value;
            applyTheme(theme);
            
            themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            saveSettings();
        });
    });
    
    // Sound toggles
    startSoundToggle.addEventListener('change', () => {
        state.settings.startSound = startSoundToggle.checked;
        saveSettings();
    });
    
    endSoundToggle.addEventListener('change', () => {
        state.settings.endSound = endSoundToggle.checked;
        saveSettings();
    });
    
    tickingSoundToggle.addEventListener('change', () => {
        state.settings.tickingSound = tickingSoundToggle.checked;
        saveSettings();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                if (state.isRunning) {
                    pauseTimer();
                } else {
                    startTimer();
                }
                break;
            case 'KeyR':
                resetTimer();
                break;
            case 'Escape':
                settingsModal.classList.remove('active');
                break;
        }
    });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', init);
