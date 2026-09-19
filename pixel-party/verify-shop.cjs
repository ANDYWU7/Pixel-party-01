const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('dist/shop.js','utf8');
const storage=new Map();let lock=Promise.resolve();
function browser(){
 const nodes=new Map(),noop=()=>{};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',style:{},setAttribute:noop,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},replaceChildren:noop,append:noop});return nodes.get(id);};
 const context=vm.createContext({document:{hidden:false,documentElement:{dataset:{},style:{setProperty:noop}},getElementById:node,createElement:()=>({style:{},append:noop})},window:{addEventListener:noop,confirm:()=>false},navigator:{locks:{request:(_,fn)=>{lock=lock.then(fn);return lock;}}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},console,Set,Promise});
 const run=s=>vm.runInContext(s,context);run(source);run('Shop.init()');return {run,node};
}
(async()=>{
 const b=browser();assert.equal(b.run('Shop.profile.points'),0);
 await b.run("Shop.choose('modern')");assert.equal(b.run('Shop.profile.style'),'arcade');
 await b.run('Shop.earn(200)');await b.run("Shop.choose('mint')");assert.equal(b.run('Shop.profile.points'),165);
 await b.run("Shop.choose('mint')");assert.equal(b.run('Shop.profile.points'),165);
 await b.run("Shop.choose('simple')");assert.equal(b.run('Shop.profile.points'),45);
 const reloaded=browser();assert.equal(reloaded.run('Shop.profile.palette'),'mint');assert.equal(reloaded.run('Shop.profile.style'),'simple');assert.equal(reloaded.run('Shop.profile.points'),45);
 await Promise.all([b.run('Shop.earn(10)'),reloaded.run('Shop.earn(10)')]);assert.equal(browser().run('Shop.profile.points'),65);
 for(const id of ['space','blocks','maze','2048','snake','breaker']){
  const result=b.run(`(()=>{Rewards.base=0;Rewards.budget=0;Rewards.begin();let paid=0;const original=Shop.earn;Shop.earn=n=>paid+=n;
   const g={moves:0,placed:0,lines:0,eaten:0,collected:0,defeated:0,hits:0,started:true,waiting:false};
   for(let frame=0;frame<12000;frame++){if(frame%60===0){g.moves+=4;g.placed+=4;g.eaten+=2;g.collected+=25;g.defeated+=5;g.hits+=5;}Rewards.tick(.05,'${id}',g,true);}
   Shop.earn=original;return paid;})()`);
  assert.ok(result>=118&&result<=120,id+' exceeds balanced cap: '+result);
 }
 assert.equal(b.run(`(()=>{Rewards.base=0;Rewards.budget=0;Rewards.begin();let paid=0;const original=Shop.earn;Shop.earn=n=>paid+=n;for(let i=0;i<2400;i++)Rewards.tick(.05,'2048',{moves:0},true);Shop.earn=original;return paid;})()`),0);
 assert.equal(b.run(`(()=>{Rewards.begin();let paid=0;const original=Shop.earn;Shop.earn=n=>paid+=n;for(let i=0;i<2400;i++)Rewards.tick(.05,'snake',{eaten:i,started:true},false);Shop.earn=original;return paid;})()`),0);

 // Reproduce Snake: time before the first food must count, and bonus is separate.
 b.run('Shop.profile=Shop.read()');const snakeBalance=b.run('Shop.profile.points');
 b.run("Rewards.base=0;Rewards.budget=0;Rewards.begin();globalThis.snakeTest={eaten:0,started:true};for(let i=0;i<120;i++)Rewards.tick(.05,'snake',snakeTest,true);snakeTest.eaten=1;Rewards.tick(0,'snake',snakeTest,true);for(let i=0;i<60;i++)Rewards.tick(.05,'snake',snakeTest,true);snakeTest.eaten=2;Rewards.tick(0,'snake',snakeTest,true)");
 assert.equal(b.run('Rewards.pending'),1);assert.equal(b.run('Rewards.bonusPoints'),0);
 assert.match(b.node('bonus-status').textContent,/1 bonus point ready/);
 b.run("for(let i=0;i<20;i++)Rewards.tick(.05,'snake',snakeTest,true)");
 await b.run('Shop.chain');assert.equal(b.run('Rewards.timePoints'),1);assert.equal(b.run('Rewards.bonusPoints'),1);assert.equal(b.run('Shop.profile.points'),snakeBalance+2);
 b.run("snakeTest.eaten=4;Rewards.tick(0,'snake',snakeTest,true);for(let i=0;i<200;i++)Rewards.tick(.05,'snake',snakeTest,true)");
 await b.run('Shop.chain');assert.equal(b.run('Rewards.timePoints'),2);assert.equal(b.run('Rewards.bonusPoints'),2);assert.equal(b.run('Shop.profile.points'),snakeBalance+4);
 b.run("Rewards.tick(0,'snake',snakeTest,true)");await b.run('Shop.chain');assert.equal(b.run('Shop.profile.points'),snakeBalance+4);
 assert.match(b.node('run-points').textContent,/2 time \+ 2 bonus/);
 console.log('Passed: two Snake foods pay one bonus at 10 active seconds; four foods pay two at 20 seconds; wallet receives both time and bonus exactly once.');

 const balanceBeforeSecret=b.run('Shop.read().points');
 b.node('test-points').listeners.dblclick({preventDefault:()=>{}});b.node('test-points').listeners.dblclick({preventDefault:()=>{}});await b.run('Shop.chain');
 assert.equal(b.run('Shop.profile.points'),balanceBeforeSecret+1000);
 await b.node('theme-toggle').onclick();assert.equal(b.run('Shop.profile.mode'),'light');assert.equal(browser().run('Shop.profile.mode'),'light');await b.run("Shop.choose('modern')");assert.equal(b.run('Shop.profile.mode'),'light');await b.node('theme-toggle').onclick();assert.equal(b.run('Shop.profile.mode'),'dark');
 const beforeReset=b.run('JSON.stringify(Shop.profile)');await b.node('reset-progress').onclick();assert.equal(b.run('JSON.stringify(Shop.profile)'),beforeReset);
 storage.set('unrelated-key','keep');b.run('window.confirm=()=>true');await b.node('reset-progress').onclick();
 assert.equal(b.run('Shop.profile.points'),0);assert.equal(b.run('Shop.profile.style'),'arcade');assert.equal(b.run('Shop.profile.palette'),'classic');assert.equal(b.run('Shop.profile.owned.length'),2);assert.equal(b.run('Rewards.base'),0);assert.equal(browser().run('Shop.profile.points'),0);assert.equal(storage.get('unrelated-key'),'keep');
 console.log('Passed: repeated 500-point double-click credits, cancelled reset, confirmed reset, reload, and unrelated storage preservation.');
 b.run('Shop.profile=Shop.read()');const before=b.run('Shop.profile.points');b.run("localStorage.setItem=()=>{throw Error('blocked')}");await b.run('Shop.earn(2)');await b.run('Shop.earn(3)');assert.equal(b.run('Shop.profile.points'),before+5);assert.equal(b.run('Shop.storageOK'),false);
 assert.equal(b.run("cleanProfile({points:-12,owned:['fake'],style:'modern'}).points"),0);assert.equal(b.run("cleanProfile({style:'modern'}).style"),'arcade');
 console.log('Passed: purchase limits, no double charges, reload persistence, cross-tab credits, all six earning caps, no idle/paused rewards, and unavailable storage fallback.');
})().catch(error=>{console.error(error);process.exitCode=1;});
