import { useEffect, useRef, type CSSProperties } from 'react';

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
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // a11y: Escape key, initial focus on Cancel (safety), and Focus Trap
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Default focus to cancel button to prevent accidental confirmation of destructive action
    cancelBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }

      // Focus Trap (cycle within dialog on Tab / Shift+Tab)
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div 
        ref={modalRef}
        style={contentStyle} 
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-description"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-modal-title" style={{ margin: 0, marginBottom: '12px', fontSize: '1.15rem' }}>{title}</h3>
        <p id="confirm-modal-description" style={{ margin: 0, color: '#4b5563', lineHeight: 1.6 }}>{description}</p>
        <div style={buttonGroupStyle}>
          <button 
            ref={cancelBtnRef}
            type="button" 
            style={actionButtonStyle} 
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button 
            type="button" 
            style={primaryButtonStyle} 
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
