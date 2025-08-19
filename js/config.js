// ===========================
// CONFIGURACIÓN GLOBAL
// ===========================

export const CONFIG = {
    // Estados de embarcaciones
    ESTADOS: {
        EN_TURNO: 'EN TURNO',
        EMBARCANDO: 'EMBARCANDO',
        SUSPENDIDO: 'SUSPENDIDO',
        RESERVA: 'RESERVA'
    },

    // Roles de usuario
    ROLES: {
        ADMIN: 'admin',
        OPERADOR: 'operador'
    },

    // Categorías de embarcaciones
    CATEGORIAS: {
        'lancha-taxi': { 
            nombre: 'Lancha Taxi', 
            icon: 'fas fa-ship',
            precio: 30000 
        },
        'deportiva': { 
            nombre: 'Deportiva', 
            icon: 'fas fa-water',
            precio: 50000 
        },
        'planchon': { 
            nombre: 'Planchón', 
            icon: 'fas fa-anchor',
            precio: 25000 
        },
        'carguero': { 
            nombre: 'Carguero', 
            icon: 'fas fa-shipping-fast',
            precio: 40000 
        },
        'barco': { 
            nombre: 'Barco', 
            icon: 'fas fa-sailboat',
            precio: 25000 
        },
        'yate': { 
            nombre: 'Yate', 
            icon: 'fas fa-yacht',
            precio: 35000 
        }
    },

    // Funciones especiales
    FUNCIONES_ESPECIALES: {
        'verificar': {
            nombre: 'Verificar Reserva',
            icon: 'fas fa-id-card',
            descripcion: 'Buscar y verificar reservas por documento'
        },
        'cambiar-categoria': {
            nombre: 'Cambiar Categoría',
            icon: 'fas fa-exchange-alt',
            descripcion: 'Modificar categoría de ventas del día'
        }
    },

    // Configuración de UI
    UI: {
        ANIMATION_DURATION: 300,
        TOAST_DURATION: 5000,
        MODAL_BACKDROP_BLUR: '5px',
        TOUCH_TARGET_SIZE: '44px'
    },

    // Configuración de Firebase
    FIREBASE: {
        COLLECTIONS: {
            EMBARCACIONES: 'embarcaciones',
            USERS: 'users',
            ZARPES: 'ControlZarpes',
            RESERVAS: 'Reservas',
            VENTAS: 'ventas'
        }
    },

    // Mensajes del sistema
    MESSAGES: {
        LOGIN: {
            SUCCESS: '✅ Sesión iniciada correctamente',
            ERROR: '❌ Error al iniciar sesión',
            INVALID_CREDENTIALS: '🔑 Credenciales inválidas'
        },
        EMBARCACIONES: {
            ZARPE_SUCCESS: '🚢 Zarpe registrado exitosamente',
            ZARPE_ERROR: '❌ Error al procesar zarpe',
            ESTADO_CHANGED: '🔄 Estado actualizado',
            POSITION_CHANGED: '📍 Posición actualizada',
            ADDED: '➕ Embarcación agregada',
            DELETED: '🗑️ Embarcación eliminada'
        },
        VALIDATION: {
            REQUIRED_FIELDS: '⚠️ Complete todos los campos requeridos',
            INVALID_POSITION: '📍 Posición inválida',
            CONSECUTIVE_ERROR: '⚠️ Solo se puede embarcar de forma consecutiva'
        }
    },

    // Configuración de PWA
    PWA: {
        THEME_COLOR: '#1e3c72',
        BACKGROUND_COLOR: '#1e3c72',
        DISPLAY: 'standalone',
        ORIENTATION: 'portrait'
    }
};

// Configuración de iconos por estado
export const ESTADO_ICONS = {
    [CONFIG.ESTADOS.EN_TURNO]: 'fas fa-clock',
    [CONFIG.ESTADOS.EMBARCANDO]: 'fas fa-ship',
    [CONFIG.ESTADOS.SUSPENDIDO]: 'fas fa-ban',
    [CONFIG.ESTADOS.RESERVA]: 'fas fa-bookmark'
};

// Configuración de colores por estado
export const ESTADO_COLORS = {
    [CONFIG.ESTADOS.EN_TURNO]: 'var(--accent)',
    [CONFIG.ESTADOS.EMBARCANDO]: 'var(--success)',
    [CONFIG.ESTADOS.SUSPENDIDO]: 'var(--error)',
    [CONFIG.ESTADOS.RESERVA]: 'var(--info)'
};

// Validaciones
export const VALIDATIONS = {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_REGEX: /^[\+]?[0-9]{10,15}$/,
    MIN_PASSENGERS: 1,
    MAX_PASSENGERS: 50,
    MIN_PRICE: 1000,
    MAX_PRICE: 10000000
};

// Configuración de dispositivos
export const DEVICE = {
    isMobile: () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isIOS: () => /iPad|iPhone|iPod/.test(navigator.userAgent),
    isAndroid: () => /Android/.test(navigator.userAgent),
    supportsVibration: () => 'vibrate' in navigator,
    supportsNotifications: () => 'Notification' in window
};


// Configuración visual unificada
export const UI_CONFIG = {
    HEADER_STYLE: 'operador', // Cambiar a 'operador' para unificar
    CARD_STYLE: 'operador',   // Cambiar a 'operador' para unificar
    ACTIONS_LAYOUT: 'operador' // Cambiar a 'operador' para unificar
};

// Exportar configuración global
window.APP_CONFIG = CONFIG;