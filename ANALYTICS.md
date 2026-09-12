# Analytics — MudaJá Landing Page

Documentação da implementação de monitoramento (GA4) na Landing Page. Mantenha esta tabela atualizada sempre que um evento novo for adicionado, alterado ou removido.

## Checklist de implementação

_Última verificação: 11/set/2026, direto na propriedade GA4 "MudaJá"._

### Feito

- [x] Medir visitantes, visitas e sessões (nativo do GA4)
- [x] Dados em tempo real (Relatórios → Tempo real, nativo — confirmado com usuário ativo real e evento `page_view` chegando)
- [x] Histórico com filtro Hoje / 7 dias / 30 dias / período personalizado (seletor de datas nativo do GA4)
- [x] Comparação entre períodos (toggle "Comparar" do seletor de datas, nativo)
- [x] Dimensões personalizadas registradas: `audience`, `cta_name`, `section`, `link_text`, `destination`, `location`
- [x] Cliques por CTA instrumentados (`cta_click` com `cta_name`, `audience`, `section`) — 8 CTAs mapeados
- [x] Cliques no Instagram (`instagram_click`)
- [x] Cliques de navegação/menu (`menu_click`)
- [x] Diferenciação cliente x motorista x imprensa (parâmetro `audience` em todos os eventos relevantes)
- [x] Início e conclusão de cadastro (`signup_started`, `signup_completed`) e erro de cadastro (`signup_error`)
- [x] `signup_completed` marcado como conversão principal (Evento-chave no GA4)
- [x] Funil de conversão criado — exploração **"Fase 9 - Funil de Conversão"** (Visitou → Interagiu → Clicou no CTA → Escolheu cliente/motorista → Iniciou cadastro → Concluiu cadastro), funil fechado, com detalhamento por Audiência
- [x] Visitantes sem interação — exploração **"Fase 7 - Visitou x Interagiu"**, segmento com regex `^(cta_click|menu_click|instagram_click|signup_started)$`
- [x] Origem do tráfego e suporte a UTMs (`utm_source/medium/campaign/term/content`) — automático via `page_view`, confirmado no relatório de Tempo real
- [x] Análise por dispositivo (dimensão nativa "Categoria de dispositivo", disponível em qualquer relatório/exploração)
- [x] Decisão de não construir dashboard próprio — relatórios nativos do GA4 + as duas explorações acima cobrem a necessidade atual
- [x] Resiliência: toda a camada `analytics.js` envolvida em `try/catch`, falha do GA4 nunca quebra a LP
- [x] Privacidade: nenhum dado pessoal (nome, e-mail, telefone) enviado ao GA4
- [x] Documentação atualizada (este arquivo)
- [x] **Fase 12 — Validação final em produção**, executada em 11/set/2026 em `https://mudaja.vercel.app/`:
  - `page_view` confirmado (inclusive com `utm_source`/`utm_medium`/`utm_campaign` de teste presentes no parâmetro `dl` do hit enviado ao GA4 — a atribuição de campanha funciona mesmo sem nenhum código de UTM no projeto);
  - CTA cliente (header) → `cta_click` + `signup_started` (`audience=client`) → formulário enviado → `signup_completed` confirmado no GA4 Realtime e contado em "Eventos principais" (conversão);
  - CTA motorista (Motoristas Fundadores) → mesmo fluxo completo com `audience=driver`;
  - Clique no Instagram testado (abre `instagram.com/mudaja.br` em nova aba);
  - Confirmado no GA4 Realtime: `page_view`, `cta_click` (2), `signup_started` (2), `signup_completed` (2) chegando em tempo real, com `signup_completed` contado como evento-chave.
  - Os 2 leads de teste gerados (nome `TESTE ANALYTICS - IGNORAR` / `teste.analytics.ga4@example.com` e `TESTE ANALYTICS - IGNORAR (MOTORISTA)` / `teste.analytics.ga4.motorista@example.com`) foram removidos da tabela `leads` do Supabase de produção em 11/set/2026 (via SQL Editor, `delete` pelos `id`s exatos, confirmados por `select` antes e depois).

