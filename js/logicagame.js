/* =========================================================
   PASSARINHO JORNADA v5.2
   NOVIDADES:
   - Sistema de moedas: obstáculos desvios geram moedas
   - Chão animado com paralaxe (2 camadas)
   - Fundo animado com paralaxe (nuvens/pirâmides)
   - Obstáculos piscam vermelho antes de colidir (aviso)
   - Pássaro pisca e tem efeito de invencibilidade colorido
   - Tela de pausa (tecla P ou botão na HUD)
   - Efeito de câmera shake na colisão
   - Contador de moedas na HUD
   - Moedas ganhas ao desviar adicionadas ao storeState
   BUGS CORRIGIDOS:
   - handleHit chamado múltiplas vezes no mesmo frame (debounce)
   - Escudo sendo aplicado depois de já estar em colisão
   - Input.consume() faltando em alguns caminhos da loja
   - Spawn do coração durante invencibilidade ativa
   - Obstacle scored não resetando ao reciclar avião
   - frameCount não resetando ao reiniciar (acumulava lixo)
   - Combo não zerando ao perder uma vida
   INTEGRAÇÃO SUPABASE REAL:
   - Importa supabase do supabaseClient.js do projeto
   - Lê usuário logado via auth.getUser() (auth.js)
   - Username vem de user.user_metadata.username
   - Salva score na tabela "scores" via supabase.from()
   - Busca top 10 ranking global via supabase.from()
   - Tela de ranking (LEADERBOARD) acessível no menu
   - Se não há sessão ativa, usa nome local como fallback
   ========================================================= */

'use strict';

// ─── SUPABASE CLIENT (importado do seu supabaseClient.js) ─
import { supabase } from './supabaseClient.js';

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
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
function randomBetween(a, b) { return a + Math.random() * (b - a); }

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

// ─── INPUT (com escala para tela cheia) ───────────────────
const Input = {
  pressed: false,
  x: 0, y: 0,
  consume() { this.pressed = false; },
  set(clientX, clientY) {
    this.pressed = true;
    if (clientX < 0) { this.x = -1; this.y = -1; return; }
    const r      = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / r.width;
    const scaleY = canvas.height / r.height;
    this.x = (clientX - r.left) * scaleX;
    this.y = (clientY - r.top)  * scaleY;
  },
};
canvas.addEventListener('mousedown', (e) => Input.set(e.clientX, e.clientY));
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  Input.set(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (e.changedTouches.length > 0)
    Input.set(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
}, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') Input.set(-1, -1);
  if (e.key === 'p' || e.key === 'P') togglePause();
});

// ─── ESTADOS ──────────────────────────────────────────────
const SCENE = { PLAY: 'PLAY', GAME: 'GAME', GAMEOVER: 'GAMEOVER', STORE: 'STORE', NAME: 'NAME', LEADERBOARD: 'LEADERBOARD' };
let currentScene = SCENE.NAME;
let gamePaused = false;

function togglePause() {
  if (currentScene !== SCENE.GAME) return;
  gamePaused = !gamePaused;
}

// =========================================================
// ─── PLAYER STORE (Loja de Power-ups, Skins, Items) ───────
// =========================================================
/*
  Estrutura preparada para expansão.
  Cada item tem: id, tipo ('skin'|'powerup'|'item'), nome, descrição,
  preço em moedas, desbloqueado por padrão ou não, e efeito.

  Para ativar visualmente: basta preencher os campos imgKey com
  as imagens reais e conectar ao Supabase via SupabaseService.
*/
const STORE_CATALOG = {
  // ── SKINS DO PÁSSARO ──────────────────────────────────
  skins: [
    {
      id: 'skin_default',
      name: 'Passarim Clássico',
      desc: 'O original de sempre',
      price: 0,
      unlocked: true,
      imgKey: 'birdFly1', // usa sprite existente como preview
    },
    {
      id: 'skin_golden',
      name: 'Passarim Dourado',
      desc: 'Brilha igual ouro!',
      price: 50,
      unlocked: false,
      imgKey: null, // adicionar "../GAME/skins/bird_golden.png"
      tint: '#FFD700',
    },
    {
      id: 'skin_fire',
      name: 'Passarim de Fogo',
      desc: 'Deixa rastro de chamas',
      price: 100,
      unlocked: false,
      imgKey: null, // adicionar "../GAME/skins/bird_fire.png"
      tint: '#FF4500',
      trailColor: '#FF6B00',
    },
    {
      id: 'skin_ice',
      name: 'Passarim Gelado',
      desc: 'Fresco como o vento',
      price: 100,
      unlocked: false,
      imgKey: null,
      tint: '#00BFFF',
      trailColor: '#87CEEB',
    },
  ],

  // ── POWER-UPS PERMANENTES (upgrades de duração) ───────
  powerupUpgrades: [
    {
      id: 'pu_shield_plus',
      name: 'Escudo Reforçado',
      desc: 'Escudo dura 50% mais',
      price: 80,
      unlocked: false,
      affects: 'shield',
      multiplier: 1.5,
    },
    {
      id: 'pu_slowmo_plus',
      name: 'Slow-Mo Extra',
      desc: 'Câmera lenta dura mais',
      price: 80,
      unlocked: false,
      affects: 'slowmo',
      multiplier: 1.5,
    },
    {
      id: 'pu_double_plus',
      name: 'Score Duplo+',
      desc: 'Pontuação dupla por mais tempo',
      price: 120,
      unlocked: false,
      affects: 'doubleScore',
      multiplier: 1.5,
    },
    {
      id: 'pu_extra_life',
      name: 'Vida Extra',
      desc: 'Começa com 2 vidas',
      price: 150,
      unlocked: false,
      affects: 'startLives',
      bonus: 1,
    },
  ],

  // ── ITENS COSMÉTICOS ──────────────────────────────────
  cosmetics: [
    {
      id: 'hat_top',
      name: 'Cartola',
      desc: 'Muito elegante!',
      price: 30,
      unlocked: false,
      imgKey: null, // adicionar "../GAME/cosmetics/hat_top.png"
    },
    {
      id: 'hat_cowboy',
      name: 'Chapéu Cowboy',
      desc: 'Arre!',
      price: 30,
      unlocked: false,
      imgKey: null,
    },
    {
      id: 'trail_rainbow',
      name: 'Rastro Arco-Íris',
      desc: 'Deixa um rastro colorido',
      price: 60,
      unlocked: false,
      trailColors: ['#FF0000','#FF7700','#FFFF00','#00FF00','#0000FF','#8B00FF'],
    },
  ],
};

// Estado atual da loja (carregado do localStorage)
const PlayerStore = {
  _key: 'passarim_store',

  load() {
    try {
      const raw = localStorage.getItem(this._key);
      return raw ? JSON.parse(raw) : this._defaults();
    } catch (_) { return this._defaults(); }
  },

  save(state) {
    try { localStorage.setItem(this._key, JSON.stringify(state)); } catch (_) {}
  },

  _defaults() {
    return {
      coins: 0,
      activeSkin: 'skin_default',
      activeCosmetic: null,
      unlocked: ['skin_default'],
    };
  },

  // Tenta comprar um item; retorna { ok, reason }
  purchase(itemId, state) {
    const item = this._findItem(itemId);
    if (!item) return { ok: false, reason: 'Item não encontrado' };
    if (state.unlocked.includes(itemId)) return { ok: false, reason: 'Já desbloqueado' };
    if (state.coins < item.price) return { ok: false, reason: 'Moedas insuficientes' };
    state.coins -= item.price;
    state.unlocked.push(itemId);
    this.save(state);
    return { ok: true };
  },

  _findItem(id) {
    const all = [
      ...STORE_CATALOG.skins,
      ...STORE_CATALOG.powerupUpgrades,
      ...STORE_CATALOG.cosmetics,
    ];
    return all.find(i => i.id === id) || null;
  },

  // Retorna multiplicador de duração de um power-up (se upgrade comprado)
  getDurationMultiplier(type, state) {
    const upg = STORE_CATALOG.powerupUpgrades.find(u => u.affects === type);
    if (!upg) return 1;
    return state.unlocked.includes(upg.id) ? upg.multiplier : 1;
  },

  // Retorna quantas vidas extras o jogador tem ao começar
  getStartLivesBonus(state) {
    const upg = STORE_CATALOG.powerupUpgrades.find(u => u.affects === 'startLives');
    if (!upg) return 0;
    return state.unlocked.includes(upg.id) ? upg.bonus : 0;
  },

  // Skin ativa: retorna tint e trailColor (null = padrão)
  getActiveSkinConfig(state) {
    const skin = STORE_CATALOG.skins.find(s => s.id === state.activeSkin);
    return skin || STORE_CATALOG.skins[0];
  },
};

