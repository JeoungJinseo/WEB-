const TRAVEL_SECONDS = 3.77;
const SETTLING_SECONDS = .22;
const DEPARTURE_SECONDS = .28;
const TRANSITION_SECONDS = TRAVEL_SECONDS + SETTLING_SECONDS + DEPARTURE_SECONDS + .02;



class NativeFilm {
  constructor({root,onScene,onMode,onStatus,onFrame,startScene=0}) {
    Object.assign(this, {root,onScene,onMode,onStatus,onFrame,index:startScene,mode:'loading',
      ready:false,active:-1,epoch:0,route:null,disposed:false,pendingInput:0,acceptedGestures:0,
      frames:0,stats:[],listeners:[],wheelAt:0,wheelUsed:false});
    this.qualityPreference = new URLSearchParams(location.search).get('quality') || 'auto';
    this.qualityMode = '4320×3072';
    this.progressBar=root.querySelector('.film-progress span');
    this.mq = matchMedia('(prefers-reduced-motion: reduce)'); this.reduced = this.mq.matches;
    this.slots = [...document.querySelectorAll('.film-media')];
    this.posters = [...document.querySelectorAll('.poster')];
    this.slots.forEach(v => {
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.disablePictureInPicture = true;
      this.listen(v,'waiting',()=>{if(v===this.slots[this.active]&&this.route&&!this.route.pausedAt)this.route.waitingEvents++;});
      this.listen(v, 'ended', () => { if (v === this.slots[this.active]) this.arrive(); });
      this.listen(v, 'timeupdate', () => {
        if (!v.requestVideoFrameCallback && v === this.slots[this.active] && this.route && v.currentTime >= this.route.end-.006) this.arrive();
      });
    });
    this.listen(window,'resize',()=>this.layout(),{passive:true});
    this.listen(window,'wheel',e=>this.wheel(e),{passive:false});
    this.listen(window,'keydown',e=>this.key(e));
    this.listen(window,'touchstart',e=>this.touchStart(e),{passive:true});
    this.listen(window,'touchmove',e=>this.touchMove(e),{passive:false});
    this.listen(window,'touchend',e=>this.touchEnd(e));
    this.listen(window,'touchcancel',()=>this.touch=null);
    this.listen(document,'visibilitychange',()=>{if(document.hidden)this.pause();else this.resume();});
    this.listen(this.mq,'change',()=>{
      this.reduced=this.mq.matches;
      if(this.reduced&&this.route){this.finalDestination=this.route.to;this.stopWatch();this.slots.forEach(v=>v.pause());this.route=null;this.epoch++;this.index=this.finalDestination;this.root.classList.remove('has-frame');}
      this.root.dataset.reducedMotion=String(this.reduced);this.load();
    });
    this.listen(window,'pagehide',e=>{if(!e.persisted)this.destroy();});
    this.layout();this.onScene(this.index);this.load();
  }
  listen(el,event,fn,options){el.addEventListener(event,fn,options);this.listeners.push(()=>el.removeEventListener(event,fn,options));}
  viewport(){return [this.root.clientWidth||innerWidth,this.root.clientHeight||innerHeight];}
  layout(){const [w,h]=this.viewport(),s=w<h?Math.max(.62,Math.min(w/1440,h/1024)):Math.min(w/1440,h/1024);this.root.style.setProperty('--ui-scale',s);this.root.style.setProperty('--ui-width',`${w/s}px`);this.root.style.setProperty('--ui-height',`${h/s}px`);}
  setMode(mode){this.mode=mode;this.root.dataset.mode=mode;if(mode!=='transition')delete this.root.dataset.motionPhase;this.onMode(mode);}
  releasePosters(keep){
    this.posters.forEach((p,i)=>{
      if(i===keep||!p.getAttribute)return;
      const src=p.getAttribute('src');
      if(src){p.dataset.src=src;p.removeAttribute('src');}
    });
    this.root.dataset.posterImagesLoaded=String(this.posters.filter(p=>p.getAttribute?.('src')).length);
  }
  async showPoster(index){
    const token=++this.epoch;this.setMode('preparing');
    try{
      await saunaImageReady(this.posters[index]);await this.prepareScene?.(index);
      if(this.disposed||token!==this.epoch)return false;
      this.index=index;this.onScene(index);this.releasePosters(index);this.setMode('idle');
      this.onStatus('ready','');this.update();this.prefetch();return true;
    }catch(error){if(token===this.epoch&&!this.disposed)this.fail(error);return false;}
  }
  async load(){
    this.stopWatch();clearTimeout(this.prefetchTimer);this.route=null;this.slots.forEach(v=>v.pause());
    const token=++this.epoch;this.releasePosters(this.index);this.setMode('loading');this.onStatus('loading','');
    try{
      const [manifest]=await Promise.all([fetch('assets/video/refined-v11/manifest.json?v=1').then(r=>{if(!r.ok)throw Error('영상 정보를 불러올 수 없습니다.');return r.json();}),saunaImageReady(this.posters[this.index])]);
      this.manifest=manifest;if(this.disposed||token!==this.epoch)return;
      this.ready=true;this.releasePosters(this.index);this.setMode('idle');this.onScene(this.index);this.onStatus('ready','');this.update();this.prefetch();
      if(this.pendingInput){const d=this.pendingInput;this.pendingInput=0;this.next(d);}
    }catch(e){if(token===this.epoch&&!this.disposed)this.fail(e);}
  }
  candidates(from,to){
    const [width,height]=this.viewport();
    const forward=to>from,direction=forward?'forward':'reverse',aspect=width/height;
    const anchors=forward?this.manifest.anchors:this.manifest.reverseAnchors;
    const segment=forward?from:2-from;const [start,end]=[anchors[segment],anchors[segment+1]];
    const variant=aspect<=9/16?'portrait':aspect>=16/9?'landscape':'balanced';
    const crop=variant==='portrait'?[.3,0,.4,1]:variant==='landscape'?[0,244/3072,1,2430/3072]:[0,0,1,1];
    const dimensions={portrait:'1728×3072 native crop',landscape:'3840×2160',balanced:'3240×2304'};
    const displaySizes={portrait:[1080,1920],landscape:[2560,1440],balanced:[2160,1536]};
    const [dw,dh]=displaySizes[variant],dpr=devicePixelRatio||1;
    const displayFit=this.qualityPreference==='auto'&&width*dpr<=dw&&height*dpr<=dh;
    const arrivalClip=to===1?'-to-interaction':'';
    const nativePortrait=variant==='portrait'&&!displayFit;
    const fallbackVariant=nativePortrait?'balanced':variant;
    const suffix=displayFit?'-display':'',resolution=displayFit?`${dw}×${dh}`:dimensions[fallbackVariant];
    const choices=[{key:direction,url:`assets/video/door-v9/${direction}${arrivalClip}-${fallbackVariant}${suffix}.mp4?v=3`,
      start,end,crop:nativePortrait?[0,0,1,1]:crop,quality:`${resolution} / 30 fps original / H.264`}];
    if((this.qualityPreference==='ultra'||nativePortrait)&&!this.hevcUnsupported)choices.unshift({key:direction,
      url:`assets/video/door-v9/${direction}${arrivalClip}-4320-hevc.mp4?v=3`,start,end,crop:[0,0,1,1],quality:'4320×3072 / 30 fps original / HEVC'});
    return choices;
  }
  prefetch(){
    if(this.reduced||this.disposed||!this.manifest||this.mode!=='idle')return;
    // Warm the SAME two decoder surfaces used on screen. Detached prefetch
    // videos created extra high-resolution decoder instances and memory pressure.
    this.warming ||= new Map();
    // Keep one likely next decoder warm, rather than retaining two 4K decoder
    // queues alongside the captured idle texture on memory-limited machines.
    [this.index===2?1:this.index+1].forEach(i=>{
      const choice=this.candidates(this.index,i)[0],slot=i>this.index?0:1;
      const v=this.slots[slot],previous=this.warming.get(slot);
      const otherSlot=1-slot,other=this.slots[otherSlot],otherEntry=this.warming.get(otherSlot);
      if((!otherEntry||otherEntry.done)&&other?.getAttribute('src')){
        other.pause();globalThis.saunaMedia?.release(other);other.removeAttribute('src');other.load();this.warming.delete(otherSlot);
      }
      const entry={choice,done:false};
      const promise=(previous?.promise||Promise.resolve()).catch(()=>{}).then(()=>{
        if(this.disposed||this.mode!=='idle')return;
        return this.prepare(v,choice);
      }).catch(()=>{}).finally(()=>entry.done=true);
      entry.promise=promise;this.warming.set(slot,entry);
    });
  }
  event(v,event,action){return new Promise((resolve,reject)=>{
    const done=e=>{clearTimeout(timer);v.removeEventListener(event,ok);v.removeEventListener('error',bad);e?reject(e):resolve();};
    const ok=()=>done(),bad=()=>done(Error('영상 디코딩에 실패했습니다.'));
    const timer=setTimeout(()=>done(Error('영상 준비가 지연됩니다. 다시 눌러 주세요.')),15000);
    v.addEventListener(event,ok,{once:true});v.addEventListener('error',bad,{once:true});
    try{action();}catch(e){done(e);}
  });}
  buffered(v,end){return new Promise((resolve,reject)=>{
    const check=()=>{
      for(let i=0;i<v.buffered.length;i++)if(v.buffered.start(i)<=v.currentTime+.04&&v.buffered.end(i)>=end-.025){done();return;}
    };
    const done=error=>{clearTimeout(timeout);clearInterval(poll);v.removeEventListener('progress',check);error?reject(error):resolve();};
    const timeout=setTimeout(()=>done(Error('고화질 영상을 준비하고 있습니다. 다시 눌러 주세요.')),20000);
    const poll=setInterval(check,100);v.addEventListener('progress',check);check();
  });}
  async prepare(v,choice){
    const originalURL=new URL(choice.url,location.href).href;
    const url=globalThis.saunaMedia?await globalThis.saunaMedia.resolve(v,originalURL):originalURL;
    v.pause();v.classList.remove('is-visible');v.loop=false;
    if(v.src!==url)await this.event(v,'loadeddata',()=>{v.src=url;v.load();});
    // Seek inside the held picture, not on a rounded fractional frame edge.
    const heldTime=choice.start+.002;
    if(Math.abs(v.currentTime-heldTime)>.00001)await this.event(v,'seeked',()=>{v.currentTime=heldTime;});
    await this.buffered(v,choice.end);
    v.playbackRate=1;
    v.dataset.key=choice.key;return v;
  }
  async goTo(index){
    index=Math.max(0,Math.min(2,Math.round(index)));
    if(this.disposed||this.mode!=='idle'||index===this.index)return false;
    clearTimeout(this.prefetchTimer);
    this.finalDestination=index;
    if(this.reduced)return this.showPoster(index);
    const from=this.index,to=from+Math.sign(index-from),token=++this.epoch;
    const requestedAt=performance.now(),slot=to>from?0:1,v=this.slots[slot];this.setMode('preparing');
    const statusTimer=setTimeout(()=>{if(token===this.epoch&&this.mode==='preparing')this.onStatus('preparing','다음 장면을 준비하고 있습니다');},250);
    try{
      await Promise.all([...(this.warming?.values()||[])].map(entry=>entry.promise));
      await saunaImageReady(this.posters[to]);
      await this.prepareScene?.(to);
      let choice,lastError;
      for(const candidate of this.candidates(from,to)){
        try{await this.prepare(v,candidate);choice=candidate;break;}catch(e){lastError=e;if(candidate.url.includes("hevc")&&v.error?.code===4)this.hevcUnsupported=true;}
      }
      if(!choice)throw lastError;
      if(this.disposed||token!==this.epoch)return false;
      this.slots.forEach(other=>{if(other!==v){other.pause();other.classList.remove('is-visible');}});
      this.active=slot;this.qualityMode=choice.quality;
      // Retain the resting texture until departure; no synchronous 4K upload here.
      this.root.dataset.mediaSource=choice.url;
      this.route={from,to,start:choice.start,end:choice.end,crop:choice.crop,quality:choice.quality,announced:false,
        started:performance.now(),prepareMs:performance.now()-requestedAt,pausedMs:0,frameTimes:[],presentedGaps:[],displayGaps:[],mediaSteps:[],gapBuckets:[],dropEvents:[],missedCallbacks:0,lateCallbacks:0,waitingEvents:0,baseQuality:v.getVideoPlaybackQuality?.()};
      this.onStatus('ready','');this.onScene(-1);this.setMode('transition');
      this.root.classList.add('has-frame');v.classList.add('is-visible');
      // Hand the identical held frame to the native compositor BEFORE movement.
      // Overlapping two 4K surfaces while decoding caused departure-frame drops.
      this.route.departing=true;
      while(this.routeSeconds()<DEPARTURE_SECONDS+.02){
        await new Promise(resolve=>setTimeout(resolve,32));
        if(this.disposed||token!==this.epoch||!this.route)return false;
      }
      // The outgoing text must leave the compositor before native motion.
      // Its former 600 ms exit overlapped the shortened 280 ms handoff.
      this.root.dataset.motionPhase='playing';
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(this.disposed||token!==this.epoch||!this.route)return false;
      this.route.departing=false;
      if(this.route.pausedAt)return true;
      this.route.playQuality=v.getVideoPlaybackQuality?.();
      await v.play();
      if(this.disposed||token!==this.epoch||!this.route)return false;
      this.arm();
      if(document.hidden||document.querySelector('dialog[open]'))this.pause();
      return true;
    }catch(e){if(token===this.epoch&&!this.disposed)this.fail(e);return false;}finally{clearTimeout(statusTimer);}
  }
  arm(){
    if(!this.route||this.disposed)return;
    this.stopWatch();
    if(this.route.arrivedAt)this.settleTimer=setTimeout(()=>this.finish(),Math.max(0,(SETTLING_SECONDS-this.settleSeconds())*1000));
    // A decoder stall must not skip to the destination because a wall timer expired.
    this.endTimer=setTimeout(()=>this.fail(Error('영상 재생이 지연됩니다. 다시 시도해 주세요.')),20000);
    const v=this.slots[this.active];
    if(v.requestVideoFrameCallback&&!this.route.arrivedAt){
      const presented=(now,metadata)=>{
        const r=this.route;if(!r||r.pausedAt||r.arrivedAt||r.capturing)return;
        if(r.lastPresentedAt)r.presentedGaps.push(now-r.lastPresentedAt);r.lastPresentedAt=now;
        if(r.lastExpectedDisplay!==undefined)r.displayGaps.push(metadata.expectedDisplayTime-r.lastExpectedDisplay);
        if(r.presentedMediaTime!==undefined){
          const step=metadata.mediaTime-r.presentedMediaTime;r.mediaSteps.push(step);
          if(step>1.5/this.manifest.fps){const bucket=Math.floor(metadata.mediaTime-r.start);r.gapBuckets[bucket]=(r.gapBuckets[bucket]||0)+1;}
        }
        if(new URLSearchParams(location.search).get('verify')==='timing'){
          const dropped=v.getVideoPlaybackQuality?.().droppedVideoFrames||0;
          if(dropped>(r.lastDropCount??r.baseQuality?.droppedVideoFrames??0))r.dropEvents.push({mediaTime:metadata.mediaTime,dropped});
          r.lastDropCount=dropped;
        }
        if(r.lastPresentedFrames!==undefined)r.missedCallbacks+=Math.max(0,metadata.presentedFrames-r.lastPresentedFrames-1);
        if(now-metadata.expectedDisplayTime>8)r.lateCallbacks++;
        r.lastPresentedFrames=metadata.presentedFrames;r.lastExpectedDisplay=metadata.expectedDisplayTime;
        r.presentedMediaTime=metadata.mediaTime;
        if(metadata.mediaTime>=r.end-.5/this.manifest.fps){
          // A frame callback announces a submitted picture. Let that picture
          // reach the display before pausing, instead of seeking it backwards.
          const delay=Math.max(0,metadata.expectedDisplayTime-performance.now()+1);
          this.arrivalTimer=setTimeout(()=>{if(this.route===r&&!r.pausedAt)this.arrive();},delay);
        }
        else this.videoFrameCallback=v.requestVideoFrameCallback(presented);
      };
      this.videoFrameCallback=v.requestVideoFrameCallback(presented);
    }
    let last=performance.now();
    const tick=now=>{
      const r=this.route;if(!r)return;
      r.frameTimes.push(now-last);last=now;
      this.frames++;
      if(!r.arrivedAt&&!this.slots[this.active].requestVideoFrameCallback&&this.slots[this.active].currentTime>=r.end-.006)this.arrive();
      this.update();
      if(this.route)this.frameRAF=requestAnimationFrame(tick);
    };
    this.frameRAF=requestAnimationFrame(tick);
  }
  stopWatch(){if(this.videoFrameCallback)this.slots[this.active]?.cancelVideoFrameCallback?.(this.videoFrameCallback);this.videoFrameCallback=0;clearTimeout(this.arrivalTimer);clearTimeout(this.endTimer);clearTimeout(this.settleTimer);cancelAnimationFrame(this.frameRAF);this.frameRAF=0;cancelAnimationFrame(this.handoffRAF);this.handoffRAF=0;}
  update(){
    let p=this.index/2;
    if(this.route){const r=this.route,v=this.slots[this.active];
      const progress=Math.max(0,Math.min(1,(v.currentTime-r.start)/(r.end-r.start)));
      p=(r.from+(r.to-r.from)*progress)/2;
      if(r.arrivedAt&&this.settleSeconds()>=SETTLING_SECONDS){this.finish();return;}
    }
    // A inherited property on <main> invalidated the entire scene every tick.
    // Only the progress bar's compositor transform changes during playback.
    if(this.progressBar)this.progressBar.style.transform=`scaleX(${p})`;
    this.onFrame?.(this.getState());
  }
  routeSeconds(){const r=this.route;return r?Math.max(0,((r.pausedAt||performance.now())-r.started-r.pausedMs)/1000):0;}
  settleSeconds(){const r=this.route;return r?.arrivedAt?Math.max(0,((r.pausedAt||performance.now())-r.arrivedAt-(r.pausedMs-r.arrivalPausedMs))/1000):0;}
  async arrive(){
    const r=this.route;if(!r||r.arrivedAt||r.capturing)return;
    r.capturing=true;const v=this.slots[this.active];r.playbackEndQuality=v.getVideoPlaybackQuality?.();v.pause();
    try{
      // Frame callbacks can arrive BEFORE that picture reaches the display.
      // Pin the exact anchor before capturing it for idle breathing.
      // Fractional frame boundaries are rounded by some media clocks. Seeking
      // 2 ms inside the target picture avoids capturing its predecessor.
      const frameDuration=1/(this.manifest?.fps||30);
      // Every route file physically ends at its held arrival picture. At EOF,
      // the decoder cannot present a picture from the following section.
      const terminalFrame=Math.abs(v.duration-(r.end+frameDuration))<.002;
      const heldAtEnd=terminalFrame&&v.currentTime>=r.end&&v.currentTime<=v.duration+.002;
      const onTarget=heldAtEnd||(v.currentTime>=r.end+.001&&v.currentTime<r.end+frameDuration-.001);
      r.terminalFrame=terminalFrame;
      r.arrivalSeek=!onTarget;
      if(!onTarget)await this.event(v,'seeked',()=>{v.currentTime=r.end+.002;});
      if(this.route!==r||this.disposed)return;
      const captureStart=performance.now();
      await this.captureFrame?.(v,r.to,r.crop);
      r.captureMs=performance.now()-captureStart;r.captureMediaTime=v.currentTime;
      if(this.route!==r||this.disposed)return;
    }catch(e){if(this.route===r)this.fail(e);return;}
    r.arrivedAt=r.pausedAt||performance.now();r.arrivalPausedMs=r.pausedMs;
    if(!r.announced){r.announced=true;this.onScene(r.to);}
    this.setMode('settling');
    this.settleTimer=setTimeout(()=>this.finish(),SETTLING_SECONDS*1000);
  }
  finish(){
    if(!this.route||this.disposed)return;
    const r=this.route;
    if(r.pausedAt)return;
    // Keep the movie until the resting surface has drawn at full opacity.
    // The wall timer may otherwise remove it one display tick too early.
    if(this.restingFrameReady&&!this.restingFrameReady()){
      if(!this.handoffRAF)this.handoffRAF=requestAnimationFrame(()=>{this.handoffRAF=0;if(this.route===r)this.finish();});
      return;
    }
    const v=this.slots[this.active],q=r.playbackEndQuality||v?.getVideoPlaybackQuality?.();
    const restingSurfaceReady=this.restingFrameReady?.()??true;
    this.stopWatch();v?.pause();this.route=null;
    this.stats.push({from:r.from,to:r.to,wallSeconds:(performance.now()-r.started-r.pausedMs)/1000,
      quality:r.quality,prepareMs:r.prepareMs,waitingEvents:r.waitingEvents,
      presentedGapP95Ms:r.presentedGaps.length?[...r.presentedGaps].sort((a,b)=>a-b)[Math.floor(r.presentedGaps.length*.95)]:0,
      presentedGapMaxMs:r.presentedGaps.length?Math.max(...r.presentedGaps):0,decodedFrames:(q?.totalVideoFrames||0)-(r.baseQuality?.totalVideoFrames||0),
      droppedFrames:(q?.droppedVideoFrames||0)-(r.baseQuality?.droppedVideoFrames||0),
      compositorGapP95Ms:r.displayGaps.length?[...r.displayGaps].sort((a,b)=>a-b)[Math.floor(r.displayGaps.length*.95)]:0,
      compositorGapMaxMs:r.displayGaps.length?Math.max(...r.displayGaps):0,
      mediaStepMaxSeconds:r.mediaSteps.length?Math.max(...r.mediaSteps):0,
      missedVideoCallbacks:r.missedCallbacks,lateVideoCallbacks:r.lateCallbacks,captureMs:r.captureMs,
      callbackGapBucketsByMediaSecond:r.gapBuckets,dropEvents:r.dropEvents,
      droppedBeforeMotion:(r.playQuality?.droppedVideoFrames||0)-(r.baseQuality?.droppedVideoFrames||0),
      mediaSeconds:v?.currentTime-r.start,presentedMediaTime:r.presentedMediaTime,anchor:r.end,captureMediaTime:r.captureMediaTime,arrivalSeek:r.arrivalSeek,terminalFrame:r.terminalFrame,restingPhotoFrames:r.restingPhotoFrames||0,restingSteamFrames:r.restingSteamFrames||0,restingSurfaceReady,decodedWidth:v?.videoWidth,decodedHeight:v?.videoHeight,
      rafFps:r.frameTimes.length?1000/(r.frameTimes.reduce((a,b)=>a+b,0)/r.frameTimes.length):0,
      rafFramesOver34ms:r.frameTimes.filter(t=>t>34).length,
      renderer:'native-video-compositor',liveVideoTextureUploads:0,continuousNativePlayback:true,sourceEdit:'original-pictures-with-condensed-holds-and-steam-occluded-camera-cut'});
    this.root.classList.remove('has-frame');this.slots.forEach(s=>s.classList.remove('is-visible'));
    this.root.dataset.lastTransitionMs=String(Math.round(this.stats.at(-1).wallSeconds*1000));
    this.root.dataset.transitionChecks=JSON.stringify(this.stats.slice(-8));
    this.index=r.to;this.onScene(this.index);this.releasePosters(this.index);this.setMode('idle');this.onStatus('ready','');this.update();
    this.prefetchTimer=setTimeout(()=>this.prefetch(),900);
    if(this.finalDestination!==this.index)this.nextTask=setTimeout(()=>this.goTo(this.finalDestination),0);
  }
  pause(){if(this.route&&!this.route.pausedAt){this.route.pausedAt=performance.now();this.slots[this.active]?.pause();this.stopWatch();}}
  async resume(){
    if(this.mode==='blocked'){this.setMode('idle');return this.goTo(this.finalDestination);}
    if(!this.route?.pausedAt||document.hidden||document.querySelector('dialog[open]'))return;
    const r=this.route;r.pausedMs+=performance.now()-r.pausedAt;r.pausedAt=0;r.lastPresentedAt=0;r.lastExpectedDisplay=undefined;r.lastPresentedFrames=undefined;
    if(r.departing)return;
    try{if(!r.arrivedAt&&!r.capturing)await this.slots[this.active].play();if(this.route===r)this.arm();}catch(e){if(this.route===r)this.fail(e);}
  }
  fail(error){
    this.stopWatch();this.route=null;this.root.classList.remove('has-frame');this.slots.forEach(v=>{v.pause();v.classList.remove('is-visible');});
    this.setMode(error?.name==='NotAllowedError'?'blocked':'idle');this.onScene(this.index);
    this.onStatus(error?.name==='NotAllowedError'?'ready':'error',error?.message||'영상을 불러오지 못했습니다.');
  }
  next(d=1){if(this.mode==='loading'){this.pendingInput=Math.sign(d);return true;}return this.goTo(this.index+Math.sign(d));}
  replay(){return this.goTo(0);}
  showScene(i){if(this.mode!=='idle')return;return this.showPoster(Math.max(0,Math.min(2,i)));}
  readingTarget(target){
    return this.root.dataset.readingOverflow==='true'&&!!target.closest?.('.scene-panel.is-active');
  }
  touchStart(e){
    this.touch=null;
    if(e.touches.length!==1||e.target.closest?.('dialog,a,button,input,textarea,select,[contenteditable]')||this.readingTarget(e.target))return;
    this.touch=[e.touches[0].clientX,e.touches[0].clientY];
  }
  touchMove(e){
    // A second finger starts a pinch, never a queued chapter swipe.
    if(e.touches.length!==1){this.touch=null;return;}
    if(this.touch&&e.cancelable!==false)e.preventDefault();
  }
  touchEnd(e){
    if(!this.touch)return;
    const start=this.touch;this.touch=null;
    if(e.touches?.length||!e.changedTouches.length)return;
    const t=e.changedTouches[0],dx=start[0]-t.clientX,dy=start[1]-t.clientY;
    if(Math.abs(dy)>=36&&Math.abs(dy)>Math.abs(dx)*1.2)this.next(Math.sign(dy));
  }
  wheel(e){
    if(e.ctrlKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)||e.target.closest?.('dialog')||this.readingTarget(e.target))return;
    const d=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);if(Math.abs(d)<.75)return;
    e.preventDefault();const now=performance.now();
    if(now-this.wheelAt>180||(this.wheelDirection&&Math.sign(d)!==this.wheelDirection))this.wheelUsed=false;
    this.wheelAt=now;this.wheelDirection=Math.sign(d);
    if(this.wheelUsed)return;this.wheelUsed=true;
    if(['transition','preparing','settling'].includes(this.mode))return;
    this.acceptedGestures++;this.next(Math.sign(d));
  }
  key(e){
    if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest?.('dialog,input,textarea,select,[contenteditable]')||this.readingTarget(e.target))return;
    if(e.key===' '&&e.target.closest?.('button,a'))return;
    const d=['ArrowDown','PageDown',' '].includes(e.key)?1:['ArrowUp','PageUp'].includes(e.key)?-1:0;
    if(d){e.preventDefault();if(!e.repeat)this.next(e.shiftKey?-d:d);}
    else if(/^[123]$/.test(e.key))this.goTo(Number(e.key)-1);else if(e.key==='Home')this.goTo(0);else if(e.key==='End')this.goTo(2);
  }
  getState(){const v=this.slots[this.active];return {targetTransitionSeconds:TRANSITION_SECONDS,travelSeconds:TRAVEL_SECONDS,qualityMode:this.qualityMode,
    idleImageSize:'4320×3072',mode:this.mode,scene:this.index,ready:this.ready,reduced:this.reduced,
    decodedWidth:v?.videoWidth||0,decodedHeight:v?.videoHeight||0,acceptedGestures:this.acceptedGestures,
    frames:this.frames,route:this.route?{from:this.route.from,to:this.route.to}:null,stats:this.stats};}
  destroy(){this.disposed=true;this.epoch++;this.stopWatch();clearTimeout(this.nextTask);clearTimeout(this.prefetchTimer);this.listeners.forEach(f=>f());
    this.slots.forEach(v=>{v.pause();globalThis.saunaMedia?.release(v);v.removeAttribute('src');v.load();});this.warming?.clear();}
}
