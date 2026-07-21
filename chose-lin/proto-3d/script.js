// ============================================================================
// 혼돈의 궤적 · 2.5D 프로토타입 (Three.js)
//
// 목표(Step 1 = A + B + C):
//   A) Three.js 씬, 등각(직교) 카메라, 방향키 이동, 바닥 평면
//   B) 플레이어 스프라이트를 빌보드로 표시
//   C) 몹 1종(캡슐)의 배회/추적 AI, 접촉 데미지, HP UI
// ============================================================================

import * as THREE from 'three';

// -------- 상수 --------
const ARENA_SIZE = 60;
const PLAYER_SPEED = 8;
const MOB_ROAM_SPEED = 2.5;
const MOB_CHASE_SPEED = 4.5;
const MOB_DETECT = 8;
const MOB_CHASE_LINGER = 3000; // ms
const MOB_HIT_COOLDOWN = 900; // ms
const DAMAGE_PER_HIT = 10;
const PLAYER_MAX_HP = 100;
const MOB_COUNT = 5;

const PLAYER_TEXTURE_URL = 'player.jpg';

// -------- DOM 참조 --------
const canvasWrap = document.getElementById('canvas-wrap');
const hpBar = document.getElementById('hp-bar');
const hpText = document.getElementById('hp-text');
const fpsEl = document.getElementById('fps');
const mobCountEl = document.getElementById('mob-count');
const deadOverlay = document.getElementById('dead-overlay');
const btnRestart = document.getElementById('btn-restart');

// -------- Three.js 셋업 --------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f14);
scene.fog = new THREE.Fog(0x0a0f14, ARENA_SIZE * 0.6, ARENA_SIZE * 1.6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
canvasWrap.appendChild(renderer.domElement);

// 등각 느낌의 Orthographic 카메라 (플레이어를 따라감)
const CAM_ZOOM = 22;
let camera;
function makeCamera() {
  const aspect = canvasWrap.clientWidth / canvasWrap.clientHeight;
  camera = new THREE.OrthographicCamera(
    -CAM_ZOOM * aspect, CAM_ZOOM * aspect,
    CAM_ZOOM, -CAM_ZOOM,
    0.1, 200
  );
  // 3/4 뷰 각도
  camera.position.set(0, 30, 22);
  camera.lookAt(0, 0, 0);
}
makeCamera();

function resize() {
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  camera.left = -CAM_ZOOM * aspect;
  camera.right = CAM_ZOOM * aspect;
  camera.top = CAM_ZOOM;
  camera.bottom = -CAM_ZOOM;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
setTimeout(resize, 0);

// 조명
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const dirLight = new THREE.DirectionalLight(0xfff2d0, 0.9);
dirLight.position.set(10, 20, 8);
scene.add(dirLight);

// 바닥
const groundGeo = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE, 1, 1);
const groundMat = new THREE.MeshLambertMaterial({ color: 0x1b3020 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// 그리드 헬퍼(격자)
const grid = new THREE.GridHelper(ARENA_SIZE, ARENA_SIZE / 4, 0x2c5a3a, 0x1e3a25);
grid.position.y = 0.01;
scene.add(grid);

// 경계 벽 (얇은 상자)
function addWall(x, z, w, d) {
  const geo = new THREE.BoxGeometry(w, 2, d);
  const mat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const wall = new THREE.Mesh(geo, mat);
  wall.position.set(x, 1, z);
  scene.add(wall);
}
const HALF = ARENA_SIZE / 2;
addWall(0,  HALF, ARENA_SIZE, 0.5);
addWall(0, -HALF, ARENA_SIZE, 0.5);
addWall( HALF, 0, 0.5, ARENA_SIZE);
addWall(-HALF, 0, 0.5, ARENA_SIZE);

// -------- 플레이어 (빌보드 스프라이트) --------
const player = {
  position: new THREE.Vector3(0, 0, 0),
  radius: 0.7,
  facing: new THREE.Vector3(1, 0, 0),
  hp: PLAYER_MAX_HP,
  invulnUntil: 0,
  sprite: null,
  fallback: null,
};

function createPlayerVisual() {
  // 우선 폴백(색상 판)을 만들어 두고, 텍스처가 성공하면 교체
  const fallbackGeo = new THREE.PlaneGeometry(1.6, 2.6);
  const fallbackMat = new THREE.MeshBasicMaterial({ color: 0xff5d8f, transparent: true });
  const fallback = new THREE.Mesh(fallbackGeo, fallbackMat);
  fallback.position.set(0, 1.3, 0);
  scene.add(fallback);
  player.fallback = fallback;

  const loader = new THREE.TextureLoader();
  loader.load(
    PLAYER_TEXTURE_URL,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex });
      const sprite = new THREE.Sprite(mat);
      // 이미지 비율에 맞춰 크기 세팅
      const w = 2.4;
      const aspect = tex.image ? (tex.image.width / tex.image.height) : 1;
      sprite.scale.set(w, w / aspect, 1);
      sprite.position.set(0, sprite.scale.y * 0.5, 0);
      scene.add(sprite);
      player.sprite = sprite;
      // 폴백 제거
      scene.remove(fallback);
      fallback.geometry.dispose();
      fallback.material.dispose();
      player.fallback = null;
    },
    undefined,
    (err) => {
      console.warn('플레이어 텍스처 로드 실패, 폴백 사용', err);
    }
  );
}
createPlayerVisual();

