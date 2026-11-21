/**
 * @file toasts.js
 * @description Componente universal y accesible de Notificaciones Toast para ChocoTi-Digital.
 * Cumple con los requisitos obligatorios:
 *  - Cierre automático: 3.5 s (éxito/info) y 6 s (error/advertencia).
 *  - Pausa al pasar el mouse y reanudación al salir.
 *  - Máximo 3 notificaciones visibles apiladas simultáneamente.
 *  - Deduplicación estricta de mensajes idénticos.
 *  - Accesibilidad (aria-live).
 *  - Reemplazo transparente de window.alert.
 */

'use strict';

class ToastManager {
  constructor() {
    this.container = null;
    this.maxVisible = 3;
    this.toasts = []; // Elementos activos
    this.init();
  }

  /**
   * Inicializa el contenedor en el DOM si no existe.
   */
  init() {
    if (typeof document === 'undefined') return;

    if (!document.getElementById('toastContainer')) {
      this.container = document.createElement('div');
      this.container.id = 'toastContainer';
      this.container.className = 'toast-container';
      this.container.setAttribute('aria-live', 'polite');
      this.container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('toastContainer');
    }
  }

  /**
   * Muestra una notificación Toast.
   *
   * @param {string} mensaje - Texto del aviso
   * @param {'success'|'error'|'warning'|'info'} [tipo='info'] - Tipo visual
   * @param {string} [titulo=''] - Título opcional
   */
  show(mensaje, tipo = 'info', titulo = '') {
    if (!mensaje) return;
    this.init();

    const tipoNormalizado = ['success', 'error', 'warning', 'info'].includes(tipo) ? tipo : 'info';

    // 1. Deduplicación: Si ya existe un toast visible con el mismo mensaje, no duplicar
    const toastExistente = this.toasts.find(
      (t) => t.dataset.mensaje === mensaje && !t.classList.contains('leaving')
    );
    if (toastExistente) {
      // Breve parpadeo de realce para indicar feedback
      toastExistente.style.transform = 'scale(1.03)';
      setTimeout(() => {
        toastExistente.style.transform = 'none';
      }, 150);
      return toastExistente;
    }

    // 2. Control de apilamiento: Máximo 3 visibles simultáneas
    if (this.toasts.length >= this.maxVisible) {
      const masAntiguo = this.toasts[0];
      this.dismiss(masAntiguo);
    }

    // 3. Duración según especificación: 3.5s (éxito/info) y 6s (error/advertencia)
    const duracion = tipoNormalizado === 'error' || tipoNormalizado === 'warning' ? 6000 : 3500;

    // 4. Iconos correspondientes
    const iconos = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    // 5. Creación del nodo DOM
    const toastElem = document.createElement('div');
    toastElem.className = `toast-item toast-item--${tipoNormalizado}`;
    toastElem.dataset.mensaje = mensaje;
    toastElem.setAttribute('role', tipoNormalizado === 'error' ? 'alert' : 'status');

    toastElem.innerHTML = `
      <div class="toast-icon" aria-hidden="true">${iconos[tipoNormalizado]}</div>
      <div class="toast-body">
        ${titulo ? `<div class="toast-title">${escapeHtml(titulo)}</div>` : ''}
        <p class="toast-message">${escapeHtml(mensaje)}</p>
      </div>
      <button type="button" class="toast-close" aria-label="Cerrar notificación">✕</button>
      <div class="toast-progress" style="animation-duration: ${duracion}ms;"></div>
    `;

    this.container.appendChild(toastElem);
    this.toasts.push(toastElem);

    // Animación de entrada
    requestAnimationFrame(() => {
      toastElem.classList.add('visible');
    });

    // 6. Control de temporizador con pausa al hover del mouse
    let tiempoRestante = duracion;
    let tiempoInicio = Date.now();
    let timerId = null;

    const iniciarTimer = () => {
      tiempoInicio = Date.now();
      timerId = setTimeout(() => {
        this.dismiss(toastElem);
      }, tiempoRestante);
    };

    const pausarTimer = () => {
      clearTimeout(timerId);
      const transcurrido = Date.now() - tiempoInicio;
      tiempoRestante = Math.max(500, tiempoRestante - transcurrido);
    };

    iniciarTimer();

    // Eventos de pausa al pasar el mouse
    toastElem.addEventListener('mouseenter', pausarTimer);
    toastElem.addEventListener('mouseleave', iniciarTimer);

    // Botón manual de cierre
    const closeBtn = toastElem.querySelector('.toast-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearTimeout(timerId);
      this.dismiss(toastElem);
    });

    return toastElem;
  }

  /**
   * Cierra y retira el toast con animación.
   * @param {HTMLElement} toastElem
   */
  dismiss(toastElem) {
    if (!toastElem || toastElem.classList.contains('leaving')) return;

    toastElem.classList.remove('visible');
    toastElem.classList.add('leaving');

    setTimeout(() => {
      if (toastElem.parentNode) {
        toastElem.parentNode.removeChild(toastElem);
      }
      this.toasts = this.toasts.filter((t) => t !== toastElem);
    }, 300);
  }

  // Métodos de conveniencia
  success(mensaje, titulo = 'Éxito') {
    return this.show(mensaje, 'success', titulo);
  }

  error(mensaje, titulo = 'Error') {
    return this.show(mensaje, 'error', titulo);
  }

  warning(mensaje, titulo = 'Atención') {
    return this.show(mensaje, 'warning', titulo);
  }

  info(mensaje, titulo = 'Información') {
    return this.show(mensaje, 'info', titulo);
  }
}

/**
 * Escapa caracteres HTML para prevenir inyección XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Instancia única global
const Toast = new ToastManager();

// Exportación global en ventana para navegador
if (typeof window !== 'undefined') {
  window.Toast = Toast;
  window.mostrarToast = (mensaje, tipo, titulo) => Toast.show(mensaje, tipo, titulo);

  // Reemplazo no invasivo de window.alert para cumplimiento de la directriz
  window.alert = function (mensaje) {
    console.warn('[Toast] window.alert reemplazado por componente Toast:', mensaje);
    Toast.info(String(mensaje));
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Toast;
}
