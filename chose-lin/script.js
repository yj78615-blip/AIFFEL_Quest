// ==========================================================================
// 혼돈의 궤적 - 루트 파밍 생존 게임
// ==========================================================================

const STORAGE_KEY = 'chaos-trajectory-inventory-v1';

const FIELD_INFO = {
  forest:      { name: '숲',   bg: '#0e1d12', ground: '#173a20' },
  wasteland:   { name: '황야', bg: '#241c12', ground: '#4a3418' },
  grassland:   { name: '초원', bg: '#16210f', ground: '#3a5a1f' },
  city:        { name: '도심', bg: '#12141c', ground: '#2a2d3a' },
  underground: { name: '지하', bg: '#0a0a0d', ground: '#26262e' },
};

const FIELD_TIME_LIMIT = 10 * 60; // 10분(초)
const PLAYER_SPEED = 180; // px/sec
const MOB_SPEED = 100; // px/sec (유저보다 느리게)
const MOB_DETECT_RADIUS = 150;
const MOB_CHASE_LINGER = 3000; // ms, 시야를 벗어난 뒤 추적을 유지하는 시간
const MOB_HIT_RADIUS = 22;
const MOB_HIT_COOLDOWN = 900; // ms, 동일 몹에게 연속으로 맞는 것 방지
const PLAYER_MAX_HP = 100;
const DAMAGE_PER_HIT = PLAYER_MAX_HP * 0.20;
const HEAL_PER_POTION = PLAYER_MAX_HP * 0.05;
const PICKUP_RADIUS = 40;
const ATTACK_RADIUS = 60;
const ATTACK_STUN_MS = 500;
const EXIT_RADIUS = 34;

const ITEM_TYPES = [
  { type: 'weapon',   label: '무기',   icon: '🗡️', weight: 3 },
  { type: 'potion',   label: '회복약', icon: '🧪', weight: 4 },
  { type: 'material', label: '재료',   icon: '💎', weight: 3 },
];

const WEAPON_NAMES = ['녹슨 단검', '뼈 몽둥이', '부러진 파이프', '강철 도끼', '이빨 창'];
const MATERIAL_NAMES = ['가죽 조각', '금속 파편', '이상한 결정', '나무 조각', '녹슨 나사'];

// -------------------------------------------------------------------------
// 전역 상태
// -------------------------------------------------------------------------

const state = {
  screen: 'menu',
  inventory: loadInventory(), // 영구 인벤토리: {weapon:[], potion:n, material:n}
  field: null, // 현재 진행 중인 필드 게임 상태
};

function loadInventory() {
  const defaults = { weapons: [], potion: 0, material: 0, equippedWeapon: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign(defaults, JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return defaults;
}

function saveInventory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.inventory));
}

// -------------------------------------------------------------------------
// 화면 전환
// -------------------------------------------------------------------------

function showScreen(name) {
  state.screen = name;
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  if (name === 'inventory') renderInventoryScreen();
}

document.getElementById('btn-goto-field').addEventListener('click', () => showScreen('fieldselect'));
document.getElementById('btn-goto-inventory').addEventListener('click', () => showScreen('inventory'));
document.querySelectorAll('.back-btn').forEach((btn) => {
  btn.addEventListener('click', () => showScreen(btn.dataset.back));
});
document.getElementById('btn-end-confirm').addEventListener('click', () => showScreen('menu'));

document.querySelectorAll('.field-btn').forEach((btn) => {
  btn.addEventListener('click', () => startField(btn.dataset.field));
});

// -------------------------------------------------------------------------
// 인벤토리 화면 렌더링
// -------------------------------------------------------------------------

