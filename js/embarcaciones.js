import { triggerHapticFeedback } from './utils/haptics.js';
import { db } from './firebaseConfig.js';
import { doc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { TurnoNautico } from './turnoNautico.js';

/**
 * Renderiza las embarcaciones en pantalla por categoría.
 * @param {string} categoria 
 * @param {Object[]} vessels 
 * @param {string} userRole 
 */
export function renderVessels(categoria, vessels, userRole) {
    const vesselsTitle = document.getElementById('vesselsTitle');
    const vesselsContent = document.getElementById('vesselsContent');

    const categoryNames = {
        'lancha-taxi': '<i class="fas fa-ship"></i> Lancha Taxi',
        'deportiva': '<i class="fas fa-water"></i> Deportiva',
        'planchon': '<i class="fas fa-anchor"></i> Planchón',
        'carguero': '<i class="fas fa-shipping-fast"></i> Carguero',
        'barco': '<i class="fas fa-sailboat"></i> Barco',
        'yate': '<i class="fas fa-yacht"></i> Yate'
    };

    vesselsTitle.innerHTML = categoryNames[categoria] || categoria;

    if (!vessels || vessels.length === 0) {
        vesselsContent.innerHTML = `
            <div class="no-selection">
                <i class="fas fa-clipboard-list"></i> No hay embarcaciones en la categoría "${categoryNames[categoria]}"
                <br><br>
                <i class="fas fa-sync-alt"></i> Verifica la conexión o contacta al administrador
            </div>
        `;
        return;
    }

    let html = '';
    vessels.forEach((vessel, index) => {
        const statusClass = vessel.estado.toLowerCase().replace(' ', '-');
        const statusConfig = {
            'EN TURNO': { icon: 'fas fa-clock', emoji: '⏳' },
            'EMBARCANDO': { icon: 'fas fa-ship', emoji: '🚢' },
            'SUSPENDIDO': { icon: 'fas fa-ban', emoji: '⛔' }
        };

        const config = statusConfig[vessel.estado] || { icon: 'fas fa-question', emoji: '❓' };
        
        html += `
            <div class="vessel-card" data-vessel-id="${vessel.id}">
                <div class="vessel-header">
                    <div class="vessel-name">${vessel.nombre}</div>
                    <div class="vessel-position">Pos. ${vessel.posicion}</div>
                </div>
                
                <div class="vessel-status">
                    <div class="current-status status-${statusClass}">
                        <i class="${config.icon}"></i> ${vessel.estado}
                    </div>
                </div>
                
                <button class="change-status-button touch-target" 
                        data-vessel='${JSON.stringify(vessel)}' 
                        data-action="status">
                    <i class="fas fa-edit"></i> Cambiar Estado
                </button>
                
                <div class="vessel-actions">
                    ${vessel.estado === 'EMBARCANDO' ? `
                        <button class="action-button zarpar-button touch-target" 
                                data-vessel='${JSON.stringify(vessel)}' 
                                data-action="zarpar">
                            <i class="fas fa-anchor"></i> Zarpar
                        </button>
                    ` : `
                        <button class="action-button touch-target" 
                                style="background: rgba(100, 100, 100, 0.3); border-color: #666; color: #999; cursor: not-allowed;" 
                                disabled>
                            <i class="fas fa-anchor"></i> Solo Embarcando Puede Zarpar
                        </button>
                    `}
                    ${userRole === 'admin' ? `
                        <button class="action-button touch-target" 
                                style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); border-color: #ff6b35;" 
                                data-vessel='${JSON.stringify(vessel)}' 
                                data-action="position">
                            <i class="fas fa-sort-numeric-up"></i> Cambiar Posición
                        </button>
                        <button class="action-button touch-target" 
                                style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); border-color: #e74c3c; margin-top: 10px;" 
                                data-vessel='${JSON.stringify(vessel)}' 
                                data-action="desembarcar">
                            <i class="fas fa-arrow-down"></i> Desembarcar
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    vesselsContent.innerHTML = html;
}

/**
 * Configurar event listeners para las acciones de embarcaciones
 * @param {Object} embarcacionesData - Datos de todas las embarcaciones
 * @param {string} currentCategory - Categoría actual
 * @param {string} userRole - Rol del usuario
 */
export function setupVesselActions(embarcacionesData, currentCategory, userRole) {
    const vesselsContent = document.getElementById('vesselsContent');
    
    if (!vesselsContent) return;
    
    vesselsContent.addEventListener('click', async (e) => {
        const button = e.target.closest('[data-action]');
        if (!button) return;
        
        const action = button.dataset.action;
        const vesselData = JSON.parse(button.dataset.vessel);
        
        triggerHapticFeedback('light');
        
        switch (action) {
            case 'status':
                // Disparar evento personalizado para abrir modal de estado
                window.dispatchEvent(new CustomEvent('openStatusModal', {
                    detail: { vesselId: vesselData.id, vesselData }
                }));
                break;
                
            case 'zarpar':
                // Disparar evento personalizado para abrir modal de zarpar
                window.dispatchEvent(new CustomEvent('openZarparModal', {
                    detail: { vesselId: vesselData.id, vesselData }
                }));
                break;
                
            case 'position':
                if (userRole === 'admin') {
                    // Disparar evento personalizado para abrir modal de posición
                    window.dispatchEvent(new CustomEvent('openPositionModal', {
                        detail: { vesselId: vesselData.id, vesselData }
                    }));
                }
                break;
                
            case 'desembarcar':
                if (userRole === 'admin') {
                    await desembarcarVessel(vesselData.id, embarcacionesData, currentCategory);
                }
                break;
        }
    });
}

/**
 * Función para desembarcar (solo admins)
 * @param {string} vesselId - ID de la embarcación
 * @param {Object} embarcacionesData - Datos de embarcaciones
 * @param {string} currentCategory - Categoría actual
 */
export async function desembarcarVessel(vesselId, embarcacionesData, currentCategory) {
    try {
        const vesselsInCategory = embarcacionesData[currentCategory] || [];
        const vessel = vesselsInCategory.find(v => v.id === vesselId);
        
        if (!vessel) {
            triggerHapticFeedback('error');
            alert('Embarcación no encontrada');
            return;
        }

        // Confirmar acción
        const confirmMessage = `¿Confirmas desembarcar "${vessel.nombre}"?\n\nEsto moverá la embarcación al final de la cola y reorganizará las posiciones.`;
        if (!confirm(confirmMessage)) {
            return;
        }

        triggerHapticFeedback('heavy');

        // Usar lógica de desembarque
        const turnoManager = new TurnoNautico(vesselsInCategory);
        const desembarqueExitoso = turnoManager.desembarcar();

        if (desembarqueExitoso) {
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
            
            // Disparar evento para mostrar éxito
            window.dispatchEvent(new CustomEvent('showSuccess', {
                detail: {
                    title: '🚢 Desembarque Exitoso',
                    message: `${vessel.nombre} ha sido desembarcada y enviada al final de la cola.`,
                    duration: 5000
                }
            }));
            
        } else {
            triggerHapticFeedback('error');
            window.dispatchEvent(new CustomEvent('showError', {
                detail: {
                    title: '❌ Error de Desembarque',
                    message: 'No se pudo realizar el desembarque.',
                    duration: 4000
                }
            }));
        }
        
    } catch (error) {
        triggerHapticFeedback('error');
        
        window.dispatchEvent(new CustomEvent('showError', {
            detail: {
                title: '❌ Error de Desembarque',
                message: 'No se pudo desembarcar la embarcación. Intenta nuevamente.',
                duration: 5000
            }
        }));
    }
}

/**
 * Aplicar animación visual de actualización a una embarcación
 * @param {string} vesselId - ID de la embarcación
 */
export function showVesselUpdate(vesselId) {
    const vesselCard = document.querySelector(`[data-vessel-id="${vesselId}"]`);
    if (vesselCard) {
        vesselCard.classList.add('vessel-updating');
        setTimeout(() => {
            vesselCard.classList.remove('vessel-updating');
        }, 600);
    }
}

/**
 * Renderizar categorías especiales (verificar reserva, cambiar categoría)
 * @param {string} categoria - Categoría especial
 */
export function renderSpecialCategory(categoria) {
    const vesselsTitle = document.getElementById('vesselsTitle');
    const vesselsContent = document.getElementById('vesselsContent');
    
    if (categoria === 'verificar') {
        vesselsTitle.innerHTML = `<i class="fas fa-id-card"></i> Verificar Reserva`;
        vesselsContent.innerHTML = `
            <div style="padding: 20px;">
                <input type="text" id="docReserva" class="modal-input touch-target" placeholder="Ingrese número de documento">
                
                <button class="login-button touch-target" id="btnVerificarReserva" 
                        style="margin-bottom: 15px;">
                    <i class="fas fa-search"></i> Buscar Reserva
                </button>
                
                <div id="resultadoReserva" style="margin-top: 15px; color: #FFD700;"></div>
            </div>
        `;
        
        // Agregar event listener
        const btnVerificar = document.getElementById('btnVerificarReserva');
        if (btnVerificar) {
            btnVerificar.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('verificarReserva'));
            });
        }
        
    } else if (categoria === 'cambiar-categoria') {
        vesselsTitle.innerHTML = `<i class="fas fa-exchange-alt"></i> Cambiar Categoría de Venta`;
        vesselsContent.innerHTML = `
            <div style="padding: 20px;">
                <input type="text" id="docVenta" class="modal-input touch-target" placeholder="Ingrese número de documento">
                
                <button class="login-button touch-target" id="btnCambiarCategoria"
                        style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); margin-bottom: 15px;">
                    <i class="fas fa-exchange-alt"></i> Buscar Venta para Cambiar
                </button>
                
                <div id="resultadoVenta" style="margin-top: 15px; color: #FFD700;"></div>
            </div>
        `;
        
        // Agregar event listener
        const btnCambiar = document.getElementById('btnCambiarCategoria');
        if (btnCambiar) {
            btnCambiar.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('cambiarCategoriaVenta'));
            });
        }
    }
}

/**
 * Obtener icono según el estado de la embarcación
 * @param {string} estado - Estado de la embarcación
 * @returns {string} Clase del icono
 */
export function getStatusIcon(estado) {
    const statusIcons = {
        'EN TURNO': 'fas fa-clock',
        'EMBARCANDO': 'fas fa-ship',
        'SUSPENDIDO': 'fas fa-ban'
    };
    return statusIcons[estado] || 'fas fa-question';
}

/**
 * Obtener clase CSS según el estado de la embarcación
 * @param {string} estado - Estado de la embarcación
 * @returns {string} Clase CSS
 */
export function getStatusClass(estado) {
    return estado.toLowerCase().replace(' ', '-');
}