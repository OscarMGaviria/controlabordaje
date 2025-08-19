// ===========================
// MÓDULO PRINCIPAL - INICIALIZACIÓN
// ===========================

import { CONFIG } from './config.js';
import { Viewport, Network, Haptics, DOM } from './utils.js';
import authManager from './auth.js';
import databaseManager from './database.js';
import uiManager from './ui.js';
import embarcacionesManager from './embarcaciones.js';
import modalsManager from './modals.js';

class AppManager {
    constructor() {
        this.isInitialized = false;
        this.isOnline = true;
        this.currentUser = null;
        this.currentRole = CONFIG.ROLES.OPERADOR;
    }

    // ===========================
    // INICIALIZACIÓN DE LA APP
    // ===========================
    
    async init() {
        try {
            
            // Mostrar loading inicial
            uiManager.showLoading('Inicializando aplicación...');
            
            // 1. Configurar viewport y utilidades básicas
            this.setupBasicFeatures();
            
            // 2. Inicializar Firebase y autenticación
            await this.initializeAuth();
            
            // 3. Configurar eventos globales
            this.setupGlobalEvents();
            
            // 4. Configurar detección de red
            this.setupNetworkDetection();
            
            // 5. Configurar PWA
            this.setupPWA();
        
            this.isInitialized = true;
            
        } catch (error) {
            this.showInitializationError(error);
        }
    }

    // ===========================
    // CONFIGURACIÓN BÁSICA
    // ===========================
    
    setupBasicFeatures() {
        // Configurar viewport para iOS
        Viewport.init();
        
        // Prevenir comportamientos por defecto en móviles
        this.preventMobileDefaults();
        
        // Configurar teclas de acceso rápido
        this.setupKeyboardShortcuts();
        
    }

