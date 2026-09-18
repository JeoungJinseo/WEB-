'use client';

import { useEffect, useRef } from 'react';

const vertex = `attribute vec2 position;
varying vec2 vUv;
void main(){vUv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;

// One field drives both the visible vapor and the lettering's contact mask.
// No independent heat spots: clear air always restores the original vector.
const field = `
precision highp float;
varying vec2 vUv;
uniform sampler2D original;
uniform sampler2D vaporSeed;
uniform vec2 resolution;
uniform vec2 designSize;
uniform float vaporWidth;
uniform vec3 vaporLayout;
uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);
}
float fbm(vec2 p){
 float v=0.,a=.57;
 for(int i=0;i<3;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+17.1;a*=.48;}
 return v;
}
vec2 designPoint(vec2 uv){return vec2((uv.x-.5)*vaporWidth+720.,296.+(1.-uv.y-vaporLayout.x)/vaporLayout.y*824.);}
vec2 sceneUv(vec2 p){return vec2((p.x-720.)/vaporWidth+.5,1.-vaporLayout.x-(p.y-296.)/824.*vaporLayout.y);}
float steamAt(vec2 uv){
 vec2 p=designPoint(uv);
 // Upward advection within the field; nothing translates as a solid cloud.
 vec2 flow=vec2(fbm(p*.004+vec2(3.,time*.055)),fbm(p*.005+vec2(29.,time*.075)))-.5;
 vec2 q=p+flow*145.;
 float billow=fbm(q*vec2(.008,.011)+vec2(0.,time*.22));
 float fine=fbm(q*.018+vec2(-time*.045,time*.15));
 float breakup=smoothstep(.24,.76,billow*.78+fine*.22);
 vec2 seedUv=sceneUv(p+flow*100.+vec2(0.,sin(time*.13)*24.));
 float seed=texture2D(vaporSeed,clamp(seedUv,vec2(.001),vec2(.999))).a;
 float plumes=0.;
 for(int i=0;i<11;i++){
  float id=float(i);
  // Span the actual viewport, including the sides of wide desktop screens.
  float across=id/10.;
  float originX=720.+(across-.5)*vaporWidth*.96;
  float originY=890.+70.*sin(id*2.3);
  float rise=originY-p.y;
  float width=max(24.,vaporWidth/27.)+max(rise,0.)*.22;
  float center=originX+(across-.5)*max(rise,0.)*.22+flow.x*110.+sin(rise*.008+id*1.8+time*.19)*(24.+max(rise,0.)*.06);
  float x=(p.x-center)/width;
  float spread=exp(-x*x*1.7);
  float life=smoothstep(-45.,65.,rise)*(1.-smoothstep(430.,790.,rise));
  float emission=.7+.3*sin(time*(.24+id*.013)+id*2.4);
  plumes+=spread*life*emission;
 }
 float sides=smoothstep(.12,.46,abs(uv.x-.5));
 float density=seed*(.22+.42*breakup)+plumes*breakup*mix(.40,.64,sides)*min(1.,vaporWidth/1440.);
 float topFade=smoothstep(120.,220.,p.y);
 float bottomFade=1.-smoothstep(990.,1120.,p.y);
 return smoothstep(.025,.88,density)*.58*topFade*bottomFade*smoothstep(vaporLayout.z,vaporLayout.x+.02,1.-uv.y);
}
vec2 inkUv(){
 float progress=clamp((time-.35)/2.,0.,1.);
 float lift=100.*pow(1.-progress,4.);
 return vUv+vec2(0.,lift/designSize.y);
}
`;

const simulation = `${field}
uniform sampler2D previous;
uniform vec2 pointer;
uniform float delta;
void main(){
 float vapor=steamAt(vUv);
 float contact=smoothstep(.045,.22,vapor)*smoothstep(2.25,2.7,time);
 float base=texture2D(original,inkUv()).r;
 vec2 p=designPoint(vUv);
 vec2 air=vec2(noise(p*.009+vec2(0.,time*.2))-.5,noise(p*.007+vec2(7.,time*.16))-.3);
 vec2 displacement=(air+pointer*.025)*vec2(1.1,1.7)/designSize*contact*delta*60.;
 float prev=texture2D(previous,vUv).r;
 float spread=max(prev,max(texture2D(previous,vUv-displacement).r,texture2D(previous,vUv+displacement*.5).r));
 float trail=mix(prev,spread,.30)*pow(.94,delta*60.);
 float ink=max(base,trail*contact);
 gl_FragColor=vec4(vec3(ink),1.);
}`;

const display = `${field}
uniform sampler2D previous;
void main(){
 float vapor=steamAt(vUv);
 float contact=smoothstep(.045,.22,vapor);
 float base=texture2D(original,inkUv()).r;
 float ink=max(base,texture2D(previous,vUv).r*contact);
 // Vapor is composited over the ink using the very same density as contact.
 float alpha=vapor+ink*(1.-vapor);
 // Match the browser compositor's premultiplied canvas surface. Keeping
 // RGB bounded by alpha also preserves feathered edges in WebKit.
 vec3 color=vec3(.9843,.0078,.0039)*vapor+vec3(.043137,.027451,.035294)*ink*(1.-vapor);
 gl_FragColor=vec4(color,alpha);
}`;

export default function InkFeedback() {
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;
  if(!canvas)return;
  const host=canvas.parentElement!;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  if(reduced.matches)return;
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false});
  if(!gl)return;
  let dead=false,raf=0,last=0,elapsed=0,ready=false,index=0;
  let px=0,py=0,tx=0,ty=0,vaporWidth=1440,designSize=[1440,1024],vaporLayout=[296/1024,824/1024,120/1024];
  const shaders:WebGLShader[]=[],programs:WebGLProgram[]=[];
  const compile=(type:number,source:string)=>{
   const shader=gl.createShader(type)!;shaders.push(shader);
   gl.shaderSource(shader,source);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)||'Shader compilation failed');
   return shader;
  };
  const program=(fragment:string)=>{
   const p=gl.createProgram()!;programs.push(p);
   gl.attachShader(p,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);
   if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('Shader link failed');
   return p;
  };
  let sim:WebGLProgram,draw:WebGLProgram;
  try{sim=program(simulation);draw=program(display);}
  catch{shaders.forEach(s=>gl.deleteShader(s));programs.forEach(p=>gl.deleteProgram(p));return;}
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const texture=()=>{
   const t=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,t);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   return t;
  };
  const original=texture(),vaporSeed=texture(),textures=[texture(),texture()];
  const frames=[gl.createFramebuffer()!,gl.createFramebuffer()!];
  const uniforms=new Map(programs.map(p=>[p,Object.fromEntries(['original','vaporSeed','previous','resolution','designSize','vaporWidth','vaporLayout','time','pointer','delta'].map(n=>[n,gl.getUniformLocation(p,n)]))]));
  const bind=(p:WebGLProgram)=>{
   gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   const a=gl.getAttribLocation(p,'position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  };
  const mask=document.createElement('canvas'),seed=document.createElement('canvas');
  const ctx=mask.getContext('2d')!,seedCtx=seed.getContext('2d')!;
  const images=['we-are.svg','we-are-stroke.svg','young-designers.svg','steam-front.svg'].map(src=>{const img=new Image();img.src=`/assets/${src}`;return img;});
  const resize=()=>{
   if(dead||!images.every(i=>i.complete&&i.naturalWidth))return;
   const bounds=canvas.getBoundingClientRect();
   if(bounds.width<1||bounds.height<1)return;
   // Small screens keep their native pixel density without increasing the
   // existing total-pixel budget on desktop or large high-density displays.
   const dpr=Math.min(devicePixelRatio,3,1500/bounds.width,Math.sqrt(1500000/(bounds.width*bounds.height)));
   const vaporBounds=host.querySelector<HTMLElement>('.vapor-layout')!.getBoundingClientRect();
   const bandBounds=host.parentElement!.querySelector<HTMLElement>('.heat-stripes i')!.getBoundingClientRect();
   vaporLayout=[(vaporBounds.top-bounds.top)/bounds.height,vaporBounds.height/bounds.height,(bandBounds.top-bounds.top)/bounds.height];
   // Equal x/y spatial scale keeps clouds round when the hero becomes tall.
   vaporWidth=824*bounds.width/vaporBounds.height;
   const u=Math.min(bounds.width/1440,bounds.height/1024);
   designSize=[bounds.width/u,bounds.height/u];
   canvas.width=mask.width=seed.width=Math.max(1,Math.round(bounds.width*dpr));
   canvas.height=mask.height=seed.height=Math.max(1,Math.round(bounds.height*dpr));
   ctx.clearRect(0,0,mask.width,mask.height);seedCtx.clearRect(0,0,seed.width,seed.height);
   const title=host.querySelector<HTMLElement>('.title')!;
   const introOffset=title.getBoundingClientRect().top-bounds.top;
   host.querySelectorAll<HTMLElement>('.title-line').forEach(line=>{
    const b=line.getBoundingClientRect(),x=(b.left-bounds.left)*dpr,y=(b.top-bounds.top-introOffset)*dpr,w=b.width*dpr,h=b.height*dpr;
    if(w<1||h<1)return;
    line.querySelectorAll<HTMLImageElement>('img').forEach(element=>{
     const image=images.find(image=>image.src===element.src);
     if(image)ctx.drawImage(image,x,y,w,h);
    });
   });
   ctx.globalCompositeOperation='source-in';ctx.fillStyle='#fff';ctx.fillRect(0,0,mask.width,mask.height);
   ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#000';ctx.fillRect(0,0,mask.width,mask.height);ctx.globalCompositeOperation='source-over';
   const vaporImage=host.querySelector<HTMLImageElement>('.vapor-front img')!;
   // Layout boxes remain measurable while the GPU renders their replacement.
   const vaporImageBounds=vaporImage.getBoundingClientRect();
   seedCtx.drawImage(images[3],(vaporImageBounds.left-bounds.left)*dpr,(vaporImageBounds.top-bounds.top)*dpr,vaporImageBounds.width*dpr,vaporImageBounds.height*dpr);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
   gl.bindTexture(gl.TEXTURE_2D,original);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mask);
   gl.bindTexture(gl.TEXTURE_2D,vaporSeed);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,seed);
   textures.forEach((t,i)=>{
    gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,mask.width,mask.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,frames[i]);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete feedback framebuffer');
   });
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);ready=true;
  };
  const common=(p:WebGLProgram,previous:WebGLTexture,dt:number)=>{
   bind(p);const locations=uniforms.get(p)!;
   [previous,original,vaporSeed].forEach((t,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);});
   gl.uniform1i(locations.previous,0);gl.uniform1i(locations.original,1);gl.uniform1i(locations.vaporSeed,2);
   gl.uniform2f(locations.resolution,canvas.width,canvas.height);gl.uniform2f(locations.designSize,designSize[0],designSize[1]);
   gl.uniform1f(locations.vaporWidth,vaporWidth);
   gl.uniform3f(locations.vaporLayout,vaporLayout[0],vaporLayout[1],vaporLayout[2]);
   gl.uniform1f(locations.time,elapsed);gl.uniform1f(locations.delta,dt);gl.uniform2f(locations.pointer,px,py);
  };
  const loop=(now:number)=>{
   if(dead)return;raf=requestAnimationFrame(loop);
   if(document.hidden){last=now;return;}
   if(!ready||now-last<22)return;
   const dt=last?Math.min((now-last)/1000,.05):1/60;last=now;elapsed+=dt;
   px+=(tx-px)*.05;py+=(ty-py)*.05;
   const target=1-index;
   common(sim,textures[index],dt);gl.bindFramebuffer(gl.FRAMEBUFFER,frames[target]);gl.drawArrays(gl.TRIANGLES,0,6);
   common(draw,textures[target],dt);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.drawArrays(gl.TRIANGLES,0,6);
   index=target;host.classList.add('feedback-ready');
  };
  const move=(e:PointerEvent)=>{if(e.pointerType==='touch')return;const b=canvas.getBoundingClientRect();tx=(e.clientX-b.left)/b.width*2-1;ty=1-(e.clientY-b.top)/b.height*2;};
  const leave=()=>{tx=ty=0;};
  const stop=()=>{dead=true;cancelAnimationFrame(raf);host.classList.remove('feedback-ready');};
  const safeResize=()=>{try{resize();}catch{stop();}};
  canvas.addEventListener('webglcontextlost',stop);reduced.addEventListener('change',stop);
  window.addEventListener('pointermove',move);document.documentElement.addEventListener('pointerleave',leave);
  const observer=new ResizeObserver(safeResize);observer.observe(canvas);
  Promise.all(images.map(i=>i.decode())).then(()=>{if(!dead){safeResize();raf=requestAnimationFrame(loop);}}).catch(stop);
  return()=>{
   stop();observer.disconnect();window.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',leave);
   canvas.removeEventListener('webglcontextlost',stop);reduced.removeEventListener('change',stop);
   [...textures,original,vaporSeed].forEach(t=>gl.deleteTexture(t));frames.forEach(f=>gl.deleteFramebuffer(f));
   gl.deleteBuffer(buffer);programs.forEach(p=>gl.deleteProgram(p));shaders.forEach(s=>gl.deleteShader(s));
  };
 },[]);
 return <canvas ref={ref} className="ink-feedback" aria-hidden="true" />;
}
