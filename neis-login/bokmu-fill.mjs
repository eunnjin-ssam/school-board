// 나이스 근무상황신청 칸 채우기 (복무-지시서.md 3장 순서 그대로)
//   node bokmu-fill.mjs --kind 조퇴 --date 2026-11-06 --start 15:00 --end 16:30 [--shot 캡처.png]
// 지금은 [승인요청] 을 누르지 않아요. 칸을 채우고, 들어간 값을 다시 읽어 대조한 뒤 멈춰요.
// 크롬 창은 열어 두니 선생님이 눈으로 확인하고 직접 [승인요청] 또는 [닫기] 를 누르면 돼요.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loginNeis, Blocked, say, popup, waitForHuman, reportFatal, PWD_FIELD } from './login.mjs';
import { openApplyDialog, textStarts } from './bokmu.mjs';

// 종류 → 근무상황 콤보 ①·② (지시서 3-2, 선생님 확인)
export const KINDS = {
  조퇴: ['연가', '조퇴'], 외출: ['연가', '외출'], 지각: ['연가', '지각'],
  병조퇴: ['병가', '병조퇴'], 병외출: ['병가', '병외출'], 병지각: ['병가', '병지각'],
};
const reasonOf = (kind) => (kind.startsWith('병') ? '병원 진료' : '개인 용무');

function readConfig() {
  const p = join(process.env.LOCALAPPDATA, 'SchoolBoard', 'neis', 'config.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : {};
}

// ---- 입력값 검사 ----
export function checkRequest({ kind, date, start, end, phone }) {
  if (!KINDS[kind]) throw new Blocked(`종류 «${kind}» 는 다룰 수 없어요. (조퇴·외출·지각·병조퇴·병외출·병지각)`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Blocked(`날짜 «${date}» 가 2026-11-06 꼴이 아니에요.`);
  const hm = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); if (!m || +m[1] > 23 || +m[2] > 59) throw new Blocked(`시각 «${t}» 가 15:00 꼴이 아니에요.`); return [m[1].padStart(2, '0'), m[2]]; };
  const s = hm(start), e = hm(end);
  // 나이스 분 목록은 5분 단위(00, 05, … 55)라서 그 밖의 분은 받지 않아요
  for (const [t, x] of [[start, s], [end, e]]) if (+x[1] % 5) throw new Blocked(`«${t}» 의 분은 5분 단위여야 해요 (나이스 목록이 00, 05 … 55).`);
  const minutes = (+e[0] * 60 + +e[1]) - (+s[0] * 60 + +s[1]);
  if (minutes <= 0) throw new Blocked(`끝나는 시각(${end})이 시작 시각(${start})보다 늦어야 해요.`);
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length !== 11) throw new Blocked('연락처가 설정에 없거나 11자리가 아니에요. (config.json 의 phone)');
  return { kind, date, sh: s[0], sm: s[1], eh: e[0], em: e[1], minutes, phone: digits, reason: reasonOf(kind) };
}

// ---- 화면 부품 다루기 ----
const boxOf = async (loc) => { const b = await loc.boundingBox(); if (!b) throw new Blocked('칸 위치를 알 수 없어요.'); return b; };

// 입력 구역(«근무상황신청입력» 아래)의 콤보들. 목록 표(grid) 안의 콤보는 빼요.
async function inputCombos(dlg) {
  const all = dlg.locator('.cl-combobox:visible');
  const out = [];
  for (let i = 0; i < await all.count(); i++) {
    const c = all.nth(i);
    if (await c.evaluate((e) => !!e.closest('.cl-grid'))) continue;
    out.push({ loc: c, box: await boxOf(c), text: (await c.innerText()).trim() });
  }
  return out;
}

// 같은 줄(세로 위치가 비슷)에 있고, 기준 칸보다 오른쪽에 있는 콤보들을 왼쪽부터
function combosRightOf(combos, ref) {
  const cy = ref.y + ref.height / 2;
  return combos.filter((c) => Math.abs(c.box.y + c.box.height / 2 - cy) < 12 && c.box.x > ref.x)
    .sort((a, b) => a.box.x - b.box.x);
}

