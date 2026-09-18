import React, { useEffect, useRef, useState } from 'react';
import { Save, ArrowLeft, Wand2, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { GeminiKeySettings } from './GeminiKeySettings';
import type { SkillFormatDraft } from '../../domain/skill-format';
import { Skill, CreateSkillInput } from '../../domain/types';
import { isValidShortcut } from '../../domain/skill';
import type { DraftSkill } from '../../domain/types';

interface SkillEditorProps {
  geminiConfigured: boolean;
  onGeminiKeyChanged: (configured: boolean) => void;
  initialSkill?: Skill | null;
  initialDraftContent?: string;
  draftSkill?: DraftSkill | null;
  draftMeta?: { url?: string; title?: string } | null;
  onSave: (skillData: CreateSkillInput, id?: string) => Promise<void>;
  onCancel: () => void;
}

export const SkillEditor: React.FC<SkillEditorProps> = ({
  geminiConfigured,
  onGeminiKeyChanged,
  initialSkill,
  initialDraftContent,
  draftSkill,
  draftMeta,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(initialSkill?.name || draftSkill?.suggestedName || '');
  const [shortcut, setShortcut] = useState(
    initialSkill?.shortcut || draftSkill?.suggestedShortcut || ''
  );
  const [description, setDescription] = useState(
    initialSkill?.description || draftSkill?.suggestedDescription || ''
  );
  const [content, setContent] = useState(
    initialSkill?.content || draftSkill?.content || initialDraftContent || ''
  );
  const [tagsStr, setTagsStr] = useState(
    (initialSkill?.tags || draftSkill?.suggestedTags || []).join(', ')
  );
  const [favorite, setFavorite] = useState(initialSkill?.favorite || false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formatting, setFormatting] = useState(false);
  const [formatError, setFormatError] = useState('');
  const [formatPreview, setFormatPreview] = useState<SkillFormatDraft | null>(null);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const formatRequest = useRef<AbortController | null>(null);
  const aiFormatButtonRef = useRef<HTMLButtonElement>(null);
  const reviewTitleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => formatRequest.current?.abort(), []);

  const handleAiFormat = async () => {
    if (!geminiConfigured || !content.trim() || formatting || saving) return;
    const controller = new AbortController();
    formatRequest.current = controller;
    setFormatting(true);
    setFormatError('');
    setFormatPreview(null);
    try {
      const { formatSkillWithGemini } = await import('../../infrastructure/ai/gemini-format');
      const result = await formatSkillWithGemini(
        {
          id: initialSkill?.id,
          name,
          shortcut,
          description,
          content,
          tags: tagsStr
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
        controller.signal
      );
      if (!controller.signal.aborted) setFormatPreview(result);
    } catch (error) {
      if (!controller.signal.aborted)
        setFormatError(error instanceof Error ? error.message : 'Could not format this skill.');
    } finally {
      if (!controller.signal.aborted) setFormatting(false);
    }
  };

  const applyFormat = () => {
    if (!formatPreview) return;
    setName(formatPreview.name);
    setShortcut(formatPreview.shortcut);
    setDescription(formatPreview.description);
    setContent(formatPreview.content);
    setTagsStr(formatPreview.tags.join(', '));
    setFormatPreview(null);
  };

  const shortcutCheck = isValidShortcut(shortcut);

  const handleInsertVariable = (varName: string) => {
    setFormatPreview(null);
    setContent((prev) => `${prev}{{${varName}}}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formatting || saving) return;
    setError(null);

    if (!name.trim()) {
      setError('Skill name is required.');
      return;
    }

    if (!content.trim()) {
      setError('Prompt content cannot be empty.');
      return;
    }

    if (shortcut && !shortcutCheck.valid) {
      setError(shortcutCheck.error || 'Invalid shortcut.');
      return;
    }

    const tags = tagsStr
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    setSaving(true);
    try {
      await onSave(
        {
          name: name.trim(),
          shortcut: shortcut.trim() ? shortcut.trim().toLowerCase() : undefined,
          description: description.trim(),
          content,
          tags,
          favorite,
          variables: initialSkill?.variables ?? [],
          providers: initialSkill?.providers,
        },
        initialSkill?.id
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to save skill.');
    } finally {
      setSaving(false);
    }
  };

  const invalidShortcut = Boolean(shortcut && !shortcutCheck.valid);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={handleSubmit}
      onChange={() => setFormatPreview(null)}
    >
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={onCancel}
          disabled={saving}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to vault
        </Button>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            A prompt worth keeping
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {initialSkill ? 'Refine your skill.' : 'Create something reusable.'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Give your best instructions a permanent home.
          </p>
        </div>
      </div>
      {draftMeta && (
        <Alert>
          <FileText />
          <AlertTitle>Saved from a webpage</AlertTitle>
          <AlertDescription className="break-words">
            {draftMeta.title || draftMeta.url || 'Webpage selection'}
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not save this skill</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <fieldset disabled={formatting || saving} className="contents">
        <FieldGroup className="gap-5">
          <Field data-invalid={Boolean(error && !name.trim())}>
            <FieldLabel htmlFor="skill-name">
              Skill name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="skill-name"
              placeholder="e.g. Senior code review"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
              aria-invalid={Boolean(error && !name.trim())}
            />
          </Field>
          <Field data-invalid={invalidShortcut}>
            <FieldLabel htmlFor="skill-shortcut">
              Shortcut <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>/</InputGroupAddon>
              <InputGroupInput
                id="skill-shortcut"
                placeholder="review"
                value={shortcut}
                onChange={(event) =>
                  setShortcut(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }
                aria-invalid={invalidShortcut}
                aria-describedby="shortcut-hint"
              />
            </InputGroup>
            {invalidShortcut ? (
              <FieldError id="shortcut-hint">{shortcutCheck.error}</FieldError>
            ) : (
              <FieldDescription id="shortcut-hint">
                Find it in your AI chat with <code>/skill {shortcut || 'shortcut'}</code>.
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="skill-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id="skill-description"
              placeholder="What does this skill help you do?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Separator />
          <Field data-invalid={Boolean(error && !content.trim())}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel htmlFor="skill-content">
                Prompt <span className="text-destructive">*</span>
              </FieldLabel>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      tabIndex={0}
                      className="inline-flex"
                      aria-label={
                        !geminiConfigured
                          ? 'Add a Gemini API key to enable Improve by AI'
                          : 'Improve by AI'
                      }
                    />
                  }
                >
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    disabled={!geminiConfigured || !content.trim() || formatting || saving}
                    ref={aiFormatButtonRef}
                    onClick={() => void handleAiFormat()}
                  >
                    {formatting ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Wand2 data-icon="inline-start" />
                    )}
                    {formatting ? 'Formatting…' : 'Improve by AI'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!geminiConfigured
                    ? 'Add a Gemini API key to enable Improve by AI.'
                    : !content.trim()
                      ? 'Write a prompt first.'
                      : 'Improve wording and structure while preserving your original intent.'}
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              id="skill-content"
              className="min-h-52"
              placeholder="Write the instructions you want to reuse…"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              aria-invalid={Boolean(error && !content.trim())}
              aria-describedby="variables-hint"
            />
            <FieldDescription id="variables-hint">
              Make it dynamic. Insert a variable to fill in context when the skill runs.
            </FieldDescription>
            <div className="flex flex-wrap gap-1.5">
              {['selected_text', 'current_date', 'page_title', 'page_url'].map((variable) => (
                <Button
                  key={variable}
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => handleInsertVariable(variable)}
                >{`{{${variable}}}`}</Button>
              ))}
            </div>
          </Field>
          <Separator />
          <Field>
            <FieldLabel htmlFor="skill-tags">Tags</FieldLabel>
            <Input
              id="skill-tags"
              placeholder="coding, review, productivity"
              value={tagsStr}
              onChange={(event) => setTagsStr(event.target.value)}
              aria-describedby="tags-hint"
            />
            <FieldDescription id="tags-hint">
              Separate tags with commas to keep your library organized.
            </FieldDescription>
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="skill-favorite">Add to favorites</FieldLabel>
              <FieldDescription>Keep this skill within easy reach.</FieldDescription>
            </FieldContent>
            <Switch id="skill-favorite" checked={favorite} onCheckedChange={setFavorite} />
          </Field>
        </FieldGroup>
      </fieldset>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={formatting || saving}
            onClick={() => setKeyDialogOpen(true)}
          >
            {geminiConfigured ? 'Manage API key' : 'Add API key'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          AI improves wording and structure while keeping your intent and requirements. Review
          suggestions before applying. Your prompt and library metadata are sent to Gemini.
        </p>
        {formatError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Could not format this skill</AlertTitle>
            <AlertDescription>{formatError}</AlertDescription>
          </Alert>
        )}
      </div>
      <Dialog
        open={Boolean(formatPreview)}
        onOpenChange={(open) => {
          if (!open) setFormatPreview(null);
        }}
      >
        <DialogContent
          className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-xl"
          initialFocus={reviewTitleRef}
          finalFocus={aiFormatButtonRef}
        >
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle ref={reviewTitleRef} tabIndex={-1}>
              Review AI suggestions
            </DialogTitle>
            <DialogDescription>
              Review the result before applying. Nothing is saved until you click Save skill.
            </DialogDescription>
          </DialogHeader>
          {formatPreview && (
            <>
              <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 break-words">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd>{formatPreview.name}</dd>
                  <dt className="text-muted-foreground">Description</dt>
                  <dd>{formatPreview.description}</dd>
                  <dt className="text-muted-foreground">Shortcut</dt>
                  <dd>/{formatPreview.shortcut}</dd>
                  <dt className="text-muted-foreground">Tags</dt>
                  <dd>{formatPreview.tags.join(', ')}</dd>
                </dl>
                <Field>
                  <FieldLabel htmlFor="formatted-prompt">Suggested prompt</FieldLabel>
                  <Textarea
                    id="formatted-prompt"
                    value={formatPreview.content}
                    readOnly
                    className="h-[35dvh] min-h-40 resize-none"
                  />
                </Field>
              </div>
              <DialogFooter className="shrink-0 flex-row justify-end">
                <Button type="button" variant="outline" onClick={() => setFormatPreview(null)}>
                  Discard
                </Button>
                <Button type="button" onClick={applyFormat}>
                  Apply format
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gemini API key</DialogTitle>
            <DialogDescription>Enable Improve by AI for your skills.</DialogDescription>
          </DialogHeader>
          <GeminiKeySettings configured={geminiConfigured} onChanged={onGeminiKeyChanged} />
        </DialogContent>
      </Dialog>
      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t bg-background/95 px-5 py-4 backdrop-blur-sm">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || formatting}>
          {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
          {saving ? 'Saving…' : 'Save skill'}
        </Button>
      </div>
    </form>
  );
};
