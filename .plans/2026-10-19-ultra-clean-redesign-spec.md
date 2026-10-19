# Handoff: TiagoTV — Rediseño "ultra clean" (barra superior)

## Overview
Rediseño completo de la capa exterior de TiagoTV (IPTV): navegación, Inicio, Deportes (hub + página por liga/deporte), En vivo por país, Series, Películas, Buscador y Ajustes. Lo que pasa dentro de cada plataforma de streaming NO se rediseña (usa su UI nativa).

Prioridades del usuario: fútbol (Real Madrid, Newell's Old Boys, West Ham), plataformas, series y películas; países España, Argentina, USA y UK. Obsesión por jerarquía tipográfica, espaciado y UX.

## About the Design Files
Los archivos de este paquete son **referencias de diseño hechas en HTML**: prototipos que muestran el look y el comportamiento esperados, **no código de producción para copiar**. La tarea es **recrear estos diseños en el código existente de TiagoTV** (Angular + Angular Material, monorepo Nx `ultimatecook/TiagoTV`, librerías en `libs/workspace/*`, i18n con ngx-translate en `apps/web/src/assets/i18n/*.json`), con sus patrones, componentes, servicios y datos reales (SportsCatalogService, SettingsStore, etc.).

Para abrir el prototipo: servir la carpeta con cualquier servidor estático y abrir `TiagoTV Rediseño v2 (barra superior).dc.html` (necesita `support.js` al lado). Los assets (`platforms/`, `sports/`, `channels/`, `flags/`, `fonts/`, `brand/`) ya están en el repo, en `apps/web/src/assets/`.

## Fidelity
**High-fidelity.** Colores, tipografía, espaciado, radios, estados e interacciones son finales. Recrear pixel-perfect.
Los datos (partidos, tablas, títulos, sinopsis, canales) son **relleno**: hay que conectarlos a los datos reales. Ajustes es la excepción: sus secciones, filas, textos y valores por defecto salen del repo (ver más abajo).

---

## Global layout

- **Lienzo del prototipo**: el contenedor raíz tiene `zoom:.8` (preview). Todas las medidas de este README están en px del diseño (antes del zoom). En la app real, usar 1:1.
- **Fondo de la página** (detrás de la ventana): `radial-gradient(120% 70% at 50% -12%, rgba(74,98,52,.55), rgba(40,54,30,.25) 42%, transparent 70%), radial-gradient(38% 46% at 99% 58%, rgba(214,150,74,.28), transparent 70%), radial-gradient(34% 50% at 0% 60%, rgba(150,92,44,.24), transparent 72%), linear-gradient(180deg,#10130d 0%,#15140f 46%,#2a1d12 82%,#3a2717 100%)`.
- **Ventana / panel principal**: radio 34px; borde `1px rgba(255,255,255,.11)`; fondo de vidrio `linear-gradient(168deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.05) 38%, rgba(18,18,16,.32) 100%)` + `backdrop-filter: blur(40px) saturate(150%)`; sombra `inset 0 1px 0 rgba(255,255,255,.14), 0 50px 120px rgba(0,0,0,.5), 0 10px 34px rgba(0,0,0,.35)`. `overflow:hidden`.
- **Área de contenido (`main`)**: un único contenedor con scroll vertical; las barras de scroll van ocultas (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`).
- **Padding de pantallas estándar**: `28px 56px 80px`. Las filas con scroll horizontal llegan hasta el borde: `margin:0 -56px; padding:4px 56px 8px`.
- **Separación entre secciones** en Inicio: 44px. Título de sección → contenido: 20px.

## Top bar (navegación)
- `position: sticky; top:0; z-index:10; height:84px`; **sin fondo** (transparente) y `pointer-events:none` en la barra; `pointer-events:auto` en sus grupos. El contenido pasa por debajo al hacer scroll.
- Grid de 3 columnas `minmax(0,1fr) auto minmax(0,1fr)`, `gap:32px`, `padding:0 28px 0 22px`, items centrados verticalmente.
- **Izquierda**: semáforos de macOS (12px, gap 8px: `#ff5f57`, `#febc2e`, `#28c840`). En la app usar los nativos (`titleBarStyle:'hiddenInset'`; ajustar `trafficLightPosition` para centrarlos verticalmente con la barra, ~`{x:22, y:36}`). A su derecha (gap 20px), **solo en la página de liga**, una pastilla de vidrio "‹ Deportes" (36px de alto, padding `0 14px 0 8px`, 13.5px/600) que vuelve al hub de Deportes.
- **Centro**: cápsula de vidrio con las pestañas. Contenedor: `padding:5px; gap:4px; radius:999px`, vidrio (ver tokens). Pestaña: 38px de alto, `padding:0 20px`, 14.5px/600, letter-spacing -.005em. Activa: fondo `rgba(255,255,255,.2)`, texto `#fff`. Inactiva: transparente, `#bdb9ad` (hover `#fff`).
  Pestañas: **Inicio · Deportes · Series · Películas · En vivo · Mi lista**. (Plataformas salió del menú: vive solo en Inicio.)
- **Derecha** (gap 14px): Buscar y Ajustes como círculos de vidrio de 46px con íconos de 19px; perfil: círculo de 46px con `linear-gradient(160deg,#ff4b50,#b8141a)`, inicial "T" 14px/700, `margin-left:6px`.

---

## Screens

### 01 · Inicio
Orden vertical:
1. **Seguir viendo — hero slider automático** (sangra hasta arriba, por detrás de la barra: `margin:-112px -56px -16px`, `padding:120px 56px 36px`, `min-height:clamp(460px, calc(100vh - 560px), 620px)`).
   - Fondo por ítem: `radial-gradient(90% 110% at 72% 30%, hsl(H 30% 34%), hsl(H 30% 14%) 45%, #0b0b0a 85%)` sobre `#050505`, con transición de 700ms. Velos: izquierda `linear-gradient(90deg, rgba(0,0,0,.78), rgba(0,0,0,.35) 45%, transparent 70%)`; arriba 180px `rgba(0,0,0,.45)→transparent`. Todo el fondo lleva `mask-image: linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)` para fundirse con la página sin corte.
   - Contenido (máx. 680px, gap 16px): etiqueta "SEGUIR VIENDO" 13px/600 uppercase .08em `#d6d2c6` → logo de la plataforma 20px de alto → título Bebas Neue `clamp(64px, 7.5vw, 112px)` line-height .86 uppercase `#fbf8f2` → barra de progreso 220×4px (pista `rgba(255,255,255,.22)`, relleno `#e8262b`) + meta 15px/500 `#d6d2c6` → botones (46px, pill): **Continuar** (blanco, texto `#0b0b09`, ícono play) y **Más info** (vidrio).
   - Indicadores abajo a la derecha (`right:56px; bottom:52px`): barras de 6px de alto; la activa mide 28px de ancho y es `#fff`, las demás 6px y `rgba(255,255,255,.35)`. Transición de ancho de 300ms.
   - **Auto-avance cada 6s**; al tocar un indicador se salta a ese ítem y se reinicia el temporizador.
2. **Plataformas** — fila horizontal, tarjetas de 200px en 16:9, radio 14px, fondo de marca por plataforma (ver `streaming-platforms.ts` en el repo), logo centrado con un inset de 26%/18%. Hover: `translateY(-3px)` + anillo `inset 0 0 0 2px rgba(255,255,255,.9)`.
3. **Deportes** — fila horizontal de tarjetas de liga con jugador recortado (mismo componente que hoy, `sports-rail`). Ancho `calc((100% - 80px)/5.5)` (entran 5,5), aspecto 3/4.3, radio 16px, `padding-top:44px` para que la cabeza del jugador sobresalga. Pastilla de "en vivo" arriba a la derecha (`top:12px; right:12px`), de vidrio, con punto verde `#46d369` que late y el número de partidos en vivo. Click → página de la liga.
   Orden: LaLiga, Premier League, Liga Profesional, Champions, Europa League, Libertadores, MLS, Hypermotion, Serie A, Bundesliga, Ligue 1, Resto del mundo, Tenis, NBA/Básquet.
4. **Eventos de hoy** — lista en una tarjeta (radio 20px, `rgba(255,255,255,.03)`, borde `rgba(255,255,255,.08)`). Filas de 60px con grid `72px 190px minmax(0,1fr) 200px 40px`: hora o minuto (en vivo: punto que late + minuto en `#ff5a5f`), logo + competición, local / marcador o "vs" / visitante (tus equipos en 700 `#f4f1ea`, el resto 500 `#bdb9ad`), canal, botón play circular de 36px. Primero los en vivo. Incluye otros deportes (tenis, NBA). Subtítulo: "N en vivo · N eventos".
5. **Top 10 películas hoy** (subtítulo "En tus plataformas") — fila horizontal, ancho `calc((100% - 48px)/3.6)`, con scroll-snap. Cada ítem: número gigante Bebas 220px, line-height .74, relleno `rgba(255,255,255,.04)` + `-webkit-text-stroke: 2px rgba(255,255,255,.55)`, `margin-right:-22px`; al lado el póster 2/3 (radio 18px) con sombra a la izquierda, logo de la plataforma (14px), título Bebas 38px y meta 12.5px/600 `#bdb9ad`.
6. **Series para vos** — layout editorial: grid `1.7fr 1fr`, `min-height:520px`, gap 16px.
   - Destacada (izquierda, radio 24px, padding 40px): logo 18px + badge → título Bebas 88px → meta 14px/600 → sinopsis 16px/500 line-height 1.5 `#e6e2d8` → botones "Empezar T1 · E1" (blanco) y "Mi lista" (vidrio), ambos de 46px.
   - Dos tarjetas apiladas a la derecha (radio 22px): logo + badge, título Bebas 44px y sinopsis a 2 líneas.
   - Badges (26px, pill, 12px/700): "Nuevo episodio" `#e8262b`/blanco · "Temporada 2" `rgba(255,255,255,.9)`/`#0b0b09` · "Estreno" `#febc2e`/`#0b0b09`.
7. **Últimos canales vistos** — fila horizontal, ancho `calc((100% - 64px)/4.5)`. Tarjeta: miniatura 16:9 con el logo del canal (o su nombre en Bebas si no tiene logo), bandera del país arriba a la derecha (18×12), nombre 14px/600, programa 12.5px `#8c887b` y barra de progreso de 3px `#ff5a5f`.

Todos los encabezados de sección: h2 20px/600, letter-spacing -.01em; link "Ver todo" 13px/500 `#a19d90` (hover `#f4f1ea`).

### 02 · Deportes (hub)
- Encabezado: "Deportes" (h1 32px/600, -.02em) a la izquierda y, centrado verticalmente a la derecha, el selector de día (segmentado: Ayer · Hoy · Mañana · Mié 22 · Jue 23; contenedor `rgba(255,255,255,.06)` radio 12px y padding 4px; botón de 34px, 13px/600; el activo con `rgba(255,255,255,.16)`).
- Fila de tarjetas de liga (la misma de Inicio), justo debajo del encabezado.
- Accesos a tus equipos (pills de 48px con escudo, nombre y estado).
- **En vivo ahora**: grid de 3 tarjetas de partido (escudos de 52px, marcador Bebas 48px, botón blanco "Ver en {canal}").
- **Más tarde**: la misma lista de filas que en Eventos de hoy, con botón de recordatorio (campana).

### 08 · Página de liga / deporte (`/workspace/sports/:sectionId`)
Basada en `sport-section-page.component`, con los textos de `WORKSPACE.SPORTS.*`.
1. **Reproductor a pantalla completa** (`height: 100vh` del área de contenido, `min-height:640px`; sube por detrás de la barra con `margin-top:-84px`). Reproduce el primer canal de la liga.
   - Fondo de reposo: `radial-gradient(70% 90% at 50% 38%, color-mix(tint 55%, #1a1c1e), #0a0b0c 72%, #050505)` y el logo del canal al 22% de opacidad.
   - Arriba a la derecha (`top:104px; right:56px`): pastilla de vidrio de 40px con el logo de la liga, su nombre y "N en vivo" (punto verde que late).
   - Capa inferior (`padding:140px 56px 32px`, velo `transparent → rgba(0,0,0,.82)`): nombre del canal 32px/600 + programa 15px `#d6d2c6`; controles (pausa blanca de 44px, volumen, pantalla completa); barra de progreso de 3px `#ff5a5f`; fila "CANALES" (12px uppercase) con la pista "Partidos y tabla ⌄"; y abajo la fila horizontal de **tarjetas de vidrio por señal** (196px; cada señal numerada, p. ej. "DAZN LaLiga 1…5", con su número en un chip arriba a la derecha). La señal activa lleva borde `rgba(255,255,255,.85)` y la etiqueta "REPRODUCIENDO". Al tocar una, cambia lo que se reproduce.
2. **Al hacer scroll** (`padding:0 56px`, gap 48px):
   - **Partido destacado** (el primero, en vivo o próximo): tarjeta de todo el ancho, radio 28px, padding `40px 48px`, grid `1fr auto 1fr`. Escudos de 88px, nombres 24px/600, pastilla de estado de vidrio ("En vivo · 67'" con punto verde, o día/hora con punto `#febc2e`), marcador Bebas 120px (o "vs" de 64px) y botón blanco "Ver en {canal}". Fondo: color de la liga + brillo del color de cada club en las esquinas + marca de agua del logo al 6%.
   - Grid `minmax(0,1fr) 400px` (gap 40px):
     - **En vivo y más tarde** (subtítulo "N en vivo · N por jugar"): filas de 84px, grid `96px 1fr 88px 1fr auto`: hora/minuto (en verde si en vivo) + día, local con escudo de 40px, marcador (Bebas 36px) o "vs" (20px), visitante, botón con el nombre del canal (blanco si en vivo, vidrio si no). Fondo con el brillo del color de cada club en los extremos.
     - **Tabla de posiciones** (sticky, `top:104px`): cabecera con el color de la liga, logo de 30px, "Tabla de posiciones" 16px/600 y la jornada. Columnas `28px 1fr 76px 30px 38px`: posición (top 3 en `#febc2e`), mini escudo de 24px + equipo, **racha** (5 cuadraditos de 12px: G `#46d369`, E `rgba(255,255,255,.28)`, P `#ef4444`), PJ y Pts (700, blanco). Barra de zona de 3px a la izquierda (Champions `#3b82f6`, Europa League `#f59e0b`, descenso `#ef4444`, ascenso/playoffs `#46d369`) y leyenda al pie. Tus equipos van resaltados con `rgba(255,255,255,.12)`.
     - Sin tabla (Resto del mundo, Tenis, NBA): la columna de partidos ocupa todo el ancho.
   - Sin partidos: `WORKSPACE.SPORTS.NO_MATCHES` en una caja con borde punteado.

### 04 · En vivo (por país)
- Reproductor a pantalla completa por detrás de la barra (`margin-top:-84px`, `height:100%`), sin título ni pill de "En directo".
- Selector de país arriba a la derecha (`top:104px; right:56px`): botón de vidrio de 40px con bandera (22×15) + nombre + chevron; abre un menú desplegable de vidrio (min. 220px, filas de 40px con bandera, nombre y "N canales"). Países: España, Argentina, Estados Unidos, Reino Unido.
- Capa inferior (igual que en la página de liga): canal + programa, controles, progreso, chips de categoría (Todos · Deportes · Generalistas · Noticias · …, de vidrio; el activo `#f4f1ea` con texto `#0b0b09`) y fila de canales en tarjetas de vidrio. El canal activo lleva el overlay "REPRODUCIENDO" y los que pasan fútbol una etiqueta roja "FÚTBOL".

### 06 · Series / Películas (catálogo agregado de todas las plataformas)
- **Hero cinematográfico** por detrás de la barra (`margin-top:-84px`, `padding:104px 0 28px`, `min-height:clamp(560px, calc(100vh - 340px), 780px)`), maquetado en columna: título de la sección (22px/600) arriba → espaciador flexible (24–120px) → bloque de información (logo de 20px, título Bebas `clamp(64px,7.5vw,112px)`, "Tipo · año · géneros · duración", botones Reproducir y Más info) → fila de **Novedades** encima del hero (tarjetas de 300px en 16:9; al tocar una pasa a ser la destacada, con anillo blanco de 2px). Fondo enmascarado para fundirse con la página.
- Debajo: una fila por género (solo los que tienen al menos 2 títulos) con pósters de 188px en 2/3: logo + título Bebas 28px dentro del póster y meta debajo.
- Sin filtros de género o plataforma ni buscador propio (se usa el buscador global).

### 05 · Buscador
Ancho completo. Campo de 60px (radio 16px, texto 20px/500) + chips de alcance (Todo · Fútbol · Canales · Series · Películas). Sin texto: búsquedas recientes. Con texto: grupos (Equipos / Canales / Series y películas) en tarjetas con filas de 64px.

### 07 · Ajustes — **fiel al código**
Fuente de verdad: `libs/workspace/shell/util/src/lib/settings-search/settings-search-sections.ts`, `settings-search-entries.ts`, `settings-search-entries-playback.ts`, `apps/web/src/app/settings/settings-options.ts`, `libs/services/src/lib/settings-store.defaults.ts` y los textos de `SETTINGS.*` en `es.json`. **No se agregó ni se quitó ninguna fila.**
- Layout: grid `232px minmax(0,1fr)`, gap 56px. Rail izquierdo sticky (`top:104px`): h1 "Ajustes" 32px, y la navegación agrupada (cabeceras 11.5px uppercase `#8c887b`: Cuenta, Aplicación, Biblioteca, Dispositivos, Datos; "Acerca de" fijado al pie tras un separador). Ítem de 38px, 14.5px; el activo con `rgba(255,255,255,.12)` en 600.
- Contenido (máx. 860px): h2 24px/600 + subtítulo 14px `#8c887b`; grupos con su título (`CARD_*`, 12px uppercase) en tarjetas (radio 18px). Filas de al menos 64px, `padding:14px 20px`, separador `rgba(255,255,255,.07)`; título 15px/500 y descripción 13px/1.45 `#8c887b`.
- Controles: interruptor 46×28 (encendido `#46d369`, perilla blanca de 22px, transición de 180ms) · segmentado (contenedor `rgba(255,255,255,.07)`, botones de 30px, 13px/600) · valor + chevron (selects) · campo monoespaciado de 240×38 · botones pill de 36px (primario blanco; peligro `rgba(255,107,111,.12)` con texto `#ff7b7f`; secundario de vidrio).
- **Barra de cambios sin guardar** (como `settings.component.html`): pill sticky (`bottom:24px`), de vidrio, con punto `#febc2e`, `UNSAVED_CHANGES_ONE`/`_COUNT` y los botones **Descartar** y **Guardar cambios**.

---

## Interactions & Behavior
- Navegación por pestañas: cada cambio de pantalla resetea el scroll de `main` a 0.
- Slider de Seguir viendo: `setInterval` de 6s; el clic en un indicador hace `goTo(i)` y reinicia el intervalo. Fondo con transición de 700ms.
- Tarjetas: hover `translateY(-3/-4px)` con 200–220ms ease; anillo o borde blanco.
- Punto "en vivo": `@keyframes pulse { 50% { opacity:.35 } }`, 1.6s ease-in-out infinito.
- En vivo y Liga: elegir un canal cambia el reproductor; el canal activo queda marcado.
- Desplegable de país: toggle con rotación de 180° del chevron (160ms) y cierre al elegir.
- Hero de Series/Películas: al tocar una novedad, se actualiza el destacado.
- Ajustes: los cambios quedan en estado *dirty* y la barra aparece; Guardar persiste en `SettingsStore`; Descartar revierte.
- Los botones de la barra de navegación tienen `pointer-events:auto`; el resto de la barra no captura clics, así el contenido de abajo sigue siendo clicable.

## State Management
- `screen` (inicio | futbol | liga | equipo | pais | series | peliculas | buscar | ajustes) → mapear a rutas del router.
- Inicio: índice del slider (`svi`).
- Liga: `sectionId` (de la ruta) y el canal o señal activa por liga (`ligaChan`).
- En vivo: `country`, `cat`, `chan` y `countryOpen`.
- Catálogo: el destacado activo (`feat`).
- Ajustes: sección activa, valores de interruptores y segmentados, y la base guardada (para calcular *dirty*).
- Datos: `SportsCatalogService` (partidos, canales, familias de canales y señales vía `groupChannelFamilies`), el catálogo VOD de Xtream y TMDB (pósters, sinopsis, Top 10), y el historial de canales vistos.

## Design Tokens
**Colores**
- Texto: `#f4f1ea` (principal) · `#fbf8f2` (títulos sobre imagen) · `#e6e2d8` / `#d6d2c6` (secundario sobre imagen) · `#bdb9ad` (secundario) · `#a19d90` (terciario o links) · `#8c887b` (meta) · `#6f6c63` (placeholder).
- Acentos: rojo de marca `#e8262b` (progreso) · rojo en vivo `#ff5a5f` · verde en vivo y OK `#46d369` · ámbar `#febc2e` · zonas `#3b82f6` / `#f59e0b` / `#ef4444` · peligro `#ff7b7f`.
- Superficies: tarjeta `rgba(255,255,255,.04)` con borde `rgba(255,255,255,.08)` · lista `rgba(255,255,255,.03)` · separador `rgba(255,255,255,.07)`.
- **Vidrio** (cápsulas y botones): `linear-gradient(180deg, rgba(255,255,255,.12–.16), rgba(255,255,255,.05–.06))`, borde `1px rgba(255,255,255,.12–.20)`, `inset 0 1px 0 rgba(255,255,255,.14–.20)`, `backdrop-filter: blur(20–24px) saturate(160%)`.
- Tints por liga (en `sport-section-list.ts`): LaLiga `#5c1420` · PL `#3d185a` · Arg `#14466e` · UCL `#0b1d4d` · UEL `#5a2a06` · Lib `#4a3a10` · MLS `#2a1a4a` · Hyp `#103f63` · Serie A `#0e2f5a` · Bundesliga `#5a1414` · Ligue 1 `#16244f` · Resto `#0d4040` · Tenis `#2f4a1c` · NBA `#5a3412`.

**Tipografía**
- UI: DM Sans 400/500/600/700 (`opsz 9..40`).
- Display: Bebas Neue (local, `fonts/bebas-neue/`), siempre en mayúsculas para títulos de contenido y marcadores.
- Escala: 11–12 (labels uppercase, .08em) · 12.5–13.5 (meta) · 14–15.5 (cuerpo y botones) · 16–17 (títulos de tarjeta) · 20 (h2 de sección) · 24 (h2 de Ajustes) · 32 (h1) · Bebas 26/28/36/38/44/46/60/88/112/120/220.

**Espaciado**: 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28 · 32 · 40 · 44 · 48 · 56 · 72 · 80 · 96.
**Radios**: 2–4 (barras e indicadores) · 7–10 (chips y campos) · 12–14 (tarjetas chicas y pastillas) · 16–18 (pósters y tarjetas) · 20–24 (tarjetas grandes) · 28 (destacado de liga) · 34 (ventana) · 999 (pills).
**Sombras**: tarjeta `0 18px 34px -22px rgba(0,0,0,.85)` · flotante `0 20px 40px -12/-16px rgba(0,0,0,.7)` · póster del Top 10 `-18px 0 30px -12px rgba(0,0,0,.6)`.

## Assets
Todos salen del repo (`apps/web/src/assets/`): `platforms/*` (logos de plataformas), `sports/*.webp` + `sports/logos/*` (jugadores y logos de ligas), `channels/*`, `flags/*`, `brand/logo-7.png`, `fonts/bebas-neue/*`, `i18n/es.json`. Los recortes de jugadores de la UEFA se cargan por URL, igual que hoy.
**Placeholders a reemplazar**: los fondos de pósters, heros y series (son degradados por tono, a cambiar por imágenes de TMDB o Xtream) y los escudos de equipos sin asset (círculo con iniciales; usar `team-crests.ts`).

## Files
- `TiagoTV Rediseño v2 (barra superior).dc.html`: el prototipo completo (todas las pantallas; navegable con la barra superior).
- `support.js`: runtime del prototipo (solo para abrirlo; no portar).
- `image-slot.js`: componente de placeholder de imagen del prototipo (no portar).
- Correspondencia con el repo: ver `github.md` en el proyecto de diseño (Screen map).
