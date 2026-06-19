// Overdrive look: late-night, near-black canvas, neon accents.
export const theme = {
  color: {
    bg: '#08080B',
    surface: '#121218',
    surfaceAlt: '#1B1B24',
    border: '#2A2A36',
    text: '#F2F2F7',
    textDim: '#8A8A9A',
    neon: '#00E5FF', // primary cyan
    neonAlt: '#FF2D7E', // hot pink
    amber: '#FFB020',
    success: '#3DDC84',
    danger: '#FF4D4D',
  },
  // Scene accent per culture tag.
  scene: {
    JDM: '#FF2D7E',
    Euro: '#00E5FF',
    USDM: '#FFB020',
    Other: '#8A8A9A',
  } as Record<string, string>,
  radius: { sm: 8, md: 14, lg: 22, pill: 999 },
  space: (n: number) => n * 4,
  // Mapbox Dark; swap for a custom Studio style URL when you build one.
  mapStyleUrl: 'mapbox://styles/mapbox/dark-v11',
} as const;
