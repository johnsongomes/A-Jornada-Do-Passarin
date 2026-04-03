
/* =========================================================
   PASSARINHO JORNADA v3.3
   ========================================================= */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ASSETS ---
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
const sounds = {};

// --- UTILITÁRIOS ---

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

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

// --- CARREGAMENTO ---

function loadAssets() {
  const keys = Object.keys(IMAGE_ASSETS);
  if (keys.length === 0) return Promise.resolve();

  let loaded = 0;
  const total = keys.length;

  const updateBar = () => {
    const el = document.getElementById('loaderBar');
    if (el) el.style.width = ((loaded / total) * 100) + '%';
  };

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('Loader timeout — iniciando com assets parciais.');
      hideLoader(); resolve();
    }, 8000);

    keys.forEach((key) => {
      const img = new Image();
      img.src = IMAGE_ASSETS[key];
      const done = () => {
        loaded++; updateBar();
        if (loaded === total) { clearTimeout(timeout); hideLoader(); resolve(); }
      };
      img.onload  = () => { images[key] = img;  done(); };
      img.onerror = () => { console.warn('Imagem não encontrada:', IMAGE_ASSETS[key]); images[key] = null; done(); };
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
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    inputPressed = true;
    clickX = -1; clickY = -1;
  }
});

// --- ESTADOS ---
const SCENE = { PLAY: 'PLAY', GAME: 'GAME', GAMEOVER: 'GAMEOVER' };
let currentScene = SCENE.PLAY;

let gameVars = {};

function makeGameVars() {
  return {
    contador: 0,
    distanciap: 0,
    meta: 0,
    passada: 0,
    colisao: false,
    kmMode: false,
    kmModeTimer: 0,
    invencivel: false,
    invencivelTimer: 0,
  };
}

// --- CLASSES ---

class Bird {
  constructor() {
    this.x = canvas.width / 2 - 100;
    this.y = canvas.height / 2 + 50;
    this.vy = 0;
    this.gravity = 0.25;
    this.jumpForce = -7;
    this.size = 60;
    this.frameIndex = 0;
    this.lastSwitch = 0;
  }

  flap() {
    this.vy = this.jumpForce;
    this.frameIndex = 2;
    playSound('sndTweet');
  }

  update() {
    this.vy += this.gravity;
    this.y  += this.vy;

    if (this.y > canvas.height - 40) {
      this.y = canvas.height - 40;
      this.vy = 0;
      triggerGameOver();
    }
    if (this.y < 20) { this.y = 20; this.vy = 0; }

    if (inputPressed) {
      this.flap();
      inputPressed = false;
    }

    if (frameCount - this.lastSwitch > 10) {
      this.frameIndex = (this.frameIndex + 1) % 3;
      this.lastSwitch = frameCount;
    }
  }

