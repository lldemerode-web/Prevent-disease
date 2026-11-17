'use strict';
// Outbreak Zero 2.0 — fictional strategy model, not public-health forecasting.
const DATA=[
['New York','N. America',175,150,20],['Los Angeles','N. America',125,160,34],['Chicago','N. America',145,140,24],['Toronto','N. America',155,126,18],['Mexico City','N. America',125,190,22],['Vancouver','N. America',105,107,11],['Miami','N. America',173,180,14],['San Francisco','N. America',100,151,12],
['São Paulo','S. America',265,295,22],['Rio de Janeiro','S. America',278,306,13],['Buenos Aires','S. America',255,364,16],['Lima','S. America',195,282,12],['Bogotá','S. America',198,240,12],['Santiago','S. America',214,354,10],
['London','Europe',455,113,15],['Paris','Europe',466,129,13],['Berlin','Europe',494,117,12],['Madrid','Europe',446,153,10],['Rome','Europe',488,154,10],['Moscow','Europe',550,99,16],['Istanbul','Europe',543,163,16],['Stockholm','Europe',494,90,7],
['Cairo','Africa',517,201,13],['Lagos','Africa',462,246,21],['Nairobi','Africa',544,278,11],['Johannesburg','Africa',535,351,11],['Casablanca','Africa',430,186,9],['Addis Ababa','Africa',540,248,8],
['Mumbai','Asia',666,228,22],['Delhi','Asia',673,194,22],['Beijing','Asia',780,157,22],['Shanghai','Asia',802,188,24],['Tokyo','Asia',849,178,19],['Seoul','Asia',825,164,13],['Bangkok','Asia',742,246,12],['Singapore','Asia',754,284,9],['Jakarta','Asia',778,318,19],['Dubai','Asia',614,216,9],
['Sydney','Oceania',877,375,11],['Melbourne','Oceania',866,401,9]
];
const DISEASES=[{name:'Crimson Fever',color:'#f06b77',beta:.39,latent:3,infectious:8,severe:.055,fatal:.005,travel:.5},{name:'Blue Lung',color:'#5bb8f7',beta:.31,latent:5,infectious:11,severe:.10,fatal:.009,travel:1.3}];
const fmt=n=>Math.round(n).toLocaleString('en-US');
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const $=id=>document.getElementById(id);
let game,interval=null,lastTick=0;
function makeGame(){const cities=DATA.map(([name,region,x,y,pop],id)=>({id,name,region,x,y,pop:pop*100000,testing:0,prevention:0,hospitals:0,screening:0,restrictions:0,build:0,dead:0,reported:[0,0],d:DISEASES.map(()=>({s:pop*100000,e:0,i:0,r:0}))}));
  for(const [id,d,n] of [[1,0,2600],[28,1,1900]]){cities[id].d[d].i=n;cities[id].d[d].s-=n;cities[id].d[d].e=n*2;cities[id].d[d].s-=n*2;}
  return {cities,day:1,budget:220,income:9,trust:78,economy:100,paused:true,speed:1,selected:1,policy:0,research:[0,0],researchSpend:[0,0],researchBoost:[0,0],events:['Day 1: Two unrelated outbreaks detected in Los Angeles and Mumbai.'],stable:0,over:false};}
