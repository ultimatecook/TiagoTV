/**
 * Where macOS draws the native window buttons (close, minimize, zoom), in
 * window points from the window's top-left corner. The main process places
 * them (`trafficLightPosition`): 22pt in, as the top bar's left padding, and
 * centred on the 84px top bar (35 + 14/2 = 42). The workspace shell keeps its
 * controls clear of them at every app zoom, which scales CSS pixels but not
 * the buttons. A main process built before the top bar still draws them at
 * { x: 16, y: 20 }: the clearance this position gives covers that too.
 */
export const MACOS_TRAFFIC_LIGHTS_POSITION = { x: 22, y: 35 } as const;
