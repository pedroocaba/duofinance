import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/lib/finance-queries";
import { useAppTheme } from "@/lib/theme-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeading, Field } from "./accounts";

export const Route = createFileRoute("/_authenticated/categories")({
  component: CategoriesPage,
});

const schema = z.object({
  name: z.string().trim().min(2).max(40),
  kind: z.enum(["receita", "despesa"]),
  icon: z.string().max(4).optional(),
  color: z.string().optional(),
});

function CategoriesPage() {
  const [open, setOpen] = useState(false);
  const cats = useCategories();
  const { currentUserId, currentFamilyId } = useAppTheme();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (v: z.infer<typeof schema>) => {
      const { error } = await supabase.from("categories").insert({
        owner_id: currentUserId!,
        family_id: currentFamilyId!,
        name: v.name,
        kind: v.kind,
        icon: v.icon || "🏷️",
        color: v.color || "#71717a",
        is_default: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria criada!");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const receitas = (cats.data ?? []).filter((c) => c.kind === "receita");
  const despesas = (cats.data ?? []).filter((c) => c.kind === "despesa");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    create.mutate(parsed.data);
  }

  return (
    <div className="space-y-6">
      <PageHeading title="Categorias" subtitle="Organize receitas e despesas por tipo.">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Nova categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar categoria</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="Nome">
                <Input name="name" required maxLength={40} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Tipo">
                  <Select name="kind" defaultValue="despesa">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Ícone">
                  <Input name="icon" maxLength={4} defaultValue="🏷️" />
                </Field>
                <Field label="Cor">
                  <Input name="color" type="color" defaultValue="#71717a" className="h-10 p-1" />
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

      <div className="grid gap-6 md:grid-cols-2">
        <CategoryGroup title="Receitas" items={receitas} />
        <CategoryGroup title="Despesas" items={despesas} />
      </div>
    </div>
  );
}

function CategoryGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; name: string; icon: string | null; color: string | null }>;
}) {
  return (
    <div className="card-surface p-5">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm"
            style={{ background: `${c.color ?? "#71717a"}18`, color: c.color ?? "var(--foreground)" }}
          >
            <span>{c.icon}</span>
            <span className="text-foreground">{c.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
