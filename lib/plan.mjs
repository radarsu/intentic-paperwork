/* WHICH TOOL CONVERTS WHAT — the decision half of the CLI, kept pure so it can be tested without any of the
 * binaries being installed. The bin script is then only argument parsing, file checks and spawning. */

import { basename, dirname, extname, join } from "node:path";

export const DOCUMENT_FORMATS = new Set([`docx`, `odt`, `epub`, `html`, `htm`, `md`, `markdown`, `rst`, `tex`, `txt`, `rtf`]);
export const IMAGE_FORMATS = new Set([`jpg`, `jpeg`, `png`, `tif`, `tiff`]);

export const extensionOf = (path) => extname(path).replace(/^\./, ``).toLowerCase();

/* What the person almost certainly meant when they didn't say. A PDF is the thing you can't edit, so
 * converting one is nearly always "get the words out"; everything else is nearly always "make the finished
 * document". Guessing here is safe because the guess is printed and the output path is shown. */
export const defaultTarget = (input) => (extensionOf(input) === `pdf` ? `md` : `pdf`);

export const outputPathFor = (input, target, out) => {
    if (out !== undefined) {
        return out;
    }
    const name = basename(input, extname(input));
    return join(dirname(input), `${name}.${target === `text` ? `txt` : target}`);
};

/* The pipeline for one conversion: a list of steps, each a command and its arguments, plus the one-line note
 * the CLI prints so the person can see what it is about to run. An unsupported pair returns `error` rather
 * than a best-effort guess — pandoc failing three seconds later with its own vocabulary helps nobody. */
export const planFor = ({ input, target, output, pages }) => {
    const from = extensionOf(input);
    const to = target === `text` ? `txt` : target;

    if (from === `pdf`) {
        if (to === `txt` || to === `md`) {
            // -layout keeps columns and tables roughly where they were, which is the difference between a
            // readable statement and a stream of numbers.
            const args = [`-layout`];
            if (pages !== undefined) {
                args.push(`-f`, String(pages.first), `-l`, String(pages.last));
            }
            return {
                steps: [{ command: `pdftotext`, args: [...args, input, output] }],
                note: `pdftotext -layout${pages === undefined ? `` : ` (pages ${pages.first}–${pages.last})`}`,
            };
        }
        return { error: `converting a PDF to .${to} isn't something this pack does — try "paperwork read" for the text, or "paperwork ocr" for a scan.` };
    }

    if (IMAGE_FORMATS.has(from)) {
        if (to !== `pdf`) {
            return { error: `an image can only be converted to PDF here; for anything else, ask the agent to use an image tool.` };
        }
        return { steps: [{ command: `img2pdf`, args: [`--output`, output, input] }], note: `img2pdf (lossless — the photo is embedded, not re-encoded)` };
    }

    if (!DOCUMENT_FORMATS.has(from)) {
        return { error: `.${from || `(no extension)`} isn't a format this pack converts.` };
    }

    if (to === `pdf`) {
        // pandoc has no PDF writer of its own; it renders HTML and hands it to an engine. weasyprint is the
        // one in this pack's image layer.
        return { steps: [{ command: `pandoc`, args: [input, `--pdf-engine=weasyprint`, `-o`, output] }], note: `pandoc → weasyprint` };
    }
    return { steps: [{ command: `pandoc`, args: [input, `-o`, output] }], note: `pandoc` };
};

// "3" → pages 3–3; "2-5" → 2–5. Anything else is undefined, which the CLI reports rather than silently
// converting the whole document.
export const parsePages = (value) => {
    if (value === undefined) {
        return undefined;
    }
    const single = /^(\d+)$/.exec(value);
    if (single !== null) {
        return { first: Number(single[1]), last: Number(single[1]) };
    }
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(value);
    if (range === null || Number(range[1]) > Number(range[2])) {
        return undefined;
    }
    return { first: Number(range[1]), last: Number(range[2]) };
};

/* Every binary this pack drives, and which subcommand needs it — so a missing tool can be named before
 * anything runs, with advice that depends on WHY it is missing (see the CLI's `explainMissing`). */
export const TOOLS = {
    convert: [`pandoc`, `img2pdf`, `pdftotext`],
    read: [`pdftotext`],
    ocr: [`pdftoppm`, `tesseract`],
    merge: [`pdfunite`],
    split: [`pdfseparate`],
    info: [`pdfinfo`],
};