### Pendente

- [ ] **`whatsapp_click`** — não implementado; aguardando a LP ter um link/número de WhatsApp real (hoje só há campo de formulário pedindo o telefone)
- [ ] **Análise de campanhas reais**: a mecânica de UTM já funciona (confirmado na Fase 12), mas ainda não há volume de campanhas pagas/sociais rodando para validar comparação de qualidade de tráfego entre canais
- [ ] Reavaliar dashboard próprio caso surja a necessidade de cruzar dados do GA4 com o status dos leads no Supabase (aprovado, contatado etc.) numa única tela

## Stack

Site estático (HTML + CSS + JS vanilla, ES Modules), sem build step, servido pela Vercel a partir de `dist/`. Não há `.env` consumido pelo client — o Measurement ID do GA4 fica hardcoded no `<head>` de `dist/index.html`, pois não há etapa de build para injetar variáveis de ambiente no navegador.

## Vercel Web Analytics

- **Local do snippet:** `dist/index.html`, `<script defer src="/_vercel/insights/script.js"></script>` no `<head>`.
- Como o site é estático sem bundler, usa-se o snippet direto em vez do pacote npm `@vercel/analytics` (que exige `import` via bundler/Next.js).
- Não requer nenhuma variável de ambiente. É necessário **habilitar "Web Analytics" no dashboard do projeto na Vercel** (aba Analytics) para a rota `/_vercel/insights/script.js` responder e os dados começarem a ser coletados.
- Mede visitantes e page views agregados; não substitui os eventos de conversão do GA4 documentados abaixo.

## Configuração do GA4

- **Measurement ID:** `G-121JSPF54X`
- **Local do snippet:** `dist/index.html`, dentro do `<head>`, carregado com `async` para não bloquear o carregamento da página.
- **Camada centralizada de analytics:** `dist/assets/analytics.js`, com `trackEvent()`, `trackPageView()` e `trackConversion()`. Todas envolvidas em `try/catch` — uma falha do GA4 (bloqueador de anúncios, offline, etc.) nunca quebra a Landing Page.
- Nenhum componente da Landing Page chama `window.gtag` diretamente; tudo passa pela camada centralizada, importada em `dist/assets/script.js`.

## Privacidade / LGPD

Nenhum evento envia nome, e-mail, telefone ou qualquer dado pessoal para o GA4. Os parâmetros enviados são limitados a: tipo de público (`client`/`driver`/`press`), nome técnico do CTA, seção da página, texto/destino de links de navegação e localização de links sociais.

## Eventos implementados

| Evento | Quando dispara | Parâmetros | Conversão |
| --- | --- | --- | --- |
| `page_view` | Carregamento da página (automático do gtag.js) | padrão do GA4 | Não |
| `cta_click` | Clique em qualquer CTA que abre o modal de cadastro (8 botões) | `cta_name`, `audience` (`client`/`driver`/`press`), `section` | Não |
| `menu_click` | Clique em qualquer link de navegação por âncora (menu, footer, links internos) | `link_text`, `destination` | Não |
| `instagram_click` | Clique no link do Instagram (footer) | `location` | Não |
| `whatsapp_click` | *(ainda não implementado — aguardando link de WhatsApp na LP)* | `location` | Não |
| `signup_started` | Modal de cadastro é aberto | `audience` | Não |
| `signup_completed` | Insert do lead no Supabase concluído com sucesso | `audience` | **Sim** |
| `signup_error` | Insert do lead no Supabase falha | `audience` | Não |
| `share_click` | Clique em "Compartilhar no WhatsApp" na tela de sucesso do cadastro | `audience`, `channel` (`whatsapp`), `location` (`success_modal`) | Não |

`signup_completed` deve ser marcado como conversão principal dentro da interface do GA4 (Admin → Eventos → marcar como conversão).

## Mapeamento de CTAs instrumentados

