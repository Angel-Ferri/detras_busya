# 🚌 Busya — Transporte público de Villa Mercedes

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-online-2ea44f?logo=github)](https://angel-ferri.github.io/detras_busya/)
[![Android APK](https://img.shields.io/badge/Android-APK%20debug-3ddc84?logo=android)](https://github.com/Angel-Ferri/detras_busya/releases)
[![PWA](https://img.shields.io/badge/PWA-offline%20ready-5a0fc8?logo=pwa)](https://angel-ferri.github.io/detras_busya/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?logo=leaflet)](https://leafletjs.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-6-119eff?logo=capacitor)](https://capacitorjs.com/)

> Planificador de viajes en colectivo para **Villa Mercedes, San Luis (Argentina)**.  
> Muestra líneas, paradas, recorridos, horarios y la **mejor ruta** (directa o con transbordo), con opción de ir caminando. Funciona **sin internet** en el APK y en la web tras la primera visita.

---

## ✨ Características

- 🗺️ **Mapa interactivo** con recorridos y paradas de las 4 líneas (A, E, Zona Este, Zona Oeste).
- 🧭 **Planificador inteligente** que combina viajes directos y con transbordo, penalizando caminata y transbordos.
- 🚶 **Opción "Ir caminando"** cuando realmente conviene (≤ 800 m prioridad; 800 m–2 km si el colectivo no ahorra tiempo; oculta en viajes largos salvo en periferia).
- 📍 **Detección de ubicación** con zonas (urbana / periferia / muy alejada) y paradas de acceso para usuarios lejanos.
- 🔍 **Búsqueda** de paradas, locales y direcciones (con caché offline).
- 📅 **Horarios** por día (lunes a viernes, sábado, domingo y feriados).
- 🎓 **Pase estudiantil** con estado por día.
- 📱 **APK Android** + **PWA** instalable, con datos y mapa empaquetados.

---

## 🌐 Demo en vivo

👉 **[https://angel-ferri.github.io/detras_busya/](https://angel-ferri.github.io/detras_busya/)**

> Si ves una versión vieja, hacé **Ctrl + F5** (el navegador cachea los `.js`).

---

## 📱 Descargar APK

La APK debug está disponible en la carpeta [`dist/`](./dist/) del repositorio y en el [Escritorio del autor]. Para instalar:

1. Copiar `Busya-v15-debug.apk` al teléfono.
2. Abrir el archivo → permitir "Orígenes desconocidos".
3. Instalar.

Guía completa: [`apk/GUIA_APK.md`](./apk/GUIA_APK.md).

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5, CSS3, JavaScript (vanilla) |
| Mapas | [Leaflet](https://leafletjs.com/) 1.9.4 + Routing Machine |
| Empaquetado móvil | [Capacitor](https://capacitorjs.com/) 6 |
| Datos | JSON locales (`datos/`, `data/`) |
| Tiles offline | OpenStreetMap (z13–z16, empaquetados) |
| Cache web | Service Worker + `localStorage` |

---

## 📂 Estructura del proyecto

```
.
├── index.html                 # Menú principal
├── como_llegar.html           # Planificador de viajes
├── mapa.html / paradas.html   # Vista de líneas y paradas
├── chofer.html / panel*.html  # Panel de gestión (admin)
├── script/
│   ├── como_llegar/           # 8 módulos: estado, utilidades, api, horarios, mapa, planificador, simulador, inicio
│   ├── nativo.js              # Adaptador Capacitor (GPS, botón atrás, barra de estado)
│   └── dias.js
├── estilos/                   # CSS e imágenes
├── datos/                     # JSON de líneas, paradas y horarios
├── tiles/osm/                 # Tiles offline (z13–z16)
├── vendor/                    # Leaflet, Routing Machine, PolylineDecorator (locales)
├── tools/                   # build-www, descargar-tiles, generar-iconos, build-apk
├── apk/
│   ├── android/               # Proyecto Capacitor (Android)
│   ├── GUIA_APK.md            # Guía de build e instalación
│   └── Busya-v15-debug.apk    # APK lista para instalar
├── sw.js / manifest.webmanifest
└── INFORTE_CAMBIOS_ARQUITECTURA.md
```

---

## 🚀 Desarrollo local

```powershell
# Servidor estático (Node)
node tools/static-server.js . 8800
# Abrir http://localhost:8800/como_llegar.html
```

## 📦 Compilar la APK

```powershell
npm install
npm run build:web      # genera www/
npm run cap:sync       # sincroniza con Android
npm run android:apk    # compila el APK debug
```

APK en `apk/android/app/build/outputs/apk/debug/app-debug.apk`.

Guía detallada: [`apk/GUIA_APK.md`](./apk/GUIA_APK.md).

---

## 📡 Modo offline

| Recurso | Web (PWA) | APK |
|---------|-----------|-----|
| Líneas, paradas, recorridos, horarios | ✅ tras primera visita | ✅ empaquetado |
| Mapa de Villa Mercedes | ✅ tiles cacheados | ✅ empaquetado (z13–z16) |
| Búsqueda de locales | ✅ cacheada | ✅ 1893 locales |
| Direcciones (Nominatim) | ✅ cacheadas (30 días) | ✅ cacheadas |
| Ruta a pie | ⚠️ requiere internet (OSRM) | ⚠️ línea directa de respaldo |

---

## 📚 Documentación

- [`DOCUMENTACION.md`](./DOCUMENTACION.md) — documentación general.
- [`VISION.md`](./VISION.md) — visión del proyecto.
- [`DIAGRAMA_FLUJO.md`](./DIAGRAMA_FLUJO.md) — flujo de la app.
- [`INFORTE_CAMBIOS_ARQUITECTURA.md`](./INFORTE_CAMBIOS_ARQUITECTURA.md) — historial de cambios (Cambios 1–18).
- [`apk/GUIA_APK.md`](./apk/GUIA_APK.md) — guía de APK y offline.

---

## 🤝 Contribuir

1. Hacer fork del repositorio.
2. Crear una rama: `git checkout -b mi-mejora`.
3. Commit: `git commit -m "feat: descripción"`.
4. Push y abrir un Pull Request.

---

## 📄 Licencia

Proyecto comunitario para el transporte público de Villa Mercedes.  
Uso libre con fines educativos y comunitarios. Para uso comercial, contactar al autor.

---

<p align="center">
  Hecho con ❤️ para Villa Mercedes, San Luis.
</p>
EOF