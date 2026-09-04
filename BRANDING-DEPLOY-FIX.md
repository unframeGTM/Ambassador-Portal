# Ambassador Portal — Branding Fix + Deploy from GitHub to Vercel

**Repo:** https://github.com/lexlevitte-jpg/Ambassador-Portal
**Audience:** the coding agent (Claude Code) working inside a local clone of that repo.
**Prepared by:** Daniel Wei, 2026-09-04. Companion assets in `Ambassador-Portal-brand-assets/` next to this file.

This is not a QA pass. It fixes exactly two things:

1. The app cannot render Unframe branding (broken logo, no brand font, off-brand palette).
2. The app is deployed by pushing a local snapshot into Vercel through the MCP/CLI instead of from the GitHub repo. Every deploy must come from a commit on `main`.

Do the steps in order. Each step ends with a check. Do not move on until the check passes.

---

## 0. Ground rules for the agent

- Work only inside the cloned repo. Commit as you go. Never run `vercel`, `vercel deploy`, or `vercel --prod` (all three upload local files), and never use a Vercel MCP deploy tool. Deploys happen only from a GitHub push (Section 9). Vercel CLI commands that configure rather than upload are allowed and expected: `vercel login`, `vercel link`, `vercel git connect`, `vercel env`, `vercel ls`, `vercel inspect`, `vercel redeploy`.
- Do not touch auth, session, Salesforce, or Resend logic beyond the one email-template change in Step 6. No refactors, no dependency upgrades, no framework changes. Next 14 pages router stays.
- Do not paste or "recreate from memory" any binary or base64 content. That is how the logo broke (see Section 1). Assets are downloaded with `curl` or written as plain vector SVG text given verbatim below.
- Keep every existing CSS class name. Pages reference them by name and must keep working.
- Before committing, run `npm run build`. A failing build is never committed.

---

## 1. Diagnosis (verified 2026-09-04)

| Symptom | Root cause | Evidence |
|---|---|---|
| Login page logo shows a blurry blue/green/white blob for the "U" | `public/logo-dark.svg` builds the "U" from a base64 PNG embedded in an SVG `<pattern>`. That base64 blob is corrupt: it does not decode to a valid PNG and its hash does not match the source file on unframe.ai. The agent that wrote the file mangled the base64. | `base64 -d` on the blob fails; MD5 differs from the CDN original; headless Chrome render shows garbage in the U. |
| Nav logo is a flat all-white wordmark with no gradient U | `public/logo-white.svg` is a hand-traced monochrome copy, not the brand asset. | File contains only `fill="white"` paths and no mark. |
| Browser tab icon is a squashed wordmark | `_app.js` points the favicon at the 1021×212 wordmark SVG. | `<link rel="icon" href="/logo-dark.svg">` |
| Typeface is system sans | No brand font loaded anywhere. Brand typeface is **Poppins**. | `globals.css` `font-family: -apple-system, …` |
| Colors read as Jira/Atlassian, not Unframe | `globals.css` uses the Atlassian design-token palette (`#dfe1e6`, `#6b778c`, `#344563`, `#0747a6`, `#0052cc`, `#172b4d`). Only the button color (`#3231DD`) is on-brand. | grep the file for those hexes. |
| No brand gradient anywhere | The signature Unframe gradient bar is missing from nav, login card, and email. | — |
| OTP email is unbranded | Plain HTML with Atlassian colors and `onboarding@resend.dev` as sender. | `pages/api/auth.js` |
| Deploys are unreliable / drift from the repo | Project was deployed by uploading a local snapshot via the Vercel MCP/CLI. Vercel is not linked to the GitHub repo, so what is live is not tied to any commit, build logs are not surfaced, and files can be mangled or missing. | Repo has one commit and no Vercel Git integration. |

The build itself is fine: `npm install && npm run build` succeeds on Next 14.2.

---

## 2. Brand reference (source of truth: Unframe Brand Guidelines)

**Typeface:** Poppins. 300 Light (secondary text), 400 Regular (body), 600/700 Bold (headings, buttons).

**Palette (gradient order):**

| Token | Hex | Use |
|---|---|---|
| Cyan | `#00C5EA` | gradient start |
| Blue | `#3231DD` | primary button, links, hover |
| Purple | `#7800FF` | the "U", primary accent |
| Magenta | `#DF00B4` | gradient only |
| Pink | `#FF0080` | gradient only |
| Orange | `#FF9600` | gradient end |
| Ink | `#141414` | near-black: dark surfaces, headings, nav |
| Light surface | `#F4F3F1` | page background on light screens |