// =========================================================
// ─── SUPABASE SERVICE (integração real) ───────────────────
// =========================================================
/*
  Tabela necessária no Supabase (rode no SQL Editor):

  create table if not exists scores (
    id         uuid default gen_random_uuid() primary key,
    user_id    uuid references auth.users(id) on delete set null,
    player     text not null,
    km         integer not null default 0,
    score      integer not null default 0,
    skin       text default 'skin_default',
    created_at timestamptz default now()
  );

  -- Habilita leitura pública do ranking:
  alter table scores enable row level security;
  create policy "leitura publica" on scores for select using (true);
  create policy "insert proprio" on scores for insert
    with check (auth.uid() = user_id or user_id is null);
*/

// Usuário logado atualmente (carregado no boot)
let currentUser = null;

const SupabaseService = {

  // ── Carrega o usuário da sessão ativa (auth.js → getUser) ──
  async loadUser() {
    try {
      const { data } = await supabase.auth.getUser();
      currentUser = data?.user ?? null;
      if (currentUser) {
        // Sincroniza nome do usuário Supabase com o LocalData
        const username = currentUser.user_metadata?.username || currentUser.email || '';
        const d = LocalData.load();
        if (username && !d.name) { d.name = username; LocalData.save(d); }
        console.info(`[Supabase] Usuário: ${username}`);
      } else {
        console.info('[Supabase] Nenhuma sessão ativa — modo offline.');
      }
    } catch (err) {
      console.warn('[Supabase] Erro ao carregar usuário:', err.message);
      currentUser = null;
    }
  },

  // ── Salva score usando supabase.from() ──────────────────
  async saveScore({ km, score, skin = 'skin_default' }) {
    // Nome: prefere username do Supabase, fallback para LocalData
    const player = currentUser?.user_metadata?.username
      || currentUser?.email
      || LocalData.load().name
      || 'Anônimo';

    const payload = {
      player,
      km,
      score,
      skin,
      user_id: currentUser?.id ?? null,
    };

    try {
      const { error } = await supabase.from('scores').insert(payload);
      if (error) {
        console.error('[Supabase] Erro ao salvar score:', error.message);
        return { ok: false, error: error.message };
      }
      console.info(`[Supabase] Score salvo: ${player} — ${km} km`);
      return { ok: true };
    } catch (err) {
      console.error('[Supabase] Erro inesperado:', err.message);
      return { ok: false };
    }
  },

  // ── Busca top 10 ranking global ─────────────────────────
  async getTopScores(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('scores')
        .select('player, km, score, skin, created_at')
        .order('km', { ascending: false })
        .limit(limit);

      if (error) { console.warn('[Supabase] Erro no ranking:', error.message); return []; }
      return data ?? [];
    } catch (_) { return []; }
  },

  // ── Melhor score do usuário logado ──────────────────────
  async getMyBest() {
    if (!currentUser) return null;
    try {
      const { data } = await supabase
        .from('scores')
        .select('km, score')
        .eq('user_id', currentUser.id)
        .order('km', { ascending: false })
        .limit(1)
        .single();
      return data ?? null;
    } catch (_) { return null; }
  },
};

// ─── PERSISTÊNCIA LOCAL ───────────────────────────────────
const LocalData = {
  _key: 'passarim_player',

  load() {
    try {
      const raw = localStorage.getItem(this._key);
      return raw ? JSON.parse(raw) : { name: '', bestKm: 0, totalGames: 0 };
    } catch (_) { return { name: '', bestKm: 0, totalGames: 0 }; }
  },

  save(data) {
    try { localStorage.setItem(this._key, JSON.stringify(data)); } catch (_) {}
  },

  updateAfterGame(km) {
    const d = this.load();
    d.totalGames = (d.totalGames || 0) + 1;
    if (km > (d.bestKm || 0)) d.bestKm = km;
    this.save(d);
    return d;
  },
};

// ─── HIGH SCORE (wrapper simples) ─────────────────────────
const HighScore = {
  get()    { return LocalData.load().bestKm || 0; },
  getName(){ return LocalData.load().name   || ''; },
};

