
-- =====================================================================
-- FASE 2A: Parcelamentos e Recorrências
-- =====================================================================

-- 1) Enum de status da transação
DO $$ BEGIN
  CREATE TYPE public.transaction_status AS ENUM ('pendente', 'paga', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.recurrence_frequency AS ENUM ('semanal', 'mensal', 'anual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.recurrence_status AS ENUM ('ativa', 'pausada', 'encerrada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Novas colunas em transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS status public.transaction_status NOT NULL DEFAULT 'paga',
  ADD COLUMN IF NOT EXISTS installment_group_id uuid,
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS installment_total integer,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS invoice_month date,
  ADD COLUMN IF NOT EXISTS recurrence_id uuid;

CREATE INDEX IF NOT EXISTS transactions_installment_group_idx
  ON public.transactions(installment_group_id) WHERE installment_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_recurrence_idx
  ON public.transactions(recurrence_id) WHERE recurrence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_invoice_month_idx
  ON public.transactions(credit_card_id, invoice_month) WHERE credit_card_id IS NOT NULL;

-- 3) Tabela de recorrências
CREATE TABLE IF NOT EXISTS public.recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope public.transaction_scope NOT NULL DEFAULT 'individual',
  type public.transaction_type NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  description text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  credit_card_id uuid REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  frequency public.recurrence_frequency NOT NULL DEFAULT 'mensal',
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
  day_of_month integer CHECK (day_of_month BETWEEN 1 AND 31),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  next_run_at date NOT NULL DEFAULT CURRENT_DATE,
  status public.recurrence_status NOT NULL DEFAULT 'ativa',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurrences TO authenticated;
GRANT ALL ON public.recurrences TO service_role;

ALTER TABLE public.recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurrences_select" ON public.recurrences
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR scope = 'compartilhado');

CREATE POLICY "recurrences_insert" ON public.recurrences
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "recurrences_update" ON public.recurrences
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "recurrences_delete" ON public.recurrences
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER update_recurrences_updated_at
  BEFORE UPDATE ON public.recurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FK atrasada para recurrence_id
DO $$ BEGIN
  ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_recurrence_fk
    FOREIGN KEY (recurrence_id) REFERENCES public.recurrences(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- 4) Ajuste do trigger de saldo: liberar/reservar limite conforme status
-- =====================================================================

CREATE OR REPLACE FUNCTION public.apply_transaction_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Saldos de conta
    IF NEW.type = 'receita' AND NEW.account_id IS NOT NULL THEN
      UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'despesa' AND NEW.account_id IS NOT NULL THEN
      UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'transferencia' AND NEW.account_id IS NOT NULL AND NEW.transfer_to_account_id IS NOT NULL THEN
      UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
      UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.transfer_to_account_id;
    END IF;

    -- Limite do cartão: reserva no INSERT se pendente/paga (paga = ainda ocupa fatura futura)
    IF NEW.credit_card_id IS NOT NULL AND NEW.type = 'despesa' AND NEW.status <> 'cancelada' THEN
      UPDATE public.credit_cards SET available_limit = available_limit - NEW.amount WHERE id = NEW.credit_card_id;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Só reagimos a mudanças de status para cartão de crédito.
    -- (Edição de valor/cartão é feita via funções dedicadas.)
    IF NEW.credit_card_id IS NOT NULL AND NEW.type = 'despesa' AND NEW.status IS DISTINCT FROM OLD.status THEN
      -- pendente/paga -> cancelada: libera
      IF NEW.status = 'cancelada' AND OLD.status <> 'cancelada' THEN
        UPDATE public.credit_cards SET available_limit = available_limit + NEW.amount WHERE id = NEW.credit_card_id;
      -- cancelada -> pendente/paga: reserva
      ELSIF OLD.status = 'cancelada' AND NEW.status <> 'cancelada' THEN
        UPDATE public.credit_cards SET available_limit = available_limit - NEW.amount WHERE id = NEW.credit_card_id;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'receita' AND OLD.account_id IS NOT NULL THEN
      UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'despesa' AND OLD.account_id IS NOT NULL THEN
      UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'transferencia' AND OLD.account_id IS NOT NULL AND OLD.transfer_to_account_id IS NOT NULL THEN
      UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
      UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.transfer_to_account_id;
    END IF;
    IF OLD.credit_card_id IS NOT NULL AND OLD.type = 'despesa' AND OLD.status <> 'cancelada' THEN
      UPDATE public.credit_cards SET available_limit = available_limit + OLD.amount WHERE id = OLD.credit_card_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Garante o trigger (nome estável)
