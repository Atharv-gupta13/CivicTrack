-- Run this once in your Supabase project's SQL editor (Supabase dashboard -> SQL Editor -> New query -> Run).

create table if not exists reports (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  ticket      text not null,
  category    text not null,
  severity    text not null,
  details     text,
  place_name  text,
  latitude    double precision not null,
  longitude   double precision not null,
  accuracy    double precision,
  captured_at timestamptz,
  photo_url   text not null
);

alter table reports enable row level security;

-- Anyone can read shared reports (this is the public "Community reports" tab).
create policy "Public can read reports" on reports
  for select using (true);

-- Anyone can submit a report (this is a citizen-reporting app with no login).
-- The app itself already limits category/severity to a fixed list and caps
-- text length before sending, but treat this table as public-write.
create policy "Public can insert reports" on reports
  for insert with check (true);

-- Storage bucket for photos: in the Supabase dashboard go to
-- Storage -> Create a new bucket -> name it exactly "civic-photos" ->
-- toggle "Public bucket" ON -> Create bucket.
-- That's it — no extra storage policy needed for a public bucket.
