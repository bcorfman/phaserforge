import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const storybookTestExclude = ['tests/storybook/**/*.test.ts', 'tests/storybook/**/*.test.tsx'];

const JSDOM_PRAGMA = '@vitest-environment jsdom';
const TEST_FILE_PATTERN = /\.test\.tsx?$/;
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.join(ROOT_DIR, 'tests');

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

export function findJsdomTaggedTests(testsDir = TESTS_DIR): string[] {
  return walk(testsDir)
    .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes(JSDOM_PRAGMA))
    .map((filePath) => path.relative(ROOT_DIR, filePath).replaceAll(path.sep, '/'))
    .sort();
}

export function findAllTestFiles(testsDir = TESTS_DIR): string[] {
  return walk(testsDir)
    .map((filePath) => path.relative(ROOT_DIR, filePath).replaceAll(path.sep, '/'))
    .sort();
}

export const allTestFiles = findAllTestFiles();
export const jsdomTaggedTests = findJsdomTaggedTests();
export const nonJsdomTaggedTests = allTestFiles.filter((filePath) => !jsdomTaggedTests.includes(filePath));
