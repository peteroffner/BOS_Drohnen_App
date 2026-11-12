-- RLS-/Trigger-Tests. Wird von run.sh nach Stub + Migrationen + 00_helpers.sql ausgeführt.
-- Jeder Fehlschlag bricht mit "FEHLGESCHLAGEN: …" ab (psql ON_ERROR_STOP).
--
-- IDs:  P1/P2/P3 Piloten Org A, PB Pilot Org B, E* Einsätze, M* Mängel
\set P1 '10000000-0000-4000-8000-000000000001'
\set P2 '10000000-0000-4000-8000-000000000002'
\set P3 '10000000-0000-4000-8000-000000000003'
\set PB '10000000-0000-4000-8000-000000000009'

-- =========================================================================
-- 1. Organisation anlegen
-- =========================================================================
select tests.registrieren('a1', 'admin@ff-musterdorf.at');
select tests.registrieren('b1', 'admin@ff-anderswo.at');

select tests.als('a1');
select tests.ok(public.meine_org() is null, 'neuer Benutzer ohne Einladung hat keine Organisation');
select tests.ok((select count(*) from public.organisationen) = 0, 'ohne Mitgliedschaft ist nichts sichtbar');
select tests.fehler($$select public.organisation_anlegen('X', 'Raketen', null, null)$$, '22023', 'unbekannter Org-Typ wird abgelehnt');
select public.organisation_anlegen('FF Musterdorf', 'FF', 'Bezirk Muster', 'Steiermark') as org_a \gset
select tests.ok(public.meine_org() = :'org_a' and public.meine_rolle() = 'admin', 'Ersteller ist admin der neuen Organisation');
select tests.ok((select data->>'id' = :'org_a' and data->>'name' = 'FF Musterdorf' and data->>'typ' = 'FF'
                        and data->'freigabeRegeln' = '{"pflichtQualifikationen":["A1_A3"],"mindestFluege":3,"zeitraumTage":90,"warnungTageVorAblauf":60}'::jsonb
                        and data ? 'erstelltAm' and org_id = id and not data ? 'orgId'
                   from public.organisationen), 'Organisations-Dokument vollständig (freigabeRegeln, erstelltAm)');
select tests.ok((select email from public.mitglieder) = 'admin@ff-musterdorf.at', 'Mitgliedschaft mit E-Mail');
select tests.fehler($$select public.organisation_anlegen('FF Zweite', 'FF', null, null)$$, '42501', 'zweiter Aufruf organisation_anlegen scheitert');

select tests.als('b1');
select public.organisation_anlegen('FF Anderswo', 'BtF', null, null) as org_b \gset
select tests.ok((select not data ? 'bezirk' from public.organisationen), 'leere optionale Felder fehlen im Dokument (statt null)');
insert into public.piloten (id, org_id, data) values (:'PB', :'org_b', tests.pilot(:'PB', :'org_b'));

reset role;
select tests.fehler(format($$set role anon; select public.organisation_anlegen('X','FF',null,null)$$), '42501', 'anon darf organisation_anlegen nicht ausführen');
reset role;

-- =========================================================================
-- 2. Einladungen -> Registrierung -> Mitgliedschaft
-- =========================================================================
select tests.als('a1');
insert into public.piloten (id, org_id, data) values
  (:'P1', :'org_a', tests.pilot(:'P1', :'org_a', '{"vorname":"Paula"}')),
  (:'P2', :'org_a', tests.pilot(:'P2', :'org_a', '{"vorname":"Peter"}'));
insert into public.einladungen (org_id, email, rolle, pilot_id) values
  (:'org_a', '  TeamLeiter@FF-Musterdorf.at ', 'teamleiter', null),
  (:'org_a', 'pilot1@ff-musterdorf.at', 'pilot', :'P1'),
  (:'org_a', 'pilot2@ff-musterdorf.at', 'pilot', :'P2'),
  (:'org_a', 'leser@bezirk.at', 'leser', null),
  (:'org_a', 'spaet@ff-musterdorf.at', 'pilot', null);
select tests.ok((select count(*) from public.einladungen where email = 'teamleiter@ff-musterdorf.at') = 1, 'E-Mail der Einladung wird klein geschrieben/getrimmt');
select tests.ok((select bool_and(erstellt_von = tests.uid('a1')) from public.einladungen), 'erstellt_von vom Server gesetzt');
select tests.fehler(format($$insert into public.einladungen (org_id, email, rolle) values (%L, 'pilot1@ff-musterdorf.at', 'admin')$$, :'org_a'),
                    '23505', 'doppelte offene Einladung je E-Mail/Org abgelehnt');

