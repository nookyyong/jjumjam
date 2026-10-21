/* =============================================
   gameLogic.js — 끝없는 계단 (점프 방식 프로토타입)
   ============================================= */

'use strict';

/* ─── 캐릭터 ─── */
// 4방향 이미지를 반전 없이 그대로 사용 (16×24 픽셀아트)
// 파일: images/{key}_right_stand.png / _left_stand.png / _right_jump.png / _left_jump.png
// - stand: 떨어지는 동안 표시 / jump: 위로 튀어오르는 동안 표시
// - 이미지가 없으면 색상 박스로 표시
const CHARACTERS = [
  { id: 'c1', key: 'char1', name: '캐릭터1', color: '#f0b97a' },
  { id: 'c2', key: 'char2', name: '캐릭터2', color: '#f08aad' },
  { id: 'c3', key: 'char3', name: '캐릭터3', color: '#b08af0' },
  { id: 'c4', key: 'char4', name: '캐릭터4', color: '#7ad4b0' },
  { id: 'c5', key: 'char5', name: '캐릭터5', color: '#7ac4f0' },
];

const SPRITE_POSES = ['right_stand', 'left_stand', 'right_jump', 'left_jump'];
const spritePath = (ch, pose) => `images/${ch.key}_${pose}.png`;

/* ─── 게임 설정 ─── */
const CONFIG = {
  // 규칙
  GOAL_STAIRS: 4800,     // 원작 계단 수
  GOAL_FLOOR: 180,       // 원작 층수 (계단 수를 환산해서 표시)
  PX_PER_STAIR: 5,       // 높이 5px = 1계단 → 꼭대기 높이 24000px (클수록 꼭대기가 멀어짐)

  // 화면 (게임 영역은 가로 400 고정, 화면에 맞게 확대/축소)
  GAME_W: 400,
  MIN_VIEW_H: 640,       // PC에서 최소 이만큼의 높이가 보이도록 축소
  CAM_PLAYER_Y: 0.45,    // 캐릭터가 화면 아래에서 45% 위치를 넘으면 카메라가 따라 올라감

  // 물리 (단위: px, 초)
  // 점프 높이 = JUMP_V² / (2 × GRAVITY). 속도만 바꿀 땐 높이가 유지되도록 둘을 같이 조정
  // (일반 점프 높이는 GAP_MAX 최대값 140보다 커야 항상 올라갈 수 있음)
  GRAVITY: 1200,
  JUMP_V: 670,           // 일반 점프 → 최고 높이 약 187px, 체공 약 1.1초
  SPRING_V: 1100,        // 스프링 점프 → 최고 높이 약 504px
  MOVE_SPEED: 250,       // 좌우 최고 속도
  MOVE_ACCEL: 10,        // 클수록 좌우 반응이 즉각적

  // 계단(발판)
  PLAT_W: 72,
  PLAT_H: 12,
  // 높이가 올라갈수록 시작값 → 끝값으로 변화 (꼭대기 기준)
  GAP_MIN: [30, 65],     // 계단 사이 세로 간격 최소
  GAP_MAX: [90, 140],    // 계단 사이 세로 간격 최대 (일반 점프 높이 187 미만 유지)
  MOVING_CHANCE: [0.03, 0.20],
  CRUMBLE_CHANCE: [0.05, 0.20],
  // 다음 계단까지 좌우 거리 제한: 간격이 좁을 땐 넓게, 간격이 넓을 땐 가깝게
  // (높이 올라가야 하는 만큼 좌우로 이동할 시간이 줄어들기 때문)
  // 다음 계단까지 좌우 거리: 그 높이까지 뛰는 동안 좌우로 풀이동했을 때 갈 수 있는 거리 기준
  // (위로 많이 올라가야 할수록 체공 시간이 줄어서 좌우 거리도 줄어듦)
  REACH_MARGIN: 0.9,     // 풀이동 거리의 몇 %까지 쓸지 (1에 가까울수록 어려움)
  REACH_BONUS: 30,       // 계단/캐릭터 너비 덕분에 추가로 닿는 거리(px)
  SPRING_CHANCE: 0.10,
  MOVING_SPEED: [50, 120],
  SPRING_W: 18,

  // 캐릭터
  CHAR_W: 38,            // 16×24 이미지의 약 2.4배
  CHAR_H: 57,
  HITBOX_W: 28,          // 발판 판정 너비

  // 안내
  TOAST_FLOOR_STEP: 30,  // 몇 층마다 통과 안내를 띄울지
  TOAST_MS: 2500,

  // 꼭대기 문 (닿으면 결과 표시)
  DOOR_W: 40,
  DOOR_H: 64,
  DOOR_IMG: 'images/door.png',  // 없으면 기본 문 모양으로 그림
  EXIT_FADE_MS: 250,     // 문으로 들어갈 때 캐릭터 하나가 사라지는 시간
  FOLLOW_DELAY_MS: 110,  // 따라오는 캐릭터 간 지연

  // 바다
  OCEAN_H: 50,
};

