import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

import LandingPage from '@/pages/landing';
import SignInPage from '@/pages/auth/sign-in';
import SignUpPage from '@/pages/auth/sign-up';
import LearnerPortal from '@/pages/learner-portal';
import LearnerResources from '@/pages/learner/resources';
import LearnerAccessibility from '@/pages/learner/accessibility';
import LearnerResourceDetail from '@/pages/learner/resource-detail';
import EducatorPortal from '@/pages/educator-portal';
import AdminPortal from '@/pages/administrator/overview';
import AdminFacilities from '@/pages/administrator/facilities';
import AdminPrograms from '@/pages/administrator/programs';
import AdminSettings from '@/pages/administrator/settings';
import AdminAudit from '@/pages/administrator/audit';
import Unauthorized from '@/pages/unauthorized';
import NotFound from '@/pages/not-found';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { PortalLayout } from '@/components/layout/portal-layout';
import { LearnerBootstrap } from '@/components/learner/learner-bootstrap';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_c3VwZXItbWVkdXNhLTQ1LmNsZXJrLmFjY291bnRzLmRldiQ";

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
        
        {/* Learner Portal Routes */}
        <Route path="/learner" nest>
          <ProtectedRoute allowedRoles={['learner']}>
            <PortalLayout>
              <LearnerBootstrap>
                <Switch>
                  <Route path="/" component={LearnerPortal} />
                  <Route path="/resources" component={LearnerResources} />
                  <Route path="/resources/:slug" component={LearnerResourceDetail} />
                  <Route path="/accessibility" component={LearnerAccessibility} />
                  <Route component={NotFound} />
                </Switch>
              </LearnerBootstrap>
            </PortalLayout>
          </ProtectedRoute>
        </Route>

        {/* Educator Portal Routes */}
        <Route path="/educator" nest>
          <ProtectedRoute allowedRoles={['educator', 'administrator']}>
            <PortalLayout>
              <Switch>
                <Route path="/" component={EducatorPortal} />
                <Route component={NotFound} />
              </Switch>
            </PortalLayout>
          </ProtectedRoute>
        </Route>

        {/* Administrator Portal Routes */}
        <Route path="/administrator" nest>
          <ProtectedRoute allowedRoles={['administrator']}>
            <PortalLayout>
              <Switch>
                <Route path="/">
                  <ProtectedRoute requiredPermissions={['admin.overview']}><AdminPortal /></ProtectedRoute>
                </Route>
                <Route path="/facilities">
                  <ProtectedRoute requiredPermissions={['admin.hierarchy.manage']}><AdminFacilities /></ProtectedRoute>
                </Route>
                <Route path="/programs">
                  <ProtectedRoute requiredPermissions={['admin.hierarchy.manage']}><AdminPrograms /></ProtectedRoute>
                </Route>
                <Route path="/settings">
                  <ProtectedRoute requiredPermissions={['tenant.configuration.manage']}><AdminSettings /></ProtectedRoute>
                </Route>
                <Route path="/audit">
                  <ProtectedRoute requiredPermissions={['audit.read']}><AdminAudit /></ProtectedRoute>
                </Route>
                <Route component={NotFound} />
              </Switch>
            </PortalLayout>
          </ProtectedRoute>
        </Route>

        <Route path="/unauthorized" component={Unauthorized} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AuthScopedCache({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const scopedUserId = userId ?? null;
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null>(scopedUserId);
  const [readyUserId, setReadyUserId] = useState<string | null>(scopedUserId);

  useEffect(() => {
    if (!isLoaded || previousUserId.current === scopedUserId) return;
    previousUserId.current = scopedUserId;
    void queryClient.cancelQueries();
    queryClient.clear();
    setReadyUserId(scopedUserId);
  }, [isLoaded, queryClient, scopedUserId]);

  if (!isLoaded || readyUserId !== scopedUserId) return null;
  return <>{children}</>;
}

export default function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthScopedCache>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
          </AuthScopedCache>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}