'use client';
import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {mountScrollFilm,type Scene,type FilmMode} from '../lib/scroll-film';
import {createFilmAtmosphere} from '../lib/film-atmosphere';
import {RED_CHANNEL_MATRIX,SOURCE_RED_TABLES} from '../lib/film-color';

function Reveal({children,order=0,className=''}:{children:ReactNode;order?:number;className?:string}) {
 return <span className={`reveal ${className}`} style={{'--order':order} as CSSProperties}><span>{children}</span></span>;
}
function CopyLines({desktop,mobile,order=0,mobileOrder=order}:{desktop:string[];mobile:string[];order?:number;mobileOrder?:number}) {
 return <><span className="desktop-lines">{desktop.map((line,i)=><Reveal key={line} order={order+i}>{line}</Reveal>)}</span><span className="mobile-lines">{mobile.map((line,i)=><Reveal key={line} order={mobileOrder+i}>{line}</Reveal>)}</span></>;
}
function Rolling({children}:{children:string}) {
 return <span className="rolling"><span>{children}</span><span aria-hidden="true">{children}</span></span>;
}
function Collab({red=false}:{red?:boolean}) {
 return <div className="collab"><Reveal><p>2026 DDP YOUNG DESIGNER</p></Reveal><Reveal order={1}><img src={`./assets/collab-${red?'red':'white'}.svg`} alt="GOOBNE X HONGIK UNIVERSITY"/></Reveal></div>;
}
function Team(){return <div className="team">
 <div className="team-row"><span><small>Team Leader / Art Director</small> Kim Gwanwu</span><span><small>BRANDING / UX MANAGER</small> JEOUMG JINSEO</span><span><small>INTERACTION / GRAPHIC DESIGNER</small> JEONG JUNYONG</span></div>
 <div className="team-row secondary"><span><small>Industrial Designer</small> Yoon Ga-won</span><span><small>Industrial Designer</small> Choi Eun-seo</span></div>
 </div>}
