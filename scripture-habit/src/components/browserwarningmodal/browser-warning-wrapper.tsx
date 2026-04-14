
import React from 'react';
import { useLanguage } from '../../hooks/use-language';
import BrowserWarningModal from './browser-warning-modal';

interface BrowserWarningWrapperProps {
  isOpen: boolean;
  onClose: () => void;
}

const BrowserWarningWrapper: React.FC<BrowserWarningWrapperProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  return (
    <BrowserWarningModal
      isOpen={isOpen}
      onClose={onClose}
      onContinue={onClose}
      t={t}
    />
  );
};

export default BrowserWarningWrapper;


