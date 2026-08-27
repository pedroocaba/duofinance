/**
 * Helpers puros para métricas do Dashboard.
 * Recebem as coleções já filtradas por escopo (via useTransactions/useAccounts/etc.)
 * e retornam agregações prontas para renderização.
 */

import type { TransactionRow, AccountRow, CardRow, CategoryRow } from "./finance-queries";

export interface Range {
  from: Date;
  to: Date;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function monthRange(offset = 0): Range {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59);
  return { from, to };
}

export function yearRange(offset = 0): Range {
  const now = new Date();
  const from = new Date(now.getFullYear() + offset, 0, 1);
  const to = new Date(now.getFullYear() + offset, 11, 31, 23, 59, 59);
  return { from, to };
}

export function inRange(dateISO: string | null | undefined, r: Range): boolean {
  if (!dateISO) return false;
  const t = new Date(dateISO).getTime();
  return t >= r.from.getTime() && t <= r.to.getTime();
}

export function sum(nums: Array<number | string | null | undefined>): number {
  return nums.reduce<number>((acc, n) => acc + Number(n ?? 0), 0);
}

export function income(tx: TransactionRow[], r?: Range): number {
  return sum(tx.filter((t) => t.type === "receita" && (!r || inRange(t.occurred_at, r))).map((t) => t.amount));
}

export function outcome(tx: TransactionRow[], r?: Range): number {
  return sum(tx.filter((t) => t.type === "despesa" && (!r || inRange(t.occurred_at, r))).map((t) => t.amount));
}

export function totalBalance(accounts: AccountRow[]): number {
  return sum(accounts.map((a) => a.current_balance));
}

/** Valor comprometido = soma do (limit - available) de todos os cartões visíveis. */
export function committedOnCards(cards: CardRow[]): number {
  return cards.reduce((acc, c) => acc + (Number(c.credit_limit) - Number(c.available_limit)), 0);
}

/** Contas a vencer: transações pendentes com due_date entre hoje e +30d. */
export function upcomingBills(tx: TransactionRow[], days = 30): TransactionRow[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const limit = new Date(now);
  limit.setDate(limit.getDate() + days);
  return tx
    .filter((t) => t.status === "pendente" && t.due_date)
    .filter((t) => {
      const d = new Date(t.due_date! + "T12:00:00").getTime();
      return d >= now.getTime() && d <= limit.getTime();
    })
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
}

export function pendingExpenses(tx: TransactionRow[]): TransactionRow[] {
  return tx.filter((t) => t.type === "despesa" && t.status === "pendente");
}

export interface CategoryBreakdown {
  key: string;
  name: string;
  value: number;
  color: string;
  icon: string;
}

export function groupByCategory(
  tx: TransactionRow[],
  cats: CategoryRow[],
  kind: "receita" | "despesa" = "despesa",
): CategoryBreakdown[] {
  const map = new Map(cats.map((c) => [c.id, c]));
  const acc = new Map<string, CategoryBreakdown>();
  for (const t of tx) {
    if (t.type !== kind) continue;
    const c = t.category_id ? map.get(t.category_id) : null;
    const key = c?.id ?? "sem-categoria";
    const prev = acc.get(key);
    acc.set(key, {
      key,
      name: c?.name ?? "Sem categoria",
      value: (prev?.value ?? 0) + Number(t.amount),
      color: c?.color ?? "#71717a",
      icon: c?.icon ?? "💰",
    });
  }
  return Array.from(acc.values()).sort((a, b) => b.value - a.value);
}

export interface NamedBreakdown {
  key: string;
  name: string;
  value: number;
  color: string;
  icon?: string;
}

export function groupByCard(tx: TransactionRow[], cards: CardRow[]): NamedBreakdown[] {
  const map = new Map(cards.map((c) => [c.id, c]));
  const acc = new Map<string, NamedBreakdown>();
  for (const t of tx) {
    if (t.type !== "despesa" || !t.credit_card_id) continue;
    const c = map.get(t.credit_card_id);
    if (!c) continue;
    const prev = acc.get(c.id);
    acc.set(c.id, {
      key: c.id,
      name: c.name,
      value: (prev?.value ?? 0) + Number(t.amount),
      color: c.color ?? "#71717a",
      icon: c.icon ?? "💳",
    });
  }
  return Array.from(acc.values()).sort((a, b) => b.value - a.value);
}

