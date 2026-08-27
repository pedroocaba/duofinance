import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

/**
 * Confirmação padrão de exclusão do DuoFinance.
 * `impacts` lista, em português, o que será afetado (ex.: movimentações vinculadas).
 */
export function ConfirmDelete({
  open,
  onOpenChange,
  title,
  description,
  impacts = [],
  confirmLabel = "Excluir",
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
  impacts?: string[];
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>{description ?? "Esta ação não pode ser desfeita."}</p>
              {impacts.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-left">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-3.5" /> Dados afetados
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-foreground">
                    {impacts.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {loading ? "Excluindo…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Hook utilitário para abrir a confirmação sobre um item específico. */
export function useConfirmTarget<T>() {
  const [target, setTarget] = useState<T | null>(null);
  return { target, setTarget, close: () => setTarget(null) };
}
