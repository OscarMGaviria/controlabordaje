// ===========================
// MÓDULO PARA GENERAR TICKETS PDF
// ===========================

import { triggerHapticFeedback } from './utils/haptics.js';

/**
 * Clase para generar tickets PDF usando jsPDF
 */
export class TicketPDF {
    constructor() {
        this.loadjsPDF();
    }

    /**
     * Cargar biblioteca jsPDF dinámicamente
     */
    async loadjsPDF() {
        if (window.jsPDF) return;
        
        try {
            // Cargar jsPDF desde CDN
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                window.jsPDF = window.jspdf.jsPDF;
            };
            document.head.appendChild(script);
            
            // Esperar a que se cargue
            await new Promise((resolve) => {
                const checkLoaded = () => {
                    if (window.jsPDF) {
                        resolve();
                    } else {
                        setTimeout(checkLoaded, 100);
                    }
                };
                checkLoaded();
            });
        } catch (error) {
            throw new Error('No se pudo cargar la biblioteca PDF');
        }
    }

    /**
     * Generar ticket PDF
     * @param {Object} zarpeData - Datos del zarpe
     * @returns {Object} PDF document
     */
    async generateTicket(zarpeData) {
        await this.loadjsPDF();
        
        const doc = new window.jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, 120] // Formato de ticket (80mm x 120mm)
        });

        // Configuración de fuentes y colores
        const primaryColor = '#1e3c72';
        const goldColor = '#FFD700';
        
        // Encabezado principal
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor);
        doc.text('MUELLE ÚNICO GUATAPÉ', 40, 15, { align: 'center' });
        
        // Subtítulo
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
        
        // Función helper para agregar líneas de información
        const addInfoLine = (label, value) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label + ':', 8, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.text(String(value), 35, yPosition);
            yPosition += lineHeight;
        };
        
        // Datos del zarpe
        const fecha = new Date(zarpeData.fechaHora);
        const fechaFormateada = fecha.toLocaleDateString('es-CO');
        const horaFormateada = fecha.toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        addInfoLine('Categoría', zarpeData.categoria);
        addInfoLine('Embarcación', zarpeData.embarcacion);
        addInfoLine('Nº Personas', zarpeData.cantidadPasajeros);
        addInfoLine('Valor Total', '$' + zarpeData.valorTotal.toLocaleString('es-CO'));
        
        // Línea separadora
        yPosition += 2;
        doc.setDrawColor('#CCCCCC');
        doc.setLineWidth(0.3);
        doc.line(8, yPosition, 72, yPosition);
        yPosition += 6;
        
        // Información adicional
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
        
        // Código de ticket (timestamp)
        yPosition += 8;
        doc.setFontSize(7);
        doc.text('Código: ' + Date.now().toString().slice(-8), 40, yPosition, { align: 'center' });
        
        return doc;
    }

    /**
     * Descargar ticket como PDF
     * @param {Object} zarpeData - Datos del zarpe
     */
    async downloadTicket(zarpeData) {
        try {
            triggerHapticFeedback('medium');
            
            const doc = await this.generateTicket(zarpeData);
            const fileName = `ticket_${zarpeData.embarcacion}_${Date.now()}.pdf`;
            
            doc.save(fileName);
            
            triggerHapticFeedback('success');
            
            // Disparar evento de éxito
            window.dispatchEvent(new CustomEvent('showSuccess', {
                detail: {
                    title: '📄 Ticket Generado',
                    message: 'El ticket PDF ha sido descargado exitosamente.',
                    duration: 3000
                }
            }));
            
        } catch (error) {
            triggerHapticFeedback('error');
            
            window.dispatchEvent(new CustomEvent('showError', {
                detail: {
                    title: '❌ Error al Generar PDF',
                    message: 'No se pudo generar el ticket. Intenta nuevamente.',
                    duration: 4000
                }
            }));
            
            throw error;
        }
    }

    /**
     * Previsualizar ticket en nueva ventana
     * @param {Object} zarpeData - Datos del zarpe
     */
    async previewTicket(zarpeData) {
        try {
            const doc = await this.generateTicket(zarpeData);
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            
            // Abrir en nueva ventana
            const previewWindow = window.open(pdfUrl, '_blank');
            
            if (!previewWindow) {
                throw new Error('Popup bloqueado. Permite ventanas emergentes para previsualizar.');
            }
            
            // Limpiar URL después de un tiempo
            setTimeout(() => {
                URL.revokeObjectURL(pdfUrl);
            }, 60000);
            
        } catch (error) {
            window.dispatchEvent(new CustomEvent('showError', {
                detail: {
                    title: '❌ Error de Previsualización',
                    message: error.message,
                    duration: 4000
                }
            }));
        }
    }
}

