// =====================================================
// Busya · PARTE 4 de 8 — HORARIOS DE LA LÍNEA
// =====================================================
//
// Cómo funcionan los horarios de Busya:
//
//   · La GRILLA son las paradas de referencia que la empresa publica:
//     Terminal, Policlínico, Escuela Agraria, Chacabuco y Güemes...
//     Esas tienen hora exacta para cada viaje.
//
//   · El resto de las paradas (las esquinas) NO tienen hora publicada.
//     Se CALCULAN: si sabemos a qué hora pasa el bus por la parada de
//     grilla anterior y por la siguiente, y sabemos cuánto hay entre
//     medio, podemos decir a qué hora pasa por la esquina.
//
// Este archivo hace esa cuenta.
//
// La grilla viene de la API en esta forma:
//
//   dias: [
//     {
//       dias: 'Lunes a Viernes',
//       paradas: ['Terminal', 'Balcarce y Urquiza', ...],   // la grilla, en orden de ruta
//       horarios: [ ['06:00', '06:12', ...], ['06:25', ...] ] // un viaje por fila
//     }
//   ]
//

/** Velocidad promedio del colectivo en km/h (la misma que usa el planificador). */
const VELOCIDAD_COLECTIVO_KMH = 18;

/** Tablas de grilla ya calculadas por línea (se cachean para no repetir el trabajo). */
const tablasDeGrilla = {};


// =====================================================
// QUÉ DÍA DE SERVICIO ES HOY
// =====================================================

/**
 * Devuelve el tipo de día de hoy: "Lunes a Viernes", "Sábados" o "Domingos".
 * Si está cargado script/dias.js se le pregunta a ese módulo (tiene en
 * cuenta los feriados); si no, se calcula a mano.
 */
function resolverTipoDeDia() {
    if (typeof resolverDiaDeServicio === 'function') {
        try {
            return resolverDiaDeServicio().tipo;
        } catch (e) { /* seguimos con el cálculo manual */ }
    }
    const dia = new Date().getDay();
    if (dia === 0) return 'Domingos';
    if (dia === 6) return 'Sábados';
    return 'Lunes a Viernes';
}

/**
 * Devuelve el día de servicio que corresponde a hoy para una línea,
 * ya normalizado a { dias, paradas, horarios }.
 * Si la línea no tiene grilla para hoy, devuelve null.
 */
function obtenerServicioDeHoy(keyLinea) {
    const horarios = horariosLineasCargados[keyLinea];
    if (!horarios || !horarios.dias || !horarios.dias.length) return null;

    const tipo = resolverTipoDeDia();
    const igual = (a, b) => normalizarTexto(a) === normalizarTexto(b);

    return horarios.dias.find(d => d.dias === tipo)
        || horarios.dias.find(d => igual(d.dias, tipo))
        || null;
}


// =====================================================
// EMPEAREJAR LA GRILLA CON LAS PARADAS DE CALLE
// =====================================================

/**
 * Dice qué tan parecidas son dos paradas por nombre (0 a 100).
 *
 * La idea: la grilla usa nombres abreviados ("L.Guillet y G. Paz") y las
 * paradas de calle los tienen completos ("León Guillet y Gral. Paz").
 * Por eso no alcanza con comparar texto exacto.
 *
 * Se comparan las palabras "distintivas" (las de 3 letras o más):
 *   · todas las de la grilla tienen que aparecer en la de calle, y
 *   · al menos la mitad de las de calle tienen que aparecer en la grilla.
 * Así "M. Ernst y Cazorla" no se confunde con "Montevideo y Marconi".
 */
