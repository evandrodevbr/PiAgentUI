import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LOCALES_DIR = dirname(fileURLToPath(import.meta.url))
const BASE_LOCALE = 'en'
const EXPECTED_LOCALES = ['en', 'zh-CN', 'pt-BR', 'es', 'hi', 'ar', 'bn'] as const

function readLocaleFile(locale: string, namespace: string): unknown {
  return JSON.parse(readFileSync(join(LOCALES_DIR, locale, namespace), 'utf8'))
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]

  return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key))
}

describe('locale resources', () => {
  const namespaces = readdirSync(join(LOCALES_DIR, BASE_LOCALE))
    .filter(file => file.endsWith('.json'))
    .sort()

  it('includes the supported UI locales', () => {
    const locales = readdirSync(LOCALES_DIR)
      .filter(entry => !entry.endsWith('.ts'))
      .sort()

    expect(locales).toEqual([...EXPECTED_LOCALES].sort())
  })

  it('keeps namespace files and keys aligned with English', () => {
    for (const locale of EXPECTED_LOCALES) {
      const localeNamespaces = readdirSync(join(LOCALES_DIR, locale))
        .filter(file => file.endsWith('.json'))
        .sort()

      expect(localeNamespaces).toEqual(namespaces)

      for (const namespace of namespaces) {
        expect(flattenKeys(readLocaleFile(locale, namespace)).sort()).toEqual(
          flattenKeys(readLocaleFile(BASE_LOCALE, namespace)).sort(),
        )
      }
    }
  })
})
