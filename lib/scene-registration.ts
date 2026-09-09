export const MAP_WIDTH=384,MAP_HEIGHT=273,MAP_BYTES=MAP_WIDTH*MAP_HEIGHT*4;
export type Registration={forward:Uint8Array;backward:Uint8Array;tone:Uint8Array};
export type RegisteredStill={image:HTMLImageElement;registration:Registration};
export function parseRegistration(buffer:ArrayBuffer):Registration {
  if(buffer.byteLength!==MAP_BYTES*2+256*4)throw new Error('Invalid scene registration');
  return {forward:new Uint8Array(buffer,0,MAP_BYTES),backward:new Uint8Array(buffer,MAP_BYTES,MAP_BYTES),tone:new Uint8Array(buffer,MAP_BYTES*2,256*4)};
}
export async function loadRegisteredStill(scene:string,signal:AbortSignal):Promise<RegisteredStill>{
  const image=new Image();image.decoding='async';
  const decoded=new Promise<HTMLImageElement>((resolve,reject)=>{
    const clean=()=>{image.onload=null;image.onerror=null;signal.removeEventListener('abort',abort)};
    const abort=()=>{clean();reject(new Error('Scene loading aborted'))};
    image.onload=()=>{void image.decode().then(()=>{clean();resolve(image)},error=>{clean();reject(error)})};
    image.onerror=()=>{clean();reject(new Error('Scene image unavailable'))};
    if(signal.aborted){abort();return}signal.addEventListener('abort',abort,{once:true});
    image.src=`./assets/${scene}.png`;
  });
  const registration=fetch(`./assets/registration/${scene}.bin`,{signal}).then(async response=>{
    if(!response.ok)throw new Error('Scene registration unavailable');
    return parseRegistration(await response.arrayBuffer());
  });
  const [ready,map]=await Promise.all([decoded,registration]);
  return {image:ready,registration:map};
}