const GOAL_Y = CONFIG.GOAL_STAIRS * CONFIG.PX_PER_STAIR;

/* ─── 개발용 테스트 옵션 ─── */
// 로컬(Live Server 등)에서만 동작. GitHub Pages 배포 주소에서는 무시됨
//   ?start=4750   → 4750계단 높이에서 시작
//   ?god=1        → 바다에 빠지면 죽지 않고 튀어오름
//   예) http://127.0.0.1:5500/index.html?start=4750&god=1
const DEV = (() => {
  const local = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  const q = new URLSearchParams(location.search);
  const start = Math.min(CONFIG.GOAL_STAIRS - 10, Math.max(0, parseInt(q.get('start'), 10) || 0));
  return {
    on: local,
    startStairs: local ? start : 0,
    god: local && q.get('god') === '1',
  };
})();
if (DEV.on && (DEV.startStairs || DEV.god)) {
  console.log(`[DEV] 시작 ${DEV.startStairs}계단, 무적 ${DEV.god ? 'ON' : 'OFF'}`);
}

const STORAGE_KEYS = {
  nickname: 'stairs_nickname',
  char: 'stairs_char',
  tag: 'stairs_tag',
  best: 'stairs_best_jump',  // { stairs, timeMs }
};

/* ─── 저장소 (localStorage 실패해도 게임은 동작) ─── */
const storage = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* 무시 */
    }
  },
};

/* ─── 이미지 로드 ─── */
function loadImage(src) {
  const holder = { el: null, ok: false };
  if (!src) return holder;
  const img = new Image();
  img.onload = () => { holder.ok = true; };
  img.src = src;
  holder.el = img;
  return holder;
}

const doorImage = loadImage(CONFIG.DOOR_IMG);

CHARACTERS.forEach(ch => {
  ch.sprites = {};
  SPRITE_POSES.forEach(pose => { ch.sprites[pose] = loadImage(spritePath(ch, pose)); });
});

/* ─── 게임 상태 ─── */
const state = {
  phase: 'title',        // title | playing | over
  platforms: [],
  genTopY: 0,            // 가장 위에 생성된 계단 높이
  genLastX: 0,           // 마지막으로 생성된 계단의 중심 x
  player: null,
  history: [],           // { t, x, y, dir, rising } — 따라오는 캐릭터가 지연 재생
  followers: [],
  camBottom: 0,          // 화면 맨 아래의 월드 높이
  elapsed: 0,            // 경과 시간(ms)
  now: 0,
  lastTs: null,
  keys: { left: false, right: false },
  selectedChar: CHARACTERS[0].id,
  hudCache: {},
  toastsShown: {},
  summit: false,         // 꼭대기 계단 도착 (문까지 자유 이동)
  summitTimeMs: 0,       // 꼭대기 도착 시간 = 기록
  door: null,            // { x, y } 꼭대기 문
  exiting: false,        // 문에 들어가는 중
  exitT: 0,              // 메인캐릭터가 문에 닿은 시각
  cleared: false,        // 문 통과 (결과 표시)
};

/* ─── DOM 참조 ─── */
const gameWrapper    = document.getElementById('gameWrapper');
const canvas         = document.getElementById('gameCanvas');
const ctx            = canvas.getContext('2d');
const oceanEl        = document.getElementById('ocean');
const hudEl          = document.getElementById('hud');
const floorDisplay   = document.getElementById('floorDisplay');
const stairsDisplay  = document.getElementById('stairsDisplay');
const timeDisplay    = document.getElementById('timeDisplay');
const toastEl        = document.getElementById('toast');
const touchControls  = document.getElementById('touchControls');
const touchLeft      = document.getElementById('touchLeft');
const touchRight     = document.getElementById('touchRight');
const startScreen    = document.getElementById('startScreen');
const nicknameInput  = document.getElementById('nicknameInput');
const playerTagEl    = document.getElementById('playerTag');
const charGrid       = document.getElementById('charGrid');
const startError     = document.getElementById('startError');
const startBtn       = document.getElementById('startBtn');
const gameoverScreen = document.getElementById('gameoverScreen');
const gameoverTitle  = document.getElementById('gameoverTitle');
const gameoverSub    = document.getElementById('gameoverSub');
const finalFloor     = document.getElementById('finalFloor');
const finalStairs    = document.getElementById('finalStairs');
const finalBest      = document.getElementById('finalBest');
const restartBtn     = document.getElementById('restartBtn');
const titleBtn       = document.getElementById('titleBtn');

/* ─── 유틸 ─── */
const rand = (min, max) => Math.random() * (max - min) + min;
const lerp = (range, t) => range[0] + (range[1] - range[0]) * t;

function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

