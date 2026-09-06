import { ReactNode, useEffect } from 'react';
import { useGetLearnerHome } from '@workspace/api-client-react';
import { LearnerActivityMonitor } from './activity-monitor';
import { Loader2 } from 'lucide-react';

export function LearnerBootstrap({ children }: { children: ReactNode }) {
  const { data: home, isLoading, error } = useGetLearnerHome();

  useEffect(() => {
    if (!home?.presentationPreferences) return;
    
    const root = document.documentElement;
    const prefs = home.presentationPreferences;
    
    if (prefs.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    if (prefs.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    // Handle text size
    root.setAttribute('data-text-size', prefs.textSize);
    
    return () => {
      root.classList.remove('high-contrast', 'reduce-motion');
      root.removeAttribute('data-text-size');
    };
  }, [home?.presentationPreferences]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !home) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="max-w-lg rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
          <h1 className="text-lg font-semibold text-destructive">Your learning space is unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Refresh the page to try again. If the problem continues, ask an authorized staff member for help.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <LearnerActivityMonitor />
      {children}
    </>
  );
}
