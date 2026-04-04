// Coach Marks — first-use contextual tooltips
(function () {
    const STORAGE_KEY = 'coachMarksShown_v1';

    const MARKS = [
        {
            id: 'timbrePresets',
            target: '#voice_instruments_frame',
            text: "Different instruments for each voice help your brain separate the notes. Try 'High Contrast' for maximum separation.",
            pos: 'below'
        },
        {
            id: 'playBtn',
            target: '#play_btn',
            text: "Tap to hear the chord. You can replay as many times as you want — no penalty.",
            pos: 'above'
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

    function hideCoachMark(cb) {
        const el = getEl();
        if (!el) return cb && cb();
        if (currentTimeout) { clearTimeout(currentTimeout); currentTimeout = null; }
        if (dismissHandler) {
            document.removeEventListener('click', dismissHandler, true);
            dismissHandler = null;
        }
        el.style.opacity = '0';
        setTimeout(() => { el.classList.add('hidden'); cb && cb(); }, 320);
    }

    function showCoachMark(mark, onDone) {
        const el = getEl();
        const target = document.querySelector(mark.target);
        if (!el || !target) { onDone && onDone(); return; }

        // Skip if target not visible
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) { onDone && onDone(); return; }

        const textEl = el.querySelector('.coach-text');
        if (textEl) textEl.textContent = mark.text;

        el.classList.remove('hidden');
        el.style.opacity = '0';

        // Positioning
        const TIP_W = 280;
        let left = rect.left + rect.width / 2 - TIP_W / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - TIP_W - 8));
        el.style.width = TIP_W + 'px';
        el.style.left = left + 'px';

        const arrowEl = el.querySelector('.coach-arrow');

        // Prefer requested position, fallback if too close to viewport edge
        const preferAbove = mark.pos === 'above' || rect.top > window.innerHeight * 0.55;
        if (preferAbove && rect.top > 80) {
            el.style.top = '';
            el.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
            if (arrowEl) arrowEl.className = 'coach-arrow coach-arrow-down';
        } else {
            el.style.bottom = '';
            el.style.top = (rect.bottom + window.scrollY + 10) + 'px';
            if (arrowEl) arrowEl.className = 'coach-arrow coach-arrow-up';
        }

        // Fade in
        requestAnimationFrame(() => {
            el.style.transition = 'opacity 0.3s';
            el.style.opacity = '1';
        });

        markShown(mark.id);

        function done() {
            hideCoachMark(() => setTimeout(() => onDone && onDone(), 200));
        }

        currentTimeout = setTimeout(done, 5000);

        dismissHandler = function (e) {
            // Don't dismiss if clicking on the coach mark itself
            if (el.contains(e.target)) return;
            done();
        };
        setTimeout(() => {
            document.addEventListener('click', dismissHandler, true);
        }, 150);
    }

    function runQueue() {
        if (queue.length === 0) return;
        const mark = queue.shift();
        showCoachMark(mark, runQueue);
    }

    function startTour(resetAll) {
        hideCoachMark(() => {
            const shown = resetAll ? {} : getShown();
            queue = MARKS.filter(m => {
                if (shown[m.id]) return false;
                const t = document.querySelector(m.target);
                // Show if element exists in DOM (even if slightly off-screen)
                return !!t;
            });
            if (queue.length > 0) setTimeout(runQueue, 400);
        });
    }

    // Auto-start on first load (after a short delay so layout settles)
    window.addEventListener('load', () => {
        const shown = getShown();
        const anyNew = MARKS.some(m => !shown[m.id]);
        if (anyNew) setTimeout(() => startTour(false), 2000);
    });

    // ? button resets and restarts tour
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
