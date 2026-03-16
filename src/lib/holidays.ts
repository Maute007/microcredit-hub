/**
 * Feriados nacionais de Moçambique (datas fixas).
 * Meses em 0-11 (JavaScript), dia 1-31.
 * Inclui ícone e cor para exibição premium.
 */
export interface HolidayInfo {
  m: number;
  d: number;
  name: string;
  icon?: string; // nome do ícone lucide
  gradient?: string; // classes CSS para gradiente
}

/** Mapa de gradientes para Tailwind detectar as classes */
export const HOLIDAY_GRADIENT_CLASSES = [
  "from-rose-500 to-pink-500",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
  "from-emerald-500 to-teal-600",
  "from-red-600 to-amber-600",
  "from-yellow-500 to-amber-600",
  "from-slate-600 to-slate-800",
  "from-sky-400 to-indigo-500",
  "from-sky-300 to-blue-500",
  "from-violet-500 to-purple-600",
] as const;

export const MOZ_HOLIDAYS: HolidayInfo[] = [
  { m: 0, d: 1, name: "Ano Novo", icon: "PartyPopper", gradient: HOLIDAY_GRADIENT_CLASSES[0] },
  { m: 1, d: 3, name: "Dia dos Heróis", icon: "Medal", gradient: HOLIDAY_GRADIENT_CLASSES[1] },
  { m: 3, d: 7, name: "Dia da Mulher", icon: "Heart", gradient: HOLIDAY_GRADIENT_CLASSES[2] },
  { m: 4, d: 1, name: "Dia dos Trabalhadores", icon: "Briefcase", gradient: HOLIDAY_GRADIENT_CLASSES[3] },
  { m: 5, d: 25, name: "Dia da Independência", icon: "Flag", gradient: HOLIDAY_GRADIENT_CLASSES[4] },
  { m: 8, d: 7, name: "Dia da Vitória", icon: "Trophy", gradient: HOLIDAY_GRADIENT_CLASSES[5] },
  { m: 8, d: 25, name: "Dia das Forças Armadas", icon: "Shield", gradient: HOLIDAY_GRADIENT_CLASSES[6] },
  { m: 9, d: 4, name: "Dia da Paz e Reconciliação", icon: "Bird", gradient: HOLIDAY_GRADIENT_CLASSES[7] },
  { m: 9, d: 5, name: "Feriado Dia da Paz", icon: "Bird", gradient: HOLIDAY_GRADIENT_CLASSES[8] },
  { m: 11, d: 25, name: "Dia da Família", icon: "Users", gradient: HOLIDAY_GRADIENT_CLASSES[9] },
];

export function isNationalHoliday(year: number, month: number, day: number): { isHoliday: boolean; name?: string; info?: HolidayInfo } {
  for (const h of MOZ_HOLIDAYS) {
    if (h.m === month && h.d === day) return { isHoliday: true, name: h.name, info: h };
  }
  return { isHoliday: false };
}

export function getHolidaysInMonth(year: number, month: number): Array<{ day: number; info: HolidayInfo }> {
  return MOZ_HOLIDAYS
    .filter((h) => h.m === month)
    .map((h) => ({ day: h.d, info: h }))
    .sort((a, b) => a.day - b.day);
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const d = new Date(year, month, day);
  const w = d.getDay(); // 0=Dom, 6=Sab
  return w === 0 || w === 6;
}

/** Classes para cores por dia da semana (0=Dom..6=Sáb) - variados e elegantes */
export const WEEKDAY_CELL_STYLES: Record<number, string> = {
  0: "bg-rose-50/80 dark:bg-rose-950/40 border-rose-200/50 dark:border-rose-800/30", // Dom
  1: "bg-sky-50/60 dark:bg-sky-950/30 border-sky-200/40",
  2: "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/40",
  3: "bg-amber-50/60 dark:bg-amber-950/30 border-amber-200/40",
  4: "bg-violet-50/60 dark:bg-violet-950/30 border-violet-200/40",
  5: "bg-orange-50/60 dark:bg-orange-950/30 border-orange-200/40",
  6: "bg-blue-50/80 dark:bg-blue-950/40 border-blue-200/50 dark:border-blue-800/30", // Sáb
};
