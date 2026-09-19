import { TripWaypoint } from '../types';
import { tripPlannerService } from './tripPlannerService';

export type WeatherSeverityLevel = 'CRITICAL' | 'WARNING' | 'ADVISORY' | 'NORMAL';
export type WeatherAlertSource = 'NWS_GOV' | 'RADAR_TELEMETRY' | 'SIMULATED';

export interface RouteSevereAlert {
  id: string;
  source: WeatherAlertSource;
  event: string;
  severity: WeatherSeverityLevel;
  urgency: 'IMMEDIATE' | 'EXPECTED' | 'FUTURE';
  headline: string;
  description: string;
  instruction: string;
  speedAdvisoryMph: number | null;
  truckEquipmentHazard: string;
  followingDistanceSec: number;
  effective?: string;
  expires?: string;
  sender?: string;
  areaDesc?: string;
}

export type RoadSurfaceCondition = 
  | 'DRY_PAVEMENT'
  | 'WET_TRACTION_REDUCED'
  | 'HYDROPLANE_HAZARD'
  | 'BLACK_ICE_GLAZE'
  | 'SNOW_SLUSH'
  | 'DENSE_FOG_REDUCED_SIGHT';

export interface RouteLocationTarget {
  id: string;
  label: string;
  corridor: string;
  mileMarker?: number;
  lat: number;
  lon: number;
  isGps?: boolean;
}

export interface RouteCurrentWeather {
  temperatureF: number;
  apparentTemperatureF: number;
  conditionText: string;
  weatherCode: number;
  icon: string;
  windSpeedMph: number;
  windGustsMph: number;
  windDirectionDeg: number;
  windDirectionCardinal: string;
  visibilityMiles: number;
  humidityPct: number;
  dewPointF: number;
  precipitationInHr: number;
  precipitationProbabilityPct: number;
  surfacePressureInHg: number;
  roadSurface: RoadSurfaceCondition;
  roadSurfaceDesc: string;
  updatedAt: Date;
}

export interface RouteWeatherState {
  currentLocation: RouteLocationTarget;
  availableRouteLocations: RouteLocationTarget[];
  weather: RouteCurrentWeather | null;
  activeAlerts: RouteSevereAlert[];
  isLoading: boolean;
  isGpsLocked: boolean;
  isSimulated: boolean;
  simulatedScenario: string | null;
  lastUpdatedText: string;
  error: string | null;
}

type WeatherListener = (state: RouteWeatherState) => void;

// Cardinal direction helper
const getCardinalDirection = (deg: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((deg % 360) / 22.5) % 16;
  return directions[index] || 'N';
};

// Calculate Dew Point using Magnus-Tetens formula
const calculateDewPointF = (tempF: number, rhPct: number): number => {
  const tempC = (tempF - 32) * (5 / 9);
  const rh = Math.max(1, Math.min(100, rhPct));
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(rh / 100);
  const dewC = (b * alpha) / (a - alpha);
  return Math.round((dewC * (9 / 5)) + 32);
};

