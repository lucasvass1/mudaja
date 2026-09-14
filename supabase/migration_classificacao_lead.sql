-- Migração: classificação de lead por região (João Pessoa / Grande João Pessoa
-- x expansão). Rode este script inteiro no SQL Editor do seu projeto Supabase
-- (painel do projeto > SQL Editor > New query > colar > Run).
--
-- Este arquivo é um recorte de supabase/schema.sql — mantenha os dois em sincronia
-- se ajustar a lista de cidades ou a lógica de classificação no futuro.

-- A Landing Page é uma lista de espera de pré-lançamento e NÃO bloqueia
-- ninguém pela cidade. Toda cidade informada é aceita; esta coluna só marca
-- a PRIORIDADE de contato:
--   'prioritario' -> João Pessoa e Grande João Pessoa (área inicial de operação)
--   'expansao'    -> qualquer outra cidade (lead para expansão futura)
-- Calculada no servidor (trigger abaixo) para não depender do que o
-- front-end envia — se alguém inserir direto via API, a classificação
-- continua correta.
alter table public.leads add column if not exists classificacao text check (classificacao in ('prioritario', 'expansao'));

create or replace function public.mudaja_classificar_lead()
returns trigger as $$
declare
  cidade_normalizada text;
  -- Municípios da Região Metropolitana de João Pessoa. Ajuste esta lista
  -- se a área inicial de atendimento mudar.
  grande_joao_pessoa text[] := array[
    'joao pessoa', 'bayeux', 'cabedelo', 'santa rita', 'conde', 'lucena',
    'alhandra', 'caapora', 'cruz do espirito santo', 'rio tinto', 'sape',
    'pedras de fogo', 'mamanguape'
  ];
begin
  if new.tipo in ('cliente', 'motorista') and new.cidade is not null and length(trim(new.cidade)) > 0 then
    cidade_normalizada := lower(trim(translate(
      new.cidade,
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    )));
    if cidade_normalizada = any(grande_joao_pessoa) then
      new.classificacao := 'prioritario';
    else
      new.classificacao := 'expansao';
    end if;
  else
    new.classificacao := null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_mudaja_classificar_lead on public.leads;
create trigger trg_mudaja_classificar_lead
  before insert or update on public.leads
  for each row execute function public.mudaja_classificar_lead();

-- O trigger só roda em INSERT/UPDATE. Este UPDATE "no-op" (cidade = cidade)
-- força o recálculo de "classificacao" para os leads que já existiam antes
-- desta migração. Se a tabela ainda estiver vazia, ele não faz nada.
update public.leads set cidade = cidade;
