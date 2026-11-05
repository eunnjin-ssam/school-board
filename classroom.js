'use strict';
/* =========================================================
   스쿨보드 학생 화면 — 전자칠판에 띄워 두는 우리 반 화면
   선생님 대시보드와 같은 브라우저 저장소를 '읽기만' 합니다.
   알림장은 대시보드 창을 통해 저장해서 다른 컴퓨터와도 맞춰집니다.
   학생 메모·할 일 같은 선생님 정보는 이 화면에 쓰지 않아요.
   ========================================================= */

// 대시보드를 한 번도 저장하지 않은 브라우저에서도 시계는 돌도록 기본 교시를 둡니다
const FALLBACK_PERIODS = [
  { start: '09:00', end: '09:40' }, { start: '09:50', end: '10:30' },
  { start: '10:50', end: '11:30' }, { start: '11:40', end: '12:20' },
  { start: '13:20', end: '14:00' }, { start: '14:10', end: '14:50' },
];
function readState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 무시 */ }
  s = s || {};
  s.settings = s.settings || {};
  s.timetable = s.timetable || {};
  const tt = s.timetable;
  tt.periods = tt.periods?.length ? tt.periods : FALLBACK_PERIODS;
  tt.grid = Array.from({ length: 5 }, (_, d) => tt.grid?.[d] || []);
  tt.special = Array.from({ length: 5 }, (_, d) => tt.special?.[d] || []);
  s.students = s.students || [];
  s.cache = s.cache || {};
  return s;
}
let S = readState();

/* ---------- 위쪽 줄: 반 이름 · 날짜 · 날씨 ---------- */
function renderTop() {
  const now = new Date();
  $('#className').textContent = S.settings.className || '우리 반';
  $('#today').textContent = `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEK[now.getDay()]}요일`;
  const c = S.cache.weather;
  if (!c?.w) { $('#weather').innerHTML = ''; return; }
  const [desc, emo] = wmo(c.w.current.weather_code, c.w.current.is_day);
  const grades = [pmGrade(c.a?.current?.pm10, 'pm10'), pmGrade(c.a?.current?.pm2_5, 'pm25')].filter(Boolean);
  const dust = grades.sort((x, y) => y.i - x.i)[0];
  $('#weather').innerHTML = `
    <span class="wx-chip">${emo} ${Math.round(c.w.current.temperature_2m)}° ${esc(desc)}</span>
    ${dust ? `<span class="dust ${dust.key}">미세먼지 ${dust.label}${dust.i >= 2 ? ' · 실외 활동 자제' : ''}</span>` : ''}`;
}

/* ---------- 큰 시계 · 지금 교시 ---------- */
function renderNow() {
  const now = new Date();
  $('#hm').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $('#sec').textContent = pad(now.getSeconds());
  const st = periodStatus(now);
  const secNow = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const bar = $('#progress');
  let sub = st.sub;
  if (st.kind === 'class') {
    const p = S.timetable.periods[st.idx];
    const s = toMin(p.start) * 60, e = toMin(p.end) * 60;
    const left = Math.max(0, e - secNow);
    sub = `남은 시간 ${Math.floor(left / 60)}분 ${pad(left % 60)}초`;
    bar.style.width = `${Math.min(100, ((secNow - s) / (e - s)) * 100)}%`;
  }
  bar.parentElement.classList.toggle('hide', st.kind !== 'class');
  $('#period').textContent = st.kind === 'class' ? `${st.text} 시간` : st.text;
  // 학생 화면에는 '교과 수업' 같은 선생님용 표시를 빼요
  $('#periodSub').textContent = (sub || '').replace(/ · 교과 수업|\(교과\)/g, '');
}

/* ---------- 오늘 시간표 ---------- */
function renderTimetable() {
  const now = new Date();
  const dow = now.getDay();
  const ol = $('#tt');
  if (dow === 0 || dow === 6 || HOLIDAYS[ymd(now)]) {
    ol.innerHTML = `<li class="empty">${HOLIDAYS[ymd(now)] ? `${esc(HOLIDAYS[ymd(now)])} · ` : ''}오늘은 수업이 없어요</li>`;
    return;
  }
  const { periods, grid } = S.timetable;
  const subj = grid[dow - 1];
  const last = subj.reduce((acc, v, i) => (v ? i : acc), -1);
  if (last < 0) { ol.innerHTML = '<li class="empty">시간표가 비어 있어요</li>'; return; }
  const mins = now.getHours() * 60 + now.getMinutes();
  let h = '';
  for (let i = 0; i <= last; i++) {
    const p = periods[i];
    if (!p) break;
    if (i > 0 && toMin(p.start) - toMin(periods[i - 1].end) >= 40) h += `<li class="lunch">점심시간 ${periods[i - 1].end} – ${p.start}</li>`;
    const cls = mins >= toMin(p.end) ? 'done' : mins >= toMin(p.start) ? 'now' : '';
    h += `<li class="${cls}"><small>${i + 1}</small>${esc(subj[i] || '–')}<span class="time">${p.start}</span></li>`;
  }
  ol.innerHTML = h;
}

