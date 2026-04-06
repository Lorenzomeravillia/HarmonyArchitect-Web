/**
 * ClearVoicing Video Simulation Engine
 * Injected when ?sim=VIDEO_ID is present in the URL.
 */

(function () {
    const simId = new URLSearchParams(window.location.search).get('sim');
    if (!simId) return;

    console.log(`[VideoSim] Initializing simulation: ${simId}`);

    // --- OVERLAY CSS ---
    const simCss = `
        /* Tap Indicator */
        .sim-tap-indicator {
            position: fixed;
            width: 40px; height: 40px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.4);
            transform: scale(0);
            pointer-events: none;
            z-index: 999999;
        }
        .sim-tap-indicator.active {
            animation: sim-tap 400ms ease-out forwards;
        }
        @keyframes sim-tap {
            0% { transform: scale(0.5); opacity: 0.8; }
            100% { transform: scale(2.5); opacity: 0; }
        }

        /* Video Captions */
        .sim-caption-container {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 24px;
            font-weight: 700;
            text-align: center;
            z-index: 100000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            backdrop-filter: blur(4px);
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            min-width: 250px;
        }
        .sim-caption-container.show { opacity: 1; }

        /* Sim Control Panel */
        #sim_panel {
            position: fixed;
            top: 10px; left: 10px;
            width: 220px;
            background: rgba(10, 17, 40, 0.9);
            border: 2px solid #55EFC4;
            color: white;
            padding: 10px;
            z-index: 100000;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            backdrop-filter: blur(4px);
        }
        #sim_panel button {
            background: #2D5A9E; color: white; border: none; padding: 4px 8px;
            margin: 2px; cursor: pointer; border-radius: 4px;
        }
        #sim_panel button.hidden-panel-btn { background: #E74C3C; float: right; padding: 2px 5px; }
        .sim-highlight { box-shadow: 0 0 0 4px #55EFC4 !important; border-radius: 4px; transition: 0.2s; }
    `;
    const style = document.createElement('style');
    style.innerHTML = simCss;
    document.head.appendChild(style);

    // --- DOM ELEMENTS ---
    const tapDiv = document.createElement('div');
    tapDiv.className = 'sim-tap-indicator';
    document.body.appendChild(tapDiv);

    const captionDiv = document.createElement('div');
    captionDiv.className = 'sim-caption-container';
    document.body.appendChild(captionDiv);

    const panelDiv = document.createElement('div');
    panelDiv.id = 'sim_panel';
    panelDiv.innerHTML = `
        <button class="hidden-panel-btn" onclick="document.getElementById('sim_panel').style.display='none'">X</button>
        <div style="font-weight:bold; margin-bottom:5px; color:#55EFC4;">Sim: ${simId}</div>
        <div id="sim_timer" style="font-size:16px; margin-bottom:5px;">0.0s</div>
        <div id="sim_next" style="color:#aaa; min-height: 30px; margin-bottom: 5px;">Ready</div>
        <button id="sim_start">▶ Start</button>
        <button id="sim_pause">⏸ Pause</button>
        <button id="sim_reset">↺ Reset</button>
    `;
    document.body.appendChild(panelDiv);

    // --- SIMULATIONS CONFIGURATION ---
    const SIMULATIONS = {
        'blob-test': {
            setup: async () => {
                await setSetting('level_select', '2'); // Seventh Chords
                await setSetting('play_mode_menu', 'Single Chord');
                await setPreset('orchestra');
                await wait(500);
            },
            timeline: [
                { time: 3000, type: 'click', target: '#play_btn' },
                { time: 10000, type: 'preset', value: 'high_contrast' }, // "Clear Mix" internally
                { time: 11000, type: 'click', target: '#play_btn' },
                { time: 18000, type: 'click', target: '#solo_Bass' },
                { time: 20000, type: 'click', target: '#solo_Lead' },
                { time: 22000, type: 'click', target: '#solo_Lead' }, // De-solo Lead
                { time: 22200, type: 'click', target: '#solo_Bass' }, // De-solo Bass
                { time: 24000, type: 'click', target: '#play_btn' }
            ]
        },
        'solo-voices': {
            setup: async () => {
                await setSetting('level_select', '2');
                await setSetting('play_mode_menu', 'Single Chord');
                await setPreset('high_contrast');
                await wait(500);
            },
            timeline: [
                { time: 3000, type: 'click', target: '#play_btn' },
                { time: 7000, type: 'click', target: '#solo_Bass' },
                { time: 7100, type: 'caption', text: '🔵 Root — Double Bass' },
                { time: 10500, type: 'caption', text: null },
                { time: 11000, type: 'click', target: '#solo_2nd' }, // Might fail if 3-voice, handled safely
                { time: 11100, type: 'caption', text: '🟢 Second Voice' }, // General fallback name
                { time: 14500, type: 'caption', text: null },
                { time: 15000, type: 'click', target: '#solo_Lead' },
                { time: 15100, type: 'caption', text: '🟠 Lead — Flute' },
                { time: 18500, type: 'caption', text: null },
                { time: 19000, type: 'click', target: '#solo_Lead' }, // De-solo
                { time: 20000, type: 'click', target: '#play_btn' }
            ]
        },
        'no-timer': {
            setup: async () => {
                await setSetting('level_select', '1');
                await setSetting('play_mode_menu', 'Single Chord');
                await setPreset('high_contrast');
                await wait(500);
            },
            timeline: [
                { time: 12000, type: 'click', target: '#play_btn' },
                { time: 15000, type: 'click', target: '#play_btn' },
                { time: 18000, type: 'click', target: '#play_btn' },
                { time: 20000, type: 'click', target: '#reveal_btn' },
                { time: 21000, type: 'highlightCorrect' },
                { time: 25000, type: 'clickCorrect' },
                { time: 30000, type: 'click', target: '#next_popup_replay' },
                { time: 33000, type: 'click', target: '#next_popup_continue' }
            ]
        },
        'follow-voice': {
            setup: async () => {
                await setSetting('level_select', '2');
                await setSetting('play_mode_menu', 'Progression');
                await setPreset('high_contrast');
                await wait(500);
                console.log("[VideoSim] WARNING: Accepting randomly generated progression. Cannot force ii-V-I without hacking core app logic.");
            },
            timeline: [
                { time: 3000, type: 'click', target: '#play_btn' },
                { time: 10000, type: 'click', target: '#solo_2nd' }, // Wait for DOM element
                { time: 11000, type: 'click', target: '#play_btn' },
                { time: 15000, type: 'click', target: '#solo_2nd' }, // De-solo
                { time: 16000, type: 'click', target: '#solo_Lead' },
                { time: 17000, type: 'click', target: '#play_btn' },
                { time: 22000, type: 'click', target: '#solo_Lead' }, // De-solo
                { time: 23000, type: 'click', target: '#play_btn' },
                { time: 28000, type: 'click', target: '#play_btn' }
            ]
        },
        'three-presets': {
            setup: async () => {
                await setSetting('level_select', '2');
                await setSetting('play_mode_menu', 'Single Chord');
                await setPreset('high_contrast'); // Clear Mix
                await wait(500);
            },
            timeline: [
                { time: 3000, type: 'highlight', target: '[data-preset="high_contrast"]' },
                { time: 4000, type: 'click', target: '#play_btn' },
                { time: 4100, type: 'caption', text: '● ○ ○ Easy' },
                { time: 8000, type: 'caption', text: null },
                { time: 9000, type: 'preset', value: 'jazz_combo' },
                { time: 10000, type: 'click', target: '#play_btn' },
                { time: 10100, type: 'caption', text: '● ● ○ Medium' },
                { time: 14000, type: 'caption', text: null },
                { time: 15000, type: 'preset', value: 'orchestra' },
                { time: 16000, type: 'click', target: '#play_btn' },
                { time: 16100, type: 'caption', text: '● ● ● Hard' },
                { time: 20000, type: 'caption', text: null }
            ]
        },
        'full-demo': {
            setup: async () => {
                await setSetting('level_select', '1');
                await setSetting('play_mode_menu', 'Single Chord');
                await setPreset('high_contrast');
                await setSetting('session_size_menu', '3'); // Assuming standard value
                await wait(500);
            },
            timeline: [
                { time: 0, type: 'click', target: '#play_btn' },
                { time: 5000, type: 'clickCorrect' },
                { time: 8000, type: 'click', target: '#next_popup_continue' },
                { time: 12000, type: 'click', target: '#play_btn' },
                { time: 17000, type: 'clickCorrect' },
                { time: 20000, type: 'click', target: '#next_popup_continue' },
                { time: 24000, type: 'click', target: '#play_btn' },
                { time: 29000, type: 'clickCorrect' }
            ]
        }
    };

    // --- ENGINE LOGIC ---
    let simStartTime = 0;
    let simRaf = null;
    let currentActions = [];
    let isPlaying = false;

    document.getElementById('sim_start').onclick = startSimulation;
    document.getElementById('sim_pause').onclick = () => { isPlaying = false; };
    document.getElementById('sim_reset').onclick = () => window.location.reload();

    function wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    async function setSetting(id, val) {
        const d = document.getElementById(id);
        if (d && d.value !== val) {
            d.value = val;
            d.dispatchEvent(new Event('change'));
        }
    }

    async function setPreset(presetVal) {
        const btn = document.querySelector(`[data-preset="${presetVal}"]`);
        if (btn) simulateClick(btn);
    }

    function showVisualTap(x, y) {
        tapDiv.classList.remove('active');
        void tapDiv.offsetWidth; // reflow
        tapDiv.style.left = (x - 20) + 'px';
        tapDiv.style.top = (y - 20) + 'px';
        tapDiv.classList.add('active');
    }

    function simulateClick(selectorOrEl) {
        let el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
        
        // Handle solo buttons dynamically created
        if (!el && typeof selectorOrEl === 'string' && selectorOrEl.startsWith('#solo_')) {
            const title = selectorOrEl.split('_')[1]; // Bass, 2nd, 3rd, Lead
            const btns = Array.from(document.querySelectorAll('.solo-btn'));
            el = btns.find(b => b.textContent.includes(title));
        }

        if (!el) {
            console.warn(`[VideoSim] Target not found: ${selectorOrEl}`);
            return;
        }

        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        showVisualTap(x, y);

        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        el.click();
    }

    function getCorrectAnswerBtn() {
        if (!window.correctAnswerText) return null;
        const btns = Array.from(document.querySelectorAll('.answer-btn'));
        return btns.find(b => b.dataset.text === window.correctAnswerText);
    }

    async function startSimulation() {
        if (!SIMULATIONS[simId]) {
            alert(`Simulation ${simId} not found`);
            return;
        }

        console.log(`[VideoSim] Running pre-config...`);
        document.getElementById('sim_next').innerText = "Running setup...";

        // Auto-dismiss START TRAINING overlay if visible
        const startOverlay = document.getElementById('start_overlay');
        if (startOverlay && startOverlay.style.display !== 'none') {
            simulateClick(startOverlay); // The click listener is on the overlay itself
            await wait(1500); // Wait for AudioContext and first chord to load
        }
        
        // Close settings if open
        const gearBtn = document.getElementById('settings_toggle');
        const settingsGrid = document.getElementById('settings_collapsible');
        if (settingsGrid && !settingsGrid.classList.contains('hidden')) {
            if (gearBtn) gearBtn.click();
        }

        await SIMULATIONS[simId].setup();
        console.log(`[VideoSim] Setup complete. Engine armed.`);

        currentActions = [...SIMULATIONS[simId].timeline];
        currentActions.sort((a,b) => a.time - b.time);
        
        simStartTime = performance.now();
        isPlaying = true;
        tick();
    }

    function tick() {
        if (!isPlaying) return;
        
        const now = performance.now();
        const elapsed = now - simStartTime;
        document.getElementById('sim_timer').innerText = (elapsed / 1000).toFixed(1) + 's';

        if (currentActions.length > 0) {
            const next = currentActions[0];
            document.getElementById('sim_next').innerText = `Next: ${next.type} in ${((next.time - elapsed)/1000).toFixed(1)}s`;

            if (elapsed >= next.time) {
                executeAction(next);
                currentActions.shift();
            }
        } else {
            document.getElementById('sim_next').innerText = "DONE.";
            isPlaying = false;
        }

        simRaf = requestAnimationFrame(tick);
    }

    function executeAction(act) {
        console.log(`[VideoSim] Action @${act.time}ms:`, act);
        switch (act.type) {
            case 'click':
                simulateClick(act.target);
                break;
            case 'preset':
                setPreset(act.value);
                break;
            case 'caption':
                if (act.text) {
                    captionDiv.innerText = act.text;
                    captionDiv.classList.add('show');
                } else {
                    captionDiv.classList.remove('show');
                }
                break;
            case 'highlight':
                const el = document.querySelector(act.target);
                if (el) {
                    el.classList.add('sim-highlight');
                    setTimeout(() => el.classList.remove('sim-highlight'), 1000);
                }
                break;
            case 'highlightCorrect':
                const cBox = getCorrectAnswerBtn();
                if (cBox) {
                    cBox.classList.add('sim-highlight');
                    setTimeout(() => cBox.classList.remove('sim-highlight'), 1500);
                }
                break;
            case 'clickCorrect':
                const cBtn = getCorrectAnswerBtn();
                if (cBtn) simulateClick(cBtn);
                break;
        }
    }

})();
