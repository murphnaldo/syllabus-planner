-- Student self-signup: run this once in the Supabase SQL editor for the
-- "syllabus-planner" project (SQL Editor > New query > paste > Run).
-- It only adds new tables and a function. Existing invite codes keep working.

create table if not exists public.student_access (
  email          text primary key check (email = lower(email)),
  code           text not null unique,
  status         text not null default 'active' check (status in ('pending', 'active', 'blocked')),
  run_limit      int  not null default 5 check (run_limit >= 0),
  created_at     timestamptz not null default now(),
  approved_at    timestamptz,
  last_sent_at   timestamptz,
  sends_day      date,
  sends_today    int  not null default 0,
  last_used_at   timestamptz,
  note           text
);

create table if not exists public.student_runs (
  email  text not null references public.student_access (email) on delete cascade,
  term   text not null,
  used   int  not null default 0,
  primary key (email, term)
);

-- Locked down: no policies, and the public (publishable) key can't touch these.
-- Only the server, using the secret key, can read or write them.
alter table public.student_access enable row level security;
alter table public.student_runs   enable row level security;
revoke all on public.student_access, public.student_runs from anon, authenticated;

-- Counts one successful run. Returns the new total for this term,
-- or -1 if the code doesn't exist or isn't active.
create or replace function public.record_student_run(p_code text, p_term text)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_email text;
  v_used  int;
begin
  select email into v_email
  from student_access
  where code = upper(p_code) and status = 'active';
  if v_email is null then
    return -1;
  end if;

  insert into student_runs (email, term, used)
  values (v_email, p_term, 1)
  on conflict (email, term) do update set used = student_runs.used + 1
  returning used into v_used;

  update student_access set last_used_at = now() where email = v_email;
  return v_used;
end;
$$;

revoke execute on function public.record_student_run(text, text) from public, anon, authenticated;
grant execute on function public.record_student_run(text, text) to service_role;
