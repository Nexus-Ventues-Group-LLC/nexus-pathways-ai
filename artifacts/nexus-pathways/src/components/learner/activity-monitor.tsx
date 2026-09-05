import { useEffect, useRef, useCallback, useState } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { useRecordLearnerActivity, useGetLearnerHome } from '@workspace/api-client-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function LearnerActivityMonitor() {
  const { data: home, isLoading } = useGetLearnerHome();
  const { mutate: recordActivity } = useRecordLearnerActivity();
  const { signOut } = useClerk();
  
  const [showWarning, setShowWarning] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartedAtRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update last activity timestamp on user interaction
  const handleInteraction = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
      // Immediately notify server that we are back active
      recordActivity();
    }
  }, [showWarning, recordActivity]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    
    // Throttle mousemove to avoid excessive updates to ref
    let throttleTimer: NodeJS.Timeout | null = null;
    const throttledInteraction = (e: Event) => {
      if (e.type === 'mousemove') {
        if (!throttleTimer) {
          throttleTimer = setTimeout(() => {
            handleInteraction();
            throttleTimer = null;
          }, 1000);
        }
      } else {
        handleInteraction();
      }
    };

    events.forEach(e => document.addEventListener(e, throttledInteraction, { passive: true }));
    return () => {
      events.forEach(e => document.removeEventListener(e, throttledInteraction));
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [handleInteraction]);

  useEffect(() => {
    if (!home?.activity || isLoading) return;
    
    const { inactivityTimeoutMinutes, sessionTimeoutMinutes } = home.activity;
    
    // Check every 30 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      const inactivityMs = inactivityTimeoutMinutes * 60 * 1000;
      const sessionMs = sessionTimeoutMinutes * 60 * 1000;
      const timeSinceSessionStart = now - sessionStartedAtRef.current;
      const timeUntilExpiry = Math.min(
        inactivityMs - timeSinceLastActivity,
        sessionMs - timeSinceSessionStart,
      );
      const warningWindowMs = Math.min(60000, Math.max(10000, Math.min(inactivityMs, sessionMs) * 0.2));
      
      if (timeUntilExpiry <= 0) {
        void signOut();
      } else if (timeUntilExpiry <= warningWindowMs && !showWarning) {
        setShowWarning(true);
      }
    }, 30000);
    
    timerRef.current = interval;
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [home?.activity, isLoading, showWarning, signOut]);

  // Periodic heartbeat
  useEffect(() => {
    if (!home?.activity) return;

    recordActivity();
    
    const heartbeat = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      // Only heartbeat if user was active in the last 5 minutes
      if (timeSinceLastActivity < 5 * 60 * 1000) {
        recordActivity();
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(heartbeat);
  }, [home?.activity, recordActivity]);

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you still there?</AlertDialogTitle>
          <AlertDialogDescription>
            For your security, your session will expire soon. Continue to remain signed in when the
            inactivity limit allows it. The institution's maximum session limit cannot be extended.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => {
             handleInteraction();
             recordActivity();
          }}>
            Continue Learning
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
