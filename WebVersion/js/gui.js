class GUI {
    constructor() {
        this.canvas = document.getElementById("staff_canvas");
        this.ctx = this.canvas.getContext("2d");
        
        // Populate instruments
        const selectContainer = document.getElementById("voice_instruments_frame");
        const voices = ["Basso", "V2", "V3", "V4", "V5", "V6", "Alto"];
        const defaults = ["Contrabbasso", "Violoncello", "Tromba", "Corno", "Viola", "Clarinetto", "Flauto"];
        const avail = Object.keys(window.audioEngine.instrumentPrograms);
        
        voices.forEach((v, i) => {
            let div = document.createElement("div");
            div.className = "flex-col align-center";
            div.innerHTML = `<span class="label text-muted" style="font-size: 11px;">${v}</span>`;
            
            let sel = document.createElement("select");
            sel.className = "dropdown small-btn";
            sel.onchange = (e) => window.audioEngine.setChannelInstrument(i, e.target.value);
            
            avail.forEach(inst => {
                let opt = document.createElement("option");
                opt.value = inst;
                opt.text = inst;
                if(inst === defaults[i]) opt.selected = true;
                sel.appendChild(opt);
            });
            div.appendChild(sel);
            selectContainer.appendChild(div);
        });

        // Populate Solo
        const solo_frame = document.getElementById("solo_buttons_frame");
        const solos = ["BASS", "V2", "V3", "V4", "V5", "V6", "TOP"];
        solos.forEach((s, i) => {
            let b = document.createElement("button");
            b.className = "btn solo-btn";
            b.innerText = s;
            b.onclick = () => {
                if(window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
                if(!window.currentVoicings) return;
                
                let cIdx = 0;
                function solNext() {
                    if(cIdx >= window.currentVoicings.length) return;
                    let chord = window.currentVoicings[cIdx];
                    if (chord && chord.length > i) {
                        let n = chord[i];
                        window.audioEngine.playPitch(n.voiceIdx, n.frequency, 1.2, cIdx);
                    }
                    cIdx++;
                    if(cIdx < window.currentVoicings.length) setTimeout(solNext, 1200);
                }
                solNext();
            };
            solo_frame.appendChild(b);
        });

        // Make canvas sharp on HiDPI displays
        const ratio = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * ratio;
        this.canvas.height = rect.height * ratio;
        this.ctx.scale(ratio, ratio);
        
        // Canvas onclick to play individual notes
        this.canvas.addEventListener("mousedown", (e) => {
            if(!window.noteHitboxes) return;
            const rct = this.canvas.getBoundingClientRect();
            
            // Proietta le coordinate CSS reali dello schermo sulle coordinate logiche (600x440) del Canvas
            const scaleX = 600 / rct.width;
            const scaleY = 440 / rct.height;
            
            const px = (e.clientX - rct.left) * scaleX;
            const py = (e.clientY - rct.top) * scaleY;
            
            for (let i = window.noteHitboxes.length - 1; i >= 0; i--) {
                let hb = window.noteHitboxes[i];
                if(Math.hypot(px - hb.x, py - hb.y) <= 11) { // 11px LOGICI di raggio
                    if(window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
                    window.audioEngine.playPitch(hb.voiceIdx, hb.freq, 1.0, hb.chordIdx);
                    
                    // Flash effect scalato
                    this.ctx.fillStyle = "#FFFFFF";
                    this.ctx.beginPath();
                    this.ctx.ellipse(hb.x, hb.y, 8.5, 4.5, 0, 0, 2*Math.PI);
                    this.ctx.fill();
                    setTimeout(() => window.gui.drawPitches(window.lastChords), 150);
                    break; // Clicca solo LA PRIMA nota in pila, non attiva adiacenti
                }
            }
        });

        this.drawEmptyStaff();
    }
    
    drawEmptyStaff() {
        const ratio = window.devicePixelRatio || 1;
        const logicW = 600;
        const logicH = 440;
        
        if (this.canvas.width !== Math.floor(logicW * ratio) || this.canvas.height !== Math.floor(logicH * ratio)) {
            this.canvas.width = Math.floor(logicW * ratio);
            this.canvas.height = Math.floor(logicH * ratio);
            this.ctx.scale(ratio, ratio);
        }
        
        const w = logicW;
        const h = logicH;
        
        this.ctx.clearRect(0, 0, w, h);
        
        this.ctx.fillStyle = "#050814";
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.strokeStyle = "#2E406A";
        this.ctx.lineWidth = 1;
        this.ctx.font = "normal 100px serif";
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
        if(!window.activeGlows) window.activeGlows = new Set();
        
        this.drawEmptyStaff();
        if(!chords || chords.length === 0) return;
        
        const w = 600; // Logico ripristinato
        let spacing = Math.min((w - 150) / (chords.length + 1), 160);
        
        chords.forEach((chordList, i) => {
            // Seleziona la coordinata x base. Se è 1 accordo centrato, lo mettiamo a metà.
            let xBase = chords.length === 1 ? w/2 - 20 : 100 + spacing * i;
            
            chordList.forEach((n) => {
                let j = n.voiceIdx;
                let step = n.step;
                let y = j === 0 ? (243 - (step - 26) * 17) : (175 - (step - 30) * 17);
                let x = xBase;
                
                // Ledgers espansi
                this.ctx.strokeStyle = "#4A65A5";
                this.ctx.lineWidth = 2;
                if (j === 0) {
                    if (y >= 413) for (let ly = 413; ly <= y + 5; ly += 34) { this.ctx.beginPath(); this.ctx.moveTo(x-8, ly); this.ctx.lineTo(x+28, ly); this.ctx.stroke(); }
                    if (y <= 209) for (let ly = 209; ly >= y - 5; ly -= 34) { this.ctx.beginPath(); this.ctx.moveTo(x-8, ly); this.ctx.lineTo(x+28, ly); this.ctx.stroke(); }
                } else {
                    if (y >= 209) for (let ly = 209; ly <= y + 5; ly += 34) { this.ctx.beginPath(); this.ctx.moveTo(x-8, ly); this.ctx.lineTo(x+28, ly); this.ctx.stroke(); }
                    if (y <= 5)  for (let ly = 5;  ly >= y - 5; ly -= 34) { this.ctx.beginPath(); this.ctx.moveTo(x-8, ly); this.ctx.lineTo(x+28, ly); this.ctx.stroke(); }
                }

                // Note Base
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

                // Gloss proporzionato
                this.ctx.fillStyle = "#FFFFFF";
                this.ctx.beginPath();
                this.ctx.ellipse(x + 5, y - 2, 4, 3, 0, 0, 2 * Math.PI);
                this.ctx.fill();

                // Salva Hitbox per l'interazione del mouse con mapping logico puro
                window.noteHitboxes.push({
                    x: x + 10, 
                    y: y, 
                    freq: n.frequency, 
                    voiceIdx: n.voiceIdx,
                    chordIdx: i,
                    color: n.color
                });

                // Accidental
                if(n.accidental) {
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

    highlight(voiceIdx, freq, durationMs, chordIdx=null) {
        if(!window.noteHitboxes) return;
        if(!window.activeGlows) window.activeGlows = new Set();
        
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
            if(window.activeGlows) {
                keys.forEach(k => window.activeGlows.delete(k));
                this.drawPitches(window.lastChords);
            }
        }, durationMs);
    }
}
