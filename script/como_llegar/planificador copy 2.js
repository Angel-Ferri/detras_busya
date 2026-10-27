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
        mostrarCargandoViaje('Calculando tu ruta...');
        setTimeout(() => {
            calcularRutaYTiempo();
            cerrarCargandoViaje();
        }, 450);
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
    mostrarCargandoViaje('Calculando tu ruta...');
    setTimeout(() => {
        calcularRutaYTiempo();
        cerrarCargandoViaje();
    }, 450);
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
            
            // 🔥 SOLUCIÓN AL CONGELAMIENTO: Muestra el cartel, pausa 150ms para que se dibuje, y luego calcula
            li.onclick = () => {
                mostrarCargandoViaje('Calculando la mejor ruta...');
                setTimeout(() => {
                    encontrarViajeMasOptimo(item.parada.lat, item.parada.lng, item.parada.nombre);
                    cerrarCargandoViaje();
                }, 150);
            };
            
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
            
            // 🔥 SOLUCIÓN AL CONGELAMIENTO
            li.onclick = () => {
                mostrarCargandoViaje('Calculando la mejor ruta...');
                setTimeout(() => {
                    encontrarViajeMasOptimo(parseFloat(lugar.lat), parseFloat(lugar.lon || lugar.lng), nombreFormateado);
                    cerrarCargandoViaje();
                }, 150);
            };
            
            contenedorResultados.appendChild(li);
        });
    }

    if (paradasEncontradas.length === 0 && lugaresEncontrados.length === 0) {
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

/** Muestra un cartel de carga con colectivo dando vueltas y consejos */
function mostrarCargandoViaje(texto = 'Buscando el mejor viaje...') {
    cerrarCargandoViaje();

    const overlay = document.createElement('div');
    overlay.id = 'modal-cargando-viaje';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.75); z-index: 100000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(2px); font-family: sans-serif;';

    const box = document.createElement('div');
    box.style.cssText = 'background: white; width: 90%; max-width: 330px; padding: 30px 25px; border-radius: 18px; text-align: center; box-shadow: 0 18px 45px rgba(0,0,0,0.35); display: flex; flex-direction: column; align-items: center; gap: 14px;';

    if (!document.getElementById('estilos-carga-colectivo-viejo')) {
        const style = document.createElement('style');
        style.id = 'estilos-carga-colectivo-viejo';
        style.textContent = `
            @keyframes girar-colectivo-viejo {
                0% { transform: rotate(0deg) translateX(40px) rotate(0deg); }
                100% { transform: rotate(360deg) translateX(40px) rotate(-360deg); }
            }
            @keyframes pulsar-consejo-viejo {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
            }
            @keyframes brillar-ruta {
                0%, 100% { opacity: 0.4; }
                50% { opacity: 0.9; }
            }
        `;
        document.head.appendChild(style);
    }

    const consejos = [
        "🚌 El colectivo ya está dando la vuelta por tu zona...",
        "💡 Buscando el que te deje más cerca de tu destino",
        "🚏 Revisando paradas de subida y bajada",
        "⏱️ Calculando caminata + colectivo al milímetro",
        "🔍 Analizando todas las líneas para ahorrarte pasos",
        "📍 Buscando la opción más práctica para llegar",
        "🛣️ Trazando el recorrido ideal para este viaje"
    ];

    box.innerHTML = `
        <div style="position: relative; width: 95px; height: 95px; margin-bottom: 4px;">
            <div style="position: absolute; top: 50%; left: 50%; width: 80px; height: 80px; margin: -40px 0 0 -40px; border: 3px dashed #cbd5e1; border-radius: 50%; animation: brillar-ruta 2.2s ease-in-out infinite;"></div>
            <div style="position: absolute; top: 50%; left: 50%; font-size: 30px; animation: girar-colectivo-viejo 1.9s linear infinite;">🚌</div>
            <div style="position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; margin: -4px 0 0 -4px; background: #2563eb; border-radius: 50%; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.18);"></div>
        </div>
        <div style="font-weight: bold; color: #1e293b; font-size: 1rem;">${texto}</div>
        <div id="consejo-carga-viejo" style="font-size: 0.9rem; color: #475569; min-height: 42px; display: flex; align-items: center; justify-content: center; line-height: 1.4; animation: pulsar-consejo-viejo 2s ease-in-out infinite; padding: 0 6px;"></div>
        <div style="font-size: 0.75rem; color: #94a3b8; margin-top: -4px;">Un toque más... ya te muestro las opciones</div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const consejoEl = box.querySelector('#consejo-carga-viejo');
    let indexConsejo = 0;
    consejoEl.textContent = consejos[indexConsejo];

    window._intervalConsejosCargaViejo = setInterval(() => {
        indexConsejo = (indexConsejo + 1) % consejos.length;
        consejoEl.style.opacity = '0';
        setTimeout(() => {
            consejoEl.textContent = consejos[indexConsejo];
            consejoEl.style.opacity = '1';
        }, 250);
    }, 2000);
}

/** Cierra el cartel de carga */
function cerrarCargandoViaje() {
    const modal = document.getElementById('modal-cargando-viaje');
    if (modal) modal.remove();

    if (window._intervalConsejosCargaViejo) {
        clearInterval(window._intervalConsejosCargaViejo);
        delete window._intervalConsejosCargaViejo;
    }
    if (window._intervalConsejosCarga) {
        clearInterval(window._intervalConsejosCarga);
        delete window._intervalConsejosCarga;
    }
}

// Variables globales para recordar las opciones si el usuario quiere cambiar de opinión
let opcionesViajeActuales = [];
let infoDestinoActual = null;

function encontrarViajeMasOptimo(latDestino, lngDestino, nombreLugar) {
    document.getElementById('resultados-busqueda').innerHTML = '';
    document.getElementById('buscador-lugares').value = nombreLugar;

    if (!ubicacionUsuario) {
        alert('Necesitamos acceso a tu ubicación GPS.');
        return;
    }

    limpiarMapa();
    infoDestinoActual = { lat: latDestino, lng: lngDestino, nombre: nombreLugar };
    const opcionesMap = new Map(); 

    const minPorKmCaminando = 12; 
    const minPorParadaColectivo = 1.5; 

    // 1. Buscar paradas de origen cercanas
    let radioOrigenKm = 0.5;
    let origenesValidos = [];
    
    while (origenesValidos.length === 0 && radioOrigenKm <= 3.0) {
        for (const keyLinea in datosLineasCargados) {
            const linea = datosLineasCargados[keyLinea];
            linea.paradas.forEach((p, idx) => {
                const distCamina = calcularDistancia([ubicacionUsuario.lat, ubicacionUsuario.lng], [p.lat, p.lng]);
                if (distCamina <= radioOrigenKm) {
                    // Proyectamos el origen sobre el recorrido real para saber su posición exacta en la ruta
                    const proyOrigen = obtenerProyeccionEnRecorrido(linea.recorrido, [p.lat, p.lng]);
                    origenesValidos.push({ 
                        lineaKey: keyLinea, parada: p, idxOriginal: idx, 
                        proySeg: proyOrigen.indiceSegmento, distCamina: distCamina 
                    });
                }
            });
        }
        if (origenesValidos.length === 0) radioOrigenKm += 0.5;
    }

    if (origenesValidos.length === 0) {
        alert('No hay líneas operando cerca de tu ubicación actual.');
        return;
    }

    function registrarOpcion(clave, viaje, tiempo) {
        if (!opcionesMap.has(clave)) {
            viaje.tiempoEstimado = Math.round(tiempo);
            opcionesMap.set(clave, viaje);
        } else {
            const existente = opcionesMap.get(clave);
            if (viaje.metrosDestino < existente.metrosDestino || (viaje.metrosDestino === existente.metrosDestino && tiempo < existente.tiempoEstimado)) {
                viaje.tiempoEstimado = Math.round(tiempo);
                opcionesMap.set(clave, viaje);
            }
        }
    }

    // 2. Evaluar Viajes Directos usando la posición real en el recorrido
    for (const origen of origenesValidos) {
        const linea = datosLineasCargados[origen.lineaKey];
        
        linea.paradas.forEach((pDestino, idxDest) => {
            const proyDest = obtenerProyeccionEnRecorrido(linea.recorrido, [pDestino.lat, pDestino.lng]);
            
            // Verificamos que el segmento del destino esté estrictamente más adelante en la ruta
            if (proyDest.indiceSegmento > origen.proySeg) {
                const distCaminaFinal = calcularDistancia([latDestino, lngDestino], [pDestino.lat, pDestino.lng]);
                const paradasRecorridas = Math.abs(idxDest - origen.idxOriginal);
                
                const tiempoEstimado = (origen.distCamina * minPorKmCaminando) + (paradasRecorridas * minPorParadaColectivo) + (distCaminaFinal * minPorKmCaminando);

                const viajeDirecto = {
                    tipo: 'directo',
                    lineaKey: origen.lineaKey,
                    nombreLinea: linea.nombre,
                    origen: { parada: origen.parada, idx: origen.idxOriginal, dist: origen.distCamina },
                    destino: { parada: pDestino, idx: idxDest, dist: distCaminaFinal },
                    metrosDestino: Math.round(distCaminaFinal * 1000)
                };
                
                registrarOpcion('directo-' + origen.lineaKey, viajeDirecto, tiempoEstimado);
            }
        });
    }

    // 3. Evaluar Transbordos Dinámicos usando el recorrido real
    for (const origenL1 of origenesValidos) {
        const L1 = datosLineasCargados[origenL1.lineaKey];
        
        for (const keyL2 in datosLineasCargados) {
            if (origenL1.lineaKey === keyL2) continue;
            const L2 = datosLineasCargados[keyL2];

            L1.paradas.forEach((pBajadaL1, idxBajadaL1) => {
                const proyBajada = obtenerProyeccionEnRecorrido(L1.recorrido, [pBajadaL1.lat, pBajadaL1.lng]);
                
                if (proyBajada.indiceSegmento > origenL1.proySeg) {
                    
                    L2.paradas.forEach((pSubidaL2, idxSubidaL2) => {
                        const distEscalaCamina = calcularDistancia([pBajadaL1.lat, pBajadaL1.lng], [pSubidaL2.lat, pSubidaL2.lng]);
                        
                        if (distEscalaCamina <= 0.4) {
                            const proySubidaL2 = obtenerProyeccionEnRecorrido(L2.recorrido, [pSubidaL2.lat, pSubidaL2.lng]);
                            
                            L2.paradas.forEach((pDest2, idxDest2) => {
                                const proyDest2 = obtenerProyeccionEnRecorrido(L2.recorrido, [pDest2.lat, pDest2.lng]);
                                
                                if (proyDest2.indiceSegmento > proySubidaL2.indiceSegmento) {
                                    const distCaminaFinal = calcularDistancia([latDestino, lngDestino], [pDest2.lat, pDest2.lng]);
                                    
                                    const paradasL1 = Math.abs(idxBajadaL1 - origenL1.idxOriginal);
                                    const paradasL2 = Math.abs(idxDest2 - idxSubidaL2);
                                    
                                    const tiempoEstimado = 
                                        (origenL1.distCamina * minPorKmCaminando) + 
                                        (paradasL1 * minPorParadaColectivo) + 
                                        (distEscalaCamina * minPorKmCaminando) + 
                                        (paradasL2 * minPorParadaColectivo) + 
                                        (distCaminaFinal * minPorKmCaminando);

                                    const viajeTransbordo = {
                                        tipo: 'transbordo',
                                        L1: { key: origenL1.lineaKey, nombre: L1.nombre, origen: { parada: origenL1.parada, idx: origenL1.idxOriginal }, bajada: { parada: pBajadaL1, idx: idxBajadaL1 } },
                                        L2: { key: keyL2, nombre: L2.nombre, subida: { parada: pSubidaL2, idx: idxSubidaL2 }, destino: { parada: pDest2, idx: idxDest2 } },
                                        metrosDestino: Math.round(distCaminaFinal * 1000),
                                        distEscala: Math.round(distEscalaCamina * 1000)
                                    };
                                    
                                    registrarOpcion('transbordo-' + origenL1.lineaKey + '-' + keyL2, viajeTransbordo, tiempoEstimado);
                                }
                            });
                        }
                    });
                }
            });
        }
    }

    opcionesViajeActuales = Array.from(opcionesMap.values())
        .sort((a, b) => a.metrosDestino - b.metrosDestino || a.tiempoEstimado - b.tiempoEstimado)
        .slice(0, 3);

    if (opcionesViajeActuales.length === 0) {
        alert('No encontramos opciones viables para acercarte a ese destino.');
        return;
    }

    mostrarListaDeOpciones();
}
/** Genera un cartel flotante (modal) en el centro de la pantalla con solo las 2 mejores opciones */
function mostrarListaDeOpciones() {
    limpiarMapa();
    
    marcadorDestinoBuscado = L.marker([infoDestinoActual.lat, infoDestinoActual.lng]).addTo(mapa)
        .bindPopup(`📍 <b>Destino:</b> ${infoDestinoActual.nombre}`).openPopup();
    mapa.setView([infoDestinoActual.lat, infoDestinoActual.lng], 14);

    cerrarModalOpciones();

    const overlay = document.createElement('div');
    overlay.id = 'modal-opciones-viaje';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); z-index: 99999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(2px);';
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: white; width: 90%; max-width: 380px; border-radius: 12px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); font-family: sans-serif;';
    
    let htmlOpciones = `<h3 style="margin-top: 0; margin-bottom: 15px; font-size: 1.1rem; color: #1e293b; text-align: center;">🚌 3 mejores opciones para ir a:<br><span style="color: #2563eb;">${infoDestinoActual.nombre}</span></h3>`;
    
    // Generar botones limitados a 3
    opcionesViajeActuales.slice(0, 3).forEach((opcion, index) => {
        if (opcion.tipo === 'directo') {
            htmlOpciones += `
                <button onclick="seleccionarOpcionViaje(${index})" style="width: 100%; text-align: left; padding: 12px; margin-bottom: 10px; border: 2px solid #e2e8f0; border-radius: 8px; background: #f8fafc; cursor: pointer;">
                    <div style="font-weight: bold; color: #2563eb; font-size: 1.05rem;">🚌 ${opcion.nombreLinea} (Directo)</div>
                    <div style="font-size: 0.9rem; color: #475569; margin-top: 6px;">🚶 Te deja a <b>${opcion.metrosDestino}m</b> del lugar</div>
                    <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">⏱️ Tiempo aprox: ~${opcion.tiempoEstimado} min</div>
                </button>`;
        } else {
            htmlOpciones += `
                <button onclick="seleccionarOpcionViaje(${index})" style="width: 100%; text-align: left; padding: 12px; margin-bottom: 10px; border: 2px solid #fed7aa; border-radius: 8px; background: #fff7ed; cursor: pointer;">
                    <div style="font-weight: bold; color: #ea580c; font-size: 1.05rem;">🔄 ${opcion.L1.nombre} ➔ ${opcion.L2.nombre}</div>
                    <div style="font-size: 0.9rem; color: #475569; margin-top: 6px;">🚶 Te deja a <b>${opcion.metrosDestino}m</b> del lugar</div>
                    <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">⏱️ Tiempo aprox: ~${opcion.tiempoEstimado} min (escala de ${opcion.distEscala}m)</div>
                </button>`;
        }
    });

    htmlOpciones += `<button onclick="cerrarModalOpciones()" style="width: 100%; padding: 10px; margin-top: 5px; border: none; background: transparent; color: #64748b; cursor: pointer; font-weight: bold;">Cancelar</button>`;

    modalContent.innerHTML = htmlOpciones;
    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);
}

/** Genera un cartel flotante (modal) en el centro de la pantalla con las opciones */
function mostrarListaDeOpciones() {
    limpiarMapa();
    
    // Mostramos un pin en el destino para que el usuario se ubique de fondo
    marcadorDestinoBuscado = L.marker([infoDestinoActual.lat, infoDestinoActual.lng]).addTo(mapa)
        .bindPopup(`📍 <b>Destino:</b> ${infoDestinoActual.nombre}`).openPopup();
    mapa.setView([infoDestinoActual.lat, infoDestinoActual.lng], 14);

    // Si ya existe un modal anterior, lo borramos por seguridad
    cerrarModalOpciones();

    // 1. Crear el fondo oscuro del modal
    const overlay = document.createElement('div');
    overlay.id = 'modal-opciones-viaje';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); z-index: 99999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(2px);';
    
    // 2. Crear la caja central
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: white; width: 90%; max-width: 380px; max-height: 85vh; overflow-y: auto; border-radius: 12px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); font-family: sans-serif;';
    
    let htmlOpciones = `<h3 style="margin-top: 0; margin-bottom: 15px; font-size: 1.1rem; color: #1e293b; text-align: center;">🚌 Opciones para ir a:<br><span style="color: #2563eb;">${infoDestinoActual.nombre}</span></h3>`;
    
    // 3. Generar los botones de las rutas
    opcionesViajeActuales.slice(0, 4).forEach((opcion, index) => {
        if (opcion.tipo === 'directo') {
            htmlOpciones += `
                <button onclick="seleccionarOpcionViaje(${index})" style="width: 100%; text-align: left; padding: 12px; margin-bottom: 10px; border: 2px solid #e2e8f0; border-radius: 8px; background: #f8fafc; cursor: pointer;">
                    <div style="font-weight: bold; color: #2563eb; font-size: 1.05rem;">🚌 ${opcion.nombreLinea} (Directo)</div>
                    <div style="font-size: 0.9rem; color: #475569; margin-top: 6px;">⏱️ Tiempo total: <b>~${opcion.tiempoEstimado} min</b></div>
                    <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">📍 Caminás ${opcion.metrosDestino}m al llegar.</div>
                </button>`;
        } else {
            htmlOpciones += `
                <button onclick="seleccionarOpcionViaje(${index})" style="width: 100%; text-align: left; padding: 12px; margin-bottom: 10px; border: 2px solid #fed7aa; border-radius: 8px; background: #fff7ed; cursor: pointer;">
                    <div style="font-weight: bold; color: #ea580c; font-size: 1.05rem;">🔄 ${opcion.L1.nombre} ➔ ${opcion.L2.nombre}</div>
                    <div style="font-size: 0.9rem; color: #475569; margin-top: 6px;">⏱️ Tiempo total: <b>~${opcion.tiempoEstimado} min</b></div>
                    <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">🚶 Caminás ${opcion.distEscala}m en la escala y ${opcion.metrosDestino}m al destino.</div>
                </button>`;
        }
    });

    // 4. Agregar botón de cancelar
    htmlOpciones += `<button onclick="cerrarModalOpciones()" style="width: 100%; padding: 10px; margin-top: 5px; border: none; background: transparent; color: #64748b; cursor: pointer; font-weight: bold;">Cancelar</button>`;

    modalContent.innerHTML = htmlOpciones;
    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);
}

/** Cierra y destruye el cartel de opciones */
function cerrarModalOpciones() {
    const modal = document.getElementById('modal-opciones-viaje');
    if (modal) modal.remove();
}

/** Ejecuta los cambios en el mapa y la interfaz según la opción elegida por el usuario */
function seleccionarOpcionViaje(index) {
    // 1. Ocultar el cartel flotante apenas el usuario toca una opción
    cerrarModalOpciones();

    const viaje = opcionesViajeActuales[index];
    if (!viaje) return;

    limpiarMapa();
    
    // Botón para volver a ver las opciones en el panel lateral
    const btnVolver = `<button onclick="mostrarListaDeOpciones()" style="margin-top: 15px; width: 100%; padding: 8px; border: 1px solid #94a3b8; background: #f1f5f9; border-radius: 6px; cursor: pointer; font-weight: bold; color: #334155;">🔄 Cambiar de línea / Ver otras opciones</button>`;

    if (viaje.tipo === 'directo') {
        document.getElementById('select-linea').value = viaje.lineaKey;
        alCambiarLinea(viaje.lineaKey);
        setTimeout(() => {
            document.getElementById('select-destino').value = viaje.destino.idx;
            sugerenciaTemporal = { idxDestino: viaje.destino.idx, cercana: { parada: viaje.origen.parada, index: viaje.origen.idx, distanciaKm: viaje.origen.dist } };
            procesarRespuestaSugerencia(true);
            
            document.getElementById('resumen-viaje').innerHTML = `
                <div class="paso-itinerario"><p>🚌 Tomá la <b>${viaje.nombreLinea}</b> en <b>${viaje.origen.parada.nombre}</b>.</p></div>
                <div class="paso-itinerario"><p>📍 Bajate en <b>${viaje.destino.parada.nombre}</b> (a ${viaje.metrosDestino}m de tu destino).</p></div>
                <div style="font-weight: bold; color: #0f172a; margin-top: 10px;">⏱️ Tiempo total: ~${viaje.tiempoEstimado} min.</div>
                ${btnVolver}
            `;
            marcadorDestinoBuscado = L.marker([infoDestinoActual.lat, infoDestinoActual.lng]).addTo(mapa)
                .bindPopup(`📍 <b>Destino:</b> ${infoDestinoActual.nombre}<br>Caminás ${viaje.metrosDestino}m al bajar.`).openPopup();
            mapa.setView([infoDestinoActual.lat, infoDestinoActual.lng], 15);
        }, 150);
    } else {
        document.getElementById('select-linea').value = viaje.L1.key;
        alCambiarLinea(viaje.L1.key);
        setTimeout(() => {
            document.getElementById('select-destino').value = viaje.L1.bajada.idx;
            sugerenciaTemporal = { idxDestino: viaje.L1.bajada.idx, cercana: { parada: viaje.L1.origen.parada, index: viaje.L1.origen.idx, distanciaKm: 0 } };
            procesarRespuestaSugerencia(true);

            document.getElementById('resumen-viaje').innerHTML = `
                <div class="paso-itinerario"><p>🚌 <b>Tramo 1:</b> Tomá la <b>${viaje.L1.nombre}</b> en <b>${viaje.L1.origen.parada.nombre}</b> y bajate en <b>${viaje.L1.bajada.parada.nombre}</b>.</p></div>
                <div class="paso-itinerario" style="background: #fff7ed; padding: 10px; border-left: 4px solid #f97316;">
                    <p>🔄 <b>Escala:</b> Caminá ${viaje.distEscala}m hacia <b>${viaje.L2.subida.parada.nombre}</b> y tomá la <b>${viaje.L2.nombre}</b>.</p>
                </div>
                <div class="paso-itinerario"><p>📍 <b>Tramo 2:</b> Bajate en <b>${viaje.L2.destino.parada.nombre}</b> (a ${viaje.metrosDestino}m de tu destino final).</p></div>
                <div style="font-weight: bold; color: #0f172a; margin-top: 10px;">⏱️ Tiempo total: ~${viaje.tiempoEstimado} min.</div>
                ${btnVolver}
            `;
            dibujarTramoEscalaL2(viaje, infoDestinoActual.lat, infoDestinoActual.lng, infoDestinoActual.nombre);
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

    // 3. Tramo exacto que se va a viajar en L2 (Usamos el destino exacto que calculó el algoritmo, sin recalcular)
    const paradaSubidaL2 = mejorViaje.L2.subida.parada;
    const paradaDestinoFinalL2 = mejorViaje.L2.destino.parada;

    const proyOrigenL2 = obtenerProyeccionEnRecorrido(recorridoL2, [paradaSubidaL2.lat, paradaSubidaL2.lng]);
    const proyDestinoL2 = obtenerProyeccionEnRecorrido(recorridoL2, [paradaDestinoFinalL2.lat, paradaDestinoFinalL2.lng]);

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

    // 4. Marcadores de subida y bajada del transbordo (Con coordenadas exactas)
    marcadorTransbordoL2 = L.marker([paradaSubidaL2.lat, paradaSubidaL2.lng], {
        icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div style='background-color:#ef4444; color:white; padding:5px 10px; border-radius:10px; font-weight:bold; font-size:12px; white-space:nowrap; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3);'>🔄 Subí a ${mejorViaje.L2.nombre}</div>`,
            iconSize: [120, 30],
            iconAnchor: [60, 35]
        })
    }).addTo(mapa);

    marcadorDestinoFinalL2 = L.marker([paradaDestinoFinalL2.lat, paradaDestinoFinalL2.lng], { icon: iconoParadaBajada })
        .addTo(mapa)
        .bindPopup(`📍 <b>Bajada:</b> ${paradaDestinoFinalL2.nombre}<br>🚶 Caminás ${mejorViaje.metrosDestino}m hasta ${nombreLugar}`)
        .openPopup();

    // 5. Ajustar la cámara para que se vea todo.
    if (lineaTramoPolyline) {
        const bounds = lineaTramoPolyline.getBounds();
        bounds.extend(lineaTramoL2Polyline.getBounds());
        mapa.fitBounds(bounds, { padding: [40, 40] });
    } else {
        mapa.fitBounds(lineaTramoL2Polyline.getBounds(), { padding: [40, 40] });
    }
}
