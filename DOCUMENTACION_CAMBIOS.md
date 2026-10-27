# Documentación de Cambios - Busya "¿Cómo llegar?"

## Cambios realizados

### Archivo modificado: `script/como_llegar/planificador.js`

#### 1. Lógica de selección de opciones en búsqueda inteligente (`encontrarViajeMasOptimo`)

Se modificó la forma en que se arman las 4 opciones mostradas al buscar un destino desde el buscador inteligente:

**Reglas aplicadas:**
- **Opción 1**: Mejor opción general (puede ser directa o con transbordo), ordenada por menor distancia a pie al destino y menor tiempo estimado.
- **Opción 2**: Segunda mejor opción diferente a la primera.
- **Opción 3**: **SIEMPRE debe ser un colectivo directo** (un solo colectivo, sin transbordo). Se priorizan los colectivos directos que dejen a **menos de 400 metros** del destino. Si hay varios, se elige el que deje más cerca. Si no hay ningún directo a menos de 400m, se elige el directo que deje más cerca al destino.
- **Opción 4**: **SIEMPRE debe ser otro colectivo directo** (un solo colectivo, sin transbordo). También se priorizan los directos que dejen a **menos de 400 metros** del destino, siempre que sea una opción diferente a las ya mostradas.

**Detalles técnicos:**
- Se separan las opciones en `opcionesDirectas` y `opcionesTransbordo`.
- Se filtran los directos con `metrosDestino <= 400` en `directosCercaDe400` y se ordenan por distancia al destino.
- Se fuerza a que los índices 2 y 3 (tercera y cuarta opción) sean siempre de tipo `directo`.
- Se evitan duplicados entre las opciones mostradas.
- Máximo de 4 opciones mostradas.

#### 2. Interfaz de opciones (`mostrarListaDeOpciones`)

- Se actualizó para mostrar hasta **4 opciones** en lugar de 3.
- Se mantiene el mismo diseño visual para directos y transbordos.
- Las opciones directas muestran: línea, tiempo total y metros caminando al llegar.
- Las opciones con transbordo muestran: líneas, tiempo total, metros caminando en escala y al destino.

#### 3. Selección de opción (`seleccionarOpcionViaje`)

Al seleccionar cualquiera de las opciones (1-4):
- Se oculta el modal de opciones.
- Si es directa: se configura la línea/destino/origen siguiendo la misma lógica que el sistema usa (se usa `procesarRespuestaSugerencia(true)` con la parada de origen más cercana sugerida).
- Si es con transbordo: se configura el tramo 1 con su origen sugerido y se dibuja el tramo 2 con `dibujarTramoEscalaL2()`.
- Se mantiene la funcionalidad de "Cambiar de línea / Ver otras opciones" para volver al modal.

## Comportamiento esperado

Cuando el usuario busca un destino con la **búsqueda inteligente** (desde `como_llegar.html`):
1. Se calculan todas las opciones directas y con transbordo posibles.
2. Se muestran hasta 4 opciones con la distribución: [mejor general, segunda mejor, directo a <400m (o más cercano), otro directo a <400m (o más cercano)].
3. Las opciones 3 y 4 siempre son colectivos directos, priorizando que dejen al usuario lo más cerca posible del destino (idealmente <400m).
4. Al seleccionar cualquiera, el sistema sigue utilizando la misma lógica de parada de subida/origen que ya tenía implementada.

## Notas

- La lógica respeta el cálculo de `metrosDestino` (distancia caminando desde la parada de bajada hasta el destino buscado).
- Se mantiene la compatibilidad con el resto del sistema de mapas, rutas y horarios.