/* ---------- 알림장 ---------- */
let noticeEditing = false;
function renderNotice() {
  if (noticeEditing) return;
  const text = S.classNotice?.text?.trim() || '';
  const box = $('#noticeText');
  box.textContent = text || '아직 알림장이 없어요.\n오른쪽 위 “고치기”를 눌러 적어 보세요.';
  box.classList.toggle('empty', !text);
}
const dashboard = () => (window.opener && !window.opener.closed && typeof window.opener.setClassNotice === 'function' ? window.opener : null);
$('#noticeEdit').addEventListener('click', () => {
  const input = $('#noticeInput');
  if (!noticeEditing) {
    noticeEditing = true;
    input.value = S.classNotice?.text || '';
    input.hidden = false; $('#noticeText').hidden = true;
    $('#noticeEdit').textContent = '저장';
    input.focus();
    return;
  }
  const text = input.value.trim();
  const dash = dashboard();
  if (!dash) {
    $('#noticeEdit').textContent = '저장 (스쿨보드 창이 필요해요)';
    return;
  }
  dash.setClassNotice(text);
  S.classNotice = { text, at: Date.now() };
  noticeEditing = false;
  input.hidden = true; $('#noticeText').hidden = false;
  $('#noticeEdit').textContent = '고치기';
  renderNotice();
});

/* ---------- 수업 도구 ---------- */
let tool = null;
function openTool(name) {
  tool = tool === name ? null : name;
  $$('.dock-btn[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
  $('#tool').hidden = !tool;
  $('#tool').classList.remove('ring');
  if (tool) renderTool();
}
function renderTool() {
  if (tool === 'timer') renderTimer();
  if (tool === 'picker') renderPicker();
  if (tool === 'groups') renderGroups();
}
$$('.dock-btn[data-tool]').forEach(b => b.addEventListener('click', () => openTool(b.dataset.tool)));
$('#toolClose').addEventListener('click', () => openTool(null));

const studentNames = () => [...S.students].sort((a, b) => (a.no || 999) - (b.no || 999)).map(s => s.name).filter(Boolean);
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const noStudents = '<p class="msg">스쿨보드의 <b>학생 명렬표</b>에 학생을 넣으면<br>여기서 쓸 수 있어요.</p>';

// 타이머
const timer = { total: 300, left: 300, running: false, endAt: 0 };
let audioCtx = null;
function beep() {
  if (!audioCtx) return;
  [0, 0.45, 0.9].forEach(t => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.25, audioCtx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.35);
    o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.36);
  });
}
const fmt = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
function renderTimer() {
  const r = 45, C = 2 * Math.PI * r;
  const frac = timer.total ? timer.left / timer.total : 0;
  $('#toolBody').innerHTML = `
    <div class="timer-face">
      <svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${r}"/><circle class="bar ${timer.left <= 10 && timer.running ? 'low' : ''}" cx="50" cy="50" r="${r}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/></svg>
      <div class="timer-num">${fmt(timer.left)}</div>
    </div>
    <div class="row">${[1, 3, 5, 10, 15].map(m => `<button class="pill ${timer.total === m * 60 ? 'on' : ''}" data-min="${m}">${m}분</button>`).join('')}
      <button class="pill" data-add="-60">−1분</button><button class="pill" data-add="60">+1분</button></div>
    <div class="row"><button class="pill primary" data-act="toggle">${timer.running ? '잠깐 멈춤' : timer.left === 0 ? '다시 시작' : '시작'}</button><button class="pill" data-act="reset">처음으로</button></div>`;
}
function updateTimerFace() {
  if (tool === 'timer') {
    const r = 45, C = 2 * Math.PI * r;
    const bar = $('.timer-face .bar'), num = $('.timer-num');
    if (bar) { bar.setAttribute('stroke-dashoffset', C * (1 - (timer.total ? timer.left / timer.total : 0))); bar.classList.toggle('low', timer.left <= 10 && timer.running); }
    if (num) num.textContent = fmt(timer.left);
  }
  $('#timerMini').textContent = timer.running || (timer.left !== timer.total && timer.left > 0) ? fmt(timer.left) : '';
}
$('#toolBody').addEventListener('click', e => {
  if (tool !== 'timer') return;
  const b = e.target.closest('button');
  if (!b) return;
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { /* 소리 없이 */ } }
  if (b.dataset.min) { timer.running = false; timer.total = timer.left = +b.dataset.min * 60; }
  if (b.dataset.add) {
    const add = +b.dataset.add;
    timer.total = Math.max(60, timer.total + add);
    timer.left = Math.max(0, Math.min(timer.total, timer.left + add));
    if (timer.running) timer.endAt += add * 1000;
  }
  if (b.dataset.act === 'toggle') {
    if (timer.running) timer.running = false;
    else { if (timer.left === 0) timer.left = timer.total; timer.running = true; timer.endAt = Date.now() + timer.left * 1000; }
  }
  if (b.dataset.act === 'reset') { timer.running = false; timer.left = timer.total; }
  renderTimer(); updateTimerFace();
});
setInterval(() => {
  if (!timer.running) return;
  timer.left = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
  if (timer.left === 0) {
    timer.running = false;
    beep();
    if (tool !== 'timer') openTool('timer');
    renderTimer();
    $('#tool').classList.add('ring');
  }
  updateTimerFace();
}, 250);

