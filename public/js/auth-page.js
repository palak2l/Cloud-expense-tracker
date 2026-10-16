const themeBtn = document.getElementById("themeBtn");
themeBtn.textContent = CETTheme.label();
themeBtn.addEventListener("click", () => {
  CETTheme.toggle();
  themeBtn.textContent = CETTheme.label();
});

const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const notice = document.getElementById("authNotice");

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
});

tabRegister.addEventListener("click", () => {
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
});

async function boot() {
  try {
    await CET.loadCsrf();
    const me = await CET.request("/api/auth/me");
    if (me.user) {
      window.location.href = "/dashboard.html";
    }
  } catch (error) {
    if (error.status !== 401) {
      notice.textContent = error.message;
    }
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  notice.textContent = "";
  document.getElementById("loginLoader").classList.add("on");
  try {
    await CET.request("/api/auth/login", {
      method: "POST",
      body: {
        email: document.getElementById("loginEmail").value,
        password: document.getElementById("loginPassword").value
      }
    });
    window.location.href = "/dashboard.html";
  } catch (error) {
    notice.textContent = error.message;
  } finally {
    document.getElementById("loginLoader").classList.remove("on");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  notice.textContent = "";
  document.getElementById("regLoader").classList.add("on");
  try {
    await CET.request("/api/auth/register", {
      method: "POST",
      body: {
        name: document.getElementById("regName").value,
        email: document.getElementById("regEmail").value,
        password: document.getElementById("regPassword").value
      }
    });
    window.location.href = "/dashboard.html";
  } catch (error) {
    notice.textContent = error.message;
  } finally {
    document.getElementById("regLoader").classList.remove("on");
  }
});

boot();
