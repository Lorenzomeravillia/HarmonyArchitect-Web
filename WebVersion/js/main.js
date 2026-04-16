// iOS detection (must precede start overlay handler)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

let currentSessionId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'sim-' + Date.now();
let currentSessionStart = null;
let currentChallengeStart = null;
let currentRevealUsed = false;
let currentSoloUsed = false;
let currentChallengeReplays = 0;
let currentSessionReplayCount = 0;
let currentSessionRevealCount = 0;

window._playbackSessionId = 0;
window.cancelActivePlaybacks = function() {
    window._playbackSessionId++;
    if (window.audioEngine && window.audioEngine.stopAll) window.audioEngine.stopAll();
};

document.addEventListener("DOMContentLoaded", async () => {
    if (window.dbClient) window.dbClient.init();

    // [B2B MIGRATION] Class Join Interceptor
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join_class');
    
    if (joinCode) {
        document.getElementById('start_overlay').style.display = 'none';
        document.getElementById('join_class_modal').style.display = 'flex';
        
        document.getElementById('btn_confirm_join').onclick = async () => {
            const name = document.getElementById('join_student_name').value.trim();
            if (!name) return;
            
            document.getElementById('btn_confirm_join').innerText = 'Connessione Cloud...';
            
            let checks = 0;
            while ((!window.dbClient || !window.dbClient.isReady) && checks < 50) {
                await new Promise(r => setTimeout(r, 100));
                checks++;
            }
            
            if (window.dbClient && window.dbClient.isReady) {
                const { data: cData } = await window.dbClient.supabase.schema('cv').from('classes').select('id, name').eq('invite_code', joinCode).single();
                if (cData) {
                    const uid = window.dbClient.getUserId();
                    await window.dbClient.supabase.schema('cv').from('class_members').upsert({
                        class_id: cData.id,
                        user_id: uid,
                        display_name: name
                    });
                    
                    alert("Benvenuto nella classe: " + cData.name + "! Tutti i tuoi esercizi d'ora in poi genereranno report automatici per l'insegnante.");
                    window.history.replaceState({}, document.title, window.location.pathname);
                } else {
                    const e = document.getElementById('join_error_text');
                    e.innerText = "Codice classe disattivato o inesistente.";
                    e.style.display = 'block';
                    return;
                }
            } else {
                alert("Errore connettore DB offline.");
            }
            
            document.getElementById('join_class_modal').style.display = 'none';
            document.getElementById('start_overlay').style.display = 'flex';
        };
    }

    // Event Delegation tracking for Solos
    document.getElementById("solo_buttons_frame")?.addEventListener("click", () => currentSoloUsed = true, true);

    // ── PWA Start Overlay ──────────────────────────────────
    let startOverlay = document.getElementById("start_overlay");
    if (startOverlay) {
        startOverlay.addEventListener("click", (e) => {
            if (e.target.tagName.toLowerCase() === 'a') {
                return; // Let the link work!
            }
            startOverlay.style.display = "none";
            window.audioEngine.unlockAndLoad();
            // Pre-load first challenge so PLAY is ready immediately
            startNewChallenge();
            if (!isIOS) {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen();
                } else if (document.documentElement.webkitRequestFullscreen) {
                    document.documentElement.webkitRequestFullscreen();
                }
            }
            if (window._coachAutoStart) {
                window._coachAutoStart();
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
        
        const user = window.dbClient?.user;
        const authProv = user?.app_metadata?.provider || 'anonymous';
        if (user && authProv !== 'anonymous') {
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

    window.getDbEnergy = async () => {
        if (window.dbClient) return await window.dbClient.getEnergy();
        return '∞';
    };

    window.consumeDbEnergy = async () => {
        return true; // Infinite energy during beta phase
    };

    async function updateEnergyUI() {
        let e = await window.getDbEnergy();
        if (energyBadge) energyBadge.textContent = e === '∞' ? '∞' : e;
    }

    // Since dbClient initializes asynchronously inside DOMContentLoaded, we don't need a heavy callback observer. 
    // We just poll or wait for dbClient.isReady
    // Adaptive polling for dbClient readiness to avoid slow-network races
    const dbPoller = setInterval(async () => {
        if (window.dbClient && window.dbClient.isReady) {
            clearInterval(dbPoller);
            
            if (window.dbClient.user) {
                const isAnon = window.dbClient.user.app_metadata?.provider === 'anonymous';
                if (!isAnon) {
                    authModal.classList.add('hidden');
                    document.getElementById('auth_msg').textContent = "Logged in as " + window.dbClient.user.email;
                }
                
                // Tutti gli iscritti a una classe (anche Maestri in test) meritano di vedere il loro nome palesarsi
                window.dbClient.supabase.schema('cv').from('class_members')
                    .select('display_name')
                    .eq('user_id', window.dbClient.user.id)
                    .limit(1)
                    .single()
                    .then(({ data }) => {
                        if (data && data.display_name) {
                            const badgeName = document.getElementById('student_badge_name');
                            const badgeContainer = document.getElementById('student_badge_container');
                            if (badgeName && badgeContainer) {
                                badgeName.innerText = data.display_name;
                                badgeContainer.style.display = 'flex';
                            }
                        }
                    }).catch(e => { /* Not a student, suppress error */ });
            }
            await updateEnergyUI();
        }
    }, 500);

    profileBtn?.addEventListener('click', () => {
        const user = window.dbClient?.user;
        const isAnon = user?.app_metadata?.provider === 'anonymous';
        if (user && !isAnon) {
            alert("Logged in as: " + user.email + "\nTier: free");
        } else {
            authModal.classList.remove('hidden');
        }
    });

    document.getElementById('auth_close_btn')?.addEventListener('click', () => {
        authModal.classList.add('hidden');
    });
    // Click backdrop to close
    authModal?.addEventListener('click', (e) => {
        if (e.target === authModal) authModal.classList.add('hidden');
    });
    paywallModal?.addEventListener('click', (e) => {
        if (e.target === paywallModal) paywallModal.classList.add('hidden');
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
        "3: Jazz Extensions": ["Cmaj9", "C9", "C13", "G7alt", "G7b9", "Bb7#11", "Dm9", "Fm9"],
        "4: Advanced":        ["A7alt", "Db7", "E7#9", "B13b9", "F#7b9"]
    };

    const LEVEL_POOLS_PROG = {
        "1: Basic Triads": [
            "I - IV - V - I|C|F|G|C",
            "I - vim - IV - V|C|Am|F|G",
            "im - ivm - V - im|Cm|Fm|G|Cm",
            "im - VI - VII - im|Cm|Ab|Bb|Cm",
            "I - iim - V - I|C|Dm|G|C"
        ],
        "2: Seventh Chords": [
            "iim7 - V7 - Imaj7|Dm7|G7|Cmaj7",
            "iiø7 - V7 - im7|Dm7b5|G7|Cm7",
            "Imaj7 - vim7 - iim7 - V7|Cmaj7|Am7|Dm7|G7",
            "im7 - ivm7 - VII7 - IIImaj7|Cm7|Fm7|Bb7|Ebmaj7"
        ],
        "3: Jazz Extensions": [
            "iim9 - V13 - Imaj9|Dm9|G13|Cmaj9",
            "iiø7 - V7alt - im9|Dm7b5|G7alt|Cm9",
            "Imaj9 - VI7alt - iim9 - V13|Cmaj9|A7alt|Dm9|G13",
            "im9 - bVImaj9 - iiø7 - V7alt|Cm9|Abmaj9|Dm7b5|G7alt"
        ],
        "4: Advanced": [
            "iim7 - subV7 - Imaj7|Dm7|Db7|Cmaj7",
            "V7/ii - iim7 - V7 - Imaj7|A7|Dm7|G7|Cmaj7",
            "Imaj7 - bIII7 - bVImaj7 - subV7|Cmaj7|Eb7|Abmaj7|Db7"
        ]
    };
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
        // Do NOT hide inline controls — only replay the audio
        document.getElementById('play_btn').click();
    });
    document.getElementById('next_popup_stop').addEventListener('click', hideNextPopup);

    // ── Session complete ────────────────────────────────────
    function showSessionComplete() {
        const sz  = getSessionSize();
        const pct = Math.round(sessionCorrect / sz * 100);

        if (window.dbClient && window.dbClient.isReady && currentSessionStart) {
             const sessionPayload = {
                 id: currentSessionId,
                 user_id: window.dbClient.getUserId(),
                 started_at: currentSessionStart.toISOString(),
                 completed_at: new Date().toISOString(),
                 level: parseInt(document.getElementById("level_select").value.charAt(0)) || 1,
                 mode: document.getElementById("play_mode_menu").value,
                 timbre_preset: document.querySelector('.preset-btn.active')?.textContent || 'default',
                 tempo: (document.getElementById("tempo_menu") || {}).value || '1560',
                 voice_leading: document.getElementById("voice_leading_menu").value,
                 total_challenges: sz,
                 correct_count: sessionCorrect,
                 reveal_count: currentSessionRevealCount,
                 replay_count: currentSessionReplayCount,
                 score_pct: pct,
                 duration_seconds: Math.floor((Date.now() - currentSessionStart.getTime()) / 1000)
             };
             window.dbClient.saveSession(sessionPayload);
        }

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
        currentSessionId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'sim-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        currentSessionStart = null;
        currentSessionReplayCount = 0;
        currentSessionRevealCount = 0;
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

    // ── Reactive Auto-Regeneration ──────────────────────────
    function handleReactiveRegen() {
        // Only trigger mid-session regeneration if the app is visibly running
        if (document.getElementById("start_overlay")?.style.display === "none") {
            resetSession();
            startNewChallenge();
            if (navigator.vibrate) navigator.vibrate(10);
            
            // Switch play button back back to START visually if it was green
            const playBtn = document.getElementById('play_btn');
            if (playBtn && playBtn.textContent === '▶ PLAY') playBtn.textContent = '▶ START';
        }
    }
    
    document.getElementById("play_mode_menu")?.addEventListener("change", handleReactiveRegen);
    document.getElementById("level_select")?.addEventListener("change", handleReactiveRegen);
    
    document.getElementById("adaptive_mode_menu")?.addEventListener("change", (e) => {
        handleReactiveRegen();
        const smartBadge = document.getElementById("smart_badge");
        if (smartBadge) {
            smartBadge.style.display = e.target.value === "on" ? "inline-block" : "none";
        }
    });

    // ── Chord transposer ────────────────────────────────────
    function transposeChord(chordStr, targetRoot) {
        const sharpRoots = ['G','D','A','E','B','F#','C#'];
        const chromaticSharp = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const chromaticFlat  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const chromatic = sharpRoots.includes(targetRoot) ? chromaticSharp : chromaticFlat;

        const match = chordStr.match(/^([A-G][b#]?)(.*)/);
        if (!match) return chordStr;
        const pcStr   = match[1];

        // Find idxOrig in either reference array
        let idxOrig = chromaticFlat.indexOf(pcStr);
        if (idxOrig === -1) idxOrig = chromaticSharp.indexOf(pcStr);

        let targetIdx = chromaticFlat.indexOf(targetRoot);
        if (targetIdx === -1) targetIdx = chromaticSharp.indexOf(targetRoot);

        const diff    = targetIdx - 0; // C is index 0
        const newIdx  = (idxOrig + diff + 12) % 12;
        let finalRoot = chromatic[newIdx];
        let typeStr   = match[2];
        if (window.musicEngine) {
            finalRoot = window.musicEngine._normalizeRoot(finalRoot, typeStr);
        }
        return finalRoot + typeStr;
    }

    // ── REVEAL button ───────────────────────────────────────
    document.getElementById('reveal_btn')?.addEventListener('click', () => {
        if (!window.correctAnswerText) return;
        currentRevealUsed = true;
        currentSessionRevealCount++;
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
        // Show inline feedback controls (Replay / Play Next)
        showNextPopup(false);
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

            b.onclick = () => {
              try {
                if (b.dataset.answered) return;
                answersFrame.querySelectorAll('.answer-btn').forEach(btn => btn.dataset.answered = '1');

                const reactionTime = currentChallengeStart ? Date.now() - currentChallengeStart : null;
                currentChallengeStart = null;

                sessionTotal++;
                const correct = (o === window.correctAnswerText);

                if (window.dbClient && window.dbClient.isReady) {
                    const payload = {
                        user_id: window.dbClient.getUserId(),
                        session_id: currentSessionId,
                        challenge_index: sessionTotal,
                        chord_type: window.realProgressionLabel || window.currentSymbol,
                        chord_root: window.currentKeyContext ? window.currentKeyContext.root : (window.currentSymbol ? window.currentSymbol.substring(0, window.currentSymbol.length - (window.currentSymbol.match(/m|7|dim|aug|sus|M.*/) || [''])[0].length) : 'C'),
                        chord_quality: window.currentSymbol && window.currentSymbol.match(/m|7|dim|aug|sus|M.*/) ? window.currentSymbol.match(/m|7|dim|aug|sus|M.*/)[0] : 'triad',
                        key_context: window.currentKeyContext ? window.currentKeyContext.root : null,
                        roman_numeral: window.realProgressionLabel,
                        progression_sequence: window.currentProgression || [],
                        answer_given: o,
                        is_correct: correct,
                        used_reveal: currentRevealUsed,
                        used_solo: currentSoloUsed,
                        replay_count: currentChallengeReplays,
                        reaction_time_ms: reactionTime
                    };
                    window.dbClient.saveChallenge(payload);
                    if (window.adaptiveEngine) {
                        window.adaptiveEngine.updateWeakSpots(window.dbClient.getUserId(), payload, correct);
                    }
                }
                
                currentRevealUsed = false;
                currentSoloUsed = false;
                currentChallengeReplays = 0;

                if (correct) {
                    sessionCorrect++;
                    streak++;
                    b.classList.add('correct');
                    b.innerText = "✓ " + o.split("\n")[0];
                    // combo_label removed from UI
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
              } catch (e) {
                alert("CRASH IN ANSWER_BTN: " + e.message + "\n\n" + e.stack);
              }
            };
            answersFrame.appendChild(b);
        });

        // Auto-scale font for long answer texts (Progression mode)
        const maxLen = Math.max(...opts.map(o => {
            const lines = o.split('\n');
            return Math.max(lines[0].length, lines[1] ? lines[1].length : 0);
        }));

        if (maxLen > 33) {
            answersFrame.querySelectorAll('.answer-btn').forEach(b => {
                b.style.fontSize = '10px';
                b.style.padding = '8px 4px';
                b.style.whiteSpace = 'pre-wrap';
                b.style.wordBreak = 'break-word';
            });
        } else if (maxLen > 24) {
            answersFrame.querySelectorAll('.answer-btn').forEach(b => {
                b.style.fontSize = '12px';
                b.style.whiteSpace = 'pre-wrap';
                b.style.wordBreak = 'break-word';
            });
        }
        
        if (!window.hasPlayedCurrentChallenge) {
            answersFrame.style.opacity = '0.5';
            answersFrame.style.pointerEvents = 'none';
        }
    }

    // ── Start new challenge ─────────────────────────────────
    async function startNewChallenge() {
        if (sessionTotal === 0 && sessionCorrect === 0) {
            // Check energy ONLY at the very beginning of a completely new session
            let energyStr = await window.getDbEnergy();
            if (energyStr !== '∞' && parseInt(energyStr) <= 0) {
                showPaywall();
                return false; // Stop here, don't start the challenge
            }
        }

        hideNextPopup(); // Ensure feedback controls hidden on new challenge
        closeSettings();
        if (window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
        window.gui.drawPitches([]);
        window.gui.resetSoloButtons();
        
        window.hasPlayedCurrentChallenge = false;

        const isProgression = document.getElementById("play_mode_menu").value.includes("Progression");
        const level = document.getElementById("level_select").value;
        const root  = ROOTS[Math.floor(Math.random() * ROOTS.length)];

        // --- ADAPTIVE OVERRIDES ---
        let currentRoot = root;
        let overrides = null;
        if (window.adaptiveEngine && document.getElementById("adaptive_mode_menu")?.value === "on") {
            const userId = window.dbClient?.getUserId();
            if (userId) overrides = await window.adaptiveEngine.selectNextChallengeOverrides(userId, level, isProgression ? "progression" : "single");
        }
        if (overrides && overrides.forceRoot) currentRoot = overrides.forceRoot;

        if (isProgression) {
            let pool = LEVEL_POOLS_PROG[level] || LEVEL_POOLS_PROG["1: Basic Triads"];
            let targetItem = null;
            if (overrides && overrides.forceProgression) {
                 const match = pool.find(p => p.startsWith(overrides.forceProgression));
                 if (match) targetItem = match;
            }
            let item = targetItem || pool[Math.floor(Math.random() * pool.length)];
            let parts = item.split("|");
            let name = parts[0] + "\n(" + parts.slice(1).map(c => transposeChord(c, currentRoot)).join(" - ") + ")";
            window.currentProgression = parts.slice(1).map(c => transposeChord(c, currentRoot));
            document.getElementById("combo_label")?.innerText;
            window.realProgressionLabel = parts[0].split("\n")[0] + " in " + currentRoot;

            // Determine key context for key signature rendering (Global Standard)
            const isMinorProg = parts.slice(1).some(c => /^Cm([^a-zA-Z]|$)/.test(c));
            window.currentKeyContext = { root: currentRoot, isMajor: !isMinorProg };
            window.gui.drawPitches([], window.currentKeyContext);

            let wrongOpts = [];
            let targetLength = parts.length - 1; // Number of chords
            let safePool  = pool.filter(p => {
                let pparts = p.split("|");
                return p !== item && (pparts.length - 1 === targetLength);
            });
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
                        let pLength = pparts.length - 1;
                        if (pLength === targetLength && !usedNames.has(pparts[0])) {
                            usedNames.add(pparts[0]);
                            wrongOpts.push(pparts[0] + "\n(" + pparts.slice(1).map(c => transposeChord(c, root)).join(" - ") + ")");
                        }
                    }
                    if (wrongOpts.length >= 3) break;
                }
            }
            createAnswers(name, wrongOpts);
            // Pre-generate voicing so SOLO buttons appear immediately
            let _prevV = null;
            const _isOpt = document.getElementById('voice_leading_menu').value.includes('Optimized');
            const _vv = window.currentProgression.map(s => {
                const v = window.musicEngine.generateVoicing(s, 'C3', _isOpt, _prevV);
                _prevV = v; // FIXED: Update context for the next chord
                return v;
            });
            window.currentVoicings = _vv;
            // UI Fix: Ricerca l'accordo con la massima densità per generare tutti i bottoni 
            // necessari, in modo da coprire anche i canali delle voci interne opzionali.
            const _maxV = _vv.reduce((max, v) => v.length > max.length ? v : max, _vv[0]);
            window.gui.updateSoloButtons(_maxV);
            
            // Forcing a redraw at the very end to prevent the ResizeObserver or Fullscreen API 
            // from clearing the key signature on the very first iteration.
            requestAnimationFrame(() => {
                if (window.currentKeyContext) {
                    window.gui.drawPitches([], window.currentKeyContext);
                }
            });
        } else {
            window.currentProgression = null;
            window.currentKeyContext = null;  // Single chord: no key signature
            let pool = LEVEL_POOLS_SINGLE[level] || LEVEL_POOLS_SINGLE["1: Basic Triads"];
            let targetItem = null;
            if (overrides && overrides.forceQuality) {
                 const match = pool.find(p => p.includes(overrides.forceQuality));
                 if (match) targetItem = match;
            }
            let sym  = targetItem || pool[Math.floor(Math.random() * pool.length)];
            let match = sym.match(/^([A-G][b#]?)(.*)/);
            let qual  = match ? match[2] : "";
            let targetChord = currentRoot + qual;
            window.currentSymbol = targetChord;
            document.getElementById("combo_label")?.innerText;
            window.realProgressionLabel = targetChord;

            let wrongQuals = [];
            pool.forEach(p => {
                let pm = p.match(/^([A-G][b#]?)(.*)/);
                if (pm && pm[2] !== qual && !wrongQuals.includes(pm[2])) wrongQuals.push(pm[2]);
            });
            createAnswers(targetChord, wrongQuals.map(q => root + q));
            // Pre-generate voicing so SOLO buttons appear immediately
            const _isOpt2 = document.getElementById('voice_leading_menu').value.includes('Optimized');
            const _tv = window.musicEngine.generateVoicing(targetChord, 'C3', _isOpt2);
            window.currentVoicings = [_tv];
            window.gui.updateSoloButtons(_tv);
        }
        
        return true;
    }

    document.getElementById("next_btn")?.addEventListener("click", startNewChallenge);

    document.getElementById("play_btn").addEventListener("click", async () => {
      try {
        if (!currentChallengeStart) currentChallengeStart = Date.now();
        if (!currentSessionStart) currentSessionStart = new Date();
        currentChallengeReplays++;
        currentSessionReplayCount++;

        if (window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
        window.cancelActivePlaybacks();
        
        // Guard: if somehow no challenge loaded yet, start one
        if (!window.currentSymbol && !window.currentProgression) {
            let started = await startNewChallenge();
            if (started === false) return; // Stop if paywall or error
        }
        // Switch button label from START → PLAY after first use
        const playBtn = document.getElementById('play_btn');
        if (playBtn && playBtn.textContent === '▶ START') playBtn.textContent = '▶ PLAY';
        
        window.hasPlayedCurrentChallenge = true;
        const answersFrame = document.querySelector('.answers-frame');
        if (answersFrame) {
            answersFrame.style.opacity = '1';
            answersFrame.style.pointerEvents = 'auto';
        }

        const baseOctave  = "C3";
        const isOptimized = document.getElementById("voice_leading_menu").value.includes("Optimized");
        const tempoMs     = parseInt((document.getElementById("tempo_menu") || {}).value) || 1560;
        const cutDuration = (tempoMs / 1000) * 0.82;

        const currentSession = window._playbackSessionId;

        if (window.currentProgression) {
            let prevV = null;
            let voicings = window.currentProgression.map(s => {
                let v = window.musicEngine.generateVoicing(s, baseOctave, isOptimized, prevV);
                prevV = v;
                return v;
            });
            window.currentVoicings = voicings;
            window.gui.drawPitches(voicings, window.currentKeyContext);
            // UI Fix: Aggiorna i bottoni usando il voicing più denso della progressione appena generata
            const maxV = voicings.reduce((max, v) => v.length > max.length ? v : max, voicings[0]);
            window.gui.updateSoloButtons(maxV);
            voicings.forEach((v, i) => setTimeout(() => {
                if (window._playbackSessionId !== currentSession) return;
                window.audioEngine.playChord(v, cutDuration, i);
            }, i * tempoMs));
            window.gui.setInsight("Progression (" + tempoMs + "ms). Drop-2: " + (isOptimized ? "ON" : "OFF"));
        } else {
            let sym = window.currentSymbol;
            let targetVoicing = window.musicEngine.generateVoicing(sym, baseOctave, isOptimized);
            window.currentVoicings = [targetVoicing];
            window.gui.drawPitches([targetVoicing], null);  // No key sig for single chord
            window.gui.updateSoloButtons(targetVoicing);
            if (window._playbackSessionId === currentSession) {
                window.audioEngine.playChord(targetVoicing, cutDuration, 0);
            }
            window.gui.setInsight(`Base: C3 | Voicing: ${isOptimized ? "Opt. (Drop-2)" : "Root"}`);
        }
      } catch (err) {
        alert("CRASH IN PLAY_BTN: " + err.message + "\n\n" + err.stack);
      }
    });

    // ── ARPEGGIATOR ─────────────────────────────────────────
    document.getElementById("arpeggio_btn").addEventListener("click", () => {
        if (window.audioEngine.ctx.state === 'suspended') window.audioEngine.ctx.resume();
        if (!window.currentVoicings) return;
        
        window.cancelActivePlaybacks();
        const currentSession = window._playbackSessionId;
        
        const tempoMs = parseInt((document.getElementById("tempo_menu") || {}).value) || 1560;
        let cIdx = 0, pIdx = 0;
        function arpNext() {
            if (window._playbackSessionId !== currentSession) return;
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

    // ── GRADUATED BLEND MODE ────────────────────────────────
    let blendCancelled = true;
    let currentBlendTimeout = null;

    window.cancelGraduatedBlend = function() {
        if (blendCancelled) return;
        blendCancelled = true;
        if (currentBlendTimeout) clearTimeout(currentBlendTimeout);
        resetBlendMode();
    };

    window.toggleSolo = function(voiceIndex) {
        if (window.audioEngine.ctx?.state === 'suspended') window.audioEngine.ctx.resume();
        if (!window.currentVoicings) return;
        
        window.cancelActivePlaybacks();
        window.cancelGraduatedBlend();
        
        let count = parseInt(localStorage.getItem('soloUsesCount') || '0');
        if (count < 2) {
            count++;
            localStorage.setItem('soloUsesCount', count.toString());
            if (count === 2) {
                window.coachInstance?.showCoachMark(
                    "Tip: press and hold any Solo button to hear the voice gradually blend into the full mix.", 
                    6000
                );
            }
        }
        
        const b = document.querySelectorAll('#solo_buttons_frame .solo-btn')[voiceIndex] || null;
        let cIdx = 0;
        const currentSession = window._playbackSessionId;
        function solNext() {
            if (window._playbackSessionId !== currentSession) return;
            if (cIdx >= window.currentVoicings.length) return;
            let chord = window.currentVoicings[cIdx];
            if (chord) {
                let n = chord.find(c => c.voiceIdx === voiceIndex);
                if (n) {
                    window.audioEngine.playPitch(n.voiceIdx, n.frequency, 1.2, cIdx);
                    if (b) {
                        b.classList.add('flash-active');
                        setTimeout(() => b.classList.remove('flash-active'), 250);
                    }
                } else {
                    if (b) {
                        b.classList.add('flash-missing');
                        setTimeout(() => b.classList.remove('flash-missing'), 250);
                    }
                }
            }
            cIdx++;
            let isoTempo = parseInt((document.getElementById('tempo_menu') || {}).value) || 1560;
            if (cIdx < window.currentVoicings.length) setTimeout(solNext, isoTempo);
        }
        solNext();
    };

    window.startGraduatedBlend = async function(targetVoiceIndex, totalSteps = 5) {
        if (!window.currentVoicings) return;
        if (window.audioEngine.ctx?.state === 'suspended') window.audioEngine.ctx.resume();
        
        // Let UI know we used solo in this challenge
        currentSoloUsed = true;
        
        window.cancelActivePlaybacks();
        window.cancelGraduatedBlend();
        blendCancelled = false;
        
        const voicings = window.currentVoicings;
        let isoTempo = parseInt((document.getElementById('tempo_menu') || {}).value) || 1560;
        const dur = (isoTempo / 1000) * 0.82;
        
        const soloBtn = document.querySelectorAll('#solo_buttons_frame .solo-btn')[targetVoiceIndex] || null;
        const baseHtml = soloBtn ? soloBtn.innerHTML.replace(/<span.*span>/g, '').trim() : '';
        
        const currentSession = window._playbackSessionId;
        
        const stepLoop = async (step) => {
            if (blendCancelled || window._playbackSessionId !== currentSession) return;
            
            if (step >= totalSteps) {
                resetBlendMode();
                if (!localStorage.getItem('coachMarksShown.graduatedBlend')) {
                    localStorage.setItem('coachMarksShown.graduatedBlend', 'true');
                    window.coachInstance?.showCoachMark(
                        "You just heard the voice emerge from silence to full mix. Try singing it next time — your brain locks onto a voice you can produce.", 
                        6000
                    );
                }
                return;
            }

            if (soloBtn) {
                soloBtn.classList.add('blend-active');
                soloBtn.innerHTML = `${baseHtml} <span style="font-size: 10px; opacity: 0.7;">[${step + 1}/${totalSteps}]</span>`;
            }
            
            const linearProgress = step / (totalSteps - 1);
            const contextVolume = Math.pow(linearProgress, 2.5); // Steep power curve for subtle build
            
            const volumeMap = {};
            for (let i = 0; i < 7; i++) {
                volumeMap[i] = (i === targetVoiceIndex) ? 1.0 : contextVolume;
            }

            const tickDur = isoTempo / 2;
            
            window.audioEngine.playClick(0.015);
            drawCountdownNumber("2");
            
            await new Promise(r => {
                currentBlendTimeout = setTimeout(r, tickDur);
            });
            if (blendCancelled || window._playbackSessionId !== currentSession) { clearCountdown(); return; }

            window.audioEngine.playClick(0.015);
            drawCountdownNumber("1");
            setTimeout(clearCountdown, 150);

            // Wait for the '1' beat to complete (t=780 -> t=1560)
            await new Promise(r => {
                currentBlendTimeout = setTimeout(r, tickDur);
            });
            if (blendCancelled || window._playbackSessionId !== currentSession) { clearCountdown(); return; }

            // Silence / 'Levare' beat (t=1560 -> t=2340)
            await new Promise(r => {
                currentBlendTimeout = setTimeout(r, tickDur);
            });
            if (blendCancelled || window._playbackSessionId !== currentSession) { clearCountdown(); return; }
            
            voicings.forEach((v, i) => {
                const triggerDelay = i * isoTempo;
                if (!blendCancelled) {
                    setTimeout(() => {
                        if (!blendCancelled && window._playbackSessionId === currentSession) {
                            window.audioEngine.playChordWithVolumes(v, volumeMap, dur, i);
                        }
                    }, triggerDelay);
                }
            });

            const pauseTime = isoTempo;
            await new Promise(r => {
                currentBlendTimeout = setTimeout(r, (voicings.length * isoTempo) + pauseTime);
            });
            
            stepLoop(step + 1);
        };
        
        stepLoop(0);
    };

    function resetBlendMode() {
        document.querySelectorAll('#solo_buttons_frame .solo-btn').forEach(btn => {
            btn.classList.remove('blend-active');
            btn.innerHTML = btn.innerHTML.replace(/<span.*span>/g, '').trim();
        });
        clearCountdown();
    }

    function drawCountdownNumber(numStr) {
        let overlay = document.getElementById("countdown_overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "countdown_overlay";
            overlay.style.position = "absolute";
            overlay.style.top = "50%";
            overlay.style.left = "50%";
            overlay.style.transform = "translate(-50%, -50%)";
            overlay.style.fontSize = "72px";
            overlay.style.color = "white";
            overlay.style.fontWeight = "bold";
            overlay.style.pointerEvents = "none";
            overlay.style.zIndex = "100";
            overlay.style.transition = "opacity 0.15s ease";
            
            const staffFrame = document.querySelector(".staff-frame");
            if (staffFrame) {
                if (window.getComputedStyle(staffFrame).position === "static") {
                    staffFrame.style.position = "relative";
                }
                staffFrame.appendChild(overlay);
            }
        }
        overlay.innerText = numStr;
        overlay.style.opacity = "0.4";
    }

    function clearCountdown() {
        const overlay = document.getElementById("countdown_overlay");
        if (overlay) {
            overlay.style.opacity = "0";
        }
    }
    
    // Tap anywhere to cancel blend mode
    const cancelIfOutside = (e) => {
        if (!blendCancelled && window.cancelGraduatedBlend) {
            if (!e.target.closest('.solo-btn')) {
                window.cancelGraduatedBlend();
            }
        }
    };
    
    document.addEventListener('touchstart', cancelIfOutside, {passive: true});
    document.addEventListener('mousedown', cancelIfOutside);

});
