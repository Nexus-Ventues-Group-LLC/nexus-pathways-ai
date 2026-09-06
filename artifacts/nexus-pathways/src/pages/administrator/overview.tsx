import { useGetAdminOverview, useGetAdminHierarchy } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck, Database, Building, GraduationCap, Users, Network } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'wouter';

export default function AdminPortal() {
  const { data: overview, isLoading: isLoadingOverview } = useGetAdminOverview();
  const { data: hierarchy, isLoading: isLoadingHierarchy } = useGetAdminHierarchy();

  if (isLoadingOverview || isLoadingHierarchy) {
    return (
      <div className="p-8 flex justify-center h-full items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!overview || !hierarchy) {
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
  const population = overview.learners + overview.educators;
  const learnerShare = population ? (overview.learners / population) * 100 : 0;
  const educatorShare = population ? (overview.educators / population) * 100 : 0;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              <ShieldCheck className="w-3 h-3 mr-1" /> Admin Scope: {overview.organization.name}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Organizational Overview</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Hierarchy visibility and structural insights across authorized regions.
          </p>
        </div>
        {overview.syntheticDataNotice && (
          <div className="text-sm px-3 py-1.5 bg-accent/10 text-accent-foreground border border-accent/20 rounded-md flex items-center gap-2 shadow-sm">
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
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>Topology Map</CardTitle>
                <CardDescription>Your authorized organizational structure</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-6">
                <div className="space-y-6">
                  {hierarchy.agencies.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      No agencies available in your scope.
                    </div>
                  ) : (
                    hierarchy.agencies.map((agency) => (
                      <div key={agency.id} className="border rounded-lg shadow-sm overflow-hidden">
                        <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                          <div className="flex items-center gap-2 font-semibold">
                            <Building className="w-4 h-4 text-primary" />
                            {agency.name}
                          </div>
                          <Badge variant="secondary" className="text-xs font-normal">Agency</Badge>
                        </div>
                        
                        {agency.regions.length > 0 ? (
                          <Accordion type="multiple" className="w-full">
                            {agency.regions.map((region) => (
                              <AccordionItem key={region.id} value={region.id} className="border-b-0 border-t last:border-b-0 px-2">
                                <AccordionTrigger className="hover:no-underline py-3 px-2 text-sm font-medium">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                    {region.name}
                                    <span className="text-xs text-muted-foreground ml-2 font-normal">
                                      ({region.facilities.length} facilities)
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-3 px-6 pt-0">
                                  {region.facilities.length > 0 ? (
                                    <div className="space-y-3 mt-2">
                                      {region.facilities.map((facility) => (
                                        <div key={facility.id} className="p-3 bg-background rounded-md border text-sm flex flex-col gap-2 relative before:absolute before:-left-3 before:top-4 before:w-3 before:h-px before:bg-border">
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium text-foreground">{facility.name}</span>
                                          </div>
                                          {facility.programs.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                              {facility.programs.map(prog => (
                                                <Badge key={prog.id} variant="outline" className="text-xs bg-muted/30 text-muted-foreground border-border">
                                                  {prog.name}
                                                </Badge>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-xs text-muted-foreground italic">No programs</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground italic py-2">No facilities in this region.</div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        ) : (
                          <div className="p-4 text-sm text-muted-foreground">No regions under this agency.</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle>User Demographics</CardTitle>
            <CardDescription>Active population ratios</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-medium">Learners</span>
                  <div className="text-right">
                    <span className="font-bold text-2xl">{overview.learners}</span>
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden shadow-inner">
                  <div className="bg-primary h-full transition-all duration-1000 ease-out" style={{ width: `${learnerShare}%` }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-medium">Educators</span>
                  <div className="text-right">
                    <span className="font-bold text-2xl">{overview.educators}</span>
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden shadow-inner">
                  <div className="bg-accent h-full transition-all duration-1000 ease-out" style={{ width: `${educatorShare}%` }} />
                </div>
              </div>
              
              <div className="pt-6 border-t mt-8">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/administrator/facilities" className="p-3 border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm font-medium">
                    Add Facility
                  </Link>
                  <Link href="/administrator/programs" className="p-3 border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm font-medium">
                    Add Program
                  </Link>
                  <Link href="/administrator/settings" className="p-3 border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm font-medium col-span-2">
                    Review Policies
                  </Link>
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
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className="p-2 bg-primary/5 rounded-md">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}