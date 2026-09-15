/* Assemble byte ranges without decoding or re-encoding the movie. */
(()=>{
  function bounds(value,size){
    if(!value||!value.startsWith('bytes=')||value.includes(','))return {start:0,end:size-1,partial:false};
    const m=/^bytes=(\d*)-(\d*)$/.exec(value);
    if(!m||(!m[1]&&!m[2]))return null;
    let start,end;
    if(!m[1]){const suffix=Number(m[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return null;start=Math.max(0,size-suffix);end=size-1;}
    else{start=Number(m[1]);end=m[2]?Number(m[2]):size-1;}
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return null;
    return {start,end:Math.min(size-1,end),partial:true};
  }
  function response(request,entry,fetchPart){
    const etag='"'+entry.sha256+'"',ifRange=request.headers.get('If-Range');
    const range=bounds(ifRange&&ifRange!==etag?null:request.headers.get('Range'),entry.size);
    const headers=new Headers({'Content-Type':'video/mp4','Accept-Ranges':'bytes','ETag':etag,'Cache-Control':'public, max-age=31536000, immutable'});
    if(!range){headers.set('Content-Range','bytes */'+entry.size);return new Response(null,{status:416,headers});}
    const {start,end,partial}=range;headers.set('Content-Length',String(end-start+1));
    if(partial)headers.set('Content-Range',`bytes ${start}-${end}/${entry.size}`);
    const abort=new AbortController();let cursor=start;
    let position=0;
    const layout=entry.parts?.map((part,index)=>{
      const length=typeof part==='string'?Math.min(entry.chunkSize,entry.size-position):part.length;
      const segment={index,start:position,end:position+length,offset:typeof part==='string'?0:part.offset};
      position+=length;return segment;
    });
    const body=request.method==='HEAD'?null:new ReadableStream({
      async pull(controller){
        if(cursor>end){controller.close();return;}
        try{
          const segment=layout?.find(part=>cursor>=part.start&&cursor<part.end);
          if(layout&&!segment)throw Error('Invalid video layout');
          const index=segment?segment.index:Math.floor(cursor/entry.chunkSize);
          const logicalStart=segment?segment.start:index*entry.chunkSize;
          const sourceOffset=segment?segment.offset:0;
          const offset=sourceOffset+cursor-logicalStart;
          const last=sourceOffset+Math.min((segment?segment.end:logicalStart+entry.chunkSize)-1,end)-logicalStart;
          const res=await fetchPart(index,offset,last,abort.signal);
          if(!res.ok)throw Error('Video segment unavailable');
          const bytes=new Uint8Array(await res.arrayBuffer());
          let piece;
          if(res.status===206){
            const expected=`bytes ${offset}-${last}/`;
            if(!res.headers.get('Content-Range')?.startsWith(expected))throw Error('Invalid video byte range');
            piece=bytes;
          }else piece=bytes.subarray(offset,last+1);
          if(piece.byteLength!==last-offset+1)throw Error('Incomplete video segment');
          controller.enqueue(piece);cursor+=piece.byteLength;
        }catch(error){controller.error(error);}
      },
      cancel(){abort.abort();}
    });
    return new Response(body,{status:partial?206:200,headers});
  }
  globalThis.SaunaRange={bounds,response};
})();
