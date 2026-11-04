'use strict';
/* =========================================================
   스쿨보드 — 교실 컴퓨터용 대시보드
   모든 데이터는 이 브라우저의 localStorage에 저장됩니다.
   ========================================================= */

const KEY = 'schoolboard.v1';
const IMG_PREFIX = 'schoolboard.img.';
const DAY_MS = 864e5;

/* ---------- 유틸 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dayDiff = (a, b) => Math.round((b - a) / DAY_MS);
const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const md = d => `${d.getMonth() + 1}/${d.getDate()}(${WEEK[d.getDay()]})`;
const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7));

/* ---------- 아이콘 ---------- */
const ICONS = {
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  checkSquare: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="m8 12 3 3 5-6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  flag: '<path d="M5 21V4M5 4h12l-2.5 4.5L17 13H5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevLeft: '<path d="m15 18-6-6 6-6"/>',
  chevRight: '<path d="m9 18 6-6-6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  clip: '<path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10.2 17.7a1.7 1.7 0 0 1-2.4-2.4L15 8"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  sticky: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5V14l-6 6H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M14 20v-4.5a1.5 1.5 0 0 1 1.5-1.5H20M8 9h8M8 12.5h4"/>',
  pin: '<path d="M9 3.5h6l-1 5.5 3.5 3.5h-11L10 9z"/><path d="M12 12.5V21"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17.2v.1"/>',
  file: '<path d="M6 3h8l5 5v11.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3z"/><path d="M14 3v5h5M9 13l-1.5 2L9 17M15 13l1.5 2-1.5 2"/>',
  app: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 8.5h18M6.5 6.3h.01M9 6.3h.01"/>',
};
const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
function hydrateIcons(root = document) {
  $$('i[data-icon]', root).forEach(el => { el.outerHTML = icon(el.dataset.icon); });
}

/* ---------- 공휴일 (2026–2027) ---------- */
const HOLIDAYS = {
  '2026-01-01': '신정', '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절', '2026-03-02': '대체공휴일', '2026-05-05': '어린이날', '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일', '2026-06-03': '지방선거일', '2026-06-06': '현충일', '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일', '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절', '2026-10-05': '대체공휴일', '2026-10-09': '한글날', '2026-12-25': '성탄절',
  '2027-01-01': '신정', '2027-02-06': '설날 연휴', '2027-02-07': '설날', '2027-02-08': '설날 연휴',
  '2027-02-09': '대체공휴일', '2027-03-01': '삼일절', '2027-05-05': '어린이날', '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일', '2027-08-15': '광복절', '2027-08-16': '대체공휴일', '2027-09-14': '추석 연휴',
  '2027-09-15': '추석', '2027-09-16': '추석 연휴', '2027-10-03': '개천절', '2027-10-04': '대체공휴일',
  '2027-10-09': '한글날', '2027-10-11': '대체공휴일', '2027-12-25': '성탄절', '2027-12-27': '대체공휴일',
};

/* ---------- 상태 ---------- */
const DEFAULT_STATE = {
  settings: {
    teacher: '', school: '', className: '',
    loc: { name: '서울 중구', lat: 37.5636, lon: 126.9976 },
    sem1Start: '2026-03-03', sem2Start: '2026-08-24',
    ddayLabel: '', ddayDate: '',
    aiModel: 'claude-haiku-5-5',
  },
  timetable: {
    periods: [
      { start: '09:00', end: '09:40' }, { start: '09:50', end: '10:30' },
      { start: '10:50', end: '11:30' }, { start: '11:40', end: '12:20' },
      { start: '13:20', end: '14:00' }, { start: '14:10', end: '14:50' },
    ],
    // grid[요일: 0=월 … 4=금][교시]
    grid: [
      ['국어', '수학', '사회', '과학', '체육', '창체'],
      ['수학', '국어', '영어', '실과', '음악', ''],
      ['국어', '사회', '과학', '미술', '미술', ''],
      ['수학', '영어', '국어', '도덕', '체육', '과학'],
      ['사회', '수학', '국어', '음악', '창체', ''],
    ],
  },
  events: [],   // {id, date, title, type: school|deadline|personal}
  todos: [],    // {id, text, tag: urgent|submit|normal, due, img, created}
  done: [],     // 완료한 할 일 (최근 50개)
  students: [], // {id, no, name, tags: [], memos: [{id, at, text}]}
  notes: [],    // 포스트잇 {id, text, color, updated}
  folders: [],  // 자주 쓰는 폴더 {id, name, path}
  cache: { weather: null },
};

function merge(base, obj) {
  for (const k in obj) {
    const a = base[k], b = obj[k];
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) merge(a, b);
    else base[k] = b;
  }
  return base;
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(structuredClone(DEFAULT_STATE), JSON.parse(raw));
  } catch (e) { console.warn(e); }
  return structuredClone(DEFAULT_STATE);
}
let S = load();
normalizeGrid();

function save({ localOnly = false } = {}) {
  if (!localOnly && !applyingRemote) { S.updatedAt = Date.now(); markDirty(); }
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('저장 공간이 부족해요. 완료한 할 일의 캡처를 비워 주세요.'); }
}
function normalizeGrid() {
  const n = S.timetable.periods.length;
  const fit = (src, fill) => Array.from({ length: 5 }, (_, d) => {
    const row = ((src || [])[d] || []).slice(0, n);
    while (row.length < n) row.push(fill);
    return row;
  });
  S.timetable.grid = fit(S.timetable.grid, '');
  S.timetable.special = fit(S.timetable.special, false); // 교과(전담) 선생님 수업 칸
}

/* ---------- 모달 & 토스트 ---------- */
const modalEl = $('#modal');
let modalOnClose = null;
function openModal(title, html, opts = {}) {
  if (!modalEl.hidden) closeModal();
  $('#modalTitle').textContent = title;
  // 매번 새 요소로 바꿔서, 이전 창에서 붙인 클릭 처리가 쌓여 여러 번 실행되지 않게 함
  const body = $('#modalBody').cloneNode(false);
  $('#modalBody').replaceWith(body);
  body.innerHTML = html;
  hydrateIcons(body);
  $('.modal', modalEl).classList.toggle('wide', !!opts.wide);
  modalEl.hidden = false;
  modalOnClose = opts.onClose || null;
  setTimeout(() => { const f = $('[autofocus]', body); f && f.focus(); }, 30);
  return body;
}
function closeModal() {
  if (modalEl.hidden) return;
  modalEl.hidden = true;
  $('#modalBody').innerHTML = '';
  const cb = modalOnClose; modalOnClose = null;
  cb && cb();
}
$('#modalClose').addEventListener('click', closeModal);
let downOnBackdrop = false;
modalEl.addEventListener('mousedown', e => { downOnBackdrop = e.target === modalEl; });
modalEl.addEventListener('click', e => { if (downOnBackdrop && e.target === modalEl) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

let toastTimer;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => { action.fn(); t.hidden = true; };
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, action ? 5000 : 2600);
}

/* =========================================================
   헤더 · 시계 · 교시
   ========================================================= */
function periodStatus(now = new Date()) {
  const dow = now.getDay();
  if (dow === 0 || dow === 6) return { kind: 'off', text: '주말이에요', sub: '푹 쉬세요!' };
  const hol = HOLIDAYS[ymd(now)];
  if (hol) return { kind: 'off', text: `${hol}`, sub: '오늘은 쉬는 날이에요' };

  const { periods, grid, special } = S.timetable;
  const subj = grid[dow - 1] || [];
  const isSpecial = i => !!special[dow - 1]?.[i];
  // 오늘 마지막 수업(과목이 입력된 마지막 교시)
  let last = subj.reduce((acc, v, i) => (v ? i : acc), -1);
  if (last < 0) last = periods.length - 1;
  const mins = now.getHours() * 60 + now.getMinutes();
  const P = periods.slice(0, last + 1).map((p, i) => ({ i, s: toMin(p.start), e: toMin(p.end), name: subj[i] || '' }));

  if (mins < P[0].s) return { kind: 'before', text: '수업 전', sub: `1교시 ${P[0].name}${isSpecial(0) ? '(교과)' : ''} · ${P[0].s - mins}분 후` };
  for (let k = 0; k < P.length; k++) {
    const p = P[k], next = P[k + 1];
    if (mins >= p.s && mins < p.e) return { kind: 'class', idx: p.i, text: `${p.i + 1}교시 ${p.name}`, sub: `${p.e - mins}분 남음${isSpecial(p.i) ? ' · 교과 수업' : ''}` };
    if (next && mins >= p.e && mins < next.s) {
      const lunch = next.s - p.e >= 40;
      return { kind: lunch ? 'lunch' : 'break', text: lunch ? '점심시간' : '쉬는 시간', sub: `다음 ${next.i + 1}교시 ${next.name}${isSpecial(next.i) ? '(교과)' : ''} · ${next.s - mins}분 후` };
    }
  }
  return { kind: 'after', text: '오늘 수업 끝', sub: '수고 많으셨어요!' };
}

function renderHeader() {
  const now = new Date();
  const h = now.getHours();
  const hello = h < 12 ? '좋은 아침이에요' : h < 18 ? '좋은 오후예요' : '오늘도 수고 많으셨어요';
  const who = S.settings.teacher ? `${S.settings.teacher} 선생님` : '선생님';
  $('#greeting').textContent = `${hello}, ${who}!`;

  const t = ymd(now);
  const evCount = S.events.filter(e => e.date === t).length + (HOLIDAYS[t] ? 1 : 0);
  const dueToday = S.todos.filter(x => x.due && x.due <= t).length;
  const parts = [];
  const cls = [S.settings.school, S.settings.className].filter(Boolean).join(' ');
  if (cls) parts.push(cls);
  parts.push(evCount ? `오늘 일정 ${evCount}건` : '오늘 등록된 일정은 없어요');
  parts.push(dueToday ? `오늘까지 할 일 ${dueToday}개` : `남은 할 일 ${S.todos.length}개`);
  $('#subGreeting').textContent = parts.join(' · ');
  $('#datePill').textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEK[now.getDay()]}요일`;
}

function renderPeriodNow() {
  const st = periodStatus();
  const dotCls = st.kind === 'class' ? 'live' : (st.kind === 'break' || st.kind === 'lunch') ? 'break' : '';
  $('#periodNow').innerHTML = `<span class="dot ${dotCls}"></span><b>${esc(st.text)}</b><span class="sub">${esc(st.sub || '')}</span>`;
  $('#ttStatus').textContent = st.kind === 'class' ? `지금 ${st.text} · ${st.sub}` : '';
}

let lastDay = ymd(new Date());
let lastMinute = -1;
function tick() {
  const now = new Date();
  $('#clockHM').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $('#clockS').textContent = pad(now.getSeconds());
  if (now.getMinutes() !== lastMinute) {
    lastMinute = now.getMinutes();
    if (ymd(now) !== lastDay) { lastDay = ymd(now); calSel = lastDay; calCursor = new Date(now.getFullYear(), now.getMonth(), 1); renderAll(); }
    renderHeader();
    renderPeriodNow();
    if (!ttEdit) renderTimetable();
  }
}

/* =========================================================
   날씨 · 미세먼지 (Open-Meteo, 키 불필요)
   ========================================================= */
const WMO = {
  0: ['맑음', '☀️'], 1: ['대체로 맑음', '🌤️'], 2: ['구름 조금', '⛅'], 3: ['흐림', '☁️'],
  45: ['안개', '🌫️'], 48: ['안개', '🌫️'],
  51: ['이슬비', '🌦️'], 53: ['이슬비', '🌦️'], 55: ['이슬비', '🌦️'], 56: ['어는 이슬비', '🌧️'], 57: ['어는 이슬비', '🌧️'],
  61: ['약한 비', '🌧️'], 63: ['비', '🌧️'], 65: ['강한 비', '🌧️'], 66: ['어는 비', '🌧️'], 67: ['어는 비', '🌧️'],
  71: ['약한 눈', '🌨️'], 73: ['눈', '🌨️'], 75: ['많은 눈', '❄️'], 77: ['싸락눈', '🌨️'],
  80: ['소나기', '🌦️'], 81: ['소나기', '🌦️'], 82: ['강한 소나기', '⛈️'], 85: ['눈 소나기', '🌨️'], 86: ['눈 소나기', '🌨️'],
  95: ['뇌우', '⛈️'], 96: ['우박·뇌우', '⛈️'], 99: ['우박·뇌우', '⛈️'],
};
const wmo = (code, isDay = 1) => {
  const [d, e] = WMO[code] || ['-', '🌡️'];
  return [d, !isDay && code <= 1 ? '🌙' : e];
};

let weatherLoading = false, weatherError = false;
async function loadWeather(force = false) {
  const c = S.cache.weather;
  const { lat, lon } = S.settings.loc;
  const fresh = c && c.lat === lat && c.lon === lon && Date.now() - c.at < 20 * 60e3;
  if (fresh && !force) { renderWeather(); return; }
  weatherLoading = true; weatherError = false;
  $('#weatherRefresh').classList.add('spin');
  try {
    const q = `latitude=${lat}&longitude=${lon}&timezone=Asia%2FSeoul`;
    const [w, a] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,is_day,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=pm10,pm2_5&hourly=pm10,pm2_5&forecast_days=1`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]);
    S.cache.weather = { at: Date.now(), lat, lon, w, a };
    save({ localOnly: true }); // 날씨 캐시는 다른 컴퓨터와 맞출 필요 없음
  } catch (e) {
    console.warn('날씨 불러오기 실패', e);
    weatherError = true;
  }
  weatherLoading = false;
  $('#weatherRefresh').classList.remove('spin');
  renderWeather();
}

function pmGrade(v, kind) {
  const cut = kind === 'pm10' ? [30, 80, 150] : [15, 35, 75];
  if (v == null || isNaN(v)) return null;
  const i = v <= cut[0] ? 0 : v <= cut[1] ? 1 : v <= cut[2] ? 2 : 3;
  return { i, key: ['good', 'normal', 'bad', 'worst'][i], label: ['좋음', '보통', '나쁨', '매우 나쁨'][i], pct: Math.min(100, v / (cut[2] * 1.2) * 100) };
}

