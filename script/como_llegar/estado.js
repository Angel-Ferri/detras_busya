// =====================================================
// Busya · PARTE 1 de 8 — ESTADO GLOBAL
// =====================================================
//
// Acá viven las variables que comparten TODAS las otras partes.
// Si algo nuevo se usa en más de un archivo, se declara acá.
//
// Organized en tres bloques:
//   1. Mapa y capas        → qué se está dibujando
//   2. Datos del proyecto  → líneas, horarios y lugares
//   3. Estado del rastreador → el simulador de colectivos
//
// Nota: son archivos scripts clásicos (no módulos), así que estas
// variables quedan disponibles en todas las partes sin importar el
// orden en que se carguen.
//


// =====================================================
// 1. MAPA Y CAPAS
// =====================================================

/** Instancia principal de Leaflet. */
let mapa = null;

/** Posición del usuario (lat, lng). Se rellena con el GPS o con un valor por defecto. */
let ubicacionUsuario = null;

/** Marcador con el ícono de "tu posición". */
let marcadorUsuario = null;

/** Control de ruteo a pie (Leaflet Routing Machine). */
let routingControlPie = null;

/** Polilínea del recorrido completo de la línea elegida. */
let lineaPolyline = null;

/** Polilínea del tramo que se va a viajar (subida → bajada). */
let lineaTramoPolyline = null;

/** Marcadores de cada parada de calle de la línea. */
let marcadoresParadas = [];

/** Marcador de la parada de subida. */
let marcadorOrigenSugerido = null;

/** Marcador de la parada de bajada. */
let marcadorDestinoSeleccionado = null;

/** Decorador de flechas sobre las polilíneas. */
let decoradorFlechas = null;

/** Polilínea de fondo de la segunda línea (cuando hay transbordo). */
let lineaL2FondoPolyline = null;

/** Polilínea del tramo que se viaja en la segunda línea. */
let lineaTramoL2Polyline = null;

/** Marcador de la bajada final en la segunda línea. */
let marcadorDestinoFinalL2 = null;

/** Marcador del punto de transbordo. */
let marcadorTransbordoL2 = null;

/** Marcador del destino final buscado por nombre. */
let marcadorDestinoBuscado = null;


// =====================================================
// 2. DATOS DEL PROYECTO
// =====================================================

/**
 * Datos de cada línea, ya traídos de la API.
 * Queda así:
 *   datosLineasCargados['lineaa'] = {
 *       nombre: 'Línea A',
 *       key: 'lineaa',
 *       paradas: [ { nombre, lat, lng, ... } ],
 *       recorrido: [ [lat, lng], ... ]
 *   }
 */
let datosLineasCargados = {};

/**
 * Horarios de cada línea, ya traídos de la API.
 *   horariosLineasCargados['lineaa'] = {
 *       nombre: 'Línea A',
 *       dias: [ { dias: 'Lunes a Viernes', paradas: [...], horarios: [[...], [...]] } ]
 *   }
 */
let horariosLineasCargados = {};

/** Línea que está seleccionada en este momento. */
let recorridoActual = null;


// =====================================================
// 3. ESTADO DEL RASTREADOR DE COLECTIVOS
// =====================================================

/** ¿Está prendido el simulador de colectivos? Arranca apagado. */
let rastreoActivo = false;

/** Marcadores de los colectivos que se están moviendo. */
let marcadoresColectivos = [];

/** Temporizador del simulador (setInterval). */
let bucleSimulacion = null;
let mejorViajeActual = null;


// =====================================================
// ICONOS
// =====================================================

/** Ícono de la posición del usuario. */
const iconoUsuarioGPS = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/9356/9356230.png',
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -38]
});

/** Ícono de la parada de subida. */
const iconoParadaSubida = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -30]
});

/** Ícono de la parada de bajada. */
const iconoParadaBajada = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1483/1483336.png',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -30]
});
