import React from 'react';
import { FirebaseDeploymentModal } from './FirebaseDeploymentModal';

export const AntigravityExportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, icon?: string) => void;
}> = ({ isOpen, onClose, onShowToast }) => {
  return <FirebaseDeploymentModal isOpen={isOpen} onClose={onClose} onShowToast={onShowToast} />;
};

export default AntigravityExportModal;
