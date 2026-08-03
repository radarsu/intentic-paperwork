import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultTarget, outputPathFor, parsePages, planFor } from "../lib/plan.mjs";

/* The planner: which binary runs for which pair of formats, and what the output is called. Pure, so none of
 * the tools have to be installed to test the part that decides between them. */

test(`a PDF defaults to getting the words out; everything else defaults to a finished PDF`, () => {
    assert.equal(defaultTarget(`statement.pdf`), `md`);
    assert.equal(defaultTarget(`notes.md`), `pdf`);
    assert.equal(defaultTarget(`minutes.DOCX`), `pdf`);
});

test(`the output lands beside the input with the extension swapped`, () => {
    assert.equal(outputPathFor(`bills/march.docx`, `pdf`, undefined), `bills/march.pdf`);
    assert.equal(outputPathFor(`bills/march.docx`, `pdf`, `/tmp/out.pdf`), `/tmp/out.pdf`);
    // "text" is what a person says and ".txt" is what a file is called.
    assert.equal(outputPathFor(`scan.pdf`, `text`, undefined), `scan.txt`);
});

test(`a PDF's text goes through pdftotext, with -layout so columns survive`, () => {
    const plan = planFor({ input: `s.pdf`, target: `md`, output: `s.md` });
    assert.deepEqual(plan.steps, [{ command: `pdftotext`, args: [`-layout`, `s.pdf`, `s.md`] }]);

    const ranged = planFor({ input: `s.pdf`, target: `txt`, output: `s.txt`, pages: { first: 2, last: 5 } });
    assert.deepEqual(ranged.steps[0].args, [`-layout`, `-f`, `2`, `-l`, `5`, `s.pdf`, `s.txt`]);
});

test(`a document to PDF goes through pandoc and an engine, because pandoc has no PDF writer`, () => {
    const plan = planFor({ input: `notes.md`, target: `pdf`, output: `notes.pdf` });
    assert.deepEqual(plan.steps, [{ command: `pandoc`, args: [`notes.md`, `--pdf-engine=weasyprint`, `-o`, `notes.pdf`] }]);
    assert.match(plan.note, /weasyprint/);

    // Between two text formats there is no engine in the way.
    const markdown = planFor({ input: `minutes.docx`, target: `md`, output: `minutes.md` });
    assert.deepEqual(markdown.steps, [{ command: `pandoc`, args: [`minutes.docx`, `-o`, `minutes.md`] }]);
});

test(`a photograph becomes a PDF losslessly, and refuses anything else`, () => {
    const plan = planFor({ input: `receipt.JPG`, target: `pdf`, output: `receipt.pdf` });
    assert.equal(plan.steps[0].command, `img2pdf`);
    assert.match(planFor({ input: `receipt.jpg`, target: `md`, output: `x.md` }).error, /only be converted to PDF/);
});

test(`an unsupported pair is refused up front, with the alternative named`, () => {
    // The one people ask for most, and the one whose output looks right and is unusable.
    assert.match(planFor({ input: `contract.pdf`, target: `docx`, output: `contract.docx` }).error, /paperwork read/);
    assert.match(planFor({ input: `archive.zip`, target: `pdf`, output: `archive.pdf` }).error, /isn't a format/);
    assert.match(planFor({ input: `README`, target: `pdf`, output: `README.pdf` }).error, /no extension/);
});

test(`page ranges accept a page or a range and reject anything else`, () => {
    assert.deepEqual(parsePages(`3`), { first: 3, last: 3 });
    assert.deepEqual(parsePages(`2-5`), { first: 2, last: 5 });
    assert.equal(parsePages(`5-2`), undefined);
    assert.equal(parsePages(`last`), undefined);
    assert.equal(parsePages(undefined), undefined);
});