function setPlayerVisualPosition() {
  if (player.sprite) {
    player.sprite.position.x = player.position.x;
    player.sprite.position.z = player.position.z;
  }
  if (player.fallback) {
    player.fallback.position.x = player.position.x;
    player.fallback.position.z = player.position.z;
    // 폴백은 카메라를 바라보게
    player.fallback.lookAt(camera.position.x, player.fallback.position.y, camera.position.z);
  }
}

// 그림자 원반 (스프라이트 아래 가짜 그림자)
const shadowGeo = new THREE.CircleGeometry(0.7, 24);
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false,
});
const playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
playerShadow.rotation.x = -Math.PI / 2;
playerShadow.position.y = 0.02;
scene.add(playerShadow);

// -------- 몹 (색상 캡슐) --------
const mobs = [];

function spawnMob() {
  // 캡슐이 없는 Three.js 버전 대비 CylinderGeometry로 캡슐 흉내
  const bodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12);
  const capGeo = new THREE.SphereGeometry(0.5, 12, 8);
  const mat = new THREE.MeshLambertMaterial({ color: 0xff5d5d });
  const body = new THREE.Mesh(bodyGeo, mat);
  const top = new THREE.Mesh(capGeo, mat);
  top.position.y = 0.6;
  const bottom = new THREE.Mesh(capGeo, mat);
  bottom.position.y = -0.6;
  const group = new THREE.Group();
  group.add(body); group.add(top); group.add(bottom);

  // 플레이어에서 떨어진 곳에 스폰
  let x, z;
  do {
    x = (Math.random() - 0.5) * (ARENA_SIZE - 4);
    z = (Math.random() - 0.5) * (ARENA_SIZE - 4);
  } while (Math.hypot(x - player.position.x, z - player.position.z) < 10);

  group.position.set(x, 0.9, z);
  scene.add(group);

  // 몹 자체 그림자
  const s = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
  );
  s.rotation.x = -Math.PI / 2;
  s.position.set(x, 0.02, z);
  scene.add(s);

  const mob = {
    mesh: group,
    shadow: s,
    radius: 0.55,
    state: 'roam',
    roamTarget: pickRoamPoint(),
    lastSeenPlayer: 0,
    stunUntil: 0,
    lastHitOnPlayer: 0,
    body: mat,
  };
  mobs.push(mob);
}

function pickRoamPoint() {
  return new THREE.Vector3(
    (Math.random() - 0.5) * (ARENA_SIZE - 6), 0,
    (Math.random() - 0.5) * (ARENA_SIZE - 6)
  );
}

for (let i = 0; i < MOB_COUNT; i++) spawnMob();

