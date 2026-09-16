import type {FilmMode} from './scroll-film';
import {filmResolution} from './film-resolution.ts';
import {loadRegisteredStill,MAP_WIDTH,MAP_HEIGHT,type RegisteredStill} from './scene-registration.ts';
import {SETTLE_DURATION,sceneAtTime} from './scroll-film.ts';
import {REFERENCE_RED} from './film-color.ts';

const VERTEX=`
attribute vec2 position;
varying vec2 uv;
void main(){
  uv=vec2((position.x+1.0)*.5,1.0-(position.y+1.0)*.5);
  gl_Position=vec4(position,0.0,1.0);
}`;
const FRAGMENT=`
precision highp float;
varying vec2 uv;
uniform sampler2D film;
uniform sampler2D stillFilm;
uniform vec2 stillSize;
uniform float stillMix;
uniform sampler2D forwardFlow;
uniform sampler2D backwardFlow;
uniform sampler2D toneLut;
uniform float breath;
uniform float steam;
uniform float clock;
uniform float foregroundOnly;
uniform vec4 filmRect;
uniform vec2 filmSize;
uniform float shadeOpacity;
// Catmull-Rom reconstruction retains fine towel/fabric detail through the
// breathing warp and Retina enlargement. Nine bilinear taps replace sixteen
// separate texel reads; this does not manufacture new source detail.
vec4 sampleTexture(sampler2D source,vec2 size,vec2 p){
  vec2 pixel=p*size;
  vec2 center=floor(pixel-.5)+.5;
  vec2 f=pixel-center;
  vec2 w0=f*(-.5+f*(1.0-.5*f));
  vec2 w1=1.0+f*f*(-2.5+1.5*f);
  vec2 w2=f*(.5+f*(2.0-1.5*f));
  vec2 w3=f*f*(-.5+.5*f);
  vec2 w12=w1+w2;
  vec2 p0=(center-1.0)/size;
  vec2 p12=(center+w2/w12)/size;
  vec2 p3=(center+2.0)/size;
  vec4 c=texture2D(source,p0)*w0.x*w0.y;
  c+=texture2D(source,vec2(p12.x,p0.y))*w12.x*w0.y;
  c+=texture2D(source,vec2(p3.x,p0.y))*w3.x*w0.y;
  c+=texture2D(source,vec2(p0.x,p12.y))*w0.x*w12.y;
  c+=texture2D(source,p12)*w12.x*w12.y;
  c+=texture2D(source,vec2(p3.x,p12.y))*w3.x*w12.y;
  c+=texture2D(source,vec2(p0.x,p3.y))*w0.x*w3.y;
  c+=texture2D(source,vec2(p12.x,p3.y))*w12.x*w3.y;
  c+=texture2D(source,p3)*w3.x*w3.y;
  return clamp(c,0.0,1.0);
}
vec3 refineSubject(vec2 p,vec3 c){
  // Limit the treatment to the original dark subject. Use native texels,
  // never screen pixels, so the result is consistent across display sizes.
  float mask=1.0-smoothstep(.46,.78,c.r);
  if(mask<.001)return c;
  vec2 d=vec2(2.25)/filmSize;
  vec3 a=texture2D(film,p+vec2(d.x,0.0)).rgb;
  vec3 b=texture2D(film,p-vec2(d.x,0.0)).rgb;
  vec3 e=texture2D(film,p+vec2(0.0,d.y)).rgb;
  vec3 f=texture2D(film,p-vec2(0.0,d.y)).rgb;
  vec3 low=min(c,min(min(a,b),min(e,f))),high=max(c,max(max(a,b),max(e,f)));
  float contrast=high.r-low.r;
  vec3 average=(a+b+e+f)*.25;
  // Smooth only nearly uniform compressed shadows; retain actual texture.
  vec3 clean=mix(c,average,.3*(1.0-smoothstep(.004,.022,contrast)));
  float edgeGuard=1.0-smoothstep(.08,.24,contrast);
  vec3 detail=clamp((c-average)*.7,vec3(-.025),vec3(.035))*edgeGuard;
  vec3 crisp=clamp(clean+detail,low,high);
  return mix(c,crisp,mask);
}
vec3 gradeSubject(vec3 c){
  // Exactly the same shadow curve for moving and original-image pixels.
  float mask=1.0-smoothstep(.46,.78,c.r);
  float peak=max(c.r,max(c.g,c.b));
  float gain=min(1.65,pow(max(peak,.001),-.15));
  return mix(c,clamp(c*gain,0.0,1.0),mask);
}
vec2 displacement(sampler2D flow,vec2 p){
  vec4 encoded=texture2D(flow,clamp(p,0.0,1.0));
  return vec2(dot(encoded.rg,vec2(256.0,1.0)),dot(encoded.ba,vec2(256.0,1.0)))/257.0*.24-.12;
}
vec2 registeredUV(sampler2D flow,vec2 p,float amount){
  vec2 q=p;
  // Invert the forward displacement instead of crossfading two silhouettes.
  q=p-amount*displacement(flow,q);
  q=p-amount*displacement(flow,q);
  return q;
}
vec3 matchMovieColor(vec3 c){
  return texture2D(toneLut,vec2((c.r*255.0+.5)/256.0,.5)).rgb;
}
vec3 restoreSourceRed(vec3 c){
  // Both sources share the user-approved #ED0505 palette. Preserve the dark
  // red-channel texture and ease the bright backdrop into the exact target.
  float t=clamp((c.r-.78)/.12,0.0,1.0);
  float level=c.r<.78?c.r/.9:.78/.9+.12/.9*(t+t*t-t*t*t);
  return vec3(${REFERENCE_RED.map(x=>(x/255).toFixed(9)).join(',')})*level;
}
vec3 finishColor(vec3 c){
  // Sub-LSB, stationary dithering breaks up 8-bit tonal steps. Apply after
  // grading and the page's dark gradient, without animated grain/flicker.
  float n=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5;
  float active=smoothstep(.002,.02,max(c.r,max(c.g,c.b)));
  return clamp(c+vec3(n/255.0)*active,0.0,1.0);
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 gradient(vec2 p){
  // Eight directions avoid value-noise's rectangular cloudy patches.
  float h=floor(hash(p)*8.0);
  vec2 g=vec2(mod(h,2.0)*2.0-1.0,mod(floor(h*.5),2.0)*2.0-1.0);
  if(h>=4.0)g=h<6.0?vec2(g.x,0.0):vec2(0.0,g.x);
  return g;
}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p),s=f*f*f*(f*(f*6.0-15.0)+10.0);
  float n=mix(mix(dot(gradient(i),f),dot(gradient(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),s.x),
    mix(dot(gradient(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(gradient(i+1.0),f-1.0),s.x),s.y);
  return .5+.7*n;
}
float mist(vec2 p){return noise(p)*.57+noise(p*2.03+7.2)*.28+noise(p*4.07+19.1)*.15;}
void main(){
  vec2 sceneUV=(uv-filmRect.xy)/filmRect.zw;
  bool outside=sceneUV.x<.116||sceneUV.x>.884||sceneUV.y<0.0||sceneUV.y>1.0;
  // Carry the head upward as one rigid region with the inhale. On a wide
  // screen the torso is cropped out, so torso-only motion cannot be seen.
  // The face keeps its proportions; the shoulders expand below the neck.
  float torso=smoothstep(.48,.64,sceneUV.y)*(1.0-smoothstep(.88,1.0,sceneUV.y));
  float lift=smoothstep(.015,.06,sceneUV.y)*(1.0-smoothstep(.70,1.0,sceneUV.y));
  float center=smoothstep(.13,.30,sceneUV.x)*(1.0-smoothstep(.76,.88,sceneUV.x));
  vec2 sampleUV=sceneUV;
  sampleUV.x=.5+(sceneUV.x-.5)/(1.0+breath*.016*torso);
  sampleUV.y+=breath*(.006*lift*center+.004*torso);
  // Extend the existing red at the edges, never enlarge/crop the character.
  if(outside){
    sampleUV=clamp(sceneUV,vec2(.116,0.0),vec2(.884,1.0));
  }
  vec4 c=vec4(0.0);float subject=0.0,behind=0.0;
  // A fully settled scene uses original PNG detail. Its calibrated colors
  // receive the same shadow grade as the moving movie below.
  if(stillMix<.999){
    vec2 movieUV=sampleUV;
    if(stillMix>.001&&!outside){
      vec2 artwork=vec2((sampleUV.x-.1046875)/.790625,sampleUV.y);
      artwork=registeredUV(forwardFlow,artwork,stillMix);
      movieUV=vec2(artwork.x*.790625+.1046875,artwork.y);
    }
    // Registration must never pull the movie's black pillarbox into the red
    // artwork. Keep reconstruction taps safely inside the picture as well.
    movieUV=clamp(movieUV,vec2(.116,2.0/filmSize.y),vec2(.884,1.0-2.0/filmSize.y));
    c=sampleTexture(film,filmSize,movieUV);
    subject=1.0-smoothstep(.10,.69,c.r);
    behind=smoothstep(.65,.89,c.r);
    if(!outside)c.rgb=refineSubject(movieUV,c.rgb);
  }
  if(stillMix>.001){
    vec2 stillUV=vec2((sampleUV.x-0.10468749999999999)/0.790625,sampleUV.y);
    if(stillMix<.999&&!outside)stillUV=registeredUV(backwardFlow,stillUV,1.0-stillMix);
    // Source exports can contain a one-pixel frame. A warped coordinate at
    // the border must not stretch that frame into a dark patch.
    stillUV=clamp(stillUV,vec2(3.0)/stillSize,1.0-vec2(3.0)/stillSize);
    vec4 original=sampleTexture(stillFilm,stillSize,stillUV);
    // Wider viewports need a continuation of the red backdrop. Do not
    // stretch the PNG's grainy border into visible horizontal scan lines.
    float edgeDistance=min(min(sceneUV.x-.116,.884-sceneUV.x),min(sceneUV.y,1.0-sceneUV.y));
    if(edgeDistance<.025){
      vec3 backdrop=(texture2D(stillFilm,vec2(.12,.12)).rgb
        +texture2D(stillFilm,vec2(.88,.12)).rgb
        +texture2D(stillFilm,vec2(.12,.18)).rgb
        +texture2D(stillFilm,vec2(.88,.18)).rgb)*.25;
      float feather=(1.0-smoothstep(0.0,.025,edgeDistance))*smoothstep(.65,.89,original.r);
      original.rgb=mix(original.rgb,backdrop,outside?1.0:feather);
    }
    original.rgb=matchMovieColor(original.rgb);
    subject=mix(subject,1.0-smoothstep(.10,.69,original.r),stillMix);
    behind=mix(behind,smoothstep(.65,.89,original.r),stillMix);
    c=mix(c,original,stillMix);
  }
  c.rgb=gradeSubject(restoreSourceRed(c.rgb));
  // A portrait viewport can continue below the source frame. Blend its last
  // few rows into the dark footer instead of stretching jacket pixels down.
  if(filmRect.y+filmRect.w<.999)c.rgb*=1.0-smoothstep(.95,1.0,sceneUV.y);
  if(foregroundOnly>.5){
    // Give the browser premultiplied pixels: transparent red background must
    // contain zero RGB, or a compositor can wash out the gradient and logo.
    float alpha=outside?0.0:subject;
    gl_FragColor=vec4(finishColor(c.rgb)*alpha,alpha);return;
  }
  // Clearly visible red-lit vapor, with feathered edges and tall, irregular
  // wisps. Keep the silhouette clear while the flow disperses at the top.
  vec2 vaporUV=sceneUV;
  float sway=sin(vaporUV.y*8.0-clock*.24)*.018;
  float columns=exp(-pow((vaporUV.x-.31-sway)/.094,2.0))
    +exp(-pow((vaporUV.x-.72+sway)/.099,2.0));
  vec2 flow=vaporUV*vec2(22.0,6.5)+vec2(clock*.025,clock*.23);
  flow+=(vec2(noise(flow*.45+vec2(0.0,clock*.055)),noise(flow*.45+vec2(8.3,clock*.04)))-.5)*2.4;
  float vapor=smoothstep(.39,.69,mist(flow));
  vapor*=.65+.35*noise(flow*vec2(.8,1.7)+13.4);
  float edges=smoothstep(.10,.115,vaporUV.x)*(1.0-smoothstep(.885,.90,vaporUV.x));
  float height=smoothstep(.025,.18,vaporUV.y)*(1.0-smoothstep(.80,1.0,vaporUV.y));
  // Red-background key keeps the vapor off the original dark silhouette.
  float alpha=min(columns,1.0)*vapor*height*edges*behind*steam*.41;
  vec3 color=mix(c.rgb,vec3(1.0,.82,.75),alpha);
  // Match the existing CSS gradient in floating point, before quantization.
  color*=1.0-clamp((uv.y-.35)/.65,0.0,1.0)*shadeOpacity;
  gl_FragColor=vec4(finishColor(color),1.0);
}`;

