// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB53tYtVXSY_Ik-eKYuI2AtnFFrIW5c_cc",
  authDomain: "sui-hack.firebaseapp.com",
  projectId: "sui-hack",
  storageBucket: "sui-hack.appspot.com",
  messagingSenderId: "216737318541",
  appId: "1:216737318541:web:246096b74e21e283f504c4"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app; 