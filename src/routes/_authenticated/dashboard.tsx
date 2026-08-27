import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  PiggyBank,
  Wallet as WalletIcon,
  Sparkles,
  CreditCard as CreditCardIcon,
  CalendarClock,
  AlertCircle,
  Zap,
  Repeat2,
  Tags as TagsIcon,
  ChevronRight,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  useAccounts,
  useCards,
  useCategories,
  useTransactions,
  formatCurrency,
} from "@/lib/finance-queries";
import { useGoals, recommendMonthly } from "@/lib/goals-queries";
import { useAppTheme } from "@/lib/theme-context";
import { usePeriod, inDateRange, isoDay } from "@/lib/period-context";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { useAlerts } from "@/lib/alerts";
import {
  income,
  outcome,
  totalBalance,
  committedOnCards,
  upcomingBills,
  pendingExpenses,
} from "@/lib/dashboard-metrics";
import { formatDateBR } from "@/lib/date-format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { view, viewedProfile, currentProfile, themeName } = useAppTheme();
  const { range, label: currentLabel } = usePeriod();

  const accounts = useAccounts();
  const cards = useCards();
  const categories = useCategories();
  const goals = useGoals();

  /**
   * Janela ampla de busca: cobre o período selecionado (mesmo retroativo) e
   * também 12 meses à frente, para que vencimentos futuros apareçam.
   */
  const { wideFrom, wideTo } = useMemo(() => {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const from = range.from < defaultFrom ? range.from : defaultFrom;
    const ahead = new Date(now.getFullYear(), now.getMonth() + 12, 1);
    const to = range.to > ahead ? range.to : ahead;
    return { wideFrom: isoDay(from), wideTo: isoDay(to) };
  }, [range]);

  const wide = useTransactions({ from: wideFrom, to: wideTo });
  const allTx = useMemo(() => wide.data ?? [], [wide.data]);

  const currentTx = useMemo(
    () => allTx.filter((t) => inDateRange(t.occurred_at, range)),
    [allTx, range],
  );

  const balance = totalBalance(accounts.data ?? []);
  const inc = income(currentTx);
  const out = outcome(currentTx);
  const savingsPct = inc > 0 ? Math.max(0, ((inc - out) / inc) * 100) : 0;
  const committed = committedOnCards(cards.data ?? []);
  const bills = upcomingBills(allTx, 30);
  const pending = pendingExpenses(currentTx);

  const heading = view === "family" ? "Visão da Família" : `Olá, ${viewedProfile?.name ?? currentProfile?.name ?? ""}`;
  const subtitle =
    view === "family"
      ? "Somando tudo o que a família compartilha"
      : themeName === "cute"
        ? "Seus mimos, sonhos e conquistas ✨"
        : "Seus números — sem enfeite";


  const alertsData = useAlerts();

  const activeGoals = (goals.data ?? []).filter((g) => g.status === "ativa");
  const goalsSorted = [...activeGoals].sort((a, b) => {
    const pa = (Number(a.current_amount) / Number(a.target_amount)) || 0;
    const pb = (Number(b.current_amount) / Number(b.target_amount)) || 0;
    return pb - pa;
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">

          <Link to="/insights">
            <Button variant="outline" className="gap-1">
              <Sparkles className="size-4" /> Análises completas
            </Button>
          </Link>
          <Link to="/transactions">
            <Button>
              <Plus className="size-4" />
              Nova
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs primários — clicáveis, levam à página de Análises */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <KpiLink to="/insights"><KpiCard label="Saldo total" value={formatCurrency(balance)} icon={<WalletIcon className="size-4" />} /></KpiLink>
        <KpiLink to="/insights"><KpiCard label="Patrimônio" value={formatCurrency(balance)} hint="Saldos + investimentos" icon={<Sparkles className="size-4" />} tone="highlight" /></KpiLink>
        <KpiLink to="/insights"><KpiCard label={`Entradas · ${currentLabel}`} value={formatCurrency(inc)} tone="positive" icon={<ArrowUpRight className="size-4" />} /></KpiLink>
        <KpiLink to="/insights"><KpiCard label={`Saídas · ${currentLabel}`} value={formatCurrency(out)} tone="negative" icon={<ArrowDownRight className="size-4" />} /></KpiLink>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <KpiLink to="/insights"><KpiCard label="Economia" value={`${savingsPct.toFixed(0)}%`} hint="Do que entrou, sobrou" icon={<PiggyBank className="size-4" />} /></KpiLink>
        <KpiLink to="/cards"><KpiCard label="Comprometido em cartões" value={formatCurrency(committed)} icon={<CreditCardIcon className="size-4" />} /></KpiLink>
        <KpiLink to="/transactions"><KpiCard label="Contas a vencer (30d)" value={String(bills.length)} hint={bills.length > 0 ? formatCurrency(bills.reduce((s, b) => s + Number(b.amount), 0)) : "—"} icon={<CalendarClock className="size-4" />} /></KpiLink>
        <KpiLink to="/transactions"><KpiCard label="Despesas pendentes" value={String(pending.length)} hint={pending.length > 0 ? formatCurrency(pending.reduce((s, b) => s + Number(b.amount), 0)) : "—"} icon={<AlertCircle className="size-4" />} /></KpiLink>
      </div>

      {/* Resumo de metas */}
      <ChartCard
        title="Metas em andamento"
        subtitle={activeGoals.length > 0 ? `${activeGoals.length} meta(s) ativa(s)` : "Crie sua primeira meta"}
        action={
          <Link to="/goals" className="text-xs text-muted-foreground hover:text-foreground">
            Ver todas →
          </Link>
        }
      >
        {activeGoals.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Target className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>
            <Link to="/goals">
              <Button size="sm"><Plus className="size-3" /> Criar meta</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {goalsSorted.slice(0, 3).map((g) => {
              const pct = Number(g.target_amount) > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0;
              const rec = recommendMonthly(g);
              return (
                <Link
                  key={g.id}
                  to="/goals"
                  className="rounded-xl border border-border p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{g.icon ?? "🎯"}</span>
                    <p className="truncate flex-1 text-sm font-medium">{g.name}</p>
                    <span className="text-xs font-bold text-primary">{pct.toFixed(0)}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatCurrency(g.current_amount)} / {formatCurrency(g.target_amount)}
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%`, background: g.color ?? "var(--primary)" }} />
                  </div>
                  {rec && rec.monthly > 0 && (
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <TrendingUp className="size-3" /> {formatCurrency(rec.monthly)}/mês · {rec.months}m
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </ChartCard>

      {/* Grid: Vencimentos + Alertas + Atalhos */}
      <div className="grid gap-4 md:grid-cols-3">
        <ChartCard title="Próximos vencimentos" subtitle="Nos próximos 30 dias">
          {bills.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nada a pagar por enquanto ✨</p>
          ) : (
            <ul className="divide-y divide-border">
              {bills.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.description ?? "—"}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {formatDateBR(b.due_date!)}
                    </p>
                  </div>
                  <p className="font-semibold text-money-negative">{formatCurrency(b.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard title="Alertas" subtitle={`${alertsData.count} ativo(s)`}>
          {alertsData.alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Tudo tranquilo por aqui.</p>
          ) : (
            <ul className="space-y-2">
              {alertsData.alerts.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-start gap-2 rounded-xl border border-border p-2.5">
                  <span className={`mt-0.5 size-2 shrink-0 rounded-full ${
                    a.severity === "critical" ? "bg-destructive" : a.severity === "warning" ? "bg-amber-500" : "bg-primary"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{a.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{a.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard title="Atalhos rápidos">
          <div className="grid grid-cols-2 gap-2">
            <QuickAction to="/transactions" icon={<Plus className="size-4" />} label="Nova movimentação" />
            <QuickAction to="/goals" icon={<Target className="size-4" />} label="Metas" />
            <QuickAction to="/recurrences" icon={<Repeat2 className="size-4" />} label="Recorrentes" />
            <QuickAction to="/accounts" icon={<WalletIcon className="size-4" />} label="Contas" />
            <QuickAction to="/cards" icon={<CreditCardIcon className="size-4" />} label="Cartões" />
            <QuickAction to="/categories" icon={<TagsIcon className="size-4" />} label="Categorias" />
          </div>
        </ChartCard>
      </div>

      {/* Contas + Últimas movimentações */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard
          title="Contas & cartões"
          action={
            <Link to="/accounts" className="text-xs text-muted-foreground hover:text-foreground">
              Ver todas →
            </Link>
          }
        >
          <div className="space-y-2">
            {(accounts.data ?? []).slice(0, 3).map((a) => (
              <Link
                key={a.id}
                to="/accounts/$id"
                params={{ id: a.id }}
                className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg text-lg"
                    style={{ background: `${a.color ?? "#71717a"}22`, color: a.color ?? "#71717a" }}>
                    {a.icon ?? "🏦"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{a.nickname ?? a.name}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{a.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{formatCurrency(a.current_balance)}</p>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
            {(cards.data ?? []).slice(0, 2).map((c) => {
              const used = Number(c.credit_limit) - Number(c.available_limit);
              const pct = c.credit_limit > 0 ? (used / Number(c.credit_limit)) * 100 : 0;
              return (
                <Link
                  key={c.id}
                  to="/cards/$id"
                  params={{ id: c.id }}
                  className="block rounded-xl border border-border p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-lg text-lg"
                        style={{ background: `${c.color ?? "#71717a"}22`, color: c.color ?? "#71717a" }}>
                        {c.icon ?? "💳"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.brand}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(used)} / {formatCurrency(c.credit_limit)}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, pct)}%`, background: c.color ?? "#71717a" }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </ChartCard>

        <ChartCard
          title="Últimas movimentações"
          action={
            <Link to="/transactions" className="text-xs text-muted-foreground hover:text-foreground">
              Ver todas →
            </Link>
          }
        >
          <div className="divide-y divide-border">
            {currentTx.slice(0, 6).length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">Sem movimentações neste período.</p>
            )}
            {currentTx.slice(0, 6).map((t) => {
              const cat = (categories.data ?? []).find((c) => c.id === t.category_id);
              const positive = t.type === "receita";
              return (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-full text-lg" style={{ background: `${cat?.color ?? "#71717a"}22` }}>
                      {cat?.icon ?? "💰"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.description || cat?.name || "Sem descrição"}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t.scope === "compartilhado" ? "Compartilhado" : "Individual"} · {formatDateBR(t.occurred_at)}
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${positive ? "text-money-positive" : "text-money-negative"}`}>
                    {positive ? "+" : "-"}
                    {formatCurrency(t.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function KpiLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="block transition-transform hover:-translate-y-0.5">
      {children}
    </Link>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-2 rounded-xl border border-border p-3 text-xs font-medium transition-all hover:border-primary/40 hover:bg-accent"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </span>
      <span className="truncate">{label}</span>
      <Zap className="ml-auto size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
