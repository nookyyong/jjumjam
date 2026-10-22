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
  { id: 'c1', key: 'char1', name: '신해량', color: '#f0b97a' },
  { id: 'c2', key: 'char2', name: '서지혁', color: '#f08aad' },
  { id: 'c3', key: 'char3', name: '박무현', color: '#b08af0' },
  { id: 'c4', key: 'char4', name: '백애영', color: '#7ad4b0' },
  { id: 'c5', key: 'char5', name: '유금이', color: '#7ac4f0' },
  // STAGE 2 (if 모드) 전용. heavy: 둔탁하고 묵직한 효과음
  { id: 'c6', key: 'char6', name: '정상현', color: '#c9a27a', heavy: true },
];

/* ─── 스테이지 ─── */
// 스테이지마다 캐릭터와 난이도 버튼이 다름. 탭에는 name, 잠겨 있는 동안엔 lockedName 표시
// → 나중에 중간에 스테이지를 끼워 넣을 때는 목록에 추가하고 unlockBy만 맞추면 됨
//   unlockBy: { stage, diff } 그 스테이지의 그 난이도를 깨면 열림 (페이지 열려 있는 동안만 기억, 새로고침하면 다시 잠김)
const STAGES = [
  { id: 's1', name: '1회차', chars: ['c1', 'c2', 'c3', 'c4', 'c5'], diffs: [1, 3, 5], defaultDiff: 3, hint: '나머지는 뒤에서 따라와요' },
  { id: 's2', name: 'if회차', lockedName: '???', chars: ['c6'], diffs: [6], defaultDiff: 6, hint: '본편엔 없어. 이유가 있겠지.', unlockBy: { stage: 's1', diff: 5 } },
];

// walk: 꼭대기에서 걸을 때 stand와 번갈아 표시 (다리만 벌린 프레임). 없으면 stand로 대신함
const SPRITE_POSES = ['right_stand', 'left_stand', 'right_jump', 'left_jump', 'right_walk', 'left_walk'];
const spritePath = (ch, pose) => `images/${ch.key}_${pose}.png`;

/* ─── 제목 / 표기 ─── */
const GAME_TITLE = '아등바등';
const GAME_SUBTITLE = '어두운 바다의 등불이 되어 팬게임';
const CREDIT = '@hardycrops';  // 제작자 표기. 비워두면 표시 안 함
const CREDIT_URL = 'https://bsky.app/profile/hardycrops.bsky.social';

/* ─── 게임 설정 ─── */
const CONFIG = {
  // 규칙
  GOAL_STAIRS: 4800,     // 원작 계단 수
  GOAL_FLOOR: 180,       // 원작 층수 (계단 수를 환산해서 표시)
  DIFFICULTY: 3,         // 기본 난이도 1~5 (설정 화면에서 선택 가능, 아래 DIFFICULTY_PRESETS)

  // 화면 (게임 영역은 가로 400 고정, 화면에 맞게 확대/축소)
  GAME_W: 400,
  MIN_VIEW_H: 640,       // PC에서 최소 이만큼의 높이가 보이도록 축소
  CAM_PLAYER_Y: 0.45,    // 캐릭터가 화면 아래에서 45% 위치를 넘으면 카메라가 따라 올라감

  // 물리 (단위: px, 초)
  // 점프 높이 = JUMP_V² / (2 × GRAVITY). 속도만 바꿀 땐 높이가 유지되도록 둘을 같이 조정
  // (일반 점프 높이 약 187은 난이도별 GAP_MAX 최대값보다 커야 항상 올라갈 수 있음)
  GRAVITY: 1200,
  JUMP_V: 670,           // 일반 점프 → 최고 높이 약 187px, 체공 약 1.1초
  SPRING_V: 1100,        // 스프링 점프 → 최고 높이 약 504px
  MOVE_SPEED: 250,       // 좌우 최고 속도
  MOVE_ACCEL: 10,        // 클수록 좌우 반응이 즉각적

  // 픽셀아트 배율: 이미지 1px = 게임 좌표 2.4 (캐릭터 16×24 → 38×57)
  PIX: 2.4,

  // 계단(발판)  이미지 30×6px
  PLAT_H: 14.4,
  // 계단 간격/종류/너비는 난이도 프리셋에서 설정됨 (DIFFICULTY_PRESETS)
  // 다음 계단까지 좌우 거리 제한: 간격이 좁을 땐 넓게, 간격이 넓을 땐 가깝게
  // (높이 올라가야 하는 만큼 좌우로 이동할 시간이 줄어들기 때문)
  // 다음 계단까지 좌우 거리: 그 높이까지 뛰는 동안 좌우로 풀이동했을 때 갈 수 있는 거리 기준
  // (위로 많이 올라가야 할수록 체공 시간이 줄어서 좌우 거리도 줄어듦)
  REACH_MARGIN: 0.9,     // 풀이동 거리의 몇 %까지 쓸지 (1에 가까울수록 어려움)
  REACH_BONUS: 30,
  SAFE_REACH_Y: 165,     // 꼭대기 바닥까지 마지막 계단에서 닿을 수 있는 최대 높이 (점프 최고 높이 약 187)
  NO_CRUMBLE_START: 400, // 시작 바닥에서 이 높이까지는 무너지는 계단 없음
  MOVING_HITS: 3,        // if 모드: 움직이는 계단을 몇 번 밟으면 부러지는지
  SPRING_W: 24,          // 이미지 10px

  // 캐릭터
  CHAR_W: 38.4,          // 16×24 이미지 × PIX(2.4)
  CHAR_H: 57.6,
  HITBOX_W: 28,          // 발판 판정 너비

  // 안내
  TOAST_FLOOR_STEP: 30,  // 몇 층마다 통과 안내를 띄울지
  TOAST_MS: 2500,

  // 꼭대기 문 (닿으면 결과 표시)
  DOOR_W: 40.8,          // 이미지 17×27px
  DOOR_H: 64.8,
  PHOTO_SIZE: 248,       // 결과 폴라로이드 사진 크기(px)
  PHOTO_VIEW_W: 400,     // 사진에 담길 최대 가로 범위(게임 좌표). 이보다 넓게는 안 찍힘 (400 = 게임 영역 전체 폭)
  WALK_FRAME_MS: 120,    // 걷기 프레임 전환 간격
  EXIT_SLIDE_MS: 500,    // 캐릭터 하나가 문 밖으로 미끄러져 나가는 시간
  DOOR_OPEN: 0.7,        // 평소 문짝 비율 (1 = 닫힘, 작을수록 활짝 열림)
  DOOR_OPEN_EXIT: 0.25,  // 나갈 때 문이 더 열린 상태
  FOLLOW_DELAY_MS: 110,  // 따라오는 캐릭터 간 지연

  // 화면
  START_PAD: 70,         // 시작 바닥 아래로 보이는 여백
  WALL_PARALLAX: 0.6,    // 벽 배경이 계단보다 느리게 움직이는 정도 (깊이감)
  WALL_DARK_START: 0.82,  // 시작층 벽 어둡기 (1 = 완전 검정)
  WALL_DARK_END: 0.5,     // 꼭대기 벽 어둡기 (지금 밝기가 최대)
  HYDRANT_X: 34,         // 시작층 소화전(들어온 곳) 위치
};

/* ─── 난이도 프리셋 ─── */
// [시작값, 꼭대기값] 쌍은 높이 올라갈수록 시작값 → 꼭대기값으로 변함
//   PX_PER_STAIR  1계단 높이(클수록 꼭대기까지 멀어짐). 보통 4.5 ≈ 클리어 2분 30초 (이전 6 ≈ 3분 20초)
//   GAP_MIN/MAX   계단 사이 세로 간격 (GAP_MAX는 187 미만 유지)
//   PLAT_W        계단 너비 (이미지 30px = 72)
const DIFFICULTY_PRESETS = {
  1: { PX_PER_STAIR: 3.75, GAP_MIN: [30, 55], GAP_MAX: [90, 125], MOVING_CHANCE: [0.03, 0.15], CRUMBLE_CHANCE: [0.05, 0.15], SPRING_CHANCE: 0.10, MOVING_SPEED: [50, 120], PLAT_W: [72, 72] },
  2: { PX_PER_STAIR: 3.75, GAP_MIN: [30, 65], GAP_MAX: [90, 140], MOVING_CHANCE: [0.03, 0.20], CRUMBLE_CHANCE: [0.05, 0.20], SPRING_CHANCE: 0.10, MOVING_SPEED: [50, 120], PLAT_W: [72, 72] },
  3: { PX_PER_STAIR: 4.5, GAP_MIN: [35, 75], GAP_MAX: [95, 155], MOVING_CHANCE: [0.05, 0.28], CRUMBLE_CHANCE: [0.08, 0.28], SPRING_CHANCE: 0.07, MOVING_SPEED: [60, 150], PLAT_W: [72, 57.6] },
  4: { PX_PER_STAIR: 5.25, GAP_MIN: [40, 85], GAP_MAX: [100, 165], MOVING_CHANCE: [0.05, 0.32], CRUMBLE_CHANCE: [0.10, 0.35], SPRING_CHANCE: 0.05, MOVING_SPEED: [70, 170], PLAT_W: [67.2, 52.8] },
  5: { PX_PER_STAIR: 6, GAP_MIN: [45, 95], GAP_MAX: [110, 172], MOVING_CHANCE: [0.06, 0.35], CRUMBLE_CHANCE: [0.12, 0.40], SPRING_CHANCE: 0.04, MOVING_SPEED: [80, 190], PLAT_W: [62.4, 43.2] },
};
// 6: if 모드 (STAGE 2) — 지옥 기준, 일반 계단 없음 (스프링 / 움직이는 계단 / 무너지는 계단만)
//    움직이는 계단은 세 번 밟으면 부러짐 (CONFIG.MOVING_HITS)
DIFFICULTY_PRESETS[6] = { ...DIFFICULTY_PRESETS[5], IF_MODE: true };
const DIFFICULTY_NAMES = { 1: '연습', 2: '쉬움', 3: '보통', 4: '어려움', 5: '지옥', 6: '그치만 if...' };
const DIFFICULTY_HINTS = {
  1: '넓고 가까운 계단. 연습용',
  2: '무너지는 계단이 가끔 나와요',
  3: '위로 갈수록 계단이 좁아져요',
  4: '움직이는 계단이 빨라지고 스프링이 귀해요',
  5: '좁고, 멀고, 잘 무너져요',
  6: '멀쩡한 계단이 하나도 없어요',
};

let GOAL_Y = 0;  // 꼭대기 높이 (난이도에 따라 달라짐)
// 설정 화면에 보여줄 난이도는 스테이지별 diffs (STAGES). 2, 4 프리셋은 보관만

/** 난이도 프리셋을 CONFIG에 적용 */
function applyDifficulty(level) {
  const preset = DIFFICULTY_PRESETS[level] || DIFFICULTY_PRESETS[3];
  Object.assign(CONFIG, preset);
  CONFIG.DIFFICULTY = DIFFICULTY_PRESETS[level] ? level : 3;
  CONFIG.PLAT_W_RANGE = preset.PLAT_W;
  CONFIG.PLAT_W = preset.PLAT_W[0];  // 기본(최대) 너비
  CONFIG.IF_MODE = !!preset.IF_MODE;
  GOAL_Y = CONFIG.GOAL_STAIRS * CONFIG.PX_PER_STAIR;
}
applyDifficulty(CONFIG.DIFFICULTY);

/* ─── 개발용 테스트 옵션 ─── */
// 로컬(Live Server 등)에서만 동작. GitHub Pages 배포 주소에서는 무시됨
//   ?start=4750   → 4750계단 높이에서 시작
//   ?god=1        → 아래로 떨어져도 죽지 않고 튀어오름
//   ?unlock=1     → 잠긴 스테이지 전부 열기
//   예) http://127.0.0.1:5500/index.html?start=4750&god=1&unlock=1
const DEV = (() => {
  const local = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  const q = new URLSearchParams(location.search);
  const start = Math.min(CONFIG.GOAL_STAIRS - 10, Math.max(0, parseInt(q.get('start'), 10) || 0));
  return {
    on: local,
    startStairs: local ? start : 0,
    god: local && q.get('god') === '1',
    unlock: local && q.get('unlock') === '1',
  };
})();

// 열린 스테이지 (저장 안 함: 새로고침하거나 브라우저를 다시 열면 STAGE 1만 남음)
const unlockedStages = new Set(STAGES.filter(s => !s.unlockBy || DEV.unlock).map(s => s.id));
const seenStages = new Set();  // 한 번이라도 눌러본 스테이지 (NEW! 딱지 지우기용, 저장 안 함)
if (DEV.on && (DEV.startStairs || DEV.god || DEV.unlock)) {
  console.log(`[DEV] 시작 ${DEV.startStairs}계단, 무적 ${DEV.god ? 'ON' : 'OFF'}, 스테이지 전부 열기 ${DEV.unlock ? 'ON' : 'OFF'}`);
}

