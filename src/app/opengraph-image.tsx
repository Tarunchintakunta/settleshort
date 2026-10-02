import { ImageResponse } from "next/og";

export const alt = "SettleShort: Receipt in. Settled out. One approve.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f7f7f5", padding: 80, color: "#0b0b0a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 600 }}>
          <svg width="56" height="56" viewBox="0 0 24 24">
            <rect width="24" height="24" rx="7" fill="#1B4DFF" />
            <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          SettleShort
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 80, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05 }}>Receipt in. Settled out.</div>
          <div style={{ fontSize: 80, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05, color: "#1B4DFF" }}>One approve.</div>
        </div>
        <div style={{ display: "flex", gap: 32, fontSize: 26, color: "#6b6b66" }}>
          <span>PayPal + AI settlement desk</span>
          <span style={{ color: "#0F7B4B" }}>Human approval required</span>
        </div>
      </div>
    ),
    size,
  );
}
