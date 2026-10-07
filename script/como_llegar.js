// =====================================================
// Busya - Cómo Llegar (Versión 100% Gratuita OSM)
// =====================================================

let mapa = null;
let ubicacionUsuario = null;
let marcadorUsuario = null;
let routingControlPie = null;
let lineaPolyline = null;
let lineaTramoPolyline = null;
let datosLineasCargados = {};
let horariosLineasCargados = {};
let recorridoActual = null;
let marcadoresParadas = [];
let marcadorOrigenSugerido = null;
let marcadorDestinoSeleccionado = null;
let decoradorFlechas = null;
let lineaL2FondoPolyline = null;
let lineaTramoL2Polyline = null;
let marcadorDestinoFinalL2 = null;
let marcadorTransbordoL2 = null;

// --- Iconos ---
const iconoUsuarioGPS = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/9356/9356230.png',
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -38]
});

const iconoParadaSubida = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -30]
});

const iconoParadaBajada = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1483/1483336.png',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -30]
});

// --- Normalizar coordenadas ---
function normalizarCoordenadas(arr) {
    if (!arr || !Array.isArray(arr)) return [];
    return arr.map(c => {
        if (Array.isArray(c)) return c;
        if (c.lat !== undefined && c.lng !== undefined) return [c.lat, c.lng];
        return c;
    });
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', async () => {
    inicializarMapa();
    obtenerUbicacionUsuario();
    await cargarRecorridos();
    await cargarHorarios();
});

function volverAlInicio() {
    window.location.href = 'index.html';
}

function inicializarMapa() {
    mapa = L.map('map-principal').setView([-33.675, -65.46], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(mapa);
}

// --- Geolocalización ---
function obtenerUbicacionUsuario() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                ubicacionUsuario = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                mostrarUsuario();
            },
            err => {
                console.warn('Usando ubicación por defecto:', err.message);
                // 2. Fija tu ubicación GPS simulada en La Pedrera si falla el GPS real
                ubicacionUsuario = { lat: -33.67752238637175, lng: -65.50263612012249 };
                mostrarUsuario();
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        ubicacionUsuario = { lat: -33.67752238637175, lng: -65.50263612012249 };
        mostrarUsuario();
    }
}

function mostrarUsuario() {
    mapa.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 15);
    marcadorUsuario = L.marker([ubicacionUsuario.lat, ubicacionUsuario.lng], { icon: iconoUsuarioGPS })
        .addTo(mapa).bindPopup('Tu posición GPS actual').openPopup();
    L.circle([ubicacionUsuario.lat, ubicacionUsuario.lng], {
        radius: 60, color: '#7c3aed', fillColor: '#8b5cf6', fillOpacity: 0.2
    }).addTo(mapa);
}

// --- Cargar datos ---
async function cargarRecorridos() {
    try {
        const [dataA, dataE, dataEste, dataOeste] = await Promise.all([
            fetch('datos/coordenadas/paradas_secundarias_Linea_A.json').then(r => r.json()).catch(() => null),
            fetch('datos/coordenadas/paradas_secundarias_Linea_E.json').then(r => r.json()).catch(() => null),
            fetch('datos/coordenadas/paradas_secundarias_Linea_Este.json').then(r => r.json()).catch(() => null),
            fetch('datos/coordenadas/paradas_secundarias_Linea_Oeste.json').then(r => r.json()).catch(() => null)
        ]);

        datosLineasCargados = {
            lineaa: dataA ? { nombre: 'Línea A', key: 'lineaa', paradas: dataA.paradas || [], recorrido: normalizarCoordenadas(dataA.recorrido && dataA.recorrido.coordenadas ? dataA.recorrido.coordenadas : (dataA.paradas || []).map(p => [p.lat, p.lng])) } : null,
            lineae: dataE ? { nombre: 'Línea E', key: 'lineae', paradas: dataE.paradas || [], recorrido: normalizarCoordenadas(dataE.recorrido && dataE.recorrido.coordenadas ? dataE.recorrido.coordenadas : (dataE.paradas || []).map(p => [p.lat, p.lng])) } : null,
            lineaeste: dataEste ? { nombre: 'Línea Este', key: 'lineaeste', paradas: dataEste.paradas || [], recorrido: normalizarCoordenadas(dataEste.recorrido && dataEste.recorrido.coordenadas ? dataEste.recorrido.coordenadas : dataEste.recorrido || []) } : null,
            lineaoeste: dataOeste ? { nombre: 'Línea Oeste', key: 'lineaoeste', paradas: dataOeste.paradas || [], recorrido: normalizarCoordenadas(dataOeste.recorrido && dataOeste.recorrido.coordenadas ? dataOeste.recorrido.coordenadas : (dataOeste.paradas || []).map(p => [p.lat, p.lng])) } : null
        };
    } catch (e) { console.error('Error al cargar coordenadas:', e); }
}

async function cargarHorarios() {
    try {
        const [horA, horE, horEste, horOeste] = await Promise.all([
            fetch('datos/linea_a_horarios.json').then(r => r.json()).catch(() => null),
            fetch('datos/linea_e_horarios.json').then(r => r.json()).catch(() => null),
            fetch('datos/linea_este_horarios.json').then(r => r.json()).catch(() => null),
            fetch('datos/linea_oeste_horarios.json').then(r => r.json()).catch(() => null)
        ]);
        horariosLineasCargados = { lineaa: horA, lineae: horE, lineaeste: horEste, lineaoeste: horOeste };
    } catch (e) { console.error('Error al cargar horarios:', e); }
}

// --- Utilidades de tiempo ---
function obtenerMinutosDesdeCadena(cadena) {
    if (!cadena) return null;
    const [h, m] = cadena.split(':').map(Number);
    return h * 60 + m;
}

function convertirMinutosAHora(minutos) {
    const total = ((minutos % 1440) + 1440) % 1440;
    const h = Math.floor(total / 60).toString().padStart(2, '0');
    const m = Math.floor(total % 60).toString().padStart(2, '0');
    return h + ':' + m;
}

