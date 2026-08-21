import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/* The CLI as a program, run the way the agent will run it. What is worth testing here is not the conversions
 * (those are pandoc's and poppler's job) but the behaviour around them: refusing clearly, never silently
 * overwriting, and above all explaining a missing binary in terms of the rebuild the owner has to approve. */

const run = promisify(execFile);
const CLI = fileURLToPath(new URL(`../bin/paperwork`, import.meta.url));

const paperwork = async (args, env = {}) => {
    try {
        const { stdout, stderr } = await run(process.execPath, [CLI, ...args], { env: { ...process.env, ...env } });
        return { code: 0, stdout, stderr };
    } catch (error) {
        return { code: error.code ?? 1, stdout: error.stdout ?? ``, stderr: error.stderr ?? `` };
    }
};

test(`--help lists every subcommand and exits cleanly`, async () => {
    const { code, stdout } = await paperwork([`--help`]);
    assert.equal(code, 0);
    for (const command of [`convert`, `read`, `ocr`, `merge`, `split`, `info`, `tools`]) {
        assert.match(stdout, new RegExp(`paperwork ${command}`));
    }
});

test(`an unknown command exits 2 with the usage, not a stack trace`, async () => {
    const { code, stderr } = await paperwork([`frobnicate`]);
    assert.equal(code, 2);
    assert.match(stderr, /unknown command "frobnicate"/);
    assert.doesNotMatch(stderr, /at Object|node:internal/);
});

test(`a missing file is named, and never reaches a tool`, async () => {
    const { code, stderr } = await paperwork([`read`, `/nope/missing.pdf`]);
    assert.equal(code, 1);
    assert.match(stderr, /no such file/);
});

/* The most important message this pack has. With no PAPERWORK_LAYER in the environment the image simply
 * hasn't been rebuilt with the fragment yet, and the fix is a specific thing the OWNER does: an agent that
 * reads "spawn pandoc ENOENT" will go and try to apt-get it, which fails and would be lost anyway. */
test(`a missing tool explains the rebuild rather than reporting ENOENT`, async () => {
    const directory = await mkdtemp(join(tmpdir(), `paperwork-`));
    const document = join(directory, `notes.md`);
    await writeFile(document, `# hello\n`);

    const { code, stderr } = await paperwork([`convert`, document], { PATH: `/nonexistent`, PAPERWORK_LAYER: `` });
    assert.equal(code, 1);
    assert.match(stderr, /isn't in this sandbox yet/);
    assert.match(stderr, /Sandbox → Environment/);
    assert.doesNotMatch(stderr, /ENOENT/);
});

test(`with the layer present, a missing tool says the layer changed instead`, async () => {
    const directory = await mkdtemp(join(tmpdir(), `paperwork-`));
    const document = join(directory, `notes.md`);
    await writeFile(document, `# hello\n`);

    const { stderr } = await paperwork([`convert`, document], { PATH: `/nonexistent`, PAPERWORK_LAYER: `1` });
    assert.match(stderr, /even though this image was built with the paperwork layer/);
});

test(`an existing output is not replaced unless asked`, async () => {
    const directory = await mkdtemp(join(tmpdir(), `paperwork-`));
    const document = join(directory, `notes.md`);
    const output = join(directory, `notes.pdf`);
    await writeFile(document, `# hello\n`);
    await writeFile(output, `not really a pdf`);

    const { code, stderr } = await paperwork([`convert`, document], { PATH: `/nonexistent` });
    assert.equal(code, 1);
    assert.match(stderr, /already exists/);
    // The refusal comes BEFORE the missing-tool check: the file is at risk either way, so it is the first thing
    // to say.
    assert.doesNotMatch(stderr, /isn't in this sandbox yet/);
});

test(`a bad page range is rejected before anything runs`, async () => {
    const directory = await mkdtemp(join(tmpdir(), `paperwork-`));
    const document = join(directory, `notes.md`);
    await writeFile(document, `# hello\n`);

    const { code, stderr } = await paperwork([`convert`, document, `--pages`, `nine`], { PATH: `/nonexistent` });
    assert.equal(code, 2);
    assert.match(stderr, /--pages wants a page or a range/);
});

test(`tools reports what is missing and how to get it`, async () => {
    const { code, stdout } = await paperwork([`tools`], { PATH: `/nonexistent`, PAPERWORK_LAYER: `` });
    assert.equal(code, 0);
    assert.match(stdout, /missing {2}pandoc/);
    assert.match(stdout, /Sandbox → Environment/);
});
