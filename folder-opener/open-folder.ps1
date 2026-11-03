<#
  스쿨보드 폴더 열기 도우미
  브라우저가 schoolboard-folder:<경로> 주소를 넘겨주면, 그 경로가
  이 컴퓨터에 있는 "폴더"일 때만 탐색기로 엽니다.
  파일이나 프로그램은 열지 않습니다(웹페이지가 프로그램을 실행하지 못하게).
#>
param([string]$Uri)

$ErrorActionPreference = 'Stop'
try {
  if ($Uri -notmatch '^schoolboard-folder:') { exit 1 }
  $p = [Uri]::UnescapeDataString(($Uri -replace '^schoolboard-folder:/*', ''))
  $p = [Environment]::ExpandEnvironmentVariables($p.Trim().Trim('"')) -replace '/', '\'

  # 드라이브 문자로 시작하는 경로만 허용 (예: C:\..., D:\...). 네트워크 경로(\\서버)는 막음
  if ($p -notmatch '^[A-Za-z]:\\') { exit 1 }
  if (-not (Test-Path -LiteralPath $p -PathType Container)) { exit 1 }

  $dir = (Get-Item -LiteralPath $p -Force).FullName
  (New-Object -ComObject Shell.Application).Open($dir)
} catch {
  exit 1
}
