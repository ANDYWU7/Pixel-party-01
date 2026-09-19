'use strict';

class Game2048 {
  constructor(preview = false) {
    this.board = Array.from({length: 4}, () => Array(4).fill(0));
    this.moves = 0;
    this.reached2048 = false;
    this.flash = 0;
    this.animation = null; this.pendingMoves = [];
    this.slideDuration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : .18;
    if (!preview) { this.addTile(); this.addTile(); }
  }
  addTile() {
    const empty = [];
    this.board.forEach((row, y) => row.forEach((v, x) => { if (!v) empty.push([x, y]); }));
    if (!empty.length) return;
    const [x, y] = empty[Math.floor(Math.random() * empty.length)];
    this.board[y][x] = Math.random() < .9 ? 2 : 4;
  }
  canMove() {
    return this.board.some((row, y) => row.some((v, x) => !v ||
      (x < 3 && v === row[x + 1]) || (y < 3 && v === this.board[y + 1][x])));
  }
  input(key) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    if (this.animation) { if (this.pendingMoves.length < 2) this.pendingMoves.push(key); return; }
    let changed = false, gained = 0;
    const motions = [];
    for (let line = 0; line < 4; line++) {
      const cells = Array.from({length: 4}, (_, i) => {
        if (key === 'ArrowLeft') return [i, line];
        if (key === 'ArrowRight') return [3 - i, line];
        if (key === 'ArrowUp') return [line, i];
        return [line, 3 - i];
      });
      const sources = cells.filter(([x,y]) => this.board[y][x]);
      const values = sources.map(([x,y]) => this.board[y][x]);
      const merged = [];
      for (let i = 0; i < values.length; i++) {
        const [toX,toY] = cells[merged.length];
        motions.push({value:values[i],x:sources[i][0],y:sources[i][1],toX,toY});
        if (values[i] === values[i + 1]) {
          motions.push({value:values[i+1],x:sources[i+1][0],y:sources[i+1][1],toX,toY});
          merged.push(values[i] * 2); gained += values[i] * 2; i++;
        } else merged.push(values[i]);
      }
      while (merged.length < 4) merged.push(0);
      cells.forEach(([x, y], i) => {
        if (this.board[y][x] !== merged[i]) changed = true;
        this.board[y][x] = merged[i];
      });
    }
    if (changed) {
      score += gained; this.moves++; this.addTile(); this.flash = gained ? .16 : 0;
      beep(gained ? 520 : 240, .04);
      if (this.slideDuration) this.animation = {motions,elapsed:0};
    }
    hud();
    if (!this.animation) this.finishMove();
  }
  finishMove() {
    if (!this.reached2048 && this.board.some(row => row.some(v => v >= 2048))) {
      this.reached2048 = true;
      if (this.canMove()) {
        mode = 'won'; held.clear(); this.pendingMoves = [];
        overlay('2048!', 'Keep going for a higher tile.', '', 'Keep playing');
        return;
      }
    }
    if (!this.canMove()) { this.pendingMoves = []; finish(); }
  }
  update(dt) {
    if (this.animation) {
      this.animation.elapsed += dt;
      if (this.animation.elapsed >= this.slideDuration) {
        this.animation = null; this.finishMove();
        while (mode === 'playing' && !this.animation && this.pendingMoves.length) this.input(this.pendingMoves.shift());
      }
    } else this.flash = Math.max(0, this.flash - dt);
  }
  draw(c) {
    rect(c, 0, 0, 600, 600, '#171b24');
    const palette = {2:'#dae5eb',4:'#c4d7e6',8:'#91badb',16:'#6396c8',32:'#5678b9',64:'#735da6',128:'#9870b0',256:'#bb81ad',512:'#d18b84',1024:'#e2ac6e',2048:'#f4ce70'};
    const tile = (v,x,y) => {
      const px=24+x*140,py=24+y*140;
      rect(c,px,py,132,132,palette[v]||'#edcb78');
      c.fillStyle=v<=8||v>=1024?'#1e2b39':'#fff';
      c.font='bold '+(v<100?54:v<1000?46:v<10000?38:29)+'px Arial';
      c.textAlign='center';c.textBaseline='middle';c.fillText(String(v),px+66,py+68);
    };
    for(let y=0;y<4;y++)for(let x=0;x<4;x++)rect(c,24+x*140,24+y*140,132,132,'#2b3342');
    if(this.animation){
      const progress=Math.min(1,this.animation.elapsed/this.slideDuration);
      for(const m of this.animation.motions){
        const distance=Math.abs(m.toX-m.x)+Math.abs(m.toY-m.y);
        const steps=Math.min(distance,Math.floor(progress*(distance+1)));
        tile(m.value,m.x+Math.sign(m.toX-m.x)*steps,m.y+Math.sign(m.toY-m.y)*steps);
      }
    }else for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(this.board[y][x])tile(this.board[y][x],x,y);
    if (this.flash && !this.animation) { c.strokeStyle = '#f4ce70'; c.lineWidth = 3; c.strokeRect(19, 19, 562, 562); }
    c.textAlign = 'start'; c.textBaseline = 'alphabetic';
  }
}

