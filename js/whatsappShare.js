import { triggerHapticFeedback } from './utils/haptics.js';
import { auth } from './firebaseConfig.js';

/**
 * Módulo para compartir información de zarpes por WhatsApp
 */

/**
 * Genera el mensaje formateado para WhatsApp
 * @param {Object} zarpeData - Datos del zarpe
 * @returns {string} Mensaje formateado
 */
function generateWhatsAppMessage(zarpeData) {
    const fecha = new Date(zarpeData.fechaHora);
    const fechaFormateada = fecha.toLocaleDateString('es-CO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const horaFormateada = fecha.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    const operador = zarpeData.administrador || auth.currentUser?.email || 'Sistema';
    const operadorFormateado = operador.split('@')[0]; // Solo la parte antes del @

    // Mensaje base
    let mensaje = `🚢 *ZARPE CONFIRMADO* 🚢

📋 *DETALLES DEL VIAJE*
━━━━━━━━━━━━━━━━━━━━━━━

🛥️ *Embarcación:* ${zarpeData.embarcacion}
📊 *Posición:* ${zarpeData.posicionDesembarque}
🏷️ *Categoría:* ${zarpeData.categoria}

👥 *INFORMACIÓN DE PASAJEROS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *Pasajeros:* ${zarpeData.cantidadPasajeros} personas
💰 *Valor Total:* $${zarpeData.valorTotal.toLocaleString('es-CO')} COP
💵 *Valor por Persona:* $${zarpeData.valorPorPersona.toLocaleString('es-CO')} COP

📅 *INFORMACIÓN DEL ZARPE*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📆 *Fecha:* ${fechaFormateada}
🕐 *Hora:* ${horaFormateada}
👨‍💼 *Operador:* ${operadorFormateado}`;

    // Agregar información de status si existe
    if (zarpeData.statusInfo) {
        mensaje += `\n\n${zarpeData.statusInfo}`;
    } else {
        mensaje += `\n\n✅ *Zarpe registrado exitosamente en el sistema*`;
    }

    mensaje += `\n\n---
_Mensaje generado automáticamente por Admin Embarcaciones_`;

    return mensaje;
}

/**
 * Abre WhatsApp Web o la app con el mensaje pre-cargado
 * @param {string} phoneNumber - Número de teléfono (opcional)
 * @param {string} message - Mensaje a enviar
 */
function openWhatsApp(phoneNumber, message) {
    const encodedMessage = encodeURIComponent(message);
    let whatsappUrl;
    
    if (phoneNumber && phoneNumber.trim() !== '') {
        // Limpiar el número de teléfono
        const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
        whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    } else {
        // Sin número específico, abre WhatsApp Web para seleccionar contacto
        whatsappUrl = `https://web.whatsapp.com/send?text=${encodedMessage}`;
    }
    
    // Detectar si es móvil para usar la app nativa
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile && phoneNumber && phoneNumber.trim() !== '') {
        // En móvil, usar whatsapp:// para abrir la app nativa
        const nativeUrl = `whatsapp://send?phone=${phoneNumber.replace(/[^\d]/g, '')}&text=${encodedMessage}`;
        
        // Intentar abrir la app nativa primero
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = nativeUrl;
        document.body.appendChild(iframe);
        
        // Fallback a WhatsApp Web después de un breve delay
        setTimeout(() => {
            document.body.removeChild(iframe);
            window.open(whatsappUrl, '_blank');
        }, 1000);
    } else {
        // En desktop o sin número, usar WhatsApp Web
        window.open(whatsappUrl, '_blank');
    }
}

/**
 * Muestra el modal de compartir WhatsApp
 * @param {Object} zarpeData - Datos del zarpe
 */
