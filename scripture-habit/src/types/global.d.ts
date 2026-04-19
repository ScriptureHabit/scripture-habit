export {};

declare global {
  interface Window {
    deferredPWAPrompt: BeforeInstallPromptEvent | null;
  }
  
  interface Navigator {
    standalone?: boolean;
  }
  
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
      outcome: 'accepted' | 'dismissed';
      platform: string;
    }>;
    prompt(): Promise<void>;
  }
}
