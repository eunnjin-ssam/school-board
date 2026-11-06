// 나이스 복무 화면을 다루는 공용 코드 (bokmu-probe.mjs, bokmu-fill.mjs 가 같이 써요)
import { Blocked, say } from './login.mjs';

// 화면 글자. 글자 뒤에 화면 읽기용 «0단계 메뉴항목» 같은 말이 붙어 있어서 이름 앞부분으로 찾아요.
export function textStarts(scope, name) {
  const re = new RegExp('^\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)');
  return scope.locator('.cl-text:visible', { hasText: re });
}

export async function waitFor(loc, seconds, why) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await loc.count()) return loc.first();
    await loc.page().waitForTimeout(500);
  }
  throw new Blocked(why);
}

// 기본 메뉴 → 복무 → 개인근무상황관리 → [신청] 을 눌러 «근무상황신청» 대화상자를 열어요. 대화상자 locator 를 돌려줘요.
export async function openApplyDialog(page) {
  await page.waitForTimeout(1500);   // 왼쪽 메뉴가 다 그려질 때까지
  if (!(await textStarts(page, '개인근무상황관리').count())) {
    (await waitFor(textStarts(page, '복무'), 20, '왼쪽 메뉴에서 «복무» 를 찾지 못했어요.')).click();
  }
  await (await waitFor(textStarts(page, '개인근무상황관리'), 20, '왼쪽 메뉴에서 «개인근무상황관리» 를 찾지 못했어요.')).click();
  say('📂  개인근무상황관리 여는 중…');

  // «신청» 으로 시작하는 단추만 (대리신청·변경신청은 누르지 않음)
  const apply = page.locator('[role=button]:visible, button:visible')
    .filter({ has: page.locator('.cl-text', { hasText: /^\s*신청(\s|$)/ }) });
  await (await waitFor(apply, 30, '개인근무상황관리 화면에서 «신청» 단추를 찾지 못했어요.')).click();
  say('📝  «신청» 을 눌렀어요.');

  const dialog = page.locator('.cl-dialog:visible').filter({ has: textStarts(page, '근무상황신청입력') });
  await waitFor(dialog, 20, '«근무상황신청» 창이 뜨지 않았어요.');
  await page.waitForTimeout(1500);   // 처음 한 줄(오늘 연가)이 들어올 때까지
  return dialog.first();
}
