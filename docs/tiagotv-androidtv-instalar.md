# TiagoTV en Android TV (proyector Hisense)

TiagoTV también se instala en un proyector o tele con **Android TV**, como el
Hisense PX1-PRO. Es la misma app liviana de la tele LG, con el reproductor
propio de Android. Se instala "de costado" (no está en el Play Store): hay
que permitir apps de origen desconocido una sola vez.

## 1. Permitir apps desconocidas (una vez)

**Ajustes → Preferencias del dispositivo → Seguridad y restricciones →
Orígenes desconocidos** (en inglés: Settings → Device Preferences → Security &
restrictions → Unknown sources) y activá la app con la que vas a instalar
(Downloader, o el explorador de archivos). En algunos Android TV está en
**Ajustes → Apps → Seguridad y restricciones**.

## 2. Bajar e instalar el APK

El archivo se llama `TiagoTV-androidtv-<versión>.apk` y está en la página de
**Releases** del repositorio (`https://github.com/ultimatecook/TiagoTV/releases`).

### Opción A: con la app Downloader (desde el proyector)

1. En el Play Store del proyector instalá **Downloader** (de AFTVnews).
2. Abrila y, en el campo de la dirección, escribí la URL del APK del
   release (tocá el archivo `.apk` en la página de Releases con el botón
   derecho o mantenido para copiar el enlace; es del estilo
   `https://github.com/ultimatecook/TiagoTV/releases/download/.../TiagoTV-androidtv-0.1.0.apk`).
3. Cuando termina de bajar, tocá **Install**. Después podés borrar el archivo
   (Downloader lo ofrece).

### Opción B: desde la Mac con adb

1. En el proyector: **Ajustes → Preferencias del dispositivo → Acerca de**,
   tocá siete veces **Compilación** para activar las opciones de desarrollador;
   después **Preferencias del dispositivo → Opciones para desarrolladores →
   Depuración por red** (Network debugging) activada. Anotá la IP del
   proyector (**Ajustes → Red e Internet**).
2. En la Mac, con las platform-tools de Android instaladas
   (`brew install --cask android-platform-tools`):

    ```bash
    adb connect 192.168.1.50        # la IP del proyector
    adb install -r TiagoTV-androidtv-0.1.0.apk
    ```

    La primera vez el proyector pregunta si confía en la computadora:
    aceptá.

## 3. Primera vez

TiagoTV aparece en la fila de apps del launcher. Al abrirla pide tres
cosas, como en la LG: el **servidor** (con el puerto, si tiene, por ejemplo
`http://servidor.com:8080`), el **usuario** y la **contraseña** de la
cuenta. Quedan guardados en el proyector; no salen a ningún lado más que al
servidor del proveedor.

Control remoto: flechas y OK para moverse, **Atrás** vuelve (en el Inicio
pregunta si querés salir), **CH+/CH−** o arriba/abajo cambian de canal en
el reproductor, **Play/Pausa** y adelantar/atrasar en películas y series,
y hacia abajo en el reproductor aparecen **Subtítulos** y **Audio**. En
**Ajustes → Fluidez**, "Más estable" carga unos segundos por adelantado
(recomendado si la imagen se corta); "Normal" arranca antes.

## 4. Actualizar

Bajá el APK nuevo de Releases e instalalo igual que la primera vez (con
Downloader o `adb install -r`): se instala encima, y los datos (servidor,
usuario, Mi lista, "Continuar viendo") se conservan. Si el proyector dice
que no se puede instalar porque la firma no coincide, es que una de las dos
versiones se compiló sin la clave de firma del repositorio: desinstalá
TiagoTV (**Ajustes → Apps → TiagoTV → Desinstalar**), instalá la nueva y
volvé a cargar la cuenta.

## Si algo no anda

- **No instala / "App no instalada"**: faltó permitir orígenes desconocidos
  para la app que instala (paso 1), o es el problema de firma de arriba.
- **Pantalla negra al abrir un canal, con los menús visibles**: la imagen
  se dibuja detrás de la interfaz; probá otro canal y, si sigue, avisá para
  cambiar el modo de dibujo de la app (`texture_view`).
- **Sin audio en una película (MKV)**: el proyector no decodifica ese
  formato de audio (AC-3/DTS); probá con otra versión del título.
- **"Tu cuenta está en uso en otro dispositivo"**: la cuenta admite una
  sola conexión; cerrá TiagoTV en la Mac o la LG y apretá OK.
- Más detalle para quien mantiene la app: `apps/androidtv/README.md`.
