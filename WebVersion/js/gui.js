// Maps semitone interval from root to readable degree labels (no modal quality)
const INTERVAL_LABELS = {
    0: 'Root',
    1: 'b2',   2: '2',
    3: '3',    4: '3',
    5: '4',    6: 'b5',   7: '5',   8: '#5',
    9: 'dim7', 10: '7',   11: '7',
    13: 'b9',  14: '9',   15: '#9',
    17: '11',  18: '#11',
    21: '13'
};

// ── Key Signature lookup ──────────────────────────────────────────────────────
// Accidentals listed in the standard order they appear in a key signature.
const KEY_SIGNATURES = {
    'C':  {sharps:[], flats:[]},
    'G':  {sharps:['F'], flats:[]},
    'D':  {sharps:['F','C'], flats:[]},
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

// Minor key → relative major lookup
const MINOR_TO_MAJOR = {
    'A':'C','E':'G','B':'D','F#':'A','C#':'E','G#':'B','D#':'E','A#':'F#',
    'D':'F','G':'Bb','C':'Eb','F':'Ab','Bb':'Db','Eb':'Gb',
};

function getKeySignatureForContext(root, isMajor) {
    if (!root) return {sharps:[], flats:[]};
    const key = isMajor ? root : (MINOR_TO_MAJOR[root] || 'C');
    return KEY_SIGNATURES[key] || {sharps:[], flats:[]};
}

// Treble clef standard staff positions for key-sig accidentals
// Y positions computed for: line1=175px(F5), line2=141(D5), line3=107(B4), line4=73(G4), line5=39(E4)
// stepMap: C=0,D=1,E=2,F=3,G=4,A=5,B=6; step = oct*7 + letterIdx
// For treble (voiceIdx>0): Y = 175 - (step - 30) * 17
// For bass   (voiceIdx=0): Y = 243 - (step - 26) * 17
// Standard treble key-sig positions (step values):
const TREBLE_SHARP_STEPS = {
    'F': 38,  // F5
    'C': 35,  // C5
    'G': 39,  // G5
    'D': 36,  // D5
    'A': 33,  // A4
    'E': 37,  // E5
    'B': 34   // B4
};
const TREBLE_FLAT_STEPS = {
    'B': 34,  // B4
    'E': 37,  // E5
    'A': 33,  // A4
    'D': 36,  // D5
    'G': 32,  // G4
    'C': 35,  // C5
    'F': 31   // F4
};
// Bass clef key-sig standard positions
const BASS_SHARP_STEPS = {
    'F': 24,  // F3
    'C': 21,  // C3
    'G': 25,  // G3
    'D': 22,  // D3
    'A': 19,  // A2
    'E': 23,  // E3
    'B': 20   // B2
};
const BASS_FLAT_STEPS = {
    'B': 20,  // B2
    'E': 23,  // E3
    'A': 19,  // A2
    'D': 22,  // D3
    'G': 18,  // G2
    'C': 21,  // C3
    'F': 17   // F2
};

// Should we draw an accidental on the note, given the active key signature?
// Returns false (no accidental needed), or the symbol to draw.
function shouldShowAccidental(noteAcc, noteLetter, keySig) {
    if (!keySig) {
        if (!noteAcc) return false;
        return noteAcc === 'b' ? '♭' : noteAcc === '#' ? '♯' : null;
    }
    const inFlats  = keySig.flats.includes(noteLetter);
    const inSharps = keySig.sharps.includes(noteLetter);

    if (inFlats) {
        if (noteAcc === 'b')  return false;   // covered by key sig
        if (noteAcc === '')   return '♮';     // natural — needs cancelling
        if (noteAcc === '#')  return '♯';     // chromatic accidental
    } else if (inSharps) {
        if (noteAcc === '#')  return false;   // covered by key sig
        if (noteAcc === '')   return '♮';     // natural — needs cancelling
        if (noteAcc === 'b')  return '♭';     // chromatic accidental
    } else {
        if (!noteAcc) return false;           // natural note outside key sig, no symbol needed
        return noteAcc === 'b' ? '♭' : noteAcc === '#' ? '♯' : null;
    }
    return false;
}

class GUI {
    constructor() {
        this.canvas = document.getElementById("staff_canvas");
        this.ctx = this.canvas.getContext("2d");

        // ── Timbre preset buttons ──────────────────────────────
        const selectContainer = document.getElementById("voice_instruments_frame");
        const presetDefs = [
            { name: 'Clear Mix',  dots: 1 },
            { name: 'Jazz Combo', dots: 2 },
            { name: 'Orchestra',  dots: 3 },
        ];
        presetDefs.forEach((p, i) => {
            const btn = document.createElement('button');
            btn.className = 'btn preset-btn' + (i === 0 ? ' active' : '');
            const dotHTML = [1,2,3].map(d =>
                `<span style="opacity:${d <= p.dots ? '1' : '0.22'}">●</span>`
            ).join('');
            btn.innerHTML = `<span style="letter-spacing:2px;font-size:13px;">${dotHTML}</span>&nbsp;${p.name}`;
            btn.onclick = () => {
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.audioEngine.applyPreset(p.name);
            };
            selectContainer.appendChild(btn);
        });
        
        // Hard-sync the internal engine matrix to match the UI visual default immediately.
        if (window.audioEngine) window.audioEngine.applyPreset(presetDefs[0].name);

        // ── Solo buttons ────────────────────────────────────────
        const solo_frame = document.getElementById("solo_buttons_frame");
        const defaultLabels = ["Bass", "2nd", "3rd", "4th", "5th", "6th", "Top"];
        defaultLabels.forEach((s, i) => {
            let b = document.createElement("button");
            b.className = "btn solo-btn";
            b.innerText = s;
            b.onclick = () => {
                if (window.audioEngine.ctx?.state === 'suspended') window.audioEngine.ctx.resume();
                if (!window.currentVoicings) return;
                let cIdx = 0;
                function solNext() {
                    if (cIdx >= window.currentVoicings.length) return;
                    let chord = window.currentVoicings[cIdx];
                    if (chord) {
                        let n = chord.find(c => c.voiceIdx === i);
                        if (n) {
                            window.audioEngine.playPitch(n.voiceIdx, n.frequency, 1.2, cIdx);
                            b.classList.add('flash-active');
                            setTimeout(() => b.classList.remove('flash-active'), 250);
                        } else {
                            b.classList.add('flash-missing');
                            setTimeout(() => b.classList.remove('flash-missing'), 250);
                        }
                    }
                    cIdx++;
                    let isoTempo = parseInt((document.getElementById('tempo_menu') || {}).value) || 1560;
                    if (cIdx < window.currentVoicings.length) setTimeout(solNext, isoTempo);
                }
                solNext();
            };
            b.style.display = 'none';
            solo_frame.appendChild(b);
        });

        this.logicW = 600;
        this.logicH = 440;

        // Canvas click/touch → play individual note
        const handleCanvasTap = (clientX, clientY) => {
            if (!window.noteHitboxes) return;
            const rct = this.canvas.getBoundingClientRect();
            const px = ((clientX - rct.left) / rct.width) * this.logicW;
            const py = ((clientY - rct.top) / rct.height) * this.logicH;
            
            let closest = null;
            let minDist = 22; // 44px diameter physical hit zone
            
            // Nearest neighbor scan
            for (let hb of window.noteHitboxes) {
                let dist = Math.hypot(px - hb.x, py - hb.y);
                if (dist < minDist) {
                    minDist = dist;
                    closest = hb;
                }
            }
            
            if (closest) {
                if (window.audioEngine.ctx?.state === 'suspended') window.audioEngine.ctx.resume();
                window.audioEngine.playPitch(closest.voiceIdx, closest.freq, 1.0, closest.chordIdx);
                this._animateNotePulse(closest);
            }
        };

        this.canvas.addEventListener("mousedown", (e) => {
            if (e.pointerType === 'touch') return; // Prevent double trigger
            handleCanvasTap(e.clientX, e.clientY);
        });

        this.canvas.addEventListener("touchstart", (e) => {
            e.preventDefault(); // Prevents phantom clicks delaying UI
            if (e.touches.length > 0) {
                handleCanvasTap(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        // Auto-resize
        this._resizeObserver = new ResizeObserver(() => {
            if (window.lastChords) {
                this.drawPitches(window.lastChords, window.lastKeyContext);
            } else {
                this.drawEmptyStaff();
            }
        });
        const staffFrame = this.canvas.closest('.staff-frame');
        if (staffFrame) this._resizeObserver.observe(staffFrame);

        this.drawEmptyStaff();
    }

    updateSoloButtons() {
        const buttons = document.querySelectorAll('#solo_buttons_frame .solo-btn');
        let activeIndices = new Set();
        if (window.currentVoicings) {
            window.currentVoicings.forEach(chord => {
                chord.forEach(n => activeIndices.add(n.voiceIdx));
            });
        }
        const ordinals = {0:'Bass', 1:'2nd', 2:'3rd', 3:'4th', 4:'5th', 5:'6th', 6:'Lead'};
        
        buttons.forEach((btn, i) => {
            if (activeIndices.has(i)) {
                btn.style.display = '';
                btn.textContent = ordinals[i] || ('V' + i);
            } else {
                btn.style.display = 'none';
            }
        });
    }

    resetSoloButtons() {
        document.querySelectorAll('#solo_buttons_frame .solo-btn').forEach(btn => {
            btn.style.display = 'none';
        });
    }

    _animateNotePulse(hb) {
        if (!this.canvas) return;
        const rct = this.canvas.getBoundingClientRect();
        // Project canvas logical coordinate space back to raw viewport DOM coordinates
        const domX = rct.left + (hb.x / this.logicW) * rct.width;
        const domY = rct.top + (hb.y / this.logicH) * rct.height;
        
        let ring = document.createElement('div');
        ring.className = 'note-pulse-ring';
        ring.style.left = domX + 'px';
        ring.style.top = domY + 'px';
        document.body.appendChild(ring);
        
        // Let CSS animation complete before purging
        setTimeout(() => { if (ring.parentNode) ring.remove(); }, 400);
    }

    _sizeCanvas() {
        const container = this.canvas.closest('.staff-frame');
        if (!container) return;
        let containerW = container.clientWidth - 8;
        let containerH = container.clientHeight - 8;
        const isLandscape = window.innerWidth > window.innerHeight;
        if (isLandscape && containerH < 100) {
            const middleFrame = container.closest('.middle-frame');
            if (middleFrame) {
                const rect = middleFrame.getBoundingClientRect();
                containerH = rect.height - 8;
                containerW = rect.width - 140 - 8;
            }
        }
        const targetRatio = this.logicW / this.logicH;
        let displayW, displayH;
        if (containerW / containerH > targetRatio) {
            displayH = containerH;
            displayW = Math.floor(containerH * targetRatio);
        } else {
            displayW = containerW;
            displayH = Math.floor(containerW / targetRatio);
        }
        this.canvas.style.width  = displayW + 'px';
        this.canvas.style.height = displayH + 'px';
        const ratio = window.devicePixelRatio || 1;
        const needW = Math.floor(this.logicW * ratio);
        const needH = Math.floor(this.logicH * ratio);
        if (this.canvas.width !== needW || this.canvas.height !== needH) {
            this.canvas.width  = needW;
            this.canvas.height = needH;
        }
    }

    // ── Draw the clef + staff lines, return x where key sig / notes begin ──
    drawEmptyStaff(keySig) {
        this._sizeCanvas();
        const ratio = window.devicePixelRatio || 1;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(ratio, ratio);
        const w = this.logicW;
        const h = this.logicH;
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.fillStyle = "#050814";
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.strokeStyle = "#8A9FCF";
        this.ctx.lineWidth = 1;
        this.ctx.fillStyle = "#8A9FCF";
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "alphabetic";
        // Treble staff lines (Shifted +20px down)
        [59, 93, 127, 161, 195].forEach(y => {
            this.ctx.beginPath(); this.ctx.moveTo(30, y); this.ctx.lineTo(w - 30, y); this.ctx.stroke();
        });
        this.ctx.font = "normal 120px serif";
        this.ctx.fillText("𝄞", 30, 189);
        // Bass staff lines (Shifted +20px down)
        [263, 297, 331, 365, 399].forEach(y => {
            this.ctx.beginPath(); this.ctx.moveTo(30, y); this.ctx.lineTo(w - 30, y); this.ctx.stroke();
        });
        this.ctx.font = "normal 110px serif";
        this.ctx.fillText("𝄢", 30, 377);
        // Bracket
        this.ctx.lineWidth = 2;
        this.ctx.beginPath(); this.ctx.moveTo(30, 59); this.ctx.lineTo(30, 399); this.ctx.stroke();

        // Draw key signature if provided
        let noteStartX = 110; // default x after clef
        if (keySig && (keySig.sharps.length > 0 || keySig.flats.length > 0)) {
            noteStartX = this._drawKeySignature(keySig);
        }
        return noteStartX;
    }

    // ── Render key signature accidentals, return x after key sig ──
    _drawKeySignature(keySig) {
        const isSharp = keySig.sharps.length > 0;
        const acc = isSharp ? keySig.sharps : keySig.flats;
        const symbol = isSharp ? '♯' : '♭';
        const trebleSteps = isSharp ? TREBLE_SHARP_STEPS : TREBLE_FLAT_STEPS;
        const bassSteps   = isSharp ? BASS_SHARP_STEPS : BASS_FLAT_STEPS;

        this.ctx.fillStyle = "#B0C8EF";
        this.ctx.font = "bold 26px Arial";

        let x = 112; // start x after clef

        acc.forEach(letter => {
            // Treble clef note position
            const tStep = trebleSteps[letter];
            if (tStep !== undefined) {
                const ty = 195 - (tStep - 30) * 17;
                this.ctx.fillText(symbol, x, ty + 9);
            }
            // Bass clef note position
            const bStep = bassSteps[letter];
            if (bStep !== undefined) {
                const by = 263 - (bStep - 26) * 17;
                this.ctx.fillText(symbol, x, by + 9);
            }
            x += 16;
        });

        return x + 10; // x where notes begin
    }

    // ── Main draw function ──────────────────────────────────────────────────────
    // keyContext: { root: 'Bb', isMajor: true } in Progression mode, null otherwise
    drawPitches(chords, keyContext) {
        window.lastChords = chords;
        window.lastKeyContext = keyContext || null;
        window.noteHitboxes = [];
        if (!window.activeGlows) window.activeGlows = new Set();

        // Compute key signature
        const keySig = keyContext
            ? getKeySignatureForContext(keyContext.root, keyContext.isMajor)
            : null;

        const noteStartX = this.drawEmptyStaff(keySig);

        if (!chords || chords.length === 0) return;

        const w = 600;
        const availW = w - noteStartX - 30;
        let spacing = Math.min(availW / (chords.length + 1), 160);

        chords.forEach((chordList, i) => {
            let xBase = chords.length === 1
                ? noteStartX + availW / 2 - 20
                : noteStartX + spacing * (i + 0.5);

            chordList.forEach((n) => {
                let j = n.voiceIdx;
                let step = n.step;
                let y = j === 0 ? (263 - (step - 26) * 17) : (195 - (step - 30) * 17);
                let x = xBase;

                // Ledger lines
                this.ctx.strokeStyle = "#A5BAE6";
                this.ctx.lineWidth = 2;
                if (j === 0) {
                    if (y >= 433) for (let ly = 433; ly <= y+5; ly += 34) { this.ctx.beginPath(); this.ctx.moveTo(x-8,ly); this.ctx.lineTo(x+28,ly); this.ctx.stroke(); }
                    if (y <= 229) for (let ly = 229; ly >= y-5; ly -= 34) { this.ctx.beginPath(); this.ctx.moveTo(x-8,ly); this.ctx.lineTo(x+28,ly); this.ctx.stroke(); }
                } else {
                    if (y >= 229) for (let ly = 229; ly <= y+5; ly += 34) { this.ctx.beginPath(); this.ctx.moveTo(x-8,ly); this.ctx.lineTo(x+28,ly); this.ctx.stroke(); }
                    if (y <= 25)  for (let ly = 25;  ly >= y-5; ly -= 34) { this.ctx.beginPath(); this.ctx.moveTo(x-8,ly); this.ctx.lineTo(x+28,ly); this.ctx.stroke(); }
                }

                // Note head
                this.ctx.fillStyle = n.color;
                this.ctx.beginPath();
                this.ctx.ellipse(x + 10, y, 11, 9, 0, 0, 2 * Math.PI);
                if (window.activeGlows.has(j + "-" + i)) {
                    this.ctx.shadowColor = "white";
                    this.ctx.shadowBlur = 18;
                    this.ctx.strokeStyle = "white";
                    this.ctx.lineWidth = 2;
                } else {
                    this.ctx.shadowBlur = 0;
                    this.ctx.strokeStyle = "#010205";
                    this.ctx.lineWidth = 1;
                }
                this.ctx.fill();
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;

                // Gloss
                this.ctx.fillStyle = "#FFFFFF";
                this.ctx.beginPath();
                this.ctx.ellipse(x + 5, y - 2, 4, 3, 0, 0, 2 * Math.PI);
                this.ctx.fill();

                // Hitbox
                window.noteHitboxes.push({ x: x+10, y, freq: n.frequency, voiceIdx: n.voiceIdx, chordIdx: i, color: n.color });

                // Accidental — suppress if covered by key signature
                const accSymbol = shouldShowAccidental(n.accidental, n.name ? n.name[0] : '', keySig);
                if (accSymbol) {
                    this.ctx.fillStyle = "white";
                    this.ctx.font = "bold 22px Arial";
                    this.ctx.fillText(accSymbol, x - 24, y + 8);
                }
            });
        });
    }

    setInsight(text) {
        const el = document.getElementById("insight_label");
        if (el) el.innerText = text;
    }

    highlight(voiceIdx, freq, durationMs, chordIdx = null) {
        if (!window.noteHitboxes) return;
        if (!window.activeGlows) window.activeGlows = new Set();
        let hits = window.noteHitboxes.filter(h => {
            let matchFreq = h.voiceIdx === voiceIdx && Math.abs(h.freq - freq) < 2;
            if (chordIdx !== null && chordIdx !== undefined) return matchFreq && h.chordIdx === chordIdx;
            return matchFreq;
        });
        let keys = [];
        hits.forEach(h => {
            let key = h.voiceIdx + "-" + h.chordIdx;
            window.activeGlows.add(key);
            keys.push(key);
        });
        this.drawPitches(window.lastChords, window.lastKeyContext);
        setTimeout(() => {
            if (window.activeGlows) {
                keys.forEach(k => window.activeGlows.delete(k));
                this.drawPitches(window.lastChords, window.lastKeyContext);
            }
        }, durationMs);
    }
}
