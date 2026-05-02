/* =========================================================
   DIVIDE — Motor Matemático
   =========================================================
   Gestiona participantes dinámicos y calcula en tiempo real
   la distribución de una cuenta con pagos mixtos ($ y Bs).
   ========================================================= */

// ─────────────────────────────────────────────────────────
// ESTADO GLOBAL
// ─────────────────────────────────────────────────────────

/** Contador incremental usado para IDs únicos de personas */
let personaIdCounter = 0;

// ─────────────────────────────────────────────────────────
// CONFIGURACIÓN DE MÉTODOS DE PAGO
// ─────────────────────────────────────────────────────────

/**
 * Define el símbolo de moneda y el color de acento para
 * cada método de pago disponible.
 */
const METODOS = {
  usd_efectivo: { simbolo: '$',  label: '💵 Efectivo',    color: '#00f5ff', moneda: 'USD' },
  bs_movil:     { simbolo: 'Bs', label: '📱 Pago Móvil',  color: '#7c3aed', moneda: 'VES' },
  usd_zelle:    { simbolo: '$',  label: '⚡ Zelle/Binance', color: '#ff00a0', moneda: 'USD' },
};

// ─────────────────────────────────────────────────────────
// AGREGAR PERSONA
// ─────────────────────────────────────────────────────────

/**
 * Clona el <template> de tarjeta de persona, le asigna un ID
 * único y lo inserta en el contenedor. Luego ajusta la UI.
 */
function agregarPersona() {
  personaIdCounter++;
  const id = `persona-${personaIdCounter}`;

  // Clonar template
  const template = document.getElementById('persona-template');
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector('.persona-card');
  card.dataset.personaId = id;

  // Asignar placeholder de nombre numerado
  const inputNombre = card.querySelector('input[type="text"]');
  inputNombre.placeholder = `Persona ${personaIdCounter}`;

  // Seleccionar método inicial (usd_efectivo) visualmente
  const primerBtn = card.querySelector('[data-metodo="usd_efectivo"]');
  activarMetodoBtn(primerBtn, card, 'usd_efectivo');

  // Vincular botones de método de pago
  card.querySelectorAll('.metodo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const metodo = btn.dataset.metodo;
      activarMetodoBtn(btn, card, metodo);
      recalcular();
    });
  });

  // Vincular botón eliminar
  card.querySelector('.btn-eliminar').addEventListener('click', () => {
    eliminarPersona(card);
  });

  // Insertar en DOM
  document.getElementById('personas-container').appendChild(clone);

  // Ocultar estado vacío
  document.getElementById('empty-state').style.display = 'none';

  // Actualizar contador en header
  actualizarContador();

  // Recalcular totales
  recalcular();
}

// ─────────────────────────────────────────────────────────
// ELIMINAR PERSONA
// ─────────────────────────────────────────────────────────

/**
 * Añade animación de salida a la tarjeta y la elimina del DOM.
 * @param {HTMLElement} card — Elemento .persona-card a eliminar
 */
function eliminarPersona(card) {
  card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  card.style.opacity = '0';
  card.style.transform = 'scale(0.95)';

  setTimeout(() => {
    card.remove();

    // Mostrar estado vacío si no quedan tarjetas
    const container = document.getElementById('personas-container');
    if (container.querySelectorAll('.persona-card').length === 0) {
      document.getElementById('empty-state').style.display = 'flex';
    }

    actualizarContador();
    recalcular();
  }, 200);
}

// ─────────────────────────────────────────────────────────
// ACTIVAR BOTÓN DE MÉTODO DE PAGO
// ─────────────────────────────────────────────────────────

/**
 * Aplica estilos activos al botón de método seleccionado,
 * limpia los otros y actualiza el símbolo de moneda del input.
 * @param {HTMLElement} btnActivo — Botón presionado
 * @param {HTMLElement} card      — Tarjeta padre
 * @param {string}      metodo   — Clave del método (ver METODOS)
 */
