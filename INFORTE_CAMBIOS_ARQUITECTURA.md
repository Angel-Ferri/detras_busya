# 📋 Informe de Cambios — Arquitectura / Eficiencia (Busya v15)

Fecha: 2026-11-21
Alcance: Evaluación de eficiencia → limpieza/arquitectura inicial.

---

## ✅ Cambio 19 — Mejoras en paradas y horarios (interpolación, medianoche, GPS, UX)

### Tipo de cambio
Mejora: unificación del motor de horarios y UX de la página de paradas.

### Cambios
- **`script/motorHorarios.js`** (nuevo): motor compartido con `distanciaKm`, `distanciaAcumulada` (traza o línea recta), `calcularMinutosRestantes` (cruce de medianoche), `calcularHorariosEstimados` (interpolación por distancia), caché por `(lineaKey, tipoDia)`.
- **`paradas.js`**: `calcularHorariosEstimados` ahora interpola por distancia entre cabeceras (25 km/h solo en el último tramo). `calcularMinutosRestantes` delega al motor (cruce de medianoche). Auto-selección por GPS con distancia en el select. Cartel inteligente que cruza minutos restantes con minutos de caminata. Muestra todos los horarios con scroll al próximo. Fallback por URL `?linea=`.
- **`horarios.js` (como_llegar)**: interpolación por distancia en lugar de por índice.
- **`paradas.html` / `como_llegar.html`**: carga `motorHorarios.js`.

### Verificación
- `paradas.html?linea=linea_a` carga 97 paradas y 5096 registros sin errores.
- Seleccionar parada muestra todos los horarios con scroll al próximo.
- `como_llegar.html` sigue funcionando (4 líneas, 1893 locales).

---\n\n## ✅ Cambio 15 — Opción "Ir caminando" con reglas de decisión

### Tipo de cambio
Mejora de UX/lógica: recomendar caminar solo cuando realmente conviene.

### Antes
La app siempre ofrecía colectivos, incluso para destinos a 2 cuadras: el usuario podía terminar esperando un bus para hacer 4 cuadras.

### Ahora
Nueva función **`evaluarOpcionCaminando(latDestino, lngDestino, opcionesColectivo, esModoPeriferia)`**:
- `distRealKm = distancia recta × 1.25` (corrige el trazado urbano).
- `tiempoPie = round(distRealKm × 12)` y `metrosPie = round(distRealKm × 1000)`.

| Escenario | Regla | Acción |
|---|---|---|
| **A. Corta** | `distRealKm ≤ 0.8 km` | **Opción 1**, badge "🚶 Más rápido que el colectivo" |
| **B. Media** | `0.8 < distRealKm ≤ 2.0 km` y (`tiempoPie ≤ mejorBus + 3` o `caminataEnBus ≥ 70% de distRealKm`) | Alternativa (opción 2) |
| **C. Larga** | `distRealKm > 2.0 km` | Ocultar, salvo periferia con `distRealKm < distParadaMasCercana` → opción 1 con badge "📍 Tu destino está más cerca que cualquier parada" |

- Tarjeta propia en el modal: **"Caminar hasta el destino"**, `${metros} metros aprox. · Sin esperas`, tiempo real.
- Al seleccionarla, se traza la **ruta a pie** en el mapa y se muestra un resumen sin paradas ni líneas.
- El orden final de opciones ya no se re-ordena en el modal: se respeta la prioridad definida al calcular (a pie primero si corresponde).

### Verificación
- Destino a 56 m: "Ir caminando" **primera** con badge, 4 opciones totales.
- Destino a 1.25 km: "Ir caminando" como **alternativa** (opción 2).
- Destino a 6.8 km: **no aparece** caminando.
- Periferia a 10 km con destino a 2.78 km: caminando **primera** con badge de excepción.
- Selección de la opción a pie: ruta trazada, resumen correcto, sin errores de consola.

---

## ✅ Cambio 14 — Arquitectura de precarga por ubicación (`contextoOrigenUsuario`)

### Tipo de cambio
Optimización de rendimiento + UX para usuarios alejados de la ciudad.

