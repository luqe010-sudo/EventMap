-- Rollback for supabase/migrations/20261123210000_events_featured_until.sql.
-- Do NOT run automatically. Deploy the code without featured_until first,
-- otherwise public queries that select/filter featured_until will fail.

begin;

do $patch$
declare
  definition text := pg_get_functiondef('public.guard_organizer_event_write()'::regprocedure);
  new_columns constant text := $f$'end_at','featured_until','id','is_all_day'$f$;
  old_columns constant text := $f$'end_at','id','is_all_day'$f$;
  new_insert constant text := $f$OR NEW.is_featured IS DISTINCT FROM false OR NEW.featured_until IS NOT NULL$f$;
  old_insert constant text := $f$OR NEW.is_featured IS DISTINCT FROM false$f$;
begin
  if position(new_columns in definition) = 0 or position(new_insert in definition) = 0 then
    raise exception 'guard_organizer_event_write is not in the patched state; stop and review';
  end if;
  execute replace(replace(definition, new_columns, old_columns), new_insert, old_insert);
end
$patch$;

alter table public.events drop column featured_until;

notify pgrst, 'reload schema';

commit;
