-- Teams v2 T1 (arbejdshold/sjak): multiple org-scoped work teams with an
-- appointed leader and invitation-based membership. The Stripe billing team
-- (teams/team_seats) is a separate concept and is untouched.

create table public.org_teams (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    name text not null check (char_length(btrim(name)) between 1 and 80),
    leader_id uuid references public.profiles(id) on delete set null,
    created_by uuid not null references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.org_team_members (
    team_id uuid not null references public.org_teams(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    role text not null default 'member' check (role in ('leader','member')),
    status text not null default 'pending' check (status in ('pending','active')),
    invited_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (team_id, user_id)
);

create index org_teams_org_idx on public.org_teams(org_id);
create index org_team_members_user_idx on public.org_team_members(user_id);

alter table public.org_teams enable row level security;
alter table public.org_team_members enable row level security;

-- SECURITY DEFINER helpers (same lockdown style as the Phase 2 org helpers).
create or replace function public.org_team_org(team uuid)
returns uuid language sql security definer stable
set search_path = public
as $$ select org_id from public.org_teams where id = team $$;

create or replace function public.is_org_team_manager(team uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists(
    select 1 from public.org_teams t
    join public.organizations o on o.id = t.org_id
    where t.id = team and (o.created_by = auth.uid() or t.leader_id = auth.uid())
  )
$$;

grant execute on function public.org_team_org(uuid) to authenticated;
grant execute on function public.is_org_team_manager(uuid) to authenticated;

-- org_teams: every org member sees the org's teams; only the org owner
-- creates/deletes; owner or the team's leader manages it.
create policy org_teams_select on public.org_teams
  for select using (public.is_org_member(org_id));
create policy org_teams_insert on public.org_teams
  for insert with check (
    created_by = auth.uid()
    and exists(select 1 from public.organizations o where o.id = org_id and o.created_by = auth.uid())
  );
create policy org_teams_update on public.org_teams
  for update using (public.is_org_team_manager(id));
create policy org_teams_delete on public.org_teams
  for delete using (
    exists(select 1 from public.organizations o where o.id = org_id and o.created_by = auth.uid())
  );

-- org_team_members: org members can see; owner/leader invites and manages;
-- the invited user manages their own row (accept / decline / leave).
create policy org_team_members_select on public.org_team_members
  for select using (public.is_org_member(public.org_team_org(team_id)));
create policy org_team_members_insert on public.org_team_members
  for insert with check (public.is_org_team_manager(team_id));
create policy org_team_members_update on public.org_team_members
  for update using (public.is_org_team_manager(team_id) or user_id = auth.uid());
create policy org_team_members_delete on public.org_team_members
  for delete using (public.is_org_team_manager(team_id) or user_id = auth.uid());
