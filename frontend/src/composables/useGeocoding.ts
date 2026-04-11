import { ref } from 'vue'

interface Coordinates {
  lat: string
  lng: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

export const useGeocoding = () => {
  const isLocating = ref(false)
  const isGeocoding = ref(false)
  const locationError = ref('')

  const reverseGeocode = async (lat: number, lng: number): Promise<{ address: string; coords: Coordinates } | null> => {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    if (!res.ok) return null
    const data = (await res.json()) as NominatimResult
    return {
      address: data.display_name,
      coords: { lat: String(lat), lng: String(lng) },
    }
  }

  const forwardGeocode = async (address: string): Promise<Coordinates | null> => {
    const query = encodeURIComponent(address)
    const url = `${NOMINATIM_BASE}/search?q=${query}&format=json&limit=1`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    if (!res.ok) return null
    const data = (await res.json()) as NominatimResult[]
    if (!data.length) return null
    return { lat: data[0].lat, lng: data[0].lon }
  }

  const detectLocation = async (): Promise<{ address: string; coords: Coordinates } | null> => {
    locationError.value = ''

    if (!navigator.geolocation) {
      locationError.value = 'Geolocation is not supported by your browser'
      return null
    }

    isLocating.value = true
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
      )
      const { latitude, longitude } = position.coords
      const result = await reverseGeocode(latitude, longitude)
      if (!result) {
        locationError.value = 'Could not resolve address for your location'
        return null
      }
      return result
    } catch {
      locationError.value = 'Location access denied or unavailable'
      return null
    } finally {
      isLocating.value = false
    }
  }

  const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
    locationError.value = ''
    if (!address.trim()) {
      locationError.value = 'Enter an address first'
      return null
    }

    isGeocoding.value = true
    try {
      const result = await forwardGeocode(address)
      if (!result) {
        locationError.value = 'Address not found — try a more specific address'
        return null
      }
      return result
    } catch {
      locationError.value = 'Geocoding failed'
      return null
    } finally {
      isGeocoding.value = false
    }
  }

  return { isLocating, isGeocoding, locationError, detectLocation, geocodeAddress }
}
