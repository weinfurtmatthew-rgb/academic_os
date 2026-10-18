'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* ---------------- Button ---------------- */

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'icon';

const buttonVariants: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft',
  secondary: 'bg-muted text-foreground hover:bg-muted/70',
  outline: 'border border-border bg-card text-foreground hover:bg-muted/60',
  ghost: 'text-foreground hover:bg-muted/70',
  destructive: 'bg-destructive text-white hover:bg-destructive/90',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  icon: 'h-9 w-9 shrink-0',
};

export function Button({
  className, variant = 'default', size = 'md', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  );
}

/* ---------------- Card ---------------- */

export function Card({ className, children, ...props }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card shadow-soft', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, eyebrow }: { title: ReactNode; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
      <div>
        {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</div>}
        <h3 className="font-display text-base font-semibold leading-tight">{title}</h3>
      </div>
      {action}
    </div>
  );
}

/* ---------------- Form bits ---------------- */

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </label>
  );
}

const fieldClass =
  'rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 ' +
  'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow';

/** Fields fill their container unless the caller sets a base width (`w-20`). `cn` can't
 *  resolve two width classes, and `w-full` would win over the caller's. */
const fieldWidth = (className?: string) => (/(^|\s)w-/.test(className ?? '') ? undefined : 'w-full');

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, fieldWidth(className), className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, fieldWidth(className), 'min-h-[88px] resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClass, fieldWidth(className), 'appearance-none bg-no-repeat pr-8', className)} style={{ backgroundImage: 'var(--select-chevron)', backgroundPosition: 'right 0.6rem center', backgroundSize: '0.85rem' }} {...props}>
      {children}
    </select>
  );
}

export function FormRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/* ---------------- Badge ---------------- */

export function Badge({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span style={style} className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4', className)}>
      {children}
    </span>
  );
}

/* ---------------- Progress ---------------- */

export function Progress({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

/* ---------------- Tabs ---------------- */

export function Tabs<T extends string>({
  value, onChange, tabs, className,
}: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5', className)}>
      {tabs.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
            value === it.value ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Dialog ---------------- */

export function Dialog({
  open, onClose, title, children, wide, footer,
}: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex h-full w-full animate-zoom-in flex-col bg-card',
          'sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-border sm:shadow-pop',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog" className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* ---------------- Empty state ---------------- */

export function EmptyState({
  icon, title, body, action, className,
}: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center', className)}>
      {icon && <div className="mb-1 text-muted-foreground/60">{icon}</div>}
      <div className="font-display text-sm font-semibold">{title}</div>
      {body && <p className="max-w-xs text-xs text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------------- Stat ---------------- */

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3 shadow-soft">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className={cn('font-display text-2xl font-bold leading-tight', accent && 'text-primary')}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* ---------------- Course chip ---------------- */

export function CourseChip({ color, code }: { color: string; code: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {code}
    </span>
  );
}
