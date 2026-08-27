import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowRightLeft, Trash2, Layers, Filter, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useTransactions,
  useAccounts,
  useCards,
  useCategories,
  formatCurrency,
} from "@/lib/finance-queries";
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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { PageHeading, Field, EmptyState } from "./accounts";
import { buildInstallmentsPreview, formatMonthYearBR } from "@/lib/installments";
import { formatDateBR, todayISO } from "@/lib/date-format";
import { friendlyAuthError } from "@/lib/auth-errors";
import { parseTags } from "@/lib/tags";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

type TxType = "receita" | "despesa" | "transferencia";
type ScopeMode = "este" | "este_e_proximos" | "todos";

const schema = z.object({
  type: z.enum(["receita", "despesa", "transferencia"]),
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  occurred_at: z.string(),
  description: z.string().trim().max(120).optional(),
  category_id: z.string().uuid().optional().or(z.literal("")),
  account_id: z.string().uuid().optional().or(z.literal("")),
  transfer_to_account_id: z.string().uuid().optional().or(z.literal("")),
  credit_card_id: z.string().uuid().optional().or(z.literal("")),
  payment_method: z.string().max(30).optional(),
  scope: z.enum(["individual", "compartilhado"]),
  notes: z.string().max(500).optional(),
  tags: z.string().max(300).optional(),
});

interface Filters {
  search: string;
  from: string;
  to: string;
  account: string;
  card: string;
  category: string;
  tag: string;
  owner: string;
  type: string;
  status: string;
  minAmount: string;
  maxAmount: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  from: "",
  to: "",
  account: "all",
  card: "all",
  category: "all",
  tag: "",
  owner: "all",
  type: "all",
  status: "all",
  minAmount: "",
  maxAmount: "",
};

