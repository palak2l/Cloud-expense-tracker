const CET = {
  csrf: "",
  user: null,

  async request(path, options = {}) {
    const headers = Object.assign({ Accept: "application/json" }, options.headers || {});
    if (!(options.body instanceof FormData) && options.body && typeof options.body === "object") {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    if (this.csrf && !["GET", "HEAD"].includes((options.method || "GET").toUpperCase())) {
      headers["X-CSRF-Token"] = this.csrf;
    }
    const res = await fetch(path, { ...options, headers, credentials: "same-origin" });
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const data = isJson ? await res.json() : null;
    if (!res.ok) {
      const error = new Error((data && data.error) || "Request failed.");
      error.status = res.status;
      error.data = data;
      throw error;
    }
    if (data && data.csrfToken) {
      this.csrf = data.csrfToken;
    }
    return data;
  },

  async loadCsrf() {
    const data = await this.request("/api/auth/csrf");
    this.csrf = data.csrfToken;
    return this.csrf;
  },

  toast(message) {
    const wrap = document.querySelector(".toast-wrap") || document.body.appendChild(Object.assign(document.createElement("div"), { className: "toast-wrap" }));
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  },

  money(value) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));
  },

  escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
};
