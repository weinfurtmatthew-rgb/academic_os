# Academic OS

Offline-first academic command center (courses, assignments, exams, notes,
flashcards, grades, study planning). This repo is a pre-built static export —
there is no build step. The site lives in `public/`.

> **The site must be served from the root of a domain** (e.g.
> `academic-os.pages.dev` or `study.example.com`), not a sub-path like
> `user.github.io/repo/`. All asset and route paths are absolute (`/_next/...`,
> `/courses/`, the service worker, the manifest).

## Cloudflare (recommended)

`wrangler.jsonc` deploys `public/` as a static-assets Worker, with a fixed
`compatibility_date` (Cloudflare rejects dates later than its own today).

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a
   repository**, pick this repo.
2. Leave the build command empty; the deploy command is `npx wrangler deploy`.
3. Deploy. It's served at `https://academic-os.<your-subdomain>.workers.dev/`.

Or drag-and-drop: **Create** → **Upload static files**, and drop the contents
of `public/`.

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
python3 -m http.server 8080 -d public
# open http://localhost:8080
```
