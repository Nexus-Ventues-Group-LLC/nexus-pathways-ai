import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useGetLearnerHome, useUpdateLearnerPresentationPreferences, getGetLearnerHomeQueryKey } from '@workspace/api-client-react';
import type { LearnerHome } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Settings, Type, Eye, Zap, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const preferencesSchema = z.object({
  textSize: z.enum(['standard', 'large', 'extra-large']),
  highContrast: z.boolean(),
  reduceMotion: z.boolean(),
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export default function LearnerAccessibility() {
  const { data: home, error } = useGetLearnerHome();
  const { mutate: updatePreferences, isPending } = useUpdateLearnerPresentationPreferences();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      textSize: 'standard',
      highContrast: false,
      reduceMotion: false,
    },
  });

  useEffect(() => {
    if (home?.presentationPreferences) {
      form.reset(home.presentationPreferences);
    }
  }, [home?.presentationPreferences, form]);

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Failed to load accessibility settings. Please try again later.</p>
        </div>
      </div>
    );
  }

  const onSubmit = (data: PreferencesFormValues) => {
    updatePreferences({ data }, {
      onSuccess: (updated) => {
        toast({ title: 'Preferences saved successfully' });
        queryClient.setQueryData<LearnerHome>(getGetLearnerHomeQueryKey(), (old) =>
          old ? { ...old, presentationPreferences: updated } : old
        );
      },
      onError: () => {
        toast({ title: 'Failed to save preferences', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="space-y-3 border-b pb-6">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold tracking-tight text-primary flex items-center gap-3">
          <Settings className="h-8 w-8" />
          Accessibility Settings
        </h1>
        <p className="text-lg text-muted-foreground">
          Customize how information is displayed to best suit your needs.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-serif">
                <Type className="h-5 w-5 text-accent" />
                Text Size
              </CardTitle>
              <CardDescription>Adjust the base font size for easier reading.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="textSize"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-2"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer">
                          <FormControl>
                            <RadioGroupItem value="standard" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer flex-1 text-base">
                            Standard
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer">
                          <FormControl>
                            <RadioGroupItem value="large" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer flex-1 text-[1.125rem]">
                            Large
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer">
                          <FormControl>
                            <RadioGroupItem value="extra-large" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer flex-1 text-[1.25rem]">
                            Extra Large
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-serif">
                <Eye className="h-5 w-5 text-accent" />
                Visual Presentation
              </CardTitle>
              <CardDescription>Adjust contrast and motion to reduce visual strain.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="highContrast"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-background">
                    <div className="space-y-0.5 max-w-[80%]">
                      <FormLabel className="text-base font-medium">High Contrast Mode</FormLabel>
                      <FormDescription>
                        Increases the contrast between text, borders, and backgrounds.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-primary"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reduceMotion"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-background">
                    <div className="space-y-0.5 max-w-[80%]">
                      <div className="flex items-center gap-2">
                        <FormLabel className="text-base font-medium">Reduce Motion</FormLabel>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <FormDescription>
                        Disables animations and smooth scrolling.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-primary"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              size="lg" 
              disabled={isPending || !form.formState.isDirty}
              className="px-8"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Preferences
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
