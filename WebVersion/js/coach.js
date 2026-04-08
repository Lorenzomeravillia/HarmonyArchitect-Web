// Coach Marks — first-use contextual tooltips
(function () {
    const STORAGE_KEY = 'coachMarksShown_v2';
    const DURATION_MS = 3000; // visible time before auto-dismiss

    const MARKS = [
        {
            id: 'timbrePresets',
            target: '#voice_instruments_frame',
            text: "Different instruments for each voice help your brain separate the notes. Try 'High Contrast' for maximum separation.",
            pos: 'below'
        },

        {
            id: 'arpeggioBtn',
            target: '#arpeggio_btn',
            text: "Plays the notes one by one, bottom to top. Great for hearing each voice individually.",
            pos: 'above'
        },
        {
            id: 'revealBtn',
            target: '#reveal_btn',
            text: "Shows the correct answer without counting it as wrong. Use it to learn, not to cheat.",
            pos: 'above'
        },
        {
            id: 'soloFrame',
            target: '#solo_buttons_frame',
            text: "Isolate a single voice to hear it clearly. Tap again to un-solo.",
            pos: 'above'
        },
        {
            id: 'answerBtns',
            target: '.answers-frame',
            text: "Tap when you're ready. No timer, no pressure.",
            pos: 'left'
        },
        {
            id: 'voiceLeading',
            target: '#voice_leading_menu',
            text: "Drop-2 voicings spread the notes across a wider range — easier to hear each voice separately.",
            pos: 'below'
        },
        {
            id: 'tempo',
            target: '#tempo_menu',
            text: "Slower = more time to hear each voice. No shame in going slow.",
            pos: 'below'
        },
        {
            id: 'session',
            target: '#session_size_menu',
            text: "Short sessions work better for focus. Start with 5.",
            pos: 'below'
        },
        {
            id: 'playBtn',
            target: '#play_btn',
            text: "Tap to hear the chord. You can replay as many times as you want — no penalty.",
            pos: 'above'
        },
        {
            id: 'smartPractice',
            target: '#smart_practice_tour_anchor',
            text: "Smart Practice tracks your weak spots and automatically focuses the exercises on the chords you struggle with the most.",
            pos: 'below'
        }
    ];

    let queue = [];
    let currentTimeout = null;
    let dismissHandler = null;

    function getShown() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; }
    }
    function markShown(id) {
        const shown = getShown();
        shown[id] = true;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(shown)); } catch (e) {}
    }
    function getEl() { return document.getElementById('coach_mark'); }

    // ── Core positioning ──────────────────────────────────────────────────────────
    // rect = getBoundingClientRect() of the target → already in viewport coordinates.
    // el   = position:fixed → top/left are viewport coordinates, NO scrollY needed.
    function positionTooltip(el, rect, preferredPos) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const MARGIN  = 6;   // min gap from viewport edge
        const SPACING = 8;   // gap between target and tooltip box
        const ARROW_H = 9;   // arrow triangle height (matches CSS border)

        // Adaptive width: fit the screen, never overflow
        const TIP_W = Math.min(260, vw - MARGIN * 2);
        el.style.width = TIP_W + 'px';
        el.style.maxWidth = TIP_W + 'px';

        // Measure real tooltip height with current text
        el.style.visibility = 'hidden';
        el.classList.remove('hidden');
        el.style.opacity = '0';
        const tipH = el.offsetHeight || 80;
        el.style.visibility = '';

        // Horizontal: center tooltip over target, clamp to viewport
        const targetCX = rect.left + rect.width / 2;
        let left = targetCX - TIP_W / 2;
        left = Math.max(MARGIN, Math.min(left, vw - TIP_W - MARGIN));
        el.style.left = left + 'px';

        // Decide above vs below based on available space
        const spaceAbove = rect.top - MARGIN;
        const spaceBelow = vh - rect.bottom - MARGIN;
        const needsV = tipH + SPACING + ARROW_H;

        let useAbove;
        if (preferredPos === 'above') {
            // prefer above, fall back to below only if truly no room
            useAbove = spaceAbove >= needsV || spaceAbove >= spaceBelow;
        } else {
            // prefer below, fall back to above if no room
            useAbove = spaceBelow < needsV && spaceAbove >= spaceBelow;
        }

        // Vertical placement (position:fixed → pure viewport coords, no scrollY)
        const arrowEl = el.querySelector('.coach-arrow');
        if (useAbove) {
            let top = rect.top - needsV;
            top = Math.max(MARGIN, top);
            el.style.top    = top + 'px';
            el.style.bottom = '';
            if (arrowEl) arrowEl.className = 'coach-arrow coach-arrow-down';
        } else {
            let top = rect.bottom + SPACING + ARROW_H;
            // Push up if tooltip would overflow bottom
            if (top + tipH > vh - MARGIN) top = Math.max(MARGIN, vh - MARGIN - tipH);
            el.style.top    = top + 'px';
            el.style.bottom = '';
            if (arrowEl) arrowEl.className = 'coach-arrow coach-arrow-up';
        }

        // Arrow: point at horizontal center of the target element
        // arrow has no real width (0×0 box), so left = pixel offset from tooltip left edge
        if (arrowEl) {
            const arrowPx = Math.round(targetCX - left);
            arrowEl.style.left      = Math.max(14, Math.min(arrowPx, TIP_W - 14)) + 'px';
            arrowEl.style.transform = 'none'; // override CSS translateX(-50%)
        }
    }

    // ── Show / hide ───────────────────────────────────────────────────────────────
    function hideCoachMark(cb) {
        const el = getEl();
        if (!el) return cb && cb();
        if (currentTimeout)  { clearTimeout(currentTimeout); currentTimeout = null; }
        if (dismissHandler)  {
            document.removeEventListener('click',      dismissHandler, true);
            document.removeEventListener('touchstart', dismissHandler, true);
            dismissHandler = null;
        }
        el.style.opacity = '0';
        setTimeout(() => { el.classList.add('hidden'); cb && cb(); }, 320);
    }

    function showCoachMark(mark, onDone) {
        const el     = getEl();
        const target = document.querySelector(mark.target);
        if (!el || !target) { onDone && onDone(); return; }

        const rect = target.getBoundingClientRect();
        // Skip if element has no size (hidden / collapsed panel)
        if (rect.width === 0 || rect.height === 0) { onDone && onDone(); return; }

        const textEl = el.querySelector('.coach-text');
        if (textEl) textEl.textContent = mark.text;

        // Position before revealing (prevents flash of wrong position)
        positionTooltip(el, rect, mark.pos);

        // Fade in
        el.style.opacity = '0';
        requestAnimationFrame(() => {
            el.style.transition = 'opacity 0.25s';
            el.style.opacity    = '1';
        });

        markShown(mark.id);

        function done() {
            hideCoachMark(() => setTimeout(() => onDone && onDone(), 200));
        }

        currentTimeout = setTimeout(done, DURATION_MS);

        // Dismiss on any tap/click outside the tooltip itself
        dismissHandler = function (e) {
            if (el.contains(e.target)) return;
            done();
        };
        setTimeout(() => {
            document.addEventListener('click',      dismissHandler, true);
            document.addEventListener('touchstart', dismissHandler, { capture: true, passive: true });
        }, 150);
    }

    // ── Queue ─────────────────────────────────────────────────────────────────────
    function runQueue() {
        if (queue.length === 0) return;
        showCoachMark(queue.shift(), runQueue);
    }

    function startTour(resetAll) {
        // Forza l'apertura del pannello impostazioni per garantire che gli elementi abbiano dimensioni valide
        const settingsPanel = document.getElementById('settings_collapsible');
        if (settingsPanel && !settingsPanel.classList.contains('open')) {
            settingsPanel.classList.add('open');
        }

        hideCoachMark(() => {
            const shown = resetAll ? {} : getShown();
            queue = MARKS.filter(m => {
                if (shown[m.id]) return false;
                const t = document.querySelector(m.target);
                if (!t) return false;
                // Skip elements with no visible size (e.g. settings panel closed)
                const r = t.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            });
            if (queue.length > 0) setTimeout(runQueue, 400);
        });
    }

    // Avvio manuale post-splash screen
    window._coachAutoStart = function() {
        const shown  = getShown();
        const anyNew = MARKS.some(m => !shown[m.id]);
        if (anyNew) setTimeout(() => startTour(false), 500);
    };

    // ? button: reset and replay all
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('coach_btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                try { localStorage.removeItem(STORAGE_KEY); } catch (e2) {}
                startTour(true);
            });
        }
    });

    window._coachStartTour = startTour;
})();