function TransactionsPage() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxType>("despesa");
  const [installments, setInstallments] = useState(1);
  const [previewAmount, setPreviewAmount] = useState(0);
  const [previewDate, setPreviewDate] = useState<string>(todayISO());
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    groupId: string | null;
    number: number | null;
  } | null>(null);
  const [deleteMode, setDeleteMode] = useState<ScopeMode>("este");

  const txs = useTransactions();
  const accounts = useAccounts();
  const cards = useCards();
  const categories = useCategories();
  const { currentUserId, currentFamilyId, profiles } = useAppTheme();
  const qc = useQueryClient();

  const filteredCategories = useMemo(
    () =>
      (categories.data ?? []).filter((c) =>
        type === "receita" ? c.kind === "receita" : c.kind === "despesa",
      ),
    [categories.data, type],
  );

  const selectedCard = useMemo(
    () => (cards.data ?? []).find((c) => c.id === selectedCardId) ?? null,
    [cards.data, selectedCardId],
  );

  const preview = useMemo(() => {
    if (type !== "despesa" || !selectedCard || installments < 2 || previewAmount <= 0) return [];
    return buildInstallmentsPreview(
      previewAmount,
      installments,
      new Date(previewDate + "T12:00:00"),
      selectedCard.closing_day,
      selectedCard.due_day,
    );
  }, [type, selectedCard, installments, previewAmount, previewDate]);

  function resetForm() {
    setType("despesa");
    setInstallments(1);
    setPreviewAmount(0);
    setPreviewDate(todayISO());
    setSelectedCardId("");
  }


  const filtersActiveCount = useMemo(() => {
    let n = 0;
    if (filters.from) n++;
    if (filters.to) n++;
    if (filters.account !== "all") n++;
    if (filters.card !== "all") n++;
    if (filters.category !== "all") n++;
    if (filters.owner !== "all") n++;
    if (filters.type !== "all") n++;
    if (filters.status !== "all") n++;
    if (filters.tag.trim()) n++;
    if (filters.minAmount) n++;
    if (filters.maxAmount) n++;
    return n;
  }, [filters]);

  const filteredTxs = useMemo(() => {
    const rows = txs.data ?? [];
    const cats = categories.data ?? [];
    const search = filters.search.trim().toLowerCase();
    const tag = filters.tag.trim().toLowerCase();
    const min = filters.minAmount ? Number(filters.minAmount) : null;
    const max = filters.maxAmount ? Number(filters.maxAmount) : null;
    return rows.filter((t) => {
      if (filters.from && t.occurred_at < filters.from) return false;
      if (filters.to && t.occurred_at > filters.to) return false;
      if (filters.type !== "all" && t.type !== filters.type) return false;
      if (filters.status !== "all" && t.status !== filters.status) return false;
      if (filters.account !== "all" && t.account_id !== filters.account) return false;
      if (filters.card !== "all" && t.credit_card_id !== filters.card) return false;
      if (filters.category !== "all" && t.category_id !== filters.category) return false;
      if (filters.owner !== "all" && t.owner_id !== filters.owner) return false;
      if (tag && !(t.tags ?? []).some((x) => x.toLowerCase().includes(tag))) return false;
      if (min != null && Number(t.amount) < min) return false;
      if (max != null && Number(t.amount) > max) return false;
      if (search) {
        const cat = cats.find((c) => c.id === t.category_id);
        const hay = [
          t.description,
          cat?.name,
          (t.tags ?? []).join(" "),
          t.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [txs.data, categories.data, filters]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["cards"] });
  };


  const create = useMutation({
    mutationFn: async (v: z.infer<typeof schema>) => {
      const tagsArr = parseTags(v.tags);
      // Compra parcelada em cartão
      if (v.type === "despesa" && v.credit_card_id && installments > 1) {
        const { data: groupId, error } = await supabase.rpc("create_installment_purchase", {
          p_credit_card_id: v.credit_card_id,
          p_total_amount: v.amount,
          p_installments: installments,
          p_purchase_date: v.occurred_at,
          p_description: v.description ?? "",
          p_category_id: v.category_id || (null as unknown as string),
          p_scope: v.scope,
          p_notes: v.notes ?? "",
        });
        if (error) throw error;
        if (tagsArr.length > 0 && groupId) {
          await supabase
            .from("transactions")
            .update({ tags: tagsArr })
            .eq("installment_group_id", groupId as string);
        }
        return;
      }

      // Movimentação normal
      const { error } = await supabase.from("transactions").insert({
        owner_id: currentUserId!,
        family_id: currentFamilyId!,
        type: v.type,
        amount: v.amount,
        occurred_at: v.occurred_at,
        description: v.description || null,
        category_id: v.category_id || null,
        account_id: v.account_id || null,
        transfer_to_account_id: v.transfer_to_account_id || null,
        credit_card_id: v.credit_card_id || null,
        payment_method: v.payment_method || null,
        scope: v.scope,
        notes: v.notes || null,
        tags: tagsArr.length > 0 ? tagsArr : null,
        status: "paga",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success(installments > 1 ? `Compra em ${installments}x lançada!` : "Movimentação salva!");
      setOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(friendlyAuthError(e)),
  });

  const removeSingle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Movimentação removida.");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(friendlyAuthError(e)),
  });

  const removeGroup = useMutation({
    mutationFn: async (args: { groupId: string; number: number; mode: ScopeMode }) => {
      const { error } = await supabase.rpc("delete_installment_group", {
        p_group_id: args.groupId,
        p_current_number: args.number,
        p_mode: args.mode,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Parcelas removidas.");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(friendlyAuthError(e)),
  });

  const markPaid = useMutation({
    mutationFn: async (args: { id: string; status: "paga" | "pendente" }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ status: args.status })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
    onError: (e: Error) => toast.error(friendlyAuthError(e)),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    create.mutate(parsed.data);
  }

  function askDelete(t: {
    id: string;
    installment_group_id: string | null;
    installment_number: number | null;
  }) {
    setDeleteMode("este");
    setDeleteTarget({
      id: t.id,
      groupId: t.installment_group_id,
      number: t.installment_number,
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.groupId && deleteTarget.number != null) {
      removeGroup.mutate({
        groupId: deleteTarget.groupId,
        number: deleteTarget.number,
        mode: deleteMode,
      });
    } else {
      removeSingle.mutate(deleteTarget.id);
    }
  }

  const isPending = create.isPending;
  const cardOptions = cards.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeading title="Movimentações" subtitle="Receitas, despesas, transferências e parcelamentos.">
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Nova
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova movimentação</DialogTitle>
              <DialogDescription>
                Registre uma receita, despesa (à vista ou parcelada) ou transferência.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(["receita", "despesa", "transferencia"] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => {
                      setType(t);
                      if (t !== "despesa") {
                        setInstallments(1);
                        setSelectedCardId("");
                      }
                    }}
                    className={`rounded-xl border px-3 py-2 text-sm capitalize transition-colors ${
                      type === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {t === "transferencia" ? "Transferência" : t}
                  </button>
                ))}
              </div>
              <input type="hidden" name="type" value={type} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor (R$)">
                  <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    inputMode="decimal"
                    onChange={(e) => setPreviewAmount(Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Data">
                  <Input
                    name="occurred_at"
                    type="date"
                    required
                    defaultValue={todayISO()}
                    onChange={(e) => setPreviewDate(e.target.value || todayISO())}
                  />
                </Field>
                <Field label="Descrição">
                  <Input name="description" maxLength={120} placeholder="Ex.: Mercado, aluguel…" />
                </Field>
                <Field label="Escopo">
                  <Select name="scope" defaultValue="individual">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="compartilhado">Compartilhado</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {type !== "transferencia" && (
                  <Field label="Categoria">
                    <Select name="category_id">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <Field label="Conta">
                  <Select name="account_id">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {(accounts.data ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.icon} {a.nickname ?? a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {type === "transferencia" && (
                  <Field label="Conta destino">
                    <Select name="transfer_to_account_id">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {(accounts.data ?? []).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.icon} {a.nickname ?? a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {type === "despesa" && (
                  <Field label="Cartão (opcional)">
                    <Select
                      name="credit_card_id"
                      value={selectedCardId}
                      onValueChange={(v) => {
                        setSelectedCardId(v);
                        if (!v) setInstallments(1);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        {cardOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <Field label="Forma de pagamento">
                  <Input
                    name="payment_method"
                    placeholder="Pix, Débito, Crédito…"
                    maxLength={30}
                  />
                </Field>
              </div>

              {type === "despesa" && selectedCard && (
                <div className="rounded-xl border border-border bg-secondary/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Layers className="size-4" />
                      Compra parcelada
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Parcelas</label>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={installments}
                        onChange={(e) =>
                          setInstallments(Math.min(60, Math.max(1, Number(e.target.value) || 1)))
                        }
                        className="h-8 w-20"
                      />
                    </div>
                  </div>
                  {preview.length > 0 && (
                    <div className="mt-3 space-y-1 text-xs">
                      <p className="text-muted-foreground">
                        <strong>{installments}x</strong> de{" "}
                        <strong>{formatCurrency(preview[0].amount)}</strong> — 1ª em{" "}
                        <strong>{formatMonthYearBR(preview[0].invoiceMonth)}</strong>, última em{" "}
                        <strong>{formatMonthYearBR(preview[preview.length - 1].invoiceMonth)}</strong>.
                      </p>
                      <p className="text-muted-foreground">
                        Total reservado no limite:{" "}
                        <strong>{formatCurrency(previewAmount)}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Field label="Tags (separadas por vírgula)">
                <Input name="tags" maxLength={300} placeholder="viagem, urgente, presente…" />
              </Field>
              <Field label="Observações">
                <Textarea name="notes" rows={2} maxLength={500} />
              </Field>
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Salvando…" : installments > 1 ? `Lançar ${installments}x` : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeading>

      {/* Barra de filtros avançados */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Input
              placeholder="Pesquisar por descrição, categoria, tag…"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="pr-9"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, search: "" }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar pesquisa"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="size-4" />
              Filtros {filtersActiveCount > 0 && `(${filtersActiveCount})`}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-3">
          <div className="card-surface grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-4">
            <Field label="De">
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              />
            </Field>
            <Field label="Até">
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              />
            </Field>
            <Field label="Tipo">
              <Select
                value={filters.type}
                onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={filters.status}
                onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Conta">
              <Select
                value={filters.account}
                onValueChange={(v) => setFilters((f) => ({ ...f, account: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(accounts.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nickname ?? a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cartão">
              <Select
                value={filters.card}
                onValueChange={(v) => setFilters((f) => ({ ...f, card: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(cards.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Categoria">
              <Select
                value={filters.category}
                onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(categories.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Usuário">
              <Select
                value={filters.owner}
                onValueChange={(v) => setFilters((f) => ({ ...f, owner: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tag">
              <Input
                placeholder="ex.: viagem"
                value={filters.tag}
                onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))}
              />
            </Field>
            <Field label="Valor mín. (R$)">
              <Input
                type="number"
                step="0.01"
                value={filters.minAmount}
                onChange={(e) => setFilters((f) => ({ ...f, minAmount: e.target.value }))}
              />
            </Field>
            <Field label="Valor máx. (R$)">
              <Input
                type="number"
                step="0.01"
                value={filters.maxAmount}
                onChange={(e) => setFilters((f) => ({ ...f, maxAmount: e.target.value }))}
              />
            </Field>
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="w-full"
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>


      {filteredTxs.length === 0 ? (
        <EmptyState
          icon={<ArrowRightLeft className="size-8" />}
          label={
            (txs.data ?? []).length === 0
              ? "Nenhuma movimentação nesta visão."
              : "Nenhuma movimentação corresponde aos filtros."
          }
        />
      ) : (
        <div className="card-surface divide-y divide-border">
          {filteredTxs.map((t) => {
            const cat = (categories.data ?? []).find((c) => c.id === t.category_id);
            const acc = (accounts.data ?? []).find((a) => a.id === t.account_id);
            const owner = profiles.find((p) => p.id === t.owner_id);
            const positive = t.type === "receita";
            const isInstallment = !!t.installment_group_id && !!t.installment_total;
            const isPending = t.status === "pendente";
            return (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 px-4 py-3 md:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="grid size-10 shrink-0 place-items-center rounded-full text-lg"
                    style={{ background: `${cat?.color ?? "#71717a"}22` }}
                  >
                    {cat?.icon ?? (t.type === "transferencia" ? "🔁" : "💰")}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {t.description || cat?.name || t.type}
                      </p>
                      {isInstallment && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {t.installment_number}/{t.installment_total}
                        </span>
                      )}
                      {t.status === "pendente" && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          Pendente
                        </span>
                      )}
                      {(t.tags ?? []).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {formatDateBR(t.occurred_at)} • {acc?.nickname ?? acc?.name ?? "—"} •{" "}
                      {owner?.name}
                      {t.due_date ? ` • venc. ${formatDateBR(t.due_date)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-semibold ${
                      positive
                        ? "text-money-positive"
                        : t.type === "despesa"
                        ? "text-money-negative"
                        : ""
                    }`}
                  >
                    {positive ? "+" : t.type === "despesa" ? "-" : ""}
                    {formatCurrency(t.amount)}
                  </p>
                  {t.owner_id === currentUserId && isPending && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markPaid.mutate({ id: t.id, status: "paga" })}
                      title="Marcar como paga"
                    >
                      Pagar
                    </Button>
                  )}
                  {t.owner_id === currentUserId && !isPending && t.status === "paga" && isInstallment && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markPaid.mutate({ id: t.id, status: "pendente" })}
                      title="Reabrir parcela"
                    >
                      Reabrir
                    </Button>
                  )}
                  {t.owner_id === currentUserId && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        askDelete({
                          id: t.id,
                          installment_group_id: t.installment_group_id,
                          installment_number: t.installment_number,
                        })
                      }
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de exclusão com 3 modos para parcelamentos */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.groupId ? "Excluir parcelas" : "Excluir movimentação"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.groupId
                ? "Escolha o que deseja excluir desta compra parcelada."
                : "Esta ação não pode ser desfeita."}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget?.groupId && (
            <RadioGroup
              value={deleteMode}
              onValueChange={(v) => setDeleteMode(v as ScopeMode)}
              className="space-y-2"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3">
                <RadioGroupItem value="este" />
                Apenas esta parcela ({deleteTarget.number}ª)
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3">
                <RadioGroupItem value="este_e_proximos" />
                Esta e as próximas
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3">
                <RadioGroupItem value="todos" />
                Todas as parcelas
              </label>
            </RadioGroup>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={removeSingle.isPending || removeGroup.isPending}
            >
              {removeSingle.isPending || removeGroup.isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
