-- =====================================================================
-- 공유 캘린더 스키마
-- 새 Supabase 프로젝트의 SQL Editor에 통째로 붙여넣고 한 번 실행하세요.
-- =====================================================================

-- 1. 테이블 ------------------------------------------------------------

-- 사용자 프로필 (auth.users 1:1)
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

-- 캘린더 (개인용 / 공유용)
create table public.calendars (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 50),
  color       text not null default '#4f7cff',
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  is_personal boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 캘린더 멤버와 권한
--   owner  : 캘린더 수정/삭제, 멤버 관리
--   editor : 일정 추가/수정/삭제
--   viewer : 보기만
create table public.calendar_members (
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  joined_at   timestamptz not null default now(),
  primary key (calendar_id, user_id)
);
create index calendar_members_user_idx on public.calendar_members (user_id);

-- 일정
--   all_day = true 인 경우 start_at = 시작일 00:00, end_at = 종료일 23:59:59.999 (로컬 기준)
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  description text,
  location    text,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  all_day     boolean not null default false,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_time_order check (end_at >= start_at)
);
create index events_calendar_time_idx on public.events (calendar_id, start_at, end_at);


-- 2. 헬퍼 함수 ----------------------------------------------------------
-- RLS 정책 안에서 calendar_members를 다시 조회하면 무한 재귀가 생기므로
-- security definer 함수로 우회한다.

create function public.my_role(cal uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.calendar_members
  where calendar_id = cal and user_id = auth.uid();
$$;

create function public.shares_calendar_with(other uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.calendar_members a
    join public.calendar_members b on a.calendar_id = b.calendar_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;


-- 3. 트리거 -------------------------------------------------------------

-- 회원가입 시: 프로필 + 개인 캘린더 자동 생성
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );
  insert into public.calendars (name, owner_id, is_personal)
  values ('내 캘린더', new.id, true);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 캘린더 생성 시: 만든 사람을 owner 멤버로 등록
create function public.handle_new_calendar()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.calendar_members (calendar_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_calendar_created
  after insert on public.calendars
  for each row execute function public.handle_new_calendar();

-- 일정 수정 시 updated_at 갱신
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_updated_at();


-- 4. RPC ----------------------------------------------------------------

-- 초대 코드로 캘린더 참여 (editor 권한으로 합류)
create function public.join_calendar(code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  cal public.calendars;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;

  select * into cal from public.calendars where invite_code = upper(trim(code));
  if cal.id is null then
    raise exception '초대 코드를 찾을 수 없어요';
  end if;
  if cal.is_personal then
    raise exception '개인 캘린더에는 참여할 수 없어요';
  end if;

  insert into public.calendar_members (calendar_id, user_id, role)
  values (cal.id, auth.uid(), 'editor')
  on conflict do nothing;

  return cal.id;
end;
$$;

-- 초대 코드 재발급 (owner 전용) — 코드가 유출됐을 때 사용
create function public.regenerate_invite_code(cal uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  new_code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
begin
  if public.my_role(cal) is distinct from 'owner' then
    raise exception '캘린더 주인만 코드를 바꿀 수 있어요';
  end if;
  update public.calendars set invite_code = new_code where id = cal;
  return new_code;
end;
$$;

revoke execute on function public.join_calendar(text) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.join_calendar(text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;


-- 5. 권한 (RLS) ---------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.calendars        enable row level security;
alter table public.calendar_members enable row level security;
alter table public.events           enable row level security;

revoke all on public.profiles, public.calendars, public.calendar_members, public.events from anon;

-- 수정 가능한 컬럼 제한
revoke update on public.calendars from authenticated;
grant  update (name, color) on public.calendars to authenticated;

revoke insert, update on public.calendar_members from authenticated;
grant  update (role) on public.calendar_members to authenticated;

revoke update on public.events from authenticated;
grant  update (calendar_id, title, description, location, start_at, end_at, all_day) on public.events to authenticated;

-- profiles: 나 자신 + 같은 캘린더를 쓰는 사람만 보임
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_calendar_with(id));
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- calendars
create policy "calendars_select" on public.calendars for select to authenticated
  using (public.my_role(id) is not null);
create policy "calendars_insert" on public.calendars for insert to authenticated
  with check (owner_id = auth.uid() and not is_personal);
create policy "calendars_update" on public.calendars for update to authenticated
  using (public.my_role(id) = 'owner') with check (public.my_role(id) = 'owner');
create policy "calendars_delete" on public.calendars for delete to authenticated
  using (public.my_role(id) = 'owner' and not is_personal);

-- calendar_members
create policy "members_select" on public.calendar_members for select to authenticated
  using (public.my_role(calendar_id) is not null);
create policy "members_update" on public.calendar_members for update to authenticated
  using (public.my_role(calendar_id) = 'owner' and user_id <> auth.uid())
  with check (role in ('editor', 'viewer'));
create policy "members_delete" on public.calendar_members for delete to authenticated
  using (
    (user_id = auth.uid() and role <> 'owner')                         -- 스스로 나가기
    or (public.my_role(calendar_id) = 'owner' and user_id <> auth.uid()) -- 주인이 내보내기
  );

-- events
create policy "events_select" on public.events for select to authenticated
  using (public.my_role(calendar_id) is not null);
create policy "events_insert" on public.events for insert to authenticated
  with check (public.my_role(calendar_id) in ('owner', 'editor') and created_by = auth.uid());
create policy "events_update" on public.events for update to authenticated
  using (public.my_role(calendar_id) in ('owner', 'editor'))
  with check (public.my_role(calendar_id) in ('owner', 'editor'));
create policy "events_delete" on public.events for delete to authenticated
  using (public.my_role(calendar_id) in ('owner', 'editor'));


-- 6. 실시간 동기화 -------------------------------------------------------

alter publication supabase_realtime add table public.events, public.calendars, public.calendar_members;
