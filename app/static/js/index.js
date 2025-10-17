// app/static/js/index.js
// Front-end for the Flask API. Supports two layouts:
//
// A) Two lists (preferred):
//    - Ongoing:  <ul id="ongoingList">, <p id="ongoingEmpty">, <span id="ongoingCount">
//    - Done:     <ul id="doneList">,    <p id="doneEmpty">,    <span id="doneCount">,
//                 <button id="toggleDone" class="toggle-btn" aria-expanded="true">Hide</button>
// B) Legacy single list:
//    - <ul id="taskList">, <p id="emptyState">
//
// Drag-and-drop reorder is enabled for the "Ongoing" list (or the single list).

/* ================== API ================== */
const API = {
  async list() {
    const res = await fetch("/api/tasks", { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("GET /api/tasks failed", res.status, txt);
      throw new Error(`HTTP ${res.status}`);
    }
    const ct = res.headers.get("content-type") || "";
    const body = await res.text();
    if (!ct.includes("application/json")) {
      console.error("Unexpected content-type:", ct, "body:", body);
      throw new Error("Non-JSON response");
    }
    return JSON.parse(body);
  },

  async create(body) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data.errors && data.errors.join(", ")) || "Create failed");
    }
    return res.json();
  },

  async toggle(id, completed) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) throw new Error("Update failed");
    return res.json();
  },

  async remove(id) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    return res.json();
  },

  async reorder(ids) {
    const res = await fetch("/api/tasks/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Reorder failed: ${res.status} ${txt}`);
    }
    return res.json();
  },
};

/* ================== DOM HELPERS ================== */
const qs  = (sel) => document.querySelector(sel);
const qsa = (sel) => [...document.querySelectorAll(sel)];

/** Escape HTML for any string inserted via innerHTML */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

