# Analytics — MudaJá Landing Page

Documentação da implementação de monitoramento (GA4) na Landing Page. Mantenha esta tabela atualizada sempre que um evento novo for adicionado, alterado ou removido.

## Stack

Site estático (HTML + CSS + JS vanilla, ES Modules), sem build step, servido pela Vercel a partir de `dist/`. Não há `.env` consumido pelo client — o Measurement ID do GA4 fica hardcoded no `<head>` de `dist/index.html`, pois não há etapa de build para injetar variáveis de ambiente no navegador.

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
