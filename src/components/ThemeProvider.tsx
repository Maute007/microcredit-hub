import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { systemApi, type ApiSystemSettings } from "@/lib/api";

/** Converte cor hex (#rrggbb / #rgb) em "h s% l%" para uso em CSS variables. */
function hexToHsl(hex: string): string | null {
  if (!hex) return null;
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let sat = 0;
  const light = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        hue = ((b - r) / d + 2) * 60;
        break;
      case b:
        hue = ((r - g) / d + 4) * 60;
        break;
    }
  }
  return `${Math.round(hue)} ${Math.round(sat * 100)}% ${Math.round(light * 100)}%`;
}

/**
 * Injeta a cor primária definida pelo administrador (system_settings.primary_color)
 * como CSS variable global, fazendo todos os componentes Shadcn (Button, Tabs,
 * Badge, Ring) refletirem a identidade visual configurada — não apenas o banner
 * de login.
 *
 * Usa o endpoint público para a tela de login funcionar mesmo sem auth.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useQuery<ApiSystemSettings | null>({
    queryKey: ["system-settings-public"],
    queryFn: systemApi.getPublic,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const primaryColor = settings?.primary_color?.trim();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!primaryColor) {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--sidebar-ring");
      return;
    }
    const hsl = hexToHsl(primaryColor);
    if (!hsl) return;
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    // Também aplica ao sidebar primary para coerência da marca
    root.style.setProperty("--sidebar-primary", hsl);
    root.style.setProperty("--sidebar-ring", hsl);
  }, [primaryColor]);

  return <>{children}</>;
}
