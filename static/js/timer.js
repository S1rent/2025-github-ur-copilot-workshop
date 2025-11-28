/**
 * Pomodoro Timer with Enhanced Visual Feedback
 * 
 * Features:
 * - Circular progress bar animation
 * - Color gradient transitions (blue → yellow → red)
 * - Dynamic particle and ripple background effects
 */

// ===========================================
// Timer Configuration
// ===========================================
const config = {
    workDuration: 25 * 60,      // 25 minutes in seconds
    shortBreakDuration: 5 * 60,  // 5 minutes in seconds
    longBreakDuration: 20 * 60,  // 20 minutes in seconds
    sessionsBeforeLongBreak: 4
};

// ===========================================
// Timer State
// ===========================================
let state = {
    timeRemaining: config.workDuration,
    totalTime: config.workDuration,
    isRunning: false,
    isPaused: false,
    isWorkSession: true,
    sessionCount: 0,
    intervalId: null
};

// ===========================================
// DOM Elements
// ===========================================
const elements = {
    timer: document.getElementById('timer'),
    status: document.getElementById('status'),
    startBtn: document.getElementById('start-btn'),
    resetBtn: document.getElementById('reset-btn'),
    skipBtn: document.getElementById('skip-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    modeIndicator: document.getElementById('mode-indicator'),
    sessionCount: document.getElementById('session-count'),
    progressCircle: document.getElementById('progress-circle'),
    gradientStop1: document.getElementById('gradient-stop-1'),
    gradientStop2: document.getElementById('gradient-stop-2'),
    settingsModal: document.getElementById('settings-modal'),
    workDurationInput: document.getElementById('work-duration'),
    breakDurationInput: document.getElementById('break-duration'),
    longBreakDurationInput: document.getElementById('long-break-duration'),
    saveSettingsBtn: document.getElementById('save-settings'),
    cancelSettingsBtn: document.getElementById('cancel-settings'),
    particlesContainer: document.getElementById('particles-container'),
    rippleContainer: document.getElementById('ripple-container')
};

// Circle circumference for progress calculation (2 * PI * radius)
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 90;

// ===========================================
// Color Gradient System
// ===========================================
const colors = {
    blue: { r: 79, g: 157, b: 255 },    // #4F9DFF - Start
    yellow: { r: 255, g: 217, b: 61 },  // #FFD93D - Midway
    red: { r: 255, g: 107, b: 107 }     // #FF6B6B - Near end
};

/**
 * Interpolate between two colors
 */
function lerpColor(color1, color2, factor) {
    return {
        r: Math.round(color1.r + (color2.r - color1.r) * factor),
        g: Math.round(color1.g + (color2.g - color1.g) * factor),
        b: Math.round(color1.b + (color2.b - color1.b) * factor)
    };
}

/**
 * Convert RGB object to hex color string
 */
function rgbToHex(color) {
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/**
 * Calculate progress color based on time remaining
 * Blue (100%) → Yellow (50%) → Red (0%)
 */
function getProgressColor(progress) {
    if (progress > 0.5) {
        // Blue to Yellow (100% to 50%)
        const factor = (1 - progress) * 2;
        return lerpColor(colors.blue, colors.yellow, factor);
    } else {
        // Yellow to Red (50% to 0%)
        const factor = (0.5 - progress) * 2;
        return lerpColor(colors.yellow, colors.red, factor);
    }
}

/**
 * Update the progress circle color and gradient
 */
function updateProgressColor(progress) {
    const currentColor = getProgressColor(progress);
    const colorStr = rgbToHex(currentColor);
    
    elements.gradientStop1.style.stopColor = colorStr;
    elements.gradientStop2.style.stopColor = colorStr;
    
    // Update timer text color class
    elements.timer.classList.remove('color-blue', 'color-yellow', 'color-red');
    if (progress > 0.5) {
        elements.timer.classList.add('color-blue');
    } else if (progress > 0.2) {
        elements.timer.classList.add('color-yellow');
    } else {
        elements.timer.classList.add('color-red');
    }
}

// ===========================================
// Progress Ring Animation
// ===========================================

/**
 * Update the circular progress bar
 */
function updateProgressRing(progress) {
    const offset = CIRCLE_CIRCUMFERENCE * (1 - progress);
    elements.progressCircle.style.strokeDashoffset = offset;
    
    // Add glow effect when running
    if (state.isRunning) {
        elements.progressCircle.classList.add('glowing');
    } else {
        elements.progressCircle.classList.remove('glowing');
    }
}

// ===========================================
// Particle Effects
// ===========================================
let particles = [];
let particleInterval = null;

/**
 * Create a single particle
 */
function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Random position and animation
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.animationDuration = `${6 + Math.random() * 6}s`;
    particle.style.animationDelay = `${Math.random() * 2}s`;
    particle.style.width = `${4 + Math.random() * 8}px`;
    particle.style.height = particle.style.width;
    
    elements.particlesContainer.appendChild(particle);
    particles.push(particle);
    
    // Remove particle after animation
    setTimeout(() => {
        particle.remove();
        particles = particles.filter(p => p !== particle);
    }, 14000);
}

/**
 * Start particle animation
 */
function startParticles() {
    // Create initial batch of particles
    for (let i = 0; i < 15; i++) {
        setTimeout(() => createParticle(), i * 200);
    }
    
    // Continue creating particles
    particleInterval = setInterval(createParticle, 800);
    document.body.classList.add('timer-running', 'focus-mode');
}

/**
 * Stop particle animation
 */
function stopParticles() {
    if (particleInterval) {
        clearInterval(particleInterval);
        particleInterval = null;
    }
    document.body.classList.remove('timer-running', 'focus-mode');
    document.body.classList.add('timer-paused');
}

/**
 * Clear all particles
 */
function clearParticles() {
    particles.forEach(p => p.remove());
    particles = [];
    if (particleInterval) {
        clearInterval(particleInterval);
        particleInterval = null;
    }
    document.body.classList.remove('timer-running', 'timer-paused', 'focus-mode');
}

// ===========================================
// Ripple Effects
// ===========================================
let ripples = [];
let rippleInterval = null;

/**
 * Create a single ripple
 */
function createRipple() {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    
    // Position ripple at center of timer
    const timerDisplay = document.querySelector('.timer-display');
    const rect = timerDisplay.getBoundingClientRect();
    
    ripple.style.left = `${rect.left + rect.width / 2}px`;
    ripple.style.top = `${rect.top + rect.height / 2}px`;
    
    elements.rippleContainer.appendChild(ripple);
    ripples.push(ripple);
    
    // Remove ripple after animation
    setTimeout(() => {
        ripple.remove();
        ripples = ripples.filter(r => r !== ripple);
    }, 4000);
}

/**
 * Start ripple animation
 */
function startRipples() {
    createRipple();
    rippleInterval = setInterval(createRipple, 2000);
}

/**
 * Stop ripple animation
 */
function stopRipples() {
    if (rippleInterval) {
        clearInterval(rippleInterval);
        rippleInterval = null;
    }
}

/**
 * Clear all ripples
 */
function clearRipples() {
    ripples.forEach(r => r.remove());
    ripples = [];
    stopRipples();
}

// ===========================================
// Timer Functions
// ===========================================

/**
 * Format seconds as MM:SS
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Update the timer display
 */
function updateDisplay() {
    elements.timer.textContent = formatTime(state.timeRemaining);
    
    // Calculate progress (1 = full, 0 = empty)
    const progress = state.timeRemaining / state.totalTime;
    
    // Update visual elements
    updateProgressRing(progress);
    updateProgressColor(progress);
    
    // Update session count
    elements.sessionCount.textContent = state.sessionCount;
    
    // Pulse animation on minute changes
    if (state.timeRemaining % 60 === 0 && state.isRunning) {
        elements.timer.classList.add('pulse');
        setTimeout(() => elements.timer.classList.remove('pulse'), 500);
    }
}

/**
 * Start the timer
 */
function startTimer() {
    if (state.isRunning) {
        // Pause
        pauseTimer();
        return;
    }
    
    state.isRunning = true;
    state.isPaused = false;
    
    elements.startBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
    elements.status.textContent = state.isWorkSession ? '🍅 Focus time!' : '☕ Break time!';
    
    // Start visual effects
    if (state.isWorkSession) {
        startParticles();
        startRipples();
    }
    
    state.intervalId = setInterval(() => {
        state.timeRemaining--;
        updateDisplay();
        
        if (state.timeRemaining <= 0) {
            timerComplete();
        }
    }, 1000);
}

/**
 * Pause the timer
 */
function pauseTimer() {
    state.isRunning = false;
    state.isPaused = true;
    
    clearInterval(state.intervalId);
    state.intervalId = null;
    
    elements.startBtn.innerHTML = '<span class="btn-icon">▶</span> Resume';
    elements.status.textContent = '⏸ Paused';
    
    stopParticles();
    stopRipples();
}

/**
 * Reset the timer
 */
function resetTimer() {
    state.isRunning = false;
    state.isPaused = false;
    
    if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
    }
    
    state.timeRemaining = state.isWorkSession ? config.workDuration : 
        (state.sessionCount > 0 && state.sessionCount % config.sessionsBeforeLongBreak === 0 
            ? config.longBreakDuration 
            : config.shortBreakDuration);
    state.totalTime = state.timeRemaining;
    
    elements.startBtn.innerHTML = '<span class="btn-icon">▶</span> Start';
    elements.status.textContent = '▶ Ready to start';
    
    clearParticles();
    clearRipples();
    updateDisplay();
}

