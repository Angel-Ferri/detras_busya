// ============================================================
// Busya · Editor de paradas
// ------------------------------------------------------------
// Lee y edita datos/paradas_manuales.json.
//
// - Guarda directo en el archivo si el navegador soporta
//   File System Access API (Chrome/Edge en localhost o HTTPS).
// - Si no, descarga el JSON para reemplazarlo a mano.
// - El planificador y paradas.html leen este mismo archivo.
// ============================================================

'use strict';

const ARCHIVO_PARADAS = 'datos/paradas_manuales.json';
const ARCHIVO_RECORRIDOS = 'datos/coordenadas/lineas_unificadas.json';

const LINEAS = {
    lineaa: { nombre: 'Línea A', corto: 'A', color: '#2563eb' },
    lineae: { nombre: 'Línea E', corto: 'E', color: '#16a34a' },
    lineaeste: { nombre: 'Línea Este', corto: 'Este', color: '#ea580c' },
    lineaoeste: { nombre: 'Línea Oeste', corto: 'Oeste', color: '#9333ea' }
};

const estado = {
    datos: null,
    lineasUnificadas: null,
    lineaActiva: 'lineaa',
    indiceSeleccionado: null,
    modo: 'idle', // idle | nueva | edicion
    busqueda: '',
    archivoVinculado: null,
    hayCambios: false,
    mapa: null,
    capaRecorrido: null,
    capaParadas: null,
    marcadorEdicion: null,
    marcadores: [],
    snapshotFormulario: '',
    temporizadorToast: null
};

const el = {};

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
    guardarReferencias();
    enlazarEventos();

    if (typeof L === 'undefined') {
        mostrarErrorFatal('No se pudo cargar Leaflet. Revisá la conexión y recargá la página.');
        return;
    }

    iniciarMapa();
    await cargarDatos();
}

function guardarReferencias() {
    const ids = [
        'pp-file-status', 'pp-open-file', 'pp-save', 'pp-line-name', 'pp-line-tabs',
        'pp-search', 'pp-add', 'pp-count', 'pp-dirty', 'pp-list', 'pp-map',
        'pp-map-hint', 'pp-editor-empty', 'pp-form', 'pp-form-kicker', 'pp-form-title',
        'pp-form-close', 'pp-name', 'pp-lat', 'pp-lng', 'pp-desc', 'pp-position',
        'pp-position-field', 'pp-position-help', 'pp-form-error', 'pp-apply',
        'pp-cancel', 'pp-delete', 'pp-gps', 'pp-coord-note', 'pp-toast'
    ];
    for (const id of ids) el[id] = document.getElementById(id);
}

function enlazarEventos() {
    el['pp-add'].addEventListener('click', abrirNuevaParada);
    el['pp-search'].addEventListener('input', () => {
        estado.busqueda = el['pp-search'].value;
        renderizarLista();
    });
    el['pp-search'].addEventListener('keydown', evento => {
        if (evento.key === 'Escape') {
            el['pp-search'].value = '';
            estado.busqueda = '';
            renderizarLista();
        }
    });

    el['pp-save'].addEventListener('click', guardarArchivo);
    el['pp-open-file'].addEventListener('click', vincularArchivo);

    el['pp-form'].addEventListener('submit', guardarParada);
    el['pp-cancel'].addEventListener('click', () => cerrarEditor(true));
    el['pp-form-close'].addEventListener('click', () => cerrarEditor(true));
    el['pp-delete'].addEventListener('click', eliminarParadaSeleccionada);
    el['pp-gps'].addEventListener('click', usarUbicacionActual);

    el['pp-lat'].addEventListener('input', () => sincronizarMarcadorEdicion());
    el['pp-lng'].addEventListener('input', () => sincronizarMarcadorEdicion());
    el['pp-lat'].addEventListener('change', validarCoordenadaVisual);
    el['pp-lng'].addEventListener('change', validarCoordenadaVisual);

    document.addEventListener('keydown', evento => {
        if (evento.key === 'Escape' && estado.modo !== 'idle') {
            cerrarEditor(true);
        }
    });

    window.addEventListener('beforeunload', evento => {
        if (estado.hayCambios || hayCambiosEnFormulario()) {
            evento.preventDefault();
            evento.returnValue = '';
        }
    });
}