function note(msg,alert=false){game.events.unshift(`Day ${game.day}: ${alert?'⚠ ':''}${msg}`);game.events.length=Math.min(game.events.length,18);}
function popTotal(){return game.cities.reduce((a,c)=>a+c.pop,0)}
function stats(){let active=0,confirmed=0,dead=0,hospital=0,capacity=0;for(const c of game.cities){dead+=c.dead;capacity+=Math.round(c.pop*.0014)+c.hospitals*600;for(let j=0;j<2;j++){active+=c.d[j].i+c.d[j].e;confirmed+=c.reported[j];hospital+=c.d[j].i*DISEASES[j].severe;}}return {active,confirmed,dead,hospital,capacity};}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function dayStep(){if(game.over)return;game.day++;
  // Each city maintains two independent simplified SEIR compartments. Imported exposures are computed from the previous day's state.
  const incoming=game.cities.map(()=>[0,0]);
  for(let a=0;a<game.cities.length;a++)for(let b=0;b<game.cities.length;b++){if(a===b)continue;const src=game.cities[a],dst=game.cities[b],dist=distance(src,dst),travel=(dist<150?.00014:.000042)*(src.pop/1000000)/(1+dist/190);for(let j=0;j<2;j++){const prev=src.d[j],infectious=prev.i/src.pop;const restriction=(1-src.restrictions*.25)*(1-dst.screening*.15)*(1-game.policy*.15);incoming[b][j]+=infectious*dst.pop*travel*DISEASES[j].travel*restriction*45;}}
  let totalNew=0,totalDeaths=0,overloaded=0;
  for(const c of game.cities){const cap=c.pop*.0014+c.hospitals*600;const occupancy=c.d.reduce((a,d,j)=>a+d.i*DISEASES[j].severe,0);const load=occupancy/Math.max(1,cap);if(load>1)overloaded++;
    for(let j=0;j<2;j++){const d=c.d[j],p=DISEASES[j];const prevention=clamp(1-c.prevention*.11-c.restrictions*.12-game.policy*.12-game.researchBoost[j]*.1,.18,1);const newE=Math.min(d.s,Math.max(0,d.s*p.beta*d.i/c.pop*prevention+incoming[c.id][j]));const newI=d.e/p.latent;const leaving=d.i/p.infectious;const fatal=clamp(p.fatal*(load>1?1+Math.min(3,load-1)*1.6:1)*(1-game.researchBoost[j]*.22),.0002,.15);const deaths=Math.min(leaving,leaving*fatal);d.s=Math.max(0,d.s-newE);d.e=Math.max(0,d.e+newE-newI);d.i=Math.max(0,d.i+newI-leaving);d.r+=leaving-deaths;c.dead+=deaths;totalDeaths+=deaths;totalNew+=newE;
      const detection=clamp(.06+c.testing*.09+.04*game.researchBoost[j],.06,.9);c.reported[j]=Math.round(d.i*detection);
    }
    if(c.build>0){c.build--;if(c.build===0){c.hospitals++;note(`New hospital capacity opened in ${c.name}.`);}}
  }
  game.budget+=game.income*game.economy/100-game.policy*2-game.researchSpend.reduce((a,b)=>a+b,0);game.budget=Math.round(game.budget*10)/10;
  for(let j=0;j<2;j++){game.research[j]=Math.min(100,game.research[j]+game.researchSpend[j]*.75);const level=Math.floor(game.research[j]/25);if(level>game.researchBoost[j]){game.researchBoost[j]=level;note(`${DISEASES[j].name} research breakthrough — level ${level}.`);}}
  game.economy=clamp(game.economy-game.policy*.35-game.cities.reduce((a,c)=>a+c.restrictions,0)*.016+(.22-game.policy*.07),0,100);
  game.trust=clamp(game.trust+(game.policy===0?.13:-.09*game.policy)-Math.min(.65,totalDeaths/2000)-Math.max(0,overloaded-2)*.035,0,100);
  if(game.day%10===0){const s=stats();note(`${fmt(s.active)} estimated active infections; ${overloaded} cities have overloaded hospitals.`,overloaded>0);}
  if(game.day%17===0&&game.day>5){const id=(game.day*7)%game.cities.length;note(`Regional report: ${game.cities[id].name} requests additional medical support.`,true);}
  const s=stats();game.stable=s.active<1000?game.stable+1:0;
  if(game.stable>=14){game.over=true;game.paused=true;note('VICTORY: Both outbreaks contained for 14 days!');}
  else if(game.trust<=0||game.economy<=0||s.dead>popTotal()*.02){game.over=true;game.paused=true;note('GAME OVER: The international response has collapsed.',true);}
  if(game.budget<0){game.trust=clamp(game.trust-.5,0,100);game.budget=Math.max(game.budget,-1000);}
  render();}
function pay(cost){if(game.over||game.budget<cost)return false;game.budget=Math.round((game.budget-cost)*10)/10;return true;}
function action(type,id){const c=game.cities[id];if(!c)return;const choices={test:[18,3,'Testing expanded'],prevent:[25,3,'Prevention campaign launched'],hospital:[48,3,'Hospital construction started'],screen:[20,2,'Airport screening increased'],restrict:[12,2,'Local restrictions introduced']};const [cost,limit,msg]=choices[type];if(type==='hospital'&&c.build){note(`${c.name} already has a hospital under construction.`);render();return;}if(type!=='hospital'&&c[type==='test'?'testing':type==='prevent'?'prevention':type==='screen'?'screening':'restrictions']>=limit)return;
  if(!pay(cost)){note('Insufficient emergency funds.',true);render();return;}
  if(type==='hospital')c.build=6;else c[{test:'testing',prevent:'prevention',screen:'screening',restrict:'restrictions'}[type]]++;
  if(type==='restrict'){game.trust=clamp(game.trust-2,0,100);game.economy=clamp(game.economy-1,0,100);}note(`${msg} in ${c.name} (−$${cost}M).`);render();}