select tests.als('b1');
select tests.fehler(format($$insert into public.einladungen (org_id, email, rolle) values (%L, 'boese@x.at', 'admin')$$, :'org_a'),
                    '42501', 'Admin einer anderen Org kann keine Einladung in fremde Org anlegen');
select tests.fehler(format($$insert into public.einladungen (org_id, email, rolle, pilot_id) values (%L, 'boese@x.at', 'pilot', %L)$$, :'org_b', :'P1'),
                    '23514', 'Einladung mit Pilot einer fremden Org abgelehnt');
select tests.ok((select count(*) from public.einladungen) = 0, 'Einladungen fremder Org unsichtbar');

reset role;
select tests.registrieren('tl', 'teamleiter@ff-musterdorf.at');
select tests.registrieren('p1', 'Pilot1@FF-Musterdorf.at');
select tests.registrieren('p2', 'pilot2@ff-musterdorf.at');
select tests.registrieren('le', 'leser@bezirk.at');
select tests.registrieren('sp', 'spaet@ff-musterdorf.at', false);
select tests.registrieren('x1', 'ohne@einladung.at');

select tests.ok((select rolle = 'teamleiter' and org_id = :'org_a' from public.mitglieder where user_id = tests.uid('tl')), 'Signup mit Einladung -> teamleiter');
select tests.ok((select rolle = 'pilot' and pilot_id = :'P1' from public.mitglieder where user_id = tests.uid('p1')), 'Signup -> pilot mit Pilot-Zuordnung (E-Mail case-insensitiv)');
select tests.ok((select rolle = 'leser' from public.mitglieder where user_id = tests.uid('le')), 'Signup -> leser');
select tests.ok((select angenommen_am is not null and angenommen_von = tests.uid('p1') from public.einladungen where email = 'pilot1@ff-musterdorf.at'), 'Einladung als angenommen markiert');
select tests.ok(not exists (select 1 from public.mitglieder where user_id = tests.uid('sp')), 'unbestätigte E-Mail erhält noch keine Mitgliedschaft');
update auth.users set email_confirmed_at = now() where id = tests.uid('sp');
select tests.ok((select rolle = 'pilot' from public.mitglieder where user_id = tests.uid('sp')), 'nach E-Mail-Bestätigung -> Mitgliedschaft');
select tests.ok(not exists (select 1 from public.mitglieder where user_id = tests.uid('x1')), 'ohne Einladung keine Mitgliedschaft');

select tests.als('x1');
select tests.ok(public.einladung_annehmen() is null, 'einladung_annehmen ohne Einladung -> null');
select tests.als('a1');
insert into public.einladungen (org_id, email, rolle) values (:'org_a', 'OHNE@einladung.at', 'leser');
select tests.als('x1');
select tests.ok(public.einladung_annehmen() = :'org_a', 'einladung_annehmen für bestehenden Benutzer');
select tests.ok(public.meine_rolle() = 'leser', 'Rolle aus Einladung übernommen');
select tests.ok(public.einladung_annehmen() = :'org_a', 'einladung_annehmen ist idempotent');

-- Einladung für jemanden, der schon einer anderen Org angehört: kein Wechsel
select tests.als('a1');
insert into public.einladungen (org_id, email, rolle) values (:'org_a', 'admin@ff-anderswo.at', 'leser');
select tests.als('b1');
select tests.ok(public.einladung_annehmen() = :'org_b' and public.meine_rolle() = 'admin', 'Einladung verschiebt bestehendes Mitglied nicht in andere Org');

-- =========================================================================
-- 3. Fremde Organisation unsichtbar / nicht beschreibbar
-- =========================================================================
select tests.als('b1');
select tests.ok((select count(*) from public.piloten) = 1, 'Org B sieht nur eigene Piloten');
select tests.ok((select count(*) from public.organisationen) = 1, 'Org B sieht nur eigene Organisation');
select tests.ok((select count(*) from public.mitglieder) = 1, 'Org B sieht nur eigene Mitglieder');
select tests.ok(tests.zeilen(format($$update public.piloten set data = data || '{"telefon":"1"}' where id = %L$$, :'P1')) = 0, 'fremder Pilot nicht änderbar');
select tests.fehler(format($$insert into public.piloten (id, org_id, data) values (%L, %L, tests.pilot(%L, %L))$$, :'P3', :'org_a', :'P3', :'org_a'),
                    '42501', 'Insert mit fremder org_id abgelehnt');
