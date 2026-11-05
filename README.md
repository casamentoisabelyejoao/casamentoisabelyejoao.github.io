# Isabely & João Victor — site do casamento

Recriação do site original (feito no Lovable) como site estático: só HTML, CSS e JavaScript, sem build e sem dependências para instalar.

## Páginas
- `index.html` — convite com o envelope animado pela rolagem
- `orientacoes.html` — O grande dia (horários e local)
- `presentes.html` — lista com 80 presentes; o convidado escolhe e pode cancelar a própria escolha
- `presenca.html` — confirmação de presença com acompanhantes
- `admin.html` — lista das confirmações (só para a conta administradora)

## Banco de dados
Usa o mesmo banco Supabase do site original (`js/config.js`), então presentes escolhidos e presenças confirmadas continuam os mesmos.

## Rodar no computador
```bash
python -m http.server 5173
```
Depois abra http://localhost:5173

## Publicar
Envie a pasta inteira para qualquer hospedagem de sites estáticos (Netlify, Vercel, GitHub Pages, Cloudflare Pages).

## Área admin
O login de administrador deste banco funciona só pelo serviço de login do Lovable, que existe apenas no site hospedado pelo Lovable. Por isso a lista de confirmações continua sendo consultada na página `/admin` do site no Lovable (os dois sites usam o mesmo banco, então todas as respostas aparecem lá).
Para a página `admin.html` deste site mostrar um botão direto para lá, preencha `window.ADMIN_URL` em `js/config.js`.
