process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { createApiApp } from '../server.ts';
import { createFleetCore } from '../server/fleetCore.ts';
import { dotCompanyService } from '../src/services/dotCompanyService.ts';
import { insuranceConnectorService } from '../src/services/insuranceConnectorService.ts';
import {
  buildOfficialFmcsaLinks,
  MOCK_PRIMARY_CARRIER_DOT,
  MOCK_INSURANCE_CONNECTOR_COMPANIES,
} from '../src/data/mockInsuranceAndDotData.ts';

function setupTestServer() {
  const isolatedCore = createFleetCore();
  const app = createApiApp(isolatedCore);
  const server = http.createServer(app);

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve({
        server,
        baseUrl,
        isolatedCore,
        close: () => new Promise((res) => server.close(res)),
      });
    });
    server.on('error', reject);
  });
}

test('Insurance Connector & Company Discounts Engine Suite', async (t) => {
  await t.test('1. Partner Underwriters: Loads all 7 top commercial trucking insurance partners', () => {
    const companies = insuranceConnectorService.getCompanies();
    assert.strictEqual(companies.length, 7);

    const progressive = companies.find((c) => c.id === 'progressive-commercial');
    assert.ok(progressive, 'Progressive Commercial must be present');
    assert.strictEqual(progressive.underwritingTier, 'A+ SUPERIOR (A.M. BEST)');
    assert.ok(progressive.maxDiscountPercent >= 30, 'Progressive offers up to 32% discount');

    const sentry = companies.find((c) => c.id === 'sentry-insurance');
    assert.ok(sentry, 'Sentry Insurance must be present');

    const berkshire = companies.find((c) => c.id === 'berkshire-hathaway-homestate');
    assert.ok(berkshire, 'Berkshire Hathaway Homestate must be present');
    assert.strictEqual(berkshire.underwritingTier, 'A++ FINANCIAL SUPERIORITY');
  });

  await t.test('2. Company Discount Evaluation: Accurately calculates fleet savings based on clean DOT record & telematics', () => {
    const progressive = insuranceConnectorService.getCompanyById('progressive-commercial');
    assert.ok(progressive);

    const evaluation = insuranceConnectorService.evaluateDiscountsForCompany(
      progressive,
      MOCK_PRIMARY_CARRIER_DOT,
      5 // 5 power units
    );

    assert.ok(evaluation.qualifiedDiscounts.length >= 3, 'Must qualify for clean DOT, telematics, and radar');
    assert.ok(evaluation.aggregateDiscountPct > 0, 'Aggregate discount must be positive');
    assert.ok(evaluation.aggregateDiscountPct <= progressive.maxDiscountPercent, 'Cannot exceed underwriter max discount');

    assert.strictEqual(evaluation.baseAnnualTotal, 13800 * 5);
    assert.strictEqual(evaluation.totalAnnualSavings, Math.round((13800 * 5 * evaluation.aggregateDiscountPct) / 100));
    assert.strictEqual(evaluation.netAnnualTotal, evaluation.baseAnnualTotal - evaluation.totalAnnualSavings);
  });

  await t.test('3. ACORD 25 Certificate of Insurance (COI): Generates compliant document with Merkle seal', () => {
    const quote = insuranceConnectorService.generateQuote('progressive-commercial', 5);
    assert.ok(quote.quoteId.startsWith('QUOTE-PROG-'));
    assert.strictEqual(quote.fleetPowerUnits, 5);
    assert.ok(quote.merkleSealSha256.length === 64, 'Must have 64-char SHA-256 seal');

    const coi = insuranceConnectorService.generateCoiDocument(quote);
    assert.ok(coi.fileName.includes('CERTIFICATE_OF_INSURANCE_USDOT_3928110'));
    assert.ok(coi.content.includes('ACORD 25 (CERTIFICATE OF LIABILITY INSURANCE)'));
    assert.ok(coi.content.includes('$1,000,000 Combined Single Limit (CSL)'));
    assert.ok(coi.content.includes(quote.merkleSealSha256));
  });
});