    preventMobileDefaults() {
        // Prevenir zoom en inputs
        document.addEventListener('touchstart', function() {}, { passive: true });
        
        // Prevenir pull-to-refresh
        document.body.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            
            const startY = e.touches[0].pageY;
            let element = e.target;
            
            while (element && element !== document.body) {
                if (element.scrollTop > 0) return;
                element = element.parentElement;
            }
            
            if (startY <= 10) {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.body.addEventListener('touchmove', (e) => {
            const element = e.target;
            let scrollable = false;
            
            while (element && element !== document.body) {
                if (element.scrollHeight > element.clientHeight) {
                    scrollable = true;
                    break;
                }
                element = element.parentElement;
            }
            
            if (!scrollable) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // ESC para cerrar modales
            if (e.key === 'Escape') {
                modalsManager.closeAllModals();
            }
            
            // Ctrl/Cmd + R para recargar (solo si está autenticado)
            if ((e.ctrlKey || e.metaKey) && e.key === 'r' && this.currentUser) {
                e.preventDefault();
                this.reloadApp();
            }
            
            // Ctrl/Cmd + L para logout
            if ((e.ctrlKey || e.metaKey) && e.key === 'l' && this.currentUser) {
                e.preventDefault();
                this.handleLogout();
            }
        });
    }

    // ===========================
    // INICIALIZACIÓN DE AUTH
    // ===========================
    
    async initializeAuth() {
        try {
            // Inicializar sistema de autenticación
            await authManager.init();
            
            // Configurar callbacks de autenticación
            authManager.onAuthChange((isAuthenticated, user, role) => {
                this.handleAuthChange(isAuthenticated, user, role);
            });     
        } catch (error) {

            throw new Error('');
        }
    }

    async handleAuthChange(isAuthenticated, user, role) {
        this.currentUser = user;
        this.currentRole = role;
        
        if (isAuthenticated) {
            await this.onUserLogin(user, role);
        } else {
            await this.onUserLogout();
        }
    }

    async onUserLogin(user, role) {
        try {
            console.log(`👤 Usuario autenticado: ${user.email} (${role})`);
            
            // Configurar CSS según el rol
            uiManager.setUserRole(role);
            
            // Mostrar vista principal
            uiManager.renderMainView(role);
            
            // Inicializar módulos que requieren autenticación
            await this.initializeAuthenticatedModules();
            
            // Mostrar mensaje de bienvenida
            uiManager.showSuccess(
                `👋 Bienvenido${role === CONFIG.ROLES.ADMIN ? ' Administrador' : ''}`,
                `Sesión iniciada como ${user.email.split('@')[0]}`,
                3000
            );
            
            Haptics.success();
            
        } catch (error) {
            console.error('❌ Error en login:', error);
            uiManager.showError('Error', 'Problema al cargar el panel de control');
        }
    }

    async onUserLogout() {
        try {         
            // Limpiar módulos
            this.cleanupAuthenticatedModules();
            
            // Mostrar pantalla de login
            this.showLoginScreen();
            
            // Limpiar datos sensibles
            this.clearSensitiveData();
            
        } catch (error) {
            console.error('❌ Error en logout:', error);
        }
    }

    async initializeAuthenticatedModules() {
        try {
            // Inicializar gestión de embarcaciones
            await embarcacionesManager.init();
            
            // Verificar conectividad de base de datos
            const isConnected = await databaseManager.testConnection();
            if (!isConnected) {
                throw new Error('No se pudo conectar con la base de datos');
            }
            
            console.log('✅ Módulos autenticados inicializados');
            
        } catch (error) {
            console.error('❌ Error inicializando módulos autenticados:', error);
            uiManager.showError('Error de Conexión', 'Problemas conectando con el servidor');
            throw error;
        }
    }

    cleanupAuthenticatedModules() {
        // Limpiar listeners de embarcaciones
        embarcacionesManager.cleanup();
        
        // Limpiar listeners de base de datos
        databaseManager.cleanupListeners();
        
        // Cerrar modales
        modalsManager.closeAllModals();
        
        // Limpiar UI
        uiManager.cleanup();
    }

    showLoginScreen() {
        const app = DOM.find('#app');
        if (app) {
            app.innerHTML = authManager.renderLoginForm();
            authManager.setupLoginForm();
        }
    }

    clearSensitiveData() {
        // Limpiar cache de base de datos
        databaseManager.clearCache();
        
        // No limpiar localStorage completamente para mantener preferencias
        // pero sí datos sensibles específicos
    }

    // ===========================
    // EVENTOS GLOBALES
    // ===========================
    
    setupGlobalEvents() {
        // Manejo de errores globales
        window.addEventListener('error', (e) => {
            console.error('Error global:', e.error);
            this.handleGlobalError(e.error);
        });
        
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Promise rechazado:', e.reason);
            this.handleGlobalError(e.reason);
        });
        
