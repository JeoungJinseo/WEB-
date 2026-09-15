(()=>{
const SCENES = Object.freeze([
  {
    id: 'world', node: '1141:5109', title: '확장된 세계관', titleTop: 672, titleHeight: 136,
    titleWidth: 599, bodyWidth: 650, anchor: 2,
    body: ['굽네의 오븐구이 철학과 사우나의 회복 문화를 결합해,', '먹고 쉬고 함께 머무는 새로운 생활문화로', '브랜드 세계관을 확장합니다.'],
    statement: ['맛있는 한 끼를 넘어, 기분 좋은 쉼까지.', '굽네의 열기가 일상에 새로운 휴식을 더합니다.'],
  },
  {
    id: 'interaction', node: '1141:5438', title: '인터랙션 체험', titleTop: 679, titleHeight: 129,
    titleWidth: 907, bodyWidth: 850, anchor: 12,
    body: ['방문자가 오븐 포토부스에 들어가 사진을 찍고,', '화면 속 인터랙션을 통해 굽네 오븐 사우나의 세계를 직접 체험합니다.', '단순히 보는 전시를 넘어, 참여하고 기록하는 경험으로 설계합니다.'],
    statement: ['맛보는 순간보다, 참여한 순간이 더 오래 남도록,', '굽네 오븐 사우나는 경험으로 완성됩니다.'],
  },
  {
    id: 'objects', node: '1141:5466', title: '사우나 오브제', titleTop: 670, titleHeight: 136,
    titleWidth: 811, bodyWidth: 811, anchor: 22,
    body: ['오븐의 온도계부터 수건, 슬리퍼, 사우나 소품까지 굽네의 브랜드 요소를', '익숙한 찜질방 오브제로 재해석했습니다.', '작은 디테일까지 하나의 세계관 안에서 연결됩니다.'],
    statement: ['오븐의 열기부터 사우나의 소품까지,', '굽네의 세계관을 감각적 경험으로 확장합니다'],
  },
]);

const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
function reveal(text,order){const o=document.createElement('span');o.className='reveal';o.style.setProperty('--order',order);const i=document.createElement('span');i.textContent=text;o.append(i);return o;}
function copyReveals(parent,lines,order){
  lines.forEach((line,i)=>{const r=reveal(line,order+i);r.classList.add('copy-line');parent.append(r);});
  const fluid=reveal(lines.join(' '),order);fluid.classList.add('copy-fluid');parent.append(fluid);
}
const panels=SCENES.map((s,i)=>{const section=document.createElement('section');section.className='scene-panel';section.id=s.id;section.dataset.nodeId=s.node;section.inert=true;section.setAttribute('aria-hidden','true');
const copy=document.createElement('div');copy.className='scene-copy';copy.style.setProperty('--copy-top',`${s.titleTop/1024*100}%`);
const title=document.createElement(i===0?'h1':'h2');title.className='scene-title';title.id=`${s.id}-title`;title.append(reveal(s.title,0));section.setAttribute('aria-labelledby',title.id);
const body=document.createElement('p');body.className='scene-body';copyReveals(body,s.body,2);
const statement=document.createElement('p');statement.className='scene-statement';copyReveals(statement,s.statement,3);
copy.append(title,body);section.append(copy,statement);$('#scene-panels').append(section);return section;});
const compactLayout=matchMedia('(max-width: 900px), (max-aspect-ratio: 1/1), (max-height: 600px)');
function syncReadingMode(){
  const active=panels.find(p=>p.classList.contains('is-active'));
  const overflow=!!active&&compactLayout.matches&&active.scrollHeight>active.clientHeight+2;
  $('#story').dataset.readingOverflow=String(overflow);
  panels.forEach(p=>{const reading=p===active&&overflow;p.tabIndex=reading?0:-1;});
}
const readingResize=new ResizeObserver(syncReadingMode);
panels.forEach(p=>{readingResize.observe(p);readingResize.observe(p.querySelector('.scene-copy'));readingResize.observe(p.querySelector('.scene-statement'));});
compactLayout.addEventListener('change',syncReadingMode);
window.addEventListener('pagehide',e=>{if(!e.persisted){readingResize.disconnect();compactLayout.removeEventListener('change',syncReadingMode);}},{once:true});
const hint=$('#scroll-hint'),debug=$('#debug');debug.hidden=!params.has('debug');
function sceneUI(i){panels.forEach((p,k)=>{p.classList.toggle('is-active',k===i);p.inert=k!==i;p.setAttribute('aria-hidden',String(k!==i));});
if(i<0)return;
$('#story').dataset.scene=String(i);document.querySelectorAll('.poster').forEach((p,k)=>p.classList.toggle('is-current',k===i));
document.querySelectorAll('.nav a[data-scene]').forEach(a=>{const yes=Number(a.dataset.scene)===i;a.classList.toggle('active',yes);if(yes)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
document.title=`${SCENES[i].title} — GOOBNE OVEN SAUNA`;$('#scene-announcement').textContent=`${i+1} / 3. ${SCENES[i].title}`;syncReadingMode();}
requestAnimationFrame(()=>{$('#site-header').classList.add('is-active');$('#site-header').inert=false;});
const start=Math.max(0,Math.min(2,(Number(params.get('scene'))||1)-1));
const controller=new NativeFilm({root:$('#story'),startScene:start,onScene:sceneUI,
onMode(mode){const busy=['loading','preparing','transition','settling'].includes(mode);hint.classList.toggle('is-hidden',busy);hint.disabled=busy;hint.querySelector('.hint-label').textContent=mode==='blocked'?'PLAY FILM':'SCROLL ONCE TO CONTINUE';hint.querySelector('.hint-arrow').textContent=mode==='blocked'?'▶':'↓';},
onStatus(status,label){$('#load-status').textContent=label;$('#load-status').classList.toggle('is-done',!['error','preparing'].includes(status));$('#retry-load').hidden=status!=='error';},
onFrame(s){if(s.mode==='idle'){hint.querySelector('.hint-label').textContent=s.scene===2?'BACK TO START':'SCROLL ONCE TO CONTINUE';hint.querySelector('.hint-arrow').textContent=s.scene===2?'↑':'↓';}if(!debug.hidden)debug.value=JSON.stringify(s,null,2);}});
document.querySelectorAll('a[data-scene]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();controller.goTo(Number(a.dataset.scene));}));
$('#brand-home').addEventListener('click',e=>{e.preventDefault();controller.replay();});
hint.addEventListener('click',()=>{if(controller.mode==='blocked')controller.resume();else if(controller.index===2)controller.goTo(0);else controller.next(1);});
$('#retry-load').addEventListener('click',()=>controller.load());
$('#contact-open').addEventListener('click',()=>{controller.pause();$('#contact-dialog').showModal();});
$('#contact-dialog').addEventListener('close',()=>{controller.resume();});
$('#contact-dialog').addEventListener('click',e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();});
window.__SAUNA_APP__=Object.freeze({getState:()=>controller.getState(),goTo:i=>controller.goTo(i),next:d=>controller.next(d),showScene:i=>controller.showScene(i)});


const atmosphere=new SaunaAtmosphere(controller,document.getElementById('ambient'),document.querySelectorAll('.poster'));
window.__SAUNA_AMBIENT__=atmosphere;
})();
