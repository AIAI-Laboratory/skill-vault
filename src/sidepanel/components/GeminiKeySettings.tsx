import { useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <FieldGroup>
      <Field data-invalid={Boolean(error)} data-disabled={busy}>
        <FieldLabel htmlFor="gemini-api-key">Gemini API key</FieldLabel>
        <Input
          id="gemini-api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={configured ? 'Key saved — enter a replacement' : 'Paste your Gemini API key'}
          value={key}
          onChange={(event) => setKey(event.target.value)}
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby="gemini-key-help"
        />
        <FieldDescription id="gemini-key-help">
          Saved only in this browser, excluded from backups. When you click Improve by AI, your
          prompt and library metadata are sent to Gemini.{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Get an API key
          </a>
          .
        </FieldDescription>
        {error && <FieldError>{error}</FieldError>}
        {notice && <FieldDescription role="status">{notice}</FieldDescription>}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void saveKey()} disabled={busy || !key.trim()}>
          {busy ? <Spinner data-icon="inline-start" /> : <KeyRound data-icon="inline-start" />}
          Save API key
        </Button>
        {configured && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void saveKey(true)}
          >
            <Trash2 data-icon="inline-start" /> Remove key
          </Button>
        )}
      </div>
    </FieldGroup>
  );
}
