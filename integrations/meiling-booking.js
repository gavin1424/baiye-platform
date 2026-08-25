(() => {
  const API = "https://chuang-baiye-ai.baiye-platform.workers.dev/api/merchant/meiling/booking";
  const LINE = "https://lin.ee/SdFAst4";
  const root = document.querySelector("[data-meiling-booking]");
  if (!root) return;
  const state = { services: [], service: null, date: "", slot: null, manageToken: "", booking: null };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const localTime = (value) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const api = async (path = "", options = {}) => {
    const response = await fetch(`${API}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "預約系統目前暫時忙碌，請稍後再試，或透過 LINE 聯絡我們。");
    return data;
  };
  const message = (text, kind = "info") => `<div class="mb-message ${kind}" role="status">${esc(text)}</div>`;
  const shell = (content, step = "") => { root.innerHTML = `<div class="mb-card"><p class="mb-eyebrow">美玲拼布｜線上預約</p>${step ? `<div class="mb-step">${esc(step)}</div>` : ""}${content}</div>`; };

  async function start() {
    shell("<h1>選擇預約服務</h1><p>不用註冊會員，依步驟選擇服務、日期與時間即可。</p><div class=\"mb-loading\">正在載入可預約服務…</div><div class=\"mb-actions\"><button class=\"mb-secondary\" data-manage>查看／管理預約</button></div>", "STEP 1／5");
    root.querySelector("[data-manage]")?.addEventListener("click", manageLookup);
    try {
      const data = await api("/services"); state.services = data.items || [];
      const list = state.services.map((item, index) => `<button class="mb-service" data-index="${index}"><strong>${esc(item.name)}</strong><span>${esc(item.description || "")}</span><small>${item.duration_minutes} 分鐘 · ${esc(item.price_text || "依需求確認")}</small></button>`).join("");
      shell(`<h1>選擇預約服務</h1><p>價格與實際課程內容由店家依需求確認，不會在此自動收費。</p><div class="mb-services">${list || message("目前尚無可預約服務。")}</div><div class="mb-actions"><button class="mb-secondary" data-manage>查看／管理預約</button></div>`, "STEP 1／5");
      root.querySelectorAll("[data-index]").forEach((button) => button.addEventListener("click", () => chooseDate(Number(button.dataset.index))));
      root.querySelector("[data-manage]")?.addEventListener("click", manageLookup);
    } catch (error) { shell(`<h1>線上預約</h1>${message(error.message, "error")}<div class="mb-actions"><a class="mb-primary" href="${LINE}">透過 LINE 聯絡</a></div>`); }
  }

  function chooseDate(index) {
    state.service = state.services[index]; state.slot = null;
    const min = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
    shell(`<button class="mb-back" data-back>← 返回服務</button><h1>${esc(state.service.name)}</h1><p>選擇想預約的日期；只會顯示商家實際開放的時段。</p><label>預約日期<input class="mb-input" type="date" min="${min}" data-date></label><div data-slots></div>`, "STEP 2／5");
    root.querySelector("[data-back]").addEventListener("click", start);
    root.querySelector("[data-date]").addEventListener("change", (event) => loadSlots(event.target.value));
  }

  async function loadSlots(date) {
    state.date = date; const area = root.querySelector("[data-slots]"); area.innerHTML = '<div class="mb-loading">正在查詢真實可用時段…</div>';
    try {
      const data = await api(`/availability?service_id=${encodeURIComponent(state.service.id)}&date=${encodeURIComponent(date)}`);
      if (!data.items.length) { area.innerHTML = `${message(data.message || "目前沒有可預約時段。")}`; return; }
      area.innerHTML = `<h2>選擇時間</h2><div class="mb-slots">${data.items.map((slot, index) => `<button data-slot="${index}">${esc(slot.time)}<small>${esc(slot.staff_name)}</small></button>`).join("")}</div>`;
      area.querySelectorAll("[data-slot]").forEach((button) => button.addEventListener("click", () => customerForm(data.items[Number(button.dataset.slot)])));
    } catch (error) { area.innerHTML = message(error.message, "error"); }
  }

  function customerForm(slot) {
    state.slot = slot;
    shell(`<button class="mb-back" data-back>← 重新選時段</button><h1>填寫預約資料</h1><div class="mb-summary"><strong>${esc(state.service.name)}</strong><span>${esc(state.date)} ${esc(slot.time)} · ${esc(slot.staff_name)}</span></div><form data-form><label>姓名<input class="mb-input" name="customer_name" maxlength="80" required></label><label>手機<input class="mb-input" name="customer_phone" inputmode="tel" maxlength="24" required></label><label>Email（選填）<input class="mb-input" name="customer_email" type="email" maxlength="160"></label><label>人數<input class="mb-input" name="party_size" type="number" min="1" max="${state.service.max_capacity || 1}" value="1" required></label><label>備註（選填）<textarea class="mb-input" name="note" maxlength="1000" rows="3"></textarea></label><button class="mb-primary" type="submit">確認預約</button></form><div data-result></div>`, "STEP 4／5");
    root.querySelector("[data-back]").addEventListener("click", () => loadSlots(state.date));
    root.querySelector("[data-form]").addEventListener("submit", submitBooking);
  }

  async function submitBooking(event) {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector("button[type=submit]"), result = root.querySelector("[data-result]"); button.disabled = true; button.textContent = "正在確認時段…";
    const data = Object.fromEntries(new FormData(form));
    try {
      const payload = await api("", { method: "POST", body: JSON.stringify({ ...data, party_size: Number(data.party_size), service_id: state.service.id, staff_id: state.slot.staff_id, date: state.date, time: state.slot.time }) });
      state.booking = payload.booking; state.manageToken = payload.manage_token;
      shell(`<h1>預約已送出</h1><div class="mb-success">✓</div><div class="mb-summary"><span>預約編號</span><strong>${esc(payload.booking.booking_code)}</strong><span>${esc(payload.booking.service_name)}</span><span>${esc(localTime(payload.booking.start_at))}</span><span>狀態：${esc(payload.booking.status)}</span></div><p>請保存預約編號；實際課程內容與費用由店家確認。</p><div class="mb-actions"><a class="mb-primary" href="${LINE}" target="_blank" rel="noopener">加入 LINE</a><button class="mb-secondary" data-current>查看／管理預約</button></div>`, "STEP 5／5");
      root.querySelector("[data-current]").addEventListener("click", () => manageView(payload.booking, payload.manage_token));
    } catch (error) { result.innerHTML = message(error.message, "error"); button.disabled = false; button.textContent = "確認預約"; }
  }

  function manageLookup() {
    shell(`<button class="mb-back" data-back>← 返回預約</button><h1>查看／管理預約</h1><p>請使用預約編號與預約時填寫的手機完成驗證。</p><form data-lookup><label>預約編號<input class="mb-input" name="booking_code" required></label><label>手機<input class="mb-input" name="customer_phone" inputmode="tel" required></label><button class="mb-primary">查詢預約</button></form><div data-result></div>`);
    root.querySelector("[data-back]").addEventListener("click", start);
    root.querySelector("[data-lookup]").addEventListener("submit", async (event) => { event.preventDefault(); const result = root.querySelector("[data-result]"); try { const payload = await api("/lookup", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); manageView(payload.booking, payload.manage_token); } catch (error) { result.innerHTML = message(error.message, "error"); } });
  }

  function manageView(booking, token) {
    state.booking = booking; state.manageToken = token;
    const canChange = ["pending", "confirmed"].includes(booking.status);
    shell(`<button class="mb-back" data-back>← 返回預約首頁</button><h1>我的預約</h1><div class="mb-summary"><span>預約編號</span><strong>${esc(booking.booking_code)}</strong><span>${esc(booking.service_name)}</span><span>${esc(localTime(booking.start_at))}</span><span>狀態：${esc(booking.status)}</span></div>${canChange ? '<div class="mb-actions"><button class="mb-primary" data-reschedule>改期</button><button class="mb-danger" data-cancel>取消預約</button></div>' : ""}<div data-result></div>`);
    root.querySelector("[data-back]").addEventListener("click", start);
    root.querySelector("[data-cancel]")?.addEventListener("click", async () => { const reason = window.prompt("取消原因（選填）") ?? ""; try { const payload = await api(`/${booking.booking_code}/cancel`, { method: "POST", body: JSON.stringify({ manage_token: token, reason }) }); manageView(payload.booking, token); } catch (error) { root.querySelector("[data-result]").innerHTML = message(error.message, "error"); } });
    root.querySelector("[data-reschedule]")?.addEventListener("click", () => rescheduleDate(booking, token));
  }

  function rescheduleDate(booking, token) {
    state.service = state.services.find((item) => item.name === booking.service_name) || state.services[0];
    shell(`<button class="mb-back" data-back>← 返回我的預約</button><h1>選擇新的日期</h1><label>預約日期<input class="mb-input" type="date" data-date></label><div data-slots></div>`);
    root.querySelector("[data-back]").addEventListener("click", () => manageView(booking, token));
    root.querySelector("[data-date]").addEventListener("change", async (event) => { const date = event.target.value, area = root.querySelector("[data-slots]"); try { const data = await api(`/availability?service_id=${encodeURIComponent(state.service.id)}&date=${encodeURIComponent(date)}`); area.innerHTML = data.items.length ? `<div class="mb-slots">${data.items.map((slot, index) => `<button data-slot="${index}">${esc(slot.time)}<small>${esc(slot.staff_name)}</small></button>`).join("")}</div>` : message(data.message); area.querySelectorAll("[data-slot]").forEach((button) => button.addEventListener("click", async () => { const slot = data.items[Number(button.dataset.slot)]; try { const payload = await api(`/${booking.booking_code}/reschedule`, { method: "POST", body: JSON.stringify({ manage_token: token, date, time: slot.time, staff_id: slot.staff_id }) }); manageView(payload.booking, payload.manage_token); } catch (error) { area.innerHTML += message(error.message, "error"); } })); } catch (error) { area.innerHTML = message(error.message, "error"); } });
  }
  start();
})();
