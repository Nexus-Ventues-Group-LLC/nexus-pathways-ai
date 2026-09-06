import { useGetLearnerHome } from '@workspace/api-client-react';
import { ArrowLeft, BookMarked, LockKeyhole } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { approvedResourceHref } from '@/lib/approved-resource';

export default function LearnerResourceDetail() {
  const [location] = useLocation();
  const { data: home, error } = useGetLearnerHome();
  const resource = home?.resources.find(
    (item) => approvedResourceHref(item.route) === location,
  );

  if (error) {
    return <div className="p-8 text-destructive">The approved resource could not be loaded.</div>;
  }

  if (!home) return null;

  if (!resource) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Card className="border-destructive/30">
          <CardContent className="p-8 text-center">
            <LockKeyhole className="mx-auto h-9 w-9 text-destructive" />
            <h1 className="mt-4 text-xl font-semibold">Resource unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This destination is not in your institution-approved resource list.
            </p>
            <Link href="/learner/resources" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary underline">
              <ArrowLeft className="h-4 w-4" />
              Return to approved resources
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <Link href="/learner/resources" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline">
        <ArrowLeft className="h-4 w-4" />
        Approved resources
      </Link>
      <div className="flex items-center gap-3 text-accent">
        <BookMarked className="h-6 w-6" />
        <span className="text-sm font-semibold uppercase tracking-wider">Institution approved</span>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-primary md:text-4xl">{resource.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{resource.summary}</p>
      </header>
      <Card>
        <CardContent className="whitespace-pre-wrap p-6 text-base leading-8 md:p-8">
          {resource.content}
        </CardContent>
      </Card>
    </article>
  );
}