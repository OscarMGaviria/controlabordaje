import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/**
 * Obtiene el rol de un usuario a partir del correo.
 * @param {string} email - Correo electrónico del usuario.
 * @returns {Promise<string>} - 'admin' | 'operador'
 */
export async function getUserRole(email) {
  try {
    const userQuery = query(collection(db, 'users'), where('email', '==', email));
    const snapshot = await getDocs(userQuery);

    if (!snapshot.empty) {
      const userData = snapshot.docs[0].data();
      return userData.rol || 'operador';
    }

    return 'operador';
  } catch (_) {
    return 'operador'; // Rol por defecto en caso de error
  }
}
