// ===========================
// MÓDULO DE GESTIÓN DE EMBARCACIONES
// ===========================

import { CONFIG } from './config.js';
import { Haptics, Calculate, Validate, ID } from './utils.js';

class EmbarcacionesManager {
    constructor() {
        this.embarcaciones = {};
        this.currentCategory = null;
        this.listeners = [];
    }

    // ===========================
    // INICIALIZACIÓN
    // ===========================
    
    async init() {
        try {
            // Escuchar cambios en tiempo real
            this.setupRealtimeListener();
            
        } catch (error) {
            console.error('Error inicializando embarcaciones:', error);
            window.UI.showError('Error', 'No se pudieron cargar las embarcaciones');
        }
    }

    // Configurar listener en tiempo real
    setupRealtimeListener() {
        const unsubscribe = window.Database.listenToEmbarcaciones((embarcaciones, error) => {
            if (error) {
                window.UI.showError('Error de Conexión', 'Se perdió la conexión con la base de datos');
                return;
            }

            this.embarcaciones = embarcaciones || {};
            this.updateCurrentView();
        });

        this.listeners.push(unsubscribe);
    }

    // ===========================
    // GESTIÓN DE CATEGORÍAS
    // ===========================
    
    // Cargar categoría específica
    loadCategory(categoria) {
        this.currentCategory = categoria;
        this.updateCurrentView();
    }

    // Actualizar vista actual
    updateCurrentView() {
        if (!this.currentCategory) return;

        const vessels = this.embarcaciones[this.currentCategory] || [];
        const userRole = window.Auth.getCurrentRole();
        
        window.UI.renderVessels(this.currentCategory, vessels, userRole);
    }

    // ===========================
    // LÓGICA DE TURNOS NÁUTICOS
    // ===========================
    
    // Aplicar reglas de auto-avance
    applyTurnoRules(vessels) {
        if (!vessels || vessels.length === 0) return vessels;

        // Ordenar por posición
        const sortedVessels = [...vessels].sort((a, b) => a.posicion - b.posicion);
        
        // Encontrar primera embarcación EN TURNO para auto-embarque
        const firstEnTurno = sortedVessels.find(v => v.estado === CONFIG.ESTADOS.EN_TURNO);
        const hasEmbarcando = sortedVessels.some(v => v.estado === CONFIG.ESTADOS.EMBARCANDO);
        
        // Si no hay ninguna embarcando y hay EN TURNO, la primera pasa a embarcar
        if (!hasEmbarcando && firstEnTurno) {
            firstEnTurno.estado = CONFIG.ESTADOS.EMBARCANDO;
        }

        return sortedVessels;
    }

    // Validar si una embarcación puede embarcar consecutivamente
    canEmbark(position, vessels) {
        if (!vessels || vessels.length === 0) return false;

        const sortedVessels = [...vessels].sort((a, b) => a.posicion - b.posicion);
        
        // Encontrar todas las embarcaciones embarcando
        const embarcando = sortedVessels
            .filter(v => v.estado === CONFIG.ESTADOS.EMBARCANDO)
            .map(v => v.posicion)
            .sort((a, b) => a - b);

        if (embarcando.length === 0) {
            // Si no hay ninguna embarcando, solo la posición 1 puede embarcar
            return position === 1;
        }

        // Debe ser consecutiva a la última embarcando
        const lastEmbarcando = Math.max(...embarcando);
        return position === lastEmbarcando + 1;
    }

    // Reorganizar posiciones después de zarpe
    async reorganizeAfterZarpe(vesselId, categoria) {
        try {
            const vessels = this.embarcaciones[categoria] || [];
            const vessel = vessels.find(v => v.id === vesselId);
            
            if (!vessel) return { success: false, error: 'Embarcación no encontrada' };

            // Remover embarcación de su posición actual
            const otherVessels = vessels.filter(v => v.id !== vesselId);
            
            // Reorganizar posiciones (todos suben uno)
            const updates = otherVessels
                .filter(v => v.posicion > vessel.posicion)
                .map(v => ({
                    id: v.id,
                    data: { posicion: v.posicion - 1 }
                }));

            // Agregar la embarcación que zarpó al final
            const newPosition = otherVessels.length + 1;
            updates.push({
                id: vesselId,
                data: { 
                    posicion: newPosition,
                    estado: CONFIG.ESTADOS.EN_TURNO
                }
            });

            // Aplicar auto-embarque al primer EN TURNO
            const firstEnTurno = otherVessels
                .filter(v => v.posicion < vessel.posicion && v.estado === CONFIG.ESTADOS.EN_TURNO)
                .sort((a, b) => a.posicion - b.posicion)[0];

            if (firstEnTurno) {
                updates.push({
                    id: firstEnTurno.id,
                    data: { estado: CONFIG.ESTADOS.EMBARCANDO }
                });
            }

            // Actualizar en la base de datos
            const result = await window.Database.updateMultipleEmbarcaciones(updates);
            
            if (result.success) {
                Haptics.success();
                window.UI.showSuccess('🚢 Zarpe Exitoso', 'Embarcación enviada al final de la cola');
            }

            return result;

        } catch (error) {
            console.error('Error reorganizando después de zarpe:', error);
            return { success: false, error: error.message };
        }
    }

