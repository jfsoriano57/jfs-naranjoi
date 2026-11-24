-- =====================================================================
-- NARANJO · Esquema inicial
-- Todas las tablas tienen Row Level Security: cada usuario solo ve lo suyo.
-- =====================================================================

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------
-- Perfiles y cuotas
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  gemini_key_enc text,                 -- clave propia de Gemini, cifrada (AES-GCM) en el servidor
  daily_quota int not null default 20, -- mensajes diarios con la clave compartida
  created_at timestamptz not null default now()
);

create table public.usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  messages int not null default 0,
  primary key (user_id, day)
);

-- Crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Materias y materiales
-- ---------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  career text,
  term text,
  color text not null default '#f97316',
  exam_date date,
  created_at timestamptz not null default now()
);
create index on public.subjects (user_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  title text not null,
  kind text not null default 'otro'
    check (kind in ('programa', 'texto_basico', 'apuntes', 'ejercicios', 'otro')),
  source text not null default 'subido' check (source in ('subido', 'internet')),
  source_url text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  pages int,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'procesando', 'listo', 'error')),
  error text,
  created_at timestamptz not null default now()
);
create index on public.documents (subject_id);
create index on public.documents (user_id);

create table public.chunks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  page int,
  content text not null,
  embedding extensions.halfvec(768),
  fts tsvector generated always as (to_tsvector('spanish', content)) stored
);
create index on public.chunks (subject_id);
create index on public.chunks (document_id);
create index on public.chunks using gin (fts);
create index on public.chunks using hnsw (embedding extensions.halfvec_cosine_ops);

-- ---------------------------------------------------------------------
-- Tutor (conversaciones)
-- ---------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Nueva conversación',
  subject_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.conversations (user_id, updated_at desc);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, id);

-- ---------------------------------------------------------------------
-- Herramientas de estudio
-- ---------------------------------------------------------------------
create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  title text not null,
  questions jsonb not null,
  created_at timestamptz not null default now()
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  answers jsonb not null,
  score numeric not null,
  created_at timestamptz not null default now()
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  front text not null,
  back text not null,
  ease real not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  due_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.flashcards (user_id, due_at);

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  exam_date date not null,
  plan jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "perfil propio: leer" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "perfil propio: actualizar" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

alter table public.usage_daily enable row level security;
create policy "uso propio: leer" on public.usage_daily
  for select to authenticated using ((select auth.uid()) = user_id);

do $$
declare t text;
begin
  foreach t in array array[
    'subjects', 'documents', 'chunks', 'conversations', 'messages',
    'summaries', 'quizzes', 'quiz_attempts', 'flashcards', 'study_plans'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "filas propias" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Búsqueda híbrida (vectores + texto completo, fusión RRF)
-- security invoker => respeta RLS: solo busca en los fragmentos del usuario
-- ---------------------------------------------------------------------
create or replace function public.match_chunks(
  query_embedding extensions.halfvec(768),
  query_text text,
  subject_ids uuid[],
  match_count int default 8
)
returns table (id bigint, document_id uuid, subject_id uuid, page int, content text, score float)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with semantic as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as rank
    from public.chunks c
    where c.subject_id = any (subject_ids) and c.embedding is not null
    order by c.embedding <=> query_embedding
    limit match_count * 3
  ),
  keyword as (
    select c.id,
           row_number() over (
             order by ts_rank_cd(c.fts, websearch_to_tsquery('spanish', query_text)) desc
           ) as rank
    from public.chunks c
    where c.subject_id = any (subject_ids)
      and c.fts @@ websearch_to_tsquery('spanish', query_text)
    limit match_count * 3
  )
  select c.id, c.document_id, c.subject_id, c.page, c.content,
         coalesce(1.0 / (60 + s.rank), 0) + coalesce(1.0 / (60 + k.rank), 0) as score
  from semantic s
  full outer join keyword k on s.id = k.id
  join public.chunks c on c.id = coalesce(s.id, k.id)
  order by score desc
  limit match_count;
$$;

-- ---------------------------------------------------------------------
-- Cuota diaria con la clave compartida
-- Devuelve los mensajes restantes tras consumir uno, o -1 si no quedan.
-- ---------------------------------------------------------------------
create or replace function public.consume_quota()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  quota int;
  used int;
begin
  if uid is null then
    raise exception 'No autenticado';
  end if;

  select daily_quota into quota from public.profiles where id = uid;
  quota := coalesce(quota, 20);

  insert into public.usage_daily (user_id, day, messages)
  values (uid, current_date, 0)
  on conflict (user_id, day) do nothing;

  select messages into used from public.usage_daily
  where user_id = uid and day = current_date
  for update;

  if used >= quota then
    return -1;
  end if;

  update public.usage_daily set messages = messages + 1
  where user_id = uid and day = current_date;

  return quota - used - 1;
end;
$$;

revoke execute on function public.consume_quota() from public, anon;
grant execute on function public.consume_quota() to authenticated;

-- ---------------------------------------------------------------------
-- Almacenamiento temporal de archivos (bucket privado)
-- Ruta: <user_id>/<document_id>/<archivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('materiales', 'materiales', false, 52428800)
on conflict (id) do nothing;

create policy "materiales propios: leer" on storage.objects
  for select to authenticated
  using (bucket_id = 'materiales' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "materiales propios: subir" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materiales' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "materiales propios: borrar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'materiales' and (storage.foldername(name))[1] = (select auth.uid())::text);
