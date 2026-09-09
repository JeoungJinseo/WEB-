import assert from 'node:assert/strict';
import {createFilmAtmosphere} from '../lib/film-atmosphere.ts';
let now=1000,id=0;const raf=new Map();
Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
const doc=Object.assign(new EventTarget(),{hidden:false});
Object.assign(globalThis,{document:doc,devicePixelRatio:2,matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{raf.set(++id,fn);return id},cancelAnimationFrame:id=>raf.delete(id)});
function canvas(){
 const calls=[],uniforms={};let uploads=0;
 const gl={
  createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,deleteShader(){},
  createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,useProgram(){},deleteProgram(){},
  createBuffer:()=>({}),bindBuffer(){},bufferData(){},deleteBuffer(){},getAttribLocation:()=>0,enableVertexAttribArray(){},vertexAttribPointer(){},
  createTexture:()=>({}),bindTexture(){},texParameteri(){},deleteTexture(){},getUniformLocation:(_,name)=>name,
  MAX_VIEWPORT_DIMS:0x0d3a,MAX_RENDERBUFFER_SIZE:0x84e8,
  getParameter:key=>key===0x0d3a?new Int32Array([16384,16384]):16384,
  uniform1f:(name,value)=>{uniforms[name]=value},uniform2f:(name,x,y)=>{uniforms[name]=[x,y]},uniform4f(){},isContextLost:()=>false,viewport(){},texImage2D(){uploads++},drawArrays(){calls.push({...uniforms})},
 };
 return Object.assign(new EventTarget(),{width:300,height:150,getContext:()=>gl,getBoundingClientRect:()=>({width:1920,height:1080,left:0,top:0}),calls,uploads:()=>uploads});
}
function run(ms){for(let elapsed=0;elapsed<ms;elapsed+=20){now+=20;const pending=[...raf.values()];raf.clear();pending.forEach(fn=>fn(now))}}
const root={dataset:{reduced:'false'}},base=canvas(),subject=canvas();
const video={readyState:4,seeking:false,paused:true,currentTime:4.333333,videoWidth:3840,videoHeight:2160,getBoundingClientRect:()=>({width:1920,height:1080,left:0,top:0})};
const ambient=createFilmAtmosphere(root,base,subject,video);
ambient.setMode('idle');ambient.frame(video.currentTime);run(11000);
assert.equal(video.paused,true);assert.equal(video.currentTime,4.333333,'idle effect must never advance the film');
assert.ok(base.calls.length>200,'held frame keeps redrawing without scroll or video callbacks');
assert.equal(base.uploads(),1,'held 4K frame is uploaded only once');
assert.deepEqual(base.calls.at(-1).filmSize,[3840,2160],'reconstruction uses native source texels');
base.getBoundingClientRect=()=>({width:2880,height:1800,left:0,top:0});run(80);
assert.equal(base.width,5760,'large Retina displays must not stretch a 3840px canvas');
assert.equal(base.height,3600);
globalThis.devicePixelRatio=3;base.getBoundingClientRect=()=>({width:390,height:844,left:0,top:0});run(80);
assert.equal(base.width,1170,'DPR 3 phones keep all physical pixels');assert.equal(base.height,2532);
globalThis.devicePixelRatio=2;
assert.ok(Math.max(...base.calls.map(c=>c.breath))>.98);
assert.ok(new Set(base.calls.map(c=>c.breath.toFixed(3))).size>100,'breathing continues through multiple cycles');
assert.ok(base.calls.at(-1).clock-base.calls[0].clock>10,'steam keeps rising while the video is paused');
ambient.setMode('transition');ambient.frame(5);run(2000);
assert.ok(base.calls.at(-1).steam<.002,'idle treatment fades out during the next scene');assert.equal(raf.size,0);
video.currentTime=8.7;ambient.setMode('idle');ambient.frame(8.7);run(1000);
assert.ok(subject.calls.length>10);assert.equal(base.calls.at(-1).breath,subject.calls.at(-1).breath,'foreground and background remain aligned');
doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(raf.size,0);
const count=base.calls.length;run(1000);assert.equal(base.calls.length,count);
doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));run(1000);assert.ok(base.calls.length>count);
ambient.setMode('intro');ambient.frame(0);assert.equal(root.dataset.atmosphere,'false','replaying the intro hides the held-frame overlay');
ambient.dispose();assert.equal(raf.size,0);
console.log('PASS: live idle breathing and steam on a paused frame, cached 4K texture, aligned foreground, transition fade, hidden-tab pause, intro reset, cleanup');
