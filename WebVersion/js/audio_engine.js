class AudioEngine {
    constructor() {
        this._unlocked  = false;
        this.ready      = false;   // true once a context is running AND samples can play
        this.lastAudioError = null;
        this._log = []; // timestamped event ring-buffer for on-device debugging

        // Preferred engine inside the Capacitor iOS shell. This path never
        // creates or resumes a JavaScript AudioContext: Swift owns AVAudioSession
        // and AVAudioEngine. On Safari/PWA/desktop the bridge is absent and all
        // existing web engines continue to work unchanged.
        this.nativeAudio = window.NativeAudioBridge || null;
        this.useNativeAudio = false;
        this._nativeStatus = null;

        // Tone.js vars
        this.samplers = {};
        this.reverb = null;

        // Last-resort playback path: plain <audio> elements. See the
        // HTMLAUDIO section below for why this exists.
        this.useElementFallback = false;
        this._elPool = null;

        // Instruments served from our own assets/ rather than the CDN.
        this.SELF_HOSTED = ['bass-electric', 'trumpet', 'french-horn', 'flute', 'guitar-nylon'];

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
            // Self-hosted (see assets/samples/guitar-nylon/ATTRIBUTION.txt).
            // The previous CDN set was measurably unreliable: D5.mp3 sounded a
            // full semitone sharp — turning a D chord's top octave into a b9 —
            // and B1.mp3 was an octave out. This set is a whole-tone grid from
            // E2 to A5, so nothing is ever pitch-shifted by more than a
            // semitone, and every file was pitch-measured before being
            // committed (all within ±3.6 cents of equal temperament).
            'guitar-nylon': { 'E2': 'E2.mp3', 'F#2': 'Fs2.mp3', 'G#2': 'Gs2.mp3', 'A#2': 'As2.mp3', 'C3': 'C3.mp3', 'D3': 'D3.mp3', 'E3': 'E3.mp3', 'F#3': 'Fs3.mp3', 'G#3': 'Gs3.mp3', 'A#3': 'As3.mp3', 'C4': 'C4.mp3', 'D4': 'D4.mp3', 'E4': 'E4.mp3', 'F#4': 'Fs4.mp3', 'G#4': 'Gs4.mp3', 'A#4': 'As4.mp3', 'C5': 'C5.mp3', 'D5': 'D5.mp3', 'E5': 'E5.mp3', 'F#5': 'Fs5.mp3', 'G#5': 'Gs5.mp3', 'A5': 'A5.mp3' },
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
            // Beginner guitar track: one timbre on every voice, so the chord
            // sounds like the instrument the student is actually learning
            // rather than a timbral separation puzzle. The whole point is
            // transfer to what the teacher plays in the lesson.
            'Chitarra':     ["guitar-nylon", "guitar-nylon", "guitar-nylon", "guitar-nylon", "guitar-nylon", "guitar-nylon", "guitar-nylon"],
        };

        this._assertSampleMaps();
        this._bindLifecycleEvents();
        // Request the 'playback' AVAudioSession category as early as possible
        // via the official Safari 17+ API (no-op elsewhere); logged so the
        // on-device debug trail shows whether the API exists on this device.
        this._configureAudioSession();
    }

    // A sample map entry must name the file after its own note ('F#2' →
    // 'Fs2.mp3'). When it doesn't, Tone believes the buffer sounds a pitch it
    // doesn't, and that voice plays transposed while the staff still shows the
    // written note — a wrong-note bug with no visible cause. This caught
    // 'G5' → 'G3.mp3' in guitar-nylon; it runs once and normally logs nothing.
    _assertSampleMaps() {
        let bad = 0;
        for (const inst in this.INSTRUMENT_MAPS) {
            const map = this.INSTRUMENT_MAPS[inst];
            for (const note in map) {
                const expected = note.replace('#', 's') + '.mp3';
                if (map[note] !== expected) {
                    bad++;
                    this.logEvent('SAMPLE MAP BUG: ' + inst + ' ' + note + ' -> ' + map[note] + ' (expected ' + expected + ')');
                }
            }
        }
        if (bad) this.logEvent('sample map check: ' + bad + ' mismatched entr' + (bad === 1 ? 'y' : 'ies'));
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

    // Lightweight, NON-destructive context wake used on the playback path.
    // Crucial: this must NEVER rebuild the context or reload samplers. A
    // rebuild wipes this.samplers and recreates the graph, and doing that
    // per-chord made every chord cut off after a fraction of a second while
    // the samples reloaded. If a quick resume() doesn't wake the context we
    // just skip the note — real recovery (rebuild) is reserved for the
    // foreground-return and manual-retry paths only.
    async _ensureContextRunning(label) {
        if (Tone.context.state === 'running') return true;
        // resume() throws on a closed context; only attempt it when suspended.
        if (Tone.context.state !== 'closed') {
            await this._raceTimeout(() => Tone.context.resume(), 400, label + ' resume()');
        }
        return Tone.context.state === 'running';
    }

    // Samplers usable RIGHT NOW: buffers decoded AND built on the current
    // context generation (a stale-generation sampler reports loaded=true but
    // is permanently silent — its nodes live on an abandoned context).
    _usableSamplerCount() {
        const gen = this._ctxGen || 0;
        return this.channels.filter(n => {
            const s = this.samplers[n];
            return s && s.loaded && (s._cvGen || 0) === gen;
        }).length;
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

            if (this.useNativeAudio && this.nativeAudio) {
                try {
                    this._nativeStatus = await this.nativeAudio.activate();
                    this.ready = !!this._nativeStatus?.engineRunning;
                    this.lastAudioError = this.ready ? null : 'native-audio-not-running';
                    this.logEvent('native lifecycle activate: running=' + this.ready);
                } catch (e) {
                    this.ready = false;
                    this.lastAudioError = 'native-audio-activate: ' + e.message;
                    this.logEvent('native lifecycle activate THREW: ' + e.message);
                }
                return;
            }

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
                // We released the session on backgrounding (paused activator,
                // suspended context) — re-acquire it before resuming, in the
                // same order as the cold-start unlock: session first, then ctx.
                const kick = await this._kickAudioSession(800);
                if (kick === 'rejected') {
                    // No gesture available out here; the next user tap has one.
                    this._armGestureRecovery();
                }
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
                if (Tone.context.state !== 'running') this._armGestureRecovery();
            } else {
                this.ready = this._usableSamplerCount() > 0;
            }
            } finally {
                this._resuming = false;
            }
        };

        // ── Release the audio session the moment we're backgrounded ────────
        // On-device evidence: cold start and background/return both work, but
        // force-closing the app (Safari or PWA) while the session is active
        // wedges iOS's audio daemon system-wide — every context on the device
        // is then born suspended-forever until a reboot. A force-close always
        // goes through the app switcher, i.e. the page gets 'hidden' BEFORE
        // being killed. So if we release the session (pause the looping
        // activator, suspend the context) as soon as we're hidden, a kill
        // finds nothing active to orphan, and the daemon stays healthy.
        // 'hidden' is a maybe-coming-back: pause the activator and suspend the
        // context, cheap to undo. 'pagehide' means the page is being frozen or
        // discarded — iOS reloads this app outright after a spell in the app
        // switcher — so there is nothing to come back to and we CLOSE every
        // context we ever created instead of leaving them for the audio daemon
        // to reap. Closing here cannot race with anything (unlike the rebuild
        // path, where it once wedged the page), and a rebuild afterwards is now
        // cheap because the samples are self-hosted and service-worker cached.
        const releaseSession = (source, hard) => {
            if (!this._unlocked || this.useFallback) return;
            if (this.useNativeAudio && this.nativeAudio) {
                this.logEvent('lifecycle: ' + source + ' — deactivating native AVAudioSession');
                this.nativeAudio.deactivate().catch((e) =>
                    this.logEvent('native deactivate THREW: ' + e.message)
                );
                return;
            }
            this.logEvent('lifecycle: ' + source + ' — releasing audio session' + (hard ? ' (closing contexts)' : ''));
            try {
                const el = document.getElementById('ios_audio_activator');
                if (el && !el.paused) el.pause();
            } catch (e) {}
            if (!hard) {
                try {
                    const ctx = this._rawCtx;
                    if (ctx && ctx.state === 'running' && ctx.suspend) ctx.suspend().catch(() => {});
                } catch (e) {}
                return;
            }
            (this._createdCtxs || []).forEach(ctx => {
                try {
                    if (ctx && ctx.state !== 'closed' && ctx.close) ctx.close().catch(() => {});
                } catch (e) {}
            });
            this._createdCtxs = [];
        };
        // A force-quit from the app switcher usually kills the process WITHOUT
        // ever firing pagehide, so relying on pagehide to close the contexts
        // leaves the session orphaned in exactly the case the user hits: quit
        // the app, reopen, audio dead. 'hidden' is the last event we are
        // guaranteed to get. Suspending immediately is cheap and reversible;
        // after a short grace period — long enough that flicking to another app
        // and straight back costs nothing — we do the full release, because by
        // then this is a real backgrounding and the kill may come at any
        // moment. Coming back cancels it, and a rebuild is now cheap: the
        // samples are local and service-worker cached.
        const HIDDEN_RELEASE_MS = 2500;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                releaseSession('visibilitychange-hidden', false);
                clearTimeout(this._hiddenReleaseTimer);
                this._hiddenReleaseTimer = setTimeout(() => {
                    if (document.visibilityState === 'hidden') {
                        releaseSession('still hidden after ' + HIDDEN_RELEASE_MS + 'ms', true);
                    }
                }, HIDDEN_RELEASE_MS);
            } else {
                clearTimeout(this._hiddenReleaseTimer);
            }
        });
        window.addEventListener('pagehide', () => releaseSession('pagehide', true));

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
            // NOTE: we deliberately do NOT close the previous context here.
            // An earlier attempt to close it (to respect iOS's cap on live
            // AudioContexts) backfired: on iOS, closing a context in the same
            // session left the freshly-created replacement stuck 'closed', so
            // audio never recovered. Letting the old context be garbage-
            // collected is the behavior that actually worked on device.
            //
            // Session kick first: iOS pauses the silence-activator when the
            // app is backgrounded, dropping the AVAudioSession out of
            // 'playback' — and a context created under the wrong session is
            // born unresumable. The activator was blessed by the original
            // start tap, so re-playing it here needs no new gesture.
            await this._kickAudioSession(800);
            await this._freshContextAfterKick('_rebuildContext');
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
            const loadedCount = this._usableSamplerCount();
            this.ready = loadedCount > 0 && Tone.context.state === 'running';
            if (!this.ready) this.lastAudioError = Tone.context.state !== 'running' ? 'context-suspended (iOS did not resume audio)' : 'rebuild-failed';
            this.logEvent('_rebuildContext: done, loadedCount=' + loadedCount + ', ctxState=' + Tone.context.state + ', ready=' + this.ready);
            if (Tone.context.state !== 'running') {
                this._enableElementFallback('rebuild: context never reached running');
                this._startContextWatchdog();
                this._armGestureRecovery();
            }
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
        if (this.useNativeAudio) {
            // Compatibility shim for UI guards that only inspect ctx.state.
            return { state: 'running', resume: async () => {}, currentTime: 0 };
        }
        if (this.useFallback && this.fallbackCtx) return this.fallbackCtx;
        if (window.Tone) return Tone.context.rawContext;
        
        return { state: 'suspended', resume: async () => {}, currentTime: 0 };
    }

    // Starts (or restarts) the hidden silence-<audio> activator and waits for
    // it to actually play. This is what flips the iOS AVAudioSession from
    // soloAmbient to 'playback' — the precondition for any AudioContext to be
    // resumable. Must be invoked so that el.play() fires synchronously inside
    // a user gesture the FIRST time; after that first blessed play, iOS lets
    // the same element be re-played programmatically (foreground return,
    // Retry button) without a new gesture.
    // Safari 17+ exposes the AVAudioSession directly (navigator.audioSession):
    // setting type='playback' is the official replacement for the silence.wav
    // hack, and .state tells us if iOS considers the session 'interrupted' —
    // a state in which no context will ever resume, invisible until now.
    _configureAudioSession() {
        try {
            if ('audioSession' in navigator) {
                navigator.audioSession.type = 'playback';
                this.logEvent('audioSession API: type=playback set, state=' + navigator.audioSession.state);
                if (!this._audioSessionHooked) {
                    this._audioSessionHooked = true;
                    navigator.audioSession.onstatechange = () =>
                        this.logEvent('audioSession state → ' + navigator.audioSession.state);
                }
            } else {
                this.logEvent('audioSession API not available on this Safari');
            }
        } catch (e) {
            this.logEvent('audioSession API THREW: ' + e.message);
        }
    }

    // Classic iOS unlock ritual: play a 1-sample silent buffer through the
    // context. This predates resume() and can unwedge contexts whose resume()
    // promise never settles. Tone's own default context gets this from
    // standardized-audio-context internally — raw contexts we mint ourselves
    // never did, which may be exactly why they stayed suspended.
    _unlockRitual(ctx, tag, quiet) {
        try {
            const src = ctx.createBufferSource();
            src.buffer = ctx.createBuffer(1, 1, 22050);
            src.connect(ctx.destination);
            src.start(0);
            if (!quiet) this.logEvent(tag + ': silent-buffer unlock ritual fired');
        } catch (e) {
            this.logEvent(tag + ': unlock ritual THREW — ' + e.message);
        }
    }

    async _kickAudioSession(ms) {
        this._configureAudioSession();
        const el = document.getElementById('ios_audio_activator');
        if (!el) {
            this.logEvent('kickAudioSession: activator element missing');
            return 'missing';
        }
        if (!el.paused && !el.ended) {
            this.logEvent('kickAudioSession: activator already playing');
            return 'playing';
        }
        this.logEvent('kickAudioSession: activator.play()');
        let settled = false;
        let result = 'timeout';
        await Promise.race([
            el.play()
                .then(() => { settled = true; result = 'playing'; this.logEvent('kickAudioSession: activator playing (session=playback)'); })
                .catch((e) => { settled = true; result = 'rejected'; this.logEvent('kickAudioSession: play() rejected — ' + e.message); }),
            new Promise(r => setTimeout(() => {
                if (!settled) this.logEvent('kickAudioSession: play() did not settle within ' + ms + 'ms');
                r();
            }, ms))
        ]);
        // Give the OS a beat to finish the session-category switch; play()
        // resolving and the route actually being live aren't atomic.
        await new Promise(r => setTimeout(r, 150));
        return result;
    }

    // Safety net for foreground returns where the automatic re-kick fails:
    // outside a user gesture iOS may reject activator.play() (NotAllowedError),
    // leaving the session unacquired and EVERYTHING silent — notes and earcons
    // alike. The user's next tap anywhere on the page IS a gesture, so arm a
    // one-shot capture-phase listener that re-kicks the session in-gesture and
    // resumes/rebuilds the context, invisibly to the user.
    _armGestureRecovery() {
        if (this._gestureRecoveryArmed) return;
        this._gestureRecoveryArmed = true;
        this.logEvent('gesture recovery armed — next tap re-kicks the session');
        const handler = () => {
            document.removeEventListener('touchend', handler, true);
            document.removeEventListener('click', handler, true);
            this._gestureRecoveryArmed = false;
            this.logEvent('gesture recovery: tap received — re-kicking in-gesture');
            // A real gesture: last chance to bless the <audio> pool if the
            // start tap never managed to.
            this._unlockElementPool();
            // Synchronous inside the gesture — this play() is user-activated.
            try {
                const el = document.getElementById('ios_audio_activator');
                if (el && el.paused) el.play().catch(() => {});
            } catch (e) {}
            (async () => {
                if (!window.Tone || Tone.context.state === 'running') return;
                await this._raceTimeout(() => Tone.context.resume(), 1000, 'gesture-recovery resume()');
                let waited = 0;
                while (Tone.context.state !== 'running' && waited < 1000) {
                    await new Promise(r => setTimeout(r, 100));
                    waited += 100;
                }
                if (Tone.context.state === 'running') {
                    this.ready = this._usableSamplerCount() > 0;
                    if (this.ready) this.lastAudioError = null;
                    this.logEvent('gesture recovery: context running, ready=' + this.ready);
                } else {
                    this.logEvent('gesture recovery: still stuck — rebuilding');
                    await this._rebuildContext();
                }
            })();
        };
        document.addEventListener('touchend', handler, true);
        document.addEventListener('click', handler, true);
    }

    // Creates a fresh AudioContext (assumes the session was just kicked),
    // makes it Tone's context, and confirms it reaches 'running'. Retries once
    // with a second context if the first is born wedged — but never more, to
    // stay under iOS's cap on live contexts.
    async _freshContextAfterKick(label) {
        // Never let two swaps overlap. unlockAndLoad and a lifecycle-triggered
        // rebuild can both reach here, and concurrent swaps closing each
        // other's freshly-made context is exactly what once wedged the page in
        // 'closed'. Serializing makes the close below provably safe.
        if (this._ctxSwapping) {
            this.logEvent(label + ': context swap already in progress — skipping');
            return Tone.context.state === 'running';
        }
        this._ctxSwapping = true;
        try {
            return await this._freshContextAttempts(label);
        } finally {
            this._ctxSwapping = false;
        }
    }

    async _freshContextAttempts(label) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            // Cap how many contexts are ALIVE AT ONCE, not how many have ever
            // been created. What wedges iOS is accumulating live contexts, and
            // every abandoned one is closed now — so normal churn across app
            // switches is harmless, while a genuine leak still trips the guard.
            // (Counting cumulative creations instead made a handful of
            // background/foreground cycles exhaust the budget on their own.)
            const live = (this._createdCtxs || []).filter(c => c && c.state !== 'closed').length;
            if (live >= 4) {
                this.logEvent(label + ': ' + live + ' contexts still alive — refusing to create more');
                this.lastAudioError = 'audio-system-wedged (riavvia il telefono)';
                return false;
            }
            const abandoned = this._rawCtx;
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            (this._createdCtxs = this._createdCtxs || []).push(ctx);
            const tag = label + ' ctx#' + attempt;
            this.logEvent(tag + ' created, state=' + ctx.state);
            // Timestamped record of every state transition — tells us whether
            // a "stuck" context ever comes alive later (resume()'s promise is
            // known to never settle on some WebKit builds even on success).
            ctx.onstatechange = () => this.logEvent(tag + ' statechange → ' + ctx.state);
            Tone.setContext(ctx);
            this._rawCtx = ctx;
            // Only now that the replacement is live is the previous context
            // genuinely orphaned — closing it any earlier would leave the page
            // without one if creating the replacement failed. Swaps are
            // serialized, so this can never be someone else's live context
            // (the mistake that once wedged every context in 'closed'). A
            // failed unlock used to leak one context per attempt, and iOS
            // reloads this page every time it is minimised.
            if (abandoned && abandoned !== ctx && abandoned.state !== 'closed' && abandoned.close) {
                this._createdCtxs = this._createdCtxs.filter(c => c !== abandoned);
                abandoned.close()
                    .then(() => this.logEvent(label + ': closed abandoned context'))
                    .catch(() => {});
            }
            // Every context swap invalidates all Tone nodes built on earlier
            // contexts: a sampler created under the previous context keeps
            // reporting loaded=true but is permanently silent (its nodes live
            // on the abandoned context). Bump the generation so loadInstrument
            // rebuilds stale samplers instead of trusting the cache — the
            // on-device symptom was earcons playing (fresh oscillators on the
            // current context) while note samplers stayed mute.
            this._ctxGen = (this._ctxGen || 0) + 1;
            this._unlockRitual(ctx, tag);
            if (ctx.state !== 'running') {
                await this._raceTimeout(() => ctx.resume(), 1200, tag + ' resume()');
            }
            let waited = 0;
            while (ctx.state !== 'running' && waited < 1200) {
                await new Promise(r => setTimeout(r, 100));
                waited += 100;
            }
            this.logEvent(tag + ' after ' + waited + 'ms poll: ' + ctx.state);
            if (ctx.state === 'running') return true;
        }
        return false;
    }

    // Long-tail recovery. On-device evidence says the "wedge" is really an
    // orphaned audio-session lease that iOS releases on its own after a few
    // MINUTES of it being idle — the user reported audio coming back after
    // leaving the app alone for a while. So don't give up at 30s: keep
    // watching for 5 minutes (2s ticks), re-poking resume + the unlock ritual
    // every few ticks. On success flip ready, clear the error, drop the
    // banner — the app heals itself without the user leaving or reloading.
    _startContextWatchdog() {
        if (this._watchdogTimer) return;
        this.logEvent('context watchdog: started (up to 5min)');
        let ticks = 0;                    // one tick = 2s
        const MAX_TICKS = 150;            // 5 minutes
        this._watchdogTimer = setInterval(() => {
            ticks++;
            const ctx = this._rawCtx || (window.Tone ? Tone.context : null);
            if (!ctx) return;
            if (ctx.state === 'running') {
                clearInterval(this._watchdogTimer);
                this._watchdogTimer = null;
                const loaded = this._usableSamplerCount();
                this.ready = loaded > 0;
                if (this.ready) this.lastAudioError = null;
                this.logEvent('context watchdog: RUNNING after ~' + (ticks * 2) + 's, loaded=' + loaded + ', ready=' + this.ready);
                const banner = document.getElementById('audio_trouble');
                if (banner) banner.remove();
                return;
            }
            // Media-element contention experiment: some iOS builds won't let
            // Web Audio join the session while an <audio> element is actively
            // playing. Pause the looping activator for a window early on and
            // keep poking; if the context flips to running only inside that
            // window, the activator itself is the blocker — the log shows it.
            if (ticks === 3) {
                try {
                    const el = document.getElementById('ios_audio_activator');
                    if (el && !el.paused) { el.pause(); this.logEvent('watchdog: activator paused (contention test)'); }
                } catch (e) {}
            }
            if (ticks === 6) {
                try {
                    const el = document.getElementById('ios_audio_activator');
                    if (el && el.paused) { el.play().catch(() => {}); this.logEvent('watchdog: activator restarted'); }
                } catch (e) {}
            }
            if (ticks % 3 === 0) {
                try {
                    if (ctx.resume) ctx.resume().catch(() => {});
                    this._unlockRitual(ctx, 'watchdog', ticks !== 3);
                } catch (e) {}
            }
            // After the first minute, the honest hint: the lease usually
            // expires within a few minutes, but a reboot always works.
            if (ticks === 30) {
                this.lastAudioError = 'audio-system-wedged (attendi qualche minuto o riavvia il telefono)';
                this._armGestureRecovery();
                const st = document.getElementById('audio_trouble_status');
                if (st && window.audioEngine) st.textContent = this.getAudioStatus();
            }
            if (ticks >= MAX_TICKS) {
                clearInterval(this._watchdogTimer);
                this._watchdogTimer = null;
                this.logEvent('context watchdog: gave up after 5min, state=' + ctx.state);
                this._enableElementFallback('watchdog gave up');
                if (!this.useElementFallback) {
                    this.lastAudioError = 'audio-system-wedged (riavvia il telefono)';
                }
                this._armGestureRecovery();
            }
        }, 2000);
    }

    async unlockAndLoad() {
        if (this._unlocked) {
            this.logEvent('unlockAndLoad: already unlocked, no-op');
            return;
        }
        this._unlocked = true;
        this.logEvent('unlockAndLoad: start, document.visibilityState=' + document.visibilityState);

        // Native shell gets first refusal. If this succeeds we return before
        // touching Tone.js/Web Audio, so the WebKit AudioContext bug is outside
        // the playback architecture rather than something we keep retrying.
        if (this.nativeAudio && this.nativeAudio.isAvailable()) {
            try {
                this._nativeStatus = await this.nativeAudio.initialize();
                this.useNativeAudio = true;
                this.ready = !!this._nativeStatus?.engineRunning;
                this.lastAudioError = this.ready ? null : 'native-audio-not-running';
                this.logEvent('native audio initialized: running=' + this.ready
                    + ', sampleRate=' + (this._nativeStatus?.sampleRate || 'n/a')
                    + ', channels=' + (this._nativeStatus?.outputChannels || 'n/a'));
                if (this.ready) return;
            } catch (e) {
                this.useNativeAudio = false;
                this.lastAudioError = 'native-audio-init: ' + e.message;
                this.logEvent('native audio init THREW — falling back to web engine: ' + e.message);
            }
        }

        if (!window.Tone) {
            this.logEvent('Tone.js unavailable — falling back to WebAudioFont');
            this.useFallback = true;
            this._setupFallbackContext();
            return;
        }

        this.logEvent('unlockAndLoad: page-load context state=' + Tone.context.state);

        // Bless the <audio> pool now, while we are still inside the tap. We
        // do not yet know whether Web Audio will come up, and by the time we
        // find out the gesture is long gone — so this has to be unconditional.
        this._unlockElementPool();

        // ── iOS: session kick FIRST, fresh context SECOND ───────────────────
        // On-device experiments pinned the ordering down precisely:
        //  · The page-load context is permanently unresumable (resume() never
        //    settles, even called synchronously in the tap).
        //  · A fresh context created BEFORE the silence-<audio> activator has
        //    actually started playing is born under the soloAmbient session
        //    and is JUST as unresumable — in-gesture or not.
        //  · The one build that worked created its fresh context seconds
        //    AFTER the activator was playing (session already 'playback').
        // So: start the activator inside the tap (media elements need the
        // gesture; the context does not), wait for it to actually play, and
        // only THEN mint the new AudioContext under the playback session.
        if (Tone.context.state !== 'running') {
            await this._kickAudioSession(1200);   // play() fires synchronously, still in-gesture
            await this._freshContextAfterKick('unlock');

            // Decide here, not after the preload. Tone samplers built on a
            // wedged context can never make a sound, so loading all seven of
            // them first only delays working audio by several seconds — long
            // enough that a device already in the fallback still reported
            // "engine=Tone, samples=0/7" while it was grinding through them.
            // The element engine plays the mp3s directly and needs none of it.
            if (Tone.context.state !== 'running') {
                this._enableElementFallback('unlock: context never reached running');
                if (this.useElementFallback) {
                    this._startContextWatchdog();
                    this._setLoading(false);
                    return;
                }
            }
        } else {
            await this._raceTimeout(() => Tone.start(), 1500, 'Tone.start()');
            // Track the raw context so releaseSession/watchdog can reach it
            // on this path too (on iOS it's set by _freshContextAfterKick).
            try { this._rawCtx = Tone.context.rawContext || null; } catch (e) {}
        }
        // ─────────────────────────────────────────────────────────────────────

        // Build the reverb chain BEFORE loading samples, and regardless of the
        // context state — samplers connect to this.reverb from their onload
        // callbacks, and creating it late left this.reverb null during loads
        // (the "t is not an Object" connect error seen on device).
        this.reverb = new Tone.Reverb({
            decay: 1.8,
            preDelay: 0.01,
            wet: 0.2
        });

        // Lowpass EQ filter for realism and softening the top end
        const eq = new Tone.Filter(8000, "lowpass");
        this.reverb.connect(eq);
        eq.toDestination();

        // Preload current preset sequentially. Loading works even on a
        // suspended context (decodeAudioData doesn't need 'running'), so do it
        // unconditionally — but 'ready' still requires a running context.
        this._setLoading(true);
        for (let i = 0; i < this.channels.length; i++) {
            await this.loadInstrument(this.channels[i]);
        }
        this._setLoading(false);
        const loadedCount = this._usableSamplerCount();
        this.logEvent('sample preload done, loadedCount=' + loadedCount + '/' + this.channels.length
            + ', ctx=' + Tone.context.state);
        if (loadedCount > 0 && Tone.context.state === 'running') {
            this.ready = true;
        } else if (Tone.context.state !== 'running') {
            // Web Audio is wedged. Rather than leave the app silent, switch to
            // the <audio> element path, which keeps working through this (the
            // silence activator plays in every log where the context is dead).
            // The watchdog still runs: if the context frees up later, the next
            // reload gets the better engine back.
            this._enableElementFallback('unlock: context never reached running');
            this._startContextWatchdog();
        } else if (!this.lastAudioError) {
            this.lastAudioError = 'no samples decoded';
        }
    }

    // Switch to <audio> element playback for the rest of this page session.
    // Deliberately sticky: flipping engines mid-session would change how the
    // app sounds from one chord to the next.
    _enableElementFallback(why) {
        if (this.useElementFallback) return;
        const usable = (this._elPool || []).filter(s => !s.dead).length;
        if (!usable) {
            // Nothing was blessed inside a gesture, so element playback would
            // be rejected too. Stay put and report the real problem.
            this.logEvent('elementFallback: no usable elements — cannot switch (' + why + ')');
            this.lastAudioError = 'context-suspended (iOS did not resume audio)';
            return;
        }
        this.useElementFallback = true;
        this.ready = true;
        this.lastAudioError = null;
        this.logEvent('SWITCHING TO HTMLAudio playback (' + usable + ' elements) — ' + why);
        const banner = document.getElementById('audio_trouble');
        if (banner) banner.remove();
    }

    // Manual recovery path for the on-screen "tap to retry" banner. unlockAndLoad()
    // is a no-op once already unlocked, so a stuck-but-unlocked context needs the
    // same rebuild used by the automatic lifecycle handler, not another unlock call.
    async forceRecover() {
        this.logEvent('forceRecover() called, unlocked=' + this._unlocked
            + ', useNativeAudio=' + this.useNativeAudio + ', useFallback=' + this.useFallback);
        if (this.useNativeAudio && this.nativeAudio) {
            try {
                this._nativeStatus = await this.nativeAudio.activate();
                this.ready = !!this._nativeStatus?.engineRunning;
                this.lastAudioError = this.ready ? null : 'native-audio-not-running';
            } catch (e) {
                this.ready = false;
                this.lastAudioError = 'native-audio-recover: ' + e.message;
            }
            return;
        }
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
            st = this.useNativeAudio
                ? (this._nativeStatus?.engineRunning ? 'running' : 'stopped')
                : this.useFallback
                    ? (this.fallbackCtx && this.fallbackCtx.state)
                    : (window.Tone && Tone.context.state);
        } catch (e) {}
        // Count only samplers for the currently active channels (not every
        // instrument ever loaded across preset switches), so the number stays
        // bounded by the channel count and reads as a meaningful ratio.
        const loaded = this._usableSamplerCount();
        const parts = [
            'engine=' + (this.useNativeAudio ? 'NativeAVAudio'
                        : this.useElementFallback ? 'HTMLAudio'
                        : this.useFallback ? 'WebAudioFont'
                        : (window.Tone ? 'Tone' : 'none')),
            'ctx=' + st,
            'ready=' + (!!this.ready),
            this.useNativeAudio
                ? 'nativeCache=' + (this._nativeStatus?.cachedBuffers ?? 'n/a')
                : 'samples=' + loaded + '/' + this.channels.length
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
            if (!this.reverb) {
                // Reverb chain not built yet (load triggered before/outside
                // unlockAndLoad) — wire straight to the output instead of
                // letting connect(null) throw a cryptic WebKit TypeError.
                this.logEvent('loadInstrument(' + name + '): no reverb yet — connecting toDestination()');
                sampler.toDestination();
                return true;
            }
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
        const cached = this.samplers[name];
        if (cached) {
            // Only trust the cache if the sampler was built on the CURRENT
            // context. One from a previous generation still says loaded=true
            // but its nodes live on an abandoned context — silent forever.
            if ((cached._cvGen || 0) === (this._ctxGen || 0)) return cached;
            this.logEvent('loadInstrument(' + name + '): cached sampler is from stale context (gen '
                + (cached._cvGen || 0) + ' ≠ ' + (this._ctxGen || 0) + ') — rebuilding');
            try { cached.dispose(); } catch (e) {}
            delete this.samplers[name];
        }
        
        // Define locally hosted reliable priority samples vs CDN lazy loads
        const SELF_HOSTED = this.SELF_HOSTED;
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
            // Stamp the generation the sampler was built under (checked by the
            // cache above) and cache the instance immediately to avoid
            // duplicate loads from concurrent callers.
            sampler._cvGen = this._ctxGen || 0;
            this.samplers[name] = sampler;
        });
    }

    async applyPreset(name) {
        const progs = this.PRESETS[name];
        if (!progs) return;
        progs.forEach((prog, i) => { this.channels[i] = prog; });
        if (this.useNativeAudio) return;
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
        if (this._unlocked && !this.useNativeAudio) this.loadInstrument(prog);
    }

    // ── HTMLAUDIO FALLBACK ────────────────────────────────────────────────
    // On some iOS devices Web Audio gets wedged system-wide: every
    // AudioContext, including brand-new ones, is born 'suspended' and its
    // resume() promise never settles, and only a device reboot clears it.
    // Through all of it one thing kept working in every on-device log — the
    // silence <audio> element played on demand. HTMLMediaElement playback
    // goes through a different path from Web Audio, so it survives the wedge.
    //
    // This is the escape hatch: play the very same mp3 samples through plain
    // <audio> elements. No reverb and coarser timing than Tone, but it makes
    // a sound, which beats a silent app.

    _sampleBaseUrl(name) {
        return this.SELF_HOSTED.includes(name)
            ? `assets/samples/${name}/`
            : `https://nbrosowsky.github.io/tonejs-instruments/samples/${name}/`;
    }

    _noteNameToMidi(n) {
        const m = String(n).match(/^([A-G])(#|b)?(-?\d+)$/);
        if (!m) return null;
        const semis = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }[m[1]];
        const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
        return semis + acc + (parseInt(m[3], 10) + 1) * 12;
    }

    // Nearest available sample for a pitch, plus the playbackRate that bends
    // it there. Our own sample sets are spaced no more than a whole tone
    // apart, so the shift stays within a semitone and barely alters length.
    _pickSample(instName, midi) {
        const map = this.INSTRUMENT_MAPS[instName] || { 'C4': 'C4.mp3' };
        let best = null, bestDist = Infinity;
        for (const note in map) {
            const nm = this._noteNameToMidi(note);
            if (nm === null) continue;
            const d = Math.abs(nm - midi);
            if (d < bestDist) { bestDist = d; best = { file: map[note], midi: nm }; }
        }
        if (!best) return null;
        return {
            url: this._sampleBaseUrl(instName) + best.file,
            rate: Math.pow(2, (midi - best.midi) / 12)
        };
    }

    _nativeVoice(instName, midi, durationSec, gain, delayMs = 0) {
        const pick = this._pickSample(instName, midi);
        if (!pick) return null;
        return {
            samplePath: pick.url,
            pitchCents: 1200 * Math.log2(pick.rate),
            gain: Math.max(0, Math.min(1, gain)),
            durationSec,
            delayMs
        };
    }

    async _playNativeVoices(voices, label) {
        const playable = voices.filter(Boolean);
        if (!playable.length || !this.nativeAudio) return false;
        try {
            const result = await this.nativeAudio.playVoices(playable);
            this.logEvent(label + ': native scheduled=' + (result?.scheduled ?? playable.length));
            return true;
        } catch (e) {
            this.ready = false;
            this.lastAudioError = 'native-audio-play: ' + e.message;
            this.logEvent(label + ': native playback THREW — ' + e.message);
            return false;
        }
    }

    // iOS only lets an <audio> element be played programmatically once it has
    // been played inside a user gesture. An element stays blessed when its
    // src changes, so we bless a pool up front and then reuse it. This must
    // run synchronously inside the tap — hence it happens at the very start
    // of unlockAndLoad, before we know whether Web Audio will fail at all.
    _unlockElementPool(size = 8) {
        if (this._elPool) return;
        this._elPool = [];
        this._elBlessed = 0;
        this._elRejected = 0;
        try {
            for (let i = 0; i < size; i++) {
                const el = new Audio('assets/silence.wav');
                el.preload = 'auto';
                el.volume = 0;
                const slot = { el, busy: false, until: 0 };
                // Pause only once play() has actually started. Pausing
                // synchronously aborts the play, and an aborted play may not
                // count as the gesture-blessing iOS requires — which would
                // leave the pool useless precisely when it is needed.
                const p = el.play();
                if (p && p.then) {
                    p.then(() => {
                        this._elBlessed++;
                        slot.blessed = true;
                        el.pause();
                        try { el.currentTime = 0; } catch (e) {}
                    }).catch((err) => {
                        // Not blessed by the gesture (or the source failed to
                        // decode) — never hand this one out, it would be mute.
                        this._elRejected++;
                        slot.dead = true;
                        if (this._elRejected === 1) {
                            this.logEvent('HTMLAudio pool: play() rejected — ' + (err && err.name ? err.name : err));
                        }
                    });
                } else {
                    this._elBlessed++;
                    slot.blessed = true;
                    el.pause();
                }
                this._elPool.push(slot);
            }
            this.logEvent('HTMLAudio pool: created ' + size + ' elements');
            // Report the outcome once the play() promises have settled.
            setTimeout(() => this.logEvent('HTMLAudio pool: blessed=' + this._elBlessed
                + ' rejected=' + this._elRejected + '/' + size), 800);
        } catch (e) {
            this.logEvent('HTMLAudio pool unlock THREW: ' + e.message);
        }
    }

    _takeElement() {
        if (!this._elPool) return null;
        const now = Date.now();
        const usable = this._elPool.filter(s => !s.dead);
        if (!usable.length) return null;
        let slot = usable.find(s => !s.busy);
        // All busy: steal the one that has been sounding longest.
        if (!slot) slot = usable.reduce((a, b) => (a.until <= b.until ? a : b));
        if (slot.busy) { try { slot.el.pause(); } catch (e) {} }
        slot.busy = true;
        slot.until = now;
        return slot;
    }

    _playElementNote(instName, midi, durationSec, gain) {
        const pick = this._pickSample(instName, midi);
        const slot = this._takeElement();
        if (!pick || !slot) return;
        const el = slot.el;
        slot.until = Date.now() + durationSec * 1000;
        try {
            if (el.dataset.cvSrc !== pick.url) { el.src = pick.url; el.dataset.cvSrc = pick.url; }
            try { el.currentTime = 0; } catch (e) {}
            // playbackRate must shift pitch, which is the opposite of what
            // browsers do by default for media elements.
            el.preservesPitch = false;
            el.mozPreservesPitch = false;
            el.webkitPreservesPitch = false;
            el.playbackRate = pick.rate;
            const vol = Math.max(0, Math.min(1, gain));
            el.volume = vol;
            const p = el.play();
            if (p && p.catch) {
                p.catch((err) => {
                    if (!this._elNoteErrLogged) {
                        this._elNoteErrLogged = true;
                        this.logEvent('HTMLAudio note play() REJECTED — ' + (err && err.name ? err.name : err));
                    }
                });
            }
            // Once, prove whether the element is really advancing. play()
            // resolving is not proof of sound; currentTime moving is. Also
            // report the volume actually in effect: iOS treats .volume as
            // read-only, so it may not be the value we asked for.
            if (!this._elProbed) {
                this._elProbed = true;
                setTimeout(() => {
                    this.logEvent('HTMLAudio probe: paused=' + el.paused
                        + ' currentTime=' + (el.currentTime || 0).toFixed(2)
                        + ' rate=' + el.playbackRate.toFixed(3)
                        + ' vol=' + el.volume
                        + ' readyState=' + el.readyState
                        + ' src=' + String(el.currentSrc || el.src).split('/').slice(-2).join('/'));
                }, 300);
            }

            // No gain nodes here, so fade by stepping .volume, otherwise the
            // cut-off clicks audibly.
            clearTimeout(slot.stopTimer);
            clearInterval(slot.fadeTimer);
            slot.stopTimer = setTimeout(() => {
                let v = vol;
                slot.fadeTimer = setInterval(() => {
                    v -= vol / 6;
                    if (v <= 0) {
                        clearInterval(slot.fadeTimer);
                        try { el.pause(); el.currentTime = 0; } catch (e) {}
                        slot.busy = false;
                    } else {
                        try { el.volume = Math.max(0, v); } catch (e) {}
                    }
                }, 25);
            }, Math.max(60, durationSec * 1000 - 150));
        } catch (e) {
            slot.busy = false;
            this.logEvent('HTMLAudio note THREW: ' + e.message);
        }
    }

    // Chord playback through the element pool. Timing comes from setTimeout
    // rather than the audio clock, so the onset stagger is approximate — but
    // it is still audible, and it is the feature the app is built around.
    _playChordViaElements(notesArray, dur, vol, chordIdx, volumeMap, spreadSec) {
        notesArray.forEach((item, idx) => {
            const volMult = volumeMap ? (volumeMap[item.voiceIdx] ?? 1.0) : 1.0;
            if (volMult <= 0) return;
            const instName = this.channels[item.voiceIdx];
            if (!instName) return;
            const freq = item.frequency || item.freq;
            const midi = Math.round(69 + 12 * Math.log2(freq / 440));
            const gain = vol * this._channelGain(item.voiceIdx) * volMult;
            const delay = idx * spreadSec * 1000;
            setTimeout(() => this._playElementNote(instName, midi, dur, gain), delay);
            if (window.gui?.highlight) {
                setTimeout(() => window.gui.highlight(item.voiceIdx, freq, dur * 800, chordIdx), delay);
            }
        });
    }

    // Load every sampler a chord needs BEFORE its schedule is fixed.
    //
    // The chord methods used to compute `startTime = Tone.now() + 0.1` and
    // only then await loadInstrument() per voice. Loading takes far longer
    // than that 100ms lead — and takes it on EVERY chord right after a context
    // rebuild, which clears the sampler cache — so by the time the notes were
    // triggered their start time was already in the past. Tone drops notes
    // scheduled in the past, so the chord went silent while the answer earcons
    // (plain oscillators scheduled at the instant they fire, straight to the
    // raw context) kept working. That is exactly the "only the chords stopped"
    // symptom, and why it appeared right after audio seemed to recover.
    //
    // Returns one entry per input note (null where the voice can't sound, so
    // indices — and therefore the onset stagger — stay put), or null if the
    // user moved on while we were loading.
    async _resolveVoices(notesArray, label) {
        const session = window._playbackSessionId;
        const voices = await Promise.all(notesArray.map(async (item) => {
            const instName = this.channels[item.voiceIdx];
            if (!instName) return null;
            const sampler = await this.loadInstrument(instName);
            if (!sampler || !sampler.loaded) return null;
            const freq = item.frequency || item.freq;
            const midi = Math.round(69 + 12 * Math.log2(freq / 440));
            return { item, freq, sampler, note: Tone.Frequency(midi, "midi").toNote() };
        }));
        // Awaiting above opens a window in which the challenge may have changed.
        if (window._playbackSessionId !== session) return null;

        const missing = voices.filter(v => !v).length;
        if (missing) this.logEvent(label + ': ' + missing + '/' + voices.length + ' voci senza campione — non suonano');
        return voices;
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

        if (this.useNativeAudio) {
            const inst = this.channels[channelIdx];
            if (!inst) return;
            const gain = (velocity / 127) * this._getVolume() * this._channelGain(channelIdx);
            await this._playNativeVoices(
                [this._nativeVoice(inst, midiPitch, duration, gain, 0)],
                'playMidi'
            );
            if (window.gui?.highlight) {
                window.gui.highlight(
                    channelIdx,
                    440 * Math.pow(2, (midiPitch - 69) / 12),
                    duration * 1000,
                    chordIdx
                );
            }
            return;
        }

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

        if (this.useElementFallback) {
            const inst = this.channels[channelIdx];
            if (!inst) return;
            const gain = (velocity / 127) * this._getVolume() * this._channelGain(channelIdx);
            this._playElementNote(inst, midiPitch, duration, gain);
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

        if (this.useNativeAudio) {
            const nativeVoices = notesArray.map((item, idx) => {
                const freq = item.frequency || item.freq;
                const midi = Math.round(69 + 12 * Math.log2(freq / 440));
                const inst = this.channels[item.voiceIdx];
                if (!inst) return null;
                return this._nativeVoice(
                    inst,
                    midi,
                    dur,
                    vol * this._channelGain(item.voiceIdx),
                    idx * SPREAD_SEC * 1000
                );
            });
            await this._playNativeVoices(nativeVoices, 'playChord');

            notesArray.forEach((item, idx) => {
                const freq = item.frequency || item.freq;
                if (window.gui?.highlight) {
                    setTimeout(
                        () => window.gui.highlight(item.voiceIdx, freq, dur * 800, chordIdx),
                        idx * SPREAD_SEC * 1000
                    );
                }
            });
            return;
        }

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

        if (this.useElementFallback) {
            this._playChordViaElements(notesArray, dur, vol, chordIdx, null, SPREAD_SEC);
            return;
        }

        if (Tone.context.state !== 'running') await this._ensureContextRunning('playChord');

        const voices = await this._resolveVoices(notesArray, 'playChord');
        if (!voices) return;   // the user moved on while samplers were loading

        const lead = Tone.context.state === 'running' ? 0.1 : 0.4;
        const startTime = Tone.now() + lead;

        voices.forEach((v, idx) => {
            if (!v) return;
            const triggerTime = startTime + idx * SPREAD_SEC;
            v.sampler.triggerAttackRelease(v.note, dur, triggerTime, vol * this._channelGain(v.item.voiceIdx));

            if (window.gui?.highlight) {
                setTimeout(
                    () => window.gui.highlight(v.item.voiceIdx, v.freq, dur * 800, chordIdx),
                    (lead + idx * SPREAD_SEC) * 1000
                );
            }
        });
    }

    stopAll() {
        if (!this._unlocked) return;
        if (this.useNativeAudio && this.nativeAudio) {
            this.nativeAudio.stopAll().catch((e) =>
                this.logEvent('native stopAll THREW: ' + e.message)
            );
            return;
        }
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
        if (this.useNativeAudio && this.nativeAudio?.playTone) {
            this.nativeAudio.playTone(1000, duration, 0.3).catch((e) =>
                this.logEvent('native playClick THREW: ' + e.message)
            );
            return;
        }
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

        if (this.useNativeAudio) {
            const nativeVoices = notesArray.map((item) => {
                const volMult = volumeMap[item.voiceIdx] ?? 1.0;
                if (volMult <= 0) return null;
                const freq = item.frequency || item.freq;
                const midi = Math.round(69 + 12 * Math.log2(freq / 440));
                const inst = this.channels[item.voiceIdx];
                if (!inst) return null;
                return this._nativeVoice(
                    inst,
                    midi,
                    dur,
                    vol * this._channelGain(item.voiceIdx) * volMult,
                    0
                );
            });
            await this._playNativeVoices(nativeVoices, 'playChordWithVolumes');

            notesArray.forEach((item) => {
                const volMult = volumeMap[item.voiceIdx] ?? 1.0;
                if (volMult <= 0) return;
                const freq = item.frequency || item.freq;
                if (window.gui?.highlight) {
                    window.gui.highlight(item.voiceIdx, freq, dur * 800, chordIdx);
                }
            });
            return;
        }

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

        if (this.useElementFallback) {
            this._playChordViaElements(notesArray, dur, vol, chordIdx, volumeMap, SPREAD_SEC);
            return;
        }

        if (Tone.context.state !== 'running') await this._ensureContextRunning('playChordWithVolumes');

        const audible = notesArray.filter(item => (volumeMap[item.voiceIdx] ?? 1.0) > 0);
        const voices = await this._resolveVoices(audible, 'playChordWithVolumes');
        if (!voices) return;   // the user moved on while samplers were loading

        const lead = Tone.context.state === 'running' ? 0.1 : 0.4;
        const startTime = Tone.now() + lead;

        voices.forEach((v, idx) => {
            if (!v) return;
            const volMult = volumeMap[v.item.voiceIdx] ?? 1.0;
            const triggerTime = startTime + idx * SPREAD_SEC;
            v.sampler.triggerAttackRelease(v.note, dur, triggerTime, vol * this._channelGain(v.item.voiceIdx) * volMult);

            if (window.gui?.highlight) {
                setTimeout(
                    () => window.gui.highlight(v.item.voiceIdx, v.freq, dur * 800, chordIdx),
                    (lead + idx * SPREAD_SEC) * 1000
                );
            }
        });
    }
}

window.audioEngine = new AudioEngine();
