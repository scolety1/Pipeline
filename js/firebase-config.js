import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBnrnzKWWBo8vRPEue1ZuYec5F7rjYMo3k",
  authDomain: "pipeline-2f422.firebaseapp.com",
  projectId: "pipeline-2f422",
  storageBucket: "pipeline-2f422.firebasestorage.app",
  messagingSenderId: "421485108309",
  appId: "1:421485108309:web:c26a9b1f0d0d3b591c88dc",
  measurementId: "G-NCXE499NX1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };