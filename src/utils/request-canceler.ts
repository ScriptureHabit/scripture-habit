/**
 * Manager for automatically canceling in-flight GET requests on route transitions.
 * Mutation requests (POST, PUT, DELETE, PATCH) are intentionally excluded to protect data integrity.
 */

class RequestCanceler {
  private abortController: AbortController = new AbortController();

  /**
   * Returns the current AbortSignal for cancelable GET requests.
   */
  public getSignal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Aborts all currently pending cancelable GET requests and resets the controller.
   * Call this on route change (e.g. React Router pathname change).
   */
  public cancelPendingGetRequests(reason: string = 'ROUTE_CHANGE'): void {
    // Only abort if not already aborted
    if (!this.abortController.signal.aborted) {
      this.abortController.abort(reason);
    }
    // Create a new controller for the next route's requests
    this.abortController = new AbortController();
  }
}

export const requestCanceler = new RequestCanceler();
