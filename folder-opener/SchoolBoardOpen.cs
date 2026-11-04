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
using System.Diagnostics;
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
                Match m = Regex.Match(line, @"^GET /open\?t=([A-Za-z0-9]+)&p=([A-Za-z0-9_-]+) HTTP/1\.[01]$");
                if (m.Success)
                    status = m.Groups[1].Value != token ? 403 : (Open(m.Groups[2].Value) == 0 ? 200 : 422);
                else if (line.StartsWith("GET /ping ")) status = 200;

                byte[] body = Encoding.ASCII.GetBytes(status == 200 ? "ok" : "no");
                string head = "HTTP/1.1 " + status + " X\r\nContent-Type: text/plain\r\nAccess-Control-Allow-Origin: *\r\n" +
                              "Cache-Control: no-store\r\nContent-Length: " + body.Length + "\r\nConnection: close\r\n\r\n";
                byte[] hb = Encoding.ASCII.GetBytes(head);
                s.Write(hb, 0, hb.Length);
                s.Write(body, 0, body.Length);
            }
        }
        catch { }
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
                Process.Start(new ProcessStartInfo("explorer.exe", "\"" + Path.GetFullPath(p) + "\"") { UseShellExecute = true });
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
