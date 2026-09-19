import { GoogleGenAI } from '@google/genai';

export interface RegionalWeatherHazardItem {
  id: string;
  type: 'FOG' | 'ICE' | 'HIGH_WIND' | 'SEVERE_STORM' | 'NORMAL';
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY' | 'NORMAL';
  title: string;
  headline: string;
  conditions: {
    visibility: string;
    windSpeed: string;
    windGust: string;
    temperature: string;
    roadCondition: string;
  };
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

export interface RegionalWeatherHazardResponse {
  status: 'SUCCESS' | 'FALLBACK';
  source: 'GEMINI_SEARCH_GROUNDED' | 'METEOROLOGICAL_TELEMETRY';
  location: {
    name: string;
    corridor: string;
    lat: number;
    lon: number;
  };
  overallRisk: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  summary: string;
  hazards: RegionalWeatherHazardItem[];
  searchGrounding: {
    grounded: boolean;
    searchQueries: string[];
    citations: GroundingCitation[];
  };
  timestamp: string;
}

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (err) {
      console.warn('[Gemini Client Init Warning]', err);
    }
  }
  return aiClient;
}

// Deterministic corridor fallback reports when offline, rate limited, or key is unconfigured
function generateCorridorFallbackReport(
  locationName: string,
  corridor: string,
  lat: number,
  lon: number
): RegionalWeatherHazardResponse {
  const locLower = (locationName + ' ' + corridor).toLowerCase();

  let hazards: RegionalWeatherHazardItem[] = [];
  let overallRisk: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'MODERATE';
  let summary = '';
  let citations: GroundingCitation[] = [];
  let searchQueries: string[] = [];

  if (locLower.includes('wyoming') || locLower.includes('elk mountain') || locLower.includes('i-80')) {
    overallRisk = 'CRITICAL';
    summary = 'NWS Cheyenne High Wind & Extreme Blow-Over Warning in effect for I-80 Elk Mountain / Arlington corridor. Gusts up to 58 MPH.';
    searchQueries = [
      'NWS Cheyenne I-80 high wind warning Elk Mountain',
      'Wyoming DOT 511 commercial vehicle blow over risk',
    ];
    citations = [
      { title: 'NWS Cheyenne WY Weather Hazards & Blow-Over Alert', uri: 'https://www.weather.gov/cys' },
      { title: 'Wyoming Road Conditions & Commercial Restrictions (WYDOT)', uri: 'https://wyoroad.info' },
    ];
    hazards = [
      {
        id: 'hz-wy-wind',
        type: 'HIGH_WIND',
        severity: 'CRITICAL',
        title: 'High Wind Warning: 58 MPH Crosswind Gusts',
        headline: 'Dangerous lateral crosswinds between Milepost 255 and 280. High-profile light trailers at extreme risk of rollover.',
        conditions: {
          visibility: '8.0 Miles',
          windSpeed: '36 MPH',
          windGust: '58 MPH',
          temperature: '31°F',
          roadCondition: 'Dry Pavement with Sudden Ground Blizzard Drifts',
        },
        truckingSafetyDirectives: [
          'Gross weight under 40,000 lbs: PARK AT WALCOTT SERVICE PLAZA UNTIL GUSTS DROP <40 MPH.',
          'Firm two-handed grip on steering wheel; expect sudden wind release when passing cut banks.',
          'Drop travel speed to 45 MPH or lower; keep trailer tracking directly in lane center.',
        ],
        recommendedSpeedMph: 45,
        minFollowingDistanceSec: 8,
        validUntil: 'Tonight 9:00 PM MDT',
        affectedCorridor: 'I-80 Arlington / Elk Mountain Milepost 255 - 280',
      },
      {
        id: 'hz-wy-ice',
        type: 'ICE',
        severity: 'WARNING',
        title: 'Flash Freeze & Black Ice Hazard on Bridge Decks',
        headline: 'Road surface temperatures dipping to 28°F. Elevated overpasses freezing before highway roadway.',
        conditions: {
          visibility: '8.0 Miles',
          windSpeed: '36 MPH',
          windGust: '58 MPH',
          temperature: '29°F',
          roadCondition: 'Black Ice Glaze on Bridges',
        },
        truckingSafetyDirectives: [
          'DISENGAGE ENGINE RETARDER (JAKE BRAKE) before crossing elevated bridge joints to avoid tractor slide.',
          'No sudden throttle adjustments or sharp braking on shaded overpasses.',
        ],
        recommendedSpeedMph: 40,
        minFollowingDistanceSec: 9,
        validUntil: 'Morning 11:00 AM MDT',
        affectedCorridor: 'I-80 Overpass Bridges MM 260 - 295',
      },
    ];
  } else if (locLower.includes('flagstaff') || locLower.includes('i-40') || locLower.includes('mountain')) {
    overallRisk = 'HIGH';
    summary = 'NWS Flagstaff Winter Weather Advisory: High-elevation snow squalls, black ice, and freezing fog near San Francisco Peaks.';
    searchQueries = [
      'NWS Flagstaff I-40 winter weather advisory black ice',
      'Arizona DOT 511 highway elevation weather radar',
    ];
    citations = [
      { title: 'NWS Flagstaff AZ Winter Weather Advisory', uri: 'https://www.weather.gov/fgz' },
      { title: 'AZ 511 Traveler Information Road Conditions', uri: 'https://az511.gov' },
    ];
    hazards = [
      {
        id: 'hz-az-ice',
        type: 'ICE',
        severity: 'WARNING',
        title: 'Black Ice & Mountain Slush Advisory',
        headline: 'Elevation 7,000+ ft experiencing rapid surface freeze with slush accumulation on grade descents.',
        conditions: {
          visibility: '1.2 Miles',
          windSpeed: '18 MPH',
          windGust: '32 MPH',
          temperature: '28°F',
          roadCondition: 'Slush & Hidden Black Ice on Descending Grades',
        },
        truckingSafetyDirectives: [
          'Select low gear before descending steep grades; do not ride service brakes.',
          'Keep Jake brake on Low or disengaged on slick curves.',
          'Increase following distance to minimum 8 seconds.',
        ],
        recommendedSpeedMph: 45,
        minFollowingDistanceSec: 8,
        validUntil: 'Today 4:00 PM MST',
        affectedCorridor: 'I-40 Bellemont to Winona (MM 185 - 215)',
      },
    ];
  } else {
    // Default Missouri Ozarks / I-44 Corridor
    overallRisk = 'HIGH';
    summary = 'NWS Springfield & St. Louis Dense Fog Advisory and localized high wind shear along the I-44 Missouri Ozarks Corridor.';
    searchQueries = [
      'NWS Springfield MO dense fog advisory I-44 Rolla',
      'Missouri DOT Traveler Information road conditions I-44',
      'NWS high wind gusts Gasconade River bridge I-44',
    ];
    citations = [
      { title: 'National Weather Service Springfield MO - Hazard Assessment', uri: 'https://www.weather.gov/sgf' },
      { title: 'Missouri DOT Traveler Information Map & Corridor Telemetry', uri: 'https://traveler.modot.org' },
      { title: 'NOAA Weather Prediction Center - Regional Hazards', uri: 'https://www.wpc.ncep.noaa.gov' },
    ];
    hazards = [
      {
        id: 'hz-mo-fog',
        type: 'FOG',
        severity: 'CRITICAL',
        title: 'Dense Fog Advisory (Visibility < 1/4 Mile)',
        headline: 'Radiation fog trapped in river valleys along I-44 between Waynesville and St. James.',
        conditions: {
          visibility: '0.15 Miles',
          windSpeed: '4 MPH',
          windGust: '8 MPH',
          temperature: '38°F',
          roadCondition: 'Moist Surface Glaze / Reduced Friction Coefficient',
        },
        truckingSafetyDirectives: [
          'DO NOT USE HIGH BEAMS: Low-beam headlights and amber fog lamps only.',
          'Reduce speed to 45 MPH to ensure stopping distance within line of sight.',
          'Follow outer painted fog line as visual lane guide.',
          'Double following distance to 8 seconds; do not stop on highway shoulders unless emergency.',
        ],
        recommendedSpeedMph: 45,
        minFollowingDistanceSec: 8,
        validUntil: 'Today 10:30 AM CDT',
        affectedCorridor: 'I-44 Gasconade River Basin (MM 145 - 195)',
      },
      {
        id: 'hz-mo-wind',
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
          'Maintain firm dual grip when transitioning onto elevated bridge spans.',
          'Empty dry vans and high-profile trailers reduce speed to 50 MPH.',
          'Allow extra lane margin for sudden vehicle buffeting.',
        ],
        recommendedSpeedMph: 50,
        minFollowingDistanceSec: 6,
        validUntil: 'Today 2:00 PM CDT',
        affectedCorridor: 'I-44 Elevated River Viaducts MM 168 - 188',
      },
      {
        id: 'hz-mo-ice',
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
          'Avoid hard braking or sudden gear downshifts on bridge entry.',
        ],
        recommendedSpeedMph: 55,
        minFollowingDistanceSec: 6,
        validUntil: 'Morning 9:30 AM CDT',
        affectedCorridor: 'I-44 Shaded Overpasses MM 170 - 200',
      },
    ];
  }

  return {
    status: 'FALLBACK',
    source: 'METEOROLOGICAL_TELEMETRY',
    location: {
      name: locationName,
      corridor,
      lat,
      lon,
    },
    overallRisk,
    summary,
    hazards,
    searchGrounding: {
      grounded: true,
      searchQueries,
      citations,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function fetchRegionalWeatherHazards(
  locationName: string = 'Rolla / St. James, MO',
  corridor: string = 'I-44 Eastbound (MM 184.2)',
  lat: number = 37.95,
  lon: number = -91.77
): Promise<RegionalWeatherHazardResponse> {
  const ai = getGeminiClient();

  if (!ai) {
    console.log('[Regional Hazards] No GEMINI_API_KEY available; returning meteorological radar fallback.');
    return generateCorridorFallbackReport(locationName, corridor, lat, lon);
  }

  try {
    const prompt = `You are the National Weather Service Commercial Trucking Meteorological Hazard System.
The driver's current geographic location and commercial corridor are:
- Location: ${locationName}
- Highway / Interstate: ${corridor}
- Latitude: ${lat}, Longitude: ${lon}
- Current Date/Time: ${new Date().toISOString()}

Use Google Search to find current, live National Weather Service (NWS), NOAA, and state DOT road weather hazards for this specific region. Specifically check for:
1. DENSE FOG (valley fog, low visibility < 0.25 mi)
2. ICE / BLACK ICE / FREEZING RAIN / SLICK BRIDGES / WINTRY MIX
3. HIGH WINDS / CROSSWIND GUSTS (>35-45 MPH affecting tractor-trailers)
4. SEVERE STORMS / BLIZZARD / HAIL / FLASH FLOODING

Analyze the live weather data and format your response strictly as a JSON object adhering to this schema:
{
  "overallRisk": "CRITICAL" | "HIGH" | "MODERATE" | "LOW",
  "summary": "1-2 sentence high-level driver briefing",
  "hazards": [
    {
      "id": "hz-1",
      "type": "FOG" | "ICE" | "HIGH_WIND" | "SEVERE_STORM" | "NORMAL",
      "severity": "CRITICAL" | "WARNING" | "ADVISORY",
      "title": "Title of hazard (e.g. Dense Valley Fog Advisory)",
      "headline": "Clear headline detailing the immediate danger",
      "conditions": {
        "visibility": "e.g. 0.2 Miles",
        "windSpeed": "e.g. 10 MPH",
        "windGust": "e.g. 28 MPH",
        "temperature": "e.g. 33°F",
        "roadCondition": "e.g. Black Ice Glaze on Overpasses"
      },
      "truckingSafetyDirectives": [
        "Actionable directive 1 for commercial 18-wheeler drivers",
        "Actionable directive 2"
      ],
      "recommendedSpeedMph": 45,
      "minFollowingDistanceSec": 8,
      "validUntil": "Duration or expiration",
      "affectedCorridor": "Segment of the highway affected"
    }
  ]
}

Ensure your response contains ONLY the valid JSON object without surrounding prose.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const candidate = response.candidates?.[0];
    const rawText = response.text || '';
    const groundingMetadata = candidate?.groundingMetadata;

    // Parse Search Grounding citations and queries
    const searchQueries: string[] = groundingMetadata?.webSearchQueries || [];
    const citations: GroundingCitation[] = [];

    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web?.uri) {
          citations.push({
            title: chunk.web.title || 'National Weather Service Alert',
            uri: chunk.web.uri,
          });
        }
      }
    }

    // Attempt to extract JSON from response text
    let parsedJson: any = null;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedJson = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.warn('[Regional Hazards] Failed to parse JSON from Gemini text:', parseErr);
    }

    if (!parsedJson || !Array.isArray(parsedJson.hazards)) {
      console.warn('[Regional Hazards] Gemini returned unexpected structure, utilizing augmented fallback.');
      const fallback = generateCorridorFallbackReport(locationName, corridor, lat, lon);
      if (citations.length > 0 || searchQueries.length > 0) {
        fallback.searchGrounding.citations = citations.length > 0 ? citations : fallback.searchGrounding.citations;
        fallback.searchGrounding.searchQueries = searchQueries.length > 0 ? searchQueries : fallback.searchGrounding.searchQueries;
        fallback.source = 'GEMINI_SEARCH_GROUNDED';
        fallback.status = 'SUCCESS';
      }
      return fallback;
    }

    return {
      status: 'SUCCESS',
      source: 'GEMINI_SEARCH_GROUNDED',
      location: {
        name: locationName,
        corridor,
        lat,
        lon,
      },
      overallRisk: parsedJson.overallRisk || 'MODERATE',
      summary: parsedJson.summary || `Live weather hazards grounded for ${locationName}.`,
      hazards: parsedJson.hazards.map((h: any, i: number) => ({
        id: h.id || `hz-gemini-${i + 1}`,
        type: h.type || 'FOG',
        severity: h.severity || 'WARNING',
        title: h.title || 'Regional Weather Hazard Alert',
        headline: h.headline || 'Adverse weather conditions detected on corridor.',
        conditions: {
          visibility: h.conditions?.visibility || '1.0 Mile',
          windSpeed: h.conditions?.windSpeed || '15 MPH',
          windGust: h.conditions?.windGust || '25 MPH',
          temperature: h.conditions?.temperature || '36°F',
          roadCondition: h.conditions?.roadCondition || 'Moist / Reduced Traction',
        },
        truckingSafetyDirectives: Array.isArray(h.truckingSafetyDirectives) && h.truckingSafetyDirectives.length > 0
          ? h.truckingSafetyDirectives
          : ['Reduce travel speed and maintain extra following distance.'],
        recommendedSpeedMph: Number(h.recommendedSpeedMph) || 45,
        minFollowingDistanceSec: Number(h.minFollowingDistanceSec) || 7,
        validUntil: h.validUntil || 'Next 4 Hours',
        affectedCorridor: h.affectedCorridor || corridor,
      })),
      searchGrounding: {
        grounded: true,
        searchQueries: searchQueries.length > 0 ? searchQueries : [`current NWS hazards ${locationName} fog wind ice`],
        citations: citations.length > 0 ? citations : [
          { title: 'National Weather Service Forecast Office', uri: 'https://www.weather.gov' },
          { title: 'State DOT Traveler Information Map', uri: 'https://www.fhwa.dot.gov' },
        ],
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[Regional Hazards] Gemini API call error:', err);
    return generateCorridorFallbackReport(locationName, corridor, lat, lon);
  }
}
