import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';

interface DispatchEtaProps {
  onShowToast: (msg: string, icon?: string) => void;
}

export interface RealFreightLoad {
  id: string;
  loadNumber: string;
  origin: string;
  destination: string;
  originFacilityName?: string;
  originAddress?: string;
  deliveryFacilityName?: string;
  deliveryAddress?: string;
  miles: number;
  grossPayUsd: number;
  yieldPerHourUsd: number;
  equipmentType: string;
  weightLbs: number;
  pickupTime: string;
  deliveryTime: string;
  shipperBroker: string;
  contactPhone: string;
  status: 'AVAILABLE' | 'DISPATCHED' | 'IN_TRANSIT' | 'COMPLETED';
  verified?: boolean;
}

export const DispatchEtaScreen: React.FC<DispatchEtaProps> = ({ onShowToast }) => {
  const [realLoads, setRealLoads] = useState<RealFreightLoad[]>([]);
  const [isLoadingLoads, setIsLoadingLoads] = useState<boolean>(true);
  const [loadsError, setLoadsError] = useState<string | null>(null);
  const [updatingLoadId, setUpdatingLoadId] = useState<string | null>(null);

  const fetchRealLoads = async () => {
    setIsLoadingLoads(true);
    setLoadsError(null);
    try {
      const res = await apiClient.get('/api/loads', { skipUnauthorizedRedirect: true });
      if (res && Array.isArray(res.loads)) {
        setRealLoads(res.loads);
      } else {
        setRealLoads([]);
      }
    } catch {
      // If unauthenticated or empty, show empty loads state cleanly
      setRealLoads([]);
    } finally {
      setIsLoadingLoads(false);
    }
  };

  useEffect(() => {
    fetchRealLoads();
  }, []);

  const handleUpdateLoadStatus = async (loadId: string, nextStatus: 'DISPATCHED' | 'IN_TRANSIT' | 'COMPLETED') => {
    setUpdatingLoadId(loadId);
    try {
      await apiClient.post(`/api/loads/${loadId}/status`, { status: nextStatus });
      onShowToast(`Load status updated to ${nextStatus}`, 'check_circle');
      await fetchRealLoads();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to update load status', 'error');
    } finally {
      setUpdatingLoadId(null);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      <div className="space-y-4 max-w-2xl mx-auto w-full animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between pt-1 pb-1">
          <div>
            <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-black text-white tracking-wider uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              DISPATCH LOADS
            </h1>
            <p className="text-sm font-medium text-slate-300 tracking-wide mt-1">
              Assigned Loads from GET /api/loads
            </p>
          </div>
          <button
            onClick={fetchRealLoads}
            className="p-2 rounded-lg bg-surface-container border border-surface-container-high text-primary hover:bg-surface-container-high cursor-pointer flex items-center gap-1 text-xs font-mono font-bold"
            title="Refresh Loads"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Refresh</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoadingLoads && (
          <div className="bg-[#0A0F14] p-8 rounded-2xl border border-[#1E2532] text-center space-y-3 font-mono">
            <span className="material-symbols-outlined text-[#FFE500] text-[36px] animate-spin">
              progress_activity
            </span>
            <p className="text-sm text-slate-300">
              Loading loads from /api/loads...
            </p>
          </div>
        )}

        {/* Error State */}
        {!isLoadingLoads && loadsError && (
          <div className="bg-red-950/40 p-5 rounded-2xl border border-red-500/50 space-y-3 font-mono">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <span>Connection Error</span>
            </div>
            <p className="text-xs text-red-200">{loadsError}</p>
            <button
              onClick={fetchRealLoads}
              className="px-3 py-1.5 rounded-lg bg-red-500 text-black font-bold text-xs uppercase cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingLoads && !loadsError && realLoads.length === 0 && (
          <div className="bg-[#0A0F14] p-8 rounded-2xl border border-[#1E2532] text-center space-y-2 font-mono">
            <span className="material-symbols-outlined text-slate-500 text-[40px]">
              local_shipping
            </span>
            <h3 className="text-base font-bold text-white uppercase">No loads yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No loads yet. Loads assigned to your account will appear here with pickup address, delivery address, and rate.
            </p>
          </div>
        )}

        {/* Real Loads List */}
        {!isLoadingLoads && !loadsError && realLoads.length > 0 && (
          <div className="space-y-3">
            {realLoads.map((load) => {
              const isUpdating = updatingLoadId === load.id;
              const isServerVerified = Boolean(load.verified) === Boolean(1);
              const statusColor =
                load.status === 'COMPLETED'
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : load.status === 'IN_TRANSIT'
                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/50'
                  : load.status === 'DISPATCHED'
                  ? 'bg-amber-950/70 text-amber-300 border-amber-500/50'
                  : 'bg-sky-950/70 text-sky-400 border-sky-500/50';

              return (
                <div
                  key={load.id}
                  className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-3 relative overflow-hidden font-mono"
                >
                  {/* Top Row: Load #, Server-Verified Badge (only if verified by server), & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#F59E0B] tracking-wider uppercase">
                        LOAD #{load.loadNumber}
                      </span>
                      {load.equipmentType && (
                        <span className="text-[10px] text-slate-400">
                          ({load.equipmentType})
                        </span>
                      )}
                      {isServerVerified && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                          VERIFIED
                        </span>
                      )}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusColor}`}>
                      {load.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Rate & Lane */}
                  <div className="flex items-baseline justify-between flex-wrap gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-['Space_Grotesk'] text-2xl font-black text-[#FFE500]">
                        ${Number(load.grossPayUsd || 0).toLocaleString()}
                      </span>
                      {load.yieldPerHourUsd > 0 && (
                        <span className="text-xs text-slate-400">
                          (${Math.round(load.yieldPerHourUsd)}/Hr)
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-bold">
                      {load.miles} Miles
                    </span>
                  </div>

                  {/* Pickup & Delivery Addresses */}
                  <div className="p-3 rounded-xl bg-[#05080E] border border-[#1E2532] space-y-2 text-xs">
                    <div>
                      <div className="flex items-center gap-1.5 text-white font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>PICKUP: {load.originFacilityName || load.origin}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 pl-3.5 mt-0.5">
                        {load.originAddress || load.origin}
                      </p>
                      {load.pickupTime && (
                        <p className="text-[10px] text-slate-500 pl-3.5">Target: {load.pickupTime}</p>
                      )}
                    </div>

                    <div className="border-t border-[#1E2532] pt-2">
                      <div className="flex items-center gap-1.5 text-white font-bold">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>DELIVERY: {load.deliveryFacilityName || load.destination}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 pl-3.5 mt-0.5">
                        {load.deliveryAddress || load.destination}
                      </p>
                      {load.deliveryTime && (
                        <p className="text-[10px] text-slate-500 pl-3.5">Target: {load.deliveryTime}</p>
                      )}
                    </div>
                  </div>

                  {/* Weight & Broker */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Weight: {Number(load.weightLbs || 0).toLocaleString()} lbs</span>
                    <span>Broker: {load.shipperBroker || 'N/A'}</span>
                  </div>

                  {/* Action Controls for Driver */}
                  <div className="pt-1">
                    {load.status === 'AVAILABLE' && (
                      <button
                        onClick={() => handleUpdateLoadStatus(load.id, 'DISPATCHED')}
                        disabled={isUpdating}
                        className="w-full py-3 px-4 rounded-xl font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider bg-[#FFE500] text-black hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(255,229,0,0.3)] disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        <span>{isUpdating ? 'Updating...' : 'Accept Load'}</span>
                      </button>
                    )}

                    {load.status === 'DISPATCHED' && (
                      <button
                        onClick={() => handleUpdateLoadStatus(load.id, 'IN_TRANSIT')}
                        disabled={isUpdating}
                        className="w-full py-3 px-4 rounded-xl font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider bg-emerald-500 text-black hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.3)] disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">navigation</span>
                        <span>{isUpdating ? 'Updating...' : 'Start Trip (Mark In-Transit)'}</span>
                      </button>
                    )}

                    {load.status === 'IN_TRANSIT' && (
                      <button
                        onClick={() => handleUpdateLoadStatus(load.id, 'COMPLETED')}
                        disabled={isUpdating}
                        className="w-full py-3 px-4 rounded-xl font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider bg-purple-500 text-white hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(168,85,247,0.3)] disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">task_alt</span>
                        <span>{isUpdating ? 'Updating...' : 'Complete Delivery'}</span>
                      </button>
                    )}

                    {load.status === 'COMPLETED' && (
                      <div className="w-full py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400 font-bold uppercase">
                        Delivery Completed
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
