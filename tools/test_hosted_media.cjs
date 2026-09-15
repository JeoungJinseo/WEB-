const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const context=vm.createContext({Response,Headers,ReadableStream,AbortController,Uint8Array,Error});
vm.runInContext(fs.readFileSync(path.join(root,'dist/media-range.js'),'utf8'),context);
const Range=context.SaunaRange;
const source=Uint8Array.from({length:29},(_,i)=>i),entry={size:29,chunkSize:8,sha256:'test'};
function fakeParts(mode){return async(index,start,end)=>{
  const chunk=source.slice(index*8,(index+1)*8);
  return mode===206?new Response(chunk.slice(start,end+1),{status:206,headers:{'Content-Range':`bytes ${start}-${end}/${chunk.length}`}}):new Response(chunk);
};}
for(const mode of [200,206])for(const [range,start,end,status] of [[null,0,28,200],['bytes=0-1',0,1,206],['bytes=5-23',5,23,206],['bytes=20-',20,28,206],['bytes=-5',24,28,206]]){
  test(`exact bytes across chunk boundaries: upstream ${mode}, range ${range}`,async()=>{
    const request=new Request('https://example.test/movie.mp4',{headers:range?{Range:range}:{}});
    const response=Range.response(request,entry,fakeParts(mode));
    assert.equal(response.status,status);assert.equal(response.headers.get('Content-Length'),String(end-start+1));
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),source.slice(start,end+1));
  });
}
test('HEAD reports the media range without downloading a segment',async()=>{
  const response=Range.response(new Request('https://example.test/movie.mp4',{method:'HEAD',headers:{Range:'bytes=2-12'}}),entry,()=>assert.fail('Unexpected download'));
  assert.equal(response.status,206);assert.equal(response.headers.get('Content-Length'),'11');assert.equal(response.body,null);
});
test('unsatisfiable range returns 416',()=>{
  const response=Range.response(new Request('https://example.test/movie.mp4',{headers:{Range:'bytes=99-'}}),entry,()=>assert.fail());
  assert.equal(response.status,416);assert.equal(response.headers.get('Content-Range'),'bytes */29');
});
test('truncated segment errors instead of showing corrupted video bytes',async()=>{
  const response=Range.response(new Request('https://example.test/movie.mp4'),entry,async()=>new Response(new Uint8Array(1)));
  await assert.rejects(response.arrayBuffer(),/Incomplete/);
});
test('every shipped movie reconstructs to its recorded original SHA-256',()=>{
  const map=JSON.parse(fs.readFileSync(path.join(root,'dist/media-map.json'),'utf8'));
  assert.equal(Object.keys(map).length,24);
  for(const [name,media]of Object.entries(map)){
    const hash=crypto.createHash('sha256');let size=0;
    for(const part of media.parts){
      const object=typeof part!=='string',bytes=fs.readFileSync(path.join(root,'dist',object?part.path:part));
      assert.ok(bytes.length<=4*1024*1024);
      const data=object?bytes.subarray(part.offset,part.offset+part.length):bytes;
      hash.update(data);size+=data.length;
    }
    assert.equal(size,media.size,name);assert.equal(hash.digest('hex'),media.sha256,name);
  }
});
test('worker-blocked browsers assemble the same bytes and release their Blob',async()=>{
  const blobs=new Map();let next=0,released=0,appReady;
  class TestURL extends URL{static createObjectURL(blob){const key='blob:test-'+(++next);blobs.set(key,blob);return key;}static revokeObjectURL(key){blobs.delete(key);released++;}}
  const map={'assets/video/door-v9/test.mp4':{size:3,parts:['a.bin',{path:'b.bin',offset:1,length:1}],sha256:'test'}};
  const ready=new Promise(resolve=>appReady=resolve),window={};
  const ctx=vm.createContext({URL:TestURL,Blob,WeakMap,AbortController,DOMException,Promise,Error,setTimeout,clearTimeout,window,navigator:{},
    document:{currentScript:{src:'https://example.test/media-bootstrap.js'},createElement:()=>({}),body:{append:appReady}},
    fetch:async url=>String(url).includes('media-map')?new Response(JSON.stringify(map)):new Response(Uint8Array.from(String(url).includes('a.bin')?[1,2]:[0,3,9]))});
  vm.runInContext(fs.readFileSync(path.join(root,'dist/media-bootstrap.js'),'utf8'),ctx);await ready;
  const video={},url=await window.saunaMedia.resolve(video,'https://example.test/assets/video/door-v9/test.mp4');
  assert.deepEqual(new Uint8Array(await blobs.get(url).arrayBuffer()),Uint8Array.of(1,2,3));
  assert.equal(await window.saunaMedia.resolve(video,'https://example.test/assets/video/door-v9/test.mp4'),url);
  window.saunaMedia.release(video);assert.equal(blobs.size,0);assert.equal(released,1);
});

for(const mode of [200,206])for(const range of [null,'bytes=0-1','bytes=1-6','bytes=4-','bytes=-2']){
  test(`shared source ranges preserve bytes: upstream ${mode}, range ${range}`,async()=>{
    const storage=[Uint8Array.of(9,1,2,9),Uint8Array.of(0,0,3,4,5,6,7,0)];
    const shared={size:7,sha256:'shared',parts:[{path:'a',offset:1,length:2},{path:'b',offset:2,length:5}]};
    const result=Range.response(new Request('https://example.test/short.mp4',{headers:range?{Range:range}:{}}),shared,async(i,start,end)=>
      mode===200?new Response(storage[i]):new Response(storage[i].slice(start,end+1),{status:206,headers:{'Content-Range':`bytes ${start}-${end}/${storage[i].length}`}}));
    const bounds=Range.bounds(range,7);
    assert.deepEqual(new Uint8Array(await result.arrayBuffer()),Uint8Array.of(1,2,3,4,5,6,7).slice(bounds.start,bounds.end+1));
  });
}
