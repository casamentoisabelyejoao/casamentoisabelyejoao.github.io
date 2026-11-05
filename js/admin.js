// Área administrativa: login por link no e-mail e consulta das confirmações e dos presentes.
// Só e-mails cadastrados na tabela admin_emails do banco conseguem ver os dados.
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("admin");
  const key = window.SUPABASE_KEY;
  const client = window.supabase.createClient(window.SUPABASE_URL, key, {
    auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true },
    global: {
      // Chaves novas do Supabase (sb_...) não são tokens; não podem ir no cabeçalho Authorization.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const giftName = id => WEDDING.gifts.find(g => g.id === id)?.name ?? `Presente ${id}`;
  const date = value => new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const state = {
    user: null, ready: false,
    email: "", sending: false, sent: false, loginError: "", code: "", verifying: false,
    loading: false, loadError: false, allowed: false,
    attendance: [], gifts: [],
    filter: "Todos", tab: "presencas",
    confirm: null, // { kind: "gift" | "attendance", id, label }
    busy: false, notice: "",
  };

  // ---------- Telas ----------
  function loginView() {
    if (state.sent) {
      return `<form class="attendance-form admin-login-form admin-code-form" novalidate>
        <h2 class="admin-login-title">Confira seu e-mail</h2>
        <p class="attendance-companion-note">Enviamos um e-mail para <strong>${escapeHtml(state.email)}</strong>. Se não chegar em alguns minutos, olhe a caixa de spam.</p>
        <label class="attendance-name">Digite o código do e-mail<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" value="${escapeHtml(state.code)}"${state.verifying ? " disabled" : ""}></label>
        <p class="attendance-companion-note">Ou clique no link do e-mail. Se abrir o link neste mesmo navegador, esta página entra sozinha.</p>
        ${state.loginError ? `<p class="gift-feedback" role="alert">${escapeHtml(state.loginError)}</p>` : ""}
        ${hoverButton({ text: state.verifying ? "Entrando…" : "Entrar", attrs: `type="submit"${state.verifying ? " disabled" : ""}` })}
        <div class="admin-login">${hoverButton({ text: "Usar outro e-mail ou reenviar", attrs: 'type="button" data-action="restart"' })}</div>
      </form>`;
    }
    return `<form class="attendance-form admin-login-form" novalidate>
      <h2 class="admin-login-title">Acesso do administrador</h2>
      <label class="attendance-name">Seu e-mail<input type="email" name="email" value="${escapeHtml(state.email)}" autocomplete="email" required${state.sending ? " disabled" : ""}></label>
      <p class="attendance-companion-note">Você vai receber um link no e-mail para entrar, sem precisar de senha.</p>
      ${state.loginError ? `<p class="gift-feedback" role="alert">${escapeHtml(state.loginError)}</p>` : ""}
      ${hoverButton({ text: state.sending ? "Enviando…" : "Enviar link de acesso", attrs: `type="submit"${state.sending ? " disabled" : ""}` })}
    </form>`;
  }

  function attendanceView() {
    const rows = state.attendance;
    const visible = rows.filter(row => state.filter === "Todos" || row.attending === (state.filter === "Confirmados"));
    const people = rows.filter(r => r.attending).reduce((total, r) => total + 1 + (r.companions?.length ?? 0), 0);
    return `<div class="admin-summary">
        <div><strong>${people}</strong><span>Presenças confirmadas, com acompanhantes</span></div>
        <div><strong>${rows.filter(r => !r.attending).length}</strong><span>Não poderão comparecer</span></div>
        <div><strong>${rows.length}</strong><span>Respostas recebidas</span></div>
      </div>
      <div class="admin-toolbar" role="group" aria-label="Filtrar respostas">${["Todos", "Confirmados", "Não comparecerão"].map(v => hoverButton({ text: v, active: v === state.filter, attrs: `type="button" data-filter="${v}" aria-pressed="${v === state.filter}"` })).join("")}</div>
      ${visible.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nome</th><th>Acompanhantes</th><th>Resposta</th><th>Atualização</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>
        ${visible.map(row => `<tr><td>${escapeHtml(row.guest_name)}</td>
          <td>${row.companions?.length ? `<ul class="admin-companions">${row.companions.map(n => `<li>${escapeHtml(n)}</li>`).join("")}</ul>` : "—"}</td>
          <td>${row.attending ? "Confirmado" : "Não comparecerá"}</td>
          <td>${date(row.updated_at)}</td>
          <td><button type="button" class="admin-row-action" data-delete="${row.id}" data-label="${escapeHtml(row.guest_name)}">Apagar</button></td></tr>`).join("")}
      </tbody></table></div>` : `<p class="empty-gifts">Nenhuma resposta encontrada.</p>`}`;
  }

  function giftsView() {
    const rows = state.gifts;
    return `<div class="admin-summary admin-summary-2">
        <div><strong>${rows.length}</strong><span>Presentes escolhidos</span></div>
        <div><strong>${WEDDING.gifts.length - rows.length}</strong><span>Ainda disponíveis</span></div>
      </div>
      ${rows.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nº</th><th>Presente</th><th>Escolhido por</th><th>Data</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>
        ${rows.map(row => `<tr><td>${String(row.gift_id).padStart(2, "0")}</td><td>${escapeHtml(giftName(row.gift_id))}</td>
          <td>${escapeHtml(row.guest_name)}</td><td>${date(row.selected_at)}</td>
          <td><button type="button" class="admin-row-action" data-release="${row.gift_id}" data-label="${escapeHtml(giftName(row.gift_id))}">Liberar presente</button></td></tr>`).join("")}
      </tbody></table></div>` : `<p class="empty-gifts">Nenhum presente escolhido ainda.</p>`}`;
  }

  function confirmView() {
    const c = state.confirm;
    if (!c) return "";
    const isGift = c.kind === "gift";
    return `<div class="selection-overlay" data-action="cancel-confirm"></div>
      <div class="selection-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">${isGift ? "Liberar este presente?" : "Apagar esta resposta?"}</h2>
        <p><strong>${escapeHtml(c.label)}</strong><br>${isGift
          ? "O presente volta a ficar disponível para os convidados. Quem escolheu não será avisado."
          : "A resposta será apagada definitivamente. Use para respostas falsas ou repetidas."}</p>
        <div class="selection-actions">
          ${hoverButton({ text: state.busy ? "Aguarde…" : (isGift ? "Liberar" : "Apagar"), attrs: `type="button" data-action="do-confirm"${state.busy ? " disabled" : ""}` })}
          ${hoverButton({ text: "Voltar", attrs: `type="button" data-action="cancel-confirm"${state.busy ? " disabled" : ""}` })}
        </div>
      </div>`;
  }

  function render() {
    if (!state.ready) { root.innerHTML = `<p role="status" class="empty-gifts">Carregando…</p>`; return; }
    if (!state.user) { root.innerHTML = loginView(); return; }
    let body;
    if (state.loading && !state.allowed) body = `<p role="status">Consultando…</p>`;
    else if (state.loadError) body = `<p role="alert">Não foi possível consultar os dados. Tente atualizar.</p>`;
    else if (!state.allowed) body = `<section class="attendance-result"><p role="alert">Esta conta não tem permissão de administrador.</p></section>`;
    else body = `<div class="admin-toolbar admin-tabs" role="tablist">
        ${hoverButton({ text: "Confirmações de presença", active: state.tab === "presencas", attrs: `type="button" role="tab" data-tab="presencas" aria-selected="${state.tab === "presencas"}"` })}
        ${hoverButton({ text: "Presentes escolhidos", active: state.tab === "presentes", attrs: `type="button" role="tab" data-tab="presentes" aria-selected="${state.tab === "presentes"}"` })}
      </div>
      ${state.notice ? `<p class="gift-feedback" role="status">${escapeHtml(state.notice)}</p>` : ""}
      ${state.tab === "presencas" ? attendanceView() : giftsView()}`;
    root.innerHTML = `<p class="admin-account">Entrando como <strong>${escapeHtml(state.user.email ?? "")}</strong></p>
      <div class="admin-toolbar">
        ${hoverButton({ text: "Atualizar", iconHtml: icon("refresh", 16), attrs: `type="button" data-action="refresh"${state.loading ? " disabled" : ""}` })}
        ${hoverButton({ text: "Sair", iconHtml: icon("logOut", 16), attrs: 'type="button" data-action="signout"' })}
      </div>${body}${confirmView()}`;
  }

  // ---------- Dados ----------
  async function load() {
    if (!state.user) return;
    state.loading = true; state.loadError = false; render();
    try {
      const { data: allowed, error } = await client.rpc("is_admin");
      if (error) throw error;
      state.allowed = allowed === true;
      if (state.allowed) {
        const [attendance, gifts] = await Promise.all([client.rpc("admin_list_attendance"), client.rpc("admin_list_gifts")]);
        if (attendance.error) throw attendance.error;
        if (gifts.error) throw gifts.error;
        state.attendance = attendance.data ?? [];
        state.gifts = gifts.data ?? [];
      }
    } catch { state.loadError = true; }
    state.loading = false; render();
  }

  async function doConfirm() {
    const c = state.confirm;
    if (!c || state.busy) return;
    state.busy = true; render();
    const { data, error } = c.kind === "gift"
      ? await client.rpc("admin_release_gift", { p_gift_id: c.id })
      : await client.rpc("admin_delete_attendance", { p_id: c.id });
    state.busy = false; state.confirm = null;
    state.notice = error ? "Não foi possível concluir. Tente novamente."
      : data === true ? (c.kind === "gift" ? `“${c.label}” está disponível de novo.` : "Resposta apagada.")
      : "Esse item já tinha sido alterado. A lista foi atualizada.";
    await load();
  }

  // ---------- Eventos ----------
  root.addEventListener("submit", async event => {
    event.preventDefault();
    if (state.sent) { verifyCode(String(new FormData(event.target).get("code") || "")); return; }
    const email = String(new FormData(event.target).get("email") || "").trim().toLowerCase();
    state.email = email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { state.loginError = "Digite um e-mail válido."; render(); return; }
    state.sending = true; state.loginError = ""; render();
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    state.sending = false;
    if (error) state.loginError = error.status === 429 ? "Muitas tentativas. Espere alguns minutos e tente de novo." : "Não foi possível enviar o link. Tente novamente.";
    else state.sent = true;
    render();
  });

  root.addEventListener("click", async event => {
    const el = event.target.closest("button, [data-action]");
    if (!el || el.disabled) return;
    const action = el.dataset.action;
    if (action === "restart") { state.sent = false; state.code = ""; state.loginError = ""; render(); }
    if (action === "refresh") { state.notice = ""; load(); }
    if (action === "signout") { await client.auth.signOut(); }
    if (action === "cancel-confirm" && !state.busy) { state.confirm = null; render(); }
    if (action === "do-confirm") doConfirm();
    if (el.dataset.tab) { state.tab = el.dataset.tab; state.notice = ""; render(); }
    if (el.dataset.filter) { state.filter = el.dataset.filter; render(); }
    if (el.dataset.release) { state.confirm = { kind: "gift", id: Number(el.dataset.release), label: el.dataset.label }; render(); }
    if (el.dataset.delete) { state.confirm = { kind: "attendance", id: el.dataset.delete, label: el.dataset.label }; render(); }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && state.confirm && !state.busy) { state.confirm = null; render(); }
  });

  // Entrar digitando o código que veio no e-mail (funciona mesmo se o e-mail for aberto no celular).
  async function verifyCode(raw) {
    const token = raw.replace(/\D/g, "");
    state.code = token;
    if (token.length < 6) { state.loginError = "Digite o código de números que veio no e-mail."; render(); return; }
    state.verifying = true; state.loginError = ""; render();
    const { error } = await client.auth.verifyOtp({ email: state.email, token, type: "email" });
    state.verifying = false;
    if (error) {
      state.loginError = error.status === 429 ? "Muitas tentativas. Espere alguns minutos e tente de novo."
        : "Código inválido ou expirado. Confira o código ou peça um novo e-mail.";
      render();
    }
    // Se deu certo, onAuthStateChange abre a área admin.
  }

  // Se o link do e-mail for aberto em outra aba deste navegador, esta página também entra.
  window.addEventListener("storage", event => {
    if (!state.user && event.key && event.key.includes("-auth-token") && event.newValue) location.reload();
  });

  // Link expirado ou já usado: o Supabase volta para cá com o erro no endereço.
  const hashParams = new URLSearchParams(location.hash.slice(1));
  if (hashParams.get("error")) {
    state.loginError = hashParams.get("error_code") === "otp_expired"
      ? "Esse link de acesso expirou ou já foi usado. Peça um novo e-mail abaixo."
      : "Não foi possível entrar com esse link. Peça um novo e-mail abaixo.";
    history.replaceState(null, "", location.pathname);
  }

  client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    const changed = user?.id !== state.user?.id;
    state.user = user; state.ready = true;
    if (!user) { state.attendance = []; state.gifts = []; state.allowed = false; state.sent = false; }
    if (changed && user) setTimeout(load, 0);
    // Limpa o token de acesso da barra de endereço depois do login.
    if (user && location.hash.includes("access_token")) history.replaceState(null, "", location.pathname);
    render();
  });
  render();
});
