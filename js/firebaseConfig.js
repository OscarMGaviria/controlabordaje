import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDdjYoi4BSBFFAuXumLxj-NMQWUVSFdSv4",
  authDomain: "contratos-5e932.firebaseapp.com",
  projectId: "contratos-5e932",
  storageBucket: "contratos-5e932.firebasestorage.app", 
  messagingSenderId: "945849105278",
  appId: "1:945849105278:web:f0291a411b8e33327a112f"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };