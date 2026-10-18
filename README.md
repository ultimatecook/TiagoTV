<p align="center">
  <img src="branding/logo-71460.png" alt="71460" width="320" />
</p>

# TiagoTV

Mi reproductor IPTV personal: listas **M3U/M3U8**, **Xtream Codes** y portales
**Stalker**, con una interfaz cinematográfica de vidrio — sidebar con
_Home / Library_, tarjeta destacada "Continue Watching", filas de pósters
"New & Popular" y tema oscuro cálido por defecto.

![TiagoTV Home](docs/tiagotv/home.jpg)

> TiagoTV no incluye listas ni contenido: solo reproduce las fuentes que
> cargues vos.

## Navegación

| Sidebar             | Qué abre                                                              |
| ------------------- | --------------------------------------------------------------------- |
| Home                | Inicio: "Continue Watching" (hero + tarjetas) y "New & Popular"       |
| New & Popular       | El catálogo de la fuente activa ordenado por valoración               |
| TV Shows            | Series de la fuente activa                                            |
| Movies              | Películas de la fuente activa                                         |
| My List             | Favoritos de todas las fuentes                                        |
| Browse by Languages | TV en vivo por categorías (los proveedores agrupan por país / idioma) |
| Recently Added      | Lo último que agregó el proveedor (Xtream)                            |
| Watch Later         | Historial para retomar lo que dejaste a medias                        |
| Downloads           | Descargas offline (app de escritorio)                                 |
| My Account          | Tus fuentes / cuentas IPTV (agregar, editar, vencimientos)            |

El avatar arriba a la derecha cambia la fuente activa (⌘/Ctrl + P).

## Mini-reproductor

Si salís de una película, serie o canal mientras se reproduce, sigue
sonando en la barra de abajo: miniatura con el video, título, cerrar,
−10 s / +10 s, play/pausa, repetir, tiempo, volumen y una línea de progreso
para saltar. Tocar la miniatura o el título vuelve a la página de origen; si
le das Play ahí, la barra se cierra (se reproduce una sola cosa a la vez).
La posición se guarda, así que "Continue Watching" retoma donde quedó.

## Servidor propio en tu red

La app de escritorio acepta IPs locales (`192.168.x.x`, `10.x.x.x`,
`localhost`) en las tres formas de conexión:

- **Lista M3U por URL**, por ejemplo `http://192.168.1.50:8080/videos.m3u`
  con una entrada `#EXTINF` + URL por video (o un archivo `.m3u` local).
- **Xtream Codes**: servidor `http://IP:puerto`, usuario y contraseña.
- **Stalker / Ministra**: URL del portal y MAC.

Para los formatos: MP4 (H.264/AAC), WebM, HLS y MPEG-TS se reproducen con el
reproductor integrado; MKV o HEVC/AC3 conviene abrirlos con MPV o VLC
(Settings → Playback). La guía EPG desde una IP local requiere arrancar la
app con `IPTVNATOR_ALLOW_PRIVATE_NETWORK_URLS=1`.

## Instalar en Mac

1. Entrá a **Releases** del repo y descargá `tiagotv-…-mac-arm64.dmg`
   (Mac con chip Apple).
2. Abrí el `.dmg` y arrastrá **TiagoTV** a **Aplicaciones**.
3. La app no está firmada por Apple, así que la primera vez macOS la
   bloquea. Abrí la **Terminal** y pegá:

    ```bash
    xattr -dr com.apple.quarantine /Applications/TiagoTV.app
    ```

    Después abrila normalmente. (Alternativa: intentá abrirla, y en
    **Configuración del Sistema → Privacidad y seguridad** tocá
    **Abrir de todos modos**.)

**Nuevo instalador:** en GitHub, **Actions → TiagoTV installer (macOS) → Run
workflow**. En unos 6 minutos aparece un release nuevo con el `.dmg`;
reemplazá la app en Aplicaciones (tus fuentes y favoritos se conservan) y
repetí el paso 3. Solo hace falta cuando cambia el motor de la app; la
interfaz se actualiza sola (abajo).

## Instalar en la tele LG

TiagoTV aparece en el menú de la LG con su ícono. Al abrirla se conecta con
tu **servidor TiagoTV** (la versión web, en Docker) y muestra la interfaz que
sirve ese servidor; si no responde, avisa y reintenta sola. Se instala con el
**Developer Mode** de LG, y un workflow lo renueva solo para que la app no se
borre.

### 1. El servidor

En una compu que quede prendida (la Mac sirve), con
[Docker Desktop](https://www.docker.com/products/docker-desktop/) y desde la
carpeta del repo:

```bash
docker compose -f docker/docker-compose.yml up --build -d
```

El `--build` hace falta: sin él Docker baja la imagen de IPTVnator original.
Probalo desde un navegador en `http://IP-DE-LA-COMPU:4333` (en la Mac la IP
sale con `ipconfig getifaddr en0`). La app de la tele lleva esa dirección
grabada, así que reservale una IP fija en el router. La versión web no tiene
guía EPG ni MPV; los detalles están en [docker/README.md](docker/README.md).

### 2. Developer Mode en la tele

1. Creá una cuenta gratis en [LG Developer](https://webostv.developer.lge.com/).
2. En la tele, instalá **Developer Mode** desde la LG Content Store, abrila e
   iniciá sesión con esa cuenta.
3. Activá **Dev Mode Status** (la tele se reinicia), volvé a abrir la app y
   activá **Key Server**. Anotá la IP y la passphrase que muestra.

### 3. Conectar la Mac con la tele

Con Node instalado (`brew install node`):

```bash
npm install -g @webos-tools/cli@3.2.6
ares-setup-device -a tv -i "{'username':'prisoner','host':'IP-DE-LA-TELE','port':'9922'}"
ares-novacom -d tv --getkey    # pide la passphrase de la app Developer Mode
```

**Prueba sin servidor:** `node tools/tiagotv/webos.mjs probe` arma
`com.tiagotv.probe_….ipk` (**TiagoTV prueba**). Instalalo con `ares-install`
como en el paso 4 y abrilo: en unos segundos muestra si la tele deja
conectarse directo con los proveedores y si su motor web alcanza para la
interfaz, o sea si TiagoTV entero podría ir dentro de la app, sin la compu.

### 4. Instalar TiagoTV

En GitHub, **Actions → TiagoTV app (LG webOS) → Run workflow**, con la
dirección del servidor (por ejemplo `http://192.168.1.50:4333`). Bajá el
`.ipk` del release nuevo e instalalo:

```bash
ares-install -d tv ~/Downloads/com.tiagotv.app_0.25.0_all.ipk
```

También podés armarlo desde el repo con
`node tools/tiagotv/webos.mjs package http://192.168.1.50:4333` (queda en
`dist/webos`). Si cambia la dirección del servidor, repetí este paso: la app
nueva reemplaza a la anterior.

### 5. Que no caduque

La sesión del Developer Mode vence, y cuando vence la tele borra las apps
instaladas con él. El workflow **LG Developer Mode renewal** la renueva cada
8 horas, aunque la tele esté apagada. Una sola vez:

1. Leé el token de la sesión:

    ```bash
    ares-novacom -d tv --run "cat /var/luna/preferences/devmode_enabled"
    ```

2. En el repo `TiagoTV`, **Settings → Secrets and variables → Actions → New
   repository secret**: nombre `LG_DEVMODE_TOKEN`, valor el token.
3. **Actions → LG Developer Mode renewal → Run workflow** para probarlo;
   desde ahí corre solo.

Si un día falla (GitHub te avisa por mail), el token cambió, por ejemplo
porque apagaste el Developer Mode o volviste a iniciar sesión: repetí los
pasos 1 y 2. En un repo público, GitHub pausa los workflows programados
después de 60 días sin commits; si pasa, reactivalo desde **Actions**.

## Actualizaciones automáticas

Cada push a `main` que toca la interfaz la publica en el repo público
[`ultimatecook/TiagoTV-updates`](https://github.com/ultimatecook/TiagoTV-updates)
(workflow **TiagoTV interface update**). La app de Mac se fija cada unas
horas, baja la interfaz nueva en segundo plano, avisa con una notificación
y la usa desde la próxima vez que la abrís. Si una versión no arranca, la
app vuelve sola a la que trae instalada.

Solo se publica la interfaz compilada: ni el código ni tus listas. Una vez,
para activarlo:

1. Creá el repo **público** `TiagoTV-updates` en tu cuenta, marcando
   **Add a README file**.
2. En **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens**, creá un token con acceso solo a
   `TiagoTV-updates` y el permiso **Contents: Read and write**.
3. En el repo `TiagoTV`, **Settings → Secrets and variables → Actions →
   New repository secret**: nombre `TIAGOTV_UPDATES_TOKEN`, valor el token.

Cuando un cambio del motor rompe la compatibilidad con interfaces viejas,
se sube `TIAGOTV_UI_SHELL_LEVEL`
(`apps/electron-backend/src/app/services/ui-update-state.ts`): las apps
instaladas ignoran esas interfaces hasta que instales el `.dmg` nuevo.

## Desarrollo

Requiere Node 22.22+ y pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm run serve:backend     # app de escritorio (Electron) con recarga
pnpm run serve:frontend    # solo la UI en el navegador (http://localhost:4200)
```

Para probar sin una cuenta real hay un servidor Xtream de prueba con
catálogo ficticio:

```bash
node --import tsx apps/xtream-mock-server/src/main.ts   # http://localhost:3211
```

y en la app: _Add playlist → Xtream_ con servidor `http://localhost:3211`,
usuario `marketing`, contraseña `marketing`.

## Compilar la app en tu compu

```bash
pnpm run build:backend
pnpm run make:app -- --publishPolicy=never   # instaladores en dist/executables
```

La firma y notarización de macOS están desactivadas para builds personales.
TiagoTV no busca actualizaciones de IPTVnator: se actualiza volviendo a
compilar desde este repo.

## Marca

- `branding/logo-71460.png` — wordmark del sidebar
- `branding/logo-7.png` — monograma (sidebar compacto, tarjetas)
- `branding/app-icon-1024.png` — ícono de la app (los tamaños están en
  `apps/web/src/assets/icons`)

## Créditos y licencia

TiagoTV es un fork de [IPTVnator](https://github.com/4gray/iptvnator) de
4gray, bajo licencia MIT (ver [LICENSE.md](LICENSE.md)). El nombre y el logo
de IPTVnator pertenecen a su autor ([TRADEMARK.md](TRADEMARK.md)); la
documentación original del proyecto está en
[docs/IPTVNATOR_README.md](docs/IPTVNATOR_README.md).
