/**
 * Dispara retroalimentación visual y háptica si es compatible.
 * @param {'light' | 'medium' | 'heavy' | 'success' | 'error'} type
 */
export function triggerHapticFeedback(type = 'light') {
    const hapticElement = document.getElementById('hapticFeedback');
    if (hapticElement) {
        hapticElement.style.display = 'block';
        setTimeout(() => {
            hapticElement.style.display = 'none';
        }, 300);
    }

    if ('vibrate' in navigator) {
        switch(type) {
            case 'light':
                navigator.vibrate(10);
                break;
            case 'medium':
                navigator.vibrate(20);
                break;
            case 'heavy':
                navigator.vibrate([30, 10, 30]);
                break;
            case 'success':
                navigator.vibrate([100, 50, 100]);
                break;
            case 'error':
                navigator.vibrate([200, 100, 200, 100, 200]);
                break;
        }
    }
}