function calcularHorarioEstimadoParada(keyLinea, indiceParada, minutosActuales) {
    const horarios = horariosLineasCargados[keyLinea];
    const paradas = recorridoActual.paradas;
    const parada = paradas[indiceParada];
    if (!parada) return null;

    if (horarios && horarios.horarios_fijos && horarios.horarios_fijos[parada.nombre]) {
        const horas = horarios.horarios_fijos[parada.nombre].map(obtenerMinutosDesdeCadena).sort((a, b) => a - b);
        const siguiente = horas.find(h => h >= minutosActuales) || horas[0];
        return { horaEstimadaStr: convertirMinutosAHora(siguiente), minutosLlegada: siguiente, esInterpolado: false, referenciaAnterior: null, referenciaSiguiente: null };
    }

    let idxAnterior = -1, idxSiguiente = -1;
    for (let i = indiceParada - 1; i >= 0; i--) { if (horarios && horarios.horarios_fijos && horarios.horarios_fijos[paradas[i].nombre]) { idxAnterior = i; break; } }
    for (let i = indiceParada + 1; i < paradas.length; i++) { if (horarios && horarios.horarios_fijos && horarios.horarios_fijos[paradas[i].nombre]) { idxSiguiente = i; break; } }

    if (idxAnterior === -1 || idxSiguiente === -1) {
        let distancia = 0;
        const inicio = idxAnterior !== -1 ? idxAnterior : 0;
        for (let i = inicio; i < indiceParada; i++) distancia += calcularDistancia([paradas[i].lat, paradas[i].lng], [paradas[i + 1].lat, paradas[i + 1].lng]);
        const horaEstimada = minutosActuales + Math.round(distancia / 20 * 60);
        return { horaEstimadaStr: convertirMinutosAHora(horaEstimada), minutosLlegada: horaEstimada, esInterpolado: true, referenciaAnterior: paradas[inicio].nombre, referenciaSiguiente: 'fin de línea' };
    }

    let distanciaTotal = 0, distanciaHastaParada = 0;
    for (let i = idxAnterior; i < idxSiguiente; i++) distanciaTotal += calcularDistancia([paradas[i].lat, paradas[i].lng], [paradas[i + 1].lat, paradas[i + 1].lng]);
    for (let i = idxAnterior; i < indiceParada; i++) distanciaHastaParada += calcularDistancia([paradas[i].lat, paradas[i].lng], [paradas[i + 1].lat, paradas[i + 1].lng]);

    const horasA = horarios.horarios_fijos[paradas[idxAnterior].nombre].map(obtenerMinutosDesdeCadena).sort((a, b) => a - b);
    const horasB = horarios.horarios_fijos[paradas[idxSiguiente].nombre].map(obtenerMinutosDesdeCadena).sort((a, b) => a - b);
    let horaA = horasA.find(h => h >= minutosActuales) || horasA[0];
    let horaB = horasB.find(h => h > horaA) || horaA + 20;

    const fraccion = distanciaTotal > 0 ? distanciaHastaParada / distanciaTotal : 0;
    const horaEstimada = Math.round(horaA + (horaB - horaA) * fraccion);

    return { horaEstimadaStr: convertirMinutosAHora(horaEstimada), minutosLlegada: horaEstimada, esInterpolado: true, referenciaAnterior: paradas[idxAnterior].nombre, referenciaSiguiente: paradas[idxSiguiente].nombre };
}

// --- Interacción con el UI ---
function alCambiarLinea(valorLinea) {
    let selDestino = document.getElementById('select-destino');
    let selOrigen = document.getElementById('select-origen');

    selDestino.innerHTML = '<option value="" disabled selected>-- 2. Seleccioná a dónde querés llegar --</option>';
    if (selOrigen) { selOrigen.innerHTML = '<option value="" disabled selected>-- 3. Seleccioná la parada de partida --</option>'; selOrigen.disabled = true; }

    limpiarMapa();
    recorridoActual = datosLineasCargados[valorLinea];

    if (!recorridoActual || !recorridoActual.paradas.length) { alert('Datos no disponibles.'); selDestino.disabled = true; return; }

    dibujarRecorridoColectivo(recorridoActual.recorrido);
    dibujarRecorridoColectivo(recorridoActual.recorrido);
    
    // Activa los colectivos asumiendo la hora actual
    activarRastreoColectivos();

    recorridoActual.paradas.forEach((parada, idx) => {
        let opt = document.createElement('option');
        opt.value = idx; opt.textContent = ' ' + parada.nombre;
        selDestino.appendChild(opt);
    });
    selDestino.disabled = false;
    document.getElementById('resumen-viaje').innerHTML = '<div class="paso-itinerario"><p>Paso 1: Seleccioná destino.</p></div>';
}

let sugerenciaTemporal = null;
function alSeleccionarDestino() {
    let idxDestino = Number(document.getElementById('select-destino').value);
    if (isNaN(idxDestino)) return;
    const cercana = buscarParadaMasCercana(recorridoActual.paradas);
    sugerenciaTemporal = { idxDestino: idxDestino, cercana: cercana };
    document.getElementById('modal-sugerencia-parada').classList.remove('hidden');
}

function procesarRespuestaSugerencia(confirmar) {
    document.getElementById('modal-sugerencia-parada').classList.add('hidden');
    if (!sugerenciaTemporal) return;

    const { idxDestino, cercana } = sugerenciaTemporal;
    let selOrigen = document.getElementById('select-origen');

    if (selOrigen) {
        selOrigen.innerHTML = '<option value="" disabled>-- Seleccioná la parada de partida --</option>';
        recorridoActual.paradas.forEach((parada, idx) => {
            if (idx < idxDestino) {
                let opt = document.createElement('option');
                opt.value = idx; opt.textContent = ' ' + parada.nombre;
                if (confirmar && idx === cercana.index) opt.selected = true;
                selOrigen.appendChild(opt);
            }
        });
        selOrigen.disabled = false;
    }

    if (confirmar) {
        recorridoActual.origenIndex = cercana.index;
        recorridoActual.origenParada = cercana.parada;
        recorridoActual.distanciaAPieKm = cercana.distanciaKm;
        trazarRutaAPie(ubicacionUsuario, [recorridoActual.origenParada.lat, recorridoActual.origenParada.lng]);
        calcularRutaYTiempo();
    }
    sugerenciaTemporal = null;
}

function cerrarModalSugerencia(e) { if (e.target.id === 'modal-sugerencia-parada') procesarRespuestaSugerencia(false); }

