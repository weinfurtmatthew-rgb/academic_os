import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        muted: 'hsl(var(--muted) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        primary: 'hsl(var(--primary) / <alpha-value>)',
        'primary-foreground': 'hsl(var(--primary-foreground) / <alpha-value>)',
        highlighter: 'hsl(var(--highlighter) / <alpha-value>)',
        success: 'hsl(var(--success) / <alpha-value>)',
        'success-foreground': 'hsl(var(--success-foreground) / <alpha-value>)',
        destructive: 'hsl(var(--destructive) / <alpha-value>)',
        'destructive-foreground': 'hsl(var(--destructive-foreground) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Public Sans Variable"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
      },
      // tints the components use that aren't in Tailwind's default opacity scale
      opacity: {
        8: '0.08',
        12: '0.12',
        45: '0.45',
        85: '0.85',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(20 21 38 / 0.05), 0 8px 24px -12px rgb(20 21 38 / 0.12)',
        pop: '0 12px 40px -12px rgb(20 21 38 / 0.28)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'zoom-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'slide-up': 'slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'zoom-in': 'zoom-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        'sheet-up': 'sheet-up 0.34s cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
