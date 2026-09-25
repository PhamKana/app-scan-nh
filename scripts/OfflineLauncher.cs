using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

class OfflineLauncher {
    static readonly Dictionary<string, byte[]> Files = new Dictionary<string, byte[]>();
    static TcpListener listener;
    static string address;
    [STAThread]
    static void Main(string[] args) {
        try {
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("site.zip"))
            using (var zip = new ZipArchive(stream, ZipArchiveMode.Read)) {
                foreach (var entry in zip.Entries) {
                    if (entry.Name.Length == 0) continue;
                    using (var source = entry.Open()) using (var target = new MemoryStream()) {
                        source.CopyTo(target);
                        Files["/" + entry.FullName.Replace('\\', '/')] = target.ToArray();
                    }
                }
            }
            listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            address = "http://127.0.0.1:" + ((IPEndPoint)listener.LocalEndpoint).Port;
            Task.Run((Action)Accept);
            if (args.Length == 2 && args[0] == "--test-address") {
                File.WriteAllText(args[1], address);
                System.Threading.Thread.Sleep(System.Threading.Timeout.Infinite);
                return;
            }
            Application.EnableVisualStyles();
            var form = new Form { Text = "Gọn Scan — Offline", Width = 450, Height = 190, StartPosition = FormStartPosition.CenterScreen, FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false };
            var label = new Label { Text = "Gọn Scan đang chạy hoàn toàn trên máy.\nGiữ cửa sổ này mở trong khi scan.\nĐóng cửa sổ để dừng ứng dụng.", Left = 20, Top = 20, Width = 400, Height = 65 };
            var button = new Button { Text = "Mở Gọn Scan", Left = 20, Top = 95, Width = 160, Height = 32 };
            button.Click += (s,e) => Process.Start(address);
            form.Controls.Add(label); form.Controls.Add(button);
            form.Shown += (s,e) => Process.Start(address);
            Application.Run(form);
        } catch (Exception e) { MessageBox.Show(e.Message, "Không mở được Gọn Scan"); }
        finally { if (listener != null) listener.Stop(); }
    }
    static void Accept() {
        try { while (true) { var client = listener.AcceptTcpClient(); Task.Run(() => Serve(client)); } }
        catch (SocketException) { }
        catch (ObjectDisposedException) { }
    }
    static void Serve(TcpClient client) {
        using (client) {
            try {
                client.ReceiveTimeout = 5000; client.SendTimeout = 15000;
                using (var stream = client.GetStream()) {
                    var reader = new StreamReader(stream, Encoding.ASCII, false, 1024, true);
                    var line = reader.ReadLine();
                    if (line == null || line.Length > 8192) return;
                    var parts = line.Split(' ');
                    if (parts.Length != 3) return;
                    var host = "";
                    for (int i=0; i<100; i++) {
                        line = reader.ReadLine();
                        if (string.IsNullOrEmpty(line)) break;
                        if (line.Length > 8192) return;
                        if (line.StartsWith("Host:", StringComparison.OrdinalIgnoreCase)) host = line.Substring(5).Trim();
                    }
                    if (host != new Uri(address).Authority) { Reply(stream, 403, "text/plain", new byte[0], false); return; }
                    if (parts[0] != "GET" && parts[0] != "HEAD") { Reply(stream, 405, "text/plain", new byte[0], false); return; }
                    var path = Uri.UnescapeDataString(parts[1].Split('?')[0]);
                    if (path == "/") path = "/index.html";
                    byte[] bytes;
                    if (!Files.TryGetValue(path, out bytes)) { Reply(stream, 404, "text/plain", new byte[0], false); return; }
                    var ext = Path.GetExtension(path);
                    var mime = ext == ".html" ? "text/html; charset=utf-8" : ext == ".js" || ext == ".mjs" ? "text/javascript" : ext == ".css" ? "text/css" : ext == ".json" ? "application/json" : ext == ".svg" ? "image/svg+xml" : ext == ".png" ? "image/png" : ext == ".woff2" ? "font/woff2" : "application/octet-stream";
                    Reply(stream, 200, mime, bytes, parts[0] == "HEAD");
                }
            } catch (IOException) { } catch (SocketException) { } catch (UriFormatException) { }
        }
    }
    static void Reply(Stream stream, int status, string mime, byte[] bytes, bool head) {
        var header = Encoding.ASCII.GetBytes("HTTP/1.1 " + status + " " + (status == 200 ? "OK" : "Error") + "\r\nContent-Type: " + mime + "\r\nContent-Length: " + bytes.Length + "\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\nCache-Control: no-store\r\nContent-Security-Policy: default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'\r\n\r\n");
        stream.Write(header, 0, header.Length);
        if (!head) stream.Write(bytes, 0, bytes.Length);
    }
}
