<#
  스쿨보드 폴더·프로그램 열기 도우미
  브라우저가 schoolboard-folder:<경로> 주소를 넘겨주면
   - 폴더면 탐색기로 엽니다.
   - 파일(프로그램 .exe, 바로가기 .lnk, 문서 등)이면, 이 컴퓨터에서 한 번 허락한 것만 실행합니다.
     처음 보는 파일은 Windows 확인 창을 띄워 물어보고, "예"를 누른 것만 allowed.txt에 기억합니다.
     (아무 웹페이지나 이 컴퓨터의 프로그램을 실행하지 못하게 하려는 장치예요.)
#>
param([string]$Uri)

$ErrorActionPreference = 'Stop'
$allowFile = Join-Path $PSScriptRoot 'allowed.txt'

function Confirm-Launch([string]$path) {
  Add-Type -AssemblyName System.Windows.Forms
  $owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }
  $msg = "스쿨보드에서 이 파일을 열려고 해요.`n`n$path`n`n" +
         "앞으로 스쿨보드 바로가기로 바로 열리도록 허락할까요?`n" +
         "(스쿨보드에서 직접 추가한 게 아니라면 '아니요'를 누르세요.)"
  try {
    return [System.Windows.Forms.MessageBox]::Show($owner, $msg, '스쿨보드', 'YesNo', 'Question', 'Button2') -eq 'Yes'
  } finally { $owner.Dispose() }
}

try {
  if ($Uri -notmatch '^schoolboard-folder:') { exit 1 }
  $p = [Uri]::UnescapeDataString(($Uri -replace '^schoolboard-folder:/*', ''))
  $p = [Environment]::ExpandEnvironmentVariables($p.Trim().Trim('"')) -replace '/', '\'

  # 드라이브 문자로 시작하는 경로만 허용 (예: C:\..., D:\...). 네트워크 경로(\\서버)는 막음
  if ($p -notmatch '^[A-Za-z]:\\') { exit 1 }
  if (-not (Test-Path -LiteralPath $p)) { exit 1 }
  $item = Get-Item -LiteralPath $p -Force

  if ($item.PSIsContainer) {
    (New-Object -ComObject Shell.Application).Open($item.FullName)
    exit 0
  }

  $full = $item.FullName
  $allowed = @(if (Test-Path -LiteralPath $allowFile) { Get-Content -LiteralPath $allowFile -Encoding UTF8 })
  if ($allowed -notcontains $full) {   # -notcontains는 대소문자를 구분하지 않아요
    if (-not (Confirm-Launch $full)) { exit 1 }
    # 확인 창이 여러 개 떴을 수 있으니 다시 읽고 없을 때만 추가
    if (-not ((Test-Path -LiteralPath $allowFile) -and (Get-Content -LiteralPath $allowFile -Encoding UTF8) -contains $full)) {
      Add-Content -LiteralPath $allowFile -Value $full -Encoding UTF8
    }
  }
  Start-Process -FilePath $full -WorkingDirectory $item.DirectoryName
} catch {
  exit 1
}
