import { useState } from 'react';
import { Link } from 'wouter';
import { 
  useListCourses, 
  useCreateCourse,
  getGetCourseQueryKey,
  getListCoursesQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, BookOpen, Clock, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function EducatorProgramsList() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  
  const { data: courses, isLoading } = useListCourses();
  const createCourse = useCreateCourse();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    
    createCourse.mutate(
      { data: { title: newTitle, description: newDescription } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
          setIsCreateOpen(false);
          setNewTitle('');
          setNewDescription('');
          toast({ title: 'Course created successfully' });
        },
        onError: () => {
          toast({ title: 'Failed to create course', variant: 'destructive' });
        }
      }
    );
  };

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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight">Curriculum Programs</h1>
          <p className="text-muted-foreground mt-1">Manage learning pathways, courses, and course structures.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              <span>Create Course</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Course</DialogTitle>
              <DialogDescription>
                Define the high-level details of a new learning pathway.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input 
                  id="title" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)} 
                  placeholder="e.g. Advanced Mathematics" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  value={newDescription} 
                  onChange={(e) => setNewDescription(e.target.value)} 
                  placeholder="Brief overview of the course objectives..." 
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newTitle.trim() || createCourse.isPending}>
                {createCourse.isPending ? 'Creating...' : 'Create Course'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="flex flex-col h-full">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </CardHeader>
              <CardContent className="mt-auto">
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : courses?.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/20">
          <BookOpen className="size-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">No courses found</h3>
          <p className="text-muted-foreground mt-1 mb-6 max-w-sm mx-auto">
            You haven't created any courses yet. Start by creating a new curriculum pathway.
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>Create First Course</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses?.map(course => (
            <Card key={course.id} className="flex flex-col hover-elevate transition-all duration-200 border-muted">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className={`font-mono text-xs capitalize ${getLifecycleColor(course.lifecycle)}`}>
                    {course.lifecycle}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                    v{course.currentVersion}
                  </span>
                </div>
                <CardTitle className="line-clamp-2 leading-tight">{course.title}</CardTitle>
                <CardDescription className="line-clamp-3 mt-2 text-sm">
                  {course.description || 'No description provided.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pb-4">
                {course.publishedAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4">
                    <Clock className="size-3" />
                    <span>Published {format(new Date(course.publishedAt), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-0 border-t bg-muted/10 p-4 mt-2">
                <Link href={`/educator/programs/${course.id}`} className="w-full">
                  <Button variant="secondary" className="w-full">
                    Manage Curriculum
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}