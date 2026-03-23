import type { CSSProperties } from "react";
import type { ApiSystemSettings } from "@/lib/api";

const TEXT_ALIGNS = new Set(["left", "center", "right", "justify"]);
const FLEX_H = new Set(["start", "center", "end"]);
const FLEX_V = new Set(["start", "center", "end", "between"]);

function mapBlockAlign(v: string | undefined): CSSProperties["alignSelf"] {
  if (v === "center") return "center";
  if (v === "end") return "flex-end";
  return "flex-start";
}

function mapJustifyContent(v: string | undefined): CSSProperties["justifyContent"] {
  if (v === "center") return "center";
  if (v === "end") return "flex-end";
  if (v === "start") return "flex-start";
  if (v === "between") return "space-between";
  return "space-between";
}

/** Estilos do painel esquerdo do login (e reutilizável no hero do dashboard). */
export function loginBannerPanelStyle(s: ApiSystemSettings | null | undefined): CSSProperties {
  const v = s?.login_banner_vertical_align?.trim() || "between";
  const vertical = FLEX_V.has(v) ? v : "between";
  return { justifyContent: mapJustifyContent(vertical) };
}

export function loginBannerTextBlockStyle(s: ApiSystemSettings | null | undefined): CSSProperties {
  const ta = s?.login_banner_text_align?.trim() || "left";
  const textAlign = TEXT_ALIGNS.has(ta) ? (ta as "left" | "center" | "right" | "justify") : "left";
  const ba = s?.login_banner_block_align?.trim() || "start";
  const alignSelf = mapBlockAlign(FLEX_H.has(ba) ? ba : "start");
  const maxWidth = (s?.login_banner_max_width?.trim() || "100%") || "100%";
  const padding = (s?.login_banner_padding?.trim() ?? "0") || "0";
  return {
    textAlign,
    alignSelf,
    maxWidth,
    padding,
    width: "100%",
  };
}

export function loginBannerTitleStyle(s: ApiSystemSettings | null | undefined): CSSProperties {
  const fs = s?.login_title_font_size?.trim();
  return fs ? { fontSize: fs } : {};
}

export function loginBannerSubtitleStyle(s: ApiSystemSettings | null | undefined): CSSProperties {
  const fs = s?.login_subtitle_font_size?.trim();
  return fs ? { fontSize: fs } : {};
}

export function loginBannerBodyStyle(s: ApiSystemSettings | null | undefined): CSSProperties {
  const fs = s?.login_body_font_size?.trim();
  return fs ? { fontSize: fs } : {};
}

export function loginBannerTitleText(s: ApiSystemSettings | null | undefined, taglineFallback: string): string {
  const t = s?.login_banner_title?.trim();
  if (t) return t;
  return taglineFallback;
}

export function loginBannerSubtitleText(s: ApiSystemSettings | null | undefined): string | null {
  const t = s?.login_banner_subtitle?.trim();
  return t || null;
}

export function loginBannerBodyText(
  s: ApiSystemSettings | null | undefined,
  descriptionFallback: string,
): string {
  const b = s?.login_banner_body?.trim();
  if (b) return b;
  const d = s?.login_description?.trim();
  if (d) return d;
  return descriptionFallback;
}

export function loginShowFeatureBoxes(s: ApiSystemSettings | null | undefined): boolean {
  return s?.login_show_feature_boxes !== false;
}