class SnakeGame {
  constructor(preview = false) {
    this.snake = [{x: 9, y: 10}, {x: 8, y: 10}, {x: 7, y: 10}];
    this.direction = [1, 0]; this.queue = []; this.timer = 0; this.started = false; this.eaten = 0;
    this.food = preview ? {x: 14, y: 10} : this.newFood();
  }
  newFood() {
    const empty = [];
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      if (!this.snake.some(p => p.x === x && p.y === y)) empty.push({x, y});
    }
    return empty.length ? empty[Math.floor(Math.random() * empty.length)] : null;
  }
  input(key) {
    const next = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[key];
    if (!next || this.queue.length >= 2) return;
    const previous = this.queue[this.queue.length - 1] || this.direction;
    if (next[0] === -previous[0] && next[1] === -previous[1]) return;
    this.started = true;
    if (next[0] !== previous[0] || next[1] !== previous[1]) this.queue.push(next);
  }
  step() {
    if (this.queue.length) this.direction = this.queue.shift();
    const head = {x:this.snake[0].x + this.direction[0], y:this.snake[0].y + this.direction[1]};
    const eats = this.food && head.x === this.food.x && head.y === this.food.y;
    const body = eats ? this.snake : this.snake.slice(0, -1);
    if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20 || body.some(p => p.x === head.x && p.y === head.y)) {
      finish(); return;
    }
    this.snake.unshift(head);
    if (eats) {
      score += 10; this.eaten++; level = 1 + Math.floor(this.eaten / 5); this.food = this.newFood(); beep(660, .06);
      if (!this.food) { finish(); overlay('Board cleared!', `Score: ${score}`, '', 'Play again'); }
    } else this.snake.pop();
    hud();
  }
  update(dt) {
    if (!this.started) return;
    this.timer += dt;
    const interval = Math.max(.065, .16 - (level - 1) * .012);
    if (this.timer >= interval) { this.timer -= interval; this.step(); }
  }
  draw(c) {
    rect(c, 0, 0, 600, 600, '#101e17');
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      rect(c, 20 + x * 28, 20 + y * 28, 28, 28, (x + y) % 2 ? '#172b20' : '#1a3023');
    }
    this.snake.forEach((p, i) => rect(c, 21 + p.x * 28, 21 + p.y * 28, 26, 26, i ? '#78b86a' : '#c3ef86'));
    const h = this.snake[0], [dx, dy] = this.direction;
    for (const offset of [-1, 1]) rect(c, 32 + h.x * 28 + dx * 6 - dy * offset * 5, 32 + h.y * 28 + dy * 6 + dx * offset * 5, 4, 4, '#152c1b');
    if (this.food) {
      rect(c, 25 + this.food.x * 28, 27 + this.food.y * 28, 18, 18, '#f08077');
      rect(c, 34 + this.food.x * 28, 22 + this.food.y * 28, 5, 7, '#addb71');
    }
    if (!this.started) {
      c.fillStyle = '#c6d7c9'; c.font = '16px Courier New'; c.textAlign = 'center';
      c.fillText('Press a direction to begin', 300, 565); c.textAlign = 'start';
    }
  }
}

