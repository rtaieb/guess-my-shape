import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyAyaj_bYnXgpl_igOXrFU3pH93wGqux4TU",
  authDomain: "guess-my-shape.firebaseapp.com",
  projectId: "guess-my-shape",
  storageBucket: "guess-my-shape.firebasestorage.app",
  messagingSenderId: "211023899652",
  appId: "1:211023899652:web:4a48882fc421b468e99951",
  databaseURL: "https://guess-my-shape-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);

const db = getDatabase(app);

// Use emulator if in development
// if (import.meta.env.DEV) {
//   connectDatabaseEmulator(db, 'localhost', 19000);
// }

export { db };
