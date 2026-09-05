import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  MapPin, 
  BookOpen, 
  Briefcase, 
  Users, 
  ShieldCheck,
  Building2
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="font-bold">NP</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-primary">Nexus Pathways</span>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32 md:pt-32 md:pb-40">
          <div className="absolute inset-0 bg-primary/5 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground mb-8">
              Phase 1 Platform Live
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-primary max-w-4xl mx-auto leading-tight mb-6">
              Empowering education and workforce mobility.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              A secure, multi-tenant ecosystem designed for public-service impact. 
              Connecting learners, educators, and administrators to build actionable pathways for the future.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 text-base" asChild>
                <Link href="/sign-up">
                  Join the Platform <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base bg-background" asChild>
                <Link href="/sign-in">Sign In to Portal</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-24 bg-muted/30 border-y">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Unified Ecosystem</h2>
              <p className="text-muted-foreground text-lg">
                Built from the ground up for scale, compliance, and user success.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard 
                icon={BookOpen}
                title="For Learners"
                description="Navigate your personal pathway, access resources, and track your progress in real-time."
              />
              <FeatureCard 
                icon={Users}
                title="For Educators"
                description="Manage cohorts, track program outcomes, and guide learners with contextual data."
              />
              <FeatureCard 
                icon={ShieldCheck}
                title="For Administrators"
                description="Maintain comprehensive oversight with organizational hierarchy mapping and secure audit logging."
              />
            </div>
          </div>
        </section>

        {/* Value Prop */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <h2 className="text-4xl font-bold tracking-tight text-primary">
                  Designed for public trust.
                </h2>
                <div className="space-y-6">
                  <ValueItem 
                    icon={Building2}
                    title="Multi-Tenant Architecture"
                    description="Safely manage data across agencies, regions, and facilities with strict scope isolation."
                  />
                  <ValueItem 
                    icon={Briefcase}
                    title="Workforce Aligned"
                    description="Bridge the gap between education and employment with outcome-driven tracking."
                  />
                  <ValueItem 
                    icon={MapPin}
                    title="Context-Aware"
                    description="Every portal adapts to the specific organizational context of the logged-in user."
                  />
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-full bg-accent/10 absolute -inset-4 -z-10 blur-3xl opacity-50" />
                <div className="bg-card border rounded-2xl shadow-xl p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-bl-full -z-10" />
                  <div className="space-y-4">
                    <div className="h-2 w-12 bg-primary rounded-full mb-8" />
                    <h3 className="text-2xl font-bold mb-2">Secure by Default</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Our architecture ensures that cross-tenant boundaries are never breached. 
                      Audit events are immutable and transparent to administrators, ensuring 
                      accountability at every level of the organization.
                    </p>
                    <div className="pt-6">
                      <Button variant="link" className="px-0" asChild>
                        <Link href="/sign-up" className="text-accent hover:text-accent/80 font-semibold">
                          Explore the capabilities <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-primary text-primary-foreground py-12 border-t border-primary/20">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex aspect-square size-6 items-center justify-center rounded-md bg-primary-foreground text-primary">
              <span className="font-bold text-xs">NP</span>
            </div>
            <span className="font-semibold">Nexus Pathways AI</span>
          </div>
          <p className="text-sm text-primary-foreground/60">
            &copy; {new Date().getFullYear()} Nexus Pathways. Phase 1 Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function ValueItem({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="flex gap-4">
      <div className="mt-1 flex-shrink-0">
        <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20">
          <Icon className="h-5 w-5 text-accent" />
        </div>
      </div>
      <div>
        <h4 className="text-lg font-bold mb-1">{title}</h4>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}