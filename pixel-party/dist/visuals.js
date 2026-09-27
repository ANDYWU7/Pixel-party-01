'use strict';
// Rendering is separate from the games' grid positions, timing, and collisions.
const GameVisuals = {
  get style() { return document.documentElement.dataset.style || 'arcade'; },
  get modern() { return this.style === 'modern'; },
  get smooth() { return this.modern && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; },
  mix(a,b,t) {
    const rgb = h => [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
    const x=rgb(a),y=rgb(b);
    return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');
  },
  theme() {
    const item=SHOP_ITEMS.find(i=>i.id===Shop.profile.palette),[bg,panel,accent]=item.colors;
    const light=Shop.profile.mode==='light';
    return {bg:light?'#ffffff':bg,panel:light?this.mix(accent,'#ffffff',.88):panel,
      ink:light?panel:'#f4f7ff',accent:light?this.mix(accent,panel,.58):accent,
      line:light?this.mix(panel,'#ffffff',.65):this.mix(panel,accent,.28),
      colors:[accent,'#78cfe0','#b89af0','#8ed1a7','#ed99a9','#8baee9','#e7b881']};
  },
  prepare(canvas,w=600,h=600) {
    const ratio=this.style==='arcade'?1:Math.min(3,Math.max(2,window.devicePixelRatio||1));
    if(canvas.width!==w*ratio||canvas.height!==h*ratio){canvas.width=w*ratio;canvas.height=h*ratio;}
    const c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);c.imageSmoothingEnabled=this.style!=='arcade';
    return c;
  },
  paint(c,color,x,y,w,h) {
    if(!this.modern)return color;
    const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,this.mix(color,'#ffffff',.24));g.addColorStop(1,color);return g;
  },
  box(c,x,y,w,h,color,r=6,glow=0) {
    c.save();c.fillStyle=this.paint(c,color,x,y,w,h);
    if(this.modern){c.shadowColor=color;c.shadowBlur=glow;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
    else c.fillRect(x,y,w,h);
    c.restore();
  },
  polygon(c,points,color,glow=0) {
    c.save();c.fillStyle=this.paint(c,color,points[0][0],points[0][1],30,30);
    if(this.modern){c.shadowColor=color;c.shadowBlur=glow;}
    c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.restore();
  },
  circle(c,x,y,r,color,glow=0) {
    if(!this.modern){this.box(c,x-r,y-r,r*2,r*2,color);return;}
    c.save();c.fillStyle=this.paint(c,color,x-r,y-r,r*2,r*2);c.shadowColor=color;c.shadowBlur=glow;
    c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.restore();
  },
  background(c,t,w=600,h=600) {
    c.fillStyle=this.modern?this.paint(c,t.bg,0,0,w,h):t.bg;c.fillRect(0,0,w,h);
  },
  text(c,text,x,y,size=16,color=this.theme().ink) {
    c.save();c.fillStyle=color;c.font=`500 ${size}px Arial, sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,x,y);c.restore();
  },
  position(p,elapsed,duration) {
    if(!this.smooth||!p.from)return p;
    const t=Math.max(0,Math.min(1,elapsed/duration));
    return {x:p.from.x+(p.x-p.from.x)*t,y:p.from.y+(p.y-p.from.y)*t};
  },
  tilePosition(m,progress) {
    if(this.smooth){const t=1-(1-progress)**3;return {x:m.x+(m.toX-m.x)*t,y:m.y+(m.toY-m.y)*t};}
    const distance=Math.abs(m.toX-m.x)+Math.abs(m.toY-m.y),steps=Math.min(distance,Math.floor(progress*(distance+1)));
    return {x:m.x+Math.sign(m.toX-m.x)*steps,y:m.y+Math.sign(m.toY-m.y)*steps};
  },
  draw(id,g,c) {
    if(this.style==='arcade')return false;
    c.save();const t=this.theme();this.background(c,t);this[id](g,c,t);c.restore();return true;
  },
  space(g,c,t) {
    // Solid bunker strips keep the same destructible seven-unit collision grid.
    for(const hp of [1,2]){
      c.fillStyle=this.paint(c,hp===2?t.accent:this.mix(t.accent,t.bg,.5),0,460,600,42);c.beginPath();
      for(const b of g.shields)if(b.hp===hp)c.rect(b.x,b.y,7,7);c.fill();
    }
    for(const e of g.enemies){
      if(this.modern){this.box(c,e.x,e.y+4,32,20,e.type?t.colors[2]:t.accent,9,8);this.circle(c,e.x+10,e.y+13,2,t.bg);this.circle(c,e.x+22,e.y+13,2,t.bg);}
      else this.polygon(c,[[e.x,e.y+22],[e.x+8,e.y+4],[e.x+24,e.y+4],[e.x+32,e.y+22]],t.accent);
    }
    if(g.invulnerable<=0||Math.floor(g.invulnerable*10)%2)this.polygon(c,[[g.x,565],[g.x+17.5,540],[g.x+35,565],[g.x+17.5,559]],t.accent,14);
    for(const s of g.shots)this.box(c,s.x-2,s.y,4,15,t.accent,2,10);
    for(const b of g.bombs)this.box(c,b.x-2,b.y,4,11,t.colors[4],2,8);
    if(this.modern)for(const p of g.particles)this.circle(c,p.x,p.y,2,t.accent,8);
    this.box(c,15,579,570,1,t.line,0);
  },
  blocks(g,c,t) {
    const ox=106,oy=20,s=28;
    const tile=(x,y,size,type)=>this.box(c,x+1,y+1,size-2,size-2,this.modern?t.colors[type%7]:t.accent,4,3);
    this.box(c,ox,oy,280,560,t.panel,8);
    for(let y=0;y<20;y++)for(let x=0;x<10;x++)if(g.board[y][x])tile(ox+x*s,oy+y*s,s,g.board[y][x]-1);
    let gy=g.y;while(g.valid(g.x,gy+1,g.piece))gy++;
    c.strokeStyle=t.line;c.lineWidth=1.5;
    g.piece.forEach((row,j)=>row.forEach((v,i)=>{if(v){c.strokeRect(ox+(g.x+i)*s+2,oy+(gy+j)*s+2,s-4,s-4);tile(ox+(g.x+i)*s,oy+(g.y+j)*s,s,g.type);}}));
    this.text(c,'NEXT',470,49,14,t.ink);
    shapes[g.next].forEach((row,j)=>row.forEach((v,i)=>{if(v)tile(425+i*23,73+j*23,23,g.next);}));
  },
  maze(g,c,t) {
    const s=26,ox=53,oy=27;
    // Draw joined wall silhouettes; shared cell edges never appear as pixel tiles.
    c.save();c.fillStyle=this.modern?this.paint(c,t.panel,ox,oy,494,546):t.panel;
    for(let y=0;y<21;y++)for(let x=0;x<19;x++)if(g.map[y][x]==='#')c.fillRect(ox+x*s,oy+y*s,s,s);
    c.strokeStyle=t.line;c.lineWidth=this.modern?2:1;
    if(this.modern){c.shadowColor=t.accent;c.shadowBlur=4;}
    c.beginPath();
    for(let y=0;y<21;y++)for(let x=0;x<19;x++)if(g.map[y][x]==='#'){
      const px=ox+x*s,py=oy+y*s;
      for(const [dx,dy,a,b] of [[0,-1,[px,py],[px+s,py]], [1,0,[px+s,py],[px+s,py+s]], [0,1,[px,py+s],[px+s,py+s]], [-1,0,[px,py],[px,py+s]]]){
        if(g.map[y+dy]?.[x+dx]!=='#'){c.moveTo(...a);c.lineTo(...b);}
      }
    }c.stroke();c.restore();
    for(let y=0;y<21;y++)for(let x=0;x<19;x++){
      const v=g.map[y][x];if(v==='.'||v==='o')this.circle(c,ox+x*s+s/2,oy+y*s+s/2,v==='o'?5:2,t.accent,v==='o'?9:0);
    }
    const p=this.position(g.player,g.tick,.115),px=ox+p.x*s+s/2,py=oy+p.y*s+s/2;
    if(g.invulnerable<=0||Math.floor(g.frame*8)%2){
      c.save();c.translate(px,py);c.rotate(Math.atan2(g.player.dy,g.player.dx));
      if(this.modern){c.fillStyle=this.paint(c,t.accent,-11,-11,22,22);c.shadowColor=t.accent;c.shadowBlur=10;c.beginPath();c.moveTo(0,0);const mouth=.18+Math.abs(Math.sin(g.frame*12))*.35;c.arc(0,0,11,mouth,Math.PI*2-mouth);c.closePath();c.fill();}
      else this.polygon(c,[[-10,-10],[10,0],[-10,10],[-5,0]],t.accent);
      c.restore();
    }
    const duration=Math.max(.125,.28-level*.016)*(g.power>0?1.6:1);
    for(const a of g.ghosts){const p=this.position(a,g.ghostTick,duration),x=ox+p.x*s+s/2,y=oy+p.y*s+s/2,color=g.power>0?'#719aee':a.color;
      if(this.modern){this.box(c,x-10,y-10,20,20,color,8,9);this.circle(c,x-4,y-1,2,'#ffffff');this.circle(c,x+4,y-1,2,'#ffffff');}
      else this.polygon(c,[[x,y-10],[x+10,y],[x,y+10],[x-10,y]],g.power>0?t.line:t.ink);
    }
    if(g.power>0)this.text(c,'POWER '+Math.ceil(g.power)+'s',110,587,12,t.accent);
  },
  tiles(g,c,t) {
    const tile=(v,x,y)=>{const px=24+x*140,py=24+y*140,k=Math.log2(v);
      const color=this.modern?this.mix(t.colors[(k-1)%7],t.panel,.18):t.panel;
      this.box(c,px,py,132,132,color,13,this.modern?7:0);
      if(!this.modern){c.strokeStyle=t.line;c.lineWidth=1;c.strokeRect(px+.5,py+.5,131,131);}
      this.text(c,String(v),px+66,py+68,v<100?54:v<1000?46:v<10000?38:29,this.modern?'#16202c':t.ink);
    };
    for(let y=0;y<4;y++)for(let x=0;x<4;x++)this.box(c,24+x*140,24+y*140,132,132,t.panel,13);
    if(g.animation){for(const m of g.animation.motions){const p=this.tilePosition(m,Math.min(1,g.animation.elapsed/g.slideDuration));tile(m.value,p.x,p.y);}}
    else for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(g.board[y][x])tile(g.board[y][x],x,y);
  },
  snake(g,c,t) {
    this.box(c,20,20,560,560,t.panel,10);
    const interval=Math.max(.065,.16-(level-1)*.012);
    const points=g.snake.map((p,i)=>this.position({x:p.x,y:p.y,from:g.previous?.[Math.min(i,g.previous.length-1)]},g.timer,interval));
    // Following each segment's previous cell keeps turns on the orthogonal path.
    const path=this.smooth&&g.previous?[points[0],...g.previous.slice(0,Math.min(g.snake.length-1,g.previous.length)),points[points.length-1]]:points;
    c.save();c.strokeStyle=this.modern?this.paint(c,t.accent,20,20,560,560):t.accent;c.lineWidth=23;c.lineJoin=this.modern?'round':'miter';c.lineCap=this.modern?'round':'square';
    if(this.modern){c.shadowColor=t.accent;c.shadowBlur=12;}
    c.beginPath();path.forEach((p,i)=>i?c.lineTo(34+p.x*28,34+p.y*28):c.moveTo(34+p.x*28,34+p.y*28));c.stroke();c.restore();
    const h=points[0],[dx,dy]=g.direction;
    if(this.modern)for(const offset of [-1,1])this.circle(c,34+h.x*28+dx*6-dy*offset*5,34+h.y*28+dy*6+dx*offset*5,2,t.bg);
    if(g.food)this.circle(c,34+g.food.x*28,34+g.food.y*28,8,this.modern?'#f08077':t.ink,12);
    if(!g.started)this.text(c,'Press a direction to begin',300,565,16,t.ink);
  },
  breaker(g,c,t) {
    for(const b of g.bricks){this.box(c,b.x,b.y,b.w,b.h,this.modern?t.colors[b.row%7]:t.accent,5,5);if(b.hp>1)this.box(c,b.x+8,b.y+b.h/2-1,b.w-16,2,t.bg,0);}
    this.box(c,g.paddle,532,g.width,14,t.accent,7,10);
    this.circle(c,g.ball.x,g.ball.y,7,t.ink,12);
    c.strokeStyle=t.line;c.lineWidth=2;c.beginPath();c.moveTo(10,580);c.lineTo(10,10);c.lineTo(590,10);c.lineTo(590,580);c.stroke();
    if(g.waiting)this.text(c,'Space / tap to launch',300,420,16,t.ink);
  }
};
