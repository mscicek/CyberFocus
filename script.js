
const CONFIG = {
    MODES: {
        pomodoro: { time: 25 * 60, label: 'POMODORO' },
        short: { time: 5 * 60, label: 'SHORT_BRK' },
        long: { time: 15 * 60, label: 'LONG_BRK' },
        custom: { time: 0, label: 'CUSTOM' }, // Dynamic
        stopwatch: { time: 0, label: 'CHRONO' }
    },
    XP_PER_POMO: 50,
    LEVEL_THRESHOLDS: [
        { level: 'NOVICE', xp: 0 },
        { level: 'RUNNER', xp: 200 },
        { level: 'NETRUNNER', xp: 800 },
        { level: 'CYBERPSYCHO', xp: 2000 },
        { level: 'LEGEND', xp: 5000 }
    ]
};

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = false;
        this.statusEl = document.getElementById('audio-status');
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.enabled = true;
            this.updateStatus();

            // Resume if suspended (common in browsers)
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }
    }

    toggle() {
        // Init handled by interactions now
        this.init();
    }

    updateStatus() {
        if (this.statusEl) {
            this.statusEl.textContent = this.enabled ? 'ON' : 'OFF';
            this.statusEl.style.color = this.enabled ? 'var(--neon-cyan)' : '#555';
        }
    }

    playAlarm() {
        if (!this.enabled || !this.ctx) return;

        // Synthwave Style Arpeggio Alarm
        const now = this.ctx.currentTime;
        this.playOsc(now, 440, 'sawtooth', 0.2); // A4
        this.playOsc(now + 0.2, 554.37, 'sawtooth', 0.2); // C#5
        this.playOsc(now + 0.4, 659.25, 'sawtooth', 0.2); // E5
        this.playOsc(now + 0.6, 880, 'square', 0.6); // A5 (Longer)
    }

    playOsc(time, freq, type, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + duration);
    }
}

class Gamification {
    constructor() {
        this.state = JSON.parse(localStorage.getItem('cyberfocus_gamification')) || {
            xp: 0,
            level: 1
        };

        this.xpBar = document.getElementById('xp-bar-fill');
        this.rankNameEl = document.getElementById('rank-name');
        this.levelNumEl = document.getElementById('level-num');

        this.updateUI();
    }

    addXP(amount) {
        this.state.xp += amount;
        this.checkLevelUp();
        this.save();
        this.updateUI();
    }

    checkLevelUp() {
        // Simple linear leveling for demo purposes, or use thresholds
        // Let's use thresholds from CONFIG
        let currentRank = CONFIG.LEVEL_THRESHOLDS[0];
        let nextRankXP = CONFIG.LEVEL_THRESHOLDS[1].xp;
        let level = 1;

        for (let i = 0; i < CONFIG.LEVEL_THRESHOLDS.length; i++) {
            if (this.state.xp >= CONFIG.LEVEL_THRESHOLDS[i].xp) {
                currentRank = CONFIG.LEVEL_THRESHOLDS[i];
                level = i + 1;
                nextRankXP = CONFIG.LEVEL_THRESHOLDS[i + 1] ? CONFIG.LEVEL_THRESHOLDS[i + 1].xp : this.state.xp * 1.5;
            }
        }

        this.state.level = level;
        this.currentRankLabel = currentRank.level;
        this.nextLevelXP = nextRankXP;
    }

    updateUI() {
        this.checkLevelUp();
        this.rankNameEl.textContent = this.currentRankLabel;
        this.levelNumEl.textContent = this.state.level;

        // Calculate percentage for next level
        let prevRankXP = 0;
        const thresholds = CONFIG.LEVEL_THRESHOLDS;
        for (let i = 0; i < thresholds.length; i++) {
            if (thresholds[i].level === this.currentRankLabel) {
                prevRankXP = thresholds[i].xp;
                break;
            }
        }

        const range = this.nextLevelXP - prevRankXP;
        const current = this.state.xp - prevRankXP;
        const percent = Math.min(100, Math.max(0, (current / range) * 100));

        this.xpBar.style.width = `${percent}%`;
    }