### Antes
- `encontrarViajeMasOptimo()` hacía un barrido geográfico de **todas** las paradas en cada búsqueda (FASE 1).
- Si el usuario estaba lejos de la red, devolvía "No hay líneas operando cerca" sin alternativas.
- La búsqueda urbana llegaba a hacer **~2,98 millones** de llamadas a `calcularDistancia` (FASE 3 recorría todas las paradas destino para cada par de transbordo).

### Ahora
1. **`analizarUbicacionUsuario(lat, lng)`** (`planificador.js`): un solo barrido de las 325 paradas que clasifica la zona y deja el contexto listo:
   - `urbana`: hay paradas ≤ 2 km → guarda **todas** en `paradasCercanas` (ordenadas por distancia).
   - `periferia`: la más cercana está entre 2 y 6 km → guarda las **3 paradas de acceso** (priorizando líneas distintas).
   - `muy_alejada`: la más cercana supera 6 km → mismas 3 paradas de acceso.
2. **`contextoOrigenUsuario`** (`estado.js`) guarda zona, paradas y distancia mínima.
3. **`encontrarViajeMasOptimo()` ya no hace FASE 1**: usa el contexto precargado.
   - Urbana: FASE 2 + FASE 3 sobre `paradasCercanas`.
   - Periferia: FASE 2 + FASE 3 sobre las 3 paradas de acceso.
   - Muy alejada: **solo FASE 2** (directos); se omite FASE 3 para no congelar el teléfono.
4. **Opciones con `esModoPeriferia: true`** y aviso en el modal: "Estás a X km de la red urbana. Acércate hasta [Parada]".
5. **Banner anticipado** `#aviso-zona-usuario` (`como_llegar.html`): muestra la zona y la parada más cercana antes de buscar.
6. **Debounce espacial de 100 m** (`mapa.js`): `watchPosition` solo recalcula el contexto si el usuario se desplazó más de 100 m.
7. **Precálculo de destinos candidatos**: `destinosCercanosPorLinea` (top 10 paradas más cercanas al destino por línea) se calcula una vez por búsqueda; FASE 2 y FASE 3 evalúan solo esas candidatas y reutilizan su `distFinal`.

### Impacto medido (navegador, 217 paradas urbanas)
| Métrica | Antes | Ahora |
|---|---|---|
| Llamadas a `calcularDistancia` | ~2.980.000 | ~1.140 |
| Cálculo del viaje (sin render) | ~570 ms | ~85 ms |
| Análisis de ubicación | — | ~0,1 ms |
| Recálculo por movimiento < 100 m | — | 0 (evitado) |

### Verificación
- `node --check` OK en todos los archivos.
- Urbana: 4 opciones, banner oculto.
- Periferia (3,5 km): 3 paradas de acceso, banner y aviso en el modal, 2 opciones.
- Muy alejada (10 km): solo directos (sin transbordos), banner correcto.

---

## ✅ Cambio 1 — Consolidación de `cargarDatosLineaCompleta` en `script/dias.js`

### Tipo de cambio
Limpieza de código muerto / consolidación de duplicación.

### Antes
`cargarDatosLineaCompleta` estaba **declarada dos veces** en el mismo archivo:
- 1ª copia (líneas 6–35): fetch con ruta hardcodeada (`datos/...`), error `No se pudo cargar datos/...`, **no** poblaba `estadoEstudianteHoy`.
- 2ª copia (líneas 76–109): fetch con `RUTA_DATOS`, error `Error al cargar datos de línea: ...`, poblaba `servicioHoy`, `estadoEstudianteHoy` y `paradasSecundarias`.

Por el mecanismo de *hoisting* de funciones en JS, la **segunda copia sobrescribía** a la primera. La primera quedaba como código muerto (parse/compile cost, confusión).

### Ahora
Existe **una sola** implementación de `cargarDatosLineaCompleta`, que conserva la lógica que efectivamente estaba en producción (la 2ª).

### Impacto en funcionamiento
- **Sin cambios de comportamiento funcional esperados**: la segunda copia ya era la efectiva.
- Se elimina ~30 líneas de código muerto.
- Se reduce la superficie de bugs por re-declaración de funciones globales.