export function groupByAccount(tx: TransactionRow[], accounts: AccountRow[]): NamedBreakdown[] {
  const map = new Map(accounts.map((a) => [a.id, a]));
  const acc = new Map<string, NamedBreakdown>();
  for (const t of tx) {
    if (t.type !== "despesa" || !t.account_id) continue;
    const a = map.get(t.account_id);
    if (!a) continue;
    const prev = acc.get(a.id);
    acc.set(a.id, {
      key: a.id,
      name: a.nickname ?? a.name,
      value: (prev?.value ?? 0) + Number(t.amount),
      color: a.color ?? "#71717a",
      icon: a.icon ?? "🏦",
    });
  }
  return Array.from(acc.values()).sort((a, b) => b.value - a.value);
}

export interface MonthlyPoint {
  key: string; // YYYY-MM
  label: string; // "jan/26"
  receita: number;
  despesa: number;
  saldo: number;
}

/** Buckets dos últimos N meses; passe transações amplas (últimos ~12 meses). */
export function monthlyEvolution(tx: TransactionRow[], months = 6): MonthlyPoint[] {
  const buckets = new Map<string, MonthlyPoint>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d
      .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
      .replace(".", "");
    buckets.set(key, { key, label, receita: 0, despesa: 0, saldo: 0 });
  }
  for (const t of tx) {
    const d = new Date(t.occurred_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key);
    if (!b) continue;
    if (t.type === "receita") b.receita += Number(t.amount);
    else if (t.type === "despesa") b.despesa += Number(t.amount);
  }
  for (const b of buckets.values()) b.saldo = b.receita - b.despesa;
  return Array.from(buckets.values());
}

/** Fluxo de caixa acumulado (saldo cumulativo mês a mês). */
export function cumulativeCashflow(points: MonthlyPoint[]): Array<MonthlyPoint & { acumulado: number }> {
  let acc = 0;
  return points.map((p) => {
    acc += p.saldo;
    return { ...p, acumulado: acc };
  });
}

export interface OwnerBreakdown {
  key: string;
  name: string;
  value: number;
  color: string;
}

/** Distribuição de despesas por dono (individual) + Família (compartilhado). */
export function groupByOwnerAndFamily(
  tx: TransactionRow[],
  profiles: Array<{ id: string; name: string; color: string }>,
): OwnerBreakdown[] {
  const map = new Map(profiles.map((p) => [p.id, p]));
  const acc = new Map<string, OwnerBreakdown>();
  const familyKey = "familia";
  for (const t of tx) {
    if (t.type !== "despesa") continue;
    if (t.scope === "compartilhado") {
      const prev = acc.get(familyKey);
      acc.set(familyKey, {
        key: familyKey,
        name: "Família",
        value: (prev?.value ?? 0) + Number(t.amount),
        color: "#71717a",
      });
    } else {
      const p = map.get(t.owner_id);
      const prev = acc.get(t.owner_id);
      acc.set(t.owner_id, {
        key: t.owner_id,
        name: p?.name ?? "—",
        value: (prev?.value ?? 0) + Number(t.amount),
        color: p?.color ?? "#71717a",
      });
    }
  }
  return Array.from(acc.values()).sort((a, b) => b.value - a.value);
}

/** Comparativo simples: (atual, anterior) → variação relativa em %. */
export function variation(current: number, previous: number): { diff: number; pct: number; direction: "up" | "down" | "flat" } {
  const diff = current - previous;
  const pct = previous === 0 ? (current === 0 ? 0 : 100) : (diff / Math.abs(previous)) * 100;
  const direction = diff > 0.005 ? "up" : diff < -0.005 ? "down" : "flat";
  return { diff, pct, direction };
}

export function dailyAverage(tx: TransactionRow[], r: Range, kind: "despesa" | "receita" = "despesa"): number {
  const days = Math.max(1, Math.round((r.to.getTime() - r.from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const total = kind === "despesa" ? outcome(tx, r) : income(tx, r);
  return total / days;
}

export function monthlyAverage(points: MonthlyPoint[], kind: "despesa" | "receita" = "despesa"): number {
  if (points.length === 0) return 0;
  const total = points.reduce((s, p) => s + (kind === "despesa" ? p.despesa : p.receita), 0);
  return total / points.length;
}

export function biggest(tx: TransactionRow[], kind: "despesa" | "receita"): TransactionRow | null {
  const filtered = tx.filter((t) => t.type === kind);
  if (filtered.length === 0) return null;
  return filtered.reduce((max, t) => (Number(t.amount) > Number(max.amount) ? t : max));
}
