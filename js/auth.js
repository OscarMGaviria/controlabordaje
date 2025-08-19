// ===========================
// MÓDULO DE AUTENTICACIÓN
// ===========================

import { CONFIG } from './config.js';
import { Haptics, Storage, DOM } from './utils.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userRole = CONFIG.ROLES.OPERADOR;
        this.onAuthCallbacks = [];
        this.onRoleCallbacks = [];
        this.isInitialized = false;
    }

    // ===========================
    // INICIALIZACIÓN
    // ===========================
    async init() {
        if (this.isInitialized) return;

        try {
            // Escuchar cambios de autenticación
            onAuthStateChanged(window.firebaseAuth, async (user) => {
                if (user) {
                    this.currentUser = user;
                    this.userRole = await this.getUserRole(user.email);
                    Storage.set('lastUser', { email: user.email, role: this.userRole });
                    this.notifyAuthChange(true);
                } else {
                    this.currentUser = null;
                    this.userRole = CONFIG.ROLES.OPERADOR;
                    Storage.remove('lastUser');
                    this.notifyAuthChange(false);
                }
            });

            this.isInitialized = true;
        } catch (error) {
            console.error('Error inicializando auth:', error);
            throw error;
        }
    }

    // ===========================
    // LOGIN
    // ===========================
    async login(email, password) {
        try {
            Haptics.medium();
            
            const userCredential = await signInWithEmailAndPassword(
                window.firebaseAuth, 
                email.trim(), 
                password
            );

            Haptics.success();
            
            return {
                success: true,
                user: userCredential.user,
                message: CONFIG.MESSAGES.LOGIN.SUCCESS
            };

        } catch (error) {
            Haptics.error();
            
            let errorMessage = CONFIG.MESSAGES.LOGIN.ERROR;
            
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
                case 'auth/network-request-failed':
                    errorMessage = 'Error de conexión. Verifica tu internet';
                    break;
                default:
                    errorMessage = error.message;
            }

            return {
                success: false,
                error: error.code,
                message: errorMessage
            };
        }
    }

    // ===========================
    // LOGOUT
    // ===========================
    async logout() {
        try {
            await signOut(window.firebaseAuth);
            Haptics.light();
            
            return {
                success: true,
                message: 'Sesión cerrada correctamente'
            };

        } catch (error) {
            Haptics.error();
            
            return {
                success: false,
                error: error.code,
                message: 'Error al cerrar sesión'
            };
        }
    }

    // ===========================
    // ROLES DE USUARIO
    // ===========================
    async getUserRole(email) {
        try {
            const usersRef = collection(window.firebaseDB, CONFIG.FIREBASE.COLLECTIONS.USERS);
            const q = query(usersRef, where('email', '==', email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userData = querySnapshot.docs[0].data();
                return userData.rol || CONFIG.ROLES.OPERADOR;
            }

            return CONFIG.ROLES.OPERADOR;

        } catch (error) {
            console.warn('Error obteniendo rol de usuario:', error);
            return CONFIG.ROLES.OPERADOR;
        }
    }

    // ===========================
    // PERMISOS
    // ===========================
    isAdmin() {
        return this.userRole === CONFIG.ROLES.ADMIN;
    }

    isOperador() {
        return this.userRole === CONFIG.ROLES.OPERADOR;
    }

    hasPermission(action) {
        const permissions = {
            // Permisos de operador
            'change_status': true,
            'desembarcar': true,
            'zarpar': true,
            'verificar_reserva': true,
            'cambiar_categoria': true,
            
            // Permisos solo de admin
            'add_vessel': this.isAdmin(),
            'delete_vessel': this.isAdmin(),
            'edit_vessel': this.isAdmin(),
            'change_position': this.isAdmin(),
            'view_stats': this.isAdmin()
        };

        return permissions[action] || false;
    }

    // ===========================
    // CALLBACKS Y EVENTOS
    // ===========================
    onAuthChange(callback) {
        this.onAuthCallbacks.push(callback);
    }

    onRoleChange(callback) {
        this.onRoleCallbacks.push(callback);
    }

    notifyAuthChange(isAuthenticated) {
        this.onAuthCallbacks.forEach(callback => {
            try {
                callback(isAuthenticated, this.currentUser, this.userRole);
            } catch (error) {
                console.error('Error en callback de auth:', error);
            }
        });
    }

    notifyRoleChange(newRole) {
        this.onRoleCallbacks.forEach(callback => {
            try {
                callback(newRole);
            } catch (error) {
                console.error('Error en callback de role:', error);
            }
        });
    }

    // ===========================
    // UTILIDADES
    // ===========================
    isAuthenticated() {
        return !!this.currentUser;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getCurrentRole() {
        return this.userRole;
    }

    getUserEmail() {
        return this.currentUser?.email || '';
    }

    getUserDisplayName() {
        const email = this.getUserEmail();
        return email.split('@')[0];
    }

    // ===========================
    // INTERFAZ DE LOGIN CORREGIDA
    // ===========================
    renderLoginForm() {
        return `
            <div class="login-container">
                <div class="login-form">
                    <div class="login-header">
                        <div class="login-logo">
                            <i class="fas fa-cogs"></i>
                            <i class="fas fa-ship"></i>
                        </div>
                        <h2>Admin Embarcaciones</h2>
                        <p>Ingresa tus credenciales</p>
                    </div>
                    
                    <form id="loginForm" class="login-form-content">
                        <div class="form-group">
                            <label class="form-label" for="loginEmail">
                                <i class="fas fa-envelope"></i>
                                Email
                            </label>
                            <div class="input-container">
                                <input 
                                    type="email" 
                                    id="loginEmail" 
                                    class="form-input touch-target"
                                    placeholder="correo@ejemplo.com"
                                    required
                                    autocomplete="email"
                                >
                                <div class="input-focus-border"></div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="loginPassword">
                                <i class="fas fa-lock"></i>
                                Contraseña
                            </label>
                            <div class="input-container">
                                <input 
                                    type="password" 
                                    id="loginPassword" 
                                    class="form-input touch-target"
                                    placeholder="••••••••"
                                    required
                                    autocomplete="current-password"
                                >
                                <button type="button" class="password-toggle" id="passwordToggle">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <div class="input-focus-border"></div>
                            </div>
                        </div>
                        
                        <button 
                            type="submit" 
                            id="loginBtn"
                            class="login-submit touch-target"
                        >
                            <i class="fas fa-sign-in-alt"></i>
                            Iniciar Sesión
                        </button>
                    </form>
                    
                    <div id="loginError" class="alert error" style="display: none;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span id="loginErrorText"></span>
                    </div>
                    
                    <div id="loginLoading" class="loading-login" style="display: none;">
                        <div class="spinner"></div>
                        <span>Autenticando...</span>
                    </div>
                    
                    <div class="login-footer">
                        <div class="login-info">
                            <i class="fas fa-info-circle"></i>
                            Muelle Único Guatapé - Malecón San Juan del Puerto
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupLoginForm() {
        const form = DOM.find('#loginForm');
        const emailInput = DOM.find('#loginEmail');
        const passwordInput = DOM.find('#loginPassword');
        const passwordToggle = DOM.find('#passwordToggle');
        const loginBtn = DOM.find('#loginBtn');
        const errorDiv = DOM.find('#loginError');
        const loadingDiv = DOM.find('#loginLoading');

        if (!form) return;

        // Autocompletar último email
        const lastUser = Storage.get('lastUser');
        if (lastUser?.email) {
            emailInput.value = lastUser.email;
            passwordInput.focus();
        } else {
            emailInput.focus();
        }

        // Toggle password visibility
        if (passwordToggle && passwordInput) {
            passwordToggle.addEventListener('click', () => {
                const icon = passwordToggle.querySelector('i');
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.className = 'fas fa-eye-slash';
                } else {
                    passwordInput.type = 'password';
                    icon.className = 'fas fa-eye';
                }
            });
        }

        // Manejar envío del formulario
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (!email || !password) {
                this.showLoginError('Complete todos los campos');
                return;
            }

            this.showLoginLoading(true);
            
            const result = await this.login(email, password);
            
            this.showLoginLoading(false);
            
            if (!result.success) {
                this.showLoginError(result.message);
            }
        });

        // Limpiar errores al escribir
        [emailInput, passwordInput].forEach(input => {
            input.addEventListener('input', () => {
                this.hideLoginError();
            });
        });

        // Enter key navigation
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                passwordInput.focus();
            }
        });
    }

    showLoginError(message) {
        const errorDiv = DOM.find('#loginError');
        const errorText = DOM.find('#loginErrorText');
        
        if (errorDiv && errorText) {
            errorText.textContent = message;
            errorDiv.style.display = 'block';
            Haptics.error();
        }
    }

    hideLoginError() {
        const errorDiv = DOM.find('#loginError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    showLoginLoading(show) {
        const loadingDiv = DOM.find('#loginLoading');
        const loginBtn = DOM.find('#loginBtn');
        
        if (loadingDiv) {
            loadingDiv.style.display = show ? 'flex' : 'none';
        }
        
        if (loginBtn) {
            loginBtn.disabled = show;
            loginBtn.innerHTML = show 
                ? '<div class="spinner"></div> Autenticando...'
                : '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
        }
    }
}

// ===========================
// INSTANCIA GLOBAL
// ===========================
const authManager = new AuthManager();

// Exportar para uso en otros módulos
export default authManager;

// Hacer disponible globalmente
window.Auth = authManager;