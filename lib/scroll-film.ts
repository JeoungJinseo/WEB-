/** Single-film adaptation of scroll-world: blob seeking, coalesced seeks,
 * frame-rate-independent easing, iOS priming and reduced-motion stills.
 * Media stays in one decoder, so section boundaries never restart the film. */
export const LAST_FRAME = 343 / 24;
export const STOPS = [
  [0, 0], [.18, 3.875], [.32, 4.333], [.48, 8.333],
  [.64, 9], [.84, 13.7], [1, LAST_FRAME],
] as const;
export const clamp = (n:number, low=0, high=1) => Math.min(high,Math.max(low,n));
export function timeAtProgress(progress:number) {
  const p=clamp(progress);
  for(let i=1;i<STOPS.length;i++) {
    const [end,time]=STOPS[i], [start,previous]=STOPS[i-1];
    if(p<=end) return previous+(time-previous)*(p-start)/(end-start);
  }
  return LAST_FRAME;
}
export function progressAtTime(time:number) {
  const t=clamp(time,0,LAST_FRAME);
  for(let i=1;i<STOPS.length;i++) {
    const [end,next]=STOPS[i], [start,previous]=STOPS[i-1];
    if(t<=next) return start+(end-start)*(t-previous)/(next-previous);
  }
  return 1;
}
export function sceneAtTime(t:number) {return t<3.9 ? 'intro' : t<6.8 ? 'back' : t<11.6 ? 'profile' : 'front';}
export type Scene = ReturnType<typeof sceneAtTime>;
type Options={root:HTMLElement;video:HTMLVideoElement;onScene:(scene:Scene)=>void;onReady:()=>void;onError:()=>void;onFrame:(time:number)=>void};
export function mountScrollFilm({root,video,onScene,onReady,onError,onFrame}:Options) {
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const coarse=matchMedia('(pointer:coarse)').matches;
  const controller=new AbortController();
  let raf=0,last=0,smoothed=0,target=0,vh=innerHeight,width=innerWidth;
  let ready=false,disposed=false,blobUrl='',lastScene:Scene='intro',primed=false;
  let reduced=reduce.matches;
  const setScene=(t:number)=>{const s=sceneAtTime(t);if(lastScene!==s){lastScene=s;onScene(s)}};
  function paint(t:number) {
    root.dataset.time=t.toFixed(3);
    const x=clamp((t-3.2)/.7), blend=x*x*(3-2*x);
    const introWidth=Math.min(innerWidth,innerHeight*16/9);
    const fullWidth=Math.max(innerWidth/(3036/3840),innerHeight*16/9);
    const renderWidth=introWidth+(fullWidth-introWidth)*blend;
    root.style.setProperty('--film-width',`${renderWidth}px`);
    root.style.setProperty('--film-top',`${(innerHeight-renderWidth*9/16)*.5*(1-blend)}px`);
    root.style.setProperty('--intro-fade',String(1-clamp((t-3.8)/.25)));
    setScene(t); onFrame(t);
  }
  function read(){target=timeAtProgress(clamp(scrollY/(vh*9)));root.style.setProperty('--progress',String(clamp(scrollY/(vh*9))));wake();}
  function layout(){const progress=scrollY/(vh*9);vh=innerHeight;width=innerWidth;root.style.height=`${vh*10}px`;if(progress>0)scrollTo({top:progress*vh*9,behavior:'instant'});read();paint(ready?video.currentTime:target)}
  function resize(){if(coarse&&innerWidth===width)return;layout()}
  function fail(){if(disposed)return;ready=false;reduced=true;root.dataset.fallback='true';onError();read()}
  function seek(){
    if(!ready||video.seeking||disposed)return;
    const t=clamp(smoothed,0,Math.min(LAST_FRAME,video.duration-1/24));
    if(Math.abs(video.currentTime-t)>1/48)video.currentTime=t;
  }
  function tick(now:number){
    raf=0;const dt=last?Math.min(64,now-last):16.67;last=now;
    smoothed+=(target-smoothed)*(1-Math.exp(-dt/95));
    if(Math.abs(target-smoothed)<.003)smoothed=target;
    if(reduced){paint(target);onReady()}else seek();
    if(Math.abs(target-smoothed)>.002||ready&&Math.abs(video.currentTime-target)>1/48)wake();else last=0;
  }
  function wake(){if(!raf&&!disposed)raf=requestAnimationFrame(tick)}
  function seeked(){if(disposed)return;root.dataset.painted='true';paint(video.currentTime);wake()}
  async function prime(){
    if(primed||!ready||!coarse)return;primed=true;
    try{await video.play();video.pause();seek()}catch{primed=false}
  }
  async function load(){
    try {
      const response=await fetch('/assets/hero-scrub-4k.mp4',{signal:controller.signal});
      if(!response.ok)throw new Error('film unavailable');
      const blob=await response.blob();if(disposed)return;
      blobUrl=URL.createObjectURL(blob);video.src=blobUrl;video.load();
    }catch{if(!disposed&&!controller.signal.aborted)fail()}
  }
  function metadata(){ready=true;video.pause();onReady();smoothed=target;seek();if(video.readyState>=2)seeked()}
  function data(){if(!disposed){root.dataset.painted='true';paint(video.currentTime)}}
  function preference(){location.reload()}
  video.addEventListener('loadedmetadata',metadata);video.addEventListener('loadeddata',data);
  video.addEventListener('seeked',seeked);video.addEventListener('error',fail);
  addEventListener('scroll',read,{passive:true});addEventListener('resize',resize);
  addEventListener('orientationchange',layout);addEventListener('pointerdown',prime,{passive:true});addEventListener('touchstart',prime,{passive:true});
  reduce.addEventListener('change',preference);
  root.dataset.reduced=String(reduced);layout();
  if(reduced){onReady();paint(target)}else void load();
  return ()=>{disposed=true;controller.abort();cancelAnimationFrame(raf);video.pause();video.removeAttribute('src');video.load();if(blobUrl)URL.revokeObjectURL(blobUrl);video.removeEventListener('loadedmetadata',metadata);video.removeEventListener('loadeddata',data);video.removeEventListener('seeked',seeked);video.removeEventListener('error',fail);removeEventListener('scroll',read);removeEventListener('resize',resize);removeEventListener('orientationchange',layout);removeEventListener('pointerdown',prime);removeEventListener('touchstart',prime);reduce.removeEventListener('change',preference)};
}

