import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { useGetLearnerCourse, getGetLearnerCourseQueryKey } from '@workspace/api-client-react';
import type { Subject, Module, Unit, Lesson, Activity, Assessment, Skill } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, BookOpen, FileText, ChevronRight, PlayCircle, Target, Award } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type ActiveContent = 
  | { type: 'activity'; data: Activity; path: string }
  | { type: 'assessment'; data: Assessment; path: string }
  | null;

export default function LearnerCourseReader() {
  const params = useParams();
  const courseId = params?.id;
  
  const { data: structure, isLoading, error } = useGetLearnerCourse(courseId!, {
    query: { enabled: !!courseId, queryKey: getGetLearnerCourseQueryKey(courseId!) }
  });

  const [activeContent, setActiveContent] = useState<ActiveContent>(null);
  
  // Auto-select first content item
  useEffect(() => {
    if (structure && !activeContent) {
      let found = false;
      for (const subject of structure.subjects) {
        if (found) break;
        for (const mod of subject.modules) {
          if (found) break;
          for (const unit of mod.units) {
            if (found) break;
            for (const lesson of unit.lessons) {
              const path = `${subject.title} / ${mod.title} / ${unit.title} / ${lesson.title}`;
              if (lesson.activities.length > 0) {
                setActiveContent({ type: 'activity', data: lesson.activities[0], path });
                found = true;
                break;
              } else if (lesson.assessments.length > 0) {
                setActiveContent({ type: 'assessment', data: lesson.assessments[0], path });
                found = true;
                break;
              }
            }
          }
        }
      }
    }
  }, [structure, activeContent]);

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <div className="bg-destructive/10 text-destructive p-6 rounded-xl border border-destructive/20">
          <Target className="size-10 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Course Unavailable</h2>
          <p>We couldn't load this course. It may not be assigned to you or might be offline.</p>
          <Button asChild className="mt-6" variant="outline">
            <Link href="/learner">Return to My Pathway</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !structure) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <header className="shrink-0 border-b p-4 bg-background">
          <Skeleton className="h-8 w-1/3" />
        </header>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 border-r p-4 shrink-0 hidden md:block">
            <Skeleton className="h-full w-full" />
          </div>
          <div className="flex-1 p-8">
            <Skeleton className="h-10 w-2/3 mb-6" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6 mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-4/5 mb-8" />
            
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const { course, subjects } = structure;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background">
      {/* Header */}
      <header className="shrink-0 border-b bg-background/95 backdrop-blur z-10 sticky top-0 flex items-center px-4 md:px-6 h-14">
        <Button variant="ghost" size="sm" asChild className="-ml-2 shrink-0 text-muted-foreground mr-4">
          <Link href="/learner">
            <ChevronLeft className="size-4 mr-1" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-sm font-medium truncate">
          <BookOpen className="size-4 text-primary shrink-0" />
          <span className="truncate">{course.title}</span>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar / Syllabus */}
        <div className="w-full md:w-80 lg:w-96 shrink-0 border-r bg-muted/10 flex flex-col hidden md:flex">
          <div className="p-4 border-b bg-background/50">
            <h2 className="font-serif font-semibold text-lg tracking-tight">Syllabus</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {subjects.map((subject, sIdx) => (
                <SubjectNode 
                  key={subject.id} 
                  subject={subject} 
                  index={sIdx + 1}
                  activeContent={activeContent}
                  onSelect={setActiveContent}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Content Area */}
        <ScrollArea className="flex-1 bg-background relative">
          <div className="max-w-3xl mx-auto p-6 md:p-10 lg:p-12">
            {activeContent ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-3">
                  {activeContent.path}
                </div>
                
                {activeContent.type === 'activity' ? (
                  <ActivityViewer activity={activeContent.data} />
                ) : (
                  <AssessmentViewer assessment={activeContent.data} />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <FileText className="size-12 mb-4 opacity-20" />
                <p>Select a lesson from the syllabus to begin.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// --- Hierarchy Nodes for Sidebar ---

function SubjectNode({ subject, index, activeContent, onSelect }: any) {
  return (
    <Collapsible defaultOpen className="mb-2">
      <CollapsibleTrigger className="flex items-center w-full p-2 text-left hover:bg-muted rounded-md group font-semibold text-sm transition-colors">
        <ChevronRight className="size-4 mr-2 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <span className="truncate">Unit {index}: {subject.title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-muted ml-4 mt-1">
        {subject.modules.map((mod: Module) => (
          <ModuleNode 
            key={mod.id} 
            module={mod} 
            path={`${subject.title}`} 
            activeContent={activeContent}
            onSelect={onSelect}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ModuleNode({ module, path, activeContent, onSelect }: any) {
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex items-center w-full p-2 text-left hover:bg-muted rounded-md group font-medium text-sm transition-colors">
        <ChevronRight className="size-3.5 mr-2 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <span className="truncate">{module.title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 py-1 space-y-1 border-l-2 border-muted/50 ml-3">
        {module.units.map((unit: Unit) => (
          <UnitNode 
            key={unit.id} 
            unit={unit} 
            path={`${path} / ${module.title}`}
            activeContent={activeContent}
            onSelect={onSelect}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function UnitNode({ unit, path, activeContent, onSelect }: any) {
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex items-center w-full p-1.5 text-left hover:bg-muted rounded-md group font-medium text-sm transition-colors">
        <ChevronRight className="size-3 mr-2 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <span className="truncate">{unit.title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 py-1 space-y-2 ml-2">
        {unit.lessons.map((lesson: Lesson) => (
          <div key={lesson.id} className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground px-2 pt-1">{lesson.title}</div>
            
            {lesson.activities.map((act: Activity) => {
              const isActive = activeContent?.type === 'activity' && activeContent?.data.id === act.id;
              return (
                <button
                  key={act.id}
                  onClick={() => onSelect({ type: 'activity', data: act, path: `${path} / ${unit.title} / ${lesson.title}` })}
                  className={`w-full flex items-start gap-2 p-2 rounded-md text-left text-sm transition-colors ${
                    isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <PlayCircle className={`size-4 shrink-0 mt-0.5 ${isActive ? 'text-primary' : 'text-blue-500/70'}`} />
                  <span className="line-clamp-2 leading-tight">{act.title}</span>
                </button>
              );
            })}
            
            {lesson.assessments.map((ass: Assessment) => {
              const isActive = activeContent?.type === 'assessment' && activeContent?.data.id === ass.id;
              return (
                <button
                  key={ass.id}
                  onClick={() => onSelect({ type: 'assessment', data: ass, path: `${path} / ${unit.title} / ${lesson.title}` })}
                  className={`w-full flex items-start gap-2 p-2 rounded-md text-left text-sm transition-colors ${
                    isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Award className={`size-4 shrink-0 mt-0.5 ${isActive ? 'text-primary' : 'text-emerald-500/70'}`} />
                  <span className="line-clamp-2 leading-tight">{ass.title}</span>
                </button>
              );
            })}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// --- Content Viewers ---

function ActivityViewer({ activity }: { activity: Activity }) {
  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl md:text-4xl font-serif font-semibold tracking-tight text-foreground mb-4">
          {activity.title}
        </h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
          <div className="flex items-center gap-1.5">
            <PlayCircle className="size-4 text-blue-500" />
            <span>Activity</span>
          </div>
          {activity.instructionalMinutes > 0 && (
            <>
              <div className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-1.5">
                <span>{activity.instructionalMinutes} min</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-a:text-primary">
        {/* Real markdown/HTML rendering would go here, we just use a div for text */}
        <div className="whitespace-pre-wrap leading-relaxed text-base/7 text-foreground/90">
          {activity.content || (
            <span className="italic text-muted-foreground">No content provided for this activity.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AssessmentViewer({ assessment }: { assessment: Assessment }) {
  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-3xl md:text-4xl font-serif font-semibold tracking-tight text-foreground mb-4">
          {assessment.title}
        </h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
          <div className="flex items-center gap-1.5">
            <Award className="size-4 text-emerald-500" />
            <span>Practice Assessment</span>
          </div>
        </div>
      </div>

      {assessment.instructions && (
        <Card className="border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-emerald-800 dark:text-emerald-300 font-medium mb-2 flex items-center gap-2">
              <FileText className="size-4" />
              Instructions
            </h3>
            <p className="text-emerald-900/80 dark:text-emerald-200/80 whitespace-pre-wrap leading-relaxed">
              {assessment.instructions}
            </p>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="text-xl font-serif font-medium mb-4">Targeted Skills</h3>
        {assessment.skills && assessment.skills.length > 0 ? (
          <div className="grid gap-4">
            {assessment.skills.map((skill, i) => (
              <div key={skill.id || i} className="flex gap-4 p-4 rounded-xl border bg-card hover:bg-muted/10 transition-colors">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {i + 1}
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{skill.title}</h4>
                  {skill.description && (
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {skill.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground italic">No specific skills listed for this assessment.</p>
        )}
      </div>

    </div>
  );
}