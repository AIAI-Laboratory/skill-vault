import { useRef, useState } from 'react';
import {
  Download,
  Upload,
  ShieldCheck,
  Sun,
  Moon,
  Monitor,
  MessageSquare,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { Skill, SkillVaultSettings } from '../../domain/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

interface SettingsProps {
  settings: SkillVaultSettings;
  skills: Skill[];
  onUpdateSettings: (patch: Partial<SkillVaultSettings>) => Promise<void>;
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
}

const providers = [
  { key: 'enableChatGPT', name: 'ChatGPT', domain: 'chatgpt.com' },
  { key: 'enableClaude', name: 'Claude', domain: 'claude.ai' },
  { key: 'enableGemini', name: 'Gemini', domain: 'gemini.google.com' },
] as const;

export function Settings({
  settings,
  skills,
  onUpdateSettings,
  onExport,
  onImport,
}: SettingsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const update = async (patch: Partial<SkillVaultSettings>) => {
    setUpdating(true);
    try {
      await onUpdateSettings(patch);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Make yourself at home.</h1>
        <p className="mt-1 text-muted-foreground">Your vault, your preferences.</p>
      </div>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Your vault at a glance</CardTitle>
          <CardDescription>A small collection with a growing impact.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-3">
            {[
              ['Skills', skills.length],
              ['Favorites', skills.filter((s) => s.favorite).length],
              ['Times used', skills.reduce((sum, skill) => sum + (skill.usage?.count || 0), 0)],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col-reverse gap-1 rounded-lg bg-muted/60 p-3">
                <dt className="text-[11px] text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              AI connections
            </span>
          </CardTitle>
          <CardDescription>Bring your skills into the chats you use.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldSet>
            <FieldLegend className="sr-only">Supported AI providers</FieldLegend>
            <FieldGroup className="gap-4">
              {providers.map((provider, index) => (
                <div key={provider.key} className="flex flex-col gap-4">
                  {index > 0 && <Separator />}
                  <Field orientation="horizontal" data-disabled={updating}>
                    <FieldContent>
                      <FieldLabel htmlFor={provider.key}>{provider.name}</FieldLabel>
                      <FieldDescription>{provider.domain}</FieldDescription>
                    </FieldContent>
                    <Switch
                      id={provider.key}
                      disabled={updating}
                      checked={settings[provider.key]}
                      onCheckedChange={(checked) => void update({ [provider.key]: checked })}
                    />
                  </Field>
                </div>
              ))}
            </FieldGroup>
          </FieldSet>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />A few personal touches
            </span>
          </CardTitle>
          <CardDescription>Set up your everyday workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-5">
            <Field orientation="horizontal" data-disabled={updating}>
              <FieldContent>
                <FieldLabel htmlFor="favorites-first">Favorites first</FieldLabel>
                <FieldDescription>
                  Show starred skills at the top of the command palette.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="favorites-first"
                disabled={updating}
                checked={settings.showFavoritesFirst}
                onCheckedChange={(checked) => void update({ showFavoritesFirst: checked })}
              />
            </Field>
            <Separator />
            <Field data-disabled={updating}>
              <FieldLabel id="appearance-label">Appearance</FieldLabel>
              <ToggleGroup
                aria-labelledby="appearance-label"
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
                  <Sun />
                  Light
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" className="flex-1">
                  <Moon />
                  Dark
                </ToggleGroupItem>
                <ToggleGroupItem value="system" className="flex-1">
                  <Monitor />
                  System
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Keep a copy
            </span>
          </CardTitle>
          <CardDescription>
            Download a JSON backup or import skills from an existing one.
          </CardDescription>
        </CardHeader>
        <CardFooter className="gap-2">
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
        </CardFooter>
      </Card>
      <Alert>
        <ShieldCheck />
        <AlertTitle>Your ideas stay yours</AlertTitle>
        <AlertDescription>
          Skills are stored in this browser. No account, tracking, or cloud sync.
        </AlertDescription>
      </Alert>
    </div>
  );
}
