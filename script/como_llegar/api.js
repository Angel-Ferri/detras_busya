// =====================================================
// Busya · PARTE 3 de 8 — CLIENTE DE LA API
// =====================================================
//
// Los datos del proyecto ya no se leen de archivos sueltos: la fuente
// de verdad es la API que genera el panel (busya-panel).
//
//   GET /api/lineas            → el listado de líneas
//   GET /api/lineas/linea-a    → una línea completa (paradas + recorrido + horarios)
//   GET /api/lugares           → lugares de referencia
//
// Si la API no está levantada, la app cae de vuelta a los archivos
// JSON locales de la carpeta datos/ para no dejar la pantalla en blanco.
// Cuando eso pasa se avisa con un cartel: nunca mostramos datos viejos
// sin decirlo (ver VISION.md).
//

/** Dirección base de la API. Se puede cambiar desde otro script con window.BUSYA_API_BASE. */
const API_BASE = (typeof window !== 'undefined' && window.BUSYA_API_BASE) || 'http://localhost:3000';

/**
 * Las claves que usa la interfaz (los value del <select>) contra los ids
 * que usa la API. Se derivan del nombre de la línea, así no hay tabla
 * escrita a mano: "Línea Zona Este" y "Línea Este" dan la misma clave.
 */
function claveDesdeNombre(nombre) {
    return normalizarTexto(nombre)
        .replace(/[^a-z0-9]+/g, '')
        .replace('zona', '');
}

/** Archivos locales que se usan como respaldo si la API no responde. */
const RESPALDO_LOCAL = {
    lineaa: { paradas: 'datos/coordenadas/paradas_secundarias_Linea_A.json', horarios: 'datos/linea_a_horarios.json' },
    lineae: { paradas: 'datos/coordenadas/paradas_secundarias_Linea_E.json', horarios: 'datos/linea_e_horarios.json' },
    lineaeste: { paradas: 'datos/coordenadas/paradas_secundarias_Linea_Este.json', horarios: 'datos/linea_este_horarios.json' },
    lineaoeste: { paradas: 'datos/coordenadas/paradas_secundarias_Linea_Oeste.json', horarios: 'datos/linea_oeste_horarios.json' }
};

/** Lugares de referencia que publica la API (escuelas, ICA, etc.). */
let lugaresDeReferencia = [];

/** ¿VENGAMOS de la API o del respaldo local? Se muestra en la interfaz. */
let origenDeDatos = 'api';


// =====================================================
// PETICIONES
// =====================================================

/**
 * Pide un JSON a la API. Lanza el error si la respuesta no es correcta.
 */
async function pedirJSON(ruta) {
    const respuesta = await fetch(API_BASE + ruta, { cache: 'no-store' });
    if (!respuesta.ok) throw new Error('La API respondió ' + respuesta.status + ' en ' + ruta);
    return respuesta.json();
}

/**
 * Pide un JSON local (usado solo como respaldo).
 */
async function pedirJSONLocal(ruta) {
    const respuesta = await fetch(ruta, { cache: 'no-store' });
    if (!respuesta.ok) throw new Error('No se pudo leer ' + ruta);
    return respuesta.json();
}


// =====================================================
// NORMALIZACIÓN DE LA GRILLA DE HORARIOS
// =====================================================

/**
 * Deja un día de servicio siempre con la misma forma:
 *
 *   { dias: 'Lunes a Viernes', paradas: ['Terminal', ...], horarios: [['06:00','06:12',...], ...] }
 *
 * Es decir: la lista de paradas de la grilla y, por cada viaje, una fila
 * de horas alineada a esa lista (null cuando ese viaje no pasa por esa parada).
 *
 * La API ya viene así. Los archivos locales a veces vienen con la forma
 * "mapa" (un objeto parada -> hora), y esta función la convierte.
 */
