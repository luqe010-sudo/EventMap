-- Run inside the deployment transaction, after creating the RPCs.
-- Synthetic fixtures are invisible to other transactions and fully rolled back.
savepoint rpc_verification;
set local statement_timeout = '30s';

insert into auth.users (id, raw_user_meta_data) values
('e7a00000-0000-4000-8000-000000000001', '{"role":"user"}'),
('e7a00000-0000-4000-8000-000000000002', '{"role":"user"}'),
('e7a00000-0000-4000-8000-000000000003', '{"role":"user"}'),
('e7a00000-0000-4000-8000-000000000004', '{"role":"user"}');
update public.profiles set role = 'organizer' where id = 'e7a00000-0000-4000-8000-000000000003';
update public.profiles set role = 'admin' where id = 'e7a00000-0000-4000-8000-000000000004';
insert into public.organizers (id, name, slug) values
('e7a00000-0000-4000-8000-000000000201', 'RPC rollback fixture', 'rpc-rollback-e7a00000-201');
insert into public.organizer_users (user_id, organizer_id, role) values
('e7a00000-0000-4000-8000-000000000003', 'e7a00000-0000-4000-8000-000000000201', 'owner');
insert into public.events (id, title, slug, start_at, status, visibility, is_cancelled, submitted_by_organizer_id) values
('e7a00000-0000-4000-8000-000000000101', 'RPC fixture public', 'rpc-rollback-e7a00000-101', now() + interval '1 day', 'published', 'public', false, 'e7a00000-0000-4000-8000-000000000201'),
('e7a00000-0000-4000-8000-000000000102', 'RPC fixture draft', 'rpc-rollback-e7a00000-102', now() + interval '1 day', 'draft', 'public', false, null),
('e7a00000-0000-4000-8000-000000000103', 'RPC fixture private', 'rpc-rollback-e7a00000-103', now() + interval '1 day', 'published', 'private', false, null),
('e7a00000-0000-4000-8000-000000000104', 'RPC fixture cancelled', 'rpc-rollback-e7a00000-104', now() + interval '1 day', 'published', 'public', true, null),
('e7a00000-0000-4000-8000-000000000105', 'RPC fixture pending', 'rpc-rollback-e7a00000-105', now() + interval '1 day', 'pending_review', 'public', false, null);

set local role anon;
do $test$ begin
  begin perform public.get_my_saved_events(); raise exception 'Anon read was allowed'; exception when insufficient_privilege then null; end;
  begin perform public.set_my_saved_event('e7a00000-0000-4000-8000-000000000101', true); raise exception 'Anon write was allowed'; exception when insufficient_privilege then null; end;
end $test$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e7a00000-0000-4000-8000-000000000001', true);
do $test$ declare invalid_id uuid; begin
  if (select count(*) from public.get_my_saved_events()) <> 0 then raise exception 'A saw foreign saves'; end if;
  perform public.set_my_saved_event('e7a00000-0000-4000-8000-000000000101', true);
  perform public.set_my_saved_event('e7a00000-0000-4000-8000-000000000101', true);
  if (select count(*) from public.get_my_saved_events('e7a00000-0000-4000-8000-000000000101')) <> 1 then raise exception 'Save was not idempotent'; end if;
  foreach invalid_id in array array['e7a00000-0000-4000-8000-000000000102'::uuid, 'e7a00000-0000-4000-8000-000000000103'::uuid, 'e7a00000-0000-4000-8000-000000000104'::uuid, 'e7a00000-0000-4000-8000-000000000105'::uuid, 'e7a00000-0000-4000-8000-000000000199'::uuid] loop
    begin perform public.set_my_saved_event(invalid_id, true); raise exception 'Nonpublic/missing event was accepted'; exception when insufficient_privilege then null; end;
  end loop;
  begin perform public.set_my_saved_event(null, true); raise exception 'Null event was accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.set_my_saved_event('e7a00000-0000-4000-8000-000000000101', null); raise exception 'Null state was accepted'; exception when invalid_parameter_value then null; end;
end $test$;

select set_config('request.jwt.claim.sub', 'e7a00000-0000-4000-8000-000000000002', true);
do $test$ begin
  if (select count(*) from public.get_my_saved_events()) <> 0 then raise exception 'B saw A saves'; end if;
  perform public.set_my_saved_event('e7a00000-0000-4000-8000-000000000101', false);
  perform public.set_my_saved_event('e7a00000-0000-4000-8000-000000000101', true);
  if (select count(*) from public.get_my_saved_events()) <> 1 then raise exception 'B save failed'; end if;
end $test$;

select set_config('request.jwt.claim.sub', 'e7a00000-0000-4000-8000-000000000003', true);
do $test$ begin
  if (select count(*) from public.get_my_saved_events()) <> 0 then raise exception 'Organizer RPC leaked attendee saves'; end if;
  if (select count(*) from public.saved_events where event_id = 'e7a00000-0000-4000-8000-000000000101') <> 2 then raise exception 'Organizer aggregate changed'; end if;
  perform public.set_my_saved_event('e7a00000-0000-4000-8000-000000000101', false);
end $test$;

select set_config('request.jwt.claim.sub', 'e7a00000-0000-4000-8000-000000000004', true);
do $test$ begin
  if (select count(*) from public.get_my_saved_events()) <> 0 then raise exception 'Admin RPC leaked foreign saves'; end if;
end $test$;

select set_config('request.jwt.claim.sub', 'e7a00000-0000-4000-8000-000000000001', true);
do $test$ begin
  if (select count(*) from public.get_my_saved_events()) <> 1 then raise exception 'B/organizer deleted A save'; end if;
end $test$;
reset role;
update public.events set status = 'archived' where id = 'e7a00000-0000-4000-8000-000000000101';
set local role authenticated;
do $test$ begin
  perform public.set_my_saved_event('e7a00000-0000-4000-8000-000000000101', false);
  perform public.set_my_saved_event('e7a00000-0000-4000-8000-000000000101', false);
  if (select count(*) from public.get_my_saved_events()) <> 0 then raise exception 'Removal after withdrawal failed'; end if;
end $test$;

select set_config('request.jwt.claim.sub', 'e7a00000-0000-4000-8000-000000000002', true);
do $test$ begin
  if (select count(*) from public.get_my_saved_events()) <> 1 then raise exception 'A removal deleted B save'; end if;
end $test$;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
do $test$ begin
  if (select count(*) from public.get_my_saved_events()) <> 0 then raise exception 'Missing JWT leaked saves'; end if;
  begin perform public.set_my_saved_event('e7a00000-0000-4000-8000-000000000101', false); raise exception 'Missing JWT write was allowed'; exception when insufficient_privilege then null; end;
end $test$;
reset role;
rollback to savepoint rpc_verification;
release savepoint rpc_verification;

do $test$ begin
  if exists (select 1 from auth.users where id in ('e7a00000-0000-4000-8000-000000000001', 'e7a00000-0000-4000-8000-000000000002', 'e7a00000-0000-4000-8000-000000000003', 'e7a00000-0000-4000-8000-000000000004')) then raise exception 'Auth fixtures survived rollback'; end if;
  if exists (select 1 from public.events where slug like 'rpc-rollback-e7a00000-%') then raise exception 'Event fixtures survived rollback'; end if;
  if exists (select 1 from public.organizers where slug = 'rpc-rollback-e7a00000-201') then raise exception 'Organizer fixture survived rollback'; end if;
end $test$;
select 'saved_events RPC role/isolation/idempotence/publication/rollback checks passed' as verification;
