// =====================================================
// Busya · PARTE 6 de 8 — PLANIFICADOR DE VIAJES
// =====================================================
//
// La parte que "piensa" el viaje:
//   · qué pasa cuando se elige una línea
//   · la sugerencia de la parada más cercana al usuario
//   · el buscador de lugares y paradas
//   · el cálculo de la mejor ruta (directa o con transbordo)
//
// No dibuja en el mapa: eso lo hace mapa.js.
//


// =====================================================
// SELECCIÓN DE LÍNEA, DESTINO Y ORIGEN
// =====================================================

/** Guarda la sugerencia de parada mientras el modal está abierto. */
let sugerenciaTemporal = null;

/** Temporizador del buscador (espera a que el usuario termine de escribir). */
let temporizadorBusqueda = null;

/**
 * Cuando el usuario elige una línea: se limpian los selectores, se dibuja
 * el recorrido y se arma la lista de paradas de destino.
 */
function alCambiarLinea(valorLinea) {
    const selDestino = document.getElementById('select-destino');
    const selOrigen = document.getElementById('select-origen');

    selDestino.innerHTML = '<option value="" disabled selected>-- 2. Seleccioná a dónde querés llegar --</option>';
    if (selOrigen) {
        selOrigen.innerHTML = '<option value="" disabled selected>-- 3. Seleccioná la parada de partida --</option>';
        selOrigen.disabled = true;
    }

    limpiarMapa();
    recorridoActual = datosLineasCargados[valorLinea];

    if (!recorridoActual || !recorridoActual.paradas.length) {
        alert('Datos no disponibles.');
        selDestino.disabled = true;
        return;
    }

    dibujarRecorridoColectivo(recorridoActual.recorrido);

    // Los colectivos solo se mueven si el usuario prendió el rastreador.
    if (rastreoActivo) activarRastreoColectivos();

    recorridoActual.paradas.forEach((parada, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = ' ' + parada.nombre;
        selDestino.appendChild(opt);
    });
    selDestino.disabled = false;
    document.getElementById('resumen-viaje').innerHTML = '<div class="paso-itinerario"><p>Paso 1: Seleccioná destino.</p></div>';
}

/**
 * Cuando el usuario elige un destino: se算出 la parada más cercana a su
 * posición y se le pregunta si la quiere usar como origen.
 */
function alSeleccionarDestino() {
    const idxDestino = Number(document.getElementById('select-destino').value);
    if (isNaN(idxDestino)) return;
    const cercana = buscarParadaMasCercana(recorridoActual.paradas);
    sugerenciaTemporal = { idxDestino: idxDestino, cercana: cercana };
    document.getElementById('modal-sugerencia-parada').classList.remove('hidden');
}

/**
 * Respuesta del modal: "usar GPS" o "manual".
 * Arma el selector de origen con las paradas anteriores al destino.
 */