function alSeleccionarOrigen() {
    let idx = Number(document.getElementById('select-origen').value);
    if (isNaN(idx)) return;
    recorridoActual.origenIndex = idx;
    recorridoActual.origenParada = recorridoActual.paradas[idx];
    recorridoActual.distanciaAPieKm = calcularDistancia([ubicacionUsuario.lat, ubicacionUsuario.lng], [recorridoActual.origenParada.lat, recorridoActual.origenParada.lng]);
    trazarRutaAPie(ubicacionUsuario, [recorridoActual.origenParada.lat, recorridoActual.origenParada.lng]);
    calcularRutaYTiempo();
}

// --- Dibujo de Mapas ---
function dibujarRecorridoColectivo(recorrido) {
    lineaPolyline = L.polyline(recorrido, { color: '#2563eb', weight: 5, opacity: 0.7 }).addTo(mapa);
    if (recorrido.length > 0) mapa.fitBounds(lineaPolyline.getBounds());

    const minutosAhora = new Date().getHours() * 60 + new Date().getMinutes();
    recorridoActual.paradas.forEach((parada, index) => {
        let marker = L.circleMarker([parada.lat, parada.lng], { radius: 6, color: '#1e3a8a', fillColor: '#3b82f6', fillOpacity: 0.8 }).addTo(mapa);
        marker.on('click', () => {
            const horario = calcularHorarioEstimadoParada(recorridoActual.key, index, minutosAhora);
            let infoHtml = horario ? '<br><small>' + (horario.esInterpolado ? 'Horario estimado' : 'Horario programado') + '</small>' : '<br><i>No hay horarios.</i>';
            marker.bindPopup('<div style="text-align: center;"><b> Parada:</b> ' + parada.nombre + infoHtml + '</div>').openPopup();
        });
        marcadoresParadas.push(marker);
    });
}

function proyectarPuntoEnSegmento(p, a, b) {
    const l2 = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    if (l2 === 0) return a;
    let t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2));
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

function obtenerProyeccionEnRecorrido(recorridoCoords, puntoParada) {
    let menorDistancia = Infinity, mejorPunto = puntoParada, indiceSegmento = 0;
    for (let i = 0; i < recorridoCoords.length - 1; i++) {
        const proyectado = proyectarPuntoEnSegmento(puntoParada, recorridoCoords[i], recorridoCoords[i + 1]);
        const dist = calcularDistancia(puntoParada, proyectado);
        if (dist < menorDistancia) { menorDistancia = dist; mejorPunto = proyectado; indiceSegmento = i; }
    }
    return { puntoProyectado: mejorPunto, indiceSegmento: indiceSegmento };
}

function calcularRutaYTiempo() {
    if (!ubicacionUsuario || !recorridoActual) return;
    let origenParada = recorridoActual.origenParada;
    let destinoParada = recorridoActual.paradas[Number(document.getElementById('select-destino').value)];
    if (!origenParada || !destinoParada) return;

    if (marcadorOrigenSugerido) mapa.removeLayer(marcadorOrigenSugerido);
    if (marcadorDestinoSeleccionado) mapa.removeLayer(marcadorDestinoSeleccionado);
    if (lineaTramoPolyline) { mapa.removeLayer(lineaTramoPolyline); lineaTramoPolyline = null; }

    marcadorOrigenSugerido = L.marker([origenParada.lat, origenParada.lng], { icon: iconoParadaSubida }).addTo(mapa).bindPopup('Subida');
    marcadorDestinoSeleccionado = L.marker([destinoParada.lat, destinoParada.lng], { icon: iconoParadaBajada }).addTo(mapa).bindPopup('Bajada');

    const proyOrigen = obtenerProyeccionEnRecorrido(recorridoActual.recorrido, [origenParada.lat, origenParada.lng]);
    const proyDestino = obtenerProyeccionEnRecorrido(recorridoActual.recorrido, [destinoParada.lat, destinoParada.lng]);

    let tramoCoords = [proyOrigen.puntoProyectado];
    if (proyOrigen.indiceSegmento <= proyDestino.indiceSegmento) {
        for (let i = proyOrigen.indiceSegmento + 1; i <= proyDestino.indiceSegmento; i++) tramoCoords.push(recorridoActual.recorrido[i]);
    } else {
        for (let i = proyOrigen.indiceSegmento + 1; i < recorridoActual.recorrido.length; i++) tramoCoords.push(recorridoActual.recorrido[i]);
        for (let i = 0; i <= proyDestino.indiceSegmento; i++) tramoCoords.push(recorridoActual.recorrido[i]);
    }
    tramoCoords.push(proyDestino.puntoProyectado);

    lineaTramoPolyline = L.polyline(tramoCoords, { color: '#f97316', weight: 6, opacity: 0.9 }).addTo(mapa);
    mapa.fitBounds(lineaTramoPolyline.getBounds(), { padding: [50, 50] });

    let distanciaTramo = 0;
    for (let i = 0; i < tramoCoords.length - 1; i++) distanciaTramo += calcularDistancia(tramoCoords[i], tramoCoords[i + 1]);

    let minCamina = Math.max(1, Math.round(recorridoActual.distanciaAPieKm / 5 * 60));
    let minColectivo = Math.max(2, Math.round(distanciaTramo / 18 * 60));
    const minutosAhora = new Date().getHours() * 60 + new Date().getMinutes();    
    const horarioOrigen = calcularHorarioEstimadoParada(recorridoActual.key, recorridoActual.origenIndex, minutosAhora);

    let minEspera = horarioOrigen ? Math.max(0, horarioOrigen.minutosLlegada - minutosAhora) : 0;
    let tiempoTotal = minCamina + minEspera + minColectivo;

    document.getElementById('resumen-viaje').innerHTML =
        '<div class="paso-itinerario"><p>1. A pie: Camina ~' + minCamina + ' min hacia <b>' + origenParada.nombre + '</b>.</p></div>' +
        '<div class="paso-itinerario"><p>2. Colectivo: ~' + minColectivo + ' min.</p></div>' +
        '<div class="paso-itinerario"><p>3. Destino: Bajate en <b>' + destinoParada.nombre + '</b>.</p></div>' +
        '<p>Tiempo total estimado: ~' + tiempoTotal + ' min.</p>';
}

