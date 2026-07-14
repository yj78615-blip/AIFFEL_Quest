// ============================================================================
// test1 — 뱀파이어 서바이벌 (10분 생존)
// ============================================================================

const STORAGE_KEY = 'test1-vampire-best-v1';
const BEST_LOCAL = { time: 0, kills: 0 };

const ARENA_W = 720;
const ARENA_H = 540;

// 플레이어 스프라이트
const playerSprite = new Image();
let playerSpriteReady = false;
playerSprite.onload = () => { playerSpriteReady = true; };
playerSprite.onerror = () => { playerSpriteReady = false; };
playerSprite.src = 'player.jpg';

const PLAYER_SPRITE_W = 60;
const PLAYER_SPRITE_H = 60;

const GAME_TIME_LIMIT = 10 * 60; // 초
const BOSS_TIME = 5 * 60;

// 플레이어
const PLAYER_BASE = {
  hp: 100,
  maxHp: 100,
  speed: 200,   // px/sec
  radius: 12,
  hitCooldown: 0.5, // 몹에게 연속 피격되지 않도록 (초)
  regen: 0,     // hp/초
  pickupRadius: 45,
};

// 몹 종류
const MOB_TYPES = {
  zombie:   { name:'좀비',   hp:20,  speed:60,  dmg:5,  xp:1,  color:'#8fce7c', radius:11 },
  bat:      { name:'박쥐',   hp:15,  speed:110, dmg:8,  xp:1,  color:'#a67bff', radius:9  },
  skeleton: { name:'스켈레톤', hp:40, speed:75,  dmg:10, xp:3,  color:'#e0e0e0', radius:12 },
  ghost:    { name:'유령',   hp:65,  speed:90,  dmg:15, xp:5,  color:'#7bcdff', radius:13 },
  boss:     { name:'보스',   hp:900, speed:65,  dmg:25, xp:80, color:'#ff3d5d', radius:28 },
};

// 무기 정의
const WEAPONS = {
  orb: {
    name: '마법 구슬',
    desc: '가장 가까운 적을 향해 자동 발사',
    maxLevel: 5,
    apply: (lvl) => ({
      cooldown: Math.max(0.35, 1.1 - (lvl - 1) * 0.15),
      damage: 35 + (lvl - 1) * 8, // Lv.1: 유령(65)까지 2발 컷 / Lv.2+: 대부분 1발
      count: 1 + Math.floor((lvl - 1) / 2),
      speed: 320,
      radius: 6,
      pierce: Math.floor((lvl - 1) / 3), // 관통
    }),
  },
  sword: {
    name: '회전 검',
    desc: '주변을 회전하며 적을 자름',
    maxLevel: 5,
    apply: (lvl) => ({
      count: lvl,
      damage: 8 + (lvl - 1) * 4,
      orbitRadius: 60 + (lvl - 1) * 6,
      orbitSpeed: 3.2,
      swordRadius: 10 + (lvl - 1) * 1.5,
    }),
  },
  aura: {
    name: '원형 폭발',
    desc: '주기적으로 주변에 폭발 발생',
    maxLevel: 5,
    apply: (lvl) => ({
      cooldown: Math.max(1.4, 3.0 - (lvl - 1) * 0.35),
      damage: 18 + (lvl - 1) * 8,
      radius: 80 + (lvl - 1) * 15,
    }),
  },
  boomerang: {
    name: '부메랑',
    desc: '앞으로 던져지고 되돌아옴',
    maxLevel: 5,
    apply: (lvl) => ({
      cooldown: Math.max(0.7, 1.8 - (lvl - 1) * 0.25),
      damage: 12 + (lvl - 1) * 5,
      count: 1 + Math.floor((lvl - 1) / 2),
      range: 260 + (lvl - 1) * 40,
      radius: 8,
    }),
  },
};

