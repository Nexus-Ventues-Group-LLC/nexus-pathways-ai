import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ClerkProvider } from '@clerk/clerk-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

import LandingPage from '@/pages/landing';
import SignInPage from '@/pages/auth/sign-in';
import SignUpPage from '@/pages/auth/sign-up';
import LearnerPortal from '@/pages/learner-portal';
import EducatorPortal from '@/pages/educator-portal';
import AdminPortal from '@/pages/admin-portal';
import Unauthorized from '@/pages/unauthorized';
import NotFound from '@/pages/not-found';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { PortalLayout } from '@/components/layout/portal-layout';

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
              <Switch>
                <Route path="/" component={LearnerPortal} />
                <Route component={NotFound} />
              </Switch>
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
                <Route path="/" component={AdminPortal} />
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

export default function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}