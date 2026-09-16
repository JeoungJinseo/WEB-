const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const path=require('node:path');

function fixture(){
  let now=1000,dialog=false;
  const timers=new Map(),animationFrames=new Map();let id=0;
  const context=vm.createContext({URL,URLSearchParams,Promise,Math,Error,
    location:{href:'http://127.0.0.1:4318/',search:''},
    performance:{now:()=>now},innerWidth:1440,innerHeight:1024,devicePixelRatio:2,
    document:{hidden:false,querySelector:()=>dialog?{}:null},
    setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:i=>timers.delete(i),
    setInterval:()=>++id,clearInterval:()=>{},
    requestAnimationFrame:fn=>{animationFrames.set(++id,fn);return id;},cancelAnimationFrame:i=>animationFrames.delete(i),
    saunaImageReady:async im=>im});
  vm.runInContext(readFileSync(path.join(__dirname,'../dist/film-hosted-v13.js'),'utf8')+'\nthis.Film=NativeFilm;',context);
  const events=[];
  let current=6.03;
  const video={pause:()=>events.push('pause'),play:async()=>events.push('play'),
    get currentTime(){return current;},set currentTime(t){current=t;events.push(['seek',t]);},
    classList:{remove:()=>{},add:()=>{}},getVideoPlaybackQuality:()=>({totalVideoFrames:363,droppedVideoFrames:0})};
  const film=Object.assign(Object.create(context.Film.prototype),{route:null,disposed:false,epoch:1,
    mode:'idle',index:0,active:0,slots:[video],posters:[{},{}],root:{dataset:{},classList:{remove:()=>{},add:()=>{}}},
    onScene:i=>events.push(['scene',i]),onMode:m=>events.push(['mode',m]),onStatus:()=>{},
    captureFrame:async(v,i)=>events.push(['capture',v.currentTime,i]),
    event:async(v,name,action)=>{action();await Promise.resolve();events.push(name);}});
  const route=()=>({from:0,to:1,start:0,end:6.05,crop:[0,0,1,1],pausedMs:0,frameTimes:[],presentedGaps:[],displayGaps:[],mediaSteps:[]});
  return {film,video,events,route,timers,animationFrames,setImageLoader:fn=>context.saunaImageReady=fn,setNow:n=>now=n,setDialog:b=>dialog=b,setViewport:(w,h,d)=>Object.assign(context,{innerWidth:w,innerHeight:h,devicePixelRatio:d})};
}

test('arrival keeps the movie until the fully opaque resting surface has drawn',()=>{
  const f=fixture();let ready=false;
  f.film.route={...f.route(),started:500,arrivedAt:800};f.film.stats=[];
  f.film.finalDestination=1;f.film.update=()=>{};f.film.restingFrameReady=()=>ready;
  const route=f.film.route;f.film.finish();
  assert.equal(f.film.route,route);assert.equal(f.film.stats.length,0);
  const complete=f.animationFrames.get(f.film.handoffRAF);assert.equal(typeof complete,'function');
  ready=true;complete();
  assert.equal(f.film.route,null);assert.equal(f.film.mode,'idle');
  assert.equal(f.film.stats[0].restingSurfaceReady,true);
});

test('object arrival and reverse departure use the same stable picture before the final jump',()=>{
  const m=JSON.parse(readFileSync(path.join(__dirname,'../dist/assets/video/refined-v11/manifest.json'),'utf8'));
  assert.equal(Math.round(m.anchors[2]*m.fps),223);
  assert.equal(m.frames-1-Math.round(m.reverseAnchors[0]*m.fps),223);
  assert.equal(Math.round(m.anchors[1]*m.fps),m.frames-1-Math.round(m.reverseAnchors[1]*m.fps));
});

test('arrival seeks inside the target frame before capturing; duplicate callbacks capture once',async()=>{
  const f=fixture();f.film.route=f.route();
  const first=f.film.arrive(),second=f.film.arrive();await Promise.all([first,second]);
  assert.deepEqual(f.events.filter(e=>Array.isArray(e)&&e[0]==='capture'),[['capture',6.052,1]]);
  assert.ok(f.events.indexOf('seeked')<f.events.findIndex(e=>Array.isArray(e)&&e[0]==='capture'));
  assert.equal(f.film.mode,'settling');
});

