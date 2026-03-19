import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "나눔 업무 시스템",
  description: "문서 관리, 예배 자막, 디스플레이를 아우르는 내부 업무 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
