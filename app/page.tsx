'use client';
import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {mountScrollFilm,createForeground,progressAtTime,type Scene} from '../lib/scroll-film';

function Reveal({children,order=0,className=''}:{children:ReactNode;order?:number;className?:string}) {
 return <span className={`reveal ${className}`} style={{'--order':order} as CSSProperties}><span>{children}</span></span>;
}
function Rolling({children}:{children:string}) {
 return <span className="rolling"><span>{children}</span><span aria-hidden="true">{children}</span></span>;
}
function Collab({red=false}:{red?:boolean}) {
 return <div className="collab"><Reveal><p>2026 DDP YOUNG DESIGNER</p></Reveal><Reveal order={1}><img src={`/assets/collab-${red?'red':'white'}.svg`} alt="GOOBNE X HONGIK UNIVERSITY"/></Reveal></div>;
}
function Team(){return <div className="team"><span><small>Team Leader / Art Director</small> Kim Gwanwu</span><span><small>BRANDING / UX MANAGER</small> JEOUMG JINSEO</span><span><small>INTERACTION / GRAPHIC DESIGNER</small> JEONG JUNYONG</span></div>}
export default function Home() {
 const root=useRef<HTMLElement>(null),video=useRef<HTMLVideoElement>(null),foreground=useRef<HTMLCanvasElement>(null);
 const [scene,setScene]=useState<Scene>('intro'),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!root.current||!video.current||!foreground.current)return;
  const draw=createForeground(foreground.current,video.current);
  const dispose=mountScrollFilm({root:root.current,video:video.current,onScene:setScene,onReady:()=>setReady(true),onError:()=>{setFailed(true);setReady(true)},onFrame:t=>{if(t>=6.6&&t<=11.9)draw()}});
  return ()=>{dispose();draw(true)};
 },[]);
 const jump=(time:number)=>{
  const height=(root.current?.offsetHeight??innerHeight*10)-innerHeight;
  window.scrollTo({top:progressAtTime(time)*height,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
 };
 const intro=scene==='intro',profile=scene==='profile';
 return <main ref={root} className="film-page" data-scene={scene} aria-label="OVEN SAUNA 스크롤 필름">
  <div className="stage">
   <img className="film-poster" src="/assets/intro.jpg" alt=""/>
   <img className="scene-image still-fallback" src={`/assets/${intro?'back':scene}.png`} alt=""/>
   <video ref={video} className="film-media" muted playsInline preload="none" aria-label="OVEN SAUNA — 스크롤에 따라 재생되는 영상"/>
   <div className="scene-shade"/>
   <div className={`profile-wordmark ${profile?'is-active':''}`} aria-hidden="true"><Reveal order={3}><img src="/assets/wordmark-wide.svg" alt=""/></Reveal></div>
   <canvas ref={foreground} className={`film-media foreground ${profile?'is-active':''}`} aria-hidden="true"/>
   <img className="still-cutout" src="/assets/profile-cutout.png" alt=""/>
   <header className={`site-header ${!intro?'is-active':''}`} inert={intro}>
    <a className="brand" href="#intro" onClick={e=>{e.preventDefault();jump(0)}} aria-label="GOOBNE OVEN SAUNA 시작으로"><Reveal><img className="brand-mark" src="/assets/mark.svg" alt=""/></Reveal><span className="brand-type"><Reveal order={1}><strong>GOOBNE OVEN SAUNA</strong></Reveal><Reveal order={2}><small>2026 DDP YOUNG DESIGNER</small></Reveal></span></a>
    <nav className="nav" aria-label="메인 메뉴">
     {([{label:'HOME',time:4.3,id:'back'},{label:'ABOUT',time:14.2,id:'front'},{label:'PROJECT',time:8.7,id:'profile'}] as const).map((item,i)=><Reveal order={i+2} key={item.id}><a className={scene===item.id?'active':''} aria-current={scene===item.id?'location':undefined} href={`#${item.id}`} onClick={e=>{e.preventDefault();jump(item.time)}}><Rolling>{item.label}</Rolling></a></Reveal>)}
     <Reveal order={5}><button disabled title="공간 모델링 페이지 연결 준비 중">SPACE Modeling</button></Reveal>
    </nav>
    <Reveal order={6}><button className="contact pill" disabled title="연락처 연결 준비 중"><Rolling>Contact US</Rolling></button></Reveal>
   </header>
   <section className={`back-copy scene-copy ${scene==='back'?'is-active':''}`} inert={scene!=='back'} aria-hidden={scene!=='back'} data-figma-node="1009:1111">
    <Collab/><h1><Reveal order={3}><img className="hero-wordmark" src="/assets/wordmark.svg" alt="OVEN SAUNA"/></Reveal></h1>
   </section>
   <section className={`profile-copy scene-copy ${profile?'is-active':''}`} inert={!profile} aria-hidden={!profile} data-figma-node="1009:974">
    <div className="project-intro"><h2>{['Every experience','begins at Goobne. We roast','exactly what you crave —','the Goobne way.'].map((line,i)=><Reveal key={line} order={i}>{line}</Reveal>)}</h2><Reveal order={5}><button className="read-more pill" onClick={()=>jump(14.2)}><Rolling>Read more</Rolling></button></Reveal></div>
    <ul className="disciplines">{['Branding','UX Interaction','Motion Graphic','Product Design'].map((label,i)=><li key={label}><Reveal order={i+2}>{label}</Reveal></li>)}</ul>
   </section>
   <section className={`front-copy scene-copy ${scene==='front'?'is-active':''}`} inert={scene!=='front'} aria-hidden={scene!=='front'} data-figma-node="1009:1013">
    <Collab red/><h2 className="sr-only">오븐 사우나 소개</h2><div className="about-body"><p><Reveal order={3}>오븐 사우나는 굽네가 오븐에서 기름을 덜어내는 방식을,</Reveal><Reveal order={4}>사우나에서 땀과 무거움을 비워내는 경험으로 확장한 팝업 공간입니다.</Reveal></p><p><Reveal order={5}>먹는 즐거움과 회복의 감각을 하나로 연결해, 굽네가 지향하는 건강한 식문화를</Reveal><Reveal order={6}>새로운 라이프스타일 경험으로 제안합니다.</Reveal></p></div>
   </section>
   <footer className={`credits ${scene==='back'||scene==='front'?'is-active':''}`} aria-hidden={intro||profile}>
    <Reveal order={6}><p className="motto">SWEAT OUT, GATHER IN</p></Reveal><Reveal order={7}><Team/></Reveal>
   </footer>
   <div className={`corners ${!intro&&!profile?'is-active':''}`} aria-hidden="true"><span className="corner left">{scene==='front'?'SWEAT OUT, GATHER IN':'GOOBNE OVEN SAUNA'}</span><span className="corner right">{scene==='front'?'SWEAT OUT, GATHER IN':'2026 DDP YOUNG DESIGNER'}</span></div>
   <button className={`scroll-hint ${intro?'on-intro':''}`} onClick={()=>jump(scene==='front'?0:scene==='back'?8.7:profile?14.2:4.3)} aria-label={scene==='front'?'처음으로 돌아가기':'다음 장면으로 스크롤'}><span>{!ready?'LOADING FILM':scene==='front'?'BACK TO START':'SCROLL TO EXPLORE'}</span><span className="hint-arrow">{scene==='front'?'↑':'↓'}</span></button>
   {failed&&<p className="media-error" role="status">영상을 불러오지 못해 원본 이미지로 표시합니다. <button onClick={()=>location.reload()}>다시 시도</button></p>}
   <div className="film-progress" aria-hidden="true"><span/></div>
  </div>
  <noscript><div className="no-script"><img src="/assets/back.png" alt="OVEN SAUNA"/><p>스크롤 필름을 보려면 JavaScript를 켜 주세요.</p></div></noscript>
 </main>;
}
