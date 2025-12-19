// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Gmail Agent",
  description: "Triage emails, draft replies, and send summaries.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          {children}
        </div>
      </body>
    </html>
  );
}