# 📋 Informe de Cambios — Arquitectura / Eficiencia (Busya v15)

Fecha: 2026-11-21
Alcance: Evaluación de eficiencia → limpieza/arquitectura inicial.

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
