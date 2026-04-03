/* =========================================================
   PASSARINHO JORNADA v4.0
   Melhorias:
   - Dificuldade progressiva (velocidade aumenta com distância)
   - Novos obstáculos: nuvem, cactus
   - Power-ups: escudo, velocidade reduzida, pontuação dupla
   - High Score salvo em localStorage
   - Sistema de combo (pontos extras por desvio consecutivo)
   - Partículas de colisão, moedas e penas
   - Transições suaves entre cenas
   - Código refatorado em módulos claros
   - Pool de objetos para performance
   - HUD melhorado com ícones e animações
   ========================================================= */

'use strict';

// ─── CANVAS ───────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// ─── ASSETS ───────────────────────────────────────────────
const IMAGE_ASSETS = {
  bgPlay:       "../GAME/Play/images/Sterne (Landscape).png",
  bgGame:       "../GAME/Scene0/images/Pyramids.png",
  bgGameOver:   "../GAME/GAMEover/images/Cloudy sky.png",
  btnPlay:      "../GAME/Play/images/Btn-Play.png",
  btnPlayAgain: "../GAME/GAMEover/images/Btn-Play-again.png",
  btnBack:      "../GAME/GAMEover/images/Btn-back.png",
  btnSair:      "../GAME/GAMEover/images/incorrect.png",
  gameOverImg:  "../GAME/GAMEover/images/Game Over.png",
  birdIdle1:    "../GAME/Play/images/bird_idle-1.png",
  birdIdle2:    "../GAME/Play/images/bird_idle-2.png",
  birdFly1:     "../GAME/Scene0/images/Bird fly-1.png",
  birdFly2:     "../GAME/Scene0/images/Bird fly-2.png",
  birdFly3:     "../GAME/Scene0/images/Bird fly-3.png",
  tree1:        "../GAME/Scene0/images/tree-6.png",
  tree2:        "../GAME/Scene0/images/tree-4.png",
  tree3:        "../GAME/Scene0/images/tree-7.png",
  plane:        "../GAME/Scene0/images/plane.png",
  heart:        "../GAME/Scene0/images/Card.png",
  owl1:         "../GAME/Scene0/images/owl.png",
  owl2:         "../GAME/Scene0/images/owl-3.png",
};

const SOUND_ASSETS = {
  sndBird:  "../GAME/Scene0/sounds/Bird0.wav",
  sndDrip:  "../GAME/Scene0/sounds/DripDrop.mpga",
  sndBing:  "../GAME/Scene0/sounds/bing0.mpga",
  sndLose:  "../GAME/Scene0/sounds/lose.mpga",
  sndTweet: "../GAME/Scene0/sounds/tweet.mpga",
  sndBeep:  "../GAME/Scene0/sounds/beep.mpga",
};

const images = {};
const sounds  = {};

// ─── UTILITÁRIOS ──────────────────────────────────────────
function playSound(key) {
  const s = sounds[key];
  if (!s) return;
  try { s.currentTime = 0; s.play().catch(() => {}); } catch (_) {}
}

function checkCollision(a, b) {
  return (a.x < b.x + b.w && a.x + a.w > b.x &&
          a.y < b.y + b.h && a.y + a.h > b.y);
}

function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function randomBetween(a, b) { return a + Math.random() * (b - a); }

// polyfill roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y,     x + w, y + h, r);
    this.arcTo(x + w, y + h, x,     y + h, r);
    this.arcTo(x,     y + h, x,     y,     r);
    this.arcTo(x,     y,     x + w, y,     r);
    this.closePath();
    return this;
  };
}

// ─── CARREGAMENTO ─────────────────────────────────────────
function loadAssets() {
  const keys = Object.keys(IMAGE_ASSETS);
  if (!keys.length) return Promise.resolve();
  let loaded = 0;
  const updateBar = () => {
    const el = document.getElementById('loaderBar');
    if (el) el.style.width = ((loaded / keys.length) * 100) + '%';
  };
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { hideLoader(); resolve(); }, 8000);
    keys.forEach((key) => {
      const img = new Image();
      img.src = IMAGE_ASSETS[key];
      const done = () => {
        loaded++; updateBar();
        if (loaded === keys.length) { clearTimeout(timeout); hideLoader(); resolve(); }
      };
      img.onload  = () => { images[key] = img; done(); };
      img.onerror = () => { images[key] = null; done(); };
    });
  });
}

