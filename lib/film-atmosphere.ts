import type {FilmMode} from './scroll-film';

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
uniform float breath;
uniform float steam;
uniform float clock;
uniform float foregroundOnly;
uniform vec4 filmRect;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+1.0),f.x),f.y);
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
  vec4 c=texture2D(film,sampleUV);
  float subject=1.0-smoothstep(.10,.69,c.r);
  if(foregroundOnly>.5){gl_FragColor=vec4(c.rgb,outside?0.0:subject);return;}
  // Upward advection, irregular wisps and soft columns behind both shoulders.
  // Keep the vapor behind the subject when the artboard is fitted.
  vec2 vaporUV=sceneUV;
  float sway=sin(vaporUV.y*11.0-clock*.38)*.025;
  float columns=exp(-pow((vaporUV.x-.31-sway)/.082,2.0))
    +exp(-pow((vaporUV.x-.72+sway)/.085,2.0))
    +.25*exp(-pow((vaporUV.x-.50-sway)/.13,2.0));
  vec2 flow=vaporUV*vec2(16.0,9.0)+vec2(clock*.035,clock*.36);
  flow.x+=(noise(flow*.55+vec2(0.0,clock*.08))-.5)*1.6;
  // Narrow, separated wisps reveal upward motion instead of a static haze.
  float vapor=smoothstep(.47,.72,mist(flow));
  float edges=smoothstep(.10,.115,vaporUV.x)*(1.0-smoothstep(.885,.90,vaporUV.x));
  float height=smoothstep(.015,.12,vaporUV.y)*(1.0-smoothstep(.86,1.0,vaporUV.y));
  // Red-background key keeps the vapor off the original dark silhouette.
  float behind=smoothstep(.65,.89,c.r);
  float alpha=min(columns,1.2)*vapor*height*edges*behind*steam*.40;
  gl_FragColor=vec4(mix(c.rgb,vec3(1.0,.82,.78),alpha),1.0);
}`;

type Layer={draw:(breath:number,steam:number,time:number)=>void;dispose:()=>void};
function createLayer(canvas:HTMLCanvasElement,video:HTMLVideoElement,foreground:boolean):Layer|null {
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false});
  if(!gl)return null;
  function compile(type:number,source:string){
    const shader=gl!.createShader(type);if(!shader)throw new Error('shader unavailable');
    gl!.shaderSource(shader,source);gl!.compileShader(shader);
    if(!gl!.getShaderParameter(shader,gl!.COMPILE_STATUS)){gl!.deleteShader(shader);throw new Error('shader compilation failed')}
    return shader;
  }
  let vertex:WebGLShader|null=null,fragment:WebGLShader|null=null,program:WebGLProgram|null=null;
  let buffer:WebGLBuffer|null=null,texture:WebGLTexture|null=null;
  const dispose=()=>{gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment)};
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
    const breathLocation=gl.getUniformLocation(program,'breath'),steamLocation=gl.getUniformLocation(program,'steam'),clockLocation=gl.getUniformLocation(program,'clock'),rectLocation=gl.getUniformLocation(program,'filmRect');
    gl.uniform1f(gl.getUniformLocation(program,'foregroundOnly'),foreground?1:0);
    let uploadedTime=-1,textureReady=false;
    return {dispose,draw:(breath,steam,time)=>{
      if(video.readyState<2||video.seeking||gl.isContextLost())return;
      // Retain native 4K on large displays; do not render unnecessary pixels
      // beyond the display density on phones. The source texture is unchanged.
      const rect=canvas.getBoundingClientRect();
      const width=Math.min(video.videoWidth,Math.max(1,Math.round(rect.width*Math.min(devicePixelRatio||1,2))));
      const height=Math.max(1,Math.round(width*rect.height/rect.width));
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height)}
      if(!textureReady||uploadedTime!==video.currentTime){
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);uploadedTime=video.currentTime;textureReady=true;
      }
      const filmBounds=video.getBoundingClientRect();
      gl.uniform4f(rectLocation,(filmBounds.left-rect.left)/rect.width,(filmBounds.top-rect.top)/rect.height,filmBounds.width/rect.width,filmBounds.height/rect.height);
      gl.uniform1f(breathLocation,breath);gl.uniform1f(steamLocation,steam);gl.uniform1f(clockLocation,time);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }};
  }catch{dispose();return null}
}

/** Idle motion changes the presentation of the held frame, never the film's
 * playhead or scene stop. Both canvas layers use the same breathing phase. */
export function createFilmAtmosphere(root:HTMLElement,canvas:HTMLCanvasElement,foreground:HTMLCanvasElement,video:HTMLVideoElement){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base=reduced?null:createLayer(canvas,video,false);
  const subject=base?createLayer(foreground,video,true):null;
  let mode:FilmMode='intro',mediaTime=0,idleTime=0,last=0,raf=0,lastDraw=0,strength=0,disposed=false;
  let available=!!base&&!!subject;
  const enabled=()=>available&&root.dataset.fallback!=='true'&&root.dataset.reduced!=='true';
  function render(now:number){
    if(!enabled()||mediaTime<3.9||video.readyState<2||video.seeking)return;
    const breath=(1-Math.cos(idleTime*Math.PI*2/4.2))*.5*strength;
    try{
      base!.draw(breath,strength,now/1000);
      if(mediaTime>=6.6&&mediaTime<=11.9)subject!.draw(breath,0,now/1000);
      root.dataset.atmosphere='true';
    }catch{available=false;root.dataset.atmosphere='false'}
  }
  function wake(){if(!raf&&!disposed&&enabled()&&!document.hidden&&(mode==='idle'||strength>.001))raf=requestAnimationFrame(tick)}
  function tick(now:number){
    raf=0;if(disposed||document.hidden||!enabled())return;
    const dt=last?Math.min((now-last)/1000,.1):0;last=now;
    if(mode==='idle')idleTime+=dt;
    const target=mode==='idle'?1:0;
    strength+=(target-strength)*(1-Math.exp(-dt/(target?1.0:.20)));
    if(strength<.001&&target===0)strength=0;
    if(now-lastDraw>=1000/30){lastDraw=now;render(now)}
    wake();
  }
  function visibility(){if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0}else{last=0;render(performance.now());wake()}}
  function lost(event:Event){event.preventDefault();available=false;root.dataset.atmosphere='false';cancelAnimationFrame(raf);raf=0}
  document.addEventListener('visibilitychange',visibility);
  canvas.addEventListener('webglcontextlost',lost);foreground.addEventListener('webglcontextlost',lost);
  return {
    setMode(next:FilmMode){
      if(next==='idle'&&mode!=='idle'){idleTime=0;strength=0;last=0}
      mode=next;
      if(next==='intro'){strength=0;root.dataset.atmosphere='false'}
      wake();
    },
    frame(time:number){mediaTime=time;if(time<3.9){root.dataset.atmosphere='false';return}const now=performance.now();if(mode==='idle'||now-lastDraw>=1000/30){lastDraw=now;render(now)}},
    dispose(){disposed=true;cancelAnimationFrame(raf);base?.dispose();subject?.dispose();root.dataset.atmosphere='false';document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);foreground.removeEventListener('webglcontextlost',lost)},
  };
}
