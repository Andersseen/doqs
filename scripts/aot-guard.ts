/**
 * Fails a verification run when a production build exited 0 but ships components that were not compiled ahead of time.
 * Such a build prerenders fine and then throws Angular's "JIT compiler unavailable" in the browser, so it must never be
 * mistaken for a working application. The scan is `doq doctor --build` (finding `build.aot`), run from the repository
 * sources, which are the same files the packed tarball ships.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const doq = resolve(import.meta.dirname, '../packages/doq/bin/doq.mjs');

export function assertAotBuild(label: string, projectDir: string, siteDir = 'dist/analog/public'): void {
  const result = spawnSync(process.execPath, [doq, 'doctor', '--build', '--site-dir', siteDir, '--json'], {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  let finding: { status: string; found: string } | undefined;
  try {
    finding = (
      JSON.parse(result.stdout) as { findings: { id: string; status: string; found: string }[] }
    ).findings.find((item) => item.id === 'build.aot');
  } catch {
    // Reported below: an unreadable report is not a pass.
  }
  if (!finding) throw new Error(`${label}: doq doctor produced no build.aot finding\n${result.stdout}${result.stderr}`);
  if (finding.status === 'FAIL')
    throw new Error(`${label}: the production build is not AOT-compiled (${finding.found}). Rebuild; see spec 0022.`);
  console.log(`${label}: build.aot ${finding.status} (${finding.found})`);
}
