import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const showLoginBtn = document.getElementById("showLoginBtn");
const showSignupBtn = document.getElementById("showSignupBtn");
const submitBtn = document.getElementById("submitBtn");
const authForm = document.getElementById("authForm");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const authMessage = document.getElementById("authMessage");

const nameGroup = document.getElementById("nameGroup");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

let mode = "login";
let authBusy = false;

function setMessage(message, isSuccess = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("success", isSuccess);
}

function setMode(newMode) {
  mode = newMode;

  const isSignup = mode === "signup";

  nameGroup.style.display = isSignup ? "grid" : "none";
  submitBtn.textContent = isSignup ? "Create Account" : "Log In";

  showSignupBtn.classList.toggle("active", isSignup);
  showLoginBtn.classList.toggle("active", !isSignup);

  setMessage("");
}

function setBusyState(isBusy) {
  authBusy = isBusy;
  submitBtn.disabled = isBusy;
  forgotPasswordBtn.disabled = isBusy;

  if (isBusy) {
    submitBtn.textContent = mode === "signup" ? "Creating Account..." : "Logging In...";
    return;
  }

  submitBtn.textContent = mode === "signup" ? "Create Account" : "Log In";
}

function getFormValues() {
  return {
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    password: passwordInput.value.trim()
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getFriendlyAuthMessage(errorCode, currentMode) {
  switch (errorCode) {
    case "auth/email-already-in-use":
      return "That email is already in use.";
    case "auth/invalid-email":
      return "That email address is invalid.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return currentMode === "login"
        ? "Incorrect email or password."
        : "Could not create the account with those credentials.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a bit and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/missing-password":
      return "Please enter your password.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function getFriendlyResetMessage(errorCode) {
  switch (errorCode) {
    case "auth/invalid-email":
      return "That email address is invalid.";
    case "auth/user-not-found":
      return "No account found with that email.";
    case "auth/too-many-requests":
      return "Too many reset attempts. Please wait a bit.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Could not send reset email. Please try again.";
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.replace("dashboard.html");
  }
});

showLoginBtn?.addEventListener("click", () => setMode("login"));
showSignupBtn?.addEventListener("click", () => setMode("signup"));

const params = new URLSearchParams(window.location.search);
const urlMode = params.get("mode");

if (urlMode === "signup") {
  setMode("signup");
}

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (authBusy) return;

  const { name, email, password } = getFormValues();

  if (!email || !password) {
    setMessage("Please enter your email and password.");
    return;
  }

  if (!isValidEmail(email)) {
    setMessage("Please enter a valid email address.");
    return;
  }

  if (mode === "signup" && !name) {
    setMessage("Please enter your full name.");
    return;
  }

  if (password.length < 6) {
    setMessage("Password must be at least 6 characters.");
    return;
  }

  setBusyState(true);
  setMessage("");

  try {
    if (mode === "signup") {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      try {
        await updateProfile(user, {
          displayName: name
        });
      } catch (profileError) {
        console.error("Could not update display name:", profileError);
      }

      await setDoc(doc(db, "users", user.uid), {
        name,
        email,
        createdAt: serverTimestamp()
      });

      setMessage("Account created successfully.", true);
      window.location.replace("dashboard.html");
      return;
    }

    await signInWithEmailAndPassword(auth, email, password);
    setMessage("Logged in successfully.", true);
    window.location.replace("dashboard.html");
  } catch (error) {
    console.error("Authentication failed:", error);
    setMessage(getFriendlyAuthMessage(error?.code, mode));
  } finally {
    setBusyState(false);
  }
});

forgotPasswordBtn?.addEventListener("click", async () => {
  if (authBusy) return;

  const email = emailInput.value.trim();

  if (!email) {
    setMessage("Enter your email first.");
    return;
  }

  if (!isValidEmail(email)) {
    setMessage("Please enter a valid email address.");
    return;
  }

  forgotPasswordBtn.disabled = true;
  setMessage("");

  try {
    await sendPasswordResetEmail(auth, email);
    setMessage("Password reset email sent.", true);
  } catch (error) {
    console.error("Password reset failed:", error);
    setMessage(getFriendlyResetMessage(error?.code));
  } finally {
    forgotPasswordBtn.disabled = false;
  }
});