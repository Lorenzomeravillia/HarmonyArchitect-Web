// Importazione di brani nel canzoniere della Sirena: file MIDI (anche karaoke .kar) e testo ABC.
// Tutto lavora in battiti (semiminima = 1) e produce lo stesso formato dei brani già presenti:
// { title, subtitle, bpm, tonic, minor, meter, pickups, lines: [[nota MIDI, battiti, sillaba] | [null, battiti]] }.
window.SongImport = (() => {
  'use strict';

  const round3 = (x) => Math.round(x * 1000) / 1000;
  const IT = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
  const noteName = (n) => IT[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);

  // ---------------------------------------------------------------- strumenti General MIDI
  const GM_FAMILY = ['Pianoforte', 'Percussioni intonate', 'Organo', 'Chitarra', 'Basso', 'Archi', 'Archi e cori', 'Ottoni',
    'Ance', 'Flauti', 'Synth solista', 'Synth pad', 'Effetti synth', 'Strumenti etnici', 'Percussioni', 'Effetti'];
  const GM_NAMES = { 0: 'Pianoforte', 4: 'Piano elettrico', 11: 'Vibrafono', 19: 'Organo da chiesa', 21: 'Fisarmonica', 24: 'Chitarra classica',
    25: 'Chitarra acustica', 26: 'Chitarra jazz', 27: 'Chitarra elettrica', 32: 'Basso acustico', 33: 'Basso elettrico', 40: 'Violino',
    41: 'Viola', 42: 'Violoncello', 43: 'Contrabbasso', 48: 'Archi', 52: 'Coro «aah»', 53: 'Voce «ooh»', 54: 'Voce synth', 56: 'Tromba',
    57: 'Trombone', 60: 'Corno', 64: 'Sax soprano', 65: 'Sax contralto', 66: 'Sax tenore', 67: 'Sax baritono', 68: 'Oboe', 70: 'Fagotto',
    71: 'Clarinetto', 72: 'Ottavino', 73: 'Flauto', 74: 'Flauto dolce', 75: 'Flauto di Pan', 79: 'Ocarina', 80: 'Synth (onda quadra)' };
  const gmName = (prog) => (prog == null ? '' : GM_NAMES[prog] || GM_FAMILY[Math.floor(prog / 8)] || '');

  // ---------------------------------------------------------------- tonalità
  // Profili di Krumhansl-Kessler: servono a stimare la tonalità quando il file non la dichiara.
  const KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  function estimateKey(notes) {
    const h = new Array(12).fill(0);
    for (const n of notes) h[((n.pitch % 12) + 12) % 12] += n.dur;
    const corr = (prof, k) => {
      const xs = h, ys = h.map((_, i) => prof[(i - k + 12) % 12]);
      const mx = xs.reduce((a, b) => a + b) / 12, my = ys.reduce((a, b) => a + b) / 12;
      let num = 0, dx = 0, dy = 0;
      for (let i = 0; i < 12; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
      return num / Math.sqrt(dx * dy || 1);
    };
    let best = { pc: 0, minor: false, r: -Infinity };
    for (let k = 0; k < 12; k++) {
      const a = corr(KK_MAJ, k), b = corr(KK_MIN, k);
      if (a > best.r) best = { pc: k, minor: false, r: a };
      if (b > best.r) best = { pc: k, minor: true, r: b };
    }
    return best;
  }
  // tonica maggiore dal numero di diesis/bemolle (circolo delle quinte)
  const sfToMajorPc = (sf) => (((sf * 7) % 12) + 12) % 12;

  // ---------------------------------------------------------------- da note a brano
  // notes: [{ start, dur, pitch, syl, brk }] in battiti; bars: posizioni dei primi tempi (opzionale).
  function buildSong(o) {
    const notes = o.notes.filter((n) => n.dur > 0.01).sort((a, b) => a.start - b.start);
    if (notes.length < 3) throw new Error('In questa parte ci sono troppo poche note.');
    const barLen = o.barLen || 4;
    const offset = o.barOffset || 0;
    const bars = o.bars && o.bars.length ? [...new Set(o.bars.map(round3))].sort((a, b) => a - b) : null;
    const isDown = (t) => (bars ? bars.some((b) => Math.abs(b - t) < 0.02)
      : Math.abs(((t - offset) / barLen) - Math.round((t - offset) / barLen)) < 0.02);
    const downAfter = (t) => {
      if (bars) { for (const b of bars) if (b >= t - 0.02) return b; }
      return offset + Math.ceil((t - offset) / barLen - 0.02) * barLen;
    };
    // Righe: si va a capo alle interruzioni del testo o della musica scritta, dopo una pausa di almeno
    // un battito, oppure sul primo tempo dopo 4 battute (al massimo dopo 6, per non avere righe infinite).
    const lines = [];
    let cur = null;
    notes.forEach((n, i) => {
      const prev = notes[i - 1];
      const gap = prev ? n.start - (prev.start + prev.dur) : 0;
      const span = cur ? n.start - cur.start : 0;
      if (!cur || (n.brk && span >= 2) || (gap >= 0.99 && span >= 2) || (span >= 4 * barLen && isDown(n.start)) || span >= 6 * barLen) {
        cur = { start: n.start, notes: [] };
        lines.push(cur);
      }
      cur.notes.push(n);
    });
    const outLines = [], pickups = [];
    for (const L of lines) {
      const ev = [];
      L.notes.forEach((n, j) => {
        const next = L.notes[j + 1];
        const dur = next ? Math.min(n.dur, next.start - n.start) : n.dur;
        ev.push([n.pitch, round3(dur), n.syl || '']);
        if (next) { const rest = next.start - (n.start + dur); if (rest > 0.05) ev.push([null, round3(rest)]); }
      });
      outLines.push(ev);
      pickups.push(round3(Math.max(0, downAfter(L.start) - L.start)));
    }
    const key = o.key || estimateKey(notes);
    const sorted = notes.map((n) => n.pitch).sort((a, b) => a - b);
    const med = sorted[sorted.length >> 1];
    const tonic = med - ((((med - key.pc) % 12) + 12) % 12); // la tonica nel registro della melodia, sotto la nota media
    return {
      id: 'imp-' + Date.now().toString(36),
      title: o.title || 'Brano importato',
      subtitle: o.subtitle || 'Brano importato',
      bpm: Math.max(30, Math.min(240, Math.round(o.bpm || 100))),
      tonic, minor: !!key.minor,
      meter: Math.max(1, Math.round(barLen)),
      pickups, lines: outLines, imported: true,
      keyFromFile: !o.key ? false : true,
    };
  }

  // Una sola nota per volta: quando più note partono insieme si tiene la più acuta (di solito la melodia),
  // e ogni nota finisce al più tardi quando comincia la successiva.
  function skyline(notes, tol) {
    const byStart = [];
    for (const n of [...notes].sort((a, b) => a.start - b.start || b.pitch - a.pitch)) {
      const last = byStart[byStart.length - 1];
      if (last && n.start - last.start <= tol) { if (n.pitch > last.pitch) Object.assign(last, n); continue; }
      byStart.push({ ...n });
    }
    for (let i = 0; i < byStart.length - 1; i++) {
      const room = byStart[i + 1].start - byStart[i].start;
      if (byStart[i].end - byStart[i].start > room) byStart[i].end = byStart[i].start + room;
    }
    return byStart;
  }

  function summarize(notes) {
    if (!notes.length) return { count: 0 };
    let lo = 127, hi = 0, poly = 0;
    const ev = [];
    for (const n of notes) { lo = Math.min(lo, n.pitch); hi = Math.max(hi, n.pitch); ev.push([n.start, 1], [n.end, -1]); }
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let c = 0;
    for (const [, d] of ev) { c += d; poly = Math.max(poly, c); }
    const avg = notes.reduce((a, n) => a + n.pitch, 0) / notes.length;
    return { count: notes.length, lo, hi, range: `${noteName(lo)}–${noteName(hi)}`, poly: poly > 1, avg };
  }

  // ---------------------------------------------------------------- MIDI
  function decodeText(bytes) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (e) { return new TextDecoder('latin1').decode(bytes); }
  }
  function parseMidi(buffer) {
    const d = new DataView(buffer);
    let p = 0;
    const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p + i)); p += n; return s; };
    const u32 = () => { const v = d.getUint32(p); p += 4; return v; };
    const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
    const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
    // file RIFF/RMID: il MIDI vero sta nel blocco "data"
    if (d.byteLength > 20 && str(4) === 'RIFF') {
      p = 12;
      while (p + 8 <= d.byteLength) { const id = str(4); const len = d.getUint32(p, true); p += 4; if (id === 'data') break; p += len; }
    } else p = 0;
    const base = p;
    if (str(4) !== 'MThd') throw new Error('Non sembra un file MIDI.');
    const hlen = u32();
    const format = u16(), ntrk = u16(), div = u16();
    p = base + 8 + hlen;
    if (div & 0x8000) throw new Error('Questo file MIDI usa un formato di tempo (SMPTE) che non so leggere.');
    const tracks = [];
    for (let t = 0; t < ntrk && p + 8 <= d.byteLength; t++) {
      const id = str(4), len = u32(), end = Math.min(d.byteLength, p + len);
      if (id !== 'MTrk') { p = end; continue; }
      const tr = { index: t, name: '', notes: [], lyrics: [], texts: [], tempos: [], timesigs: [], keysigs: [], programs: {} };
      const open = {};
      let tick = 0, status = 0;
      while (p < end) {
        tick += vlq();
        let b = d.getUint8(p);
        if (b === 0xff) {
          p++;
          const mt = d.getUint8(p++), ml = vlq(), ms = p;
          p += ml;
          const bytes = new Uint8Array(buffer, ms, Math.max(0, Math.min(ml, end - ms)));
          if (mt === 0x03 && !tr.name) tr.name = decodeText(bytes).trim();
          else if (mt === 0x01) tr.texts.push({ tick, text: decodeText(bytes) });
          else if (mt === 0x05) tr.lyrics.push({ tick, text: decodeText(bytes) });
          else if (mt === 0x51 && ml >= 3) tr.tempos.push({ tick, us: (bytes[0] << 16) | (bytes[1] << 8) | bytes[2] });
          else if (mt === 0x58 && ml >= 2) tr.timesigs.push({ tick, num: bytes[0], den: 2 ** bytes[1] });
          else if (mt === 0x59 && ml >= 2) tr.keysigs.push({ tick, sf: (bytes[0] << 24) >> 24, mi: bytes[1] });
          else if (mt === 0x2f) break;
          status = 0;
          continue;
        }
        if (b === 0xf0 || b === 0xf7) { p++; p += vlq(); status = 0; continue; }
        if (b & 0x80) { status = b; p++; } else if (!status) { p++; continue; } // "running status"
        const type = status & 0xf0, ch = status & 0x0f;
        const d1 = d.getUint8(p++);
        const d2 = type === 0xc0 || type === 0xd0 ? 0 : d.getUint8(p++);
        const key = ch * 128 + d1;
        if (type === 0x90 && d2 > 0) (open[key] = open[key] || []).push(tick);
        else if (type === 0x80 || (type === 0x90 && d2 === 0)) {
          const st = open[key] && open[key].shift();
          if (st != null && tick > st) tr.notes.push({ ch, pitch: d1, start: st, end: tick });
        } else if (type === 0xc0 && tr.programs[ch] == null) tr.programs[ch] = d1;
      }
      p = end;
      tracks.push(tr);
    }
    const all = (k) => tracks.flatMap((tr) => tr[k]).sort((a, b) => a.tick - b.tick);
    const tempo = all('tempos')[0], ts = all('timesigs')[0], ks = all('keysigs')[0];
    return {
      format, ppq: div, tracks,
      bpm: tempo ? 60e6 / tempo.us : 120,
      timeSig: ts ? { num: ts.num, den: ts.den } : { num: 4, den: 4 },
      keySig: ks || null,
      title: (tracks[0] && tracks[0].name) || '',
      lyricCount: all('lyrics').length,
    };
  }

  // Parti del file: nel tipo 1 una per traccia (e per canale, se una traccia ne usa più d'uno);
  // nel tipo 0, tutto è in una traccia e le parti si separano per canale. La batteria (canale 10) è esclusa.
  // sillabe del file: i "lyric" (in qualunque traccia), altrimenti i testi del karaoke (.kar)
  function lyricEvents(m) {
    let lyr = m.tracks.flatMap((tr) => tr.lyrics);
    if (!lyr.length) lyr = m.tracks.flatMap((tr) => tr.texts.filter((x) => isLyricText(x.text)));
    return lyr.sort((a, b) => a.tick - b.tick);
  }
  function midiParts(m) {
    const parts = [];
    const lyr = lyricEvents(m);
    for (const tr of m.tracks) {
      const chans = [...new Set(tr.notes.map((n) => n.ch))].sort((a, b) => a - b);
      for (const ch of chans) {
        const notes = tr.notes.filter((n) => n.ch === ch);
        const prog = tr.programs[ch];
        const instrument = ch === 9 ? 'Batteria' : gmName(prog);
        const byChannel = m.format === 0 || chans.length > 1;
        const name = (!byChannel && tr.name) || (byChannel ? `Canale ${ch + 1}` : '') || instrument || `Traccia ${tr.index + 1}`;
        const sum = summarize(notes);
        parts.push({
          id: `${tr.index}:${ch}`, track: tr.index, ch, name, instrument: ch === 9 ? 'Batteria' : instrument,
          drums: ch === 9, notes, ...sum, hits: ch === 9 ? 0 : lyricHits(lyr, notes, m.ppq),
        });
      }
    }
    // Il testo è della parte su cui cadono più sillabe (una parte che suona su ogni battito ne prende
    // parecchie per caso, ma meno della melodia vera).
    const maxHits = Math.max(0, ...parts.map((x) => x.hits));
    for (const x of parts) x.hasLyrics = x.hits >= Math.max(3, lyr.length * 0.5) && x.hits >= 0.85 * maxHits;
    // La parte che sembra la melodia: quella col testo, altrimenti la più acuta fra quelle quasi monodiche.
    const cand = parts.filter((x) => !x.drums && x.count >= 8);
    const score = (x) => (x.hasLyrics ? 1000 : 0) + (x.poly ? 0 : 30) + x.avg + Math.min(20, x.count / 20);
    const best = cand.sort((a, b) => score(b) - score(a))[0];
    if (best) best.suggested = true;
    return parts;
  }
  const isLyricText = (t) => t && !/^[@%]/.test(t) && t.trim().length > 0 && t.length < 40;
  // quante sillabe cadono sull'attacco di una nota di questa parte: dice se il testo è suo
  function lyricHits(lyr, notes, q) {
    const starts = notes.map((n) => n.start).sort((a, b) => a - b);
    let hits = 0, j = 0;
    for (const ev of lyr) {
      while (j < starts.length && starts[j] < ev.tick - q / 8) j++;
      if (j < starts.length && starts[j] <= ev.tick + q / 8) hits++;
    }
    return hits;
  }

  function midiToSong(m, part, fileName) {
    const q = m.ppq;
    const mel = skyline(part.notes, q / 16).map((n) => ({ start: n.start, end: n.end, pitch: n.pitch, syl: '', brk: false }));
    const lyr = lyricEvents(m);
    let breakNext = false, j = 0;
    for (const ev of lyr) {
      while (j < mel.length && mel[j].start < ev.tick - q / 8) j++;
      if (j >= mel.length) break;
      if (mel[j].start > ev.tick + q / 2) continue; // nessuna nota abbastanza vicina
      const raw = ev.text;
      if (/^[\/\\]/.test(raw) || breakNext) mel[j].brk = true;
      breakNext = /[\r\n]\s*$/.test(raw);
      const syl = raw.replace(/[\/\\\r\n]/g, '').trim().replace(/-+$/, '').replace(/^-+/, '');
      if (syl) mel[j].syl = mel[j].syl ? mel[j].syl + syl : syl;
    }
    const ts = m.timeSig;
    const key = m.keySig ? { pc: m.keySig.mi ? (sfToMajorPc(m.keySig.sf) + 9) % 12 : sfToMajorPc(m.keySig.sf), minor: !!m.keySig.mi } : null;
    return buildSong({
      title: m.title || (fileName || '').replace(/\.[^.]+$/, ''),
      subtitle: `Da MIDI · ${part.name}`,
      bpm: m.bpm,
      barLen: (ts.num * 4) / ts.den,
      key,
      notes: mel.map((n) => ({ start: n.start / q, dur: (n.end - n.start) / q, pitch: n.pitch, syl: n.syl, brk: n.brk })),
    });
  }
  // note di una parte, in battiti, per ascoltarla nel mixer
  function midiPartMelody(m, part) {
    return skyline(part.notes, m.ppq / 16).map((n) => ({ start: n.start / m.ppq, dur: (n.end - n.start) / m.ppq, pitch: n.pitch }));
  }

  // ---------------------------------------------------------------- ABC
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const LETTER_SF = { C: 0, D: 2, E: 4, F: -1, G: 1, A: 3, B: 5 };
  const MODE_SF = { '': 0, maj: 0, major: 0, ion: 0, mix: -1, dor: -2, m: -3, min: -3, minor: -3, aeo: -3, phr: -4, loc: -5, lyd: 1 };
  const MINOR_MODES = ['m', 'min', 'minor', 'aeo', 'dor', 'phr', 'loc'];

  function parseKey(s) {
    const m = /^\s*([A-Ga-g])([#b]?)\s*([A-Za-z]*)/.exec(s || '');
    if (!m || /^none/i.test(s)) return { sf: 0, pc: 0, minor: false, declared: false };
    const L = m[1].toUpperCase(), acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    let mode = m[3].toLowerCase();
    mode = mode.startsWith('maj') ? 'maj' : mode === 'm' ? 'm' : mode.slice(0, 3);
    const sf = LETTER_SF[L] + 7 * acc + (MODE_SF[mode] ?? 0);
    return { sf, pc: (LETTER_PC[L] + acc + 12) % 12, minor: MINOR_MODES.includes(mode), declared: true };
  }
  function keyAccidentals(sf) {
    const acc = {};
    if (sf > 0) for (const l of 'FCGDAEB'.slice(0, Math.min(7, sf))) acc[l] = 1;
    if (sf < 0) for (const l of 'BEADGCF'.slice(0, Math.min(7, -sf))) acc[l] = -1;
    return acc;
  }
  function parseFrac(s, def) { const m = /(\d+)\s*\/\s*(\d+)/.exec(s || ''); return m ? +m[1] / +m[2] : def; }

  function parseAbc(text) {
    const tunes = [];
    let tune = null;
    const newTune = () => ({
      title: '', composer: '', meter: [4, 4], unit: null, bpmRaw: null, key: parseKey(''), keyAcc: {}, inHeader: true,
      voices: {}, order: [], cur: null,
    });
    const voice = (t, id) => {
      id = id || '1';
      if (!t.voices[id]) { t.voices[id] = { id, name: '', notes: [], bars: [], t: 0, barAcc: {}, last: null, lastLine: [], tie: false, tuplet: null, next: 1 }; t.order.push(id); }
      return t.voices[id];
    };
    const unitOf = (t) => t.unit || (t.meter[0] / t.meter[1] < 0.75 ? 1 / 16 : 1 / 8);
    const field = (t, k, v) => {
      v = v.trim();
      if (k === 'T') { if (!t.title) t.title = v; }
      else if (k === 'C') { if (!t.composer) t.composer = v; }
      else if (k === 'M') { t.meter = /^C\|/.test(v) ? [2, 2] : /^C/.test(v) || /^none/i.test(v) ? [4, 4] : (/(\d+)\s*\/\s*(\d+)/.exec(v) || [0, 4, 4]).slice(1).map(Number); }
      else if (k === 'L') t.unit = parseFrac(v, null);
      else if (k === 'Q') t.bpmRaw = v;
      else if (k === 'K') { t.key = parseKey(v); t.keyAcc = keyAccidentals(t.key.sf); t.inHeader = false; }
      else if (k === 'V') {
        const id = v.split(/\s+/)[0];
        const vv = voice(t, id);
        const nm = /(?:name|nm)\s*=\s*"([^"]*)"/.exec(v) || /(?:name|nm)\s*=\s*(\S+)/.exec(v);
        if (nm && !vv.name) vv.name = nm[1];
        t.cur = id;
      } else if (k === 'w') lyrics(t, v);
    };
    const barline = (v) => {
      if (!v.bars.length || Math.abs(v.bars[v.bars.length - 1] - v.t) > 1e-6) v.bars.push(v.t);
      v.barAcc = {};
    };
    const lenOf = (num, slashes, den) => {
      let x = num ? +num : 1;
      if (slashes) x /= den ? +den : 2 ** slashes.length;
      return x;
    };
    const pitchOf = (t, v, acc, letter, oct) => {
      const L = letter.toUpperCase();
      let octave = letter === L ? 4 : 5;
      for (const c of oct) octave += c === "'" ? 1 : -1;
      const k = L + octave;
      let a;
      if (acc) { a = { '^': 1, '^^': 2, _: -1, __: -2, '=': 0 }[acc]; v.barAcc[k] = a; }
      else a = k in v.barAcc ? v.barAcc[k] : (t.keyAcc[L] || 0);
      return 12 * (octave + 1) + LETTER_PC[L] + a;
    };
    const addNote = (t, v, pitch, mult, lineNotes) => {
      let dur = unitOf(t) * 4 * mult * v.next;
      v.next = 1;
      if (v.tuplet) { dur *= v.tuplet.factor; if (--v.tuplet.left <= 0) v.tuplet = null; }
      if (pitch != null && v.tie && v.last && v.last.pitch === pitch) { v.last.dur += dur; v.t += dur; v.tie = false; return; }
      v.tie = false;
      if (pitch == null) { v.last = { rest: true, dur }; v.t += dur; return; }
      const n = { start: v.t, dur, pitch, syl: '', brk: !lineNotes.length };
      v.notes.push(n);
      lineNotes.push(n);
      v.last = n;
      v.t += dur;
    };
    const music = (t, s) => {
      const v = voice(t, t.cur);
      const lineNotes = [];
      let i = 0;
      while (i < s.length) {
        const c = s[i], rest = s.slice(i);
        let m;
        if (c === '"') { const j = s.indexOf('"', i + 1); i = j < 0 ? s.length : j + 1; continue; }
        if (c === '!' || c === '+') { const j = s.indexOf(c, i + 1); i = j > i ? j + 1 : i + 1; continue; }
        if (c === '{') { const j = s.indexOf('}', i + 1); i = j < 0 ? s.length : j + 1; continue; }
        if ((m = /^\[([A-Za-z]):([^\]]*)\]/.exec(rest))) { field(t, m[1], m[2]); if (m[1] === 'V') { music(t, s.slice(i + m[0].length)); return; } i += m[0].length; continue; }
        if ((m = /^\[\d[\d,]*/.exec(rest))) { i += m[0].length; continue; } // finali di ripetizione [1 [2
        if ((m = /^[|:\]\[]*\|[|:\]\[]*\d*|^:+\d*/.exec(rest)) && m[0].length) { barline(v); i += m[0].length; continue; }
        if ((m = /^\((\d)(?::(\d)?)?(?::(\d))?/.exec(rest))) {
          const pn = +m[1];
          const qn = m[2] ? +m[2] : { 2: 3, 3: 2, 4: 3, 6: 2, 8: 3 }[pn] || 2;
          v.tuplet = { left: m[3] ? +m[3] : pn, factor: qn / pn };
          i += m[0].length;
          continue;
        }
        if ((m = /^(>+|<+)/.exec(rest))) { // ritmo puntato: A>B, A<B
          const k = m[0].length, f = 1 - 0.5 ** k;
          if (v.last) {
            const old = v.last.dur;
            const nd = m[0][0] === '>' ? old * (1 + f) : old * (1 - f);
            v.last.dur = nd; v.t += nd - old;
            v.next = m[0][0] === '>' ? 1 - f : 1 + f;
          }
          i += k;
          continue;
        }
        if (c === '-') { v.tie = true; i++; continue; }
        if ((m = /^\[((?:[\^_=]*[A-Ga-g][,']*\d*\/*\d*)+)\](\d*)(\/*)(\d*)/.exec(rest))) { // accordo: si tiene la nota più acuta
          let best = null, firstLen = null, mm;
          const re = /([\^_=]*)([A-Ga-g])([,']*)(\d*)(\/*)(\d*)/g;
          while ((mm = re.exec(m[1]))) {
            const pt = pitchOf(t, v, mm[1] || '', mm[2], mm[3]);
            if (firstLen == null) firstLen = lenOf(mm[4], mm[5], mm[6]);
            if (best == null || pt > best) best = pt;
          }
          addNote(t, v, best, (firstLen || 1) * lenOf(m[2], m[3], m[4]), lineNotes);
          i += m[0].length;
          continue;
        }
        if ((m = /^(\^\^|\^|__|_|=)?([A-Ga-g])([,']*)(\d*)(\/*)(\d*)/.exec(rest))) {
          addNote(t, v, pitchOf(t, v, m[1] || '', m[2], m[3]), lenOf(m[4], m[5], m[6]), lineNotes);
          i += m[0].length;
          continue;
        }
        if ((m = /^([zx])(\d*)(\/*)(\d*)/.exec(rest))) { addNote(t, v, null, lenOf(m[2], m[3], m[4]), lineNotes); i += m[0].length; continue; }
        if ((m = /^Z(\d*)/.exec(rest))) { // pausa di più battute
          const bars = m[1] ? +m[1] : 1, bl = (t.meter[0] * 4) / t.meter[1];
          for (let b = 0; b < bars; b++) { v.t += bl; barline(v); }
          i += m[0].length;
          continue;
        }
        i++; // spazi, decorazioni di un carattere, legature di portamento
      }
      if (lineNotes.length) v.lastLine = lineNotes;
    };
    // testo sotto le note (w:): una sillaba per nota; "-" separa le sillabe, "_" prolunga, "*" salta una nota
    const lyrics = (t, s) => {
      const v = voice(t, t.cur);
      const notes = v.lastLine || [];
      let idx = 0, syl = '', lastWasHyphen = false;
      const put = () => { if (syl) { if (notes[idx]) notes[idx].syl = syl.replace(/~/g, ' '); idx++; syl = ''; } };
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '\\' && s[i + 1] === '-') { syl += '-'; i++; continue; }
        if (c === ' ' || c === '\t') { put(); lastWasHyphen = false; continue; }
        if (c === '-') { if (syl) { put(); lastWasHyphen = true; } else if (lastWasHyphen) idx++; else lastWasHyphen = true; continue; }
        if (c === '_') { put(); idx++; lastWasHyphen = false; continue; }
        if (c === '*') { put(); idx++; lastWasHyphen = false; continue; }
        if (c === '|') { put(); continue; }
        syl += c;
        lastWasHyphen = false;
      }
      put();
    };

    for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
      const line = raw.replace(/(^|[^\\])%.*$/, '$1');
      if (/^X:/.test(line)) { tune = newTune(); tunes.push(tune); continue; }
      if (!line.trim()) continue;
      if (!tune) { tune = newTune(); tunes.push(tune); }
      const f = /^([A-Za-z]):(.*)$/.exec(line);
      if (f && (tune.inHeader || 'KLMQVTwWPC'.includes(f[1]))) { if (f[1] !== 'W') field(tune, f[1], f[2]); continue; }
      if (tune.inHeader) continue; // righe strane prima di K:
      music(tune, line);
    }
    return tunes
      .map((t) => ({
        ...t,
        voiceList: t.order.map((id) => t.voices[id]).filter((v) => v.notes.length)
          .map((v) => ({ ...v, ...summarize(v.notes.map((n) => ({ pitch: n.pitch, start: n.start, end: n.start + n.dur }))), hasLyrics: v.notes.some((n) => n.syl) })),
      }))
      .filter((t) => t.voiceList.length);
  }

  function abcTempo(t) {
    const unit = t.unit || (t.meter[0] / t.meter[1] < 0.75 ? 1 / 16 : 1 / 8);
    const s = t.bpmRaw || '';
    let m = /(\d+)\s*\/\s*(\d+)\s*=\s*(\d+)/.exec(s);
    if (m) return +m[3] * (+m[1] / +m[2]) * 4;
    m = /^\s*(?:C\s*=\s*)?(\d+)\s*$/.exec(s);
    if (m) return +m[1] * unit * 4;
    return 100;
  }
  function abcToSong(t, v, fileName) {
    const barLen = (t.meter[0] * 4) / t.meter[1];
    // se il brano comincia con una battuta intera (senza levare), anche l'inizio è un primo tempo
    const bars = v.bars.length && Math.abs(v.bars[0] - barLen) < 0.01 ? [0, ...v.bars] : v.bars;
    return buildSong({
      title: t.title || (fileName || '').replace(/\.[^.]+$/, ''),
      subtitle: t.composer ? `${t.composer} · da ABC` : 'Da ABC',
      bpm: abcTempo(t),
      barLen,
      bars,
      key: t.key.declared ? { pc: t.key.pc, minor: t.key.minor } : null,
      notes: v.notes,
    });
  }

  return { parseMidi, midiParts, midiToSong, midiPartMelody, parseAbc, abcToSong, abcTempo, noteName, estimateKey };
})();
