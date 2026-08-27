import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Chaves de cache que representam dados financeiros derivados.
 * Qualquer criação/edição/exclusão precisa invalidar TODAS elas, pois
 * saldos, limites, KPIs, rankings e insights são calculados a partir delas.
 */
export const FINANCE_QUERY_KEYS = [
  "transactions",
  "transactions-raw",
  "accounts",
  "account",
  "account-transactions",
  "cards",
  "card",
  "card-transactions",
  "card-transactions-full",
  "categories",
  "recurrences",
  "goals",
  "goal",
  "goal-contributions",
] as const;

/**
 * Atualiza toda a aplicação (Dashboard, KPIs, saldos, cartões, contas, metas,
 * rankings, insights e comparativos) sem recarregar a página.
 */
export function useRefreshFinance() {
  const qc = useQueryClient();
  return useCallback(() => {
    for (const key of FINANCE_QUERY_KEYS) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  }, [qc]);
}
