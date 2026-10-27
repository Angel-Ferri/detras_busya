// =====================================================
// Busya · PARTE 5 de 8 — MAPA
// =====================================================
//
// Todo lo que dibuja y borra stuff en el mapa de Leaflet:
//   · arranque del mapa y del GPS
//   · dibujo del recorrido de la línea y de sus paradas
//   · trazado de la ruta a pie
//   · cálculo del tiempo del viaje (caminata + espera + colectivo)
//   · limpieza cuando se cambia de línea
//   · modo mapa expandido
//

/** Vuelve al inicio de la aplicación. */
function volverAlInicio() {
    window.location.href = 'index.html';
}

/**
 * Crea el mapa y le pone el fondo (local primero, luego OpenStreetMap).
 */
function inicializarMapa() {
    mapa = L.map('map-principal', { maxZoom: 19 }).setView([-33.675, -65.46], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
        maxNativeZoom: 19
    }).addTo(mapa);
}

function obtenerUbicacionUsuario() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                ubicacionUsuario = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                mostrarUsuario();
            },
            err => {
                console.warn('Usando ubicación por defecto:', err.message);
                ubicacionUsuario = { lat: -33.67451974632388, lng: -65.46229376889399 };
                mostrarUsuario();
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        ubicacionUsuario = { lat: -33.67451974632388, lng: -65.46229376889399 };
        mostrarUsuario();
    }
}

/**
 * Pone el marcador de "tu posición" y centra el mapa.
 */
function mostrarUsuario() {
    mapa.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 15);
    marcadorUsuario = L.marker([ubicacionUsuario.lat, ubicacionUsuario.lng], { icon: iconoUsuarioGPS })
        .addTo(mapa)
        .bindPopup('<div style="text-align: center;">📍 <b>Tu posición</b><br>🚶 Modo a pie</div>')
        .openPopup();

    L.circle([ubicacionUsuario.lat, ubicacionUsuario.lng], {
        radius: 60, color: '#7c3aed', fillColor: '#8b5cf6', fillOpacity: 0.2
    }).addTo(mapa);
}

/**
 * Dibuja el recorrido completo de la línea y un marcador por cada parada.
 * Al tocar una parada muestra su horario (publicado o estimado).
 */
function dibujarRecorridoColectivo(recorrido) {
    lineaPolyline = L.polyline(recorrido, { color: '#2563eb', weight: 5, opacity: 0.7 }).addTo(mapa);
    if (recorrido.length > 0) mapa.fitBounds(lineaPolyline.getBounds());

    const minutosAhora = minutosDeAhora();

    recorridoActual.paradas.forEach((parada, index) => {
        const marker = L.circleMarker([parada.lat, parada.lng], {
            radius: 6, color: '#1e3a8a', fillColor: '#3b82f6', fillOpacity: 0.8
        }).addTo(mapa);

        marker.on('click', () => {
            const horario = calcularHorarioEstimadoParada(recorridoActual.key, index, minutosAhora);
            const infoHtml = horario
                ? '<br><small>' + (horario.esInterpolado ? 'Horario estimado' : 'Horario programado') + '</small>'
                : '<br><i>No hay horarios.</i>';
            marker.bindPopup('<div style="text-align: center;"><b> Parada:</b> ' + parada.nombre + infoHtml + '</div>').openPopup();
        });

        marcadoresParadas.push(marker);
    });
}

/**
 * Dibuja el tramo que se va a viajar en colectivo (de la subida a la bajada)
 * y calcula los tiempos del viaje: caminata + espera + colectivo.
 */
