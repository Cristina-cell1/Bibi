/* Fightzone Code Lock Paywall
   Shows a 6-digit lock over the stream.
   If the code is correct, the wall is removed.
*/

(function () {
  const ACCESS_CODE = "671488"; // <-- ЗДЕСЬ ПОМЕНЯЙ КОД

  let _container = null;
  let _overlayEl = null;
  let _currentEventId = null;
  let _authUnsub = null;
  
  async function recordCorrectCodeOnce(codeName = "main_code") {
    const sb = getSb();

    if (!sb) {
      console.log("[code-success] Supabase client not found");
      return;
    }

    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token;

    if (!token) {
      console.log("[code-success] User not logged in");
      return;
    }

    try {
      const res = await fetch(`${window.FZ_API_BASE || "https://api.fzpv.st"}/api/code-success`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          code_name: codeName
        })
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || result?.ok !== true) {
        console.log("[code-success] failed:", result);
        return;
      }

      console.log("[code-success] recorded:", codeName);
    } catch (err) {
      console.log("[code-success] request error:", err);
    }
  }

  function getSb() {
    const sb = window.supabaseClient || window.sb || window.supabase;

    if (!sb || !sb.auth) {
      return null;
    }

    return sb;
  }

  function getStorageKey(eventId) {
    return `fz_code_unlocked:${String(eventId || "global")}`;
  }

  function isUnlocked(eventId) {
    try {
      return localStorage.getItem(getStorageKey(eventId)) === "1";
    } catch (e) {
      return false;
    }
  }

  function setUnlocked(eventId) {
    try {
      localStorage.setItem(getStorageKey(eventId), "1");
    } catch (e) {}
  }

  async function checkAccess(eventId) {
    if (isUnlocked(eventId)) return true;

    const sb = getSb();
    if (!sb) return false;

    try {
      const { data: authData } = await sb.auth.getUser();
      if (!authData?.user) return false;

      const { data, error } = await sb.rpc("has_access", {
        p_event_id: eventId,
      });

      if (error) {
        console.warn("[paywall] has_access error:", error);
        return false;
      }

      return !!data;
    } catch (e) {
      console.warn("[paywall] checkAccess failed:", e);
      return false;
    }
  }

  function ensureOverlay(containerEl) {
    const st = getComputedStyle(containerEl);
    if (st.position === "static") {
      containerEl.style.position = "relative";
    }

    let el = containerEl.querySelector(".fz-paywall");
    if (el) return el;

    el = document.createElement("div");
    el.className = "fz-paywall";

    el.innerHTML = `
      <div class="fz-paywall__card" role="dialog" aria-modal="true">
        <div class="fz-paywall__lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="42" height="42">
            <path
              d="M7 10V8a5 5 0 0 1 10 0v2"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
            />
            <rect
              x="5.5"
              y="10"
              width="13"
              height="10"
              rx="2.2"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
            />
            <path
              d="M12 14v2.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
            />
          </svg>
        </div>

        <h3 class="fz-paywall__title">ENTER ACCESS CODE</h3>

        <p class="fz-paywall__text">
  Get code via.
  <a
    class="fz-paywall__discord-link"
    href="https://discord.gg/Q356he4WUu"
    target="_blank"
    rel="noopener noreferrer"
  >
    Discord
  </a>.
</p>

        <form class="fz-code-form" data-fz-code-form autocomplete="off">
          <input
            class="fz-code-input"
            data-fz-code-input
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="000000"
            aria-label="Access code"
          />

          <button class="fz-paywall__btn fz-paywall__btn--primary" type="submit">
            Unlock stream
          </button>
        </form>

        <p class="fz-paywall__hint" data-fz-hint>
          Wrong code. Try again.
        </p>
      </div>
    `;

    const form = el.querySelector("[data-fz-code-form]");
    const input = el.querySelector("[data-fz-code-input]");
    const hint = el.querySelector("[data-fz-hint]");

    input?.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 6);
      hint.classList.remove("is-visible");
      el.querySelector(".fz-paywall__card")?.classList.remove("is-error");
    });

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const value = String(input?.value || "").trim();

      if (value === ACCESS_CODE) {
        setUnlocked(_currentEventId);

        recordCorrectCodeOnce("main_code");

        el.classList.remove("is-visible");
        return;
      }

      hint.classList.add("is-visible");

      const card = el.querySelector(".fz-paywall__card");
      card?.classList.remove("is-error");
      void card?.offsetWidth;
      card?.classList.add("is-error");

      input?.focus();
      input?.select();
    });

    containerEl.appendChild(el);
    return el;
  }

  async function refresh() {
    if (!_overlayEl || !_currentEventId) return;

    const allowed = await checkAccess(_currentEventId);
    _overlayEl.classList.toggle("is-visible", !allowed);

    if (!allowed) {
      setTimeout(() => {
        _overlayEl?.querySelector("[data-fz-code-input]")?.focus();
      }, 80);
    }
  }

  function initPaywall(options = {}) {
    _container =
      document.querySelector(options.containerSelector || ".stream-player-box") ||
      document.querySelector(".stream-player-box");

    if (!_container) {
      console.warn("[paywall] container not found:", options.containerSelector);
      return;
    }

    _overlayEl = ensureOverlay(_container);
    _overlayEl.classList.remove("is-visible");

    const sb = getSb();

    if (sb && !_authUnsub) {
      const { data } = sb.auth.onAuthStateChange(() => {
        refresh();
      });

      _authUnsub = data?.subscription || true;
    }
  }

  async function showForEvent(eventId) {
    _currentEventId = String(eventId || "").trim();

    if (!_currentEventId) {
      console.warn("[paywall] showForEvent called without eventId");
      return;
    }

    if (!_overlayEl) {
      initPaywall({ containerSelector: ".stream-player-box" });
    }

    await refresh();
  }

  function startCheckout() {
    console.warn("[paywall] Checkout disabled. Code lock is active.");
  }

  window.FZPaywall = {
    initPaywall,
    showForEvent,
    startCheckout,
  };
})();