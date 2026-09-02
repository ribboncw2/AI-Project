(function () {
  const pages = ["home", "uploads", "report", "preview", "print"];

  function pageFromHash() {
    const raw = (location.hash || "#home").replace("#", "").toLowerCase();
    return pages.includes(raw) ? raw : "home";
  }

  function showPage(name) {
    document.querySelectorAll(".page").forEach(function (el) {
      el.classList.toggle("active", el.id === "page-" + name);
    });
    document.querySelectorAll("nav a").forEach(function (a) {
      const target = (a.getAttribute("href") || "").replace("#", "");
      if (target === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.getElementById("main").focus({ preventScroll: true });
    if (name === "uploads") loadUploads();
    if (name === "preview" || name === "print" || name === "report") renderReport();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function paragraph(text) {
    return "<p class=\"placeholder\">" + escapeHtml(text) + "</p>";
  }

  function cover(audienceLabel) {
    const r = window.REPORT;
    return (
      "<header class=\"cover\">" +
      "<p class=\"kicker\">Ontario secondary · Growing Success · OCT</p>" +
      "<h2 class=\"title\">" + escapeHtml(r.title) + "</h2>" +
      "<p>" + escapeHtml(audienceLabel) + "</p>" +
      "<dl class=\"meta\">" +
      "<dt>Teacher</dt><dd>" + escapeHtml(r.teacher) + "</dd>" +
      "<dt>School</dt><dd>" + escapeHtml(r.school) + "</dd>" +
      "<dt>Board</dt><dd>" + escapeHtml(r.board) + "</dd>" +
      "<dt>Date</dt><dd>" + escapeHtml(r.date) + "</dd>" +
      "<dt>Purpose</dt><dd>" + escapeHtml(r.purpose) + "</dd>" +
      "</dl></header>"
    );
  }

  function sharedBody() {
    const r = window.REPORT;
    return (
      "<section class=\"section-block\" data-part=\"shared\">" +
      "<h3>Context</h3>" +
      paragraph(r.context) +
      "</section>" +
      "<section class=\"section-block\" data-part=\"shared\">" +
      "<h3>Inquiry question / professional focus</h3>" +
      paragraph(r.inquiry) +
      "</section>"
    );
  }

  function principalBody() {
    const p = window.REPORT.principal;
    return (
      "<section class=\"section-block\" data-part=\"principal\">" +
      "<h3>What I tried in class</h3>" +
      "<p>Instruction, assessment, and classroom routines. Overall expectations name the destination; specific expectations guide daily teaching. UDL and differentiation are design choices, not extras.</p>" +
      paragraph(p.tried) +
      "</section>" +
      "<section class=\"section-block\" data-part=\"principal\">" +
      "<h3>Evidence of student learning</h3>" +
      "<p>Assessment <em>for</em>, <em>as</em>, and <em>of</em> learning — conversations, observations, and products — not a list of marks.</p>" +
      paragraph(p.evidence) +
      "</section>" +
      "<section class=\"section-block\" data-part=\"principal\">" +
      "<h3>Alignment with school and department goals</h3>" +
      paragraph(p.schoolGoals) +
      "</section>" +
      "<section class=\"section-block\" data-part=\"principal\">" +
      "<h3>Next steps and school support needed</h3>" +
      "<p>Time, professional learning, coverage, and technology that the school can reasonably provide.</p>" +
      paragraph(p.nextSteps) +
      "</section>"
    );
  }

  function boardBody() {
    const b = window.REPORT.board;
    return (
      "<section class=\"section-block\" data-part=\"board\">" +
      "<h3>Why this matters beyond one classroom</h3>" +
      "<p>Equity of access, student well-being, and curriculum implementation.</p>" +
      paragraph(b.why) +
      "</section>" +
      "<section class=\"section-block\" data-part=\"board\">" +
      "<h3>What the evidence suggests for the school and board</h3>" +
      paragraph(b.evidence) +
      "</section>" +
      "<section class=\"section-block\" data-part=\"board\">" +
      "<h3>Resource and policy implications</h3>" +
      "<p>Devices, AI guidelines, special education, and pathways.</p>" +
      paragraph(b.resources) +
      "</section>" +
      "<section class=\"section-block\" data-part=\"board\">" +
      "<h3>Recommended next action</h3>" +
      "<p>A clear, one-page ask for board / superintendent / program staff.</p>" +
      paragraph(b.ask) +
      "</section>"
    );
  }

  function appendix(files) {
    const r = window.REPORT;
    let list = "<p class=\"placeholder\">No files in Uploads yet. Add files on the Uploads page; titles will appear here.</p>";
    if (files && files.length) {
      list =
        "<ul>" +
        files
          .map(function (f) {
            return "<li>" + escapeHtml(f.name) + " <span class=\"badge\">" + escapeHtml(f.type || "file") + "</span></li>";
          })
          .join("") +
        "</ul>";
    }
    return (
      "<section class=\"section-block\" data-part=\"appendix\">" +
      "<h3>Appendix — files on this computer</h3>" +
      "<p>" + escapeHtml(r.appendixNote) + "</p>" +
      list +
      "</section>"
    );
  }

  function notes() {
    return (
      "<section class=\"section-block notes-private no-print\" data-part=\"notes\">" +
      "<h3>Notes to self (do not print)</h3>" +
      paragraph(window.REPORT.notesToSelf) +
      "</section>"
    );
  }

  let lastFiles = [];
  let previewMode = "full";

  function htmlForMode(mode, files) {
    const r = window.REPORT;
    let label = "Full report — principal and board sections";
    if (mode === "principal") label = "Principal version — classroom and school";
    if (mode === "board") label = "Board version — program and system";
    let body = cover(label) + sharedBody();
    if (mode === "principal" || mode === "full") body += principalBody();
    if (mode === "board" || mode === "full") body += boardBody();
    body += appendix(files);
    if (mode === "full" || mode === "principal") body += notes();
    return body;
  }

  function renderInto(id, mode) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = htmlForMode(mode, lastFiles);
  }

  function renderReport() {
    renderInto("report-view", "full");
    renderInto("preview-view", previewMode);
    renderInto("print-view", previewMode === "board" ? "board" : previewMode === "principal" ? "principal" : "full");
  }

  async function loadUploads() {
    const tbody = document.getElementById("upload-rows");
    const status = document.getElementById("upload-status");
    try {
      const res = await fetch("/api/uploads");
      if (!res.ok) throw new Error("Could not list files. Is the local server running?");
      const data = await res.json();
      lastFiles = data.files || [];
      if (!lastFiles.length) {
        tbody.innerHTML = "<tr><td colspan=\"4\">No files yet. Use Choose files, or put downloads from Google Drive into the uploads folder.</td></tr>";
      } else {
        tbody.innerHTML = lastFiles
          .map(function (f) {
            const linked = "Listed in appendix";
            return (
              "<tr><td>" +
              escapeHtml(f.name) +
              "</td><td>" +
              escapeHtml(f.type || "—") +
              "</td><td>" +
              escapeHtml(f.size || "—") +
              "</td><td><span class=\"badge green\">" +
              linked +
              "</span></td></tr>"
            );
          })
          .join("");
      }
      status.textContent = lastFiles.length
        ? lastFiles.length + " file(s) on this computer only."
        : "Uploads folder is empty.";
      renderReport();
    } catch (err) {
      tbody.innerHTML = "<tr><td colspan=\"4\">Could not list uploads. Start the dashboard with start.command so this page can see the folder.</td></tr>";
      status.textContent = String(err.message || err);
    }
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function uploadFiles(fileList) {
    const status = document.getElementById("upload-status");
    if (!fileList || !fileList.length) return;
    status.textContent = "Saving on this computer…";
    try {
      const filesPayload = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const buf = await file.arrayBuffer();
        filesPayload.push({ name: file.name, data: arrayBufferToBase64(buf) });
      }
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filesPayload })
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || "Upload failed");
      status.textContent = "Saved. These files stay on your computer; they are not sent to GitHub.";
      document.getElementById("file-input").value = "";
      await loadUploads();
    } catch (err) {
      status.textContent = "Could not save files. Keep the local server window open and try again.";
    }
  }

  function setPreview(mode) {
    previewMode = mode;
    document.querySelectorAll("[data-preview]").forEach(function (btn) {
      btn.setAttribute("aria-selected", btn.getAttribute("data-preview") === mode ? "true" : "false");
    });
    const hint = document.getElementById("preview-hint");
    if (hint) {
      if (mode === "principal") hint.textContent = "Showing the shorter school version: context, classroom practice, evidence, SIP alignment, and school asks.";
      else if (mode === "board") hint.textContent = "Showing the system version: context, equity and curriculum, implications, and the board ask.";
      else hint.textContent = "Showing the full document both readers can share, including appendix.";
    }
    renderReport();
  }

  window.addEventListener("hashchange", function () {
    showPage(pageFromHash());
  });

  document.addEventListener("DOMContentLoaded", function () {
    const fileInput = document.getElementById("file-input");
    const drop = document.getElementById("drop-zone");
    if (fileInput) {
      fileInput.addEventListener("change", function () {
        uploadFiles(fileInput.files);
      });
    }
    if (drop) {
      ["dragenter", "dragover"].forEach(function (evt) {
        drop.addEventListener(evt, function (e) {
          e.preventDefault();
          drop.classList.add("active");
        });
      });
      ["dragleave", "drop"].forEach(function (evt) {
        drop.addEventListener(evt, function (e) {
          e.preventDefault();
          drop.classList.remove("active");
        });
      });
      drop.addEventListener("drop", function (e) {
        uploadFiles(e.dataTransfer.files);
      });
    }
    document.querySelectorAll("[data-preview]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setPreview(btn.getAttribute("data-preview"));
      });
    });
    document.getElementById("refresh-uploads")?.addEventListener("click", function () {
      loadUploads();
    });
    document.getElementById("print-button")?.addEventListener("click", function () {
      location.hash = "print";
      setTimeout(function () { window.print(); }, 50);
    });
    document.getElementById("print-now")?.addEventListener("click", function () {
      window.print();
    });
    setPreview("full");
    showPage(pageFromHash());
    loadUploads();
  });
})();