function puntajeCoincidenciaParada(grilla, calle) {
    const a = normalizarNombreParada(grilla);
    const b = normalizarNombreParada(calle);
    if (!a || !b) return 0;
    if (a === b) return 100;

    const palabrasA = a.split(' ').filter(Boolean);
    const palabrasB = b.split(' ').filter(Boolean);
    const distintivasA = palabrasA.filter(p => p.length >= 3);
    const distintivasB = palabrasB.filter(p => p.length >= 3);
    if (!distintivasA.length || !distintivasB.length) return 0;

    // Dos palabras coinciden si son iguales o si una es prefijo de la otra.
    const coinciden = (x, y) => x === y || (x.length >= 3 && y.length >= 3 && (x.startsWith(y) || y.startsWith(x)));

    const coberturaA = distintivasA.filter(p => distintivasB.some(q => coinciden(p, q))).length / distintivasA.length;
    const coberturaB = distintivasB.filter(p => distintivasA.some(q => coinciden(p, q))).length / distintivasB.length;

    if (coberturaA < 1 || coberturaB < 0.5) return 0;
    return Math.round(70 + 15 * coberturaB);
}

/**
 * Arma la tabla que une la grilla con las paradas de calle.
 * Cada ancla dice: qué parada de grilla es, en qué posición de la lista
 * de paradas está y en qué posición de la grilla está (para poder leer
 * la hora de cada viaje).
 */
function obtenerTablaDeGrilla(keyLinea) {
    if (tablasDeGrilla[keyLinea]) return tablasDeGrilla[keyLinea];

    const servicio = obtenerServicioDeHoy(keyLinea);
    const linea = datosLineasCargados[keyLinea];
    const anclas = [];

    if (servicio && linea) {
        const yaUsadas = new Set();
        servicio.paradas.forEach((nombreGrilla, indiceEnGrilla) => {
            let mejorIndice = -1;
            let mejorPuntaje = 0;
            linea.paradas.forEach((parada, indice) => {
                if (yaUsadas.has(indice)) return;
                const puntaje = puntajeCoincidenciaParada(nombreGrilla, parada.nombre);
                if (puntaje > mejorPuntaje) {
                    mejorPuntaje = puntaje;
                    mejorIndice = indice;
                }
            });
            if (mejorIndice !== -1) {
                yaUsadas.add(mejorIndice);
                anclas.push({
                    nombre: nombreGrilla,
                    indiceParada: mejorIndice,
                    indiceEnGrilla: indiceEnGrilla
                });
            }
        });
    }

    tablasDeGrilla[keyLinea] = anclas;
    return anclas;
}

/**
 * Distancia de ruta entre dos paradas de la misma línea
 * (suma de los tramos entre paradas consecutivas, no la distancia en línea recta).
 */
function distanciaDeRutaEntreParadas(linea, indiceDesde, indiceHasta) {
    let total = 0;
    const desde = Math.min(indiceDesde, indiceHasta);
    const hasta = Math.max(indiceDesde, indiceHasta);
    for (let i = desde; i < hasta; i++) {
        total += calcularDistancia(
            [linea.paradas[i].lat, linea.paradas[i].lng],
            [linea.paradas[i + 1].lat, linea.paradas[i + 1].lng]
        );
    }
    return total;
}


// =====================================================
// EL CÁLCULO
// =====================================================

/**
 * Devuelve todas las horas de hoy en que el colectivo pasa por una parada,
 * ordenadas de menor a mayor. Las paradas sin horario publicado se calculan
 * interpolando entre las paradas de la grilla, igual que antes.
 *
 * @param {string} keyLinea     clave de la línea ('lineaa', 'lineae'...)
 * @param {number} indiceParada posición de la parada en la lista de la línea
 *
 * @returns {Array<{minutos: number, esInterpolado: boolean}>}
 */
