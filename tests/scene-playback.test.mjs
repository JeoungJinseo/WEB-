import assert from 'node:assert/strict';
import {mountScrollFilm,INTRO_END,SCENE_STOPS} from '../lib/scroll-film.ts';
globalThis.Element=class Element {};
const atStop=(actual,expected,message)=>assert.ok(Math.abs(Math.floor(actual*24+1e-6)-Math.round(expected*24))<=1,message||`Expected ${actual} to hold at ${expected}`);
const flush=async()=>{for(let i=0;i<32;i++)await Promise.resolve()};
async function setup({reduce=false,blocked=false,error=false,mediaError,frameCallbacks=false,width=1440,height=900}={}){
 let now=1000,rafId=0;const frames=new Map(),events=new EventTarget();
 Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
 Object.assign(globalThis,{innerWidth:width,innerHeight:height,scrollTo:()=>{throw new Error('Resize must not force page scroll')},
  matchMedia:()=>Object.assign(new EventTarget(),{matches:reduce}),
  addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),
  requestAnimationFrame:fn=>{frames.set(++rafId,fn);return rafId},cancelAnimationFrame:id=>frames.delete(id),
  fetch:async()=>({ok:!error,blob:async()=>new Blob(['test media'])})});
 class Video extends EventTarget {
  src='';readyState=0;duration=14.333;paused=true;seeking=false;time=0;playbackRate=1;plays=0;block=blocked;seeks=[];failMedia=mediaError??(()=>error);
  get currentTime(){return this.time}
  set currentTime(t){this.time=t;this.seeks.push(t);this.seeking=true;queueMicrotask(()=>{this.seeking=false;this.dispatchEvent(new Event('seeked'))})}
  load(){if(!this.src)return;const source=this.src;queueMicrotask(()=>{if(this.src!==source)return;if(this.failMedia(source)){this.dispatchEvent(new Event('error'));return}this.readyState=4;this.dispatchEvent(new Event('loadedmetadata'));this.dispatchEvent(new Event('loadeddata'))})}
  async play(){this.plays++;if(this.block)throw new Error('NotAllowedError');this.paused=false}
  pause(){this.paused=true}
  removeAttribute(){this.src=''}
 }
 const video=new Video();
 const delivered=new Map();let frameId=0,lastPresented=-1;
 if(frameCallbacks){video.requestVideoFrameCallback=fn=>{delivered.set(++frameId,fn);return frameId};video.cancelVideoFrameCallback=id=>delivered.delete(id)}
 const root={dataset:{},style:{setProperty(){}}},scenes=[],handoffs=[];
 const film=mountScrollFilm({root,video,onScene:s=>scenes.push(s),onMode:()=>{},onReady:()=>{},onError:()=>{},onFrame:()=>{},onHandoff:(time,progress)=>handoffs.push({time,progress,paused:video.paused,mode:root.dataset.mode})});
 await flush();
 const emit=(type,values={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,values);events.dispatchEvent(e)};
 async function run(ms){for(let elapsed=0;elapsed<ms;elapsed+=20){now+=20;if(!video.paused){video.time+=.02*video.playbackRate;video.dispatchEvent(new Event('timeupdate'));if(frameCallbacks){const mediaTime=Math.floor(video.time*24)/24;if(mediaTime!==lastPresented){lastPresented=mediaTime;const callbacks=[...delivered.values()];delivered.clear();callbacks.forEach(fn=>fn(now,{mediaTime}))}}}const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(now);await flush()}}
 const wheel=delta=>emit('wheel',{deltaY:delta,deltaX:0,deltaMode:0,ctrlKey:false});
 return {video,root,film,scenes,handoffs,run,wheel,emit,frames};
}
{
 const h=await setup({width:390,height:844});
 assert.equal(h.root.dataset.mediaQuality,'1080p','Phones start with the lighter existing movie');
 assert.ok(h.video.src.includes('hero-compatible.mp4'));
 await h.run(5000);h.film.goTo(SCENE_STOPS[1]);await h.run(2700);
 const time=h.root.dataset.time,seeks=h.video.seeks.length,plays=h.video.plays;
 Object.assign(globalThis,{innerWidth:844,innerHeight:390});h.emit('orientationchange');h.emit('resize');await h.run(50);
 assert.equal(h.root.dataset.time,time,'Rotation retains the displayed scene');
 assert.equal(h.video.seeks.length,seeks,'Rotation never seeks or restarts');assert.equal(h.video.plays,plays);
 Object.assign(globalThis,{innerHeight:340});h.emit('resize');await h.run(50);
 assert.equal(h.root.dataset.time,time,'Browser-bar height changes preserve the scene');
 h.emit('touchstart',{touches:[{clientY:300,clientX:100}]});
 h.emit('touchmove',{touches:[{clientY:250,clientX:100},{clientY:100,clientX:200}]});
 h.emit('touchend',{changedTouches:[{clientY:150,clientX:100}]});await h.run(100);
 assert.equal(h.root.dataset.time,time,'A pinch cannot accidentally advance a scene');
 h.emit('touchstart',{touches:[{clientY:300,clientX:100}]});h.emit('orientationchange');await h.run(50);
 h.emit('touchend',{changedTouches:[{clientY:150,clientX:100}]});await h.run(100);
 assert.equal(h.root.dataset.time,time,'Rotation cancels an unfinished swipe');h.film.dispose();
}
{
 const h=await setup();assert.equal(h.video.paused,false,'intro starts without scrolling');h.wheel(100);
 await h.run(5000);assert.equal(h.root.dataset.mode,'idle');atStop(h.video.currentTime,INTRO_END);assert.equal(h.video.paused,true);
 const initialPlays=h.video.plays;h.wheel(100);await h.run(100);assert.equal(h.video.paused,false,'one wheel begins native forward playback');
 for(let i=0;i<20;i++){h.wheel(100);await h.run(20)}
 await h.run(5000);atStop(h.video.currentTime,SCENE_STOPS[1]);assert.equal(h.root.dataset.mode,'idle');assert.equal(h.video.plays,initialPlays+1,'extra wheel input cannot queue another scene');assert.ok(h.scenes.includes('profile'));
 await h.run(2000);atStop(h.video.currentTime,SCENE_STOPS[1],'holds without continued scrolling');
 h.wheel(100);await h.run(6000);atStop(h.video.currentTime,SCENE_STOPS[2]);assert.ok(h.scenes.includes('front'));
 h.wheel(-100);await h.run(6200);atStop(h.video.currentTime,SCENE_STOPS[1],'upward wheel rewinds one scene');
 h.film.replayIntro();await flush();assert.equal(h.video.paused,false);atStop(h.video.currentTime,0);await h.run(5000);atStop(h.video.currentTime,INTRO_END);
 h.emit('touchstart',{touches:[{clientY:600,clientX:100}]});h.emit('touchend',{changedTouches:[{clientY:450,clientX:105}]});await h.run(5000);atStop(h.video.currentTime,SCENE_STOPS[1],'one upward swipe advances');
 h.emit('keydown',{key:'PageDown',repeat:false});await h.run(6000);atStop(h.video.currentTime,SCENE_STOPS[2],'keyboard advances');
 h.film.dispose();assert.equal(h.video.paused,true);assert.equal(h.frames.size,0);
}
{
 const h=await setup();await h.run(3000);assert.equal(h.root.dataset.mode,'intro','logo intro retains original timing');await h.run(2000);
 for(const target of [SCENE_STOPS[1],SCENE_STOPS[2],SCENE_STOPS[1],SCENE_STOPS[0],SCENE_STOPS[2],SCENE_STOPS[0]]){
  h.film.goTo(target);await h.run(2200);assert.ok(['transition','settling'].includes(h.root.dataset.mode),'input remains locked during the continuous handoff');
  await h.run(500);assert.equal(h.root.dataset.mode,'idle','every forward, reverse, and direct navigation completes within 2–3 seconds');atStop(h.video.currentTime,target);
 }
 h.film.goTo(SCENE_STOPS[1]);await h.run(2700);h.film.replayIntro();await flush();assert.equal(h.video.playbackRate,1,'replay restores normal logo speed');h.film.dispose();
}
{
 const h=await setup({blocked:true});assert.equal(h.root.dataset.mode,'blocked');h.video.block=false;h.film.resume();await flush();await h.run(5000);assert.equal(h.root.dataset.mode,'idle');atStop(h.video.currentTime,INTRO_END);h.film.dispose();
}
{
 const h=await setup({reduce:true});assert.equal(h.video.plays,0);assert.equal(h.root.dataset.mode,'idle');h.wheel(100);for(let i=0;i<30;i++){await h.run(20);h.wheel(100)}assert.equal(h.root.dataset.time,'8.667','one continuous wheel burst advances only one still');h.film.dispose();
}
{
 const h=await setup({error:true});assert.equal(h.root.dataset.fallback,'true');assert.equal(h.root.dataset.mode,'idle');h.film.next();assert.equal(h.root.dataset.time,'8.667');h.film.dispose();
}
{
 const h=await setup();assert.ok(h.video.src.startsWith('./assets/hero-scrub-4k.mp4'),'4K playback uses the asset directly instead of requiring blob playback');h.film.dispose();
 const buffered=await setup({mediaError:source=>!source.startsWith('blob:')});
 assert.equal(buffered.root.dataset.fallback,'false','a native-loading failure retries without leaving the site in still mode');
 assert.equal(buffered.root.dataset.mediaQuality,'4k');assert.equal(buffered.root.dataset.mediaSource,'buffered');buffered.film.dispose();
 const compatible=await setup({mediaError:source=>!source.includes('hero-compatible.mp4')});
 assert.equal(compatible.root.dataset.mediaQuality,'1080p','only failed 4K decoding/loading selects the compatible video');
 assert.equal(compatible.video.paused,false);compatible.film.dispose();
 const failed=await setup({error:true});failed.video.failMedia=()=>false;failed.film.retry();await flush();
 assert.equal(failed.root.dataset.fallback,'false','retry restores video mode without reloading the page');
 assert.equal(failed.video.paused,false);assert.equal(failed.root.dataset.mediaQuality,'4k');failed.film.dispose();
}
{
 const h=await setup({frameCallbacks:true});await h.run(5000);
 assert.equal(h.root.dataset.mode,'idle');assert.equal(h.video.seeks.length,0,'normal decoder stop never performs a corrective seek');
 h.film.goTo(SCENE_STOPS[1]);await h.run(2150);
 assert.equal(h.root.dataset.mode,'settling');const plays=h.video.plays;h.film.goTo(SCENE_STOPS[2]);assert.equal(h.video.plays,plays,'cannot interrupt the image handoff');
 await h.run(500);assert.equal(h.root.dataset.mode,'idle');atStop(h.video.currentTime,SCENE_STOPS[1]);
 assert.equal(h.video.seeks.length,0,'frame-aligned forward playback has no stop-time seek');h.film.dispose();
 assert.ok(h.handoffs.some(h=>h.time===SCENE_STOPS[1]&&!h.paused&&h.mode==='transition'&&h.progress>0),'image handoff starts while the person is still moving, before decoder pause');
}
console.log('PASS: autoplay handoff, one-gesture native playback, input locking, held scenes, reverse, replay, touch, keyboard, blocked autoplay, reduced motion, media failure, cleanup');
