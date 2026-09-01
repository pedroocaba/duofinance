-- Fecha lacuna de RLS encontrada na Auditoria Técnica DuoFinance (achado P5).
--
-- As policies de UPDATE criadas em 20260719173808 validam apenas a linha
-- EXISTENTE (USING), sem revalidar os NOVOS valores (WITH CHECK). Isso
-- permite, em tese, que um membro da família reatribua um registro para um
-- family_id diferente através de um UPDATE comum, já que apenas a posse da
-- linha original é checada.
--
-- Esta migration adiciona WITH CHECK idêntico ao USING em todas as policies
-- de UPDATE afetadas, sem alterar nenhum comportamento de leitura/insert/delete
-- nem exigir mudança de código no frontend.

DROP POLICY IF EXISTS "accounts_update" ON public.accounts;
CREATE POLICY "accounts_update" ON public.accounts FOR UPDATE TO authenticated
  USING (public.is_family_member(family_id, auth.uid()))
  WITH CHECK (public.is_family_member(family_id, auth.uid()));

DROP POLICY IF EXISTS "cc_update" ON public.credit_cards;
CREATE POLICY "cc_update" ON public.credit_cards FOR UPDATE TO authenticated
  USING (public.is_family_member(family_id, auth.uid()))
  WITH CHECK (public.is_family_member(family_id, auth.uid()));

DROP POLICY IF EXISTS "cat_update" ON public.categories;
CREATE POLICY "cat_update" ON public.categories FOR UPDATE TO authenticated
  USING (public.is_family_member(family_id, auth.uid()))
  WITH CHECK (public.is_family_member(family_id, auth.uid()));

DROP POLICY IF EXISTS "tx_update" ON public.transactions;
CREATE POLICY "tx_update" ON public.transactions FOR UPDATE TO authenticated
  USING (public.is_family_member(family_id, auth.uid()))
  WITH CHECK (public.is_family_member(family_id, auth.uid()));

DROP POLICY IF EXISTS "rec_update" ON public.recurrences;
CREATE POLICY "rec_update" ON public.recurrences FOR UPDATE TO authenticated
  USING (public.is_family_member(family_id, auth.uid()))
  WITH CHECK (public.is_family_member(family_id, auth.uid()));

DROP POLICY IF EXISTS "goals_update" ON public.goals;
CREATE POLICY "goals_update" ON public.goals FOR UPDATE TO authenticated
  USING (public.is_family_member(family_id, auth.uid()))
  WITH CHECK (public.is_family_member(family_id, auth.uid()));