function trazarRutaAPie(desde, hasta) {
    if (routingControlPie) mapa.removeControl(routingControlPie);
    routingControlPie = L.Routing.control({
        waypoints: [L.latLng(desde.lat, desde.lng), L.latLng(hasta[0], hasta[1])],
        router: L.Routing.osrmv1({ serviceUrl: 'https://routing.openstreetmap.de/routed-foot/route/v1', profile: 'foot' }),
        show: false, addWaypoints: false, draggableWaypoints: false, createMarker: () => null,
        lineOptions: { styles: [{ color: '#8b5cf6', weight: 6, dashArray: '8, 8', opacity: 0.9 }] }
    }).addTo(mapa);
}

function buscarParadaMasCercana(paradas) {
    let mejor = null, mejorIdx = -1, menorDist = Infinity;
    paradas.forEach((parada, idx) => {
        let d = calcularDistancia([ubicacionUsuario.lat, ubicacionUsuario.lng], [parada.lat, parada.lng]);
        if (d < menorDist) { menorDist = d; mejor = parada; mejorIdx = idx; }
    });
    return { parada: mejor, index: mejorIdx, distanciaKm: menorDist };
}

function calcularDistancia(p1, p2) {
    const R = 6371, dLat = (p2[0] - p1[0]) * Math.PI / 180, dLng = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function limpiarMapa() {
    if (bucleSimulacion) clearInterval(bucleSimulacion);
    marcadoresParadas.forEach(m => mapa.removeLayer(m)); marcadoresParadas = [];
    marcadoresColectivos.forEach(m => mapa.removeLayer(m)); marcadoresColectivos = [];
    
    if (lineaPolyline) { mapa.removeLayer(lineaPolyline); lineaPolyline = null; }
    if (lineaTramoPolyline) { mapa.removeLayer(lineaTramoPolyline); lineaTramoPolyline = null; }
    if (decoradorFlechas) { mapa.removeLayer(decoradorFlechas); decoradorFlechas = null; }
    if (routingControlPie) { mapa.removeControl(routingControlPie); routingControlPie = null; }
    if (marcadorOrigenSugerido) { mapa.removeLayer(marcadorOrigenSugerido); marcadorOrigenSugerido = null; }
    if (marcadorDestinoSeleccionado) { mapa.removeLayer(marcadorDestinoSeleccionado); marcadorDestinoSeleccionado = null; }
    
    // --- BORRAR LOS RASTROS DE LA LÍNEA 2 (Transbordo) ---
    if (lineaL2FondoPolyline) { mapa.removeLayer(lineaL2FondoPolyline); lineaL2FondoPolyline = null; }
    if (lineaTramoL2Polyline) { mapa.removeLayer(lineaTramoL2Polyline); lineaTramoL2Polyline = null; }
    if (marcadorDestinoFinalL2) { mapa.removeLayer(marcadorDestinoFinalL2); marcadorDestinoFinalL2 = null; }
    if (marcadorTransbordoL2) { mapa.removeLayer(marcadorTransbordoL2); marcadorTransbordoL2 = null; }
}

// =====================================================
// BUSCADOR INTELIGENTE (Nominatim / OpenStreetMap Gratis)
// =====================================================

let temporizadorBusqueda = null;

function ejecutarBusquedaEnTiempoReal() {
    clearTimeout(temporizadorBusqueda);
    const terminoInput = document.getElementById('buscador-lugares').value.trim();
    if (terminoInput.length < 3) { document.getElementById('resultados-busqueda').innerHTML = ''; return; }
    document.getElementById('resultados-busqueda').innerHTML = '<li style="padding: 10px; color: #666;">Buscando opciones...</li>';
    // Aumentamos a 800ms para cuidar los límites del servidor gratuito de Nominatim
    temporizadorBusqueda = setTimeout(() => { ejecutarBusqueda(); }, 800); 
}

function normalizarTexto(texto) { return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function calcularDistanciaLetras(a, b) {
    if(a.length === 0) return b.length; if(b.length === 0) return a.length;
    let matriz = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for(let i = 0; i <= a.length; i++) matriz[0][i] = i; for(let j = 0; j <= b.length; j++) matriz[j][0] = j;
    for(let j = 1; j <= b.length; j++) {
        for(let i = 1; i <= a.length; i++) {
            let indicadorSust = a[i-1] === b[j-1] ? 0 : 1;
            matriz[j][i] = Math.min(matriz[j][i-1] + 1, matriz[j-1][i] + 1, matriz[j-1][i-1] + indicadorSust);
        }
    }
    return matriz[b.length][a.length];
}

function coincideConErrores(textoOriginal, busqueda) {
    const texto = normalizarTexto(textoOriginal), term = normalizarTexto(busqueda);
    if (texto.includes(term)) return true;
    const palabrasTexto = texto.split(/\s+/), palabrasBusqueda = term.split(/\s+/);
    return palabrasBusqueda.every(pB => palabrasTexto.some(pT => {
        if (pT.includes(pB)) return true;
        return calcularDistanciaLetras(pB, pT) <= (pB.length <= 4 ? 1 : 2);
    }));
}

async function ejecutarBusqueda() {
    const terminoInput = document.getElementById('buscador-lugares').value.trim();
    const contenedorResultados = document.getElementById('resultados-busqueda');
    if (!terminoInput) { contenedorResultados.innerHTML = ''; return; }

    const paradasEncontradas = [];
    for (const keyLinea in datosLineasCargados) {
        const linea = datosLineasCargados[keyLinea];
        if (!linea) continue;
        linea.paradas.forEach((parada, index) => {
            if (coincideConErrores(parada.nombre, terminoInput) && !paradasEncontradas.some(p => p.parada.nombre === parada.nombre)) {
                paradasEncontradas.push({ lineaKey: keyLinea, nombreLinea: linea.nombre, parada: parada, index: index });
            }
        });
    }

    let lugaresEncontrados = [];
    try {
        // Agregamos Villa Mercedes y restringimos a Argentina (countrycodes=ar) para precisión
        const queryFormateada = encodeURIComponent(terminoInput + ', Villa Mercedes, San Luis');
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${queryFormateada}&countrycodes=ar&limit=5`;
        const response = await fetch(url);
        lugaresEncontrados = await response.json();
    } catch (e) { console.error('Error Nominatim:', e); }

    contenedorResultados.innerHTML = '';

    if (paradasEncontradas.length > 0) {
        const titulo = document.createElement('li');
        titulo.innerHTML = '<strong style="display:block; padding: 5px 10px; background:#f1f5f9; color:#475569; font-size: 0.8rem;">🚏 PARADAS SUGERIDAS</strong>';
        contenedorResultados.appendChild(titulo);

        paradasEncontradas.slice(0, 4).forEach(item => {
            const li = document.createElement('li');
            li.style = 'padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; display:flex; flex-direction:column; background: white;';
            li.onmouseover = () => li.style.background = '#f8fafc'; li.onmouseout = () => li.style.background = 'white';
            li.innerHTML = `<span><b>${item.parada.nombre}</b></span><small style="color:#2563eb;">Línea sugerida: ${item.nombreLinea}</small>`;
            li.onclick = () => seleccionarDestinoDesdeBuscador(item.lineaKey, item.index, item.parada, true);
            contenedorResultados.appendChild(li);
        });
    }

    if (lugaresEncontrados.length > 0) {
        const tituloLugares = document.createElement('li');
        tituloLugares.innerHTML = '<strong style="display:block; padding: 5px 10px; background:#f1f5f9; color:#475569; font-size: 0.8rem;">📍 LOCALES Y DIRECCIONES</strong>';
        contenedorResultados.appendChild(tituloLugares);

        lugaresEncontrados.forEach(lugar => {
            const nombreCorto = lugar.display_name.split(',')[0]; 
            const descripcion = lugar.display_name.split(',').slice(1,3).join(','); 
            const li = document.createElement('li');
            li.style = 'padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; background: white;';
            li.onmouseover = () => li.style.background = '#f8fafc'; li.onmouseout = () => li.style.background = 'white';
            li.innerHTML = `<b>${nombreCorto}</b> <br><small style="color:#64748b;">${descripcion}</small>`;
            
            // Nominatim ya nos da la Latitud y Longitud, las enviamos directo al cálculo
            li.onclick = () => encontrarViajeMasOptimo(parseFloat(lugar.lat), parseFloat(lugar.lon), nombreCorto); 
            contenedorResultados.appendChild(li);
        });
    }

    if (paradasEncontradas.length === 0 && lugaresEncontrados.length === 0) {
        contenedorResultados.innerHTML = '<li style="padding: 10px; color: #ef4444;">No encontramos coincidencias.</li>';
    }
}

function seleccionarDestinoDesdeBuscador(lineaKey, paradaIndex, parada, limpiarInput) {
    if (limpiarInput) {
        document.getElementById('resultados-busqueda').innerHTML = '';
        document.getElementById('buscador-lugares').value = parada.nombre;
    }
    document.getElementById('select-linea').value = lineaKey;
    alCambiarLinea(lineaKey); 
    setTimeout(() => { document.getElementById('select-destino').value = paradaIndex; alSeleccionarDestino(); }, 150);
}

document.addEventListener('click', function(e) { if(!e.target.closest('.grupo-control')) document.getElementById('resultados-busqueda').innerHTML = ''; });

// ==========================================
// ALGORITMO DE RUTA ÓPTIMA
// ==========================================


// ==========================================
// ALGORITMO DE RUTA ÓPTIMA
// ==========================================

function encontrarViajeMasOptimo(latDestino, lngDestino, nombreLugar) {
    document.getElementById('resultados-busqueda').innerHTML = '';
    document.getElementById('buscador-lugares').value = nombreLugar;

    if (!ubicacionUsuario) { 
        alert('Activá tu GPS para calcular la mejor ruta.'); 
        return; 
    }

    limpiarMapa(); // Limpiar dibujos y recorridos previos

    // ==========================================
    // FASE 0: EVALUAR SI ESTÁ A MENOS DE 500M (IR A PIE)
    // ==========================================
    let distDirecta = calcularDistancia([ubicacionUsuario.lat, ubicacionUsuario.lng], [latDestino, lngDestino]);
    let metrosDirectos = Math.round(distDirecta * 1000);

    if (distDirecta <= 0.5) { // 500 metros o menos
        let minCaminando = Math.max(1, Math.round(((distDirecta * 1.2) / 5) * 60));

        // 1. Trazar ruta a pie directamente desde el GPS al destino
        trazarRutaAPie(ubicacionUsuario, [latDestino, lngDestino]);

        // 2. Colocar marcador en el destino
        L.marker([latDestino, lngDestino]).addTo(mapa)
            .bindPopup(`📍 <b>${nombreLugar}</b><br>🚶 ¡Estás a solo ${metrosDirectos}m! Llegás caminando en ~${minCaminando} min.`)
            .openPopup();

        // 3. Informar en el panel de itinerario
        document.getElementById('resumen-viaje').innerHTML = `
            <div class="paso-itinerario" style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 10px;">
                <p>🚶 <b>¡Destino muy cercano!</b></p>
                <p>Estás a unos <b>${metrosDirectos} metros</b> de <b>${nombreLugar}</b>.</p>
                <p>Tiempo estimado a pie: <b>~${minCaminando} min</b>.</p>
            </div>
            <p style="font-size: 0.85rem; color: #64748b; margin-top: 5px;">No hace falta tomar colectivo para esta distancia.</p>
        `;

        mapa.setView([latDestino, lngDestino], 16);
        return; // Finaliza la función sin buscar ni dibujar colectivos
    }

    // ==========================================
    // FASE 1: BUSCAR VIAJES DIRECTOS
    // ==========================================
    let mejorViaje = null;
    let mejorPuntajeTotal = Infinity;
    const minutosAhora = new Date().getHours() * 60 + new Date().getMinutes();

    for (const keyLinea in datosLineasCargados) {
        const linea = datosLineasCargados[keyLinea];
        if (!linea || !linea.paradas || linea.paradas.length === 0) continue;

        let origenCercano = null, minDistOrigen = Infinity;
        linea.paradas.forEach((parada, idx) => {
            let d = calcularDistancia([ubicacionUsuario.lat, ubicacionUsuario.lng], [parada.lat, parada.lng]);
            if (d < minDistOrigen) { minDistOrigen = d; origenCercano = { parada, idx, dist: d }; }
        });

        let destinoCercano = null, minDistDestino = Infinity;
        linea.paradas.forEach((parada, idx) => {
            if (origenCercano && idx > origenCercano.idx) {
                let d = calcularDistancia([latDestino, lngDestino], [parada.lat, parada.lng]);
                if (d < minDistDestino) { minDistDestino = d; destinoCercano = { parada, idx, dist: d }; }
            }
        });

        if (!origenCercano || !destinoCercano) continue;

        let minCaminaOrigen = Math.max(1, Math.round((origenCercano.dist) / 5 * 60)); 
        let minCaminaDestino = Math.max(1, Math.round((destinoCercano.dist) / 5 * 60)); 

        let lineaOriginal = recorridoActual;
        recorridoActual = linea; 
        let horarioOrigen = calcularHorarioEstimadoParada(keyLinea, origenCercano.idx, minutosAhora);
        recorridoActual = lineaOriginal; 

        let minEspera = horarioOrigen ? Math.max(0, horarioOrigen.minutosLlegada - minutosAhora) : 5; 
        
        let distanciaBus = 0;
        for (let i = origenCercano.idx; i < destinoCercano.idx; i++) {
            distanciaBus += calcularDistancia([linea.paradas[i].lat, linea.paradas[i].lng], [linea.paradas[i+1].lat, linea.paradas[i+1].lng]);
        }
        let minColectivo = Math.max(2, Math.round(distanciaBus / 18 * 60)); 

        let tiempoReal = minCaminaOrigen + minEspera + minColectivo + minCaminaDestino;
        let puntajeAlgoritmo = (minCaminaOrigen * 3) + minEspera + minColectivo + (minCaminaDestino * 1.5);

        if (puntajeAlgoritmo < mejorPuntajeTotal) {
            mejorPuntajeTotal = puntajeAlgoritmo;
            mejorViaje = {
                tipo: 'directo',
                lineaKey: keyLinea, nombreLinea: linea.nombre,
                origen: origenCercano, destino: destinoCercano,
                tiempoTotal: tiempoReal, 
                metrosDestino: Math.round(destinoCercano.dist * 1000)
            };
        }
    }

    // ==========================================
    // FASE 2: BUSCAR VIAJES CON ESCALA MÁS CORTA
    // ==========================================
    let buscarEscalas = true;
    if (mejorViaje && mejorViaje.metrosDestino <= 1200) {
        buscarEscalas = false;
    }

    if (buscarEscalas) {
        let penalizacionTransbordo = mejorViaje ? 15 : 0; 

        for (const keyL1 in datosLineasCargados) {
            for (const keyL2 in datosLineasCargados) {
                if (keyL1 === keyL2) continue; 
                
                const L1 = datosLineasCargados[keyL1];
                const L2 = datosLineasCargados[keyL2];
                if (!L1 || !L2 || !L1.paradas.length || !L2.paradas.length) continue;

                let origenL1 = null, minD1 = Infinity;
                L1.paradas.forEach((p, idx) => {
                    let d = calcularDistancia([ubicacionUsuario.lat, ubicacionUsuario.lng], [p.lat, p.lng]);
                    if (d < minD1) { minD1 = d; origenL1 = { parada: p, idx: idx, dist: d }; }
                });

                let destinoL2 = null, minD2 = Infinity;
                L2.paradas.forEach((p, idx) => {
                    let d = calcularDistancia([latDestino, lngDestino], [p.lat, p.lng]);
                    if (d < minD2) { minD2 = d; destinoL2 = { parada: p, idx: idx, dist: d }; }
                });

                if (!origenL1 || !destinoL2) continue;

                for (let i = origenL1.idx + 1; i < L1.paradas.length; i++) {
                    for (let j = 0; j < destinoL2.idx; j++) {
                        let distInterseccion = calcularDistancia([L1.paradas[i].lat, L1.paradas[i].lng], [L2.paradas[j].lat, L2.paradas[j].lng]);
                        
                        // Máximo 0.15 km (~150m) entre paradas de transbordo
                        if (distInterseccion <= 0.15) { 
                            let minCaminaInicio = Math.round((origenL1.dist) / 5 * 60);
                            let minEspera1 = 5; 
                            let cantParadasL1 = i - origenL1.idx;
                            let minBus1 = Math.round((calcularDistancia([origenL1.parada.lat, origenL1.parada.lng], [L1.paradas[i].lat, L1.paradas[i].lng])) / 18 * 60);
                            
                            let minCaminaEscala = Math.max(1, Math.round(distInterseccion / 5 * 60));
                            let minEspera2 = 5;
                            let cantParadasL2 = destinoL2.idx - j;
                            let minBus2 = Math.round((calcularDistancia([L2.paradas[j].lat, L2.paradas[j].lng], [destinoL2.parada.lat, destinoL2.parada.lng])) / 18 * 60);
                            
                            let minCaminaFin = Math.round((destinoL2.dist) / 5 * 60);

                            let tiempoRealTransbordo = minCaminaInicio + minEspera1 + minBus1 + minCaminaEscala + minEspera2 + minBus2 + minCaminaFin;
                            let puntajeTransbordo = (minCaminaInicio * 2) + minBus1 + (cantParadasL1 * 1.5) + (minCaminaEscala * 3) + minBus2 + (cantParadasL2 * 1.5) + (minCaminaFin * 2);

                            if (puntajeTransbordo + penalizacionTransbordo < mejorPuntajeTotal) {
                                mejorPuntajeTotal = puntajeTransbordo + penalizacionTransbordo;
                                mejorViaje = {
                                    tipo: 'transbordo',
                                    L1: { key: keyL1, nombre: L1.nombre, origen: origenL1, bajada: { parada: L1.paradas[i], idx: i } },
                                    L2: { key: keyL2, nombre: L2.nombre, subida: { parada: L2.paradas[j], idx: j }, destino: destinoL2 },
                                    distEscala: Math.round(distInterseccion * 1000),
                                    tiempoTotal: tiempoRealTransbordo, 
                                    metrosDestino: Math.round(destinoL2.dist * 1000)
                                };
                            }
                        }
                    }
                }
            }
        }
    }

    // ==========================================
    // FASE 3: APLICAR RESULTADOS EN INTERFAZ
    // ==========================================
    if (mejorViaje) {

        if (mejorViaje.tipo === 'directo') {
            document.getElementById('select-linea').value = mejorViaje.lineaKey;
            alCambiarLinea(mejorViaje.lineaKey); 

            setTimeout(() => {
                document.getElementById('select-destino').value = mejorViaje.destino.idx;
                sugerenciaTemporal = { idxDestino: mejorViaje.destino.idx, cercana: { parada: mejorViaje.origen.parada, index: mejorViaje.origen.idx, distanciaKm: mejorViaje.origen.dist } };
                procesarRespuestaSugerencia(true); 
                
                L.marker([latDestino, lngDestino]).addTo(mapa)
                    .bindPopup(`📍 <b>Destino:</b> ${nombreLugar}<br>🏆 <b>Directo:</b> ${mejorViaje.tiempoTotal} min.<br>🚶 Caminás ${mejorViaje.metrosDestino}m al bajar.`)
                    .openPopup();
            }, 150);

        } else if (mejorViaje.tipo === 'transbordo') {
            document.getElementById('select-linea').value = mejorViaje.L1.key;
            alCambiarLinea(mejorViaje.L1.key);
            
            setTimeout(() => {
                document.getElementById('select-destino').value = mejorViaje.L1.bajada.idx;
                sugerenciaTemporal = { idxDestino: mejorViaje.L1.bajada.idx, cercana: { parada: mejorViaje.L1.origen.parada, index: mejorViaje.L1.origen.idx, distanciaKm: mejorViaje.L1.origen.dist } };
                procesarRespuestaSugerencia(true); 

                document.getElementById('resumen-viaje').innerHTML = `
                    <div class="paso-itinerario"><p>1. 🚶 Camina hacia <b>${mejorViaje.L1.origen.parada.nombre}</b>.</p></div>
                    <div class="paso-itinerario"><p>2. 🚌 Toma la <b>${mejorViaje.L1.nombre}</b> y bajate en <b>${mejorViaje.L1.bajada.parada.nombre}</b>.</p></div>
                    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 8px; margin: 5px 0; border-radius: 4px; font-size: 0.9rem;">
                        🔄 <b>ESCALA:</b> Caminá ${mejorViaje.distEscala} metros hacia la parada <b>${mejorViaje.L2.subida.parada.nombre}</b>.
                    </div>
                    <div class="paso-itinerario"><p>3. 🚌 Tomá la <b style="color:#ef4444;">${mejorViaje.L2.nombre}</b> y bajate en <b>${mejorViaje.L2.destino.parada.nombre}</b>.</p></div>
                    <div class="paso-itinerario"><p>4. 📍 Caminá ${mejorViaje.metrosDestino}m hasta tu destino final.</p></div>
                    <p style="font-weight: bold; color: #2e7d32;">Tiempo total (Escala incl.): ~${mejorViaje.tiempoTotal} min.</p>
                `;

                // TRAMO DE RUTA DE L2
                let datosL2 = datosLineasCargados[mejorViaje.L2.key];
                let recorridoL2 = datosL2.recorrido;
                let proyOrigenL2 = obtenerProyeccionEnRecorrido(recorridoL2, [mejorViaje.L2.subida.parada.lat, mejorViaje.L2.subida.parada.lng]);
                let proyDestinoL2 = obtenerProyeccionEnRecorrido(recorridoL2, [mejorViaje.L2.destino.parada.lat, mejorViaje.L2.destino.parada.lng]);

                let tramoCoordsL2 = [];
                if (proyOrigenL2.indiceSegmento <= proyDestinoL2.indiceSegmento) {
                    tramoCoordsL2.push(proyOrigenL2.puntoProyectado);
                    for (let i = proyOrigenL2.indiceSegmento + 1; i <= proyDestinoL2.indiceSegmento; i++) tramoCoordsL2.push(recorridoL2[i]);
                    tramoCoordsL2.push(proyDestinoL2.puntoProyectado);
                } else {
                    tramoCoordsL2.push(proyOrigenL2.puntoProyectado);
                    for (let i = proyOrigenL2.indiceSegmento + 1; i < recorridoL2.length; i++) tramoCoordsL2.push(recorridoL2[i]);
                    for (let i = 0; i <= proyDestinoL2.indiceSegmento; i++) tramoCoordsL2.push(recorridoL2[i]);
                    tramoCoordsL2.push(proyDestinoL2.puntoProyectado);
                }

                lineaTramoL2Polyline = L.polyline(tramoCoordsL2, { color: '#ef4444', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(mapa);

                // PARADAS SOLO DEL TRAMO DE L2
                const minutosAhoraL2 = new Date().getHours() * 60 + new Date().getMinutes();
                const idxInicioL2 = mejorViaje.L2.subida.idx;
                const idxFinL2 = mejorViaje.L2.destino.idx;

                datosL2.paradas.forEach((parada, index) => {
                    let enTramo = (idxInicioL2 <= idxFinL2) 
                        ? (index >= idxInicioL2 && index <= idxFinL2)
                        : (index >= idxInicioL2 || index <= idxFinL2);

                    if (enTramo) {
                        let marker = L.circleMarker([parada.lat, parada.lng], { 
                            radius: 6, 
                            color: '#991b1b', 
                            fillColor: '#ef4444', 
                            fillOpacity: 0.8 
                        }).addTo(mapa);

                        marker.on('click', () => {
                            let lineaOriginal = recorridoActual;
                            recorridoActual = datosL2;
                            const horario = calcularHorarioEstimadoParada(datosL2.key, index, minutosAhoraL2);
                            recorridoActual = lineaOriginal;

                            let infoHtml = horario ? '<br><small>' + (horario.esInterpolado ? 'Horario estimado' : 'Horario programado') + '</small>' : '<br><i>No hay horarios.</i>';
                            marker.bindPopup('<div style="text-align: center;"><b>🚏 Parada (' + datosL2.nombre + '):</b> ' + parada.nombre + infoHtml + '</div>').openPopup();
                        });

                        marcadoresParadas.push(marker);
                    }
                });

                marcadorDestinoFinalL2 = L.marker([latDestino, lngDestino]).addTo(mapa).bindPopup(`📍 <b>Destino Final:</b> ${nombreLugar}`).openPopup();

                marcadorTransbordoL2 = L.marker([mejorViaje.L2.subida.parada.lat, mejorViaje.L2.subida.parada.lng], { 
                    icon: L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style='background-color:#ef4444; color:white; padding:5px 10px; border-radius:10px; font-weight:bold; font-size:12px; white-space:nowrap; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3);'>🔄 Subí a ${mejorViaje.L2.nombre}</div>`,
                        iconSize: [120, 30],
                        iconAnchor: [60, 35]
                    })
                }).addTo(mapa);

                let bounds = lineaTramoPolyline.getBounds();
                bounds.extend(lineaTramoL2Polyline.getBounds());
                mapa.fitBounds(bounds, { padding: [50, 50] });

            }, 200);
        }

    } else {
        alert('No pudimos encontrar una ruta viable hacia ese destino.');
    }
}