/**
 * Función para mostrar modal de opciones PDF
 * @param {Object} zarpeData - Datos del zarpe
 */
export function showPDFOptionsModal(zarpeData) {
    const ticketPDF = new TicketPDF();
    
    // Crear modal dinámicamente
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.id = 'pdfOptionsModal';
    modalOverlay.style.display = 'flex';
    
    modalOverlay.innerHTML = `
        <div class="modal-content" style="max-width: 400px; border-color: #ff6b35;">
            <div class="modal-header">
                <div class="modal-title" style="color: #ff6b35;">
                    <i class="fas fa-file-pdf"></i>
                    Generar Ticket PDF
                </div>
                <button class="modal-close" id="pdfModalClose">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="modal-body">
                <div class="vessel-info" style="background: rgba(255, 107, 53, 0.1); border-color: rgba(255, 107, 53, 0.3);">
                    <h3><i class="fas fa-ship"></i> ${zarpeData.embarcacion}</h3>
                    <p>Ticket de zarpe - ${zarpeData.cantidadPasajeros} pasajeros</p>
                </div>

                <div class="summary-section" style="background: rgba(255, 107, 53, 0.1); border-color: rgba(255, 107, 53, 0.3);">
                    <div class="summary-title">
                        <i class="fas fa-ticket-alt"></i> Información del Ticket
                    </div>
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
                        <strong>$${zarpeData.valorTotal.toLocaleString('es-CO')}</strong>
                    </div>
                    <div class="summary-item">
                        <span><i class="fas fa-clock"></i> Hora:</span>
                        <strong>${new Date(zarpeData.fechaHora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</strong>
                    </div>
                </div>

                <div class="warning-message" style="background: rgba(255, 193, 7, 0.2); border-color: rgba(255, 193, 7, 0.5); color: #ffc107;">
                    <i class="fas fa-info-circle"></i>
                    El ticket se generará en formato PDF optimizado para impresión térmica (80mm).
                </div>
            </div>

            <div class="modal-actions" style="flex-direction: column; gap: 10px;">
                <button class="modal-button touch-target" id="pdfBtnPreview" 
                        style="background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: #fff; border-color: #17a2b8;">
                    <i class="fas fa-eye"></i> Previsualizar
                </button>
                <button class="modal-button touch-target" id="pdfBtnDownload" 
                        style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: #fff; border-color: #ff6b35;">
                    <i class="fas fa-download"></i> Descargar PDF
                </button>
                <button class="modal-button btn-cancel touch-target" id="pdfBtnCancelar">
                    <i class="fas fa-times"></i> Cancelar
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
    
    // Cerrar modal
    document.getElementById('pdfModalClose').addEventListener('click', closeModal);
    document.getElementById('pdfBtnCancelar').addEventListener('click', closeModal);
    
    // Previsualizar PDF
    document.getElementById('pdfBtnPreview').addEventListener('click', async () => {
        const previewBtn = document.getElementById('pdfBtnPreview');
        previewBtn.disabled = true;
        previewBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        
        try {
            await ticketPDF.previewTicket(zarpeData);
        } finally {
            previewBtn.disabled = false;
            previewBtn.innerHTML = '<i class="fas fa-eye"></i> Previsualizar';
        }
    });
    
    // Descargar PDF
    document.getElementById('pdfBtnDownload').addEventListener('click', async () => {
        const downloadBtn = document.getElementById('pdfBtnDownload');
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        
        try {
            await ticketPDF.downloadTicket(zarpeData);
            closeModal();
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Descargar PDF';
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
}

/**
 * Función rápida para generar y descargar ticket
 * @param {Object} zarpeData - Datos del zarpe
 */
export async function quickDownloadTicket(zarpeData) {
    const ticketPDF = new TicketPDF();
    await ticketPDF.downloadTicket(zarpeData);
}

/**
 * Verificar si el navegador soporta descarga de PDFs
 * @returns {boolean} True si es compatible
 */
export function isPDFSupported() {
    return typeof window !== 'undefined' && 'Blob' in window && 'URL' in window;
}

/**
 * Obtener texto del botón según el dispositivo
 * @returns {string} Texto del botón
 */
export function getPDFButtonText() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobile ? 'Descargar Ticket' : 'Generar PDF';
}

// Exportar instancia por defecto
export const ticketPDFService = new TicketPDF();