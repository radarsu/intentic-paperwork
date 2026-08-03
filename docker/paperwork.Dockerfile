# intentic.paperwork — the document tools this extension's CLI and skill drive.
#
# Composed by the daemon into the sandbox's overlay image when this extension is installed, then approved by
# the owner and applied by a rebuild. Extension fragments are RUN/ENV only: the daemon owns the base pin and
# refuses a FROM here, along with the privileged runtime directives that stay daemon-owned. (That refusal reads
# COMMENTS too — naming the directive even in a line like this one is enough to have the fragment skipped, so
# this file describes the rule without spelling it.)
#
# The base is node:24-bookworm-slim, so this is apt. Roughly 250 MB installed, most of it weasyprint's Python
# and font stack — the honest cost of turning HTML into a PDF that looks like a document.
#
# pandoc          convert between docx / odt / epub / html / markdown / rst / latex
# weasyprint      the PDF engine pandoc hands HTML to
# poppler-utils   pdftotext, pdftoppm, pdfinfo, pdfunite, pdfseparate — reading and rearranging PDFs
# tesseract-ocr   text out of scans and photographs of documents (English data; see the skill for more)
# img2pdf         photographs of receipts into one PDF, losslessly
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        pandoc \
        weasyprint \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-eng \
        img2pdf \
    && rm -rf /var/lib/apt/lists/*

# The marker the CLI reads to tell "this image was rebuilt with the layer, but the tool is missing" from
# "the image has not been rebuilt yet" — two situations with completely different advice for the owner.
ENV PAPERWORK_LAYER=1