        // Visibilidad de la página
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onAppHidden();
            } else {
                this.onAppVisible();
            }
        });
        
        // Cambios de orientación
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                Viewport.setVH();
                this.handleOrientationChange();
            }, 100);
        });
        
    }

    handleGlobalError(error) {
        // No mostrar errores en producción a menos que sean críticos
        if (error && error.message && !error.message.includes('Script error')) {
            console.error('Error capturado:', error);
            
            // Solo mostrar errores críticos al usuario
            if (this.isCriticalError(error)) {
                uiManager.showError('Error Inesperado', 'Se produjo un error. Intenta recargar la página.');
            }
        }
    }

    isCriticalError(error) {
        const criticalPatterns = [
            'Firebase',
            'Network',
            'Database',
            'Authentication',
            'Permission denied'
        ];
        
        return criticalPatterns.some(pattern => 
            error.message && error.message.includes(pattern)
        );
    }

    onAppHidden() {
        // Pausar actualizaciones innecesarias cuando la app no es visible
       
    }

    onAppVisible() {
        // Reanudar actualizaciones cuando la app vuelve a ser visible
        
        // Verificar conectividad
        if (this.currentUser) {
            this.checkConnectivity();
        }
    }

    handleOrientationChange() {
        // Ajustar UI según orientación
        setTimeout(() => {
            // Re-calcular posiciones de elementos si es necesario
            this.adjustUIForOrientation();
        }, 300);
    }

    adjustUIForOrientation() {
        // Lógica específica para ajustes de orientación
        const isLandscape = window.innerWidth > window.innerHeight;
        
        if (isLandscape) {
            document.body.classList.add('landscape');
            document.body.classList.remove('portrait');
        } else {
            document.body.classList.add('portrait');
            document.body.classList.remove('landscape');
        }
    }

    // ===========================
    // DETECCIÓN DE RED
    // ===========================
    
    setupNetworkDetection() {
        this.isOnline = Network.isOnline();
        
        Network.onOnline(() => {
            this.handleNetworkOnline();
        });
        
        Network.onOffline(() => {
            this.handleNetworkOffline();
        });
        
    }

    handleNetworkOnline() {
        this.isOnline = true;
        console.log('🌐 Conexión restaurada');
        
        if (this.currentUser) {
            uiManager.showSuccess('🌐 Conexión Restaurada', 'La aplicación está nuevamente en línea', 3000);
            Haptics.success();
            
            // Reintentar operaciones pendientes
            this.retryPendingOperations();
        }
    }

    handleNetworkOffline() {
        this.isOnline = false;
        console.log('🌐 Conexión perdida');
        
        if (this.currentUser) {
            uiManager.showWarning('📶 Sin Conexión', 'Verifica tu conexión a internet. Algunas funciones pueden no estar disponibles.', 5000);
            Haptics.error();
        }
    }

    async retryPendingOperations() {
        try {
            // Verificar conectividad de base de datos
            const isConnected = await databaseManager.testConnection();
            
            if (isConnected && this.currentUser) {
                console.log('✅ Reconexión exitosa a la base de datos');
            }
            
        } catch (error) {
            console.error('❌ Error en reconexión:', error);
        }
    }

    async checkConnectivity() {
        try {
            const isConnected = await databaseManager.testConnection();
            
            if (!isConnected && this.isOnline) {
                uiManager.showWarning('⚠️ Problemas de Conexión', 'Hay problemas conectando con el servidor');
            }
            
        } catch (error) {
            console.warn('Error verificando conectividad:', error);
        }
    }

    // ===========================
    // PWA CONFIGURATION
    // ===========================
    
    setupPWA() {
        // Registrar Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('✅ Service Worker registrado:', registration.scope);
                })
                .catch((registrationError) => {
                    console.warn('⚠️ Error registrando Service Worker:', registrationError);
                });
        }
        
        // Manejar instalación de PWA
        this.setupPWAInstallation();
        
        // Configurar notificaciones si están disponibles
        this.setupNotifications();
    }

    setupPWAInstallation() {
        let deferredPrompt = null;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Mostrar botón de instalación personalizado si el usuario está autenticado
            if (this.currentUser) {
                this.showPWAInstallButton(deferredPrompt);
            }
        });
        
        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA instalada exitosamente');
            deferredPrompt = null;
            
            if (this.currentUser) {
                uiManager.showSuccess('📱 App Instalada', 'La aplicación se ha instalado correctamente', 4000);
            }
        });
    }

    showPWAInstallButton(deferredPrompt) {
        const installBtn = DOM.create('button', 'btn btn-info pwa-install-btn', `
            <i class="fas fa-mobile-alt"></i>
            Instalar App
        `);
        
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    console.log('✅ Usuario aceptó instalación PWA');
                } else {
                    console.log('❌ Usuario rechazó instalación PWA');
                }
                
                deferredPrompt = null;
                DOM.remove(installBtn);
            }
        });
        
        // Agregar botón al header si existe
        const header = DOM.find('.admin-header, .operador-header');
        if (header) {
            header.appendChild(installBtn);
        }
    }

    setupNotifications() {
        if ('Notification' in window) {
            // Solicitar permisos solo si el usuario está autenticado
            if (this.currentUser && Notification.permission === 'default') {
                this.requestNotificationPermission();
            }
        }
    }

    async requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                console.log('✅ Permisos de notificación concedidos');
                uiManager.showInfo('🔔 Notificaciones', 'Las notificaciones han sido habilitadas', 3000);
            } else {
                console.log('❌ Permisos de notificación denegados');
            }
            
        } catch (error) {
            console.warn('Error solicitando permisos de notificación:', error);
        }
    }

    // ===========================
    // UTILIDADES DE APLICACIÓN
    // ===========================
    
    async reloadApp() {
        try {
            uiManager.showLoading('Recargando aplicación...');
            
            // Limpiar estado actual
            this.cleanupAuthenticatedModules();
            
            // Reinicializar
            await this.init();
            
        } catch (error) {
            console.error('Error recargando app:', error);
            window.location.reload();
        }
    }

    async handleLogout() {
        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            try {
                await authManager.logout();
            } catch (error) {
                console.error('Error en logout:', error);
                uiManager.showError('Error', 'No se pudo cerrar la sesión correctamente');
            }
        }
    }

    showInitializationError(error) {
        const app = DOM.find('#app');
        if (app) {
            app.innerHTML = `
                <div class="error-container" style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    padding: 2rem;
                    text-align: center;
                ">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">❌</div>
                    <h2 style="color: var(--error); margin-bottom: 1rem;">Error de Inicialización</h2>
                    <p style="color: var(--text-muted); margin-bottom: 2rem; max-width: 400px;">
                        No se pudo inicializar la aplicación. Por favor, verifica tu conexión a internet e intenta nuevamente.
                    </p>
                    <div style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 2rem;">
                        <strong>Error:</strong> ${error.message || 'Error desconocido'}
                    </div>
                    <button onclick="window.location.reload()" class="btn btn-primary">
                        <i class="fas fa-refresh"></i>
                        Reintentar
                    </button>
                </div>
            `;
        }
    }

    // ===========================
    // INFORMACIÓN DE DEPURACIÓN
    // ===========================
    
    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            isOnline: this.isOnline,
            currentUser: this.currentUser?.email || null,
            currentRole: this.currentRole,
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                vh: getComputedStyle(document.documentElement).getPropertyValue('--vh')
            },
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : null
        };
    }

    // Exponer información de debug en consola
    debug() {
        console.table(this.getDebugInfo());
    }
}