select tests.fehler(format($$insert into public.piloten (id, org_id, data) values (%L, %L, tests.pilot(%L, %L))$$, :'P3', :'org_b', :'P3', :'org_a'),
                    '23514', 'org_id ≠ data.orgId abgelehnt');
select tests.fehler(format($$insert into public.piloten (id, org_id, data) values (%L, %L, tests.pilot(%L, %L))$$, :'P3', :'org_b', :'P2', :'org_b'),
                    '23514', 'id ≠ data.id abgelehnt');
select tests.fehler(format($$update public.piloten set org_id = %L, data = data || jsonb_build_object('orgId', %L::text) where id = %L$$, :'org_a', :'org_a', :'PB'),
                    '42501', 'eigenen Datensatz in fremde Org verschieben abgelehnt');
select tests.fehler(format($$insert into public.piloten (id, org_id, data) values (%L, %L, tests.pilot(%L, %L)) on conflict (id) do update set data = excluded.data$$, :'P1', :'org_b', :'P1', :'org_b'),
                    '42501', 'Upsert auf ID eines fremden Datensatzes abgelehnt');

reset role;
select tests.fehler($$set role anon; select count(*) from public.piloten$$, '42501', 'anon hat keinen Tabellenzugriff');
reset role;
select tests.ok(not has_table_privilege('anon', 'public.einsaetze', 'select') and not has_table_privilege('anon', 'public.mitglieder', 'select'), 'anon ohne Grants');
select tests.ok(not has_function_privilege('anon', 'public.einladung_annehmen()', 'execute'), 'anon ohne Funktionsrechte');
select tests.ok(not has_function_privilege('authenticated', 'public._einladung_einloesen(uuid)', 'execute'), 'interne Funktion nicht aufrufbar');

-- =========================================================================
-- 4. leser kann nicht schreiben
-- =========================================================================
select tests.als('le');
select tests.ok((select count(*) from public.piloten) = 2, 'leser liest Piloten der Org');
select tests.fehler(format($$insert into public.einsaetze (id, org_id, data) values ('20000000-0000-4000-8000-000000000099', %L, tests.einsatz('20000000-0000-4000-8000-000000000099', %L))$$, :'org_a', :'org_a'),
                    '42501', 'leser kann keinen Einsatz anlegen');
select tests.ok(tests.zeilen($$update public.piloten set data = data || '{"telefon":"1"}'$$) = 0, 'leser kann keine Piloten ändern');
select tests.ok(tests.zeilen($$update public.organisationen set data = data || '{"kontakt":"x"}'$$) = 0, 'leser kann Organisation nicht ändern');
select tests.fehler(format($$insert into public.maengel (id, org_id, data) values ('30000000-0000-4000-8000-000000000099', %L, tests.dok('30000000-0000-4000-8000-000000000099', %L))$$, :'org_a', :'org_a'),
                    '42501', 'leser kann keinen Mangel anlegen');
select tests.fehler(format($$insert into public.einladungen (org_id, email, rolle) values (%L, 'x@y.at', 'admin')$$, :'org_a'), '42501', 'leser kann nicht einladen');

-- =========================================================================
-- 5. Einsätze: pilot eigen / fremd, teamleiter alle, Server-Zeitstempel
-- =========================================================================
select tests.als('p1');
insert into public.einsaetze (id, org_id, data, created_by, created_at, updated_by, updated_at)
values ('20000000-0000-4000-8000-000000000001', :'org_a', tests.einsatz('20000000-0000-4000-8000-000000000001', :'org_a'),
        tests.uid('a1'), '2000-01-01', tests.uid('a1'), '2000-01-01');
reset role;
select tests.ok((select created_by = tests.uid('p1') and updated_by = tests.uid('p1') and created_at > '2026-01-01' and updated_at > '2026-01-01'
                 from public.einsaetze where id = '20000000-0000-4000-8000-000000000001'), 'created_*/updated_* beim Anlegen vom Server gesetzt');
select updated_at as e1_vorher from public.einsaetze where id = '20000000-0000-4000-8000-000000000001' \gset

