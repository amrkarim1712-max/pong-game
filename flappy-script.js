// ============================================================================
// FLAPPY BIRD - ENHANCED EDITION
// Features: Difficulty Presets, Power-ups, Leaderboard, Pause System
// ============================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width = window.innerWidth;
const H = canvas.height = window.innerHeight;

let best = 0, state = 'idle', difficulty_preset = 'normal', paused = false;
let score, bird, pipes, frame, particles, monster, shake, trail, powerups, activePowerups;

const PIPE_W = 52, GRAVITY_BASE = 0.55, FLAP = -8.8, GROUND_H = 60;

// ── Difficulty Presets ────────────────────────────────────────────────────
const DIFFICULTY_LEVELS = {
  easy: {
    speedBase: 1.8, speedScale: 0.08, gapBase: H * 0.35, gapScale: -2,
    intervalBase: 120, intervalScale: -1.5, gravityBase: 0.4, gravityScale: 0.005,
    monsterSpeedBase: 0.1, monsterSpeedScale: 0.02, label: 'EASY'
  },
  normal: {
    speedBase: 2.8, speedScale: 0.18, gapBase: H * 0.26, gapScale: -5.5,
    intervalBase: 85, intervalScale: -2.5, gravityBase: 0.55, gravityScale: 0.012,
    monsterSpeedBase: 0.4, monsterSpeedScale: 0.1, label: 'NORMAL'
  },
  hard: {
    speedBase: 3.5, speedScale: 0.25, gapBase: H * 0.20, gapScale: -7,
    intervalBase: 65, intervalScale: -3, gravityBase: 0.65, gravityScale: 0.016,
    monsterSpeedBase: 0.8, monsterSpeedScale: 0.15, label: 'HARD'
  },
  insane: {
    speedBase: 4.2, speedScale: 0.35, gapBase: H * 0.15, gapScale: -9,
    intervalBase: 45, intervalScale: -4, gravityBase: 0.75, gravityScale: 0.022,
    monsterSpeedBase: 1.2, monsterSpeedScale: 0.25, label: 'INSANE'
  }
};

// ── Power-ups System ──────────────────────────────────────────────────────
const POWERUP_TYPES = {
  shield: {
    color: '#0099ff',
    duration: 8000,
    spawn_chance: 0.15,
    emoji: '🛡',
    name: 'SHIELD',
    desc: 'One hit protection'
  },
  slowmo: {
    color: '#ffaa00',
    duration: 6000,
    spawn_chance: 0.12,
    emoji: '⏱',
    name: 'SLOWMO',
    desc: '50% speed reduction'
  },
  magnet: {
    color: '#ff00ff',
    duration: 7000,
    spawn_chance: 0.1,
    emoji: '🧲',
    name: 'MAGNET',
    desc: 'Auto-collect scores'
  }
};

// ── Leaderboard ───────────────────────────────────────────────────────────
function initLeaderboard() {
  const saved = localStorage.getItem('flappy_leaderboard');
  if (!saved) localStorage.setItem('flappy_leaderboard', JSON.stringify([]));
}

function addScore(score, difficulty) {
  let lb = JSON.parse(localStorage.getItem('flappy_leaderboard') || '[]');
  lb.push({ score, difficulty, timestamp: Date.now() });
  lb.sort((a, b) => b.score - a.score);
  lb = lb.slice(0, 50); // Keep top 50
  localStorage.setItem('flappy_leaderboard', JSON.stringify(lb));
  return lb;
}

function getTopScores(limit = 5) {
  const lb = JSON.parse(localStorage.getItem('flappy_leaderboard') || '[]');
  return lb.slice(0, limit);
}

