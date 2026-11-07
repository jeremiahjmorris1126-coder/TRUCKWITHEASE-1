import { afterEach, describe, expect, it } from 'bun:test';
import { GPSTAB_DEFAULT_ORDER_URL, getEldOrderOptions, resolveGpstabOrderUrl } from '../server/eld/gpstabOrder';

const saved = process.env.GPSTAB_ORDER_URL;
afterEach(() => {
  if (saved === undefined) delete process.env.GPSTAB_ORDER_URL;
  else process.env.GPSTAB_ORDER_URL = saved;
});

describe('GPSTab order link', () => {
  it("defaults to GPSTab's public ELD store", () => {
    delete process.env.GPSTAB_ORDER_URL;
    const [opt] = getEldOrderOptions();
    expect(opt.id).toBe('GPSTAB');
    expect(opt.orderUrl).toBe(GPSTAB_DEFAULT_ORDER_URL);
    expect(opt.partnerLink).toBe(false);
  });

  it('uses a configured https partner/referral URL', () => {
    process.env.GPSTAB_ORDER_URL = 'https://gpstab.com/start/?ref=truckwithease';
    const [opt] = getEldOrderOptions();
    expect(opt.orderUrl).toBe('https://gpstab.com/start/?ref=truckwithease');
    expect(opt.partnerLink).toBe(true);
  });

  it('rejects non-https or malformed URLs and falls back to the default', () => {
    expect(resolveGpstabOrderUrl('http://gpstab.com/start/').url).toBe(GPSTAB_DEFAULT_ORDER_URL);
    expect(resolveGpstabOrderUrl('javascript:alert(1)').url).toBe(GPSTAB_DEFAULT_ORDER_URL);
    expect(resolveGpstabOrderUrl('not a url').url).toBe(GPSTAB_DEFAULT_ORDER_URL);
    expect(resolveGpstabOrderUrl('   ').custom).toBe(false);
  });
});