function iniciarMapa() {
    estado.mapa = L.map('pp-map', {
        zoomControl: true,
        preferCanvas: true
    }).setView([-33.675, -65.46], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(estado.mapa);

    estado.capaRecorrido = L.layerGroup().addTo(estado.mapa);
    estado.capaParadas = L.layerGroup().addTo(estado.mapa);

    estado.mapa.on('click', evento => {
        if (estado.modo === 'idle') return;
        fijarCoordenadas(evento.latlng.lat, evento.latlng.lng);
        mostrarToast('Ubicación actualizada. Completá el nombre y guardá la parada.');
    });
}

async function cargarDatos() {
    try {
        const [respuestaParadas, respuestaRecorridos] = await Promise.all([
            fetch(ARCHIVO_PARADAS, { cache: 'no-store' }),
            fetch(ARCHIVO_RECORRIDOS, { cache: 'no-store' }).catch(() => null)
        ]);

        if (!respuestaParadas.ok) {
            throw new Error(`No se pudo leer ${ARCHIVO_PARADAS} (HTTP ${respuestaParadas.status}).`);
        }

        const archivo = await respuestaParadas.json();
        estado.datos = normalizarArchivo(archivo);

        if (respuestaRecorridos && respuestaRecorridos.ok) {
            estado.lineasUnificadas = await respuestaRecorridos.json();
        }

        estado.lineaActiva = Object.keys(LINEAS).find(
            clave => (estado.datos.lineas[clave]?.paradas || []).length > 0
        ) || 'lineaa';

        estado.hayCambios = false;
        renderizarTodo();
        ajustarMapaALinea();
        actualizarEstadoArchivo();
        actualizarBotonGuardar();
    } catch (error) {
        console.error(error);
        mostrarErrorFatal(
            'No se pudieron cargar las paradas. ' +
            'Abrí el proyecto con un servidor local (por ejemplo, npx serve .) y recargá esta página.\n\n' +
            error.message
        );
    }
}

function normalizarArchivo(archivo) {
    if (!archivo || typeof archivo !== 'object' || !archivo.lineas || typeof archivo.lineas !== 'object') {
        throw new Error('El archivo no tiene la forma esperada: falta la propiedad "lineas".');
    }

    let totalParadas = 0;

    for (const clave of Object.keys(LINEAS)) {
        const linea = archivo.lineas[clave];
        if (!linea || typeof linea !== 'object') {
            throw new Error(`El archivo no tiene la línea ${LINEAS[clave].nombre}.`);
        }
        if (!Array.isArray(linea.paradas)) {
            throw new Error(`La línea ${LINEAS[clave].nombre} no tiene una lista de paradas válida.`);
        }
        if (!linea.nombre) linea.nombre = LINEAS[clave].nombre;

        linea.paradas = linea.paradas.map((parada, indice) => {
            const copia = { ...parada };
            const latOriginal = copia.lat;
            const lngOriginal = copia.lng !== undefined && copia.lng !== null && copia.lng !== ''
                ? copia.lng
                : copia.lon;

            copia.nombre = String(copia.nombre || '').trim();
            copia.lat = Number(latOriginal);
            copia.lng = Number(lngOriginal);

            const coordenadasVacias =
                latOriginal === null || latOriginal === '' ||
                lngOriginal === null || lngOriginal === '' || lngOriginal === undefined;

            if (!copia.nombre || coordenadasVacias || !Number.isFinite(copia.lat) || !Number.isFinite(copia.lng)) {
                throw new Error(
                    `La parada ${indice + 1} de ${LINEAS[clave].nombre} no tiene nombre o coordenadas válidas. ` +
                    'Corregí el archivo antes de abrirlo en el editor.'
                );
            }

            return copia;
        });

        totalParadas += linea.paradas.length;
    }

    if (totalParadas === 0) {
        throw new Error('El archivo no contiene paradas válidas de Busya.');
    }

    return archivo;
}

// ============================================================
// Render
// ============================================================

function renderizarTodo() {
    renderizarPestanas();
    renderizarLista();
    renderizarMapa();
    sincronizarMarcadorEdicion();
    actualizarCabeceraLinea();
    actualizarEstadoArchivo();
}

function renderizarPestanas() {
    el['pp-line-tabs'].innerHTML = '';

    for (const [clave, config] of Object.entries(LINEAS)) {
        const cantidad = (estado.datos.lineas[clave]?.paradas || []).length;
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'pp-line-tab' + (clave === estado.lineaActiva ? ' is-active' : '');
        boton.setAttribute('role', 'tab');
        boton.setAttribute('aria-selected', clave === estado.lineaActiva ? 'true' : 'false');
        boton.title = `${config.nombre}: ${cantidad} paradas`;

        const nombre = document.createElement('span');
        nombre.textContent = config.corto;
        const cuenta = document.createElement('small');
        cuenta.textContent = cantidad;
        boton.append(nombre, cuenta);

        boton.addEventListener('click', () => cambiarLinea(clave));
        el['pp-line-tabs'].appendChild(boton);
    }
}

function renderizarLista() {
    const paradas = obtenerParadas();
    const termino = normalizarTexto(estado.busqueda);
    const filtradas = paradas
        .map((parada, indice) => ({ parada, indice }))
        .filter(({ parada }) => !termino || normalizarTexto(parada.nombre).includes(termino));

    el['pp-list'].innerHTML = '';
    el['pp-count'].textContent = `${paradas.length} parada${paradas.length === 1 ? '' : 's'}`;

    if (filtradas.length === 0) {
        const vacio = document.createElement('li');
        vacio.className = 'pp-empty-list';
        vacio.textContent = paradas.length === 0
            ? 'Esta línea todavía no tiene paradas. Usá “+ Agregar” para crear la primera.'
            : 'No hay paradas que coincidan con la búsqueda.';
        el['pp-list'].appendChild(vacio);
        return;
    }

    for (const { parada, indice } of filtradas) {
        const item = document.createElement('li');
        item.className = 'pp-list-item' +
            (indice === estado.indiceSeleccionado && estado.modo === 'edicion' ? ' is-selected' : '');
        item.tabIndex = 0;
        item.dataset.indice = String(indice);

        const numero = document.createElement('span');
        numero.className = 'pp-item-index';
        numero.textContent = String(indice + 1);

        const cuerpo = document.createElement('span');
        cuerpo.className = 'pp-item-body';
        const nombre = document.createElement('span');
        nombre.className = 'pp-item-name';
        nombre.textContent = parada.nombre;
        nombre.title = parada.nombre;
        const coordenadas = document.createElement('span');
        coordenadas.className = 'pp-item-coords';
        coordenadas.textContent = `${formatearCoordenada(parada.lat)}, ${formatearCoordenada(parada.lng)}`;
        cuerpo.append(nombre, coordenadas);

        const acciones = document.createElement('span');
        acciones.className = 'pp-item-actions';

        const botonArriba = crearBotonMini('↑', 'Subir una posición', indice === 0, evento => {
            evento.stopPropagation();
            moverParada(indice, -1);
        });
        const botonAbajo = crearBotonMini('↓', 'Bajar una posición', indice === paradas.length - 1, evento => {
            evento.stopPropagation();
            moverParada(indice, 1);
        });
        const botonEditar = crearBotonMini('✎', 'Editar parada', false, evento => {
            evento.stopPropagation();
            abrirEdicion(indice);
        });
        const botonEliminar = crearBotonMini('🗑', 'Eliminar parada', false, evento => {
            evento.stopPropagation();
            eliminarParada(indice);
        });

        acciones.append(botonArriba, botonAbajo, botonEditar, botonEliminar);
        item.append(numero, cuerpo, acciones);

        item.addEventListener('click', () => abrirEdicion(indice));
        item.addEventListener('keydown', evento => {
            if (evento.target !== item) return;
            if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                abrirEdicion(indice);
            }
        });

        el['pp-list'].appendChild(item);
    }
}