/** Date helpers: store ISO (yyyy-mm-dd) in DB, show dd/mm/yyyy in UI */
function parseDDMMYYYY(s) {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [_, dd, mm, yyyy] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return `${yyyy}-${mm}-${dd}`;
}
function toDDMMYYYY(iso) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [_, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

/** Optional input mask so users type dd/mm/yyyy easily (Add page only) */
function wireDueMask() {
  const el = qs("#dueInput");
  if (!el) return;
  el.addEventListener("input", () => {
    let v = el.value.replace(/[^\d]/g, "").slice(0, 8);
    if (v.length >= 5) v = v.slice(0,2) + "/" + v.slice(2,4) + "/" + v.slice(4);
    else if (v.length >= 3) v = v.slice(0,2) + "/" + v.slice(2);
    el.value = v;
  });
}

/* ================== SMALL UI HELPERS ================== */

/** Hard show/hide that also sets inline display (defensive against CSS overrides) */
function show(el, display = "") { if (el) { el.classList.remove("hidden"); el.style.display = display; } }
function hide(el)               { if (el) { el.classList.add("hidden");    el.style.display = "none"; } }

/** Empty-state helper: hide if count>0, show if 0 */
function setEmptyState(el, count) {
  if (!el) return;
  if (count > 0) hide(el);
  else           show(el);
}

/* ================== RENDERING ================== */

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Single task row (DnD binder decides which list is draggable) */
function taskItemTemplate(t) {
  const completedClass = t.completed ? " completed" : "";
  return `
  <li class="task-item${completedClass}" data-id="${t.id}">
    <input type="checkbox" aria-label="toggle complete" ${t.completed ? "checked" : ""} />
    <a class="task-title" href="/tasks/${t.id}">${escapeHtml(t.title)}</a>
    <span class="chip priority ${t.priority}">${cap(t.priority)}</span>
    <button class="icon-btn delete-btn" aria-label="delete">Delete</button>
  </li>`;
}

/** Apply the current collapsed state of the Done section after re-render */
function applyDoneVisibilityFromButton() {
  const btn   = qs("#toggleDone");
  const list  = qs("#doneList");
  const empty = qs("#doneEmpty");
  if (!btn || !list) return;

  const expanded = btn.getAttribute("aria-expanded") !== "false";

  if (!expanded) {
    // Collapsed: hide list and empty-state
    hide(list);
    hide(empty);
    btn.textContent = "Show";
    return;
  }

  // Expanded: show list, and only show empty-state if no items
  show(list); // use stylesheet display
  const count = list.querySelectorAll(".task-item").length;
  setEmptyState(empty, count);
  btn.textContent = "Hide";
}

/** Render into two sections if present, else into the legacy single list */
async function renderList() {
  const ongoingUl = qs("#ongoingList");
  const doneUl    = qs("#doneList");
  const hasTwoLists = !!(ongoingUl && doneUl);

  if (hasTwoLists) {
    const ongoingEmpty = qs("#ongoingEmpty");
    const doneEmpty    = qs("#doneEmpty");
    const ongoingCount = qs("#ongoingCount");
    const doneCount    = qs("#doneCount");

    try {
      const tasks   = await API.list();
      const ongoing = tasks.filter(t => !t.completed);
      const done    = tasks.filter(t =>  t.completed);

      ongoingUl.innerHTML = ongoing.map(taskItemTemplate).join("");
      doneUl.innerHTML    = done   .map(taskItemTemplate).join("");

      // Ongoing: empty & counter
      setEmptyState(ongoingEmpty, ongoing.length);
      if (ongoingCount) ongoingCount.textContent = ongoing.length;
      if (doneCount)    doneCount.textContent    = done.length;

      // Make ongoing draggable (only after DOM is updated)
      enableDragReorder(ongoingUl);

      // Respect Hide/Show & set Done empty-state correctly
      applyDoneVisibilityFromButton();
    } catch (e) {
      console.error(e);
      ongoingUl.innerHTML = `<li class="muted">Failed to load. ${escapeHtml(String(e.message || e))}</li>`;
      doneUl.innerHTML = "";
      hide(qs("#ongoingEmpty"));
      hide(qs("#doneEmpty"));
    }
    return;
  }

  function applyClientFilters(container) {
  const q = (qs("#searchInput")?.value || "").toLowerCase().trim();
  const pf = (qs("#filterPriority")?.value || "").toLowerCase();

  [...container.querySelectorAll(".task-item")].forEach(li => {
    const title = li.querySelector(".task-title")?.textContent.toLowerCase() || "";
    const prio  = li.querySelector(".chip.priority")?.classList[2] || ""; // low/normal/high
    const match = (!q || title.includes(q)) && (!pf || pf === prio);
    li.style.display = match ? "" : "none";
  });
}

["input","change"].forEach(ev => {
  document.body.addEventListener(ev, (e) => {
    if (e.target.id === "searchInput" || e.target.id === "filterPriority") {
      applyClientFilters(qs("#ongoingList"));
      applyClientFilters(qs("#doneList"));
    }
  });
});

  // Fallback: legacy single list
  const listEl = qs("#taskList");
  const empty  = qs("#emptyState");
  if (!listEl) return;
  try {
    const tasks = await API.list();
    listEl.innerHTML = tasks.map(taskItemTemplate).join("");
    setEmptyState(empty, tasks.length);
    enableDragReorder(listEl);
  } catch (e) {
    console.error(e);
    listEl.innerHTML = `<li class="muted">Failed to load. ${escapeHtml(String(e.message || e))}</li>`;
    hide(empty);
  }
}

/* ================== INTERACTIONS ================== */

/** Add page only */
function wireAddForm() {
  const form = qs("#addForm");
  if (!form) return;

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();

    const rawDue = qs("#dueInput").value.trim();
    const dueIso = parseDDMMYYYY(rawDue);
    if (rawDue && !dueIso) {
      alert("Enter due date as dd/mm/yyyy");
      return;
    }

    const body = {
      title: qs("#titleInput").value.trim(),
      notes: qs("#notesInput").value.trim(),
      priority: qs("#priorityInput").value, // 'low' | 'normal' | 'high'
      due_date: dueIso,                      // ISO for DB
    };
    if (!body.title) {
      alert("Title is required");
      return;
    }

    try {
      await API.create(body);
      if (location.pathname === "/add") location.href = "/";
      else { form.reset(); renderList(); }
    } catch (e) {
      alert(e.message || "Create failed");
    }
  });
}

/** Toggle complete, delete (works for both layouts via event delegation) */
function wireListActions() {
  document.body.addEventListener("click", async (ev) => {
    // delete
    if (ev.target.matches(".delete-btn")) {
      const item = ev.target.closest(".task-item");
      if (!item) return;
      if (!confirm("Delete this task")) return;
      try {
        await API.remove(item.dataset.id);
        renderList();
      } catch (e) {
        alert(e.message || "Delete failed");
      }
      return;
    }

    // checkbox toggle
    if (ev.target.matches('input[type="checkbox"]')) {
      const item = ev.target.closest(".task-item");
      if (!item) return;
      try {
        const updated = await API.toggle(item.dataset.id, ev.target.checked);
        // In two-list mode we re-render to move the row; in single-list we can update class.
        const twoLists = !!(qs("#ongoingList") && qs("#doneList"));
        if (twoLists) renderList();
        else item.classList.toggle("completed", updated.completed);
      } catch (e) {
        alert(e.message || "Update failed");
        ev.target.checked = !ev.target.checked;
      }
    }
  });

  // Collapse/expand the Done section with stateful aria
  document.body.addEventListener("click", (e) => {
    if (e.target.id !== "toggleDone") return;
    const btn = e.target;
    const expanded = btn.getAttribute("aria-expanded") !== "false";
    btn.setAttribute("aria-expanded", String(!expanded));
    applyDoneVisibilityFromButton();
  });
}

