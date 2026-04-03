class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.player = new WebAudioFontPlayer();

        // instrumentPrograms kept for gui.js compatibility (builds dropdown list)
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
        this._loaded = false;

        // Pre-load instrument info using the player's own resolver (correct URLs guaranteed)
        this.channels.forEach(prog => this._loadProg(prog));
    }

    _loadProg(prog) {
        const info = this.player.loader.instrumentInfo(prog);
        if (info) this.player.loader.startLoad(this.ctx, info.url, info.variable);
    }

    // Call once on first user gesture.
    // iOS requires: synchronous silent BufferSource + ctx.resume().
    unlockAndLoad() {
        if (this._loaded) return;
        this._loaded = true;

        // Synchronous silent buffer — iOS canonical audio unlock
        try {
            const buf = this.ctx.createBuffer(1, 1, 22050);
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            src.connect(this.ctx.destination);
            src.start(0);
        } catch(e) {}

        this.ctx.resume().then(() => {
            // Re-trigger loading after context is running (iOS needs this)
            this.channels.forEach(prog => this._loadProg(prog));
        });
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
        const SPREAD_SEC = 0.12; // 120ms fixed spread
        const now = this.ctx.currentTime;
        const dur = durationOverride !== null ? durationOverride : 1.87;
        const vol = this._getVolume();

        notesArray.forEach((item, idx) => {
            const freq = item.frequency || item.freq;
            const midi = Math.round(69 + 12 * Math.log2(freq / 440));
            const when = now + 0.1 + idx * SPREAD_SEC;
            const preset = this._getPreset(item.voiceIdx);
            if (!preset) return;

            this.player.queueWaveTable(this.ctx, this.ctx.destination, preset, when, midi, dur, vol);

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