// 패시브 정의
const PASSIVES = {
  moveSpeed: {
    name: '이동 속도',
    desc: '이동 속도 증가',
    maxLevel: 5,
    apply: (lvl, p) => { p.speed = PLAYER_BASE.speed * (1 + 0.10 * lvl); },
  },
  maxHp: {
    name: '최대 체력',
    desc: '최대 체력 증가',
    maxLevel: 5,
    apply: (lvl, p) => {
      const oldMax = p.maxHp;
      p.maxHp = PLAYER_BASE.maxHp + 25 * lvl;
      p.hp += (p.maxHp - oldMax); // 즉시 회복
    },
  },
  regen: {
    name: '체력 재생',
    desc: '초당 체력 회복',
    maxLevel: 5,
    apply: (lvl, p) => { p.regen = 0.7 * lvl; },
  },
  pickup: {
    name: '자석',
    desc: '경험치 젬 자동 획득 범위 확대',
    maxLevel: 5,
    apply: (lvl, p) => { p.pickupRadius = PLAYER_BASE.pickupRadius + 25 * lvl; },
  },
};

// -------------------------------------------------------------------------
// 게임 상태
// -------------------------------------------------------------------------

const state = {
  screen: 'menu',
  game: null,
};

// -------------------------------------------------------------------------
// 저장
// -------------------------------------------------------------------------

function loadBest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign({time:0, kills:0}, JSON.parse(raw));
  } catch (e) {}
  return { time: 0, kills: 0 };
}
function saveBest(record) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}
function updateBestDisplay() {
  const best = loadBest();
  const el = document.getElementById('best-record');
  if (best.time > 0) {
    el.textContent = `최고 기록 ${formatTime(best.time)} · 처치 ${best.kills}`;
  } else {
    el.textContent = '';
  }
}

// -------------------------------------------------------------------------
// 화면 전환
// -------------------------------------------------------------------------

function showScreen(name) {
  state.screen = name;
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  if (name === 'menu') updateBestDisplay();
}

// 초기 UI 이벤트
document.getElementById('btn-start').addEventListener('click', () => startGame());
document.getElementById('btn-guide').addEventListener('click', () => {
  document.getElementById('guide-panel').classList.toggle('hidden');
});
document.getElementById('btn-end-confirm').addEventListener('click', () => showScreen('menu'));
document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-quit').addEventListener('click', () => {
  if (state.game) endGame('quit');
});

updateBestDisplay();

// -------------------------------------------------------------------------
// 캔버스
// -------------------------------------------------------------------------

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = ARENA_W * dpr;
  canvas.height = ARENA_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);

// -------------------------------------------------------------------------
// 입력
// -------------------------------------------------------------------------

const keys = { up:false, down:false, left:false, right:false };

const KEY_MAP = {
  ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
  w:'up', W:'up', s:'down', S:'down', a:'left', A:'left', d:'right', D:'right',
};

window.addEventListener('keydown', (e) => {
  if (state.screen !== 'game') return;
  if (KEY_MAP[e.key]) { keys[KEY_MAP[e.key]] = true; e.preventDefault(); }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
});
window.addEventListener('keyup', (e) => {
  if (KEY_MAP[e.key]) { keys[KEY_MAP[e.key]] = false; e.preventDefault(); }
});

function bindHold(el, dir) {
  const set = (v) => { keys[dir] = v; };
  el.addEventListener('touchstart', (e) => { e.preventDefault(); set(true); }, {passive:false});
  el.addEventListener('touchend',   (e) => { e.preventDefault(); set(false); }, {passive:false});
  el.addEventListener('mousedown', () => set(true));
  el.addEventListener('mouseup',   () => set(false));
  el.addEventListener('mouseleave',() => set(false));
}
bindHold(document.getElementById('dpad-up'),    'up');
bindHold(document.getElementById('dpad-down'),  'down');
bindHold(document.getElementById('dpad-left'),  'left');
bindHold(document.getElementById('dpad-right'), 'right');

// -------------------------------------------------------------------------
// 게임 시작
// -------------------------------------------------------------------------

