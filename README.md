# Mostafa Safwat Ibrahim — portfolio

Personal site at **https://mostafasibrahim.github.io**: 25+ years across datacenters, infrastructure,
architecture and IT leadership, and the full-stack work that followed.

Built without a UI framework: typed JSON content, small TypeScript modules, Vite, and a GitHub
Actions pipeline that only deploys when type checks, lint and a Lighthouse budget pass.

## Run it

```bash
npm ci
npm run dev        # http://localhost:5173 (site) and /admin/ (content editor)
npm run check      # typecheck + lint + formatting
npm run build      # production build in dist/
npx lhci autorun   # Lighthouse budget, as the pipeline runs it
```

## How it fits together

| Path                   | What lives there                                                               |
| ---------------------- | ------------------------------------------------------------------------------ |
| `src/data/*.json`      | All content: `projects`, `career`, `skills`, `segments` (IT domains)           |
| `src/types/content.ts` | The TypeScript contract every data file is checked against                     |
| `src/modules/`         | One module per section (hero canvas, stack, career carousel, skills, gallery…) |
| `src/admin/`           | The `/admin/` editor: GitHub API client, media handling, validation            |
| `src/styles/`          | Design tokens and one stylesheet per component                                 |
| `public/assets/`       | Images and video referenced by the data files                                  |
| `.github/workflows/`   | `ci.yml` checks pull requests; `deploy.yml` builds, gates and deploys `main`   |

Below-the-fold sections load their code (and GSAP) only as they approach the viewport, so the
first screen ships about 9 KB of JavaScript.

## Updating content

- **Projects:** open `/admin/` on the live site, sign in with a fine-grained GitHub token
  (this repository only, _Contents: Read and write_), edit, and press **Publish**. That makes one
  commit on `main`, and the pipeline redeploys the site in a minute or two.
- **Career, skills, IT domains:** edit the JSON in `src/data/` and open a pull request.

## Quality bar

WCAG 2.2 AA (contrast, keyboard, focus, reduced motion), Lighthouse ≥ 90 performance and ≥ 95
accessibility, best practices and SEO on every deploy.