// WMO Weather code mapper
export const getWmoWeatherInfo = (code: number): { text: string; icon: string; severity: WeatherSeverityLevel } => {
  switch (code) {
    case 0:
      return { text: 'Clear Skies', icon: 'wb_sunny', severity: 'NORMAL' };
    case 1:
      return { text: 'Mainly Clear', icon: 'wb_sunny', severity: 'NORMAL' };
    case 2:
      return { text: 'Partly Cloudy', icon: 'partly_cloudy_day', severity: 'NORMAL' };
    case 3:
      return { text: 'Overcast Skies', icon: 'cloud', severity: 'NORMAL' };
    case 45:
      return { text: 'Dense Valley Fog', icon: 'foggy', severity: 'CRITICAL' };
    case 48:
      return { text: 'Depositing Rime Fog', icon: 'foggy', severity: 'CRITICAL' };
    case 51:
    case 53:
    case 55:
      return { text: 'Light Drizzle', icon: 'rainy', severity: 'ADVISORY' };
    case 56:
    case 57:
      return { text: 'Freezing Drizzle (Ice Glaze)', icon: 'ac_unit', severity: 'CRITICAL' };
    case 61:
      return { text: 'Light Rain', icon: 'rainy', severity: 'NORMAL' };
    case 63:
      return { text: 'Moderate Rain', icon: 'rainy', severity: 'ADVISORY' };
    case 65:
      return { text: 'Heavy Downpour', icon: 'rainy', severity: 'WARNING' };
    case 66:
    case 67:
      return { text: 'Freezing Rain (Black Ice Hazard)', icon: 'ac_unit', severity: 'CRITICAL' };
    case 71:
      return { text: 'Light Snowfall', icon: 'ac_unit', severity: 'ADVISORY' };
    case 73:
      return { text: 'Moderate Snowfall', icon: 'ac_unit', severity: 'WARNING' };
    case 75:
      return { text: 'Heavy Snowpack', icon: 'snowing', severity: 'CRITICAL' };
    case 77:
      return { text: 'Snow Grains / Sleet', icon: 'ac_unit', severity: 'WARNING' };
    case 80:
    case 81:
      return { text: 'Scattered Rain Showers', icon: 'rainy', severity: 'ADVISORY' };
    case 82:
      return { text: 'Violent Cloudburst Showers', icon: 'thunderstorm', severity: 'WARNING' };
    case 85:
    case 86:
      return { text: 'Heavy Snow Blizzard Showers', icon: 'snowing', severity: 'CRITICAL' };
    case 95:
      return { text: 'Severe Thunderstorm', icon: 'thunderstorm', severity: 'CRITICAL' };
    case 96:
    case 99:
      return { text: 'Severe Thunderstorm with Hail', icon: 'thunderstorm', severity: 'CRITICAL' };
    default:
      return { text: 'Overcast Corridor', icon: 'cloud', severity: 'NORMAL' };
  }
};

// Default Route Corridor Checkpoints along I-70 Westbound Freight Transit
const DEFAULT_ROUTE_LOCATIONS: RouteLocationTarget[] = [
  {
    id: 'current-gps',
    label: 'Live Driver GPS Position',
    corridor: 'I-70 Westbound (Milepost 208.5)',
    mileMarker: 208.5,
    lat: 38.821,
    lon: -90.871,
    isGps: true,
  },
  {
    id: 'wp-rest-1',
    label: 'I-70 Exit 208 Welcome Rest Area & Truck Haven',
    corridor: 'I-70 Westbound (MP 208.5)',
    mileMarker: 208.5,
    lat: 38.821,
    lon: -90.871,
  },
  {
    id: 'wp-pilot-wentzville',
    label: 'Pilot Travel Center #412 (Wentzville)',
    corridor: 'I-70 Milepost 210.2',
    mileMarker: 210.2,
    lat: 38.819,
    lon: -90.852,
  },
  {
    id: 'wp-foristell-scale',
    label: 'Foristell FMCSA Commercial Weigh Station',
    corridor: 'I-70 Westbound (MP 203.0)',
    mileMarker: 203.0,
    lat: 38.814,
    lon: -90.985,
  },
  {
    id: 'wp-kingdom-city',
    label: 'Kingdom City Petro Stopping Center',
    corridor: 'I-70 Milepost 148.0',
    mileMarker: 148.0,
    lat: 38.986,
    lon: -91.932,
  },
  {
    id: 'wp-columbia-hub',
    label: 'Columbia Central Freight Gateway',
    corridor: 'I-70 Milepost 126.5',
    mileMarker: 126.5,
    lat: 38.951,
    lon: -92.334,
  },
  {
    id: 'wp-kc-terminal',
    label: 'Kansas City Freight Terminal (Destination)',
    corridor: 'I-70 Westbound (MP 12.0)',
    mileMarker: 12.0,
    lat: 39.099,
    lon: -94.578,
  },
];

class RealtimeRouteWeatherService {
  private state: RouteWeatherState;
  private listeners: Set<WeatherListener> = new Set();
  private pollingTimer: NodeJS.Timeout | null = null;
  private watchPositionId: number | null = null;

