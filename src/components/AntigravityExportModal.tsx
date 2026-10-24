import React from 'react';
import { CloudflareDeploymentModal } from './CloudflareDeploymentModal';

export const AntigravityExportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, icon?: string) => void;
}> = ({ isOpen, onClose, onShowToast }) => {
  return <CloudflareDeploymentModal isOpen={isOpen} onClose={onClose} onShowToast={onShowToast} />;
};

export default AntigravityExportModal;
