import { db } from "./firebase-config.js";
import { waitForUser } from "./protected-page.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const modalBackdrop = document.getElementById("modalBackdrop");
const applicationForm = document.getElementById("applicationForm");
const formMessage = document.getElementById("formMessage");
const saveApplicationBtn = document.getElementById("saveApplicationBtn");

const companyInput = document.getElementById("company");
const titleInput = document.getElementById("title");
const statusInput = document.getElementById("status");
const priorityInput = document.getElementById("priority");
const offerResponseInput = document.getElementById("offerResponse");
const offerResponseRow = document.getElementById("offerResponseRow");
const dateAppliedInput = document.getElementById("dateApplied");
const nextFollowUpInput = document.getElementById("nextFollowUp");
const locationInput = document.getElementById("location");
const linkInput = document.getElementById("link");
const notesInput = document.getElementById("notes");

const drawerBackdrop = document.getElementById("drawerBackdrop");
const applicationDrawer = document.getElementById("applicationDrawer");
const closeDrawerBtn = document.getElementById("closeDrawerBtn");
const cancelDrawerBtn = document.getElementById("cancelDrawerBtn");
const drawerForm = document.getElementById("drawerForm");
const drawerMessage = document.getElementById("drawerMessage");
const deleteApplicationBtn = document.getElementById("deleteApplicationBtn");
const drawerTitleHeading = document.getElementById("drawerTitleHeading");

const drawerCompany = document.getElementById("drawerCompany");
const drawerTitle = document.getElementById("drawerTitle");
const drawerStatus = document.getElementById("drawerStatus");
const drawerPriority = document.getElementById("drawerPriority");
const drawerOfferResponse = document.getElementById("drawerOfferResponse");
const drawerOfferResponseRow = document.getElementById("drawerOfferResponseRow");
const drawerDateApplied = document.getElementById("drawerDateApplied");
const drawerNextFollowUp = document.getElementById("drawerNextFollowUp");
const drawerLocation = document.getElementById("drawerLocation");
const drawerLink = document.getElementById("drawerLink");
const drawerNotes = document.getElementById("drawerNotes");

const statTotalEl = document.getElementById("statTotal");
const statFollowUpsDueEl = document.getElementById("statFollowUpsDue");
const statInterviewingEl = document.getElementById("statInterviewing");
const statOffersEl = document.getElementById("statOffers");

const countNeedToApplyEl = document.getElementById("countNeedToApply");
const countAppliedEl = document.getElementById("countApplied");
const countFollowUpEl = document.getElementById("countFollowUp");
const countInterviewingEl = document.getElementById("countInterviewing");
const countOfferEl = document.getElementById("countOffer");
const archivedCountEl = document.getElementById("archivedCount");

const needToApplyColumn = document.getElementById("need_to_applyColumn");
const appliedColumn = document.getElementById("appliedColumn");
const followUpColumn = document.getElementById("follow_upColumn");
const interviewingColumn = document.getElementById("interviewingColumn");
const offerColumn = document.getElementById("offerColumn");
const archivedColumn = document.getElementById("archivedColumn");
const archivedToggle = document.getElementById("archivedToggle");

const STATUS_KEYS = [
  "need_to_apply",
  "applied",
  "follow_up",
  "interviewing",
  "offer",
  "archived"
];

const columnMap = {
  need_to_apply: needToApplyColumn,
  applied: appliedColumn,
  follow_up: followUpColumn,
  interviewing: interviewingColumn,
  offer: offerColumn,
  archived: archivedColumn
};

const state = {
  user: null,
  applications: [],
  selectedApplicationId: null,
  sortables: []
};

function normalizeStatus(status) {
  if (status === "heard_back") return "follow_up";
  return STATUS_KEYS.includes(status) ? status : "need_to_apply";
}

function normalizeOfferResponse(value) {
  return ["yes", "maybe", "no"].includes(value) ? value : "maybe";
}

function escapeHtml(value = "") {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function sanitizeHttpUrl(value = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
    return "";
  } catch {
    return "";
  }
}

function getAppsRef() {
  return collection(db, "users", state.user.uid, "applications");
}

function getAppDocRef(id) {
  return doc(db, "users", state.user.uid, "applications", id);
}

function setFormMessage(message = "") {
  formMessage.textContent = message;
}

function setDrawerMessage(message = "") {
  drawerMessage.textContent = message;
}

function resetForm() {
  applicationForm.reset();
  priorityInput.value = "medium";
  statusInput.value = "need_to_apply";
  offerResponseInput.value = "maybe";
  updateOfferResponseVisibility(statusInput, offerResponseRow, offerResponseInput);
  setFormMessage("");
}

function openModal() {
  resetForm();
  modalBackdrop.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function openDrawer() {
  drawerBackdrop.classList.remove("hidden");
  document.body.classList.add("drawer-open");
}

function closeDrawer() {
  drawerBackdrop.classList.add("hidden");
  document.body.classList.remove("drawer-open");
  state.selectedApplicationId = null;
  setDrawerMessage("");
}

function updateOfferResponseVisibility(statusEl, rowEl, responseSelectEl) {
  const isOffer = normalizeStatus(statusEl.value) === "offer";
  rowEl.classList.toggle("hidden", !isOffer);

  if (isOffer && !responseSelectEl.value) {
    responseSelectEl.value = "maybe";
  }

  if (!isOffer) {
    responseSelectEl.value = "maybe";
  }
}

function getSelectedApplication() {
  return state.applications.find((app) => app.id === state.selectedApplicationId) || null;
}

function getOfferEmoji(value) {
  if (value === "yes") return "✅";
  if (value === "no") return "❌";
  return "🤔";
}

function getPriorityLabel(priority = "medium") {
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

function getPriorityClass(priority = "medium") {
  if (priority === "high") return "priority-high";
  if (priority === "low") return "priority-low";
  return "priority-medium";
}

function isFollowUpDue(nextFollowUp) {
  if (!nextFollowUp) return false;
  const today = new Date();
  const todayString = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).toISOString().split("T")[0];
  return nextFollowUp <= todayString;
}

function renderEmptyState(container, text) {
  container.innerHTML = `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function createCard(app) {
  const card = document.createElement("article");
  card.className = `app-card${app.status === "archived" ? " archived-card" : ""}`;
  card.dataset.id = app.id;

  const badges = [
    `<span class="badge ${getPriorityClass(app.priority)}">${getPriorityLabel(app.priority)}</span>`
  ];

  if (app.nextFollowUp) {
    const followUpClass = isFollowUpDue(app.nextFollowUp) ? "followup-due" : "followup-soon";
    const followUpLabel = isFollowUpDue(app.nextFollowUp)
      ? `Follow-up due ${escapeHtml(app.nextFollowUp)}`
      : `Follow-up ${escapeHtml(app.nextFollowUp)}`;
    badges.push(`<span class="badge ${followUpClass}">${followUpLabel}</span>`);
  }

  const safeLink = sanitizeHttpUrl(app.link);

  card.innerHTML = `
    ${app.status === "offer" ? `<div class="offer-badge">${getOfferEmoji(app.offerResponse)}</div>` : ""}
    <div>
      <h4>${escapeHtml(app.title || "Untitled Role")}</h4>
      <p class="app-company">${escapeHtml(app.company || "Unknown Company")}</p>
    </div>

    <div class="app-meta">
      ${badges.join("")}
    </div>

    <div class="app-extra">
      ${app.location ? `<div>${escapeHtml(app.location)}</div>` : ""}
      ${app.dateApplied ? `<div>Applied: ${escapeHtml(app.dateApplied)}</div>` : ""}
      ${safeLink ? `<a class="app-link" href="${safeLink}" target="_blank" rel="noopener noreferrer">Open posting</a>` : ""}
      ${app.notes ? `<div>${escapeHtml(app.notes)}</div>` : ""}
    </div>
  `;

  card.addEventListener("click", () => {
    populateDrawer(app);
    openDrawer();
  });

  return card;
}

function renderBoard() {
  Object.values(columnMap).forEach((col) => {
    col.innerHTML = "";
  });

  const grouped = {
    need_to_apply: [],
    applied: [],
    follow_up: [],
    interviewing: [],
    offer: [],
    archived: []
  };

  state.applications.forEach((app) => {
    grouped[app.status].push(app);
  });

  for (const [status, apps] of Object.entries(grouped)) {
    const container = columnMap[status];
    if (!container) continue;

    if (apps.length === 0) {
      renderEmptyState(
        container,
        status === "archived" ? "No archived applications." : "No applications here yet."
      );
      continue;
    }

    apps.forEach((app) => {
      container.appendChild(createCard(app));
    });
  }

  countNeedToApplyEl.textContent = grouped.need_to_apply.length;
  countAppliedEl.textContent = grouped.applied.length;
  countFollowUpEl.textContent = grouped.follow_up.length;
  countInterviewingEl.textContent = grouped.interviewing.length;
  countOfferEl.textContent = grouped.offer.length;
  archivedCountEl.textContent = grouped.archived.length;

  const followUpsDue = state.applications.filter((app) => isFollowUpDue(app.nextFollowUp)).length;
  statTotalEl.textContent = state.applications.length;
  statFollowUpsDueEl.textContent = followUpsDue;
  statInterviewingEl.textContent = grouped.interviewing.length;
  statOffersEl.textContent = grouped.offer.length;

  initSortables();
}

function populateDrawer(app) {
  state.selectedApplicationId = app.id;

  drawerTitleHeading.textContent = app.title || "Edit Application";
  drawerCompany.value = app.company || "";
  drawerTitle.value = app.title || "";
  drawerStatus.value = normalizeStatus(app.status);
  drawerPriority.value = app.priority || "medium";
  drawerOfferResponse.value = normalizeOfferResponse(app.offerResponse);
  drawerDateApplied.value = app.dateApplied || "";
  drawerNextFollowUp.value = app.nextFollowUp || "";
  drawerLocation.value = app.location || "";
  drawerLink.value = app.link || "";
  drawerNotes.value = app.notes || "";

  updateOfferResponseVisibility(drawerStatus, drawerOfferResponseRow, drawerOfferResponse);
  setDrawerMessage("");
}

async function loadApplications() {
  const appsQuery = query(getAppsRef(), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(appsQuery);

  state.applications = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    const status = normalizeStatus(data.status);

    return {
      id: docSnap.id,
      ...data,
      title: data.title || data.role || "",
      status,
      priority: data.priority || "medium",
      offerResponse: status === "offer" ? normalizeOfferResponse(data.offerResponse) : "",
      link: sanitizeHttpUrl(data.link || "")
    };
  });

  renderBoard();
}

async function saveApplication() {
  const company = companyInput.value.trim();
  const title = titleInput.value.trim();
  const status = normalizeStatus(statusInput.value);
  const priority = priorityInput.value || "medium";
  const offerResponse = status === "offer"
    ? normalizeOfferResponse(offerResponseInput.value)
    : "";

  if (!company || !title) {
    setFormMessage("Please enter a company and role title.");
    return;
  }

  saveApplicationBtn.disabled = true;
  saveApplicationBtn.textContent = "Saving...";

  try {
    await addDoc(getAppsRef(), {
      company,
      title,
      status,
      priority,
      offerResponse,
      dateApplied: dateAppliedInput.value || "",
      nextFollowUp: nextFollowUpInput.value || "",
      location: locationInput.value.trim(),
      link: sanitizeHttpUrl(linkInput.value),
      notes: notesInput.value.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await loadApplications();
    closeModal();
  } catch (error) {
    console.error("Error saving application:", error);
    setFormMessage("Could not save application. Please try again.");
  } finally {
    saveApplicationBtn.disabled = false;
    saveApplicationBtn.textContent = "Save Application";
  }
}

async function saveDrawerChanges() {
  const selected = getSelectedApplication();
  if (!selected) return;

  const company = drawerCompany.value.trim();
  const title = drawerTitle.value.trim();
  const status = normalizeStatus(drawerStatus.value);
  const priority = drawerPriority.value || "medium";
  const offerResponse = status === "offer"
    ? normalizeOfferResponse(drawerOfferResponse.value)
    : "";

  if (!company || !title) {
    setDrawerMessage("Please enter a company and role title.");
    return;
  }

  try {
    await updateDoc(getAppDocRef(selected.id), {
      company,
      title,
      status,
      priority,
      offerResponse,
      dateApplied: drawerDateApplied.value || "",
      nextFollowUp: drawerNextFollowUp.value || "",
      location: drawerLocation.value.trim(),
      link: sanitizeHttpUrl(drawerLink.value),
      notes: drawerNotes.value.trim(),
      updatedAt: serverTimestamp()
    });

    await loadApplications();
    closeDrawer();
  } catch (error) {
    console.error("Error updating application:", error);
    setDrawerMessage("Could not save changes. Please try again.");
  }
}

async function deleteSelectedApplication() {
  const selected = getSelectedApplication();
  if (!selected) return;

  const confirmed = window.confirm(`Delete ${selected.title || "this application"}?`);
  if (!confirmed) return;

  try {
    await deleteDoc(getAppDocRef(selected.id));
    await loadApplications();
    closeDrawer();
  } catch (error) {
    console.error("Error deleting application:", error);
    setDrawerMessage("Could not delete application. Please try again.");
  }
}

function destroySortables() {
  state.sortables.forEach((sortable) => sortable.destroy());
  state.sortables = [];
}

function initSortables() {
  destroySortables();

  if (typeof Sortable === "undefined") return;

  Object.entries(columnMap).forEach(([statusKey, el]) => {
    const sortable = new Sortable(el, {
      group: "pipeline-board",
      animation: 150,
      draggable: ".app-card",
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      onStart() {
        el.classList.add("drag-active");
      },
      onEnd: async (evt) => {
        Object.values(columnMap).forEach((col) => col.classList.remove("drag-active"));
        await handleDragEnd(evt, statusKey);
      }
    });

    state.sortables.push(sortable);
  });
}

async function handleDragEnd(evt, fallbackStatusKey) {
  const applicationId = evt.item?.dataset?.id;
  if (!applicationId) {
    await loadApplications();
    return;
  }

  const targetColumn = evt.to;
  const newStatus =
    Object.entries(columnMap).find(([, el]) => el === targetColumn)?.[0] || fallbackStatusKey;

  const app = state.applications.find((item) => item.id === applicationId);
  if (!app) {
    await loadApplications();
    return;
  }

  if (app.status === newStatus) {
    renderBoard();
    return;
  }

  const offerResponse = newStatus === "offer"
    ? normalizeOfferResponse(app.offerResponse || "maybe")
    : "";

  try {
    await updateDoc(getAppDocRef(applicationId), {
      status: newStatus,
      offerResponse,
      updatedAt: serverTimestamp()
    });

    await loadApplications();

    if (state.selectedApplicationId === applicationId) {
      const updated = state.applications.find((item) => item.id === applicationId);
      if (updated) populateDrawer(updated);
    }
  } catch (error) {
    console.error("Error updating status after drag:", error);
    await loadApplications();
    alert("Could not move application. Please try again.");
  }
}

function bindEvents() {
  openModalBtn?.addEventListener("click", openModal);
  closeModalBtn?.addEventListener("click", closeModal);
  cancelModalBtn?.addEventListener("click", closeModal);

  modalBackdrop?.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) closeModal();
  });

  applicationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveApplication();
  });

  statusInput?.addEventListener("change", () => {
    updateOfferResponseVisibility(statusInput, offerResponseRow, offerResponseInput);
  });

  closeDrawerBtn?.addEventListener("click", closeDrawer);
  cancelDrawerBtn?.addEventListener("click", closeDrawer);

  drawerBackdrop?.addEventListener("click", (event) => {
    if (event.target === drawerBackdrop) closeDrawer();
  });

  drawerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveDrawerChanges();
  });

  drawerStatus?.addEventListener("change", () => {
    updateOfferResponseVisibility(drawerStatus, drawerOfferResponseRow, drawerOfferResponse);
  });

  deleteApplicationBtn?.addEventListener("click", deleteSelectedApplication);

  archivedToggle?.addEventListener("click", () => {
    archivedColumn.classList.toggle("collapsed");
  });

  updateOfferResponseVisibility(statusInput, offerResponseRow, offerResponseInput);
  updateOfferResponseVisibility(drawerStatus, drawerOfferResponseRow, drawerOfferResponse);
}

async function init() {
  bindEvents();
  state.user = await waitForUser();
  await loadApplications();
}

init().catch((error) => {
  console.error("Dashboard init failed:", error);
  alert("Could not load dashboard.");
});