import React, { useState, useEffect } from 'react';
import { DutyStatus } from '../../types';

interface HosClocksScreenProps {
  onShowToast: (msg: string) => void;
  speed: number;
}

export const HosClocksScreen: React.FC<HosClocksScreenProps> = ({
  onShowToast,
  speed,
}) => {
  const [currentStatus, setCurrentStatus] = useState<DutyStatus>('D');
  const [drivingSecondsRemaining, setDrivingSecondsRemaining] = useState<number>(6 * 3600 + 44 * 60 + 12);
  const [dutyWindowSecondsRemaining, setDutyWindowSecondsRemaining] = useState<number>(9 * 3600 + 18 * 60 + 5);
  const [cycleSecondsRemaining] = useState<number>(32 * 3600 + 15 * 60);

  // Split-sleeper simulator states
  const [splitPeriod1, setSplitPeriod1] = useState<number>(7.2); // 7h 12m
  const [splitPeriod2, setSplitPeriod2] = useState<number>(2.8); // 2h 48m

  // Live timer tick when driving
  useEffect(() => {
    if (currentStatus === 'D') {
      const timer = setInterval(() => {
        setDrivingSecondsRemaining((prev) => Math.max(0, prev - 1));
        setDutyWindowSecondsRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentStatus]);

  const formatHMS = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStatusChange = (newStatus: DutyStatus) => {
    if (newStatus === currentStatus) return;
    setCurrentStatus(newStatus);
    const labels: Record<DutyStatus, string> = {
      D: 'STATUS: DRIVING (D) - ECM J1939 LOCK ACTIVE',
      ON: 'STATUS: ON-DUTY NOT DRIVING (ON)',
      SB: 'STATUS: SLEEPER BERTH (SB) - 14H CLOCK PAUSED',
      OFF: 'STATUS: OFF-DUTY (OFF)',
      YM: 'STATUS: YARD MOVE (YM - § 395.2 SPECIAL DRIVING)',
      PC: 'STATUS: PERSONAL CONVEYANCE (PC - AUTHORIZED OFF-DUTY)',
    };
    onShowToast(labels[newStatus]);
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* Real-time Status Switcher */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="font-label-caps text-label-caps text-primary uppercase tracking-widest font-bold">
              FMCSA Duty Status Switchboard
            </span>
          </div>
          <span className="font-telemetry-label text-[10px] text-outline">
            {speed > 5 ? 'VEHICLE IN MOTION (AUTO D)' : 'STATIONARY (ECM ZERO SPEED)'}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
          {[
            { id: 'D', label: 'DRIVING', code: 'D', color: 'bg-primary text-on-primary' },
            { id: 'ON', label: 'ON DUTY', code: 'ON', color: 'bg-tertiary text-on-tertiary' },
            { id: 'SB', label: 'SLEEPER', code: 'SB', color: 'bg-sky-400 text-black' },
            { id: 'OFF', label: 'OFF DUTY', code: 'OFF', color: 'bg-surface-container-highest text-on-surface' },
            { id: 'YM', label: 'YARD MOVE', code: 'YM', color: 'bg-purple-400 text-black' },
            { id: 'PC', label: 'PERS. CONV.', code: 'PC', color: 'bg-amber-400 text-black' },
          ].map((item) => {
            const isSelected = currentStatus === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleStatusChange(item.id as DutyStatus)}
                className={`py-2.5 px-2 rounded-lg flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                  isSelected
                    ? `${item.color} font-bold shadow-lg border-primary scale-105`
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border-surface-container-highest'
                }`}
              >
                <span className="font-telemetry-metric text-[16px] leading-none">
                  {item.code}
                </span>
                <span className="font-label-caps text-[8px] tracking-wider uppercase text-center truncate w-full">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Precision Clocks Deep Dive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
        {/* 11-Hour Drive */}
        <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider">
              11-Hour Driving Clock (§ 395.3(a)(3))
            </span>
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-telemetry-label text-[10px]">
              61% REMAINING
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-telemetry-metric text-[32px] text-primary tracking-tight font-mono">
              {formatHMS(drivingSecondsRemaining)}
            </span>
            <span className="font-telemetry-label text-[11px] text-outline">
              LIMIT: 11:00:00
            </span>
          </div>
          <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${(drivingSecondsRemaining / (11 * 3600)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-outline pt-1">
            <span>Driven: 04h 15m 48s</span>
            <span className="text-primary font-bold">Clean: 0 Violations</span>
          </div>
        </div>

        {/* 14-Hour Duty Window */}
        <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider">
              14-Hour On-Duty Shift Window
            </span>
            <span className="px-2 py-0.5 rounded bg-primary-fixed/20 text-primary font-telemetry-label text-[10px]">
              SPLIT EXTENDED
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-telemetry-metric text-[32px] text-primary tracking-tight font-mono">
              {formatHMS(dutyWindowSecondsRemaining)}
            </span>
            <span className="font-telemetry-label text-[11px] text-outline">
              EXPIRES: 00:18 CST
            </span>
          </div>
          <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${(dutyWindowSecondsRemaining / (14 * 3600)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-outline pt-1">
            <span>Window: 14h + 07h 12m Split Pause</span>
            <span className="text-primary font-bold">Compliant</span>
          </div>
        </div>

        {/* 30-Minute Rest Break */}
        <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider">
              30-Minute Rest Break Rule
            </span>
            <span className="material-symbols-outlined text-primary text-[18px]">
              check_circle
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-headline-lg text-[28px] text-primary font-bold tracking-wider">
              SATISFIED
            </span>
            <span className="font-telemetry-label text-[11px] text-outline font-mono">
              +08:00 GRACE
            </span>
          </div>
          <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: '100%' }} />
          </div>
          <div className="flex justify-between text-[11px] text-outline pt-1">
            <span>Completed via Sleeper Berth</span>
            <span className="text-on-surface-variant">Next required by 19:12 CST</span>
          </div>
        </div>

        {/* 70-Hour / 8-Day Roll */}
        <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider">
              70-Hour / 8-Day Rolling Cap
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface font-telemetry-label text-[10px]">
              RECAP ACTIVE
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-telemetry-metric text-[32px] text-primary tracking-tight font-mono">
              {formatHMS(cycleSecondsRemaining)}
            </span>
            <span className="font-telemetry-label text-[11px] text-outline">
              OF 70:00:00
            </span>
          </div>
          <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${(cycleSecondsRemaining / (70 * 3600)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-outline pt-1">
            <span>Used: 37h 45m (53.9%)</span>
            <span className="text-primary font-bold">Midnight Gains: +08h 55m</span>
          </div>
        </div>
      </div>

      {/* Split-Sleeper Clause Calculator */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              calculate
            </span>
            <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold">
              49 CFR § 395.1(g) Split Berth Optimizer
            </span>
          </div>
          <span className="bg-primary-container/20 text-primary font-telemetry-label text-[10px] px-2 py-0.5 rounded">
            FMCSA CERTIFIED
          </span>
        </div>

        <p className="font-body-sm text-[12px] text-on-surface-variant">
          Simulate a 7/3, 8/2, or 7.5/2.5 split sleeper pairing to project exact window freeze times and calculation reset points.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm pt-1">
          <div className="bg-surface-container-low p-space-sm rounded-lg border border-surface-container-highest space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-outline uppercase">Qualifying Period 1 (Sleeper)</span>
              <span className="font-telemetry-metric text-[14px] text-primary">{splitPeriod1.toFixed(1)} Hours</span>
            </div>
            <input
              type="range"
              min="7.0"
              max="10.0"
              step="0.1"
              value={splitPeriod1}
              onChange={(e) => setSplitPeriod1(parseFloat(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <span className="text-[10px] text-outline block">
              Minimum 7.0 consecutive hours in sleeper berth
            </span>
          </div>

          <div className="bg-surface-container-low p-space-sm rounded-lg border border-surface-container-highest space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-outline uppercase">Qualifying Period 2 (Rest/Berth)</span>
              <span className="font-telemetry-metric text-[14px] text-primary">{splitPeriod2.toFixed(1)} Hours</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="3.0"
              step="0.1"
              value={splitPeriod2}
              onChange={(e) => setSplitPeriod2(parseFloat(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <span className="text-[10px] text-outline block">
              Minimum 2.0 consecutive hours (Total combined ≥ 10.0h)
            </span>
          </div>
        </div>

        {/* Results Banner */}
        <div className="bg-surface-container-lowest p-space-sm rounded-lg border border-primary/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              verified
            </span>
            <div className="text-[11px]">
              <span className="text-primary font-bold block">
                Total Rest: {(splitPeriod1 + splitPeriod2).toFixed(1)} Hours (Qualifying Pair)
              </span>
              <span className="text-outline">
                Pauses the 14-Hour window by {splitPeriod1.toFixed(1)} hours without violating shift limits.
              </span>
            </div>
          </div>
          <button
            onClick={() => onShowToast('SPLIT REST COMPUTATION LOCKED TO ACTIVE RECORD')}
            className="px-3 py-1.5 bg-primary text-on-primary font-label-caps text-[10px] font-bold uppercase rounded cursor-pointer hover:brightness-110 active:scale-95"
          >
            Apply
          </button>
        </div>
      </div>

      {/* 8-Day Rolling Recap Table */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-space-sm">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold">
            8-Day Rolling Hours Recap &amp; Midnight Forecast
          </span>
          <span className="font-telemetry-label text-[10px] text-outline">
            70H / 8-DAY CYCLE
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-surface-container-highest text-outline">
                <th className="py-1.5 px-2">Shift Date</th>
                <th className="py-1.5 px-2">Drive</th>
                <th className="py-1.5 px-2">On-Duty Total</th>
                <th className="py-1.5 px-2">70h Cumulative</th>
                <th className="py-1.5 px-2">Gain at 00:00</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-highest/60 text-on-surface">
              <tr className="bg-primary/5 font-bold">
                <td className="py-1.5 px-2 text-primary">Today (03/13)</td>
                <td className="py-1.5 px-2">04h 16m</td>
                <td className="py-1.5 px-2">08h 29m</td>
                <td className="py-1.5 px-2 text-primary">37h 45m Used</td>
                <td className="py-1.5 px-2 text-primary">+08h 55m</td>
              </tr>
              <tr>
                <td className="py-1.5 px-2 text-outline">Wed 03/12</td>
                <td className="py-1.5 px-2">08h 42m</td>
                <td className="py-1.5 px-2">09h 55m</td>
                <td className="py-1.5 px-2">29h 16m</td>
                <td className="py-1.5 px-2 text-outline">+07h 15m</td>
              </tr>
              <tr>
                <td className="py-1.5 px-2 text-outline">Tue 03/11</td>
                <td className="py-1.5 px-2">07h 15m</td>
                <td className="py-1.5 px-2">08h 40m</td>
                <td className="py-1.5 px-2">19h 21m</td>
                <td className="py-1.5 px-2 text-outline">+09h 10m</td>
              </tr>
              <tr>
                <td className="py-1.5 px-2 text-outline">Mon 03/10</td>
                <td className="py-1.5 px-2">09h 10m</td>
                <td className="py-1.5 px-2">10h 30m</td>
                <td className="py-1.5 px-2">10h 41m</td>
                <td className="py-1.5 px-2 text-outline">+02h 30m</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
