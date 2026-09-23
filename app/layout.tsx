import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Gọn Scan — Scan tài liệu, giữ trọn màu sắc",
  description:
    "Scan và xuất tài liệu ngay trên trình duyệt. Ảnh không rời thiết bị của bạn.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
