/* Sabitler — packages/gu_data/lib/src/constants (Limits, StaticTables) ve tasarım registry.json ile birebir. */
export const APP_NAME = 'GÜ Kulüpler';
export const APP_VERSION = '1.0.0';
export const ALLOWED_EMAIL_DOMAINS = ['ogr.gumushane.edu.tr', 'gumushane.edu.tr'];

export const LIMITS = {
  passwordMinLength: 8,
  loginMaxFailedAttempts: 5,
  loginLockoutMs: 30_000,
  verificationResendCooldownMs: 60_000,
  batchMaxWrites: 450,
  nameMin: 2,
  nameMax: 60,
  clubNameMax: 60,
  interestsMin: 1,
  interestsMax: 5,
  bioMax: 140,
  adminReasonMax: 300,
  clubSummaryMax: 160,
  clubAboutMax: 1000,
  conditionsMax: 10,
  conditionTextMax: 120,
  foundedMin: 1900,
  instagramHandlePattern: /^@?[A-Za-z0-9._]{1,30}$/,
  applicationNoteMax: 300,
  rejectNoteMax: 200,
  reapplyCooldownMs: 7 * 864e5,
  managerUndoWindowMs: 30_000,
  clockSkewToleranceMs: 5 * 60_000,
  postTextMax: 1000,
  postTitleMax: 80,
  postImagesMax: 4,
  imageMaxBytes: 5 * 1024 * 1024,
  pollOptionsMin: 2,
  pollOptionsMax: 4,
  pollOptionTextMax: 60,
  pollDurationsDays: [1, 3, 7],
  commentMax: 500,
  commentCounterFrom: 400,
  eventTitleMax: 80,
  eventDescMax: 1000,
  placeTextMax: 120,
  eventCopyShiftMs: 7 * 864e5,
  attendanceWindowBeforeMs: 2 * 36e5,
  attendanceWindowAfterMs: 6 * 36e5,
  reportNoteMax: 300,
  supportMessageMax: 500,
  supportAttachmentsMax: 1,
  announcementDailyLimit: 2,
  recentSearchesMax: 6,
  searchDebounceMs: 250,
  pageSize: 20,
  clubsFetchMax: 50,
  upcomingEventsFetchMax: 200,
  notificationInboxLimit: 100,
  unreadBadgeMax: 9,
  notificationFanOutChunkSize: 225,
  eventNewInterestFanOutMax: 200,
  accountDeletionChunk: 5,
  undoToastMs: 6000,
  toastMs: 4000,
} as const;

export const CATEGORIES = [
  { id: 'k01', icon: 'cpu' }, { id: 'k02', icon: 'flask-conical' }, { id: 'k03', icon: 'mountain' }, { id: 'k04', icon: 'palette' },
  { id: 'k05', icon: 'heart-handshake' }, { id: 'k06', icon: 'briefcase' }, { id: 'k07', icon: 'gamepad-2' }, { id: 'k08', icon: 'newspaper' },
];
export const INTERESTS = [
  { id: 'i01', cat: 'k01' }, { id: 'i02', cat: 'k01' }, { id: 'i03', cat: 'k06' }, { id: 'i04', cat: 'k03' }, { id: 'i05', cat: 'k03' }, { id: 'i06', cat: 'k08' }, { id: 'i07', cat: 'k08' }, { id: 'i08', cat: 'k04' },
  { id: 'i09', cat: 'k04' }, { id: 'i10', cat: 'k04' }, { id: 'i11', cat: 'k07' }, { id: 'i12', cat: 'k07' }, { id: 'i13', cat: 'k05' }, { id: 'i14', cat: 'k04' }, { id: 'i15', cat: 'k01' }, { id: 'i16', cat: 'k06' },
];
export const interestIdsOf = (categoryId: string) => INTERESTS.filter((i) => i.cat === categoryId).map((i) => i.id);
export const FACULTIES = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'];
export const DEPARTMENTS = [
  ['d01', 'f1'], ['d02', 'f1'], ['d03', 'f1'], ['d04', 'f1'], ['d05', 'f1'], ['d06', 'f1'], ['d07', 'f1'], ['d08', 'f2'], ['d09', 'f2'], ['d10', 'f3'], ['d11', 'f3'], ['d12', 'f3'],
  ['d13', 'f3'], ['d14', 'f3'], ['d15', 'f3'], ['d16', 'f4'], ['d17', 'f4'], ['d18', 'f4'], ['d19', 'f5'], ['d20', 'f5'], ['d21', 'f6'], ['d22', 'f6'], ['d23', 'f6'], ['d24', 'f6'],
].map(([id, faculty]) => ({ id, faculty }));
export const YEARS = ['prep', '1', '2', '3', '4', '5plus', 'master', 'phd'];
export const PLACES = ['pl01', 'pl02', 'pl03', 'pl04', 'pl05', 'pl06', 'pl07', 'pl08', 'pl09', 'pl10'];
export const EVENT_TYPES = ['egitim', 'sosyal', 'gezi', 'yarisma', 'konferans'];
export const POPULAR_SEARCHES = ['Hackathon', 'Doğa yürüyüşü', 'Tiyatro', 'E-spor', 'Fotoğraf', 'Satranç'];
export const PALETTE_IDS = ['red', 'slate', 'bordeaux'] as const;
export const PATTERN_IDS = ['mountain', 'lines', 'dots', 'waves'] as const;
export const CLUB_ICONS = ['code-xml', 'flask-conical', 'mountain', 'drama', 'heart-handshake', 'briefcase', 'gamepad-2', 'music', 'rocket', 'lightbulb', 'book-open', 'pickaxe', 'puzzle', 'palette', 'trophy', 'landmark', 'newspaper', 'film', 'tent', 'users-round', 'cpu', 'dumbbell', 'camera'];
export const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'misinformation', 'offtopic', 'other'] as const;
export const REJECT_REASONS = ['quota', 'criteria', 'missing', 'other'] as const;
export const REMINDER_OPTIONS = ['none', '15m', '1h', '1d'] as const;
export const SUPPORT_SUBJECTS = ['bug', 'suggestion', 'account', 'club', 'other'] as const;

