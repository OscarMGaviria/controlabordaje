// ===========================
// MÓDULO DE MODALES ESPECIALIZADOS
// ===========================

import { CONFIG } from './config.js';
import { Haptics, Format, Validate, Time, ID } from './utils.js';

class ModalsManager {
    constructor() {
        this.activeModals = new Map();
    }

    // ===========================
    // MODAL DE ZARPE
    // ===========================
    
    showZarparModal(vessel) {
        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fas fa-anchor"></i>
                    Zarpar - ${vessel.nombre}
                </h3>
                <button class="modal-close" onclick="window.Modals.closeModal('zarpar-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="vessel-info">
                <div class="info-item">
                    <strong>Embarcación:</strong> ${vessel.nombre}
                </div>
                <div class="info-item">
                    <strong>Posición:</strong> ${vessel.posicion}
                </div>
                <div class="info-item">
                    <strong>Categoría:</strong> ${CONFIG.CATEGORIAS[vessel.categoria]?.nombre || vessel.categoria}
                </div>
            </div>
            
            <form id="zarpeForm" class="operador-form">
                <div class="form-group">
                    <label class="form-label" for="numPasajeros">
                        <i class="fas fa-users"></i>
                        Número de Pasajeros
                    </label>
                    <input 
                        type="number" 
                        id="numPasajeros" 
                        class="form-input touch-target"
                        placeholder="Ej: 8"
                        min="1"
                        max="50"
                        required
                    >
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="valorViaje">
                        <i class="fas fa-dollar-sign"></i>
                        Valor del Viaje
                    </label>
                    <input 
                        type="number" 
                        id="valorViaje" 
                        class="form-input touch-target"
                        placeholder="Ej: 150000"
                        min="1000"
                        step="1000"
                        required
                    >
                </div>
                
                <div id="zarpeResumen" class="form-summary" style="display: none;">
                    <h4><i class="fas fa-clipboard-check"></i> Resumen del Zarpe</h4>
                    <div class="summary-item">
                        <span>Pasajeros:</span>
                        <strong id="resumenPasajeros">-</strong>
                    </div>
                    <div class="summary-item">
                        <span>Valor Total:</span>
                        <strong id="resumenValorTotal">$0</strong>
                    </div>
                    <div class="summary-item">
                        <span>Valor por Persona:</span>
                        <strong id="resumenValorPersona">$0</strong>
                    </div>
                    <div class="summary-item">
                        <span>Hora de Zarpe:</span>
                        <strong id="resumenHora">${Format.time(new Date())}</strong>
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button type="button" class="btn btn-error" onclick="window.Modals.closeModal('zarpar-modal')">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                    <button type="submit" id="confirmarZarpeBtn" class="btn btn-success" disabled>
                        <i class="fas fa-check"></i>
                        Confirmar Zarpe
                    </button>
                </div>
            </form>
        `;

        const modalId = window.UI.showModal(modalContent, { className: 'modal-operador' });
        this.activeModals.set('zarpar-modal', { modalId, vessel });
        
        setTimeout(() => {
            this.setupZarpeForm(vessel);
        }, 100);
    }

    setupZarpeForm(vessel) {
        const form = document.getElementById('zarpeForm');
        const pasajerosInput = document.getElementById('numPasajeros');
        const valorInput = document.getElementById('valorViaje');
        const confirmarBtn = document.getElementById('confirmarZarpeBtn');
        const resumenDiv = document.getElementById('zarpeResumen');

        if (!form || !pasajerosInput || !valorInput) return;

        // Función para actualizar resumen
        const updateResumen = () => {
            const pasajeros = parseInt(pasajerosInput.value) || 0;
            const valor = parseFloat(valorInput.value) || 0;

            if (pasajeros > 0 && valor > 0) {
                const valorPorPersona = Math.round(valor / pasajeros);
                
                document.getElementById('resumenPasajeros').textContent = pasajeros;
                document.getElementById('resumenValorTotal').textContent = Format.currency(valor);
                document.getElementById('resumenValorPersona').textContent = Format.currency(valorPorPersona);
                
                resumenDiv.style.display = 'block';
                confirmarBtn.disabled = false;
            } else {
                resumenDiv.style.display = 'none';
                confirmarBtn.disabled = true;
            }
        };

        // Event listeners para inputs
        [pasajerosInput, valorInput].forEach(input => {
            input.addEventListener('input', updateResumen);
        });

        // Validaciones en tiempo real
        pasajerosInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value < 1) e.target.value = '';
            if (value > 50) e.target.value = 50;
        });

        valorInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (value < 0) e.target.value = '';
        });

        // Envío del formulario
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.procesarZarpe(vessel, pasajerosInput.value, valorInput.value);
        });

        // Focus en primer input
        pasajerosInput.focus();
    }

    async procesarZarpe(vessel, pasajeros, valor) {
        try {
            const numPasajeros = parseInt(pasajeros);
            const valorTotal = parseFloat(valor);

            if (!Validate.passengers(numPasajeros)) {
                window.UI.showError('⚠️ Pasajeros Inválidos', 'El número de pasajeros debe estar entre 1 y 50');
                return;
            }

            if (!Validate.price(valorTotal)) {
                window.UI.showError('⚠️ Valor Inválido', 'El valor del viaje debe ser mayor a $1,000');
                return;
            }

            const confirmarBtn = document.getElementById('confirmarZarpeBtn');
            confirmarBtn.disabled = true;
            confirmarBtn.innerHTML = '<div class="spinner"></div> Procesando...';

            Haptics.heavy();

            // Preparar datos del zarpe
            const zarpeData = {
                embarcacion: vessel.nombre,
                embarcacionId: vessel.id,
                categoria: vessel.categoria,
                posicionDesembarque: vessel.posicion,
                cantidadPasajeros: numPasajeros,
                valorTotal: valorTotal,
                valorPorPersona: Math.round(valorTotal / numPasajeros),
                administrador: window.Auth.getUserEmail(),
                fechaHora: new Date()
            };

            // Intentar guardar zarpe en la base de datos
            let zarpeGuardado = false;
            let errorFirebase = null;

            try {
                const zarpeResult = await window.Database.addZarpe(zarpeData);
                zarpeGuardado = zarpeResult.success;
                if (!zarpeGuardado) {
                    errorFirebase = zarpeResult.error;
                }
            } catch (error) {
                errorFirebase = error.message;
            }

            // Intentar reorganizar embarcaciones
            let embarcacionesActualizadas = false;
            
            if (zarpeGuardado) {
                try {
                    const reorganizeResult = await window.Embarcaciones.reorganizeAfterZarpe(vessel.id, vessel.categoria);
                    embarcacionesActualizadas = reorganizeResult.success;
                } catch (error) {
                    console.error('Error reorganizando embarcaciones:', error);
                }
            }

            // Cerrar modal y mostrar resultado
            this.closeModal('zarpar-modal');

            if (zarpeGuardado && embarcacionesActualizadas) {
                // ✅ TODO EXITOSO
                this.showZarpeResultModal(zarpeData, 'success');
            } else if (zarpeGuardado) {
                // ⚠️ ZARPE GUARDADO, PERO ERROR EN EMBARCACIONES
                this.showZarpeResultModal(zarpeData, 'partial', 
                    'El zarpe fue registrado, pero hubo problemas actualizando las posiciones.');
            } else {
                // ❌ ERROR EN FIREBASE, PERO PERMITIR COMPARTIR
                this.showZarpeResultModal(zarpeData, 'error', 
                    'Problemas de conexión. El zarpe no se guardó automáticamente, pero puedes compartir la información.');
            }

        } catch (error) {
            console.error('Error procesando zarpe:', error);
            window.UI.showError('❌ Error Inesperado', 'No se pudo procesar el zarpe');
            Haptics.error();
        }
    }

    // Modal de resultado de zarpe con opciones de compartir
    showZarpeResultModal(zarpeData, status = 'success', message = '') {
        const statusConfig = {
            success: {
                icon: 'fas fa-check-circle',
                color: 'var(--success)',
                title: '🚢 Zarpe Exitoso',
                description: 'Zarpe registrado correctamente en el sistema'
            },
            partial: {
                icon: 'fas fa-exclamation-triangle',
                color: 'var(--warning)',
                title: '⚠️ Zarpe Parcial',
                description: message || 'Zarpe registrado con algunas advertencias'
            },
            error: {
                icon: 'fas fa-exclamation-circle',
                color: 'var(--error)',
                title: '❌ Error de Conexión',
                description: message || 'Problemas de conexión, pero puedes compartir la información'
            }
        };

        const config = statusConfig[status];

        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title" style="color: ${config.color};">
                    <i class="${config.icon}"></i>
                    ${config.title}
                </h3>
            </div>
            
            <div class="vessel-info" style="background: ${config.color}20; border-color: ${config.color}50;">
                <h4><i class="fas fa-ship"></i> ${zarpeData.embarcacion}</h4>
                <p>${config.description}</p>
            </div>

            <div class="form-summary">
                <h4><i class="fas fa-clipboard-check"></i> Información del Zarpe</h4>
                <div class="summary-item">
                    <span><i class="fas fa-users"></i> Pasajeros:</span>
                    <strong>${zarpeData.cantidadPasajeros}</strong>
                </div>
                <div class="summary-item">
                    <span><i class="fas fa-dollar-sign"></i> Valor Total:</span>
                    <strong>${Format.currency(zarpeData.valorTotal)}</strong>
                </div>
                <div class="summary-item">
                    <span><i class="fas fa-clock"></i> Hora:</span>
                    <strong>${Format.time(zarpeData.fechaHora)}</strong>
                </div>
                <div class="summary-item">
                    <span><i class="fas fa-user-tie"></i> Operador:</span>
                    <strong>${zarpeData.administrador.split('@')[0]}</strong>
                </div>
            </div>

            ${status === 'error' ? `
                <div class="warning-message" style="background: var(--warning)20; border-color: var(--warning); color: var(--warning);">
                    <i class="fas fa-wifi"></i>
                    Problema de conexión detectado. Verifica tu conexión a internet.
                </div>
            ` : ''}

            <div class="warning-message" style="background: #25D36620; border-color: #25D366; color: #25D366;">
                <i class="fab fa-whatsapp"></i>
                ¿Deseas compartir esta información?
            </div>

            <div class="modal-actions" style="flex-direction: column; gap: 10px;">
                <div style="display: flex; gap: 10px; width: 100%;">
                    <button id="zarpeResultPDF" class="btn btn-warning touch-target" style="flex: 1;">
                        <i class="fas fa-file-pdf"></i>
                        PDF
                    </button>
                    <button id="zarpeResultWhatsApp" class="btn btn-success touch-target" style="flex: 1;">
                        <i class="fab fa-whatsapp"></i>
                        WhatsApp
                    </button>
                </div>
                <button id="zarpeResultContinuar" class="btn btn-info touch-target" style="width: 100%;">
                    <i class="fas fa-check"></i>
                    Continuar
                </button>
            </div>
        `;

        const modalId = window.UI.showModal(modalContent, { className: 'modal-operador' });
        this.activeModals.set('zarpe-result-modal', { modalId, zarpeData });

        setTimeout(() => {
            this.setupZarpeResultEvents(zarpeData, status);
        }, 100);
    }

