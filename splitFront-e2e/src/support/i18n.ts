import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { workspaceRoot } from '@nx/devkit';

type Translations = { [key: string]: string | Translations };

const en: Translations = JSON.parse(
  readFileSync(join(workspaceRoot, 'splitFront/src/assets/i18n/en.json'), 'utf8'),
);

/**
 * Testo inglese di una chiave i18n, con i parametri `{{name}}` sostituiti.
 * I test cercano gli elementi per chiave, non per testo copiato: se cambia il
 * testo in en.json i test continuano a passare, se sparisce la chiave falliscono.
 */
export function t(key: string, params: Record<string, string | number> = {}): string {
  let node: string | Translations | undefined = en;
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  if (typeof node !== 'string') {
    throw new Error(`Chiave i18n mancante in en.json: ${key}`);
  }
  return node.replace(/{{\s*(\w+)\s*}}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
