import {filmLayout} from './film-layout.ts';
/** Native video playback between fixed scene stops. One gesture advances one
 * scene; the original decoder and media remain continuous across the handoff. */
export const LAST_FRAME = 343 / 24;
export const INTRO_END = 104 / 24;
export const SCENE_STOPS = [INTRO_END, 208 / 24, 340 / 24] as const;
export const TRANSITION_DURATION = 2.5;
export const SETTLE_DURATION = .48;
export const HANDOFF_LEAD=.12;
const PLAYBACK_DURATION=TRANSITION_DURATION-SETTLE_DURATION+HANDOFF_LEAD;
export const clamp = (n:number, low=0, high=1) => Math.min(high,Math.max(low,n));
export function sceneAtTime(t:number) {return t<3.9 ? 'intro' : t<6.8 ? 'back' : t<11.6 ? 'profile' : 'front';}
export type Scene = ReturnType<typeof sceneAtTime>;
export type FilmMode = 'intro' | 'transition' | 'settling' | 'blocked' | 'idle';
type Options={root:HTMLElement;video:HTMLVideoElement;onScene:(scene:Scene)=>void;onMode:(mode:FilmMode)=>void;onReady:()=>void;onError:()=>void;onFrame:(time:number)=>void;onHandoff?:(time:number,progress:number)=>void};
export function mountScrollFilm({root,video,onScene,onMode,onReady,onError,onFrame,onHandoff}:Options) {
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let controller:AbortController|null=null;
  let loadAttempt=0,loadToken=0,loadTimer:ReturnType<typeof setTimeout>|undefined;
  const sources=[
    {url:'./assets/hero-scrub-4k.mp4?v=bt709-2',blob:false},
    {url:'./assets/hero-scrub-4k.mp4?v=bt709-2',blob:true},
    {url:'./assets/hero-compatible.mp4?v=1',blob:false},
    {url:'./assets/hero-compatible.mp4?v=1',blob:true},
  ];
  const nativeFrames=typeof video.requestVideoFrameCallback==='function';
  let videoFrame=0,settleStart=0,handoffStart:number|null=null;
  let raf=0,ready=false,disposed=false,blobUrl='',lastScene:Scene='intro';
  let reduced=reduce.matches,mode:FilmMode='intro',blockedMode:'intro'|'transition'='intro';
  let stopIndex=0,targetIndex=0,target:number=INTRO_END,direction=1,playRequest=0;
  let reverseStart=0,reverseFrom=0,inputAfter=0,lastWheel=0,wheelDistance=0,wheelTriggered=false;
  let touchY:number|null=null,touchX=0;
  const setMode=(next:FilmMode)=>{mode=next;root.dataset.mode=next;onMode(next)};
  const setScene=(t:number)=>{const s=sceneAtTime(t);if(lastScene!==s){lastScene=s;onScene(s)}};
  const playing=()=>mode==='intro'||mode==='transition';
  const active=()=>playing()||mode==='settling';
  function cancelFrame(){if(videoFrame){video.cancelVideoFrameCallback(videoFrame);videoFrame=0}}
  function watchFrame(){if(nativeFrames&&!videoFrame&&!disposed&&playing()&&direction>0)videoFrame=video.requestVideoFrameCallback(presented)}
  function presented(_now:number,frame:VideoFrameCallbackMetadata){
    videoFrame=0;if(disposed||!playing()||direction<0)return;
    if(frame.mediaTime>=target-1e-6){finish(frame.mediaTime);return}
    paint(frame.mediaTime);watchFrame();
  }
  function paint(t:number) {
    root.dataset.time=t.toFixed(3);
    root.style.setProperty('--progress',String(clamp((t-INTRO_END)/(SCENE_STOPS[2]-INTRO_END))));
    const fit=filmLayout(innerWidth,innerHeight,t);
    root.style.setProperty('--film-width',`${fit.filmWidth}px`);
    root.style.setProperty('--film-top',`${fit.filmTop}px`);
    root.style.setProperty('--composition-width',`${fit.compositionWidth}px`);
    root.style.setProperty('--composition-height',`${fit.compositionHeight}px`);
    root.style.setProperty('--composition-top',`${fit.compositionTop}px`);
    root.style.setProperty('--composition-scale',String(fit.compositionScale));
    root.style.setProperty('--ui-width',`${fit.uiWidth}px`);
    root.style.setProperty('--ui-height',`${fit.uiHeight}px`);
    root.style.setProperty('--artwork-width',`${fit.artworkWidth}px`);
    root.style.setProperty('--artwork-height',`${fit.artworkHeight}px`);
    root.style.setProperty('--intro-fade',String(1-clamp((t-3.8)/.25)));
    if(playing()&&ready){
      const rate=direction>0?video.playbackRate:Math.abs(reverseFrom-target)/PLAYBACK_DURATION;
      const remaining=Math.abs(t-target)/Math.max(.0625,rate);
      if(remaining<=HANDOFF_LEAD){
        const elapsed=HANDOFF_LEAD-remaining;
        if(handoffStart===null)handoffStart=performance.now()-elapsed*1000;
        onHandoff?.(target,elapsed/SETTLE_DURATION);
      }
    }
    setScene(t);onFrame(t);
  }
  function layout(){root.style.height=`${innerHeight}px`;scrollTo({top:0,behavior:'instant'});paint(ready?video.currentTime:mode==='idle'?target:0)}
  function finish(displayedTime=video.currentTime){
    if(disposed||!playing())return;
    video.pause();cancelFrame();playRequest++;stopIndex=targetIndex;
    // Keep the frame that the decoder has actually presented. A tiny forced
    // seek here used to rewind/redecode at every stop and visibly hitch.
    if(ready&&Math.abs(displayedTime-target)>1/24+.001)video.currentTime=target;
    settleStart=handoffStart??performance.now();setMode('settling');paint(target);
    wheelDistance=0;inputAfter=settleStart+350;wake();
  }
  function tick(now:number){
    raf=0;if(!active()||disposed)return;
    if(!ready){wake();return}
    if(mode==='settling'){
      if(now-settleStart>=SETTLE_DURATION*1000){setMode('idle');paint(target);return}
    }else if(direction>0){
      if(!nativeFrames){
        if(video.currentTime>=target){finish();return}
        if(video.readyState>=2)paint(video.currentTime);
      }
    }else{
      if(!reverseStart)reverseStart=now;
      const progress=clamp((now-reverseStart)/(PLAYBACK_DURATION*1000));
      const time=progress===1?target:reverseFrom+(target-reverseFrom)*progress;
      if(!video.seeking){
        if(time===target&&Math.abs(video.currentTime-target)<1/48){finish();return}
        if(Math.abs(video.currentTime-time)>1/48)video.currentTime=time;
      }
    }
    wake();
  }
  function wake(){if(!raf&&!disposed&&active())raf=requestAnimationFrame(tick)}
  async function playForward(next:'intro'|'transition'){
    if(disposed||!ready||reduced)return;
    // Every scene change has the same duration, regardless of clip length.
    // Keep the opening logo sequence at its original speed, including replays.
    video.playbackRate=next==='intro'?1:Math.max(.0625,(target-video.currentTime)/PLAYBACK_DURATION);
    const request=++playRequest;blockedMode=next;direction=1;handoffStart=null;setMode(next);wake();watchFrame();
    try{await video.play()}
    catch{if(!disposed&&request===playRequest){cancelFrame();setMode('blocked')}}
  }
  function goTo(time:number){
    if(disposed||mode!=='idle')return;
    const index=SCENE_STOPS.reduce((best,value,i)=>Math.abs(value-time)<Math.abs(SCENE_STOPS[best]-time)?i:best,0);
    if(index===stopIndex)return;
    targetIndex=index;target=SCENE_STOPS[index];
    if(reduced){stopIndex=index;paint(target);return}
    if(target>video.currentTime){void playForward('transition')}
    else{video.pause();cancelFrame();playRequest++;direction=-1;handoffStart=null;reverseStart=0;reverseFrom=video.currentTime;setMode('transition');wake()}
  }
  function step(direction:number){
    if(mode!=='idle')return;
    const next=clamp(stopIndex+direction,0,SCENE_STOPS.length-1);
    goTo(SCENE_STOPS[next]);
  }
  function replayIntro(){
    if(disposed)return;
    if(reduced){targetIndex=stopIndex=0;target=INTRO_END;paint(target);return}
    video.pause();cancelFrame();playRequest++;targetIndex=0;target=INTRO_END;direction=1;
    root.dataset.painted='false';paint(0);setMode('intro');
    if(ready){video.currentTime=0;void playForward('intro')}
  }
  function resume(){if(mode==='blocked')void playForward(blockedMode)}
  function seeked(){if(disposed)return;root.dataset.painted='true';paint(video.currentTime);wake()}
  function data(){if(!disposed){clearTimeout(loadTimer);root.dataset.painted='true';paint(video.currentTime)}}
  function timeupdate(){if(!nativeFrames&&playing()&&direction>0&&video.currentTime>=target)finish()}
  function fail(){
    if(disposed)return;
    clearTimeout(loadTimer);
    if(loadAttempt<sources.length){void load();return}
    controller?.abort();video.pause();cancelFrame();playRequest++;ready=false;reduced=true;
    root.dataset.fallback='true';root.dataset.atmosphere='false';targetIndex=stopIndex=0;target=INTRO_END;
    setMode('idle');onError();paint(target);
  }
  async function load(){
    const source=sources[loadAttempt++],token=++loadToken;
    clearTimeout(loadTimer);controller?.abort();controller=new AbortController();
    const signal=controller.signal;
    video.pause();cancelFrame();playRequest++;ready=false;
    targetIndex=stopIndex=0;target=INTRO_END;handoffStart=null;
    root.dataset.painted='false';root.dataset.atmosphere='false';
    root.dataset.mediaSource=source.blob?'buffered':'direct';
    root.dataset.mediaQuality=loadAttempt<=2?'4k':'1080p';
    setMode('intro');paint(0);
    if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=''}
    // Do not require a complete fetch + blob URL before playback. Native media
    // can start as soon as its first frame arrives and avoids blob restrictions.
    video.preload='auto';
    loadTimer=setTimeout(()=>{if(!disposed&&token===loadToken)fail()},20000);
    try{
      let url=source.url;
      if(source.blob){
        const response=await fetch(url,{signal,cache:'reload'});
        if(!response.ok)throw new Error('film unavailable');
        const blob=await response.blob();
        if(disposed||signal.aborted||token!==loadToken)return;
        if(!blob.size||blob.type.includes('text/')||blob.type.includes('json'))throw new Error('invalid media response');
        blobUrl=URL.createObjectURL(new Blob([blob],{type:'video/mp4'}));url=blobUrl;
      }
      if(disposed||signal.aborted||token!==loadToken)return;
      video.src=url;video.load();
    }catch{if(!disposed&&!signal.aborted&&token===loadToken)fail()}
  }
  function metadata(){if(disposed)return;ready=true;root.dataset.fallback='false';onReady();void playForward('intro')}
  function retry(){
    if(disposed||reduce.matches)return;
    reduced=false;loadAttempt=0;root.dataset.fallback='false';void load();
  }
  function wheel(event:WheelEvent){
    if(event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
    const content=event.target instanceof Element?event.target.closest<HTMLElement>('.content-frame'):null;
    if(content&&content.scrollHeight>content.clientHeight+2)return;
    event.preventDefault();const now=performance.now(),quiet=now-lastWheel>180;lastWheel=now;
    if(quiet){wheelDistance=0;wheelTriggered=false}
    if(mode!=='idle'||now<inputAfter){wheelDistance=0;wheelTriggered=true;return}
    if(wheelTriggered)return;
    if(Math.sign(wheelDistance)!==Math.sign(event.deltaY))wheelDistance=0;
    wheelDistance+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
    if(Math.abs(wheelDistance)>=32){wheelTriggered=true;step(Math.sign(wheelDistance));wheelDistance=0}
  }
  function touchstart(event:TouchEvent){
    const content=event.target instanceof Element?event.target.closest<HTMLElement>('.content-frame'):null;
    if(content&&content.scrollHeight>content.clientHeight+2){touchY=null;return}
    if(event.touches.length!==1){touchY=null;return}
    touchY=event.touches[0].clientY;touchX=event.touches[0].clientX;
  }
  function touchmove(event:TouchEvent){if(touchY!==null&&event.touches.length===1)event.preventDefault()}
  function touchend(event:TouchEvent){
    if(touchY===null)return;
    const touch=event.changedTouches[0],delta=touchY-touch.clientY;touchY=null;
    if(Math.abs(delta)<45||Math.abs(touch.clientX-touchX)>Math.abs(delta)||performance.now()<inputAfter)return;
    step(Math.sign(delta));
  }
  function touchcancel(){touchY=null}
  function keydown(event:KeyboardEvent){
    const element=event.target instanceof Element?event.target:null;
    if(event.altKey||event.ctrlKey||event.metaKey||element?.closest('input,textarea,select,[contenteditable=true]'))return;
    if(event.key===' '&&element?.closest('button,a'))return;
    if(!['ArrowDown','PageDown',' ','ArrowUp','PageUp','Home','End'].includes(event.key))return;
    event.preventDefault();if(event.repeat)return;
    if(event.key==='Home')goTo(INTRO_END);
    else if(event.key==='End')goTo(SCENE_STOPS[2]);
    else step(['ArrowUp','PageUp'].includes(event.key)||event.key===' '&&event.shiftKey?-1:1);
  }
  function preference(){location.reload()}
  video.addEventListener('loadedmetadata',metadata);video.addEventListener('loadeddata',data);
  video.addEventListener('seeked',seeked);video.addEventListener('error',fail);video.addEventListener('timeupdate',timeupdate);
  addEventListener('wheel',wheel,{passive:false});addEventListener('resize',layout);
  addEventListener('orientationchange',layout);addEventListener('keydown',keydown);
  addEventListener('touchstart',touchstart,{passive:true});addEventListener('touchmove',touchmove,{passive:false});
  addEventListener('touchend',touchend);addEventListener('touchcancel',touchcancel);
  reduce.addEventListener('change',preference);
  root.dataset.reduced=String(reduced);setMode(reduced?'idle':'intro');layout();
  if(reduced){onReady();paint(target)}else void load();
  return {goTo,next:()=>step(1),replayIntro,resume,retry,dispose:()=>{
    disposed=true;playRequest++;loadToken++;clearTimeout(loadTimer);controller?.abort();cancelAnimationFrame(raf);cancelFrame();video.pause();
    video.removeEventListener('loadedmetadata',metadata);video.removeEventListener('loadeddata',data);
    video.removeEventListener('seeked',seeked);video.removeEventListener('error',fail);video.removeEventListener('timeupdate',timeupdate);
    video.removeAttribute('src');video.load();if(blobUrl)URL.revokeObjectURL(blobUrl);
    removeEventListener('wheel',wheel);removeEventListener('resize',layout);removeEventListener('orientationchange',layout);removeEventListener('keydown',keydown);
    removeEventListener('touchstart',touchstart);removeEventListener('touchmove',touchmove);removeEventListener('touchend',touchend);removeEventListener('touchcancel',touchcancel);
    reduce.removeEventListener('change',preference);
  }};
}
