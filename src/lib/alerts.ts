import { useMemo, useEffect, useState, useCallback } from "react";
import { useCards, useRecurrences, type CardRow, type RecurrenceRow } from "@/lib/finance-queries";

/**
 * Sistema de alertas do sistema financeiro.
 * Alertas derivam do estado atual do banco (cartões e recorrências)
 * e podem ser descartados individualmente (persistido em localStorage).
 */

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertKind =
  | "card_closing"
  | "card_due"
  | "card_limit_80"
  | "card_limit_95"
  | "recurrence_due";

export interface FinanceAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  description: string;
  href?: string;
}

const DISMISS_KEY = "finance:alerts:dismissed";
const CLOSING_WINDOW_DAYS = 3;
const DUE_WINDOW_DAYS = 3;
const RECURRENCE_WINDOW_DAYS = 3;

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function nextDateForDay(day: number): Date {
  const now = today();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastOfMonth = new Date(y, m + 1, 0).getDate();
  const clamped = Math.min(day, lastOfMonth);
  const thisMonth = new Date(y, m, clamped);
  if (thisMonth.getTime() >= now.getTime()) return thisMonth;
  const lastNext = new Date(y, m + 2, 0).getDate();
  return new Date(y, m + 1, Math.min(day, lastNext));
}

function formatDMY(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function buildCardAlerts(cards: CardRow[]): FinanceAlert[] {
  const out: FinanceAlert[] = [];
  const now = today();
  for (const c of cards) {
    const limit = Number(c.credit_limit) || 0;
    const available = Number(c.available_limit) || 0;
    const used = limit - available;
    const pct = limit > 0 ? (used / limit) * 100 : 0;

    if (pct >= 95) {
      out.push({
        id: `card:${c.id}:limit95`,
        kind: "card_limit_95",
        severity: "critical",
        title: `${c.name}: limite crítico`,
        description: `Você já usou ${pct.toFixed(0)}% do limite deste cartão.`,
        href: "/cards",
      });
    } else if (pct >= 80) {
      out.push({
        id: `card:${c.id}:limit80`,
        kind: "card_limit_80",
        severity: "warning",
        title: `${c.name}: uso alto do limite`,
        description: `${pct.toFixed(0)}% do limite já foi utilizado.`,
        href: "/cards",
      });
    }

    if (c.closing_day) {
      const next = nextDateForDay(c.closing_day);
      const diff = daysBetween(next, now);
      if (diff >= 0 && diff <= CLOSING_WINDOW_DAYS) {
        out.push({
          id: `card:${c.id}:closing:${next.toISOString().slice(0, 10)}`,
          kind: "card_closing",
          severity: diff === 0 ? "critical" : "warning",
          title: `${c.name}: fatura fecha ${diff === 0 ? "hoje" : `em ${diff}d`}`,
          description: `Fechamento em ${formatDMY(next)}.`,
          href: "/cards",
        });
      }
    }

    if (c.due_day) {
      const next = nextDateForDay(c.due_day);
      const diff = daysBetween(next, now);
      if (diff >= 0 && diff <= DUE_WINDOW_DAYS) {
        out.push({
          id: `card:${c.id}:due:${next.toISOString().slice(0, 10)}`,
          kind: "card_due",
          severity: diff === 0 ? "critical" : "warning",
          title: `${c.name}: vence ${diff === 0 ? "hoje" : `em ${diff}d`}`,
          description: `Vencimento em ${formatDMY(next)}.`,
          href: "/cards",
        });
      }
    }
  }
  return out;
}

function buildRecurrenceAlerts(items: RecurrenceRow[]): FinanceAlert[] {
  const out: FinanceAlert[] = [];
  const now = today();
  for (const r of items) {
    if (r.status !== "ativa" || !r.next_run_at) continue;
    const next = new Date(r.next_run_at + "T12:00:00");
    const diff = daysBetween(next, now);
    if (diff >= 0 && diff <= RECURRENCE_WINDOW_DAYS) {
      out.push({
        id: `rec:${r.id}:${r.next_run_at}`,
        kind: "recurrence_due",
        severity: diff === 0 ? "critical" : "info",
        title: `${r.description ?? "Recorrência"} — ${diff === 0 ? "hoje" : `em ${diff}d`}`,
        description: `Próxima execução em ${formatDMY(next)}.`,
        href: "/recurrences",
      });
    }
  }
  return out;
}

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeDismissed(set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(set)));
}

export function useAlerts() {
  const cards = useCards();
  const rec = useRecurrences();
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISMISS_KEY) setDismissed(readDismissed());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const all = useMemo<FinanceAlert[]>(() => {
    const list = [
      ...buildCardAlerts(cards.data ?? []),
      ...buildRecurrenceAlerts(rec.data ?? []),
    ];
    const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return list.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [cards.data, rec.data]);

  const visible = useMemo(() => all.filter((a) => !dismissed.has(a.id)), [all, dismissed]);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeDismissed(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const a of all) next.add(a.id);
      writeDismissed(next);
      return next;
    });
  }, [all]);

  const restoreAll = useCallback(() => {
    writeDismissed(new Set());
    setDismissed(new Set());
  }, []);

  return { alerts: visible, count: visible.length, dismiss, clearAll, restoreAll };
}
