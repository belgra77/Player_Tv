# Player_Tv

PWA IPTV instalable en iPhone/iPad. Gestor de listas M3U/M3U8 con reproductor HLS nativo y auto-actualización vía URL remota.

## Despliegue en GitHub Pages
1. Sube los archivos (index.html, styles.css, app.js, sw.js, manifest.json) a un repositorio.
2. Activa GitHub Pages en Settings → Pages → Source: main / root.
3. Abre la URL en Safari (iPhone) y usa "Añadir a pantalla de inicio".

## Prueba local
Servir con cualquier servidor estático: `python3 -m http.server 8080` y abrir http://localhost:8080

## Notas
- Detección iOS usa navigator.userAgent + platform MacIntel con maxTouchPoints.
- hls.js se carga solo por CDN cuando no es iOS.
- Auto-actualización compara versión remota en https://belgra77.github.io/iptv_player_ios_pwa/Player_Tv.html.

## Checklist de requisitos
- [x] Parseo M3U extendido (EXTINF, tvg-id, tvg-name, tvg-logo, group-title)
- [x] CRUD de fuentes (editar/eliminar con confirmación)
- [x] Canales agrupados por group-title colapsables + buscador
- [x] Reproductor HLS nativo en iOS, hls.js fallback
- [x] Ajustes estilo tabla iOS agrupada
- [x] Control de versión y auto-update
- [x] Diseño iOS Cupertino, modo oscuro automático
- [x] PWA instalable (manifest, SW, iconos)
- [x] Nombre Player_Tv en toda la app
