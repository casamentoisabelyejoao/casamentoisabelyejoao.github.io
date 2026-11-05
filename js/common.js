// Partes comuns a todas as páginas: ícones, botões, cabeçalho, rodapé e acesso ao banco.

// Ícones (traçados do Lucide)
const ICON_PATHS = {
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
  mapPin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
};

function icon(name, size = 24, stroke = 2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// Conteúdo interno do botão com animação (texto, texto+ícone no hover, círculo que se expande).
function hoverContent(text, iconHtml) {
  return `<span class="hb-label">${text}</span><span class="hb-hover" aria-hidden="true"><span>${text}</span>${iconHtml ?? icon("arrowRight", 16)}</span><span class="hb-dot" aria-hidden="true"></span>`;
}

function hoverButton({ text, iconHtml, active = false, className = "", attrs = "" }) {
  return `<button class="hbtn${active ? " active" : ""}${className ? " " + className : ""}" ${attrs}>${hoverContent(text, iconHtml)}</button>`;
}

// Cabeçalho e rodapé
function renderShell() {
  const page = document.body.dataset.page;
  const nav = [["index.html", "O convite", "home"], ["orientacoes.html", "O grande dia", "orientacoes"], ["presentes.html", "Presentes", "presentes"]];
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `<a href="index.html" class="monogram ihover" aria-label="Isabely e João Victor — início">I<span>&amp;</span>V</a>
    <nav aria-label="Navegação principal">${nav.map(([href, label, key]) => `<a href="${href}" class="ihover"${key === page ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
    <span class="header-date">29.01.2027</span>`;
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `${icon("heart", 17, 1.2)}<p>Isabely <em class="amp">&amp;</em> João Victor</p><span>29 de janeiro de 2027 · Com amor</span>`;
  const site = document.querySelector(".wedding-site");
  site.prepend(header);
  site.append(footer);
}

// Chama uma função pública do banco (Supabase RPC).
async function rpc(name, params = {}) {
  const response = await fetch(`${window.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: window.SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    let code = "";
    try { code = (await response.json()).message || ""; } catch { /* resposta sem corpo */ }
    const error = new Error(`Erro ${response.status}`);
    error.code = code;
    throw error;
  }
  return response.json();
}

// Mensagens amigáveis para os avisos que o banco pode devolver.
const DB_MESSAGES = {
  limite_presentes: "Você escolheu muitos presentes em pouco tempo. Tente de novo mais tarde.",
  limite_respostas: "Muitas respostas foram enviadas desta conexão. Tente de novo mais tarde.",
  nome_invalido: "Escreva seu nome completo.",
  acompanhante_invalido: "Preencha o nome de cada acompanhante ou remova o campo vazio.",
  acompanhantes_demais: "O limite é de 10 acompanhantes por resposta.",
};
function dbMessage(error, fallback) {
  return DB_MESSAGES[error?.code] ?? fallback;
}

function newToken() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }

// Substitui marcadores <i data-icon="nome" data-size="24" data-stroke="1.3"></i> por SVGs.
function hydrateIcons(root = document) {
  root.querySelectorAll("i[data-icon]").forEach(el => {
    el.outerHTML = icon(el.dataset.icon, Number(el.dataset.size || 24), Number(el.dataset.stroke || 2));
  });
  root.querySelectorAll("[data-hover]").forEach(el => {
    const iconName = el.dataset.hoverIcon;
    el.innerHTML = hoverContent(el.dataset.hover, iconName ? icon(iconName, 16) : undefined);
    el.removeAttribute("data-hover");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderShell();
  hydrateIcons();
});
