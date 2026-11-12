-- =============================================================================
-- BOS Drohnen-App – Datenbankschema (Phase 2, Supabase)
-- Design: docs/BACKEND.md · Rechte-Matrix: src/lib/rechte.ts
--
-- Fehlercodes, auf die sich der Sync-Client verlassen kann:
--   42501  Rechte-/Schutzverletzung (RLS, abgeschlossener Einsatz, Freigabe …)
--          -> Outbox-Eintrag "abgelehnt", Datensatz vom Server neu laden
--   23514  Integritätsfehler (id ≠ data.id, org_id ≠ data.orgId, …)
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Typen
-- ----------------------------------------------------------------------------
create type public.rolle as enum ('admin', 'teamleiter', 'pilot', 'leser');

-- ----------------------------------------------------------------------------
-- Dokument-Tabellen (Name = Dexie-Tabelle, data = Objekt aus src/db/types.ts)
-- ----------------------------------------------------------------------------
create table public.organisationen (
  id          uuid primary key,
  org_id      uuid not null,
  data        jsonb not null,
  deleted     boolean not null default false,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  constraint organisationen_org_id_ist_id check (org_id = id)
);

create table public.piloten (
  id          uuid primary key,
  org_id      uuid not null references public.organisationen (id) on delete cascade,
  data        jsonb not null,
  deleted     boolean not null default false,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);

create table public.geraete (like public.piloten including defaults including constraints);
alter table public.geraete add primary key (id),
  add foreign key (org_id) references public.organisationen (id) on delete cascade;

create table public.einsaetze (like public.piloten including defaults including constraints);
alter table public.einsaetze add primary key (id),
  add foreign key (org_id) references public.organisationen (id) on delete cascade;

create table public.wartungen (like public.piloten including defaults including constraints);
alter table public.wartungen add primary key (id),
  add foreign key (org_id) references public.organisationen (id) on delete cascade;

create table public.maengel (like public.piloten including defaults including constraints);
alter table public.maengel add primary key (id),
  add foreign key (org_id) references public.organisationen (id) on delete cascade;

create index organisationen_org_updated_idx on public.organisationen (org_id, updated_at);
create index piloten_org_updated_idx        on public.piloten (org_id, updated_at);
create index geraete_org_updated_idx        on public.geraete (org_id, updated_at);
create index einsaetze_org_updated_idx      on public.einsaetze (org_id, updated_at);
create index wartungen_org_updated_idx      on public.wartungen (org_id, updated_at);
create index maengel_org_updated_idx        on public.maengel (org_id, updated_at);

