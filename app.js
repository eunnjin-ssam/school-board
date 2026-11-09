'use strict';
/* =========================================================
   스쿨보드 — 교실 컴퓨터용 대시보드
   모든 데이터는 이 브라우저의 localStorage에 저장됩니다.
   공통 도구(유틸·아이콘·공휴일·교시·날씨 코드)는 common.js에 있습니다.
   ========================================================= */

/* ---------- 상태 ---------- */
const DEFAULT_STATE = {
  settings: {
    teacher: '', school: '', className: '',
    loc: { name: '서울 중구', lat: 37.5636, lon: 126.9976 },
    sem1Start: '2026-03-03', sem2Start: '2026-08-24',
    ddayLabel: '', ddayDate: '',
    morningBrief: true, // 하루 처음 켤 때 '오늘 요약' 보여 주기
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
  classNotice: { text: '', at: 0 }, // 학생 화면 알림장
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
    if (ymd(now) !== lastDay) { lastDay = ymd(now); calSel = lastDay; calCursor = new Date(now.getFullYear(), now.getMonth(), 1); renderAll(); maybeAutoBrief(); }
    renderHeader();
    renderPeriodNow();
    if (!ttEdit) renderTimetable();
  }
}

/* =========================================================
   날씨 · 미세먼지 (Open-Meteo, 키 불필요)
   ========================================================= */

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
  refreshBriefWeather();
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
    <label class="check-row"><input type="checkbox" id="sBrief" ${st.morningBrief !== false ? 'checked' : ''}> 하루 처음 켤 때 <b>오늘 요약</b>(일정·마감·시간표·날씨) 보여 주기</label>

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
      morningBrief: $('#sBrief').checked,
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
const SYNC_KEYS = ['settings', 'timetable', 'events', 'todos', 'done', 'students', 'notes', 'classNotice'];

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
  const out = { settings: first.settings, timetable: first.timetable, classNotice: first.classNotice };
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
const isWebUrl = p => /^https?:\/\//i.test(p);
const linkIcon = p => (isWebUrl(p) ? 'globe' : isHtml(p) ? 'file' : isProgram(p) ? 'app' : 'folder');
// 웹 주소로 보이면 https://… 모양으로 고쳐서 돌려줌 (예: naver.com → https://naver.com/). 아니면 null
function toWebUrl(raw) {
  const s = raw.trim().replace(/^["']+|["']+$/g, '');
  if (/^[A-Za-z]:[\\/]|^%|^\\\\/.test(s)) return null;   // C:\…, %USERPROFILE%…, \\서버 는 컴퓨터 안 경로
  if (!/^https?:\/\//i.test(s)) {
    if (!/^(www\.)?[\w-]+(\.[\w-]+)+([/:?#]|$)/i.test(s)) return null;
    if (/\.(html?|exe|lnk|url|txt|pdf|hwpx?|docx?|xlsx?|pptx?)$/i.test(s)) return null;   // english_test.html 같은 파일 이름
  }
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch (e) { return null; }
}
const siteNameOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } };

function renderFolders() {
  folderBar.classList.toggle('editing', folderEdit);
  const chip = f => `<button class="folder-chip${f.inMore ? ' in-more' : ''}" data-id="${f.id}"${folderEdit ? ' draggable="true"' : ''} title="${esc(folderEdit ? '눌러서 고치기 · 끌어서 순서 바꾸기' : f.path)}">${icon(folderEdit ? 'edit' : linkIcon(f.path))}<span>${esc(f.name)}</span>${folderEdit && f.inMore ? '<small>더보기</small>' : ''}</button>`;
  // 편집 중에는 모두 보여 주고, 평소에는 '더보기'에 넣은 것만 따로 모아 펼치기 목록에
  const shown = folderEdit ? S.folders : S.folders.filter(f => !f.inMore);
  const more = folderEdit ? [] : S.folders.filter(f => f.inMore);
  const moreBtn = more.length
    ? `<div class="folder-more"><button class="folder-chip more" data-act="more" aria-expanded="false">${icon('grid')}<span>더보기</span><b class="count">${more.length}</b></button>
         <div class="folder-more-panel" hidden>${more.map(chip).join('')}</div></div>`
    : '';
  folderBar.innerHTML = shown.map(chip).join('') + moreBtn + (folderEdit
    ? `<button class="folder-chip add" data-act="add">${icon('plus')}<span>추가</span></button><button class="link-btn small" data-act="done">완료</button>`
    : S.folders.length
      ? `<button class="link-btn small" data-act="edit" title="바로가기 추가·수정·삭제">${icon('edit')}편집</button>`
      : `<button class="folder-chip add" data-act="add">${icon('plus')}<span>자주 쓰는 폴더·프로그램·사이트 추가</span></button><button class="link-btn small" data-act="help">${icon('help')}사용법</button>`);
}

function openHtml(f) {
  if (location.protocol !== 'file:') { toast('HTML 바로가기는 스쿨보드를 index.html 파일로 열었을 때만 돼요.'); return; }
  const [drive, ...rest] = f.path.split('\\');
  openSite(`file:///${drive}/${rest.map(encodeURIComponent).join('/')}`);   // 사이트처럼 따로 떨어진 새 창으로
}

// 웹 사이트는 따로 떨어진 새 창으로: 스쿨보드가 전체화면이어도 그대로 두고, 창을 닫으면 바로 돌아와요.
// 화면의 85% 크기로 가운데에 띄움
function openSite(url) {
  const w = Math.round(screen.availWidth * 0.85), h = Math.round(screen.availHeight * 0.85);
  const left = Math.round((screen.availWidth - w) / 2) + (screen.availLeft || 0);
  const top = Math.round((screen.availHeight - h) / 2) + (screen.availTop || 0);
  window.open(url, '_blank', `noopener,popup,width=${w},height=${h},left=${left},top=${top}`);
}

function openFolder(f) {
  if (isWebUrl(f.path)) { openSite(f.path); return; }
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
    <label class="field"><span>폴더 · 프로그램 · HTML 파일 경로 또는 웹 주소 <small>폴더나 바탕화면 바로가기는 오른쪽 클릭 → <b>경로로 복사</b>, 사이트는 주소창의 주소를 복사해 붙여넣기</small></span>
      <input class="box" id="fdPath" value="${esc(f?.path || '')}" placeholder="C:\\Users\\…\\Desktop\\수업자료  또는  https://…" autofocus>
    </label>
    <label class="field"><span>이름 <small>비워 두면 폴더·프로그램 이름이나 사이트 주소를 써요</small></span>
      <input class="box" id="fdName" value="${esc(f?.name || '')}" maxlength="20" placeholder="예: 수업자료">
    </label>
    <label class="check-row"><input type="checkbox" id="fdMore" ${f?.inMore ? 'checked' : ''}> <b>더보기</b> 안에 넣기 <small class="muted">(위에 바로 보이지 않고, 더보기를 누르면 보여요)</small></label>
    <div class="modal-actions">
      ${f ? `<button class="link-btn danger" data-act="del" style="margin-right:auto">${icon('trash')}삭제</button>` : ''}
      <button class="link-btn small" data-act="help">${icon('help')}안 열려요</button>
      <button class="btn-primary" data-act="save">${f ? '저장' : '추가'}</button>
    </div>`);
  const pathEl = $('#fdPath', body), nameEl = $('#fdName', body);
  const submit = () => {
    const url = toWebUrl(pathEl.value);
    const path = url || cleanPath(pathEl.value);
    if (!url && !/^([A-Za-z]:\\|%[^%]+%)/.test(path)) { toast('C:\\ 처럼 드라이브 문자로 시작하는 경로나 https:// 로 시작하는 웹 주소를 넣어 주세요.'); pathEl.focus(); return; }
    if (!url && isHtml(path) && !/^[A-Za-z]:\\/.test(path)) { toast('HTML 파일은 C:\\Users\\… 처럼 전체 경로로 넣어 주세요.'); pathEl.focus(); return; }
    const name = nameEl.value.trim() || (url ? siteNameOf(url) : folderNameOf(path));
    const inMore = $('#fdMore', body).checked;
    if (f) Object.assign(f, { path, name, inMore });
    else S.folders.push({ id: uid(), path, name, inMore });
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
      <li><b>HTML 파일</b>도 추가할 수 있어요. 설치 없이 따로 떨어진 새 창으로 바로 열리고, 경로는 <code>C:\\Users\\…</code>처럼 전체를 써야 해요.</li>
      <li>바로가기가 많아지면 <b>편집</b>에서 바로가기를 눌러 <b>더보기 안에 넣기</b>를 체크하세요. 자주 안 쓰는 것은 <b>더보기</b>를 눌렀을 때만 보여요.</li>
      <li>순서를 바꾸려면 <b>편집</b>을 누른 뒤 바로가기를 원하는 자리로 <b>끌어다 놓으세요</b>.</li>
      <li><b>웹 사이트</b>는 주소창의 주소(<code>https://…</code>)를 복사해 넣으세요. 설치 없이 따로 떨어진 새 창으로 열리고, 창을 닫으면 스쿨보드로 돌아와요. (그 창에서 뒤로 가기는 <b>Alt + ←</b>)</li>
    </ol>
    <p class="sub">안전을 위해 프로그램·파일은 이 컴퓨터에서 허락한 것만 열리고, 네트워크 경로(\\\\서버)는 열지 않아요. 연결을 지우려면 <b>폴더열기-제거</b>를 실행하세요.</p>`);
}

folderBar.addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'add') { openFolderForm(); return; }
  if (act === 'help') { openFolderHelp(); return; }
  if (act === 'edit' || act === 'done') { folderEdit = act === 'edit'; renderFolders(); return; }
  if (act === 'more') { toggleFolderMore(); return; }
  const chip = e.target.closest('.folder-chip[data-id]');
  if (!chip) return;
  toggleFolderMore(false);
  if (folderEdit) openFolderForm(chip.dataset.id);
  else openFolder(S.folders.find(f => f.id === chip.dataset.id));
});

