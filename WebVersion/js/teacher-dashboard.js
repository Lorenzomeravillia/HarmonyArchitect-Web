// js/teacher-dashboard.js
// Gestisce l'interfaccia protetta per i docenti.
// Dipende dall'esistenza globale di window.dbClient per il passaggio delle chiavi API

class TeacherApp {
    constructor() {
        this.supabase = null;
        this.teacherProfile = null;
        this.currentClasses = [];
        this.activeClassId = null;
        this.activeStudentId = null;
        
        window.onload = async () => {
            if (window.dbClient) {
                await window.dbClient.init();
                if (window.dbClient.supabase) {
                    this.supabase = window.dbClient.supabase;
                    this.checkAuthSession();
                } else {
                    this.showError("Inizializzazione database fallita (manca connessione).");
                }
            } else {
                this.showError("Script Supabase Client non trovato.");
            }
        };
    }

    showError(msg) {
        const d = document.getElementById('auth-error');
        if (d) { d.innerText = msg; d.style.display = 'block'; }
        console.error(msg);
    }

    async checkAuthSession() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            await this.loadTeacherProfile(session.user.id);
        } else {
            document.getElementById('auth-screen').style.display = 'flex';
        }
    }

    async login() {
        const e = document.getElementById('auth-email').value;
        const p = document.getElementById('auth-password').value;
        if (!e || !p) return this.showError("Inserisci email e password.");
        
        const { data, error } = await this.supabase.auth.signInWithPassword({ email: e, password: p });
        if (error) {
            return this.showError(error.message);
        }
        await this.loadTeacherProfile(data.user.id);
    }

    async register() {
        const n = document.getElementById('auth-name').value.trim();
        const e = document.getElementById('auth-email').value.trim();
        const p = document.getElementById('auth-password').value;
        if (!n || !e || !p) return this.showError(`Dati mancanti! [N:${n}] [E:${e}] [P:${p?"Ok":""}]`);

        // Create auth user
        const { data, error } = await this.supabase.auth.signUp({ email: e, password: p });
        if (error) return this.showError(error.message);

        // Se richiede verifica email in Supabase, data.user c'è ma potrebbe non avere session
        if (data.user) {
            // UPSERT DI SICUREZZA IN CV.USERS PER EVITARE RLS / FK LOCKS!
            await this.supabase.schema('cv').from('users').upsert({
                id: data.user.id,
                auth_provider: 'email'
            }, { onConflict: 'id' });

            // Upsert in public.teachers explicitly
            const { error: tErr } = await this.supabase.schema('cv').from('teachers').insert({
                user_id: data.user.id,
                display_name: n,
                email: e
            });
            if (tErr) return this.showError("Impossibile generare licenza docente: " + tErr.message);
            
            // Login forzato se auto-confirm abilitato (come di solito è)
            await this.login();
        }
    }

    async logout() {
        await this.supabase.auth.signOut();
        window.location.reload();
    }

    async loadTeacherProfile(authUid) {
        const { data, error } = await this.supabase.schema('cv').from('teachers').select('*').eq('user_id', authUid).single();
        if (error || !data) {
            // Accesso respinto (es: account studente che tenta di usare il portal teacher)
            await this.logout();
            return alert("Accesso negato. Il tuo account non possiede una licenza da Docente registrata in Cloud.");
        }
        
        this.teacherProfile = data;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('teacher-profile-label').innerText = data.display_name + " (Pro License)";
        
        await this.fetchClasses();
        this.navigate('classes');
    }

    async fetchClasses() {
        const { data, error } = await this.supabase.schema('cv').from('classes')
            .select('*')
            .eq('teacher_id', this.teacherProfile.id)
            .eq('is_active', true);
            
        if (error) {
            console.error("fetchClasses Supabase error:", error);
            alert("Errore caricamento classi: " + error.message);
        }
            
        this.currentClasses = data || [];
        const sel = document.getElementById('class-selector');
        sel.innerHTML = '';
        
        if (this.currentClasses.length === 0) {
            sel.innerHTML = '<option value="">Nessuna classe creata</option>';
            document.getElementById('btn-invite').style.display = 'none';
        } else {
            this.currentClasses.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.innerText = c.name;
                sel.appendChild(opt);
            });
            this.activeClassId = this.currentClasses[0].id;
            document.getElementById('btn-invite').style.display = 'inline-block';
            await this.loadClassOverview();
        }
    }

    async loadClassOverview() {
        const sel = document.getElementById('class-selector');
        if (!sel.value) return;
        this.activeClassId = sel.value;

        // Fetch aggregates from view
        const { data: students, error } = await this.supabase
            .schema('cv').from('class_overview')
            .select('*')
            .eq('class_id', this.activeClassId);

        if (error) {
            console.error(error);
            return;
        }

        let totalScore = 0;
        let inactiveCount = 0;
        let criticalCount = 0;

        const tb = document.getElementById('students-table-body');
        tb.innerHTML = '';

        if (!students || students.length === 0) {
            tb.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Nessuno studente iscritto alla classe. Genera il link di invito.</td></tr>';
            document.getElementById('stat-total-students').innerText = '0';
            return;
        }

        // Parallel fetch for weak spots to show alerts in table
        const userIds = students.map(s => s.user_id);
        const { data: weakSpots } = await this.supabase.schema('cv').from('student_weakness_summary')
            .select('*')
            .in('user_id', userIds)
            .eq('status', 'critical');

        students.forEach(s => {
            totalScore += Number(s.avg_score);
            let inact = s.days_inactive !== null ? parseInt(s.days_inactive) : 999;
            if (inact >= 7 || s.total_sessions === 0) inactiveCount++;
            
            const sWeak = (weakSpots || []).filter(w => w.user_id === s.user_id);
            if (sWeak.length >= 3 || Number(s.avg_score) < 60 && s.total_sessions > 0) criticalCount++;

            let statusHTML = '<span class="status-dot status-mastered"></span>'; // Green
            if (s.total_sessions === 0) statusHTML = '<span class="status-dot status-inactive"></span>';
            else if (sWeak.length > 2 || Number(s.avg_score) < 60) statusHTML = '<span class="status-dot status-critical"></span>';
            else if (sWeak.length > 0) statusHTML = '<span class="status-dot status-struggling"></span>';

            let alertsHTML = '';
            if (sWeak.length > 0) {
                sWeak.slice(0, 3).forEach(w => {
                    alertsHTML += `<span class="badge">${w.value}</span>`;
                });
                if (sWeak.length > 3) alertsHTML += `<span style="font-size:11px;color:#8899BB;">+${sWeak.length-3}</span>`;
            } else {
                alertsHTML = '<span style="color:#556688; font-style:italic;">All clear</span>';
            }

            const tr = document.createElement('tr');
            tr.className = 'clickable-row';
            tr.onclick = () => this.openStudentProfile(s);
            tr.innerHTML = `
                <td>${statusHTML}</td>
                <td style="font-weight:700;">${s.student_name || 'Anonimo'}</td>
                <td>${s.total_sessions > 0 ? s.avg_score + '%' : '--'}</td>
                <td>${s.total_sessions}</td>
                <td>${s.total_sessions > 0 ? alertsHTML : 'In attesa primo test'}</td>
                <td style="font-size:12px; color:#8899BB;">${s.last_active ? new Date(s.last_active).toLocaleDateString() : 'Mai'}</td>
            `;
            tb.appendChild(tr);
        });

        document.getElementById('stat-total-students').innerText = students.length;
        document.getElementById('stat-avg-score').innerText = students.length ? Math.round(totalScore / students.length) + '%' : '0%';
        document.getElementById('stat-inactive-students').innerText = inactiveCount;
        document.getElementById('stat-critical-students').innerText = criticalCount;
    }

    async openStudentProfile(studentAgg) {
        this.activeStudentId = studentAgg.user_id;
        document.getElementById('profile-student-name').innerText = studentAgg.student_name || 'Alunno';
        document.getElementById('profile-score').innerText = studentAgg.total_sessions > 0 ? studentAgg.avg_score + '%' : '--';
        document.getElementById('profile-sessions').innerText = studentAgg.total_sessions;
        document.getElementById('profile-challenges').innerText = studentAgg.total_challenges;
        document.getElementById('profile-reveals').innerText = studentAgg.total_reveals;
        document.getElementById('profile-inactive').innerText = studentAgg.days_inactive !== null ? studentAgg.days_inactive + " giorni" : "-";

        this.navigate('student');

        // Fetch weak spots matrix
        const { data: ws } = await this.supabase.schema('cv').from('student_weakness_summary')
            .select('*')
            .eq('user_id', this.activeStudentId)
            .order('error_rate', { ascending: false });

        const wb = document.getElementById('profile-weakspots-body');
        wb.innerHTML = '';

        if (!ws || ws.length === 0) {
            wb.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#8899BB;">Memoria di profilazione non sufficiente (servono più test).</td></tr>';
            document.getElementById('profile-narrative').innerText = "Lo studente non ha generato sufficiente storico testuale per una profilazione diagnostica.";
            return;
        }

        ws.forEach(w => {
            let color = '#2EC4B6'; // mastered
            if (w.status === 'critical') color = '#FF4A4A';
            else if (w.status === 'struggling') color = '#FFE66D';
            
            // Localizza la dicitura
            let dimLoc = w.dimension;
            if (dimLoc === 'root') dimLoc = 'Tonalità (Root)';
            else if (dimLoc === 'quality') dimLoc = 'Natura Accordo';
            else if (dimLoc === 'interval_confusion') dimLoc = 'Confusione Specifica';
            else if (dimLoc === 'progression') dimLoc = 'Sostituzione in Griglia';

            wb.innerHTML += `
                <tr>
                    <td><span style="color:${color}; font-weight:700;">${w.status.toUpperCase()}</span></td>
                    <td>${dimLoc}: <strong>${w.value}</strong></td>
                    <td>${Math.round((1 - w.error_rate) * 100)}% (su ${w.total_attempts})</td>
                </tr>
            `;
        });

        // Generate the Narrative AI Fake Text
        document.getElementById('profile-narrative').innerHTML = this.generateWeaknessNarrative(studentAgg.student_name || 'L\'alunno', ws);
    }

    generateWeaknessNarrative(name, weakSpots) {
        const chordDict = {
            'triad': 'Triade Maggiore',
            'm': 'Triade Minore',
            'dim': 'Triade Diminuita',
            'aug': 'Triade Aumentata',
            '7': 'Accordo di Settima di Dominante (7)',
            'maj7': 'Accordo di Settima Maggiore (Maj7)',
            'm7': 'Accordo Minore Settima (m7)',
            'dim7': 'Accordo di Settima Diminuita',
            'm7b5': 'Accordo Semidiminuito (m7b5)',
            'mMaj7': 'Accordo Minore con Settima Maggiore',
            'sus4': 'Accordo Sospeso (Sus4)',
            'sus2': 'Accordo Sospeso (Sus2)'
        };
        const translate = (val) => chordDict[val] || val;

        const critical = weakSpots.filter(ws => ws.status === 'critical' || ws.status === 'struggling');
        const confusions = weakSpots.filter(ws => ws.dimension === 'interval_confusion');
        
        if (critical.length === 0 && confusions.length === 0) {
            return `L'allievo/a <strong>${name}</strong> presenta un orecchio armonico solido e ben strutturato. Risponde con ottima precisione agli esercizi e al momento non emergono lacune sistemiche su cui sia urgente intervenire.`;
        }

        let n = `<strong>AI Triage:</strong> L'allievo/a ${name} `;
        
        if (confusions.length > 0) {
            const top = confusions[0];
            const [t1, t2] = top.value.split('_vs_');
            n += `manifesta una specifica difficoltà nel discriminare a orecchio la <strong>${translate(t1)}</strong> e la <strong>${translate(t2)}</strong>. In situazioni di incertezza, tende a confonderle con un tasso d'errore del ${Math.round(top.error_rate*100)}%. `;
        }

        const roots = critical.filter(ws => ws.dimension === 'root').map(w => w.value);
        if (roots.length > 0) {
            n += `I dati indicano inoltre una maggiore fatica nel riconoscimento quando le fondamentali si trovano nelle tonalità di <strong>${roots.slice(0,3).join(', ')}</strong>. `;
        }

        const quals = critical.filter(ws => ws.dimension === 'quality').map(w => w.value);
        if (quals.length > 0) {
            const translatedQuals = quals.slice(0,2).map(translate);
            n += `<br><br>🎯 <strong>Rimedio consigliato:</strong> Si suggerisce di assegnare sessioni mirate di Ear Training isolando esclusivamente la famiglia dell' <strong>${translatedQuals.join(' e ')}</strong>, per consolidarne timbro e colore.`;
        } else if (confusions.length > 0) {
            const top = confusions[0];
            const [t1, t2] = top.value.split('_vs_');
            n += `<br><br>🎯 <strong>Rimedio consigliato:</strong> Si consiglia di creare una sessione limitata a soli 2 bottoni (<strong>${translate(t1)}</strong> vs <strong>${translate(t2)}</strong>), imponendo al ragazzo un A/B testing ravvicinato finché il blocco uditivo non si scioglie.`;
        }
        
        return n;
    }

    showCreateClassModal() {
        document.getElementById('create-class-modal').style.display = 'flex';
    }

    async createClass() {
        const cname = document.getElementById('new-class-name').value;
        if (!cname) return alert("Inserisci un nome.");
        
        const { error } = await this.supabase.schema('cv').from('classes').insert({
            teacher_id: this.teacherProfile.id,
            name: cname
        });
        if (error) alert("Errore creazione classe: " + error.message);
        
        document.getElementById('create-class-modal').style.display = 'none';
        await this.fetchClasses();
    }

    showInviteModal() {
        if (!this.activeClassId) return;
        const curClass = this.currentClasses.find(c => c.id === this.activeClassId);
        
        const host = window.location.origin + window.location.pathname.replace('teacher.html', 'index.html');
        const url = `${host}?join_class=${curClass.invite_code}`;
        
        document.getElementById('invite-link-display').innerText = url;
        document.getElementById('invite-modal').style.display = 'flex';
    }
    
    copyInviteLink() {
        const v = document.getElementById('invite-link-display').innerText;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(v).then(() => {
                alert("✅ Link copiato! Invia questa URL via Whatsapp ai tuoi studenti.");
            }).catch(err => {
                prompt("Non riesco a copiare in automatico. Copia tu il link qui sotto:", v);
            });
        } else {
            prompt("Sicurezza Browser attiva. Seleziona e copia questo testo manualmente (Cmd+C):", v);
        }
    }

    exportCSV() {
        alert("Esecuzione Export CSV Data Pipeline imminente... (Mock)");
    }

    navigate(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
        
        const targetView = document.getElementById('view-' + viewId);
        if (targetView) targetView.classList.add('active');
        
        const nav = document.getElementById('nav-' + viewId);
        if (nav) nav.classList.add('active');
    }
}

const teacherApp = new TeacherApp();
