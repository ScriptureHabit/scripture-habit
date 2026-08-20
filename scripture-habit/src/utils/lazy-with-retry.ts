import { lazy, ComponentType } from 'react';

/**
 * Resilient lazy load helper to automatically recover from ChunkLoadErrors / Failed Dynamic Imports
 * caused by new deployments by performing a hard page reload (with infinite loop prevention).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lazyWithRetry = <T extends ComponentType<any>>(componentImport: () => Promise<{ default: T }>) => {
  return lazy(async () => {
    const pageHasBeenReloaded = window.sessionStorage.getItem('page-has-been-reloaded');
    try {
      const component = await componentImport();
      window.sessionStorage.removeItem('page-has-been-reloaded');
      return component;
    } catch (error) {
      if (!pageHasBeenReloaded) {
        window.sessionStorage.setItem('page-has-been-reloaded', 'true');
        console.error("Failed to fetch dynamic module, reloading page to get fresh assets...", error);
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });
};
