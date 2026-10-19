'use client';

import { useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3, BookOpen, Calendar, CalendarRange, FileText, GraduationCap, Layers, LayoutGrid, ListTodo,
  Percent, Play, Plus, Presentation, RefreshCw, Search, Settings, SquareCheckBig, Star, Sun, Timer, X,
} from 'lucide-react';
import { useStore, type QuickAddKind } from '@/lib/store';
import { uid, cn } from '@/lib/utils';
import { CommandSearch } from '@/components/command-search';
import { QuickAddHost } from '@/components/forms';

const NAV = [
  { href: '/', label: 'Today', icon: Sun },
  { href: '/courses/', label: 'Courses', icon: GraduationCap },
  { href: '/schedule/', label: 'Schedule', icon: CalendarRange },
  { href: '/assignments/', label: 'Assignments', icon: ListTodo },
  { href: '/study/', label: 'Study', icon: Play },
  { href: '/lectures/', label: 'Lectures', icon: Presentation },
  { href: '/exams/', label: 'Exams', icon: BookOpen },
  { href: '/notes/', label: 'Notes', icon: FileText },
  { href: '/flashcards/', label: 'Flashcards', icon: Layers },
  { href: '/planner/', label: 'Study Planner', icon: Timer },
  { href: '/grades/', label: 'Grades', icon: Percent },
  { href: '/calendar/', label: 'Calendar', icon: Calendar },
  { href: '/analytics/', label: 'Analytics', icon: BarChart3 },
  { href: '/settings/', label: 'Settings', icon: Settings },
];

/** Phone tab bar. Everything not covered by the first four lives under More. */
const TABS = [
  { href: '/', label: 'Today', icon: Sun, match: (p: string) => p === '/' },
  { href: '/assignments/', label: 'Tasks', icon: SquareCheckBig, match: (p: string) => p.startsWith('/assignments') },
  { href: '/calendar/', label: 'Calendar', icon: Calendar, match: (p: string) => p.startsWith('/calendar') },
  { href: '/courses/', label: 'Courses', icon: GraduationCap, match: (p: string) => p.startsWith('/courses') },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href.replace(/\/$/, ''));
}

/* ----------------------------- theme handling ------------------------------ */

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      root.classList.toggle('dark', dark);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#15161F' : '#F6F7FB');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

/* ------------------------------ tab bar & add ------------------------------ */

/** Floating bar clear of the home indicator; 12px from the edge when there isn't one. */
const BAR_BOTTOM = 'max(12px, calc(env(safe-area-inset-bottom) - 10px))';