function updateLeaderboardDisplay() {
  const topScores = getTopScores(5);
  const entries = document.querySelectorAll('.lb-entry');
  entries.forEach((entry, idx) => {
    const scoreSpan = entry.querySelector('.lb-score');
    if (topScores[idx]) {
      scoreSpan.textContent = topScores[idx].score;
      scoreSpan.style.color = idx === 0 ? '#ffd700' : '#f7c948';
    } else {
      scoreSpan.textContent = '--';
    }
  });
}

// ── Audio System ──────────────────────────────────────────────────────────
const Audio = (() => {
  let ac, muted = false, initialized = false, melTimer, bassTimer;

  function init() {
    if (initialized) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    initialized = true;
  }

  function tone(freq, type, vol, dur, delay = 0) {
    if (muted || !ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type; o.frequency.value = freq;
    const t = ac.currentTime + delay;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur);
  }

  function sfxFlap() { tone(523,'square',0.18,0.08); tone(659,'square',0.12,0.07,0.06); }
  function sfxScore() { tone(784,'square',0.2,0.08); tone(1047,'square',0.2,0.12,0.09); tone(1319,'square',0.15,0.1,0.18); }
  function sfxPowerup() { tone(880,'sine',0.25,0.1); tone(1100,'sine',0.2,0.15,0.08); }
  function sfxDie() { tone(392,'square',0.3,0.1); tone(330,'square',0.3,0.1,0.12); tone(261,'square',0.3,0.25,0.25); tone(196,'square',0.25,0.3,0.45); }

  const melody = [
    [659,150],[0,75],[523,150],[0,75],[587,150],[0,75],[494,150],[0,75],
    [523,150],[0,75],[392,300],[0,150],[659,150],[0,75],[698,150],[0,75],
    [784,300],[0,150],[698,150],[0,75],[659,150],[0,75],[523,150],[0,75],
    [587,150],[0,75],[494,450],[0,225],[523,150],[0,75],[587,150],[0,75],
  ];
  const bass = [
    [130,300],[0,75],[164,300],[0,75],[146,300],[0,75],[123,300],[0,75],
    [130,300],[0,75],[98,600],[0,225],[164,300],[0,75],[174,300],[0,75],
    [196,600],[0,225],[174,300],[0,75],[164,300],[0,75],[130,300],[0,75],
    [146,300],[0,75],[123,900],[0,375],[130,300],[0,75],[146,300],[0,75],
  ];

  function sched(arr, idx, setter, vol, wave) {
    const [freq, dur] = arr[idx];
    if (freq > 0) tone(freq, wave, 0.12 * vol, dur / 1000 * 0.88);
    return setTimeout(() => setter(sched(arr, (idx+1) % arr.length, setter, vol, wave)), dur);
  }

  function startMusic() {
    if (!ac || muted) return;
    clearTimeout(melTimer); clearTimeout(bassTimer);
    melTimer = sched(melody, 0, t => melTimer = t, 1, 'square');
    bassTimer = sched(bass, 0, t => bassTimer = t, 0.7, 'triangle');
  }

  function stopMusic() { clearTimeout(melTimer); clearTimeout(bassTimer); }

  function toggle() {
    muted = !muted;
    muted ? stopMusic() : startMusic();
    return muted;
  }

  return { init, sfxFlap, sfxScore, sfxPowerup, sfxDie, startMusic, stopMusic, toggle };
})();

// ── Difficulty Calculator ─────────────────────────────────────────────────
function difficulty() {
  const d = DIFFICULTY_LEVELS[difficulty_preset];
  const s = score || 0;
  const speedMult = activePowerups.slowmo ? 0.5 : 1;
  
  return {
    speed: Math.min((d.speedBase + s * d.speedScale) * speedMult, 10),
    gap: Math.max(d.gapBase + s * d.gapScale, H * 0.1),
    interval: Math.max(d.intervalBase + s * d.intervalScale, 35),
    gravity: Math.min(d.gravityBase + s * d.gravityScale, 1),
    monsterSpeed: Math.min(d.monsterSpeedBase + s * d.monsterSpeedScale, 5),
  };
}

