import assert from 'node:assert/strict';
import {filmLayout, CONTENT_FRACTION} from '../lib/film-layout.ts';
for(const [width,height] of [[1440,1024],[1440,778],[1920,1080],[2560,1080],[1366,768],[844,390],[768,1024],[390,844],[375,667],[320,568]]){
 const fit=filmLayout(width,height,8.7);
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
console.log('PASS: full viewport UI, original video proportions, width-filling landscape film, contained intro at ten viewport sizes');
