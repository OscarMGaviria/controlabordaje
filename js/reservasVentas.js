import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { triggerHapticFeedback } from './utils/haptics.js';

// ===========================
// VERIFICACIÓN DE RESERVAS
// ===========================
export async function verificarReserva() {
    const docInput = document.getElementById('docReserva');
    const resultado = document.getElementById('resultadoReserva');
    const docValue = docInput.value.trim();

    resultado.innerHTML = '';
    if (!docValue || isNaN(docValue)) {
        resultado.innerHTML = `
            <div class="warning-message">
                <i class="fas fa-exclamation-triangle"></i> Ingrese un número de documento válido.
            </div>`;
        return;
    }

    try {
        const ahora = new Date();
        const inicioDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
        const finDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);

        const reservasRef = collection(db, "Reservas");
        const q = query(
            reservasRef,
            where("DOCUMENTO", "==", Number(docValue)),
            where("fecha_hora_salida", ">=", inicioDelDia),
            where("fecha_hora_salida", "<=", finDelDia)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            resultado.innerHTML = `
                <div class="warning-message">
                    <i class="fas fa-times-circle"></i> No se encontró una reserva para hoy con este documento.
                </div>`;
            return;
        }

        const reserva = querySnapshot.docs[0];
        const data = reserva.data();

        let contenido = `
            <div class="summary-section">
                <div class="summary-title"><i class="fas fa-clipboard-check"></i> Reserva Encontrada</div>
                <div class="summary-item"><span><i class="fas fa-user"></i> Nombre:</span><strong>${data.NOMBRE}</strong></div>
                <div class="summary-item"><span><i class="fas fa-ship"></i> Embarcación:</span><strong>${data.EMPRESA}</strong></div>
                <div class="summary-item"><span><i class="fas fa-users"></i> Pasajeros:</span><strong>${data.PASAJEROS}</strong></div>
                <div class="summary-item"><span><i class="fas fa-clock"></i> Salida:</span><strong>${data.fecha_hora_salida.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
            </div>
        `;

        if (data.usado === true) {
            contenido += `
                <div class="warning-message">
                    <i class="fas fa-ban"></i> Esta reserva <strong>ya fue usada</strong>.
                </div>`;
        } else {
            contenido += `
                <button class="login-button touch-target" onclick="actualizarEstadoReserva('${reserva.id}')">
                    <i class="fas fa-check-circle"></i> Usar Reserva
                </button>`;
        }

        resultado.innerHTML = contenido;
    } catch (error) {
        resultado.innerHTML = `
            <div class="warning-message">
                <i class="fas fa-exclamation-circle"></i> Ocurrió un error al consultar la reserva. Intente nuevamente.
            </div>`;
    }
}

export async function actualizarEstadoReserva(reservaId) {
    const resultado = document.getElementById('resultadoReserva');

    try {
        const reservaRef = doc(db, "Reservas", reservaId);
        await updateDoc(reservaRef, { usado: true });

        resultado.innerHTML = `
            <div class="warning-message">
                <i class="fas fa-check-circle"></i> La reserva fue marcada como <strong>usada</strong> correctamente.
            </div>`;

        // Recargar detalles para actualizar la vista
        setTimeout(() => verificarReserva(), 1000);
    } catch (error) {
        resultado.innerHTML = `
            <div class="warning-message">
                <i class="fas fa-exclamation-circle"></i> No se pudo marcar la reserva como usada. Intente nuevamente.
            </div>`;
    }
}

