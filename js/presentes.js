// Lista de presentes: filtro, busca e escolha compartilhada entre convidados.
document.addEventListener("DOMContentLoaded", () => {
  const { giftCategories, filterGifts } = WEDDING;
  const STORAGE_KEY = "wedding-gift-choices";

  const state = {
    category: "Todos",
    search: "",
    selected: [],       // [{ id }] presentes já escolhidos, vindo do banco
    own: loadOwn(),     // { giftId: token } das escolhas feitas neste navegador
    pending: null,      // { id, name, cancel }
    busy: false,
  };

  const tabs = document.querySelector(".gift-tabs");
  const grid = document.getElementById("gift-grid");
  const count = document.getElementById("gift-count");
  const empty = document.getElementById("gift-empty");
  const pageFeedback = document.getElementById("page-feedback");
  const dialog = document.getElementById("selection");
  const dialogTitle = document.getElementById("selection-title");
  const dialogDesc = document.getElementById("selection-desc");
  const nameField = document.getElementById("selection-name-field");
  const nameInput = document.getElementById("selection-name");
  const dialogFeedback = document.getElementById("dialog-feedback");
  const confirmBtn = document.getElementById("selection-confirm");
  const backBtn = document.getElementById("selection-back");

  function loadOwn() {
    try {
      const value = JSON.parse(storageGet(STORAGE_KEY) ?? "{}");
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.fromEntries(Object.entries(value).filter(([, token]) => typeof token === "string"));
      }
    } catch { /* sem escolhas salvas */ }
    return {};
  }

  function setFeedback(text) {
    const target = state.pending ? dialogFeedback : pageFeedback;
    pageFeedback.hidden = dialogFeedback.hidden = true;
    if (text) { target.textContent = text; target.hidden = false; }
  }

  function renderTabs() {
    tabs.innerHTML = giftCategories.map(item => hoverButton({
      text: escapeHtml(item), active: state.category === item,
      attrs: `data-category="${escapeHtml(item)}" aria-pressed="${state.category === item}"`,
    })).join("");
  }

  function renderGrid() {
    const items = filterGifts(state.category, state.search);
    count.textContent = `${items.length} ${items.length === 1 ? "ideia de presente" : "ideias de presentes"} · ${state.selected.length} escolhidos`;
    empty.hidden = items.length > 0;
    grid.innerHTML = items.map(item => {
      const num = String(item.id).padStart(2, "0");
      const isSelected = state.selected.some(row => row.id === item.id);
      const isOwn = Boolean(state.own[item.id]) && isSelected;
      const label = isOwn ? "Cancelar escolha" : isSelected ? "Já escolhido" : "Escolher presente";
      const status = isOwn ? "Escolhido por você" : isSelected ? "Presente já selecionado" : "Disponível";
      return `<article class="gift-item">
        <span class="gift-number">${num}</span>
        <img class="gift-image" src="assets/gifts/gift-${num}.jpg" alt="${escapeHtml(item.name)}" width="384" height="274" loading="lazy">
        <span class="eyebrow">${escapeHtml(item.category)}</span><h2>${escapeHtml(item.name)}</h2>
        ${hoverButton({ text: label, iconHtml: isSelected ? icon("check", 16) : undefined, active: isSelected, className: "gift-action",
          attrs: `data-gift="${item.id}" data-cancel="${isOwn}"${isSelected && !isOwn ? " disabled" : ""}` })}
        <span class="gift-state${isSelected ? " gift-state-selected" : ""}">${status}</span>
      </article>`;
    }).join("");
  }

  async function loadSelections() {
    try {
      const rows = await rpc("list_selected_gifts");
      // Só o número do presente é usado: o nome de quem escolheu fica visível apenas para os administradores.
      state.selected = (rows ?? []).map(row => ({ id: row.gift_id }));
    } catch {
      setFeedback("Não foi possível consultar as escolhas. Tente novamente.");
    }
    renderGrid();
  }

  function openDialog(id, cancel) {
    const gift = WEDDING.gifts.find(g => g.id === id);
    state.pending = { id, name: gift.name, cancel };
    dialogTitle.textContent = cancel ? "Cancelar escolha?" : "Escolher este presente?";
    dialogDesc.innerHTML = `<strong>${escapeHtml(gift.name)}</strong><br>${cancel
      ? "O presente ficará disponível para outros convidados."
      : "O presente ficará marcado como selecionado para os demais convidados. Seu nome ficará visível apenas para os noivos. Você pode cancelar sua escolha neste navegador."}`;
    nameField.hidden = cancel;
    nameInput.value = "";
    dialogFeedback.hidden = true;
    pageFeedback.hidden = true;
    renderDialogButtons();
    dialog.hidden = false;
    (cancel ? confirmBtn : nameInput).focus();
  }

  function closeDialog() {
    if (state.busy) return;
    state.pending = null;
    dialog.hidden = true;
  }

  function renderDialogButtons() {
    confirmBtn.innerHTML = hoverContent(state.busy ? "Salvando…" : "Confirmar");
    backBtn.innerHTML = hoverContent("Voltar");
    confirmBtn.disabled = backBtn.disabled = nameInput.disabled = state.busy;
  }

  async function confirmChoice() {
    const pending = state.pending;
    if (!pending || state.busy) return;
    const guestName = nameInput.value.trim();
    if (!pending.cancel && guestName.length < 2) { setFeedback("Escreva seu nome para que os noivos saibam quem escolheu."); return; }
    state.busy = true; renderDialogButtons(); setFeedback("");
    let message = "";
    try {
      const token = state.own[pending.id] ?? newToken();
      const next = { ...state.own };
      if (pending.cancel) {
        const released = await rpc("release_wedding_gift", { p_gift_id: pending.id, p_token: token }).catch(() => { throw new Error("Não foi possível cancelar sua escolha. Tente novamente."); });
        if (released !== true) throw new Error("Esta escolha não pertence a este dispositivo ou já foi cancelada.");
        delete next[pending.id];
        message = "Sua escolha foi cancelada.";
      } else {
        const selected = await rpc("select_wedding_gift", { p_gift_id: pending.id, p_token: token, p_guest_name: guestName }).catch(() => { throw new Error("Não foi possível salvar sua escolha. Tente novamente."); });
        if (selected === true) { next[pending.id] = token; message = "Presente escolhido com carinho. Obrigado!"; }
        else message = "Este presente acabou de ser escolhido por outro convidado.";
      }
      state.own = next;
      if (!storageSet(STORAGE_KEY, JSON.stringify(next))) message = "Escolha salva. Este navegador não permite guardar a opção de cancelamento.";
      state.busy = false;
      state.pending = null;
      dialog.hidden = true;
      setFeedback(message);
      await loadSelections();
    } catch (error) {
      state.busy = false;
      renderDialogButtons();
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.");
    }
  }

  tabs.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    renderTabs(); renderGrid();
  });
  document.getElementById("gift-search").addEventListener("input", event => { state.search = event.target.value; renderGrid(); });
  grid.addEventListener("click", event => {
    const button = event.target.closest("[data-gift]");
    if (!button || button.disabled) return;
    openDialog(Number(button.dataset.gift), button.dataset.cancel === "true");
  });
  confirmBtn.addEventListener("click", confirmChoice);
  nameInput.addEventListener("keydown", event => { if (event.key === "Enter") confirmChoice(); });
  dialog.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", closeDialog));
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !dialog.hidden) closeDialog(); });
  // Atualiza as escolhas quando o convidado volta para a aba.
  window.addEventListener("focus", () => { if (!state.pending) loadSelections(); });

  renderTabs();
  renderGrid();
  loadSelections();
});
