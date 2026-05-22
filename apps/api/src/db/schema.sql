-- Verdict schema — run in Supabase SQL editor (Dashboard → SQL → New query)

create table if not exists repos (
  id uuid primary key default gen_random_uuid(),
  github_repo_id bigint unique not null,
  full_name text not null,
  owner_user_id uuid references auth.users(id),
  installed_at timestamptz default now()
);

create table if not exists pull_requests (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid references repos(id) on delete cascade,
  pr_number int not null,
  title text,
  author text,
  status text default 'reviewing',
  installation_id bigint,
  head_sha text,
  created_at timestamptz default now(),
  unique (repo_id, pr_number)
);

create table if not exists review_reports (
  id uuid primary key default gen_random_uuid(),
  pr_id uuid references pull_requests(id) on delete cascade,
  summary text,
  overall_score int,
  created_at timestamptz default now()
);

create table if not exists issues (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references review_reports(id) on delete cascade,
  agent_source text,
  file_path text,
  line_number int,
  severity text,
  title text,
  description text,
  evidence text,
  suggested_fix text,
  confidence_score int,
  confidence_explanation text
);

create index if not exists idx_pull_requests_repo on pull_requests(repo_id);
create index if not exists idx_review_reports_pr on review_reports(pr_id);
create index if not exists idx_issues_report on issues(report_id);

-- Migration: add column if upgrading from earlier schema
alter table issues add column if not exists confidence_explanation text;

alter table repos enable row level security;
alter table pull_requests enable row level security;
alter table review_reports enable row level security;
alter table issues enable row level security;

-- Phase 6: deny-by-default RLS. The API uses the service role (bypasses RLS).
-- Keep anon/authenticated locked down until JWT claims + policies are expanded.
drop policy if exists "deny_anon_repos" on repos;
create policy "deny_anon_repos" on repos for all to anon using (false) with check (false);

drop policy if exists "deny_anon_pull_requests" on pull_requests;
create policy "deny_anon_pull_requests" on pull_requests for all to anon using (false) with check (false);

drop policy if exists "deny_anon_review_reports" on review_reports;
create policy "deny_anon_review_reports" on review_reports for all to anon using (false) with check (false);

drop policy if exists "deny_anon_issues" on issues;
create policy "deny_anon_issues" on issues for all to anon using (false) with check (false);
