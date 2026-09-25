import { ImageResponse } from "next/og";

// Generated once at build time and served as the preview image whenever
// codeshare.tech is shared. Next.js adds the <meta og:image> tags automatically.
export const alt = "CodeShare — code together in real time";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = {
  950: "#0a0a0a",
  900: "#141414",
  700: "#2e2e2e",
  600: "#474747",
  500: "#737373",
  400: "#a3a3a3",
  300: "#d4d4d4",
  100: "#f5f5f5",
};

// Matches the default "CodeShare" editor theme.
const SYNTAX = {
  keyword: "#ffffff",
  fn: "#e8e8e8",
  string: "#a6d19b",
  plain: "#bdbdbd",
  punct: "#8a8a8a",
  comment: "#5f5f5f",
};

type Piece = { text: string; color: string } | { cursor: string; color: string };

const CODE: Piece[][] = [
  [{ text: "// pair session", color: SYNTAX.comment }],
  [
    { text: "function ", color: SYNTAX.keyword },
    { text: "greet", color: SYNTAX.fn },
    { cursor: "sam", color: INK[100] },
    { text: "(name) {", color: SYNTAX.punct },
  ],
  [
    { text: "  return ", color: SYNTAX.keyword },
    { text: "`Hi, ${name}!`", color: SYNTAX.string },
    { text: ";", color: SYNTAX.punct },
  ],
  [{ text: "}", color: SYNTAX.punct }],
  [],
  [
    { text: "const ", color: SYNTAX.keyword },
    { text: "team ", color: SYNTAX.plain },
    { text: "= [", color: SYNTAX.punct },
    { text: '"alex"', color: SYNTAX.string },
    { text: ", ", color: SYNTAX.punct },
    { text: '"sam"', color: SYNTAX.string },
    { text: "];", color: SYNTAX.punct },
  ],
  [
    { text: "team", color: SYNTAX.plain },
    { text: ".forEach(", color: SYNTAX.punct },
    { text: "greet", color: SYNTAX.fn },
    { text: ");", color: SYNTAX.punct },
    { cursor: "alex", color: INK[400] },
  ],
];

const FONT_SPECS = [
  { name: "Space Grotesk", weight: 600 },
  { name: "Inter", weight: 400 },
  { name: "Inter", weight: 500 },
  { name: "JetBrains Mono", weight: 400 },
] as const;

// Fetches a font file from Google Fonts at build time. Returns null on any
// failure, so a network hiccup falls back to the default font instead of
// failing the build.
async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`;
    const css = await (await fetch(cssUrl)).text();
    const match = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!match) return null;
    const response = await fetch(match[1]);
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const loaded = await Promise.all(
    FONT_SPECS.map(async (spec) => {
      const data = await loadGoogleFont(spec.name, spec.weight);
      return data ? { name: spec.name, data, weight: spec.weight, style: "normal" as const } : null;
    })
  );
  const fonts = loaded.filter((font): font is NonNullable<typeof font> => font !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: INK[950],
          color: INK[100],
          fontFamily: "Inter",
        }}
      >
        {/* Dot grid */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
            backgroundSize: "30px 30px",
          }}
        />
        {/* Fade the grid toward the bottom */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            backgroundImage: "linear-gradient(to bottom, rgba(10,10,10,0) 0%, rgba(10,10,10,0.9) 100%)",
          }}
        />
        {/* Soft glow behind the editor */}
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -160,
            width: 960,
            height: 760,
            display: "flex",
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 60%)",
          }}
        />

        {/* ---------- Left: brand, headline, features ---------- */}
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 72,
            bottom: 72,
            width: 560,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                border: `1px solid ${INK[700]}`,
                background: INK[900],
                fontFamily: "JetBrains Mono",
                fontSize: 22,
                color: INK[100],
              }}
            >
              {"</>"}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Space Grotesk",
                fontWeight: 600,
                fontSize: 30,
                letterSpacing: -0.5,
              }}
            >
              CodeShare
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Space Grotesk",
                fontWeight: 600,
                fontSize: 68,
                lineHeight: 1.05,
                letterSpacing: -2,
                color: INK[100],
              }}
            >
              Code together,
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Space Grotesk",
                fontWeight: 600,
                fontSize: 68,
                lineHeight: 1.05,
                letterSpacing: -2,
                color: "#8f8f8f",
              }}
            >
              in real time.
            </div>
            <div style={{ display: "flex", marginTop: 24, fontSize: 24, lineHeight: 1.45, color: INK[400] }}>
              A shared editor with live cursors, built-in chat, and code that runs right in the browser.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {["Live cursors", "Team chat", "Runs in browser"].map((feature) => (
              <div
                key={feature}
                style={{
                  display: "flex",
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: `1px solid ${INK[700]}`,
                  background: INK[900],
                  fontSize: 18,
                  fontWeight: 500,
                  color: INK[300],
                }}
              >
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* ---------- Right: mini editor ---------- */}
        <div
          style={{
            position: "absolute",
            right: 72,
            top: 104,
            width: 440,
            height: 390,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: 20,
            border: `1px solid ${INK[700]}`,
            background: INK[900],
            boxShadow: "0 40px 80px -30px rgba(255,255,255,0.14)",
          }}
        >
          <div
            style={{
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 20px",
              borderBottom: `1px solid ${INK[700]}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {[0, 1, 2].map((dot) => (
                <div
                  key={dot}
                  style={{ width: 12, height: 12, display: "flex", borderRadius: 999, background: INK[700] }}
                />
              ))}
              <div
                style={{
                  display: "flex",
                  marginLeft: 12,
                  fontFamily: "JetBrains Mono",
                  fontSize: 15,
                  color: INK[400],
                }}
              >
                pair-session.js
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 12px",
                borderRadius: 999,
                border: `1px solid ${INK[700]}`,
                fontSize: 14,
                fontWeight: 500,
                color: INK[300],
              }}
            >
              <div style={{ width: 8, height: 8, display: "flex", borderRadius: 999, background: INK[100] }} />
              Live
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "24px 20px",
              fontFamily: "JetBrains Mono",
              fontSize: 16,
            }}
          >
            {CODE.map((line, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", height: 34 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    width: 24,
                    marginRight: 20,
                    color: INK[600],
                  }}
                >
                  {String(i + 1)}
                </div>
                {line.map((piece, j) =>
                  "cursor" in piece ? (
                    <div
                      key={j}
                      style={{
                        position: "relative",
                        display: "flex",
                        width: 2,
                        height: 22,
                        marginLeft: 1,
                        marginRight: 1,
                        background: piece.color,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: -24,
                          left: 0,
                          display: "flex",
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: piece.color,
                          color: INK[950],
                          fontFamily: "Inter",
                          fontSize: 12,
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {piece.cursor}
                      </div>
                    </div>
                  ) : (
                    <div key={j} style={{ display: "flex", color: piece.color, whiteSpace: "pre" }}>
                      {piece.text}
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            right: 72,
            bottom: 66,
            display: "flex",
            fontFamily: "JetBrains Mono",
            fontSize: 20,
            color: INK[500],
          }}
        >
          codeshare.tech
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.length > 0 ? fonts : undefined,
    }
  );
}