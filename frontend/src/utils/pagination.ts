export type BookFormat = 'pdf' | 'epub' | 'text' | 'unsupported';

export function getBookFormat(fileName: string, fileMime = ''): BookFormat {
  const lowerName = fileName.toLowerCase();
  const lowerMime = fileMime.toLowerCase();

  if (lowerName.endsWith('.pdf') || lowerMime === 'application/pdf') {
    return 'pdf';
  }
  if (lowerName.endsWith('.epub') || lowerMime === 'application/epub+zip') {
    return 'epub';
  }
  if (
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerMime.startsWith('text/')
  ) {
    return 'text';
  }
  return 'unsupported';
}

/**
 * Splits plain text or markdown into readable pages without breaking words
 * whenever possible, respecting paragraph boundaries.
 */
export function paginateText(rawText: string, maxCharsPerPage = 1800): string[] {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [''];
  }

  const limit = Math.max(200, maxCharsPerPage);
  const paragraphs = normalized.split(/\n{2,}/);
  const pages: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim().length > 0) {
      pages.push(current.trim());
      current = '';
    }
  };

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // If a single paragraph fits in the remaining budget, append it
    if (current.length === 0 && trimmed.length <= limit) {
      current = trimmed;
      continue;
    }

    if (current.length > 0 && current.length + 2 + trimmed.length <= limit) {
      current = `${current}\n\n${trimmed}`;
      continue;
    }

    // Otherwise flush current page and handle the paragraph (splitting if larger than limit)
    pushCurrent();

    if (trimmed.length <= limit) {
      current = trimmed;
      continue;
    }

    // Split a very long paragraph cleanly along whitespace or punctuation boundaries
    let start = 0;
    while (start < trimmed.length) {
      let end = Math.min(start + limit, trimmed.length);
      if (end < trimmed.length) {
        const slice = trimmed.slice(start, end);
        const lastBreak = Math.max(
          slice.lastIndexOf('\n'),
          slice.lastIndexOf(' '),
          slice.lastIndexOf('。'),
          slice.lastIndexOf('！'),
          slice.lastIndexOf('？'),
          slice.lastIndexOf('.')
        );
        if (lastBreak > Math.floor(limit * 0.5)) {
          end = start + lastBreak + 1;
        }
      }
      pages.push(trimmed.slice(start, end).trim());
      start = end;
    }
  }

  pushCurrent();
  return pages.length > 0 ? pages : [''];
}
