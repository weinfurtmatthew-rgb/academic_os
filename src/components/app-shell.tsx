'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3, BookOpen, Calendar, CalendarClock, CalendarRange, FileText, GraduationCap, Home,
  Layers, ListTodo, Menu, Percent, Play, Plus, Presentation, Search, Settings, Timer, X,
} from 'lucide-react';
import { useStore, type QuickAddKind } from '@/lib/store';
import { uid, cn } from '@/lib/utils';
import { CommandSearch } from '@/components/command-search';
import { QuickAddHost } from '@/components/forms';
import { useRouter } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Dashboard', icon: Home },
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

const MOBILE_NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/courses/', label: 'Courses', icon: GraduationCap },
  { href: '/assignments/', label: 'Tasks', icon: ListTodo },
  { href: '/calendar/', label: 'Calendar', icon: Calendar },
  { href: '/notes/', label: 'Notes', icon: FileText },
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

/* --------------------------------- FAB ------------------------------------- */

function Fab() {
  const [open, setOpen] = useState(false);
  const setUI = useStore((s) => s.setUI);
  const put = useStore((s) => s.put);
  const router = useRouter();

  const actions: { label: string; kind: QuickAddKind | 'note' | 'study' | 'flashcard'; icon: typeof Plus }[] = [
    { label: 'Note', kind: 'note', icon: FileText },
    { label: 'Flashcard', kind: 'flashcard', icon: Layers },
    { label: 'Study now', kind: 'study', icon: Play },
    { label: 'Study session', kind: 'session', icon: Timer },
    { label: 'Exam', kind: 'exam', icon: BookOpen },
    { label: 'Assignment', kind: 'assignment', icon: CalendarClock },
  ];

  const fire = (kind: QuickAddKind | 'note' | 'study' | 'flashcard') => {
    setOpen(false);
    if (kind === 'study') {
      router.push('/study/');
      return;
    }
    if (kind === 'flashcard') {
      router.push('/flashcards/');
      return;
    }
    if (kind === 'note') {
      const id = uid();
      put('notes', {
        id, title: '', courseId: null, lectureId: null, content: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      setUI({ focus: { type: 'note', id } });
      router.push('/notes/');
    } else {
      setUI({ quickAdd: kind });
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 lg:hidden">
      {open && (
        <div className="flex flex-col items-end gap-2 animate-slide-up">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => fire(a.kind)}
              className="flex items-center gap-2 rounded-full border border-border bg-card py-2 pl-3.5 pr-4 text-sm font-semibold shadow-lg"
            >
              <a.icon className="h-4 w-4 text-primary" />
              {a.label}
            </button>
          ))}
        </div>
      )}
      <button
        aria-label={open ? 'Close quick add' : 'Quick add'}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 transition-transform active:scale-95',
          open && 'rotate-45',
        )}
      >
        <Plus className="h-6 w-6 transition-transform" />
      </button>
    </div>
  );
}

/* ------------------------------- app shell --------------------------------- */

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useStore((s) => s.hydrated);
  const hydrate = useStore((s) => s.hydrate);
  const navOpen = useStore((s) => s.ui.navOpen);
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

  // close drawer on route change
  useEffect(() => {
    setUI({ navOpen: false });
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
          Offline-first · data stays on this device
        </div>
      </aside>

      {/* ------------------------------ mobile header ------------------------ */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur md:hidden">
        <button
          aria-label="Open menu"
          onClick={() => setUI({ navOpen: true })}
          className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-4 w-4" />
          </span>
          <span className="font-display text-base font-extrabold tracking-tight">
            Academic<span className="text-primary">OS</span>
          </span>
        </Link>
        <button
          aria-label="Search"
          onClick={() => setUI({ searchOpen: true })}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted"
        >
          <Search className="h-5 w-5" />
        </button>
      </header>

      {/* ------------------------------ mobile drawer ------------------------ */}
      {navOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in" onClick={() => setUI({ navOpen: false })} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-card shadow-2xl animate-slide-up">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="font-display text-base font-extrabold">
                Academic<span className="text-primary">OS</span>
              </span>
              <button aria-label="Close menu" onClick={() => setUI({ navOpen: false })} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {NAV.map((item) => (
                <SidebarLink key={item.href} item={item} />
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* --------------------------------- main ------------------------------ */}
      <main className="px-4 pb-28 pt-4 sm:px-6 md:ml-16 md:pb-10 md:pt-8 lg:ml-60 lg:px-10">
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

      {/* ----------------------------- mobile bottom nav ---------------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <Fab />
      <CommandSearch />
      <QuickAddHost />
    </div>
  );
}
