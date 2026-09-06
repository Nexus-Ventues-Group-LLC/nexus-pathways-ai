import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  useCreateAssessmentDefinition,
  useListCourses,
  useGetCourseStructure,
  useListEligibleAssessmentLearners,
  useAssignAssessmentToLearner,
  getListAssessmentDefinitionsQueryKey,
  getGetCourseStructureQueryKey
} from '@workspace/api-client-react';
import type { 
  AssessmentDefinitionInputKind, 
  AssessmentQuestionInput 
} from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Target, PlusCircle, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const assessmentKinds = ['placement', 'diagnostic', 'practice', 'lesson', 'unit'] as const;

const formSchema = z.object({
  kind: z.enum(assessmentKinds),
  title: z.string().min(1, 'Title is required.'),
  instructions: z.string().optional(),
  curriculumCourseId: z.string().optional(), // For UI only
  curriculumAssessmentId: z.string().optional(),
  assignImmediately: z.boolean().default(false),
  assignLearnerId: z.string().optional(),
  questions: z.array(z.object({
    prompt: z.string().min(1, 'Prompt is required.'),
    choices: z.array(z.object({
      value: z.string().min(1, 'Choice text is required.')
    })).min(2, 'At least 2 choices required.'),
    correctChoiceIndex: z.number().min(0, 'Please select the correct answer.'),
    skillLabel: z.string().optional()
  })).min(1, 'At least one question is required.')
});

type FormValues = z.infer<typeof formSchema>;