---

## ✅ Cambio 2 — Eliminación del include duplicado de `script/dias.js` en `paradas.html`

### Tipo de cambio
Limpieza de carga / deduplicación.

### Antes
`paradas.html` incluía **dos veces** `<script src="script/dias.js"></script>` (una antes de `paradas.js` y otra al final).

### Ahora
Se incluye **una sola vez**.

### Impacto en funcionamiento
- **Sin cambios funcionales esperados**: al cargarse dos veces, el segundo load re-ejecutaba el mismo script (re-declaración de funciones globales y re-inicialización de estado).
- Se evita trabajo de parse/ejecución duplicado y posible colisión de estado.

---

## ✅ Cambio 3 — Adición de caché en memoria (`CACHE_DATOS_LINEA`) en `script/dias.js`

### Tipo de cambio
Optimización de rendimiento / arquitectura de datos.

### Antes
Cada invocación de `cargarDatosLineaCompleta(idLinea, fecha)` hacía:
- `fetch` de `datos/{idLinea}_horarios.json`
- `fetch` opcional de `datos/coordenadas/paradas_secundarias_{idLinea}.json`

…incluso si la misma línea se recién había consultado en la misma sesión/pantalla.

### Ahora
Se mantiene un `Map` (`CACHE_DATOS_LINEA`) indexado por `idLinea` con la clave de fecha (`fechaClave`). Si la línea ya fue cargada para esa fecha, se devuelve el resultado cacheado sin fetch.

### Impacto en funcionamiento (comportamiento)
- **Mejora**: re-seleccionar la misma línea dentro de la misma sesión ya no genera nuevos fetches (ahorro de latencia + tráfico).
- **Cambio**: el dato cacheado se reutiliza (misma referencia de objeto) mientras no cambie la fecha. Para fechas distintas se recarga.

---

## ✅ Cambio 4 — Optimización de eficiencia en los viajes de "Cómo llegar" (`script/como_llegar/planificador.js`)

### Tipo de cambio
Optimización de selección / ordenamiento de opciones de viaje.

### Antes
- Las opciones se ordenaban por **distancia a pie al destino** (`metrosDestino`) como criterio principal, y recién por segundo por tiempo (`tiempoEstimado`).
- Directos absolutos también se ordenaban por `metersDestino` primero.

### Ahora
- Se ordenan por **tiempo total estimado ascendente** (`tiempoEstimado`), como criterio principal (menor tiempo = viaje más eficiente), con `metrosDestino` como criterio de desempate.
- El modal (`mostrarListaDeOpciones`) ordena las opciones por tiempo total antes de renderizar/seleccionar.

### Impacto en funcionamiento
- **Objetivo cumplido:** el viaje óptimo ofrecido ahora prioriza el de **menos tiempo**.
- **Objetivo en curso:** la elección de la parada (origen/bajada) debería evaluar el tiempo total (caminata + colectivo + caminata final) y no solo la cercanía; el ordenamiento por tiempo habilita que la "mejor" sea evaluada correctamente.

---

## ✅ Cambio 5 — Optimización de paradas candidatas en viajes "Cómo llegar" (`script/como_llegar/planificador.js`)

### Tipo de cambio
Optimización de selección de paradas / eficiencia del viaje.

### Antes
- El buscador de orígenes solo consideraba paradas dentro del **primer radio** que tuviera resultados (empezaba en 0.5 km y se detenía al encontrar alguna).
- Esto favorecía la parada más cercana, aunque no siempre sea la de mejor tiempo.

### Ahora
- Se recorren los radios de amplitud (0.5 → 3.0 km en pasos de 0.5) y se acumulan candidatas.
- Se deduplican por `lineaKey + parada`.

### Impacto en funcionamiento
- **Objetivo:** la parada evaluada ya no se limita solo a la más cercana; se consideran candidatas más allá (2ª, 3ª, etc.) y el ranking por **menor tiempo total** decide la opción eficiente.
- **Cambio:** el viaje óptimo puede salir desde una parada ligeramente más lejana si es en promedio más rápido.

