-- 1) Remove o gatilho duplicado (mesma função aplicada 2x por lançamento)
DROP TRIGGER IF EXISTS trg_transactions_balance ON public.transactions;

-- 2) Função de recálculo/reconciliação de saldos e limites
CREATE OR REPLACE FUNCTION public.recalculate_balances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.accounts a
  SET current_balance = a.initial_balance
    + COALESCE((SELECT SUM(t.amount) FROM public.transactions t
        WHERE t.account_id = a.id AND t.type = 'receita'), 0)
    - COALESCE((SELECT SUM(t.amount) FROM public.transactions t
        WHERE t.account_id = a.id AND t.type = 'despesa'), 0)
    - COALESCE((SELECT SUM(t.amount) FROM public.transactions t
        WHERE t.account_id = a.id AND t.type = 'transferencia'), 0)
    + COALESCE((SELECT SUM(t.amount) FROM public.transactions t
        WHERE t.transfer_to_account_id = a.id AND t.type = 'transferencia'), 0);

  UPDATE public.credit_cards c
  SET available_limit = c.credit_limit
    - COALESCE((SELECT SUM(t.amount) FROM public.transactions t
        WHERE t.credit_card_id = c.id AND t.type = 'despesa' AND t.status <> 'cancelada'), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_balances() FROM public;
GRANT EXECUTE ON FUNCTION public.recalculate_balances() TO authenticated, service_role;

-- 3) Corrige os saldos já duplicados
SELECT public.recalculate_balances();