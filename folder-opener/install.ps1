<#
  스쿨보드 폴더·프로그램 바로가기를 쓸 수 있게 이 컴퓨터(현재 사용자)에 등록합니다.
  관리자 권한은 필요 없습니다.  제거: install.ps1 -Uninstall
#>
param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$scheme = 'schoolboard-folder'
$regKey = "HKCU:\Software\Classes\$scheme"
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runName = 'SchoolBoardHelper'
$dest = Join-Path $env:LOCALAPPDATA 'SchoolBoard'
$exe = Join-Path $dest 'SchoolBoardOpen.exe'
$tokenFile = Join-Path $dest 'token.txt'
# 스쿨보드가 도우미에게 요청할 때 쓰는 비밀 열쇠를 적어 두는 파일 (스쿨보드 폴더 안, GitHub에는 올라가지 않음)
$tokenJs = Join-Path $PSScriptRoot 'helper-token.js'
# 예전 버전이 남긴 스크립트 도우미 (있으면 지움)
$old = @('open-folder.ps1', 'open-folder.vbs') | ForEach-Object { Join-Path $dest $_ }

# 2026-11-12: Claude 앱 같은 «앱 패키지» 안에서 실행하면 AppData\Local 에 쓴 파일이 진짜 폴더가 아니라
# 그 앱 전용 폴더(AppData\Local\Packages\<앱>\LocalCache\Local)로 들어가요. 그러면 컴퓨터를 켤 때 예전 도우미가 떠요.
# 시험 파일을 하나 써 보고 그쪽으로 갔으면 아무것도 바꾸지 않고 멈춰요.
$probeName = "schoolboard-probe-$PID.txt"
$probe = Join-Path $env:LOCALAPPDATA $probeName
Set-Content -LiteralPath $probe -Value 'probe' -Encoding ASCII
$redirected = Get-ChildItem (Join-Path $env:LOCALAPPDATA "Packages\*\LocalCache\Local\$probeName") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
foreach ($r in $redirected) { Remove-Item -LiteralPath $r.FullName -Force -ErrorAction SilentlyContinue }
if ($redirected) {
  Write-Host ''
  Write-Host '여기서는 설치할 수 없어요. (Claude 같은 앱 안에서 실행하면 진짜 폴더에 설치되지 않아요.)'
  Write-Host '파일 탐색기에서 folder-opener 폴더의 «폴더열기-설치.cmd» 를 직접 더블클릭해 주세요.'
  exit 2
}

function Stop-Helper {
  Get-Process SchoolBoardOpen -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 300
}

if ($Uninstall) {
  Stop-Helper
  if (Test-Path $regKey) { Remove-Item $regKey -Recurse -Force }
  Remove-ItemProperty -Path $runKey -Name $runName -ErrorAction SilentlyContinue
  foreach ($f in @($exe, $tokenFile, $tokenJs) + $old) { if (Test-Path $f) { Remove-Item $f -Force } }
  $allow = Join-Path $dest 'allowed.txt'   # 허락한 프로그램 목록
  if (Test-Path $allow) { Remove-Item $allow -Force }
  if ((Test-Path $dest) -and -not (Get-ChildItem $dest -Force)) { Remove-Item $dest -Force }
  Write-Host '폴더·프로그램 바로가기 연결을 제거했어요.'
  exit 0
}

# 도우미 프로그램을 Windows에 들어 있는 C# 컴파일러로 이 컴퓨터에서 바로 만듦 (인터넷에서 받는 파일 없음)
# 스쿨보드 폴더를 옮겨도 계속 동작하도록 고정된 위치에 둠
New-Item -ItemType Directory -Path $dest -Force | Out-Null
# 먼저 새 파일로 만들어 보고, 잘 만들어졌을 때만 도우미를 끄고 바꿔요 (만들기에 실패해도 쓰던 도우미는 계속 켜져 있게)
$csc = Join-Path ([Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'csc.exe'
$src = Join-Path $PSScriptRoot 'SchoolBoardOpen.cs'
$newExe = "$exe.new"
$out = & $csc /nologo /target:winexe /optimize+ /codepage:65001 "/out:$newExe" /r:System.Windows.Forms.dll $src 2>&1
if ($LASTEXITCODE -ne 0) {
  if (Test-Path $newExe) { Remove-Item $newExe -Force }
  $out | Write-Host
  throw '도우미 프로그램을 만들지 못했어요. 쓰던 도우미는 그대로 두었어요.'
}
Stop-Helper
Move-Item -LiteralPath $newExe -Destination $exe -Force
foreach ($f in $old) { if (Test-Path $f) { Remove-Item $f -Force } }

# 비밀 열쇠: 처음 한 번 만들고, 다시 설치할 때는 그대로 씀
if (-not (Test-Path $tokenFile)) {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  Set-Content -LiteralPath $tokenFile -Value (($bytes | ForEach-Object { $_.ToString('x2') }) -join '') -Encoding ASCII -NoNewline
}
$token = (Get-Content -LiteralPath $tokenFile -Raw).Trim()
Set-Content -LiteralPath $tokenJs -Encoding ASCII -Value @"
// folder-opener/install.ps1 이 만든 파일이에요. 이 컴퓨터의 도우미와 연결하는 비밀 열쇠라 GitHub에 올리지 않아요.
window.SCHOOLBOARD_HELPER = { port: 47615, token: '$token' };
"@

# 1) 컴퓨터를 켤 때 도우미가 화면 없이 같이 켜지게 하고, 지금 바로 켬
Set-ItemProperty -Path $runKey -Name $runName -Value "`"$exe`" --serve"
Start-Process -FilePath $exe -ArgumentList '--serve'

# 2) 예전 방식(브라우저 주소 연결)도 등록해 둠: 도우미가 꺼져 있을 때 대신 쓰임
New-Item -Path $regKey -Force | Out-Null
Set-ItemProperty -Path $regKey -Name '(default)' -Value 'URL:스쿨보드 폴더 열기'
Set-ItemProperty -Path $regKey -Name 'URL Protocol' -Value ''
New-Item -Path "$regKey\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$regKey\shell\open" -Name 'FriendlyAppName' -Value '스쿨보드 폴더 열기'
Set-ItemProperty -Path "$regKey\shell\open\command" -Name '(default)' -Value "`"$exe`" `"%1`""

Write-Host '완료! 스쿨보드 탭을 새로고침(F5)하면 폴더·프로그램 바로가기가 열려요.'
