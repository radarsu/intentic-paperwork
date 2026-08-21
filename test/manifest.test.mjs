import assert from "node:assert/strict";
import { access, constants, readFile } from "node:fs/promises";
import { test } from "node:test";

/* The manifest, and the one rule that decides whether this extension can be installed at all: the daemon
 * refuses an image fragment that is anything other than RUN/ENV. That check is `invalidExtensionFragment` in
 * the daemon (fragment-sources.ts) and it is reimplemented here: a copy of a rule is worth it when the
 * alternative is finding out at install time, on someone else's machine, that the fragment is rejected. */

const url = (path) => new URL(path, import.meta.url);
const manifest = JSON.parse(await readFile(url(`../intentic-extension.json`), `utf8`));

const invalidFragmentLine = (content) => {
    let continued = false;
    for (const raw of content.split(`\n`)) {
        const line = raw.trim();
        const wasContinued = continued;
        continued = line.endsWith(`\\`);
        if (line === `` || line.startsWith(`#`) || wasContinued) {
            if (line.includes(`intentic:runtime`)) {
                return raw;
            }
            continue;
        }
        if (!/^(run|env)\s/i.test(line) || line.includes(`intentic:runtime`)) {
            return raw;
        }
    }
    return undefined;
};

test(`the manifest declares the three contributions this pack is made of`, () => {
    assert.equal(manifest.publisher, `intentic`);
    assert.equal(manifest.name, `paperwork`);
    assert.deepEqual(Object.keys(manifest.contributes).sort(), [`agent`, `bin`, `environment`]);
    // No `entry`: this pack has no UI at all, which is what makes it agent-only.
    assert.equal(manifest.entry, undefined);
    // And no daemon reach: nothing here runs in the browser, so there is no route to declare.
    assert.equal(manifest.permissions, undefined);
});

test(`the image fragment is RUN/ENV only, so the daemon will accept it`, async () => {
    const fragment = await readFile(url(`../${manifest.contributes.environment.fragment}`), `utf8`);
    assert.equal(invalidFragmentLine(fragment), undefined);
    assert.match(fragment, /apt-get install/);
    // The marker the CLI reads to tell "not rebuilt yet" from "rebuilt, but the tool is gone".
    assert.match(fragment, /ENV PAPERWORK_LAYER=1/);
});

test(`the fragment check is real: it rejects what the daemon rejects`, () => {
    assert.ok(invalidFragmentLine(`FROM debian:bookworm\nRUN echo hi`) !== undefined);
    assert.ok(invalidFragmentLine(`COPY x /x`) !== undefined);
    // A privileged directive smuggled in a comment: the daemon greps for it, so this test has to as well.
    assert.ok(invalidFragmentLine(`# intentic:runtime --privileged`) !== undefined);
    // A continued RUN body is not an instruction line and must not be re-checked as one.
    assert.equal(invalidFragmentLine(`RUN apt-get update \\\n    && apt-get install -y pandoc`), undefined);
});

test(`the CLI the manifest puts on the agent's PATH is executable`, async () => {
    await access(url(`../${manifest.contributes.bin}/paperwork`), constants.X_OK);
});

test(`the agent plugin directory holds the skill the CLI is useless without`, async () => {
    const skill = await readFile(url(`../${manifest.contributes.agent.path}/skills/paperwork/SKILL.md`), `utf8`);
    assert.match(skill, /^---\nname: paperwork\ndescription: /);
    // The skill's job is to stop the agent guessing between the two PDF paths, so it must name both.
    assert.match(skill, /paperwork read/);
    assert.match(skill, /paperwork ocr/);
});

/* And that directory has to BE a plugin, not just contain a skills folder. The daemon hands the path to the
 * Agent SDK's loader without parsing it, and the loader recognises a plugin by its `.claude-plugin/plugin.json`
 *: so a directory without one is a contribution that installs clean, reports ready, and teaches the agent
 * nothing. There is no error anywhere in that path, which is exactly why it is asserted here. */
test(`the agent plugin directory is a plugin the SDK's loader will recognise`, async () => {
    const descriptor = JSON.parse(await readFile(url(`../${manifest.contributes.agent.path}/.claude-plugin/plugin.json`), `utf8`));
    assert.equal(descriptor.name, `paperwork`);
    // The description is what the agent reads when deciding whether this plugin is worth loading, so an empty
    // one is a plugin that ships its skill and never gets asked for it.
    assert.ok(descriptor.description.length > 0);
});