function calcularHorariosDelDiaParada(keyLinea, indiceParada) {
    const linea = datosLineasCargados[keyLinea];
    if (!linea || !linea.paradas[indiceParada]) return [];

    const servicio = obtenerServicioDeHoy(keyLinea);
    if (!servicio || !servicio.horarios || !servicio.horarios.length) return [];

    const anclas = obtenerTablaDeGrilla(keyLinea);
    if (!anclas.length) return [];

    const resultados = [];

    // ── 1. La parada tiene horario publicado ──
    const anclaExacta = anclas.find(a => a.indiceParada === indiceParada);
    if (anclaExacta) {
        for (const fila of servicio.horarios) {
            const minutos = obtenerMinutosDesdeCadena(fila[anclaExacta.indiceEnGrilla]);
            if (minutos !== null) resultados.push({ minutos, esInterpolado: false });
        }
    } else {
        // ── 2. La parada NO tiene horario: se calcula con las vecinas ──
        const anteriores = anclas.filter(a => a.indiceParada < indiceParada);
        const siguientes = anclas.filter(a => a.indiceParada > indiceParada);
        const anclaAntes = anteriores.length ? anteriores[anteriores.length - 1] : null;
        const anclaDespues = siguientes.length ? siguientes[0] : null;

        for (const fila of servicio.horarios) {
            const tiempoAntes = anclaAntes ? obtenerMinutosDesdeCadena(fila[anclaAntes.indiceEnGrilla]) : null;
            const tiempoDespues = anclaDespues ? obtenerMinutosDesdeCadena(fila[anclaDespues.indiceEnGrilla]) : null;

            let minutos = null;

            if (tiempoAntes !== null && tiempoDespues !== null) {
                // Está entre dos paradas de grilla: se reparte el tiempo según
                // la distancia que falta para llegar a la siguiente.
                const fraccion = (indiceParada - anclaAntes.indiceParada)
                    / (anclaDespues.indiceParada - anclaAntes.indiceParada);
                minutos = Math.round(tiempoAntes + (tiempoDespues - tiempoAntes) * fraccion);
            } else if (tiempoAntes !== null) {
                // No hay ancla después: se estima el viaje con la velocidad del colectivo.
                const km = distanciaDeRutaEntreParadas(linea, anclaAntes.indiceParada, indiceParada);
                minutos = Math.round(tiempoAntes + (km / VELOCIDAD_COLECTIVO_KMH) * 60);
            } else if (tiempoDespues !== null) {
                // No hay ancla antes: se estima hacia atrás.
                const km = distanciaDeRutaEntreParadas(linea, anclaDespues.indiceParada, indiceParada);
                minutos = Math.round(tiempoDespues - (km / VELOCIDAD_COLECTIVO_KMH) * 60);
            }

            if (minutos !== null) resultados.push({ minutos, esInterpolado: true });
        }
    }

    // Las interpolaciones hacia atrás pueden dar horas negativas (antes de
    // la medianoche). No son horarios válidos del día, así que no se muestran.
    const validos = resultados
        .filter(h => h.minutos >= 0)
        .sort((a, b) => a.minutos - b.minutos);

    // Si dos viajes caen a la misma hora, mostramos una sola vez.
    return validos.filter((h, i) => i === 0 || h.minutos !== validos[i - 1].minutos);
}

/**
 * ¿A qué hora pasa el bus por una parada?
 *
 * @param {string} keyLinea       clave de la línea ('lineaa', 'lineae'...)
 * @param {number} indiceParada   posición de la parada en la lista de la línea
 * @param {number} minutosActuales minutos desde la medianoche de "ahora"
 *
 * @returns {object|null} { horaEstimadaStr, minutosLlegada, esInterpolado }
 *          esInterpolado = true cuando la hora se calculó, no viene publicada.
 */
function calcularHorarioEstimadoParada(keyLinea, indiceParada, minutosActuales) {
    const horarios = calcularHorariosDelDiaParada(keyLinea, indiceParada);
    if (!horarios.length) return null;

    const siguiente = horarios.find(h => h.minutos >= minutosActuales);
    const elegido = siguiente !== undefined ? siguiente : horarios[0];

    return {
        horaEstimadaStr: convertirMinutosAHora(elegido.minutos),
        minutosLlegada: elegido.minutos,
        esInterpolado: elegido.esInterpolado
    };
}

/**
 * Devuelve todas las horas de un viaje en el día de hoy, ya separadas.
 * Lo usa el simulador para saber dónde está cada colectivo.
 */
function obtenerViajesDeHoy(keyLinea) {
    const servicio = obtenerServicioDeHoy(keyLinea);
    if (!servicio) return [];
    return servicio.horarios.map(fila => ({
        paradas: servicio.paradas,
        horas: fila
    }));
}
