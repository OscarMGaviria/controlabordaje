import { login, logout } from './auth.js';
import { getUserRole } from './roles.js';
import { setupCategoryButtons } from './turnoNautico.js';
import { listenToEmbarcaciones, stopListener } from './listeners.js';
import { renderVessels, setupVesselActions, renderSpecialCategory, showVesselUpdate } from './embarcaciones.js';
import { showError, hideError, showLoading, hideLoading } from './ui.js';
import { 
    openZarparModal, 
    closeZarparModal, 
    updateSummary, 
    openStatusModal, 
    closeStatusModal,
    openPositionModal,
    closePositionModal,
    initializeModals
} from './modals.js';
import { 
    verificarReserva, 
    actualizarEstadoReserva, 
    cambiarCategoriaVenta, 
    confirmarCambioCategoria,
    actualizarPrecioPreview,
    volverBusqueda
} from './reservasVentas.js';
import { showWhatsAppShareModal, isWhatsAppAvailable } from './whatsappShare.js';
import { showPDFOptionsModal, isPDFSupported } from './pdfTicket.js';
import { triggerHapticFeedback } from './utils/haptics.js';
import { auth } from './firebaseConfig.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ===========================
// ESTADO GLOBAL
// ===========================
let currentUser = null;
let currentRole = 'operador';
let activeCategory = null;
let embarcacionesData = {};
let deferredPrompt = null;

// ===========================
// REFERENCIAS DOM
// ===========================
const loginContainer = document.getElementById('loginContainer');
const adminContainer = document.getElementById('adminContainer');
const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const loading = document.getElementById('loading');
const loginError = document.getElementById('loginError');
const vesselsTitle = document.getElementById('vesselsTitle');
const vesselsContent = document.getElementById('vesselsContent');
const hapticFeedback = document.getElementById('hapticFeedback');
const pwaInstall = document.getElementById('pwaInstall');

// ===========================
// PWA FUNCTIONALITY
// ===========================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    pwaInstall.style.display = 'block';
});

pwaInstall?.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            pwaInstall.style.display = 'none';
        }
        deferredPrompt = null;
    }
});

window.addEventListener('appinstalled', () => {
    pwaInstall.style.display = 'none';
});

// ===========================
// FUNCIONES DE UI
// ===========================
function updateHeaderWithRole() {
    const headerText = document.querySelector('.header-text');
    if (headerText) {
        const roleIcon = currentRole === 'admin' ? '🔐' : '👤';
        const roleText = currentRole === 'admin' ? 'Administrador' : 'Operador';
        headerText.innerHTML = `Admin Embarcaciones <span style="font-size: 12px; opacity: 0.8;">${roleIcon} ${roleText}</span>`;
    }
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

// ===========================
// MANEJO DE AUTENTICACIÓN
// ===========================
async function handleLogin(email, password) {
    try {
        showLoading();
        hideError();
        
        const { success, user, error } = await login(email, password);
        
        if (success) {
            currentUser = user;
            currentRole = await getUserRole(user.email);
            
            updateHeaderWithRole();
            
            loginContainer.style.display = 'none';
            adminContainer.style.display = 'flex';
            
            // Configurar listeners de Firebase
            setupFirebaseListener();
            
            triggerHapticFeedback('success');
            
            // Disparar evento de éxito
            window.dispatchEvent(new CustomEvent('showSuccess', {
                detail: {
                    title: '✅ Sesión Iniciada',
                    message: `Bienvenido ${currentRole === 'admin' ? 'Administrador' : 'Operador'}: ${user.email}`,
                    duration: 4000
                }
            }));
            
        } else {
            let errorMessage = 'Error al iniciar sesión';
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Usuario no encontrado';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Contraseña incorrecta';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Demasiados intentos. Intenta más tarde';
                    break;
                default:
                    errorMessage = 'Error: ' + error.message;
            }
            showError(errorMessage);
            triggerHapticFeedback('error');
        }
    } catch (error) {
        showError('Error inesperado al iniciar sesión');
        triggerHapticFeedback('error');
    } finally {
        hideLoading();
    }
}

