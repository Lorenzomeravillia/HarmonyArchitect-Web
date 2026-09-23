// ClearVoicing — service worker dedicato alla cache dei campioni audio.
//
// Strategia: cache-first SOLO per i file dei campioni (self-hosted e CDN).
// Tutto il resto (index.html, js, css) NON viene intercettato, così il
// comportamento di deploy (no-store su index.html, ?v= sui js) resta intatto.
//
// Versionamento: SAMPLES_VERSION è la "firma" del set di campioni usato da
// questa versione dell'app. Finché non cambia, gli utilizzi successivi non
// scaricano nulla: ogni richiesta di campione viene servita dalla memoria del
// dispositivo. Quando una release modifica il set (strumenti, mappe, URL),
// bumpare SAMPLES_VERSION: alla prima visita dopo l'aggiornamento la cache
// vecchia viene eliminata e i campioni aggiornati vengono riscaricati.
const SAMPLES_VERSION = 'v2';
const CACHE_NAME = 'cv-samples-' + SAMPLES_VERSION;

const SAMPLE_URL_PATTERNS = [
    /\/assets\/samples\//,                                        // self-hosted
    /^https:\/\/nbrosowsky\.github\.io\/tonejs-instruments\/samples\//  // CDN
];

self.addEventListener('install', () => {
    // Attiva subito la nuova versione senza aspettare la chiusura delle tab.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Elimina le cache di versioni precedenti del set di campioni.
        const names = await caches.keys();
        await Promise.all(
            names
                .filter(n => n.startsWith('cv-samples-') && n !== CACHE_NAME)
                .map(n => caches.delete(n))
        );
        // Prendi il controllo delle pagine già aperte: così anche il primo
        // caricamento campioni dopo l'install passa dalla cache.
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = event.request.url;
    if (!SAMPLE_URL_PATTERNS.some(re => re.test(url))) return;

    // Never answer a ranged request from the cache. Safari fetches media for
    // an <audio> element with a Range header and expects a 206 with the bytes
    // it asked for; handing it a complete 200 from the cache makes playback
    // fail silently. Tone.js loads samples with fetch/XHR and is unaffected,
    // which is why this only bites the <audio> fallback engine — the exact
    // path that has to keep working when Web Audio is wedged. Let these go
    // straight to the network (and to the HTTP cache, which handles ranges).
    if (event.request.headers.get('range')) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const resp = await fetch(event.request);
        // Salva solo risposte valide: un errore di rete non deve
        // avvelenare la cache.
        if (resp && resp.ok) {
            cache.put(event.request, resp.clone());
        }
        return resp;
    })());
});
