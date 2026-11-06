// 스쿨보드 - 나이스 인증서 자동로그인 (이 컴퓨터 전용)
//
//   나이스-로그인.cmd 를 누르면 실행돼요. 처음 한 번은 나이스-설정.cmd 로 설정해야 해요.
//
// 지키는 것
//  - 인증서 암호는 이 프로그램이 직접 꺼내 «암호칸에만» 넣어요. 화면·기록·오류 메시지에 절대 찍지 않아요.
//  - 암호는 파일이 아니라 Windows 자격 증명 관리자(이 Windows 계정)에 들어 있어요.
//    스쿨보드 폴더나 GitHub에는 암호도, 인증서 이름도 들어가지 않아요.
//  - 암호를 넣은 뒤 로그인이 안 되면 «다시 시도하지 않아요» (암호 오류 횟수 초과로 잠기지 않게).
//  - 막히면 창을 닫지 않고 선생님이 직접 로그인하게 그대로 둬요.
//  - 나이스 전용 크롬(따로 만든 프로필)을 띄워요. 평소 쓰는 크롬과 섞이지 않아요.
import { chromium } from 'playwright-core';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.env.LOCALAPPDATA, 'SchoolBoard', 'neis');
const CONFIG = join(DIR, 'config.json');
const CRED_PS1 = join(import.meta.dirname, 'cred.ps1');   // Windows 자격 증명 관리자 도우미
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

// 창 없이 돌 때도 알 수 있게 Windows 알림 창을 띄워요. 돌려주는 약속은 알림 창을 닫으면 끝나요.
// (detached 로 띄우면 이 프로그램이 끝날 때 알림 창도 사라져서, 끝내기 전에 닫힐 때까지 기다려요)
function popup(message, icon = 'Warning') {
  const ps = `Add-Type -AssemblyName System.Windows.Forms;
    [System.Windows.Forms.MessageBox]::Show($env:SB_MSG, '나이스 자동로그인', 'OK', '${icon}', 'Button1', 'DefaultDesktopOnly') | Out-Null`;
  return new Promise((resolve) => {
    try {
      const c = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], {
        env: { ...process.env, SB_MSG: message }, stdio: 'ignore', windowsHide: true,
      });
      c.on('exit', resolve);
      c.on('error', resolve);
    } catch { resolve(); }   // 알림을 못 띄워도 로그인 흐름은 그대로
  });
}

// 설정을 안 했어도 돌아가요: 그때는 버튼만 눌러 주고 암호는 선생님이 직접 넣어요.
function loadConfig() {
  if (!existsSync(CONFIG)) return {};
  // PowerShell 이 저장한 파일은 맨 앞에 BOM 이 붙어 있어서 떼고 읽어요
  return JSON.parse(readFileSync(CONFIG, 'utf8').replace(/^﻿/, ''));
}

function saveConfig(cfg) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
}

