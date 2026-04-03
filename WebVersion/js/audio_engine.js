class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.player = new WebAudioFontPlayer();

        // FluidR3_GM presets — significantly better quality than default WebAudioFont presets.
        // Scripts are loaded via <script> injection (not XHR), which is iOS Safari compatible.
        // URL format: https://surikov.github.io/webaudiofontdata/sound/{var}.js
        // Variable format: _tone_{NNNN}_FluidR3_GM_sf2_file (NNNN = zero-padded GM program)
        this.instrumentDefs = {
            "Contrabbasso": { prog: 43, sfVar: "_tone_0043_FluidR3_GM_sf2_file" },
            "Violoncello":  { prog: 42, sfVar: "_tone_0042_FluidR3_GM_sf2_file" },
            "Fagotto":      { prog: 70, sfVar: "_tone_0070_FluidR3_GM_sf2_file" },
            "Corno":        { prog: 60, sfVar: "_tone_0060_FluidR3_GM_sf2_file" },
            "Viola":        { prog: 41, sfVar: "_tone_0041_FluidR3_GM_sf2_file" },
            "Clarinetto":   { prog: 71, sfVar: "_tone_0071_FluidR3_GM_sf2_file" },
            "Flauto":       { prog: 73, sfVar: "_tone_0073_FluidR3_GM_sf2_file" },
            "Piano":        { prog:  0, sfVar: "_tone_0000_FluidR3_GM_sf2_file" },
            "Chitarra":     { prog: 24, sfVar: "_tone_0024_FluidR3_GM_sf2_file" },
            "Violino":      { prog: 40, sfVar: "_tone_0040_FluidR3_GM_sf2_file" },
            "Tromba":       { prog: 56, sfVar: "_tone_0056_FluidR3_GM_sf2_file" },
            "Sassofono":    { prog: 65, sfVar: "_tone_0065_FluidR3_GM_sf2_file" },
            "Organo":       { prog: 19, sfVar: "_tone_0019_FluidR3_GM_sf2_file" },
            "Arpa":         { prog: 46, sfVar: "_tone_0046_FluidR3_GM_sf2_file" }
        };

        // Kept for gui.js compatibility — Object.keys() builds the instrument dropdowns
        this.instrumentPrograms = Object.fromEntries(
            Object.keys(this.instrumentDefs).map(k => [k, this.instrumentDefs[k].prog])
        );

        // 7 voice channels
        this.channelNames = ["Contrabbasso", "Violoncello", "Tromba", "Corno", "Viola", "Clarinetto", "Flauto"];
        this._loaded = false;
    }

    _loadDef(def) {
        const url = "https://surikov.github.io/webaudiofontdata/sound/" + def.sfVar + ".js";
        this.player.loader.startLoad(this.ctx, url, def.sfVar);
    }

    // Call once on first user gesture.
    // iOS requires: (1) a real BufferSource played synchronously + (2) ctx.resume().
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
            this.channelNames.forEach(name => {
                const def = this.instrumentDefs[name];
                if (def) this._loadDef(def);
            });
        });
    }

    setChannelInstrument(channelIdx, instrumentName) {
        if (channelIdx < 0 || channelIdx >= this.channelNames.length) return;
        this.channelNames[channelIdx] = instrumentName;
        const def = this.instrumentDefs[instrumentName];
        if (def) this._loadDef(def);
    }

    _getPreset(channelIdx) {
        const def = this.instrumentDefs[this.channelNames[channelIdx]];
        return def ? (window[def.sfVar] || null) : null;
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
        const SPREAD_SEC = 0.12; // 120ms fixed spread — voices enter sequentially, sustain together
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
