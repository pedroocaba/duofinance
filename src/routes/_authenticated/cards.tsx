import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CreditCard, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCards, formatCurrency, type CardRow } from "@/lib/finance-queries";
import { useAppTheme } from "@/lib/theme-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { PageHeading, Field, EmptyState } from "./accounts";
import { formatDateBR } from "@/lib/date-format";
import { formatMonthYearBR } from "@/lib/installments";

export const Route = createFileRoute("/_authenticated/cards")({
  component: CardsPage,
});

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  bank: z.string().trim().max(60).optional(),
  brand: z.string().trim().max(30).optional(),
  credit_limit: z.coerce.number().min(0),
  closing_day: z.coerce.number().int().min(1).max(31).optional(),
  due_day: z.coerce.number().int().min(1).max(31).optional(),
  color: z.string().optional(),
  icon: z.string().max(4).optional(),
  scope: z.enum(["individual", "compartilhado"]),
});

function useCardTransactions(cardId: string | null) {
  return useQuery({
    queryKey: ["card-transactions", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("credit_card_id", cardId!)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function CardsPage() {
  const [open, setOpen] = useState(false);
  const [detailCard, setDetailCard] = useState<CardRow | null>(null);
  const cards = useCards();
  const { currentUserId, currentFamilyId, profiles, view, setView } = useAppTheme();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (v: z.infer<typeof schema>) => {
      const { error } = await supabase.from("credit_cards").insert({
        owner_id: currentUserId!,
        family_id: currentFamilyId!,
        name: v.name,
        bank: v.bank || null,
        brand: v.brand || null,
        credit_limit: v.credit_limit,
        available_limit: v.credit_limit,
        closing_day: v.closing_day ?? null,
        due_day: v.due_day ?? null,
        color: v.color || "#dc2626",
        icon: v.icon || "💳",
        scope: v.scope,
      });
      if (error) throw error;
      return v.scope;
    },
    onSuccess: (scope) => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      if (view === "family" && scope !== "compartilhado" && currentUserId) {
        setView(currentUserId);
      }
      toast.success("Cartão criado!");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    create.mutate(parsed.data);
  }

  return (
    <div className="space-y-6">
      <PageHeading title="Cartões de crédito" subtitle="Acompanhe limites, fechamento e vencimento.">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Novo cartão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar cartão</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome"><Input name="name" required maxLength={60} /></Field>
                <Field label="Banco"><Input name="bank" maxLength={60} /></Field>
                <Field label="Bandeira"><Input name="brand" maxLength={30} placeholder="Visa, Mastercard…" /></Field>
                <Field label="Limite (R$)"><Input name="credit_limit" type="number" step="0.01" required /></Field>
                <Field label="Fechamento (dia)"><Input name="closing_day" type="number" min={1} max={31} /></Field>
                <Field label="Vencimento (dia)"><Input name="due_day" type="number" min={1} max={31} /></Field>
                <Field label="Cor"><Input name="color" type="color" defaultValue="#dc2626" className="h-10 p-1" /></Field>
                <Field label="Ícone"><Input name="icon" maxLength={4} defaultValue="💳" /></Field>
                <Field label="Escopo">
                  <Select name="scope" defaultValue="individual">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="compartilhado">Compartilhado</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeading>

      {(cards.data ?? []).length === 0 ? (
        <EmptyState icon={<CreditCard className="size-8" />} label="Nenhum cartão cadastrado nesta visão." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {(cards.data ?? []).map((c) => {
            const limit = Number(c.credit_limit) || 0;
            const available = Number(c.available_limit) || 0;
            const used = limit - available;
            const pct = limit > 0 ? (used / limit) * 100 : 0;
            const owner = profiles.find((p) => p.id === c.owner_id);
            const critical = pct >= 95;
            const warning = pct >= 80 && pct < 95;
            return (
              <div key={c.id} className="card-surface overflow-hidden">
                <div
                  className="relative p-5 text-white"
                  style={{
                    background: `linear-gradient(135deg, ${c.color ?? "#dc2626"}, color-mix(in oklab, ${c.color ?? "#dc2626"} 40%, #000))`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="text-3xl">{c.icon ?? "💳"}</div>
                    <span className="text-[10px] uppercase tracking-widest opacity-80">{c.brand}</span>
                  </div>
                  <p className="mt-6 font-mono text-lg tracking-widest">•••• •••• •••• 0000</p>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-70">{owner?.name ?? "—"}</p>
                      <p className="text-sm font-semibold">{c.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest opacity-70">
                        Fech {c.closing_day ?? "—"} • Venc {c.due_day ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Utilizado</span>
                    <span className={`font-semibold ${critical ? "text-destructive" : warning ? "text-amber-600 dark:text-amber-400" : ""}`}>
                      {formatCurrency(used)} / {formatCurrency(limit)}
                    </span>
                  </div>
                  <Progress value={Math.min(100, pct)} />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Disponível</span>
                    <span className="font-medium">{formatCurrency(available)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setDetailCard(c)}>
                      Faturas
                    </Button>
                    <Link to="/cards/$id" params={{ id: c.id }} className="flex-1">
                      <Button size="sm" className="w-full">
                        Detalhes <ChevronRight className="size-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CardDetailDialog card={detailCard} onClose={() => setDetailCard(null)} />
    </div>
  );
}

function CardDetailDialog({ card, onClose }: { card: CardRow | null; onClose: () => void }) {
  const tx = useCardTransactions(card?.id ?? null);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof tx.data extends (infer U)[] | undefined ? U[] : never[]>();
    for (const t of tx.data ?? []) {
      const key = (t.invoice_month ?? t.occurred_at)?.slice(0, 7) ?? "sem-data";
      const arr = (map.get(key) as typeof tx.data) ?? [];
      arr.push(t);
      map.set(key, arr as never);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({
        key,
        total: (items as { amount: number | string }[]).reduce((s, i) => s + Number(i.amount), 0),
        items,
      }));
  }, [tx.data]);

  const nowKey = new Date().toISOString().slice(0, 7);
  const upcoming = grouped.filter((g) => g.key >= nowKey);
  const past = grouped.filter((g) => g.key < nowKey);
  const current = upcoming[0];
  const next = upcoming[1];

  return (
    <Dialog open={!!card} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{card?.icon} {card?.name}</DialogTitle>
          <DialogDescription>Faturas e compras.</DialogDescription>
        </DialogHeader>
        {card && (
          <Tabs defaultValue="current" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="current">Atual</TabsTrigger>
              <TabsTrigger value="next">Próxima</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="current">
              <InvoiceView group={current} emptyLabel="Sem lançamentos na fatura atual." />
            </TabsContent>
            <TabsContent value="next">
              <InvoiceView group={next} emptyLabel="Sem lançamentos na próxima fatura." />
            </TabsContent>
            <TabsContent value="history">
              {past.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem histórico ainda.</p>
              ) : (
                <div className="max-h-[400px] space-y-3 overflow-auto">
                  {past.slice().reverse().map((g) => (
                    <details key={g.key} className="card-surface p-3">
                      <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                        <span>{formatMonthYearBR(new Date(g.key + "-01T12:00:00"))}</span>
                        <span className="text-muted-foreground">{formatCurrency(g.total)}</span>
                      </summary>
                      <InvoiceItems items={g.items as never} />
                    </details>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InvoiceView({
  group,
  emptyLabel,
}: {
  group?: { key: string; total: number; items: unknown };
  emptyLabel: string;
}) {
  if (!group) return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-3">
        <span className="text-sm font-medium">{formatMonthYearBR(new Date(group.key + "-01T12:00:00"))}</span>
        <span className="text-sm font-semibold">{formatCurrency(group.total)}</span>
      </div>
      <InvoiceItems items={group.items as never} />
    </div>
  );
}

function InvoiceItems({ items }: { items: Array<{ id: string; occurred_at: string; description: string | null; amount: number | string; installment_number: number | null; installment_total: number | null; status: string }> }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2 max-h-[300px] divide-y divide-border overflow-auto">
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
              {t.status === "pendente" && " • pendente"}
            </p>
          </div>
          <p className="font-semibold text-money-negative">-{formatCurrency(t.amount)}</p>
        </div>
      ))}
    </div>
  );
}
