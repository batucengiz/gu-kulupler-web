/* Lucide simge kaydı (ISC) — scripts/gen-icons.mjs ile üretilen düğümlerden SVG. */
import { createElement, type CSSProperties } from 'react';
import { ICONS, ICON_ALIASES } from './icon-data';
import { sx } from '../lib/sx';

const GENERIC: [string, Record<string, string | number>][] = [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 8v4' }], ['path', { d: 'M12 16h.01' }]];
const camel = (k: string) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
export const resolveIcon = (name: string) => ICON_ALIASES[name] || name;
export function Icon({ name, size = 24, stroke = 1.75, class: cls, className, style, color, label }: { name: string; size?: number; stroke?: number; class?: string; className?: string; style?: CSSProperties | string; color?: string; label?: string }) {
  const node = ICONS[resolveIcon(name)] || GENERIC;
  if (import.meta.env.DEV && !ICONS[resolveIcon(name)]) console.warn('[icon] eksik simge', name);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={cls || className} style={{ width: size, height: size, ...(sx(style) as any) }} aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      {node.map(([tag, attrs], i) => createElement(tag, { key: i, ...Object.fromEntries(Object.entries(attrs).map(([k, v]) => [camel(k), v])) }))}
    </svg>
  );
}
/** SVG işaretlemesi (QR kodu vb. dışa aktarım için). */
export function iconSVG(name: string, { size = 24, stroke = 1.75, color = 'currentColor' } = {}) {
  const node = ICONS[resolveIcon(name)] || GENERIC;
  const inner = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
