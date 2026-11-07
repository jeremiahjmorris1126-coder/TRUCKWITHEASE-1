import React, { useState, useEffect } from 'react';
import { HudVisionProfile, DriverAlertnessData, TabId } from '../../types';
import { authenticatedFetch } from '../../services/firebaseClientAuth';

interface NightHudScreenProps {
  selectedCycle?: '70_8' | '60_7';
  onCycleChange?: (cycle: '70_8' | '60_7') => void;
  onExportInspection?: () => void;
  onOpenPdfModal?: () => void;
  onOpenPrivacyLock?: () => void;
  onOpenEmergency?: () => void;
  onToggleVoice?: () => void;
  isListening?: boolean;
  alertnessData?: DriverAlertnessData;
  onOpenRestModal?: () => void;
  onTriggerFatigue?: () => void;
  onResetAlertness?: () => void;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
  onNavigateToTab?: (tab: TabId) => void;
  onShowToast?: (msg: string, icon?: string) => void;
  visionProfile?: HudVisionProfile;
  onVisionProfileChange?: (profile: HudVisionProfile) => void;
}

export const NightHudScreen: React.FC<NightHudScreenProps> = ({
  onExportInspection,
  onOpenPdfModal,
  onShowToast,
  visionProfile = 'HIGH_CONTRAST',
  onVisionProfileChange,
}) => {
  const [driverProfile, setDriverProfile] = useState<{
    name: string;
    cdlNumber: string;
    cdlState: string;
    assignedUnitId: string;
    carrierName?: string;
    usdotNumber?: string;
    mcNumber?: string;
  } | null>(null);

  const [vehicleProfile, setVehicleProfile] = useState<{
    unitNumber?: string;
    heightFt: number;
    weightLbs: number;
    lengthFt: number;
    widthFt: number;
    axles: number;
  } | null>(null);

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

  const isMinimalist = visionProfile === 'MINIMALIST';
  const isRouteFocused = visionProfile === 'ROUTE_FOCUSED';

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* HUD Vision Profile Selector Bar */}
      {onVisionProfileChange && (
        <div className="bg-surface-container-low p-2.5 rounded-xl border border-surface-container-high flex flex-wrap items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2 px-1">
            <span className="material-symbols-outlined text-primary text-[18px]">visibility</span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant font-bold">
              Cockpit Vision Mode:
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'HIGH_CONTRAST', label: 'High Contrast', icon: 'contrast' },
                { id: 'MINIMALIST', label: 'Minimalist Focus', icon: 'filter_center_focus' },
                { id: 'ROUTE_FOCUSED', label: 'Route Priority', icon: 'alt_route' },
              ] as const
            ).map((mode) => {
              const active = visionProfile === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => onVisionProfileChange(mode.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? 'bg-primary text-on-primary shadow-[0_0_12px_rgba(255,229,0,0.4)]'
                      : 'bg-surface-container text-on-surface-variant hover:text-white border border-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{mode.icon}</span>
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ELD Read-Only HOS Notice */}
      <div className="bg-black p-6 rounded-xl border border-[#FFE500]/20 shadow-2xl text-center space-y-3">
        <span className="material-symbols-outlined text-[#FFE500] text-[36px]">
          schedule
        </span>
        <p className="text-sm font-mono font-bold text-white">
          Hours of service come from your ELD. Connect your ELD to view them here.
        </p>
      </div>

      {/* Signed-In Driver & Equipment Identification Matrix (Only shown when signed in) */}
      {driverProfile ? (
        <div className="bg-surface-container-low p-5 rounded-xl border border-surface-container-high shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                verified_user
              </span>
              <h3 className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                Driver &amp; Equipment
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            {/* Carrier Block */}
            <div className="p-3.5 rounded-lg bg-surface-container border border-surface-container-high space-y-1.5">
              <div className="text-[10px] text-primary font-bold uppercase tracking-wider">
                MOTOR CARRIER
              </div>
              {driverProfile.carrierName ? (
                <>
                  <div className="text-white font-bold text-sm">{driverProfile.carrierName}</div>
                  {driverProfile.usdotNumber && (
                    <div className="text-on-surface-variant">
                      USDOT: <span className="text-slate-200">{driverProfile.usdotNumber}</span>
                    </div>
                  )}
                  {driverProfile.mcNumber && (
                    <div className="text-on-surface-variant">
                      MC: <span className="text-slate-200">{driverProfile.mcNumber}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-on-surface-variant">No carrier specified</div>
              )}
            </div>

            {/* Driver Block */}
            <div className="p-3.5 rounded-lg bg-surface-container border border-surface-container-high space-y-1.5">
              <div className="text-[10px] text-primary font-bold uppercase tracking-wider">
                PRIMARY DRIVER
              </div>
              <div className="text-white font-bold text-sm">{driverProfile.name}</div>
              {driverProfile.cdlNumber && (
                <div className="text-on-surface-variant">
                  CDL: <span className="text-slate-200">{driverProfile.cdlNumber}</span> ({driverProfile.cdlState})
                </div>
              )}
            </div>

            {/* Equipment Block */}
            <div className="p-3.5 rounded-lg bg-surface-container border border-surface-container-high space-y-1.5">
              <div className="text-[10px] text-primary font-bold uppercase tracking-wider">
                ASSIGNED EQUIPMENT
              </div>
              <div className="text-white font-bold text-sm">
                Unit: {vehicleProfile?.unitNumber || driverProfile.assignedUnitId || 'Not specified'}
              </div>
              {vehicleProfile && (
                <div className="text-amber-300 font-bold">
                  Height: {vehicleProfile.heightFt} ft • Length: {vehicleProfile.lengthFt} ft • {vehicleProfile.weightLbs.toLocaleString()} lbs
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* The DOT document vault lives under Fleet & Vault; it is not repeated on the home screen. */}
    </div>
  );
};
