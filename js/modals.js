import { triggerHapticFeedback } from './utils/haptics.js';
import { db, auth } from './firebaseConfig.js';
import { doc, updateDoc, writeBatch, addDoc, collection } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { TurnoNautico } from './turnoNautico.js';
import { showWhatsAppShareModal, isWhatsAppAvailable } from './whatsappShare.js';

let currentVesselId = null;
let currentVesselData = null;
let selectedStatus = null;
let currentEmbarcacionesData = {};
let currentCategory = null;
let currentUserRole = 'operador';

// Referencias DOM
const statusModal = document.getElementById('statusModal');
const statusModalVesselName = document.getElementById('statusModalVesselName');
const statusModalVesselInfo = document.getElementById('statusModalVesselInfo');
const statusWarning = document.getElementById('statusWarning');
const statusWarningText = document.getElementById('statusWarningText');
const statusBtnConfirmar = document.getElementById('statusBtnConfirmar');
const statusOptions = document.getElementById('statusOptions');

const zarparModal = document.getElementById('zarparModal');
const modalVesselName = document.getElementById('modalVesselName');
const modalVesselInfo = document.getElementById('modalVesselInfo');
const numPersonas = document.getElementById('numPersonas');
const valorViaje = document.getElementById('valorViaje');
const summarySection = document.getElementById('summarySection');
const summaryPersonas = document.getElementById('summaryPersonas');
const summaryValor = document.getElementById('summaryValor');
const summaryValorPersona = document.getElementById('summaryValorPersona');
const btnConfirmar = document.getElementById('btnConfirmar');

const positionModal = document.getElementById('positionModal');
const positionModalVesselName = document.getElementById('positionModalVesselName');
const positionModalVesselInfo = document.getElementById('positionModalVesselInfo');
const nuevaPosicion = document.getElementById('nuevaPosicion');
const positionBtnConfirmar = document.getElementById('positionBtnConfirmar');

// ===========================
// MODAL DE ZARPAR
// ===========================
export function openZarparModal(vesselId, vesselData) {
    currentVesselId = vesselId;
    currentVesselData = vesselData;
    
    modalVesselName.textContent = vesselData.nombre;
    modalVesselInfo.innerHTML = `
        <h3>${vesselData.nombre}</h3>
        <p>Posición ${vesselData.posicion} - ${vesselData.categoria}</p>
    `;
    
    // Limpiar inputs
    numPersonas.value = '';
    valorViaje.value = '';
    summarySection.style.display = 'none';
    btnConfirmar.disabled = true;
    
    zarparModal.style.display = 'flex';
    triggerHapticFeedback('medium');
    
    // Auto focus en el primer input
    setTimeout(() => {
        numPersonas.focus();
    }, 300);
}

export function closeZarparModal() {
    zarparModal.style.display = 'none';
    currentVesselId = null;
    currentVesselData = null;
    triggerHapticFeedback('light');
}

export function updateSummary() {
    const personas = parseInt(numPersonas.value) || 0;
    const valor = parseFloat(valorViaje.value) || 0;
    
    if (personas > 0 && valor > 0) {
        const valorPorPersona = valor / personas;
        
        summaryPersonas.textContent = personas;
        summaryValor.textContent = `${valor.toLocaleString('es-CO')}`;
        summaryValorPersona.textContent = `${Math.round(valorPorPersona).toLocaleString('es-CO')}`;
        
        summarySection.style.display = 'block';
        btnConfirmar.disabled = false;
    } else {
        summarySection.style.display = 'none';
        btnConfirmar.disabled = true;
    }
}

