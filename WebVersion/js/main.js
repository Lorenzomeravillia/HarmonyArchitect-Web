// iOS detection (must precede start overlay handler)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

document.addEventListener("DOMContentLoaded", () => {
    // ── PWA Start Overlay ──────────────────────────────────
    let startOverlay = document.getElementById("start_overlay");
    if (startOverlay) {
        startOverlay.addEventListener("click", () => {
            startOverlay.style.display = "none";
            window.audioEngine.unlockAndLoad();
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

    console.log("=== MAIN JS: INIT ===");
    console.log("window.dbClient =", window.dbClient);

    // ── Paywall Dynamic Rendering ──────────────────────────
    function showPaywall() {
        const title = document.querySelector('#paywall_modal h2');
        const bodyText = document.getElementById('paywall_body_text');
        const loginBtn = document.getElementById('paywall_login_btn');
        const upgradeBtn = document.getElementById('paywall_upgrade_btn');
        
        if (window.currentUser) {
            loginBtn.classList.add('hidden');
            upgradeBtn.classList.remove('hidden');
            bodyText.textContent = "Your daily free slots are exhausted. Upgrade to PRO for infinite practice!";
            title.textContent = "Unlock Infinite Power ⚡";
        } else {
            loginBtn.classList.remove('hidden');
            upgradeBtn.classList.add('hidden');
            bodyText.textContent = "You've used all your anonymous sessions for today! Login to save your progress.";
            title.textContent = "Out of Energy ⚡";
        }
        document.getElementById('paywall_modal').classList.remove('hidden');
    }

    // ── Supabase & Auth Initialization ─────────────────────
    const profileBtn = document.getElementById('user_profile_btn');
    const authModal = document.getElementById('auth_modal');
    const paywallModal = document.getElementById('paywall_modal');
    const energyBadge = document.getElementById('energy_badge');

    async function updateEnergyUI() {
        let e = await window.getDbEnergy();
        if (energyBadge) energyBadge.textContent = e === '∞' ? '∞' : e;
    }

    if (window.initDbAuth) {
        window.initDbAuth(async (event, session) => {
            if (session) {
                authModal.classList.add('hidden');
                document.getElementById('auth_msg').textContent = "Logged in as " + session.user.email;
            } else {
                document.getElementById('auth_msg').textContent = "Save your stats and unlock more energy.";
            }
            await updateEnergyUI();
        });
    }

    profileBtn?.addEventListener('click', () => {
        if (window.currentUser) {
            // Already logged in, maybe show logout option in future, for now show alert
            alert("Logged in as: " + window.currentUser.email + "\nTier: " + (window.currentProfile?.tier || 'free'));
        } else {
            authModal.classList.remove('hidden');
        }
    });

    document.getElementById('auth_close_btn')?.addEventListener('click', () => {
        authModal.classList.add('hidden');
    });

    document.getElementById('auth_magic_link_btn')?.addEventListener('click', async () => {
        const email = document.getElementById('auth_email').value;
        if (!email || !email.includes('@')) return alert("Enter a valid email");
        
        const btn = document.getElementById('auth_magic_link_btn');
        btn.textContent = "Sending...";
        
        try {
            const client = window.getDbClient();
            if (!client) {
                btn.textContent = "Send Magic Link ✉️";
                return alert("Fatal error: cannot initialize Auth service. Are you offline?");
            }
            const { error } = await client.auth.signInWithOtp({ email: email });
            if (error) {
                alert("Error: " + error.message);
                btn.textContent = "Send Magic Link ✉️";
            } else {
                document.getElementById('auth_msg').textContent = "Check your email for the login link!";
                btn.style.display = 'none';
            }
        } catch (err) {
            console.error("Auth Exception:", err);
            alert("Network error. Please check your connection or ad-blocker.");
            btn.textContent = "Send Magic Link ✉️";
        }
    });
    // Paywall beta bypass
    document.getElementById('beta_bypass_btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.setItem('beta_bypass', 'true');
        alert("Developer Beta Bypass Activated! You now have unlimited local test energy.");
        document.getElementById('paywall_modal').classList.add('hidden');
        updateEnergyUI();
    });
    // Paywall buttons
    document.getElementById('paywall_login_btn')?.addEventListener('click', () => {
        paywallModal.classList.add('hidden');
        authModal.classList.remove('hidden');
    });
    
    document.getElementById('paywall_upgrade_btn')?.addEventListener('click', () => {
        alert("Redirecting to LemonSqueezy Checkout... (To be implemented)");
    });

    // ── Settings toggle (all viewports, starts closed) ─────
    const settingsToggle = document.getElementById("settings_toggle");
    const settingsPanel  = document.getElementById("settings_collapsible");

    function openSettings()  {
        settingsPanel?.classList.add("open");
        if (settingsToggle) settingsToggle.textContent = "⚙▴";
    }
    function closeSettings() {
        settingsPanel?.classList.remove("open");
        if (settingsToggle) settingsToggle.textContent = "⚙";
    }

    settingsToggle?.addEventListener("click", () => {
        if (settingsPanel?.classList.contains("open")) closeSettings();
        else openSettings();
    });

    // ── Gentle resume on first touchstart (iOS fallback) ───
    // ctx may be null if unlockAndLoad() hasn't fired yet — use optional chaining.
    document.addEventListener('touchstart', function () {
        if (window.audioEngine?.ctx?.state === 'suspended') {
            window.audioEngine.ctx.resume().catch(() => {});
        }
    }, { once: true, passive: true });

    // ── Reset button ────────────────────────────────────────
    document.getElementById('reset_btn')?.addEventListener('click', resetSession);

    // ── Level pool data ─────────────────────────────────────
    const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

    const LEVEL_POOLS_SINGLE = {
        "1: Basic Triads":    ["C", "Cm", "Cdim", "Caug", "F", "Fm", "G", "Gm", "Bb", "D", "Am"],
        "2: Seventh Chords":  ["Cmaj7", "Cm7", "C7", "Cm7b5", "Fmaj7", "G7", "Bbmaj7", "Ddim7"],
        "3: Jazz Extensions": ["Cmaj9", "C9", "C13", "G7alt", "G7b9", "Bb7#11", "D-9", "Fm9"],
        "4: Advanced":        ["A7alt", "Db7", "E7#9", "B13b9", "F#7b9"]
    };

    const LEVEL_POOLS_PROG = {
        "1: Basic Triads": [
            "I - IV - V - I|C|F|G|C",
            "I - vi - IV - V|C|Am|F|G",
            "i - iv - V - i|Cm|Fm|G|Cm",
            "i - VI - VII - i|Cm|Ab|Bb|Cm",
            "I - ii - V - I|C|Dm|G|C"
        ],
        "2: Seventh Chords": [
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
        "4: Advanced": [
            "ii7 - subV7 - Imaj7|Dm7|Db7|Cmaj7",
            "V7/ii - ii7 - V7 - Imaj7|A7|Dm7|G7|Cmaj7",
            "iim7 - subV7 - Imaj7|Fm7|E7|Ebmaj7"
        ]
    };

    window.currentSymbol = null;
    window.currentProgression = null;
    window.correctAnswerText = null;

    // ── Session tracking ────────────────────────────────────
    let sessionCorrect = 0;
    let sessionTotal   = 0;
    let streak         = 0;

    function getSessionSize() {
        const sel = document.getElementById('session_size_menu');
        return sel ? parseInt(sel.value) : 5;
    }

    // ── Earcons ─────────────────────────────────────────────
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
                [200, 212].forEach(f => {
                    let osc = ctx.createOscillator();
                    osc.type = 'sawtooth';
                    osc.frequency.value = f;
                    osc.connect(gain);
                    osc.start(now);
                    osc.stop(now + 0.25);
                });
            }
        } catch (e) {}
    }

    // ── Progress updates ────────────────────────────────────
    function updateProgress() {
        const sz   = getSessionSize();
        const fill = document.getElementById('progress_fill');
        const text = document.getElementById('progress_text');
        const topFill = document.getElementById('top_progress_fill');
        const pct  = sessionTotal > 0 ? Math.round(sessionCorrect / sessionTotal * 100) : 0;
        const prog = Math.min((sessionTotal / sz) * 100, 100);
        if (fill)    fill.style.width = prog + '%';
        if (topFill) topFill.style.width = prog + '%';
        if (text)    text.textContent = '✓' + sessionCorrect + '/' + sz + ' (' + pct + '%)';
    }

    function updateStreak() {
        const badge = document.getElementById('streak_badge');
        if (!badge) return;
        if (streak >= 2) {
            badge.style.display = 'inline';
            badge.textContent = '🔥' + streak;
            badge.style.animation = 'none';
            badge.offsetHeight; // reflow
            badge.style.animation = '';
        } else {
            badge.style.display = 'none';
        }
    }

    // ── Post-answer popup ───────────────────────────────────
    const CORRECT_MSGS = ['🎯 Perfect!', '⚡ Correct!', '🔥 Great!', '✨ Brilliant!', '🚀 Excellent!'];
    const WRONG_MSGS   = ['💡 Almost!', '🎓 Try again!', '🧠 Keep listening!', '🔄 Once more!'];

    function showNextPopup(correct) {
        // Show inline feedback controls (thumb zone)
        const inlineFb = document.getElementById('inline_feedback');
        if (inlineFb) inlineFb.classList.add('visible');
    }
    function hideNextPopup() {
        const inlineFb = document.getElementById('inline_feedback');
        if (inlineFb) inlineFb.classList.remove('visible');
    }

    document.getElementById('next_popup_continue').addEventListener('click', () => {
        hideNextPopup();
        startNewChallenge();
        setTimeout(() => document.getElementById('play_btn').click(), 300);
    });
    document.getElementById('next_popup_replay').addEventListener('click', () => {
        hideNextPopup();
        document.getElementById('play_btn').click();
    });
    document.getElementById('next_popup_stop').addEventListener('click', hideNextPopup);

    // ── Session complete ────────────────────────────────────
    function showSessionComplete() {
        const sz  = getSessionSize();
        const pct = Math.round(sessionCorrect / sz * 100);
        let badge, title;
        if (pct >= 90) { badge = '🥇'; title = 'Excellent!'; }
        else if (pct >= 70) { badge = '🥈'; title = 'Great work!'; }
        else if (pct >= 50) { badge = '🥉'; title = 'Good start!'; }
        else { badge = '💪'; title = 'Keep practicing!'; }
        let detail = sessionCorrect + '/' + sz + ' correct (' + pct + '%)';
        if (streak >= 3) detail += ' | Best streak: 🔥' + streak;
        document.getElementById('session_badge').textContent  = badge;
        document.getElementById('session_title').textContent  = title;
        document.getElementById('session_detail').textContent = detail;
        document.getElementById('session_overlay').classList.remove('hidden');
    }

    function resetSession() {
        sessionCorrect = 0;
        sessionTotal   = 0;
        streak         = 0;
        updateProgress();
        updateStreak();
        document.getElementById('session_overlay').classList.add('hidden');
        hideNextPopup();
    }

    document.getElementById('session_restart_btn')?.addEventListener('click', async () => {
        const hasEnergy = await window.consumeDbEnergy();
        updateEnergyUI();
        
        if (!hasEnergy) {
            showPaywall();
            return;
        }

        resetSession();
        startNewChallenge();
    });

    document.getElementById('session_size_menu')?.addEventListener('change', resetSession);

    // ── Level select ────────────────────────────────────────
    const levelSelect = document.getElementById("level_select");
    Object.keys(LEVEL_POOLS_SINGLE).forEach(lvl => {
        let opt = document.createElement("option");
        opt.value = lvl; opt.text = lvl;
        levelSelect.appendChild(opt);
    });

    // ── Chord transposer ────────────────────────────────────
    function transposeChord(chordStr, targetRoot) {
        const chromatic = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const match = chordStr.match(/^([A-G][b#]?)(.*)/);
        if (!match) return chordStr;
        const pcStr   = match[1];
        let idxOrig   = chromatic.indexOf(pcStr);
        if (idxOrig === -1) idxOrig = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(pcStr);
        let targetIdx = chromatic.indexOf(targetRoot);
        if (targetIdx === -1) targetIdx = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(targetRoot);
        const diff    = targetIdx - chromatic.indexOf('C');
        const newIdx  = (idxOrig + diff + 12) % 12;
        return chromatic[newIdx] + match[2];
    }

    // ── REVEAL button ───────────────────────────────────────
    document.getElementById('reveal_btn')?.addEventListener('click', () => {
        if (!window.correctAnswerText) return;
        // Show chord name in combo label
        const comboLbl = document.getElementById('combo_label');
        if (comboLbl) comboLbl.textContent = window.correctAnswerText.split('\n')[0];
        // Highlight correct answer button and lock all (no scoring)
        const answersFrame = document.querySelector('.answers-frame');
        if (answersFrame) {
            answersFrame.querySelectorAll('.answer-btn').forEach(btn => {
                btn.dataset.answered = '1';
                if (btn.dataset.answer === window.correctAnswerText) {
                    btn.classList.add('correct');
                    btn.textContent = '✓ ' + btn.dataset.answer.split('\n')[0];
                }
            });
        }
    });

    // ── Answer buttons ──────────────────────────────────────
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
            b.dataset.answer = o;
            if (o.includes("\n")) b.style.fontSize = "14px";

            b.onclick = () => {
                if (b.dataset.answered) return;
                answersFrame.querySelectorAll('.answer-btn').forEach(btn => btn.dataset.answered = '1');

                sessionTotal++;
                const correct = (o === window.correctAnswerText);

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
                if (navigator.vibrate) navigator.vibrate(correct ? 10 : [30, 20, 30]);

                setTimeout(() => {
                    if (sessionTotal >= getSessionSize()) showSessionComplete();
                    else showNextPopup(correct);
                }, 1000);
            };
            answersFrame.appendChild(b);
        });
    }

    // ── Start new challenge ─────────────────────────────────
    async function startNewChallenge() {
        if (sessionTotal === 0 && sessionCorrect === 0) {
            // Check energy ONLY at the very beginning of a completely new session
            let energyStr = await window.getDbEnergy();
            if (energyStr !== '∞' && parseInt(energyStr) <= 0) {
                showPaywall();
                return; // Stop here, don't start the challenge
            }
        }

        hideNextPopup();
        closeSettings();
        if (window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
        window.gui.drawPitches([]);
        window.gui.resetSoloButtons();

        const isProgression = document.getElementById("play_mode_menu").value.includes("Progression");
        const level = document.getElementById("level_select").value;
        const root  = ROOTS[Math.floor(Math.random() * ROOTS.length)];

        if (isProgression) {
            let pool = LEVEL_POOLS_PROG[level] || LEVEL_POOLS_PROG["1: Basic Triads"];
            let item = pool[Math.floor(Math.random() * pool.length)];
            let parts = item.split("|");
            let name = parts[0] + "\n(" + parts.slice(1).map(c => transposeChord(c, root)).join(" - ") + ")";
            window.currentProgression = parts.slice(1).map(c => transposeChord(c, root));
            document.getElementById("combo_label").innerText = "";
            window.realProgressionLabel = parts[0].split("\n")[0] + " in " + root;

            let wrongOpts = [];
            let safePool  = pool.filter(p => p !== item);
            safePool.forEach(p => {
                let pparts = p.split("|");
                wrongOpts.push(pparts[0] + "\n(" + pparts.slice(1).map(c => transposeChord(c, root)).join(" - ") + ")");
            });
            if (wrongOpts.length < 3) {
                let usedNames = new Set([parts[0], ...safePool.map(p => p.split("|")[0])]);
                for (let lvlPool of Object.values(LEVEL_POOLS_PROG)) {
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
            let pool = LEVEL_POOLS_SINGLE[level] || LEVEL_POOLS_SINGLE["1: Basic Triads"];
            let sym  = pool[Math.floor(Math.random() * pool.length)];
            let match = sym.match(/^([A-G][b#]?)(.*)/);
            let qual  = match ? match[2] : "";
            let targetChord = root + qual;
            window.currentSymbol = targetChord;
            document.getElementById("combo_label").innerText = "";
            window.realProgressionLabel = targetChord;

            let wrongQuals = [];
            pool.forEach(p => {
                let pm = p.match(/^([A-G][b#]?)(.*)/);
                if (pm && pm[2] !== qual && !wrongQuals.includes(pm[2])) wrongQuals.push(pm[2]);
            });
            createAnswers(targetChord, wrongQuals.map(q => root + q));
        }
    }

    document.getElementById("next_btn")?.addEventListener("click", startNewChallenge);

    // ── PLAY button ─────────────────────────────────────────
    document.getElementById("play_btn").addEventListener("click", () => {
        if (window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
        if (!window.currentSymbol && !window.currentProgression) startNewChallenge();

        const baseOctave  = "C3";
        const isOptimized = document.getElementById("voice_leading_menu").value.includes("Optimized");
        const tempoMs     = parseInt((document.getElementById("tempo_menu") || {}).value) || 1560;
        const cutDuration = (tempoMs / 1000) * 0.82;

        if (window.currentProgression) {
            let prevV = null;
            let voicings = window.currentProgression.map(s => {
                let v = window.musicEngine.generateVoicing(s, baseOctave, isOptimized, prevV);
                prevV = v;
                return v;
            });
            window.currentVoicings = voicings;
            window.gui.drawPitches(voicings);
            window.gui.updateSoloButtons(voicings[0]);
            voicings.forEach((v, i) => setTimeout(() => window.audioEngine.playChord(v, cutDuration, i), i * tempoMs));
            window.gui.setInsight("Progression (" + tempoMs + "ms). Drop-2: " + (isOptimized ? "ON" : "OFF"));
        } else {
            let sym = window.currentSymbol;
            let targetVoicing = window.musicEngine.generateVoicing(sym, baseOctave, isOptimized);
            window.currentVoicings = [targetVoicing];
            window.gui.drawPitches([targetVoicing]);
            window.gui.updateSoloButtons(targetVoicing);
            window.audioEngine.playChord(targetVoicing, cutDuration, 0);
            window.gui.setInsight(`Base: C3 | Voicing: ${isOptimized ? "Opt. (Drop-2)" : "Root"}`);
        }
    });

    // ── ARPEGGIATOR ─────────────────────────────────────────
    document.getElementById("arpeggio_btn").addEventListener("click", () => {
        if (window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
        if (!window.currentVoicings) return;
        const tempoMs = parseInt((document.getElementById("tempo_menu") || {}).value) || 1560;
        let cIdx = 0, pIdx = 0;
        function arpNext() {
            if (cIdx >= window.currentVoicings.length) return;
            let chord = window.currentVoicings[cIdx];
            if (pIdx >= chord.length) {
                pIdx = 0; cIdx++;
                if (cIdx < window.currentVoicings.length) setTimeout(arpNext, tempoMs);
                return;
            }
            let note = chord[pIdx];
            window.audioEngine.playPitch(note.voiceIdx, note.frequency, 0.6, cIdx);
            pIdx++;
            setTimeout(arpNext, tempoMs * 0.30);
        }
        arpNext();
    });
});
