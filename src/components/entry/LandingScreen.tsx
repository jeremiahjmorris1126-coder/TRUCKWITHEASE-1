import React from 'react';

interface LandingScreenProps {
  onSignIn: () => void;
  onGetStarted: () => void;
}

const POINTS = [
  { icon: 'local_parking', text: 'Live truck parking where states report it' },
  { icon: 'scale', text: 'Enroll in weigh station bypass' },
  { icon: 'route', text: 'Loads, dispatch and documents in one place' },
];

export const LandingScreen: React.FC<LandingScreenProps> = ({ onSignIn, onGetStarted }) => (
  <div className="min-h-screen bg-black text-[#FFE500] flex flex-col">
    <main className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto px-6 py-12 space-y-10">
      <div className="space-y-3">
        <span className="material-symbols-outlined text-[44px]">local_shipping</span>
        <h1 className="text-4xl font-black uppercase tracking-wide leading-tight">TruckWithEase</h1>
        <p className="text-[#FFE500]/75 text-base">Everything a driver and fleet needs on the road. Simple, in one app.</p>
      </div>

      <ul className="space-y-3">
        {POINTS.map((p) => (
          <li key={p.icon} className="flex items-center gap-3 text-sm">
            <span className="material-symbols-outlined text-[22px]">{p.icon}</span>
            <span className="text-[#FFE500]/90">{p.text}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <button
          onClick={onGetStarted}
          className="w-full py-3.5 rounded-lg bg-[#FFE500] text-black font-black uppercase tracking-wider cursor-pointer hover:brightness-110"
        >
          Get Started
        </button>
        <button
          onClick={onSignIn}
          className="w-full py-3.5 rounded-lg border border-[#FFE500] text-[#FFE500] font-bold uppercase tracking-wider cursor-pointer hover:bg-[#FFE500]/10"
        >
          Sign In
        </button>
      </div>
    </main>
  </div>
);
