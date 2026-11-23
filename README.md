# 🚌 Busya — Transporte público de Villa Mercedes

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-online-2ea44f?logo=github)](https://angel-ferri.github.io/detras_busya/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?logo=leaflet)](https://leafletjs.com/)

Planificador de viajes en colectivo para **Villa Mercedes, San Luis (Argentina)**.  
Muestra líneas, paradas, recorridos, horarios y la **mejor ruta** (directa o con transbordo), con opción de ir caminando cuando realmente conviene.

---

## ✨ Características

- 🗺️ **Mapa interactivo** con recorridos y paradas de las 4 líneas (A, E, Zona Este, Zona Oeste).
- 🧭 **Planificador inteligente** que combina viajes directos y con transbordo, penalizando caminata y transbordos.
- 🚶 **Opción "Ir caminando"** cuando conviene (≤ 800 m prioridad; 800 m–2 km si el colectivo no ahorra tiempo; oculta en viajes largos salvo en periferia).
- 📍 **Detección de ubicación** con zonas (urbana / periferia / muy alejada) y paradas de acceso para usuarios lejanos.
- 🔍 **Búsqueda** de paradas, locales y direcciones.
- 📅 **Horarios** por día (lunes a viernes, sábado, domingo y feriados).
- 🎓 **Pase estudiantil** con estado por día.

---

## 🌐 Demo en vivo

👉 **[https://angel-ferri.github.io/detras_busya/](https://angel-ferri.github.io/detras_busya/)**

> Si ves una versión vieja, hacé **Ctrl + F5** (el navegador cachea los `.js`).

---

## 🚀 Desarrollo local

```powershell
# Servidor estático (Node)
node -e "const http=require('http');const fs=require('fs');const path=require('path');const ROOT=path.resolve('.');const PORT=8800;const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='index.html';let f=path.resolve(ROOT,'.'+p);fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end('nf');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});res.end(d);});}).listen(PORT,()=>console.log('http://localhost:'+PORT));"
# Abrir http://localhost:8800/como_llegar.html
```

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
│   └── dias.js
├── estilos/                   # CSS e imágenes
├── datos/                     # JSON de líneas, paradas y horarios
├── tiles/osm/                 # Tiles de OpenStreetMap
└── INFORTE_CAMBIOS_ARQUITECTURA.md
```

---

## 📚 Documentación

- [`DOCUMENTACION.md`](./DOCUMENTACION.md) — documentación general.
- [`VISION.md`](./VISION.md) — visión del proyecto.
- [`DIAGRAMA_FLUJO.md`](./DIAGRAMA_FLUJO.md) — flujo de la app.
- [`INFORTE_CAMBIOS_ARQUITECTURA.md`](./INFORTE_CAMBIOS_ARQUITECTURA.md) — historial de cambios (Cambios 1–15).

---

## 🤝 Contribuir

1. Hacer fork del repositorio.
2. Crear una rama: `git checkout -b mi-mejora`.
3. Commit: `git commit -m "feat: descripción"`.
4. Push y abrir un Pull Request.

---

<p align="center">
  Hecho con ❤️ para Villa Mercedes, San Luis.
</p>
EOF