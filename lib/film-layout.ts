export const DESIGN_WIDTH=1440;
export const DESIGN_HEIGHT=1024;
export const CONTENT_FRACTION=3036/3840;

/** UI follows the viewport. Size the film separately so the portrait keeps
 * its proportions while wider screens use the available width. */
export function filmLayout(width:number,height:number,time:number){
 width=Math.max(1,width);height=Math.max(1,height);
 const portrait=width<height;
 // Phones use real CSS pixels and reflowed content, not a miniature desktop.
 // Keep this condition paired with the compact CSS media query.
 const compact=width<=600||(width<=1000&&height<=600);
 const compositionScale=compact?1:portrait?Math.max(.75,Math.min(width/DESIGN_WIDTH,height/DESIGN_HEIGHT)):Math.min(width/DESIGN_WIDTH,height/DESIGN_HEIGHT);
 const compositionHeight=height;
 const compositionWidth=width;
 const compositionTop=0;
 const uiWidth=width/compositionScale,uiHeight=height/compositionScale;
 const artworkWidth=portrait?Math.max(width,Math.min(width*2.1,height*1.1)):Math.min(width,height*1.95);
 const artworkHeight=artworkWidth/CONTENT_FRACTION*9/16;
 // Leave room under the phone navigation. Native footage, held frames and
 // the compositor all use this placement, so a handoff cannot shift the head.
 const phonePortrait=compact&&portrait;
 const phoneOffset=phonePortrait?36:0;
 const baseTop=portrait?height*.06+phoneOffset:Math.min(0,(height-artworkHeight)*.055);
 const front=Math.min(1,Math.max(0,(time-10.8)/3));
 const frontEase=front*front*(3-2*front);
 // The front character is taller; ease its crest below the same navigation.
 const frontTop=phonePortrait?Math.max(baseTop,(height<=560?88:100)+12):!portrait&&width/height>1.5?height*.02:baseTop;
 const artworkTop=baseTop+(frontTop-baseTop)*frontEase;
 const introWidth=Math.min(width,height*16/9);
 const blend=Math.min(1,Math.max(0,(time-3.2)/.7));
 const eased=blend*blend*(3-2*blend);
 const filmWidth=introWidth+(artworkWidth/CONTENT_FRACTION-introWidth)*eased;
 const filmTop=(height-introWidth*9/16)/2*(1-eased)+artworkTop*eased;
 return {compact,compositionScale,compositionWidth,compositionHeight,compositionTop,uiWidth,uiHeight,artworkWidth,artworkHeight,filmWidth,filmTop};
}
