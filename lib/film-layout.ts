export const DESIGN_WIDTH=1440;
export const DESIGN_HEIGHT=1024;
export const CONTENT_FRACTION=3036/3840;

/** Fit the complete Figma composition; extend only the background outside it. */
export function filmLayout(width:number,height:number,time:number){
 const compositionScale=Math.min(width/DESIGN_WIDTH,height/DESIGN_HEIGHT);
 const compositionHeight=DESIGN_HEIGHT*compositionScale;
 const compositionWidth=DESIGN_WIDTH*compositionScale;
 const compositionTop=(height-compositionHeight)/2;
 const introWidth=Math.min(width,height*16/9);
 const blend=Math.min(1,Math.max(0,(time-3.2)/.7));
 const eased=blend*blend*(3-2*blend);
 const filmWidth=introWidth+(compositionWidth/CONTENT_FRACTION-introWidth)*eased;
 const filmTop=(height-introWidth*9/16)/2*(1-eased)+compositionTop*eased;
 return {compositionScale,compositionWidth,compositionHeight,compositionTop,filmWidth,filmTop};
}