function calcularRutaYTiempo() {
    if (!ubicacionUsuario || !recorridoActual) return;

    const origenParada = recorridoActual.origenParada;
    let destinoParada = recorridoActual.paradas[Number(document.getElementById('select-destino').value)];
    
    // Si hay un destino buscado por el usuario (desde el buscador inteligente), priorizar la parada más cercana a ese lugar
    if (typeof infoDestinoActual !== 'undefined' && infoDestinoActual && recorridoActual.paradas && recorridoActual.paradas.length > 0) {
        let mejorParada = null;
        let mejorIdx = -1;
        let menorDist = Infinity;
        recorridoActual.paradas.forEach((parada, idx) => {
            const d = calcularDistancia([infoDestinoActual.lat, infoDestinoActual.lng], [parada.lat, parada.lng]);
            if (d < menorDist) {
                menorDist = d;
                mejorParada = parada;
                mejorIdx = idx;
            }
        });
        if (mejorParada) {
            destinoParada = mejorParada;
            // Actualizar el select para reflejar la parada correcta
            const selDestino = document.getElementById('select-destino');
            if (selDestino) {
                selDestino.value = mejorIdx;
            }
        }
    }
    
    if (!origenParada || !destinoParada) return;

    if (marcadorOrigenSugerido) mapa.removeLayer(marcadorOrigenSugerido);
    if (marcadorDestinoSeleccionado) mapa.removeLayer(marcadorDestinoSeleccionado);
    if (lineaTramoPolyline) { mapa.removeLayer(lineaTramoPolyline); lineaTramoPolyline = null; }

    marcadorOrigenSugerido = L.marker([origenParada.lat, origenParada.lng], { icon: iconoParadaSubida }).addTo(mapa).bindPopup('Subida');
    marcadorDestinoSeleccionado = L.marker([destinoParada.lat, destinoParada.lng], { icon: iconoParadaBajada }).addTo(mapa).bindPopup('Bajada');

    // Proyecta origen y destino sobre la polilínea para recortar el tramo.
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

    // --- Tiempos ---
    let distanciaTramo = 0;
    for (let i = 0; i < tramoCoords.length - 1; i++) distanciaTramo += calcularDistancia(tramoCoords[i], tramoCoords[i + 1]);

    const minCamina = Math.max(1, Math.round(recorridoActual.distanciaAPieKm / 5 * 60));
    const minColectivo = Math.max(2, Math.round(distanciaTramo / 18 * 60));

    const minutosAhora = minutosDeAhora();
    const horarioOrigen = calcularHorarioEstimadoParada(recorridoActual.key, recorridoActual.origenIndex, minutosAhora);
    const minEspera = horarioOrigen ? Math.max(0, horarioOrigen.minutosLlegada - minutosAhora) : 0;
    const tiempoTotal = minCamina + minEspera + minColectivo;

    document.getElementById('resumen-viaje').innerHTML =
        '<div class="paso-itinerario"><p>1. A pie: Camina ~' + minCamina + ' min hacia <b>' + origenParada.nombre + '.</b></p></div>' +
        '<div class="paso-itinerario"><p>2. Colectivo: ~' + minColectivo + ' min.</p></div>' +
        '<div class="paso-itinerario"><p>3. Destino: Bajate en <b>' + destinoParada.nombre + '.</b></p></div>' +
        '<p>Tiempo total estimado: ~' + tiempoTotal + ' min.</p>';
}

/**
 * Traza la ruta a pie con el servidor público de OSRM (perfil peatonal).
 */

function trazarRutaAPie(desde, hasta) {
    if (routingControlPie) mapa.removeControl(routingControlPie);

    routingControlPie = L.Routing.control({
        waypoints: [
            L.latLng(desde.lat, desde.lng),
            L.latLng(hasta[0], hasta[1])
        ],
        router: L.Routing.osrmv1({
            // Usamos un servidor OSRM público dedicado exclusivamente a peatones
            serviceUrl: 'https://routing.openstreetmap.de/routed-foot/route/v1',
            profile: 'foot'
        }),
        show: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        createMarker: function () { return null; }, // Evita que dibuje pines extra
        lineOptions: {
            styles: [{ color: '#8b5cf6', weight: 6, dashArray: '8, 8', opacity: 0.9 }]
        }
    }).addTo(mapa);
}

/**
 * Busca la parada de la línea que está más cerca del usuario.
 */
