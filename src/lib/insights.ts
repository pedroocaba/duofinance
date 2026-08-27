/**
 * Business Intelligence: geração automática de insights, rankings,
 * projeções e pontuação de saúde financeira.
 *
 * Todos os helpers são puros — recebem coleções já carregadas e devolvem
 * DTOs prontos para renderização. A arquitetura foi pensada para receber
 * futuramente: metas, investimentos, assistente IA, OCR, recomendações.
 */

import type { AccountRow, CardRow, CategoryRow, RecurrenceRow, TransactionRow } from "./finance-queries";
import {
  cumulativeCashflow,
  income,
  outcome,
  monthlyEvolution,
  committedOnCards,
  totalBalance,
  variation,
  type Range,
} from "./dashboard-metrics";

export type InsightTone = "positive" | "negative" | "neutral" | "warning";

export interface Insight {
  id: string;
  title: string;
  description: string;
  tone: InsightTone;
  icon: string;
  metric?: string;
}

/* ============================ Insights automáticos ============================ */

function pct(diff: number, base: number): number {
  if (base === 0) return diff === 0 ? 0 : 100;
  return (diff / Math.abs(base)) * 100;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export interface GenerateInsightsInput {
  currentTx: TransactionRow[];
  previousTx: TransactionRow[];
  allTx: TransactionRow[]; // ampla (para tendências)
  accounts: AccountRow[];
  cards: CardRow[];
  categories: CategoryRow[];
}

export function generateInsights(input: GenerateInsightsInput): Insight[] {
  const { currentTx, previousTx, allTx, accounts, cards, categories } = input;
  const list: Insight[] = [];

  const incCur = income(currentTx);
  const outCur = outcome(currentTx);
  const incPrev = income(previousTx);
  const outPrev = outcome(previousTx);

  // Comparativos de despesa
  if (outPrev > 0 || outCur > 0) {
    const p = pct(outCur - outPrev, outPrev);
    list.push({
      id: "exp-var",
      title:
        p > 0
          ? `Você gastou ${p.toFixed(1)}% a mais que no período anterior`
          : p < 0
            ? `Você gastou ${Math.abs(p).toFixed(1)}% a menos que no período anterior`
            : "Seus gastos se mantiveram estáveis",
      description: `Total de saídas: ${fmtBRL(outCur)} (antes: ${fmtBRL(outPrev)}).`,
      tone: p > 5 ? "negative" : p < -5 ? "positive" : "neutral",
      icon: p > 0 ? "📈" : p < 0 ? "📉" : "➖",
      metric: fmtPct(p),
    });
  }

  // Comparativo de receita
  if (incPrev > 0 || incCur > 0) {
    const p = pct(incCur - incPrev, incPrev);
    list.push({
      id: "inc-var",
      title:
        p > 0
          ? `Sua receita cresceu ${p.toFixed(1)}%`
          : p < 0
            ? `Sua receita caiu ${Math.abs(p).toFixed(1)}%`
            : "Sua receita ficou estável",
      description: `Entradas: ${fmtBRL(incCur)} (antes: ${fmtBRL(incPrev)}).`,
      tone: p > 0 ? "positive" : p < 0 ? "warning" : "neutral",
      icon: "💰",
      metric: fmtPct(p),
    });
  }

  // Economia
  const savCur = incCur - outCur;
  const savPrev = incPrev - outPrev;
  const savRateCur = incCur > 0 ? (savCur / incCur) * 100 : 0;
  const savRatePrev = incPrev > 0 ? (savPrev / incPrev) * 100 : 0;
  const savDelta = savRateCur - savRatePrev;
  list.push({
    id: "sav-rate",
    title:
      savDelta > 1
        ? "Sua taxa de economia melhorou"
        : savDelta < -1
          ? "Sua taxa de economia caiu"
          : "Sua taxa de economia está estável",
    description: `Você guardou ${savRateCur.toFixed(1)}% do que entrou (antes: ${savRatePrev.toFixed(1)}%).`,
    tone: savDelta > 0 ? "positive" : savDelta < 0 ? "warning" : "neutral",
    icon: "🐷",
    metric: fmtPct(savDelta),
  });

  // Patrimônio (aproximado pelo saldo das contas)
  const equity = totalBalance(accounts);
  const monthly = monthlyEvolution(allTx, 6);
  const cash = cumulativeCashflow(monthly);
  if (cash.length >= 2) {
    const first = cash[0].acumulado;
    const last = cash[cash.length - 1].acumulado;
    const p = pct(last - first, first || 1);
    list.push({
      id: "equity",
      title:
        p > 0
          ? "Seu patrimônio está evoluindo"
          : p < 0
            ? "Seu patrimônio recuou no período"
            : "Patrimônio estável",
      description: `Saldo atual: ${fmtBRL(equity)}. Evolução acumulada dos últimos meses.`,
      tone: p > 0 ? "positive" : p < 0 ? "warning" : "neutral",
      icon: "🏦",
      metric: fmtPct(p),
    });
  }

  // Categoria com maior gasto
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const byCat = new Map<string, number>();
  for (const t of currentTx) {
    if (t.type !== "despesa" || !t.category_id) continue;
    byCat.set(t.category_id, (byCat.get(t.category_id) ?? 0) + Number(t.amount));
  }
  const catTop = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  if (catTop) {
    const cat = catMap.get(catTop[0]);
    list.push({
      id: "top-cat",
      title: `Sua categoria com maior gasto é ${cat?.name ?? "—"}`,
      description: `Total: ${fmtBRL(catTop[1])}.`,
      tone: "neutral",
      icon: cat?.icon ?? "📊",
    });
  }

  // Categoria que mais cresceu / reduziu
  const catPrev = new Map<string, number>();
  for (const t of previousTx) {
    if (t.type !== "despesa" || !t.category_id) continue;
    catPrev.set(t.category_id, (catPrev.get(t.category_id) ?? 0) + Number(t.amount));
  }
  const deltas: Array<{ id: string; delta: number; cur: number; prev: number }> = [];
  const ids = new Set([...byCat.keys(), ...catPrev.keys()]);
  for (const id of ids) {
    const cur = byCat.get(id) ?? 0;
    const prev = catPrev.get(id) ?? 0;
    if (cur + prev < 50) continue; // filtra ruído
    deltas.push({ id, delta: cur - prev, cur, prev });
  }
  const grew = [...deltas].sort((a, b) => b.delta - a.delta)[0];
  const shrank = [...deltas].sort((a, b) => a.delta - b.delta)[0];
  if (grew && grew.delta > 0) {
    const c = catMap.get(grew.id);
    list.push({
      id: "cat-grew",
      title: `${c?.name ?? "Categoria"} foi a que mais cresceu`,
      description: `Aumento de ${fmtBRL(grew.delta)} (${fmtPct(pct(grew.delta, grew.prev))}).`,
      tone: "warning",
      icon: c?.icon ?? "🚀",
    });
  }
  if (shrank && shrank.delta < 0) {
    const c = catMap.get(shrank.id);
    list.push({
      id: "cat-shrank",
      title: `${c?.name ?? "Categoria"} foi a que mais reduziu`,
      description: `Redução de ${fmtBRL(Math.abs(shrank.delta))} (${fmtPct(pct(shrank.delta, shrank.prev))}).`,
      tone: "positive",
      icon: c?.icon ?? "✅",
    });
  }

  // Cartão mais usado
  const byCard = new Map<string, number>();
  for (const t of currentTx) {
    if (t.type !== "despesa" || !t.credit_card_id) continue;
    byCard.set(t.credit_card_id, (byCard.get(t.credit_card_id) ?? 0) + Number(t.amount));
  }
  const cardTop = [...byCard.entries()].sort((a, b) => b[1] - a[1])[0];
  if (cardTop) {
    const c = cards.find((x) => x.id === cardTop[0]);
    list.push({
      id: "top-card",
      title: `Seu cartão mais usado é ${c?.name ?? "—"}`,
      description: `Total no período: ${fmtBRL(cardTop[1])}.`,
      tone: "neutral",
      icon: c?.icon ?? "💳",
    });
  }

  // Conta mais usada
  const byAcc = new Map<string, number>();
  for (const t of currentTx) {
    if (!t.account_id) continue;
    byAcc.set(t.account_id, (byAcc.get(t.account_id) ?? 0) + Number(t.amount));
  }
  const accTop = [...byAcc.entries()].sort((a, b) => b[1] - a[1])[0];
  if (accTop) {
    const a = accounts.find((x) => x.id === accTop[0]);
    list.push({
      id: "top-acc",
      title: `Sua conta mais movimentada é ${a?.nickname ?? a?.name ?? "—"}`,
      description: `Movimentação: ${fmtBRL(accTop[1])}.`,
      tone: "neutral",
      icon: a?.icon ?? "🏦",
    });
  }

  // Dia da semana com mais gastos
  const wd = weekdayExpenses(currentTx);
  const wdTop = [...wd.entries()].sort((a, b) => b[1] - a[1])[0];
  if (wdTop && wdTop[1] > 0) {
    list.push({
      id: "weekday",
      title: `${WEEKDAY_LABELS[wdTop[0]]} é o dia em que você mais gasta`,
      description: `Total: ${fmtBRL(wdTop[1])} nesse dia da semana.`,
      tone: "neutral",
      icon: "📅",
    });
  }

  // Média diária de despesas
  const days = Math.max(1, currentTx.length > 0 ? uniqueDays(currentTx) : 1);
  const avgDay = outCur / days;
  list.push({
    id: "avg-day",
    title: "Média diária de despesas",
    description: `Você gasta em média ${fmtBRL(avgDay)} por dia com movimento.`,
    tone: "neutral",
    icon: "☀️",
    metric: fmtBRL(avgDay),
  });

  // Média mensal de receita / despesa (últimos 12 meses)
  const m12 = monthlyEvolution(allTx, 12);
  const avgIncMonth = m12.reduce((s, m) => s + m.receita, 0) / Math.max(1, m12.length);
  const avgOutMonth = m12.reduce((s, m) => s + m.despesa, 0) / Math.max(1, m12.length);
  list.push({
    id: "avg-inc-month",
    title: "Média mensal de receitas (12m)",
    description: `Nos últimos 12 meses, sua média mensal é ${fmtBRL(avgIncMonth)}.`,
    tone: "positive",
    icon: "📈",
    metric: fmtBRL(avgIncMonth),
  });
  list.push({
    id: "avg-out-month",
    title: "Média mensal de despesas (12m)",
    description: `Nos últimos 12 meses, você gasta em média ${fmtBRL(avgOutMonth)} por mês.`,
    tone: "neutral",
    icon: "📊",
    metric: fmtBRL(avgOutMonth),
  });

  // Uso de limite dos cartões
  const totalLimit = cards.reduce((s, c) => s + Number(c.credit_limit), 0);
  const used = committedOnCards(cards);
  const util = totalLimit > 0 ? (used / totalLimit) * 100 : 0;
  if (totalLimit > 0) {
    list.push({
      id: "card-util",
      title:
        util >= 80
          ? "Uso alto do limite dos cartões"
          : util >= 50
            ? "Uso moderado do limite dos cartões"
            : "Uso saudável do limite dos cartões",
      description: `Utilização total: ${util.toFixed(1)}% (${fmtBRL(used)} de ${fmtBRL(totalLimit)}).`,
      tone: util >= 80 ? "negative" : util >= 50 ? "warning" : "positive",
      icon: "💳",
      metric: `${util.toFixed(0)}%`,
    });
  }

  return list;
}

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function weekdayExpenses(tx: TransactionRow[]): Map<number, number> {
  const acc = new Map<number, number>();
  for (let i = 0; i < 7; i++) acc.set(i, 0);
  for (const t of tx) {
    if (t.type !== "despesa") continue;
    const d = new Date(t.occurred_at + (t.occurred_at.length === 10 ? "T12:00:00" : ""));
    const w = d.getDay();
    acc.set(w, (acc.get(w) ?? 0) + Number(t.amount));
  }
  return acc;
}

export interface WeekdayPoint {
  key: number;
  label: string;
  value: number;
}

export function weekdayChart(tx: TransactionRow[]): WeekdayPoint[] {
  const map = weekdayExpenses(tx);
  return [...map.entries()].map(([k, v]) => ({ key: k, label: WEEKDAY_LABELS[k].slice(0, 3), value: v }));
}

function uniqueDays(tx: TransactionRow[]): number {
  const set = new Set<string>();
  for (const t of tx) set.add(t.occurred_at.slice(0, 10));
  return set.size;
}

/* =============================== Rankings =============================== */

export interface RankItem {
  key: string;
  name: string;
  value: number;
  color?: string;
  icon?: string;
  meta?: string;
}

export function rankCategoriesByExpense(tx: TransactionRow[], cats: CategoryRow[], limit = 10): RankItem[] {
  return rankCategories(tx, cats, "despesa", limit);
}
export function rankCategoriesByIncome(tx: TransactionRow[], cats: CategoryRow[], limit = 10): RankItem[] {
  return rankCategories(tx, cats, "receita", limit);
}

function rankCategories(tx: TransactionRow[], cats: CategoryRow[], type: "receita" | "despesa", limit: number): RankItem[] {
  const map = new Map(cats.map((c) => [c.id, c]));
  const acc = new Map<string, number>();
  for (const t of tx) {
    if (t.type !== type) continue;
    const key = t.category_id ?? "sem";
    acc.set(key, (acc.get(key) ?? 0) + Number(t.amount));
  }
  return [...acc.entries()]
    .map(([id, value]) => {
      const c = map.get(id);
      return { key: id, name: c?.name ?? "Sem categoria", value, color: c?.color ?? "#71717a", icon: c?.icon ?? "💰" };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function rankCardsByUsage(tx: TransactionRow[], cards: CardRow[]): RankItem[] {
  const map = new Map(cards.map((c) => [c.id, c]));
  const acc = new Map<string, number>();
  for (const t of tx) {
    if (t.type !== "despesa" || !t.credit_card_id) continue;
    acc.set(t.credit_card_id, (acc.get(t.credit_card_id) ?? 0) + Number(t.amount));
  }
  return [...acc.entries()]
    .map(([id, value]) => {
      const c = map.get(id);
      return { key: id, name: c?.name ?? "—", value, color: c?.color ?? "#71717a", icon: c?.icon ?? "💳" };
    })
    .sort((a, b) => b.value - a.value);
}

export function rankCardsByLimitUtilization(cards: CardRow[]): RankItem[] {
  return cards
    .map((c) => {
      const used = Number(c.credit_limit) - Number(c.available_limit);
      const util = Number(c.credit_limit) > 0 ? (used / Number(c.credit_limit)) * 100 : 0;
      return {
        key: c.id,
        name: c.name,
        value: util,
        color: c.color ?? "#71717a",
        icon: c.icon ?? "💳",
        meta: `${fmtBRL(used)} de ${fmtBRL(Number(c.credit_limit))}`,
      } satisfies RankItem;
    })
    .sort((a, b) => b.value - a.value);
}

export function rankAccountsByMovement(tx: TransactionRow[], accounts: AccountRow[]): RankItem[] {
  const map = new Map(accounts.map((a) => [a.id, a]));
  const acc = new Map<string, number>();
  for (const t of tx) {
    if (!t.account_id) continue;
    acc.set(t.account_id, (acc.get(t.account_id) ?? 0) + Number(t.amount));
  }
  return [...acc.entries()]
    .map(([id, value]) => {
      const a = map.get(id);
      return { key: id, name: a?.nickname ?? a?.name ?? "—", value, color: a?.color ?? "#71717a", icon: a?.icon ?? "🏦" };
    })
    .sort((a, b) => b.value - a.value);
}

/** Ranking de estabelecimentos usando a descrição da transação. */
export function rankEstablishments(tx: TransactionRow[], limit = 10): RankItem[] {
  const acc = new Map<string, { name: string; value: number; count: number }>();
  for (const t of tx) {
    if (t.type !== "despesa" || !t.description) continue;
    const name = normalizeDescription(t.description);
    if (!name) continue;
    const key = name.toLowerCase();
    const prev = acc.get(key);
    acc.set(key, {
      name,
      value: (prev?.value ?? 0) + Number(t.amount),
      count: (prev?.count ?? 0) + 1,
    });
  }
  return [...acc.entries()]
    .map(([key, v]) => ({ key, name: v.name, value: v.value, meta: `${v.count} compra(s)` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function normalizeDescription(d: string): string {
  // Remove sufixos de parcela "(1/12)" e espaços redundantes.
  return d.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
}

/* ============================== Projeções ============================== */

export interface Projection {
  endOfMonthBalance: number;
  projectedIncome: number;
  projectedOutcome: number;
  projectedSavings: number;
  nextInvoicesEstimate: number;
  daysRemaining: number;
  daysElapsed: number;
}

/**
 * Projeta o fechamento do mês corrente a partir do ritmo até hoje.
 * Considera despesas pendentes e faturas futuras a vencer nos próximos 30 dias.
 */
export function projectCurrentMonth(
  monthTx: TransactionRow[],
  allTx: TransactionRow[],
  accounts: AccountRow[],
): Projection {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const totalDays = end.getDate();
  const daysElapsed = Math.max(1, now.getDate());
  const daysRemaining = Math.max(0, totalDays - daysElapsed);

  const range: Range = { from: start, to: end };
  const incRealized = income(monthTx, range);
  const outRealized = outcome(monthTx, range);

  const projectedIncome = (incRealized / daysElapsed) * totalDays;
  const projectedOutcome = (outRealized / daysElapsed) * totalDays;
  const projectedSavings = projectedIncome - projectedOutcome;

  // Faturas / vencimentos futuros (próximos 30 dias)
  const in30 = new Date(now.getTime());
  in30.setDate(in30.getDate() + 30);
  const nextInvoicesEstimate = allTx
    .filter(
      (t) =>
        t.type === "despesa" &&
        t.status === "pendente" &&
        t.due_date &&
        new Date(t.due_date + "T12:00:00") >= now &&
        new Date(t.due_date + "T12:00:00") <= in30,
    )
    .reduce((s, t) => s + Number(t.amount), 0);

  const currentBalance = totalBalance(accounts);
  const endOfMonthBalance = currentBalance + (projectedIncome - incRealized) - (projectedOutcome - outRealized);

  return {
    endOfMonthBalance,
    projectedIncome,
    projectedOutcome,
    projectedSavings,
    nextInvoicesEstimate,
    daysRemaining,
    daysElapsed,
  };
}

/* ============================ Saúde Financeira ============================ */

export interface HealthScore {
  score: number; // 0-100
  label: string;
  tone: "positive" | "neutral" | "warning" | "negative";
  breakdown: Array<{ key: string; label: string; score: number; hint: string }>;
  suggestions: string[];
}

export function computeHealthScore(input: {
  currentTx: TransactionRow[];
  allTx: TransactionRow[];
  cards: CardRow[];
  recurrences: RecurrenceRow[];
}): HealthScore {
  const { currentTx, allTx, cards, recurrences } = input;
  const inc = income(currentTx);
  const out = outcome(currentTx);
  const monthly = monthlyEvolution(allTx, 6);
  const avgInc = monthly.reduce((s, m) => s + m.receita, 0) / Math.max(1, monthly.length);

  const commitPct = inc > 0 ? Math.min(100, (out / inc) * 100) : out > 0 ? 100 : 0;
  const savRate = inc > 0 ? ((inc - out) / inc) * 100 : 0;
  const totalLimit = cards.reduce((s, c) => s + Number(c.credit_limit), 0);
  const usedLimit = committedOnCards(cards);
  const utilPct = totalLimit > 0 ? (usedLimit / totalLimit) * 100 : 0;
  const recurringExp = recurrences.filter((r) => r.type === "despesa" && r.status === "ativa");
  const recurringSum = recurringExp.reduce((s, r) => s + Number(r.amount), 0);
  const recurringOverIncome = avgInc > 0 ? (recurringSum / avgInc) * 100 : 0;
  const ratio = out > 0 ? inc / out : inc > 0 ? 2 : 1;

  // Critérios (0-100 cada, quanto maior melhor)
  const s1 = scoreCommitment(commitPct); // renda comprometida
  const s2 = scoreSavings(savRate);
  const s3 = scoreUtilization(utilPct);
  const s4 = scoreRecurring(recurringOverIncome);
  const s5 = scoreRatio(ratio);

  const score = Math.round(s1 * 0.25 + s2 * 0.3 + s3 * 0.2 + s4 * 0.1 + s5 * 0.15);
  const tone: HealthScore["tone"] =
    score >= 80 ? "positive" : score >= 60 ? "neutral" : score >= 40 ? "warning" : "negative";
  const label = score >= 80 ? "Excelente" : score >= 60 ? "Boa" : score >= 40 ? "Atenção" : "Crítica";

  const suggestions: string[] = [];
  if (commitPct > 80) suggestions.push("Sua renda está muito comprometida. Reveja despesas recorrentes.");
  if (savRate < 10) suggestions.push("Tente reservar pelo menos 10% da sua renda mensalmente.");
  if (utilPct > 60) suggestions.push("Reduza o uso do limite dos cartões para melhorar sua saúde financeira.");
  if (recurringOverIncome > 40) suggestions.push("Recorrências consomem parte significativa da renda — revise assinaturas.");
  if (ratio < 1) suggestions.push("Suas despesas superaram as receitas neste período.");
  if (suggestions.length === 0) suggestions.push("Continue mantendo o equilíbrio financeiro. Ótimo trabalho! ✨");

  return {
    score,
    label,
    tone,
    breakdown: [
      { key: "commit", label: "Renda comprometida", score: s1, hint: `${commitPct.toFixed(0)}% da renda em despesas` },
      { key: "sav", label: "Economia mensal", score: s2, hint: `${savRate.toFixed(0)}% de taxa de economia` },
      { key: "util", label: "Uso dos cartões", score: s3, hint: `${utilPct.toFixed(0)}% do limite utilizado` },
      { key: "rec", label: "Despesas recorrentes", score: s4, hint: `${recurringOverIncome.toFixed(0)}% da renda média` },
      { key: "ratio", label: "Receita × Despesa", score: s5, hint: `Razão ${ratio.toFixed(2)}x` },
    ],
    suggestions,
  };
}

function scoreCommitment(p: number): number {
  if (p <= 50) return 100;
  if (p >= 100) return 0;
  return Math.round(100 - ((p - 50) / 50) * 100);
}
function scoreSavings(p: number): number {
  if (p >= 30) return 100;
  if (p <= 0) return 0;
  return Math.round((p / 30) * 100);
}
function scoreUtilization(p: number): number {
  if (p <= 30) return 100;
  if (p >= 95) return 0;
  return Math.round(100 - ((p - 30) / 65) * 100);
}
function scoreRecurring(p: number): number {
  if (p <= 20) return 100;
  if (p >= 60) return 0;
  return Math.round(100 - ((p - 20) / 40) * 100);
}
function scoreRatio(r: number): number {
  if (r >= 1.5) return 100;
  if (r <= 0.5) return 0;
  return Math.round(((r - 0.5) / 1.0) * 100);
}

/* ========================= Comparativos utilitários ========================= */

export interface Comparison {
  label: string;
  current: number;
  previous: number;
  diff: number;
  pct: number;
  direction: "up" | "down" | "flat";
}

export function compare(label: string, current: number, previous: number): Comparison {
  const v = variation(current, previous);
  return { label, current, previous, diff: v.diff, pct: v.pct, direction: v.direction };
}

/* ============================ Janelas de tempo ============================ */

export type RangeKey = "7d" | "30d" | "90d" | "12m" | "all";

export function rangeFromKey(key: RangeKey, allTx: TransactionRow[]): Range {
  const to = new Date();
  if (key === "all") {
    const oldest = allTx.reduce<Date>((min, t) => {
      const d = new Date(t.occurred_at);
      return d < min ? d : min;
    }, new Date());
    return { from: oldest, to };
  }
  const from = new Date();
  if (key === "7d") from.setDate(from.getDate() - 7);
  else if (key === "30d") from.setDate(from.getDate() - 30);
  else if (key === "90d") from.setDate(from.getDate() - 90);
  else if (key === "12m") from.setMonth(from.getMonth() - 12);
  return { from, to };
}
