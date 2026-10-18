'use client';

/**
 * Offline PDF annotator.
 * Renders pages with pdf.js, draws vector annotations (pen / highlighter /
 * sticky notes) on an overlay canvas, and auto-saves them to IndexedDB
 * keyed by the attachment id. Coordinates are normalized (0–1) so
 * annotations survive zoom and window resizes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Eraser, Highlighter, Loader2, PenLine,
  Redo2, StickyNote, Undo2, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import type { PdfAnnotationDoc, PdfStroke, PdfTextNote } from '@/lib/types';
import { cn, uid } from '@/lib/utils';
import { Button } from '@/components/ui';

type Tool = 'pen' | 'highlighter' | 'eraser' | 'text';

export interface AnnotatableFile {
  id: string;
  name: string;
  dataUrl: string;
}

const PEN_COLORS = ['#1C1D2E', '#E5484D', '#2E6FE0', '#18794E', '#8E4EC6'];
const HL_COLORS = ['#FFE14D', '#7CE2A0', '#8EC8FF', '#FFB1C9'];

const emptyDoc = (file: AnnotatableFile): PdfAnnotationDoc => ({
  id: file.id, title: file.name, strokes: {}, texts: {}, updatedAt: new Date().toISOString(),
});

export function PdfAnnotator({ file, onClose }: { file: AnnotatableFile; onClose: () => void }) {
  const put = useStore((s) => s.put);
  const saved = useStore((s) => s.annotations.find((a) => a.id === file.id));

  const [doc, setDoc] = useState<PdfAnnotationDoc>(() => saved ?? emptyDoc(file));
  const docRef = useRef(doc);
  docRef.current = doc;

  const [pdf, setPdf] = useState<{ numPages: number; getPage: (n: number) => Promise<unknown> } | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null);
  const [undoStack, setUndoStack] = useState<{ strokes: PdfStroke[]; texts: PdfTextNote[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ strokes: PdfStroke[]; texts: PdfTextNote[] }[]>([]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<PdfStroke | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderTask = useRef<{ cancel: () => void } | null>(null);

  const key = String(page);
  const strokes = doc.strokes[key] ?? [];
  const texts = doc.texts[key] ?? [];

  /* ----------------------------- load the PDF ------------------------------ */
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const b64 = file.dataUrl.split(',')[1] ?? '';
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const loaded = await pdfjs.getDocument({ data: bytes }).promise;
        if (!dead) {
          setPdf(loaded as unknown as { numPages: number; getPage: (n: number) => Promise<unknown> });
          setStatus('ready');
        }
      } catch (e) {
        console.error('PDF load failed', e);
        if (!dead) setStatus('error');
      }
    })();
    return () => { dead = true; };
  }, [file.dataUrl]);

  /* ------------------------------ draw strokes ----------------------------- */
  const drawInk = useCallback((live?: PdfStroke | null) => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const all = live ? [...(docRef.current.strokes[String(page)] ?? []), live] : (docRef.current.strokes[String(page)] ?? []);
    for (const s of all) {
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(1, s.size * W);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = s.tool === 'highlighter' ? 0.38 : 1;
      for (let i = 0; i < s.pts.length; i += 2) {
        const x = s.pts[i] * W;
        const y = s.pts[i + 1] * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (s.pts.length === 2) ctx.lineTo(s.pts[0] * W + 0.1, s.pts[1] * H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [page]);

  /* ------------------------- render the current page ----------------------- */
  const renderPage = useCallback(async () => {
    if (!pdf || !wrapRef.current || !pdfCanvasRef.current || !inkCanvasRef.current) return;
    renderTask.current?.cancel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = await pdf.getPage(page);
    const containerW = Math.max(280, wrapRef.current.clientWidth - 2);
    const baseVp = p.getViewport({ scale: 1 });
    const cssW = containerW * zoom;
    const scale = cssW / baseVp.width;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const vp = p.getViewport({ scale: scale * dpr });

    for (const c of [pdfCanvasRef.current, inkCanvasRef.current]) {
      c.width = vp.width;
      c.height = vp.height;
      c.style.width = `${cssW}px`;
      c.style.height = `${cssW * (baseVp.height / baseVp.width)}px`;
    }
    const ctx = pdfCanvasRef.current.getContext('2d')!;
    const task = p.render({ canvasContext: ctx, viewport: vp });
    renderTask.current = task;
    try { await task.promise; } catch { /* cancelled */ }
    drawInk();
  }, [pdf, page, zoom, drawInk]);

  useEffect(() => { renderPage(); }, [renderPage]);
  useEffect(() => { drawInk(); }, [doc, drawInk]);

  useEffect(() => {
    const onResize = () => renderPage();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [renderPage]);

  /* -------------------------------- persist -------------------------------- */
  const commit = (next: PdfAnnotationDoc) => {
    next.updatedAt = new Date().toISOString();
    setDoc(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => put('annotations', next), 400);
  };

  const pushUndo = () => {
    setUndoStack((u) => [...u.slice(-19), { strokes, texts }]);
    setRedoStack([]);
  };

  const undo = () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, { strokes, texts }]);
    commit({ ...doc, strokes: { ...doc.strokes, [key]: last.strokes }, texts: { ...doc.texts, [key]: last.texts } });
  };

  const redo = () => {
    const last = redoStack[redoStack.length - 1];
    if (!last) return;
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, { strokes, texts }]);
    commit({ ...doc, strokes: { ...doc.strokes, [key]: last.strokes }, texts: { ...doc.texts, [key]: last.texts } });
  };

  /* ----------------------------- pointer events ---------------------------- */
  const norm = (e: React.PointerEvent) => {
    const rect = inkCanvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const eraseAt = (x: number, y: number) => {
    const r = 0.012 * Math.max(1, 1 / zoom);
    const hitStroke = (s: PdfStroke) => {
      for (let i = 0; i < s.pts.length; i += 2) {
        if (Math.hypot(s.pts[i] - x, s.pts[i + 1] - y) < r * 1.6) return true;
      }
      return false;
    };
    const keepS = strokes.filter((s) => !hitStroke(s));
    const keepT = texts.filter((t) => Math.hypot(t.x - x, t.y - y) > r * 3);
    if (keepS.length !== strokes.length || keepT.length !== texts.length) {
      commit({ ...doc, strokes: { ...doc.strokes, [key]: keepS }, texts: { ...doc.texts, [key]: keepT } });
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (pendingText) return;
    const { x, y } = norm(e);
    if (tool === 'text') {
      setPendingText({ x, y });
      return;
    }
    if (tool === 'eraser') {
      pushUndo();
      eraseAt(x, y);
      drawing.current = { tool: 'pen', color: '', size: 0, pts: [] };
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }
    pushUndo();
    drawing.current = {
      tool: tool === 'highlighter' ? 'highlighter' : 'pen',
      color,
      size: tool === 'highlighter' ? 0.016 : 0.0035,
      pts: [x, y],
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const { x, y } = norm(e);
    if (tool === 'eraser') {
      eraseAt(x, y);
      return;
    }
    const pts = drawing.current.pts;
    const lx = pts[pts.length - 2];
    const ly = pts[pts.length - 1];
    if (Math.hypot(x - lx, y - ly) > 0.0022) {
      pts.push(x, y);
      drawInk(drawing.current);
    }
  };

  const onPointerUp = () => {
    if (!drawing.current) return;
    if (tool !== 'eraser' && drawing.current.pts.length >= 2) {
      const next = { ...doc, strokes: { ...doc.strokes, [key]: [...strokes, drawing.current] } };
      commit(next);
    }
    drawing.current = null;
  };

  const addText = (text: string) => {
    if (pendingText && text.trim()) {
      pushUndo();
      const note: PdfTextNote = { id: uid(), x: pendingText.x, y: pendingText.y, text: text.trim() };
      commit({ ...doc, texts: { ...doc.texts, [key]: [...texts, note] } });
    }
    setPendingText(null);
  };

  const removeText = (id: string) => {
    pushUndo();
    commit({ ...doc, texts: { ...doc.texts, [key]: texts.filter((t) => t.id !== id) } });
  };

  const go = (d: 1 | -1) => {
    if (!pdf) return;
    setUndoStack([]);
    setRedoStack([]);
    setPendingText(null);
    setPage((p) => Math.min(pdf.numPages, Math.max(1, p + d)));
  };

  const colors = tool === 'highlighter' ? HL_COLORS : PEN_COLORS;
  useEffect(() => {
    if (tool === 'highlighter' && !HL_COLORS.includes(color)) setColor(HL_COLORS[0]);
    if (tool === 'pen' && !PEN_COLORS.includes(color)) setColor(PEN_COLORS[0]);
  }, [tool, color]);

  const ToolBtn = ({ t, icon: Icon, label }: { t: Tool; icon: typeof PenLine; label: string }) => (
    <button
      onClick={() => setTool(t)}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
        tool === t ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background animate-fade-in">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-3 py-2">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close annotator">
          <X className="h-5 w-5" />
        </Button>
        <p className="mr-2 hidden max-w-[260px] truncate text-sm font-bold sm:block">{file.name}</p>

        <div className="flex items-center gap-0.5 rounded-2xl border border-border bg-muted/50 p-1">
          <ToolBtn t="pen" icon={PenLine} label="Pen" />
          <ToolBtn t="highlighter" icon={Highlighter} label="Highlighter" />
          <ToolBtn t="text" icon={StickyNote} label="Sticky note" />
          <ToolBtn t="eraser" icon={Eraser} label="Eraser" />
        </div>

        {(tool === 'pen' || tool === 'highlighter') && (
          <div className="flex items-center gap-1 rounded-2xl border border-border bg-muted/50 p-1.5">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`color ${c}`}
                className={cn('h-6 w-6 rounded-full border-2 transition-transform hover:scale-110', color === c ? 'border-foreground' : 'border-transparent')}
                style={{ background: c }}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={undo} disabled={undoStack.length === 0} aria-label="Undo"><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={redoStack.length === 0} aria-label="Redo"><Redo2 className="h-4 w-4" /></Button>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
          <span className="w-11 text-center text-xs font-bold text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.2) * 10) / 10))} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button variant="ghost" size="icon" onClick={() => go(-1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="w-16 text-center text-xs font-bold text-muted-foreground">{page} / {pdf?.numPages ?? '–'}</span>
          <Button variant="ghost" size="icon" onClick={() => go(1)} disabled={!pdf || page >= pdf.numPages} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/60 p-3 sm:p-6">
        <div ref={wrapRef} className="mx-auto w-full max-w-4xl">
          {status === 'loading' && (
            <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening PDF…
            </div>
          )}
          {status === 'error' && (
            <div className="flex h-[60vh] items-center justify-center text-sm text-destructive">Couldn’t open this PDF.</div>
          )}
          <div className={cn('relative mx-auto w-fit', status !== 'ready' && 'hidden')}>
            <canvas ref={pdfCanvasRef} className="block rounded-lg border border-border bg-white shadow-pop" />
            <canvas
              ref={inkCanvasRef}
              className={cn(
                'absolute inset-0 touch-none rounded-lg',
                tool === 'eraser' ? 'cursor-cell' : tool === 'text' ? 'cursor-copy' : 'cursor-crosshair',
              )}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
            {texts.map((t) => (
              <div
                key={t.id}
                className="group absolute z-10 max-w-[220px] -translate-y-1 rounded-lg border border-amber-300/70 bg-highlighter/80 px-2 py-1 text-[11px] font-semibold leading-snug text-[#1C1D2E] shadow-sm"
                style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%` }}
              >
                {t.text}
                <button
                  onClick={() => removeText(t.id)}
                  aria-label="Delete note"
                  className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground group-hover:flex"
                >
                  ×
                </button>
              </div>
            ))}
            {pendingText && (
              <div
                className="absolute z-20 w-56 rounded-xl border border-border bg-card p-2 shadow-pop"
                style={{ left: `${pendingText.x * 100}%`, top: `${pendingText.y * 100}%` }}
              >
                <textarea
                  autoFocus
                  rows={2}
                  placeholder="Sticky note… (Enter to save)"
                  className="w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      addText((e.target as HTMLTextAreaElement).value);
                    }
                    if (e.key === 'Escape') setPendingText(null);
                  }}
                />
                <div className="mt-1 flex justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPendingText(null)}>Cancel</Button>
                  <Button
                    size="sm" className="h-7 px-2 text-xs"
                    onClick={(e) => {
                      const ta = (e.currentTarget.parentElement?.previousSibling as HTMLTextAreaElement);
                      addText(ta?.value ?? '');
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="border-t border-border bg-card px-4 py-1.5 text-center text-[11px] text-muted-foreground">
        Annotations auto-save to this device and stay with the file — pen, highlight, sticky notes, eraser. Works offline.
      </p>
    </div>
  );
}