function startGame() {
  const player = {
    x: ARENA_W / 2, y: ARENA_H / 2,
    hp: PLAYER_BASE.hp, maxHp: PLAYER_BASE.maxHp,
    speed: PLAYER_BASE.speed,
    radius: PLAYER_BASE.radius,
    regen: PLAYER_BASE.regen,
    pickupRadius: PLAYER_BASE.pickupRadius,
    facing: { x: 1, y: 0 },
    invulnUntil: 0,
  };

  state.game = {
    player,
    mobs: [],
    projectiles: [],
    swords: [],       // 회전 검
    explosions: [],   // 원형 폭발 시각 이펙트
    gems: [],
    weapons: { orb: 1 }, // 시작 무기: 마법 구슬 Lv.1
    passives: {},
    weaponTimers: { orb: 0, aura: 0, boomerang: 0 },
    weaponStats: {},
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    kills: 0,
    elapsed: 0,
    spawnTimer: 0,
    bossSpawned: false,
    paused: false,
    running: true,
    result: null,
    lastTick: null,
    swordAngle: 0,
  };
  recomputeWeaponStats();
  syncSwords();

  resizeCanvas();
  showScreen('game');
  updateHud();
  hideLevelupOverlay();
  document.getElementById('pause-overlay').classList.add('hidden');
  requestAnimationFrame(gameLoop);
}

function xpForLevel(lvl) {
  // 1레벨→2레벨은 5, 이후 증가
  return Math.floor(5 + Math.pow(lvl, 1.6) * 1.4);
}

function recomputeWeaponStats() {
  const g = state.game;
  g.weaponStats = {};
  for (const key in g.weapons) {
    g.weaponStats[key] = WEAPONS[key].apply(g.weapons[key]);
  }
}

function syncSwords() {
  const g = state.game;
  if (!g.weapons.sword) { g.swords = []; return; }
  const s = g.weaponStats.sword;
  g.swords = [];
  for (let i = 0; i < s.count; i++) {
    g.swords.push({ offset: (Math.PI * 2 * i) / s.count });
  }
}

// -------------------------------------------------------------------------
// 게임 루프
// -------------------------------------------------------------------------

function gameLoop(ts) {
  const g = state.game;
  if (!g || !g.running) return;
  if (g.lastTick == null) g.lastTick = ts;
  const dt = Math.min(0.05, (ts - g.lastTick) / 1000);
  g.lastTick = ts;

  if (!g.paused) {
    updatePlayer(g, dt);
    updateSpawns(g, dt);
    updateMobs(g, dt);
    updateWeapons(g, dt, ts);
    updateProjectiles(g, dt);
    updateGems(g, dt);
    updateExplosions(g, dt);
    g.elapsed += dt;
    checkTimeConditions(g);
  }

  render(g, ts);
  if (g.running) requestAnimationFrame(gameLoop);
}

// -------------------------------------------------------------------------
// 플레이어
// -------------------------------------------------------------------------

