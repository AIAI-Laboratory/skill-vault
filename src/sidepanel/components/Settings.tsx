import { GeminiKeySettings } from './GeminiKeySettings';
import { normalizeProviderUrl, providerMatchPattern } from '../../domain/custom-provider';
import { Input } from '@/components/ui/input';
import { useRef, useState } from 'react';
import { Plus, Trash2, Download, Upload } from 'lucide-react';
import { SkillVaultSettings } from '../../domain/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
    <div className="settings-page">
      <header className="mb-6">
        <h1 className="text-page font-semibold tracking-tight">Settings</h1>
      </header>
      <section className="settings-section" aria-labelledby="appearance-title">
        <h2 id="appearance-title" className="text-section font-semibold">
          Appearance
        </h2>
        <ToggleGroup
          aria-label="Appearance"
          variant="outline"
          value={[settings.theme]}
          disabled={updating}
          onValueChange={(values) => {
            const theme = values[0];
            if (theme === 'light' || theme === 'dark' || theme === 'system') void update({ theme });
          }}
          className="w-full sm:w-fit"
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
      </section>
      <Separator />
      <section className="settings-section" aria-labelledby="connections-title">
        <div className="flex flex-col gap-1.5">
          <h2 id="connections-title" className="text-section font-semibold">
            AI connections
          </h2>
          <p className="text-helper text-muted-foreground">
            Choose where <code>/skill</code> is available in your browser.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <FieldSet>
            <FieldLegend className="sr-only">Supported AI providers</FieldLegend>
            <FieldGroup className="divide-y divide-border/60 gap-0">
              {providers.map((provider) => (
                <Field
                  key={provider.key}
                  orientation="horizontal"
                  className="min-h-10 items-center py-2"
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
            </FieldGroup>
          </FieldSet>
          <FieldSet className="mt-2 gap-3">
            <FieldLegend className="sr-only">Custom providers</FieldLegend>
            <div className="flex flex-col gap-4">
              {settings.customProviderUrls.map((url, index) => {
                const id = `custom-provider-${index}`;
                const host = new URL(url).host;
                return (
                  <Field
                    key={url}
                    orientation="horizontal"
                    className="items-center"
                    data-disabled={updating}
                  >
                    <FieldLabel htmlFor={id} className="min-w-0 flex-1 truncate" title={host}>
                      {host.replace(/^www\./, '')}
                    </FieldLabel>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="quiet"
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
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void addProvider();
                }}
              >
                <FieldGroup>
                  <Field className="gap-2" data-invalid={!!providerError} data-disabled={updating}>
                    <FieldLabel htmlFor="custom-provider-url">Custom provider URL</FieldLabel>
                    <div className="flex min-w-0 gap-2">
                      <Input
                        id="custom-provider-url"
                        type="url"
                        placeholder="https://chat.example.com"
                        value={providerUrl}
                        className="min-w-0 flex-1"
                        disabled={updating}
                        required
                        aria-invalid={!!providerError}
                        aria-describedby={providerError ? 'custom-provider-error' : undefined}
                        onChange={(event) => {
                          setProviderUrl(event.target.value);
                          setProviderError('');
                        }}
                      />
                      <Button
                        type="submit"
                        variant="secondary"
                        size="lg"
                        aria-label="Add custom provider"
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
                    {providerError && (
                      <FieldError id="custom-provider-error">{providerError}</FieldError>
                    )}
                    {providerNotice && (
                      <FieldDescription role="status" className="text-[var(--success)]">
                        {providerNotice}
                      </FieldDescription>
                    )}
                  </Field>
                </FieldGroup>
              </form>
            </div>
          </FieldSet>
        </div>
      </section>
      <Separator />
      <section className="settings-section" aria-labelledby="improve-title">
        <div className="flex flex-col gap-1.5">
          <h2 id="improve-title" className="text-section font-semibold">
            Improve by AI
          </h2>
          <p className="text-helper text-muted-foreground">
            Use Gemini to refine prompts in the skill editor.
          </p>
        </div>
        <GeminiKeySettings configured={geminiConfigured} onChanged={onGeminiKeyChanged} />
      </section>
      <Separator />
      <section className="settings-section" aria-labelledby="backup-title">
        <div className="flex flex-col gap-1.5">
          <h2 id="backup-title" className="text-section font-semibold">
            Back up your skills
          </h2>
          <p className="text-helper text-muted-foreground">Export or restore your vault as JSON.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onExport}>
            <Download data-icon="inline-start" />
            Export
          </Button>
          <Button
            variant="outline"
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
        </div>
      </section>
    </div>
  );
}
