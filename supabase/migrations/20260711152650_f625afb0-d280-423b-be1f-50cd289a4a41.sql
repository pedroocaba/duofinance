
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.user_theme AS ENUM ('rock', 'cute');
CREATE TYPE public.account_type AS ENUM ('corrente', 'poupanca', 'carteira_digital', 'investimentos', 'dinheiro');
CREATE TYPE public.transaction_type AS ENUM ('receita', 'despesa', 'transferencia');
CREATE TYPE public.transaction_scope AS ENUM ('individual', 'compartilhado');
CREATE TYPE public.category_kind AS ENUM ('receita', 'despesa');
CREATE TYPE public.card_status AS ENUM ('ativo', 'inativo', 'bloqueado');

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  color TEXT NOT NULL DEFAULT '#dc2626',
  theme public.user_theme NOT NULL DEFAULT 'rock',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.category_kind NOT NULL,
  icon TEXT DEFAULT '💰',
  color TEXT DEFAULT '#71717a',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view categories" ON public.categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own categories" ON public.categories
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users delete own categories" ON public.categories
  FOR DELETE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ACCOUNTS ============
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  bank TEXT,
  type public.account_type NOT NULL DEFAULT 'corrente',
  agency TEXT,
  number TEXT,
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#dc2626',
  icon TEXT DEFAULT '🏦',
  scope public.transaction_scope NOT NULL DEFAULT 'individual',
  notes TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or shared accounts" ON public.accounts
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR scope = 'compartilhado' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own accounts" ON public.accounts
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Update own accounts or admin" ON public.accounts
  FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Delete own accounts or admin" ON public.accounts
  FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CREDIT CARDS ============
CREATE TABLE public.credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank TEXT,
  brand TEXT,
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
  available_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_day INT CHECK (closing_day BETWEEN 1 AND 31),
  due_day INT CHECK (due_day BETWEEN 1 AND 31),
  color TEXT DEFAULT '#dc2626',
  icon TEXT DEFAULT '💳',
  status public.card_status NOT NULL DEFAULT 'ativo',
  scope public.transaction_scope NOT NULL DEFAULT 'individual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_cards TO authenticated;
GRANT ALL ON public.credit_cards TO service_role;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or shared cards" ON public.credit_cards
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR scope = 'compartilhado' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own cards" ON public.credit_cards
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Update own cards or admin" ON public.credit_cards
  FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Delete own cards or admin" ON public.credit_cards
  FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_credit_cards_updated_at BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  scope public.transaction_scope NOT NULL DEFAULT 'individual',
  amount NUMERIC(14,2) NOT NULL,
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  notes TEXT,
  payment_method TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  credit_card_id UUID REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  transfer_to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_owner ON public.transactions(owner_id);
CREATE INDEX idx_transactions_occurred_at ON public.transactions(occurred_at DESC);
CREATE INDEX idx_transactions_scope ON public.transactions(scope);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or shared transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR scope = 'compartilhado' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Update own transactions or admin" ON public.transactions
  FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Delete own transactions or admin" ON public.transactions
  FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUTO-CREATE PROFILE + DEFAULT CATEGORIES ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_theme public.user_theme;
  v_color TEXT;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  v_theme := COALESCE((NEW.raw_user_meta_data->>'theme')::public.user_theme, 'rock');
  v_color := CASE WHEN v_theme = 'cute' THEN '#f472b6' ELSE '#dc2626' END;

  INSERT INTO public.profiles (id, name, theme, color)
  VALUES (NEW.id, v_name, v_theme, v_color)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  -- default receitas
  INSERT INTO public.categories (owner_id, name, kind, icon, is_default) VALUES
    (NEW.id, 'Salário', 'receita', '💼', true),
    (NEW.id, 'Freelance', 'receita', '🧑‍💻', true),
    (NEW.id, 'Venda', 'receita', '🛒', true),
    (NEW.id, 'PIX recebido', 'receita', '⚡', true),
    (NEW.id, 'Cashback', 'receita', '💸', true),
    (NEW.id, 'Restituição', 'receita', '🏛️', true),
    (NEW.id, 'Outros', 'receita', '✨', true);

  -- default despesas
  INSERT INTO public.categories (owner_id, name, kind, icon, is_default) VALUES
    (NEW.id, 'Mercado', 'despesa', '🛒', true),
    (NEW.id, 'Alimentação', 'despesa', '🍽️', true),
    (NEW.id, 'Saúde', 'despesa', '🩺', true),
    (NEW.id, 'Farmácia', 'despesa', '💊', true),
    (NEW.id, 'Transporte', 'despesa', '🚗', true),
    (NEW.id, 'Combustível', 'despesa', '⛽', true),
    (NEW.id, 'Uber', 'despesa', '🚕', true),
    (NEW.id, 'Moradia', 'despesa', '🏠', true),
    (NEW.id, 'Água', 'despesa', '💧', true),
    (NEW.id, 'Energia', 'despesa', '💡', true),
    (NEW.id, 'Internet', 'despesa', '🌐', true),
    (NEW.id, 'Telefone', 'despesa', '📱', true),
    (NEW.id, 'Assinaturas', 'despesa', '📺', true),
    (NEW.id, 'Educação', 'despesa', '📚', true),
    (NEW.id, 'Pets', 'despesa', '🐱', true),
    (NEW.id, 'Viagens', 'despesa', '✈️', true),
    (NEW.id, 'Lazer', 'despesa', '🎮', true),
    (NEW.id, 'Compras', 'despesa', '🛍️', true),
    (NEW.id, 'Impostos', 'despesa', '📄', true),
    (NEW.id, 'Outros', 'despesa', '🔖', true);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ BALANCE MAINTENANCE ============
CREATE OR REPLACE FUNCTION public.apply_transaction_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'receita' AND NEW.account_id IS NOT NULL THEN
      UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'despesa' AND NEW.account_id IS NOT NULL THEN
      UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'transferencia' AND NEW.account_id IS NOT NULL AND NEW.transfer_to_account_id IS NOT NULL THEN
      UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
      UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.transfer_to_account_id;
    END IF;
    IF NEW.credit_card_id IS NOT NULL AND NEW.type = 'despesa' THEN
      UPDATE public.credit_cards SET available_limit = available_limit - NEW.amount WHERE id = NEW.credit_card_id;
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
    IF OLD.credit_card_id IS NOT NULL AND OLD.type = 'despesa' THEN
      UPDATE public.credit_cards SET available_limit = available_limit + OLD.amount WHERE id = OLD.credit_card_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_transactions_balance
  AFTER INSERT OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_transaction_balance();
