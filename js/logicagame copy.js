/* =========================================================
   PASSARINHO JORNADA v3.1 — COM IMAGENS ORIGINAIS
   ========================================================= */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- CONFIGURAÇÃO DE ASSETS (IMAGENS E SONS) ---
// Coloque seus arquivos exatamente com esses nomes na mesma pasta,
// ou ajuste os caminhos abaixo.
// Se preferir subpastas, use "./img/nome.png" e "./sound/nome.wav".
const IMAGE_ASSETS = {
  // Fundos
  bgPlay:     "../GAME/Play/images/Sterne (Landscape).png",
  bgGame:     "../GAME/Scene0/images/Pyramids.png",
  bgGameOver: "../GAME/GAMEover/images/Cloudy sky.png",

  // Botões e telas
  btnPlay:        "../GAME/Play/images/Btn-Play.png",
  btnPlayAgain:   "../GAME/GAMEover/images/Btn-Play-again.png",
  btnBack:        "../GAME/GAMEover/images/Btn-back.png",
  btnSair:        "../GAME/GAMEover/images/incorrect.png", // ou "incorrect2.png"
  gameOverImg:    "../GAME/GAMEover/images/Game Over.png",

  // Pássaro
  birdIdle1: "/GAME/Play/images/bird_idle-1.png",
  birdIdle2: "/GAME/Play/images/bird_idle-2.png",
  birdFly1:  "/GAME/Scene0/images/Bird fly-1.png",
  birdFly2:  "/GAME/Scene0/images/Bird fly-2.png",
  birdFly3:  "/GAME/Scene0/images/Bird fly-3.png",

  // Obstáculos
  tree1: "/GAME/Scene0/images/tree-6.png",   // arvore
  tree2: "/GAME/Scene0/images/tree-4.png",   // arvore2
  tree3: "/GAME/Scene0/images/tree-7.png",   // arvore3
  plane: "/GAME/Scene0/images/plane.png",    // aviao

  // Itens e NPCs
  heart:   "/GAME/Scene0/images/Card.png",   // Coração
  owl1:    "/GAME/Scene0/images/owl.png",    // coruja
  owl2:    "/GAME/Scene0/images/owl-3.png",  // coruja (outra pose)

  // Sons (opcional — o jogo funciona sem eles)
};
const SOUND_ASSETS = {
  // Sons (opcional — o jogo funciona sem eles)
  sndBird:   "/GAME/Scene0/sounds/Bird0.wav",
  sndDrip:   "/GAME/Scene0/sounds/DripDrop.mpga",
  sndBing:   "/GAME/Scene0/sounds/bing0.mpga",
  sndLose:   "/GAME/Scene0/sounds/lose.mpga",
  sndTweet:  "/GAME/Scene0/sounds/tweet.mpga",
  sndBeep:   "/GAME/Scene0/sounds/beep.mpga"
};

// Objeto que guardará as imagens carregadas
const images = {};
const sounds = {};

// --- CARREGADOR DE ASSETS ---
let loadedCount = 0;
let totalToLoad = 0;

// Conta total de imagens
//totalToLoad = Object.keys(ASSETS).length;
totalToLoad = Object.keys(IMAGE_ASSETS).length;

function updateLoader(percent) {
  document.getElementById('loaderBar').style.width = percent + '%';
}

/*function loadAssets() {

  return new Promise((resolve, reject) => {

    for (const key in ASSETS) {
      const path = ASSETS[key];

      // 👉 SE FOR SOM
      if (path.includes('.mp3') || path.includes('.wav') || path.includes('.mpga')) {
        const audio = new Audio();
        audio.src = path;

        audio.oncanplaythrough = () => {
          sounds[key] = audio;
          loadedCount++;
          updateLoader((loadedCount / totalToLoad) * 100);
          if (loadedCount === totalToLoad) resolve();
        };

        audio.onerror = () => {
          console.warn("Erro ao carregar som:", path);
          sounds[key] = null;
          loadedCount++;
          if (loadedCount === totalToLoad) resolve();
        };

      } else {
        // 👉 IMAGEM (igual já tava)
        const img = new Image();
        img.src = path;

        img.onload = () => {
          images[key] = img;
          loadedCount++;
          updateLoader((loadedCount / totalToLoad) * 100);
          if (loadedCount === totalToLoad) resolve();
        };

        img.onerror = () => {
          console.warn("Não foi possível carregar:", path);
          images[key] = null;
          loadedCount++;
          if (loadedCount === totalToLoad) resolve();
        };
      }
    }
    setTimeout(() => {
    console.warn("Forçando início (timeout)");
    resolve();
    }, 5000);
  });

}*/