class BreakerGame {
  constructor() { this.hits=0; this.paddle = 245; this.width = 110; this.wave(); }
  wave() {
    this.bricks = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) {
      this.bricks.push({x:30 + col * 68, y:55 + row * 32, w:64, h:25, hp:row === 0 ? 2 : 1, row});
    }
    this.serve();
  }
  serve() { this.waiting = true; this.ball = {x:this.paddle + this.width / 2, y:525, vx:0, vy:0}; }
  input(key) {
    if (key === 'Space' && this.waiting) {
      const speed = Math.min(500, 310 + (level - 1) * 22);
      this.waiting = false; this.ball.vx = speed * .45; this.ball.vy = -speed * .893;
    }
  }
  update(dt) {
    if (held.has('ArrowLeft')) this.paddle -= 430 * dt;
    if (held.has('ArrowRight')) this.paddle += 430 * dt;
    this.paddle = Math.max(10, Math.min(590 - this.width, this.paddle));
    const b = this.ball, radius = 7;
    if (this.waiting) { b.x = this.paddle + this.width / 2; b.y = 525; return; }
    // Small physics steps keep the ball from passing through thin bricks.
    const steps = Math.max(1, Math.ceil(dt / .004)), step = dt / steps;
    for (let i = 0; i < steps; i++) {
      const oldX = b.x, oldY = b.y;
      b.x += b.vx * step; b.y += b.vy * step;
      if (b.x < 17) { b.x = 17; b.vx = Math.abs(b.vx); }
      if (b.x > 583) { b.x = 583; b.vx = -Math.abs(b.vx); }
      if (b.y < 17) { b.y = 17; b.vy = Math.abs(b.vy); }
      if (b.vy > 0 && oldY + radius <= 532 && b.y + radius >= 532 && b.x >= this.paddle - radius && b.x <= this.paddle + this.width + radius) {
        const hit = Math.max(-1, Math.min(1, (b.x - this.paddle - this.width / 2) / (this.width / 2)));
        const angle = hit * 1.05, speed = Math.min(540, Math.hypot(b.vx, b.vy) + 4);
        b.vx = Math.sin(angle) * speed; b.vy = -Math.cos(angle) * speed; b.y = 525;
        beep(300, .025);
      }
      for (const brick of this.bricks) {
        const nearestX = Math.max(brick.x, Math.min(brick.x + brick.w, b.x));
        const nearestY = Math.max(brick.y, Math.min(brick.y + brick.h, b.y));
        if ((b.x - nearestX) ** 2 + (b.y - nearestY) ** 2 > radius ** 2) continue;
        if (oldY <= brick.y - radius || oldY >= brick.y + brick.h + radius) {
          b.vy *= -1; b.y = oldY;
        } else { b.vx *= -1; b.x = oldX; }
        brick.hp--; this.hits++; score += brick.hp ? 5 : 10; beep(440 + brick.row * 70, .03);
        this.bricks = this.bricks.filter(p => p.hp > 0);
        if (!this.bricks.length) { level++; score += 100; this.wave(); hud(); return; }
        break;
      }
      if (b.y > 610) {
        lives--; beep(110, .12);
        if (lives <= 0) finish(); else this.serve();
        hud(); return;
      }
    }
    hud();
  }
  draw(c) {
    rect(c, 0, 0, 600, 600, '#131925');
    const brickColor = '#8fb7dc';
    for (const brick of this.bricks) {
      rect(c, brick.x, brick.y, brick.w, brick.h, brickColor);
      if (brick.hp > 1) rect(c, brick.x + brick.w / 2 - 3, brick.y + 9, 6, 6, '#294f78');
    }
    rect(c, this.paddle, 532, this.width, 14, '#d9e5ef');
    rect(c, Math.round(this.ball.x) - 7, Math.round(this.ball.y) - 7, 14, 14, '#fff3b6');
    rect(c, 10, 10, 580, 2, '#41516b'); rect(c, 10, 10, 2, 570, '#41516b'); rect(c, 588, 10, 2, 570, '#41516b');
    if (this.waiting) {
      c.fillStyle = '#bdc6d5'; c.font = '16px Courier New'; c.textAlign = 'center';
      c.fillText('Space / tap to launch', 300, 420); c.textAlign = 'start';
    }
  }
}
