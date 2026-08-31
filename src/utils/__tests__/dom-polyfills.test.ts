import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyDomReconciliationPolyfill } from '../dom-polyfills';

describe('dom-polyfills', () => {
  beforeEach(() => {
    applyDomReconciliationPolyfill();
  });

  describe('removeChild polyfill', () => {
    it('removes a standard child normally', () => {
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);

      expect(parent.contains(child)).toBe(true);
      const result = parent.removeChild(child);
      expect(result).toBe(child);
      expect(parent.contains(child)).toBe(false);
    });

    it('gracefully handles and delegates removal when child was reparented (e.g. by Google Translate)', () => {
      const originalParent = document.createElement('div');
      const wrapperParent = document.createElement('font'); // simulating Google Translate wrapping
      const child = document.createElement('span');

      originalParent.appendChild(wrapperParent);
      wrapperParent.appendChild(child);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Calling removeChild on originalParent where child is now inside wrapperParent
      expect(() => {
        const removed = originalParent.removeChild(child);
        expect(removed).toBe(child);
      }).not.toThrow();

      expect(wrapperParent.contains(child)).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('does not throw when child has already been detached', () => {
      const parent = document.createElement('div');
      const detachedChild = document.createElement('span');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        const result = parent.removeChild(detachedChild);
        expect(result).toBe(detachedChild);
      }).not.toThrow();

      warnSpy.mockRestore();
    });

    it('suppresses errors when native removeChild throws DOMException (e.g. child not found in internal C++ tree)', () => {
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Force a situation where native removeChild would fail (simulate internal inconsistency)
      const fakeChild = {
        parentNode: parent,
      } as unknown as Node;

      expect(() => {
        const result = parent.removeChild(fakeChild);
        expect(result).toBe(fakeChild);
      }).not.toThrow();

      warnSpy.mockRestore();
    });

    it('handles null/undefined child gracefully', () => {
      const parent = document.createElement('div');
      expect(parent.removeChild(null as unknown as Node)).toBe(null);
    });
  });

  describe('insertBefore polyfill', () => {
    it('inserts a node normally before a reference child', () => {
      const parent = document.createElement('div');
      const refChild = document.createElement('span');
      const newChild = document.createElement('p');
      parent.appendChild(refChild);

      const result = parent.insertBefore(newChild, refChild);
      expect(result).toBe(newChild);
      expect(parent.firstChild).toBe(newChild);
    });

    it('gracefully handles insertBefore when referenceNode was reparented', () => {
      const originalParent = document.createElement('div');
      const wrapperParent = document.createElement('font');
      const refChild = document.createElement('span');
      const newChild = document.createElement('p');

      originalParent.appendChild(wrapperParent);
      wrapperParent.appendChild(refChild);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        originalParent.insertBefore(newChild, refChild);
      }).not.toThrow();

      expect(wrapperParent.contains(newChild)).toBe(true);
      warnSpy.mockRestore();
    });

    it('falls back to appending when referenceNode is detached or native insertBefore fails', () => {
      const parent = document.createElement('div');
      const detachedRef = document.createElement('span');
      const newChild = document.createElement('p');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        parent.insertBefore(newChild, detachedRef);
      }).not.toThrow();

      expect(parent.contains(newChild)).toBe(true);
      warnSpy.mockRestore();
    });

    it('handles null/undefined newNode gracefully', () => {
      const parent = document.createElement('div');
      expect(parent.insertBefore(null as unknown as Node, null)).toBe(null);
    });
  });

  describe('replaceChild polyfill', () => {
    it('replaces a standard child normally', () => {
      const parent = document.createElement('div');
      const oldChild = document.createElement('span');
      const newChild = document.createElement('p');
      parent.appendChild(oldChild);

      const result = parent.replaceChild(newChild, oldChild);
      expect(result).toBe(oldChild);
      expect(parent.contains(newChild)).toBe(true);
      expect(parent.contains(oldChild)).toBe(false);
    });

    it('handles reparented oldChild without throwing', () => {
      const originalParent = document.createElement('div');
      const wrapperParent = document.createElement('font');
      const oldChild = document.createElement('span');
      const newChild = document.createElement('p');

      originalParent.appendChild(wrapperParent);
      wrapperParent.appendChild(oldChild);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        originalParent.replaceChild(newChild, oldChild);
      }).not.toThrow();

      warnSpy.mockRestore();
    });

    it('handles native replaceChild failure without throwing', () => {
      const parent = document.createElement('div');
      const detachedOld = document.createElement('span');
      const newChild = document.createElement('p');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        parent.replaceChild(newChild, detachedOld);
      }).not.toThrow();

      warnSpy.mockRestore();
    });
  });
});
