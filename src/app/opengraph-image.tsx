import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt =
  "AgentSpend, a macOS menu bar app showing what Claude Code costs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/*
 * Satori supports flexbox and a subset of CSS. No backdrop-filter, no
 * mix-blend-mode, so this is a flat approximation of the hero rather than a
 * copy of it.
 */
export default function OpengraphImage() {
  const icon = readFileSync(
    join(process.cwd(), "public", "agentspend-icon.png"),
  );
  const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#07090b",
          backgroundImage:
            "radial-gradient(circle at 22% 42%, rgba(4,170,130,0.34), transparent 45%), radial-gradient(circle at 50% 30%, rgba(25,66,205,0.36), transparent 48%), radial-gradient(circle at 78% 44%, rgba(243,55,0,0.30), transparent 45%)",
          padding: "0 90px",
        }}
      >
        <img src={iconSrc} width={168} height={168} alt="" />

        <div
          style={{
            marginTop: 44,
            fontSize: 62,
            fontWeight: 600,
            color: "#e9efec",
            textAlign: "center",
            letterSpacing: "-0.02em",
          }}
        >
          What is Claude Code actually costing you?
        </div>

        <div
          style={{
            marginTop: 26,
            fontSize: 30,
            color: "#8f9d98",
            textAlign: "center",
          }}
        >
          A macOS menu bar app. Dollars, plus an estimate of the electricity.
        </div>
      </div>
    ),
    size,
  );
}
