import React, { useEffect, useRef, useState } from 'react';
import { Save, ArrowLeft, Wand2, FileText, AlertCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { TagPicker } from './TagPicker';
import { Textarea } from '@/components/ui/textarea';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
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
import type { SkillFormatDraft } from '../../domain/skill-format';
import { Skill, CreateSkillInput } from '../../domain/types';
import { isValidShortcut } from '../../domain/skill';
import { DEFAULT_COLLECTIONS, getSkillCollection, normalizeCollection } from '../../domain/library';
import type { DraftSkill } from '../../domain/types';

interface SkillEditorProps {
  geminiConfigured: boolean;
  initialSkill?: Skill | null;
  duplicateOf?: Skill | null;
  collections?: string[];
  availableTags?: string[];
  initialDraftContent?: string;
  draftSkill?: DraftSkill | null;
  draftMeta?: { url?: string; title?: string } | null;
  onSave: (skillData: CreateSkillInput, id?: string) => Promise<void>;
  onCancel: () => void;
}

export const SkillEditor: React.FC<SkillEditorProps> = ({
  geminiConfigured,
  initialSkill,
  duplicateOf,
  collections = DEFAULT_COLLECTIONS,
  availableTags = [],
  initialDraftContent,
  draftSkill,
  draftMeta,
  onSave,
  onCancel,
}) => {
  const source = initialSkill ?? duplicateOf;
  const [name, setName] = useState(
    duplicateOf
      ? `${duplicateOf.name} (copy)`
      : initialSkill?.name || draftSkill?.suggestedName || ''
  );
  const [shortcut, setShortcut] = useState(
    duplicateOf ? '' : initialSkill?.shortcut || draftSkill?.suggestedShortcut || ''
  );
  const [description, setDescription] = useState(
    source?.description || draftSkill?.suggestedDescription || ''
  );
  const [content, setContent] = useState(
    source?.content || draftSkill?.content || initialDraftContent || ''
  );
  const [tags, setTags] = useState<string[]>(() => [
    ...new Set(
      (source?.tags || draftSkill?.suggestedTags || [])
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    ),
  ]);
  const [favorite, setFavorite] = useState(initialSkill?.favorite || false);
  const [collection, setCollection] = useState(source ? getSkillCollection(source) : '');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const collectionOptions = [
    ...new Set([...collections, ...(source ? [getSkillCollection(source)] : [])]),
  ].filter(Boolean);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formatting, setFormatting] = useState(false);
  const [formatError, setFormatError] = useState('');
  const [formatPreview, setFormatPreview] = useState<SkillFormatDraft | null>(null);
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
          tags,
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
    setTags(formatPreview.tags);
    setFormatPreview(null);
  };

  const shortcutCheck = isValidShortcut(shortcut);

  const handleInsertVariable = (varName: string) => {
    setFormatPreview(null);
    const token = `{{${varName}}}`;
    const el = document.getElementById('skill-content') as HTMLTextAreaElement | null;
    if (!el) {
      setContent((prev) => `${prev}${token}`);
      return;
    }
    // Insert at the caret (or replace the selection) so users can design the prompt around it.
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? start;
    setContent(content.slice(0, start) + token + content.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
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
          collection:
            collections.find((item) => item.toLowerCase() === collection.trim().toLowerCase()) ??
            normalizeCollection(collection),
          pinned: initialSkill?.pinned ?? false,
          variables: source?.variables ?? [],
          providers: source?.providers,
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
      <div className="flex flex-col gap-3 border-b pb-5">
        <Button
          type="button"
          variant="ghost"
          className="-ml-2 w-fit"
          aria-label="Back to vault"
          onClick={onCancel}
          disabled={saving}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to vault
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="min-w-0 flex-1 text-page font-semibold tracking-tight">
            {initialSkill ? 'Edit skill' : duplicateOf ? 'Duplicate skill' : 'New skill'}
          </h1>
          <Button
            type="button"
            variant="quiet"
            size="icon"
            disabled={saving || formatting}
            aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
            title={favorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={favorite}
            onClick={() => setFavorite((value) => !value)}
          >
            <Star className={cn(favorite && 'fill-current text-primary')} />
          </Button>
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
        <FieldGroup className="gap-4">
          <FieldGroup className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field data-invalid={Boolean(error && !name.trim())}>
              <FieldLabel htmlFor="skill-name">
                Skill name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="skill-name"
                className="h-10"
                placeholder="e.g. Senior code review"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                autoFocus
                aria-invalid={Boolean(error && !name.trim())}
              />
            </Field>
            <Field data-invalid={invalidShortcut}>
              <FieldLabel htmlFor="skill-shortcut" className="text-muted-foreground">
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
                <FieldDescription
                  id="shortcut-hint"
                  className="flex min-w-0 items-baseline gap-1.5"
                >
                  <span className="shrink-0">In chat:</span>
                  <code className="min-w-0 truncate" title={`/skill ${shortcut || 'shortcut'}`}>
                    /skill {shortcut || 'shortcut'}
                  </code>
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
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
                        !geminiConfigured ? 'Configure Improve by AI in Settings' : 'Improve by AI'
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
                    ? 'Add your Gemini API key in Settings → Improve by AI.'
                    : !content.trim()
                      ? 'Write a prompt first.'
                      : 'Improve wording and structure while preserving your original intent.'}
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              id="skill-content"
              className="min-h-52 font-mono text-sm"
              placeholder="Write the instructions you want to reuse…"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              aria-invalid={Boolean(error && !content.trim())}
            />
            <div className="flex flex-wrap gap-1.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="border-primary/40 text-primary"
                      onClick={() => handleInsertVariable('user_input')}
                    />
                  }
                >
                  {'{{user_input}}'}
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Where your selected text goes. Highlight text in a chat, right-click, then choose
                  “Fill selection into Skill…”.
                </TooltipContent>
              </Tooltip>
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
          <FieldSet className="gap-4">
            <FieldLegend className="mb-3 text-section font-semibold">Details</FieldLegend>
            <FieldGroup className="gap-4">
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
              <Field className="gap-2">
                <FieldLabel htmlFor="skill-collection">Collection</FieldLabel>
                <NativeSelect
                  id="skill-collection"
                  className="w-full"
                  value={creatingCollection ? '__create_collection__' : collection}
                  onChange={(event) => {
                    const creating = event.target.value === '__create_collection__';
                    setCreatingCollection(creating);
                    setCollection(creating ? '' : event.target.value);
                  }}
                >
                  <NativeSelectOption value="">Unassigned</NativeSelectOption>
                  {collectionOptions.map((name) => (
                    <NativeSelectOption key={name} value={name}>
                      {name}
                    </NativeSelectOption>
                  ))}
                  <NativeSelectOption value="__create_collection__">
                    + New collection…
                  </NativeSelectOption>
                </NativeSelect>
                {creatingCollection && (
                  <Input
                    id="skill-new-collection"
                    aria-label="New collection name"
                    placeholder="Collection name"
                    maxLength={64}
                    value={collection}
                    onChange={(event) => setCollection(event.target.value)}
                    autoFocus
                  />
                )}
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="skill-tags">Tags</FieldLabel>
                <TagPicker
                  tags={tags}
                  availableTags={availableTags}
                  disabled={formatting || saving}
                  onChange={(next) => {
                    setTags(next);
                    setFormatPreview(null);
                  }}
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>
      </fieldset>
      {formatError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not format this skill</AlertTitle>
          <AlertDescription>{formatError}</AlertDescription>
        </Alert>
      )}
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
      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background py-4">
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