**Gradient (accent bar only, never behind body text):**
`linear-gradient(90deg, #00C5EA, #3231DD, #7800FF, #DF00B4, #FF0080, #FF9600)`

**Logo:** wordmark "Unframe" with a gradient "U". On dark backgrounds the rest of the word is white; on light backgrounds it is `#141414`. Never recolor, stretch, or add effects.

**Design decision for this app:** light content surface (forms and tables read better on light) with a dark `#141414` nav, Poppins everywhere, one gradient accent rule at the top of the nav and the login card. This mirrors the Signal Workbench login screen, which is the closest existing internal reference.

---

## 3. Step 1 — Replace the logo assets

Run from the repo root. Do not open or edit the downloaded SVGs.

```bash
# Remove the broken assets
git rm public/logo-dark.svg public/logo-white.svg

# Wordmark for DARK backgrounds (white text + gradient U) — official asset from unframe.ai
curl -sL -o public/logo-on-dark.svg \
  'https://cdn.prod.website-files.com/66b34f2ad59081546d14c723/66b4797d0a56400f9a196424_Unframe%20Logo%20-%20Refined%20Palette%201.svg'

# Wordmark for LIGHT backgrounds (near-black text + gradient U)
curl -sL -o public/logo-on-light.svg \
  'https://cdn.prod.website-files.com/66b34f2ad59081546d14c723/66b4795caff3f505c5c51c6c_Unframe%20Logo%20-%20Refined%20Palette%201.svg'
```

