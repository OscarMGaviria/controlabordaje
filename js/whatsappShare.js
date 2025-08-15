// ===========================
// MÓDULO WHATSAPP CORREGIDO
// ===========================

import { triggerHapticFeedback } from './utils/haptics.js';
import { auth } from './firebaseConfig.js';

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
    const operadorFormateado = operador.split('@')[0];

    let mensaje = `🚢 *ZARPE CONFIRMADO* 🚢\n\n`;
    mensaje += `📋 *DETALLES DEL VIAJE*\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `⛵ *Embarcación:* ${zarpeData.embarcacion}\n`;
    mensaje += `📍 *Posición:* ${zarpeData.posicionDesembarque}\n`;
    mensaje += `🏷️ *Categoría:* ${zarpeData.categoria}\n\n`;
    mensaje += `👥 *INFORMACIÓN DE PASAJEROS*\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `👤 *Pasajeros:* ${zarpeData.cantidadPasajeros} personas\n`;
    mensaje += `💰 *Valor Total:* $${zarpeData.valorTotal.toLocaleString('es-CO')} COP\n`;
    mensaje += `💵 *Valor por Persona:* $${zarpeData.valorPorPersona.toLocaleString('es-CO')} COP\n\n`;
    mensaje += `🕐 *INFORMACIÓN DEL ZARPE*\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `📅 *Fecha:* ${fechaFormateada}\n`;
    mensaje += `⏰ *Hora:* ${horaFormateada}\n`;
    mensaje += `👨‍💼 *Operador:* ${operadorFormateado}\n`;

    if (zarpeData.statusInfo) {
        mensaje += `\n⚠️ *NOTA:* ${zarpeData.statusInfo}`;
    }

    mensaje += `\n\n🤖 _Mensaje generado automáticamente por Admin Embarcaciones_`;
    mensaje += `\n🏝️ _Muelle Único Guatapé - Malecón San Juan del Puerto_`;

    return mensaje;
}

/**
 * Abre WhatsApp con el mensaje pre-cargado
 * @param {string} phoneNumber - Número de teléfono (opcional)
 * @param {string} message - Mensaje a enviar
 */
function openWhatsApp(phoneNumber, message) {
    const encodedMessage = encodeURIComponent(message);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    let whatsappUrl;
    
    if (phoneNumber && phoneNumber.trim() !== '') {
        // Limpiar número: remover espacios, guiones, paréntesis
        let cleanPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
        
        // Si empieza con 57, agregar +
        if (cleanPhone.startsWith('57') && cleanPhone.length > 10) {
            cleanPhone = '+' + cleanPhone;
        }
        // Si no tiene código de país, agregar +57
        else if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
            cleanPhone = '+57' + cleanPhone;
        }
        // Si ya tiene +, mantenerlo
        else if (cleanPhone.startsWith('+')) {
            // Ya está bien formateado
        }
        
        console.log('📱 Número limpio:', cleanPhone);
        
        if (isMobile) {
            // Para móviles: intentar app nativa primero
            whatsappUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;
        } else {
            // Para desktop: directo a WhatsApp Web
            whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
        }
    } else {
        // Sin número específico - abrir WhatsApp para seleccionar contacto
        if (isMobile) {
            whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
        } else {
            whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
        }
    }
    
    console.log('🔗 URL WhatsApp:', whatsappUrl);
    
    if (isMobile) {
        // En móviles: intentar app nativa, fallback a web
        try {
            // Crear un enlace temporal y hacer click
            const link = document.createElement('a');
            link.href = whatsappUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            
            // Agregar al DOM temporalmente
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Fallback a WhatsApp Web después de 2 segundos si no abre
            setTimeout(() => {
                const webUrl = phoneNumber && phoneNumber.trim() ? 
                    `https://wa.me/${phoneNumber.replace(/[\s\-\(\)\+]/g, '')}?text=${encodedMessage}` :
                    `https://wa.me/?text=${encodedMessage}`;
                    
                // Solo abrir web si la ventana actual sigue enfocada (significa que no abrió la app)
                if (document.hasFocus()) {
                    window.open(webUrl, '_blank', 'noopener,noreferrer');
                }
            }, 2000);
            
        } catch (error) {
            console.error('❌ Error abriendo WhatsApp app:', error);
            // Fallback directo a web
            const webUrl = phoneNumber && phoneNumber.trim() ? 
                `https://wa.me/${phoneNumber.replace(/[\s\-\(\)\+]/g, '')}?text=${encodedMessage}` :
                `https://wa.me/?text=${encodedMessage}`;
            window.open(webUrl, '_blank', 'noopener,noreferrer');
        }
    } else {
        // En desktop: directo a WhatsApp Web
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
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
                               placeholder="Ej: 300 123 4567 o +57 300 123 4567" 
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

                <div class="warning-message" style="background: rgba(37, 211, 102, 0.2); border-color: rgba(37, 211, 102, 0.5); color: #25D366; margin-top: 15px;">
                    <i class="fab fa-whatsapp"></i>
                    <div>
                        <strong>Instrucciones:</strong><br>
                        • Con número: Se abrirá chat directo<br>
                        • Sin número: Podrás elegir contacto<br>
                        • En móviles: Abre la app de WhatsApp<br>
                        • En PC: Abre WhatsApp Web
                    </div>
                </div>
            </div>

            <div class="modal-actions">
                <button class="modal-button btn-cancel touch-target" id="whatsappBtnCancelar">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button class="modal-button whatsapp-share-button touch-target" id="whatsappBtnCompartir">
                    <i class="fab fa-whatsapp"></i> Abrir WhatsApp
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
    
    // Formatear número mientras se escribe
    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^\d]/g, '');
        
        // Formatear para Colombia (10 dígitos después del 57)
        if (value.length > 0) {
            if (value.startsWith('57') && value.length > 2) {
                // Si empieza con 57, formatear como +57 XXX XXX XXXX
                const withoutCountry = value.substring(2);
                if (withoutCountry.length <= 3) {
                    e.target.value = `+57 ${withoutCountry}`;
                } else if (withoutCountry.length <= 6) {
                    e.target.value = `+57 ${withoutCountry.substring(0, 3)} ${withoutCountry.substring(3)}`;
                } else {
                    e.target.value = `+57 ${withoutCountry.substring(0, 3)} ${withoutCountry.substring(3, 6)} ${withoutCountry.substring(6, 10)}`;
                }
            } else {
                // Número local de 10 dígitos
                if (value.length <= 3) {
                    e.target.value = value;
                } else if (value.length <= 6) {
                    e.target.value = `${value.substring(0, 3)} ${value.substring(3)}`;
                } else {
                    e.target.value = `${value.substring(0, 3)} ${value.substring(3, 6)} ${value.substring(6, 10)}`;
                }
            }
        }
    });
    
    // Compartir por WhatsApp
    compartirBtn.addEventListener('click', () => {
        let phoneNumber = phoneInput.value.trim();
        
        compartirBtn.disabled = true;
        compartirBtn.innerHTML = '<div class="whatsapp-loading"><i class="fab fa-whatsapp"></i> Abriendo WhatsApp...</div>';
        
        triggerHapticFeedback('success');
        
        try {
            console.log('📞 Número ingresado:', phoneNumber);
            openWhatsApp(phoneNumber, message);
            
            // Mostrar mensaje de éxito después de intentar abrir
            setTimeout(() => {
                closeModal();
                
                window.dispatchEvent(new CustomEvent('showSuccess', {
                    detail: {
                        title: '📱 WhatsApp Abierto',
                        message: phoneNumber ? 
                            'Se abrió el chat con el número especificado' : 
                            'Selecciona el contacto y envía el mensaje',
                        duration: 4000
                    }
                }));
            }, 1500);
            
        } catch (error) {
            console.error('❌ Error al abrir WhatsApp:', error);
            triggerHapticFeedback('error');
            
            window.dispatchEvent(new CustomEvent('showError', {
                detail: {
                    title: '❌ Error al Abrir WhatsApp',
                    message: 'No se pudo abrir WhatsApp. Verifica que esté instalado.',
                    duration: 4000
                }
            }));
            
            compartirBtn.disabled = false;
            compartirBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Abrir WhatsApp';
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
}

/**
 * Función rápida para compartir sin modal
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
 * Verificar si WhatsApp está disponible
 * @returns {boolean} True si WhatsApp está disponible
 */
export function isWhatsAppAvailable() {
    // WhatsApp Web está disponible en todos los navegadores modernos
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
 * Función para agregar status de conexión al mensaje
 * @param {Object} zarpeData - Datos del zarpe
 * @param {boolean} hasConnectionIssues - Si hay problemas de conexión
 * @returns {Object} Datos del zarpe con información de status
 */
export function addConnectionStatus(zarpeData, hasConnectionIssues = false) {
    if (hasConnectionIssues) {
        return {
            ...zarpeData,
            statusInfo: 'Información generada localmente debido a problemas de conexión con el servidor.'
        };
    }
    return zarpeData;
}