function stairsOf(y) {
  return Math.min(CONFIG.GOAL_STAIRS, Math.max(0, Math.floor(y / CONFIG.PX_PER_STAIR)));
}

/** 계단 수 → 원작 층수 환산 (0계단 = 1층, 4800계단 = 180층) */
function floorOf(stairs) {
  return Math.max(1, Math.ceil(stairs * CONFIG.GOAL_FLOOR / CONFIG.GOAL_STAIRS));
}

function formatClock(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatRecord(ms) {
  const t = Math.floor(ms / 100);
  const s = Math.floor(t / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${t % 10}`;
}

/**
 * 기록 비교 (랭킹 정렬과 동일 기준)
 * 1) 오른 계단 수 많은 순  2) 같으면 걸린 시간 짧은 순
 */
function isBetter(a, b) {
  if (!b) return true;
  if (a.stairs !== b.stairs) return a.stairs > b.stairs;
  return a.timeMs < b.timeMs;
}

function formatResult(r) {
  return r.stairs >= CONFIG.GOAL_STAIRS ? formatRecord(r.timeMs) : `${r.stairs.toLocaleString()}계단`;
}

/** 브라우저별 랭킹 구분용 4자리 태그 (개인정보 없이 동명이인 구분) */
function getPlayerTag() {
  let tag = storage.get(STORAGE_KEYS.tag, '');
  if (!/^\d{4}$/.test(tag)) {
    tag = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    storage.set(STORAGE_KEYS.tag, tag);
  }
  return tag;
}

function loadBest() {
  try {
    const b = JSON.parse(storage.get(STORAGE_KEYS.best, 'null'));
    return b && Number.isFinite(b.stairs) && Number.isFinite(b.timeMs) ? b : null;
  } catch {
    return null;
  }
}

/* ─── 캔버스 크기 ─── */
let dpr = 1;
let viewW = 0;
let viewH = 0;
let scale = 1;      // 게임 좌표 → 화면 px
let offX = 0;       // 게임 영역 왼쪽 여백(화면 px)
let viewLH = 0;     // 화면에 보이는 게임 좌표 높이

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewW = gameWrapper.clientWidth;
  viewH = gameWrapper.clientHeight;
  canvas.width  = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);

  scale = Math.min(viewW / CONFIG.GAME_W, viewH / CONFIG.MIN_VIEW_H);
  offX = (viewW - CONFIG.GAME_W * scale) / 2;
  viewLH = viewH / scale;
}

/** 월드 높이 → 게임 영역 내 y (아래가 +) */
function toLY(wy) {
  return viewLH - (wy - state.camBottom);
}

/* ─── 계단 생성 ─── */
/**
 * 세로로 gap만큼 위에 있는 계단에 내려앉을 때까지 좌우로 풀이동하면 갈 수 있는 거리
 * (정지 상태에서 출발 가정, 게임과 같은 물리로 계산)
 */
const travelCache = new Map();
function maxTravelX(gap) {
  const key = Math.round(gap);
  if (travelCache.has(key)) return travelCache.get(key);

  const dt = 1 / 60;
  let x = 0, vx = 0, y = 0, vy = CONFIG.JUMP_V, result = 0;
  for (let i = 0; i < 600; i++) {
    vx += (CONFIG.MOVE_SPEED - vx) * Math.min(1, CONFIG.MOVE_ACCEL * dt);
    vy -= CONFIG.GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;
    if (vy < 0 && y <= key) { result = x; break; }
  }
  travelCache.set(key, result);
  return result;
}

/** 이전 계단 기준으로 도달 가능한 범위 안에 다음 계단 x 결정 */
function nextPlatformX(gap) {
  const W = CONFIG.GAME_W;
  const reach = maxTravelX(gap) * CONFIG.REACH_MARGIN + CONFIG.REACH_BONUS;

  // 화면 안에서만, 이전 계단 기준 reach 범위 안에서 고름
  const half = CONFIG.PLAT_W / 2;
  const lo = Math.max(half, state.genLastX - reach);
  const hi = Math.min(W - half, state.genLastX + reach);
  const cx = rand(lo, hi);
  state.genLastX = cx;
  return cx - half;
}

function makePlatform(y, t, gap) {
  const r = Math.random();
  const movingP = lerp(CONFIG.MOVING_CHANCE, t);
  const crumbleP = lerp(CONFIG.CRUMBLE_CHANCE, t);

  let type = 'normal';
  if (r < crumbleP) type = 'crumble';
  else if (r < crumbleP + movingP) type = 'moving';

  const plat = {
    x: nextPlatformX(gap),
    y,
    w: CONFIG.PLAT_W,
    type,
    vx: 0,
    spring: null,
    crumbling: false,
    fallV: 0,
    alpha: 1,
  };

  if (type === 'moving') {
    plat.vx = rand(CONFIG.MOVING_SPEED[0], CONFIG.MOVING_SPEED[1]) * (Math.random() < 0.5 ? -1 : 1);
  }
  if (type !== 'crumble' && Math.random() < CONFIG.SPRING_CHANCE) {
    plat.spring = { ox: rand(4, CONFIG.PLAT_W - CONFIG.SPRING_W - 4), usedT: -1e9 };
  }
  return plat;
}

function generatePlatforms() {
  const limit = state.camBottom + viewLH + 300;
  while (state.genTopY < limit && state.genTopY < GOAL_Y) {
    const t = Math.min(1, state.genTopY / GOAL_Y);
    const gap = rand(lerp(CONFIG.GAP_MIN, t), lerp(CONFIG.GAP_MAX, t));
    const y = state.genTopY + gap;

    if (y >= GOAL_Y - 40) {
      // 꼭대기: 가로 전체 금색 계단
      state.platforms.push({
        x: 0, y: GOAL_Y, w: CONFIG.GAME_W, type: 'goal',
        // 문 위치: 마지막 계단 반대쪽 끝 근처
        doorX: state.genLastX < CONFIG.GAME_W / 2 ? CONFIG.GAME_W - 30 - CONFIG.DOOR_W : 30,
        vx: 0, spring: null, crumbling: false, fallV: 0, alpha: 1,
      });
      state.genTopY = GOAL_Y;
      break;
    }

    state.platforms.push(makePlatform(y, t, gap));
    state.genTopY = y;
  }
}

/* ─── 게임 초기화 ─── */
function resetGame() {
  // 시작 높이 (개발용 ?start= 옵션이 없으면 0)
  const startY = DEV.startStairs * CONFIG.PX_PER_STAIR;

  // 시작 바닥 (가로 전체)
  state.platforms = [{
    x: 0, y: startY, w: CONFIG.GAME_W, type: 'floor',
    vx: 0, spring: null, crumbling: false, fallV: 0, alpha: 1,
  }];
  state.genTopY = startY;
  state.genLastX = CONFIG.GAME_W / 2;
  state.camBottom = startY - CONFIG.OCEAN_H - 20;

  state.player = {
    x: CONFIG.GAME_W / 2,
    y: startY,
    vx: 0,
    vy: CONFIG.JUMP_V,
    dir: 1,
    maxY: startY,
  };
  state.history = [];
  state.followers = CHARACTERS
    .filter(c => c.id !== state.selectedChar)
    .map(ch => ({ ch }));

  state.elapsed = 0;
  state.keys.left = false;
  state.keys.right = false;
  state.hudCache = {};
  state.toastsShown = {};
  state.summit = false;
  state.summitTimeMs = 0;
  state.door = null;
  state.exiting = false;
  state.exitT = 0;
  state.cleared = false;
  generatePlatforms();
  updateHUD();
}

/* ─── 충돌 ─── */
function overlapsX(px, x1, x2) {
  const hw = CONFIG.HITBOX_W / 2;
  return px + hw > x1 && px - hw < x2;
}

function land(plat) {
  const p = state.player;
  p.y = plat.y;

  if (plat.spring && overlapsX(p.x, plat.x + plat.spring.ox, plat.x + plat.spring.ox + CONFIG.SPRING_W)) {
    p.vy = CONFIG.SPRING_V;
    plat.spring.usedT = state.now;
  } else {
    p.vy = CONFIG.JUMP_V;
  }

  if (plat.type === 'crumble') plat.crumbling = true;
  if (plat.type === 'goal' && state.phase === 'playing' && !state.summit) {
    reachSummit(plat);
  }
}

/* ─── 업데이트 ─── */
function update(dt) {
  const p = state.player;
  const W = CONFIG.GAME_W;

  // 문으로 들어가는 중: 움직임 정지, 마지막 캐릭터까지 사라지면 결과 표시
  if (state.exiting) {
    const doneT = state.exitT + state.followers.length * CONFIG.FOLLOW_DELAY_MS + CONFIG.EXIT_FADE_MS + 300;
    if (state.phase === 'playing' && state.now >= doneT) endGame('clear');
    updateHUD();
    return;
  }

  if (state.phase === 'playing' && !state.summit) state.elapsed += dt * 1000;

  // 좌우 이동 (게임 중에만 입력 반영)
  const input = state.phase === 'playing' ? (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0) : 0;
  p.vx += (input * CONFIG.MOVE_SPEED - p.vx) * Math.min(1, CONFIG.MOVE_ACCEL * dt);
  if (input !== 0) p.dir = input;

  // 중력 + 이동
  const prevY = p.y;
  p.vy -= CONFIG.GRAVITY * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  // 화면 양 끝은 벽
  const halfW = CONFIG.CHAR_W / 2;
  if (p.x < halfW) { p.x = halfW; p.vx = Math.max(0, p.vx); }
  if (p.x > W - halfW) { p.x = W - halfW; p.vx = Math.min(0, p.vx); }

  // 계단 움직임 / 무너짐
  for (const plat of state.platforms) {
    if (plat.type === 'moving' && !plat.crumbling) {
      plat.x += plat.vx * dt;
      if (plat.x < 0) { plat.x = 0; plat.vx *= -1; }
      if (plat.x > W - plat.w) { plat.x = W - plat.w; plat.vx *= -1; }
    }
    if (plat.crumbling) {
      plat.fallV += CONFIG.GRAVITY * dt;
      plat.y -= plat.fallV * dt;
      plat.alpha = Math.max(0, plat.alpha - dt * 2.5);
    }
  }

  // 착지 (떨어지는 중에만)
  // 게임 중이거나, 꼭대기 도착 후(계속 튕김)에만 착지. 바다에 빠진 뒤에는 착지 안 함
  if (p.vy < 0 && (state.phase === 'playing' || state.cleared)) {
    for (const plat of state.platforms) {
      if (plat.crumbling) continue;
      if (prevY >= plat.y && p.y <= plat.y && overlapsX(p.x, plat.x, plat.x + plat.w)) {
        land(plat);
        break;
      }
    }
  }

  // 기록 / 카메라
  p.maxY = Math.max(p.maxY, p.y);
  state.camBottom = Math.max(state.camBottom, p.y - viewLH * CONFIG.CAM_PLAYER_Y);

  // 바다에 빠짐
  if (state.phase === 'playing' && p.y < state.camBottom + CONFIG.OCEAN_H - CONFIG.CHAR_H) {
    if (DEV.god) p.vy = CONFIG.SPRING_V;  // 개발용 무적: 바다에서 튀어오름
    else endGame('fall');
  }

  // 꼭대기: 문에 닿으면 결과 표시
  if (state.summit && state.phase === 'playing') checkDoor();

  // 층 안내 (30층마다)
  if (state.phase === 'playing') {
    const floor = floorOf(stairsOf(p.maxY));
    if (floor % CONFIG.TOAST_FLOOR_STEP === 0 && floor < CONFIG.GOAL_FLOOR && !state.toastsShown[floor]) {
      state.toastsShown[floor] = true;
      showToast(`${floor}층 통과`, CONFIG.TOAST_MS);
    }
  }

  // 따라오는 캐릭터용 이동 기록
  state.history.push({ t: state.now, x: p.x, y: p.y, dir: p.dir, rising: p.vy > 0 });
  const keepFrom = state.now - (state.followers.length + 1) * CONFIG.FOLLOW_DELAY_MS - 200;
  while (state.history.length > 2 && state.history[1].t < keepFrom) state.history.shift();

  // 지나간 계단 정리 + 새 계단 생성
  const cutoff = state.camBottom - 200;
  state.platforms = state.platforms.filter(pl => pl.y > cutoff && pl.alpha > 0);
  generatePlatforms();

  updateHUD();
}

/* ─── 렌더 ─── */
function mixColor(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

function fillRoundRect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

function drawBackground() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 꼭대기에 가까워질수록 조금씩 밝아짐
  const t = Math.min(1, state.camBottom / GOAL_Y);
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, mixColor([6, 14, 30], [44, 78, 118], t));
  grad.addColorStop(1, mixColor([1, 3, 8], [12, 28, 52], t));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);

  // 게임 영역 바깥 (PC 넓은 화면)
  if (offX > 1) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, offX, viewH);
    ctx.fillRect(viewW - offX, 0, offX, viewH);
    ctx.fillStyle = 'rgba(120, 150, 210, 0.15)';
    ctx.fillRect(offX - 1, 0, 1, viewH);
    ctx.fillRect(viewW - offX, 0, 1, viewH);
  }
}

function drawFloorMarks() {
  // 10층마다 벽에 층 표시
  ctx.font = '700 11px "Space Mono", monospace';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';

  const stairsPerFloor = CONFIG.GOAL_STAIRS / CONFIG.GOAL_FLOOR;
  const fromF = Math.max(10, Math.floor(floorOf(stairsOf(state.camBottom)) / 10) * 10);
  for (let f = fromF; f <= CONFIG.GOAL_FLOOR; f += 10) {
    const wy = (f - 1) * stairsPerFloor * CONFIG.PX_PER_STAIR;
    const ly = toLY(wy);
    if (ly < -20) break;
    if (ly > viewLH + 20) continue;

    ctx.fillStyle = 'rgba(200, 220, 255, 0.08)';
    ctx.fillRect(0, ly, CONFIG.GAME_W, 1);
    ctx.fillStyle = 'rgba(200, 220, 255, 0.35)';
    ctx.fillText(`${f}F`, 6, ly - 3);
  }
}

const PLAT_COLORS = {
  floor:   ['#1c2230', '#3a4356'],
  normal:  ['#262d3c', '#4a5468'],
  moving:  ['#1f3346', '#4f7ea3'],
  crumble: ['#3a2c22', '#7a5a40'],
  goal:    ['#5a4a1c', '#f5c842'],
};

/** 꼭대기 문 (images/door.png 있으면 그 이미지, 없으면 기본 모양) */
function drawDoor(x, groundLY) {
  const w = CONFIG.DOOR_W;
  const h = CONFIG.DOOR_H;
  const top = groundLY - h;

  ctx.save();
  if (doorImage.ok) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(doorImage.el, x, top, w, h);
    ctx.restore();
    return;
  }

  // 새어 나오는 빛
  const pulse = 0.6 + 0.4 * Math.sin(state.now / 400);
  const glow = ctx.createRadialGradient(x + w / 2, top + h / 2, 4, x + w / 2, top + h / 2, h);
  glow.addColorStop(0, `rgba(255, 220, 140, ${0.35 * pulse})`);
  glow.addColorStop(1, 'rgba(255, 220, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - h, top - h / 2, w + h * 2, h * 2);

  // 문틀 + 문
  ctx.fillStyle = '#3a2c22';
  ctx.fillRect(x - 4, top - 4, w + 8, h + 4);
  ctx.fillStyle = '#fff2c8';
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = '#7a5a40';
  ctx.fillRect(x + 3, top + 3, w - 10, h - 3);
  ctx.fillStyle = '#f5c842';
  ctx.fillRect(x + w - 14, top + h / 2, 4, 4);
  ctx.restore();
}

function drawPlatforms() {
  for (const plat of state.platforms) {
    const ly = toLY(plat.y);
    if (ly < -30 || ly > viewLH + 30) continue;

    const [body, top] = PLAT_COLORS[plat.type];
    ctx.globalAlpha = plat.alpha;
    ctx.fillStyle = body;
    ctx.fillRect(plat.x, ly, plat.w, CONFIG.PLAT_H);
    ctx.fillStyle = top;
    ctx.fillRect(plat.x, ly, plat.w, 3);

    // 무너지는 계단: 금
    if (plat.type === 'crumble') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const cx = plat.x + plat.w * 0.45;
      ctx.moveTo(cx, ly + 3);
      ctx.lineTo(cx + 5, ly + 7);
      ctx.lineTo(cx - 2, ly + CONFIG.PLAT_H);
      ctx.moveTo(plat.x + plat.w * 0.75, ly + 3);
      ctx.lineTo(plat.x + plat.w * 0.7, ly + CONFIG.PLAT_H);
      ctx.stroke();
    }

    // 스프링
    if (plat.spring) {
      const used = state.now - plat.spring.usedT < 180;
      const sh = used ? 14 : 8;
      const sx = plat.x + plat.spring.ox;
      ctx.fillStyle = '#c9d4e8';
      ctx.fillRect(sx, ly - sh, CONFIG.SPRING_W, 3);
      ctx.strokeStyle = '#8a97b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 3, ly);
      ctx.lineTo(sx + CONFIG.SPRING_W - 3, ly - sh * 0.33);
      ctx.lineTo(sx + 3, ly - sh * 0.66);
      ctx.lineTo(sx + CONFIG.SPRING_W - 3, ly - sh);
      ctx.stroke();
    }

    if (plat.type === 'goal') {
      ctx.fillStyle = '#f5c842';
      ctx.font = '900 13px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${CONFIG.GOAL_FLOOR}층 · 꼭대기`, CONFIG.GAME_W / 2, ly + CONFIG.PLAT_H + 8);
      drawDoor(plat.doorX, ly);
    }
  }
  ctx.globalAlpha = 1;
}