select tests.als('a1');
insert into public.einsaetze (id, org_id, data) values
  ('20000000-0000-4000-8000-000000000002', :'org_a', tests.einsatz('20000000-0000-4000-8000-000000000002', :'org_a')),
  ('20000000-0000-4000-8000-000000000003', :'org_a', tests.einsatz('20000000-0000-4000-8000-000000000003', :'org_a',
      jsonb_build_object('fluege', jsonb_build_array(jsonb_build_object('id', 'f1', 'nr', 1, 'pilotId', :'P1', 'geraetId', 'g')))))
  ,('20000000-0000-4000-8000-000000000004', :'org_a', tests.einsatz('20000000-0000-4000-8000-000000000004', :'org_a',
      jsonb_build_object('rollen', jsonb_build_object('pilot', jsonb_build_object('pilotId', :'P1', 'name', 'Paula')))));

select tests.als('p1');
select tests.ok(tests.zeilen($$update public.einsaetze set data = data || '{"grund":"Brand"}', updated_at = '2000-01-01', updated_by = gen_random_uuid(), created_at = '1999-01-01', created_by = gen_random_uuid() where id = '20000000-0000-4000-8000-000000000001'$$) = 1,
                'pilot ändert selbst angelegten Einsatz');
select tests.ok(tests.zeilen($$update public.einsaetze set data = data || '{"grund":"x"}' where id = '20000000-0000-4000-8000-000000000002'$$) = 0, 'pilot kann fremden Einsatz nicht ändern');
select tests.fehler($$insert into public.einsaetze (id, org_id, data) select id, org_id, data || '{"grund":"y"}' from public.einsaetze where id = '20000000-0000-4000-8000-000000000002' on conflict (id) do update set data = excluded.data$$,
                    '42501', 'pilot: Upsert auf fremden Einsatz -> 42501 (Sync: abgelehnt)');
select tests.ok(tests.zeilen($$update public.einsaetze set data = data || '{"grund":"x"}' where id = '20000000-0000-4000-8000-000000000003'$$) = 1, 'pilot ändert Einsatz, in dem er einen Flug hat');
select tests.ok(tests.zeilen($$update public.einsaetze set data = data || '{"grund":"x"}' where id = '20000000-0000-4000-8000-000000000004'$$) = 1, 'pilot ändert Einsatz, in dem er als Pilot eingetragen ist');
select tests.ok(tests.zeilen($$insert into public.einsaetze (id, org_id, data) select id, org_id, data || '{"grund":"upsert"}' from public.einsaetze where id = '20000000-0000-4000-8000-000000000001' on conflict (id) do update set data = excluded.data, deleted = excluded.deleted$$) = 1,
                'pilot: Upsert (Sync-Push) auf eigenen Einsatz');

reset role;
select tests.ok((select updated_at > :'e1_vorher' and updated_at > '2026-01-01' and updated_by = tests.uid('p1')
                        and created_by = tests.uid('p1') and created_at > '2026-01-01'
                 from public.einsaetze where id = '20000000-0000-4000-8000-000000000001'), 'updated_at/updated_by vom Server gesetzt, created_* unveränderlich');

select tests.als('p2');
select tests.ok(tests.zeilen($$update public.einsaetze set data = data || '{"grund":"x"}' where id = '20000000-0000-4000-8000-000000000001'$$) = 0, 'anderer pilot kann Einsatz von p1 nicht ändern');
select tests.ok(tests.zeilen($$update public.einsaetze set deleted = true where id = '20000000-0000-4000-8000-000000000001'$$) = 0, 'anderer pilot kann Einsatz von p1 nicht löschen');
select tests.fehler($$delete from public.einsaetze where id = '20000000-0000-4000-8000-000000000001'$$, '42501', 'hartes DELETE nicht erlaubt (nur Grabstein)');

select tests.als('tl');
select tests.ok(tests.zeilen($$update public.einsaetze set data = data || '{"grund":"tl"}' where id = '20000000-0000-4000-8000-000000000002'$$) = 1, 'teamleiter ändert fremden Einsatz');
select tests.ok(tests.zeilen($$update public.einsaetze set data = data || '{"grund":"tl"}' where id = '20000000-0000-4000-8000-000000000001'$$) = 1, 'teamleiter ändert Einsatz eines Piloten');

