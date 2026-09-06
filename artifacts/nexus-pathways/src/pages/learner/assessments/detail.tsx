import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { 
  useGetLearnerAssessment, 
  useListLearnerAssessmentAttempts, 
  useStartLearnerAssessmentAttempt,
  useSubmitLearnerAssessmentResponses,
  getGetLearnerAssessmentQueryKey,
  getListLearnerAssessmentAttemptsQueryKey,
  getGetLearnerMasteryQueryKey,
  useGetLearnerMastery
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { 
  ChevronLeft, AlertTriangle, Target, Award, Clock, 
  CheckCircle2, AlertCircle, ArrowRight, PlayCircle 
} from 'lucide-react';
import type { 
  LearnerAssessmentAttempt, 
  LearnerAssessmentQuestion, 
  AssessmentResponseInput 
} from '@workspace/api-client-react';

export default function LearnerAssessmentDetail() {
  const params = useParams();
  const assessmentId = params?.assessmentId;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: assessment, isLoading: isLoadingAssessment, error: errorAssessment } = useGetLearnerAssessment(assessmentId!, {
    query: { enabled: !!assessmentId, queryKey: getGetLearnerAssessmentQueryKey(assessmentId!) }
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useListLearnerAssessmentAttempts(assessmentId!, {
    query: { enabled: !!assessmentId, queryKey: getListLearnerAssessmentAttemptsQueryKey(assessmentId!) }
  });

  const { data: masteryData } = useGetLearnerMastery();

  const startAttempt = useStartLearnerAssessmentAttempt();
  const submitResponses = useSubmitLearnerAssessmentResponses();

  const inProgressAttempt = useMemo(() => {
    return attempts?.find((a) => a.status === 'in_progress') || null;
  }, [attempts]);

  const completedAttempts = useMemo(() => {
    return attempts?.filter((a) => a.status === 'submitted').sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    ) || [];
  }, [attempts]);

  const currentAttempt = attempts?.find(a => a.id === activeAttemptId) || inProgressAttempt;
  
  const isPracticing = !!activeAttemptId;

  const handleStart = () => {
    if (inProgressAttempt) {
      setActiveAttemptId(inProgressAttempt.id);
      return;
    }
    
    startAttempt.mutate({ assessmentId: assessmentId! }, {
      onSuccess: (newAttempt) => {
        setActiveAttemptId(newAttempt.id);
        queryClient.invalidateQueries({ queryKey: getListLearnerAssessmentAttemptsQueryKey(assessmentId!) });
      },
      onError: () => {
        toast({ title: 'Failed to start assessment', variant: 'destructive' });
      }
    });
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    if (!assessment || !currentAttempt) return;
    
    const unAnswered = currentAttempt.questions.filter(q => !answers[q.id]);
    if (unAnswered.length > 0) {
      toast({ 
        title: 'Incomplete', 
        description: `Please answer all questions before submitting. (${unAnswered.length} remaining)`,
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    
    const submissionData: AssessmentResponseInput[] = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer
    }));

    submitResponses.mutate({
      assessmentId: assessmentId!,
      attemptId: currentAttempt.id,
      data: { responses: submissionData }
    }, {
      onSuccess: (updatedAttempt) => {
        setIsSubmitting(false);
        setActiveAttemptId(null);
        setAnswers({});
        toast({ title: 'Assessment submitted successfully!', variant: 'default' });
        queryClient.setQueryData(
          getListLearnerAssessmentAttemptsQueryKey(assessmentId!), 
          (old: LearnerAssessmentAttempt[] | undefined) => 
            old ? old.map(a => a.id === updatedAttempt.id ? updatedAttempt : a) : [updatedAttempt]
        );
        queryClient.invalidateQueries({ queryKey: getGetLearnerMasteryQueryKey() });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      onError: () => {
        setIsSubmitting(false);
        toast({ title: 'Failed to submit responses', variant: 'destructive' });
      }
    });
  };

  if (errorAssessment) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Failed to load assessment. It may not exist or you might not have access.</p>
        </div>
      </div>
    );
  }

  if (isLoadingAssessment || isLoadingAttempts || !assessment) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col relative">
      
      {/* Persistent Disclaimer Banner */}
      <div className="bg-amber-100 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 p-3 shrink-0">
        <div className="max-w-5xl mx-auto flex items-start sm:items-center gap-3 text-amber-800 dark:text-amber-200/90 text-sm font-medium">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0 text-amber-600 dark:text-amber-500" />
          <p className="leading-relaxed">
            <span className="font-bold uppercase tracking-wide text-amber-900 dark:text-amber-400 mr-2">Notice:</span>
            These are internal learning and practice assessments. They are not official GED, TABE, or standardized placement examinations.
          </p>
        </div>
      </div>

      <header className="shrink-0 border-b bg-background/95 backdrop-blur z-10 sticky top-0 flex items-center px-4 md:px-6 h-14">
        <Button variant="ghost" size="sm" asChild className="-ml-2 shrink-0 text-muted-foreground mr-4">
          <Link href="/learner">
            <ChevronLeft className="size-4 mr-1" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-sm font-medium truncate">
          <Target className="size-4 text-accent shrink-0" />
          <span className="truncate">{assessment.title}</span>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
        {!isPracticing ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent font-medium text-xs tracking-wider uppercase mb-4">
                  {assessment.kind} Assessment
                </div>
                <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-foreground mb-4">
                  {assessment.title}
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {assessment.instructions}
                </p>
              </div>

              <Card className="border-accent/20 bg-accent/5 dark:bg-accent/10 shadow-sm overflow-hidden">
                <div className="h-1 bg-accent w-full" />
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col sm:flex-row gap-6 justify-between items-center">
                    <div className="space-y-1 text-center sm:text-left">
                      <h3 className="text-lg font-semibold text-foreground">Ready to begin?</h3>
                      <p className="text-muted-foreground">
                        This assessment contains {assessment.questionCount} questions.
                      </p>
                    </div>
                    <Button 
                      size="lg" 
                      onClick={handleStart}
                      disabled={startAttempt.isPending}
                      className="w-full sm:w-auto text-base gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-md hover-elevate"
                    >
                      {startAttempt.isPending ? (
                        <span className="flex items-center"><div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin mr-2" /> Starting...</span>
                      ) : inProgressAttempt ? (
                        <>Resume Attempt <PlayCircle className="size-5" /></>
                      ) : (
                        <>Start Assessment <ArrowRight className="size-5" /></>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {completedAttempts.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-serif font-semibold text-foreground flex items-center gap-2">
                    <Clock className="size-5 text-muted-foreground" />
                    Previous Attempts
                  </h3>
                  <div className="grid gap-3">
                    {completedAttempts.map((attempt, index) => (
                      <div key={attempt.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors gap-4">
                        <div>
                          <div className="font-medium text-foreground">Attempt {completedAttempts.length - index}</div>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            Submitted {new Date(attempt.submittedAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold tracking-tight text-foreground">
                              {attempt.score !== null ? `${Math.round(attempt.score)}%` : '--'}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              {attempt.correctAnswers} / {attempt.totalQuestions} Correct
                            </div>
                          </div>
                          {attempt.score !== null && attempt.score >= 80 && (
                            <Award className="size-8 text-amber-500 shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 space-y-6">
              {masteryData && masteryData.length > 0 && (
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-serif">Your Mastery</CardTitle>
                    <CardDescription>Performance across assessments</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {masteryData.map((mastery, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between items-end text-sm">
                          <span className="font-medium capitalize">{mastery.assessmentKind}</span>
                          <span className="text-muted-foreground font-mono">{Math.round(mastery.score)}%</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-accent rounded-full transition-all duration-1000" 
                            style={{ width: `${mastery.score}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8 pb-20">
            
            <div className="flex items-center justify-between border-b pb-4 mb-8">
              <h2 className="text-2xl font-serif font-semibold text-foreground">
                {assessment.title}
              </h2>
              <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                {Object.keys(answers).length} of {assessment.questionCount} Answered
              </div>
            </div>

            <div className="space-y-12">
              {currentAttempt?.questions.sort((a, b) => a.position - b.position).map((q, idx) => (
                <div key={q.id} className="space-y-6 animate-in slide-in-from-bottom-4 fade-in" style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}>
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent font-bold">
                      {idx + 1}
                    </div>
                    <div className="space-y-4 flex-1 mt-1">
                      <p className="text-lg font-medium leading-relaxed text-foreground whitespace-pre-wrap">
                        {q.prompt}
                      </p>
                      
                      <RadioGroup 
                        value={answers[q.id] || ""} 
                        onValueChange={(val) => handleAnswerChange(q.id, val)}
                        className="space-y-3"
                      >
                        {q.choices.map((choice, cIdx) => {
                          const isSelected = answers[q.id] === choice;
                          return (
                            <div key={cIdx}>
                              <Label
                                className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none hover-elevate ${
                                  isSelected 
                                    ? 'border-accent bg-accent/5 ring-1 ring-accent/20' 
                                    : 'border-border bg-card hover:border-accent/50'
                                }`}
                              >
                                <RadioGroupItem value={choice} className="mt-0.5 sr-only" id={`${q.id}-${cIdx}`} />
                                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors mt-0.5 ${
                                  isSelected ? 'border-accent bg-accent text-accent-foreground' : 'border-input bg-background'
                                }`}>
                                  {isSelected && <div className="h-2 w-2 rounded-full bg-current" />}
                                </div>
                                <span className={`text-base leading-relaxed ${isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                  {choice}
                                </span>
                              </Label>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-8 mt-12 border-t flex items-center justify-between sticky bottom-6 z-20 bg-background/80 backdrop-blur-md p-4 rounded-2xl shadow-lg border">
              <Button 
                variant="ghost" 
                onClick={() => setActiveAttemptId(null)}
                className="text-muted-foreground"
              >
                Save & Pause
              </Button>
              <Button 
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting || Object.keys(answers).length < assessment.questionCount}
                className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground min-w-[140px]"
              >
                {isSubmitting ? (
                  <span className="flex items-center"><div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin mr-2" /> Submitting...</span>
                ) : (
                  <>Submit Answers <CheckCircle2 className="size-5" /></>
                )}
              </Button>
            </div>
            
            {Object.keys(answers).length < assessment.questionCount && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Please answer all questions to submit.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