function renderWeather() {
  $('#weatherLoc').textContent = S.settings.loc.name;
  const c = S.cache.weather;
  if (!c) {
    const msg = weatherError ? '날씨를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.' : '불러오는 중…';
    $('#weatherBody').innerHTML = `<span class="muted">${msg}</span>`;
    $('#dustBody').innerHTML = `<span class="muted">${msg}</span>`;
    return;
  }
  const { w, a } = c;
  const cur = w.current;
  const [desc, emo] = wmo(cur.weather_code, cur.is_day);
  const hi = Math.round(w.daily.temperature_2m_max[0]), lo = Math.round(w.daily.temperature_2m_min[0]);
  const rain = w.daily.precipitation_probability_max?.[0];
  const t = ymd(new Date()), nowH = new Date().getHours();
  const hours = [9, 11, 13, 15].map(h => {
    const i = w.hourly.time.indexOf(`${t}T${pad(h)}:00`);
    if (i < 0) return '';
    const [, e] = wmo(w.hourly.weather_code[i]);
    const r = w.hourly.precipitation_probability?.[i];
    const isNow = nowH >= h && nowH < h + 2;
    return `<div class="${isNow ? 'now-h' : ''}"><span class="h">${h}시</span><span>${e}</span><span class="t">${Math.round(w.hourly.temperature_2m[i])}°</span><span class="r">${r != null ? `☂ ${r}%` : ''}</span></div>`;
  }).join('');
  const stale = weatherError ? `<span class="sub">· 오프라인 (마지막 갱신 ${new Date(c.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})</span>` : '';
  $('#weatherBody').innerHTML = `
    <div class="weather-now">
      <span class="weather-emoji">${emo}</span>
      <span class="weather-temp">${Math.round(cur.temperature_2m)}°</span>
      <span class="weather-desc"><b>${desc}</b><span class="sub">체감 ${Math.round(cur.apparent_temperature)}° · 습도 ${cur.relative_humidity_2m}%</span></span>
      <span class="weather-side"><span><span class="hi">${hi}°</span> / <span class="lo">${lo}°</span></span><span>강수 ${rain ?? '-'}%</span></span>
    </div>
    <div class="hourly">${hours}</div>${stale}`;

  // 미세먼지
  const pm10 = a?.current?.pm10, pm25 = a?.current?.pm2_5;
  const g10 = pmGrade(pm10, 'pm10'), g25 = pmGrade(pm25, 'pm25');
  if (!g10 && !g25) { $('#dustBody').innerHTML = '<span class="muted">미세먼지 정보가 없어요.</span>'; return; }
  const worst = [g10, g25].filter(Boolean).sort((x, y) => y.i - x.i)[0];
  const advice = ['실외 수업하기 좋아요', '실외 활동 괜찮아요', '실외 활동은 줄이고 짧게 환기해요', '실외 활동을 자제해요'][worst.i];
  const row = (lbl, v, g) => g ? `<div class="dust-row"><span class="lbl">${lbl}</span><span class="bar"><span class="bg-${g.key}" style="width:${g.pct}%"></span></span><span class="val g-${g.key}">${Math.round(v)} <small>${g.label}</small></span></div>` : '';
  $('#dustBody').innerHTML = `
    <div class="dust-grade g-${worst.key}">${worst.label}</div>
    <div class="dust-rows">${row('미세 PM10', pm10, g10)}${row('초미세 PM2.5', pm25, g25)}</div>
    <div class="advice adv-${worst.key}" title="Open-Meteo(CAMS) 모델 추정치 · 단위 ㎍/㎥ · 에어코리아 측정소 값과 다를 수 있어요">${advice}</div>`;
  $('#dustCard').style.display = 'flex';
}

/* =========================================================
   학사일정 카드
   ========================================================= */
function semesterInfo(today) {
  const cands = [['1학기', S.settings.sem1Start], ['2학기', S.settings.sem2Start]]
    .filter(([, d]) => d).map(([l, d]) => [l, parseYmd(d)])
    .filter(([, d]) => d <= today).sort((x, y) => y[1] - x[1]);
  if (!cands.length) return null;
  const [label, start] = cands[0];
  return { label, week: Math.floor(dayDiff(mondayOf(start), today) / 7) + 1 };
}

function renderWeek() {
  const t = today0();
  const sem = semesterInfo(t);
  const mon = mondayOf(t), fri = addDays(mon, 4);
  let h = sem
    ? `<div class="big">${sem.week}<span class="unit">주차</span></div><div class="sub">${sem.label} · ${md(mon)} ~ ${md(fri)}</div>`
    : `<div class="big" style="font-size:24px">방학 중</div><div class="sub">설정에서 개학일을 입력하면 주차가 나와요</div>`;
  const { ddayLabel, ddayDate } = S.settings;
  if (ddayDate) {
    const n = dayDiff(t, parseYmd(ddayDate));
    const txt = n > 0 ? `D-${n}` : n === 0 ? 'D-DAY' : `D+${-n}`;
    h += `<span class="dday" style="margin-top:6px">${esc(ddayLabel || '디데이')} ${txt}</span>`;
  }
  const ts = ymd(t);
  const evs = [...(HOLIDAYS[ts] ? [{ title: HOLIDAYS[ts], type: 'holiday' }] : []), ...S.events.filter(e => e.date === ts)];
  h += `<div class="week-today">`;
  if (evs.length) {
    evs.slice(0, 2).forEach(e => { h += `<div class="ev"><i class="dot" style="background:var(--${e.type === 'personal' ? 'blue' : e.type === 'school' ? 'accent' : 'red'})"></i>${esc(e.title)}</div>`; });
    if (evs.length > 2) h += `<div class="sub">외 ${evs.length - 2}건</div>`;
  } else {
    h += `<div class="sub">오늘 학교 행사 없음</div>`;
  }
  h += `</div>`;
  $('#weekBody').innerHTML = h;
  $('#weekBody').style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:1';
}

/* =========================================================
   시간표
   ========================================================= */
const SUBJ_COLORS = {
  국어: ['#fdecec', '#c2383e'], 수학: ['#eaf0fd', '#2f5fc4'], 사회: ['#fff4dc', '#9c6400'],
  과학: ['#e5f2ea', '#23744c'], 영어: ['#f0ebfc', '#6a4bc4'], 체육: ['#e2f4f3', '#16807f'],
  음악: ['#fdeef6', '#b83a7e'], 미술: ['#fff0e5', '#c25a14'], 실과: ['#f3efe6', '#7a6232'],
  도덕: ['#eceffd', '#4450b8'], 창체: ['#eef1ef', '#55625b'], 동아리: ['#eef1ef', '#55625b'],
};
const PALETTE = Object.values(SUBJ_COLORS);
function subjStyle(s) {
  const key = Object.keys(SUBJ_COLORS).find(k => s.startsWith(k));
  let c = key && SUBJ_COLORS[key];
  if (!c) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; c = PALETTE[h % PALETTE.length]; }
  return `background:${c[0]};color:${c[1]}`;
}

let ttEdit = false;
function renderTimetable() {
  const { periods, grid, special } = S.timetable;
  const dow = new Date().getDay();
  const todayCol = dow >= 1 && dow <= 5 ? dow - 1 : -1;
  const st = periodStatus();
  let h = '<table class="tt"><thead><tr><th class="tt-corner"></th>';
  ['월', '화', '수', '목', '금'].forEach((d, i) => {
    h += `<th class="${i === todayCol ? 'today' : ''}">${d}${i === todayCol ? '<span class="today-dot">오늘</span>' : ''}</th>`;
  });
  h += '</tr></thead><tbody>';
  periods.forEach((p, i) => {
    if (i > 0 && toMin(p.start) - toMin(periods[i - 1].end) >= 40) {
      h += `<tr class="tt-lunch"><th>점심</th><td colspan="5">${periods[i - 1].end} – ${p.start}</td></tr>`;
    }
    const isNow = st.kind === 'class' && st.idx === i;
    h += `<tr class="${isNow ? 'now-row' : ''}"><th><b>${i + 1}교시</b><small>${p.start}</small></th>`;
    for (let d = 0; d < 5; d++) {
      const v = grid[d][i] || '';
      const sp = !!special[d][i];
      const cls = `${d === todayCol ? 'today' : ''} ${isNow && d === todayCol ? 'now' : ''}`;
      h += ttEdit
        ? `<td class="${cls}"><div class="tt-edit-cell"><input class="tt-input" data-d="${d}" data-p="${i}" value="${esc(v)}" maxlength="10"><button class="tt-sp ${sp ? 'on' : ''}" data-d="${d}" data-p="${i}" title="교과(전담) 선생님 수업이면 켜세요">교과</button></div></td>`
        : `<td class="${cls}">${v ? `<span class="subj ${sp ? 'special' : ''}" style="${subjStyle(v)}" ${sp ? 'title="교과 선생님 수업"' : ''}>${esc(v)}</span>` : '<span class="subj empty">–</span>'}</td>`;
    }
    h += '</tr>';
  });
  h += '</tbody></table>';
  if (ttEdit) h += '<p class="tt-note">칸을 눌러 과목을 고치세요. 교과(전담) 선생님 수업은 칸 옆의 <b>교과</b>를 눌러 켜 주세요. 교시 시간은 설정(왼쪽 아래)에서 바꿀 수 있어요.</p>';
  else if (special.some(r => r.some(Boolean))) h += '<p class="tt-note tt-legend"><span class="subj special" style="background:#eef1ef;color:#55625b">과목</span> 흐린 칸은 교과 선생님 수업이에요.</p>';
  $('#ttBody').innerHTML = h;
  $('#ttEditBtn').innerHTML = ttEdit ? `${icon('check')}완료` : `${icon('edit')}편집`;
}
$('#ttEditBtn').addEventListener('click', () => {
  ttEdit = !ttEdit;
  renderTimetable();
  renderPeriodNow();
  if (ttEdit) $('.tt-input')?.focus();
});
$('#ttBody').addEventListener('click', e => {
  const b = e.target.closest('.tt-sp');
  if (!b) return;
  const row = S.timetable.special[+b.dataset.d];
  row[+b.dataset.p] = !row[+b.dataset.p];
  b.classList.toggle('on', row[+b.dataset.p]);
  save();
});
$('#ttBody').addEventListener('input', e => {
  const el = e.target.closest('.tt-input');
  if (!el) return;
  S.timetable.grid[+el.dataset.d][+el.dataset.p] = el.value.trim();
  save();
});

/* =========================================================
   할 일
   ========================================================= */
const TAGS = { urgent: '긴급', submit: '제출', normal: '일반' };
let todoFilter = 'all';

function dueInfo(due) {
  if (!due) return null;
  const n = dayDiff(today0(), parseYmd(due));
  if (n < 0) return { cls: 'late', text: `${-n}일 지남` };
  if (n === 0) return { cls: 'late', text: '오늘 마감' };
  if (n === 1) return { cls: 'soon', text: '내일 마감' };
  return { cls: n <= 3 ? 'soon' : '', text: `D-${n} · ${md(parseYmd(due))}` };
}

// 마감이 내일 이내로 다가오면 자동으로 '긴급' (선생님이 직접 고른 분류는 그대로 둠)
const isAutoUrgent = t => !t.tagManual && t.tag !== 'urgent' && !!t.due && dayDiff(today0(), parseYmd(t.due)) <= 1;
const tagOf = t => (isAutoUrgent(t) ? 'urgent' : t.tag);
const TAG_CYCLE = { urgent: 'submit', submit: 'normal', normal: 'urgent' };

function sortedTodos() {
  const rank = { urgent: 0, submit: 1, normal: 2 };
  return [...S.todos].sort((a, b) => {
    const ad = a.due || '9999', bd = b.due || '9999';
    if (ad !== bd) return ad < bd ? -1 : 1;
    if (rank[tagOf(a)] !== rank[tagOf(b)]) return rank[tagOf(a)] - rank[tagOf(b)];
    return a.created - b.created;
  });
}

function renderTodos() {
  const cnt = { urgent: 0, submit: 0, normal: 0 };
  S.todos.forEach(t => { cnt[tagOf(t)] += 1; });
  const fbtn = (key, num, label, sub) => `<button class="tf ${key} ${todoFilter === key ? 'active' : ''}" data-filter="${key}"><b>${num}</b><span>${label}<small>${sub}</small></span></button>`;
  $('#todoFilters').innerHTML =
    fbtn('all', S.todos.length, '전체', '남은 할 일') +
    fbtn('urgent', cnt.urgent, '긴급', '바로 처리') +
    fbtn('submit', cnt.submit, '제출', '공문·회신') +
    fbtn('normal', cnt.normal, '일반', '그 외');

  const list = sortedTodos().filter(t => todoFilter === 'all' || tagOf(t) === todoFilter);
  const ul = $('#todoList');
  if (!list.length) {
    ul.innerHTML = `<li class="empty-state">${S.todos.length ? '이 분류에는 할 일이 없어요.' : '할 일이 없어요. 오늘도 깔끔! ✨'}</li>`;
  } else {
    ul.innerHTML = list.map(t => {
      const d = dueInfo(t.due);
      return `<li class="todo ${d?.cls === 'late' ? 'overdue' : ''}" data-id="${t.id}">
        <input type="checkbox" class="check" title="완료">
        <div class="todo-main">
          <div class="todo-text" title="더블클릭해서 수정">${esc(t.text)}</div>
          <div class="todo-meta">
            <button class="badge tag-btn ${tagOf(t)}" data-act="tag" title="${isAutoUrgent(t) ? `마감이 다가와 자동으로 긴급이 됐어요 (원래: ${TAGS[t.tag]}) · ` : ''}눌러서 분류 바꾸기">${TAGS[tagOf(t)]}${isAutoUrgent(t) ? ' ⏰' : ''}</button>
            ${d ? `<span class="due ${d.cls}">${d.text}</span>` : ''}
            ${t.img ? `<button class="clip" data-act="img">${icon('clip')}캡처</button>` : ''}
          </div>
        </div>
        <div class="row-actions">
          <button class="mini-btn" data-act="edit" title="수정">${icon('edit')}</button>
          <button class="mini-btn del" data-act="del" title="삭제">${icon('trash')}</button>
        </div>
      </li>`;
    }).join('');
  }
  $('#doneBtn').innerHTML = `${icon('check')}완료한 일 ${S.done.length}개`;
}

$('#todoFilters').addEventListener('click', e => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  todoFilter = todoFilter === b.dataset.filter ? 'all' : b.dataset.filter;
  renderTodos();
});

