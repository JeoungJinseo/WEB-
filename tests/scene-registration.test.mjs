import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseRegistration,loadRegisteredStill,MAP_BYTES} from '../lib/scene-registration.ts';
import {SCENE_STOPS} from '../lib/scroll-film.ts';
import {restoreSourceRed,REFERENCE_RED,RED_CHANNEL_MATRIX,SOURCE_RED_TABLES} from '../lib/film-color.ts';
const manifest=JSON.parse(readFileSync(new URL('../public/assets/registration/manifest.json',import.meta.url)));
for(const [index,scene] of ['back','profile','front'].entries()){
 const bytes=readFileSync(new URL(`../public/assets/registration/${scene}.bin`,import.meta.url));
 const data=parseRegistration(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const metadata=manifest[scene];
 assert.equal(metadata.time,SCENE_STOPS[index],'registration must use the exact decoder stop frame');
 const original=readFileSync(new URL(`../public/assets/${scene}.png`,import.meta.url));
 assert.equal(createHash('sha256').update(original).digest('hex'),metadata.source_sha256,'stale registration cannot ship with another image');
 const background=metadata.original_background_rgb[0];
 const calibrated=[...data.tone.slice(background*4,background*4+3)];
 calibrated.forEach((value,channel)=>assert.ok(Math.abs(value-metadata.movie_background_rgb[channel])<=4,'background color matches the BT.709 decoder within 4/255'));
 const restored=restoreSourceRed(calibrated),moving=restoreSourceRed(metadata.movie_background_rgb);
 for(const color of [restored,moving]){
  color.forEach((value,channel)=>assert.ok(Math.abs(value-REFERENCE_RED[channel])<.001,`${scene}: final unshaded backdrop must be exactly #ED0505`));
  assert.ok(color[1]/color[0]<.035,'red backdrop must not drift toward orange');
 }
 restored.forEach((value,channel)=>assert.ok(Math.abs(value-moving[channel])<=4,'restoring red must preserve the moving/held color match'));
 for(let i=1;i<256;i++)assert.ok(data.tone[i*4]>=data.tone[(i-1)*4],'shadow tone curve must not invert contrast');
 assert.ok(metadata.mean_subject_difference_after<metadata.mean_subject_difference_before,'registration must reduce endpoint mismatch');
}
assert.deepEqual(restoreSourceRed([0,0,0]),[0,0,0],'reference correction preserves pure black');
const svg=RED_CHANNEL_MATRIX.split(/\s+/).map(Number),tables=SOURCE_RED_TABLES.map(t=>t.split(' ').map(Number));
for(const rgb of [[240,26,0],[31,8,2],[0,0,0],[202.4,29,3]]){
 const native=[0,1,2].map(row=>{
  const input=rgb.reduce((sum,c,col)=>sum+c*svg[row*5+col],svg[row*5+4]);
  const lo=Math.floor(input),hi=Math.min(255,lo+1),f=input-lo;
  return (tables[row][lo]*(1-f)+tables[row][hi]*f)*255;
 });
 native.forEach((value,i)=>assert.ok(Math.abs(value-restoreSourceRed(rgb)[i])<.1,'native intro and compositor retain the same sRGB palette'));
}
for(let r=1;r<=230;r++)assert.ok(restoreSourceRed([r,0,0])[0]>restoreSourceRed([r-1,0,0])[0],'reference palette must preserve dark texture contrast');
assert.throws(()=>parseRegistration(new ArrayBuffer(MAP_BYTES)),/Invalid/);
const images=[];
globalThis.Image=class{constructor(){images.push(this)}decode(){return Promise.resolve()}};
globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(MAP_BYTES*2+1024)});
const abort=new AbortController();const pending=loadRegisteredStill('profile',abort.signal);abort.abort();
await assert.rejects(pending,/aborted/);assert.equal(images[0].onload,null,'aborted requests remove callbacks');
const failed=loadRegisteredStill('back',new AbortController().signal);images[1].onerror();
await assert.rejects(failed,/image unavailable/);
globalThis.fetch=async()=>({ok:false});
await assert.rejects(loadRegisteredStill('front',new AbortController().signal),/registration unavailable/);
images[2].onload();
console.log('PASS: exact stop registration, original hashes, reference-red display calibration, native/WebGL parity, monotonic shadows, malformed data and failed/aborted loads');