function updatePlayer(g, dt) {
  const p = g.player;
  let dx = 0, dy = 0;
  if (keys.up)    dy -= 1;
  if (keys.down)  dy += 1;
  if (keys.left)  dx -= 1;
  if (keys.right) dx += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    // facing 갱신 (수직 이동만 할 때는 마지막 좌우 방향 유지 → 스프라이트 방향 안정)
    p.facing = { x: dx !== 0 ? dx : p.facing.x, y: dy };
    p.x = clamp(p.x + dx * p.speed * dt, p.radius, ARENA_W - p.radius);
    p.y = clamp(p.y + dy * p.speed * dt, p.radius, ARENA_H - p.radius);
  }
  // 재생
  if (p.regen > 0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    updateHud();
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// -------------------------------------------------------------------------
// 몹 스폰
// -------------------------------------------------------------------------

function updateSpawns(g, dt) {
  const t = g.elapsed;

  // 보스 스폰
  if (!g.bossSpawned && t >= BOSS_TIME) {
    g.bossSpawned = true;
    spawnMob(g, 'boss');
  }

  // 일반 몹 스폰: 시간이 지날수록 빈도 증가
  const spawnRate = 0.9 + t / 45; // 스폰/초
  g.spawnTimer += dt * spawnRate;
  while (g.spawnTimer >= 1) {
    g.spawnTimer -= 1;
    spawnMob(g, pickMobType(t));
  }
}

function pickMobType(t) {
  const pool = ['zombie'];
  if (t >= 90)  pool.push('bat');
  if (t >= 210) pool.push('skeleton');
  if (t >= 330) pool.push('ghost');
  // 후반부 가중치: 더 강한 몹이 자주 나오도록 마지막 종류를 두 번 넣음
  if (t >= 420 && pool.length > 1) pool.push(pool[pool.length - 1]);
  return pool[Math.floor(Math.random() * pool.length)];
}

function spawnMob(g, typeKey) {
  const t = MOB_TYPES[typeKey];
  // 화면 밖 랜덤 지점
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  const pad = 30;
  if (edge === 0) { x = Math.random() * ARENA_W; y = -pad; }
  else if (edge === 1) { x = ARENA_W + pad; y = Math.random() * ARENA_H; }
  else if (edge === 2) { x = Math.random() * ARENA_W; y = ARENA_H + pad; }
  else { x = -pad; y = Math.random() * ARENA_H; }

  // 시간이 지날수록 hp/damage 조금씩 증가
  const scale = 1 + g.elapsed / 200;
  g.mobs.push({
    type: typeKey,
    x, y,
    hp: t.hp * scale,
    maxHp: t.hp * scale,
    dmg: t.dmg * scale,
    speed: t.speed,
    radius: t.radius,
    color: t.color,
    xp: t.xp,
    hitCooldown: 0, // 플레이어 재피격 방지
    stunUntil: 0,   // 향후 확장용
    hitFlash: 0,
    isBoss: typeKey === 'boss',
  });
}

// -------------------------------------------------------------------------
// 몹 이동 + 플레이어 충돌
// -------------------------------------------------------------------------

function updateMobs(g, dt) {
  const p = g.player;
  for (const m of g.mobs) {
    if (m.hp <= 0) continue;
    const dx = p.x - m.x, dy = p.y - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.001) {
      m.x += (dx / dist) * m.speed * dt;
      m.y += (dy / dist) * m.speed * dt;
    }
    if (m.hitFlash > 0) m.hitFlash -= dt;

    // 플레이어 접촉
    if (dist < m.radius + p.radius && performance.now() > p.invulnUntil) {
      damagePlayer(g, m.dmg);
      p.invulnUntil = performance.now() + PLAYER_BASE.hitCooldown * 1000;
      if (p.hp <= 0) return;
    }
  }
  // 죽은 몹 정리 + 젬 드롭
  for (let i = g.mobs.length - 1; i >= 0; i--) {
    if (g.mobs[i].hp <= 0) {
      const m = g.mobs[i];
      g.mobs.splice(i, 1);
      g.kills++;
      dropGem(g, m);
    }
  }
}

function dropGem(g, mob) {
  const xp = mob.xp;
  let color = '#8fce7c';
  if (xp >= 5) color = '#a15dff';
  else if (xp >= 3) color = '#5dc3ff';
  g.gems.push({ x: mob.x, y: mob.y, xp, color, radius: xp >= 20 ? 8 : (xp >= 5 ? 6 : 4) });
}

function damagePlayer(g, amount) {
  const p = g.player;
  p.hp = Math.max(0, p.hp - amount);
  updateHud();
  if (p.hp <= 0) {
    endGame('death');
  }
}

// -------------------------------------------------------------------------
// 무기: 마법 구슬 / 회전 검 / 원형 폭발 / 부메랑
// -------------------------------------------------------------------------

function updateWeapons(g, dt, ts) {
  // 회전 검 각도 갱신
  g.swordAngle += 3.2 * dt;

  // 무기별 쿨다운/발사
  if (g.weapons.orb) tickOrb(g, dt);
  if (g.weapons.aura) tickAura(g, dt);
  if (g.weapons.boomerang) tickBoomerang(g, dt);
  // 회전 검은 지속형 → updateProjectiles의 sword 판정에서 처리
}

