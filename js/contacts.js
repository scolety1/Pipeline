import { db } from "./firebase-config.js";
import { waitForUser } from "./protected-page.js";
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

const state = {
  user: null,
  contacts: [],
  filteredContacts: [],
  editingContactId: null
};

function getContactsRef() {
  return collection(db, "users", state.user.uid, "contacts");
}

function getContactDocRef(contactId) {
  return doc(db, "users", state.user.uid, "contacts", contactId);
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
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

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
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
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function getNormalizedRelatedIds(rawValue = "") {
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isFollowUpNeeded(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date <= localToday;
}

function openDrawer(isEditing = false) {
  els.contactDrawer.classList.add("open");
  els.contactDrawer.setAttribute("aria-hidden", "false");
  els.drawerBackdrop.classList.remove("hidden");
  document.body.classList.add("drawer-open");

  els.drawerEyebrow.textContent = isEditing ? "Edit Contact" : "New Contact";
  els.drawerTitle.textContent = isEditing ? "Update Contact" : "Add Contact";
  els.archiveContactBtn.classList.toggle("hidden", !isEditing);
}

function closeDrawer() {
  els.contactDrawer.classList.remove("open");
  els.contactDrawer.setAttribute("aria-hidden", "true");
  els.drawerBackdrop.classList.add("hidden");
  document.body.classList.remove("drawer-open");
  resetForm();
}

function resetForm() {
  state.editingContactId = null;
  els.contactForm.reset();
  els.contactId.value = "";
  els.status.value = "active";
  els.archiveContactBtn.classList.add("hidden");
  els.drawerEyebrow.textContent = "New Contact";
  els.drawerTitle.textContent = "Add Contact";
}

function fillForm(contact) {
  state.editingContactId = contact.id;
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

function renderStats() {
  const total = state.contacts.length;

  const activeThisMonth = state.contacts.filter((contact) => {
    if (!contact.lastContactedAt) return false;
    const date = contact.lastContactedAt?.toDate
      ? contact.lastContactedAt.toDate()
      : new Date(contact.lastContactedAt);

    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  const needFollowUp = state.contacts.filter((contact) =>
    isFollowUpNeeded(toDateInputValue(contact.nextFollowUpAt))
  ).length;

  const companiesRepresented = new Set(
    state.contacts
      .map((contact) => (contact.company || "").trim())
      .filter(Boolean)
      .map((company) => company.toLowerCase())
  ).size;

  els.totalContactsStat.textContent = total;
  els.activeThisMonthStat.textContent = activeThisMonth;
  els.needFollowUpStat.textContent = needFollowUp;
  els.companiesRepresentedStat.textContent = companiesRepresented;
}

function renderRelationshipOptions() {
  const currentValue = els.relationshipFilter.value || "all";

  const relationships = Array.from(
    new Set(
      state.contacts
        .map((contact) => (contact.relationship || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  els.relationshipFilter.innerHTML = `<option value="all">All relationships</option>`;

  relationships.forEach((relationship) => {
    const option = document.createElement("option");
    option.value = relationship;
    option.textContent = relationship;
    els.relationshipFilter.appendChild(option);
  });

  if ([...els.relationshipFilter.options].some((opt) => opt.value === currentValue)) {
    els.relationshipFilter.value = currentValue;
  }
}

function sortContacts(contacts) {
  const sortValue = els.sortSelect.value;

  const sorted = [...contacts];

  if (sortValue === "nameAZ") {
    sorted.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
    return sorted;
  }

  if (sortValue === "lastContacted") {
    sorted.sort((a, b) => {
      const aTime = new Date(toDateInputValue(a.lastContactedAt) || "1900-01-01").getTime();
      const bTime = new Date(toDateInputValue(b.lastContactedAt) || "1900-01-01").getTime();
      return bTime - aTime;
    });
    return sorted;
  }

  if (sortValue === "followUpSoon") {
    sorted.sort((a, b) => {
      const aTime = new Date(toDateInputValue(a.nextFollowUpAt) || "9999-12-31").getTime();
      const bTime = new Date(toDateInputValue(b.nextFollowUpAt) || "9999-12-31").getTime();
      return aTime - bTime;
    });
    return sorted;
  }

  sorted.sort((a, b) => {
    const aCreated = a.createdAt?.seconds || 0;
    const bCreated = b.createdAt?.seconds || 0;
    return bCreated - aCreated;
  });

  return sorted;
}

function applyFilters() {
  const searchTerm = els.searchInput.value.trim().toLowerCase();
  const relationshipFilter = els.relationshipFilter.value;
  const statusFilter = els.statusFilter.value;

  let result = [...state.contacts];

  if (searchTerm) {
    result = result.filter((contact) => {
      const haystack = [
        contact.fullName,
        contact.company,
        contact.role,
        contact.email,
        contact.relationship,
        contact.notes
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchTerm);
    });
  }

  if (relationshipFilter !== "all") {
    result = result.filter((contact) => (contact.relationship || "") === relationshipFilter);
  }

  if (statusFilter !== "all") {
    result = result.filter((contact) => (contact.status || "cold") === statusFilter);
  }

  state.filteredContacts = sortContacts(result);
  renderContactsGrid();
}

function renderContactsGrid() {
  const contacts = state.filteredContacts;
  els.contactsGrid.innerHTML = "";

  els.emptyState.classList.toggle("hidden", contacts.length > 0);

  contacts.forEach((contact) => {
    const card = document.createElement("article");
    card.className = "contact-card";

    const companyText = contact.company
      ? `<span class="contact-company">${escapeHtml(contact.company)}</span>`
      : "No company";

    const roleText = contact.role ? ` · ${escapeHtml(contact.role)}` : "";

    const detailItems = [
      contact.email
        ? `<div class="contact-detail"><span class="contact-detail-label">Email:</span><a class="contact-link" href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></div>`
        : "",
      contact.phone
        ? `<div class="contact-detail"><span class="contact-detail-label">Phone:</span><span>${escapeHtml(contact.phone)}</span></div>`
        : "",
      contact.linkedinUrl
        ? `<div class="contact-detail"><span class="contact-detail-label">LinkedIn:</span><a class="contact-link" href="${escapeHtml(contact.linkedinUrl)}" target="_blank" rel="noopener noreferrer">Profile</a></div>`
        : "",
      contact.lastContactedAt
        ? `<div class="contact-detail"><span class="contact-detail-label">Last contacted:</span><span>${formatDate(contact.lastContactedAt)}</span></div>`
        : "",
      contact.nextFollowUpAt
        ? `<div class="contact-detail"><span class="contact-detail-label">Next follow-up:</span><span>${formatDate(contact.nextFollowUpAt)}</span></div>`
        : ""
    ].filter(Boolean);

    card.innerHTML = `
      <div class="contact-top">
        <div class="contact-main">
          <div class="avatar">${escapeHtml(getInitials(contact.fullName))}</div>
          <div class="contact-name-block">
            <h3 class="contact-name">${escapeHtml(contact.fullName || "Unnamed Contact")}</h3>
            <p class="contact-role">${companyText}${roleText}</p>
          </div>
        </div>

        <div class="contact-actions">
          <button class="icon-btn edit-contact-btn" type="button" aria-label="Edit contact">✎</button>
        </div>
      </div>

      <div class="contact-badges">
        <span class="badge ${getStatusBadgeClass(contact.status)}">${getStatusLabel(contact.status)}</span>
        ${contact.relationship ? `<span class="badge">${escapeHtml(contact.relationship)}</span>` : ""}
        ${isFollowUpNeeded(toDateInputValue(contact.nextFollowUpAt)) ? `<span class="badge badge-status-warm">Follow-up due</span>` : ""}
      </div>

      <div class="contact-details">
        ${detailItems.join("")}
      </div>

      <div class="contact-details">
        <div class="contact-detail">
          <span>${escapeHtml(truncateText(contact.notes))}</span>
        </div>
      </div>
    `;

    card.querySelector(".edit-contact-btn")?.addEventListener("click", () => {
      fillForm(contact);
      openDrawer(true);
    });

    els.contactsGrid.appendChild(card);
  });
}

async function loadContacts() {
  const contactsQuery = query(getContactsRef(), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(contactsQuery);

  state.contacts = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  renderStats();
  renderRelationshipOptions();
  applyFilters();
}

async function saveContact() {
  const payload = {
    fullName: els.fullName.value.trim(),
    relationship: els.relationship.value.trim(),
    company: els.company.value.trim(),
    role: els.role.value.trim(),
    email: els.email.value.trim(),
    phone: els.phone.value.trim(),
    linkedinUrl: els.linkedinUrl.value.trim(),
    source: els.source.value.trim(),
    status: els.status.value || "active",
    relatedOpportunityIds: getNormalizedRelatedIds(els.relatedOpportunityIds.value),
    lastContactedAt: els.lastContactedAt.value || "",
    nextFollowUpAt: els.nextFollowUpAt.value || "",
    notes: els.notes.value.trim(),
    updatedAt: serverTimestamp()
  };

  if (!payload.fullName) {
    alert("Please enter a full name.");
    return;
  }

  try {
    if (state.editingContactId) {
      await updateDoc(getContactDocRef(state.editingContactId), payload);
    } else {
      await addDoc(getContactsRef(), {
        ...payload,
        archived: false,
        createdAt: serverTimestamp()
      });
    }

    await loadContacts();
    closeDrawer();
  } catch (error) {
    console.error("Error saving contact:", error);
    alert("Could not save contact. Please try again.");
  }
}

async function archiveCurrentContact() {
  if (!state.editingContactId) return;

  try {
    await updateDoc(getContactDocRef(state.editingContactId), {
      archived: true,
      updatedAt: serverTimestamp()
    });

    await loadContacts();
    closeDrawer();
  } catch (error) {
    console.error("Error archiving contact:", error);
    alert("Could not archive contact.");
  }
}

function bindEvents() {
  els.addContactBtn?.addEventListener("click", () => {
    resetForm();
    openDrawer(false);
  });

  els.emptyAddContactBtn?.addEventListener("click", () => {
    resetForm();
    openDrawer(false);
  });

  els.closeDrawerBtn?.addEventListener("click", closeDrawer);
  els.cancelDrawerBtn?.addEventListener("click", closeDrawer);

  els.drawerBackdrop?.addEventListener("click", closeDrawer);

  els.contactForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveContact();
  });

  els.archiveContactBtn?.addEventListener("click", archiveCurrentContact);

  els.searchInput?.addEventListener("input", applyFilters);
  els.relationshipFilter?.addEventListener("change", applyFilters);
  els.statusFilter?.addEventListener("change", applyFilters);
  els.sortSelect?.addEventListener("change", applyFilters);
}

async function init() {
  bindEvents();
  state.user = await waitForUser();
  await loadContacts();
}

init().catch((error) => {
  console.error("Contacts init failed:", error);
  alert("Could not load contacts.");
});