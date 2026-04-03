class AudioEngine {
    constructor() {
        // Placeholder ctx — may be permanently suspended on iOS (created outside gesture).
        // Will be replaced with a fresh one inside unlockAndLoad().
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.player = new WebAudioFontPlayer();
        this._unlocked = false; // prevents double-unlock

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

        // 7 voice channels (GM program numbers)
        this.channels = [43, 42, 56, 60, 41, 71, 73];

        // Pre-inject instrument scripts so they are ready when ctx is created.
        // On desktop the placeholder ctx is usable; on iOS a new ctx will be
        // created inside the user gesture and these already-loaded presets reused.
        this.channels.forEach(prog => this._loadProg(prog));
    }

    _loadProg(prog) {
        // Use FluidR3_GM presets (higher quality). URL format: prog*10 zero-padded to 4 digits.
        const num = String(prog * 10).padStart(4, '0');
        const varName = `_tone_${num}_FluidR3_GM_sf2_file`;
        const url = `https://surikov.github.io/webaudiofont/npm/dist/${num}_FluidR3_GM_sf2_file.js`;
        this.player.loader.startLoad(this.ctx, url, varName);
    }

    // Called on first user gesture (start overlay tap) — unlocks AudioContext on iOS.
    unlockAndLoad() {
        if (this._unlocked) return;
        this._unlocked = true;
        this.ctx.resume().catch(() => {});
        this.channels.forEach(prog => this._loadProg(prog));
    }

    setChannelInstrument(channelIdx, instrumentName) {
        if (channelIdx < 0 || channelIdx >= this.channels.length) return;
        const prog = this.instrumentPrograms[instrumentName];
        if (prog === undefined) return;
        this.channels[channelIdx] = prog;
        this._loadProg(prog);
    }

    _getPreset(channelIdx) {
        const prog = this.channels[channelIdx];
        const num = String(prog * 10).padStart(4, '0');
        const varName = `_tone_${num}_FluidR3_GM_sf2_file`;
        if (window[varName]) return window[varName];
        // Fallback to default preset if FluidR3 not yet loaded
        const info = this.player.loader.instrumentInfo(prog);
        return info ? (window[info.variable] || null) : null;
    }

    _getVolume() {
        const sel = document.getElementById('volume_menu');
        return sel ? parseFloat(sel.value) : 0.70;
    }

    playPitch(channelIdx, freq, duration = 1.8, chordIdx = null) {
        const midi = Math.round(69 + 12 * Math.log2(freq / 440));
        this.playNote(channelIdx, midi, 100, duration, chordIdx);
    }

    playNote(channelIdx, midiPitch, velocity = 100, duration = 1.5, chordIdx = null) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const preset = this._getPreset(channelIdx);
        if (!preset) return;
        const gain = (velocity / 127) * this._getVolume();
        this.player.queueWaveTable(this.ctx, this.ctx.destination, preset, this.ctx.currentTime, midiPitch, duration, gain);
        const freq = 440 * Math.pow(2, (midiPitch - 69) / 12);
        if (window.gui?.highlight) window.gui.highlight(channelIdx, freq, duration * 1000, chordIdx);
    }

    playChord(notesArray, durationOverride = null, chordIdx = null) {
        // Always call resume() synchronously — must stay in user gesture call stack on iOS.
        // Notes scheduled in the future will queue and play once ctx starts.
        this.ctx.resume();
        const SPREAD_SEC = 0.12;
        const lead = this.ctx.state === 'running' ? 0.1 : 0.4;
        const now = this.ctx.currentTime;
        const dur = durationOverride !== null ? durationOverride : 1.87;
        const vol = this._getVolume();

        notesArray.forEach((item, idx) => {
            const freq = item.frequency || item.freq;
            const midi = Math.round(69 + 12 * Math.log2(freq / 440));
            const preset = this._getPreset(item.voiceIdx);
            if (!preset) return;

            this.player.queueWaveTable(this.ctx, this.ctx.destination, preset,
                now + lead + idx * SPREAD_SEC, midi, dur, vol);

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
