/* Offline bundle. Update CACHE_VERSION for releases; all files installed before activation. */
const CACHE_VERSION='killteam-private-v2.0.2';
const APP_FILES=[
 './','./index.html','./app.js','./styles.css','./manifest.webmanifest',
 './core/engine.js','./core/storage.js','./core/pack.js','./core/local-api.js',
 './packs/index.json',
 './icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_VERSION).then(cache=>cache.addAll(APP_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('killteam-')&&k!==CACHE_VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
  if(response.ok){const backup=response.clone();caches.open(CACHE_VERSION).then(cache=>cache.put(event.request,backup))}
  return response;
 }).catch(async()=>{
  if(event.request.mode==='navigate')return(await caches.match('./index.html'))||Response.error();
  return Response.error();
 })));
});
