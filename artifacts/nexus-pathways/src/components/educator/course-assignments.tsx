import { useState } from 'react';
import { 
  useListCourseAssignments,
  useListEligibleCurriculumCohorts,
  useAssignCourseToCohort,
  getListCourseAssignmentsQueryKey,
  getListEligibleCurriculumCohortsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Users, Check, X, ShieldAlert } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { trackEvent } from '@/lib/analytics';

export default function CourseAssignments({ courseId }: { courseId: string }) {
  const { data: assignments, isLoading: assignmentsLoading } = useListCourseAssignments(courseId);
  const { data: eligibleCohorts, isLoading: cohortsLoading } = useListEligibleCurriculumCohorts();
  
  const assignCohort = useAssignCourseToCohort();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleToggleAssignment = (cohortId: string, currentlyAssigned: boolean) => {
    assignCohort.mutate(
      { courseId, data: { cohortId, assigned: !currentlyAssigned } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCourseAssignmentsQueryKey(courseId) });
          toast({ 
            title: `Course ${!currentlyAssigned ? 'assigned to' : 'unassigned from'} cohort` 
          });

          if (!currentlyAssigned) {
            trackEvent('course_assigned_to_cohort', {
              assignment_action: 'assigned',
            });
          }
        },
        onError: () => {
          toast({ title: 'Failed to update assignment', variant: 'destructive' });
        }
      }
    );
  };

  const isAssigned = (cohortId: string) => {
    return assignments?.some(a => a.cohortId === cohortId && !a.unassignedAt) || false;
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-serif font-semibold">Cohort Assignments</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage which learner cohorts have access to this course.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Active Assignments
          </h3>
          
          {assignmentsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : assignments?.filter(a => !a.unassignedAt).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg bg-muted/10">
              Not assigned to any cohorts currently.
            </div>
          ) : (
            <div className="space-y-3">
              {assignments?.filter(a => !a.unassignedAt).map(assignment => {
                const cohortInfo = eligibleCohorts?.find(c => c.id === assignment.cohortId);
                return (
                  <Card key={assignment.id} className="overflow-hidden border-primary/20 bg-primary/5">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{cohortInfo?.name || assignment.cohortId}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Assigned {format(new Date(assignment.assignedAt), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleToggleAssignment(assignment.cohortId, true)}
                        disabled={assignCohort.isPending}
                      >
                        <X className="size-4 mr-1" /> Remove
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-medium mb-4">Eligible Cohorts</h3>
          <div className="bg-muted/30 border rounded-xl p-4">
            {cohortsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : eligibleCohorts?.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <ShieldAlert className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                No eligible cohorts found in your scope.
              </div>
            ) : (
              <div className="space-y-1">
                {eligibleCohorts?.map(cohort => {
                  const assigned = isAssigned(cohort.id);
                  return (
                    <div 
                      key={cohort.id} 
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${assigned ? 'bg-background' : 'hover:bg-muted/50'}`}
                    >
                      <div>
                        <div className="font-medium text-sm">{cohort.name}</div>
                        <div className="text-xs text-muted-foreground">{cohort.programName}</div>
                      </div>
                      <Switch 
                        checked={assigned}
                        disabled={assignCohort.isPending}
                        onCheckedChange={() => handleToggleAssignment(cohort.id, assigned)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}