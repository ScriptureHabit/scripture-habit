import type { CSSProperties } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  zIndex: 2000,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '16px'
};

const contentStyle: CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  backgroundColor: '#fff',
  borderRadius: '16px',
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.18)',
  padding: '24px',
  color: '#111',
  textAlign: 'left'
};

const buttonGroupStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  marginTop: '20px'
};

const actionButtonStyle: CSSProperties = {
  minWidth: '96px',
  height: '40px',
  borderRadius: '999px',
  border: '1px solid rgba(0, 0, 0, 0.1)',
  cursor: 'pointer',
  fontWeight: 600,
  backgroundColor: '#fff'
};

const primaryButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  backgroundColor: '#2563eb',
  color: '#fff',
  borderColor: '#2563eb'
};

const ConfirmModal = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel
}: ConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, marginBottom: '12px', fontSize: '1.15rem' }}>{title}</h3>
        <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.6 }}>{description}</p>
        <div style={buttonGroupStyle}>
          <button type="button" style={actionButtonStyle} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" style={primaryButtonStyle} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
