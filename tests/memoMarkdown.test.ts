import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMemoMarkdownShortcut,
  parseMemoMarkdownLine,
  renderMemoMarkdown,
} from '../src/lib/memoMarkdown.ts';

test('parseMemoMarkdownLine detects headings and checklists', () => {
  assert.deepEqual(parseMemoMarkdownLine('# Title'), {
    type: 'heading',
    level: 1,
    text: 'Title',
  });

  assert.deepEqual(parseMemoMarkdownLine('- [x] Done'), {
    type: 'checklist',
    checked: true,
    text: 'Done',
  });
});

test('parseMemoMarkdownLine detects list types', () => {
  assert.deepEqual(parseMemoMarkdownLine('- Bullet'), {
    type: 'bullet',
    text: 'Bullet',
  });

  assert.deepEqual(parseMemoMarkdownLine('3. Step'), {
    type: 'numbered',
    number: 3,
    text: 'Step',
  });
});

test('renderMemoMarkdown escapes html and renders inline markdown', () => {
  const html = renderMemoMarkdown('**Bold** <script>alert(1)</script>\n- [ ] Task');

  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /data-md-type="checklist"/);
  assert.doesNotMatch(html, /<script>/);
});

test('getMemoMarkdownShortcut detects docs-style space shortcuts', () => {
  assert.equal(getMemoMarkdownShortcut('*'), '- ');
  assert.equal(getMemoMarkdownShortcut('-'), '- ');
  assert.equal(getMemoMarkdownShortcut('1.'), '1. ');
  assert.equal(getMemoMarkdownShortcut('###'), '### ');
  assert.equal(getMemoMarkdownShortcut('[]'), '- [ ] ');
  assert.equal(getMemoMarkdownShortcut('- [ ]'), '- [ ] ');
  assert.equal(getMemoMarkdownShortcut('hello'), null);
});
