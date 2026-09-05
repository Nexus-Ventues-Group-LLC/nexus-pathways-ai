import { ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Redirect } from 'wouter';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  requiredPermissions?: string[];
}

export function ProtectedRoute({ children, allowedRoles, requiredPermissions }: ProtectedRouteProps) {
  const { isLoaded, userId } = useAuth();
  
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userId) {
    return <Redirect to="/sign-in" />;
  }

  return <CurrentUserGuard allowedRoles={allowedRoles} requiredPermissions={requiredPermissions}>{children}</CurrentUserGuard>;
}

function CurrentUserGuard({ children, allowedRoles, requiredPermissions }: ProtectedRouteProps) {
  const { data: user, isLoading, error } = useGetCurrentUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse text-sm">Loading your context...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Authentication Error</AlertTitle>
          <AlertDescription>
            We could not load your user profile. Please try signing out and signing back in.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return <Redirect to="/unauthorized" />;
    }
  }
  if (requiredPermissions?.some((permission) => !user.permissions.includes(permission))) {
    return <Redirect to="/unauthorized" />;
  }

  return <>{children}</>;
}
