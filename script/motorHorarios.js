// ============================================================
// Busya â€” Motor compartido de horarios (paradas + como_llegar)
// ============================================================
// Fuente Ãºnica de verdad para:
//   - distancia entre paradas (traza o lÃ­nea recta)
//   - estimaciÃ³n de horarios (interpolaciÃ³n por distancia)
//   - minutos restantes con cruce de medianoche
//   - cachÃ© en memoria por (lineaKey, tipoDia)
//
// Cargado antes de paradas.js y horarios.js.

(function (global) {
    'use strict';

    const VELOCIDAD_FALLBACK_KMH = 25;
    const cache = new Map();

    function cacheKey(lineaKey, tipoDia) {
        return (lineaKey || '') + '|' + (tipoDia || '');
    }

    function distanciaKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Distancia acumulada a lo largo de la traza (o lÃ­nea recta entre paradas).
    // Devuelve un array del mismo largo que `paradas`, con la distancia acumulada
    // desde la primera parada hasta cada una.
    function distanciaAcumulada(paradas, recorridoCoords) {
        const n = paradas.length;
        const cum = new Array(n).fill(0);
        if (n === 0) return cum;

        if (Array.isArray(recorridoCoords) && recorridoCoords.length >= 2) {
            // Proyectar cada parada al vÃ©rtice mÃ¡s cercano de la traza.
            const idxs = paradas.map((p) => {
                let mejor = 0, mejorD = Infinity;
                for (let i = 0; i < recorridoCoords.length; i++) {
                    const v = recorridoCoords[i];
                    const d = distanciaKm(p.lat, (p.lng !== undefined ? p.lng : p.lon), v[0], v[1]);
                    if (d < mejorD) { mejorD = d; mejor = i; }
                }
                return mejor;
            });
            // Distancia acumulada a lo largo de la traza.
            const vertexCum = new Array(recorridoCoords.length).fill(0);
            for (let i = 1; i < recorridoCoords.length; i++) {
                vertexCum[i] = vertexCum[i - 1] + distanciaKm(
                    recorridoCoords[i - 1][0], recorridoCoords[i - 1][1],
                    recorridoCoords[i][0], recorridoCoords[i][1]
                );
            }
            for (let i = 0; i < n; i++) {
                cum[i] = vertexCum[idxs[i]];
            }
            // Asegurar monotonÃ­a creciente (si una parada proyecta a un vÃ©rtice anterior).
            for (let i = 1; i < n; i++) {
                if (cum[i] < cum[i - 1]) cum[i] = cum[i - 1];
            }
        } else {
            // LÃ­nea recta acumulada entre paradas consecutivas.
            for (let i = 1; i < n; i++) {
                const a = paradas[i - 1], b = paradas[i];
                cum[i] = cum[i - 1] + distanciaKm(
                    a.lat, (a.lng !== undefined ? a.lng : a.lon),
                    b.lat, (b.lng !== undefined ? b.lng : b.lon)
                );
            }
        }
        return cum;
    }

    function distanciaDeRuta(paradas, i, j) {
        // Suma de tramos consecutivos (lÃ­nea recta entre paradas vecinas).
        const desde = Math.min(i, j), hasta = Math.max(i, j);
        let total = 0;
        for (let k = desde; k < hasta; k++) {
            const a = paradas[k], b = paradas[k + 1];
            total += distanciaKm(
                a.lat, (a.lng !== undefined ? a.lng : a.lon),
                b.lat, (b.lng !== undefined ? b.lng : b.lon)
            );
        }
        return total;
    }

    function convertirHoraAMinutos(hora) {
        if (hora === null || hora === undefined) return null;
        const limpio = String(hora).replace(/\(estimado\)/i, '').trim();
        const partes = limpio.split(':');
        if (partes.length < 2) return null;
        const h = parseInt(partes[0], 10), m = parseInt(partes[1], 10);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    }

    function convertirMinutosAHora(minutos) {
        let m = minutos;
        while (m < 0) m += 1440;
        m = m % 1440;
        const h = Math.floor(m / 60);
        const mm = Math.round(m % 60);
        return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    }

    // Minutos restantes hasta una hora, con cruce de medianoche.
    function calcularMinutosRestantes(horaStr, ahora) {
        const limpio = String(horaStr || '').replace(/\(estimado\)/i, '').trim();
        const partes = limpio.split(':').map(Number);
        if (partes.length < 2 || isNaN(partes[0]) || isNaN(partes[1])) return -1;
        const minutosHorario = partes[0] * 60 + partes[1];
        const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
        let diff = minutosHorario - minutosAhora;
        // Servicio nocturno (00:00-04:00) visto desde la noche anterior.
        if (diff < -720) diff += 1440;
        return diff;
    }

    // EstimaciÃ³n full-day para una lÃ­nea (paradas + horarios oficiales).
    // paradas: [{nombre, lat, lng}], horariosBase: {nombreParada: "HH:MM"}
    // recorridoCoords: array de [lat, lng] (opcional, para distancia por traza)
    function calcularHorariosEstimados(paradas, horariosBase, recorridoCoords) {
        horariosBase = horariosBase || {};
        const cumDist = distanciaAcumulada(paradas, recorridoCoords);

        const headers = [];
        paradas.forEach((p, idx) => {
            const h = horariosBase[p.nombre];
            if (h) {
                const mins = convertirHoraAMinutos(h);
                if (mins !== null) headers.push({ idx, minutos: mins });
            }
        });

        const resultados = [];
        for (let i = 0; i < paradas.length; i++) {
            const p = paradas[i];
            const horaOficial = horariosBase[p.nombre];
            if (horaOficial) {
                resultados.push({ parada: p.nombre, hora: horaOficial, estimado: false, minutos: convertirHoraAMinutos(horaOficial) });
                continue;
            }
            // headers surrounding i
            let hAntes = null, hDespues = null;
            for (const h of headers) {
                if (h.idx < i && (!hAntes || h.idx > hAntes.idx)) hAntes = h;
                if (h.idx > i && (!hDespues || h.idx < hDespues.idx)) hDespues = h;
            }

            let minutos = null;
            if (hAntes && hDespues) {
                const distTotal = cumDist[hDespues.idx] - cumDist[hAntes.idx];
                const distParada = cumDist[i] - cumDist[hAntes.idx];
                let tTotal = hDespues.minutos - hAntes.minutos;
                if (tTotal < 0) tTotal += 1440;
                if (distTotal > 0) {
                    minutos = hAntes.minutos + (distParada / distTotal) * tTotal;
                } else {
                    minutos = hAntes.minutos;
                }
            } else if (hAntes) {
                const distKm = cumDist[i] - cumDist[hAntes.idx];
                const tiempoMin = (distKm / VELOCIDAD_FALLBACK_KMH) * 60;
                minutos = hAntes.minutos + tiempoMin;
            } else if (hDespues) {
                const distKm = cumDist[hDespues.idx] - cumDist[i];
                const tiempoMin = (distKm / VELOCIDAD_FALLBACK_KMH) * 60;
                minutos = hDespues.minutos - tiempoMin;
            }

            if (minutos !== null) {
                const m = Math.round(minutos);
                const hora = convertirMinutosAHora(m) + ' (estimado)';
                resultados.push({ parada: p.nombre, hora: hora, estimado: true, minutos: (m % 1440 + 1440) % 1440 });
            } else {
                resultados.push({ parada: p.nombre, hora: null, estimado: true, minutos: null });
            }
        }
        return resultados;
    }

    // CachÃ© por (lineaKey, tipoDia)
    function obtenerCacheado(lineaKey, tipoDia, factory) {
        const k = cacheKey(lineaKey, tipoDia);
        if (cache.has(k)) return cache.get(k);
        const v = factory();
        cache.set(k, v);
        return v;
    }

    function limpiarCache() { cache.clear(); }

    global.MotorHorarios = {
        distanciaKm,
        distanciaDeRuta,
        distanciaAcumulada,
        convertirHoraAMinutos,
        convertirMinutosAHora,
        calcularMinutosRestantes,
        calcularHorariosEstimados,
        obtenerCacheado,
        limpiarCache,
        VELOCIDAD_FALLBACK_KMH
    };
})(window);
