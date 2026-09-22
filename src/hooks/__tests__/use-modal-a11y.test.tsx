import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useRef, useState } from 'react';
import { useModalA11y } from '../use-modal-a11y';

const TestModalComponent = ({
  isOpen,
  onClose,
  useCustomInitialFocus = false
}: {
  isOpen: boolean;
  onClose: () => void;
  useCustomInitialFocus?: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useModalA11y({
    isOpen,
    onClose,
    containerRef,
    initialFocusRef: useCustomInitialFocus ? cancelBtnRef : undefined
  });

  if (!isOpen) return null;

  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      <button data-testid="first-btn">First</button>
      <input data-testid="input-field" type="text" />
      <button ref={cancelBtnRef} data-testid="cancel-btn">Cancel</button>
      <button data-testid="confirm-btn">Confirm</button>
    </div>
  );
};

describe('useModalA11y Hook', () => {
  it('focuses first focusable element by default when opened', () => {
    render(<TestModalComponent isOpen={true} onClose={vi.fn()} />);

    const firstBtn = screen.getByTestId('first-btn');
    expect(document.activeElement).toBe(firstBtn);
  });

  it('focuses initialFocusRef element when provided', () => {
    render(<TestModalComponent isOpen={true} onClose={vi.fn()} useCustomInitialFocus={true} />);

    const cancelBtn = screen.getByTestId('cancel-btn');
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<TestModalComponent isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus inside the modal on Tab and Shift+Tab', () => {
    render(<TestModalComponent isOpen={true} onClose={vi.fn()} />);

    const firstBtn = screen.getByTestId('first-btn');
    const confirmBtn = screen.getByTestId('confirm-btn');

    // Currently at first element, Shift+Tab should cycle to last element
    expect(document.activeElement).toBe(firstBtn);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmBtn);

    // At last element, Tab should cycle back to first element
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(firstBtn);
  });

  it('restores focus to previously active element on unmount / close', () => {
    const TestWrapper = () => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          <button data-testid="trigger-btn" onClick={() => setIsOpen(true)}>
            Open
          </button>
          <TestModalComponent isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </div>
      );
    };

    render(<TestWrapper />);
    const triggerBtn = screen.getByTestId('trigger-btn');
    triggerBtn.focus();
    expect(document.activeElement).toBe(triggerBtn);

    // Open modal
    fireEvent.click(triggerBtn);
    expect(document.activeElement).toBe(screen.getByTestId('first-btn'));

    // Close modal via Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.activeElement).toBe(triggerBtn);
  });

  it('does not steal focus back to initialFocus when parent re-renders with an inline onClose callback while typing', () => {
    const ControlledFormModal = () => {
      const [isOpen, setIsOpen] = useState(true);
      const [text, setText] = useState('');
      const containerRef = useRef<HTMLDivElement>(null);
      const cancelBtnRef = useRef<HTMLButtonElement>(null);

      // Pass inline callback for onClose (creates new reference every render)
      useModalA11y({
        isOpen,
        onClose: () => setIsOpen(false),
        containerRef,
        initialFocusRef: cancelBtnRef
      });

      if (!isOpen) return null;

      return (
        <div ref={containerRef} role="dialog">
          <input
            data-testid="controlled-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button ref={cancelBtnRef} data-testid="cancel-btn">
            Cancel
          </button>
        </div>
      );
    };

    render(<ControlledFormModal />);

    // Initially, Cancel button has focus due to initialFocusRef
    const cancelBtn = screen.getByTestId('cancel-btn');
    expect(document.activeElement).toBe(cancelBtn);

    // User focuses the input field
    const input = screen.getByTestId('controlled-input');
    input.focus();
    expect(document.activeElement).toBe(input);

    // User types into the input, causing a re-render with a new onClose callback
    fireEvent.change(input, { target: { value: 'a' } });

    // Focus must REMAIN on the input and NOT be stolen by the cancel button
    expect(document.activeElement).toBe(input);
  });
});
