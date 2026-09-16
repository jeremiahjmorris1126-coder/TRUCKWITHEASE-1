import { useState, useEffect, useCallback } from 'react';

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  weatherCode: number;
  visibilityMiles: number;
  conditionText: string;
  locationLabel: string;
  coords: { lat: number; lon: number } | null;
  updatedAt: Date;
}

export type WeatherAlertType = 'WIND' | 'FOG' | 'SEVERE' | 'CLEAR';
export type WeatherSeverity = 'CRITICAL' | 'WARNING' | 'ADVISORY' | 'NORMAL';

export interface WeatherAlertInfo {
  type: WeatherAlertType;
  severity: WeatherSeverity;
  title: string;
  message: string;
  speedAdvisoryMph: number | null;
  equipmentHazard: string;
  metricSnippet: string;
}

export interface UseRealtimeWeatherReturn {
  weather: WeatherData | null;
  alert: WeatherAlertInfo | null;
  loading: boolean;
  error: string | null;
  isSimulated: boolean;
  refetch: () => Promise<void>;
  simulateCondition: (condition: WeatherAlertType) => void;
}

const getWmoDescription = (code: number): string => {
  switch (code) {
    case 0:
      return 'Clear Sky';
    case 1:
    case 2:
      return 'Partly Cloudy';
    case 3:
      return 'Overcast';
    case 45:
    case 48:
      return 'Heavy Dense Fog';
    case 51:
    case 53:
    case 55:
      return 'Drizzle';
    case 56:
    case 57:
      return 'Freezing Drizzle';
    case 61:
    case 63:
    case 65:
      return 'Rain';
    case 66:
    case 67:
      return 'Freezing Rain (Black Ice)';
    case 71:
    case 73:
    case 75:
    case 77:
      return 'Snow / Blizzard';
    case 80:
    case 81:
    case 82:
      return 'Rain Showers';
    case 85:
    case 86:
      return 'Heavy Snow Showers';
    case 95:
    case 96:
    case 99:
      return 'Severe Thunderstorm';
    default:
      return 'Unknown Corridor Weather';
  }
};

const evaluateWeatherAlert = (
  windSpeed: number,
  windGusts: number,
  weatherCode: number,
  visibilityMiles: number
): WeatherAlertInfo | null => {
  // 1. Fog conditions
  if (weatherCode === 45 || weatherCode === 48 || visibilityMiles < 1.0) {
    const isExtreme = visibilityMiles < 0.25;
    return {
      type: 'FOG',
      severity: isExtreme ? 'CRITICAL' : 'WARNING',
      title: isExtreme ? 'ZERO-VISIBILITY TULE FOG' : 'DENSE CORRIDOR FOG ADVISORY',
      message: isExtreme
        ? 'Visibility under 1/4 mile. High multi-vehicle pileup risk. Reduce speed to 35 MPH or safely pull into a designated truck stop.'
        : 'Dense fog layers ahead. Switch off high beams (low beams only). Maintain 8-second following distance.',
      speedAdvisoryMph: isExtreme ? 35 : 45,
      equipmentHazard: '53ft Semi / Optical Sensor Blindness',
      metricSnippet: `Visibility: ${visibilityMiles.toFixed(1)} mi | Code ${weatherCode}`,
    };
  }

  // 2. High wind conditions (Commercial Semi rollover hazard)
  if (windSpeed >= 38 || windGusts >= 48) {
    return {
      type: 'WIND',
      severity: 'CRITICAL',
      title: 'HIGH-PROFILE ROLLOVER WIND WARNING',
      message: `Violent crosswinds detected (${windSpeed.toFixed(0)} MPH sustained, gusts to ${windGusts.toFixed(0)} MPH). Unladen / light 53ft dry vans at extreme risk of blowout tip.`,
      speedAdvisoryMph: 45,
      equipmentHazard: 'Empty / Light 53ft Van & Flatbed',
      metricSnippet: `Sustained: ${windSpeed.toFixed(0)} MPH | Gusts: ${windGusts.toFixed(0)} MPH`,
    };
  } else if (windSpeed >= 28 || windGusts >= 36) {
    return {
      type: 'WIND',
      severity: 'WARNING',
      title: 'CROSSWIND TACTICAL ADVISORY',
      message: `Gusty crosswinds active (${windSpeed.toFixed(0)} MPH, gusts ${windGusts.toFixed(0)} MPH). Hold firm steering grip on bridge crossings and open highway plains.`,
      speedAdvisoryMph: 55,
      equipmentHazard: 'High-Profile Commercial Tractor-Trailer',
      metricSnippet: `Wind: ${windSpeed.toFixed(0)} MPH | Gusts: ${windGusts.toFixed(0)} MPH`,
    };
  }

  // 3. Severe storm / freezing conditions
  if (weatherCode === 66 || weatherCode === 67 || weatherCode >= 95) {
    const isIce = weatherCode === 66 || weatherCode === 67;
    return {
      type: 'SEVERE',
      severity: 'CRITICAL',
      title: isIce ? 'BLACK ICE & FREEZING ROAD SURFACE' : 'SEVERE CORRIDOR THUNDERSTORM',
      message: isIce
        ? 'Freezing rain detected on roadway. Drive axle traction compromise imminent. Disengage engine retarder/jake brake on slippery surfaces.'
        : 'Severe thunderstorm cell with lightning and reduced tire adhesion. Check radar tactical map.',
      speedAdvisoryMph: isIce ? 35 : 50,
      equipmentHazard: isIce ? 'All Commercial Vehicles (No Jake Brake)' : 'Tractor-Trailer Hydroplane',
      metricSnippet: `Conditions: ${getWmoDescription(weatherCode)}`,
    };
  }

  return {
    type: 'CLEAR',
    severity: 'NORMAL',
    title: 'CORRIDOR CLEAR',
    message: 'Road conditions optimal for commercial freight transit. Visibility and wind velocity nominal.',
    speedAdvisoryMph: null,
    equipmentHazard: 'None',
    metricSnippet: `Wind: ${windSpeed.toFixed(0)} MPH | Temp: Normal`,
  };
};

