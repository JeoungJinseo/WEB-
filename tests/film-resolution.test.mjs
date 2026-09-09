import assert from 'node:assert/strict';
import {filmResolution} from '../lib/film-resolution.ts';

for(const [w,h,dpr] of [[1440,1024,2],[2880,1800,2],[390,844,3],[7680,4320,1]]){
  assert.deepEqual(filmResolution(w,h,dpr,16384,16384),{width:w*dpr,height:h*dpr});
}
for(const [w,h,dpr,maxW,maxH] of [[7680,4320,2,16384,16384],[4000,3000,3,4096,4096],[1000,8000,2,16384,4096]]){
  const result=filmResolution(w,h,dpr,maxW,maxH);
  assert.ok(result.width<=maxW&&result.height<=maxH,'respect GPU limits on both axes');
  assert.ok(result.width*result.height<=7680*4320,'bound framebuffer allocation');
  assert.ok(Math.abs(result.width/result.height-w/h)<.002,'retain the viewport aspect ratio');
}
assert.deepEqual(filmResolution(0,0,0,4096,4096),{width:1,height:1});
console.log('PASS: full display density, 5K/6K and DPR 3, GPU bounds, 8K pixel budget, zero-size viewport');
