// Thin wrappers over expo-location + a background geofence task.
// The geofence is the *only* thing running while the radar is dormant: a
// low-power OS callback that wakes the app when the rider actually leaves a
// small bubble around their last position. Continuous GPS stays OFF until then.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const GEOFENCE_TASK = 'overdrive-geofence-wake';
export const WAKE_REGION_ID = 'overdrive-dormant-bubble';
export const WAKE_RADIUS_M = 150; // leave this bubble -> you've started driving

// Sampling profiles per gate state.
export const PROFILE = {
  active: { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 4000 },
  convoy: { accuracy: Location.Accuracy.High, distanceInterval: 8, timeInterval: 1500 },
} as const;

let onWake: (() => void) | null = null;
/** Registered by useLocationManager so the background task can wake the gate. */
export function setWakeHandler(fn: (() => void) | null) {
  onWake = fn;
}

// Background task fires when the rider exits the dormant bubble.
TaskManager.defineTask(GEOFENCE_TASK, ({ data, error }) => {
  if (error) return;
  const { eventType } = data as { eventType: Location.GeofencingEventType };
  if (eventType === Location.GeofencingEventType.Exit) {
    onWake?.();
  }
});

export async function requestPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const fg = await Location.requestForegroundPermissionsAsync();
  let background = false;
  if (fg.status === 'granted') {
    const bg = await Location.requestBackgroundPermissionsAsync();
    background = bg.status === 'granted';
  }
  return { foreground: fg.status === 'granted', background };
}

export async function getCurrent() {
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
}

/** Arm the dormant wake-bubble around a point and stop continuous GPS. */
export async function armGeofence(lat: number, lng: number) {
  const hasBg = await Location.getBackgroundPermissionsAsync();
  if (hasBg.status !== 'granted') return; // foreground-only: gate falls back to a timer
  await Location.startGeofencingAsync(GEOFENCE_TASK, [
    {
      identifier: WAKE_REGION_ID,
      latitude: lat,
      longitude: lng,
      radius: WAKE_RADIUS_M,
      notifyOnEnter: false,
      notifyOnExit: true,
    },
  ]);
}

export async function disarmGeofence() {
  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false);
  if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => {});
}

export type WatchHandle = Location.LocationSubscription;

export async function startWatch(
  profile: { accuracy: Location.Accuracy; distanceInterval: number; timeInterval: number },
  onFix: (loc: Location.LocationObject) => void,
): Promise<WatchHandle> {
  return Location.watchPositionAsync(
    {
      accuracy: profile.accuracy,
      distanceInterval: profile.distanceInterval,
      timeInterval: profile.timeInterval,
    },
    onFix,
  );
}
