# Real testing

## What this kind of test is

A test in Vitest's `real` project, as [the project table](testing-conventions.md#which-project-a-test-belongs-in) in testing conventions describes it: one that runs real programs or touches the file system, in Node. Its file is `<module>.real.test.ts`, beside the module it covers.

## How the conventions apply

[Testing conventions](testing-conventions.md) apply as written, with these for the `real` project's tests:

- **Make assertions specific,** as [testing conventions](testing-conventions.md#what-a-test-checks) says. For a test that runs a program, the whole output or the exact file it writes:

  ```ts
  // ✅ Specific: the file the program wrote, in full
  expect(await readFile(path.join(dir, 'out.txt'), 'utf8')).toBe('done\n');

  // ❌ Vague: the program exited
  expect(result.exitCode).toBe(0);
  ```

- **It stays offline,** as [Tests stay offline](testing-conventions.md#tests-stay-offline) says: it runs local programs and temporary files only, in a temporary directory it cleans up. `scripts/prepare-sandbox.real.test.ts` runs the setup script there with fakes of `npm`, Playwright's CLI, `ldd` and `sudo`.

## Rules of its own

### When to write one

When a test must run a real program or touch the file system, as [the project table](testing-conventions.md#which-project-a-test-belongs-in) says; otherwise the test belongs in another project.

### Writing one

[Replacing external dependencies](testing-conventions.md#replacing-external-dependencies) in testing conventions applies as written.

### When one fails

[Fixing a bug](testing-conventions.md#fixing-a-bug) in testing conventions applies as written.

## Changing this document

The reasons for these rules are in [real-testing.meta.md](real-testing.meta.md). Read it only when changing or questioning a rule here.
