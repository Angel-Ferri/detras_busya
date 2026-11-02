// ============================================================
// Busya · Análisis — procesamiento de Google Analytics
// ------------------------------------------------------------
// - trackEventGA(nombre, params): envía un evento custom a Google Analytics (gtag).
// - cargarMetricasAnalisis(rango): consulta el backend de analítica y procesa la respuesta.
// - procesarResumenAnalisis(payload, rango): normaliza y agrega las métricas.
// ============================================================

const ID_MEASUREMENT_GA = 'G-4HNJ40EJJG';
const BASE_ANALYTICS = (window.BUSYA_ANALYTICS_API_BASE || window.BUSYA_API_BASE || 'http://localhost:3000').replace(/\/+$/, '');

const RANGOS_ANALISIS = {
    dia: { etiqueta: 'Día', dias: 1 },
    semana: { etiqueta: 'Semana', dias: 7 },
    mes: { etiqueta: 'Mes', dias: 30 },
    ano: { etiqueta: 'Año', dias: 365 }
};

function gtagDisponible() {
    return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

// Envío de eventos custom a Google Analytics desde cualquier punto de la app
function trackEventGA(nombreEvento, parametros) {
    if (!gtagDisponible()) return;
    try {
        window.gtag('event', nombreEvento, parametros || {});
    } catch (error) {
        console.warn('No se pudo registrar el evento en Google Analytics:', nombreEvento, error);
    }
}

function aNumero(valor, defecto = 0) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : (typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : defecto);
}

// --- Procesamiento de la respuesta de la API de analítica ---

function procesarResumenAnalisis(payload, rango) {
    const fuente = (payload && typeof payload === 'object') ? (payload.metricas || payload.resumen || payload.data || payload) : {};
    const eventosRaw = Array.isArray(payload?.eventosTop)
        ? payload.eventosTop
        : (Array.isArray(payload?.eventos) ? payload.eventos : []);
    const diasRaw = Array.isArray(payload?.porDia)
        ? payload.porDia
        : (Array.isArray(payload?.dias) ? payload.dias : []);

    const metricas = {
        sesiones: aNumero(fuente.sesiones ?? fuente.sessions ?? fuente.sesionesUnicas, 0),
        usuarios: aNumero(fuente.usuarios ?? fuente.usuariosActivos ?? fuente.usuariosUnicos ?? fuente.activeUsers, 0),
        pageviews: aNumero(fuente.pageviews ?? fuente.pageViews ?? fuente.views, 0),
        eventos: eventosRaw.length > 0
            ? eventosRaw.reduce((suma, evento) => suma + aNumero(evento?.valor ?? evento?.conteo ?? evento?.count ?? evento?.eventos, 0), 0)
            : aNumero(fuente.eventos ?? fuente.events ?? fuente.eventosCustom, 0)
    };

    const eventosTop = eventosRaw
        .map(evento => ({
            nombre: String(evento?.nombre ?? evento?.name ?? 'evento'),
            valor: aNumero(evento?.valor ?? evento?.conteo ?? evento?.count ?? evento?.eventos, 0)
        }))
        .filter(evento => evento.valor > 0)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8);

    const porDia = diasRaw.map(dia => ({
        fecha: String(dia?.fecha ?? dia?.dia ?? dia?.date ?? ''),
        sesiones: aNumero(dia?.sesiones ?? dia?.sessions ?? dia?.s, 0),
        usuarios: aNumero(dia?.usuarios ?? dia?.users ?? dia?.u, 0),
        pageviews: aNumero(dia?.pageviews ?? dia?.views ?? 0)
    }));

    return { rango, metricas, eventosTop, porDia };
}

// --- Carga desde el backend de analítica (Google Analytics) ---

