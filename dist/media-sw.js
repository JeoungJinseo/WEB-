importScripts('./media-range.js?v=14');
const base=new URL('./',self.location.href);
let manifest;
const getManifest=()=>manifest||=(fetch(new URL('media-map.json?v=14',base)).then(r=>{if(!r.ok)throw Error('Missing media map');return r.json();}).catch(e=>{manifest=null;throw e;}));
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(url.origin!==base.origin||!['GET','HEAD'].includes(request.method)||!url.pathname.startsWith(base.pathname))return;
  const key=url.pathname.slice(base.pathname.length);
  if(!key.startsWith('assets/video/door-v9/')||!key.endsWith('.mp4'))return;
  event.respondWith(getManifest().then(map=>{
    const entry=map[key];if(!entry)return new Response('Not found',{status:404});
    return SaunaRange.response(request,entry,(index,start,end,signal)=>{
      const item=entry.parts[index];
      const part=new URL(typeof item==='string'?item:item.path,base);part.searchParams.set('v',entry.sha256.slice(0,16));
      return fetch(part,{headers:{Range:`bytes=${start}-${end}`},signal});
    });
  }));
});