function crearBotonMini(texto, titulo, deshabilitado, alHacerClic) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'pp-mini-btn';
    boton.textContent = texto;
    boton.title = titulo;
    boton.setAttribute('aria-label', titulo);
    boton.disabled = deshabilitado;
    boton.addEventListener('click', alHacerClic);
    return boton;
}

function renderizarMapa() {
    if (!estado.mapa) return;

    estado.capaRecorrido.clearLayers();
    estado.capaParadas.clearLayers();
    estado.marcadores = [];

    const color = LINEAS[estado.lineaActiva].color;
    const recorrido = obtenerRecorrido();

    if (recorrido.length > 1) {
        L.polyline(recorrido, {
            color,
            weight: 4,
            opacity: 0.55,
            lineJoin: 'round'
        }).addTo(estado.capaRecorrido);
    }

    const paradas = obtenerParadas();
    paradas.forEach((parada, indice) => {
        const seleccionada = estado.modo === 'edicion' && indice === estado.indiceSeleccionado;
        const marcador = L.circleMarker([parada.lat, parada.lng], {
            radius: seleccionada ? 9 : 6,
            color: seleccionada ? '#f59e0b' : '#ffffff',
            weight: seleccionada ? 3 : 2,
            fillColor: color,
            fillOpacity: 1
        });

        marcador.bindTooltip(
            `${indice + 1}. ${escaparHTML(parada.nombre)}`,
            { direction: 'top', offset: [0, -6] }
        );

        marcador.on('click', () => abrirEdicion(indice));
        marcador.addTo(estado.capaParadas);
        estado.marcadores.push(marcador);
    });
}