    // Reorganizar posiciones después de cambio a RESERVA
    async reorganizeAfterReserva(vesselId, categoria) {
        try {
            const vessels = this.embarcaciones[categoria] || [];
            const vessel = vessels.find(v => v.id === vesselId);
            
            if (!vessel) return { success: false, error: 'Embarcación no encontrada' };

            // Similar al zarpe pero cambia estado a RESERVA
            const otherVessels = vessels.filter(v => v.id !== vesselId);
            
            const updates = otherVessels
                .filter(v => v.posicion > vessel.posicion)
                .map(v => ({
                    id: v.id,
                    data: { posicion: v.posicion - 1 }
                }));

            // Agregar la embarcación al final como RESERVA
            const newPosition = otherVessels.length + 1;
            updates.push({
                id: vesselId,
                data: { 
                    posicion: newPosition,
                    estado: CONFIG.ESTADOS.RESERVA
                }
            });

            const result = await window.Database.updateMultipleEmbarcaciones(updates);
            
            if (result.success) {
                Haptics.success();
                window.UI.showSuccess('📋 Reserva Aplicada', 'Embarcación movida al final como RESERVA');
            }

            return result;

        } catch (error) {
            console.error('Error reorganizando después de reserva:', error);
            return { success: false, error: error.message };
        }
    }

    // Manejar reactivación de embarcación suspendida en posición 1
    async reactivateFirstSuspended(vesselId, categoria) {
        try {
            const vessels = this.embarcaciones[categoria] || [];
            const vessel = vessels.find(v => v.id === vesselId);
            
            if (!vessel || vessel.posicion !== 1 || vessel.estado !== CONFIG.ESTADOS.SUSPENDIDO) {
                return { success: false, error: 'No aplica regla especial' };
            }

            const updates = [];
            
            // Reorganización especial: 1->3, 2->1, 3->2
            vessels.forEach(v => {
                if (v.id === vesselId) {
                    // La suspendida va a posición 3
                    updates.push({
                        id: v.id,
                        data: { posicion: 3, estado: CONFIG.ESTADOS.EN_TURNO }
                    });
                } else if (v.posicion === 2) {
                    // Pos 2 -> Pos 1
                    updates.push({
                        id: v.id,
                        data: { posicion: 1 }
                    });
                } else if (v.posicion === 3) {
                    // Pos 3 -> Pos 2
                    updates.push({
                        id: v.id,
                        data: { posicion: 2 }
                    });
                }
            });

            // Aplicar auto-embarque
            const newFirstVessel = vessels.find(v => v.posicion === 2); // Será la nueva pos 1
            if (newFirstVessel && newFirstVessel.estado === CONFIG.ESTADOS.EN_TURNO) {
                updates.find(u => u.id === newFirstVessel.id).data.estado = CONFIG.ESTADOS.EMBARCANDO;
            }

            const result = await window.Database.updateMultipleEmbarcaciones(updates);
            
            if (result.success) {
                Haptics.success();
                window.UI.showSuccess('🔄 Reactivación Especial', 'Embarcación reactivada con reorganización automática');
            }

            return result;

        } catch (error) {
            console.error('Error en reactivación especial:', error);
            return { success: false, error: error.message };
        }
    }

    // ===========================
    // ACCIONES DE EMBARCACIONES
    // ===========================
    
    // Manejar acción de embarcación
    async handleVesselAction(action, vesselId) {
        const vessel = this.findVesselById(vesselId);
        if (!vessel) {
            window.UI.showError('Error', 'Embarcación no encontrada');
            return;
        }

        switch (action) {
            case 'change-status':
                this.showChangeStatusModal(vessel);
                break;
            case 'zarpar':
                this.showZarparModal(vessel);
                break;
            case 'edit':
                if (window.Auth.hasPermission('edit_vessel')) {
                    this.showEditVesselModal(vessel);
                }
                break;
            case 'change-position':
                if (window.Auth.hasPermission('change_position')) {
                    this.showChangePositionModal(vessel);
                }
                break;
            case 'delete':
                if (window.Auth.hasPermission('delete_vessel')) {
                    await this.deleteVessel(vessel);
                }
                break;
        }
    }

    // Encontrar embarcación por ID
    findVesselById(vesselId) {
        for (const categoria in this.embarcaciones) {
            const vessel = this.embarcaciones[categoria].find(v => v.id === vesselId);
            if (vessel) {
                vessel.categoria = categoria;
                return vessel;
            }
        }
        return null;
    }

    // Cambiar estado de embarcación
    async changeVesselStatus(vesselId, newStatus) {
        try {
            const vessel = this.findVesselById(vesselId);
            if (!vessel) return { success: false, error: 'Embarcación no encontrada' };

            // Validaciones específicas por estado
            if (newStatus === CONFIG.ESTADOS.EMBARCANDO) {
                const vessels = this.embarcaciones[vessel.categoria] || [];
                if (!this.canEmbark(vessel.posicion, vessels) && !window.Auth.isAdmin()) {
                    window.UI.showError('⚠️ Error de Embarque', 'Solo se puede embarcar de forma consecutiva');
                    return { success: false, error: 'Embarque no consecutivo' };
                }
            }

            // Casos especiales de reorganización
            if (vessel.estado === CONFIG.ESTADOS.SUSPENDIDO && 
                vessel.posicion === 1 && 
                newStatus === CONFIG.ESTADOS.EN_TURNO) {
                return await this.reactivateFirstSuspended(vesselId, vessel.categoria);
            }

            if (newStatus === CONFIG.ESTADOS.RESERVA) {
                return await this.reorganizeAfterReserva(vesselId, vessel.categoria);
            }

            // Cambio de estado normal
            const result = await window.Database.updateEmbarcacion(vesselId, {
                estado: newStatus
            });

            if (result.success) {
                Haptics.success();
                window.UI.showSuccess('🔄 Estado Actualizado', `${vessel.nombre} ahora está ${newStatus}`);
            }

            return result;

        } catch (error) {
            console.error('Error cambiando estado:', error);
            return { success: false, error: error.message };
        }
    }

