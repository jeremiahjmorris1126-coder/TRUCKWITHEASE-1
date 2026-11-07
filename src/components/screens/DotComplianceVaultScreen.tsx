import React, { useState, useEffect } from 'react';
import { ComplianceDocumentArchive } from '../ComplianceDocumentArchive';
import { authenticatedFetch } from '../../services/firebaseClientAuth';

interface DotComplianceVaultScreenProps {
  onShowToast?: (msg: string, icon?: string) => void;
}

interface DriverProfileSummary {
  id: string;
  name: string;
  cdlNumber: string;
  cdlState: string;
  medicalCardExpiry: string;
  assignedUnitId: string;
  carrierName?: string;
  usdotNumber?: string;
  mcNumber?: string;
}

interface VehicleProfileSummary {
  unitNumber?: string;
  heightFt: number;
  weightLbs: number;
  lengthFt: number;
  widthFt: number;
  axles: number;
  isHazmat?: boolean;
}

export const DotComplianceVaultScreen: React.FC<DotComplianceVaultScreenProps> = ({
  onShowToast,
}) => {
  const [activeVaultTab, setActiveVaultTab] = useState<
    'DOCUMENT_ARCHIVE' | 'FLEET_DQF' | 'VEHICLE_ASSETS'
  >('DOCUMENT_ARCHIVE');

  const [driverProfile, setDriverProfile] = useState<DriverProfileSummary | null>(null);
  const [vehicleProfile, setVehicleProfile] = useState<VehicleProfileSummary | null>(null);

  useEffect(() => {
    authenticatedFetch('/api/driver/profile')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data?.profile) {
            setDriverProfile(data.profile);
          }
        }
      })
      .catch(() => {});

    authenticatedFetch('/v1/routing/vehicle-profile')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data?.profile) {
            setVehicleProfile(data.profile);
          }
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md animate-fade-in">
      {/* Top Banner: DOT & FMCSA Compliance Vault */}
      <div className="bg-gradient-to-r from-[#0A0F18] via-[#0F172A] to-[#0A0F18] p-5 rounded-2xl border-2 border-[#FFE500]/60 shadow-[0_0_30px_rgba(255,229,0,0.15)] flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#FFE500] text-black flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(255,229,0,0.4)]">
            <span className="material-symbols-outlined text-[28px] font-black">
              folder_managed
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-[#FFE500] text-black font-black text-[10px] tracking-widest uppercase">
                49 CFR PART 390 / 391 / 396
              </span>
            </div>
            <h1 className="font-['Space_Grotesk'] text-lg sm:text-xl font-black text-white uppercase tracking-wide mt-1">
              DOT &amp; FMCSA Compliance Document Vault
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              {driverProfile?.name ? (
                <>
                  Driver: <strong className="text-white">{driverProfile.name}</strong>
                  {driverProfile.carrierName ? ` • Carrier: ${driverProfile.carrierName}` : ''}
                  {driverProfile.usdotNumber ? ` (USDOT #${driverProfile.usdotNumber})` : ''}
                </>
              ) : (
                'Sign in to view your driver profile and compliance records.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Selector */}
      <div className="bg-[#0A0F14] p-1.5 rounded-2xl border border-[#1E2532] shadow-xl grid grid-cols-3 gap-1.5 font-mono">
        <button
          onClick={() => setActiveVaultTab('DOCUMENT_ARCHIVE')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeVaultTab === 'DOCUMENT_ARCHIVE'
              ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]'
              : 'text-slate-400 hover:text-white bg-slate-900/40'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">folder_copy</span>
          <span>1. Document Archive</span>
        </button>

        <button
          onClick={() => setActiveVaultTab('FLEET_DQF')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeVaultTab === 'FLEET_DQF'
              ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]'
              : 'text-slate-400 hover:text-white bg-slate-900/40'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">badge</span>
          <span>2. Driver Profile (DQF)</span>
        </button>

        <button
          onClick={() => setActiveVaultTab('VEHICLE_ASSETS')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeVaultTab === 'VEHICLE_ASSETS'
              ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]'
              : 'text-slate-400 hover:text-white bg-slate-900/40'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">local_shipping</span>
          <span>3. Vehicle Profile</span>
        </button>
      </div>

      {/* TAB 1: FULL DOT DOCUMENT ARCHIVE */}
      {activeVaultTab === 'DOCUMENT_ARCHIVE' && (
        <ComplianceDocumentArchive onShowToast={onShowToast} />
      )}

      {/* TAB 2: DRIVER PROFILE (49 CFR § 391.51) */}
      {activeVaultTab === 'FLEET_DQF' && (
        <div className="bg-[#0A0F14] p-5 rounded-2xl border border-[#1E2532] shadow-2xl space-y-4 font-mono">
          <div className="border-b border-[#1E2532] pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Driver Qualification File (49 CFR § 391.51)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Loaded from /api/driver/profile
            </p>
          </div>

          {!driverProfile ? (
            <div className="p-6 rounded-xl bg-[#05080E] border border-slate-800 text-center text-xs text-slate-400">
              Not signed in. Sign in to view your Driver Qualification File from /api/driver/profile.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">DRIVER NAME</span>
                <span className="text-sm font-bold text-white block mt-1">{driverProfile.name || 'Not set'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">CDL LICENSE</span>
                <span className="text-sm font-bold text-white block mt-1">
                  {driverProfile.cdlNumber ? `${driverProfile.cdlState} ${driverProfile.cdlNumber}` : 'Not set'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">MEDICAL EXAMINER CERTIFICATE EXPIRY</span>
                <span className="text-sm font-bold text-white block mt-1">
                  {driverProfile.medicalCardExpiry || 'Not set'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">ASSIGNED UNIT</span>
                <span className="text-sm font-bold text-white block mt-1">
                  {driverProfile.assignedUnitId || 'Not set'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VEHICLE PROFILE */}
      {activeVaultTab === 'VEHICLE_ASSETS' && (
        <div className="bg-[#0A0F14] p-5 rounded-2xl border border-[#1E2532] shadow-2xl space-y-4 font-mono">
          <div className="border-b border-[#1E2532] pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Commercial Vehicle Profile
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Loaded from /v1/routing/vehicle-profile
            </p>
          </div>

          {!vehicleProfile ? (
            <div className="p-6 rounded-xl bg-[#05080E] border border-slate-800 text-center text-xs text-slate-400">
              Sign in and save your vehicle profile in Commercial Route Planner to view equipment dimensions here.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">UNIT NUMBER</span>
                <span className="text-sm font-bold text-white block mt-1">{vehicleProfile.unitNumber || 'Not set'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">HEIGHT (FT)</span>
                <span className="text-sm font-bold text-[#FFE500] block mt-1">{vehicleProfile.heightFt} ft</span>
              </div>
              <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">LENGTH (FT)</span>
                <span className="text-sm font-bold text-white block mt-1">{vehicleProfile.lengthFt} ft</span>
              </div>
              <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">GROSS WEIGHT (LBS)</span>
                <span className="text-sm font-bold text-white block mt-1">{vehicleProfile.weightLbs.toLocaleString()} lbs</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
