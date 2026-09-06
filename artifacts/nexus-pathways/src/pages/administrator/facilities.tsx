import { useState } from 'react';
import { useGetAdminHierarchy, useCreateFacility, useUpdateFacility, getGetAdminHierarchyQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Building, Edit2, MapPin } from 'lucide-react';
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

const createFacilitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  regionId: z.string().min(1, 'Region is required'),
});

const updateFacilitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export default function AdminFacilities() {
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

  // Flatten facilities for table
  const facilities = hierarchy.agencies.flatMap(agency => 
    agency.regions.flatMap(region => 
      region.facilities.map(facility => ({
        ...facility,
        regionName: region.name,
        agencyName: agency.name
      }))
    )
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Facilities</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage operational facilities within authorized regions.
          </p>
        </div>
        <CreateFacilityDialog hierarchy={hierarchy} />
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {facilities.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No facilities found in your authorized scope.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[300px]">Facility Name</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Programs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facilities.map((facility) => (
                  <TableRow key={facility.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      {facility.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {facility.regionName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal text-xs">{facility.agencyName}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal text-xs bg-accent/10 text-accent-foreground">
                        {facility.programs.length} active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <UpdateFacilityDialog facility={facility} />
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

function CreateFacilityDialog({ hierarchy }: { hierarchy: any }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createFacility = useCreateFacility();

  const form = useForm<z.infer<typeof createFacilitySchema>>({
    resolver: zodResolver(createFacilitySchema),
    defaultValues: { name: '', regionId: '' },
  });

  const onSubmit = (values: z.infer<typeof createFacilitySchema>) => {
    createFacility.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminHierarchyQueryKey() });
        toast({ title: 'Facility Created', description: `${values.name} has been added.` });
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
        <Button className="gap-2 shadow-sm" data-testid="button-create-facility">
          <Plus className="w-4 h-4" /> New Facility
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Facility</DialogTitle>
          <DialogDescription>Add a new facility to an existing authorized region.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="regionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Region</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-region">
                        <SelectValue placeholder="Select a region..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hierarchy.agencies.map((agency: any) => (
                        <SelectGroup key={agency.id}>
                          <SelectLabel className="font-semibold text-primary/70">{agency.name}</SelectLabel>
                          {agency.regions.map((region: any) => (
                            <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
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
                  <FormLabel>Facility Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., North State Correctional" {...field} data-testid="input-facility-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={createFacility.isPending} data-testid="button-submit-facility">
                {createFacility.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Facility
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function UpdateFacilityDialog({ facility }: { facility: any }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateFacility = useUpdateFacility();

  const form = useForm<z.infer<typeof updateFacilitySchema>>({
    resolver: zodResolver(updateFacilitySchema),
    defaultValues: { name: facility.name },
  });

  const onSubmit = (values: z.infer<typeof updateFacilitySchema>) => {
    updateFacility.mutate({ facilityId: facility.id, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminHierarchyQueryKey() });
        toast({ title: 'Facility Updated', description: 'Changes saved successfully.' });
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
      if (val) form.reset({ name: facility.name });
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary" data-testid={`button-edit-facility-${facility.id}`}>
          <Edit2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Facility</DialogTitle>
          <DialogDescription>Update details for {facility.name}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Facility Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-facility-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={updateFacility.isPending} data-testid="button-save-facility">
                {updateFacility.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}