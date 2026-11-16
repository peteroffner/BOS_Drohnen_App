-- ============================================================================
-- Verleih von Geräten (inkl. Inventar) an andere Organisationen.
-- Dokument-Tabelle wie geraete; schreiben dürfen admin/teamleiter.
-- ============================================================================

create table public.ausleihen (like public.piloten including defaults including constraints);
alter table public.ausleihen add primary key (id),
  add foreign key (org_id) references public.organisationen (id) on delete cascade;
create index ausleihen_org_updated_idx on public.ausleihen (org_id, updated_at);

create trigger a_dokument before insert or update on public.ausleihen
  for each row execute function public.tg_dokument();

alter table public.ausleihen enable row level security;

create policy lesen on public.ausleihen for select to authenticated
  using (org_id = (select public.meine_org()));
create policy anlegen on public.ausleihen for insert to authenticated
  with check (org_id = (select public.meine_org()) and (select public.meine_rolle()) in ('admin', 'teamleiter'));
create policy aendern on public.ausleihen for update to authenticated
  using      (org_id = (select public.meine_org()) and (select public.meine_rolle()) in ('admin', 'teamleiter'))
  with check (org_id = (select public.meine_org()) and (select public.meine_rolle()) in ('admin', 'teamleiter'));

revoke all on public.ausleihen from public, anon, authenticated;
grant select, insert, update on public.ausleihen to authenticated;
grant all on public.ausleihen to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ausleihen') then
    alter publication supabase_realtime add table public.ausleihen;
  end if;
end $$;
