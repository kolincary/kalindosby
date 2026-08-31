import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB-17aX7l1KnJt8qYmsjMapneLsWV28Rk8",
  authDomain: "gudang-surabaya.firebaseapp.com",
  projectId: "gudang-surabaya",
  storageBucket: "gudang-surabaya.firebasestorage.app",
  messagingSenderId: "438972524345",
  appId: "1:438972524345:web:71586c71ce3268fed8aae8",
  measurementId: "G-67E7DKLP0S"
};

const app = initializeApp(firebaseConfig);
import { initializeFirestore } from 'firebase/firestore';
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});
