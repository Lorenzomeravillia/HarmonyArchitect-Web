# HarmonyArchitect — Product Vision Prompt
*Da usare in una sessione Claude Chat separata per design, roadmap e decisioni di prodotto.*
*Poi riportare i risultati a Claude Code per l'implementazione.*

---

## Contesto: Chi sono e perché esiste questo progetto

Sono un musicista con ADHD e neurodivergenza. Ho scarsa memoria di lavoro, il che mi rende impossibile memorizzare accordi e suoni a brevissimo termine — una capacità che la maggior parte dei software di ear training dà per scontata.

Ho costruito HarmonyArchitect come tool personale per ovviare a questo problema. La scoperta chiave che ho fatto empiricamente: **assegnando timbri diversi a ciascuna voce dell'accordo** (es. basso = contrabbasso, tenore = trombone, soprano = flauto), riesco a separare le voci e identificarle individualmente, invece di sentirle come un blob sonoro indistinto.

Questo principio — che la letteratura audiologica chiama *timbral stream segregation* — è la caratteristica differenziante del prodotto. È lo stesso motivo per cui in orchestra riesci a seguire il violoncello anche quando suonano tutti.

Ho poi realizzato che questo problema (blob uditivo + working memory debole) affligge una percentuale significativa di musicisti:
- ADHD (5-7% popolazione, sovrarappresentato nei creativi/musicisti)
- APD — Auditory Processing Disorder (~5% adulti, spesso non diagnosticato)
- Adulti che iniziano tardi (working memory più debole per età/stress)
- Studenti in conservatorio con difficoltà di apprendimento

**Nessun software di ear training esistente serve questo mercato.** EarMaster, Functional Ear Trainer, iReal Pro: tutti assumono processing uditivo neurotypical e working memory nella norma.

---

## Stato attuale del prodotto (HarmonyArchitect v0.x)

### Cosa è oggi

Web app (HTML/CSS/Vanilla JS) + versione desktop Python (non prioritaria).
PWA-ready, mobile-responsive, dark theme.

### Funzionalità implementate

**Core loop:**
- Quiz a risposta multipla (4 opzioni): senti l'accordo, scegli il nome corretto
- Modalità Single Chord e Progression
- Trasposizione automatica in tutte le 12 tonalità
- Feedback visivo + earcon + vibrazione aptica

