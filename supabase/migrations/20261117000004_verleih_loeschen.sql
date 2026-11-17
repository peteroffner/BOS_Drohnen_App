-- ============================================================================
-- Verleih löschen (Grabstein deleted = true) nur durch admin.
-- Teamleiter dürfen Verleihe weiterhin anlegen und die Rückgabe erfassen.
-- ============================================================================

create or replace function public.tg_ausleihe_loeschen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted and not old.deleted
     and coalesce(auth.role(), '') = 'authenticated'
     and public.meine_rolle() is distinct from 'admin' then
    raise exception 'Nur Administratoren dürfen einen Verleih löschen' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger b_ausleihe_loeschen before update on public.ausleihen
  for each row execute function public.tg_ausleihe_loeschen();

revoke execute on function public.tg_ausleihe_loeschen() from public, anon, authenticated;
