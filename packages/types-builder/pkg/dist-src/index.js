import importFrom from 'import-from';
import importGlobal from 'import-global';
import os from 'os';
import path from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';
import execa from 'execa';
export const name = 'types';

function getPikaGlobalPrefix() {
  if (process.env.PREFIX) {
    return process.env.PREFIX;
  }

  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const prefix = path.join(process.env.LOCALAPPDATA, 'Pika');

    if (fs.existsSync(prefix)) {
      return prefix;
    }
  }

  const configPrefix = path.join(os.homedir(), '.config/pika');

  if (fs.existsSync(configPrefix)) {
    return configPrefix;
  }

  const homePrefix = path.join(os.homedir(), '.pika-config');

  if (fs.existsSync(homePrefix)) {
    return homePrefix;
  }

  return null;
}

function getPikaGlobalDir() {
  const pikaPrefix = getPikaGlobalPrefix();

  if (!pikaPrefix) {
    return pikaPrefix;
  }

  return path.join(path.resolve(pikaPrefix), process.platform === 'win32' ? 'config/global/node_modules' : 'global/node_modules');
}

export function manifest(manifest) {
  manifest.types = manifest.types || 'dist-types/index.d.ts';
}
export async function build({
  cwd,
  out,
  reporter,
  isFull,
  manifest
}) {
  const tscBin = path.join(cwd, 'node_modules/.bin/tsc');
  const writeToTypings = path.join(out, 'dist-types/index.d.ts');
  const importAsNode = path.join(out, 'dist-node', 'index.js');

  if (fs.existsSync(path.join(cwd, 'index.d.ts'))) {
    mkdirp.sync(path.dirname(writeToTypings));
    fs.copyFileSync(path.join(cwd, 'index.d.ts'), writeToTypings);
    return;
  }

  if (fs.existsSync(path.join(cwd, 'src', 'index.d.ts'))) {
    mkdirp.sync(path.dirname(writeToTypings));
    fs.copyFileSync(path.join(cwd, 'src', 'index.d.ts'), writeToTypings);
    return;
  }

  if (fs.existsSync(tscBin) && fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
    await execa(tscBin, ['-d', '--emitDeclarationOnly', '--declarationMap', 'false', '--declarationDir', path.join(out, 'dist-types/')], {
      cwd
    });
    return;
  }

  const dtTypesDependency = path.join(cwd, 'node_modules', '@types', manifest.name);
  const dtTypesExist = fs.existsSync(dtTypesDependency);

  if (dtTypesExist) {
    fs.copyFileSync(dtTypesDependency, writeToTypings);
    return;
  } // log: we're auto-generating types now
  // TODO: check for and import from globally


  const globalPackageDir = getPikaGlobalDir();
  const tsc = importFrom.silent(cwd, 'typescript') || globalPackageDir && importFrom.silent(globalPackageDir, 'typescript') || importGlobal.silent('typescript');

  if (tsc && tsc.generateTypesForModule) {
    const nodeImport = await import(importAsNode);
    const guessedTypes = tsc.generateTypesForModule('AutoGeneratedTypings', nodeImport, {});
    mkdirp.sync(path.dirname(writeToTypings));
    fs.writeFileSync(writeToTypings, guessedTypes);
    return;
  }

  console.error(`
⚠️  dist-types/: Attempted to generate type definitions, but "typescript" package was not found.
                Please install either locally or globally and try again.
       $ pika add --dev typescript
[alt.] $ pika global add typescript
[alt.] *   Write your own type definition file to "index.d.ts"
`);
  throw new Error(`Failed to build: dist-types/`);
}