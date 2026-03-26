import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

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

// =========================
// State
// =========================
let currentUser = null;
let applications = [];
let selectedApplication = null;
let lastGenerationPayload = null;

// Change this when your backend is ready.
// Example Firebase Function URL:
// const AI_ENDPOINT = "https://us-central1-your-project.cloudfunctions.net/generateEmailDraft";
const AI_ENDPOINT = "https://generateemaildraft-pii55d2nha-uc.a.run.app";
console.log("AI_ENDPOINT:", AI_ENDPOINT);

// =========================
// Auth
// =========================

logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Logout error:", error);
    alert("Could not log out. Please try again.");
  }
});

// =========================
// Load Applications
// =========================
async function loadApplications() {
  if (!currentUser) return;

  applicationSelect.innerHTML = `<option value="">Select an application</option>`;
  applications = [];
  resetApplicationPreview();

  try {
    const appsRef = collection(db, "users", currentUser.uid, "applications");
    const snapshot = await getDocs(appsRef);

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const appData = {
        id: docSnap.id,
        ...data
      };

      applications.push(appData);

      const option = document.createElement("option");
      option.value = docSnap.id;
      option.textContent = `${data.company || "Unknown Company"} — ${data.role || "Unknown Role"}`;
      applicationSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading applications:", error);
    alert("Could not load applications.");
  }
}

refreshApplicationsBtn?.addEventListener("click", async () => {
  await loadApplications();
});

applicationSelect?.addEventListener("change", () => {
  const selectedId = applicationSelect.value;
  selectedApplication = applications.find((app) => app.id === selectedId) || null;
  updateApplicationPreview();
  updateTopSummary();
});

emailType?.addEventListener("change", updateTopSummary);
toneSelect?.addEventListener("change", updateTopSummary);

// =========================
// Preview + Summary
// =========================
function resetApplicationPreview() {
  previewCompany.textContent = "—";
  previewRole.textContent = "—";
  previewContact.textContent = "—";
  previewStatus.textContent = "—";
  previewNotes.textContent = "No notes yet.";

  selectedCompanyPreview.textContent = "—";
}

function updateApplicationPreview() {
  if (!selectedApplication) {
    resetApplicationPreview();
    return;
  }

  previewCompany.textContent = selectedApplication.company || "—";
  previewRole.textContent = selectedApplication.role || "—";

  const contactName = selectedApplication.contactName?.trim();
  const contactEmail = selectedApplication.contactEmail?.trim();
  previewContact.textContent =
    contactName || contactEmail
      ? [contactName, contactEmail].filter(Boolean).join(" • ")
      : "—";

  previewStatus.textContent = selectedApplication.status || "—";
  previewNotes.textContent = selectedApplication.notes || "No notes yet.";

  selectedCompanyPreview.textContent = selectedApplication.company || "—";
}

function updateTopSummary() {
  selectedDraftTypePreview.textContent =
    emailType.options[emailType.selectedIndex]?.text || "—";

  selectedTonePreview.textContent =
    toneSelect.options[toneSelect.selectedIndex]?.text || "—";

  selectedCompanyPreview.textContent =
    selectedApplication?.company || "—";
}

// =========================
// Form Actions
// =========================
clearFormBtn?.addEventListener("click", () => {
  emailGeneratorForm.reset();
  selectedApplication = null;
  applicationSelect.value = "";
  resetApplicationPreview();
  updateTopSummary();
});

emailGeneratorForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    alert("You must be logged in.");
    return;
  }

  if (!selectedApplication) {
    alert("Please select an application.");
    return;
  }

  if (!emailType.value || !toneSelect.value) {
    alert("Please choose an email type and tone.");
    return;
  }

  const payload = buildGenerationPayload();
  lastGenerationPayload = payload;

  try {
    setLoading(true);

    const result = await generateDraftWithAI(payload);

    if (!result?.subject || !result?.body) {
      throw new Error("Invalid AI response.");
    }

    generatedSubject.value = result.subject;
    generatedBody.value = result.body;

    showDraftOutput();
  } catch (error) {
    console.error("Draft generation error:", error);
    alert("Could not generate draft. Check your backend connection.");
    showEmptyState();
  } finally {
    setLoading(false);
  }
});

function buildGenerationPayload() {
  return {
    applicationId: selectedApplication.id,
    company: selectedApplication.company || "",
    role: selectedApplication.role || "",
    status: selectedApplication.status || "",
    contactName: selectedApplication.contactName || "",
    contactEmail: selectedApplication.contactEmail || "",
    notes: selectedApplication.notes || "",
    emailType: emailType.value,
    tone: toneSelect.value,
    extraContext: extraContext.value.trim(),
    customGoal: customGoal.value.trim()
  };
}

// =========================
// AI Request
// =========================
async function generateDraftWithAI(payload, revisionInstruction = "") {
  if (!AI_ENDPOINT || AI_ENDPOINT === "YOUR_BACKEND_ENDPOINT") {
    throw new Error("AI endpoint not configured.");
  }

  const token = await currentUser.getIdToken();

  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      ...payload,
      revisionInstruction
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return {
    subject: data.subject || "",
    body: data.body || ""
  };
}

// =========================
// Draft UI States
// =========================
function setLoading(isLoading) {
  if (isLoading) {
    loadingState.classList.remove("hidden");
    emptyState.classList.add("hidden");
    draftOutput.classList.add("hidden");
    return;
  }

  loadingState.classList.add("hidden");
}