// ── Game Initialization ───────────────────────────────────────────────────
function initGame() {
  score = 0; frame = 0; shake = 0; paused = false;
  bird = { x: W * 0.25, y: H * 0.45, vy: 0, flapAnim: 0 };
  monster = { x: -90, y: H * 0.45, vy: 0, mouth: 0 };
  pipes = []; particles = []; trail = []; powerups = [];
  activePowerups = { shield: false, slowmo: false, magnet: false };
  document.getElementById('score-display').textContent = '0';
  document.getElementById('active-powerups').classList.add('hidden');
  updatePowerupsDisplay();
}

// ── Power-ups System ─────────────────────────────────────────────────────
function activatePowerup(type) {
  activePowerups[type] = true;
  Audio.sfxPowerup();
  
  const indicator = document.getElementById(`${type}-indicator`);
  if (indicator) {
    indicator.style.animation = 'none';
    setTimeout(() => indicator.style.animation = '', 10);
  }
  
  document.getElementById('active-powerups').classList.remove('hidden');
  updatePowerupsDisplay();

  setTimeout(() => {
    activePowerups[type] = false;
    updatePowerupsDisplay();
    if (!Object.values(activePowerups).some(v => v)) {
      document.getElementById('active-powerups').classList.add('hidden');
    }
  }, POWERUP_TYPES[type].duration);
}

function spawnPowerup(x, y) {
  const types = Object.keys(POWERUP_TYPES);
  const type = types[Math.floor(Math.random() * types.length)];
  if (Math.random() < POWERUP_TYPES[type].spawn_chance) {
    powerups.push({
      x, y, type,
      size: 15,
      rotation: 0,
      wobble: Math.random() * Math.PI * 2
    });
  }
}

function updatePowerupsDisplay() {
  const display = document.getElementById('power-ups-display');
  display.innerHTML = '';
  Object.entries(activePowerups).forEach(([type, active]) => {
    if (active) {
      const powerup = POWERUP_TYPES[type];
      const badge = document.createElement('div');
      badge.className = 'powerup-badge';
      badge.innerHTML = `<span>${powerup.emoji}</span><span>${powerup.name}</span>`;
      display.appendChild(badge);
    }
  });
}

// ── Monster Logic ─────────────────────────────────────────────────────────
function updateMonster() {
  const d = difficulty();
  monster.vy += (bird.y - monster.y) * 0.04;
  monster.vy *= 0.88;
  monster.y += monster.vy;
  monster.x += d.monsterSpeed;
  monster.x = Math.min(monster.x, bird.x - 85);
  monster.mouth = Math.sin(frame * 0.14) * 0.5 + 0.5;
  
  if ((bird.x - monster.x) < 20 && Math.abs(bird.y - monster.y) < 38) {
    if (activePowerups.shield) {
      activePowerups.shield = false;
      updatePowerupsDisplay();
      spawnParticles(bird.x, bird.y, '#0099ff', 15);
    } else {
      die();
    }
  }
}

function drawMonster() {
  const mx = Math.floor(monster.x - 60);
  const my = Math.floor(monster.y - 35);
  const mw = 64, mh = 60;
  const mouthPx = Math.floor(monster.mouth * 18 + 4);

  ctx.save();
  ctx.shadowBlur = 25;
  ctx.shadowColor = 'rgba(220,20,20,0.9)';

  ctx.fillStyle = '#1a0015';
  ctx.fillRect(mx - 22, my + 12, 22, 28);
  ctx.fillRect(mx + mw, my + 12, 22, 28);

  ctx.fillStyle = '#7a0000';
  ctx.fillRect(mx + 10, my - 22, 10, 24);
  ctx.fillRect(mx + mw - 20, my - 22, 10, 24);

  ctx.fillStyle = '#160a16';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#22102a';
  ctx.fillRect(mx + 4, my + 4, mw - 8, mh - 8);

  const ep = 0.65 + Math.sin(frame * 0.18) * 0.35;
  ctx.shadowBlur = 18;
  ctx.shadowColor = '#ff2200';
  ctx.fillStyle = `rgba(255,50,0,${ep.toFixed(2)})`;
  ctx.fillRect(mx + 8, my + 10, 18, 16);
  ctx.fillRect(mx + mw - 26, my + 10, 18, 16);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#080000';
  ctx.fillRect(mx + 10, my + 36, mw - 20, mouthPx + 4);

  ctx.restore();
}

