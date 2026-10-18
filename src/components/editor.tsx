'use client';

import {
  Bold, Code, Eye, Heading1, Heading2, Image as ImageIcon, Italic, Link, List, ListChecks, Pencil, Sigma, Table,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Markdown } from './markdown';
import { cn, readFileAsDataURL } from '@/lib/utils';

interface EditorProps {
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  className?: string;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, minRows = 10, className, placeholder }: EditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  const insert = (before: string, after = '', fallback = '') => {
    const ta = ref.current;
    if (!ta) {
      onChange(value + before + fallback + after);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + before.length + selected.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const insertBlock = (block: string) => {
    const ta = ref.current;
    const start = ta ? ta.selectionStart : value.length;
    const needsNewline = start > 0 && value[start - 1] !== '\n';
    const text = (needsNewline ? '\n' : '') + block;
    const next = value.slice(0, start) + text + value.slice(start);
    onChange(next);
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const attachImage = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      alert('Images larger than 4 MB make the local database slow. Pick a smaller one.');
      return;
    }
    const dataUrl = await readFileAsDataURL(file);
    insertBlock(`![${file.name}](${dataUrl})\n`);
  };

  const tools: { icon: React.ReactNode; label: string; run: () => void }[] = [
    { icon: <Heading1 className="h-3.5 w-3.5" />, label: 'Heading 1', run: () => insertBlock('# Heading\n') },
    { icon: <Heading2 className="h-3.5 w-3.5" />, label: 'Heading 2', run: () => insertBlock('## Heading\n') },
    { icon: <Bold className="h-3.5 w-3.5" />, label: 'Bold', run: () => insert('**', '**', 'bold') },
    { icon: <Italic className="h-3.5 w-3.5" />, label: 'Italic', run: () => insert('*', '*', 'italic') },
    { icon: <Code className="h-3.5 w-3.5" />, label: 'Code block', run: () => insertBlock('```\ncode\n```\n') },
    { icon: <List className="h-3.5 w-3.5" />, label: 'List', run: () => insertBlock('- item one\n- item two\n') },
    { icon: <ListChecks className="h-3.5 w-3.5" />, label: 'Checklist', run: () => insertBlock('- [ ] task\n- [x] done task\n') },
    { icon: <Table className="h-3.5 w-3.5" />, label: 'Table', run: () => insertBlock('| Column | Column |\n| --- | --- |\n| cell | cell |\n') },
    { icon: <Sigma className="h-3.5 w-3.5" />, label: 'Math (KaTeX)', run: () => insert('$', '$', 'a^2 + b^2 = c^2') },
    { icon: <Link className="h-3.5 w-3.5" />, label: 'Internal note link', run: () => insert('[[', ']]', 'Note title') },
    { icon: <ImageIcon className="h-3.5 w-3.5" />, label: 'Insert image', run: () => fileRef.current?.click() },
  ];

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}>
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border bg-muted/50 px-1.5 py-1">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            aria-label={t.label}
            onClick={t.run}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t.icon}
          </button>
        ))}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 pl-2">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold', mode === 'write' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground')}
          >
            <Pencil className="h-3 w-3" /> Write
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold', mode === 'preview' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground')}
          >
            <Eye className="h-3 w-3" /> Preview
          </button>
        </div>
      </div>

      {mode === 'write' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={minRows}
          placeholder={placeholder ?? 'Write in Markdown — headings, checklists, tables, code, $math$, [[note links]]…'}
          className="block w-full resize-y bg-transparent px-3.5 py-3 font-mono text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
      ) : (
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          <Markdown content={value} />
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void attachImage(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
