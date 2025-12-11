import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "AI Gmail Agent",
  description: "AI-powered triage and summaries for Gmail inboxes."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          backgroundColor: "#0b1120",
          color: "#e5e7eb"
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
          <header style={{ marginBottom: "2rem", borderBottom: "1px solid #1f2937", paddingBottom: "1rem" }}>
            <h1 style={{ fontSize: "1.8rem", margin: 0 }}>AI Gmail Agent</h1>
            <p style={{ marginTop: "0.35rem", color: "#9ca3af" }}>
              Automatically triage emails, draft replies in your voice, and send you clear summaries.
            </p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
