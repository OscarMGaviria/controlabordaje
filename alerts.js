// ===========================
// 📢 MÓDULO DE ALERTAS LATERALES
// ===========================

class AlertSystem {
    constructor() {
        this.alerts = [];
        this.container = null;
        this.init();
    }

    // Inicializar el sistema de alertas
    init() {
        this.createContainer();
        this.addStyles();
    }

    // Crear contenedor de alertas
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'alert-container';
        this.container.className = 'alert-container';
        document.body.appendChild(this.container);
    }

    // Agregar estilos CSS dinámicamente
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .alert-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 400px;
            }

            .alert {
                pointer-events: auto;
                padding: 16px 20px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(15px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: white;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px;
                position: relative;
                overflow: hidden;
                transform: translateX(100%);
                animation: slideIn 0.4s ease-out forwards;
                min-height: 60px;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .alert::before {
                content: '';
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 4px;
                background: currentColor;
            }

            .alert-icon {
                font-size: 20px;
                flex-shrink: 0;
                width: 24px;
                text-align: center;
            }

            .alert-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .alert-title {
                font-weight: bold;
                font-size: 15px;
                margin: 0;
            }

            .alert-message {
                margin: 0;
                opacity: 0.9;
                line-height: 1.4;
            }

            .alert-close {
                background: none;
                border: none;
                color: currentColor;
                cursor: pointer;
                font-size: 18px;
                padding: 4px;
                border-radius: 4px;
                opacity: 0.7;
                transition: opacity 0.2s ease;
                flex-shrink: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .alert-close:hover {
                opacity: 1;
                background: rgba(255, 255, 255, 0.1);
            }

            .alert-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 0 0 12px 12px;
                animation: progress linear;
            }

            /* Tipos de alertas */
            .alert-success {
                background: linear-gradient(135deg, rgba(46, 204, 113, 0.9) 0%, rgba(39, 174, 96, 0.9) 100%);
                color: #ffffff;
            }

            .alert-error {
                background: linear-gradient(135deg, rgba(231, 76, 60, 0.9) 0%, rgba(192, 57, 43, 0.9) 100%);
                color: #ffffff;
            }

            .alert-warning {
                background: linear-gradient(135deg, rgba(243, 156, 18, 0.9) 0%, rgba(211, 84, 0, 0.9) 100%);
                color: #ffffff;
            }

            .alert-info {
                background: linear-gradient(135deg, rgba(52, 152, 219, 0.9) 0%, rgba(41, 128, 185, 0.9) 100%);
                color: #ffffff;
            }

            .alert-primary {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%);
                color: #ffffff;
            }

            .alert-dark {
                background: linear-gradient(135deg, rgba(44, 62, 80, 0.95) 0%, rgba(52, 73, 94, 0.95) 100%);
                color: #ffffff;
            }

            /* Animaciones */
            @keyframes slideIn {
                0% {
                    transform: translateX(100%);
                    opacity: 0;
                }
                100% {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOut {
                0% {
                    transform: translateX(0);
                    opacity: 1;
                }
                100% {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }

            @keyframes progress {
                0% { width: 100%; }
                100% { width: 0%; }
            }

            .alert-hiding {
                animation: slideOut 0.3s ease-in forwards;
            }

            /* Responsive */
            @media (max-width: 480px) {
                .alert-container {
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
                
                .alert {
                    padding: 14px 16px;
                    font-size: 13px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Mostrar alerta
    show(type, title, message, duration = 5000) {
        const alertId = 'alert-' + Date.now() + Math.random().toString(36).substr(2, 9);
        
        const alert = {
            id: alertId,
            type: type,
            title: title,
            message: message,
            duration: duration,
            element: null
        };

        const alertElement = this.createElement(alert);
        alert.element = alertElement;
        
        this.container.appendChild(alertElement);
        this.alerts.push(alert);

        // Auto-hide después del tiempo especificado
        if (duration > 0) {
            setTimeout(() => {
                this.hide(alertId);
            }, duration);
        }

        return alertId;
    }

    // Crear elemento HTML de la alerta
    createElement(alert) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ',
            primary: '★',
            dark: '●'
        };

        const element = document.createElement('div');
        element.id = alert.id;
        element.className = `alert alert-${alert.type}`;
        
        element.innerHTML = `
            <div class="alert-icon">${icons[alert.type] || '●'}</div>
            <div class="alert-content">
                <div class="alert-title">${alert.title}</div>
                <div class="alert-message">${alert.message}</div>
            </div>
            <button class="alert-close" onclick="alertSystem.hide('${alert.id}')">&times;</button>
            ${alert.duration > 0 ? `<div class="alert-progress" style="animation-duration: ${alert.duration}ms;"></div>` : ''}
        `;

        return element;
    }

    // Ocultar alerta específica
    hide(alertId) {
        const alertIndex = this.alerts.findIndex(alert => alert.id === alertId);
        if (alertIndex === -1) return;

        const alert = this.alerts[alertIndex];
        
        alert.element.classList.add('alert-hiding');
        
        setTimeout(() => {
            if (alert.element && alert.element.parentNode) {
                alert.element.parentNode.removeChild(alert.element);
            }
            this.alerts.splice(alertIndex, 1);
        }, 300);
    }

    // Limpiar todas las alertas
    clear() {
        this.alerts.forEach(alert => {
            if (alert.element && alert.element.parentNode) {
                alert.element.classList.add('alert-hiding');
                setTimeout(() => {
                    if (alert.element && alert.element.parentNode) {
                        alert.element.parentNode.removeChild(alert.element);
                    }
                }, 300);
            }
        });
        this.alerts = [];
    }

    // Métodos de conveniencia
    success(title, message, duration = 5000) {
        return this.show('success', title, message, duration);
    }

    error(title, message, duration = 7000) {
        return this.show('error', title, message, duration);
    }

    warning(title, message, duration = 6000) {
        return this.show('warning', title, message, duration);
    }

    info(title, message, duration = 5000) {
        return this.show('info', title, message, duration);
    }

    primary(title, message, duration = 5000) {
        return this.show('primary', title, message, duration);
    }

    dark(title, message, duration = 5000) {
        return this.show('dark', title, message, duration);
    }
}

// ===========================
// 🚀 INICIALIZACIÓN
// ===========================

// Crear instancia global
const alertSystem = new AlertSystem();

// ===========================
// 📋 EJEMPLOS DE USO
// ===========================

// Funciones globales para facilidad de uso
function showAlert(type, title, message, duration) {
    return alertSystem.show(type, title, message, duration);
}

function showSuccess(title, message, duration) {
    return alertSystem.success(title, message, duration);
}

function showError(title, message, duration) {
    return alertSystem.error(title, message, duration);
}

function showWarning(title, message, duration) {
    return alertSystem.warning(title, message, duration);
}

function showInfo(title, message, duration) {
    return alertSystem.info(title, message, duration);
}

function showPrimary(title, message, duration) {
    return alertSystem.primary(title, message, duration);
}

function showDark(title, message, duration) {
    return alertSystem.dark(title, message, duration);
}

function clearAllAlerts() {
    alertSystem.clear();
}

// ===========================
// 🧪 FUNCIÓN DE PRUEBA
// ===========================

function testAllAlerts() {
    setTimeout(() => showSuccess('¡Éxito!', 'Operación completada correctamente'), 100);
    setTimeout(() => showError('Error', 'Algo salió mal en el proceso'), 300);
    setTimeout(() => showWarning('Advertencia', 'Revisa los datos ingresados'), 500);
    setTimeout(() => showInfo('Información', 'Proceso iniciado correctamente'), 700);
    setTimeout(() => showPrimary('Importante', 'Mensaje destacado del sistema'), 900);
    setTimeout(() => showDark('Sistema', 'Notificación del administrador'), 1100);
}

// ===========================
// 📖 DOCUMENTACIÓN
// ===========================

/*
CÓMO USAR:

1. Incluir este archivo en tu HTML:
   <script src="alerts.js"></script>

2. Usar las funciones:
   showSuccess('Título', 'Mensaje');
   showError('Error', 'Descripción del error');
   showWarning('Cuidado', 'Mensaje de advertencia');
   showInfo('Info', 'Información general');
   showPrimary('Destacado', 'Mensaje importante');
   showDark('Sistema', 'Notificación oscura');

3. Personalizar duración (en milisegundos):
   showSuccess('Título', 'Mensaje', 3000); // 3 segundos
   showError('Error', 'Mensaje', 0); // Sin auto-hide

4. Limpiar todas las alertas:
   clearAllAlerts();

5. Probar todas las alertas:
   testAllAlerts();
*/