// 편집 중에는 바로가기를 끌어다 놓아서 순서를 바꿀 수 있어요 (놓는 자리의 왼쪽 절반이면 앞에, 오른쪽 절반이면 뒤에)
let dragFolderId = null;
const clearDropMarks = () => $$('.drop-before, .drop-after', folderBar).forEach(el => el.classList.remove('drop-before', 'drop-after'));
const dropSide = (el, e) => { const r = el.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? 'before' : 'after'; };
folderBar.addEventListener('dragstart', e => {
  const c = e.target.closest('.folder-chip[data-id]');
  if (!folderEdit || !c) return;
  dragFolderId = c.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragFolderId);
  c.classList.add('dragging');
});
folderBar.addEventListener('dragover', e => {
  const c = e.target.closest('.folder-chip[data-id]');
  if (!dragFolderId || !c || c.dataset.id === dragFolderId) return;
  e.preventDefault();
  clearDropMarks();
  c.classList.add('drop-' + dropSide(c, e));
});
folderBar.addEventListener('drop', e => {
  const c = e.target.closest('.folder-chip[data-id]');
  if (!dragFolderId || !c || c.dataset.id === dragFolderId) return;
  e.preventDefault();
  const moving = S.folders.find(f => f.id === dragFolderId);
  const rest = S.folders.filter(f => f.id !== dragFolderId);
  const at = rest.findIndex(f => f.id === c.dataset.id) + (dropSide(c, e) === 'after' ? 1 : 0);
  rest.splice(at, 0, moving);
  S.folders = rest;
  save(); renderFolders();
});
folderBar.addEventListener('dragend', () => { dragFolderId = null; clearDropMarks(); $$('.dragging', folderBar).forEach(el => el.classList.remove('dragging')); });

