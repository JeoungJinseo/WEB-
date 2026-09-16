// WebKit can leave decode() pending on a cached large WebP. A loaded image
// with natural dimensions is ready for the one-time texture upload.
function saunaImageReady(image) {
  // Demand-load the full-resolution fallback only when this scene needs it.
  // Inactive posters must not all retain decoded 4320×3072 images at startup.
  if(!image.getAttribute('src')&&image.dataset.src)image.setAttribute('src',image.dataset.src);
  if (image.complete && image.naturalWidth) return Promise.resolve(image);
  return new Promise((resolve,reject)=>{
    const clean=()=>{image.removeEventListener('load',loaded);image.removeEventListener('error',failed);};
    const loaded=()=>{clean();resolve(image);};
    const failed=()=>{clean();reject(Error('장면 이미지를 불러올 수 없습니다.'));};
    image.addEventListener('load',loaded,{once:true});image.addEventListener('error',failed,{once:true});
    if(image.complete){if(image.naturalWidth)loaded();else if(image.getAttribute('src'))failed();}
  });
}
/* Fixed drawing buffers: sharp resting film and soft steam have separate layers.
   Neither canvas changes resolution at a scene boundary. */
class SaunaAtmosphere {
  constructor(film,canvas,posters){
    Object.assign(this,{film,canvas,posters:[...posters],frames:0,photoFrames:0,elapsed:0,poseClock:0,last:0,scene:-1,ready:[false,false,false],failure:null,renderers:[]});
    this.verifyIdle=new URLSearchParams(location.search).get('verify')==='idle';
    this.verifyColor=new URLSearchParams(location.search).get('verify')==='color';
    if(new URLSearchParams(location.search).has('noambient')){canvas.hidden=true;return;}
    this.steam=document.createElement('canvas');this.steam.id='steam-ambient';this.steam.setAttribute('aria-hidden','true');canvas.after(this.steam);
    this.motes=document.createElement('div');this.motes.id='ambient-motes';this.motes.setAttribute('aria-hidden','true');this.steam.after(this.motes);
    [12,24,77,83,92,18,70,87].forEach((x,i)=>{const dot=document.createElement('i');dot.style.cssText=`--x:${x}%;--y:${58+(i%3)*13}%;--duration:${6+i*.57}s;--delay:${-i*1.37}s;--drift:${i%2?21:-16}px`;this.motes.append(dot);});
    canvas.dataset.idleMotion='subtle chest and belly breathing; fixed face, head and neck; leaves, rising steam, floating warm particles';
    canvas.dataset.breathCycleSeconds='4.2–4.68';
    this.steam.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;contain:strict';
    const common=`precision highp float;varying vec2 uv;uniform vec4 frame;uniform float clock,scene,motion;
      float region(vec2 q,vec2 c,vec2 r){return 1.-smoothstep(.40,1.,length((q-c)/r));}
      vec2 body(float s){return s<1.?mix(vec2(.557,.594),vec2(.613,.667),s):mix(vec2(.613,.667),vec2(.471,.548),s-1.);}
      vec2 head(float s){return s<1.?mix(vec2(.567,.269),vec2(.616,.316),s):mix(vec2(.616,.316),vec2(.422,.375),s-1.);}`;
    const photo=common+`uniform sampler2D picture,maskMap;uniform vec4 crop;uniform float alpha;
      void main(){
        vec2 q=(uv-frame.xy)/frame.zw;
        if(any(lessThan(q,vec2(0.)))||any(greaterThan(q,vec2(1.)))){gl_FragColor=vec4(0.);return;}
        q=clamp(q,vec2(.0014),vec2(.9986));
        vec2 b=body(scene),h=head(scene),p=q;
        float torso=1.-smoothstep(.58,1.,length((q-b)/vec2(.238,.282)));
        float face=1.-smoothstep(.52,1.,length((q-h)/vec2(.126,.173)));
        // Keep the head and neck outside the breathing deformation, even
        // where the broad torso falloff overlaps the face in seated poses.
        float neckline=scene<1.?mix(.415,.465,scene):mix(.465,.47,scene-1.);
        torso*=smoothstep(neckline,neckline+.085,q.y)*(1.-face);
        float phase=clock*6.2831853/(4.2+scene*.24);
        // Neutral at arrival, with an immediate smooth inhale, rather than a
        // cosine trough whose first second was almost indistinguishable from rest.
        float breath=sin(phase);
        // Front-facing and seated poses need less expansion than the back view.
        float expansion=scene<.5?1.:.55;
        float lift=scene<.5?1.:.65;
        p-=(q-b)*vec2(.026,.015)*breath*torso*motion*expansion;
        p.y+=.0045*breath*torso*motion*lift;
        float leaf=texture2D(maskMap,q).r*(1.-max(torso,face));
        p.x+=sin(clock*.68+q.y*6.)*.003*leaf*motion;
        p.y+=sin(clock*.53+q.y*9.)*.0012*leaf*motion;
        // Do not displace the wood, feather texture or embedded steam with noise.
        vec3 color=texture2D(picture,(p-crop.xy)/crop.zw).rgb;
        gl_FragColor=vec4(color*alpha,alpha);
      }`;
    const steam=common+`uniform sampler2D grain,maskMap,nextMask;uniform float progress,strength;
      void main(){
        vec2 q=(uv-frame.xy)/frame.zw;
        if(any(lessThan(q,vec2(0.)))||any(greaterThan(q,vec2(1.)))){gl_FragColor=vec4(0.);return;}
        vec3 mask=mix(texture2D(maskMap,q).rgb,texture2D(nextMask,q).rgb,progress);
        float subject=max(region(q,body(scene),vec2(.20,.25)),region(q,head(scene),vec2(.13,.18)));
        vec2 drift=vec2(sin(q.y*7.+clock*.25)*.1,clock*.062);
        float n=texture2D(grain,fract(q*vec2(3.8,2.3)+drift)).r*.68+
          texture2D(grain,fract(q*vec2(7.9,4.7)+drift*1.3)).g*.32;
        float density=smoothstep(.36,.73,n);
        vec2 center=scene<1.?mix(vec2(.84,.55),vec2(.84,.69),scene):mix(vec2(.84,.69),vec2(.68,.64),scene-1.);
        float room=region(q,center,vec2(.24,.42));
        float heater=region(q,vec2(.15,.72),vec2(.16,.36));
        // Keep wisps in film coordinates, including contained mobile frames.
        float foreground=region(q,vec2(.18,.88),vec2(.34,.43))+
          region(q,vec2(.86,.61),vec2(.24,.47))*.75;
        float alpha=min(.12,density*(max(mask.g*.8,max(room*.6,heater*.8))*.46*(1.-subject*.95)+
          foreground*.25*(1.-subject*.4))*strength*.4);
        // Emit premultiplied pixels directly. Transparent steam must carry
        // zero RGB so mobile compositors cannot add a full-screen pale tint.
        gl_FragColor=vec4(vec3(1.,.87,.71)*alpha,alpha);
      }`;
    try{
      this.photo=this.renderer(canvas,photo,['frame','clock','scene','motion','crop','alpha'],['picture','maskMap']);
      this.vapor=this.renderer(this.steam,steam,['frame','clock','scene','motion','progress','strength'],['grain','maskMap','nextMask']);
      this.resize=()=>{
        this.rect=film.pictureRect();
        this.size(this.photo,8294400);this.size(this.vapor,1440000);
        canvas.dataset.renderSize=`${canvas.width}×${canvas.height}`;
        canvas.dataset.layerQuality='fixed full-resolution picture; separate fixed soft-steam buffer';
        this.steam.dataset.renderSize=`${this.steam.width}×${this.steam.height}`;
        const [x,y,w,h]=this.rect;
        this.motes.style.clipPath=`inset(${Math.max(0,y)*100}% ${Math.max(0,1-x-w)*100}% ${Math.max(0,1-y-h)*100}% ${Math.max(0,x)*100}%)`;
        // Resizing the viewport must not replace a captured frame with a
        // different pose. Reuse it whenever its source crop covers the view.
        this.drawnCapture=-1;this.lastPhotoDraw=0;
      };
      this.resize();window.addEventListener('resize',this.resize,{passive:true});
      const load=async url=>{const im=new Image();im.src=url;await saunaImageReady(im);return im;};
      const noise=load('assets/noise.webp').then(im=>this.noise=this.vapor.texture(im,true));
      this.pictures=[];this.masks=[];this.steamMasks=[];
      this.scenePromises=this.posters.map(async(im,i)=>{
        const [mask]=await Promise.all([load(`assets/mask-${['world','interaction','objects'][i]}.webp`),noise]);
        if(this.stopped)return;
        this.masks[i]=this.photo.texture(mask);this.steamMasks[i]=this.vapor.texture(mask);this.ready[i]=true;
      });
      Promise.all(this.scenePromises).catch(e=>this.fail(e));
      film.prepareScene=()=>Promise.all(this.scenePromises);
      film.restingFrameReady=()=>this.stopped||
        (this.lastAlpha===1&&this.drawnCapture===this.captureCount&&this.capturedScene===film.route?.to);

      film.captureFrame=(video,i,crop)=>{
        if(!video.videoWidth||this.stopped)return;
        // Upload once after the native decoder has paused, never on every frame.
        const r=this.photo;r.gl.activeTexture(r.gl.TEXTURE0);
        if(this.capturedTexture){r.gl.deleteTexture(this.capturedTexture);r.textures=r.textures.filter(t=>t!==this.capturedTexture);}
        this.capturedTexture=this.captureTexture(video);this.capturedScene=i;this.capturedCrop=crop;this.poseClock=0;
        // The captured frame replaces the fallback poster on the GPU. Keeping
        // both full-resolution textures retained an unnecessary 70 MB or more.
        this.pictures.forEach((texture,k)=>{if(texture){r.gl.deleteTexture(texture);r.textures=r.textures.filter(t=>t!==texture);this.pictures[k]=null;}});
        this.captureCount=(this.captureCount||0)+1;canvas.dataset.boundaryCaptures=String(this.captureCount);
        // Prime the hidden resting surface before any opacity reveals it.
        this.drawPhoto(i,0);this.drawnCapture=this.captureCount;
        if(this.verifyColor)this.verifyCapture(video,i);
      };
      this.tick=this.tick.bind(this);this.raf=requestAnimationFrame(this.tick);
      window.addEventListener('pagehide',e=>{if(!e.persisted)this.destroy();},{once:true});
    }catch(e){this.fail(e);}
  }
  captureTexture(video){
    // Resolve the paused decoder frame through the browser's sRGB 2D path
    // once. Direct video -> WebGL can use a different YUV/color conversion
    // path; never reapply exposure/gamma to compensate for that difference.
    const snapshot=document.createElement('canvas'),gl=this.photo.gl;
    const scale=Math.min(1,gl.getParameter(gl.MAX_TEXTURE_SIZE)/Math.max(video.videoWidth,video.videoHeight));
    snapshot.width=Math.round(video.videoWidth*scale);snapshot.height=Math.round(video.videoHeight*scale);
    const context=snapshot.getContext('2d',{alpha:false,colorSpace:'srgb'});
    if(!context)throw Error('정지 프레임을 준비할 수 없습니다.');
    try{
      context.drawImage(video,0,0,snapshot.width,snapshot.height);
      this.canvas.dataset.capturePipeline='video → sRGB 2D → RGBA texture';
      return this.photo.texture(snapshot);
    }finally{snapshot.width=1;snapshot.height=1;}
  }
  posterTexture(i){
    if(this.pictures[i])return this.pictures[i];
    // Arrival uses its captured movie frame. Keep only one fallback poster on
    // the GPU instead of three 53 MB copies competing with video surfaces.
    this.pictures.forEach((t,j)=>{if(t){this.photo.gl.deleteTexture(t);this.photo.textures=this.photo.textures.filter(x=>x!==t);this.pictures[j]=null;}});
    return this.pictures[i]=this.photo.texture(this.posters[i]);
  }
  renderer(canvas,fragment,names,samplers){
    const options={alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,powerPreference:'high-performance'};
    const modern=canvas.getContext('webgl2',options);
    const gl=modern||canvas.getContext('webgl',options);
    if(!gl)throw Error('WebGL unavailable');
    if('drawingBufferColorSpace' in gl)gl.drawingBufferColorSpace='srgb';
    if('unpackColorSpace' in gl)gl.unpackColorSpace='srgb';
    const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    let vertex='attribute vec2 p;varying vec2 uv;void main(){uv=vec2((p.x+1.)*.5,1.-(p.y+1.)*.5);gl_Position=vec4(p,0.,1.);}';
    if(modern){
      vertex='#version 300 es\n'+vertex.replace('attribute vec2','in vec2').replace('varying vec2','out vec2');
      fragment='#version 300 es\n'+fragment.replace('varying vec2 uv;','in vec2 uv;out vec4 pixelColor;').replaceAll('texture2D(','texture(').replaceAll('gl_FragColor','pixelColor');
    }
    const shaders=[compile(gl.VERTEX_SHADER,vertex),compile(gl.FRAGMENT_SHADER,fragment)];
    const program=gl.createProgram();shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
    const u={};names.forEach(n=>u[n]=gl.getUniformLocation(program,n));samplers.forEach((n,i)=>gl.uniform1i(gl.getUniformLocation(program,n),i));
    const r={gl,canvas,program,shaders,buffer,u,textures:[],mipmapped:!!modern&&canvas.id==='ambient'};
    canvas.dataset.textureFiltering=r.mipmapped?'trilinear mipmaps':'linear';
    r.texture=(im,repeat=false)=>{
      const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);
      // Filter fine feathers and cotton at the actual screen scale, so subpixel
      // breathing does not alias the full-resolution image into sparkling edges.
      if(r.mipmapped){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
      r.textures.push(t);return t;
    };
    r.bind=textures=>{gl.useProgram(program);textures.forEach((t,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);});};
    r.loss=e=>{e.preventDefault();this.fail(Error('WebGL context lost'));};canvas.addEventListener('webglcontextlost',r.loss);
    this.renderers.push(r);return r;
  }
  size(r,budget){
    const [w,h]=this.film.viewport(),limit=Math.min(r.gl.getParameter(r.gl.MAX_RENDERBUFFER_SIZE),r.gl.getParameter(r.gl.MAX_TEXTURE_SIZE));
    const d=Math.min(devicePixelRatio||1,limit/w,limit/h,Math.sqrt(budget/(w*h)));
    const width=Math.round(w*d),height=Math.round(h*d);
    if(r.canvas.width!==width||r.canvas.height!==height){r.canvas.width=width;r.canvas.height=height;r.gl.viewport(0,0,width,height);}
  }
  captureFits(){
    if(!this.capturedCrop)return false;
    const [x,y,w,h]=this.rect,[cx,cy,cw,ch]=this.capturedCrop;
    const left=Math.max(0,-x/w),top=Math.max(0,-y/h),right=Math.min(1,(1-x)/w),bottom=Math.min(1,(1-y)/h);
    return left>=cx-.001&&top>=cy-.001&&right<=cx+cw+.001&&bottom<=cy+ch+.001;
  }
  drawPhoto(scene,strength){
    const r=this.photo,g=r.gl,u=r.u,captured=this.capturedScene===scene&&this.captureFits();
    r.bind([captured?this.capturedTexture:this.posterTexture(scene),this.masks[scene]]);
    g.uniform4fv(u.frame,this.rect);g.uniform4fv(u.crop,captured?this.capturedCrop:[0,0,1,1]);
    g.uniform1f(u.clock,this.poseClock);g.uniform1f(u.scene,scene);g.uniform1f(u.alpha,1);
    g.uniform1f(u.motion,this.film.reduced?0:strength);g.drawArrays(g.TRIANGLE_STRIP,0,4);
    this.photoFrames++;
    this.canvas.dataset.restFrame=captured?'same-decoded-video-frame':'4320-master-poster';
  }
  verifyCapture(video,scene){
    const r=this.photo,g=r.gl,u=r.u,w=180,h=128,reference=document.createElement('canvas');
    reference.width=w;reference.height=h;
    const ctx=reference.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.drawImage(video,0,0,w,h);
    const expected=ctx.getImageData(0,0,w,h).data,actual=new Uint8Array(w*h*4);
    r.bind([this.capturedTexture,this.masks[scene]]);g.activeTexture(g.TEXTURE0);
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);
    g.uniform4fv(u.frame,[0,0,1,1]);g.uniform4fv(u.crop,[0,0,1,1]);g.uniform1f(u.alpha,1);g.uniform1f(u.motion,0);g.uniform1f(u.scene,scene);
    g.viewport(0,0,w,h);g.drawArrays(g.TRIANGLE_STRIP,0,4);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,actual);
    let sum=0,max=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<3;c++){
      const d=Math.abs(expected[(y*w+x)*4+c]-actual[((h-1-y)*w+x)*4+c]);sum+=d;max=Math.max(max,d);
    }
    this.colorChecks||=[];this.colorChecks.push({scene,meanChannelDifference:sum/(w*h*3),maxChannelDifference:max,sampledPixels:w*h});
    this.canvas.dataset.colorBoundaryChecks=JSON.stringify(this.colorChecks);
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,r.mipmapped?g.LINEAR_MIPMAP_LINEAR:g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
    g.viewport(0,0,this.canvas.width,this.canvas.height);
  }
  verifySteam(scene){
    if(this.steamCheckScene===scene)return;
    this.steamCheckScene=scene;
    const g=this.vapor.gl,c=this.steam,pixels=new Uint8Array(c.width*c.height*4);
    g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,pixels);
    let invalidPremultipliedPixels=0,maxAlpha=0;
    for(let i=0;i<pixels.length;i+=4){
      const a=pixels[i+3];maxAlpha=Math.max(maxAlpha,a);
      if(pixels[i]>a||pixels[i+1]>a||pixels[i+2]>a)invalidPremultipliedPixels++;
    }
    this.steam.dataset.compositingCheck=JSON.stringify({scene,maxAlpha,invalidPremultipliedPixels});
  }
  tick(now){
    if(this.stopped)return;this.raf=requestAnimationFrame(this.tick);
    if(document.hidden||document.querySelector('dialog[open]')){this.last=now;return;}
    const dt=this.last?Math.min(.05,(now-this.last)/1000):1/60;this.last=now;
    const route=this.film.route,i=route?(route.arrivedAt?route.to:route.from):this.film.index,j=route?route.to:i;
    if(!this.ready[i]||!this.ready[j]||!this.noise||this.film.mode==='loading')return;
    this.elapsed+=this.film.reduced?0:dt;this.frames++;
    if((!route||route.arrivedAt)&&!this.film.reduced)this.poseClock+=dt;
    const departure=route?Math.min(1,this.film.routeSeconds()/DEPARTURE_SECONDS):0;
    // First ease breathing back to its neutral pose while the picture stays
    // opaque; only then fade to the identical held native-video frame.
    const neutral=Math.min(1,departure/.7),poseStrength=1-neutral*neutral*(3-2*neutral);
    const fade=route?(route.arrivedAt?Math.min(1,this.film.settleSeconds()/SETTLING_SECONDS):1-Math.min(1,Math.max(0,(departure-.7)/.3))):1;
    const alpha=fade*fade*(3-2*fade);
    // A full-resolution still is simply not drawn while its alpha is zero.
    // The steam layer keeps its own fixed buffer and uninterrupted clock.
    if(this.lastAlpha!==alpha){
      const visibility=alpha>.001?'visible':'hidden';
      for(const layer of [this.canvas,this.steam,this.motes]){layer.style.opacity=String(alpha);layer.style.visibility=visibility;}
      this.lastAlpha=alpha;
    }
    // Freeze the full-resolution picture during the native movie. The compositor
    // fades that one stored surface; do not repaint 8 million pixels each tick.
    const needsPhoto=!route||route.departing||route.arrivedAt;
    if(alpha>.001&&needsPhoto){
      this.lastPhotoDraw=now;
      const onset=Math.min(1,this.poseClock/.65),gain=onset*onset*(3-2*onset);
      this.drawPhoto(i,(route&&!route.arrivedAt?poseStrength:1)*gain);
      if(route?.arrivedAt)route.restingPhotoFrames=(route.restingPhotoFrames||0)+1;
      this.drawnCapture=this.captureCount;
    }
    if(route)this.lastArrival=now;
    const progress=route?Math.min(1,Math.max(0,(this.film.slots[this.film.active].currentTime-route.start)/(route.end-route.start))):0;
    // The movie already contains moving steam. Fade the resting procedural
    // layer out with the photograph, and resume it at arrival. No WebGL draws
    // compete with the 4K native movie during its moving interval.
    if(!route||route.arrivedAt){
    this.vaporCapture=this.captureCount;
    const r=this.vapor,g=r.gl,u=r.u;r.bind([this.noise,this.steamMasks[route?route.from:i],this.steamMasks[j]]);
    g.uniform4fv(u.frame,this.rect);g.uniform1f(u.clock,this.elapsed);g.uniform1f(u.scene,route?route.from+(route.to-route.from)*progress:i);
    g.uniform1f(u.progress,progress);g.uniform1f(u.strength,this.film.reduced?0:1);g.drawArrays(g.TRIANGLE_STRIP,0,4);
    if(this.verifyColor)this.verifySteam(i);
    if(route?.arrivedAt)route.restingSteamFrames=(route.restingSteamFrames||0)+1;
    }
    this.scene=i;
    if(this.verifyIdle&&!route)this.checkIdlePixels(now,i);
    if(!this.fpsWindow){this.fpsWindow=now;this.fpsFrames=this.frames;this.fpsPhotoFrames=this.photoFrames;}
    if(now-this.fpsWindow>=1000){
      this.canvas.dataset.motionFps=String(Math.round((this.frames-this.fpsFrames)*1000/(now-this.fpsWindow)));
      this.canvas.dataset.pictureDrawFps=String(Math.round((this.photoFrames-this.fpsPhotoFrames)*1000/(now-this.fpsWindow)));
      this.canvas.dataset.pictureDraws=String(this.photoFrames);
      this.canvas.dataset.scene=String(i);this.canvas.dataset.motionFrames=String(this.frames);
      this.canvas.dataset.colorPipeline='shared-srgb';this.canvas.dataset.sourceSize='4320×3072';this.canvas.dataset.videoTextureUploads='0';
      this.fpsWindow=now;this.fpsFrames=this.frames;this.fpsPhotoFrames=this.photoFrames;
    }
  }
  checkIdlePixels(now,scene){
    this.idleChecks||=[];
    if(this.idleChecks.some(check=>check.scene===scene))return;
    const sample=(renderer,q)=>{
      const [x,y,w,h]=this.rect,g=renderer.gl,c=renderer.canvas,size=64;
      const px=Math.max(0,Math.min(c.width-size,Math.round((x+q[0]*w)*c.width-size/2)));
      const py=Math.max(0,Math.min(c.height-size,Math.round((1-y-q[1]*h)*c.height-size/2)));
      const pixels=new Uint8Array(size*size*4);g.readPixels(px,py,size,size,g.RGBA,g.UNSIGNED_BYTE,pixels);return pixels;
    };
    if(this.idleSample?.scene===scene&&now-this.idleSample.last<450)return;
    const q=scene===0?[.557,.594]:scene===1?[.613,.667]:[.471,.548];
    const photo=sample(this.photo,q),steam=sample(this.vapor,scene===2?[.68,.64]:[.84,.62]);
    const head=sample(this.photo,[[.567,.269],[.616,.316],[.422,.375]][scene]);
    if(this.idleSample?.scene!==scene){this.idleSample={scene,at:now,last:now,photo,head,steam,bodyMax:0,headMax:0,steamMax:0,samples:1};return;}
    const difference=(a,b,alphaOnly)=>{let sum=0,count=0;for(let k=0;k<a.length;k++){if(alphaOnly?k%4!==3:k%4===3)continue;sum+=Math.abs(a[k]-b[k]);count++;}return sum/count;};
    const s=this.idleSample;s.last=now;s.samples++;
    s.bodyMax=Math.max(s.bodyMax,difference(photo,s.photo,false));
    s.headMax=Math.max(s.headMax,difference(head,s.head,false));
    s.steamMax=Math.max(s.steamMax,difference(steam,s.steam,true));
    if(now-s.at>=4800){
      this.idleChecks.push({scene,elapsedMs:now-s.at,samples:s.samples,bodyMaxMeanChannelChange:s.bodyMax,headMaxMeanChannelChange:s.headMax,steamMaxMeanAlphaChange:s.steamMax});
      this.canvas.dataset.idlePixelChecks=JSON.stringify(this.idleChecks);
    }
  }
  fail(e){this.failure=String(e);this.stopped=true;this.canvas.dataset.error=this.failure;this.canvas.hidden=true;if(this.steam)this.steam.hidden=true;}
  getState(){return {renderer:'native-film-fixed-picture-and-steam-buffers',frames:this.frames,scene:this.scene,width:this.canvas.width,height:this.canvas.height,sourceSize:[4320,3072],failure:this.failure,ready:this.ready};}
  destroy(){this.stopped=true;cancelAnimationFrame(this.raf);window.removeEventListener('resize',this.resize);
    this.motes?.remove();this.steam?.remove();this.renderers.forEach(r=>{const g=r.gl;r.canvas.removeEventListener('webglcontextlost',r.loss);r.textures.forEach(t=>g.deleteTexture(t));r.shaders.forEach(s=>g.deleteShader(s));g.deleteProgram(r.program);g.deleteBuffer(r.buffer);});}
}