// 콤보를 열어 글자가 «정확히 같은» 항목만 골라요. 없으면 멈춰요.
async function pick(page, combo, value, label) {
  await combo.loc.click();
  const list = page.locator('[role=listbox].cl-combobox-list:visible');
  await list.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  const opts = list.first().locator('[role=option]');
  // 긴 목록은 보이는 근처 항목만 그려져 있어요. 없으면 목록을 위·아래로 굴려 가며 다시 찾아요.
  let texts = [], hit = -1, seen = new Set();
  const box = await list.first().boundingBox();
  for (let tries = 0; tries < 12; tries++) {
    texts = await opts.evaluateAll((els) => els.map((e) => e.textContent.trim()));
    texts.forEach((t) => seen.add(t));
    hit = texts.indexOf(value);
    if (hit >= 0 || !box) break;
    // 숫자 목록이면 찾는 값이 더 작을 때 위로, 크면 아래로. 글자 목록이면 아래로 굴려요.
    const nums = texts.map(Number).filter((x) => !Number.isNaN(x));
    const up = !Number.isNaN(Number(value)) && nums.length && Number(value) < Math.min(...nums);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, up ? -200 : 200);
    await page.waitForTimeout(250);
  }
  if (hit < 0) {
    await page.keyboard.press('Escape');
    throw new Blocked(`«${label}» 목록에 «${value}» 이(가) 없어요. 칸을 바꾸지 않고 멈췄어요.\n   (목록: ${[...seen].join(', ')})`);
  }
  await opts.nth(hit).scrollIntoViewIfNeeded();
  await opts.nth(hit).click();
  await page.waitForTimeout(400);
}

async function setText(page, input, value) {
  await input.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type(value, { delay: 30 });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
}

// 비공개여부 줄의 «기간»·«사유» 체크칸 (맨 아래에 있어서 같은 이름 중 마지막 것)
function privacyBox(dlg, name) {
  return dlg.locator('.cl-checkbox:visible').filter({ hasText: new RegExp('^\\s*' + name + '(\\s|$)') }).last();
}

async function setChecked(cb) {
  const icon = cb.locator('[role=checkbox]').first();
  await icon.waitFor({ state: 'visible', timeout: 5000 }).catch(() => { throw new Blocked('비공개여부 체크칸을 찾지 못했어요.'); });
  if ((await icon.getAttribute('aria-checked')) !== 'true') await icon.click();
}

// ---- 칸 채우기 ----
export async function fillApplication(page, dlg, req) {
  const [k1, k2] = KINDS[req.kind];
  const page_ = page;
  await textStarts(dlg, '근무상황신청입력').first().scrollIntoViewIfNeeded();   // 입력 구역이 보이게

  // 1. 근무상황 ① → ②  («근무상황» 글자 줄의 콤보 두 개)
  const label = await boxOf(textStarts(dlg, '근무상황').last());   // 맨 앞은 목록 표 머리글, 마지막이 입력 줄 이름
  let row = combosRightOf(await inputCombos(dlg), label);
  if (row.length < 2) throw new Blocked('근무상황 콤보 두 개를 찾지 못했어요.');
  if (row[0].text !== k1) await pick(page_, row[0], k1, '근무상황 ①');
  row = combosRightOf(await inputCombos(dlg), label);         // ① 을 바꾸면 ② 목록이 바뀌어요
  await pick(page_, row[1], k2, '근무상황 ②');
  say(`   근무상황: ${k1} / ${k2}`);

  // 2. 기간: 날짜 → 시 → 분 (시작, 끝)
  for (const [aria, h, m] of [['신청기간 시작일자', req.sh, req.sm], ['신청기간 종료일자', req.eh, req.em]]) {
    const input = dlg.locator(`input[aria-label="${aria}"]`);
    await setText(page_, input, req.date);
    const hm = combosRightOf(await inputCombos(dlg), await boxOf(input));
    if (hm.length < 2) throw new Blocked(`${aria} 옆의 시·분 콤보를 찾지 못했어요.`);
    await pick(page_, hm[0], h, aria + ' 시');
    await pick(page_, combosRightOf(await inputCombos(dlg), await boxOf(input))[1], m, aria + ' 분');
  }
  say(`   기간: ${req.date} ${req.sh}:${req.sm} ~ ${req.eh}:${req.em}`);

  // 3. 연락처
  await setText(page_, dlg.locator('input[aria-label="연락처"]'), req.phone);
  // 4. 사유 글자칸
  await setText(page_, dlg.locator('input[aria-label="사유 또는 용무"]'), req.reason);
  // 5. 비공개여부 «사유» 만 체크 (맨 아래 체크칸 중 «사유»)
  await setChecked(privacyBox(dlg, '사유'));
  say(`   연락처·사유(${req.reason})·비공개(사유) 넣음`);
}