test('DOT Carrier Records & FMCSA Official Links Suite', async (t) => {
  await t.test('1. Official Deep-Links: Generates valid FMCSA SAFER, SMS, L&I, Clearinghouse, and DataQs URLs', () => {
    const links = buildOfficialFmcsaLinks('3928110');
    assert.strictEqual(
      links.saferSnapshotUrl,
      'https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=3928110'
    );
    assert.strictEqual(
      links.smsScorecardUrl,
      'https://ai.fmcsa.dot.gov/SMS/Carrier/3928110/Overview.aspx'
    );
    assert.strictEqual(links.licensingInsuranceUrl, 'https://li-public.fmcsa.dot.gov/');
    assert.strictEqual(links.clearinghouseUrl, 'https://clearinghouse.fmcsa.dot.gov/');
    assert.strictEqual(links.dataQsUrl, 'https://dataqs.fmcsa.dot.gov/');
  });

  await t.test('2. Quick Pull DOT Record: Retrieves primary carrier safety profile and SMS BASIC scores', async () => {
    const carrier = await dotCompanyService.pullCarrierDotRecord('3928110');
    assert.strictEqual(carrier.usdot, '3928110');
    assert.strictEqual(carrier.legalName, 'Morrishive Logistics LLC');
    assert.strictEqual(carrier.safetyRating, 'SATISFACTORY');
    assert.strictEqual(carrier.powerUnits, 14);
    assert.strictEqual(carrier.drivers, 16);
    assert.strictEqual(carrier.insuranceOnFileBipd, 1000000);

    // Verify SMS BASICs
    assert.strictEqual(carrier.smsScores.length, 7);
    const unsafeDriving = carrier.smsScores.find((s) => s.category === 'UNSAFE_DRIVING');
    assert.ok(unsafeDriving);
    assert.strictEqual(unsafeDriving.percentile, 11);
    assert.strictEqual(unsafeDriving.status, 'EXCELLENT');

    const crashIndicator = carrier.smsScores.find((s) => s.category === 'CRASH_INDICATOR');
    assert.ok(crashIndicator);
    assert.strictEqual(crashIndicator.percentile, 0);
  });

  await t.test('3. Dynamic Pull for Custom USDOT: Accurately parses and generates structured profile', async () => {
    const custom = await dotCompanyService.pullCarrierDotRecord('USDOT #5591024');
    assert.strictEqual(custom.usdot, '5591024');
    assert.ok(custom.officialLinks.smsScorecardUrl.includes('5591024'));
    assert.strictEqual(custom.safetyRating, 'SATISFACTORY');
  });
});

test('Driver Roadside Inspection & Violations Tracker Suite', async (t) => {
  await t.test('1. Inspection Roster: Retrieves roadside inspection reports and driver citations', () => {
    const allReports = dotCompanyService.getInspectionReports();
    assert.ok(allReports.length >= 4, 'Must have baseline roadside inspection reports');

    const jeremiahReports = dotCompanyService.getInspectionReports('drv-jeremiah-904');
    assert.ok(jeremiahReports.length >= 2, 'Jeremiah must have inspection reports on record');

    const cleanReport = jeremiahReports.find((r) => r.cleanInspectionPass);
    assert.ok(cleanReport, 'Jeremiah must have Level I Clean Inspection Pass on record');
    assert.strictEqual(cleanReport.violations.length, 0);
  });

  await t.test('2. Add Roadside Inspection Report: Accurately saves report and computes points', () => {
    const initialCount = dotCompanyService.getInspectionReports().length;

    const newReport = dotCompanyService.addInspectionReport({
      reportNumber: 'TX-2026-TEST-9901',
      inspectionDate: '2026-10-30',
      state: 'TX',
      locationDescription: 'I-35 NB MM 280 Salado Weigh Station',
      level: 'LEVEL_II',
      driverId: 'drv-jeremiah-904',
      driverName: 'Jeremiah J. Morris',
      cdlNumber: 'IL-CDL-98104820',
      cdlState: 'IL',
      unitNumber: 'TRK-904',
      trailerNumber: 'TR-5390',
      inspectingAgency: 'Texas DPS Highway Patrol',
      officerBadge: 'Trooper #4412',
      outOfServiceOrder: false,
      cleanInspectionPass: false,
      violations: [
        {
          id: 'viol-test-01',
          violationCode: '393.9',
          cfrSection: '49 CFR § 393.9',
          description: 'Inoperative clearance lamp - right rear upper trailer marker LED',
          basicCategory: 'VEHICLE_MAINT',
          severityWeight: 2,
          timeWeight: 3,
          totalPoints: 6,
          outOfService: false,
          status: 'ACTIVE',
        },
      ],
      notes: 'Unit repaired on-site with spare bulb from emergency kit.',
    });

    assert.ok(newReport.id.startsWith('rpt-tx-'));
    assert.ok(newReport.tamperEvidentSha256.length === 64);
    assert.strictEqual(dotCompanyService.getInspectionReports().length, initialCount + 1);
  });

  await t.test('3. DataQs & Remediation Status Update: Updates violation status to CONTESTED_DATAQS or REMEDIATED', () => {
    const reports = dotCompanyService.getInspectionReports();
    const targetReport = reports.find((r) => r.violations.length > 0);
    assert.ok(targetReport);

    const targetViol = targetReport.violations[0];
    const success = dotCompanyService.updateViolationStatus(
      targetReport.id,
      targetViol.id,
      'CONTESTED_DATAQS',
      'Formal challenge submitted to FMCSA DataQs with proof of maintenance.'
    );

    assert.strictEqual(success, true);

    const updatedReports = dotCompanyService.getInspectionReports();
    const updatedReport = updatedReports.find((r) => r.id === targetReport.id);
    const updatedViol = updatedReport.violations.find((v) => v.id === targetViol.id);
    assert.strictEqual(updatedViol.status, 'CONTESTED_DATAQS');
    assert.ok(updatedViol.remediationNotes.includes('FMCSA DataQs'));
  });

  await t.test('4. Driver Risk Summary: Calculates driver safety score and tier qualification', () => {
    const summary = dotCompanyService.getDriverRiskSummary('drv-jeremiah-904');
    assert.ok(summary.totalInspections >= 2);
    assert.ok(summary.safetyScore >= 70, 'Score should reflect clean safety record');
    assert.ok(['TIER_1_ELITE', 'TIER_2_STANDARD'].includes(summary.tier));
    assert.strictEqual(summary.insuranceDiscountEligible, true);
  });

  await t.test('5. CSV Export: Generates RFC-4180 compliant CSV ledger', () => {
    const csv = dotCompanyService.exportViolationsCsv();
    assert.ok(csv.startsWith('Report Number,Inspection Date,State,Level'));
    assert.ok(csv.includes('TX-2026-088219'));
    assert.ok(csv.includes('Jeremiah J. Morris'));
  });
});

