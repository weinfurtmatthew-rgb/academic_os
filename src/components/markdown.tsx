'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let renderPipeline: ((src: string) => string) | null = null;

async function getPipeline(): Promise<(src: string) => string> {
  if (renderPipeline) return renderPipeline;
  const [{ marked }, katexMod, dompurifyMod] = await Promise.all([
    import('marked'),
    import('katex'),
    import('dompurify'),
  ]);
  const katex = katexMod.default;
  const DOMPurify = dompurifyMod.default;
  marked.use({ gfm: true, breaks: true });

  const renderMath = (tex: string, display: boolean): string => {
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' });
    } catch {
      return `<code>${escapeHtml(tex)}</code>`;
    }
  };

  renderPipeline = (src: string): string => {
    const math: string[] = [];
    const links: string[] = [];
    let s = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, m: string) => {
      math.push(`<div class="math-block">${renderMath(m, true)}</div>`);
      return `§§M${math.length - 1}§§`;
    });
    s = s.replace(/\$([^$\n]+?)\$/g, (_, m: string) => {
      math.push(renderMath(m, false));
      return `§§M${math.length - 1}§§`;
    });
    s = s.replace(/\[\[([^\]]+)\]\]/g, (_, t: string) => {
      links.push(`<a class="ilink" data-note="${escapeHtml(t)}">${escapeHtml(t)}</a>`);
      return `§§L${links.length - 1}§§`;
    });

    let html = marked.parse(s, { async: false }) as string;
    html = html
      .replace(/§§M(\d+)§§/g, (_, i: string) => math[Number(i)] ?? '')
      .replace(/§§L(\d+)§§/g, (_, i: string) => links[Number(i)] ?? '');

    return DOMPurify.sanitize(html, { ADD_ATTR: ['data-note'] });
  };
  return renderPipeline;
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  const [html, setHtml] = useState('');
  const router = useRouter();
  const notes = useStore((s) => s.notes);
  const setUI = useStore((s) => s.setUI);

  useEffect(() => {
    let alive = true;
    getPipeline().then((render) => {
      if (alive) setHtml(render(content || ''));
    });
    return () => {
      alive = false;
    };
  }, [content]);

  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a[data-note]');
    if (a) {
      e.preventDefault();
      const title = a.getAttribute('data-note') ?? '';
      const note = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
      if (note) {
        setUI({ focus: { type: 'note', id: note.id } });
        router.push('/notes/');
      }
    }
  };

  if (!content?.trim()) return <p className="text-sm italic text-muted-foreground">Nothing written yet.</p>;
  return <div className={cn('md', className)} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}
