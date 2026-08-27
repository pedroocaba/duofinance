import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppTheme } from "@/lib/theme-context";

export type GoalPriority = "baixa" | "media" | "alta";
export type GoalStatus = "ativa" | "concluida" | "pausada" | "cancelada";
export type GoalScope = "individual" | "compartilhado";

export interface Goal {
  id: string;
  owner_id: string;
  scope: GoalScope;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  category: string | null;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  priority: GoalPriority;
  status: GoalStatus;
  linked_account_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  contributor_id: string;
  amount: number;
  contributed_at: string;
  notes: string | null;
  created_at: string;
}

const sb = supabase as unknown as {
  from: (t: string) => any;
};

export function useGoals() {
  const { view, currentUserId } = useAppTheme();
  const q = useQuery({
    queryKey: ["goals"],
    enabled: !!currentUserId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("goals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });
  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    if (view === "family") return rows.filter((g) => g.scope === "compartilhado");
    return rows.filter((g) => g.owner_id === view || g.scope === "compartilhado");
  }, [q.data, view]);
  return { ...q, data: filtered };
}

export function useGoal(id: string | undefined) {
  return useQuery({
    queryKey: ["goal", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sb.from("goals").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Goal | null;
    },
  });
}

export function useGoalContributions(goalId: string | undefined) {
  return useQuery({
    queryKey: ["goal-contributions", goalId],
    enabled: !!goalId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("goal_contributions")
        .select("*")
        .eq("goal_id", goalId)
        .order("contributed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GoalContribution[];
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  const { currentUserId, currentFamilyId, view, setView } = useAppTheme();
  return useMutation({
    mutationFn: async (input: Partial<Goal>) => {
      const { data, error } = await sb.from("goals").insert({
        ...input,
        owner_id: currentUserId!,
        family_id: currentFamilyId!,
      } as never).select().single();
      if (error) throw error;
      return data as Goal;
    },
    onSuccess: (goal) => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      if (view === "family" && goal?.scope !== "compartilhado" && currentUserId) {
        setView(currentUserId);
      }
    },
  });
}


export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Goal> }) => {
      const { error } = await sb.from("goals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["goal", v.id] });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useAddContribution() {
  const qc = useQueryClient();
  const { currentUserId, currentFamilyId } = useAppTheme();
  return useMutation({
    mutationFn: async (input: { goal_id: string; amount: number; contributed_at?: string; notes?: string }) => {
      const { error } = await sb.from("goal_contributions").insert({
        goal_id: input.goal_id,
        amount: input.amount,
        contributed_at: input.contributed_at ?? new Date().toISOString().slice(0, 10),
        notes: input.notes ?? null,
        contributor_id: currentUserId!,
        family_id: currentFamilyId!,
      });
      if (error) throw error;
    },

    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["goal", v.goal_id] });
      qc.invalidateQueries({ queryKey: ["goal-contributions", v.goal_id] });
    },
  });
}

/** Recomendação: quanto guardar por mês para bater o objetivo até a data. */
export function recommendMonthly(goal: Goal): { monthly: number; months: number } | null {
  if (!goal.target_date) return null;
  const target = new Date(goal.target_date);
  const now = new Date();
  const months = Math.max(
    1,
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()),
  );
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
  return { monthly: remaining / months, months };
}
