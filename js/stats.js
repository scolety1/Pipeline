import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy
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

const statTotalEl = document.getElementById("statTotal");
const statActiveEl = document.getElementById("statActive");
const statResponseRateEl = document.getElementById("statResponseRate");
const statOfferRateEl = document.getElementById("statOfferRate");

const countNeedToApplyEl = document.getElementById("countNeedToApply");
const countAppliedEl = document.getElementById("countApplied");
const countFollowUpEl = document.getElementById("countFollowUp");
const countInterviewingEl = document.getElementById("countInterviewing");
const countOfferEl = document.getElementById("countOffer");
const countArchivedEl = document.getElementById("countArchived");

const insightFollowUpsDueEl = document.getElementById("insightFollowUpsDue");
const insightInterviewRateEl = document.getElementById("insightInterviewRate");
const insightArchivedRateEl = document.getElementById("insightArchivedRate");
const insightHighPriorityEl = document.getElementById("insightHighPriority");
const bestNextMoveEl = document.getElementById("bestNextMove");

const topCompaniesListEl = document.getElementById("topCompaniesList");
const recentApplicationsListEl = document.getElementById("recentApplicationsList");

let currentUser = null;
let applications = [];

function normalizeStatus(status) {
  if (status === "heard_back") return "follow_up";

  const validStatuses = [
    "need_to_apply",
    "applied",
    "follow_up",
    "interviewing",
    "offer",
    "archived"
  ];

  return validStatuses.includes(status) ? status : "need_to_apply";
}

