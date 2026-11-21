import { describe, expect, it } from 'vitest';
import { getBookFormat, paginateText } from './pagination';

describe('pagination utils', () => {
  it('detects supported book formats by filename and MIME type', () => {
    expect(getBookFormat('guide.pdf')).toBe('pdf');
    expect(getBookFormat('novel.epub')).toBe('epub');
    expect(getBookFormat('notes.txt')).toBe('text');
    expect(getBookFormat('readme.md')).toBe('text');
    expect(getBookFormat('legacy.mobi')).toBe('unsupported');
    expect(getBookFormat('unknown', 'application/pdf')).toBe('pdf');
  });

  it('paginates multi-paragraph text without losing content', () => {
    const paragraphs = Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1}: ${'word '.repeat(40).trim()}.`);
    const fullText = paragraphs.join('\n\n');

    const pages = paginateText(fullText, 500);
    expect(pages.length).toBeGreaterThan(2);

    // Every paragraph should appear across the paginated output
    const combined = pages.join('\n\n');
    for (let i = 1; i <= 8; i++) {
      expect(combined).toContain(`Paragraph ${i}:`);
    }
  });

  it('handles empty text gracefully', () => {
    expect(paginateText('   ')).toEqual(['']);
  });
});
