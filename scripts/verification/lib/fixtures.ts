import { spawn } from 'node:child_process';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repo, tocFixtureDir } from './config.ts';

async function run(command: string, args: string[]): Promise<void> {
  const child = spawn(command, args, { cwd: repo, stdio: 'inherit' });
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (code !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${code}`);
}

export const rebuildShowcaseA = () =>
  run('pnpm', ['exec', 'turbo', 'run', 'build', '--force', '--filter=showcase-a...']);

/** Write temporary TOC edge-case documents into Showcase A; callers rebuild it and later call `restoreTocFixtures`. */
export async function createTocFixtures(): Promise<void> {
  const exists = await access(tocFixtureDir).then(
    () => true,
    () => false,
  );
  if (exists) throw new Error(`Refusing to overwrite existing fixture directory ${tocFixtureDir}`);
  await mkdir(tocFixtureDir, { recursive: true });
  const filler = Array.from(
    { length: 12 },
    (_, index) => `Verification paragraph ${index + 1}. ${'This sentence adds enough scrolling space. '.repeat(8)}\n\n`,
  ).join('');
  // M16 scrolls a heading into the scroll-spy band (the top 30% of the viewport), which needs roughly
  // 0.8 viewport of content BELOW that heading or the scroll clamps at the bottom of the page and the
  // heading never enters the band. Until 0.12 the static TOC block rendered after the content supplied
  // that tail; the TOC is now a sticky rail in its own grid column and adds no document height, so the
  // fixture carries its own tail. Height added before the headings does not help: it moves the heading's
  // offset and the document height by the same amount.
  const tail = Array.from(
    { length: 6 },
    (_, index) =>
      `Trailing paragraph ${index + 1}. ${'This sentence adds scrolling space below the headings. '.repeat(8)}\n\n`,
  ).join('');
  await writeFile(
    join(tocFixtureDir, 'toc-fixture.md'),
    `---\ntitle: Temporary TOC verification fixture\ndescription: Temporary acceptance fixture.\ngroup: Verification\norder: 999\n---\n\n## Repeated heading\n\nFirst occurrence.\n\n${filler}### Nested heading\n\nNested occurrence.\n\n## Repeated heading\n\nSecond occurrence.\n\n${tail}`,
  );
  await writeFile(
    join(tocFixtureDir, 'no-headings.md'),
    '---\ntitle: Temporary no-heading verification fixture\ndescription: Temporary acceptance fixture.\ngroup: Verification\norder: 1000\n---\n\nThis document intentionally has no headings.\n',
  );
}

export async function restoreTocFixtures(): Promise<void> {
  await rm(tocFixtureDir, { recursive: true, force: true });
  await rebuildShowcaseA();
}