function renderInventoryScreen() {
  const list = document.getElementById('inventory-list');
  list.innerHTML = '';
  const inv = state.inventory;

  // 1) 장착 슬롯
  const slotSection = document.createElement('div');
  slotSection.className = 'inv-section';
  slotSection.innerHTML = `<div class="inv-section-title">장착 중</div>`;
  const slotRow = document.createElement('div');
  slotRow.className = 'item-row equipped-slot';
  if (inv.equippedWeapon) {
    slotRow.innerHTML = `<span>🗡️ ${inv.equippedWeapon}</span>`;
    const unequipBtn = document.createElement('button');
    unequipBtn.className = 'inv-btn';
    unequipBtn.textContent = '해제';
    unequipBtn.addEventListener('click', () => {
      state.inventory.equippedWeapon = null;
      saveInventory();
      renderInventoryScreen();
    });
    slotRow.appendChild(unequipBtn);
  } else {
    slotRow.innerHTML = `<span class="slot-empty">없음</span>`;
  }
  slotSection.appendChild(slotRow);
  list.appendChild(slotSection);

  // 2) 무기 목록
  const weaponSection = document.createElement('div');
  weaponSection.className = 'inv-section';
  weaponSection.innerHTML = `<div class="inv-section-title">무기</div>`;
  if (inv.weapons.length === 0) {
    const emptyRow = document.createElement('div');
    emptyRow.className = 'item-empty';
    emptyRow.textContent = '보유한 무기가 없습니다.';
    weaponSection.appendChild(emptyRow);
  } else {
    inv.weapons.forEach((w, idx) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `<span>🗡️ ${w}</span>`;
      const isEquipped = (w === inv.equippedWeapon);
      if (isEquipped) {
        const badge = document.createElement('span');
        badge.className = 'badge-equipped';
        badge.textContent = '장착 중';
        row.appendChild(badge);
      } else {
        const equipBtn = document.createElement('button');
        equipBtn.className = 'inv-btn';
        equipBtn.textContent = '장착';
        equipBtn.addEventListener('click', () => {
          state.inventory.equippedWeapon = w;
          saveInventory();
          renderInventoryScreen();
        });
        row.appendChild(equipBtn);
      }
      weaponSection.appendChild(row);
    });
  }
  list.appendChild(weaponSection);

  // 3) 소모품/재료
  const itemSection = document.createElement('div');
  itemSection.className = 'inv-section';
  itemSection.innerHTML = `<div class="inv-section-title">아이템</div>`;
  const other = [];
  if (inv.potion > 0) other.push(`🧪 회복약 x${inv.potion}`);
  if (inv.material > 0) other.push(`💎 재료 x${inv.material}`);
  if (other.length === 0) {
    const emptyRow = document.createElement('div');
    emptyRow.className = 'item-empty';
    emptyRow.textContent = '보유한 아이템이 없습니다.';
    itemSection.appendChild(emptyRow);
  } else {
    other.forEach((text) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.textContent = text;
      itemSection.appendChild(row);
    });
  }
  list.appendChild(itemSection);
}

// -------------------------------------------------------------------------
// 필드 시작
// -------------------------------------------------------------------------

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let ARENA_W = 800;
let ARENA_H = 600;

function resizeCanvas() {
  const wrap = document.getElementById('canvas-wrap');
  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = ARENA_W * dpr;
  canvas.height = ARENA_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);