function drawCharacterAt(ch, lx, ly, dir, rising, vanish = 0) {
  const w = CONFIG.CHAR_W;
  const h = CONFIG.CHAR_H;
  const pose = `${dir < 0 ? 'left' : 'right'}_${rising ? 'jump' : 'stand'}`;
  const holder = ch.sprites[pose];

  ctx.save();
  ctx.translate(lx, ly);
  if (vanish > 0) {
    // 문으로 빨려 들어가듯 작아지면서 사라짐
    ctx.globalAlpha = 1 - vanish;
    ctx.translate(0, -h / 2);
    ctx.scale(1 - vanish * 0.6, 1 - vanish * 0.6);
    ctx.translate(0, h / 2);
  }

  if (holder.ok) {
    ctx.imageSmoothingEnabled = false; // 픽셀아트 선명하게
    ctx.drawImage(holder.el, -w / 2, -h, w, h);
    ctx.restore();
    return;
  }

  // 이미지 없을 때 폴백
  ctx.fillStyle = ch.color;
  fillRoundRect(-w / 2 + 4, -h + 6, w - 8, h - 6, 10);
  ctx.fillStyle = '#0d1117';
  ctx.beginPath();
  ctx.arc(dir * 8, -h + 22, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(13, 17, 23, 0.75)';
  ctx.font = '900 13px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(ch.name.charAt(0), 0, -12);
  ctx.restore();
}

function drawCharacter(ch, wx, wy, dir, rising, vanish = 0) {
  if (vanish >= 1) return;
  drawCharacterAt(ch, wx, toLY(wy), dir, rising, vanish);
}

/** 문 통과 후 k번째 캐릭터(0 = 메인)가 사라진 정도 0~1 */
function vanishOf(k) {
  if (!state.exiting) return 0;
  const t = state.now - (state.exitT + k * CONFIG.FOLLOW_DELAY_MS);
  return Math.min(1, Math.max(0, t / CONFIG.EXIT_FADE_MS));
}

function sampleHistory(t) {
  const h = state.history;
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i].t <= t) return h[i];
  }
  return h[0];
}

