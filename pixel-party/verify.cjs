const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const noop = () => {};
const drawing = new Proxy({}, {get: () => noop, set: () => true});
const nodes = new Map();
function node(id) { if (!nodes.has(id)) nodes.set(id,{textContent:'',hidden:false,style:{},firstChild:{textContent:''},getContext:()=>drawing,addEventListener:noop,setAttribute:noop,replaceChildren:noop,append:noop,focus:noop});return nodes.get(id); }
let registered;
const context = vm.createContext({document:{documentElement:{dataset:{},style:{setProperty:noop}},getElementById:node,createElement:()=>node(Math.random()),addEventListener:noop,modelContext:{registerTool:t=>registered=t}},window:{addEventListener:noop,scrollTo:noop},location:{hash:''},requestAnimationFrame:noop,navigator:{},localStorage:{getItem:()=>null,setItem:noop},console,Math,Date,Set,Promise});
vm.runInContext(fs.readFileSync('dist/games.js','utf8'),context);
vm.runInContext(fs.readFileSync('dist/shop.js','utf8'),context);
vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context);
function run(src) { return vm.runInContext(src,context); }
run("location.hash='#maze';route();start()");
assert.equal(run('mode'),'playing');
assert.ok(run(`(()=>{const seen=new Set(['9,15']),queue=[[9,15]];while(queue.length){const [x,y]=queue.shift();for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){const k=(x+dx)+','+(y+dy);if(game.open(x+dx,y+dy)&&!seen.has(k)){seen.add(k);queue.push([x+dx,y+dy]);}}}return game.map.every((r,y)=>r.every((v,x)=>!['.','o'].includes(v)||seen.has(x+','+y)));})()`),'Every maze pellet must be reachable');
run("game.player={x:1,y:1,dx:0,dy:0};game.tick=1;game.update(.01)");
assert.equal(run('score'),50);assert.ok(run('game.power>0'));
run("game.power=0;game.invulnerable=0;game.ghosts[0].x=game.player.x;game.ghosts[0].y=game.player.y;game.collision()");assert.equal(run('lives'),2);
run("location.hash='#blocks';route();start();game.board[19]=Array(10).fill(1);game.board[19][4]=0;game.piece=[[1]];game.type=0;game.x=4;game.y=19;game.lock()");
assert.equal(run('game.lines'),1);assert.equal(run('score'),100);
run("game.input('Space')");assert.ok(run('game.board.some(r=>r.some(Boolean))'));
run("location.hash='#space';route();start();held.add('Space');game.update(.016)");assert.equal(run('game.shots.length'),1);
run("game.shots=[{x:game.enemies[0].x+16,y:game.enemies[0].y+12}];game.update(.001)");assert.equal(run('game.enemies.length'),35);assert.equal(run('score'),10);
run('game.enemies=[];game.update(.01)');assert.equal(run('level'),2);assert.equal(run('game.enemies.length'),36);
assert.equal(registered.name,'pause_arcade_game');assert.equal(registered.execute({}).status,'paused');assert.equal(run('held.size'),0);assert.throws(()=>registered.execute({extra:true}));
run('pause();start()');assert.equal(run('mode'),'playing');assert.equal(run('score'),0);
run("location.hash='';route()");assert.equal(run('current'),null);
for(const file of ['index.html','style.css','app.js'])assert.ok(fs.statSync('dist/'+file).size>0);
console.log('Passed: maze reachability, pellets and ghost collision; block line clearing and hard drop; shooting, scoring and waves; pause, restart, routes, and WebMCP state validation.');
// Regression checks for shields, rotation directions, and generated levels.
run("location.hash='#space';route();start();held.clear();game.fireTime=999");
const shields=run('game.shields.length');
assert.ok(shields>100);
run('game.bombs=[{x:83,y:440}];game.update(.12)');
assert.equal(run('game.bombs.length'),0);
assert.equal(run('game.shields.some(b=>b.hp===1)'),true);
assert.equal(run('lives'),3);
run('game.bombs=[{x:83,y:440}];game.update(.12)');
assert.equal(run('game.shields.length'),shields-1);
run('game.shots=[{x:68,y:530}];game.update(.08)');
assert.equal(run('game.shots.length'),0);
run('game.enemies=[];game.update(.01)');assert.equal(run('game.shields.length'),shields);
run("location.hash='#blocks';route();start();game.piece=[[1,0,0],[1,1,1]];game.x=3;game.y=5");
const original=run('JSON.stringify(game.piece)');
run("game.input(normalize('Q'))");
assert.equal(run('JSON.stringify(game.piece)'), '[[0,1],[0,1],[1,1]]');
run("game.input(normalize('e'))");assert.equal(run('JSON.stringify(game.piece)'),original);
run("game.x=9;game.piece=[[1],[1],[1],[1]];game.input(normalize('Q'))");
assert.ok(run('game.valid(game.x,game.y,game.piece)'));
const layouts=new Set();
for(let trial=0;trial<100;trial++){
 const map=JSON.parse(run('JSON.stringify(generateMaze())'));layouts.add(JSON.stringify(map));
 const seen=new Set(['9,15']),queue=[[9,15]];
 while(queue.length){const [x,y]=queue.shift();for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(map[ny]?.[nx]&&map[ny][nx]!=='#'&&!seen.has(k)){seen.add(k);queue.push([nx,ny]);}}}
 assert.equal(map.length,21);assert.ok(map.every(r=>r.length===19));
 assert.equal(map.flat().filter(v=>v==='o').length,4);
 map.forEach((r,y)=>r.forEach((v,x)=>{if(v!=='#')assert.ok(seen.has(x+','+y),'Unreachable maze cell');if(x===0||x===18||y===0||y===20)assert.equal(v,'#');}));
 for(const k of ['8,9','9,9','10,9','9,15'])assert.ok(seen.has(k));
}
assert.ok(layouts.size>95);
run("location.hash='#maze';route();start();game.map=game.map.map(r=>r.map(v=>v==='#'?'#':' '));game.tick=1;game.update(.01)");
assert.equal(run('level'),2);assert.ok(run("game.map.some(r=>r.includes('.'))"));assert.equal(run('lives'),3);
console.log('Passed: shield erosion, shot interception, wave repair; Q/E inverse rotation and wall safety; 100 connected, varied mazes and level progression.');
// 2048: one merge per tile, direction mapping, no-op moves, and end states.
run("location.hash='#2048';route();start();game.addTile=()=>{};game.board=[[2,2,2,2],[4,4,8,0],[0,0,0,0],[0,0,0,0]];game.input('ArrowLeft');game.update(.25)");
assert.equal(run('JSON.stringify(game.board[0])'),'[4,4,0,0]');
assert.equal(run('JSON.stringify(game.board[1])'),'[8,8,0,0]');assert.equal(run('score'),16);
run("game.board=[[2,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];game.moves=0;game.input('ArrowLeft');game.update(.25)");assert.equal(run('game.moves'),0);
run("game.board=[[2,0,0,0],[2,0,0,0],[4,0,0,0],[4,0,0,0]];game.input('ArrowDown');game.update(.25)");
assert.equal(run('JSON.stringify(game.board.map(r=>r[0]))'),'[0,0,4,8]');
run("game.board=[[1024,1024,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];game.input('ArrowRight');game.update(.25)");assert.equal(run('mode'),'won');assert.equal(run('game.board[0][3]'),2048);
run("$('start').onclick()");assert.equal(run('mode'),'playing');
run("game.board=[[2,4,2,4],[4,2,4,2],[2,4,2,4],[4,2,4,2]];game.input('ArrowUp');game.update(.25)");assert.equal(run('mode'),'over');
run('start()');assert.equal(run('game.board.flat().filter(Boolean).length'),2);
// Snake: growth, turn buffering, no reversal, food placement, walls and self-collision.
run("location.hash='#snake';route();start();game.food={x:10,y:10};game.input('ArrowRight');game.step()");
assert.equal(run('game.snake.length'),4);assert.equal(run('score'),10);
assert.equal(run('game.snake.some(p=>p.x===game.food.x&&p.y===game.food.y)'),false);
run("game.input('ArrowLeft')");assert.equal(run('game.queue.length'),0);
run("game.input('ArrowUp');game.input('ArrowLeft');game.step();game.step()");assert.equal(run('JSON.stringify(game.snake[0])'),'{"x":9,"y":9}');
run('game.snake=[{x:19,y:0},{x:18,y:0}];game.direction=[1,0];game.queue=[];game.step()');assert.equal(run('mode'),'over');
run('start();game.snake=[{x:2,y:2},{x:2,y:3},{x:3,y:3},{x:3,y:2},{x:4,y:2}];game.direction=[1,0];game.step()');assert.equal(run('mode'),'over');
// Breaker: launch, paddle bounce, brick durability, lives and progression.
run("location.hash='#breaker';route();start();game.input('Space')");assert.equal(run('game.waiting'),false);assert.ok(run('game.ball.vy<0'));
run('game.ball={x:300,y:520,vx:0,vy:300};game.update(.04)');assert.ok(run('game.ball.vy<0'));assert.equal(run('lives'),3);
run('game.ball={x:60,y:44,vx:0,vy:300};game.update(.03)');assert.equal(run('game.bricks[0].hp'),1);assert.equal(run('score'),5);
run('game.ball={x:60,y:44,vx:0,vy:300};game.update(.03)');assert.equal(run('game.bricks.length'),39);assert.equal(run('score'),15);
run('game.ball={x:100,y:609,vx:0,vy:300};game.update(.02)');assert.equal(run('lives'),2);assert.equal(run('game.waiting'),true);
run("game.input('Space');game.bricks=[{x:30,y:55,w:64,h:25,hp:1,row:0}];game.ball={x:60,y:44,vx:0,vy:300};game.update(.03)");assert.equal(run('level'),2);assert.equal(run('game.bricks.length'),40);assert.equal(run('game.waiting'),true);
for(const id of ['2048','snake','breaker']){run(`location.hash='#${id}';route();start();pause()`);assert.equal(run('mode'),'paused');run('pause();start()');assert.equal(run('score'),0);assert.equal(run('mode'),'playing');}
console.log('Passed: 2048 merges, moves and victory; Snake growth and collisions; Breaker physics, lives and levels; new routes and replay.');
// Sliding retains source tiles until arrival and buffers quick swipes in order.
run("location.hash='#2048';route();start();game.addTile=()=>{};game.board=[[0,0,2,2],[0,0,0,0],[0,0,0,0],[0,0,0,0]];game.input('ArrowLeft')");
assert.equal(run('game.animation.motions.length'),2);
assert.ok(run('game.animation.motions.every(m=>m.toX===0&&m.toY===0&&m.value===2)'));
run('game.update(.09)');assert.ok(run('game.animation.elapsed>0&&game.animation.elapsed<game.slideDuration'));
run("game.input('ArrowLeft');game.input('ArrowDown');game.update(.1)");
assert.equal(run('game.moves'),2);assert.ok(run('game.animation.motions.every(m=>m.toY===3)'));
run('game.update(.2)');assert.equal(run('game.animation'),null);assert.equal(run('game.board[3][0]'),4);assert.equal(run('game.pendingMoves.length'),0);
run("game.input('ArrowRight');start()");assert.equal(run('game.animation'),null);
console.log('Passed: tile slide origins, merge destinations, queued swipes, and restart reset.');
// Every intermediate tile position stays on a whole grid cell.
run("location.hash='#2048';route();start();game.addTile=()=>{};game.board=[[0,0,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0]];game.input('ArrowLeft')");
for(const elapsed of [0,.03,.07,.11,.16]){
 run(`game.animation.elapsed=${elapsed}`);
 assert.ok(run(`(()=>{const positions=[];const c={fillRect:(x,y,w,h)=>{if(w===132&&h===132)positions.push([x,y]);},fillText:()=>{}};game.draw(c);return positions.every(([x,y])=>(x-24)%140===0&&(y-24)%140===0);})()`));
}
run("location.hash='#breaker';route();start()");assert.equal(run('game.ball.y+7'),532);
run("held.add('ArrowRight');game.update(.04);held.clear()");assert.equal(run('game.ball.x'),run('game.paddle+game.width/2'));assert.equal(run('game.ball.y+7'),532);
console.log('Passed: grid-snapped tile drawing and ball resting on the paddle.');