function actualizarCabeceraLinea() {
    el['pp-line-name'].textContent = obtenerNombreLinea();
}

function actualizarEstadoArchivo() {
    if (!estado.datos) return;

    el['pp-dirty'].classList.toggle('hidden', !estado.hayCambios);

    if (estado.hayCambios) {
        el['pp-file-status'].textContent = 'Cambios sin guardar';
        el['pp-file-status'].classList.remove('is-linked');
        return;
    }

    if (estado.archivoVinculado) {
        el['pp-file-status'].textContent = `Archivo vinculado: ${estado.archivoVinculado.name}`;
        el['pp-file-status'].classList.add('is-linked');
    } else {
        el['pp-file-status'].textContent = 'Datos cargados desde el servidor';
        el['pp-file-status'].classList.remove('is-linked');
    }
}

function actualizarBotonGuardar() {
    if (soportaFileSystemAccess()) {
        el['pp-save'].textContent = 'Guardar';
        el['pp-open-file'].classList.remove('hidden');
    } else {
        el['pp-save'].textContent = 'Descargar JSON';
        el['pp-open-file'].classList.add('hidden');
    }
}

// ============================================================
// Línea y selección
// ============================================================

function cambiarLinea(clave) {
    if (clave === estado.lineaActiva) return;
    if (!confirmarDescarteFormulario('Hay una parada sin guardar en el formulario. ¿Cambiar de línea igual?')) return;

    estado.lineaActiva = clave;
    estado.indiceSeleccionado = null;
    estado.modo = 'idle';
    estado.busqueda = '';
    el['pp-search'].value = '';
    cerrarFormulario(false);
    renderizarTodo();
    ajustarMapaALinea();
}

function obtenerParadas() {
    return estado.datos?.lineas?.[estado.lineaActiva]?.paradas || [];
}

function obtenerNombreLinea() {
    return estado.datos?.lineas?.[estado.lineaActiva]?.nombre || LINEAS[estado.lineaActiva].nombre;
}

function obtenerRecorrido() {
    const recorrido = estado.lineasUnificadas?.lineas?.[estado.lineaActiva]?.recorrido;
    if (!Array.isArray(recorrido)) return [];

    return recorrido
        .map(coordenada => {
            if (Array.isArray(coordenada)) {
                return [Number(coordenada[0]), Number(coordenada[1])];
            }
            if (coordenada && typeof coordenada === 'object') {
                return [
                    Number(coordenada.lat !== undefined ? coordenada.lat : coordenada[0]),
                    Number(coordenada.lng !== undefined ? coordenada.lng : (coordenada.lon !== undefined ? coordenada.lon : coordenada[1]))
                ];
            }
            return null;
        })
        .filter(coordenada =>
            coordenada &&
            Number.isFinite(coordenada[0]) &&
            Number.isFinite(coordenada[1])
        );
}

function ajustarMapaALinea() {
    const puntos = [
        ...obtenerParadas().map(parada => [parada.lat, parada.lng]),
        ...obtenerRecorrido()
    ];

    if (puntos.length === 0) return;
    if (puntos.length === 1) {
        estado.mapa.setView(puntos[0], 16);
        return;
    }

    estado.mapa.fitBounds(L.latLngBounds(puntos), {
        padding: [30, 30],
        maxZoom: 16
    });
}

// ============================================================
// Formulario
// ============================================================

function abrirNuevaParada() {
    if (!confirmarDescarteFormulario('Hay una parada sin guardar. ¿Descartarla y crear otra?')) return;

    const paradas = obtenerParadas();
    const indiceBase = estado.modo === 'edicion' ? estado.indiceSeleccionado : null;
    const paradaBase = indiceBase !== null ? paradas[indiceBase] : null;
    const centro = estado.mapa.getCenter();

    estado.modo = 'nueva';
    estado.indiceSeleccionado = null;

    el['pp-name'].value = '';
    el['pp-lat'].value = String(paradaBase ? paradaBase.lat : redondear(centro.lat, 6));
    el['pp-lng'].value = String(paradaBase ? paradaBase.lng : redondear(centro.lng, 6));
    el['pp-desc'].value = '';
    el['pp-position'].max = String(paradas.length + 1);
    el['pp-position'].value = String(indiceBase !== null ? indiceBase + 2 : paradas.length + 1);

    mostrarFormulario();
    actualizarTituloFormulario();
    renderizarLista();
    renderizarMapa();
    sincronizarMarcadorEdicion();
    actualizarAyudaPosicion();
    guardarSnapshotFormulario();
    limpiarErrorFormulario();
    el['pp-name'].focus();
}