  draw() {
    let imgKey;
    if (currentScene === SCENE.PLAY) {
      imgKey = (frameCount % 30 < 15) ? 'birdIdle1' : 'birdIdle2';
    } else {
      imgKey = ['birdFly1', 'birdFly2', 'birdFly3'][this.frameIndex];
    }

    if (gameVars.invencivel && frameCount % 10 < 5) ctx.globalAlpha = 0.4;

    const img = images[imgKey];
    if (img) {
      ctx.drawImage(img, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    } else {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  getBounds() {
    const margin = 10;
    return {
      x: this.x - this.size / 2 + margin,
      y: this.y - this.size / 2 + margin,
      w: this.size - margin * 2,
      h: this.size - margin * 2,
    };
  }
}

// ─── OBSTÁCULOS ───────────────────────────────────────────
// AVIÃO: vem da ESQUERDA para a DIREITA (speedX positivo), sprite original sem espelho
// Árvores: vêm da DIREITA para a ESQUERDA (speedX negativo)

const OBSTACLE_CONFIG = {
  tree:  { imgKey: 'tree1', w: 80,  h: 200, groundOffset: 200 },
  tree2: { imgKey: 'tree2', w: 80,  h: 210, groundOffset: 210 },
  tree3: { imgKey: 'tree3', w: 80,  h: 220, groundOffset: null },
  plane: { imgKey: 'plane', w: 150, h: 75,  groundOffset: null },
};

class Obstacle {
  constructor(type, x) {
    this.type   = type;
    const cfg   = OBSTACLE_CONFIG[type];
    this.imgKey = cfg.imgKey;
    this.width  = cfg.w;
    this.height = cfg.h;

    if (type === 'plane') {
      // Avião entra pela ESQUERDA e vai para a DIREITA — sprite original
      this.x      = -this.width - 20;
      this.y      = 80 + Math.random() * 200;
      this.speedX = +(2.5 + Math.random() * 1.5); // positivo → direita
    } else if (type === 'tree3') {
      this.x      = x !== undefined ? x : canvas.width + 50;
      this.y      = canvas.height - 140 - Math.random() * 100;
      this.speedX = -(2 + Math.random() * 1.5);
    } else {
      this.x      = x !== undefined ? x : canvas.width + 50;
      this.y      = canvas.height - cfg.groundOffset;
      this.speedX = -(2 + Math.random() * 1.5);
    }
  }

  update() {
    this.x += this.speedX;

    if (this.type === 'plane') {
      // Sai pela direita → reaparece pela esquerda
      if (this.x > canvas.width + 20) {
        this.x = -this.width - 20;
        this.y = 80 + Math.random() * 200;
      }
    } else {
      // Árvores saem pela esquerda → reaparecem pela direita
      if (this.x < -this.width - 20) {
        this.x = canvas.width + 50 + Math.random() * 200;
        if (this.type === 'tree3') this.y = canvas.height - 140 - Math.random() * 100;
      }
    }
  }

  draw() {
    const img = images[this.imgKey];
    if (img) {
      // Sprite desenhado nas dimensões originais, sem transformações
      ctx.drawImage(img, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = this.type === 'plane' ? '#708090' : '#228B22';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }

  getBounds() {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }
}

// ─── CORAÇÃO ──────────────────────────────────────────────

class Heart {
  constructor() { this.reset(); }

  reset() {
    this.visible = false;
    this.x = canvas.width  / 2;
    this.y = canvas.height / 2 - 50;
    this.size  = 50;
    this.timer = 0;
  }

  show() {
    this.visible = true;
    this.x = 100 + Math.random() * (canvas.width  - 200);
    this.y = 100 + Math.random() * (canvas.height - 200);
    this.timer = 30 * 60;

    // Invencibilidade começa ao aparecer
    gameVars.invencivel      = true;
    gameVars.invencivelTimer = 30 * 60;
    playSound('sndDrip');
  }

  update() {
    if (!this.visible) return;
    if (--this.timer <= 0) this.visible = false;
  }

  draw() {
    if (!this.visible) return;

    const pulse = 1 + 0.08 * Math.sin(frameCount * 0.15);
    const s  = this.size * pulse;
    const ox = (s - this.size) / 2;

    const img = images.heart;
    if (img) {
      ctx.drawImage(img, this.x - ox, this.y - ox, s, s);
    } else {
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      const hx = this.x - ox, hy = this.y - ox;
      ctx.moveTo(hx + s/2, hy + s/4);
      ctx.quadraticCurveTo(hx,     hy,           hx,     hy + s/2);
      ctx.quadraticCurveTo(hx+s/2, hy + s*0.85,  hx + s, hy + s/2);
      ctx.quadraticCurveTo(hx + s, hy,            hx+s/2, hy + s/4);
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

// --- ESTADO DO JOGO ---
let bird, obstacles, heart, owl;
let frameCount = 0;

function resetGameVars() {
  gameVars  = makeGameVars();
  obstacles = [];
  bird  = new Bird();
  heart = new Heart();
  owl   = new Owl();
  for (let i = 0; i < 3; i++) spawnObstacle(canvas.width + i * 350);
  obstacles.push(new Obstacle('plane'));
}

function startGame() {
  currentScene = SCENE.GAME;
  frameCount   = 0;
  resetGameVars();
}

function triggerGameOver() {
  if (gameVars.colisao) return;
  gameVars.colisao = true;
  playSound('sndLose');
  currentScene = SCENE.GAMEOVER;
}

function backToMenu() {
  currentScene = SCENE.PLAY;
  inputPressed = false;
}

function spawnObstacle(x) {
  const rand = Math.random();
  let type;
  if      (rand < 0.40) type = 'tree';
  else if (rand < 0.70) type = 'tree2';
  else                  type = 'tree3';
  obstacles.push(new Obstacle(type, x !== undefined ? x : canvas.width + 50));
}

// --- LÓGICA ---

function updateGameplay() {
  bird.update();

  if (frameCount % 120 === 0) spawnObstacle();

  obstacles.forEach((obs) => {
    obs.update();
    if (!gameVars.invencivel && checkCollision(bird.getBounds(), obs.getBounds())) {
      triggerGameOver();
    }
  });

  heart.update();
  owl.update();

  if (frameCount % 5 === 0) gameVars.contador++;

  if (gameVars.contador >= 1000) {
    gameVars.distanciap++;
    gameVars.contador    = 0;
    gameVars.kmMode      = true;
    gameVars.kmModeTimer = 60;
    playSound('sndBing');
  }
  if (gameVars.kmMode && --gameVars.kmModeTimer <= 0) gameVars.kmMode = false;

  // Meta de 2 000 frames → coração aparece (e já ativa invencibilidade)
  gameVars.meta++;
  if (gameVars.meta >= 2000) {
    gameVars.passada += gameVars.meta;
    gameVars.meta = 0;
    if (!heart.visible) { heart.show(); owl.show(); }
  }

  // Encostar no coração só remove o ícone (invencibilidade já está ativa)
  if (heart.visible && checkCollision(bird.getBounds(), heart.getBounds())) {
    heart.visible = false;
  }

  if (gameVars.invencivel && --gameVars.invencivelTimer <= 0) {
    gameVars.invencivel = false;
  }
}

// --- DESENHO ---

function drawBackground(scene) {
  const key = scene === SCENE.PLAY ? 'bgPlay' :
              scene === SCENE.GAME ? 'bgGame' : 'bgGameOver';
  const img = images[key];
  if (img) {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if      (scene === SCENE.PLAY)  { g.addColorStop(0,'#87CEEB'); g.addColorStop(1,'#E0F7FA'); }
    else if (scene === SCENE.GAME)  { g.addColorStop(0,'#FFF3B0'); g.addColorStop(1,'#E9C46A'); }
    else                            { g.addColorStop(0,'#FFDAC1'); g.addColorStop(1,'#FF6B6B'); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function getPlayButtons() {
  const btnW = 200, btnH = 60, cx = canvas.width / 2;
  const playY = canvas.height / 2 + 150;
  return {
    play: { x: cx - btnW / 2, y: playY,      w: btnW, h: btnH },
    sair: { x: cx - btnW / 2, y: playY + 80, w: btnW, h: 50   },
  };
}

function getGameOverButtons() {
  const bw = 250, bh = 50, cx = canvas.width / 2;
  return {
    again: { x: cx - bw / 2, y: canvas.height / 2 + 80,  w: bw, h: bh },
    back:  { x: cx - bw / 2, y: canvas.height / 2 + 140, w: bw, h: bh },
  };
}

function drawPlayScene() {
  drawBackground(SCENE.PLAY);
  if (bird) bird.draw();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FF00BB';
  ctx.font = 'bold 64px Arial';
  ctx.shadowColor = 'black'; ctx.shadowBlur = 5;
  ctx.fillText('Jornada do Passarim', canvas.width / 2, canvas.height / 2 - 60);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FB3C57';
  ctx.font = '26px Arial';
  ctx.fillText('by Johnson Gomes', canvas.width / 2, canvas.height / 2 + 90);

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

  if (inputPressed) {
    if (pointInRect(clickX, clickY, play.x, play.y, play.w, play.h) || clickX < 0) startGame();
    inputPressed = false;
  }
}

function drawGameScene() {
  drawBackground(SCENE.GAME);
  obstacles.forEach((o) => o.draw());
  bird.draw();
  heart.draw();
  owl.draw();

  ctx.textAlign   = 'left';
  ctx.font        = 'bold 40px Arial';
  ctx.strokeStyle = 'black';
  ctx.lineWidth   = 3;
  ctx.fillStyle   = 'white';

  const scoreText = gameVars.kmMode ? gameVars.distanciap + ' km' : String(gameVars.contador);
  ctx.strokeText(scoreText, 50, 60); ctx.fillText(scoreText, 50, 60);

  ctx.textAlign = 'right';
  const distText = 'Dist: ' + gameVars.distanciap + ' km';
  ctx.strokeText(distText, canvas.width - 50, 60); ctx.fillText(distText, canvas.width - 50, 60);

  if (gameVars.invencivel) {
    const secs = Math.ceil(gameVars.invencivelTimer / 60);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'gold';
    ctx.font = 'bold 28px Arial';
    ctx.fillText(`✨ INVENCÍVEL! ${secs}s`, canvas.width / 2, 55);
  }
}

function drawGameOverScene() {
  drawBackground(SCENE.GAMEOVER);

  if (images.gameOverImg) {
    ctx.drawImage(images.gameOverImg, canvas.width / 2 - 200, 40, 400, 150);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.beginPath();
  ctx.roundRect(canvas.width / 2 - 300, canvas.height / 2 - 150, 600, 300, 20);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#F13670';
  ctx.font = 'bold 50px Arial';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 80);

  ctx.fillStyle = 'white';
  ctx.font = '28px Arial';
  ctx.fillText('Distância percorrida:', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = 'bold 42px Arial';
  ctx.fillText(gameVars.distanciap + ' km', canvas.width / 2, canvas.height / 2 + 35);

  const { again, back } = getGameOverButtons();

  if (images.btnPlayAgain) {
    ctx.drawImage(images.btnPlayAgain, again.x, again.y, again.w, again.h);
  } else {
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath(); ctx.roundRect(again.x, again.y, again.w, again.h, 10); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = '24px Arial';
    ctx.fillText('▶ Jogar Novamente', canvas.width / 2, again.y + 32);
  }

  if (images.btnBack) {
    ctx.drawImage(images.btnBack, back.x, back.y, back.w, back.h);
  } else {
    ctx.fillStyle = '#2196F3';
    ctx.beginPath(); ctx.roundRect(back.x, back.y, back.w, back.h, 10); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = '24px Arial';
    ctx.fillText('← Menu', canvas.width / 2, back.y + 32);
  }

  if (inputPressed) {
    if (pointInRect(clickX, clickY, again.x, again.y, again.w, again.h) || clickX < 0) startGame();
    else if (pointInRect(clickX, clickY, back.x, back.y, back.w, back.h)) backToMenu();
    inputPressed = false;
  }
}

// --- LOOP ---
function loop() {
  frameCount++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if      (currentScene === SCENE.PLAY)     drawPlayScene();
  else if (currentScene === SCENE.GAME)   { updateGameplay(); drawGameScene(); }
  else if (currentScene === SCENE.GAMEOVER) drawGameOverScene();

  requestAnimationFrame(loop);
}

// --- BOOT ---
loadAssets().then(() => {
  loadSounds();
  bird = new Bird();
  requestAnimationFrame(loop);
});
