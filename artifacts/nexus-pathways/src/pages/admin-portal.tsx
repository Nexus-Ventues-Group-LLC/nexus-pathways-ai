import { useGetAdminOverview, useListAuditEvents } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck, Database, Building, GraduationCap, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

export default function AdminPortal() {
  const { data: overview, isLoading: isLoadingOverview } = useGetAdminOverview();
  const { data: events, isLoading: isLoadingEvents } = useListAuditEvents({ limit: 10 });

  if (isLoadingOverview) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Admin Data Unavailable</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              <ShieldCheck className="w-3 h-3 mr-1" /> Admin Override Active
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Organizational Overview</h1>
          <p className="text-muted-foreground mt-1">
            Managing hierarchy and security context for {overview.organization.name}.
          </p>
        </div>
        {overview.syntheticDataNotice && (
          <div className="text-sm px-3 py-1.5 bg-accent/10 text-accent-foreground border border-accent/20 rounded-md flex items-center gap-2">
            <Database className="w-4 h-4" />
            {overview.syntheticDataNotice}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard title="Agencies" value={overview.agencies} icon={Building} />
        <MetricCard title="Regions" value={overview.regions} icon={Building} />
        <MetricCard title="Facilities" value={overview.facilities} icon={Building} />
        <MetricCard title="Programs" value={overview.programs} icon={GraduationCap} />
        <MetricCard title="Cohorts" value={overview.cohorts} icon={Users} />
        <MetricCard title="Total Users" value={overview.learners + overview.educators} icon={Users} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Audit Events</CardTitle>
            <CardDescription>Security and administrative actions in your scope</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingEvents ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !events || events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No recent audit events found.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Outcome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {format(new Date(event.createdAt), 'MMM d, HH:mm')}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {event.actorDisplayName}
                        </TableCell>
                        <TableCell className="text-sm">{event.action}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {event.resourceType || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={event.outcome === 'success' ? 'default' : 'destructive'}
                            className={event.outcome === 'success' ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-0' : ''}
                          >
                            {event.outcome}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hierarchy Structure</CardTitle>
            <CardDescription>Tenant distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Learners</span>
                  <span className="font-bold">{overview.learners}</span>
                </div>
                <div className="w-full bg-border rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '70%' }} />
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Educators</span>
                  <span className="font-bold">{overview.educators}</span>
                </div>
                <div className="w-full bg-border rounded-full h-2">
                  <div className="bg-accent h-2 rounded-full" style={{ width: '30%' }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon }: { title: string, value: number, icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-primary/50" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}