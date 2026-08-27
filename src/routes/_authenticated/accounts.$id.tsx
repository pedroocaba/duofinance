import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, ArrowRightLeft } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, type TransactionRow, type AccountRow } from "@/lib/finance-queries";
import { formatDateBR } from "@/lib/date-format";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard, EmptyChart, tooltipStyle } from "@/components/dashboard/chart-card";
import { monthlyEvolution, cumulativeCashflow, income, outcome, sum } from "@/lib/dashboard-metrics";

export const Route = createFileRoute("/_authenticated/accounts/$id")({
  component: AccountDetailPage,
});

function useAccount(id: string) {
  return useQuery({
    queryKey: ["account", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as AccountRow | null;
    },
  });
}

function useAccountTransactions(id: string) {
  return useQuery({
    queryKey: ["account-transactions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .or(`account_id.eq.${id},transfer_to_account_id.eq.${id}`)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TransactionRow[];
    },
  });
}

function AccountDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const account = useAccount(id);
  const txQ = useAccountTransactions(id);
  const tx = txQ.data ?? [];

  const inc = income(tx);
  const out = outcome(tx);
  const transfers = tx.filter((t) => t.type === "transferencia");
  const transferAmount = sum(transfers.map((t) => t.amount));

  const monthly = useMemo(() => monthlyEvolution(tx, 12), [tx]);
  const cashflow = useMemo(() => {
    // saldo cumulativo partindo do saldo inicial
    const initial = Number(account.data?.initial_balance ?? 0);
    let acc = initial;
    return monthly.map((p) => {
      acc += p.saldo;
      return { ...p, saldo_acumulado: acc };
    });
  }, [monthly, account.data?.initial_balance]);

  if (account.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!account.data)
    return (
      <div className="space-y-4">
        <BackButton onClick={() => navigate({ to: "/accounts" })} />
        <p className="text-sm text-muted-foreground">Conta não encontrada.</p>
      </div>
    );

  const a = account.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton onClick={() => navigate({ to: "/accounts" })} />
          <div
            className="grid size-12 place-items-center rounded-2xl text-2xl"
            style={{ background: `${a.color ?? "#71717a"}22`, color: a.color ?? "#71717a" }}
          >
            {a.icon ?? "🏦"}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{a.bank ?? a.type}</p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{a.nickname ?? a.name}</h1>
          </div>
        </div>
        <Link to="/transactions">
          <Button variant="outline" size="sm">Ver movimentações</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <KpiCard label="Saldo atual" value={formatCurrency(a.current_balance)} tone="highlight" />
        <KpiCard label="Entradas (total)" value={formatCurrency(inc)} tone="positive" icon={<ArrowUpRight className="size-4" />} />
        <KpiCard label="Saídas (total)" value={formatCurrency(out)} tone="negative" icon={<ArrowDownRight className="size-4" />} />
        <KpiCard label="Transferências" value={formatCurrency(transferAmount)} hint={`${transfers.length} operação(ões)`} icon={<ArrowRightLeft className="size-4" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Evolução do saldo" subtitle="Últimos 12 meses">
          {cashflow.length === 0 ? (
            <EmptyChart label="Sem histórico." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflow}>
                  <defs>
                    <linearGradient id="acc-balance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={a.color ?? "var(--chart-3)"} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={a.color ?? "var(--chart-3)"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => compact(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="saldo_acumulado" stroke={a.color ?? "var(--chart-3)"} fill="url(#acc-balance)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Entradas × Saídas" subtitle="Últimos 12 meses">
          {monthly.length === 0 ? (
            <EmptyChart label="Sem histórico." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => compact(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="receita" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="despesa" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Últimas movimentações">
        <div className="divide-y divide-border">
          {tx.slice(0, 15).length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Sem movimentações.</p>
          )}
          {tx.slice(0, 15).map((t) => {
            const positive = t.type === "receita" || (t.type === "transferencia" && t.transfer_to_account_id === id);
            return (
              <div key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.description ?? "—"}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t.type} · {formatDateBR(t.occurred_at)}
                  </p>
                </div>
                <p className={`font-semibold ${positive ? "text-money-positive" : "text-money-negative"}`}>
                  {positive ? "+" : "-"}
                  {formatCurrency(t.amount)}
                </p>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" onClick={onClick} aria-label="Voltar">
      <ArrowLeft className="size-4" />
    </Button>
  );
}

function compact(n: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
