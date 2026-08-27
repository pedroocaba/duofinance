
-- Enums
DO $$ BEGIN
  CREATE TYPE public.goal_priority AS ENUM ('baixa', 'media', 'alta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.goal_status AS ENUM ('ativa', 'concluida', 'pausada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Goals table
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope public.transaction_scope NOT NULL DEFAULT 'individual',
  name text NOT NULL,
  description text,
  icon text DEFAULT '🎯',
  color text DEFAULT '#dc2626',
  category text,
  target_amount numeric(14,2) NOT NULL CHECK (target_amount > 0),
  current_amount numeric(14,2) NOT NULL DEFAULT 0,
  target_date date,
  priority public.goal_priority NOT NULL DEFAULT 'media',
  status public.goal_status NOT NULL DEFAULT 'ativa',
  linked_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver metas próprias ou compartilhadas"
  ON public.goals FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR scope = 'compartilhado');

CREATE POLICY "Criar metas próprias"
  ON public.goals FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Editar metas próprias"
  ON public.goals FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Excluir metas próprias"
  ON public.goals FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contributions
CREATE TABLE public.goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  contributor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount <> 0),
  contributed_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_contributions TO authenticated;
GRANT ALL ON public.goal_contributions TO service_role;

ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver contribuições de metas visíveis"
  ON public.goal_contributions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_id
        AND (g.owner_id = auth.uid() OR g.scope = 'compartilhado')
    )
  );

CREATE POLICY "Contribuir em metas visíveis"
  ON public.goal_contributions FOR INSERT TO authenticated
  WITH CHECK (
    contributor_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_id
        AND (g.owner_id = auth.uid() OR g.scope = 'compartilhado')
    )
  );

CREATE POLICY "Apagar contribuição própria ou de meta própria"
  ON public.goal_contributions FOR DELETE TO authenticated
  USING (
    contributor_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.owner_id = auth.uid())
  );

CREATE INDEX idx_goal_contributions_goal ON public.goal_contributions(goal_id);
CREATE INDEX idx_goals_owner ON public.goals(owner_id);

-- Trigger que atualiza current_amount ao inserir/deletar contribuição
CREATE OR REPLACE FUNCTION public.apply_goal_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target numeric(14,2);
  v_new numeric(14,2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.goals SET current_amount = current_amount + NEW.amount WHERE id = NEW.goal_id
      RETURNING target_amount, current_amount INTO v_target, v_new;
    IF v_new >= v_target THEN
      UPDATE public.goals SET status = 'concluida' WHERE id = NEW.goal_id AND status = 'ativa';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.goals SET current_amount = GREATEST(0, current_amount - OLD.amount),
      status = CASE WHEN status = 'concluida' AND (current_amount - OLD.amount) < target_amount THEN 'ativa' ELSE status END
      WHERE id = OLD.goal_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER apply_goal_contribution_trg
  AFTER INSERT OR DELETE ON public.goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.apply_goal_contribution();
