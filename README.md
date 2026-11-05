# Isabely & João Victor — site do casamento

Recriação do site original (feito no Lovable) como site estático: só HTML, CSS e JavaScript, sem build e sem dependências para instalar.

## Páginas
- `index.html` — convite com o envelope animado pela rolagem
- `orientacoes.html` — O grande dia (horários e local)
- `presentes.html` — lista com 80 presentes; o convidado escolhe e pode cancelar a própria escolha
- `presenca.html` — confirmação de presença com acompanhantes
- `admin.html` — lista das confirmações (só para a conta administradora)

## Banco de dados
Banco próprio no Supabase (`js/config.js`). Toda a estrutura e as regras de segurança estão em `supabase/setup.sql`: basta colar no SQL Editor do Supabase e clicar em Run.

- Os convidados só conseguem ver quais presentes já foram escolhidos, nunca por quem.
- Cada convidado só vê a própria confirmação de presença.
- Limites contra abuso: 5 presentes e 10 respostas novas por conexão a cada hora.

## Rodar no computador
```bash
python -m http.server 5173
```
Depois abra http://localhost:5173

## Publicar
Envie a pasta inteira para qualquer hospedagem de sites estáticos (Netlify, Vercel, GitHub Pages, Cloudflare Pages).

## Área admin
`admin.html`: login por link enviado ao e-mail. Só entram os e-mails cadastrados na tabela `admin_emails`.
Para adicionar um admin, rode no SQL Editor:
```sql
insert into public.admin_emails (email) values ('email@exemplo.com');
```
No plano grátis, o Supabase só envia o e-mail de login para membros da equipe do projeto (Organization → Team).
