import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Filtro global de período do DuoFinance.
 * Um único estado governa Dashboard, Análises, KPIs, rankings, comparativos,
 * fluxo de caixa, patrimônio e metas — evitando janelas divergentes por tela.
 */
export type PeriodKey =
  | "hoje"
  | "7d"
  | "30d"
  | "mes"
  | "mes_anterior"
  | "3m"
  | "6m"
  | "12m"
  | "ano"
  | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "3m", label: "Últimos 3 meses" },
  { key: "6m", label: "Últimos 6 meses" },
  { key: "12m", label: "Últimos 12 meses" },
  { key: "ano", label: "Ano atual" },
  { key: "custom", label: "Personalizado" },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Calcula o intervalo absoluto de uma chave de período. */
export function resolveRange(
  key: PeriodKey,
  custom?: { from: string; to: string },
): DateRange {
  const now = new Date();
  switch (key) {
    case "hoje":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "7d":
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to: endOfDay(now) };
    case "30d":
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: endOfDay(now) };
    case "mes":
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case "mes_anterior":
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "3m":
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: endOfDay(now) };
    case "6m":
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to: endOfDay(now) };
    case "12m":
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 11, 1)), to: endOfDay(now) };
    case "ano":
      return { from: startOfDay(new Date(now.getFullYear(), 0, 1)), to: endOfDay(new Date(now.getFullYear(), 11, 31)) };
    case "custom": {
      if (custom?.from && custom?.to) {
        return { from: startOfDay(parseISODay(custom.from)), to: endOfDay(parseISODay(custom.to)) };
      }
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now) };
    }
  }
}

/** Período imediatamente anterior, com a mesma duração — base de todo comparativo. */
export function previousOf(range: DateRange): DateRange {
  const duration = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  const from = new Date(to.getTime() - duration);
  return { from, to };
}

/** Quantidade de meses cobertos pelo intervalo (mínimo 1) — usado nos gráficos mensais. */
export function monthsInRange(range: DateRange): number {
  const months =
    (range.to.getFullYear() - range.from.getFullYear()) * 12 +
    (range.to.getMonth() - range.from.getMonth()) +
    1;
  return Math.max(1, months);
}

interface PeriodContextValue {
  periodKey: PeriodKey;
  setPeriodKey: (k: PeriodKey) => void;
  custom: { from: string; to: string };
  setCustom: (c: { from: string; to: string }) => void;
  range: DateRange;
  previousRange: DateRange;
  /** Início do intervalo em ISO (YYYY-MM-DD) — para filtros no banco. */
  fromISO: string;
  toISO: string;
  label: string;
}

const PeriodContext = createContext<PeriodContextValue | null>(null);

const STORAGE_KEY = "duofinance:period";

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [periodKey, setPeriodKeyState] = useState<PeriodKey>("mes");
  const [custom, setCustomState] = useState<{ from: string; to: string }>(() => {
    const now = new Date();
    return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDay(now) };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { key?: PeriodKey; custom?: { from: string; to: string } };
      if (parsed.key && PERIOD_OPTIONS.some((o) => o.key === parsed.key)) setPeriodKeyState(parsed.key);
      if (parsed.custom?.from && parsed.custom?.to) setCustomState(parsed.custom);
    } catch {
      /* estado padrão */
    }
  }, []);

  const persist = useCallback((key: PeriodKey, c: { from: string; to: string }) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, custom: c }));
  }, []);

  const setPeriodKey = useCallback(
    (k: PeriodKey) => {
      setPeriodKeyState(k);
      persist(k, custom);
    },
    [custom, persist],
  );

  const setCustom = useCallback(
    (c: { from: string; to: string }) => {
      setCustomState(c);
      setPeriodKeyState("custom");
      persist("custom", c);
    },
    [persist],
  );

  const range = useMemo(() => resolveRange(periodKey, custom), [periodKey, custom]);
  const previousRange = useMemo(() => previousOf(range), [range]);

  const label = useMemo(() => {
    if (periodKey === "custom") {
      const f = parseISODay(custom.from).toLocaleDateString("pt-BR");
      const t = parseISODay(custom.to).toLocaleDateString("pt-BR");
      return `${f} – ${t}`;
    }
    return PERIOD_OPTIONS.find((o) => o.key === periodKey)?.label ?? "Este mês";
  }, [periodKey, custom]);

  const value: PeriodContextValue = {
    periodKey,
    setPeriodKey,
    custom,
    setCustom,
    range,
    previousRange,
    fromISO: isoDay(range.from),
    toISO: isoDay(range.to),
    label,
  };

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod() {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod deve ser usado dentro de PeriodProvider");
  return ctx;
}

/** Filtra transações (ou qualquer registro com data ISO) por um intervalo. */
export function inDateRange(dateISO: string | null | undefined, r: DateRange): boolean {
  if (!dateISO) return false;
  const t = parseISODay(dateISO.slice(0, 10)).getTime();
  return t >= r.from.getTime() && t <= r.to.getTime();
}
