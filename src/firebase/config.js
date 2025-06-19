import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDe8WY7XLyNS6vNjULXhcQls69zoCi2rUs",
  authDomain: "aptosaurs-7e734.firebaseapp.com",
  projectId: "aptosaurs-7e734",
  storageBucket: "aptosaurs-7e734.firebasestorage.app",
  messagingSenderId: "1026312173210",
  appId: "1:1026312173210:web:3d9ffbd17e0aaa059bd123",
  measurementId: "G-5L2V7WYP70"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth }; 