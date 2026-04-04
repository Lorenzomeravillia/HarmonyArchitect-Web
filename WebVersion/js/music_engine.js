class MusicEngine {
    constructor() {
        this.stepMap = {'C':0, 'D':1, 'E':2, 'F':3, 'G':4, 'A':5, 'B':6};
        
        // Intervalli cromatici (in semitoni) dalla radice
        this.chordTypes = {
            "maj7": [0, 4, 7, 11],
            "m7": [0, 3, 7, 10],
            "7": [0, 4, 7, 10],
            "m7b5": [0, 3, 6, 10],
            "ø7": [0, 3, 6, 10],
            "dim7": [0, 3, 6, 9],
            "m9": [0, 3, 7, 10, 14],
            "maj9": [0, 4, 7, 11, 14],
            "9": [0, 4, 7, 10, 14],
            "13": [0, 4, 7, 10, 14, 21],
            "7b9": [0, 4, 7, 10, 13],
            "7#9": [0, 4, 7, 10, 15],
            "7#11": [0, 4, 7, 10, 14, 18],
            "7alt": [0, 4, 8, 10, 15], 
            "13b9": [0, 4, 7, 10, 13, 21],
            "m": [0, 3, 7],
            "": [0, 4, 7],
            "dim": [0, 3, 6],
            "aug": [0, 4, 8]
        };
        
        this.notesStr = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
        this.notesStrSharp = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    }
    
    getMidi(noteName, octave) {
        let pcStr = noteName;
        let match = noteName.match(/^([A-G][b#]?)/);
        if(match) pcStr = match[1];
        
        let pc = this.notesStr.indexOf(pcStr);
        if(pc === -1) pc = this.notesStrSharp.indexOf(pcStr);
        
        return (octave + 1) * 12 + pc;
    }
    
    // Determine if a root key should use sharps or flats
    // Sharp keys: G, D, A, E, B, F#, C# (and their enharmonics)
    // Flat keys: F, Bb, Eb, Ab, Db, Gb, Cb
    getSpellingForRoot(rootStr) {
        const sharpRoots = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];
        const flatRoots = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
        if (sharpRoots.includes(rootStr)) return 'sharp';
        if (flatRoots.includes(rootStr)) return 'flat';
        return 'flat'; // C defaults to flat notation
    }
    
    getNoteFromMidi(midi, useSharp) {
        let oct = Math.floor(midi / 12) - 1;
        let pc = midi % 12;
        
        // Choose spelling based on context
        let noteNames;
        if (useSharp) {
            noteNames = this.notesStrSharp; // C C# D D# E F F# G G# A A# B
        } else {
            noteNames = this.notesStr;      // C Db D Eb E F Gb G Ab A Bb B
        }
        
        let name = noteNames[pc];
        let baseLetter = name[0];
        let acc = '';
        if (name.length > 1) {
            acc = name.substring(1); // 'b' or '#'
        }
        let step = oct * 7 + this.stepMap[baseLetter];
        
        return { 
            name: name, 
            oct: oct, 
            chroma: pc, 
            acc: acc, 
            freq: 440 * Math.pow(2, (midi - 69)/12), 
            step: step 
        };
    }
    
    // Normalize roots that produce ugly double-flats or excessively complex spellings.
    // Rules:
    //   Cb → B always (Cb has 7 flats; B has 5 sharps — always simpler)
    //   Gb minor → F# minor (Gb minor produces Bbb; F# minor is clean)
    //   Db minor → C# minor (Db minor produces Fb; C# minor is clean)
    //   Inverse: C# major → Db major, G# major → Ab major (flat keys preferred for major)
    _normalizeRoot(rootStr, typeStr) {
        const isMinor = /^(m|dim|ø|-)[^a-z]?/.test(typeStr) || typeStr === 'm' || typeStr === 'dim' || typeStr === 'dim7' || typeStr === 'm7' || typeStr === 'm7b5' || typeStr === 'm9' || typeStr === 'ø7';

        // Always simpler enharmonics (no musical context needed)
        const always = { 'Cb': 'B', 'B#': 'C', 'E#': 'F', 'Fb': 'E' };
        if (always[rootStr]) return always[rootStr];

        if (isMinor) {
            // Flat roots that produce double-flats in minor → use sharp enharmonic
            const minorFix = { 'Db': 'C#', 'Gb': 'F#' };
            if (minorFix[rootStr]) return minorFix[rootStr];
        } else {
            // Sharp roots for major chords → use standard flat enharmonic
            const majorFix = { 'C#': 'Db', 'G#': 'Ab', 'D#': 'Eb', 'A#': 'Bb' };
            if (majorFix[rootStr]) return majorFix[rootStr];
        }

        return rootStr;
    }

    generateVoicing(symbol, baseOctave="C4", drop2=true, prevVoicing=null) {
        let match = symbol.match(/^([A-G][b#]?)(.*)/);
        if(!match) return [];
        let rootStr = match[1];
        let typeStr = match[2];

        // Normalize to enharmonic equivalent with simpler spelling
        rootStr = this._normalizeRoot(rootStr, typeStr);

        // Determine enharmonic spelling from root
        let spelling = this.getSpellingForRoot(rootStr);
        let useSharp = (spelling === 'sharp');
        
        // Gestisci notazione jazz "-"
        if (typeStr.startsWith("-")) typeStr = typeStr.replace("-", "m");
        
        let intervals = this.chordTypes[typeStr] || [0, 4, 7]; 
        
        let baseOctInt = parseInt(baseOctave[1]);
        let rootMidi = this.getMidi(rootStr, baseOctInt);
        let rootPc = rootMidi % 12;
        
        // Costruisci le altezze MIDI delle note
        let notesMidi = intervals.map(iv => rootMidi + iv);
        
        // ESECUZIONE REGOLA: Evita raddoppi
        notesMidi = notesMidi.filter(m => (m % 12) !== rootPc);
        
        if (drop2 && prevVoicing) {
            let prevTreble = prevVoicing.filter(n => n.voiceIdx > 0).map(n => Math.round(69 + 12 * Math.log2(n.frequency/440)));
            if (prevTreble.length > 0) {
                let avgPrev = prevTreble.reduce((a,b)=>a+b)/prevTreble.length;
                let bestCand = null;
                let minDist = 9999;
                
                for (let octOffset of [-12, 0, 12]) {
                    for (let rot = 0; rot < notesMidi.length; rot++) {
                        let cand = notesMidi.slice();
                        for(let i=0; i<rot; i++) cand[i] += 12;
                        cand.sort((a,b)=>a-b);
                        cand = cand.map(m => m + octOffset);
                        
                        let avgCand = cand.reduce((a,b)=>a+b)/cand.length;
                        let dist = Math.abs(avgCand - avgPrev);
                        
                        if (cand[cand.length-1] > 79 || cand[0] < 50) dist += 200;
                        
                        let topCand = cand[cand.length-1];
                        let topPrev = prevTreble[prevTreble.length-1];
                        dist += Math.abs(topCand - topPrev) * 0.5;
                        
                        if (dist < minDist) { minDist = dist; bestCand = cand.slice(); }
                    }
                }
                if (bestCand) notesMidi = bestCand;
            }
        } else if (drop2 && notesMidi.length >= 4) {
            let dropped = notesMidi.splice(notesMidi.length - 2, 1)[0];
            dropped -= 12;
            notesMidi.unshift(dropped);
        }
        
        while(notesMidi[notesMidi.length-1] > 79) { 
            for(let i=0; i<notesMidi.length; i++) notesMidi[i] -= 12; 
        }
        
        let bassMidi = this.getMidi(rootStr, baseOctInt === 4 ? 3 : 2);
        
        if (bassMidi < 41) bassMidi += 12;
        if (bassMidi > 53) bassMidi -= 12;
        
        notesMidi.unshift(bassMidi);
        
        let result = notesMidi.map((midi, idx) => {
            let noteObj = this.getNoteFromMidi(midi, useSharp);
            let ival = (noteObj.chroma - rootPc + 12) % 12;
            
            // Functional palette — distinct from semantic feedback colors
            let color = "#D946A8"; // Extensions (9, 11, 13) — magenta
            if (ival === 0)                  color = "#4A90D9"; // Root    — blue
            else if (ival === 3 || ival === 4) color = "#2EC4B6"; // Third   — teal
            else if (ival === 7)              color = "#F0B429"; // Fifth   — amber
            else if (ival === 10 || ival === 11) color = "#E8873D"; // Seventh — orange

            return {
                name: noteObj.name,
                step: noteObj.step,
                color: color,
                accidental: noteObj.acc,
                frequency: noteObj.freq,
                voiceIdx: idx
            };
        });
        
        return result;
    }
}

window.musicEngine = new MusicEngine();
