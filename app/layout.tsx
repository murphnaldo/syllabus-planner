import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "SyllaBuddy",
  description: "Upload a syllabus. Get every assignment, quiz, and exam on your calendar in about a minute.",
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