-- =========================================================================
-- 6. Abgeschlossener Einsatz: nur Nachträge, nicht löschbar
-- =========================================================================
select tests.als('tl');
select tests.ok(tests.zeilen($$update public.einsaetze set data = data || '{"status":"abgeschlossen","abgeschlossenAm":"2026-11-12T12:00:00Z"}' where id = '20000000-0000-4000-8000-000000000002'$$) = 1, 'Einsatz abschließen');
select tests.fehler($$update public.einsaetze set data = data || '{"grund":"nachträglich geändert"}' where id = '20000000-0000-4000-8000-000000000002'$$, '42501', 'abgeschlossen: Feldänderung abgelehnt (auch teamleiter)');
select tests.fehler($$update public.einsaetze set data = data || '{"status":"laufend"}' where id = '20000000-0000-4000-8000-000000000002'$$, '42501', 'abgeschlossen: Wiedereröffnen abgelehnt');
select tests.ok(tests.zeilen($$update public.einsaetze set data = data || '{"nachtraege":[{"zeit":"2026-11-13T08:00:00Z","autor":"TL","text":"Akku 2 getauscht"}],"geaendertAm":"2026-11-13T08:00:00Z"}' where id = '20000000-0000-4000-8000-000000000002'$$) = 1,
                'abgeschlossen: Nachtrag möglich');
select tests.ok(tests.zeilen($$update public.einsaetze set data = data where id = '20000000-0000-4000-8000-000000000002'$$) = 1, 'abgeschlossen: unverändertes Speichern (Sync-Wiederholung) möglich');
select tests.fehler($$update public.einsaetze set data = jsonb_set(data, '{nachtraege,0,text}', '"anders"') where id = '20000000-0000-4000-8000-000000000002'$$, '42501', 'abgeschlossen: bestehender Nachtrag unveränderlich');
select tests.fehler($$update public.einsaetze set data = data || '{"nachtraege":[]}' where id = '20000000-0000-4000-8000-000000000002'$$, '42501', 'abgeschlossen: Nachtrag entfernen abgelehnt');
select tests.fehler($$update public.einsaetze set deleted = true where id = '20000000-0000-4000-8000-000000000002'$$, '42501', 'abgeschlossen: als gelöscht markieren abgelehnt');

select tests.als('p2');
select tests.ok(tests.zeilen($$update public.einsaetze set data = jsonb_set(data, '{nachtraege}', (data->'nachtraege') || '[{"zeit":"2026-11-13T09:00:00Z","autor":"P2","text":"Ergänzung"}]') where id = '20000000-0000-4000-8000-000000000002'$$) = 1,
                'pilot: Nachtrag an abgeschlossenem Einsatz (einsatz.nachtrag)');
select tests.fehler($$update public.einsaetze set data = data || '{"grund":"p2"}' where id = '20000000-0000-4000-8000-000000000002'$$, '42501', 'pilot: abgeschlossener fremder Einsatz sonst unveränderlich');

reset role;
select tests.fehler($$delete from public.einsaetze where id = '20000000-0000-4000-8000-000000000002'$$, '42501', 'abgeschlossen: auch Server-Rolle kann nicht löschen');
select tests.fehler($$update public.einsaetze set data = data || '{"grund":"db"}' where id = '20000000-0000-4000-8000-000000000002'$$, '42501', 'abgeschlossen: auch Server-Rolle kann nicht ändern');
select tests.ok((select jsonb_array_length(data->'nachtraege') = 2 from public.einsaetze where id = '20000000-0000-4000-8000-000000000002'), 'zwei Nachträge gespeichert');

-- =========================================================================
-- 7. Piloten: Freigabe/aktiv nur admin, pilot nur eigener Datensatz
-- =========================================================================
select tests.als('p1');
select tests.fehler(format($$update public.piloten set data = jsonb_set(data, '{freigabe}', '{"erteilt":true}') where id = %L$$, :'P1'), '42501', 'pilot kann eigene Freigabe nicht setzen');
select tests.fehler(format($$update public.piloten set data = data || '{"aktiv":false}' where id = %L$$, :'P1'), '42501', 'pilot kann aktiv nicht ändern');
select tests.ok(tests.zeilen(format($$update public.piloten set data = data || '{"telefon":"0664 1"}' where id = %L$$, :'P1')) = 1, 'pilot ändert eigene Stammdaten');
select tests.ok(tests.zeilen(format($$update public.piloten set data = data || '{"telefon":"0664 2"}' where id = %L$$, :'P2')) = 0, 'pilot kann fremden Piloten-Datensatz nicht ändern');
select tests.fehler(format($$update public.piloten set deleted = true where id = %L$$, :'P1'), '42501', 'pilot kann eigenen Datensatz nicht löschen');
select tests.fehler(format($$insert into public.piloten (id, org_id, data) values (%L, %L, tests.pilot(%L, %L))$$, :'P3', :'org_a', :'P3', :'org_a'), '42501', 'pilot kann keine Piloten anlegen');

