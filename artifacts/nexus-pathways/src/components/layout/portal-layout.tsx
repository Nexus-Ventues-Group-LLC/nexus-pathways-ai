import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk } from '@clerk/clerk-react';
import { 
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent
} from '@/components/ui/sidebar';
import { useGetCurrentUser, useHealthCheck } from '@workspace/api-client-react';
import { 
  LogOut, 
  Settings, 
  BookOpen, 
  Users, 
  LayoutDashboard, 
  ShieldAlert, 
  Award,
  BookMarked,
  Activity,
  Building,
  GraduationCap
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface PortalLayoutProps {
  children: ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const { data: user } = useGetCurrentUser();
  const { data: health } = useHealthCheck();
  const { signOut } = useClerk();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const adminLinks = [
    { title: 'Overview', url: '/administrator', icon: LayoutDashboard, permission: 'admin.overview' },
    { title: 'Curriculum', url: '/educator/programs', icon: BookOpen, permission: 'curriculum.manage' },
    { title: 'Facilities', url: '/administrator/facilities', icon: Building, permission: 'admin.hierarchy.manage' },
    { title: 'Programs', url: '/administrator/programs', icon: GraduationCap, permission: 'admin.hierarchy.manage' },
    { title: 'Settings', url: '/administrator/settings', icon: Settings, permission: 'tenant.configuration.manage' },
    { title: 'Audit Events', url: '/administrator/audit', icon: ShieldAlert, permission: 'audit.read' },
  ].filter((item) => user.permissions.includes(item.permission));

  const educatorLinks = [
    { title: 'Dashboard', url: '/educator', icon: LayoutDashboard },
    { title: 'Cohorts', url: '/educator/cohorts', icon: Users },
    { title: 'Programs', url: '/educator/programs', icon: BookOpen, permission: 'curriculum.manage' },
  ].filter((item) => !item.permission || user.permissions.includes(item.permission));

  const learnerLinks = [
    { title: 'My Pathway', url: '/learner', icon: LayoutDashboard },
    { title: 'Resources', url: '/learner/resources', icon: BookMarked },
    { title: 'Accessibility', url: '/learner/accessibility', icon: Settings },
  ];

  const links = user.role === 'administrator' ? adminLinks 
              : user.role === 'educator' ? educatorLinks 
              : learnerLinks;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b p-4">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="font-bold">NP</span>
            </div>
            <span>Nexus Pathways</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{user.role.charAt(0).toUpperCase() + user.role.slice(1)} Portal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {links.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={location === item.url || (location.startsWith(item.url) && item.url !== `/${user.role}`)}>
                      <Link href={item.url}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                    <Activity className={`size-3 ${health?.status === 'ok' ? 'text-emerald-500' : 'text-destructive'}`} />
                    <span>API: {health?.status === 'ok' ? 'Online' : 'Checking...'}</span>
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-9 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 overflow-hidden">
              <span className="text-sm font-medium truncate">{user.displayName}</span>
              <span className="text-xs text-muted-foreground truncate">{user.scope.organization?.name || 'Nexus'}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => signOut()}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger />
          <div className="w-px h-4 bg-border mx-2" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {user.scope.organization && <span>{user.scope.organization.name}</span>}
            {user.scope.agency && <><span className="text-border">/</span><span>{user.scope.agency.name}</span></>}
            {user.scope.facility && <><span className="text-border">/</span><span>{user.scope.facility.name}</span></>}
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-muted/20">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
