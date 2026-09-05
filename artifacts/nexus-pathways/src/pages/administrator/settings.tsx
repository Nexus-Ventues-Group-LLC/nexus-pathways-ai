import { useState, useEffect } from 'react';
import {
  getGetTenantConfigurationQueryKey,
  useGetTenantConfiguration,
  useUpdateTenantConfiguration,
  type TenantConfigurationModules,
  type TenantConfigurationPolicies,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Settings, Save, AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AdminSettings() {
  const { data: config, isLoading, error } = useGetTenantConfiguration();
  const updateConfig = useUpdateTenantConfiguration();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [modules, setModules] = useState<TenantConfigurationModules>({
    abe: true,
    hse: true,
    specialEducation: false,
    accessibility: true,
    aiTutor: false,
    career: false,
    reentry: false,
    passport: false,
    offlineMode: false,
  });
  const [policies, setPolicies] = useState<TenantConfigurationPolicies>({
    sessionTimeoutMinutes: 60,
    inactivityTimeoutMinutes: 30,
  });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (config) {
      setModules(config.modules || {});
      setPolicies(config.policies || {});
      setIsDirty(false);
    }
  }, [config]);

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center h-full items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load tenant configuration. You may not have the required permissions.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleModuleChange = (key: keyof TenantConfigurationModules, checked: boolean) => {
    setModules(prev => ({ ...prev, [key]: checked }));
    setIsDirty(true);
  };

  const handlePolicyChange = (key: keyof TenantConfigurationPolicies, value: number) => {
    setPolicies(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    updateConfig.mutate({ data: { modules, policies } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTenantConfigurationQueryKey() });
        toast({ title: 'Settings Updated', description: 'Tenant configuration has been saved.' });
        setIsDirty(false);
      },
      onError: (err: any) => {
        toast({ title: 'Update Failed', description: err.error || 'An error occurred.', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-5 h-5 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-primary">Configuration</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage tenant module flags and operational policies.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!isDirty || updateConfig.isPending} className="gap-2 shadow-sm" data-testid="button-save-settings">
          {updateConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-sm">
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle>Feature Modules</CardTitle>
            <CardDescription>Enable or disable major subsystems for this tenant.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {Object.keys(modules).length === 0 ? (
              <div className="text-sm text-muted-foreground italic">No modules available to configure.</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(modules).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor={`module-${key}`} className="text-base">{formatKey(key)}</Label>
                      <p className="text-sm text-muted-foreground">Toggle availability of the {key} subsystem.</p>
                    </div>
                    <Switch 
                      id={`module-${key}`} 
                      checked={value} 
                      onCheckedChange={(checked) => handleModuleChange(key as keyof TenantConfigurationModules, checked)}
                      data-testid={`switch-module-${key}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle>Security Policies</CardTitle>
            <CardDescription>Operational constraints and limits.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {Object.keys(policies).length === 0 ? (
              <div className="text-sm text-muted-foreground italic">No policies available to configure.</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(policies).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-2">
                    <Label htmlFor={`policy-${key}`}>{formatKey(key)}</Label>
                    {typeof value === 'number' ? (
                      <Input 
                        id={`policy-${key}`}
                        type="number"
                        value={value}
                        onChange={(e) => handlePolicyChange(key as keyof TenantConfigurationPolicies, Number(e.target.value))}
                        className="max-w-md"
                        data-testid={`input-policy-${key}`}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/_/g, ' ');
}