import React from 'react';
import { RouteWeatherHudWidget } from './RouteWeatherHudWidget';

export interface MiniWeatherWidgetProps {
  onShowToast?: (msg: string, icon?: string) => void;
}

export const MiniWeatherWidget: React.FC<MiniWeatherWidgetProps> = ({ onShowToast }) => {
  return <RouteWeatherHudWidget onShowToast={onShowToast} />;
};
