export interface HazardConditionTelemetry {
  visibility: string;
  windSpeed: string;
  windGust: string;
  temperature: string;
  roadCondition: string;
}

export interface RegionalWeatherHazardItem {
  id: string;
  type: 'FOG' | 'ICE' | 'HIGH_WIND' | 'SEVERE_STORM' | 'NORMAL';
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY' | 'NORMAL';
  title: string;
  headline: string;
  conditions: HazardConditionTelemetry;
  truckingSafetyDirectives: string[];
  recommendedSpeedMph: number;
  minFollowingDistanceSec: number;
  validUntil: string;
  affectedCorridor: string;
}

export interface GroundingCitation {
  title: string;
  uri: string;
}

export interface SearchGroundingInfo {
  grounded: boolean;
  searchQueries: string[];
  citations: GroundingCitation[];
}

export interface GeographicCorridorTarget {
  id: string;
  name: string;
  corridor: string;
  lat: number;
  lon: number;
  isCurrentGps?: boolean;
}

export interface RegionalWeatherHazardFeedState {
  currentTarget: GeographicCorridorTarget;
  availableTargets: GeographicCorridorTarget[];
  overallRisk: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  summary: string;
  hazards: RegionalWeatherHazardItem[];
  searchGrounding: SearchGroundingInfo;
  source: 'GEMINI_SEARCH_GROUNDED' | 'METEOROLOGICAL_TELEMETRY';
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
  dismissedHazardIds: string[];
}

export const PRESET_GEOGRAPHIC_CORRIDORS: GeographicCorridorTarget[] = [
  {
    id: 'corridor-rolla',
    name: 'Rolla / St. James, MO',
    corridor: 'I-44 Eastbound (MM 184.2)',
    lat: 37.95,
    lon: -91.77,
    isCurrentGps: true,
  },
  {
    id: 'corridor-joplin',
    name: 'Joplin Scale & State Line, MO',
    corridor: 'I-44 Westbound (MM 18.0)',
    lat: 37.08,
    lon: -94.51,
  },
  {
    id: 'corridor-stlouis',
    name: 'St. Louis River Bridge Approach, MO',
    corridor: 'I-44 / I-55 Metro Interchange (MM 275)',
    lat: 38.62,
    lon: -90.20,
  },
  {
    id: 'corridor-elkmountain',
    name: 'Elk Mountain / Arlington, WY',
    corridor: 'I-80 Extreme Wind Corridor (MP 262)',
    lat: 41.68,
    lon: -106.41,
  },
  {
    id: 'corridor-flagstaff',
    name: 'Flagstaff / San Francisco Peaks, AZ',
    corridor: 'I-40 Mountain Summit (MM 195)',
    lat: 35.19,
    lon: -111.65,
  },
  {
    id: 'corridor-mobilebay',
    name: 'Mobile Bay Jubilee Viaduct, AL',
    corridor: 'I-10 Maritime Bayway (MM 29)',
    lat: 30.68,
    lon: -87.95,
  },
];

type StateListener = (state: RegionalWeatherHazardFeedState) => void;

