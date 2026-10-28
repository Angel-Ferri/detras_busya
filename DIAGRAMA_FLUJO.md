# Busya — Diagramas de flujo

> **Proyecto:** Busya — información de colectivos de Villa Mercedes (Solbus)
> **Documento complementario:** [`DOCUMENTACION.md`](DOCUMENTACION.md)
> **Fecha de relevamiento:** 28/10/2026
> **Alcance:** flujos reales del código actual, incluyendo las fallas conocidas.

Este documento reúne los diagramas de flujo de Busya en formato **Mermaid**. No describe una versión ideal: describe **lo que el repositorio hace hoy**, y marca en rojo los puntos donde el flujo se corta o queda incompleto. Las referencias de código y los detalles de cada módulo están en [`DOCUMENTACION.md`](DOCUMENTACION.md).

---

## Índice

1. [Cómo leer los diagramas](#1-cómo-leer-los-diagramas)
2. [Flujo general de extremo a extremo](#2-flujo-general-de-extremo-a-extremo)
3. [Mapa de navegación entre páginas](#3-mapa-de-navegación-entre-páginas)
4. [Consulta de horarios: `index.html` → `paradas.html`](#4-consulta-de-horarios-indexhtml--paradashtml)
5. [Resolución del día de servicio](#5-resolución-del-día-de-servicio)
6. [Arranque de `como_llegar.html`](#6-arranque-de-como_llegarhtml)
7. [Búsqueda inteligente](#7-búsqueda-inteligente)
8. [Cálculo de hasta 4 opciones de viaje](#8-cálculo-de-hasta-4-opciones-de-viaje)
9. [Selección de una opción y dibujo en el mapa](#9-selección-de-una-opción-y-dibujo-en-el-mapa)
10. [Emparejamiento de grilla e interpolación de horarios](#10-emparejamiento-de-grilla-e-interpolación-de-horarios)
11. [Simulación de colectivos](#11-simulación-de-colectivos)
12. [Panel del chofer (`chofer.html`)](#12-panel-del-chofer-choferhtml)
13. [Panel y editor demo (`panel.html`)](#13-panel-y-editor-demo-panelhtml)
13.1. [Editor de paradas (`panel_paradas.html`)](#131-editor-de-paradas-panel_paradashtml)
14. [Carga de datos y respaldo API/local](#14-carga-de-datos-y-respaldo-apilocal)
15. [Prueba de la fuente real (`prueba.js`)](#15-prueba-de-la-fuente-real-pruebajs)
16. [Mapa de calor (`mapa.html`)](#16-mapa-de-calor-mapahtml)
17. [Resumen de estado por flujo](#17-resumen-de-estado-por-flujo)
18. [Cómo renderizar los diagramas](#18-cómo-renderizar-los-diagramas)
19. [Mantenimiento de este documento](#19-mantenimiento-de-este-documento)

---

## 1. Cómo leer los diagramas

Convenciones usadas en todos los diagramas:

- **Línea continua:** camino implementado y alcanzable.
- **Línea punteada:** respaldo, camino opcional o relación que no está cableada.
- **Nodo rojo:** falla reproducida en el estado actual del repositorio.
- **Nodo amarillo:** demo, simulación o comportamiento que no debe confundirse con datos reales.
- **Nodo azul:** servicio externo o página secundaria.
- **Nodo violeta:** dato persistido o archivo de datos.

```mermaid
flowchart LR
    A["Camino implementado"] --> B["Siguiente paso"]
    C["Respaldo / opcional"] -.-> D["Alternativa"]
    E["Falla actual"]:::err
    F["Demo / simulación"]:::warn
    G["Servicio externo"]:::ext
    H["Dato persistido"]:::data

    classDef err fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#7f1d1d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,stroke-width:2px,color:#713f12;
    classDef ext fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1e3a8a;
    classDef data fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#581c87;
```

> **Importante:** los diagramas no inventan funciones ni estados intermedios. Cuando una función no existe o una llamada falla, el diagrama lo muestra como un nodo rojo y no como un camino exitoso.

---

## 2. Flujo general de extremo a extremo

Vista de conjunto: una persona puede consultar una línea, planificar un viaje o entrar a una herramienta interna. Los tres caminos comparten datos, pero tienen distinto grado de madurez.

```mermaid
flowchart TD
    U["Persona abre Busya"] --> Q{"¿Qué quiere hacer?"}

    Q -->|"Consultar una línea"| I["index.html"]
    Q -->|"Planificar un viaje"| CL["como_llegar.html"]
    Q -->|"Herramienta interna"| IN["chofer.html / panel.html"]
    Q -->|"Editar paradas"| ED["panel_paradas.html"]

    I --> I1["Elegir línea A, E, Este u Oeste"]
    I1 --> I2["seleccionarLinea(id)"]
    I2 --> I3["cargarDatosLineaCompleta(id)"]
    I3 --> I4["Resolver día de servicio"]
    I4 --> I5["Leer horarios y paradas secundarias"]
    I5 --> I6["Guardar en localStorage"]
    I6 --> P["paradas.html"]
    P --> P1["Elegir parada"]
    P1 --> P2["Ver horarios oficiales y estimados"]

    CL --> C1["Cargar mapa, GPS, líneas y horarios"]
    C1 --> C2["Buscar destino"]
    C2 --> C3["Calcular hasta 4 opciones"]
    C3 --> C4["Elegir una opción"]
    C4 --> C5["Dibujar recorrido y resumen"]
    C5 --> C6["Rastreo simulado opcional"]

    IN --> N1["Login con PIN"]
    N1 --> N2{"¿Qué panel?"}
    N2 -->|"chofer.html"| N3["Seleccionar línea"]
    N2 -->|"panel.html"| N4["Editor demo"]
    N3 -.-> N5["Falla: cargarHorariosDeHoy no existe"]
    N4 -.-> N6["Falla: HASH_ACCESO_CHOFER duplicado"]

    ED --> E1["Agregar / editar / reordenar"]
    E1 --> E2["Guardar datos/paradas_manuales.json"]
    E2 --> E3["Planificador y paradas.html"]
    E2 -.-> E4["Descarga manual si no hay File System Access API"]

    P2 --> R["Respuesta al usuario"]
    C5 --> R
    E3 --> R

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    classDef err fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;
    classDef ext fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;

    class I,P,CL,C1,C2,C3,C4,C5,P2,R,ED,E1,E2,E3 ok;
    class C6,N1,N4,E4 warn;
    class N5,N6 err;
```

**Lectura rápida:**

- El camino `index → paradas` es el más simple y el que mejor funciona.
- El planificador calcula opciones reales, pero termina el arranque con un error no capturado (`mostrarAvisoDeOrigen`).
- Los paneles internos tienen login, pero sus flujos principales están cortados por funciones o scripts faltantes.
- El editor de paradas es el único flujo de escritura de datos: guarda `paradas_manuales.json` y alimenta al planificador y a `paradas.html`.

---

## 3. Mapa de navegación entre páginas

```mermaid
flowchart LR
    subgraph PUBLICO["Páginas públicas"]
        IDX["index.html"]
        PAR["paradas.html"]
        CL["como_llegar.html"]
    end

    subgraph INTERNO["Herramientas internas"]
        CHO["chofer.html"]
        PAN["panel.html"]
        MAP["mapa.html"]
        EP["panel_paradas.html"]
    end

    subgraph DATOS["Datos editables"]
        PM[("datos/paradas_manuales.json")]
    end

    subgraph EXT["Servicios y enlaces externos"]
        IG["Instagram"]
        FORM["Google Forms"]
        OSM["OSM / OSRM / Nominatim"]
        GA["Analytics / AdSense"]
    end

    IDX -->|"Tarjeta de línea (JS)"| PAR
    IDX -->|"¿Cómo llegar?"| CL
    IDX -->|"Panel de Control"| CHO
    IDX -->|"Editor de paradas"| EP
    PAR -->|"Volver"| IDX
    CL -->|"Volver"| IDX
    CHO -->|"Inicio"| IDX
    EP -->|"Volver"| IDX
    EP -->|"Lee y guarda"| PM
    PM -.->|"Paradas y orden"| PAR
    PM -.->|"Paradas para planificar"| CL

    IDX -.->|"Sin enlace visible"| MAP
    IDX -.->|"Sin enlace visible"| PAN

    PAR --> IG
    PAR --> FORM
    CL --> OSM
    MAP --> OSM
    IDX --> GA
    PAR --> GA

    classDef ext fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;
    classDef ghost fill:#f8fafc,stroke:#94a3b8,color:#334155,stroke-dasharray: 4 3;
    classDef data fill:#f3e8ff,stroke:#9333ea,color:#581c87;
    class IG,FORM,OSM,GA ext;
    class MAP,PAN ghost;
    class PM data;
```

**Observaciones:**

- `mapa.html` y `panel.html` siguen siendo páginas huérfanas: no hay enlaces visibles desde el inicio.
- `panel_paradas.html` sí tiene un enlace visible en el pie de `index.html`; escribe `datos/paradas_manuales.json`.
- `paradas.html` solo funciona si se llegó desde `index.html`, porque depende de `localStorage.lineaSeleccionadaData`.
- Los enlaces externos (Instagram, formulario, mapas) no tienen fallback propio.

---

## 4. Consulta de horarios: `index.html` → `paradas.html`

Flujo principal para ver los horarios de una línea. Incluye la resolución del día, la carga de datos y el cálculo de horarios estimados en paradas intermedias.

```mermaid
flowchart TD
    A["Tap en tarjeta de línea"] --> B["seleccionarLinea('linea_a')"]
    B --> C["Normalizar id:<br/>quitar '_horarios.json' o '.json'"]
    C --> D["cargarDatosLineaCompleta(id)"]
    D --> E["resolverDiaDeServicio(new Date())"]

    E --> F{"¿Es feriado?"}
    F -->|"Sí"| G["tipo = Domingos<br/>etiqueta = Feriado"]
    F -->|"No"| H{"¿Domingo?"}
    H -->|"Sí"| I["tipo = Domingos"]
    H -->|"No"| J{"¿Sábado?"}
    J -->|"Sí"| K["tipo = Sábados"]
    J -->|"No"| L["tipo = Lunes a Viernes<br/>estudianteActiva = true"]

    G --> M["fetch datos/id_horarios.json"]
    I --> M
    K --> M
    L --> M

    M --> N{"¿HTTP OK?"}
    N -->|"No"| O["throw Error<br/>alert en app.js"]
    N -->|"Sí"| P["fetch paradas_secundarias_id.json<br/>(opcional)"]
    P --> Q["Agregar servicioHoy,<br/>estadoEstudianteHoy y paradasSecundarias"]
    Q --> R["localStorage.setItem('lineaSeleccionadaData')"]
    R --> S["window.location = paradas.html"]

    S --> T["iniciarParadas()"]
    T --> U{"¿Existe lineaSeleccionadaData?"}
    U -->|"No"| V["alert + volver a index.html"]
    U -->|"Sí"| W["obtenerServicios(datosLinea)"]
    W --> X["Buscar servicio por tipo de día<br/>(fallback al primero)"]
    X --> Y["cargarDatosGeograficos(nombreLinea)"]
    Y --> Z["procesarTodosLosHorarios()"]
    Z --> AA["calcularHorariosEstimados()<br/>25 km/h desde la última ancla"]
    AA --> AB["renderizarListaParadas()"]
    AB --> AC["Elegir parada en el select"]
    AC --> AD["Mostrar todas las horas del día"]
    AD --> AE["Destacar próximo <= 30 min<br/>y mostrar cartel"]

    T -.-> AF["⚠️ SyntaxError por dias.js duplicado"]
    P -.-> AG["⚠️ En Linux el nombre en minúsculas no coincide"]
    AA -.-> AH["⚠️ 25 km/h acá; 18 km/h en el planificador"]

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    classDef err fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;
    classDef data fill:#f3e8ff,stroke:#9333ea,color:#581c87;

    class A,B,C,D,E,G,I,K,L,M,Q,S,T,W,X,Y,Z,AB,AC,AD,AE ok;
    class P,AA warn;
    class AF,AG,AH err;
    class R data;
```

**Puntos finos:**

- La estimación de `paradas.html` usa **25 km/h** y avanza desde la última parada oficial conocida; no usa la hora real ni el recorrido de la calle.
- Los horarios estimados se distinguen con el sufijo `(estimado)`.
- `paradas.html` carga `script/dias.js` dos veces (`paradas.html:191` y `:193`). En el navegador eso produce `SyntaxError: Identifier 'RUTA_DATOS' has already been declared`; la página sigue funcionando porque el segundo script no se ejecuta.
- La búsqueda de paradas secundarias usa el nombre en minúsculas (`paradas_secundarias_linea_a.json`), mientras que el archivo real es `paradas_secundarias_Linea_A.json`. En Windows no se nota; en un servidor Linux devuelve 404 y se pierden las coordenadas.

---

## 5. Resolución del día de servicio

Este subflujo se usa en `index.html`, `paradas.html` y, de forma indirecta, en el planificador.

```mermaid
flowchart TD
    A["fecha"] --> B{"¿Coincide con un feriado fijo?"}
    B -->|"Sí"| F["Feriado:<br/>horarios de domingo"]
    B -->|"No"| C{"¿Año 2026 y feriado variable?"}
    C -->|"Sí"| F
    C -->|"No"| D{"¿Día de la semana?"}
    D -->|"Domingo"| E["Domingos"]
    D -->|"Sábado"| G["Sábados"]
    D -->|"Lunes a Viernes"| H["Lunes a Viernes<br/>Pase estudiantil activo"]

    F --> I["{tipo, etiqueta, feriado, estudianteActiva}"]
    E --> I
    G --> I
    H --> I

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    class F,E,G,H,I ok;
```

**Feriados contemplados:**

- **Fijos:** 1/1, 24/3, 2/4, 1/5, 25/5, 20/6, 9/7, 17/8, 25/8, 24/9, 12/10, 20/11, 1/12, 8/12 y 25/12.
- **Variables 2026:** 2/3, 3/3, 23/3, 2/4, 3/4 y 7/12.
- No hay tablas para feriados de otros años.

---

## 6. Arranque de `como_llegar.html`

Secuencia real de inicialización. Muestra el orden de carga, el respaldo de la API y el error final de `mostrarAvisoDeOrigen`.

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuario
    participant P as como_llegar.html
    participant M as mapa.js
    participant A as api.js
    participant J as JSON locales
    participant S as Servicios externos

    U->>P: Abre la página
    P->>M: inicializarMapa()
    P->>M: inicializarBotonRastreo()
    P->>M: obtenerUbicacionUsuario()

    alt GPS concedido
        M-->>P: ubicacionUsuario real
    else GPS denegado o sin soporte
        M-->>P: punto por defecto en Villa Mercedes
    end

    P->>A: await cargarRecorridos()
    A->>J: fetch lineas_unificadas.json
    J-->>A: 4 líneas, 323 paradas, 701 puntos
    A->>A: normalizarCoordenadas() y origenDeDatos = local
    A-->>P: datosLineasCargados

    P->>A: await cargarHorarios()
    A->>S: GET /api/lineas
    alt API disponible
        S-->>A: listado de líneas
        A->>S: GET /api/lineas/:id
        S-->>A: horarios_por_dia
        A->>A: normalizarDiaDeServicio()
    else API caída, CORS o contenido mixto
        A->>J: RESPALDO_LOCAL[*].horarios
        J-->>A: JSON locales
        A->>A: extraerDiasDeServicio()
    end
    A-->>P: horariosLineasCargados

    P->>A: await cargarLugaresDeReferencia()
    A->>S: GET /api/lugares
    alt API disponible
        S-->>A: lugares de referencia
    else API caída
        A->>J: datos-unificados.json
        J-->>A: 1.893 comercios (todos searchable)
    end
    A->>A: lugaresDeReferencia.push(comercios)
    A-->>P: lugaresDeReferencia

    P->>P: mostrarAvisoDeOrigen()
    Note over P: ReferenceError: la función está comentada en api.js
    P-->>U: Mapa y buscador disponibles (con error en consola)
```

**Lectura:**

- `cargarRecorridos()` **siempre** lee el JSON local; no consulta la API.
- `cargarHorarios()` sí intenta la API y cae a los JSON si falla.
- `cargarLugaresDeReferencia()` deja los comercios en `lugaresDeReferencia`, pero el buscador no los usa después (ver §7).
- `mostrarAvisoDeOrigen()` está comentada en `api.js:379-386`, pero se invoca en `inicio.js:55`. Es el último paso del arranque y termina en error no capturado.
- `como_llegar.html` también carga `panel/main.js`, que define `cargarDatosLineas()` pero no se usa en esta página.

---

## 7. Búsqueda inteligente

Flujo del buscador de `como_llegar.html`. La búsqueda de paradas y direcciones funciona; la de comercios locales queda a mitad de camino.

```mermaid
flowchart TD
    A["Usuario escribe en el buscador"] --> B["ejecutarBusquedaEnTiempoReal()"]
    B --> C{"¿3 caracteres o más?"}
    C -->|"No"| D["Limpiar resultados"]
    C -->|"Sí"| E["Mostrar 'Buscando opciones...'"]
    E --> F["clearTimeout + setTimeout 800 ms"]
    F --> G["ejecutarBusqueda()"]

    G --> H["Recorrer datosLineasCargados"]
    H --> I["coincideConErrores(nombre, término)<br/>incluye Levenshtein"]
    I --> J["Paradas encontradas (deduplicadas)"]

    G --> K["fetch Nominatim<br/>término + 'Villa Mercedes, San Luis'"]
    K --> L{"¿Respuesta OK?"}
    L -->|"Sí"| M["Hasta 5 direcciones"]
    L -->|"No"| N["console.error<br/>sin direcciones"]

    G -.-> O["lugaresDeReferencia cargados<br/>pero nunca consultados"]
    O -.-> O1["⚠️ Los 1.893 comercios<br/>no aparecen en la búsqueda"]

    J --> P["Render: PARADAS SUGERIDAS<br/>(máximo 4)"]
    M --> Q["Render: LOCALES Y DIRECCIONES"]
    N --> R["Solo paradas"]
    P --> S{"¿Sin resultados?"}
    Q --> S
    R --> S
    S -->|"Sí"| T["No encontramos coincidencias"]
    S -->|"No"| U["Usuario hace clic en un resultado"]
    U --> V["mostrarCargandoViaje()"]
    V --> W["setTimeout 150 ms"]
    W --> X["encontrarViajeMasOptimo(lat, lng, nombre)"]

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    classDef err fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;

    class A,B,C,D,E,F,G,H,I,J,K,M,P,Q,R,S,U,V,W,X ok;
    class L,N,T warn;
    class O,O1 err;
```

**Detalles:**

- La búsqueda de paradas tolera errores de tipeo con distancia de Levenshtein.
- Nominatim se consulta con `countrycodes=ar` y límite 5; no se filtra por bounding box de Villa Mercedes, solo por el texto agregado.
- `cargarLugaresDeReferencia()` carga los 1.893 comercios en `lugaresDeReferencia`, pero `ejecutarBusqueda()` solo recorre `datosLineasCargados` y Nominatim. Los comercios quedan como datos muertos para la búsqueda.
- La interfaz arma resultados con `innerHTML` a partir de datos de Nominatim; es un punto de riesgo de XSS (ver §14 de `DOCUMENTACION.md`).

---

## 8. Cálculo de hasta 4 opciones de viaje

Núcleo del planificador: busca orígenes, evalúa viajes directos y transbordos, deduplica y arma el modal con 2 a 4 opciones.

```mermaid
flowchart TD
    A["encontrarViajeMasOptimo(latDestino, lngDestino, nombre)"] --> B{"¿ubicacionUsuario?"}
    B -->|"No"| B1["alert: necesitamos GPS"]
    B -->|"Sí"| C["limpiarMapa()<br/>infoDestinoActual = destino"]

    C --> D["radio = 0,5 km"]
    D --> E["Buscar paradas de las 4 líneas<br/>dentro del radio"]
    E --> F{"¿Hay orígenes?"}
    F -->|"No"| G{"¿radio < 3 km?"}
    G -->|"Sí"| H["radio += 0,5 km"]
    H --> E
    G -->|"No"| I["alert: no hay líneas cerca"]
    F -->|"Sí"| J["Evaluar viajes directos"]

    J --> K["Para cada origen y cada parada<br/>de la misma línea"]
    K --> L{"¿Destino más adelante<br/>en la proyección?"}
    L -->|"No"| M["Descartar"]
    L -->|"Sí"| N["tiempo = caminata_origen * 12<br/>+ paradas * 1,5<br/>+ caminata_destino * 12"]
    N --> O["registrarOpcion('directo-' + línea, viaje, tiempo)"]

    O --> P["Evaluar transbordos"]
    P --> Q["Para cada L1 y L2 distinta"]
    Q --> R["Buscar bajada de L1 y subida de L2<br/>a 400 m o menos"]
    R --> S{"¿Destino de L2 más adelante<br/>que la subida?"}
    S -->|"No"| T["Descartar"]
    S -->|"Sí"| U["tiempo = caminata_origen + tramo L1<br/>+ escala + tramo L2 + caminata_final"]
    U --> V["registrarOpcion('transbordo-' + L1 + '-' + L2, viaje, tiempo)"]

    V --> W["Ordenar por metrosDestino<br/>y luego por tiempoEstimado"]
    W --> X["Tomar las 2 mejores opciones"]
    X --> Y["Agregar hasta 2 directos absolutos<br/>(mejor parada de cada línea)"]
    Y --> Z["Recortar a 4 si hace falta"]
    Z --> AA["mostrarListaDeOpciones()"]
    AA --> AB{"¿0 opciones?"}
    AB -->|"Sí"| AC["alert: no encontramos opciones viables"]
    AB -->|"No"| AD["Modal con 2 a 4 opciones"]

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    classDef err fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;

    class A,B,C,D,E,F,H,J,K,L,N,O,P,Q,R,S,U,V,W,X,Y,Z,AA,AB,AD ok;
    class M,T,AC warn;
    class B1,I err;
```

**Reglas que no se ven en el dibujo:**

- `registrarOpcion()` guarda **una sola opción por clave**: `directo-<línea>` o `transbordo-<L1>-<L2>`. Si aparece otra mejor para la misma clave, reemplaza la anterior.
- La proyección sobre la polilínea es lo que decide si una parada está “antes” o “después”; no se usa el orden del array ni la distancia en línea recta para eso.
- Los tiempos son heurísticos: **12 minutos por km caminando** y **1,5 minutos por parada** de colectivo. No usan la planilla real.
- La “fase 0” de sugerir caminar si el destino está a menos de 1 km está documentada en un comentario, pero no se implementa en este flujo.
- Si dos líneas distintas ofrecen un viaje directo, cada una puede ocupar un lugar; los directos absolutos se agregan después para asegurar que las 4 líneas tengan representación.

---

## 9. Selección de una opción y dibujo en el mapa

Secuencia al tocar una de las opciones del modal. Se separan los dos casos: viaje directo y viaje con transbordo.

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuario
    participant P as planificador.js
    participant M as mapa.js
    participant L as Leaflet

    U->>P: seleccionarOpcionViaje(index)
    P->>P: cerrarModalOpciones() + limpiarMapa()

    alt Opción directa
        P->>P: select-linea = viaje.lineaKey
        P->>P: alCambiarLinea(lineaKey)
        P->>M: dibujarRecorridoColectivo(recorrido)
        M->>L: polilínea + marcadores de paradas
        P->>P: setTimeout 150 ms
        P->>P: select-destino = viaje.destino.idx
        P->>P: sugerenciaTemporal = origen del viaje
        P->>P: procesarRespuestaSugerencia(true)
        P->>M: trazarRutaAPie(ubicacion, origen)
        P->>M: mostrarCargandoViaje('Calculando tu ruta...')
        P->>P: setTimeout 450 ms
        P->>M: calcularRutaYTiempo()
        M->>M: recalcula la bajada más cercana a infoDestinoActual
        Note over M: ⚠️ Puede contradecir la opción elegida
        M-->>P: resumen actualizado
        P->>P: setTimeout 500 ms
        P->>P: resumen con Tomá/Bajate + botón volver
        P->>L: marcador de destino + setView
    else Opción con transbordo
        P->>P: select-linea = viaje.L1.key
        P->>P: alCambiarLinea(L1)
        P->>P: setTimeout 200 ms
        P->>P: select-destino = viaje.L1.bajada.idx
        P->>P: procesarRespuestaSugerencia(true)
        P->>M: tramo L1 + caminata al origen
        P->>P: setTimeout 500 ms
        P->>M: dibujarTramoEscalaL2(viaje, destino)
        M->>L: polilínea L2 + paradas + subida/bajada
        P->>P: resumen con tramo 1, escala y tramo 2
    end

    U->>P: Cambiar de línea / Ver otras opciones
    P->>P: mostrarListaDeOpciones()
```

**Observaciones:**

- En el caso directo, `calcularRutaYTiempo()` vuelve a elegir la parada de bajada más cercana a `infoDestinoActual` (`mapa.js:103-124`). Eso puede cambiar la bajada que el usuario había elegido en el modal.
- El resumen se escribe dos veces: primero `calcularRutaYTiempo()` y, 500 ms después, el bloque específico de la opción. El segundo pisa al primero.
- En el transbordo se dibuja el tramo de L1, luego la escala y el tramo de L2 en otro color; el botón “Cambiar de línea / Ver otras opciones” reabre el modal.
- `limpiarMapa()` corta el simulador si estaba activo; después hay que volver a prenderlo.

---

## 10. Emparejamiento de grilla e interpolación de horarios

### 10.1 Emparejar nombres de la planilla con paradas de calle

La planilla usa nombres abreviados (“L.Guillet y G. Paz”) y las paradas de calle usan nombres completos (“León Guillet y Gral. Paz”). Este flujo arma la tabla de anclas.

```mermaid
flowchart TD
    A["obtenerTablaDeGrilla(keyLinea)"] --> B["Obtener servicio de hoy y línea"]
    B --> C{"¿Existen ambos?"}
    C -->|"No"| D["Devolver []"]
    C -->|"Sí"| E["Para cada parada de la grilla"]
    E --> F["Para cada parada de calle no usada"]
    F --> G["puntajeCoincidenciaParada(grilla, calle)"]
    G --> H{"¿Puntaje > mejor?"}
    H -->|"Sí"| I["Guardar mejor parada"]
    H -->|"No"| J["Seguir"]
    I --> J
    J --> K{"¿Fin de paradas de calle?"}
    K -->|"No"| F
    K -->|"Sí"| L["Agregar ancla<br/>{nombre, indiceParada, indiceEnGrilla}"]
    L --> M["Marcar parada como usada"]
    M --> E
    E --> N["Cachear en tablasDeGrilla[key]"]
    N --> O["Devolver anclas"]

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    class A,B,C,E,F,G,H,I,J,K,L,M,N,O ok;
    class D warn;
```

**Puntaje (0 a 100):**

1. Normaliza ambos nombres: sin acentos, minúsculas, sin puntuación.
2. Compara palabras distintivas (3 letras o más).
3. Exige que **todas** las palabras de la grilla aparezcan en la parada de calle.
4. Exige que **al menos la mitad** de las palabras de calle aparezcan en la grilla.
5. Asigna 70 a 100 según la cobertura; si no cumple, devuelve 0.

### 10.2 Interpolar la hora de una parada intermedia

```mermaid
flowchart TD
    A["calcularHorarioEstimadoParada(key, idx, ahora)"] --> B["Obtener línea y servicio de hoy"]
    B --> C{"¿Hay servicio, horarios y anclas?"}
    C -->|"No"| D["Devolver null"]
    C -->|"Sí"| E{"¿idx coincide con un ancla?"}

    E -->|"Sí"| F["Leer la hora de cada viaje<br/>en indiceEnGrilla"]
    F --> G["Ordenar horas<br/>elegir próxima >= ahora<br/>si no hay, la primera"]
    G --> H["Devolver esInterpolado = false"]

    E -->|"No"| I["Buscar ancla anterior y siguiente"]
    I --> J["Para cada viaje:<br/>tiempoAntes y tiempoDespues"]
    J --> K{"¿Qué horarios hay?"}
    K -->|"Ambos"| L["Interpolar por índice de parada"]
    K -->|"Solo anterior"| M["Estimar con 18 km/h<br/>desde el ancla anterior"]
    K -->|"Solo siguiente"| N["Estimar hacia atrás<br/>con 18 km/h"]
    K -->|"Ninguno"| O["Descartar viaje"]
    L --> P["Agregar candidato"]
    M --> P
    N --> P
    O --> P

    P --> Q{"¿Hay candidatos?"}
    Q -->|"No"| R["Devolver null"]
    Q -->|"Sí"| S["Ordenar<br/>elegir próxima >= ahora<br/>si no hay, la primera"]
    S --> T["Devolver esInterpolado = true"]

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    class A,B,C,E,F,G,I,J,K,L,M,N,P,Q,S,T ok;
    class D,R,O warn;
```

**Fórmulas:**

- **Con dos anclas:** `minutos = antes + (despues - antes) * (indiceParada - indiceAntes) / (indiceDespues - indiceAntes)`.
- **Con una sola ancla:** distancia de ruta entre paradas / 18 km/h.
- La interpolación usa el **índice de la parada** en la lista, no la distancia real entre paradas. Es una aproximación.
- `esInterpolado = true` hace que la interfaz muestre “Horario estimado” en lugar de “Horario programado”.
- La constante es **18 km/h** en `horarios.js` y `mapa.js`, pero **25 km/h** en `paradas.js`. Los tiempos no coinciden entre páginas.

---

## 11. Simulación de colectivos

El botón “Rastreo de colectivos” no usa GPS: anima los viajes de la planilla sobre el recorrido. Cada segundo recalcula posiciones y actualiza los marcadores.

### 11.1 Estados del rastreador

```mermaid
stateDiagram-v2
    [*] --> Apagado
    Apagado --> Encendido: tap en Rastreo
    Encendido --> Apagado: tap en Rastreo
    Encendido --> Encendido: cada 1 segundo
```

### 11.2 Cálculo de posiciones

```mermaid
flowchart TD
    A["Tap en el botón de rastreo"] --> B["alternarRastreoColectivos()"]
    B --> C{"¿rastreoActivo?"}
    C -->|"No"| D["detenerRastreoColectivos()<br/>clearInterval + borrar marcadores"]
    C -->|"Sí"| E["Determinar líneas a mostrar"]

    E --> F{"¿Hay mejorViajeActual?"}
    F -->|"Directo"| G["Usar lineaKey"]
    F -->|"Transbordo"| H["Usar L1 y L2"]
    F -->|"No"| I["Usar recorridoActual<br/>o el select de línea"]
    G --> J["activarRastreoColectivos()"]
    H --> J
    I --> J

    J --> K["actualizarPosicionColectivos() inmediato"]
    K --> L["setInterval cada 1000 ms"]
    L --> M["Para cada línea a mostrar"]
    M --> N["Obtener servicio de hoy"]
    N --> O["Para cada fila/viaje de la grilla"]
    O --> P["Quedarse con las paradas<br/>que tienen hora válida"]
    P --> Q{"¿2 o más paradas?"}
    Q -->|"No"| R["Saltar viaje"]
    Q -->|"Sí"| S["Inicio = primera hora<br/>Fin = última hora"]
    S --> T["Ajustar viajes que cruzan medianoche"]
    T --> U{"¿Ahora está dentro<br/>del intervalo?"}
    U -->|"No"| R
    U -->|"Sí"| V["progreso = (ahora - inicio) / (fin - inicio)"]
    V --> W["distancia = progreso * distanciaTotal"]
    W --> X["Interpolar lat/lng sobre la polilínea"]
    X --> Y["Buscar próxima parada<br/>y minutos restantes"]
    Y --> Z["Calcular distancia al usuario"]
    Z --> AA["Agregar a colectivosEnMovimiento"]
    AA --> AB["Ordenar por cercanía al usuario"]
    AB --> AC["Crear o reutilizar marcadores 🚌"]
    AC --> AD["Actualizar popup"]
    AD --> L
    R --> O

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    classDef ext fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;

    class A,B,C,E,F,G,H,I,J,K,L,M,N,O,P,Q,S,T,U,V,W,X,Y,Z,AA,AB,AC,AD ok;
    class D,R warn;
```

**Qué es real y qué no:**

- **Real:** las horas de la planilla, el recorrido y las paradas.
- **Simulado:** la posición del colectivo. Se obtiene repartiendo la distancia total del recorrido en proporción al tiempo transcurrido entre la primera y la última hora del viaje.
- **No hay GPS, ni internos, ni retrasos reales.** El texto “Simulando en vivo” puede confundir; el aviso de limitaciones aclara que las ubicaciones son simuladas.
- Si la planilla dice que un viaje está en curso, el colectivo aparece aunque no exista en la calle.
- Los marcadores se recrean cuando cambia la cantidad de colectivos; si no, se reutilizan y solo se mueven.

---

## 12. Panel del chofer (`chofer.html`)

Flujo de login y panel. En el estado actual, el login funciona pero la selección de línea se corta porque `cargarHorariosDeHoy()` no está definida.

```mermaid
flowchart TD
    A["Abrir chofer.html"] --> B["Ingresar PIN/legajo"]
    B --> C["generarHash(PIN)<br/>SHA-256 con crypto.subtle"]
    C --> D{"¿Hash == HASH_ACCESO_CHOFER?"}
    D -->|"No"| E["alert('Clave incorrecta...')"]
    D -->|"Sí"| F["Mostrar seccion-panel-trabajo"]

    F --> G["Elegir línea"]
    G --> H["cambiarLineaDeTrabajo()"]
    H --> I["cargarHorariosDeHoy(archivoActual)"]
    I --> J{"¿La función existe?"}
    J -->|"No (repo actual)"| K["ReferenceError:<br/>cargarHorariosDeHoy is not defined"]
    J -->|"Sí (si se restaura)"| L["Cargar planilla del día"]
    L --> M["Leer contador de vueltas<br/>de localStorage"]
    M --> N["Listar paradas"]
    N --> O["Elegir parada"]
    O --> P["calcularFrecuenciaDeParada()"]
    P --> Q["calcularHorarioSimuladoPredicho()"]
    Q --> R{"¿2 o más marcas reales<br/>en los últimos 60 min?"}
    R -->|"Sí"| S["Promedio real + última marca"]
    R -->|"No"| T["Frecuencia teórica + ahora"]
    S --> U["Mostrar próximo horario"]
    T --> U
    U --> V["Botón 'Estoy en esta parada AHORA'"]
    V --> W["Guardar marca en historialMarcajesReales"]
    W --> Q

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    classDef err fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;
    classDef data fill:#f3e8ff,stroke:#9333ea,color:#581c87;

    class A,B,C,D,F,G,H,I,L,N,O,P,Q,R,S,T,U,V,W ok;
    class E,K err;
    class M data;
```

**Estado actual:**

- El PIN de demo `1234` abre el panel. El hash SHA-256 está hardcodeado en `panel/chofer.js:1`.
- Al elegir una línea, `cambiarLineaDeTrabajo()` llama a `cargarHorariosDeHoy()`; esa función **no existe** en `script/dias.js`, `panel/chofer.js` ni en ningún otro script cargado por `chofer.html`.
- El error se produce antes del `.then()`, así que el contador de vueltas y la lista de paradas nunca se inicializan.
- El flujo posterior (frecuencia, predicción, marcas) está implementado y es coherente, pero hoy es inalcanzable.
- Las marcas reales viven en memoria (`historialMarcajesReales`) y se pierden al recargar; no hay backend ni multiusuario.

---

## 13. Panel y editor demo (`panel.html`)

Flujo de login y editor experimental. El login funciona, pero el editor no se inicializa por una declaración duplicada.

```mermaid
flowchart TD
    A["Abrir panel.html"] --> B["Overlay de login"]
    B --> C["Ingresar contraseña"]
    C --> D["panel/auth.js valida"]
    D --> E{"¿Correcta?"}
    E -->|"No"| F["Mostrar error"]
    E -->|"Sí"| G["Mostrar el panel del chofer"]

    G --> H["Cargar scripts del final"]
    H --> I["panel/chofer.js declara HASH_ACCESO_CHOFER"]
    H --> J["script/panel.demo.js declara HASH_ACCESO_CHOFER"]
    I --> K["SyntaxError:<br/>Identifier 'HASH_ACCESO_CHOFER'<br/>has already been declared"]
    J --> K
    K --> L["panel.demo.js no se ejecuta"]
    L --> M["Editor demo no se inicializa"]

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    classDef err fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;

    class A,B,C,D,G,H,I ok;
    class F warn;
    class K,L,M err;
```

**Observaciones:**

- El login de `panel.html` acepta el PIN de demo `1234`, aunque el placeholder del formulario sugiere `5456`. Esa pista es engañosa y no debería estar en producción.
- `panel/chofer.js` y `script/panel.demo.js` declaran la misma constante global. El navegador detecta la redeclaración al cargar el segundo script y aborta su ejecución.
- `panel.html` mezcla dos implementaciones de panel: la de `panel/chofer.js` (login, frecuencia, predicción) y la de `script/panel.demo.js` (editor de horarios). La segunda queda bloqueada.
- La autenticación es 100 % cliente; cualquiera puede inspeccionar el hash y saltarla. No es seguridad real.

---

## 13.1 Editor de paradas (`panel_paradas.html`)

Flujo real de lectura, edición y guardado. Es la única parte de la aplicación que escribe un archivo de datos.

```mermaid
flowchart TD
    A["Abrir panel_paradas.html"] --> B["fetch datos/paradas_manuales.json<br/>cache: no-store"]
    B --> C["fetch lineas_unificadas.json<br/>solo para el recorrido"]
    C --> D["Normalizar y validar las 4 líneas"]
    D --> E["Renderizar pestañas, lista, buscador y mapa"]
    E --> F{"Acción del usuario"}
    F -->|"Agregar / editar"| G["Formulario: nombre, lat, lng,<br/>descripción y posición"]
    F -->|"Reordenar ↑/↓"| H["Mover dentro del array"]
    F -->|"Eliminar"| I["Confirmar y quitar de la copia en memoria"]
    G --> J{"¿Datos válidos?"}
    J -->|"No"| K["Mostrar error y no modificar"]
    J -->|"Sí"| L["Actualizar estado en memoria"]
    H --> L
    I --> L
    L --> M["Marcar 'Cambios sin guardar'"]
    M --> N{"¿Guardar?"}
    N -->|"Chrome/Edge + FSA"| O["Vincular archivo o showSaveFilePicker"]
    O --> P["createWritable().write(JSON)"]
    N -->|"Sin FSA"| Q["Descargar paradas_manuales.json"]
    P --> R[("datos/paradas_manuales.json")]
    Q -.->|"Reemplazo manual"| R
    R --> S["cargarRecorridos()<br/>aplicarParadasManuales()"]
    R --> T["paradas.js<br/>carga prioritaria"]
    S --> U["Planificador con paradas nuevas"]
    T --> V["paradas.html con horarios estimados"]

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    classDef err fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;
    classDef data fill:#f3e8ff,stroke:#9333ea,color:#581c87;

    class A,B,C,D,E,G,H,I,J,L,M,N,O,P,S,T,U,V ok;
    class Q warn;
    class K err;
    class R data;
```

**Observaciones:**

- El listado y el mapa trabajan sobre una copia en memoria. Hasta que se guarda, `datos/paradas_manuales.json` no cambia.
- El orden del array `paradas` es el orden del recorrido. Los botones ↑/↓ y el campo “posición” mueven la parada dentro de ese array.
- El mapa permite hacer clic para fijar coordenadas y arrastrar el marcador; “Usar mi ubicación” completa latitud y longitud.
- La validación exige nombre, latitud/longitud numéricas y posición entera dentro del rango. Un archivo vinculado debe tener las cuatro líneas y todas sus paradas con nombre y coordenadas válidas; si falta una, se rechaza sin reemplazar los datos en memoria.
- En Chrome/Edge con `localhost` o HTTPS, el guardado directo escribe el archivo elegido con File System Access API. En otros casos se descarga el JSON y el usuario debe reemplazar `datos/paradas_manuales.json`.
- `cargarRecorridos()` aplica las paradas manuales después de leer `lineas_unificadas.json`; `paradas.js` las lee antes de su respaldo. Así se ven en el planificador y en la página de paradas.
- Una parada insertada antes de la primera parada oficial queda visible, pero `paradas.html` no puede estimarle un horario porque no tiene un ancla anterior.

---

## 14. Carga de datos y respaldo API/local

Flujo de `cargarRecorridos()`, `aplicarParadasManuales()`, `cargarHorarios()` y `cargarLugaresDeReferencia()`. Muestra qué se lee de la API, qué se lee de los JSON y qué queda sin usar.

```mermaid
flowchart TD
    A["Arranque de como_llegar"] --> B["cargarRecorridos()"]
    B --> C["pedirJSONLocal('datos/coordenadas/lineas_unificadas.json')"]
    C --> D{"¿OK?"}
    D -->|"No"| E["console.error<br/>return false"]
    D -->|"Sí"| F["Normalizar paradas y recorrido<br/>origenDeDatos = 'local'"]
    F --> AM["aplicarParadasManuales()<br/>datos/paradas_manuales.json"]

    AM --> G["cargarHorarios()"]
    G --> H["pedirJSON(API_BASE + '/api/lineas')"]
    H --> I{"¿OK?"}
    I -->|"Sí"| J["GET /api/lineas/:id<br/>por cada línea"]
    J --> K["normalizarDiaDeServicio()"]
    I -->|"No"| L["cargarHorariosLocales()"]
    L --> M["RESPALDO_LOCAL[*].horarios"]
    M --> N["extraerDiasDeServicio()"]
    K --> O["horariosLineasCargados"]
    N --> O

    O --> P["cargarLugaresDeReferencia()"]
    P --> Q["GET /api/lugares"]
    Q --> R{"¿OK?"}
    R -->|"Sí"| S["Usar lugares de la API"]
    R -->|"No"| T["lugaresDeReferencia = []"]
    S --> U["fetch datos-unificados.json"]
    T --> U
    U --> V["Agregar 1.893 comercios<br/>a lugaresDeReferencia"]
    V --> W["mostrarAvisoDeOrigen()"]
    W --> X["ReferenceError:<br/>función comentada"]

    B -.-> Y["cargarRecorridosLocales()<br/>sigue sin usarse"]
    Q -.-> Z["CORS / mixed content<br/>si la API no está en HTTPS"]
    V -.-> V1["⚠️ Comercios cargados<br/>pero no usados por el buscador"]

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    classDef err fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;
    classDef data fill:#f3e8ff,stroke:#9333ea,color:#581c87;

    class A,B,C,D,G,H,I,J,K,L,M,N,P,Q,R,S,T,U,W,AM ok;
    class E,Y,Z,V1 warn;
    class X err;
    class F,O,V data;
```

**Contrato de la API:**

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/lineas` | Listado de líneas |
| GET | `/api/lineas/:id` | Detalle con horarios, paradas y recorrido |
| GET | `/api/lugares` | Lugares de referencia |

**Matriz de respaldo:**

| Dato | Fuente primaria | Respaldo | Estado |
|---|---|---|---|
| Paradas y recorridos | `lineas_unificadas.json` + `paradas_manuales.json` | `paradas_secundarias_Linea_<X>.json` en `paradas.html` | `cargarRecorridos()` siempre usa local; las paradas manuales reemplazan a las de `lineas_unificadas.json` |
| Horarios | API `/api/lineas` | `RESPALDO_LOCAL` | Funciona con y sin API |
| Lugares de referencia | API `/api/lugares` | — | Sin API quedan vacíos; los 6 `lugares_de_referencia` locales no se leen |
| Comercios | `datos-unificados.json` | — | Se cargan, pero el buscador no los consulta |

**Deuda asociada:**

- `API_BASE` está hardcodeado a `http://localhost:3000`.
- Si la app se sirve por HTTPS, la API HTTP se bloquea por contenido mixto.
- `cargarRecorridosLocales()` sigue sin usarse; `aplicarParadasManuales()` se llama desde `cargarRecorridos()` y depende de que `datos/paradas_manuales.json` exista.
- `cargarLugaresDeReferencia()` está definida dos veces en `api.js`; la segunda pisa a la primera.
- `mostrarAvisoDeOrigen()` está comentada y se invoca igual.

---

## 15. Prueba de la fuente real (`prueba.js`)

Prueba aislada de la fuente de colectivoya. **No está integrada a la aplicación** y no se sirve desde el navegador: es un script de Node.js.

```mermaid
sequenceDiagram
    autonumber
    participant N as Node.js
    participant CV as colectivoya.com
    participant FS as Sistema de archivos

    N->>CV: GET /
    CV-->>N: cookies de sesión PHP
    Note over N,CV: El orden importa: la sesión guarda empresa y localidad

    N->>CV: GET /php/mostrarempresas.php
    CV-->>N: empresas
    N->>N: buscar 'SOL BUS'

    N->>CV: GET /php/mostrarlocalidad.php?idempresa=...
    CV-->>N: localidades
    N->>N: buscar 'VILLA MERCEDES'

    N->>CV: GET /php/mostrarparadas.php?localidad=...&i=-1
    CV-->>N: 362 paradas

    loop Por cada parada
        N->>CV: GET /php/arribos.php?idparada=...
        alt Respuesta válida
            CV-->>N: arribos[]
            N->>N: acumular internos, tiempos y ramales
        else Vacío, ERROR o excepción
            N->>N: paradasSinColectivos++ (error silenciado)
        end
    end

    N->>N: agrupar por interno y ordenar por tiempo
    N->>FS: writeFileSync('colectivos.json')
    N-->>N: console.table + resumen final
```

**Lectura:**

- El script consulta **362 paradas** una atrás de otra, sin pausa ni caché. Sirve para probar, no para producción.
- El orden de los pedidos no es opcional: `mostrarempresas.php` y `mostrarlocalidad.php` dejan la empresa y la localidad en la sesión PHP. Si se llama a `mostrarparadas.php` sin esa sesión, devuelve una lista vacía sin error.
- Los errores de cada parada se cuentan como “sin colectivos”; no se distingue “no hay” de “no pude consultar”.
- No se filtra `distancia > 0` ni se valida que las coordenadas sean útiles.
- La fuente es HTTP y no permite CORS; el scraper debe correr del lado del servidor (función serverless o backend con caché).
- El resultado se guarda en `colectivos.json`; ese archivo no se usa en la app actual.

---

## 16. Mapa de calor (`mapa.html`)

Página de mapa por línea con puntos coloreados según la cercanía del próximo paso. El script está ofuscado y la página falla al elegir una línea.

```mermaid
flowchart TD
    A["Abrir mapa.html"] --> B["Cargar Leaflet + dias.js + script/mapa.js"]
    B --> C["Elegir línea en el select"]
    C --> D["cambiarLineaMap('lineaa.json')"]
    D --> E["Intentar cargarHorariosDeHoy()"]
    E --> F{"¿La función está definida?"}
    F -->|"No (estado actual)"| G["ReferenceError:<br/>cargarHorariosDeHoy is not defined"]
    G --> H["Mapa base visible<br/>sin puntos de calor"]
    F -->|"Sí (esperado)"| I["Cargar planilla del día"]
    I --> J["Calcular próximo paso por parada"]
    J --> K["Pintar leyenda:<br/>Acá / Por llegar / Cerca / Falta / Lejos"]
    K --> L["Listar estados por parada"]

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    classDef err fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;

    class A,B,C,D,E,I,J,K,L ok;
    class H warn;
    class G err;
```

**Detalles:**

- La página carga el mapa de Leaflet, pero no puede pintar el estado de las paradas porque `script/mapa.js` espera `cargarHorariosDeHoy()` y esa función no está en el HTML.
- El archivo `script/mapa.js` está minificado/ofuscado; no es auditable en el repositorio.
- La leyenda muestra cinco estados: “Acá”, “Por llegar”, “Cerca”, “Falta” y “Lejos”.
- `mapa.html` no está enlazada desde el inicio; se llega solo por URL directa.

---

## 17. Resumen de estado por flujo

| Flujo | Estado | Dónde se corta | Diagrama |
|---|---|---|---|
| Inicio → elegir línea → paradas | ⚠️ Funciona con error | `SyntaxError` por `dias.js` duplicado; la página sigue | §4 |
| Resolución de día y feriados | ✅ | — | §5 |
| Arranque del planificador | ⚠️ Funciona con error | `mostrarAvisoDeOrigen` no definida | §6 |
| Búsqueda de paradas y direcciones | ✅ | — | §7 |
| Búsqueda de comercios locales | ❌ | `lugaresDeReferencia` no se consulta | §7 |
| Cálculo de 2 a 4 opciones | ✅ | — | §8 |
| Selección de opción y resumen | ⚠️ | La bajada se reemplaza por la más cercana al destino | §9 |
| Interpolación de horarios | ✅ | — | §10 |
| Simulación de colectivos | ⚠️ demo | Es una animación, no GPS real | §11 |
| Panel del chofer | ❌ | `cargarHorariosDeHoy` no existe | §12 |
| Panel/editor demo | ❌ | `HASH_ACCESO_CHOFER` duplicado | §13 |
| Editor de paradas | ✅ | Guardado directo solo en Chrome/Edge con FSA; en otros navegadores descarga el JSON | §13.1 |
| Respaldo API/local | ✅ | API hardcodeada a `localhost:3000` | §14 |
| Fuente real `prueba.js` | ⚠️ POC | No integrada; errores silenciados | §15 |
| Mapa de calor | ❌ | `cargarHorariosDeHoy` no existe | §16 |

---

## 18. Cómo renderizar los diagramas

Los bloques están en **Mermaid**, un formato de texto que se renderiza en muchos visores.

### GitHub y GitLab

- GitHub renderiza Mermaid de forma nativa en archivos `.md`.
- GitLab también lo soporta en Markdown, según la versión y la configuración del proyecto.
- Si el visor no lo renderiza, se verá el bloque de código, no una imagen rota.

### Visual Studio Code

Instalar la extensión **Markdown Preview Mermaid Support** y abrir la vista previa del Markdown:

```text
Ctrl+Shift+V
```

### Editor en línea

1. Abrir <https://mermaid.live/>.
2. Copiar el contenido que está entre las marcas de apertura y cierre de un bloque Mermaid (sin incluir esas marcas).
3. Pegarlo en el editor y exportar SVG o PNG.

### Línea de comandos

Para convertir un diagrama puntual:

1. Guardar el contenido en `diagrama.mmd`.
2. Ejecutar:

```bash
npx -y @mermaid-js/mermaid-cli -i diagrama.mmd -o diagrama.svg
```

Para exportar a PNG:

```bash
npx -y @mermaid-js/mermaid-cli -i diagrama.mmd -o diagrama.png -w 1600
```

> **Nota:** `mermaid-cli` instala un navegador headless la primera vez. Si no hay red o el entorno lo bloquea, usar el editor en línea.

### Consejos de compatibilidad

- No cambiar los identificadores de nodo (`A`, `B`, `P1`, etc.) sin motivo: las clases de color los referencian.
- Evitar agregar HTML complejo dentro de los nodos; `<br/>` es suficiente.
- Si un visor usa una versión vieja de Mermaid, los diagramas de secuencia y los `stateDiagram-v2` pueden no renderizarse. En ese caso, actualizar el visor o usar mermaid.live.

---

## 19. Mantenimiento de este documento

Este archivo es documentación viva. Conviene actualizarlo cuando cambie alguno de estos puntos:

1. **Se restaure `cargarHorariosDeHoy()`** en `chofer.html` o se cargue el módulo que la provee: actualizar §12 y §17.
2. **Se conecten los comercios** al buscador: actualizar §7, §14 y §17.
3. **Se corrija `mapa.html`**: actualizar §16 y §17.
4. **Se separe `panel.html`** del panel del chofer: actualizar §13.
5. **Se cambie el formato o la ubicación de `paradas_manuales.json`**, o se agregue autenticación al editor: actualizar §13.1 y §14.
6. **Se integre el GPS real** de colectivoya: reemplazar la simulación de §11 por un flujo de datos en vivo y actualizar el aviso de limitaciones.
7. **Se unifiquen las velocidades** (18 vs 25 km/h): actualizar §10.
8. **Se cambie la API** o se configure por entorno: actualizar §14.

### Reglas para no desactualizar los diagramas

- Si se agrega una función, agregar el nodo y el archivo donde vive.
- Si se elimina una función, borrar el nodo y las aristas que la usan.
- Si una falla se corrige, cambiar el nodo rojo por uno verde y anotar la fecha.
- Si un flujo es demo, mantenerlo amarillo y aclararlo en el texto.

---

## Referencias

- [`DOCUMENTACION.md`](DOCUMENTACION.md) — documentación técnica y funcional completa.
- [`VISION.md`](VISION.md) — principios de producto y límites de lo que Busya debe ser.
- [`DOCUMENTACION_CAMBIOS.md`](DOCUMENTACION_CAMBIOS.md) — detalle del cambio de 3 a 4 opciones en el planificador.
- `script/como_llegar/planificador.js` — búsqueda y cálculo de opciones.
- `script/como_llegar/horarios.js` — anclas, interpolación y servicio del día.
- `script/como_llegar/simulador.js` — animación de colectivos.
- `script/como_llegar/api.js` — carga de datos y respaldo.
- `script/dias.js` — día de servicio, feriados y carga de línea.
- `panel/chofer.js` — login, frecuencia y predicción del chofer.
- `prueba.js` — prueba de la fuente real de colectivoya.
