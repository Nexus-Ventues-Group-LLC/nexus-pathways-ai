import { useGetDashboard } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, BookOpen, Target, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LearnerPortal() {
  const { data: dashboard, isLoading, error } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const icons = [TrendingUp, Target, BookOpen, Clock];

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">{dashboard.headline}</h1>
        <p className="text-muted-foreground">
          Welcome back to your learning journey at {dashboard.scope.organization.name}.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {dashboard.metrics.map((metric, i) => {
          const Icon = icons[i % icons.length];
          return (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.label}
                </CardTitle>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                {metric.detail && (
                  <p className="text-xs text-muted-foreground mt-1">{metric.detail}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Context</CardTitle>
            <CardDescription>Your enrolled program and facility</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">Organization</span>
                <span className="font-medium">{dashboard.scope.organization?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Program</span>
                <span className="font-medium">{dashboard.scope.program?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Cohort</span>
                <span className="font-medium">{dashboard.scope.cohort?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Facility</span>
                <span className="font-medium">{dashboard.scope.facility?.name || 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capabilities</CardTitle>
            <CardDescription>Available actions for your role</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {dashboard.capabilities.map((cap, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <div className="h-6 w-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <ArrowRight className="h-3 w-3 text-accent" />
                  </div>
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Button className="w-full">Continue Pathway</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}