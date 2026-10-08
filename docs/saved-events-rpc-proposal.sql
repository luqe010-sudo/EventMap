-- APPROVED AND APPLIED to EventMap on 2026-10-05 after explicit user approval.
-- Historical filename retained; do not reapply (functions already exist).
-- No tables, columns, row policies or existing grants are changed.
-- Deployed with transaction tests and rolled-back synthetic fixtures.
begin;
set local lock_timeout = '5s';

create function public.get_my_saved_events(p_event_id uuid default null)
returns table(event_id uuid, created_at timestamptz)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select s.event_id, s.created_at
  from public.saved_events as s
  where s.user_id = (select auth.uid())
    and (p_event_id is null or s.event_id = p_event_id)
  order by s.created_at desc, s.event_id;
$$;

create function public.set_my_saved_event(p_event_id uuid, p_saved boolean)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_event_id is null or p_saved is null then
    raise exception 'Event and save state are required' using errcode = '22023';
  end if;

  if p_saved then
    -- Lock the event row while validating and saving to avoid a concurrent
    -- cancellation/unpublication between the check and the insert.
    perform 1 from public.events as e
    where e.id = p_event_id and e.status = 'published'
      and e.visibility = 'public' and e.is_cancelled is not true
    for share;
    if not found then
      raise exception 'Event is not publicly available' using errcode = '42501';
    end if;
    insert into public.saved_events (user_id, event_id)
      values (caller_id, p_event_id)
      on conflict (user_id, event_id) do nothing;
  else
    delete from public.saved_events as s
      where s.user_id = caller_id and s.event_id = p_event_id;
  end if;
  return p_saved;
end;
$$;

revoke all on function public.get_my_saved_events(uuid) from public, anon;
revoke all on function public.set_my_saved_event(uuid, boolean) from public, anon;
grant execute on function public.get_my_saved_events(uuid) to authenticated;
grant execute on function public.set_my_saved_event(uuid, boolean) to authenticated;
commit;

-- Rollback (separate reviewed action, only if no other consumer uses the RPC):
-- drop function public.get_my_saved_events(uuid);
-- drop function public.set_my_saved_event(uuid, boolean);
