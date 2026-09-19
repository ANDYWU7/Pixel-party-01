'use strict';
const $ = id => document.getElementById(id);
const canvas = $('game-canvas'), ctx = canvas.getContext('2d');
let current = null, mode = 'ready', game = null, score = 0, level = 1, lives = 3, last = 0, sound = false, audioContext;
const held = new Set();
const data = {
  '2048': {title:'2048', guide:'Slide matching numbers together to reach 2048. Each move adds a tile. Use the arrow keys or swipe the board.', controls:[['Slide','↑ ← ↓ → / W A S D'],['Touch','Swipe / direction buttons'],['Pause','P']]},
  snake: {title:'Snake', guide:'Eat the red food to grow. Avoid the walls and your own tail. The snake speeds up every five bites.', controls:[['Steer','↑ ← ↓ → / W A S D'],['Pause','P']]},
  breaker: {title:'Block Breaker', guide:'Bounce the ball into the bricks. Clear them all to advance. Move the paddle with the arrow keys or the mobile buttons.', controls:[['Move paddle','← → / A D'],['Launch ball','Space / tap board'],['Pause','P']]},
  space: { title:'Space Invaders', description:'Hold your ground. The next wave is already on its way.', genre:'ARCADE / SHOOTER', heading:'Save your little corner of space.', guide:'Shoot the aliens before they reach your ship. Shields absorb shots but crumble under fire; each wave restores them.', controls:[['Move','← → / A D'],['Fire','Space'],['Pause','P']],tip:'Keep moving. A shot you dodge is another chance to clear the sky.' },
  blocks: { title:'Block Stack',description:'A clear line. A clear mind. See how long you can keep it going.',genre:'PUZZLE / STRATEGY',heading:'Everything has its place.',guide:'Fill horizontal lines to clear them. Don’t let the blocks reach the top.',controls:[['Move','← → / A D'],['Rotate left','Q'],['Rotate right','E / ↑ / W'],['Soft drop','↓ / S'],['Hard drop','Space'],['Pause','P']],tip:'Leave room for the long piece. Clearing four lines at once is worth 800 points.' },
  maze: { title:'Maze Muncher',description:'There’s a dot with your name on it. Probably a ghost, too.',genre:'ARCADE / MAZE',heading:'A snack worth chasing.',guide:'Eat every dot to enter a new maze. Avoid ghosts. Large pellets let you eat them for a few seconds.',controls:[['Move','↑ ← ↓ → / W A S D'],['Pause','P']],tip:'Big glowing pellets make ghosts vulnerable. Save one for when things get crowded.' }
};
function beep(freq=440,duration=.06){if(!sound)return;try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='square';o.frequency.value=freq;g.gain.setValueAtTime(.025,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+duration);}catch{}}
$('sound').onclick=()=>{sound=!sound;$('sound').setAttribute('aria-pressed',String(sound));$('sound').title=sound?'Sound on — click to mute':'Muted — click to unmute';if(sound)beep(660);};
function hud(){
 $('score').textContent=String(score).padStart(6,'0');
 $('level-label').firstChild.textContent=current==='2048'?'TOP TILE ':'LEVEL ';
 $('level').textContent=current==='2048'?Math.max(...game.board.flat()):String(level).padStart(2,'0');
 $('life-label').firstChild.textContent=({blocks:'LINES ',snake:'LENGTH ','2048':'MOVES '})[current]||'LIVES ';
 $('lives').textContent=current==='blocks'?game.lines:current==='snake'?game.snake.length:current==='2048'?game.moves:lives;
}
function createGame(id){return new ({space:SpaceGame,blocks:BlockGame,maze:MazeGame,'2048':Game2048,snake:SnakeGame,breaker:BreakerGame}[id])();}
function overlay(title,description,label,button){$('overlay').hidden=false;$('overlay-title').textContent=title;$('overlay-description').textContent=description;$('start').textContent=button;}
function start(){held.clear();score=0;level=1;lives=3;game=createGame(current);Rewards.begin();mode='playing';$('overlay').hidden=true;$('pause').textContent='Ⅱ Pause';hud();canvas.focus({preventScroll:true});}
function finish(){Rewards.tick(0,current,game,true);mode='over';held.clear();beep(100,.3);overlay('Game over',`Score: ${score.toLocaleString()} · ${Rewards.timePoints} time + ${Rewards.bonusPoints} bonus points`,'','Play again');}
function pause(){if(mode==='playing'){mode='paused';held.clear();overlay('Paused','','','Resume');$('pause').textContent='▶ Resume';}else if(mode==='paused'){mode='playing';$('overlay').hidden=true;$('pause').textContent='Ⅱ Pause';canvas.focus({preventScroll:true});}}
$('start').onclick=()=>{if(mode==='paused')pause();else if(mode==='won'){mode='playing';$('overlay').hidden=true;canvas.focus({preventScroll:true});}else start();};$('pause').onclick=pause;$('restart').onclick=start;
function route(){const id=location.hash.slice(1);held.clear();$('shop-view').hidden=id!=='shop';if(id==='shop'){current=null;mode='ready';$('lobby').hidden=true;$('game-view').hidden=true;Shop.render();document.title='Shop — Pixel Party';window.scrollTo(0,0);return;}if(!data[id]){current=null;mode='ready';$('lobby').hidden=false;$('game-view').hidden=true;document.title='Pixel Party';return;}current=id;mode='ready';$('lobby').hidden=true;$('game-view').hidden=false;const d=data[id];$('game-title').textContent=d.title;$('guide-description').textContent=d.guide;$('controls-list').replaceChildren();for(const [label,key] of d.controls){const row=document.createElement('div');row.className='control-row';const text=document.createElement('span');text.textContent=label;const k=document.createElement('kbd');k.textContent=key;row.append(text,k);$('controls-list').append(row);}$('life-label').firstChild.textContent=id==='blocks'?'LINES ':'LIVES ';score=0;level=1;lives=3;game=createGame(id);Rewards.begin();hud();$('pause').textContent='Ⅱ Pause';overlay(d.title,'','','Start game');document.title=d.title+' — Pixel Party';setupTouch();window.scrollTo(0,0);}
function keyAction(key){if(mode!=='playing')return;if(['space','blocks'].includes(current)&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','RotateLeft'].includes(key))Rewards.engage();game.input?.(key);}
const normalize = key => ({a:'ArrowLeft',d:'ArrowRight',w:'ArrowUp',s:'ArrowDown',q:'RotateLeft',e:'ArrowUp',' ':'Space'})[key.toLowerCase()]||key;
document.addEventListener('keydown',e=>{if(!current||e.ctrlKey||e.metaKey||e.altKey||e.target.tagName==='BUTTON'||e.target.tagName==='A')return;const k=normalize(e.key);if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','RotateLeft'].includes(k)){e.preventDefault();if(!held.has(k))keyAction(k);held.add(k);}if(e.key.toLowerCase()==='p'&&!e.repeat)pause();if(e.key==='Escape'&&mode==='playing')pause();});
document.addEventListener('keyup',e=>held.delete(normalize(e.key)));
window.addEventListener('blur',()=>{if(mode==='playing')pause();held.clear();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
function setupTouch(){const keys=current==='breaker'?[['←','ArrowLeft'],['LAUNCH','Space'],['→','ArrowRight']]:current==='space'?[['←','ArrowLeft'],['FIRE','Space'],['→','ArrowRight']]:current==='blocks'?[['←','ArrowLeft'],['↻','ArrowUp'],['↓','ArrowDown'],['→','ArrowRight'],['DROP','Space']]:[['←','ArrowLeft'],['↑','ArrowUp'],['↓','ArrowDown'],['→','ArrowRight']];$('touch-controls').replaceChildren();$('touch-controls').setAttribute('data-game',current);for(const [label,key] of keys){const b=document.createElement('button');b.textContent=label;b.setAttribute('data-key',key);b.setAttribute('aria-label',({ArrowLeft:'Move left',ArrowRight:'Move right',ArrowUp:current==='blocks'?'Rotate piece':'Move up',ArrowDown:'Move down',Space:current==='space'?'Fire':current==='breaker'?'Launch ball':'Hard drop'})[key]);b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);held.add(key);keyAction(key);};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>held.delete(key);b.onclick=e=>{if(e.detail===0)keyAction(key);};$('touch-controls').append(b);}}
let swipeStart=null;
canvas.addEventListener('pointerdown',e=>{
 if(mode!=='playing')return;
 if(current==='2048'){swipeStart={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);}
 if(current==='breaker')game.input('Space');
});
canvas.addEventListener('pointerup',e=>{
 if(swipeStart&&swipeStart.id===e.pointerId&&current==='2048'&&mode==='playing'){
  const dx=e.clientX-swipeStart.x,dy=e.clientY-swipeStart.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))>=24)keyAction(Math.abs(dx)>Math.abs(dy)?dx>0?'ArrowRight':'ArrowLeft':dy>0?'ArrowDown':'ArrowUp');
 }
 swipeStart=null;
});
canvas.addEventListener('pointercancel',()=>{swipeStart=null;});
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function alien(c,x,y,size,color,type=0){const shapes=[['00100100','00011000','00111100','01111110','11011011','11111111','00100100','01000010'],['00111100','01111110','11011011','11111111','00100100','01011010','10100101']];const pattern=shapes[type%2];c.fillStyle=color;pattern.forEach((row,j)=>[...row].forEach((v,i)=>{if(v==='1')c.fillRect(x+i*size,y+j*size,size,size);}));}
function ship(c,x,y,s,color){c.fillStyle=color;['0001000','0001000','0011100','0111110','1111111'].forEach((r,j)=>[...r].forEach((v,i)=>{if(v==='1')c.fillRect(x+i*s,y+j*s,s,s);}));}
function ghost(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,Math.PI,0);c.lineTo(x+r,y+r);for(let i=0;i<4;i++){c.lineTo(x+r-(i*2+1)*r/4,y+r*.6);c.lineTo(x+r-(i*2+2)*r/4,y+r);}c.closePath();c.fill();for(const dx of [-.38,.38]){c.fillStyle='#fff';c.beginPath();c.ellipse(x+dx*r,y-r*.05,r*.22,r*.31,0,0,Math.PI*2);c.fill();c.fillStyle='#171f49';c.beginPath();c.arc(x+dx*r+r*.07,y,r*.11,0,Math.PI*2);c.fill();}}
function pac(c,x,y,r,angle=0,open=.23){c.fillStyle='#f5d571';c.beginPath();c.moveTo(x,y);c.arc(x,y,r,angle+open*Math.PI,angle+(2-open)*Math.PI);c.closePath();c.fill();}
function block(c,x,y,s,color){rect(c,x+1,y+1,s-2,s-2,color);rect(c,x+3,y+3,s-6,3,'#ffffff35');rect(c,x+s-5,y+4,2,s-8,'#00000022');}
class SpaceGame{
 constructor(){this.defeated=0;this.x=280;this.shots=[];this.bombs=[];this.particles=[];this.cool=0;this.fireTime=0;this.direction=1;this.invulnerable=0;this.wave();}
 wave(){this.enemies=[];for(let r=0;r<4;r++)for(let col=0;col<9;col++)this.enemies.push({x:65+col*50,y:60+r*43,type:r%2});this.direction=1;this.bombs=[];this.shields=[];for(const x of [65,205,345,485])for(let row=0;row<6;row++)for(let col=0;col<8;col++){if(row===0&&(col<2||col>5)||row>=4&&col>=2&&col<=5)continue;this.shields.push({x:x+col*7,y:460+row*7,hp:2});}}
 moveProjectile(p,dy){
  const old=p.y;p.y+=dy;
  const hits=this.shields.filter(b=>p.x+2>=b.x&&p.x-2<=b.x+7&&Math.max(old,p.y)+11>=b.y&&Math.min(old,p.y)<=b.y+7);
  hits.sort((a,b)=>dy>0?a.y-b.y:b.y-a.y);
  if(hits.length){hits[0].hp--;this.shields=this.shields.filter(b=>b.hp>0);p.y=dy>0?700:-30;return true;}return false;
 }
 input(){}
 update(dt){this.cool-=dt;this.fireTime-=dt;this.invulnerable-=dt;if(held.has('ArrowLeft'))this.x-=310*dt;if(held.has('ArrowRight'))this.x+=310*dt;this.x=Math.max(10,Math.min(555,this.x));if(held.has('Space')&&this.cool<=0){this.shots.push({x:this.x+17,y:536});this.cool=.2;beep(780,.025);}for(const s of this.shots)this.moveProjectile(s,-490*dt);let edge=false;for(const e of this.enemies){e.x+=this.direction*(24+level*9+(36-this.enemies.length)*1.4)*dt;if(e.x<12||e.x>553)edge=true;}if(edge){this.direction*=-1;this.enemies.forEach(e=>{e.y+=18;e.x=Math.max(12,Math.min(553,e.x));});}if(this.fireTime<=0&&this.enemies.length){const e=this.enemies[Math.floor(Math.random()*this.enemies.length)];this.bombs.push({x:e.x+16,y:e.y+27});this.fireTime=Math.max(.2,.85-level*.065);}this.shields=this.shields.filter(b=>!this.enemies.some(e=>e.x<b.x+7&&e.x+32>b.x&&e.y<b.y+7&&e.y+32>b.y));for(const b of this.bombs)this.moveProjectile(b,(150+level*17)*dt);for(const s of this.shots){const i=this.enemies.findIndex(e=>Math.abs(s.x-e.x-16)<20&&s.y<e.y+30&&s.y>e.y-6);if(i>=0){const e=this.enemies.splice(i,1)[0];s.y=-30;this.defeated++;score+=10*level;beep(220,.04);for(let p=0;p<8;p++)this.particles.push({x:e.x+16,y:e.y+12,vx:(Math.random()-.5)*150,vy:(Math.random()-.5)*150,t:.4});}}this.shots=this.shots.filter(s=>s.y>-10);for(const b of this.bombs){if(this.invulnerable<=0&&Math.abs(b.x-this.x-17)<22&&b.y>535&&b.y<568){lives--;b.y=700;this.invulnerable=1.5;beep(110,.15);if(lives<=0){finish();return;}}}this.bombs=this.bombs.filter(b=>b.y<610);for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.t-=dt;}this.particles=this.particles.filter(p=>p.t>0);if(this.enemies.some(e=>e.y>508)){finish();return;}if(!this.enemies.length){level++;score+=100;this.wave();}hud();}
 draw(c){rect(c,0,0,600,600,'#0b1010');for(let i=0;i<55;i++)rect(c,(i*137+29)%600,(i*79+19)%600, i%5===0?2:1,2,'#537062');for(const b of this.shields)rect(c,b.x,b.y,6,6,b.hp===2?'#84c76a':'#497742');for(const e of this.enemies)alien(c,e.x,e.y,4,e.type?'#85c56a':'#b9f577',e.type);if(this.invulnerable<=0||Math.floor(this.invulnerable*10)%2)ship(c,this.x,540,5,'#b9f577');for(const s of this.shots)rect(c,s.x-2,s.y,4,15,'#d3ffaa');for(const b of this.bombs)rect(c,b.x-2,b.y,4,11,'#f5a29e');for(const p of this.particles)rect(c,p.x,p.y,3,3,'#b9f577');rect(c,15,579,570,1,'#315039');}
}
const shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]]];
const colors=['#76d7e3','#f3d875','#c19afa','#b9ef82','#eb8e9d','#859de9','#edb77c'];
class BlockGame{
 constructor(){this.board=Array.from({length:20},()=>Array(10).fill(0));this.placed=0;this.lines=0;this.bag=[];this.next=this.pick();this.timer=0;this.repeat=0;this.spawn();}
 pick(){if(!this.bag.length)this.bag=[0,1,2,3,4,5,6].sort(()=>Math.random()-.5);return this.bag.pop();}
 spawn(){this.type=this.next;this.next=this.pick();this.piece=shapes[this.type].map(r=>[...r]);this.x=Math.floor((10-this.piece[0].length)/2);this.y=0;this.timer=0;if(!this.valid(this.x,this.y,this.piece))finish();}
 valid(x,y,p){return p.every((row,j)=>row.every((v,i)=>!v||(x+i>=0&&x+i<10&&y+j>=0&&y+j<20&&!this.board[y+j][x+i])));}
 move(dx){if(this.valid(this.x+dx,this.y,this.piece))this.x+=dx;}
 drop(soft=false){if(this.valid(this.x,this.y+1,this.piece)){this.y++;if(soft)score++;return true;}this.lock();return false;}
 lock(){this.placed++;this.piece.forEach((r,j)=>r.forEach((v,i)=>{if(v)this.board[this.y+j][this.x+i]=this.type+1;}));const full=this.board.filter(r=>r.every(Boolean)).length;if(full){this.board=this.board.filter(r=>!r.every(Boolean));while(this.board.length<20)this.board.unshift(Array(10).fill(0));score+=[0,100,300,500,800][full]*level;this.lines+=full;level=1+Math.floor(this.lines/10);beep(600+full*100,.12);}else beep(160,.035);this.spawn();hud();}
 input(key){if(key==='ArrowLeft')this.move(-1);if(key==='ArrowRight')this.move(1);if(key==='ArrowDown')this.drop(true);if(key==='ArrowUp'||key==='RotateLeft'){const transposed=this.piece[0].map((_,i)=>this.piece.map(row=>row[i]));const rotated=key==='RotateLeft'?transposed.reverse():transposed.map(row=>row.reverse());for(const dx of [0,-1,1,-2,2])if(this.valid(this.x+dx,this.y,rotated)){this.piece=rotated;this.x+=dx;beep(350,.025);break;}}if(key==='Space'){let count=0;while(this.valid(this.x,this.y+1,this.piece)){this.y++;count++;}score+=count*2;this.lock();}this.repeat=.19;hud();}
 update(dt){this.timer+=dt;this.repeat-=dt;if(this.repeat<=0){if(held.has('ArrowLeft'))this.move(-1);if(held.has('ArrowRight'))this.move(1);if(held.has('ArrowDown')){this.drop(true);this.timer=0;}this.repeat=.075;}if(this.timer>=Math.max(.09,.78-(level-1)*.065)){this.drop();this.timer=0;}hud();}
 draw(c){rect(c,0,0,600,600,'#101016');const ox=106,oy=20,s=28;for(let y=0;y<20;y++)for(let x=0;x<10;x++){rect(c,ox+x*s,oy+y*s,s-1,s-1,'#1b1b26');if(this.board[y][x])block(c,ox+x*s,oy+y*s,s,colors[this.board[y][x]-1]);}let gy=this.y;while(this.valid(this.x,gy+1,this.piece))gy++;this.piece.forEach((r,j)=>r.forEach((v,i)=>{if(v){c.strokeStyle=colors[this.type]+'66';c.strokeRect(ox+(this.x+i)*s+2,oy+(gy+j)*s+2,s-4,s-4);block(c,ox+(this.x+i)*s,oy+(this.y+j)*s,s,colors[this.type]);}}));c.font='13px Courier New';c.fillStyle='#9e98ad';c.fillText('NEXT',425,50);shapes[this.next].forEach((r,j)=>r.forEach((v,i)=>{if(v)block(c,425+i*23,73+j*23,23,colors[this.next]);}));c.fillStyle='#787583';c.fillText('CLEAR',425,185);c.fillText('THE LINES.',425,204);}
}
// Carve a connected maze, then open dead ends and add loops for chasing.
function generateMaze(){
 const map=Array.from({length:21},()=>Array(19).fill('#'));
 const directions=[[0,-2],[2,0],[0,2],[-2,0]],stack=[[9,15]];map[15][9]='.';
 while(stack.length){const [x,y]=stack[stack.length-1];const options=directions.filter(([dx,dy])=>x+dx>0&&x+dx<18&&y+dy>0&&y+dy<20&&map[y+dy][x+dx]==='#');
  if(!options.length){stack.pop();continue;}
  const [dx,dy]=options[Math.floor(Math.random()*options.length)];map[y+dy/2][x+dx/2]='.';map[y+dy][x+dx]='.';stack.push([x+dx,y+dy]);
 }
 for(let y=1;y<20;y+=2)for(let x=1;x<18;x+=2){
  const options=directions.filter(([dx,dy])=>x+dx>0&&x+dx<18&&y+dy>0&&y+dy<20);
  const walls=options.filter(([dx,dy])=>map[y+dy/2][x+dx/2]==='#');
  if(walls.length&&(options.length-walls.length===1||Math.random()<.25)){const [dx,dy]=walls[Math.floor(Math.random()*walls.length)];map[y+dy/2][x+dx/2]='.';}
 }
 for(let x=7;x<=11;x++)map[9][x]='.';
 for(const [x,y] of [[8,9],[9,9],[10,9],[9,15]])map[y][x]=' ';
 for(const [x,y] of [[1,1],[17,1],[1,19],[17,19]])map[y][x]='o';
 return map;
}
class MazeGame{
 constructor(previewMap=null){this.collected=0;this.tick=0;this.ghostTick=0;this.power=0;this.invulnerable=0;this.frame=0;if(previewMap){this.map=previewMap.map(row=>[...row]);this.resetActors();}else this.resetMap();}
 resetMap(){this.map=generateMaze();this.power=0;this.resetActors();}
 resetActors(){this.player={x:9,y:15,dx:0,dy:0};this.want={dx:0,dy:0};this.ghosts=[{x:8,y:9,color:'#eb909e'},{x:9,y:9,color:'#b498f0'},{x:10,y:9,color:'#87cdd4'}];this.invulnerable=1.5;this.tick=0;this.ghostTick=0;}
 open(x,y){return this.map[y]?.[x]!==undefined&&this.map[y][x]!=='#';}
 input(key){const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[key];if(dir)this.want={dx:dir[0],dy:dir[1]};}
 collision(){for(const g of this.ghosts){if(g.x===this.player.x&&g.y===this.player.y){if(this.power>0){score+=200;g.x=9;g.y=9;g.wait=2;beep(680,.1);}else if(this.invulnerable<=0){lives--;beep(100,.2);if(lives<=0){finish();return true;}this.power=0;this.resetActors();return true;}}}return false;}
 update(dt){this.power=Math.max(0,this.power-dt);this.invulnerable-=dt;this.frame+=dt;this.tick+=dt;this.ghostTick+=dt;for(const g of this.ghosts)g.wait=Math.max(0,(g.wait||0)-dt);if(this.tick>=.115){this.tick=0;const p=this.player,w=this.want;if(this.open(p.x+w.dx,p.y+w.dy)){p.dx=w.dx;p.dy=w.dy;}if(this.open(p.x+p.dx,p.y+p.dy)){p.x+=p.dx;p.y+=p.dy;}const tile=this.map[p.y][p.x];if(tile==='.'||tile==='o'){this.collected++;score+=tile==='o'?50:10;this.map[p.y][p.x]=' ';if(tile==='o'){this.power=7;beep(550,.12);}else if(Math.random()<.3)beep(280,.02);}if(this.collision())return;if(!this.map.some(r=>r.some(v=>v==='.'||v==='o'))){score+=500;level++;this.resetMap();}}
 if(this.ghostTick>=Math.max(.125,.28-level*.016)*(this.power>0?1.6:1)){this.ghostTick=0;for(const g of this.ghosts){if(g.wait>0)continue;let opts=[[0,-1],[-1,0],[0,1],[1,0]].filter(([dx,dy])=>this.open(g.x+dx,g.y+dy));const nonReverse=opts.filter(([dx,dy])=>dx!==-g.dx||dy!==-g.dy);if(nonReverse.length)opts=nonReverse;if(!opts.length)continue;opts.sort((a,b)=>{const da=Math.abs(g.x+a[0]-this.player.x)+Math.abs(g.y+a[1]-this.player.y),db=Math.abs(g.x+b[0]-this.player.x)+Math.abs(g.y+b[1]-this.player.y);return this.power>0?db-da:da-db;});const d=Math.random()<.23?opts[Math.floor(Math.random()*opts.length)]:opts[0];g.dx=d[0];g.dy=d[1];g.x+=g.dx;g.y+=g.dy;}this.collision();}hud();}
 draw(c){rect(c,0,0,600,600,'#0e1019');const s=26,ox=53,oy=27;for(let y=0;y<this.map.length;y++)for(let x=0;x<19;x++){const v=this.map[y][x],px=ox+x*s,py=oy+y*s;if(v==='#'){rect(c,px+1,py+1,s-2,s-2,'#1a244b');c.strokeStyle='#485cad';c.lineWidth=1;c.strokeRect(px+3,py+3,s-6,s-6);}else if(v==='.'||v==='o'){c.fillStyle='#e6d8a4';c.beginPath();c.arc(px+s/2,py+s/2,v==='o'?5+Math.sin(this.frame*6):2.2,0,Math.PI*2);c.fill();}}const p=this.player;if(this.invulnerable<=0||Math.floor(this.frame*8)%2)pac(c,ox+p.x*s+s/2,oy+p.y*s+s/2,10.5,Math.atan2(p.dy,p.dx),.12+Math.abs(Math.sin(this.frame*12))*.15);for(const g of this.ghosts)ghost(c,ox+g.x*s+s/2,oy+g.y*s+s/2,10,this.power>0?(this.power<2&&Math.floor(this.frame*7)%2?'#eae5f2':'#647cda'):g.color);if(this.power>0){c.font='11px Courier New';c.fillStyle='#f5d571';c.fillText('POWER '+Math.ceil(this.power)+'s',53,589);}}
}
function previews(){
 // Use the same boards, pieces, sprites, and drawing code as the games.
 const space=new SpaceGame();
 space.shots=[{x:space.x+17,y:385}];
 const shooter=space.enemies[31];
 space.bombs=[{x:shooter.x+16,y:shooter.y+70}];
 const blocks=new BlockGame();
 // Drop complete tetrominoes onto the board so the stack is physically valid.
 for(const [type,x] of [[5,0],[1,3],[6,7],[2,4],[3,0],[4,6]]){
  const piece=shapes[type];let y=0;
  while(blocks.valid(x,y+1,piece))y++;
  piece.forEach((row,j)=>row.forEach((v,i)=>{if(v)blocks.board[y+j][x+i]=type+1;}));
 }
 blocks.type=2;blocks.piece=shapes[2].map(row=>[...row]);blocks.x=4;blocks.y=4;blocks.next=0;
 const maze=new MazeGame([
  '###################',
  '#o.......#.......o#',
  '#.##.###.#.###.##.#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.###.#.###.####',
  '#....#.......#....#',
  '#.##.#.##.##.#.##.#',
  '#.......   .......#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.###.#.###.####',
  '#.................#',
  '#.##.###.#.###.##.#',
  '#..#..... .....#..#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#o...............o#',
  '###################'
 ]);maze.invulnerable=0;maze.frame=.1;
 const direction=[[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dy])=>maze.open(maze.player.x+dx,maze.player.y+dy));
 [maze.player.dx,maze.player.dy]=direction;
 // Place ghosts on actual corridors, away from the player's starting tile.
 [[1,1],[17,1],[17,19]].forEach(([x,y],i)=>{maze.ghosts[i].x=x;maze.ghosts[i].y=y;});
 const tiles=new Game2048(true);tiles.board=[[2,0,0,0],[4,8,2,0],[16,32,8,2],[64,128,16,4]];
 const snake=new SnakeGame(true);snake.started=true;snake.snake=[{x:12,y:8},{x:11,y:8},{x:10,y:8},{x:9,y:8},{x:8,y:8},{x:8,y:9},{x:8,y:10},{x:8,y:11},{x:7,y:11},{x:6,y:11}];snake.food={x:15,y:8};
 const breaker=new BreakerGame();breaker.waiting=false;breaker.ball={x:330,y:330,vx:120,vy:-260};breaker.bricks=breaker.bricks.filter((brick,i)=>![27,28,35,36].includes(i));
 for(const [id,snapshot] of [['space',space],['blocks',blocks],['maze',maze],['2048',tiles],['snake',snake],['breaker',breaker]]){
  const preview=$('preview-'+id),c=preview.getContext('2d');
  // Letterbox the square playfield without stretching or clipping its grid.
  rect(c,0,0,640,460,id==='space'?'#0b1010':id==='blocks'?'#101016':id==='2048'?'#171b24':id==='snake'?'#101e17':id==='breaker'?'#131925':'#0e1019');
  c.save();c.translate(90,0);c.scale(460/600,460/600);snapshot.draw(c);c.restore();
 }
}
function loop(time){const dt=Math.min((time-last)/1000,.04);last=time;if(current&&game){const playing=mode==='playing';if(playing)game.update(dt);Rewards.tick(dt,current,game,playing);game.draw(ctx);}requestAnimationFrame(loop);}
window.addEventListener('hashchange',route);$('year').textContent=new Date().getFullYear();Shop.init();previews();route();requestAnimationFrame(loop);
if(document.modelContext?.registerTool){
  try{Promise.resolve(document.modelContext.registerTool({name:'pause_arcade_game',description:'Pause the currently running arcade game, preserving its score and board.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('Expected an empty object.');if(mode!=='playing')throw new Error('No game is currently running.');pause();return {game:current,status:mode,score};}})).catch(()=>{});}catch{}
}