// ---- 6. 대조: 실제로 들어간 값을 다시 읽어요. 하나라도 다르면 목록으로 돌려줘요 ----
export async function verifyApplication(dlg, req) {
  const [k1, k2] = KINDS[req.kind];
  const bad = [];
  const val = (aria) => dlg.locator(`input[aria-label="${aria}"]`).inputValue();
  const label = await boxOf(textStarts(dlg, '근무상황').last());
  const row = combosRightOf(await inputCombos(dlg), label);
  if (row[0]?.text !== k1 || row[1]?.text !== k2) bad.push(`근무상황 ${row[0]?.text}/${row[1]?.text} (원래 ${k1}/${k2})`);
  for (const [aria, h, m] of [['신청기간 시작일자', req.sh, req.sm], ['신청기간 종료일자', req.eh, req.em]]) {
    const d = await val(aria);
    const hm = combosRightOf(await inputCombos(dlg), await boxOf(dlg.locator(`input[aria-label="${aria}"]`)));
    if (d !== req.date || hm[0]?.text !== h || hm[1]?.text !== m) bad.push(`${aria} ${d} ${hm[0]?.text}:${hm[1]?.text} (원래 ${req.date} ${h}:${m})`);
  }
  // 나이스가 계산한 일·시간·분
  const days = +(await val('일')), hours = +(await val('시간')), mins = +(await val('분'));
  if (days !== 0 || hours * 60 + mins !== req.minutes) bad.push(`나이스 계산 ${days}일 ${hours}시간 ${mins}분 (원래 ${Math.floor(req.minutes / 60)}시간 ${req.minutes % 60}분)`);
  const phone = (await val('연락처')).replace(/\D/g, '');
  if (phone !== req.phone) bad.push('연락처가 다르게 들어갔어요');
  const reason = await val('사유 또는 용무');
  if (reason !== req.reason) bad.push(`사유 «${reason}» (원래 «${req.reason}»)`);
  const priv = { 기간: null, 사유: null };
  for (const k of Object.keys(priv)) priv[k] = await privacyBox(dlg, k).locator('[role=checkbox]').first().getAttribute('aria-checked', { timeout: 5000 });
  if (priv.사유 !== 'true' || priv.기간 === 'true') bad.push(`비공개 체크 (기간 ${priv.기간}, 사유 ${priv.사유})`);
  return bad;
}

// ---- 중복 확인: 개인근무상황관리 목록(대화상자 뒤 화면)에 같은 신청이 이미 있나요? ----
// 목록은 그 화면의 조회 기간(보통 이번 달)만 보여 줘요. 다른 달 신청은 여기서 못 걸러요.
export async function findSameInList(page, req) {
  const [, k2] = KINDS[req.kind];
  const period = `${req.date} ${req.sh}:${req.sm} ~ ${req.date} ${req.eh}:${req.em}`;
  return page.evaluate(({ period, k2 }) => {
    const rows = [...document.querySelectorAll('[role=row]')].filter((r) => !r.closest('.cl-dialog'));
    // 근무상황은 낱말 그대로 비교 («조퇴» 가 «병조퇴» 에 걸리지 않게), 삭제여부 칸의 «미삭제» 는 살아 있는 건
    return rows.map((r) => ' ' + r.innerText.replace(/\s+/g, ' ').trim() + ' ')
      .filter((t) => t.includes(period) && t.includes(' ' + k2 + ' ') && !/회수|반려|취소|(?<!미)삭제/.test(t))
      .map((t) => t.trim());
  }, { period, k2 });
}

