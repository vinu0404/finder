import postgres from 'postgres'

// prepare:false is required by Supabase's transaction pooler
export const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 5, onnotice: () => {} })

export const ensureTable = () => sql`
  create table if not exists jobs (
    link text primary key,
    title text, company text, site text, snippet text,
    score int, verdict text, reason text, missing text, experience text, location text,
    posted timestamptz, found_at timestamptz default now()
  );
  alter table jobs add column if not exists posted timestamptz;
  alter table jobs add column if not exists salary text;
  alter table jobs add column if not exists status text`.simple()
