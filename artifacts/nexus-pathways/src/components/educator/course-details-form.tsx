import { useEffect, useRef, useState, useCallback } from 'react';
import { useGetCourse, useUpdateCourse, getGetCourseQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Save } from 'lucide-react';

export default function CourseDetailsForm({ courseId }: { courseId: string }) {
  const { data: course, isLoading } = useGetCourse(courseId);
  const updateCourse = useUpdateCourse();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const initializedForId = useRef<string | null>(null);

  useEffect(() => {
    if (course && initializedForId.current !== courseId) {
      initializedForId.current = courseId;
      setTitle(course.title);
      setDescription(course.description || '');
    }
  }, [course, courseId]);

  const handleSave = () => {
    if (!title.trim()) return;

    updateCourse.mutate(
      { courseId, data: { title, description } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetCourseQueryKey(courseId), (old: any) => 
            old ? { ...old, title: data.title, description: data.description } : old
          );
          toast({ title: 'Course details updated' });
        },
        onError: () => {
          toast({ title: 'Failed to update details', variant: 'destructive' });
        }
      }
    );
  };

  const isDirty = course && (title !== course.title || description !== (course.description || ''));

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-1/3" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-2xl font-serif font-semibold">Course Details</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Update the high-level information for this learning pathway.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Course Title</Label>
          <Input 
            id="title" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            placeholder="Course Title"
            className="max-w-md"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea 
            id="description" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="Detailed description of the course content and objectives..."
            rows={8}
          />
        </div>

        <div className="pt-4 flex items-center gap-4">
          <Button onClick={handleSave} disabled={!isDirty || !title.trim() || updateCourse.isPending} className="gap-2">
            <Save className="size-4" />
            {updateCourse.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
          {isDirty && (
            <span className="text-sm text-muted-foreground">Unsaved changes</span>
          )}
        </div>
      </div>
    </div>
  );
}