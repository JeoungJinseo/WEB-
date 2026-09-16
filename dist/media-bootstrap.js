/* Prefer native streaming. A byte-identical Blob supports browsers that block workers. */
(async()=>{
  const base=new URL('./',document.currentScript.src),slots=new WeakMap();
  const release=video=>{const old=slots.get(video);if(!old)return;old.cancelled=true;old.abort?.abort();if(old.blob)URL.revokeObjectURL(old.url);slots.delete(video);};
  try{
    const mapResponse=await fetch(new URL('media-map.json?v=14',base));
    if(!mapResponse.ok)throw Error('Media map unavailable');
    const map=await mapResponse.json();
    let workerReady=false;
    if('serviceWorker' in navigator){
      const connect=(async()=>{
        await navigator.serviceWorker.register(new URL('media-sw.js?v=14',base),{scope:base.pathname,updateViaCache:'none'});
        await navigator.serviceWorker.ready;
        if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
        workerReady=true;
      })().catch(()=>{});
      let timer;await Promise.race([connect,new Promise(resolve=>timer=setTimeout(resolve,3000))]);clearTimeout(timer);
    }
    window.saunaMedia={release,async resolve(video,value){
      const url=new URL(value,base),key=url.pathname.slice(base.pathname.length),entry=map[key];
      if(!entry)return url.href;
      const existing=slots.get(video);if(existing?.key===url.href)return existing.promise;
      release(video);
      if(workerReady&&navigator.serviceWorker.controller)return url.href;
      const record={key:url.href,abort:new AbortController(),cancelled:false};slots.set(video,record);
      record.promise=(async()=>{
        const pieces=[];
        // Bound concurrent downloads and keep each decoded frame untouched.
        for(let i=0;i<entry.parts.length;i+=2){
          pieces.push(...await Promise.all(entry.parts.slice(i,i+2).map(async part=>{
            const partURL=new URL(typeof part==='string'?part:part.path,base);partURL.searchParams.set('v',entry.sha256.slice(0,16));
            const r=await fetch(partURL,{signal:record.abort.signal});if(!r.ok)throw Error('Video segment unavailable');
            const blob=await r.blob();
            if(typeof part==='string')return blob;
            if(blob.size<part.offset+part.length)throw Error('Incomplete video segment');
            return blob.slice(part.offset,part.offset+part.length);
          })));
        }
        if(record.cancelled)throw new DOMException('Cancelled','AbortError');
        const blob=new Blob(pieces,{type:'video/mp4'});if(blob.size!==entry.size)throw Error('Incomplete video');
        record.url=URL.createObjectURL(blob);record.blob=true;return record.url;
      })().catch(error=>{if(slots.get(video)===record)release(video);throw error;});
      return record.promise;
    }};
    const app=document.createElement('script');app.src=new URL('app-v12.js?v=16',base);document.body.append(app);
  }catch(error){
    const status=document.getElementById('load-status');status.textContent='영상을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.';status.classList.remove('is-done');
    const retry=document.getElementById('retry-load');retry.hidden=false;retry.onclick=()=>location.reload();
  }
})();
