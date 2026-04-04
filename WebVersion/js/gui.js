// Maps functional note colors (from music_engine) to readable interval labels
const COLOR_TO_INTERVAL = {
    '#4A90D9': 'Root',
    '#2EC4B6': '3rd',
    '#F0B429': '5th',
    '#E8873D': '7th',
    '#D946A8': 'Ext',
};

class GUI {
    constructor() {
        this.canvas = document.getElementById("staff_canvas");
        this.ctx = this.canvas.getContext("2d");

        // ── Timbre preset buttons ──────────────────────────────
        const selectContainer = document.getElementById("voice_instruments_frame");
        const presetDefs = [
            { name: 'Orchestra',     icon: '🎻' },
            { name: 'Jazz Combo',    icon: '🎷' },
            { name: 'High Contrast', icon: '⚡' },
        ];
        presetDefs.forEach((p, i) => {
            const btn = document.createElement('button');
            btn.className = 'btn preset-btn' + (i === 0 ? ' active' : '');
            btn.textContent = `${p.icon} ${p.name}`;
            btn.onclick = () => {
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.audioEngine.applyPreset(p.name);
            };
            selectContainer.appendChild(btn);
        });

        // ── Solo buttons (contextual — updated per voicing) ────
        const solo_frame = document.getElementById("solo_buttons_frame");
        const defaultLabels = ["Bass", "2nd", "3rd", "4th", "5th", "6th", "Top"];
        defaultLabels.forEach((s, i) => {
            let b = document.createElement("button");
            b.className = "btn solo-btn";
            b.innerText = s;
            b.onclick = () => {
                if (window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
                if (!window.currentVoicings) return;

                let cIdx = 0;
                function solNext() {
                    if (cIdx >= window.currentVoicings.length) return;
                    let chord = window.currentVoicings[cIdx];
                    if (chord && chord.length > i) {
                        let n = chord[i];
                        window.audioEngine.playPitch(n.voiceIdx, n.frequency, 1.2, cIdx);
                    }
                    cIdx++;
                    let isoTempo = parseInt((document.getElementById('tempo_menu') || {}).value) || 1560;
                    if (cIdx < window.currentVoicings.length) setTimeout(solNext, isoTempo);
                }
                solNext();
            };
            solo_frame.appendChild(b);
        });

        // Logical coordinate space
        this.logicW = 600;
        this.logicH = 440;

        // Canvas click → play individual note
        this.canvas.addEventListener("mousedown", (e) => {
            if (!window.noteHitboxes) return;
            const rct = this.canvas.getBoundingClientRect();
            const px = ((e.clientX - rct.left) / rct.width) * this.logicW;
            const py = ((e.clientY - rct.top) / rct.height) * this.logicH;
            for (let i = window.noteHitboxes.length - 1; i >= 0; i--) {
                let hb = window.noteHitboxes[i];
                if (Math.hypot(px - hb.x, py - hb.y) <= 11) {
                    if (window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
                    window.audioEngine.playPitch(hb.voiceIdx, hb.freq, 1.0, hb.chordIdx);
                    break;
                }
            }
        });

        // Auto-resize
        this._resizeObserver = new ResizeObserver(() => {
            if (window.lastChords) {
                this.drawPitches(window.lastChords);
            } else {
                this.drawEmptyStaff();
            }
        });
        const staffFrame = this.canvas.closest('.staff-frame');
        if (staffFrame) this._resizeObserver.observe(staffFrame);

        this.drawEmptyStaff();
    }

    // Update SOLO buttons based on the first chord of the current voicing.
    // Shows only as many buttons as there are notes; labels them by interval function.
    updateSoloButtons(voicing) {
        const buttons = document.querySelectorAll('#solo_buttons_frame .solo-btn');
        const noteCount = voicing ? voicing.length : buttons.length;

        buttons.forEach((btn, i) => {
            if (i < noteCount) {
                btn.style.display = '';
                if (voicing && voicing[i]) {
                    const note = voicing[i];
                    btn.textContent = i === 0
                        ? 'Bass'
                        : (COLOR_TO_INTERVAL[note.color] || ('V' + (i + 1)));
                }
            } else {
                btn.style.display = 'none';
            }
        });
    }

    // Reset SOLO buttons to defaults (before a chord is played)
    resetSoloButtons() {
        const labels = ["Bass", "2nd", "3rd", "4th", "5th", "6th", "Top"];
        document.querySelectorAll('#solo_buttons_frame .solo-btn').forEach((btn, i) => {
            btn.style.display = '';
            btn.textContent = labels[i] || ('V' + (i + 1));
        });
    }

    _sizeCanvas() {
        const container = this.canvas.closest('.staff-frame');
        if (!container) return;
        const containerW = container.clientWidth - 8;
        const containerH = container.clientHeight - 8;
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

    drawEmptyStaff() {
        this._sizeCanvas();
        const ratio = window.devicePixelRatio || 1;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(ratio, ratio);
        const w = this.logicW;
        const h = this.logicH;
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.fillStyle = "#050814";
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.strokeStyle = "#2E406A";
        this.ctx.lineWidth = 1;
        this.ctx.fillStyle = "#4A65A5";
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "alphabetic";
        // Treble
        [39, 73, 107, 141, 175].forEach(y => {
            this.ctx.beginPath(); this.ctx.moveTo(30, y); this.ctx.lineTo(w - 30, y); this.ctx.stroke();
        });
        this.ctx.font = "normal 120px serif";
        this.ctx.fillText("𝄞", 30, 169);
        // Bass
        [243, 277, 311, 345, 379].forEach(y => {
            this.ctx.beginPath(); this.ctx.moveTo(30, y); this.ctx.lineTo(w - 30, y); this.ctx.stroke();
        });
        this.ctx.font = "normal 110px serif";
        this.ctx.fillText("𝄢", 30, 357);
        // Bracket
        this.ctx.lineWidth = 2;
        this.ctx.beginPath(); this.ctx.moveTo(30, 39); this.ctx.lineTo(30, 379); this.ctx.stroke();
    }

    drawPitches(chords) {
        window.lastChords = chords;
        window.noteHitboxes = [];
        if (!window.activeGlows) window.activeGlows = new Set();
        this.drawEmptyStaff();
        if (!chords || chords.length === 0) return;
        const w = 600;
        let spacing = Math.min((w - 150) / (chords.length + 1), 160);
        chords.forEach((chordList, i) => {
            let xBase = chords.length === 1 ? w / 2 - 20 : 100 + spacing * i;
            chordList.forEach((n) => {
                let j = n.voiceIdx;
                let step = n.step;
                let y = j === 0 ? (243 - (step - 26) * 17) : (175 - (step - 30) * 17);
                let x = xBase;
                // Ledger lines
                this.ctx.strokeStyle = "#4A65A5";
                this.ctx.lineWidth = 2;
                if (j === 0) {
                    if (y >= 413) for (let ly = 413; ly <= y + 5; ly += 34) { this.ctx.beginPath(); this.ctx.moveTo(x - 8, ly); this.ctx.lineTo(x + 28, ly); this.ctx.stroke(); }
                    if (y <= 209) for (let ly = 209; ly >= y - 5; ly -= 34) { this.ctx.beginPath(); this.ctx.moveTo(x - 8, ly); this.ctx.lineTo(x + 28, ly); this.ctx.stroke(); }
                } else {
                    if (y >= 209) for (let ly = 209; ly <= y + 5; ly += 34) { this.ctx.beginPath(); this.ctx.moveTo(x - 8, ly); this.ctx.lineTo(x + 28, ly); this.ctx.stroke(); }
                    if (y <= 5)   for (let ly = 5;   ly >= y - 5; ly -= 34) { this.ctx.beginPath(); this.ctx.moveTo(x - 8, ly); this.ctx.lineTo(x + 28, ly); this.ctx.stroke(); }
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
                window.noteHitboxes.push({ x: x + 10, y: y, freq: n.frequency, voiceIdx: n.voiceIdx, chordIdx: i, color: n.color });
                // Accidental
                if (n.accidental) {
                    let char = n.accidental === "b" ? "♭" : (n.accidental === "#" ? "♯" : n.accidental);
                    this.ctx.fillStyle = "white";
                    this.ctx.font = "bold 16px Arial";
                    this.ctx.fillText(char, x - 18, y + 6);
                }
            });
        });
    }

    setInsight(text) {
        document.getElementById("insight_label").innerText = text;
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
        this.drawPitches(window.lastChords);
        setTimeout(() => {
            if (window.activeGlows) {
                keys.forEach(k => window.activeGlows.delete(k));
                this.drawPitches(window.lastChords);
            }
        }, durationMs);
    }
}