---

## ✅ Cambio 13 — Mejoras de modelo de costos, lógica y rendimiento (según feedback)

### Tipo de cambio
Refactor mayor: modelo de costos, lógica de selección y optimización de FASE 3.

### Backup previo
Rama/tag `backup-antes-cambios` + copia física `detras_busya v15 (backup)`.

### 1. Modelo de costos (UX del pasajero)
- **Penalización por transbordo:** `PENALIZACION_TRANSBORDO = 8` min virtuales (espera del segundo colectivo). Evita transbordos absurdos.
- **Factor de incomodidad al caminar:** `PENALIZACION_CAMINATA = 1.4` aplicado solo al **ranking** (el tiempo mostrado al usuario sigue siendo real, sin multiplicar).
- **Límite de caminata final:** `LIMITE_CAMINATA_FINAL = 1.5 km` para directos y transbordos. Los directos absolutos (fallback) no tienen límite.
- Se separa `tiempoReal` (mostrado) de `puntajeRanking` (usado para ordenar/seleccionar).

### 2. Mejoras lógicas
- **FASE 1:** bucle redundante (4 pasadas) reemplazado por un solo recorrido filtrando `distCamina <= 2.0`. Resultado idéntico en 1/4 del tiempo.
- **Líneas circulares/ida-vuelta:** helper `esAdelanteEnRecorrido` con wrap-around (origen en último cuarto + destino en primer cuarto).
- **Directos absolutos:** en vez de fijar solo la parada más cercana al destino, se evalúan las **3 paradas más cercanas** y se queda con el par `(origen, destino)` de menor costo total.
- **Ordenamiento final:** se re-ordena por `puntajeRanking` tras agregar los absolutos (antes la opción 3 podía tener menor tiempo que la 2).
- **Etiquetas en el modal:** badge "⭐ Recomendada" para la opción 1, y etiqueta de categoría ("Directo", "Transbordo", "Menor caminata").

### 3. Optimización de rendimiento (FASE 3)
- **Precalcular proyecciones:** `p.proySeg` se calcula una vez al cargar datos en `api.js` (en `cargarRecorridos`), fuera del cálculo de viajes.
- **Matriz de transbordos precalculada:** `window.transbordosValidos[L1][L2]` se calcula una sola vez al iniciar la app (pares de paradas a ≤ 400 m). FASE 3 pasa de O(N⁴) a consulta de matriz → casi instantánea.
- **Caché de proyecciones (WeakMap)** y **caché de resultados por destino** se mantienen.

### Impacto en funcionamiento
- **Transbordos absurdos eliminados:** la penalización de 8 min evita que aparezcan transbordos que "ahorran" 2 min en papel.
- **Preferencia por viajar sentado:** el factor 1.4 hace que el algoritmo prefiera 3 min más de colectivo antes que caminar 400 m extra.
- **Sin caminatas finales excesivas:** límite de 1.5 km (excepto fallback directos absolutos).
- **FASE 3 ~instantánea:** gracias a la matriz precalculada.
- **Cálculo más limpio:** un solo recorrido en FASE 1, wrap-around para circulares, top-3 destinos en absolutos.

### Verificación
- `node --check` en los 27 archivos JS: CHECK_COMPLETO, sin fallos.
- Probado en navegador: 4 opciones con badges, sin errores de JS, consola limpia.

---

## ✅ Cambio 12 — Restauración de 4 opciones de viaje (`script/como_llegar/planificador.js`)

### Tipo de cambio
Ajuste de UX (reversión parcial del Cambio 9).

### Antes
- Se mostraban hasta **3 opciones** de viaje (Cambio 9).

### Ahora
- Se vuelven a mostrar hasta **4 opciones** de viaje (límite de agregado, contador y render del modal).

### Nota
- El radio de búsqueda de paradas se mantiene en **2.0 km** (Cambio 9) para no perder la optimización de carga.
- El cálculo y el ordenamiento por menor tiempo total se mantienen intactos.

---

## ✅ Cambio 11 — Optimización: memoización de proyecciones + caché de resultados por destino (`utilidades.js` + `planificador.js`)