| `data-cta-name` | `data-section` | Tipo (`data-open-dialog`) | Local |
| --- | --- | --- | --- |
| `header_signup` | `header` | cliente | Header desktop |
| `mobile_menu_signup` | `mobile_menu` | cliente | Menu mobile |
| `hero_signup` | `hero` | cliente | Hero |
| `client_card_signup` | `two_sides` | cliente | Card "Clientes" |
| `driver_card_signup` | `two_sides` | motorista | Card "Motoristas" |
| `founders_signup` | `founders` | motorista | Seção Motoristas Fundadores |
| `early_section_signup` | `early_section` | cliente | Seção "Você está chegando antes" |
| `press_signup` | `press` | imprensa | Seção Imprensa |

## Cliente x Motorista x Imprensa

A diferenciação já existia no código via atributo `data-open-dialog` (`cliente`/`motorista`/`imprensa`). Essa camada de analytics reaproveita esse valor, convertendo para o parâmetro `audience` (`client`/`driver`/`press`) em todos os eventos relevantes (`cta_click`, `signup_started`, `signup_completed`, `signup_error`).

## UTMs e origem de tráfego

Não há tratamento manual de UTM no código — não é necessário. Como o site não tem roteamento client-side (é uma página só, sem navegação que troque a URL), os parâmetros `utm_source`, `utm_medium`, `utm_campaign`, `utm_term` e `utm_content` presentes na URL de entrada são lidos automaticamente pelo `page_view` do GA4. A origem/mídia/campanha fica disponível nos relatórios de Aquisição do GA4 sem código adicional.

## Visitantes sem interação

Não existe um evento dedicado. Calcule no GA4 (Explorations) comparando o total de sessões com o total de sessões que possuem pelo menos um evento de engajamento (`cta_click`, `menu_click`, `instagram_click`, ou os eventos automáticos de scroll/engajamento do GA4). Use o termo **"visitantes sem interação rastreada"** nos relatórios — os dados não permitem afirmar com certeza que a pessoa "entrou e saiu" sem nenhum tipo de leitura da página.

## Integração com Supabase

O Supabase continua sendo a fonte dos dados de negócio (tabela `leads`). O GA4 não duplica esses dados — mede comportamento/tráfego; o Supabase guarda quem efetivamente virou lead. Para cruzar os dois, use o volume de `signup_completed` no GA4 como validação cruzada da contagem de linhas na tabela `leads` por período.

## Como testar

1. Rode um servidor estático local a partir de `dist/` (ex.: `python -m http.server 8787`) — não abra via `file://`, pois `script.js` usa `import` de módulo ES e isso requer HTTP.
2. Abra o DevTools → Console/Network, filtre por `collect` para ver os hits do GA4, ou inspecione `window.dataLayer` diretamente.
3. Clique nos CTAs e confirme `cta_click` + `signup_started` no `dataLayer`.
4. Preencha e envie um formulário de teste (**cuidado:** isso grava um lead real no Supabase de produção — combine com a equipe antes de testar o fluxo de submit completo em produção, ou use um projeto Supabase de teste).
5. Confirme `signup_completed` (sucesso) ou `signup_error` (falha).
6. Clique no link do Instagram e nos links do menu/footer, confirme `instagram_click` e `menu_click`.
7. Depois do deploy, valide no GA4 → Relatórios em tempo real que os eventos chegam de fato aos servidores do Google.

## Como adicionar um novo evento

1. Adicione a chamada `trackEvent('nome_do_evento', { parametro: valor })` no ponto exato da interação, importando de `./analytics.js`.
2. Nunca chame `window.gtag` diretamente fora de `analytics.js`.
3. Não inclua dados pessoais nos parâmetros.
4. Atualize a tabela de eventos deste documento.

---

## Configuração da propriedade GA4 (Fases 7-12)

Estas etapas são feitas **dentro da interface do Google Analytics** (analytics.google.com), não no código. Faça nesta ordem.

### Status (verificado em 11/set/2026 diretamente na propriedade GA4 "MudaJá")

