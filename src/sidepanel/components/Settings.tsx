import { GeminiKeySettings } from './GeminiKeySettings';
import { normalizeProviderUrl, providerMatchPattern } from '../../domain/custom-provider';
import { Input } from '@/components/ui/input';
import { useRef, useState } from 'react';
import { Plus, Trash2, Download, Upload } from 'lucide-react';
import { SkillVaultSettings } from '../../domain/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Field,
  FieldError,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Spinner } from '@/components/ui/spinner';

interface SettingsProps {
  geminiConfigured: boolean;
  onGeminiKeyChanged: (configured: boolean) => void;
  settings: SkillVaultSettings;
  onUpdateSettings: (patch: Partial<SkillVaultSettings>) => Promise<void>;
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
}

const providers = [
  { key: 'enableChatGPT', name: 'ChatGPT' },
  { key: 'enableClaude', name: 'Claude' },
  { key: 'enableGemini', name: 'Gemini' },
] as const;

export function Settings({
  geminiConfigured,
  onGeminiKeyChanged,
  settings,
  onUpdateSettings,
  onExport,
  onImport,
}: SettingsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [providerUrl, setProviderUrl] = useState('');
  const [providerError, setProviderError] = useState('');
  const [providerNotice, setProviderNotice] = useState('');
  const update = async (patch: Partial<SkillVaultSettings>) => {
    setUpdating(true);
    try {
      await onUpdateSettings(patch);
      return true;
    } catch {
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const addProvider = async () => {
    setProviderError('');
    setProviderNotice('');
    setUpdating(true);
    try {
      const origin = normalizeProviderUrl(providerUrl);
      if (settings.customProviderUrls.includes(origin)) {
        throw new Error('This provider URL is already added.');
      }
      // Request directly from the submit gesture, before any asynchronous work.
      if (typeof chrome !== 'undefined' && chrome.permissions?.request) {
        const granted = await chrome.permissions.request({
          origins: [providerMatchPattern(origin)],
        });
        if (!granted)
          throw new Error('Site access was not granted. Try again to enable this provider.');
      }
      await onUpdateSettings({ customProviderUrls: [...settings.customProviderUrls, origin] });
      setProviderUrl('');
      setProviderNotice('Provider added. Reload its chat page to start using /skill.');
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : 'Could not add provider.');
    } finally {
      setUpdating(false);
    }
  };

  const disabledCustom = settings.disabledCustomProviderUrls ?? [];

  const toggleCustomProvider = (url: string, enabled: boolean) =>
    void update({
      disabledCustomProviderUrls: enabled
        ? disabledCustom.filter((item) => item !== url)
        : [...disabledCustom, url],
    });

  const removeCustomProvider = (url: string) => {
    setProviderNotice('');
    void update({
      customProviderUrls: settings.customProviderUrls.filter((item) => item !== url),
      disabledCustomProviderUrls: disabledCustom.filter((item) => item !== url),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Improve by AI</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <GeminiKeySettings configured={geminiConfigured} onChanged={onGeminiKeyChanged} />
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">AI connections</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldSet>
            <FieldLegend className="sr-only">Supported AI providers</FieldLegend>
            <FieldGroup className="gap-2">
              {providers.map((provider) => (
                <Field
                  key={provider.key}
                  orientation="horizontal"
                  className="items-center rounded-lg bg-muted px-3 py-2.5"
                  data-disabled={updating}
                >
                  <FieldLabel htmlFor={provider.key}>{provider.name}</FieldLabel>
                  <Switch
                    id={provider.key}
                    disabled={updating}
                    checked={settings[provider.key]}
                    onCheckedChange={(checked) => void update({ [provider.key]: checked })}
                  />
                </Field>
              ))}
              {settings.customProviderUrls.map((url, index) => {
                const id = `custom-provider-${index}`;
                const host = new URL(url).host;
                return (
                  <Field
                    key={url}
                    orientation="horizontal"
                    className="items-center rounded-lg bg-muted px-3 py-2.5"
                    data-disabled={updating}
                  >
                    <FieldLabel htmlFor={id} className="min-w-0 flex-1 truncate" title={host}>
                      {host.replace(/^www\./, '')}
                    </FieldLabel>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${url}`}
                        disabled={updating}
                        onClick={() => removeCustomProvider(url)}
                      >
                        <Trash2 />
                      </Button>
                      <Switch
                        id={id}
                        disabled={updating}
                        checked={!disabledCustom.includes(url)}
                        onCheckedChange={(checked) => toggleCustomProvider(url, checked)}
                      />
                    </div>
                  </Field>
                );
              })}
            </FieldGroup>
          </FieldSet>
          <FieldSet className="mt-5 gap-3">
            <FieldLegend className="mb-0 font-semibold">Custom providers</FieldLegend>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void addProvider();
              }}
            >
              <FieldGroup className="gap-3">
                <div className="flex flex-wrap items-end gap-2">
                  <Field
                    className="min-w-0 flex-1"
                    data-invalid={!!providerError}
                    data-disabled={updating}
                  >
                    <FieldLabel className="sr-only" htmlFor="custom-provider-url">
                      Provider URL
                    </FieldLabel>
                    <Input
                      id="custom-provider-url"
                      type="url"
                      className="bg-muted"
                      placeholder="https://chat.example.com"
                      value={providerUrl}
                      disabled={updating}
                      required
                      aria-invalid={!!providerError}
                      aria-describedby={providerError ? 'custom-provider-error' : undefined}
                      onChange={(event) => {
                        setProviderUrl(event.target.value);
                        setProviderError('');
                      }}
                    />
                    {providerError && (
                      <FieldError id="custom-provider-error">{providerError}</FieldError>
                    )}
                  </Field>
                  <Button
                    type="submit"
                    aria-label="Add custom provider"
                    className="h-8 shrink-0 px-4"
                    disabled={updating}
                  >
                    {updating ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Plus data-icon="inline-start" />
                    )}
                    Add
                  </Button>
                </div>
                {providerNotice && (
                  <FieldDescription role="status">{providerNotice}</FieldDescription>
                )}
              </FieldGroup>
            </form>
          </FieldSet>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            aria-label="Appearance"
            variant="outline"
            value={[settings.theme]}
            disabled={updating}
            onValueChange={(values) => {
              const theme = values[0];
              if (theme === 'light' || theme === 'dark' || theme === 'system')
                void update({ theme });
            }}
            className="w-full"
          >
            <ToggleGroupItem value="light" className="flex-1">
              Light
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" className="flex-1">
              Dark
            </ToggleGroupItem>
            <ToggleGroupItem value="system" className="flex-1">
              System
            </ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Back up your skills</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onExport}>
            <Download data-icon="inline-start" />
            Export
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
            {importing ? 'Importing…' : 'Import'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            aria-label="Import skills from JSON"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setImporting(true);
              try {
                await onImport(file);
              } finally {
                setImporting(false);
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