// ── Background ─────────────────────────────────────────────────────────────
function drawBackground() {
  const danger = Math.min(score / 15, 1);
  const monsterDist = Math.max(0, 1 - Math.max(0, bird.x - (monster.x + 60)) / 220);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  const r = Math.floor(5 + danger * 65 + monsterDist * 30);
  const g = Math.max(0, Math.floor(5 - danger * 5));
  const b = Math.max(0, Math.floor(16 - danger * 15));
  grad.addColorStop(0, `rgb(${r},${g},${b})`);
  grad.addColorStop(0.55, `rgb(${Math.min(255,r*2)},${g},${Math.min(30,b*2)})`);
  grad.addColorStop(1, '#0d1520');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const spd = difficulty().speed;
  const m1 = (frame * 0.4) % (W * 1.5);
  ctx.fillStyle = `rgba(${10+Math.floor(danger*28)},4,${18+Math.floor(danger*8)},0.8)`;
  for (let i = 0; i < 5; i++) {
    const mx = ((i * W * 0.4) - m1 + W * 2) % (W * 1.5) - W * 0.2;
    const mh = 70 + (i % 3) * 50;
    ctx.beginPath();
    ctx.moveTo(mx - 80, H - GROUND_H);
    ctx.lineTo(mx, H - GROUND_H - mh);
    ctx.lineTo(mx + 80, H - GROUND_H);
    ctx.fill();
  }

  const m2 = (frame * spd * 0.25) % (W * 1.2);
  ctx.fillStyle = `rgba(${8+Math.floor(danger*20)},3,10,0.95)`;
  for (let i = 0; i < 6; i++) {
    const mx = ((i * W * 0.28) - m2 + W * 2) % (W * 1.2) - W * 0.1;
    const mh = 35 + (i % 4) * 22;
    ctx.beginPath();
    ctx.moveTo(mx - 45, H - GROUND_H);
    ctx.lineTo(mx, H - GROUND_H - mh);
    ctx.lineTo(mx + 45, H - GROUND_H);
    ctx.fill();
  }

  for (let i = 0; i < 60; i++) {
    const sx = (i * 137.5 + frame * 0.1) % W;
    const sy = (i * 97.3) % (H * 0.65);
    const alpha = (0.3 + Math.sin(frame * 0.05 + i) * 0.35).toFixed(2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
  }

  ctx.fillStyle = `rgb(${Math.floor(20+danger*30)},${Math.floor(38-danger*25)},${Math.floor(20-danger*15)})`;
  ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
}

// ── Pipes ──────────────────────────────────────────────────────────────────
function drawPipe(p) {
  const { x, topH, gap } = p;
  const capH = 18, capW = PIPE_W + 10;

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = '#00ff55';

  ctx.fillStyle = '#2d7a2d';
  ctx.fillRect(x, 0, PIPE_W, topH - capH);
  ctx.fillRect(x, topH + gap + capH, PIPE_W, H - GROUND_H - topH - gap - capH);
  ctx.fillStyle = '#3aaa3a';
  ctx.fillRect(x - 5, topH - capH, capW, capH);
  ctx.fillRect(x - 5, topH + gap, capW, capH);

  ctx.restore();
}

// ── Power-ups Rendering ────────────────────────────────────────────────────
function drawPowerups() {
  powerups.forEach((p, idx) => {
    p.rotation += 0.08;
    p.wobble += 0.05;
    p.y += Math.sin(p.wobble) * 0.5;

    ctx.save();
    ctx.translate(Math.floor(p.x), Math.floor(p.y));
    ctx.rotate(p.rotation);
    
    const pu = POWERUP_TYPES[p.type];
    ctx.shadowBlur = 15;
    ctx.shadowColor = pu.color;
    ctx.fillStyle = pu.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.emoji, 0, 0);
    
    ctx.restore();
  });
}