$('#todoAdd').addEventListener('submit', e => {
  e.preventDefault();
  const text = $('#todoInput').value.trim();
  if (!text) return;
  const tag = $('#todoTag').value;
  S.todos.push({ id: uid(), text, tag, due: $('#todoDue').value || findDue(text), img: '', created: Date.now() });
  save();
  $('#todoInput').value = ''; $('#todoDue').value = ''; $('#todoTag').value = 'normal';
  renderTodos(); renderHeader(); renderCalendar();
});

function completeTodo(id, li) {
  li?.classList.add('leaving');
  setTimeout(() => {
    const i = S.todos.findIndex(t => t.id === id);
    if (i < 0) return;
    const [t] = S.todos.splice(i, 1);
    t.doneAt = Date.now();
    S.done.unshift(t);
    if (S.done.length > 50) S.done.length = 50;
    save(); gcImages();
    renderTodos(); renderHeader(); renderCalendar();
    toast(`완료! “${t.text.slice(0, 18)}${t.text.length > 18 ? '…' : ''}”`, { label: '되돌리기', fn: () => restoreTodo(t.id) });
  }, 380);
}
function restoreTodo(id) {
  const i = S.done.findIndex(t => t.id === id);
  if (i < 0) return;
  const [t] = S.done.splice(i, 1);
  delete t.doneAt;
  S.todos.push(t);
  save(); renderTodos(); renderHeader(); renderCalendar();
}

function startEditTodo(li) {
  const t = S.todos.find(x => x.id === li.dataset.id);
  const box = $('.todo-text', li);
  if (!t || !box) return;
  box.outerHTML = `<input class="todo-edit" value="${esc(t.text)}" maxlength="200">`;
  const inp = $('.todo-edit', li);
  inp.focus(); inp.select();
  const finish = commit => {
    if (commit && inp.value.trim()) { t.text = inp.value.trim(); save(); }
    renderTodos();
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') { e.stopPropagation(); finish(false); } });
  inp.addEventListener('blur', () => finish(true));
}

$('#todoList').addEventListener('change', e => {
  if (!e.target.classList.contains('check')) return;
  const li = e.target.closest('.todo');
  completeTodo(li.dataset.id, li);
});
$('#todoList').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const li = b.closest('.todo');
  const t = S.todos.find(x => x.id === li.dataset.id);
  if (!t) return;
  if (b.dataset.act === 'tag') {
    t.tag = TAG_CYCLE[tagOf(t)];
    t.tagManual = true;
    save(); renderTodos();
    return;
  }
  if (b.dataset.act === 'del') {
    if (!confirm('이 할 일을 삭제할까요? (완료가 아니라 삭제예요)')) return;
    S.todos = S.todos.filter(x => x.id !== t.id);
    save(); gcImages(); renderTodos(); renderHeader(); renderCalendar();
  } else if (b.dataset.act === 'edit') startEditTodo(li);
  else if (b.dataset.act === 'img') showImage(t.img);
});
$('#todoList').addEventListener('dblclick', e => {
  if (e.target.closest('.todo-text')) startEditTodo(e.target.closest('.todo'));
});

function showImage(imgId) {
  const src = localStorage.getItem(IMG_PREFIX + imgId);
  if (!src) { toast('캡처 이미지를 찾을 수 없어요.'); return; }
  openModal('첨부한 캡처', `<img class="preview-img" src="${src}" alt="업무 메시지 캡처">`, { wide: true });
}

$('#doneBtn').addEventListener('click', () => {
  const body = openModal('완료한 일', S.done.length
    ? `<div>${S.done.map(t => `<div class="done-item" data-id="${t.id}"><span class="t">${esc(t.text)}</span><span class="sub">${new Date(t.doneAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span><button class="link-btn small" data-act="restore">${icon('undo')}되돌리기</button></div>`).join('')}</div>
       <div class="modal-actions"><button class="btn-line danger" data-act="clear">${icon('trash')}모두 비우기</button></div>`
    : '<div class="empty-state">아직 완료한 일이 없어요.</div>');
  body.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'restore') { restoreTodo(b.closest('.done-item').dataset.id); b.closest('.done-item').remove(); }
    if (b.dataset.act === 'clear' && confirm('완료한 일 목록과 첨부된 캡처를 모두 지울까요?')) { S.done = []; save(); gcImages(); renderTodos(); closeModal(); }
  });
});

/* 이미지 저장소 정리: 참조되지 않는 캡처 삭제 */
function gcImages() {
  const used = new Set([...S.todos, ...S.done].map(t => t.img).filter(Boolean));
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(IMG_PREFIX) && !used.has(k.slice(IMG_PREFIX.length))) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
}

/* ---------- 메시지 → 할 일 자동 정리 ---------- */
const ACTION_RE = /(제출|회신|보고|작성|입력|등록|신청|확인|준비|참석|배부|수합|부탁|바랍니다|주세요|주시기|해\s?주시|요청|협조|마감|까지|검토|발송|정리|결재|기안)/;

function findDue(line, base = today0()) {
  let m;
  if (/오늘/.test(line)) return ymd(base);
  if (/내일/.test(line)) return ymd(addDays(base, 1));
  if (/모레/.test(line)) return ymd(addDays(base, 2));
  if ((m = line.match(/(?:^|[^\d])(\d{1,2})\s*(?:월\s*(\d{1,2})\s*일|[\/.]\s*(\d{1,2}))(?![\d:])/))) {
    const mo = +m[1], d = +(m[2] || m[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      let dt = new Date(base.getFullYear(), mo - 1, d);
      if (dt < addDays(base, -60)) dt = new Date(base.getFullYear() + 1, mo - 1, d);
      return ymd(dt);
    }
  }
  if ((m = line.match(/(다음\s*주|차주|이번\s*주|금주)?\s*([월화수목금])요일/))) {
    const target = WEEK.indexOf(m[2]);
    if (m[1] && /다음|차주/.test(m[1])) return ymd(addDays(mondayOf(base), 7 + target - 1));
    return ymd(addDays(base, (target - base.getDay() + 7) % 7));
  }
  return '';
}
function findTag(line, due) {
  if (/긴급|급히|시급|즉시|오늘\s*(중|까지)|ASAP/i.test(line)) return 'urgent';
  if (due && dayDiff(today0(), parseYmd(due)) <= 0) return 'urgent';
  if (/제출|회신|보고|수합|입력|등록|신청|마감|발송|결재|기안/.test(line)) return 'submit';
  return 'normal';
}
function tidyOcrLine(l) {
  const toks = l.trim().split(/\s+/);
  const single = toks.filter(t => /^[가-힣]$/.test(t)).length;
  if (toks.length >= 4 && single / toks.length > 0.6) return l.replace(/([가-힣])\s+(?=[가-힣])/g, '$1');
  return l;
}
// 메신저에서 한 문장이 여러 줄로 나뉜 경우 이어 붙입니다
function joinWrappedLines(text) {
  const out = [];
  const isTime = l => /^(오전|오후)?\s*\d{1,2}:\d{2}$/.test(l);
  text.split(/\r?\n/).forEach(raw => {
    const l = raw.trim();
    if (!l) { out.push(''); return; }
    const prev = out[out.length - 1];
    const startsNew = /^([\-–•·*▶►▷○●◦□■☐✓✔※>]|\(?\d{1,2}[.)]\s|[가-하][.)]\s)/.test(l);
    const prevEnded = /([.!?。\]]|니다|세요|어요|아요|해요|바람|요망|감사|요|님들?)\s*$/.test(prev || '');
    if (prev && !startsNew && !prevEnded && !isTime(l) && !isTime(prev)) out[out.length - 1] = `${prev} ${l}`;
    else out.push(l);
  });
  return out.join('\n');
}
// AI 없이 쓰는 기본 추출: 행동이 필요한 문장만 남깁니다
function extractTasks(text) {
  const seen = new Set(), out = [];
  joinWrappedLines(text).split('\n').forEach(raw => {
    const l = tidyOcrLine(raw)
      .replace(/^[\s\-–•·*▶►▷○●◦□■☐✓✔※>]+/, '')
      .replace(/^\(?\d{1,2}[.)]\s+/, '')
      .replace(/\s{2,}/g, ' ').trim();
    if (l.length < 4) return;
    if (/^(오전|오후)?\s*\d{1,2}:\d{2}$/.test(l)) return;               // 시간만 있는 줄
    if (/^\d{4}[년.\-]\s*\d{1,2}[월.\-]\s*\d{1,2}일?[^가-힣]*[가-힣]?요?일?$/.test(l)) return; // 날짜 구분선
    if (/^[^가-힣a-zA-Z0-9]*$/.test(l) || seen.has(l)) return;
    seen.add(l);
    const due = findDue(l);
    if (!ACTION_RE.test(l) && !due) return; // 인사말·서명·단순 안내는 건너뜀
    out.push({ text: l, due, tag: findTag(l, due), on: true });
  });
  return out;
}

/* ---------- AI(Claude)로 메시지 이해해서 자동 저장 ---------- */
const AI_KEY = 'schoolboard.aikey'; // 백업 파일에 포함되지 않도록 따로 저장
const AI_MODELS = {
  'claude-haiku-5-5': '빠르고 저렴 (Haiku · 건당 약 1원)',
  'claude-opus-5-5': '더 정확 (Opus · 건당 약 25~40원)',
};
const aiModel = () => (AI_MODELS[S.settings.aiModel] ? S.settings.aiModel : 'claude-haiku-5-5');
const getAiKey = () => { try { return localStorage.getItem(AI_KEY) || ''; } catch (e) { return ''; } };
let anthropicModP = null;
function getAnthropic() {
  if (!anthropicModP) {
    anthropicModP = import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.137.0/+esm');
    anthropicModP.catch(() => { anthropicModP = null; });
  }
  return anthropicModP;
}

const AI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'tasks', 'events'],
  properties: {
    summary: { type: 'string' },
    tasks: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['title', 'due', 'tag'],
        properties: {
          title: { type: 'string' },
          due: { type: 'string', description: 'YYYY-MM-DD, 없으면 빈 문자열' },
          tag: { type: 'string', enum: ['urgent', 'submit', 'normal'] },
        },
      },
    },
    events: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['date', 'title', 'type'],
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          title: { type: 'string' },
          type: { type: 'string', enum: ['school', 'deadline', 'personal'] },
        },
      },
    },
  },
};

function aiSystemPrompt() {
  const t = today0();
  const s = S.settings;
  return `너는 한국 초등학교 담임교사의 업무 비서야. 교사가 받은 업무 메시지(메신저 쪽지, 공문 안내, 단체 공지, 캡처 이미지)를 읽고, 이 교사가 해야 할 일과 달력에 적어 둘 일정을 뽑아 줘.

오늘: ${ymd(t)} (${WEEK[t.getDay()]}요일)
교사: ${[s.school, s.className].filter(Boolean).join(' ') || '초등학교 담임교사'}

정리 방법
- 메시지 전체 맥락을 이해해서 정리해. 줄바꿈 단위로 나누지 말고, 여러 줄에 걸친 한 가지 요청은 하나로 합쳐.
- tasks에는 교사가 직접 행동해야 하는 일만 넣어(제출, 회신, 입력, 작성, 수합, 배부, 준비, 확인 등). 인사말, 감사 인사, 참고용 안내, 보낸 사람 이름, 시각 표시는 넣지 마.
- title은 할 일 목록에서 한눈에 알아보게 25자 안팎으로 짧게 써. 무엇을 하는지가 드러나야 해. 필요하면 요청 부서를 괄호로 붙여. 예: "학부모 상담 희망일 회신(교무부)", "방과후 출석부 제출".
- 날짜 표현("다음 주 수요일", "11/7", "내일", "금요일까지")은 오늘을 기준으로 YYYY-MM-DD로 바꿔. 마감이 없으면 due는 빈 문자열.
- tag: 오늘·내일 마감이거나 "긴급/즉시/오늘 중" 같은 표현이 있으면 urgent, 무언가를 내거나 입력·회신하는 일이면 submit, 그 밖에는 normal.
- events에는 날짜가 정해진 학교 행사, 회의, 연수, 출장, 공개수업처럼 달력에 적어 둘 일을 넣어. 시각이 있으면 title 앞에 "15:00 "처럼 붙여. 날짜를 알 수 없으면 넣지 마. type은 학교 행사·회의·연수면 school, 개인 일정이면 personal로 하고, deadline은 쓰지 마(마감은 tasks의 due로 표시돼).
- 같은 내용을 tasks와 events에 겹쳐 넣지 마. 회의 참석처럼 날짜가 있는 일은 events에만 넣고, 따로 준비할 것이 있을 때만 그 준비를 tasks에 넣어.
- 정리할 게 없으면 빈 배열로 둬.
- summary에는 메시지가 무슨 내용인지 한 문장으로 써.`;
}

async function analyzeWithAI(text, imgData) {
  const { default: Anthropic } = await getAnthropic();
  const client = new Anthropic({ apiKey: getAiKey(), dangerouslyAllowBrowser: true });
  const content = [];
  if (imgData) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imgData.split(',')[1] } });
  content.push({
    type: 'text',
    text: text.trim()
      ? `다음 업무 메시지를 정리해 줘.${imgData ? ' 첨부한 캡처도 함께 봐 줘.' : ''}\n\n<message>\n${text.trim()}\n</message>`
      : '첨부한 캡처 속 업무 메시지를 정리해 줘.',
  });
  const model = aiModel();
  const params = {
    model,
    max_tokens: 8000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: AI_SCHEMA } },
    system: aiSystemPrompt(),
    messages: [{ role: 'user', content }],
  };
  // Opus는 거절 시 다른 모델로 넘기는 서버 측 대체 기능을 켭니다 (Haiku는 지원하지 않음)
  const resp = model === 'claude-opus-5-5'
    ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
    : await client.messages.create(params);
  if (resp.stop_reason === 'refusal') throw new Error('refusal');
  if (resp.stop_reason === 'max_tokens') throw new Error('too_long');
  const out = resp.content.find(b => b.type === 'text');
  return JSON.parse(out.text);
}

function aiErrorMessage(e, mod) {
  const A = mod?.default;
  if (A && e instanceof A.AuthenticationError) return 'API 키가 올바르지 않아요. 설정에서 키를 다시 확인해 주세요.';
  if (A && e instanceof A.PermissionDeniedError) return '이 키로는 사용할 수 없어요. 키 권한이나 결제 상태를 확인해 주세요.';
  if (A && e instanceof A.RateLimitError) return '요청이 많아 잠시 막혔어요. 1분쯤 뒤에 다시 해 주세요.';
  if (A && e instanceof A.APIConnectionError) return 'AI 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.';
  if (A && e instanceof A.APIError) return `AI 호출 중 오류가 났어요 (${e.status ?? '알 수 없음'}). 잠시 뒤 다시 해 보세요.`;
  if (e.message === 'refusal') return 'AI가 이 메시지는 정리하지 않았어요. 직접 입력해 주세요.';
  if (e.message === 'too_long') return '메시지가 너무 길어요. 나눠서 넣어 주세요.';
  if (!mod) return 'AI 기능을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.';
  return 'AI 정리에 실패했어요. 잠시 뒤 다시 해 보세요.';
}

const validDate = d => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') && !isNaN(parseYmd(d)) ? d : '');
function saveAiResult(r, imgData) {
  const tasks = (r.tasks || []).filter(t => t.title?.trim());
  const events = (r.events || []).filter(e => e.title?.trim() && validDate(e.date));
  let imgId = '';
  if (imgData && tasks.length) {
    imgId = uid();
    try { localStorage.setItem(IMG_PREFIX + imgId, imgData); }
    catch (e) { imgId = ''; }
  }
  const saved = [];
  tasks.forEach(t => {
    const todo = { id: uid(), text: t.title.trim(), tag: TAGS[t.tag] ? t.tag : 'normal', due: validDate(t.due), img: imgId, created: Date.now() };
    S.todos.push(todo);
    saved.push({ kind: 'todo', id: todo.id });
  });
  events.forEach(e => {
    const ev = { id: uid(), date: e.date, title: e.title.trim(), type: EV_TYPES[e.type] ? e.type : 'school' };
    S.events.push(ev);
    saved.push({ kind: 'event', id: ev.id });
  });
  save();
  renderTodos(); renderHeader(); renderCalendar(); renderWeek();
  return saved;
}

/* ---------- '메시지로 추가' 창 ---------- */
let cap = null; // 열린 창의 상태
function compressImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, 1000 / img.width, 2400 / img.height);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('이미지를 읽을 수 없어요')); };
    img.src = url;
  });
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('script'));
    document.head.append(s);
  });
}
let ocrWorkerP = null, ocrProgress = null;
function getOcrWorker() {
  if (!ocrWorkerP) {
    ocrWorkerP = (async () => {
      if (!window.Tesseract) await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
      return Tesseract.createWorker('kor+eng', 1, { logger: m => ocrProgress && ocrProgress(m) });
    })();
    ocrWorkerP.catch(() => { ocrWorkerP = null; });
  }
  return ocrWorkerP;
}

function capStatus(msg, busy = false) {
  const el = cap && $('#capStatus');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('busy', busy);
}

async function handleCapFile(file) {
  if (!cap || !file || !file.type.startsWith('image/')) return;
  try {
    cap.imgData = await compressImage(file);
    cap.imgDone = false;
  } catch (e) { capStatus('이미지를 읽을 수 없어요.'); return; }
  $('#capDrop').innerHTML = `<img src="${cap.imgData}" alt="붙여넣은 캡처"><span class="sub">다른 이미지로 바꾸려면 클릭하거나 다시 붙여넣기</span>`;
  if (cap.ai) { runAI(); return; }

  // AI 키가 없을 때: 브라우저 안에서 글자 인식(OCR) 후 기본 추출
  const myCap = cap;
  capStatus('글자 인식 준비 중… (처음 한 번은 한글 인식 데이터를 내려받아 30초쯤 걸려요)', true);
  ocrProgress = m => {
    if (cap !== myCap) return;
    if (m.status === 'recognizing text') capStatus(`캡처에서 글자 읽는 중… ${Math.round(m.progress * 100)}%`, true);
    else if (/load|initializ/i.test(m.status)) capStatus('한글 인식 데이터 불러오는 중…', true);
  };
  try {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(file);
    if (cap !== myCap) return;
    const text = data.text.split('\n').map(tidyOcrLine).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const ta = $('#capText');
    ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + text;
    runExtract();
    capStatus(text ? '읽기 완료! 오른쪽 후보를 확인하고 고칠 부분은 고쳐 주세요.' : '글자를 찾지 못했어요. 텍스트를 직접 붙여넣어 주세요.');
  } catch (e) {
    console.warn(e);
    capStatus('자동 글자 인식에 실패했어요(인터넷 연결 필요). 메시지 텍스트를 복사해 붙여넣어 주세요.');
  }
}

/* AI 모드: 메시지를 보내 정리하고 바로 저장 */
async function runAI() {
  if (!cap || cap.running) return;
  const myCap = cap;
  const raw = $('#capText').value;
  const text = raw.trim() !== cap.doneText ? raw : '';
  const img = cap.imgDone ? null : cap.imgData;
  if (!text.trim() && !img) {
    capStatus(raw.trim() || cap.imgData ? '이미 정리한 내용이에요. 새 메시지를 넣어 주세요.' : '메시지를 붙여넣거나 캡처를 넣어 주세요.');
    return;
  }
  cap.running = true;
  $('#capRun').disabled = true;
  capStatus('AI가 메시지를 읽고 정리하는 중…', true);
  let mod = null;
  try {
    mod = await getAnthropic();
    const r = await analyzeWithAI(text, img);
    const saved = saveAiResult(r, img);
    myCap.doneText = raw.trim();
    if (img) myCap.imgDone = true;
    myCap.results.unshift({ summary: r.summary, items: saved });
    if (cap === myCap) {
      renderAiResults();
      capStatus(saved.length ? `${saved.length}개를 저장했어요. 필요 없는 건 ✕로 지우면 돼요.` : '할 일이나 일정이 없는 메시지예요.');
    } else if (saved.length) {
      toast(`메시지에서 ${saved.length}개를 정리해 저장했어요.`);
    }
  } catch (e) {
    console.warn(e);
    if (cap === myCap) capStatus(aiErrorMessage(e, mod));
    else toast(aiErrorMessage(e, mod));
  } finally {
    myCap.running = false;
    const b = cap === myCap && $('#capRun');
    if (b) b.disabled = false;
  }
}

function renderAiResults() {
  const box = $('#capRight');
  if (!cap.results.length) {
    box.innerHTML = `<div class="cap-empty">${icon('sparkle')}<br>메시지나 캡처를 넣으면 AI가 읽고<br><b>할 일</b>과 <b>달력 일정</b>으로 알아서 저장해요.</div>`;
    return;
  }
  box.innerHTML = cap.results.map(r => {
    const rows = r.items.map(it => {
      if (it.kind === 'todo') {
        const t = S.todos.find(x => x.id === it.id);
        if (!t) return `<li class="saved-item gone"><span class="badge normal">할 일</span><span class="t">삭제됨</span></li>`;
        const d = dueInfo(t.due);
        return `<li class="saved-item" data-kind="todo" data-id="${t.id}"><span class="badge ${tagOf(t)}">${TAGS[tagOf(t)]}</span><span class="t">${esc(t.text)}</span><span class="due ${d?.cls || ''}">${d ? d.text : '마감 없음'}</span><button class="mini-btn del" data-act="unsave" title="저장 취소">${icon('x')}</button></li>`;
      }
      const e = S.events.find(x => x.id === it.id);
      if (!e) return `<li class="saved-item gone"><span class="badge school">일정</span><span class="t">삭제됨</span></li>`;
      return `<li class="saved-item" data-kind="event" data-id="${e.id}"><span class="badge ${e.type}">달력</span><span class="t">${esc(e.title)}</span><span class="due">${md(parseYmd(e.date))}</span><button class="mini-btn del" data-act="unsave" title="저장 취소">${icon('x')}</button></li>`;
    }).join('');
    return `<div class="ai-result">
      ${r.summary ? `<p class="ai-summary">${icon('sparkle')}${esc(r.summary)}</p>` : ''}
      ${rows ? `<ul class="saved-list">${rows}</ul>` : '<div class="ag-empty">할 일이나 일정이 없는 메시지예요.</div>'}
    </div>`;
  }).join('');
}