function loadAssets() {
  return new Promise((resolve) => {
    for (const key in IMAGE_ASSETS) {
      const img = new Image();
      img.src = IMAGE_ASSETS[key];

      img.onload = () => {
        images[key] = img;
        loadedCount++;

        updateLoader((loadedCount / totalToLoad) * 100);

        if (loadedCount === totalToLoad) {
          document.getElementById('loading').style.display = 'none';
          resolve();
        }
      };

      img.onerror = () => {
        console.warn("Erro imagem:", IMAGE_ASSETS[key]);
        images[key] = null;
        loadedCount++;

        if (loadedCount === totalToLoad) resolve();
      };
    }
  });
}

function loadSounds() {
  for (const key in SOUND_ASSETS) {
    const audio = new Audio(SOUND_ASSETS[key]);
    sounds[key] = audio;
  }
}

// --- INICIALIZA O JOGO DEPOIS DE CARREGAR ---
loadAssets().then(() => {
  loadSounds();
  initGame();
  requestAnimationFrame(loop);
});

// --- INPUT ---
let inputPressed = false;
canvas.addEventListener('mousedown', (e) => {
  inputPressed = true;
  // Se quiser coordenadas exatas do clique (para botões), use e.offsetX, e.offsetY
});
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  inputPressed = true;
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') inputPressed = true;
});

// --- ESTADOS E VARIÁVEIS ---
const SCENE = { PLAY: 'PLAY', GAME: 'GAME', GAMEOVER: 'GAMEOVER' };
let currentScene = SCENE.PLAY;

let gameVars = {
  contador: 0, distanciap: 0, meta: 0, passada: 0,
  colisao: false, coracaovida: false, transicao: 0,
  kmMode: false, morred: '',
  invencivel: false,
invencivelTimer: 0
};

// --- CLASSES DE OBJETOS ---

class Bird {
  constructor() {
    this.x = canvas.width / 2 - 100;
    this.y = canvas.height / 2 + 50;
    this.vy = 0;
    this.gravity = 0.25;
    this.jump = -7;
    this.size = 60; // tamanho de desenho (ajuste conforme sua imagem)
    this.lookIndex = 0; // 0,1,2 para fly1,fly2,fly3
    this.lastSwitch = 0;
  }

  update() {
    this.vy += this.gravity;
    this.y += this.vy;

    // Limites
    if (this.y > canvas.height - 40) {
      this.y = canvas.height - 40;
      this.vy = 0;
      if (!gameVars.coracaovida) triggerGameOver();
    }
    if (this.y < 20) { this.y = 20; this.vy = 0; }

    // Input
    if (inputPressed) {
      this.vy = this.jump;
      inputPressed = false;
      // Troca para "asa batendo"
      this.lookIndex = 2; // fly3 (pulo)
    }

    // Animação de asas
    if (frameCount - this.lastSwitch > 10) { // a cada 10 frames
      this.lookIndex = (this.lookIndex + 1) % 3;
      this.lastSwitch = frameCount;
    }
  }

  draw() {
    // Escolhe imagem: se estiver no menu usa idle, no jogo usa fly
    let imgKey;
    if (currentScene === SCENE.PLAY) {
      // alterna idle1/idle2
      imgKey = (frameCount % 30 < 15) ? 'birdIdle1' : 'birdIdle2';
    } else {
      const map = ['birdFly1', 'birdFly2', 'birdFly3'];
      imgKey = map[this.lookIndex];
    }
    const img = images[imgKey];
    if (img) {
      ctx.drawImage(img, this.x - this.size/2, this.y - this.size/2, this.size, this.size);
    } else {
      // fallback: desenho simples
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size/2, 0, Math.PI*2);
      ctx.fill();
    }
  }

  getBounds() {
    return { x: this.x - 25, y: this.y - 25, w: 50, h: 50 };
  }
}

