import { db, auth } from "./firebase-config.js";
import { waitForUser } from "./protected-page.js";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const refreshApplicationsBtn = document.getElementById("refreshApplicationsBtn");

const emailGeneratorForm = document.getElementById("emailGeneratorForm");
const applicationSelect = document.getElementById("applicationSelect");
const emailType = document.getElementById("emailType");
const toneSelect = document.getElementById("toneSelect");
const extraContext = document.getElementById("extraContext");
const customGoal = document.getElementById("customGoal");
const clearFormBtn = document.getElementById("clearFormBtn");

const previewCompany = document.getElementById("previewCompany");
const previewRole = document.getElementById("previewRole");
const previewContact = document.getElementById("previewContact");
const previewStatus = document.getElementById("previewStatus");
const previewNotes = document.getElementById("previewNotes");

const selectedDraftTypePreview = document.getElementById("selectedDraftTypePreview");
const selectedTonePreview = document.getElementById("selectedTonePreview");
const selectedCompanyPreview = document.getElementById("selectedCompanyPreview");

const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const draftOutput = document.getElementById("draftOutput");

const generatedSubject = document.getElementById("generatedSubject");
const generatedBody = document.getElementById("generatedBody");

const copySubjectBtn = document.getElementById("copySubjectBtn");
const copyBodyBtn = document.getElementById("copyBodyBtn");
const saveDraftBtn = document.getElementById("saveDraftBtn");

const shorterBtn = document.getElementById("shorterBtn");
const warmerBtn = document.getElementById("warmerBtn");
const strongerBtn = document.getElementById("strongerBtn");
const regenerateBtn = document.getElementById("regenerateBtn");

const savedDraftsList = document.getElementById("savedDraftsList");

const state = {
  user: null,
  applications: [],
  selectedApplication: null,
  lastGenerationPayload: null
};

const AI_ENDPOINT = "https://generateemaildraft-pii55d2nha-uc.a.run.app";

function getApplicationsRef() {
  return collection(db, "users", state.user.uid, "applications");
}

function getDraftsRef() {
  return collection(db, "users", state.user.uid, "generatedDrafts");
}

function showLoading() {
  loadingState.classList.remove("hidden");
  emptyState.classList.add("hidden");
  draftOutput.classList.add("hidden");
}

function showEmpty() {
  loadingState.classList.add("hidden");
  emptyState.classList.remove("hidden");
  draftOutput.classList.add("hidden");
}

function showDraft() {
  loadingState.classList.add("hidden");
  emptyState.classList.add("hidden");
  draftOutput.classList.remove("hidden");
}

function resetApplicationPreview() {
  previewCompany.textContent = "—";
  previewRole.textContent = "—";
  previewContact.textContent = "—";
  previewStatus.textContent = "—";
  previewNotes.textContent = "No notes yet.";
  selectedCompanyPreview.textContent = "—";
}

function updateApplicationPreview() {
  if (!state.selectedApplication) {
    resetApplicationPreview();
    return;
  }

  const app = state.selectedApplication;
  previewCompany.textContent = app.company || "—";
  previewRole.textContent = app.title || app.role || "—";

  const contactName = app.contactName?.trim();
  const contactEmail = app.contactEmail?.trim();
  previewContact.textContent =
    contactName || contactEmail
      ? [contactName, contactEmail].filter(Boolean).join(" • ")
      : "—";

  previewStatus.textContent = app.status || "—";
  previewNotes.textContent = app.notes || "No notes yet.";
  selectedCompanyPreview.textContent = app.company || "—";
}

function normalizeEmailType(value) {
  const map = {
    "cold-outreach": "cold outreach",
    "follow-up": "follow up",
    "thank-you": "thank you",
    "networking": "networking",
    "application-follow-up": "application follow up",
    "application follow-up": "application follow up",
    "check-in": "follow up",
    "referral-request": "networking"
  };

  return map[value] || value;
}

function normalizeTone(value) {
  const map = {
    warm: "friendly",
    friendly: "friendly",
    professional: "professional",
    confident: "confident",
    concise: "concise"
  };

  return map[value] || "professional";
}

function getEmailTypeLabel(value) {
  const normalized = normalizeEmailType(value);

  const labels = {
    "cold outreach": "Cold outreach",
    "follow up": "Follow up",
    "thank you": "Thank you",
    "networking": "Networking",
    "application follow up": "Application follow up"
  };

  return labels[normalized] || "—";
}

