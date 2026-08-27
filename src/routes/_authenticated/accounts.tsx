import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Wallet, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, formatCurrency, type AccountRow } from "@/lib/finance-queries";
import { useAppTheme } from "@/lib/theme-context";
import { useRefreshFinance } from "@/lib/refresh";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDelete } from "@/components/confirm-delete";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
});

const ACCOUNT_TYPES = [
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "carteira_digital", label: "Carteira Digital" },
  { value: "investimentos", label: "Investimentos" },
  { value: "dinheiro", label: "Dinheiro em espécie" },
] as const;

const schema = z.object({
  name: z.string().trim().min(2, "Informe um nome com ao menos 2 caracteres").max(60),
  nickname: z.string().trim().max(40).optional(),
  bank: z.string().trim().max(60).optional(),
  type: z.enum(["corrente", "poupanca", "carteira_digital", "investimentos", "dinheiro"]),
  initial_balance: z.coerce.number(),
  color: z.string().max(20).optional(),
  icon: z.string().max(4).optional(),
  scope: z.enum(["individual", "compartilhado"]),
});

type FormValues = z.infer<typeof schema>;

/** Conta quantas movimentações dependem de uma conta — usado na exclusão segura. */
function useAccountUsage(accountId: string | null) {
  return useQuery({
    queryKey: ["account-usage", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const [linked, transfers] = await Promise.all([
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("account_id", accountId!),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("transfer_to_account_id", accountId!),
      ]);
      const recurrences = await supabase
        .from("recurrences")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId!);
      return {
        transactions: (linked.count ?? 0) + (transfers.count ?? 0),
        recurrences: recurrences.count ?? 0,
      };
    },
  });
}

function AccountsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [deleting, setDeleting] = useState<AccountRow | null>(null);
  const accounts = useAccounts();
  const { currentUserId, currentFamilyId, profiles, view, setView } = useAppTheme();
  const refresh = useRefreshFinance();
  const usage = useAccountUsage(deleting?.id ?? null);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        // O saldo atual acompanha a variação do saldo inicial informado.
        const delta = values.initial_balance - Number(editing.initial_balance);
        const { error } = await supabase
          .from("accounts")
          .update({
            name: values.name,
            nickname: values.nickname || null,
            bank: values.bank || null,
            type: values.type,
            initial_balance: values.initial_balance,
            current_balance: Number(editing.current_balance) + delta,
            color: values.color || "#dc2626",
            icon: values.icon || "🏦",
            scope: values.scope,
          })
          .eq("id", editing.id);
        if (error) throw error;
        return values.scope;
      }
      const { error } = await supabase.from("accounts").insert({
        owner_id: currentUserId!,
        family_id: currentFamilyId!,
        name: values.name,
        nickname: values.nickname || null,
        bank: values.bank || null,
        type: values.type,
        initial_balance: values.initial_balance,
        current_balance: values.initial_balance,
        color: values.color || "#dc2626",
        icon: values.icon || "🏦",
        scope: values.scope,
      });
      if (error) throw error;
      return values.scope;
    },
    onSuccess: (scope) => {
      refresh();
      if (view === "family" && scope !== "compartilhado" && currentUserId) setView(currentUserId);
      toast.success(editing ? "Conta atualizada!" : "Conta criada!");
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (account: AccountRow) => {
      const { error } = await supabase.from("accounts").delete().eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Conta excluída.");
      setDeleting(null);
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("foreign key")
          ? "Não foi possível excluir: existem movimentações vinculadas a esta conta."
          : e.message,
      ),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    save.mutate(parsed.data);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(a: AccountRow) {
    setEditing(a);
    setFormOpen(true);
  }

  const impacts: string[] = [];
  if (usage.data) {
    if (usage.data.transactions > 0) impacts.push(`${usage.data.transactions} movimentação(ões) vinculada(s)`);
    if (usage.data.recurrences > 0) impacts.push(`${usage.data.recurrences} recorrência(s) vinculada(s)`);
    if (impacts.length > 0) impacts.push("Saldos, KPIs e análises serão recalculados");
  }

  return (
    <div className="space-y-6">
      <PageHeading title="Contas bancárias" subtitle="Suas contas correntes, poupanças e carteiras.">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nova conta
        </Button>
      </PageHeading>

      <Dialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar conta" : "Cadastrar conta"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3" key={editing?.id ?? "new"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nome">
                <Input name="name" required maxLength={60} defaultValue={editing?.name ?? ""} />
              </Field>
              <Field label="Apelido">
                <Input name="nickname" maxLength={40} placeholder="Nubank principal" defaultValue={editing?.nickname ?? ""} />
              </Field>
              <Field label="Banco">
                <Input name="bank" maxLength={60} placeholder="Nubank" defaultValue={editing?.bank ?? ""} />
              </Field>
              <Field label="Tipo">
                <Select name="type" defaultValue={editing?.type ?? "corrente"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Saldo inicial (R$)">
                <Input
                  name="initial_balance"
                  type="number"
                  step="0.01"
                  defaultValue={editing ? String(editing.initial_balance) : "0"}
                />
              </Field>
              <Field label="Escopo">
                <Select name="scope" defaultValue={editing?.scope ?? "individual"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="compartilhado">Compartilhado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cor">
                <Input name="color" type="color" defaultValue={editing?.color ?? "#dc2626"} className="h-10 p-1" />
              </Field>
              <Field label="Ícone (emoji)">
                <Input name="icon" maxLength={4} defaultValue={editing?.icon ?? "🏦"} />
              </Field>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {(accounts.data ?? []).length === 0 ? (
        <EmptyState icon={<Wallet className="size-8" />} label="Nenhuma conta cadastrada nesta visão." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(accounts.data ?? []).map((a) => {
            const owner = profiles.find((p) => p.id === a.owner_id);
            return (
              <div key={a.id} className="card-surface p-5 transition-all hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div
                    className="grid size-12 place-items-center rounded-2xl text-2xl"
                    style={{ background: `${a.color ?? "#71717a"}22`, color: a.color ?? "#71717a" }}
                  >
                    {a.icon ?? "🏦"}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{a.scope}</span>
                    <Button size="icon" variant="ghost" aria-label="Editar conta" onClick={() => openEdit(a)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Excluir conta" onClick={() => setDeleting(a)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <Link to="/accounts/$id" params={{ id: a.id }} className="mt-4 block">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{a.bank ?? a.type}</p>
                  <p className="text-lg font-semibold">{a.nickname ?? a.name}</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight">{formatCurrency(a.current_balance)}</p>
                  {owner && (
                    <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">de {owner.name}</p>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Tem certeza que deseja excluir a conta "${deleting?.nickname ?? deleting?.name ?? ""}"?`}
        description="Esta ação não pode ser desfeita."
        impacts={impacts}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}

export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="card-surface grid place-items-center gap-3 p-12 text-center text-muted-foreground">
      {icon}
      <p className="text-sm">{label}</p>
    </div>
  );
}