function normalizarDiaDeServicio(entrada) {
    const dias = entrada['días'] || entrada.dias || '';
    const viajes = Array.isArray(entrada.horarios) ? entrada.horarios : [];

    // ¿La fila es una lista de horas o un mapa parada -> hora?
    const esMapa = viajes.length > 0 && typeof viajes[0] === 'object' && !Array.isArray(viajes[0]);

    if (!esMapa) {
        return { dias, paradas: Array.isArray(entrada.paradas) ? entrada.paradas : [], horarios: viajes };
    }

    // Forma mapa: armamos la lista de paradas (unión de todos los viajes)
    // y después transponemos cada viaje a una fila.
    const paradas = [];
    const indice = new Map();
    const clave = nombre => normalizarNombreParada(nombre);

    for (const nombre of (Array.isArray(entrada.paradas) ? entrada.paradas : [])) {
        if (!indice.has(clave(nombre))) { indice.set(clave(nombre), paradas.length); paradas.push(nombre); }
    }
    for (const viaje of viajes) {
        for (const nombre of Object.keys(viaje)) {
            if (!indice.has(clave(nombre))) { indice.set(clave(nombre), paradas.length); paradas.push(nombre); }
        }
    }

    const horarios = viajes.map(viaje => {
        const fila = new Array(paradas.length).fill(null);
        for (const nombre of Object.keys(viaje)) {
            const i = indice.get(clave(nombre));
            if (i === undefined) continue;
            const hora = viaje[nombre];
            fila[i] = (hora === null || hora === undefined || hora === '') ? null : hora;
        }
        return fila;
    });

    return { dias, paradas, horarios };
}

/**
 * Saca de un archivo de horarios la lista de días de servicio,
 * sin importar si el archivo usa "servicios" o "horarios_por_dia".
 */
function extraerDiasDeServicio(archivo) {
    const lineas = Array.isArray(archivo.lineas) ? archivo.lineas : [];
    const salida = [];
    for (const linea of lineas) {
        if (Array.isArray(linea.horarios_por_dia)) {
            for (const entrada of linea.horarios_por_dia) salida.push(normalizarDiaDeServicio(entrada));
        } else if (Array.isArray(linea.servicios)) {
            for (const entrada of linea.servicios) salida.push(normalizarDiaDeServicio(entrada));
        }
    }
    return salida;
}


// =====================================================
// CARGA DE DATOS
// =====================================================

/**
 * Carga las 4 líneas (paradas + recorrido) desde la API.
 * Si la API no está, usa los archivos JSON locales.
 */
async function cargarRecorridos() {
    try {
        const listado = await pedirJSON('/api/lineas');
        const lineas = Array.isArray(listado.lineas) ? listado.lineas : [];
        if (!lineas.length) throw new Error('La API no devolvió ninguna línea');

        for (const info of lineas) {
            const detalle = await pedirJSON('/api/lineas/' + info.id);
            const key = claveDesdeNombre(detalle.nombre);
            datosLineasCargados[key] = {
                nombre: detalle.nombre,
                key: key,
                color: detalle.color || '#2563eb',
                paradas: (detalle.paradas_secundarias || []).map(p => ({
                    nombre: p.nombre,
                    lat: p.lat,
                    lng: p.lng,
                    descripcion: p.descripcion || ''
                })),
                recorrido: normalizarCoordenadas(
                    detalle.recorrido && detalle.recorrido.coordenadas
                        ? detalle.recorrido.coordenadas
                        : (detalle.paradas_secundarias || []).map(p => [p.lat, p.lng])
                )
            };
        }
        origenDeDatos = 'api';
        return true;
    } catch (e) {
        console.warn('La API no respondió, se usan los datos locales:', e.message);
        origenDeDatos = 'local';
        return cargarRecorridosLocales();
    }
}

/**
 * Respaldo: lee las líneas de la carpeta datos/ del proyecto.
 */
async function cargarRecorridosLocales() {
    for (const key of Object.keys(RESPALDO_LOCAL)) {
        try {
            const archivo = await pedirJSONLocal(RESPALDO_LOCAL[key].paradas);
            const paradas = archivo.paradas || [];
            datosLineasCargados[key] = {
                nombre: (archivo.linea && archivo.linea.nombre) || key,
                key: key,
                color: '#2563eb',
                paradas: paradas.map(p => ({ nombre: p.nombre, lat: p.lat, lng: p.lng, descripcion: p.descripcion || '' })),
                recorrido: normalizarCoordenadas(
                    archivo.recorrido && archivo.recorrido.coordenadas
                        ? archivo.recorrido.coordenadas
                        : paradas.map(p => [p.lat, p.lng])
                )
            };
        } catch (e) {
            console.warn('No se pudo cargar ' + RESPALDO_LOCAL[key].paradas + ': ' + e.message);
        }
    }
    return Object.keys(datosLineasCargados).length > 0;
}

