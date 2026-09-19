'use strict';
const SHOP_ITEMS = [
  {id:'arcade',kind:'style',name:'Pixel arcade',price:0,description:'Pixel letters and chunky buttons.'},
  {id:'simple',kind:'style',name:'Simple',price:120,description:'The plain, old-school website look.'},
  {id:'modern',kind:'style',name:'Modern',price:360,description:'Clean type, rounded cards and buttons.'},
  {id:'classic',kind:'palette',name:'Classic blue',price:0,description:'Blue panels and gold accents.',colors:['#111827','#202c46','#f4d479']},
  {id:'mint',kind:'palette',name:'Mint terminal',price:35,description:'Green phosphor on a dark screen.',colors:['#0c1c19','#193b31','#9ee7b4']},
  {id:'plum',kind:'palette',name:'Purple night',price:80,description:'Plum panels and lilac highlights.',colors:['#1c1429','#382749','#d7b3ff']},
  {id:'amber',kind:'palette',name:'Amber monitor',price:180,description:'Warm gold and brown, like an old monitor.',colors:['#21190e','#40311d','#ffd478']},
  {id:'ice',kind:'palette',name:'Ice blue',price:300,description:'Deep blue with bright icy accents.',colors:['#071c2a','#153a52','#a5efff']},
  {id:'rose',kind:'palette',name:'Rose gold',price:600,description:'A long-term unlock in burgundy and gold.',colors:['#291620','#4b2938','#ffcf9b']}
];
const SHOP_KEY='pixel-party.profile.v1';
function cleanProfile(raw){
  const value=raw&&typeof raw==='object'?raw:{};
  const owned=[...new Set(['arcade','classic',...(Array.isArray(value.owned)?value.owned:[])])].filter(id=>SHOP_ITEMS.some(item=>item.id===id));
  const selected=kind=>owned.includes(value[kind])&&SHOP_ITEMS.some(item=>item.id===value[kind]&&item.kind===kind)?value[kind]:kind==='style'?'arcade':'classic';
  return {version:1,points:Number.isSafeInteger(value.points)&&value.points>=0?value.points:0,owned,style:selected('style'),palette:selected('palette'),mode:value.mode==='light'?'light':'dark'};
}
const Shop={
  profile:cleanProfile(null),storageOK:true,chain:Promise.resolve(),
  read(){if(!this.storageOK)return this.profile;try{return cleanProfile(JSON.parse(localStorage.getItem(SHOP_KEY)));}catch{this.storageOK=false;return this.profile;}},
  init(){this.profile=this.read();this.apply();this.render();
    document.getElementById('theme-toggle').onclick=()=>this.transact(p=>{p.mode=p.mode==='dark'?'light':'dark';});
    document.getElementById('test-points').addEventListener('dblclick',e=>{e.preventDefault();this.earn(500);});
    document.getElementById('reset-progress').onclick=async()=>{
      if(!window.confirm('Reset all progress? Your points, purchased cosmetics, and equipped styles will be permanently deleted from this browser. This cannot be undone.'))return;
      await this.transact(p=>{Object.assign(p,cleanProfile(null));return 'All progress reset.';});
      Rewards.base=0;Rewards.budget=0;Rewards.begin();
      document.getElementById('shop-message').textContent='';
    };window.addEventListener('storage',e=>{if(e.key===SHOP_KEY){this.profile=this.read();this.apply();this.render();}});},
  transact(change){
    const work=()=>{const next=this.read();const message=change(next);try{localStorage.setItem(SHOP_KEY,JSON.stringify(next));this.storageOK=true;}catch{this.storageOK=false;}this.profile=next;this.apply();this.render();if(message)document.getElementById('shop-message').textContent=message;};
    this.chain=this.chain.then(()=>navigator.locks?.request?navigator.locks.request(SHOP_KEY,work):work()).catch(()=>{this.storageOK=false;this.render();});
    return this.chain;
  },
  earn(amount){if(!Number.isSafeInteger(amount)||amount<=0)return;return this.transact(p=>{p.points=Math.min(Number.MAX_SAFE_INTEGER,p.points+amount);});},
  choose(id){const item=SHOP_ITEMS.find(i=>i.id===id);if(!item)return;
    return this.transact(p=>{if(!p.owned.includes(id)){if(p.points<item.price)return 'Not enough points yet.';p.points-=item.price;p.owned.push(id);}p[item.kind]=id;return item.name+' equipped.';});
  },
  apply(){const root=document.documentElement,p=this.profile;root.dataset.style=p.style;root.dataset.palette=p.palette;root.dataset.mode=p.mode;
    const toggle=document.getElementById('theme-toggle');toggle.textContent=p.mode==='dark'?'Light':'Dark';toggle.title=p.mode==='dark'?'Switch to light mode':'Switch to dark mode';toggle.setAttribute('aria-pressed',String(p.mode==='light'));toggle.setAttribute('aria-label','Light mode');
    const colors=SHOP_ITEMS.find(i=>i.id===p.palette).colors;
    root.style.setProperty('--shop-bg',colors[0]);root.style.setProperty('--shop-panel',colors[1]);root.style.setProperty('--shop-accent',colors[2]);
  },
  render(){
    document.getElementById('wallet').textContent=this.profile.points.toLocaleString()+' pts';
    document.getElementById('shop-balance').textContent=this.profile.points.toLocaleString();
    document.getElementById('storage-note').textContent=this.storageOK?'Saved in this browser.':'Browser storage is unavailable. Progress will last only for this visit.';
    for(const kind of ['palette','style']){
      const list=document.getElementById('shop-'+kind);list.replaceChildren();
      for(const item of SHOP_ITEMS.filter(i=>i.kind===kind)){
        const card=document.createElement('article');card.className='shop-item';
        const sample=document.createElement('div');sample.className='cosmetic-sample sample-'+item.id;
        if(item.colors){for(const color of item.colors){const swatch=document.createElement('span');swatch.style.background=color;sample.append(swatch);}}else sample.textContent='Pixel Party';
        const title=document.createElement('h3');title.textContent=item.name;
        const desc=document.createElement('p');desc.textContent=item.description;
        const button=document.createElement('button'),owned=this.profile.owned.includes(item.id),equipped=this.profile[kind]===item.id;
        button.textContent=equipped?'Equipped':owned?'Equip':item.price+' pts · Buy & equip';
        button.disabled=equipped||(!owned&&this.profile.points<item.price);
        button.onclick=()=>this.choose(item.id);
        card.append(sample,title,desc,button);list.append(card);
      }
    }
  }
};
// At most 12 points per active minute: 6 for play time and 6 for progress.
// No rewards for menus, pauses, waiting to launch, or leaving a game idle.
const Rewards={
  base:0,budget:0,pending:0,recent:0,last:0,run:0,timePoints:0,bonusPoints:0,engaged:false,
  begin(){this.last=0;this.recent=0;this.pending=0;this.run=0;this.timePoints=0;this.bonusPoints=0;this.engaged=false;this.show();},
  show(){
    document.getElementById('run-points').textContent='+'+this.run+' pts · '+this.timePoints+' time + '+this.bonusPoints+' bonus';
    const whole=Math.floor(this.pending+1e-9),seconds=Math.max(0,Math.ceil((1-this.budget)*10));
    document.getElementById('bonus-status').textContent=whole?whole+' bonus point'+(whole===1?'':'s')+' ready · '+seconds+'s more active play to next payout':'Next bonus: '+Math.min(99,Math.floor((this.pending%1)*100+1e-7))+'% of actions done';
  },
  engage(){if(!this.engaged){this.engaged=true;this.recent=12;}},
  progress(id,g){return id==='2048'?g.moves/4:id==='blocks'?((g.placed||0)/4+g.lines/2):id==='snake'?g.eaten/2:id==='maze'?(g.collected||0)/25:id==='space'?(g.defeated||0)/5:(g.hits||0)/5;},
  tick(dt,id,g,playing){
    if(!playing||document.hidden)return;
    const value=this.progress(id,g),delta=Math.max(0,value-this.last);this.last=value;
    if(delta){this.engage();this.recent=12;this.pending=Math.min(2,this.pending+delta);}
    if(id==='snake'&&g.started||id==='breaker'&&!g.waiting)this.engage();
    this.recent=Math.max(0,this.recent-dt);
    if(!this.recent||id==='breaker'&&g.waiting||id==='snake'&&!g.started){this.show();return;}
    this.base+=dt;this.budget=Math.min(2,this.budget+dt/10);
    const time=Math.floor((this.base+1e-9)/10);let amount=time;this.base=Math.max(0,this.base-time*10);
    const bonus=Math.floor(Math.min(this.budget,this.pending)+1e-9);amount+=bonus;this.budget=Math.max(0,this.budget-bonus);this.pending=Math.max(0,this.pending-bonus);this.timePoints+=time;this.bonusPoints+=bonus;
    if(amount){this.run+=amount;Shop.earn(amount);}this.show();
  }
};
