import assert from 'node:assert/strict';
import {filmLayout, CONTENT_FRACTION} from '../lib/film-layout.ts';
for(const [width,height] of [[1440,1024],[1440,778],[1920,1080],[2560,1080],[1366,768],[844,390],[768,1024],[390,844],[375,667],[320,568],[360,800],[412,915],[430,932],[393,852],[600,960],[568,320],[932,430],[915,412],[820,1180]]){
 const fit=filmLayout(width,height,8.7);
 if(width<=600||(width<=1000&&height<=600))assert.equal(fit.compositionScale,1,'Phone text and touch targets use real CSS pixels');
 assert.equal(fit.compositionWidth,width,'UI spans the browser width, without a centered inset artboard');
 assert.equal(fit.compositionHeight,height,'UI uses the available viewport height');
 assert.equal(fit.compositionTop,0,'UI is anchored to the viewport');
 assert.ok(Math.abs(fit.uiWidth*fit.compositionScale-width)<.01,'scaled UI bounds span the complete viewport');
 assert.ok(Math.abs(fit.uiHeight*fit.compositionScale-height)<.01,'footer stays in the viewport');
 assert.ok(Math.abs(fit.artworkWidth/CONTENT_FRACTION/fit.artworkHeight-16/9)<.0001,'the video is never stretched');
 const intro=filmLayout(width,height,0);
 assert.ok(intro.filmWidth<=width+.01&&intro.filmWidth*9/16<=height+.01,'the complete opening logo is visible');
 if(width>=height&&width/height<=1.95)assert.equal(fit.artworkWidth,width,'normal wide screens fill their available width');
}
const figma=filmLayout(1440,1024,8.7);
assert.equal(figma.compositionScale,1);
assert.equal(figma.artworkWidth,1440);
for(const [width,height] of [[320,480],[375,568],[390,654],[390,844],[430,932],[600,960]]){
 const fit=filmLayout(width,height,8.7);
 assert.ok(Math.abs(fit.artworkWidth/width-1.9)<1e-9,'portrait figure keeps the same proportion to the width-based mobile typography');
}
assert.equal(filmLayout(390,654,8.7).artworkWidth,filmLayout(390,844,8.7).artworkWidth,'taller browser viewports do not enlarge only the figure');
console.log('PASS: 19 viewport sizes, portrait/landscape phone text scale, original video proportions and contained intro');
