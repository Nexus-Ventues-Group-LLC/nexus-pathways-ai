import { useState } from 'react';
import { Link } from 'wouter';
import { 
  useListAssessmentDefinitions, 
  useListEligibleAssessmentLearners, 
  useAssignAssessmentToLearner,
  getListAssessmentDefinitionsQueryKey,
  getListEligibleAssessmentLearnersQueryKey
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Target, PlusCircle, UserPlus, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { StaffAssessmentDefinition } from '@workspace/api-client-react';

function AssignDialog({ 
  assessment, 
  open, 
  onOpenChange 
}: { 
  assessment: StaffAssessmentDefinition | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) {
  const { data: learners, isLoading: isLoadingLearners } = useListEligibleAssessmentLearners({
    query: { enabled: open, queryKey: getListEligibleAssessmentLearnersQueryKey() }
  });
  const assignMutation = useAssignAssessmentToLearner();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleAssign = (learnerId: string) => {
    if (!assessment) return;
    assignMutation.mutate({
      assessmentId: assessment.id,
      data: { learnerUserId: learnerId, assigned: true }
    }, {
      onSuccess: () => {
        toast({ title: 'Assessment assigned successfully.' });
        queryClient.invalidateQueries({ queryKey: getListAssessmentDefinitionsQueryKey() });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: 'Failed to assign assessment.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Assessment</DialogTitle>
          <DialogDescription>
            {assessment && (
              <>Assign <span className="font-semibold text-foreground">{assessment.title}</span> to a learner.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
          {isLoadingLearners ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : learners?.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No eligible learners found.</p>
          ) : (
            <div className="grid gap-2">
              {learners?.map(learner => (
                <div key={learner.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/30">
                  <div>
                    <p className="font-medium text-sm">{learner.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[learner.program, learner.cohort].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={() => handleAssign(learner.id)}
                    disabled={assignMutation.isPending}
                  >
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EducatorAssessmentsList() {
  const { data: assessments, isLoading, error } = useListAssessmentDefinitions();
  const [assignAssessment, setAssignAssessment] = useState<StaffAssessmentDefinition | null>(null);

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Failed to load assessments. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-bold tracking-tight text-primary flex items-center gap-3">
            <Target className="h-8 w-8 text-accent" />
            Assessment Definitions
          </h1>
          <p className="text-muted-foreground">
            Author and assign learning assessments for your students.
          </p>
        </div>
        <Button asChild className="gap-2 shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground hover-elevate">
          <Link href="/educator/assessments/new">
            <PlusCircle className="size-4" />
            Create Assessment
          </Link>
        </Button>
      </div>

      <div className="bg-amber-100/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4 rounded-xl text-sm">
        <div className="flex gap-3 text-amber-800 dark:text-amber-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
          <p>
            <strong>Note:</strong> All authored assessments are internal practice tools. They do not represent official GED, TABE, or standardized placement examinations.
          </p>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>Existing Assessments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : assessments?.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No assessments created yet.</p>
              <Button asChild variant="link" className="mt-2 text-accent">
                <Link href="/educator/assessments/new">Create your first assessment</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {assessments?.map((assessment) => {
                const isStandalone = ['placement', 'diagnostic', 'practice'].includes(assessment.kind);
                return (
                  <div key={assessment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-foreground">{assessment.title}</h4>
                        <Badge variant="outline" className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                          {assessment.kind}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{assessment.instructions}</p>
                      <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground mt-2">
                        <span className="flex items-center gap-1.5"><FileText className="size-3.5" /> {assessment.questionCount} Questions</span>
                        <span className="flex items-center gap-1.5"><UserPlus className="size-3.5" /> {assessment.assignmentCount} Assignments</span>
                      </div>
                    </div>
                    {isStandalone && (
                      <Button 
                        variant="secondary" 
                        size="sm"
                        className="shrink-0"
                        onClick={() => setAssignAssessment(assessment)}
                      >
                        Assign to Learner
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AssignDialog 
        assessment={assignAssessment} 
        open={!!assignAssessment} 
        onOpenChange={(open) => !open && setAssignAssessment(null)} 
      />
    </div>
  );
}