function tickOrb(g, dt) {
  const stats = g.weaponStats.orb;
  g.weaponTimers.orb -= dt;
  if (g.weaponTimers.orb > 0) return;
  g.weaponTimers.orb = stats.cooldown;

  // 가장 가까운 적 count개 방향으로 발사
  const targets = getNearestMobs(g, stats.count);
  if (targets.length === 0) {
    // 적 없을 때: 진행 방향으로 발사
    const dir = g.player.facing;
    for (let i = 0; i < stats.count; i++) {
      const ang = Math.atan2(dir.y, dir.x) + (i - (stats.count - 1) / 2) * 0.2;
      spawnProjectile(g, 'orb', Math.cos(ang), Math.sin(ang), stats);
    }
  } else {
    for (const m of targets) {
      const dx = m.x - g.player.x, dy = m.y - g.player.y;
      const d = Math.hypot(dx, dy) || 1;
      spawnProjectile(g, 'orb', dx / d, dy / d, stats);
    }
  }
}

function tickAura(g, dt) {
  const stats = g.weaponStats.aura;
  g.weaponTimers.aura -= dt;
  if (g.weaponTimers.aura > 0) return;
  g.weaponTimers.aura = stats.cooldown;

  // 즉시 범위 데미지
  for (const m of g.mobs) {
    if (m.hp <= 0) continue;
    const d = Math.hypot(m.x - g.player.x, m.y - g.player.y);
    if (d < stats.radius + m.radius) {
      m.hp -= stats.damage;
      m.hitFlash = 0.1;
    }
  }
  g.explosions.push({ x: g.player.x, y: g.player.y, radius: stats.radius, life: 0.4 });
}

function tickBoomerang(g, dt) {
  const stats = g.weaponStats.boomerang;
  g.weaponTimers.boomerang -= dt;
  if (g.weaponTimers.boomerang > 0) return;
  g.weaponTimers.boomerang = stats.cooldown;

  const dir = g.player.facing;
  for (let i = 0; i < stats.count; i++) {
    const ang = Math.atan2(dir.y, dir.x) + (i - (stats.count - 1) / 2) * 0.35;
    g.projectiles.push({
      kind: 'boomerang',
      x: g.player.x, y: g.player.y,
      vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260,
      damage: stats.damage,
      radius: stats.radius,
      range: stats.range,
      traveled: 0,
      returning: false,
      hits: new Set(), // 관통형, 같은 몹 여러 번 안 맞도록
    });
  }
}

