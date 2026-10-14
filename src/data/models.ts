/* Firestore modelleri — docs/domain-model.md §2 ve PLAN §9.6 ile aynı alan adları. Zamanlar istemcide ms (UTC). */
export type Ms = number;
export interface Base { createdAt: Ms; updatedAt: Ms; isDeleted: boolean; deletedAt: Ms | null; deletedBy: string | null }

export type UserStatus = 'active' | 'suspended' | 'deleted';
export interface User extends Base {
  id: string; name: string; nameLower: string; avatarSeed: string; avatarPath: string | null;
  department: string | null; year: string | null; interests: string[]; bio: string;
  status: UserStatus; suspendReason: string | null; staff: boolean; profileComplete: boolean;
}
export interface Social { email?: string | null; instagram?: string | null; web?: string | null }
export interface Advisor { name: string; title: string; userId?: string | null }
export interface Club extends Base {
  id: string; name: string; nameLower: string; categoryId: string; iconName: string;
  palette: string; pattern: string; coverSeed: string; logoPath: string | null; coverPath: string | null;
  memberCount: number; approvalRequired: boolean; applicationsOpen: boolean; requireNote: boolean;
  founded: number; summary: string; about: string; conditions: string[]; social: Social;
  presidentId: string; pinnedPostId: string | null; advisor: Advisor | null;
  status: 'active' | 'suspended'; suspendReason: string | null; lastMembershipRef: string | null; createdBy?: string;
}
export type MembershipStatus = 'pending' | 'active' | 'rejected' | 'removed' | 'left' | 'cancelled';
export type ClubRole = 'member' | 'board' | 'president' | 'advisor';
export interface Applicant { name: string; department: string | null; year: string | null; avatarSeed: string }
export interface Membership extends Base {
  id: string; clubId: string; userId: string; status: MembershipStatus; role: ClubRole;
  /** İstemci zenginleştirmesi: başvuru notu private/contact'tan okunur (belgede yok — CD-137). */
  note?: string;
  applicant: Applicant; appliedAt: Ms; decidedAt: Ms | null; decidedBy: string | null; retryAfter: Ms | null;
  rejectReason: string | null; rejectNote: string | null; priorCount: number;
}
export interface PostImage { path: string; w: number; h: number }
export interface PollOption { id: string; text: string }
export interface Poll { options: PollOption[]; endsAt: Ms; showResultsAfterVote: boolean }
export type PostType = 'post' | 'announcement' | 'poll';
export interface Post extends Base {
  id: string; clubId: string; authorId: string; type: PostType; title: string | null; text: string;
  images: PostImage[]; poll: Poll | null; pinned: boolean; pushSent: boolean; likes: string[]; likeCount: number;
  commentCount: number; lastCommentRef: string | null; isHidden: boolean; hiddenBy: string | null; hiddenAt: Ms | null; editedAt: Ms | null;
}
export interface Comment extends Base { id: string; postId: string; clubId: string; authorId: string; text: string; isHidden: boolean; hiddenBy: string | null; hiddenAt: Ms | null }
export type EventStatus = 'draft' | 'published' | 'cancelled';
export interface ClubEvent extends Base {
  id: string; clubId: string; createdBy: string; title: string; desc: string; type: string;
  startsAt: Ms; endsAt: Ms; placeId: string | null; placeText: string | null; capacity: number | null;
  visibility: 'public' | 'members'; status: EventStatus; cancelReason: string | null;
  coverSeed: string; coverPalette: string; coverPattern: string; coverPath: string | null;
  registrationOpen: boolean; autoReminder: boolean; goingCount: number; waitlistCount: number; attendedCount: number;
  lastRsvpRef: string | null; publishedAt: Ms | null;
}
export type RsvpStatus = 'going' | 'waitlist' | 'attended' | 'cancelled';
export interface Rsvp extends Base {
  id: string; eventId: string; clubId: string; userId: string; status: RsvpStatus; reminder: string; ticketCode: string;
  waitlistAt: Ms | null; scannedAt: Ms | null; scannedBy: string | null;
}
export interface NotificationRefs { clubId?: string; eventId?: string; postId?: string; applicantId?: string; reportId?: string; role?: string; textKey?: string }
export interface AppNotification extends Base { id: string; userId: string; type: string; refs: NotificationRefs; read: boolean }
export interface Report extends Base {
  id: string; targetType: 'post' | 'comment' | 'user' | 'club' | 'event'; targetId: string; targetClubId: string | null;
  reporterId: string; reason: string; note: string; status: 'open' | 'resolved'; action: string | null; resolvedAt: Ms | null; resolvedBy: string | null;
}
export interface Activity { id: string; clubId: string; actorId: string; kind: string; refs: Record<string, string>; createdAt: Ms }
export interface ClubPrefs { announcements: boolean; events: boolean; posts: boolean; muted: boolean }
export interface Settings {
  announcements: boolean; eventReminders: boolean; newEvents: boolean; applicationResults: boolean; management: boolean; system: boolean;
  reminderTime: '1h' | '1d'; quiet: boolean; quietFrom: string; quietTo: string; clubs: Record<string, ClubPrefs>; updatedAt?: Ms;
}
export interface Block extends Base { id: string; blockerId: string; blockedId: string }
export interface SavedPost extends Base { id: string; userId: string; postId: string; clubId: string; savedAt: Ms }
export interface SupportTicket extends Base { id: string; ticketNo: string; userId: string; subject: string; message: string; attachmentPaths: string[]; status: 'open' | 'closed' }

export const DEFAULT_SETTINGS: Settings = {
  announcements: true, eventReminders: true, newEvents: true, applicationResults: true, management: true, system: true,
  reminderTime: '1h', quiet: false, quietFrom: '22:00', quietTo: '08:00', clubs: {},
};
export const DEFAULT_CLUB_PREFS: ClubPrefs = { announcements: true, events: true, posts: true, muted: false };
export type Access = 'visitor' | 'pending' | 'rejected' | 'removed' | 'member' | 'manager' | 'advisor' | 'super';
