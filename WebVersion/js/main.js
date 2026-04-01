document.addEventListener("DOMContentLoaded", () => {
    window.gui = new GUI();

    // Sblocca WebAudio su iOS al primissimo tocco (Policy Apple)
    document.addEventListener('touchstart', function() {
        if(window.audioEngine && window.audioEngine.ctx && window.audioEngine.ctx.state === 'suspended') {
            window.audioEngine.ctx.resume();
        }
    }, { passive: true });

    const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    
    const LEVEL_POOLS_SINGLE = {
        "1: Triadi Base":     ["C", "Cm", "Cdim", "Caug", "F", "Fm", "G", "Gm", "Bb", "D", "Am"],
        "2: Settime (Drop 2)":["Cmaj7", "Cm7", "C7", "Cm7b5", "Fmaj7", "G7", "Bbmaj7", "Ddim7"],
        "3: Jazz Extensions": ["Cmaj9", "C9", "C13", "G7alt", "G7b9", "Bb7#11", "D-9", "Fm9"],
        "4: Advanced (Subs/Alt)": ["A7alt", "Db7", "E7#9", "B13b9", "F#7b9"]
    };
    
    const LEVEL_POOLS_PROG = {
        "1: Triadi Base": [
            "I - IV - V - I|C|F|G|C", 
            "I - vi - IV - V|C|Am|F|G", 
            "i - iv - V - i|Cm|Fm|G|Cm", 
            "i - VI - VII - i|Cm|Ab|Bb|Cm", 
            "I - ii - V - I|C|Dm|G|C"
        ],
        "2: Settime (Drop 2)": [
            "ii7 - V7 - Imaj7|Dm7|G7|Cmaj7", 
            "iiø7 - V7 - im7|Dm7b5|G7|Cm7", 
            "Imaj7 - vi7 - ii7 - V7|Cmaj7|Am7|Dm7|G7", 
            "iim7 - v7 - Imaj7|Fm7|Bb7|Ebmaj7"
        ],
        "3: Jazz Extensions": [
            "ii9 - V13 - Imaj9|Dm9|G13|Cmaj9", 
            "iiø7 - V7alt - im9|Dm7b5|G7alt|Cm9", 
            "Imaj9 - VI7alt - ii9 - V13|Cmaj9|A7alt|Dm9|G13"
        ],
        "4: Advanced (Subs/Alt)": [
            "ii7 - subV7 - Imaj7|Dm7|Db7|Cmaj7", 
            "V7/ii - ii7 - V7 - Imaj7|A7|Dm7|G7|Cmaj7", 
            "iim7 - subV7 - Imaj7|Fm7|E7|Ebmaj7"
        ]
    };
    
    window.currentSymbol = null;
    window.currentProgression = null;
    window.correctAnswerText = null;

    const levelSelect = document.getElementById("level_select");
    Object.keys(LEVEL_POOLS_SINGLE).forEach(lvl => {
        let opt = document.createElement("option");
        opt.value = lvl; opt.text = lvl;
        levelSelect.appendChild(opt);
    });

    // Custom Transposer (dalla tonalità implicita di default al target Root)
    function transposeChord(chordStr, targetRoot) {
        let chromatic = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        let match = chordStr.match(/^([A-G][b#]?)(.*)/);
        if(!match) return chordStr;
        
        let pcStr = match[1];
        let idxOrig = chromatic.indexOf(pcStr);
        if(idxOrig === -1) idxOrig = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(pcStr);
        
        let targetIdx = chromatic.indexOf(targetRoot);
        if(targetIdx === -1) targetIdx = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(targetRoot);
        
        // Assumption: our generic prog pools are written implicitly in C or related relative
        let diff = targetIdx - chromatic.indexOf('C'); 
        
        let newIdx = (idxOrig + diff + 12) % 12;
        return chromatic[newIdx] + match[2];
    }

    function createAnswers(targetBtnText, wrongOptsTexts) {
        const answersFrame = document.querySelector(".answers-frame");
        answersFrame.innerHTML = "";
        window.correctAnswerText = targetBtnText;
        
        let opts = [targetBtnText, ...wrongOptsTexts].slice(0, 4);
        opts.sort(() => Math.random() - 0.5);
        
        opts.forEach(o => {
            let b = document.createElement("button");
            b.className = "btn answer-btn";
            b.innerText = o; // .replace(/\|/g, " - ")
            if(o.includes("\n")) b.style.fontSize = "12px";
            
            b.onclick = () => {
                if(o === window.correctAnswerText) {
                    b.style.backgroundColor = "var(--green)";
                    b.innerText = "✓ " + o.split("\n")[0];
                    document.getElementById("combo_label").innerText = window.realProgressionLabel || o.split("\n")[0];
                } else {
                    b.style.backgroundColor = "var(--red)";
                    b.innerText = "✗ " + o.split("\n")[0];
                }
            };
            answersFrame.appendChild(b);
        });
    }

    function startNewChallenge() {
        if(window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
        window.gui.drawPitches([]); 
        
        let isProgression = document.getElementById("play_mode_menu").value.includes("Progressione");
        let level = document.getElementById("level_select").value;
        let root = ROOTS[Math.floor(Math.random() * ROOTS.length)];
        
        if (isProgression) {
            let pool = LEVEL_POOLS_PROG[level] || LEVEL_POOLS_PROG["1: Triadi Base"];
            let item = pool[Math.floor(Math.random() * pool.length)]; 
            
            let parts = item.split("|");
            let name = parts[0] + "\n(" + parts.slice(1).map(c => transposeChord(c, root)).join(" - ") + ")";
            window.currentProgression = parts.slice(1).map(c => transposeChord(c, root));
            
            document.getElementById("combo_label").innerText = "???";
            window.realProgressionLabel = parts[0].split("\n")[0] + " in " + root;
            
            // Generate valid distractors 
            let wrongOpts = [];
            let safePool = pool.filter(p => p !== item);
            safePool.forEach(p => {
                let pparts = p.split("|");
                wrongOpts.push(pparts[0] + "\n(" + pparts.slice(1).map(c => transposeChord(c, root)).join(" - ") + ")");
            });
            
            createAnswers(name, wrongOpts);
        } else {
            window.currentProgression = null;
            let pool = LEVEL_POOLS_SINGLE[level] || LEVEL_POOLS_SINGLE["1: Triadi Base"];
            let sym = pool[Math.floor(Math.random() * pool.length)];
            
            let match = sym.match(/^([A-G][b#]?)(.*)/);
            let qual = match ? match[2] : "";
            let targetChord = root + qual;
            window.currentSymbol = targetChord;
            document.getElementById("combo_label").innerText = "???";
            window.realProgressionLabel = targetChord;
            
            let wrongQuals = [];
            pool.forEach(p => {
                let pm = p.match(/^([A-G][b#]?)(.*)/);
                if(pm && pm[2] !== qual && !wrongQuals.includes(pm[2])) {
                    wrongQuals.push(pm[2]);
                }
            });
            // If less than 3, borrow from other pools occasionally, but typically we have enough
            let wrongOpts = wrongQuals.map(q => root + q);
            createAnswers(targetChord, wrongOpts);
        }
    }

    document.getElementById("next_btn").addEventListener("click", startNewChallenge);

    document.getElementById("play_btn").addEventListener("click", () => {
        if(window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
        if(!window.currentSymbol && !window.currentProgression) startNewChallenge();
        
        let comboLbl = document.getElementById("combo_label");
        if(comboLbl.innerText === "???") {
            comboLbl.style.transform = "scale(1.2)";
            setTimeout(() => comboLbl.style.transform = "scale(1)", 200);
        }
        
        let baseOctave = "C3";
        let isOptimized = document.getElementById("voice_leading_menu").value.includes("Ottimizzata");
        
        let tempoMenu = document.getElementById("tempo_menu");
        let tempoMs = tempoMenu ? parseInt(tempoMenu.value) : 1300;
        let cutDuration = (tempoMs / 1000) * 0.82; // L'accordo muore all'82% dello span temporale!
        
        if (window.currentProgression) {
            let prevV = null;
            let voicings = window.currentProgression.map(s => {
                let v = window.musicEngine.generateVoicing(s, baseOctave, isOptimized, prevV);
                prevV = v;
                return v;
            });
            window.currentVoicings = voicings;
            window.gui.drawPitches(voicings);
            
            voicings.forEach((v, i) => {
                setTimeout(() => window.audioEngine.playChord(v, cutDuration), i * tempoMs); 
            });
            window.gui.setInsight("Progressione (" + tempoMs + "ms). Drop-2: " + (isOptimized ? "ON" : "OFF"));
        } else {
            let sym = window.currentSymbol;
            let targetVoicing = window.musicEngine.generateVoicing(sym, baseOctave, isOptimized);
            window.currentVoicings = [targetVoicing];
            window.gui.drawPitches([targetVoicing]); 
            window.audioEngine.playChord(targetVoicing, cutDuration);
            
            let insight = `Base: C3 | Inversioni: ${isOptimized ? "Ott. (Drop-2)" : "Root"}`;
            window.gui.setInsight(insight);
        }
    });

    document.getElementById("arpeggio_btn").addEventListener("click", () => {
        if(window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
        if(!window.currentVoicings) return; 
        
        let tempoMenu = document.getElementById("tempo_menu");
        let tempoMs = tempoMenu ? parseInt(tempoMenu.value) : 1300;
        
        let cIdx = 0;
        let pIdx = 0;
        
        function arpNext() {
            if(cIdx >= window.currentVoicings.length) return;
            let chord = window.currentVoicings[cIdx];
            
            if(pIdx >= chord.length) {
                pIdx = 0;
                cIdx++;
                if (cIdx < window.currentVoicings.length) {
                    setTimeout(arpNext, tempoMs * 0.4); 
                }
                return;
            }
            
            let note = chord[pIdx];
            window.audioEngine.playPitch(note.voiceIdx, note.frequency, 0.6);
            pIdx++;
            setTimeout(arpNext, tempoMs * 0.18); 
        }
        arpNext();
    });
});
