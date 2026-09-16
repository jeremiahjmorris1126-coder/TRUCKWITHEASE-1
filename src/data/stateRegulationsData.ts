export interface StateDotRegulation {
  stateCode: string;
  stateName: string;
  flagEmoji: string;
  truckSpeedLimitMph: number;
  carSpeedLimitMph: number;
  speedLimitNotes: string;
  laneRestrictions: string;
  weighStationPolicy: string;
  specialDotMandates: string[];
  chainLawPolicy: string;
  apuWeightAllowanceLbs: number;
  dotHelpLine: string;
}

export const US_STATE_DOT_REGULATIONS: Record<string, StateDotRegulation> = {
  TX: {
    stateCode: 'TX',
    stateName: 'Texas',
    flagEmoji: '🏴‍☠️',
    truckSpeedLimitMph: 75,
    carSpeedLimitMph: 75,
    speedLimitNotes: '75 MPH Daytime (80 MPH on designated I-10 / I-20 segments in West TX). 75 MPH Nighttime.',
    laneRestrictions: 'Left lane restriction for 3+ lane highways where posted by TxDOT.',
    weighStationPolicy: 'Drivewyze & PrePass active at all TX Inspection Stations (Kermit, Seguin, Mount Pleasant).',
    specialDotMandates: [
      'TxDMV Oversize/Overweight permit required above 80,000 lbs GVW.',
      'Mandatory emergency reflector placement within 10 minutes of roadside shoulder stop.',
      'No Jake Brake usage within posted city limits.',
    ],
    chainLawPolicy: 'Rarely enforced; emergency weather advisories posted on TxDOT VMS boards.',
    apuWeightAllowanceLbs: 400,
    dotHelpLine: '1-800-558-9368 (TxDMV Motor Carrier)',
  },
  IL: {
    stateCode: 'IL',
    stateName: 'Illinois',
    flagEmoji: '🌽',
    truckSpeedLimitMph: 65,
    carSpeedLimitMph: 70,
    speedLimitNotes: '65 MPH max for vehicles > 8,000 lbs (70 MPH cars). 55 MPH in Cook County urban interstates & tollway construction zones.',
    laneRestrictions: 'Trucks prohibited in far-left lane on interstates with 3 or more lanes in one direction (IDOT § 11-707).',
    weighStationPolicy: 'Mandatory pull-in for all commercial vehicles over 16,000 lbs GVWR at open IDOT Weigh Stations.',
    specialDotMandates: [
      'I-Pass / E-ZPass transponder mandatory on Illinois Tollway network.',
      'Strict 15-minute engine idling limit in Chicago non-attainment area (§ 11-1429).',
      'Mandatory safety inspection sticker required for IL-domiciled power units.',
    ],
    chainLawPolicy: 'No studded tires allowed from April 1 to November 15.',
    apuWeightAllowanceLbs: 400,
    dotHelpLine: '1-217-782-7820 (IDOT Commercial Vehicles)',
  },
  IN: {
    stateCode: 'IN',
    stateName: 'Indiana',
    flagEmoji: '🏎️',
    truckSpeedLimitMph: 65,
    carSpeedLimitMph: 70,
    speedLimitNotes: '65 MPH for trucks on rural interstates (70 MPH cars). 55 MPH on urban interstates.',
    laneRestrictions: 'Trucks must stay in right two lanes on 3+ lane interstates.',
    weighStationPolicy: 'INDOT weigh scales active on I-65, I-70, I-80/94 (Chesterton, Lowell, Richmond). PrePass enabled.',
    specialDotMandates: [
      'Cold-weather diesel APU 400 lb weight allowance applied on certified scales.',
      'I-80/94 Borman Expressway heavy traffic lane compliance enforced by ISP.',
      'Triple trailer combinations allowed on Indiana Toll Road with permit.',
    ],
    chainLawPolicy: 'Chains permitted November 1 through April 1.',
    apuWeightAllowanceLbs: 400,
    dotHelpLine: '1-317-615-7200 (INDOT Motor Carrier Services)',
  },
  OH: {
    stateCode: 'OH',
    stateName: 'Ohio',
    flagEmoji: '🌰',
    truckSpeedLimitMph: 70,
    carSpeedLimitMph: 70,
    speedLimitNotes: '70 MPH truck speed limit on rural interstate highways & Ohio Turnpike.',
    laneRestrictions: 'Left lane restriction for trucks on 3+ lane interstates (ORC § 4511.27).',
    weighStationPolicy: 'ODOT Weigh Stations active on I-70, I-75, I-80. Drivewyze bypass active.',
    specialDotMandates: [
      'Ohio Turnpike E-ZPass tolling integration mandatory for electronic discounts.',
      'ODOT mandatory winter tire traction advisory when snow emergency declared.',
      'Strict hazardous material routing around Cleveland & Cincinnati downtown loops.',
    ],
    chainLawPolicy: 'Studded tires permitted November 1 to April 15.',
    apuWeightAllowanceLbs: 500,
    dotHelpLine: '1-614-466-3682 (ODOT Motor Carrier Inspection)',
  },
  LA: {
    stateCode: 'LA',
    stateName: 'Louisiana',
    flagEmoji: '⚜️',
    truckSpeedLimitMph: 70,
    carSpeedLimitMph: 70,
    speedLimitNotes: '70 MPH interstate max (60 MPH strict limit on Atchafalaya Basin Bridge on I-10).',
    laneRestrictions: 'TRUCKS RIGHT LANE ONLY on Atchafalaya Basin Bridge (18-mile bridge segment on I-10 between Baton Rouge and Lafayette).',
    weighStationPolicy: 'LSP Troop weigh stations active at Toomey (I-10 WB), Slidell (I-10 EB), and Greenwood (I-20 EB).',
    specialDotMandates: [
      'Atchafalaya Basin Bridge double fine zone for truck speeding & lane violations.',
      'Chemical & petroleum transport placard verification at state entry ports.',
    ],
    chainLawPolicy: 'Chains required during rare freezing rain advisories on elevated causeways.',
    apuWeightAllowanceLbs: 400,
    dotHelpLine: '1-225-925-6113 (Louisiana State Police Motor Carrier)',
  },
  MO: {
    stateCode: 'MO',
    stateName: 'Missouri',
    flagEmoji: '🏛️',
    truckSpeedLimitMph: 70,
    carSpeedLimitMph: 70,
    speedLimitNotes: '70 MPH on rural interstates (60 MPH urban loops in St. Louis & Kansas City).',
    laneRestrictions: 'No left lane operation on 3+ lane interstates in St. Louis and Kansas City metro areas.',
    weighStationPolicy: 'MoDOT weigh stations active on I-44, I-70, I-55, I-35. PrePass & Drivewyze supported.',
    specialDotMandates: [
      'Commercial vehicle safety inspection certificate required.',
      'Strict 55 MPH construction zone speed enforcement with doubled fines.',
    ],
    chainLawPolicy: 'Chains permitted during severe winter ice advisories.',
    apuWeightAllowanceLbs: 500,
    dotHelpLine: '1-866-831-6277 (MoDOT Motor Carrier Services)',
  },
  PA: {
    stateCode: 'PA',
    stateName: 'Pennsylvania',
    flagEmoji: '🔔',
    truckSpeedLimitMph: 65,
    carSpeedLimitMph: 70,
    speedLimitNotes: '65 MPH max on PA Turnpike and rural interstates. 55 MPH on urban highways & steep mountain grades.',
    laneRestrictions: 'Left lane restriction for commercial trucks on all highways with 3 or more lanes.',
    weighStationPolicy: 'PennDOT weigh scales active on I-78, I-80, I-81, PA Turnpike. Mandatory pull-in when open.',
    specialDotMandates: [
      'MANDATORY BRAKE CHECK PULL-OFFS at top of steep mountain grades (12% grade advisories on I-80 & PA Turnpike).',
      'PA Turnpike E-ZPass tolling integration.',
      'Strict hazmat tunnel restrictions in Pittsburgh (Fort Pitt & Liberty Tunnels).',
    ],
    chainLawPolicy: 'Mandatory snow chain law enforced on PA Turnpike during Tier 2-4 winter emergencies.',
    apuWeightAllowanceLbs: 400,
    dotHelpLine: '1-800-932-4600 (PennDOT Commercial Operations)',
  },
  CA: {
    stateCode: 'CA',
    stateName: 'California',
    flagEmoji: '🐻',
    truckSpeedLimitMph: 55,
    carSpeedLimitMph: 70,
    speedLimitNotes: 'STRICT 55 MPH MAX TRUCK SPEED LIMIT STATEWIDE for all vehicles towing trailers (CVC § 22406).',
    laneRestrictions: 'RIGHT TWO LANES ONLY on 4+ lane highways. Right lane only on 2-lane highways.',
    weighStationPolicy: 'CHP Inspection Facilities mandatory pull-in for ALL trucks (Banning, Tejon Pass, Grapevine, Castaic).',
    specialDotMandates: [
      'CARB (California Air Resources Board) Clean Truck Check compliance certificate required.',
      'Strict 5-minute engine idle limit (CVC § 22515).',
      'Mandatory tire chain installation at Donner Pass (I-80) during winter alerts.',
    ],
    chainLawPolicy: 'Mandatory chain controls (R1, R2, R3) on Sierra Nevada mountain passes.',
    apuWeightAllowanceLbs: 400,
    dotHelpLine: '1-916-843-3400 (CHP Commercial Vehicle Section)',
  },
  GA: {
    stateCode: 'GA',
    stateName: 'Georgia',
    flagEmoji: '🍑',
    truckSpeedLimitMph: 70,
    carSpeedLimitMph: 70,
    speedLimitNotes: '70 MPH rural interstates (65 MPH urban interstates like I-285 Atlanta Perimeter).',
    laneRestrictions: 'Trucks prohibited in left two lanes on interstates with 3+ lanes in Atlanta metro area.',
    weighStationPolicy: 'DPS Weigh Stations active on I-75, I-85, I-95, I-20. PrePass bypass enabled.',
    specialDotMandates: [
      'Peach Pass / E-ZPass tolling transponder allowed on I-85 Express Lanes.',
      'No hazmat transport inside I-285 Atlanta Perimeter loop without permit.',
    ],
    chainLawPolicy: 'Chains required only during severe winter ice alerts.',
    apuWeightAllowanceLbs: 400,
    dotHelpLine: '1-404-624-7211 (Georgia DPS Motor Carrier Compliance)',
  },
};
