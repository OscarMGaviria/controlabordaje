/**
 * Muestra un mensaje de error en pantalla.
 * @param {string} message - Texto del error.
 */
export function showError(message) {
  const loginError = document.getElementById('loginError');
  if (loginError) {
    loginError.textContent = message;
    loginError.style.display = 'block';
  }
}

/**
 * Oculta el mensaje de error.
 */
export function hideError() {
  const loginError = document.getElementById('loginError');
  if (loginError) {
    loginError.style.display = 'none';
  }
}

/**
 * Muestra la animación de carga.
 */
export function showLoading() {
  const loading = document.getElementById('loading');
  const loginButton = document.getElementById('loginButton');
  if (loading && loginButton) {
    loading.style.display = 'block';
    loginButton.disabled = true;
  }
}

/**
 * Oculta la animación de carga.
 */
export function hideLoading() {
  const loading = document.getElementById('loading');
  const loginButton = document.getElementById('loginButton');
  if (loading && loginButton) {
    loading.style.display = 'none';
    loginButton.disabled = false;
  }
}
