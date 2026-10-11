/* Uygulama kabuğu — prototip shell.js'teki Device/ScreenHost/BottomNav/Overlays/Toast'un web karşılığı.
   Mobil: tam ekran + alt gezinme. Masaüstü (≥1024px): sol menü + ortada uygulama sütunu. */
import { Component, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { app } from '../app/app';
import { nav, ui, uiState, forms, setExternalRouteHandler, setTitleFn, TAB_OF } from '../app/core';
import { db } from '../app/data';
import { session, setNotifText } from '../app/session';
import { prefs, systemTheme, network } from '../app/prefs';
import { userCache } from '../data/repo/users';
import { reminders } from '../app/reminders';
import { SCREENS, SHEETS, DIALOGS, MENUS, TOASTS } from '../app/registry';
import { TABS, TAB_ICONS, type Tab } from '../lib/constants';
import { cx } from '../lib/util';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { Banner } from '../ui/ui';
import { Logo, Avatar } from '../ui/art';
import { notifTitle, notifBody } from '../ui/cards';
import { openNotification } from '../app/flows';

const STORES: Array<{ subscribe: (fn: () => void) => () => void }> = [nav, ui, uiState, forms, db, session, prefs, systemTheme, network, userCache];

/** Tüm depolara abone olur; herhangi biri değişince ağacı yeniden çizer (prototip ile aynı model). */
function useStores() {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    let raf = 0;
    const on = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; bump(); }); };
    const offs = STORES.map((s) => s.subscribe(on));
    return () => { offs.forEach((f) => f()); cancelAnimationFrame(raf); };
  }, []);
}
function useDesktop() {
  const q = '(min-width: 1024px)';
  const [d, setD] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const f = () => setD(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return d;
}

const visibleTabs = (): Tab[] => TABS.filter((tb) => tb !== 'admin' || session.s.isSuper);

function BottomNav() {
  const unread = app.sel.unread();
  return (
    <nav className="bottomnav" aria-label={t('a11y.mainNav')}>
      {visibleTabs().map((tb) => (
        <button type="button" key={tb} aria-current={nav.activeTab === tb ? 'page' : undefined} data-action={'NAV.tab.' + tb} onClick={() => nav.switchTab(tb)}>
          <Icon name={TAB_ICONS[tb]} size={24} />
          <span>{t('nav.' + tb)}</span>
          {tb === 'notifications' && unread ? <span className="nav-badge">{unread > 9 ? '9+' : unread}</span> : null}
        </button>
      ))}
    </nav>
  );
}

function SideNav() {
  const unread = app.sel.unread();
  const me = session.s.user;
  const inApp = nav.mode === 'app';
  return (
    <nav className="sidemenu web-side" aria-label={t('a11y.mainNav')}>
      <div className="row gap10" style={{ padding: '4px 8px 16px' }}>
        <Logo size={32} />
        <span className="t-title-s" style={{ letterSpacing: '.03em' }}>{app.APP_NAME}</span>
      </div>
      {inApp
        ? visibleTabs().map((tb) => (
            <button type="button" key={tb} className="menu-item" aria-current={nav.activeTab === tb ? 'page' : undefined} data-action={'NAV.side.' + tb} onClick={() => nav.switchTab(tb)}>
              <Icon name={TAB_ICONS[tb]} size={18} />
              <span className="flex1">{t('nav.' + tb)}</span>
              {tb === 'notifications' && unread ? <span className="badge is-brand tnum" style={{ minWidth: 22, justifyContent: 'center' }}>{unread > 99 ? '99+' : unread}</span> : null}
            </button>
          ))
        : null}
      <div className="spacer" />
      {inApp && me ? (
        <button type="button" className="menu-item" style={{ minHeight: 56 }} onClick={() => nav.switchTab('profile')} data-action="NAV.side.me">
          <Avatar user={me} size={32} />
          <span className="col" style={{ minWidth: 0, alignItems: 'flex-start' }}>
            <span className="t-label-m c-heading ellipsis" style={{ maxWidth: 160 }}>{me.name}</span>
            <span className="t-caption ellipsis" style={{ maxWidth: 160 }}>{session.s.email}</span>
          </span>
        </button>
      ) : null}
      <p className="t-caption" style={{ padding: '8px' }}>{t('site.footer')}</p>
    </nav>
  );
}

/** Ekran çizerken oluşan beklenmedik hatada tüm uygulama çökmesin: SYS-05 benzeri kurtarma kartı. */
class ScreenBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error('[screen]', err); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="empty" role="alert" style={{ padding: 32 }}>
        <Icon name="triangle-alert" size={40} />
        <h2 className="t-title-s c-heading">{t('web.err.generic')}</h2>
        <div className="row gap10" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn is-secondary" onClick={() => { this.setState({ err: null }); nav.back(); }}>{t('common.back')}</button>
          <button type="button" className="btn is-primary" onClick={() => location.reload()}>{t('common.retry')}</button>
        </div>
      </div>
    );
  }
}

function ScreenHost({ hasNav }: { hasNav: boolean }) {
  const route = nav.current();
  const def = SCREENS[route.screen] || SCREENS['SYS-04'];
  const Comp = def ? def.comp : () => <div className="empty">{route.screen}</div>;
  return (
    <div className={cx('screen', 'anim-' + nav.anim, hasNav && 'has-nav')} key={route.key} data-screen={route.screen}>
      {!app.online() && nav.mode === 'app' ? <Banner kind="offline" text={t('sys.offline.banner')} /> : null}
      <ScreenBoundary><Comp params={route.params || {}} route={route} /></ScreenBoundary>
    </div>
  );
}