function changeResearch(j,amount){game.researchSpend[j]=amount;note(`${DISEASES[j].name} research allocation set to $${amount}M/day.`);render();}
function changePolicy(){game.policy=(game.policy+1)%4;game.trust=clamp(game.trust-(game.policy?2:0),0,100);note(`Global restrictions: ${['none','advisory','moderate','strong'][game.policy]}.`);render();}
function render(){const s=stats();$('metrics').innerHTML=[['Day',game.day,game.over?'GAME ENDED':game.paused?'Paused':game.speed+'× speed'],['Estimated active',fmt(s.active),'Includes undetected'],['Confirmed active',fmt(s.confirmed),'Testing-dependent'],['Hospital load',`${Math.round(s.hospital/s.capacity*100)}%`,`${fmt(s.hospital)} / ${fmt(s.capacity)}`],['Budget',`$${game.budget.toFixed(1)}M`,`+$${(game.income*game.economy/100).toFixed(1)}M/day before costs`],['Trust / Economy',`${Math.round(game.trust)}% / ${Math.round(game.economy)}%`,`Deaths: ${fmt(s.dead)}`]].map(([a,b,c])=>`<div class="metric"><small>${a}</small><strong>${b}</strong><div class="sub">${c}</div></div>`).join('');
  $('pause').textContent=game.over?'Game ended':game.paused?'▶ Resume':'Ⅱ Pause';$('pause').disabled=game.over;$('speed').value=String(game.speed);$('dayLabel').textContent=`Day ${game.day} · ${game.over?'ENDED':game.paused?'PAUSED':'LIVE'}`;
  document.querySelectorAll('.city').forEach(el=>{const c=game.cities[+el.dataset.id];const a=c.d[0].i+c.d[0].e,b=c.d[1].i+c.d[1].e;const color=a>100&&b>100?'#edc768':a>b?'#f06b77':b>0?'#5bb8f7':'#55a68e';const size=4+Math.min(10,Math.log10(1+a+b)*1.1);const circle=el.querySelector('circle');circle.setAttribute('fill',color);circle.setAttribute('r',size);el.classList.toggle('selected',c.id===game.selected);});
  $('events').innerHTML=game.events.map(e=>`<div class="event ${e.includes('⚠')?'alert':''}">${e}</div>`).join('');const c=game.cities[game.selected];$('cityTitle').textContent=c.name;$('regionName').textContent=c.region;
  const capacity=c.pop*.0014+c.hospitals*600;const occupied=c.d.reduce((a,d,j)=>a+d.i*DISEASES[j].severe,0);let html=`<div class="detailGrid"><div class="detail"><label>Population</label><b>${fmt(c.pop)}</b></div><div class="detail"><label>Hospital occupancy</label><b>${Math.round(occupied/capacity*100)}%</b></div><div class="detail"><label>Estimated deaths</label><b>${fmt(c.dead)}</b></div><div class="detail"><label>Capacity</label><b>${fmt(capacity)}</b></div></div>`;
  for(let j=0;j<2;j++){const d=c.d[j],p=DISEASES[j];html+=`<div class="disease" style="border-color:${p.color}"><b>${p.name}</b><div>Estimated active: ${fmt(d.i+d.e)} · Confirmed: ${fmt(c.reported[j])}</div><div>Exposed: ${fmt(d.e)} · Infectious: ${fmt(d.i)} · Recovered: ${fmt(d.r)}</div></div>`;}
  const actions=[['test','Expand testing',18,c.testing,3],['prevent','Prevention campaign',25,c.prevention,3],['hospital','Build hospital (6 days)',48,c.hospitals,Infinity],['screen','Travel screening',20,c.screening,2],['restrict','Local restrictions',12,c.restrictions,2]];
  html+=`<h3>City response</h3>`+actions.map(([id,label,cost,level,max])=>`<div class="action"><span>${label}<br><span class="hint">${id==='hospital'?c.build?`Building: ${c.build} days left`:`Built: ${level}`:`Level ${level}/${max}`}</span></span><button data-action="${id}" ${game.over||game.budget<cost||level>=max||id==='hospital'&&c.build?'disabled':''}>$${cost}M</button></div>`).join('');$('cityDetails').innerHTML=html;
  document.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=()=>action(btn.dataset.action,game.selected));
  $('research').innerHTML=DISEASES.map((p,j)=>`<div class="disease" style="border-color:${p.color}"><b>${p.name}</b> — ${game.research[j].toFixed(0)}%<div class="progress"><i style="width:${game.research[j]}%"></i></div><div class="hint">Research level ${game.researchBoost[j]}/4 · Daily funding $${game.researchSpend[j]}M</div><div class="controls">${[0,3,6,10].map(n=>`<button data-research="${j}" data-amount="${n}" ${game.researchSpend[j]===n?'class="primary"':''}>$${n}M/d</button>`).join('')}</div></div>`).join('');document.querySelectorAll('[data-research]').forEach(btn=>btn.onclick=()=>changeResearch(+btn.dataset.research,+btn.dataset.amount));
  $('policy').innerHTML=`<div class="action"><span>Global travel policy<br><span class="hint">${['No restrictions','Advisory','Moderate restrictions','Strong restrictions'][game.policy]} · More restrictions cost trust and economic output</span></span><button id="policyBtn" ${game.over?'disabled':''}>Change</button></div><p class="hint">Contained days: ${game.stable}/14 · Estimated global deaths: ${fmt(s.dead)} · ${game.budget<0?'WARNING: Budget deficit damages trust.':'All costs are in fictional $ millions.'}</p>`;$('policyBtn').onclick=changePolicy;
}
function drawMap(){const svg=$('worldMap');const ns='http://www.w3.org/2000/svg';const add=(tag,attrs,parent=svg)=>{const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;};
  // Schematic continent shapes are intentionally illustrative, not geographic boundaries.
  const shapes=['M65 87 L123 64 181 80 220 115 195 160 160 173 145 211 109 192 91 140 Z','M191 222 L257 219 302 257 288 302 258 386 233 420 209 354 197 278 Z','M419 99 L468 79 530 95 552 130 530 165 482 169 449 144 Z','M434 183 L524 176 572 230 561 314 526 379 481 350 457 273 Z','M540 91 L624 63 748 79 847 110 879 171 846 216 791 235 778 287 731 294 701 251 639 235 603 191 556 168 Z','M830 337 L898 336 934 374 901 415 857 406 Z'];for(const d of shapes)add('path',{d,class:'land'});
  for(let i=0;i<DATA.length;i++){const a=DATA[i];const near=DATA.map((b,j)=>({j,d:Math.hypot(a[2]-b[2],a[3]-b[3])})).filter(x=>x.j!==i).sort((a,b)=>a.d-b.d).slice(0,2);for(const b of near)if(b.j>i)add('line',{x1:a[2],y1:a[3],x2:DATA[b.j][2],y2:DATA[b.j][3],class:'route'});}
  DATA.forEach(([name,,x,y],id)=>{const g=add('g',{class:'city','data-id':id,tabindex:'0',role:'button','aria-label':`Inspect ${name}`});add('circle',{cx:x,cy:y,r:5,fill:'#55a68e'},g);if(id%2===0||[1,28].includes(id)){const t=add('text',{x:x+8,y:y-8},g);t.textContent=name;}g.onclick=()=>{game.selected=id;render()};g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();game.selected=id;render();}};});}
$('pause').onclick=()=>{if(!game.over){game.paused=!game.paused;lastTick=performance.now();render();}};
$('speed').onchange=e=>{game.speed=+e.target.value;lastTick=performance.now();render();};
$('reset').onclick=()=>{if(confirm('Start a new worldwide outbreak?')){game=makeGame();lastTick=performance.now();render();}};
function tick(now){if(!game.paused&&!game.over){const period=5000/game.speed;if(now-lastTick>=period){lastTick=now;dayStep();}}requestAnimationFrame(tick);}
game=makeGame();drawMap();render();lastTick=performance.now();requestAnimationFrame(tick);