/** Composite the original moving silhouette over the profile wordmark.
 * The red backdrop becomes transparent; the original foreground pixels stay intact. */
export function createForeground(canvas:HTMLCanvasElement, video:HTMLVideoElement) {
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false});
  if(!gl)return ()=>{};
  function shader(type:number,source:string){const s=gl!.createShader(type)!;gl!.shaderSource(s,source);gl!.compileShader(s);return s}
  const vertex=shader(gl.VERTEX_SHADER,'attribute vec2 a; varying vec2 uv; void main(){uv=vec2((a.x+1.0)/2.0,1.0-(a.y+1.0)/2.0);gl_Position=vec4(a,0.0,1.0);}');
  const fragment=shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec2 uv; uniform sampler2D film; void main(){vec4 c=texture2D(film,uv); float alpha=1.0-smoothstep(0.10,0.69,c.r); gl_FragColor=vec4(c.rgb,alpha);}');
  const program=gl.createProgram()!;gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  return (dispose=false)=>{if(dispose){gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);return}if(video.readyState<2)return;try{if(canvas.width!==video.videoWidth){canvas.width=video.videoWidth;canvas.height=video.videoHeight;gl.viewport(0,0,canvas.width,canvas.height)}gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}catch{canvas.style.visibility='hidden'}};
}
