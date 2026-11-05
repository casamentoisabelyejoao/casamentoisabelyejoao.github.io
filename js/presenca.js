// Confirmação de presença: cada navegador guarda um código próprio e só vê a própria resposta.
document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "wedding-attendance-token";
  const root = document.getElementById("attendance");
  const state = { token: "", name: "", attending: null, companions: [], saved: null, busy: true, error: "" };

  function render() {
    if (state.saved) {
      const s = state.saved;
      root.innerHTML = `<section class="attendance-result" aria-live="polite">${icon("heart", 32, 1.3)}
        <h2>${s.attending ? "Presença confirmada!" : "Resposta recebida."}</h2>
        <p>${escapeHtml(s.guestName)}, ${s.attending ? "será uma alegria ter você conosco neste dia tão especial." : "agradecemos por nos avisar. Você faz parte da nossa história."}</p>
        ${s.attending && s.companions.length ? `<div class="attendance-companion-result"><h3>Acompanhantes confirmados</h3><ul>${s.companions.map(c => `<li>${escapeHtml(c)}</li>`).join("")}</ul></div>` : ""}
        ${hoverButton({ text: "Alterar resposta", attrs: 'type="button" data-action="edit"' })}
      </section>`;
      return;
    }
    const disabled = state.busy ? " disabled" : "";
    root.innerHTML = `<form class="attendance-form" novalidate>
      <label class="attendance-name">Seu nome completo<input name="name" value="${escapeHtml(state.name)}" autocomplete="name" maxlength="80" required minlength="2"${disabled}></label>
      <fieldset${disabled}><legend>Você poderá estar presente?</legend><div class="attendance-options">
        <label><input type="radio" name="attending" value="yes"${state.attending === true ? " checked" : ""}>Sim, estarei presente</label>
        <label><input type="radio" name="attending" value="no"${state.attending === false ? " checked" : ""}>Não poderei comparecer</label>
      </div></fieldset>
      ${state.attending === true ? `<fieldset class="attendance-companions"${disabled}><legend>Acompanhantes inclusos no convite</legend>
        <p class="attendance-companion-note">Confirme apenas quem está incluso no seu convite e irá com você.</p>
        <div class="attendance-companion-fields">${state.companions.map((c, i) => `<div class="attendance-companion-row">
          <label class="attendance-name">Nome do acompanhante ${i + 1}<input data-companion="${i}" value="${escapeHtml(c)}" autocomplete="off" maxlength="80" minlength="2" required></label>
          ${hoverButton({ text: icon("x", 18), iconHtml: icon("x", 18), className: "companion-remove", attrs: `type="button" data-remove="${i}" aria-label="Remover acompanhante ${i + 1}" title="Remover acompanhante ${i + 1}"` })}
        </div>`).join("")}</div>
        ${hoverButton({ text: "Adicionar acompanhante", iconHtml: icon("plus", 16), attrs: 'type="button" data-action="add"' })}
      </fieldset>` : ""}
      ${state.error ? `<p class="gift-feedback" role="alert">${escapeHtml(state.error)}</p>` : ""}
      ${hoverButton({ text: state.busy ? "Aguarde…" : "Enviar resposta", iconHtml: icon("check", 16), attrs: `type="submit"${state.busy || !state.token ? " disabled" : ""}` })}
    </form>`;
  }

  // Mantém o estado em dia enquanto o convidado digita, sem redesenhar (para não perder o foco).
  root.addEventListener("input", event => {
    const el = event.target;
    if (el.name === "name") state.name = el.value;
    if (el.dataset.companion) state.companions[Number(el.dataset.companion)] = el.value;
  });
  root.addEventListener("change", event => {
    if (event.target.name === "attending") { state.attending = event.target.value === "yes"; render(); }
  });
  root.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.action === "edit") { state.saved = null; render(); }
    if (button.dataset.action === "add") {
      state.companions.push(""); render();
      root.querySelector(`[data-companion="${state.companions.length - 1}"]`)?.focus();
    }
    if (button.dataset.remove) { state.companions.splice(Number(button.dataset.remove), 1); render(); }
  });
  root.addEventListener("submit", async event => {
    event.preventDefault();
    if (state.busy) return;
    const guestName = state.name.trim();
    const companions = state.attending ? state.companions.map(c => c.trim()) : [];
    const badName = guestName.length < 2 || guestName.length > 80;
    const badCompanion = companions.some(c => c.length < 2 || c.length > 80);
    if (state.attending === null) { state.error = "Escolha se poderá estar presente."; render(); return; }
    if (badCompanion) { state.error = "Preencha o nome de cada acompanhante ou remova o campo vazio."; render(); return; }
    if (badName) { state.error = "Escreva seu nome completo."; render(); return; }
    state.busy = true; state.error = ""; render();
    try {
      const saved = await rpc("save_wedding_attendance_with_companions", { p_token: state.token, p_guest_name: guestName, p_attending: state.attending, p_companions: companions });
      if (!saved) throw new Error();
      state.saved = { guestName, attending: state.attending, companions };
      state.name = guestName; state.companions = companions;
    } catch {
      state.error = "Não foi possível salvar sua resposta. Tente novamente.";
    }
    state.busy = false; render();
  });

  async function restore() {
    render();
    try {
      const stored = storageGet(STORAGE_KEY);
      const key = stored && UUID_RE.test(stored) ? stored : newToken();
      storageSet(STORAGE_KEY, key);
      state.token = key;
      const rows = await rpc("get_wedding_attendance_with_companions", { p_token: key });
      const row = rows?.[0];
      if (row) {
        state.saved = { guestName: row.guest_name, attending: row.attending, companions: row.companions ?? [] };
        state.name = row.guest_name; state.attending = row.attending; state.companions = [...state.saved.companions];
      }
    } catch {
      state.error = "Não foi possível recuperar sua resposta. Confira se este navegador permite guardar dados e tente novamente.";
    }
    state.busy = false; render();
  }
  restore();
});
