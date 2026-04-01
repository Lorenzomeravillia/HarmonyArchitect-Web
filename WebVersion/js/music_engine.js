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
    
    getNoteFromMidi(midi) {
        let oct = Math.floor(midi / 12) - 1;
        let pc = midi % 12;
        
        // Semplice interpretazione di bemolli per le note nere 
        // In una vera app si userebbe il circolo delle quinte, qui per l'UI basta questo
        let name = this.notesStr[pc];
        let acc = name.length > 1 ? name[1] : "";
        let step = oct * 7 + this.stepMap[name[0]];
        
        return { 
            name: name, 
            oct: oct, 
            chroma: pc, 
            acc: acc, 
            freq: 440 * Math.pow(2, (midi - 69)/12), 
            step: step 
        };
    }
    
    generateVoicing(symbol, baseOctave="C4", drop2=true, prevVoicing=null) {
        // Estrai root e qualità. Es "D-9" -> root D, type "-9"
        let match = symbol.match(/^([A-G][b#]?)(.*)/);
        if(!match) return [];
        let rootStr = match[1];
        let typeStr = match[2];
        
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
            // Ottimizzazione Voice Leading con l'accordo precedente
            let prevTreble = prevVoicing.filter(n => n.voiceIdx > 0).map(n => Math.round(69 + 12 * Math.log2(n.frequency/440)));
            if (prevTreble.length > 0) {
                let avgPrev = prevTreble.reduce((a,b)=>a+b)/prevTreble.length;
                let bestCand = null;
                let minDist = 9999;
                
                // Cerca 3 ottave * n inversioni
                for (let octOffset of [-12, 0, 12]) {
                    for (let rot = 0; rot < notesMidi.length; rot++) {
                        let cand = notesMidi.slice();
                        for(let i=0; i<rot; i++) cand[i] += 12; // Inverti note base
                        cand.sort((a,b)=>a-b);
                        cand = cand.map(m => m + octOffset);
                        
                        let avgCand = cand.reduce((a,b)=>a+b)/cand.length;
                        let dist = Math.abs(avgCand - avgPrev);
                        
                        // Penalizza estremi di registro vocali rigorosi: Mai sotto D3 (50) e mai sopra G5 (79)
                        if (cand[cand.length-1] > 79 || cand[0] < 50) dist += 200;
                        
                        // Penalizza salti grossi nella top voice (Lead)
                        let topCand = cand[cand.length-1];
                        let topPrev = prevTreble[prevTreble.length-1];
                        dist += Math.abs(topCand - topPrev) * 0.5;
                        
                        if (dist < minDist) { minDist = dist; bestCand = cand.slice(); }
                    }
                }
                if (bestCand) notesMidi = bestCand;
            }
        } else if (drop2 && notesMidi.length >= 4) {
            // Semplice Drop 2 sul primo accordo per dare spaziosità
            let dropped = notesMidi.splice(notesMidi.length - 2, 1)[0];
            dropped -= 12; // scendi di 1 ottava (12 semitoni)
            notesMidi.unshift(dropped);
        }
        
        // Force clamp sotto G5 (79)
        while(notesMidi[notesMidi.length-1] > 79) { 
            for(let i=0; i<notesMidi.length; i++) notesMidi[i] -= 12; 
        }
        
        // Aggiungi la linea di Basso alla fine (inizio array, in fondo al pitch)
        let bassMidi = this.getMidi(rootStr, baseOctInt === 4 ? 3 : 2);
        
        // Il basso assoluto non può MAI scendere sotto F2 (41) e resta sotto F3 (53)
        if (bassMidi < 41) bassMidi += 12;
        if (bassMidi > 53) bassMidi -= 12;
        
        notesMidi.unshift(bassMidi);
        
        let result = notesMidi.map((midi, idx) => {
            let noteObj = this.getNoteFromMidi(midi);
            let ival = (noteObj.chroma - rootPc + 12) % 12;
            
            // Colori standard di Harmony Architect UI
            let color = "#e74c3c"; // rosso (Estensioni / Alterazioni)
            if (ival === 0) color = "#3498db"; // blu (Fondamentale)
            else if (ival === 3 || ival === 4) color = "#2ecc71"; // verde (Terza)
            else if (ival === 7) color = "#f1c40f"; // giallo (Quinta)
            else if (ival === 10 || ival === 11) color = "#C26A23"; // arancio (Settima)

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
