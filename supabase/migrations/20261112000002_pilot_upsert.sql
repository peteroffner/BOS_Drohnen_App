-- =============================================================================
-- Fix: Piloten-Schutz bei Upsert (INSERT … ON CONFLICT DO UPDATE)
--
-- Der Sync-Client schreibt per Upsert. Postgres führt dabei zuerst die
-- BEFORE-INSERT-Trigger für die vorgeschlagene Zeile aus – auch wenn die Zeile
-- schon existiert und der Konflikt danach zu einem UPDATE wird. Der INSERT-Zweig
-- von tg_pilot_schutz lehnte deshalb JEDE Änderung eines freigegebenen Piloten
-- durch Teamleiter oder den Piloten selbst ab („Freigabe darf nur ein
-- Administrator erteilen“), obwohl sich die Freigabe gar nicht änderte.
--
-- Neu: existiert der Datensatz bereits, prüft der INSERT-Zweig nichts – für den
-- Konfliktfall greifen der BEFORE-UPDATE-Zweig (Freigabe/aktiv unverändert,
-- Pilot nur eigener Datensatz) und die UPDATE-Policy.
-- =============================================================================

create or replace function public.tg_pilot_schutz() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_rolle public.rolle := public.meine_rolle();
begin
  if auth.uid() is null or v_rolle = 'admin' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Upsert auf einen bestehenden Datensatz: wird zum UPDATE (dort geprüft)
    if exists (select 1 from public.piloten p where p.id = new.id) then
      return new;
    end if;
    if new.data -> 'freigabe' -> 'erteilt' = 'true'::jsonb then
      raise exception 'Freigabe darf nur ein Administrator erteilen' using errcode = '42501';
    end if;
    return new;
  end if;
  if (new.data -> 'freigabe') is distinct from (old.data -> 'freigabe') then
    raise exception 'Freigabe darf nur ein Administrator ändern' using errcode = '42501';
  end if;
  if (new.data -> 'aktiv') is distinct from (old.data -> 'aktiv') then
    raise exception 'aktiv/inaktiv darf nur ein Administrator ändern' using errcode = '42501';
  end if;
  if v_rolle = 'pilot' then
    if new.id is distinct from public.mein_pilot() then
      raise exception 'Piloten dürfen nur den eigenen Datensatz ändern' using errcode = '42501';
    end if;
    if new.deleted <> old.deleted then
      raise exception 'Piloten dürfen den eigenen Datensatz nicht löschen' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.tg_pilot_schutz() from public, anon, authenticated;

-- Upsert prüft auch die INSERT-Policy. Damit ein Pilot seinen eigenen (immer schon
-- existierenden, siehe mitglieder.pilot_id → piloten) Datensatz per Sync ändern kann,
-- muss die INSERT-Policy diesen Fall zulassen. Ein echtes Insert endet immer im
-- Konflikt (der Datensatz existiert), d. h. Piloten können weiterhin keine neuen
-- Piloten anlegen.
drop policy anlegen on public.piloten;
create policy anlegen on public.piloten for insert to authenticated
  with check (org_id = (select public.meine_org()) and (
         (select public.meine_rolle()) in ('admin', 'teamleiter')
      or ((select public.meine_rolle()) = 'pilot' and id = (select public.mein_pilot()))));
