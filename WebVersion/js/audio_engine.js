class AudioEngine {
    constructor() {
        this._unlocked  = false;
        this.ready      = false;   // true once a context is running AND samples can play
        this.lastAudioError = null;
        this._log = []; // timestamped event ring-buffer for on-device debugging

        // Tone.js vars
        this.samplers = {};
        this.reverb = null;

        // Fallback vars (WebAudioFont)
        this.useFallback = false;
        this.fallbackCtx = null;
        this.masterBus = null;
        this.player = typeof WebAudioFontPlayer !== 'undefined' ? new WebAudioFontPlayer() : null;

        // Map UI names to tonejs-instruments names
        this.instrumentPrograms = {
            "Contrabbasso": "contrabass",
            "Violoncello":  "cello",
            "Fagotto":      "bassoon",
            "Corno":        "french-horn",
            "Viola":        "violin", // Fallback
            "Clarinetto":   "clarinet",
            "Flauto":       "flute",
            "Piano":        "piano",
            "Chitarra":     "guitar-nylon", 
            "Violino":      "violin",
            "Tromba":       "trumpet",
            "Sassofono":    "saxophone",
            "Organo":       "organ",
            "Arpa":         "harp"
        };
        
        // Map UI names to WebAudioFont GM programs (Fallback)
        this.fallbackPrograms = {
            "contrabass": 43, "cello": 42, "bassoon": 70, "french-horn": 60, "viola": 41, 
            "clarinet": 71, "flute": 73, "piano": 0, "guitar-nylon": 24, "violin": 40, 
            "trumpet": 56, "saxophone": 65, "organ": 19, "harp": 46, "bass-electric": 33
        };

        // Native Tonejs map for our specific requested instruments to avoid 404s
        this.INSTRUMENT_MAPS = {
            'bass-electric': { 'A#1': 'As1.mp3', 'A#2': 'As2.mp3', 'A#3': 'As3.mp3', 'A#4': 'As4.mp3', 'C#1': 'Cs1.mp3', 'C#2': 'Cs2.mp3', 'C#3': 'Cs3.mp3', 'C#4': 'Cs4.mp3', 'E1': 'E1.mp3', 'E2': 'E2.mp3', 'E3': 'E3.mp3', 'E4': 'E4.mp3', 'G1': 'G1.mp3', 'G2': 'G2.mp3', 'G3': 'G3.mp3', 'G4': 'G4.mp3' },
            'bassoon': { 'A4': 'A4.mp3', 'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'E4': 'E4.mp3', 'G2': 'G2.mp3', 'G3': 'G3.mp3', 'G4': 'G4.mp3', 'A2': 'A2.mp3', 'A3': 'A3.mp3' },
            'cello': { 'E3': 'E3.mp3', 'E4': 'E4.mp3', 'F2': 'F2.mp3', 'F3': 'F3.mp3', 'F4': 'F4.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3', 'G2': 'G2.mp3', 'G3': 'G3.mp3', 'G4': 'G4.mp3', 'G#2': 'Gs2.mp3', 'G#3': 'Gs3.mp3', 'G#4': 'Gs4.mp3', 'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3', 'A#2': 'As2.mp3', 'A#3': 'As3.mp3', 'B2': 'B2.mp3', 'B3': 'B3.mp3', 'B4': 'B4.mp3', 'C2': 'C2.mp3', 'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C#3': 'Cs3.mp3', 'C#4': 'Cs4.mp3', 'D2': 'D2.mp3', 'D3': 'D3.mp3', 'D4': 'D4.mp3', 'D#2': 'Ds2.mp3', 'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3', 'E2': 'E2.mp3' },
            'clarinet': { 'D4': 'D4.mp3', 'D5': 'D5.mp3', 'D6': 'D6.mp3', 'F3': 'F3.mp3', 'F4': 'F4.mp3', 'F5': 'F5.mp3', 'F#6': 'Fs6.mp3', 'A#3': 'As3.mp3', 'A#4': 'As4.mp3', 'A#5': 'As5.mp3', 'D3': 'D3.mp3' },
            'flute': { 'A6': 'A6.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3', 'C7': 'C7.mp3', 'E4': 'E4.mp3', 'E5': 'E5.mp3', 'E6': 'E6.mp3', 'A4': 'A4.mp3', 'A5': 'A5.mp3' },
            'french-horn': { 'D3': 'D3.mp3', 'D5': 'D5.mp3', 'D#2': 'Ds2.mp3', 'F3': 'F3.mp3', 'F5': 'F5.mp3', 'G2': 'G2.mp3', 'A1': 'A1.mp3', 'A3': 'A3.mp3', 'C2': 'C2.mp3', 'C4': 'C4.mp3' },
            'piano': { 'A7': 'A7.mp3', 'A1': 'A1.mp3', 'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3', 'A5': 'A5.mp3', 'A6': 'A6.mp3', 'A#7': 'As7.mp3', 'A#1': 'As1.mp3', 'A#2': 'As2.mp3', 'A#3': 'As3.mp3', 'A#4': 'As4.mp3', 'A#5': 'As5.mp3', 'A#6': 'As6.mp3', 'B7': 'B7.mp3', 'B1': 'B1.mp3', 'B2': 'B2.mp3', 'B3': 'B3.mp3', 'B4': 'B4.mp3', 'B5': 'B5.mp3', 'B6': 'B6.mp3', 'C7': 'C7.mp3', 'C1': 'C1.mp3', 'C2': 'C2.mp3', 'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3', 'C#7': 'Cs7.mp3', 'C#1': 'Cs1.mp3', 'C#2': 'Cs2.mp3', 'C#3': 'Cs3.mp3', 'C#4': 'Cs4.mp3', 'C#5': 'Cs5.mp3', 'C#6': 'Cs6.mp3', 'D7': 'D7.mp3', 'D1': 'D1.mp3', 'D2': 'D2.mp3', 'D3': 'D3.mp3', 'D4': 'D4.mp3', 'D5': 'D5.mp3', 'D6': 'D6.mp3', 'D#7': 'Ds7.mp3', 'D#1': 'Ds1.mp3', 'D#2': 'Ds2.mp3', 'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3', 'D#5': 'Ds5.mp3', 'D#6': 'Ds6.mp3', 'E7': 'E7.mp3', 'E1': 'E1.mp3', 'E2': 'E2.mp3', 'E3': 'E3.mp3', 'E4': 'E4.mp3', 'E5': 'E5.mp3', 'E6': 'E6.mp3', 'F7': 'F7.mp3', 'F1': 'F1.mp3', 'F2': 'F2.mp3', 'F3': 'F3.mp3', 'F4': 'F4.mp3', 'F5': 'F5.mp3', 'F6': 'F6.mp3', 'F#7': 'Fs7.mp3', 'F#1': 'Fs1.mp3', 'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3', 'F#5': 'Fs5.mp3', 'F#6': 'Fs6.mp3', 'G7': 'G7.mp3', 'G1': 'G1.mp3', 'G2': 'G2.mp3', 'G3': 'G3.mp3', 'G4': 'G4.mp3', 'G5': 'G5.mp3', 'G6': 'G6.mp3', 'G#7': 'Gs7.mp3', 'G#1': 'Gs1.mp3', 'G#2': 'Gs2.mp3', 'G#3': 'Gs3.mp3', 'G#4': 'Gs4.mp3', 'G#5': 'Gs5.mp3', 'G#6': 'Gs6.mp3' },
            'trumpet': { 'C6': 'C6.mp3', 'D5': 'D5.mp3', 'D#4': 'Ds4.mp3', 'F3': 'F3.mp3', 'F4': 'F4.mp3', 'F5': 'F5.mp3', 'G4': 'G4.mp3', 'A3': 'A3.mp3', 'A5': 'A5.mp3', 'A#4': 'As4.mp3', 'C4': 'C4.mp3' },
            'harp': { 'C5': 'C5.mp3', 'D2': 'D2.mp3', 'D4': 'D4.mp3', 'D6': 'D6.mp3', 'D7': 'D7.mp3', 'E1': 'E1.mp3', 'E3': 'E3.mp3', 'E5': 'E5.mp3', 'F2': 'F2.mp3', 'F4': 'F4.mp3', 'F6': 'F6.mp3', 'F7': 'F7.mp3', 'G1': 'G1.mp3', 'G3': 'G3.mp3', 'G5': 'G5.mp3', 'A2': 'A2.mp3', 'A4': 'A4.mp3', 'A6': 'A6.mp3', 'B1': 'B1.mp3', 'B3': 'B3.mp3', 'B5': 'B5.mp3', 'B6': 'B6.mp3', 'C3': 'C3.mp3' },
            'organ': { 'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3', 'D#1': 'Ds1.mp3', 'D#2': 'Ds2.mp3', 'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3', 'D#5': 'Ds5.mp3', 'F#1': 'Fs1.mp3', 'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3', 'F#5': 'Fs5.mp3', 'A1': 'A1.mp3', 'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3', 'A5': 'A5.mp3', 'C1': 'C1.mp3', 'C2': 'C2.mp3' },
            'contrabass': { 'C2': 'C2.mp3', 'C#3': 'Cs3.mp3', 'D2': 'D2.mp3', 'E2': 'E2.mp3', 'E3': 'E3.mp3', 'F#1': 'Fs1.mp3', 'F#2': 'Fs2.mp3', 'G1': 'G1.mp3', 'G#2': 'Gs2.mp3', 'G#3': 'Gs3.mp3', 'A2': 'A2.mp3', 'A#1': 'As1.mp3', 'B3': 'B3.mp3' },
            'saxophone': { 'D#5': 'Ds5.mp3', 'E3': 'E3.mp3', 'E4': 'E4.mp3', 'E5': 'E5.mp3', 'F3': 'F3.mp3', 'F4': 'F4.mp3', 'F5': 'F5.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3', 'F#5': 'Fs5.mp3', 'G3': 'G3.mp3', 'G4': 'G4.mp3', 'G5': 'G5.mp3', 'G#3': 'Gs3.mp3', 'G#4': 'Gs4.mp3', 'G#5': 'Gs5.mp3', 'A4': 'A4.mp3', 'A5': 'A5.mp3', 'A#3': 'As3.mp3', 'A#4': 'As4.mp3', 'B3': 'B3.mp3', 'B4': 'B4.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C#3': 'Cs3.mp3', 'C#4': 'Cs4.mp3', 'C#5': 'Cs5.mp3', 'D3': 'D3.mp3', 'D4': 'D4.mp3', 'D5': 'D5.mp3', 'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3' },
            'guitar-nylon': { 'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3', 'F#5': 'Fs5.mp3', 'G3': 'G3.mp3', 'G5': 'G3.mp3', 'G#2': 'Gs2.mp3', 'G#4': 'Gs4.mp3', 'G#5': 'Gs5.mp3', 'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3', 'A5': 'A5.mp3', 'A#5': 'As5.mp3', 'B1': 'B1.mp3', 'B2': 'B2.mp3', 'B3': 'B3.mp3', 'B4': 'B4.mp3', 'C#3': 'Cs3.mp3', 'C#4': 'Cs4.mp3', 'C#5': 'Cs5.mp3', 'D2': 'D2.mp3', 'D3': 'D3.mp3', 'D5': 'D5.mp3', 'D#4': 'Ds4.mp3', 'E2': 'E2.mp3', 'E3': 'E3.mp3', 'E4': 'E4.mp3', 'E5': 'E5.mp3' },
            'violin': { 'A3': 'A3.mp3', 'A4': 'A4.mp3', 'A5': 'A5.mp3', 'A6': 'A6.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3', 'C7': 'C7.mp3', 'E4': 'E4.mp3', 'E5': 'E5.mp3', 'E6': 'E6.mp3', 'G4': 'G4.mp3', 'G5': 'G5.mp3', 'G6': 'G6.mp3' }
        };

        // 7 voice channels mapped to instrument names. Default matches 'Clear Mix'
        // below; applyPreset() overwrites this as soon as a preset is selected.
        this.channels = ["contrabass", "bassoon", "french-horn", "clarinet", "saxophone", "trumpet", "flute"];

        // Per-voice volume balance
        this.voiceBalance = [1.0, 0.80, 0.76, 0.74, 0.76, 0.80, 0.90];

        // Per-instrument gain correction, applied on top of voiceBalance regardless
        // of which channel slot the instrument lands in. Plucked/percussive
        // instruments (short attack, fast decay) read as much quieter than
        // sustained instruments at equal velocity once the sustained voices are
        // still ringing — boosted here so they don't disappear in the mix.
        this.instrumentBoost = { harp: 1.7, piano: 1.35, 'guitar-nylon': 1.4, 'bass-electric': 1.2 };

        // Presets [Bass, V2, V3, V4, V5, V6, Top]
        this.PRESETS = {
            'Orchestra':    ["contrabass", "cello", "bassoon", "french-horn", "violin", "clarinet", "flute"],
            'Jazz Combo':   ["contrabass", "cello", "saxophone", "french-horn", "clarinet", "trumpet", "piano"],
            // Clear Mix is the timbral-separation showcase preset, so it's reserved
            // for sustained instruments only (winds + contrabass as a synth stand-in).
            // Plucked/percussive instruments (piano, harp, bass-electric) decay too
            // fast and disappear against the others while they're still ringing —
            // a real mixing concern we keep elsewhere, but avoid here on purpose.
            'Clear Mix':    ["contrabass", "bassoon", "french-horn", "clarinet", "saxophone", "trumpet", "flute"],
        };

        this._bindLifecycleEvents();
    }

    // Timestamped event log, visible in the on-screen trouble banner so the exact
    // sequence of what happened can be reported without needing devtools on iOS.
    logEvent(msg) {
        const t = new Date();
        const stamp = String(t.getMinutes()).padStart(2, '0') + ':' + String(t.getSeconds()).padStart(2, '0') + '.' + String(t.getMilliseconds()).padStart(3, '0');
        this._log.push(stamp + ' ' + msg);
        if (this._log.length > 50) this._log.shift();
        console.log('[AudioEngine] ' + msg);
    }

    getDebugLog() {
        return this._log.join('\n');
    }

    // Runs an async op (e.g. Tone.start()/context.resume()) but never waits
    // longer than `ms` for it — iOS can leave these promises permanently
    // unsettled, and without a cap that hangs the entire unlock sequence with
    // no error to show. We don't care which one "wins"; the caller always
    // re-checks Tone.context.state afterwards regardless of which path fired.
    _raceTimeout(promiseFactory, ms, label) {
        let settled = false;
        const guarded = (async () => {
            try {
                await promiseFactory();
                settled = true;
                this.logEvent(label + ' resolved, state=' + (window.Tone ? Tone.context.state : 'n/a'));
            } catch (e) {
                settled = true;
                this.logEvent(label + ' THREW: ' + e.message);
            }
        })();
        return Promise.race([
            guarded,
            new Promise(r => setTimeout(() => {
                if (!settled) this.logEvent(label + ' did not settle within ' + ms + 'ms — proceeding anyway');
                r();
            }, ms))
        ]);
    }

    // playMidi/playChord used to fire a bare, unawaited Tone.context.resume()
    // before triggering a note. That's a no-op in practice: iOS can drop the
    // context back to 'suspended' between notes (after idle periods, screen
    // events, etc.), and nothing was actually waiting to confirm the resume
    // worked before the sampler tried to play — so the note triggered into a
    // dead context and produced no sound, even though everything reported
    // ready=true/loaded. This awaits a short guarded resume and, if the
    // context is still stuck, kicks a single background rebuild rather than
    // one per note.
    async _ensureContextRunning(label) {
        if (Tone.context.state === 'running') return true;
        // resume() throws on a closed context; only attempt it when suspended.
        if (Tone.context.state !== 'closed') {
            await this._raceTimeout(() => Tone.context.resume(), 500, label + ' resume()');
            if (Tone.context.state === 'running') return true;
        }
        if (!this._rebuildingPlayback && !this._rebuildPromise) {
            this._rebuildingPlayback = true;
            this.logEvent(label + ': context still stuck during playback — rebuilding');
            this._rebuildContext().finally(() => { this._rebuildingPlayback = false; });
        }
        return false;
    }

    // Combined per-channel gain: positional balance × per-instrument correction.
    _channelGain(channelIdx) {
        const balance = this.voiceBalance[channelIdx] ?? 1.0;
        const inst = this.channels[channelIdx];
        const boost = this.instrumentBoost[inst] ?? 1.0;
        return balance * boost;
    }

    // ── LIFECYCLE: keep audio alive across backgrounding ──────────────────
    // iOS suspends (and sometimes permanently wedges) the AudioContext when the
    // app is backgrounded. A plain resume() call often silently no-ops once the
    // context is wedged, which is what previously made it look like only a full
    // device restart could fix things. Here we resume on return-to-foreground,
    // and if the context is still not running shortly after, we rebuild it from
    // scratch — the same effect a restart had, but done in JS automatically.
    _bindLifecycleEvents() {
        if (this._lifecycleBound) return;
        this._lifecycleBound = true;

        const tryResume = async (source) => {
            this.logEvent('lifecycle event: ' + source + ', unlocked=' + this._unlocked);
            if (!this._unlocked) return;

            // iOS fires visibilitychange + pageshow + focus together on
            // foreground; without this guard each one runs its own resume/
            // rebuild and they trample each other.
            if (this._resuming || this._rebuildPromise) {
                this.logEvent('tryResume: another resume/rebuild already running — skipping ' + source);
                return;
            }
            this._resuming = true;
            try {
            if (this.useFallback) {
                if (this.fallbackCtx && this.fallbackCtx.state !== 'running') {
                    try { await this.fallbackCtx.resume(); } catch (e) {}
                    await new Promise(r => setTimeout(r, 300));
                    if (this.fallbackCtx.state !== 'running') {
                        this.logEvent('fallback context stuck — rebuilding');
                        this._setupFallbackContext();
                    }
                }
                return;
            }

            if (!window.Tone) return;
            this.logEvent('tryResume: state before resume=' + Tone.context.state);
            // A closed context can never be resumed — resume() just throws
            // 'Context is closed'. Skip straight to a rebuild.
            if (Tone.context.state === 'closed') {
                this.logEvent('tryResume: context closed — rebuilding');
                await this._rebuildContext();
                return;
            }
            if (Tone.context.state !== 'running') {
                await this._raceTimeout(() => Tone.context.resume(), 1000, 'tryResume resume()');
            }
            let waited = 0;
            while (Tone.context.state !== 'running' && waited < 1000) {
                await new Promise(r => setTimeout(r, 100));
                waited += 100;
            }
            this.logEvent('tryResume: state after ' + waited + 'ms=' + Tone.context.state);
            if (Tone.context.state !== 'running') {
                this.logEvent('context stuck after resume attempt — rebuilding');
                await this._rebuildContext();
            } else {
                this.ready = Object.values(this.samplers).some(s => s && s.loaded);
            }
            } finally {
                this._resuming = false;
            }
        };

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') tryResume('visibilitychange');
        });
        window.addEventListener('pageshow', () => tryResume('pageshow'));
        window.addEventListener('focus', () => tryResume('focus'));
    }

    // Tears down and recreates the Tone.js AudioContext + reverb chain, then
    // reloads the current channel's samplers. Used when resume() can't bring
    // a backgrounded context back to 'running'.
    //
    // Rebuilds MUST be serialized. iOS foregrounding fires visibilitychange,
    // pageshow and focus almost simultaneously, and playback can trigger a
    // rebuild too — so several _rebuildContext() calls used to run at once,
    // each creating a new context and then closing what it thought was the
    // "old" one. Under concurrency that "old" context is actually the live
    // context a sibling rebuild just created, so they closed each other's
    // contexts and left the page permanently 'closed'. This guard makes any
    // overlapping call await the in-flight rebuild instead of competing.
    async _rebuildContext() {
        if (!window.Tone) return;
        if (this._rebuildPromise) {
            this.logEvent('_rebuildContext: already running — awaiting in-flight rebuild');
            return this._rebuildPromise;
        }
        this._rebuildPromise = this._rebuildContextInner();
        try {
            await this._rebuildPromise;
        } finally {
            this._rebuildPromise = null;
        }
    }

    async _rebuildContextInner() {
        this.logEvent('_rebuildContext: start');
        try {
            // iOS WebKit caps the number of AudioContexts that can be alive at
            // once (historically as few as ~4-6 per page). Leaving old contexts
            // open across rebuilds eventually exhausts that cap, after which
            // EVERY new context stays stuck 'suspended' forever. Close the
            // now-orphaned previous context — safe because rebuilds are
            // serialized, so nothing else is still using it.
            const oldCtx = Tone.context.rawContext || Tone.context._context;
            const newCtx = new (window.AudioContext || window.webkitAudioContext)();
            Tone.setContext(newCtx);
            const newRaw = newCtx.rawContext || newCtx;
            if (oldCtx && oldCtx !== newCtx && oldCtx !== newRaw &&
                typeof oldCtx.close === 'function' && oldCtx.state !== 'closed') {
                oldCtx.close()
                    .then(() => this.logEvent('_rebuildContext: closed previous context'))
                    .catch((e) => this.logEvent('_rebuildContext: closing previous context THREW — ' + e.message));
            }
            await this._raceTimeout(() => Tone.start(), 2000, '_rebuildContext Tone.start()');
            if (Tone.context.state !== 'running') {
                await this._raceTimeout(() => Tone.context.resume(), 1500, '_rebuildContext resume()');
            }
            this.logEvent('_rebuildContext: new context state=' + Tone.context.state);

            this.samplers = {};
            this.reverb = new Tone.Reverb({ decay: 1.8, preDelay: 0.01, wet: 0.2 });
            const eq = new Tone.Filter(8000, "lowpass");
            this.reverb.connect(eq);
            eq.toDestination();

            this.ready = false;
            this.lastAudioError = null;
            this._setLoading(true);
            for (let i = 0; i < this.channels.length; i++) {
                await this.loadInstrument(this.channels[i]);
            }
            this._setLoading(false);

            // Buffers can finish decoding even while the context is still
            // suspended (decodeAudioData doesn't require a running context),
            // so loadedCount alone is not proof that sound will actually play.
            const loadedCount = Object.values(this.samplers).filter(s => s && s.loaded).length;
            this.ready = loadedCount > 0 && Tone.context.state === 'running';
            if (!this.ready) this.lastAudioError = Tone.context.state !== 'running' ? 'context-suspended (iOS did not resume audio)' : 'rebuild-failed';
            this.logEvent('_rebuildContext: done, loadedCount=' + loadedCount + ', ctxState=' + Tone.context.state + ', ready=' + this.ready);
        } catch (e) {
            this.lastAudioError = 'rebuild-error: ' + e.message;
            this.logEvent('_rebuildContext THREW: ' + e.message);
        }
    }

    _setLoading(isLoading) {
        const toast = document.getElementById('loading_toast');
        if (!toast) return;
        if (isLoading) {
            this._loadingCount = (this._loadingCount || 0) + 1;
            if (this._loadingCount === 1) toast.classList.add('visible');
        } else {
            this._loadingCount = Math.max(0, (this._loadingCount || 0) - 1);
            if (this._loadingCount === 0) toast.classList.remove('visible');
        }
    }

    // Proxy the raw context properties that main.js relies upon for resume checks on iOS
    get ctx() {
        if (!this._unlocked) {
            return { state: 'suspended', resume: async () => {}, currentTime: 0 };
        }
        if (this.useFallback && this.fallbackCtx) return this.fallbackCtx;
        if (window.Tone) return Tone.context.rawContext;
        
        return { state: 'suspended', resume: async () => {}, currentTime: 0 };
    }

    async unlockAndLoad() {
        if (this._unlocked) {
            this.logEvent('unlockAndLoad: already unlocked, no-op');
            return;
        }
        this._unlocked = true;
        this.logEvent('unlockAndLoad: start, document.visibilityState=' + document.visibilityState);

        if (!window.Tone) {
            this.logEvent('Tone.js unavailable — falling back to WebAudioFont');
            this.useFallback = true;
            this._setupFallbackContext();
            return;
        }

        this.logEvent('Tone.context.state before Tone.start(): ' + Tone.context.state);
        // iOS Safari has a known bug where AudioContext.resume()'s promise can
        // hang forever (never resolves, never rejects) under certain audio
        // session states. Tone.start() awaits exactly that promise internally,
        // so without a timeout guard the whole unlock sequence would block
        // indefinitely with no error to surface. _raceTimeout lets us move on
        // regardless and check the actual context.state afterwards.
        await this._raceTimeout(() => Tone.start(), 3000, 'Tone.start()');

        // ── iOS: wait for AudioContext to be actually running ─────────────────
        if (Tone.context.state !== 'running') {
            await this._raceTimeout(() => Tone.context.resume(), 2000, 'explicit context.resume()');
        }
        let waited = 0;
        while (Tone.context.state !== 'running' && waited < 2000) {
            await new Promise(r => setTimeout(r, 50));
            waited += 50;
        }
        this.logEvent(`context state after ${waited}ms poll: ${Tone.context.state}`);

        // If the context is still stuck after start+resume+poll, the device-level
        // bug means resume() will likely never work for THIS context instance.
        // Recreate the AudioContext from scratch right now (same recovery used
        // for backgrounding) instead of giving up — this is what previously only
        // a full device restart could fix.
        if (Tone.context.state !== 'running') {
            this.logEvent('initial unlock: context still stuck — rebuilding immediately');
            await this._rebuildContext();
            return;
        }
        // ─────────────────────────────────────────────────────────────────────

        // High quality Reverb setup
        this.reverb = new Tone.Reverb({
            decay: 1.8,
            preDelay: 0.01,
            wet: 0.2
        });
        
        // Lowpass EQ filter for realism and softening the top end
        const eq = new Tone.Filter(8000, "lowpass");
        this.reverb.connect(eq);
        eq.toDestination();

        // Preload current preset asynchronously and sequentially
        // (only if context is running — otherwise skip to avoid infinite hang)
        if (Tone.context.state === 'running') {
            this._setLoading(true);
            for (let i = 0; i < this.channels.length; i++) {
                await this.loadInstrument(this.channels[i]);
            }
            this._setLoading(false);
            // "Ready" means samples actually decoded — not just that the loop ran.
            // If every sampler failed (e.g. the external CDN host is blocked on
            // this network), keep ready=false so the on-screen diagnostic appears.
            const loadedCount = Object.values(this.samplers).filter(s => s && s.loaded).length;
            this.logEvent('sample preload done, loadedCount=' + loadedCount + '/' + this.channels.length);
            if (loadedCount > 0) {
                this.ready = true;
            } else if (!this.lastAudioError) {
                this.lastAudioError = 'no samples decoded';
            }
        } else {
            this.lastAudioError = 'context-suspended (iOS did not resume audio)';
            this.logEvent('Context never reached running — skipping sample preload');
        }
    }

    // Manual recovery path for the on-screen "tap to retry" banner. unlockAndLoad()
    // is a no-op once already unlocked, so a stuck-but-unlocked context needs the
    // same rebuild used by the automatic lifecycle handler, not another unlock call.
    async forceRecover() {
        this.logEvent('forceRecover() called, unlocked=' + this._unlocked + ', useFallback=' + this.useFallback);
        if (this.useFallback) {
            this._setupFallbackContext();
            return;
        }
        if (!this._unlocked) {
            await this.unlockAndLoad();
            return;
        }
        await this._rebuildContext();
    }

    // Human-readable snapshot of the audio pipeline, for on-device debugging.
    getAudioStatus() {
        let st = 'n/a';
        try {
            st = this.useFallback
                ? (this.fallbackCtx && this.fallbackCtx.state)
                : (window.Tone && Tone.context.state);
        } catch (e) {}
        // Count only samplers for the currently active channels (not every
        // instrument ever loaded across preset switches), so the number stays
        // bounded by the channel count and reads as a meaningful ratio.
        const loaded = this.channels.filter(name => this.samplers[name] && this.samplers[name].loaded).length;
        const parts = [
            'engine=' + (this.useFallback ? 'WebAudioFont' : (window.Tone ? 'Tone' : 'none')),
            'ctx=' + st,
            'ready=' + (!!this.ready),
            'samples=' + loaded + '/' + this.channels.length
        ];
        if (this.lastAudioError) parts.push('err=' + this.lastAudioError);
        return parts.join(' · ');
    }

    // ── FALLBACK WEBAUDIOFONT LOGIC ───────────────────────────────────────
    
    _setupFallbackContext() {
        this.fallbackCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterBus = this.fallbackCtx.createGain();
        this.masterBus.gain.value = 1.0;
        this.masterBus.connect(this.fallbackCtx.destination);
        
        // Reverb synthetic
        const sr  = this.fallbackCtx.sampleRate;
        const len = Math.floor(sr * 1.4);
        const ir  = this.fallbackCtx.createBuffer(2, len, sr);
        for (let c = 0; c < 2; c++) {
            const d = ir.getChannelData(c);
            for (let i = 0; i < len; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
            }
        }
        let fallbackReverb = this.fallbackCtx.createConvolver();
        fallbackReverb.buffer = ir;
        fallbackReverb.connect(this.fallbackCtx.destination);

        let reverbSend = this.fallbackCtx.createGain();
        reverbSend.gain.value = 0.18;
        this.masterBus.connect(reverbSend);
        reverbSend.connect(fallbackReverb);

        this.fallbackCtx.resume().then(() => {
            this.channels.forEach(inst => this._loadFallbackProg(this.fallbackPrograms[inst]));
            this.ready = true;
        });
    }

    _loadFallbackProg(prog) {
        if (!this.fallbackCtx || prog === undefined) return;
        const num     = String(prog * 10).padStart(4, '0');
        const varName = `_tone_${num}_FluidR3_GM_sf2_file`;
        const url     = `https://surikov.github.io/webaudiofontdata/sound/${num}_FluidR3_GM_sf2_file.js`;
        if (this.player && this.player.loader) {
            this.player.loader.startLoad(this.fallbackCtx, url, varName);
        }
    }

    _getFallbackPreset(channelIdx) {
        const inst = this.channels[channelIdx];
        const prog = this.fallbackPrograms[inst];
        const num = String(prog * 10).padStart(4, '0');
        return window[`_tone_${num}_FluidR3_GM_sf2_file`] || null;
    }

    // ── TONE.JS SAMPLER LOGIC ─────────────────────────────────────────────

    // Some iOS WebKit builds throw inside sampler.connect() when called
    // from a Tone.Sampler onload/onerror callback (the offending node isn't
    // a fully-fledged object yet). Tone.js then swallows that throw and
    // re-invokes onerror, even though the buffers loaded fine. Wrap the
    // connect so a graph failure doesn't get mislabeled as a load failure.
    _connectSampler(sampler, name) {
        try {
            sampler.connect(this.reverb);
            return true;
        } catch (e) {
            this.logEvent('loadInstrument(' + name + '): connect to reverb THREW — ' + (e && e.message ? e.message : e));
            try {
                sampler.toDestination();
                this.logEvent('loadInstrument(' + name + '): fell back to toDestination()');
                return true;
            } catch (e2) {
                this.logEvent('loadInstrument(' + name + '): toDestination() ALSO THREW — ' + (e2 && e2.message ? e2.message : e2));
                return false;
            }
        }
    }

    async loadInstrument(name) {
        if (this.useFallback) {
            this._loadFallbackProg(this.fallbackPrograms[name]);
            return null;
        }
        if (!window.Tone) return null;
        if (this.samplers[name]) return this.samplers[name];
        
        // Define locally hosted reliable priority samples vs CDN lazy loads
        const SELF_HOSTED = ['bass-electric', 'trumpet', 'french-horn', 'flute'];
        const baseUrl = SELF_HOSTED.includes(name) 
            ? `assets/samples/${name}/`
            : `https://nbrosowsky.github.io/tonejs-instruments/samples/${name}/`;

        this.logEvent('loadInstrument(' + name + '): requesting from ' + baseUrl);
        return new Promise((resolve) => {
            let settled = false;
            const timeoutId = setTimeout(() => {
                if (settled) return;
                this.logEvent('loadInstrument(' + name + '): TIMEOUT after 8s (Tone never called onload/onerror)');
            }, 8000);
            const sampler = new Tone.Sampler({
                urls: this.INSTRUMENT_MAPS[name] || { "C4": "C4.mp3" },
                baseUrl: baseUrl,
                onload: () => {
                    settled = true;
                    clearTimeout(timeoutId);
                    this.logEvent('loadInstrument(' + name + '): onload OK');
                    this.samplers[name] = sampler;
                    this._connectSampler(sampler, name);
                    resolve(sampler);
                },
                onerror: (err) => {
                    settled = true;
                    clearTimeout(timeoutId);
                    // This can fire either because the buffers genuinely failed to
                    // load, or because connect() threw inside a prior onload call
                    // (see _connectSampler). Only tag it as a load failure if the
                    // sampler doesn't actually have its buffers ready.
                    const buffersReady = sampler.loaded;
                    if (!buffersReady) {
                        this.lastAudioError = 'sample-load-failed: ' + name;
                    }
                    this.logEvent('loadInstrument(' + name + '): onerror (buffersReady=' + buffersReady + ') — ' + (err && err.message ? err.message : err));
                    this.samplers[name] = sampler;
                    this._connectSampler(sampler, name);
                    resolve(sampler);
                }
            });
            // Immediately cache the instance reference to avoid duplicate triggers
            this.samplers[name] = sampler;
        });
    }

    async applyPreset(name) {
        const progs = this.PRESETS[name];
        if (!progs) return;
        progs.forEach((prog, i) => { this.channels[i] = prog; });
        if (this._unlocked) {
            // Guard: don't start loading if context is suspended — decodeAudioData would hang.
            if (window.Tone && Tone.context.state !== 'running') {
                await this._raceTimeout(() => Tone.context.resume(), 1500, 'applyPreset resume()');
                let waited = 0;
                while (Tone.context.state !== 'running' && waited < 1000) {
                    await new Promise(r => setTimeout(r, 50));
                    waited += 50;
                }
                if (Tone.context.state !== 'running') {
                    console.warn('[AudioEngine] applyPreset: context suspended, skipping load');
                    return;
                }
            }
            this._setLoading(true);
            // iOS Safari severely bottlenecks parallel AudioBuffer.decodeAudioData triggers. 
            // We MUST load the 7 instruments sequentially to guarantee memory resilience on mobile profiles.
            for (let i = 0; i < progs.length; i++) {
                await this.loadInstrument(progs[i]);
            }
            this._setLoading(false);
        }
    }

    setChannelInstrument(channelIdx, instrumentName) {
        if (channelIdx < 0 || channelIdx >= this.channels.length) return;
        const prog = this.instrumentPrograms[instrumentName];
        if (prog === undefined) return;
        this.channels[channelIdx] = prog;
        if (this._unlocked) this.loadInstrument(prog);
    }

    _getVolume() {
        const sel = document.getElementById('volume_menu');
        return sel ? parseFloat(sel.value) : 0.70;
    }

    playPitch(channelIdx, freq, duration = 1.8, chordIdx = null) {
        this.playMidi(channelIdx, Math.round(69 + 12 * Math.log2(freq / 440)), 100, duration, chordIdx);
    }

    playNote(channelIdx, midiPitch, velocity = 100, duration = 1.5, chordIdx = null) {
        this.playMidi(channelIdx, midiPitch, velocity, duration, chordIdx);
    }
    
    async playMidi(channelIdx, midiPitch, velocity, duration, chordIdx) {
        if (!this._unlocked) return;

        // Fallback Logic Execution
        if (this.useFallback) {
            if (this.fallbackCtx.state === 'suspended') this.fallbackCtx.resume();
            const preset = this._getFallbackPreset(channelIdx);
            if (!preset || !this.player) return;
            const gain = (velocity / 127) * this._getVolume() * this._channelGain(channelIdx);
            this.player.queueWaveTable(this.fallbackCtx, this.masterBus, preset, this.fallbackCtx.currentTime, midiPitch, duration, gain);
            if (window.gui?.highlight) window.gui.highlight(channelIdx, 440 * Math.pow(2, (midiPitch - 69) / 12), duration * 1000, chordIdx);
            return;
        }

        // Tone.js Standard Execution
        if (Tone.context.state !== 'running') {
            const running = await this._ensureContextRunning('playMidi');
            if (!running) return;
        }

        const instName = this.channels[channelIdx];
        if (!instName) return;
        
        const sampler = await this.loadInstrument(instName);
        if (!sampler || !sampler.loaded) return;

        const gain = (velocity / 127) * this._getVolume() * this._channelGain(channelIdx);

        const freq = Tone.Frequency(midiPitch, "midi").toNote();
        
        sampler.triggerAttackRelease(freq, duration, Tone.now(), gain);
        
        if (window.gui?.highlight) {
            window.gui.highlight(channelIdx, 440 * Math.pow(2, (midiPitch - 69) / 12), duration * 1000, chordIdx);
        }
    }

    async playChord(notesArray, durationOverride = null, chordIdx = null) {
        if (!this._unlocked) return;

        // Subtle onset stagger (30ms) between voices, bottom-up. Even a small
        // asynchrony sharply improves auditory stream segregation — the brain
        // separates the voices instead of fusing them into one "blob". Kept
        // small enough to still read as a chord, not an arpeggio. This is the
        // app's core differentiator, so it's on by default for everyone.
        const SPREAD_SEC = 0.03;
        const dur = durationOverride !== null ? durationOverride : 1.87;
        const vol = this._getVolume();

        if (this.useFallback) {
            this.fallbackCtx.resume();
            const lead = this.fallbackCtx.state === 'running' ? 0.1 : 0.4;
            const now = this.fallbackCtx.currentTime;
            
            notesArray.forEach((item, idx) => {
                const freq   = item.frequency || item.freq;
                const midi   = Math.round(69 + 12 * Math.log2(freq / 440));
                const preset = this._getFallbackPreset(item.voiceIdx);
                if (!preset || !this.player) return;

                this.player.queueWaveTable(this.fallbackCtx, this.masterBus, preset,
                    now + lead + idx * SPREAD_SEC, midi, dur, vol * this._channelGain(item.voiceIdx));

                if (window.gui?.highlight) {
                    setTimeout(() => window.gui.highlight(item.voiceIdx, freq, dur * 800, chordIdx), (0.1 + idx * SPREAD_SEC) * 1000);
                }
            });
            return;
        }

        if (Tone.context.state !== 'running') await this._ensureContextRunning('playChord');

        const lead = Tone.context.state === 'running' ? 0.1 : 0.4;
        const startTime = Tone.now() + lead;

        notesArray.forEach(async (item, idx) => {
            const freq = item.frequency || item.freq;
            const midi = Math.round(69 + 12 * Math.log2(freq / 440));
            const instName = this.channels[item.voiceIdx];
            if (!instName) return;

            const sampler = await this.loadInstrument(instName);
            if (!sampler || !sampler.loaded) return;

            const noteObj = Tone.Frequency(midi, "midi").toNote();

            const triggerTime = startTime + idx * SPREAD_SEC;
            sampler.triggerAttackRelease(noteObj, dur, triggerTime, vol * this._channelGain(item.voiceIdx));

            if (window.gui?.highlight) {
                setTimeout(
                    () => window.gui.highlight(item.voiceIdx, freq, dur * 800, chordIdx),
                    (lead + idx * SPREAD_SEC) * 1000
                );
            }
        });
    }

    stopAll() {
        if (!this._unlocked) return;
        if (this.useFallback) {
            if (this.player && this.fallbackCtx) this.player.cancelQueue(this.fallbackCtx);
        } else {
            Object.values(this.samplers).forEach(s => {
                if (s && s.loaded) {
                    try { s.releaseAll(); } catch(e){}
                }
            });
        }
    }

    playClick(duration = 0.02) {
        try {
            const ctx = this.ctx;
            if (!ctx || ctx.state === 'suspended' || !ctx.createOscillator) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 1000;
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {}
    }

    async playChordWithVolumes(notesArray, volumeMap, durationOverride = null, chordIdx = null) {
        if (!this._unlocked) return;

        const SPREAD_SEC = 0;
        const dur = durationOverride !== null ? durationOverride : 1.87;
        const vol = this._getVolume();

        if (this.useFallback) {
            this.fallbackCtx.resume();
            const lead = this.fallbackCtx.state === 'running' ? 0.1 : 0.4;
            const now = this.fallbackCtx.currentTime;
            
            notesArray.forEach((item, idx) => {
                const volMult = volumeMap[item.voiceIdx] ?? 1.0;
                if (volMult <= 0) return;
                
                const freq   = item.frequency || item.freq;
                const midi   = Math.round(69 + 12 * Math.log2(freq / 440));
                const preset = this._getFallbackPreset(item.voiceIdx);
                if (!preset || !this.player) return;

                this.player.queueWaveTable(this.fallbackCtx, this.masterBus, preset,
                    now + lead + idx * SPREAD_SEC, midi, dur, vol * this._channelGain(item.voiceIdx) * volMult);

                if (window.gui?.highlight) {
                    setTimeout(() => window.gui.highlight(item.voiceIdx, freq, dur * 800, chordIdx), (0.1 + idx * SPREAD_SEC) * 1000);
                }
            });
            return;
        }

        if (Tone.context.state !== 'running') await this._ensureContextRunning('playChordWithVolumes');

        const lead = Tone.context.state === 'running' ? 0.1 : 0.4;
        const startTime = Tone.now() + lead;

        notesArray.forEach(async (item, idx) => {
            const volMult = volumeMap[item.voiceIdx] ?? 1.0;
            if (volMult <= 0) return;

            const freq = item.frequency || item.freq;
            const midi = Math.round(69 + 12 * Math.log2(freq / 440));
            const instName = this.channels[item.voiceIdx];
            if (!instName) return;

            const sampler = await this.loadInstrument(instName);
            if (!sampler || !sampler.loaded) return;

            const noteObj = Tone.Frequency(midi, "midi").toNote();

            const triggerTime = startTime + idx * SPREAD_SEC;
            sampler.triggerAttackRelease(noteObj, dur, triggerTime, vol * this._channelGain(item.voiceIdx) * volMult);
            
            if (window.gui?.highlight) {
                setTimeout(
                    () => window.gui.highlight(item.voiceIdx, freq, dur * 800, chordIdx),
                    (lead + idx * SPREAD_SEC) * 1000
                );
            }
        });
    }
}

window.audioEngine = new AudioEngine();
