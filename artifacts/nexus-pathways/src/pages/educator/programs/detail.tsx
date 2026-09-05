import { useState } from 'react';
import { useRoute, useParams, Link } from 'wouter';
import { 
  useGetCourse,
  getGetCourseQueryKey
} from '@workspace/api-client-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, BookOpen, Layers, History, Users, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import CourseStructureEditor from '@/components/educator/course-structure-editor';
import CourseDetailsForm from '@/components/educator/course-details-form';
import CourseLifecycleManager from '@/components/educator/course-lifecycle-manager';
import CourseAssignments from '@/components/educator/course-assignments';

export default function EducatorProgramDetail() {
  const params = useParams();
  const courseId = params?.id;
  
  const { data: course, isLoading } = useGetCourse(courseId!, { 
    query: { enabled: !!courseId, queryKey: getGetCourseQueryKey(courseId!) } 
  });

  const getLifecycleColor = (lifecycle: string) => {
    switch (lifecycle) {
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'review': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'approved': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'published': return 'bg-primary text-primary-foreground';
      case 'retired': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted';
    }
  };

  if (!courseId) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <header className="shrink-0 border-b bg-background/95 backdrop-blur z-10 sticky top-0">
        <div className="flex items-center gap-4 px-6 h-16 max-w-screen-2xl mx-auto">
          <Button variant="ghost" size="icon" asChild className="-ml-2 shrink-0">
            <Link href="/educator/programs">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <BookOpen className="size-4" />
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-64" />
            ) : (
              <div className="flex items-center gap-3 truncate">
                <h1 className="text-xl font-serif font-semibold truncate">{course?.title}</h1>
                <Badge variant="outline" className={`font-mono text-xs capitalize shrink-0 ${course ? getLifecycleColor(course.lifecycle) : ''}`}>
                  {course?.lifecycle}
                </Badge>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                  v{course?.currentVersion}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-muted/20">
        <div className="max-w-screen-2xl mx-auto p-6">
          <Tabs defaultValue="structure" className="w-full flex flex-col min-h-[calc(100vh-8rem)]">
            <TabsList className="grid w-full max-w-md grid-cols-4 mb-6 sticky top-6 z-20 shadow-sm border">
              <TabsTrigger value="structure" className="gap-2">
                <Layers className="size-4" />
                <span className="hidden sm:inline">Structure</span>
              </TabsTrigger>
              <TabsTrigger value="details" className="gap-2">
                <Settings className="size-4" />
                <span className="hidden sm:inline">Details</span>
              </TabsTrigger>
              <TabsTrigger value="assignments" className="gap-2">
                <Users className="size-4" />
                <span className="hidden sm:inline">Cohorts</span>
              </TabsTrigger>
              <TabsTrigger value="versions" className="gap-2">
                <History className="size-4" />
                <span className="hidden sm:inline">Versions</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 bg-background rounded-xl border shadow-sm p-6 overflow-hidden">
              <TabsContent value="structure" className="m-0 h-full">
                <CourseStructureEditor courseId={courseId} isReadOnly={course?.lifecycle === 'published' || course?.lifecycle === 'retired' || course?.lifecycle === 'review' || course?.lifecycle === 'approved'} />
              </TabsContent>
              
              <TabsContent value="details" className="m-0">
                <CourseDetailsForm courseId={courseId} />
              </TabsContent>
              
              <TabsContent value="assignments" className="m-0">
                <CourseAssignments courseId={courseId} />
              </TabsContent>
              
              <TabsContent value="versions" className="m-0">
                <CourseLifecycleManager courseId={courseId} course={course} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}