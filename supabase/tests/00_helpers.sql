-- Test-Hilfsfunktionen (nur lokale Testdatenbank)
create schema tests;
grant usage on schema tests to anon, authenticated;

create table tests.benutzer (name text primary key, id uuid not null, email text not null);
grant select on tests.benutzer to anon, authenticated;

create function tests.uid(p_name text) returns uuid
language sql stable as $$ select id from tests.benutzer where name = p_name $$;

-- Benutzer registrieren (wie Supabase-Signup); bestaetigt = E-Mail bestätigt
create function tests.registrieren(p_name text, p_email text, p_bestaetigt boolean default true) returns uuid
language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into tests.benutzer values (p_name, v_id, p_email);
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (v_id, p_email, case when p_bestaetigt then now() end, jsonb_build_object('name', p_name));
  return v_id;
end $$;

-- als angemeldeter Benutzer agieren (Rolle authenticated + JWT-Claims wie PostgREST)
create function tests.als(p_name text) returns void
language plpgsql as $$
declare v_b tests.benutzer%rowtype;
begin
  select * into strict v_b from tests.benutzer where name = p_name;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_b.id, 'email', v_b.email, 'role', 'authenticated')::text, false);
  perform set_config('role', 'authenticated', false);
end $$;
grant execute on function tests.als(text) to authenticated, anon;

-- Org eines Benutzers (für Testdaten), ohne RLS
create function tests.org(p_name text) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.org_id from public.mitglieder m where m.user_id = tests.uid(p_name)
$$;

create function tests.ok(p_bedingung boolean, p_text text) returns void
language plpgsql as $$
begin
  if p_bedingung is not true then
    raise exception 'FEHLGESCHLAGEN: %', p_text;
  end if;
  perform set_config('tests.anzahl', (coalesce(nullif(current_setting('tests.anzahl', true), ''), '0')::int + 1)::text, false);
  raise notice 'ok - %', p_text;
end $$;

-- erwartet, dass p_sql mit SQLSTATE p_code scheitert
create function tests.fehler(p_sql text, p_code text, p_text text) returns void
language plpgsql as $$
declare v_state text; v_msg text;
begin
  begin
    execute p_sql;
    v_state := 'kein Fehler';
  exception when others then
    v_state := sqlstate; v_msg := sqlerrm;
  end;
  perform tests.ok(v_state = p_code,
    format('%s  [erwartet %s, erhalten %s %s]', p_text, p_code, v_state, coalesce(v_msg, '')));
end $$;

-- Anzahl betroffener Zeilen (RLS filtert bei UPDATE stillschweigend)
create function tests.zeilen(p_sql text) returns int
language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

-- Testdokumente
create function tests.einsatz(p_id uuid, p_org uuid, p_extra jsonb default '{}') returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', p_id, 'orgId', p_org, 'status', 'vorbereitung', 'art', 'training',
    'datum', '2026-11-12T10:00:00Z', 'geraetIds', '[]'::jsonb, 'flugart', 'VLOS',
    'rollen', '{}'::jsonb, 'vorlageId', 'bfv-checkliste-v9', 'antworten', '{}'::jsonb,
    'ereignisse', '[]'::jsonb, 'fluege', '[]'::jsonb, 'einsatzende', '{}'::jsonb, 'unfall', false,
    'nachtraege', '[]'::jsonb, 'erstelltAm', '2026-11-12T10:00:00Z', 'geaendertAm', '2026-11-12T10:00:00Z')
    || p_extra
$$;

create function tests.pilot(p_id uuid, p_org uuid, p_extra jsonb default '{}') returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', p_id, 'orgId', p_org, 'vorname', 'Max', 'nachname', 'Muster',
    'qualifikationen', '[]'::jsonb, 'freigabe', jsonb_build_object('erteilt', false), 'aktiv', true,
    'erstelltAm', '2026-11-12T10:00:00Z') || p_extra
$$;

create function tests.dok(p_id uuid, p_org uuid, p_extra jsonb default '{}') returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', p_id, 'orgId', p_org, 'erstelltAm', '2026-11-12T10:00:00Z') || p_extra
$$;

grant execute on all functions in schema tests to authenticated, anon;
