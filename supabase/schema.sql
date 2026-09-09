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

-- Migração: separa o campo único "contato" em "email" e "telefone".
-- Rode este bloco no SQL Editor se a tabela "leads" já existir com "contato".
-- "contato" fica preservado (com os leads antigos) e vira opcional.
alter table public.leads add column if not exists email text;
alter table public.leads add column if not exists telefone text;
alter table public.leads alter column contato drop not null;

-- Qualquer visitante do site pode inserir um lead...
create policy "leads_insert_publico"
  on public.leads
  for insert
  to anon
  with check (true);

-- ...mas ninguém consegue ler os leads pela chave pública (anon).
-- Leitura só é feita pelo backend, com a service_role key (secreta).
