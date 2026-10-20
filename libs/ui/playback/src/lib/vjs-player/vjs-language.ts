import videoJs from 'video.js';

/**
 * Video.js draws some text of its own over the video: the error overlay
 * ("No compatible source was found for this media"), the modal dialog
 * descriptions, and the legacy control bar. These are its Spanish strings
 * (Video.js `lang/es.json`), worded like the rest of the app (tú, "vídeo",
 * "En vivo"). The fork ships English and Spanish only; any other app
 * language keeps Video.js's built-in English.
 */
const VJS_SPANISH: Readonly<Record<string, string>> = {
    Play: 'Reproducir',
    'Play Video': 'Reproducir vídeo',
    Pause: 'Pausa',
    'Current Time': 'Tiempo reproducido',
    Duration: 'Duración total',
    'Remaining Time': 'Tiempo restante',
    'Stream Type': 'Tipo de secuencia',
    LIVE: 'En vivo',
    Loaded: 'Cargado',
    Progress: 'Progreso',
    Fullscreen: 'Pantalla completa',
    'Exit Fullscreen': 'Salir de pantalla completa',
    Mute: 'Silenciar',
    Unmute: 'Activar sonido',
    'Playback Rate': 'Velocidad de reproducción',
    Subtitles: 'Subtítulos',
    'subtitles off': 'Subtítulos desactivados',
    Captions: 'Subtítulos especiales',
    'captions off': 'Subtítulos especiales desactivados',
    Chapters: 'Capítulos',
    'You aborted the media playback':
        'Has interrumpido la reproducción del vídeo.',
    'A network error caused the media download to fail part-way.':
        'Un error de red ha interrumpido la descarga del vídeo.',
    'The media could not be loaded, either because the server or network failed or because the format is not supported.':
        'No se ha podido cargar el vídeo debido a un fallo de red o del servidor o porque el formato es incompatible.',
    'The media playback was aborted due to a corruption problem or because the media used features your browser did not support.':
        'La reproducción del vídeo se ha interrumpido por un problema de datos dañados o porque el vídeo usa funciones que tu navegador no admite.',
    'No compatible source was found for this media.':
        'No se ha encontrado ninguna fuente compatible con este vídeo.',
    'Audio Player': 'Reproductor de audio',
    'Video Player': 'Reproductor de vídeo',
    Replay: 'Volver a reproducir',
    'Seek to live, currently behind live':
        'Ir al directo; ahora vas por detrás',
    'Seek to live, currently playing live':
        'Ir al directo; ya estás en directo',
    'Progress Bar': 'Barra de progreso',
    'progress bar timing: currentTime={1} duration={2}': '{1} de {2}',
    Descriptions: 'Descripciones',
    'descriptions off': 'descripciones desactivadas',
    'Audio Track': 'Pista de audio',
    'Volume Level': 'Nivel de volumen',
    'The media is encrypted and we do not have the keys to decrypt it.':
        'El material audiovisual está cifrado y no tenemos las claves para descifrarlo.',
    Close: 'Cerrar',
    'Modal Window': 'Ventana modal',
    'This is a modal window': 'Esta es una ventana modal',
    'This modal can be closed by pressing the Escape key or activating the close button.':
        'Esta ventana modal puede cerrarse presionando la tecla Escape o activando el botón de cierre.',
    ', opens captions settings dialog':
        ', abre el diálogo de configuración de leyendas',
    ', opens subtitles settings dialog':
        ', abre el diálogo de configuración de subtítulos',
    ', selected': ', seleccionado',
    'Close Modal Dialog': 'Cerrar el cuadro de diálogo',
    ', opens descriptions settings dialog':
        ', abre el diálogo de configuración de las descripciones',
    'captions settings': 'configuración de leyendas',
    'subtitles settings': 'configuración de subtítulos',
    'descriptions settings': 'configuración de descripciones',
    Text: 'Texto',
    White: 'Blanco',
    Black: 'Negro',
    Red: 'Rojo',
    Green: 'Verde',
    Blue: 'Azul',
    Yellow: 'Amarillo',
    Magenta: 'Magenta',
    Cyan: 'Cian',
    Background: 'Fondo',
    Window: 'Ventana',
    Transparent: 'Transparente',
    'Semi-Transparent': 'Semitransparente',
    Opaque: 'Opaca',
    'Font Size': 'Tamaño de fuente',
    'Text Edge Style': 'Estilo de borde del texto',
    None: 'Ninguno',
    Raised: 'En relieve',
    Depressed: 'Hundido',
    Uniform: 'Uniforme',
    'Drop shadow': 'Sombra paralela',
    'Font Family': 'Familia de fuente',
    'Proportional Sans-Serif': 'Sans-Serif proporcional',
    'Monospace Sans-Serif': 'Sans-Serif monoespacio',
    'Proportional Serif': 'Serif proporcional',
    'Monospace Serif': 'Serif monoespacio',
    Casual: 'Informal',
    Script: 'Cursiva',
    'Small Caps': 'Versalitas',
    Reset: 'Restablecer',
    'restore all settings to the default values':
        'restablece todas las configuraciones a los valores predeterminados',
    Done: 'Listo',
    'Caption Settings Dialog': 'Diálogo de configuración de leyendas',
    'Beginning of dialog window. Escape will cancel and close the window.':
        'Comienzo de la ventana de diálogo. La tecla Escape cancelará la operación y cerrará la ventana.',
    'End of dialog window.': 'Final de la ventana de diálogo.',
    '{1} is loading.': '{1} se está cargando.',
    'Exit Picture-in-Picture': 'Salir de imagen sobre imagen',
    'Picture-in-Picture': 'Imagen sobre imagen',
    'No content': 'Sin contenido',
    Color: 'Color',
    Opacity: 'Opacidad',
    'Text Background': 'Fondo del texto',
    'Caption Area Background': 'Fondo del área de subtítulos',
    'Skip forward {1} seconds': 'Avanzar {1} segundos',
    'Skip backward {1} seconds': 'Retroceder {1} segundos',
    // Video.js 8 strings its own pack lacks.
    'This is a modal window.': 'Esta es una ventana modal.',
    'Skip Backward': 'Retroceder',
    'Skip Forward': 'Avanzar',
    Time: 'Tiempo',
    'Playing in picture-in-picture': 'Reproduciendo en imagen sobre imagen',
    'Playing in Picture-in-Picture': 'Reproduciendo en imagen sobre imagen',
};

let registered = false;

/** Registers the Spanish dictionary with Video.js, once. */
export function registerVjsLanguages(): void {
    // Unit-test doubles of Video.js are bare functions without it.
    if (registered || typeof videoJs.addLanguage !== 'function') {
        return;
    }
    videoJs.addLanguage('es', { ...VJS_SPANISH });
    registered = true;
}

/** The Video.js `language` option for an app language code. */
export function resolveVjsLanguage(appLanguage?: string | null): 'es' | 'en' {
    return /^es\b/i.test(appLanguage?.trim() ?? '') ? 'es' : 'en';
}