// ===========================
// INICIALIZACIÓN AUTOMÁTICA
// ===========================

// Crear instancia global de la aplicación
const app = new AppManager();

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.init();
    });
} else {
    // DOM ya está listo
    app.init();
}

// ===========================
// EXPORTACIONES Y GLOBALES
// ===========================

// Hacer disponible globalmente para debugging
window.App = app;
window.DEBUG = () => app.debug();

// Exportar para uso en otros módulos
export default app;

// ===========================
// MANEJO DE CIERRE/RECARGA
// ===========================

// Cleanup antes de cerrar la ventana
window.addEventListener('beforeunload', (e) => {
    if (app.currentUser) {
        // Limpiar recursos
        app.cleanupAuthenticatedModules();
        
        // No mostrar confirmación en producción
        // pero sí limpiar datos sensibles
    }
});

// Manejo de errores no capturados específicos de Firebase
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.code) {
        // Error de Firebase
        console.error('Error Firebase no manejado:', event.reason);
        
        if (event.reason.code === 'permission-denied') {
            uiManager.showError('🔒 Sin Permisos', 'No tienes permisos para realizar esta acción');
            event.preventDefault();
        } else if (event.reason.code === 'unavailable') {
            uiManager.showError('🌐 Servidor No Disponible', 'El servidor no está disponible. Intenta más tarde');
            event.preventDefault();
        }
    }
});