If `curl` is blocked, copy the same two files from `Ambassador-Portal-brand-assets/` (Daniel's folder) into `public/` with the same names.

Now create the standalone gradient mark, used as the favicon. Write this file **exactly** as `public/favicon.svg` (it is plain vector text, no base64):

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212 212" width="212" height="212">
  <defs>
    <linearGradient id="unframe-u" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#00C5EA"/>
      <stop offset="0.45" stop-color="#7800FF"/>
      <stop offset="1" stop-color="#FF0080"/>
    </linearGradient>
  </defs>
  <rect width="212" height="212" rx="40" fill="#141414"/>
  <path fill="url(#unframe-u)" transform="translate(12 0)" d="M177.879 113.66C178.119 140 170.259 161.18 154.959 177.2C139.719 193.22 119.739 201.08 94.8989 201.08C70.0589 201.08 49.1189 193.22 33.5789 177.2C18.0989 161.18 10.4189 140 10.4189 113.42V10.04H50.7989V112.7C50.7989 128.24 54.7589 140.54 62.8589 149.6C70.9589 158.72 81.5789 163.16 94.8389 163.16C107.379 163.16 117.459 158.72 125.139 149.6C132.759 140.48 136.719 128.18 136.719 112.7V10.04H177.339L177.819 113.66H177.879Z"/>
</svg>
```

**Check:**

```bash
ls -la public/            # expect: favicon.svg, logo-on-dark.svg, logo-on-light.svg — nothing else
wc -c public/logo-on-*.svg  # each ~14,290 bytes
grep -c '<image' public/logo-on-dark.svg   # expect 1 (the U is an embedded raster in the official file; that is fine at nav/login size)
```

Open each SVG in a browser. `logo-on-dark.svg` on a dark tab background must show a white wordmark with a cyan→purple→pink "U". `favicon.svg` must show a rounded dark square with a gradient U.

---

## 4. Step 2 — Load Poppins with `next/font`

Replace `pages/_app.js` entirely:

```jsx
import Head from 'next/head';
import { Poppins } from 'next/font/google';
import '../styles/globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Unframe Ambassador Portal</title>
        <meta name="description" content="Unframe partner ambassador portal" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#141414" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </Head>
      <style jsx global>{`
        html { font-family: ${poppins.style.fontFamily}; }
      `}</style>
      <Component {...pageProps} />
    </>
  );
}
```

`next/font` downloads Poppins at build time and self-hosts it, so there is no runtime request to Google and no `<link>` tag. Vercel builds have network access, so this works there. If the local build fails on font download because of a proxy, fall back to adding `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />` inside `<Head>` and remove the `next/font` import, but prefer `next/font`.

**Check:** `npm run build` passes. In `npm run dev`, DevTools → Network shows a `poppins` woff2 served from `/_next/static/media/`.

---

## 5. Step 3 — Replace `styles/globals.css` with the brand-tokened stylesheet

Replace the whole file. Every class name from the current file is preserved.

```css
/* ===== Unframe brand tokens ===== */
:root {
  --ink:        #141414;
  --ink-2:      #3D3D42;
  --ink-3:      #6E6E75;
  --surface:    #F4F3F1;
  --card:       #FFFFFF;
  --line:       #D4D2DA;
  --line-soft:  #ECEBEE;

  --brand-blue:   #3231DD;
  --brand-purple: #7800FF;
  --accent:       #3231DD;   /* primary actions */
  --accent-hover: #2726B8;
  --accent-tint:  #ECECFC;   /* light brand-blue wash for hovers/selected */
  --focus-ring:   rgba(120, 0, 255, .25);

  --gradient: linear-gradient(90deg, #00C5EA, #3231DD, #7800FF, #DF00B4, #FF0080, #FF9600);

  --ok-bg:   #E6F7EF;  --ok-fg:   #0B6B3F;
  --warn-bg: #FFF4E0;  --warn-fg: #8A4B00;
  --bad-bg:  #FDE8EC;  --bad-fg:  #B3123A;
  --info-bg: #ECECFC;  --info-fg: #3231DD;
  --muted-bg:#EFEEF1;  --muted-fg:#6E6E75;

  --radius: 8px;
  --shadow: 0 1px 2px rgba(20,20,20,.06), 0 8px 24px rgba(20,20,20,.06);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-weight: 400;
  background: var(--surface);
  color: var(--ink);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

.container { max-width: 900px; margin: 0 auto; padding: 0 24px; }

/* ===== Nav (dark, with gradient rule on top) ===== */
.nav {
  position: relative;
  background: var(--ink);
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}
.nav::before {
  content: '';
  position: absolute; left: 0; right: 0; top: 0;
  height: 3px;
  background: var(--gradient);
}
.nav-logo { height: 26px; width: auto; display: block; }
.nav-user { font-size: 14px; color: #AEAEB2; display: flex; align-items: center; gap: 12px; }

/* ===== Login ===== */
.login-wrap {
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; padding: 24px;
}
.login-card {
  position: relative;
  overflow: hidden;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 44px 48px 40px;
  width: 100%;
  max-width: 440px;
}
.login-card::before {
  content: '';
  position: absolute; left: 0; right: 0; top: 0;
  height: 4px;
  background: var(--gradient);
}
.login-logo { height: 30px; width: auto; margin-bottom: 24px; display: block; }
.login-card h1 { font-size: 22px; font-weight: 700; letter-spacing: -.02em; margin-bottom: 8px; color: var(--ink); }
.login-card p  { font-size: 14px; font-weight: 300; color: var(--ink-2); line-height: 1.6; margin-bottom: 28px; }

/* ===== Forms ===== */
label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--ink-2); }
input, textarea, select {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
  background: var(--card);
  color: var(--ink);
}
input::placeholder, textarea::placeholder { color: var(--ink-3); font-weight: 300; }
input:focus, textarea:focus, select:focus {
  border-color: var(--brand-purple);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
textarea { resize: vertical; min-height: 80px; }
.form-group { margin-bottom: 18px; }

/* ===== Buttons ===== */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 20px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
  text-decoration: none;
  line-height: 1.2;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-secondary { background: transparent; color: var(--ink-2); border-color: var(--line); }
.btn-secondary:hover { background: var(--accent-tint); border-color: var(--brand-blue); color: var(--brand-blue); }
.nav .btn-secondary { color: #E6E6EA; border-color: #48484A; }
.nav .btn-secondary:hover { background: rgba(255,255,255,.08); border-color: #AEAEB2; color: #fff; }
.btn-sm { padding: 7px 14px; font-size: 13px; }
.btn:disabled { opacity: .5; cursor: not-allowed; }

/* ===== Status badges ===== */
.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.badge-pending    { background: var(--warn-bg);  color: var(--warn-fg); }
.badge-approved   { background: var(--ok-bg);    color: var(--ok-fg); }
.badge-intro-made { background: var(--info-bg);  color: var(--info-fg); }
.badge-active     { background: var(--ok-bg);    color: var(--ok-fg); }
.badge-converted  { background: var(--ok-bg);    color: var(--ok-fg); }
.badge-expired    { background: var(--bad-bg);   color: var(--bad-fg); }
.badge-released   { background: var(--muted-bg); color: var(--muted-fg); }
.badge-rejected   { background: var(--bad-bg);   color: var(--bad-fg); }

/* ===== Page header ===== */
.page-header {
  padding: 32px 0 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -.02em; }

/* ===== Table ===== */
.table-wrap { overflow-x: auto; }
table {
  width: 100%; border-collapse: collapse;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
}
th {
  background: var(--surface);
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em;
  color: var(--ink-3);
  padding: 12px 16px; text-align: left;
  border-bottom: 1px solid var(--line);
}
td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid var(--line-soft); }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #FAFAFB; }

/* ===== Cards ===== */
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 24px;
  margin-bottom: 16px;
}
.card h2 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.card-meta { font-size: 13px; font-weight: 300; color: var(--ink-3); margin-bottom: 16px; }

/* ===== Dates grid ===== */
.dates-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-top: 12px; }
.date-item { background: var(--surface); border-radius: 6px; padding: 10px 12px; }
.date-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); margin-bottom: 4px; }
.date-value { font-size: 14px; font-weight: 500; color: var(--ink); }
.date-value.expiring { color: var(--warn-fg); }
.date-value.expired  { color: var(--bad-fg); }

