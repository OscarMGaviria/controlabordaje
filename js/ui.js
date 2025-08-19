// ===========================
// MÓDULO DE INTERFAZ DE USUARIO
// ===========================

import { CONFIG, ESTADO_ICONS, ESTADO_COLORS } from './config.js';
import { DOM, Animate, Haptics, Time, Format, ID } from './utils.js';

class UIManager {
    constructor() {
        this.currentView = null;
        this.activeAlerts = new Map();
        this.activeModals = new Map();
    }

    // ===========================
    // GESTIÓN DE VISTAS
    // ===========================
    
    // Cambiar entre estilos CSS según el rol
    setUserRole(role) {
        const adminStyles = DOM.find('#admin-styles');
        const operadorStyles = DOM.find('#operador-styles');
        
        // USAR SIEMPRE ESTILO OPERADOR PARA AMBOS ROLES
        if (adminStyles) adminStyles.disabled = true;
        if (operadorStyles) operadorStyles.disabled = false;
    }

    // Renderizar vista principal
    renderMainView(role) {
        const app = DOM.find('#app');
        if (!app) return;

        // USAR SIEMPRE CLASES OPERADOR
        const headerClass = 'operador-header';
        const panelClass = 'operador-panel';
        
        app.innerHTML = `
            <header class="${headerClass}">
                <div class="header-title">
                    Admin Embarcaciones
                    <span class="role-badge">${role === CONFIG.ROLES.ADMIN ? 'ADMIN' : 'OPERADOR'}</span>
                </div>
                <button id="logoutBtn" class="btn btn-error touch-target">
                    <i class="fas fa-sign-out-alt"></i>
                    Salir
                </button>
            </header>
            
            <div class="${panelClass}">
                ${role === CONFIG.ROLES.ADMIN ? this.renderAdminControls() : ''}
                <div id="categoryTabs" class="category-nav"></div>
                <div id="vesselsContainer" class="vessels-container"></div>
            </div>
        `;

        this.setupMainViewEvents();
        this.renderCategoryTabs();
    }

    // Reemplaza la función renderAdminControls completa:
    renderAdminControls() {
        return `
            <div class="admin-controls-operador-style">
                <button id="addVesselBtn" class="operador-action-btn touch-target">
                    <i class="fas fa-plus"></i>
                    Agregar Embarcación
                </button>
                <button id="viewStatsBtn" class="operador-action-btn touch-target">
                    <i class="fas fa-chart-bar"></i>
                    Estadísticas
                </button>
                <button id="manageVesselsBtn" class="operador-action-btn touch-target">
                    <i class="fas fa-cogs"></i>
                    Gestionar
                </button>
            </div>
        `;
    }

