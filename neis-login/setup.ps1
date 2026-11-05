<#
  나이스 자동로그인 설정 (이 컴퓨터, 이 Windows 계정 전용)
  - 필요한 프로그램(playwright-core)을 이 폴더에 깔고
  - 인증서 이름과 암호를 저장해요.
  암호는 Windows 계정으로 잠가서 %LOCALAPPDATA%\SchoolBoard\neis\cert.dat 에만 저장해요.
  (스쿨보드 폴더·GitHub 에는 저장되지 않아요. 이 컴퓨터의 이 계정에서만 풀려요.)

  지우기: setup.ps1 -Remove   (저장한 암호·설정·나이스 전용 크롬 기록을 모두 지움)
#>
param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:LOCALAPPDATA 'SchoolBoard\neis'
$config = Join-Path $dir 'config.json'
$secret = Join-Path $dir 'cert.dat'
$launcher = Join-Path $PSScriptRoot '나이스-로그인.cmd'

if ($Remove) {
  if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
  Write-Host '저장한 암호·설정·나이스 전용 크롬 기록을 모두 지웠어요.'
  exit 0
}

Write-Host ''
Write-Host '=== 나이스 자동로그인 설정 ===' -ForegroundColor Cyan

# 1) Node.js 확인
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host ''
  Write-Host 'Node.js 가 없어요. 자동로그인 프로그램을 돌리는 데 필요해요.' -ForegroundColor Yellow
  $ans = Read-Host '지금 설치할까요? (Windows 기본 설치 도구 winget 사용) [Y/n]'
  if ($ans -match '^[nN]') { Write-Host '설치를 건너뛰었어요. Node.js(LTS)를 설치한 뒤 다시 실행해 주세요.'; exit 1 }
  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '설치는 했는데 아직 인식이 안 돼요. 이 창을 닫고 «나이스-설정.cmd» 를 다시 실행해 주세요.' -ForegroundColor Yellow
    exit 1
  }
}

# 2) 필요한 프로그램 받기 (이 폴더의 node_modules 에만 깔려요. 크롬은 이미 깔린 걸 써요)
Write-Host ''
Write-Host '필요한 프로그램을 확인하는 중…'
Push-Location $PSScriptRoot
try {
  & npm install --no-audit --no-fund --loglevel=error
  if ($LASTEXITCODE -ne 0) { throw 'npm install 실패' }
} finally { Pop-Location }

if (-not (Test-Path 'C:\Program Files\Google\Chrome\Application\chrome.exe') -and
    -not (Test-Path 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe') -and
    -not (Test-Path "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")) {
  Write-Host '구글 크롬이 없어요. 크롬을 설치한 뒤 다시 실행해 주세요.' -ForegroundColor Yellow
  exit 1
}

# 3) 설정
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$cfg = [ordered]@{ neisUrl = 'https://sen.neis.go.kr/jsp/main.jsp'; certName = ''; looseSecurity = $false }
if (Test-Path $config) {
  $old = Get-Content $config -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($k in @('neisUrl', 'certName', 'looseSecurity')) { if ($null -ne $old.$k) { $cfg[$k] = $old.$k } }
}

Write-Host ''
Write-Host "나이스 주소: $($cfg.neisUrl)"
$u = Read-Host '바꾸려면 새 주소를, 그대로면 그냥 Enter'
if ($u.Trim()) { $cfg.neisUrl = $u.Trim() }

Write-Host ''
Write-Host '인증서 이름: 나이스 [인증서 로그인] 창의 목록에 보이는 «사용자» 이름을 그대로 적어 주세요.'
Write-Host '             (인증서가 하나뿐이면 비워 둬도 돼요)'
$shown = if ($cfg.certName) { $cfg.certName } else { '(비어 있음)' }
$n = Read-Host "인증서 이름 [지금: $shown] (그대로면 Enter)"
if ($n.Trim()) { $cfg.certName = $n.Trim() }

Write-Host ''
$hasPw = Test-Path $secret
$askPw = $true
if ($hasPw) {
  $a = Read-Host '저장된 암호가 있어요. 새로 바꿀까요? [y/N]'
  $askPw = $a -match '^[yY]'
}
if ($askPw) {
  for ($i = 0; $i -lt 3; $i++) {
    $p1 = Read-Host '인증서 암호 (입력해도 화면에 안 보여요)' -AsSecureString
    $p2 = Read-Host '한 번 더' -AsSecureString
    $b1 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p1)
    $b2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p2)
    try {
      $same = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b1) -ceq [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b2)
      $empty = $p1.Length -eq 0
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b1); [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b2)
    }
    if ($empty) { Write-Host '비어 있어요. 다시 입력해 주세요.' -ForegroundColor Yellow; continue }
    if (-not $same) { Write-Host '두 번 입력한 암호가 달라요. 다시 입력해 주세요.' -ForegroundColor Yellow; continue }
    # Windows 계정으로 잠가서 저장 (이 컴퓨터의 이 계정에서만 풀림)
    Set-Content -LiteralPath $secret -Value ($p1 | ConvertFrom-SecureString) -Encoding ASCII -NoNewline
    Write-Host '암호를 저장했어요.' -ForegroundColor Green
    break
  }
  if (-not (Test-Path $secret)) { Write-Host '암호를 저장하지 못했어요. 다시 실행해 주세요.' -ForegroundColor Yellow; exit 1 }
}

($cfg | ConvertTo-Json) | Set-Content -LiteralPath $config -Encoding UTF8

# 4) 스쿨보드에 연결하는 법
try { Set-Clipboard -Value $launcher } catch { }
Write-Host ''
Write-Host '=== 설정 끝! ===' -ForegroundColor Cyan
Write-Host '스쿨보드에 단추로 넣으려면:'
Write-Host '  스쿨보드 → [자주 쓰는 폴더·프로그램 추가] → 경로 칸에 붙여넣기(Ctrl+V) → 이름: 나이스'
Write-Host "  (경로를 복사해 뒀어요: $launcher)"
Write-Host '  처음 누를 때 «실행할까요?» 를 한 번 물어보면 [예] 를 눌러 주세요.'
Write-Host ''