function activarMetodoBtn(btnActivo, card, metodo) {
  // Limpiar estilos de todos los botones del grupo
  card.querySelectorAll('.metodo-btn').forEach(b => {
    b.style.background = '#13132b';
    b.style.borderColor = '#2d2d6e';
    b.style.color = '#6b7280';
    b.style.boxShadow = 'none';
  });

  // Aplicar estilo activo al botón seleccionado
  const cfg = METODOS[metodo];
  btnActivo.style.background = `${cfg.color}18`;          // color con ~10% opacidad
  btnActivo.style.borderColor = cfg.color;
  btnActivo.style.color = cfg.color;
  btnActivo.style.boxShadow = `0 0 8px ${cfg.color}33`;

  // Guardar método en input oculto
  card.querySelector('.metodo-valor').value = metodo;

  // Actualizar símbolo de moneda en el input de monto
  const simbolo = card.querySelector('.simbolo-moneda');
  simbolo.textContent = cfg.simbolo;
  simbolo.style.color = cfg.color;

  // Actualizar placeholder del monto según moneda
  const montoInput = card.querySelector('.monto-input');
  montoInput.placeholder = cfg.moneda === 'VES' ? '0' : '0.00';
  montoInput.step = cfg.moneda === 'VES' ? '1' : '0.01';
}

// ─────────────────────────────────────────────────────────
// ACTUALIZAR AVATAR (iniciales)
// ─────────────────────────────────────────────────────────

/**
 * Actualiza el círculo de avatar con la primera letra del nombre.
 * @param {HTMLInputElement} input — Input de nombre
 */
function actualizarAvatar(input) {
  const card = input.closest('.persona-card');
  const avatar = card.querySelector('.avatar');
  const nombre = input.value.trim();
  avatar.textContent = nombre ? nombre.charAt(0).toUpperCase() : '?';
}

// ─────────────────────────────────────────────────────────
// ACTUALIZAR CONTADOR DE PERSONAS (header)
// ─────────────────────────────────────────────────────────

function actualizarContador() {
  const total = document.querySelectorAll('.persona-card').length;
  document.getElementById('persona-count').textContent = total;
}

// ─────────────────────────────────────────────────────────
// MOTOR MATEMÁTICO — FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────

/**
 * Recorre todas las tarjetas de persona, convierte cada aporte
 * a dólares según el método de pago, acumula el total recolectado
 * y actualiza el panel flotante inferior.
 *
 * Conversión:
 *   • Efectivo $ / Zelle/Binance $  →  monto directo en USD
 *   • Pago Móvil Bs                →  monto / tasaCambio = USD
 */
function recalcular() {
  // ── 1. Leer datos globales ──────────────────────────────
  const totalCuenta = parseFloat(document.getElementById('total-cuenta').value) || 0;
  const tasaCambio  = parseFloat(document.getElementById('tasa-cambio').value)  || 0;

  // Actualizar stat de cuenta en panel flotante
  document.getElementById('stat-cuenta').textContent = formatUSD(totalCuenta);

  // ── 2. Iterar personas y sumar aportes ─────────────────
  let totalRecolectado = 0;

  document.querySelectorAll('.persona-card').forEach(card => {
    const metodo = card.querySelector('.metodo-valor').value;
    const monto  = parseFloat(card.querySelector('.monto-input').value) || 0;
    const equiv  = card.querySelector('.equivalencia');

    let aporteUSD = 0;

    if (metodo === 'bs_movil') {
      // Convertir Bs → USD usando la tasa de cambio
      if (tasaCambio > 0) {
        aporteUSD = monto / tasaCambio;
        equiv.textContent = monto > 0
          ? `≈ ${formatUSD(aporteUSD)} al cambio actual`
          : '';
        equiv.style.color = '#7c3aed';
      } else {
        // Sin tasa definida, no podemos calcular
        equiv.textContent = monto > 0 ? '⚠ Ingresa la tasa de cambio' : '';
        equiv.style.color = '#ff00a0';
        aporteUSD = 0;
      }
    } else {
      // USD efectivo o Zelle — valor directo
      aporteUSD = monto;
      equiv.textContent = '';
    }

    totalRecolectado += aporteUSD;
  });

  // ── 3. Calcular diferencia ─────────────────────────────
  const diferencia = totalRecolectado - totalCuenta;

  // ── 4. Actualizar panel flotante ───────────────────────
  actualizarPanel(totalRecolectado, totalCuenta, diferencia);
}

