class AudioEngine {
    constructor() {
        // ctx is null until the first user gesture (unlockAndLoad).
        // iOS PWA standalone mode permanently suspends any AudioContext created at
        // page-load time. Creating it inside the gesture is the only reliable fix.
        this.ctx        = null;
        this.masterBus  = null;
        this.reverb     = null;
        this.reverbSend = null;
        this.player     = new WebAudioFontPlayer();
        this._unlocked  = false;

        this.instrumentPrograms = {
            "Contrabbasso": 43,
            "Violoncello":  42,
            "Fagotto":      70,
            "Corno":        60,
            "Viola":        41,
            "Clarinetto":   71,
            "Flauto":       73,
            "Piano":         0,
            "Chitarra":     24,
            "Violino":      40,
            "Tromba":       56,
            "Sassofono":    65,
            "Organo":       19,
            "Arpa":         46
        };

        // 7 voice channels (GM program numbers) — Orchestra default
        this.channels = [43, 42, 70, 60, 41, 71, 73];

        // Per-voice volume balance: bass full, inner voices softer, top voice prominent
        this.voiceBalance = [1.0, 0.80, 0.76, 0.74, 0.76, 0.80, 0.90];

        // Curated timbral presets for 7 voices [Bass, V2, V3, V4, V5, V6, Top]
        this.PRESETS = {
            'Orchestra':    [43, 42, 70, 60, 41, 71, 73],
            'Jazz Combo':   [43, 42, 65, 60, 71, 56,  0],
            'High Contrast':[43, 19, 56, 46, 70, 73, 40],
        };
    }

    // ── Must be called synchronously inside the FIRST user gesture ──────────────
    // Creates AudioContext and audio graph inside the gesture call stack.
    // iOS PWA standalone mode requires this — a context created at page-load
    // can never be resumed reliably, even with a later resume() call.
    unlockAndLoad() {
        if (this._unlocked) return;
        this._unlocked = true;

        // Create context INSIDE gesture — critical for iOS PWA
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Build audio graph synchronously (all graph operations are sync)
        this.masterBus = this.ctx.createGain();
        this.masterBus.gain.value = 1.0;
        this.masterBus.connect(this.ctx.destination);
        this._setupReverb();

        // resume() must stay in the gesture call stack on iOS
        this.ctx.resume()
            .then(() => {
                // Re-decode after ctx is running — decodeAudioData on a suspended
                // ctx silently hangs on iOS Safari
                this.channels.forEach(prog => this._loadProg(prog));
            })
            .catch(() => {});
    }

    _setupReverb() {
        // Synthetic room reverb — exponential-decay noise IR, no external files
        const sr  = this.ctx.sampleRate;
        const len = Math.floor(sr * 1.4);
        const ir  = this.ctx.createBuffer(2, len, sr);
        for (let c = 0; c < 2; c++) {
            const d = ir.getChannelData(c);
            for (let i = 0; i < len; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
            }
        }
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = ir;
        this.reverb.connect(this.ctx.destination);

        this.reverbSend = this.ctx.createGain();
        this.reverbSend.gain.value = 0.18;
        this.masterBus.connect(this.reverbSend);
        this.reverbSend.connect(this.reverb);
    }

    _loadProg(prog) {
        if (!this.ctx) return;
        const num     = String(prog * 10).padStart(4, '0');
        const varName = `_tone_${num}_FluidR3_GM_sf2_file`;
        const url     = `https://surikov.github.io/webaudiofontdata/sound/${num}_FluidR3_GM_sf2_file.js`;
        this.player.loader.startLoad(this.ctx, url, varName);
    }

    applyPreset(name) {
        const progs = this.PRESETS[name];
        if (!progs) return;
        progs.forEach((prog, i) => { this.channels[i] = prog; });
        // If ctx is already initialized (post-gesture), load immediately.
        // Otherwise the channels array is updated and will be loaded in unlockAndLoad().
        if (this.ctx) progs.forEach(prog => this._loadProg(prog));
    }

    setChannelInstrument(channelIdx, instrumentName) {
        if (channelIdx < 0 || channelIdx >= this.channels.length) return;
        const prog = this.instrumentPrograms[instrumentName];
        if (prog === undefined) return;
        this.channels[channelIdx] = prog;
        if (this.ctx) this._loadProg(prog);
    }

    _getPreset(channelIdx) {
        const num = String(this.channels[channelIdx] * 10).padStart(4, '0');
        return window[`_tone_${num}_FluidR3_GM_sf2_file`] || null;
    }

    _getVolume() {
        const sel = document.getElementById('volume_menu');
        return sel ? parseFloat(sel.value) : 0.70;
    }

    playPitch(channelIdx, freq, duration = 1.8, chordIdx = null) {
        if (!this.ctx) return;
        const midi = Math.round(69 + 12 * Math.log2(freq / 440));
        this.playNote(channelIdx, midi, 100, duration, chordIdx);
    }

    playNote(channelIdx, midiPitch, velocity = 100, duration = 1.5, chordIdx = null) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const preset = this._getPreset(channelIdx);
        if (!preset) return;
        const balance = this.voiceBalance[channelIdx] ?? 1.0;
        const gain    = (velocity / 127) * this._getVolume() * balance;
        this.player.queueWaveTable(this.ctx, this.masterBus, preset, this.ctx.currentTime, midiPitch, duration, gain);
        const freq = 440 * Math.pow(2, (midiPitch - 69) / 12);
        if (window.gui?.highlight) window.gui.highlight(channelIdx, freq, duration * 1000, chordIdx);
    }

    playChord(notesArray, durationOverride = null, chordIdx = null) {
        if (!this.ctx) return;
        // resume() synchronous — must remain in user gesture call stack on iOS
        this.ctx.resume();
        const SPREAD_SEC = 0.12;
        const lead       = this.ctx.state === 'running' ? 0.1 : 0.4;
        const now        = this.ctx.currentTime;
        const dur        = durationOverride !== null ? durationOverride : 1.87;
        const vol        = this._getVolume();

        notesArray.forEach((item, idx) => {
            const freq   = item.frequency || item.freq;
            const midi   = Math.round(69 + 12 * Math.log2(freq / 440));
            const preset = this._getPreset(item.voiceIdx);
            if (!preset) return;
            const balance = this.voiceBalance[item.voiceIdx] ?? 1.0;

            this.player.queueWaveTable(this.ctx, this.masterBus, preset,
                now + lead + idx * SPREAD_SEC, midi, dur, vol * balance);

            if (window.gui?.highlight) {
                setTimeout(
                    () => window.gui.highlight(item.voiceIdx, freq, dur * 800, chordIdx),
                    (0.1 + idx * SPREAD_SEC) * 1000
                );
            }
        });
    }
}

window.audioEngine = new AudioEngine();