export default function EducatorAssessmentsAuthor() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useCreateAssessmentDefinition();
  const assignMutation = useAssignAssessmentToLearner();

  const { data: courses } = useListCourses();
  const { data: learners } = useListEligibleAssessmentLearners();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      kind: 'practice',
      title: '',
      instructions: '',
      questions: [
        { prompt: '', choices: [{ value: '' }, { value: '' }], correctChoiceIndex: 0 }
      ],
      assignImmediately: false
    }
  });

  const { fields: questions, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control: form.control,
    name: 'questions'
  });

  const watchKind = form.watch('kind');
  const watchCourseId = form.watch('curriculumCourseId');
  const watchAssignImmediately = form.watch('assignImmediately');
  
  const isCurriculumLinked = watchKind === 'lesson' || watchKind === 'unit';
  const isStandalone = !isCurriculumLinked;

  const { data: courseStructure, isLoading: isLoadingStructure } = useGetCourseStructure(watchCourseId!, {
    query: { enabled: !!watchCourseId && isCurriculumLinked, queryKey: getGetCourseStructureQueryKey(watchCourseId!) }
  });

  // Collect curriculum assessments from structure
  const curriculumAssessments = courseStructure?.subjects.flatMap(s => 
    s.modules.flatMap(m => 
      m.units.flatMap(u => 
        u.lessons.flatMap(l => l.assessments)
      )
    )
  ) || [];

  const onSubmit = async (data: FormValues) => {
    // Validate curriculum links
    if (isCurriculumLinked && !data.curriculumAssessmentId) {
      form.setError('curriculumAssessmentId', { message: 'Required for lesson/unit assessments.' });
      return;
    }
    // Validate standalone assignment
    if (isStandalone && data.assignImmediately && !data.assignLearnerId) {
      form.setError('assignLearnerId', { message: 'Please select a learner.' });
      return;
    }

    const payloadQuestions: AssessmentQuestionInput[] = data.questions.map(q => ({
      prompt: q.prompt,
      choices: q.choices.map(c => c.value),
      correctAnswer: q.choices[q.correctChoiceIndex]?.value || q.choices[0].value,
      ...(q.skillLabel ? { skillLabel: q.skillLabel } : {})
    }));

    try {
      const assessment = await createMutation.mutateAsync({
        data: {
          kind: data.kind as AssessmentDefinitionInputKind,
          title: data.title,
          instructions: data.instructions,
          ...(isCurriculumLinked && data.curriculumAssessmentId ? { curriculumAssessmentId: data.curriculumAssessmentId } : {}),
          questions: payloadQuestions
        }
      });

      if (isStandalone && data.assignImmediately && data.assignLearnerId) {
        await assignMutation.mutateAsync({
          assessmentId: assessment.id,
          data: { learnerUserId: data.assignLearnerId, assigned: true }
        });
      }

      toast({ title: 'Assessment created successfully!' });
      queryClient.invalidateQueries({ queryKey: getListAssessmentDefinitionsQueryKey() });
      setLocation('/educator/assessments');
    } catch (e) {
      toast({ title: 'Failed to create assessment', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0 text-muted-foreground">
          <Link href="/educator/assessments">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-primary flex items-center gap-3">
            <Target className="h-7 w-7 text-accent" />
            Author Assessment
          </h1>
        </div>
      </div>

      <div className="bg-amber-100/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4 rounded-xl text-sm mb-6">
        <div className="flex gap-3 text-amber-800 dark:text-amber-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
          <p>
            <strong>Note:</strong> All authored assessments are internal practice tools. Ensure questions are appropriate for practice and not represented as official exams.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          {/* Metadata Section */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Assessment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Fractions Practice" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assessment Kind</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select kind" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="practice">Practice (Standalone)</SelectItem>
                          <SelectItem value="diagnostic">Diagnostic (Standalone)</SelectItem>
                          <SelectItem value="placement">Placement (Standalone)</SelectItem>
                          <SelectItem value="lesson">Lesson (Curriculum-linked)</SelectItem>
                          <SelectItem value="unit">Unit (Curriculum-linked)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Instructions for the learner..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isCurriculumLinked && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg border border-border">
                  <FormField
                    control={form.control}
                    name="curriculumCourseId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Course</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select course..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {courses?.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {watchCourseId && (
                    <FormField
                      control={form.control}
                      name="curriculumAssessmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link to Curriculum Assessment</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingStructure}>
                            <FormControl>
                              <SelectTrigger>
                                {isLoadingStructure ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="Select assessment block..." />}
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {curriculumAssessments.length === 0 ? (
                                <SelectItem value="none" disabled>No assessments in course</SelectItem>
                              ) : (
                                curriculumAssessments.map(a => (
                                  <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}

              {isStandalone && (
                <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
                  <FormField
                    control={form.control}
                    name="assignImmediately"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Assign to a learner immediately</FormLabel>
                          <FormDescription>
                            You can also assign this later from the assessments list.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {watchAssignImmediately && (
                    <FormField
                      control={form.control}
                      name="assignLearnerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Learner</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a learner..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {learners?.length === 0 ? (
                                <SelectItem value="none" disabled>No eligible learners found.</SelectItem>
                              ) : (
                                learners?.map(l => (
                                  <SelectItem key={l.id} value={l.id}>{l.displayName} {l.cohort ? `(${l.cohort})` : ''}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Questions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif font-bold text-foreground">Questions</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendQuestion({ prompt: '', choices: [{ value: '' }, { value: '' }], correctChoiceIndex: 0 })}
                className="gap-2"
              >
                <PlusCircle className="size-4" /> Add Question
              </Button>
            </div>

            {questions.map((q, qIndex) => (
              <Card key={q.id} className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between py-4 bg-muted/20 border-b">
                  <CardTitle className="text-base">Question {qIndex + 1}</CardTitle>
                  {questions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuestion(qIndex)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`questions.${qIndex}.prompt`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Prompt</FormLabel>
                          <FormControl>
                            <Textarea placeholder="What is the capital of..." className="resize-none" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name={`questions.${qIndex}.skillLabel`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Targeted Skill (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Fraction operations" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormDescription>Name the skill this question measures.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <FormLabel>Choices & Correct Answer</FormLabel>
                    <QuestionChoices form={form} qIndex={qIndex} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t sticky bottom-6 bg-background/95 backdrop-blur p-4 rounded-xl shadow-lg border">
            <Button variant="ghost" asChild>
              <Link href="/educator/assessments">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createMutation.isPending || assignMutation.isPending} className="bg-accent hover:bg-accent/90 text-accent-foreground min-w-[140px]">
              {createMutation.isPending || assignMutation.isPending ? (
                <span className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</span>
              ) : (
                <span className="flex items-center gap-2"><CheckCircle2 className="size-4" /> Create Assessment</span>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Sub-component for choices to use its own useFieldArray
function QuestionChoices({ form, qIndex }: { form: any, qIndex: number }) {
  const { fields: choices, append, remove } = useFieldArray({
    control: form.control,
    name: `questions.${qIndex}.choices`
  });

  const correctIndex = form.watch(`questions.${qIndex}.correctChoiceIndex`);

  return (
    <div className="space-y-3 pl-4 border-l-2 border-accent/20">
      {choices.map((c, cIndex) => (
        <div key={c.id} className="flex items-start gap-3">
          <FormField
            control={form.control}
            name={`questions.${qIndex}.correctChoiceIndex`}
            render={({ field }) => (
              <FormItem className="shrink-0 mt-2">
                <FormControl>
                  <Checkbox 
                    checked={field.value === cIndex}
                    onCheckedChange={(checked) => checked && field.onChange(cIndex)}
                    className={`rounded-full ${field.value === cIndex ? 'border-accent bg-accent text-accent-foreground' : ''}`}
                    title="Mark as correct answer"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="flex-1">
            <FormField
              control={form.control}
              name={`questions.${qIndex}.choices.${cIndex}.value`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder={`Choice ${cIndex + 1}`} {...field} className={correctIndex === cIndex ? 'border-accent/50 bg-accent/5' : ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {choices.length > 2 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                remove(cIndex);
                if (correctIndex === cIndex) {
                  form.setValue(`questions.${qIndex}.correctChoiceIndex`, 0);
                } else if (correctIndex > cIndex) {
                  form.setValue(`questions.${qIndex}.correctChoiceIndex`, correctIndex - 1);
                }
              }}
              className="mt-0.5 text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => append({ value: '' })}
        className="text-xs text-muted-foreground mt-2"
      >
        <PlusCircle className="size-3 mr-2" /> Add Choice
      </Button>
    </div>
  );
}