function startField(fieldKey) {
  const info = FIELD_INFO[fieldKey];
  document.getElementById('field-name-badge').textContent = info.name;

  // 인벤토리에 장착된 무기가 있으면 꺼내서 필드에 들고 나감(사망 시 함께 손실)
  let broughtWeapon = null;
  if (state.inventory.equippedWeapon) {
    const idx = state.inventory.weapons.indexOf(state.inventory.equippedWeapon);
    if (idx >= 0) {
      broughtWeapon = state.inventory.weapons.splice(idx, 1)[0];
    } else {
      broughtWeapon = state.inventory.equippedWeapon;
    }
    state.inventory.equippedWeapon = null;
    saveInventory();
  }

  const player = {
    x: ARENA_W / 2,
    y: ARENA_H / 2,
    hp: PLAYER_MAX_HP,
    weapon: broughtWeapon,
    attackFlashUntil: 0,
  };

  const items = [];
  for (let i = 0; i < 10; i++) items.push(spawnItem());

  const mobs = [];
  const mobTypes = ['obster', 'hive'];
  for (let i = 0; i < 6; i++) {
    mobs.push(spawnMob(mobTypes[i % 2]));
  }

  const exits = spawnExits();

  state.field = {
    key: fieldKey,
    info,
    player,
    items,
    mobs,
    exits,
    runInventory: { weapons: broughtWeapon ? [broughtWeapon] : [], potion: 0, material: 0 },
    timeLeft: FIELD_TIME_LIMIT,
    lastTick: null,
    keys: {},
    running: true,
  };

  resizeCanvas();
  showScreen('field');
  updateHud();
  requestAnimationFrame(gameLoop);
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function spawnItem() {
  const totalWeight = ITEM_TYPES.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * totalWeight;
  let picked = ITEM_TYPES[0];
  for (const t of ITEM_TYPES) {
    if (r < t.weight) { picked = t; break; }
    r -= t.weight;
  }
  const item = {
    type: picked.type,
    icon: picked.icon,
    x: randRange(40, ARENA_W - 40),
    y: randRange(40, ARENA_H - 40),
  };
  if (picked.type === 'weapon') {
    item.name = WEAPON_NAMES[Math.floor(Math.random() * WEAPON_NAMES.length)];
  } else if (picked.type === 'material') {
    item.name = MATERIAL_NAMES[Math.floor(Math.random() * MATERIAL_NAMES.length)];
  }
  return item;
}

function spawnMob(type) {
  return {
    type,
    x: randRange(60, ARENA_W - 60),
    y: randRange(60, ARENA_H - 60),
    state: 'roam',
    roamTarget: { x: randRange(60, ARENA_W - 60), y: randRange(60, ARENA_H - 60) },
    lastSeenPlayer: 0,
    stunUntil: 0,
    lastHitOnPlayer: 0,
  };
}

function spawnExits() {
  const positions = [
    { x: 30, y: 30 },
    { x: ARENA_W - 30, y: ARENA_H / 2 },
    { x: 30, y: ARENA_H - 30 },
  ];
  return positions.map((p) => ({ x: p.x, y: p.y }));
}

// -------------------------------------------------------------------------
// 입력 처리
// -------------------------------------------------------------------------

const KEY_MAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
};

window.addEventListener('keydown', (e) => {
  if (state.screen !== 'field' || !state.field || !state.field.running) return;
  const dir = KEY_MAP[e.key];
  if (dir) { state.field.keys[dir] = true; e.preventDefault(); }
  if (e.key === 'f' || e.key === 'F') handleFKey();
  if (e.key === 'a' || e.key === 'A') tryAttack();
  if (e.key === 's' || e.key === 'S') tryDrinkPotion();
});

window.addEventListener('keyup', (e) => {
  if (!state.field) return;
  const dir = KEY_MAP[e.key];
  if (dir) { state.field.keys[dir] = false; e.preventDefault(); }
});

function bindHold(el, dir) {
  const set = (v) => { if (state.field) state.field.keys[dir] = v; };
  el.addEventListener('touchstart', (e) => { e.preventDefault(); set(true); }, { passive: false });
  el.addEventListener('touchend', (e) => { e.preventDefault(); set(false); }, { passive: false });
  el.addEventListener('mousedown', () => set(true));
  el.addEventListener('mouseup', () => set(false));
  el.addEventListener('mouseleave', () => set(false));
}
bindHold(document.getElementById('dpad-up'), 'up');
bindHold(document.getElementById('dpad-down'), 'down');
bindHold(document.getElementById('dpad-left'), 'left');
bindHold(document.getElementById('dpad-right'), 'right');

document.getElementById('btn-get').addEventListener('click', handleFKey);
document.getElementById('btn-attack').addEventListener('click', tryAttack);
document.getElementById('potion-quick').addEventListener('click', tryDrinkPotion);

function handleFKey() {
  const f = state.field;
  if (!f || !f.running) return;
  if (isNearExit(f)) {
    endField('escape');
    return;
  }
  tryPickupItem();
}

function tryPickupItem() {
  const f = state.field;
  if (!f || !f.running) return;
  let closest = null;
  let closestDist = Infinity;
  f.items.forEach((it) => {
    const d = Math.hypot(it.x - f.player.x, it.y - f.player.y);
    if (d < PICKUP_RADIUS && d < closestDist) { closest = it; closestDist = d; }
  });
  if (!closest) return;
  f.items.splice(f.items.indexOf(closest), 1);

  if (closest.type === 'weapon') {
    f.runInventory.weapons.push(closest.name);
    f.player.weapon = closest.name; // 획득 즉시 장착
  } else if (closest.type === 'potion') {
    f.runInventory.potion += 1;
  } else if (closest.type === 'material') {
    f.runInventory.material += 1;
  }
  updateHud();
}