    // Desembarcar embarcación
    async desembarcarVessel(vessel) {
        try {
            Haptics.medium();
            
            const confirmMessage = `¿Confirmas desembarcar "${vessel.nombre}"?\n\nEsto reorganizará las posiciones automáticamente.`;
            
            if (!confirm(confirmMessage)) {
                return;
            }

            return await this.reorganizeAfterZarpe(vessel.id, vessel.categoria);

        } catch (error) {
            console.error('Error desembarcando:', error);
            window.UI.showError('❌ Error', 'No se pudo desembarcar la embarcación');
        }
    }

    // Eliminar embarcación (solo admin)
    async deleteVessel(vessel) {
        try {
            if (vessel.estado === CONFIG.ESTADOS.EMBARCANDO) {
                window.UI.showError('⚠️ No Permitido', 'No se puede eliminar una embarcación que está embarcando');
                return;
            }

            Haptics.heavy();
            
            const confirmMessage = `¿Estás seguro de eliminar "${vessel.nombre}"?\n\nEsta acción no se puede deshacer.`;
            
            if (!confirm(confirmMessage)) {
                return;
            }

            const result = await window.Database.deleteEmbarcacion(vessel.id);
            
            if (result.success) {
                Haptics.success();
                window.UI.showSuccess('🗑️ Embarcación Eliminada', `${vessel.nombre} ha sido eliminada del sistema`);
                
                // Reorganizar posiciones de las restantes
                await this.reorganizePositions(vessel.categoria);
            } else {
                window.UI.showError('❌ Error', 'No se pudo eliminar la embarcación');
            }

        } catch (error) {
            console.error('Error eliminando embarcación:', error);
            window.UI.showError('❌ Error', 'Error inesperado al eliminar');
        }
    }

    // Reorganizar posiciones después de eliminación
    async reorganizePositions(categoria) {
        try {
            const vessels = this.embarcaciones[categoria] || [];
            
            const updates = vessels
                .sort((a, b) => a.posicion - b.posicion)
                .map((vessel, index) => ({
                    id: vessel.id,
                    data: { posicion: index + 1 }
                }));

            await window.Database.updateMultipleEmbarcaciones(updates);

        } catch (error) {
            console.error('Error reorganizando posiciones:', error);
        }
    }

    // ===========================
    // MODALES ESPECÍFICOS
    // ===========================
    