// ─────────────────────────────────────────────────────────
// ACTUALIZAR PANEL FLOTANTE
// ─────────────────────────────────────────────────────────

/**
 * Actualiza los tres stats del panel inferior y la barra de progreso
 * con colores semánticos según el estado de la cuenta.
 *
 * @param {number} recolectado — Total en USD ya reunido
 * @param {number} cuenta      — Monto total de la cuenta
 * @param {number} diferencia  — recolectado - cuenta
 */
function actualizarPanel(recolectado, cuenta, diferencia) {
  const statRecolectado = document.getElementById('stat-recolectado');
  const estadoLabel     = document.getElementById('stat-estado-label');
  const estadoValor     = document.getElementById('stat-estado-valor');
  const estadoWrap      = document.getElementById('stat-estado-wrap');
  const progressBar     = document.getElementById('progress-bar');
  const inlineLabel     = document.getElementById('total-recolectado-inline');

  // Recolectado
  statRecolectado.textContent = formatUSD(recolectado);

  // Barra de progreso
  const porcentaje = cuenta > 0 ? Math.min((recolectado / cuenta) * 100, 100) : 0;
  progressBar.style.width = `${porcentaje}%`;

  // Label inline junto al título de sección
  inlineLabel.textContent = recolectado > 0 ? `Total: ${formatUSD(recolectado)}` : '';

  // Estado semántico
  if (cuenta === 0 || recolectado === 0 && cuenta === 0) {
    // Sin datos suficientes
    estadoLabel.textContent = 'Estado';
    estadoValor.textContent  = '—';
    estadoValor.style.color  = '#7c3aed';
    estadoWrap.style.background = 'rgba(124,58,237,0.12)';
    progressBar.style.background = '#7c3aed';
    estadoValor.classList.remove('flicker');

  } else if (Math.abs(diferencia) < 0.005) {
    // ✅ CUENTA CUADRADA (tolerancia 0.005 USD)
    estadoLabel.textContent = '¡Cuadrado!';
    estadoValor.textContent  = '✓';
    estadoValor.style.color  = '#00f5ff';
    estadoWrap.style.background = 'rgba(0,245,255,0.1)';
    progressBar.style.background = '#00f5ff';
    estadoValor.classList.add('flicker');

  } else if (diferencia < 0) {
    // ❌ FALTA DINERO
    const falta = Math.abs(diferencia);
    estadoLabel.textContent = 'Falta';
    estadoValor.textContent  = formatUSD(falta);
    estadoValor.style.color  = '#ff00a0';
    estadoWrap.style.background = 'rgba(255,0,160,0.1)';
    progressBar.style.background = '#ff00a0';
    estadoValor.classList.remove('flicker');

  } else {
    // 💚 HAY VUELTO
    estadoLabel.textContent = 'Vuelto';
    estadoValor.textContent  = formatUSD(diferencia);
    estadoValor.style.color  = '#22c55e';
    estadoWrap.style.background = 'rgba(34,197,94,0.1)';
    progressBar.style.background = '#22c55e';
    estadoValor.classList.remove('flicker');
  }
}

// ─────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────

/**
 * Formatea un número como moneda USD con 2 decimales.
 * @param {number} valor
 * @returns {string} ej: "$12.50"
 */
function formatUSD(valor) {
  return `$${valor.toFixed(2)}`;
}

// ─────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────────────────

/**
 * Al cargar la página, calcular el estado inicial (todo en cero)
 * para que el panel flotante muestre valores correctos desde el inicio.
 */
document.addEventListener('DOMContentLoaded', () => {
  recalcular();
});
