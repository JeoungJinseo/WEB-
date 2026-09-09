import assert from 'node:assert/strict';
import {mountScrollFilm,INTRO_END,SCENE_STOPS} from '../lib/scroll-film.ts';
globalThis.Element=class Element {};
const atStop=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<=.001,message||`Expected ${actual} to hold at ${expected}`);
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
async function setup({reduce=false,blocked=false,error=false}={}){
 let now=1000,rafId=0;const frames=new Map(),events=new EventTarget();
 Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
 Object.assign(globalThis,{innerWidth:1440,innerHeight:900,scrollTo:()=>{},
  matchMedia:()=>Object.assign(new EventTarget(),{matches:reduce}),
  addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),
  requestAnimationFrame:fn=>{frames.set(++rafId,fn);return rafId},cancelAnimationFrame:id=>frames.delete(id),
  fetch:async()=>({ok:!error,blob:async()=>new Blob(['test media'])})});
 class Video extends EventTarget {
  src='';readyState=0;duration=14.333;paused=true;seeking=false;time=0;playbackRate=1;plays=0;block=blocked;seeks=[];
  get currentTime(){return this.time}
  set currentTime(t){this.time=t;this.seeks.push(t);this.seeking=true;queueMicrotask(()=>{this.seeking=false;this.dispatchEvent(new Event('seeked'))})}
  load(){if(!this.src)return;queueMicrotask(()=>{this.readyState=4;this.dispatchEvent(new Event('loadedmetadata'));this.dispatchEvent(new Event('loadeddata'))})}
  async play(){this.plays++;if(this.block)throw new Error('NotAllowedError');this.paused=false}
  pause(){this.paused=true}
  removeAttribute(){this.src=''}
 }
 const video=new Video(),root={dataset:{},style:{setProperty(){}}},scenes=[];
 const film=mountScrollFilm({root,video,onScene:s=>scenes.push(s),onMode:()=>{},onReady:()=>{},onError:()=>{},onFrame:()=>{}});
 await flush();
 const emit=(type,values={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,values);events.dispatchEvent(e)};
 async function run(ms){for(let elapsed=0;elapsed<ms;elapsed+=20){now+=20;if(!video.paused){video.time+=.02*video.playbackRate;video.dispatchEvent(new Event('timeupdate'))}const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(now);await flush()}}
 const wheel=delta=>emit('wheel',{deltaY:delta,deltaX:0,deltaMode:0,ctrlKey:false});
 return {video,root,film,scenes,run,wheel,emit,frames};
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
  h.film.goTo(target);await h.run(2200);assert.equal(h.root.dataset.mode,'transition','scene plays smoothly instead of jumping');
  await h.run(500);assert.equal(h.root.dataset.mode,'idle','every forward, reverse, and direct navigation completes within 2–3 seconds');atStop(h.video.currentTime,target);
 }
 h.film.goTo(SCENE_STOPS[1]);await h.run(2700);h.film.replayIntro();await flush();assert.equal(h.video.playbackRate,1,'replay restores normal logo speed');h.film.dispose();
}
{
 const h=await setup({blocked:true});assert.equal(h.root.dataset.mode,'blocked');h.video.block=false;h.film.resume();await flush();await h.run(5000);assert.equal(h.root.dataset.mode,'idle');atStop(h.video.currentTime,INTRO_END);h.film.dispose();
}
{
 const h=await setup({reduce:true});assert.equal(h.video.plays,0);assert.equal(h.root.dataset.mode,'idle');h.wheel(100);for(let i=0;i<30;i++){await h.run(20);h.wheel(100)}assert.equal(h.root.dataset.time,'8.700','one continuous wheel burst advances only one still');h.film.dispose();
}
{
 const h=await setup({error:true});assert.equal(h.root.dataset.fallback,'true');assert.equal(h.root.dataset.mode,'idle');h.film.next();assert.equal(h.root.dataset.time,'8.700');h.film.dispose();
}
console.log('PASS: autoplay handoff, one-gesture native playback, input locking, held scenes, reverse, replay, touch, keyboard, blocked autoplay, reduced motion, media failure, cleanup');
