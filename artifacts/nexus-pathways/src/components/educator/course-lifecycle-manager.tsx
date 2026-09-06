import { useState } from 'react';
import { 
  useListCourseVersions, 
  useTransitionCourseLifecycle, 
  getGetCourseQueryKey,
  getListCourseVersionsQueryKey,
  getListCoursesQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowRight, CheckCircle2, CircleDashed, FileEdit, Archive, Activity } from 'lucide-react';
import type { Course, CourseVersion } from '@workspace/api-client-react';
import { trackEvent } from '@/lib/analytics';

export default function CourseLifecycleManager({ courseId, course }: { courseId: string, course?: Course }) {
  const { data: versions, isLoading: versionsLoading } = useListCourseVersions(courseId);
  const transitionLifecycle = useTransitionCourseLifecycle();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isTransitionOpen, setIsTransitionOpen] = useState(false);
  const [targetLifecycle, setTargetLifecycle] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState('');

  const handleTransition = () => {
    if (!targetLifecycle) return;

    // Type casting targetLifecycle correctly based on API schema
    const lifecycleEnum = targetLifecycle as 'draft' | 'review' | 'approved' | 'published' | 'retired';

    transitionLifecycle.mutate(
      { courseId, data: { lifecycle: lifecycleEnum, changeNote } },
      {
        onSuccess: (updatedCourse) => {
          queryClient.setQueryData(getGetCourseQueryKey(courseId), updatedCourse);
          queryClient.invalidateQueries({ queryKey: getListCourseVersionsQueryKey(courseId) });
          queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
          
          setIsTransitionOpen(false);
          setChangeNote('');
          setTargetLifecycle(null);
          toast({ title: `Course moved to ${lifecycleEnum}` });

          if (lifecycleEnum === 'published') {
            trackEvent('course_published', {
              previous_lifecycle: course?.lifecycle || 'unknown',
              publication_path: course?.lifecycle === 'approved' ? 'after_approval' : 'direct',
            });
          }
        },
        onError: () => {
          toast({ title: 'Failed to transition course', variant: 'destructive' });
        }
      }
    );
  };

  const getAvailableTransitions = (current: string) => {
    switch (current) {
      case 'draft': return ['review', 'published'];
      case 'review': return ['draft', 'approved'];
      case 'approved': return ['draft', 'published'];
      case 'published': return ['draft', 'retired'];
      case 'retired': return ['draft'];
      default: return [];
    }
  };

  const transitions = getAvailableTransitions(course?.lifecycle || '');

  const getLifecycleIcon = (lifecycle: string) => {
    switch (lifecycle) {
      case 'draft': return <FileEdit className="size-4 text-muted-foreground" />;
      case 'review': return <CircleDashed className="size-4 text-blue-500" />;
      case 'approved': return <CheckCircle2 className="size-4 text-emerald-500" />;
      case 'published': return <Activity className="size-4 text-primary" />;
      case 'retired': return <Archive className="size-4 text-destructive" />;
      default: return <FileEdit className="size-4" />;
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-serif font-semibold">Lifecycle & Versions</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage the publishing state and view the history of changes for this course.
        </p>
      </div>

      <div className="bg-muted/30 border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h3 className="font-medium text-sm text-muted-foreground mb-1">Current State</h3>
          <div className="flex items-center gap-2">
            {getLifecycleIcon(course?.lifecycle || '')}
            <span className="text-lg font-semibold capitalize">{course?.lifecycle}</span>
            <Badge variant="outline" className="ml-2 font-mono">v{course?.currentVersion}</Badge>
          </div>
          {course?.publishedAt && (
            <p className="text-sm text-muted-foreground mt-2">
              Last published on {format(new Date(course.publishedAt), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {transitions.map(t => (
            <Dialog key={t} open={isTransitionOpen && targetLifecycle === t} onOpenChange={(open) => {
              setIsTransitionOpen(open);
              if (open) setTargetLifecycle(t);
              else setTargetLifecycle(null);
            }}>
              <DialogTrigger asChild>
                <Button variant={t === 'published' ? 'default' : t === 'retired' ? 'destructive' : 'outline'} className="gap-2">
                  <span>Move to {t}</span>
                  <ArrowRight className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transition to {t}</DialogTitle>
                  <DialogDescription>
                    You are changing the lifecycle state of this course to <strong className="capitalize">{t}</strong>.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="changeNote">Change Note (Optional)</Label>
                    <Textarea 
                      id="changeNote" 
                      placeholder="Describe what changed in this version..." 
                      value={changeNote}
                      onChange={(e) => setChangeNote(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsTransitionOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={handleTransition} 
                    disabled={transitionLifecycle.isPending}
                    variant={t === 'published' ? 'default' : t === 'retired' ? 'destructive' : 'default'}
                  >
                    {transitionLifecycle.isPending ? 'Processing...' : 'Confirm Transition'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Version History</h3>
        {versionsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !versions || versions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            No version history found.
          </div>
        ) : (
          <div className="border rounded-xl divide-y">
            {versions.map((v: CourseVersion) => (
              <div key={v.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 bg-muted p-2 rounded-full">
                    {getLifecycleIcon(v.lifecycle)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Version {v.version}</span>
                      <Badge variant="secondary" className="text-xs capitalize">{v.lifecycle}</Badge>
                    </div>
                    {v.changeNote && (
                      <p className="text-sm text-muted-foreground mt-1">{v.changeNote}</p>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground whitespace-nowrap text-right">
                  {format(new Date(v.createdAt), 'MMM d, yyyy')}
                  <br />
                  {format(new Date(v.createdAt), 'h:mm a')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}