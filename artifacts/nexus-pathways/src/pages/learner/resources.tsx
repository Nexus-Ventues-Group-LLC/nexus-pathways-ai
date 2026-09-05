import { useGetLearnerHome } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'wouter';
import { BookMarked, ShieldCheck, AlertCircle, LockKeyhole, ArrowRight } from 'lucide-react';
import { approvedResourceHref } from '@/lib/approved-resource';

export default function LearnerResources() {
  const { data: home, error } = useGetLearnerHome();

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Failed to load resources. Please try again later.</p>
        </div>
      </div>
    );
  }

  const resources = (home?.resources || []).flatMap((resource) => {
    const href = approvedResourceHref(resource.route);
    return href ? [{ resource, href }] : [];
  });

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="space-y-3 border-b pb-6">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold tracking-tight text-primary flex items-center gap-3">
          <BookMarked className="h-8 w-8" />
          Institution Resources
        </h1>
        <p className="text-lg text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          Approved materials provided by your facility
        </p>
      </div>

      {resources.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookMarked className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No Resources Available</h3>
            <p className="text-muted-foreground max-w-sm">
              There are currently no approved resources assigned to your account. Check back later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map(({ resource, href }) => (
            <Link key={resource.id} href={href} className="group rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full border-border/50 bg-card transition-colors group-hover:border-primary/50">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
                    <BookMarked className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium text-lg leading-tight mb-2">
                    {resource.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{resource.summary}</p>
                  <div className="mt-auto pt-4 flex items-center gap-2 text-sm font-medium text-accent">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Institution approved
                    <ArrowRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