// Windows 자격 증명 관리자에서 암호를 꺼내요. 저장 안 했으면 '' (그때는 선생님이 직접 입력).
// (결과는 이 프로그램 안에서만 쓰고 어디에도 찍지 않음)
function readPassword() {
  const ps = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8;
    . $env:SB_NEIS_CRED;
    $pw = [SbCred]::Read($SbCredTarget);
    if ($null -eq $pw) { exit 3 }
    [Console]::Out.Write($pw)`;
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
      env: { ...process.env, SB_NEIS_CRED: CRED_PS1 }, encoding: 'utf8', windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) {
    if (e?.status === 3) return '';
    throw new Blocked('Windows 자격 증명 관리자에서 암호를 꺼내지 못했어요. «나이스-설정.cmd» 로 암호를 다시 저장해 주세요.');
  }
}

// 인증서 목록에서 이름(일부만 적어도 됨)이 들어간 인증서 한 개를 찾아요.
// 'many' = 같은 이름이 들어간 인증서가 여러 개라 고르지 않음, null = 아직 못 찾음
async function findCert(page, certName) {
  for (let i = 0; i < 20; i++) {
    if (certName) {
      const loc = page.locator(`div[title*=${JSON.stringify(certName)}]:visible`);
      const titles = new Set((await loc.evaluateAll((els) => els.map((e) => e.getAttribute('title').trim()))));
      if (titles.size === 1) return loc.first();
      if (titles.size > 1) return 'many';
    } else {
      const t = await onlyCertRow(page);
      if (t) return t;
    }
    await page.waitForTimeout(500);
  }
  return null;
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
    // 나이스 전용 크롬이 이미 떠 있으면 새 크롬이 그 창에 넘기고 바로 꺼져서 «has been closed» 로 나와요
    if (/ProcessSingleton|already in use|user data directory|has been closed/i.test(first)) {
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

// 암호를 저장하지 않았을 때: 인증서까지 골라 두고 암호칸에 커서를 놓아 둬요. 암호는 선생님이 쳐요.
async function prepareForHuman(page, certName) {
  let target = await findCert(page, certName);
  if (target === 'many') target = null;
  try {
    if (target) { await target.click(); await page.waitForTimeout(400); }
    await page.locator(PWD_FIELD).first().focus();
  } catch { /* 못 해도 괜찮아요. 선생님이 직접 누르면 돼요 */ }
  say(target
    ? '🔑  인증서를 골라 두었어요. 크롬 창에서 암호만 입력하고 Enter 를 눌러 주세요.'
    : '🔑  인증서 창을 열었어요. 인증서를 고르고 암호를 입력해 주세요.');
}

// 2단계: 인증서 고르기 → 암호 → 로그인 확인. 실패해도 다시 시도하지 않음.
async function enterPassword(page, certName, pw, alerts) {
  // 인증서 목록은 창이 뜬 뒤에 채워져요
  const target = await findCert(page, certName);
  if (target === 'many') {
    throw new Blocked(`«${certName}» 이(가) 들어간 인증서가 여러 개라 고르지 않았어요. 암호는 넣지 않았어요.\n` +
      '   «나이스-설정.cmd» 에서 인증서 이름을 더 길게 적어 주세요.');
  }
  if (!target) {
    throw new Blocked(certName
      ? `인증서 목록에서 «${certName}» 이(가) 들어간 인증서를 찾지 못했어요. 암호는 넣지 않았어요.\n` +
        '   «나이스-설정.cmd» 에서 인증서 창에 보이는 이름을 다시 적어 주세요.'
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

async function waitForHuman(page, ctx, blocked, hint = '열린 크롬 창에서 직접 로그인해 주세요.') {
  say('\n⏸  ' + blocked.message);
  say('⏸  ' + hint);
  popup(blocked.message + '\n\n' + hint);
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

// 나이스에 로그인까지 해 두고 { ctx, page } 를 돌려줘요. 복무 같은 다음 일을 하는 프로그램이 이걸 불러 써요.
// 막히면 Blocked 를 던지는데, 크롬이 떠 있으면 e.ctx / e.page 에 실어 보내요 (선생님이 이어서 직접 하게).
export async function loginNeis() {
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
    } else if (!pw) {
      await prepareForHuman(page, (cfg.certName || '').trim());
      // 선생님이 암호를 넣을 때까지 최대 10분 기다려요
      for (let i = 0; !(await isLoggedIn(page)); i++) {
        if (i > 1200) throw new Blocked('10분 동안 로그인이 안 돼서 멈췄어요.');
        await page.waitForTimeout(500);
      }
      say('✅  나이스 로그인 완료!');
      await closeNotices(page);
    } else {
      await enterPassword(page, (cfg.certName || '').trim(), pw, alerts);
      say('✅  나이스 로그인 완료!');
      await closeNotices(page);
    }
    return { ctx, page };
  } catch (e) {
    const blocked = e instanceof Blocked ? e
      : new Blocked('자동 로그인 중 예상하지 못한 일로 멈췄어요: ' + scrub(String(e?.message || e).split('\n')[0], pw).slice(0, 120));
    blocked.ctx = ctx; blocked.page = page;
    throw blocked;
  }
}

async function main() {
  try {
    const { ctx } = await loginNeis();
    // 이 프로그램이 끝나면 크롬도 같이 닫히므로, 선생님이 크롬을 닫을 때까지 조용히 기다려요
    say('   크롬을 닫으면 이 프로그램도 같이 꺼져요.');
    await new Promise((r) => ctx.on('close', r));
  } catch (e) {
    if (e instanceof Blocked && e.ctx) await waitForHuman(e.page, e.ctx, e);
    else throw e;
  }
}

export async function reportFatal(e) {
  const msg = e instanceof Blocked ? e.message : '알 수 없는 오류로 멈췄어요.';
  console.log('\n❌  ' + msg);
  await popup(msg, 'Error');
  if (process.env.SB_NEIS_DEBUG && !(e instanceof Blocked)) console.log(e);   // 개발용 (암호가 섞일 수 있어 평소엔 안 찍음)
  process.exitCode = 1;
}

export { Blocked, popup, say, waitForHuman, PWD_FIELD };

// 이 파일을 직접 실행했을 때만 로그인하고 기다려요 (다른 프로그램이 불러 쓸 때는 실행 안 함)
if (import.meta.main) main().catch(reportFatal);
