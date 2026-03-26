import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const userNameEl = document.getElementById("userName");
const userEmailEl = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

let currentUser = null;
const readyResolvers = [];

function resolveReady(user) {
  while (readyResolvers.length) {
    const resolve = readyResolvers.shift();
    resolve(user);
  }
}

function getBestUserName(user) {
  const displayName = user?.displayName?.trim();
  if (displayName) return displayName;

  const emailPrefix = user?.email?.split("@")[0]?.trim();
  if (emailPrefix) return emailPrefix;

  return "User";
}

function renderUser(user) {
  if (userNameEl) {
    userNameEl.textContent = getBestUserName(user);
  }

  if (userEmailEl) {
    userEmailEl.textContent = user?.email || "";
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  currentUser = user;
  renderUser(user);
  resolveReady(user);
});

logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Logout failed:", error);
    alert("Could not log out. Please try again.");
  }
});

export function getCurrentUser() {
  return currentUser;
}

export function waitForUser() {
  if (currentUser) return Promise.resolve(currentUser);

  return new Promise((resolve) => {
    readyResolvers.push(resolve);
  });
}