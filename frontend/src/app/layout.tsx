import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkedIn Profile API",
  description: "Paste a LinkedIn profile URL and get structured JSON back.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 antialiased dark:bg-slate-950">{children}</body>
    </html>
  );
}
