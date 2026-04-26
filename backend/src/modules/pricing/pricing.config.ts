/**
 * Delivery pricing configuration. All amounts in UAH (whole units).
 *
 * Distance fee uses tiered (piecewise linear) pricing:
 *   first  3  km × 15 ₴/km   — min-trip premium (dense city)
 *   next   7  km × 10 ₴/km   — standard city
 *   next  20  km × 7  ₴/km   — suburbs
 *   next  70  km × 5  ₴/km   — regional
 *   beyond    × 3  ₴/km      — intercity (long haul)
 *
 * Final formula:
 *   subtotal   = base + tieredDistanceFee(distanceKm)
 *   afterRush  = subtotal × rushHourMultiplier(hour)
 *   final      = afterRush × loadMultiplier(activeOrders / availableCouriers)
 *   final      = clamp(final, minFee, maxFee)
 */
export const PRICING_CONFIG = {
  base: 40,
  minFee: 40,
  maxFee: 5000,

  distanceTiers: [
    { upToKm: 3,        perKm: 15, label: 'City (0-3 km)' },
    { upToKm: 10,       perKm: 10, label: 'Standard (3-10 km)' },
    { upToKm: 30,       perKm: 7,  label: 'Suburbs (10-30 km)' },
    { upToKm: 100,      perKm: 5,  label: 'Regional (30-100 km)' },
    { upToKm: Infinity, perKm: 3,  label: 'Intercity (100+ km)' },
  ] as const,

  rushHours: [
    { from: 8, to: 10, multiplier: 1.2, label: 'Morning rush' },
    { from: 12, to: 14, multiplier: 1.3, label: 'Lunch peak' },
    { from: 18, to: 20, multiplier: 1.4, label: 'Evening rush' },
  ] as const,

  load: {
    triggerRatio: 1.0,
    perRatioPoint: 0.2,
    maxMultiplier: 1.5,
  },
};

export type DistanceTier = (typeof PRICING_CONFIG.distanceTiers)[number];
export type RushHourWindow = (typeof PRICING_CONFIG.rushHours)[number];