- **Pré-requisito (dimensões personalizadas):** concluído. As 6 dimensões (`audience`, `cta_name`, `section`, `link_text`, `destination`, `location`) já estavam registradas em Admin → Definições de dados → Dimensões personalizadas.
- **`signup_completed` como conversão:** concluído. Já está marcado como Evento-chave em Admin → Eventos, com dados reais chegando.
- **Eventos do código em produção:** confirmado no GA4 (Admin → Eventos → Eventos recentes) — `page_view`, `cta_click`, `menu_click`, `instagram_click`, `signup_started`, `signup_completed` todos com streaming ativo. Nenhum `signup_error` registrado. `whatsapp_click` segue pendente (sem link de WhatsApp na LP ainda).
- **Fase 7 (visitantes sem interação):** concluído. Exploração "Fase 7 - Visitou x Interagiu" já existente, com o segmento "Usuários com interação real" usando o regex `^(cta_click|menu_click|instagram_click|signup_started)$` recomendado.
- **Fase 8 (origem/UTMs):** confirmado nativamente — o relatório de Tempo real já mostra a origem (`Origem atribuída ao primeiro usuário`) sem qualquer configuração extra.
- **Fase 9 (funil de conversão):** concluído. Criada a exploração "Fase 9 - Funil de Conversão" com as 6 etapas (Visitou → Interagiu → Clicou no CTA → Escolheu cliente/motorista → Iniciou cadastro → Concluiu cadastro), funil fechado (ordem estrita) e detalhamento por Audiência.
- **Fase 10 (tempo real/histórico):** confirmado nativo, sem configuração adicional necessária.
- **Fase 11 (dashboard):** mantida a decisão de não construir um dashboard próprio — os relatórios nativos do GA4 (Aquisição, Engajamento, as duas explorações acima) são suficientes para o tamanho atual do site.
- **Fase 12 (validação final):** pendente — depende de um teste end-to-end em produção com navegador real (abrir CTA cliente/motorista, completar cadastro de teste, conferir Realtime). Combine com a equipe antes de gerar um lead de teste real no Supabase de produção.

### Pré-requisito — Registrar as dimensões personalizadas

O GA4 só permite usar `audience`, `cta_name`, `section`, `link_text`, `destination` e `location` em relatórios/funis/segmentos depois de registrá-los como dimensões personalizadas. **Sem isso, as Fases 8, 9 e 13 não funcionam.** Dados de antes do registro não são retroativos.

1. Admin (engrenagem, canto inferior esquerdo) → coluna da propriedade → **Definições de dados** → **Dimensões personalizadas** → **Criar dimensões personalizadas**.
2. Crie uma para cada parâmetro, todas com **Escopo = Evento**:

| Nome de exibição | Parâmetro do evento |
| --- | --- |
| Audiência | `audience` |
| Nome do CTA | `cta_name` |
| Seção | `section` |
| Texto do link | `link_text` |
| Destino do link | `destination` |
| Localização do social | `location` |

### FASE 7 — Visitantes sem interação

1. **Explorar** → **Exploração em branco**.
2. No painel "Segmentos e filtros", clique **+** → **Segmento de sessão** → nomeie "Sessão com interação rastreada" → adicione a condição: **Nome do evento** corresponde à expressão regular `^(cta_click|menu_click|instagram_click|whatsapp_click|signup_started)$` → Salvar e aplicar.
3. Na tabela da exploração, adicione a métrica **Sessões** duas vezes: uma sem segmento (total) e outra com o segmento "Sessão com interação rastreada" aplicado.
4. Calcule: `sem interação = total − com interação`; `% sem interação = sem interação / total`.
5. No relatório final, sempre rotule como **"visitantes sem interação rastreada"** — nunca afirme que a pessoa "entrou e saiu", pois o dado só mostra ausência de evento capturado.

### FASE 8 — Origem e UTMs

