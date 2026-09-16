import assert from 'node:assert/strict';
import {MAP_BYTES} from '../lib/scene-registration.ts';
import {createFilmAtmosphere} from '../lib/film-atmosphere.ts';
let now=1000,id=0;const raf=new Map();
const images=[];
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(MAP_BYTES*2+1024)});
globalThis.Image=class{
 constructor(){images.push(this)}
 decode(){return Promise.resolve()}
 naturalWidth=0;naturalHeight=0;onload=null;onerror=null;
 load(width,height){this.naturalWidth=width;this.naturalHeight=height;this.onload?.()}
};
Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
const doc=Object.assign(new EventTarget(),{hidden:false});
Object.assign(globalThis,{document:doc,devicePixelRatio:2,matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{raf.set(++id,fn);return id},cancelAnimationFrame:id=>raf.delete(id)});
function canvas(){
 const calls=[],uniforms={};let uploads=0,deletes=0,imageUploads=0;
 const gl={
  createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,deleteShader(){},
  createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,useProgram(){},deleteProgram(){},
  createBuffer:()=>({}),bindBuffer(){},bufferData(){},deleteBuffer(){},getAttribLocation:()=>0,enableVertexAttribArray(){},vertexAttribPointer(){},
  createTexture:()=>({}),bindTexture(){},texParameteri(){},deleteTexture(){deletes++},activeTexture(){},getUniformLocation:(_,name)=>name,
  MAX_VIEWPORT_DIMS:0x0d3a,MAX_RENDERBUFFER_SIZE:0x84e8,
  getParameter:key=>key===0x0d3a?new Int32Array([16384,16384]):16384,
  uniform1i:(name,value)=>{uniforms[name]=value},uniform1f:(name,value)=>{uniforms[name]=value},uniform2f:(name,x,y)=>{uniforms[name]=[x,y]},uniform4f(){},isContextLost:()=>false,viewport(){},texImage2D(...args){uploads++;if(args.at(-1) instanceof Image)imageUploads++},drawArrays(){calls.push({...uniforms})},
 };
 return Object.assign(new EventTarget(),{width:300,height:150,getContext:()=>gl,getBoundingClientRect:()=>({width:1920,height:1080,left:0,top:0}),calls,uploads:()=>uploads,deletes:()=>deletes,imageUploads:()=>imageUploads});
}
function run(ms){for(let elapsed=0;elapsed<ms;elapsed+=20){now+=20;const pending=[...raf.values()];raf.clear();pending.forEach(fn=>fn(now))}}
const shade={},wordmark={};let shadeOpacity='0.65',logoOpacity='0';
globalThis.getComputedStyle=element=>({opacity:element===wordmark?logoOpacity:shadeOpacity});
const root={dataset:{reduced:'false'},querySelector:selector=>selector==='.profile-wordmark'?wordmark:shade},base=canvas(),subject=canvas();
const video={readyState:4,seeking:false,paused:true,currentTime:4.333333,videoWidth:3840,videoHeight:2160,getBoundingClientRect:()=>({width:1920,height:1080,left:0,top:0})};
const ambient=createFilmAtmosphere(root,base,subject,video);
ambient.setMode('idle');ambient.frame(video.currentTime);run(11000);
assert.equal(video.paused,true);assert.equal(video.currentTime,4.333333,'idle effect must never advance the film');
assert.ok(base.calls.length>200,'held frame keeps redrawing without scroll or video callbacks');
assert.equal(base.uploads(),1,'held 4K frame is uploaded only once');
assert.deepEqual(base.calls.at(-1).filmSize,[3840,2160],'reconstruction uses native source texels');
assert.equal(base.calls.at(-1).stillMix,0,'a slow image download must leave the film visible');
assert.equal(images.length,3);
images[0].load(1673,1190);await flush();const beforeSettle=base.uploads();run(600);
assert.equal(base.uploads(),beforeSettle,'first settled draw must not upload any image or flow texture');
assert.equal(base.calls.at(-1).stillMix,1,'idle scene reaches the original PNG without scroll');
assert.deepEqual(base.calls.at(-1).stillSize,[1673,1190],'original native texels are used, not an upscaled movie');
assert.equal(root.dataset.detailSource,'original-back');
const uploadsAfterStill=base.uploads();run(1000);
assert.equal(base.uploads(),uploadsAfterStill,'idle textures are not uploaded repeatedly');
const cadenceStart=base.calls.length;run(1000);
assert.equal(base.calls.length-cadenceStart,50,'the compositor draws each supplied display frame, without a 30fps timer cap');
assert.equal(base.calls.at(-1).shadeOpacity,.65,'CSS shade timing is preserved in the floating-point compositor');
base.getBoundingClientRect=()=>({width:2880,height:1800,left:0,top:0});run(80);
assert.equal(base.width,5760,'large Retina displays must not stretch a 3840px canvas');
assert.equal(base.height,3600);
globalThis.devicePixelRatio=3;base.getBoundingClientRect=()=>({width:390,height:844,left:0,top:0});run(80);
assert.equal(base.width,1170,'DPR 3 phones keep all physical pixels');assert.equal(base.height,2532);
globalThis.devicePixelRatio=2;
assert.ok(Math.max(...base.calls.map(c=>c.breath))>.98);
assert.ok(new Set(base.calls.map(c=>c.breath.toFixed(3))).size>100,'breathing continues through multiple cycles');
assert.ok(base.calls.at(-1).clock-base.calls[0].clock>10,'steam keeps rising while the video is paused');
ambient.setMode('transition');ambient.frame(5);run(80);
assert.ok(base.calls.at(-1).stillMix>0&&base.calls.at(-1).stillMix<1,'the still fades out rather than popping into playback');
run(1920);
assert.equal(base.calls.at(-1).stillMix,0,'playback uses the native movie');
assert.ok(base.calls.at(-1).steam<.002,'idle treatment fades out during the next scene');assert.equal(raf.size,0);
logoOpacity='1';video.currentTime=8.7;ambient.setMode('settling');ambient.frame(8.7);run(500);
run(80);
assert.equal(base.calls.at(-1).stillMix,0,'failed or pending profile must never reuse the back original');
images[1].load(1674,1190);await flush();run(1000);
assert.equal(root.dataset.detailSource,'original-profile');
const beforeIdle=base.calls.at(-1).breath;ambient.setMode('idle');run(20);assert.ok(Math.abs(base.calls.at(-1).breath-beforeIdle)<.05,'settling to idle preserves breathing phase');
assert.deepEqual(base.calls.at(-1).stillSize,[1674,1190]);
assert.equal(subject.calls.at(-1).stillMix,1,'foreground matte upgrades with the same original');
assert.ok(subject.calls.length>10);assert.equal(base.calls.at(-1).breath,subject.calls.at(-1).breath,'foreground and background remain aligned');
assert.equal(subject.calls.at(-1).shadeOpacity,0,'the foreground must never receive the background gradient');
ambient.setMode('transition');logoOpacity='0.4';video.currentTime=12.1;
const drawsBeforeFade=subject.calls.length;ambient.frame(12.1);run(80);
assert.ok(subject.calls.length>drawsBeforeFade,'the moving matte keeps updating after the previous 11.9-second cutoff while the logo fades');
assert.equal(root.dataset.foreground,'true','a fading logo remains occluded');
assert.equal(subject.calls.at(-1).shadeOpacity,.65*.6,'subject shading converges to the base without fading its alpha');
logoOpacity='0';run(80);assert.equal(root.dataset.foreground,'false','hide the matte only after the logo has disappeared');
ambient.setMode('idle');ambient.frame(8.7);logoOpacity='1';run(80);
shadeOpacity='0';run(80);assert.equal(base.calls.at(-1).shadeOpacity,0,'intro shade animation reaches a transparent endpoint');
doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(raf.size,0);
const count=base.calls.length;run(1000);assert.equal(base.calls.length,count);
doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));run(1000);assert.ok(base.calls.length>count);
ambient.setMode('intro');ambient.frame(0);assert.equal(root.dataset.atmosphere,'false','replaying the intro hides the held-frame overlay');
ambient.setMode('transition');ambient.frame(12);run(400);
video.currentTime=14.2;ambient.setMode('idle');ambient.frame(14.2);
images[2].load(1906,1356);await flush();run(1000);assert.equal(root.dataset.detailSource,'original-front');
assert.deepEqual(base.calls.at(-1).stillSize,[1906,1356]);
ambient.setMode('transition');run(400);video.currentTime=4.333333;
ambient.setMode('idle');ambient.frame(video.currentTime);
const beforeReturn=base.imageUploads();run(1000);
assert.equal(base.imageUploads(),beforeReturn,'returning to a decoded scene reuses its GPU texture');
assert.equal(root.dataset.detailSource,'original-back');
ambient.dispose();assert.equal(raf.size,0);assert.equal(base.deletes(),13,'originals, bidirectional maps, tone tables and video texture are released');
assert.ok(images.every(image=>image.onload===null&&image.onerror===null),'late loads cannot wake a disposed compositor');
console.log('PASS: original PNG idle detail, late/failed loads, cached textures, aligned masks, smooth video handoff, breathing, Retina buffers, hidden-tab pause, cleanup');