function getToneLabel(value) {
  const normalized = normalizeTone(value);

  const labels = {
    professional: "Professional",
    friendly: "Friendly",
    confident: "Confident",
    concise: "Concise"
  };

  return labels[normalized] || "—";
}

function updateTopSummary() {
  selectedDraftTypePreview.textContent = getEmailTypeLabel(emailType.value);
  selectedTonePreview.textContent = getToneLabel(toneSelect.value);
  selectedCompanyPreview.textContent = state.selectedApplication?.company || "—";
}

function sanitizeFreeText(value, maxLength = 1000) {
  return String(value || "").trim().slice(0, maxLength);
}

function buildGenerationPayload(overrides = {}) {
  const combinedExtraContext = [
    overrides.extraContext ?? extraContext.value,
    overrides.customGoal ?? customGoal.value
  ]
    .map((item) => sanitizeFreeText(item, 1000))
    .filter(Boolean)
    .join("\n\n");

  return {
    application: state.selectedApplication,
    emailType: normalizeEmailType(overrides.emailType || emailType.value),
    tone: normalizeTone(overrides.tone || toneSelect.value),
    extraContext: combinedExtraContext,
    customGoal: sanitizeFreeText(overrides.customGoal ?? customGoal.value, 500)
  };
}

function getFallbackDraft(payload) {
  const company = payload.application?.company || "the company";
  const role = payload.application?.title || payload.application?.role || "the role";
  const type = payload.emailType || "follow up";

  const subjectMap = {
    "follow up": `Following up on ${role} application`,
    "thank you": "Thank you for the interview",
    networking: `Connecting about opportunities at ${company}`,
    "cold outreach": `Interest in ${company}`,
    "application follow up": `Following up on ${role} application`
  };

  const subject = subjectMap[type] || `Following up regarding ${role}`;

  const body = [
    "Hi,",
    "",
    `I hope you're doing well. I wanted to reach out regarding ${role} at ${company}.`,
    payload.customGoal
      ? `${payload.customGoal}.`
      : "I’m very interested in the opportunity and would love to stay in touch.",
    payload.extraContext ? "" : "",
    payload.extraContext || "",
    "",
    "Thank you for your time,",
    state.user?.displayName || state.user?.email?.split("@")[0] || "User"
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, body };
}

async function callAiDraft(payload) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken();

  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      company: sanitizeFreeText(payload.application?.company, 100),
      role: sanitizeFreeText(
        payload.application?.title || payload.application?.role,
        100
      ),
      contactName: sanitizeFreeText(payload.application?.contactName, 100),
      notes: sanitizeFreeText(payload.application?.notes, 1000),
      emailType: payload.emailType,
      tone: payload.tone,
      extraContext: sanitizeFreeText(payload.extraContext, 1000)
    })
  });

  if (!response.ok) {
    throw new Error(`AI request failed with status ${response.status}`);
  }

  return response.json();
}

async function loadApplications() {
  applicationSelect.innerHTML = "";
  state.applications = [];
  state.selectedApplication = null;
  resetApplicationPreview();
  updateTopSummary();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select an application";
  applicationSelect.appendChild(defaultOption);

  const snapshot = await getDocs(getApplicationsRef());

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const app = {
      id: docSnap.id,
      ...data,
      title: data.title || data.role || ""
    };

    state.applications.push(app);

    const option = document.createElement("option");
    option.value = app.id;
    option.textContent = `${app.company || "Unknown Company"} — ${app.title || "Unknown Role"}`;
    applicationSelect.appendChild(option);
  });
}