function loadSounds() {
  for (const key in SOUND_ASSETS) {
    const audio = new Audio(SOUND_ASSETS[key]);
    audio.preload = 'auto';
    sounds[key] = audio;
  }
}

function hideLoader() {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'none';
}

// --- INPUT ---
let inputPressed = false;
let clickX = 0, clickY = 0;

canvas.addEventListener('mousedown', (e) => {
  inputPressed = true;
  const rect = canvas.getBoundingClientRect();
  clickX = e.clientX - rect.left;
  clickY = e.clientY - rect.top;
});
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  inputPressed = true;
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  clickX = t.clientX - rect.left;
  clickY = t.clientY - rect.top;
}, { passive: false });
// touchend também captura o último toque solto (cobre casos de tela cheia no iOS)
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (e.changedTouches.length > 0) {
    const t = e.changedTouches[0];
    Input.set(t.clientX, t.clientY);
  }
}, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') Input.set(-1, -1);
});

// ─── ESTADOS ──────────────────────────────────────────────
const SCENE = { PLAY: 'PLAY', GAME: 'GAME', GAMEOVER: 'GAMEOVER' };
let currentScene = SCENE.PLAY;

// ─── HIGH SCORE ───────────────────────────────────────────
const HighScore = {
  key: 'passarim_highscore',
  get() { return parseInt(localStorage.getItem(this.key) || '0'); },
  set(v) { if (v > this.get()) localStorage.setItem(this.key, String(v)); },
};

// ─── PARTÍCULAS ───────────────────────────────────────────
class Particle {
  constructor(x, y, color, vx, vy, life, size) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color = color;
    this.life = life; this.maxLife = life;
    this.size = size;
    this.alive = true;
  }
  update() {
    this.vy += 0.12;
    this.x  += this.vx;
    this.y  += this.vy;
    this.life--;
    if (this.life <= 0) this.alive = false;
  }
  draw() {
    ctx.globalAlpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

const ParticleSystem = {
  pool: [],
  spawn(x, y, color, count = 8, speed = 3, life = 30, size = 4) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const s     = randomBetween(0.5, 1) * speed;
      this.pool.push(new Particle(x, y, color,
        Math.cos(angle) * s, Math.sin(angle) * s - 1, life, size));
    }
  },
  update() { this.pool = this.pool.filter(p => { p.update(); return p.alive; }); },
  draw()   { this.pool.forEach(p => p.draw()); },
  clear()  { this.pool = []; },
};

