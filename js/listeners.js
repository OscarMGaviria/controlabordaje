import { db } from './firebaseConfig.js';
import { collection, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let unsubscribeListener = null;

/**
 * Escucha los cambios en la colección de embarcaciones activas.
 * @param {function(Object):void} onData - Callback que recibe los datos agrupados por categoría.
 * @param {function(Error):void} onError - Callback para manejo de errores.
 */
export function listenToEmbarcaciones(onData, onError) {
  try {
    const q = query(collection(db, 'embarcaciones'), where('activa', '==', true));
    unsubscribeListener = onSnapshot(
      q,
      (querySnapshot) => {
        const data = {};
        querySnapshot.forEach((doc) => {
          const emb = doc.data();
          if (!data[emb.categoria]) data[emb.categoria] = [];
          data[emb.categoria].push({ id: doc.id, ...emb });
        });
        Object.keys(data).forEach(cat => {
          data[cat].sort((a, b) => a.posicion - b.posicion);
        });
        onData(data);
      },
      (error) => {
        if (onError) onError(error);
      }
    );
  } catch (error) {
    if (onError) onError(error);
  }
}

/**
 * Detiene el listener activo.
 */
export function stopListener() {
  if (unsubscribeListener) {
    unsubscribeListener();
    unsubscribeListener = null;
  }
}
