'use strict';
/* =========================================================
   스쿨보드 공통 코드 — 선생님 대시보드(app.js)와 학생 화면(classroom.js)이 함께 씁니다.
   S(데이터)는 각 화면에서 정의합니다.
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
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
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

/* ---------- 지금 몇 교시인지 ---------- */
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

/* ---------- 날씨 코드 · 미세먼지 등급 ---------- */
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
function pmGrade(v, kind) {
  const cut = kind === 'pm10' ? [30, 80, 150] : [15, 35, 75];
  if (v == null || isNaN(v)) return null;
  const i = v <= cut[0] ? 0 : v <= cut[1] ? 1 : v <= cut[2] ? 2 : 3;
  return { i, key: ['good', 'normal', 'bad', 'worst'][i], label: ['좋음', '보통', '나쁨', '매우 나쁨'][i], pct: Math.min(100, v / (cut[2] * 1.2) * 100) };
}

/* ---------- 학기 몇 주차인지 ---------- */
function semesterInfo(today) {
  const cands = [['1학기', S.settings.sem1Start], ['2학기', S.settings.sem2Start]]
    .filter(([, d]) => d).map(([l, d]) => [l, parseYmd(d)])
    .filter(([, d]) => d <= today).sort((x, y) => y[1] - x[1]);
  if (!cands.length) return null;
  const [label, start] = cands[0];
  return { label, week: Math.floor(dayDiff(mondayOf(start), today) / 7) + 1 };
}
