/** Match physical display pixels, independently of the source texture size.
 * Bound the framebuffer to the GPU limits and an 8K pixel budget. */
export function filmResolution(cssWidth:number,cssHeight:number,dpr:number,maxWidth:number,maxHeight:number){
  const width=Math.max(1,cssWidth)*Math.max(1,dpr||1);
  const height=Math.max(1,cssHeight)*Math.max(1,dpr||1);
  const scale=Math.min(1,maxWidth/width,maxHeight/height,Math.sqrt(7680*4320/(width*height)));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
