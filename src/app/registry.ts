/* Ekran / sheet / dialog / menü / toast kayıtları — prototipteki GU.SCREENS vb. */
import type { ComponentType } from 'react';
import type { Tab } from '../lib/constants';
export interface ScreenDef { tab?: Tab | null; title?: string; comp: ComponentType<any> }
export interface LayerDef { comp: ComponentType<any> }
export interface ToastDef { kind: 'success' | 'error' | 'info'; text: (p: any) => string; actionLabel?: (p: any) => string | null }
export const SCREENS: Record<string, ScreenDef> = {};
export const SHEETS: Record<string, LayerDef> = {};
export const DIALOGS: Record<string, LayerDef> = {};
export const MENUS: Record<string, ComponentType<any>> = {};
export const TOASTS: Record<string, ToastDef> = {};
