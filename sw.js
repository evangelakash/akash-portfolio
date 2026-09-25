/* Offline cache for the heavy parts of the site, above all the 3D house.
   GitHub Pages serves everything with max-age=600, so ten minutes after a visit the browser fetches the
   whole house again, and on this connection that is minutes of waiting. Here the big static files are kept
   under a build-stamped cache: a second visit paints from disk, and the pages themselves still come from
   the network so edits appear at once. */
const BUILD = '1790341775';                       // stamped by 3D/house3d/web_post.py at export time
const CACHE = `akash-portfolio-${BUILD}`;
// Worth keeping: large, and either carrying this build in the URL (the house) or changing about never
// (three.js, the fonts). Nothing else is cached ahead of time, so an edit to any other file lands at once.
const HOUSE = /\/img\/house3d\//;
const KEEP = [HOUSE, /\/vendor\//, /\/fonts\//];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('akash-portfolio-') && k !== CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.headers.has('range')) return;              // a resumed download talks to the network itself
  const heavy = KEEP.some((re) => re.test(new URL(req.url).pathname));

  if (heavy) {                                        // cache first: these are the slow ones
    // the house's files carry ?v=<build> and the cache itself is named for the build, so the query can be
    // ignored on the way in; everything else has to match exactly or a changed file would never be seen
    const opts = { ignoreSearch: HOUSE.test(new URL(req.url).pathname) };
    e.respondWith((async () => {
      const hit = await caches.match(req, opts);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      } catch (err) {
        const late = await caches.match(req, opts);
        if (late) return late;
        throw err;
      }
    })());
    return;
  }
  // everything else: the network decides, and the cache is only the fallback when there is none
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && (req.destination === 'document' || req.destination === 'style' || req.destination === 'script')) {
        (await caches.open(CACHE)).put(req, res.clone());
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      throw err;
    }
  })());
});