function procesarRespuestaSugerencia(confirmar) {
    document.getElementById('modal-sugerencia-parada').classList.add('hidden');
    if (!sugerenciaTemporal) return;

    const { idxDestino, cercana } = sugerenciaTemporal;
    const selOrigen = document.getElementById('select-origen');

    if (selOrigen) {
        selOrigen.innerHTML = '<option value="" disabled>-- Seleccioná la parada de partida --</option>';
        recorridoActual.paradas.forEach((parada, idx) => {
            if (idx < idxDestino) {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = ' ' + parada.nombre;
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

/** Cierra el modal si se hace clic fuera del contenido. */
function cerrarModalSugerencia(e) {
    if (e.target.id === 'modal-sugerencia-parada') procesarRespuestaSugerencia(false);
}

/**
 * Cuando el usuario elige a mano la parada de subida: calcula la ruta.
 */
function alSeleccionarOrigen() {
    const idx = Number(document.getElementById('select-origen').value);
    if (isNaN(idx)) return;
    recorridoActual.origenIndex = idx;
    recorridoActual.origenParada = recorridoActual.paradas[idx];
    recorridoActual.distanciaAPieKm = calcularDistancia(
        [ubicacionUsuario.lat, ubicacionUsuario.lng],
        [recorridoActual.origenParada.lat, recorridoActual.origenParada.lng]
    );
    trazarRutaAPie(ubicacionUsuario, [recorridoActual.origenParada.lat, recorridoActual.origenParada.lng]);
    calcularRutaYTiempo();
}


// =====================================================
// BUSCADOR DE LUGARES Y PARADAS
// =====================================================

/**
 * Se dispara mientras el usuario escribe: espera un momento y busca.
 */
function ejecutarBusquedaEnTiempoReal() {
    clearTimeout(temporizadorBusqueda);
    const terminoInput = document.getElementById('buscador-lugares').value.trim();
    if (terminoInput.length < 3) {
        document.getElementById('resultados-busqueda').innerHTML = '';
        return;
    }
    document.getElementById('resultados-busqueda').innerHTML = '<li style="padding: 10px; color: #666;">Buscando opciones...</li>';
    temporizadorBusqueda = setTimeout(() => { ejecutarBusqueda(); }, 800);
}

/**
 * Busca paradas de las 4 líneas (con tolerancia a errores de tipeo),
 * lugares de referencia de la API y direcciones en OpenStreetMap.
 */
async function ejecutarBusqueda() {
    const terminoInput = document.getElementById('buscador-lugares').value.trim();
    const contenedorResultados = document.getElementById('resultados-busqueda');
    if (!terminoInput) { contenedorResultados.innerHTML = ''; return; }

    // --- Paradas de las líneas ---
    const paradasEncontradas = [];
    for (const keyLinea in datosLineasCargados) {
        const linea = datosLineasCargados[keyLinea];
        if (!linea) continue;
        linea.paradas.forEach((parada, index) => {
            if (coincideConErrores(parada.nombre, terminoInput)
                && !paradasEncontradas.some(p => p.parada.nombre === parada.nombre)) {
                paradasEncontradas.push({ lineaKey: keyLinea, nombreLinea: linea.nombre, parada: parada, index: index });
            }
        });
    }

    // --- Direcciones (OpenStreetMap / Nominatim) ---
    let lugaresEncontrados = [];
    try {
        const queryFormateada = encodeURIComponent(terminoInput + ', Villa Mercedes, San Luis');
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${queryFormateada}&countrycodes=ar&limit=5`;
        const response = await fetch(url);
        lugaresEncontrados = await response.json();
    } catch (e) {
        console.error('Error Nominatim:', e);
    }

    contenedorResultados.innerHTML = '';

    // --- Resultados: paradas ---
    if (paradasEncontradas.length > 0) {
        const titulo = document.createElement('li');
        titulo.innerHTML = '<strong style="display:block; padding: 5px 10px; background:#f1f5f9; color:#475569; font-size: 0.8rem;">🚏 PARADAS SUGERIDAS</strong>';
        contenedorResultados.appendChild(titulo);

        paradasEncontradas.slice(0, 4).forEach(item => {
            const li = document.createElement('li');
            li.style = 'padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; display:flex; flex-direction:column; background: white;';
            li.onmouseover = () => li.style.background = '#f8fafc';
            li.onmouseout = () => li.style.background = 'white';
            li.innerHTML = `<span><b>${item.parada.nombre}</b></span><small style="color:#2563eb;">Línea sugerida: ${item.nombreLinea}</small>`;
            li.onclick = () => seleccionarDestinoDesdeBuscador(item.lineaKey, item.index, item.parada, true);
            contenedorResultados.appendChild(li);
        });
    }

    // --- Resultados: lugares de referencia de la API / comercios ---
    const referencias = lugaresDeReferencia.filter(l => coincideConErrores(l.nombre, terminoInput) || (l.descripcion && coincideConErrores(l.descripcion, terminoInput)) || (l.direccion && coincideConErrores(l.direccion, terminoInput)));
    if (referencias.length > 0) {
        const tituloLugares = document.createElement('li');
        tituloLugares.innerHTML = '<strong style="display:block; padding: 5px 10px; background:#f1f5f9; color:#475569; font-size: 0.8rem;">🏫 LUGARES DE REFERENCIA Y COMERCIOS</strong>';
        contenedorResultados.appendChild(tituloLugares);

        referencias.slice(0, 12).forEach(lugar => {
            const li = document.createElement('li');
            li.style = 'padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; background: white;';
            li.onmouseover = () => li.style.background = '#f8fafc';
            li.onmouseout = () => li.style.background = 'white';
            const lat = lugar.lat || (lugar.coordenadas ? lugar.coordenadas.lat : null);
            const lng = lugar.lng || (lugar.coordenadas ? lugar.coordenadas.lng : null);
            li.innerHTML = `<b>${lugar.nombre}</b> <br><small style="color:#64748b;">${lugar.descripcion || (lugar.categoria ? lugar.categoria : 'Villa Mercedes')}</small>`;
            if (lat && lng) {
                li.onclick = () => encontrarViajeMasOptimo(parseFloat(lat), parseFloat(lng), lugar.nombre);
            }
            contenedorResultados.appendChild(li);
        });
    }

    // --- Resultados: direcciones / búsqueda por dirección ---
    if (lugaresEncontrados.length > 0) {
        const tituloLugares = document.createElement('li');
        tituloLugares.innerHTML = '<strong style="display:block; padding: 5px 10px; background:#f1f5f9; color:#475569; font-size: 0.8rem;">📍 LOCALES Y DIRECCIONES</strong>';
        contenedorResultados.appendChild(tituloLugares);

        lugaresEncontrados.forEach(lugar => {
            const addr = lugar.address || {};
            let nombreFormateado = '';

            if (addr.road && addr.house_number) {
                nombreFormateado = `${addr.road} ${addr.house_number}`;
            } else if (lugar.display_name) {
                const partes = lugar.display_name.split(',');
                nombreFormateado = partes.slice(0, 2).join(', ').trim();
            } else {
                nombreFormateado = lugar.display_name;
            }

            const descripcion = lugar.display_name.split(',').slice(2, 4).join(',').trim();
            const li = document.createElement('li');
            li.style = 'padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; background: white;';
            li.onmouseover = () => li.style.background = '#f8fafc';
            li.onmouseout = () => li.style.background = 'white';

            li.innerHTML = `<b>${nombreFormateado}</b> <br><small style="color:#64748b;">${descripcion || 'Villa Mercedes'}</small>`;
            li.onclick = () => encontrarViajeMasOptimo(parseFloat(lugar.lat), parseFloat(lugar.lon || lugar.lng), nombreFormateado);
            contenedorResultados.appendChild(li);
        });
    }

    if (paradasEncontradas.length === 0 && lugaresEncontrados.length === 0 && referencias.length === 0) {
        contenedorResultados.innerHTML = '<li style="padding: 10px; color: #ef4444;">No encontramos coincidencias.</li>';
    }
}

/**
 * El usuario tocó una parada del buscador: se la deja como destino.
 */
function seleccionarDestinoDesdeBuscador(lineaKey, paradaIndex, parada, limpiarInput) {
    if (limpiarInput) {
        document.getElementById('resultados-busqueda').innerHTML = '';
        document.getElementById('buscador-lugares').value = parada.nombre;
    }
    document.getElementById('select-linea').value = lineaKey;
    alCambiarLinea(lineaKey);
    setTimeout(() => {
        document.getElementById('select-destino').value = paradaIndex;
        alSeleccionarDestino();
    }, 150);
}

// Si se hace clic fuera del buscador, se cierran los resultados.
document.addEventListener('click', function (e) {
    if (!e.target.closest('.grupo-control')) document.getElementById('resultados-busqueda').innerHTML = '';
});


// =====================================================
// MEJOR RUTA (DIRECTA O CON TRANSBORDO)
// =====================================================

/**
 * Calcula el mejor viaje hacia un punto cualquiera.
 *
 *   Fase 0 → si está a menos de 1 km, conviene ir caminando.
 *   Fase 1 → se prueban todos los viajes directos de todas las líneas.
 *   Fase 2 → se prueban los transbordos en la escala de Gral. Paz.
 *   Fase 3 → se aplica el mejor resultado a la interfaz.
 */
function encontrarViajeMasOptimo(latDestino, lngDestino, nombreLugar) {
    document.getElementById('resultados-busqueda').innerHTML = '';
    document.getElementById('buscador-lugares').value = nombreLugar;

    if (!ubicacionUsuario) {
        alert('Necesitamos acceso a tu ubicación GPS para calcular el viaje más rápido. Activa tu ubicación y recarga la página.');
        return;
    }

    limpiarMapa();

    const distDirecta = calcularDistancia([ubicacionUsuario.lat, ubicacionUsuario.lng], [latDestino, lngDestino]);
    const metrosDirectos = Math.round(distDirecta * 1000);
    const cuadrasAprox = Math.round(metrosDirectos / 100);

    // --- Fase 0: conviene ir a pie ---
    if (distDirecta <= 3.0) {
        const minCaminando = Math.max(1, Math.round(((distDirecta * 1.2) / 5) * 60));
        trazarRutaAPie(ubicacionUsuario, [latDestino, lngDestino]);

        marcadorDestinoBuscado = L.marker([latDestino, lngDestino]).addTo(mapa)
            .bindPopup(`📍 <b>${nombreLugar}</b><br>🚶 ¡Estás a solo ${cuadrasAprox} cuadras! Llegás caminando en ~${minCaminando} min.`)
            .openPopup();

        document.getElementById('resumen-viaje').innerHTML = `
            <div class="paso-itinerario" style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 10px;">
                <p>🚶 <b>¡Destino cercano!</b></p>
                <p>Estás a <b>${metrosDirectos} metros</b> (aprox. ${cuadrasAprox} cuadras) de <b>${nombreLugar}</b>.</p>
                <p>Tiempo estimado a pie: <b>~${minCaminando} min</b>.</p>
            </div>
        `;
        const modalCaminar = document.getElementById('modal-caminar');
        const textoModal = document.getElementById('modal-caminar-texto');
        if (modalCaminar && textoModal) {
            textoModal.innerHTML = `Te recomendamos ir <b>caminando</b> hasta <b>${nombreLugar}</b>.<br><br>En tu GPS o app de navegación poné el <b>modo a pie / caminando</b>, no modo auto.<br><br>Distancia: <b>${metrosDirectos} m</b> (~${cuadrasAprox} cuadras) · <b>${minCaminando} min</b> caminando.`;
            modalCaminar.classList.remove('hidden');
        }
        mapa.setView([latDestino, lngDestino], 15);
        return;
    }

    let mejorViaje = null;
    let menorLlegada = Infinity;
    const minutosAhora = minutosDeAhora();

    // Punto de transbordo obligatorio: León Guillet y Gral. Paz (la escala).
    const latEscalaForzada = -33.68863077918209;
    const lngEscalaForzada = -65.46474212259419;

    // --- Fase 1: viajes directos ---
    // Se buscan TODOS los pares (subida/bajada) válidos y se elige el que
    // llegue antes, teniendo en cuenta: andar hasta la parada + esperar el
    // próximo colectivo + viaje en colectivo + andar hasta el destino.
    for (const keyLinea in datosLineasCargados) {
        const linea = datosLineasCargados[keyLinea];
        if (!linea || !linea.paradas || linea.paradas.length === 0) continue;

        const origenes = [];
        const destinos = [];

        // Paradas cercanas al usuario para subir
        linea.paradas.forEach((p, idx) => {
            const d = calcularDistancia([ubicacionUsuario.lat, ubicacionUsuario.lng], [p.lat, p.lng]);
            if (d <= 1.5) origenes.push({ parada: p, idx, dist: d });
        });

        // Paradas cercanas al destino para bajar
        linea.paradas.forEach((p, idx) => {
            const d = calcularDistancia([latDestino, lngDestino], [p.lat, p.lng]);
            if (d <= 1.5) destinos.push({ parada: p, idx, dist: d });
        });

        // Si el destino está en la zona de la escala, se fuerza esa parada.
        if (distDestinoMenorA(latDestino, lngDestino, { lat: latEscalaForzada, lng: lngEscalaForzada }, 0.8)) {
            let idxParadaExacta = -1;
            let menorDistP = Infinity;
            linea.paradas.forEach((p, idx) => {
                const dP = calcularDistancia([p.lat, p.lng], [latEscalaForzada, lngEscalaForzada]);
                if (dP < menorDistP) { menorDistP = dP; idxParadaExacta = idx; }
            });

            if (idxParadaExacta !== -1 && menorDistP <= 0.05) {
                const paradaForzada = linea.paradas[idxParadaExacta];
                const distF = calcularDistancia([latDestino, lngDestino], [paradaForzada.lat, paradaForzada.lng]);
                if (!destinos.some(d => d.idx === idxParadaExacta)) {
                    destinos.push({ parada: paradaForzada, idx: idxParadaExacta, dist: distF, forzado: true });
                }
            }
        }

        if (origenes.length === 0 || destinos.length === 0) continue;

        for (const o of origenes) {
            for (const d of destinos) {
                // Solo se puede viajar en el sentido correcto del recorrido
                if (!(o.idx < d.idx || d.forzado)) continue;

                const minCaminaOrigen = Math.max(0, (o.dist / 5) * 60); // 5 km/h caminando
                const minCaminaDestino = Math.max(0, (d.dist / 5) * 60);

                // Distancia del tramo en colectivo
                let distBus = 0;
                for (let i = o.idx; i < d.idx; i++) {
                    distBus += calcularDistancia(
                        [linea.paradas[i].lat, linea.paradas[i].lng],
                        [linea.paradas[i + 1].lat, linea.paradas[i + 1].lng]
                    );
                }
                if (distBus < 0.001) continue;
                const minBus = Math.max(1, (distBus / VELOCIDAD_COLECTIVO_KMH) * 60);

                // Espera del próximo colectivo en la parada de subida
                const lineaOriginal = recorridoActual;
                recorridoActual = linea;
                const horarioOrigen = calcularHorarioEstimadoParada(keyLinea, o.idx, minutosAhora);
                recorridoActual = lineaOriginal;

                let minEspera = 8; // valor conservador por defecto
                if (horarioOrigen && typeof horarioOrigen.minutosLlegada === 'number') {
                    const espera = horarioOrigen.minutosLlegada - minutosAhora;
                    if (espera >= 0 && espera <= 90) {
                        minEspera = espera;
                    } else if (espera < 0) {
                        // Si el horario calculado ya pasó, probamos con ahora+1 para buscar el siguiente
                        const horarioOrigen2 = (function() {
                            const lo = recorridoActual; recorridoActual = linea;
                            const h = calcularHorarioEstimadoParada(keyLinea, o.idx, minutosAhora + 1);
                            recorridoActual = lo; return h;
                        })();
                        if (horarioOrigen2 && typeof horarioOrigen2.minutosLlegada === 'number') {
                            const espera2 = horarioOrigen2.minutosLlegada - minutosAhora;
                            if (espera2 > 0) minEspera = espera2;
                        }
                    }
                }

                // TIEMPO TOTAL REAL = caminar hasta parada + esperar colectivo + viaje + caminar al destino
                const llegadaEstimada = minutosAhora + minCaminaOrigen + minEspera + minBus + minCaminaDestino;
                const tiempoTotalRedondeado = Math.round(minCaminaOrigen + minEspera + minBus + minCaminaDestino);

                // Elegimos SIEMPRE el viaje que llegue ANTES
                if (llegadaEstimada < menorLlegada) {
                    menorLlegada = llegadaEstimada;
                    mejorViaje = {
                        tipo: 'directo',
                        lineaKey: keyLinea,
                        nombreLinea: linea.nombre,
                        origen: o,
                        destino: d,
                        tiempoTotal: tiempoTotalRedondeado,
                        metrosDestino: Math.round(d.dist * 1000),
                        minCaminaOrigen: Math.round(minCaminaOrigen),
                        minEspera: Math.round(minEspera),
                        minBus: Math.round(minBus),
                        minCaminaDestino: Math.round(minCaminaDestino)
                    };
                    if (typeof mejorViajeActual !== 'undefined') mejorViajeActual = mejorViaje;
                }
            }
        }
    }

    // --- Fase 2: viajes con transbordo en la escala ---
    for (const keyL1 in datosLineasCargados) {
        for (const keyL2 in datosLineasCargados) {
            if (keyL1 === keyL2) continue;

            const L1 = datosLineasCargados[keyL1];
            const L2 = datosLineasCargados[keyL2];
            if (!L1 || !L2) continue;

            const origenesL1 = [];
            L1.paradas.forEach((p, idx) => {
                const d = calcularDistancia([ubicacionUsuario.lat, ubicacionUsuario.lng], [p.lat, p.lng]);
                if (d <= 1.5) origenesL1.push({ parada: p, idx, dist: d });
            });

            // Parada de L2 donde se hace el transbordo: la más cercana a la escala.
            let idxSubidaL2Forzada = -1;
            let minDSubidaL2 = Infinity;
            L2.paradas.forEach((p, idx) => {
                const d = calcularDistancia([p.lat, p.lng], [latEscalaForzada, lngEscalaForzada]);
                if (d < minDSubidaL2) { minDSubidaL2 = d; idxSubidaL2Forzada = idx; }
            });

            const subidaL2Fija = (idxSubidaL2Forzada !== -1 && minDSubidaL2 <= 0.05)
                ? { parada: L2.paradas[idxSubidaL2Forzada], idx: idxSubidaL2Forzada }
                : null;
            if (!subidaL2Fija) continue;

            const destinosL2 = [];
            L2.paradas.forEach((p, idx) => {
                const d = calcularDistancia([latDestino, lngDestino], [p.lat, p.lng]);
                if (d <= 1.5) destinosL2.push({ parada: p, idx, dist: d });
            });

            if (origenesL1.length === 0 || destinosL2.length === 0) continue;

            for (const o1 of origenesL1) {
                for (const d2 of destinosL2) {
                    if (!(subidaL2Fija.idx < d2.idx)) continue;

                    // Se busca cualquier bajada de L1 razonable cerca de la escala
                    for (let i = o1.idx + 1; i < L1.paradas.length; i++) {
                        const paradaBajadaL1 = L1.paradas[i];
                        const paradaSubidaL2 = subidaL2Fija.parada;

                        const distEscala = calcularDistancia(
                            [paradaBajadaL1.lat, paradaBajadaL1.lng],
                            [paradaSubidaL2.lat, paradaSubidaL2.lng]
                        );

                        if (distEscala <= 0.4) {
                            const minCaminaInicio = Math.max(0, (o1.dist / 5) * 60);
                            const minCaminaEscala = Math.max(1, (distEscala / 5) * 60);
                            const minCaminaFin = Math.max(0, (d2.dist / 5) * 60);

                            let distBus1 = 0;
                            for (let k = o1.idx; k < i; k++) {
                                distBus1 += calcularDistancia(
                                    [L1.paradas[k].lat, L1.paradas[k].lng],
                                    [L1.paradas[k + 1].lat, L1.paradas[k + 1].lng]
                                );
                            }
                            if (distBus1 < 0.001) continue;
                            const minBus1 = Math.max(1, (distBus1 / VELOCIDAD_COLECTIVO_KMH) * 60);

                            let distBus2 = 0;
                            for (let k = subidaL2Fija.idx; k < d2.idx; k++) {
                                distBus2 += calcularDistancia(
                                    [L2.paradas[k].lat, L2.paradas[k].lng],
                                    [L2.paradas[k + 1].lat, L2.paradas[k + 1].lng]
                                );
                            }
                            if (distBus2 < 0.001) continue;
                            const minBus2 = Math.max(1, (distBus2 / VELOCIDAD_COLECTIVO_KMH) * 60);

                            // Espera de cada colectivo
                            const lo = recorridoActual;
                            recorridoActual = L1;
                            const h1 = calcularHorarioEstimadoParada(keyL1, o1.idx, minutosAhora);
                            recorridoActual = L2;
                            const h2 = calcularHorarioEstimadoParada(keyL2, subidaL2Fija.idx, minutosAhora);
                            recorridoActual = lo;

                            let minEspera1 = 8;
                            if (h1 && typeof h1.minutosLlegada === 'number') {
                                const e = h1.minutosLlegada - minutosAhora;
                                if (e >= 0 && e <= 90) minEspera1 = e;
                            }
                            let minEspera2 = 8;
                            if (h2 && typeof h2.minutosLlegada === 'number') {
                                const e = h2.minutosLlegada - minutosAhora;
                                if (e >= 0 && e <= 90) minEspera2 = e;
                            }

                            // Se llega a la escala cuando llega L1, se espera un poco para transbordar
                            const llegadaEscala = minutosAhora + minCaminaInicio + minEspera1 + minBus1;
                            const salidaL2 = Math.max(llegadaEscala + minCaminaEscala + 1, minutosAhora + minCaminaInicio + minEspera1 + minBus1 + minCaminaEscala);
                            // Simple: usar la espera estimada en la parada de L2
                            const llegadaTotal = minutosAhora + minCaminaInicio + minEspera1 + minBus1 + minCaminaEscala + minEspera2 + minBus2 + minCaminaFin;
                            const tiempoTotal = Math.round(minCaminaInicio + minEspera1 + minBus1 + minCaminaEscala + minEspera2 + minBus2 + minCaminaFin);

                            // Solo considerar si llega ANTES que lo que ya tenemos
                            if (llegadaTotal < menorLlegada) {
                                menorLlegada = llegadaTotal;
                                mejorViaje = {
                                    tipo: 'transbordo',
                                    L1: { key: keyL1, nombre: L1.nombre, origen: o1, bajada: { parada: paradaBajadaL1, idx: i } },
                                    L2: { key: keyL2, nombre: L2.nombre, subida: { parada: paradaSubidaL2, idx: subidaL2Fija.idx }, destino: d2 },
                                    distEscala: Math.round(distEscala * 1000),
                                    tiempoTotal: tiempoTotal,
                                    metrosDestino: Math.round(d2.dist * 1000)
                                };
                                if (typeof mejorViajeActual !== 'undefined') mejorViajeActual = mejorViaje;
                            }
                        }
                    }
                }
            }
        }
    }

    // --- Fase 3: aplicar el resultado ---
    if (!mejorViaje) {
        alert('No encontramos una ruta lógica para ir a ese destino desde donde estás.');
        return;
    }

    if (mejorViaje.tipo === 'directo') {
        document.getElementById('select-linea').value = mejorViaje.lineaKey;
        alCambiarLinea(mejorViaje.lineaKey);

        setTimeout(() => {
            document.getElementById('select-destino').value = mejorViaje.destino.idx;
            sugerenciaTemporal = {
                idxDestino: mejorViaje.destino.idx,
                cercana: { parada: mejorViaje.origen.parada, index: mejorViaje.origen.idx, distanciaKm: mejorViaje.origen.dist }
            };
            procesarRespuestaSugerencia(true);

            // Mostrar el resumen con el viaje óptimo
            const det = mejorViaje;
            document.getElementById('resumen-viaje').innerHTML = `
                <div class="paso-itinerario"><p>1. 🚶 Caminá (modo <b>pie</b>) hasta <b>${det.origen.parada.nombre}</b> (${det.minCaminaOrigen || 0} min).</p></div>
                <div class="paso-itinerario"><p>2. 🚌 Tomá la <b>${det.nombreLinea}</b> en <b>${det.origen.parada.nombre}</b> (esperá ~${det.minEspera || 0} min) y bajate en <b>${det.destino.parada.nombre}</b> (${det.minBus || 0} min).</p></div>
                <div class="paso-itinerario"><p>3. 🚶 Caminá (modo <b>pie</b>) ${det.metrosDestino}m hasta <b>${nombreLugar}</b> (${det.minCaminaDestino || 0} min).</p></div>
                <p style="font-weight: bold; color: #2e7d32;">Tiempo total: ~${det.tiempoTotal} min.</p>
            `;

            marcadorDestinoBuscado = L.marker([latDestino, lngDestino]).addTo(mapa)
                .bindPopup(`📍 <b>Destino:</b> ${nombreLugar}<br>🏆 <b>${det.nombreLinea} (directo):</b> ~${det.tiempoTotal} min.<br>🚶 Caminás ${det.metrosDestino}m al bajar.`)
                .openPopup();
            mapa.setView([latDestino, lngDestino], 15);
        }, 150);

    } else if (mejorViaje.tipo === 'transbordo') {
        document.getElementById('select-linea').value = mejorViaje.L1.key;
        alCambiarLinea(mejorViaje.L1.key);

        setTimeout(() => {
            document.getElementById('select-destino').value = mejorViaje.L1.bajada.idx;
            sugerenciaTemporal = {
                idxDestino: mejorViaje.L1.bajada.idx,
                cercana: { parada: mejorViaje.L1.origen.parada, index: mejorViaje.L1.origen.idx, distanciaKm: mejorViaje.L1.origen.dist }
            };
            procesarRespuestaSugerencia(true);

            document.getElementById('resumen-viaje').innerHTML = `
                <div class="paso-itinerario"><p>1. 🚶 Caminá (modo <b>pie</b>) hacia <b>${mejorViaje.L1.origen.parada.nombre}</b>.</p></div>
                <div class="paso-itinerario"><p>2. 🚌 Tomá la <b>${mejorViaje.L1.nombre}</b> y bajate en <b>${mejorViaje.L1.bajada.parada.nombre}</b>.</p></div>

                <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 10px; margin: 8px 0; border-radius: 6px;">
                    <p style="margin: 0 0 6px 0; font-size: 0.9rem;">🔄 <b>Transbordo obligatorio:</b></p>
                    <p style="margin: 0; font-size: 0.85rem; color: #475569;">Caminá (modo <b>pie</b>) ${mejorViaje.distEscala}m hacia <b>${mejorViaje.L2.subida.parada.nombre}</b> (León Guillet y Gral. Paz) para tomar la <b>${mejorViaje.L2.nombre}</b>.</p>
                </div>

                <div class="paso-itinerario"><p>3. 🚶 Caminá (modo <b>pie</b>) ${mejorViaje.metrosDestino}m hasta tu destino final.</p></div>
                <p style="font-weight: bold; color: #2e7d32;">Tiempo total: ~${mejorViaje.tiempoTotal} min.</p>
            `;

            // Trazamos automáticamente ambos tramos: primer colectivo (naranja) + escala (segundo colectivo)
            if (typeof mejorViajeActual !== 'undefined') mejorViajeActual = mejorViaje;
            dibujarTramoEscalaL2(mejorViaje, latDestino, lngDestino, nombreLugar);
        }, 200);
    }
}

/**
 * Dibuja en el mapa el tramo de la segunda línea (la del transbordo).
 */
function dibujarTramoEscalaL2(mejorViaje, latDestino, lngDestino, nombreLugar) {
    const datosL2 = datosLineasCargados[mejorViaje.L2.key];
    const recorridoL2 = datosL2.recorrido;

    // 1. Recorrido completo de L2.
    lineaL2FondoPolyline = L.polyline(recorridoL2, { color: '#ef4444', weight: 5, opacity: 0.5 }).addTo(mapa);

    // 2. Todas las paradas de L2, ordenadas según el recorrido.
    const minutosAhoraL2 = minutosDeAhora();

    const paradasConIndiceL2 = datosL2.paradas.map((parada, index) => ({
        parada,
        index,
        idxRecorrido: obtenerIndiceCoordenadaMasCercana(recorridoL2, [parada.lat, parada.lng])
    }));
    paradasConIndiceL2.sort((a, b) => a.idxRecorrido - b.idxRecorrido);

    paradasConIndiceL2.forEach(({ parada, index, idxRecorrido }) => {
        const marker = L.circleMarker(recorridoL2[idxRecorrido], {
            radius: 6,
            color: '#7f1d1d',
            fillColor: '#ef4444',
            fillOpacity: 0.8
        }).addTo(mapa);

        marker.on('click', () => {
            const lineaOriginal = recorridoActual;
            recorridoActual = datosL2;
            const horario = calcularHorarioEstimadoParada(datosL2.key, index, minutosAhoraL2);
            recorridoActual = lineaOriginal;

            const infoHtml = horario
                ? '<br><small>' + (horario.esInterpolado ? 'Horario estimado' : 'Horario programado') + '</small>'
                : '<br><i>No hay horarios disponibles.</i>';
            marker.bindPopup('<div style="text-align: center;"><b>🚏 Parada (' + datosL2.nombre + '):</b> ' + parada.nombre + infoHtml + '</div>').openPopup();
        });

        marcadoresParadas.push(marker);
    });

    // 3. Tramo exacto que se va a viajar en L2.
    const proyOrigenL2 = obtenerProyeccionEnRecorrido(recorridoL2, [mejorViaje.L2.subida.parada.lat, mejorViaje.L2.subida.parada.lng]);
    // Buscar la parada de destino final en L2 (más cercana al destino)
    let idxDestinoFinalL2 = mejorViaje.L2.destino.idx;
    if (datosL2 && datosL2.paradas) {
        let minD = Infinity;
        datosL2.paradas.forEach((p, idx) => {
            const d = calcularDistancia([p.lat, p.lng], [latDestino, lngDestino]);
            if (d < minD && d <= 1.5) { minD = d; idxDestinoFinalL2 = idx; }
        });
        if (minD === Infinity) {
            datosL2.paradas.forEach((p, idx) => {
                const d = calcularDistancia([p.lat, p.lng], [latDestino, lngDestino]);
                if (d < minD) { minD = d; idxDestinoFinalL2 = idx; }
            });
        }
    }
    const proyDestinoL2 = obtenerProyeccionEnRecorrido(recorridoL2, [datosL2.paradas[idxDestinoFinalL2].lat, datosL2.paradas[idxDestinoFinalL2].lng]);

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

    lineaTramoL2Polyline = L.polyline(tramoCoordsL2, {
        color: '#ea580c',
        weight: 7,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(mapa);

    // 4. Marcadores de subida y bajada del transbordo.
    const idxTransbordo = obtenerIndiceCoordenadaMasCercana(recorridoL2, [mejorViaje.L2.subida.parada.lat, mejorViaje.L2.subida.parada.lng]);
    marcadorTransbordoL2 = L.marker(recorridoL2[idxTransbordo], {
        icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div style='background-color:#ef4444; color:white; padding:5px 10px; border-radius:10px; font-weight:bold; font-size:12px; white-space:nowrap; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3);'>🔄 Subí a ${mejorViaje.L2.nombre}</div>`,
            iconSize: [120, 30],
            iconAnchor: [60, 35]
        })
    }).addTo(mapa);

    const idxDestinoFinalL2Marker = obtenerIndiceCoordenadaMasCercana(recorridoL2, [datosL2.paradas[idxDestinoFinalL2].lat, datosL2.paradas[idxDestinoFinalL2].lng]);
    marcadorDestinoFinalL2 = L.marker(recorridoL2[idxDestinoFinalL2Marker], { icon: iconoParadaBajada })
        .addTo(mapa).bindPopup(`📍 <b>Bajada:</b> ${datosL2.paradas[idxDestinoFinalL2].nombre}<br>🚶 Caminás ${mejorViaje.metrosDestino}m hasta ${nombreLugar}`).openPopup();

    // 5. Ajustar la cámara para que se vea todo.
    if (lineaTramoPolyline) {
        const bounds = lineaTramoPolyline.getBounds();
        bounds.extend(lineaTramoL2Polyline.getBounds());
        mapa.fitBounds(bounds, { padding: [40, 40] });
    } else {
        mapa.fitBounds(lineaTramoL2Polyline.getBounds(), { padding: [40, 40] });
    }
}
