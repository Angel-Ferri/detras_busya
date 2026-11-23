// =====================================================
// Busya · PARTE 8 de 8 — ARRANQUE
// =====================================================
//
// El último archivo: se encarga de prender todo cuando la página carga.
//
// El orden importa:
//   1. el mapa, para tener dónde dibujar
//   2. la ubicación del usuario, para saber desde dónde se calcula
//   3. las líneas (paradas y recorrido), que vienen de la API
//   4. la grilla de horarios, que también viene de la API
//   5. los lugares de referencia, para el buscador
//   6. el aviso por si la API no respondió
//


/**
 * Deja el botón de rastreo en su estado inicial (apagado).
 * El interruptor se dibuja con CSS a partir de aria-pressed.
 */
function inicializarBotonRastreo() {
    const btn = document.getElementById('btn-rastreo');
    if (!btn) return;

    btn.setAttribute('aria-pressed', 'false');
    btn.classList.remove('activo');

    const estado = btn.querySelector('.btn-rastreo-estado');
    if (estado) estado.textContent = 'Simulación apagada';
}

/**
 * Muestra un aviso fijo cuando el dispositivo no tiene conexión.
 */
function actualizarIndicadorOffline() {
    const aviso = document.getElementById('aviso-offline');
    if (!aviso) return;
    const sinConexion = (typeof navigator !== 'undefined' && navigator.onLine === false);
    aviso.style.display = sinConexion ? 'block' : 'none';
    if (sinConexion) document.body.classList.add('modo-offline');
    else document.body.classList.remove('modo-offline');
}

/**
 * Arranque de la página.
 */
document.addEventListener('DOMContentLoaded', async () => {
    actualizarIndicadorOffline();
    window.addEventListener('online', actualizarIndicadorOffline);
    window.addEventListener('offline', actualizarIndicadorOffline);

    // 1. El mapa.
    inicializarMapa();

    // 2. El botón de rastreo arranca apagado.
    inicializarBotonRastreo();

    // 3. La ubicación del usuario (pide permiso al navegador).
    obtenerUbicacionUsuario();

    // 4. Las líneas: paradas y recorrido.
    await cargarRecorridos();

    // 4b. Si el GPS llegó antes que los datos, precargar el contexto ahora.
    if (ubicacionUsuario && (!contextoOrigenUsuario || !contextoOrigenUsuario.zona)) {
        analizarUbicacionUsuario(ubicacionUsuario.lat, ubicacionUsuario.lng);
    }

    // 5. La grilla de horarios del día.
    await cargarHorarios();

    // 6. Los lugares de referencia (para el buscador).
    await cargarLugaresDeReferencia();

    // 7. Si los datos no vinieron de la API, se avisa en pantalla.
    mostrarAvisoDeOrigen();
});
