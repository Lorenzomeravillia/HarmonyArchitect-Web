// Voce: la parte audio comune alle app di intonazione (Rullo, Sirena, Canta con Lu).
// Contesto audio e sessione dell'iPhone, microfono, rilevamento della nota, note di riferimento,
// voce sintetica che canta le sillabe e rilascio dell'audio quando l'app va in background.
// Una correzione fatta qui vale per tutte e tre le app; ognuna tiene solo i suoni che sono suoi.
//
// Uso: Voce.ctx e Voce.out sono il contesto audio e l'uscita (spinta + limitatore); cambiano quando l'audio
// viene rilasciato e ricreato, quindi vanno letti ogni volta da Voce, non copiati in una variabile.
window.Voce = (() => {
  'use strict';
  const V = {
    ctx: null, out: null, analyser: null, buf: null, track: null, micReady: false,
    gain: 2.4,          // spinta prima del limitatore; l'app la sceglie prima di creare il contesto
    onContext: null,    // chiamata a ogni nuovo contesto audio: l'app ricrea qui i suoi nodi
    onRelease: null,    // chiamata quando l'audio viene rilasciato (app in background): l'app aggiorna il suo stato
    onTrackEnded: null, // il microfono si è interrotto da solo
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- Contesto audio e microfono ----
  // Su iPhone l'audio va preparato per "microfono + altoparlante" PRIMA di creare il contesto audio:
  // così si sente anche col telefono in silenzioso, e accendere il microfono dopo non interrompe l'audio.
  function setPlayAndRecord() {
    if ('audioSession' in navigator) { try { navigator.audioSession.type = 'play-and-record'; } catch (e) {} }
  }
  // Riprende l'audio senza mai restare appesi: su iPhone, dopo aver acceso il microfono, resume() può non tornare più.
  function resumeAudio(ms = 1500) {
    if (!V.ctx || V.ctx.state === 'running') return Promise.resolve();
    return Promise.race([V.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, ms))]);
  }
  // Qualsiasi tocco riattiva l'audio, se iOS l'ha sospeso.
  document.addEventListener('pointerdown', () => { if (V.ctx && V.ctx.state !== 'running') V.ctx.resume().catch(() => {}); }, true);

  // Stato dell'audio in una riga, da mandare se qualcosa non va.
  function audioStateText() {
    const sess = 'audioSession' in navigator ? navigator.audioSession.state : 'n/d';
    return `audio: ${V.ctx ? V.ctx.state : 'nessuno'} · sessione: ${sess}`;
  }
  // Se iOS tiene fermo l'audio anche col microfono acceso, chiediamo un tocco con una scheda chiara.
  // Il tocco riavvia lo stesso contesto audio: crearne e chiuderne di continuo confonde iOS.
  // Se nemmeno il tocco basta, l'audio del telefono è bloccato e lo diciamo (vedi micErrorText).
  function waitForTap() {
    return new Promise((resolve, reject) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:24px;';
      wrap.innerHTML = '<div style="background:#fff;color:#1c2126;border-radius:22px;padding:22px 20px;max-width:340px;width:100%;'
        + 'text-align:center;font:500 16px system-ui,sans-serif;display:grid;gap:12px">'
        + '<div style="font-size:44px;line-height:1">🔊</div>'
        + '<b style="font-size:20px">Manca un tocco per il suono</b>'
        + '<span style="color:#555">Il microfono è acceso, ma l’iPhone tiene fermo l’audio. Tocca il pulsante qui sotto.</span>'
        + '<button type="button" style="border:0;border-radius:14px;background:#2f86d4;color:#fff;font:700 18px system-ui,sans-serif;padding:16px">Attiva il suono</button>'
        + '</div>';
      const btn = wrap.querySelector('button');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Avvio…';
        try { V.ctx.resume().catch(() => {}); } catch (e) {} // dentro il tocco
        for (let i = 0; i < 12 && V.ctx.state !== 'running'; i++) await new Promise((r) => setTimeout(r, 100));
        wrap.remove();
        if (V.ctx.state === 'running') resolve();
        else reject(Object.assign(new Error('audio fermo'), { name: 'AudioBlocked' }));
      });
      document.body.appendChild(wrap);
    });
  }
  function micErrorText(err) {
    const name = err && err.name;
    if (name === 'NotAllowedError') return 'Il microfono è bloccato per questo sito. Riattivalo dalle impostazioni del browser (aA nella barra degli indirizzi su Safari) e riprova.';
    if (name === 'NotReadableError' || name === 'AbortError') return 'Il microfono è occupato da un’altra app (Chrome, una chiamata, un registratore…). Chiudila e riprova.';
    if (name === 'AudioBlocked') {
      return 'L’iPhone non riesce ad avviare l’audio. Succede quando la sessione audio del telefono resta bloccata, '
        + 'per esempio dopo aver chiuso un’app mentre usava microfono o suono. Chiudi le altre app che usano il microfono '
        + 'e, se non basta, spegni e riaccendi l’iPhone. (' + audioStateText() + ')';
    }
    return `Non riesco ad aprire il microfono (${name}). Chiudi le altre app che lo usano e riprova. (${audioStateText()})`;
  }

  // Un solo contesto audio per tutta la visita: si chiude solo quando l'app va in background.
  function ensureCtx() {
    if (V.ctx && V.ctx.state !== 'closed') return V.ctx;
    setPlayAndRecord();
    const AC = window.AudioContext || window.webkitAudioContext;
    V.ctx = new AC({ latencyHint: 'interactive' });
    for (const k in waves) delete waves[k]; // forme d'onda e rumore appartengono al contesto
    noiseBuf = null;
    // Spinta forte seguita da un limitatore: i suoni escono molto più alti senza distorcere.
    V.out = V.ctx.createGain();
    V.out.gain.value = V.gain;
    const lim = V.ctx.createDynamicsCompressor();
    lim.threshold.value = -7;
    lim.knee.value = 3;
    lim.ratio.value = 20;
    lim.attack.value = 0.002;
    lim.release.value = 0.12;
    V.out.connect(lim).connect(V.ctx.destination);
    if (V.onContext) V.onContext();
    return V.ctx;
  }
  // Da chiamare dentro un tocco. Se il microfono è già acceso si limita a riprendere l'audio.
  async function startMic() {
    setPlayAndRecord();
    ensureCtx();
    if (V.ctx.state !== 'running') V.ctx.resume().catch(() => {}); // dentro il tocco
    await resumeAudio();
    if (V.micReady && V.track && V.track.readyState === 'live') return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    V.track = stream.getAudioTracks()[0];
    V.track.onended = () => { V.micReady = false; if (V.onTrackEnded) V.onTrackEnded(); };
    await resumeAudio(3000);
    if (V.ctx.state !== 'running') await waitForTap();
    const src = V.ctx.createMediaStreamSource(stream);
    V.analyser = V.ctx.createAnalyser();
    V.analyser.fftSize = 2048;
    V.analyser.smoothingTimeConstant = 0;
    const sink = V.ctx.createGain();
    sink.gain.value = 0; // Safari elabora solo i nodi collegati all'uscita
    src.connect(V.analyser);
    V.analyser.connect(sink);
    sink.connect(V.ctx.destination);
    V.buf = new Float32Array(V.analyser.fftSize);
    V.micReady = true;
  }

  // ---- Ciclo di vita: quando l'app va in background si rilascia l'audio ----
  // Su iPhone, se l'app viene chiusa o scartata mentre microfono e audio sono attivi, la sessione audio
  // di iOS resta "orfana": da lì in poi ogni pagina nasce muta e sorda finché non si riavvia il telefono
  // (l'abbiamo già visto in HarmonyArchitect). Quindi: appena l'app è nascosta si sospende l'audio; se
  // resta nascosta 2,5 secondi si spengono microfono e audio; se la pagina viene chiusa, subito.
  // Al ritorno si riparte con un tocco, che crea audio e microfono nuovi.
  function releaseAudio() {
    try { if (V.track) V.track.stop(); } catch (e) {}
    V.track = null;
    V.analyser = null;
    V.micReady = false;
    if (V.ctx && V.ctx.state !== 'closed') { try { V.ctx.close(); } catch (e) {} }
    V.ctx = null;
    V.out = null;
    if ('audioSession' in navigator) { try { navigator.audioSession.type = 'auto'; } catch (e) {} }
    if (V.onRelease) V.onRelease();
  }
  let hiddenTimer = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (V.ctx && V.ctx.state === 'running') V.ctx.suspend().catch(() => {});
      clearTimeout(hiddenTimer);
      hiddenTimer = setTimeout(() => { if (document.hidden) releaseAudio(); }, 2500);
    } else {
      clearTimeout(hiddenTimer);
    }
  });
  window.addEventListener('pagehide', releaseAudio);

  // ---- Rilevamento nota (YIN) ----
  let yinD = null, yinR = null;
  function yin(x, sr, fmin, fmax) {
    const tauMin = Math.floor(sr / fmax);
    const tauMax = Math.min(Math.floor(sr / fmin), (x.length >> 1) - 1);
    const N = x.length - tauMax;
    if (!yinD || yinD.length < tauMax + 2) { yinD = new Float32Array(tauMax + 2); yinR = new Float32Array(tauMax + 2); }
    const d = yinD, raw = yinR;
    d[0] = 1;
    let run = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let i = 0; i < N; i++) { const v = x[i] - x[i + tau]; s += v * v; }
      raw[tau] = s;
      run += s;
      d[tau] = run ? (s * tau) / run : 1;
    }
    let tau = -1;
    for (let t = tauMin; t < tauMax; t++) {
      if (d[t] < 0.15) { while (t + 1 < tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
    }
    if (tau < 1) return null;
    // Errore tipico: con la fondamentale debole (voce grave, microfono del telefono, vocali come "u" e "i") la prima
    // valle cade a metà del periodo, cioè un'ottava sopra. Se al doppio il segnale si ripete molto meglio, il periodo è quello.
    if (d[tau] > 0.01) {
      let t2 = -1;
      for (let t = Math.round(tau * 1.9), e = Math.min(tauMax - 1, Math.round(tau * 2.1)); t <= e; t++) if (t2 < 0 || raw[t] < raw[t2]) t2 = t;
      if (t2 > 0 && raw[t2] < raw[tau] * 0.4) tau = t2;
    }
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const den = a + c - 2 * b;
    return { f: sr / (tau + (den ? (a - c) / (2 * den) : 0)), clarity: 1 - b };
  }
  // Lettore della voce, da chiamare a ogni fotogramma: restituisce { m: nota MIDI decimale o NaN, db: volume }.
  // gate: sotto questo volume (dB) è silenzio; fmin/fmax: le note più grave e più acuta da cercare (Hz).
  function pitchReader({ gate = -55, fmin = 60, fmax = 1200 } = {}) {
    const recent = [];
    // Un salto d'ottava esatto verso l'alto a metà di una nota tenuta, senza pause né scivolate, è quasi sempre un errore
    // di lettura: per 0,2 s si resta all'ottava di prima. Un salto vero dura e passa; dopo un respiro passa subito.
    let octLast = NaN, octT = -9, octCalm = 0, octJump = 0;
    function octaveGuard(m) {
      if (Number.isNaN(m)) return m;
      const now = performance.now() / 1000, dd = m - octLast;
      if (now - octT > 0.06) { octCalm = now; octJump = 0; }
      else if (dd > 10.8 && dd < 13.2 && now - octCalm >= 0.15) {
        if (!octJump) octJump = now;
        if (now - octJump < 0.2) m -= 12; else { octJump = 0; octCalm = now; }
      } else { octJump = 0; if (Math.abs(dd) > 3) octCalm = now; }
      octLast = m;
      octT = now;
      return m;
    }
    return function read() {
      if (!V.analyser || !V.ctx) return { m: NaN, db: -120 };
      const buf = V.buf;
      V.analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const db = 10 * Math.log10(sum / buf.length + 1e-12);
      const r = db > gate ? yin(buf, V.ctx.sampleRate, fmin, fmax) : null;
      recent.push(r && r.clarity > 0.8 ? 69 + 12 * Math.log2(r.f / 440) : NaN);
      if (recent.length > 3) recent.shift();
      const v = recent.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
      return { m: octaveGuard(v.length >= 2 ? v[v.length >> 1] : NaN), db }; // mediana breve contro i salti isolati
    };
  }

  // ---- Note di riferimento ----
  // Timbro morbido, ma con armonici decrescenti che cadono dove l'altoparlante del telefono suona bene
  // (sopra i 300 Hz circa). Più la nota è grave, più armonici: l'orecchio ricostruisce la nota anche se
  // il telefono non ne riproduce la fondamentale.
  const HARMONICS = {
    low: [0, 1, 0.85, 0.65, 0.5, 0.36, 0.26, 0.18, 0.12, 0.08],
    mid: [0, 1, 0.6, 0.38, 0.24, 0.15, 0.09],
    high: [0, 1, 0.38, 0.18, 0.08],
  };
  const waves = {};
  function waveFor(f) {
    const key = f < 180 ? 'low' : f < 350 ? 'mid' : 'high';
    if (!waves[key]) {
      const amps = HARMONICS[key];
      waves[key] = V.ctx.createPeriodicWave(new Float32Array(amps.length), Float32Array.from(amps));
    }
    return waves[key];
  }
  // Oscillatore con quel timbro, già filtrato: { o: da avviare e fermare, node: da collegare }.
  function voiceOsc(f) {
    const o = V.ctx.createOscillator();
    o.setPeriodicWave(waveFor(f));
    o.frequency.value = f;
    const lp = V.ctx.createBiquadFilter(); // toglie solo l'asprezza in alto
    lp.type = 'lowpass';
    lp.frequency.value = clamp(f * 9, 1800, 4500);
    lp.Q.value = 0.5;
    o.connect(lp);
    return { o, node: lp };
  }
  function tone(midi, t, dur, vol, dest = V.out) {
    const { o, node } = voiceOsc(mtof(midi));
    const g = V.ctx.createGain();
    const rel = Math.max(t + 0.06, t + dur - 0.06);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.025);
    g.gain.setValueAtTime(vol, rel);
    g.gain.setTargetAtTime(0, rel, 0.06);
    node.connect(g).connect(dest);
    o.start(t);
    o.stop(rel + 0.5);
  }

  // ---- Voce che canta una sillaba ----
  // Dente di sega filtrato sulle formanti della vocale (voce chiara; adulta per le note gravi, se non è
  // una voce da bambino), con una consonante iniziale semplificata, un piccolo scivolamento d'attacco e un
  // vibrato leggero. Le consonanti sono accennate: contano soprattutto le vocali.
  function bandpass(freq, q, gain) {
    const filter = V.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const amp = V.ctx.createGain();
    amp.gain.value = gain;
    filter.connect(amp);
    return { filter, amp };
  }
  const VOWELS = {
    a: [[850, 1500, 2800], [1, 0.6, 0.14]],
    e: [[550, 2100, 2900], [1, 0.45, 0.18]],
    i: [[320, 2600, 3300], [1, 0.35, 0.18]],
    o: [[520, 950, 2800], [1, 0.55, 0.08]],
    u: [[400, 950, 2800], [1, 0.45, 0.08]],
  };
  const VOWELS_ADULT = {
    a: [[730, 1090, 2440], [1, 0.6, 0.14]],
    e: [[530, 1840, 2480], [1, 0.45, 0.18]],
    i: [[270, 2290, 3010], [1, 0.35, 0.18]],
    o: [[570, 840, 2410], [1, 0.55, 0.08]],
    u: [[300, 870, 2240], [1, 0.45, 0.08]],
  };
  function parseSyl(syl) {
    const w = syl.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '').replace(/^h/, '');
    const m = w.match(/^([^aeiou]*)(.*)$/);
    let onset = m[1], rest = m[2];
    // ci, gi, sci davanti a vocale: la i non si sente (ciuf, giù)
    if (['c', 'g', 'sc'].includes(onset) && rest.length > 1 && rest[0] === 'i' && 'aeou'.includes(rest[1])) { onset += 'i'; rest = rest.slice(1); }
    const v = rest.match(/^([aeiou]+)(.*)$/);
    return { onset, vowels: (v ? v[1] : 'u').split(''), coda: v ? v[2] : '' };
  }
  function onsetKind(o) {
    if (!o) return null;
    if (o === 'l' || o === 'r' || o === 'gl') return 'liquid';
    if (o === 'm' || o === 'n') return 'nasal';
    if (['b', 'd', 'g', 'br'].includes(o)) return 'voiced';
    if (['ci', 'gi', 'z'].includes(o)) return 'affricate';
    if (o === 'sc' || o === 'sci') return 'sh';
    if (['f', 'fr', 'v', 's', 'sv'].includes(o)) return 'fricative';
    return 'stop'; // p, t, c, ch, q, st
  }
  let noiseBuf = null;
  function noise(t, dur, freq, gain, dest, q = 1.2) {
    if (!noiseBuf) {
      noiseBuf = V.ctx.createBuffer(1, V.ctx.sampleRate, V.ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = V.ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = V.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = V.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(bp).connect(g).connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
  // child: voce da bambino anche sulle note gravi (Lu); dest: dove mandare la voce (di solito l'uscita).
  function singSyl(midi, t, dur, syl = 'lu', vol = 0.9, dest = V.out, child = false) {
    const ctx = V.ctx;
    const { onset, vowels, coda } = parseSyl(syl || 'lu');
    const kind = onsetKind(onset);
    const f = mtof(midi);
    const on = { stop: 0.03, voiced: 0.03, affricate: 0.07, sh: 0.08, fricative: 0.07, nasal: 0.07 }[kind] || 0;
    const codaDur = /^[nm]/.test(coda) ? Math.min(0.12, dur * 0.25) : coda ? Math.min(0.08, dur * 0.2) : 0;
    const vStart = t + on;
    const vEnd = Math.max(vStart + 0.08, t + dur - codaDur);

    const vo = ctx.createGain();
    vo.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3400;
    vo.connect(lp).connect(dest);
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = f;
    const sine = ctx.createOscillator();
    sine.frequency.value = f;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.3;
    const vibAmt = ctx.createGain();
    vibAmt.gain.setValueAtTime(0, t);
    vibAmt.gain.linearRampToValueAtTime(14, t + Math.min(0.45, dur * 0.6));
    vib.connect(vibAmt);
    for (const o of [saw, sine]) {
      vibAmt.connect(o.detune);
      o.detune.setValueAtTime(-35, t);
      o.detune.linearRampToValueAtTime(0, t + 0.08);
    }
    // formanti della vocale (o delle vocali, che scivolano una nell'altra: mi-ao, pio)
    const tuned = (v) => {
      const [fr, gn] = (f < 260 && !child ? VOWELS_ADULT : VOWELS)[v] || VOWELS.u;
      const f1 = Math.max(fr[0], f * 1.08);
      return [[f1, Math.max(fr[1], f1 * 1.4), fr[2]], gn];
    };
    const first = tuned(vowels[0]);
    const bands = [0, 1, 2].map((k) => bandpass(first[0][k], [4, 6, 8][k], first[1][k]));
    for (const b of bands) { saw.connect(b.filter); b.amp.connect(vo); }
    if (kind === 'liquid') { // la "l": seconda formante che parte alta e scende sulla vocale
      bands[1].filter.frequency.setValueAtTime(1500, t);
      bands[1].filter.frequency.exponentialRampToValueAtTime(first[0][1], vStart + 0.08);
    }
    const seg = (vEnd - vStart) / vowels.length;
    let prev = first;
    vowels.forEach((v, i) => {
      if (!i) return;
      const next = tuned(v);
      const at = vStart + seg * i;
      bands.forEach((b, k) => {
        b.filter.frequency.setValueAtTime(prev[0][k], at - seg * 0.4);
        b.filter.frequency.linearRampToValueAtTime(next[0][k], at);
        b.amp.gain.setValueAtTime(prev[1][k], at - seg * 0.4);
        b.amp.gain.linearRampToValueAtTime(next[1][k], at);
      });
      prev = next;
    });
    const body = ctx.createGain();
    body.gain.value = 0.35;
    sine.connect(body).connect(vo);

    // inviluppo: le consonanti sonore (l, m, n, b, d) partono già con un po' di voce
    const voicedOnset = ['liquid', 'nasal', 'voiced'].includes(kind) || !kind;
    vo.gain.setValueAtTime(0, t);
    if (voicedOnset) {
      vo.gain.linearRampToValueAtTime(vol * (kind === 'nasal' ? 0.3 : 0.5), t + Math.max(0.03, on));
      vo.gain.linearRampToValueAtTime(vol, vStart + 0.06);
    } else {
      vo.gain.setValueAtTime(0, vStart);
      vo.gain.linearRampToValueAtTime(vol, vStart + 0.03);
    }
    vo.gain.setValueAtTime(vol, vEnd);
    if (/^[nm]/.test(coda)) { // din, don, scen: la voce si chiude in un ronzio
      vo.gain.linearRampToValueAtTime(vol * 0.3, vEnd + 0.04);
      vo.gain.setValueAtTime(vol * 0.3, t + dur - 0.04);
      vo.gain.setTargetAtTime(0, t + dur - 0.04, 0.04);
    } else if (coda) {
      vo.gain.setTargetAtTime(0, vEnd, 0.02);
    } else {
      vo.gain.setTargetAtTime(0, Math.max(vEnd, t + dur - 0.05), 0.05);
    }
    // consonanti di rumore
    if (kind === 'stop') noise(t, 0.03, /t/.test(onset) ? 3500 : onset === 'p' ? 1000 : 2200, 0.22, dest);
    else if (kind === 'voiced') noise(t, 0.025, 900, 0.12, dest);
    else if (kind === 'affricate') noise(t, 0.08, 3200, 0.16, dest);
    else if (kind === 'sh') noise(t, 0.09, 2600, 0.18, dest);
    else if (kind === 'fricative') noise(t, 0.08, onset === 's' ? 5500 : 1800, 0.1, dest);
    if (coda === 'f') noise(vEnd, 0.08, 1800, 0.1, dest);
    else if (coda === 'c') noise(vEnd + 0.02, 0.03, 2200, 0.15, dest);
    const end = t + dur + 0.4;
    for (const o of [saw, sine, vib]) { o.start(t); o.stop(end); }
  }

  return Object.assign(V, {
    mtof, ensureCtx, resumeAudio, startMic, releaseAudio, audioStateText, micErrorText,
    pitchReader, voiceOsc, tone, singSyl,
  });
})();