/* ===== Empty state ===== */
.empty { text-align: center; padding: 60px 24px; color: var(--ink-3); }
.empty h2 { font-size: 18px; font-weight: 600; margin-bottom: 8px; color: var(--ink); }
.empty p  { font-size: 14px; font-weight: 300; margin-bottom: 20px; }

/* ===== Messages ===== */
.error-msg   { background: var(--bad-bg); color: var(--bad-fg); border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
.success-msg { background: var(--ok-bg);  color: var(--ok-fg);  border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }

/* ===== Autocomplete ===== */
.autocomplete-wrap { position: relative; }
.autocomplete-list {
  position: absolute; z-index: 100; top: 100%; left: 0; right: 0;
  background: var(--card);
  border: 1px solid var(--brand-purple);
  border-top: none;
  border-radius: 0 0 6px 6px;
  max-height: 220px; overflow-y: auto;
  box-shadow: var(--shadow);
}
.autocomplete-item { padding: 10px 12px; font-size: 14px; cursor: pointer; }
.autocomplete-item:hover { background: var(--accent-tint); }
```

**Check:** `grep -n -i 'dfe1e6\|6b778c\|344563\|0747a6\|0052cc\|172b4d\|f4f5f7' styles/globals.css` returns nothing.

---

## 6. Step 4 — Wire the new assets and remove inline off-brand colors in pages

### `pages/index.js`
Change the logo line to the light-background wordmark:

```jsx
<img src="/logo-on-light.svg" alt="Unframe" className="login-logo" />
```

### `pages/dashboard.js` and `pages/register.js`
Change the nav logo in both files to the dark-background wordmark:

```jsx
<img src="/logo-on-dark.svg" alt="Unframe" className="nav-logo" />
```

### Inline styles that still carry Atlassian hexes
Both pages have inline `style={{ color: '#6b778c' }}`, `'#344563'`, `'#006644'`, `'#0052cc'`, `'#dfe1e6'`, `'#fff7e6'`, `'#ffe0a3'`, `'#7a4f00'`. Replace them with the CSS variables, e.g. `color: 'var(--ink-3)'`, `color: 'var(--ink-2)'`, `color: 'var(--ok-fg)'`, `color: 'var(--brand-blue)'`, `border: '1px solid var(--line)'`, and for the "account is held" notice use `background: 'var(--warn-bg)', border: '1px solid #F2D9A6', color: 'var(--warn-fg)'`.

The three filter `<select>` elements in `dashboard.js` set `borderRadius: 6, border: '1px solid #dfe1e6'` inline. Change to `border: '1px solid var(--line)'` and add `fontFamily: 'inherit'`.

The uppercase filter labels use `color: '#6b778c'`; change to `'var(--ink-3)'`.

**Check:** `grep -rn -i '#dfe1e6\|#6b778c\|#344563\|#0747a6\|#0052cc\|#172b4d\|#006644\|#fff7e6\|#7a4f00' pages/` returns nothing.

---

## 7. Step 5 — Brand the OTP email (`pages/api/auth.js`)

Email clients do not load web fonts reliably, so the email uses a font stack with Poppins first and a solid brand-purple rule instead of the CSS gradient. The "U" is colored inline so no image asset is needed.

Replace the `html:` template string in `resend.emails.send({...})` with:

```js
html: `
  <div style="font-family: 'Poppins', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #141414;">
    <div style="height: 4px; background: #7800FF; border-radius: 2px; margin-bottom: 24px;"></div>
    <div style="font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 20px;"><span style="color: #7800FF;">U</span>nframe</div>
    <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">Your login code</h2>
    <p style="color: #3D3D42; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">Enter this code in the Ambassador Portal. It expires in 10 minutes.</p>
    <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #141414; margin-bottom: 24px;">${otp}</div>
    <p style="font-size: 13px; color: #6E6E75; margin: 0;">If you didn't request this, you can ignore this email.</p>
  </div>
`,
```

**Sender address:** `onboarding@resend.dev` is Resend's sandbox sender. It only delivers to the email on the Resend account, so real ambassadors will never receive a code. This is a functional blocker, not branding. Leave the code as-is for now, but add a `TODO` comment above the `from:` line:

```js
// TODO: verify unframe.ai in Resend (Domains → Add) and switch to 'Unframe Ambassador Portal <ambassadors@unframe.ai>'
```

---

## 8. Step 6 — Verify locally, then commit

```bash
npm install
npm run build          # must pass
npm run dev            # open http://localhost:3000
```

Visual checklist (all must be true):

- [ ] Login: gradient rule across the top of the card, wordmark with gradient U, Poppins headings.
- [ ] `/register` and `/dashboard` (these render without login; the data fetch will 401 and redirect, so check the nav before it redirects, or comment out the redirect temporarily and put it back): dark nav with 3px gradient rule, white wordmark with gradient U.
- [ ] Browser tab shows the rounded dark square with a gradient U.
- [ ] No serif or system-font fallback anywhere (Poppins visible in DevTools → Computed → font-family).
- [ ] No console errors about missing `/logo-dark.svg` or `/logo-white.svg`.

Commit:

```bash
git add -A
git commit -m "Apply Unframe branding: official logo assets, Poppins, brand tokens, favicon, branded OTP email"
git push origin main
```

---

## 9. Deploy: Vercel builds from the GitHub repo, never from a local upload

### Why the current setup is weak
Deploying through the Vercel MCP or `vercel deploy` from a Claude Code session uploads whatever is on disk at that moment. It is not tied to a commit, the build log is not visible in the repo, assets can be corrupted in transit (which is likely how the logo broke), and the next deploy from a different machine silently replaces it. Linking the Vercel project to GitHub fixes all of that: every push to `main` builds and goes live, every PR gets a preview URL, and the live site always equals a commit.

### 9a. Link Vercel to the GitHub repo from the terminal (the agent does this; nobody waits on anyone)

Every command runs from the repo root. Lex is only needed twice: once to sign in to Vercel in the browser, and once to type secret values when prompted. The agent never sees or stores secrets.

```bash
# 1. Sign in (opens a browser once; Lex completes it)
npx vercel@latest login

# 2. Attach this folder to the Vercel project.
#    If a project already exists from the earlier MCP/CLI deploy, pick it when asked
#    "Link to existing project?" so the live URL is kept. Otherwise accept the defaults
#    to create one named ambassador-portal. This writes .vercel/ which is gitignored.
npx vercel link

# 3. Connect the project to the GitHub repo. This uses the `origin` remote.
#    Production branch defaults to main.
npx vercel git connect
```

If `vercel git connect` reports that the Vercel GitHub App is not installed for `lexlevitte-jpg`, it prints an install URL. Lex opens it once, grants access to the Ambassador-Portal repo, and the agent reruns the command. That is the only dashboard interaction in this whole document.

```bash
# 4. Check which env vars already exist on the project
npx vercel env ls

# 5. Add each missing one for Production (and Preview). Each command prompts for the value;
#    Lex types or pastes it. Do this for every row in the table below.
npx vercel env add SF_LOGIN_URL production
npx vercel env add SF_USERNAME production
npx vercel env add SF_PASSWORD production
npx vercel env add SESSION_SECRET production
npx vercel env add RESEND_API_KEY production
#    Repeat with `preview` in place of `production` if PR previews should work.

# 6. Confirm the project settings the CLI picked up
npx vercel project ls
```

Framework must show **nextjs**. If it does not, the project was created with the wrong preset. The CLI cannot change the preset, so open the project's Settings → General once, set Framework Preset to Next.js, and leave Root Directory blank.

### 9b. Trigger the first Git-sourced deploy and watch it

```bash
git push origin main                        # this is the deploy trigger
npx vercel ls                               # newest row should show the commit and state BUILDING → READY
npx vercel inspect <deployment-url> --logs  # build log; look for "✓ Compiled successfully"
```

The first row of `vercel ls` must show a Git commit SHA as its source. If it shows "CLI", the Git connection did not take; rerun `npx vercel git connect` and push again.

### Redeploying afterwards

- **Any code change:** commit and `git push origin main`. Vercel builds it automatically. Nothing else to do.
- **Same code, fresh build** (for example after changing an env var): `npx vercel redeploy <deployment-url>` rebuilds the latest Git deployment. Or push an empty commit: `git commit --allow-empty -m "Redeploy" && git push`.
- **Preview for a branch:** push any non-main branch or open a PR. Vercel posts a preview URL on the PR.

### Environment variables (all required at runtime)

| Name | Value | Notes |
|---|---|---|
| `SF_LOGIN_URL` | `https://login.salesforce.com` | Use `https://test.salesforce.com` only for a sandbox org. |
| `SF_USERNAME` | integration user's Salesforce username | A dedicated API user, not a personal login. |
| `SF_PASSWORD` | password **immediately followed by** the user's security token | jsforce username/password login requires `password+token` unless the Vercel egress IPs are whitelisted in Salesforce, which they cannot be. |
| `SESSION_SECRET` | random string, at least 32 characters | Generate with `openssl rand -base64 48`. iron-session refuses shorter secrets. Changing it logs everyone out. |
| `RESEND_API_KEY` | Resend API key | From resend.com → API Keys. |

Never commit these. `.env*.local` is already in `.gitignore`. For local dev, put them in `.env.local`.

### 9c. Verify the deploy
1. `npx vercel ls` shows the newest deployment with the Step 8 commit and state **READY**. `npx vercel inspect <url> --logs` shows `✓ Compiled successfully` and the route table listing `/`, `/dashboard`, `/register`, `/api/*`.
2. `curl -sI https://<production-url>/logo-on-dark.svg` and `.../favicon.svg` both return `200` with `content-type: image/svg+xml`.
3. `curl -s https://<production-url>/ | grep -o 'logo-on-light.svg\|__Poppins[_A-Za-z0-9]*' | sort -u` prints the logo filename and a Poppins font class. That proves the new assets and font shipped.
4. Open the production URL in a browser and repeat the Section 8 visual checklist.
5. Enter a known ambassador email on the login page. A `200` from `/api/auth` proves Salesforce login and Resend both work with the env vars. (The email only arrives once the sender domain is verified; see Step 5.)

### 9d. What is never allowed
`npx vercel`, `npx vercel deploy`, `npx vercel --prod`, and any Vercel MCP deploy tool. All of them upload the local folder instead of building the repo, which recreates the original problem.

---

## 10. Definition of done

- [ ] `public/` contains only `favicon.svg`, `logo-on-dark.svg`, `logo-on-light.svg`.
- [ ] Poppins loads via `next/font/google`; no system-font fallback visible.
- [ ] `globals.css` has zero Atlassian hexes; all colors come from the token block.
- [ ] Gradient rule visible on nav and login card; gradient U visible in every logo placement and the favicon.
- [ ] OTP email uses the branded template.
- [ ] Vercel project is Git-linked to `lexlevitte-jpg/Ambassador-Portal`, production branch `main`, all five env vars set.
- [ ] Latest production deployment's source is a GitHub commit, and the live site matches the local build.

---

## 11. Explicitly out of scope for this pass (log for the later QA round)

These were noticed while reading the code and are **not** to be fixed now:

- Resend sandbox sender (`onboarding@resend.dev`) blocks real ambassadors from receiving codes. Needs domain verification in Resend. **This will block launch.**
- SOQL queries interpolate user input with only single-quote escaping (`searchAccounts`, `findContactByEmail`, `createRegistration` website LIKE). Should move to parameterized patterns.
- Salesforce username/password auth on a shared integration user; consider a Connected App with JWT bearer flow.
- `notifySheaOfDuplicate` finds the approver by `Name LIKE '%Shea%'`; should be an env var user Id.
- No rate limit on `/api/auth` OTP sends.
