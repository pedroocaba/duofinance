CREATE OR REPLACE FUNCTION public.set_family_id_from_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid;
BEGIN
  IF NEW.family_id IS NULL THEN
    IF TG_TABLE_NAME = 'goal_contributions' THEN
      v_uid := COALESCE(NEW.contributor_id, auth.uid());
    ELSE
      v_uid := COALESCE(NEW.owner_id, auth.uid());
    END IF;
    SELECT family_id INTO NEW.family_id FROM public.profiles WHERE id = v_uid;
  END IF;
  RETURN NEW;
END $function$;