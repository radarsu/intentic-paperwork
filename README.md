# Paperwork

Document tools for the agent that lives in your sandbox: read a PDF, get the text out of a scan, turn a `.docx`
into a PDF (or the other way round), merge a year of statements, split a bundle into pages.

This is an [intentic](https://intentic.dev) extension with **no user interface at all**. It contributes three
things and every one of them is for the agent:

| Contribution | What it adds |
| --- | --- |
| `environment` | An image layer with pandoc, weasyprint, poppler-utils, tesseract and img2pdf |
| `bin` | The `paperwork` CLI, on the agent's PATH every turn |
| `agent` | A skill that teaches the agent when to reach for it — and when the answer is OCR, not text extraction |

So you don't run any of this. You say *"pull the totals out of these six statements"* or *"turn my notes into a
PDF I can send"*, and the agent has the tools and knows the difference.

## It needs a rebuild before it does anything

An extension can add tools to the sandbox image, but it cannot rebuild the image. Installing this puts a
proposal in front of you — **Sandbox → Environment** — and until you approve it and rebuild, every command
reports exactly that, in those words. `paperwork tools` lists what is and isn't there.

The layer is about 250 MB installed, most of it weasyprint's Python and font stack, which is what it costs to
turn HTML into a PDF that looks like a document.

## What the CLI does that calling pandoc directly doesn't

```sh
paperwork info statement.pdf      # …including whether it HAS A TEXT LAYER
paperwork read statement.pdf      # exact text, columns preserved
paperwork ocr receipt.jpg         # a photo of a receipt → text
paperwork convert notes.md        # → notes.pdf
paperwork convert invoice.pdf     # → invoice.md
paperwork merge year.pdf jan.pdf feb.pdf
paperwork split bundle.pdf --out-dir pages/
```

- **It picks the pipeline.** PDF → text is poppler; `.docx` → PDF is pandoc plus an engine; a photograph → PDF
  is `img2pdf` (lossless — the picture is embedded, not re-encoded).
- **It refuses the conversions that produce plausible garbage** rather than attempting them. PDF → `.docx` is
  the one everybody asks for and the one whose output looks right and is unusable.
- **It never overwrites without `--force`.**
- **It tells the difference between a PDF with text in it and a scan**, which is the single most common way an
  agent wastes a minute and then confidently reports nonsense.
- **A missing binary explains the rebuild**, not `ENOENT`. An agent that reads "spawn pandoc ENOENT" tries to
  `apt-get` it, which fails, and would be lost on the next container recreate anyway.

## Adding an OCR language

Only English recognition data is installed. Another language is a one-line edit to
`docker/paperwork.Dockerfile` (`tesseract-ocr-deu`, `tesseract-ocr-fra`, …) — then re-approve the environment
and rebuild. It cannot be done at runtime, because an apt install inside the container does not survive it
being recreated.

## Build it yourself

There is nothing to build. The CLI is dependency-free Node — an extension is installed by cloning a repo at a
commit, with no install step, so a `node_modules` would have to be committed.

```sh
pnpm test    # the planner, the CLI's behaviour, and the manifest + fragment rules
```

The fragment test is worth knowing about: it reimplements the daemon's `invalidExtensionFragment` rule and runs
it over this pack's own Dockerfile, so a fragment the daemon would refuse fails here instead of at install time
on somebody else's machine. It has already earned its place — the daemon's check greps **comments** for
privileged runtime directives, so a comment merely *describing* the rule was enough to have the whole layer
skipped.

MIT licensed. No warranty, and nobody has audited it but its author.
