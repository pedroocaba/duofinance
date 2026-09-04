-- Corrige compute_invoice_month(): a versão original somava 1 mês a mais
-- nos dois cenários possíveis, fazendo toda compra parcelada cair um mês
-- depois do correto na fatura do cartão.
--
-- Exemplo real que expôs o bug: fechamento dia 18, compra no dia 2 (antes
-- do fechamento) — deveria cair na fatura do mês corrente (ainda aberta),
-- mas a versão anterior jogava para o mês seguinte.

CREATE OR REPLACE FUNCTION public.compute_invoice_month(
  purchase_date date,
  closing_day integer
) RETURNS date
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  base date;
BEGIN
  -- Se a compra ocorreu ATÉ o fechamento, a fatura do mês corrente ainda
  -- está aberta e a compra entra nela; se ocorreu APÓS o fechamento, a
  -- fatura do mês corrente já fechou e a compra cai na fatura do mês
  -- seguinte.
  IF EXTRACT(DAY FROM purchase_date)::int <= COALESCE(closing_day, 1) THEN
    base := date_trunc('month', purchase_date)::date;
  ELSE
    base := date_trunc('month', purchase_date)::date + INTERVAL '1 month';
  END IF;
  RETURN base;
END;
$$;

-- IMPORTANTE: esta correção só vale para compras parceladas criadas A PARTIR
-- de agora. Parcelamentos de teste já criados com a fórmula antiga ficaram
-- com invoice_month/due_date errados e precisam ser excluídos e recriados
-- manualmente — esta migration não reescreve dados existentes.
