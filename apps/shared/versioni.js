// Versioni delle app di intonazione, con le date vere (dalla cronologia del repository) e i miglioramenti di
// ciascuna, scritti per chi le usa. A ogni rilascio si aggiunge una voce in cima alla lista dell'app.
window.Versioni = (() => {
  'use strict';
  const IPHONE = 'Audio più affidabile su iPhone: niente blocchi alla ripresa, microfono e audio rilasciati quando l’app va '
    + 'in background, una scheda chiara «Attiva il suono» se serve un tocco, e messaggi d’errore che dicono cosa fare.';
  const OTTAVE = 'Niente più brevi salti all’ottava sopra nella lettura della voce, che capitavano soprattutto con le voci gravi '
    + 'e le vocali «u» e «i».';
  const CONDIVISO = (altre) => `L’audio è in comune con ${altre}: ogni correzione d’ora in poi vale per tutte e tre le app.`;
  const ELENCO = (dove) => `Questo elenco delle versioni, ${dove}.`;
  const RUVIDA = (chi) => 'Corretto un errore arrivato con la correzione delle ottave del 31 ottobre: con una voce un po\u2019 ruvida '
    + `(raucedine, finali di frase) la nota veniva letta un\u2019ottava sotto e ${chi} saltava su e giù. `
    + 'I brevi salti all\u2019ottava sopra restano fermati, ora un po\u2019 più a lungo.';

  const LISTE = {
    rullo: [
      { v: '1.8', date: '2026-11-03', items: [RUVIDA('il disegno')] },
      { v: '1.7', date: '2026-11-03', items: [ELENCO('in fondo alla scheda del gioco')] },
      { v: '1.6', date: '2026-10-31', items: [
        'Trascinando verso destra si rivedono gli ultimi 5 minuti del disegno; la vista resta ferma mentre si continua a cantare, '
          + 'e il pulsante «Adesso» riporta al presente.',
      ] },
      { v: '1.5', date: '2026-10-31', items: [OTTAVE, CONDIVISO('Sirena e Canta con Lu')] },
      { v: '1.4', date: '2026-10-29', items: [IPHONE, 'Un indirizzo tutto suo (/rullo) e la sua icona per la schermata Home.'] },
      { v: '1.3', date: '2026-10-28', items: ['Nomi brevi sotto le icone della barra: Cancella, Sirena, Avvia, Segui, Gioco.'] },
      { v: '1.2', date: '2026-10-27', items: [
        'Note di riferimento più forti e ricche di armonici: si sentono dall’altoparlante del telefono anche con le voci gravi.',
      ] },
      { v: '1.1', date: '2026-10-26', items: ['Il gioco «Prendi la nota»: ascolta, canta e tieni la nota; punti per velocità e precisione.'] },
      { v: '1.0', date: '2026-10-26', items: ['Il rullo di pianoforte che scorre e mostra la nota cantata, con l’indicatore dei cents.'] },
    ],
    sirena: [
      { v: '2.1', date: '2026-11-03', items: [RUVIDA('la cometa')] },
      { v: '2.0', date: '2026-11-03', items: [ELENCO('nelle impostazioni')] },
      { v: '1.9', date: '2026-11-03', items: [
        'Nuova modalità Esplora, per prima nel menu: canto libero, con accanto alla cometa il nome della nota e la sua distanza dalla '
          + 'casa, gli intervalli da scoprire e le onde riconosciute. Prepara all’esercizio Onde.',
        'Nomi delle note più grandi e chiari; quello della nota che stai cantando si accende.',
        'Un pulsante in alto a destra, durante il gioco, passa dal do mobile al do fisso.',
        'La calibrazione non si blocca più con un vibrato ampio.',
      ] },
      { v: '1.8', date: '2026-11-03', items: [
        'Onde e Sirena rifatte e davvero diverse: le onde sono piccole e regolari fra due note vicine; la sirena fa giri lenti dal grave '
          + 'all’acuto, ogni giro un po’ più in alto, con la nota in cima da tenere.',
        'Su cime e valli c’è il nome della nota, così si vede di quanto salire.',
        'Ogni scheda del menu dice cosa si fa e cosa allena. Nuovo ordine: Gradini, Onde, Sirena, Tempesta.',
        'I vecchi record di Onde, Sirena e Tempesta ripartono da zero, perché gli esercizi sono cambiati.',
      ] },
      { v: '1.7', date: '2026-11-03', items: [
        'Cometa precisa, un punto con un anello sottile, e una scia sottile che segue la voce vera e mostra il vibrato: dorata quando '
          + 'sei dentro il percorso, azzurra quando sei fuori.',
      ] },
      { v: '1.6', date: '2026-10-31', items: [OTTAVE, 'Le note acute di soprano sono lette giuste fino al Re6.', CONDIVISO('il Rullo e Canta con Lu')] },
      { v: '1.5', date: '2026-10-29', items: [
        'Canzoniere: si importano brani da file ABC e MIDI, scegliendo la parte da cantare, con il testo se c’è.',
        'Modalità Studio: si guarda e si ascolta tutto il brano, anche cantato con le sue parole.',
        'Nei brani molto estesi la vista segue le note, così si arriva anche alle più gravi e alle più acute.',
      ] },
      { v: '1.4', date: '2026-10-29', items: [IPHONE] },
      { v: '1.3', date: '2026-10-29', items: [
        'Il Canzoniere, con Bella ciao e la tonalità scelta in base al tipo di voce.',
        'Scelta del tempo, conteggio prima di ogni riga e battito visibile mentre si canta.',
        'Un indirizzo tutto suo (/sirena) e la sua icona per la schermata Home.',
      ] },
      { v: '1.2', date: '2026-10-27', items: ['Note delle pause molto più udibili dall’altoparlante del telefono, anche quelle gravi.'] },
      { v: '1.1', date: '2026-10-27', items: [
        'Livelli di esperienza, Allenati e Sfida, nomi delle note (do mobile, numeri o nomi reali), percorsi musicali ai livelli facili '
          + 'e atonali a Esperto.',
      ] },
      { v: '1.0', date: '2026-10-27', items: ['La cometa luminosa da far volare con la voce lungo una scia di luce, attraverso le porte.'] },
    ],
    bimbi: [
      { v: '1.8', date: '2026-11-03', items: [RUVIDA('Lu')] },
      { v: '1.7', date: '2026-11-03', items: [ELENCO('nell’Area adulti')] },
      { v: '1.6', date: '2026-10-31', items: [
        'L’arcobaleno arriva dopo «I gattini» ed è più dolce: salite e discese di al massimo una quinta.',
        'Ogni tappa si centra sulla voce della bambina, misurata giocando ai regali (media delle ultime 5 volte); il − e + dell’Area '
          + 'adulti diventa una correzione.',
        CONDIVISO('il Rullo e Sirena'),
      ] },
      { v: '1.5', date: '2026-10-31', items: [
        'Nuova prima tappa «I regali di Lu»: si canta liberamente e si aprono regali sempre più lontani dalla nota di casa.',
        OTTAVE,
      ] },
      { v: '1.4', date: '2026-10-29', items: [IPHONE] },
      { v: '1.3', date: '2026-10-29', items: [
        'Bella ciao come ultime due tappe, nella tonalità della sua voce.',
        'Tenendo premuta per 10 secondi una tappa chiusa, l’adulto la apre.',
        'Un indirizzo tutto suo (/bimbi) e la sua icona per la schermata Home.',
      ] },
      { v: '1.2', date: '2026-10-27', items: [
        'Un colore per ogni nota, sempre lo stesso; l’arcobaleno di riscaldamento; la pausa automatica quando si esce dall’app; '
          + 'i dati per l’insegnante.',
        'Le stelle dell’arcobaleno si prendono senza suoni, e Lu vola più stabile.',
        'Ogni tappa si presenta con il suo personaggio e le sue parole.',
      ] },
      { v: '1.1', date: '2026-10-27', items: ['Il percorso a tappe, dal più facile al più difficile, e schermate finali che non sfarfallano.'] },
      { v: '1.0', date: '2026-10-27', items: ['Il gioco di canto per bambini: Lu vola con la voce e raccoglie le stelle.'] },
    ],
  };
  const when = (d) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  // L'elenco di un'app come HTML (testi fissi, scritti qui: niente da ripulire).
  function html(app) {
    return (LISTE[app] || []).map((r) => `<section class="ver"><h3>Versione ${r.v} <small>${when(r.date)}</small></h3>`
      + `<ul>${r.items.map((i) => `<li>${i}</li>`).join('')}</ul></section>`).join('');
  }
  const current = (app) => (LISTE[app] && LISTE[app][0] ? LISTE[app][0].v : '');
  return { html, current };
})();
