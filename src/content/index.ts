import { ContentRuntime } from './runtime';

const runtime = new ContentRuntime();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => runtime.init());
} else {
  runtime.init();
}
