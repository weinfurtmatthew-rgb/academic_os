# Academic OS

Offline-first academic command center (courses, assignments, exams, notes,
flashcards, grades, study planning). This repo is a pre-built static export —
there is no build step. The repo root is the site root.

> **The site must be served from the root of a domain** (e.g.
> `academic-os.pages.dev` or `study.example.com`), not a sub-path like
> `user.github.io/repo/`. All asset and route paths are absolute (`/_next/...`,
> `/courses/`, the service worker, the manifest).

## Cloudflare Pages (recommended)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**, pick this repo.
2. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/` (leave as the root)
3. Deploy. It's served at `https://<project>.pages.dev/`.

Or drag-and-drop: **Create** → **Pages** → **Upload assets**, and drop the
contents of this repo.

## GitHub Pages

The workflow at `.github/workflows/deploy.yml` publishes the site on every
push to `main` (or run it manually from the Actions tab).

1. Repo **Settings** → **Pages** → Source: **GitHub Actions**.
2. Because a project site lives at `https://<user>.github.io/<repo>/` (a
   sub-path), add a **custom domain** in the same Pages settings so the app is
   served from a domain root. Without one, styles, scripts and navigation break.

`.nojekyll` is included so GitHub Pages serves the `_next/` folder.

## Local preview

```sh
python3 -m http.server 8080
# open http://localhost:8080
```
