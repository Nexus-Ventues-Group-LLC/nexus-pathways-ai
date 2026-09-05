import { useListAuditEvents } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function AdminAudit() {
  const { data: events, isLoading } = useListAuditEvents({ limit: 100 });

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center h-full items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!events) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardHeader><CardTitle className="text-destructive">Data Unavailable</CardTitle></CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-primary">Audit Events</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Security and administrative actions visible in your authorized scope.
          </p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle>Event History</CardTitle>
          <CardDescription>Recent changes and security access records</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No recent audit events found.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {format(new Date(event.createdAt), 'MMM d, yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {event.actorDisplayName}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{event.action}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {event.resourceType || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {event.category}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}