const STORAGE_KEYS = {
  nickname: 'stairs_nickname',
  char: 'stairs_char',
  oldTag: 'stairs_tag',   // 안 씀 (지우기용)
  best: 'stairs_best_jump_d',  // + 난이도 번호. { stairs, timeMs }
  diff: 'stairs_diff',
  muteSfx: 'stairs_mute_sfx',
  muteBgm: 'stairs_mute_bgm',
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

// 배경/계단/소품 픽셀 이미지 (images/ 폴더. 같은 이름으로 덮어쓰면 교체됨)
const IMG = {};
[
  'wall', 'wall_crack', 'wall_rebar', 'prop_stain', 'prop_crack',
  'stair_normal', 'stair_moving', 'stair_crumble', 'floor_tile', 'goal_tile',
  'spring', 'spring_on', 'door_frame', 'door_leaf', 'exit_sign', 'hydrant_door', 'hydrant_leaf',
].forEach(name => { IMG[name] = loadImage(`images/${name}.png`); });

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
  stage: STAGES[0].id,
  hudCache: {},
  toastsShown: {},
  summit: false,         // 꼭대기 계단 도착 (문까지 자유 이동)
  summitTimeMs: 0,       // 꼭대기 도착 시간 = 기록
  door: null,            // { x, y } 꼭대기 문
  exiting: false,        // 문에 들어가는 중
  exitT: 0,              // 메인캐릭터가 문에 닿은 시각
  exitPath: null,        // 문 밖으로 나가는 경로
  cleared: false,        // 문 통과 (결과 표시)
  paused: false,         // 일시정지
  startY: 0,             // 시작 바닥 높이
  particles: [],         // 먼지/부스러기 { x, y, vx, vy, life, max, size, color }
  motes: [],             // 공기 중 떠다니는 먼지 (화면 좌표)
  wantShot: null,        // 다음 렌더 후 찍을 사진 중심 { wx, wy }
  shot: null,            // 마지막으로 찍은 사진 { canvas, cx, cy } (결과 화면 폴라로이드용)
  shotArmed: true,       // 떨어지는 장면 사진을 한 번만 찍도록
};

/* ─── DOM 참조 ─── */
const gameWrapper    = document.getElementById('gameWrapper');
const canvas         = document.getElementById('gameCanvas');
let ctx              = canvas.getContext('2d');  // 결과 사진 찍을 때 잠깐 다른 캔버스로 바뀜
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
const charGrid       = document.getElementById('charGrid');
const startError     = document.getElementById('startError');
const startBtn       = document.getElementById('startBtn');
const gameoverScreen = document.getElementById('gameoverScreen');
const recName        = document.getElementById('recName');
const recChar        = document.getElementById('recChar');
const profileImg     = document.getElementById('profileImg');
const recMode        = document.getElementById('recMode');
const recStairs      = document.getElementById('recStairs');
const recTime        = document.getElementById('recTime');
const photoCanvas    = document.getElementById('photoCanvas');
const photoCaption   = document.getElementById('photoCaption');
const photoStamp     = document.getElementById('photoStamp');
const diffGrid       = document.getElementById('diffGrid');
const stageTabs      = document.getElementById('stageTabs');
const stageHint      = document.getElementById('stageHint');
const saveBtn        = document.getElementById('saveBtn');
const pauseBtn       = document.getElementById('pauseBtn');
const pauseScreen    = document.getElementById('pauseScreen');
const pauseRestartBtn = document.getElementById('pauseRestartBtn');
const quitBtn        = document.getElementById('quitBtn');
const soundToggles   = document.getElementById('soundToggles');
const sfxBtn         = document.getElementById('sfxBtn');
const bgmBtn         = document.getElementById('bgmBtn');
const tabletFoot     = document.getElementById('tabletFoot');
const restartBtn     = document.getElementById('restartBtn');
const titleBtn       = document.getElementById('titleBtn');

/* ─── 유틸 ─── */
// 계단 생성용 난수: 게임 중엔 Math.random, 설정 화면 배경은 항상 같은 배치가 나오도록 고정 시드
let rng = Math.random;
function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TITLE_SEED = 4800;
const rand = (min, max) => rng() * (max - min) + min;
const lerp = (range, t) => range[0] + (range[1] - range[0]) * t;

function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

function getStage(id = state.stage) {
  return STAGES.find(s => s.id === id) || STAGES[0];
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

/** 예전 버전이 저장해 둔 4자리 태그는 이제 안 쓰니 지움 */
try { localStorage.removeItem(STORAGE_KEYS.oldTag); } catch (e) { /* 저장소 못 쓰면 무시 */ }

function loadBest() {
  try {
    const b = JSON.parse(storage.get(STORAGE_KEYS.best + CONFIG.DIFFICULTY, 'null'));
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
let sideCut = 0;    // 좁은 화면에서 양옆이 잘린 폭

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  viewW = gameWrapper.clientWidth;
  viewH = gameWrapper.clientHeight;
  canvas.width  = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);

  // 도트 1칸이 화면에서 정확히 정수 픽셀이 되도록 배율을 맞춤 (안 맞으면 도트 크기가 들쭉날쭉해서 찌그러져 보임)
  const fit = Math.min(viewW / CONFIG.GAME_W, viewH / CONFIG.MIN_VIEW_H);
  const perArt = CONFIG.PIX * dpr;
  // 가까운 정수로 반올림. 화면 가로를 8% 넘게 넘치면 한 단계 작게 (조금 넘치는 건 양옆을 살짝 잘라냄)
  let k = Math.max(1, Math.round(fit * perArt));
  if ((k / perArt) * CONFIG.GAME_W > viewW * 1.08) k = Math.max(1, Math.floor(fit * perArt));
  scale = k / perArt;
  sideCut = Math.max(0, (CONFIG.GAME_W - viewW / scale) / 2);  // 화면 밖으로 잘린 양옆 폭(게임 좌표)
  offX = Math.round(((viewW - CONFIG.GAME_W * scale) / 2) * dpr) / dpr;
  viewLH = viewH / scale;
  placeSideButtons();
}

/** 효과음/배경음/정지 버튼: 게임 영역 바로 오른쪽에 (자리가 없는 폰에선 게임 영역 안 오른쪽 끝) */
function placeSideButtons() {
  if (!soundToggles) return;
  const colRight = offX + CONFIG.GAME_W * scale;
  if (viewW - colRight >= 64) {
    soundToggles.style.left = `${Math.round(colRight + 12)}px`;
    soundToggles.style.right = 'auto';
  } else {
    soundToggles.style.left = 'auto';
    soundToggles.style.right = '14px';
  }
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
function nextPlatformX(gap, platW, fromX) {
  const W = CONFIG.GAME_W;
  const reach = maxTravelX(gap) * CONFIG.REACH_MARGIN + CONFIG.REACH_BONUS;

  // 화면 안에서만, 기준 계단(fromX)에서 reach 범위 안에서 고름
  const half = platW / 2;
  const lo = Math.max(half, fromX - reach);
  const hi = Math.min(W - half, fromX + reach);
  const cx = rand(lo, hi);
  state.genLastX = cx;
  return cx - half;
}

/** type: 'crumble' 이면 무너지는 계단, 아니면 일반/움직이는 계단 중 랜덤
 *  reachGap / fromX: 이 계단에 닿아야 하는 기준 계단과의 높이 차 / 기준 계단 x */
function makePlatform(y, t, reachGap, fromX, crumble) {
  const movingP = lerp(CONFIG.MOVING_CHANCE, t);
  let type = crumble ? 'crumble' : 'normal';
  if (CONFIG.IF_MODE) {
    if (!crumble) type = 'moving';  // if 모드: 일반 계단 없음 → 무너지는 계단이 아니면 움직이는 계단
  } else if (!crumble && rng() < movingP) {
    type = 'moving';
  }

  // 높이 올라갈수록 좁아짐 (픽셀 단위로 맞춤)
  const w = Math.round(lerp(CONFIG.PLAT_W_RANGE, t) / CONFIG.PIX) * CONFIG.PIX;
  const plat = {
    x: nextPlatformX(reachGap, w, fromX),
    y,
    w,
    type,
    vx: 0,
    spring: null,
    crumbling: false,
    fallV: 0,
    alpha: 1,
    hits: 0,      // if 모드: 움직이는 계단 밟은 횟수
    hitT: -1e9,
  };

  if (type === 'moving') {
    plat.vx = rand(CONFIG.MOVING_SPEED[0], CONFIG.MOVING_SPEED[1]) * (rng() < 0.5 ? -1 : 1);
  }
  // 꼭대기 바로 아래에는 스프링 없음 (꼭대기 위로 튀어나가 화면이 어긋나는 것 방지)
  const nearGoal = y > GOAL_Y - 700;
  // if 모드는 무너지는 계단에도 스프링이 붙음 (계단 대부분이 무너지는 계단이라)
  if ((type !== 'crumble' || CONFIG.IF_MODE) && !nearGoal && rng() < CONFIG.SPRING_CHANCE) {
    plat.spring = { ox: rand(4, w - CONFIG.SPRING_W - 4), usedT: -1e9 };
  }
  return plat;
}

/**
 * 계단 생성
 * - 무너지는 계단은 연속으로 나올 수 있음 (밟고 바로 다음 계단으로 넘어가야 함)
 * - 단, 시작 바닥 근처에는 무너지는 계단을 두지 않음
 *   (바닥으로 떨어졌을 때 무너진 계단 때문에 다시 못 올라가는 일 방지)
 */
function generatePlatforms() {
  const limit = state.camBottom + viewLH + 300;
  const SAFE = CONFIG.SAFE_REACH_Y;
  while (state.genTopY < limit && state.genTopY < GOAL_Y) {
    const t = Math.min(1, state.genTopY / GOAL_Y);
    const gap = rand(lerp(CONFIG.GAP_MIN, t), lerp(CONFIG.GAP_MAX, t));
    let y = state.genTopY + gap;

    // 꼭대기: 바로 아래 계단에서 닿는 높이일 때만 놓음 (아니면 계단 하나 더)
    if (y >= GOAL_Y - 40) {
      if (GOAL_Y - state.genTopY <= SAFE) {
        state.platforms.push({
          x: 0, y: GOAL_Y, w: CONFIG.GAME_W, type: 'goal',
          // 문 위치: 마지막 계단 반대쪽 끝 근처
          doorX: state.genLastX < CONFIG.GAME_W / 2 ? CONFIG.GAME_W - 30 - CONFIG.DOOR_W : 30,
          vx: 0, spring: null, crumbling: false, fallV: 0, alpha: 1,
        });
        state.genTopY = GOAL_Y;
        break;
      }
      y = Math.min(GOAL_Y - 45, state.genTopY + SAFE);
    }

    const nearStart = y - state.startY < CONFIG.NO_CRUMBLE_START;
    // if 모드: 움직이는 계단 확률을 뺀 나머지가 전부 무너지는 계단 (시작 근처는 움직이는 계단만)
    const crumble = CONFIG.IF_MODE
      ? !nearStart && rng() >= lerp(CONFIG.MOVING_CHANCE, t)
      : !nearStart && rng() < lerp(CONFIG.CRUMBLE_CHANCE, t);
    const plat = makePlatform(y, t, y - state.genTopY, state.genLastX, crumble);
    state.platforms.push(plat);
    state.genTopY = y;
    state.genLastX = plat.x + plat.w / 2;
  }
}

/* ─── 게임 초기화 ─── */
/** fixedLayout: 설정 화면 배경용 (항상 같은 계단 배치) */
function resetGame(fixedLayout = false) {
  rng = fixedLayout ? seededRng(TITLE_SEED) : Math.random;
  // 시작 높이 (개발용 ?start= 옵션이 없으면 0)
  const startY = DEV.startStairs * CONFIG.PX_PER_STAIR;
  state.startY = startY;
  state.particles = [];
  state.shot = null;
  state.wantShot = null;
  state.shotArmed = true;

  // 시작 바닥 (가로 전체)
  state.platforms = [{
    x: 0, y: startY, w: CONFIG.GAME_W, type: 'floor',
    vx: 0, spring: null, crumbling: false, fallV: 0, alpha: 1,
  }];
  state.genTopY = startY;
  state.genLastX = CONFIG.GAME_W / 2;

  state.camBottom = startY - CONFIG.START_PAD;

  state.player = {
    x: CONFIG.GAME_W / 2,
    y: startY,
    vx: 0,
    vy: CONFIG.JUMP_V,
    dir: 1,
    maxY: startY,
    grounded: false,     // 꼭대기 바닥에 서 있음 (점프 대신 걷기)
  };
  state.history = [];
  state.followers = getStage().chars
    .filter(id => id !== state.selectedChar)
    .map(getCharacter)
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
  state.shotArmed = true;

  // 꼭대기 바닥: 더 이상 튀지 않고 서서 걸음
  if (plat.type === 'goal') {
    p.vy = 0;
    p.grounded = true;
    spawnDust(p.x, plat.y, 16, 1);
    if (state.phase === 'playing' && !state.summit) {
      sound.play(getCharacter(state.selectedChar).heavy ? 'landHeavy' : 'land');
      reachSummit(plat);
    }
    return;
  }

  if (plat.spring && overlapsX(p.x, plat.x + plat.spring.ox, plat.x + plat.spring.ox + CONFIG.SPRING_W)) {
    p.vy = CONFIG.SPRING_V;
    plat.spring.usedT = state.now;
  } else {
    p.vy = CONFIG.JUMP_V;
  }

  const heavy = getCharacter(state.selectedChar).heavy;
  const sprung = p.vy === CONFIG.SPRING_V;
  spawnDust(p.x, plat.y, sprung ? 26 : heavy ? 22 : 16, sprung ? 1.4 : heavy ? 1.2 : 1);
  const playing = state.phase === 'playing';
  if (playing) sound.play((sprung ? 'spring' : 'jump') + (heavy ? 'Heavy' : ''));
  if (plat.type === 'crumble') {
    plat.crumbling = true;
    spawnDebris(plat);
    if (playing) sound.play('crumble');
  }
  // if 모드: 움직이는 계단은 밟을 때마다 금이 가고 정해진 횟수가 되면 부러짐
  if (plat.type === 'moving' && CONFIG.IF_MODE) {
    plat.hits++;
    plat.hitT = state.now;
    if (plat.hits >= CONFIG.MOVING_HITS) {
      plat.crumbling = true;
      spawnDebris(plat);
      if (playing) sound.play('snap');
    } else if (playing) {
      sound.play('rattle');
    }
  }
}

/* ─── 먼지 / 부스러기 ─── */
/** 착지 먼지: 발밑에서 양옆으로 퍼지며 천천히 가라앉는 먼지 구름 */
function spawnDust(x, y, n, power = 1) {
  const colors = ['#e6e0d4', '#d2ccbf', '#bdb6a9'];
  for (let i = 0; i < n; i++) {
    const dir = i % 2 ? 1 : -1;
    const big = i % 3 === 0;
    state.particles.push({
      x: x + dir * rand(2, 16), y: y + rand(0, 8),
      vx: dir * rand(70, 220) * power, vy: rand(30, 130) * power,
      g: -110, drag: 4, life: 0, max: rand(0.6, 1.1), size: big ? 9.6 : 7.2,
      color: colors[i % colors.length],
    });
  }
}

function spawnDebris(plat) {
  for (let i = 0; i < 10; i++) {
    state.particles.push({
      x: plat.x + rand(4, plat.w - 4), y: plat.y - rand(0, CONFIG.PLAT_H),
      vx: rand(-40, 40), vy: rand(20, 120),
      g: -CONFIG.GRAVITY, life: 0, max: rand(0.6, 1.1), size: i % 3 ? 2.4 : 4.8,
      color: i % 2 ? '#77726b' : '#5c5853',
    });
  }
}

/** 층 통과 축하 종이가루 */
function spawnConfetti(x, y) {
  const colors = ['#ffd23f', '#ff8fab', '#6fe3c1', '#fff4dc'];
  for (let i = 0; i < 28; i++) {
    const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
    const sp = rand(220, 420);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: -Math.sin(a) * sp,
      g: -700, drag: 1.6, life: 0, max: rand(0.9, 1.4), size: i % 3 ? 4.8 : 7.2,
      color: colors[i % colors.length],
    });
  }
}