function abrirEdicion(indice) {
    if (indice < 0 || indice >= obtenerParadas().length) return;
    if (!confirmarDescarteFormulario('Hay cambios sin guardar en el formulario. ¿Descartarlos?')) return;

    const parada = obtenerParadas()[indice];
    estado.modo = 'edicion';
    estado.indiceSeleccionado = indice;

    el['pp-name'].value = parada.nombre;
    el['pp-lat'].value = String(parada.lat);
    el['pp-lng'].value = String(parada.lng);
    el['pp-desc'].value = parada.descripcion || '';
    el['pp-position'].max = String(obtenerParadas().length);
    el['pp-position'].value = String(indice + 1);

    mostrarFormulario();
    actualizarTituloFormulario();
    renderizarLista();
    renderizarMapa();
    sincronizarMarcadorEdicion();
    actualizarAyudaPosicion();
    guardarSnapshotFormulario();
    limpiarErrorFormulario();

    estado.mapa.panTo([parada.lat, parada.lng]);
}

function mostrarFormulario() {
    el['pp-editor-empty'].classList.add('hidden');
    el['pp-form'].classList.remove('hidden');
    el['pp-map'].classList.add('is-picking');
    el['pp-map-hint'].textContent = estado.modo === 'nueva'
        ? 'Hacé clic en el mapa para ubicar la parada nueva.'
        : 'Hacé clic en el mapa para mover la parada en edición.';
}

function cerrarFormulario(renderizar) {
    estado.modo = 'idle';
    estado.indiceSeleccionado = null;
    el['pp-form'].classList.add('hidden');
    el['pp-editor-empty'].classList.remove('hidden');
    el['pp-map'].classList.remove('is-picking');
    el['pp-map-hint'].textContent = 'Hacé clic en el mapa para ubicar una parada nueva.';
    eliminarMarcadorEdicion();

    if (renderizar) {
        renderizarLista();
        renderizarMapa();
    }
}

function cerrarEditor(confirmar) {
    if (confirmar && !confirmarDescarteFormulario('Hay cambios sin guardar en el formulario. ¿Cerrar igual?')) return;
    cerrarFormulario(true);
}

function actualizarTituloFormulario() {
    const esNueva = estado.modo === 'nueva';
    el['pp-form-kicker'].textContent = esNueva ? 'Nueva parada' : 'Editar parada';
    el['pp-form-title'].textContent = esNueva
        ? 'Agregar parada'
        : `Parada #${estado.indiceSeleccionado + 1}`;
    el['pp-delete'].classList.toggle('hidden', esNueva);
    el['pp-apply'].textContent = esNueva ? 'Agregar parada' : 'Guardar cambios';
}

function actualizarAyudaPosicion() {
    const cantidad = obtenerParadas().length;
    const esNueva = estado.modo === 'nueva';
    el['pp-position-help'].textContent = esNueva
        ? `1 = primera parada · ${cantidad + 1} = al final`
        : `1 = primera parada · ${cantidad} = última`;
}

