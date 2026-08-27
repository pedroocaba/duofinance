import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Repeat2, Pause, Play, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useRecurrences,
  useAccounts,
  useCards,
  useCategories,
  formatCurrency,
  runRecurrenceCatchUp,
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
import { toast } from "sonner";
import { PageHeading, Field, EmptyState } from "./accounts";
import { formatDateBR, todayISO } from "@/lib/date-format";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/_authenticated/recurrences")({
  component: RecurrencesPage,
});

const schema = z.object({
  type: z.enum(["receita", "despesa"]),
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  description: z.string().trim().min(2).max(120),
  frequency: z.enum(["semanal", "mensal", "anual"]),
  interval_count: z.coerce.number().int().min(1).max(12),
  start_date: z.string(),
  end_date: z.string().optional(),
  category_id: z.string().uuid().optional().or(z.literal("")),
  account_id: z.string().uuid().optional().or(z.literal("")),
  credit_card_id: z.string().uuid().optional().or(z.literal("")),
  scope: z.enum(["individual", "compartilhado"]),
  notes: z.string().max(500).optional(),
});

const FREQ_LABEL: Record<string, string> = {
  semanal: "Semanal",
  mensal: "Mensal",
  anual: "Anual",
};

const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

function RecurrencesPage() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"receita" | "despesa">("despesa");
  const recurrences = useRecurrences();
  const accounts = useAccounts();
  const cards = useCards();
  const categories = useCategories();
  const { currentUserId, currentFamilyId, view, setView } = useAppTheme();
  const qc = useQueryClient();

  const filteredCategories = (categories.data ?? []).filter((c) => c.kind === type);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["recurrences"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["cards"] });
  };

  const create = useMutation({
    mutationFn: async (v: z.infer<typeof schema>) => {
      const { error } = await supabase.from("recurrences").insert({
        owner_id: currentUserId!,
        family_id: currentFamilyId!,
        type: v.type,
        amount: v.amount,
        description: v.description,
        frequency: v.frequency,
        interval_count: v.interval_count,
        start_date: v.start_date,
        next_run_at: v.start_date,
        end_date: v.end_date || null,
        category_id: v.category_id || null,
        account_id: v.account_id || null,
        credit_card_id: v.credit_card_id || null,
        scope: v.scope,
        notes: v.notes || null,
      });
      if (error) throw error;
      return v.scope;
    },
    onSuccess: (scope) => {
      invalidateAll();
      if (view === "family" && scope !== "compartilhado" && currentUserId) {
        setView(currentUserId);
      }
      toast.success("Recorrência criada!");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(friendlyAuthError(e)),
  });

  const toggleStatus = useMutation({
    mutationFn: async (args: { id: string; status: "ativa" | "pausada" }) => {
      const { error } = await supabase
        .from("recurrences")
        .update({ status: args.status })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
    onError: (e: Error) => toast.error(friendlyAuthError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurrences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Recorrência removida.");
    },
    onError: (e: Error) => toast.error(friendlyAuthError(e)),
  });

  const runNow = useMutation({
    mutationFn: async () => {
      const n = await runRecurrenceCatchUp();
      return n ?? 0;
    },
    onSuccess: (n) => {
      invalidateAll();
      toast.success(n > 0 ? `${n} ocorrência(s) lançada(s).` : "Nada pendente por agora.");
    },
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
      <PageHeading
        title="Contas recorrentes"
        subtitle="Assinaturas, contas fixas e receitas periódicas."
      >
        <Button variant="outline" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
          <RefreshCw className={`size-4 ${runNow.isPending ? "animate-spin" : ""}`} />
          Gerar agora
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Nova recorrência
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova recorrência</DialogTitle>
              <DialogDescription>
                O sistema criará automaticamente as movimentações conforme a frequência.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(["receita", "despesa"] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setType(t)}
                    className={`rounded-xl border px-3 py-2 text-sm capitalize transition-colors ${
                      type === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input type="hidden" name="type" value={type} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Descrição">
                  <Input
                    name="description"
                    required
                    maxLength={120}
                    placeholder="Ex.: Netflix, Aluguel…"
                  />
                </Field>
                <Field label="Valor (R$)">
                  <Input name="amount" type="number" step="0.01" min="0.01" required />
                </Field>
                <Field label="Frequência">
                  <Select name="frequency" defaultValue="mensal">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="A cada">
                  <Input
                    name="interval_count"
                    type="number"
                    min={1}
                    max={12}
                    defaultValue={1}
                    required
                  />
                </Field>
                <Field label="Início">
                  <Input name="start_date" type="date" required defaultValue={todayISO()} />
                </Field>
                <Field label="Fim (opcional)">
                  <Input name="end_date" type="date" />
                </Field>
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
                <Field label="Conta (opcional)">
                  <Select name="account_id">
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma" />
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
                {type === "despesa" && (
                  <Field label="Cartão (opcional)">
                    <Select name="credit_card_id">
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        {(cards.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
              <Field label="Observações">
                <Textarea name="notes" rows={2} maxLength={500} />
              </Field>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Salvando…" : "Criar recorrência"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeading>

      {(recurrences.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Repeat2 className="size-8" />}
          label="Nenhuma recorrência cadastrada nesta visão."
        />
      ) : (
        <div className="card-surface divide-y divide-border">
          {(recurrences.data ?? []).map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{r.description}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      r.status === "ativa"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : r.status === "pausada"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  {FREQ_LABEL[r.frequency]} • a cada {r.interval_count} • próx.{" "}
                  {formatDateBR(r.next_run_at)}
                  {r.end_date ? ` • até ${formatDateBR(r.end_date)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p
                  className={`text-sm font-semibold ${
                    r.type === "receita" ? "text-money-positive" : "text-money-negative"
                  }`}
                >
                  {r.type === "receita" ? "+" : "-"}
                  {formatCurrency(r.amount)}
                </p>
                {r.owner_id === currentUserId && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        toggleStatus.mutate({
                          id: r.id,
                          status: r.status === "ativa" ? "pausada" : "ativa",
                        })
                      }
                      title={r.status === "ativa" ? "Pausar" : "Retomar"}
                    >
                      {r.status === "ativa" ? (
                        <Pause className="size-4" />
                      ) : (
                        <Play className="size-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Remover esta recorrência? As movimentações já geradas serão mantidas.")) {
                          remove.mutate(r.id);
                        }
                      }}
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