// ===========================
// CAMBIO DE CATEGORÍA DE VENTAS
// ===========================
export async function cambiarCategoriaVenta() {
    const docInput = document.getElementById('docVenta');
    const resultado = document.getElementById('resultadoVenta');
    const docValue = docInput.value.trim();

    if (!docValue || isNaN(docValue)) {
        resultado.innerHTML = `
            <div class="warning-message">
                <i class="fas fa-exclamation-triangle"></i> Ingrese un número de documento válido.
            </div>`;
        return;
    }

    try {
        // Obtener fecha actual en formato YYYY-MM-DD
        const hoy = new Date();
        const fechaHoy = hoy.getFullYear() + '-' + 
                    String(hoy.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(hoy.getDate()).padStart(2, '0');

        const ventasRef = collection(db, "ventas");
        const q = query(
            ventasRef, 
            where("documento", "==", docValue),
            where("fecha", "==", fechaHoy) // Solo ventas de hoy
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // Verificar si existe una venta con ese documento pero de otro día
            const qGeneral = query(ventasRef, where("documento", "==", docValue));
            const generalSnapshot = await getDocs(qGeneral);
            
            if (!generalSnapshot.empty) {
                const ventaAnterior = generalSnapshot.docs[0].data();
                resultado.innerHTML = `
                    <div class="warning-message">
                        <i class="fas fa-calendar-times"></i> Se encontró una venta con este documento, pero es de una fecha anterior (${ventaAnterior.fecha}).
                        <br><br>
                        <strong>Solo se pueden cambiar categorías de ventas realizadas hoy (${fechaHoy}).</strong>
                    </div>`;
            } else {
                resultado.innerHTML = `
                    <div class="warning-message">
                        <i class="fas fa-times-circle"></i> No se encontró una venta con este documento para el día de hoy (${fechaHoy}).
                    </div>`;
            }
            return;
        }

        const venta = querySnapshot.docs[0];
        const data = venta.data();

        // SOLO OCULTAR elementos SI HAY RESULTADOS EXITOSOS DE HOY
        docInput.style.display = 'none';
        docInput.nextElementSibling.style.display = 'none'; // El botón de buscar

        const categorias = ['Lancha Taxi', 'Deportiva', 'Planchón', 'Carguero', 'Barco', 'Yate'];
        let opcionesCategorias = '';
        
        categorias.forEach(categoria => {
            const selected = categoria === data.embarcacion ? 'selected' : '';
            opcionesCategorias += `<option value="${categoria}" ${selected}>${categoria}</option>`;
        });

        // Calcular precio actualizado
        const precioActualizado = calcularNuevoPrecio(data.adultos, data.ninos, data.embarcacion);

        resultado.innerHTML = `
            <div class="summary-section">
                <div class="summary-title"><i class="fas fa-ship"></i> Venta de Hoy Encontrada</div>
                <div class="summary-item"><span><i class="fas fa-user"></i> Nombre:</span><strong>${data.nombre}</strong></div>
                <div class="summary-item"><span><i class="fas fa-id-card"></i> Documento:</span><strong>${data.documento}</strong></div>
                <div class="summary-item"><span><i class="fas fa-calendar-check"></i> Fecha:</span><strong>${data.fecha} ✅</strong></div>
                <div class="summary-item"><span><i class="fas fa-users"></i> Adultos:</span><strong>${data.adultos}</strong></div>
                <div class="summary-item"><span><i class="fas fa-child"></i> Niños:</span><strong>${data.ninos}</strong></div>
                <div class="summary-item"><span><i class="fas fa-users"></i> Total Pasajeros:</span><strong>${data.adultos + data.ninos} (${data.adultos} adultos, ${data.ninos} niños)</strong></div>
                <div class="summary-item"><span><i class="fas fa-dollar-sign"></i> Precio Original:</span><strong>$${data.precio.toLocaleString('es-CO')}</strong></div>
                <div class="summary-item"><span><i class="fas fa-ship"></i> Categoría Actual:</span><strong>${data.embarcacion}</strong></div>
            </div>
            
            <div class="input-group" style="margin-top: 15px;">
                <label class="input-label" for="nuevaCategoria">
                    <i class="fas fa-exchange-alt"></i> Nueva Categoría
                </label>
                <select id="nuevaCategoria" class="modal-input touch-target select-categoria" onchange="actualizarPrecioPreview('${data.adultos}', '${data.ninos}', '${data.precio}')">
                    ${opcionesCategorias}
                </select>
            </div>
            
            <div class="summary-section" id="precioPreview" style="margin-top: 15px; background: rgba(255, 193, 7, 0.2); border-color: rgba(255, 193, 7, 0.5);">
                <div class="summary-title"><i class="fas fa-calculator"></i> Precio con Nueva Categoría</div>
                <div class="summary-item"><span><i class="fas fa-arrow-right"></i> Precio Actualizado:</span><strong id="nuevoPrecioDisplay">$${precioActualizado.toLocaleString('es-CO')}</strong></div>
                <div class="summary-item"><span><i class="fas fa-chart-line"></i> Diferencia:</span><strong id="diferenciaPrecio" style="color: ${precioActualizado > data.precio ? '#ff6b6b' : '#32CD32'}">${precioActualizado > data.precio ? '+' : ''}$${(precioActualizado - data.precio).toLocaleString('es-CO')}</strong></div>
            </div>
            
            <div class="warning-message" style="background: rgba(0, 123, 255, 0.2); border-color: rgba(0, 123, 255, 0.5); color: #007bff;">
                <i class="fas fa-info-circle"></i> Solo se pueden modificar ventas del día actual (${fechaHoy})
            </div>
            
            <button class="login-button touch-target" onclick="confirmarCambioCategoria('${venta.id}', '${data.embarcacion}', ${data.adultos}, ${data.ninos}, ${data.precio})" 
                    style="margin-top: 15px;">
                <i class="fas fa-check-circle"></i> Cambiar Categoría y Actualizar Precio
            </button>
            
            <button class="login-button touch-target" onclick="volverBusqueda()" 
                    style="margin-top: 10px; background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);">
                <i class="fas fa-search"></i> Buscar Otra Venta
            </button>
        `;

    } catch (error) {
        resultado.innerHTML = `
            <div class="warning-message">
                <i class="fas fa-exclamation-circle"></i> Ocurrió un error al consultar la venta. Intente nuevamente.
            </div>`;
    }
}

// Función para calcular nuevo precio
export function calcularNuevoPrecio(adultos, ninos, categoria) {
    const totalPersonas = adultos;
    let total = 0;
    
    // Mapear categorías a códigos
    const categoriaMap = {
        'Lancha Taxi': 'lancha',
        'Deportiva': 'deportiva', 
        'Planchón': 'planchon',
        'Carguero': 'carguero',
        'Barco': 'barco',
        'Yate': 'yate'
    };
    
    const selectedVessel = categoriaMap[categoria];
    
    // Calcular según tipo de embarcación
    switch (selectedVessel) {
        case 'lancha': // Lancha Taxi
            total = totalPersonas * 30000;
            break;
            
        case 'deportiva': // Lanchas Deportivas
            if (totalPersonas <= 4) {
                total = 250000;
            } else if (totalPersonas <= 6) {
                total = 300000;
            } else {
                total = totalPersonas * 50000;
            }
            break;
            
        case 'planchon': // Planchones
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
            
        case 'barco': // Barcos
            if (totalPersonas <= 19) {
                total = totalPersonas * 30000;
            } else if (totalPersonas <= 30) {
                total = totalPersonas * 25000;
            } else {
                total = totalPersonas * 20000;
            }
            break;
            
        case 'yate': // Yates
            if (totalPersonas <= 10) {
                total = 400000;
            } else {
                total = totalPersonas * 30000;
            }
            break;
            
        case 'carguero': // Carguero
            total = Math.ceil(totalPersonas / 5) * 200000;
            break;
            
        default:
            total = 0;
    }
    
    return total;
}

// Función para actualizar preview del precio
export function actualizarPrecioPreview(adultos, ninos, precioOriginal) {
    const nuevaCategoria = document.getElementById('nuevaCategoria').value;
    const nuevoPrecio = calcularNuevoPrecio(parseInt(adultos), parseInt(ninos), nuevaCategoria);
    
    document.getElementById('nuevoPrecioDisplay').textContent = `$${nuevoPrecio.toLocaleString('es-CO')}`;
    
    // Actualizar diferencia
    const diferencia = nuevoPrecio - parseInt(precioOriginal);
    const diferenciaPrecio = document.getElementById('diferenciaPrecio');
    
    diferenciaPrecio.textContent = `${diferencia > 0 ? '+' : ''}$${diferencia.toLocaleString('es-CO')}`;
    diferenciaPrecio.style.color = diferencia > 0 ? '#ff6b6b' : '#32CD32';
}

// Función para volver a la búsqueda
export function volverBusqueda() {
    // Obtener el contenedor principal
    const vesselsContent = document.getElementById('vesselsContent');
    
    if (vesselsContent) {
        // Recrear toda la interfaz de cambio de categoría
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
        
        // Focus en el input
        setTimeout(() => {
            const newInput = document.getElementById('docVenta');
            if (newInput) {
                newInput.focus();
            }
        }, 100);
    }
}

export async function confirmarCambioCategoria(ventaId, categoriaActual, adultos, ninos, precioOriginal) {
    const nuevaCategoria = document.getElementById('nuevaCategoria').value;
    const resultado = document.getElementById('resultadoVenta');

    if (nuevaCategoria === categoriaActual) {
        resultado.innerHTML += `
            <div class="warning-message" style="margin-top: 10px;">
                <i class="fas fa-info-circle"></i> La categoría seleccionada es la misma que la actual.
            </div>`;
        return;
    }

    const nuevoPrecio = calcularNuevoPrecio(adultos, ninos, nuevaCategoria);
    const diferencia = nuevoPrecio - precioOriginal;

    try {
        const ventaRef = doc(db, "ventas", ventaId);
        await updateDoc(ventaRef, { 
            embarcacion: nuevaCategoria,
            precio: nuevoPrecio,
            fechaActualizacion: new Date(),
            precioAnterior: precioOriginal,
            categoriaAnterior: categoriaActual
        });

        resultado.innerHTML = `
            <div class="summary-section">
                <div class="summary-title"><i class="fas fa-check-circle"></i> Categoría y Precio Actualizados</div>
                <div class="summary-item"><span><i class="fas fa-ship"></i> Categoría:</span><strong>${categoriaActual} → ${nuevaCategoria}</strong></div>
                <div class="summary-item"><span><i class="fas fa-dollar-sign"></i> Precio:</span><strong>$${precioOriginal.toLocaleString('es-CO')} → $${nuevoPrecio.toLocaleString('es-CO')}</strong></div>
                <div class="summary-item"><span><i class="fas fa-chart-line"></i> Diferencia:</span><strong style="color: ${diferencia > 0 ? '#ff6b6b' : '#32CD32'}">${diferencia > 0 ? '+' : ''}$${diferencia.toLocaleString('es-CO')}</strong></div>
            </div>
            
            <button class="login-button touch-target" onclick="volverBusqueda()" 
                    style="margin-top: 15px; background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);">
                <i class="fas fa-search"></i> Buscar Otra Venta
            </button>`;

        triggerHapticFeedback('success');

    } catch (error) {
        resultado.innerHTML += `
            <div class="warning-message" style="margin-top: 10px;">
                <i class="fas fa-exclamation-circle"></i> No se pudo actualizar. Intente nuevamente.
            </div>`;
        
        triggerHapticFeedback('error');
    }
}