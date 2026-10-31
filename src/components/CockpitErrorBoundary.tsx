/**
 * TruckWithEase // Cockpit Safety Error Boundary
 *
 * Prevents "white screen of death" crashes during transit.
 * If an unhandled React error occurs in any cockpit screen or widget,
 * this component intercepts it, logs a structured error with correlation trace,
 * and presents a high-visibility tactical HUD recovery display.
 *
 * Adheres strictly to TruckWithEase Directives:
 * - Deep Obsidian (#05080E) cockpit surface
 * - High-visibility Safety Yellow (#FFE500) action buttons
 * - Luminous warning borders
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger.ts';
import { CockpitRenderError, generateCorrelationId } from '../utils/errors.ts';

interface Props {
  children: ReactNode;
  fallbackScreen?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  correlationId: string;
  componentStack?: string;
}

export class CockpitErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    correlationId: generateCorrelationId(),
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      correlationId: generateCorrelationId(),
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const renderError = new CockpitRenderError(
      this.props.fallbackScreen || 'CockpitHUD',
      error
    );

    this.setState({ componentStack: errorInfo.componentStack || undefined });

    // Structured logging with component stack and correlation trace
    logger.error(
      'COCKPIT_UI',
      `Unhandled React component fault in ${this.props.fallbackScreen || 'Root Cockpit'}: ${error.message}`,
      renderError,
      {
        correlationId: this.state.correlationId,
        screen: this.props.fallbackScreen || 'Root',
        componentStackSnippet: errorInfo.componentStack?.slice(0, 300),
      }
    );
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      correlationId: generateCorrelationId(),
    });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.hash = '#night-hud';
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#05080E] text-white flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="w-full max-w-2xl bg-[#0A0F14] border-2 border-[#EF4444] rounded-xl p-6 shadow-[0_0_35px_rgba(239,68,68,0.35)] relative overflow-hidden">
            {/* Top Tactical Status Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3 rounded-full bg-[#EF4444] animate-ping" />
                <span className="font-mono text-xs uppercase tracking-widest text-[#EF4444] font-bold">
                  COCKPIT SUBSYSTEM ISOLATION ENGAGED
                </span>
              </div>
              <span className="font-mono text-[11px] text-gray-500">
                REF: {this.state.correlationId}
              </span>
            </div>

            {/* Chamfered Alert Box */}
            <div className="bg-[#1a080a] border border-[#EF4444]/60 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#EF4444] text-3xl">
                  warning
                </span>
                <div>
                  <h2 className="text-lg font-black tracking-wide text-white uppercase mb-1">
                    Telemetry Display Fault Recovered
                  </h2>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    An interface rendering interruption was captured. CAN-Bus telematics, HOS compliance clocks, and low-bridge proximity radars continue running safely in the core background engine.
                  </p>
                </div>
              </div>
            </div>

            {/* Diagnostic Code Callout */}
            <div className="bg-[#05080E] border border-gray-800 rounded p-3 mb-6 font-mono text-xs text-gray-400">
              <div className="flex justify-between text-gray-500 mb-1">
                <span>FAULT CODE</span>
                <span>E_SYS_RENDER_CRASH</span>
              </div>
              <div className="text-amber-400 truncate">
                {this.state.error?.message || 'Component tree rendering exception'}
              </div>
            </div>

            {/* Tactical Yellow Action Controls */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 bg-[#FFE500] hover:bg-[#FFDF00] text-black font-black uppercase tracking-wider py-3.5 px-6 rounded-lg text-sm transition-all shadow-[0_0_20px_rgba(255,229,0,0.45)] flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <span>&gt;&gt; REINITIALIZE COCKPIT SUBSYSTEM</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold uppercase tracking-wider py-3.5 px-5 rounded-lg text-xs transition-colors border border-gray-700 cursor-pointer"
              >
                FULL SYSTEM REBOOT
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