async function cargarMetricasAnalisis(rango) {
    const contenedorResumen = document.getElementById('pp-analisis-resumen');
    const contenedorError = document.getElementById('pp-analisis-error');
    const contenedorLoading = document.getElementById('pp-analisis-loading');

    if (contenedorError) contenedorError.classList.add('hidden');
    if (contenedorLoading) contenedorLoading.classList.remove('hidden');
    if (contenedorResumen) contenedorResumen.innerHTML = '<p class="pp-analisis-vacio">Cargando métricas de Google Analytics…</p>';

    try {
        const respuesta = await fetch(`${BASE_ANALYTICS}/api/analytics/resumen?rango=${rango}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!respuesta.ok) {
            throw new Error(`La API respondió con estado ${respuesta.status}`);
        }

        const payload = await respuesta.json();
        const modelo = procesarResumenAnalisis(payload, rango);

        renderizarResumenAnalisis(modelo);
        renderizarBarrasDiarias(modelo);
        renderizarEventosTop(modelo.eventosTop);

        if (contenedorLoading) contenedorLoading.classList.add('hidden');
        return modelo;
    } catch (error) {
        console.error('❌ Error al cargar las métricas de análisis:', error);
        if (contenedorLoading) contenedorLoading.classList.add('hidden');
        if (contenedorError) {
            contenedorError.textContent = 'No se pudieron cargar las métricas de Google Analytics. ¿Corré el backend de analítica en ejecución? (por defecto: http://localhost:3000)';
            contenedorError.classList.remove('hidden');
        }
        if (contenedorResumen) contenedorResumen.innerHTML = '<p class="pp-analisis-vacio">Sin datos disponibles por ahora.</p>';
    }
}

function escaparHTML(texto) {
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderizarResumenAnalisis(modelo) {
    const contenedor = document.getElementById('pp-analisis-resumen');
    if (!contenedor) return;

    const cfg = RANGOS_ANALISIS[modelo.rango] || RANGOS_ANALISIS.semana;

    const tarjeta = (etiqueta, valor) => `
        <div class="pp-kpi">
            <span class="pp-kpi-label">${escaparHTML(etiqueta)}</span>
            <span class="pp-kpi-valor">${aNumero(valor)}</span>
            <span class="pp-kpi-sub">Rango: ${escaparHTML(cfg.etiqueta)}</span>
        </div>`;

    contenedor.innerHTML = `
        <div class="pp-kpi-grid">
            ${tarjeta('Sesiones', modelo.metricas.sesiones)}
            ${tarjeta('Usuarios activos', modelo.metricas.usuarios)}
            ${tarjeta('Pageviews', modelo.metricas.pageviews)}
            ${tarjeta('Eventos', modelo.metricas.eventos)}
        </div>
    `;
}

function formatearFecha(fecha) {
    const texto = String(fecha || '');
    const partes = texto.split('-');
    if (partes.length < 3) return texto;
    const dia = partes[0];
    const mes = partes[1];
    const anio = partes[2];
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const mesIndex = Number(mes) - 1;
    const diaNumero = Number(dia);
    if (!Number.isFinite(diaNumero) || !Number.isFinite(mesIndex)) return texto;
    return `${diaNumero}/${String(mesIndex + 1).padStart(2, '0')}/${anio}`;
}

function renderizarBarrasDiarias(modelo) {
    const contenedor = document.getElementById('pp-analisis-barras');
    if (!contenedor) return;

    const dias = (modelo.porDia || []).slice().reverse(); // más reciente -> más lejano

    if (dias.length === 0) {
        contenedor.innerHTML = '<p class="pp-analisis-vacio">Sin datos de sesiones para el rango seleccionado.</p>';
        return;
    }

    const maximo = Math.max(...dias.map(dia => dia.sesiones), 1);

    contenedor.innerHTML = dias.map(dia => {
        const ancho = Math.max((dia.sesiones / maximo) * 100, dia.sesiones > 0 ? 2 : 0);
        return `
            <div class="pp-barra-fila">
                <span class="pp-barra-fecha">${escaparHTML(formatearFecha(dia.fecha))}</span>
                <div class="pp-barra-track">
                    <div class="pp-barra-fill" style="width: ${ancho}%"></div>
                </div>
                <span class="pp-barra-valor">${dia.sesiones}</span>
            </div>`;
    }).join('');
}

function renderizarEventosTop(eventosTop) {
    const contenedor = document.getElementById('pp-analisis-eventos');
    if (!contenedor) return;

    if (!eventosTop || eventosTop.length === 0) {
        contenedor.innerHTML = '<p class="pp-analisis-vacio">Sin eventos custom registrados todavía. La app ya envía eventos como "seleccionar_linea".</p>';
        return;
    }

    contenedor.innerHTML = `
        <ul class="pp-eventos-lista">
            ${eventosTop.map(evento => `
                <li class="pp-evento-item">
                    <span class="pp-evento-nombre">${escaparHTML(evento.nombre)}</span>
                    <span class="pp-evento-valor">${evento.valor} eventos</span>
                </li>`).join('')}
        </ul>
    `;
}

// --- Arranque: rangos y refresco automático ---

function seleccionarRango(rango) {
    document.querySelectorAll('.pp-rango-tab').forEach(tab => {
        const activo = tab.dataset.rango === rango;
        tab.classList.toggle('is-active', activo);
        tab.setAttribute('aria-selected', String(activo));
    });
    cargarMetricasAnalisis(rango);
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.pp-rango-tab').forEach(tab => {
        tab.addEventListener('click', () => seleccionarRango(tab.dataset.rango));
    });

    seleccionarRango('semana');
});