function drawCharacters() {
  const p = state.player;

  // 따라오는 캐릭터: 메인캐릭터 궤적을 시간차로 재생 (멀리 있는 캐릭터부터)
  for (let k = state.followers.length; k >= 1; k--) {
    const ch = state.followers[k - 1].ch;
    if (state.history.length) {
      const s = sampleHistory(state.now - k * CONFIG.FOLLOW_DELAY_MS);
      drawCharacter(ch, s.x, s.y, s.dir, s.rising, vanishOf(k));
    } else {
      // 시작 전: 메인캐릭터 뒤에 겹쳐서 서 있음
      drawCharacter(ch, p.x - p.dir * k * 8, p.y, p.dir, false);
    }
  }

  const rising = state.phase !== 'title' && p.vy > 0;
  drawCharacter(getCharacter(state.selectedChar), p.x, p.y, p.dir, rising, vanishOf(0));
}

function render() {
  drawBackground();

  // 게임 영역 좌표계로 전환 + 영역 밖은 잘라냄
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CONFIG.GAME_W, viewLH);
  ctx.clip();

  drawFloorMarks();
  drawPlatforms();
  drawCharacters();

  ctx.restore();
  oceanEl.style.height = `${CONFIG.OCEAN_H * scale}px`;
}

/* ─── 메인 루프 (타이틀 화면에서도 배경으로 계속 그림) ─── */
function loop(ts) {
  if (state.lastTs === null) state.lastTs = ts;
  const dtMs = Math.min(33, ts - state.lastTs);
  state.lastTs = ts;
  state.now += dtMs;

  // 설정 화면에서는 멈춘 상태로 그리기만 함 (게임 시작 버튼을 눌러야 움직임)
  if (state.phase !== 'title') update(dtMs / 1000);
  render();
  requestAnimationFrame(loop);
}