    // Funciones especiales (verificar reserva, cambiar categoría)
    renderSpecialFunctions() {
        return `
            <div class="special-functions">
                <h3><i class="fas fa-tools"></i> Funciones Especiales</h3>
                <div class="function-grid">
                    <div class="function-item" data-function="verificar">
                        <i class="fas fa-id-card"></i>
                        <h4>Verificar Reserva</h4>
                        <p>Buscar reservas por documento</p>
                    </div>
                    <div class="function-item" data-function="cambiar-categoria">
                        <i class="fas fa-exchange-alt"></i>
                        <h4>Cambiar Categoría</h4>
                        <p>Modificar ventas del día</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Renderizar pestañas de categorías
    renderCategoryTabs() {
        const tabsContainer = DOM.find('#categoryTabs');
        if (!tabsContainer) return;

        let tabsHTML = '';
        
        // Categorías normales
        Object.entries(CONFIG.CATEGORIAS).forEach(([key, categoria]) => {
            tabsHTML += `
                <button class="category-btn touch-target" data-category="${key}">
                    <i class="${categoria.icon}"></i>
                    ${categoria.nombre}
                </button>
            `;
        });

        // Botón de funciones especiales
        tabsHTML += `
            <button class="category-btn special-functions-btn touch-target" data-category="funciones-especiales">
                <i class="fas fa-tools"></i>
                Funciones Especiales
            </button>
        `;

        tabsContainer.innerHTML = tabsHTML;
        this.setupCategoryTabs();
    }

    // ===========================
    // RENDERIZADO DE EMBARCACIONES
    // ===========================
    
    // Renderizar lista de embarcaciones
    renderVessels(categoria, vessels, userRole) {
        const container = DOM.find('#vesselsContainer');
        if (!container) return;

        if (!vessels || vessels.length === 0) {
            container.innerHTML = `
                <div class="no-vessels">
                    <i class="fas fa-ship" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                    <h3>No hay embarcaciones</h3>
                    <p>No se encontraron embarcaciones en la categoría "${CONFIG.CATEGORIAS[categoria]?.nombre || categoria}"</p>
                </div>
            `;
            return;
        }

        let vesselsHTML = '';
        
        vessels.forEach(vessel => {
            vesselsHTML += this.renderVesselCard(vessel, userRole);
        });

        container.innerHTML = `
            <div class="vessels-grid">
                ${vesselsHTML}
            </div>
        `;

        this.setupVesselEvents();
        

    }



    // Renderizar tarjeta individual de embarcación
    renderVesselCard(vessel, userRole) {
        // SIEMPRE USAR ESTILO OPERADOR
        const cardClass = 'vessel-card operador';
        const actionsClass = 'vessel-actions operador';
        const statusIcon = ESTADO_ICONS[vessel.estado] || 'fas fa-question';
        const statusClass = `estado-${vessel.estado.toLowerCase().replace(' ', '-')}`;

        return `
            <div class="${cardClass}" data-vessel-id="${vessel.id}">
                <div class="vessel-header">
                    <div class="vessel-name">${vessel.nombre}</div>
                    <div class="vessel-position">Pos. ${vessel.posicion}</div>
                </div>
                
                <div class="vessel-status">
                    <div class="current-status ${statusClass}">
                        <i class="${statusIcon}"></i>
                        ${vessel.estado}
                    </div>
                </div>

                <div class="vessel-info">
                    <div class="info-item">
                        <i class="fas fa-users"></i>
                        <span>Capacidad: ${vessel.capacidad || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-tag"></i>
                        <span>Categoría: ${CONFIG.CATEGORIAS[vessel.categoria]?.nombre || vessel.categoria}</span>
                    </div>
                </div>
                
                <div class="vessel-separator"></div>
                
                <div class="${actionsClass}">
                    ${this.renderVesselActions(vessel, userRole)}
                </div>
            </div>
        `;
    }

    // Renderizar acciones de embarcación según rol
    renderVesselActions(vessel, userRole) {
        let actionsHTML = '';

        // Acción cambiar estado (todos los usuarios)
        actionsHTML += `
            <button class="operador-action-btn estado touch-target" 
                    data-action="change-status" 
                    data-vessel-id="${vessel.id}">
                <i class="fas fa-exchange-alt"></i>
                Cambiar Estado
            </button>
        `;

        // Acción zarpar (solo si está embarcando)
        if (vessel.estado === CONFIG.ESTADOS.EMBARCANDO) {
            actionsHTML += `
                <button class="operador-action-btn zarpar touch-target" 
                        data-action="zarpar" 
                        data-vessel-id="${vessel.id}">
                    <i class="fas fa-anchor"></i>
                    Zarpar
                </button>
            `;
        }

        // Acciones específicas de admin CON ESTILO OPERADOR
        if (userRole === CONFIG.ROLES.ADMIN) {
            actionsHTML += `
                <button class="operador-action-btn edit touch-target" 
                        data-action="edit" 
                        data-vessel-id="${vessel.id}">
                    <i class="fas fa-edit"></i>
                    Editar
                </button>
                <button class="operador-action-btn position touch-target" 
                        data-action="change-position" 
                        data-vessel-id="${vessel.id}">
                    <i class="fas fa-sort-numeric-up"></i>
                    Posición
                </button>
                <button class="operador-action-btn delete touch-target" 
                        data-action="delete" 
                        data-vessel-id="${vessel.id}">
                    <i class="fas fa-trash"></i>
                    Eliminar
                </button>
            `;
        }

        return actionsHTML;
    }

    // ===========================
    // SISTEMA DE ALERTAS
    // ===========================
    
    // Mostrar alerta
    showAlert(type, title, message, duration = 5000) {
        const alertId = ID.generate();
        const alertsContainer = DOM.find('#alerts');
        
        if (!alertsContainer) return;

        const alertElement = DOM.create('div', `alert ${type}`, `
            <div class="alert-content">
                <div class="alert-title">
                    <i class="${this.getAlertIcon(type)}"></i>
                    ${title}
                </div>
                <div class="alert-message">${message}</div>
            </div>
            <button class="alert-close" onclick="window.UI.closeAlert('${alertId}')">
                <i class="fas fa-times"></i>
            </button>
        `);

        alertElement.id = alertId;
        alertsContainer.appendChild(alertElement);
        
        // Mostrar con animación
        requestAnimationFrame(() => {
            DOM.addClass(alertElement, 'show');
        });

        this.activeAlerts.set(alertId, alertElement);

        // Auto-cerrar
        if (duration > 0) {
            setTimeout(() => {
                this.closeAlert(alertId);
            }, duration);
        }

        // Haptic feedback
        Haptics[type === 'success' ? 'success' : type === 'error' ? 'error' : 'light']();

        return alertId;
    }

    // Cerrar alerta
    closeAlert(alertId) {
        const alert = this.activeAlerts.get(alertId);
        if (!alert) return;

        DOM.removeClass(alert, 'show');
        
        setTimeout(() => {
            DOM.remove(alert);
            this.activeAlerts.delete(alertId);
        }, CONFIG.UI.ANIMATION_DURATION);
    }

    // Obtener icono para tipo de alerta
    getAlertIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-triangle',
            warning: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || 'fas fa-bell';
    }

    // Métodos de conveniencia para alertas
    showSuccess(title, message, duration) {
        return this.showAlert('success', title, message, duration);
    }

    showError(title, message, duration) {
        return this.showAlert('error', title, message, duration);
    }

    showWarning(title, message, duration) {
        return this.showAlert('warning', title, message, duration);
    }

    showInfo(title, message, duration) {
        return this.showAlert('info', title, message, duration);
    }

    // ===========================
    // SISTEMA DE MODALES
    // ===========================
    
    // Mostrar modal
    showModal(modalContent, options = {}) {
        const modalId = ID.generate();
        const modalsContainer = DOM.find('#modals');
        
        if (!modalsContainer) return;

        const modalOverlay = DOM.create('div', 'modal-overlay', `
            <div class="modal-content ${options.className || ''}">
                ${modalContent}
            </div>
        `);

        modalOverlay.id = modalId;
        modalsContainer.appendChild(modalOverlay);

        // Evento para cerrar al hacer clic fuera
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeModal(modalId);
            }
        });

        // Mostrar con animación
        requestAnimationFrame(() => {
            DOM.addClass(modalOverlay, 'active');
        });

        this.activeModals.set(modalId, modalOverlay);
        Haptics.medium();

        return modalId;
    }

    // Cerrar modal
    closeModal(modalId) {
        const modal = this.activeModals.get(modalId);
        if (!modal) return;

        DOM.removeClass(modal, 'active');
        
        setTimeout(() => {
            DOM.remove(modal);
            this.activeModals.delete(modalId);
        }, CONFIG.UI.ANIMATION_DURATION);

        Haptics.light();
    }

    // ===========================
    // EVENTOS Y LISTENERS
    // ===========================
    
    // Configurar eventos de vista principal
    setupMainViewEvents() {
        // Botón logout
        const logoutBtn = DOM.find('#logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                    window.Auth.logout();
                }
            });
        }

        // Botones de admin
        const addVesselBtn = DOM.find('#addVesselBtn');
        if (addVesselBtn) {
            addVesselBtn.addEventListener('click', () => {
                window.Embarcaciones.showAddVesselModal();
            });
        }

        const viewStatsBtn = DOM.find('#viewStatsBtn');
        if (viewStatsBtn) {
            viewStatsBtn.addEventListener('click', () => {
                this.showStatsModal();
            });
        }

        // Funciones especiales
        const functionItems = DOM.findAll('.function-item');
        functionItems.forEach(item => {
            item.addEventListener('click', () => {
                const functionType = item.dataset.function;
                this.handleSpecialFunction(functionType);
            });
        });
    }

    // Configurar eventos de pestañas de categorías
    setupCategoryTabs() {
        const categoryBtns = DOM.findAll('.category-btn');
        
        categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remover clase activa de todas las pestañas
                categoryBtns.forEach(b => DOM.removeClass(b, 'active'));
                
                // Activar pestaña actual
                DOM.addClass(btn, 'active');
                
                // Obtener categoría
                const categoria = btn.dataset.category;
                
                if (categoria === 'funciones-especiales') {
                    // Mostrar funciones especiales
                    this.showSpecialFunctionsView();
                } else {
                    // Cargar embarcaciones normales
                    window.Embarcaciones.loadCategory(categoria);
                }
                
                Haptics.light();
            });
        });
    }

    // Mostrar vista de funciones especiales
    showSpecialFunctionsView() {
        const container = DOM.find('#vesselsContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="special-functions-view">
                <div class="special-header">
                    <i class="fas fa-tools"></i>
                    <h2>Funciones Especiales</h2>
                    <p>Herramientas adicionales para gestión</p>
                </div>
                
                <div class="function-grid">
                    <div class="function-item" data-function="verificar">
                        <div class="function-icon">
                            <i class="fas fa-id-card"></i>
                        </div>
                        <h3>Verificar Reserva</h3>
                        <p>Buscar y verificar reservas por documento</p>
                        <div class="function-badge">Disponible</div>
                    </div>
                    
                    <div class="function-item" data-function="cambiar-categoria">
                        <div class="function-icon">
                            <i class="fas fa-exchange-alt"></i>
                        </div>
                        <h3>Cambiar Categoría</h3>
                        <p>Modificar categoría de ventas del día</p>
                        <div class="function-badge">Disponible</div>
                    </div>
                </div>
            </div>
        `;

        this.setupSpecialFunctionsEvents();
    }

    // Configurar eventos de funciones especiales
    setupSpecialFunctionsEvents() {
        const functionItems = DOM.findAll('.function-item');
        functionItems.forEach(item => {
            item.addEventListener('click', () => {
                const functionType = item.dataset.function;
                this.handleSpecialFunction(functionType);
                Haptics.medium();
            });
        });
    }


    // Configurar eventos de embarcaciones
    setupVesselEvents() {
        const actionBtns = DOM.findAll('[data-action]');
        
        actionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const vesselId = btn.dataset.vesselId;
                
                window.Embarcaciones.handleVesselAction(action, vesselId);
                Haptics.light();
            });
        });
    }

    // Manejar funciones especiales
    handleSpecialFunction(functionType) {
        switch (functionType) {
            case 'verificar':
                this.showVerificarReservaModal();
                break;
            case 'cambiar-categoria':
                this.showCambiarCategoriaModal();
                break;
        }
    }

    // ===========================
    // MODALES ESPECÍFICOS
    // ===========================
    
    // Modal de estadísticas
    async showStatsModal() {
        try {
            const stats = await window.Database.getDayStats();
            
            const modalContent = `
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="fas fa-chart-bar"></i>
                        Estadísticas del Día
                    </h3>
                    <button class="modal-close" id="modalCloseStats">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="admin-stats">
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-ship"></i></div>
                        <div class="stat-number">${stats.totalEmbarcaciones}</div>
                        <div class="stat-label">Total Embarcaciones</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-anchor"></i></div>
                        <div class="stat-number">${stats.totalZarpes}</div>
                        <div class="stat-label">Zarpes Hoy</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-users"></i></div>
                        <div class="stat-number">${stats.totalPasajeros}</div>
                        <div class="stat-label">Pasajeros</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
                        <div class="stat-number">${Format.currency(stats.ingresoTotal)}</div>
                        <div class="stat-label">Ingresos</div>
                    </div>
                </div>
                
                <div class="stats-details">
                    <h4>Estado de Embarcaciones</h4>
                    <div class="status-stats">
                        <div class="status-item">
                            <i class="fas fa-ship estado-embarcando"></i>
                            <span>Embarcando: ${stats.embarcando}</span>
                        </div>
                        <div class="status-item">
                            <i class="fas fa-clock estado-en-turno"></i>
                            <span>En Turno: ${stats.enTurno}</span>
                        </div>
                        <div class="status-item">
                            <i class="fas fa-ban estado-suspendido"></i>
                            <span>Suspendidas: ${stats.suspendidas}</span>
                        </div>
                        <div class="status-item">
                            <i class="fas fa-bookmark estado-reserva"></i>
                            <span>Reservadas: ${stats.reservadas}</span>
                        </div>
                    </div>
                </div>
            `;
            
            const modalId = this.showModal(modalContent, { className: 'modal-operador' });
            
            // Configurar eventos
            setTimeout(() => {
                const closeBtn = DOM.find('#modalCloseStats');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        this.closeModal(modalId);
                    });
                }
            }, 100);
            
        } catch (error) {
            this.showError('Error', 'No se pudieron cargar las estadísticas');
        }
    }

    // Modal verificar reserva
    showVerificarReservaModal() {
        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fas fa-id-card"></i>
                    Verificar Reserva
                </h3>
                <button class="modal-close" id="modalCloseReserva">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="operador-form">
                <div class="form-group">
                    <label class="form-label" for="documentoReserva">
                        <i class="fas fa-id-card"></i>
                        Número de Documento
                    </label>
                    <input 
                        type="number" 
                        id="documentoReserva" 
                        class="form-input touch-target"
                        placeholder="Ej: 12345678"
                        required
                    >
                </div>
                
                <button id="buscarReservaBtn" class="btn btn-info touch-target" style="width: 100%;">
                    <i class="fas fa-search"></i>
                    Buscar Reserva
                </button>
                
                <div id="reservaResult" style="margin-top: 1rem;"></div>
            </div>
        `;
        
        const modalId = this.showModal(modalContent, { className: 'modal-operador' });
        
        // Configurar eventos
        setTimeout(() => {
            const buscarBtn = DOM.find('#buscarReservaBtn');
            const documentoInput = DOM.find('#documentoReserva');
            const closeBtn = DOM.find('#modalCloseReserva');
            
            if (buscarBtn && documentoInput) {
                buscarBtn.addEventListener('click', () => {
                    window.Modals.buscarReserva(documentoInput.value);
                });
                
                documentoInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        window.Modals.buscarReserva(documentoInput.value);
                    }
                });
                
                documentoInput.focus();
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.closeModal(modalId);
                });
            }
        }, 100);
    }


    // Modal cambiar categoría
    showCambiarCategoriaModal() {
        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fas fa-exchange-alt"></i>
                    Cambiar Categoría de Venta
                </h3>
                <button class="modal-close" id="modalCloseCategoria">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="operador-form">
                <div class="form-group">
                    <label class="form-label" for="documentoVenta">
                        <i class="fas fa-id-card"></i>
                        Número de Documento
                    </label>
                    <input 
                        type="text" 
                        id="documentoVenta" 
                        class="form-input touch-target"
                        placeholder="Ej: 12345678"
                        required
                    >
                </div>
                
                <button id="buscarVentaBtn" class="btn btn-warning touch-target" style="width: 100%;">
                    <i class="fas fa-search"></i>
                    Buscar Venta
                </button>
                
                <div id="ventaResult" style="margin-top: 1rem;"></div>
            </div>
        `;
        
        const modalId = this.showModal(modalContent, { className: 'modal-operador' });
        
        // Configurar eventos
        setTimeout(() => {
            const buscarBtn = DOM.find('#buscarVentaBtn');
            const documentoInput = DOM.find('#documentoVenta');
            const closeBtn = DOM.find('#modalCloseCategoria');
            
            if (buscarBtn && documentoInput) {
                buscarBtn.addEventListener('click', () => {
                    window.Modals.buscarVenta(documentoInput.value);
                });
                
                documentoInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        window.Modals.buscarVenta(documentoInput.value);
                    }
                });
                
                documentoInput.focus();
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.closeModal(modalId);
                });
            }
        }, 100);
    }



    // ===========================
    // UTILIDADES
    // ===========================
    
    // Generar ID único para modal
    generateModalId() {
        return 'modal_' + ID.generate();
    }

    // Mostrar loading
    showLoading(message = 'Cargando...') {
        const app = DOM.find('#app');
        if (!app) return;

        app.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
    }

    // Limpiar alertas y modales
    cleanup() {
        this.activeAlerts.forEach((alert, id) => {
            this.closeAlert(id);
        });
        
        this.activeModals.forEach((modal, id) => {
            this.closeModal(id);
        });
    }
}

// ===========================
// INSTANCIA GLOBAL
// ===========================
const uiManager = new UIManager();

// Exportar para uso en otros módulos
export default uiManager;

// Hacer disponible globalmente
window.UI = uiManager;