test('an outdated preparation error cannot interrupt a newer route',async()=>{
  const f=fixture();let rejectPreparation;
  f.film.candidates=()=>[{}];f.film.prepare=()=>new Promise((_,reject)=>rejectPreparation=reject);
  const pending=f.film.goTo(1);
  await new Promise(setImmediate);
  assert.equal(typeof rejectPreparation,'function');
  const newer=f.route();f.film.epoch++;f.film.route=newer;f.film.mode='transition';
  rejectPreparation(Error('old decoder failed'));await pending;
  assert.equal(f.film.route,newer);assert.equal(f.film.mode,'transition');
});

test('a callback less than one millisecond before the anchor still seeks inside the target frame',async()=>{
  const f=fixture();f.film.route={...f.route(),end:3.7};f.video.currentTime=3.6994;f.events.length=0;
  await f.film.arrive();
  const captured=f.events.find(e=>Array.isArray(e)&&e[0]==='capture');
  assert.ok(Math.abs(captured[1]-3.702)<.000001);
  assert.ok(f.events.includes('seeked'));
});

test('an already displayed arrival picture is captured without a decoder seek',async()=>{
  const f=fixture();f.film.route={...f.route(),end:3.7};f.film.manifest={fps:30};
  f.video.currentTime=3.712;f.events.length=0;
  await f.film.arrive();
  assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='seek'),false);
  assert.deepEqual(f.events.find(e=>Array.isArray(e)&&e[0]==='capture'),['capture',3.712,1]);
  assert.equal(f.film.route.arrivalSeek,false);
});

test('a bounded clip at EOF retains its last picture without seeking backwards',async()=>{
  const f=fixture();f.film.manifest={fps:30};f.film.route={...f.route(),end:111/30};
  f.video.duration=112/30;f.video.currentTime=f.video.duration;f.events.length=0;
  await f.film.arrive();
  assert.equal(f.film.route.terminalFrame,true);assert.equal(f.film.route.arrivalSeek,false);
  assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='seek'),false);
  assert.equal(f.film.mode,'settling');
});

test('every direction selects a clip whose final picture is its arrival anchor',()=>{
  const f=fixture();f.film.qualityPreference='auto';
  f.film.manifest=JSON.parse(readFileSync(path.join(__dirname,'../dist/assets/video/refined-v11/manifest.json'),'utf8'));
  for(const [from,to] of [[0,1],[1,2],[2,1],[1,0]]){
    const choice=f.film.candidates(from,to)[0];
    const key=(to>from?'forward':'reverse')+(to===1?'-to-interaction':'');
    assert.ok(choice.url.includes('/'+key+'-'));
    assert.ok(Math.abs(choice.end-(f.film.manifest.routeFileFrames[key]-1)/30)<1e-9);
  }
});

test('breathing and steam continue across every arrival handoff frame',()=>{
  const c=vm.createContext({Math,Error,DEPARTURE_SECONDS:.28,SETTLING_SECONDS:.22,requestAnimationFrame:()=>1,document:{hidden:false,querySelector:()=>null}});
  vm.runInContext(readFileSync(path.join(__dirname,'../dist/atmosphere-v12.js'),'utf8')+'\nthis.Atmosphere=SaunaAtmosphere;',c);
  const frames=[];let steamDraws=0;
  const gl={uniform4fv:()=>{},uniform1f:()=>{},drawArrays:()=>steamDraws++};
  const layer=()=>({style:{},dataset:{}});
  const a=Object.assign(Object.create(c.Atmosphere.prototype),{
    stopped:false,last:1000,elapsed:0,poseClock:0,frames:0,photoFrames:0,ready:[true,true,true],noise:{},
    canvas:layer(),steam:layer(),motes:layer(),captureCount:1,drawnCapture:1,vaporCapture:1,
    film:{route:{from:1,to:2,start:3.7,end:7.466,arrivedAt:1000},index:1,reduced:false,active:0,slots:[{currentTime:7.468}],routeSeconds:()=>4,settleSeconds:()=>.1},
    rect:[0,0,1,1],steamMasks:[{},{},{}],vapor:{gl,u:{},bind:()=>{}},
    drawPhoto:(scene,gain)=>frames.push({scene,gain,clock:a.poseClock})
  });
  a.tick(1016);a.tick(1032);
  assert.equal(frames.length,2);assert.equal(steamDraws,2);
  assert.ok(frames[1].clock>frames[0].clock);assert.ok(frames[1].gain>frames[0].gain);
  assert.equal(frames[0].scene,2);
});