export const TABS = ['clubs', 'events', 'notifications', 'admin', 'profile'] as const;
export type Tab = (typeof TABS)[number];
export const TAB_ICONS: Record<Tab, string> = { clubs: 'users-round', events: 'calendar', notifications: 'bell', admin: 'shield-check', profile: 'user' };

/** Bildirim türü → settings anahtarı (force türleri yok sayar). */
export const TYPE_SETTING: Record<string, string> = {
  announcement: 'announcements', event_reminder: 'eventReminders', event_new: 'newEvents',
  application_approved: 'applicationResults', application_rejected: 'applicationResults',
  application_received: 'management', new_report: 'management', system: 'system',
};
export const FORCED_TYPES = new Set(['removed_from_club', 'role_changed', 'event_cancelled', 'waitlist_promoted', 'report_resolved']);
export const NOTIF_ICON: Record<string, [string, string]> = {
  application_received: ['user-plus', 'ni-brand'], application_approved: ['circle-check', 'ni-success'], application_rejected: ['circle-x', 'ni-danger'],
  removed_from_club: ['user-x', 'ni-danger'], role_changed: ['user-cog', 'ni-info'], announcement: ['megaphone', 'ni-brand'], event_new: ['calendar-plus', 'ni-info'],
  event_reminder: ['bell-ring', 'ni-warning'], event_cancelled: ['calendar-x', 'ni-danger'], waitlist_promoted: ['ticket', 'ni-success'],
  report_resolved: ['shield-check', 'ni-success'], new_report: ['flag', 'ni-warning'], system: ['info', 'ni-neutral'],
};
export const NOTIF_CAT: Record<string, 'clubs' | 'events' | 'system'> = {
  application_received: 'clubs', application_approved: 'clubs', application_rejected: 'clubs', removed_from_club: 'clubs', role_changed: 'clubs', announcement: 'clubs',
  report_resolved: 'clubs', new_report: 'clubs', event_new: 'events', event_reminder: 'events', event_cancelled: 'events', waitlist_promoted: 'events', system: 'system',
};
export const ACT_CAT: Record<string, 'membership' | 'event' | 'content' | 'settings'> = {
  application_received: 'membership', application_approved: 'membership', application_rejected: 'membership', member_joined: 'membership', member_left: 'membership',
  member_removed: 'membership', role_changed: 'membership', event_published: 'event', event_cancelled: 'event', post_created: 'content', announcement: 'content', poll: 'content',
  settings_changed: 'settings',
};
export const kindsOfCategory = (cat: string) => Object.keys(ACT_CAT).filter((k) => ACT_CAT[k] === cat);

export const ROLE_BADGE: Record<string, [string, string]> = { president: ['badge-president', 'crown'], board: ['badge-board', 'shield-check'], advisor: ['badge-advisor', 'graduation-cap'], member: ['badge-member', 'user-check'], superadmin: ['badge-superadmin', 'badge-check'] };
export const STATUS_BADGE: Record<string, [string, string]> = {
  pending: ['badge-pending', 'hourglass'], approved: ['badge-success', 'circle-check'], going: ['badge-success', 'circle-check'], attended: ['badge-success', 'circle-check'], active: ['badge-success', 'circle-check'],
  rejected: ['badge-danger', 'circle-x'], cancelled: ['badge-danger', 'circle-x'], removed: ['badge-danger', 'user-x'], absent: ['badge-neutral', 'circle-x'], full: ['badge-full', 'users'],
  waitlist: ['badge-pending', 'hourglass'], members: ['badge-neutral', 'lock'], draft: ['badge-neutral', 'file-text'], published: ['badge-success', 'circle-check'], suspended: ['badge-danger', 'ban'],
  past: ['badge-neutral', 'history'], open: ['badge-pending', 'flag'], resolved: ['badge-success', 'circle-check'], valid: ['badge-success', 'circle-check'], used: ['badge-neutral', 'check-check'], void: ['badge-danger', 'circle-x'],
};