type Still={source:RegisteredStill;mix:number};
type Layer={prepare:(source:RegisteredStill)=>void;draw:(breath:number,steam:number,time:number,shade:number,still:Still|null)=>void;dispose:()=>void};
function createLayer(canvas:HTMLCanvasElement,video:HTMLVideoElement,foreground:boolean):Layer|null {
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false});
  if(!gl)return null;
  function compile(type:number,source:string){
    const shader=gl!.createShader(type);if(!shader)throw new Error('shader unavailable');
    gl!.shaderSource(shader,source);gl!.compileShader(shader);
    if(!gl!.getShaderParameter(shader,gl!.COMPILE_STATUS)){gl!.deleteShader(shader);throw new Error('shader compilation failed')}
    return shader;
  }
  let vertex:WebGLShader|null=null,fragment:WebGLShader|null=null,program:WebGLProgram|null=null;
  let buffer:WebGLBuffer|null=null,texture:WebGLTexture|null=null;
  const stillTextures=new Map<RegisteredStill,WebGLTexture[]>();
  const dispose=()=>{stillTextures.forEach(textures=>textures.forEach(t=>gl.deleteTexture(t)));stillTextures.clear();gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment)};
  try{
    vertex=compile(gl.VERTEX_SHADER,VERTEX);fragment=compile(gl.FRAGMENT_SHADER,FRAGMENT);
    program=gl.createProgram();if(!program)throw new Error('program unavailable');
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('shader linking failed');
    gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const breathLocation=gl.getUniformLocation(program,'breath'),steamLocation=gl.getUniformLocation(program,'steam'),clockLocation=gl.getUniformLocation(program,'clock'),rectLocation=gl.getUniformLocation(program,'filmRect'),sizeLocation=gl.getUniformLocation(program,'filmSize'),shadeLocation=gl.getUniformLocation(program,'shadeOpacity');
    const stillSizeLocation=gl.getUniformLocation(program,'stillSize'),stillMixLocation=gl.getUniformLocation(program,'stillMix');
    gl.uniform1i(gl.getUniformLocation(program,'film'),0);
    gl.uniform1i(gl.getUniformLocation(program,'stillFilm'),1);
    gl.uniform1i(gl.getUniformLocation(program,'forwardFlow'),2);gl.uniform1i(gl.getUniformLocation(program,'backwardFlow'),3);gl.uniform1i(gl.getUniformLocation(program,'toneLut'),4);
    const viewportLimit=gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    const bufferLimit=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
    const maxWidth=Math.min(viewportLimit[0],bufferLimit),maxHeight=Math.min(viewportLimit[1],bufferLimit);
    gl.uniform1f(gl.getUniformLocation(program,'foregroundOnly'),foreground?1:0);
    let uploadedTime=-1,textureReady=false;
    function prepare(source:RegisteredStill){
      if(stillTextures.has(source))return;
      const textures:WebGLTexture[]=[];
      try{
        for(let i=0;i<4;i++){
          const next=gl!.createTexture();if(!next)throw new Error('scene texture unavailable');textures.push(next);
          gl!.activeTexture(gl!.TEXTURE0+i+1);gl!.bindTexture(gl!.TEXTURE_2D,next);
          gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_MIN_FILTER,gl!.LINEAR);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_MAG_FILTER,gl!.LINEAR);
          gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_WRAP_S,gl!.CLAMP_TO_EDGE);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_WRAP_T,gl!.CLAMP_TO_EDGE);
          if(i===0)gl!.texImage2D(gl!.TEXTURE_2D,0,gl!.RGBA,gl!.RGBA,gl!.UNSIGNED_BYTE,source.image);
          else gl!.texImage2D(gl!.TEXTURE_2D,0,gl!.RGBA,i===3?256:MAP_WIDTH,i===3?1:MAP_HEIGHT,0,gl!.RGBA,gl!.UNSIGNED_BYTE,i===1?source.registration.forward:i===2?source.registration.backward:source.registration.tone);
        }
        stillTextures.set(source,textures);
      }catch(error){textures.forEach(t=>gl!.deleteTexture(t));throw error}
    }
    return {dispose,prepare,draw:(breath,steam,time,shade,still)=>{
      if(video.readyState<2||video.seeking||gl.isContextLost())return;
      // The texture remains native 4K. The display buffer must also cover
      // physical screen pixels, including DPR 3 phones and 5K/6K desktops.
      const rect=canvas.getBoundingClientRect();
      const {width,height}=filmResolution(rect.width,rect.height,devicePixelRatio,maxWidth,maxHeight);
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height)}
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
      if(!textureReady||(uploadedTime!==video.currentTime&&(!still||still.mix<1))){
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);uploadedTime=video.currentTime;textureReady=true;
      }
      const cached=still?stillTextures.get(still.source):null;
      if(still&&!cached)throw new Error('scene was not prepared');
      for(let i=0;i<4;i++){
        gl.activeTexture(gl.TEXTURE0+i+1);gl.bindTexture(gl.TEXTURE_2D,cached?cached[i]:texture);
      }
      gl.uniform2f(stillSizeLocation,still?.source.image.naturalWidth||video.videoWidth,still?.source.image.naturalHeight||video.videoHeight);
      gl.uniform1f(stillMixLocation,still?.mix||0);
      const filmBounds=video.getBoundingClientRect();
      gl.uniform2f(sizeLocation,video.videoWidth,video.videoHeight);
      gl.uniform4f(rectLocation,(filmBounds.left-rect.left)/rect.width,(filmBounds.top-rect.top)/rect.height,filmBounds.width/rect.width,filmBounds.height/rect.height);
      gl.uniform1f(breathLocation,breath);gl.uniform1f(steamLocation,steam);gl.uniform1f(clockLocation,time);
      gl.uniform1f(shadeLocation,shade);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }};
  }catch{dispose();return null}
}