function checkPowerupCollision() {
  const br = 11;
  powerups = powerups.filter(p => {
    if (Math.abs(bird.x - p.x) < br + 15 && Math.abs(bird.y - p.y) < br + 15) {
      activatePowerup(p.type);
      spawnParticles(p.x, p.y, POWERUP_TYPES[p.type].color, 12);
      return false;
    }
    return p.x > -30;
  });
}

// ── Bird ───────────────────────────────────────────────────────────────────
function drawBird() {
  const bx = Math.floor(bird.x), by = Math.floor(bird.y);
  const wing = bird.flapAnim > 0 ? -6 : 4;

  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(Math.min(Math.max(bird.vy * 0.06, -0.5), 1.2));
  ctx.shadowBlur = 14;
  ctx.shadowColor = 'rgba(247,201,72,0.85)';

  ctx.fillStyle = '#f7c948';
  ctx.fillRect(-12, -10, 24, 20);
  ctx.fillStyle = '#e8a830';
  ctx.fillRect(-14, wing, 10, 10);

  if (activePowerups.shield) {
    ctx.strokeStyle = '#0099ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Particles ──────────────────────────────────────────────────────────────
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({ x, y,
      vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6,
      life: 1, color, size: 3 + Math.random()*4 });
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    const s = Math.max(1, Math.floor(p.size * p.life));
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), s, s);
  });
  ctx.globalAlpha = 1;
}

// ── Collision Detection ────────────────────────────────────────────────────
function checkCollision(gap) {
  const br = 11;
  if (bird.y + br > H - GROUND_H || bird.y - br < 0) return true;
  for (const p of pipes) {
    const inX = bird.x + br > p.x - 5 && bird.x - br < p.x + PIPE_W + 5;
    if (inX && (bird.y - br < p.topH || bird.y + br > p.topH + p.gap)) return true;
  }
  return false;
}

function die() {
  if (state === 'dead') return;
  state = 'dead'; shake = 20;
  Audio.sfxDie(); Audio.stopMusic();
  spawnParticles(bird.x, bird.y, '#f7c948', 20);
  spawnParticles(bird.x, bird.y, '#ff0000', 10);
  
  if (score > best) best = score;
  addScore(score, difficulty_preset);
  updateLeaderboardDisplay();
  
  setTimeout(() => {
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('go-score').textContent = score;
    document.getElementById('go-best').textContent = best;
    document.getElementById('screen-gameover').classList.remove('hidden');
  }, 800);
}

// ── Pipe Spawning ──────────────────────────────────────────────────────────
function spawnPipe() {
  const gap = difficulty().gap;
  const minTop = H * 0.12, maxTop = H - GROUND_H - gap - H * 0.12;
  const topH = minTop + Math.random() * (maxTop - minTop);
  pipes.push({
    x: W, topH, baseTopH: topH, gap, scored: false,
    phase: Math.random() * Math.PI * 2,
    amp: score > 5 ? Math.min((score - 5) * 3, 55) : 0,
  });
}