/* 기본 모드: 문장 후보를 보여주고 고른 것만 추가 */
function runExtract() {
  if (!cap) return;
  const found = extractTasks($('#capText').value);
  const have = new Set(cap.cands.map(c => c.src));
  found.forEach(f => { if (!have.has(f.text)) cap.cands.push({ ...f, src: f.text, id: uid() }); });
  renderCands();
  if (!found.length) capStatus('해야 할 일로 보이는 문장을 찾지 못했어요. 필요하면 "직접 추가"를 눌러 주세요.');
}
function renderCands() {
  const ul = $('#capCands');
  if (!cap.cands.length) {
    ul.innerHTML = '<li class="cap-empty">왼쪽에 캡처를 붙여넣거나 메시지 텍스트를 넣으면<br>할 일 후보가 여기에 정리돼요.</li>';
  } else {
    ul.innerHTML = cap.cands.map(c => `<li class="cand ${c.on ? '' : 'off'}" data-id="${c.id}">
      <input type="checkbox" class="check" data-k="on" ${c.on ? 'checked' : ''}>
      <input type="text" data-k="text" value="${esc(c.text)}">
      <select data-k="tag">${Object.entries(TAGS).map(([k, v]) => `<option value="${k}" ${c.tag === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <input type="date" data-k="due" value="${c.due || ''}">
      <button class="mini-btn del" data-act="rm" title="후보 지우기">${icon('x')}</button>
    </li>`).join('');
  }
  updateCapAdd();
}
function updateCapAdd() {
  const n = cap.cands.filter(c => c.on && c.text.trim()).length;
  $('#capAdd').disabled = !n;
  $('#capAdd').innerHTML = `${icon('plus')}${n}개 할 일로 추가`;
}

function openCapture({ file, text } = {}) {
  const ai = !!getAiKey();
  cap = { ai, imgData: null, imgDone: false, doneText: '', running: false, cands: [], results: [] };
  const right = ai
    ? `<div class="card-head" style="margin-bottom:8px"><h2>AI가 저장한 항목</h2></div><div id="capRight"></div>
       <div class="modal-actions"><button class="btn-primary" id="capDone">${icon('check')}확인</button></div>`
    : `<div class="card-head" style="margin-bottom:8px"><h2>할 일 후보</h2><button class="link-btn small" id="capManual">${icon('plus')}직접 추가</button></div>
       <ul class="cand-list" id="capCands"></ul>
       <p class="ai-hint">${icon('sparkle')}설정에서 <b>AI 메시지 정리</b>를 켜면 메시지를 이해해서 할 일·일정으로 알아서 저장해요.</p>
       <div class="modal-actions"><button class="btn-primary" id="capAdd"></button></div>`;
  const body = openModal(ai ? '메시지 → 할 일·일정 자동 정리' : '메시지로 할 일 추가', `
    <div class="cap-layout">
      <div>
        <div class="drop" id="capDrop" tabindex="0">${icon('image')}<b>캡처 이미지를 붙여넣기(Ctrl+V)</b><span class="sub">또는 끌어다 놓기 · 클릭해서 파일 선택</span></div>
        <input type="file" id="capFile" accept="image/*" hidden>
        <div class="ocr-status" id="capStatus"></div>
        <label class="field"><span>메시지 텍스트</span>
          <textarea class="box" id="capText" rows="8" placeholder="메신저·공문 내용을 복사해서 붙여넣으세요.${ai ? ' 붙여넣으면 바로 정리돼요.' : ''}&#10;예) 11월 7일까지 학부모 상담 희망 일정 회신 부탁드립니다."></textarea>
        </label>
        <button class="btn-line" id="capRun">${icon('sparkle')}${ai ? 'AI로 정리해서 저장' : '할 일 뽑아내기'}</button>
      </div>
      <div>${right}</div>
    </div>`, { wide: true, onClose: () => { cap = null; } });

  const drop = $('#capDrop', body), fileIn = $('#capFile', body);
  drop.addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', () => handleCapFile(fileIn.files[0]));
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); handleCapFile(e.dataTransfer.files[0]); });
  $('#capRun', body).addEventListener('click', () => (ai ? runAI() : runExtract()));
  $('#capText', body).addEventListener('paste', e => {
    if ([...(e.clipboardData?.items || [])].some(i => i.type.startsWith('image/'))) return; // 이미지는 전역 처리
    setTimeout(ai ? runAI : runExtract, 0);
  });

  if (ai) {
    $('#capDone', body).addEventListener('click', closeModal);
    $('#capRight', body).addEventListener('click', e => {
      const b = e.target.closest('[data-act="unsave"]');
      if (!b) return;
      const li = b.closest('.saved-item');
      if (li.dataset.kind === 'todo') S.todos = S.todos.filter(x => x.id !== li.dataset.id);
      else S.events = S.events.filter(x => x.id !== li.dataset.id);
      save(); gcImages();
      renderTodos(); renderHeader(); renderCalendar(); renderWeek();
      renderAiResults();
    });
    renderAiResults();
  } else {
    $('#capManual', body).addEventListener('click', () => {
      cap.cands.unshift({ id: uid(), src: uid(), text: '', due: '', tag: 'normal', on: true });
      renderCands();
      $('#capCands input[type="text"]')?.focus();
    });
    const ul = $('#capCands', body);
    ul.addEventListener('input', e => {
      const li = e.target.closest('.cand'); const k = e.target.dataset.k;
      if (!li || !k) return;
      const c = cap.cands.find(x => x.id === li.dataset.id);
      c[k] = k === 'on' ? e.target.checked : e.target.value;
      if (k === 'on') li.classList.toggle('off', !c.on);
      updateCapAdd();
    });
    ul.addEventListener('click', e => {
      if (!e.target.closest('[data-act="rm"]')) return;
      const id = e.target.closest('.cand').dataset.id;
      cap.cands = cap.cands.filter(c => c.id !== id);
      renderCands();
    });
    $('#capAdd', body).addEventListener('click', () => {
      const picked = cap.cands.filter(c => c.on && c.text.trim());
      if (!picked.length) return;
      let imgId = '';
      if (cap.imgData) {
        imgId = uid();
        try { localStorage.setItem(IMG_PREFIX + imgId, cap.imgData); }
        catch (e) { imgId = ''; toast('저장 공간이 부족해 캡처는 첨부하지 못했어요.'); }
      }
      picked.forEach(c => S.todos.push({ id: uid(), text: c.text.trim(), tag: c.tag, due: c.due, img: imgId, created: Date.now() }));
      save();
      closeModal();
      renderTodos(); renderHeader(); renderCalendar();
      toast(`할 일 ${picked.length}개를 추가했어요.`);
    });
    renderCands();
  }

  if (text) {
    $('#capText').value = text;
    ai ? runAI() : runExtract();
  }
  if (file) handleCapFile(file);
}
$('#captureBtn').addEventListener('click', () => openCapture());

// 화면 어디서든: 캡처 이미지나 메시지 텍스트를 붙여넣으면 바로 정리 창을 엽니다
document.addEventListener('paste', e => {
  const items = [...(e.clipboardData?.items || [])];
  const file = items.find(i => i.type.startsWith('image/'))?.getAsFile();
  if (file) {
    e.preventDefault();
    if (cap) handleCapFile(file);
    else if (modalEl.hidden) openCapture({ file });
    return;
  }
  const inField = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
  const text = e.clipboardData?.getData('text/plain') || '';
  if (!inField && modalEl.hidden && text.trim().length >= 8) {
    e.preventDefault();
    openCapture({ text });
  }
});

/* =========================================================
   달력
   ========================================================= */
const EV_TYPES = { school: '학교 행사', deadline: '마감', personal: '개인' };
let calCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calSel = ymd(new Date());

function itemsOn(date) {
  const items = [];
  if (HOLIDAYS[date]) items.push({ type: 'holiday', title: HOLIDAYS[date] });
  S.events.filter(e => e.date === date).forEach(e => items.push(e));
  S.todos.filter(t => t.due === date).forEach(t => items.push({ type: 'todo', title: t.text, todo: true }));
  return items;
}

function renderCalendar() {
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  $('#calTitle').textContent = `${y}년 ${m + 1}월`;
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const cells = Math.ceil((first.getDay() + days) / 7) * 7;
  const start = addDays(first, -first.getDay());
  const t = ymd(new Date());
  let h = '';
  for (let i = 0; i < cells; i++) {
    const d = addDays(start, i), ds = ymd(d);
    const items = itemsOn(ds);
    const cls = ['cal-day',
      d.getMonth() !== m && 'other', d.getDay() === 0 && 'sun', d.getDay() === 6 && 'sat',
      HOLIDAYS[ds] && 'hol', ds === t && 'today', ds === calSel && 'sel'].filter(Boolean).join(' ');
    const dots = [...new Set(items.filter(x => x.type !== 'holiday').map(x => x.type))].slice(0, 3).map(tp => `<i class="d-${tp}"></i>`).join('');
    h += `<button class="${cls}" data-date="${ds}" title="${esc(items.map(x => x.title).join('\n'))}"><span class="num">${d.getDate()}</span><span class="cal-dots">${dots}</span></button>`;
  }
  $('#calGrid').innerHTML = h;
  renderAgenda();
}

function renderAgenda() {
  const d = parseYmd(calSel);
  const isToday = calSel === ymd(new Date());
  const items = itemsOn(calSel);
  const ag = $('#agenda');
  ag.innerHTML = `
    <h3>${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일 ${isToday ? '<span class="badge school">오늘</span>' : ''}</h3>
    ${items.length ? `<ul class="ag-list">${items.map(x => x.id && x.id === agEditId ? `
      <li class="ag-item editing" data-id="${x.id}">
        <form class="ag-edit" autocomplete="off">
          <input class="ag-e-title" value="${esc(x.title)}" maxlength="80" title="일정 이름">
          <div class="line">
            <select class="ag-e-type" title="분류">${Object.entries(EV_TYPES).map(([k, v]) => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
            <input type="date" class="ag-e-date" value="${x.date}" title="날짜 옮기기">
          </div>
          <div class="line">
            <button class="btn-line" type="button" data-act="cancel">취소</button>
            <button class="btn-primary" type="submit" style="flex:1">${icon('check')}저장</button>
          </div>
        </form>
      </li>` : `
      <li class="ag-item" ${x.id ? `data-id="${x.id}"` : ''}>
        <span class="badge ${x.type}">${x.type === 'holiday' ? '공휴일' : x.type === 'todo' ? '할 일' : EV_TYPES[x.type]}</span>
        <span class="t" ${x.id ? 'title="더블클릭해서 수정"' : ''}>${esc(x.title)}</span>
        ${x.id ? `<span class="row-actions"><button class="mini-btn" data-act="edit" title="수정">${icon('edit')}</button><button class="mini-btn del" data-act="del" title="삭제">${icon('trash')}</button></span>` : ''}
      </li>`).join('')}</ul>` : '<div class="ag-empty">등록된 일정이 없어요.</div>'}
    <form class="ag-add" id="agAdd" autocomplete="off">
      <input id="agTitle" placeholder="이 날 일정 추가 (예: 현장체험학습)" maxlength="80">
      <div class="line">
        <select id="agType">${Object.entries(EV_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <button class="btn-primary" type="submit" style="flex:1">${icon('plus')}추가</button>
      </div>
    </form>`;
}

$('#calGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-date]');
  if (!b) return;
  calSel = b.dataset.date;
  agEditId = null;
  const d = parseYmd(calSel);
  if (d.getMonth() !== calCursor.getMonth()) calCursor = new Date(d.getFullYear(), d.getMonth(), 1);
  renderCalendar();
});
// 제목 옆 화살표: 한 달씩 / '오늘' 옆 화살표: 하루씩
$('#calPrev').addEventListener('click', () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); renderCalendar(); });
$('#calNext').addEventListener('click', () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); renderCalendar(); });
function selectDay(date) {
  calSel = ymd(date);
  calCursor = new Date(date.getFullYear(), date.getMonth(), 1);
  agEditId = null;
  renderCalendar();
}
$('#calToday').addEventListener('click', () => selectDay(new Date()));
$('#dayPrev').addEventListener('click', () => selectDay(addDays(parseYmd(calSel), -1)));
$('#dayNext').addEventListener('click', () => selectDay(addDays(parseYmd(calSel), 1)));

let agEditId = null; // 수정 중인 일정
function startEditEvent(id) {
  agEditId = id;
  renderAgenda();
  const inp = $('#agenda .ag-e-title');
  if (inp) { inp.focus(); inp.select(); }
}
$('#agenda').addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.classList.contains('ag-edit')) {
    const ev = S.events.find(x => x.id === agEditId);
    const f = e.target;
    const title = $('.ag-e-title', f).value.trim();
    if (!ev || !title) return;
    const newDate = $('.ag-e-date', f).value || ev.date;
    const moved = newDate !== ev.date;
    Object.assign(ev, { title, type: $('.ag-e-type', f).value, date: newDate });
    save();
    agEditId = null;
    if (moved) { selectDay(parseYmd(newDate)); toast(`${md(parseYmd(newDate))}로 옮겼어요.`); }
    else renderCalendar();
    renderWeek(); renderHeader();
    return;
  }
  const title = $('#agTitle').value.trim();
  if (!title) return;
  S.events.push({ id: uid(), date: calSel, title, type: $('#agType').value });
  save();
  renderCalendar(); renderWeek(); renderHeader();
  $('#agTitle').focus();
});
$('#agenda').addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  const id = e.target.closest('.ag-item')?.dataset.id;
  if (act === 'edit') startEditEvent(id);
  else if (act === 'cancel') { agEditId = null; renderAgenda(); }
  else if (act === 'del') {
    S.events = S.events.filter(x => x.id !== id);
    save(); renderCalendar(); renderWeek(); renderHeader();
  }
});
$('#agenda').addEventListener('dblclick', e => {
  const li = e.target.closest('.ag-item[data-id]:not(.editing)');
  if (li) startEditEvent(li.dataset.id);
});
$('#agenda').addEventListener('keydown', e => {
  if (e.key === 'Escape' && agEditId) { e.stopPropagation(); agEditId = null; renderAgenda(); }
});

/* =========================================================
   학생 명렬표
   ========================================================= */
function sortedStudents() { return [...S.students].sort((a, b) => (a.no || 999) - (b.no || 999) || a.name.localeCompare(b.name, 'ko')); }

function renderRoster() {
  const q = $('#rosterSearch').value.trim();
  $('#rosterCount').textContent = S.students.length ? `${S.students.length}명` : '';
  const body = $('#rosterBody');
  if (!S.students.length) {
    body.innerHTML = `<div class="empty-state">아직 학생 명단이 없어요.<br><button class="btn-soft" data-act="import">명단 한 번에 입력하기</button></div>`;
    return;
  }
  const list = sortedStudents().filter(s => !q || s.name.includes(q) || s.tags.some(t => t.includes(q)) || s.memos.some(m => m.text.includes(q)));
  if (!list.length) { body.innerHTML = '<div class="empty-state">검색 결과가 없어요.</div>'; return; }
  body.innerHTML = `<div class="roster-grid">${list.map(s => {
    const last = s.memos[0];
    return `<button class="stu" data-id="${s.id}" title="${esc(last ? `${last.text}` : '메모 없음')}">
      <span class="stu-top"><span class="stu-no">${s.no || '-'}</span><span class="stu-name">${esc(s.name)}</span>${s.memos.length ? `<span class="stu-memo-count">${s.memos.length}</span>` : ''}</span>
      <span class="stu-tags">${s.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</span>
      <span class="stu-sub">${last ? esc(last.text.split('\n')[0]) : '메모 없음'}</span>
    </button>`;
  }).join('')}</div>`;
}
$('#rosterSearch').addEventListener('input', renderRoster);
$('#rosterBody').addEventListener('click', e => {
  if (e.target.closest('[data-act="import"]')) { openImport(); return; }
  const b = e.target.closest('.stu');
  if (b) openStudent(b.dataset.id);
});
$('#rosterImport').addEventListener('click', () => openImport());
$('#rosterAdd').addEventListener('click', () => {
  const no = S.students.reduce((m, s) => Math.max(m, s.no || 0), 0) + 1;
  const s = { id: uid(), no, name: '새 학생', tags: [], memos: [] };
  S.students.push(s); save(); renderRoster();
  openStudent(s.id, true);
});

function openImport() {
  const body = openModal('학생 명단 입력', `
    <p class="sub" style="margin-top:0">한 줄에 한 명씩 입력하세요. 엑셀이나 나이스에서 <b>번호·이름</b> 열을 복사해 붙여넣어도 돼요.</p>
    <textarea class="box" id="impText" rows="12" autofocus placeholder="1 김민준&#10;2 이서연&#10;3 박지호&#10;…"></textarea>
    <div class="modal-actions">
      ${S.students.length ? '<button class="btn-line danger" data-mode="replace">전체 교체</button>' : ''}
      <button class="btn-primary" data-mode="append">${S.students.length ? '명단에 추가' : '저장'}</button>
    </div>`);
  body.addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    const lines = $('#impText').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const replace = b.dataset.mode === 'replace';
    if (replace && !confirm('기존 명단을 교체할까요? 이름이 같은 학생의 메모는 유지돼요.')) return;
    const old = replace ? S.students : [];
    let next = replace ? 0 : S.students.reduce((m, s) => Math.max(m, s.no || 0), 0);
    const added = lines.map(l => {
      const m = l.match(/^(\d+)[\s.,)\-:번]*(.+)$/);
      const no = m ? +m[1] : ++next;
      if (m) next = Math.max(next, no);
      const name = (m ? m[2] : l).split(/[\t,]/)[0].trim();
      const prev = old.find(s => s.name === name);
      return prev ? { ...prev, no } : { id: uid(), no, name, tags: [], memos: [] };
    }).filter(s => s.name);
    S.students = replace ? added : [...S.students, ...added];
    save(); renderRoster(); closeModal();
    toast(`${added.length}명을 ${replace ? '새 명단으로 저장' : '추가'}했어요.`);
  });
}

function openStudent(id, focusName = false) {
  const s = S.students.find(x => x.id === id);
  if (!s) return;
  const memoHtml = () => s.memos.length
    ? s.memos.map(m => `<li class="memo" data-id="${m.id}"><div class="body"><time>${new Date(m.at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}</time>${esc(m.text)}</div><span class="row-actions"><button class="mini-btn del" data-act="delmemo" title="메모 삭제">${icon('trash')}</button></span></li>`).join('')
    : '<li class="ag-empty">아직 메모가 없어요.</li>';
  const body = openModal('학생 정보', `
    <div class="stu-edit-top">
      <input type="number" id="stuNo" value="${s.no || ''}" min="1" title="번호">
      <input id="stuName" value="${esc(s.name)}" maxlength="20" title="이름">
    </div>
    <label class="field"><span>특이사항 태그 <small>쉼표로 구분 · 예: 땅콩 알레르기, 방과후, 상담필요</small></span>
      <input id="stuTags" value="${esc(s.tags.join(', '))}" placeholder="태그 없음">
    </label>
    <label class="field"><span>메모 추가</span>
      <textarea class="box" id="memoText" rows="3" placeholder="관찰 내용, 상담 기록, 학부모 연락 등 (Ctrl+Enter로 저장)" ${focusName ? '' : 'autofocus'}></textarea>
    </label>
    <div class="modal-actions" style="margin-top:0"><button class="btn-primary" id="memoAdd">${icon('plus')}메모 저장</button></div>
    <ul class="memo-list" id="memoList">${memoHtml()}</ul>
    <div class="modal-actions"><button class="link-btn danger" id="stuDel">${icon('trash')}학생 삭제</button></div>`,
    { onClose: () => { renderRoster(); } });

  if (focusName) setTimeout(() => { $('#stuName').focus(); $('#stuName').select(); }, 40);
  const commitInfo = () => {
    s.name = $('#stuName').value.trim() || s.name;
    s.no = +$('#stuNo').value || null;
    s.tags = $('#stuTags').value.split(',').map(t => t.trim()).filter(Boolean);
    save();
  };
  ['#stuNo', '#stuName', '#stuTags'].forEach(sel => $(sel, body).addEventListener('change', commitInfo));
  const addMemo = () => {
    const text = $('#memoText').value.trim();
    if (!text) return;
    s.memos.unshift({ id: uid(), at: Date.now(), text });
    save();
    $('#memoText').value = '';
    $('#memoList').innerHTML = memoHtml();
    hydrateIcons($('#memoList'));
  };
  $('#memoAdd', body).addEventListener('click', addMemo);
  $('#memoText', body).addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addMemo(); });
  $('#memoList', body).addEventListener('click', e => {
    const b = e.target.closest('[data-act="delmemo"]');
    if (!b || !confirm('이 메모를 삭제할까요?')) return;
    const mid = b.closest('.memo').dataset.id;
    s.memos = s.memos.filter(m => m.id !== mid);
    save();
    $('#memoList').innerHTML = memoHtml();
  });
  $('#stuDel', body).addEventListener('click', () => {
    if (!confirm(`${s.name} 학생과 메모를 모두 삭제할까요?`)) return;
    S.students = S.students.filter(x => x.id !== s.id);
    save(); closeModal();
  });
}

/* =========================================================
   설정 · 백업
   ========================================================= */
function openSettings() {
  const st = S.settings;
  let periods = S.timetable.periods.map(p => ({ ...p }));
  let loc = { ...st.loc };
  const periodRows = () => periods.map((p, i) => `
    <div class="period-row" data-i="${i}">
      <b>${i + 1}교시</b>
      <input type="time" data-k="start" value="${p.start}"><span>~</span><input type="time" data-k="end" value="${p.end}">
      <button class="mini-btn del" data-act="rmp" title="교시 삭제">${icon('x')}</button>
    </div>`).join('');

  const body = openModal('설정', `
    <div class="section-title">선생님 · 학급</div>
    <label class="field"><span>선생님 이름</span><input id="sTeacher" value="${esc(st.teacher)}" placeholder="예: 김OO (인사말에 쓰여요)"></label>
    <div class="field-row">
      <label class="field"><span>학교</span><input id="sSchool" value="${esc(st.school)}" placeholder="예: OO초등학교"></label>
      <label class="field"><span>학급</span><input id="sClass" value="${esc(st.className)}" placeholder="예: 6학년 3반"></label>
    </div>

    <div class="section-title">학사일정</div>
    <div class="field-row">
      <label class="field"><span>1학기 개학일</span><input type="date" id="sSem1" value="${st.sem1Start}"></label>
      <label class="field"><span>2학기 개학일</span><input type="date" id="sSem2" value="${st.sem2Start}"></label>
    </div>
    <div class="field-row">
      <label class="field"><span>D-day 이름</span><input id="sDdayL" value="${esc(st.ddayLabel)}" placeholder="예: 겨울방학"></label>
      <label class="field"><span>D-day 날짜</span><input type="date" id="sDdayD" value="${st.ddayDate}"></label>
    </div>

    <div class="section-title">날씨 지역</div>
    <label class="field"><span>현재: <b id="sLocName">${esc(loc.name)}</b></span>
      <div style="display:flex;gap:6px"><input id="sLocQ" placeholder="동네·도시 이름 (예: 중구, 수원, 강남구)" style="flex:1"><button class="btn-line" id="sLocBtn" type="button">${icon('search')}검색</button></div>
      <div class="loc-results" id="sLocRes"></div>
    </label>

    <div class="section-title">AI 메시지 정리</div>
    <p class="sub" style="margin-top:0">Claude API 키를 넣으면 업무 메시지·캡처를 AI가 읽고 할 일과 달력 일정으로 <b>알아서 저장</b>해요.
      키는 <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Anthropic Console</a>에서 만들 수 있어요. Claude Pro 구독과는 별도로 쓴 만큼 결제돼요.</p>
    <label class="field"><span>정리에 쓸 AI</span>
      <select id="sAiModel">${Object.entries(AI_MODELS).map(([k, v]) => `<option value="${k}" ${aiModel() === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <small>대부분의 업무 메시지는 Haiku로 충분해요. 길고 복잡한 공문이나 흐린 캡처가 잘 안 읽히면 Opus로 바꿔 보세요.</small>
    </label>
    <label class="field"><span>API 키 <small id="sAiState">${getAiKey() ? `저장됨 (…${esc(getAiKey().slice(-4))})` : '아직 없음'}</small></span>
      <div style="display:flex;gap:6px"><input type="password" id="sAiKey" placeholder="${getAiKey() ? '바꾸려면 새 키 입력' : 'sk-ant-로 시작하는 키'}" autocomplete="off" style="flex:1">
      ${getAiKey() ? `<button class="btn-line danger" id="sAiDel" type="button">${icon('trash')}키 삭제</button>` : ''}</div>
      <small>키는 이 컴퓨터 브라우저에만 저장되고 백업 파일에는 들어가지 않아요. 정리할 메시지와 캡처는 Anthropic으로 전송되니, 학생 실명·연락처 같은 민감한 정보가 담긴 메시지는 주의해 주세요.</small>
    </label>

    <div class="section-title">교시 시간</div>
    <div id="sPeriods">${periodRows()}</div>
    <button class="link-btn small" id="sAddP">${icon('plus')}교시 추가</button>
    <p class="sub">교시 사이가 40분 이상 비면 점심시간으로 표시돼요.</p>

    <div class="modal-actions"><button class="btn-primary" id="sSave">${icon('check')}저장</button></div>

    ${syncSectionHtml()}

    <div class="section-title">데이터</div>
    <p class="sub" style="margin-top:0">${syncCfg() ? '데이터는 이 컴퓨터와 깃허브 비공개 저장소에 함께 저장돼요. 따로 백업 파일을 남겨 둘 수도 있어요.' : '모든 내용은 이 컴퓨터의 브라우저에만 저장돼요. 컴퓨터를 바꾸거나 브라우저 기록을 지우기 전에 백업해 두세요.'}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-line" id="sExport">${icon('download')}백업 파일 저장</button>
      <button class="btn-line" id="sImport">${icon('upload')}백업 불러오기</button>
      <input type="file" id="sImportFile" accept="application/json,.json" hidden>
      <button class="btn-line danger" id="sReset" style="margin-left:auto">${icon('trash')}전체 초기화</button>
    </div>`);

  const syncPeriods = () => {
    $$('.period-row', body).forEach(r => {
      const p = periods[+r.dataset.i];
      p.start = $('[data-k="start"]', r).value || p.start;
      p.end = $('[data-k="end"]', r).value || p.end;
    });
  };
  $('#sPeriods', body).addEventListener('click', e => {
    const b = e.target.closest('[data-act="rmp"]');
    if (!b) return;
    syncPeriods();
    if (periods.length <= 1) return;
    periods.splice(+b.closest('.period-row').dataset.i, 1);
    $('#sPeriods').innerHTML = periodRows();
  });
  $('#sAddP', body).addEventListener('click', () => {
    syncPeriods();
    const last = periods[periods.length - 1];
    const s = toMin(last.end) + 10, e2 = s + 40;
    const f = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
    periods.push({ start: f(s), end: f(e2) });
    $('#sPeriods').innerHTML = periodRows();
  });

  const searchLoc = async () => {
    const q = $('#sLocQ').value.trim();
    if (!q) return;
    const res = $('#sLocRes');
    res.innerHTML = '<span class="sub">검색 중…</span>';
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=ko&countryCode=KR`).then(r => r.json());
      if (!r.results?.length) { res.innerHTML = '<span class="sub">찾지 못했어요. 시·군·구 이름으로 다시 검색해 보세요.</span>'; return; }
      res.innerHTML = r.results.map((x, i) => `<button type="button" data-i="${i}">${esc([x.admin1, x.admin2, x.name].filter((v, j, a) => v && a.indexOf(v) === j).join(' '))}</button>`).join('');
      res.onclick = e => {
        const b = e.target.closest('[data-i]');
        if (!b) return;
        const x = r.results[+b.dataset.i];
        loc = { name: [x.admin1?.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, ''), x.name].filter(Boolean).join(' '), lat: +x.latitude.toFixed(4), lon: +x.longitude.toFixed(4) };
        $('#sLocName').textContent = loc.name + ' (저장을 눌러 적용)';
        res.innerHTML = '';
      };
    } catch (e) { res.innerHTML = '<span class="sub">검색에 실패했어요. 인터넷 연결을 확인해 주세요.</span>'; }
  };
  $('#sLocBtn', body).addEventListener('click', searchLoc);
  $('#sLocQ', body).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchLoc(); } });

  $('#sSave', body).addEventListener('click', () => {
    syncPeriods();
    Object.assign(st, {
      teacher: $('#sTeacher').value.trim(), school: $('#sSchool').value.trim(), className: $('#sClass').value.trim(),
      sem1Start: $('#sSem1').value, sem2Start: $('#sSem2').value,
      ddayLabel: $('#sDdayL').value.trim(), ddayDate: $('#sDdayD').value,
      aiModel: $('#sAiModel').value,
    });
    const newKey = $('#sAiKey').value.trim();
    if (newKey) { try { localStorage.setItem(AI_KEY, newKey); } catch (e) { toast('키를 저장하지 못했어요.'); } }
    const locChanged = loc.lat !== st.loc.lat || loc.lon !== st.loc.lon;
    st.loc = loc;
    periods.sort((a, b) => toMin(a.start) - toMin(b.start));
    S.timetable.periods = periods;
    normalizeGrid();
    save();
    closeModal();
    renderAll();
    if (locChanged) loadWeather(true);
    toast('설정을 저장했어요.');
  });

  $('#sAiDel', body)?.addEventListener('click', () => {
    if (!confirm('저장된 API 키를 지울까요? 메시지 정리는 기본 방식으로 돌아가요.')) return;
    localStorage.removeItem(AI_KEY);
    $('#sAiState').textContent = '삭제됨';
    $('#sAiDel').remove();
  });

  wireSyncSection(body);
  $('#sExport', body).addEventListener('click', exportBackup);
  $('#sImport', body).addEventListener('click', () => $('#sImportFile').click());
  $('#sImportFile', body).addEventListener('change', e => importBackup(e.target.files[0]));
  $('#sReset', body).addEventListener('click', () => {
    if (!confirm(`정말 이 컴퓨터의 모든 데이터(할 일, 일정, 학생 메모, 시간표)를 지울까요? 되돌릴 수 없어요.${syncCfg() ? '\n(데이터 맞추기 연결도 끊겨요. 깃허브에 저장된 데이터는 남아 있어요.)' : ''}`)) return;
    Object.keys(localStorage).filter(k => k === KEY || k === AI_KEY || k === SYNC_CFG || k === SYNC_META || k.startsWith(IMG_PREFIX)).forEach(k => localStorage.removeItem(k));
    location.reload();
  });
}
$('#settingsBtn').addEventListener('click', openSettings);

function exportBackup() {
  const data = { app: 'schoolboard', version: 1, exportedAt: new Date().toISOString(), state: S, images: {} };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(IMG_PREFIX)) data.images[k.slice(IMG_PREFIX.length)] = localStorage.getItem(k);
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  a.download = `스쿨보드-백업-${ymd(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importBackup(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (data.app !== 'schoolboard' || !data.state) throw new Error('형식');
      if (!confirm('백업 파일로 지금 데이터를 덮어쓸까요?')) return;
      Object.keys(localStorage).filter(k => k.startsWith(IMG_PREFIX)).forEach(k => localStorage.removeItem(k));
      Object.entries(data.images || {}).forEach(([id, v]) => { try { localStorage.setItem(IMG_PREFIX + id, v); } catch (e) { /* 용량 초과 시 이미지 생략 */ } });
      localStorage.setItem(KEY, JSON.stringify({ ...data.state, updatedAt: Date.now() }));
      syncMeta.dirty = true; saveMeta(); // 불러온 내용을 다른 컴퓨터에도 보내도록
      location.reload();
    } catch (e) { toast('스쿨보드 백업 파일이 아니에요.'); }
  };
  r.readAsText(file);
}

/* =========================================================
   집·학교 데이터 맞추기
   선생님의 깃허브 '비공개' 저장소에 데이터 파일 하나를 두고 여러 컴퓨터가 함께 씁니다.
   ========================================================= */
const SYNC_CFG = 'schoolboard.sync';      // {repo, token}: 이 컴퓨터에만 저장 (백업·동기화에 안 들어감)
const SYNC_META = 'schoolboard.syncmeta'; // {sha, base, at, dirty}
const SYNC_PATH = 'schoolboard-data.json';
// 폴더 바로가기는 컴퓨터마다 경로가 달라서, 날씨 캐시는 필요 없어서 맞추지 않습니다
const SYNC_KEYS = ['settings', 'timetable', 'events', 'todos', 'done', 'students', 'notes'];

const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const syncCfg = () => readJSON(SYNC_CFG, null);
// save()가 파일 위쪽에 있어 var로 둡니다 (let이면 선언 전에 읽을 수 없음)
var syncMeta = readJSON(SYNC_META, { sha: '', base: 0, at: 0, dirty: true });
var applyingRemote = false;
let syncBusy = false, syncError = '', syncTimer = null, editSeq = 0;
function saveMeta() { try { localStorage.setItem(SYNC_META, JSON.stringify(syncMeta)); } catch (e) { /* 무시 */ } }
function markDirty() {
  if (!syncMeta) return; // 시작 중
  editSeq++;
  syncMeta.dirty = true;
  saveMeta();
  scheduleSync(4000);
}
function scheduleSync(ms) {
  if (!syncCfg()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), ms);
}

const b64encode = str => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const b64decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));

function ghFetch(url, cfg, opts = {}) {
  return fetch(`https://api.github.com${url}`, {
    cache: 'no-store',
    ...opts,
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
  });
}
function syncErr(status, where) {
  const e = new Error(`github ${status}`);
  e.userMsg = status === 401 ? '토큰이 올바르지 않거나 기간이 지났어요. 설정에서 새 토큰을 넣어 주세요.'
    : status === 403 ? '토큰에 이 저장소를 고칠 권한이 없어요. 토큰 권한(Contents: Read and write)을 확인해 주세요.'
    : status === 404 && where === 'repo' ? '저장소를 찾을 수 없어요. 저장소 이름과 토큰이 그 저장소를 쓸 수 있는지 확인해 주세요.'
    : `깃허브 오류가 났어요 (${status}). 잠시 뒤 다시 해 볼게요.`;
  return e;
}

const pickSync = st => Object.fromEntries(SYNC_KEYS.map(k => [k, st[k]]));
// 두 컴퓨터에서 모두 바뀌었을 때: 목록은 합치고(같은 항목은 더 최근에 저장한 쪽), 설정·시간표는 최근 쪽
function mergeSync(local, remote, lt, rt) {
  const [first, second] = lt >= rt ? [local, remote] : [remote, local];
  const byId = (a = [], b = []) => {
    const m = new Map();
    a.forEach(x => m.set(x.id, x));
    b.forEach(x => { if (!m.has(x.id)) m.set(x.id, x); });
    return [...m.values()];
  };
  const out = { settings: first.settings, timetable: first.timetable };
  ['events', 'todos', 'done', 'notes'].forEach(k => { out[k] = byId(first[k], second[k]); });
  out.students = byId(first.students, second.students).map(s => {
    const o = (second.students || []).find(x => x.id === s.id);
    return o && o !== s ? { ...s, memos: byId(s.memos, o.memos).sort((a, b) => b.at - a.at) } : s;
  });
  const doneIds = new Set(out.done.map(t => t.id)); // 한쪽에서 완료한 일은 완료로
  out.todos = out.todos.filter(t => !doneIds.has(t.id));
  return out;
}

function applyRemote(data, updatedAt) {
  applyingRemote = true;
  SYNC_KEYS.forEach(k => { if (data[k] !== undefined) S[k] = data[k]; });
  S = merge(structuredClone(DEFAULT_STATE), S);
  S.updatedAt = updatedAt;
  normalizeGrid();
  save();
  applyingRemote = false;
  renderAll();
  renderAllNotes();
}

// 글을 쓰고 있을 때는 다른 컴퓨터의 내용을 덮어씌우지 않고 잠시 미룹니다
function userIsTyping() {
  const typing = el => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  return !modalEl.hidden || ttEdit || typing(document.activeElement) || typing(pipWin?.document.activeElement);
}

async function syncNow({ manual = false } = {}) {
  const cfg = syncCfg();
  if (!cfg) return;
  if (syncBusy) { scheduleSync(2000); return; }
  syncBusy = true;
  renderSyncStatus();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const seq = editSeq;
      const res = await ghFetch(`/repos/${cfg.repo}/contents/${SYNC_PATH}`, cfg);
      let remote = null, sha = '';
      if (res.status === 404) {
        const repoRes = await ghFetch(`/repos/${cfg.repo}`, cfg);
        if (!repoRes.ok) throw syncErr(repoRes.status, 'repo');
      } else if (!res.ok) {
        throw syncErr(res.status);
      } else {
        const j = await res.json();
        sha = j.sha;
        remote = JSON.parse(b64decode(j.content));
      }

      const remoteChanged = !!remote && remote.updatedAt !== syncMeta.base;
      let next = null;
      if (remoteChanged) {
        if (!manual && userIsTyping()) { scheduleSync(15000); break; }
        if (!syncMeta.dirty) {
          applyRemote(remote.data, remote.updatedAt);
          syncMeta = { sha, base: remote.updatedAt, at: Date.now(), dirty: false };
          saveMeta();
          break;
        }
        next = mergeSync(pickSync(S), remote.data, S.updatedAt || 0, remote.updatedAt || 0);
        applyRemote(next, Date.now());
        toast('다른 컴퓨터에서 바뀐 내용과 합쳤어요.');
      } else if (syncMeta.dirty || !remote) {
        next = pickSync(S);
      } else {
        syncMeta.at = Date.now(); saveMeta();
        break;
      }

      const updatedAt = Date.now();
      const put = await ghFetch(`/repos/${cfg.repo}/contents/${SYNC_PATH}`, cfg, {
        method: 'PUT',
        body: JSON.stringify({
          message: `스쿨보드 데이터 저장 ${new Date(updatedAt).toLocaleString('ko-KR')}`,
          content: b64encode(JSON.stringify({ app: 'schoolboard', version: 1, updatedAt, data: next }, null, 1)),
          ...(sha ? { sha } : {}),
        }),
      });
      if (put.status === 409 || put.status === 422) continue; // 그사이 다른 컴퓨터가 저장함: 다시 받아서 합치기
      if (!put.ok) throw syncErr(put.status);
      const pj = await put.json();
      S.updatedAt = updatedAt;
      localStorage.setItem(KEY, JSON.stringify(S));
      // 올리는 동안 또 고친 게 있으면 다음에 다시 올립니다
      syncMeta = { sha: pj.content.sha, base: updatedAt, at: Date.now(), dirty: editSeq !== seq };
      saveMeta();
      if (syncMeta.dirty) scheduleSync(2000);
      break;
    }
    syncError = '';
  } catch (e) {
    console.warn('동기화 실패', e);
    const first = !syncError;
    syncError = e.userMsg || '인터넷에 연결되지 않아 맞추지 못했어요. 연결되면 다시 해 볼게요.';
    if (first || manual) toast(syncError);
  }
  syncBusy = false;
  renderSyncStatus();
}

function renderSyncStatus() {
  const el = document.getElementById('sSyncState');
  $('#settingsBtn').classList.toggle('has-error', !!syncError && !!syncCfg());
  if (!el) return;
  el.textContent = syncBusy ? '맞추는 중…'
    : syncError ? syncError
    : syncMeta.at ? `마지막으로 맞춘 시각: ${new Date(syncMeta.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : '아직 맞춘 적 없어요.';
  el.classList.toggle('error', !!syncError);
}

function syncSectionHtml() {
  const cfg = syncCfg();
  return `
    <div class="section-title">집·학교 데이터 맞추기</div>
    <p class="sub" style="margin-top:0">깃허브 <b>비공개</b> 저장소를 거쳐 여러 컴퓨터의 할 일·일정·시간표·학생 메모·메모를 똑같이 맞춰요.
      한쪽에서 고치면 1분 안에 다른 컴퓨터에도 반영돼요. 폴더 바로가기와 할 일에 붙인 캡처 이미지는 컴퓨터마다 따로예요.</p>
    ${cfg ? `
      <div class="sync-box">
        <div><b>연결됨</b> · ${esc(cfg.repo)}</div>
        <div class="sub" id="sSyncState"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="btn-line" id="sSyncNow" type="button">${icon('refresh')}지금 맞추기</button>
          <button class="btn-line danger" id="sSyncOff" type="button" style="margin-left:auto">연결 끊기</button>
        </div>
      </div>` : `
      <div class="field-row">
        <label class="field"><span>저장소</span><input id="sSyncRepo" placeholder="깃허브아이디/school-board-data" autocomplete="off"></label>
        <label class="field"><span>토큰</span><input type="password" id="sSyncToken" placeholder="github_pat_로 시작" autocomplete="off"></label>
      </div>
      <small class="sub">토큰은 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">깃허브 토큰 만들기</a>에서 이 저장소만 고를 수 있게(Contents: Read and write) 만들어 주세요. 토큰은 이 컴퓨터에만 저장돼요.</small>
      <div style="margin-top:8px"><button class="btn-primary" id="sSyncOn" type="button">${icon('check')}연결하기</button> <span class="sub" id="sSyncState"></span></div>`}`;
}

function wireSyncSection(body) {
  renderSyncStatus();
  $('#sSyncNow', body)?.addEventListener('click', () => syncNow({ manual: true }));
  $('#sSyncOff', body)?.addEventListener('click', () => {
    if (!confirm('이 컴퓨터의 연결을 끊을까요? 데이터는 이 컴퓨터와 깃허브에 그대로 남아요.')) return;
    localStorage.removeItem(SYNC_CFG);
    syncError = '';
    closeModal(); openSettings();
  });
  $('#sSyncOn', body)?.addEventListener('click', async () => {
    const repo = $('#sSyncRepo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '').replace(/\.git$/, '');
    const token = $('#sSyncToken').value.trim();
    const st = $('#sSyncState');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) { st.textContent = '저장소 이름(아이디/저장소)과 토큰을 모두 넣어 주세요.'; return; }
    st.textContent = '확인하는 중…';
    try {
      const r = await ghFetch(`/repos/${repo}`, { token });
      if (!r.ok) throw syncErr(r.status, 'repo');
      const info = await r.json();
      if (!info.private) { st.textContent = '공개 저장소예요. 학생 정보가 누구에게나 보일 수 있어서 비공개 저장소만 쓸 수 있어요.'; return; }
      localStorage.setItem(SYNC_CFG, JSON.stringify({ repo, token }));
      syncMeta = { sha: '', base: 0, at: 0, dirty: true }; // 처음엔 양쪽 내용을 합칩니다
      saveMeta();
      syncError = '';
      await syncNow({ manual: true });
      closeModal(); openSettings();
      if (!syncError) toast('연결했어요. 이제 다른 컴퓨터와 데이터가 맞춰져요.');
    } catch (e) { st.textContent = e.userMsg || '연결하지 못했어요. 인터넷 연결을 확인해 주세요.'; }
  });
}

// 켤 때, 1분마다, 창으로 돌아올 때 맞춥니다
setInterval(() => syncNow(), 60e3);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });

/* =========================================================
   포스트잇 메모
   모든 창 맨 위 고정은 크롬·엣지의 문서 PIP 창(Document Picture-in-Picture)을 씁니다.
   ========================================================= */
const NOTE_COLORS = { yellow: '#fff4b8', pink: '#ffdfe6', green: '#dcf3e2', blue: '#dde9ff' };
const pipSupported = 'documentPictureInPicture' in window;
let pipWin = null;

const noteTime = ts => new Date(ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
function noteHtml(n) {
  return `<div class="note" data-id="${n.id}" style="background:${NOTE_COLORS[n.color] || NOTE_COLORS.yellow}">
    <textarea placeholder="여기에 바로 메모하세요" spellcheck="false">${esc(n.text)}</textarea>
    <div class="note-bar">
      <span class="note-colors">${Object.entries(NOTE_COLORS).map(([k, c]) => `<button class="note-dot" data-color="${k}" style="background:${c}" title="색 바꾸기"></button>`).join('')}</span>
      <span class="note-time">${noteTime(n.updated)}</span>
      <button class="note-btn" data-act="todo" title="이 메모를 할 일로 옮기기">${icon('arrowRight')}할 일</button>
      <button class="note-btn del" data-act="del" title="메모 삭제">${icon('trash')}</button>
    </div>
  </div>`;
}

function newNote() {
  const n = { id: uid(), text: '', color: 'yellow', updated: Date.now() };
  S.notes.unshift(n);
  save();
  return n;
}
function pruneEmptyNotes() {
  const n = S.notes.length;
  S.notes = S.notes.filter(x => x.text.trim());
  if (S.notes.length !== n) save();
}
const noteViews = () => [document, pipWin?.document].filter(Boolean);
function renderAllNotes() { renderNotesDrawer(); renderPip(); }

// 메모 패널과 고정 창 양쪽에서 같은 방식으로 동작하도록 이벤트를 연결합니다
function wireNotes(root) {
  root.addEventListener('input', e => {
    const ta = e.target.closest('.note textarea');
    if (!ta) return;
    const id = ta.closest('.note').dataset.id;
    const n = S.notes.find(x => x.id === id);
    if (!n) return;
    n.text = ta.value; n.updated = Date.now();
    save();
    noteViews().forEach(doc => {
      const el = doc.querySelector(`.note[data-id="${id}"]`);
      if (!el) return;
      const other = el.querySelector('textarea');
      if (other !== ta) other.value = n.text;
      el.querySelector('.note-time').textContent = noteTime(n.updated);
    });
  });
  root.addEventListener('click', e => {
    const noteEl = e.target.closest('.note');
    const n = noteEl && S.notes.find(x => x.id === noteEl.dataset.id);
    const dot = e.target.closest('[data-color]');
    if (dot && n) {
      n.color = dot.dataset.color;
      save();
      noteViews().forEach(doc => { const el = doc.querySelector(`.note[data-id="${n.id}"]`); if (el) el.style.background = NOTE_COLORS[n.color]; });
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'new') { const m = newNote(); renderAllNotes(); focusNote(m.id, e.target.ownerDocument); return; }
    if (!n) return;
    if (act === 'del') {
      // 고정 창에서는 확인 대화상자가 뜨지 않으므로 두 번 눌러 삭제합니다
      const btn = e.target.closest('[data-act="del"]');
      if (n.text.trim() && !btn.classList.contains('confirm')) {
        btn.classList.add('confirm');
        btn.innerHTML = '삭제할까요?';
        setTimeout(() => { if (btn.isConnected) { btn.classList.remove('confirm'); btn.innerHTML = icon('trash'); } }, 3000);
        return;
      }
      S.notes = S.notes.filter(x => x.id !== n.id);
      save(); renderAllNotes();
    } else if (act === 'todo') {
      if (!n.text.trim()) return;
      const text = n.text.trim().replace(/\s*\n\s*/g, ' / ');
      S.todos.push({ id: uid(), text, tag: 'normal', due: findDue(text), img: '', created: Date.now() });
      S.notes = S.notes.filter(x => x.id !== n.id);
      save(); renderAllNotes(); renderTodos(); renderHeader(); renderCalendar();
      toast('메모를 할 일로 옮겼어요.');
    }
  });
}

function focusNote(id, doc = document) {
  const ta = doc.querySelector(`.note[data-id="${id}"] textarea`);
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}

/* 메모 패널 (대시보드 오른쪽에서 열림) */
const drawer = $('#notesDrawer');
function renderNotesDrawer() {
  if (drawer.hidden) return;
  drawer.innerHTML = `
    <div class="drawer-head">
      <h2>포스트잇 메모 <small class="muted">${S.notes.length ? `${S.notes.length}개` : ''}</small></h2>
      <button class="icon-btn" data-act="close" title="닫기">${icon('x')}</button>
    </div>
    <div class="drawer-actions">
      <button class="btn-soft" data-act="new">${icon('plus')}새 메모</button>
      ${pipSupported ? `<button class="btn-line" data-act="pin">${icon('pin')}${pipWin ? '고정 창 앞으로' : '모든 창 맨 위에 띄우기'}</button>` : ''}
    </div>
    ${pipSupported ? '' : '<p class="ai-hint">이 브라우저는 맨 위 고정을 지원하지 않아요. 크롬이나 엣지에서 열면 메모를 다른 프로그램 위에 띄울 수 있어요.</p>'}
    <div class="note-list">${S.notes.length ? S.notes.map(noteHtml).join('') : '<div class="empty-state">메모가 없어요.<br>“새 메모”를 눌러 바로 적어 보세요.</div>'}</div>`;
}
function openNotes() {
  drawer.hidden = false;
  renderNotesDrawer();
  $('#notesBtn').classList.add('active');
}
function closeNotes() {
  drawer.hidden = true;
  $('#notesBtn').classList.remove('active');
  if (!pipWin) pruneEmptyNotes();
}
wireNotes(drawer);
drawer.addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close') closeNotes();
  if (act === 'pin') openPip();
});
$('#notesBtn').addEventListener('click', () => (drawer.hidden ? openNotes() : closeNotes()));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalEl.hidden && !drawer.hidden) closeNotes(); });

/* 모든 창 맨 위에 뜨는 고정 창 */
const PIP_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body { font-family: Pretendard, "Malgun Gothic", sans-serif; font-size: 14px; background: #f7f5ee; color: #2a2a22; display: flex; flex-direction: column; }
  button { font: inherit; color: inherit; cursor: pointer; }
  svg.i { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex: none; }
  .pip-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; font-weight: 600; font-size: 13px; color: #6b6550; }
  .pip-head span { display: inline-flex; align-items: center; gap: 5px; }
  .pip-new { border: 0; background: #2e7d57; color: #fff; border-radius: 8px; padding: 5px 10px; font-weight: 600; font-size: 12.5px; display: inline-flex; align-items: center; gap: 4px; }
  .note-list { flex: 1; overflow: auto; padding: 0 10px 10px; display: flex; flex-direction: column; gap: 10px; }
  .note { border-radius: 4px 4px 4px 14px; padding: 10px 10px 6px; box-shadow: 0 1px 2px rgba(60,50,10,.08), 0 6px 14px rgba(60,50,10,.08); }
  .note textarea { width: 100%; min-height: 90px; border: 0; background: transparent; resize: vertical; outline: none; font: inherit; font-size: 15px; line-height: 1.5; }
  .note-bar { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
  .note-colors { display: flex; gap: 4px; }
  .note-dot { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid rgba(0,0,0,.15); padding: 0; }
  .note-time { margin-left: auto; font-size: 11px; color: rgba(0,0,0,.4); }
  .note-btn { border: 0; background: rgba(255,255,255,.5); border-radius: 7px; padding: 3px 6px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 3px; color: rgba(0,0,0,.6); }
  .note-btn:hover { background: rgba(255,255,255,.9); color: #000; }
  .note-btn.del:hover, .note-btn.confirm { color: #dc4a4f; }
  .note-btn.confirm { background: #fff; font-weight: 600; }
  .empty { color: #8a8470; text-align: center; padding: 30px 10px; }
`;
function renderPip() {
  if (!pipWin) return;
  const body = pipWin.document.body;
  body.innerHTML = `
    <div class="pip-head"><span>${icon('pin')}스쿨보드 메모</span><button class="pip-new" data-act="new">${icon('plus')}새 메모</button></div>
    <div class="note-list">${S.notes.length ? S.notes.map(noteHtml).join('') : '<div class="empty">메모가 없어요.</div>'}</div>`;
}
async function openPip({ fresh = false } = {}) {
  if (!pipSupported) {
    openNotes();
    toast('이 브라우저는 맨 위 고정을 지원하지 않아요. 크롬이나 엣지에서 써 주세요.');
    return;
  }
  let target = null;
  if (fresh || !S.notes.length) {
    target = S.notes.find(n => !n.text.trim()) || newNote(); // 빈 메모가 있으면 그걸 다시 씀
  }
  if (!pipWin) {
    try {
      pipWin = await documentPictureInPicture.requestWindow({ width: 340, height: 460 });
    } catch (e) {
      console.warn(e);
      openNotes();
      toast('고정 창을 열지 못했어요. 메모 패널을 대신 열었어요.');
      return;
    }
    const d = pipWin.document;
    d.title = '스쿨보드 메모';
    d.head.innerHTML = `<meta charset="utf-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"><style>${PIP_CSS}</style>`;
    wireNotes(d.body);
    pipWin.addEventListener('pagehide', () => {
      pipWin = null;
      pruneEmptyNotes();
      renderNotesDrawer();
    });
  }
  renderAllNotes();
  if (target) focusNote(target.id, pipWin.document);
}
$('#memoFab').addEventListener('click', () => openPip({ fresh: true }));

/* =========================================================
   자주 쓰는 폴더 · 프로그램 · HTML 파일 바로가기
   브라우저는 탐색기나 프로그램을 직접 열 수 없어서, folder-opener의 설치 파일이 등록한
   schoolboard-folder: 주소로 넘기면 Windows가 열어 줍니다(프로그램은 처음 한 번 허락 필요).
   HTML 파일은 브라우저가 직접 새 탭으로 엽니다(스쿨보드를 파일로 열었을 때).
   ========================================================= */
let folderEdit = false;
const folderBar = $('#folderBar');
const cleanPath = p => p.trim().replace(/^["']+|["']+$/g, '').replace(/\//g, '\\');
const folderNameOf = p => cleanPath(p).replace(/\\+$/, '').split('\\').pop().replace(/\.(html?|lnk|exe|url)$/i, '') || p;
const isHtml = p => /\.html?$/i.test(p);
const isProgram = p => /\.(exe|lnk|url|appref-ms)$/i.test(p);
const linkIcon = p => (isHtml(p) ? 'file' : isProgram(p) ? 'app' : 'folder');

function renderFolders() {
  folderBar.classList.toggle('editing', folderEdit);
  const chips = S.folders.map(f => `<button class="folder-chip" data-id="${f.id}" title="${esc(folderEdit ? '눌러서 고치기' : f.path)}">${icon(folderEdit ? 'edit' : linkIcon(f.path))}<span>${esc(f.name)}</span></button>`).join('');
  folderBar.innerHTML = chips + (folderEdit
    ? `<button class="folder-chip add" data-act="add">${icon('plus')}<span>추가</span></button><button class="link-btn small" data-act="done">완료</button>`
    : S.folders.length
      ? `<button class="link-btn small" data-act="edit" title="바로가기 추가·수정·삭제">${icon('edit')}편집</button>`
      : `<button class="folder-chip add" data-act="add">${icon('plus')}<span>자주 쓰는 폴더·프로그램 추가</span></button><button class="link-btn small" data-act="help">${icon('help')}사용법</button>`);
}

function openHtml(f) {
  if (location.protocol !== 'file:') { toast('HTML 바로가기는 스쿨보드를 index.html 파일로 열었을 때만 돼요.'); return; }
  const [drive, ...rest] = f.path.split('\\');
  window.open(`file:///${drive}/${rest.map(encodeURIComponent).join('/')}`, '_blank');
}

function openFolder(f) {
  if (isHtml(f.path)) { openHtml(f); return; }
  // 경로를 base64(영문·숫자)로 감싸 보냄: 도우미가 이 모양의 주소만 받아서, 이상한 글자가 끼어들 틈이 없어요
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(f.path))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  // 1) 이 컴퓨터에서 켜져 있는 도우미에게 직접 부탁 (일부 학교 PC 크롬은 2번 방식을 막아요)
  const H = window.SCHOOLBOARD_HELPER;
  if (H && H.token) {
    fetch(`http://127.0.0.1:${H.port}/open?t=${H.token}&p=${b64}`, { cache: 'no-store' })
      .then(r => { if (!r.ok) toast(r.status === 403 ? '도우미를 다시 설치해 주세요.' : '열지 못했어요. 경로가 맞는지 확인해 주세요.'); })
      .catch(() => openViaProtocol(b64));   // 도우미가 꺼져 있으면 2번 방식으로
    return;
  }
  openViaProtocol(b64);
}

// 2) 브라우저의 주소 연결(schoolboard-folder:)로 열기
function openViaProtocol(b64) {
  // 탐색기가 열리면 이 창이 포커스를 잃어요. 몇 초 안에 그런 일이 없으면 설치 안내를 띄움
  let opened = false;
  const onBlur = () => { opened = true; };
  window.addEventListener('blur', onBlur, { once: true });
  setTimeout(() => {
    window.removeEventListener('blur', onBlur);
    if (!opened && document.hasFocus()) toast('폴더가 안 열렸나요?', { label: '해결 방법', fn: openFolderHelp });
  }, 4000);
  location.href = 'schoolboard-folder:b64:' + b64;
}

function openFolderForm(id) {
  const f = S.folders.find(x => x.id === id);
  const body = openModal(f ? '바로가기 고치기' : '바로가기 추가', `
    <label class="field"><span>폴더 · 프로그램 · HTML 파일 경로 <small>폴더나 바탕화면 바로가기를 오른쪽 클릭 → <b>경로로 복사</b> 후 붙여넣기</small></span>
      <input class="box" id="fdPath" value="${esc(f?.path || '')}" placeholder="C:\\Users\\…\\Desktop\\수업자료" autofocus>
    </label>
    <label class="field"><span>이름 <small>비워 두면 폴더·프로그램 이름을 써요</small></span>
      <input class="box" id="fdName" value="${esc(f?.name || '')}" maxlength="20" placeholder="예: 수업자료">
    </label>
    <div class="modal-actions">
      ${f ? `<button class="link-btn danger" data-act="del" style="margin-right:auto">${icon('trash')}삭제</button>` : ''}
      <button class="link-btn small" data-act="help">${icon('help')}안 열려요</button>
      <button class="btn-primary" data-act="save">${f ? '저장' : '추가'}</button>
    </div>`);
  const pathEl = $('#fdPath', body), nameEl = $('#fdName', body);
  const submit = () => {
    const path = cleanPath(pathEl.value);
    if (!/^([A-Za-z]:\\|%[^%]+%)/.test(path)) { toast('C:\\ 처럼 드라이브 문자로 시작하는 경로를 넣어 주세요.'); pathEl.focus(); return; }
    if (isHtml(path) && !/^[A-Za-z]:\\/.test(path)) { toast('HTML 파일은 C:\\Users\\… 처럼 전체 경로로 넣어 주세요.'); pathEl.focus(); return; }
    const name = nameEl.value.trim() || folderNameOf(path);
    if (f) Object.assign(f, { path, name });
    else S.folders.push({ id: uid(), path, name });
    save(); renderFolders(); closeModal();
  };
  [pathEl, nameEl].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
  body.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'save') submit();
    if (act === 'help') openFolderHelp();
    if (act === 'del' && confirm(`'${f.name}' 바로가기를 삭제할까요? (실제 폴더·파일은 지워지지 않아요)`)) {
      S.folders = S.folders.filter(x => x.id !== f.id);
      save(); renderFolders(); closeModal();
    }
  });
}

function openFolderHelp() {
  openModal('바로가기 사용법', `
    <ol class="help-steps">
      <li><b>처음 한 번만:</b> 스쿨보드 폴더 안의 <b>folder-opener</b> 폴더에서 <b>폴더열기-설치</b>를 더블클릭하세요. 컴퓨터마다 한 번씩 해야 해요(집, 학교 따로).</li>
      <li>설치하면 작은 도우미 프로그램이 컴퓨터를 켤 때 같이 켜져서(화면에는 안 보여요) 스쿨보드의 부탁을 받아 폴더를 열어 줘요. 설치한 뒤에는 스쿨보드를 <b>새로고침(F5)</b> 하세요.</li>
      <li>그래도 안 열리면 <b>폴더열기-설치</b>를 한 번 더 실행해 보세요. 브라우저가 앱을 열지 물으면 <b>열기</b>를 누르세요.</li>
      <li>경로는 탐색기에서 폴더를 오른쪽 클릭 → <b>경로로 복사</b>로 가져올 수 있어요.</li>
      <li>집과 학교의 사용자 이름이 다르면 <code>%USERPROFILE%\\Desktop\\수업자료</code>처럼 쓰면 두 컴퓨터에서 모두 열려요.</li>
      <li><b>프로그램</b>은 바탕화면의 바로가기(예: 한글, 엑셀)를 오른쪽 클릭 → <b>경로로 복사</b>해서 넣으세요. 처음 누를 때 Windows가 <b>“허락할까요?”</b> 하고 한 번 물어요. <b>예</b>를 누른 프로그램만 다음부터 바로 열려요.</li>
      <li><b>HTML 파일</b>도 추가할 수 있어요. 설치 없이 브라우저 새 탭으로 바로 열리고, 경로는 <code>C:\\Users\\…</code>처럼 전체를 써야 해요.</li>
    </ol>
    <p class="sub">안전을 위해 프로그램·파일은 이 컴퓨터에서 허락한 것만 열리고, 네트워크 경로(\\\\서버)는 열지 않아요. 연결을 지우려면 <b>폴더열기-제거</b>를 실행하세요.</p>`);
}

folderBar.addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'add') { openFolderForm(); return; }
  if (act === 'help') { openFolderHelp(); return; }
  if (act === 'edit' || act === 'done') { folderEdit = act === 'edit'; renderFolders(); return; }
  const chip = e.target.closest('.folder-chip[data-id]');
  if (!chip) return;
  if (folderEdit) openFolderForm(chip.dataset.id);
  else openFolder(S.folders.find(f => f.id === chip.dataset.id));
});

/* =========================================================
   사이드바 · 시작
   ========================================================= */
$$('.nav-btn[data-target]').forEach(b => b.addEventListener('click', () => {
  $$('.nav-btn').forEach(x => x.classList.toggle('active', x === b));
  const el = document.getElementById(b.dataset.target);
  if (b.dataset.target === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1200);
}));
$('#weatherRefresh').addEventListener('click', () => loadWeather(true));

function renderAll() {
  renderHeader();
  renderFolders();
  renderPeriodNow();
  renderTimetable();
  renderWeek();
  renderWeather();
  renderTodos();
  renderCalendar();
  renderRoster();
}

// 테두리를 실제 화면 픽셀 1칸에 딱 맞춥니다.
// (화면 배율 125%에서 1px는 1.25칸이 되어, 곧은 선과 둥근 모서리의 두께가 달라 보여요)
function snapBorderWidth() {
  const dpr = window.devicePixelRatio || 1;
  document.documentElement.style.setProperty('--bw', `${Math.max(1, Math.floor(1 * dpr)) / dpr}px`);
  matchMedia(`(resolution: ${dpr}dppx)`).addEventListener('change', snapBorderWidth, { once: true });
}
snapBorderWidth();

hydrateIcons();
renderAll();
tick();
setInterval(tick, 1000);
loadWeather();
setInterval(() => loadWeather(true), 30 * 60e3);
syncNow();
