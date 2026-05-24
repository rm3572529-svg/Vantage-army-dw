// ============================================
// VANTAGE DOWNLOAD SITE - app.js
// Core application logic & UI interactions
// ============================================

(function () {
  "use strict";

  // ── Theme ────────────────────────────────────
  const Theme = {
    KEY: "vantage_theme",
    get() { return localStorage.getItem(this.KEY) || "light"; },
    set(val) {
      localStorage.setItem(this.KEY, val);
      document.documentElement.setAttribute("data-theme", val);
      document.querySelectorAll(".theme-icon-sun").forEach(el => el.style.display = val === "dark" ? "none" : "block");
      document.querySelectorAll(".theme-icon-moon").forEach(el => el.style.display = val === "dark" ? "block" : "none");
    },
    toggle() { this.set(this.get() === "dark" ? "light" : "dark"); },
    init() { this.set(this.get()); }
  };

  // ── Toast ─────────────────────────────────────
  const Toast = {
    show(msg, type = "default", duration = 3000) {
      const container = document.getElementById("toast-container") || (() => {
        const el = document.createElement("div");
        el.id = "toast-container";
        document.body.appendChild(el);
        return el;
      })();

      const icons = {
        success: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>`,
        error:   `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
        default: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`
      };

      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.innerHTML = `${icons[type] || icons.default} <span>${msg}</span>`;
      container.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateY(8px)"; setTimeout(() => toast.remove(), 200); }, duration);
    }
  };

  // ── Clipboard ────────────────────────────────
  const Clipboard = {
    async copy(text, feedback = "Copied!") {
      try {
        await navigator.clipboard.writeText(text);
        Toast.show(feedback, "success");
        return true;
      } catch {
        // Fallback
        const el = document.createElement("textarea");
        el.value = text; el.style.position = "fixed"; el.style.opacity = "0";
        document.body.appendChild(el); el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        Toast.show(feedback, "success");
        return true;
      }
    }
  };

  // ── Google Drive Helper ───────────────────────
  const GDrive = {
    isValid(url) {
      return typeof url === "string" && (url.includes("drive.google.com") || url.includes("docs.google.com"));
    },

    extractId(url) {
      const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /open\?id=([a-zA-Z0-9_-]+)/
      ];
      for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
      }
      return null;
    },

    toDownload(id) { return `https://drive.google.com/uc?export=download&id=${id}`; },

    // Detect file type from name
    detectType(name = "") {
      const ext = name.split(".").pop().toLowerCase();
      const map = {
        apk: "apk", zip: "zip", rar: "zip", "7z": "zip",
        mp4: "mp4", mkv: "mp4", avi: "mp4", mov: "mp4",
        pdf: "pdf",
        jpg: "img", jpeg: "img", png: "img", gif: "img", webp: "img",
        doc: "doc", docx: "doc", xls: "doc", xlsx: "doc", pptx: "doc",
        mp3: "mp4", wav: "mp4", flac: "mp4"
      };
      return map[ext] || "file";
    },

    // Icon HTML per type
    typeIcon(type, size = 28) {
      const icons = {
        apk:  { emoji: "📱", bg: "#dbeafe" },
        zip:  { emoji: "📦", bg: "#fef3c7" },
        mp4:  { emoji: "🎬", bg: "#fce7f3" },
        pdf:  { emoji: "📄", bg: "#fee2e2" },
        img:  { emoji: "🖼️", bg: "#d1fae5" },
        doc:  { emoji: "📝", bg: "#dbeafe" },
        file: { emoji: "📁", bg: "#f0f2f5" }
      };
      const info = icons[type] || icons.file;
      return `<div class="file-icon-wrap ${type}" style="font-size:${size}px">${info.emoji}</div>`;
    }
  };

  // ── Short URL Helpers ─────────────────────────
  const ShortURL = {
    base() { return `${location.origin}${location.pathname.replace(/\/[^/]*$/, "")}/`; },
    make(id) { return `${this.base()}d/${id}`; },
    // fallback using page URL with hash
    makeFallback(id) { return `${location.origin}${location.pathname.replace("index.html", "")}download.html?v=${id}`; }
  };

  // ── QR Code Generator (using API) ────────────
  const QR = {
    url(text, size = 180) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=1a6cff&bgcolor=ffffff`;
    },
    render(container, text, size = 160) {
      if (!container) return;
      container.innerHTML = `<img src="${QR.url(text, size)}" alt="QR Code" width="${size}" height="${size}" style="border-radius:8px;display:block;margin:0 auto;" loading="lazy">`;
    }
  };

  // ── Rate Limiting (client-side basic) ─────────
  const RateLimit = {
    KEY: "vantage_rl",
    MAX: 10,
    WINDOW: 60000, // 1 min

    check() {
      const now = Date.now();
      let data = JSON.parse(localStorage.getItem(this.KEY) || "{}");
      if (!data.ts || now - data.ts > this.WINDOW) data = { ts: now, count: 0 };
      if (data.count >= this.MAX) return false;
      data.count++;
      localStorage.setItem(this.KEY, JSON.stringify(data));
      return true;
    }
  };

  // ── Mobile Menu ───────────────────────────────
  function initMobileMenu() {
    const hamburger = document.querySelector(".hamburger");
    const navLinks  = document.querySelector(".nav-links");
    if (!hamburger || !navLinks) return;

    hamburger.addEventListener("click", () => {
      navLinks.style.display = navLinks.style.display === "flex" ? "" : "flex";
      navLinks.style.flexDirection = "column";
      navLinks.style.position = "absolute";
      navLinks.style.top = "62px";
      navLinks.style.left = "0";
      navLinks.style.right = "0";
      navLinks.style.background = "var(--white)";
      navLinks.style.padding = "12px";
      navLinks.style.borderBottom = "1px solid var(--gray-200)";
      navLinks.style.boxShadow = "0 8px 20px rgba(0,0,0,.08)";
      navLinks.style.zIndex = "99";
    });
  }

  // ── Homepage: Link Generator ──────────────────
  function initHomepage() {
    const input     = document.getElementById("gdrive-input");
    const genBtn    = document.getElementById("generate-btn");
    const resultBox = document.getElementById("result-box");

    if (!input || !genBtn) return;

    genBtn.addEventListener("click", async () => {
      const url = input.value.trim();

      if (!url) { Toast.show("Please paste a Google Drive link", "error"); return; }
      if (!GDrive.isValid(url)) { Toast.show("Invalid Google Drive link. Please check the URL.", "error"); return; }
      if (!RateLimit.check()) { Toast.show("Too many requests. Please wait a moment.", "error"); return; }

      const fileId = GDrive.extractId(url);
      if (!fileId) { Toast.show("Could not extract file ID. Make sure the link is public.", "error"); return; }

      genBtn.disabled = true;
      genBtn.innerHTML = `<span class="spinner"></span> Generating...`;

      try {
        // Check if user is logged in
        const user = firebase.auth().currentUser;

        let shortId, linkData;
        if (user) {
          // Logged in: save to DB
          linkData = await window.VantageDB.Links.create(user.uid, url);
          shortId = linkData.shortId;
        } else {
          // Guest: generate ID client-side (no DB)
          const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
          shortId = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        }

        const shortLink = `${location.origin}${location.pathname.replace("index.html", "")}download.html?v=${shortId}&gdid=${fileId}`;
        const directDl  = GDrive.toDownload(fileId);

        displayResult(resultBox, { shortLink, directDl, fileId, shortId });

      } catch (err) {
        Toast.show(err.message || "An error occurred", "error");
      } finally {
        genBtn.disabled = false;
        genBtn.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Generate Link`;
      }
    });

    // Allow Enter key
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") genBtn.click(); });
  }

  function displayResult(container, { shortLink, directDl, fileId }) {
    if (!container) return;

    container.innerHTML = `
      <div class="card fade-in" style="max-width:680px;margin-top:24px;">
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;">
            <div style="width:32px;height:32px;background:var(--blue-light);color:var(--blue-primary);border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </div>
            <span style="font-weight:700;color:var(--gray-900);">Your Links are Ready</span>
            <span class="badge badge-green" style="margin-left:auto;">Success</span>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Shareable Download Page</label>
            <div style="display:flex;gap:8px;">
              <input class="form-control" id="out-share" value="${shortLink}" readonly style="font-family:var(--font-mono);font-size:.82rem;background:var(--gray-50);">
              <button class="btn btn-outline btn-icon" onclick="navigator.clipboard.writeText('${shortLink}').then(()=>window.vantageToast('Link copied!','success'))">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:20px;">
            <label class="form-label">Direct Download URL</label>
            <div style="display:flex;gap:8px;">
              <input class="form-control" value="${directDl}" readonly style="font-family:var(--font-mono);font-size:.82rem;background:var(--gray-50);">
              <button class="btn btn-outline btn-icon" onclick="navigator.clipboard.writeText('${directDl}').then(()=>window.vantageToast('Copied!','success'))">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <a href="${shortLink}" target="_blank" class="btn btn-primary">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open Download Page
            </a>
            <a href="${directDl}" class="btn btn-outline">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Direct Download
            </a>
          </div>

          <div style="margin-top:16px;padding:12px;background:var(--gray-50);border-radius:var(--radius-md);font-size:.8rem;color:var(--gray-600);">
            <strong>Tip:</strong> Make sure your Google Drive file is set to "Anyone with the link can view" for downloads to work.
          </div>
        </div>
      </div>`;

    container.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ── Download Page ─────────────────────────────
  function initDownloadPage() {
    const params = new URLSearchParams(location.search);
    const shortId = params.get("v");
    const gdid    = params.get("gdid");
    const gdurl   = params.get("url");

    if (!shortId) return;

    const loadingEl = document.getElementById("dl-loading");
    const contentEl = document.getElementById("dl-content");
    const errorEl   = document.getElementById("dl-error");

    async function loadPage() {
      try {
        let fileId = gdid;
        let linkData = null;

        // Try DB lookup
        if (window.VantageDB && shortId) {
          linkData = await window.VantageDB.Links.get(shortId);
          if (linkData) fileId = linkData.fileId;
        }

        if (!fileId && gdurl) fileId = GDrive.extractId(gdurl);
        if (!fileId) throw new Error("File not found");

        const downloadUrl = GDrive.toDownload(fileId);
        const fileName    = linkData?.fileName || "File";
        const fileType    = linkData?.fileType || GDrive.detectType(fileName);
        const fileSize    = linkData?.fileSize || "Unknown size";
        const shareUrl    = location.href;

        // Render page
        renderDownloadPage({ fileName, fileType, fileSize, downloadUrl, shareUrl, fileId, linkData });

        // Track click
        if (window.VantageDB && linkData) await window.VantageDB.Links.trackClick(shortId, "click");

        if (loadingEl) loadingEl.classList.add("hidden");
        if (contentEl) { contentEl.classList.remove("hidden"); contentEl.classList.add("fade-in"); }

        // Config check
        const config = window.VantageDB ? await window.VantageDB.Config.get() : { socialUnlockEnabled: false, directDownloadEnabled: true };
        initSocialUnlock(config, shortId);

      } catch (err) {
        if (loadingEl) loadingEl.classList.add("hidden");
        if (errorEl) errorEl.classList.remove("hidden");
        console.error(err);
      }
    }

    loadPage();
  }

  function renderDownloadPage({ fileName, fileType, fileSize, downloadUrl, shareUrl, fileId }) {
    // File icon
    const iconEl = document.getElementById("dl-file-icon");
    if (iconEl) iconEl.innerHTML = GDrive.typeIcon(fileType, 32);

    const nameEl = document.getElementById("dl-file-name");
    if (nameEl) nameEl.textContent = fileName;

    const sizeEl = document.getElementById("dl-file-size");
    if (sizeEl) sizeEl.textContent = fileSize;

    const typeEl = document.getElementById("dl-file-type");
    if (typeEl) typeEl.textContent = fileType.toUpperCase();

    // Share input
    const shareInput = document.getElementById("dl-share-input");
    if (shareInput) shareInput.value = shareUrl;

    // Download buttons
    document.querySelectorAll("[data-download-href]").forEach(el => el.setAttribute("href", downloadUrl));
    document.querySelectorAll("[data-download-url]").forEach(el => el.dataset.url = downloadUrl);

    // QR Code
    const qrContainer = document.getElementById("qr-container");
    if (qrContainer) QR.render(qrContainer, shareUrl, 160);
  }

  function initSocialUnlock(config, shortId) {
    const socialSection = document.getElementById("social-unlock-section");
    const dlButton      = document.getElementById("main-dl-btn");

    if (!config.socialUnlockEnabled) {
      if (socialSection) socialSection.classList.add("hidden");
      if (dlButton) dlButton.classList.remove("hidden");
      return;
    }

    // Show social tasks
    if (socialSection) socialSection.classList.remove("hidden");
    if (dlButton) dlButton.classList.add("hidden");

    const tasks = [
      { id: "yt", name: "Subscribe on YouTube", key: "yt_done", href: config.youtubeLink, cls: "task-yt" },
      { id: "ig", name: "Follow on Instagram",  key: "ig_done", href: config.instagramLink, cls: "task-ig" },
      { id: "wa", name: "Join WhatsApp Group",  key: "wa_done", href: config.whatsappLink, cls: "task-wa" }
    ];

    const storage = JSON.parse(localStorage.getItem("vantage_social") || "{}");

    function updateUI() {
      const allDone = tasks.every(t => storage[t.key]);
      if (allDone) {
        if (socialSection) socialSection.innerHTML = `<div class="card-body text-center"><div style="font-size:2rem;margin-bottom:8px;">🎉</div><p class="fw-600" style="color:var(--success)">All tasks complete! Download is unlocked.</p></div>`;
        if (dlButton) dlButton.classList.remove("hidden");
      }
      tasks.forEach(t => {
        const taskEl = document.getElementById(`task-${t.id}`);
        if (taskEl) {
          if (storage[t.key]) taskEl.classList.add("done");
        }
      });
    }

    // Render tasks if container exists
    const taskList = document.getElementById("social-task-list");
    if (taskList) {
      taskList.innerHTML = tasks.map(t => `
        <div class="social-task-item ${storage[t.key] ? "done" : ""}" id="task-${t.id}">
          <div class="social-task-left">
            <div class="social-task-icon ${t.cls}">
              ${t.id === "yt" ? `<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.5 20.5 12 20.5 12 20.5s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.75 15.52V8.48L15.82 12l-6.07 3.52z"/></svg>` : ""}
              ${t.id === "ig" ? `<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path fill="white" d="M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm4.5-9a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>` : ""}
              ${t.id === "wa" ? `<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>` : ""}
            </div>
            <span class="social-task-name">${t.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${!storage[t.key] ? `<a href="${t.href}" target="_blank" onclick="vantageMarkTask('${t.key}')" class="btn btn-sm btn-outline">Open</a>` : ""}
            <div class="social-task-check">
              ${storage[t.key] ? `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>` : ""}
            </div>
          </div>
        </div>`).join("");
    }

    updateUI();

    // Global function for task completion
    window.vantageMarkTask = function (key) {
      setTimeout(() => {
        storage[key] = true;
        localStorage.setItem("vantage_social", JSON.stringify(storage));
        updateUI();
      }, 3000); // Wait 3s simulating they opened link
    };
  }

  // ── Auth Page ─────────────────────────────────
  function initAuthPage() {
    const loginForm    = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const googleBtn    = document.getElementById("google-signin-btn");

    if (googleBtn) {
      googleBtn.addEventListener("click", async () => {
        googleBtn.disabled = true;
        googleBtn.innerHTML = `<span style="width:18px;height:18px;border:2px solid #ccc;border-top-color:#333;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;"></span> Signing in...`;
        try {
          await window.VantageDB.Auth.signInGoogle();
          Toast.show("Welcome back!", "success");
          setTimeout(() => window.location.href = "dashboard.html", 500);
        } catch (e) {
          Toast.show(e.message, "error");
          googleBtn.disabled = false;
          googleBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20"> Continue with Google`;
        }
      });
    }

    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = loginForm.querySelector("[name=email]").value;
        const pass  = loginForm.querySelector("[name=password]").value;
        const btn   = loginForm.querySelector("[type=submit]");
        btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Signing in...`;
        try {
          await window.VantageDB.Auth.signInEmail(email, pass);
          Toast.show("Welcome back!", "success");
          setTimeout(() => window.location.href = "dashboard.html", 500);
        } catch (e) {
          let msg = e.message.replace("Firebase: ", "");
          // Friendly error messages
          if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
            msg = "Incorrect email or password. Please try again.";
          } else if (e.code === "auth/too-many-requests") {
            msg = "Too many attempts. Please wait a few minutes and try again.";
          } else if (e.code === "auth/network-request-failed") {
            msg = "Network error. Please check your internet connection.";
          }
          Toast.show(msg, "error");
          btn.disabled = false; btn.textContent = "Sign In";
        }
      });
    }

    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name  = registerForm.querySelector("[name=name]").value;
        const email = registerForm.querySelector("[name=email]").value;
        const pass  = registerForm.querySelector("[name=password]").value;
        const pass2 = registerForm.querySelector("[name=password2]")?.value;
        if (pass !== pass2) { Toast.show("Passwords do not match", "error"); return; }
        const btn = registerForm.querySelector("[type=submit]");
        btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Creating account...`;
        try {
          await window.VantageDB.Auth.registerEmail(email, pass, name);
          Toast.show("Account created! Welcome, " + name + "!", "success");
          setTimeout(() => window.location.href = "dashboard.html", 800);
        } catch (e) {
          let msg = e.message.replace("Firebase: ", "");
          if (e.code === "auth/email-already-in-use") {
            msg = "This email is already registered. Try signing in instead.";
          } else if (e.code === "auth/weak-password") {
            msg = "Password is too weak. Use at least 6 characters.";
          } else if (e.code === "auth/network-request-failed") {
            msg = "Network error. Please check your internet connection.";
          }
          Toast.show(msg, "error");
          btn.disabled = false; btn.textContent = "Create Account";
        }
      });
    }
  }

  // ── Dashboard ─────────────────────────────────
  function initDashboard() {
    const userDisplay = document.getElementById("user-display-name");

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) { window.location.href = "login.html"; return; }

      if (userDisplay) userDisplay.textContent = user.displayName || user.email;

      const profile = await window.VantageDB.Auth.getProfile(user.uid);
      if (!profile) return;

      // Update stats
      const used  = profile.linksUsed || 0;
      const limit = profile.linksLimit || 25;
      const pct   = Math.min(100, Math.round((used / limit) * 100));

      const usedEl  = document.getElementById("stat-links-used");
      const limitEl = document.getElementById("stat-links-limit");
      const progEl  = document.getElementById("links-progress");
      if (usedEl)  usedEl.textContent = used;
      if (limitEl) limitEl.textContent = limit;
      if (progEl)  progEl.style.width = `${pct}%`;

      // Load user links
      const links = await window.VantageDB.Links.getUserLinks(user.uid);
      renderLinksTable(links);
    });
  }

  function renderLinksTable(links) {
    const tbody = document.getElementById("links-tbody");
    if (!tbody) return;

    if (!links.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px 0;color:var(--gray-400);">No links yet. Generate your first link from the homepage.</td></tr>`;
      return;
    }

    tbody.innerHTML = links.map(l => {
      const date = l.createdAt?.toDate ? l.createdAt.toDate().toLocaleDateString() : "—";
      const shortUrl = `${location.origin}${location.pathname.replace("dashboard.html", "")}download.html?v=${l.shortId}&gdid=${l.fileId}`;
      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="table-file-icon">${GDrive.typeIcon(l.fileType || "file", 18)}</div>
              <div>
                <div class="fw-500 truncate" style="max-width:200px;">${l.fileName || "File"}</div>
                <div class="text-xs text-muted">${l.fileSize || ""}</div>
              </div>
            </div>
          </td>
          <td><a href="${shortUrl}" class="text-blue text-sm" style="font-family:var(--font-mono);">${l.shortId}</a></td>
          <td>${l.clicks || 0}</td>
          <td>${date}</td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="navigator.clipboard.writeText('${shortUrl}').then(()=>window.vantageToast('Copied!','success'))" title="Copy">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-icon" onclick="vantageDeleteLink('${l.shortId}')" title="Delete">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
    }).join("");
  }

  window.vantageDeleteLink = async function (shortId) {
    if (!confirm("Delete this link? This cannot be undone.")) return;
    try {
      const user = firebase.auth().currentUser;
      await window.VantageDB.Links.delete(shortId, user.uid);
      Toast.show("Link deleted", "success");
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      Toast.show(e.message, "error");
    }
  };

  // ── Contact Form ──────────────────────────────
  function initContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      Toast.show("Message sent! We'll reply within 24 hours.", "success");
      form.reset();
    });
  }

  // ── Global helpers ────────────────────────────
  window.vantageToast = (msg, type) => Toast.show(msg, type);

  // ── Auth State Nav ────────────────────────────
  function updateNavAuthState(user) {
    const loginBtns    = document.querySelectorAll(".nav-login-btn");
    const avatarBtns   = document.querySelectorAll(".nav-avatar-btn");
    const avatarInits  = document.querySelectorAll(".nav-avatar-init");

    if (user) {
      loginBtns.forEach(el => el.classList.add("hidden"));
      avatarBtns.forEach(el => el.classList.remove("hidden"));
      avatarInits.forEach(el => el.textContent = (user.displayName || user.email || "U")[0].toUpperCase());
    } else {
      loginBtns.forEach(el => el.classList.remove("hidden"));
      avatarBtns.forEach(el => el.classList.add("hidden"));
    }
  }

  // ── Init ─────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    Theme.init();

    // Theme toggle
    document.querySelectorAll(".theme-toggle").forEach(btn => btn.addEventListener("click", () => Theme.toggle()));

    // Sign out
    document.querySelectorAll(".sign-out-btn").forEach(btn => btn.addEventListener("click", () => {
      firebase.auth().signOut().then(() => window.location.href = "index.html");
    }));

    initMobileMenu();
    initContactForm();

    // Page-specific init
    const page = document.body.dataset.page;
    if (page === "home")     initHomepage();
    if (page === "download") initDownloadPage();
    if (page === "auth")     initAuthPage();
    if (page === "dashboard") initDashboard();

    // Auth state
    if (typeof firebase !== "undefined") {
      firebase.auth().onAuthStateChanged(updateNavAuthState);
    }

    console.log("[Vantage] App initialized");
  });

})();
