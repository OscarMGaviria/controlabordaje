// ===========================
// MÓDULO DE UTILIDADES
// ===========================

import { CONFIG, DEVICE } from './config.js';

// ===========================
// HAPTIC FEEDBACK
// ===========================
export const Haptics = {
    light() {
        if (DEVICE.supportsVibration()) {
            navigator.vibrate(10);
        }
    },

    medium() {
        if (DEVICE.supportsVibration()) {
            navigator.vibrate(50);
        }
    },

    heavy() {
        if (DEVICE.supportsVibration()) {
            navigator.vibrate([100, 50, 100]);
        }
    },

    success() {
        if (DEVICE.supportsVibration()) {
            navigator.vibrate([50, 25, 50]);
        }
    },

    error() {
        if (DEVICE.supportsVibration()) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }
    }
};

// ===========================
// FORMATEO DE DATOS
// ===========================
export const Format = {
    currency(amount) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },

    number(num) {
        return new Intl.NumberFormat('es-CO').format(num);
    },

    date(date) {
        return new Intl.DateTimeFormat('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(new Date(date));
    },

    time(date) {
        return new Intl.DateTimeFormat('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(new Date(date));
    },

    phone(phone) {
        // Formatear número telefónico colombiano
        let clean = phone.replace(/\D/g, '');
        
        if (clean.startsWith('57') && clean.length > 10) {
            clean = '+' + clean;
        } else if (clean.length === 10 && !clean.startsWith('+')) {
            clean = '+57' + clean;
        }
        
        return clean;
    }
};

// ===========================
// VALIDACIONES
// ===========================
export const Validate = {
    email(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    phone(phone) {
        const clean = phone.replace(/\D/g, '');
        return clean.length >= 10 && clean.length <= 15;
    },

    required(value) {
        return value !== null && value !== undefined && value.toString().trim() !== '';
    },

    number(value, min = 0, max = Infinity) {
        const num = parseFloat(value);
        return !isNaN(num) && num >= min && num <= max;
    },

    passengers(count) {
        return this.number(count, CONFIG.VALIDATIONS?.MIN_PASSENGERS || 1, CONFIG.VALIDATIONS?.MAX_PASSENGERS || 50);
    },

    price(amount) {
        return this.number(amount, CONFIG.VALIDATIONS?.MIN_PRICE || 1000, CONFIG.VALIDATIONS?.MAX_PRICE || 10000000);
    }
};

// ===========================
// MANIPULACIÓN DOM
// ===========================
export const DOM = {
    create(tag, className = '', innerHTML = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    },

    find(selector) {
        return document.querySelector(selector);
    },

    findAll(selector) {
        return document.querySelectorAll(selector);
    },

    remove(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    },

    addClass(element, className) {
        if (element) element.classList.add(className);
    },

    removeClass(element, className) {
        if (element) element.classList.remove(className);
    },

    toggleClass(element, className) {
        if (element) element.classList.toggle(className);
    },

    show(element) {
        if (element) element.style.display = 'block';
    },

    hide(element) {
        if (element) element.style.display = 'none';
    }
};

// ===========================
// ANIMACIONES
// ===========================
export const Animate = {
    fadeIn(element, duration = CONFIG.UI.ANIMATION_DURATION) {
        if (!element) return;
        
        element.style.opacity = '0';
        element.style.display = 'block';
        
        const start = performance.now();
        
        function frame(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = progress;
            
            if (progress < 1) {
                requestAnimationFrame(frame);
            }
        }
        
        requestAnimationFrame(frame);
    },

    fadeOut(element, duration = CONFIG.UI.ANIMATION_DURATION) {
        if (!element) return;
        
        const start = performance.now();
        const initialOpacity = parseFloat(getComputedStyle(element).opacity) || 1;
        
        function frame(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = initialOpacity * (1 - progress);
            
            if (progress >= 1) {
                element.style.display = 'none';
            } else {
                requestAnimationFrame(frame);
            }
        }
        
        requestAnimationFrame(frame);
    },

    slideIn(element, direction = 'right', duration = CONFIG.UI.ANIMATION_DURATION) {
        if (!element) return;
        
        const translations = {
            right: 'translateX(100%)',
            left: 'translateX(-100%)',
            up: 'translateY(-100%)',
            down: 'translateY(100%)'
        };
        
        element.style.transform = translations[direction];
        element.style.opacity = '0';
        element.style.display = 'block';
        
        requestAnimationFrame(() => {
            element.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`;
            element.style.transform = 'translate(0)';
            element.style.opacity = '1';
        });
    },

    slideOut(element, direction = 'right', duration = CONFIG.UI.ANIMATION_DURATION) {
        if (!element) return;
        
        const translations = {
            right: 'translateX(100%)',
            left: 'translateX(-100%)',
            up: 'translateY(-100%)',
            down: 'translateY(100%)'
        };
        
        element.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`;
        element.style.transform = translations[direction];
        element.style.opacity = '0';
        
        setTimeout(() => {
            element.style.display = 'none';
        }, duration);
    }
};

// ===========================
// ALMACENAMIENTO LOCAL
// ===========================
export const Storage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('Error guardando en localStorage:', error);
            return false;
        }
    },

    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn('Error leyendo localStorage:', error);
            return defaultValue;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('Error eliminando de localStorage:', error);
            return false;
        }
    },

    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.warn('Error limpiando localStorage:', error);
            return false;
        }
    }
};

// ===========================
// UTILIDADES DE TIEMPO
// ===========================
export const Time = {
    now() {
        return new Date();
    },

    startOfDay(date = new Date()) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        return start;
    },

    endOfDay(date = new Date()) {
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        return end;
    },

    addMinutes(date, minutes) {
        return new Date(date.getTime() + minutes * 60000);
    },

    diffMinutes(date1, date2) {
        return Math.floor((date2 - date1) / 60000);
    },

    isToday(date) {
        const today = new Date();
        const compareDate = new Date(date);
        return today.toDateString() === compareDate.toDateString();
    }
};

// ===========================
// GENERADORES DE ID
// ===========================
export const ID = {
    generate() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};

// ===========================
// UTILIDADES DE RED
// ===========================
export const Network = {
    isOnline() {
        return navigator.onLine;
    },

    onOnline(callback) {
        window.addEventListener('online', callback);
    },

    onOffline(callback) {
        window.addEventListener('offline', callback);
    }
};

// ===========================
// UTILIDADES DE CÁLCULO
// ===========================
export const Calculate = {
    pricePerPerson(totalPrice, passengers) {
        if (passengers <= 0) return 0;
        return Math.round(totalPrice / passengers);
    },

    percentageChange(oldValue, newValue) {
        if (oldValue === 0) return newValue > 0 ? 100 : 0;
        return ((newValue - oldValue) / oldValue) * 100;
    },

    nextPosition(vessels) {
        if (!vessels || vessels.length === 0) return 1;
        const maxPosition = Math.max(...vessels.map(v => v.posicion || 0));
        return maxPosition + 1;
    }
};

// ===========================
// VIEWPORT UTILITIES (iOS)
// ===========================
export const Viewport = {
    setVH() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    },

    init() {
        this.setVH();
        window.addEventListener('resize', () => this.setVH());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.setVH(), 100);
        });
    }
};

// ===========================
// DEBOUNCE Y THROTTLE
// ===========================
export const Performance = {
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// ===========================
// EXPORTAR UTILIDADES GLOBALES
// ===========================
window.Utils = {
    Haptics,
    Format,
    Validate,
    DOM,
    Animate,
    Storage,
    Time,
    ID,
    Network,
    Calculate,
    Viewport,
    Performance
};