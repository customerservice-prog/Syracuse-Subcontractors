// Provider interface so geocoding/distance calculation can be swapped for a
// real provider (e.g. Google Maps) later. The mock implementation returns a
// fixed Syracuse-area coordinate and computes straight-line distance locally.

export interface GeoProvider {
  geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null>;
  distanceMiles(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
  ): Promise<number>;
}

class MockGeoProvider implements GeoProvider {
  async geocodeAddress(address: string) {
    console.log(`[mock-geo] geocode ${address}`);
    return { latitude: 43.0481, longitude: -76.1474 };
  }

async distanceMiles(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
  ) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(destination.latitude - origin.latitude);
  const dLon = toRad(destination.longitude - origin.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.latitude)) *
    Math.cos(toRad(destination.latitude)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}
}

export const geoProvider: GeoProvider = new MockGeoProvider();