function TabBar({ pathname }: { pathname: string }) {
  const setUI = useStore((s) => s.setUI);
  const onMore = !TABS.some((t) => t.match(pathname));
  const items = [...TABS, { href: '/more/', label: 'More', icon: LayoutGrid, match: () => onMore }];

  return (
    <nav
      aria-label="Tabs"
      className="fixed left-3 right-[82px] z-40 flex h-16 items-center rounded-full bg-card/90 px-[5px] shadow-[0_8px_24px_rgb(22_23_43/0.12)] ring-1 ring-foreground/5 backdrop-blur-xl dark:shadow-[0_8px_24px_rgb(0_0_0/0.45)] dark:ring-white/[0.07] md:hidden"
      style={{ bottom: BAR_BOTTOM }}
    >
      {items.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              // tapping the open Courses tab goes back to the course list, like iOS
              if (active && t.href === '/courses/') setUI({ selectedCourseId: null });
            }}
            className={cn(
              'flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] transition-transform active:scale-95',
              active ? 'bg-primary/12 font-extrabold text-primary' : 'font-bold text-muted-foreground',
            )}
          >
            <t.icon className="h-[22px] w-[22px]" strokeWidth={2.2} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AddButton() {
  const setUI = useStore((s) => s.setUI);
  return (
    <button
      aria-label="Add"
      onClick={() => setUI({ addOpen: true })}
      className="fixed right-3 z-40 flex h-[58px] w-[58px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/0.35)] transition-transform active:scale-95 md:bottom-6 md:right-6 lg:hidden"
      style={{ bottom: `calc(${BAR_BOTTOM} + 3px)` }}
    >
      <Plus className="h-[26px] w-[26px]" strokeWidth={2.6} />
    </button>
  );
}

type AddKind = QuickAddKind | 'note';

const ADD_ITEMS: { kind: AddKind; label: string; hint: string; icon: typeof Plus; tile: string }[] = [
  { kind: 'assignment', label: 'Assignment', hint: 'Homework, essays, labs', icon: SquareCheckBig, tile: 'bg-primary/10 text-primary' },
  { kind: 'exam', label: 'Exam', hint: 'Quizzes, midterms, finals', icon: Star, tile: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { kind: 'session', label: 'Study session', hint: 'Plan study time', icon: Timer, tile: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { kind: 'note', label: 'Note', hint: 'Write or paste', icon: FileText, tile: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  { kind: 'flashcard', label: 'Flashcard', hint: 'Question and answer', icon: Layers, tile: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  { kind: 'course', label: 'Course', hint: 'Add a class', icon: GraduationCap, tile: 'bg-muted text-muted-foreground' },
];

/** What the + opens: a bottom sheet on phones, a small dialog on wider screens. */
function AddSheet() {
  const open = useStore((s) => s.ui.addOpen);
  const setUI = useStore((s) => s.setUI);
  const put = useStore((s) => s.put);
  const router = useRouter();
  const close = useCallback(() => setUI({ addOpen: false }), [setUI]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  if (!open) return null;

  const fire = (kind: AddKind) => {
    if (kind !== 'note') {
      setUI({ addOpen: false, quickAdd: kind });
      return;
    }
    const id = uid();
    const now = new Date().toISOString();
    put('notes', { id, title: '', courseId: null, lectureId: null, content: '', createdAt: now, updatedAt: now });
    setUI({ addOpen: false, focus: { type: 'note', id } });
    router.push('/notes/');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-2 md:items-center md:p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/35 dark:bg-black/55" onClick={close} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-sheet-title"
        className="relative z-10 flex w-full max-w-md animate-sheet-up flex-col gap-4 rounded-[34px] bg-card px-[18px] pt-2.5 shadow-pop ring-1 ring-foreground/5 dark:ring-white/[0.06] md:animate-zoom-in md:rounded-3xl md:pb-5"
        style={{ paddingBottom: 'max(18px, calc(env(safe-area-inset-bottom) - 8px))' }}
      >
        <span aria-hidden className="h-[5px] w-[38px] self-center rounded-full bg-muted-foreground/30 md:hidden" />
        <div className="flex items-center justify-between">
          <h2 id="add-sheet-title" className="font-display text-2xl font-extrabold">Add</h2>
          <button
            aria-label="Close"
            onClick={close}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform active:scale-95"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2.6} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {ADD_ITEMS.map((it, i) => (
            <button
              key={it.kind}
              autoFocus={i === 0}
              onClick={() => fire(it.kind)}
              className={cn(
                'flex min-h-[92px] flex-col items-start justify-between gap-2.5 rounded-[20px] p-3.5 text-left transition-transform active:scale-[0.97]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                it.tile,
              )}
            >
              <it.icon className="h-6 w-6" strokeWidth={2.2} />
              <span>
                <span className="block text-base font-bold text-foreground">{it.label}</span>
                <span className="block text-xs text-foreground/70">{it.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------- app shell --------------------------------- */

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useStore((s) => s.hydrated);
  const hydrate = useStore((s) => s.hydrate);
  const setUI = useStore((s) => s.setUI);
  useTheme();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // service worker (offline support)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // ⌘K / Ctrl+K opens search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setUI({ searchOpen: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setUI]);

  useEffect(() => {
    setUI({ addOpen: false });
  }, [pathname, setUI]);

  /** responsive=true: icon-only on md (tablet rail), labels on lg (desktop). */
  const SidebarLink = ({ item, responsive }: { item: (typeof NAV)[number]; responsive?: boolean }) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        href={item.href}
        title={item.label}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
          active ? 'text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          responsive && 'justify-center px-0 lg:justify-start lg:px-3',
        )}
      >
        {active && <span aria-hidden className="hl-swipe absolute inset-x-1 inset-y-0.5 -z-10" />}
        <item.icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-foreground')} />
        <span className={cn(responsive && 'hidden lg:inline')}>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ------------------------- desktop / tablet sidebar ------------------ */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r border-border bg-card md:flex lg:w-60">
        <Link href="/" className="flex h-16 items-center gap-2.5 px-3 lg:px-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="hidden font-display text-lg font-extrabold tracking-tight lg:block">
            Academic<span className="text-primary">OS</span>
          </span>
        </Link>
        <button
          onClick={() => setUI({ searchOpen: true })}
          className="mx-2 mb-2 flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted lg:mx-3"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden flex-1 text-left lg:block">Search…</span>
          <kbd className="hidden rounded-md border border-border bg-card px-1.5 text-[10px] font-bold lg:block">⌘K</kbd>
        </button>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4 lg:px-3">
          {NAV.map((item) => (
            <SidebarLink key={item.href} item={item} responsive />
          ))}
        </nav>
        <div className="hidden border-t border-border p-4 text-[11px] leading-relaxed text-muted-foreground lg:block">
          <Link href="/sync/" className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary">
            <RefreshCw className="h-3.5 w-3.5" /> Sync devices
          </Link>
          <p>Offline-first · data stays on your devices</p>
        </div>
      </aside>

      {/* --------------------------------- main ------------------------------ */}
      {/* phones: room for the status bar on top and the floating tab bar below */}
      <main className="px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6 md:ml-16 md:pb-28 md:pt-8 lg:ml-60 lg:px-10 lg:pb-10">
        <div className="mx-auto w-full max-w-6xl">
          {hydrated ? children : (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
                <p className="text-sm font-medium">Loading your workspace…</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* fades content out under the floating tab bar */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-b from-background/0 to-background to-60% md:hidden"
        style={{ height: 'calc(env(safe-area-inset-bottom) + 96px)' }}
      />
      <TabBar pathname={pathname} />
      {/* hidden mid-sync: it covers the flow's buttons and adding there makes no sense */}
      {!pathname.startsWith('/sync') && <AddButton />}
      <AddSheet />
      <CommandSearch />
      <QuickAddHost />
    </div>
  );
}