// -------- 입력 --------
const keys = { up: false, down: false, left: false, right: false };
const KEY_MAP = {
  w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right',
};
window.addEventListener('keydown', (e) => {
  const k = KEY_MAP[e.key];
  if (k) { keys[k] = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  const k = KEY_MAP[e.key];
  if (k) { keys[k] = false; e.preventDefault(); }
});

btnRestart.addEventListener('click', restart);

// -------- HUD --------
function updateHud() {
  const pct = Math.max(0, (player.hp / PLAYER_MAX_HP) * 100);
  hpBar.style.width = pct + '%';
  hpText.textContent = `${Math.round(player.hp)} / ${PLAYER_MAX_HP}`;
  mobCountEl.textContent = '몹 ' + mobs.length;
}
updateHud();

// -------- 재시작 --------
function restart() {
  player.position.set(0, 0, 0);
  player.hp = PLAYER_MAX_HP;
  player.invulnUntil = 0;
  // 몹 정리
  for (const m of mobs) {
    scene.remove(m.mesh);
    scene.remove(m.shadow);
  }
  mobs.length = 0;
  for (let i = 0; i < MOB_COUNT; i++) spawnMob();
  deadOverlay.classList.add('hidden');
  updateHud();
}

// -------- 게임 루프 --------
let lastTime = performance.now();
let running = true;
let fpsAccum = 0, fpsFrames = 0, fpsTimer = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  // FPS
  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fpsEl.textContent = 'FPS ' + Math.round(fpsFrames / fpsTimer);
    fpsFrames = 0; fpsTimer = 0;
  }

  if (running) {
    updatePlayer(dt);
    updateMobs(dt, now);
    updateCamera(dt);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function updatePlayer(dt) {
  let ix = 0, iz = 0;
  if (keys.up) iz -= 1;
  if (keys.down) iz += 1;
  if (keys.left) ix -= 1;
  if (keys.right) ix += 1;
  if (ix !== 0 || iz !== 0) {
    const len = Math.hypot(ix, iz);
    ix /= len; iz /= len;
    // 입력을 카메라 요우(yaw)만큼 회전 → 방향키 '위'는 항상 화면 위쪽(=카메라로부터 앞쪽)으로 이동
    const c = Math.cos(camState.yaw), s = Math.sin(camState.yaw);
    const wx = ix * c + iz * s;
    const wz = -ix * s + iz * c;
    player.facing.set(wx, 0, wz);
    const nx = player.position.x + wx * PLAYER_SPEED * dt;
    const nz = player.position.z + wz * PLAYER_SPEED * dt;
    player.position.x = Math.max(-HALF + 1, Math.min(HALF - 1, nx));
    player.position.z = Math.max(-HALF + 1, Math.min(HALF - 1, nz));
  }
  setPlayerVisualPosition();
  playerShadow.position.x = player.position.x;
  playerShadow.position.z = player.position.z;
}

function updateMobs(dt, now) {
  const px = player.position.x, pz = player.position.z;
  for (const m of mobs) {
    const mx = m.mesh.position.x, mz = m.mesh.position.z;
    const dPlayer = Math.hypot(mx - px, mz - pz);

    // 상태 전이
    if (m.stunUntil > now) {
      // 향후 확장용 — 이번 프로토타입에서는 stun 없음
    }
    if (dPlayer < MOB_DETECT) {
      m.state = 'chase';
      m.lastSeenPlayer = now;
    } else if (m.state === 'chase' && now - m.lastSeenPlayer > MOB_CHASE_LINGER) {
      m.state = 'roam';
      m.roamTarget = pickRoamPoint();
    }

    let tx, tz, speed;
    if (m.state === 'chase') {
      tx = px; tz = pz; speed = MOB_CHASE_SPEED;
    } else {
      tx = m.roamTarget.x; tz = m.roamTarget.z; speed = MOB_ROAM_SPEED;
      if (Math.hypot(tx - mx, tz - mz) < 0.5) m.roamTarget = pickRoamPoint();
    }
    const d = Math.hypot(tx - mx, tz - mz);
    if (d > 0.01) {
      const step = Math.min(d, speed * dt);
      const nx = mx + ((tx - mx) / d) * step;
      const nz = mz + ((tz - mz) / d) * step;
      m.mesh.position.x = nx;
      m.mesh.position.z = nz;
      m.shadow.position.x = nx;
      m.shadow.position.z = nz;
    }

    // 색상 표시: 추적 상태면 붉게 → 배회 상태면 어둡게
    if (m.state === 'chase') m.body.color.setHex(0xff3d5d);
    else m.body.color.setHex(0xa14545);

    // 플레이어 충돌
    if (dPlayer < m.radius + player.radius && now - m.lastHitOnPlayer > MOB_HIT_COOLDOWN && now > player.invulnUntil) {
      m.lastHitOnPlayer = now;
      damagePlayer(DAMAGE_PER_HIT);
      player.invulnUntil = now + 400;
    }
  }
}

function damagePlayer(amount) {
  player.hp = Math.max(0, player.hp - amount);
  updateHud();
  if (player.hp <= 0) {
    running = false;
    deadOverlay.classList.remove('hidden');
  }
}

// 카메라: 플레이어를 부드럽게 추적 + 우클릭 홀드로 요우(yaw) 회전
const camState = {
  yaw: 0,          // 좌우 회전 각도 (radians)
  radiusXZ: 22,    // 플레이어와의 수평 거리
  height: 30,      // 카메라 높이(고정)
  rotating: false, // 우클릭 홀드 중인가
  lastX: 0,
  sensitivity: 0.008,
};

// 우클릭 컨텍스트 메뉴 억제
const canvasEl = renderer.domElement;
canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

canvasEl.addEventListener('mousedown', (e) => {
  if (e.button === 2) { // 우클릭
    camState.rotating = true;
    camState.lastX = e.clientX;
    e.preventDefault();
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 2) camState.rotating = false;
});
window.addEventListener('mousemove', (e) => {
  if (!camState.rotating) return;
  const dx = e.clientX - camState.lastX;
  camState.lastX = e.clientX;
  camState.yaw -= dx * camState.sensitivity; // 오른쪽 드래그 → 시점이 우측으로 회전
});
// 마우스가 창 밖으로 나가면 회전 해제
window.addEventListener('blur', () => { camState.rotating = false; });

function updateCamera(dt) {
  const targetX = player.position.x + camState.radiusXZ * Math.sin(camState.yaw);
  const targetZ = player.position.z + camState.radiusXZ * Math.cos(camState.yaw);
  const lerp = 1 - Math.pow(0.001, dt);
  camera.position.x += (targetX - camera.position.x) * lerp;
  camera.position.z += (targetZ - camera.position.z) * lerp;
  camera.position.y = camState.height;
  camera.lookAt(player.position.x, 0, player.position.z);
}

requestAnimationFrame(loop);
