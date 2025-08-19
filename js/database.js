// ===========================
// MÓDULO DE BASE DE DATOS
// ===========================

import { CONFIG } from './config.js';
import { Time, ID } from './utils.js';
import { 
    collection, 
    doc, 
    getDocs, 
    getDoc,
    addDoc, 
    updateDoc, 
    deleteDoc,
    query, 
    where, 
    orderBy,
    onSnapshot,
    writeBatch,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

class DatabaseManager {
    constructor() {
        this.listeners = new Map();
        this.cache = new Map();
    }

    // ===========================
    // EMBARCACIONES
    // ===========================
    
    // Obtener todas las embarcaciones activas
    async getEmbarcaciones() {
        try {
            const embarcacionesRef = collection(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.EMBARCACIONES);
            const q = query(
                embarcacionesRef, 
                where('activa', '==', true),
                /*orderBy('posicion', 'asc')*/
            );
            
            const querySnapshot = await getDocs(q);
            const embarcaciones = {};
            
            querySnapshot.forEach((doc) => {
                const data = { id: doc.id, ...doc.data() };
                const categoria = data.categoria;
                
                if (!embarcaciones[categoria]) {
                    embarcaciones[categoria] = [];
                }
                
                embarcaciones[categoria].push(data);
            });
            
            // Ordenar por posición dentro de cada categoría
            Object.keys(embarcaciones).forEach(categoria => {
                embarcaciones[categoria].sort((a, b) => a.posicion - b.posicion);
            });
            
            return embarcaciones;
            
        } catch (error) {
            console.error('Error obteniendo embarcaciones:', error);
            throw error;
        }
    }

    // Escuchar cambios en embarcaciones en tiempo real
    listenToEmbarcaciones(callback) {
        const embarcacionesRef = collection(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.EMBARCACIONES);
        const q = query(
            embarcacionesRef, 
            where('activa', '==', true),
            //orderBy('posicion', 'asc')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const embarcaciones = {};
            
            querySnapshot.forEach((doc) => {
                const data = { id: doc.id, ...doc.data() };
                const categoria = data.categoria;
                
                if (!embarcaciones[categoria]) {
                    embarcaciones[categoria] = [];
                }
                
                embarcaciones[categoria].push(data);
            });
            
            // Ordenar por posición
            Object.keys(embarcaciones).forEach(categoria => {
                embarcaciones[categoria].sort((a, b) => a.posicion - b.posicion);
            });
            
            callback(embarcaciones);
        }, (error) => {
            console.error('Error en listener de embarcaciones:', error);
            callback(null, error);
        });

        this.listeners.set('embarcaciones', unsubscribe);
        return unsubscribe;
    }

    // Agregar nueva embarcación
    async addEmbarcacion(embarcacionData) {
        try {
            const embarcacionesRef = collection(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.EMBARCACIONES);
            
            const newEmbarcacion = {
                ...embarcacionData,
                activa: true,
                fechaCreacion: serverTimestamp(),
                fechaActualizacion: serverTimestamp()
            };
            
            const docRef = await addDoc(embarcacionesRef, newEmbarcacion);
            
            return {
                success: true,
                id: docRef.id,
                data: newEmbarcacion
            };
            
        } catch (error) {
            console.error('Error agregando embarcación:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Actualizar embarcación
    async updateEmbarcacion(embarcacionId, updates) {
        try {
            const embarcacionRef = doc(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.EMBARCACIONES, embarcacionId);
            
            const updateData = {
                ...updates,
                fechaActualizacion: serverTimestamp()
            };
            
            await updateDoc(embarcacionRef, updateData);
            
            return {
                success: true,
                id: embarcacionId,
                updates: updateData
            };
            
        } catch (error) {
            console.error('Error actualizando embarcación:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Eliminar embarcación (marcar como inactiva)
    async deleteEmbarcacion(embarcacionId) {
        try {
            const embarcacionRef = doc(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.EMBARCACIONES, embarcacionId);
            
            await updateDoc(embarcacionRef, {
                activa: false,
                fechaEliminacion: serverTimestamp(),
                fechaActualizacion: serverTimestamp()
            });
            
            return {
                success: true,
                id: embarcacionId
            };
            
        } catch (error) {
            console.error('Error eliminando embarcación:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Actualizar múltiples embarcaciones (reorganización)
    async updateMultipleEmbarcaciones(updates) {
        try {
            const batch = writeBatch(window.firebaseDB);
            
            updates.forEach(update => {
                const embarcacionRef = doc(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.EMBARCACIONES, update.id);
                batch.update(embarcacionRef, {
                    ...update.data,
                    fechaActualizacion: serverTimestamp()
                });
            });
            
            await batch.commit();
            
            return {
                success: true,
                updatedCount: updates.length
            };
            
        } catch (error) {
            console.error('Error en actualización múltiple:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ===========================
    // ZARPES
    // ===========================
    
    // Registrar zarpe
    async addZarpe(zarpeData) {
        try {
            const zarpeRef = collection(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.ZARPES);
            
            const newZarpe = {
                ...zarpeData,
                fechaHora: serverTimestamp(),
                fechaRegistro: serverTimestamp()
            };
            
            const docRef = await addDoc(zarpeRef, newZarpe);
            
            return {
                success: true,
                id: docRef.id,
                data: newZarpe
            };
            
        } catch (error) {
            console.error('Error registrando zarpe:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Obtener zarpes del día
    async getZarpesToday() {
        try {
            const zarpeRef = collection(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.ZARPES);
            const startOfDay = Time.startOfDay();
            const endOfDay = Time.endOfDay();
            
            const q = query(
                zarpeRef,
                where('fechaHora', '>=', startOfDay),
                where('fechaHora', '<=', endOfDay),
                orderBy('fechaHora', 'desc')
            );
            
            const querySnapshot = await getDocs(q);
            const zarpes = [];
            
            querySnapshot.forEach((doc) => {
                zarpes.push({ id: doc.id, ...doc.data() });
            });
            
            return zarpes;
            
        } catch (error) {
            console.error('Error obteniendo zarpes del día:', error);
            throw error;
        }
    }

    // ===========================
    // RESERVAS
    // ===========================
    
    // Buscar reserva por documento
    async findReservaByDocument(documento) {
        try {
            const reservasRef = collection(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.RESERVAS);
            const startOfDay = Time.startOfDay();
            const endOfDay = Time.endOfDay();
            
            const q = query(
                reservasRef,
                where('DOCUMENTO', '==', Number(documento)),
                where('fecha_hora_salida', '>=', startOfDay),
                where('fecha_hora_salida', '<=', endOfDay)
            );
            
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                return { found: false };
            }
            
            const reservaDoc = querySnapshot.docs[0];
            return {
                found: true,
                id: reservaDoc.id,
                data: reservaDoc.data()
            };
            
        } catch (error) {
            console.error('Error buscando reserva:', error);
            return { found: false, error: error.message };
        }
    }

    // Marcar reserva como usada
    async markReservaAsUsed(reservaId) {
        try {
            const reservaRef = doc(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.RESERVAS, reservaId);
            
            await updateDoc(reservaRef, {
                usado: true,
                fechaUso: serverTimestamp()
            });
            
            return { success: true };
            
        } catch (error) {
            console.error('Error marcando reserva como usada:', error);
            return { success: false, error: error.message };
        }
    }

    // ===========================
    // VENTAS
    // ===========================
    
    // Buscar venta por documento del día
    async findVentaByDocument(documento) {
        try {
            const ventasRef = collection(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.VENTAS);
            const today = Time.now().toISOString().split('T')[0]; // YYYY-MM-DD
            
            const q = query(
                ventasRef,
                where('documento', '==', documento),
                where('fecha', '==', today)
            );
            
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                return { found: false };
            }
            
            const ventaDoc = querySnapshot.docs[0];
            return {
                found: true,
                id: ventaDoc.id,
                data: ventaDoc.data()
            };
            
        } catch (error) {
            console.error('Error buscando venta:', error);
            return { found: false, error: error.message };
        }
    }

    // Actualizar categoría de venta
    async updateVentaCategoria(ventaId, nuevaCategoria, nuevoPrecio) {
        try {
            const ventaRef = doc(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.VENTAS, ventaId);
            
            // Obtener datos actuales para backup
            const ventaDoc = await getDoc(ventaRef);
            const ventaActual = ventaDoc.data();
            
            await updateDoc(ventaRef, {
                embarcacion: nuevaCategoria,
                precio: nuevoPrecio,
                fechaActualizacion: serverTimestamp(),
                // Backup de datos anteriores
                precioAnterior: ventaActual.precio,
                categoriaAnterior: ventaActual.embarcacion
            });
            
            return {
                success: true,
                oldData: {
                    categoria: ventaActual.embarcacion,
                    precio: ventaActual.precio
                },
                newData: {
                    categoria: nuevaCategoria,
                    precio: nuevoPrecio
                }
            };
            
        } catch (error) {
            console.error('Error actualizando venta:', error);
            return { success: false, error: error.message };
        }
    }

    // ===========================
    // UTILIDADES
    // ===========================
    
    // Limpiar listeners
    cleanupListeners() {
        this.listeners.forEach((unsubscribe) => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners.clear();
    }

    // Limpiar cache
    clearCache() {
        this.cache.clear();
    }

    // Verificar conexión
    async testConnection() {
        try {
            const testRef = collection(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.EMBARCACIONES);
            await getDocs(query(testRef, where('activa', '==', true)));
            return true;
        } catch (error) {
            console.error('Error de conexión:', error);
            return false;
        }
    }

    // ===========================
    // ESTADÍSTICAS (SOLO ADMIN)
    // ===========================
    
    // Obtener estadísticas del día
    async getDayStats() {
        try {
            const [embarcaciones, zarpes] = await Promise.all([
                this.getEmbarcaciones(),
                this.getZarpesToday()
            ]);
            
            const stats = {
                totalEmbarcaciones: 0,
                embarcando: 0,
                enTurno: 0,
                suspendidas: 0,
                reservadas: 0,
                totalZarpes: zarpes.length,
                totalPasajeros: 0,
                ingresoTotal: 0
            };
            
            // Contar embarcaciones por estado
            Object.values(embarcaciones).forEach(categoria => {
                categoria.forEach(embarcacion => {
                    stats.totalEmbarcaciones++;
                    switch (embarcacion.estado) {
                        case CONFIG.ESTADOS.EMBARCANDO:
                            stats.embarcando++;
                            break;
                        case CONFIG.ESTADOS.EN_TURNO:
                            stats.enTurno++;
                            break;
                        case CONFIG.ESTADOS.SUSPENDIDO:
                            stats.suspendidas++;
                            break;
                        case CONFIG.ESTADOS.RESERVA:
                            stats.reservadas++;
                            break;
                    }
                });
            });
            
            // Sumar datos de zarpes
            zarpes.forEach(zarpe => {
                stats.totalPasajeros += zarpe.cantidadPasajeros || 0;
                stats.ingresoTotal += zarpe.valorTotal || 0;
            });
            
            return stats;
            
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            throw error;
        }
    }
}

// ===========================
// INSTANCIA GLOBAL
// ===========================
const databaseManager = new DatabaseManager();

// Exportar para uso en otros módulos
export default databaseManager;

// Hacer disponible globalmente
window.Database = databaseManager;