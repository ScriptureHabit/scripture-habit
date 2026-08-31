/**
 * Monkey-patches DOM Node methods to prevent React reconciliation crashes
 * caused by external DOM mutations (e.g., Google Translate, browser extensions,
 * or translation features on mobile browsers wrapping text nodes in <font> tags).
 *
 * Without this patch, when React calls `hostParent.removeChild(deletedFiber.stateNode)`
 * or `hostParent.insertBefore(...)`, standard DOM throws:
 * "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
 */
export function applyDomReconciliationPolyfill(): void {
  if (typeof window === 'undefined' || typeof Node === 'undefined' || !Node.prototype) {
    return;
  }

  const nodeProto = Node.prototype as unknown as {
    __reconciliation_patched__?: boolean;
    removeChild: <T extends Node>(child: T) => T;
    insertBefore: <T extends Node>(newNode: T, referenceNode: Node | null) => T;
    replaceChild: <T extends Node>(newChild: Node, oldChild: T) => T;
  };

  // Prevent double application
  if (nodeProto.__reconciliation_patched__) {
    return;
  }
  nodeProto.__reconciliation_patched__ = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (!child) {
      return child;
    }

    if (child.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[DOM Polyfill] Suppressed removeChild error: Node is not a child of target parent. Delegating to actual parent.',
          { targetParent: this, actualParent: child.parentNode, child }
        );
      }
      if (child.parentNode) {
        try {
          return child.parentNode.removeChild(child) as T;
        } catch {
          // If removal from actual parent also fails, safely suppress
          return child;
        }
      }
      return child;
    }

    try {
      return originalRemoveChild.call(this, child) as T;
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[DOM Polyfill] Suppressed native removeChild error:', error);
      }
      if (child.parentNode && child.parentNode !== this) {
        try {
          return child.parentNode.removeChild(child) as T;
        } catch {
          return child;
        }
      }
      return child;
    }
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (!newNode) {
      return newNode;
    }

    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[DOM Polyfill] Suppressed insertBefore error: Reference node is not a child of target parent. Delegating to actual parent.',
          { targetParent: this, actualParent: referenceNode.parentNode, referenceNode }
        );
      }
      if (referenceNode.parentNode) {
        try {
          return referenceNode.parentNode.insertBefore(newNode, referenceNode) as T;
        } catch {
          // Fall through to append or insert on target parent
        }
      }
      try {
        return originalInsertBefore.call(this, newNode, null) as T;
      } catch {
        try {
          return this.appendChild(newNode) as T;
        } catch {
          return newNode;
        }
      }
    }

    try {
      return originalInsertBefore.call(this, newNode, referenceNode) as T;
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[DOM Polyfill] Suppressed native insertBefore error:', error);
      }
      try {
        return originalInsertBefore.call(this, newNode, null) as T;
      } catch {
        try {
          return this.appendChild(newNode) as T;
        } catch {
          return newNode;
        }
      }
    }
  };

  const originalReplaceChild = Node.prototype.replaceChild;
  Node.prototype.replaceChild = function <T extends Node>(newChild: Node, oldChild: T): T {
    if (!newChild || !oldChild) {
      return oldChild;
    }

    if (oldChild.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[DOM Polyfill] Suppressed replaceChild error: Old node is not a child of target parent. Delegating to actual parent.',
          { targetParent: this, actualParent: oldChild.parentNode, oldChild }
        );
      }
      if (oldChild.parentNode) {
        try {
          return oldChild.parentNode.replaceChild(newChild, oldChild) as T;
        } catch {
          // Fall through
        }
      }
      try {
        return this.appendChild(newChild) as unknown as T;
      } catch {
        return oldChild;
      }
    }

    try {
      return originalReplaceChild.call(this, newChild, oldChild) as T;
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[DOM Polyfill] Suppressed native replaceChild error:', error);
      }
      try {
        return this.appendChild(newChild) as unknown as T;
      } catch {
        return oldChild;
      }
    }
  };
}

// Auto-apply on import if in browser environment
if (typeof window !== 'undefined') {
  applyDomReconciliationPolyfill();
}
