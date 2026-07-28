# Guia Completo — Diagnóstico de Revenue Intelligence 100% Automatizado

Do zero até no ar. Sem custo mensal no volume que você tem hoje. Siga na ordem.

---

## PASSO 1 — Criar sua agenda (Calendly, grátis)

Você ainda não tem — vamos criar agora.

1. Acesse **calendly.com** e clique em "Sign up free".
2. Cadastre com seu e-mail ou conta Google.
3. No onboarding, escolha "For myself" (não "For a team").
4. Crie um tipo de evento novo: clique em "Create Event Type" → "One-on-One".
5. Configure:
   - **Nome do evento:** "Análise de Arquitetura — AI Applied"
   - **Duração:** 45 minutos
   - **Local:** Google Meet ou Zoom (o Calendly integra automático se você conectar sua conta Google/Zoom nas configurações)
6. Defina sua disponibilidade em "Availability" (dias e horários que você aceita reunião).
7. Salve e clique em "Share" — copie o link (algo como `calendly.com/seu-nome/analise-arquitetura`).
8. **Guarde esse link** — vai ser usado no Passo 5.

*Plano gratuito do Calendly permite 1 tipo de evento — suficiente pra isso. Se quiser mais eventos depois, tem plano pago, mas não é necessário agora.*

---

## PASSO 2 — Supabase (banco de dados dos leads)

1. Acesse **supabase.com** → "Start your project" → login com GitHub ou e-mail.
2. Se já tem o projeto do GrowthOS, pode usar o mesmo (só criar a tabela nova abaixo nele). Se preferir separar, clique "New Project", dê um nome (ex: `ai-applied-diagnostico`), escolha a região mais próxima (São Paulo, se disponível) e defina uma senha de banco (guarde essa senha em local seguro).
3. Espere o projeto provisionar (1-2 minutos).
4. No menu lateral, clique em **SQL Editor** → "New query" e cole:

```sql
create table diagnosticos_ri (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  respostas jsonb,
  score_atribuicao int,
  score_arquitetura int,
  score_lifecycle int,
  receita_em_risco numeric,
  criado_em timestamptz default now()
);

alter table diagnosticos_ri enable row level security;
-- a função serverless usa a service_role key, que já ignora RLS,
-- então não precisa de policy de insert público aqui.
```

5. Clique em "Run". Deve aparecer "Success. No rows returned".
6. Vá em **Settings** (ícone de engrenagem) → **API**.
7. Copie e guarde:
   - **Project URL** → isso é o `SUPABASE_URL`
   - **service_role key** (não é a `anon` key — role bem pra baixo até achar "service_role", clique em "Reveal") → isso é o `SUPABASE_SERVICE_KEY`

⚠️ A `service_role` key dá acesso total ao banco — nunca cole ela em código público ou no front-end. Ela só vai numa variável de ambiente da Vercel (Passo 4).

---

## PASSO 3 — Resend (envio de e-mail, grátis até 3.000/mês)

1. Acesse **resend.com** → "Sign up" (grátis, sem cartão de crédito).
2. Confirme seu e-mail.
3. No painel, vá em **API Keys** → "Create API Key". Dê um nome (ex: `diagnostico-ri`) e copie a chave gerada — isso é o `RESEND_API_KEY`. **Copie agora, ela só aparece uma vez.**
4. (Opcional, mas recomendado) Pra usar seu próprio domínio no remetente (ex: `diagnostico@aiapplied.com.br` em vez de um domínio genérico do Resend):
   - Vá em **Domains** → "Add Domain" → digite seu domínio.
   - O Resend mostra 3-4 registros DNS (TXT, CNAME) pra você adicionar no painel do seu domínio (Registro.br, GoDaddy, Cloudflare, onde quer que você comprou o domínio).
   - Depois de adicionar, volta no Resend e clica "Verify" — pode levar alguns minutos a algumas horas pra propagar.
   - Enquanto não verifica, você pode testar tudo com o remetente padrão `onboarding@resend.dev` — funciona igual, só não é sua marca ainda.

---

## PASSO 4 — Deploy na Vercel

1. Acesse **vercel.com** → login (se já usa pra outros projetos, use a mesma conta).
2. Clique em "Add New..." → "Project".
3. Você precisa subir a pasta `diagnostico-ri` completa (com `index.html`, a pasta `api/`, e o `package.json`) — diferente do Vercel Drop simples que só serve HTML estático, esse projeto tem uma função de backend junto, então precisa ser importado como projeto (via GitHub) ou enviado com a CLI:
   - **Caminho mais simples:** crie um repositório novo no GitHub, suba os arquivos da pasta pra lá, depois em "Add New Project" na Vercel escolha "Import Git Repository" e selecione esse repositório.
   - **Alternativa via terminal:** se tiver Node instalado na sua máquina, dentro da pasta `diagnostico-ri` rode `npx vercel` e siga as instruções (login, nome do projeto, confirmar deploy).
4. Depois que o projeto for criado na Vercel, vá em **Settings → Environment Variables** e adicione, uma por uma:
   - `RESEND_API_KEY` = (o que você copiou no Passo 3)
   - `SUPABASE_URL` = (o que você copiou no Passo 2)
   - `SUPABASE_SERVICE_KEY` = (o que você copiou no Passo 2)
   - `FROM_EMAIL` = `AI Applied <onboarding@resend.dev>` (ou seu domínio verificado, ex: `AI Applied <diagnostico@aiapplied.com.br>`)
5. Vá em **Deployments** → nos três pontinhos do último deploy → "Redeploy" (as variáveis de ambiente só valem a partir do próximo deploy).
6. Quando terminar, a Vercel te dá uma URL tipo `diagnostico-ri.vercel.app` — esse é o link que você vai divulgar.

---

## PASSO 5 — Conectar o link da agenda no código

1. Abra o arquivo `index.html` (pode editar direto no GitHub, ou baixar, editar e subir de novo).
2. Procure a linha (perto do topo, dentro da tag `<script>`):
   ```js
   const CALENDLY_URL = "https://calendly.com/SEU-LINK-AQUI";
   ```
3. Troque pelo link real que você copiou no Passo 1.
4. Salve e, se estiver usando GitHub, dê commit/push — a Vercel redeploya sozinha automaticamente quando detecta mudança no repositório.

---

## PASSO 6 — Testar de ponta a ponta

Antes de mandar pros 2 leads reais, teste com seu próprio e-mail:

1. Abra a URL do seu projeto na Vercel.
2. Preencha o diagnóstico até o fim, use um e-mail seu no final.
3. Confira:
   - [ ] O e-mail chegou (confira também a caixa de spam na primeira vez)
   - [ ] O PDF anexado abre e mostra os números certos
   - [ ] No Supabase, a tabela `diagnosticos_ri` tem uma linha nova com seus dados
   - [ ] O botão "Agendar Análise de Arquitetura" abre o Calendly certo

Se algo não funcionar, veja os logs em **Vercel → seu projeto → Deployments → clique no deploy → aba "Functions"** — qualquer erro (chave errada, variável faltando) aparece ali com a mensagem exata do que falhou.

---

## Depois de tudo funcionando

Manda o link do diagnóstico (`sua-url.vercel.app`) pros 2 leads que já pediram — a partir daí, é 100% automático: eles preenchem, recebem o PDF sozinho, e podem agendar direto com você sem precisar de nenhum toque manual seu no meio do caminho.