class Obstacle {
  constructor(type, x) {
    this.type = type; // 'tree', 'tree2', 'tree3', 'plane'
    this.x = x;
    this.y = 0;
    this.width = 80;
    this.height = 100;
    this.speedX = -2 - Math.random() * 1.5; // velocidade variável

    // Ajusta posição conforme tipo (conforme XML)
    if (type === 'tree') {
      this.y = canvas.height - 200;
      this.imgKey = 'tree1';
      this.width = 80; this.height = 200;
    } else if (type === 'tree2') {
      this.y = canvas.height - 210;
      this.imgKey = 'tree2';
      this.width = 80; this.height = 210;
    } else if (type === 'tree3') {
      this.y = canvas.height - 240 - Math.random() * 100;
      this.imgKey = 'tree3';
      this.width = 80; this.height = 220;
    } else if (type === 'plane') {
      this.y = -100 + Math.random() * 200;
      this.x = canvas.width - 960; // começa mais à direita
      this.imgKey = 'plane';
      this.width = 150; this.height = 75;
      this.speedX = 3 - Math.random() * 1.5;
    }
  }

  update() {
    this.x += this.speedX;
    if (this.x < -150) {
      // Reaparece do outro lado (clone infinito)
      this.x = canvas.width + 50;
      if (this.type === 'tree3') this.y = canvas.height - 140 - Math.random() * 100;
      if (this.type === 'plane') this.y = 80 + Math.random() * 200;
    }
  }

  draw() {
    const img = images[this.imgKey];
    if (img) {
      ctx.drawImage(img, this.x, this.y, this.width, this.height);
    } else {
      // fallback
      ctx.fillStyle = this.type === 'plane' ? '#708090' : '#228B22';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }

  getBounds() {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }
}

class Heart {
  constructor() {
    this.visible = false;
    this.x = canvas.width - 950;
    this.y = canvas.height - 540;
    this.size = 50;
    this.timer = 0; // 30 segundos = 1800 frames (60fps)
  }

  show() {
    this.visible = true;
    this.timer = 30 * 60;
  }

  update() {
    if (!this.visible) return;
    this.timer--;
    if (this.timer <= 0) {
      this.visible = false;
    }
  }