export const useRealtimeWeather = (): UseRealtimeWeatherReturn => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [alert, setAlert] = useState<WeatherAlertInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);

  const fetchWeatherForCoords = useCallback(async (lat: number, lon: number, locationName?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Free, high-reliability Open-Meteo endpoint (no API key required, 100% uptime)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility&wind_speed_unit=mph&temperature_unit=fahrenheit`;
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Weather service returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data && data.current) {
        const cur = data.current;
        const windSpeed = Number(cur.wind_speed_10m || 0);
        const windGusts = Number(cur.wind_gusts_10m || windSpeed * 1.25);
        const windDirection = Number(cur.wind_direction_10m || 0);
        const weatherCode = Number(cur.weather_code || 0);
        const temp = Number(cur.temperature_2m || 68);
        
        // Visibility in meters to miles (1 meter = 0.000621371 miles)
        const visibilityMeters = Number(cur.visibility ?? 16093);
        const visibilityMiles = Math.min(10, Math.max(0.1, visibilityMeters * 0.000621371));

        const derivedAlert = evaluateWeatherAlert(windSpeed, windGusts, weatherCode, visibilityMiles);
        const conditionText = getWmoDescription(weatherCode);

        const newWeather: WeatherData = {
          temperature: Math.round(temp),
          windSpeed: Math.round(windSpeed),
          windGusts: Math.round(windGusts),
          windDirection,
          weatherCode,
          visibilityMiles: parseFloat(visibilityMiles.toFixed(1)),
          conditionText,
          locationLabel: locationName || `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°W`,
          coords: { lat, lon },
          updatedAt: new Date(),
        };

        setWeather(newWeather);
        setAlert(derivedAlert);
        setIsSimulated(Boolean(locationName && locationName.includes('Simulated')));
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to query live atmospheric data';
      console.warn('Live weather query error:', errMsg);
      setError('Live satellite link offline. Showing tactical Wyoming I-80 corridor conditions.');
      
      // Fallback: Wyoming I-80 corridor (known for 38+ mph crosswinds)
      const fallbackAlert: WeatherAlertInfo = {
        type: 'WIND',
        severity: 'WARNING',
        title: 'CROSSWIND TACTICAL ADVISORY',
        message: 'High crosswinds detected on corridor (34 MPH sustained, gusts 44 MPH). Empty 53ft vans exercise extreme caution.',
        speedAdvisoryMph: 55,
        equipmentHazard: '53ft Semi / High-Profile Dry Van',
        metricSnippet: 'Wind: 34 MPH | Gusts: 44 MPH',
      };
      
      setWeather({
        temperature: 42,
        windSpeed: 34,
        windGusts: 44,
        windDirection: 270,
        weatherCode: 3,
        visibilityMiles: 8.5,
        conditionText: 'High Crosswinds (Overcast)',
        locationLabel: 'I-80 Elk Mountain, WY (Corridor)',
        coords: { lat: 41.68, lon: -106.41 },
        updatedAt: new Date(),
      });
      setAlert(fallbackAlert);
      setIsSimulated(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const detectLocationAndFetch = useCallback(() => {
    if (!navigator.geolocation) {
      // Default to Chicago freight corridor
      fetchWeatherForCoords(41.8781, -87.6298, 'Chicago Freight Hub (Default)');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchWeatherForCoords(pos.coords.latitude, pos.coords.longitude, 'GPS Live Position');
      },
      (err) => {
        console.info('Geolocation restricted or denied:', err.message);
        // Realistic simulated corridor (I-80 Wyoming wind corridor)
        fetchWeatherForCoords(41.68, -106.41, 'I-80 Wyoming Wind Corridor (Simulated)');
      },
      { timeout: 7000, enableHighAccuracy: false }
    );
  }, [fetchWeatherForCoords]);

  useEffect(() => {
    detectLocationAndFetch();
  }, [detectLocationAndFetch]);

  const simulateCondition = useCallback((type: WeatherAlertType) => {
    setIsSimulated(true);
    setLoading(false);
    setError(null);

    if (type === 'FOG') {
      const fogAlert: WeatherAlertInfo = {
        type: 'FOG',
        severity: 'CRITICAL',
        title: 'ZERO-VISIBILITY TULE FOG DETECTED',
        message: 'Dense valley fog reducing visibility below 0.3 miles. Reduce vehicle speed to 35 MPH, engage fog lamps, and keep 8-second headway.',
        speedAdvisoryMph: 35,
        equipmentHazard: 'Optical Collision Sensors & 53ft Van',
        metricSnippet: 'Visibility: 0.3 mi | Code 45',
      };
      setAlert(fogAlert);
      setWeather({
        temperature: 46,
        windSpeed: 4,
        windGusts: 6,
        windDirection: 120,
        weatherCode: 45,
        visibilityMiles: 0.3,
        conditionText: 'Dense Freezing Fog',
        locationLabel: 'Central Valley Corridor (I-5 Mile 210)',
        coords: { lat: 36.31, lon: -119.64 },
        updatedAt: new Date(),
      });
    } else if (type === 'WIND') {
      const windAlert: WeatherAlertInfo = {
        type: 'WIND',
        severity: 'CRITICAL',
        title: 'HIGH-PROFILE ROLLOVER WIND WARNING',
        message: 'Extreme crosswinds (42 MPH sustained, gusts 54 MPH). Severe risk of 53ft trailer blowout or tip over. Reduce speed to 45 MPH or take refuge at nearest weigh station/plaza.',
        speedAdvisoryMph: 45,
        equipmentHazard: '53ft Semi Trailers < 25,000 lbs',
        metricSnippet: 'Wind: 42 MPH | Gusts: 54 MPH',
      };
      setAlert(windAlert);
      setWeather({
        temperature: 38,
        windSpeed: 42,
        windGusts: 54,
        windDirection: 285,
        weatherCode: 2,
        visibilityMiles: 9.0,
        conditionText: 'Severe Crosswind Gales',
        locationLabel: 'I-80 Elk Mountain / Arlington, WY',
        coords: { lat: 41.68, lon: -106.41 },
        updatedAt: new Date(),
      });
    } else if (type === 'SEVERE') {
      const severeAlert: WeatherAlertInfo = {
        type: 'SEVERE',
        severity: 'CRITICAL',
        title: 'BLACK ICE & FREEZING ROAD SURFACE',
        message: 'Road temperature 29°F with freezing rain. Bridges and overpasses coated in ice. Turn off engine retarder (jake brake) to prevent tractor jackknife.',
        speedAdvisoryMph: 35,
        equipmentHazard: 'Drive Axle Skid / Jackknife Risk',
        metricSnippet: 'Temp: 29°F | Road: Glaze Ice',
      };
      setAlert(severeAlert);
      setWeather({
        temperature: 29,
        windSpeed: 18,
        windGusts: 26,
        windDirection: 340,
        weatherCode: 66,
        visibilityMiles: 3.5,
        conditionText: 'Freezing Rain & Black Ice',
        locationLabel: 'I-90 Snoqualmie Pass, WA',
        coords: { lat: 47.42, lon: -121.41 },
        updatedAt: new Date(),
      });
    } else {
      const clearAlert: WeatherAlertInfo = {
        type: 'CLEAR',
        severity: 'NORMAL',
        title: 'CORRIDOR CLEAR',
        message: 'Favorable highway weather. Dry pavement, low wind shear, and full visibility along transit route.',
        speedAdvisoryMph: null,
        equipmentHazard: 'None',
        metricSnippet: 'Wind: 9 MPH | Temp: 72°F',
      };
      setAlert(clearAlert);
      setWeather({
        temperature: 72,
        windSpeed: 9,
        windGusts: 12,
        windDirection: 180,
        weatherCode: 0,
        visibilityMiles: 10,
        conditionText: 'Clear & Sunny',
        locationLabel: 'I-40 Flagstaff to Barstow Corridor',
        coords: { lat: 35.19, lon: -111.65 },
        updatedAt: new Date(),
      });
    }
  }, []);

  return {
    weather,
    alert,
    loading,
    error,
    isSimulated,
    refetch: detectLocationAndFetch,
    simulateCondition,
  };
};