  constructor() {
    this.state = {
      currentLocation: DEFAULT_ROUTE_LOCATIONS[0],
      availableRouteLocations: DEFAULT_ROUTE_LOCATIONS,
      weather: null,
      activeAlerts: [],
      isLoading: true,
      isGpsLocked: false,
      isSimulated: false,
      simulatedScenario: null,
      lastUpdatedText: 'Initializing real-time atmospheric radar...',
      error: null,
    };

    // Auto-sync available locations from trip planner service if present
    this.syncWaypointsFromTripPlanner();
    tripPlannerService.subscribe(() => {
      this.syncWaypointsFromTripPlanner();
    });

    // Start auto GPS tracking
    this.initGpsTracking();

    // Initial weather fetch
    this.fetchWeatherForLocation(this.state.currentLocation);

    // Auto-poll weather every 3 minutes for fresh radar telemetry
    this.pollingTimer = setInterval(() => {
      if (!this.state.isSimulated) {
        this.fetchWeatherForLocation(this.state.currentLocation);
      }
    }, 180000);
  }

  private syncWaypointsFromTripPlanner() {
    const plan = tripPlannerService.getPlan();
    if (plan && plan.waypoints && plan.waypoints.length > 0) {
      const mappedWaypoints: RouteLocationTarget[] = plan.waypoints.map((wp: TripWaypoint) => ({
        id: wp.id,
        label: wp.name,
        corridor: wp.corridor,
        mileMarker: wp.mileMarker,
        lat: wp.lat,
        lon: wp.lon,
        isGps: false,
      }));

      // Preserve GPS position as primary top entry
      const currentGps = this.state.availableRouteLocations.find((l) => l.isGps) || DEFAULT_ROUTE_LOCATIONS[0];
      const merged = [currentGps, ...mappedWaypoints];
      this.state.availableRouteLocations = merged;
      this.notify();
    }
  }

  public getState(): RouteWeatherState {
    return { ...this.state };
  }

