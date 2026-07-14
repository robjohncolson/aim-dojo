# CODEX PROMPT — PERF P1: Vercel CDN cache headers

**Repo:** `aim-dojo` (static site on Vercel)  
**Spec:** `SPEC_PERF_V1.md` §P1  
**Do not:** change gameplay, temple logic, or image bytes in this parcel.

## Problem

Production currently serves assets with:

```http
cache-control: public, max-age=0, must-revalidate
```

on both `index.html` and large sky JPEGs (`assets/sky/*`). That forces revalidation/refetch of multi‑MB textures on many return visits.

## Tasks

| ID | Task |
|----|------|
| C1 | Create `vercel.json` at repo root with `headers` routes |
| C2 | **Assets** (`/assets/(.*)`): long-lived cache — prefer `public, max-age=31536000, immutable` |
| C3 | **Fixtures + JS modules** (`/*.js`, `/fixtures/(.*)`): long-lived cache (same or 7d if you document no-hash risk) |
| C4 | **HTML** (`/`, `/index.html`): keep short cache — `public, max-age=0, must-revalidate` is OK |
| C5 | Add 5–10 lines to `README.md` under Deploy: what is cached, how to bust (rename or redeploy) |
| C6 | Do **not** commit `.vercel/`; do **not** change `index.html` game code |

## Example shape (adjust as needed)

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)\\.(js|json|jpg|jpeg|png|webp|avif)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/index.html",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

**Caution:** `immutable` on unhashed files means browsers may keep old `2k_mars.jpg` after a content change with the same path. Prefer either:
- shorter max-age (e.g. 7 days) for unhashed sky maps, **or**
- document that asset updates should rename / version path.

For P1, **7-day** long cache on `/assets/**` is acceptable if you call that out in README.

## Acceptance

- [ ] `vercel.json` valid JSON  
- [ ] After deploy: asset response has multi-day `max-age`; HTML stays revalidate  
- [ ] No test failures (`node --test tests/*.test.js`)  
- [ ] Commit message explains cache split  

## Out of scope

Image compression, lazy loading, HTML split (P2–P4).