DROP TRIGGER IF EXISTS trg_transactions_apply_balance ON public.transactions;
CREATE TRIGGER trg_transactions_apply_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_transaction_balance();

-- =====================================================================
-- 5) Helper: calcular mês da fatura a partir da data da compra
-- =====================================================================
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
  -- Se a compra ocorreu ATÉ o fechamento, cai na fatura do mês seguinte;
  -- se ocorreu APÓS o fechamento, cai na fatura do mês subsequente.
  IF EXTRACT(DAY FROM purchase_date)::int <= COALESCE(closing_day, 1) THEN
    base := date_trunc('month', purchase_date)::date + INTERVAL '1 month';
  ELSE
    base := date_trunc('month', purchase_date)::date + INTERVAL '2 months';
  END IF;
  RETURN base;
END;
$$;

-- =====================================================================
-- 6) create_installment_purchase — gera N parcelas
-- =====================================================================
CREATE OR REPLACE FUNCTION public.create_installment_purchase(
  p_credit_card_id uuid,
  p_total_amount numeric,
  p_installments integer,
  p_purchase_date date,
  p_description text,
  p_category_id uuid,
  p_scope public.transaction_scope,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_group_id uuid := gen_random_uuid();
  v_owner uuid := auth.uid();
  v_closing_day integer;
  v_due_day integer;
  v_installment_amount numeric(14,2);
  v_remainder numeric(14,2);
  v_first_invoice date;
  v_invoice date;
  v_due date;
  v_amount numeric(14,2);
  i integer;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_installments < 1 OR p_installments > 60 THEN RAISE EXCEPTION 'invalid_installments'; END IF;
  IF p_total_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT closing_day, due_day INTO v_closing_day, v_due_day
  FROM public.credit_cards WHERE id = p_credit_card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found'; END IF;

  v_installment_amount := ROUND(p_total_amount / p_installments, 2);
  v_remainder := p_total_amount - (v_installment_amount * p_installments);
  v_first_invoice := public.compute_invoice_month(p_purchase_date, v_closing_day);

  FOR i IN 1..p_installments LOOP
    v_invoice := (v_first_invoice + ((i - 1) || ' months')::interval)::date;
    -- Data de vencimento = due_day do mês da fatura, respeitando o último dia do mês.
    v_due := (
      date_trunc('month', v_invoice)::date
      + (LEAST(v_due_day, EXTRACT(DAY FROM (date_trunc('month', v_invoice) + INTERVAL '1 month - 1 day'))::int) - 1)
    );
    v_amount := v_installment_amount;
    IF i = p_installments THEN
      v_amount := v_amount + v_remainder; -- ajusta o resto na última parcela
    END IF;

    INSERT INTO public.transactions (
      owner_id, type, scope, amount, occurred_at, description,
      category_id, credit_card_id, notes,
      status, installment_group_id, installment_number, installment_total,
      invoice_month, due_date, payment_method
    ) VALUES (
      v_owner, 'despesa', p_scope, v_amount, p_purchase_date,
      COALESCE(p_description, 'Compra parcelada') || ' (' || i || '/' || p_installments || ')',
      p_category_id, p_credit_card_id, p_notes,
      'pendente', v_group_id, i, p_installments,
      v_invoice, v_due, 'Crédito'
    );
  END LOOP;

  RETURN v_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_installment_purchase(uuid, numeric, integer, date, text, uuid, public.transaction_scope, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_installment_purchase(uuid, numeric, integer, date, text, uuid, public.transaction_scope, text) TO authenticated;

-- =====================================================================
-- 7) update_installment_group — edição em massa
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_installment_group(
  p_group_id uuid,
  p_current_number integer,
  p_mode text, -- 'este' | 'este_e_proximos' | 'todos'
  p_new_amount numeric DEFAULT NULL,
  p_new_description text DEFAULT NULL,
  p_new_category_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_mode NOT IN ('este','este_e_proximos','todos') THEN RAISE EXCEPTION 'invalid_mode'; END IF;

  UPDATE public.transactions t SET
    amount = COALESCE(p_new_amount, t.amount),
    description = COALESCE(p_new_description, t.description),
    category_id = COALESCE(p_new_category_id, t.category_id),
    updated_at = now()
  WHERE t.installment_group_id = p_group_id
    AND t.owner_id = v_owner
    AND (
      (p_mode = 'este' AND t.installment_number = p_current_number)
      OR (p_mode = 'este_e_proximos' AND t.installment_number >= p_current_number)
      OR (p_mode = 'todos')
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.update_installment_group(uuid, integer, text, numeric, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_installment_group(uuid, integer, text, numeric, text, uuid) TO authenticated;

-- =====================================================================
-- 8) delete_installment_group — exclusão em massa
-- =====================================================================
CREATE OR REPLACE FUNCTION public.delete_installment_group(
  p_group_id uuid,
  p_current_number integer,
  p_mode text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_deleted integer;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_mode NOT IN ('este','este_e_proximos','todos') THEN RAISE EXCEPTION 'invalid_mode'; END IF;

  DELETE FROM public.transactions t
  WHERE t.installment_group_id = p_group_id
    AND t.owner_id = v_owner
    AND (
      (p_mode = 'este' AND t.installment_number = p_current_number)
      OR (p_mode = 'este_e_proximos' AND t.installment_number >= p_current_number)
      OR (p_mode = 'todos')
    );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_installment_group(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_installment_group(uuid, integer, text) TO authenticated;

-- =====================================================================
-- 9) advance_recurrence_next_run — helper interno
-- =====================================================================
CREATE OR REPLACE FUNCTION public.advance_recurrence_date(
  p_date date,
  p_frequency public.recurrence_frequency,
  p_interval integer
) RETURNS date
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_frequency
    WHEN 'semanal' THEN p_date + (p_interval || ' weeks')::interval
    WHEN 'mensal'  THEN p_date + (p_interval || ' months')::interval
    WHEN 'anual'   THEN p_date + (p_interval || ' years')::interval
  END::date;
$$;

-- =====================================================================
-- 10) generate_recurrence_occurrences — cria transações devidas
-- =====================================================================
CREATE OR REPLACE FUNCTION public.generate_recurrence_occurrences()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_created integer := 0;
  r RECORD;
  v_next date;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  FOR r IN
    SELECT * FROM public.recurrences
    WHERE owner_id = v_owner
      AND status = 'ativa'
      AND next_run_at <= CURRENT_DATE
      AND (end_date IS NULL OR next_run_at <= end_date)
  LOOP
    -- Loop até next_run_at ficar no futuro (idempotente com múltiplas ocorrências atrasadas)
    WHILE r.next_run_at <= CURRENT_DATE AND (r.end_date IS NULL OR r.next_run_at <= r.end_date) LOOP
      -- Evita duplicar se já existe uma transação da mesma recorrência nessa data
      IF NOT EXISTS (
        SELECT 1 FROM public.transactions
        WHERE recurrence_id = r.id AND occurred_at = r.next_run_at
      ) THEN
        INSERT INTO public.transactions (
          owner_id, type, scope, amount, occurred_at, description,
          category_id, account_id, credit_card_id, notes,
          status, recurrence_id, payment_method
        ) VALUES (
          r.owner_id, r.type, r.scope, r.amount, r.next_run_at,
          COALESCE(r.description, 'Recorrência'),
          r.category_id, r.account_id, r.credit_card_id, r.notes,
          'paga', r.id,
          CASE WHEN r.credit_card_id IS NOT NULL THEN 'Crédito' ELSE 'Recorrente' END
        );
        v_created := v_created + 1;
      END IF;

      v_next := public.advance_recurrence_date(r.next_run_at, r.frequency, r.interval_count);
      r.next_run_at := v_next;
    END LOOP;

    UPDATE public.recurrences
    SET next_run_at = r.next_run_at,
        status = CASE WHEN r.end_date IS NOT NULL AND r.next_run_at > r.end_date THEN 'encerrada' ELSE status END,
        updated_at = now()
    WHERE id = r.id;
  END LOOP;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_recurrence_occurrences() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_recurrence_occurrences() TO authenticated;