test('HTTP API Endpoints: Insurance & DOT Regulatory Suite', async (t) => {
  const env = await setupTestServer();

  t.after(async () => {
    await env.close();
  });

  await t.test('GET /api/dot/carrier/:usdot -> Returns company DOT records & SMS scores', async () => {
    const res = await fetch(`${env.baseUrl}/api/dot/carrier/3928110`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.carrier.usdot, '3928110');
    assert.strictEqual(data.carrier.safetyRating, 'SATISFACTORY');
    assert.ok(data.officialLinks.smsScorecardUrl.includes('3928110'));
  });

  await t.test('GET /api/dot/official-links/:usdot -> Returns official FMCSA portals', async () => {
    const res = await fetch(`${env.baseUrl}/api/dot/official-links/3928110`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.links.saferSnapshotUrl);
    assert.ok(data.links.smsScorecardUrl);
    assert.ok(data.links.dataQsUrl);
  });

  await t.test('GET /api/hre/dot-records -> Returns corridor DOT records for HRE', async () => {
    const res = await fetch(`${env.baseUrl}/api/hre/dot-records?usdot=3928110`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.carrier.usdot, '3928110');
  });

  await t.test('GET /api/driver-violations -> Returns roadside reports and citations', async () => {
    const res = await fetch(`${env.baseUrl}/api/driver-violations`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.reports));
    assert.ok(data.totalReports >= 4);
  });

  await t.test('POST /api/driver-violations -> Creates new roadside inspection report', async () => {
    const res = await fetch(`${env.baseUrl}/api/driver-violations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportNumber: 'OH-2026-HTTP-8812',
        state: 'OH',
        driverName: 'Jeremiah J. Morris',
        driverId: 'drv-jeremiah-904',
        level: 'LEVEL_II',
        cleanInspectionPass: true,
        violations: [],
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.report.reportNumber, 'OH-2026-HTTP-8812');
  });

  await t.test('GET /api/insurance/companies -> Lists commercial underwriter partners', async () => {
    const res = await fetch(`${env.baseUrl}/api/insurance/companies`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.companies.length, 7);
  });

  await t.test('POST /api/insurance/calculate-discounts -> Computes carrier fleet discounts', async () => {
    const res = await fetch(`${env.baseUrl}/api/insurance/calculate-discounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usdot: '3928110',
        companyId: 'progressive-commercial',
        powerUnits: 5,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.quote.aggregateDiscountPct >= 20);
    assert.ok(data.quote.totalAnnualSavings > 10000);
  });

  await t.test('POST /api/insurance/bind-policy -> Binds policy and returns policy number', async () => {
    const res = await fetch(`${env.baseUrl}/api/insurance/bind-policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteId: 'QUOTE-PROG-TEST-1',
        carrierUsdot: '3928110',
        companyId: 'progressive-commercial',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.status, 'BOUND_ACTIVE');
    assert.ok(data.policyNumber.startsWith('TWE-POL-3928110'));
    assert.ok(data.merkleSealSha256.length === 64);
  });
});