export function showWhatsAppShareModal(zarpeData) {
    const message = generateWhatsAppMessage(zarpeData);
    
    // Determinar el estado del zarpe para mostrar indicadores visuales
    const hasStatusInfo = zarpeData.statusInfo && zarpeData.statusInfo.includes('problemas de conexión');
    const statusClass = hasStatusInfo ? 'warning' : 'success';
    const statusColor = hasStatusInfo ? '#FFA500' : '#25D366';
    
    // Crear modal dinámicamente
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.id = 'whatsappShareModal';
    modalOverlay.style.display = 'flex';
    
    modalOverlay.innerHTML = `
        <div class="modal-content" style="max-width: 500px; border-color: ${statusColor}50;">
            <div class="modal-header">
                <div class="modal-title" style="color: ${statusColor};">
                    <i class="fab fa-whatsapp"></i>
                    Compartir por WhatsApp
                </div>
                <button class="modal-close" id="whatsappModalClose">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="modal-body">
                <div class="vessel-info" style="background: ${statusColor}20; border-color: ${statusColor}50;">
                    <h3><i class="fas fa-ship"></i> ${zarpeData.embarcacion}</h3>
                    <p>Zarpe ${hasStatusInfo ? 'procesado localmente' : 'confirmado'} - ${zarpeData.cantidadPasajeros} pasajeros</p>
                </div>

                ${hasStatusInfo ? `
                    <div class="warning-message" style="background: rgba(255, 165, 0, 0.2); border-color: rgba(255, 165, 0, 0.5); color: #FFA500; margin-bottom: 15px;">
                        <i class="fas fa-exclamation-triangle"></i>
                        Información generada localmente debido a problemas de conexión
                    </div>
                ` : ''}

                <div class="input-group">
                    <label class="input-label" for="whatsappPhone">
                        <i class="fas fa-phone"></i> Número de WhatsApp (Opcional)
                    </label>
                    <div class="phone-input">
                        <input type="tel" 
                               id="whatsappPhone" 
                               class="modal-input touch-target" 
                               placeholder="Ej: 300 123 4567" 
                               style="text-align: left;">
                    </div>
                    <small style="color: rgba(255, 255, 255, 0.7); font-size: 12px; margin-top: 5px; display: block;">
                        <i class="fas fa-info-circle"></i> Deja vacío para seleccionar contacto en WhatsApp
                    </small>
                </div>

                <div class="summary-section" style="background: ${statusColor}15; border-color: ${statusColor}50;">
                    <div class="summary-title">
                        <i class="fas fa-eye"></i> Vista Previa del Mensaje
                    </div>
                    <div class="message-preview">
                        <pre id="messagePreview">${message}</pre>
                    </div>
                </div>

                <div class="whatsapp-status ${statusClass}">
                    <i class="fab fa-whatsapp"></i>
                    <span>Se abrirá ${isMobile() ? 'la app de WhatsApp' : 'WhatsApp Web'} con el mensaje pre-cargado</span>
                </div>
            </div>

            <div class="modal-actions">
                <button class="modal-button btn-cancel touch-target" id="whatsappBtnCancelar">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button class="modal-button whatsapp-share-button touch-target" id="whatsappBtnCompartir">
                    <i class="fab fa-whatsapp"></i> Compartir
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalOverlay);
    triggerHapticFeedback('medium');
    
    // Event listeners del modal
    const closeModal = () => {
        document.body.removeChild(modalOverlay);
        triggerHapticFeedback('light');
    };
    
    const phoneInput = document.getElementById('whatsappPhone');
    const compartirBtn = document.getElementById('whatsappBtnCompartir');
    
    // Cerrar modal
    document.getElementById('whatsappModalClose').addEventListener('click', closeModal);
    document.getElementById('whatsappBtnCancelar').addEventListener('click', closeModal);
    
    // Compartir por WhatsApp
    compartirBtn.addEventListener('click', () => {
        const phoneNumber = phoneInput.value.trim();
        
        compartirBtn.disabled = true;
        compartirBtn.innerHTML = '<div class="whatsapp-loading"><i class="fab fa-whatsapp"></i> Abriendo WhatsApp...</div>';
        
        triggerHapticFeedback('success');
        
        try {
            openWhatsApp(phoneNumber, message);
            
            // Mostrar mensaje de éxito
            setTimeout(() => {
                closeModal();
                
                // Disparar evento de éxito
                window.dispatchEvent(new CustomEvent('showSuccess', {
                    detail: {
                        title: '📱 WhatsApp Abierto',
                        message: 'El mensaje ha sido cargado en WhatsApp. Selecciona el contacto y envía.',
                        duration: 4000
                    }
                }));
            }, 1500);
            
        } catch (error) {
            triggerHapticFeedback('error');
            
            window.dispatchEvent(new CustomEvent('showError', {
                detail: {
                    title: '❌ Error al Abrir WhatsApp',
                    message: 'No se pudo abrir WhatsApp. Verifica que esté instalado.',
                    duration: 4000
                }
            }));
            
            compartirBtn.disabled = false;
            compartirBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Compartir';
        }
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
    
    // Tecla Escape para cerrar
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Auto focus en el input de teléfono
    setTimeout(() => {
        phoneInput.focus();
    }, 300);
    
    // Formatear número de teléfono mientras se escribe
    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^\d]/g, '');
        
        // Formatear número colombiano
        if (value.startsWith('57')) {
            value = value.substring(2);
        }
        
        if (value.length > 0) {
            if (value.length <= 3) {
                e.target.value = `${value}`;
            } else if (value.length <= 6) {
                e.target.value = `${value.substring(0, 3)} ${value.substring(3)}`;
            } else {
                e.target.value = `${value.substring(0, 3)} ${value.substring(3, 6)} ${value.substring(6, 10)}`;
            }
        }
    });
    
    // Agregar prefijo +57 al enviar si no está presente
    compartirBtn.addEventListener('click', () => {
        let phone = phoneInput.value.trim();
        if (phone && !phone.startsWith('+57') && !phone.startsWith('57')) {
            phone = '+57' + phone.replace(/\s/g, '');
        }
        phoneInput.value = phone;
    });
}

/**
 * Función rápida para compartir sin modal (opcional)
 * @param {Object} zarpeData - Datos del zarpe
 * @param {string} phoneNumber - Número de teléfono directo
 */
export function quickWhatsAppShare(zarpeData, phoneNumber = '') {
    const message = generateWhatsAppMessage(zarpeData);
    
    triggerHapticFeedback('medium');
    
    try {
        openWhatsApp(phoneNumber, message);
        
        window.dispatchEvent(new CustomEvent('showSuccess', {
            detail: {
                title: '📱 WhatsApp Abierto',
                message: 'Mensaje cargado en WhatsApp',
                duration: 3000
            }
        }));
        
    } catch (error) {
        triggerHapticFeedback('error');
        
        window.dispatchEvent(new CustomEvent('showError', {
            detail: {
                title: '❌ Error',
                message: 'No se pudo abrir WhatsApp',
                duration: 3000
            }
        }));
    }
}

/**
 * Verificar si WhatsApp está disponible en el dispositivo
 * @returns {boolean} True si WhatsApp está disponible
 */
export function isWhatsAppAvailable() {
    // En la práctica, WhatsApp Web está disponible en todos los navegadores modernos
    // y la mayoría de móviles tienen WhatsApp instalado
    return true;
}

/**
 * Detectar si es dispositivo móvil
 * @returns {boolean} True si es móvil
 */
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Obtener el texto del botón según el dispositivo
 * @returns {string} Texto del botón
 */
export function getWhatsAppButtonText() {
    return isMobile() ? 'Compartir en WhatsApp' : 'Compartir en WhatsApp Web';
}

/**
 * Función para mostrar indicador de conexión en el mensaje
 * @param {Object} zarpeData - Datos del zarpe
 * @param {boolean} hasConnectionIssues - Si hay problemas de conexión
 * @returns {Object} Datos del zarpe con información de status
 */
export function addConnectionStatus(zarpeData, hasConnectionIssues = false) {
    if (hasConnectionIssues) {
        return {
            ...zarpeData,
            statusInfo: '\n⚠️ *NOTA:* Información generada localmente debido a problemas de conexión con el servidor.'
        };
    }
    return zarpeData;
}