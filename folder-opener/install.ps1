<#
  스쿨보드 폴더·프로그램 바로가기를 쓸 수 있게 이 컴퓨터(현재 사용자)에 등록합니다.
  관리자 권한은 필요 없습니다.  제거: install.ps1 -Uninstall
#>
param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$scheme = 'schoolboard-folder'
$regKey = "HKCU:\Software\Classes\$scheme"
$dest = Join-Path $env:LOCALAPPDATA 'SchoolBoard'
$handler = Join-Path $dest 'open-folder.ps1'

if ($Uninstall) {
  if (Test-Path $regKey) { Remove-Item $regKey -Recurse -Force }
  if (Test-Path $handler) { Remove-Item $handler -Force }
  $allow = Join-Path $dest 'allowed.txt'   # 허락한 프로그램 목록
  if (Test-Path $allow) { Remove-Item $allow -Force }
  if ((Test-Path $dest) -and -not (Get-ChildItem $dest -Force)) { Remove-Item $dest -Force }
  Write-Host '폴더·프로그램 바로가기 연결을 제거했어요.'
  exit 0
}

# 스쿨보드 폴더를 옮겨도 계속 동작하도록 도우미를 고정된 위치에 복사
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'open-folder.ps1') -Destination $handler -Force

$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$conhost = Join-Path $env:SystemRoot 'System32\conhost.exe'
# conhost --headless: 검은 창이 잠깐 깜빡이지 않게 숨겨서 실행
$cmd = "`"$conhost`" --headless `"$ps`" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$handler`" `"%1`""

New-Item -Path $regKey -Force | Out-Null
Set-ItemProperty -Path $regKey -Name '(default)' -Value 'URL:스쿨보드 폴더 열기'
Set-ItemProperty -Path $regKey -Name 'URL Protocol' -Value ''
New-Item -Path "$regKey\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$regKey\shell\open" -Name 'FriendlyAppName' -Value '스쿨보드 폴더 열기'
Set-ItemProperty -Path "$regKey\shell\open\command" -Name '(default)' -Value $cmd

Write-Host '완료! 이제 스쿨보드의 폴더·프로그램 바로가기를 누르면 열려요.'
Write-Host '(브라우저가 "열까요?" 하고 물으면 "열기"를 눌러 주세요.)'
