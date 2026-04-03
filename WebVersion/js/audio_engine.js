class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Italian display name → MusyngKite soundfont name
        this.instrumentMap = {
            "Contrabbasso": "contrabass",
            "Violoncello":  "cello",
            "Fagotto":      "bassoon",
            "Corno":        "french_horn",
            "Viola":        "viola",
            "Clarinetto":   "clarinet",
            "Flauto":       "flute",
            "Piano":        "acoustic_grand_piano",
            "Chitarra":     "acoustic_guitar_nylon",
            "Violino":      "violin",
            "Tromba":       "trumpet",
            "Sassofono":    "tenor_sax",
            "Organo":       "church_organ",
            "Arpa":         "orchestral_harp"
        };

        // Kept for gui.js compatibility (Object.keys used to build dropdowns)
        this.instrumentPrograms = Object.fromEntries(
            Object.keys(this.instrumentMap).map((k, i) => [k, i])
        );

        // 7 voice channels — names and loaded instrument objects
        this.channelNames = ["Contrabbasso", "Violoncello", "Tromba", "Corno", "Viola", "Clarinetto", "Flauto"];
        this.instruments  = new Array(7).fill(null);

        this._loadAll();
    }

    _sfName(displayName) {
        return this.instrumentMap[displayName] || 'acoustic_grand_piano';
    }

    async _loadOne(idx, displayName) {
        try {
            this.instruments[idx] = await Soundfont.instrument(this.ctx, this._sfName(displayName), {
                format:    'mp3',
                soundfont: 'MusyngKite'
            });
        } catch(e) {
            console.warn('ClearVoicing: failed to load', displayName, e);
        }
    }

    _loadAll() {
        this.channelNames.forEach((name, i) => this._loadOne(i, name));
    }

    async setChannelInstrument(channelIdx, displayName) {
        if (channelIdx < 0 || channelIdx >= this.channelNames.length) return;
        this.channelNames[channelIdx] = displayName;
        this.instruments[channelIdx] = null;
        await this._loadOne(channelIdx, displayName);
    }

    playPitch(channelIdx, freq, duration = 1.8, chordIdx = null) {
        const midi = Math.round(69 + 12 * Math.log2(freq / 440));
        this.playNote(channelIdx, midi, 100, duration, chordIdx);
    }

    playNote(channelIdx, midiPitch, velocity = 100, duration = 1.5, chordIdx = null) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const inst = this.instruments[channelIdx];
        if (!inst) return;
        inst.play(midiPitch, this.ctx.currentTime, { duration, gain: velocity / 127 });
        const freq = 440 * Math.pow(2, (midiPitch - 69) / 12);
        if (window.gui?.highlight) window.gui.highlight(channelIdx, freq, duration * 1000, chordIdx);
    }

    playChord(notesArray, durationOverride = null, chordIdx = null, staggerMs = 40) {
        const staggerSec = staggerMs / 1000;
        const now = this.ctx.currentTime;
        const dur = durationOverride !== null ? durationOverride : 1.87;

        notesArray.forEach((item, idx) => {
            const freq = item.frequency || item.freq;
            const midi = Math.round(69 + 12 * Math.log2(freq / 440));
            const when = now + 0.1 + idx * staggerSec;

            const inst = this.instruments[item.voiceIdx];
            if (!inst) return;

            inst.play(midi, when, { duration: dur, gain: 0.35 });

            if (window.gui?.highlight) {
                setTimeout(
                    () => window.gui.highlight(item.voiceIdx, freq, dur * 800, chordIdx),
                    (0.1 + idx * staggerSec) * 1000
                );
            }
        });
    }
}

window.audioEngine = new AudioEngine();