function updateParticles(dt) {
  for (const pt of state.particles) {
    pt.life += dt;
    if (pt.drag) {
      const k = Math.max(0, 1 - pt.drag * dt);
      pt.vx *= k;
      pt.vy *= k;
    }
    pt.vy += pt.g * dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
  }
  state.particles = state.particles.filter(pt => pt.life < pt.max);

  // 공기 중 먼지: 화면 좌표, 아주 천천히 떠다님
  if (state.motes.length === 0) {
    for (let i = 0; i < 26; i++) {
      state.motes.push({ x: rand(0, CONFIG.GAME_W), y: rand(0, 1), vx: rand(-4, 4), vy: rand(-6, -2), ph: rand(0, 6.28) });
    }
  }
  for (const m of state.motes) {
    m.x += (m.vx + Math.sin(state.now / 1500 + m.ph) * 4) * dt;
    m.y += (m.vy / Math.max(viewLH, 1)) * dt;
    if (m.y < 0) m.y += 1;
    if (m.x < 0) m.x += CONFIG.GAME_W;
    if (m.x > CONFIG.GAME_W) m.x -= CONFIG.GAME_W;
  }
}

/* ─── 업데이트 ─── */
function update(dt) {
  const p = state.player;
  const W = CONFIG.GAME_W;

  // 문으로 들어가는 중: 움직임 정지, 마지막 캐릭터까지 사라지면 결과 표시
  if (state.exiting) {
    if (!state.exitShotTaken && state.now - state.exitT > 160) {
      state.exitShotTaken = true;
      state.wantShot = { wx: state.door.x + CONFIG.DOOR_W / 2, wy: state.door.y + CONFIG.DOOR_H * 0.6 };
    }
    const doneT = state.exitT + state.followers.length * CONFIG.FOLLOW_DELAY_MS + CONFIG.EXIT_SLIDE_MS + 300;
    if (state.phase === 'playing' && state.now >= doneT) endGame('clear');
    updateHUD();
    return;
  }

  if (state.phase === 'playing' && !state.summit) state.elapsed += dt * 1000;

  // 좌우 이동 (게임 중에만 입력 반영)
  const input = state.phase === 'playing' ? (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0) : 0;
  p.vx += (input * CONFIG.MOVE_SPEED - p.vx) * Math.min(1, CONFIG.MOVE_ACCEL * dt);
  if (input !== 0) p.dir = input;

  // 중력 + 이동 (꼭대기 바닥에 서 있으면 중력 없이 옆으로만)
  const prevY = p.y;
  if (p.grounded) {
    p.vy = 0;
    p.x += p.vx * dt;
  } else {
    p.vy -= CONFIG.GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  // 화면 양 끝은 벽
  const halfW = CONFIG.CHAR_W / 2 + sideCut;
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
  // 게임 중이거나, 꼭대기 도착 후에만 착지. 떨어져서 게임오버된 뒤에는 착지 안 함
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
  // 꼭대기 바닥이 화면 아래 1/4 위치보다 더 내려가지 않게
  state.camBottom = Math.min(state.camBottom, GOAL_Y - viewLH * 0.25);

  // 떨어지는 장면 사진: 화면 아래쪽으로 내려가는 순간 한 번 찍어둠 (게임오버 시 폴라로이드)
  if (state.phase === 'playing' && state.shotArmed && p.vy < -300 && p.y < state.camBottom + viewLH * 0.28) {
    state.shotArmed = false;
    state.wantShot = { wx: p.x, wy: p.y + CONFIG.CHAR_H * 1.2 };
  }

  // 배경음: 높이에 따라 조금씩 밝아짐 (0.5초마다만 갱신)
  if (bgm.ctx && Math.floor(state.now / 500) !== Math.floor((state.now - dt * 1000) / 500)) {
    bgm.setHeight(Math.min(1, Math.max(0, p.y / GOAL_Y)));
  }

  // 화면 아래로 완전히 떨어짐
  if (state.phase === 'playing' && p.y < state.camBottom - CONFIG.CHAR_H) {
    if (DEV.god) p.vy = CONFIG.SPRING_V;  // 개발용 무적: 튀어오름
    else {
      sound.play('fall');
      endGame('fall');
    }
  }

  // 꼭대기: 문에 닿으면 결과 표시
  if (state.summit && state.phase === 'playing') checkDoor();

  // 층 안내 (30층마다)
  if (state.phase === 'playing') {
    const floor = floorOf(stairsOf(p.maxY));
    if (floor % CONFIG.TOAST_FLOOR_STEP === 0 && floor < CONFIG.GOAL_FLOOR && !state.toastsShown[floor]) {
      state.toastsShown[floor] = true;
      showFloorToast(floor);
      sound.play('floor');
      spawnConfetti(p.x, p.y + CONFIG.CHAR_H);
    }
  }

  // 따라오는 캐릭터용 이동 기록
  state.history.push({ t: state.now, x: p.x, y: p.y, dir: p.dir, rising: !p.grounded, walking: p.grounded && Math.abs(p.vx) > 30 });
  const keepFrom = state.now - (state.followers.length + 1) * CONFIG.FOLLOW_DELAY_MS - 200;
  while (state.history.length > 2 && state.history[1].t < keepFrom) state.history.shift();

  updateParticles(dt);

  // 지나간 계단 정리 + 새 계단 생성
  const cutoff = state.camBottom - 200;
  state.platforms = state.platforms.filter(pl => pl.y > cutoff && pl.alpha > 0);
  generatePlatforms();

  updateHUD();
}

/* ─── 렌더 ─── */
function fillRoundRect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

const PIXEL_FONT = '"Galmuri11", "Galmuri9", monospace';

/** 이미지가 있으면 그리고, 없으면 대체 색으로 채움 */
/** 화면 실제 픽셀 격자에 맞춤 (도트가 반 픽셀에 걸려 뭉개지는 것 방지) */
function snap(v) {
  const k = scale * dpr;
  return Math.round(v * k) / k;
}

function drawImg(holder, x, y, w, h, fallback) {
  x = snap(x);
  y = snap(y);
  if (holder && holder.ok) {
    ctx.drawImage(holder.el, x, y, w, h);
  } else if (fallback) {
    ctx.fillStyle = fallback;
    ctx.fillRect(x, y, w, h);
  }
}

/** 가로로 타일 반복 (시작 바닥 / 꼭대기) */
function drawTileRow(holder, x, y, w, tileW, h, fallback) {
  for (let tx = x; tx < x + w; tx += tileW) {
    drawImg(holder, tx, y, Math.min(tileW, x + w - tx), h, fallback);
  }
}

/** 정수 시드 → 0~1 (같은 높이에는 항상 같은 소품이 나오도록) */
function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 화면 전체 (게임 영역 바깥 포함) */
function drawBackdrop() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b1016';
  ctx.fillRect(0, 0, viewW, viewH);
}

/** 계단통로 벽: 낡은 노출 콘크리트 (계단보다 느리게 스크롤) */
function drawWall() {
  const W = CONFIG.GAME_W;
  const PIX = CONFIG.PIX;
  const wallY = state.camBottom * CONFIG.WALL_PARALLAX;   // 벽 좌표계의 화면 맨 아래
  const toWallLY = wy => viewLH - (wy - wallY);

  // 콘크리트 타일: 대부분 평범, 가끔 금 간 것 / 철근 드러난 것
  const T = 32 * PIX;
  const firstRow = Math.floor(wallY / T);
  for (let r = firstRow; r * T < wallY + viewLH + T; r++) {
    const ly = toWallLY((r + 1) * T);
    for (let c = 0; c * T < W; c++) {
      const h = hash01(r * 13 + c * 7.3);
      const tile = h < 0.05 ? IMG.wall_rebar : h < 0.17 ? IMG.wall_crack : IMG.wall;
      drawImg(tile, c * T, ly, T, T, '#5f5b55');
    }
  }

  // 벽에 붙은 얼룩 / 큰 금 (위치는 높이로 고정)
  const CHUNK = 180;
  const decals = [['prop_stain', 10, 26], ['prop_crack', 22, 16]];
  const firstChunk = Math.floor(wallY / CHUNK) - 1;
  for (let c = firstChunk; c * CHUNK < wallY + viewLH + CHUNK; c++) {
    if (c < 0 || hash01(c + 0.9) < 0.35) continue;
    const [name, pw, ph] = decals[Math.floor(hash01(c) * decals.length)];
    const w = pw * PIX;
    const h = ph * PIX;
    const x = 10 + hash01(c + 0.5) * (W - 20 - w);
    drawImg(IMG[name], x, toWallLY(c * CHUNK + 40 + hash01(c + 0.25) * 100), w, h);
  }

  // 벽을 어둡게 눌러서 계단/캐릭터가 앞으로 보이게
  // 시작층은 아주 어둡고, 올라갈수록 조금씩 밝아짐 (꼭대기에서 0.5가 최대 밝기)
  const climb = Math.min(1, Math.max(0, state.camBottom / GOAL_Y));
  const dark = CONFIG.WALL_DARK_START + (CONFIG.WALL_DARK_END - CONFIG.WALL_DARK_START) * climb;
  ctx.fillStyle = `rgba(10, 10, 12, ${dark})`;
  ctx.fillRect(0, 0, W, viewLH);
}

