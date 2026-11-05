// Área administrativa.
// O login de administrador do banco usa o serviço de login do Lovable, que só funciona
// no site hospedado pelo Lovable. Como os dois sites usam o mesmo banco, esta página
// leva o administrador até a área admin do site do Lovable.
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("admin");
  const url = (window.ADMIN_URL || "").trim();
  root.innerHTML = `<section class="attendance-result">
    <h2>Acesso do administrador</h2>
    <p>As confirmações ficam guardadas com segurança e só podem ser consultadas pela conta administradora, na área admin do site no Lovable. As respostas enviadas por este site aparecem lá normalmente.</p>
    ${url
      ? `<div class="admin-login"><a class="hbtn" href="${escapeHtml(url)}">${hoverContent("Abrir área administrativa", icon("arrowUpRight", 16))}</a></div>`
      : `<p role="alert">Abra o seu projeto no Lovable e acesse a página <strong>/admin</strong> do site publicado.</p>`}
  </section>`;
});