function tryDrinkPotion() {
  const f = state.field;
  if (!f || !f.running) return;
  if (f.runInventory.potion <= 0) return;
  f.runInventory.potion -= 1;
  f.player.hp = Math.min(PLAYER_MAX_HP, f.player.hp + HEAL_PER_POTION);
  updateHud();
}

function tryAttack() {
  const f = state.field;
  if (!f || !f.running) return;
  if (!f.player.weapon) return;
  f.player.attackFlashUntil = performance.now() + 150;
  f.mobs.forEach((m) => {
    const d = Math.hypot(m.x - f.player.x, m.y - f.player.y);
    if (d < ATTACK_RADIUS) {
      m.stunUntil = performance.now() + ATTACK_STUN_MS;
    }
  });
}

// -------------------------------------------------------------------------
// 게임 루프
// -------------------------------------------------------------------------

function gameLoop(ts) {
  const f = state.field;
  if (!f || !f.running) return;
  if (f.lastTick == null) f.lastTick = ts;
  const dt = Math.min(0.05, (ts - f.lastTick) / 1000);
  f.lastTick = ts;

  updatePlayer(f, dt);
  updateMobs(f, ts);
  updateTimer(f, dt);

  render(f, ts);

  if (f.running) requestAnimationFrame(gameLoop);
}

