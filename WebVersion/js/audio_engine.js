class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.player = new WebAudioFontPlayer();
        
        // GM Instruments map
        this.instrumentPrograms = {
            "Contrabbasso": 43,
            "Violoncello": 42,
            "Fagotto": 70,
            "Corno": 60,
            "Viola": 41,
            "Clarinetto": 71,
            "Flauto": 73,
            "Piano": 0,
            "Chitarra": 24,
            "Violino": 40,
            "Tromba": 56,
            "Sassofono": 65,
            "Organo": 19,
            "Arpa": 46
        };

        this.channels = [43, 42, 56, 60, 41, 71, 73]; // default GM voices: Basso, Cello, Tromba(56), Corno, Viola...
        
        // Load initial
        this.channels.forEach((prog) => this.loadInstrument(prog));
    }

    async loadInstrument(progId, cb) {
        let info = this.player.loader.instrumentInfo(progId);
        if(!info) return;
        this.player.loader.startLoad(this.ctx, info.url, info.variable);
        this.player.loader.waitLoad(function () {
            if(cb) cb();
        });
    }

    setChannelInstrument(channelIdx, instrumentName) {
        if(channelIdx >= 0 && channelIdx < this.channels.length) {
            let prog = this.instrumentPrograms[instrumentName] || 0;
            this.channels[channelIdx] = prog;
            this.loadInstrument(prog);
        }
    }

    playPitch(channelIdx, freq, duration=1.8, chordIdx=null) {
        // Frequency to MIDI Note
        let pitch = Math.round(69 + 12 * Math.log2(freq / 440));
        this.playNote(channelIdx, pitch, 100, duration, chordIdx);
    }

    playNote(channelIdx, midiPitch, velocity=100, duration=1.5, chordIdx=null) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        let prog = this.channels[channelIdx];
        let info = this.player.loader.instrumentInfo(prog);
        if(!info) return;
        
        let preset = window[info.variable]; 
        if (preset) {
            this.player.queueWaveTable(this.ctx, this.ctx.destination, preset, this.ctx.currentTime, midiPitch, duration, velocity/127);
            
            let freq = 440 * Math.pow(2, (midiPitch-69)/12);
            if(window.gui && window.gui.highlight) window.gui.highlight(channelIdx, freq, duration * 1000, chordIdx);
        }
    }

    playChord(notesArray, durationOverride=null, chordIdx=null) {
        let time = this.ctx.currentTime;
        notesArray.forEach((item, idx) => {
            let freq = item.frequency || item.freq;
            let pitch = Math.round(69 + 12 * Math.log2(freq / 440));
            let st = time + 0.1 + (idx * 0.04); // Stagger by 40ms to avoid audio overload/clip
            
            let prog = this.channels[item.voiceIdx];
            let info = this.player.loader.instrumentInfo(prog);
            let preset = window[info.variable]; 
            if(preset) {
                let dur = durationOverride !== null ? durationOverride : 1.87; // ~1.56 * 1.2 for 20% slower
                this.player.queueWaveTable(this.ctx, this.ctx.destination, preset, st, pitch, dur, 0.35); // V=0.35
                
                // Overlay CSS Highlighter async
                if(window.gui && window.gui.highlight) {
                    setTimeout(() => window.gui.highlight(item.voiceIdx, freq, dur * 800, chordIdx), (0.1 + (idx * 0.04)) * 1000);
                }
            }
        });
    }
}

window.audioEngine = new AudioEngine();
