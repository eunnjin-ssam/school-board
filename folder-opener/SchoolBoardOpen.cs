// 스쿨보드 폴더·프로그램 열기 도우미 (install.ps1이 이 파일로 SchoolBoardOpen.exe를 만들어요)
//
// 두 가지 방식으로 동작해요.
//  1) SchoolBoardOpen.exe --serve
//     컴퓨터를 켤 때 화면 없이 같이 켜져서, 이 컴퓨터 안에서만 접속되는 주소(127.0.0.1)로 요청을 기다려요.
//     스쿨보드가 http://127.0.0.1:47615/open?t=<비밀 열쇠>&p=<경로> 로 요청하면 열어 줘요.
//     비밀 열쇠는 설치할 때 만들어 스쿨보드 폴더(helper-token.js)에만 적어 두므로, 다른 웹사이트는 요청할 수 없어요.
//     (일부 학교 PC의 크롬은 아래 2번 방식을 막아서 이 방식을 먼저 써요.)
//  2) SchoolBoardOpen.exe "schoolboard-folder:b64:<경로>"  (브라우저의 주소 연결로 실행될 때)
//
// 열 때 규칙
//  - 폴더면 탐색기로 엽니다.
//  - 파일(프로그램 .exe, 바로가기 .lnk, 문서 등)이면, 이 컴퓨터에서 한 번 허락한 것만 실행합니다.
//    처음 보는 파일은 확인 창을 띄워 물어보고, "예"를 누른 것만 allowed.txt에 기억합니다.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