-- ----------------------------------------------------------------------------
-- Verwaltungstabellen
-- ----------------------------------------------------------------------------
create table public.mitglieder (
  org_id       uuid not null references public.organisationen (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  rolle        public.rolle not null,
  pilot_id     uuid references public.piloten (id) on delete set null,
  email        text,
  anzeigename  text,
  erstellt_am  timestamptz not null default now(),
  primary key (org_id, user_id),
  -- Phase 2: ein Benutzer gehört genau einer Organisation
  constraint mitglieder_ein_benutzer_eine_org unique (user_id)
);
create index mitglieder_pilot_idx on public.mitglieder (pilot_id);

create table public.einladungen (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organisationen (id) on delete cascade,
  email           text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  rolle           public.rolle not null,
  pilot_id        uuid references public.piloten (id) on delete set null,
  erstellt_von    uuid default auth.uid(),
  erstellt_am     timestamptz not null default now(),
  angenommen_am   timestamptz,
  angenommen_von  uuid
);
-- je Organisation höchstens eine offene Einladung pro E-Mail
create unique index einladungen_offen_uidx on public.einladungen (org_id, email) where angenommen_am is null;
create index einladungen_email_idx on public.einladungen (email) where angenommen_am is null;

-- ----------------------------------------------------------------------------
-- Hilfsfunktionen für RLS (security definer, fester search_path)
-- ----------------------------------------------------------------------------
create function public.meine_org() returns uuid
language sql stable security definer set search_path = ''
as $$ select m.org_id from public.mitglieder m where m.user_id = auth.uid() $$;

create function public.meine_rolle() returns public.rolle
language sql stable security definer set search_path = ''
as $$ select m.rolle from public.mitglieder m where m.user_id = auth.uid() $$;

create function public.mein_pilot() returns uuid
language sql stable security definer set search_path = ''
as $$ select m.pilot_id from public.mitglieder m where m.user_id = auth.uid() $$;

-- "eigener" Einsatz: selbst angelegt, als Pilot eingetragen oder Pilot eines Flugs
create function public.einsatz_ist_eigen(p_created_by uuid, p_data jsonb) returns boolean
language sql stable set search_path = ''
as $$
  select coalesce(
    p_created_by = auth.uid()
    or (p_data -> 'rollen' -> 'pilot' ->> 'pilotId') = public.mein_pilot()::text
    or jsonb_path_exists(p_data, '$.fluege[*] ? (@.pilotId == $p)',
                         jsonb_build_object('p', public.mein_pilot()::text)),
    false)
$$;

-- ----------------------------------------------------------------------------
-- Trigger: Dokument-Integrität + Server-Zeitstempel (alle Dokument-Tabellen)
-- ----------------------------------------------------------------------------
create function public.tg_dokument() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.data is null or jsonb_typeof(new.data) <> 'object' then
    raise exception 'data muss ein JSON-Objekt sein' using errcode = '23514';
  end if;
  if lower(new.data ->> 'id') is distinct from new.id::text then
    raise exception 'id (%) passt nicht zu data.id (%)', new.id, new.data ->> 'id' using errcode = '23514';
  end if;
  if tg_table_name = 'organisationen' then
    if new.org_id is distinct from new.id then
      raise exception 'organisationen: org_id muss gleich id sein' using errcode = '23514';
    end if;
  elsif lower(new.data ->> 'orgId') is distinct from new.org_id::text then
    raise exception 'org_id (%) passt nicht zu data.orgId (%)', new.org_id, new.data ->> 'orgId' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    if new.id <> old.id or new.org_id <> old.org_id then
      raise exception 'id/org_id sind unveränderlich' using errcode = '42501';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  -- vom Server gesetzt, Client-Werte werden ignoriert (Grundlage des Pull-Cursors)
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;

create trigger a_dokument before insert or update on public.organisationen for each row execute function public.tg_dokument();
create trigger a_dokument before insert or update on public.piloten        for each row execute function public.tg_dokument();
create trigger a_dokument before insert or update on public.geraete        for each row execute function public.tg_dokument();
create trigger a_dokument before insert or update on public.einsaetze      for each row execute function public.tg_dokument();
create trigger a_dokument before insert or update on public.wartungen      for each row execute function public.tg_dokument();
create trigger a_dokument before insert or update on public.maengel        for each row execute function public.tg_dokument();

-- ----------------------------------------------------------------------------
-- Trigger: abgeschlossene Einsätze sind unveränderlich (gilt für ALLE Rollen,
-- auch service_role). Erlaubt: nur Anhängen an data.nachtraege + geaendertAm.
-- ----------------------------------------------------------------------------
create function public.tg_einsatz_schutz() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_alt jsonb;
  v_neu jsonb;
  i int;
begin
  if tg_op = 'DELETE' then
    if old.data ->> 'status' = 'abgeschlossen'
       and exists (select 1 from public.organisationen o where o.id = old.org_id) then
      raise exception 'Abgeschlossene Einsätze können nicht gelöscht werden' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.data ->> 'status' = 'abgeschlossen' then
    if new.deleted then
      raise exception 'Abgeschlossene Einsätze können nicht gelöscht werden' using errcode = '42501';
    end if;
    if (new.data - 'nachtraege' - 'geaendertAm') is distinct from (old.data - 'nachtraege' - 'geaendertAm') then
      raise exception 'Abgeschlossener Einsatz: nur Nachträge sind erlaubt' using errcode = '42501';
    end if;
    v_alt := coalesce(old.data -> 'nachtraege', '[]'::jsonb);
    v_neu := coalesce(new.data -> 'nachtraege', '[]'::jsonb);
    if jsonb_typeof(v_neu) <> 'array' or jsonb_typeof(v_alt) <> 'array'
       or jsonb_array_length(v_neu) < jsonb_array_length(v_alt) then
      raise exception 'Nachträge dürfen nicht entfernt werden' using errcode = '42501';
    end if;
    for i in 0 .. jsonb_array_length(v_alt) - 1 loop
      if v_neu -> i is distinct from v_alt -> i then
        raise exception 'Bestehende Nachträge sind unveränderlich' using errcode = '42501';
      end if;
    end loop;
  end if;
  return new;
end $$;

create trigger b_einsatz_schutz before update or delete on public.einsaetze
  for each row execute function public.tg_einsatz_schutz();

-- ----------------------------------------------------------------------------
-- Trigger: Piloten – Freigabe/aktiv nur admin, Pilot nur eigener Datensatz
-- (ohne angemeldeten Benutzer, z. B. SQL-Editor/service_role: keine Prüfung)
-- ----------------------------------------------------------------------------
create function public.tg_pilot_schutz() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_rolle public.rolle := public.meine_rolle();
begin
  if auth.uid() is null or v_rolle = 'admin' then
    return new;
  end if;
  if tg_op = 'INSERT' then
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

create trigger b_pilot_schutz before insert or update on public.piloten
  for each row execute function public.tg_pilot_schutz();

-- ----------------------------------------------------------------------------
-- Trigger: Mitglieder – unveränderliche Spalten, Pilot derselben Org,
-- letzter Admin darf nicht entfernt/herabgestuft werden
-- ----------------------------------------------------------------------------
create function public.tg_mitglied_schutz() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.org_id <> old.org_id or new.user_id <> old.user_id then
      raise exception 'org_id/user_id sind unveränderlich' using errcode = '42501';
    end if;
    if new.pilot_id is not null and not exists (
         select 1 from public.piloten p where p.id = new.pilot_id and p.org_id = new.org_id) then
      raise exception 'Pilot gehört nicht zur Organisation' using errcode = '23514';
    end if;
  end if;

  if old.rolle = 'admin' and (tg_op = 'DELETE' or new.rolle <> 'admin') then
    -- Org wird gelöscht bzw. Benutzer-Konto wird gelöscht (Kaskade): erlaubt
    if not exists (select 1 from public.organisationen o where o.id = old.org_id)
       or not exists (select 1 from auth.users u where u.id = old.user_id) then
      return case when tg_op = 'DELETE' then old else new end;
    end if;
    -- serialisiert gleichzeitige Änderungen je Organisation
    perform 1 from public.organisationen o where o.id = old.org_id for update;
    if not exists (select 1 from public.mitglieder m
                   where m.org_id = old.org_id and m.rolle = 'admin' and m.user_id <> old.user_id) then
      raise exception 'Der letzte Administrator kann nicht entfernt oder herabgestuft werden' using errcode = '42501';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger b_mitglied_schutz before update or delete on public.mitglieder
  for each row execute function public.tg_mitglied_schutz();

-- ----------------------------------------------------------------------------
-- Trigger: Einladungen – E-Mail normalisieren, Ersteller vom Server, Pilot der Org
-- ----------------------------------------------------------------------------
create function public.tg_einladung() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  if tg_op = 'INSERT' then
    new.erstellt_von := auth.uid();
    new.erstellt_am := now();
    if auth.uid() is not null then
      new.angenommen_am := null;
      new.angenommen_von := null;
    end if;
  else
    if new.org_id <> old.org_id then
      raise exception 'org_id ist unveränderlich' using errcode = '42501';
    end if;
    new.erstellt_von := old.erstellt_von;
    new.erstellt_am := old.erstellt_am;
  end if;
  if new.pilot_id is not null and not exists (
       select 1 from public.piloten p where p.id = new.pilot_id and p.org_id = new.org_id) then
    raise exception 'Pilot gehört nicht zur Organisation' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger a_einladung before insert or update on public.einladungen
  for each row execute function public.tg_einladung();

-- ----------------------------------------------------------------------------
-- Einladung einlösen (intern) – nur für bestätigte E-Mail-Adressen
-- ----------------------------------------------------------------------------
create function public._einladung_einloesen(p_user_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_einl public.einladungen%rowtype;
begin
  select * into v_user from auth.users u where u.id = p_user_id;
  if not found or v_user.email is null or v_user.email_confirmed_at is null then
    return null;
  end if;
  -- schon Mitglied? -> nichts tun (ein Benutzer = eine Organisation)
  if exists (select 1 from public.mitglieder m where m.user_id = p_user_id) then
    return (select m.org_id from public.mitglieder m where m.user_id = p_user_id);
  end if;

  select * into v_einl from public.einladungen e
   where e.email = lower(btrim(v_user.email)) and e.angenommen_am is null
   order by e.erstellt_am desc
   limit 1
   for update;
  if not found then
    return null;
  end if;

  insert into public.mitglieder (org_id, user_id, rolle, pilot_id, email, anzeigename)
  values (v_einl.org_id, p_user_id, v_einl.rolle, v_einl.pilot_id, lower(v_user.email),
          coalesce(v_user.raw_user_meta_data ->> 'anzeigename', v_user.raw_user_meta_data ->> 'name'));

  update public.einladungen
     set angenommen_am = now(), angenommen_von = p_user_id
   where id = v_einl.id;
  return v_einl.org_id;
end $$;

-- RPC: offene Einladung für die eigene (bestätigte) E-Mail annehmen.
-- Liefert die org_id, oder null wenn keine Einladung vorliegt.
create function public.einladung_annehmen() returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  return public._einladung_einloesen(auth.uid());
end $$;

-- Trigger auf auth.users: bei Registrierung bzw. E-Mail-Bestätigung Einladung einlösen.
create function public.tg_auth_user_einladung() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  begin
    perform public._einladung_einloesen(new.id);
  exception when others then
    -- Registrierung darf nie an der Einladung scheitern
    raise warning 'Einladung für % konnte nicht eingelöst werden: %', new.email, sqlerrm;
  end;
  return new;
end $$;

create trigger bos_einladung_einloesen
  after insert or update of email_confirmed_at on auth.users
  for each row when (new.email_confirmed_at is not null)
  execute function public.tg_auth_user_einladung();

-- ----------------------------------------------------------------------------
-- RPC: Organisation anlegen (Erst-Einrichtung, Aufrufer wird admin)
-- ----------------------------------------------------------------------------
create function public.organisation_anlegen(p_name text, p_typ text, p_bezirk text, p_bundesland text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_id    uuid := gen_random_uuid();
  v_email text;
  v_meta  jsonb;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  -- Benutzer-Zeile sperren: verhindert doppelte Anlage durch parallele Aufrufe
  select u.email, u.raw_user_meta_data into v_email, v_meta from auth.users u where u.id = v_uid for update;
  if exists (select 1 from public.mitglieder m where m.user_id = v_uid) then
    raise exception 'Sie gehören bereits einer Organisation an' using errcode = '42501';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Name der Organisation fehlt' using errcode = '22023';
  end if;
  if p_typ is null or p_typ not in ('FF', 'BF', 'BtF', 'Rettung', 'Polizei', 'Bergrettung', 'Wasserrettung', 'Sonstige') then
    raise exception 'Unbekannter Organisationstyp: %', p_typ using errcode = '22023';
  end if;

  insert into public.organisationen (id, org_id, data)
  values (v_id, v_id, jsonb_strip_nulls(jsonb_build_object(
    'id', v_id,
    'name', btrim(p_name),
    'typ', p_typ,
    'bezirk', nullif(btrim(p_bezirk), ''),
    'bundesland', nullif(btrim(p_bundesland), ''),
    'freigabeRegeln', jsonb_build_object(
      'pflichtQualifikationen', jsonb_build_array('A1_A3'),
      'mindestFluege', 3,
      'zeitraumTage', 90,
      'warnungTageVorAblauf', 60),
    'erstelltAm', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )));

  insert into public.mitglieder (org_id, user_id, rolle, email, anzeigename)
  values (v_id, v_uid, 'admin', lower(coalesce(v_email, auth.email())),
          coalesce(v_meta ->> 'anzeigename', v_meta ->> 'name'));
  return v_id;
end $$;

-- ----------------------------------------------------------------------------
-- RPCs: Mitglieder verwalten (security invoker -> RLS + Trigger greifen)
-- ----------------------------------------------------------------------------
create function public.mitglied_rolle_aendern(p_user_id uuid, p_rolle public.rolle) returns void
language plpgsql set search_path = ''
as $$
begin
  if public.meine_rolle() is distinct from 'admin' then
    raise exception 'Nur Administratoren dürfen Rollen ändern' using errcode = '42501';
  end if;
  update public.mitglieder set rolle = p_rolle
   where user_id = p_user_id and org_id = public.meine_org();
  if not found then
    raise exception 'Mitglied nicht gefunden' using errcode = '42501';
  end if;
end $$;

create function public.mitglied_pilot_zuordnen(p_user_id uuid, p_pilot_id uuid) returns void
language plpgsql set search_path = ''
as $$
begin
  if public.meine_rolle() is distinct from 'admin' then
    raise exception 'Nur Administratoren dürfen Mitglieder ändern' using errcode = '42501';
  end if;
  update public.mitglieder set pilot_id = p_pilot_id
   where user_id = p_user_id and org_id = public.meine_org();
  if not found then
    raise exception 'Mitglied nicht gefunden' using errcode = '42501';
  end if;
end $$;

create function public.mitglied_entfernen(p_user_id uuid) returns void
language plpgsql set search_path = ''
as $$
begin
  if public.meine_rolle() is distinct from 'admin' then
    raise exception 'Nur Administratoren dürfen Mitglieder entfernen' using errcode = '42501';
  end if;
  delete from public.mitglieder where user_id = p_user_id and org_id = public.meine_org();
  if not found then
    raise exception 'Mitglied nicht gefunden' using errcode = '42501';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.organisationen enable row level security;
alter table public.piloten        enable row level security;
alter table public.geraete        enable row level security;
alter table public.einsaetze      enable row level security;
alter table public.wartungen      enable row level security;
alter table public.maengel        enable row level security;
alter table public.mitglieder     enable row level security;
alter table public.einladungen    enable row level security;

-- Lesen: alle Mitglieder lesen alles ihrer Organisation (inkl. Grabsteine für den Sync)
create policy lesen on public.organisationen for select to authenticated using (id = (select public.meine_org()));
create policy lesen on public.piloten        for select to authenticated using (org_id = (select public.meine_org()));
create policy lesen on public.geraete        for select to authenticated using (org_id = (select public.meine_org()));
create policy lesen on public.einsaetze      for select to authenticated using (org_id = (select public.meine_org()));
create policy lesen on public.wartungen      for select to authenticated using (org_id = (select public.meine_org()));
create policy lesen on public.maengel        for select to authenticated using (org_id = (select public.meine_org()));
create policy lesen on public.mitglieder     for select to authenticated using (org_id = (select public.meine_org()));
create policy lesen on public.einladungen    for select to authenticated using (org_id = (select public.meine_org()));

-- organisationen: nur admin ändern. Anlegen nur per RPC organisation_anlegen.
-- Die INSERT-Policy ist nötig, weil Postgres bei Upsert (INSERT … ON CONFLICT DO UPDATE,
-- so pusht der Sync-Client) auch die INSERT-WITH-CHECK-Bedingung prüft. Sie lässt nur
-- die eigene, bereits existierende Org-ID zu -> ein echtes Insert endet immer im Konflikt.
create policy anlegen on public.organisationen for insert to authenticated
  with check (id = (select public.meine_org()) and (select public.meine_rolle()) = 'admin');
create policy aendern on public.organisationen for update to authenticated
  using      (id = (select public.meine_org()) and (select public.meine_rolle()) = 'admin')
  with check (id = (select public.meine_org()) and (select public.meine_rolle()) = 'admin' and not deleted);

-- piloten: admin/teamleiter; pilot nur eigener Datensatz (Freigabe/aktiv: Trigger)
create policy anlegen on public.piloten for insert to authenticated
  with check (org_id = (select public.meine_org()) and (select public.meine_rolle()) in ('admin', 'teamleiter'));
create policy aendern on public.piloten for update to authenticated
  using (org_id = (select public.meine_org()) and (
         (select public.meine_rolle()) in ('admin', 'teamleiter')
      or ((select public.meine_rolle()) = 'pilot' and id = (select public.mein_pilot()))))
  with check (org_id = (select public.meine_org()) and (
         (select public.meine_rolle()) in ('admin', 'teamleiter')
      or ((select public.meine_rolle()) = 'pilot' and id = (select public.mein_pilot()))));

-- geraete, wartungen: admin/teamleiter
create policy anlegen on public.geraete for insert to authenticated
  with check (org_id = (select public.meine_org()) and (select public.meine_rolle()) in ('admin', 'teamleiter'));
create policy aendern on public.geraete for update to authenticated
  using      (org_id = (select public.meine_org()) and (select public.meine_rolle()) in ('admin', 'teamleiter'))
  with check (org_id = (select public.meine_org()) and (select public.meine_rolle()) in ('admin', 'teamleiter'));
create policy anlegen on public.wartungen for insert to authenticated
  with check (org_id = (select public.meine_org()) and (select public.meine_rolle()) in ('admin', 'teamleiter'));
create policy aendern on public.wartungen for update to authenticated
  using      (org_id = (select public.meine_org()) and (select public.meine_rolle()) in ('admin', 'teamleiter'))
  with check (org_id = (select public.meine_org()) and (select public.meine_rolle()) in ('admin', 'teamleiter'));

-- einsaetze: anlegen admin/teamleiter/pilot; ändern admin/teamleiter oder pilot bei
-- eigenem Einsatz. Nachträge an abgeschlossenen Einsätzen ("einsatz.nachtrag")
-- darf jeder Pilot – was dort änderbar ist, begrenzt tg_einsatz_schutz.
create policy anlegen on public.einsaetze for insert to authenticated
  with check (org_id = (select public.meine_org()) and (select public.meine_rolle()) in ('admin', 'teamleiter', 'pilot'));
create policy aendern on public.einsaetze for update to authenticated
  using (org_id = (select public.meine_org()) and (
         (select public.meine_rolle()) in ('admin', 'teamleiter')
      or ((select public.meine_rolle()) = 'pilot'
          and (public.einsatz_ist_eigen(created_by, data) or data ->> 'status' = 'abgeschlossen'))))
  with check (org_id = (select public.meine_org()) and (
         (select public.meine_rolle()) in ('admin', 'teamleiter')
      or ((select public.meine_rolle()) = 'pilot'
          and (public.einsatz_ist_eigen(created_by, data) or data ->> 'status' = 'abgeschlossen'))));

-- maengel: anlegen admin/teamleiter/pilot; ändern admin/teamleiter,
-- pilot nur eigene, nicht behobene (und darf sie nicht als behoben markieren)
create policy anlegen on public.maengel for insert to authenticated
  with check (org_id = (select public.meine_org()) and (
         (select public.meine_rolle()) in ('admin', 'teamleiter')
      or ((select public.meine_rolle()) = 'pilot' and data ->> 'behobenAm' is null)));
create policy aendern on public.maengel for update to authenticated
  using (org_id = (select public.meine_org()) and (
         (select public.meine_rolle()) in ('admin', 'teamleiter')
      or ((select public.meine_rolle()) = 'pilot' and created_by = auth.uid() and data ->> 'behobenAm' is null)))
  with check (org_id = (select public.meine_org()) and (
         (select public.meine_rolle()) in ('admin', 'teamleiter')
      or ((select public.meine_rolle()) = 'pilot' and created_by = auth.uid() and data ->> 'behobenAm' is null)));

-- mitglieder: nur admin ändern/entfernen (neue Mitglieder nur über Einladungen)
create policy aendern on public.mitglieder for update to authenticated
  using      (org_id = (select public.meine_org()) and (select public.meine_rolle()) = 'admin')
  with check (org_id = (select public.meine_org()) and (select public.meine_rolle()) = 'admin');
create policy entfernen on public.mitglieder for delete to authenticated
  using (org_id = (select public.meine_org()) and (select public.meine_rolle()) = 'admin');

-- einladungen: nur admin der eigenen Organisation
create policy anlegen on public.einladungen for insert to authenticated
  with check (org_id = (select public.meine_org()) and (select public.meine_rolle()) = 'admin');
create policy aendern on public.einladungen for update to authenticated
  using      (org_id = (select public.meine_org()) and (select public.meine_rolle()) = 'admin' and angenommen_am is null)
  with check (org_id = (select public.meine_org()) and (select public.meine_rolle()) = 'admin');
create policy entfernen on public.einladungen for delete to authenticated
  using (org_id = (select public.meine_org()) and (select public.meine_rolle()) = 'admin');

-- ----------------------------------------------------------------------------
-- Rechte (anon bekommt nichts; Dokumente nur per Grabstein löschen, kein DELETE)
-- ----------------------------------------------------------------------------
revoke all on public.organisationen, public.piloten, public.geraete, public.einsaetze,
              public.wartungen, public.maengel, public.mitglieder, public.einladungen
  from public, anon, authenticated;

grant select, insert, update on public.organisationen, public.piloten, public.geraete,
                                public.einsaetze, public.wartungen, public.maengel
  to authenticated;
grant select on public.mitglieder to authenticated;
grant update (rolle, pilot_id, anzeigename) on public.mitglieder to authenticated;
grant delete on public.mitglieder to authenticated;
grant select, delete on public.einladungen to authenticated;
grant insert (org_id, email, rolle, pilot_id) on public.einladungen to authenticated;
grant update (email, rolle, pilot_id) on public.einladungen to authenticated;

grant all on public.organisationen, public.piloten, public.geraete, public.einsaetze,
             public.wartungen, public.maengel, public.mitglieder, public.einladungen
  to service_role;

revoke execute on function
  public.meine_org(), public.meine_rolle(), public.mein_pilot(),
  public.einsatz_ist_eigen(uuid, jsonb),
  public.organisation_anlegen(text, text, text, text), public.einladung_annehmen(),
  public.mitglied_rolle_aendern(uuid, public.rolle), public.mitglied_pilot_zuordnen(uuid, uuid),
  public.mitglied_entfernen(uuid),
  public._einladung_einloesen(uuid),
  public.tg_dokument(), public.tg_einsatz_schutz(), public.tg_pilot_schutz(),
  public.tg_mitglied_schutz(), public.tg_einladung(), public.tg_auth_user_einladung()
  from public, anon, authenticated;

grant execute on function
  public.meine_org(), public.meine_rolle(), public.mein_pilot(),
  public.einsatz_ist_eigen(uuid, jsonb),
  public.organisation_anlegen(text, text, text, text), public.einladung_annehmen(),
  public.mitglied_rolle_aendern(uuid, public.rolle), public.mitglied_pilot_zuordnen(uuid, uuid),
  public.mitglied_entfernen(uuid)
  to authenticated;

-- ----------------------------------------------------------------------------
-- Realtime (Postgres Changes) – nur wenn die Supabase-Publikation existiert
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['organisationen', 'piloten', 'geraete', 'einsaetze', 'wartungen', 'maengel'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