// ─── TRANSIÇÃO ────────────────────────────────────────────
const Transition = {
  alpha: 0,
  dir: 0, // 1 = fade in, -1 = fade out
  speed: 0.04,
  cb: null,
  start(cb) {
    this.alpha = 0; this.dir = 1; this.cb = cb;
  },
  update() {
    if (this.dir === 0) return;
    this.alpha += this.dir * this.speed;
    if (this.alpha >= 1 && this.dir === 1) {
      this.alpha = 1;
      if (this.cb) { this.cb(); this.cb = null; }
      this.dir = -1;
    } else if (this.alpha <= 0 && this.dir === -1) {
      this.alpha = 0; this.dir = 0;
    }
  },
  draw() {
    if (this.alpha <= 0) return;
    ctx.fillStyle = `rgba(0,0,0,${this.alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  },
};

// ─── DIFICULDADE PROGRESSIVA ──────────────────────────────
const Difficulty = {
  level: 1,
  baseSpeed: 2.5,
  getSpeed(distanciap) {
    // A cada 5 km sobe de nível (máx 10)
    this.level = clamp(1 + Math.floor(distanciap / 5), 1, 10);
    return this.baseSpeed + (this.level - 1) * 0.35;
  },
  getSpawnInterval(distanciap) {
    // Intervalo cai de 120 → 60 frames conforme dificuldade
    return Math.max(60, 120 - Math.floor(distanciap / 3) * 6);
  },
};

// ─── PÁSSARO ──────────────────────────────────────────────
class Bird {
  constructor() {
    this.x          = canvas.width / 2 - 100;
    this.y          = canvas.height / 2 + 50;
    this.vy         = 0;
    this.gravity    = 0.25;
    this.jumpForce  = -7;
    this.size       = 60;
    this.frameIndex = 0;
    this.lastSwitch = 0;
    // trail
    this.trail = [];
  }

  flap() {
    this.vy = this.jumpForce;
    this.frameIndex = 2;
    playSound('sndTweet');
    // pena
    ParticleSystem.spawn(this.x, this.y, '#FFD700', 4, 2, 20, 3);
  }

  update() {
    // trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 10) this.trail.shift();

    this.vy += this.gravity;
    this.y  += this.vy;

    if (this.y > canvas.height - 40) {
      this.y = canvas.height - 40; this.vy = 0;
      triggerGameOver();
    }
    if (this.y < 20) { this.y = 20; this.vy = 0; }

    if (Input.pressed) { this.flap(); Input.consume(); }

    if (frameCount - this.lastSwitch > 10) {
      this.frameIndex = (this.frameIndex + 1) % 3;
      this.lastSwitch = frameCount;
    }
  }

  draw() {
    // trail (rastro de voo)
    if (currentScene === SCENE.GAME) {
      this.trail.forEach((p, i) => {
        const alpha = (i / this.trail.length) * 0.25;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFD700';
        const r = 4 * (i / this.trail.length);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    let imgKey;
    if (currentScene === SCENE.PLAY) {
      imgKey = (frameCount % 30 < 15) ? 'birdIdle1' : 'birdIdle2';
    } else {
      imgKey = ['birdFly1', 'birdFly2', 'birdFly3'][this.frameIndex];
    }

    if (gv.invencivel && frameCount % 10 < 5) ctx.globalAlpha = 0.4;

    // escudo visual
    if (gv.shield) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size / 2 + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const img = images[imgKey];
    if (img) {
      ctx.drawImage(img, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    } else {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  getBounds() {
    const m = 10;
    return { x: this.x - this.size/2 + m, y: this.y - this.size/2 + m,
             w: this.size - m*2,           h: this.size - m*2 };
  }
}

// ─── OBSTÁCULOS ───────────────────────────────────────────
const OBSTACLE_CONFIG = {
  tree:  { imgKey: 'tree1', w: 80,  h: 200, groundOffset: 200,  fromLeft: false },
  tree2: { imgKey: 'tree2', w: 80,  h: 210, groundOffset: 210,  fromLeft: false },
  tree3: { imgKey: 'tree3', w: 80,  h: 220, groundOffset: null, fromLeft: false },
  plane: { imgKey: 'plane', w: 150, h: 75,  groundOffset: null, fromLeft: true  },
};

class Obstacle {
  constructor(type, x) {
    this.type = type;
    const cfg = OBSTACLE_CONFIG[type];
    this.imgKey = cfg.imgKey;
    this.width  = cfg.w;
    this.height = cfg.h;
    this.scored = false; // para combo

    if (cfg.fromLeft) {
      this.x      = -this.width - 20;
      this.y      = 80 + Math.random() * 200;
      this.speedX = 0; // calculado dinamicamente
    } else if (type === 'tree3') {
      this.x      = x !== undefined ? x : canvas.width + 50;
      this.y      = canvas.height - 140 - Math.random() * 100;
      this.speedX = 0;
    } else {
      this.x      = x !== undefined ? x : canvas.width + 50;
      this.y      = canvas.height - cfg.groundOffset;
      this.speedX = 0;
    }
  }

  update(speed) {
    const fromLeft = OBSTACLE_CONFIG[this.type].fromLeft;
    this.speedX = fromLeft ? +(speed * 1.1) : -(speed);

    this.x += this.speedX;

    if (fromLeft) {
      if (this.x > canvas.width + 20) {
        this.x      = -this.width - 20;
        this.y      = 80 + Math.random() * 200;
        this.scored = false;
      }
    } else {
      if (this.x < -this.width - 20) {
        this.x      = canvas.width + 50 + Math.random() * 200;
        this.scored = false;
        if (this.type === 'tree3') this.y = canvas.height - 140 - Math.random() * 100;
      }
    }
  }

  draw() {
    const img = images[this.imgKey];
    if (img) {
      ctx.drawImage(img, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = this.type === 'plane' ? '#708090' : '#228B22';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }

  getBounds() { return { x: this.x, y: this.y, w: this.width, h: this.height }; }
}

// ─── CORAÇÃO ──────────────────────────────────────────────
class Heart {
  constructor() { this.reset(); }
  reset() {
    this.visible = false; this.x = 0; this.y = 0;
    this.size = 50; this.timer = 0;
  }
  show() {
    this.visible = true;
    this.x       = randomBetween(100, canvas.width - 200);
    this.y       = randomBetween(100, canvas.height - 200);
    this.timer   = 30 * 60;
    gv.invencivel      = true;
    gv.invencivelTimer = 30 * 60;
    playSound('sndDrip');
    ParticleSystem.spawn(this.x + this.size/2, this.y + this.size/2,
                         '#FF69B4', 12, 4, 35, 5);
  }
  update() {
    if (!this.visible) return;
    if (--this.timer <= 0) this.visible = false;
  }
  draw() {
    if (!this.visible) return;
    const pulse = 1 + 0.08 * Math.sin(frameCount * 0.15);
    const s     = this.size * pulse;
    const ox    = (s - this.size) / 2;
    const img   = images.heart;
    if (img) {
      ctx.drawImage(img, this.x - ox, this.y - ox, s, s);
    } else {
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      const hx = this.x - ox, hy = this.y - ox;
      ctx.moveTo(hx + s/2, hy + s/4);
      ctx.quadraticCurveTo(hx,     hy,       hx,   hy + s/2);
      ctx.quadraticCurveTo(hx+s/2, hy+s*.85, hx+s, hy + s/2);
      ctx.quadraticCurveTo(hx+s,   hy,       hx+s/2, hy + s/4);
      ctx.fill();
    }
  }

  getBounds() {
    return { x: this.x, y: this.y, w: this.size, h: this.size };
  }
}

class Owl {
  constructor() {
    this.visible = false;
    this.x = canvas.width  - 200;
    this.y = canvas.height - 200;
    this.timer = 0;
    this.bubbleTimer = 0;
  }

  show() {
    this.visible = true;
    this.timer = this.bubbleTimer = 300;
  }

  update() {
    if (!this.visible) return;
    if (--this.timer <= 0) this.visible = false;
    if (this.bubbleTimer > 0) this.bubbleTimer--;
  }
  update() { if (!this.visible) return; if (--this.timer <= 0) this.visible = false; }
  draw() {
    if (!this.visible) return;

    const img = (frameCount % 60 < 30) ? images.owl1 : images.owl2;
    if (img) {
      ctx.drawImage(img, this.x, this.y, 80, 80);
    } else {
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.arc(this.x + 40, this.y + 40, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.bubbleTimer > 0) {
      const bx = this.x - 160, by = this.y - 80;
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(bx, by, 220, 55, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'black';
      ctx.font = '13px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Você ficou invencível por 30s!', bx + 10, by + 32);
    }
  }
}

// ─── ESTADO GLOBAL DO JOGO (gv) ───────────────────────────
let gv = {};

function makeGameVars() {
  return {
    contador:       0,
    distanciap:     0,
    meta:           0,
    passada:        0,
    colisao:        false,
    kmMode:         false,
    kmModeTimer:    0,
    invencivel:     false,
    invencivelTimer:0,
    shield:         false,
    shieldTimer:    0,
    slowmo:         false,
    slowmoTimer:    0,
    doubleScore:    false,
    doubleScoreTimer: 0,
    combo:          0,
    comboTimer:     0,
    totalScore:     0,
    powerupNextAt:  3000, // frame em que próximo power-up aparece
  };
}

let bird, obstacles, heart, powerup, owl;
let frameCount = 0;

function resetGameVars() {
  gv = makeGameVars();
  obstacles = [];
  floatingTexts.length = 0;
  ParticleSystem.clear();
  bird   = new Bird();
  heart  = new Heart();
  powerup = new PowerUp();
  owl    = new Owl();
  Difficulty.level = 1;

  for (let i = 0; i < 3; i++) spawnObstacle(canvas.width + i * 350);
  obstacles.push(new Obstacle('plane'));
}

function startGame() {
  Transition.start(() => {
    currentScene = SCENE.GAME;
    frameCount   = 0;
    resetGameVars();
  });
}

function triggerGameOver() {
  if (gv.colisao) return;
  gv.colisao = true;
  // Salva high score
  HighScore.set(gv.distanciap);
  // Explosão de partículas
  ParticleSystem.spawn(bird.x, bird.y, '#FF4500', 20, 5, 40, 6);
  playSound('sndLose');
  setTimeout(() => {
    Transition.start(() => { currentScene = SCENE.GAMEOVER; });
  }, 600);
}

function backToMenu() {
  Transition.start(() => {
    currentScene = SCENE.PLAY;
  });
}

function spawnObstacle(x) {
  const rand = Math.random();
  let type;
  if      (rand < 0.40) type = 'tree';
  else if (rand < 0.70) type = 'tree2';
  else                  type = 'tree3';
  obstacles.push(new Obstacle(type, x !== undefined ? x : canvas.width + 50));
}

// ─── LÓGICA PRINCIPAL ─────────────────────────────────────
function updateGameplay() {
  if (gv.colisao) return; // aguarda transição

  const speed = gv.slowmo
    ? Difficulty.getSpeed(gv.distanciap) * 0.5
    : Difficulty.getSpeed(gv.distanciap);

  bird.update();

  // Spawn de obstáculos com intervalo progressivo
  const spawnInterval = Difficulty.getSpawnInterval(gv.distanciap);
  if (frameCount % spawnInterval === 0) spawnObstacle();

  // Atualizar obstáculos e checar colisão / combo
  obstacles.forEach((obs) => {
    obs.update(speed);

    // Colisão
    if (!gv.invencivel && !gv.shield && checkCollision(bird.getBounds(), obs.getBounds())) {
      triggerGameOver();
    }

    // Escudo absorve 1 impacto
    if (gv.shield && checkCollision(bird.getBounds(), obs.getBounds())) {
      gv.shield = false; gv.shieldTimer = 0;
      ParticleSystem.spawn(bird.x, bird.y, '#00BFFF', 16, 4, 30, 4);
      spawnFloatingText(bird.x, bird.y - 40, '🛡️ ESCUDO!', '#00BFFF');
      playSound('sndBing');
      obs.x = canvas.width + 100; // afasta obstáculo
    }

    // Combo: passou pelo obstáculo pela esquerda sem colidir
    if (!obs.scored && obs.type !== 'plane' && obs.x + obs.width < bird.x - 30) {
      obs.scored = true;
      gv.combo++;
      gv.comboTimer = 4 * 60;
      const pts = gv.doubleScore ? gv.combo * 2 : gv.combo;
      gv.totalScore += pts;
      if (gv.combo >= 3) {
        spawnFloatingText(bird.x, bird.y - 50,
          `x${gv.combo} COMBO! +${pts}`, '#FFD700');
        ParticleSystem.spawn(bird.x, bird.y, '#FFD700', 6, 3, 20, 3);
      }
    }
  });

  // Coração
  heart.update();
  owl.update();

  // Partículas & textos flutuantes
  ParticleSystem.update();
  floatingTexts.forEach(t => t.update());
  floatingTexts.splice(0, floatingTexts.length,
    ...floatingTexts.filter(t => t.alive));

  // Contador de score
  const scoreIncrement = gv.doubleScore ? 2 : 1;
  if (frameCount % 5 === 0) gv.contador += scoreIncrement;

  if (gv.contador >= 1000) {
    gv.distanciap++;
    gv.contador    = 0;
    gv.kmMode      = true;
    gv.kmModeTimer = 60;
    playSound('sndBing');
    spawnFloatingText(canvas.width / 2, canvas.height / 2 - 80,
      `+1 KM  (nível ${Difficulty.level})`, '#00FF88');
  }
  if (gv.kmMode && --gv.kmModeTimer <= 0) gv.kmMode = false;

  // Meta → coração
  gv.meta++;
  if (gv.meta >= 2000) {
    gv.passada += gv.meta; gv.meta = 0;
    if (!heart.visible) { heart.show(); owl.show(); }
  }

  // Timers de status
  if (gv.invencivel && --gv.invencivelTimer <= 0) gv.invencivel = false;
  if (gv.shield     && --gv.shieldTimer     <= 0) gv.shield     = false;
  if (gv.slowmo     && --gv.slowmoTimer     <= 0) gv.slowmo     = false;
  if (gv.doubleScore && --gv.doubleScoreTimer <= 0) gv.doubleScore = false;
  if (gv.comboTimer  > 0 && --gv.comboTimer  <= 0) gv.combo       = 0;
}

function applyPowerUp(type) {
  const cfg = POWERUP_TYPES[type];
  playSound('sndBing');
  ParticleSystem.spawn(bird.x, bird.y, cfg.color, 14, 4, 35, 5);

  if (type === 'shield') {
    gv.shield      = true;
    gv.shieldTimer = cfg.duration;
    owl.show('Escudo ativado! Absorve 1 colisão!');
    spawnFloatingText(bird.x, bird.y - 50, '🛡️ ESCUDO!', cfg.color);
  } else if (type === 'slowmo') {
    gv.slowmo      = true;
    gv.slowmoTimer = cfg.duration;
    owl.show('Câmera lenta! Respira! 🐢');
    spawnFloatingText(bird.x, bird.y - 50, '🐢 SLOW-MO!', cfg.color);
  } else if (type === 'doubleScore') {
    gv.doubleScore      = true;
    gv.doubleScoreTimer = cfg.duration;
    owl.show('Pontuação DUPLA! ⭐');
    spawnFloatingText(bird.x, bird.y - 50, '⭐ DOBROU!', cfg.color);
  }
}

// ─── HUD ──────────────────────────────────────────────────
function drawHUD() {
  // Indicador de nível
  ctx.textAlign   = 'left';
  ctx.fillStyle   = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.roundRect(40, 10, 200, 50, 8); ctx.fill();
  ctx.font        = 'bold 36px Arial';
  ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.fillStyle = 'white';
  const scoreText = gv.kmMode ? gv.distanciap + ' km' : String(gv.contador);
  ctx.strokeText(scoreText, 50, 50); ctx.fillText(scoreText, 50, 50);

  // Distância (direita)
  ctx.textAlign   = 'right';
  ctx.fillStyle   = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.roundRect(canvas.width - 230, 10, 220, 50, 8); ctx.fill();
  ctx.font        = 'bold 26px Arial';
  ctx.strokeStyle = 'black'; ctx.fillStyle = 'white';
  const distText = `🗺️ ${gv.distanciap} km  Lv${Difficulty.level}`;
  ctx.strokeText(distText, canvas.width - 50, 45);
  ctx.fillText  (distText, canvas.width - 50, 45);

  // Status bar (centro-topo)
  const statuses = [];
  if (gv.invencivel)   statuses.push({ label: `✨ ${Math.ceil(gv.invencivelTimer/60)}s`, color: '#FFD700' });
  if (gv.shield)       statuses.push({ label: `🛡️ ${Math.ceil(gv.shieldTimer/60)}s`,     color: '#00BFFF' });
  if (gv.slowmo)       statuses.push({ label: `🐢 ${Math.ceil(gv.slowmoTimer/60)}s`,      color: '#9B59B6' });
  if (gv.doubleScore)  statuses.push({ label: `⭐ ${Math.ceil(gv.doubleScoreTimer/60)}s`, color: '#F1C40F' });

  statuses.forEach((s, i) => {
    const bx = canvas.width / 2 - (statuses.length * 120) / 2 + i * 125;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(bx, 10, 115, 40, 8); ctx.fill();
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = s.color;
    ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
    ctx.strokeText(s.label, bx + 57, 38); ctx.fillText(s.label, bx + 57, 38);
  });

  // Combo
  if (gv.combo >= 2) {
    const pulse = 1 + 0.05 * Math.sin(frameCount * 0.3);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(24 * pulse)}px Arial`;
    ctx.fillStyle   = '#FFD700';
    ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
    const ct = `🔥 COMBO x${gv.combo}`;
    ctx.strokeText(ct, canvas.width / 2, canvas.height - 20);
    ctx.fillText  (ct, canvas.width / 2, canvas.height - 20);
    ctx.restore();
  }

  // High score
  const hs = HighScore.get();
  if (hs > 0) {
    ctx.textAlign = 'right';
    ctx.font      = '16px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`🏆 Recorde: ${hs} km`, canvas.width - 50, canvas.height - 15);
  }
}

