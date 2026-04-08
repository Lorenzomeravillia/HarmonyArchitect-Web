# AI Implementation Memory & Context

Questo documento traccia le decisioni architetturali, i bug fix critici e le scelte implementative fatte durante lo sviluppo. 
**Regola per l'AI:** Prima di proporre refactoring pesanti o sovrascrivere funzioni in `main.js` o `music_engine.js`, controlla questa lista per evitare di sovrascrivere (regressione) soluzioni costruite nei prompt precedenti.

## 1. Music Engine - Pedagogical Voice Leading (`music_engine.js`)
- **Cost Function Avanzata**: L'algoritmo non usa solo la distanza euclidea. Applica penalità per le quinte/ottave parallele (cost += 50), penalizza salti eccessivi del Soprano (Lead) all'interno di una progressione, e premia i moti contrari nella risoluzione del tritono. *Non semplificare la cost function tornando alla semplice media matematica.*
- **Pedagogical Enharmonic Anchoring**: L'ortografia delle note (flat/sharp) alterate di un accordo (es. dominant #5/#9) viene forzata a coincidere con le note della Tonalità Globale attiva. Se l'armatura di chiave di Do minore prevede Eb, e l'algoritmo calcolerebbe un D# per il dominante G7#5, il codice la sovrascrive a Eb per evitare salti di *flip-flop* visivo.

## 2. Top-Down Semantic Indexing (Metodo Jazz)
- **Logica Voicing**: Il Lead (Soprano) usa fisso il `voiceIdx = 6`. Il Bass usa fisso il `voiceIdx = 0`. Le voci interne (4, 3, 2, 1) crescono a scendere. Questo serve per aggirare il problema dei "buchi" di voci negli accordi radi e mantenere i tasti grafici "Solo" ancorati alle stesse tracce senza disallinearsi.
- **Aggiornamento UI (`main.js` & `gui.js`)**: I bottoni in `gui.js` ("Bass", "2nd", "Lead" ecc.) interrogano esplicitamente `voiceIdx` tramite un `Set` condiviso su tutta la durata della progressione, mostrandosi solo se presenti, ed eliminando l'index lookup fallace. Entrambi i sistemi di chiamate in `main.js` (sia iniziale che per il replay) non fanno override forzato sui bottoni errati.

## 3. Continuità di Stato (`_prevV`) (`main.js`)
- Il loop responsabile della generazione della progressione armonica usa una variabile _mutabile_ `let _prevV = null;` che viene aggiornata col return di ogni ciclo per inanellare correttamente il voice leading senza spezzarlo. *(In passato venne introdotto un bug dove era perennemente passata come `null` bloccando l'orizzontalità melodica).*

## 4. UI e Autoresizing (`main.js` & `gui.js`)
- **Pulsanti Troncati (Mobile Portrait)**: La funzione `createAnswers` analizza la stringa multiriga (divisa da `\n`) tenendo conto di _entrambe le righe_ per calcolare il `maxLen`, e scala agilmente il `font-size` a 10px / 12px con un `break-word` per impedire ai bottoni di overfloware sul display del telefono.
- **Armatura di Chiave Scomparsa (Primo Esercizio)**: Quando il canvas viene ridimensionato (per l'ingresso dei tasti _Solo_ nel DOM o l'attivazione della modalità _FullScreen_), il `ResizeObserver` può entrare in race condition col canvas. Per questo motivo in `main.js -> startNewChallenge` il rendering iniziale della chiave usa `requestAnimationFrame` dopo tutte le modifiche visive, stabilizzando la corretta visualizzazione delle alterazioni dal primissimo accordo.
