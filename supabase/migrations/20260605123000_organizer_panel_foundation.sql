create extension if not exists "pgcrypto";

alter table public.events
  add column if not exists review_note text;

create table if not exists public.event_moderation_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  reviewed_by uuid references auth.users(id),
  old_status text,
  new_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists event_moderation_logs_event_id_created_at_idx
  on public.event_moderation_logs(event_id, created_at desc);

create index if not exists event_moderation_logs_reviewed_by_idx
  on public.event_moderation_logs(reviewed_by);

create table if not exists public.event_analytics (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  event_type text not null,
  user_id uuid references auth.users(id),
  session_id text,
  created_at timestamptz not null default now(),
  constraint event_analytics_event_type_check check (
    event_type in (
      'view',
      'phone_click',
      'website_click',
      'ticket_click',
      'map_click',
      'share_click',
      'save_click'
    )
  )
);

create index if not exists event_analytics_event_id_created_at_idx
  on public.event_analytics(event_id, created_at desc);

create index if not exists event_analytics_event_type_idx
  on public.event_analytics(event_type);

create index if not exists event_analytics_session_id_idx
  on public.event_analytics(session_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null,
  message text,
  type text,
  is_read boolean not null default false,
  related_event_id uuid references public.events(id),
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_related_event_id_idx
  on public.notifications(related_event_id);

grant insert on public.event_analytics to anon, authenticated;
grant select on public.event_analytics to authenticated;
grant select, insert on public.event_moderation_logs to authenticated;
grant select, update, insert on public.notifications to authenticated;

alter table public.event_moderation_logs enable row level security;
alter table public.event_analytics enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Admins can manage moderation logs" on public.event_moderation_logs;
create policy "Admins can manage moderation logs"
  on public.event_moderation_logs
  for all
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Organizer members can read moderation logs" on public.event_moderation_logs;
create policy "Organizer members can read moderation logs"
  on public.event_moderation_logs
  for select
  using (
    exists (
      select 1
      from public.events e
      join public.organizer_users ou
        on ou.organizer_id = e.submitted_by_organizer_id
      where e.id = event_moderation_logs.event_id
        and ou.user_id = auth.uid()
    )
  );

drop policy if exists "Anyone can insert event analytics" on public.event_analytics;
create policy "Anyone can insert event analytics"
  on public.event_analytics
  for insert
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins can read event analytics" on public.event_analytics;
create policy "Admins can read event analytics"
  on public.event_analytics
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Organizer members can read own event analytics" on public.event_analytics;
create policy "Organizer members can read own event analytics"
  on public.event_analytics
  for select
  using (
    exists (
      select 1
      from public.events e
      join public.organizer_users ou
        on ou.organizer_id = e.submitted_by_organizer_id
      where e.id = event_analytics.event_id
        and ou.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Admins can manage notifications" on public.notifications;
create policy "Admins can manage notifications"
  on public.notifications
  for all
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
