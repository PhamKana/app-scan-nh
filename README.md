# app scan ảnh
Ứng dụng scan tài liệu, làm phẳng theo bốn góc, xuất PDF/JPG.

## Bản Windows offline

Mở `release/GonScan.exe`. Không cần Node.js, npm hoặc Internet, kể cả lần đầu.
Có thể sao chép riêng file EXE sang máy Windows khác có .NET Framework 4.5+
và trình duyệt hiện đại (Edge hoặc Chrome).

Giao diện mở trong trình duyệt có sẵn. Giữ cửa sổ Gọn Scan — Offline mở khi
sử dụng; đóng cửa sổ này để dừng ứng dụng. Ảnh được xử lý trong trình duyệt,
không gửi lên mạng. Tải kết quả trước khi đóng hoặc tải lại trang.

Toàn bộ giao diện, OpenCV và thư viện xuất PDF được nhúng trong EXE.
Máy chủ nội bộ chỉ lắng nghe trên 127.0.0.1 với cổng tự chọn, không mở ra LAN.

Biên dịch lại trên Windows sau khi sửa mã:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-offline.ps1
node scripts/test-offline.mjs
```

Cần cài các thư viện dự án một lần trên máy biên dịch (`npm ci`). Máy dùng
file EXE không cần bước này. Kiểm tra offline chạy bản EXE thực, chặn tất cả
yêu cầu không thuộc địa chỉ nội bộ, thử hai chế độ scan và tải PDF/JPG.