    save() {
        localStorage.setItem('cyberfocus_gamification', JSON.stringify(this.state));
    }
}

class ThemeManager {
    constructor() {
        this.btn = document.getElementById('theme-toggle');
        this.isLight = localStorage.getItem('cyberfocus_theme') === 'light';

        if (this.isLight) {
            document.body.classList.add('light-theme');
            this.btn.textContent = '🌙'; // Moon icon
        }

        this.btn.addEventListener('click', () => this.toggle());
    }

    toggle() {
        this.isLight = !this.isLight;
        document.body.classList.toggle('light-theme');

        if (this.isLight) {
            this.btn.textContent = '🌙';
            localStorage.setItem('cyberfocus_theme', 'light');
        } else {
            this.btn.textContent = '☀';
            localStorage.setItem('cyberfocus_theme', 'dark');
        }
    }
}

class TaskManager {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('cyberfocus_tasks')) || [];
        this.activeTaskId = localStorage.getItem('cyberfocus_active_task_id') || null;

        this.taskListEl = document.getElementById('task-list');
        this.inputEl = document.getElementById('task-input');
        this.addBtn = document.getElementById('add-task-btn');
        this.activeIndicator = document.getElementById('active-task-indicator');

        this.addBtn.addEventListener('click', () => this.addTask());
        this.inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        this.render();
    }

    addTask() {
        const text = this.inputEl.value.trim();
        if (!text) return;

        const task = {
            id: Date.now().toString(),
            text: text,
            completed: false
        };

        this.tasks.push(task);
        this.inputEl.value = '';
        this.save();
        this.render();
    }

    toggleComplete(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.save();
            this.render();
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        if (this.activeTaskId === id) {
            this.activeTaskId = null;
        }
        this.save();
        this.render();
    }

    setActive(id) {
        if (this.activeTaskId === id) {
            this.activeTaskId = null; // Deselect
        } else {
            this.activeTaskId = id;
        }
        this.save();
        this.render();
    }

    save() {
        localStorage.setItem('cyberfocus_tasks', JSON.stringify(this.tasks));
        localStorage.setItem('cyberfocus_active_task_id', this.activeTaskId || '');
    }

    render() {
        this.taskListEl.innerHTML = '';
        let activeTaskName = "NO ACTIVE MISSION";

        this.tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === this.activeTaskId ? 'active-mission' : ''}`;

            const span = document.createElement('span');
            span.textContent = task.text;
            span.onclick = () => this.setActive(task.id);
            span.style.flex = "1";

            if (task.id === this.activeTaskId) activeTaskName = task.text;

            const actions = document.createElement('div');

            // Delete Btn
            const delBtn = document.createElement('button');
            delBtn.className = 'del-btn';
            delBtn.innerHTML = '&times;';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteTask(task.id);
            };

            actions.appendChild(delBtn);
            li.appendChild(span);
            li.appendChild(actions);
            this.taskListEl.appendChild(li);
        });

        this.activeIndicator.textContent = activeTaskName.toUpperCase();
        if (this.activeTaskId) {
            this.activeIndicator.classList.add('blink-text');
        } else {
            this.activeIndicator.classList.remove('blink-text');
        }
    }
}

class TimerEngine {
    constructor(soundEngine, gamification) {
        this.sound = soundEngine;
        this.game = gamification;

        this.minutesEl = document.getElementById('minutes');
        this.secondsEl = document.getElementById('seconds');
        this.statusEl = document.getElementById('timer-status');
        this.startBtn = document.getElementById('start-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.modeBtns = document.querySelectorAll('.mode-btn');

        this.customContainer = document.getElementById('custom-input-container');
        this.customSetBtn = document.getElementById('set-custom-btn');
        this.customMinIn = document.getElementById('custom-min');
        this.customSecIn = document.getElementById('custom-sec');

        this.mode = 'pomodoro';
        this.isRunning = false;
        this.timeLeft = CONFIG.MODES.pomodoro.time;
        this.interval = null;

        this.initListeners();
        this.updateDisplay();
    }

    initListeners() {
        this.startBtn.addEventListener('click', () => this.toggleTimer());
        this.resetBtn.addEventListener('click', () => this.resetTimer());

        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.setMode(e.target.dataset.mode));
        });

        this.customSetBtn.addEventListener('click', () => {
            const m = parseInt(this.customMinIn.value) || 0;
            const s = parseInt(this.customSecIn.value) || 0;
            this.timeLeft = (m * 60) + s;
            CONFIG.MODES.custom.time = this.timeLeft; // Update config
            this.updateDisplay();
            this.customContainer.classList.add('hidden');
        });
    }

    setMode(newMode) {
        this.pause();
        this.mode = newMode;

        // UI Update
        this.modeBtns.forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-mode="${newMode}"]`).classList.add('active');

        if (newMode === 'stopwatch') {
            this.timeLeft = 0;
        } else if (newMode === 'custom') {
            this.customContainer.classList.remove('hidden');
            // Wait for input, don't auto set time yet unless prev exists
            if (CONFIG.MODES.custom.time > 0) this.timeLeft = CONFIG.MODES.custom.time;
        } else {
            this.customContainer.classList.add('hidden');
            this.timeLeft = CONFIG.MODES[newMode].time;
        }

        this.updateDisplay();
        this.statusEl.textContent = CONFIG.MODES[newMode].label + ' READY';
    }

    toggleTimer() {
        // First user interaction is a good time to resume AudioContext
        this.sound.init();

        if (this.isRunning) {
            this.pause();
        } else {
            this.start();
        }
    }

    start() {
        this.isRunning = true;
        this.startBtn.textContent = 'PAUSE';
        this.startBtn.classList.remove('glitch-btn'); // Stabilize
        this.statusEl.textContent = 'SYSTEM ACTIVE...';

        this.interval = setInterval(() => {
            this.tick();
        }, 1000);
    }

    pause() {
        this.isRunning = false;
        this.startBtn.textContent = 'RESUME';
        clearInterval(this.interval);
        this.statusEl.textContent = 'SYSTEM PAUSED';
    }

    resetTimer() {
        this.pause();
        this.startBtn.textContent = 'START';
        this.startBtn.classList.add('glitch-btn'); // Add glitch back

        if (this.mode === 'stopwatch') {
            this.timeLeft = 0;
        } else {
            this.timeLeft = CONFIG.MODES[this.mode].time;
        }
        this.updateDisplay();
        this.statusEl.textContent = 'SYSTEM READY';
    }

    tick() {
        if (this.mode === 'stopwatch') {
            this.timeLeft++;
        } else {
            if (this.timeLeft > 0) {
                this.timeLeft--;
            } else {
                this.finish();
            }
        }
        this.updateDisplay();
    }

    finish() {
        this.pause();
        this.sound.playAlarm();
        this.startBtn.textContent = 'START';
        this.statusEl.textContent = 'SEQUENCE COMPLETED';

        // XP Reward
        if (this.mode === 'pomodoro') {
            this.game.addXP(CONFIG.XP_PER_POMO);
            alert(`SEQUENCE COMPLETE. +${CONFIG.XP_PER_POMO} XP CREDITS UPLOADED.`);
        } else {
            alert('TIMER FINISHED.');
        }
    }

    updateDisplay() {
        const m = Math.floor(this.timeLeft / 60);
        const s = this.timeLeft % 60;
        this.minutesEl.textContent = m.toString().padStart(2, '0');
        this.secondsEl.textContent = s.toString().padStart(2, '0');

        // Dynamic Title
        document.title = `(${this.minutesEl.textContent}:${this.secondsEl.textContent}) CYBERFOCUS`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const sound = new SoundEngine();
    const game = new Gamification();
    const tasks = new TaskManager();
    const timer = new TimerEngine(sound, game);
    const theme = new ThemeManager();
});
