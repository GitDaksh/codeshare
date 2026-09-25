import { ImageResponse } from "next/og";

// iPhone home-screen icon (also used by some link previews, like iMessage).
// iOS rounds the corners itself, so the background fills the whole square.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 32 32" fill="none">
          <path
            d="M11 10.5 L6.5 16 L11 21.5"
            stroke="#f5f5f5"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 10.5 L25.5 16 L21 21.5"
            stroke="#f5f5f5"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M17.5 9 L14.5 23" stroke="#a3a3a3" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}