// =====================================================
// SIMULADOR DE COLECTIVO EN TIEMPO REAL (SEGUNDO A SEGUNDO)
// =====================================================

const iconoColectivoSimulado = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
});

let marcadoresColectivos = [];
let bucleSimulacion = null;

function activarRastreoColectivos() {
    if (bucleSimulacion) clearInterval(bucleSimulacion);
    
    // Ejecutar cada 1 segundo (1000 ms) para movimiento fluido
    actualizarPosicionColectivos();
    bucleSimulacion = setInterval(actualizarPosicionColectivos, 1000); 
}

function actualizarPosicionColectivos() {
    // 1. Limpiar colectivos anteriores
    marcadoresColectivos.forEach(m => mapa.removeLayer(m));
    marcadoresColectivos = [];

    if (!recorridoActual || !recorridoActual.paradas || recorridoActual.paradas.length === 0) return;

    const horarios = horariosLineasCargados[recorridoActual.key];
    if (!horarios || !horarios.horarios_fijos) return;

    const ahora = new Date();
    // Obtener el tiempo exacto en segundos transcurridos hoy
    const segundosAhora = ahora.getHours() * 3600 + ahora.getMinutes() * 60 + ahora.getSeconds();

    const paradas = recorridoActual.paradas;
    let primeraParadaFija = paradas.find(p => horarios.horarios_fijos[p.nombre]);
    if (!primeraParadaFija) return;

    const cantidadViajes = horarios.horarios_fijos[primeraParadaFija.nombre].length;

    for (let v = 0; v < cantidadViajes; v++) {
        let tiemposViaje = [];
        
        for (let i = 0; i < paradas.length; i++) {
            if (horarios.horarios_fijos[paradas[i].nombre] && horarios.horarios_fijos[paradas[i].nombre][v]) {
                tiemposViaje.push({
                    idxParada: i,
                    nombre: paradas[i].nombre,
                    segundos: obtenerMinutosDesdeCadena(horarios.horarios_fijos[paradas[i].nombre][v]) * 60,
                    lat: paradas[i].lat,
                    lng: paradas[i].lng
                });
            }
        }

        // Evaluar tramo actual del viaje
        for (let j = 0; j < tiemposViaje.length - 1; j++) {
            let p1 = tiemposViaje[j];
            let p2 = tiemposViaje[j + 1];

            // Si la hora actual en segundos está entre p1 y p2, el colectivo está en movimiento
            if (segundosAhora >= p1.segundos && segundosAhora < p2.segundos) {
                let duracionTramo = p2.segundos - p1.segundos;
                let progreso = (segundosAhora - p1.segundos) / duracionTramo; // Porcentaje entre 0.0 y 1.0

                // Interpolación lineal de coordenadas segundo a segundo
                let latActual = p1.lat + (p2.lat - p1.lat) * progreso;
                let lngActual = p1.lng + (p2.lng - p1.lng) * progreso;

                // Dibujar en el mapa
                let marcador = L.marker([latActual, lngActual], { icon: iconoColectivoSimulado })
                    .addTo(mapa)
                    .bindPopup(`<div style="text-align:center;">🚌 <b>${recorridoActual.nombre}</b><br><small>Hacia: ${p2.nombre}</small></div>`);
                
                marcadoresColectivos.push(marcador);
            }
        }
    }

    
}

