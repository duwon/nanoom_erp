import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nanoom ERP",
  description: "나눔 ERP / UDMS / 예배 자막 관리 시스템",
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