test('a route cancelled during asynchronous capture never enters settling',async()=>{
  const f=fixture();f.video.currentTime=6.05;f.events.length=0;f.film.route=f.route();
  let resolveCapture;f.film.captureFrame=()=>new Promise(resolve=>resolveCapture=resolve);
  const pending=f.film.arrive();await new Promise(setImmediate);
  assert.equal(typeof resolveCapture,'function');f.film.route=null;resolveCapture();await pending;
  assert.equal(f.film.mode,'idle');assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='scene'),false);
});

test('resume during capture or while a dialog is open does not restart the movie',async()=>{
  const f=fixture();f.film.route={...f.route(),capturing:true,pausedAt:500};f.film.arm=()=>{};
  await f.film.resume();assert.equal(f.events.includes('play'),false);
  f.film.route.pausedAt=800;f.film.route.capturing=false;f.setDialog(true);
  await f.film.resume();assert.equal(f.events.includes('play'),false);assert.equal(f.film.route.pausedAt,800);
});

test('one wheel gesture advances one scene and ignores inertia during playback',()=>{
  const f=fixture();let moves=0;f.film.next=()=>{moves++;f.film.mode='transition';};
  f.film.acceptedGestures=0;f.film.wheelAt=0;
  const e={deltaY:30,deltaX:0,deltaMode:0,preventDefault:()=>{},target:{closest:()=>null}};
  f.film.wheel(e);f.setNow(1016);f.film.wheel(e);f.setNow(1033);f.film.wheel(e);
  assert.equal(moves,1);f.film.mode='idle';f.setNow(1048);f.film.wheel(e);assert.equal(moves,1);
  f.setNow(1500);f.film.wheel(e);assert.equal(moves,2);
});

test('busy scene navigation does not enqueue competing video seeks',async()=>{
  const f=fixture();f.film.mode='transition';f.film.prepare=()=>{throw Error('unexpected seek');};
  assert.equal(await f.film.goTo(2),false);
});

test('video selection covers physical screen pixels and preserves full 4K on a 4K screen',()=>{
  const f=fixture();f.film.qualityPreference='auto';f.film.manifest={anchors:[0,6.05,16.05],reverseAnchors:[0,10,16.05]};
  f.setViewport(1129,627,2);
  assert.match(f.film.candidates(0,1)[0].url,/forward-to-interaction-landscape-display/);
  f.setViewport(3840,2160,1);
  assert.match(f.film.candidates(0,1)[0].url,/forward-to-interaction-landscape\.mp4/);
  f.setViewport(319,718,2);
  assert.match(f.film.candidates(0,1)[0].url,/forward-to-interaction-balanced-display/);
  assert.deepEqual([...f.film.candidates(0,1)[0].crop],[0,0,1,1]);
  f.film.qualityPreference='max';
  assert.match(f.film.candidates(0,1)[0].url,/forward-to-interaction-4320-hevc\.mp4/);
});

test('prefetch warms one likely route and releases only a completed unused decoder',async()=>{
  const f=fixture();let released=0;const prepared=[];
  const other={dataset:{},getAttribute:()=> 'old-reverse.mp4',pause:()=>{},removeAttribute:()=>released++,load:()=>{}};
  f.film.slots=[f.video,other];f.film.manifest={};f.film.candidates=(a,b)=>[{key:b>a?'forward':'reverse'}];
  f.film.prepare=async(v,c)=>prepared.push(c.key);f.film.index=1;
  f.film.warming=new Map([[1,{done:true,promise:Promise.resolve()}]]);
  f.film.prefetch();await Promise.all([...f.film.warming.values()].map(e=>e.promise));
  assert.deepEqual(prepared,['forward']);assert.equal(released,1);
  f.film.warming.set(1,{done:false,promise:Promise.resolve()});
  f.film.prefetch();await Promise.all([...f.film.warming.values()].map(e=>e.promise));
  assert.equal(released,1,'an unfinished preparation must not be aborted');
});


