/**
 * Delivery pricing configuration. All amounts in UAH (whole units).
 *
 * Formula:
 *   subtotal   = base + perKm * distanceKm
 *   afterRush  = subtotal * rushHourMultiplier(hour)
 *   final      = afterRush * loadMultiplier(activeOrders / availableCouriers)
 *   final      = clamp(final, minFee, maxFee)
 */
export const PRICING_CONFIG = {
  base: 50,
  perKm: 10,
  minFee: 40,
  maxFee: 400,

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
