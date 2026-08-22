# Deploying from a phone

You need two free accounts — **GitHub** and **Vercel** — plus a **Groq API
key**. No computer, no terminal, no `npm`.

Total time: about 10 minutes, most of it waiting for builds.

---

## What you need first

1. **A Groq API key.** In your phone browser open
   `console.groq.com/keys` → sign in → **Create API Key** → copy it.
   It starts with `gsk_`. Paste it somewhere you can get to later (a note to
   yourself). You will need it in step 6.
2. **The file `mathmind.zip`** saved to your phone. In the Claude app, tap the
   file and choose Save / Download so it lands in Files (iPhone) or Downloads
   (Android).

---

## Step 1 — Create the repository

In your phone browser go to **github.com/new** (use the browser, not the GitHub
app — the app cannot upload files).

- **Repository name:** `mathmind`
- **Private** is fine
- Leave "Add a README" unchecked
- Tap **Create repository**

---

## Step 2 — Add the unpack workflow

GitHub will not expand a zip on its own, so a small workflow does it for you.

On the empty repository page, tap **creating a new file** (or go to
`github.com/YOUR-NAME/mathmind/new/main`).

- In the **file name** box type exactly:

  ```
  .github/workflows/unpack.yml
  ```

  Typing the slashes creates the folders automatically.

- In the editor, paste the entire contents of **`deploy/unpack.yml`** from the
  zip. If you cannot open the zip on your phone, the same file is included in
  this conversation — copy it from there.

- Scroll down, tap **Commit changes**, then **Commit changes** again.

---

## Step 3 — Upload the zip

Go to your repository home, tap **Add file** → **Upload files**.

- Tap **choose your files** and pick `mathmind.zip` from Files/Downloads
- Tap **Commit changes**

---

## Step 4 — Let it unpack

Tap the **Actions** tab. A run called **Unpack project** starts within a few
seconds. Wait for the green check (about 30 seconds).

Go back to the **Code** tab and pull to refresh. You should now see `src`,
`package.json`, `README.md` and the rest. The zip and the workflow have removed
themselves.

> If the run fails, open it and read the red step. The most common cause is
> uploading a different zip. Delete the zip from the repo and re-upload.

---

## Step 5 — Import into Vercel

Go to **vercel.com/new** in your phone browser.

- **Continue with GitHub** and authorise Vercel
- Find **mathmind** in the list and tap **Import**
- Vercel detects Next.js by itself — do not change the build settings

---

## Step 6 — Add your API key (do this before deploying)

Still on the import screen, open **Environment Variables** and add:

| Name | Value |
| --- | --- |
| `GROQ_API_KEY` | your `gsk_…` key |

Tap **Add**, then **Deploy**.

This is the one thing you must not skip. The key lives only in Vercel's
server-side environment — it is never sent to the browser, and the app has a
test that fails the build for anyone who tries to change that.

---

## Step 7 — Open it

The build takes one to two minutes. When it finishes, tap the preview
screenshot or **Visit** to open your live app at
`https://mathmind-something.vercel.app`.

Try `2x + 5 = 15`, then ask *"why did you subtract 5?"* to see the memory work.

Add it to your home screen (Share → Add to Home Screen) and it behaves like an
app.

---

## If the build fails

Open the deployment in Vercel and read the log.

- **"GROQ_API_KEY is not set"** — the app built fine, you just missed step
  6. Add it under Settings → Environment Variables, then Deployments → ⋯ →
  **Redeploy**.
- **A TypeScript error** — the message names the file and line. Tap the file in
  GitHub, use the pencil icon to edit, commit, and Vercel rebuilds
  automatically. Send me the error and I will give you the exact fix.
- **A missing dependency** — same thing: send me the message.

Every commit you make on GitHub triggers a fresh deploy, so fixing things from
your phone is just: edit file → commit → wait.

---

## If the app loads but answers fail

Open `https://your-app.vercel.app/api/diag` in the browser. It runs the whole
pipeline server-side and names the broken step: missing key, rejected key, a
model ID Groq has retired, or a model that cannot call tools. It never prints
your key.

It also lists every model your key can use right now. If `GROQ_MODEL` is set to
something no longer on that list, Groq retired it — set the variable to one of
the listed IDs and redeploy, or delete the variable to fall back to the default.

The simplest working setup is **no `GROQ_MODEL` variable at all**: the app
defaults to `openai/gpt-oss-120b`, which supports the tool calling the math
engine depends on.

---

## Changing settings later

Vercel → your project → **Settings** → **Environment Variables**. Anything from
`.env.example` can be set here, for example:

| Name | Effect |
| --- | --- |
| `GROQ_MODEL` | Which model answers (default `openai/gpt-oss-120b`) |
| `RATE_LIMIT_PER_MINUTE` | Requests allowed per minute per user |
| `RATE_LIMIT_PER_DAY` | Requests allowed per day per user |

Change one, then **Redeploy** for it to take effect.

---

## A note on cost

Every question sends a request to Groq and is billed to your key. The
built-in rate limits (20/minute, 500/day per visitor) are there to stop a
runaway bill if you share the link. If you plan to give the URL to other
people, lower `RATE_LIMIT_PER_DAY` first, and consider keeping the deployment
private in Vercel's settings.