test('inactive 4K posters release their image sources and retain demand-load URLs',()=>{
  const f=fixture();
  const image=src=>({dataset:{},attrs:{src},getAttribute(k){return this.attrs[k]||null;},removeAttribute(k){delete this.attrs[k];}});
  f.film.posters=[image('world.webp'),image('interaction.webp'),image('objects.webp')];
  f.film.releasePosters(1);
  assert.equal(f.film.posters[0].getAttribute('src'),null);
  assert.equal(f.film.posters[0].dataset.src,'world.webp');
  assert.equal(f.film.posters[1].getAttribute('src'),'interaction.webp');
  assert.equal(f.film.posters[2].getAttribute('src'),null);
  assert.equal(f.film.root.dataset.posterImagesLoaded,'1');
});

test('reduced-motion navigation waits for the target poster before revealing its scene',async()=>{
  const f=fixture();let complete;
  f.film.reduced=true;f.film.update=()=>{};
  f.setImageLoader(()=>new Promise(resolve=>complete=resolve));
  const pending=f.film.goTo(1);await Promise.resolve();
  assert.equal(f.film.mode,'preparing');assert.equal(f.film.index,0);
  assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='scene'),false);
  complete();await pending;
  assert.equal(f.film.mode,'idle');assert.equal(f.film.index,1);
  assert.deepEqual(f.events.find(e=>Array.isArray(e)&&e[0]==='scene'),['scene',1]);
});


test('reading an overflowing mobile chapter does not hijack scroll, keys or touch',()=>{
  const f=fixture();let navigated=0,prevented=0;
  f.film.next=()=>navigated++;f.film.root.dataset.readingOverflow='true';
  const target={closest:s=>s==='.scene-panel.is-active'?{}:null};
  f.film.wheel({target,deltaX:0,deltaY:100,deltaMode:0,preventDefault:()=>prevented++});
  f.film.key({target,key:'PageDown',preventDefault:()=>prevented++});
  f.film.touchStart({target,touches:[{clientX:50,clientY:220}]});
  f.film.touchMove({touches:[{clientX:50,clientY:80}],preventDefault:()=>prevented++});
  f.film.touchEnd({touches:[],changedTouches:[{clientX:50,clientY:80}]});
  assert.equal(navigated,0);assert.equal(prevented,0);
});

test('pinching, button taps and tiny finger movements do not advance a chapter',()=>{
  const f=fixture();let moves=0;f.film.next=()=>moves++;
  const target={closest:()=>null},point=(x,y)=>({clientX:x,clientY:y});
  f.film.touchStart({target,touches:[point(50,200)]});
  f.film.touchMove({touches:[point(50,180),point(80,230)]});
  f.film.touchEnd({touches:[],changedTouches:[point(50,80)]});
  f.film.touchStart({target:{closest:()=>({})},touches:[point(50,200)]});
  f.film.touchEnd({touches:[],changedTouches:[point(50,80)]});
  f.film.touchStart({target,touches:[point(50,200)]});
  f.film.touchEnd({touches:[],changedTouches:[point(50,182)]});
  assert.equal(moves,0);
  f.film.touchStart({target,touches:[point(50,200)]});
  f.film.touchEnd({touches:[],changedTouches:[point(55,100)]});
  assert.equal(moves,1);
});

test('rotation uses the visible stage size without resetting the current route',()=>{
  const f=fixture();const route=f.route();f.film.route=route;
  f.film.root.style={setProperty:()=>{}};
  f.film.root.clientWidth=390;f.film.root.clientHeight=844;
  f.film.qualityPreference='auto';f.film.manifest={anchors:[0,3.7,7.433],reverseAnchors:[.033,3.766,7.466]};
  f.film.layout();assert.match(f.film.candidates(0,1)[0].url,/balanced/);
  f.film.root.clientWidth=844;f.film.root.clientHeight=390;
  f.film.layout();assert.match(f.film.candidates(0,1)[0].url,/balanced/);
  assert.equal(f.film.route,route);assert.equal(f.film.index,0);
  assert.equal(f.events.length,0,'layout must not seek, restart or navigate');
});