    setupZarpeResultEvents(zarpeData, status) {
        const continuarBtn = document.getElementById('zarpeResultContinuar');
        const whatsappBtn = document.getElementById('zarpeResultWhatsApp');
        const pdfBtn = document.getElementById('zarpeResultPDF');

        // Continuar sin compartir
        if (continuarBtn) {
            continuarBtn.addEventListener('click', () => {
                this.closeModal('zarpe-result-modal');
            });
        }

        // Compartir por WhatsApp
        if (whatsappBtn) {
            whatsappBtn.addEventListener('click', () => {
                this.closeModal('zarpe-result-modal');
                
                // Agregar información de status si hay problemas
                const zarpeDataForWhatsApp = {
                    ...zarpeData,
                    statusInfo: status === 'error' ? 'Información generada localmente debido a problemas de conexión.' : ''
                };
                
                this.showWhatsAppModal(zarpeDataForWhatsApp);
            });
        }

        // Generar PDF
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => {
                this.closeModal('zarpe-result-modal');
                
                const zarpeDataForPDF = {
                    ...zarpeData,
                    statusInfo: status === 'error' ? 'Información generada localmente debido a problemas de conexión.' : ''
                };
                
                this.showPDFModal(zarpeDataForPDF);
            });
        }
    }

    // ===========================
    // MODAL DE WHATSAPP
    // ===========================
    
    showWhatsAppModal(zarpeData) {
        const message = this.generateWhatsAppMessage(zarpeData);
        
        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title" style="color: #25D366;">
                    <i class="fab fa-whatsapp"></i>
                    Compartir por WhatsApp
                </h3>
                <button class="modal-close" onclick="window.Modals.closeModal('whatsapp-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="vessel-info" style="background: #25D36620; border-color: #25D366;">
                <h4><i class="fas fa-ship"></i> ${zarpeData.embarcacion}</h4>
                <p>Zarpe confirmado - ${zarpeData.cantidadPasajeros} pasajeros</p>
            </div>

            <div class="operador-form">
                <div class="form-group">
                    <label class="form-label" for="whatsappPhone">
                        <i class="fas fa-phone"></i>
                        Número de WhatsApp (Opcional)
                    </label>
                    <input 
                        type="tel" 
                        id="whatsappPhone" 
                        class="form-input touch-target"
                        placeholder="Ej: 300 123 4567 o +57 300 123 4567"
                    >
                    <small style="color: var(--text-muted); font-size: 12px; margin-top: 5px; display: block;">
                        <i class="fas fa-info-circle"></i> Deja vacío para seleccionar contacto en WhatsApp
                    </small>
                </div>

                <div class="form-summary">
                    <h4><i class="fas fa-eye"></i> Vista Previa del Mensaje</h4>
                    <div class="message-preview" style="background: var(--bg-card); padding: 1rem; border-radius: var(--border-radius); font-family: monospace; font-size: 12px; white-space: pre-line; max-height: 200px; overflow-y: auto;">
${message}
                    </div>
                </div>

                <div class="warning-message" style="background: #25D36620; border-color: #25D366; color: #25D366;">
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
                <button class="btn btn-error" onclick="window.Modals.closeModal('whatsapp-modal')">
                    <i class="fas fa-times"></i>
                    Cancelar
                </button>
                <button id="whatsappSendBtn" class="btn btn-success touch-target">
                    <i class="fab fa-whatsapp"></i>
                    Abrir WhatsApp
                </button>
            </div>
        `;

        const modalId = window.UI.showModal(modalContent, { className: 'modal-operador' });
        this.activeModals.set('whatsapp-modal', { modalId, zarpeData, message });

        setTimeout(() => {
            this.setupWhatsAppEvents(message);
        }, 100);
    }

    setupWhatsAppEvents(message) {
        const phoneInput = document.getElementById('whatsappPhone');
        const sendBtn = document.getElementById('whatsappSendBtn');

        // Formatear número mientras se escribe
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^\d]/g, '');
                
                if (value.length > 0) {
                    if (value.startsWith('57') && value.length > 2) {
                        const withoutCountry = value.substring(2);
                        if (withoutCountry.length <= 3) {
                            e.target.value = `+57 ${withoutCountry}`;
                        } else if (withoutCountry.length <= 6) {
                            e.target.value = `+57 ${withoutCountry.substring(0, 3)} ${withoutCountry.substring(3)}`;
                        } else {
                            e.target.value = `+57 ${withoutCountry.substring(0, 3)} ${withoutCountry.substring(3, 6)} ${withoutCountry.substring(6, 10)}`;
                        }
                    } else {
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

            phoneInput.focus();
        }

        // Enviar por WhatsApp
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                const phoneNumber = phoneInput ? phoneInput.value.trim() : '';
                
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<div class="spinner"></div> Abriendo...';
                
                try {
                    this.openWhatsApp(phoneNumber, message);
                    
                    setTimeout(() => {
                        this.closeModal('whatsapp-modal');
                        window.UI.showSuccess('📱 WhatsApp Abierto', 
                            phoneNumber ? 'Chat abierto con el número especificado' : 'Selecciona el contacto y envía el mensaje');
                    }, 1500);
                    
                } catch (error) {
                    console.error('Error abriendo WhatsApp:', error);
                    window.UI.showError('❌ Error', 'No se pudo abrir WhatsApp');
                    
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Abrir WhatsApp';
                }
            });
        }
    }

    generateWhatsAppMessage(zarpeData) {
        const fecha = new Date(zarpeData.fechaHora);
        const fechaFormateada = Format.date(fecha);
        const horaFormateada = Format.time(fecha);
        const operador = zarpeData.administrador.split('@')[0];

        let mensaje = `🚢 *ZARPE CONFIRMADO* 🚢\n\n`;
        mensaje += `📋 *DETALLES DEL VIAJE*\n`;
        mensaje += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        mensaje += `⛵ *Embarcación:* ${zarpeData.embarcacion}\n`;
        mensaje += `📍 *Posición:* ${zarpeData.posicionDesembarque}\n`;
        mensaje += `🏷️ *Categoría:* ${zarpeData.categoria}\n\n`;
        mensaje += `👥 *INFORMACIÓN DE PASAJEROS*\n`;
        mensaje += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        mensaje += `👤 *Pasajeros:* ${zarpeData.cantidadPasajeros} personas\n`;
        mensaje += `💰 *Valor Total:* ${Format.currency(zarpeData.valorTotal)}\n`;
        mensaje += `💵 *Valor por Persona:* ${Format.currency(zarpeData.valorPorPersona)}\n\n`;
        mensaje += `🕐 *INFORMACIÓN DEL ZARPE*\n`;
        mensaje += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        mensaje += `📅 *Fecha:* ${fechaFormateada}\n`;
        mensaje += `ⰰ *Hora:* ${horaFormateada}\n`;
        mensaje += `👨‍💼 *Operador:* ${operador}\n`;

        if (zarpeData.statusInfo) {
            mensaje += `\n⚠️ *NOTA:* ${zarpeData.statusInfo}`;
        }

        mensaje += `\n\n🤖 _Mensaje generado automáticamente por Admin Embarcaciones_`;
        mensaje += `\n🏝️ _Muelle Único Guatapé - Malecón San Juan del Puerto_`;

        return mensaje;
    }

    openWhatsApp(phoneNumber, message) {
        const encodedMessage = encodeURIComponent(message);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        let whatsappUrl;
        
        if (phoneNumber && phoneNumber.trim() !== '') {
            let cleanPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
            
            if (cleanPhone.startsWith('57') && cleanPhone.length > 10) {
                cleanPhone = '+' + cleanPhone;
            } else if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
                cleanPhone = '+57' + cleanPhone;
            }
            
            whatsappUrl = isMobile 
                ? `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`
                : `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
        } else {
            whatsappUrl = isMobile 
                ? `whatsapp://send?text=${encodedMessage}`
                : `https://wa.me/?text=${encodedMessage}`;
        }
        
        if (isMobile) {
            try {
                const link = document.createElement('a');
                link.href = whatsappUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => {
                    const webUrl = phoneNumber && phoneNumber.trim() ? 
                        `https://wa.me/${phoneNumber.replace(/[\s\-\(\)\+]/g, '')}?text=${encodedMessage}` :
                        `https://wa.me/?text=${encodedMessage}`;
                        
                    if (document.hasFocus()) {
                        window.open(webUrl, '_blank', 'noopener,noreferrer');
                    }
                }, 2000);
                
            } catch (error) {
                console.error('Error abriendo WhatsApp app:', error);
                const webUrl = phoneNumber && phoneNumber.trim() ? 
                    `https://wa.me/${phoneNumber.replace(/[\s\-\(\)\+]/g, '')}?text=${encodedMessage}` :
                    `https://wa.me/?text=${encodedMessage}`;
                window.open(webUrl, '_blank', 'noopener,noreferrer');
            }
        } else {
            window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        }
        
        Haptics.success();
    }

    // ===========================
    // MODAL DE PDF
    // ===========================
    
    showPDFModal(zarpeData) {
        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title" style="color: var(--warning);">
                    <i class="fas fa-file-pdf"></i>
                    Generar Ticket PDF
                </h3>
                <button class="modal-close" onclick="window.Modals.closeModal('pdf-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="vessel-info" style="background: rgba(255, 107, 53, 0.2); border-color: var(--warning);">
                <h4><i class="fas fa-ship"></i> ${zarpeData.embarcacion}</h4>
                <p>Ticket de zarpe - ${zarpeData.cantidadPasajeros} pasajeros</p>
            </div>

            <div class="form-summary">
                <h4><i class="fas fa-ticket-alt"></i> Información del Ticket</h4>
                <div class="summary-item">
                    <span><i class="fas fa-ship"></i> Embarcación:</span>
                    <strong>${zarpeData.embarcacion}</strong>
                </div>
                <div class="summary-item">
                    <span><i class="fas fa-users"></i> Pasajeros:</span>
                    <strong>${zarpeData.cantidadPasajeros}</strong>
                </div>
                <div class="summary-item">
                    <span><i class="fas fa-dollar-sign"></i> Valor Total:</span>
                    <strong>${Format.currency(zarpeData.valorTotal)}</strong>
                </div>
                <div class="summary-item">
                    <span><i class="fas fa-clock"></i> Hora:</span>
                    <strong>${Format.time(zarpeData.fechaHora)}</strong>
                </div>
            </div>

            <div class="warning-message" style="background: rgba(255, 193, 7, 0.2); border-color: var(--warning); color: var(--warning);">
                <i class="fas fa-info-circle"></i>
                El ticket se generará en formato PDF optimizado para impresión térmica (80mm).
            </div>

            <div class="modal-actions" style="flex-direction: column; gap: 10px;">
                <button id="pdfPreviewBtn" class="btn btn-info touch-target" style="width: 100%;">
                    <i class="fas fa-eye"></i>
                    Previsualizar
                </button>
                <button id="pdfDownloadBtn" class="btn btn-warning touch-target" style="width: 100%;">
                    <i class="fas fa-download"></i>
                    Descargar PDF
                </button>
                <button class="btn btn-error" onclick="window.Modals.closeModal('pdf-modal')">
                    <i class="fas fa-times"></i>
                    Cancelar
                </button>
            </div>
        `;

        const modalId = window.UI.showModal(modalContent, { className: 'modal-operador' });
        this.activeModals.set('pdf-modal', { modalId, zarpeData });

        setTimeout(() => {
            this.setupPDFEvents(zarpeData);
        }, 100);
    }

    setupPDFEvents(zarpeData) {
        const previewBtn = document.getElementById('pdfPreviewBtn');
        const downloadBtn = document.getElementById('pdfDownloadBtn');

        if (previewBtn) {
            previewBtn.addEventListener('click', async () => {
                previewBtn.disabled = true;
                previewBtn.innerHTML = '<div class="spinner"></div> Generando...';
                
                try {
                    await this.generatePDFTicket(zarpeData, 'preview');
                } finally {
                    previewBtn.disabled = false;
                    previewBtn.innerHTML = '<i class="fas fa-eye"></i> Previsualizar';
                }
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                downloadBtn.disabled = true;
                downloadBtn.innerHTML = '<div class="spinner"></div> Generando...';
                
                try {
                    await this.generatePDFTicket(zarpeData, 'download');
                    this.closeModal('pdf-modal');
                } finally {
                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = '<i class="fas fa-download"></i> Descargar PDF';
                }
            });
        }
    }

    async generatePDFTicket(zarpeData, action = 'download') {
        try {
            // Cargar jsPDF dinámicamente si no está disponible
            if (!window.jsPDF) {
                await this.loadJsPDF();
            }

            const doc = new window.jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [80, 120]
            });

            // Configuración del ticket
            const primaryColor = '#1e3c72';
            const goldColor = '#FFD700';
            
            // Encabezado
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(primaryColor);
            doc.text('MUELLE ÚNICO GUATAPÉ', 40, 15, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Malecón San Juan del Puerto', 40, 22, { align: 'center' });
            
            // Línea separadora
            doc.setDrawColor(goldColor);
            doc.setLineWidth(0.5);
            doc.line(5, 26, 75, 26);
            
            // Título del ticket
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(primaryColor);
            doc.text('TICKET DE ZARPE', 40, 34, { align: 'center' });
            
            // Información del zarpe
            let yPosition = 44;
            const lineHeight = 6;
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor('#000000');
            
            const addInfoLine = (label, value) => {
                doc.setFont('helvetica', 'bold');
                doc.text(label + ':', 8, yPosition);
                doc.setFont('helvetica', 'normal');
                doc.text(String(value), 35, yPosition);
                yPosition += lineHeight;
            };
            
            const fecha = new Date(zarpeData.fechaHora);
            const fechaFormateada = fecha.toLocaleDateString('es-CO');
            const horaFormateada = fecha.toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            addInfoLine('Categoría', zarpeData.categoria);
            addInfoLine('Embarcación', zarpeData.embarcacion);
            addInfoLine('Nº Personas', zarpeData.cantidadPasajeros);
            addInfoLine('Valor Total', Format.currency(zarpeData.valorTotal));
            
            yPosition += 2;
            doc.setDrawColor('#CCCCCC');
            doc.setLineWidth(0.3);
            doc.line(8, yPosition, 72, yPosition);
            yPosition += 6;
            
            addInfoLine('Fecha', fechaFormateada);
            addInfoLine('Hora', horaFormateada);
            addInfoLine('Posición', zarpeData.posicionDesembarque);
            
            // Footer
            yPosition += 4;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor('#666666');
            doc.text('¡Buen viaje!', 40, yPosition, { align: 'center' });
            
            yPosition += 4;
            doc.text('Conserve este ticket', 40, yPosition, { align: 'center' });
            
            yPosition += 8;
            doc.setFontSize(7);
            doc.text('Código: ' + Date.now().toString().slice(-8), 40, yPosition, { align: 'center' });

            if (zarpeData.statusInfo) {
                yPosition += 6;
                doc.setFontSize(6);
                doc.setTextColor('#ff6666');
                doc.text('* ' + zarpeData.statusInfo, 40, yPosition, { align: 'center' });
            }

            // Ejecutar acción
            if (action === 'preview') {
                const pdfBlob = doc.output('blob');
                const pdfUrl = URL.createObjectURL(pdfBlob);
                
                const previewWindow = window.open(pdfUrl, '_blank');
                if (!previewWindow) {
                    throw new Error('Popup bloqueado. Permite ventanas emergentes para previsualizar.');
                }
                
                setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
                
            } else {
                const fileName = `ticket_${zarpeData.embarcacion}_${Date.now()}.pdf`;
                doc.save(fileName);
                
                window.UI.showSuccess('📄 Ticket Generado', 'El ticket PDF ha sido descargado exitosamente');
            }

            Haptics.success();

        } catch (error) {
            console.error('Error generando PDF:', error);
            window.UI.showError('❌ Error PDF', error.message || 'No se pudo generar el ticket');
            Haptics.error();
        }
    }

    async loadJsPDF() {
        if (window.jsPDF) return;
        
        try {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            
            await new Promise((resolve, reject) => {
                script.onload = () => {
                    window.jsPDF = window.jspdf.jsPDF;
                    resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
            
        } catch (error) {
            throw new Error('No se pudo cargar la biblioteca PDF');
        }
    }

    // ===========================
    // BÚSQUEDA DE RESERVAS Y VENTAS
    // ===========================
    
    async buscarReserva(documento) {
        const resultDiv = document.getElementById('reservaResult');
        if (!resultDiv) return;

        if (!documento || isNaN(documento)) {
            resultDiv.innerHTML = `
                <div class="warning-message" style="background: var(--warning)20; border-color: var(--warning); color: var(--warning);">
                    <i class="fas fa-exclamation-triangle"></i>
                    Ingrese un número de documento válido.
                </div>
            `;
            return;
        }

        try {
            resultDiv.innerHTML = `
                <div class="loading" style="padding: 1rem;">
                    <div class="spinner"></div>
                    <span>Buscando reserva...</span>
                </div>
            `;

            const result = await window.Database.findReservaByDocument(documento);

            if (!result.found) {
                resultDiv.innerHTML = `
                    <div class="warning-message" style="background: var(--error)20; border-color: var(--error); color: var(--error);">
                        <i class="fas fa-times-circle"></i>
                        No se encontró una reserva para hoy con este documento.
                    </div>
                `;
                return;
            }

            const data = result.data;
            
            let contenido = `
                <div class="form-summary">
                    <h4><i class="fas fa-clipboard-check"></i> Reserva Encontrada</h4>
                    <div class="summary-item">
                        <span><i class="fas fa-user"></i> Nombre:</span>
                        <strong>${data.NOMBRE}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-ship"></i> Embarcación:</span>
                        <strong>${data.EMPRESA}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-users"></i> Pasajeros:</span>
                        <strong>${data.PASAJEROS}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-clock"></i> Salida:</span>
                        <strong>${data.fecha_hora_salida.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                    </div>
                </div>
            `;

            if (data.usado === true) {
                contenido += `
                    <div class="warning-message" style="background: var(--error)20; border-color: var(--error); color: var(--error);">
                        <i class="fas fa-ban"></i>
                        Esta reserva <strong>ya fue usada</strong>.
                    </div>
                `;
            } else {
                contenido += `
                    <button id="usarReservaBtn" class="btn btn-success touch-target" style="width: 100%; margin-top: 1rem;" onclick="window.Modals.marcarReservaUsada('${result.id}')">
                        <i class="fas fa-check-circle"></i>
                        Usar Reserva
                    </button>
                `;
            }

            resultDiv.innerHTML = contenido;

        } catch (error) {
            console.error('Error buscando reserva:', error);
            resultDiv.innerHTML = `
                <div class="warning-message" style="background: var(--error)20; border-color: var(--error); color: var(--error);">
                    <i class="fas fa-exclamation-circle"></i>
                    Ocurrió un error al consultar la reserva. Intente nuevamente.
                </div>
            `;
        }
    }

    async marcarReservaUsada(reservaId) {
        const usarBtn = document.getElementById('usarReservaBtn');
        if (!usarBtn) return;

        usarBtn.disabled = true;
        usarBtn.innerHTML = '<div class="spinner"></div> Procesando...';

        try {
            const result = await window.Database.markReservaAsUsed(reservaId);

            if (result.success) {
                const resultDiv = document.getElementById('reservaResult');
                if (resultDiv) {
                    resultDiv.innerHTML = `
                        <div class="warning-message" style="background: var(--success)20; border-color: var(--success); color: var(--success);">
                            <i class="fas fa-check-circle"></i>
                            La reserva fue marcada como <strong>usada</strong> correctamente.
                        </div>
                    `;
                }

                window.UI.showSuccess('✅ Reserva Usada', 'La reserva ha sido marcada como utilizada');
                Haptics.success();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Error marcando reserva:', error);
            window.UI.showError('❌ Error', 'No se pudo marcar la reserva como usada');
            Haptics.error();

            usarBtn.disabled = false;
            usarBtn.innerHTML = '<i class="fas fa-check-circle"></i> Usar Reserva';
        }
    }

    async buscarVenta(documento) {
        const resultDiv = document.getElementById('ventaResult');
        if (!resultDiv) return;

        if (!documento || documento.trim() === '') {
            resultDiv.innerHTML = `
                <div class="warning-message" style="background: var(--warning)20; border-color: var(--warning); color: var(--warning);">
                    <i class="fas fa-exclamation-triangle"></i>
                    Ingrese un número de documento válido.
                </div>
            `;
            return;
        }

        try {
            resultDiv.innerHTML = `
                <div class="loading" style="padding: 1rem;">
                    <div class="spinner"></div>
                    <span>Buscando venta...</span>
                </div>
            `;

            const result = await window.Database.findVentaByDocument(documento);

            if (!result.found) {
                resultDiv.innerHTML = `
                    <div class="warning-message" style="background: var(--error)20; border-color: var(--error); color: var(--error);">
                        <i class="fas fa-times-circle"></i>
                        No se encontró una venta con este documento para el día de hoy.
                    </div>
                `;
                return;
            }

            const data = result.data;
            
            // Ocultar elementos de búsqueda
            const docInput = document.getElementById('documentoVenta');
            const buscarBtn = document.getElementById('buscarVentaBtn');
            if (docInput) docInput.style.display = 'none';
            if (buscarBtn) buscarBtn.style.display = 'none';

            // Generar opciones de categorías
            const categorias = Object.entries(CONFIG.CATEGORIAS);
            let opcionesCategorias = '';
            
            categorias.forEach(([key, categoria]) => {
                const selected = categoria.nombre === data.embarcacion ? 'selected' : '';
                opcionesCategorias += `<option value="${key}" ${selected}>${categoria.nombre}</option>`;
            });

            // Calcular precio actualizado
            const precioActualizado = this.calcularNuevoPrecio(data.adultos, data.ninos, data.embarcacion);

            resultDiv.innerHTML = `
                <div class="form-summary">
                    <h4><i class="fas fa-ship"></i> Venta de Hoy Encontrada</h4>
                    <div class="summary-item">
                        <span><i class="fas fa-user"></i> Nombre:</span>
                        <strong>${data.nombre}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-id-card"></i> Documento:</span>
                        <strong>${data.documento}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-calendar-check"></i> Fecha:</span>
                        <strong>${data.fecha} ✅</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-users"></i> Adultos:</span>
                        <strong>${data.adultos}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-child"></i> Niños:</span>
                        <strong>${data.ninos}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-dollar-sign"></i> Precio Original:</span>
                        <strong>${Format.currency(data.precio)}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-ship"></i> Categoría Actual:</span>
                        <strong>${data.embarcacion}</strong>
                    </div>
                </div>
                
                <div class="form-group" style="margin-top: 15px;">
                    <label class="form-label" for="nuevaCategoria">
                        <i class="fas fa-exchange-alt"></i>
                        Nueva Categoría
                    </label>
                    <select id="nuevaCategoria" class="form-input touch-target" onchange="window.Modals.actualizarPrecioPreview('${data.adultos}', '${data.ninos}', '${data.precio}', '${result.id}', '${data.embarcacion}')">
                        ${opcionesCategorias}
                    </select>
                </div>
                
                <div class="form-summary" id="precioPreview" style="margin-top: 15px; background: var(--warning)20; border-color: var(--warning);">
                    <h4><i class="fas fa-calculator"></i> Precio con Nueva Categoría</h4>
                    <div class="summary-item">
                        <span><i class="fas fa-arrow-right"></i> Precio Actualizado:</span>
                        <strong id="nuevoPrecioDisplay">${Format.currency(precioActualizado)}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-chart-line"></i> Diferencia:</span>
                        <strong id="diferenciaPrecio" style="color: ${precioActualizado > data.precio ? 'var(--error)' : 'var(--success)'}">${precioActualizado > data.precio ? '+' : ''}${Format.currency(precioActualizado - data.precio)}</strong>
                    </div>
                </div>
                
                <div class="warning-message" style="background: var(--info)20; border-color: var(--info); color: var(--info);">
                    <i class="fas fa-info-circle"></i>
                    Solo se pueden modificar ventas del día actual
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
                    <button id="confirmarCambioBtn" class="btn btn-warning touch-target" onclick="window.Modals.confirmarCambioCategoria('${result.id}', '${data.embarcacion}', ${data.adultos}, ${data.ninos}, ${data.precio})">
                        <i class="fas fa-check-circle"></i>
                        Cambiar Categoría y Actualizar Precio
                    </button>
                    
                    <button class="btn btn-info touch-target" onclick="window.Modals.volverBusquedaVenta()">
                        <i class="fas fa-search"></i>
                        Buscar Otra Venta
                    </button>
                </div>
            `;

        } catch (error) {
            console.error('Error buscando venta:', error);
            resultDiv.innerHTML = `
                <div class="warning-message" style="background: var(--error)20; border-color: var(--error); color: var(--error);">
                    <i class="fas fa-exclamation-circle"></i>
                    Ocurrió un error al consultar la venta. Intente nuevamente.
                </div>
            `;
        }
    }

    calcularNuevoPrecio(adultos, ninos, categoria) {
        const totalPersonas = adultos;
        let total = 0;
        
        // Mapear categorías a precios
        const categoriaKey = Object.keys(CONFIG.CATEGORIAS).find(key => 
            CONFIG.CATEGORIAS[key].nombre === categoria
        );
        
        if (!categoriaKey) return 0;
        
        switch (categoriaKey) {
            case 'lancha-taxi':
                total = totalPersonas * 30000;
                break;
                
            case 'deportiva':
                if (totalPersonas <= 4) {
                    total = 250000;
                } else if (totalPersonas <= 6) {
                    total = 300000;
                } else {
                    total = totalPersonas * 50000;
                }
                break;
                
            case 'planchon':
                if (totalPersonas <= 10) {
                    total = 350000;
                } else if (totalPersonas <= 15) {
                    total = 450000;
                } else if (totalPersonas <= 20) {
                    total = 500000;
                } else {
                    total = totalPersonas * 25000;
                }
                break;
                
            case 'barco':
                if (totalPersonas <= 19) {
                    total = totalPersonas * 30000;
                } else if (totalPersonas <= 30) {
                    total = totalPersonas * 25000;
                } else {
                    total = totalPersonas * 20000;
                }
                break;
                
            case 'yate':
                if (totalPersonas <= 10) {
                    total = 400000;
                } else {
                    total = totalPersonas * 30000;
                }
                break;
                
            case 'carguero':
                total = Math.ceil(totalPersonas / 5) * 200000;
                break;
                
            default:
                total = 0;
        }
        
        return total;
    }

    actualizarPrecioPreview(adultos, ninos, precioOriginal, ventaId, categoriaActual) {
        const nuevaCategoriaSelect = document.getElementById('nuevaCategoria');
        if (!nuevaCategoriaSelect) return;

        const nuevaCategoriaKey = nuevaCategoriaSelect.value;
        const nuevaCategoriaNombre = CONFIG.CATEGORIAS[nuevaCategoriaKey]?.nombre || '';
        
        const nuevoPrecio = this.calcularNuevoPrecio(parseInt(adultos), parseInt(ninos), nuevaCategoriaNombre);
        
        const nuevoPrecioDisplay = document.getElementById('nuevoPrecioDisplay');
        const diferenciaPrecio = document.getElementById('diferenciaPrecio');
        const confirmarBtn = document.getElementById('confirmarCambioBtn');
        
        if (nuevoPrecioDisplay) {
            nuevoPrecioDisplay.textContent = Format.currency(nuevoPrecio);
        }
        
        if (diferenciaPrecio) {
            const diferencia = nuevoPrecio - parseInt(precioOriginal);
            diferenciaPrecio.textContent = `${diferencia > 0 ? '+' : ''}${Format.currency(diferencia)}`;
            diferenciaPrecio.style.color = diferencia > 0 ? 'var(--error)' : 'var(--success)';
        }
        
        if (confirmarBtn) {
            confirmarBtn.disabled = nuevaCategoriaNombre === categoriaActual;
        }
    }

    async confirmarCambioCategoria(ventaId, categoriaActual, adultos, ninos, precioOriginal) {
        const nuevaCategoriaSelect = document.getElementById('nuevaCategoria');
        if (!nuevaCategoriaSelect) return;

        const nuevaCategoriaKey = nuevaCategoriaSelect.value;
        const nuevaCategoriaNombre = CONFIG.CATEGORIAS[nuevaCategoriaKey]?.nombre || '';

        if (nuevaCategoriaNombre === categoriaActual) {
            window.UI.showWarning('⚠️ Sin Cambios', 'La categoría seleccionada es la misma que la actual');
            return;
        }

        const nuevoPrecio = this.calcularNuevoPrecio(adultos, ninos, nuevaCategoriaNombre);
        const diferencia = nuevoPrecio - precioOriginal;

        const confirmarBtn = document.getElementById('confirmarCambioBtn');
        if (confirmarBtn) {
            confirmarBtn.disabled = true;
            confirmarBtn.innerHTML = '<div class="spinner"></div> Actualizando...';
        }

        try {
            const result = await window.Database.updateVentaCategoria(ventaId, nuevaCategoriaNombre, nuevoPrecio);

            if (result.success) {
                const resultDiv = document.getElementById('ventaResult');
                if (resultDiv) {
                    resultDiv.innerHTML = `
                        <div class="form-summary">
                            <h4><i class="fas fa-check-circle"></i> Categoría y Precio Actualizados</h4>
                            <div class="summary-item">
                                <span><i class="fas fa-ship"></i> Categoría:</span>
                                <strong>${categoriaActual} → ${nuevaCategoriaNombre}</strong>
                            </div>
                            <div class="summary-item">
                                <span><i class="fas fa-dollar-sign"></i> Precio:</span>
                                <strong>${Format.currency(precioOriginal)} → ${Format.currency(nuevoPrecio)}</strong>
                            </div>
                            <div class="summary-item">
                                <span><i class="fas fa-chart-line"></i> Diferencia:</span>
                                <strong style="color: ${diferencia > 0 ? 'var(--error)' : 'var(--success)'}">${diferencia > 0 ? '+' : ''}${Format.currency(diferencia)}</strong>
                            </div>
                        </div>
                        
                        <button class="btn btn-info touch-target" onclick="window.Modals.volverBusquedaVenta()" style="width: 100%; margin-top: 15px;">
                            <i class="fas fa-search"></i>
                            Buscar Otra Venta
                        </button>
                    `;
                }

                window.UI.showSuccess('✅ Venta Actualizada', 'La categoría y precio han sido actualizados correctamente');
                Haptics.success();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Error actualizando venta:', error);
            window.UI.showError('❌ Error', 'No se pudo actualizar la venta. Intente nuevamente');
            Haptics.error();

            if (confirmarBtn) {
                confirmarBtn.disabled = false;
                confirmarBtn.innerHTML = '<i class="fas fa-check-circle"></i> Cambiar Categoría y Actualizar Precio';
            }
        }
    }

    volverBusquedaVenta() {
        const resultDiv = document.getElementById('ventaResult');
        const docInput = document.getElementById('documentoVenta');
        const buscarBtn = document.getElementById('buscarVentaBtn');

        if (resultDiv) {
            resultDiv.innerHTML = '';
        }

        if (docInput) {
            docInput.style.display = 'block';
            docInput.value = '';
            docInput.focus();
        }

        if (buscarBtn) {
            buscarBtn.style.display = 'block';
        }
    }

    // ===========================
    // MODAL DE CONFIRMACIÓN GENÉRICO
    // ===========================
    
    showConfirmationModal(title, message, onConfirm, options = {}) {
        const confirmBtnText = options.confirmText || 'Confirmar';
        const confirmBtnClass = options.confirmClass || 'btn-error';
        const icon = options.icon || 'fas fa-exclamation-triangle';

        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title" style="color: var(--warning);">
                    <i class="${icon}"></i>
                    ${title}
                </h3>
            </div>
            
            <div class="modal-body" style="padding: 2rem; text-align: center;">
                <p style="font-size: 1.1rem; line-height: 1.5; margin-bottom: 2rem;">
                    ${message}
                </p>
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-info" onclick="window.Modals.closeModal('confirmation-modal')">
                    <i class="fas fa-times"></i>
                    Cancelar
                </button>
                <button id="confirmActionBtn" class="btn ${confirmBtnClass}">
                    <i class="fas fa-check"></i>
                    ${confirmBtnText}
                </button>
            </div>
        `;

        const modalId = window.UI.showModal(modalContent, { className: 'modal-operador' });
        this.activeModals.set('confirmation-modal', { modalId, onConfirm });

        setTimeout(() => {
            const confirmBtn = document.getElementById('confirmActionBtn');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', async () => {
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '<div class="spinner"></div> Procesando...';
                    
                    try {
                        await onConfirm();
                        this.closeModal('confirmation-modal');
                    } catch (error) {
                        console.error('Error en confirmación:', error);
                        confirmBtn.disabled = false;
                        confirmBtn.innerHTML = `<i class="fas fa-check"></i> ${confirmBtnText}`;
                    }
                });
            }
        }, 100);

        return modalId;
    }

    // ===========================
    // MODAL DE INFORMACIÓN GENÉRICO
    // ===========================
    
    showInfoModal(title, content, options = {}) {
        const icon = options.icon || 'fas fa-info-circle';
        const className = options.className || 'modal-operador';

        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="${icon}"></i>
                    ${title}
                </h3>
                <button class="modal-close" onclick="window.Modals.closeModal('info-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="modal-body">
                ${content}
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-info" onclick="window.Modals.closeModal('info-modal')">
                    <i class="fas fa-check"></i>
                    Entendido
                </button>
            </div>
        `;

        const modalId = window.UI.showModal(modalContent, { className });
        this.activeModals.set('info-modal', { modalId });

        return modalId;
    }

    // ===========================
    // UTILIDADES DE MODALES
    // ===========================
    
    closeModal(modalKey) {
        const modalData = this.activeModals.get(modalKey);
        if (modalData) {
            window.UI.closeModal(modalData.modalId);
            this.activeModals.delete(modalKey);
        }
    }

    closeAllModals() {
        this.activeModals.forEach((modalData, key) => {
            window.UI.closeModal(modalData.modalId);
        });
        this.activeModals.clear();
    }

    // Verificar si hay modales abiertos
    hasOpenModals() {
        return this.activeModals.size > 0;
    }

    // Obtener modal activo por key
    getActiveModal(modalKey) {
        return this.activeModals.get(modalKey);
    }

    // ===========================
    // VALIDACIONES Y HELPERS
    // ===========================
    
    // Validar datos de zarpe
    validateZarpeData(pasajeros, valor) {
        const errors = [];
        
        if (!pasajeros || pasajeros < 1 || pasajeros > 50) {
            errors.push('El número de pasajeros debe estar entre 1 y 50');
        }
        
        if (!valor || valor < 1000) {
            errors.push('El valor del viaje debe ser mayor a $1,000');
        }
        
        if (valor > 10000000) {
            errors.push('El valor del viaje no puede exceder $10,000,000');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Generar resumen de zarpe para mostrar
    generateZarpeSummary(zarpeData) {
        return `
            <div class="form-summary">
                <h4><i class="fas fa-clipboard-check"></i> Resumen del Zarpe</h4>
                <div class="summary-item">
                    <span><i class="fas fa-ship"></i> Embarcación:</span>
                    <strong>${zarpeData.embarcacion}</strong>
                </div>
                <div class="summary-item">
                    <span><i class="fas fa-users"></i> Pasajeros:</span>
                    <strong>${zarpeData.cantidadPasajeros}</strong>
                </div>
                <div class="summary-item">
                    <span><i class="fas fa-dollar-sign"></i> Valor Total:</span>
                    <strong>${Format.currency(zarpeData.valorTotal)}</strong>
                </div>
                <div class="summary-item">
                    <span><i class="fas fa-calculator"></i> Valor por Persona:</span>
                    <strong>${Format.currency(zarpeData.valorPorPersona)}</strong>
                </div>
                <div class="summary-item">
                    <span><i class="fas fa-clock"></i> Hora:</span>
                    <strong>${Format.time(zarpeData.fechaHora)}</strong>
                </div>
                <div class="summary-item">
                    <span><i class="fas fa-user-tie"></i> Operador:</span>
                    <strong>${zarpeData.administrador.split('@')[0]}</strong>
                </div>
            </div>
        `;
    }

    // Validar formato de teléfono
    validatePhoneNumber(phone) {
        if (!phone || phone.trim() === '') return true; // Opcional
        
        const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
        return cleanPhone.length >= 10 && cleanPhone.length <= 15;
    }

    // Formatear número de teléfono para WhatsApp
    formatPhoneForWhatsApp(phone) {
        if (!phone) return '';
        
        let clean = phone.replace(/[\s\-\(\)\+]/g, '');
        
        if (clean.startsWith('57') && clean.length > 10) {
            return '+' + clean;
        } else if (clean.length === 10 && !clean.startsWith('+')) {
            return '+57' + clean;
        } else if (clean.startsWith('+')) {
            return clean;
        }
        
        return clean;
    }

    // Mostrar error dentro de un modal
    showModalError(modalKey, message) {
        const modalData = this.activeModals.get(modalKey);
        if (!modalData) return;
        
        // Buscar container de error en el modal o crear uno
        const modal = document.querySelector(`#${modalData.modalId} .modal-content`);
        if (!modal) return;
        
        // Remover error anterior si existe
        const existingError = modal.querySelector('.modal-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Crear nuevo error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'modal-error warning-message';
        errorDiv.style.background = 'var(--error)20';
        errorDiv.style.borderColor = 'var(--error)';
        errorDiv.style.color = 'var(--error)';
        errorDiv.style.marginTop = '1rem';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            ${message}
        `;
        
        // Insertar antes de las acciones
        const actions = modal.querySelector('.modal-actions');
        if (actions) {
            actions.parentNode.insertBefore(errorDiv, actions);
        } else {
            modal.appendChild(errorDiv);
        }
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
        
        Haptics.error();
    }

    // Limpiar errores de modal
    clearModalErrors(modalKey) {
        const modalData = this.activeModals.get(modalKey);
        if (!modalData) return;
        
        const modal = document.querySelector(`#${modalData.modalId} .modal-content`);
        if (!modal) return;
        
        const errors = modal.querySelectorAll('.modal-error');
        errors.forEach(error => error.remove());
    }

    // Deshabilitar/habilitar botón con loading
    setButtonLoading(buttonId, isLoading, loadingText = 'Procesando...', originalText = '') {
        const button = document.getElementById(buttonId);
        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.innerHTML = `<div class="spinner"></div> ${loadingText}`;
        } else {
            button.disabled = false;
            button.innerHTML = originalText || button.innerHTML.replace(/<div class="spinner"><\/div>.*/, '');
        }
    }

    // Calcular precios según categoría (función auxiliar)
    calculateCategoryPrice(categoria, passengers) {
        const basePrice = CONFIG.CATEGORIAS[categoria]?.precio || 30000;
        return basePrice * passengers;
    }

    // Obtener texto formateado para diferentes estados
    getStatusText(status) {
        const statusTexts = {
            success: '✅ Exitoso',
            partial: '⚠️ Parcial',
            error: '❌ Error',
            warning: '⚠️ Advertencia',
            info: 'ℹ️ Información'
        };
        return statusTexts[status] || status;
    }

    // Generar ID único para modales
    generateModalId() {
        return 'modal_' + ID.generate();
    }

    // ===========================
    // UTILIDADES DE NOTIFICACIÓN
    // ===========================

    // Mostrar notificación temporal en modal
    showModalNotification(modalKey, message, type = 'info', duration = 3000) {
        const modalData = this.activeModals.get(modalKey);
        if (!modalData) return;

        const modal = document.querySelector(`#${modalData.modalId} .modal-content`);
        if (!modal) return;

        // Crear notificación
        const notification = document.createElement('div');
        notification.className = `modal-notification ${type}`;
        notification.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 10px 15px;
            background: var(--${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'})20;
            border: 1px solid var(--${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'});
            border-radius: var(--border-radius);
            color: var(--${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'});
            font-size: 14px;
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i>
            ${message}
        `;

        modal.style.position = 'relative';
        modal.appendChild(notification);

        // Mostrar con animación
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });

        // Auto-remover
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, duration);
    }

    // Validar conexión antes de operación
    async validateConnection() {
        try {
            const isConnected = await window.Database.testConnection();
            if (!isConnected) {
                throw new Error('Sin conexión a la base de datos');
            }
            return true;
        } catch (error) {
            this.showModalError('connection-error', 'Problema de conexión detectado. Algunas funciones pueden no estar disponibles.');
            return false;
        }
    }

    // Formatear datos para exportación
    formatDataForExport(data, format = 'text') {
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                if (Array.isArray(data)) {
                    const headers = Object.keys(data[0] || {});
                    const rows = data.map(item => headers.map(h => item[h] || '').join(','));
                    return [headers.join(','), ...rows].join('\n');
                }
                return '';
            case 'text':
            default:
                return typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
        }
    }

    // Copiar al portapapeles
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback para navegadores más antiguos
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            }
        } catch (error) {
            console.error('Error copiando al portapapeles:', error);
            return false;
        }
    }

    // Descargar archivo
    downloadFile(content, filename, contentType = 'text/plain') {
        try {
            const blob = new Blob([content], { type: contentType });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Limpiar URL después de un tiempo
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            
            return true;
        } catch (error) {
            console.error('Error descargando archivo:', error);
            return false;
        }
    }

    // Verificar si es dispositivo móvil
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Obtener información del dispositivo
    getDeviceInfo() {
        return {
            isMobile: this.isMobileDevice(),
            isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
            isAndroid: /Android/.test(navigator.userAgent),
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            supportsVibration: 'vibrate' in navigator,
            supportsNotifications: 'Notification' in window
        };
    }

    // Ajustar modal para dispositivo
    adjustModalForDevice(modalKey) {
        const modalData = this.activeModals.get(modalKey);
        if (!modalData) return;

        const modal = document.querySelector(`#${modalData.modalId} .modal-content`);
        if (!modal) return;

        const deviceInfo = this.getDeviceInfo();
        
        if (deviceInfo.isMobile) {
            // Ajustes para móviles
            modal.style.maxWidth = '95vw';
            modal.style.maxHeight = '90vh';
            modal.style.margin = '5vh auto';
            
            // Ajustar inputs para mejor UX móvil
            const inputs = modal.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.style.fontSize = '16px'; // Evitar zoom en iOS
                input.style.minHeight = '44px'; // Tamaño mínimo de touch target
            });
        }
    }

    // Cleanup completo
    cleanup() {
        // Cerrar todos los modales
        this.closeAllModals();
        
        // Limpiar referencias
        this.activeModals.clear();
        
        // Remover event listeners globales si los hay
        // (En este caso no hay, pero es buena práctica)
    }

    // Debug: Mostrar estado de modales
    debugModals() {

        this.activeModals.forEach((modalData, key) => {
            console.log();
        });
        
        if (this.activeModals.size === 0) {
            console.log();
        }
    }

    // Obtener estadísticas de uso
    getUsageStats() {
        return {
            totalModalsOpened: this.activeModals.size,
            activeModals: Array.from(this.activeModals.keys()),
            lastModalOpened: this.lastModalOpened || null,
            deviceInfo: this.getDeviceInfo()
        };
    }
}

// ===========================
// INSTANCIA GLOBAL
// ===========================
const modalsManager = new ModalsManager();

// Exportar para uso en otros módulos
export default modalsManager;

// Hacer disponible globalmente
window.Modals = modalsManager;

// ===========================
// EVENT LISTENERS GLOBALES
// ===========================

// Cerrar modales con tecla ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalsManager.hasOpenModals()) {
        // Cerrar el último modal abierto
        const modalKeys = Array.from(modalsManager.activeModals.keys());
        const lastModalKey = modalKeys[modalKeys.length - 1];
        if (lastModalKey) {
            modalsManager.closeModal(lastModalKey);
        }
    }
});

// Ajustar modales en cambio de orientación
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        modalsManager.activeModals.forEach((modalData, key) => {
            modalsManager.adjustModalForDevice(key);
        });
    }, 100);
});

// Cleanup al cerrar la ventana
window.addEventListener('beforeunload', () => {
    modalsManager.cleanup();
});

console.log('📱 Módulo de Modales cargado correctamente');
console.log('🔧 Funciones disponibles: Zarpe, WhatsApp, PDF, Reservas, Ventas');
console.log('📊 Total de métodos:', Object.getOwnPropertyNames(ModalsManager.prototype).length);