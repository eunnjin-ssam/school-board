/* =========================================================
   출결 문장 해석기 — «민수 어제 감기로 병결» 같은 문장을 노션 출결현황 한 줄(학생·구분·날짜·내용)로 바꿔요.
   한 줄에 한 건. 문장은 이 브라우저 안에서만 해석하고, 저장은 [저장]을 눌렀을 때만 나이스 프로그램으로 보내요.
   구분은 노션 «구분» 값 그대로예요 (neis-login/출결-지시서.md 2장 표).
   ========================================================= */
(function (root) {
  const KINDS = ['병결석', '출석인정결석', '체험학습', '가정학습', '미인정결석', '기타결석', '병지각', '미인정지각', '병조퇴', '출석인정조퇴'];
  const SICK = /병원|진료|치료|검진|감기|독감|코로나|장염|몸살|발열|고열|열이|두통|복통|배탈|구토|설사|기침|수족구|입원|수술|치과|안과|이비인후과|소아과|피부과|정형외과|아파|아프|아픔|다쳐|다침|골절|병\s*(때문|으로)/;
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => { const x = day0(d); x.setDate(x.getDate() + n); return x; };
  const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

  // ---- 날짜 ----
  const REL = { 그저께: -2, 그제: -2, 어제: -1, 오늘: 0, 내일: 1, 모레: 2 };
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const DATE_RE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일|(\d{1,2})\s*\/\s*(\d{1,2})|(\d{1,2})\s*일(?!\s*(?:간|동안))|(그저께|그제|어제|오늘|내일|모레)|(?:(지난|저번|이번|다음|담)\s*주\s*)?([월화수목금토일])요일/g;
  const AFTER_DATE = /^\s*(부터|까지|에는|에|은|는)?/;

  function findDates(t, now) {
    const out = [];
    for (const m of t.matchAll(DATE_RE)) {
      let d = null, monthGiven = false;
      if (m[1]) { d = new Date(now.getFullYear(), +m[1] - 1, +m[2]); monthGiven = true; if (d.getDate() !== +m[2]) d = 'bad'; }
      else if (m[3]) { d = new Date(now.getFullYear(), +m[3] - 1, +m[4]); monthGiven = true; if (d.getDate() !== +m[4]) d = 'bad'; }
      else if (m[5]) {   // «5일» 만: 앞 날짜의 달, 없으면 이번 달
        const base = out.length && out[out.length - 1].d instanceof Date ? out[out.length - 1].d : now;
        d = new Date(base.getFullYear(), base.getMonth(), +m[5]);
        if (d.getDate() !== +m[5]) d = 'bad';
      }
      else if (m[6]) d = addDays(now, REL[m[6]]);
      else if (m[8]) {   // 요일: 이번 주(월~일) 그 요일. «지난주»·«다음 주» 는 한 주 앞뒤.
        const monday = addDays(now, -((now.getDay() + 6) % 7));
        const shift = /지난|저번/.test(m[7] || '') ? -7 : /다음|담/.test(m[7] || '') ? 7 : 0;
        d = addDays(monday, shift + (DAYS.indexOf(m[8]) + 6) % 7);
      }
      const tail = t.slice(m.index + m[0].length).match(AFTER_DATE)[0];
      out.push({ d, monthGiven, at: m.index, len: m[0].length + tail.length, raw: m[0], until: /까지/.test(tail) });
    }
    return out;
  }

  // ---- 학생 ----
  const JOSA = '(?:이가|이는|이도|이랑|이네|이|가|은|는|도|의|랑)?';   // «민준이», «하은이가»
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function findStudent(t, students) {
    const problems = [];
    const numM = t.match(/(\d{1,2})\s*번/);
    const no = numM ? +numM[1] : null;
    const spans = numM ? [[numM.index, numM[0].length]] : [];
    const hit = (word) => { const m = new RegExp(`(^|[^가-힣])(${reEsc(word)}${JOSA})(?=$|[^가-힣])`).exec(t); return m ? [m.index + m[1].length, m[2].length] : null; };

    if (!students.length) {
      const m = t.match(/(\d{1,2})\s*번\s*([가-힣]{2,4}?)(?:이가|가|은|는|이는)?(?=$|\s)/);
      if (!m) return { problems: ['스쿨보드 학생 명단이 비어 있어요. «3번 김민수» 처럼 번호와 이름을 같이 적어 주세요.'], spans };
      return { no: +m[1], name: m[2], spans: [[m.index, m[0].length]], problems };
    }
    // 이름: 성까지 다 쓴 것 → 이름만 쓴 것(세 글자 이상인 이름의 뒤 글자들) 순서로
    let found = [];
    for (const s of students) { const h = hit(s.name); if (h) found.push({ s, h }); }
    if (!found.length) for (const s of students) {
      if (s.name.length < 3) continue;
      const h = hit(s.name.slice(1)); if (h) found.push({ s, h });
    }
    if (no != null) {
      const byNo = students.filter((s) => s.no === no);
      if (!byNo.length) return { problems: [`${no}번 학생이 스쿨보드 명단에 없어요.`], spans };
      if (found.length && !found.some((f) => f.s === byNo[0])) return { problems: [`${no}번은 ${byNo[0].name} 인데 이름은 ${found.map((f) => f.s.name).join('·')} 이에요. 확인해 주세요.`], spans };
      const f = found.find((x) => x.s === byNo[0]);
      return { no, name: byNo[0].name, spans: f ? [...spans, f.h] : spans, problems };
    }
    if (found.length > 1) return { problems: [`학생이 여럿 맞아요 (${found.map((f) => `${f.s.no}번 ${f.s.name}`).join(', ')}). 번호나 성까지 적어 주세요.`], spans };
    if (!found.length) return { problems: ['학생을 찾지 못했어요. 이름이나 «3번» 처럼 번호를 적어 주세요.'], spans };
    if (found[0].s.no == null) return { problems: [`${found[0].s.name} 의 번호가 스쿨보드 명단에 없어요.`], spans };
    return { no: found[0].s.no, name: found[0].s.name, spans: [found[0].h], problems };
  }

  // ---- 구분 ----
  const KIND_WORDS = /교외\s*체험\s*학습|현장\s*체험\s*학습|체험\s*학습|가정\s*학습|출석\s*인정\s*결석|출석\s*인정\s*조퇴|출석\s*인정|미인정\s*결석|무단\s*결석|미인정\s*지각|무단\s*지각|미인정|무단|기타\s*결석|질병\s*결석|병\s*결석|병결|병지각|병조퇴|결석|지각|조퇴/g;
  function findKind(t) {
    const has = (re) => re.test(t);
    const sick = SICK.test(t);
    if (has(/체험\s*학습/)) return { kind: '체험학습' };
    if (has(/가정\s*학습/)) return { kind: '가정학습' };
    if (has(/조퇴/)) {
      if (has(/출석\s*인정/)) return { kind: '출석인정조퇴' };
      if (has(/병조퇴/) || sick) return { kind: '병조퇴' };
      return { problem: '조퇴 종류를 알 수 없어요. «병조퇴» 나 «출석인정조퇴» 로 적어 주세요. (미인정·기타 조퇴는 아직 못 넣어요)' };
    }
    if (has(/지각/)) {
      if (has(/미인정|무단/)) return { kind: '미인정지각' };
      if (has(/병지각/) || sick) return { kind: '병지각' };
      return { problem: '지각 종류를 알 수 없어요. «병지각» 이나 «미인정지각» 으로 적어 주세요.' };
    }
    if (has(/출석\s*인정/)) return { kind: '출석인정결석' };
    if (has(/미인정|무단/)) return { kind: '미인정결석' };
    if (has(/기타\s*결석/)) return { kind: '기타결석' };
    if (has(/병결|질병\s*결석|병\s*결석/) || (has(/결석/) && sick)) return { kind: '병결석' };
    if (has(/결석/)) return { problem: '결석 종류를 알 수 없어요. «병결», «미인정결석», «출석인정결석», «체험학습» 처럼 적어 주세요.' };
    return { problem: '구분(병결·체험학습·병지각·병조퇴 …)을 찾지 못했어요.' };
  }

  const FILLER = new Set(['했어요', '했음', '했다', '했어', '함', '해요', '합니다', '예정', '예정이에요', '입니다', '이에요', '에요', '부터', '까지', '에', '때문에', '때문', '하루', '하고', '으로', '로', '임', '처리', '넣어', '넣어줘', '넣기', '해줘', '신청']);
  // 낱말 끝 조사 떼기: «부여에»→부여, «제주도에서»→제주도, «감기로»→감기, «장염으로»→장염
  // (두 글자 낱말의 «로» 는 안 떼요: 피로·과로)
  const stripJosa = (w) => w.replace(/(에서|에|으로)$/, (m, _, i) => (i >= 1 ? '' : m)).replace(/(.{2,})로$/, '$1');
  // 체험학습·가정학습 괄호에는 «지역»만 남기려고 빼는 말 (가서·여행·방문 …)
  const TRIP_WORDS = /^(가서|가요|가|감|가고|갑니다|다녀옴|다녀와요|다녀옵니다|다녀오기|여행|가족여행|여행으로|방문|가족|으로|로|함께|같이|지역|학습)$/;

  // 지역은 도시 이름만: 도(강원·경기 …)는 빼고, «제주도»→제주, «부여군»→부여, «강릉시»→강릉, «부산광역시»→부산
  const PROVINCE = /^(강원|경기|충청|충남|충북|충청남|충청북|전라|전남|전북|전라남|전라북|경상|경남|경북|경상남|경상북)(특별자치)?도?$/;
  function cityOnly(w) {
    if (PROVINCE.test(w)) return '';
    if (/^제주(특별자치)?도$/.test(w)) return '제주';
    return w.replace(/(특별자치시|특별시|광역시)$/, '').replace(/^(.{2,})[시군]$/, '$1');
  }

  function cleanReason(s, { trip = false } = {}) {
    let words = s.replace(/[~,.\-–/]/g, ' ').split(/\s+/).filter((w) => w && !FILLER.has(w)).map(stripJosa).filter((w) => w && !FILLER.has(w));
    if (trip) words = words.filter((w) => !TRIP_WORDS.test(w)).map(cityOnly).filter(Boolean);
    let r = words.join(' ').trim();
    r = r.replace(/\s*(때문에|이라서|라서|해서)$/, '').trim();   // «으로·로» 는 stripJosa 가 낱말마다 떼요
    return r.replace(/^[(\[]|[)\]]$/g, '').trim();
  }

  function parseLine(text, students, now) {
    const t = String(text || '').replace(/\s+/g, ' ').trim()
      .replace(/(\d{1,2})\s*[~\-]\s*(\d{1,2})\s*일/g, '$1일~$2일');   // «3~5일» → «3일~5일»
    const problems = [], notes = [];
    const cut = [];   // 사유에서 뺄 자리 [시작, 길이]

    const st = findStudent(t, students);
    problems.push(...st.problems); cut.push(...st.spans);

    const k = findKind(t);
    if (k.problem) problems.push(k.problem);

    // 날짜
    const ds = findDates(t, now);
    cut.push(...ds.map((x) => [x.at, x.len]));
    let start = null, end = null;
    if (ds.some((x) => x.d === 'bad')) problems.push('없는 날짜가 있어요.');
    else if (!ds.length) { start = day0(now); notes.push('날짜 말이 없어서 오늘로 했어요.'); }
    else if (ds.length === 1) start = ds[0].d;
    else if (ds.length === 2) {
      const between = t.slice(ds[0].at + ds[0].raw.length, ds[1].at);
      if (/~|-|부터/.test(between) || ds[1].until) { start = ds[0].d; end = ds[1].d; }
      else problems.push('날짜가 두 개예요. 기간이면 «3일~5일» 처럼, 따로따로면 줄을 나눠 적어 주세요.');
    } else problems.push('날짜가 너무 많아요. 한 줄에 하루나 기간 하나만 적어 주세요.');

    const month = ymd(now).slice(0, 7);
    if (start) {
      if (end && end < start) { problems.push('끝 날짜가 시작 날짜보다 빨라요.'); end = null; }
      if (end && ymd(end) === ymd(start)) end = null;
      if (ymd(start).slice(0, 7) !== month)
        problems.push(`이번 달(${+month.slice(5)}월) 출결만 바로 넣을 수 있어요. 다른 달은 노션에 적어 두고 그 달에 [확인하기] 로 넣어 주세요.`);
      else if (end && ymd(end).slice(0, 7) !== month)
        notes.push('기간이 다음 달까지 이어져요. 이번 달 부분만 나이스에 넣고, 다음 달 부분은 다음 달 [확인하기] 로 넣어요.');
      if (!end && isWeekend(start)) problems.push(`${+ymd(start).slice(5, 7)}월 ${start.getDate()}일은 주말이에요.`);
      if (end) {
        let x = start, school = false;
        while (x <= end && ymd(x).slice(0, 7) === month) { if (!isWeekend(x)) { school = true; break; } x = addDays(x, 1); }
        if (!school) problems.push('이번 달에 해당하는 날이 주말뿐이에요.');
      }
      if (start > day0(now)) notes.push('앞으로의 날짜예요.');
    }

    // 사유: 학생·날짜·구분 낱말을 뺀 나머지
    let rest = t.split('');
    for (const [a, n] of cut) for (let i = a; i < a + n; i++) rest[i] = ' ';
    let reason = cleanReason(rest.join('').replace(KIND_WORDS, ' '), { trip: k.kind === '체험학습' || k.kind === '가정학습' });
    if (k.kind === '체험학습') reason = reason ? `교외체험학습(${reason})` : '교외체험학습';
    else if (k.kind === '가정학습') reason = reason ? `가정학습(${reason})` : '가정학습';
    else if (!reason && k.kind) problems.push(k.kind.startsWith('병') ? '사유(병명)를 적어 주세요. 예: 감기, 장염' : '사유를 적어 주세요.');

    return {
      text: t, no: st.no ?? null, name: st.name || '', kind: k.kind || '',
      date: start ? ymd(start) : '', end: end ? ymd(end) : null, reason, problems, notes,
    };
  }

  // 여러 줄 → 줄마다 하나
  function parseChulgyeol(text, students = [], now = new Date()) {
    return String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => parseLine(l, students, now));
  }

  const api = { parseChulgyeol, KINDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Chulgyeol = api;
})(typeof window !== 'undefined' ? window : globalThis);
