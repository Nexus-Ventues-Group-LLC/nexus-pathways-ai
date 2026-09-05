import { useState } from 'react';
import { useGetAdminHierarchy, useCreateProgram, useUpdateProgram, getGetAdminHierarchyQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, GraduationCap, Edit2, MapPin, Building } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const createProgramSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  facilityId: z.string().min(1, 'Facility is required'),
});

const updateProgramSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export default function AdminPrograms() {
  const { data: hierarchy, isLoading } = useGetAdminHierarchy();
  
  if (isLoading) {
    return (
      <div className="p-8 flex justify-center h-full items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hierarchy) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardHeader><CardTitle className="text-destructive">Data Unavailable</CardTitle></CardHeader>
        </Card>
      </div>
    );
  }

  // Flatten programs for table
  const programs = hierarchy.agencies.flatMap(agency => 
    agency.regions.flatMap(region => 
      region.facilities.flatMap(facility => 
        facility.programs.map(program => ({
          ...program,
          facilityName: facility.name,
          regionName: region.name,
          agencyName: agency.name
        }))
      )
    )
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Programs</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage educational programs across authorized facilities.
          </p>
        </div>
        <CreateProgramDialog hierarchy={hierarchy} />
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {programs.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No programs found in your authorized scope.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[300px]">Program Name</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-muted-foreground" />
                      {program.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building className="w-3 h-3" />
                        {program.facilityName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {program.regionName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal text-xs">{program.agencyName}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <UpdateProgramDialog program={program} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateProgramDialog({ hierarchy }: { hierarchy: any }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createProgram = useCreateProgram();

  const form = useForm<z.infer<typeof createProgramSchema>>({
    resolver: zodResolver(createProgramSchema),
    defaultValues: { name: '', facilityId: '' },
  });

  const onSubmit = (values: z.infer<typeof createProgramSchema>) => {
    createProgram.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminHierarchyQueryKey() });
        toast({ title: 'Program Created', description: `${values.name} has been added.` });
        setOpen(false);
        form.reset();
      },
      onError: (err: any) => {
        toast({ title: 'Creation Failed', description: err.error || 'An error occurred.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-sm" data-testid="button-create-program">
          <Plus className="w-4 h-4" /> New Program
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Program</DialogTitle>
          <DialogDescription>Add a new program to an authorized facility.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="facilityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Facility</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-facility">
                        <SelectValue placeholder="Select a facility..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hierarchy.agencies.map((agency: any) => 
                        agency.regions.map((region: any) => (
                          <SelectGroup key={`${agency.id}-${region.id}`}>
                            <SelectLabel className="font-semibold text-primary/70">{region.name}</SelectLabel>
                            {region.facilities.map((facility: any) => (
                              <SelectItem key={facility.id} value={facility.id}>{facility.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., HVAC Certification" {...field} data-testid="input-program-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={createProgram.isPending} data-testid="button-submit-program">
                {createProgram.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Program
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function UpdateProgramDialog({ program }: { program: any }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateProgram = useUpdateProgram();

  const form = useForm<z.infer<typeof updateProgramSchema>>({
    resolver: zodResolver(updateProgramSchema),
    defaultValues: { name: program.name },
  });

  const onSubmit = (values: z.infer<typeof updateProgramSchema>) => {
    updateProgram.mutate({ programId: program.id, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminHierarchyQueryKey() });
        toast({ title: 'Program Updated', description: 'Changes saved successfully.' });
        setOpen(false);
      },
      onError: (err: any) => {
        toast({ title: 'Update Failed', description: err.error || 'An error occurred.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (val) form.reset({ name: program.name });
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary" data-testid={`button-edit-program-${program.id}`}>
          <Edit2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Program</DialogTitle>
          <DialogDescription>Update details for {program.name}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-program-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={updateProgram.isPending} data-testid="button-save-program">
                {updateProgram.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}