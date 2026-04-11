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
        // Disabilitata forzatura enarmonica: i docenti richiedono una rappresentazione
        // intatta e corretta (se ha tanti diesis/bemolli, DEVE tenere i suoi diesis/bemolli).
        const always = { 'Cb': 'Cb', 'B#': 'C', 'E#': 'F', 'Fb': 'E' };
        if (always[rootStr] && rootStr !== 'Cb') return always[rootStr];
        
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

        const spellTable = this.CHORD_SPELL[typeStr];
        let notesMidi, spelledNotes;

        if (spellTable) {
            notesMidi   = spellTable.map(([iv]) => rootMidi + iv);
            spelledNotes = spellTable.map(([iv, lo]) => this.spellNoteDiatonic(rootStr, iv, lo));
        } else {
            const rawIntervals = this.chordTypes[typeStr] || [0,4,7];
            notesMidi   = rawIntervals.map(iv => rootMidi + iv);
            spelledNotes = null;
        }

        // ── 0. Smart Jazz Density Manager (Pedagogical 4-Part Structure) ──────────
        // Equalizziamo la struttura per tendere a 4 voci superiori costanti.
        let upperMidi = notesMidi.slice();
        let upperSp = spelledNotes ? spelledNotes.slice() : null;

        // A. Se l'accordo è troppo denso (> 4 voci, es. 9th, 13th), sfoltiamo dalla Root (Rootless)
        if (upperMidi.length > 4) {
            let rootIdx = upperMidi.findIndex(m => (m % 12) === rootPC);
            if (rootIdx !== -1) {
                upperMidi.splice(rootIdx, 1);
                if (upperSp) upperSp.splice(rootIdx, 1);
            }
        }
        
        // B. Se è ancora > 4 voci, sacrifichiamo la QUINTA GIUSTA (Regola d'oro del Jazz)
        // Mai sacrificare le Guide Tones (Terza e Settima).
        if (upperMidi.length > 4) {
            let fifthIdx = upperMidi.findIndex(m => (m % 12) === (rootPC + 7) % 12);
            if (fifthIdx !== -1) {
                upperMidi.splice(fifthIdx, 1);
                if (upperSp) upperSp.splice(fifthIdx, 1);
            }
        }

        // C. Fallback di sicurezza per accordi anomali estesi
        while (upperMidi.length > 4) {
            upperMidi.splice(1, 1); // Rimuove una tensione bassa
            if (upperSp) upperSp.splice(1, 1);
        }

        if (upperMidi.length === 0) {
            upperMidi = [rootMidi + 7];
            if (spelledNotes) upperSp = [this.spellNoteDiatonic(rootStr, 7, 4)];
        }

        // ── 1. Candidate Generation (Closed & Drop-2) ─────────────────────────
        let candidates = [];
        
        for (let octOffset of [-12, 0, 12, 24]) {
            for (let rot = 0; rot < upperMidi.length; rot++) {
                let candMidi = upperMidi.slice();
                let candSp = upperSp ? upperSp.slice() : null;
                
                for (let i = 0; i < rot; i++) candMidi[i] += 12; // Invert
                
                let combined = candMidi.map((m,i) => ({m, sp: candSp ? candSp[i] : null}));
                combined.sort((a,b) => a.m - b.m);
                
                let closeMidi = combined.map(c => c.m + octOffset);
                let closeSp = combined.map(c => c.sp);

                // Ensure playable bounds (e.g. between G3 and A5)
                if (closeMidi[closeMidi.length-1] <= 81 && closeMidi[0] >= 48) {
                    candidates.push({ midi: closeMidi, sp: closeSp });
                }

                if (drop2 && closeMidi.length >= 3) {
                    let d2Midi = closeMidi.slice();
                    d2Midi[d2Midi.length - 2] -= 12; // Drop 2nd voice
                    let d2Combined = d2Midi.map((m,i) => ({m, sp: closeSp[i]}));
                    d2Combined.sort((a,b) => a.m - b.m);
                    
                    let finalD2Midi = d2Combined.map(c => c.m);
                    let finalD2Sp = d2Combined.map(c => c.sp);
                    
                    if (finalD2Midi[finalD2Midi.length-1] <= 81 && finalD2Midi[0] >= 48) {
                        candidates.push({ midi: finalD2Midi, sp: finalD2Sp });
                    }
                }
            }
        }
        
        if (candidates.length === 0) {
            candidates.push({ midi: upperMidi.slice(), sp: upperSp ? upperSp.slice() : null });
        }

        // ── 2. Pedagogical Voice Leading Cost Evaluation ──────────────────────
        let bestCand = candidates[0];
        
        if (prevVoicing) {
            let prevUpperNodes = prevVoicing.filter(n => n.voiceIdx > 0).sort((a,b) => a.frequency - b.frequency);
            let prevUpper = prevUpperNodes.map(n => Math.round(69 + 12 * Math.log2(n.frequency/440)));

            if (prevUpper.length > 0) {
                let minCost = Infinity;

                for (let cand of candidates) {
                    let cost = 0;
                    let cMidi = cand.midi;
                    
                    let lenC = cMidi.length;
                    let lenP = prevUpper.length;
                    let maxLen = Math.max(lenC, lenP);
                    
                    for (let i = 0; i < maxLen; i++) {
                        let cTop = cMidi[lenC - 1 - i];
                        let pTop = prevUpper[lenP - 1 - i];
                        
                        if (cTop !== undefined && pTop !== undefined) {
                            let dist = Math.abs(cTop - pTop);
                            if (i === 0) {
                                cost += dist * 3; // Top voice penalization
                                if (dist > 4) cost += (dist - 4) * 2; // Extra leap penalty
                            } else {
                                cost += dist; // Inner voices
                            }
                            // Reward common tones or stepwise motion
                            if (dist === 0) cost -= 2;
                            else if (dist <= 2) cost -= 1;
                        } else {
                            cost += 5; // Penalty for dropping/adding inner voices
                        }
                    }

                    // Parallel 5ths and 8ves (comparing all pairs)
                    let minLen = Math.min(lenC, lenP);
                    for (let i = 0; i < minLen - 1; i++) {
                        for (let j = i + 1; j < minLen; j++) {
                            let c1 = cMidi[lenC - 1 - i], c2 = cMidi[lenC - 1 - j];
                            let p1 = prevUpper[lenP - 1 - i], p2 = prevUpper[lenP - 1 - j];
                            
                            let cInt = Math.abs(c1 - c2) % 12;
                            let pInt = Math.abs(p1 - p2) % 12;
                            
                            if ((pInt === 7 || pInt === 0) && cInt === pInt) {
                                let dir1 = Math.sign(c1 - p1);
                                let dir2 = Math.sign(c2 - p2);
                                if (dir1 !== 0 && dir1 === dir2 && (c1 - p1) === (c2 - p2)) {
                                    cost += 50; // Severe Parallel penalty
                                }
                            }
                            
                            // Tritone resolution (reward contrary motion on active dissonances)
                            if (Math.abs(p1 - p2) % 12 === 6) {
                                let dir1 = Math.sign(c1 - p1);
                                let dir2 = Math.sign(c2 - p2);
                                if (dir1 !== 0 && dir2 !== 0 && dir1 !== dir2) {
                                    if (Math.abs(c1 - p1) <= 2 && Math.abs(c2 - p2) <= 2) {
                                        cost -= 15;
                                    }
                                }
                            }
                        }
                    }

                    if (cost < minCost) {
                        minCost = cost;
                        bestCand = cand;
                    }
                }
            } else {
                let minCost = Infinity;
                for (let cand of candidates) {
                    let cost = Math.abs(cand.midi[cand.midi.length-1] - 72); 
                    if (cost < minCost) { minCost = cost; bestCand = cand; }
                }
            }
        } else {
            // First chord - Centralize top note around C5
            let minCost = Infinity;
            for (let cand of candidates) {
                let cost = Math.abs(cand.midi[cand.midi.length-1] - 72);
                if (cost < minCost) { minCost = cost; bestCand = cand; }
            }
        }

        notesMidi = bestCand.midi;
        spelledNotes = bestCand.sp;

        // Emergency Bound Clamps
        while(notesMidi[notesMidi.length-1] > 81) {
            for(let i=0; i<notesMidi.length; i++) notesMidi[i] -= 12;
        }
        while(notesMidi[0] < 55 && notesMidi[notesMidi.length-1] + 12 <= 81) {
            for(let i=0; i<notesMidi.length; i++) notesMidi[i] += 12;
        }

        // ── 3. Smooth Bass Voice Leading ─────────────────────────────────────────
        let bassMidi = this.getMidi(rootStr, baseOctInt === 4 ? 3 : 2);
        if (prevVoicing) {
            let prevBassNode = prevVoicing.find(n => n.voiceIdx === 0);
            if (prevBassNode) {
                let prevBass = Math.round(69 + 12 * Math.log2(prevBassNode.frequency/440));
                let bestBass = bassMidi;
                let minBDist = Infinity;
                
                for (let oct = -2; oct <= 2; oct++) {
                    let cBass = bassMidi + (oct * 12);
                    if (cBass >= 36 && cBass <= 60 && cBass < notesMidi[0]) {
                        let bDist = Math.abs(cBass - prevBass);
                        if (bDist < minBDist) {
                            minBDist = bDist;
                            bestBass = cBass;
                        }
                    }
                }
                if (minBDist !== Infinity) bassMidi = bestBass;
            }
        } else {
            while (bassMidi < 40) bassMidi += 12;
            while (bassMidi > 60) bassMidi -= 12;
        }
        
        while (bassMidi >= notesMidi[0]) bassMidi -= 12;

        notesMidi.unshift(bassMidi);
        if (spelledNotes) {
            spelledNotes.unshift({ name: rootStr, acc: rootStr.slice(1), step: this.stepMap[rootStr[0]] });
        }

        // ── 4. Outer Shell Semantic Voice Allocation ──────────────────────────────────
        let useSharp = (this.getSpellingForRoot(rootStr) === 'sharp');
        let voiceIndices = new Array(notesMidi.length);
        
        // Il Basso occupa rigorosamente lo slot 0 (Fondazione inamovibile)
        voiceIndices[0] = 0;
        
        // Nel jazz, i confini esterni dell'accordo definiscono il sound (Outer Shell). 
        // Ancoriamo il Lead a 6 e la base dell'upper structure a 3. 
        // Eventuali note omesse (buchi) cadranno rigorosamente sulle voci interne (4 o 5).
        const LEAD_INDEX = 6;
        const BOTTOM_UPPER_INDEX = 3;

        let upperCount = notesMidi.length - 1;
        
        if (upperCount === 1) {
            voiceIndices[1] = LEAD_INDEX;
        } else if (upperCount === 2) {
            voiceIndices[1] = BOTTOM_UPPER_INDEX;
            voiceIndices[2] = LEAD_INDEX;
        } else if (upperCount === 3) {
            // 3 note superiori: Outer shell + 1 voce interna bassa. "Buco" sul canale 5.
            voiceIndices[1] = BOTTOM_UPPER_INDEX;
            voiceIndices[2] = 4; 
            voiceIndices[3] = LEAD_INDEX;
        } else if (upperCount === 4) {
            // Struttura completa a 4 voci
            voiceIndices[1] = BOTTOM_UPPER_INDEX;
            voiceIndices[2] = 4;
            voiceIndices[3] = 5;
            voiceIndices[4] = LEAD_INDEX;
        } else {
            // Fallback estremo
            for (let i = 1; i <= upperCount; i++) {
                voiceIndices[i] = BOTTOM_UPPER_INDEX + i - 1;
            }
        }

        // ── 5. Pedagogical Enharmonic Anchoring (Jazz Sight-Reading Optimization) ──
        let diatonicPCs = null;
        let globalPreferSharp = useSharp;

        // Se siamo all'interno di una progressione con un KeyContext definito
        if (typeof window !== 'undefined' && window.currentKeyContext && window.currentKeyContext.root) {
            let keySig = this.getKeySignature(window.currentKeyContext.root, window.currentKeyContext.isMajor);
            diatonicPCs = {};
            
            // Imposta la preferenza globale (flat/sharp) basata sulla tonalità
            let contextSpell = this.getSpellingForRoot(window.currentKeyContext.root);
            if (contextSpell === 'flat') globalPreferSharp = false;
            else if (contextSpell === 'sharp') globalPreferSharp = true;
            
            // A. Mappa i gradi naturali
            this.letters.forEach(l => {
                let step = this.stepMap[l];
                let pc = this.diatonicSteps[step];
                diatonicPCs[pc] = { base: l, acc: '' };
            });
            
            // B. Sovrascrive coi bemolli presenti in armatura
            keySig.flats.forEach(f => {
                let step = this.stepMap[f];
                let pc = (this.diatonicSteps[step] - 1 + 12) % 12;
                for (let key in diatonicPCs) if (diatonicPCs[key].base === f) delete diatonicPCs[key];
                diatonicPCs[pc] = { base: f, acc: 'b' };
            });
            
            // C. Sovrascrive coi diesis presenti in armatura
            keySig.sharps.forEach(s => {
                let step = this.stepMap[s];
                let pc = (this.diatonicSteps[step] + 1) % 12;
                for (let key in diatonicPCs) if (diatonicPCs[key].base === s) delete diatonicPCs[key];
                diatonicPCs[pc] = { base: s, acc: '#' };
            });
        }

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
                const baseLetterStep = this.stepMap[sp.name[0]];
                step = octave * 7 + baseLetterStep;
            } else {
                const noteObj = this.getNoteFromMidi(midi, globalPreferSharp);
                name = noteObj.name;
                acc  = noteObj.acc;
                step = noteObj.step;
            }

            // --- GLOBAL DIATONIC OVERRIDE ---
            // Forza l'ortografia ad allinearsi alla scala globale per evitare flip-flop (es. D# -> Eb in Do minore)
            if (diatonicPCs && diatonicPCs[pc]) {
                let target = diatonicPCs[pc];
                let expectedName = target.base + target.acc;
                
                if (name !== expectedName) {
                    let expectedNaturalMidi = midi;
                    if (target.acc === 'b') expectedNaturalMidi += 1;
                    else if (target.acc === '#') expectedNaturalMidi -= 1;
                    
                    // Ricalcolo dell'ottava per prevenire salti visivi sui boundary (es. Cb5 che slitta a B4)
                    let trueOctave = Math.floor(expectedNaturalMidi / 12) - 1;
                    
                    name = expectedName;
                    acc = target.acc;
                    step = trueOctave * 7 + this.stepMap[target.base];
                }
            }

            let color = "#D946A8"; 
            if (ival === 0) color = "#4A90D9";
            else if (ival === 3 || ival === 4) {
                color = (ival === 3 && (typeStr.includes('alt') || typeStr.includes('#9'))) ? "#D946A8" : "#2EC4B6";
            }
            else if (ival === 6 || ival === 7 || ival === 8) {
                color = (ival === 6 && typeStr.includes('#11')) ? "#D946A8" : "#F0B429";
            }
            else if (ival === 9 || ival === 10 || ival === 11) color = "#E8873D";

            return { name, step, color, accidental: acc, frequency: freq, voiceIdx: voiceIndices[idx] };
        });

        return result;
    }
}

window.musicEngine = new MusicEngine();
