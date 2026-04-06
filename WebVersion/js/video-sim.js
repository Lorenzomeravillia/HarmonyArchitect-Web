/**
 * ClearVoicing Video Simulation Engine
 * Injected when ?sim=VIDEO_ID is present in the URL.
 */

(function () {
    const simId = new URLSearchParams(window.location.search).get('sim');
    if (!simId) return;

    console.log(`[VideoSim] Initializing simulation: ${simId}`);

    // --- URL PARAMS ---
    const params = new URLSearchParams(window.location.search);
    const delayParam = params.get('delay') ? parseInt(params.get('delay')) * 1000 : 5000;
    const captionsOff = params.get('captions') === 'off';

    // --- OVERLAY CSS ---
    const simCss = `
        .sim-tap-indicator {
            position: fixed; width: 40px; height: 40px; border-radius: 50%;
            background: rgba(255, 255, 255, 0.4); transform: scale(0);
            pointer-events: none; z-index: 999999;
        }
        .sim-tap-indicator.active { animation: sim-tap 400ms ease-out forwards; }
        @keyframes sim-tap {
            0% { transform: scale(0.5); opacity: 0.8; }
            100% { transform: scale(2.5); opacity: 0; }
        }

        .sim-caption-container {
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7); color: #fff; padding: 12px 24px;
            border-radius: 12px; font-size: 24px; font-weight: 700; text-align: center;
            z-index: 100000; opacity: 0; transition: opacity 0.3s ease;
            pointer-events: none; backdrop-filter: blur(4px); box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            min-width: 250px;
        }
        .sim-caption-container.show { opacity: 1; }

        .sim-countdown-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(10, 17, 40, 0.95); z-index: 200000;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: #55EFC4; font-family: monospace; transition: opacity 0.5s;
        }
        .sim-countdown-text { font-size: 60px; font-weight: bold; margin-bottom: 20px; }
        .sim-countdown-sub { font-size: 20px; color: #fff; opacity: 0.7; }

        .sim-flash {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            border: 8px solid #55EFC4; pointer-events: none; z-index: 199999;
            opacity: 0; transition: opacity 0.1s;
        }
        .sim-done-text {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            font-size: 40px; font-weight: bold; color: #55EFC4; background: rgba(0,0,0,0.8);
            padding: 20px 40px; border-radius: 16px; z-index: 199999; opacity: 0;
            pointer-events: none; transition: opacity 0.3s;
        }

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
    if (!captionsOff) document.body.appendChild(captionDiv);

    const countdownOverlay = document.createElement('div');
    countdownOverlay.className = 'sim-countdown-overlay';
    countdownOverlay.innerHTML = `
        <div class="sim-countdown-sub">Sim: ${simId}</div>
        <div class="sim-countdown-text">Tap to Ready</div>
        <div class="sim-countdown-sub">Start screen recording after tap</div>
    `;
    document.body.appendChild(countdownOverlay);

    const flashDiv = document.createElement('div');
    flashDiv.className = 'sim-flash';
    document.body.appendChild(flashDiv);

    const doneText = document.createElement('div');
    doneText.className = 'sim-done-text';
    doneText.innerText = '✓ Done';
    document.body.appendChild(doneText);

    // --- ENGINE LOGIC ---
    let simStartTime = 0;
    let currentActions = [];
    let isPlaying = false;
    let isFinished = false;

    // Countdown & Start Logic
    let countdownActive = false;
    countdownOverlay.addEventListener('click', () => {
        if (countdownActive) return;
        countdownActive = true;
        
        // Unlock AudioContext safely
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext && (!window.audioEngine || !window.audioEngine.ctx)) {
             try { window.audioEngine.unlockAndLoad(); } catch(e){}
        } else if (window.audioEngine && window.audioEngine.ctx) {
             window.audioEngine.ctx.resume();
        }

        let left = delayParam / 1000;
        const textEl = countdownOverlay.querySelector('.sim-countdown-text');
        textEl.innerText = `Starting in ${left}...`;
        
        const intv = setInterval(() => {
            left--;
            if (left > 0) {
                textEl.innerText = `Starting in ${left}...`;
            } else {
                clearInterval(intv);
                countdownOverlay.style.opacity = '0';
                setTimeout(() => {
                    countdownOverlay.style.display = 'none';
                    startSimulation();
                }, 500);
            }
        }, 1000);
    });

    // Multi-tap gesture logic
    let tapCount = 0;
    let tapTimer = null;
    document.addEventListener('click', (e) => {
        // Ignore taps on the countdown overlay itself
        if (e.target.closest('.sim-countdown-overlay')) return;
        if (isFinished) return;

        tapCount++;
        clearTimeout(tapTimer);
        
        tapTimer = setTimeout(() => {
            if (tapCount === 2) {
                // Pause / Resume
                isPlaying = !isPlaying;
                console.log(isPlaying ? '[VideoSim] Resumed' : '[VideoSim] Paused');
            } else if (tapCount >= 3) {
                // Reset
                console.log('[VideoSim] Resetting via gesture...');
                window.location.reload();
            }
            tapCount = 0;
        }, 350); // 350ms window for taps
    }, true);

    function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

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
        void tapDiv.offsetWidth; 
        tapDiv.style.left = (x - 20) + 'px';
        tapDiv.style.top = (y - 20) + 'px';
        tapDiv.classList.add('active');
    }

    function simulateClick(selectorOrEl) {
        let el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
        
        if (!el && typeof selectorOrEl === 'string' && selectorOrEl.startsWith('#solo_')) {
            const title = selectorOrEl.split('_')[1];
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
        if (!SIMULATIONS[simId]) { alert(`Simulation ${simId} not found`); return; }

        console.log(`[VideoSim] Running setup...`);
        
        const startOverlay = document.getElementById('start_overlay');
        if (startOverlay && startOverlay.style.display !== 'none') {
            simulateClick(startOverlay); 
            await wait(1500);
        }
        
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

    function finishSimulation() {
        isFinished = true;
        isPlaying = false;
        
        // Visual indicator for post-production cut
        flashDiv.style.opacity = '1';
        doneText.style.opacity = '1';
        
        setTimeout(() => { flashDiv.style.opacity = '0'; }, 100);
        setTimeout(() => { doneText.style.opacity = '0'; }, 2000);
        
        console.log("[VideoSim] Finished.");
    }

    function tick() {
        if (!isPlaying || isFinished) return;
        
        const elapsed = performance.now() - simStartTime;

        if (currentActions.length > 0) {
            const next = currentActions[0];
            if (elapsed >= next.time) {
                executeAction(next);
                currentActions.shift();
            }
        } else {
            finishSimulation();
            return;
        }

        requestAnimationFrame(tick);
    }

    function executeAction(act) {
        console.log(`[VideoSim] Action @${act.time}ms:`, act);
        switch (act.type) {
            case 'click': simulateClick(act.target); break;
            case 'preset': setPreset(act.value); break;
            case 'caption':
                if (act.text && !captionsOff) {
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