function guardarParada(evento) {
    evento.preventDefault();
    limpiarErrorFormulario();

    const paradas = obtenerParadas();
    const nombre = el['pp-name'].value.trim();
    const lat = numeroDesdeInput(el['pp-lat'].value);
    const lng = numeroDesdeInput(el['pp-lng'].value);
    const descripcion = el['pp-desc'].value.trim();
    const esNueva = estado.modo === 'nueva';
    const posicion = numeroDesdeInput(el['pp-position'].value);
    const maximo = esNueva ? paradas.length + 1 : paradas.length;

    if (!nombre) return mostrarErrorFormulario('Escribí el nombre de la parada.');
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return mostrarErrorFormulario('La latitud tiene que ser un número entre -90 y 90.');
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        return mostrarErrorFormulario('La longitud tiene que ser un número entre -180 y 180.');
    }
    if (!Number.isInteger(posicion) || posicion < 1 || posicion > maximo) {
        return mostrarErrorFormulario(`La posición tiene que estar entre 1 y ${maximo}.`);
    }

    if (!coordenadaDentroDeVillaMercedes(lat, lng)) {
        const continuar = confirm(
            'La parada queda fuera del área habitual de Villa Mercedes.\n\n' +
            '¿Querés guardarla igual?'
        );
        if (!continuar) return;
    }

    let indiceFinal;

    if (esNueva) {
        const nueva = { nombre, lat, lng };
        if (descripcion) nueva.descripcion = descripcion;
        paradas.splice(posicion - 1, 0, nueva);
        indiceFinal = posicion - 1;
        estado.modo = 'edicion';
    } else {
        const anterior = paradas[estado.indiceSeleccionado];
        const actualizada = { ...anterior, nombre, lat, lng };
        if (descripcion) {
            actualizada.descripcion = descripcion;
        } else {
            delete actualizada.descripcion;
        }

        paradas.splice(estado.indiceSeleccionado, 1);
        paradas.splice(posicion - 1, 0, actualizada);
        indiceFinal = posicion - 1;
    }

    estado.indiceSeleccionado = indiceFinal;
    estado.hayCambios = true;

    renderizarTodo();
    el['pp-position'].max = String(paradas.length);
    el['pp-position'].value = String(indiceFinal + 1);
    actualizarTituloFormulario();
    actualizarAyudaPosicion();
    guardarSnapshotFormulario();

    mostrarToast(esNueva ? 'Parada agregada. No olvides guardar el archivo.' : 'Parada actualizada.');
}

function eliminarParadaSeleccionada() {
    if (estado.modo !== 'edicion' || estado.indiceSeleccionado === null) return;
    eliminarParada(estado.indiceSeleccionado);
}

function eliminarParada(indice) {
    const paradas = obtenerParadas();
    const parada = paradas[indice];
    if (!parada) return;

    if (!confirm(`¿Eliminar la parada "${parada.nombre}"?\n\nEsta acción no se puede deshacer.`)) return;

    const estabaEditando = estado.modo === 'edicion';
    paradas.splice(indice, 1);
    estado.hayCambios = true;

    if (estabaEditando && estado.indiceSeleccionado === indice) {
        cerrarFormulario(false);
    } else if (estabaEditando && estado.indiceSeleccionado > indice) {
        estado.indiceSeleccionado -= 1;
    }

    renderizarTodo();

    if (estado.modo === 'edicion') {
        el['pp-position'].max = String(paradas.length);
        el['pp-position'].value = String(estado.indiceSeleccionado + 1);
        actualizarTituloFormulario();
        actualizarAyudaPosicion();
        actualizarSnapshotPosicion();
    } else if (estado.modo === 'nueva') {
        const maximo = paradas.length + 1;
        const posicionActual = numeroDesdeInput(el['pp-position'].value);
        el['pp-position'].max = String(maximo);
        if (!Number.isInteger(posicionActual) || posicionActual > maximo) {
            el['pp-position'].value = String(maximo);
        }
        actualizarAyudaPosicion();
        actualizarSnapshotPosicion();
    }

    mostrarToast('Parada eliminada. No olvides guardar el archivo.');
}

function moverParada(indice, delta) {
    const paradas = obtenerParadas();
    const destino = indice + delta;
    if (destino < 0 || destino >= paradas.length) return;

    [paradas[indice], paradas[destino]] = [paradas[destino], paradas[indice]];

    if (estado.modo === 'edicion' && estado.indiceSeleccionado === indice) {
        estado.indiceSeleccionado = destino;
    } else if (estado.modo === 'edicion' && estado.indiceSeleccionado === destino) {
        estado.indiceSeleccionado = indice;
    }

    estado.hayCambios = true;
    renderizarTodo();

    if (estado.modo === 'edicion') {
        el['pp-position'].value = String(estado.indiceSeleccionado + 1);
        actualizarTituloFormulario();
        actualizarAyudaPosicion();
        actualizarSnapshotPosicion();
    }
}

// ============================================================
// Coordenadas y marcador
// ============================================================

function fijarCoordenadas(lat, lng) {
    el['pp-lat'].value = String(redondear(lat, 6));
    el['pp-lng'].value = String(redondear(lng, 6));
    sincronizarMarcadorEdicion();
    validarCoordenadaVisual();
}

