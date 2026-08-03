/* 1001 Jazz — service worker（网络优先，保证内容更新即时生效、离线可用）。
 * 只处理同源 GET；跨域封面(iTunes)/肖像(维基)交由浏览器直取（本站已用 localStorage 缓存其 URL）。
 * 更新 SHELL 版本号即可让旧缓存失效。 */
const SHELL = "jazz-shell-v2";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js",
  "./data.js", "./artists.js", "./paths.js", "./favicon.svg", "./manifest.webmanifest"
];

self.addEventListener("install", e=>{
  self.skipWaiting();
  // cache:"reload" 绕开浏览器 HTTP 缓存 —— 否则换了新缓存名装进去的仍是旧副本，
  // 版本号变了内容没变，发布会静默失效（1001art 上踩过这个坑）
  e.waitUntil(caches.open(SHELL).then(c=>
    Promise.all(ASSETS.map(u=>
      fetch(new Request(u, {cache:"reload"})).then(r=>r.ok && c.put(u, r)).catch(()=>{})
    ))
  ).catch(()=>{}));
});

self.addEventListener("activate", e=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==SHELL).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return; // 跨域资源不拦截
  // 网络优先：拿最新，成功即回写缓存；离线时回退缓存，导航兜底 index.html
  e.respondWith((async()=>{
    try{
      const res = await fetch(req);
      const cache = await caches.open(SHELL);
      cache.put(req, res.clone());
      return res;
    }catch(err){
      const cached = await caches.match(req);
      if(cached) return cached;
      if(req.mode === "navigate") return caches.match("./index.html");
      throw err;
    }
  })());
});