/* ─── HUD ─── */
function setText(el, key, value) {
  if (state.hudCache[key] === value) return;
  state.hudCache[key] = value;
  el.textContent = value;
}

function updateHUD() {
  const s = stairsOf(state.player.maxY);
  setText(floorDisplay, 'floor', `${floorOf(s)}층`);
  setText(stairsDisplay, 'stairs', `${s}/${CONFIG.GOAL_STAIRS}`);
  setText(timeDisplay, 'time', formatClock(state.elapsed));
}

let toastTimer = null;
function showToast(text, duration = 1800) {
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), duration);
}

/* ─── 게임 흐름 ─── */
function startGame() {
  resetGame();
  state.phase = 'playing';
  startScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  hudEl.classList.remove('hidden');
  touchControls.classList.remove('hidden');
}

/* ─── 꼭대기 ─── */
function reachSummit(plat) {
  state.summit = true;
  state.summitTimeMs = Math.round(state.elapsed);
  state.door = { x: plat.doorX, y: plat.y };
  showToast('꼭대기 도착! 문으로 가자', CONFIG.TOAST_MS);
}

function checkDoor() {
  const p = state.player;
  const d = state.door;
  const hw = CONFIG.HITBOX_W / 2;
  const inX = p.x + hw > d.x && p.x - hw < d.x + CONFIG.DOOR_W;
  const inY = p.y < d.y + CONFIG.DOOR_H;
  if (inX && inY) {
    // 메인캐릭터부터 문으로 들어감 → 따라오는 캐릭터는 같은 지점에 도착하는 순서대로 사라짐
    state.exiting = true;
    state.exitT = state.now;
    state.cleared = true;
    state.keys.left = false;
    state.keys.right = false;
    touchControls.classList.add('hidden');
  }
}

