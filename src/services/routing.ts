// Mapbox Directions for the "Join Convoy" live route. Debounced by the caller.
import { config } from '@/lib/config';

export type Coord = { lng: number; lat: number };
export type Route = {
  coordinates: [number, number][]; // [lng, lat] for Mapbox line layer
  distanceMeters: number;
  durationSeconds: number;
};

export async function fetchRoute(from: Coord, to: Coord): Promise<Route | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?geometries=geojson&overview=full&access_token=${config.mapboxToken}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[];
  };
  const r = json.routes?.[0];
  if (!r) return null;
  return {
    coordinates: r.geometry.coordinates,
    distanceMeters: r.distance,
    durationSeconds: r.duration,
  };
}