// 발표자 뽑기 (한 번 뽑힌 학생은 빼고 돌아가며)
const picker = { pool: null, picked: [], exclude: true, rolling: false, last: '' };
function renderPicker() {
  const names = studentNames();
  if (!names.length) { $('#toolBody').innerHTML = noStudents; return; }
  if (!picker.pool) picker.pool = [...names];
  const left = picker.exclude ? picker.pool.length : names.length;
  $('#toolBody').innerHTML = `
    <h3>발표자 뽑기</h3>
    <div class="pick-name" id="pickName">${esc(picker.last || '누구일까요?')}</div>
    <div class="row">
      <button class="pill primary" data-act="roll" ${picker.exclude && !left ? 'disabled' : ''}>뽑기!</button>
      <button class="pill ${picker.exclude ? 'on' : ''}" data-act="exclude">뽑힌 학생 빼기 ${picker.exclude ? 'ON' : 'OFF'}</button>
      <button class="pill" data-act="reset">처음부터</button>
    </div>
    <div class="pick-meta">${picker.exclude ? (left ? `남은 학생 ${left}명` : '모두 한 번씩 뽑았어요! “처음부터”를 눌러 주세요.') : `전체 ${names.length}명 중에서 뽑아요`}</div>
    ${picker.picked.length ? `<div class="pick-done">${picker.picked.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}`;
}
$('#toolBody').addEventListener('click', e => {
  if (tool !== 'picker' || picker.rolling) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  const names = studentNames();
  if (act === 'exclude') picker.exclude = !picker.exclude;
  if (act === 'reset') { picker.pool = [...names]; picker.picked = []; picker.last = ''; }
  if (act === 'roll') {
    const from = picker.exclude ? picker.pool : names;
    if (!from.length) return;
    const winner = from[Math.floor(Math.random() * from.length)];
    picker.rolling = true;
    const el = $('#pickName');
    el.classList.add('rolling'); el.classList.remove('landed');
    const started = Date.now();
    const spin = setInterval(() => {
      el.textContent = names[Math.floor(Math.random() * names.length)];
      if (Date.now() - started > 1400) {
        clearInterval(spin);
        picker.rolling = false;
        picker.last = winner;
        picker.picked.push(winner);
        if (picker.exclude) picker.pool = picker.pool.filter(n => n !== winner);
        renderPicker();
        $('#pickName').classList.add('landed');
      }
    }, 70);
    return;
  }
  renderPicker();
});

// 모둠 나누기
const groups = { count: 4, result: null };
function renderGroups() {
  const names = studentNames();
  if (!names.length) { $('#toolBody').innerHTML = noStudents; return; }
  $('#toolBody').innerHTML = `
    <h3>모둠 나누기 <span class="pick-meta">(${names.length}명)</span></h3>
    <div class="row">
      <button class="pill" data-g="-1">−</button>
      <span class="pill on">${groups.count}모둠</span>
      <button class="pill" data-g="1">+</button>
      <button class="pill primary" data-act="split">${groups.result ? '다시 섞기' : '나누기'}</button>
    </div>
    ${groups.result ? `<div class="groups">${groups.result.map((g, i) => `<div class="group"><b>${i + 1}모둠</b>${g.map(n => `<span>${esc(n)}</span>`).join('')}</div>`).join('')}</div>` : `<p class="msg">한 모둠에 약 ${Math.ceil(names.length / groups.count)}명씩이에요.</p>`}`;
}
$('#toolBody').addEventListener('click', e => {
  if (tool !== 'groups') return;
  const b = e.target.closest('button');
  if (!b) return;
  const names = studentNames();
  if (b.dataset.g) { groups.count = Math.max(2, Math.min(Math.max(2, names.length), groups.count + +b.dataset.g)); groups.result = null; }
  if (b.dataset.act === 'split') {
    const mixed = shuffle(names);
    groups.result = Array.from({ length: groups.count }, () => []);
    mixed.forEach((n, i) => groups.result[i % groups.count].push(n));
  }
  renderGroups();
});

/* ---------- 전체 화면 · 단축키 ---------- */
$('#fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});
document.addEventListener('keydown', e => {
  if (e.target.closest('textarea, input')) return;
  if (e.key === 'Escape' && tool) openTool(null);
});

/* ---------- 시작 · 대시보드에서 바뀌면 바로 반영 ---------- */
function renderAll() {
  renderTop(); renderNow(); renderTimetable(); renderNotice();
  if (tool && tool !== 'timer' && !picker.rolling) renderTool();
}
window.addEventListener('storage', e => {
  if (e.key !== KEY) return;
  S = readState();
  renderAll();
});
renderAll();
let lastMin = -1;
setInterval(() => {
  renderNow();
  const m = new Date().getMinutes();
  if (m !== lastMin) { lastMin = m; renderTimetable(); renderTop(); }
}, 1000);
