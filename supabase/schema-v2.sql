-- =============================================
-- MIGRATION V2 — Student management, master data, Roll+DOB login
-- Run this AFTER the initial schema (schema.sql).
-- Safe to re-run: uses IF NOT EXISTS everywhere.
-- =============================================

-- Extend profiles with student-management fields
alter table public.profiles add column if not exists dob date;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists status text default 'active' check (status in ('active','inactive'));
alter table public.profiles add column if not exists scholarship_id uuid;

do $$ begin
  create unique index if not exists ux_profiles_email on public.profiles(lower(email)) where email is not null;
exception when others then null; end $$;

-- Master data
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.scholarships (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.profiles
    add constraint profiles_scholarship_fk foreign key (scholarship_id) references public.scholarships(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Enable RLS
alter table public.departments enable row level security;
alter table public.academic_years enable row level security;
alter table public.scholarships enable row level security;

drop policy if exists dept_read on public.departments;
drop policy if exists dept_admin on public.departments;
drop policy if exists year_read on public.academic_years;
drop policy if exists year_admin on public.academic_years;
drop policy if exists schol_read on public.scholarships;
drop policy if exists schol_admin on public.scholarships;

create policy dept_read on public.departments for select to authenticated using (true);
create policy dept_admin on public.departments for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy year_read on public.academic_years for select to authenticated using (true);
create policy year_admin on public.academic_years for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy schol_read on public.scholarships for select to authenticated using (true);
create policy schol_admin on public.scholarships for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

-- Allow admin to insert/delete profiles for student management
drop policy if exists p_profiles_insert_admin on public.profiles;
drop policy if exists p_profiles_delete_admin on public.profiles;
create policy p_profiles_insert_admin on public.profiles for insert to authenticated
  with check (public.is_admin((select auth.uid())));
create policy p_profiles_delete_admin on public.profiles for delete to authenticated
  using (public.is_admin((select auth.uid())));

-- Seed master data
insert into public.departments (name) values
  ('IT'),('CSE'),('ECE'),('EEE'),('Mechanical'),('Civil'),('AI & DS'),('Other')
  on conflict (name) do nothing;
insert into public.academic_years (name) values
  ('1st Year'),('2nd Year'),('3rd Year'),('4th Year')
  on conflict (name) do nothing;
insert into public.scholarships (name) values
  ('Government Scholarship'),('BC Scholarship'),('MBC Scholarship'),('SC/ST Scholarship'),('First Graduate Scholarship'),('Merit Scholarship'),('Other')
  on conflict (name) do nothing;