// ── Game Update ────────────────────────────────────────────────────────────
function update() {
  if (paused) return;

  frame++;
  const d = difficulty();
  const grav = d.gravity + Math.sin(frame * 0.04) * 0.07;
  if (shake > 0) shake *= 0.78;

  if (state === 'playing') {
    bird.vy = Math.min(bird.vy + grav, 14);
    bird.y += bird.vy;
    if (bird.flapAnim > 0) bird.flapAnim--;
    
    if (frame % Math.floor(d.interval) === 0) spawnPipe();
    pipes.forEach(p => {
      p.x -= d.speed;
      if (p.amp > 0) p.topH = p.baseTopH + Math.sin(frame * 0.035 + p.phase) * p.amp;
    });
    pipes = pipes.filter(p => p.x > -PIPE_W - 20);
    
    pipes.forEach(p => {
      if (!p.scored && p.x + PIPE_W < bird.x) {
        p.scored = true;
        if (activePowerups.magnet || Math.random() < 0.3) spawnPowerup(bird.x, bird.y);
        score++;
        document.getElementById('score-display').textContent = score;
        Audio.sfxScore();
      }
    });

    updateMonster();
    checkPowerupCollision();
    if (checkCollision()) die();
  }

  if (state === 'idle') {
    bird.y = H * 0.45 + Math.sin(frame * 0.05) * 12;
    monster.y = H * 0.45 + Math.sin(frame * 0.05) * 12;
  }

  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.05; });
  particles = particles.filter(p => p.life > 0);
}

// ── Main Loop ──────────────────────────────────────────────────────────────
function loop() {
  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random()-.5)*shake, (Math.random()-.5)*shake);
  
  drawBackground();
  pipes.forEach(drawPipe);
  drawMonster();
  drawPowerups();
  drawParticles();
  drawBird();
  
  ctx.restore();
  update();
  requestAnimationFrame(loop);
}

// ── Event Handlers ─────────────────────────────────────────────────────────
function flap() {
  Audio.init();
  if (state === 'idle') {
    state = 'playing';
    document.getElementById('screen-start').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    initGame();
    Audio.startMusic();
  }
  if (state === 'playing' && !paused) {
    bird.vy = FLAP;
    bird.flapAnim = 8;
    spawnParticles(bird.x, bird.y, '#a0e0ff', 4);
    Audio.sfxFlap();
  }
}

function togglePause() {
  if (state !== 'playing') return;
  paused = !paused;
  if (paused) {
    Audio.stopMusic();
    document.getElementById('screen-pause').classList.remove('hidden');
    document.getElementById('pause-score').textContent = score;
  } else {
    Audio.startMusic();
    document.getElementById('screen-pause').classList.add('hidden');
  }
}

// Difficulty Selection
document.querySelectorAll('.difficulty-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    difficulty_preset = e.currentTarget.dataset.difficulty;
  });
});

document.getElementById('btn-start').addEventListener('click', (e) => {
  e.stopPropagation();
  flap();
});

document.getElementById('btn-restart').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('screen-gameover').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  initGame();
  state = 'playing';
  Audio.startMusic();
});

document.getElementById('btn-home').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('screen-gameover').classList.add('hidden');
  document.getElementById('screen-start').classList.remove('hidden');
  state = 'idle';
  Audio.stopMusic();
});

document.getElementById('btn-mute').addEventListener('click', (e) => {
  e.stopPropagation();
  const m = Audio.toggle();
  e.target.classList.toggle('muted', m);
  e.target.textContent = m ? '✕' : '♪';
});

document.getElementById('btn-pause').addEventListener('click', (e) => {
  e.stopPropagation();
  togglePause();
});

document.getElementById('btn-resume').addEventListener('click', (e) => {
  e.stopPropagation();
  togglePause();
});

document.getElementById('btn-quit').addEventListener('click', (e) => {
  e.stopPropagation();
  paused = false;
  document.getElementById('screen-pause').classList.add('hidden');
  document.getElementById('screen-start').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  state = 'idle';
  Audio.stopMusic();
});

// Input
document.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); flap(); }
  if (e.code === 'Escape') togglePause();
});
document.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, { passive: false });
document.addEventListener('mousedown', () => flap());

// Initialization
initLeaderboard();
updateLeaderboardDisplay();
initGame();
loop();
