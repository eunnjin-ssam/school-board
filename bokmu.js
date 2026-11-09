/* =========================================================
   복무 문장 해석기 — «오늘 세시에 조퇴할래» 같은 문장을 나이스 근무상황 신청 값으로 바꿔요.
   규칙은 neis-login/복무-지시서.md 4-1 그대로예요. 문장은 이 브라우저 안에서만 해석하고 밖으로 보내지 않아요.
   ========================================================= */
(function (root) {
  const WORK_START = '08:30', WORK_END = '16:30';
  const SICK = /병원|진료|치료|검진|아파|아픔|아프|병\s*(때문|으로)|몸이|감기|열이|두통|복통/;
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };

  // 한글 수 (한/두/세/네 … 열두) → 숫자
  const KNUM = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 열한: 11, 열두: 12 };
  const SINO = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9, 십: 10 };
  function sinoToNum(s) {   // 이십, 삼십, 사십오 …
    let n = 0, cur = 0;
    for (const ch of s) {
      if (ch === '십') { n += (cur || 1) * 10; cur = 0; } else if (SINO[ch]) cur = SINO[ch]; else return NaN;
    }
    return n + cur;
  }

  // 시각 찾기: «3시», «세시», «3시 반», «2시반», «3시 10분», «세시 십분», «15:30», «오후 3시»
  const HOUR = '(\\d{1,2}|열두|열한|열|한|두|세|네|다섯|여섯|일곱|여덟|아홉)';
  const MIN = '(?:\\s*(반)|\\s*(\\d{1,2})\\s*분|\\s*([일이삼사오육칠팔구십]{1,3})\\s*분)?';
  const TIME_RE = new RegExp('(오전|오후|아침|낮|저녁)?\\s*(?:' + HOUR + '\\s*시' + MIN + '|(\\d{1,2}):(\\d{2}))', 'g');

  function toHM(m) {
    const ampm = m[1];
    let h, mi = 0;
    if (m[7] !== undefined) { h = +m[7]; mi = +m[8]; }
    else {
      h = /^\d+$/.test(m[2]) ? +m[2] : KNUM[m[2]];
      if (m[3]) mi = 30; else if (m[4]) mi = +m[4]; else if (m[5]) mi = sinoToNum(m[5]);
    }
    if (h === undefined || Number.isNaN(h) || Number.isNaN(mi)) return null;
    // 오전·오후를 안 적으면 근무 시간 안으로: 1~7시는 오후, 8~12시는 오전·정오
    if (/오후|저녁|낮/.test(ampm || '') && h < 12) h += 12;
    else if (!ampm && m[7] === undefined && h >= 1 && h <= 7) h += 12;
    if (h > 23 || mi > 59) return null;
    return `${pad(h)}:${pad(mi)}`;
  }

  // 날짜 찾기 (기준: now)
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  function findDate(text, now) {
    if (/글피/.test(text)) return addDays(now, 3);
    if (/모레/.test(text)) return addDays(now, 2);
    if (/내일/.test(text)) return addDays(now, 1);
    if (/오늘/.test(text)) return addDays(now, 0);
    let m = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) || text.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\s|$|에)/);
    if (m) {
      let d = new Date(now.getFullYear(), +m[1] - 1, +m[2]);
      if (d < addDays(now, -30)) d = new Date(now.getFullYear() + 1, +m[1] - 1, +m[2]);   // 한참 지난 날이면 내년
      return d;
    }
    m = text.match(/(다음\s*주|담주|이번\s*주)?\s*([월화수목금토일])요일/);
    if (m) {
      const want = DAYS.indexOf(m[2]);
      if (m[1] && /다음|담/.test(m[1])) {
        const monday = addDays(now, ((8 - now.getDay()) % 7) || 7);   // 다음 주 월요일
        return addDays(monday, (want + 6) % 7);
      }
      return addDays(now, (want - now.getDay() + 7) % 7);   // 오늘 이후 가장 가까운 그 요일 (오늘 포함)
    }
    m = text.match(/(\d{1,2})\s*일(?!\s*(?:간|동안))/);
    if (m && +m[1] >= 1 && +m[1] <= 31) {
      let d = new Date(now.getFullYear(), now.getMonth(), +m[1]);
      if (d < addDays(now, 0)) d = new Date(now.getFullYear(), now.getMonth() + 1, +m[1]);
      return d;
    }
    return null;
  }

  function parseBokmu(text, now = new Date()) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    const problems = [], notes = [];
    const d = findDate(t, now) || addDays(now, 0);
    if (!findDate(t, now)) notes.push('날짜 말이 없어서 오늘로 했어요.');
    const date = ymd(d);

    // 시각: «~부터·~에»는 시작, «~까지»는 끝
    const times = [];
    for (const m of t.matchAll(TIME_RE)) {
      const hm = toHM(m);
      if (!hm) continue;
      const after = t.slice(m.index + m[0].length, m.index + m[0].length + 4);
      times.push({ hm, until: /^\s*(까지|에\s*끝)/.test(after) });
    }
    let start = times.find((x) => !x.until)?.hm || null;
    let end = times.find((x) => x.until)?.hm || null;
    if (!end && times.length >= 2 && !times[1].until && times[1].hm !== start) end = times[1].hm;

    // 종류: 조퇴 / 외출 / 지각 낱말 (+ 아프면 병-)
    let base = /조퇴/.test(t) ? '조퇴' : /외출/.test(t) ? '외출' : /지각/.test(t) ? '지각' : null;
    // 낱말이 없으면 시각 모양으로 추측해요 (선생님 규칙, 2026-11-09):
    //   오전 «~까지»만 → 지각 / 시작과 끝이 다 있음 → 외출 / 시작만 → 조퇴
    if (!base && times.length) {
      if (!start && end && end <= '12:00') base = '지각';
      else if (start && end) base = '외출';
      else if (start) base = '조퇴';
      if (base) notes.push(`종류 낱말(조퇴·외출·지각)이 없어서 시각 모양을 보고 «${base}»${base === '지각' ? '으로' : '로'} 추측했어요. 맞는지 확인해 주세요.`);
    }
    if (!base) problems.push('종류(조퇴·외출·지각)를 찾지 못했어요.');
    const sick = SICK.test(t.replace(/병조퇴|병외출|병지각/g, '')) || /병조퇴|병외출|병지각/.test(t);
    const kind = base ? (sick ? '병' + base : base) : null;

    if (base === '지각') {
      // 지각·병지각: 시작은 무조건 출근 시각(08:30), 문장의 시각은 도착(끝) 시각. «10시에 지각» → 08:30~10:00
      end = end || times[times.length - 1]?.hm || null;
      if (start && start !== WORK_START && end !== start) notes.push(`지각은 시작 시각이 출근 시각(${WORK_START})으로 고정이에요.`);
      start = WORK_START;
      if (!end) problems.push('지각은 도착하는 시각을 적어 주세요 (예: 10시까지 지각).');
    } else {
      if (!start) problems.push('시작 시각을 찾지 못했어요 (예: 세시에, 2시 반부터).');
      if (base === '조퇴') {
        if (end && end !== WORK_END) notes.push(`조퇴는 끝나는 시각이 퇴근 시각(${WORK_END})으로 고정이에요.`);
        end = WORK_END;
      } else if (!end) { end = WORK_END; notes.push(`끝나는 시각이 없어서 퇴근 시각(${WORK_END})까지로 했어요.`); }
    }
    for (const [label, v] of [['시작', start], ['끝', end]]) {
      if (v && +v.slice(3) % 5) problems.push(`${label} 시각 ${v}: 나이스는 5분 단위만 고를 수 있어요.`);
    }
    if (start && end && start >= end) problems.push(`끝나는 시각(${end})이 시작 시각(${start})보다 늦어야 해요.`);
    if (d < addDays(now, 0)) notes.push('지난 날짜예요.');
    if (d.getDay() === 0 || d.getDay() === 6) notes.push('주말이에요.');

    return {
      kind, date, start, end,
      reason: kind ? (kind.startsWith('병') ? '병원 진료' : '개인 용무') : null,
      problems, notes, text: t,
    };
  }

  const api = { parseBokmu, WORK_START, WORK_END };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Bokmu = api;
})(typeof window !== 'undefined' ? window : globalThis);
