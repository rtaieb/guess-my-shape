import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

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

async function test() {
  try {
    const r = await get(ref(db, 'rooms/TEST'));
    console.log("SUCCESS! DB connected.", r.val());
    process.exit(0);
  } catch (e) {
    console.error("FAIL", e);
    process.exit(1);
  }
}
test();
