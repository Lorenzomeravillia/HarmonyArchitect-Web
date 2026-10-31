# App di intonazione

Ogni app è una cartella con la sua pagina (`index.html`), le icone e il manifest per "Aggiungi a Home".
Gli indirizzi corti sono definiti in `vercel.json`.

| App | Indirizzo | Cartella |
|---|---|---|
| Rullo intonazione: rullo di pianoforte e gioco "prendi la nota" | https://clearvoicing.vercel.app/rullo | `apps/rullo` |
| Sirena: la cometa da far volare con la voce | https://clearvoicing.vercel.app/sirena | `apps/sirena` |
| Canta con Lu: percorso per bambini | https://clearvoicing.vercel.app/bimbi | `apps/bimbi` |
| Test microfono | https://clearvoicing.vercel.app/test-microfono | `apps/test-microfono` |

Il codice audio comune a Rullo, Sirena e Canta con Lu sta in `apps/shared/voce.js` (servito come `/shared/voce.js`):
contesto audio e sessione dell'iPhone, microfono, rilevamento della nota, note di riferimento, voce che canta le sillabe
e rilascio dell'audio quando l'app va in background. Una correzione fatta lì vale per tutte e tre; ogni app tiene
solo i suoi suoni e i suoi parametri (volume, soglia del microfono, nota più grave da cercare).
Il test del microfono resta a sé, per poter diagnosticare l'audio anche se il codice comune avesse un problema.

I vecchi indirizzi (`/pitch-roll.html`, `/bimbi.html`, `/mic-test.html`) rimandano a quelli nuovi.
L'app principale ClearVoicing resta in `WebVersion/` ed è servita da `/`.