function sincronizarMarcadorEdicion() {
    if (!estado.mapa || estado.modo === 'idle') {
        eliminarMarcadorEdicion();
        return;
    }

    const lat = numeroDesdeInput(el['pp-lat'].value);
    const lng = numeroDesdeInput(el['pp-lng'].value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        eliminarMarcadorEdicion();
        return;
    }

    if (estado.marcadorEdicion) {
        estado.marcadorEdicion.setLatLng([lat, lng]);
        return;
    }

    const icono = L.divIcon({
        className: 'pp-edit-marker',
        html: '<div class="pp-edit-pin"><span>📍</span></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
    });

    estado.marcadorEdicion = L.marker([lat, lng], {
        icon: icono,
        draggable: true,
        zIndexOffset: 1000
    }).addTo(estado.mapa);

    estado.marcadorEdicion.on('dragend', () => {
        const posicion = estado.marcadorEdicion.getLatLng();
        el['pp-lat'].value = String(redondear(posicion.lat, 6));
        el['pp-lng'].value = String(redondear(posicion.lng, 6));
        validarCoordenadaVisual();
        mostrarToast('Ubicación actualizada con el marcador.');
    });
}

function eliminarMarcadorEdicion() {
    if (estado.marcadorEdicion) {
        estado.mapa.removeLayer(estado.marcadorEdicion);
        estado.marcadorEdicion = null;
    }
}

function validarCoordenadaVisual() {
    const lat = numeroDesdeInput(el['pp-lat'].value);
    const lng = numeroDesdeInput(el['pp-lng'].value);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        el['pp-coord-note'].textContent = 'También podés hacer clic en el mapa.';
        return;
    }

    el['pp-coord-note'].textContent = coordenadaDentroDeVillaMercedes(lat, lng)
        ? 'También podés hacer clic en el mapa.'
        : '⚠️ Esta coordenada queda fuera del área habitual de Villa Mercedes.';
}