select tests.als('tl');
select tests.fehler(format($$update public.piloten set data = jsonb_set(data, '{freigabe}', '{"erteilt":true}') where id = %L$$, :'P2'), '42501', 'teamleiter kann Freigabe nicht erteilen');
select tests.fehler(format($$insert into public.piloten (id, org_id, data) values (%L, %L, tests.pilot(%L, %L, '{"freigabe":{"erteilt":true}}'))$$, :'P3', :'org_a', :'P3', :'org_a'), '42501', 'teamleiter kann Piloten nicht mit Freigabe anlegen');
select tests.ok(tests.zeilen(format($$insert into public.piloten (id, org_id, data) values (%L, %L, tests.pilot(%L, %L))$$, :'P3', :'org_a', :'P3', :'org_a')) = 1, 'teamleiter legt Piloten an');
select tests.ok(tests.zeilen(format($$update public.piloten set data = data || '{"dienstgrad":"OFM"}' where id = %L$$, :'P2')) = 1, 'teamleiter ändert Piloten-Stammdaten');

select tests.als('a1');
select tests.ok(tests.zeilen(format($$update public.piloten set data = jsonb_set(data, '{freigabe}', '{"erteilt":true,"erteiltVon":"Admin"}') where id = %L$$, :'P1')) = 1, 'admin erteilt Freigabe');
select tests.ok(tests.zeilen(format($$update public.piloten set data = data || '{"aktiv":false}' where id = %L$$, :'P2')) = 1, 'admin deaktiviert Piloten');
select tests.als('p1');
select tests.ok(tests.zeilen(format($$update public.piloten set data = data || '{"telefon":"0664 3"}' where id = %L$$, :'P1')) = 1, 'pilot ändert Stammdaten bei unveränderter Freigabe');
-- Upsert (so schreibt der Sync-Client): BEFORE-INSERT-Trigger läuft auch im Konfliktfall
select tests.ok(tests.zeilen(format($$insert into public.piloten (id, org_id, data, deleted) select id, org_id, data || '{"telefon":"0664 4"}', false from public.piloten where id = %L on conflict (id) do update set data = excluded.data, deleted = excluded.deleted$$, :'P1')) = 1,
                'pilot: Upsert eigener Stammdaten bei erteilter Freigabe');
select tests.fehler(format($$insert into public.piloten (id, org_id, data, deleted) select id, org_id, jsonb_set(data, '{freigabe}', '{"erteilt":true,"erteiltVon":"selbst"}'), false from public.piloten where id = %L on conflict (id) do update set data = excluded.data$$, :'P1'),
                '42501', 'pilot: Upsert mit geänderter Freigabe abgelehnt');
select tests.fehler(format($$insert into public.piloten (id, org_id, data, deleted) select id, org_id, data || '{"telefon":"x"}', false from public.piloten where id = %L on conflict (id) do update set data = excluded.data$$, :'P2'),
                '42501', 'pilot: Upsert fremden Piloten abgelehnt');
select tests.als('tl');
select tests.ok(tests.zeilen(format($$insert into public.piloten (id, org_id, data, deleted) select id, org_id, data || '{"dienstgrad":"HFM"}', false from public.piloten where id = %L on conflict (id) do update set data = excluded.data, deleted = excluded.deleted$$, :'P1')) = 1,
                'teamleiter: Upsert eines freigegebenen Piloten (Freigabe unverändert)');
select tests.fehler(format($$insert into public.piloten (id, org_id, data, deleted) select id, org_id, jsonb_set(data, '{freigabe,erteilt}', 'false'), false from public.piloten where id = %L on conflict (id) do update set data = excluded.data$$, :'P1'),
                '42501', 'teamleiter: Upsert mit entzogener Freigabe abgelehnt');

