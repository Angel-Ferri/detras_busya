// =====================================================
// Busya · PARTE 7 de 8 — SIMULADOR DE COLECTIVOS
// =====================================================
//
// La parte que hace "vivir" a los colectivos en el mapa.
//
// Cómo funciona:
//   · Se toma la grilla del día de hoy (la que trae la API).
//   · Cada viaje de la grilla es un fila de horas, una por parada de grilla.
//   · El bus está en movimiento entre la primera y la última hora del viaje.
//   · Se calcula en qué punto del recorrido está (proporción entre las horas
//     y la distancia recorrida) y se dibuja un bus en ese punto.
//
// El botón #btn-rastreo enciende y apaga todo esto.
//

/**
 * Enciende o apaga el rastreador de colectivos.
 *
 * OJO: no se tocca el innerHTML del botón, porque tiene markup propio
 * (ícono, título, estado y el interruptor). Lo que se cambia es el
 * atributo aria-pressed y el texto del estado; el interruptor se
 * dibuja con CSS a partir de aria-pressed.
 */
function alternarRastreoColectivos() {
    rastreoActivo = !rastreoActivo;

    const btn = document.getElementById('btn-rastreo');
    if (btn) {
        btn.setAttribute('aria-pressed', rastreoActivo ? 'true' : 'false');
        btn.classList.toggle('activo', rastreoActivo);

        const estado = btn.querySelector('.btn-rastreo-estado');
        if (estado) {
            estado.textContent = rastreoActivo ? 'Simulando en vivo' : 'Simulación apagada';
        }
    }

    if (rastreoActivo) {
        // Intentar encontrar una línea para rastrear
        if (!recorridoActual && typeof mejorViajeActual !== 'undefined' && mejorViajeActual) {
            if (mejorViajeActual.tipo === 'directo' && mejorViajeActual.lineaKey) {
                if (datosLineasCargados[mejorViajeActual.lineaKey]) {
                    recorridoActual = datosLineasCargados[mejorViajeActual.lineaKey];
                    recorridoActual.key = mejorViajeActual.lineaKey;
                }
            } else if (mejorViajeActual.tipo === 'transbordo' && mejorViajeActual.L1 && mejorViajeActual.L1.key) {
                if (datosLineasCargados[mejorViajeActual.L1.key]) {
                    recorridoActual = datosLineasCargados[mejorViajeActual.L1.key];
                    recorridoActual.key = mejorViajeActual.L1.key;
                }
            }
        }
        if (!recorridoActual) {
            const sel = document.getElementById('select-linea');
            if (sel && sel.value && datosLineasCargados[sel.value]) {
                recorridoActual = datosLineasCargados[sel.value];
                recorridoActual.key = sel.value;
            }
        }
        if (recorridoActual) {
            activarRastreoColectivos();
        } else {
            console.info('El rastreador quedó prendido, pero no hay una línea seleccionada.');
            rastreoActivo = true;
            if (btn) {
                btn.setAttribute('aria-pressed', 'true');
                btn.classList.add('activo');
                const estado = btn.querySelector('.btn-rastreo-estado');
                if (estado) estado.textContent = 'Simulando en vivo';
            }
            activarRastreoColectivos();
        }
    } else {
        detenerRastreoColectivos();
    }
}

/**
 * Apaga el simulador: corta el temporizador y borra los colectivos del mapa.
 */
function detenerRastreoColectivos() {
    if (bucleSimulacion) {
        clearInterval(bucleSimulacion);
        bucleSimulacion = null;
    }
    if (mapa) {
        marcadoresColectivos.forEach(m => mapa.removeLayer(m));
    }
    marcadoresColectivos = [];
}

/**
 * Prende el simulador: recalcula las posiciones y las actualiza cada segundo.
 */
function activarRastreoColectivos() {
    if (bucleSimulacion) clearInterval(bucleSimulacion);
    actualizarPosicionColectivos();
    bucleSimulacion = setInterval(actualizarPosicionColectivos, 1000);
}

/**
 * Calcula dónde está cada colectivo ahora y los dibuja en el mapa.
 *
 * Los datos salen de la grilla del día (horarios_por_dia de la API):
 * cada viaje es una fila alineada a la lista de paradas de grilla.
 */
