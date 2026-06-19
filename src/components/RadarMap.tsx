import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Mapbox, { Camera, LineLayer, MapView, MarkerView, ShapeSource } from '@rnmapbox/maps';
import { config } from '@/lib/config';
import { theme } from '@/lib/theme';
import type { Ping } from '@/store/radarStore';
import type { Route } from '@/services/routing';

Mapbox.setAccessToken(config.mapboxToken);

type Props = {
  me: { lat: number; lng: number } | null;
  pings: Ping[];
  route: Route | null;
  onSelect: (p: Ping) => void;
};

export function RadarMap({ me, pings, route, onSelect }: Props) {
  useEffect(() => {
    Mapbox.setTelemetryEnabled(false);
  }, []);

  return (
    <MapView style={styles.map} styleURL={theme.mapStyleUrl} scaleBarEnabled={false}>
      <Camera
        zoomLevel={14}
        followUserLocation={!route}
        centerCoordinate={me ? [me.lng, me.lat] : undefined}
        animationDuration={600}
      />
      <Mapbox.UserLocation visible androidRenderMode="compass" />

      {route && (
        <ShapeSource
          id="convoy-route"
          shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: route.coordinates }, properties: {} }}
        >
          <LineLayer
            id="convoy-route-line"
            style={{
              lineColor: theme.color.neonAlt,
              lineWidth: 4,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.9,
            }}
          />
        </ShapeSource>
      )}

      {pings.map((p) =>
        p.lat === 0 && p.lng === 0 ? null : (
          <MarkerView key={p.userId} coordinate={[p.lng, p.lat]} allowOverlap>
            <View
              style={[styles.marker, { borderColor: theme.scene[p.scene] ?? theme.color.neon }]}
              onTouchEnd={() => onSelect(p)}
            >
              <Text style={styles.markerText}>{p.scene}</Text>
            </View>
          </MarkerView>
        ),
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  marker: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    backgroundColor: 'rgba(8,8,11,0.85)',
  },
  markerText: { color: theme.color.text, fontSize: 11, fontWeight: '800' },
});
