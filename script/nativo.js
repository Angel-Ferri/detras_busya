// =====================================================
// Busya - Adaptador nativo (Capacitor / APK)
// =====================================================
//
// Este archivo no hace nada en el navegador. Dentro del APK:
//   - redirige navigator.geolocation al plugin nativo de Capacitor,
//     para que Android pida el permiso real de ubicación;
//   - maneja el botón "atrás" de Android;
//   - pinta la barra de estado con el azul de Busya.
//
// Se carga ANTES de los scripts de la aplicación, así el planificador
// encuentra la geolocalización ya adaptada cuando arranca.

(function () {
    'use strict';

    const esCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
    window.BUSYA_NATIVO = esCapacitor;

    /** Devuelve un plugin de Capacitor si está disponible. */
    function plugin(nombre) {
        try {
            return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[nombre]) || null;
        } catch (e) {
            return null;
        }
    }

    // -------------------------------------------------
    // 1. Geolocalización
    // -------------------------------------------------
    const Geo = plugin('Geolocation');

    if (Geo && navigator.geolocation) {
        const aCoords = (p) => ({
            coords: {
                latitude: p.coords.latitude,
                longitude: p.coords.longitude,
                accuracy: p.coords.accuracy,
                altitude: p.coords.altitude,
                altitudeAccuracy: p.coords.altitudeAccuracy,
                heading: p.coords.heading,
                speed: p.coords.speed
            },
            timestamp: p.timestamp || Date.now()
        });

        const pedirPermiso = async () => {
            try {
                const estado = await Geo.checkPermissions();
                if (estado.location !== 'granted') {
                    await Geo.requestPermissions({ permissions: ['location'] });
                }
            } catch (e) {
                console.warn('Busya: no se pudo pedir permiso de ubicación:', e);
            }
        };

        const geoNativa = {
            getCurrentPosition(success, error, options) {
                const opts = options || {};
                pedirPermiso()
                    .then(() => Geo.getCurrentPosition({
                        enableHighAccuracy: opts.enableHighAccuracy !== false,
                        timeout: opts.timeout || 10000,
                        maximumAge: opts.maximumAge || 0
                    }))
                    .then(p => success(aCoords(p)))
                    .catch(e => { if (typeof error === 'function') error(e); });
            },

            watchPosition(success, error, options) {
                const opts = options || {};
                let id = null;
                let cancelado = false;

                pedirPermiso()
                    .then(() => Geo.watchPosition({
                        enableHighAccuracy: opts.enableHighAccuracy !== false,
                        timeout: opts.timeout || 20000,
                        maximumAge: opts.maximumAge || 5000
                    }, (p, err) => {
                        if (err) {
                            if (typeof error === 'function') error(err);
                            return;
                        }
                        success(aCoords(p));
                    }))
                    .then(w => {
                        id = w;
                        if (cancelado) Geo.clearWatch({ id });
                    })
                    .catch(e => { if (typeof error === 'function') error(e); });

                return id || 0;
            },

            clearWatch(id) {
                if (!id) return;
                try { Geo.clearWatch({ id }); } catch (e) { /* nada */ }
            }
        };

        try {
            Object.defineProperty(navigator, 'geolocation', {
                configurable: true,
                enumerable: true,
                value: geoNativa
            });
        } catch (e) {
            console.warn('Busya: no se pudo instalar la geolocalización nativa:', e);
        }
    }

    // -------------------------------------------------
    // 2. Botón atrás de Android
    // -------------------------------------------------
    const App = plugin('App');

    if (App) {
        App.addListener('backButton', () => {
            const idsModales = [
                'modal-opciones-viaje',
                'modal-sugerencia-parada',
                'modal-caminar',
                'modal-cargando-viaje'
            ];

            for (const id of idsModales) {
                const el = document.getElementById(id);
                if (el && !el.classList.contains('hidden')) {
                    el.classList.add('hidden');
                    return;
                }
            }

            const enInicio = /(^|\/)index\.html?$/.test(location.pathname) ||
                location.pathname === '/' ||
                location.pathname === '';

            if (enInicio || history.length <= 1) {
                App.minimizeApp();
            } else {
                history.back();
            }
        });
    }

    // -------------------------------------------------
    // 3. Barra de estado
    // -------------------------------------------------
    const StatusBar = plugin('StatusBar');

    if (StatusBar) {
        StatusBar.setBackgroundColor({ color: '#2563eb' }).catch(() => {});
        StatusBar.setStyle({ style: 'LIGHT' }).catch(() => {});
    }
})();
