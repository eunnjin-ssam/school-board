<#
  나이스 인증서 암호를 Windows 자격 증명 관리자(이 Windows 계정)에 넣고 꺼내는 도우미.
  setup.ps1 과 login.mjs 가 같이 써요. 암호 자체는 이 파일에도, 스쿨보드 폴더에도 없어요.
  자격 증명 관리자 → Windows 자격 증명 → 일반 자격 증명 → «SchoolBoard/NEIS-cert» 로 보여요.
#>
$SbCredTarget = 'SchoolBoard/NEIS-cert'

if (-not ('SbCred' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Security;
using FILETIME = System.Runtime.InteropServices.ComTypes.FILETIME;

public static class SbCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment;
    public FILETIME LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob;
    public int Persist; public int AttributeCount; public IntPtr Attributes;
    public string TargetAlias; public string UserName;
  }
  const int GENERIC = 1, PERSIST_LOCAL_MACHINE = 2, ERROR_NOT_FOUND = 1168;

  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CredWriteW(ref CREDENTIAL c, int flags);
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CredReadW(string target, int type, int flags, out IntPtr c);
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CredDeleteW(string target, int type, int flags);
  [DllImport("advapi32.dll")]
  static extern void CredFree(IntPtr p);

  // 암호는 SecureString 에서 바로 넘겨요 (보통 문자열로 풀어 두지 않음)
  public static void Write(string target, string user, SecureString pw) {
    IntPtr blob = Marshal.SecureStringToGlobalAllocUnicode(pw);
    try {
      var c = new CREDENTIAL {
        Type = GENERIC, TargetName = target, UserName = user, Persist = PERSIST_LOCAL_MACHINE,
        CredentialBlob = blob, CredentialBlobSize = pw.Length * 2,
        Comment = "스쿨보드 나이스 자동로그인 (인증서 암호)"
      };
      if (!CredWriteW(ref c, 0)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    } finally { Marshal.ZeroFreeGlobalAllocUnicode(blob); }
  }

  // 없으면 null
  public static string Read(string target) {
    IntPtr p;
    if (!CredReadW(target, GENERIC, 0, out p)) {
      int e = Marshal.GetLastWin32Error();
      if (e == ERROR_NOT_FOUND) return null;
      throw new System.ComponentModel.Win32Exception(e);
    }
    try {
      var c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
      if (c.CredentialBlobSize == 0) return null;
      return Marshal.PtrToStringUni(c.CredentialBlob, c.CredentialBlobSize / 2);
    } finally { CredFree(p); }
  }

  public static bool Exists(string target) {
    IntPtr p;
    if (!CredReadW(target, GENERIC, 0, out p)) return false;
    CredFree(p); return true;
  }

  public static void Delete(string target) { CredDeleteW(target, GENERIC, 0); }
}
'@
}
