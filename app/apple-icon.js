import { ImageResponse } from "next/og";

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
          background: "#2b2620",
        }}
      >
        <div style={{ display: "flex", position: "relative", width: 96, height: 96 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: "9px solid #e0916a",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: "9px solid #e0916a",
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 14,
              height: 14,
              marginTop: -7,
              marginLeft: -7,
              borderRadius: "50%",
              background: "#e0916a",
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
