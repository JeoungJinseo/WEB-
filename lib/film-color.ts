/** User-approved #ED0505 palette. Registration aligns the two sources first;
 * this final palette keeps movie, held PNG and native intro on the same red.
 * The source's red-channel texture is retained through a monotonic curve. */
export const REFERENCE_RED=[237,5,5] as const;
export const RED_CHANNEL_MATRIX='1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 1 0';
function redLevel(red:number){
  if(red<.78)return Math.max(0,red)/.9;
  const t=Math.min(1,(red-.78)/.12);
  // C1-continuous shoulder: retain dark fabric detail, settle the bright
  // backdrop at the exact reference without a hard clipping boundary.
  return .78/.9+.12/.9*(t+t*t-t*t*t);
}
export function restoreSourceRed(rgb:readonly number[]){
  return REFERENCE_RED.map(value=>value*redLevel(rgb[0]/255));
}
export const SOURCE_RED_TABLES=REFERENCE_RED.map(value=>Array.from({length:256},(_,red)=>(value/255*redLevel(red/255)).toFixed(7)).join(' '));