async function handleLogout() {
    try {
        stopListener();
        await logout();
        
        currentUser = null;
        currentRole = 'operador';
        activeCategory = null;
        embarcacionesData = {};
        
        loginContainer.style.display = 'flex';
        adminContainer.style.display = 'none';
        
        // Reset form
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
        hideError();
        hideLoading();
        
        // Reset state
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        vesselsTitle.innerHTML = '<i class="fas fa-hand-point-up"></i> Selecciona una categoría';
        vesselsContent.innerHTML = `
            <div class="no-selection">
                <i class="fas fa-ship"></i> Toca una categoría arriba para ver las embarcaciones disponibles
                <br><br>
                <i class="fas fa-mobile-alt"></i> Optimizado para móvil
            </div>
        `;
        
        // Cerrar modales si están abiertos
        closeZarparModal();
        closeStatusModal();
        closePositionModal();
        
        triggerHapticFeedback('medium');
        
    } catch (error) {
        triggerHapticFeedback('error');
    }
}

// ===========================
// SETUP DE FIREBASE LISTENER
// ===========================
function setupFirebaseListener() {
    listenToEmbarcaciones(
        (data) => {
            embarcacionesData = data;
            
            // Actualizar modales con nuevos datos
            initializeModals(embarcacionesData, activeCategory, currentRole);
            
            // Actualizar vista si hay categoría activa
            if (activeCategory && embarcacionesData[activeCategory]) {
                renderVessels(activeCategory, embarcacionesData[activeCategory], currentRole);
                
                // Reconfigurar acciones de embarcaciones
                setupVesselActions(embarcacionesData, activeCategory, currentRole);
            }
        },
        (error) => {
            triggerHapticFeedback('error');
            window.dispatchEvent(new CustomEvent('showError', {
                detail: {
                    title: '❌ Error de Conexión',
                    message: 'No se pudo conectar con la base de datos.',
                    duration: 6000
                }
            }));
        }
    );
}

// ===========================
// MANEJO DE CATEGORÍAS
// ===========================
function handleCategorySelection(categoria) {
    activeCategory = categoria;
    
    // Actualizar modales con nueva categoría
    initializeModals(embarcacionesData, activeCategory, currentRole);
    
    // Smooth scroll to center the active tab
    setTimeout(smoothScrollToCategory, 100);
    
    if (categoria === 'verificar' || categoria === 'cambiar-categoria') {
        renderSpecialCategory(categoria);
    } else {
        // Normal vessel categories
        if (embarcacionesData[categoria]) {
            renderVessels(categoria, embarcacionesData[categoria], currentRole);
            
            // Setup vessel actions
            setupVesselActions(embarcacionesData, activeCategory, currentRole);
        }
    }
}

