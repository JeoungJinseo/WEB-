import assert from 'node:assert/strict';
import {filmLayout} from '../lib/film-layout.ts';
for(const [width,height] of [[1440,1024],[1920,1080],[2560,1080],[1366,768],[844,390],[768,1024],[390,844],[375,667],[320,568]]){
 const fit=filmLayout(width,height,8.7);
 assert.ok(fit.compositionWidth<=width+.01,'full composition fits horizontally');
 assert.ok(fit.compositionTop>=0&&fit.compositionTop+fit.compositionHeight<=height+.01,'character fits vertically');
 assert.ok(Math.abs(fit.compositionWidth/fit.compositionHeight-1440/1024)<.0001,'Figma proportions are never stretched');
 assert.ok(filmLayout(width,height,0).filmWidth<=width+.01,'opening logo remains contained');
}
const figma=filmLayout(1440,1024,8.7);assert.equal(figma.compositionWidth,1440);assert.equal(figma.compositionHeight,1024);
console.log('PASS: uncropped 1440×1024 composition at nine viewport sizes, fixed proportions, contained intro');
