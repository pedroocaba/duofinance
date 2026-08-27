import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles, Trophy, TrendingUp, Target, HeartPulse, Store } from "lucide-react";
import {
  useAccounts,
  useCards,
  useCategories,
  useRecurrences,
  useTransactions,
  formatCurrency,
  type TransactionRow,
} from "@/lib/finance-queries";
import { useAppTheme } from "@/lib/theme-context";
import { supabase } from "@/integrations/supabase/client";
import { ChartCard, EmptyChart, tooltipStyle } from "@/components/dashboard/chart-card";
import { InsightGrid } from "@/components/dashboard/insight-card";
import { HealthGauge } from "@/components/dashboard/health-gauge";
import { CompareStat } from "@/components/dashboard/compare-stat";
import { cn } from "@/lib/utils";
import {
  compare,
  computeHealthScore,
  generateInsights,
  projectCurrentMonth,
  rankAccountsByMovement,
  rankCardsByLimitUtilization,
  rankCardsByUsage,
  rankCategoriesByExpense,
  rankCategoriesByIncome,
  rankEstablishments,
  weekdayChart,
  type RankItem,
} from "@/lib/insights";
import { income, monthRange, outcome } from "@/lib/dashboard-metrics";
import {
  usePeriod,
  inDateRange,
  isoDay,
  monthsInRange,
  type DateRange,
} from "@/lib/period-context";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const { profiles, view } = useAppTheme();
  const { range, previousRange, label: periodLabel } = usePeriod();

  const accounts = useAccounts();
  const cards = useCards();
  const categories = useCategories();
  const recurrences = useRecurrences();

  /**
   * Janela de busca: cobre o período selecionado E o período anterior
   * (necessário para os comparativos), com mínimo de 24 meses.
   */
  const wideFrom = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 23);
    d.setDate(1);
    return isoDay(previousRange.from < d ? previousRange.from : d);
  }, [previousRange]);
  const wideTo = useMemo(() => {
    const now = new Date();
    return isoDay(range.to > now ? range.to : now);
  }, [range]);
  const wide = useTransactions({ from: wideFrom, to: wideTo });
  const allTx = useMemo(() => wide.data ?? [], [wide.data]);

  // Raw (independente do filtro Família/Individual) para comparar pessoas.
  const rawTx = useQuery({
    queryKey: ["transactions-raw", wideFrom],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("occurred_at", wideFrom)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TransactionRow[];
    },
  });

  // Todo o BI abaixo respeita EXCLUSIVAMENTE o período global selecionado.
  const rangeTx = useMemo(
    () => allTx.filter((t) => inDateRange(t.occurred_at, range)),
    [allTx, range],
  );
  const previousRangeTx = useMemo(
    () => allTx.filter((t) => inDateRange(t.occurred_at, previousRange)),
    [allTx, previousRange],
  );

  const insights = useMemo(
    () =>
      generateInsights({
        currentTx: rangeTx,
        previousTx: previousRangeTx,
        allTx,
        accounts: accounts.data ?? [],
        cards: cards.data ?? [],
        categories: categories.data ?? [],
      }),
    [rangeTx, previousRangeTx, allTx, accounts.data, cards.data, categories.data],
  );

  // Rankings
  const rankExpCats = rankCategoriesByExpense(rangeTx, categories.data ?? []);
  const rankIncCats = rankCategoriesByIncome(rangeTx, categories.data ?? []);
  const rankCards = rankCardsByUsage(rangeTx, cards.data ?? []);
  const rankUtil = rankCardsByLimitUtilization(cards.data ?? []);
  const rankAccs = rankAccountsByMovement(rangeTx, accounts.data ?? []);
  const rankStores = rankEstablishments(rangeTx);

  // Evolução — buckets mensais limitados ao período selecionado
  const monthly = useMemo(() => monthlyBuckets(rangeTx, range), [rangeTx, range]);
  const equityChart = useMemo(() => buildEquityChart(monthly), [monthly]);
  const utilChart = useMemo(
    () => monthly.map((m) => ({ label: m.label, util: m.despesa })),
    [monthly],
  );
  const weekday = useMemo(() => weekdayChart(rangeTx), [rangeTx]);

  // Comparativos — período selecionado × período anterior de mesma duração
  const cmpOut = compare(`Despesas · ${periodLabel}`, outcome(rangeTx), outcome(previousRangeTx));
  const cmpInc = compare(`Receitas · ${periodLabel}`, income(rangeTx), income(previousRangeTx));
  const cmpBalance = compare(
    `Saldo do período · ${periodLabel}`,
    income(rangeTx) - outcome(rangeTx),
    income(previousRangeTx) - outcome(previousRangeTx),
  );

  // Por pessoa e Individual × Família — também dentro do período selecionado
  const rawAll = useMemo(() => rawTx.data ?? [], [rawTx.data]);
  const rawRange = useMemo(
    () => rawAll.filter((t) => inDateRange(t.occurred_at, range)),
    [rawAll, range],
  );
  const perPerson = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of rawRange) {
      if (t.type !== "despesa" || t.scope === "compartilhado") continue;
      m.set(t.owner_id, (m.get(t.owner_id) ?? 0) + Number(t.amount));
    }
    return profiles.map((p) => ({ id: p.id, name: p.name, color: p.color, value: m.get(p.id) ?? 0 }));
  }, [rawRange, profiles]);
  const familyValue = rawRange
    .filter((t) => t.type === "despesa" && t.scope === "compartilhado")
    .reduce((s, t) => s + Number(t.amount), 0);
  const individualValue = perPerson.reduce((s, p) => s + p.value, 0);

  // Projeções — por definição são sobre o mês corrente
  const monthTx = useMemo(
    () => allTx.filter((t) => inDateRange(t.occurred_at, toDateRange(monthRange(0)))),
    [allTx],
  );
  const projection = useMemo(
    () => projectCurrentMonth(monthTx, allTx, accounts.data ?? []),
    [monthTx, allTx, accounts.data],
  );

  // Saúde financeira — calculada sobre o período selecionado
  const health = useMemo(
    () =>
      computeHealthScore({
        currentTx: rangeTx,
        allTx,
        cards: cards.data ?? [],
        recurrences: recurrences.data ?? [],
      }),
    [rangeTx, allTx, cards.data, recurrences.data],
  );

  const viewLabel = view === "family" ? "Visão da Família" : `Visão de ${profiles.find((p) => p.id === view)?.name ?? ""}`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">BI Financeiro</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Análises & Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {viewLabel} · período: <span className="font-medium text-foreground">{periodLabel}</span>
          </p>
        </div>
      </div>


      {/* Saúde financeira */}
      <ChartCard
        title="Saúde Financeira"
        subtitle="Pontuação com base em cinco critérios do seu mês atual"
        action={
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
            <HeartPulse className="size-3" /> {health.label}
          </span>
        }
      >
        <HealthGauge health={health} />
        <div className="mt-5 rounded-2xl border border-dashed border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sugestões</p>
          <ul className="space-y-1.5">
            {health.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </ChartCard>

      {/* Insights automáticos */}
      <section className="space-y-3">
        <SectionHeader icon={<Sparkles className="size-4" />} title="Insights Financeiros" subtitle={`${insights.length} análises no período`} />
        <InsightGrid insights={insights} />
      </section>

      {/* Comparativos */}
      <section className="space-y-3">
        <SectionHeader icon={<TrendingUp className="size-4" />} title="Comparativos inteligentes" subtitle={`${periodLabel} × período anterior equivalente`} />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <CompareStat label={cmpOut.label} current={cmpOut.current} previous={cmpOut.previous} currentLabel="Período atual" previousLabel="Período anterior" invert />
          <CompareStat label={cmpInc.label} current={cmpInc.current} previous={cmpInc.previous} currentLabel="Período atual" previousLabel="Período anterior" />
          <CompareStat label={cmpBalance.label} current={cmpBalance.current} previous={cmpBalance.previous} currentLabel="Período atual" previousLabel="Período anterior" />
          <CompareStat
            label={`Individual × Família · ${periodLabel}`}
            current={individualValue}
            previous={familyValue}
            currentLabel="Individual"
            previousLabel="Família"
          />
        </div>
        {perPerson.length >= 2 && (
          <div className="grid gap-3 md:grid-cols-2">
            {perPerson.map((p, i) => {
              const other = perPerson[(i + 1) % perPerson.length];
              return (
                <CompareStat
                  key={p.id}
                  label={`${p.name} × ${other.name} (despesas do mês)`}
                  current={p.value}
                  previous={other.value}
                  currentLabel={p.name}
                  previousLabel={other.name}
                  invert
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Rankings */}
      <section className="space-y-3">
        <SectionHeader icon={<Trophy className="size-4" />} title="Rankings" subtitle="Top movimentações no período" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <RankingCard title="Maiores categorias de gasto" items={rankExpCats} formatValue={formatCurrency} />
          <RankingCard title="Maiores categorias de receita" items={rankIncCats} formatValue={formatCurrency} />
          <RankingCard title="Cartão mais utilizado" items={rankCards} formatValue={formatCurrency} />
          <RankingCard title="Cartão com maior uso de limite" items={rankUtil} formatValue={(v) => `${v.toFixed(0)}%`} />
          <RankingCard title="Conta com maior movimentação" items={rankAccs} formatValue={formatCurrency} />
          <RankingCard
            title="Estabelecimentos onde mais gastou"
            items={rankStores}
            formatValue={formatCurrency}
            icon={<Store className="size-3.5" />}
          />
        </div>
      </section>

      {/* Evolução */}
      <section className="space-y-3">
        <SectionHeader icon={<TrendingUp className="size-4" />} title="Evolução financeira" subtitle="Séries temporais dos últimos meses" />
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard title="Patrimônio (saldo acumulado)" subtitle="Fluxo líquido cumulativo">
            <EvolutionArea data={equityChart} dataKey="acumulado" color="var(--chart-3)" />
          </ChartCard>
          <ChartCard title="Saldo mensal (receita − despesa)" subtitle="Últimos 12 meses">
            <EvolutionLine data={monthly} dataKey="saldo" color="var(--chart-2)" />
          </ChartCard>
          <ChartCard title="Receitas" subtitle={periodLabel}>
            <EvolutionBar data={monthly} dataKey="receita" color="var(--chart-2)" />
          </ChartCard>
          <ChartCard title="Despesas" subtitle={periodLabel}>
            <EvolutionBar data={utilChart} dataKey="util" color="var(--chart-1)" />
          </ChartCard>
          <ChartCard title="Gastos por dia da semana" subtitle={`Período: ${periodLabel}`}>
            {weekday.every((w) => w.value === 0) ? (
              <EmptyChart label="Sem despesas neste período." />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekday}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={compactNum} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" fill="var(--chart-4)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
          <ChartCard title="Utilização dos cartões" subtitle="Situação atual dos limites">
            {(cards.data ?? []).length === 0 ? (
              <EmptyChart label="Nenhum cartão cadastrado." />
            ) : (
              <ul className="space-y-2.5">
                {(cards.data ?? []).map((c) => {
                  const used = Number(c.credit_limit) - Number(c.available_limit);
                  const p = c.credit_limit > 0 ? (used / Number(c.credit_limit)) * 100 : 0;
                  return (
                    <li key={c.id}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 truncate">
                          <span>{c.icon ?? "💳"}</span>
                          <span className="truncate font-medium">{c.name}</span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">{p.toFixed(0)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            p >= 95 ? "bg-rose-500" : p >= 80 ? "bg-amber-500" : "bg-emerald-500",
                          )}
                          style={{ width: `${Math.min(100, p)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ChartCard>
        </div>
      </section>

      {/* Projeções */}
      <section className="space-y-3">
        <SectionHeader icon={<Target className="size-4" />} title="Projeções para o fim do mês" subtitle={`${projection.daysElapsed}º dia · ${projection.daysRemaining} dia(s) restantes`} />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <ProjectionCard label="Saldo previsto" value={formatCurrency(projection.endOfMonthBalance)} hint="Considera ritmo atual" tone="highlight" />
          <ProjectionCard label="Receita prevista" value={formatCurrency(projection.projectedIncome)} tone="positive" />
          <ProjectionCard label="Despesa prevista" value={formatCurrency(projection.projectedOutcome)} tone="negative" />
          <ProjectionCard label="Economia prevista" value={formatCurrency(projection.projectedSavings)} tone={projection.projectedSavings >= 0 ? "positive" : "negative"} />
          <ProjectionCard label="Próximas faturas (30d)" value={formatCurrency(projection.nextInvoicesEstimate)} hint="Pendentes com vencimento" />
          <ProjectionCard label="Fluxo de caixa previsto" value={formatCurrency(projection.projectedIncome - projection.projectedOutcome - projection.nextInvoicesEstimate)} hint="Após pagar faturas" />
        </div>
      </section>
    </div>
  );
}

/* ============================ Componentes internos ============================ */

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
          {title}
        </h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}


function RankingCard({
  title,
  items,
  formatValue,
  icon,
}: {
  title: string;
  items: RankItem[];
  formatValue: (n: number) => string;
  icon?: React.ReactNode;
}) {
  const max = items[0]?.value ?? 0;
  return (
    <ChartCard title={title} subtitle={items.length === 0 ? "Sem dados" : `${items.length} item(ns)`}>
      {items.length === 0 ? (
        <EmptyChart label="Sem dados para o período." />
      ) : (
        <ol className="space-y-2">
          {items.slice(0, 6).map((it, i) => {
            const p = max > 0 ? (it.value / max) * 100 : 0;
            return (
              <li key={it.key}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-5 place-items-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    {it.icon ? <span>{it.icon}</span> : icon}
                    <span className="truncate font-medium">{it.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold">{formatValue(it.value)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, p)}%`, background: it.color ?? "var(--primary)" }}
                  />
                </div>
                {it.meta && <p className="mt-0.5 text-[10px] text-muted-foreground">{it.meta}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </ChartCard>
  );
}

function ProjectionCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "highlight";
}) {
  const highlight = tone === "highlight";
  return (
    <div
      className={cn(
        "card-surface p-4",
        highlight && "border-primary bg-primary text-primary-foreground",
      )}
    >
      <p className={cn("text-xs", highlight ? "opacity-80" : "text-muted-foreground")}>{label}</p>
      <p
        className={cn(
          "mt-2 text-xl font-semibold tracking-tight",
          !highlight && tone === "positive" && "text-money-positive",
          !highlight && tone === "negative" && "text-money-negative",
        )}
      >
        {value}
      </p>
      {hint && <p className={cn("mt-1 text-[11px]", highlight ? "opacity-70" : "text-muted-foreground")}>{hint}</p>}
    </div>
  );
}

function EvolutionArea({ data, dataKey, color }: { data: unknown[]; dataKey: string; color: string }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.5} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={compactNum} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#g-${dataKey})`} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function EvolutionLine({ data, dataKey, color }: { data: unknown[]; dataKey: string; color: string }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={compactNum} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EvolutionBar({ data, dataKey, color }: { data: unknown[]; dataKey: string; color: string }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={compactNum} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
          <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ============================ Utilidades locais ============================ */

/** Converte um intervalo em strings ISO (helper de dashboard-metrics) para Date. */
function toDateRange(r: { from: Date; to: Date }): DateRange {
  return { from: r.from, to: r.to };
}

interface MonthBucket {
  key: string;
  label: string;
  receita: number;
  despesa: number;
  saldo: number;
}

/**
 * Buckets mensais estritamente dentro do período selecionado.
 * Nenhum gráfico pode considerar dados fora do intervalo escolhido.
 */
function monthlyBuckets(tx: TransactionRow[], range: DateRange): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>();
  const total = monthsInRange(range);
  const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
  for (let i = 0; i < total; i++) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
    buckets.set(key, { key, label, receita: 0, despesa: 0, saldo: 0 });
  }
  for (const t of tx) {
    const key = t.occurred_at.slice(0, 7);
    const b = buckets.get(key);
    if (!b) continue;
    if (t.type === "receita") b.receita += Number(t.amount);
    else if (t.type === "despesa") b.despesa += Number(t.amount);
  }
  for (const b of buckets.values()) b.saldo = b.receita - b.despesa;
  return Array.from(buckets.values());
}

function buildEquityChart(monthly: Array<{ label: string; saldo: number }>) {
  let acc = 0;
  return monthly.map((m) => {
    acc += m.saldo;
    return { label: m.label, acumulado: acc };
  });
}


function compactNum(n: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
