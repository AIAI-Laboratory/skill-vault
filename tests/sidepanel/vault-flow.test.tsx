// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../../src/sidepanel/App';
import { sendExtensionMessage } from '../../src/infrastructure/messaging/client';
import { SKILL_DRAG_TYPE } from '../../src/infrastructure/skill-drag';

let container: HTMLDivElement;
let root: Root;
const copy = vi.fn().mockResolvedValue(undefined);
const byLabel = (label: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const byText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button, [role="menuitem"]')].find(
    (item) => item.textContent?.trim() === text
  )!;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  vi.stubGlobal('chrome', undefined);
  vi.stubGlobal('location', new URL('http://localhost:5173'));
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(copy);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  for (let index = 1; index <= 21; index++) {
    await sendExtensionMessage('SKILL_CREATE', {
      name: `Batch skill ${index}`,
      content: `Prompt ${index}`,
      tags: ['batch'],
      favorite: false,
      variables: [],
    });
  }
  await sendExtensionMessage('SKILL_CREATE', {
    name: 'Unique skill',
    collection: 'Research',
    shortcut: 'only-command',
    content: 'Preserve this exact prompt.\n{{user_input}}',
    tags: ['test'],
    favorite: false,
    variables: [{ key: 'user_input', label: 'Input', type: 'textarea', required: true }],
    providers: [{ provider: 'ChatGPT', enabled: true }],
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<App />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  copy.mockClear();
});

it('finds a skill by command, reveals its prompt and copies the exact content', async () => {
  const search = document.querySelector<HTMLInputElement>('input[aria-label="Search skills"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      search,
      '/only-command'
    );
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(container.querySelectorAll('.skill-row')).toHaveLength(1);
  const summary = byLabel('View prompt for Unique skill');
  expect(summary.getAttribute('aria-expanded')).toBe('false');
  await act(async () => summary.click());
  expect(summary.getAttribute('aria-expanded')).toBe('true');
  expect(document.querySelector('pre[aria-label="Prompt for Unique skill"]')?.textContent).toBe(
    'Preserve this exact prompt.\n{{user_input}}'
  );
  await act(async () => byLabel('Copy Unique skill prompt').click());
  expect(copy).toHaveBeenCalledWith('Preserve this exact prompt.\n{{user_input}}');
  expect(byLabel('Copied Unique skill')).toBeTruthy();
  expect(summary.closest('li')!.querySelector('[role="status"]')?.textContent).toBe('Copied');
  expect(document.querySelector('[data-slot="toast"]')).toBeNull();
});

it('opens from the whole card while keeping prompt text and actions independent', async () => {
  const summary = byLabel('View prompt for Unique skill');
  const card = summary.closest('li')!;
  await act(async () => card.click());
  expect(summary.getAttribute('aria-expanded')).toBe('true');
  await act(async () =>
    document.querySelector<HTMLPreElement>('pre[aria-label="Prompt for Unique skill"]')!.click()
  );
  expect(summary.getAttribute('aria-expanded')).toBe('true');
  await act(async () => summary.click());
  expect(summary.getAttribute('aria-expanded')).toBe('false');
  await act(async () => byLabel('Copy Unique skill prompt').click());
  expect(summary.getAttribute('aria-expanded')).toBe('false');
  await act(async () => byLabel('Add Unique skill to favorites').click());
  expect(summary.getAttribute('aria-expanded')).toBe('false');
  await act(async () => byLabel('Actions for Unique skill').click());
  expect(summary.getAttribute('aria-expanded')).toBe('false');
  await act(async () => byText('Pin to top').click());
  expect(summary.getAttribute('aria-expanded')).toBe('false');
  await act(async () => card.querySelector<HTMLElement>('[aria-label="1 use"]')!.click());
  expect(summary.getAttribute('aria-expanded')).toBe('true');
});