/* Drag & drop reorder for a given UL element (Ongoing or single list) */
function enableDragReorder(listEl) {
  if (!listEl) return;

  // Mark all items draggable
  listEl.querySelectorAll(".task-item").forEach(li => li.setAttribute("draggable", "true"));

  let draggedEl = null;

  listEl.addEventListener("dragstart", (e) => {
    const li = e.target.closest(".task-item");
    if (!li) return;
    draggedEl = li;
    li.classList.add("dragging");
    e.dataTransfer.setData("text/plain", li.dataset.id);
    e.dataTransfer.effectAllowed = "move";
  });

  listEl.addEventListener("dragend", () => {
    draggedEl?.classList.remove("dragging");
    draggedEl = null;
    qsa(".task-item.drag-over").forEach(el => el.classList.remove("drag-over"));
  });

  listEl.addEventListener("dragover", (e) => {
    e.preventDefault(); // required so drop fires
    const over = e.target.closest(".task-item");
    if (!over || over === draggedEl) return;

    qsa(".task-item.drag-over").forEach(el => el.classList.remove("drag-over"));
    over.classList.add("drag-over");

    const rect = over.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    if (before) listEl.insertBefore(draggedEl, over);
    else listEl.insertBefore(draggedEl, over.nextElementSibling);
  });

  listEl.addEventListener("drop", async (e) => {
    e.preventDefault();
    qsa(".task-item.drag-over").forEach(el => el.classList.remove("drag-over"));
    const ids = [...listEl.querySelectorAll(".task-item")].map(li => li.dataset.id);
    try {
      await API.reorder(ids);
      // DOM already reflects the new order; nothing else to do.
    } catch (err) {
      console.error("reorder failed", err);
      alert("Reorder failed. Reloading list.");
      renderList();
    }
  });
}

/* ============ Task detail page buttons ============ */
function wireDetailButtons() {
  const toggleBtn = qs("#toggleComplete");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", async () => {
      const id = toggleBtn.getAttribute("data-id");
      // data-completed may be "1"/"0" or "true"/"false"
      const raw = (toggleBtn.getAttribute("data-completed") || "").toLowerCase();
      const isCompleted = raw === "1" || raw === "true";
      try {
        await API.toggle(id, !isCompleted);
        // Go back to list so counts/chips are fresh
        window.location.href = "/";
      } catch (e) {
        alert(e.message || "Update failed");
      }
    });
  }

  const delBtn = qs("#deleteFromDetail");
  if (delBtn) {
    delBtn.addEventListener("click", async () => {
      const id = delBtn.getAttribute("data-id");
      if (!confirm("Delete this task")) return;
      try {
        await API.remove(id);
        window.location.href = "/";
      } catch (e) {
        alert(e.message || "Delete failed");
      }
    });
  }
}

/* ================== THEME TOGGLE ================== */
(function setupThemeToggle() {
  const KEY = "theme"; // 'light' | 'dark' | null (use OS)
  const html = document.documentElement;
  const btn = document.getElementById("themeToggle");

  // compute initial theme
  const stored = localStorage.getItem(KEY); // 'light' | 'dark' | null
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = stored || (prefersDark ? "dark" : "light");
  applyTheme(initial);

  // keep OS changes in sync if user hasn't set a preference explicitly
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", (e) => {
    if (!localStorage.getItem(KEY)) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });

  btn?.addEventListener("click", () => {
    const next = html.classList.contains("theme-dark") ? "light" : "dark";
    localStorage.setItem(KEY, next);
    applyTheme(next);
  });

  function applyTheme(mode) {
    html.classList.toggle("theme-dark", mode === "dark");
    btn?.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
  }
})();

/* ================== BOOT ================== */
document.addEventListener("DOMContentLoaded", async () => {
  wireDueMask();     // only binds on Add page
  wireAddForm();     // only binds on Add page
  wireListActions(); // works on both layouts

  // Only render lists on pages that actually contain a list UI
  const hasListUI = qs("#ongoingList") || qs("#taskList");
  if (hasListUI) {
    await renderList();
  }

  // Enable detail-page actions if those buttons exist
  wireDetailButtons();
});