function normalizeOfferResponse(value) {
  const validResponses = ["yes", "maybe", "no"];
  return validResponses.includes(value) ? value : "maybe";
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getFollowUpState(nextFollowUp) {
  if (!nextFollowUp) return "none";

  const today = getTodayString();

  if (nextFollowUp < today) return "overdue";
  if (nextFollowUp === today) return "due";
  return "upcoming";
}

function getFollowUpsDueCount() {
  return applications.filter((app) => {
    if (app.status === "archived") return false;
    const state = getFollowUpState(app.nextFollowUp);
    return state === "overdue" || state === "due";
  }).length;
}

function formatPercent(part, whole) {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function renderTopCompanies(companyMap) {
  const companies = Object.entries(companyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!companies.length) {
    topCompaniesListEl.innerHTML = `
      <div class="empty-state">
        <p>No company data yet.</p>
      </div>
    `;
    return;
  }

  topCompaniesListEl.innerHTML = companies
    .map(([company, count]) => `
      <div class="form-row">
        <div class="form-group">
          <label>Company</label>
          <input type="text" value="${escapeHtml(company)}" readonly />
        </div>
        <div class="form-group">
          <label>Applications</label>
          <input type="text" value="${count}" readonly />
        </div>
      </div>
    `)
    .join("");
}

function renderRecentApplications() {
  const recent = [...applications].slice(0, 5);

  if (!recent.length) {
    recentApplicationsListEl.innerHTML = `
      <div class="empty-state">
        <p>No applications yet.</p>
      </div>
    `;
    return;
  }

  recentApplicationsListEl.innerHTML = recent
    .map((app) => {
      const company = app.company || "Untitled Company";
      const title = app.title || "Untitled Role";
      const status = normalizeStatus(app.status).replaceAll("_", " ");
      const priority = app.priority || "medium";

      return `
        <div class="panel" style="padding: 1rem; box-shadow: none;">
          <div class="section-header" style="margin-bottom: 0.75rem;">
            <h2 style="font-size: 1rem; margin: 0;">${escapeHtml(company)}</h2>
            <p style="margin: 0.35rem 0 0;">${escapeHtml(title)}</p>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Status</label>
              <input type="text" value="${escapeHtml(status)}" readonly />
            </div>
            <div class="form-group">
              <label>Priority</label>
              <input type="text" value="${escapeHtml(priority)}" readonly />
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function determineBestNextMove({
  total,
  needToApply,
  followUpsDue,
  interviewing,
  offers,
  highPriority,
  applied
}) {
  if (total === 0) {
    return "Add your first applications so Pipeline can start tracking momentum.";
  }

  if (followUpsDue > 0) {
    return `You have ${followUpsDue} follow-up${followUpsDue === 1 ? "" : "s"} due. Start there first.`;
  }

  if (needToApply > 0) {
    return `You still have ${needToApply} role${needToApply === 1 ? "" : "s"} in Need to Apply. Knock a few of those out next.`;
  }

  if (interviewing > 0) {
    return `You have ${interviewing} active interview${interviewing === 1 ? "" : "s"}. Focus on prep and follow-through.`;
  }

  if (offers > 0) {
    return `You have ${offers} offer${offers === 1 ? "" : "s"} in play. Time to compare and decide.`;
  }

  if (highPriority > 0) {
    return `You have ${highPriority} high-priority application${highPriority === 1 ? "" : "s"}. Make sure those are moving.`;
  }

  if (applied > 0) {
    return "You have applications out. Your next move is staying consistent with follow-ups and fresh submissions.";
  }

  return "Keep adding opportunities and pushing applications forward.";
}

async function loadUserProfile(user) {
  userEmailEl.textContent = user.email || "";

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      userNameEl.textContent = userData.name || "User";
    } else {
      userNameEl.textContent = "User";
    }
  } catch (error) {
    console.error("Error loading user:", error);
    userNameEl.textContent = "User";
  }
}

function renderStats() {
  const counts = {
    need_to_apply: 0,
    applied: 0,
    follow_up: 0,
    interviewing: 0,
    offer: 0,
    archived: 0
  };

  let activeCount = 0;
  let responseCount = 0;
  let offerCount = 0;
  let highPriorityCount = 0;
  const companyMap = {};

  applications.forEach((app) => {
    const status = normalizeStatus(app.status);
    counts[status] += 1;

    if (status !== "archived") {
      activeCount += 1;
    }

    if (status === "follow_up" || status === "interviewing" || status === "offer") {
      responseCount += 1;
    }

    if (status === "offer") {
      offerCount += 1;
      app.offerResponse = normalizeOfferResponse(app.offerResponse);
    }

    if (app.priority === "high") {
      highPriorityCount += 1;
    }

    const company = (app.company || "").trim();
    if (company) {
      companyMap[company] = (companyMap[company] || 0) + 1;
    }
  });

  const total = applications.length;
  const followUpsDue = getFollowUpsDueCount();
  const responseRate = formatPercent(responseCount, total);
  const offerRate = formatPercent(offerCount, total);
  const interviewRate = formatPercent(counts.interviewing, total);
  const archivedRate = formatPercent(counts.archived, total);

  statTotalEl.textContent = total;
  statActiveEl.textContent = activeCount;
  statResponseRateEl.textContent = responseRate;
  statOfferRateEl.textContent = offerRate;

  countNeedToApplyEl.value = counts.need_to_apply;
  countAppliedEl.value = counts.applied;
  countFollowUpEl.value = counts.follow_up;
  countInterviewingEl.value = counts.interviewing;
  countOfferEl.value = counts.offer;
  countArchivedEl.value = counts.archived;

  insightFollowUpsDueEl.value = followUpsDue;
  insightInterviewRateEl.value = interviewRate;
  insightArchivedRateEl.value = archivedRate;
  insightHighPriorityEl.value = highPriorityCount;

  bestNextMoveEl.value = determineBestNextMove({
    total,
    needToApply: counts.need_to_apply,
    followUpsDue,
    interviewing: counts.interviewing,
    offers: counts.offer,
    highPriority: highPriorityCount,
    applied: counts.applied
  });

  renderTopCompanies(companyMap);
  renderRecentApplications();
}

async function loadApplications(user) {
  try {
    const appsRef = collection(db, "users", user.uid, "applications");
    const appsQuery = query(appsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(appsQuery);

    applications = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();

      return {
        id: docSnap.id,
        ...data,
        status: normalizeStatus(data.status),
        offerResponse:
          normalizeStatus(data.status) === "offer"
            ? normalizeOfferResponse(data.offerResponse)
            : ""
      };
    });

    renderStats();
  } catch (error) {
    console.error("Error loading applications:", error);

    try {
      const appsRef = collection(db, "users", user.uid, "applications");
      const snapshot = await getDocs(appsRef);

      applications = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          status: normalizeStatus(data.status),
          offerResponse:
            normalizeStatus(data.status) === "offer"
              ? normalizeOfferResponse(data.offerResponse)
              : ""
        };
      });

      renderStats();
    } catch (fallbackError) {
      console.error("Fallback load failed:", fallbackError);

      topCompaniesListEl.innerHTML = `
        <div class="empty-state">
          <p>Could not load stats right now.</p>
        </div>
      `;

      recentApplicationsListEl.innerHTML = `
        <div class="empty-state">
          <p>Could not load recent applications right now.</p>
        </div>
      `;
    }
  }
}

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    console.error("Logout failed:", error);
    alert("Could not log out. Please try again.");
  }
});