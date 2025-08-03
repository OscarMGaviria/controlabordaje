import { renderVessels } from './embarcaciones.js';
import { triggerHapticFeedback } from './utils/haptics.js';

/**
 * Clase TurnoNautico mejorada para manejar la lógica de turnos
 */
export class TurnoNautico {
    constructor(lista) {
        this.lista = [...lista];
        this.reasignarPosiciones();
    }

    embarcar() {
        let embarcandoAsignado = false;
        for (const embarcacion of this.lista) {
            if (embarcacion.estado === "SUSPENDIDO") continue;
            if (!embarcandoAsignado) {
                embarcacion.estado = "EMBARCANDO";
                embarcandoAsignado = true;
            } else {
                embarcacion.estado = "EN TURNO";
            }
        }
    }

    desembarcar() {
        this.embarcar();
        const index = this.lista.findIndex(e => e.estado === "EMBARCANDO");
        if (index === -1) return false;
        const embarcando = this.lista.splice(index, 1)[0];
        embarcando.estado = "EN TURNO";
        this.lista.push(embarcando);
        this.reasignarPosiciones();
        this.embarcar();
        return true;
    }

    // Nueva función para manejar embarcación suspendida en posición 1
    reactivarPrimero() {
        // Buscar embarcación en posición 1 que esté suspendida
        const primeraSuspendida = this.lista.find(e => e.posicion === 1 && e.estado === "SUSPENDIDO");
        
        if (!primeraSuspendida) {
            return false; // No hay embarcación suspendida en posición 1
        }

        // Cambiar estado a "EN TURNO"
        primeraSuspendida.estado = "EN TURNO";

        // Reorganizar posiciones: 1->3, 2->1, 3->2
        const embarcacionPos2 = this.lista.find(e => e.posicion === 2);
        const embarcacionPos3 = this.lista.find(e => e.posicion === 3);

        // Mover la que estaba en posición 1 (suspendida) a posición 3
        primeraSuspendida.posicion = 3;

        // Mover la que estaba en posición 2 a posición 1
        if (embarcacionPos2) {
            embarcacionPos2.posicion = 1;
        }

        // Mover la que estaba en posición 3 a posición 2
        if (embarcacionPos3) {
            embarcacionPos3.posicion = 2;
        }

        // Ordenar la lista por posición actualizada
        this.lista.sort((a, b) => a.posicion - b.posicion);

        // Aplicar lógica de embarque
        this.embarcar();

        return true;
    }

    // Validar si se puede cambiar a embarcando consecutivamente
    puedeEmbarcar(posicion) {
        // Encontrar todas las embarcaciones que están embarcando
        const embarcando = this.lista.filter(e => e.estado === "EMBARCANDO").map(e => e.posicion).sort((a, b) => a - b);
        
        if (embarcando.length === 0) {
            // Si no hay ninguna embarcando, solo la posición 1 puede embarcar
            return posicion === 1;
        }

        // Verificar que sea consecutiva
        const ultimaEmbarcando = Math.max(...embarcando);
        return posicion === ultimaEmbarcando + 1;
    }

    reasignarPosiciones() {
        this.lista.forEach((e, i) => e.posicion = i + 1);
    }

    obtenerLista() {
        return this.lista;
    }
}

/**
 * Establece los listeners de los botones de categoría.
 * @param {function(string):void} onCategorySelect
 * @param {Object} embarcacionesData
 * @param {string} userRole
 */
export function setupCategoryButtons(onCategorySelect, embarcacionesData, userRole) {
    const buttons = document.querySelectorAll('[data-category]');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            triggerHapticFeedback('light');
            
            // Remove active class from all tabs
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active class to clicked tab
            button.classList.add('active');
            
            const categoria = button.dataset.category;
            
            // Smooth scroll to center the active tab
            setTimeout(() => smoothScrollToCategory(), 100);
            
            // Handle special categories
            if (categoria === 'verificar') {
                handleVerificarCategory();
            } else if (categoria === 'cambiar-categoria') {
                handleCambiarCategoriaCategory();
            } else {
                // Normal vessel categories
                onCategorySelect(categoria);
                if (embarcacionesData[categoria]) {
                    renderVessels(categoria, embarcacionesData[categoria], userRole);
                }
            }
        });
    });
}

function smoothScrollToCategory() {
    const navTabs = document.querySelector('.nav-tabs');
    const activeTab = document.querySelector('.tab-button.active');
    if (activeTab && navTabs) {
        const tabRect = activeTab.getBoundingClientRect();
        const navRect = navTabs.getBoundingClientRect();
        const scrollLeft = tabRect.left - navRect.left + navTabs.scrollLeft - (navRect.width - tabRect.width) / 2;
        navTabs.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
        });
    }
}

function handleVerificarCategory() {
    const vesselsTitle = document.getElementById('vesselsTitle');
    const vesselsContent = document.getElementById('vesselsContent');
    
    vesselsTitle.innerHTML = `<i class="fas fa-id-card"></i> Verificar Reserva`;
    vesselsContent.innerHTML = `
        <div style="padding: 20px;">
            <input type="text" id="docReserva" class="modal-input touch-target" placeholder="Ingrese número de documento">
            
            <button class="login-button touch-target" onclick="verificarReserva()" 
                    style="margin-bottom: 15px;">
                <i class="fas fa-search"></i> Buscar Reserva
            </button>
            
            <div id="resultadoReserva" style="margin-top: 15px; color: #FFD700;"></div>
        </div>
    `;
}

function handleCambiarCategoriaCategory() {
    const vesselsTitle = document.getElementById('vesselsTitle');
    const vesselsContent = document.getElementById('vesselsContent');
    
    vesselsTitle.innerHTML = `<i class="fas fa-exchange-alt"></i> Cambiar Categoría de Venta`;
    vesselsContent.innerHTML = `
        <div style="padding: 20px;">
            <input type="text" id="docVenta" class="modal-input touch-target" placeholder="Ingrese número de documento">
            
            <button class="login-button touch-target" onclick="cambiarCategoriaVenta()" 
                    style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); margin-bottom: 15px;">
                <i class="fas fa-exchange-alt"></i> Buscar Venta para Cambiar
            </button>
            
            <div id="resultadoVenta" style="margin-top: 15px; color: #FFD700;"></div>
        </div>
    `;
}