function getNearestMobs(g, n) {
  return g.mobs
    .filter(m => m.hp > 0)
    .map(m => ({ m, d: Math.hypot(m.x - g.player.x, m.y - g.player.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map(o => o.m);
}

function spawnProjectile(g, kind, dx, dy, stats) {
  g.projectiles.push({
    kind,
    x: g.player.x, y: g.player.y,
    vx: dx * stats.speed, vy: dy * stats.speed,
    damage: stats.damage,
    radius: stats.radius,
    life: 1.6,
    pierce: stats.pierce || 0,
    hits: new Set(),
  });
}

function updateProjectiles(g, dt) {
  // 마법 구슬 등 직진 발사체
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    const p = g.projectiles[i];
    if (p.kind === 'boomerang') {
      // 부메랑: 앞으로 갔다 돌아옴
      if (!p.returning) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.traveled += Math.hypot(p.vx, p.vy) * dt;
        if (p.traveled >= p.range) p.returning = true;
      } else {
        const dx = g.player.x - p.x, dy = g.player.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const spd = 280;
        p.x += (dx / d) * spd * dt;
        p.y += (dy / d) * spd * dt;
        if (d < 20) { g.projectiles.splice(i, 1); continue; }
      }
      hitMobsByProjectile(g, p);
    } else {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      const remove = hitMobsByProjectile(g, p);
      if (p.life <= 0 || remove || p.x < -30 || p.x > ARENA_W + 30 || p.y < -30 || p.y > ARENA_H + 30) {
        g.projectiles.splice(i, 1);
      }
    }
  }

  // 회전 검 판정
  if (g.weapons.sword) {
    const stats = g.weaponStats.sword;
    for (const s of g.swords) {
      const ang = g.swordAngle + s.offset;
      s.x = g.player.x + Math.cos(ang) * stats.orbitRadius;
      s.y = g.player.y + Math.sin(ang) * stats.orbitRadius;
      for (const m of g.mobs) {
        if (m.hp <= 0) continue;
        const d = Math.hypot(m.x - s.x, m.y - s.y);
        if (d < stats.swordRadius + m.radius) {
          // 검은 계속 접촉 판정하므로 데미지에 dt 배수 적용
          m.hp -= stats.damage * dt * 2.5; // DPS
          m.hitFlash = 0.05;
        }
      }
    }
  }
}

function hitMobsByProjectile(g, p) {
  let killed = false;
  for (const m of g.mobs) {
    if (m.hp <= 0) continue;
    if (p.hits && p.hits.has(m)) continue;
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d < p.radius + m.radius) {
      m.hp -= p.damage;
      m.hitFlash = 0.08;
      if (p.hits) p.hits.add(m);
      if (p.kind === 'orb') {
        if (p.pierce > 0) { p.pierce--; }
        else return true; // 소멸
      }
      // 부메랑은 관통형: 계속 유지
    }
  }
  return killed;
}

// -------------------------------------------------------------------------
// 젬 획득
// -------------------------------------------------------------------------

function updateGems(g, dt) {
  const p = g.player;
  for (let i = g.gems.length - 1; i >= 0; i--) {
    const gem = g.gems[i];
    const d = Math.hypot(gem.x - p.x, gem.y - p.y);
    if (d < p.pickupRadius) {
      // 자석 효과: 플레이어 쪽으로 끌림
      const dx = p.x - gem.x, dy = p.y - gem.y;
      const dist = d || 1;
      gem.x += (dx / dist) * 300 * dt;
      gem.y += (dy / dist) * 300 * dt;
    }
    if (d < p.radius + gem.radius) {
      g.gems.splice(i, 1);
      addXp(g, gem.xp);
    }
  }
}

function addXp(g, xp) {
  g.xp += xp;
  while (g.xp >= g.xpToNext) {
    g.xp -= g.xpToNext;
    g.level++;
    g.xpToNext = xpForLevel(g.level);
    triggerLevelUp(g);
  }
  updateHud();
}

// -------------------------------------------------------------------------
// 이펙트
// -------------------------------------------------------------------------

function updateExplosions(g, dt) {
  for (let i = g.explosions.length - 1; i >= 0; i--) {
    g.explosions[i].life -= dt;
    if (g.explosions[i].life <= 0) g.explosions.splice(i, 1);
  }
}

// -------------------------------------------------------------------------
// 레벨업 카드
// -------------------------------------------------------------------------

function triggerLevelUp(g) {
  g.paused = true;
  const choices = generateCardChoices(g);
  const container = document.getElementById('card-choices');
  container.innerHTML = '';
  if (choices.length === 0) {
    // 강화가 없으면 즉시 체력 회복
    g.player.hp = Math.min(g.player.maxHp, g.player.hp + 30);
    g.paused = false;
    updateHud();
    return;
  }
  choices.forEach((c) => {
    const el = document.createElement('div');
    el.className = 'card';
    const currentLevel = c.category === 'weapon'
      ? (g.weapons[c.key] || 0)
      : (g.passives[c.key] || 0);
    const nextLevel = currentLevel + 1;
    const maxLevel = (c.category === 'weapon' ? WEAPONS : PASSIVES)[c.key].maxLevel;
    const isNew = currentLevel === 0;
    el.innerHTML = `
      <span class="card-level">${isNew ? 'NEW' : `Lv.${currentLevel} → ${nextLevel}`}${nextLevel === maxLevel ? ' (MAX)' : ''}</span>
      <div class="card-title">${c.name}</div>
      <div class="card-desc">${c.desc}</div>
    `;
    el.addEventListener('click', () => applyCard(g, c));
    container.appendChild(el);
  });
  document.getElementById('levelup-overlay').classList.remove('hidden');
}

function generateCardChoices(g) {
  const options = [];
  for (const key in WEAPONS) {
    const currentLvl = g.weapons[key] || 0;
    if (currentLvl < WEAPONS[key].maxLevel) {
      options.push({ category: 'weapon', key, name: WEAPONS[key].name, desc: WEAPONS[key].desc });
    }
  }
  for (const key in PASSIVES) {
    const currentLvl = g.passives[key] || 0;
    if (currentLvl < PASSIVES[key].maxLevel) {
      options.push({ category: 'passive', key, name: PASSIVES[key].name, desc: PASSIVES[key].desc });
    }
  }
  // 3장 뽑기(중복X)
  shuffle(options);
  return options.slice(0, Math.min(3, options.length));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function applyCard(g, c) {
  if (c.category === 'weapon') {
    g.weapons[c.key] = (g.weapons[c.key] || 0) + 1;
    if (!(c.key in g.weaponTimers) && c.key !== 'sword') {
      g.weaponTimers[c.key] = 0;
    }
    recomputeWeaponStats();
    if (c.key === 'sword') syncSwords();
  } else {
    g.passives[c.key] = (g.passives[c.key] || 0) + 1;
    PASSIVES[c.key].apply(g.passives[c.key], g.player);
  }
  hideLevelupOverlay();
  g.paused = false;
  updateHud();
}

function hideLevelupOverlay() {
  document.getElementById('levelup-overlay').classList.add('hidden');
}

// -------------------------------------------------------------------------
// 일시정지
// -------------------------------------------------------------------------

function togglePause() {
  const g = state.game;
  if (!g || !g.running) return;
  // 레벨업 중일 때는 일시정지 토글 안 함
  if (!document.getElementById('levelup-overlay').classList.contains('hidden')) return;
  g.paused = !g.paused;
  document.getElementById('pause-overlay').classList.toggle('hidden', !g.paused);
}

// -------------------------------------------------------------------------
// HUD
// -------------------------------------------------------------------------

function updateHud() {
  const g = state.game;
  if (!g) return;
  const p = g.player;
  document.getElementById('hp-bar').style.width = ((p.hp / p.maxHp) * 100) + '%';
  document.getElementById('hp-text').textContent = `${Math.round(p.hp)} / ${p.maxHp}`;
  document.getElementById('xp-bar').style.width = ((g.xp / g.xpToNext) * 100) + '%';
  document.getElementById('xp-text').textContent = `${g.xp} / ${g.xpToNext}`;
  document.getElementById('level-badge').textContent = 'Lv.' + g.level;
  document.getElementById('timer').textContent = formatTime(g.elapsed);
  document.getElementById('kill-count').textContent = '몹 처치 ' + g.kills;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// -------------------------------------------------------------------------
// 시간 조건 (승리)
// -------------------------------------------------------------------------

function checkTimeConditions(g) {
  updateHud();
  if (g.elapsed >= GAME_TIME_LIMIT) {
    endGame('win');
  }
}

// -------------------------------------------------------------------------
// 렌더링
// -------------------------------------------------------------------------

function render(g, ts) {
  // 배경
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  // 격자
  ctx.strokeStyle = '#141822';
  ctx.lineWidth = 1;
  for (let x = 0; x < ARENA_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke();
  }
  for (let y = 0; y < ARENA_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke();
  }

  // 폭발 이펙트
  for (const ex of g.explosions) {
    const alpha = Math.max(0, ex.life / 0.4);
    ctx.fillStyle = `rgba(255, 157, 93, ${0.35 * alpha})`;
    ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255, 213, 74, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 젬
  for (const gem of g.gems) {
    ctx.fillStyle = gem.color;
    ctx.beginPath();
    ctx.rect(gem.x - gem.radius, gem.y - gem.radius, gem.radius * 2, gem.radius * 2);
    ctx.fill();
  }

  // 몹
  for (const m of g.mobs) {
    ctx.save();
    ctx.fillStyle = m.hitFlash > 0 ? '#fff' : m.color;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 보스 HP 바
    if (m.isBoss) {
      const w = 40;
      ctx.fillStyle = '#4a1f1f';
      ctx.fillRect(m.x - w/2, m.y - m.radius - 10, w, 4);
      ctx.fillStyle = '#ff5d5d';
      ctx.fillRect(m.x - w/2, m.y - m.radius - 10, w * (m.hp / m.maxHp), 4);
    }
    ctx.restore();
  }

  // 발사체
  for (const p of g.projectiles) {
    if (p.kind === 'orb') {
      ctx.fillStyle = '#a15dff';
      ctx.shadowColor = '#a15dff'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (p.kind === 'boomerang') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((ts / 100) % (Math.PI * 2));
      ctx.strokeStyle = '#ffd54a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-p.radius, 0); ctx.lineTo(p.radius, 0);
      ctx.moveTo(0, -p.radius); ctx.lineTo(0, p.radius);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 회전 검
  if (g.weapons.sword) {
    const stats = g.weaponStats.sword;
    for (const s of g.swords) {
      if (s.x == null) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(g.swordAngle + s.offset);
      ctx.strokeStyle = '#5dc3ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-stats.swordRadius, 0); ctx.lineTo(stats.swordRadius, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 플레이어
  const p = g.player;
  ctx.save();
  const invuln = performance.now() < p.invulnUntil;
  if (invuln) ctx.globalAlpha = 0.55;

  if (playerSpriteReady) {
    // 좌우 반전 (이동 방향 기준, 마지막 수평 방향 유지)
    const flip = p.facing.x < 0;
    ctx.translate(p.x, p.y);
    if (flip) ctx.scale(-1, 1);
    // 이미지 하단이 발끝에 오도록 오프셋. 몸통 중앙이 원 반지름의 살짝 아래에 오게.
    ctx.drawImage(
      playerSprite,
      -PLAYER_SPRITE_W / 2,
      -PLAYER_SPRITE_H / 2 - 4,
      PLAYER_SPRITE_W,
      PLAYER_SPRITE_H
    );
  } else {
    ctx.fillStyle = invuln ? 'rgba(255,255,255,0.7)' : '#ff5d8f';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();

  // 자석 반경(옅게)
  if (p.pickupRadius > PLAYER_BASE.pickupRadius) {
    ctx.save();
    ctx.strokeStyle = 'rgba(93, 195, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.pickupRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

// -------------------------------------------------------------------------
// 게임 종료
// -------------------------------------------------------------------------

function endGame(reason) {
  const g = state.game;
  if (!g || !g.running) return;
  g.running = false;
  g.result = reason;

  const titleEl = document.getElementById('end-title');
  const msgEl = document.getElementById('end-message');
  const statsEl = document.getElementById('end-stats');
  titleEl.className = '';

  if (reason === 'win') {
    titleEl.textContent = '생존 성공!';
    titleEl.classList.add('win');
    msgEl.textContent = '10분을 버텨냈습니다.';
  } else if (reason === 'death') {
    titleEl.textContent = '사망...';
    titleEl.classList.add('lose');
    msgEl.textContent = '체력이 0이 되었습니다.';
  } else {
    titleEl.textContent = '중단';
    titleEl.classList.add('lose');
    msgEl.textContent = '게임을 포기했습니다.';
  }

  // 최고 기록 갱신 (더 오래 살면 갱신)
  const best = loadBest();
  const survived = g.elapsed;
  const isNewBest = survived > best.time;
  if (isNewBest) {
    saveBest({ time: survived, kills: g.kills });
  }

  statsEl.innerHTML = `
    <div class="row"><span>생존 시간</span><span class="val">${formatTime(survived)}</span></div>
    <div class="row"><span>몹 처치</span><span class="val">${g.kills}</span></div>
    <div class="row"><span>최종 레벨</span><span class="val">Lv.${g.level}</span></div>
    ${isNewBest ? '<div class="row"><span>🏆 신기록!</span><span class="val">갱신</span></div>' : ''}
  `;

  showScreen('end');
}
