document.addEventListener("DOMContentLoaded", () => {
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // PWA Start Overlay
    let startOverlay = document.getElementById("start_overlay");
    if(startOverlay) {
        startOverlay.addEventListener("click", (e) => {
            startOverlay.style.display = "none";
            // Skip fullscreen on iOS — it doesn't work
            if (!isIOS) {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen();
                } else if (document.documentElement.webkitRequestFullscreen) {
                    document.documentElement.webkitRequestFullscreen();
                }
            }
        });
    }

    window.gui = new GUI();

    // Settings toggle for mobile
    let settingsToggle = document.getElementById("settings_toggle");
    let settingsPanel = document.getElementById("settings_collapsible");
    if (settingsToggle && settingsPanel) {
        settingsToggle.addEventListener("click", () => {
            settingsPanel.classList.toggle("open");
            settingsToggle.textContent = settingsPanel.classList.contains("open") ? "CHIUDI ▴" : "MENU ▾";
        });
    }

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

    // Session tracking
    let sessionCorrect = 0;
    let sessionTotal = 0;
    let streak = 0;

    function getSessionSize() {
        let sel = document.getElementById('session_size_menu');
        return sel ? parseInt(sel.value) : 10;
    }

    // Earcons — simple WebAudio tones
    function playEarcon(correct) {
        try {
            let ctx = window.audioEngine?.ctx;
            if (!ctx) return;
            let now = ctx.currentTime;
            let gain = ctx.createGain();
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + (correct ? 0.3 : 0.25));

            if (correct) {
                [523.25, 659.25].forEach((f, i) => {
                    let osc = ctx.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.value = f;
                    osc.connect(gain);
                    osc.start(now + i * 0.05);
                    osc.stop(now + 0.3);
                });
            } else {
                let osc1 = ctx.createOscillator();
                osc1.type = 'sawtooth';
                osc1.frequency.value = 200;
                osc1.connect(gain);
                osc1.start(now);
                osc1.stop(now + 0.25);
                let osc2 = ctx.createOscillator();
                osc2.type = 'sawtooth';
                osc2.frequency.value = 212;
                osc2.connect(gain);
                osc2.start(now);
                osc2.stop(now + 0.25);
            }
        } catch(e) {}
    }

    // Unified progress bar + text
    function updateProgress() {
        let sz = getSessionSize();
        let fill = document.getElementById('progress_fill');
        let text = document.getElementById('progress_text');
        let pct = sessionTotal > 0 ? Math.round(sessionCorrect / sessionTotal * 100) : 0;
        if (fill) fill.style.width = Math.min((sessionTotal / sz) * 100, 100) + '%';
        if (text) text.textContent = '✓' + sessionCorrect + '/' + sz + ' (' + pct + '%)';
    }

    // Streak badge
    function updateStreak() {
        let badge = document.getElementById('streak_badge');
        if (!badge) return;
        if (streak >= 2) {
            badge.style.display = 'inline';
            badge.textContent = '🔥' + streak;
            badge.style.animation = 'none';
            badge.offsetHeight;
            badge.style.animation = '';
        } else {
            badge.style.display = 'none';
        }
    }

    // Post-answer popup
    const CORRECT_MSGS = ['🎯 Perfetto!', '⚡ Esatto!', '🔥 Ottimo!', '✨ Bravo!', '🚀 Eccellente!'];
    const WRONG_MSGS = ['💡 Quasi!', '🎓 Riprova!', '🧠 Studia!', '🔄 Ancora!'];

    function showNextPopup(correct) {
        let icon = correct ? '✅' : '❌';
        let msgs = correct ? CORRECT_MSGS : WRONG_MSGS;
        let msg = msgs[Math.floor(Math.random() * msgs.length)];
        if (streak >= 3) msg = '🔥 Streak x' + streak + '!';
        document.getElementById('next_popup_icon').textContent = icon;
        document.getElementById('next_popup_msg').textContent = msg;
        document.getElementById('next_popup').classList.remove('hidden');
    }
    function hideNextPopup() {
        document.getElementById('next_popup').classList.add('hidden');
    }

    // Popup buttons
    document.getElementById('next_popup_continue').addEventListener('click', () => {
        hideNextPopup();
        startNewChallenge();
        // Auto-play the new challenge so user immediately hears it
        setTimeout(() => document.getElementById('play_btn').click(), 300);
    });
    document.getElementById('next_popup_replay').addEventListener('click', () => {
        hideNextPopup();
        document.getElementById('play_btn').click();
    });
    document.getElementById('next_popup_stop').addEventListener('click', hideNextPopup);

    // Session completion overlay
    function showSessionComplete() {
        let sz = getSessionSize();
        let pct = Math.round(sessionCorrect / sz * 100);
        let badge, title, detail;

        if (pct >= 90) { badge = '🥇'; title = 'Eccellente!'; }
        else if (pct >= 70) { badge = '🥈'; title = 'Ottimo lavoro!'; }
        else if (pct >= 50) { badge = '🥉'; title = 'Buon inizio!'; }
        else { badge = '💪'; title = 'Continua a provare!'; }

        detail = sessionCorrect + '/' + sz + ' corrette (' + pct + '%)';
        if (streak >= 3) detail += ' | Best streak: 🔥' + streak;

        document.getElementById('session_badge').textContent = badge;
        document.getElementById('session_title').textContent = title;
        document.getElementById('session_detail').textContent = detail;
        document.getElementById('session_overlay').classList.remove('hidden');
    }

    function resetSession() {
        sessionCorrect = 0;
        sessionTotal = 0;
        streak = 0;
        updateProgress();
        updateStreak();
        document.getElementById('session_overlay').classList.add('hidden');
        hideNextPopup();
    }

    // Session restart button
    document.getElementById('session_restart_btn')?.addEventListener('click', () => {
        resetSession();
        startNewChallenge();
    });

    // Session size change resets session
    document.getElementById('session_size_menu')?.addEventListener('change', resetSession);

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
            b.innerText = o;
            b.dataset.answer = o; // Store original answer for matching
            if(o.includes("\n")) b.style.fontSize = "12px";
            
            b.onclick = () => {
                // Prevent double-click
                if (b.dataset.answered) return;
                answersFrame.querySelectorAll('.answer-btn').forEach(btn => btn.dataset.answered = '1');

                sessionTotal++;
                let correct = (o === window.correctAnswerText);

                if (correct) {
                    sessionCorrect++;
                    streak++;
                    b.classList.add('correct');
                    b.innerText = "✓ " + o.split("\n")[0];
                    document.getElementById("combo_label").innerText = window.realProgressionLabel || o.split("\n")[0];
                } else {
                    streak = 0;
                    b.classList.add('wrong');
                    b.innerText = "✗ " + o.split("\n")[0];
                    // Highlight ONLY the correct answer
                    answersFrame.querySelectorAll('.answer-btn').forEach(btn => {
                        if (btn.dataset.answer === window.correctAnswerText) {
                            btn.classList.add('correct');
                            btn.innerText = "✓ " + btn.dataset.answer.split("\n")[0];
                        }
                    });
                }

                playEarcon(correct);
                updateProgress();
                updateStreak();

                // Haptic feedback
                if (navigator.vibrate) navigator.vibrate(correct ? 10 : [30, 20, 30]);

                // Show popup after 1s, or session complete if done
                setTimeout(() => {
                    if (sessionTotal >= getSessionSize()) {
                        showSessionComplete();
                    } else {
                        showNextPopup(correct);
                    }
                }, 1000);
            };
            answersFrame.appendChild(b);
        });
    }

    function startNewChallenge() {
        hideNextPopup();
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
            
            // Borrow from other levels if not enough distractors
            if (wrongOpts.length < 3) {
                let usedNames = new Set([parts[0], ...safePool.map(p => p.split("|")[0])]);
                let allLevels = Object.values(LEVEL_POOLS_PROG);
                for (let lvlPool of allLevels) {
                    for (let p of lvlPool) {
                        if (wrongOpts.length >= 3) break;
                        let pparts = p.split("|");
                        if (!usedNames.has(pparts[0])) {
                            usedNames.add(pparts[0]);
                            wrongOpts.push(pparts[0] + "\n(" + pparts.slice(1).map(c => transposeChord(c, root)).join(" - ") + ")");
                        }
                    }
                    if (wrongOpts.length >= 3) break;
                }
            }
            
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
        let tempoMs = tempoMenu ? parseInt(tempoMenu.value) : 1560;
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
                setTimeout(() => window.audioEngine.playChord(v, cutDuration, i), i * tempoMs); 
            });
            window.gui.setInsight("Progressione (" + tempoMs + "ms). Drop-2: " + (isOptimized ? "ON" : "OFF"));
        } else {
            let sym = window.currentSymbol;
            let targetVoicing = window.musicEngine.generateVoicing(sym, baseOctave, isOptimized);
            window.currentVoicings = [targetVoicing];
            window.gui.drawPitches([targetVoicing]); 
            // In modalità accordo singolo indichiamo chordIdx 0
            window.audioEngine.playChord(targetVoicing, cutDuration, 0);
            
            let insight = `Base: C3 | Inversioni: ${isOptimized ? "Ott. (Drop-2)" : "Root"}`;
            window.gui.setInsight(insight);
        }
    });

    document.getElementById("arpeggio_btn").addEventListener("click", () => {
        if(window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
        if(!window.currentVoicings) return; 
        
        let tempoMenu = document.getElementById("tempo_menu");
        let tempoMs = tempoMenu ? parseInt(tempoMenu.value) : 1560;
        
        let cIdx = 0;
        let pIdx = 0;
        
        function arpNext() {
            if(cIdx >= window.currentVoicings.length) return;
            let chord = window.currentVoicings[cIdx];
            
            if(pIdx >= chord.length) {
                pIdx = 0;
                cIdx++;
                let isoTempo = parseInt((document.getElementById('tempo_menu') || {}).value) || 1560;
                if(cIdx < window.currentVoicings.length) setTimeout(arpNext, isoTempo);
                return;
            }
            
            let note = chord[pIdx];
            window.audioEngine.playPitch(note.voiceIdx, note.frequency, 0.6, cIdx);
            pIdx++;
            setTimeout(arpNext, tempoMs * 0.18); 
        }
        arpNext();
    });
});