/**
 * Carga la grilla de horarios de las 4 líneas desde la API.
 * Si la API no está, usa los archivos JSON locales.
 */
async function cargarHorarios() {
    try {
        const listado = await pedirJSON('/api/lineas');
        const lineas = Array.isArray(listado.lineas) ? listado.lineas : [];
        for (const info of lineas) {
            const detalle = await pedirJSON('/api/lineas/' + info.id);
            const key = claveDesdeNombre(detalle.nombre);
            horariosLineasCargados[key] = {
                nombre: detalle.nombre,
                key: key,
                dias: (detalle.horarios_por_dia || []).map(normalizarDiaDeServicio)
            };
        }
        return true;
    } catch (e) {
        console.warn('La API no devolvió los horarios, se usan los locales:', e.message);
        return cargarHorariosLocales();
    }
}

/**
 * Respaldo: lee la grilla de la carpeta datos/ del proyecto.
 */
async function cargarHorariosLocales() {
    for (const key of Object.keys(RESPALDO_LOCAL)) {
        try {
            const archivo = await pedirJSONLocal(RESPALDO_LOCAL[key].horarios);
            horariosLineasCargados[key] = {
                nombre: (archivo.lineas && archivo.lineas[0] && archivo.lineas[0].nombre) || key,
                key: key,
                dias: extraerDiasDeServicio(archivo)
            };
        } catch (e) {
            console.warn('No se pudo cargar ' + RESPALDO_LOCAL[key].horarios + ': ' + e.message);
        }
    }
    return Object.keys(horariosLineasCargados).length > 0;
}

/**
 * Carga los lugares de referencia (escuelas, ICA, etc.) desde la API.
 * También agrega los comercios del archivo unificado para el buscador inteligente.
 * No son obligatorios: si la API no responde, la app sigue igual.
 */
async function cargarLugaresDeReferencia() {
    try {
        const respuesta = await pedirJSON('/api/lugares');
        lugaresDeReferencia = (respuesta.lugares || []).map(l => ({
            nombre: l.nombre,
            descripcion: l.descripcion || l.nombre,
            lat: l.coordenadas.lat,
            lng: l.coordenadas.lng
        }));
    } catch (e) {
        console.warn('No se pudieron cargar los lugares de referencia:', e.message);
        lugaresDeReferencia = [];
    }
    
    // Agregar comercios desde archivo unificado
    try {
        const respComercios = await fetch('datos/datos-unificados.json');
        if (respComercios.ok) {
            const datosUnif = await respComercios.json();
            const comercios = datosUnif.comercios || [];
            for (const c of comercios) {
                if (c.searchable && c.nombre) {
                    lugaresDeReferencia.push({
                        nombre: c.nombre,
                        descripcion: c.direccion ? `${c.categoria} - ${c.direccion}, ${c.barrio}` : c.categoria,
                        lat: c.lat,
                        lng: c.lng,
                        coordenadas: { lat: c.lat, lng: c.lng },
                        tipo: 'comercio',
                        categoria: c.categoria
                    });
                }
            }
            console.log(`✅ ${comercios.length} comercios agregados al buscador inteligente`);
        }
    } catch (e) {
        console.warn('No se pudieron cargar comercios unificados:', e.message);
    }
}

/**
 * Avisa en pantalla si los datos|no vienen de la API.
 * La idea es no hacer pasar un dato viejo por dato fresco.
 */
function mostrarAvisoDeOrigen() {
    if (origenDeDatos !== 'local') return;
    const aviso = document.createElement('div');
    aviso.id = 'aviso-origen-datos';
    aviso.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:12000;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;border-radius:8px;padding:8px 12px;font-size:.78rem;max-width:280px;box-shadow:0 2px 8px rgba(0,0,0,.15);';
    aviso.textContent = '⚠️ La API no está disponible: se muestran los datos locales guardados.';
    document.body.appendChild(aviso);
}