class RegionalWeatherHazardService {
  private state: RegionalWeatherHazardFeedState = {
    currentTarget: PRESET_GEOGRAPHIC_CORRIDORS[0],
    availableTargets: PRESET_GEOGRAPHIC_CORRIDORS,
    overallRisk: 'HIGH',
    summary: 'Regional NWS dense fog advisory & crosswind shear along I-44 corridor.',
    hazards: [
      {
        id: 'init-fog-1',
        type: 'FOG',
        severity: 'CRITICAL',
        title: 'Dense Fog Advisory (Visibility < 1/4 Mile)',
        headline: 'Radiation fog trapped in river valleys along I-44 between Waynesville and St. James.',
        conditions: {
          visibility: '0.15 Miles',
          windSpeed: '4 MPH',
          windGust: '8 MPH',
          temperature: '38°F',
          roadCondition: 'Moist Surface Glaze / Reduced Traction',
        },
        truckingSafetyDirectives: [
          'NO HIGH BEAMS: Use low beams & amber fog lights only.',
          'Reduce speed to 45 MPH to guarantee stopping distance within line of sight.',
          'Double following distance to 8 seconds.',
        ],
        recommendedSpeedMph: 45,
        minFollowingDistanceSec: 8,
        validUntil: 'Today 10:30 AM CDT',
        affectedCorridor: 'I-44 Gasconade River Basin (MM 145 - 195)',
      },
      {
        id: 'init-wind-2',
        type: 'HIGH_WIND',
        severity: 'WARNING',
        title: 'Elevated Crosswind Shear on High Bridges',
        headline: 'Gusty southerly winds channeling through valley cuts reaching 38 MPH across Gasconade & Meramec river viaducts.',
        conditions: {
          visibility: '1.5 Miles',
          windSpeed: '22 MPH',
          windGust: '38 MPH',
          temperature: '41°F',
          roadCondition: 'Moist / Gusting Crosswind',
        },
        truckingSafetyDirectives: [
          'Maintain firm dual-handed grip on bridge spans.',
          'Empty dry vans reduce speed to 50 MPH.',
        ],
        recommendedSpeedMph: 50,
        minFollowingDistanceSec: 6,
        validUntil: 'Today 2:00 PM CDT',
        affectedCorridor: 'I-44 Elevated River Viaducts MM 168 - 188',
      },
      {
        id: 'init-ice-3',
        type: 'ICE',
        severity: 'ADVISORY',
        title: 'Sub-Freezing Bridge Deck Temperature Watch',
        headline: 'Pavement sensors on shaded overpass bridges indicating surface chill near 32°F.',
        conditions: {
          visibility: '1.5 Miles',
          windSpeed: '22 MPH',
          windGust: '38 MPH',
          temperature: '34°F',
          roadCondition: 'Potential Black Ice on Shaded Bridges',
        },
        truckingSafetyDirectives: [
          'Bridges freeze before roadway: treat all overpasses with caution.',
          'Disengage Jake brake on bridge approaches to avoid trailer jackknife.',
        ],
        recommendedSpeedMph: 55,
        minFollowingDistanceSec: 6,
        validUntil: 'Morning 9:30 AM CDT',
        affectedCorridor: 'I-44 Shaded Overpasses MM 170 - 200',
      },
    ],
    searchGrounding: {
      grounded: true,
      searchQueries: [
        'NWS Springfield MO dense fog advisory I-44 Rolla',
        'Missouri DOT Traveler Information road conditions I-44',
      ],
      citations: [
        { title: 'National Weather Service Springfield MO - Hazard Assessment', uri: 'https://www.weather.gov/sgf' },
        { title: 'Missouri DOT Traveler Information Map', uri: 'https://traveler.modot.org' },
        { title: 'NOAA Storm Prediction Center Hazards', uri: 'https://www.spc.noaa.gov' },
      ],
    },
    source: 'GEMINI_SEARCH_GROUNDED',
    isLoading: false,
    lastUpdated: new Date(),
    error: null,
    dismissedHazardIds: [],
  };

  private listeners: Set<StateListener> = new Set();
  private autoPollTimer: any = null;

  constructor() {
    // Initial fetch from backend API
    this.refreshHazards();

    // Auto-poll every 5 minutes in background
    if (typeof window !== 'undefined') {
      this.autoPollTimer = setInterval(() => {
        this.refreshHazards(false);
      }, 5 * 60 * 1000);
    }
  }

  public getState(): RegionalWeatherHazardFeedState {
    return { ...this.state };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((l) => l(currentState));
  }

  public async setGeographicLocation(target: GeographicCorridorTarget) {
    this.state.currentTarget = target;
    this.notify();
    await this.refreshHazards(true);
  }

  public async refreshHazards(showLoading = true): Promise<void> {
    if (showLoading) {
      this.state.isLoading = true;
      this.state.error = null;
      this.notify();
    }

    const { currentTarget } = this.state;

    try {
      const response = await fetch('/api/weather/regional-hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: currentTarget.name,
          corridor: currentTarget.corridor,
          lat: currentTarget.lat,
          lon: currentTarget.lon,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data && Array.isArray(data.hazards)) {
        this.state.hazards = data.hazards;
        this.state.overallRisk = data.overallRisk || 'MODERATE';
        this.state.summary = data.summary || 'Live grounded weather hazards retrieved.';
        this.state.source = data.source || 'GEMINI_SEARCH_GROUNDED';
        if (data.searchGrounding) {
          this.state.searchGrounding = data.searchGrounding;
        }
        this.state.lastUpdated = new Date();
        this.state.error = null;
      }
    } catch (err) {
      console.warn('[RegionalWeatherHazardService] Fetch error:', err);
      this.state.error = (err as Error).message || 'Failed to refresh hazards';
    } finally {
      this.state.isLoading = false;
      this.notify();
    }
  }

  public dismissHazard(id: string) {
    if (!this.state.dismissedHazardIds.includes(id)) {
      this.state.dismissedHazardIds = [...this.state.dismissedHazardIds, id];
      this.notify();
    }
  }

  public restoreDismissedHazards() {
    this.state.dismissedHazardIds = [];
    this.notify();
  }
}

export const regionalWeatherHazardService = new RegionalWeatherHazardService();