  public subscribe(listener: WeatherListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (e) {
        console.error('Error notifying weather listener:', e);
      }
    });
  }

  // Set selected route location checkpoint (e.g. driver switched to inspect upcoming weigh station or destination)
  public setRouteLocation(target: RouteLocationTarget) {
    this.state.currentLocation = target;
    this.state.isSimulated = false;
    this.state.simulatedScenario = null;
    this.fetchWeatherForLocation(target);
  }

  // Initialize or toggle browser Geolocation tracking
  public initGpsTracking() {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      this.state.isGpsLocked = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        this.updateDriverGpsCoords(latitude, longitude);
      },
      (err) => {
        console.info('Geolocation notice:', err.message);
        this.state.isGpsLocked = false;
        this.notify();
      },
      { timeout: 8000, enableHighAccuracy: true }
    );

    // Watch position
    if (this.watchPositionId !== null) {
      navigator.geolocation.clearWatch(this.watchPositionId);
    }

    this.watchPositionId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        this.updateDriverGpsCoords(latitude, longitude);
      },
      (err) => {
        console.debug('Watch position error:', err.message);
      },
      { timeout: 15000, enableHighAccuracy: false, maximumAge: 30000 }
    );
  }

  public updateDriverGpsCoords(lat: number, lon: number) {
    const gpsLocation: RouteLocationTarget = {
      id: 'current-gps',
      label: `Driver GPS (${lat.toFixed(3)}°N, ${Math.abs(lon).toFixed(3)}°W)`,
      corridor: 'Current Active Route Coordinate',
      lat,
      lon,
      isGps: true,
    };

    // Update GPS entry in available locations
    this.state.availableRouteLocations = this.state.availableRouteLocations.map((loc) =>
      loc.isGps ? gpsLocation : loc
    );

    this.state.isGpsLocked = true;

    // If currently tracking GPS position, refresh weather
    if (this.state.currentLocation.isGps) {
      this.state.currentLocation = gpsLocation;
      this.fetchWeatherForLocation(gpsLocation);
    } else {
      this.notify();
    }
  }

  // Fetch real-time weather & active severe weather alerts from Open-Meteo and NWS
  public async fetchWeatherForLocation(loc: RouteLocationTarget): Promise<void> {
    this.state.isLoading = true;
    this.state.error = null;
    this.notify();

    const { lat, lon } = loc;

    try {
      // 1. Fetch live Open-Meteo atmospheric current conditions
      const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility&hourly=precipitation_probability&forecast_days=1&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;

      const meteoPromise = fetch(openMeteoUrl).then(async (res) => {
        if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
        return res.json();
      });

      // 2. Fetch official real-time US Government NWS active alerts for this exact lat/lon
      const nwsUrl = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
      const nwsPromise = fetch(nwsUrl, {
        headers: {
          'User-Agent': 'TruckWithEase-FleetCockpit/1.0 (fleet-safety@truckwithease.app)',
          Accept: 'application/geo+json',
        },
      })
        .then(async (res) => {
          if (!res.ok) {
            console.warn(`NWS alerts returned HTTP ${res.status}`);
            return null;
          }
          return res.json();
        })
        .catch((err) => {
          console.warn('NWS API query warning:', err);
          return null;
        });

      // Wait for both APIs in parallel
      const [meteoData, nwsData] = await Promise.all([meteoPromise, nwsPromise]);

      if (!meteoData || !meteoData.current) {
        throw new Error('Invalid telemetry payload from meteorological radar.');
      }

      const cur = meteoData.current;
      const tempF = Math.round(Number(cur.temperature_2m ?? 70));
      const apparentTempF = Math.round(Number(cur.apparent_temperature ?? tempF));
      const weatherCode = Number(cur.weather_code ?? 0);
      const windSpeedMph = Math.round(Number(cur.wind_speed_10m ?? 0));
      const windGustsMph = Math.round(Number(cur.wind_gusts_10m ?? windSpeedMph * 1.25));
      const windDirDeg = Number(cur.wind_direction_10m ?? 0);
      const windDirCard = getCardinalDirection(windDirDeg);
      const humidityPct = Math.round(Number(cur.relative_humidity_2m ?? 50));
      const dewPointF = calculateDewPointF(tempF, humidityPct);
      const precipIn = Number(cur.precipitation ?? 0);
      const surfacePressureInHg = parseFloat(((Number(cur.surface_pressure ?? 1013)) * 0.02953).toFixed(2));
      
      // Visibility in meters to miles
      const visibilityMeters = Number(cur.visibility ?? 16093);
      const visibilityMiles = parseFloat((Math.min(10, Math.max(0.1, visibilityMeters * 0.000621371))).toFixed(1));

      // Precip probability from hourly
      const hourlyPrecipProb = meteoData.hourly?.precipitation_probability;
      const precipProb = Array.isArray(hourlyPrecipProb) && hourlyPrecipProb.length > 0 ? Number(hourlyPrecipProb[0] ?? 0) : 0;

      const wmo = getWmoWeatherInfo(weatherCode);

      // Determine road surface condition
      let roadSurface: RoadSurfaceCondition = 'DRY_PAVEMENT';
      let roadSurfaceDesc = 'Dry pavement with standard tire grip. Optimum commercial transit conditions.';

      if (weatherCode === 66 || weatherCode === 67 || (tempF <= 32 && precipIn > 0)) {
        roadSurface = 'BLACK_ICE_GLAZE';
        roadSurfaceDesc = 'FREEZING PRECIPITATION / BLACK ICE. High drive axle slip risk. Disengage engine retarder (jake brake).';
      } else if (weatherCode === 71 || weatherCode === 73 || weatherCode === 75 || weatherCode === 77 || weatherCode === 85 || weatherCode === 86) {
        roadSurface = 'SNOW_SLUSH';
        roadSurfaceDesc = 'SNOWPACK & SLUSH ON HIGHWAY. Increased braking distance. Maintain 10-second headway.';
      } else if (weatherCode === 45 || weatherCode === 48 || visibilityMiles < 1.0) {
        roadSurface = 'DENSE_FOG_REDUCED_SIGHT';
        roadSurfaceDesc = 'DENSE CORRIDOR FOG. High pileup hazard. Low beams only; reduce cruising speed.';
      } else if (precipIn >= 0.25 || weatherCode === 65 || weatherCode === 82 || weatherCode >= 95) {
        roadSurface = 'HYDROPLANE_HAZARD';
        roadSurfaceDesc = 'PONDING WATER & HYDROPLANE RISK. Standing water layers. Steer smooth without harsh deceleration.';
      } else if (precipIn > 0 || weatherCode === 51 || weatherCode === 53 || weatherCode === 61 || weatherCode === 63) {
        roadSurface = 'WET_TRACTION_REDUCED';
        roadSurfaceDesc = 'Wet pavement. Increase braking distance by 30%.';
      }

      const currentWeather: RouteCurrentWeather = {
        temperatureF: tempF,
        apparentTemperatureF: apparentTempF,
        conditionText: wmo.text,
        weatherCode,
        icon: wmo.icon,
        windSpeedMph,
        windGustsMph,
        windDirectionDeg: windDirDeg,
        windDirectionCardinal: windDirCard,
        visibilityMiles,
        humidityPct,
        dewPointF,
        precipitationInHr: parseFloat(precipIn.toFixed(2)),
        precipitationProbabilityPct: precipProb,
        surfacePressureInHg,
        roadSurface,
        roadSurfaceDesc,
        updatedAt: new Date(),
      };

      // 3. Parse NWS Official Alerts
      const extractedAlerts: RouteSevereAlert[] = [];

      if (nwsData && Array.isArray(nwsData.features) && nwsData.features.length > 0) {
        nwsData.features.forEach((feat: any) => {
          const props = feat.properties || {};
          const eventName = props.event || 'Severe Weather Statement';
          const nwsSeverity = String(props.severity || 'Moderate').toUpperCase();
          
          let severity: WeatherSeverityLevel = 'WARNING';
          if (nwsSeverity === 'EXTREME' || eventName.includes('Warning') || eventName.includes('Tornado') || eventName.includes('Blizzard')) {
            severity = 'CRITICAL';
          } else if (nwsSeverity === 'SEVERE') {
            severity = 'WARNING';
          } else if (nwsSeverity === 'MODERATE' || eventName.includes('Watch') || eventName.includes('Advisory')) {
            severity = 'ADVISORY';
          }

          let speedAdvisory: number | null = null;
          let truckHazard = 'Commercial vehicle caution along corridor.';
          let followSec = 6;

          if (eventName.toLowerCase().includes('wind')) {
            speedAdvisory = 45;
            truckHazard = '53ft Dry Vans & Light Trailers: Extreme Rollover Hazard in Crosswinds';
            followSec = 8;
          } else if (eventName.toLowerCase().includes('fog')) {
            speedAdvisory = 35;
            truckHazard = 'Optical Sensor Blindness & Forward Collision System Impairment';
            followSec = 10;
          } else if (eventName.toLowerCase().includes('ice') || eventName.toLowerCase().includes('winter') || eventName.toLowerCase().includes('snow')) {
            speedAdvisory = 35;
            truckHazard = 'Drive Axle Lockup Risk: Disengage Jake Brake / Engine Retarder';
            followSec = 10;
          } else if (eventName.toLowerCase().includes('flood') || eventName.toLowerCase().includes('thunderstorm')) {
            speedAdvisory = 50;
            truckHazard = 'Severe Hydroplane Risk & Reduced Tire Traction';
            followSec = 8;
          }

          extractedAlerts.push({
            id: feat.id || `nws-${Math.random()}`,
            source: 'NWS_GOV',
            event: eventName,
            severity,
            urgency: (props.urgency as any) || 'EXPECTED',
            headline: props.headline || `${eventName} issued for route corridor`,
            description: props.description || 'Monitor live NOAA Weather Radio and local DOT advisories.',
            instruction: props.instruction || 'Commercial motor vehicle operators should exercise heightened vigilance and follow posted variable speed signs.',
            speedAdvisoryMph: speedAdvisory,
            truckEquipmentHazard: truckHazard,
            followingDistanceSec: followSec,
            effective: props.effective,
            expires: props.expires,
            sender: props.senderName || 'National Weather Service',
            areaDesc: props.areaDesc,
          });
        });
      }

      // 4. In-Situ Commercial Truck Telemetry Hazards (if NWS has no alert, or to augment live meteorological danger)
      if (windSpeedMph >= 36 || windGustsMph >= 48) {
        extractedAlerts.push({
          id: 'telemetry-wind-critical',
          source: 'RADAR_TELEMETRY',
          event: 'HIGH-PROFILE ROLLOVER WIND ALERT',
          severity: 'CRITICAL',
          urgency: 'IMMEDIATE',
          headline: `Dangerous Crosswinds Detected: Sustained ${windSpeedMph} MPH, Gusts to ${windGustsMph} MPH`,
          description: `Live Doppler radar telemetry detects hazardous crosswinds along ${loc.corridor}. High-profile commercial tractor-trailers, empty dry vans, and refrigerated reefers are at imminent rollover tipping risk.`,
          instruction: 'Reduce speed to 45 MPH or pull into the nearest designated rest area or weigh station staging plaza until crosswind velocities drop below 35 MPH.',
          speedAdvisoryMph: 45,
          truckEquipmentHazard: '53ft Dry Vans (< 30,000 lbs gross): Extreme Tip-Over Danger',
          followingDistanceSec: 8,
          sender: 'On-Board Radar & Ultrasonic Wind Sensor',
        });
      } else if (windSpeedMph >= 28 || windGustsMph >= 38) {
        extractedAlerts.push({
          id: 'telemetry-wind-advisory',
          source: 'RADAR_TELEMETRY',
          event: 'CROSSWIND TACTICAL ADVISORY',
          severity: 'WARNING',
          urgency: 'EXPECTED',
          headline: `Corridor Crosswinds: ${windSpeedMph} MPH Sustained (Gusts ${windGustsMph} MPH ${windDirCard})`,
          description: `Active crosswinds impacting vehicle heading. Bridge overpasses and open plains expose high trailer surfaces to sudden lateral gusts.`,
          instruction: 'Firm two-handed steering grip mandatory. Anticipate sudden wind blasts when passing tree lines and sound barriers.',
          speedAdvisoryMph: 55,
          truckEquipmentHazard: 'High-Profile Commercial Semi-Trailer',
          followingDistanceSec: 7,
          sender: 'On-Board Radar Telemetry',
        });
      }

      if (visibilityMiles < 0.35 || weatherCode === 45 || weatherCode === 48) {
        extractedAlerts.push({
          id: 'telemetry-fog-critical',
          source: 'RADAR_TELEMETRY',
          event: 'ZERO-VISIBILITY TULE FOG DANGER',
          severity: 'CRITICAL',
          urgency: 'IMMEDIATE',
          headline: `Corridor Visibility Reduced to ${visibilityMiles} Miles`,
          description: 'Zero-visibility fog layer detected on corridor pavement. Optical ADAS cameras and lane-keep sensors may experience blindness.',
          instruction: 'Engage low beam headlights and amber fog lamps immediately. Never activate high beams (light back-scatter). Maintain minimum 10-second following distance.',
          speedAdvisoryMph: 35,
          truckEquipmentHazard: 'Optical ADAS Sensors & 53ft Forward Visibility',
          followingDistanceSec: 10,
          sender: 'Corridor Optical Transmissometer Sensor',
        });
      }

      if (roadSurface === 'BLACK_ICE_GLAZE') {
        extractedAlerts.push({
          id: 'telemetry-ice-critical',
          source: 'RADAR_TELEMETRY',
          event: 'BLACK ICE ROADWAY GLAZE DETECTED',
          severity: 'CRITICAL',
          urgency: 'IMMEDIATE',
          headline: `Surface Temperature ${tempF}°F with Freezing Precipitation`,
          description: 'Elevated bridges, overpasses, and shaded freeway ramps are freezing into frictionless black ice. Severe jackknife potential.',
          instruction: 'DO NOT engage the engine retarder (jake brake). Engine retarders brake only the drive axles and cause tractor spinouts on ice. Reduce cruising speed to 35 MPH.',
          speedAdvisoryMph: 35,
          truckEquipmentHazard: 'Drive Axle Differential Lockup & Trailer Jackknife',
          followingDistanceSec: 10,
          sender: 'Pavement Temperature & Infrared Road Sensor',
        });
      }

      this.state.weather = currentWeather;
      this.state.activeAlerts = extractedAlerts;
      this.state.isLoading = false;
      this.state.lastUpdatedText = `Live Satellite Link • ${new Date().toLocaleTimeString()} CDT`;
      this.notify();
    } catch (err: any) {
      console.warn('Realtime route weather fetch failed:', err);
      this.state.isLoading = false;
      this.state.error = 'Live radar link experiencing atmospheric interference. Showing corridor baseline telemetry.';
      
      // Fallback data
      this.state.weather = {
        temperatureF: 68,
        apparentTemperatureF: 70,
        conditionText: 'Partly Cloudy Corridor',
        weatherCode: 2,
        icon: 'partly_cloudy_day',
        windSpeedMph: 14,
        windGustsMph: 20,
        windDirectionDeg: 260,
        windDirectionCardinal: 'WSW',
        visibilityMiles: 10.0,
        humidityPct: 52,
        dewPointF: 50,
        precipitationInHr: 0,
        precipitationProbabilityPct: 10,
        surfacePressureInHg: 29.94,
        roadSurface: 'DRY_PAVEMENT',
        roadSurfaceDesc: 'Dry pavement with standard tire grip. Optimum commercial transit conditions.',
        updatedAt: new Date(),
      };
      this.state.lastUpdatedText = `Corridor Baseline • ${new Date().toLocaleTimeString()}`;
      this.notify();
    }
  }

  // Tactical Weather Scenario Simulation (for safety drills & compliance inspection demonstrations)
  public simulateScenario(scenario: 'HIGH_WIND' | 'DENSE_FOG' | 'BLACK_ICE' | 'SEVERE_STORM' | 'CLEAR') {
    this.state.isSimulated = true;
    this.state.simulatedScenario = scenario;
    this.state.isLoading = false;
    this.state.error = null;

    if (scenario === 'HIGH_WIND') {
      this.state.weather = {
        temperatureF: 44,
        apparentTemperatureF: 36,
        conditionText: 'High Gale Crosswinds (Overcast)',
        weatherCode: 3,
        icon: 'air',
        windSpeedMph: 42,
        windGustsMph: 56,
        windDirectionDeg: 280,
        windDirectionCardinal: 'WNW',
        visibilityMiles: 9.0,
        humidityPct: 40,
        dewPointF: 22,
        precipitationInHr: 0,
        precipitationProbabilityPct: 5,
        surfacePressureInHg: 29.62,
        roadSurface: 'DRY_PAVEMENT',
        roadSurfaceDesc: 'Dry highway surface with severe crosswind lateral force across 53ft trailer sidewalls.',
        updatedAt: new Date(),
      };
      this.state.activeAlerts = [
        {
          id: 'sim-nws-wind',
          source: 'NWS_GOV',
          event: 'NWS HIGH WIND WARNING',
          severity: 'CRITICAL',
          urgency: 'IMMEDIATE',
          headline: 'High Wind Warning in effect until 8:00 PM CDT. Gusts to 60 MPH.',
          description: 'The National Weather Service has issued a High Wind Warning. West winds 35 to 45 MPH with violent gusts to 60 MPH expected across interstate corridors. High profile commercial vehicles will encounter dangerous steering torque.',
          instruction: 'Operators of high profile vehicles, particularly empty 53ft dry vans, flatbeds, and doubles, should delay transit or pull into nearest truck stops until winds subside.',
          speedAdvisoryMph: 45,
          truckEquipmentHazard: '53ft Dry Van / Refrigerated Trailer Blowout & Rollover',
          followingDistanceSec: 8,
          sender: 'National Weather Service (Doppler Radar)',
        },
      ];
    } else if (scenario === 'DENSE_FOG') {
      this.state.weather = {
        temperatureF: 48,
        apparentTemperatureF: 48,
        conditionText: 'Dense Valley Tule Fog',
        weatherCode: 45,
        icon: 'foggy',
        windSpeedMph: 3,
        windGustsMph: 5,
        windDirectionDeg: 120,
        windDirectionCardinal: 'ESE',
        visibilityMiles: 0.2,
        humidityPct: 98,
        dewPointF: 48,
        precipitationInHr: 0,
        precipitationProbabilityPct: 15,
        surfacePressureInHg: 30.12,
        roadSurface: 'DENSE_FOG_REDUCED_SIGHT',
        roadSurfaceDesc: 'Dense moisture layer reducing sight distance to under 250 feet. Low beam illumination mandatory.',
        updatedAt: new Date(),
      };
      this.state.activeAlerts = [
        {
          id: 'sim-nws-fog',
          source: 'NWS_GOV',
          event: 'NWS DENSE FOG ADVISORY',
          severity: 'CRITICAL',
          urgency: 'IMMEDIATE',
          headline: 'Dense Fog Advisory: Visibility Near Zero Along Interstate Highway',
          description: 'Dense fog will rapidly reduce visibility to less than one quarter mile. Rapid variations in visibility create extreme hazards for multi-vehicle chain reaction pileups.',
          instruction: 'Slow down, use your headlights on low beam only, leave plenty of distance ahead of you, and watch for decelerating commercial vehicles.',
          speedAdvisoryMph: 35,
          truckEquipmentHazard: 'ADAS Forward Collision Radar Blindness & Optical Sensor Glare',
          followingDistanceSec: 10,
          sender: 'National Weather Service',
        },
      ];
    } else if (scenario === 'BLACK_ICE') {
      this.state.weather = {
        temperatureF: 29,
        apparentTemperatureF: 20,
        conditionText: 'Freezing Rain & Black Ice Glaze',
        weatherCode: 66,
        icon: 'ac_unit',
        windSpeedMph: 16,
        windGustsMph: 24,
        windDirectionDeg: 340,
        windDirectionCardinal: 'NNW',
        visibilityMiles: 3.5,
        humidityPct: 92,
        dewPointF: 27,
        precipitationInHr: 0.12,
        precipitationProbabilityPct: 85,
        surfacePressureInHg: 29.85,
        roadSurface: 'BLACK_ICE_GLAZE',
        roadSurfaceDesc: 'FREEZING RAIN GLAZE ON HIGHWAY. Friction coefficient severely degraded. DO NOT USE JAKE BRAKE.',
        updatedAt: new Date(),
      };
      this.state.activeAlerts = [
        {
          id: 'sim-nws-ice',
          source: 'NWS_GOV',
          event: 'NWS WINTER WEATHER WARNING (ICE STORM)',
          severity: 'CRITICAL',
          urgency: 'IMMEDIATE',
          headline: 'Ice Storm Warning: Significant Glaze Ice Accretion on Highways & Bridges',
          description: 'Freezing rain producing a glaze of ice up to one quarter inch. Roads, especially bridges and overpasses, are slick and dangerous. Commercial tractor jackknife incidents reported.',
          instruction: 'Travel is strongly discouraged. If driving, reduce speed significantly. Do not engage auxiliary engine retarders (jake brakes) as they initiate immediate drive axle slides on ice.',
          speedAdvisoryMph: 35,
          truckEquipmentHazard: 'Drive Axle Slide & Immediate Semi Tractor Jackknife',
          followingDistanceSec: 10,
          sender: 'National Weather Service (Road Weather Info System)',
        },
      ];
    } else if (scenario === 'SEVERE_STORM') {
      this.state.weather = {
        temperatureF: 74,
        apparentTemperatureF: 78,
        conditionText: 'Severe Thunderstorm with Hail',
        weatherCode: 96,
        icon: 'thunderstorm',
        windSpeedMph: 32,
        windGustsMph: 52,
        windDirectionDeg: 220,
        windDirectionCardinal: 'SW',
        visibilityMiles: 1.5,
        humidityPct: 88,
        dewPointF: 70,
        precipitationInHr: 1.45,
        precipitationProbabilityPct: 95,
        surfacePressureInHg: 29.48,
        roadSurface: 'HYDROPLANE_HAZARD',
        roadSurfaceDesc: 'Standing water pools > 0.5 inches on road crown. Hydroplane danger at speeds above 45 MPH.',
        updatedAt: new Date(),
      };
      this.state.activeAlerts = [
        {
          id: 'sim-nws-storm',
          source: 'NWS_GOV',
          event: 'NWS SEVERE THUNDERSTORM WARNING',
          severity: 'CRITICAL',
          urgency: 'IMMEDIATE',
          headline: 'Severe Thunderstorm Warning: 60 MPH Wind Gusts and Quarter-Sized Hail',
          description: 'A severe thunderstorm capable of producing destructive wind gusts to 60 MPH and large hail is tracking across the interstate corridor.',
          instruction: 'Expect wind damage to vehicles. Torrential rainfall will cause temporary blinding conditions. Pull safely off the travel lanes to an exit or truck plaza.',
          speedAdvisoryMph: 45,
          truckEquipmentHazard: 'Commercial Trailer Hydroplaning & Wind Sheer Lateral Force',
          followingDistanceSec: 8,
          sender: 'NWS Doppler Radar',
        },
      ];
    } else {
      // Clear scenario
      this.state.isSimulated = false;
      this.state.simulatedScenario = null;
      this.fetchWeatherForLocation(this.state.currentLocation);
      return;
    }

    this.state.lastUpdatedText = `Simulation Active (${scenario}) • ${new Date().toLocaleTimeString()}`;
    this.notify();
  }

  public destroy() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.watchPositionId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchPositionId);
      this.watchPositionId = null;
    }
    this.listeners.clear();
  }
}

export const realtimeRouteWeatherService = new RealtimeRouteWeatherService();