export default function Home() {
 const root=useRef<HTMLElement>(null),video=useRef<HTMLVideoElement>(null),foreground=useRef<HTMLCanvasElement>(null),atmosphere=useRef<HTMLCanvasElement>(null);
 const player=useRef<ReturnType<typeof mountScrollFilm>|null>(null);
 const [scene,setScene]=useState<Scene>('intro'),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 const [mode,setMode]=useState<FilmMode>('intro');
 useEffect(()=>{const content=root.current?.querySelector<HTMLElement>('.content-frame');if(content)content.scrollTop=0},[scene]);
 useEffect(()=>{
  if(!root.current||!video.current||!foreground.current||!atmosphere.current)return;
  const ambient=createFilmAtmosphere(root.current,atmosphere.current,foreground.current,video.current);
  const film=mountScrollFilm({root:root.current,video:video.current,onScene:setScene,onMode:mode=>{setMode(mode);ambient.setMode(mode)},onReady:()=>{setReady(true);setFailed(false)},onError:()=>{setFailed(true);setReady(true)},onFrame:ambient.frame,onHandoff:ambient.handoff});
  player.current=film;
  return ()=>{player.current=null;film.dispose();ambient.dispose()};
 },[]);
 const jump=(time:number)=>{
  if(time===0){player.current?.replayIntro();return}
  player.current?.goTo(time);
 };
 const intro=scene==='intro',profile=scene==='profile';
 return <main ref={root} className="film-page" data-scene={scene} aria-label="OVEN SAUNA 장면별 영상">
  <svg width="0" height="0" aria-hidden="true" focusable="false" style={{position:'absolute'}}><defs><filter id="source-red" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values={RED_CHANNEL_MATRIX}/><feComponentTransfer><feFuncR type="table" tableValues={SOURCE_RED_TABLES[0]}/><feFuncG type="table" tableValues={SOURCE_RED_TABLES[1]}/><feFuncB type="table" tableValues={SOURCE_RED_TABLES[2]}/></feComponentTransfer></filter></defs></svg>
  <div className="stage">
   <img className="film-poster" src="./assets/intro.jpg" alt=""/>
   <img className="scene-image still-fallback" src={`./assets/${intro?'back':scene}.png`} alt=""/>
   <video ref={video} className="film-media" muted playsInline preload="none" aria-label="OVEN SAUNA — 인트로 자동 재생 후 한 번 스크롤할 때 다음 장면까지 재생되는 영상"/>
   <canvas ref={atmosphere} className="film-media ambient-film" aria-hidden="true"/>
   <div className="scene-shade"/>
   <div className="composition wordmark-frame"><div className={`profile-wordmark ${profile?'is-active':''}`} aria-hidden="true"><Reveal order={3}><img src="./assets/wordmark-wide.svg" alt=""/></Reveal></div></div>
   <canvas ref={foreground} className={`film-media foreground ${profile?'is-active':''}`} aria-hidden="true"/>
   <div className="composition chrome-frame"><header className={`site-header ${!intro?'is-active':''}`} inert={intro}>
    <a className="brand" href="#intro" onClick={e=>{e.preventDefault();jump(0)}} aria-label="GOOBNE OVEN SAUNA 시작으로"><Reveal><img className="brand-mark" src="./assets/mark.svg" alt=""/></Reveal><span className="brand-type"><Reveal order={1}><strong>GOOBNE OVEN SAUNA</strong></Reveal><Reveal order={2}><small>2026 DDP YOUNG DESIGNER</small></Reveal></span></a>
    <nav className="nav" aria-label="메인 메뉴">
     {([{label:'HOME',time:4.3,id:'back'},{label:'ABOUT',time:14.2,id:'front'},{label:'PROJECT',time:8.7,id:'profile'}] as const).map((item,i)=><Reveal order={i+2} key={item.id}><a className={scene===item.id?'active':''} aria-current={scene===item.id?'location':undefined} href={`#${item.id}`} onClick={e=>{e.preventDefault();jump(item.time)}}><Rolling>{item.label}</Rolling></a></Reveal>)}
     <Reveal order={5}><button disabled title="공간 모델링 페이지 연결 준비 중">SPACE Modeling</button></Reveal>
    </nav>
    <Reveal order={6}><button className="contact pill" disabled title="연락처 연결 준비 중"><Rolling>Contact US</Rolling></button></Reveal>
   </header></div>
   <div className="composition content-frame">
   <section className={`back-copy scene-copy ${scene==='back'?'is-active':''}`} inert={scene!=='back'} aria-hidden={scene!=='back'} data-figma-node="1009:1111">
    <Collab/><h1><Reveal order={3}><img className="hero-wordmark" src="./assets/wordmark.svg" alt="OVEN SAUNA"/></Reveal></h1>
   </section>
   <section className={`profile-copy scene-copy ${profile?'is-active':''}`} inert={!profile} aria-hidden={!profile} data-figma-node="1009:974">
    <div className="project-intro"><h2><CopyLines desktop={['Every experience','begins at Goobne. We roast','exactly what you crave —','the Goobne way.']} mobile={['Every experience','begins at Goobne. We roast','exactly what you crave —','the Goobne way.']}/></h2><Reveal order={5}><button className="read-more pill" onClick={()=>jump(14.2)}><Rolling>Read more</Rolling></button></Reveal></div>
    <ul className="disciplines">{['Branding','UX Interaction','Motion Graphic','Product Design'].map((label,i)=><li key={label}><Reveal order={i+2}>{label}</Reveal></li>)}</ul>
   </section>
   <section className={`front-copy scene-copy ${scene==='front'?'is-active':''}`} inert={scene!=='front'} aria-hidden={scene!=='front'} data-figma-node="1009:1013">
    <Collab red/><h2 className="sr-only">오븐 사우나 소개</h2><div className="about-body"><p><CopyLines order={3} desktop={['오븐 사우나는 굽네가 오븐에서 기름을 덜어내는 방식을,','사우나에서 땀과 무거움을 비워내는 경험으로 확장한 팝업 공간입니다.']} mobile={['오븐 사우나는 굽네가 오븐에서 기름을 덜어내는 방식을,','사우나에서 땀과 무거움을 비워내는 경험으로 확장한 팝업 공간입니다.']}/></p><p><CopyLines order={5} desktop={['먹는 즐거움과 회복의 감각을 하나로 연결해, 굽네가 지향하는 건강한 식문화를','새로운 라이프스타일 경험으로 제안합니다.']} mobile={['먹는 즐거움과 회복의 감각을 하나로 연결해, 굽네가 지향하는 건강한 식문화를','새로운 라이프스타일 경험으로 제안합니다.']}/></p></div>
   </section>
   <footer className={`credits ${scene==='back'||scene==='front'?'is-active':''}`} aria-hidden={intro||profile}>
    <Reveal order={6}><p className="motto">SWEAT OUT, GATHER IN</p></Reveal><Reveal order={7}><Team/></Reveal>
   </footer>
   </div>
   <div className="composition corner-frame"><div className={`corners ${!intro&&!profile?'is-active':''}`} aria-hidden="true"><span className="corner left">GOOBNE OVEN SAUNA</span><span className="corner right">DDP YOUNG DESIGNER</span></div></div>
   <button className={`scroll-hint ${intro?'on-intro':''} ${(mode==='intro'||mode==='transition'||mode==='settling')&&ready?'is-hidden':''}`} disabled={!ready||mode==='intro'||mode==='transition'||mode==='settling'} onClick={()=>mode==='blocked'?player.current?.resume():jump(scene==='front'?0:scene==='back'?8.7:profile?14.2:4.3)} aria-label={mode==='blocked'?'영상 재생':scene==='front'?'인트로부터 다시 재생':'다음 장면 재생'}><span>{!ready?'LOADING FILM':mode==='blocked'?'PLAY FILM':scene==='front'?'BACK TO START':'SCROLL FOR NEXT SCENE'}</span><span className="hint-arrow">{mode==='blocked'?'▶':scene==='front'?'↑':'↓'}</span></button>
   {failed&&<button className="media-error" onClick={()=>{setFailed(false);setReady(false);player.current?.retry()}}>영상 다시 연결</button>}
   <div className="film-progress" aria-hidden="true"><span/></div>
  </div>
  <noscript><div className="no-script"><img src="./assets/back.png" alt="OVEN SAUNA"/><p>스크롤 필름을 보려면 JavaScript를 켜 주세요.</p></div></noscript>
 </main>;
}