function showDraftOutput() {
  emptyState.classList.add("hidden");
  draftOutput.classList.remove("hidden");
}

function showEmptyState() {
  draftOutput.classList.add("hidden");
  emptyState.classList.remove("hidden");
}

// =========================
// Copy Actions
// =========================
copySubjectBtn?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(generatedSubject.value || "");
    copySubjectBtn.textContent = "Copied!";
    setTimeout(() => {
      copySubjectBtn.textContent = "Copy Subject";
    }, 1200);
  } catch (error) {
    console.error("Copy subject error:", error);
    alert("Could not copy subject.");
  }
});

copyBodyBtn?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(generatedBody.value || "");
    copyBodyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBodyBtn.textContent = "Copy Email";
    }, 1200);
  } catch (error) {
    console.error("Copy body error:", error);
    alert("Could not copy email.");
  }
});

// =========================
// Save Draft
// =========================
saveDraftBtn?.addEventListener("click", async () => {
  if (!currentUser || !selectedApplication) {
    alert("Missing user or application.");
    return;
  }

  const subject = generatedSubject.value.trim();
  const body = generatedBody.value.trim();

  if (!subject || !body) {
    alert("There is no draft to save.");
    return;
  }

  try {
    const draftsRef = collection(
      db,
      "users",
      currentUser.uid,
      "applications",
      selectedApplication.id,
      "generatedEmails"
    );

    await addDoc(draftsRef, {
      subject,
      body,
      emailType: emailType.value,
      tone: toneSelect.value,
      extraContext: extraContext.value.trim(),
      customGoal: customGoal.value.trim(),
      company: selectedApplication.company || "",
      role: selectedApplication.role || "",
      createdAt: serverTimestamp()
    });

    await loadSavedDrafts();
    alert("Draft saved.");
  } catch (error) {
    console.error("Save draft error:", error);
    alert("Could not save draft.");
  }
});

// =========================
// Recent Saved Drafts
// =========================
async function loadSavedDrafts() {
  if (!currentUser) return;

  savedDraftsList.innerHTML = `<div class="saved-draft-empty">No saved drafts yet.</div>`;

  try {
    const appsRef = collection(db, "users", currentUser.uid, "applications");
    const appsSnapshot = await getDocs(appsRef);

    const allDrafts = [];

    for (const appDoc of appsSnapshot.docs) {
      const draftsRef = collection(
        db,
        "users",
        currentUser.uid,
        "applications",
        appDoc.id,
        "generatedEmails"
      );

      const draftsQuery = query(draftsRef, orderBy("createdAt", "desc"), limit(3));
      const draftsSnapshot = await getDocs(draftsQuery);

      draftsSnapshot.forEach((draftDoc) => {
        const data = draftDoc.data();
        allDrafts.push({
          id: draftDoc.id,
          applicationId: appDoc.id,
          ...data
        });
      });
    }

    allDrafts.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });

    const latestDrafts = allDrafts.slice(0, 5);

    if (!latestDrafts.length) {
      return;
    }

    savedDraftsList.innerHTML = "";

    latestDrafts.forEach((draft) => {
      const item = document.createElement("div");
      item.className = "saved-draft-card";
      item.innerHTML = `
        <div class="saved-draft-card-top">
          <strong>${escapeHtml(draft.subject || "Untitled Draft")}</strong>
          <span>${escapeHtml(formatDraftMeta(draft))}</span>
        </div>
        <p>${escapeHtml(truncateText(draft.body || "", 180))}</p>
      `;

      item.addEventListener("click", () => {
        generatedSubject.value = draft.subject || "";
        generatedBody.value = draft.body || "";
        showDraftOutput();
      });

      savedDraftsList.appendChild(item);
    });
  } catch (error) {
    console.error("Load saved drafts error:", error);
  }
}

function formatDraftMeta(draft) {
  const parts = [];
  if (draft.company) parts.push(draft.company);
  if (draft.emailType) parts.push(draft.emailType);
  if (draft.tone) parts.push(draft.tone);
  return parts.join(" • ");
}

// =========================
// Quick Revision Buttons
// =========================
shorterBtn?.addEventListener("click", async () => {
  await reviseDraft("Make this email shorter while keeping the same purpose and tone.");
});

warmerBtn?.addEventListener("click", async () => {
  await reviseDraft("Make this email warmer and slightly more personable.");
});

strongerBtn?.addEventListener("click", async () => {
  await reviseDraft("Make this email more confident and direct, while staying professional.");
});

regenerateBtn?.addEventListener("click", async () => {
  await reviseDraft("Regenerate this email from scratch using the same context, but write a fresh version.");
});

async function reviseDraft(instruction) {
  if (!lastGenerationPayload) {
    alert("Generate a draft first.");
    return;
  }

  try {
    setLoading(true);

    const payload = {
      ...lastGenerationPayload,
      currentSubject: generatedSubject.value.trim(),
      currentBody: generatedBody.value.trim()
    };

    const result = await generateDraftWithAI(payload, instruction);

    if (!result?.subject || !result?.body) {
      throw new Error("Invalid revision response.");
    }

    generatedSubject.value = result.subject;
    generatedBody.value = result.body;
    showDraftOutput();
  } catch (error) {
    console.error("Revise draft error:", error);
    alert("Could not revise draft.");
  } finally {
    setLoading(false);
  }
}

// =========================
// Helpers
// =========================
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}