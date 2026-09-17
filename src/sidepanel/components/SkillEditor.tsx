import React, { useState } from 'react';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Skill, CreateSkillInput } from '../../domain/types';
import { isValidShortcut } from '../../domain/skill';
import { DraftSkill, TemplateOption, processAndDetect } from '../../domain/template-detector';

interface SkillEditorProps {
  initialSkill?: Skill | null;
  initialDraftContent?: string;
  draftSkill?: DraftSkill | null;
  draftMeta?: { url?: string; title?: string } | null;
  onSave: (skillData: CreateSkillInput, id?: string) => Promise<void>;
  onCancel: () => void;
}

export const SkillEditor: React.FC<SkillEditorProps> = ({
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

  // Active detected template state
  const [activeFormatInfo, setActiveFormatInfo] = useState<{
    format?: string;
    formatLabel?: string;
    templateOptions?: TemplateOption[];
    selectedTemplateId?: string;
  }>({
    format: draftSkill?.detectedFormat,
    formatLabel: draftSkill?.formatLabel,
    templateOptions: draftSkill?.templateOptions,
    selectedTemplateId: draftSkill?.activeTemplateId || draftSkill?.templateOptions?.[0]?.id,
  });

  const shortcutCheck = isValidShortcut(shortcut);

  const handleInsertVariable = (varName: string) => {
    setContent((prev) => `${prev}{{${varName}}}`);
  };

  const handleSelectTemplate = (tpl: TemplateOption) => {
    setActiveFormatInfo((prev) => ({ ...prev, selectedTemplateId: tpl.id }));
    setName(tpl.name);
    setShortcut(tpl.shortcut);
    setDescription(tpl.description);
    setContent(tpl.content);
    setTagsStr(tpl.tags.join(', '));
  };

  const handleAutoDetectFromContent = () => {
    if (!content.trim()) return;
    const result = processAndDetect(content);
    setActiveFormatInfo({
      format: result.formatInfo.format,
      formatLabel: result.formatInfo.formatLabel,
      templateOptions: result.templates,
      selectedTemplateId: result.primaryTemplate.id,
    });
    setName(result.primaryTemplate.name);
    setShortcut(result.primaryTemplate.shortcut);
    setDescription(result.primaryTemplate.description);
    setContent(result.primaryTemplate.content);
    setTagsStr(result.primaryTemplate.tags.join(', '));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
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
      {activeFormatInfo.formatLabel && (
        <Alert>
          <Wand2 />
          <AlertTitle>{activeFormatInfo.formatLabel} detected</AlertTitle>
          <AlertDescription>
            <p>
              {activeFormatInfo.selectedTemplateId === 'original_selection'
                ? 'Original selection preserved.'
                : 'A matching template has been applied.'}
            </p>
            {activeFormatInfo.templateOptions && activeFormatInfo.templateOptions.length > 1 && (
              <ToggleGroup
                aria-label="Prompt template"
                variant="outline"
                size="sm"
                value={
                  activeFormatInfo.selectedTemplateId ? [activeFormatInfo.selectedTemplateId] : []
                }
                onValueChange={(values) => {
                  const template = activeFormatInfo.templateOptions?.find(
                    (option) => option.id === values[0]
                  );
                  if (template) handleSelectTemplate(template);
                }}
                className="flex-wrap"
              >
                {activeFormatInfo.templateOptions.map((template) => (
                  <ToggleGroupItem
                    key={template.id}
                    value={template.id}
                    title={template.description}
                  >
                    {template.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </AlertDescription>
        </Alert>
      )}
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
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={!content.trim()}
              onClick={handleAutoDetectFromContent}
              title="Detect the content format and fill fields with a matching template"
            >
              <Wand2 data-icon="inline-start" />
              Detect template
            </Button>
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
      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t bg-background/95 px-5 py-4 backdrop-blur-sm">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
          {saving ? 'Saving…' : 'Save skill'}
        </Button>
      </div>
    </form>
  );
};
