// 개발용 시험 프로그램: 나이스 로그인 → 복무 → 개인근무상황관리 → [신청] 을 눌러 신청 화면을 여는 데까지만 해요.
// 아무 칸도 채우지 않고, 저장·상신도 하지 않아요. 열린 화면을 캡처해 남겨요.
//   node bokmu-probe.mjs <결과를 남길 폴더>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loginNeis, Blocked, say, waitForHuman, reportFatal } from './login.mjs';
import { openApplyDialog } from './bokmu.mjs';

const OUT = process.argv[2] || '.';
mkdirSync(OUT, { recursive: true });

async function main() {
  let ctx, page;
  try {
    ({ ctx, page } = await loginNeis());
    await openApplyDialog(page);
    await page.screenshot({ path: join(OUT, '신청화면.png') });
    say('✅  신청 화면까지 열었어요. 아무것도 입력·저장하지 않았어요. 크롬을 닫으면 끝나요.');
    await new Promise((r) => ctx.on('close', r));
  } catch (e) {
    const c = e.ctx || ctx, p = e.page || page;
    if (e instanceof Blocked && c) {
      await p.screenshot({ path: join(OUT, '멈춘화면.png') }).catch(() => {});
      await waitForHuman(p, c, e, '크롬 창은 그대로 두었어요.');
    } else throw e;
  }
}

main().catch(reportFatal);