// ===========================
// EVENT LISTENERS
// ===========================
function setupEventListeners() {
    // Login form
    loginForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        handleLogin(email, password);
    });

    // Logout button
    logoutButton?.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            handleLogout();
        }
    });

    // Category buttons
    setupCategoryButtons(handleCategorySelection, embarcacionesData, currentRole);

    // Custom events para modales
    window.addEventListener('openStatusModal', (e) => {
        const { vesselId, vesselData } = e.detail;
        openStatusModal(vesselId, vesselData);
    });

    window.addEventListener('openZarparModal', (e) => {
        const { vesselId, vesselData } = e.detail;
        openZarparModal(vesselId, vesselData);
    });

    window.addEventListener('openPositionModal', (e) => {
        const { vesselId, vesselData } = e.detail;
        openPositionModal(vesselId, vesselData);
    });

    // Custom events para reservas y ventas
    window.addEventListener('verificarReserva', () => {
        verificarReserva();
    });

    window.addEventListener('cambiarCategoriaVenta', () => {
        cambiarCategoriaVenta();
    });

    // **NUEVO: Custom event para WhatsApp**
    window.addEventListener('shareWhatsApp', (e) => {
        const { zarpeData } = e.detail;
        if (isWhatsAppAvailable()) {
            showWhatsAppShareModal(zarpeData);
        } else {
            window.dispatchEvent(new CustomEvent('showError', {
                detail: {
                    title: '❌ WhatsApp No Disponible',
                    message: 'WhatsApp no está disponible en este dispositivo.',
                    duration: 4000
                }
            }));
        }
    });

    // **NUEVO: Custom event para PDF**
    window.addEventListener('showPDFModal', (e) => {
        const { zarpeData } = e.detail;
        if (isPDFSupported()) {
            showPDFOptionsModal(zarpeData);
        } else {
            window.dispatchEvent(new CustomEvent('showError', {
                detail: {
                    title: '❌ PDF No Compatible',
                    message: 'Tu navegador no soporta la generación de PDFs.',
                    duration: 4000
                }
            }));
        }
    });

    // Custom events para alertas (si existe el sistema de alertas)
    window.addEventListener('showSuccess', (e) => {
        const { title, message, duration } = e.detail;
        if (typeof showSuccess === 'function') {
            showSuccess(title, message, duration);
        }
    });

    window.addEventListener('showError', (e) => {
        const { title, message, duration } = e.detail;
        if (typeof showError === 'function') {
            showError(title, message, duration);
        }
    });

    window.addEventListener('showWarning', (e) => {
        const { title, message, duration } = e.detail;
        if (typeof showWarning === 'function') {
            showWarning(title, message, duration);
        }
    });

    // Network status
    window.addEventListener('online', () => {
        triggerHapticFeedback('success');
        window.dispatchEvent(new CustomEvent('showSuccess', {
            detail: {
                title: '🌐 Conexión Restaurada',
                message: 'La aplicación está nuevamente en línea',
                duration: 3000
            }
        }));
    });

    window.addEventListener('offline', () => {
        triggerHapticFeedback('error');
        window.dispatchEvent(new CustomEvent('showWarning', {
            detail: {
                title: '📶 Sin Conexión',
                message: 'Verifica tu conexión a internet. Algunas funciones pueden no estar disponibles.',
                duration: 5000
            }
        }));
    });

    // Auto-logout en recarga
    window.addEventListener('beforeunload', () => {
        if (auth?.currentUser) {
            logout();
        }
    });

    window.addEventListener('load', () => {
        if (auth?.currentUser) {
            logout();
        }
    });

    // Prevent zoom on input focus (iOS)
    document.addEventListener('touchstart', function() {}, {passive: true});
    
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            smoothScrollToCategory();
        }, 100);
    });
    
    // Prevent pull-to-refresh
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
    }, {passive: false});
    
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
    }, {passive: false});
}

// ===========================
// OBSERVER DE AUTENTICACIÓN
// ===========================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        currentRole = await getUserRole(user.email);
        
        updateHeaderWithRole();
        
        loginContainer.style.display = 'none';
        adminContainer.style.display = 'flex';
        setupFirebaseListener();
        
        triggerHapticFeedback('success');
        
    } else {
        stopListener();
        currentUser = null;
        currentRole = 'operador';
        loginContainer.style.display = 'flex';
        adminContainer.style.display = 'none';
        
        // Reset form
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
        hideError();
        hideLoading();
        
        // Reset state
        activeCategory = null;
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        vesselsTitle.innerHTML = '<i class="fas fa-hand-point-up"></i> Selecciona una categoría';
        vesselsContent.innerHTML = `
            <div class="no-selection">
                <i class="fas fa-ship"></i> Toca una categoría arriba para ver las embarcaciones disponibles
                <br><br>
                <i class="fas fa-mobile-alt"></i> Optimizado para móvil
            </div>
        `;
        
        // Cerrar modales si están abiertos
        closeZarparModal();
        closeStatusModal();
        closePositionModal();
    }
});

// ===========================
// INICIALIZACIÓN
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    // iOS Safari viewport fix
    const setViewportHeight = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
    
    // Setup event listeners
    setupEventListeners();
    
    // Service Worker registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                // Service worker registered successfully
            })
            .catch((registrationError) => {
                // Service worker registration failed
            });
    }
});

// ===========================
// FUNCIONES GLOBALES PARA HTML
// ===========================
// Exponer funciones necesarias para el HTML
window.verificarReserva = verificarReserva;
window.actualizarEstadoReserva = actualizarEstadoReserva;
window.cambiarCategoriaVenta = cambiarCategoriaVenta;
window.confirmarCambioCategoria = confirmarCambioCategoria;
window.actualizarPrecioPreview = actualizarPrecioPreview;
window.volverBusqueda = volverBusqueda;

// **NUEVAS FUNCIONES GLOBALES PARA WHATSAPP**
window.showWhatsAppShareModal = showWhatsAppShareModal;
window.isWhatsAppAvailable = isWhatsAppAvailable;
// **NUEVAS FUNCIONES GLOBALES PARA PDF**
window.showPDFOptionsModal = showPDFOptionsModal;
window.isPDFSupported = isPDFSupported;