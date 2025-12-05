// --- IMPORT THE TOOLS (These lines were missing) ---
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAnMj1SF9MhHtMYv2T0qxnBJ7skeKUrCKA",
  authDomain: "sas-caf-app.firebaseapp.com",
  projectId: "sas-caf-app",
  storageBucket: "sas-caf-app.firebasestorage.app",
  messagingSenderId: "1028126361448",
  appId: "1:1028126361448:web:476d98acf3492d7678b8dd",
  measurementId: "G-MCPCCWTDJ2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);