import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const state = {
  contacts: [],
  filteredContacts: [],
  currentUser: null,
  editingContactId: null
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("No user signed in");
    window.location.replace("login.html");
    return;
  }

  currentUser = user;

  if (userNameEl) {
    userNameEl.textContent =
      user.displayName?.trim() || user.email?.split("@")[0] || "User";
  }

  if (userEmailEl) {
    userEmailEl.textContent = user.email || "";
  }

  await loadApplications();
  await loadSavedDrafts();
});


const userNameEl = document.getElementById("userName");
const userEmailEl = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

const els = {
  contactsGrid: document.getElementById("contactsGrid"),
  emptyState: document.getElementById("emptyState"),

  totalContactsStat: document.getElementById("totalContactsStat"),
  activeThisMonthStat: document.getElementById("activeThisMonthStat"),
  needFollowUpStat: document.getElementById("needFollowUpStat"),
  companiesRepresentedStat: document.getElementById("companiesRepresentedStat"),

  searchInput: document.getElementById("searchInput"),
  relationshipFilter: document.getElementById("relationshipFilter"),
  statusFilter: document.getElementById("statusFilter"),
  sortSelect: document.getElementById("sortSelect"),

  addContactBtn: document.getElementById("addContactBtn"),
  emptyAddContactBtn: document.getElementById("emptyAddContactBtn"),

  drawerBackdrop: document.getElementById("drawerBackdrop"),
  contactDrawer: document.getElementById("contactDrawer"),
  closeDrawerBtn: document.getElementById("closeDrawerBtn"),
  cancelDrawerBtn: document.getElementById("cancelDrawerBtn"),
  archiveContactBtn: document.getElementById("archiveContactBtn"),

  drawerEyebrow: document.getElementById("drawerEyebrow"),
  drawerTitle: document.getElementById("drawerTitle"),

  contactForm: document.getElementById("contactForm"),
  contactId: document.getElementById("contactId"),
  fullName: document.getElementById("fullName"),
  relationship: document.getElementById("relationship"),
  company: document.getElementById("company"),
  role: document.getElementById("role"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  linkedinUrl: document.getElementById("linkedinUrl"),
  source: document.getElementById("source"),
  status: document.getElementById("status"),
  relatedOpportunityIds: document.getElementById("relatedOpportunityIds"),
  lastContactedAt: document.getElementById("lastContactedAt"),
  nextFollowUpAt: document.getElementById("nextFollowUpAt"),
  notes: document.getElementById("notes")
};

function getContactsCollectionRef(uid) {
  return collection(db, "users", uid, "contacts");
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function toDateStringOrNull(value) {
  return value ? value : "";
}

function formatDate(value) {
  if (!value) return "—";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getStatusBadgeClass(status = "") {
  if (status === "active") return "badge-status-active";
  if (status === "warm") return "badge-status-warm";
  return "badge-status-cold";
}

function getStatusLabel(status = "") {
  if (status === "active") return "🟢 Active";
  if (status === "warm") return "🟡 Warm";
  return "⚪ Cold";
}

function truncateText(text = "", maxLength = 140) {
  if (!text) return "No notes yet.";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function isSameMonth(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth()
  );
}

function normalizeString(value = "") {
  return value.trim().toLowerCase();
}

function parseCommaSeparatedIds(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildContactCard(contact) {
  const name = escapeHtml(contact.fullName || "Unnamed Contact");
  const relationship = escapeHtml(contact.relationship || "No relationship");
  const company = escapeHtml(contact.company || "No company");
  const role = escapeHtml(contact.role || "No title");
  const email = escapeHtml(contact.email || "—");
  const phone = escapeHtml(contact.phone || "—");
  const source = escapeHtml(contact.source || "—");
  const notes = escapeHtml(truncateText(contact.notes || ""));
  const initials = escapeHtml(getInitials(contact.fullName || ""));
  const relatedCount = Array.isArray(contact.relatedOpportunityIds)
    ? contact.relatedOpportunityIds.length
    : 0;

  return `
    <article class="contact-card" data-id="${contact.id}">
      <div class="contact-top">
        <div class="contact-main">
          <div class="avatar">${initials}</div>
          <div class="contact-name-block">
            <h3 class="contact-name">${name}</h3>
            <p class="contact-role">
              ${role} <span class="contact-company">@ ${company}</span>
            </p>
          </div>
        </div>

        <div class="contact-actions">
          <button class="icon-btn edit-contact-btn" data-id="${contact.id}" aria-label="Edit contact">✎</button>
        </div>
      </div>

      <div class="contact-badges">
        <span class="badge">${relationship}</span>
        <span class="badge ${getStatusBadgeClass(contact.status)}">
          ${getStatusLabel(contact.status)}
        </span>
      </div>

      <div class="contact-meta">
        <div class="meta-card">
          <span class="meta-label">Last Contacted</span>
          <span class="meta-value">${formatDate(contact.lastContactedAt)}</span>
        </div>

        <div class="meta-card">
          <span class="meta-label">Next Follow-Up</span>
          <span class="meta-value">${formatDate(contact.nextFollowUpAt)}</span>
        </div>

        <div class="meta-card">
          <span class="meta-label">Email</span>
          <span class="meta-value">${email}</span>
        </div>

        <div class="meta-card">
          <span class="meta-label">Source</span>
          <span class="meta-value">${source}</span>
        </div>
      </div>

      <div class="contact-notes">
        <span class="notes-label">Notes</span>
        <p class="notes-text">${notes}</p>
      </div>

      <div class="contact-footer">
        <div class="related-pill">
          Related opportunities: ${relatedCount}
        </div>
        <div class="meta-value">${phone !== "—" ? phone : ""}</div>
      </div>
    </article>
  `;
}

function renderContacts() {
  if (state.filteredContacts.length === 0) {
    els.contactsGrid.innerHTML = "";
    els.emptyState.classList.remove("hidden");
    return;
  }

  els.emptyState.classList.add("hidden");
  els.contactsGrid.innerHTML = state.filteredContacts.map(buildContactCard).join("");

  document.querySelectorAll(".edit-contact-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const contact = state.contacts.find((item) => item.id === id);
      if (contact) openDrawer(contact);
    });
  });
}

function renderStats() {
  const activeContacts = state.contacts.filter((c) => !c.archived);
  const now = new Date();

  const activeThisMonth = activeContacts.filter((contact) => {
    if (!contact.lastContactedAt) return false;
    const date = contact.lastContactedAt.toDate();
    return isSameMonth(date, now);
  }).length;

  const needFollowUp = activeContacts.filter((contact) => {
    if (!contact.nextFollowUpAt) return false;
    const followUpDate = contact.nextFollowUpAt.toDate();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return followUpDate <= today;
  }).length;

  const companies = new Set(
    activeContacts
      .map((c) => (c.company || "").trim())
      .filter(Boolean)
      .map((c) => c.toLowerCase())
  );

  els.totalContactsStat.textContent = activeContacts.length;
  els.activeThisMonthStat.textContent = activeThisMonth;
  els.needFollowUpStat.textContent = needFollowUp;
  els.companiesRepresentedStat.textContent = companies.size;
}

function renderRelationshipFilterOptions() {
  const currentValue = els.relationshipFilter.value;
  const relationships = Array.from(
    new Set(
      state.contacts
        .filter((c) => !c.archived)
        .map((c) => (c.relationship || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  els.relationshipFilter.innerHTML = `
    <option value="all">All relationships</option>
    ${relationships.map((rel) => `<option value="${escapeHtml(rel)}">${escapeHtml(rel)}</option>`).join("")}
  `;

  if (relationships.includes(currentValue)) {
    els.relationshipFilter.value = currentValue;
  } else {
    els.relationshipFilter.value = "all";
  }
}

function applyFilters() {
  const search = normalizeString(els.searchInput.value);
  const relationship = els.relationshipFilter.value;
  const status = els.statusFilter.value;
  const sort = els.sortSelect.value;

  let results = state.contacts.filter((contact) => !contact.archived);

  if (search) {
    results = results.filter((contact) => {
      const haystack = [
        contact.fullName || "",
        contact.company || "",
        contact.role || "",
        contact.email || ""
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }

  if (relationship !== "all") {
    results = results.filter(
      (contact) => (contact.relationship || "").trim() === relationship
    );
  }

  if (status !== "all") {
    results = results.filter((contact) => (contact.status || "cold") === status);
  }

  results.sort((a, b) => {
    if (sort === "nameAZ") {
      return (a.fullName || "").localeCompare(b.fullName || "");
    }

    if (sort === "lastContacted") {
      const aTime = a.lastContactedAt?.toDate?.().getTime?.() || 0;
      const bTime = b.lastContactedAt?.toDate?.().getTime?.() || 0;
      return bTime - aTime;
    }

    if (sort === "followUpSoon") {
      const aTime = a.nextFollowUpAt?.toDate?.().getTime?.() || Number.MAX_SAFE_INTEGER;
      const bTime = b.nextFollowUpAt?.toDate?.().getTime?.() || Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    }

    const aTime = a.createdAt?.toDate?.().getTime?.() || 0;
    const bTime = b.createdAt?.toDate?.().getTime?.() || 0;
    return bTime - aTime;
  });

  state.filteredContacts = results;
  renderContacts();
}

function resetForm() {
  els.contactForm.reset();
  els.contactId.value = "";
  state.editingContactId = null;
  els.status.value = "active";
  els.archiveContactBtn.classList.add("hidden");
}

function fillForm(contact) {
  els.contactId.value = contact.id || "";
  els.fullName.value = contact.fullName || "";
  els.relationship.value = contact.relationship || "";
  els.company.value = contact.company || "";
  els.role.value = contact.role || "";
  els.email.value = contact.email || "";
  els.phone.value = contact.phone || "";
  els.linkedinUrl.value = contact.linkedinUrl || "";
  els.source.value = contact.source || "";
  els.status.value = contact.status || "active";
  els.relatedOpportunityIds.value = (contact.relatedOpportunityIds || []).join(", ");
  els.lastContactedAt.value = toDateInputValue(contact.lastContactedAt);
  els.nextFollowUpAt.value = toDateInputValue(contact.nextFollowUpAt);
  els.notes.value = contact.notes || "";
}

function openDrawer(contact = null) {
  resetForm();

  if (contact) {
    state.editingContactId = contact.id;
    fillForm(contact);
    els.drawerEyebrow.textContent = "Edit Contact";
    els.drawerTitle.textContent = contact.fullName || "Edit Contact";
    els.archiveContactBtn.classList.remove("hidden");
  } else {
    els.drawerEyebrow.textContent = "New Contact";
    els.drawerTitle.textContent = "Add Contact";
  }

  els.drawerBackdrop.classList.remove("hidden");
  els.contactDrawer.classList.add("open");
  els.contactDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("drawer-open");
}

function closeDrawer() {
  els.contactDrawer.classList.remove("open");
  els.contactDrawer.setAttribute("aria-hidden", "true");
  els.drawerBackdrop.classList.add("hidden");
  document.body.classList.remove("drawer-open");
}

function buildContactPayload() {
  const fullName = els.fullName.value.trim();

  return {
    fullName,
    company: els.company.value.trim(),
    role: els.role.value.trim(),
    email: els.email.value.trim(),
    phone: els.phone.value.trim(),
    linkedinUrl: els.linkedinUrl.value.trim(),
    relationship: els.relationship.value.trim(),
    status: els.status.value,
    source: els.source.value.trim(),
    notes: els.notes.value.trim(),
    lastContactedAt: toDateStringOrNull(els.lastContactedAt.value),
    nextFollowUpAt: toDateStringOrNull(els.nextFollowUpAt.value),
    archived: false,
    updatedAt: serverTimestamp()
  };
}

async function loadContacts(uid) {
  const contactsRef = getContactsCollectionRef(uid);
  const q = query(contactsRef, orderBy("createdAt", "desc"));

  const snap = await getDocs(q);
  state.contacts = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  renderStats();
  renderRelationshipFilterOptions();
  applyFilters();
}

async function saveContact(event) {
  event.preventDefault();

  if (!state.currentUser) return;

  const fullName = els.fullName.value.trim();
  if (!fullName) {
    alert("Full name is required.");
    return;
  }

  const payload = buildContactPayload();
  const contactsRef = getContactsCollectionRef(state.currentUser.uid);

  try {
    if (state.editingContactId) {
      const contactRef = doc(db, "users", state.currentUser.uid, "contacts", state.editingContactId);
      await updateDoc(contactRef, payload);
    } else {
      await addDoc(contactsRef, {
        ...payload,
        createdAt: serverTimestamp()
    });
    }

    closeDrawer();
    resetForm();
    await loadContacts(state.currentUser.uid);
  } catch (error) {
    console.error("Error saving contact:", error);
    alert("There was a problem saving this contact.");
  }
}

async function archiveCurrentContact() {
  if (!state.currentUser || !state.editingContactId) return;

  const confirmed = window.confirm("Archive this contact?");
  if (!confirmed) return;

  try {
    const contactRef = doc(db, "users", state.currentUser.uid, "contacts", state.editingContactId);
    await updateDoc(contactRef, {
      archived: true,
      updatedAt: Timestamp.now()
    });

    closeDrawer();
    resetForm();
    await loadContacts(state.currentUser.uid);
  } catch (error) {
    console.error("Error archiving contact:", error);
    alert("There was a problem archiving this contact.");
  }
}

function bindEvents() {
  els.addContactBtn.addEventListener("click", () => openDrawer());
  els.emptyAddContactBtn.addEventListener("click", () => openDrawer());

  els.closeDrawerBtn.addEventListener("click", closeDrawer);
  els.cancelDrawerBtn.addEventListener("click", closeDrawer);
  els.drawerBackdrop.addEventListener("click", closeDrawer);
  els.archiveContactBtn.addEventListener("click", archiveCurrentContact);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });

  els.contactForm.addEventListener("submit", saveContact);

  els.searchInput.addEventListener("input", applyFilters);
  els.relationshipFilter.addEventListener("change", applyFilters);
  els.statusFilter.addEventListener("change", applyFilters);
  els.sortSelect.addEventListener("change", applyFilters);
}

bindEvents();