test('portrait delivery preserves all edges and covers rendered physical pixels',()=>{
  const f=fixture();f.setViewport(430,932,3);f.film.qualityPreference='auto';
  f.film.manifest={anchors:[0,3.7,7.433],reverseAnchors:[.033,3.766,7.466]};
  const media=JSON.parse(readFileSync(path.join(__dirname,'../dist/media-map.json'),'utf8'));
  for(const [from,to] of [[0,1],[1,2],[2,1],[1,0]]){
    const choices=f.film.candidates(from,to);
    assert.match(choices[0].url,/balanced-display/);
    assert.deepEqual([...choices[0].crop],[0,0,1,1]);
    const [,,w,h]=f.film.pictureRect();
    assert.ok(2160>=w*430*3&&1536>=h*932*3);
    for(const choice of choices)assert.ok(media[choice.url.split('?')[0]],choice.url);
  }
  f.film.qualityPreference='max';assert.match(f.film.candidates(0,1)[0].url,/4320-hevc/);
  f.film.hevcUnsupported=true;assert.match(f.film.candidates(0,1)[0].url,/balanced\.mp4/);
});

test('native video and idle picture share the full mobile film box, including letterboxing',()=>{
  const f=fixture();f.setViewport(390,844,3);
  f.film.root.getBoundingClientRect=()=>({left:0,top:0});
  f.film.root.querySelector=()=>({getBoundingClientRect:()=>({left:0,top:110,width:390,height:260})});
  const [x,y,w,h]=f.film.pictureRect();
  assert.ok(x>=0&&x+w<=1&&y>=0&&y+h<=1);
  assert.ok(Math.abs(w*390/(h*844)-45/32)<1e-9);
  assert.ok(Math.abs(y*844-110)<1e-9);assert.ok(Math.abs(h*844-260)<1e-9);
  assert.ok(x>0,'contain adds side margins when the box is shorter than the movie');
});

test('a full captured frame remains usable in a contained viewport',()=>{
  const c=vm.createContext({});
  vm.runInContext(readFileSync(path.join(__dirname,'../dist/atmosphere-v12.js'),'utf8')+'\nthis.Atmosphere=SaunaAtmosphere;',c);
  const a=Object.assign(Object.create(c.Atmosphere.prototype),{rect:[.02,.15,.96,.32],capturedCrop:[0,0,1,1]});
  assert.equal(a.captureFits(),true);
  a.capturedCrop=[.3,0,.4,1];assert.equal(a.captureFits(),false,'a portrait crop cannot replace the complete composition');
});

test('arrival normalizes once through an sRGB canvas before texture upload and frees the canvas',()=>{
  const calls=[],video={videoWidth:3240,videoHeight:2304},snapshot={};
  snapshot.getContext=(type,options)=>{calls.push([type,options]);return {drawImage:(...args)=>calls.push(['draw',...args])};};
  const c=vm.createContext({document:{createElement:()=>snapshot}});
  vm.runInContext(readFileSync(path.join(__dirname,'../dist/atmosphere-v12.js'),'utf8')+'\nthis.Atmosphere=SaunaAtmosphere;',c);
  const a=Object.assign(Object.create(c.Atmosphere.prototype),{canvas:{dataset:{}},photo:{
    gl:{MAX_TEXTURE_SIZE:1,getParameter:()=>8192},texture:source=>{assert.equal(source,snapshot);assert.equal(source.width,3240);assert.equal(source.height,2304);return 'normalized-texture';}
  }});
  assert.equal(a.captureTexture(video),'normalized-texture');
  assert.equal(calls[0][0],'2d');assert.equal(calls[0][1].colorSpace,'srgb');
  assert.deepEqual(calls[1],['draw',video,0,0,3240,2304]);
  assert.equal(snapshot.width,1);assert.equal(snapshot.height,1);
});
