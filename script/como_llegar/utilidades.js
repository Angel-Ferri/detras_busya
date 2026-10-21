// =====================================================
// Busya · PARTE 2 de 8 — UTILIDADES
// =====================================================
//
// Funciones puras: no tocan el mapa ni la interfaz, solo calculan.
// Son la base matemática que usan el mapa, el planificador y el
// simulador. Si necesitás una fórmula, probablemente va acá.
//


// =====================================================
// COORDENADAS Y DISTANCIAS
// =====================================================

/**
 * Convierte cualquier lista de coordenadas al formato [lat, lng].
 * Acepta arrays ([lat, lng]) y objetos ({lat, lng}).
 */
function normalizarCoordenadas(arr) {
    if (!arr || !Array.isArray(arr)) return [];
    return arr.map(c => {
        if (Array.isArray(c)) return c;
        if (c.lat !== undefined && c.lng !== undefined) return [c.lat, c.lng];
        return c;
    });
}

/**
 * Distancia en kilómetros entre dos puntos [lat, lng].
 * Usa la fórmula de Haversine sobre el radio terrestre.
 */
function calcularDistancia(p1, p2) {
    const R = 6371;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLng = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Proyecta un punto sobre el segmento que va de a a b.
 * Devuelve el punto de la recta más cercano al punto original.
 */
function proyectarPuntoEnSegmento(p, a, b) {
    const l2 = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    if (l2 === 0) return a;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2));
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

/**
 * Busca el punto de una polilínea más cercano a una parada.
 * Devuelve el punto proyectado y el índice del segmento donde cayó.
 * Sirve para saber "en qué parte de la ruta" está una parada.
 */
function obtenerProyeccionEnRecorrido(recorridoCoords, puntoParada) {
    let menorDistancia = Infinity, mejorPunto = puntoParada, indiceSegmento = 0;
    for (let i = 0; i < recorridoCoords.length - 1; i++) {
        const proyectado = proyectarPuntoEnSegmento(puntoParada, recorridoCoords[i], recorridoCoords[i + 1]);
        const dist = calcularDistancia(puntoParada, proyectado);
        if (dist < menorDistancia) {
            menorDistancia = dist;
            mejorPunto = proyectado;
            indiceSegmento = i;
        }
    }
    return { puntoProyectado: mejorPunto, indiceSegmento: indiceSegmento };
}

/**
 * Devuelve el índice de la coordenada más cercana a un punto.
 * Es el "imán" que usa el trazado de transbordos.
 */
function obtenerIndiceCoordenadaMasCercana(coordenadas, punto) {
    let menorDist = Infinity;
    let indice = 0;
    coordenadas.forEach((coord, idx) => {
        const d = calcularDistancia(coord, punto);
        if (d < menorDist) {
            menorDist = d;
            indice = idx;
        }
    });
    return indice;
}

/**
 * Distancia acumulada sobre una polilínea.
 * Devuelve un arreglo con la distancia recorrida hasta cada punto.
 */
function calcularDistanciasAcumuladas(coordenadas) {
    const acumuladas = [0];
    for (let i = 0; i < coordenadas.length - 1; i++) {
        acumuladas.push(acumuladas[i] + calcularDistancia(coordenadas[i], coordenadas[i + 1]));
    }
    return acumuladas;
}

/**
 * ¿El punto destino está a menos de cierta distancia del punto de referencia?
 */
function distDestinoMenorA(latD, lngD, puntoReferencia, radioKm = 0.8) {
    const d = calcularDistancia([latD, lngD], [puntoReferencia.lat, puntoReferencia.lng]);
    return d <= radioKm;
}


// =====================================================
// TIEMPO
// =====================================================

/** Convierte "06:30" en minutos desde la medianoche (390). */
function obtenerMinutosDesdeCadena(cadena) {
    if (!cadena) return null;
    const [h, m] = cadena.split(':').map(Number);
    if (isNaN(h)) return null;
    return h * 60 + m;
}

/** Convierte minutos desde la medianoche en "06:30". */
function convertirMinutosAHora(minutos) {
    const total = ((minutos % 1440) + 1440) % 1440;
    const h = Math.floor(total / 60).toString().padStart(2, '0');
    const m = Math.floor(total % 60).toString().padStart(2, '0');
    return h + ':' + m;
}

/** Minutos que pasaron desde la medianoche hasta ahora. */
function minutosDeAhora() {
    const ahora = new Date();
    return ahora.getHours() * 60 + ahora.getMinutes();
}


// =====================================================
// TEXTO Y BÚSQUEDA APROXIMADA
// =====================================================

/** Quita acentos y pasa a minúsculas. */
function normalizarTexto(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Distancia de edición entre dos textos (Levenshtein).
 * Se usa para tolerar errores de tipeo al buscar paradas.
 */
function calcularDistanciaLetras(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matriz = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matriz[0][i] = i;
    for (let j = 0; j <= b.length; j++) matriz[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const indicadorSust = a[i - 1] === b[j - 1] ? 0 : 1;
            matriz[j][i] = Math.min(matriz[j][i - 1] + 1, matriz[j - 1][i] + 1, matriz[j - 1][i - 1] + indicadorSust);
        }
    }
    return matriz[b.length][a.length];
}

/**
 * ¿El texto coincide con la búsqueda aunque haya errores de tipeo?
 * Primero busca la coincidencia exacta; si no, compara palabra por palabra.
 */
function coincideConErrores(textoOriginal, busqueda) {
    const texto = normalizarTexto(textoOriginal);
    const term = normalizarTexto(busqueda);
    if (!term) return false;
    if (texto.includes(term)) return true;
    const palabrasTexto = texto.split(/\s+/);
    const palabrasBusqueda = term.split(/\s+/);
    return palabrasBusqueda.every(pB => palabrasTexto.some(pT => {
        if (pT.includes(pB)) return true;
        return calcularDistanciaLetras(pB, pT) <= (pB.length <= 4 ? 1 : 2);
    }));
}

/**
 * Normaliza un nombre de parada para poder compararlo con otro.
 * Quita acentos, puntuación y pasa a minúsculas.
 */
function normalizarNombreParada(nombre) {
    return normalizarTexto(nombre)
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
