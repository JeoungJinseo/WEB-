import {filmLayout} from './film-layout.ts';
/** Native video playback between fixed scene stops. One gesture advances one
 * scene; the original decoder and media remain continuous across the handoff. */
export const LAST_FRAME = 343 / 24;
export const INTRO_END = 104 / 24;
export const SCENE_STOPS = [INTRO_END, 8.7, 14.2] as const;
export const TRANSITION_DURATION = 2.5;
export const clamp = (n:number, low=0, high=1) => Math.min(high,Math.max(low,n));
export function sceneAtTime(t:number) {return t<3.9 ? 'intro' : t<6.8 ? 'back' : t<11.6 ? 'profile' : 'front';}
export type Scene = ReturnType<typeof sceneAtTime>;
export type FilmMode = 'intro' | 'transition' | 'blocked' | 'idle';
type Options={root:HTMLElement;video:HTMLVideoElement;onScene:(scene:Scene)=>void;onMode:(mode:FilmMode)=>void;onReady:()=>void;onError:()=>void;onFrame:(time:number)=>void};
export function mountScrollFilm({root,video,onScene,onMode,onReady,onError,onFrame}:Options) {
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const controller=new AbortController();
  let raf=0,ready=false,disposed=false,blobUrl='',lastScene:Scene='intro';
  let reduced=reduce.matches,mode:FilmMode='intro',blockedMode:'intro'|'transition'='intro';
  let stopIndex=0,targetIndex=0,target:number=INTRO_END,direction=1,playRequest=0;
  let reverseStart=0,reverseFrom=0,inputAfter=0,lastWheel=0,wheelDistance=0,wheelTriggered=false;
  let touchY:number|null=null,touchX=0;
  const setMode=(next:FilmMode)=>{mode=next;root.dataset.mode=next;onMode(next)};
  const setScene=(t:number)=>{const s=sceneAtTime(t);if(lastScene!==s){lastScene=s;onScene(s)}};
  const active=()=>mode==='intro'||mode==='transition';
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
    root.style.setProperty('--intro-fade',String(1-clamp((t-3.8)/.25)));
    setScene(t);onFrame(t);
  }
  function layout(){root.style.height=`${innerHeight}px`;scrollTo({top:0,behavior:'instant'});paint(ready?video.currentTime:mode==='idle'?target:0)}
  function finish(){
    if(disposed||!active())return;
    video.pause();playRequest++;stopIndex=targetIndex;
    if(ready&&Math.abs(video.currentTime-target)>.001)video.currentTime=target;
    setMode('idle');paint(target);wheelDistance=0;inputAfter=performance.now()+350;
  }
  function tick(now:number){
    raf=0;if(!active()||disposed)return;
    if(direction>0){
      if(video.currentTime>=target){finish();return}
      if(video.readyState>=2)paint(video.currentTime);
    }else{
      if(!reverseStart)reverseStart=now;
      const progress=clamp((now-reverseStart)/(TRANSITION_DURATION*1000));
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
    video.playbackRate=next==='intro'?1:Math.max(.0625,(target-video.currentTime)/TRANSITION_DURATION);
    const request=++playRequest;blockedMode=next;direction=1;setMode(next);wake();
    try{await video.play()}
    catch{if(!disposed&&request===playRequest){setMode('blocked')}}
  }
  function goTo(time:number){
    if(disposed||mode!=='idle')return;
    const index=SCENE_STOPS.reduce((best,value,i)=>Math.abs(value-time)<Math.abs(SCENE_STOPS[best]-time)?i:best,0);
    if(index===stopIndex)return;
    targetIndex=index;target=SCENE_STOPS[index];
    if(reduced){stopIndex=index;paint(target);return}
    if(target>video.currentTime){void playForward('transition')}
    else{video.pause();playRequest++;direction=-1;reverseStart=0;reverseFrom=video.currentTime;setMode('transition');wake()}
  }
  function step(direction:number){
    if(mode!=='idle')return;
    const next=clamp(stopIndex+direction,0,SCENE_STOPS.length-1);
    goTo(SCENE_STOPS[next]);
  }
  function replayIntro(){
    if(disposed)return;
    if(reduced){targetIndex=stopIndex=0;target=INTRO_END;paint(target);return}
    video.pause();playRequest++;targetIndex=0;target=INTRO_END;direction=1;
    root.dataset.painted='false';paint(0);setMode('intro');
    if(ready){video.currentTime=0;void playForward('intro')}
  }
  function resume(){if(mode==='blocked')void playForward(blockedMode)}
  function seeked(){if(disposed)return;root.dataset.painted='true';paint(video.currentTime);wake()}
  function data(){if(!disposed){root.dataset.painted='true';paint(video.currentTime)}}
  function timeupdate(){if(active()&&direction>0&&video.currentTime>=target)finish()}
  function fail(){
    if(disposed)return;video.pause();playRequest++;ready=false;reduced=true;
    root.dataset.fallback='true';targetIndex=stopIndex=0;target=INTRO_END;
    setMode('idle');onError();paint(target);
  }
  async function load(){
    try{
      const response=await fetch('./assets/hero-scrub-4k.mp4',{signal:controller.signal});
      if(!response.ok)throw new Error('film unavailable');
      const blob=await response.blob();if(disposed)return;
      blobUrl=URL.createObjectURL(blob);video.src=blobUrl;video.load();
    }catch{if(!disposed&&!controller.signal.aborted)fail()}
  }
  function metadata(){if(disposed)return;ready=true;onReady();void playForward('intro')}
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
  return {goTo,next:()=>step(1),replayIntro,resume,dispose:()=>{
    disposed=true;playRequest++;controller.abort();cancelAnimationFrame(raf);video.pause();
    video.removeEventListener('loadedmetadata',metadata);video.removeEventListener('loadeddata',data);
    video.removeEventListener('seeked',seeked);video.removeEventListener('error',fail);video.removeEventListener('timeupdate',timeupdate);
    video.removeAttribute('src');video.load();if(blobUrl)URL.revokeObjectURL(blobUrl);
    removeEventListener('wheel',wheel);removeEventListener('resize',layout);removeEventListener('orientationchange',layout);removeEventListener('keydown',keydown);
    removeEventListener('touchstart',touchstart);removeEventListener('touchmove',touchmove);removeEventListener('touchend',touchend);removeEventListener('touchcancel',touchcancel);
    reduce.removeEventListener('change',preference);
  }};
}