/**
 * Skip current session
 */
function skipSession() {
    if (state.isWorkSession) {
        state.sessionCount++;
    }
    state.isWorkSession = !state.isWorkSession;
    
    updateModeIndicator();
    resetTimer();
}

/**
 * Timer completed
 */
function timerComplete() {
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.isRunning = false;
    
    clearParticles();
    clearRipples();
    
    // Play notification sound (browser notification API could be added here)
    elements.status.textContent = '🎉 Time\'s up!';
    
    // Increment session count if work session completed
    if (state.isWorkSession) {
        state.sessionCount++;
    }
    
    // Switch mode
    state.isWorkSession = !state.isWorkSession;
    updateModeIndicator();
    
    // Auto-start next session after a brief delay
    setTimeout(() => {
        resetTimer();
    }, 2000);
}

/**
 * Update mode indicator badge
 */
function updateModeIndicator() {
    if (state.isWorkSession) {
        elements.modeIndicator.textContent = 'Work Session';
        elements.modeIndicator.classList.remove('break');
        elements.modeIndicator.classList.add('work');
    } else {
        const isLongBreak = state.sessionCount > 0 && 
            state.sessionCount % config.sessionsBeforeLongBreak === 0;
        elements.modeIndicator.textContent = isLongBreak ? 'Long Break' : 'Short Break';
        elements.modeIndicator.classList.remove('work');
        elements.modeIndicator.classList.add('break');
    }
}