async function loadSavedDrafts() {
  try {
    const draftsQuery = query(getDraftsRef(), orderBy("createdAt", "desc"), limit(8));
    const snapshot = await getDocs(draftsQuery);

    savedDraftsList.innerHTML = "";

    if (snapshot.empty) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "saved-draft-empty";
      emptyMessage.textContent = "No saved drafts yet.";
      savedDraftsList.appendChild(emptyMessage);
      return;
    }

    snapshot.forEach((docSnap) => {
      const draft = docSnap.data();
      const card = document.createElement("article");
      card.className = "saved-draft-card";

      const top = document.createElement("div");
      top.className = "saved-draft-card-top";

      const subjectEl = document.createElement("strong");
      subjectEl.textContent = draft.subject || "Untitled Draft";

      const companyEl = document.createElement("span");
      companyEl.textContent = draft.company || "—";

      top.appendChild(subjectEl);
      top.appendChild(companyEl);

      const previewText = document.createElement("p");
      const body = draft.body || "";
      const truncated = body.slice(0, 180) + (body.length > 180 ? "…" : "");
      previewText.textContent = truncated;

      card.appendChild(top);
      card.appendChild(previewText);

      card.addEventListener("click", () => {
        generatedSubject.value = draft.subject || "";
        generatedBody.value = draft.body || "";
        showDraft();
      });

      savedDraftsList.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading saved drafts:", error);
    savedDraftsList.innerHTML = "";

    const errorMessage = document.createElement("div");
    errorMessage.className = "saved-draft-empty";
    errorMessage.textContent = "Could not load saved drafts.";
    savedDraftsList.appendChild(errorMessage);
  }
}

async function generateDraft(overrides = {}) {
  if (!state.user) {
    alert("You must be logged in.");
    return;
  }

  if (!state.selectedApplication) {
    alert("Please select an application.");
    return;
  }

  const payload = buildGenerationPayload(overrides);

  if (!payload.emailType || !payload.tone) {
    alert("Please choose an email type and tone.");
    return;
  }

  state.lastGenerationPayload = payload;
  showLoading();

  try {
    const result = await callAiDraft(payload);
    generatedSubject.value = result.subject || "";
    generatedBody.value = result.body || "";
    showDraft();
  } catch (error) {
    console.error("AI generation failed, using fallback:", error);
    const fallback = getFallbackDraft(payload);
    generatedSubject.value = fallback.subject;
    generatedBody.value = fallback.body;
    showDraft();
  }
}

async function saveDraft() {
  if (!generatedSubject.value.trim() && !generatedBody.value.trim()) {
    alert("There is no generated draft to save.");
    return;
  }

  try {
    await addDoc(getDraftsRef(), {
      subject: generatedSubject.value.trim(),
      body: generatedBody.value.trim(),
      company: state.selectedApplication?.company || "",
      applicationId: state.selectedApplication?.id || "",
      emailType: normalizeEmailType(emailType.value || ""),
      tone: normalizeTone(toneSelect.value || ""),
      createdAt: serverTimestamp()
    });

    await loadSavedDrafts();
    alert("Draft saved.");
  } catch (error) {
    console.error("Error saving draft:", error);
    alert("Could not save draft.");
  }
}

async function copyText(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
    alert(successMessage);
  } catch (error) {
    console.error("Copy failed:", error);
    alert("Could not copy to clipboard.");
  }
}

function bindEvents() {
  refreshApplicationsBtn?.addEventListener("click", loadApplications);

  applicationSelect?.addEventListener("change", () => {
    const selectedId = applicationSelect.value;
    state.selectedApplication =
      state.applications.find((app) => app.id === selectedId) || null;

    updateApplicationPreview();
    updateTopSummary();
  });

  emailType?.addEventListener("change", updateTopSummary);
  toneSelect?.addEventListener("change", updateTopSummary);

  clearFormBtn?.addEventListener("click", () => {
    emailGeneratorForm.reset();
    state.selectedApplication = null;
    applicationSelect.value = "";
    resetApplicationPreview();
    updateTopSummary();
    showEmpty();
  });

  emailGeneratorForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await generateDraft();
  });

  saveDraftBtn?.addEventListener("click", saveDraft);

  copySubjectBtn?.addEventListener("click", () => {
    copyText(generatedSubject.value, "Subject copied.");
  });

  copyBodyBtn?.addEventListener("click", () => {
    copyText(generatedBody.value, "Email copied.");
  });

  shorterBtn?.addEventListener("click", async () => {
    if (!state.lastGenerationPayload) return;

    const currentContext = sanitizeFreeText(extraContext.value, 1000);
    const appended = `${currentContext}\nPlease make it shorter and tighter.`.trim();

    await generateDraft({
      extraContext: appended
    });
  });

  warmerBtn?.addEventListener("click", async () => {
    if (!state.lastGenerationPayload) return;
    await generateDraft({ tone: "friendly" });
  });

  strongerBtn?.addEventListener("click", async () => {
    if (!state.lastGenerationPayload) return;
    await generateDraft({ tone: "confident" });
  });

  regenerateBtn?.addEventListener("click", async () => {
    if (!state.lastGenerationPayload) return;
    await generateDraft();
  });
}

async function init() {
  bindEvents();
  state.user = await waitForUser();
  showEmpty();
  updateTopSummary();
  await loadApplications();
  await loadSavedDrafts();
}

init().catch((error) => {
  console.error("Email generator init failed:", error);
  alert("Could not load email generator.");
});