**Contenuto armonico (4 livelli):**
- Level 1: Triadi (maggiore, minore, diminuita, aumentata)
- Level 2: Settime in Drop-2 (maj7, m7, 7, m7b5, dim7)
- Level 3: Estensioni jazz (maj9, 9, 13, 7alt, 7b9, 7#11)
- Level 4: Avanzato (sostituzioni di tritono, dominanti secondarie, alterazioni)

**Progressioni (4 livelli paralleli):**
- L1: I-IV-V-I, I-vi-IV-V, progressioni diatoniche base
- L2: ii7-V7-Imaj7 (jazz standard)
- L3: Con estensioni (ii9-V13-Imaj9)
- L4: Con tritone sub e secondari

**Audio engine:**
- WebAudioFontPlayer (General MIDI)
- 7 voci orchestrali indipendenti, timbro configurabile per voce
- 14 strumenti disponibili: contrabbasso, violoncello, tromba, corno, viola, clarinetto, flauto, piano, arpa, organo, chitarra, sassofono, violino, fagotto
- Default: contrabbasso (basso), violoncello, tromba, corno, viola, clarinetto, flauto (alto)
- Modalità Play (accordo) e Arpeggiatore
- Solo per singola voce (7 bottoni isolamento)
- Tempo: Lento (2160ms), Medio (1560ms), Veloce (960ms)

**Visualizzazione:**
- Doppio pentagramma (chiave di violino + basso) su canvas
- Note colorate per funzione: blu=radice, verde=terza, giallo=quinta, arancio=settima, rosso=estensioni
- Click su nota singola per sentirla
- Voice leading Drop-2 o root position configurabile

**Sistema sessione:**
- Sessioni da 5/10/20/50 challenge
- Progress bar unificata
- Streak tracker (fuoco 🔥)
- Badge performance al completamento (🥇🥈🥉💪)
- Popup post-risposta con auto-play sfida successiva

**Settings:**
- Livello difficoltà (1-4)
- Modalità (Single/Progression)
- Voice leading (Root/Drop-2)
- Tempo (3 velocità)
- Training mode (Standard/Adaptive — Adaptive non implementata)
- Session size
- 7 selettori strumento (uno per voce)

**Backend Python (non prioritario, non sviluppare):**
- Spaced repetition SM-2
- Error classifier (7 categorie)
- Theory advisor
- Stats dashboard
- SQLite per persistenza

### Limitazioni attuali riconosciute

1. Multiple choice puro = pattern matching, non vero ear training
2. Nessun contesto funzionale (tonalità, funzione armonica, Roman numerals)
3. Nessun flusso guidato "una voce alla volta" per chi ha blob uditivo
4. Nessun rallentamento estremo (oltre il "Lento" attuale)
5. Adaptive mode esposta nell'UI ma non funzionante
6. UI in italiano — zero mercato internazionale
7. Sidebar con 7 selettori strumento = cognitive overload per il target
8. Sessioni da 20-50 troppo lunghe per cervelli ADHD
9. Nessuna spiegazione del "perché funziona" (onboarding zero)
10. Nessuna modalità per insegnanti

---

## Visione del Prodotto Finale

### Nome provvisorio
HarmonyArchitect (mantenere o evolvere — da decidere)

### Tagline candidate
- *"Ear training built for brains that work differently"*
- *"Hear every voice. Learn at your pace."*
- *"Jazz harmony for neurodivergent musicians"*

### Target primario
Musicisti adulti (18-55) con ADHD, APD, o working memory debole che:
- Hanno già provato EarMaster o simili e li hanno abbandonati per frustrazione
- Suonano o vogliono suonare jazz/musica popolare a livello intermedio-avanzato
- Hanno una diagnosi o si riconoscono in descrizioni di neurodivergenza
- Sono disposti a pagare per uno strumento che *funziona per loro*

### Target secondario
- Insegnanti di armonia jazz che hanno allievi neurodivergenti in classe
- Studenti di conservatorio con DSA (disturbi specifici apprendimento)
- Musicisti anziani che iniziano il percorso jazz con working memory ridotta

---

## Feature del Prodotto Finale (da progettare/prioritizzare)

### Blocco A — Core differenziante (neurodivergent-first)

**A1. Timbral Voice Separation come feature di primo piano**
- Non nascosta nelle impostazioni: è il USP principale
- Preset nominati e spiegati: "Jazz Combo", "Orchestra", "Stark Contrast" (massima separazione timbrica), "Custom"
- Onboarding che spiega il principio e perché aiuta chi ha blob uditivo

**A2. Modalità "Unveil" (svela una voce alla volta)**
- Workflow guidato: senti basso → senti tenore → senti soprano → senti tutto insieme → rispondi
- Ogni step è facoltativo, l'utente procede quando pronto
- Sostituisce o affianca il play button unico

**A3. Replay senza penalità e senza fretta**
- Replay illimitato prima di rispondere, senza timer né pressione visiva
- Opzione "rispondi quando sei pronto" — nessun countdown
- Rimuovere qualsiasi elemento UI che comunica urgenza

**A4. Velocità extreme**
- Aggiungere "Molto Lento" (3500ms+) e "Ultra Lento" (5000ms+)
- Opzione "stagger estremo" — voci che entrano a distanza di 300ms l'una dall'altra (anziché 40ms)

**A5. Micro-sessioni ADHD-friendly**
- Default sessione: 5 challenge (non 10)
- Aggiungere sessione da 3
- Reward immediato e frequente (non solo al completamento)
- Pause esplicite suggerite ogni 3 challenge ("Vuoi continuare o fare una pausa?")

### Blocco B — Struttura pedagogica (per tutti, non solo neurodivergenti)

**B1. Contesto funzionale visibile**
- Mostrare sempre: tonalità corrente, funzione armonica (I, ii, V...), Roman numerals
- Color coding coerente tra nota sul pentagramma e funzione armonica

**B2. Livelli intermedi mancanti**
- Inserire Level 1.5: settime in root position (prima di Drop-2)
- Inserire Level 2.5: ii-V-I solo in Do maggiore (prima di trasporre)
- Revisione generale della curva di difficoltà

**B3. Predict-then-verify (opzionale, avanzato)**
- Modalità "ascolta, aspetta 3 secondi senza opzioni, poi rispondi"
- Forza l'internalizzazione prima della risposta
- Solo per utenti che la scelgono esplicitamente

**B4. Rimuovere o completare Adaptive Mode**
- O implementarla davvero o rimuoverla dall'UI
- Se implementata: prioritizzare accordi sbagliati, adattare difficoltà in tempo reale

### Blocco C — Internazionalizzazione e onboarding

**C1. Lingua: inglese come default**
- Tutta l'UI in inglese
- Italiano come opzione (o mantenere per versione personale)

**C2. Onboarding**
- Schermata iniziale che spiega il problema (blob uditivo, WM) e come l'app lo risolve
- "Qual è la tua situazione?" — selezione rapida: ADHD/APD, Late learner, Standard
- Preset impostazioni in base alla selezione

**C3. Semplificazione UI**
- Nascondere i 7 selettori strumento in un pannello "Avanzato"
- UI principale: solo Play, Replay, Velocità, Livello
- Principio: meno opzioni visibili = meno overwhelm cognitivo

### Blocco D — Modalità insegnante (fase 2)

**D1. Profili studente**
- Login semplice (email/password o OAuth)
- Tracking progressi per studente
- Dashboard insegnante con overview classe

**D2. Assign & Review**
- Assegnare sessioni specifiche a studenti
- Vedere i risultati e i pattern di errore

**D3. Demo mode**
- Modalità presentazione per uso in aula (schermo proiettato)

---

## Architettura tecnica attuale (da preservare e far evolvere)

```
WebVersion/
├── index.html          — Layout UI, responsive, dark theme
├── css/style.css       — Dark theme, flexbox grid
└── js/
    ├── main.js         — Game logic, session management (~455 lines)
    ├── music_engine.js — Chord voicing, Drop-2, MIDI conversion (~179 lines)
    ├── gui.js          — Canvas staff rendering, note visualization (~285 lines)
    ├── audio_engine.js — WebAudioFontPlayer integration (~92 lines)
    └── tonal.min.js    — Music theory library (Tonal.js)
```

**Stack**: HTML/CSS/Vanilla JS. Nessun framework. Tonal.js per teoria musicale. WebAudioFont per sintesi audio GM.

**Vincoli tecnici da rispettare:**
- Rimanere vanilla JS (no React/Vue/Angular) per semplicità di deployment
- PWA-ready (offline capability)
- Mobile-first
- Nessun backend obbligatorio per le feature core (localStorage per persistenza leggera)

---

## Domande aperte che questa sessione deve rispondere

1. **Naming e branding**: il nome "HarmonyArchitect" è giusto per questo posizionamento neurodivergent-first? Oppure serve un nome che comunichi accessibilità e accoglienza?

2. **Monetizzazione**: freemium? Uno-tantum? Subscription? Cosa funziona per app di nicchia educativa musicale?

3. **Roadmap prioritizzata**: dato lo stato attuale, qual è il percorso minimo per avere un prodotto beta distribuibile?

4. **Feature cut**: cosa tagliare definitivamente (es. backend Python, versione desktop, Adaptive Mode non implementata)?

5. **Onboarding**: come comunicare il problema neurologico senza stigmatizzare? ("per chi ha ADHD" vs "per chi impara in modo diverso")

6. **Differenziazione visiva**: come rendere l'interfaccia immediatamente riconoscibile come "diversa" dagli altri ear trainer?

7. **Community**: ha senso costruire una community attorno al prodotto? Dove (Discord? Reddit? Forum dedicato?)

---

## Istruzioni per questa sessione Claude Chat

Sei un product strategist + UX designer con esperienza in:
- App educative musicali
- Design per utenti neurodivergenti (ADHD, APD, dislesia)
- Mercato SaaS/app di nicchia B2C

**Il tuo compito:**

1. Analizza il prodotto attuale e la visione descritta sopra
2. Fornisci una **roadmap di prodotto prioritizzata** in 3 fasi (MVP, v1, v2)
3. Per ogni fase indica: feature incluse, feature escluse, metriche di successo
4. Rispondi alle domande aperte con raccomandazioni concrete e motivate
5. Proponi un **sistema di onboarding in 3 schermate** che comunichi il valore in modo inclusivo
6. Suggerisci **cambiamenti UX immediati** (bassa complessità tecnica, alto impatto utente)

**Output atteso:**
- Roadmap strutturata (fasi, feature, metriche)
- Risposte alle 7 domande aperte
- Bozza onboarding (testo delle 3 schermate)
- Lista prioritizzata di UX quick wins
- Eventuali rischi o blind spot non considerati

---
*Documento generato: 2026-04-03*
*Da riportare a Claude Code con i risultati per l'implementazione.*