function endGame(reason) {
  if (state.phase !== 'playing') return;
  state.phase = 'over';
  state.keys.left = false;
  state.keys.right = false;
  touchControls.classList.add('hidden');

  const cleared = reason === 'clear';
  const result = {
    stairs: cleared ? CONFIG.GOAL_STAIRS : stairsOf(state.player.maxY),
    timeMs: cleared ? state.summitTimeMs : Math.round(state.elapsed),  // 기록은 꼭대기 도착 시점
  };

  const prevBest = loadBest();
  const isNewBest = isBetter(result, prevBest);
  const best = isNewBest ? result : prevBest;
  if (isNewBest) storage.set(STORAGE_KEYS.best, JSON.stringify(result));

  if (cleared) {
    gameoverTitle.textContent = '꼭대기 도착';
    gameoverSub.textContent = `기록 ${formatRecord(result.timeMs)}${isNewBest ? ' · 최고 기록!' : ''}`;
  } else {
    gameoverTitle.textContent = '바다에 빠졌다';
    gameoverSub.textContent = `${formatClock(result.timeMs)} 동안 버텼다.${isNewBest ? ' · 최고 기록!' : ''}`;
  }
  finalFloor.textContent = `${floorOf(result.stairs)}층`;
  finalStairs.textContent = result.stairs.toLocaleString();
  finalBest.textContent = formatResult(best);

  // [DB] 2차 작업: 여기서 랭킹 등록 (닉네임#태그, 캐릭터, stairs, timeMs)
  //      정렬: stairs DESC, time_ms ASC

  // 문 통과 → 결과 표시 (엔딩 연출은 나중에 여기에)
  setTimeout(() => gameoverScreen.classList.remove('hidden'), cleared ? 200 : 600);
}

