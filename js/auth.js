import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// Elements
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

// ---------------- UI HELPERS ----------------

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

function getFormValues() {
  return {
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    password: passwordInput.value.trim()
  };
}

// ---------------- AUTH STATE ----------------

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.replace("dashboard.html");
  }
});

// ---------------- MODE SWITCH ----------------

showLoginBtn.addEventListener("click", () => setMode("login"));
showSignupBtn.addEventListener("click", () => setMode("signup"));

// ---------------- URL MODE SUPPORT ----------------
// allows: login.html?mode=signup

const params = new URLSearchParams(window.location.search);
const urlMode = params.get("mode");

if (urlMode === "signup") {
  setMode("signup");
}

// ---------------- FORM SUBMIT ----------------

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const { name, email, password } = getFormValues();

  if (!email || !password) {
    setMessage("Please enter your email and password.");
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

  submitBtn.disabled = true;
  submitBtn.textContent =
    mode === "signup" ? "Creating Account..." : "Logging In...";

  try {
    if (mode === "signup") {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        name,
        email,
        createdAt: serverTimestamp()
      });

      setMessage("Account created successfully.", true);
      window.location.replace("dashboard.html");
    } else {
      await signInWithEmailAndPassword(auth, email, password);

      setMessage("Logged in successfully.", true);
      window.location.replace("dashboard.html");
    }
  } catch (error) {
    let friendlyMessage = "Something went wrong. Please try again.";

    switch (error.code) {
      case "auth/email-already-in-use":
        friendlyMessage = "That email is already in use.";
        break;
      case "auth/invalid-email":
        friendlyMessage = "That email address is invalid.";
        break;
      case "auth/weak-password":
        friendlyMessage = "Password should be at least 6 characters.";
        break;
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        friendlyMessage = "Incorrect email or password.";
        break;
      case "auth/too-many-requests":
        friendlyMessage = "Too many attempts. Please wait a bit.";
        break;
      default:
        friendlyMessage = error.message;
        break;
    }

    setMessage(friendlyMessage);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent =
      mode === "signup" ? "Create Account" : "Log In";
  }
});

// ---------------- RESET PASSWORD ----------------

forgotPasswordBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();

  if (!email) {
    setMessage("Enter your email first.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    setMessage("Password reset email sent.", true);
  } catch (error) {
    let friendlyMessage = "Could not send reset email.";

    switch (error.code) {
      case "auth/invalid-email":
        friendlyMessage = "That email address is invalid.";
        break;
      case "auth/user-not-found":
        friendlyMessage = "No account found with that email.";
        break;
      default:
        friendlyMessage = error.message;
        break;
    }

    setMessage(friendlyMessage);
  }
});