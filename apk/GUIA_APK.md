# Guía de APK y modo offline — Busya

## Qué se agregó

- **Capacitor 6** envuelve la app web en un WebView Android.
- Los datos (`datos/`), el código (`script/`, `estilos/`) y el mapa (`tiles/`) se **empaquetan dentro del APK**, por lo que **líneas, paradas, recorridos y horarios funcionan sin internet**.
- El mapa usa tiles locales (`tiles/osm/{z}/{x}/{y}.png`) hasta zoom 16, con fallback online cuando hay conexión.
- Búsqueda offline: se agregó búsqueda sobre los 1893 locales guardados y caché de resultados de Nominatim en `localStorage`.
- Ruta a pie: si no hay internet, se dibuja una línea punteada directa (el tiempo ya se calcula por distancia).
- Service Worker + manifest para que la versión web (GitHub Pages) también funcione sin conexión después de la primera visita.

## Estructura nueva

```
capacitor.config.json     # appId com.busya.app, webDir www
tools/build-www.js      # genera www/ (sin analytics/ads)
tools/descargar-tiles.js # descarga tiles faltantes de z13-16
tools/generar-iconos.ps1 # iconos/splash desde estilos/img/logo.jpeg
tools/build-apk.ps1     # compila el APK debug
script/nativo.js          # adaptador Capacitor (GPS, botón atrás, barra de estado)
vendor/                   # Leaflet, Routing Machine y PolylineDecorator locales
sw.js, manifest.webmanifest
```

## Requisitos

- Node.js 18+ (probado con v24)
- JDK 17 (instalado en `C:\Users\Angel\AppData\Local\BusyaBuild\jdk17`)
- Android SDK en `C:\Users\Angel\AppData\Local\BusyaBuild\Sdk` (platform-tools, android-34, build-tools 34.0.0)

Si se instala en otra máquina, ajustar `JAVA_HOME` y `ANDROID_HOME` en `tools/build-apk.ps1` y en `apk/android/local.properties`.

## Compilar la APK (debug, instalable)

```powershell
npm install
npm run build:web          # genera www/
npm run cap:sync           # sincroniza con apk/android/
npm run android:apk        # compila
```

La APK queda en:

```
apk/android/app/build/outputs/apk/debug/app-debug.apk
```

Copiarla al celular e instalar (habilitar "Orígenes desconocidos" en Ajustes).

## Compilar una APK release (firmada)

1. Generar un keystore (una sola vez, guardar la contraseña):
   ```powershell
   keytool -genkey -v -keystore busya.keystore -alias busya -keyalg RSA -keysize 2048 -validity 10000
   ```
2. En `apk/android/app/build.gradle`, dentro de `android {}`, agregar:
   ```gradle
   signingConfigs {
       release {
           storeFile file('busya.keystore')
           storePassword 'TU_PASSWORD'
           keyAlias 'busya'
           keyPassword 'TU_PASSWORD'
       }
   }
   buildTypes {
       release {
           signingConfig signingConfigs.release
           minifyEnabled false
           proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
       }
   }
   ```
3. Copiar `busya.keystore` a `apk/android/app/`.
4. Compilar:
   ```powershell
   cd android
   .\gradlew.bat assembleRelease
   ```
   APK en `apk/android/app/build/outputs/apk/release/app-release.apk`.

## Actualizar datos

1. Editar los JSON en `datos/` (o correr el panel).
2. `npm run build:web && npm run cap:sync && npm run android:apk`.
3. (Opcional) Subir también la web a GitHub Pages para que los usuarios sin APK tengan la misma versión.

## Regenerar tiles offline

```powershell
node tools/descargar-tiles.js
npm run build:web
```

Descarga los tiles faltantes de z13 a z16 para el bounding box de Villa Mercedes.

## Problemas comunes

- **"SDK location not found"**: revisar `apk/android/local.properties` (`sdk.dir=...` con barras dobles o `/`).
- **Gradle no encuentra JDK**: setear `JAVA_HOME` a la carpeta del JDK 17 antes de compilar.
- **El mapa aparece gris fuera de la ciudad**: la cobertura offline es z13-16 de Villa Mercedes. Fuera de esa zona se necesita conexión.
- **El botón atrás cierra la app en la web**: el adaptador `script/nativo.js` solo actúa dentro del APK (detecta `window.Capacitor`).

## Permisos del APK

- `INTERNET`, `ACCESS_NETWORK_STATE` (mapa online, Nominatim).
- `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` (GPS para "cómo llegar").
EOF