/** Idle motion changes the presentation of the held frame, never the film's
 * playhead or scene stop. Both canvas layers use the same breathing phase. */
export function createFilmAtmosphere(root:HTMLElement,canvas:HTMLCanvasElement,foreground:HTMLCanvasElement,video:HTMLVideoElement){
  const shade=root.querySelector<HTMLElement>('.scene-shade');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base=reduced?null:createLayer(canvas,video,false);
  const subject=base?createLayer(foreground,video,true):null;
  let mode:FilmMode='intro',mediaTime=0,idleTime=0,last=0,raf=0,strength=0,disposed=false;
  let available=!!base&&!!subject;
  const originals=new Map<string,RegisteredStill>();
  const loading=new AbortController();
  let approaching=false;
  let heldScene='',heldImage:RegisteredStill|null=null,stillBlend=0;
  const sceneKey=()=>sceneAtTime(mediaTime);
  const resting=()=>mode==='idle'||mode==='settling'||approaching;
  function selectOriginal(){
    if(!resting())return;
    const scene=sceneKey();
    if(scene!==heldScene){heldScene=scene;heldImage=null;stillBlend=0}
    heldImage=originals.get(scene)||null;
  }
  // Decode and upload every image/registration texture before its handoff.
  // Never block the first settled frame with PNG decoding or texImage2D.
  if(available)for(const scene of ['back','profile','front']){
    void loadRegisteredStill(scene,loading.signal).then(source=>{
      if(disposed)return;
      base!.prepare(source);subject!.prepare(source);
      originals.set(scene,source);selectOriginal();wake();
    }).catch(()=>{/* Keep the movie if either original or alignment data fails. */});
  }
  const enabled=()=>available&&root.dataset.fallback!=='true'&&root.dataset.reduced!=='true';
  function render(now:number){
    if(!enabled()||mediaTime<3.9||video.readyState<2||video.seeking)return;
    const breath=(1-Math.cos(idleTime*Math.PI*2/4.2))*.5*strength;
    try{
      const shadeAlpha=shade?Number.parseFloat(getComputedStyle(shade).opacity)||0:0;
      const eased=stillBlend*stillBlend*(3-2*stillBlend);
      const still=heldImage&&eased>0?{source:heldImage,mix:eased}:null;
      base!.draw(breath,strength,now/1000,shadeAlpha,still);
      if(mediaTime>=6.6&&mediaTime<=11.9)subject!.draw(breath,0,now/1000,0,still);
      root.dataset.atmosphere='true';
      root.dataset.detailSource=stillBlend===1&&heldImage?`original-${heldScene}`:'video';
    }catch{available=false;root.dataset.atmosphere='false'}
  }
  function wake(){if(!raf&&!disposed&&enabled()&&!document.hidden&&(resting()||strength>.001||stillBlend>0))raf=requestAnimationFrame(tick)}
  function tick(now:number){
    raf=0;if(disposed||document.hidden||!enabled())return;
    const dt=last?Math.min((now-last)/1000,.1):0;last=now;
    if(resting())idleTime+=dt;
    selectOriginal();
    stillBlend=resting()&&heldImage?Math.min(1,stillBlend+dt/SETTLE_DURATION):Math.max(0,stillBlend-dt/.18);
    const target=resting()?1:0;
    strength+=(target-strength)*(1-Math.exp(-dt/(target?1.0:.20)));
    if(strength<.001&&target===0)strength=0;
    render(now);
    wake();
  }
  function visibility(){if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0}else{last=0;render(performance.now());wake()}}
  function lost(event:Event){event.preventDefault();available=false;root.dataset.atmosphere='false';cancelAnimationFrame(raf);raf=0}
  document.addEventListener('visibilitychange',visibility);
  canvas.addEventListener('webglcontextlost',lost);foreground.addEventListener('webglcontextlost',lost);
  return {
    setMode(next:FilmMode){
      if((next==='settling'||next==='idle')&&!resting()){idleTime=0;strength=0;last=0}
      mode=next;
      if(next==='transition'||next==='intro')approaching=false;
      if(next==='intro'){strength=0;stillBlend=0;heldScene='';heldImage=null;root.dataset.atmosphere='false';root.dataset.detailSource='video'}
      wake();
    },
    handoff(time:number,progress:number){
      if(!approaching){approaching=true;idleTime=0;strength=0;last=0}
      const scene=sceneAtTime(time);
      if(heldScene!==scene){heldScene=scene;heldImage=originals.get(scene)||null;stillBlend=0}
      if(heldImage)stillBlend=Math.max(stillBlend,Math.min(1,progress));
      wake();
    },
    frame(time:number){mediaTime=time;selectOriginal();if(time<3.9){root.dataset.atmosphere='false';return}const now=performance.now();if(!raf)render(now)},
    dispose(){disposed=true;loading.abort();originals.clear();heldImage=null;cancelAnimationFrame(raf);base?.dispose();subject?.dispose();root.dataset.atmosphere='false';document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);foreground.removeEventListener('webglcontextlost',lost)},
  };
}
