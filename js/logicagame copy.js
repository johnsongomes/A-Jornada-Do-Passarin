/* =========================================================
   PASSARINHO JORNADA v3.1 — COM IMAGENS ORIGINAIS
   ========================================================= */


// ===============================
// 🎨 CANVAS
// ===============================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');


// ===============================
// 📦 CONFIGURAÇÃO DE ASSETS
// ===============================
const IMAGE_ASSETS = {
  bgPlay:     "../GAME/Play/images/Sterne (Landscape).png",
  bgGame:     "../GAME/Scene0/images/Pyramids.png",
  bgGameOver: "../GAME/GAMEover/images/Cloudy sky.png",

  btnPlay:        "../GAME/Play/images/Btn-Play.png",
  btnPlayAgain:   "../GAME/GAMEover/images/Btn-Play-again.png",
  btnBack:        "../GAME/GAMEover/images/Btn-back.png",
  btnSair:        "../GAME/GAMEover/images/incorrect.png",
  gameOverImg:    "../GAME/GAMEover/images/Game Over.png",

  birdIdle1: "/GAME/Play/images/bird_idle-1.png",
  birdIdle2: "/GAME/Play/images/bird_idle-2.png",
  birdFly1:  "/GAME/Scene0/images/Bird fly-1.png",
  birdFly2:  "/GAME/Scene0/images/Bird fly-2.png",
  birdFly3:  "/GAME/Scene0/images/Bird fly-3.png",

  tree1: "/GAME/Scene0/images/tree-6.png",
  tree2: "/GAME/Scene0/images/tree-4.png",
  tree3: "/GAME/Scene0/images/tree-7.png",
  plane: "/GAME/Scene0/images/plane.png",

  heart:   "/GAME/Scene0/images/Card.png",
  owl1:    "/GAME/Scene0/images/owl.png",
  owl2:    "/GAME/Scene0/images/owl-3.png",
};

const SOUND_ASSETS = {
  sndBird:   "/GAME/Scene0/sounds/Bird0.wav",
  sndDrip:   "/GAME/Scene0/sounds/DripDrop.mpga",
  sndBing:   "/GAME/Scene0/sounds/bing0.mpga",
  sndLose:   "/GAME/Scene0/sounds/lose.mpga",
  sndTweet:  "/GAME/Scene0/sounds/tweet.mpga",
  sndBeep:   "/GAME/Scene0/sounds/beep.mpga"
};


// ===============================
// 📦 OBJETOS DE ASSETS
// ===============================
const images = {};
const sounds = {};


// ===============================
// ⏳ LOADING
// ===============================
let loadedCount = 0;
let totalToLoad = Object.keys(IMAGE_ASSETS).length;

function updateLoader(percent) {
  document.getElementById('loaderBar').style.width = percent + '%';
}

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


// ===============================
// 🚀 INICIALIZAÇÃO
// ===============================
loadAssets().then(() => {
  loadSounds();
  initGame();
  requestAnimationFrame(loop);
});


// ===============================
// 🎮 INPUT
// ===============================
let inputPressed = false;

canvas.addEventListener('mousedown', () => inputPressed = true);

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  inputPressed = true;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') inputPressed = true;
});


// ===============================
// 🧠 ESTADOS
// ===============================
const SCENE = { PLAY: 'PLAY', GAME: 'GAME', GAMEOVER: 'GAMEOVER' };
let currentScene = SCENE.PLAY;


// ===============================
// 📊 VARIÁVEIS DO JOGO
// ===============================
let gameVars = {
  contador: 0, distanciap: 0, meta: 0, passada: 0,
  colisao: false, coracaovida: false, transicao: 0,
  kmMode: false, morred: '',
  invencivel: false,
  invencivelTimer: 0
};


// ===============================
// 🐦 CLASSE BIRD
// ===============================
class Bird {
  constructor() {
    this.x = canvas.width / 2 - 100;
    this.y = canvas.height / 2 + 50;
    this.vy = 0;
    this.gravity = 0.25;
    this.jump = -7;
    this.size = 60;
    this.lookIndex = 0;
    this.lastSwitch = 0;
  }

  update() {
    this.vy += this.gravity;
    this.y += this.vy;

    if (this.y > canvas.height - 40) {
      this.y = canvas.height - 40;
      this.vy = 0;
      if (!gameVars.coracaovida) triggerGameOver();
    }

    if (this.y < 20) {
      this.y = 20;
      this.vy = 0;
    }

    if (inputPressed) {
      this.vy = this.jump;
      inputPressed = false;
      this.lookIndex = 2;
    }

    if (frameCount - this.lastSwitch > 10) {
      this.lookIndex = (this.lookIndex + 1) % 3;
      this.lastSwitch = frameCount;
    }
  }

  draw() {
    let imgKey;

    if (currentScene === SCENE.PLAY) {
      imgKey = (frameCount % 30 < 15) ? 'birdIdle1' : 'birdIdle2';
    } else {
      const map = ['birdFly1', 'birdFly2', 'birdFly3'];
      imgKey = map[this.lookIndex];
    }

    const img = images[imgKey];

    if (img) {
      ctx.drawImage(img, this.x - this.size/2, this.y - this.size/2, this.size, this.size);
    } else {
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


// ===============================
// 🔁 LOOP PRINCIPAL
// ===============================
function loop() {
  frameCount++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentScene === SCENE.PLAY) drawPlayScene();
  else if (currentScene === SCENE.GAME) {
    updateGameplay();
    drawGameScene();
  } else if (currentScene === SCENE.GAMEOVER) {
    drawGameOverScene();
  }

  requestAnimationFrame(loop);
}


// ===============================
// ⚙️ INIT
// ===============================
function initGame() {}