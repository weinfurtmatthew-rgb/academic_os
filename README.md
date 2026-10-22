# Academic OS 🎓

Your offline-first academic command center — courses, assignments, exams, notes, grades, study planning, calendar and analytics in one fast, installable web app.

**No backend. No account. No cloud.** Everything lives in your browser (IndexedDB + LocalStorage) and keeps working with zero internet.

## ✨ Modules

| Module | What it does |
|---|---|
| **Today** | What's up next, the rest of today (classes, study sessions, deadlines), tomorrow and the week ahead; check things off in place |
| **Courses** | Grid/list views · per-course hub with Assignments / Lectures / Exams / Notes / Resources tabs |
| **Assignments** | List · Kanban board (drag & drop) · Calendar · Timeline, with course/due/priority/status filters |
| **Lectures** | Date-grouped log, summaries, rich markdown notes, image & PDF attachments |
| **Notes** | Notion-style editor: headings, checklists, tables, code, images, **KaTeX math** (`$…$`), `[[internal links]]` between notes, instant search |
| **Exams** | Countdown cards, weight %, prep status → progress bar |
| **Grades** | Inline grade entry, weighted course averages, GPA (4/5/10 scale), semester average, GPA trend |
| **Study Planner** | Daily / weekly / monthly planning, total & weekly hours, study streak 🔥 |
| **Calendar** | Assignments + exams + sessions unified · day/week/month · drag items to reschedule |
| **Analytics** | Completion rate, tasks/week, daily & weekly study hours, course performance, GPA trend |
| **Search** | ⌘K / Ctrl+K palette across everything |
| **Settings** | Light/dark/system theme, GPA scale, semester dates, JSON export/import, reset |
| **Sync** | Copy everything between your phone and computer by scanning QR codes — device to device, no account |
| **Canvas import** | Paste your Canvas calendar feed link once; upcoming Canvas assignments land in the right courses and stay in sync each time the app opens |
| **On phones** | iPhone-style layout: floating tab bar (Today · Tasks · Calendar · Courses · More) with a + beside it for adding anything |

Every change **saves automatically** — there is no save button anywhere.

## 🚀 Run it

Requires Node 18+.

```bash
npm install
npm run dev          # → http://localhost:3000
```

### Production / static build

```bash
npm run build        # outputs a fully static site to ./out
npx serve out        # serve it from any static host
```

The `out/` folder can be dropped onto GitHub Pages, Netlify, Vercel, an S3 bucket, a Raspberry Pi — anything that serves files.

The site must be served from the **root of a domain** (e.g. `academic-os.pages.dev`), not a sub-path like `user.github.io/repo/` — asset and route paths are absolute.

## ☁️ Deploying

### Cloudflare (current host)

`wrangler.jsonc` does everything: `npx wrangler deploy` runs `npm ci && npm run build` and uploads `out/` as a static-assets Worker. In the Cloudflare dashboard (**Workers & Pages → Create → Import a repository**) leave the build command empty and keep the default deploy command. Every push to `main` redeploys.

`compatibility_date` is pinned in `wrangler.jsonc`; Cloudflare rejects dates later than its own "today".

### GitHub Pages (optional)

`.github/workflows/deploy.yml` builds and publishes `out/`. It only runs manually: set **Settings → Pages → Source** to **GitHub Actions**, add a custom domain (see the root-path note above), then run the workflow from the **Actions** tab.

## 📲 Install as an app (PWA)

1. Open the site **once while online** (production build — the service worker is disabled in `npm run dev`).
2. Install it:
   - **Desktop Chrome/Edge:** click the install icon in the address bar.
   - **Android Chrome:** menu → *Add to Home screen*.
   - **iOS Safari:** Share → *Add to Home Screen*.
3. Done — it launches full-screen with its own icon and **works fully offline**.

## 💾 Your data

- Stored locally: IndexedDB (entities) + LocalStorage (settings). Refreshing, restarting or going offline loses nothing.
- **Settings → Export JSON** for backups; **Import JSON** merges a backup in: for each item the newer version wins, so anything changed or deleted on this device since the backup stays that way.
- *Clearing browser site data deletes everything* — export first.
- New here? **Settings → Load sample data** (or the button on the empty dashboard) fills the app with a realistic semester to explore.

## 🔄 Syncing devices

**Settings → Sync devices** copies everything between two devices, both ways, with no server and no account.

1. Open Sync on both devices. Tap **Start here** on one and scan its QR code with the other.
2. The second device shows a reply code; scan it with the first.
3. They connect directly (WebRTC) and swap only what changed, attachments included. For each item the newest edit wins, and deletions carry over.

- Data goes straight between the devices, encrypted by WebRTC. The QR codes hold only connection details. `stun.cloudflare.com` is asked for each device's public address (needed when they're on different networks); it never sees app data.
- Both devices must have the page open at the same time. Same Wi-Fi works best; campus and public Wi-Fi often block device-to-device connections, so use a phone hotspot there.
- Every record carries a last-changed stamp from a clock that never runs backwards, so edits made after a sync win even if one device's clock is wrong. Deletions are remembered (tombstones) so they don't come back.
- Can't scan? Each step has a copy/paste text code.

Run `npm test` for the merge and handshake unit tests.

## 🛠 Stack

Next.js 14 (App Router, static export) · TypeScript (strict) · TailwindCSS · Zustand · IndexedDB · marked + KaTeX + DOMPurify for the editor · custom shadcn-style UI components · hand-rolled SVG/CSS charts · service worker for offline.

## ⌨️ Tips

- `⌘K` / `Ctrl+K` — search everything
- Type `[[Note title]]` inside any note or lecture to link notes together
- `$E=mc^2$` inline math, `$$…$$` block math
- Drag assignment cards between Kanban columns; drag calendar chips between days
- Tap the round checkbox on any task row to complete it instantly


## New in this build

- **Study screen** (`/study`) — start a live session with a running timer, pause/break, a notes editor, an embedded **YouTube** music player (paste any video, playlist, or live-stream URL), an energy/mood check, and a "related materials" rail linking the course's PDFs, due assignments and due flashcards. The session survives a refresh and logs real minutes + mood when you finish.
- **Flashcards** (`/flashcards`) — spaced-repetition (SM-2-lite) with Again/Hard/Good/Easy grading, markdown + KaTeX on both sides, keyboard review (space to flip, 1-4 to grade), per-course filtering and a full card manager.
- **PDF annotation** — open any PDF attached to a lecture or added as a course resource and mark it up with pen, highlighter, sticky notes and an eraser (with undo/redo, zoom and page navigation). Annotations auto-save to this device and stay with the file. Fully offline.
- **Class schedule** (`/schedule`) — a weekly timetable built from each course's meeting times, with a live "now" line on the desktop grid and a day-picker on mobile.
- **Instructor contact & office hours** — every course now stores the instructor's email, phone, office and office hours, plus its weekly meeting pattern, shown on the course page and editable in the course dialog.

Music playback streams from YouTube so it needs an internet connection; everything else (including PDF annotation) works fully offline.

## Canvas import

Canvas doesn't let a web page read its calendar feed directly, so the Cloudflare deployment includes a tiny Worker (`worker/index.ts`) with one route, `/api/canvas-feed`. It only fetches Canvas feed links (`https://<school>/feeds/calendars/user_….ics`), stores nothing, and caches nothing. Everything else is served as static files. On GitHub Pages there is no Worker, so Canvas import shows a message instead.

