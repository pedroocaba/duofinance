import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, type TransactionRow, type CardRow } from "@/lib/finance-queries";
import { useCategories } from "@/lib/finance-queries";
import { formatDateBR } from "@/lib/date-format";
import { formatMonthYearBR } from "@/lib/installments";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard, EmptyChart, CHART_COLORS, tooltipStyle } from "@/components/dashboard/chart-card";
import { groupByCategory, monthlyEvolution } from "@/lib/dashboard-metrics";

export const Route = createFileRoute("/_authenticated/cards/$id")({
  component: CardDetailPage,
});

function useCard(id: string) {
  return useQuery({
    queryKey: ["card", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_cards").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as CardRow | null;
    },
  });
}

function useCardTransactions(id: string) {
  return useQuery({
    queryKey: ["card-transactions-full", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("credit_card_id", id)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TransactionRow[];
    },
  });
}

function CardDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const card = useCard(id);
  const txQ = useCardTransactions(id);
  const cats = useCategories();
  const tx = txQ.data ?? [];

  const monthly = useMemo(() => monthlyEvolution(tx, 12), [tx]);
  const catBreakdown = useMemo(() => groupByCategory(tx, cats.data ?? []).slice(0, 8), [tx, cats.data]);
  const installments = useMemo(() => tx.filter((t) => t.installment_group_id), [tx]);

  const invoices = useMemo(() => {
    const map = new Map<string, TransactionRow[]>();
    for (const t of tx) {
      const key = (t.invoice_month ?? t.occurred_at).slice(0, 7);
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        total: items.reduce((s, i) => s + Number(i.amount), 0),
        items,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [tx]);

  if (card.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!card.data)
    return (
      <div className="space-y-4">
        <BackButton onClick={() => navigate({ to: "/cards" })} />
        <p className="text-sm text-muted-foreground">Cartão não encontrado.</p>
      </div>
    );

  const c = card.data;
  const limit = Number(c.credit_limit) || 0;
  const available = Number(c.available_limit) || 0;
  const used = limit - available;
  const pct = limit > 0 ? (used / limit) * 100 : 0;

  const nowKey = new Date().toISOString().slice(0, 7);
  const upcoming = invoices.filter((g) => g.key >= nowKey);
  const past = invoices.filter((g) => g.key < nowKey);
  const currentInv = upcoming[0];
  const nextInv = upcoming[1];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton onClick={() => navigate({ to: "/cards" })} />
          <div
            className="grid size-12 place-items-center rounded-2xl text-2xl"
            style={{ background: `${c.color ?? "#71717a"}22`, color: c.color ?? "#71717a" }}
          >
            {c.icon ?? "💳"}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{c.brand ?? c.bank ?? "Cartão"}</p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{c.name}</h1>
          </div>
        </div>
        <Link to="/transactions">
          <Button variant="outline" size="sm">Nova compra</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <KpiCard label="Limite total" value={formatCurrency(limit)} tone="highlight" />
        <KpiCard label="Utilizado" value={formatCurrency(used)} hint={`${pct.toFixed(0)}%`} tone="negative" />
        <KpiCard label="Disponível" value={formatCurrency(available)} tone="positive" />
        <KpiCard label="Parcelas ativas" value={String(new Set(installments.map((i) => i.installment_group_id)).size)} icon={<Layers className="size-4" />} />
      </div>

      <div className="card-surface p-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Uso do limite</span>
          <span className="font-semibold">{formatCurrency(used)} / {formatCurrency(limit)}</span>
        </div>
        <Progress value={Math.min(100, pct)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Evolução dos gastos" subtitle="Últimos 12 meses">
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
                  <Bar dataKey="despesa" fill={c.color ?? "var(--chart-1)"} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Gastos por categoria">
          {catBreakdown.length === 0 ? (
            <EmptyChart label="Sem despesas." />
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={catBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {catBreakdown.map((e, i) => (
                        <Cell key={e.key} fill={e.color === "#71717a" ? CHART_COLORS[i % CHART_COLORS.length] : e.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5 text-xs">
                {catBreakdown.slice(0, 5).map((cb) => (
                  <li key={cb.key} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span>{cb.icon}</span>{cb.name}
                    </span>
                    <span className="font-medium">{formatCurrency(cb.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Faturas">
        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="current">Atual</TabsTrigger>
            <TabsTrigger value="next">Próxima</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="current" className="mt-3">
            <InvoiceView group={currentInv} emptyLabel="Sem lançamentos na fatura atual." />
          </TabsContent>
          <TabsContent value="next" className="mt-3">
            <InvoiceView group={nextInv} emptyLabel="Sem lançamentos na próxima fatura." />
          </TabsContent>
          <TabsContent value="history" className="mt-3">
            {past.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem histórico ainda.</p>
            ) : (
              <div className="space-y-3">
                {past.slice().reverse().map((g) => (
                  <details key={g.key} className="rounded-xl border border-border p-3">
                    <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                      <span>{formatMonthYearBR(new Date(g.key + "-01T12:00:00"))}</span>
                      <span className="text-muted-foreground">{formatCurrency(g.total)}</span>
                    </summary>
                    <InvoiceItems items={g.items} />
                  </details>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </ChartCard>

      <ChartCard title="Compras parceladas">
        {installments.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nenhuma compra parcelada.</p>
        ) : (
          <div className="divide-y divide-border">
            {installments.slice(0, 12).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">
                    {t.description ?? "—"}{" "}
                    {t.installment_number && t.installment_total && (
                      <span className="ml-1 text-[10px] text-primary">
                        {t.installment_number}/{t.installment_total}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {formatDateBR(t.occurred_at)} · {t.status}
                  </p>
                </div>
                <p className="font-semibold text-money-negative">-{formatCurrency(t.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function InvoiceView({ group, emptyLabel }: { group?: { key: string; total: number; items: TransactionRow[] }; emptyLabel: string }) {
  if (!group) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-3">
        <span className="text-sm font-medium">{formatMonthYearBR(new Date(group.key + "-01T12:00:00"))}</span>
        <span className="text-sm font-semibold">{formatCurrency(group.total)}</span>
      </div>
      <InvoiceItems items={group.items} />
    </div>
  );
}

function InvoiceItems({ items }: { items: TransactionRow[] }) {
  return (
    <div className="max-h-[300px] divide-y divide-border overflow-auto">
      {items.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate">
              {t.description ?? "—"}
              {t.installment_number && t.installment_total && (
                <span className="ml-1 text-[10px] text-primary">
                  {t.installment_number}/{t.installment_total}
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatDateBR(t.occurred_at)}
              {t.status === "pendente" && " · pendente"}
            </p>
          </div>
          <p className="font-semibold text-money-negative">-{formatCurrency(t.amount)}</p>
        </div>
      ))}
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
