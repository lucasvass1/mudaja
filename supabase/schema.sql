-- Rode este script inteiro no SQL Editor do seu projeto Supabase
-- (painel do projeto > SQL Editor > New query > colar > Run)

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('cliente', 'motorista', 'imprensa')),
  nome text not null,
  contato text not null,
  cidade text,
  extra jsonb,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

-- Qualquer visitante do site pode inserir um lead...
create policy "leads_insert_publico"
  on public.leads
  for insert
  to anon
  with check (true);

-- ...mas ninguém consegue ler os leads pela chave pública (anon).
-- Leitura só é feita pelo backend, com a service_role key (secreta).