    // Modal cambiar estado
    showChangeStatusModal(vessel) {
        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fas fa-exchange-alt"></i>
                    Cambiar Estado
                </h3>
                <button class="modal-close" id="modalCloseBtn" title="Cerrar">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="vessel-info-card">
                <div class="vessel-info-header">
                    <h4><i class="fas fa-ship"></i> ${vessel.nombre}</h4>
                    <span class="position-badge">Pos. ${vessel.posicion}</span>
                </div>
                <div class="current-state">
                    <span>Estado actual:</span>
                    <span class="current-status-badge ${this.getStatusClass(vessel.estado)}">
                        <i class="${this.getStatusIcon(vessel.estado)}"></i>
                        ${vessel.estado}
                    </span>
                </div>
            </div>
            
            <div class="modal-body-scrollable">
                <div class="status-options-grid">
                    ${this.renderStatusCards(vessel)}
                </div>
                
                ${this.renderStatusWarnings(vessel)}
            </div>
            
            <div class="modal-actions-fixed">
                <div class="modal-actions">
                    <button id="cancelStatusBtn" class="btn btn-error">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                    <button id="confirmStatusBtn" class="btn btn-success" disabled>
                        <i class="fas fa-check"></i>
                        Confirmar Cambio
                    </button>
                </div>
            </div>
        `;

        const modalId = window.UI.showModal(modalContent, { className: 'modal-operador' });

        setTimeout(() => {
            this.setupStatusModalEvents(vessel, modalId);
        }, 100);
    }


    // Función auxiliar para obtener clase CSS del estado
    getStatusClass(estado) {
        return `estado-${estado.toLowerCase().replace(' ', '-')}`;
    }

    // Función auxiliar para obtener icono del estado
    getStatusIcon(estado) {
        const icons = {
            'EN TURNO': 'fas fa-clock',
            'EMBARCANDO': 'fas fa-ship',
            'SUSPENDIDO': 'fas fa-ban',
            'RESERVA': 'fas fa-bookmark'
        };
        return icons[estado] || 'fas fa-question';
    }

    // Renderizar tarjetas de estado
    renderStatusCards(vessel) {
        const estados = [
            {
                key: 'EN TURNO',
                title: 'EN TURNO',
                icon: 'fas fa-clock',
                description: 'Esperando turno para embarcar',
                class: 'estado-en-turno'
            },
            {
                key: 'EMBARCANDO',
                title: 'EMBARCANDO',
                icon: 'fas fa-ship',
                description: 'Actualmente cargando pasajeros',
                class: 'estado-embarcando'
            },
            {
                key: 'SUSPENDIDO',
                title: 'SUSPENDIDO',
                icon: 'fas fa-ban',
                description: 'Temporalmente fuera de servicio',
                class: 'estado-suspendido'
            },
            {
                key: 'RESERVA',
                title: 'RESERVA',
                icon: 'fas fa-bookmark',
                description: 'Turno reservado (va al final)',
                class: 'estado-reserva'
            }
        ];

        return estados.map(estado => {
            const isSelected = vessel.estado === estado.key;
            const isCurrent = vessel.estado === estado.key;
            const isDisabled = !this.canChangeToStatus(vessel, estado.key);
            
            let cardClasses = `status-option-card ${estado.class}`;
            if (isSelected) cardClasses += ' selected';
            if (isCurrent) cardClasses += ' current';
            if (isDisabled) cardClasses += ' disabled';
            
            // Mensaje especial para posición 1 suspendida
            let specialMessage = '';
            if (!window.Auth.isAdmin() && vessel.posicion === 1 && vessel.estado === CONFIG.ESTADOS.SUSPENDIDO && estado.key !== 'EN TURNO') {
                specialMessage = '<div class="status-card-description" style="color: var(--error); margin-top: 8px;"><i class="fas fa-ban"></i> No disponible para pos. 1 suspendida</div>';
            }
            
            return `
                <div class="${cardClasses}" data-status="${estado.key}">
                    ${isCurrent ? '<div class="status-card-badge">Actual</div>' : ''}
                    <i class="status-card-icon ${estado.icon}"></i>
                    <div class="status-card-title">${estado.title}</div>
                    <div class="status-card-description">${estado.description}</div>
                    ${isDisabled && !specialMessage ? '<div class="status-card-description" style="color: var(--error); margin-top: 8px;"><i class="fas fa-lock"></i> No disponible</div>' : ''}
                    ${specialMessage}
                </div>
            `;
        }).join('');
    }

    // Renderizar advertencias específicas
    renderStatusWarnings(vessel) {
        const vessels = this.embarcaciones[vessel.categoria] || [];
        let warnings = '';
        
        // ADVERTENCIA ESPECÍFICA PARA POSICIÓN 1 SUSPENDIDA
        if (!window.Auth.isAdmin() && vessel.posicion === 1 && vessel.estado === CONFIG.ESTADOS.SUSPENDIDO) {
            warnings += `
                <div class="status-warning" style="background: var(--error)20; border-color: var(--error); color: var(--error);">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <strong>Restricción aplicada:</strong> La embarcación en posición 1 suspendida solo puede cambiar a EN TURNO.
                    </div>
                </div>
            `;
        }
        
        // Otras advertencias normales
        else {
            // Advertencia para embarque no consecutivo
            if (!this.canEmbark(vessel.posicion, vessels) && !window.Auth.isAdmin()) {
                warnings += `
                    <div class="status-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <div>
                            <strong>Embarque consecutivo:</strong> Solo se puede embarcar en orden de posición.
                        </div>
                    </div>
                `;
            }
            
            // Advertencia para reserva
            if (vessel.estado !== 'RESERVA') {
                warnings += `
                    <div class="status-warning">
                        <i class="fas fa-info-circle"></i>
                        <div>
                            <strong>Reserva:</strong> Al cambiar a RESERVA, la embarcación se moverá al final de la cola.
                        </div>
                    </div>
                `;
            }
        }
        
        return warnings;
    }


    // Renderizar opciones de estado
    renderStatusOptions(vessel) {
        const estados = [
            { key: CONFIG.ESTADOS.EN_TURNO, label: 'EN TURNO', icon: 'fas fa-clock' },
            { key: CONFIG.ESTADOS.EMBARCANDO, label: 'EMBARCANDO', icon: 'fas fa-ship' },
            { key: CONFIG.ESTADOS.SUSPENDIDO, label: 'SUSPENDIDO', icon: 'fas fa-ban' },
            { key: CONFIG.ESTADOS.RESERVA, label: 'RESERVA', icon: 'fas fa-bookmark' }
        ];

        return estados.map(estado => {
            const isSelected = vessel.estado === estado.key;
            const isDisabled = !this.canChangeToStatus(vessel, estado.key);
            
            return `
                <div class="status-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
                     data-status="${estado.key}">
                    <div class="status-option-icon">
                        <i class="${estado.icon}"></i>
                    </div>
                    <div class="status-option-info">
                        <div class="status-option-title">${estado.label}</div>
                        <div class="status-option-description">
                            ${this.getStatusDescription(estado.key, vessel)}
                        </div>
                    </div>
                    <div class="status-option-radio ${isSelected ? 'selected' : ''}"></div>
                </div>
            `;
        }).join('');
    }


    // Verificar si puede cambiar a un estado específico
    canChangeToStatus(vessel, newStatus) {
       
        if (window.Auth.isAdmin()) return true; // Admin puede todo

        // REGLA ESPECÍFICA: Posición 1 suspendida SOLO puede ir a EN TURNO
        if (vessel.posicion === 1 && vessel.estado === CONFIG.ESTADOS.SUSPENDIDO) {
            const canChange = newStatus === CONFIG.ESTADOS.EN_TURNO;
            return canChange;
        }

        // Resto de la lógica...
        const vessels = this.embarcaciones[vessel.categoria] || [];

        switch (newStatus) {
            case CONFIG.ESTADOS.EMBARCANDO:
                return this.canEmbark(vessel.posicion, vessels);
            case CONFIG.ESTADOS.EN_TURNO:
            case CONFIG.ESTADOS.SUSPENDIDO:
            case CONFIG.ESTADOS.RESERVA:
                return true;
            default:
                return false;
        }
    }
    

    // Obtener descripción del estado
    getStatusDescription(estado, vessel) {
        const descriptions = {
            [CONFIG.ESTADOS.EN_TURNO]: 'Esperando turno para embarcar',
            [CONFIG.ESTADOS.EMBARCANDO]: 'Actualmente cargando pasajeros',
            [CONFIG.ESTADOS.SUSPENDIDO]: 'Temporalmente fuera de servicio',
            [CONFIG.ESTADOS.RESERVA]: 'Turno reservado'
        };

        let desc = descriptions[estado] || '';

        // MENSAJE ESPECIAL PARA POSICIÓN 1 SUSPENDIDA
        if (!window.Auth.isAdmin() && vessel.posicion === 1 && vessel.estado === CONFIG.ESTADOS.SUSPENDIDO && estado === CONFIG.ESTADOS.EN_TURNO) {
            desc += ' (Única opción disponible)';
        }

        // Agregar advertencias específicas para otros casos
        if (estado === CONFIG.ESTADOS.EMBARCANDO && !this.canChangeToStatus(vessel, estado)) {
            desc += ' (Solo consecutivo)';
        }

        if (estado === CONFIG.ESTADOS.RESERVA) {
            desc += ' (Va al final)';
        }

        return desc;
    }

    // Configurar eventos del modal de estado
    setupStatusModalEvents(vessel, modalId) { 
        const statusCards = document.querySelectorAll('.status-option-card:not(.disabled)');
        const confirmBtn = document.getElementById('confirmStatusBtn');
        let selectedStatus = vessel.estado;

        statusCards.forEach(card => {
            card.addEventListener('click', () => {
                // Remover selección previa
                statusCards.forEach(c => c.classList.remove('selected'));
                
                // Seleccionar nueva tarjeta
                card.classList.add('selected');
                
                selectedStatus = card.dataset.status;
                confirmBtn.disabled = selectedStatus === vessel.estado;
                
                // Cambiar texto del botón según la acción
                if (selectedStatus !== vessel.estado) {
                    confirmBtn.innerHTML = `<i class="fas fa-check"></i> Cambiar`;
                } else {
                    confirmBtn.innerHTML = `<i class="fas fa-check"></i> Confirmar Cambio`;
                }
                
                Haptics.light();
            });
        });

        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<div class="spinner"></div> Actualizando...';
                
                const result = await this.changeVesselStatus(vessel.id, selectedStatus);
                
                if (result.success) {
                    window.UI.closeModal(modalId); 
                } else {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = `<i class="fas fa-check"></i> Cambiar`;
                    window.UI.showError('❌ Error', result.error);
                }
            });
        }

        // Event listener para botón cancelar - ✅ CORRECCIÓN
        const cancelBtn = document.getElementById('cancelStatusBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                window.UI.closeModal(modalId);  
            });
        }

        // Event listener para botón cerrar (X) -
        const closeBtn = document.getElementById('modalCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                window.UI.closeModal(modalId);  
            });
        }
    }

    // Modal para zarpar
    showZarparModal(vessel) {
        if (vessel.estado !== CONFIG.ESTADOS.EMBARCANDO) {
            window.UI.showError('⚠️ No Permitido', 'Solo las embarcaciones embarcando pueden zarpar');
            return;
        }

        window.Modals.showZarparModal(vessel);
    }

    // Modal para agregar embarcación (solo admin)
    showAddVesselModal() {
        if (!window.Auth.hasPermission('add_vessel')) {
            window.UI.showError('⚠️ Sin Permisos', 'Solo los administradores pueden agregar embarcaciones');
            return;
        }

        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fas fa-plus"></i>
                    Agregar Nueva Embarcación
                </h3>
                <button class="modal-close" id="addModalCloseBtn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="addVesselForm" class="operador-form">
                <div class="form-group">
                    <label class="form-label" for="vesselName">
                        <i class="fas fa-ship"></i>
                        Nombre de la Embarcación
                    </label>
                    <input 
                        type="text" 
                        id="vesselName" 
                        class="form-input touch-target"
                        placeholder="Ej: Lancha Aurora"
                        required
                    >
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="vesselCategory">
                        <i class="fas fa-tag"></i>
                        Categoría
                    </label>
                    <select id="vesselCategory" class="form-input touch-target" required>
                        <option value="">Selecciona una categoría</option>
                        ${Object.entries(CONFIG.CATEGORIAS).map(([key, cat]) => 
                            `<option value="${key}">${cat.nombre}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="vesselCapacity">
                        <i class="fas fa-users"></i>
                        Capacidad (Pasajeros)
                    </label>
                    <input 
                        type="number" 
                        id="vesselCapacity" 
                        class="form-input touch-target"
                        placeholder="Ej: 12"
                        min="1"
                        max="100"
                        required
                    >
                </div>
                
                <div class="modal-actions">
                    <button type="button" id="addCancelBtn" class="btn btn-error">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                    <button type="submit" class="btn btn-success">
                        <i class="fas fa-plus"></i>
                        Agregar Embarcación
                    </button>
                </div>
            </form>
        `;

        const modalId = window.UI.showModal(modalContent, { className: 'modal-operador' });

        setTimeout(() => {
            this.setupAddVesselForm(modalId);
        }, 100);
    }

    // Configurar formulario de agregar embarcación
    setupAddVesselForm(modalId) {
        const form = document.getElementById('addVesselForm');
        const closeBtn = document.getElementById('addModalCloseBtn');
        const cancelBtn = document.getElementById('addCancelBtn');

        if (!form) return;

        // Configurar botón cerrar (X)
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                window.UI.closeModal(modalId);
            });
        }

        // Configurar botón cancelar
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                window.UI.closeModal(modalId);
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('vesselName').value.trim();
            const category = document.getElementById('vesselCategory').value;
            const capacity = parseInt(document.getElementById('vesselCapacity').value);

            if (!name || !category || !capacity) {
                window.UI.showError('⚠️ Campos Requeridos', 'Complete todos los campos');
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner"></div> Agregando...';

            try {
                // Calcular nueva posición
                const vessels = this.embarcaciones[category] || [];
                const newPosition = Calculate.nextPosition(vessels);

                const newVessel = {
                    nombre: name,
                    categoria: category,
                    capacidad: capacity,
                    posicion: newPosition,
                    estado: CONFIG.ESTADOS.EN_TURNO
                };

                const result = await window.Database.addEmbarcacion(newVessel);

                if (result.success) {
                    window.UI.closeModal(modalId);
                    window.UI.showSuccess('✅ Embarcación Agregada', `${name} ha sido agregada exitosamente`);
                    Haptics.success();
                } else {
                    window.UI.showError('❌ Error', 'No se pudo agregar la embarcación');
                }

            } catch (error) {
                console.error('Error agregando embarcación:', error);
                window.UI.showError('❌ Error', 'Error inesperado al agregar');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-plus"></i> Agregar Embarcación';
            }
        });

        // Focus en primer campo
        const nameInput = document.getElementById('vesselName');
        if (nameInput) nameInput.focus();
    }

    // Modal para editar embarcación (solo admin)
    showEditVesselModal(vessel) {
        if (!window.Auth.hasPermission('edit_vessel')) {
            window.UI.showError('⚠️ Sin Permisos', 'Solo los administradores pueden editar embarcaciones');
            return;
        }

        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fas fa-edit"></i>
                    Editar Embarcación
                </h3>
                <button class="modal-close" id="editModalCloseBtn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="editVesselForm" class="operador-form">
                <div class="form-group">
                    <label class="form-label" for="editVesselName">
                        <i class="fas fa-ship"></i>
                        Nombre de la Embarcación
                    </label>
                    <input 
                        type="text" 
                        id="editVesselName" 
                        class="form-input touch-target"
                        value="${vessel.nombre}"
                        required
                    >
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="editVesselCategory">
                        <i class="fas fa-tag"></i>
                        Categoría
                    </label>
                    <select id="editVesselCategory" class="form-input touch-target" required>
                        ${Object.entries(CONFIG.CATEGORIAS).map(([key, cat]) => 
                            `<option value="${key}" ${vessel.categoria === key ? 'selected' : ''}>${cat.nombre}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="editVesselCapacity">
                        <i class="fas fa-users"></i>
                        Capacidad (Pasajeros)
                    </label>
                    <input 
                        type="number" 
                        id="editVesselCapacity" 
                        class="form-input touch-target"
                        value="${vessel.capacidad || ''}"
                        min="1"
                        max="100"
                        required
                    >
                </div>
                
                <div class="vessel-info">
                    <div class="info-item">
                        <strong>Posición Actual:</strong> ${vessel.posicion}
                    </div>
                    <div class="info-item">
                        <strong>Estado Actual:</strong> ${vessel.estado}
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button type="button" id="editCancelBtn" class="btn btn-error">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                    <button type="submit" class="btn btn-success">
                        <i class="fas fa-save"></i>
                        Guardar Cambios
                    </button>
                </div>
            </form>
        `;

        const modalId = window.UI.showModal(modalContent, { className: 'modal-operador' });
        
        setTimeout(() => {
            this.setupEditVesselForm(vessel, modalId);
        }, 100);
    }
    


    // Configurar formulario de edición
    setupEditVesselForm(vessel, modalId) {
        const form = document.getElementById('editVesselForm');
        const closeBtn = document.getElementById('editModalCloseBtn');
        const cancelBtn = document.getElementById('editCancelBtn');

        if (!form) return;

        // Configurar botón cerrar (X)
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                window.UI.closeModal(modalId);
            });
        }

        // Configurar botón cancelar
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                window.UI.closeModal(modalId);
            });
        }

        // Envío del formulario
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('editVesselName').value.trim();
            const category = document.getElementById('editVesselCategory').value;
            const capacity = parseInt(document.getElementById('editVesselCapacity').value);

            if (!name || !category || !capacity) {
                window.UI.showError('⚠️ Campos Requeridos', 'Complete todos los campos');
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner"></div> Guardando...';

            try {
                const updates = {};
                let needsReorganization = false;

                // Verificar cambios
                if (name !== vessel.nombre) updates.nombre = name;
                if (capacity !== vessel.capacidad) updates.capacidad = capacity;
                
                if (category !== vessel.categoria) {
                    updates.categoria = category;
                    needsReorganization = true;
                }

                if (Object.keys(updates).length === 0) {
                    window.UI.showInfo('ℹ️ Sin Cambios', 'No se detectaron cambios para guardar');
                    window.UI.closeModal(modalId);
                    return;
                }

                // Actualizar embarcación
                const result = await window.Database.updateEmbarcacion(vessel.id, updates);

                if (result.success) {
                    // Si cambió de categoría, reorganizar posiciones
                    if (needsReorganization) {
                        await this.reorganizeAfterCategoryChange(vessel, category);
                    }

                    // CERRAR MODAL DESPUÉS DEL ÉXITO
                    window.UI.closeModal(modalId);
                    window.UI.showSuccess('✅ Embarcación Actualizada', `${name} ha sido actualizada exitosamente`);
                    Haptics.success();
                } else {
                    window.UI.showError('❌ Error', 'No se pudo actualizar la embarcación');
                }

            } catch (error) {
                console.error('Error actualizando embarcación:', error);
                window.UI.showError('❌ Error', 'Error inesperado al actualizar');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
            }
        });

        // Focus en primer campo
        const nameInput = document.getElementById('editVesselName');
        if (nameInput) {
            nameInput.select();
        }
    }

    // Reorganizar después de cambio de categoría
    async reorganizeAfterCategoryChange(vessel, newCategory) {
        try {
            // Obtener nueva posición al final de la nueva categoría
            const newCategoryVessels = this.embarcaciones[newCategory] || [];
            const newPosition = Calculate.nextPosition(newCategoryVessels);

            // Actualizar posición en la nueva categoría
            await window.Database.updateEmbarcacion(vessel.id, {
                posicion: newPosition
            });

            // Reorganizar posiciones en la categoría anterior
            await this.reorganizePositions(vessel.categoria);

        } catch (error) {
            console.error('Error reorganizando después de cambio de categoría:', error);
        }
    }

    // Modal para cambiar posición (solo admin)
    showChangePositionModal(vessel) {
        if (!window.Auth.hasPermission('change_position')) {
            window.UI.showError('⚠️ Sin Permisos', 'Solo los administradores pueden cambiar posiciones');
            return;
        }

        const vessels = this.embarcaciones[vessel.categoria] || [];
        const maxPosition = vessels.length;

        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fas fa-sort-numeric-up"></i>
                    Cambiar Posición - ${vessel.nombre}
                </h3>
                <button class="modal-close" onclick="window.UI.closeModal('position-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="vessel-info">
                <div class="info-item">
                    <strong>Embarcación:</strong> ${vessel.nombre}
                </div>
                <div class="info-item">
                    <strong>Posición Actual:</strong> ${vessel.posicion}
                </div>
                <div class="info-item">
                    <strong>Total en Categoría:</strong> ${maxPosition}
                </div>
            </div>
            
            <form id="positionForm" class="operador-form">
                <div class="form-group">
                    <label class="form-label" for="nuevaPosicion">
                        <i class="fas fa-hashtag"></i>
                        Nueva Posición
                    </label>
                    <input 
                        type="number" 
                        id="nuevaPosicion" 
                        class="form-input touch-target"
                        value="${vessel.posicion}"
                        min="1"
                        max="${maxPosition}"
                        required
                    >
                    <small style="color: var(--text-muted); font-size: 12px; margin-top: 5px; display: block;">
                        Rango válido: 1 - ${maxPosition}
                    </small>
                </div>
                
                <div class="warning-message" style="background: var(--warning)20; border-color: var(--warning); color: var(--warning);">
                    <i class="fas fa-info-circle"></i>
                    Al cambiar la posición, las demás embarcaciones se reorganizarán automáticamente.
                </div>
                
                <div class="modal-actions">
                    <button type="button" class="btn btn-error" onclick="window.UI.closeModal('position-modal')">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                    <button type="submit" id="confirmPositionBtn" class="btn btn-success" disabled>
                        <i class="fas fa-check"></i>
                        Cambiar Posición
                    </button>
                </div>
            </form>
        `;

        const modalId = window.UI.showModal(modalContent, { className: 'modal-operador' });
        
        setTimeout(() => {
            this.setupChangePositionForm(vessel, maxPosition);
        }, 100);
    }