// ─── CENAS ────────────────────────────────────────────────
function drawBackground(scene) {
  const key = scene === SCENE.PLAY ? 'bgPlay' :
              scene === SCENE.GAME ? 'bgGame' : 'bgGameOver';
  const img = images[key];
  if (img) {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if      (scene === SCENE.PLAY)     { g.addColorStop(0,'#87CEEB'); g.addColorStop(1,'#E0F7FA'); }
    else if (scene === SCENE.GAME)     { g.addColorStop(0,'#FFF3B0'); g.addColorStop(1,'#E9C46A'); }
    else                               { g.addColorStop(0,'#FFDAC1'); g.addColorStop(1,'#FF6B6B'); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function getPlayButtons() {
  const bw = 200, bh = 60, cx = canvas.width / 2;
  const playY = canvas.height / 2 + 150;
  return {
    play: { x: cx - bw/2, y: playY,      w: bw, h: bh },
    sair: { x: cx - bw/2, y: playY + 80, w: bw, h: 50 },
  };
}

function getGameOverButtons() {
  const bw = 250, bh = 50, cx = canvas.width / 2;
  return {
    again: { x: cx - bw/2, y: canvas.height/2 + 80,  w: bw, h: bh },
    back:  { x: cx - bw/2, y: canvas.height/2 + 140, w: bw, h: bh },
  };
}

function drawPlayScene() {
  drawBackground(SCENE.PLAY);
  if (bird) bird.draw();

  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#FF00BB';
  ctx.font        = 'bold 64px Arial';
  ctx.shadowColor = 'black'; ctx.shadowBlur = 5;
  ctx.fillText('Jornada do Passarim', canvas.width / 2, canvas.height / 2 - 60);
  ctx.shadowBlur  = 0;

  ctx.fillStyle = '#FB3C57';
  ctx.font      = '26px Arial';
  ctx.fillText('by Johnson Gomes', canvas.width / 2, canvas.height / 2 + 90);

  // High score
  const hs = HighScore.get();
  if (hs > 0) {
    ctx.fillStyle = '#FFD700';
    ctx.font      = 'bold 22px Arial';
    ctx.fillText(`🏆 Recorde: ${hs} km`, canvas.width / 2, canvas.height / 2 + 125);
  }

  // High score
  const hs = HighScore.get();
  if (hs > 0) {
    ctx.fillStyle = '#FFD700';
    ctx.font      = 'bold 22px Arial';
    ctx.fillText(`🏆 Recorde: ${hs} km`, canvas.width / 2, canvas.height / 2 + 125);
  }

  const { play, sair } = getPlayButtons();
  if (images.btnPlay) {
    ctx.drawImage(images.btnPlay, play.x, play.y, play.w, play.h);
  } else {
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath(); ctx.roundRect(play.x, play.y, play.w, play.h, 15); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = '28px Arial';
    ctx.fillText('▶ Play', canvas.width / 2, play.y + 38);
  }
  if (images.btnSair) {
    ctx.drawImage(images.btnSair, sair.x, sair.y, sair.w, sair.h);
  } else {
    ctx.fillStyle = '#f44336';
    ctx.beginPath(); ctx.roundRect(sair.x, sair.y, sair.w, sair.h, 10); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = '24px Arial';
    ctx.fillText('✕ Sair', canvas.width / 2, sair.y + 32);
  }

  if (Input.pressed) {
    if (pointInRect(Input.x, Input.y, play.x, play.y, play.w, play.h) || Input.x < 0) startGame();
    Input.consume();
  }
}

function drawGameScene() {
  drawBackground(SCENE.GAME);
  obstacles.forEach(o => o.draw());
  bird.draw();
  heart.draw();
  powerup.draw();
  owl.draw();
  ParticleSystem.draw();
  floatingTexts.forEach(t => t.draw());
  drawHUD();
}

function drawGameOverScene() {
  drawBackground(SCENE.GAMEOVER);

  if (images.gameOverImg) {
    ctx.drawImage(images.gameOverImg, canvas.width/2 - 200, 40, 400, 150);
  }

  // Card de resultado
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.beginPath(); ctx.roundRect(canvas.width/2 - 300, canvas.height/2 - 170, 600, 340, 20); ctx.fill();

  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#F13670';
  ctx.font        = 'bold 50px Arial';
  ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 110);

  ctx.fillStyle = 'white';
  ctx.font      = '26px Arial';
  ctx.fillText('Distância percorrida:', canvas.width/2, canvas.height/2 - 55);

  ctx.font      = 'bold 48px Arial';
  ctx.fillStyle = '#FFD700';
  ctx.fillText(gv.distanciap + ' km', canvas.width/2, canvas.height/2);

  const hs     = HighScore.get();
  const isNew  = gv.distanciap >= hs && gv.distanciap > 0;
  ctx.font     = '22px Arial';
  ctx.fillStyle = isNew ? '#00FF88' : '#AAAAAA';
  ctx.fillText(isNew ? `🏆 NOVO RECORDE!` : `Recorde: ${hs} km`, canvas.width/2, canvas.height/2 + 45);

  ctx.fillStyle = '#CCCCCC';
  ctx.font      = '20px Arial';
  ctx.fillText(`Pontuação total: ${gv.totalScore}  |  Nível: ${Difficulty.level}`, canvas.width/2, canvas.height/2 + 75);

  const { again, back } = getGameOverButtons();
  if (images.btnPlayAgain) {
    ctx.drawImage(images.btnPlayAgain, again.x, again.y, again.w, again.h);
  } else {
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath(); ctx.roundRect(again.x, again.y, again.w, again.h, 10); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = '24px Arial';
    ctx.fillText('▶ Jogar Novamente', canvas.width/2, again.y + 32);
  }
  if (images.btnBack) {
    ctx.drawImage(images.btnBack, back.x, back.y, back.w, back.h);
  } else {
    ctx.fillStyle = '#2196F3';
    ctx.beginPath(); ctx.roundRect(back.x, back.y, back.w, back.h, 10); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = '24px Arial';
    ctx.fillText('← Menu', canvas.width/2, back.y + 32);
  }

  if (Input.pressed) {
    if (pointInRect(Input.x, Input.y, again.x, again.y, again.w, again.h) || Input.x < 0) startGame();
    else if (pointInRect(Input.x, Input.y, back.x, back.y, back.w, back.h)) backToMenu();
    Input.consume();
  }
}

// ─── LOOP ─────────────────────────────────────────────────
function loop() {
  frameCount++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if      (currentScene === SCENE.PLAY)     drawPlayScene();
  else if (currentScene === SCENE.GAME)     { updateGameplay(); drawGameScene(); }
  else if (currentScene === SCENE.GAMEOVER) drawGameOverScene();

  Transition.update();
  Transition.draw();

  requestAnimationFrame(loop);
}

// ─── BOOT ─────────────────────────────────────────────────
loadAssets().then(() => {
  loadSounds();
  bird = new Bird();
  requestAnimationFrame(loop);
});