export async function confirmarZarpe() {
    if (!currentVesselId || !currentVesselData) {
        triggerHapticFeedback('error');
        return;
    }

    const personas = parseInt(numPersonas.value);
    const valor = parseFloat(valorViaje.value);

    if (!personas || !valor || personas <= 0 || valor <= 0) {
        triggerHapticFeedback('error');
        alert('Por favor complete todos los campos correctamente');
        return;
    }

    // Preparar datos del zarpe ANTES de cualquier operación Firebase
    const zarpeData = {
        fechaHora: new Date(),
        embarcacion: currentVesselData.nombre,
        posicionDesembarque: currentVesselData.posicion,
        cantidadPasajeros: personas,
        valorTotal: valor,
        categoria: currentVesselData.categoria,
        embarcacionId: currentVesselId,
        valorPorPersona: Math.round(valor / personas),
        administrador: auth.currentUser?.email || 'admin'
    };

    try {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        
        triggerHapticFeedback('heavy');

        // **PASO 1: Intentar guardar en ControlZarpes (con timeout)**
        let zarpeGuardado = false;
        let firebaseError = null;
        
        try {
            // Crear promesa con timeout de 10 segundos
            const saveZarpePromise = addDoc(collection(db, 'ControlZarpes'), zarpeData);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 10000)
            );
            
            await Promise.race([saveZarpePromise, timeoutPromise]);
            zarpeGuardado = true;
            
        } catch (error) {
            firebaseError = error;
            // No hacer throw aquí, continuar con el flujo
        }

        // **PASO 2: Intentar actualizar embarcaciones (con timeout)**
        let embarcacionesActualizadas = false;
        
        if (zarpeGuardado) {
            try {
                const vesselsInCategory = currentEmbarcacionesData[currentCategory] || [];
                const turnoManager = new TurnoNautico(vesselsInCategory);
                const desembarqueExitoso = turnoManager.desembarcar();

                if (desembarqueExitoso) {
                    const listaActualizada = turnoManager.obtenerLista();
                    const batch = writeBatch(db);
                    
                    listaActualizada.forEach(vessel => {
                        const vesselRef = doc(db, 'embarcaciones', vessel.id);
                        batch.update(vesselRef, {
                            estado: vessel.estado,
                            posicion: vessel.posicion,
                            fechaActualizacion: new Date()
                        });
                    });

                    // Timeout también para el batch
                    const batchPromise = batch.commit();
                    const batchTimeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Batch Timeout')), 8000)
                    );
                    
                    await Promise.race([batchPromise, batchTimeoutPromise]);
                    embarcacionesActualizadas = true;
                }
            } catch (batchError) {
                // Error en actualización de embarcaciones, pero zarpe ya está guardado
                firebaseError = batchError;
            }
        }

        // **PASO 3: Mostrar resultado y continuar con WhatsApp**
        triggerHapticFeedback('success');
        closeZarparModal();

        if (zarpeGuardado && embarcacionesActualizadas) {
            // ✅ TODO EXITOSO
            showZarpeSuccessWithWhatsApp(zarpeData, 'success');
        } else if (zarpeGuardado) {
            // ⚠️ ZARPE GUARDADO, PERO ERROR EN EMBARCACIONES
            showZarpeSuccessWithWhatsApp(zarpeData, 'partial', 
                'El zarpe fue registrado exitosamente, pero hubo un problema al actualizar las posiciones de las embarcaciones.');
        } else {
            // ❌ ERROR EN FIREBASE, PERO PERMITIR WHATSAPP
            showZarpeSuccessWithWhatsApp(zarpeData, 'error', 
                'Hubo un problema de conexión con la base de datos. El zarpe no pudo ser registrado automáticamente, pero puedes compartir la información por WhatsApp.');
        }

    } catch (error) {
        // Error inesperado
        triggerHapticFeedback('error');
        closeZarparModal();
        
        // Aún así, permitir compartir por WhatsApp
        showZarpeSuccessWithWhatsApp(zarpeData, 'error', 
            'Error inesperado: ' + error.message + '. Puedes compartir la información por WhatsApp aunque no se haya guardado en el sistema.');
        
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar Zarpe';
    }
}

/**
 * Mostrar modal de éxito/error con opción de compartir por WhatsApp
 * @param {Object} zarpeData - Datos del zarpe
 * @param {string} status - 'success', 'partial', 'error'
 * @param {string} message - Mensaje adicional opcional
 */