1. Teste abrindo a landing page com URLs como:
   `https://SEU-DOMINIO/?utm_source=instagram&utm_medium=social&utm_campaign=lancamento`
   `https://SEU-DOMINIO/?utm_source=google&utm_medium=cpc&utm_campaign=motoristas&utm_content=video01`
2. Aguarde alguns minutos (ou confira no Tempo real, ver Fase 10) e depois em **Relatórios → Ciclo de vida → Aquisição → Aquisição de tráfego**. Troque a dimensão principal para **Sessão de origem/mídia** e **Sessão de campanha** para confirmar que os valores batem com o que você usou na URL.
3. Como o site não tem navegação client-side, não há risco de perder a UTM durante a sessão — ela é capturada no primeiro `page_view`.

### FASE 9 — Funil de conversão

1. **Explorar** → **Exploração de funil**.
2. Configure as etapas (tipo de correspondência = "Nome do evento", usando regex quando marcado):
   1. **Visitou** — evento `page_view`
   2. **Interagiu** — nome do evento corresponde à regex `^(cta_click|menu_click|instagram_click)$`
   3. **Clicou no CTA** — evento `cta_click`
   4. **Escolheu cliente/motorista** — evento `cta_click` com condição adicional `audience` em (`client`, `driver`)
   5. **Iniciou cadastro** — evento `signup_started`
   6. **Concluiu cadastro** — evento `signup_completed`
3. Use **funil fechado** (ordem estrita) para medir queda real etapa a etapa.
4. Adicione o detalhamento (breakdown) por **Audiência** (dimensão personalizada criada no pré-requisito) para comparar o funil de clientes vs. motoristas lado a lado.
5. O degrau com maior queda percentual é o gargalo prioritário.

### FASE 10 — Tempo real e histórico

- **Tempo real:** Relatórios → Tempo real. Nativo, não precisa configurar nada — mostra usuários ativos, eventos e origem dos últimos ~30 minutos.
- **Histórico:** Relatórios → Ciclo de vida → Engajamento → Eventos, para evolução de cada evento por dia. Use o seletor de datas (canto superior direito) para Hoje / 7 dias / 30 dias / período personalizado.
- **Comparação entre períodos:** no mesmo seletor de datas, ative **Comparar** e escolha o período anterior (ex.: Semana 1 vs. Semana 2) para avaliar se uma mudança na LP melhorou a conversão.

### FASE 11 — Dashboard

Antes de construir qualquer coisa própria, teste se os relatórios nativos do GA4 (Aquisição, Engajamento, a Exploração de funil da Fase 9 e a de "sem interação" da Fase 7, salvas na Biblioteca) já respondem às perguntas do negócio. Para este projeto (site pequeno, um único funil, um só domínio), **os relatórios nativos do GA4 devem ser suficientes** — não recomendamos construir um dashboard próprio agora.

Se no futuro for necessário cruzar os números do GA4 com o status real dos leads no Supabase (ex.: motorista aprovado, contatado, etc.) em uma única tela para stakeholders, aí sim vale considerar uma área administrativa própria — peça essa implementação quando o requisito surgir.

### FASE 12 — Validação final

Rode os testes abaixo direto em produção, com um navegador real (não sandbox) e o GA4 em Tempo real aberto em outra aba:

1. Abrir a LP → confirmar `page_view`.
2. Clicar em um CTA de cliente → `cta_click` + `signup_started` com `audience=client`.
3. Preencher e enviar o formulário de cliente → `signup_completed` com `audience=client` (isso grava um lead real — combine com a equipe antes).
4. Repetir 2-3 para motorista (`audience=driver`).
5. Clicar no Instagram → `instagram_click`.
6. Abrir a LP com UTMs de teste → confirmar origem/campanha no Tempo real.
7. Confirmar que `signup_completed` aparece marcado como **conversão** (Admin → Eventos → coluna "Marcar como conversão").
8. Revisar a checklist de critérios de aceite do briefing original (`implementação_métricas/CLAUDE.md`, seção 25) e marcar o que está concluído. Pendências conhecidas: link/evento de WhatsApp (aguardando número) e nenhuma outra.
