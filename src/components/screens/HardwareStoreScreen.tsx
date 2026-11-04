import React, { useState, useEffect } from 'react';
import {
  hardwareClientService,
  HardwareCatalogItem,
  HardwareOrderRequest,
  HardwareOrderRecord,
} from '../../services/hardwareClientService';

interface HardwareStoreScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
}

export const HardwareStoreScreen: React.FC<HardwareStoreScreenProps> = ({ onShowToast }) => {
  const [catalog, setCatalog] = useState<HardwareCatalogItem[]>([]);
  const [orders, setOrders] = useState<HardwareOrderRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'SHOP' | 'ORDERS'>('SHOP');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form State
  const [selectedTier, setSelectedTier] = useState<'TIER_STARTER' | 'TIER_PRO' | 'TIER_ENTERPRISE'>('TIER_PRO');
  const [selectedHardware, setSelectedHardware] = useState<
    'samsara_vg54' | 'geotab_go9' | 'azuga_gateway' | 'gpstab_link' | 'opt_out_existing'
  >('samsara_vg54');
  const [selectedCamera, setSelectedCamera] = useState<'camera_dual_ai' | 'camera_road_hd' | 'camera_none'>('camera_dual_ai');
  const [existingVendor, setExistingVendor] = useState<'Azuga' | 'Geotab' | 'GPSTab' | 'Samsara'>('Samsara');
  const [existingSerialNumber, setExistingSerialNumber] = useState<string>('');

  // Shipping Form
  const [recipientName, setRecipientName] = useState<string>('Marcus Vance');
  const [companyName, setCompanyName] = useState<string>('Apex Continental Express LLC');
  const [streetAddress, setStreetAddress] = useState<string>('1000 Freightway Blvd, Suite 200');
  const [city, setCity] = useState<string>('Dallas');
  const [state, setState] = useState<string>('TX');
  const [zipCode, setZipCode] = useState<string>('75201');
  const [phone, setPhone] = useState<string>('+1-555-839-2041');

  // Mandatory statutory FMCSA legal acknowledgment
  const [fmcsaAcknowledged, setFmcsaAcknowledged] = useState<boolean>(false);

  useEffect(() => {
    hardwareClientService.getCatalog().then((items) => setCatalog(items));
    hardwareClientService.listOrders().then((records) => setOrders(records));
  }, []);

  const isOptOut = selectedHardware === 'opt_out_existing';

  const tierItems = catalog.filter((i) => i.type === 'TIER');
  const hardwareItems = catalog.filter((i) => i.type === 'ELD_DEVICE');
  const cameraItems = catalog.filter((i) => i.type === 'CAMERA');

  const selectedTierItem = tierItems.find((i) => i.id === selectedTier);
  const selectedHardwareItem = hardwareItems.find((i) => i.id === selectedHardware);
  const selectedCameraItem = cameraItems.find((i) => i.id === selectedCamera);

  const totalMonthly = (selectedTierItem?.monthlyPriceUsd || 89) + (selectedCameraItem?.monthlyPriceUsd || 0);
  const totalUpfront = (isOptOut ? 0 : (selectedHardwareItem?.hardwareUpfrontUsd || 0)) + (isOptOut ? 0 : (selectedCameraItem?.hardwareUpfrontUsd || 0));

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fmcsaAcknowledged) {
      onShowToast('MANDATORY FMCSA ACKNOWLEDGMENT REQUIRED BEFORE ORDERING', 'warning');
      return;
    }

    if (!isOptOut && (!streetAddress || !city || !state || !zipCode || !recipientName)) {
      onShowToast('PLEASE COMPLETE SHIPPING ADDRESS FOR DROP-SHIP FULFILLMENT', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload: HardwareOrderRequest = {
        tierId: selectedTier,
        hardwareId: selectedHardware,
        cameraId: selectedCamera,
        existingVendor: isOptOut ? existingVendor : undefined,
        existingDeviceSerialNumber: isOptOut ? existingSerialNumber : undefined,
        shippingAddress: {
          recipientName,
          companyName,
          streetAddress,
          city,
          state,
          zipCode,
          phone,
        },
        userSoleFmcsaRegistrationAcknowledged: fmcsaAcknowledged,
      };

      const newOrder = await hardwareClientService.submitOrder(payload);
      setOrders((prev) => [newOrder, ...prev]);
      setActiveTab('ORDERS');
      onShowToast(
        isOptOut
          ? 'EXISTING ELD CONFIGURED // TRUCKWITHEASE CO-PILOT ACTIVE'
          : `ORDER PLACED // DROP-SHIPPING DIRECT VIA ${newOrder.vendor.toUpperCase()}`,
        'check_circle'
      );
    } catch (err: any) {
      onShowToast(`Order Failed: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 font-mono p-4 sm:p-6 text-on-surface">
      {/* HEADER BAR */}
      <div className="p-5 rounded-2xl bg-surface-container border border-surface-container-high flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-primary">router</span>
            <h1 className="text-[18px] sm:text-[20px] font-bold text-white uppercase tracking-wider">
              Commercial ELD Hardware &amp; Fulfillment Hub
            </h1>
          </div>
          <p className="text-[11px] text-outline mt-1">
            Official drop-ship partners: <strong className="text-white">Azuga &bull; Geotab &bull; GPSTab &bull; Samsara</strong> or Bring-Your-Own-Device (BYOD)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('SHOP')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase transition-all cursor-pointer ${
              activeTab === 'SHOP' ? 'bg-primary text-black' : 'bg-surface-container-high text-outline hover:text-white'
            }`}
          >
            Select Hardware
          </button>
          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ORDERS' ? 'bg-primary text-black' : 'bg-surface-container-high text-outline hover:text-white'
            }`}
          >
            <span>Tracked Orders</span>
            {orders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-black text-primary font-bold">
                {orders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'SHOP' ? (
        <form onSubmit={handlePlaceOrder} className="space-y-6">
          {/* STEP 1: SUBSCRIPTION TIER SELECTION */}
          <div className="p-5 rounded-2xl bg-surface-container border border-surface-container-high space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
              <span className="text-[12px] font-bold text-primary uppercase">1. Select Software &amp; Compliance Tier:</span>
              <span className="text-[10px] text-outline">Billed monthly &bull; Zero contract lock-in</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {tierItems.map((tier) => (
                <div
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id as any)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedTier === tier.id
                      ? 'bg-primary/10 border-primary shadow-lg ring-1 ring-primary'
                      : 'bg-surface-container-low border-surface-container-high hover:border-outline'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-bold text-white uppercase">{tier.name}</span>
                    <span className="text-[14px] font-bold text-primary">${tier.monthlyPriceUsd}/mo</span>
                  </div>
                  <p className="text-[10px] text-outline mb-2">{tier.description}</p>
                  <ul className="text-[9px] text-slate-300 space-y-1">
                    {tier.specs.map((s, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <span className="text-emerald-400">&bull;</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* STEP 2: ELD HARDWARE OR OPT-OUT SELECTION */}
          <div className="p-5 rounded-2xl bg-surface-container border border-surface-container-high space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
              <span className="text-[12px] font-bold text-primary uppercase">2. Select ELD Gateway Device (Or Opt Out):</span>
              <span className="text-[10px] text-emerald-400 font-bold">Direct drop-ship from vendor to your door</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {hardwareItems.map((hw) => {
                const isSelected = selectedHardware === hw.id;
                const isOptOutChoice = hw.id === 'opt_out_existing';
                return (
                  <div
                    key={hw.id}
                    onClick={() => setSelectedHardware(hw.id as any)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? isOptOutChoice
                          ? 'bg-amber-500/10 border-amber-400 shadow-lg ring-1 ring-amber-400'
                          : 'bg-primary/10 border-primary shadow-lg ring-1 ring-primary'
                        : 'bg-surface-container-low border-surface-container-high hover:border-outline'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-surface-container-highest text-slate-200">
                          {hw.vendor}
                        </span>
                        <span className={`text-[13px] font-bold ${isOptOutChoice ? 'text-amber-400' : 'text-white'}`}>
                          {hw.hardwareUpfrontUsd === 0 ? 'FREE / OPT-OUT' : `$${hw.hardwareUpfrontUsd} Upfront`}
                        </span>
                      </div>
                      <h3 className="text-[12px] font-bold text-white mb-1">{hw.name}</h3>
                      <p className="text-[10px] text-outline mb-2">{hw.description}</p>
                    </div>
                    <ul className="text-[9px] text-slate-300 space-y-0.5 pt-2 border-t border-surface-container-high/50">
                      {hw.specs.map((s, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <span className="text-primary">&check;</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* If Bring Your Own Device Selected */}
            {isOptOut && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-2 mt-3 animate-in fade-in">
                <span className="text-[11px] font-bold text-amber-300 block uppercase">
                  Bring-Your-Own-Device (BYOD) Configuration:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <label className="text-[9px] text-outline block mb-1">Existing ELD Provider:</label>
                    <select
                      value={existingVendor}
                      onChange={(e) => setExistingVendor(e.target.value as any)}
                      className="w-full bg-surface-container-high text-white p-2 rounded-lg border border-surface-container-highest outline-none"
                    >
                      <option value="Samsara">Samsara</option>
                      <option value="Geotab">Geotab</option>
                      <option value="Azuga">Azuga</option>
                      <option value="GPSTab">GPSTab</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-outline block mb-1">Existing Device Serial # / Unit ID:</label>
                    <input
                      type="text"
                      placeholder="e.g. VG54-994102 or GO9-38192"
                      value={existingSerialNumber}
                      onChange={(e) => setExistingSerialNumber(e.target.value)}
                      className="w-full bg-surface-container-high text-white p-2 rounded-lg border border-surface-container-highest outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: CAMERA SELECTION */}
          <div className="p-5 rounded-2xl bg-surface-container border border-surface-container-high space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
              <span className="text-[12px] font-bold text-primary uppercase">3. Choose Dashcam Option:</span>
              <span className="text-[10px] text-outline">Exonerate driver liability &bull; Reduce insurance 22%</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {cameraItems.map((cam) => (
                <div
                  key={cam.id}
                  onClick={() => setSelectedCamera(cam.id as any)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedCamera === cam.id
                      ? 'bg-primary/10 border-primary shadow-lg ring-1 ring-primary'
                      : 'bg-surface-container-low border-surface-container-high hover:border-outline'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-bold text-white uppercase">{cam.name}</span>
                    <span className="text-[12px] font-bold text-emerald-400">
                      {cam.hardwareUpfrontUsd === 0 ? '$0' : `$${cam.hardwareUpfrontUsd} + $${cam.monthlyPriceUsd}/mo`}
                    </span>
                  </div>
                  <p className="text-[10px] text-outline mb-2">{cam.description}</p>
                  <ul className="text-[9px] text-slate-300 space-y-1">
                    {cam.specs.map((s, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <span className="text-emerald-400">&bull;</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* STEP 4: SHIPPING ADDRESS (IF DROP-SHIPPED) */}
          {!isOptOut && (
            <div className="p-5 rounded-2xl bg-surface-container border border-surface-container-high space-y-3">
              <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
                <span className="text-[12px] font-bold text-primary uppercase">
                  4. Direct Drop-Ship Address (Shipped by Vendor):
                </span>
                <span className="text-[10px] text-outline">Terminal, Shop, or Home Delivery</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
                <div>
                  <label className="text-[9px] text-outline block mb-1">Recipient Name:</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full bg-surface-container-high text-white p-2 rounded-lg border border-surface-container-highest outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9px] text-outline block mb-1">Company / Carrier Name:</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-surface-container-high text-white p-2 rounded-lg border border-surface-container-highest outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-outline block mb-1">Contact Phone:</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-surface-container-high text-white p-2 rounded-lg border border-surface-container-highest outline-none"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[9px] text-outline block mb-1">Street Address:</label>
                  <input
                    type="text"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    className="w-full bg-surface-container-high text-white p-2 rounded-lg border border-surface-container-highest outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 sm:col-span-1">
                  <div>
                    <label className="text-[9px] text-outline block mb-1">City:</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-surface-container-high text-white p-2 rounded-lg border border-surface-container-highest outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-outline block mb-1">State:</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full bg-surface-container-high text-white p-2 rounded-lg border border-surface-container-highest outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-outline block mb-1">ZIP:</label>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className="w-full bg-surface-container-high text-white p-2 rounded-lg border border-surface-container-highest outline-none"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: MANDATORY FMCSA STATUTORY REGISTRATION DISCLAIMER */}
          <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/50 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-[22px]">gavel</span>
              <span className="text-[12px] font-bold text-amber-300 uppercase">
                FMCSA Statutory Regulation 49 CFR Part 395 Disclaimer
              </span>
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              TruckWithEase tracks and documents all hardware serial numbers for internal fleet warranty, carrier maintenance records, and dispatch diagnostics.
              However, pursuant to <strong>49 CFR &sect; 395.22 and &sect; 395.24</strong>, <strong>IT IS SOLELY THE USER/CARRIER LEGAL RESPONSIBILITY</strong> to register the ELD device identifier and vehicle VIN directly with the official <strong>FMCSA ELD Registry</strong> prior to placing the commercial vehicle into service.
            </p>
            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={fmcsaAcknowledged}
                onChange={(e) => setFmcsaAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary accent-amber-500 cursor-pointer"
                required
              />
              <span className="text-[11px] font-bold text-white">
                I understand and agree that it is solely my legal responsibility as the carrier/user to register this ELD with the FMCSA.
              </span>
            </label>
          </div>

          {/* STEP 6: ORDER SUMMARY & SUBMIT */}
          <div className="p-5 rounded-2xl bg-surface-container border border-surface-container-high flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-[11px] text-outline uppercase block">Order Total Breakdown:</span>
              <div className="flex items-baseline gap-3 mt-0.5">
                <span className="text-[18px] font-bold text-white">${totalUpfront.toFixed(2)} Upfront</span>
                <span className="text-[14px] text-primary font-bold">+ ${totalMonthly.toFixed(2)} / Month</span>
              </div>
              <span className="text-[9px] text-outline">
                {isOptOut ? 'Existing device link &bull; No shipping delay' : 'Direct vendor drop-ship &bull; Internal serial tracking active'}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting || !fmcsaAcknowledged}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-black font-bold text-[12px] uppercase tracking-wider hover:brightness-110 cursor-pointer shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              <span>{submitting ? 'Transmitting Order...' : isOptOut ? 'Bind Existing ELD' : 'Place ELD Drop-Ship Order'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* ORDERS LIST & TRACKED SERIAL NUMBERS */
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-white uppercase">Fleet Hardware Records &amp; Serial Log:</span>
            <span className="text-[10px] text-outline">Tracked for internal fleet warranty &amp; inventory</span>
          </div>

          {orders.length === 0 ? (
            <div className="p-8 rounded-2xl bg-surface-container text-center border border-surface-container-high space-y-2">
              <span className="material-symbols-outlined text-[40px] text-outline">inventory_2</span>
              <p className="text-[12px] text-white font-bold">No hardware orders placed yet.</p>
              <button
                onClick={() => setActiveTab('SHOP')}
                className="px-4 py-2 rounded-xl bg-primary text-black text-[11px] font-bold uppercase cursor-pointer"
              >
                Choose ELD Hardware
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((ord) => (
                <div key={ord.id} className="p-4 rounded-xl bg-surface-container border border-surface-container-high space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-surface-container-high pb-2">
                    <div>
                      <span className="text-[13px] font-bold text-white uppercase">{ord.hardwareName}</span>
                      <span className="text-[10px] text-outline block">Order #{ord.vendorOrderId} &bull; Vendor: {ord.vendor}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 w-fit">
                      {ord.vendorFulfillmentStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <span className="text-outline block">Documented Internal Serial #:</span>
                      {ord.assignedSerialNumbers.map((sn, i) => (
                        <span key={i} className="text-primary font-bold block">{sn}</span>
                      ))}
                    </div>
                    <div>
                      <span className="text-outline block">Carrier Tracking #:</span>
                      <span className="text-white font-bold">{ord.carrierTrackingNumber}</span>
                    </div>
                    <div>
                      <span className="text-outline block">Camera Option:</span>
                      <span className="text-slate-300 font-bold">{ord.cameraName}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-surface-container-low text-[9px] text-outline">
                    <strong>FMCSA Notice:</strong> {ord.fmcsaStatutoryNotice}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
