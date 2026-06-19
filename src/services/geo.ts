// Geo helpers: privacy obfuscation + coarse region sharding for realtime.

export const GRID_METERS = 50; // privacy snap; matches snap_to_grid() server-side
export const REGION_METERS = 5000; // realtime presence cell (~5km)

const M_PER_DEG = 111_320; // metres per degree at the equator (good enough for snapping)

/** Snap a coordinate to a ~gridM grid for privacy. Server re-snaps on write. */
export function snapToGrid(lng: number, lat: number, gridM = GRID_METERS) {
  const deg = gridM / M_PER_DEG;
  return {
    lng: Math.round(lng / deg) * deg,
    lat: Math.round(lat / deg) * deg,
  };
}

/** Coarse cell id used to shard the realtime radar channel. */
export function regionCell(lng: number, lat: number, cellM = REGION_METERS): string {
  const deg = cellM / M_PER_DEG;
  const cx = Math.floor(lng / deg);
  const cy = Math.floor(lat / deg);
  return `${cx}:${cy}`;
}

/** Haversine distance in metres. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
