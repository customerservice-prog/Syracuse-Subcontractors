// Feature flags for provider integrations that are stubbed with mock implementations
// until real credentials are configured. Flip to true only after the corresponding
// provider adapter has real credentials wired up locally.
export const features = {
  smsDelivery: false,
  emailDelivery: false,
  paymentsLive: false,
  aiResumeParsing: false,
  aiAssistedMatching: false,
  backgroundCheckLive: false,
  geoDistanceLive: false,
  gpsGeofenceEnforcement: false,
  dynamicPricing: false,
};

export type FeatureFlags = typeof features;