-- =========================================================================
-- 8. Geräte / Wartungen / Mängel
-- =========================================================================
select tests.als('p1');
select tests.fehler(format($$insert into public.geraete (id, org_id, data) values ('40000000-0000-4000-8000-000000000001', %L, tests.dok('40000000-0000-4000-8000-000000000001', %L))$$, :'org_a', :'org_a'), '42501', 'pilot kann kein Gerät anlegen');
select tests.als('tl');
insert into public.geraete (id, org_id, data) values ('40000000-0000-4000-8000-000000000001', :'org_a', tests.dok('40000000-0000-4000-8000-000000000001', :'org_a', '{"name":"Hornisse 1"}'));
insert into public.wartungen (id, org_id, data) values ('50000000-0000-4000-8000-000000000001', :'org_a', tests.dok('50000000-0000-4000-8000-000000000001', :'org_a'));
select tests.ok((select count(*) from public.geraete) = 1 and (select count(*) from public.wartungen) = 1, 'teamleiter legt Gerät und Wartung an');
select tests.als('p1');
select tests.ok(tests.zeilen($$update public.geraete set data = data || '{"status":"wartung"}'$$) = 0, 'pilot kann Gerät nicht ändern');
select tests.ok(tests.zeilen($$update public.wartungen set data = data || '{"bemerkung":"x"}'$$) = 0, 'pilot kann Wartung nicht ändern');

select tests.als('p1');
insert into public.maengel (id, org_id, data) values ('30000000-0000-4000-8000-000000000001', :'org_a', tests.dok('30000000-0000-4000-8000-000000000001', :'org_a', '{"beschreibung":"Propeller beschädigt","quelle":"nachkontrolle"}'));
select tests.ok(true, 'pilot legt Mangel an');
select tests.fehler(format($$insert into public.maengel (id, org_id, data) values ('30000000-0000-4000-8000-000000000003', %L, tests.dok('30000000-0000-4000-8000-000000000003', %L, '{"behobenAm":"2026-11-12"}'))$$, :'org_a', :'org_a'), '42501', 'pilot kann keinen behobenen Mangel anlegen');
select tests.ok(tests.zeilen($$update public.maengel set data = data || '{"beschreibung":"Propeller links beschädigt"}' where id = '30000000-0000-4000-8000-000000000001'$$) = 1, 'pilot ändert eigenen offenen Mangel');
select tests.fehler($$update public.maengel set data = data || '{"behobenAm":"2026-11-12"}' where id = '30000000-0000-4000-8000-000000000001'$$, '42501', 'pilot kann Mangel nicht beheben');
select tests.als('tl');
insert into public.maengel (id, org_id, data) values ('30000000-0000-4000-8000-000000000002', :'org_a', tests.dok('30000000-0000-4000-8000-000000000002', :'org_a', '{"beschreibung":"Gimbal"}'));
select tests.als('p1');
select tests.ok(tests.zeilen($$update public.maengel set data = data || '{"beschreibung":"x"}' where id = '30000000-0000-4000-8000-000000000002'$$) = 0, 'pilot kann fremden Mangel nicht ändern');
select tests.als('tl');
select tests.ok(tests.zeilen($$update public.maengel set data = data || '{"behobenAm":"2026-11-12","behobenVon":"TL"}' where id = '30000000-0000-4000-8000-000000000001'$$) = 1, 'teamleiter behebt Mangel');
select tests.als('p1');
select tests.ok(tests.zeilen($$update public.maengel set data = data || '{"beschreibung":"y"}' where id = '30000000-0000-4000-8000-000000000001'$$) = 0, 'pilot kann behobenen Mangel nicht mehr ändern');

-- =========================================================================
-- 9. Organisation ändern
-- =========================================================================
select tests.als('tl');
select tests.ok(tests.zeilen($$update public.organisationen set data = data || '{"kontakt":"tl"}'$$) = 0, 'teamleiter kann Organisation nicht ändern');
select tests.als('a1');
select tests.ok(tests.zeilen($$update public.organisationen set data = jsonb_set(data, '{freigabeRegeln,mindestFluege}', '5')$$) = 1, 'admin ändert Freigaberegeln');
select tests.ok(tests.zeilen($$insert into public.organisationen (id, org_id, data) select id, org_id, data || '{"kontakt":"112"}' from public.organisationen on conflict (id) do update set data = excluded.data$$) = 1,
                'admin: Upsert (Sync-Push) der Organisation');
select tests.fehler($$update public.organisationen set deleted = true$$, '42501', 'Organisation kann nicht als gelöscht markiert werden');
select tests.fehler($$insert into public.organisationen (id, org_id, data) values ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '{"id":"60000000-0000-4000-8000-000000000001"}')$$,
                    '42501', 'Organisation nicht direkt anlegbar (nur per RPC)');