// ===========================================
// Settings Functions
// ===========================================

/**
 * Open settings modal
 */
function openSettings() {
    elements.settingsModal.classList.remove('hidden');
    elements.workDurationInput.value = config.workDuration / 60;
    elements.breakDurationInput.value = config.shortBreakDuration / 60;
    elements.longBreakDurationInput.value = config.longBreakDuration / 60;
}

/**
 * Close settings modal
 */
function closeSettings() {
    elements.settingsModal.classList.add('hidden');
}

/**
 * Save settings
 */
function saveSettings() {
    const workMinutes = parseInt(elements.workDurationInput.value, 10);
    const breakMinutes = parseInt(elements.breakDurationInput.value, 10);
    const longBreakMinutes = parseInt(elements.longBreakDurationInput.value, 10);
    
    if (workMinutes > 0 && breakMinutes > 0 && longBreakMinutes > 0) {
        config.workDuration = workMinutes * 60;
        config.shortBreakDuration = breakMinutes * 60;
        config.longBreakDuration = longBreakMinutes * 60;
        
        resetTimer();
        closeSettings();
    }
}

// ===========================================
// Event Listeners
// ===========================================
elements.startBtn.addEventListener('click', startTimer);
elements.resetBtn.addEventListener('click', resetTimer);
elements.skipBtn.addEventListener('click', skipSession);
elements.settingsBtn.addEventListener('click', openSettings);
elements.saveSettingsBtn.addEventListener('click', saveSettings);
elements.cancelSettingsBtn.addEventListener('click', closeSettings);

// Close modal when clicking outside
elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) {
        closeSettings();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.key.toLowerCase()) {
        case ' ':
            e.preventDefault();
            startTimer();
            break;
        case 'r':
            resetTimer();
            break;
        case 's':
            skipSession();
            break;
        case 'escape':
            closeSettings();
            break;
    }
});

// ===========================================
// Initialization
// ===========================================
function init() {
    updateDisplay();
    updateModeIndicator();
    
    // Set initial progress ring state
    elements.progressCircle.style.strokeDasharray = CIRCLE_CIRCUMFERENCE;
}

// Initialize on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
