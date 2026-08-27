
-- =========================================================
-- FASE 5: Multi-tenancy (Famílias / Workspaces)
-- =========================================================

DO $$ BEGIN CREATE TYPE public.family_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabelas base
CREATE TABLE IF NOT EXISTS public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.family_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON public.family_members(family_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.family_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  email text NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.invite_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_family_invites_family ON public.family_invites(family_id);
CREATE INDEX IF NOT EXISTS idx_family_invites_email ON public.family_invites(lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_invites TO authenticated;
GRANT ALL ON public.family_invites TO service_role;
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

-- Adiciona family_id em todas as tabelas de dados ANTES das funções auxiliares
ALTER TABLE public.profiles           ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.accounts           ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.credit_cards       ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.categories         ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.transactions       ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.recurrences        ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.goals              ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.goal_contributions ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

-- Funções auxiliares (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_active_family_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT family_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_family_member(_family_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members WHERE family_id = _family_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_family_admin(_family_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members WHERE family_id = _family_id AND user_id = _user_id AND role = 'admin')
$$;

-- Backfill: cria família para cada perfil existente
DO $$
DECLARE r record; v_fid uuid;
BEGIN
  FOR r IN SELECT p.id, p.name FROM public.profiles p WHERE p.family_id IS NULL LOOP
    INSERT INTO public.families (name, created_by) VALUES (COALESCE(r.name,'Minha')||' (Família)', r.id)
      RETURNING id INTO v_fid;
    INSERT INTO public.family_members (family_id, user_id, role) VALUES (v_fid, r.id, 'admin')
      ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET family_id = v_fid WHERE id = r.id;
  END LOOP;
END $$;

UPDATE public.accounts     a SET family_id = p.family_id FROM public.profiles p WHERE a.owner_id = p.id AND a.family_id IS NULL;
UPDATE public.credit_cards c SET family_id = p.family_id FROM public.profiles p WHERE c.owner_id = p.id AND c.family_id IS NULL;
UPDATE public.categories   c SET family_id = p.family_id FROM public.profiles p WHERE c.owner_id = p.id AND c.family_id IS NULL;
UPDATE public.transactions t SET family_id = p.family_id FROM public.profiles p WHERE t.owner_id = p.id AND t.family_id IS NULL;
UPDATE public.recurrences  r SET family_id = p.family_id FROM public.profiles p WHERE r.owner_id = p.id AND r.family_id IS NULL;
UPDATE public.goals        g SET family_id = p.family_id FROM public.profiles p WHERE g.owner_id = p.id AND g.family_id IS NULL;
UPDATE public.goal_contributions gc SET family_id = g.family_id FROM public.goals g WHERE gc.goal_id = g.id AND gc.family_id IS NULL;
UPDATE public.categories SET family_id = (SELECT id FROM public.families ORDER BY created_at LIMIT 1) WHERE family_id IS NULL;

ALTER TABLE public.profiles           ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.accounts           ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.credit_cards       ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.categories         ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.transactions       ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.recurrences        ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.goals              ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.goal_contributions ALTER COLUMN family_id SET NOT NULL;

-- Autofill de family_id
CREATE OR REPLACE FUNCTION public.set_family_id_from_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid;
BEGIN
  IF NEW.family_id IS NULL THEN
    v_uid := COALESCE(
      CASE WHEN TG_TABLE_NAME = 'goal_contributions' THEN NEW.contributor_id ELSE NEW.owner_id END,
      auth.uid()
    );
    SELECT family_id INTO NEW.family_id FROM public.profiles WHERE id = v_uid;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','credit_cards','categories','transactions','recurrences','goals','goal_contributions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_family_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_family_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_family_id_from_owner()', t);
  END LOOP;
END $$;

-- Policies: families
DROP POLICY IF EXISTS "families_select" ON public.families;
DROP POLICY IF EXISTS "families_update" ON public.families;
DROP POLICY IF EXISTS "families_delete" ON public.families;
DROP POLICY IF EXISTS "families_insert" ON public.families;
CREATE POLICY "families_select" ON public.families FOR SELECT TO authenticated USING (public.is_family_member(id, auth.uid()));
CREATE POLICY "families_insert" ON public.families FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "families_update" ON public.families FOR UPDATE TO authenticated USING (public.is_family_admin(id, auth.uid()));
CREATE POLICY "families_delete" ON public.families FOR DELETE TO authenticated USING (public.is_family_admin(id, auth.uid()));

-- family_members
DROP POLICY IF EXISTS "fm_select" ON public.family_members;
DROP POLICY IF EXISTS "fm_insert" ON public.family_members;
DROP POLICY IF EXISTS "fm_update" ON public.family_members;
DROP POLICY IF EXISTS "fm_delete" ON public.family_members;
CREATE POLICY "fm_select" ON public.family_members FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "fm_insert" ON public.family_members FOR INSERT TO authenticated WITH CHECK (public.is_family_admin(family_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "fm_update" ON public.family_members FOR UPDATE TO authenticated USING (public.is_family_admin(family_id, auth.uid()));
CREATE POLICY "fm_delete" ON public.family_members FOR DELETE TO authenticated USING (public.is_family_admin(family_id, auth.uid()) OR user_id = auth.uid());

-- family_invites
DROP POLICY IF EXISTS "fi_select" ON public.family_invites;
DROP POLICY IF EXISTS "fi_insert" ON public.family_invites;
DROP POLICY IF EXISTS "fi_update" ON public.family_invites;
DROP POLICY IF EXISTS "fi_delete" ON public.family_invites;
CREATE POLICY "fi_select" ON public.family_invites FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "fi_insert" ON public.family_invites FOR INSERT TO authenticated WITH CHECK (public.is_family_admin(family_id, auth.uid()));
CREATE POLICY "fi_update" ON public.family_invites FOR UPDATE TO authenticated USING (public.is_family_admin(family_id, auth.uid()));
CREATE POLICY "fi_delete" ON public.family_invites FOR DELETE TO authenticated USING (public.is_family_admin(family_id, auth.uid()));

-- profiles
DROP POLICY IF EXISTS "Any authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_family_member(family_id, auth.uid()));

-- accounts
DROP POLICY IF EXISTS "View own or shared accounts" ON public.accounts;
DROP POLICY IF EXISTS "Insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Update own accounts or admin" ON public.accounts;
DROP POLICY IF EXISTS "Delete own accounts or admin" ON public.accounts;
CREATE POLICY "accounts_select" ON public.accounts FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "accounts_insert" ON public.accounts FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_family_member(family_id, auth.uid()));
CREATE POLICY "accounts_update" ON public.accounts FOR UPDATE TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "accounts_delete" ON public.accounts FOR DELETE TO authenticated USING (public.is_family_member(family_id, auth.uid()));

-- credit_cards
DROP POLICY IF EXISTS "View own or shared cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Insert own cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Update own cards or admin" ON public.credit_cards;
DROP POLICY IF EXISTS "Delete own cards or admin" ON public.credit_cards;
DROP POLICY IF EXISTS "cc_select" ON public.credit_cards;
DROP POLICY IF EXISTS "cc_insert" ON public.credit_cards;
DROP POLICY IF EXISTS "cc_update" ON public.credit_cards;
DROP POLICY IF EXISTS "cc_delete" ON public.credit_cards;
CREATE POLICY "cc_select" ON public.credit_cards FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "cc_insert" ON public.credit_cards FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_family_member(family_id, auth.uid()));
CREATE POLICY "cc_update" ON public.credit_cards FOR UPDATE TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "cc_delete" ON public.credit_cards FOR DELETE TO authenticated USING (public.is_family_member(family_id, auth.uid()));

-- categories
DROP POLICY IF EXISTS "Authenticated can view categories" ON public.categories;
DROP POLICY IF EXISTS "Users insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users delete own categories" ON public.categories;
CREATE POLICY "cat_select" ON public.categories FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "cat_insert" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "cat_update" ON public.categories FOR UPDATE TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "cat_delete" ON public.categories FOR DELETE TO authenticated USING (public.is_family_member(family_id, auth.uid()));

-- transactions
DROP POLICY IF EXISTS "View own or shared transactions" ON public.transactions;
DROP POLICY IF EXISTS "Insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Update own transactions or admin" ON public.transactions;
DROP POLICY IF EXISTS "Delete own transactions or admin" ON public.transactions;
CREATE POLICY "tx_select" ON public.transactions FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "tx_insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_family_member(family_id, auth.uid()));
CREATE POLICY "tx_update" ON public.transactions FOR UPDATE TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "tx_delete" ON public.transactions FOR DELETE TO authenticated USING (public.is_family_member(family_id, auth.uid()));

-- recurrences
DROP POLICY IF EXISTS "recurrences_select" ON public.recurrences;
DROP POLICY IF EXISTS "recurrences_insert" ON public.recurrences;
DROP POLICY IF EXISTS "recurrences_update" ON public.recurrences;
DROP POLICY IF EXISTS "recurrences_delete" ON public.recurrences;
CREATE POLICY "rec_select" ON public.recurrences FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "rec_insert" ON public.recurrences FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_family_member(family_id, auth.uid()));
CREATE POLICY "rec_update" ON public.recurrences FOR UPDATE TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "rec_delete" ON public.recurrences FOR DELETE TO authenticated USING (public.is_family_member(family_id, auth.uid()));

-- goals
DROP POLICY IF EXISTS "Ver metas próprias ou compartilhadas" ON public.goals;
DROP POLICY IF EXISTS "Criar metas próprias" ON public.goals;
DROP POLICY IF EXISTS "Editar metas próprias" ON public.goals;
DROP POLICY IF EXISTS "Excluir metas próprias" ON public.goals;
CREATE POLICY "goals_select" ON public.goals FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "goals_insert" ON public.goals FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_family_member(family_id, auth.uid()));
CREATE POLICY "goals_update" ON public.goals FOR UPDATE TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "goals_delete" ON public.goals FOR DELETE TO authenticated USING (public.is_family_member(family_id, auth.uid()));

-- goal_contributions
DROP POLICY IF EXISTS "Ver contribuições de metas visíveis" ON public.goal_contributions;
DROP POLICY IF EXISTS "Contribuir em metas visíveis" ON public.goal_contributions;
DROP POLICY IF EXISTS "Apagar contribuição própria ou de meta própria" ON public.goal_contributions;
CREATE POLICY "gc_select" ON public.goal_contributions FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "gc_insert" ON public.goal_contributions FOR INSERT TO authenticated WITH CHECK (contributor_id = auth.uid() AND public.is_family_member(family_id, auth.uid()));
CREATE POLICY "gc_delete" ON public.goal_contributions FOR DELETE TO authenticated USING (public.is_family_member(family_id, auth.uid()));

-- handle_new_user com suporte a família + convite
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT;
  v_theme public.user_theme;
  v_color TEXT;
  v_family_id uuid;
  v_from_invite boolean := false;
  v_invite_id uuid;
BEGIN
  v_name  := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  v_theme := COALESCE((NEW.raw_user_meta_data->>'theme')::public.user_theme, 'rock');
  v_color := CASE WHEN v_theme = 'cute' THEN '#f472b6' ELSE '#dc2626' END;

  IF NEW.raw_user_meta_data ? 'invite_token' THEN
    SELECT id, family_id INTO v_invite_id, v_family_id
      FROM public.family_invites
     WHERE token = (NEW.raw_user_meta_data->>'invite_token')::uuid
       AND status = 'pending' AND expires_at > now()
     LIMIT 1;
    IF v_family_id IS NOT NULL THEN v_from_invite := true; END IF;
  END IF;

  IF v_family_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT id, family_id INTO v_invite_id, v_family_id
      FROM public.family_invites
     WHERE lower(email) = lower(NEW.email)
       AND status = 'pending' AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1;
    IF v_family_id IS NOT NULL THEN v_from_invite := true; END IF;
  END IF;

  IF v_family_id IS NULL THEN
    INSERT INTO public.families (name, created_by) VALUES (v_name || ' (Família)', NEW.id)
      RETURNING id INTO v_family_id;
  END IF;

  INSERT INTO public.family_members (family_id, user_id, role)
    VALUES (v_family_id, NEW.id, CASE WHEN v_from_invite THEN 'member'::public.family_role ELSE 'admin'::public.family_role END)
    ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (id, family_id, name, theme, color)
    VALUES (NEW.id, v_family_id, v_name, v_theme, v_color)
    ON CONFLICT (id) DO UPDATE SET family_id = EXCLUDED.family_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  IF v_from_invite AND v_invite_id IS NOT NULL THEN
    UPDATE public.family_invites SET status = 'accepted', accepted_at = now(), accepted_by = NEW.id WHERE id = v_invite_id;
  END IF;

  IF NOT v_from_invite THEN
    INSERT INTO public.categories (owner_id, family_id, name, kind, icon, is_default) VALUES
      (NEW.id, v_family_id, 'Salário', 'receita', '💼', true),
      (NEW.id, v_family_id, 'Freelance', 'receita', '🧑‍💻', true),
      (NEW.id, v_family_id, 'Venda', 'receita', '🛒', true),
      (NEW.id, v_family_id, 'PIX recebido', 'receita', '⚡', true),
      (NEW.id, v_family_id, 'Cashback', 'receita', '💸', true),
      (NEW.id, v_family_id, 'Restituição', 'receita', '🏛️', true),
      (NEW.id, v_family_id, 'Outros', 'receita', '✨', true),
      (NEW.id, v_family_id, 'Mercado', 'despesa', '🛒', true),
      (NEW.id, v_family_id, 'Alimentação', 'despesa', '🍽️', true),
      (NEW.id, v_family_id, 'Saúde', 'despesa', '🩺', true),
      (NEW.id, v_family_id, 'Farmácia', 'despesa', '💊', true),
      (NEW.id, v_family_id, 'Transporte', 'despesa', '🚗', true),
      (NEW.id, v_family_id, 'Combustível', 'despesa', '⛽', true),
      (NEW.id, v_family_id, 'Uber', 'despesa', '🚕', true),
      (NEW.id, v_family_id, 'Moradia', 'despesa', '🏠', true),
      (NEW.id, v_family_id, 'Água', 'despesa', '💧', true),
      (NEW.id, v_family_id, 'Energia', 'despesa', '💡', true),
      (NEW.id, v_family_id, 'Internet', 'despesa', '🌐', true),
      (NEW.id, v_family_id, 'Telefone', 'despesa', '📱', true),
      (NEW.id, v_family_id, 'Assinaturas', 'despesa', '📺', true),
      (NEW.id, v_family_id, 'Educação', 'despesa', '📚', true),
      (NEW.id, v_family_id, 'Pets', 'despesa', '🐱', true),
      (NEW.id, v_family_id, 'Viagens', 'despesa', '✈️', true),
      (NEW.id, v_family_id, 'Lazer', 'despesa', '🎮', true),
      (NEW.id, v_family_id, 'Compras', 'despesa', '🛍️', true),
      (NEW.id, v_family_id, 'Impostos', 'despesa', '📄', true),
      (NEW.id, v_family_id, 'Outros', 'despesa', '🔖', true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger updated_at em families
DROP TRIGGER IF EXISTS trg_families_updated_at ON public.families;
CREATE TRIGGER trg_families_updated_at BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPCs de família
CREATE OR REPLACE FUNCTION public.create_family_invite(p_email text)
RETURNS TABLE (id uuid, token uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_family_id uuid; v_id uuid; v_token uuid; v_exp timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT family_id INTO v_family_id FROM public.profiles WHERE id = auth.uid();
  IF v_family_id IS NULL THEN RAISE EXCEPTION 'no_family'; END IF;
  IF NOT public.is_family_admin(v_family_id, auth.uid()) THEN RAISE EXCEPTION 'not_admin'; END IF;

  INSERT INTO public.family_invites (family_id, email, invited_by)
    VALUES (v_family_id, lower(trim(p_email)), auth.uid())
    RETURNING family_invites.id, family_invites.token, family_invites.expires_at INTO v_id, v_token, v_exp;
  RETURN QUERY SELECT v_id, v_token, v_exp;
END $$;

CREATE OR REPLACE FUNCTION public.accept_family_invite(p_token uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite record;
  v_old_family uuid;
  v_old_members int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_invite FROM public.family_invites
    WHERE token = p_token AND status = 'pending' AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_or_expired_invite'; END IF;

  SELECT family_id INTO v_old_family FROM public.profiles WHERE id = v_uid;
  IF v_old_family = v_invite.family_id THEN
    UPDATE public.family_invites SET status='accepted', accepted_at=now(), accepted_by=v_uid WHERE id=v_invite.id;
    RETURN v_invite.family_id;
  END IF;

  UPDATE public.accounts     SET family_id = v_invite.family_id WHERE owner_id = v_uid;
  UPDATE public.credit_cards SET family_id = v_invite.family_id WHERE owner_id = v_uid;
  UPDATE public.categories   SET family_id = v_invite.family_id WHERE owner_id = v_uid;
  UPDATE public.transactions SET family_id = v_invite.family_id WHERE owner_id = v_uid;
  UPDATE public.recurrences  SET family_id = v_invite.family_id WHERE owner_id = v_uid;
  UPDATE public.goals        SET family_id = v_invite.family_id WHERE owner_id = v_uid;
  UPDATE public.goal_contributions gc SET family_id = v_invite.family_id
    FROM public.goals g WHERE gc.goal_id = g.id AND g.owner_id = v_uid;

  INSERT INTO public.family_members (family_id, user_id, role)
    VALUES (v_invite.family_id, v_uid, 'member') ON CONFLICT (family_id, user_id) DO NOTHING;
  UPDATE public.profiles SET family_id = v_invite.family_id WHERE id = v_uid;
  DELETE FROM public.family_members WHERE family_id = v_old_family AND user_id = v_uid;

  SELECT count(*) INTO v_old_members FROM public.family_members WHERE family_id = v_old_family;
  IF v_old_members = 0 THEN DELETE FROM public.families WHERE id = v_old_family; END IF;

  UPDATE public.family_invites SET status='accepted', accepted_at=now(), accepted_by=v_uid WHERE id=v_invite.id;
  RETURN v_invite.family_id;
END $$;

CREATE OR REPLACE FUNCTION public.remove_family_member(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_family_id uuid; v_new_family uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT family_id INTO v_family_id FROM public.profiles WHERE id = auth.uid();
  IF NOT public.is_family_admin(v_family_id, auth.uid()) THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_remove_self'; END IF;

  INSERT INTO public.families (name, created_by)
    VALUES ((SELECT COALESCE(name,'Minha') FROM public.profiles WHERE id = p_user_id) || ' (Família)', p_user_id)
    RETURNING id INTO v_new_family;
  INSERT INTO public.family_members (family_id, user_id, role) VALUES (v_new_family, p_user_id, 'admin');

  UPDATE public.accounts     SET family_id = v_new_family WHERE owner_id = p_user_id AND family_id = v_family_id;
  UPDATE public.credit_cards SET family_id = v_new_family WHERE owner_id = p_user_id AND family_id = v_family_id;
  UPDATE public.categories   SET family_id = v_new_family WHERE owner_id = p_user_id AND family_id = v_family_id;
  UPDATE public.transactions SET family_id = v_new_family WHERE owner_id = p_user_id AND family_id = v_family_id;
  UPDATE public.recurrences  SET family_id = v_new_family WHERE owner_id = p_user_id AND family_id = v_family_id;
  UPDATE public.goals        SET family_id = v_new_family WHERE owner_id = p_user_id AND family_id = v_family_id;
  UPDATE public.goal_contributions gc SET family_id = v_new_family
    FROM public.goals g WHERE gc.goal_id = g.id AND g.owner_id = p_user_id AND gc.family_id = v_family_id;

  UPDATE public.profiles SET family_id = v_new_family WHERE id = p_user_id;
  DELETE FROM public.family_members WHERE family_id = v_family_id AND user_id = p_user_id;
END $$;

CREATE OR REPLACE FUNCTION public.preview_family_invite(p_token uuid)
RETURNS TABLE (family_id uuid, family_name text, invited_email text, status public.invite_status, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fi.family_id, f.name, fi.email, fi.status, fi.expires_at
    FROM public.family_invites fi JOIN public.families f ON f.id = fi.family_id
   WHERE fi.token = p_token
$$;

GRANT EXECUTE ON FUNCTION public.preview_family_invite(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_family_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_family_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_family_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_family_id(uuid) TO authenticated;