-- =========================================================================
-- 10. Mitglieder / Rollen / letzter Admin
-- =========================================================================
select tests.als('tl');
select tests.fehler(format($$select public.mitglied_rolle_aendern(%L, 'admin')$$, tests.uid('tl')), '42501', 'teamleiter kann sich nicht selbst zum admin machen (RPC)');
select tests.ok(tests.zeilen(format($$update public.mitglieder set rolle = 'admin' where user_id = %L$$, tests.uid('tl'))) = 0, 'teamleiter kann sich nicht selbst zum admin machen (UPDATE)');
select tests.fehler(format($$update public.mitglieder set org_id = %L where user_id = %L$$, :'org_b', tests.uid('tl')), '42501', 'org_id der Mitgliedschaft nicht änderbar');
select tests.fehler(format($$insert into public.mitglieder (org_id, user_id, rolle) values (%L, %L, 'admin')$$, :'org_a', tests.uid('x1')), '42501', 'Mitgliedschaft nicht direkt anlegbar');
select tests.als('p1');
select tests.ok(tests.zeilen($$delete from public.einladungen$$) = 0, 'pilot kann keine Einladungen löschen');
select tests.ok(tests.zeilen($$delete from public.mitglieder$$) = 0, 'pilot kann keine Mitglieder entfernen');

select tests.als('a1');
select tests.fehler(format($$select public.mitglied_rolle_aendern(%L, 'teamleiter')$$, tests.uid('a1')), '42501', 'letzter Admin kann sich nicht herabstufen');
select tests.fehler(format($$select public.mitglied_entfernen(%L)$$, tests.uid('a1')), '42501', 'letzter Admin kann nicht entfernt werden');
select tests.fehler(format($$update public.mitglieder set rolle = 'leser' where user_id = %L$$, tests.uid('a1')), '42501', 'letzter Admin: direktes UPDATE abgelehnt');
select tests.fehler(format($$select public.mitglied_rolle_aendern(%L, 'leser')$$, tests.uid('b1')), '42501', 'admin kann Mitglied fremder Org nicht ändern');
select tests.fehler(format($$select public.mitglied_pilot_zuordnen(%L, %L)$$, tests.uid('p2'), :'PB'), '23514', 'Pilot fremder Org kann nicht zugeordnet werden');
select public.mitglied_pilot_zuordnen(tests.uid('sp'), :'P3');
select tests.ok((select pilot_id = :'P3' from public.mitglieder where user_id = tests.uid('sp')), 'admin ordnet Pilot zu');
select public.mitglied_rolle_aendern(tests.uid('tl'), 'admin');
select public.mitglied_rolle_aendern(tests.uid('a1'), 'teamleiter');
select tests.ok(public.meine_rolle() = 'teamleiter', 'mit zweitem Admin ist Herabstufen möglich');
select tests.als('tl');
select public.mitglied_rolle_aendern(tests.uid('a1'), 'admin');
select public.mitglied_entfernen(tests.uid('le'));
select tests.ok(not exists (select 1 from public.mitglieder where user_id = tests.uid('le')), 'admin entfernt Mitglied');
select tests.als('le');
select tests.ok((select count(*) from public.einsaetze) = 0, 'entferntes Mitglied sieht nichts mehr');
select tests.als('b1');
select tests.fehler(format($$select public.mitglied_rolle_aendern(%L, 'pilot')$$, tests.uid('b1')), '42501', 'einziger Admin von Org B kann sich nicht herabstufen');

-- Konto-Löschung (Kaskade) ist auch für den letzten Admin möglich
reset role;
delete from auth.users where id = tests.uid('b1');
select tests.ok(not exists (select 1 from public.mitglieder where org_id = :'org_b'), 'Löschen des Benutzerkontos entfernt Mitgliedschaft');

-- =========================================================================
-- 11. Realtime / RLS aktiv
-- =========================================================================
select tests.ok((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public') = 6, 'sechs Tabellen in supabase_realtime');
select tests.ok((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.organisationen'::regclass, 'public.piloten'::regclass, 'public.geraete'::regclass, 'public.einsaetze'::regclass,
   'public.wartungen'::regclass, 'public.maengel'::regclass, 'public.mitglieder'::regclass, 'public.einladungen'::regclass)), 'RLS auf allen Tabellen aktiv');
select tests.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')), 'alle security-definer-Funktionen mit festem search_path');

select 'ALLE TESTS BESTANDEN: ' || current_setting('tests.anzahl') as ergebnis;