function buscarParadaMasCercana(paradas) {
    let mejor = null, mejorIdx = -1, menorDist = Infinity;
    paradas.forEach((parada, idx) => {
        const d = calcularDistancia([ubicacionUsuario.lat, ubicacionUsuario.lng], [parada.lat, parada.lng]);
        if (d < menorDist) { menorDist = d; mejor = parada; mejorIdx = idx; }
    });
    return { parada: mejor, index: mejorIdx, distanciaKm: menorDist };
}

/**
 * Borra todo lo que hay dibujado en el mapa.
 * Se llama cuando se cambia de línea o cuando arranca un cálculo nuevo.
 */
function limpiarMapa() {
    if (bucleSimulacion) clearInterval(bucleSimulacion);
    marcadoresParadas.forEach(m => mapa.removeLayer(m)); marcadoresParadas = [];
    marcadoresColectivos.forEach(m => mapa.removeLayer(m)); marcadoresColectivos = [];

    if (lineaPolyline) { mapa.removeLayer(lineaPolyline); lineaPolyline = null; }
    if (lineaTramoPolyline) { mapa.removeLayer(lineaTramoPolyline); lineaTramoPolyline = null; }
    if (decoradorFlechas) { mapa.removeLayer(decoradorFlechas); decoradorFlechas = null; }

    if (routingControlPie) {
        routingControlPie.setWaypoints([]);
        mapa.removeControl(routingControlPie);
        routingControlPie = null;
    }

    if (marcadorOrigenSugerido) { mapa.removeLayer(marcadorOrigenSugerido); marcadorOrigenSugerido = null; }
    if (marcadorDestinoSeleccionado) { mapa.removeLayer(marcadorDestinoSeleccionado); marcadorDestinoSeleccionado = null; }
    if (marcadorDestinoBuscado) { mapa.removeLayer(marcadorDestinoBuscado); marcadorDestinoBuscado = null; }

    if (lineaL2FondoPolyline) { mapa.removeLayer(lineaL2FondoPolyline); lineaL2FondoPolyline = null; }
    if (lineaTramoL2Polyline) { mapa.removeLayer(lineaTramoL2Polyline); lineaTramoL2Polyline = null; }
    if (marcadorDestinoFinalL2) { mapa.removeLayer(marcadorDestinoFinalL2); marcadorDestinoFinalL2 = null; }
    if (marcadorTransbordoL2) { mapa.removeLayer(marcadorTransbordoL2); marcadorTransbordoL2 = null; }
}


// =====================================================
// MODO MAPA EXPANDIDO
// =====================================================

/**
 * Pone el mapa a pantalla completa (o vuelve al planificador).
 * En el modo expandido se copia el resumen del viaje al panel flotante.
 */
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

        if (resumenOriginal && resumenInferior) {
            resumenInferior.innerHTML = resumenOriginal.innerHTML;
            if (resumenOriginal.innerHTML.trim() !== '') panelInferior.classList.remove('hidden');
        }
    } else {
        document.body.classList.remove('modo-mapa-completo');
        btnExpandir.classList.remove('hidden');
        btnVolver.classList.add('hidden');
        panelInferior.classList.add('hidden');
    }

    // El mapa tiene que recalcular su tamaño después de cambiar el layout.
    setTimeout(() => {
        if (mapa) mapa.invalidateSize();
    }, 200);
}

/**
 * Copia el resumen del viaje al panel flotante cada vez que cambia,
 * para que en modo expandido se vea siempre actualizado.
 */
const observadorResumen = new MutationObserver(() => {
    const resumenOriginal = document.getElementById('resumen-viaje');
    const resumenInferior = document.getElementById('resumen-viaje-inferior');
    const panelInferior = document.getElementById('panel-instrucciones-inferior');

    if (document.body.classList.contains('modo-mapa-completo') && resumenOriginal && resumenInferior) {
        resumenInferior.innerHTML = resumenOriginal.innerHTML;
        if (resumenOriginal.innerHTML.trim() !== '') panelInferior.classList.remove('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const resumenOriginal = document.getElementById('resumen-viaje');
    if (resumenOriginal) {
        observadorResumen.observe(resumenOriginal, { childList: true, subtree: true });
    }
});
