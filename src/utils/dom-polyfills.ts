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
        return child.parentNode.removeChild(child) as T;
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
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
        return referenceNode.parentNode.insertBefore(newNode, referenceNode) as T;
      }
      return originalInsertBefore.call(this, newNode, null) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

// Auto-apply on import if in browser environment
if (typeof window !== 'undefined') {
  applyDomReconciliationPolyfill();
}
