import type { CSSProperties } from 'react';
/** Prototipteki string ya da nesne stilini React stil nesnesine çevirir. */
export function sx(s: unknown): CSSProperties | undefined {
  if (!s) return undefined;
  if (typeof s !== 'string') return s as CSSProperties;
  const out: Record<string, string> = {};
  for (const decl of s.split(';')) {
    const i = decl.indexOf(':'); if (i < 0) continue;
    const k = decl.slice(0, i).trim(); const v = decl.slice(i + 1).trim(); if (!k) continue;
    out[k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out as CSSProperties;
}