### Tipo de cambio
Optimización de rendimiento (caché en memoria).

### Antes
- `obtenerProyeccionEnRecorrido` recalculaba la proyección de cada parada sobre el recorrido en cada búsqueda (O(P × recorrido) por parada).
- `encontrarViajeMasOptimo` recalculaba todo aunque el usuario repitiera el mismo destino.

### Ahora
- **Memoización de proyecciones (optimización F):** `obtenerProyeccionEnRecorrido` usa un `WeakMap` por recorrido + `Map` por punto; si la misma parada ya se proyectó, devuelve el resultado cacheado (O(1)).
- **Caché de resultados (optimización B):** `encontrarViajeMasOptimo` guarda el resultado indexado por `(ubicación usuario + destino)` redondeado a 4 decimales. Si se vuelve a pedir el mismo viaje, reusa las opciones y re-renderiza sin recalcular (0 ms). Límite de 20 entradas (LRU simple).

### Impacto en funcionamiento
- **Menos trabajo redundante:** las proyecciones se calculan una sola vez por parada/recorrido.
- **Búsquedas repetidas instantáneas:** al volver a pedir el mismo destino, el modal se muestra sin recalcular.
- **Verificado en navegador:** sin errores de JS, funciones y caché disponibles.

---

## ✅ Cambio 10 — Eliminación de la API (localhost:3000) y uso directo de datos locales (`script/como_llegar/api.js`)

### Tipo de cambio
Eliminación de dependencia de red / optimización de carga.

### Antes
- `cargarHorarios()` intentaba `GET /api/lineas` + `/api/lineas/:id` en `localhost:3000`; al fallar (CORS/timeout) caía al respaldo local, esperando ~1–2 s por búsqueda.
- `cargarLugaresDeReferencia()` intentaba `GET /api/lugares`; al fallar dejaba `lugaresDeReferencia = []` y luego cargaba comercios.
- Se mostraba el aviso "API no disponible".

### Ahora
- `cargarHorarios()` llama directamente a `cargarHorariosLocales()` (sin red).
- `cargarLugaresDeReferencia()` salta la API y carga solo los comercios desde `datos/datos-unificados.json`.
- `origenDeDatos = 'api'` para no mostrar el aviso (los datos locales son ahora la fuente prevista).

### Impacto en funcionamiento
- **Sin intentos de red a localhost:3000** → se eliminan los timeouts de CORS y los warnings de consola.
- **Carga más rápida** al abrir la página y al buscar.
- **Verificado en navegador:** las 4 líneas y los 1893 comercios cargan sin errores de red, y el aviso ya no aparece.

---

## ✅ Cambio 9 — Reducción de carga: menos opciones y radio más corto (`script/como_llegar/planificador.js`)

### Tipo de cambio
Optimización de rendimiento / UX.

### Antes
- Se mostraban hasta **4 opciones** de viaje.
- La búsqueda de paradas de origen recorría radios hasta **3.0 km** (6 pasos de 0.5).

### Ahora
- Se muestran hasta **3 opciones** de viaje (modal, contador y límite de agregado).
- La búsqueda de paradas de origen recorre radios hasta **2.0 km** (4 pasos de 0.5).

### Impacto en funcionamiento
- **Menos trabajo:** ~33 % menos candidatos evaluados y un ciclo menos de agregado → cálculo más rápido y menos opciones que revisar.
- **Más cercanía:** al limitar a 2.0 km, se favorecen paradas realmente cercanas (alineado con "la parada debe ser la más cercana, no siempre la 1ª pero sí cercana").
- **Efecto:** carga más rápida y modal más liviano.

---

## ✅ Cambio 8 — Reducción de tiempos de espera percibidos (`script/como_llegar/planificador.js`)

### Tipo de cambio
Optimización de UX / latencia percibida.

### Antes
- Debounce del buscador: **800 ms**.
- Delay para calcular ruta al seleccionar parada: **450 ms** (×2).
- Delay antes de calcular el viaje óptimo: **150 ms** (×3).

