class MusicEngine {
    constructor() {
        // Letter step map: C=0, D=1, E=2, F=3, G=4, A=5, B=6
        this.stepMap = {'C':0, 'D':1, 'E':2, 'F':3, 'G':4, 'A':5, 'B':6};
        this.letters = ['C','D','E','F','G','A','B'];

        // Diatonic semitones between white keys (C-D=2, D-E=2, E-F=1, F-G=2, G-A=2, A-B=2, B-C=1)
        this.diatonicSteps = [0, 2, 4, 5, 7, 9, 11]; // semitones from C for each white key

        // CHORD_SPELL: [semitones_from_root, letter_offset_from_root]
        // letterOffset defines WHICH letter of the staff to use (0=root, 2=third, 4=fifth, 6=seventh, 8=ninth, etc.)
        this.CHORD_SPELL = {
            '':     [[0,0],[4,2],[7,4]],
            'm':    [[0,0],[3,2],[7,4]],
            'dim':  [[0,0],[3,2],[6,4]],
            'aug':  [[0,0],[4,2],[8,4]],
            'maj7': [[0,0],[4,2],[7,4],[11,6]],
            'm7':   [[0,0],[3,2],[7,4],[10,6]],
            '7':    [[0,0],[4,2],[7,4],[10,6]],
            'm7b5': [[0,0],[3,2],[6,4],[10,6]],
            'ø7':   [[0,0],[3,2],[6,4],[10,6]],
            'dim7': [[0,0],[3,2],[6,4],[9,6]],
            'maj9': [[0,0],[4,2],[7,4],[11,6],[14,8]],
            'm9':   [[0,0],[3,2],[7,4],[10,6],[14,8]],
            '9':    [[0,0],[4,2],[7,4],[10,6],[14,8]],
            '13':   [[0,0],[4,2],[7,4],[10,6],[14,8],[21,12]],
            '7alt': [[0,0],[4,2],[6,4],[10,6],[15,8]],
            '7b9':  [[0,0],[4,2],[7,4],[10,6],[13,8]],
            '7#9':  [[0,0],[4,2],[7,4],[10,6],[15,8]],
            '7#11': [[0,0],[4,2],[7,4],[10,6],[14,8],[18,10]],
            '13b9': [[0,0],[4,2],[7,4],[10,6],[13,8],[21,12]],
        };

        // Fallback raw-semitone intervals (used for bass MIDI only)
        this.chordTypes = {
            "maj7": [0,4,7,11], "m7": [0,3,7,10], "7": [0,4,7,10],
            "m7b5": [0,3,6,10], "ø7": [0,3,6,10], "dim7": [0,3,6,9],
            "m9": [0,3,7,10,14], "maj9": [0,4,7,11,14], "9": [0,4,7,10,14],
            "13": [0,4,7,10,14,21], "7b9": [0,4,7,10,13], "7#9": [0,4,7,10,15],
            "7#11": [0,4,7,10,14,18], "7alt": [0,4,8,10,15], "13b9": [0,4,7,10,13,21],
            "m": [0,3,7], "": [0,4,7], "dim": [0,3,6], "aug": [0,4,8]
        };

        this.notesStr      = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
        this.notesStrSharp = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    }

