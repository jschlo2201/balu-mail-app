// Balu-Mail – Programmfenster für Windows
// Zeigt die Oberfläche in einem eigenen Fenster (WebView2) mit Balu-Mail-Symbol in der Taskleiste,
// startet den Hintergrunddienst (Python) bei Bedarf und bleibt nach "X" als Symbol im Infobereich aktiv.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Balu-Mail")]
[assembly: AssemblyDescription("Balu-Mail – E-Mail-Programm")]
[assembly: AssemblyProduct("Balu-Mail")]
[assembly: AssemblyCompany("Balu-Mail")]
[assembly: AssemblyCopyright("Balu-Mail")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

static class BaluMail
{
    public const int Port = 8025;
    public static readonly string Base = "http://127.0.0.1:" + Port + "/";
    public static string Dir = AppDomain.CurrentDomain.BaseDirectory;
    static Mutex mutex;
    public static EventWaitHandle showSignal;
    public const string ShowEvent = "BaluMail.Fenster.Zeigen";

    public static string Quote(string a)
    {
        if (a.Length > 0 && a.IndexOfAny(new[] { ' ', '\t', '"' }) < 0) return a;
        var sb = new StringBuilder("\"");
        int bs = 0;
        foreach (char c in a)
        {
            if (c == '\\') { bs++; continue; }
            if (c == '"') { sb.Append('\\', bs * 2 + 1); sb.Append('"'); bs = 0; continue; }
            sb.Append('\\', bs); bs = 0; sb.Append(c);
        }
        sb.Append('\\', bs * 2); sb.Append('"');
        return sb.ToString();
    }

    static string Arg(string[] args, string name)
    {
        for (int i = 0; i < args.Length - 1; i++) if (args[i] == name) return args[i + 1];
        return null;
    }

    // Startadresse inkl. Sprungziel für mailto:-Links und .eml-Dateien
    static string StartUrl(string[] args)
    {
        string m = Arg(args, "--mailto");
        if (m != null && m.ToLower().StartsWith("mailto:")) return Base + "#mailto=" + Uri.EscapeDataString(m);
        string e = Arg(args, "--eml");
        if (e != null) return Base + "#eml=" + Uri.EscapeDataString(e);
        return Base;
    }

    public static bool BackendUp()
    {
        try
        {
            var r = (HttpWebRequest)WebRequest.Create(Base);
            r.Timeout = 1500; r.Proxy = null;
            using (var resp = (HttpWebResponse)r.GetResponse()) return resp.StatusCode == HttpStatusCode.OK;
        }
        catch { return false; }
    }

    public static string Token()
    {
        try
        {
            var r = (HttpWebRequest)WebRequest.Create(Base); r.Timeout = 3000; r.Proxy = null;
            using (var resp = r.GetResponse()) using (var sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            {
                var m = Regex.Match(sr.ReadToEnd(), "BM_TOKEN = \"([^\"]+)\"");
                return m.Success ? m.Groups[1].Value : null;
            }
        }
        catch { return null; }
    }

    public static void QuitBackend()
    {
        try
        {
            string t = Token(); if (t == null) return;
            var r = (HttpWebRequest)WebRequest.Create(Base + "api/quit");
            r.Method = "POST"; r.ContentType = "application/json"; r.Headers["X-Token"] = t; r.Timeout = 4000; r.Proxy = null;
            var b = Encoding.UTF8.GetBytes("{}");
            using (var s = r.GetRequestStream()) s.Write(b, 0, b.Length);
            r.GetResponse().Close();
        }
        catch { }
    }

    public static bool StartBackend(string extra, bool noHost = false)
    {
        string py = Path.Combine(Dir, "python", "pythonw.exe");
        string script = Path.Combine(Dir, "balumail.py");
        if (!File.Exists(py) || !File.Exists(script))
        {
            MessageBox.Show("Balu-Mail ist unvollständig installiert. Bitte neu installieren.", "Balu-Mail", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return false;
        }
        var psi = new ProcessStartInfo(py, Quote(script) + " " + extra) { UseShellExecute = false, WorkingDirectory = Dir, CreateNoWindow = true };
        if (noHost) psi.EnvironmentVariables["BALUMAIL_NOHOST"] = "1";   // kein Rücksprung ins Programmfenster
        try { Process.Start(psi); return true; }
        catch (Exception e)
        {
            MessageBox.Show("Balu-Mail konnte nicht gestartet werden:\n" + e.Message, "Balu-Mail", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return false;
        }
    }

    // Ohne WebView2: wie früher – Python öffnet ein Edge/Chrome-Fenster
    static int OldStyle(string[] args)
    {
        var line = new StringBuilder();
        bool hasMode = false;
        foreach (var a in args)
        {
            if (a == "--app" || a == "--no-browser" || a == "--nach-update") hasMode = true;
            if (a == "--show") continue;
            line.Append(' ').Append(Quote(a));
        }
        if (!hasMode) line.Append(" --app");
        return StartBackend(line.ToString().Trim(), true) ? 0 : 1;
    }

    static bool HasWebView2()
    {
        try { return !string.IsNullOrEmpty(CoreWebView2Environment.GetAvailableBrowserVersionString()); }
        catch { return false; }
    }

    public static readonly string LogFile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Balu-Mail", "fenster-protokoll.txt");
    public static void Log(string msg)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(LogFile));
            if (File.Exists(LogFile) && new FileInfo(LogFile).Length > 200000) File.Delete(LogFile);
            File.AppendAllText(LogFile, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + msg + Environment.NewLine, Encoding.UTF8);
        }
        catch { }
    }

    [STAThread]
    static int Main(string[] args)
    {
        // Fehler protokollieren statt das Fenster abstürzen zu lassen
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (s, e) => Log("Fehler (Oberfläche): " + e.Exception);
        AppDomain.CurrentDomain.UnhandledException += (s, e) => Log("Fehler (schwer): " + e.ExceptionObject);
        TaskScheduler.UnobservedTaskException += (s, e) => { Log("Fehler (Aufgabe): " + e.Exception); e.SetObserved(); };
        Log("Start " + string.Join(" ", args));
        if (Array.IndexOf(args, "--no-browser") >= 0 || Array.IndexOf(args, "--port") >= 0) return OldStyle(args);
        // Nur ein Programmfenster: ein zweiter Start holt das vorhandene Fenster nach vorn
        bool first;
        mutex = new Mutex(true, "BaluMail.Programmfenster", out first);
        showSignal = new EventWaitHandle(false, EventResetMode.AutoReset, ShowEvent);
        if (!first)
        {
            string m = Arg(args, "--mailto"), e = Arg(args, "--eml");
            if (m != null || e != null)
            {
                // Sprungziel über Datei weiterreichen
                try { File.WriteAllText(Path.Combine(Path.GetTempPath(), "balumail-oeffnen.txt"), StartUrl(args), Encoding.UTF8); } catch { }
            }
            showSignal.Set();
            return 0;
        }
        // Ohne Fenster (z. B. Tests) oder ohne WebView2: Python direkt starten wie früher
        if (Array.IndexOf(args, "--no-browser") >= 0 || Array.IndexOf(args, "--port") >= 0 || !HasWebView2()) return OldStyle(args);

        if (!BackendUp())
        {
            if (!StartBackend("--no-browser")) return 1;
        }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        var form = new MainForm(StartUrl(args));
        Application.Run(new ApplicationContext(form));
        GC.KeepAlive(mutex);
        return 0;
    }
}

class MainForm : Form
{
    readonly WebView2 web = new WebView2();
    readonly NotifyIcon tray = new NotifyIcon();
    readonly System.Windows.Forms.Timer watch = new System.Windows.Forms.Timer();
    readonly string startUrl;
    bool quitting, ready;
    int downCount, failCount;
    readonly string stateFile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Balu-Mail", "fenster.txt");

    public MainForm(string url)
    {
        startUrl = url;
        Text = "Balu-Mail";
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        StartPosition = FormStartPosition.CenterScreen;
        Size = new Size(1500, 900);
        MinimumSize = new Size(480, 400);
        LoadState();
        web.Dock = DockStyle.Fill;
        Controls.Add(web);

        // Symbol im Infobereich ("Ausgeblendete Symbole")
        tray.Icon = Icon;
        tray.Text = "Balu-Mail";
        tray.Visible = true;
        var menu = new ContextMenuStrip();
        menu.Items.Add("Balu-Mail öffnen", null, (s, e) => ShowWindow());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Beenden", null, (s, e) => QuitAll());
        tray.ContextMenuStrip = menu;
        tray.MouseClick += (s, e) => { if (e.Button == MouseButtons.Left) ShowWindow(); };

        // Zweiter Start → Fenster zeigen
        var t = new Thread(() =>
        {
            while (true)
            {
                BaluMail.showSignal.WaitOne();
                try { BeginInvoke((Action)(() => { OpenPending(); ShowWindow(); })); } catch { }
            }
        }) { IsBackground = true };
        t.Start();

        // Hintergrunddienst überwachen: läuft er länger nicht mehr (z. B. "Balu-Mail beenden"), Programm schließen
        watch.Interval = 3000;
        watch.Tick += (s, e) =>
        {
            Task.Run(() => BaluMail.BackendUp()).ContinueWith(up =>
            {
                if (up.Result) { downCount = 0; return; }
                if (++downCount >= 10) BeginInvoke((Action)(() => { BaluMail.Log("Dienst seit 30 s nicht erreichbar – Fenster wird beendet"); quitting = true; tray.Visible = false; Application.Exit(); }));
            });
        };
        watch.Start();

        Load += async (s, e) => await InitWeb();
    }

    async Task InitWeb()
    {
        if (web.CoreWebView2 != null || ready) return;
        ready = true;
        string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Balu-Mail", "WebView2");
        var env = await CoreWebView2Environment.CreateAsync(null, data);
        await web.EnsureCoreWebView2Async(env);
        var cw = web.CoreWebView2;
        cw.Settings.IsStatusBarEnabled = false;
        cw.Settings.AreDevToolsEnabled = false;
        cw.DocumentTitleChanged += (s, e) => { Text = string.IsNullOrEmpty(cw.DocumentTitle) ? "Balu-Mail" : cw.DocumentTitle; };
        // Links nach außen im normalen Browser öffnen
        cw.NewWindowRequested += (s, e) =>
        {
            e.Handled = true;
            if (e.Uri.StartsWith(BaluMail.Base)) { cw.Navigate(e.Uri); return; }
            try { Process.Start(new ProcessStartInfo(e.Uri) { UseShellExecute = true }); } catch { }
        };
        cw.NavigationStarting += (s, e) =>
        {
            if (e.Uri.StartsWith(BaluMail.Base) || e.Uri.StartsWith("about:") || e.Uri.StartsWith("data:")) return;
            e.Cancel = true;
            try { Process.Start(new ProcessStartInfo(e.Uri) { UseShellExecute = true }); } catch { }
        };
        // Dienst noch nicht bereit / startet gerade neu (Update): nach kurzer Pause erneut laden
        cw.NavigationCompleted += async (s, e) =>
        {
            if (e.IsSuccess) { failCount = 0; return; }
            if (++failCount > 40) return;
            await Task.Delay(1500);
            cw.Navigate(startUrl);
        };
        // Nachrichten aus der Oberfläche
        cw.WebMessageReceived += (s, e) =>
        {
            string m = e.TryGetWebMessageAsString();
            if (m == "quit") QuitAll();
            else if (m == "hide") Hide();
        };
        cw.Navigate(startUrl);
    }

    void OpenPending()
    {
        string f = Path.Combine(Path.GetTempPath(), "balumail-oeffnen.txt");
        try
        {
            if (!File.Exists(f)) return;
            string u = File.ReadAllText(f, Encoding.UTF8).Trim(); File.Delete(f);
            if (u.StartsWith(BaluMail.Base) && web.CoreWebView2 != null) web.CoreWebView2.Navigate(u);
        }
        catch { }
    }

    void ShowWindow()
    {
        if (!Visible) Show();
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        Activate(); BringToFront();
        if (web.CoreWebView2 == null) InitWeb();
    }

    void QuitAll()
    {
        BaluMail.Log("Beenden angefordert");
        quitting = true;
        SaveState();
        tray.Visible = false;
        Task.Run(() => BaluMail.QuitBackend()).Wait(5000);
        Application.Exit();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        BaluMail.Log("Schließen: " + e.CloseReason + (quitting ? " (Beenden)" : ""));
        SaveState();
        if (!quitting && e.CloseReason == CloseReason.UserClosing)
        {
            // "X": nur das Fenster schließen – Balu-Mail läuft im Hintergrund weiter
            e.Cancel = true;
            Hide();
            return;
        }
        tray.Visible = false;
        base.OnFormClosing(e);
    }

    void LoadState()
    {
        try
        {
            var p = File.ReadAllText(stateFile).Split(';');
            var r = new Rectangle(int.Parse(p[0]), int.Parse(p[1]), int.Parse(p[2]), int.Parse(p[3]));
            foreach (var sc in Screen.AllScreens)
                if (sc.WorkingArea.IntersectsWith(r)) { StartPosition = FormStartPosition.Manual; Bounds = r; break; }
            if (p.Length > 4 && p[4] == "max") WindowState = FormWindowState.Maximized;
        }
        catch { }
    }

    void SaveState()
    {
        try
        {
            if (WindowState == FormWindowState.Minimized) return;
            var r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
            Directory.CreateDirectory(Path.GetDirectoryName(stateFile));
            File.WriteAllText(stateFile, r.X + ";" + r.Y + ";" + r.Width + ";" + r.Height + ";" + (WindowState == FormWindowState.Maximized ? "max" : "normal"));
        }
        catch { }
    }
}