function Overlays({ hasNav }: { hasNav: boolean }) {
  const Viewer = SHEETS['SHT-34'];
  return (
    <>
      {ui.sheets.map((s) => {
        const def = SHEETS[s.id];
        if (!def) return null;
        return <def.comp key={s.key} props={s.props} close={() => ui.removeSheet(s)} />;
      })}
      {ui.menu
        ? (() => {
            const M = MENUS[ui.menu.id];
            return M ? <M key={ui.menu.key} props={ui.menu.props} close={() => ui.closeMenu()} /> : null;
          })()
        : null}
      {ui.dialogs.map((d) => {
        const def = DIALOGS[d.id];
        if (!def) return null;
        return <def.comp key={d.key} props={d.props} close={() => ui.removeDialog(d)} />;
      })}
      {ui.viewer && Viewer ? <Viewer.comp props={ui.viewer} close={() => ui.closeViewer()} /> : null}
      {ui.toast ? <Toast key={ui.toast.key} toast={ui.toast} aboveNav={hasNav} /> : null}
    </>
  );
}

function Toast({ toast, aboveNav }: { toast: { id: string; props: any }; aboveNav: boolean }) {
  const def = TOASTS[toast.id];
  if (!def) return null;
  const p = toast.props || {};
  const color = { success: 'var(--state-success)', error: 'var(--state-danger)', info: 'var(--state-info)' }[def.kind];
  const icon = { success: 'circle-check', error: 'triangle-alert', info: 'info' }[def.kind];
  const label = p.undo ? t('common.undo') : p.action && def.actionLabel ? def.actionLabel(p) : null;
  return (
    <div className={cx('toast-wrap', aboveNav && 'above-nav')}>
      <div className="toast" style={{ ['--toast-color' as any]: color }} role={def.kind === 'error' ? 'alert' : 'status'} aria-live="polite" data-toast={toast.id}>
        <Icon name={icon} size={18} class="toast-icon" />
        <span className="toast-text">{def.text(p)}</span>
        {label ? (
          <button type="button" className="toast-action" data-action={toast.id + (p.undo ? '.undo' : '.action')} onClick={() => { ui.hideToast(); (p.undo || p.action)?.(); }}>
            {label}
          </button>
        ) : null}
        <button type="button" className="iconbtn is-sm" style={{ color: 'inherit', width: '32px', height: '32px' }} aria-label={t('a11y.close')} data-action={toast.id + '.close'} onClick={() => ui.hideToast()}>
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
  );
}

let booted = false;
function boot() {
  if (booted) return; booted = true;
  setTitleFn((screen) => {
    const def = SCREENS[screen]; const name = app.APP_NAME;
    const title = def && def.title ? t(def.title) : '';
    return title && title !== def?.title ? `${title} · ${name}` : name;
  });
  setExternalRouteHandler((screen, params) => {
    // tarayıcı geri/ileri ile bilinmeyen bir adrese gelindi: oturuma uygunsa aç
    if (session.s.user && TAB_OF(screen)) nav.resetTo(screen, params);
  });
  setNotifText((n) => ({ title: notifTitle(n), body: notifBody(n) }));
  reminders.bind(() => ({ uid: session.s.uid, rsvps: session.s.rsvps, enabled: session.s.settings.eventReminders !== false }));
  // Uygulama içindeyken gelen yeni bildirim → TST-55 (bildirim kutusu dinleyicisi)
  let prev = new Set<string>(); let primed = false;
  session.subscribe(() => {
    if (!session.s.inboxLoaded) { prev = new Set(); primed = false; return; }
    const ids = session.s.inbox.map((n) => n.id);
    if (!primed) { prev = new Set(ids); primed = true; return; }
    const fresh = session.s.inbox.filter((n) => !prev.has(n.id) && !n.read);
    prev = new Set(ids);
    if (fresh.length && document.visibilityState === 'visible' && nav.mode === 'app' && !(nav.activeTab === 'notifications' && nav.depth() === 1)) {
      const n = fresh[0];
      ui.showToast('TST-55', { title: notifTitle(n), action: () => openNotification(n) });
    }
  });
  // çevrimiçi olunca TST-25
  let wasOnline = network.get().online;
  network.subscribe(() => { const on = network.get().online; if (on && !wasOnline) ui.showToast('TST-25'); wasOnline = on; });
  session.init();
}

export function Root() {
  useStores();
  const desktop = useDesktop();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { boot(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && ui.closeTop()) e.stopPropagation(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const theme = app.theme();
  const locale = app.locale();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0B0F17' : '#FFFFFF');
  }, [theme, locale]);
  const hasNav = !desktop && nav.mode === 'app' && nav.depth() === 1;
  const splash = nav.mode === 'splash';
  return (
    <div className={cx('gu-root web-shell', desktop && 'is-desktop')} data-theme={theme} lang={locale} style={{ ['--ts' as any]: app.textScale() }}>
      {desktop && !splash ? <SideNav /> : null}
      <main className="web-main">
        <div ref={ref} className="device is-fluid web-device">
          <ScreenHost hasNav={hasNav} />
          {hasNav ? <BottomNav /> : null}
          <Overlays hasNav={hasNav} />
        </div>
      </main>
    </div>
  );
}