  draw() {
    if (gameVars.invencivel) {
        ctx.globalAlpha = (frameCount % 10 < 5) ? 0.5 : 1;
    }
    if (!this.visible) return;
    const img = images.heart;
    if (img) {
      ctx.drawImage(img, this.x, this.y, this.size, this.size);
    } else {
      // fallback coração
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      const s = this.size;
      ctx.moveTo(this.x + s/2, this.y + s/4);
      ctx.quadraticCurveTo(this.x, this.y, this.x, this.y + s/2);
      ctx.quadraticCurveTo(this.x + s/2, this.y + s*3/4, this.x + s, this.y + s/2);
      ctx.quadraticCurveTo(this.x + s, this.y, this.x + s/2, this.y + s/4);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

class Owl {
  constructor() {
    this.visible = false;
    this.x = canvas.width - 200;
    this.y = canvas.height - 200;
    this.timer = 0;
    this.bubbleTimer = 0;
  }

  show() {
    this.visible = true;
    this.timer = 300; // 5 segundos
    this.bubbleTimer = 300;
  }

  update() {
    if (!this.visible) return;
    this.timer--;
    this.bubbleTimer--;
    if (this.timer <= 0) this.visible = false;
  }

  draw() {
    if (!this.visible) return;
    // Desenha coruja
    const img = (frameCount % 60 < 30) ? images.owl1 : images.owl2;
    if (img) {
      ctx.drawImage(img, this.x, this.y, 80, 80);
    } else {
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.arc(this.x + 40, this.y + 40, 30, 0, Math.PI*2);
      ctx.fill();
    }

    // Balão de fala (aparece nos primeiros segundos)
    if (this.bubbleTimer > 0) {
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(this.x - 150, this.y - 100, 200, 60, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'black';
      ctx.font = '14px Arial';
      ctx.fillText("Você ganhou um coração!", this.x -  -17, this.y - 70);
    }
  }
}

// --- GERENCIADOR DO JOGO ---
let bird, obstacles, heart, owl, frameCount = 0;

function spawnObstacle() {
  const rand = Math.random();
  let type;
  if (rand < 0.4) type = 'tree';
  else if (rand < 0.7) type = 'tree2';
  else if (rand < 0.9) type = 'tree3';
  else type = 'plane';
  obstacles.push(new Obstacle(type, canvas.width + 50));
}

function resetGameVars() {
  gameVars = {
    contador: 0, distanciap: 0, meta: 0, passada: 0,
    colisao: false, transicao: 0,
    kmMode: false, morred: ''
  };
  obstacles = [];
  bird = new Bird();
  heart = new Heart();
  owl = new Owl();
  for (let i = 0; i < 3; i++) spawnObstacle();
}

function startGame() {
  currentScene = SCENE.GAME;
  resetGameVars();
}

function triggerGameOver() {
  if (gameVars.colisao) return;
  gameVars.colisao = true;
  currentScene = SCENE.GAMEOVER;
}

function backToMenu() {
  currentScene = SCENE.PLAY;
}

// --- LÓGICA DE CADA CENA ---

function updateGameplay() {
  bird.update()
    if (inputPressed) {
      this.vy = this.jump;
      inputPressed = false;

      if (sounds.sndTweet) {
       sounds.sndTweet.currentTime = 0;
       sounds.sndTweet.play();
      }
    };

  // Spawn de obstáculos
  if (frameCount % 120 === 0) spawnObstacle();

  // Atualiza obstáculos e colisões
  obstacles.forEach(obs => {
    obs.update();
    if (checkCollision(bird.getBounds(), obs.getBounds())) {
        if (!gameVars.invencivel) {
            triggerGameOver();
        }
    }
  });

  // Itens
  if (heart) heart.update();
  if (owl) owl.update();

  // Pontuação
  if (frameCount % 5 === 0) gameVars.contador++;

  if (gameVars.contador >= 1000) {
    gameVars.distanciap++;
    gameVars.contador = 0;
    gameVars.kmMode = true;
    setTimeout(() => gameVars.kmMode = false, 1000);
  }

  // Meta de 2000
  gameVars.meta++;
  if (gameVars.meta >= 2000) {
    gameVars.passada += gameVars.meta;
    gameVars.meta = 0;
    if (!heart.visible) {
      heart.show();
    }
    if (!owl.visible) owl.show();
  }

  // Colisão com coração
  if (heart.visible && checkCollision(bird.getBounds(), {
    x: heart.x,
    y: heart.y,
    w: heart.size,
    h: heart.size
  })) {
    heart.visible = false;

    gameVars.invencivel = true;
    gameVars.invencivelTimer = 30 * 60; // 30 segundos

    console.log("INVENCÍVEL POR 30 SEGUNDOS!");
  }
  if (gameVars.invencivel) {
    gameVars.invencivelTimer--;

  if (gameVars.invencivelTimer <= 0) {
    gameVars.invencivel = false;
  }
}
}

function drawBackground(scene) {
  let img;
  if (scene === SCENE.PLAY) img = images.bgPlay;
  else if (scene === SCENE.GAME) img = images.bgGame;
  else img = images.bgGameOver;

  if (img) {
    // Desenha a imagem cobrindo o canvas (se for maior, redimensiona)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } else {
    // Fallback gradiente
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, scene === SCENE.PLAY ? '#87CEEB' : '#FFDAC1');
    g.addColorStop(1, scene === SCENE.PLAY ? '#E0F7FA' : '#FFD700');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawPlayScene() {
  drawBackground(SCENE.PLAY);

  // Título (pode ser imagem ou texto — aqui usamos texto para garantir legibilidade)
  ctx.fillStyle = '#FF00BB';
  ctx.font = 'bold 70px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 4;
  ctx.fillText('jornada do passarim', canvas.width/2, canvas.height/2 - 50);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FB3C57';
  ctx.font = '30px Arial';
  ctx.fillText('by Johnson Gomes', canvas.width/2, canvas.height/2 + 100);

  // Botão Play (imagem ou fallback)
  const btnW = 200, btnH = 60;
  const btnX = canvas.width/2 - btnW/2;
  const btnY = canvas.height/2 + 150;
  if (images.btnPlay) {
    ctx.drawImage(images.btnPlay, btnX, btnY, btnW, btnH);
  } else {
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 15);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.fillText('▶ Play', canvas.width/2, btnY + 38);
  }

  // Botão Sair
  const sx = canvas.width/2 - btnW/2;
  const sy = btnY + 80;
  if (images.btnSair) {
    ctx.drawImage(images.btnSair, sx, sy, btnW, 50);
  } else {
    ctx.fillStyle = '#f44336';
    ctx.beginPath();
    ctx.roundRect(sx, sy, btnW, 50, 10);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText('✕ Sair', canvas.width/2, sy + 32);
  }

  // Clique: se for dentro do botão Play, inicia; se for no Sair, volta (ou fecha)
  // (Aqui simplificado: qualquer clique inicia o jogo)
  if (inputPressed) {
    startGame();
    inputPressed = false;
  }
}

function drawGameScene() {
  drawBackground(SCENE.GAME);

  obstacles.forEach(o => o.draw());
  bird.draw();
  if (heart) heart.draw();
  if (owl) owl.draw();

  // UI de pontuação
  ctx.fillStyle = 'white';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'left';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3;

  if (gameVars.kmMode) {
    ctx.strokeText(gameVars.distanciap + ' km', 50, 60);
    ctx.fillText(gameVars.distanciap + ' km', 50, 60);
  } else {
    ctx.strokeText(gameVars.contador, 50, 60);
    ctx.fillText(gameVars.contador, 50, 60);
  }

  ctx.textAlign = 'right';
  ctx.strokeText('Dist: ' + gameVars.distanciap, canvas.width - 50, 60);
  ctx.fillText('Dist: ' + gameVars.distanciap, canvas.width - 50, 60);
  if (gameVars.invencivel) {
    ctx.fillStyle = 'yellow';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("INVENCÍVEL!", canvas.width / 2, 50);
  }
}

function drawGameOverScene() {
  drawBackground(SCENE.GAMEOVER);

  // Imagem "Game Over" centralizada (se houver)
  if (images.gameOverImg) {
    ctx.drawImage(images.gameOverImg, canvas.width/2 - 200, 50, 400, 150);
  }

  // Painel
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(canvas.width/2 - 300, canvas.height/2 - 150, 600, 300);

  ctx.fillStyle = '#F13670';
  ctx.font = 'bold 50px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 80);

  ctx.fillStyle = 'white';
  ctx.font = '30px Arial';
  ctx.fillText('Distância percorrida:', canvas.width/2, canvas.height/2 - 20);
  ctx.font = 'bold 40px Arial';
  ctx.fillText(gameVars.distanciap + ' km', canvas.width/2, canvas.height/2 + 30);

  // Botão Play Again
  const bw = 250, bh = 50;
  if (images.btnPlayAgain) {
    ctx.drawImage(images.btnPlayAgain, canvas.width/2 - bw/2, canvas.height/2 + 80, bw, bh);
  } else {
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.roundRect(canvas.width/2 - bw/2, canvas.height/2 + 80, bw, bh, 10);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText('▶ Play Again', canvas.width/2, canvas.height/2 + 108);
  }

  // Botão Back
  if (images.btnBack) {
    ctx.drawImage(images.btnBack, canvas.width/2 - bw/2, canvas.height/2 + 140, bw, bh);
  } else {
    ctx.fillStyle = '#2196F3';
    ctx.beginPath();
    ctx.roundRect(canvas.width/2 - bw/2, canvas.height/2 + 140, bw, bh, 10);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText('← Back', canvas.width/2, canvas.height/2 + 168);
  }

  if (inputPressed) {
    // Se clicar, reinicia o jogo (simplificado)
    startGame();
    inputPressed = false;
  }
}

function checkCollision(a, b) {
  return (a.x < b.x + b.w && a.x + a.w > b.x &&
          a.y < b.y + b.h && a.y + a.h > b.y);
}

// --- LOOP PRINCIPAL ---
function loop(timestamp) {
  frameCount++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentScene === SCENE.PLAY) drawPlayScene();
  else if (currentScene === SCENE.GAME) {
    updateGameplay();
    drawGameScene();
  } else if (currentScene === SCENE.GAMEOVER) drawGameOverScene();

  requestAnimationFrame(loop);
}

// Adiciona roundRect se necessário
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
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


function initGame() {
  // nada mais a fazer — assets já carregados
}