// '더보기' 펼치기 목록 열고 닫기 (바깥을 누르거나 Esc를 누르면 닫힘)
function toggleFolderMore(open) {
  const panel = $('.folder-more-panel', folderBar), btn = $('[data-act="more"]', folderBar);
  if (!panel) return;
  const show = open ?? panel.hidden;
  panel.hidden = !show;
  btn.setAttribute('aria-expanded', show);
}
document.addEventListener('click', e => { if (!e.target.closest('.folder-more')) toggleFolderMore(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleFolderMore(false); });

/* =========================================================
   아침 알림: 하루 처음 켤 때 오늘 챙길 것을 한 화면에 모아 보여 줍니다
   ========================================================= */
const BRIEF_KEY = 'schoolboard.briefDate'; // 이 컴퓨터에서 오늘 이미 봤는지 (컴퓨터마다 따로)
let briefOpen = false;

function briefWeatherHtml() {
  const c = S.cache.weather;
  if (!c || ymd(new Date(c.at)) !== ymd(new Date())) return '<p class="brief-empty">날씨를 불러오는 중이에요…</p>';
  const { w, a } = c;
  const [desc, emo] = wmo(w.current.weather_code, w.current.is_day);
  const hi = Math.round(w.daily.temperature_2m_max[0]), lo = Math.round(w.daily.temperature_2m_min[0]);
  const rain = w.daily.precipitation_probability_max?.[0] ?? 0;
  const grades = [pmGrade(a?.current?.pm10, 'pm10'), pmGrade(a?.current?.pm2_5, 'pm25')].filter(Boolean);
  const dust = grades.sort((x, y) => y.i - x.i)[0];
  const tips = [];
  if (rain >= 60) tips.push('비 소식이 있어요. 우산을 챙기도록 안내하고 실내 체육을 준비해요.');
  if (dust && dust.i >= 2) tips.push('미세먼지가 나빠요. 실외 활동은 줄이고 환기는 짧게 해요.');
  if (hi >= 30) tips.push('더운 날이에요. 물 마시기와 그늘 쉬기를 챙겨요.');
  if (lo <= -5) tips.push('추운 날이에요. 외투와 실내 온도를 챙겨요.');
  return `
    <div class="brief-weather"><span class="weather-emoji">${emo}</span>
      <div><b>${desc} ${Math.round(w.current.temperature_2m)}°</b><div class="sub">최고 ${hi}° · 최저 ${lo}° · 강수 ${rain}%</div></div>
      ${dust ? `<span class="badge brief-dust g-${dust.key}">미세먼지 ${dust.label}</span>` : ''}
    </div>
    ${tips.length ? `<ul class="brief-tips">${tips.map(t => `<li>${t}</li>`).join('')}</ul>` : '<p class="brief-empty">특별히 챙길 날씨는 없어요.</p>'}`;
}

function briefHtml() {
  const now = new Date(), t0 = today0(), ts = ymd(t0), tm = ymd(addDays(t0, 1));
  const meta = [`${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEK[now.getDay()]}요일`];
  const sem = semesterInfo(t0);
  if (sem) meta.push(`${sem.label} ${sem.week}주차`);
  const { ddayLabel, ddayDate } = S.settings;
  if (ddayDate) {
    const n = dayDiff(t0, parseYmd(ddayDate));
    if (n >= 0) meta.push(`${esc(ddayLabel || '디데이')} ${n ? `D-${n}` : 'D-DAY'}`);
  }

  const evs = [...(HOLIDAYS[ts] ? [{ title: HOLIDAYS[ts], type: 'holiday' }] : []), ...S.events.filter(e => e.date === ts)]
    .sort((x, y) => x.title.localeCompare(y.title, 'ko'));
  const due = sortedTodos().filter(t => t.due && t.due <= tm);
  const rest = S.todos.length - due.length;

  const dow = now.getDay();
  const isSchoolDay = dow >= 1 && dow <= 5 && !HOLIDAYS[ts];
  const classes = isSchoolDay ? S.timetable.grid[dow - 1].map((v, i) => ({ v, i, sp: S.timetable.special[dow - 1][i] })).filter(x => x.v) : [];

  return `
    <p class="brief-meta">${meta.join(' · ')}</p>
    <div class="brief-grid">
      <section class="brief-box">
        <h3>${icon('calendar')}오늘 일정</h3>
        ${evs.length ? `<ul class="brief-list">${evs.map(e => `<li><span class="badge ${e.type}">${e.type === 'holiday' ? '공휴일' : EV_TYPES[e.type]}</span>${esc(e.title)}</li>`).join('')}</ul>` : '<p class="brief-empty">오늘 등록된 일정은 없어요.</p>'}
      </section>
      <section class="brief-box">
        <h3>${icon('clock')}마감 챙기기</h3>
        ${due.length ? `<ul class="brief-list">${due.map(t => { const d = dueInfo(t.due); return `<li><span class="due ${d.cls}">${d.text}</span>${esc(t.text)}</li>`; }).join('')}</ul>` : '<p class="brief-empty">오늘·내일 마감인 일은 없어요.</p>'}
        ${rest > 0 ? `<p class="sub">그 밖에 할 일 ${rest}개가 더 있어요.</p>` : ''}
      </section>
      <section class="brief-box">
        <h3>${icon('table')}오늘 시간표</h3>
        ${classes.length ? `<ol class="brief-tt">${classes.map(x => `<li class="${x.sp ? 'sp' : ''}"><small>${x.i + 1}</small>${esc(x.v)}</li>`).join('')}</ol>
          ${classes.some(x => x.sp) ? '<p class="sub">흐린 과목은 교과 선생님 수업이에요.</p>' : ''}` : `<p class="brief-empty">${isSchoolDay ? '시간표가 비어 있어요.' : '오늘은 수업이 없어요.'}</p>`}
      </section>
      <section class="brief-box">
        <h3>${icon('sun')}날씨·미세먼지</h3>
        <div id="briefWeather">${briefWeatherHtml()}</div>
      </section>
    </div>
    <div class="modal-actions brief-actions">
      <label class="check-row"><input type="checkbox" id="briefOff"> 다음부터 자동으로 띄우지 않기</label>
      <button class="btn-primary" id="briefOk">${icon('check')}확인</button>
    </div>`;
}

function openBrief() {
  const h = new Date().getHours();
  const who = S.settings.teacher ? `${S.settings.teacher} 선생님` : '선생님';
  const title = h < 12 ? `좋은 아침이에요, ${who}!` : '오늘 한눈에 보기';
  const body = openModal(title, briefHtml(), {
    wide: true,
    onClose: () => {
      briefOpen = false;
      try { localStorage.setItem(BRIEF_KEY, ymd(new Date())); } catch (e) { /* 무시 */ }
    },
  });
  briefOpen = true;
  $('#briefOk', body).addEventListener('click', closeModal);
  $('#briefOk', body).focus();
  $('#briefOff', body).addEventListener('change', e => {
    S.settings.morningBrief = !e.target.checked;
    save();
    toast(e.target.checked ? '아침 알림을 껐어요. 설정이나 위쪽 “오늘 요약” 버튼으로 언제든 볼 수 있어요.' : '아침 알림을 다시 켰어요.');
  });
}
function refreshBriefWeather() {
  const el = briefOpen && document.getElementById('briefWeather');
  if (el) el.innerHTML = briefWeatherHtml();
}
function maybeAutoBrief() {
  if (S.settings.morningBrief === false || !modalEl.hidden) return;
  let seen = '';
  try { seen = localStorage.getItem(BRIEF_KEY) || ''; } catch (e) { /* 무시 */ }
  if (seen !== ymd(new Date())) openBrief();
}
$('#briefBtn').addEventListener('click', openBrief);

/* =========================================================
   복무 (나이스 조퇴·외출·지각 신청)
   «오늘 세시에 조퇴할래» 같은 문장을 bokmu.js 가 해석 → 미리 보기에서 확인·수정 →
   폴더 열기 도우미(/bokmu)가 이 컴퓨터의 neis-login\복무-실행.cmd 를 실행 → 진행 상황(/bokmu-status)을 보여 줘요.
   나이스 프로그램(neis-login)은 학교 PC에만 있는 비공개 폴더예요.
   ========================================================= */
const BOKMU_KINDS = ['조퇴', '외출', '지각', '병조퇴', '병외출', '병지각'];
let bokmuPoll = null;

// 스쿨보드를 파일로 열었을 때 그 폴더 안의 neis-login\복무-실행.cmd 경로
function bokmuRunnerPath() {
  if (location.protocol !== 'file:') return null;
  const p = decodeURIComponent(location.pathname).replace(/^\/+/, '').replace(/\//g, '\\');
  return p.replace(/\\[^\\]*$/, '') + '\\neis-login\\복무-실행.cmd';
}
const b64url = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// 미리 보기 값 검사 (문장 해석 뒤 선생님이 고친 값도 같은 규칙으로)
function bokmuCheck(v) {
  const p = [];
  if (!BOKMU_KINDS.includes(v.kind)) p.push('종류를 골라 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date || '')) p.push('날짜를 골라 주세요.');
  for (const [k, t] of [['시작', v.start], ['끝', v.end]]) {
    if (!/^\d{2}:\d{2}$/.test(t || '')) p.push(`${k} 시각을 넣어 주세요.`);
    else if (+t.slice(3) % 5) p.push(`${k} 시각 ${t}: 나이스는 5분 단위만 고를 수 있어요.`);
  }
  if (v.start && v.end && v.start >= v.end) p.push('끝나는 시각이 시작 시각보다 늦어야 해요.');
  return p;
}

function openBokmu() {
  const body = openModal('복무 신청', `
    <form id="bkForm" class="bk-form" autocomplete="off">
      <input class="box" id="bkText" placeholder="예: 오늘 세시에 조퇴할래 · 내일 10시까지 병원 들렀다 지각 · 금요일 1시부터 2시까지 외출" autofocus>
      <button class="btn-primary" type="submit">해석</button>
    </form>
    <div id="bkPreview"></div>
    <p class="muted small bk-foot">조퇴·병조퇴는 끝이 ${Bokmu.WORK_END}, 지각·병지각은 시작이 ${Bokmu.WORK_START}로 고정이에요. 사유는 개인 용무 / 병원 진료, 결재선은 «조퇴, 지각, 외출»로 들어가요.</p>`,
  { wide: true, onClose: () => { clearInterval(bokmuPoll); bokmuPoll = null; } });

  const render = (v, notes = []) => {
    const sick = v.kind && v.kind.startsWith('병');
    const fixedEnd = /조퇴$/.test(v.kind || ''), fixedStart = /지각$/.test(v.kind || '');
    const probs = bokmuCheck(v);
    $('#bkPreview', body).innerHTML = `
      <div class="bk-grid">
        <label class="field"><span>종류</span><select id="bkKind">${['', ...BOKMU_KINDS].map(k => `<option${k === v.kind ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
        <label class="field"><span>날짜</span><input type="date" id="bkDate" value="${esc(v.date || '')}"></label>
        <label class="field"><span>시작${fixedStart ? ' <small>(고정)</small>' : ''}</span><input type="time" step="300" id="bkStart" value="${esc(v.start || '')}"${fixedStart ? ' disabled' : ''}></label>
        <label class="field"><span>끝${fixedEnd ? ' <small>(고정)</small>' : ''}</span><input type="time" step="300" id="bkEnd" value="${esc(v.end || '')}"${fixedEnd ? ' disabled' : ''}></label>
      </div>
      <p class="bk-line">근무상황 <b>${v.kind ? (sick ? '병가' : '연가') + ' / ' + esc(v.kind) : '—'}</b> · 사유 <b>${v.kind ? (sick ? '병원 진료' : '개인 용무') : '—'}</b> · 비공개 <b>사유</b></p>
      ${notes.map(n => `<p class="bk-note">${esc(n)}</p>`).join('')}
      ${probs.map(n => `<p class="bk-problem">${esc(n)}</p>`).join('')}
      <div class="bk-actions">
        <button class="btn-line" id="bkFill"${probs.length ? ' disabled' : ''} title="나이스에 칸만 채워 두고 멈춰요. 승인요청은 직접 눌러요.">칸 채우기까지</button>
        <button class="btn-primary" id="bkSubmit"${probs.length ? ' disabled' : ''}>${icon('check')}상신하기</button>
      </div>
      <div id="bkStatus"></div>`;
    hydrateIcons($('#bkPreview', body));
    const read = () => {
      const kind = $('#bkKind', body).value;
      let start = $('#bkStart', body).value, end = $('#bkEnd', body).value;
      if (/조퇴$/.test(kind)) end = Bokmu.WORK_END;
      if (/지각$/.test(kind)) start = Bokmu.WORK_START;
      return { kind, date: $('#bkDate', body).value, start, end };
    };
    $$('#bkKind, #bkDate, #bkStart, #bkEnd', body).forEach(el => el.addEventListener('change', () => render(read())));
    $('#bkFill', body).addEventListener('click', () => sendBokmu(read(), undefined));
    $('#bkSubmit', body).addEventListener('click', () => {
      const x = read();
      const box = $('#bkStatus', body);
      box.innerHTML = `<div class="bk-confirm"><p><b>나이스에 실제로 상신할까요?</b><br>${esc(x.kind)} · ${esc(x.date)} ${esc(x.start)}~${esc(x.end)}</p>
        <button class="btn-primary" id="bkYes">상신</button><button class="btn-line" id="bkNo">취소</button></div>`;
      $('#bkYes', box).addEventListener('click', () => sendBokmu(x, '상신'));
      $('#bkNo', box).addEventListener('click', () => { box.innerHTML = ''; });
      $('#bkYes', box).focus();
    });
  };

  $('#bkForm', body).addEventListener('submit', e => {
    e.preventDefault();
    const r = Bokmu.parseBokmu($('#bkText', body).value);
    // 막는 문제(빨강)는 미리 보기 값으로 다시 검사해서 보여 주므로, 여기서는 알림(노랑)만 넘겨요
    render({ kind: r.kind || '', date: r.date, start: r.start || '', end: r.end || '' }, r.notes);
  });

  function sendBokmu(v, until) {
    const box = $('#bkStatus', body);
    const H = window.SCHOOLBOARD_HELPER, runner = bokmuRunnerPath();
    if (!H || !H.token) { box.innerHTML = `<p class="bk-problem">폴더 열기 도우미가 설치돼 있지 않아요. folder-opener 의 설치 파일을 먼저 실행해 주세요.</p>`; return; }
    if (!runner) { box.innerHTML = `<p class="bk-problem">복무 신청은 스쿨보드를 index.html 파일로 열었을 때만 돼요.</p>`; return; }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const q = b64url(JSON.stringify({ id, ...v, until }));
    $$('#bkFill, #bkSubmit', body).forEach(b => { b.disabled = true; });
    box.innerHTML = `<p class="bk-step">요청을 보내는 중…</p>`;
    fetch(`http://127.0.0.1:${H.port}/bokmu?t=${H.token}&p=${b64url(runner)}&q=${q}`, { cache: 'no-store' })
      .then(r => {
        if (r.status === 403) throw new Error('도우미 열쇠가 맞지 않아요. folder-opener 설치 파일을 다시 실행해 주세요.');
        if (!r.ok) throw new Error('복무 프로그램을 실행하지 못했어요. 이 PC에 neis-login 폴더(복무-실행.cmd)가 있는지, 실행 허락 창에서 [예]를 눌렀는지 확인해 주세요.');
        watchBokmu(id, box);
      })
      .catch(err => {
        box.innerHTML = `<p class="bk-problem">${esc(err.message === 'Failed to fetch' ? '폴더 열기 도우미가 꺼져 있어요. 컴퓨터를 다시 켜거나 folder-opener 설치 파일을 다시 실행해 주세요.' : err.message)}</p>`;
        $$('#bkFill, #bkSubmit', body).forEach(b => { b.disabled = false; });
      });
  }

  function watchBokmu(id, box) {
    const H = window.SCHOOLBOARD_HELPER;
    const started = Date.now();
    clearInterval(bokmuPoll);
    bokmuPoll = setInterval(async () => {
      let s = {};
      try { s = await (await fetch(`http://127.0.0.1:${H.port}/bokmu-status?t=${H.token}`, { cache: 'no-store' })).json(); } catch (e) { /* 다음에 다시 */ }
      const mine = s.id === id;
      if (!mine && Date.now() - started > 30000) s = { state: 'error', message: '복무 프로그램이 시작되지 않았어요. 실행 허락 창이 떠 있는지 확인해 주세요.' };
      if (mine && s.state === 'running') { box.innerHTML = `<p class="bk-step"><span class="bk-spin"></span>${esc(s.step || '진행 중…')}</p>`; return; }
      if (!mine && s.state !== 'error') { box.innerHTML = `<p class="bk-step"><span class="bk-spin"></span>복무 프로그램을 여는 중…</p>`; return; }
      clearInterval(bokmuPoll); bokmuPoll = null;
      const ok = ['done', 'filled', 'line'].includes(s.state);
      box.innerHTML = `<p class="${ok ? 'bk-done' : 'bk-problem'}">${esc(s.message || '끝났어요.')}</p>${s.row ? `<p class="muted small">${esc(s.row)}</p>` : ''}`;
      if (s.state === 'done') toast('나이스 복무를 상신했어요.');
      if (Date.now() - started > 6 * 60 * 1000) box.innerHTML = `<p class="bk-problem">6분이 지나도 끝나지 않았어요. 나이스 크롬 창을 확인해 주세요.</p>`;
    }, 1500);
  }
}
$('#bokmuBtn').addEventListener('click', openBokmu);

/* =========================================================
   출결 (노션 «출결현황» → 나이스 학생 출결)
   [목록 불러오기] → 도우미(/chulgyeol, mode list)가 neis-login\출결-실행.cmd 로 노션을 읽어 넣을 줄을 돌려줌 →
   [나이스에 저장] → 같은 길로 mode save (목록에서 본 줄만) → 진행 상황(/chulgyeol-status)을 보여 줘요.
   노션 토큰·나이스 로그인은 이 컴퓨터(neis-login)에만 있어요.
   ========================================================= */
const CHUL_NEIS = {
  병결석: '결석 질병♡', 출석인정결석: '결석 출석인정△', 체험학습: '결석 출석인정△', 가정학습: '결석 출석인정△',
  미인정결석: '결석 미인정♥', 기타결석: '결석 기타▲', 병지각: '지각 질병#', 미인정지각: '지각 미인정X',
  병조퇴: '조퇴 질병@', 출석인정조퇴: '조퇴 출석인정▷',
};
let chulPoll = null;

function openChulgyeol() {
  const month = new Date().getMonth() + 1;
  const body = openModal('출결 넣기', `
    <div class="ch-head">
      <p class="muted small">노션 «출결관리 › 출결현황»에서 <b>${month}월</b> 줄 중 <b>«나이스» 체크가 안 된 것</b>을 읽어 나이스 출결에 저장하고, 노션에 체크해요.</p>
      <button class="btn-primary" id="chLoad">${month}월 목록 불러오기</button>
    </div>
    <div id="chBox"></div>
    <p class="muted small bk-foot">이번 달(나이스에서 조회되는 달)만 다뤄요. 달에 걸친 줄은 이번 달 날만 넣고, 노션 체크는 다음 달에 마저 넣은 뒤 해요. 이미 같은 기호가 있으면 넘어가고, 다른 값이 있으면 바꾸지 않고 건너뛰어요. 기간 결석은 연속출결입력으로 넣고, 토·일은 나이스가 빼고 저장해요.</p>`,
  { wide: true, onClose: () => { clearInterval(chulPoll); chulPoll = null; } });
  const box = $('#chBox', body);
  // 날짜: 이번 달로 자른 기간. 노션 기간이 달에 걸쳐 있으면 원래 기간·다음 달 남음을 작게 덧붙여요.
  const md = s => esc(String(s || '').slice(5));
  const when = r => `${md(r.date)}${r.end ? '~' + md(r.end) : ''}` +
    (r.orig ? `<br><small class="muted">노션 ${esc(r.orig.replace(/\d{4}-/g, ''))}${r.partial ? ' · 다음 달 부분은 다음 달에' : ''}</small>` : '') +
    (r.already ? `<br><small class="muted">이미 들어 있었음</small>` : '');
  const row = r => `<tr><td>${when(r)}</td><td>${esc(String(r.no ?? '?'))}번 ${esc(r.name || '')}</td>` +
    `<td>${esc(r.kind)} → <b>${esc(CHUL_NEIS[r.kind] || '?')}</b></td><td>${esc(r.reason)}</td>${r.why ? `<td class="ch-why">${esc(r.why)}</td>` : ''}</tr>`;
  const table = (rows, why) => rows.length ? `<table class="ch-table"><thead><tr><th>날짜</th><th>학생</th><th>나이스</th><th>사유</th>${why ? '<th>이유</th>' : ''}</tr></thead><tbody>${rows.map(row).join('')}</tbody></table>` : '';

  $('#chLoad', body).addEventListener('click', () => send({ mode: 'list' }));   // 기간은 나이스 프로그램이 «이번 달 전체»로 정해요

  function showList(s) {
    const rows = s.rows || [], skip = s.skip || [];
    box.innerHTML = `
      ${rows.length ? `<p class="bk-line">넣을 줄 <b>${rows.length}개</b> (${esc(s.from)} ~ ${esc(s.to)})</p>${table(rows)}`
        : `<p class="bk-done">넣을 줄이 없어요. (${esc(s.from)} ~ ${esc(s.to)})</p>`}
      ${skip.length ? `<p class="bk-note">못 넣는 줄 ${skip.length}개 — 노션에서 고친 뒤 다시 불러 주세요.</p>${table(skip, true)}` : ''}
      ${rows.length ? `<div class="bk-actions"><button class="btn-primary" id="chSave">${icon('check')}나이스에 저장 (${rows.length}줄)</button></div>` : ''}
      <div id="chStatus"></div>`;
    hydrateIcons(box);
    if (!rows.length) return;
    $('#chSave', box).addEventListener('click', () => {
      const st = $('#chStatus', box);
      st.innerHTML = `<div class="bk-confirm"><p><b>나이스 출결에 실제로 저장할까요?</b><br>위 ${rows.length}줄 · 저장하면 공식 기록이 돼요.</p>
        <button class="btn-primary" id="chYes">저장</button><button class="btn-line" id="chNo">취소</button></div>`;
      $('#chYes', st).addEventListener('click', () => {
        $('#chSave', box).disabled = true;
        send({ mode: 'save', from: s.from, to: s.to, pages: rows.map(r => r.pageId) }, st);
      });
      $('#chNo', st).addEventListener('click', () => { st.innerHTML = ''; });
      $('#chYes', st).focus();
    });
  }

  function send(v, out = box) {
    const H = window.SCHOOLBOARD_HELPER, runner = bokmuRunnerPath()?.replace(/복무-실행\.cmd$/, '출결-실행.cmd');
    if (!H || !H.token) { out.innerHTML = `<p class="bk-problem">폴더 열기 도우미가 설치돼 있지 않아요. folder-opener 의 설치 파일을 먼저 실행해 주세요.</p>`; return; }
    if (!runner) { out.innerHTML = `<p class="bk-problem">출결 넣기는 스쿨보드를 index.html 파일로 열었을 때만 돼요.</p>`; return; }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    out.innerHTML = `<p class="bk-step"><span class="bk-spin"></span>요청을 보내는 중…</p>`;
    fetch(`http://127.0.0.1:${H.port}/chulgyeol?t=${H.token}&p=${b64url(runner)}&q=${b64url(JSON.stringify({ id, ...v }))}`, { cache: 'no-store' })
      .then(r => {
        if (r.status === 403) throw new Error('도우미 열쇠가 맞지 않아요. folder-opener 설치 파일을 다시 실행해 주세요.');
        if (r.status === 404) throw new Error('도우미가 예전 버전이에요. folder-opener 설치 파일을 다시 실행해 주세요.');
        if (!r.ok) throw new Error('출결 프로그램을 실행하지 못했어요. 이 PC에 neis-login 폴더(출결-실행.cmd)가 있는지, 실행 허락 창에서 [예]를 눌렀는지 확인해 주세요.');
        watch(id, v.mode, out);
      })
      .catch(err => {
        out.innerHTML = `<p class="bk-problem">${esc(err.message === 'Failed to fetch' ? '폴더 열기 도우미가 꺼져 있어요. 컴퓨터를 다시 켜거나 folder-opener 설치 파일을 다시 실행해 주세요.' : err.message)}</p>`;
      });
  }

  function watch(id, mode, out) {
    const H = window.SCHOOLBOARD_HELPER;
    const started = Date.now();
    clearInterval(chulPoll);
    chulPoll = setInterval(async () => {
      let s = {};
      try { s = await (await fetch(`http://127.0.0.1:${H.port}/chulgyeol-status?t=${H.token}`, { cache: 'no-store' })).json(); } catch (e) { /* 다음에 다시 */ }
      const mine = s.id === id;
      if (!mine && Date.now() - started > 30000) s = { state: 'error', message: '출결 프로그램이 시작되지 않았어요. 실행 허락 창이 떠 있는지 확인해 주세요.' };
      if (Date.now() - started > 15 * 60 * 1000) s = { state: 'error', message: '15분이 지나도 끝나지 않았어요. 나이스 크롬 창을 확인해 주세요.' };
      if (mine && s.state === 'running') { out.innerHTML = `<p class="bk-step"><span class="bk-spin"></span>${esc(s.step || '진행 중…')}</p>`; return; }
      if (!mine && s.state !== 'error') { out.innerHTML = `<p class="bk-step"><span class="bk-spin"></span>출결 프로그램을 여는 중…</p>`; return; }
      clearInterval(chulPoll); chulPoll = null;
      if (s.state === 'list') { showList(s); return; }
      const done = s.done || [], failed = s.failed || [];
      out.innerHTML = `<p class="${s.state === 'done' ? 'bk-done' : 'bk-problem'}">${esc(s.message || '끝났어요.')}</p>
        ${done.length ? `<p class="bk-line">처리한 줄</p>${table(done)}` : ''}
        ${failed.length ? `<p class="bk-line">못 넣은 줄</p>${table(failed, true)}` : ''}`;
      if (s.state === 'done') toast(`나이스 출결 ${done.length}줄을 저장했어요.`);
    }, 1500);
  }
}
$('#chulBtn').addEventListener('click', openChulgyeol);

/* =========================================================
   학생 화면 (전자칠판용 창) — classroom.html
   ========================================================= */
let classroomWin = null;
$('#classroomBtn').addEventListener('click', () => {
  if (classroomWin && !classroomWin.closed) { classroomWin.focus(); return; }
  classroomWin = window.open('classroom.html', 'schoolboard-classroom', 'popup=yes,width=1280,height=760');
  if (!classroomWin) toast('새 창이 막혔어요. 주소창 오른쪽의 팝업 차단 표시를 눌러 허용해 주세요.');
  else toast('학생 화면을 열었어요. 창을 전자칠판 화면으로 옮긴 뒤 “전체 화면”을 누르세요.');
});
// 학생 화면에서 알림장을 고치면 여기서 저장합니다 (그래야 다른 컴퓨터와도 맞춰져요)
window.setClassNotice = text => {
  S.classNotice = { text: String(text).slice(0, 2000), at: Date.now() };
  save();
};

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
// 다른 컴퓨터에서 바뀐 내용을 먼저 받아온 뒤 아침 알림을 띄웁니다 (인터넷이 느리면 5초만 기다림)
Promise.race([syncNow(), new Promise(r => setTimeout(r, 5000))]).finally(maybeAutoBrief);
