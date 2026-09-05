import { useState, useEffect } from 'react';
import { useGetLearnerHome, useCompleteLearnerCoursework, useUpdateLearnerGoals, getGetLearnerHomeQueryKey } from '@workspace/api-client-react';
import type { LearnerCoursework, LearnerHome } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, Circle, Target, Clock, BookOpen, AlertCircle, Edit2, X, Plus, Trash2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

function GoalsWidget({ goals }: { goals: string[] }) {
  const [editing, setEditing] = useState(false);
  const [localGoals, setLocalGoals] = useState<string[]>([]);
  const { mutate: updateGoals, isPending } = useUpdateLearnerGoals();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    setLocalGoals(goals || []);
  }, [goals]);

  const handleSave = () => {
    const validGoals = localGoals.filter(g => g.trim().length > 0).slice(0, 5);
    updateGoals({ data: { goals: validGoals } }, {
      onSuccess: (updated) => {
        toast({ title: 'Goals updated successfully' });
        queryClient.setQueryData<LearnerHome>(getGetLearnerHomeQueryKey(), (old) =>
          old ? { ...old, goals: updated } : old
        );
        setEditing(false);
      },
      onError: () => {
        toast({ title: 'Failed to update goals', variant: 'destructive' });
      }
    });
  };

  const addGoal = () => {
    if (localGoals.length < 5) {
      setLocalGoals([...localGoals, '']);
    }
  };

  return (
    <Card className="h-full flex flex-col border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xl font-serif flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            My Goals
          </CardTitle>
          <CardDescription>What are you working towards?</CardDescription>
        </div>
        {!editing && (
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Edit goals">
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {editing ? (
          <div className="space-y-3">
            {localGoals.map((goal, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={goal}
                  onChange={(e) => {
                    const newGoals = [...localGoals];
                    newGoals[i] = e.target.value;
                    setLocalGoals(newGoals);
                  }}
                  placeholder="Enter a goal..."
                  maxLength={280}
                  className="bg-background"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLocalGoals(localGoals.filter((_, idx) => idx !== i))}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {localGoals.length < 5 && (
              <Button variant="outline" size="sm" onClick={addGoal} className="w-full border-dashed">
                <Plus className="h-4 w-4 mr-2" /> Add Goal
              </Button>
            )}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={isPending} className="flex-1">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Goals
              </Button>
              <Button variant="outline" onClick={() => { setLocalGoals(goals); setEditing(false); }} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {goals.length === 0 ? (
              <li className="text-sm text-muted-foreground text-center py-4">
                No goals set yet. Click the edit button to add some.
              </li>
            ) : (
              goals.map((goal, i) => (
                <li key={i} className="flex items-start gap-3 text-sm p-3 rounded-md bg-background border border-border/50">
                  <div className="h-2 w-2 rounded-full bg-accent mt-1.5 shrink-0" />
                  <span className="leading-relaxed">{goal}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CourseworkItem({ item }: { item: LearnerCoursework }) {
  const { mutate: completeCoursework, isPending } = useCompleteLearnerCoursework();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleComplete = () => {
    completeCoursework({ courseworkId: item.id }, {
      onSuccess: () => {
        toast({ title: 'Coursework marked as completed!' });
        // Invalidate to refresh the total instructional hours and list
        queryClient.invalidateQueries({ queryKey: getGetLearnerHomeQueryKey() });
      },
      onError: () => {
        toast({ title: 'Failed to complete coursework', variant: 'destructive' });
      }
    });
  };

  const isCompleted = item.status === 'completed';

  return (
    <div className={`p-4 rounded-lg border flex flex-col gap-3 transition-colors ${isCompleted ? 'bg-muted/30 border-border/30' : 'bg-card border-border shadow-sm'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className={`font-medium ${isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {item.title}
          </h4>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {item.description}
          </p>
        </div>
        <div className="shrink-0 text-sm font-medium text-muted-foreground flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-full">
          <Clock className="h-3.5 w-3.5" />
          {item.instructionalHours}h
        </div>
      </div>

      <div className="flex items-center justify-end mt-2">
        {isCompleted ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-500 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="h-4 w-4" />
            Completed
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleComplete}
            disabled={isPending}
            className="hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Circle className="h-4 w-4 mr-2" />}
            Mark Complete
          </Button>
        )}
      </div>
    </div>
  );
}

export default function LearnerPortal() {
  const { data: home, isLoading, error } = useGetLearnerHome();

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Failed to load your learning dashboard. Please try again later.</p>
        </div>
      </div>
    );
  }

  if (isLoading || !home) return null;

  const assignedCount = home.coursework.filter(c => c.status === 'assigned').length;
  const completedCount = home.coursework.length - assignedCount;
  const completionPercent = home.coursework.length === 0
    ? 0
    : Math.round((completedCount / home.coursework.length) * 100);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-serif font-semibold tracking-tight text-primary">
            My Pathway
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Welcome back. Stay focused on your goals and continue building your skills today.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column: Coursework */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-serif flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Assigned Coursework
                </CardTitle>
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                  {assignedCount} Remaining
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {home.coursework.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                  <CheckCircle2 className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">You're all caught up!</p>
                  <p className="text-sm text-muted-foreground mt-1">No assigned coursework at the moment.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {home.coursework.map(item => (
                    <CourseworkItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Progress & Goals */}
        <div className="lg:col-span-4 space-y-6">

          {/* Progress Widget */}
          <Card className="border-border/50 shadow-sm bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-serif">Instructional Time</CardTitle>
              <CardDescription className="text-primary-foreground/80">
                Total recorded learning hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-4 tracking-tight">
                {home.instructionalHoursCompleted} <span className="text-2xl text-primary-foreground/70 font-medium">hrs</span>
              </div>
              <Progress
                value={completionPercent}
                className="h-2 bg-primary-foreground/20"
                indicatorClassName="bg-accent"
              />
              <p className="text-xs text-primary-foreground/60 mt-3 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {completedCount} of {home.coursework.length} assignments completed
              </p>
            </CardContent>
          </Card>

          {/* Goals Widget */}
          <GoalsWidget goals={home.goals.goals} />

        </div>
      </div>
    </div>
  );
}
