import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppTheme } from "@/lib/theme-context";
import type { Database } from "@/integrations/supabase/types";

export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
export type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
export type CardRow = Database["public"]["Tables"]["credit_cards"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type RecurrenceRow = Database["public"]["Tables"]["recurrences"]["Row"];

/** Executa a geração de ocorrências devidas para o usuário atual (idempotente). */
export async function runRecurrenceCatchUp(): Promise<number | null> {
  const { data, error } = await supabase.rpc("generate_recurrence_occurrences");
  if (error) return null;
  return (data as number) ?? 0;
}

export function useRecurrences() {
  const { view, currentUserId } = useAppTheme();
  const q = useQuery({
    queryKey: ["recurrences"],
    enabled: !!currentUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurrences")
        .select("*")
        .order("next_run_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RecurrenceRow[];
    },
  });
  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    if (view === "family") return rows.filter((r) => r.scope === "compartilhado");
    return rows.filter((r) => r.owner_id === view || r.scope === "compartilhado");
  }, [q.data, view]);
  return { ...q, data: filtered };
}

/**
 * View-aware filter:
 * - "family"   → shared movements/accounts/cards only (both people can see)
 * - "<userId>" → that user's individual + shared
 */
export function useViewFilter() {
  const { view, currentUserId } = useAppTheme();
  return useMemo(() => ({ view, currentUserId }), [view, currentUserId]);
}

function applyOwnerScopeFilter<T extends { owner_id: string; scope: string }>(
  rows: T[],
  view: string,
): T[] {
  if (view === "family") return rows.filter((r) => r.scope === "compartilhado");
  return rows.filter((r) => r.owner_id === view || r.scope === "compartilhado");
}

export function useAccounts() {
  const { view } = useViewFilter();
  const q = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AccountRow[];
    },
  });
  const filtered = useMemo(() => applyOwnerScopeFilter(q.data ?? [], view), [q.data, view]);
  return { ...q, data: filtered };
}

export function useCards() {
  const { view } = useViewFilter();
  const q = useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_cards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CardRow[];
    },
  });
  const filtered = useMemo(() => applyOwnerScopeFilter(q.data ?? [], view), [q.data, view]);
  return { ...q, data: filtered };
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });
}

export function useTransactions(opts?: { limit?: number; from?: string; to?: string }) {
  const { view } = useViewFilter();
  const q = useQuery({
    queryKey: ["transactions", opts?.from, opts?.to, opts?.limit],
    queryFn: async () => {
      let query = supabase.from("transactions").select("*").order("occurred_at", { ascending: false });
      if (opts?.from) query = query.gte("occurred_at", opts.from);
      if (opts?.to) query = query.lte("occurred_at", opts.to);
      if (opts?.limit) query = query.limit(opts.limit);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TransactionRow[];
    },
  });
  const filtered = useMemo(() => applyOwnerScopeFilter(q.data ?? [], view), [q.data, view]);
  return { ...q, data: filtered };
}

export function formatCurrency(value: number | string | null | undefined) {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}
