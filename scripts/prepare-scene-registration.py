"""Derive compact motion fields, never alter the supplied PNGs or movie.
Run with numpy/OpenCV installed; pass --ffmpeg to an FFmpeg executable.
Each .bin stores two RGBA8 displacement fields, video->PNG then PNG->video.
"""
import argparse, hashlib, json, subprocess
from pathlib import Path
import cv2
import numpy as np

parser=argparse.ArgumentParser()
parser.add_argument('--ffmpeg',required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
assets=root/'public/assets'
width,height=768,546
map_width,map_height=384,273
limit=.12
cv2.setNumThreads(2)

def gray(rgb):
    red=cv2.GaussianBlur(rgb[:,:,0],(0,0),1.1)/255.
    return np.ascontiguousarray(np.uint8(np.clip(red**.6*255,0,255)))

def field(a,b):
    dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    dis.setFinestScale(0)
    flow=dis.calc(a,b,None)
    return cv2.GaussianBlur(flow,(0,0),1.3)

def pack(flow):
    flow=cv2.resize(flow,(map_width,map_height),interpolation=cv2.INTER_AREA)
    flow/=np.array([width,height],np.float32)
    q=np.rint((np.clip(flow,-limit,limit)+limit)/(2*limit)*65535).astype(np.uint16)
    return np.stack([q[:,:,0]>>8,q[:,:,0]&255,q[:,:,1]>>8,q[:,:,1]&255],axis=-1).astype(np.uint8).tobytes()

def tone_lut(original,reference,backward):
    grid=np.stack(np.meshgrid(np.arange(width),np.arange(height)),axis=-1).astype(np.float32)
    aligned=cv2.remap(reference,grid+backward,None,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
    red=original[:,:,0].astype(float)
    controls=np.array([0,4,8,12,18,26,38,54,76,104,140,180,220,240,255],float)
    colors=[]
    for x in controls:
        mask=(abs(red-x)<=max(2,x*.10))&(abs(aligned[:,:,0].astype(float)-red)<70)
        colors.append(np.median(aligned[mask],axis=0) if np.count_nonzero(mask)>20 else np.array([x,0,0]))
    colors=np.array(colors);colors[0]=0
    colors[:,0]=np.maximum.accumulate(colors[:,0])
    channels=[np.interp(np.arange(256),controls,colors[:,i]) for i in range(3)]
    lut=np.stack(channels+[np.full(256,255)],axis=-1)
    return np.rint(np.clip(lut,0,255)).astype(np.uint8)

report={}
for name,frame in [('back',104),('profile',208),('front',340)]:
    raw=subprocess.check_output([args.ffmpeg,'-v','error','-i',str(assets/'hero-scrub-4k.mp4'),'-vf',f'select=eq(n\\,{frame}),crop=3036:2160:402:0,scale={width}:{height}:flags=lanczos:in_color_matrix=bt709:out_color_matrix=bt709:in_range=tv:out_range=pc','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
    movie=np.frombuffer(raw,np.uint8).reshape(height,width,3)
    original=cv2.cvtColor(cv2.imread(str(assets/f'{name}.png')),cv2.COLOR_BGR2RGB)
    original=cv2.resize(original,(width,height),interpolation=cv2.INTER_AREA)
    a,b=gray(movie),gray(original)
    forward,backward=field(a,b),field(b,a)
    grid=np.stack(np.meshgrid(np.arange(width),np.arange(height)),axis=-1).astype(np.float32)
    warped=cv2.remap(a,grid+backward,None,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
    region=(a<155)|(b<155)
    before=float(np.mean(np.abs(a.astype(float)-b)[region]))
    after=float(np.mean(np.abs(warped.astype(float)-b)[region]))
    output=assets/'registration'/f'{name}.bin'
    lut=tone_lut(original,movie,backward)
    output.write_bytes(pack(forward)+pack(backward)+lut.tobytes())
    report[name]={'frame':frame,'time':frame/24,'width':map_width,'height':map_height,'range':limit,'tone_lut_entries':256,'original_background_rgb':np.median(original[:height//3,:width//4].reshape(-1,3),axis=0).tolist(),'movie_background_rgb':np.median(movie[:height//3,:width//4].reshape(-1,3),axis=0).tolist(),'source_sha256':hashlib.sha256((assets/f'{name}.png').read_bytes()).hexdigest(),'mean_subject_difference_before':round(before,3),'mean_subject_difference_after':round(after,3),'displacement_95px':round(float(np.quantile(np.linalg.norm(forward,axis=2),.95)),3)}
    print(name,report[name],flush=True)
(assets/'registration'/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