function usarUbicacionActual() {
    if (!navigator.geolocation) {
        mostrarToast('Este navegador no soporta geolocalización.', 'error');
        return;
    }

    el['pp-gps'].disabled = true;
    el['pp-gps'].textContent = 'Ubicando…';

    navigator.geolocation.getCurrentPosition(
        posicion => {
            fijarCoordenadas(posicion.coords.latitude, posicion.coords.longitude);
            estado.mapa.setView([posicion.coords.latitude, posicion.coords.longitude], 17);
            el['pp-gps'].disabled = false;
            el['pp-gps'].textContent = '📍 Usar mi ubicación';
            mostrarToast('Ubicación tomada del GPS.');
        },
        error => {
            console.warn(error);
            el['pp-gps'].disabled = false;
            el['pp-gps'].textContent = '📍 Usar mi ubicación';
            mostrarToast('No se pudo obtener la ubicación. Revisá los permisos del navegador.', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function coordenadaDentroDeVillaMercedes(lat, lng) {
    return lat >= -33.76 && lat <= -33.59 && lng >= -65.57 && lng <= -65.37;
}

// ============================================================
// Guardar / abrir archivo
// ============================================================

async function guardarArchivo() {
    if (!estado.datos) return;

    if (hayCambiosEnFormulario()) {
        mostrarToast('Primero guardá la parada con el botón del formulario.', 'error');
        el['pp-name'].focus();
        return;
    }

    actualizarFechaArchivo();
    const contenido = JSON.stringify(estado.datos, null, 2) + '\n';

    if (!soportaFileSystemAccess()) {
        descargarJSON(contenido);
        return;
    }

    try {
        let archivo = estado.archivoVinculado;

        if (!archivo) {
            archivo = await window.showSaveFilePicker({
                id: 'busya-paradas',
                suggestedName: 'paradas_manuales.json',
                types: [{
                    description: 'Archivo JSON de paradas',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            estado.archivoVinculado = archivo;
        }

        const permiso = await asegurarPermisoEscritura(archivo);
        if (!permiso) {
            mostrarToast('No diste permiso para escribir el archivo.', 'error');
            return;
        }

        const escritura = await archivo.createWritable();
        await escritura.write(contenido);
        await escritura.close();

        estado.hayCambios = false;
        actualizarEstadoArchivo();
        mostrarToast(`Guardado en ${archivo.name || 'paradas_manuales.json'}.`, 'success');
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error(error);
        mostrarToast('No se pudo guardar el archivo: ' + error.message, 'error');
    }
}

async function vincularArchivo() {
    if (!soportaFileSystemAccess()) return;

    if (estado.hayCambios && !confirm('Hay cambios sin guardar. ¿Abrir otro archivo y descartarlos?')) return;

    try {
        const [archivo] = await window.showOpenFilePicker({
            id: 'busya-paradas',
            multiple: false,
            types: [{
                description: 'Archivo JSON de paradas',
                accept: { 'application/json': ['.json'] }
            }]
        });

        const file = await archivo.getFile();
        const texto = await file.text();
        const datos = JSON.parse(texto);

        estado.datos = normalizarArchivo(datos);
        estado.archivoVinculado = archivo;
        estado.hayCambios = false;
        estado.modo = 'idle';
        estado.indiceSeleccionado = null;
        estado.busqueda = '';
        el['pp-search'].value = '';

        cerrarFormulario(false);
        renderizarTodo();
        ajustarMapaALinea();
        mostrarToast(`Archivo vinculado: ${archivo.name}.`, 'success');
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error(error);
        mostrarToast('No se pudo abrir el archivo: ' + error.message, 'error');
    }
}

function asegurarPermisoEscritura(archivo) {
    if (!archivo.queryPermission) return true;

    return archivo.queryPermission({ mode: 'readwrite' }).then(permiso => {
        if (permiso === 'granted') return true;
        return archivo.requestPermission({ mode: 'readwrite' })
            .then(resultado => resultado === 'granted');
    });
}

function descargarJSON(contenido) {
    const blob = new Blob([contenido], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'paradas_manuales.json';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    mostrarToast(
        'JSON descargado. Reemplazá datos/paradas_manuales.json para publicar los cambios.',
        'success'
    );
}

function actualizarFechaArchivo() {
    const ahora = new Date();
    const pad = numero => String(numero).padStart(2, '0');
    estado.datos._actualizado = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`;
}

function soportaFileSystemAccess() {
    return typeof window.showOpenFilePicker === 'function' &&
        typeof window.showSaveFilePicker === 'function' &&
        window.isSecureContext;
}

// ============================================================
// Formulario: utilidades
// ============================================================

function mostrarErrorFormulario(mensaje) {
    el['pp-form-error'].textContent = mensaje;
    el['pp-form-error'].classList.remove('hidden');
}

function limpiarErrorFormulario() {
    el['pp-form-error'].textContent = '';
    el['pp-form-error'].classList.add('hidden');
}

function guardarSnapshotFormulario() {
    estado.snapshotFormulario = JSON.stringify(leerFormulario());
}

function actualizarSnapshotPosicion() {
    try {
        const snapshot = JSON.parse(estado.snapshotFormulario || '{}');
        snapshot.posicion = el['pp-position'].value;
        estado.snapshotFormulario = JSON.stringify(snapshot);
    } catch {
        guardarSnapshotFormulario();
    }
}

function leerFormulario() {
    return {
        nombre: el['pp-name'].value.trim(),
        lat: el['pp-lat'].value,
        lng: el['pp-lng'].value,
        descripcion: el['pp-desc'].value.trim(),
        posicion: el['pp-position'].value
    };
}

function hayCambiosEnFormulario() {
    if (estado.modo === 'idle') return false;
    return JSON.stringify(leerFormulario()) !== estado.snapshotFormulario;
}

function confirmarDescarteFormulario(mensaje) {
    if (!hayCambiosEnFormulario()) return true;
    return confirm(mensaje);
}

// ============================================================
// Utilidades
// ============================================================

function normalizarTexto(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function numeroDesdeInput(valor) {
    const texto = String(valor === undefined || valor === null ? '' : valor).trim().replace(',', '.');
    if (!texto) return NaN;
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : NaN;
}

function redondear(numero, decimales) {
    return Number(Number(numero).toFixed(decimales));
}

function formatearCoordenada(numero) {
    return Number(numero).toFixed(5);
}

function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[caracter]));
}

function mostrarToast(mensaje, tipo) {
    const toast = el['pp-toast'];
    toast.textContent = mensaje;
    toast.className = 'pp-toast is-visible' + (tipo ? ` is-${tipo}` : '');
    clearTimeout(estado.temporizadorToast);
    estado.temporizadorToast = setTimeout(() => {
        toast.classList.remove('is-visible');
    }, 4200);
}

function mostrarErrorFatal(mensaje) {
    console.error(mensaje);
    el['pp-file-status'].textContent = 'Error al cargar';
    el['pp-list'].innerHTML = '';
    const aviso = document.createElement('li');
    aviso.className = 'pp-empty-list';
    aviso.textContent = mensaje;
    el['pp-list'].appendChild(aviso);
    mostrarToast('No se pudieron cargar las paradas.', 'error');
}