    getMidi(noteName, octave) {
        let match = noteName.match(/^([A-G][b#]?)/);
        let pcStr = match ? match[1] : noteName;
        let pc = this.notesStr.indexOf(pcStr);
        if (pc === -1) pc = this.notesStrSharp.indexOf(pcStr);
        return (octave + 1) * 12 + pc;
    }

    // Given a note name like "Bb" or "F#", return its pitch-class (0-11)
    _noteNameToPC(name) {
        let pc = this.notesStr.indexOf(name);
        if (pc === -1) pc = this.notesStrSharp.indexOf(name);
        return pc;
    }

    // Spell a chord note diatonically.
    // rootStr: "G", semitones: interval above root, letterOffset: 0,2,4,6,8,10,12
    // Returns { name, acc, step (diatonic), pc (0-11) }
    spellNoteDiatonic(rootStr, semitones, letterOffset) {
        const rootLetter = rootStr[0];
        const rootAcc    = rootStr.slice(1);   // 'b', '#', or ''
        const rootStep   = this.stepMap[rootLetter];  // 0-6

        // Root pitch class
        const rootPC = this._noteNameToPC(rootStr);

        // Target letter index (mod 7)
        const targetStep   = (rootStep + letterOffset) % 7;
        const targetLetter = this.letters[targetStep];

        // Natural semitones of target letter above C
        const targetNatPC = this.diatonicSteps[targetStep];
        // Natural semitones of root letter above C
        const rootNatPC   = this.diatonicSteps[rootStep];

        // Root's own accidental shifts what is "natural" for the interval
        // e.g., root=Eb: its natural = E (one too high), so the natural interval is 1 more than letter-only
        const rootAccOffset = rootAcc === '#' ? 1 : rootAcc === 'b' ? -1 : 0;

        // Natural semitones between root (incl. accidental) and target letter (ignoring octave)
        // = (target white-key pitch) - (root white-key pitch + root accidental)
        let naturalInterval = (targetNatPC - rootNatPC - rootAccOffset + 24) % 12;

        // Needed actual interval (reduce to 0-11)
        const neededInterval = ((semitones % 12) + 12) % 12;

        // Accidental needed
        let accDiff = neededInterval - naturalInterval;
        // Normalise to -2..+2
        if (accDiff >  6) accDiff -= 12;
        if (accDiff < -6) accDiff += 12;

        let acc = '';
        if (accDiff === 1)  acc = '#';
        else if (accDiff === 2)  acc = '##';
        else if (accDiff === -1) acc = 'b';
        else if (accDiff === -2) acc = 'bb';

        // For double accidentals use enharmonic simplification
        if (acc === '##' || acc === 'bb') {
            // Fall back to chromatic spelling (choose best enharmonic)
            const pc = (rootPC + semitones) % 12;
            const rootUseSharp = ['G','D','A','E','B','F#','C#','G#','D#','A#'].includes(rootStr);
            const nameList = rootUseSharp ? this.notesStrSharp : this.notesStr;
            const simpleName = nameList[pc];
            const simpLetter = simpleName[0];
            const simpAcc    = simpleName.slice(1);
            const simpStep   = this.stepMap[simpLetter];
            return {
                name: simpleName,
                acc: simpAcc,
                step: simpStep  // just the letter step — octave added later
            };
        }

        return {
            name: targetLetter + acc,
            acc: acc,
            step: this.stepMap[targetLetter]
        };
    }

    getSpellingForRoot(rootStr) {
        const sharpRoots = ['G','D','A','E','B','F#','C#','G#','D#','A#'];
        const flatRoots  = ['F','Bb','Eb','Ab','Db','Gb','Cb'];
        if (sharpRoots.includes(rootStr)) return 'sharp';
        if (flatRoots.includes(rootStr))  return 'flat';
        return 'flat';
    }

    getNoteFromMidi(midi, useSharp) {
        let oct = Math.floor(midi / 12) - 1;
        let pc  = midi % 12;
        let noteNames = useSharp ? this.notesStrSharp : this.notesStr;
        let name = noteNames[pc];
        let baseLetter = name[0];
        let acc = name.length > 1 ? name.substring(1) : '';
        let step = oct * 7 + this.stepMap[baseLetter];
        return { name, oct, chroma: pc, acc, freq: 440 * Math.pow(2,(midi-69)/12), step };
    }

    _normalizeRoot(rootStr, typeStr) {
        const isMinor = (typeStr.startsWith('m') && !typeStr.startsWith('maj')) ||
                        typeStr.startsWith('dim') || typeStr.startsWith('ø') || typeStr.startsWith('-');
        const always = { 'Cb': 'B', 'B#': 'C', 'E#': 'F', 'Fb': 'E' };
        if (always[rootStr]) return always[rootStr];

        let preferFlat = false;
        let preferSharp = false;
        if (typeof window !== 'undefined' && window.currentKeyContext && window.currentKeyContext.root) {
            let spell = this.getSpellingForRoot(window.currentKeyContext.root);
            if (spell === 'flat') preferFlat = true;
            if (spell === 'sharp') preferSharp = true;
        }

        if (isMinor) {
            if (preferFlat && ['Db', 'Gb', 'Ab'].includes(rootStr)) return rootStr;
            const minorFix = { 'Db': 'C#', 'Gb': 'F#', 'Ab': 'G#' };
            if (minorFix[rootStr]) return minorFix[rootStr];
        } else {
            if (preferSharp && ['C#', 'G#', 'D#', 'A#'].includes(rootStr)) return rootStr;
            const majorFix = { 'C#': 'Db', 'G#': 'Ab', 'D#': 'Eb', 'A#': 'Bb' };
            if (majorFix[rootStr]) return majorFix[rootStr];
        }
        return rootStr;
    }

    // Returns { sharps: [...], flats: [...] } for any root+quality string
    // Used by gui.js to draw the key signature in Progression mode.
    getKeySignature(rootStr, isMajor) {
        const major = {
            'C':  {sharps:[],         flats:[]},
            'G':  {sharps:['F'],      flats:[]},
            'D':  {sharps:['F','C'],  flats:[]},
            'A':  {sharps:['F','C','G'], flats:[]},
            'E':  {sharps:['F','C','G','D'], flats:[]},
            'B':  {sharps:['F','C','G','D','A'], flats:[]},
            'F#': {sharps:['F','C','G','D','A','E'], flats:[]},
            'F':  {sharps:[], flats:['B']},
            'Bb': {sharps:[], flats:['B','E']},
            'Eb': {sharps:[], flats:['B','E','A']},
            'Ab': {sharps:[], flats:['B','E','A','D']},
            'Db': {sharps:[], flats:['B','E','A','D','G']},
            'Gb': {sharps:[], flats:['B','E','A','D','G','C']},
        };
        // Minor → relative major
        const minorToMajor = {
            'A':'C', 'E':'G', 'B':'D', 'F#':'A', 'C#':'E', 'G#':'B',
            'D':'F', 'G':'Bb', 'C':'Eb', 'F':'Ab', 'Bb':'Db', 'Eb':'Gb',
            // enharmonic equivalents
            'D#':'E', 'A#':'F#',
        };
        if (isMajor) {
            return major[rootStr] || {sharps:[], flats:[]};
        } else {
            const relMajor = minorToMajor[rootStr] || 'C';
            return major[relMajor] || {sharps:[], flats:[]};
        }
    }

    generateVoicing(symbol, baseOctave="C4", drop2=true, prevVoicing=null) {
        let match = symbol.match(/^([A-G][b#]?)(.*)/);
        if(!match) return [];
        let rootStr = match[1];
        let typeStr = match[2];

        // Normalize enharmonic root
        rootStr = this._normalizeRoot(rootStr, typeStr);

        // Handle jazz "-" notation
        if (typeStr.startsWith("-")) typeStr = typeStr.replace("-","m");

        let baseOctInt = parseInt(baseOctave[1]);
        let rootMidi   = this.getMidi(rootStr, baseOctInt);
        let rootPC     = rootMidi % 12;

        // Get diatonic spelling table for this chord type
        const spellTable = this.CHORD_SPELL[typeStr];

        let notesMidi, spelledNotes;

        if (spellTable) {
            // Build notes using diatonic spelling
            notesMidi   = spellTable.map(([iv]) => rootMidi + iv);
            spelledNotes = spellTable.map(([iv, lo]) => this.spellNoteDiatonic(rootStr, iv, lo));
        } else {
            // Fallback to raw semitones
            const rawIntervals = this.chordTypes[typeStr] || [0,4,7];
            notesMidi   = rawIntervals.map(iv => rootMidi + iv);
            spelledNotes = null; // computed later from MIDI
        }

        // Remove root doublings
        const beforeFilter = notesMidi.slice();
        const filterMask = notesMidi.map(m => (m % 12) !== rootPC);
        notesMidi   = notesMidi.filter((_,i) => filterMask[i]);
        if (spelledNotes) spelledNotes = spelledNotes.filter((_,i) => filterMask[i]);
        // Note: index 0 is always root so keep it — filterMask[0] should be true

        // ── Drop-2 or voice-leading optimisation ────────────────
        if (drop2 && prevVoicing) {
            let prevTreble = prevVoicing.filter(n => n.voiceIdx > 0).map(n => Math.round(69 + 12 * Math.log2(n.frequency/440)));
            if (prevTreble.length > 0) {
                let avgPrev = prevTreble.reduce((a,b)=>a+b)/prevTreble.length;
                let bestCand = null, bestSp = null, minDist = 9999;

                for (let octOffset of [-12, 0, 12]) {
                    for (let rot = 0; rot < notesMidi.length; rot++) {
                        let cand = notesMidi.slice();
                        let candSp = spelledNotes ? spelledNotes.slice() : null;
                        for(let i=0; i<rot; i++) cand[i] += 12;
                        // sort together
                        let combined = cand.map((m,i) => ({m, sp: candSp ? candSp[i] : null}));
                        combined.sort((a,b)=>a.m-b.m);
                        cand = combined.map(c => c.m + octOffset);
                        if (candSp) candSp = combined.map(c => c.sp);

                        let avgCand = cand.reduce((a,b)=>a+b)/cand.length;
                        let dist = Math.abs(avgCand - avgPrev);
                        if (cand[cand.length-1] > 79 || cand[0] < 50) dist += 200;
                        let topCand = cand[cand.length-1];
                        let topPrev = prevTreble[prevTreble.length-1];
                        dist += Math.abs(topCand - topPrev) * 0.5;
                        if (dist < minDist) { minDist = dist; bestCand = cand.slice(); bestSp = candSp ? candSp.slice() : null; }
                    }
                }
                if (bestCand) { notesMidi = bestCand; if (bestSp) spelledNotes = bestSp; }
            }
        } else if (drop2 && notesMidi.length >= 3) {
            // Simple Drop-2: lower the 2nd from top by an octave
            let idx = notesMidi.length - 2;
            notesMidi[idx] -= 12;
            // Re-sort
            let combined = notesMidi.map((m,i) => ({m, sp: spelledNotes ? spelledNotes[i] : null}));
            combined.sort((a,b)=>a.m-b.m);
            notesMidi    = combined.map(c => c.m);
            if (spelledNotes) spelledNotes = combined.map(c => c.sp);
        }

        // Clamp top note (A5 max, first ledger line)
        while(notesMidi[notesMidi.length-1] > 81) {
            for(let i=0; i<notesMidi.length; i++) notesMidi[i] -= 12;
            if (spelledNotes) for(let i=0; i<spelledNotes.length; i++) spelledNotes[i].oct -= 1;
        }

        // Gently clamp bottom only if doing so won't push the top note out of bounds
        while(notesMidi[0] < 55 && notesMidi[notesMidi.length-1] + 12 <= 81) {
            for(let i=0; i<notesMidi.length; i++) notesMidi[i] += 12;
            if (spelledNotes) for(let i=0; i<spelledNotes.length; i++) spelledNotes[i].oct += 1;
        }

        // ── Bass note (root, always below upper voices) ───────────
        let bassMidi = this.getMidi(rootStr, baseOctInt === 4 ? 3 : 2);
        // Clamp bass between C2 (48) and C3 (60) as requested by user
        while (bassMidi < 48) bassMidi += 12;
        while (bassMidi > 60) bassMidi -= 12;
        
        // Ensure bass is strictly below the actual voicing
        while (bassMidi >= notesMidi[0]) bassMidi -= 12;

        notesMidi.unshift(bassMidi);
        if (spelledNotes) {
            // Bass is always root
            spelledNotes.unshift({ name: rootStr, acc: rootStr.slice(1), step: this.stepMap[rootStr[0]] });
        }

        // ── Build result array ────────────────────────────────────
        let useSharp = (this.getSpellingForRoot(rootStr) === 'sharp');
        let result = notesMidi.map((midi, idx) => {
            let octave = Math.floor(midi / 12) - 1;
            let pc = midi % 12;
            let freq = 440 * Math.pow(2, (midi-69)/12);
            let ival = (pc - rootPC + 12) % 12;

            let name, acc, step;

            if (spelledNotes && spelledNotes[idx]) {
                const sp = spelledNotes[idx];
                name = sp.name;
                acc  = sp.acc;
                // Compute proper octave-aware step
                const baseLetterStep = this.stepMap[sp.name[0]];
                step = octave * 7 + baseLetterStep;
            } else {
                // Fallback: raw MIDI spelling
                const noteObj = this.getNoteFromMidi(midi, useSharp);
                name = noteObj.name;
                acc  = noteObj.acc;
                step = noteObj.step;
            }

            // Functional color palette
            let color = "#D946A8"; // Extensions — magenta
            if (ival === 0) color = "#4A90D9";
            else if (ival === 3 || ival === 4) {
                color = (ival === 3 && (typeStr.includes('alt') || typeStr.includes('#9'))) ? "#D946A8" : "#2EC4B6";
            }
            else if (ival === 6 || ival === 7 || ival === 8) {
                color = (ival === 6 && typeStr.includes('#11')) ? "#D946A8" : "#F0B429";
            }
            else if (ival === 9 || ival === 10 || ival === 11) color = "#E8873D";

            return { name, step, color, accidental: acc, frequency: freq, voiceIdx: idx };
        });

        return result;
    }
}

window.musicEngine = new MusicEngine();
