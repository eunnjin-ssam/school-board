// 스쿨보드 - 나이스 인증서 자동로그인 (이 컴퓨터 전용)
//
//   나이스-로그인.cmd 를 누르면 실행돼요. 처음 한 번은 나이스-설정.cmd 로 설정해야 해요.
//
// 지키는 것
//  - 인증서 암호는 이 프로그램이 직접 꺼내 «암호칸에만» 넣어요. 화면·기록·오류 메시지에 절대 찍지 않아요.
//  - 암호는 설정할 때 Windows 사용자 계정으로 잠가서(DPAPI) 이 컴퓨터의 이 계정에서만 풀려요.
//    스쿨보드 폴더나 GitHub에는 암호도, 인증서 이름도 들어가지 않아요.
//  - 암호를 넣은 뒤 로그인이 안 되면 «다시 시도하지 않아요» (암호 오류 횟수 초과로 잠기지 않게).
//  - 막히면 창을 닫지 않고 선생님이 직접 로그인하게 그대로 둬요.
//  - 나이스 전용 크롬(따로 만든 프로필)을 띄워요. 평소 쓰는 크롬과 섞이지 않아요.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.env.LOCALAPPDATA, 'SchoolBoard', 'neis');
const CONFIG = join(DIR, 'config.json');
const SECRET = join(DIR, 'cert.dat');
const PROFILE = join(DIR, 'chrome-profile');

const LOGGED_IN = 'text=로그아웃';
const LOADING = 'text=로딩 중입니다 >> visible=true';
const PWD_FIELD = 'input[aria-label="인증서 암호 입력필드"], input[title="인증서 암호 입력필드"]';

// 크롬이 https 페이지에서 이 컴퓨터의 인증서 프로그램(127.0.0.1)에 붙는 걸 막지 않게
const BASE_ARGS = [
  '--disable-features=PrivateNetworkAccessForNavigations,PrivateNetworkAccessPermissionPrompt,LocalNetworkAccessChecks,PermissionChip',
  '--disable-blink-features=AutomationControlled',
  '--start-maximized',
  '--no-first-run',
  '--no-default-browser-check',
];
// 위 설정만으로 «보안프로그램 로딩중»에서 멈추는 PC에서만 추가로 켜요 (자동으로 판단해 기억함).
// 웹 보안을 일부 끄는 설정이라, 이 크롬 창으로는 나이스 말고 다른 사이트에 가지 마세요.
const LOOSE_ARGS = ['--disable-web-security', '--allow-running-insecure-content', '--test-type'];

class Blocked extends Error {}

const say = (m) => console.log(m);

function loadConfig() {
  if (!existsSync(CONFIG) || !existsSync(SECRET)) {
    throw new Blocked('아직 설정을 안 했어요. 같은 폴더의 «나이스-설정.cmd» 를 먼저 실행해 주세요.');
  }
  // PowerShell 이 저장한 파일은 맨 앞에 BOM 이 붙어 있어서 떼고 읽어요
  return JSON.parse(readFileSync(CONFIG, 'utf8').replace(/^﻿/, ''));
}

function saveConfig(cfg) {
  writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
}