function actualizarPosicionColectivos() {
    if (!rastreoActivo) return;
    
    // Determinar qué líneas mostrar: si hay transbordo, mostrar ambas
    const lineasAMostrar = [];
    if (mejorViajeActual) {
        if (mejorViajeActual.tipo === 'directo' && mejorViajeActual.lineaKey) {
            lineasAMostrar.push(mejorViajeActual.lineaKey);
        } else if (mejorViajeActual.tipo === 'transbordo') {
            if (mejorViajeActual.L1 && mejorViajeActual.L1.key) lineasAMostrar.push(mejorViajeActual.L1.key);
            if (mejorViajeActual.L2 && mejorViajeActual.L2.key) lineasAMostrar.push(mejorViajeActual.L2.key);
        }
    }
    if (lineasAMostrar.length === 0 && recorridoActual && recorridoActual.key) {
        lineasAMostrar.push(recorridoActual.key);
    }
    
    if (lineasAMostrar.length === 0) return;
    
    // Limpiar marcadores existentes
    if (mapa) {
        marcadoresColectivos.forEach(m => mapa.removeLayer(m));
    }
    marcadoresColectivos = [];
    
    const ahora = new Date();
    const segundosAhora = (ahora.getHours() * 3600) + (ahora.getMinutes() * 60) + ahora.getSeconds();
    const colectivosEnMovimiento = [];
    
    for (const keyLinea of lineasAMostrar) {
        const lineaDatos = datosLineasCargados[keyLinea];
        if (!lineaDatos || !lineaDatos.recorrido || lineaDatos.recorrido.length === 0) continue;
        
        // La grilla de hoy para la línea que está seleccionada.
        const servicio = obtenerServicioDeHoy(keyLinea);
        if (!servicio || !servicio.horarios || !servicio.horarios.length) {
            continue;
        }

        const recorridoCoords = lineaDatos.recorrido;
        const distanciasAcumuladas = calcularDistanciasAcumuladas(recorridoCoords);
        const distanciaTotal = distanciasAcumuladas[distanciasAcumuladas.length - 1];

        for (const fila of servicio.horarios) {
        // Paradas de grilla que sirve este viaje, con su hora.
        const paradasValidas = [];
        for (let i = 0; i < fila.length; i++) {
            const hora = fila[i];
            if (hora === null || hora === undefined || hora === '') continue;
            const minutos = obtenerMinutosDesdeCadena(hora);
            if (minutos === null) continue;
            paradasValidas.push({ nombre: servicio.paradas[i], segundos: minutos * 60 });
        }

        // Con menos de dos paradas no hay recorrido que dibujar.
        if (paradasValidas.length < 2) continue;

        let segInicio = paradasValidas[0].segundos;
        let segFin = paradasValidas[paradasValidas.length - 1].segundos;
        const nombreDestino = paradasValidas[paradasValidas.length - 1].nombre;

        // Un viaje que cruza la medianoche: se ajusta el día del tramo final.
        if (segFin < segInicio) {
            if (segundosAhora < segFin) {
                segInicio -= 24 * 3600;
            } else {
                segFin += 24 * 3600;
                paradasValidas.forEach(p => {
                    if (p.segundos < segInicio) p.segundos += 24 * 3600;
                });
            }
        }

        // Solo los viajes que están en marcha ahora.
        if (segundosAhora < segInicio || segundosAhora > segFin) continue;

        // Qué tan avanzado va el viaje (0 a 1) y qué distancia lleva recorrido.
        const progresoTiempo = (segundosAhora - segInicio) / (segFin - segInicio);
        const distanciaActual = progresoTiempo * distanciaTotal;

        // Del recorrido total, en qué punto exacto está.
        let latActual = recorridoCoords[0][0];
        let lngActual = recorridoCoords[0][1];
        for (let i = 0; i < distanciasAcumuladas.length - 1; i++) {
            if (distanciaActual >= distanciasAcumuladas[i] && distanciaActual <= distanciasAcumuladas[i + 1]) {
                const distTramo = distanciasAcumuladas[i + 1] - distanciasAcumuladas[i];
                const progresoTramo = distTramo > 0 ? (distanciaActual - distanciasAcumuladas[i]) / distTramo : 0;
                const p1 = recorridoCoords[i];
                const p2 = recorridoCoords[i + 1];
                latActual = p1[0] + (p2[0] - p1[0]) * progresoTramo;
                lngActual = p1[1] + (p2[1] - p1[1]) * progresoTramo;
                break;
            }
        }

        // Próxima parada del viaje y cuánto falta para llegar.
        let proximaParada = nombreDestino;
        let minRestantesProxima = Math.ceil((segFin - segundosAhora) / 60);
        for (const parada of paradasValidas) {
            if (parada.segundos > segundosAhora) {
                proximaParada = parada.nombre;
                minRestantesProxima = Math.ceil((parada.segundos - segundosAhora) / 60);
                break;
            }
        }

        const distanciaAlUsuario = ubicacionUsuario
            ? calcularDistancia([ubicacionUsuario.lat, ubicacionUsuario.lng], [latActual, lngActual])
            : 0;

        colectivosEnMovimiento.push({
            lat: latActual,
            lng: lngActual,
            destino: nombreDestino,
            proximaParada: proximaParada,
            minRestantesProxima: minRestantesProxima,
            distancia: distanciaAlUsuario,
            lineaKey: keyLinea,
            lineaNombre: lineaDatos.nombre || recorridoActual.nombre
        });
        }
    }

    // El colectivo más cercano al usuario va primero.
    if (ubicacionUsuario && colectivosEnMovimiento.length > 0) {
        colectivosEnMovimiento.sort((a, b) => a.distancia - b.distancia);
    }

    // Si cambió la cantidad de colectivos, se rehacen los marcadores.
    if (marcadoresColectivos.length !== colectivosEnMovimiento.length) {
        marcadoresColectivos.forEach(m => mapa.removeLayer(m));
        marcadoresColectivos = [];
        colectivosEnMovimiento.forEach(() => {
            const iconoEmojiBus = L.divIcon({
                className: 'custom-emoji-bus',
                html: '<div style="font-size: 28px; line-height: 1; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">🚌</div>',
                iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15]
            });
            marcadoresColectivos.push(L.marker([0, 0], { icon: iconoEmojiBus }).addTo(mapa));
        });
    }

    // Se mueven los marcadores y se actualiza su cartel.
    colectivosEnMovimiento.forEach((colectivo, index) => {
        const marcador = marcadoresColectivos[index];
        if (!marcador) return;
        marcador.setLatLng([colectivo.lat, colectivo.lng]);

        const etiqueta = index === 0 ? '📍 Más cercano a vos' : (index === 1 ? '🔜 Próximo' : '🚌 En recorrido');
        const textoSiguiente = colectivo.minRestantesProxima <= 1
            ? '¡Llegando!'
            : 'en ~' + colectivo.minRestantesProxima + ' min';

        const nombreLineaPop = colectivo.lineaNombre || (recorridoActual ? recorridoActual.nombre : '');
        const contenidoPopup = `
            <div style="text-align:center; min-width: 170px;">
                <b>${nombreLineaPop}</b><br>
                <b style="color:${index === 0 ? '#dc2626' : (index === 1 ? '#2563eb' : '#475569')};">${etiqueta}</b><br>
                <hr style="margin: 5px 0; border: 0; border-top: 1px solid #ccc;">
                <span style="color: #059669; font-weight: bold;">🚏 Próxima parada:</span><br>
                <span>${colectivo.proximaParada} <br><b>(${textoSiguiente})</b></span><br>
                <hr style="margin: 5px 0; border: 0; border-top: 1px dashed #ccc;">
                <small style="color: #666; font-size: 0.85em;">🏁 Termina en: ${colectivo.destino}</small>
            </div>
        `;

        const popup = marcador.getPopup();
        if (popup && popup.isOpen()) {
            popup.setContent(contenidoPopup);
        } else {
            marcador.bindPopup(contenidoPopup);
        }
    });
}
