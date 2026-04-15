class AudioEngine {
    constructor() {
        this._unlocked  = false;
        
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

        // 7 voice channels mapped to instrument names Default
        this.channels = ["bass-electric", "piano", "trumpet", "harp", "bassoon", "flute", "violin"];

        // Per-voice volume balance
        this.voiceBalance = [1.0, 0.80, 0.76, 0.74, 0.76, 0.80, 0.90];

        // Presets [Bass, V2, V3, V4, V5, V6, Top]
        this.PRESETS = {
            'Orchestra':    ["contrabass", "cello", "bassoon", "french-horn", "violin", "clarinet", "flute"],
            'Jazz Combo':   ["contrabass", "cello", "saxophone", "french-horn", "clarinet", "trumpet", "piano"],
            'Clear Mix':    ["bass-electric", "piano", "trumpet", "harp", "bassoon", "flute", "piano"],
        };
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
        if (this._unlocked) return;
        this._unlocked = true;

        if (!window.Tone) {
            console.warn("Tone.js unavailable. Falling back to WebAudioFont.");
            this.useFallback = true;
            this._setupFallbackContext();
            return;
        }

        if (Tone.context.state !== 'running') {
            try { await Tone.context.resume(); } catch(e){}
        }

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
        this._setLoading(true);
        for (let i = 0; i < this.channels.length; i++) {
            await this.loadInstrument(this.channels[i]);
        }
        this._setLoading(false);
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

        return new Promise((resolve) => {
            const sampler = new Tone.Sampler({
                urls: this.INSTRUMENT_MAPS[name] || { "C4": "C4.mp3" },
                baseUrl: baseUrl,
                onload: () => {
                    this.samplers[name] = sampler;
                    sampler.connect(this.reverb);
                    resolve(sampler);
                },
                onerror: () => {
                    // Fail gracefully
                    this.samplers[name] = sampler;
                    sampler.connect(this.reverb);
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
            const balance = this.voiceBalance[channelIdx] ?? 1.0;
            const gain    = (velocity / 127) * this._getVolume() * balance;
            this.player.queueWaveTable(this.fallbackCtx, this.masterBus, preset, this.fallbackCtx.currentTime, midiPitch, duration, gain);
            if (window.gui?.highlight) window.gui.highlight(channelIdx, 440 * Math.pow(2, (midiPitch - 69) / 12), duration * 1000, chordIdx);
            return;
        }

        // Tone.js Standard Execution
        if (Tone.context.state !== 'running') {
            try { await Tone.context.resume(); } catch(e){}
        }
        
        const instName = this.channels[channelIdx];
        if (!instName) return;
        
        const sampler = await this.loadInstrument(instName);
        if (!sampler || !sampler.loaded) return;
        
        const balance = this.voiceBalance[channelIdx] ?? 1.0;
        const gain = (velocity / 127) * this._getVolume() * balance;
        
        const freq = Tone.Frequency(midiPitch, "midi").toNote();
        
        sampler.triggerAttackRelease(freq, duration, Tone.now(), gain);
        
        if (window.gui?.highlight) {
            window.gui.highlight(channelIdx, 440 * Math.pow(2, (midiPitch - 69) / 12), duration * 1000, chordIdx);
        }
    }

    async playChord(notesArray, durationOverride = null, chordIdx = null) {
        if (!this._unlocked) return;

        const SPREAD_SEC = 0;
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
                const balance = this.voiceBalance[item.voiceIdx] ?? 1.0;

                this.player.queueWaveTable(this.fallbackCtx, this.masterBus, preset,
                    now + lead + idx * SPREAD_SEC, midi, dur, vol * balance);

                if (window.gui?.highlight) {
                    setTimeout(() => window.gui.highlight(item.voiceIdx, freq, dur * 800, chordIdx), (0.1 + idx * SPREAD_SEC) * 1000);
                }
            });
            return;
        }

        if (Tone.context.state !== 'running') {
            try { await Tone.context.resume(); } catch(e){}
        }
        
        const lead = Tone.context.state === 'running' ? 0.1 : 0.4;
        const startTime = Tone.now() + lead;
        
        notesArray.forEach(async (item, idx) => {
            const freq = item.frequency || item.freq;
            const midi = Math.round(69 + 12 * Math.log2(freq / 440));
            const instName = this.channels[item.voiceIdx];
            if (!instName) return;
            
            const sampler = await this.loadInstrument(instName);
            if (!sampler || !sampler.loaded) return;
            
            const balance = this.voiceBalance[item.voiceIdx] ?? 1.0;
            const noteObj = Tone.Frequency(midi, "midi").toNote();
            
            const triggerTime = startTime + idx * SPREAD_SEC;
            sampler.triggerAttackRelease(noteObj, dur, triggerTime, vol * balance);
            
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
                const balance = this.voiceBalance[item.voiceIdx] ?? 1.0;

                this.player.queueWaveTable(this.fallbackCtx, this.masterBus, preset,
                    now + lead + idx * SPREAD_SEC, midi, dur, vol * balance * volMult);

                if (window.gui?.highlight) {
                    setTimeout(() => window.gui.highlight(item.voiceIdx, freq, dur * 800, chordIdx), (0.1 + idx * SPREAD_SEC) * 1000);
                }
            });
            return;
        }

        if (Tone.context.state !== 'running') {
            try { await Tone.context.resume(); } catch(e){}
        }
        
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
            
            const balance = this.voiceBalance[item.voiceIdx] ?? 1.0;
            const noteObj = Tone.Frequency(midi, "midi").toNote();
            
            const triggerTime = startTime + idx * SPREAD_SEC;
            sampler.triggerAttackRelease(noteObj, dur, triggerTime, vol * balance * volMult);
            
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