// Windows 계정으로 잠가 둔 암호를 풀어요. (결과는 이 프로그램 안에서만 쓰고 어디에도 찍지 않음)
function readPassword() {
  const ps = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8;
    $s = (Get-Content -LiteralPath $env:SB_NEIS_SECRET -Raw).Trim() | ConvertTo-SecureString;
    $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);
    try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }`;
  try {
    const pw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      env: { ...process.env, SB_NEIS_SECRET: SECRET }, encoding: 'utf8', windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (!pw) throw new Error();
    return pw;
  } catch {
    throw new Blocked('저장된 암호를 열지 못했어요. «나이스-설정.cmd» 로 암호를 다시 저장해 주세요.\n' +
      '   (다른 컴퓨터·다른 Windows 계정에서 저장한 암호는 열리지 않아요)');
  }
}

async function isLoggedIn(page) {
  const loc = page.locator(LOGGED_IN);
  return (await loc.count()) > 0 && (await loc.first().isVisible());
}

async function launch(loose) {
  try {
    const ctx = await chromium.launchPersistentContext(PROFILE, {
      channel: 'chrome', headless: false, viewport: null,
      args: loose ? [...BASE_ARGS, ...LOOSE_ARGS] : BASE_ARGS,
      ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    });
    await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
    return ctx;
  } catch (e) {
    const first = String(e?.message || e).split('\n')[0].slice(0, 150);
    if (/ProcessSingleton|already in use|user data directory/i.test(first)) {
      throw new Blocked('나이스 전용 크롬 창이 이미 열려 있어요. 그 창을 쓰시거나, 닫고 다시 눌러 주세요.');
    }
    throw new Blocked('크롬을 띄우지 못했어요: ' + first + '\n   구글 크롬이 설치돼 있는지 확인해 주세요.');
  }
}

// 1단계: 나이스 첫 화면 → [인증서 로그인] → 인증서 창이 뜰 때까지. (암호는 아직 안 넣음)
// 결과: 'logged-in' | 'dialog' | 'stuck'(창이 안 뜸 — 보안 설정을 바꿔 다시 해 볼 만함)
async function openCertDialog(page, url) {
  say(`🌐  ${url}`);
  try {
    await page.goto(url, { timeout: 30_000 });
  } catch (e) {
    throw new Blocked('나이스에 접속하지 못했어요.\n' +
      '   학교 밖이면 교육청 VPN 없이는 나이스가 안 열려요. 학교망인지 확인해 주세요.');
  }
  const btn = page.getByRole('button', { name: '인증서 로그인' });
  for (let i = 0; ; i++) {
    if (await isLoggedIn(page)) return 'logged-in';
    if ((await btn.count()) && (await btn.first().isVisible())) break;
    if (i >= 60) throw new Blocked('나이스 첫 화면에서 «인증서 로그인» 버튼이 30초 동안 안 보였어요.');
    await page.waitForTimeout(500);
  }
  await btn.first().click();
  try {
    await page.locator(PWD_FIELD).first().waitFor({ state: 'visible', timeout: 25_000 });
    return 'dialog';
  } catch {
    return 'stuck';
  }
}

// 2단계: 인증서 고르기 → 암호 → 로그인 확인. 실패해도 다시 시도하지 않음.
async function enterPassword(page, certName, pw, alerts) {
  // 인증서 목록은 창이 뜬 뒤에 채워져요
  let target = null;
  for (let i = 0; i < 20 && !target; i++) {
    if (certName) {
      const exact = page.locator(`div[title=${JSON.stringify(certName)}]:visible`);
      if (await exact.count()) target = exact.first();
    } else {
      target = await onlyCertRow(page);
    }
    if (!target) await page.waitForTimeout(500);
  }
  if (!target) {
    throw new Blocked(certName
      ? `인증서 목록에서 «${certName}» 을(를) 찾지 못했어요. 암호는 넣지 않았어요.\n` +
        '   «나이스-설정.cmd» 에서 인증서 창에 보이는 이름 그대로 다시 적어 주세요.'
      : '인증서가 여러 개라 어느 것인지 모르겠어요. 암호는 넣지 않았어요.\n' +
        '   «나이스-설정.cmd» 에서 인증서 이름을 적어 주세요.');
  }
  try {
    await target.click();              // 인증서 줄을 먼저 눌러야 암호가 먹어요
    await page.waitForTimeout(400);
    const pwd = page.locator(PWD_FIELD).first();
    await pwd.fill(pw);
    await pwd.press('Enter');
  } catch {
    // playwright 오류 메시지에는 넣으려던 값(=암호)이 들어갈 수 있어서 원문을 찍지 않아요
    throw new Blocked('인증서를 고르거나 암호를 넣는 중에 화면이 바뀌어 멈췄어요. 창에서 직접 로그인해 주세요.');
  }
  say('🔐  암호를 넣었어요 (화면에 표시하지 않아요). 로그인 기다리는 중…');

  const started = Date.now();
  let firstAlert = 0;
  for (;;) {
    await page.waitForTimeout(500);
    if (await isLoggedIn(page)) return;
    if (alerts.length && !firstAlert) firstAlert = Date.now();
    if (firstAlert && Date.now() - firstAlert > 6000) break;
    const loading = (await page.locator(LOADING).count()) > 0;
    const sec = (Date.now() - started) / 1000;
    if (sec > 120 || (!loading && sec > 40)) break;
  }
  const why = alerts.length ? '\n   화면 안내: ' + scrub(alerts.join(' / '), pw).slice(0, 200) : '';
  throw new Blocked('암호를 넣었지만 로그인이 안 됐어요.' + why + '\n' +
    '   암호가 바뀌었다면 «나이스-설정.cmd» 로 다시 저장해 주세요.\n' +
    '   (암호 오류로 잠기지 않도록 자동으로 다시 시도하지 않아요)');
}

// 인증서 이름을 안 적었을 때: 인증서 창 안에 사용자 줄이 딱 하나면 그걸 골라요
async function onlyCertRow(page) {
  const titles = await page.evaluate((sel) => {
    let el = document.querySelector(sel);
    for (let i = 0; el && i < 15; i++, el = el.parentElement) {
      const t = el.innerText || '';
      if (t.includes('발급자') && t.includes('인증서 보기')) {
        return [...el.querySelectorAll('div[title]')]
          .filter((d) => d.offsetParent && d.getAttribute('title').trim())
          .map((d) => d.getAttribute('title').trim());
      }
    }
    return [];
  }, PWD_FIELD);
  // 인증서 목록 줄의 title 은 «사용자 이름» 칸이에요 (발급자·만료일 칸과 섞이지 않게 첫 칸만)
  const users = [...new Set(titles.filter((t) => !/^\d{4}-\d{2}-\d{2}$/.test(t) && !/CA|인증센터|행정안전부|교육부/.test(t)))];
  if (users.length !== 1) return null;
  return page.locator(`div[title=${JSON.stringify(users[0])}]:visible`).first();
}

function scrub(text, pw) {
  return pw ? String(text).split(pw).join('●●●') : String(text);
}

async function waitForHuman(page, ctx, blocked) {
  say('\n⏸  ' + blocked.message);
  say('⏸  열린 크롬 창에서 직접 로그인해 주세요. 이 검은 창을 닫으면 크롬도 같이 닫히니 최소화만 해 두세요.');
  await new Promise((r) => ctx.on('close', r));
}

async function closeNotices(page) {
  // 로그인 직후 공지 팝업이 뜨면 닫아 봐요. 안 되면 그냥 둬요.
  try {
    for (const name of ['닫기', '오늘 하루 보지 않기']) {
      const b = page.getByRole('button', { name, exact: true });
      if (await b.count() && await b.first().isVisible()) await b.first().click({ timeout: 2000 });
    }
  } catch { /* 무시 */ }
}

async function main() {
  const cfg = loadConfig();
  const pw = readPassword();
  const url = cfg.neisUrl || 'https://sen.neis.go.kr/jsp/main.jsp';

  let loose = !!cfg.looseSecurity;
  let ctx = await launch(loose);
  let page = ctx.pages()[0] || await ctx.newPage();
  const alerts = [];
  page.on('dialog', async (d) => { alerts.push(d.message()); await d.dismiss().catch(() => {}); });

  try {
    let state = await openCertDialog(page, url);
    if (state === 'stuck' && !loose) {
      // 암호를 넣기 전이라 다시 해도 안전해요. 보안 설정을 바꿔 한 번만 더 해 봐요.
      say('⏳  인증서 창이 안 떠서 크롬 설정을 바꿔 한 번 더 해 볼게요…');
      await ctx.close();
      loose = true;
      ctx = await launch(true);
      page = ctx.pages()[0] || await ctx.newPage();
      page.on('dialog', async (d) => { alerts.push(d.message()); await d.dismiss().catch(() => {}); });
      state = await openCertDialog(page, url);
      if (state !== 'stuck') { cfg.looseSecurity = true; saveConfig(cfg); }
    }
    if (state === 'stuck') {
      throw new Blocked('«인증서 로그인» 을 눌렀는데 인증서 창이 뜨지 않았어요.\n' +
        '   평소 크롬으로 나이스에 들어가 보안프로그램 설치 안내가 뜨는지 확인해 주세요.');
    }
    if (state === 'logged-in') {
      say('✅  이미 로그인돼 있어요.');
    } else {
      await enterPassword(page, (cfg.certName || '').trim(), pw, alerts);
      say('✅  나이스 로그인 완료!');
      await closeNotices(page);
    }
    // 이 프로그램이 끝나면 크롬도 같이 닫히므로, 선생님이 크롬을 닫을 때까지 조용히 기다려요
    say('   이 검은 창은 최소화해 두세요. 크롬을 닫으면 같이 꺼져요.');
    await new Promise((r) => ctx.on('close', r));
  } catch (e) {
    const blocked = e instanceof Blocked ? e
      : new Blocked('자동 로그인 중 예상하지 못한 일로 멈췄어요: ' + scrub(String(e?.message || e).split('\n')[0], pw).slice(0, 120));
    await waitForHuman(page, ctx, blocked);
  }
}

main().catch((e) => {
  console.log('\n❌  ' + (e instanceof Blocked ? e.message : '알 수 없는 오류로 멈췄어요.'));
  if (process.env.SB_NEIS_DEBUG && !(e instanceof Blocked)) console.log(e);   // 개발용 (암호가 섞일 수 있어 평소엔 안 찍음)
  process.exitCode = 1;
});
