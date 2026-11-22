-- Skema database portofolio Faza Fauzan Adzima (Supabase PostgreSQL)
-- Aman dijalankan ulang (idempotent).

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  domain text not null,
  url text not null,
  summary text not null,
  role_label text not null,
  stack text[] not null default '{}',
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  rank_label text not null,
  title text not null,
  category text not null,
  year int,
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  sender_name text not null check (char_length(sender_name) between 2 and 80),
  sender_email text not null check (char_length(sender_email) between 5 and 160),
  message text not null check (char_length(message) between 10 and 1500),
  source_ip_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.security_scans (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (char_length(domain) between 3 and 253),
  score int not null check (score between 0 and 100),
  grade text not null check (grade in ('A', 'B', 'C', 'D', 'F')),
  present_count int not null check (present_count between 0 and 6),
  total_checks int not null default 6 check (total_checks = 6),
  status_code int,
  scanned_at timestamptz not null default now()
);

create index if not exists idx_projects_sort
  on public.projects (sort_order asc)
  where is_published = true;

create index if not exists idx_achievements_sort
  on public.achievements (sort_order asc)
  where is_published = true;

create index if not exists idx_security_scans_recent
  on public.security_scans (scanned_at desc);

create index if not exists idx_contact_messages_ip_recent
  on public.contact_messages (source_ip_hash, created_at desc)
  where source_ip_hash is not null;

-- Row Level Security
alter table public.projects enable row level security;
alter table public.achievements enable row level security;
alter table public.contact_messages enable row level security;
alter table public.security_scans enable row level security;

drop policy if exists projects_public_select on public.projects;
create policy projects_public_select
  on public.projects
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists achievements_public_select on public.achievements;
create policy achievements_public_select
  on public.achievements
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists security_scans_public_select on public.security_scans;
create policy security_scans_public_select
  on public.security_scans
  for select
  to anon, authenticated
  using (true);

-- contact_messages sengaja tidak memiliki policy SELECT/INSERT/UPDATE/DELETE langsung
-- agar pesan pengunjung tidak terbaca publik dan penulisan hanya melalui RPC tervalidasi.

create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_message text,
  p_ip_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_message text := btrim(coalesce(p_message, ''));
  v_ip_hash text := nullif(btrim(coalesce(p_ip_hash, '')), '');
  v_recent_count int := 0;
  v_row_id uuid;
  v_created_at timestamptz;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;

  if char_length(v_email) < 5 or char_length(v_email) > 160
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;

  if char_length(v_message) < 10 or char_length(v_message) > 1500 then
    raise exception 'INVALID_MESSAGE' using errcode = 'P0001';
  end if;

  if v_ip_hash is not null then
    select count(*)
      into v_recent_count
      from public.contact_messages
     where source_ip_hash = v_ip_hash
       and created_at >= now() - interval '1 hour';

    if v_recent_count >= 5 then
      raise exception 'RATE_LIMIT_EXCEEDED' using errcode = 'P0001';
    end if;
  end if;

  insert into public.contact_messages (sender_name, sender_email, message, source_ip_hash)
  values (v_name, v_email, v_message, v_ip_hash)
  returning id, created_at into v_row_id, v_created_at;

  return jsonb_build_object('id', v_row_id, 'created_at', v_created_at);
end;
$$;

revoke all on function public.submit_contact_message(text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text) to anon, authenticated;

create or replace function public.record_security_scan(
  p_domain text,
  p_score int,
  p_grade text,
  p_present_count int,
  p_total_checks int default 6,
  p_status_code int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text := lower(btrim(coalesce(p_domain, '')));
  v_grade text := upper(btrim(coalesce(p_grade, '')));
  v_row_id uuid;
  v_scanned_at timestamptz;
begin
  if char_length(v_domain) < 3 or char_length(v_domain) > 253
     or v_domain !~ '^[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception 'INVALID_DOMAIN' using errcode = 'P0001';
  end if;

  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'INVALID_SCORE' using errcode = 'P0001';
  end if;

  if v_grade not in ('A', 'B', 'C', 'D', 'F') then
    raise exception 'INVALID_GRADE' using errcode = 'P0001';
  end if;

  if p_present_count is null or p_present_count < 0 or p_present_count > 6 then
    raise exception 'INVALID_COUNT' using errcode = 'P0001';
  end if;

  if p_total_checks is null or p_total_checks <> 6 then
    raise exception 'INVALID_TOTAL' using errcode = 'P0001';
  end if;

  insert into public.security_scans (domain, score, grade, present_count, total_checks, status_code)
  values (v_domain, p_score, v_grade, p_present_count, p_total_checks, p_status_code)
  returning id, scanned_at into v_row_id, v_scanned_at;

  return jsonb_build_object('id', v_row_id, 'scanned_at', v_scanned_at);
end;
$$;

revoke all on function public.record_security_scan(text, int, text, int, int, int) from public;
grant execute on function public.record_security_scan(text, int, text, int, int, int) to anon, authenticated;

-- Seed awal data nyata Faza Fauzan Adzima
insert into public.projects (slug, name, domain, url, summary, role_label, stack, sort_order, is_published)
values
  (
    'remover-id',
    'Remover.id',
    'remover.id',
    'https://remover.id/',
    'Aplikasi web untuk menyimpan media TikTok, Instagram, YouTube, Facebook, X, dan Pinterest tanpa watermark menggunakan alur stream langsung tanpa menyimpan berkas pengguna.',
    'Developer',
    array['Next.js', 'Python', 'Supabase', 'Vercel'],
    1,
    true
  ),
  (
    'aureonmind',
    'AureonMind',
    'aureonmind.vercel.app',
    'https://aureonmind.vercel.app/',
    'Tutor papan tulis interaktif berbasis AI yang membantu siswa SMP dan SMA di Indonesia memahami konsep pelajaran secara visual.',
    'Developer',
    array['Next.js', 'Vercel'],
    2,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  domain = excluded.domain,
  url = excluded.url,
  summary = excluded.summary,
  role_label = excluded.role_label,
  stack = excluded.stack,
  sort_order = excluded.sort_order,
  is_published = excluded.is_published;

insert into public.achievements (slug, rank_label, title, category, year, sort_order, is_published)
values
  (
    'b-brave-2026',
    'Juara 7',
    'Lomba B-Brave 2026',
    'Kategori Sosial',
    2026,
    1,
    true
  ),
  (
    'bahasa-arab-kabupaten',
    'Juara Harapan 3',
    'Lomba Bahasa Arab',
    'Tingkat Kabupaten',
    null,
    2,
    true
  )
on conflict (slug) do update set
  rank_label = excluded.rank_label,
  title = excluded.title,
  category = excluded.category,
  year = excluded.year,
  sort_order = excluded.sort_order,
  is_published = excluded.is_published;