// =====================================================
// MODO MAPA EXPANDIDO / PANTALLA COMPLETA
// =====================================================

function alternarModoMapa(activar) {
    const btnExpandir = document.getElementById('btn-expandir-mapa');
    const btnVolver = document.getElementById('btn-volver-planificador');
    const panelInferior = document.getElementById('panel-instrucciones-inferior');
    const resumenInferior = document.getElementById('resumen-viaje-inferior');
    const resumenOriginal = document.getElementById('resumen-viaje');

    if (activar) {
        document.body.classList.add('modo-mapa-completo');
        btnExpandir.classList.add('hidden');
        btnVolver.classList.remove('hidden');

        // Copiar las instrucciones del panel principal al panel flotante inferior
        if (resumenOriginal && resumenInferior) {
            resumenInferior.innerHTML = resumenOriginal.innerHTML;
            if (resumenOriginal.innerHTML.trim() !== '') {
                panelInferior.classList.remove('hidden');
            }
        }
    } else {
        document.body.classList.remove('modo-mapa-completo');
        btnExpandir.classList.remove('hidden');
        btnVolver.classList.add('hidden');
        panelInferior.classList.add('hidden');
    }

    // CRÍTICO para Leaflet: reajusta el renderizado del mapa al nuevo tamaño del contenedor
    setTimeout(() => {
        if (mapa) {
            mapa.invalidateSize();
        }
    }, 200);
}

// Opcional: Sincronizar instrucciones automáticamente si se calcula la ruta estando el mapa expandido
const observadorResumen = new MutationObserver(() => {
    const resumenOriginal = document.getElementById('resumen-viaje');
    const resumenInferior = document.getElementById('resumen-viaje-inferior');
    const panelInferior = document.getElementById('panel-instrucciones-inferior');

    if (document.body.classList.contains('modo-mapa-completo') && resumenOriginal && resumenInferior) {
        resumenInferior.innerHTML = resumenOriginal.innerHTML;
        if (resumenOriginal.innerHTML.trim() !== '') {
            panelInferior.classList.remove('hidden');
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const resumenOriginal = document.getElementById('resumen-viaje');
    if (resumenOriginal) {
        observadorResumen.observe(resumenOriginal, { childList: true, subtree: true });
    }
});