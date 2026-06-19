// Derive the scene/culture tag from the make's country of origin.
// The display tag ("JDM — 1997 RX-7 FD") is computed, never stored.
export type Scene = 'JDM' | 'Euro' | 'USDM' | 'Other';

const COUNTRY_TO_SCENE: Record<string, Scene> = {
  Japan: 'JDM',
  Germany: 'Euro',
  Italy: 'Euro',
  'United Kingdom': 'Euro',
  UK: 'Euro',
  France: 'Euro',
  Sweden: 'Euro',
  USA: 'USDM',
  'United States': 'USDM',
};

export function sceneForCountry(country?: string | null): Scene {
  if (!country) return 'Other';
  return COUNTRY_TO_SCENE[country] ?? 'Other';
}

export type RideTagParts = {
  country?: string | null;
  make: string;
  model: string;
  generation: string;
  yearStart?: number | null;
};

// "JDM — 1997 RX-7 FD" / "Euro — 2021 M4 G82"
export function rideTag(p: RideTagParts): { scene: Scene; label: string } {
  const scene = sceneForCountry(p.country);
  const year = p.yearStart ? `${p.yearStart} ` : '';
  return { scene, label: `${scene} — ${year}${p.model} ${p.generation}` };
}