it('exports a draggable skill without copying, opening it or counting usage', async () => {
  const skill = (await sendExtensionMessage('SKILL_LIST')).find(
    (item) => item.name === 'Unique skill'
  )!;
  const summary = byLabel('View prompt for Unique skill');
  const card = summary.closest('li')!;
  const source = card.querySelector<HTMLElement>('[draggable="true"]')!;
  const data = new DataTransfer();
  const start = new DragEvent('dragstart', { bubbles: true, cancelable: true });
  Object.defineProperty(start, 'dataTransfer', { value: data });
  await act(async () => source.dispatchEvent(start));
  expect(data.getData(SKILL_DRAG_TYPE)).toBe(skill.id);
  expect(data.getData('text/plain')).toBe('🏷️ /only-command');
  expect(data.effectAllowed).toBe('copy');
  expect(card.dataset.dragging).toBe('true');
  expect(summary.getAttribute('aria-expanded')).toBe('false');
  expect(copy).not.toHaveBeenCalled();
  expect((await sendExtensionMessage('SKILL_GET', { id: skill.id }))!.usage.count).toBe(0);
  await act(async () => source.dispatchEvent(new DragEvent('dragend', { bubbles: true })));
  expect(card.hasAttribute('data-dragging')).toBe(false);
  await act(async () => summary.click());
  expect(card.querySelector('pre')!.closest('[draggable="true"]')).toBeNull();
});

it('filters by a skill tag without opening the prompt or recording usage', async () => {
  expect(container.querySelector('button button')).toBeNull();
  await act(async () => byLabel('Filter by test tag').click());
  expect(container.querySelectorAll('.skill-row')).toHaveLength(1);
  expect(byLabel('View prompt for Unique skill').getAttribute('aria-expanded')).toBe('false');
  expect(byLabel('Filter by test tag').getAttribute('aria-pressed')).toBe('true');
  expect(
    container.querySelector('[aria-label="Quick tag filters"] button[aria-pressed="true"]')
      ?.textContent
  ).toBe('#test');
  expect(container.textContent).toContain('Filtering: #test');
  expect(currentPage()).toBe('1 / 1');
  const unique = (await sendExtensionMessage('SKILL_LIST')).find(
    (skill) => skill.name === 'Unique skill'
  )!;
  expect(unique.usage.count).toBe(0);
  await act(async () => byLabel('Filter by test tag').click());
  expect(container.querySelectorAll('.skill-row')).toHaveLength(10);
  expect(
    container.querySelector('[aria-label="Quick tag filters"] button[aria-pressed="true"]')
  ).toBeNull();
});

it('combines multiple tag filters with hashtag searches and keeps the filter popup open', async () => {
  const trigger = container.querySelector<HTMLButtonElement>('button[aria-label^="Filters"]')!;
  await act(async () => trigger.click());
  const tagButton = (tag: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Filter by tag"] button')].find(
      (button) => button.textContent === `#${tag}`
    )!;
  await act(async () => tagButton('coding').click());
  expect(document.querySelector('#library-view')).not.toBeNull();
  await act(async () => tagButton('review').click());
  expect(container.querySelectorAll('.skill-row')).toHaveLength(1);
  expect(byLabel('View prompt for Code Review')).toBeTruthy();
  expect(
    document.querySelectorAll('[aria-label="Filter by tag"] button[aria-pressed="true"]')
  ).toHaveLength(2);
  await act(async () => trigger.click());
  expect(container.textContent).toContain('Filtering: #coding + #review');
  await act(async () => byText('Clear filters').click());
  const search = container.querySelector<HTMLInputElement>('input[aria-label="Search skills"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      search,
      '#writing #productivity'
    );
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(container.querySelectorAll('.skill-row')).toHaveLength(1);
  expect(byLabel('View prompt for Professional Rewrite')).toBeTruthy();
  expect(currentPage()).toBe('1 / 1');
  await act(async () => byLabel('Filter by email tag').click());
  expect(container.querySelectorAll('.skill-row')).toHaveLength(1);
});

it('keeps edit, delete, undo, settings and trash reachable through the compact controls', async () => {
  await act(async () => byLabel('Actions for Unique skill').click());
  await act(async () => byText('Edit skill').click());
  expect(document.querySelector<HTMLInputElement>('#skill-name')?.value).toBe('Unique skill');
  await act(async () => byText('Cancel').click());
  await act(async () => byLabel('Actions for Unique skill').click());
  await act(async () => byText('Move to trash').click());
  expect(byLabel('View prompt for Unique skill')).toBeNull();
  await act(async () => byText('Undo').click());
  expect(byLabel('View prompt for Unique skill')).toBeTruthy();
  expect(await sendExtensionMessage('SKILL_TRASH_LIST')).toEqual([]);
  await act(async () => byLabel('Settings').click());
  expect(container.textContent).toContain('AI connections');
  expect(byText('Export')).toBeTruthy();
  expect(byText('Import')).toBeTruthy();
  expect(container.querySelector('#gemini-api-key')?.closest('details')).toBeNull();
  expect(container.querySelector('#gemini-api-key')).not.toBeNull();
  expect(container.querySelector('#custom-provider-url')?.closest('details')).toBeNull();
  expect(container.querySelector('#custom-provider-url')).not.toBeNull();
  await act(async () => byLabel('Trash').click());
  expect(container.textContent).toContain('Your trash is empty.');
  await act(async () => byLabel('Back to vault').click());
  expect(byLabel('View prompt for Unique skill')).toBeTruthy();
});