function goToTitle() {
  state.phase = 'title';
  resetGame();
  gameoverScreen.classList.add('hidden');
  hudEl.classList.add('hidden');
  touchControls.classList.add('hidden');
  startScreen.classList.remove('hidden');
}

/* ─── 설정 화면 ─── */
function buildCharGrid() {
  charGrid.innerHTML = '';
  CHARACTERS.forEach(ch => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'char_card';
    btn.dataset.id = ch.id;

    const thumb = document.createElement('span');
    thumb.className = 'char_thumb';
    thumb.style.setProperty('--char_color', ch.color);
    thumb.textContent = ch.name.charAt(0);

    const img = document.createElement('img');
    img.alt = '';
    img.onload = () => thumb.classList.add('has_img');
    img.onerror = () => img.remove();
    img.src = spritePath(ch, 'right_stand');
    thumb.appendChild(img);

    const name = document.createElement('span');
    name.className = 'char_name';
    name.textContent = ch.name;

    btn.append(thumb, name);
    btn.addEventListener('click', () => selectCharacter(ch.id));
    charGrid.appendChild(btn);
  });
}

function selectCharacter(id) {
  state.selectedChar = getCharacter(id).id;
  charGrid.querySelectorAll('.char_card').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === state.selectedChar);
  });
  resetGame(); // 타이틀 배경에도 선택한 캐릭터 반영
}

function handleStart() {
  const nickname = nicknameInput.value.trim();
  if (nickname.length < 1 || nickname.length > 12) {
    startError.textContent = '닉네임은 1~12자로 입력해주세요.';
    return;
  }
  if (nickname.includes('#')) {
    startError.textContent = '닉네임에 # 은 사용할 수 없어요.';
    return;
  }
  startError.textContent = '';
  storage.set(STORAGE_KEYS.nickname, nickname);
  storage.set(STORAGE_KEYS.char, state.selectedChar);
  nicknameInput.blur();
  startGame();
}

/* ─── 이벤트 바인딩 ─── */
startBtn.addEventListener('click', handleStart);
restartBtn.addEventListener('click', startGame);
titleBtn.addEventListener('click', goToTitle);

nicknameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleStart();
});

// 키보드: ← / → (또는 A / D) 누르고 있는 동안 이동
const KEY_MAP = { ArrowLeft: 'left', ArrowRight: 'right', a: 'left', d: 'right', A: 'left', D: 'right' };

document.addEventListener('keydown', e => {
  if (state.phase !== 'playing') return;
  const k = KEY_MAP[e.key];
  if (!k) return;
  e.preventDefault();
  state.keys[k] = true;
});

document.addEventListener('keyup', e => {
  const k = KEY_MAP[e.key];
  if (k) state.keys[k] = false;
});

window.addEventListener('blur', () => {
  state.keys.left = false;
  state.keys.right = false;
});

// 터치: 화면 왼쪽 / 오른쪽 누르고 있는 동안 이동
function bindTouch(btn, key) {
  const on = e => { e.preventDefault(); state.keys[key] = true; };
  const off = () => { state.keys[key] = false; };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointercancel', off);
  btn.addEventListener('pointerleave', off);
  btn.addEventListener('contextmenu', e => e.preventDefault());
}
bindTouch(touchLeft, 'left');
bindTouch(touchRight, 'right');

window.addEventListener('resize', resizeCanvas);

/* ─── 초기화 ─── */
resizeCanvas();
nicknameInput.value = storage.get(STORAGE_KEYS.nickname, '');
playerTagEl.textContent = `#${getPlayerTag()}`;
buildCharGrid();
selectCharacter(storage.get(STORAGE_KEYS.char, CHARACTERS[0].id));
requestAnimationFrame(loop);