/** 10층마다 벽에 페인트로 칠한 층 번호 (낡아서 바랜 느낌) */
function drawFloorMarks() {
  ctx.font = `bold 28px "Galmuri14", ${PIXEL_FONT}`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';

  const stairsPerFloor = CONFIG.GOAL_STAIRS / CONFIG.GOAL_FLOOR;
  const fromF = Math.max(10, Math.floor(floorOf(stairsOf(state.camBottom)) / 10) * 10);
  for (let f = fromF; f <= CONFIG.GOAL_FLOOR; f += 10) {
    const wy = (f - 1) * stairsPerFloor * CONFIG.PX_PER_STAIR;
    const ly = toLY(wy);
    if (ly < -40) break;
    if (ly > viewLH + 40) continue;

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(12, ly - 2, 120, 4);
    ctx.fillText(`${f}F`, 14, ly - 6);
    ctx.globalAlpha = 1;
  }
}

/** 시작층: 열린 소화전 함 (여기로 들어왔다는 설정) */
function drawHydrant() {
  const ly = toLY(state.startY);
  if (ly < -80 || ly > viewLH + 80) return;
  const PIX = CONFIG.PIX;
  const x = CONFIG.HYDRANT_X;
  const h = 27 * PIX;
  drawImg(IMG.hydrant_door, x, ly - h, 17 * PIX, h, '#d83a3a');
  drawImg(IMG.hydrant_leaf, x - 5 * PIX, ly - h, 5 * PIX, h, '#9e2424');
}

function drawParticles() {
  for (const pt of state.particles) {
    const k = pt.life / pt.max;
    ctx.globalAlpha = pt.drag ? Math.min(1, 1.6 * (1 - k)) : 1 - k;
    ctx.fillStyle = pt.color;
    const size = pt.drag ? pt.size * (1 - k * 0.5) : pt.size;
    ctx.fillRect(Math.round(pt.x - size / 2), Math.round(toLY(pt.y) - size / 2), size, size);
  }
  ctx.globalAlpha = 1;
}

function drawMotes() {
  ctx.fillStyle = 'rgba(210, 204, 192, 0.35)';
  for (const m of state.motes) {
    ctx.fillRect(Math.round(m.x), Math.round(m.y * viewLH), 2.4, 2.4);
  }
}

