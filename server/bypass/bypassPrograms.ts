import { resolveHttpsUrl } from '../config/externalLinks';

/**
 * Weigh station bypass programs.
 *
 * TruckWithEase never tells a driver they may bypass a scale. Only an enrolled
 * program's own transponder or app can give that signal, based on the carrier's
 * safety record and credentials. This module only provides enrollment links.
 *
 * Links are configurable (https only) so partner/referral URLs can be swapped in:
 *   PREPASS_ENROLL_URL, DRIVEWYZE_ENROLL_URL
 */

export interface BypassProgram {
  id: 'PREPASS' | 'DRIVEWYZE';
  name: string;
  enrollUrl: string;
  partnerLink: boolean;
  summary: string;
  howToUse: string;
}

export const PREPASS_DEFAULT_URL = 'https://prepass.com/';
export const DRIVEWYZE_DEFAULT_URL = 'https://drivewyze.com/preclear/';

export function getBypassPrograms(): BypassProgram[] {
  const prepass = resolveHttpsUrl(process.env.PREPASS_ENROLL_URL, PREPASS_DEFAULT_URL, 'PREPASS_ENROLL_URL');
  const drivewyze = resolveHttpsUrl(process.env.DRIVEWYZE_ENROLL_URL, DRIVEWYZE_DEFAULT_URL, 'DRIVEWYZE_ENROLL_URL');
  return [
    {
      id: 'PREPASS',
      name: 'PrePass',
      enrollUrl: prepass.url,
      partnerLink: prepass.custom,
      summary: 'Bypass at PrePass-equipped weigh stations, ports of entry and inspection sites, using a transponder, the PrePass app, or both.',
      howToUse: 'Your carrier enrolls with PrePass. Bypass decisions come from the PrePass transponder or app.',
    },
    {
      id: 'DRIVEWYZE',
      name: 'Drivewyze PreClear',
      enrollUrl: drivewyze.url,
      partnerLink: drivewyze.custom,
      summary: 'App-based bypass at participating weigh stations, with no transponder. Also available through many ELD and telematics providers.',
      howToUse: 'Your carrier signs up with Drivewyze. Bypass decisions come from the Drivewyze app or your ELD integration.',
    },
  ];
}