function updatePlayer(f, dt) {
  const p = f.player;
  let dx = 0, dy = 0;
  if (f.keys.up) dy -= 1;
  if (f.keys.down) dy += 1;
  if (f.keys.left) dx -= 1;
  if (f.keys.right) dx += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    p.x = clamp(p.x + dx * PLAYER_SPEED * dt, 16, ARENA_W - 16);
    p.y = clamp(p.y + dy * PLAYER_SPEED * dt, 16, ARENA_H - 16);
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function updateMobs(f, ts) {
  const p = f.player;
  f.mobs.forEach((m) => {
    const d = Math.hypot(m.x - p.x, m.y - p.y);

    if (m.stunUntil > ts) {
      return; // 기절 상태: 이동하지 않음
    }

    if (d < MOB_DETECT_RADIUS) {
      m.state = 'chase';
      m.lastSeenPlayer = ts;
    } else if (m.state === 'chase' && ts - m.lastSeenPlayer > MOB_CHASE_LINGER) {
      m.state = 'roam';
      m.roamTarget = { x: randRange(60, ARENA_W - 60), y: randRange(60, ARENA_H - 60) };
    }

    let tx, ty;
    if (m.state === 'chase') {
      tx = p.x; ty = p.y;
    } else {
      tx = m.roamTarget.x; ty = m.roamTarget.y;
      if (Math.hypot(tx - m.x, ty - m.y) < 10) {
        m.roamTarget = { x: randRange(60, ARENA_W - 60), y: randRange(60, ARENA_H - 60) };
      }
    }

    const dist = Math.hypot(tx - m.x, ty - m.y);
    if (dist > 1) {
      const speed = (m.state === 'chase' ? MOB_SPEED : MOB_SPEED * 0.5);
      const stepDt = 1 / 60;
      const step = Math.min(dist, speed * stepDt);
      m.x += ((tx - m.x) / dist) * step;
      m.y += ((ty - m.y) / dist) * step;
    }

    // 유저와의 충돌 판정
    if (d < MOB_HIT_RADIUS && ts - m.lastHitOnPlayer > MOB_HIT_COOLDOWN) {
      m.lastHitOnPlayer = ts;
      p.hp = Math.max(0, p.hp - DAMAGE_PER_HIT);
      updateHud();
      if (p.hp <= 0) {
        endField('death');
      }
    }
  });
}

function updateTimer(f, dt) {
  f.timeLeft -= dt;
  if (f.timeLeft <= 0) {
    f.timeLeft = 0;
    updateHud();
    endField('timeout');
    return;
  }
  updateTimerDisplay(f.timeLeft);
}

function isNearExit(f) {
  const p = f.player;
  return f.exits.some((ex) => Math.hypot(ex.x - p.x, ex.y - p.y) < EXIT_RADIUS);
}

// -------------------------------------------------------------------------
// HUD
// -------------------------------------------------------------------------

function updateHud() {
  const f = state.field;
  if (!f) return;
  const pct = Math.max(0, (f.player.hp / PLAYER_MAX_HP) * 100);
  document.getElementById('hp-bar').style.width = pct + '%';
  document.getElementById('hp-text').textContent = `${Math.round(f.player.hp)} / ${PLAYER_MAX_HP}`;
  document.getElementById('equipped').textContent = '무기: ' + (f.player.weapon || '없음');
  document.getElementById('potion-count').textContent = f.runInventory.potion;
  document.getElementById('material-count').textContent = f.runInventory.material;
}

function updateTimerDisplay(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  document.getElementById('timer').textContent =
    `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// -------------------------------------------------------------------------
// 렌더링
// -------------------------------------------------------------------------

function render(f, ts) {
  ctx.fillStyle = f.info.bg;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // 바닥 격자
  ctx.strokeStyle = f.info.ground;
  ctx.lineWidth = 1;
  for (let x = 0; x < ARENA_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke();
  }
  for (let y = 0; y < ARENA_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke();
  }

  // 탈출구
  f.exits.forEach((ex) => {
    ctx.fillStyle = 'rgba(90, 220, 140, 0.25)';
    ctx.beginPath(); ctx.arc(ex.x, ex.y, EXIT_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5adc8c';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚪', ex.x, ex.y);
  });

  // 아이템
  f.items.forEach((it) => {
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.icon, it.x, it.y);
  });

  // 몹
  f.mobs.forEach((m) => {
    const stunned = m.stunUntil > ts;
    ctx.save();
    if (stunned) ctx.globalAlpha = 0.5;
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const emoji = m.type === 'obster' ? '🦂' : '🐝';
    ctx.fillText(emoji, m.x, m.y);
    if (m.state === 'chase' && !stunned) {
      ctx.fillStyle = '#ff5d5d';
      ctx.beginPath(); ctx.arc(m.x, m.y - 22, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (stunned) {
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#ffd54a';
      ctx.fillText('★', m.x + 16, m.y - 16);
    }
    ctx.restore();
  });

  // 플레이어
  const p = f.player;
  ctx.save();
  const flashing = p.attackFlashUntil > ts;
  ctx.font = '30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🧑', p.x, p.y);
  if (flashing) {
    ctx.strokeStyle = '#8fd0ff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, ATTACK_RADIUS, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  if (isNearExit(f)) {
    ctx.save();
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5adc8c';
    ctx.fillText('F: 탈출하기', p.x, p.y - 26);
    ctx.restore();
  }
}

// -------------------------------------------------------------------------
// 필드 종료
// -------------------------------------------------------------------------

function endField(reason) {
  const f = state.field;
  if (!f || !f.running) return;
  f.running = false;

  let title, message;
  let gainedRows = [];

  if (reason === 'death') {
    title = '쓰러졌습니다...';
    message = '체력이 0이 되어 획득한 아이템을 모두 잃었습니다.';
  } else if (reason === 'timeout') {
    title = '시간 초과';
    message = '필드에서 10분이 지나 획득한 아이템을 모두 잃었습니다.';
  } else if (reason === 'escape') {
    title = '탈출 성공!';
    message = '획득한 아이템을 인벤토리로 가져왔습니다.';
    // 인벤토리로 이전
    state.inventory.weapons.push(...f.runInventory.weapons);
    state.inventory.potion += f.runInventory.potion;
    state.inventory.material += f.runInventory.material;
    saveInventory();

    if (f.runInventory.weapons.length) {
      f.runInventory.weapons.forEach((w) => gainedRows.push(`🗡️ ${w}`));
    }
    if (f.runInventory.potion > 0) gainedRows.push(`🧪 회복약 x${f.runInventory.potion}`);
    if (f.runInventory.material > 0) gainedRows.push(`💎 재료 x${f.runInventory.material}`);
  }

  document.getElementById('end-title').textContent = title;
  document.getElementById('end-message').textContent = message;
  const list = document.getElementById('end-items');
  list.innerHTML = '';
  if (gainedRows.length === 0) {
    list.innerHTML = '<div class="item-empty">획득한 아이템이 없습니다.</div>';
  } else {
    gainedRows.forEach((text) => {
      const div = document.createElement('div');
      div.className = 'item-row';
      div.textContent = text;
      list.appendChild(div);
    });
  }

  showScreen('end');
}
