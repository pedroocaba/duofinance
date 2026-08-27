import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Target, Plus, Trash2, TrendingUp, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageHeading, Field, EmptyState } from "./accounts";
import {
  useGoals,
  useCreateGoal,
  useDeleteGoal,
  useAddContribution,
  recommendMonthly,
  type Goal,
  type GoalPriority,
  type GoalScope,
} from "@/lib/goals-queries";
import { formatCurrency } from "@/lib/finance-queries";
import { formatDateBR } from "@/lib/date-format";
import { useAppTheme } from "@/lib/theme-context";

export const Route = createFileRoute("/_authenticated/goals")({
  component: GoalsPage,
});

const ICONS = ["🎯", "🏝️", "🏠", "🚗", "💍", "🎓", "👶", "💻", "🎁", "✈️", "💰", "🐣"];

function GoalsPage() {
  const { view } = useAppTheme();
  const goals = useGoals();
  const [open, setOpen] = useState(false);

  const active = (goals.data ?? []).filter((g) => g.status === "ativa");
  const done = (goals.data ?? []).filter((g) => g.status === "concluida");

  const totalTarget = active.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalCurrent = active.reduce((s, g) => s + Number(g.current_amount), 0);
  const overall = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading
          title="Metas"
          subtitle={
            view === "family"
              ? "Planos que Pedro e Samira estão construindo juntos."
              : "Objetivos que você está perseguindo."
          }
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Nova meta
            </Button>
          </DialogTrigger>
          <NewGoalDialog onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      {/* Resumo geral */}
      {active.length > 0 && (
        <div className="card-surface p-5">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Progresso geral · {active.length} meta(s) ativa(s)
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {formatCurrency(totalCurrent)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  de {formatCurrency(totalTarget)}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{overall.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">concluído</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, overall)}%` }}
            />
          </div>
        </div>
      )}

      {/* Metas ativas */}
      {active.length === 0 ? (
        <EmptyState
          icon={<Target className="size-8" />}
          label="Nenhuma meta ativa. Crie a primeira e comece a sonhar grande."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">🏆 Conquistadas</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {done.map((g) => (
              <div key={g.id} className="card-surface p-4 opacity-80">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{g.icon ?? "🎯"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="text-xs text-money-positive">{formatCurrency(g.target_amount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const [contribOpen, setContribOpen] = useState(false);
  const del = useDeleteGoal();
  const pct =
    Number(goal.target_amount) > 0
      ? (Number(goal.current_amount) / Number(goal.target_amount)) * 100
      : 0;
  const rec = recommendMonthly(goal);
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));

  return (
    <div className="card-surface p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl"
          style={{ background: `${goal.color ?? "#71717a"}22` }}
        >
          {goal.icon ?? "🎯"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{goal.name}</p>
            {goal.scope === "compartilhado" && (
              <Badge variant="secondary" className="gap-1">
                <Users className="size-3" /> Família
              </Badge>
            )}
            <PriorityBadge priority={goal.priority} />
          </div>
          {goal.description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{goal.description}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (confirm(`Excluir meta "${goal.name}"?`)) {
              del.mutate(goal.id, {
                onSuccess: () => toast.success("Meta removida."),
                onError: (e: Error) => toast.error(e.message),
              });
            }
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-2xl font-semibold tracking-tight">
            {formatCurrency(goal.current_amount)}
          </p>
          <p className="text-xs text-muted-foreground">
            de {formatCurrency(goal.target_amount)} · faltam {formatCurrency(remaining)}
          </p>
        </div>
        <p className="text-lg font-bold text-primary">{pct.toFixed(0)}%</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, background: goal.color ?? "var(--primary)" }}
        />
      </div>

      {(goal.target_date || rec) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {goal.target_date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3" /> {formatDateBR(goal.target_date)}
            </span>
          )}
          {rec && rec.monthly > 0 && (
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="size-3" />
              Guardar {formatCurrency(rec.monthly)}/mês por {rec.months} meses
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Dialog open={contribOpen} onOpenChange={setContribOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary">
              <Plus className="size-3" /> Contribuir
            </Button>
          </DialogTrigger>
          <ContributionDialog goal={goal} onDone={() => setContribOpen(false)} />
        </Dialog>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: GoalPriority }) {
  const map = {
    alta: { label: "Alta", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    media: { label: "Média", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    baixa: { label: "Baixa", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  };
  const s = map[priority];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.label}</span>
  );
}

function NewGoalDialog({ onDone }: { onDone: () => void }) {
  const create = useCreateGoal();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [color, setColor] = useState("#dc2626");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState<GoalPriority>("media");
  const [scope, setScope] = useState<GoalScope>("individual");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = Number(target.replace(",", "."));
    const c = Number(current.replace(",", ".")) || 0;
    if (!name.trim() || !(t > 0)) {
      toast.error("Informe nome e valor alvo.");
      return;
    }
    create.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        icon,
        color,
        target_amount: t,
        current_amount: c,
        target_date: targetDate || null,
        priority,
        scope,
      },
      {
        onSuccess: () => {
          toast.success("Meta criada!");
          onDone();
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Nova meta</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Viagem ao Japão" />
        </Field>
        <Field label="Descrição (opcional)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor alvo (R$)">
            <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="15000" inputMode="decimal" />
          </Field>
          <Field label="Já guardado (R$)">
            <Input value={current} onChange={(e) => setCurrent(e.target.value)} inputMode="decimal" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data alvo (opcional)">
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
          <Field label="Cor">
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
          </Field>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ícone</Label>
          <div className="flex flex-wrap gap-1">
            {ICONS.map((i) => (
              <button
                type="button"
                key={i}
                onClick={() => setIcon(i)}
                className={`grid size-9 place-items-center rounded-lg text-xl transition-all ${
                  icon === i ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prioridade">
            <Select value={priority} onValueChange={(v: GoalPriority) => setPriority(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Escopo">
            <Select value={scope} onValueChange={(v: GoalScope) => setScope(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="compartilhado">Família (compartilhada)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Criando…" : "Criar meta"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ContributionDialog({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const add = useAddContribution();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = Number(amount.replace(",", "."));
    if (!(a > 0)) {
      toast.error("Informe um valor válido.");
      return;
    }
    add.mutate(
      { goal_id: goal.id, amount: a, contributed_at: date, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Contribuição registrada!");
          onDone();
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Contribuir para {goal.name}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Valor (R$)">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus />
        </Field>
        <Field label="Data">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Observação (opcional)">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button type="submit" disabled={add.isPending}>
            {add.isPending ? "Salvando…" : "Adicionar contribuição"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