function showZarpeSuccessWithWhatsApp(zarpeData, status = 'success', message = '') {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.id = 'zarpeResultModal';
    modalOverlay.style.display = 'flex';
    
    // Configuración según el status
    const statusConfig = {
        success: {
            icon: 'fas fa-check-circle',
            color: '#32CD32',
            title: 'Zarpe Exitoso',
            description: 'Zarpe registrado exitosamente en el sistema'
        },
        partial: {
            icon: 'fas fa-exclamation-triangle',
            color: '#FFA500',
            title: 'Zarpe Parcialmente Exitoso',
            description: message || 'Zarpe registrado con algunas advertencias'
        },
        error: {
            icon: 'fas fa-exclamation-circle',
            color: '#ff6b6b',
            title: 'Error de Conexión',
            description: message || 'Hubo problemas de conexión, pero puedes compartir la información'
        }
    };
    
    const config = statusConfig[status];
    
    modalOverlay.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <div class="modal-header">
                <div class="modal-title" style="color: ${config.color};">
                    <i class="${config.icon}"></i>
                    ${config.title}
                </div>
            </div>
            
            <div class="modal-body">
                <div class="vessel-info" style="background: ${status === 'success' ? 'rgba(50, 205, 50, 0.1)' : status === 'partial' ? 'rgba(255, 165, 0, 0.1)' : 'rgba(255, 107, 107, 0.1)'}; border: 2px solid ${status === 'success' ? 'rgba(50, 205, 50, 0.3)' : status === 'partial' ? 'rgba(255, 165, 0, 0.3)' : 'rgba(255, 107, 107, 0.3)'};">
                    <h3><i class="fas fa-ship"></i> ${zarpeData.embarcacion}</h3>
                    <p>${config.description}</p>
                </div>

                <div class="summary-section">
                    <div class="summary-title">
                        <i class="fas fa-clipboard-check"></i> Información del Zarpe
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-users"></i> Pasajeros:</span>
                        <strong>${zarpeData.cantidadPasajeros}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-dollar-sign"></i> Valor Total:</span>
                        <strong>$${zarpeData.valorTotal.toLocaleString('es-CO')}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-clock"></i> Hora:</span>
                        <strong>${new Date(zarpeData.fechaHora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-user-tie"></i> Operador:</span>
                        <strong>${(zarpeData.administrador || 'Sistema').split('@')[0]}</strong>
                    </div>
                </div>

                ${status === 'error' ? `
                    <div class="warning-message" style="background: rgba(255, 193, 7, 0.2); border-color: rgba(255, 193, 7, 0.5); color: #ffc107;">
                        <i class="fas fa-wifi"></i>
                        Problema de conexión detectado. Verifica tu conexión a internet.
                    </div>
                ` : ''}

                <div class="warning-message" style="background: rgba(37, 211, 102, 0.2); border-color: rgba(37, 211, 102, 0.5); color: #25D366;">
                    <i class="fab fa-whatsapp"></i>
                    ¿Deseas compartir esta información por WhatsApp?
                </div>
            </div>

            <div class="modal-actions">
                <button class="modal-button btn-cancel touch-target" id="zarpeResultContinuar">
                    <i class="fas fa-check"></i> Continuar
                </button>
                <button class="modal-button touch-target" id="zarpeResultWhatsApp" 
                        style="background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: #fff; border-color: #25D366;">
                    <i class="fab fa-whatsapp"></i> Compartir WhatsApp
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalOverlay);
    
    // Event listeners
    const closeModal = () => {
        document.body.removeChild(modalOverlay);
        triggerHapticFeedback('light');
    };
    
    // Continuar sin compartir
    document.getElementById('zarpeResultContinuar').addEventListener('click', closeModal);
    
    // Compartir por WhatsApp
    document.getElementById('zarpeResultWhatsApp').addEventListener('click', () => {
        closeModal();
        
        // Agregar información de status al zarpe data para WhatsApp
        const zarpeDataForWhatsApp = {
            ...zarpeData,
            statusInfo: status === 'error' ? '\n⚠️ *NOTA:* Información generada localmente debido a problemas de conexión.' : ''
        };
        
        showWhatsAppShareModal(zarpeDataForWhatsApp);
    });
    
    // Cerrar modal al hacer clic fuera
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
    
    // Prevenir cierre al hacer clic dentro del modal
    modalOverlay.querySelector('.modal-content').addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Auto-cerrar después de 15 segundos si no hay interacción
    setTimeout(() => {
        if (document.body.contains(modalOverlay)) {
            closeModal();
        }
    }, 15000);
}

// ===========================
// RESTO DE FUNCIONES (sin cambios)
// ===========================
export function openStatusModal(vesselId, vesselData) {
    currentVesselId = vesselId;
    currentVesselData = vesselData;
    selectedStatus = vesselData.estado;
    
    statusModalVesselName.textContent = vesselData.nombre;
    statusModalVesselInfo.innerHTML = `
        <h3>${vesselData.nombre}</h3>
        <p>Posición ${vesselData.posicion} - ${vesselData.categoria}</p>
    `;
    
    setupStatusOptions();
    updateStatusSelection(vesselData.estado);
    
    statusModal.style.display = 'flex';
    triggerHapticFeedback('medium');
}

export function closeStatusModal() {
    statusModal.style.display = 'none';
    currentVesselId = null;
    currentVesselData = null;
    selectedStatus = null;
    statusWarning.style.display = 'none';
    triggerHapticFeedback('light');
}

function setupStatusOptions() {
    const vesselsInCategory = currentEmbarcacionesData[currentCategory] || [];
    const turnoManager = new TurnoNautico(vesselsInCategory);
    
    document.querySelectorAll('.status-option-radio').forEach(radio => {
        radio.classList.remove('selected');
    });

    const enTurnoOption = document.querySelector('[data-status="EN TURNO"]');
    const embarcandoOption = document.querySelector('[data-status="EMBARCANDO"]');
    const suspendidoOption = document.querySelector('[data-status="SUSPENDIDO"]');

    [enTurnoOption, embarcandoOption, suspendidoOption].forEach(option => {
        option.classList.remove('disabled');
    });

    if (currentUserRole === 'admin') {
        hideStatusWarning();
        return;
    }

    const esPrimeroSuspendido = currentVesselData.posicion === 1 && currentVesselData.estado === 'SUSPENDIDO';
    const puedeEmbarcar = turnoManager.puedeEmbarcar(currentVesselData.posicion);

    if (esPrimeroSuspendido) {
        embarcandoOption.classList.add('disabled');
        suspendidoOption.classList.add('disabled');
        showStatusWarning('Esta embarcación está en posición 1 y suspendida. Solo puede cambiar a "EN TURNO".');
    } else if (!puedeEmbarcar && currentVesselData.estado !== 'EMBARCANDO') {
        embarcandoOption.classList.add('disabled');
        const embarcando = vesselsInCategory.filter(e => e.estado === "EMBARCANDO").map(e => e.posicion).sort((a, b) => a - b);
        if (embarcando.length > 0) {
            const ultimaEmbarcando = Math.max(...embarcando);
            showStatusWarning(`Solo las embarcaciones en orden consecutivo pueden embarcar. La próxima posición disponible es ${ultimaEmbarcando + 1}.`);
        } else {
            showStatusWarning('Solo la embarcación en posición 1 puede comenzar a embarcar.');
        }
    } else {
        hideStatusWarning();
    }
}

function updateStatusSelection(status) {
    document.querySelectorAll('.status-option-radio').forEach(radio => {
        radio.classList.remove('selected');
    });

    const radioId = `radio-${status.toLowerCase().replace(' ', '-')}`;
    const radio = document.getElementById(radioId);
    if (radio) {
        radio.classList.add('selected');
    }

    selectedStatus = status;
    statusBtnConfirmar.disabled = status === currentVesselData.estado;
}

function showStatusWarning(message) {
    statusWarningText.textContent = message;
    statusWarning.style.display = 'flex';
}

function hideStatusWarning() {
    statusWarning.style.display = 'none';
}

export async function confirmarCambioEstado() {
    if (!currentVesselId || !currentVesselData || !selectedStatus) {
        triggerHapticFeedback('error');
        return;
    }

    try {
        statusBtnConfirmar.disabled = true;
        statusBtnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
        
        await updateVesselStatus(currentVesselId, selectedStatus);
        closeStatusModal();
        
    } catch (error) {
        triggerHapticFeedback('error');
    } finally {
        statusBtnConfirmar.disabled = false;
        statusBtnConfirmar.innerHTML = '<i class="fas fa-check"></i> Cambiar Estado';
    }
}

export function openPositionModal(vesselId, vesselData) {
    if (currentUserRole !== 'admin') {
        triggerHapticFeedback('error');
        return;
    }

    currentVesselId = vesselId;
    currentVesselData = vesselData;
    
    positionModalVesselName.textContent = vesselData.nombre;
    positionModalVesselInfo.innerHTML = `
        <h3>${vesselData.nombre}</h3>
        <p>Posición actual: ${vesselData.posicion} - ${vesselData.categoria}</p>
    `;
    
    nuevaPosicion.value = vesselData.posicion;
    nuevaPosicion.placeholder = `Actual: ${vesselData.posicion}`;
    
    const vesselsInCategory = currentEmbarcacionesData[currentCategory] || [];
    nuevaPosicion.max = vesselsInCategory.length;
    
    positionBtnConfirmar.disabled = true;
    positionModal.style.display = 'flex';
    triggerHapticFeedback('medium');
    
    setTimeout(() => {
        nuevaPosicion.select();
    }, 300);
}

export function closePositionModal() {
    positionModal.style.display = 'none';
    currentVesselId = null;
    currentVesselData = null;
    triggerHapticFeedback('light');
}

export function updatePositionButton() {
    const nuevaPos = parseInt(nuevaPosicion.value);
    const posicionActual = currentVesselData ? currentVesselData.posicion : 0;
    positionBtnConfirmar.disabled = !nuevaPos || nuevaPos === posicionActual || nuevaPos < 1;
}

export async function cambiarPosicion() {
    if (currentUserRole !== 'admin' || !currentVesselId || !currentVesselData) {
        triggerHapticFeedback('error');
        return;
    }

    const nuevaPos = parseInt(nuevaPosicion.value);
    const vesselsInCategory = currentEmbarcacionesData[currentCategory] || [];
    
    if (!nuevaPos || nuevaPos < 1 || nuevaPos > vesselsInCategory.length) {
        triggerHapticFeedback('error');
        alert(`La posición debe estar entre 1 y ${vesselsInCategory.length}`);
        return;
    }

    if (nuevaPos === currentVesselData.posicion) {
        triggerHapticFeedback('error');
        alert('La embarcación ya está en esa posición');
        return;
    }

    try {
        positionBtnConfirmar.disabled = true;
        positionBtnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reorganizando...';
        
        triggerHapticFeedback('heavy');

        let listaReorganizada = [...vesselsInCategory];
        const vesselIndex = listaReorganizada.findIndex(v => v.id === currentVesselId);
        const vessel = listaReorganizada[vesselIndex];
        
        listaReorganizada.splice(vesselIndex, 1);
        listaReorganizada.splice(nuevaPos - 1, 0, vessel);
        
        listaReorganizada.forEach((v, index) => {
            v.posicion = index + 1;
        });

        const batch = writeBatch(db);
        listaReorganizada.forEach(vesselUpdate => {
            const vesselRef = doc(db, 'embarcaciones', vesselUpdate.id);
            batch.update(vesselRef, {
                posicion: vesselUpdate.posicion,
                fechaActualizacion: new Date()
            });
        });

        await batch.commit();
        triggerHapticFeedback('success');
        closePositionModal();

    } catch (error) {
        triggerHapticFeedback('error');
        alert('Error al cambiar la posición: ' + error.message);
    } finally {
        positionBtnConfirmar.disabled = false;
        positionBtnConfirmar.innerHTML = '<i class="fas fa-check"></i> Cambiar Posición';
    }
}

async function updateVesselStatus(vesselId, newStatus) {
    try {
        if (!currentCategory) {
            triggerHapticFeedback('error');
            alert('No hay categoría seleccionada');
            return;
        }

        const vesselsInCategory = currentEmbarcacionesData[currentCategory] || [];
        const vessel = vesselsInCategory.find(v => v.id === vesselId);
        
        if (!vessel) {
            triggerHapticFeedback('error');
            alert('Embarcación no encontrada');
            return;
        }

        const esPrimeroSuspendido = vessel.posicion === 1 && vessel.estado === 'SUSPENDIDO';
        
        if (esPrimeroSuspendido && newStatus === 'EN TURNO') {
            const turnoManager = new TurnoNautico(vesselsInCategory);
            const reactivacionExitosa = turnoManager.reactivarPrimero();
            
            if (!reactivacionExitosa) {
                triggerHapticFeedback('error');
                alert('No se pudo reactivar la embarcación');
                return;
            }

            const listaActualizada = turnoManager.obtenerLista();
            const batch = writeBatch(db);
            
            listaActualizada.forEach(vesselUpdate => {
                const vesselRef = doc(db, 'embarcaciones', vesselUpdate.id);
                batch.update(vesselRef, {
                    estado: vesselUpdate.estado,
                    posicion: vesselUpdate.posicion,
                    fechaActualizacion: new Date()
                });
            });

            await batch.commit();
            triggerHapticFeedback('success');
            return;
        }

        if (newStatus === 'EMBARCANDO' && currentUserRole !== 'admin') {
            const turnoManager = new TurnoNautico(vesselsInCategory);
            if (!turnoManager.puedeEmbarcar(vessel.posicion)) {
                triggerHapticFeedback('error');
                
                const embarcando = vesselsInCategory.filter(e => e.estado === "EMBARCANDO").map(e => e.posicion).sort((a, b) => a - b);
                let mensaje = '';
                
                if (embarcando.length === 0) {
                    mensaje = 'Solo la embarcación en posición 1 puede comenzar a embarcar.';
                } else {
                    const ultimaEmbarcando = Math.max(...embarcando);
                    mensaje = `Las embarcaciones deben embarcar en orden consecutivo. La próxima posición disponible es ${ultimaEmbarcando + 1}.`;
                }
                
                alert(mensaje);
                return;
            }
        }

        triggerHapticFeedback('medium');
        
        const vesselRef = doc(db, 'embarcaciones', vesselId);
        await updateDoc(vesselRef, {
            estado: newStatus,
            fechaActualizacion: new Date()
        });
        
        triggerHapticFeedback('success');
        
    } catch (error) {
        triggerHapticFeedback('error');
        alert('Error al actualizar el estado: ' + error.message);
    }
}

export function initializeModals(embarcacionesData, category, userRole) {
    currentEmbarcacionesData = embarcacionesData;
    currentCategory = category;
    currentUserRole = userRole;
    
    document.getElementById('statusModalClose')?.addEventListener('click', closeStatusModal);
    document.getElementById('statusBtnCancelar')?.addEventListener('click', closeStatusModal);
    document.getElementById('statusBtnConfirmar')?.addEventListener('click', confirmarCambioEstado);

    document.getElementById('modalClose')?.addEventListener('click', closeZarparModal);
    document.getElementById('btnCancelar')?.addEventListener('click', closeZarparModal);
    document.getElementById('btnConfirmar')?.addEventListener('click', confirmarZarpe);

    document.getElementById('positionModalClose')?.addEventListener('click', closePositionModal);
    document.getElementById('positionBtnCancelar')?.addEventListener('click', closePositionModal);
    document.getElementById('positionBtnConfirmar')?.addEventListener('click', cambiarPosicion);

    numPersonas?.addEventListener('input', updateSummary);
    valorViaje?.addEventListener('input', updateSummary);
    nuevaPosicion?.addEventListener('input', updatePositionButton);

    statusOptions?.addEventListener('click', (e) => {
        const option = e.target.closest('.status-option');
        
        if (option) {
            if (option.classList.contains('disabled')) {
                triggerHapticFeedback('error');
                return;
            }
            
            const status = option.getAttribute('data-status');
            updateStatusSelection(status);
            triggerHapticFeedback('light');
        }
    });

    statusModal?.addEventListener('click', (e) => {
        if (e.target === statusModal) {
            closeStatusModal();
        }
    });

    positionModal?.addEventListener('click', (e) => {
        if (e.target === positionModal) {
            closePositionModal();
        }
    });

    zarparModal?.addEventListener('click', (e) => {
        if (e.target === zarparModal) {
            closeZarparModal();
        }
    });

    document.querySelectorAll('.modal-content').forEach(modal => {
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (statusModal.style.display === 'flex') {
                closeStatusModal();
            } else if (positionModal.style.display === 'flex') {
                closePositionModal();
            } else if (zarparModal.style.display === 'flex') {
                closeZarparModal();
            }
        }
    });

    numPersonas?.addEventListener('input', (e) => {
        let value = parseInt(e.target.value);
        if (value < 1) e.target.value = '';
        if (value > 50) e.target.value = 50;
    });

    valorViaje?.addEventListener('input', (e) => {
        let value = parseFloat(e.target.value);
        if (value < 0) e.target.value = '';
        if (value > 10000000) e.target.value = 10000000;
    });

    valorViaje?.addEventListener('blur', (e) => {
        const value = parseFloat(e.target.value);
        if (value) {
            e.target.value = Math.round(value);
        }
    });
}