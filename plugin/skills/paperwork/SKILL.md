---
name: paperwork
description: Convert, read, OCR, merge and split documents (PDF, docx, odt, epub, scans, photographed receipts) using the `paperwork` CLI on your PATH. Use whenever the user asks you to read a PDF or a scan, turn one document format into another, get text out of a photograph of a document, or combine and split PDFs.
---

# Paperwork

This sandbox has the `paperwork` CLI on your PATH, backed by an image layer this extension ships (pandoc,
weasyprint, poppler-utils, tesseract, img2pdf). Reach for it before writing a script or a Python one-liner:
these are the file types where a wrong tool produces plausible-looking garbage rather than an error.

```sh
paperwork tools                              # what's installed; run this first if anything fails
paperwork info statement.pdf                 # pages, size, and whether it HAS A TEXT LAYER
paperwork read statement.pdf                 # the text, columns roughly preserved (stdout)
paperwork read report.pdf --pages 2-5
paperwork ocr receipt.jpg                    # a photo or a scan → text, via OCR
paperwork ocr scanned-contract.pdf --lang eng
paperwork convert notes.md                   # → notes.pdf (the default for anything but a PDF)
paperwork convert minutes.docx --to md       # → minutes.md
paperwork convert invoice.pdf                # → invoice.md (the default for a PDF: get the words out)
paperwork convert receipt.jpg --to pdf       # photograph → PDF, losslessly
paperwork merge year.pdf jan.pdf feb.pdf
paperwork split bundle.pdf --out-dir pages/
```

## Reading a PDF: check first, then pick

`read` and `ocr` are not interchangeable and choosing wrong wastes a minute and produces nonsense.

1. `paperwork info file.pdf` prints **Text layer: yes/no**.
2. **Yes** → `paperwork read`: exact text, instant, no guessing.
3. **No** → it is a scan or a photograph. `paperwork ocr`: slower (it rasterises every page at 200 dpi and
   recognises each one) and imperfect. Never present OCR output as exact: figures, punctuation and columns are
   where it fails, so if a number matters, say it came from OCR and offer the page image.

`read` refuses rather than printing nothing when there is no text layer, and tells you to use `ocr`.

## Converting

- The **default target** is PDF for anything except a PDF, and Markdown for a PDF. Say `--to` when you mean
  something else.
- Output lands beside the input with the extension swapped; `--out` puts it elsewhere. Existing files are
  **never** overwritten without `--force`: if the user asked you to replace one, pass it deliberately.
- The command prints the output path on stdout and the pipeline it used on stderr, so you can quote both.
- Not everything is convertible: PDF → docx is not offered here, because the result of trying is a
  document that looks right and is unusable. Extract the text instead and say so.

## Other languages for OCR

Only English data is installed. If the user needs another language, the fix is a one-line edit to this
extension's own image fragment (`docker/paperwork.Dockerfile`: add `tesseract-ocr-deu`, `tesseract-ocr-fra`,
…), which the owner then approves and rebuilds. Tell them that rather than trying to install it at runtime: an
apt install inside the container is lost the moment it is recreated.

## When nothing works

If every command reports a missing tool, the image layer hasn't been applied. The owner has to approve it in
**Sandbox → Environment** and rebuild: you cannot do it for them, and there is no runtime workaround.