static class SchoolBoardOpen
{
    const int Port = 47615;
    static readonly string Home = AppDomain.CurrentDomain.BaseDirectory;
    static readonly object AllowLock = new object();

    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            if (args.Length < 1) return 1;
            if (args[0] == "--serve") return Serve();
            Match m = Regex.Match(args[0].Trim(), @"^schoolboard-folder:/*b64:([A-Za-z0-9_-]+)/?$", RegexOptions.IgnoreCase);
            return m.Success ? Open(m.Groups[1].Value) : 1;
        }
        catch { return 1; }
    }

    // ---------- 1) 대기 방식 ----------
    static int Serve()
    {
        bool first;
        using (new Mutex(true, "SchoolBoardOpenHelper", out first))
        {
            if (!first) return 0;   // 이미 켜져 있음
            string tokenFile = Path.Combine(Home, "token.txt");
            if (!File.Exists(tokenFile)) return 1;
            string token = File.ReadAllText(tokenFile).Trim();
            if (token.Length < 16) return 1;

            TcpListener listener = new TcpListener(IPAddress.Loopback, Port);
            listener.Start();
            while (true)
            {
                TcpClient c = listener.AcceptTcpClient();
                Thread t = new Thread(() => Handle(c, token));
                t.IsBackground = true;
                t.SetApartmentState(ApartmentState.STA);   // 확인 창을 띄우려면 필요
                t.Start();
            }
        }
    }

    static void Handle(TcpClient c, string token)
    {
        try
        {
            using (c)
            using (NetworkStream s = c.GetStream())
            {
                s.ReadTimeout = 5000;
                StreamReader r = new StreamReader(s, Encoding.ASCII);
                string line = r.ReadLine() ?? "";
                string h;
                while (!string.IsNullOrEmpty(h = r.ReadLine())) { }   // 나머지 머리글은 읽고 버림

                int status = 404;
                string json = null;   // 복무 진행 상황을 돌려줄 때만 씀
                Match m = Regex.Match(line, @"^GET /open\?t=([A-Za-z0-9]+)&p=([A-Za-z0-9_-]+) HTTP/1\.[01]$");
                Match bk = Regex.Match(line, @"^GET /bokmu\?t=([A-Za-z0-9]+)&p=([A-Za-z0-9_-]+)&q=([A-Za-z0-9_-]+) HTTP/1\.[01]$");
                Match bs = Regex.Match(line, @"^GET /bokmu-status\?t=([A-Za-z0-9]+) HTTP/1\.[01]$");
                if (m.Success)
                    status = m.Groups[1].Value != token ? 403 : (Open(m.Groups[2].Value) == 0 ? 200 : 422);
                else if (bk.Success)
                    status = bk.Groups[1].Value != token ? 403 : (StartBokmu(bk.Groups[2].Value, bk.Groups[3].Value) ? 200 : 422);
                else if (bs.Success)
                {
                    if (bs.Groups[1].Value != token) status = 403;
                    else { status = 200; json = ReadBokmuStatus(); }
                }
                else if (line.StartsWith("GET /ping ")) status = 200;

                byte[] body = json != null ? new UTF8Encoding(false).GetBytes(json) : Encoding.ASCII.GetBytes(status == 200 ? "ok" : "no");
                string type = json != null ? "application/json; charset=utf-8" : "text/plain";
                string head = "HTTP/1.1 " + status + " X\r\nContent-Type: " + type + "\r\nAccess-Control-Allow-Origin: *\r\n" +
                              "Cache-Control: no-store\r\nContent-Length: " + body.Length + "\r\nConnection: close\r\n\r\n";
                byte[] hb = Encoding.ASCII.GetBytes(head);
                s.Write(hb, 0, hb.Length);
                s.Write(body, 0, body.Length);
            }
        }
        catch { }
    }

    // ---------- 나이스 복무 신청 ----------
    // 스쿨보드 [복무] 창이 보낸 요청(JSON)을 이 컴퓨터의 나이스 폴더에 적어 두고, «복무-실행.cmd» 를 실행해요.
    // 실행 파일은 이름이 정확히 «복무-실행.cmd» 인 것만 받고, 처음 한 번은 다른 프로그램처럼 허락을 물어봐요.
    // 진행 상황은 복무 프로그램이 bokmu-status.json 에 남기고, 스쿨보드가 /bokmu-status 로 읽어 가요.
    static readonly string NeisDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SchoolBoard", "neis");

    static string FromB64Url(string s)
    {
        string b = s.Replace('-', '+').Replace('_', '/');
        b += new string('=', (4 - b.Length % 4) % 4);
        return Encoding.UTF8.GetString(Convert.FromBase64String(b));
    }

    static bool StartBokmu(string pathB64, string reqB64)
    {
        try
        {
            string p = FromB64Url(pathB64).Trim().Trim('"').Replace('/', '\\');
            if (!string.Equals(Path.GetFileName(p), "복무-실행.cmd", StringComparison.OrdinalIgnoreCase)) return false;
            string req = FromB64Url(reqB64).Trim();
            if (req.Length > 2000 || !req.StartsWith("{") || !req.EndsWith("}")) return false;
            Directory.CreateDirectory(NeisDir);
            File.WriteAllText(Path.Combine(NeisDir, "bokmu-request.json"), req, new UTF8Encoding(false));
            File.WriteAllText(Path.Combine(NeisDir, "bokmu-status.json"), "{\"state\":\"queued\"}", new UTF8Encoding(false));
            return Open(pathB64) == 0;
        }
        catch { return false; }
    }

    static string ReadBokmuStatus()
    {
        try
        {
            string f = Path.Combine(NeisDir, "bokmu-status.json");
            if (!File.Exists(f)) return "{}";
            using (FileStream fs = new FileStream(f, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            using (StreamReader sr = new StreamReader(fs, Encoding.UTF8))
            {
                string s = sr.ReadToEnd().Trim();
                return s.StartsWith("{") ? s : "{}";
            }
        }
        catch { return "{}"; }
    }

    // ---------- 공통: 경로 열기 ----------
    // 0 = 열었음, 1 = 열지 않음
    static int Open(string b64url)
    {
        try
        {
            string b = b64url.Replace('-', '+').Replace('_', '/');
            b += new string('=', (4 - b.Length % 4) % 4);
            string p = Encoding.UTF8.GetString(Convert.FromBase64String(b));
            p = Environment.ExpandEnvironmentVariables(p.Trim().Trim('"')).Replace('/', '\\');

            // 드라이브 문자로 시작하는 경로만 허용 (예: C:\..., D:\...). 네트워크 경로(\\서버)는 막음
            if (!Regex.IsMatch(p, @"^[A-Za-z]:\\")) return 1;

            if (Directory.Exists(p))
            {
                string dir = Path.GetFullPath(p);
                HashSet<IntPtr> before = ExplorerWindows();
                Process.Start(new ProcessStartInfo("explorer.exe", "\"" + dir + "\"") { UseShellExecute = true });
                BringExplorerToFront(before, Path.GetFileName(dir.TrimEnd('\\')));
                return 0;
            }
            if (!File.Exists(p)) return 1;

            string full = Path.GetFullPath(p);
            string allowFile = Path.Combine(Home, "allowed.txt");
            if (!IsAllowed(allowFile, full))
            {
                if (!ConfirmLaunch(full)) return 1;
                lock (AllowLock)
                {
                    if (!IsAllowed(allowFile, full))
                        File.AppendAllText(allowFile, full + Environment.NewLine, new UTF8Encoding(false));
                }
            }
            Process.Start(new ProcessStartInfo(full) { UseShellExecute = true, WorkingDirectory = Path.GetDirectoryName(full) });
            return 0;
        }
        catch { return 1; }
    }

    // ---------- 폴더 창을 스쿨보드 위로 ----------
    // 도우미는 화면 뒤에서 도는 프로그램이라, Windows가 새 탐색기 창을 브라우저 뒤에 둬요.
    // 그래서 새로 생긴 탐색기 창을 찾아 맨 앞으로 올려 줘요.
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

    static HashSet<IntPtr> ExplorerWindows()
    {
        HashSet<IntPtr> set = new HashSet<IntPtr>();
        EnumWindows((h, l) =>
        {
            StringBuilder c = new StringBuilder(64);
            GetClassName(h, c, 64);
            if (c.ToString() == "CabinetWClass" && IsWindowVisible(h)) set.Add(h);
            return true;
        }, IntPtr.Zero);
        return set;
    }

    static void BringExplorerToFront(HashSet<IntPtr> before, string folderName)
    {
        // 새 창이 뜰 때까지 최대 3초 기다림. 이미 열려 있던 폴더면 제목이 같은 창을 앞으로
        for (int i = 0; i < 30; i++)
        {
            Thread.Sleep(100);
            IntPtr target = IntPtr.Zero;
            foreach (IntPtr h in ExplorerWindows())
            {
                if (!before.Contains(h)) { target = h; break; }
                if (i >= 10 && target == IntPtr.Zero)
                {
                    StringBuilder t = new StringBuilder(260);
                    GetWindowText(h, t, 260);
                    if (string.Equals(t.ToString(), folderName, StringComparison.OrdinalIgnoreCase)) target = h;
                }
            }
            if (target == IntPtr.Zero) continue;
            if (IsIconic(target)) ShowWindow(target, 9);   // 최소화돼 있으면 되살림
            keybd_event(0x12, 0, 0, UIntPtr.Zero);         // Alt 키를 잠깐 눌렀다 떼면 Windows가 창을 앞으로 올리게 허락해 줘요
            keybd_event(0x12, 0, 2, UIntPtr.Zero);
            BringWindowToTop(target);
            SetForegroundWindow(target);
            return;
        }
    }

    static bool IsAllowed(string allowFile, string full)
    {
        if (!File.Exists(allowFile)) return false;
        return File.ReadAllLines(allowFile, Encoding.UTF8)
                   .Any(l => string.Equals(l.Trim().TrimStart('\uFEFF'), full, StringComparison.OrdinalIgnoreCase));
    }

    static bool ConfirmLaunch(string path)
    {
        string msg = "스쿨보드에서 이 파일을 열려고 해요.\n\n" + path + "\n\n" +
                     "앞으로 스쿨보드 바로가기로 바로 열리도록 허락할까요?\n" +
                     "(스쿨보드에서 직접 추가한 게 아니라면 '아니요'를 누르세요.)";
        using (Form owner = new Form { TopMost = true, ShowInTaskbar = false })
        {
            return MessageBox.Show(owner, msg, "스쿨보드", MessageBoxButtons.YesNo, MessageBoxIcon.Question,
                                   MessageBoxDefaultButton.Button2) == DialogResult.Yes;
        }
    }
}