### Ahora
- Debounce: **300 ms**.
- Delay de ruta: **100 ms**.
- Delay de viaje: **50 ms**.

### Impacto en funcionamiento
- **Efecto:** la UI responde ~3× más rápido al escribir y al seleccionar paradas/destinos, sin perder la espera mínima necesaria para que el overlay de carga se pinte antes del cálculo pesado.
- **Sin cambios en la lógica de cálculo** (la optimización algorítmica profunda queda como siguiente paso: Web Worker / cache de resultados).

---

## ✅ Cambio 7 — Corrección de selección de parada: el viaje óptimo ahora prioriza el menor tiempo total (`script/como_llegar/planificador.js`)

### Tipo de cambio
Fix de lógica de selección (bug funcional).

### Problema reportado
El "trazado" sugerido hacía caminar mucho al usuario aunque hubiera una parada muy cerca. La causa: en `registrarOpcion`, cuando dos viajes de una misma línea competían por el mismo slot, se **sobrescribía** la opción según la parada que dejaba **más cerca del destino** (`metrosDestino`), no según el **menor tiempo total**. Así, un origen lejano cuyo destino quedaba unos metros más cerca podía desplazar a un origen muy cercano al usuario.

### Antes
```js
if (viaje.metrosDestino < existente.metrosDestino ||
    (viaje.metrosDestino === existente.metrosDestino && tiempo < existente.tiempoEstimado)) { ... }
```

### Ahora
```js
if (tiempoRedondeado < existente.tiempoEstimado ||
    (tiempoRedondeado === existente.tiempoEstimado && viaje.metrosDestino < existente.metrosDestino)) { ... }
```
- Se prioriza el **menor tiempo total** (caminata al origen + colectivo + caminata final).
- En empate, se desempata por la parada que deja **más cerca del destino**.

### Impacto en funcionamiento
- **Corregido:** ya no se descarta la parada más cercana al usuario por una que solo mejora unos metros la llegada; el viaje óptimo se elige por **menor tiempo total**.
- **Efecto:** el origen (parada de subida) seleccionado es el que minimiza el tiempo completo del viaje, respetando que la parada más cercana suele ser la mejor, pero sin descartar opciones mejores cuando la 2ª o 3ª lo son.
- Mantiene la deduplicación y el ordenamiento por tiempo del Cambio 4 y la búsqueda por radios del Cambio 5.

---

## ✅ Cambio 6 — Reparación: error de ejecución al arrancar (`mostrarAvisoDeOrigen`)

### Tipo de cambio
Fix de bug funcional (error de runtime) detectado en la validación final.

### Antes
- La función `mostrarAvisoDeOrigen` existía en `script/como_llegar/api.js`, pero toda su implementación estaba **comentada** (prefijo `//`).
- `script/como_llegar/inicio.js` (paso 7 del arranque) la invocaba sin comentarios → al cargar la página, con la API caída y usando el respaldo local, el arranque lanzaba:
  **`ReferenceError: mostrarAvisoDeOrigen is not defined`**

### Ahora
- Se restauró la implementación activa de `mostrarAvisoDeOrigen` (muestra el aviso `#aviso-origen-datos` cuando los datos provienen del respaldo local, es decir, `origenDeDatos === 'local'`).
- Se corrigió el typo en el comentario (`datos|no` → `datos no`).

### Impacto en funcionamiento
- **Corregido:** la página ya no arroja el error de JavaScript y el aviso de "API no disponible" se muestra correctamente.
- **Efecto:** el arranque (`DOMContentLoaded`) finaliza sin interrupciones y el aviso visible funciona como estaba previsto.

---

## 🔜 Próximos cambios de arquitectura sugeridos (no aplicados en este lote)

1. Eliminar duplicados restantes de planificador (`planificador.js` vs `planificador copy 2.js` vs `planificador feito.js`).
2. Mover todo a ES modules / bundler para eliminar re-declaraciones globales.
3. Reemplazar renders con `innerHTML` por creación de nodos / template strings.
4. Extraer búsqueda de viajes óptimos fuera del hilo UI (off-main-thread / Web Worker).

---

*Fin del informe de cambios.*
