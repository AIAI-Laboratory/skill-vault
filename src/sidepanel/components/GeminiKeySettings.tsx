import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { SkillRepository } from '../../infrastructure/storage/repository';

export interface GeminiKeySettingsProps {
  configured: boolean;
  onChanged: (configured: boolean) => void;
}

export function GeminiKeySettings({ configured, onChanged }: GeminiKeySettingsProps) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const saveKey = async (remove = false) => {
    if (busy || (!remove && !key.trim())) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!remove && typeof chrome !== 'undefined' && chrome.permissions?.request) {
        const allowed = await chrome.permissions.request({
          origins: ['https://generativelanguage.googleapis.com/*'],
        });
        if (!allowed) throw new Error('Allow access to the Gemini API to enable Improve by AI.');
      }
      await SkillRepository.getInstance().setGeminiApiKey(remove ? '' : key);
      setKey('');
      onChanged(!remove);
      setNotice(
        remove
          ? 'API key removed. Improve by AI is disabled.'
          : 'API key saved. Improve by AI is ready.'
      );
    } catch {
      setError('Could not save the API key. Allow Gemini API access and try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <FieldGroup className="gap-3">
      <Field className="gap-2" data-invalid={Boolean(error)} data-disabled={busy}>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor="gemini-api-key">Gemini API key</FieldLabel>
          <Badge variant="outline">{configured ? 'Saved' : 'Not configured'}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            id="gemini-api-key"
            className="min-w-40 flex-1"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={
              configured ? 'Key saved — enter a replacement' : 'Paste your Gemini API key'
            }
            value={key}
            onChange={(event) => setKey(event.target.value)}
            disabled={busy}
            aria-invalid={Boolean(error)}
            aria-describedby="gemini-key-storage gemini-key-help"
          />
          <Button
            type="button"
            size="lg"
            onClick={() => void saveKey()}
            disabled={busy || !key.trim()}
          >
            {busy && <Spinner data-icon="inline-start" />}
            Save API key
          </Button>
        </div>
        <FieldDescription id="gemini-key-storage">
          Stored in this browser, excluded from backups.
        </FieldDescription>
        <FieldDescription id="gemini-key-help">
          Gemini receives your prompt and skill details only when you use Improve by AI.{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Get an API key
          </a>
          .
        </FieldDescription>
        {error && <FieldError>{error}</FieldError>}
        {notice && (
          <FieldDescription role="status" className="text-[var(--success)]">
            {notice}
          </FieldDescription>
        )}
      </Field>
      {configured && (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          disabled={busy}
          onClick={() => void saveKey(true)}
        >
          <Trash2 data-icon="inline-start" /> Remove key
        </Button>
      )}
    </FieldGroup>
  );
}