// ---- 승인요청 (상신) ----
// [승인요청] 은 딱 한 번 눌러요. 그 뒤에 뜨는 창은 아는 것만 처리하고, 모르는 창이면 멈춰요.
//  - «…승인요청(신청·상신·저장) 하시겠습니까?» 확인창 → [확인]/[예] 한 번
//  - «…되었습니다 / 완료» 안내창 → [확인] 으로 닫고 성공
//  - 인증서 암호 창, 그 밖의 창 → 멈추고 선생님께 넘김 (다시 누르지 않음)
export async function submitApplication(page, dlg, req) {
  const CONFIRM = /(승인\s*요청|신청|상신|저장|요청).*(하시겠습니까|할까요)/;
  const DONE = /(되었습니다|됐습니다|완료)/;
  const seen = [];
  let confirmed = false, done = false;

  // 브라우저 기본 알림창(confirm/alert) — 로그인 때 걸어 둔 «무조건 닫기» 를 떼고 직접 처리
  page.removeAllListeners('dialog');
  page.on('dialog', async (d) => {
    const m = d.message();
    seen.push(m);
    if (d.type() === 'confirm' && !confirmed && CONFIRM.test(m)) { confirmed = true; await d.accept().catch(() => {}); }
    else if (d.type() === 'alert') { if (DONE.test(m)) done = true; await d.accept().catch(() => {}); }
    else await d.dismiss().catch(() => {});
  });

  const btn = dlg.locator('[role=button]:visible, button:visible').filter({ hasText: /^\s*승인요청(\s|$)/ });
  if ((await btn.count()) !== 1) throw new Blocked('[승인요청] 단추를 하나로 찾지 못했어요. 누르지 않았어요.');
  await btn.first().click();
  say('📨  [승인요청] 을 눌렀어요 (한 번만).');

  // 화면 안 알림창: 대화상자(cl-dialog) 중 신청 창이 아닌 것
  const msgBoxes = page.locator('.cl-dialog:visible').filter({ hasNot: page.locator('input[aria-label="신청기간 시작일자"]') });
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline && !done) {
    await page.waitForTimeout(500);
    if (await page.locator(PWD_FIELD).first().isVisible().catch(() => false)) {
      throw new Blocked('[승인요청] 뒤에 인증서 암호 창이 떴어요. 크롬에서 직접 암호를 넣어 마무리해 주세요.\n   (이 창은 아직 자동으로 처리하지 않아요)');
    }
    if (await msgBoxes.count()) {
      const box = msgBoxes.last();
      const text = (await box.innerText()).replace(/\s+/g, ' ').trim();
      const ok = box.locator('[role=button]:visible, button:visible').filter({ hasText: /^\s*(확인|예)(\s|$)/ });
      if (!seen.includes(text)) seen.push(text);
      if (!confirmed && CONFIRM.test(text) && await ok.count()) {
        confirmed = true; await ok.first().click(); say('   확인창에서 [확인] 을 눌렀어요.'); continue;
      }
      if (DONE.test(text)) { done = true; if (await ok.count()) await ok.first().click().catch(() => {}); break; }
      throw new Blocked('[승인요청] 뒤에 처음 보는 창이 떴어요. 아무것도 누르지 않았어요.\n   창 내용: ' + text.slice(0, 200));
    }
    if (!(await dlg.isVisible().catch(() => false))) break;   // 신청 창이 닫혔으면 끝난 것으로 보고 목록에서 확인
  }

  // 목록에서 확인 (창이 닫힌 뒤 목록이 새로 그려질 시간을 줘요)
  for (let i = 0; i < 10; i++) {
    const rows = await findSameInList(page, req);
    if (rows.length) return { rows, seen };
    await page.waitForTimeout(1000);
  }
  throw new Blocked('[승인요청] 을 누른 뒤 결과를 확인하지 못했어요. 다시 누르지 않았어요.\n' +
    '   개인근무상황관리 목록에서 신청이 들어갔는지 직접 확인해 주세요.' +
    (seen.length ? '\n   화면에 나온 말: ' + seen.join(' / ').slice(0, 200) : ''));
}

// ---- 직접 실행 ----
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 2) a[argv[i].replace(/^--/, '')] = argv[i + 1];
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const req = checkRequest({ ...args, phone: readConfig().phone });
  let ctx, page;
  try {
    ({ ctx, page } = await loginNeis());
    const dlg = await openApplyDialog(page);
    const dup = await findSameInList(page, req);
    if (dup.length) throw new Blocked('같은 신청이 이미 목록에 있어요. 다시 올리지 않았어요.\n   ' + dup[0].slice(0, 150));
    await fillApplication(page, dlg, req);
    const bad = await verifyApplication(dlg, req);
    if (args.shot) await page.screenshot({ path: args.shot });
    if (bad.length) throw new Blocked('채운 값이 입력과 달라요. [승인요청] 은 누르지 않았어요.\n   - ' + bad.join('\n   - '));
    const what = `${req.kind} ${req.date} ${req.sh}:${req.sm}~${req.eh}:${req.em}`;
    if (args.submit !== 'yes') {
      say('✅  칸을 다 채우고 대조까지 맞았어요. [승인요청] 은 누르지 않았어요. (--submit yes 로 켜요)');
      popup(`${what} 칸을 다 채웠어요.\n크롬에서 확인하고 직접 [승인요청] 을 눌러 주세요.`, 'Information');
    } else {
      const { rows, seen } = await submitApplication(page, dlg, req);
      if (args.shot) await page.screenshot({ path: args.shot }).catch(() => {});
      say('✅  승인요청 완료: ' + rows[0].slice(0, 150));
      if (seen.length) say('   화면에 나온 말: ' + seen.join(' / ').slice(0, 300));
      popup(`${what} 승인요청을 올렸어요.\n개인근무상황관리 목록에 들어간 것을 확인했어요.`, 'Information');
    }
    await new Promise((r) => ctx.on('close', r));
  } catch (e) {
    const blocked = e instanceof Blocked ? e : new Blocked('칸 채우는 중 예상하지 못한 일로 멈췄어요: ' + String(e?.message || e).split('\n')[0].slice(0, 150));
    const c = e.ctx || ctx, p = e.page || page;
    if (c) {
      if (args.shot) await p.screenshot({ path: args.shot }).catch(() => {});
      await waitForHuman(p, c, blocked, '크롬 창은 그대로 두었어요. 직접 고치거나 [닫기] 를 눌러 주세요.');
    } else throw blocked;
  }
}

if (import.meta.main) main().catch(reportFatal);
