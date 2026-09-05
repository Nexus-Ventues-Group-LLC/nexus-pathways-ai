import { useGetDashboard } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, FileText, CheckCircle, BarChart3, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EducatorPortal() {
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
      <div className="p-8 flex justify-center">
        <Card className="border-destructive w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-destructive">Dashboard Unavailable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">We couldn't retrieve your educator dashboard. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const icons = [Users, FileText, CheckCircle, BarChart3];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-primary">{dashboard.headline}</h1>
          <p className="text-muted-foreground">
            Educator overview for {dashboard.scope.organization.name}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">View Reports</Button>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Assessment
          </Button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {dashboard.metrics.map((metric, i) => {
          const Icon = icons[i % icons.length];
          return (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  {metric.label}
                </CardTitle>
                <Icon className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metric.value}</div>
                {metric.detail && (
                  <p className="text-xs text-muted-foreground mt-1.5">{metric.detail}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-primary/10 bg-primary/5">
          <CardHeader>
            <CardTitle>Active Capabilities</CardTitle>
            <CardDescription>Your configured permissions for this scope</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              {dashboard.capabilities.map((cap, i) => (
                <div key={i} className="flex items-start gap-3 bg-background p-4 rounded-lg border shadow-sm">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm font-medium">{cap}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scope Context</CardTitle>
            <CardDescription>Your current assignment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Organization</span>
                <span className="text-sm font-medium">{dashboard.scope.organization?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Agency</span>
                <span className="text-sm font-medium">{dashboard.scope.agency?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Facility</span>
                <span className="text-sm font-medium">{dashboard.scope.facility?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Program</span>
                <span className="text-sm font-medium">{dashboard.scope.program?.name || 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}