    // Configurar formulario de cambio de posición
    setupChangePositionForm(vessel, maxPosition) {
        const form = document.getElementById('positionForm');
        const positionInput = document.getElementById('nuevaPosicion');
        const confirmBtn = document.getElementById('confirmPositionBtn');

        if (!form || !positionInput || !confirmBtn) return;

        // Validar input en tiempo real
        positionInput.addEventListener('input', () => {
            const newPos = parseInt(positionInput.value);
            const isValid = newPos && newPos >= 1 && newPos <= maxPosition && newPos !== vessel.posicion;
            confirmBtn.disabled = !isValid;
        });

        // Envío del formulario
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.changeVesselPosition(vessel, parseInt(positionInput.value));
        });

        // Focus y seleccionar texto
        positionInput.select();
    }

    // Cambiar posición de embarcación
    async changeVesselPosition(vessel, newPosition) {
        try {
            const vessels = this.embarcaciones[vessel.categoria] || [];
            
            if (newPosition < 1 || newPosition > vessels.length) {
                window.UI.showError('⚠️ Posición Inválida', `La posición debe estar entre 1 y ${vessels.length}`);
                return;
            }

            if (newPosition === vessel.posicion) {
                window.UI.showInfo('ℹ️ Sin Cambios', 'La embarcación ya está en esa posición');
                return;
            }

            const confirmBtn = document.getElementById('confirmPositionBtn');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<div class="spinner"></div> Reorganizando...';
            }

            Haptics.heavy();

            // Reorganizar posiciones
            let updatedVessels = [...vessels];
            
            // Remover embarcación de posición actual
            const vesselIndex = updatedVessels.findIndex(v => v.id === vessel.id);
            const [movedVessel] = updatedVessels.splice(vesselIndex, 1);
            
            // Insertar en nueva posición
            updatedVessels.splice(newPosition - 1, 0, movedVessel);
            
            // Recalcular todas las posiciones
            const updates = updatedVessels.map((v, index) => ({
                id: v.id,
                data: { posicion: index + 1 }
            }));

            const result = await window.Database.updateMultipleEmbarcaciones(updates);

            if (result.success) {
                window.UI.closeModal('position-modal');
                window.UI.showSuccess('🔄 Posición Actualizada', `${vessel.nombre} movida a posición ${newPosition}`);
                Haptics.success();
            } else {
                window.UI.showError('❌ Error', 'No se pudo cambiar la posición');
            }

        } catch (error) {
            console.error('Error cambiando posición:', error);
            window.UI.showError('❌ Error', 'Error inesperado al cambiar posición');
        }
    }

    // ===========================
    // UTILIDADES ADICIONALES
    // ===========================
    
    // Validar estado de embarcación antes de acción
    validateVesselAction(vessel, action) {
        switch (action) {
            case 'zarpar':
                if (vessel.estado !== CONFIG.ESTADOS.EMBARCANDO) {
                    return { valid: false, message: 'Solo las embarcaciones embarcando pueden zarpar' };
                }
                break;
                
            case 'delete':
                if (vessel.estado === CONFIG.ESTADOS.EMBARCANDO) {
                    return { valid: false, message: 'No se puede eliminar una embarcación que está embarcando' };
                }
                break;
                
            case 'change-status':
                // Siempre válido, las validaciones específicas están en changeVesselStatus
                break;
                
            default:
                return { valid: true };
        }
        
        return { valid: true };
    }

    // Obtener próxima embarcación que puede embarcar
    getNextToEmbark(categoria) {
        const vessels = this.embarcaciones[categoria] || [];
        
        // Encontrar la primera embarcación EN TURNO que puede embarcar
        for (const vessel of vessels.sort((a, b) => a.posicion - b.posicion)) {
            if (vessel.estado === CONFIG.ESTADOS.EN_TURNO && this.canEmbark(vessel.posicion, vessels)) {
                return vessel;
            }
        }
        
        return null;
    }

    // Obtener embarcaciones por estado
    getVesselsByStatus(categoria, estado) {
        const vessels = this.embarcaciones[categoria] || [];
        return vessels.filter(v => v.estado === estado);
    }

    // Verificar si hay embarcaciones embarcando
    hasEmbarcando(categoria) {
        return this.getVesselsByStatus(categoria, CONFIG.ESTADOS.EMBARCANDO).length > 0;
    }

    // Obtener total de embarcaciones activas
    getTotalActiveVessels() {
        let total = 0;
        Object.values(this.embarcaciones).forEach(categoria => {
            total += categoria.length;
        });
        return total;
    }

    // Verificar consistencia de posiciones
    validatePositions(categoria) {
        const vessels = this.embarcaciones[categoria] || [];
        const positions = vessels.map(v => v.posicion).sort((a, b) => a - b);
        
        for (let i = 0; i < positions.length; i++) {
            if (positions[i] !== i + 1) {
                console.warn(`Inconsistencia en posiciones de categoría ${categoria}:`, positions);
                return false;
            }
        }
        
        return true;
    }

    // Reparar posiciones inconsistentes
    async repairPositions(categoria) {
        try {
            const vessels = this.embarcaciones[categoria] || [];
            const updates = vessels
                .sort((a, b) => a.posicion - b.posicion)
                .map((vessel, index) => ({
                    id: vessel.id,
                    data: { posicion: index + 1 }
                }));

            const result = await window.Database.updateMultipleEmbarcaciones(updates);
            
            if (result.success) {
                return true;
            }
            
        } catch (error) {
            console.error('Error reparando posiciones:', error);
        }
        
        return false;
    }

    // ===========================
    // UTILIDADES DE CONSULTA
    // ===========================
    
    // Limpiar listeners
    cleanup() {
        this.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners = [];
    }

    // Obtener embarcaciones por categoría
    getVesselsByCategory(categoria) {
        return this.embarcaciones[categoria] || [];
    }

    // Obtener estadísticas de categoría
    getCategoryStats(categoria) {
        const vessels = this.getVesselsByCategory(categoria);
        
        return {
            total: vessels.length,
            embarcando: vessels.filter(v => v.estado === CONFIG.ESTADOS.EMBARCANDO).length,
            enTurno: vessels.filter(v => v.estado === CONFIG.ESTADOS.EN_TURNO).length,
            suspendidas: vessels.filter(v => v.estado === CONFIG.ESTADOS.SUSPENDIDO).length,
            reservadas: vessels.filter(v => v.estado === CONFIG.ESTADOS.RESERVA).length
        };
    }

    // Debug: Mostrar estado actual
    debugState() {       
        Object.entries(this.embarcaciones).forEach(([categoria, vessels]) => {
            console.group(`📁 ${categoria.toUpperCase()} (${vessels.length})`);
            
            vessels.forEach(vessel => {
                console.log();
            });
            
            // Verificar consistencia
            if (!this.validatePositions(categoria)) {
                console.warn('⚠️ Posiciones inconsistentes detectadas');
            }
            
            console.groupEnd();
        });
    }

    // Verificar reglas de negocio
    validateBusinessRules(categoria) {
        const vessels = this.getVesselsByCategory(categoria);
        const issues = [];

        // Verificar posiciones consecutivas
        if (!this.validatePositions(categoria)) {
            issues.push('Posiciones no consecutivas');
        }

        // Verificar embarque consecutivo
        const embarcando = this.getVesselsByStatus(categoria, CONFIG.ESTADOS.EMBARCANDO);
        const positions = embarcando.map(v => v.posicion).sort((a, b) => a - b);
        
        for (let i = 1; i < positions.length; i++) {
            if (positions[i] !== positions[i-1] + 1) {
                issues.push('Embarque no consecutivo detectado');
                break;
            }
        }

        // Verificar que no haya más de una embarcación por posición
        const positionCount = {};
        vessels.forEach(v => {
            positionCount[v.posicion] = (positionCount[v.posicion] || 0) + 1;
        });

        Object.entries(positionCount).forEach(([pos, count]) => {
            if (count > 1) {
                issues.push(`Posición ${pos} duplicada`);
            }
        });

        return {
            isValid: issues.length === 0,
            issues: issues
        };
    }

    // Obtener siguiente acción recomendada
    getRecommendedAction(categoria) {
        const vessels = this.getVesselsByCategory(categoria);
        
        if (vessels.length === 0) {
            return { action: 'add', message: 'Agregar primera embarcación' };
        }

        const embarcando = this.getVesselsByStatus(categoria, CONFIG.ESTADOS.EMBARCANDO);
        const enTurno = this.getVesselsByStatus(categoria, CONFIG.ESTADOS.EN_TURNO);

        if (embarcando.length === 0 && enTurno.length > 0) {
            const firstEnTurno = enTurno.sort((a, b) => a.posicion - b.posicion)[0];
            return { 
                action: 'embark', 
                message: `Embarcar ${firstEnTurno.nombre} (Pos. ${firstEnTurno.posicion})`,
                vessel: firstEnTurno
            };
        }

        if (embarcando.length > 0) {
            const firstEmbarcando = embarcando.sort((a, b) => a.posicion - b.posicion)[0];
            return {
                action: 'zarpar',
                message: `Zarpar ${firstEmbarcando.nombre} (Pos. ${firstEmbarcando.posicion})`,
                vessel: firstEmbarcando
            };
        }

        return { action: 'none', message: 'No hay acciones recomendadas' };
    }
}

// ===========================
// INSTANCIA GLOBAL
// ===========================
const embarcacionesManager = new EmbarcacionesManager();

// Exportar para uso en otros módulos
export default embarcacionesManager;

// Hacer disponible globalmente
window.Embarcaciones = embarcacionesManager;