const currentPage = () => container.querySelector('[aria-label="Current page"]')?.textContent;
async function selectPageSize(size: number) {
  await act(async () => {
    const select = container.querySelector<HTMLSelectElement>('#skills-per-page')!;
    select.value = String(size);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

it('paginates results and resets the page when page size, search or tags change', async () => {
  expect(container.querySelectorAll('.skill-row')).toHaveLength(10);
  expect(currentPage()).toBe('1 / 3');
  expect(byLabel('Previous page').disabled).toBe(true);
  await act(async () => byLabel('Next page').click());
  expect(currentPage()).toBe('2 / 3');
  expect(byLabel('View prompt for Unique skill')).toBeNull();
  await act(async () => byLabel('Next page').click());
  expect(container.querySelectorAll('.skill-row')).toHaveLength(6);
  expect(container.textContent).toContain('21–26 of 26 skills');
  expect(byLabel('Next page').disabled).toBe(true);
  await act(async () => byLabel('Previous page').click());
  expect(currentPage()).toBe('2 / 3');
  await selectPageSize(20);
  expect(currentPage()).toBe('1 / 2');
  expect(container.querySelectorAll('.skill-row')).toHaveLength(20);
  await selectPageSize(50);
  expect(currentPage()).toBe('1 / 1');
  expect(container.querySelectorAll('.skill-row')).toHaveLength(26);
  await selectPageSize(5);
  await act(async () => byLabel('Next page').click());
  const search = container.querySelector<HTMLInputElement>('input[aria-label="Search skills"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      search,
      '/only-command'
    );
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(currentPage()).toBe('1 / 1');
  expect(container.querySelectorAll('.skill-row')).toHaveLength(1);
  await act(async () => byLabel('Clear search').click());
  await act(async () => byLabel('Next page').click());
  const coding = [
    ...container.querySelectorAll<HTMLButtonElement>('[aria-label="Quick tag filters"] button'),
  ].find((button) => button.textContent === '#coding')!;
  await act(async () => coding.click());
  expect(currentPage()).toBe('1 / 1');
  expect(container.querySelectorAll('.skill-row')).toHaveLength(2);
});

it('keeps pagination valid after deleting the final item on the last page', async () => {
  await selectPageSize(5);
  for (let index = 0; index < 5; index++) await act(async () => byLabel('Next page').click());
  expect(currentPage()).toBe('6 / 6');
  expect(container.querySelectorAll('.skill-row')).toHaveLength(1);
  await act(async () => byLabel('Actions for Bug Investigator').click());
  await act(async () => byText('Move to trash').click());
  expect(currentPage()).toBe('5 / 5');
  expect(container.querySelectorAll('.skill-row')).toHaveLength(5);
  expect(byLabel('Next page').disabled).toBe(true);
  await act(async () => byText('Undo').click());
  expect(currentPage()).toBe('5 / 6');
  expect(byLabel('Next page').disabled).toBe(false);
});

async function selectLibrary(id: string, value: string) {
  const trigger = container.querySelector<HTMLButtonElement>('button[aria-label^="Filters"]')!;
  await act(async () => trigger.click());
  await act(async () => {
    const select = document.querySelector<HTMLSelectElement>(`#${id}`)!;
    select.focus();
    select.click();
    expect(document.activeElement).toBe(select);
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  if (value === 'recent')
    expect(document.querySelector<HTMLSelectElement>('#library-sort')!.disabled).toBe(true);
  await act(async () => trigger.click());
}

const firstSkill = () =>
  container.querySelector('.skill-row button[aria-expanded]')?.getAttribute('aria-label');

it('counts successful copies, exposes recently used skills and keeps pins above popular skills', async () => {
  const original = (await sendExtensionMessage('SKILL_LIST')).find(
    (skill) => skill.name === 'Unique skill'
  )!;
  vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('Clipboard denied'));
  await act(async () => byLabel('Copy Unique skill prompt').click());
  expect(document.querySelector('[data-slot="toast"][data-tone="error"]')?.textContent).toContain(
    'Could not copy'
  );
  expect((await sendExtensionMessage('SKILL_GET', { id: original.id }))!.usage.count).toBe(0);
  await act(async () => byLabel('Copy Unique skill prompt').click());
  expect((await sendExtensionMessage('SKILL_GET', { id: original.id }))!.usage.count).toBe(1);
  await selectLibrary('library-view', 'recent');
  expect(firstSkill()).toBe('View prompt for Unique skill');
  expect(container.querySelectorAll('.skill-row')).toHaveLength(4);
  await selectLibrary('library-view', 'all');
  await selectLibrary('library-sort', 'usage');
  expect(firstSkill()).toBe('View prompt for Code Review');
  await act(async () => byLabel('Actions for Unique skill').click());
  await act(async () => byText('Pin to top').click());
  expect(firstSkill()).toBe('View prompt for Unique skill');
  expect((await sendExtensionMessage('SKILL_GET', { id: original.id }))!.pinned).toBe(true);
  await act(async () => byLabel('Actions for Unique skill').click());
  await act(async () => byText('Unpin').click());
  expect(firstSkill()).toBe('View prompt for Code Review');
});

it('filters collections and duplicates into an independent, editable skill', async () => {
  expect(document.querySelector('#library-view')).toBeNull();
  expect(document.querySelector('#library-sort')).toBeNull();
  await selectLibrary('library-view', 'collection:Research');
  expect(container.querySelectorAll('.skill-row')).toHaveLength(1);
  const original = (await sendExtensionMessage('SKILL_LIST')).find(
    (skill) => skill.name === 'Unique skill'
  )!;
  await act(async () => byLabel('Actions for Unique skill').click());
  await act(async () => byText('Duplicate skill').click());
  expect(container.querySelector<HTMLInputElement>('#skill-name')!.value).toBe(
    'Unique skill (copy)'
  );
  expect(container.querySelector<HTMLInputElement>('#skill-shortcut')!.value).toBe('');
  expect(container.querySelector<HTMLSelectElement>('#skill-collection')!.value).toBe('Research');
  await act(async () => byText('Cancel').click());
  expect(await sendExtensionMessage('SKILL_LIST')).toHaveLength(26);
  await act(async () => byLabel('Actions for Unique skill').click());
  await act(async () => byText('Duplicate skill').click());
  expect(container.querySelector<HTMLTextAreaElement>('#skill-content')!.value).toBe(
    original.content
  );
  await act(async () => {
    const select = container.querySelector<HTMLSelectElement>('#skill-collection')!;
    select.value = '__create_collection__';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>('#skill-new-collection')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      'My workflows'
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const content = container.querySelector<HTMLTextAreaElement>('#skill-content')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      content,
      `${original.content}\nVersion two`
    );
    content.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => container.querySelector<HTMLButtonElement>('#skill-tags')!.click());
  const chooseTag = (tag: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Choose tags"] button')].find(
      (button) => button.textContent === `#${tag}`
    )!;
  await act(async () => chooseTag('batch').click());
  const tagInput = document.querySelector<HTMLInputElement>('[aria-label="Find or create a tag"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      tagInput,
      'New-tag'
    );
    tagInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(byText('Create #new-tag')).toBeTruthy();
  await act(async () =>
    tagInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    )
  );
  expect(await sendExtensionMessage('SKILL_LIST')).toHaveLength(26);
  expect(byLabel('Remove tag new-tag')).toBeTruthy();
  await act(async () => byLabel('Remove tag test').click());
  await act(async () => container.querySelector<HTMLButtonElement>('#skill-tags')!.click());
  await act(async () =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  );
  const skills = await sendExtensionMessage('SKILL_LIST');
  const copy = skills.find((skill) => skill.name === 'Unique skill (copy)')!;
  expect(copy.id).not.toBe(original.id);
  expect(copy.shortcut).toBeUndefined();
  expect(copy).toMatchObject({
    collection: 'My workflows',
    content: `${original.content}\nVersion two`,
    variables: original.variables,
    providers: original.providers,
    usage: { count: 0 },
    pinned: false,
    tags: ['batch', 'new-tag'],
  });
  expect(await sendExtensionMessage('SKILL_GET', { id: original.id })).toEqual(original);
  await selectLibrary('library-view', 'collection:My workflows');
  expect(container.querySelectorAll('.skill-row')).toHaveLength(1);
  expect(firstSkill()).toBe('View prompt for Unique skill (copy)');
  await selectLibrary('library-view', 'collection:Coding');
  expect(container.querySelectorAll('.skill-row')).toHaveLength(2);
});
