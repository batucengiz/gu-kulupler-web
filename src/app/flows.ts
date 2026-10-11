/* Bileşik akışlar (prototip actions.js `flows`): yönetim paneline giriş ve bildirimden hedefe gitme. */
import { app, handleError } from './app';
import { sel } from './sel';
import { session } from './session';
import * as A from './actions';
import type { AppNotification } from '../data/models';

export function openManage(clubId?: string | null) {
  if (clubId) { app.nav.push('MGT-01', { clubId }); return; }
  const managed = sel.managedClubs(session.s.uid);
  if (managed.length > 1) app.openSheet('SHT-18');
  else if (managed.length === 1) app.nav.push('MGT-01', { clubId: managed[0].clubId });
}

export function openNotification(n: AppNotification) {
  if (!n.read) A.markRead(n, true).catch(handleError);
  const r = n.refs || {}; const nav = app.nav; const u = session.s.uid;
  switch (n.type) {
    case 'application_received':
      nav.openInTab('clubs', [{ screen: 'MGT-01', params: { clubId: r.clubId } }, { screen: 'MGT-02', params: { clubId: r.clubId } }]);
      if (r.applicantId) setTimeout(() => app.openSheet('SHT-19', { clubId: r.clubId, userId: r.applicantId }), 250);
      break;
    case 'application_approved': case 'role_changed':
      nav.openInTab('clubs', [{ screen: 'CLB-03', params: { id: r.clubId } }]); break;
    case 'application_rejected': case 'removed_from_club':
      nav.openInTab('clubs', [{ screen: 'CLB-03', params: { id: r.clubId } }, { screen: 'CLB-05', params: { id: r.clubId } }]); break;
    case 'announcement':
      if (!r.postId) { nav.openInTab('clubs', [{ screen: 'SYS-04', params: {} }]); break; }
      nav.openInTab('clubs', [{ screen: 'CLB-03', params: { id: r.clubId, tab: 'posts' } }, { screen: 'FED-02', params: { clubId: r.clubId, postId: r.postId } }]); break;
    case 'event_new':
      if (!r.eventId) { nav.openInTab('events', [{ screen: 'SYS-04', params: {} }]); break; }
      nav.openInTab('events', [{ screen: 'EVT-02', params: { id: r.eventId } }]); break;
    case 'event_cancelled':
      nav.openInTab('events', [{ screen: 'EVT-02', params: { id: r.eventId, showCancelled: true } }]); break;
    case 'event_reminder': case 'waitlist_promoted':
      if (r.eventId && sel.myRsvp(r.eventId, u)) nav.openInTab('events', [{ screen: 'EVT-02', params: { id: r.eventId } }, { screen: 'EVT-03', params: { id: r.eventId } }]);
      else nav.openInTab('events', [{ screen: 'EVT-02', params: { id: r.eventId } }]);
      break;
    case 'report_resolved': app.toast('TST-17'); break;
    case 'new_report':
      if (!session.s.isSuper) { app.toast('TST-X18'); break; }
      nav.openInTab('admin', [{ screen: 'ADM-04', params: { reportId: r.reportId } }]);
      if (r.reportId) setTimeout(() => app.openSheet('SHT-26', { reportId: r.reportId }), 250);
      break;
    default: nav.openInTab('profile', [{ screen: 'SET-01', params: {} }, { screen: 'SET-04', params: {} }]);
  }
}
