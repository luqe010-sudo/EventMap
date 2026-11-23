-- Paid promotion end date (docs/paid-promotion.md).
-- An event is promoted only while is_featured = true AND featured_until > now().
--
-- The organizer write guard (guard_organizer_event_write, installed 2026-11-16)
-- fails closed on any change to the events column list, so this migration
-- patches exactly two fragments of the live function body in the same
-- transaction: the reviewed column list gains 'featured_until', and organizer
-- inserts must leave featured_until NULL. Organizer updates are already
-- protected because featured_until is not in the update allowlist.
-- If the live body does not contain each fragment exactly once, the whole
-- migration aborts and nothing changes.

begin;

alter table public.events add column featured_until timestamptz;

comment on column public.events.featured_until is
  'Koniec płatnego polecenia. Wydarzenie jest promowane, gdy is_featured = true i featured_until > now(). Ustawia wyłącznie admin.';

-- Keep current featured rows visible: end of the event day (Europe/Warsaw),
-- but no longer than 30 days from now.
update public.events
set featured_until = least(
  ((coalesce(end_at, start_at) at time zone 'Europe/Warsaw')::date + 1)::timestamp at time zone 'Europe/Warsaw' - interval '1 second',
  now() + interval '30 days'
)
where is_featured is true and featured_until is null;

do $patch$
declare
  definition text := pg_get_functiondef('public.guard_organizer_event_write()'::regprocedure);
  old_columns constant text := $f$'end_at','id','is_all_day'$f$;
  new_columns constant text := $f$'end_at','featured_until','id','is_all_day'$f$;
  old_insert constant text := $f$OR NEW.is_featured IS DISTINCT FROM false$f$;
  new_insert constant text := $f$OR NEW.is_featured IS DISTINCT FROM false OR NEW.featured_until IS NOT NULL$f$;
begin
  if (length(definition) - length(replace(definition, old_columns, ''))) / length(old_columns) <> 1 then
    raise exception 'guard_organizer_event_write: reviewed column list not found exactly once; stop and review';
  end if;
  if (length(definition) - length(replace(definition, old_insert, ''))) / length(old_insert) <> 1 then
    raise exception 'guard_organizer_event_write: insert protection fragment not found exactly once; stop and review';
  end if;
  execute replace(replace(definition, old_columns, new_columns), old_insert, new_insert);
end
$patch$;

-- Post-check: the patched guard knows the new column.
do $verify$
begin
  if pg_get_functiondef('public.guard_organizer_event_write()'::regprocedure) not like '%''featured_until''%NEW.featured_until IS NOT NULL%' then
    raise exception 'guard_organizer_event_write patch verification failed';
  end if;
end
$verify$;

notify pgrst, 'reload schema';

commit;