// ─── PARALAXE ────────────────────────────────────────────────
const Parallax = {
  // Duas camadas de chão que rolam em velocidades diferentes
  ground: [
    { x: 0, speed: 1.0, color: '#8B6914', h: 18 }, // camada traseira (mais lenta)
    { x: 0, speed: 1.8, color: '#6B4F0F', h: 10 }, // camada frontal (mais rápida)
  ],
  // Duas camadas de fundo (nuvens simuladas quando não há imagem)
  bg: [
    { x: 0, speed: 0.3 },
    { x: canvas.width / 2, speed: 0.5 },
  ],

  update(gameSpeed) {
    this.ground.forEach(g => {
      g.x -= g.speed * gameSpeed;
      if (g.x <= -canvas.width) g.x = 0;
    });
    this.bg.forEach(b => {
      b.x -= b.speed * gameSpeed;
      if (b.x <= -canvas.width) b.x = 0;
    });
  },

  drawGround() {
    const groundY = canvas.height - 30;
    this.ground.forEach(g => {
      ctx.fillStyle = g.color;
      // Duas cópias para looping contínuo
      ctx.fillRect(g.x,                  groundY, canvas.width, g.h);
      ctx.fillRect(g.x + canvas.width,   groundY, canvas.width, g.h);
    });
  },

  // Nuvens de fallback quando não há imagem de bg
  drawBgClouds() {
    ctx.globalAlpha = 0.18;
    ctx.fillStyle   = 'white';
    this.bg.forEach(b => {
      [0, canvas.width].forEach(offset => {
        ctx.beginPath();
        ctx.arc(b.x + offset + 80,  80, 40, 0, Math.PI * 2);
        ctx.arc(b.x + offset + 130, 70, 55, 0, Math.PI * 2);
        ctx.arc(b.x + offset + 180, 80, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x + offset + 400, 130, 30, 0, Math.PI * 2);
        ctx.arc(b.x + offset + 440, 120, 45, 0, Math.PI * 2);
        ctx.arc(b.x + offset + 480, 130, 30, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    ctx.globalAlpha = 1;
  },

  reset() {
    this.ground.forEach(g => { g.x = 0; });
    this.bg.forEach((b, i) => { b.x = i * (canvas.width / 2); });
  },
};

// ─── PARTÍCULAS ───────────────────────────────────────────
class Particle {
  constructor(x, y, color, vx, vy, life, size) {
    Object.assign(this, { x, y, color, vx, vy, life, maxLife: life, size, alive: true });
  }
  update() {
    this.vy += 0.12; this.x += this.vx; this.y += this.vy;
    if (--this.life <= 0) this.alive = false;
  }
  draw() {
    ctx.globalAlpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.fillStyle   = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
const ParticleSystem = {
  pool: [],
  spawn(x, y, color, count = 8, speed = 3, life = 30, size = 4) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = randomBetween(0.5, 1) * speed;
      this.pool.push(new Particle(x, y, color, Math.cos(a)*s, Math.sin(a)*s - 1, life, size));
    }
  },
  update() { this.pool = this.pool.filter(p => { p.update(); return p.alive; }); },
  draw()   { this.pool.forEach(p => p.draw()); },
  clear()  { this.pool = []; },
};

// ─── TRANSIÇÃO FADE ───────────────────────────────────────
const Transition = {
  alpha: 0, dir: 0, speed: 0.07, cb: null,
  start(cb) {
    // Se já estava em transição, executa o callback pendente antes de sobrescrever
    if (this.cb) { this.cb(); }
    this.alpha = 0; this.dir = 1; this.cb = cb;
  },
  update() {
    if (!this.dir) return;
    this.alpha = Math.min(1, Math.max(0, this.alpha + this.dir * this.speed));
    if (this.alpha >= 1 && this.dir === 1) {
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

// ─── CAMERA SHAKE ────────────────────────────────────────
const CameraShake = {
  intensity: 0,
  duration:  0,
  trigger(intensity = 6, duration = 15) {
    this.intensity = intensity;
    this.duration  = duration;
  },
  update() {
    if (this.duration > 0) {
      this.intensity *= 0.85;
      this.duration--;
    }
  },
  apply() {
    if (this.duration <= 0) return;
    const dx = (Math.random() - 0.5) * this.intensity;
    const dy = (Math.random() - 0.5) * this.intensity;
    ctx.save();
    ctx.translate(dx, dy);
  },
  restore() {
    if (this.duration > 0) ctx.restore();
  },
};

// ─── FLOATING TEXT ────────────────────────────────────────
class FloatingText {
  constructor(x, y, text, color) {
    Object.assign(this, { x, y, text, color, life: 60, vy: -1.2, alive: true });
  }
  update() { this.y += this.vy; if (--this.life <= 0) this.alive = false; }
  draw() {
    ctx.globalAlpha = clamp(this.life / 60, 0, 1);
    ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
    ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.fillStyle = this.color;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText  (this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}
const floatingTexts = [];
function spawnFloat(x, y, text, color = 'white') {
  floatingTexts.push(new FloatingText(x, y, text, color));
}

// ─── DIFICULDADE ──────────────────────────────────────────
const Difficulty = {
  level: 1,
  getSpeed(km) {
    this.level = clamp(1 + Math.floor(km / 5), 1, 10);
    return 2.5 + (this.level - 1) * 0.35;
  },
  getSpawnInterval(km) { return Math.max(60, 120 - Math.floor(km / 3) * 6); },
};

// ─── PÁSSARO ──────────────────────────────────────────────
class Bird {
  constructor() {
    this.x = canvas.width / 2 - 100;
    this.y = canvas.height / 2 + 50;
    this.vy = 0; this.gravity = 0.25; this.jumpForce = -7;
    this.size = 60; this.frameIndex = 0; this.lastSwitch = 0;
    this.trail = [];
  }
  flap() {
    this.vy = this.jumpForce; this.frameIndex = 2;
    playSound('sndTweet');
    const skinCfg = PlayerStore.getActiveSkinConfig(storeState);
    ParticleSystem.spawn(this.x, this.y, skinCfg.trailColor || '#FFD700', 4, 2, 20, 3);
  }
  update() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 10) this.trail.shift();
    this.vy += this.gravity; this.y += this.vy;
    if (this.y > canvas.height - 40) { this.y = canvas.height - 40; this.vy = 0; triggerGameOver(); }
    if (this.y < 20) { this.y = 20; this.vy = 0; }
    if (Input.pressed) { this.flap(); Input.consume(); }
    if (frameCount - this.lastSwitch > 10) {
      this.frameIndex = (this.frameIndex + 1) % 3; this.lastSwitch = frameCount;
    }
  }
  draw() {
    const skinCfg = PlayerStore.getActiveSkinConfig(storeState);
    const trailColor = skinCfg.trailColor || '#FFD700';
    if (currentScene === SCENE.GAME) {
      this.trail.forEach((p, i) => {
        ctx.globalAlpha = (i / this.trail.length) * 0.25;
        ctx.fillStyle = trailColor;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4 * (i / this.trail.length), 0, Math.PI * 2); ctx.fill();
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
    if (gv.shield) {
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#00BFFF'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size / 2 + 8, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const img = images[imgKey] || (skinCfg.imgKey ? images[skinCfg.imgKey] : null);
    if (img) {
      ctx.drawImage(img, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    } else {
      ctx.fillStyle = skinCfg.tint || '#FFD700';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  getBounds() {
    const m = 10;
    return { x: this.x - this.size/2 + m, y: this.y - this.size/2 + m,
             w: this.size - m*2, h: this.size - m*2 };
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
    this.type = type; const cfg = OBSTACLE_CONFIG[type];
    this.imgKey = cfg.imgKey; this.width = cfg.w; this.height = cfg.h; this.scored = false;
    if (cfg.fromLeft) {
      this.x = -this.width - 20; this.y = 90 + Math.random() * 200; this.speedX = 0;
    } else if (type === 'tree3') {
      this.x = x !== undefined ? x : canvas.width + 50;
      this.y = canvas.height - 140 - Math.random() * 100; this.speedX = 0;
    } else {
      this.x = x !== undefined ? x : canvas.width + 50;
      this.y = canvas.height - cfg.groundOffset; this.speedX = 0;
    }
  }
  update(speed) {
    const fromLeft = OBSTACLE_CONFIG[this.type].fromLeft;
    this.speedX = fromLeft ? +(speed * 1.1) : -(speed);
    this.x += this.speedX;
    if (fromLeft) {
      if (this.x > canvas.width + 20) {
        this.x = -this.width - 20; this.y = 80 + Math.random() * 200;
        this.scored = false; // BUG FIX: garante reset do combo ao reciclar avião
      }
    } else {
      if (this.x < -this.width - 20) {
        this.x = canvas.width + 50 + Math.random() * 200; this.scored = false;
        if (this.type === 'tree3') this.y = canvas.height - 140 - Math.random() * 100;
      }
    }
  }
  draw() {
    const img = images[this.imgKey];
    // Aviso visual: pisca vermelho quando está próximo do pássaro
    const nearBird = bird && Math.abs(this.x - bird.x) < 120;
    if (nearBird && !gv.invencivel && !gv.shield && frameCount % 8 < 4) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
    }
    if (img) { ctx.drawImage(img, this.x, this.y, this.width, this.height); }
    else { ctx.fillStyle = this.type === 'plane' ? '#708090' : '#228B22'; ctx.fillRect(this.x, this.y, this.width, this.height); }
    if (nearBird && !gv.invencivel && !gv.shield && frameCount % 8 < 4) {
      ctx.fillStyle = 'rgba(255,0,0,0.35)';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.restore();
    }
  }
  getBounds() { return { x: this.x, y: this.y, w: this.width, h: this.height }; }
}

// ─── CORAÇÃO (vem da direita → esquerda, dá +1 vida) ──────
class Heart {
  constructor() { this.reset(); }
  reset() { this.visible = false; this.x = canvas.width + 60; this.y = 0; this.size = 50; this.speedX = 0; this.active = false; }

  show(gameSpeed) {
    this.visible = true; this.active = true;
    this.x       = canvas.width + 60;
    this.y       = randomBetween(100, canvas.height - 200);
    this.speedX  = -(gameSpeed * 0.7); // um pouco mais devagar que os obstáculos
    playSound('sndDrip');
  }

  update(gameSpeed) {
    if (!this.visible) return;
    this.speedX = -(gameSpeed * 0.7);
    this.x += this.speedX;
    if (this.x < -this.size - 20) { this.visible = false; this.active = false; }
  }

  draw() {
    if (!this.visible) return;
    const pulse = 1 + 0.08 * Math.sin(frameCount * 0.15);
    const s = this.size * pulse, ox = (s - this.size) / 2;
    const img = images.heart;
    if (img) {
      ctx.drawImage(img, this.x - ox, this.y - ox, s, s);
    } else {
      ctx.fillStyle = '#FF0000'; ctx.beginPath();
      const hx = this.x - ox, hy = this.y - ox;
      ctx.moveTo(hx+s/2, hy+s/4);
      ctx.quadraticCurveTo(hx,     hy,       hx,   hy+s/2);
      ctx.quadraticCurveTo(hx+s/2, hy+s*.85, hx+s, hy+s/2);
      ctx.quadraticCurveTo(hx+s,   hy,       hx+s/2, hy+s/4);
      ctx.fill();
    }
  }
  getBounds() { return { x: this.x - 5, y: this.y - 5, w: this.size + 10, h: this.size + 10 }; }
}

// ─── POWER-UPS (vêm da direita → esquerda) ────────────────
const POWERUP_TYPES = {
  shield:      { color: '#00BFFF', label: '🛡️', duration: 10 * 60 },
  slowmo:      { color: '#9B59B6', label: '🐢',  duration: 8  * 60 },
  doubleScore: { color: '#F1C40F', label: '⭐',  duration: 12 * 60 },
};
class PowerUp {
  constructor() { this.reset(); }
  reset() { this.visible = false; this.x = canvas.width + 80; this.y = 0; this.type = ''; this.speedX = 0; this.active = false; }
  show(gameSpeed) {
    const types = Object.keys(POWERUP_TYPES);
    this.type   = types[Math.floor(Math.random() * types.length)];
    this.visible = true; this.active = true;
    this.x       = canvas.width + 80;
    this.y       = randomBetween(80, canvas.height - 150);
    this.speedX  = -(gameSpeed * 0.75);
  }
  update(gameSpeed) {
    if (!this.visible) return;
    this.speedX = -(gameSpeed * 0.75);
    this.x += this.speedX;
    if (this.x < -80) { this.visible = false; this.active = false; }
  }
  draw() {
    if (!this.visible) return;
    const cfg = POWERUP_TYPES[this.type];
    const pulse = 1 + 0.1 * Math.sin(frameCount * 0.18), s = 40 * pulse;
    ctx.save(); ctx.shadowColor = cfg.color; ctx.shadowBlur = 15;
    ctx.fillStyle = cfg.color; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(this.x, this.y, s / 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.font = `${Math.round(s * 0.6)}px Arial`; ctx.textAlign = 'center';
    ctx.fillText(cfg.label, this.x, this.y + s * 0.2);
  }
  getBounds() { return { x: this.x - 20, y: this.y - 20, w: 40, h: 40 }; }
}

// ─── CORUJA ───────────────────────────────────────────────
class Owl {
  constructor() { this.visible = false; this.x = canvas.width - 200; this.y = canvas.height - 200; this.timer = 0; this.msg = ''; }
  show(msg) { this.visible = true; this.timer = 300; this.msg = msg; }
  update() { if (this.visible && --this.timer <= 0) this.visible = false; }
  draw() {
    if (!this.visible) return;
    const img = (frameCount % 60 < 30) ? images.owl1 : images.owl2;
    if (img) { ctx.drawImage(img, this.x, this.y, 80, 80); }
    else { ctx.fillStyle='#8B4513'; ctx.beginPath(); ctx.arc(this.x+40,this.y+40,30,0,Math.PI*2); ctx.fill(); }
    const bx = this.x - 180, by = this.y - 70;
    ctx.fillStyle='white'; ctx.strokeStyle='black'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.roundRect(bx, by, 240, 55, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle='black'; ctx.font='13px Arial'; ctx.textAlign='left';
    ctx.fillText(this.msg, bx+10, by+32);
  }
}

// ─── ESTADO GLOBAL DO JOGO ────────────────────────────────
let gv = {};
function makeGameVars(livesBonus = 0) {
  return {
    lives:          clamp(1 + livesBonus, 1, 4), // começa com 1 (ou mais com upgrade)
    maxLives:       4,
    contador:       0,
    distanciap:     0,
    meta:           0,
    colisao:        false,
    kmMode:         false, kmModeTimer: 0,
    invencivel:     false, invencivelTimer: 0,
    shield:         false, shieldTimer: 0,
    slowmo:         false, slowmoTimer: 0,
    doubleScore:    false, doubleScoreTimer: 0,
    combo:          0,     comboTimer: 0,
    totalScore:     0,
    heartNextAt:    1800,  // frame em que o próximo coração aparece
    powerupNextAt:  3000,
  };
}

let bird, obstacles, heart, powerup, owl;
let frameCount = 0;
let storeState = PlayerStore.load(); // estado da loja carregado uma vez

function resetGameVars() {
  const livesBonus = PlayerStore.getStartLivesBonus(storeState);
  gv = makeGameVars(livesBonus);
  obstacles = []; floatingTexts.length = 0; ParticleSystem.clear();
  bird = new Bird(); heart = new Heart(); powerup = new PowerUp(); owl = new Owl();
  Difficulty.level = 1;
  gamePaused = false; // garante que começa sem pausa
  Parallax.reset();
  for (let i = 0; i < 3; i++) spawnObstacle(canvas.width + i * 350);
  obstacles.push(new Obstacle('plane'));
}

function startGame() {
  frameCount = 0;
  gamePaused = false;
  Transition.start(() => {
    currentScene = SCENE.GAME;
    frameCount   = 0;
    resetGameVars();
  });
}

function triggerGameOver() {
  if (gv.colisao) return;
  gv.colisao = true;
  ParticleSystem.spawn(bird.x, bird.y, '#FF4500', 20, 5, 40, 6);
  playSound('sndLose');

  // Salva localmente
  const playerData = LocalData.updateAfterGame(gv.distanciap);

  // Envia para Supabase — usa usuário da sessão ativa
  SupabaseService.saveScore({
    km:    gv.distanciap,
    score: gv.totalScore,
    skin:  storeState.activeSkin,
  }); // async, não bloqueia

  setTimeout(() => {
    Transition.start(() => { currentScene = SCENE.GAMEOVER; });
  }, 600);
}

function backToMenu() { Transition.start(() => { currentScene = SCENE.PLAY; }); }

function spawnObstacle(x) {
  const r = Math.random();
  const type = r < 0.40 ? 'tree' : r < 0.70 ? 'tree2' : 'tree3';
  obstacles.push(new Obstacle(type, x !== undefined ? x : canvas.width + 50));
}

// ─── LÓGICA DE JOGO ───────────────────────────────────────
function updateGameplay() {
  if (gv.colisao || gamePaused) return;

  const speed = gv.slowmo ? Difficulty.getSpeed(gv.distanciap) * 0.5 : Difficulty.getSpeed(gv.distanciap);

  bird.update();

  if (frameCount % Difficulty.getSpawnInterval(gv.distanciap) === 0) spawnObstacle();

  obstacles.forEach((obs) => {
    obs.update(speed);
    // Colisão normal
    if (!gv.invencivel && !gv.shield && checkCollision(bird.getBounds(), obs.getBounds())) {
      handleHit();
    }
    // Escudo absorve
    if (gv.shield && checkCollision(bird.getBounds(), obs.getBounds())) {
      gv.shield = false; gv.shieldTimer = 0;
      ParticleSystem.spawn(bird.x, bird.y, '#00BFFF', 16, 4, 30, 4);
      spawnFloat(bird.x, bird.y - 40, '🛡️ ESCUDO!', '#00BFFF');
      playSound('sndBing');
      obs.x = canvas.width + 100;
    }
    // Combo + moedas ao desviar
    if (!obs.scored && obs.type !== 'plane' && obs.x + obs.width < bird.x - 30) {
      obs.scored = true; gv.combo++; gv.comboTimer = 4 * 60;
      const pts = gv.doubleScore ? gv.combo * 2 : gv.combo;
      gv.totalScore += pts;

      // Ganha 1 moeda a cada desvio, 2 se doubleScore ativo
      const coinsGained = gv.doubleScore ? 2 : 1;
      storeState.coins += coinsGained;
      PlayerStore.save(storeState);

      if (gv.combo >= 3) {
        spawnFloat(bird.x, bird.y - 50, `x${gv.combo} COMBO! +${pts}`, '#FFD700');
        ParticleSystem.spawn(bird.x, bird.y, '#FFD700', 6, 3, 20, 3);
      }
      // Moeda flutuante discreta
      spawnFloat(obs.x + obs.width / 2, obs.y - 10, `+${coinsGained}🪙`, '#F1C40F');
    }
  });

  // Coração
  heart.update(speed);
  if (heart.visible && checkCollision(bird.getBounds(), heart.getBounds())) {
    collectHeart();
  }
  // BUG FIX: não spawna coração durante invencibilidade ativa
  if (!heart.active && frameCount >= gv.heartNextAt && !gv.invencivel) {
    heart.show(speed);
  }

  // Power-up
  powerup.update(speed);
  if (powerup.visible && checkCollision(bird.getBounds(), powerup.getBounds())) {
    applyPowerUp(powerup.type);
    powerup.reset();
    gv.powerupNextAt = frameCount + randomBetween(2500, 4000);
  }
  if (!powerup.active && frameCount >= gv.powerupNextAt) {
    powerup.show(speed);
  }

  owl.update();
  CameraShake.update();
  Parallax.update(speed);
  ParticleSystem.update();
  floatingTexts.forEach(t => t.update());
  floatingTexts.splice(0, floatingTexts.length, ...floatingTexts.filter(t => t.alive));

  // Score
  const inc = gv.doubleScore ? 2 : 1;
  if (frameCount % 5 === 0) gv.contador += inc;
  if (gv.contador >= 1000) {
    gv.distanciap++; gv.contador = 0; gv.kmMode = true; gv.kmModeTimer = 60;
    playSound('sndBing');
    spawnFloat(canvas.width / 2, canvas.height / 2 - 80,
      `+1 KM  (Nv ${Difficulty.level})`, '#00FF88');
  }
  if (gv.kmMode && --gv.kmModeTimer <= 0) gv.kmMode = false;

  // Timers
  if (gv.invencivel  && --gv.invencivelTimer  <= 0) gv.invencivel  = false;
  if (gv.shield      && --gv.shieldTimer      <= 0) gv.shield      = false;
  if (gv.slowmo      && --gv.slowmoTimer      <= 0) gv.slowmo      = false;
  if (gv.doubleScore && --gv.doubleScoreTimer <= 0) gv.doubleScore = false;
  if (gv.comboTimer  > 0 && --gv.comboTimer   <= 0) gv.combo       = 0;
  if (gv._hitCooldown > 0) gv._hitCooldown--;
}

function handleHit() {
  if (gv.invencivel || gv.shield) return;
  // Debounce: evita múltiplos hits no mesmo frame
  if (gv._hitCooldown && gv._hitCooldown > 0) return;
  gv._hitCooldown = 30; // frames de cooldown entre hits
  gv.lives--;
  gv.combo = 0; gv.comboTimer = 0; // BUG FIX: zera combo ao levar dano
  if (gv.lives <= 0) {
    triggerGameOver();
  } else {
    gv.invencivel = true; gv.invencivelTimer = 90; // 1.5s de graça
    CameraShake.trigger(8, 20); // shake na colisão
    ParticleSystem.spawn(bird.x, bird.y, '#FF4500', 10, 4, 25, 4);
    spawnFloat(bird.x, bird.y - 50, '❤️ -1 VIDA', '#FF4444');
    playSound('sndBeep');
  }
}

function collectHeart() {
  heart.visible = false; heart.active = false;
  gv.heartNextAt = frameCount + randomBetween(2000, 4000);

  // +1 vida (máx 4)
  if (gv.lives < gv.maxLives) {
    gv.lives++;
    spawnFloat(heart.x + heart.size / 2, heart.y, '❤️ +1 VIDA!', '#FF69B4');
  } else {
    spawnFloat(heart.x + heart.size / 2, heart.y, '❤️ VIDAS CHEIAS!', '#FF69B4');
  }

  // Invencibilidade ao pegar o coração
  gv.invencivel = true;
  gv.invencivelTimer = 30 * 60; // 30 segundos
  owl.show('Invencível por 30s! ✨');
  ParticleSystem.spawn(heart.x + heart.size / 2, heart.y + heart.size / 2, '#FF69B4', 16, 4, 40, 5);
  playSound('sndDrip');
}

function applyPowerUp(type) {
  const cfg  = POWERUP_TYPES[type];
  const mult = PlayerStore.getDurationMultiplier(type, storeState);
  const dur  = Math.round(cfg.duration * mult);
  playSound('sndBing');
  ParticleSystem.spawn(bird.x, bird.y, cfg.color, 14, 4, 35, 5);
  if (type === 'shield') {
    gv.shield = true; gv.shieldTimer = dur;
    owl.show('Escudo ativado! Absorve 1 colisão! 🛡️');
    spawnFloat(bird.x, bird.y - 50, '🛡️ ESCUDO!', cfg.color);
  } else if (type === 'slowmo') {
    gv.slowmo = true; gv.slowmoTimer = dur;
    owl.show('Câmera lenta! Respira! 🐢');
    spawnFloat(bird.x, bird.y - 50, '🐢 SLOW-MO!', cfg.color);
  } else if (type === 'doubleScore') {
    gv.doubleScore = true; gv.doubleScoreTimer = dur;
    owl.show('Pontuação DUPLA! ⭐');
    spawnFloat(bird.x, bird.y - 50, '⭐ DOBROU!', cfg.color);
  }
}

// ─── HUD ──────────────────────────────────────────────────
function drawHUD() {
  // Vidas (corações) no topo esquerdo
  for (let i = 0; i < gv.maxLives; i++) {
    const filled = i < gv.lives;
    const hx = 45 + i * 38, hy = 62;
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    ctx.globalAlpha = filled ? 1 : 0.25;
    ctx.fillText('❤️', hx, hy);
    ctx.globalAlpha = 1;
  }

  // Score / km (à direita dos corações)
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.roundRect(205, 10, 160, 50, 8); ctx.fill();
  ctx.font = 'bold 32px Arial'; ctx.strokeStyle = 'black'; ctx.lineWidth = 3;
  ctx.fillStyle = 'white'; ctx.textAlign = 'left';
  const scoreText = gv.kmMode ? gv.distanciap + ' km' : String(gv.contador);
  ctx.strokeText(scoreText, 215, 50); ctx.fillText(scoreText, 215, 50);

  // Distância + nível (canto direito)
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.roundRect(canvas.width - 230, 10, 220, 50, 8); ctx.fill();
  ctx.font = 'bold 24px Arial'; ctx.strokeStyle = 'black'; ctx.fillStyle = 'white';
  const distText = `🗺️ ${gv.distanciap} km  Nv${Difficulty.level}`;
  ctx.strokeText(distText, canvas.width - 50, 44); ctx.fillText(distText, canvas.width - 50, 44);

  // Status de buffs (centro-topo)
  const statuses = [];
  if (gv.invencivel)  statuses.push({ label: `✨ ${Math.ceil(gv.invencivelTimer/60)}s`,  color: '#FFD700' });
  if (gv.shield)      statuses.push({ label: `🛡️ ${Math.ceil(gv.shieldTimer/60)}s`,      color: '#00BFFF' });
  if (gv.slowmo)      statuses.push({ label: `🐢 ${Math.ceil(gv.slowmoTimer/60)}s`,       color: '#9B59B6' });
  if (gv.doubleScore) statuses.push({ label: `⭐ ${Math.ceil(gv.doubleScoreTimer/60)}s`,  color: '#F1C40F' });
  statuses.forEach((s, i) => {
    const bx = canvas.width / 2 - (statuses.length * 120) / 2 + i * 125;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(bx, 10, 115, 40, 8); ctx.fill();
    ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
    ctx.fillStyle = s.color; ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
    ctx.strokeText(s.label, bx + 57, 37); ctx.fillText(s.label, bx + 57, 37);
  });

  // Combo
  if (gv.combo >= 2) {
    const pulse = 1 + 0.05 * Math.sin(frameCount * 0.3);
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(24 * pulse)}px Arial`;
    ctx.fillStyle = '#FFD700'; ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
    ctx.strokeText(`🔥 COMBO x${gv.combo}`, canvas.width/2, canvas.height - 20);
    ctx.fillText  (`🔥 COMBO x${gv.combo}`, canvas.width/2, canvas.height - 20);
    ctx.restore();
  }

  // Record (apenas km + nome)
  const hs = HighScore.get(), hsName = HighScore.getName();
  if (hs > 0) {
    ctx.textAlign = 'right'; ctx.font = '15px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const recStr = hsName ? `🏆 ${hs} km — ${hsName}` : `🏆 ${hs} km`;
    ctx.fillText(recStr, canvas.width - 50, canvas.height - 15);
  }

  // Botão pausa — topo centro
  const pbx = canvas.width / 2 - 22, pby = 8, pbw = 44, pbh = 36;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.roundRect(pbx, pby, pbw, pbh, 6); ctx.fill();
  ctx.textAlign = 'center'; ctx.font = '22px Arial'; ctx.fillStyle = 'white';
  ctx.fillText('⏸', canvas.width / 2, pby + 27);
  if (Input.pressed && pointInRect(Input.x, Input.y, pbx, pby, pbw, pbh)) {
    togglePause(); Input.consume();
  }

  // Moedas na HUD (abaixo do score)
  ctx.textAlign = 'left'; ctx.font = 'bold 16px Arial'; ctx.fillStyle = '#F1C40F';
  ctx.fillText(`🪙 ${storeState.coins}`, 215, 72);

  // "by Johnson Gomes" — canto inferior direito
  ctx.textAlign = 'right'; ctx.font = 'italic 13px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('by Johnson Gomes', canvas.width - 10, canvas.height - 4);
}

// ─── FUNDO ────────────────────────────────────────────────
function drawBackground(scene) {
  const key = scene === SCENE.PLAY ? 'bgPlay' : scene === SCENE.GAME ? 'bgGame' : 'bgGameOver';
  const img = images[key];
  if (img) { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); }
  else {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if      (scene === SCENE.PLAY)     { g.addColorStop(0,'#87CEEB'); g.addColorStop(1,'#E0F7FA'); }
    else if (scene === SCENE.GAME)     { g.addColorStop(0,'#FFF3B0'); g.addColorStop(1,'#E9C46A'); }
    else                               { g.addColorStop(0,'#FFDAC1'); g.addColorStop(1,'#FF6B6B'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// ─── CENA: ENTRADA DE NOME ────────────────────────────────
let nameInput = '';
let nameCursor = true;
let nameCursorTimer = 0;

// ─── LEADERBOARD STATE ────────────────────────────────────
const Leaderboard = {
  entries: [],       // cache dos scores
  loading: false,
  loaded:  false,
  myBest:  null,

  async fetch() {
    this.loading = true;
    this.loaded  = false;
    [this.entries, this.myBest] = await Promise.all([
      SupabaseService.getTopScores(10),
      SupabaseService.getMyBest(),
    ]);
    this.loading = false;
    this.loaded  = true;
  },
};

function drawNameScene() {
  // Fundo gradiente
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#1a1a2e'); g.addColorStop(1, '#16213e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FF00BB'; ctx.font = 'bold 56px Arial';
  ctx.shadowColor = '#FF00BB'; ctx.shadowBlur = 20;
  ctx.fillText('Jornada do Passarim', canvas.width / 2, canvas.height / 2 - 130);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'white'; ctx.font = '28px Arial';
  ctx.fillText('Como você se chama?', canvas.width / 2, canvas.height / 2 - 50);

  // Caixa de texto
  const bx = canvas.width / 2 - 200, by = canvas.height / 2 - 20, bw = 400, bh = 55;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = '#FF00BB'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill(); ctx.stroke();

  nameCursorTimer++;
  if (nameCursorTimer % 30 === 0) nameCursor = !nameCursor;
  const displayText = nameInput + (nameCursor ? '|' : ' ');
  ctx.fillStyle = 'white'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center';
  ctx.fillText(displayText, canvas.width / 2, by + 37);

  // Botão jogar
  const canPlay = nameInput.trim().length > 0;
  const btnX = canvas.width / 2 - 120, btnY = canvas.height / 2 + 60, btnW = 240, btnH = 55;
  ctx.fillStyle = canPlay ? '#4CAF50' : '#555';
  ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 12); ctx.fill();
  ctx.fillStyle = 'white'; ctx.font = 'bold 26px Arial'; ctx.textAlign = 'center';
  ctx.fillText('▶ Jogar', canvas.width / 2, btnY + 36);

  // Dica de teclas
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '16px Arial';
  ctx.fillText('Digite seu nome e pressione Enter ou clique em Jogar', canvas.width / 2, canvas.height / 2 + 150);

  // "by Johnson Gomes"
  ctx.textAlign = 'right'; ctx.font = 'italic 13px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('by Johnson Gomes', canvas.width - 10, canvas.height - 6);

  if (Input.pressed && canPlay) {
    if (pointInRect(Input.x, Input.y, btnX, btnY, btnW, btnH) || Input.x < 0) {
      saveName();
    }
    Input.consume();
  }
}

function saveName() {
  const name = nameInput.trim();
  if (!name) return;
  const d = LocalData.load(); d.name = name; LocalData.save(d);
  Transition.start(() => { currentScene = SCENE.PLAY; });
}

// Captura teclado para o campo de nome
window.addEventListener('keydown', (e) => {
  if (currentScene !== SCENE.NAME) return;
  if (e.key === 'Enter') { if (nameInput.trim()) saveName(); return; }
  if (e.key === 'Backspace') { nameInput = nameInput.slice(0, -1); return; }
  if (e.key.length === 1 && nameInput.length < 20) nameInput += e.key;
});

// ─── CENA: MENU PLAY ──────────────────────────────────────
function getPlayButtons() {
  const bw = 190, bh = 60, cx = canvas.width / 2;
  const playY = canvas.height / 2 + 150;
  return {
    play:  { x: cx - bw - 5,  y: playY,      w: bw, h: bh },
    store: { x: cx + 5,       y: playY,      w: bw, h: bh },
    rank:  { x: cx - bw/2,    y: playY + 75, w: bw, h: 50 },
    sair:  { x: cx - bw/2,    y: playY + 135,w: bw, h: 45 },
  };
}

function drawPlayScene() {
  drawBackground(SCENE.PLAY);
  if (bird) bird.draw();

  ctx.textAlign = 'center'; ctx.fillStyle = '#FF00BB'; ctx.font = 'bold 64px Arial';
  ctx.shadowColor = 'black'; ctx.shadowBlur = 5;
  ctx.fillText('Jornada do Passarim', canvas.width / 2, canvas.height / 2 - 60);
  ctx.shadowBlur = 0;

  // Nome do jogador
  const playerName = LocalData.load().name;
  if (playerName) {
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 24px Arial';
    ctx.fillText(`Olá, ${playerName}! 👋`, canvas.width / 2, canvas.height / 2 + 80);
  }

  // Recorde (apenas km + nome)
  const hs = HighScore.get(), hsName = HighScore.getName();
  if (hs > 0) {
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 20px Arial';
    const recStr = hsName ? `🏆 Recorde: ${hs} km — ${hsName}` : `🏆 Recorde: ${hs} km`;
    ctx.fillText(recStr, canvas.width / 2, canvas.height / 2 + 115);
  }

  // Nome do usuário Supabase (se logado)
  const supaName = currentUser?.user_metadata?.username || currentUser?.email || null;
  if (supaName) {
    ctx.fillStyle = '#00FF88'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText(`🟢 ${supaName}`, canvas.width / 2, canvas.height / 2 + 148);
  }

  const { play, store, rank, sair } = getPlayButtons();

  // Botão Play
  if (images.btnPlay) {
    ctx.drawImage(images.btnPlay, play.x, play.y, play.w, play.h);
  } else {
    ctx.fillStyle = '#4CAF50'; ctx.beginPath(); ctx.roundRect(play.x, play.y, play.w, play.h, 15); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = '26px Arial'; ctx.textAlign = 'center';
    ctx.fillText('▶ Play', play.x + play.w/2, play.y + 38);
  }

  // Botão Loja
  ctx.fillStyle = '#FF9800'; ctx.beginPath(); ctx.roundRect(store.x, store.y, store.w, store.h, 15); ctx.fill();
  ctx.fillStyle = 'white'; ctx.font = '22px Arial'; ctx.textAlign = 'center';
  ctx.fillText('🛒 Loja', store.x + store.w/2, store.y + 38);

  // Botão Ranking
  ctx.fillStyle = '#9B59B6'; ctx.beginPath(); ctx.roundRect(rank.x, rank.y, rank.w, rank.h, 10); ctx.fill();
  ctx.fillStyle = 'white'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
  ctx.fillText('🏆 Ranking', rank.x + rank.w/2, rank.y + 32);

  // Botão Sair
  if (images.btnSair) {
    ctx.drawImage(images.btnSair, sair.x, sair.y, sair.w, sair.h);
  } else {
    ctx.fillStyle = '#f44336'; ctx.beginPath(); ctx.roundRect(sair.x, sair.y, sair.w, sair.h, 10); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
    ctx.fillText('✕ Sair', sair.x + sair.w/2, sair.y + 28);
  }

  // "by Johnson Gomes" — canto inferior direito
  ctx.textAlign = 'right'; ctx.font = 'italic 14px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('by Johnson Gomes', canvas.width - 10, canvas.height - 6);

  if (Input.pressed) {
    if (pointInRect(Input.x, Input.y, play.x,  play.y,  play.w,  play.h) || Input.x < 0) startGame();
    if (pointInRect(Input.x, Input.y, store.x, store.y, store.w, store.h))
      Transition.start(() => { currentScene = SCENE.STORE; });
    if (pointInRect(Input.x, Input.y, rank.x,  rank.y,  rank.w,  rank.h)) {
      Leaderboard.fetch(); // busca ranking ao entrar
      Transition.start(() => { currentScene = SCENE.LEADERBOARD; });
    }
    Input.consume();
  }
}

// ─── PAUSA OVERLAY ────────────────────────────────────────
function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'white'; ctx.font = 'bold 52px Arial';
  ctx.fillText('⏸ PAUSADO', canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '22px Arial';
  ctx.fillText('Pressione P ou toque para continuar', canvas.width / 2, canvas.height / 2 + 30);
  // Toque para despausar
  if (Input.pressed) { togglePause(); Input.consume(); }
}

// ─── CENA: JOGO ───────────────────────────────────────────
function drawGameScene() {
  CameraShake.apply(); // shake da câmera (ctx.save interno)
  drawBackground(SCENE.GAME);
  Parallax.drawBgClouds();      // nuvens de paralaxe (só quando sem imagem)
  obstacles.forEach(o => o.draw());
  heart.draw(); powerup.draw();
  bird.draw();
  Parallax.drawGround();        // chão com paralaxe por cima do bg
  owl.draw();
  ParticleSystem.draw(); floatingTexts.forEach(t => t.draw());
  CameraShake.restore();
  drawHUD();
  if (gamePaused) drawPauseOverlay();
}

// ─── CENA: GAME OVER ──────────────────────────────────────
function getGameOverButtons() {
  const bw = 250, bh = 50, cx = canvas.width / 2;
  return {
    again: { x: cx - bw/2, y: canvas.height/2 + 80,  w: bw, h: bh },
    back:  { x: cx - bw/2, y: canvas.height/2 + 140, w: bw, h: bh },
  };
}

function drawGameOverScene() {
  drawBackground(SCENE.GAMEOVER);
  if (images.gameOverImg) ctx.drawImage(images.gameOverImg, canvas.width/2 - 200, 40, 400, 150);

  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.beginPath(); ctx.roundRect(canvas.width/2 - 300, canvas.height/2 - 170, 600, 340, 20); ctx.fill();

  const playerName = LocalData.load().name;
  ctx.textAlign = 'center'; ctx.fillStyle = '#F13670'; ctx.font = 'bold 50px Arial';
  ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 110);

  ctx.fillStyle = 'white'; ctx.font = '24px Arial';
  ctx.fillText(`${playerName ? playerName + ' — ' : ''}distância percorrida:`, canvas.width/2, canvas.height/2 - 58);
  ctx.font = 'bold 52px Arial'; ctx.fillStyle = '#FFD700';
  ctx.fillText(gv.distanciap + ' km', canvas.width/2, canvas.height/2);

  const hs    = HighScore.get();
  const isNew = gv.distanciap > 0 && gv.distanciap >= hs;
  ctx.font = '22px Arial'; ctx.fillStyle = isNew ? '#00FF88' : '#AAAAAA';
  ctx.fillText(isNew ? '🏆 NOVO RECORDE!' : `Recorde: ${hs} km`, canvas.width/2, canvas.height/2 + 44);

  ctx.fillStyle = '#CCCCCC'; ctx.font = '18px Arial';
  ctx.fillText(`Score: ${gv.totalScore}  |  Nível: ${Difficulty.level}`, canvas.width/2, canvas.height/2 + 74);

  const { again, back } = getGameOverButtons();
  if (images.btnPlayAgain) {
    ctx.drawImage(images.btnPlayAgain, again.x, again.y, again.w, again.h);
  } else {
    ctx.fillStyle = '#4CAF50'; ctx.beginPath(); ctx.roundRect(again.x, again.y, again.w, again.h, 10); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = '24px Arial'; ctx.fillText('▶ Jogar Novamente', canvas.width/2, again.y + 32);
  }
  if (images.btnBack) {
    ctx.drawImage(images.btnBack, back.x, back.y, back.w, back.h);
  } else {
    ctx.fillStyle = '#2196F3'; ctx.beginPath(); ctx.roundRect(back.x, back.y, back.w, back.h, 10); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = '24px Arial'; ctx.fillText('← Menu', canvas.width/2, back.y + 32);
  }

  // "by Johnson Gomes"
  ctx.textAlign = 'right'; ctx.font = 'italic 13px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('by Johnson Gomes', canvas.width - 10, canvas.height - 6);

  if (Input.pressed) {
    if (pointInRect(Input.x, Input.y, again.x, again.y, again.w, again.h) || Input.x < 0) startGame();
    else if (pointInRect(Input.x, Input.y, back.x, back.y, back.w, back.h)) backToMenu();
    Input.consume();
  }
}

// ─── CENA: LOJA ───────────────────────────────────────────
/*
  Loja preparada com estrutura completa de navegação por abas.
  Para renderizar as imagens reais dos itens, basta preencher
  os campos imgKey em STORE_CATALOG com os caminhos das imagens.
*/
let storeTab = 'skins'; // 'skins' | 'powerups' | 'cosmetics'

function drawStoreScene() {
  // Fundo
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#0f0c29'); g.addColorStop(1, '#302b63');
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Título
  ctx.textAlign = 'center'; ctx.fillStyle = '#FF9800'; ctx.font = 'bold 44px Arial';
  ctx.shadowColor = '#FF9800'; ctx.shadowBlur = 15;
  ctx.fillText('🛒 Loja do Passarim', canvas.width/2, 60);
  ctx.shadowBlur = 0;

  // Moedas
  ctx.fillStyle = '#FFD700'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'right';
  ctx.fillText(`🪙 ${storeState.coins} moedas`, canvas.width - 30, 55);

  // Abas
  const tabs = [
    { id: 'skins',     label: '🐦 Skins'    },
    { id: 'powerups',  label: '⚡ Power-ups' },
    { id: 'cosmetics', label: '🎨 Cosméticos'},
  ];
  tabs.forEach((tab, i) => {
    const tx = 80 + i * 230, ty = 80, tw = 210, th = 45;
    ctx.fillStyle = storeTab === tab.id ? '#FF9800' : 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 8); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText(tab.label, tx + tw/2, ty + 30);
    if (Input.pressed && pointInRect(Input.x, Input.y, tx, ty, tw, th)) {
      storeTab = tab.id;
    }
  });

  // Itens da aba atual
  const itemList =
    storeTab === 'skins'     ? STORE_CATALOG.skins :
    storeTab === 'powerups'  ? STORE_CATALOG.powerupUpgrades :
                               STORE_CATALOG.cosmetics;

  itemList.forEach((item, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const ix = 50 + col * 230, iy = 155 + row * 165;
    const iw = 210, ih = 150;
    const owned = storeState.unlocked.includes(item.id);

    ctx.fillStyle = owned ? 'rgba(0,200,100,0.15)' : 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = owned ? '#00C864' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 10); ctx.fill(); ctx.stroke();

    // Preview do item
    const previewImg = item.imgKey ? images[item.imgKey] : null;
    if (previewImg) {
      ctx.drawImage(previewImg, ix + 10, iy + 10, 50, 50);
    } else {
      ctx.fillStyle = item.tint || item.color || '#888';
      ctx.beginPath(); ctx.arc(ix + 35, iy + 35, 22, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = 'white'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'left';
    ctx.fillText(item.name, ix + 70, iy + 28);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '12px Arial';
    // Quebra o texto da descrição se for muito longo
    const words = item.desc.split(' '); let line = '', ly = iy + 48;
    for (const w of words) {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > 130 && line) { ctx.fillText(line, ix + 70, ly); line = w + ' '; ly += 16; }
      else line = test;
    }
    if (line) ctx.fillText(line.trim(), ix + 70, ly);

    // Botão comprar / equipar
    const btnX = ix + 10, btnY = iy + ih - 40, btnW = iw - 20, btnH = 32;
    if (owned) {
      const isActive = storeState.activeSkin === item.id || storeState.activeCosmetic === item.id;
      ctx.fillStyle = isActive ? '#00C864' : '#555';
      ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 6); ctx.fill();
      ctx.fillStyle = 'white'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
      ctx.fillText(isActive ? '✓ Equipado' : 'Equipar', btnX + btnW/2, btnY + 21);
      if (Input.pressed && pointInRect(Input.x, Input.y, btnX, btnY, btnW, btnH)) {
        if (item.id.startsWith('skin_'))  storeState.activeSkin      = item.id;
        else                              storeState.activeCosmetic   = item.id;
        PlayerStore.save(storeState);
      }
    } else {
      ctx.fillStyle = storeState.coins >= item.price ? '#FF9800' : '#444';
      ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 6); ctx.fill();
      ctx.fillStyle = 'white'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
      ctx.fillText(`🪙 ${item.price}`, btnX + btnW/2, btnY + 21);
      if (Input.pressed && pointInRect(Input.x, Input.y, btnX, btnY, btnW, btnH)) {
        const result = PlayerStore.purchase(item.id, storeState);
        if (!result.ok) spawnFloat(canvas.width/2, canvas.height/2, result.reason, '#FF4444');
      }
    }
  });

  // Botão voltar
  const bx = canvas.width/2 - 100, by = canvas.height - 65, bw = 200, bh = 45;
  ctx.fillStyle = '#2196F3'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill();
  ctx.fillStyle = 'white'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
  ctx.fillText('← Voltar', canvas.width/2, by + 30);
  if (Input.pressed && pointInRect(Input.x, Input.y, bx, by, bw, bh)) {
    Transition.start(() => { currentScene = SCENE.PLAY; });
    Input.consume();
  }

  // "by Johnson Gomes"
  ctx.textAlign = 'right'; ctx.font = 'italic 13px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('by Johnson Gomes', canvas.width - 10, canvas.height - 6);

  // Consome o input após processar todos os botões da cena
  if (Input.pressed) Input.consume();
}

// ─── CENA: LEADERBOARD ────────────────────────────────────
function drawLeaderboardScene() {
  // Fundo
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#0f0c29'); g.addColorStop(1, '#302b63');
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Título
  ctx.textAlign = 'center'; ctx.fillStyle = '#FFD700'; ctx.font = 'bold 44px Arial';
  ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 15;
  ctx.fillText('🏆 Ranking Global', canvas.width / 2, 60);
  ctx.shadowBlur = 0;

  // Usuário logado
  const supaName = currentUser?.user_metadata?.username || currentUser?.email || null;
  ctx.fillStyle = supaName ? '#00FF88' : 'rgba(255,255,255,0.4)';
  ctx.font = '16px Arial';
  ctx.fillText(supaName ? `Logado como: ${supaName}` : 'Não logado — mostrando ranking geral', canvas.width / 2, 88);

  if (Leaderboard.loading) {
    ctx.fillStyle = 'white'; ctx.font = '24px Arial';
    ctx.fillText('Carregando...', canvas.width / 2, canvas.height / 2);
  } else if (!Leaderboard.loaded || Leaderboard.entries.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '20px Arial';
    ctx.fillText('Nenhum score encontrado ainda.', canvas.width / 2, canvas.height / 2);
    ctx.font = '15px Arial';
    ctx.fillText('Jogue e apareça aqui! 🐦', canvas.width / 2, canvas.height / 2 + 35);
  } else {
    // Cabeçalho da tabela
    const cols = { pos: 80, name: 200, km: 500, score: 650 };
    const rowH = 46, startY = 125;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(40, startY - 30, canvas.width - 80, 34);
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'left';
    ctx.fillText('#',       cols.pos,   startY - 8);
    ctx.fillText('Jogador', cols.name,  startY - 8);
    ctx.textAlign = 'right';
    ctx.fillText('km',      cols.km,    startY - 8);
    ctx.fillText('Score',   cols.score, startY - 8);

    Leaderboard.entries.forEach((entry, i) => {
      const y = startY + i * rowH + rowH;
      const isMe = currentUser && entry.player === (currentUser.user_metadata?.username || currentUser.email);
      const isTop3 = i < 3;

      // Linha de fundo
      ctx.fillStyle = isMe
        ? 'rgba(0,255,136,0.12)'
        : (i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent');
      ctx.fillRect(40, y - 28, canvas.width - 80, rowH - 4);

      // Medalhas top 3
      const medal = ['🥇','🥈','🥉'][i] || `${i + 1}.`;
      ctx.textAlign = 'left';
      ctx.font = isTop3 ? 'bold 20px Arial' : '18px Arial';
      ctx.fillStyle = isMe ? '#00FF88' : (isTop3 ? '#FFD700' : 'white');
      ctx.fillText(medal,                cols.pos,  y);
      ctx.font = isMe ? 'bold 17px Arial' : '16px Arial';
      ctx.fillStyle = isMe ? '#00FF88' : 'white';
      ctx.fillText(entry.player || '?',  cols.name, y);
      ctx.textAlign = 'right';
      ctx.fillText(`${entry.km} km`,     cols.km,   y);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '14px Arial';
      ctx.fillText(entry.score ?? '--',  cols.score, y);
    });

    // Meu melhor score (se logado e não aparece no top 10)
    if (Leaderboard.myBest) {
      const inTop = Leaderboard.entries.some(e =>
        currentUser && e.player === (currentUser.user_metadata?.username || currentUser.email));
      if (!inTop) {
        const by = startY + Leaderboard.entries.length * rowH + rowH + 10;
        ctx.fillStyle = 'rgba(0,255,136,0.15)';
        ctx.fillRect(40, by - 28, canvas.width - 80, 40);
        ctx.textAlign = 'left'; ctx.fillStyle = '#00FF88'; ctx.font = 'bold 16px Arial';
        ctx.fillText('▶ Você', cols.name, by);
        ctx.textAlign = 'right';
        ctx.fillText(`${Leaderboard.myBest.km} km`, cols.km, by);
      }
    }
  }

  // Botão atualizar
  const rbx = canvas.width / 2 - 210, rby = canvas.height - 70, rbw = 180, rbh = 42;
  ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.roundRect(rbx, rby, rbw, rbh, 10); ctx.fill();
  ctx.fillStyle = 'white'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
  ctx.fillText('🔄 Atualizar', rbx + rbw / 2, rby + 28);

  // Botão voltar
  const vbx = canvas.width / 2 + 30, vby = canvas.height - 70, vbw = 180, vbh = 42;
  ctx.fillStyle = '#2196F3'; ctx.beginPath(); ctx.roundRect(vbx, vby, vbw, vbh, 10); ctx.fill();
  ctx.fillStyle = 'white'; ctx.font = 'bold 18px Arial';
  ctx.fillText('← Voltar', vbx + vbw / 2, vby + 28);

  ctx.textAlign = 'right'; ctx.font = 'italic 13px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('by Johnson Gomes', canvas.width - 10, canvas.height - 6);

  if (Input.pressed) {
    if (pointInRect(Input.x, Input.y, rbx, rby, rbw, rbh)) Leaderboard.fetch();
    if (pointInRect(Input.x, Input.y, vbx, vby, vbw, vbh))
      Transition.start(() => { currentScene = SCENE.PLAY; });
    Input.consume();
  }
}

// ─── LOOP ─────────────────────────────────────────────────
function loop() {
  frameCount++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if      (currentScene === SCENE.NAME)     drawNameScene();
  else if (currentScene === SCENE.PLAY)     drawPlayScene();
  else if (currentScene === SCENE.GAME)     { updateGameplay(); drawGameScene(); }
  else if (currentScene === SCENE.GAMEOVER) drawGameOverScene();
  else if (currentScene === SCENE.STORE)       drawStoreScene();
  else if (currentScene === SCENE.LEADERBOARD)  drawLeaderboardScene();

  Transition.update(); Transition.draw();
  requestAnimationFrame(loop);
}

// ─── BOOT ─────────────────────────────────────────────────
(async () => {
  // 1. Carrega usuário Supabase (sessão ativa do auth.js)
  await SupabaseService.loadUser();

  // 2. Carrega assets do jogo em paralelo
  await loadAssets();
  loadSounds();

  // 3. Estado da loja
  storeState = PlayerStore.load();

  // 4. Sincroniza nome: prefere username Supabase, fallback LocalData
  const supaName = currentUser?.user_metadata?.username || currentUser?.email || '';
  const saved    = LocalData.load();
  const name     = supaName || saved.name || '';
  if (name) {
    nameInput = name;
    if (!saved.name) { saved.name = name; LocalData.save(saved); }
    currentScene = SCENE.PLAY; // pula tela de nome se já tem
  }

  bird = new Bird();
  requestAnimationFrame(loop);
})();