/** 화면 아래쪽은 끝이 안 보이는 어둠 */
function drawAbyss() {
  const fade = ctx.createLinearGradient(0, viewLH - 110, 0, viewLH);
  fade.addColorStop(0, 'rgba(5, 7, 10, 0)');
  fade.addColorStop(1, 'rgba(5, 7, 10, 0.95)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, viewLH - 110, CONFIG.GAME_W, 110);
}

/** 문 기하 정보: 문틀 안쪽(빛) 범위, 문짝이 붙는 쪽(벽 쪽) */
function doorGeom(doorX) {
  const PIX = CONFIG.PIX;
  const innerL = doorX + 2 * PIX;
  const innerR = doorX + CONFIG.DOOR_W - 2 * PIX;
  const hingeRight = doorX + CONFIG.DOOR_W / 2 > CONFIG.GAME_W / 2;  // 오른쪽 문이면 문짝은 오른쪽(벽 쪽)
  return { innerL, innerR, hingeRight };
}

function doorOpenAmount() {
  if (!state.exiting) return CONFIG.DOOR_OPEN;
  const k = Math.min(1, (state.now - state.exitT) / 300);
  return CONFIG.DOOR_OPEN + (CONFIG.DOOR_OPEN_EXIT - CONFIG.DOOR_OPEN) * k;
}

/** 꼭대기 문 (뒤쪽): 은은한 빛 + 문틀 너머 빛 + EXIT 표지판 */
function drawDoorBack(x, groundLY) {
  const w = CONFIG.DOOR_W;
  const h = CONFIG.DOOR_H;
  const top = groundLY - h;
  const { innerL, innerR, hingeRight } = doorGeom(x);

  // 문 틈으로 새어 나오는 따뜻한 빛 (천천히 숨쉬듯)
  const breathe = 0.75 + 0.25 * Math.sin(state.now / 900);
  const open = 1 - doorOpenAmount();
  const gapCX = hingeRight ? innerL + (innerR - innerL) * open / 2 : innerR - (innerR - innerL) * open / 2;
  const glow = ctx.createRadialGradient(gapCX, top + h * 0.55, 4, gapCX, top + h * 0.55, 110);
  glow.addColorStop(0, `rgba(255, 228, 160, ${(0.22 + open * 0.25) * breathe})`);
  glow.addColorStop(1, 'rgba(255, 228, 160, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(gapCX - 110, top - 60, 220, h + 120);

  // 바닥에 비친 빛
  const spillDir = hingeRight ? -1 : 1;
  const spill = ctx.createLinearGradient(gapCX, 0, gapCX + spillDir * 90, 0);
  spill.addColorStop(0, `rgba(255, 236, 180, ${0.3 * breathe})`);
  spill.addColorStop(1, 'rgba(255, 236, 180, 0)');
  ctx.fillStyle = spill;
  ctx.fillRect(Math.min(gapCX, gapCX + spillDir * 90), groundLY - 3, 90, 5);

  drawImg(IMG.door_frame, x, top, w, h, '#fff1c2');

  // 초록 EXIT 표지판
  const sw = 19 * CONFIG.PIX;
  const sh = 9 * CONFIG.PIX;
  const sx = x + w / 2 - sw / 2;
  const sy = top - sh - 8;
  const sg = ctx.createRadialGradient(sx + sw / 2, sy + sh / 2, 4, sx + sw / 2, sy + sh / 2, 60);
  sg.addColorStop(0, 'rgba(43, 212, 125, 0.25)');
  sg.addColorStop(1, 'rgba(43, 212, 125, 0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sx - 60, sy - 60, sw + 120, sh + 120);
  drawImg(IMG.exit_sign, sx, sy, sw, sh, '#2bd47d');
}

/** 꼭대기 문 (앞쪽): 살짝 열린 문짝. 캐릭터보다 위에 그려서 지나가면 문 뒤로 사라짐 */
function drawDoorFront(x, groundLY) {
  const PIX = CONFIG.PIX;
  const { innerL, innerR, hingeRight } = doorGeom(x);
  const fullW = innerR - innerL;
  const lw = Math.max(PIX, fullW * doorOpenAmount());
  const lx = hingeRight ? innerR - lw : innerL;
  drawImg(IMG.door_leaf, lx, groundLY - CONFIG.DOOR_H + PIX, lw, 25 * PIX, '#6e7378');
}

const STAIR_IMG = {
  normal: 'stair_normal',
  moving: 'stair_moving',
  crumble: 'stair_crumble',
};
const STAIR_FALLBACK = {
  normal: '#a9b6c4', moving: '#f2c230', crumble: '#9c5530', floor: '#6f7e8f', goal: '#ffd23f',
};

/** 계단 이미지(30px)를 너비에 맞게 잘라서 그림: 왼쪽 부분 + 오른쪽 끝 4px (늘이지 않아서 도트가 안 뭉개짐) */
function drawStair(holder, x, y, w, fallback) {
  const PIX = CONFIG.PIX;
  x = snap(x);
  y = snap(y);
  const h = CONFIG.PLAT_H;
  if (!holder || !holder.ok) {
    ctx.fillStyle = fallback;
    ctx.fillRect(x, y, w, h);
    return;
  }
  const srcW = Math.min(30, Math.round(w / PIX));
  if (srcW >= 30) {
    ctx.drawImage(holder.el, x, y, w, h);
    return;
  }
  const edge = 4;
  ctx.drawImage(holder.el, 0, 0, srcW - edge, 6, x, y, (srcW - edge) * PIX, h);
  ctx.drawImage(holder.el, 30 - edge, 0, edge, 6, x + (srcW - edge) * PIX, y, edge * PIX, h);
}

/** 밟은 횟수만큼 금 (도트 단위). 1번: 가운데 금 하나 / 2번: 양쪽으로 더 */
function drawCracks(x, ly, w, hits) {
  const P = CONFIG.PIX;
  x = snap(x);
  ly = snap(ly);
  ctx.fillStyle = '#3a2412';
  // [시작 x(도트), 모양: 위에서부터 한 칸씩 좌우로 꺾이는 금]
  const cracks = [[0.5, [0, 1, 0, -1, 0]], [0.22, [0, -1, -1, 0]], [0.78, [0, 1, 0, 1]]];
  const n = Math.min(cracks.length, hits === 1 ? 1 : 3);
  for (let i = 0; i < n; i++) {
    const [fx, shape] = cracks[i];
    let cx = Math.round((w * fx) / P);
    shape.forEach((dx, row) => {
      cx += dx;
      ctx.fillRect(x + cx * P, ly + row * P, P, P);
    });
  }
}

function drawPlatforms() {
  const PIX = CONFIG.PIX;
  for (const plat of state.platforms) {
    const ly = toLY(plat.y);
    if (ly < -40 || ly > viewLH + 40) continue;

    ctx.globalAlpha = plat.alpha;
    if (plat.type === 'floor' || plat.type === 'goal') {
      const tile = plat.type === 'floor' ? IMG.floor_tile : IMG.goal_tile;
      drawTileRow(tile, plat.x, ly, plat.w, 16 * PIX, CONFIG.PLAT_H, STAIR_FALLBACK[plat.type]);
    } else {
      // 무너지는 중엔 살짝 흔들림
      // if 모드 움직이는 계단: 밟은 직후 잠깐 덜컹
      const jolt = state.now - plat.hitT < 160 ? Math.sin(state.now / 15) * 1.5 : 0;
      const shake = plat.crumbling ? Math.sin(state.now / 20) * 1.5 : jolt;
      drawStair(IMG[STAIR_IMG[plat.type]], plat.x + shake, ly, plat.w, STAIR_FALLBACK[plat.type]);
      if (plat.hits > 0) drawCracks(plat.x + shake, ly, plat.w, plat.hits);
    }

    // 스프링
    if (plat.spring) {
      const used = state.now - plat.spring.usedT < 180;
      const sx = plat.x + plat.spring.ox;
      const sh = (used ? 7 : 11) * PIX;
      drawImg(used ? IMG.spring_on : IMG.spring, sx, ly - sh, CONFIG.SPRING_W, sh, '#ff6b6b');
    }

    if (plat.type === 'goal') {
      ctx.fillStyle = '#ffd23f';
      ctx.font = `bold 14px ${PIXEL_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${CONFIG.GOAL_FLOOR}층 · 꼭대기`, CONFIG.GAME_W / 2, ly + CONFIG.PLAT_H + 8);
      drawDoorBack(plat.doorX, ly);
    }
  }
  ctx.globalAlpha = 1;
}

function drawCharacterAt(ch, lx, ly, dir, rising, walkFrame = false) {
  const w = CONFIG.CHAR_W;
  const h = CONFIG.CHAR_H;
  const side = dir < 0 ? 'left' : 'right';
  let holder = ch.sprites[`${side}_${rising ? 'jump' : walkFrame ? 'walk' : 'stand'}`];
  if (walkFrame && !holder.ok) holder = ch.sprites[`${side}_stand`];

  ctx.save();
  ctx.translate(snap(lx), snap(ly));

  if (holder.ok) {
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
  ctx.font = `bold 13px ${PIXEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(ch.name.charAt(0), 0, -12);
  ctx.restore();
}

/** walking이면 시각 t 기준으로 stand ↔ walk 번갈아 (종종걸음) */
function drawCharacter(ch, wx, wy, dir, rising, walking = false, t = state.now) {
  const walkFrame = walking && Math.floor(t / CONFIG.WALK_FRAME_MS) % 2 === 1;
  drawCharacterAt(ch, wx, toLY(wy), dir, rising, walkFrame);
}

/**
 * 문 밖으로 나가는 중인 k번째 캐릭터(0 = 메인) 위치. 아직 차례가 아니면 null
 * 문틀 안쪽 빛 속으로 옆으로 미끄러져 들어가고, 반대편 문틀 너머는 잘려서 안 보임
 */
function exitPose(k) {
  if (!state.exiting) return null;
  const t = state.now - (state.exitT + k * CONFIG.FOLLOW_DELAY_MS);
  if (t < 0) return null;
  const s = Math.min(1, t / CONFIG.EXIT_SLIDE_MS);
  const e = s;  // 일정한 속도로 걸어 나감
  const { x0, y0, dir, endX } = state.exitPath;
  return {
    x: x0 + (endX - x0) * e,
    y: y0 + (state.door.y - y0) * Math.min(1, s * 3),
    dir,
    done: s >= 1,
  };
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
  const exiting = state.exiting;

  // 나가는 중엔 문틀 바깥쪽 끝 너머를 잘라냄
  if (exiting) {
    const { clipX, dir } = state.exitPath;
    ctx.save();
    ctx.beginPath();
    if (dir > 0) ctx.rect(0, 0, clipX, viewLH);
    else ctx.rect(clipX, 0, CONFIG.GAME_W - clipX, viewLH);
    ctx.clip();
  }

  // 따라오는 캐릭터: 메인캐릭터 궤적을 시간차로 재생 (멀리 있는 캐릭터부터)
  for (let k = state.followers.length; k >= 1; k--) {
    const ch = state.followers[k - 1].ch;
    const ex = exitPose(k);
    if (ex) {
      if (!ex.done) drawCharacter(ch, ex.x, ex.y, ex.dir, false, true);
    } else if (state.history.length) {
      const ts = state.now - k * CONFIG.FOLLOW_DELAY_MS;
      const s = sampleHistory(ts);
      drawCharacter(ch, s.x, s.y, s.dir, s.rising, s.walking, ts);
    } else {
      // 시작 전: 메인캐릭터 뒤에 겹쳐서 서 있음
      drawCharacter(ch, p.x - p.dir * k * 8, p.y, p.dir, false);
    }
  }

  const main = getCharacter(state.selectedChar);
  const ex0 = exitPose(0);
  if (ex0) {
    if (!ex0.done) drawCharacter(main, ex0.x, ex0.y, ex0.dir, false, true);
  } else {
    // 공중에 있는 동안은 올라가든 내려가든 점프 이미지
    const rising = state.phase !== 'title' && !p.grounded;
    drawCharacter(main, p.x, p.y, p.dir, rising, p.grounded && Math.abs(p.vx) > 30);
  }

  if (exiting) ctx.restore();

  // 문짝은 캐릭터 위에 (문 뒤로 지나가는 느낌)
  const goal = state.platforms.find(pl => pl.type === 'goal');
  if (goal) {
    const ly = toLY(goal.y);
    if (ly > -40 && ly < viewLH + 120) drawDoorFront(goal.doorX, ly);
  }
}

function renderScene() {
  drawBackdrop();

  // 게임 영역 좌표계로 전환 + 영역 밖은 잘라냄
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, 0);
  ctx.imageSmoothingEnabled = false;  // 픽셀아트 선명하게
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CONFIG.GAME_W, viewLH);
  ctx.clip();

  drawWall();
  drawFloorMarks();
  drawHydrant();
  drawPlatforms();
  drawCharacters();
  drawParticles();
  drawMotes();
  drawAbyss();

  ctx.restore();
}

function render() {
  renderScene();
  if (state.wantShot) takeShot();
}

/* ─── 사진 (결과 화면 폴라로이드) ─── */
const shotBuffer = document.createElement('canvas');

/**
 * 결과 사진 촬영: 화면을 잘라오는 대신, 그 순간의 장면을 사진용 캔버스에 따로 한 번 더 그림
 * - 도트 1칸 = 사진 픽셀 정수 칸 → 안 찌그러짐
 * - 화면보다 넓게 (가로로 게임 영역 거의 전체가 담김)
 */
function takeShot() {
  const { wx, wy } = state.wantShot;
  state.wantShot = null;

  const N = Math.round(CONFIG.PHOTO_SIZE * dpr);                         // 사진 실제 픽셀 크기
  // 도트 1칸 = 정수 픽셀. 올림으로 정해서 찍히는 범위가 PHOTO_VIEW_W(게임 영역 폭)를 넘지 않게
  const artPx = Math.max(1, Math.ceil(N / (CONFIG.PHOTO_VIEW_W / CONFIG.PIX)));
  const viewWGame = (N / artPx) * CONFIG.PIX;  // 실제로 담기는 가로 범위
  // 캐릭터를 따라가되, 게임 영역 밖(검은 바깥)은 안 찍히게 좌우를 붙잡음
  const half = viewWGame / 2;
  const cx = Math.min(Math.max(wx, half), CONFIG.GAME_W - half);
  shotBuffer.width = N;
  shotBuffer.height = N;

  // 그리기 설정을 잠깐 사진용으로 바꿔서 같은 장면을 그림
  const saved = { ctx, dpr, viewW, viewH, scale, offX, viewLH, sideCut, cam: state.camBottom };
  ctx = shotBuffer.getContext('2d');
  dpr = 1;
  viewW = N;
  viewH = N;
  scale = artPx / CONFIG.PIX;
  viewLH = N / scale;
  offX = Math.round(N / 2 - cx * scale);
  state.camBottom = wy - viewLH / 2;
  try {
    renderScene();
  } finally {
    ({ ctx, dpr, viewW, viewH, scale, offX, viewLH, sideCut } = saved);
    state.camBottom = saved.cam;
  }
  state.shot = true;
}

/** 찍어둔 사진을 폴라로이드에 옮김 (1:1) */
function developPhoto() {
  if (!state.shot) {  // 찍어둔 사진이 없으면 지금 장면
    state.wantShot = { wx: state.player.x, wy: state.player.y + CONFIG.CHAR_H * 0.5 };
    takeShot();
  }
  photoCanvas.width = shotBuffer.width;
  photoCanvas.height = shotBuffer.height;
  const pctx = photoCanvas.getContext('2d');
  pctx.imageSmoothingEnabled = false;
  pctx.drawImage(shotBuffer, 0, 0);
}

/** 결과 화면/저장 이미지 맨 아래 두 줄: [제목 (· by 제작자)], [부제] */
function footerLines() {
  return [[GAME_TITLE, CREDIT && `by ${CREDIT}`].filter(Boolean).join(' · '), GAME_SUBTITLE];
}

/** 결과 화면 맨 아래: 제목 · by 제작자(누르면 CREDIT_URL) / 부제 */
function renderFooter() {
  tabletFoot.textContent = '';
  tabletFoot.append(GAME_TITLE);
  if (CREDIT) {
    tabletFoot.append(' · ');
    const url = safeCreditUrl();
    const el = document.createElement(url ? 'a' : 'span');
    el.textContent = `by ${CREDIT}`;
    if (url) {
      el.href = url;
      el.target = '_blank';            // 새 탭 → 게임 결과창은 그대로 남음
      el.rel = 'noopener noreferrer';  // 새 탭이 게임 페이지를 건드리지 못하게, 어디서 왔는지 안 넘김
      el.className = 'credit_link';
    }
    tabletFoot.append(el);
  }
  tabletFoot.append(document.createElement('br'), GAME_SUBTITLE);
}

/** https://bsky.app 주소만 링크로 씀 (오타나 다른 주소면 링크 없이 글자만) */
function safeCreditUrl() {
  try {
    const u = new URL(CREDIT_URL);
    return u.protocol === 'https:' && u.hostname === 'bsky.app' ? u.href : '';
  } catch {
    return '';
  }
}

/* ─── 효과음 (파일 없이 Web Audio로 합성. 값은 sound_test.html에서 조절해서 붙여넣기) ─── */
const SFX = {
  jump:    [{ wave: 'square', from: 320, to: 640, time: 0.08, vol: 0.12 }],
  spring:  [{ wave: 'square', from: 180, to: 900, time: 0.32, vol: 0.14, wobble: 40 }],
  land:    [{ wave: 'triangle', from: 160, to: 50, time: 0.12, vol: 0.3 }, { wave: 'noise', from: 0, to: 0, time: 0.08, vol: 0.12, cut: 600 }],
  crumble: [{ wave: 'noise', from: 0, to: 0, time: 0.3, vol: 0.22, cut: 1400 }, { wave: 'square', from: 140, to: 60, time: 0.18, vol: 0.06 }],
  floor:   [{ wave: 'square', from: 660, to: 660, time: 0.1, vol: 0.12 }, { wave: 'square', from: 990, to: 990, time: 0.18, vol: 0.12, delay: 0.1 }],
  summit:  [{ wave: 'square', from: 523, to: 523, time: 0.1, vol: 0.12 }, { wave: 'square', from: 659, to: 659, time: 0.1, vol: 0.12, delay: 0.1 }, { wave: 'square', from: 784, to: 784, time: 0.1, vol: 0.12, delay: 0.2 }, { wave: 'square', from: 1046, to: 1046, time: 0.3, vol: 0.12, delay: 0.3 }],
  door:    [{ wave: 'sawtooth', from: 220, to: 160, time: 0.35, vol: 0.06, wobble: 12 }, { wave: 'triangle', from: 880, to: 1760, time: 0.25, vol: 0.1, delay: 0.25 }],
  fall:    [{ wave: 'square', from: 700, to: 70, time: 0.7, vol: 0.12, wobble: 25 }],
  click:   [{ wave: 'triangle', from: 880, to: 660, time: 0.04, vol: 0.15 }],
  // 정상현 (heavy): 둔탁하고 묵직하게
  jumpHeavy:	[{"wave":"triangle","from":120,"to":60,"time":0.16,"vol":0.4},{"wave":"square","from":70,"to":110,"time":0.12,"vol":0.05},{"wave":"noise","from":0,"to":0,"time":0.1,"vol":0.16,"cut":350}],
  springHeavy:	[{"wave":"triangle","from":90,"to":50,"time":0.14,"vol":0.4},{"wave":"square","from":60,"to":360,"time":0.42,"vol":0.12,"wobble":18,"delay":0.04}],
  landHeavy:	[{"wave":"triangle","from":130,"to":32,"time":0.3,"vol":0.95},{"wave":"noise","from":0,"to":0,"time":0.22,"vol":0.22,"cut":450}],
  // if 모드 움직이는 계단: 밟을 때 "덜그럭", 부러질 때 "덩~"
  rattle:	[{"wave":"noise","from":0,"to":0,"time":0.05,"vol":0.3,"cut":1100},{"wave":"noise","from":0,"to":0,"time":0.05,"vol":0.36,"cut":800,"delay":0.06},{"wave":"noise","from":0,"to":0,"time":0.04,"vol":0.32,"cut":950,"delay":0.11},{"wave":"triangle","from":190,"to":150,"time":0.09,"vol":0.1}],
  snap:		[{"wave":"noise","from":0,"to":0,"time":0.12,"vol":0.26,"cut":2200},{"wave":"triangle","from":14,"to":96,"time":0.8,"vol":0.32},{"wave":"sine","from":208,"to":198,"time":0.55,"vol":0.12}],
};

const sound = {
  ctx: null,
  master: null,
  noise: null,
  sfxMuted: storage.get(STORAGE_KEYS.muteSfx, '0') === '1',
  bgmMuted: storage.get(STORAGE_KEYS.muteBgm, '0') === '1',

  /** 브라우저 정책상 클릭/키 입력 뒤에만 소리를 낼 수 있어서 첫 입력 때 준비 */
  unlock() {
    // 아이폰: 첫 터치(pointerdown)에선 재생이 막혀서 무음 오디오가 실패할 수 있음 → 다음 입력(touchend/click) 때 다시 시도
    if (this.silentMedia && this.silentMedia.paused) this.silentMedia.play().catch(() => {});
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // 아이폰: 웹 소리는 기본이 '알림음' 취급이라 무음 스위치를 켜면 안 들림 → '미디어' 취급으로 바꿈
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';  // iOS 17+
    } catch { /* 지원 안 하면 무시 */ }
    this.playSilentMedia();  // 구버전 iOS용: 무음 오디오를 같이 틀면 미디어 모드로 바뀜
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    bgm.start(this.ctx, this.master);
  },

  /** 소리 없는 아주 짧은 WAV를 반복 재생 (iOS 무음 스위치 우회용, 다른 기기에선 영향 없음) */
  playSilentMedia() {
    if (!/iPad|iPhone|iPod/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))) return;
    try {
      const rate = 8000;
      const n = rate / 10;  // 0.1초
      const buf = new ArrayBuffer(44 + n);
      const v = new DataView(buf);
      const str = (o, t) => { for (let k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); };
      str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE');
      str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
      str(36, 'data'); v.setUint32(40, n, true);
      for (let k = 0; k < n; k++) v.setUint8(44 + k, 128);  // 8bit 무음
      const audio = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
      audio.loop = true;
      audio.setAttribute('playsinline', '');
      audio.play().catch(() => {});
      this.silentMedia = audio;
    } catch { /* 무시 */ }
  },

  play(name) {
    if (this.sfxMuted || !this.ctx || !SFX[name]) return;
    const start = this.ctx.currentTime + 0.005;
    SFX[name].forEach(L => this.layer(L, start));
  },

  layer(L, start) {
    const c = this.ctx;
    const t = start + (L.delay || 0);
    const amp = c.createGain();
    amp.gain.setValueAtTime(L.vol, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + L.time);
    amp.connect(this.master);

    if (L.wave === 'noise') {
      const src = c.createBufferSource();
      src.buffer = this.noise;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(L.cut || 2000, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, (L.cut || 2000) / 5), t + L.time);
      src.connect(filter).connect(amp);
      src.start(t);
      src.stop(t + L.time);
      return;
    }

    const osc = c.createOscillator();
    osc.type = L.wave;
    osc.frequency.setValueAtTime(Math.max(1, L.from), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, L.to), t + L.time);
    if (L.wobble) {
      const lfo = c.createOscillator();
      const depth = c.createGain();
      lfo.frequency.value = 28;
      depth.gain.value = L.wobble;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + L.time);
    }
    osc.connect(amp);
    osc.start(t);
    osc.stop(t + L.time);
  },

  toggleSfx() {
    this.sfxMuted = !this.sfxMuted;
    storage.set(STORAGE_KEYS.muteSfx, this.sfxMuted ? '1' : '0');
    updateSoundBtns();
  },

  toggleBgm() {
    this.bgmMuted = !this.bgmMuted;
    storage.set(STORAGE_KEYS.muteBgm, this.bgmMuted ? '1' : '0');
    bgm.setMuted(this.bgmMuted);
    updateSoundBtns();
  },
};

/* ─── 배경음: 무너지는 해저기지 앰비언트 (파일 없이 실시간 합성) ───
 * 메인: 진공 ~ 물속 같은 먹먹한 공간감
 *   - 계단통로를 타고 흐르는 바람 소리 (휘이잉, 천천히 돌풍처럼)
 *   - 물속 웅얼거림 (깎아낸 잡음이 천천히 밀려왔다 빠짐)
 *   - 아주 옅게 깔리는 화음
 *   - 가끔 똑… 물방울, 보글보글 기포
 * 가끔:
 *   - 쇠파이프끼리 부딪히는 "깡… 깡… 깡…"
 *   - 철골이 휘다가 부러지는 "끼이익-드드득-쿵"
 * 위로 올라갈수록 바람이 조금씩 세짐
 */
const BGM_VOLUME = 0.5;   // 배경음 전체 크기 (효과음 대비). 0이면 배경음 끔
const CONFIG_SFX = {
  clankVol: 0.09,   // 쇠파이프 "깡" 크기
  creakVol: 0.085,  // 철골 휘고 부러지는 소리 크기
};

const bgm = {
  ctx: null,
  out: null,
  far: null,         // 멀리서 들리는 소리용 (먹먹하게 깎음)
  windFilter: null,
  reverb: null,
  echo: null,
  chordIdx: 0,

  start(ctx, master) {
    if (this.ctx || BGM_VOLUME <= 0) return;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.linearRampToValueAtTime(BGM_VOLUME, ctx.currentTime + 4);  // 서서히 커짐
    // 배경음 켜기/끄기 스위치
    this.bus = ctx.createGain();
    this.bus.gain.value = sound.bgmMuted ? 0 : 1;
    this.bus.connect(master);
    this.out.connect(this.bus);

    // 잔향: 넓고 울리는 콘크리트/철 구조물 공간
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 4;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 2.5);
    }
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    this.reverb.connect(wet).connect(this.out);

    // 멀리서 들리는 소리: 고음을 깎아서 물 건너 들리는 것처럼
    this.far = ctx.createBiquadFilter();
    this.far.type = 'lowpass';
    this.far.frequency.value = 1400;
    this.far.connect(this.reverb);
    const farDry = ctx.createGain();
    farDry.gain.value = 0.35;
    this.far.connect(farDry).connect(this.out);

    // 메아리 (물방울용)
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    this.echo.connect(fb).connect(this.echo);
    this.echo.connect(this.reverb);
    this.echo.connect(this.out);

    this.startWind();
    this.startPressure();
    this.nextChord();
    this.later(() => this.scheduleDrip(), 2000);
    this.later(() => this.scheduleBubbles(), 5000);
    this.later(() => this.scheduleClank(), 6000 + Math.random() * 6000);
    this.later(() => this.scheduleCreak(), 14000 + Math.random() * 8000);
  },

  /** 바람 소리: 잡음을 좁게 걸러서 "휘이잉", 가운데 음높이와 세기가 천천히 바뀌며 돌풍처럼 */
  startWind() {
    const c = this.ctx;
    // 두 줄기를 다른 속도로 움직여서 단조롭지 않게
    [[420, 0.023, 0.045], [760, 0.037, 0.028]].forEach(([center, speed, vol]) => {
      const src = c.createBufferSource();
      src.buffer = sound.noise;
      src.loop = true;
      src.playbackRate.value = 0.7 + Math.random() * 0.3;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = center;
      bp.Q.value = 6;
      const sweep = c.createOscillator();
      const sweepDepth = c.createGain();
      sweep.frequency.value = speed;
      sweepDepth.gain.value = center * 0.45;
      sweep.connect(sweepDepth).connect(bp.frequency);
      const g = c.createGain();
      g.gain.value = vol;
      const gust = c.createOscillator();
      const gustDepth = c.createGain();
      gust.frequency.value = speed * 1.7;
      gustDepth.gain.value = vol * 0.8;
      gust.connect(gustDepth).connect(g.gain);
      src.connect(bp).connect(g);
      g.connect(this.out);
      g.connect(this.reverb);
      src.start();
      sweep.start();
      gust.start();
      if (!this.windFilter) this.windFilter = bp;
    });
  },

  /** 물속 웅얼거림: 아주 낮게 깎은 잡음이 파도처럼 천천히 밀려왔다 빠짐 */
  startPressure() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = sound.noise;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    lp.Q.value = 1.5;
    const g = c.createGain();
    g.gain.value = 0.11;
    const swell = c.createOscillator();
    const swellDepth = c.createGain();
    swell.frequency.value = 0.09;
    swellDepth.gain.value = 0.06;
    swell.connect(swellDepth).connect(g.gain);
    const cutLfo = c.createOscillator();
    const cutDepth = c.createGain();
    cutLfo.frequency.value = 0.031;
    cutDepth.gain.value = 70;
    cutLfo.connect(cutDepth).connect(lp.frequency);
    src.connect(lp).connect(g);
    g.connect(this.out);
    g.connect(this.reverb);
    src.start();
    swell.start();
    cutLfo.start();
  },

  /** 아주 옅은 화음 (분위기만): 10초마다 천천히 바뀜 */
  nextChord() {
    const chords = [
      [110, 130.8, 164.8],   // Am
      [87.3, 110, 130.8],    // F
      [98, 123.5, 146.8],    // G
      [82.4, 98, 123.5],     // Em
    ];
    const c = this.ctx;
    const t = c.currentTime;
    const dur = 12;
    chords[this.chordIdx % chords.length].forEach((f, k) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f * 2;
      o.detune.value = (k - 1) * 7;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.012, t + 4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.reverb);
      o.start(t);
      o.stop(t + dur);
    });
    this.chordIdx++;
    this.later(() => this.nextChord(), 10000);
  },

  /** 물방울: 높은 음이 순식간에 떨어지는 "똑" + 메아리 */
  scheduleDrip() {
    const c = this.ctx;
    const t = c.currentTime;
    const f = 900 + Math.random() * 1400;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.35, t + 0.09);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.echo);
    o.start(t);
    o.stop(t + 0.15);
    this.later(() => this.scheduleDrip(), 2500 + Math.random() * 6000);
  },

  /** 기포: 보글보글 짧게 올라가는 소리 몇 개 */
  scheduleBubbles() {
    const c = this.ctx;
    const n = 3 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const t = c.currentTime + k * (0.05 + Math.random() * 0.09);
      const f = 220 + Math.random() * 260;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.05);
      g.gain.setValueAtTime(0.025, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g).connect(this.far);
      o.start(t);
      o.stop(t + 0.08);
    }
    this.later(() => this.scheduleBubbles(), 6000 + Math.random() * 9000);
  },

  /** 철골이 휘다가 부러지는 소리 (18~32초에 한 번)
   *  1) "끼이이익" 쇠가 버티며 휘는 신음  2) "드드드득" 금이 가며 갈라짐  3) "쿵" 떨어져 나감 */
  scheduleCreak() {
    const c = this.ctx;
    const t = c.currentTime;
    const groan = 1.2 + Math.random() * 0.8;   // 끼이이익 길이
    const crack = 0.5 + Math.random() * 0.3;   // 드드드득 길이
    const vol = CONFIG_SFX.creakVol;

    // 1) 끼이이익: 톱니파를 떨리게 해서 쇠가 비틀리는 소리
    const base = 80 + Math.random() * 50;   // 낮을수록 묵직
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * 1.6, t + groan);
    const jitter = c.createOscillator();
    const jitterDepth = c.createGain();
    jitter.type = 'square';
    jitter.frequency.value = 22 + Math.random() * 10;
    jitterDepth.gain.value = base * 0.12;
    jitter.connect(jitterDepth).connect(o.frequency);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(340, t);
    bp.frequency.linearRampToValueAtTime(800, t + groan);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.8, t + groan * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + groan + 0.1);
    o.connect(bp).connect(g);
    g.connect(this.out);
    g.connect(this.reverb);
    o.start(t);
    o.stop(t + groan + 0.1);
    jitter.start(t);
    jitter.stop(t + groan + 0.1);

    // 2) 드드드득: 짧은 "딱"이 점점 빨라지며 이어짐
    let tt = t + groan - 0.1;
    let gapMs = 0.07;
    while (tt < t + groan + crack) {
      const s = c.createBufferSource();
      s.buffer = sound.noise;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 600 + Math.random() * 1000;
      f.Q.value = 2;
      const tg = c.createGain();
      tg.gain.setValueAtTime(vol * (0.6 + Math.random() * 0.6), tt);
      tg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.025);
      s.connect(f).connect(tg);
      tg.connect(this.out);
      tg.connect(this.reverb);
      s.start(tt, Math.random() * 0.5, 0.03);
      tt += gapMs * (0.6 + Math.random() * 0.8);
      gapMs = Math.max(0.018, gapMs * 0.88);
    }

    // 3) 쿵: 떨어져 나간 조각이 멀리서 부딪힘
    const thud = t + groan + crack + 0.15;
    const k = c.createOscillator();
    const kg = c.createGain();
    k.type = 'sine';
    k.frequency.setValueAtTime(85, thud);
    k.frequency.exponentialRampToValueAtTime(32, thud + 0.4);
    kg.gain.setValueAtTime(vol * 1.8, thud);
    kg.gain.exponentialRampToValueAtTime(0.0001, thud + 0.6);
    k.connect(kg);
    kg.connect(this.out);
    kg.connect(this.reverb);
    k.start(thud);
    k.stop(thud + 0.65);
    // 쿵에 섞이는 둔탁한 잔해 소리
    const rub = c.createBufferSource();
    rub.buffer = sound.noise;
    const rlp = c.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 400;
    const rg = c.createGain();
    rg.gain.setValueAtTime(vol * 1.2, thud);
    rg.gain.exponentialRampToValueAtTime(0.0001, thud + 0.35);
    rub.connect(rlp).connect(rg);
    rg.connect(this.out);
    rg.connect(this.reverb);
    rub.start(thud, Math.random() * 0.5, 0.4);

    this.later(() => this.scheduleCreak(), 18000 + Math.random() * 14000);
  },

  /** 쇠파이프끼리 부딪히는 "깡… 깡… 깡…" (12~25초에 한 번, 2~4번 연달아 점점 작게) */
  scheduleClank() {
    const c = this.ctx;
    const f = 260 + Math.random() * 180;
    const hits = 2 + Math.floor(Math.random() * 3);
    const gap = 0.55 + Math.random() * 0.35;
    for (let h = 0; h < hits; h++) {
      const t = c.currentTime + h * gap * (1 + h * 0.08);
      const vol = CONFIG_SFX.clankVol * Math.pow(0.7, h);
      this.clank(t, f * (1 - h * 0.01), vol);
    }
    this.later(() => this.scheduleClank(), 12000 + Math.random() * 13000);
  },

  /** 쇠파이프 한 번 "깡": 짧은 충격음이 파이프 고유 울림 몇 개를 짧게 울림 (종처럼 길게 안 끌림) */
  clank(t, f, vol) {
    const c = this.ctx;
    // 1) 맞부딪히는 순간의 금속성 충격 (잡음 + 파이프 공명 필터)
    const s = c.createBufferSource();
    s.buffer = sound.noise;
    const hit = c.createGain();
    hit.gain.setValueAtTime(vol * 3, t);
    hit.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.connect(hit);
    [[1, 18, 0.35], [2.6, 22, 0.22], [4.9, 26, 0.14]].forEach(([m, q, len]) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * m;
      bp.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(1, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      hit.connect(bp).connect(g);
      g.connect(this.out);
      g.connect(this.reverb);
    });
    s.start(t, Math.random() * 0.5, 0.08);

    // 2) 속이 빈 파이프 몸통 울림: 짧게 끊기는 "깡"
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.02, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const og = c.createGain();
    og.gain.setValueAtTime(vol * 0.7, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(og);
    og.connect(this.out);
    og.connect(this.reverb);
    o.start(t);
    o.stop(t + 0.3);
  },

  /** 탭이 숨겨져 있거나 음소거면 예약을 미룸 (소리가 쌓이지 않게) */
  later(fn, ms) {
    setTimeout(() => {
      if (document.hidden || sound.bgmMuted) this.later(fn, 1000);
      else fn();
    }, ms);
  },

  setMuted(m) {
    if (this.bus) this.bus.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.3);
  },

  /** 높이에 따라 바람 소리를 조금씩 높고 밝게 (0 = 시작층, 1 = 꼭대기) */
  setHeight(t) {
    if (!this.windFilter) return;
    this.windFilter.Q.setTargetAtTime(6 - t * 2.5, this.ctx.currentTime, 1.5);
    this.out.gain.setTargetAtTime(BGM_VOLUME * (1 + t * 0.15), this.ctx.currentTime, 2);
  },
};

function updateSoundBtns() {
  sfxBtn.classList.toggle('off', sound.sfxMuted);
  bgmBtn.classList.toggle('off', sound.bgmMuted);
  sfxBtn.title = sound.sfxMuted ? '효과음 켜기' : '효과음 끄기';
  bgmBtn.title = sound.bgmMuted ? '배경음 켜기' : '배경음 끄기';
}

/* ─── 결과 이미지 저장 / 공유 (외부 API 없이 브라우저 기능만 사용) ─── */
let shareBlob = null;

/**
 * 결과 화면(태블릿)과 같은 모양으로 이미지 한 장을 그림 — 버튼만 빼고 아래에 게임 이름 한 줄
 * 수치는 style.css의 태블릿/폴라로이드 값과 맞춰 둠 (2배 해상도)
 */
function prepareShareImage(info) {
  shareBlob = null;
  const S = dpr * Math.max(1, Math.round(2 / dpr));  // 해상도 배율 (사진이 1:1 또는 정수배가 되도록)
  const INK = '#141a22';
  const FONT = '"Galmuri11", "Galmuri9", monospace';
  const FONT_BIG = '"Galmuri14", "Galmuri11", monospace';
  const rows = [...document.querySelectorAll('.profile_stats li')].map(li => [
    li.querySelector('span').textContent,
    li.querySelector('b').textContent,
  ]);

  // ── 레이아웃 (CSS px 기준) ──
  const OUT = 4;                    // 태블릿 바깥 검은 테두리
  const TABLET_W = 340;
  const BEZEL = 14;
  const SCREEN_W = TABLET_W - BEZEL * 2;
  const PAD_X = 16;
  const PAD_TOP = 18;
  const PH = CONFIG.PHOTO_SIZE;
  const POL_W = PH + 16;
  const POL_H = 8 + PH + 32;
  const LIST_W = SCREEN_W - PAD_X * 2 - 4;

  let y = PAD_TOP + 10;             // 테이프 높이만큼 여유
  const polTop = y;
  y += POL_H + 16;
  const bestY = y;
  if (info.isNewBest) y += 18 + 12;
  const STAT_H = 16;
  const PROF_H = Math.max(80, 16 + 10 + rows.length * STAT_H) + 16;
  const profTop = y;
  y += PROF_H;
  const footY = y + 22;
  const SCREEN_H = footY + 16 + 16;
  const W = (TABLET_W + OUT * 2) * S;
  const H = (SCREEN_H + BEZEL * 2 + OUT * 2) * S;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.scale(S, S);

  // 태블릿 베젤
  g.fillStyle = INK;
  g.fillRect(OUT, 0, TABLET_W, SCREEN_H + BEZEL * 2 + OUT * 2);
  g.fillRect(0, OUT, TABLET_W + OUT * 2, SCREEN_H + BEZEL * 2);
  g.fillStyle = '#2b3038';
  g.fillRect(OUT, OUT, TABLET_W, SCREEN_H + BEZEL * 2);
  g.fillStyle = '#3d444e';
  g.fillRect(OUT, OUT, TABLET_W, 4);
  g.fillStyle = '#1f2329';
  g.fillRect(OUT, OUT + SCREEN_H + BEZEL * 2 - 4, TABLET_W, 4);

  // 화면
  const sx = OUT + BEZEL;
  const sy = OUT + BEZEL;
  g.fillStyle = '#11151a';
  g.fillRect(sx - 3, sy - 3, SCREEN_W + 6, SCREEN_H + 6);
  g.fillStyle = '#eef3f0';
  g.fillRect(sx, sy, SCREEN_W, SCREEN_H);
  g.save();
  g.translate(sx, sy);
  const cx = SCREEN_W / 2;

  // 폴라로이드 (사진은 기울이지 않음 — 도트 보존)
  g.save();
  g.translate(Math.round(cx), Math.round(polTop + POL_H / 2));
  const px0 = -POL_W / 2;
  const py0 = -POL_H / 2;
  g.fillStyle = 'rgba(20, 26, 34, 0.25)';
  g.fillRect(px0 + 4, py0 + 5, POL_W, POL_H);
  g.fillStyle = INK;
  g.fillRect(px0 - 2, py0 - 2, POL_W + 4, POL_H + 4);
  g.fillStyle = '#fffdf7';
  g.fillRect(px0, py0, POL_W, POL_H);
  g.fillStyle = INK;
  g.fillRect(px0 + 6, py0 + 6, PH + 4, PH + 4);
  g.drawImage(photoCanvas, px0 + 8, py0 + 8, PH, PH);
  g.fillStyle = INK;
  g.font = `11px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(info.caption, 0, py0 + 8 + PH + 16);
  // 테이프 (+4도)
  g.save();
  g.translate(0, py0 - 1);
  g.rotate(4 * Math.PI / 180);
  g.fillStyle = 'rgba(255, 210, 63, 0.75)';
  g.fillRect(-28, -8, 56, 16);
  g.restore();
  // 층수 스티커 (폴라로이드 기준 오른쪽 아래, +8도)
  g.font = `bold 28px ${FONT_BIG}`;
  const label = `${info.floor}층!`;
  const tw = g.measureText(label).width;
  const stW = tw + 24;
  const stH = 28 + 14;
  g.save();
  g.translate(POL_W / 2 + 10 - stW / 2, POL_H / 2 - 48 - stH / 2);
  g.rotate(8 * Math.PI / 180);
  g.fillStyle = 'rgba(20, 26, 34, 0.3)';
  g.fillRect(-stW / 2, -stH / 2, stW + 6, stH + 6);
  g.fillStyle = INK;
  g.fillRect(-stW / 2 - 3, -stH / 2 - 3, stW + 6, stH + 6);
  g.fillStyle = info.cleared ? '#3cb894' : '#d9607f';
  g.fillRect(-stW / 2, -stH / 2, stW, stH);
  g.fillStyle = 'rgba(20, 26, 34, 0.35)';
  g.fillText(label, 2, 3);
  g.fillStyle = '#fff';
  g.fillText(label, 0, 1);
  g.restore();
  g.restore();

  // 최고 기록
  if (info.isNewBest) {
    g.fillStyle = '#d9607f';
    g.font = `bold 14px ${FONT_BIG}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('★ 최고 기록 ★', cx, bestY + 5);
  }

  // 프로필 (선택한 캐릭터 왼쪽 스탠드 도트)
  const lx = PAD_X + 2;
  g.fillStyle = '#c9d3cf';
  g.fillRect(lx - 2, profTop - 2, LIST_W + 4, PROF_H + 4);
  g.fillStyle = '#fff';
  g.fillRect(lx, profTop, LIST_W, PROF_H);
  const picX = lx + 10;
  const picY = profTop + Math.round((PROF_H - 80) / 2);
  g.fillStyle = INK;
  g.fillRect(picX - 2, picY - 2, 60, 84);
  g.fillStyle = '#ffd23f';
  g.fillRect(picX, picY, 56, 80);
  const pic = getCharacter(state.selectedChar).sprites.left_stand;
  if (pic && pic.ok) g.drawImage(pic.el, picX + 4, picY + 8, 48, 72);  // 16×24 의 3배
  // 오른쪽: 이름 / 캐릭터 / 기록
  const ix = picX + 70;
  const iw = lx + LIST_W - 10 - ix;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  // 캐릭터 이름 + 닉네임 한 줄 (길면 닉네임을 … 로 줄임)
  const headY = profTop + 16;
  g.textBaseline = 'alphabetic';
  const charText = recChar.textContent;
  g.fillStyle = '#6b7484';
  g.font = `11px ${FONT}`;
  g.fillText(charText, ix, headY + 5);
  const nameX = ix + Math.ceil(g.measureText(charText).width) + 6;
  g.font = `bold 14px ${FONT_BIG}`;
  let nameText = recName.textContent;
  const nameMax = ix + iw - nameX;
  if (g.measureText(nameText).width > nameMax) {
    while (nameText.length > 1 && g.measureText(nameText + '…').width > nameMax) nameText = nameText.slice(0, -1);
    nameText += '…';
  }
  g.fillStyle = INK;
  g.fillText(nameText, nameX, headY + 5);
  g.textBaseline = 'middle';
  const statsTop = profTop + 28;
  g.fillStyle = '#d5ddd9';
  for (let dx = 0; dx < iw; dx += 4) g.fillRect(ix + dx, statsTop - 4, 2, 2);
  rows.forEach(([k, v], n) => {
    const ry = statsTop + 8 + n * STAT_H;
    g.textAlign = 'left';
    g.fillStyle = '#6b7484';
    g.font = `11px ${FONT}`;
    g.fillText(k, ix, ry);
    g.textAlign = 'right';
    g.fillStyle = INK;
    g.font = `bold 11px ${FONT}`;
    g.fillText(v, ix + iw, ry);
  });
  g.font = `11px ${FONT}`;

  // 게임 이름
  g.textAlign = 'center';
  g.fillStyle = '#6b7484';
  const [foot1, foot2] = footerLines();
  g.fillText(foot1, cx, footY);
  g.fillText(foot2, cx, footY + 16);
  g.restore();

  try {
    c.toBlob(blob => { shareBlob = blob; }, 'image/png');
  } catch (err) {
    // 파일을 직접 열었을 때(file://)는 브라우저 보안상 저장 불가. Live Server / GitHub Pages에선 정상
    if (location.protocol !== 'file:') console.warn('결과 이미지 생성 실패:', err);
  }
}

/** 모바일: 공유 시트(카톡, 인스타 등) / PC: PNG 다운로드 */
// 손가락으로 조작하는 기기(폰/태블릿)인지
const IS_TOUCH_DEVICE = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

function saveImage() {
  if (!shareBlob) {
    showToast(location.protocol === 'file:'
      ? '파일로 직접 열면 저장이 안 돼요 (Live Server로 열기)'
      : '이미지를 만드는 중이에요. 잠시 후 다시 눌러주세요', CONFIG.TOAST_MS);
    return;
  }
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const safeTitle = GAME_TITLE.replace(/[\\/:*?"<>|]/g, '').trim() || 'result';
  const fileName = `${safeTitle}_${ymd}.png`;

  // 폰: 공유 창을 열어 "이미지 저장" → 사진 앱에 저장 (아이폰은 다운로드하면 파일 앱으로만 가서)
  //     문구 없이 이미지 파일만 넘김
  if (IS_TOUCH_DEVICE && navigator.canShare) {
    const file = new File([shareBlob], fileName, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(() => { /* 취소해도 아무 일 없음 */ });
      return;
    }
  }

  // PC: PNG 파일로 바로 다운로드
  const url = URL.createObjectURL(shareBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ─── 메인 루프 (타이틀 화면에서도 배경으로 계속 그림) ─── */
function loop(ts) {
  if (state.lastTs === null) state.lastTs = ts;
  const dtMs = Math.min(33, ts - state.lastTs);
  state.lastTs = ts;
  state.now += dtMs;

  // 설정 화면에서는 멈춘 상태로 그리기만 함 (게임 시작 버튼을 눌러야 움직임)
  if (state.phase !== 'title' && !state.paused) update(dtMs / 1000);
  render();
  requestAnimationFrame(loop);
}

/* ─── HUD ─── */
function setText(el, key, value) {
  if (state.hudCache[key] === value) return false;
  state.hudCache[key] = value;
  el.textContent = value;
  return true;
}

function updateHUD() {
  const s = stairsOf(state.player.maxY);
  if (setText(floorDisplay, 'floor', `${floorOf(s)}층`) && state.phase === 'playing') {
    floorDisplay.classList.remove('bump');
    void floorDisplay.offsetWidth;
    floorDisplay.classList.add('bump');
  }
  setText(stairsDisplay, 'stairs', `${s}/${CONFIG.GOAL_STAIRS}`);
  setText(timeDisplay, 'time', formatClock(state.elapsed));
}

let toastTimer = null;

/** 층 통과 팝업: 큰 숫자 + 반짝이 + 튀어나오는 효과 */
function showFloorToast(floor) {
  toastEl.classList.remove('visible', 'floor');
  toastEl.innerHTML = '';
  const big = document.createElement('b');
  big.className = 'toast_big';
  big.textContent = `${floor}층!`;
  const l = document.createElement('i');
  l.className = 'toast_spark l';
  l.textContent = '✦';
  const r = document.createElement('i');
  r.className = 'toast_spark r';
  r.textContent = '✦';
  toastEl.append(l, big, r);
  void toastEl.offsetWidth;  // 애니메이션 다시 시작
  toastEl.classList.add('floor', 'visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), CONFIG.TOAST_MS);
}
function showToast(text, duration = 1800) {
  toastEl.classList.remove('floor');
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), duration);
}

/* ─── 일시정지 ─── */
function setPaused(on) {
  state.paused = on;
  state.keys.left = false;
  state.keys.right = false;
  pauseScreen.classList.toggle('hidden', !on);
  pauseBtn.classList.toggle('paused', on);
  pauseBtn.querySelector('.sound_label').textContent = on ? '계속' : '정지';
  pauseBtn.setAttribute('aria-label', on ? '계속하기' : '일시정지');
  if (state.phase === 'playing') touchControls.classList.toggle('hidden', on);
}

function togglePause() {
  if (state.phase !== 'playing') return;
  setPaused(!state.paused);
}

/* ─── 게임 흐름 ─── */
function startGame() {
  resetGame();
  setPaused(false);
  state.phase = 'playing';
  pauseBtn.classList.remove('hidden');
  startScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  soundToggles.classList.remove('hidden');
  hudEl.classList.remove('hidden');
  touchControls.classList.remove('hidden');
}

/* ─── 꼭대기 ─── */
function reachSummit(plat) {
  state.summit = true;
  state.summitTimeMs = Math.round(state.elapsed);
  state.door = { x: plat.doorX, y: plat.y };
  showToast('꼭대기 도착! 문으로 가자', CONFIG.TOAST_MS);
  sound.play('summit');
}

function checkDoor() {
  const p = state.player;
  const d = state.door;
  const hw = CONFIG.HITBOX_W / 2;
  const inX = p.x + hw > d.x && p.x - hw < d.x + CONFIG.DOOR_W;
  const inY = p.y < d.y + CONFIG.DOOR_H;
  if (inX && inY) {
    // 메인캐릭터부터 문 밖으로 미끄러져 나감 → 따라오는 캐릭터도 같은 지점에 도착하는 순서대로 나감
    const { innerL, innerR } = doorGeom(d.x);
    const dir = p.x < (innerL + innerR) / 2 ? 1 : -1;   // 다가온 방향으로 계속 진행
    const clipX = dir > 0 ? innerR : innerL;              // 반대편 문틀 안쪽 끝
    state.exitPath = {
      x0: p.x,
      y0: p.y,
      dir,
      clipX,
      endX: clipX + dir * (CONFIG.CHAR_W / 2 + 2),
    };
    state.exiting = true;
    sound.play('door');
    state.exitShotTaken = false;
    state.exitT = state.now;
    state.cleared = true;
    state.keys.left = false;
    state.keys.right = false;
    touchControls.classList.add('hidden');
  }
}

function endGame(reason) {
  if (state.phase !== 'playing') return;
  pauseBtn.classList.add('hidden');
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
  if (isNewBest) storage.set(STORAGE_KEYS.best + CONFIG.DIFFICULTY, JSON.stringify(result));

  const nickname = storage.get(STORAGE_KEYS.nickname, '') || '이름없음';
  const now = new Date();
  const h12 = now.getHours() % 12 || 12;
  const ampm = now.getHours() < 12 ? 'AM' : 'PM';
  const time = `${String(h12).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}${ampm}`;
  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  photoStamp.classList.toggle('fail', !cleared);
  photoStamp.textContent = `${floorOf(result.stairs)}층!`;

  recName.textContent = nickname;
  recChar.textContent = getCharacter(state.selectedChar).name;
  profileImg.style.visibility = 'hidden';  // 이미지 없는 캐릭터는 빈칸 (깨진 그림 표시 방지)
  profileImg.onload = () => { profileImg.style.visibility = ''; };
  profileImg.src = spritePath(getCharacter(state.selectedChar), 'left_stand');
  recMode.textContent = DIFFICULTY_NAMES[CONFIG.DIFFICULTY];
  recStairs.textContent = `${result.stairs.toLocaleString()} / ${CONFIG.GOAL_STAIRS.toLocaleString()}`;
  recTime.textContent = formatRecord(result.timeMs);
  photoCaption.textContent = `${date} ${time}`;
  developPhoto();
  prepareShareImage({
    floor: floorOf(result.stairs),
    cleared,
    isNewBest: false,  // 결과 화면에서 최고 기록 표시는 뺌 (기록 저장은 랭킹용으로 계속 함)
    caption: photoCaption.textContent,
  });

  // [DB] 2차 작업: 여기서 랭킹 등록 (닉네임#태그, 캐릭터, stairs, timeMs)
  //      정렬: stairs DESC, time_ms ASC

  // 스테이지 해금 (이 페이지가 열려 있는 동안만)
  const newlyOpened = cleared
    ? STAGES.filter(s => s.unlockBy && !unlockedStages.has(s.id)
        && s.unlockBy.stage === state.stage && s.unlockBy.diff === CONFIG.DIFFICULTY)
    : [];
  newlyOpened.forEach(s => unlockedStages.add(s.id));
  if (newlyOpened.length) buildStageTabs();

  // 문 통과 → 결과 표시 (엔딩 연출은 나중에 여기에)
  setTimeout(() => {
    gameoverScreen.classList.remove('hidden');
    soundToggles.classList.add('hidden');  // 결과 태블릿과 겹쳐서 숨김
    newlyOpened.forEach(s => showToast(`${s.name} 해금!`, 3000));
  }, cleared ? 200 : 600);
}

function goToTitle() {
  setPaused(false);
  pauseBtn.classList.add('hidden');
  state.phase = 'title';
  resetGame(true);
  gameoverScreen.classList.add('hidden');
  soundToggles.classList.remove('hidden');
  hudEl.classList.add('hidden');
  touchControls.classList.add('hidden');
  startScreen.classList.remove('hidden');
}

/* ─── 설정 화면 ─── */
function buildStageTabs() {
  stageTabs.innerHTML = '';
  STAGES.forEach(st => {
    const locked = !unlockedStages.has(st.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stage_tab';
    btn.dataset.id = st.id;
    btn.setAttribute('role', 'tab');
    btn.classList.toggle('locked', locked);
    btn.classList.toggle('selected', st.id === state.stage);
    btn.setAttribute('aria-selected', String(st.id === state.stage));
    btn.textContent = locked ? (st.lockedName || st.name) : st.name;
    if (locked) {
      const lock = document.createElement('span');
      lock.className = 'stage_lock';
      lock.setAttribute('aria-hidden', 'true');
      btn.appendChild(lock);
    } else if (st.unlockBy && !seenStages.has(st.id)) {
      // 새로 열린 스테이지: 한 번 누를 때까지 NEW! 딱지
      const badge = document.createElement('span');
      badge.className = 'stage_new';
      badge.textContent = 'NEW!';
      btn.appendChild(badge);
    }
    btn.addEventListener('click', () => {
      if (!unlockedStages.has(st.id)) return;  // 잠긴 탭은 눌러도 반응 없음 (해금 조건은 비밀)
      selectStage(st.id);
    });
    stageTabs.appendChild(btn);
  });
}

function selectStage(id, charId) {
  const st = getStage(unlockedStages.has(id) ? id : STAGES[0].id);
  seenStages.add(st.id);
  stageTabs.querySelector(`.stage_tab[data-id="${st.id}"] .stage_new`)?.remove();
  state.stage = st.id;
  stageTabs.querySelectorAll('.stage_tab').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === st.id);
    el.setAttribute('aria-selected', String(el.dataset.id === st.id));
  });
  stageHint.textContent = st.hint;
  buildCharGrid();
  buildDiffGrid();
  selectDifficulty(st.defaultDiff);
  selectCharacter(st.chars.includes(charId) ? charId : st.chars[0]);
}

function buildCharGrid() {
  charGrid.innerHTML = '';
  // 카드 크기는 5명일 때와 같게, 인원이 적으면 가운데 정렬
  const chars = getStage().chars;
  charGrid.style.gridTemplateColumns = `repeat(${chars.length}, calc((100% - 56px) / 5))`;
  chars.map(getCharacter).forEach(ch => {
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
  resetGame(true); // 타이틀 배경에도 선택한 캐릭터 반영 (계단 배치는 고정)
}

function buildDiffGrid() {
  diffGrid.innerHTML = '';
  const levels = getStage().diffs;
  diffGrid.style.gridTemplateColumns = `repeat(${levels.length}, 1fr)`;
  levels.forEach(key => {
    const level = Number(key);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'diff_btn';
    btn.dataset.level = level;
    btn.innerHTML = `<b>${level}</b>${DIFFICULTY_NAMES[level]}`;
    btn.addEventListener('click', () => selectDifficulty(level));
    diffGrid.appendChild(btn);
  });
}

function selectDifficulty(level) {
  applyDifficulty(level);
  storage.set(STORAGE_KEYS.diff, String(CONFIG.DIFFICULTY));
  diffGrid.querySelectorAll('.diff_btn').forEach(el => {
    el.classList.toggle('selected', Number(el.dataset.level) === CONFIG.DIFFICULTY);
  });
  resetGame(true);
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
pauseBtn.addEventListener('click', () => { togglePause(); pauseBtn.blur(); });
pauseRestartBtn.addEventListener('click', startGame);
quitBtn.addEventListener('click', goToTitle);
// 다른 탭으로 가거나 앱을 내리면 자동 일시정지
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.phase === 'playing' && !state.exiting) setPaused(true);
});

// 소리: 첫 클릭/터치/키 입력 때 준비. 버튼 누를 때 "톡"
['pointerdown', 'touchend', 'click', 'keydown'].forEach(type => {
  document.addEventListener(type, () => sound.unlock(), { capture: true });
});
document.addEventListener('click', e => {
  if (e.target.closest('button') && !e.target.closest('.sound_btn, .touch_btn')) sound.play('click');
});
sfxBtn.addEventListener('click', () => {
  sound.unlock();
  sound.toggleSfx();
  sfxBtn.blur();
});
bgmBtn.addEventListener('click', () => {
  sound.unlock();
  sound.toggleBgm();
  bgmBtn.blur();
});
updateSoundBtns();
renderFooter();
saveBtn.addEventListener('click', saveImage);

nicknameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleStart();
});

// 키보드: ← / → (또는 A / D) 누르고 있는 동안 이동
const KEY_MAP = { ArrowLeft: 'left', ArrowRight: 'right', a: 'left', d: 'right', A: 'left', D: 'right' };

document.addEventListener('keydown', e => {
  if (state.phase !== 'playing') return;
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    togglePause();
    return;
  }
  if (state.paused) return;
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
buildStageTabs();
// 처음 들어오면 항상 STAGE 1 / '보통' 선택 (STAGE 2는 새로고침하면 잠기니까)
selectStage(STAGES[0].id, storage.get(STORAGE_KEYS.char, CHARACTERS[0].id));
requestAnimationFrame(loop);
