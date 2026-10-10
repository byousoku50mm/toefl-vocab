/* 英语词汇 · 离线缓存
   只拦**同源**请求：联网加词 / 爬词补全走外部域名，原样放行，
   否则在线功能会被缓存逻辑吃掉。 */
const CACHE = "evc-v4-95dae334";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest",
                "./icon-180.png", "./icon-192.png", "./icon-512.png", "./favicon-32.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== location.origin) return;      // 在线功能放行

  /* 导航请求：网络优先（联网时永远是最新页面），断网逐级兜底到首页。
     之前是缓存优先 + 版本号不变，页面会永远停在旧版，新改动到不了用户手上。
     iOS 加到主屏后打开的可能是 "./" 也可能是 "./index.html"，所以兜到底。 */
  if (req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok){                       // 404 不缓存，见根 sw.js 的说明
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then(hit => hit || caches.match("./index.html"))
          .then(hit => hit || caches.match("./"))
      )
    );
    return;
  }
  /* 其它资源：陈旧先用、后台更新 */
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
