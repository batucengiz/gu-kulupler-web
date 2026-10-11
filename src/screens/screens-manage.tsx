import {
  AppBar,
  ApplicationRow,
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  DateBadge,
  EVENT_TYPES,
  EmptyState,
  EventCard,
  Icon,
  IconButton,
  Illustration,
  Input,
  KPI,
  ListEnd,
  ListState,
  MemberRow,
  MiniLineChart,
  Picker,
  PopMenu,
  Progress,
  Quick,
  RoleBadge,
  SCREENS,
  Scroll,
  Segmented,
  StatusBadge,
  Stepbar,
  StickyCTA,
  Switch,
  Tabs,
  Tile,
  UserRow,
  app,
  at,
  cx,
  dayKey,
  deptYear,
  downloadText,
  escapeHtml,
  placeName,
  useBusy,
  useEffect,
  useForm,
  useState,
  userName,
  ClubEmblem,
  LD,
  useLoader,
  A,
  handleError,
  db,
  session,
  SkeletonList,
  Fragment,
  useRef,
  LIMITS,
  sx,
  trLower,
  slug,
  Cover,
  ACT_CAT,
} from '../ui/kit';
import { NotFoundInline } from './screens-clubs';
import { decide, applicantUser } from './sheets';
import * as M from '../data/repo/memberships';
import * as R from '../data/repo/rsvps';
import { loadUsers } from '../data/repo/users';
import { ui } from '../app/core';
/* ===== SCREENS: MGT (club management) ===== */
const t = (k: string, p?: any) => app.t(k, p);
const S = SCREENS;
const sel = () => app.sel;
function useMgt(params: any) {
  const u = app.uid();
  const club = sel().club(params.clubId);
  const clubLoad = useLoader(!club && params.clubId ? LD.clubLoader(params.clubId) : null);
  const readOnly = club ? sel().isAdvisor(club.id, u) : false;
  const allowed = !!club && (sel().isManager(club.id, u) || sel().isSuper(u) || readOnly);
  return {
    u,
    club: club!,
    readOnly,
    allowed,
    loading: !club && clubLoad.status !== 'error' && session.s.membershipsLoaded !== false,
    guard: () => app.guard(club && club.id),
  };
}
export function MgtHeader({ club, title, screen, children, back }: any) {
  const u = app.uid();
  const managed = sel().managedClubs(u);
  const role = sel().roleIn(club.id, u) || (sel().isSuper(u) ? 'superadmin' : 'member');
  return (
    <AppBar
      onBack={back || (() => app.nav.back())}
      backAction={screen + '.back'}
      titleNode={
        <div className="col">
          <span className="t-caption">{title}</span>
          {managed.length > 1 ? (
            <button
              type="button"
              className="row gap4 t-title-s"
              style={{
                textAlign: 'left',
              }}
              data-action={screen + '.switchClub'}
              onClick={() => app.openSheet('SHT-18')}
              aria-haspopup="dialog"
            >
              <span
                className="ellipsis"
                style={{
                  maxWidth: '190px',
                }}
              >
                {club.name}
              </span>
              <Icon name="chevron-down" size={16} />
            </button>
          ) : (
            <span className="t-title-s ellipsis">{club.name}</span>
          )}
        </div>
      }
    >
      <RoleBadge role={role} />
      {children}
    </AppBar>
  );
}
function NoAccess({ screen, loading }: any) {
  if (loading)
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction={screen + '.back'} title="" />
        <SkeletonList n={4} variant="card" />
      </>
    );
  return (
    <>
      <AppBar onBack={() => app.nav.back()} backAction={screen + '.back'} title="" />
      <div className="empty">
        <Illustration name="locked" />
        <p className="t-body-s c-sec">{t('mgt.noAccess')}</p>
      </div>
    </>
  );
}
const ROBanner = ({ readOnly }: any) => (readOnly ? <Banner kind="readonly" text={t('mgt.readOnlyBanner')} /> : null);

/* MGT-01 */
S['MGT-01'] = {
  tab: 'clubs',
  title: 'mgt.title',
  comp: function Panel({ params, route }: any) {
    const { u, club, readOnly, allowed, loading } = useMgt(params);
    const dash = useLoader(allowed ? LD.mgtDashLoader(club.id) : null);
    if (!allowed) return <NoAccess loading={loading} screen="MGT-01" />;
    const x = db.extra['mgt:' + club.id] || null;
    const k = {
      members: club.memberCount,
      newMembers: x ? x.newMembers : 0,
      pending: x ? x.pending : sel().pendingApps(club.id).length,
      upcoming: sel()
        .clubEvents(club.id)
        .filter((e) => e.status === 'published' && e.startsAt > Date.now()).length,
      announcements: x ? x.announcements : 0,
    };
    const growth: number[] = x ? x.growth : [];
    const used = sel().dailyAnnouncements(club.id);
    const quota = LIMITS.announcementDailyLimit;
    const upcoming = sel()
      .clubEvents(club.id)
      .filter((e) => e.status === 'published' && e.startsAt > Date.now())
      .sort((a, b) => a.startsAt - b.startsAt)
      .slice(0, 2);
    const acts: any[] = x ? x.recent.slice(0, 5) : [];
    const noMembers = club.memberCount <= 1;
    void u;
    const ro = () => app.toast('TST-26');
    const go = (s: string, p?: any) => () =>
      app.nav.push(s, {
        clubId: club.id,
        ...(p || {}),
      });
    const write = (fn: () => void) => (readOnly ? ro : fn);
    const labels = growth.map((_, i) =>
      t('mgt.weekN', {
        n: i - 7,
      }),
    );
    return (
      <>
        <MgtHeader club={club} title={t('mgt.title')} screen="MGT-01" />
        <ROBanner readOnly={readOnly} />
        <Scroll routeKey={route.key}>
          <div className="col gap20 px16 pb24">
            {x && noMembers && !readOnly ? (
              <Card
                muted
                class="card-body col gap8"
                style={{
                  alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                <Illustration name="empty-clubs" size={80} />
                <span className="t-title-s">{t('mgt.newClub.title')}</span>
                <span className="t-body-s c-sec">{t('mgt.newClub.desc')}</span>
                <Button
                  size="sm"
                  icon="share-2"
                  label={t('common.share')}
                  action="MGT-01.share"
                  onClick={() =>
                    app.openSheet('SHT-15', {
                      type: 'club',
                      id: club.id,
                    })
                  }
                />
              </Card>
            ) : null}
            <div className="grid2">
              <KPI
                label={t('mgt.kpi.members')}
                value={k.members}
                sub={t('mgt.kpi.newThisMonth', {
                  count: k.newMembers,
                })}
                icon="users"
                action="MGT-01.kpi.members"
                onClick={go('MGT-03')}
              />
              <KPI label={t('mgt.kpi.pending')} value={k.pending} accent icon="user-plus" action="MGT-01.kpi.pending" onClick={go('MGT-02')} />
              <KPI label={t('mgt.kpi.events')} value={k.upcoming} icon="calendar" action="MGT-01.kpi.events" onClick={go('MGT-04')} />
              <KPI
                label={t('mgt.kpi.announcements')}
                value={k.announcements}
                icon="megaphone"
                action="MGT-01.kpi.announcements"
                onClick={go('MGT-08', {
                  tab: 'announcements',
                })}
              />
            </div>
            <div className="col gap8">
              <h2 className="t-title-s">{t('mgt.quick.title')}</h2>
              <div className="grid3">
                <Quick
                  icon="pencil"
                  label={t('mgt.quick.post')}
                  action="MGT-01.quick.post"
                  onClick={write(() =>
                    app.nav.push('FED-03', {
                      clubId: club.id,
                    }),
                  )}
                />
                <Quick
                  icon="megaphone"
                  label={t('mgt.quick.announce')}
                  action="MGT-01.quick.announce"
                  onClick={write(() => {
                    app.nav.push('FED-03', {
                      clubId: club.id,
                      type: 'announcement',
                    });
                  })}
                />
                <Quick icon="calendar-plus" label={t('mgt.quick.event')} action="MGT-01.quick.event" onClick={write(go('MGT-05'))} />
                <Quick
                  icon="scan-line"
                  label={t('mgt.quick.attendance')}
                  action="MGT-01.quick.attendance"
                  onClick={() => {
                    const ev =
                      upcoming[0] ||
                      sel()
                        .clubEvents(club.id)
                        .find((e) => e.status === 'published');
                    ev
                      ? app.nav.push('MGT-06', {
                          clubId: club.id,
                          eventId: ev.id,
                        })
                      : app.toast('TST-X12');
                  }}
                />
                <Quick icon="users" label={t('mgt.quick.members')} action="MGT-01.quick.members" onClick={go('MGT-03')} />
                <Quick icon="settings" label={t('mgt.quick.settings')} action="MGT-01.quick.settings" onClick={go('MGT-09')} />
              </div>
            </div>
            <Card class="card-body col gap8">
              <div className="row between">
                <span className="t-label-l c-heading">{t('mgt.growth')}</span>
                <span className="t-caption">{t('mgt.weeks8')}</span>
              </div>
              {growth.length ? <MiniLineChart data={growth} labels={labels} action="MGT-01.chart.point" /> : <SkeletonList n={1} />}
            </Card>
            <Card class="card-body col gap8">
              <div className="row between">
                <span className="t-label-l c-heading">{t('compose.dailyQuota')}</span>
                <span className="t-caption tnum">
                  {used}/{quota}
                </span>
              </div>
              <Progress value={used} max={quota} kind={used >= quota ? 'warning' : undefined} label={t('compose.dailyQuota')} />
              <span className="t-caption">
                {used >= quota
                  ? t('compose.limitReached')
                  : t('mgt.quotaLeft', {
                      count: quota - used,
                    })}
              </span>
            </Card>
            <div className="col gap8">
              <div className="row between">
                <h2 className="t-title-s">{t('mgt.upcoming')}</h2>
                <Button size="sm" variant="text" label={t('common.all')} action="MGT-01.eventsAll" onClick={go('MGT-04')} />
              </div>
              {upcoming.length ? (
                upcoming.map((e) => (
                  <Card
                    key={e.id}
                    tappable
                    action={'MGT-01.event.' + e.id}
                    onClick={() =>
                      app.nav.push('MGT-06', {
                        clubId: club.id,
                        eventId: e.id,
                      })
                    }
                    label={e.title}
                  >
                    <div
                      className="row gap12"
                      style={{
                        padding: '12px 16px',
                      }}
                    >
                      <DateBadge ts={e.startsAt} />
                      <div className="flex1 col gap2">
                        <span className="t-title-s ellipsis">{e.title}</span>
                        <span className="t-caption">
                          {app.fmt.time(e.startsAt)}
                          {' \xB7 '}
                          {placeName(e)}
                        </span>
                        <span className="row gap8">
                          <Progress value={sel().registeredCount(e)} max={e.capacity || Math.max(1, sel().registeredCount(e))} thin label={t('event.capacity')} />
                          <span className="t-caption tnum">
                            {sel().registeredCount(e)}
                            {e.capacity != null ? '/' + e.capacity : ''}
                          </span>
                        </span>
                      </div>
                      <Icon name="chevron-right" size={20} class="c-muted" />
                    </div>
                  </Card>
                ))
              ) : (
                <p className="t-body-s c-muted">{t('mgt.noUpcoming')}</p>
              )}
            </div>
            <div className="col gap8">
              <div className="row between">
                <h2 className="t-title-s">{t('mgt.recent')}</h2>
                <Button size="sm" variant="text" label={t('common.all')} action="MGT-01.activityAll" onClick={go('MGT-10')} />
              </div>
              <Card>
                {acts.map((a, i) => (
                  <Fragment key={a.id}>
                    {i ? <div className="divider" /> : null}
                    <ActivityRow a={a} screen="MGT-01" club={club} />
                  </Fragment>
                ))}
                {!acts.length && dash.status !== 'loading' ? <p className="t-body-s c-muted p16">{t('activity.empty')}</p> : null}
                {!x && dash.status === 'loading' ? <SkeletonList n={3} /> : null}
              </Card>
            </div>
          </div>
        </Scroll>
      </>
    );
  },
};
const ACT_ICON: Record<string, string> = {
  application_received: 'user-plus',
  application_approved: 'user-check',
  application_rejected: 'user-x',
  member_joined: 'user-plus',
  member_left: 'log-out',
  member_removed: 'user-x',
  role_changed: 'user-cog',
  event_published: 'calendar-plus',
  event_cancelled: 'calendar-x',
  post_created: 'file-text',
  announcement: 'megaphone',
  poll: 'chart-column',
  settings_changed: 'settings',
};
export function ActivityRow({ a, screen, club }: any) {
  const actor = sel().user(a.actorId);
  const refs = a.refs || {};
  const target = refs.userId ? sel().user(refs.userId) : null;
  const ev = refs.eventId ? sel().event(refs.eventId) : null;
  const text = t('activity.' + a.kind, {
    actor: userName(actor),
    user: userName(target),
    event: ev ? ev.title : refs.eventTitle || '',
    role: refs.role ? t('role.' + refs.role) : '',
  });
  const go = () => {
    if (refs.eventId)
      app.nav.push('EVT-02', {
        id: refs.eventId,
      });
    else if (refs.postId)
      app.nav.push('FED-02', {
        clubId: club.id,
        postId: refs.postId,
      });
    else if (a.kind.startsWith('application'))
      app.nav.push('MGT-02', {
        clubId: club.id,
      });
    else if (target)
      app.nav.push('CLB-07', {
        id: target.id,
        clubId: club.id,
      });
    else
      app.nav.push('MGT-09', {
        clubId: club.id,
      });
  };
  return (
    <Tile
      inCard
      leading={<Avatar user={actor} size={36} />}
      title={
        <span
          className="t-body-s c-heading"
          dangerouslySetInnerHTML={{
            __html: escapeHtml(text).replace(escapeHtml(userName(actor)), `<b>${escapeHtml(userName(actor))}</b>`),
          }}
        />
      }
      subtitle={app.fmt.rel(a.createdAt)}
      trailing={<Icon name={ACT_ICON[a.kind] || 'info'} size={18} />}
      action={`${screen}.row.${a.id}`}
      onClick={go}
    />
  );
}

/** Katılımcı listesini canlı dinle (okutma anında listeye yansır). */
function useParticipantsLive(eventId: string | null, clubId: string | null): 'loading' | 'ok' | 'error' {
  const [st, setSt] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => {
    if (!eventId || !clubId) return;
    return R.watchParticipants(
      eventId,
      clubId,
      (list) => {
        Object.keys(db.rsvps).forEach((k) => {
          if (db.rsvps[k].eventId === eventId) delete db.rsvps[k];
        });
        db.putRsvps(list);
        void loadUsers(list.map((r) => r.userId));
        setSt('ok');
      },
      () => setSt('error'),
    );
  }, [eventId, clubId]);
  return st;
}

/* MGT-02 applications */
S['MGT-02'] = {
  tab: 'clubs',
  title: 'applications.title',
  comp: function Applications({ params, route }: any) {
    const { u, club, readOnly, allowed, loading } = useMgt(params);
    const [tab, setTab] = useState(params.tab || 'pending');
    const [q, setQ] = useState('');
    const [desc, setDesc] = useState(true);
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<any[]>([]);
    const [leaving, setLeaving] = useState<any[]>([]);
    const appsLoad = useLoader(allowed ? LD.appsLoader(club.id) : null);
    if (!allowed) return <NoAccess loading={loading} screen="MGT-02" />;
    void u;
    const withUser = (m: any) => ({ ...m, user: applicantUser(m) });
    const pending = sel().pendingApps(club.id).map(withUser);
    const list = (tab === 'pending' ? pending : (tab === 'approved' ? sel().approvedApps(club.id) : sel().rejectedApps(club.id)).map(withUser))
      .filter((m) => !q || trLower(m.user.name).includes(trLower(q)))
      .sort((a, b) => (desc ? 1 : -1) * ((tab === 'pending' ? b.appliedAt - a.appliedAt : (b.decidedAt || 0) - (a.decidedAt || 0)) || 0));
    const approve = (m: any) => {
      if (!app.guard(club.id)) return;
      setLeaving((l) => [...l, m.userId]);
      void decide(club.id, m.userId, () => A.approve(club.id, m.userId)).then((ok) => {
        setLeaving((l) => l.filter((x) => x !== m.userId));
        if (ok)
          app.toast('TST-27', {
            name: m.user.name,
            undo: () => A.undoDecision(club.id, m.userId).catch(handleError),
          });
      });
    };
    const reject = (m: any) => {
      if (!app.guard(club.id)) return;
      app.openSheet('SHT-20', {
        clubId: club.id,
        userId: m.userId,
      });
    };
    const bulk = (kind: 'approve' | 'reject') => {
      if (!app.guard(club.id)) return;
      app.openDialog('DLG-17', {
        kind,
        count: selected.length,
        onConfirm: async () => {
          const ids = selected.slice();
          const r = await A.bulkDecide(club.id, ids, kind === 'approve', 'other');
          app.closeDialog();
          setSelected([]);
          setSelecting(false);
          if (r.conflicted || r.failed) {
            void appsLoad.reload();
            app.toast('TST-X40', { text: t('web.bulk.partial', { ok: r.succeeded, total: ids.length }) });
          } else
            app.toast(kind === 'approve' ? 'TST-27' : 'TST-28', {
              name: t('applications.nApplicants', {
                count: r.succeeded,
              }),
            });
        },
      });
    };
    const toggleSel = (id: string) => {
      setSelecting(true);
      setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    };
    return <>{selecting ? (
        <AppBar
          onBack={() => {
            setSelecting(false);
            setSelected([]);
          }}
          backAction="MGT-02.cancelSelect"
          closeIcon
          title={t('applications.selected', {
            count: selected.length,
          })}
        >
          <Button
            size="sm"
            variant="text"
            label={t('applications.selectAll')}
            action="MGT-02.selectAll"
            onClick={() => setSelected(list.map((m) => m.userId))}
          />
          <IconButton
            icon="check"
            label={t('applications.approve')}
            action="MGT-02.bulkApprove"
            disabled={!selected.length}
            onClick={() => bulk('approve')}
            style={{
              color: 'var(--state-success)',
            }}
          />
          <IconButton
            icon="x"
            label={t('applications.reject')}
            action="MGT-02.bulkReject"
            disabled={!selected.length}
            onClick={() => bulk('reject')}
            style={{
              color: 'var(--state-danger)',
            }}
          />
        </AppBar>
      ) : (
        <MgtHeader club={club} title={t('applications.title')} screen="MGT-02">
          <IconButton icon="arrow-up-down" label={t('common.sort')} action="MGT-02.sort" onClick={() => setDesc(!desc)} />
        </MgtHeader>
      )}{<ROBanner readOnly={readOnly} />}{!club.applicationsOpen ? (
        <Banner kind="info" icon="lock" text={t('applications.closedBanner')}>
          <span
            style={{
              marginLeft: '8px',
              display: 'inline-flex',
              verticalAlign: 'middle',
            }}
          >
            <Switch
              checked={false}
              onChange={() => {
                if (!app.guard(club.id)) return;
                A.setApplicationsOpen(club.id, true)
                  .then(() =>
                    app.toast('TST-54', {
                      open: true,
                    }),
                  )
                  .catch(handleError);
              }}
              action="MGT-02.toggleOpen"
              label={t('applications.openToggle')}
            />
          </span>
        </Banner>
      ) : null}{<Tabs
        tabs={[
          {
            id: 'pending',
            label: t('applications.tab.pending'),
            count: pending.length || undefined,
          },
          {
            id: 'approved',
            label: t('applications.tab.approved'),
          },
          {
            id: 'rejected',
            label: t('applications.tab.rejected'),
          },
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setSelecting(false);
          setSelected([]);
        }}
        action="MGT-02.tab"
      />}{<div className="px16 py8">
        <Input icon="search" placeholder={t('members.search')} value={q} onInput={setQ} action="MGT-02.search" ariaLabel={t('members.search')} />
      </div>}{<Scroll routeKey={route.key} onRefresh={appsLoad.reload} refreshAction="MGT-02.refresh">
        <ListState
          status={appsLoad.status !== 'ok' && list.length ? 'ok' : appsLoad.status}
          onRetry={appsLoad.reload}
          n={5}
          emptyProps={{
            illustration: 'empty-applications',
            title: t('applications.empty.' + tab),
          }}
        >
          {list.length ? (
            <>{tab === 'pending' ? <p className="t-caption px16 pb16">{t('applications.hint')}</p> : null}{<div className="col">
                {list.map((m) =>
                  tab === 'pending' ? (
                    <div
                      key={m.userId}
                      style={{
                        transition: 'opacity .25s, transform .25s',
                        opacity: leaving.includes(m.userId) ? 0 : 1,
                        transform: leaving.includes(m.userId) ? 'translateX(40px)' : 'none',
                      }}
                    >
                      <ApplicationRow
                        m={m}
                        selecting={selecting}
                        selected={selected.includes(m.userId)}
                        onSelect={() => toggleSel(m.userId)}
                        onApprove={() => approve(m)}
                        onReject={() => reject(m)}
                        onOpen={() =>
                          selecting
                            ? toggleSel(m.userId)
                            : app.openSheet('SHT-19', {
                                clubId: club.id,
                                userId: m.userId,
                              })
                        }
                        readOnly={readOnly}
                      />
                    </div>
                  ) : (
                    <Tile
                      key={m.userId}
                      leading={<Avatar user={m.user} size={40} />}
                      title={m.user.name}
                      subtitle={`${deptYear(m.user)} · ${app.fmt.date(m.decidedAt)}`}
                      sub2={tab === 'rejected' && m.rejectReason ? t('rejectReason.' + m.rejectReason) : null}
                      trailing={<StatusBadge status={tab === 'approved' ? 'approved' : 'rejected'} />}
                      action={'MGT-02.row.' + m.userId}
                      onClick={() =>
                        app.openSheet('SHT-19', {
                          clubId: club.id,
                          userId: m.userId,
                        })
                      }
                    />
                  ),
                )}
              </div>}{<ListEnd />}</>
          ) : (
            <EmptyState illustration="empty-applications" title={t('applications.empty.' + tab)} />
          )}
        </ListState>
      </Scroll>}</>;
  },
};

/* MGT-03 members */
S['MGT-03'] = {
  tab: 'clubs',
  title: 'mgtMembers.title',
  comp: function MgtMembers({ params, route }: any) {
    const { u, club, readOnly, allowed, loading } = useMgt(params);
    const [q, setQ] = useState('');
    const [role, setRole] = useState('all');
    const [sort, setSort] = useState('name');
    const [menu, setMenu] = useState<any>(null);
    const [exporting, runExport] = useBusy();
    const membersLoad = useLoader(allowed ? LD.allMembersLoader(club.id) : null);
    useLoader(allowed ? LD.mgtRatesLoader(club.id) : null);
    if (!allowed) return <NoAccess loading={loading} screen="MGT-03" />;
    const isPres = sel().isPresident(club.id, u) || sel().isSuper(u);
    const list = sel()
      .clubMembers(club.id)
      .map((m) => ({ ...m, user: (m.user || applicantUser(m)) as any }))
      .filter((m) => !q || trLower(m.user.name).includes(trLower(q)))
      .filter((m) => role === 'all' || m.role === role)
      .sort((a, b) =>
        sort === 'name'
          ? a.user.name.localeCompare(b.user.name, 'tr')
          : sort === 'joined'
            ? (b.decidedAt || b.appliedAt || 0) - (a.decidedAt || a.appliedAt || 0)
            : (sel().memberRate(club.id, b.userId) ?? -1) - (sel().memberRate(club.id, a.userId) ?? -1),
      );
    const exportCsv = () =>
      runExport(async () => {
      const emails = await Promise.all(list.map((m) => M.readContact(club.id, m.userId).catch(() => null)));
      const rows = [['ad', 'eposta', 'bolum', 'sinif', 'rol', 'katilim_tarihi']].concat(
        list.map((m, i) => [
          m.user.name,
          emails[i] || '',
          m.user.department ? t('dept.' + m.user.department) : '',
          m.user.year ? t('year.' + m.user.year) : '',
          t('role.' + m.role),
          m.decidedAt ? new Date(m.decidedAt).toISOString().slice(0, 10) : '',
        ]),
      );
      downloadText(
        '\ufeff' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n'),
        slug(club.name) + '-uyeler.csv',
        'text/csv;charset=utf-8',
      );
      app.toast('TST-29');
      });
    return <>{<MgtHeader club={club} title={t('mgtMembers.title')} screen="MGT-03">
        <IconButton icon="more-vertical" label={t('a11y.more')} action="MGT-03.menu" onClick={() => setMenu('top')} />
      </MgtHeader>}{<ROBanner readOnly={readOnly} />}{<div className="px16 py8">
        <Input icon="search" placeholder={t('members.search')} value={q} onInput={setQ} action="MGT-03.search" ariaLabel={t('members.search')} />
      </div>}{<div className="hscroll pb16">
        {['all', 'president', 'board', 'advisor', 'member'].map((r) => (
          <Chip
            key={r}
            label={r === 'all' ? t('common.all') : t('role.' + r)}
            selected={role === r}
            action={'MGT-03.filter.' + r}
            onClick={() => setRole(r)}
          />
        ))}
      </div>}{<div className="row between px16 pb16">
        <span className="t-label-l c-sec tnum">
          {t('members.total', {
            count: list.length,
          })}
        </span>
        <Button size="sm" variant="outline" icon="arrow-up-down" label={t('mgtMembers.sort.' + sort)} action="MGT-03.sort" onClick={() => setMenu('sort')} />
      </div>}{<Scroll routeKey={route.key} onRefresh={membersLoad.reload} refreshAction="MGT-03.refresh">
        <ListState
          status={membersLoad.status !== 'ok' && list.length ? 'ok' : membersLoad.status}
          onRetry={membersLoad.reload}
          n={6}
          emptyProps={{
            illustration: 'empty-clubs',
            title: t('members.noResults'),
          }}
        >
          {list.length ? (
            <>{<div className="col">
                {list.map((m) => (
                  <MemberRow
                    key={m.userId}
                    m={m}
                    screen="MGT-03"
                    clubId={club.id}
                    showRate
                    sub={t('mgtMembers.since', {
                      date: app.fmt.monthYear(m.decidedAt || m.appliedAt || Date.now()),
                    })}
                    onMenu={
                      m.role !== 'president' && m.role !== 'advisor' && !readOnly
                        ? () =>
                            app.openSheet('SHT-21', {
                              clubId: club.id,
                              userId: m.userId,
                            })
                        : null
                    }
                  />
                ))}
              </div>}{isPres ? (
                <div className="px16 pt16">
                  <Card class="card-body col gap8">
                    <span className="t-label-l c-heading row gap6">
                      <Icon name="crown" size={18} class="c-brand" />
                      {t('mgtMembers.transferTitle')}
                    </span>
                    <span className="t-body-s c-sec">{t('mgtMembers.transferDesc')}</span>
                    <Button
                      variant="outline"
                      label={t('mgtMembers.transfer')}
                      action="MGT-03.transfer"
                      onClick={() =>
                        app.openSheet('SHT-25', {
                          mode: 'transfer',
                          clubId: club.id,
                          onSelect: (uid: string) => {
                            app.closeSheet();
                            app.openDialog('DLG-21', {
                              clubId: club.id,
                              userId: uid,
                            });
                          },
                        })
                      }
                    />
                  </Card>
                </div>
              ) : null}{<ListEnd />}</>
          ) : (
            <EmptyState illustration="empty-clubs" title={t('members.noResults')} />
          )}
        </ListState>
      </Scroll>}{menu === 'top' ? (
        <PopMenu id="MGT-03" onClose={() => setMenu(null)}>
          <Tile
            title={exporting ? t('common.loading') : t('mgtMembers.export')}
            leading={<Icon name="download" size={20} />}
            action="MGT-03.export"
            onClick={() => {
              setMenu(null);
              exportCsv();
            }}
          />
        </PopMenu>
      ) : null}{menu === 'sort' ? (
        <PopMenu id="MGT-03" onClose={() => setMenu(null)}>
          {['name', 'joined', 'rate'].map((s) => (
            <Tile
              key={s}
              title={t('mgtMembers.sort.' + s)}
              trailing={sort === s ? <Icon name="check" size={18} class="c-brand" /> : null}
              action={'MGT-03.sort.' + s}
              onClick={() => {
                setSort(s);
                setMenu(null);
              }}
            />
          ))}
        </PopMenu>
      ) : null}</>;
  },
};

/* MGT-04 events */
S['MGT-04'] = {
  tab: 'clubs',
  title: 'mgtEvents.title',
  comp: function MgtEvents({ params, route }: any) {
    const { u, club, readOnly, allowed, loading } = useMgt(params);
    const [tab, setTab] = useState(params.tab || 'published');
    const evLoad = useLoader(allowed ? LD.clubEventsLoader(club.id) : null);
    if (!allowed) return <NoAccess loading={loading} screen="MGT-04" />;
    void u;
    const evs = sel()
      .clubEvents(club.id)
      .filter((e) =>
        tab === 'draft'
          ? e.status === 'draft'
          : tab === 'published'
            ? e.status === 'published' && e.endsAt >= Date.now()
            : tab === 'past'
              ? e.status === 'published' && e.endsAt < Date.now()
              : e.status === 'cancelled',
      )
      .sort((a, b) => (tab === 'past' ? b.startsAt - a.startsAt : a.startsAt - b.startsAt));
    return <>{<MgtHeader club={club} title={t('mgtEvents.title')} screen="MGT-04" />}{<ROBanner readOnly={readOnly} />}{<div className="px16 pb16">
        <Segmented
          options={[
            {
              id: 'draft',
              label: t('status.draft'),
            },
            {
              id: 'published',
              label: t('status.published'),
            },
            {
              id: 'past',
              label: t('event.past'),
            },
            {
              id: 'cancelled',
              label: t('status.cancelled'),
            },
          ]}
          value={tab}
          onChange={setTab}
          action="MGT-04.tab"
        />
      </div>}{<Scroll routeKey={route.key} onRefresh={evLoad.reload} refreshAction="MGT-04.refresh">
        <ListState
          status={evLoad.status !== 'ok' && evs.length ? 'ok' : evLoad.status}
          onRetry={evLoad.reload}
          n={4}
          emptyProps={{
            illustration: 'empty-events',
            title: t('mgtEvents.empty.' + tab),
          }}
        >
          {evs.length ? (
            evs.map((e) => (
              <Tile
                key={e.id}
                leading={<DateBadge ts={e.startsAt} />}
                title={e.title}
                subtitle={`${app.fmt.dateTime(e.startsAt)} · ${e.capacity != null ? `${sel().registeredCount(e)}/${e.capacity}` : t('event.unlimited')}`}
                sub2={
                  <span className="row gap6">
                    <StatusBadge
                      status={e.visibility === 'members' ? 'members' : e.status}
                      label={e.visibility === 'members' ? t('event.visibility.members') : undefined}
                    />
                    {e.visibility === 'members' ? <StatusBadge status={e.status} /> : null}
                  </span>
                }
                action={'MGT-04.event.' + e.id}
                onClick={() =>
                  app.nav.push('EVT-02', {
                    id: e.id,
                  })
                }
                trailing={
                  <IconButton
                    icon="more-vertical"
                    label={t('a11y.more')}
                    action={'MGT-04.menu.' + e.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      app.openSheet('SHT-23', {
                        eventId: e.id,
                      });
                    }}
                  />
                }
              />
            ))
          ) : (
            <EmptyState
              illustration="empty-events"
              title={t('mgtEvents.empty.' + tab)}
              cta={readOnly ? null : t('mgtEvents.create')}
              ctaAction="MGT-04.create"
              onCta={() =>
                app.nav.push('MGT-05', {
                  clubId: club.id,
                })
              }
            />
          )}
        </ListState>
      </Scroll>}{readOnly ? null : (
        <button
          type="button"
          className="fab"
          data-action="MGT-04.create"
          onClick={() =>
            app.nav.push('MGT-05', {
              clubId: club.id,
            })
          }
        >
          <Icon name="plus" size={22} />
          {t('mgtEvents.create')}
        </button>
      )}</>;
  },
};

/* MGT-05 event form */
S['MGT-05'] = {
  tab: 'clubs',
  title: 'eventForm.title',
  comp: function EventForm({ params }: any) {
    const { u, club, readOnly, allowed, loading } = useMgt(params);
    const editing = params.eventId ? sel().event(params.eventId) : null;
    const [busy, run] = useBusy();
    const evLoad = useLoader(params.eventId ? LD.eventLoader(params.eventId) : null);
    if (params.eventId && !editing) {
      if (evLoad.status === 'error') return <NotFoundInline />;
      return <NoAccess loading screen="MGT-05" />;
    }
    if (!allowed || readOnly) return <NoAccess loading={loading} screen="MGT-05" />;
    if (editing && (editing.isDeleted || editing.clubId !== club.id)) return <NotFoundInline />;
    const init = () =>
      editing
        ? {
            step: 1,
            title: editing.title,
            desc: editing.desc,
            type: editing.type,
            cover: {
              palette: editing.coverPalette,
              pattern: editing.coverPattern,
              seed: editing.coverSeed,
              path: editing.coverPath,
            },
            startsAt: editing.startsAt,
            endsAt: editing.endsAt,
            placeId: editing.placeId,
            placeText: editing.placeText,
            capacity: editing.capacity,
            unlimited: editing.capacity == null,
            visibility: editing.visibility,
            autoReminder: editing.autoReminder,
            errors: {},
            dirty: false,
          }
        : {
            step: 1,
            title: '',
            desc: '',
            type: 'sosyal',
            cover: {
              palette: club ? club.palette : 'red',
              pattern: 'mountain',
              seed: 'event-new-' + Date.now(),
            },
            startsAt: at(7, 18, 0),
            endsAt: at(7, 20, 0),
            registrationOpen: true,
            placeId: null,
            placeText: null,
            capacity: 40,
            unlimited: false,
            visibility: 'public',
            autoReminder: true,
            errors: {},
            dirty: false,
          };
    const [f, set, reset] = useForm('eventForm-' + (params.eventId || params.clubId), init);
    const upd = (p: any) =>
      set({
        ...p,
        dirty: true,
      });
    const registered = editing ? sel().registeredCount(editing) : 0;
    const conflicts = sel()
      .clubEvents(club.id)
      .filter((e) => e.id !== (editing && editing.id) && e.status === 'published' && e.startsAt < f.endsAt && e.endsAt > f.startsAt).length;
    const validate = () => {
      const e: any = {};
      if (f.step === 1) {
        if (!f.title.trim()) e.title = t('auth.err.required');
        if (f.title.trim().length > LIMITS.eventTitleMax) e.title = t('auth.err.required');
      }
      if (f.step === 2) {
        if (f.startsAt < Date.now() && !editing) e.start = t('eventForm.err.future');
        if (f.endsAt <= f.startsAt) e.end = t('eventForm.err.endAfter');
        if (!f.placeId && !f.placeText) e.place = t('auth.err.required');
        if (!f.unlimited && (!f.capacity || f.capacity < 1)) e.capacity = t('auth.err.required');
        if (!f.unlimited && editing && editing.status === 'published' && f.capacity < registered)
          e.capacity = t('eventForm.err.capacity', {
            count: registered,
          });
      }
      set({
        errors: e,
      });
      return !Object.keys(e).length;
    };
    const close = () => {
      if (f.dirty)
        app.openDialog('DLG-25', {
          onSave: () => {
            app.closeDialog();
            saveDraft();
          },
          onDiscard: () => {
            app.closeDialog();
            reset();
            app.nav.back();
          },
          onKeep: () => app.closeDialog(),
        });
      else {
        reset();
        app.nav.back();
      }
    };
    const payload = () => ({
      title: f.title.trim(),
      desc: f.desc.trim(),
      type: f.type,
      startsAt: f.startsAt,
      endsAt: f.endsAt,
      placeId: f.placeId,
      placeText: f.placeText,
      capacity: f.unlimited ? null : f.capacity,
      visibility: f.visibility,
      autoReminder: f.autoReminder,
      coverPalette: f.cover.palette,
      coverPattern: f.cover.pattern,
      coverSeed: f.cover.seed,
      registrationOpen: f.registrationOpen !== false,
    });
    void u;
    const coverOpts = () => ({ cover: f.cover.file || null, clearCover: !f.cover.file && !f.cover.path && !!(editing && editing.coverPath) });
    const saveDraft = () =>
      run(async () => {
        if (!app.guard(club.id)) return;
        await A.saveEvent(payload() as any, { clubId: club.id, eventId: editing ? editing.id : null, ...coverOpts() });
        reset();
        app.toast('TST-13');
        app.nav.popTo('MGT-04') ||
          app.nav.replace('MGT-04', {
            clubId: club.id,
            tab: editing && editing.status !== 'draft' ? 'published' : 'draft',
          });
      });
    const publish = () => {
      if (!app.guard(club.id)) return;
      if (editing && editing.status === 'published')
        return run(async () => {
          await A.saveEvent(payload() as any, { clubId: club.id, eventId: editing.id, ...coverOpts() });
          reset();
          app.nav.popTo('MGT-04') || app.nav.replace('MGT-04', { clubId: club.id });
          app.toast('TST-30', { action: () => app.nav.push('EVT-02', { id: editing.id }) });
        });
      app.openDialog('DLG-22', {
        count: Math.max(0, club.memberCount - 1),
        onConfirm: (notifyMembers: boolean) =>
          run(async () => {
            const id = await A.saveEvent(payload() as any, { clubId: club.id, eventId: editing ? editing.id : null, publish: true, notify: notifyMembers, ...coverOpts() });
            app.closeDialog();
            reset();
            app.nav.popTo('MGT-04') ||
              app.nav.replace('MGT-04', {
                clubId: club.id,
              });
            app.toast('TST-30', {
              action: () =>
                app.nav.push('EVT-02', {
                  id,
                }),
            });
          }),
      });
    };
    const setDate = (key: string, ts: number) => {
      const cur = new Date(f[key]);
      const d = new Date(ts);
      d.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
      const patch: any = {
        [key]: d.getTime(),
      };
      if (key === 'startsAt' && d.getTime() >= f.endsAt) patch.endsAt = d.getTime() + 2 * 36e5;
      upd(patch);
    };
    const setTime = (key: string, hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      const d = new Date(f[key]);
      d.setHours(h, m, 0, 0);
      const patch: any = {
        [key]: d.getTime(),
      };
      if (key === 'startsAt' && d.getTime() >= f.endsAt) patch.endsAt = d.getTime() + 2 * 36e5;
      upd(patch);
    };
    const preview: any = {
      id: 'preview',
      clubId: club.id,
      title: f.title || t('eventForm.untitled'),
      desc: f.desc,
      type: f.type,
      startsAt: f.startsAt,
      endsAt: f.endsAt,
      placeId: f.placeId,
      placeText: f.placeText,
      capacity: f.unlimited ? null : f.capacity,
      visibility: f.visibility,
      status: 'published',
      coverSeed: f.cover.seed,
      coverPalette: f.cover.palette,
      coverPattern: f.cover.pattern,
      coverPath: f.cover.path || null,
      registrationOpen: true,
      goingCount: 0,
      attendedCount: 0,
      waitlistCount: 0,
    };
    return (
      <>
        <AppBar
          onBack={close}
          backAction="MGT-05.close"
          closeIcon
          titleNode={
            <div className="col gap6">
              <span className="t-caption">
                {editing ? t('eventForm.editTitle') : t('eventForm.title')}
                {' \xB7 '}
                {f.step}/3
              </span>
              <Stepbar step={f.step} total={3} />
            </div>
          }
        />
        <Scroll routeKey={'eventform-' + f.step}>
          <div className="col gap16 px16 pt8 pb24">
            {f.step === 1 ? (
              <>
                <button
                  type="button"
                  className="cover r16-9"
                  style={{
                    borderRadius: '16px',
                    width: '100%',
                    position: 'relative',
                  }}
                  data-action="MGT-05.cover"
                  onClick={() =>
                    app.openSheet('SHT-31', {
                      value: f.cover,
                      icon: club.iconName,
                      onSelect: (c: any) =>
                        upd({
                          cover: c.file ? { ...c, path: null, url: URL.createObjectURL(c.file) } : { ...c, path: null, file: null, url: null },
                        }),
                    })
                  }
                  aria-label={t('eventForm.cover')}
                >
                  {f.cover.url ? (
                    <img src={f.cover.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Cover seed={f.cover.seed} icon={club.iconName} palette={f.cover.palette} pattern={f.cover.pattern} path={f.cover.path} style={{ position: 'absolute', inset: 0 }} />
                  )}
                  <span
                    className="btn btn-sm btn-outline"
                    style={{
                      position: 'absolute',
                      right: '12px',
                      bottom: '12px',
                    }}
                  >
                    <Icon name="image" size={16} />
                    {t('eventForm.changeCover')}
                  </span>
                </button>
                <Input
                  label={t('eventForm.name')}
                  value={f.title}
                  onInput={(v) =>
                    upd({
                      title: v.slice(0, 80),
                    })
                  }
                  maxLength={80}
                  counter
                  error={f.errors.title}
                  action="MGT-05.title"
                  autofocus
                />
                <Input
                  label={t('eventForm.desc')}
                  multiline
                  rows={5}
                  value={f.desc}
                  onInput={(v) =>
                    upd({
                      desc: v.slice(0, 1000),
                    })
                  }
                  maxLength={1000}
                  counter
                  action="MGT-05.desc"
                />
                <div className="col gap8">
                  <span className="field-label">{t('eventForm.type')}</span>
                  <div className="row wrap gap8">
                    {EVENT_TYPES.map((ty) => (
                      <Chip
                        key={ty}
                        label={t('eventType.' + ty)}
                        selected={f.type === ty}
                        action={'MGT-05.type.' + ty}
                        onClick={() =>
                          upd({
                            type: ty,
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            {f.step === 2
              ? <>{<div className="row gap8">
                    <div className="flex1">
                      <Picker
                        label={t('eventForm.startDate')}
                        icon="calendar"
                        value={app.fmt.dateShort(f.startsAt)}
                        error={f.errors.start}
                        action="MGT-05.startDate"
                        onClick={() =>
                          app.openSheet('SHT-28', {
                            value: f.startsAt,
                            min: editing ? null : Date.now(),
                            onSelect: (ts) => setDate('startsAt', ts),
                          })
                        }
                      />
                    </div>
                    <div
                      style={{
                        width: '120px',
                      }}
                    >
                      <Picker
                        label={t('eventForm.time')}
                        icon="clock"
                        value={app.fmt.time(f.startsAt)}
                        action="MGT-05.startTime"
                        onClick={() =>
                          app.openSheet('SHT-29', {
                            value: app.fmt.time(f.startsAt),
                            onSelect: (v) => setTime('startsAt', v),
                          })
                        }
                      />
                    </div>
                  </div>}{<div className="row gap8">
                    <div className="flex1">
                      <Picker
                        label={t('eventForm.endDate')}
                        icon="calendar"
                        value={app.fmt.dateShort(f.endsAt)}
                        error={f.errors.end}
                        action="MGT-05.endDate"
                        onClick={() =>
                          app.openSheet('SHT-28', {
                            value: f.endsAt,
                            min: f.startsAt,
                            onSelect: (ts) => setDate('endsAt', ts),
                          })
                        }
                      />
                    </div>
                    <div
                      style={{
                        width: '120px',
                      }}
                    >
                      <Picker
                        label={t('eventForm.time')}
                        icon="clock"
                        value={app.fmt.time(f.endsAt)}
                        action="MGT-05.endTime"
                        onClick={() =>
                          app.openSheet('SHT-29', {
                            value: app.fmt.time(f.endsAt),
                            onSelect: (v) => setTime('endsAt', v),
                          })
                        }
                      />
                    </div>
                  </div>}{conflicts ? (
                    <Banner
                      kind="info"
                      icon="calendar-days"
                      text={t('eventForm.conflict', {
                        count: conflicts,
                      })}
                      card
                    />
                  ) : null}{<Picker
                    label={t('eventForm.place')}
                    icon="map-pin"
                    value={f.placeId ? t('place.' + f.placeId) : f.placeText || ''}
                    placeholder={t('common.select')}
                    error={f.errors.place}
                    action="MGT-05.place"
                    onClick={() =>
                      app.openSheet('SHT-30', {
                        value: f.placeId,
                        text: f.placeText,
                        onSelect: (id, text) =>
                          upd({
                            placeId: id,
                            placeText: text,
                            errors: {
                              ...f.errors,
                              place: null,
                            },
                          }),
                      })
                    }
                  />}{<div className="col gap8">
                    <div className="row between">
                      <span className="field-label">{t('eventForm.capacity')}</span>
                      <span className="row gap8">
                        <span className="t-body-s c-sec">{t('eventForm.unlimited')}</span>
                        <Switch
                          checked={f.unlimited}
                          onChange={(v) =>
                            upd({
                              unlimited: v,
                            })
                          }
                          action="MGT-05.unlimited"
                          label={t('eventForm.unlimited')}
                        />
                      </span>
                    </div>
                    {!f.unlimited
                      ? <>{<div
                            className="row gap12"
                            style={{
                              justifyContent: 'center',
                            }}
                          >
                            <IconButton
                              icon="minus"
                              label={t('eventForm.decrease')}
                              action="MGT-05.capacity.minus"
                              onClick={() =>
                                upd({
                                  capacity: Math.max(1, f.capacity - 5),
                                })
                              }
                              style={{
                                background: 'var(--bg-surface-muted)',
                              }}
                            />
                            <span
                              className="kpi-value tnum"
                              style={{
                                minWidth: '64px',
                                textAlign: 'center',
                              }}
                            >
                              {f.capacity}
                            </span>
                            <IconButton
                              icon="plus"
                              label={t('eventForm.increase')}
                              action="MGT-05.capacity.plus"
                              onClick={() =>
                                upd({
                                  capacity: Math.min(1000, f.capacity + 5),
                                })
                              }
                              style={{
                                background: 'var(--bg-surface-muted)',
                              }}
                            />
                          </div>}{f.errors.capacity ? (
                            <div className="field-help is-error" role="alert">
                              <Icon name="triangle-alert" size={14} />
                              <span>{f.errors.capacity}</span>
                            </div>
                          ) : editing ? (
                            <span className="t-caption center">
                              {t('eventForm.registeredNow', {
                                count: registered,
                              })}
                            </span>
                          ) : null}</>
                      : null}
                  </div>}{<div className="col gap8">
                    <span className="field-label">{t('eventForm.visibility')}</span>
                    <Segmented
                      options={[
                        {
                          id: 'public',
                          label: t('event.visibility.public'),
                          icon: 'globe',
                        },
                        {
                          id: 'members',
                          label: t('event.visibility.members'),
                          icon: 'lock',
                        },
                      ]}
                      value={f.visibility}
                      onChange={(v) =>
                        upd({
                          visibility: v,
                        })
                      }
                      action="MGT-05.visibility"
                    />
                    <span className="t-caption">{t('eventForm.visibilityHelp.' + f.visibility)}</span>
                  </div>}{<div className="row between">
                    <div className="col">
                      <span className="t-body-m">{t('eventForm.autoReminder')}</span>
                      <span className="t-caption">{t('eventForm.autoReminderHelp')}</span>
                    </div>
                    <Switch
                      checked={f.autoReminder}
                      onChange={(v) =>
                        upd({
                          autoReminder: v,
                        })
                      }
                      action="MGT-05.autoReminder"
                      label={t('eventForm.autoReminder')}
                    />
                  </div>}</>
              : null}
            {f.step === 3 ? (
              <>
                <Banner kind="info" icon="eye" text={t('eventForm.previewNote')} card />
                <EventCard ev={preview} screen="MGT-05" showClub={false} />
                <Card>
                  {[
                    [t('eventForm.name'), f.title],
                    [t('eventForm.type'), t('eventType.' + f.type)],
                    [t('eventForm.startDate'), app.fmt.dateTime(f.startsAt)],
                    [t('eventForm.endDate'), app.fmt.dateTime(f.endsAt)],
                    [t('eventForm.place'), f.placeId ? t('place.' + f.placeId) : f.placeText],
                    [t('eventForm.capacity'), f.unlimited ? t('eventForm.unlimited') : String(f.capacity)],
                    [t('eventForm.visibility'), f.visibility === 'public' ? t('event.visibility.public') : t('event.visibility.members')],
                  ].map(([k, v], i) => <Fragment key={k}>{i ? <div className="divider" /> : null}{<div
                      
                      className="row between"
                      style={{
                        padding: '10px 16px',
                      }}
                    >
                      <span className="t-body-s c-muted">{k}</span>
                      <span
                        className="t-body-s c-heading right"
                        style={{
                          maxWidth: '60%',
                        }}
                      >
                        {v}
                      </span>
                    </div>}</Fragment>)}
                </Card>
              </>
            ) : null}
          </div>
        </Scroll>
        <StickyCTA>
          {f.step > 1 ? (
            <Button
              variant="outline"
              label={t('common.back')}
              action="MGT-05.back"
              onClick={() =>
                set({
                  step: f.step - 1,
                })
              }
            />
          ) : null}
          {f.step < 3 ? (
            <Button
              label={t('common.continue')}
              action="MGT-05.next"
              onClick={() =>
                validate() &&
                set({
                  step: f.step + 1,
                })
              }
            />
          ) : (
            <>
              {!editing || editing.status === 'draft' ? <Button variant="outline" label={t('eventForm.saveDraft')} disabled={busy} action="MGT-05.saveDraft" onClick={saveDraft} /> : null}
              <Button
                label={editing && editing.status === 'published' ? t('common.save') : t('eventForm.publish')}
                loading={busy}
                action="MGT-05.publish"
                onClick={publish}
              />
            </>
          )}
        </StickyCTA>
      </>
    );
  },
};

/* MGT-06 attendance */
S['MGT-06'] = {
  tab: 'clubs',
  title: 'attendance.title',
  comp: function Attendance({ params, route }: any) {
    const { u, club, readOnly, allowed, loading } = useMgt(params);
    const ev = sel().event(params.eventId);
    const [filter, setFilter] = useState('all');
    const [q, setQ] = useState('');
    const [menu, setMenu] = useState<any>(null);
    const evLoad = useLoader(LD.eventLoader(params.eventId));
    useLoader(allowed ? LD.clubEventsLoader(club.id) : null);
    const live = useParticipantsLive(allowed && ev ? ev.id : null, ev ? ev.clubId : null);
    const [exporting, runExport] = useBusy();
    if (!ev && evLoad.status === 'error') return <NotFoundInline />;
    if (!allowed || !ev) return <NoAccess loading={loading || !ev} screen="MGT-06" />;
    void u;
    const rs = sel()
      .eventRsvps(ev.id)
      .filter((r) => r.status !== 'cancelled')
      .map((r) => ({
        ...r,
        user: (sel().user(r.userId) || { id: r.userId, name: t('common.deletedUser'), avatarSeed: r.userId }) as any,
      }));
    const reg = rs.filter((r) => r.status === 'going' || r.status === 'attended');
    const att = rs.filter((r) => r.status === 'attended');
    const wl = rs.filter((r) => r.status === 'waitlist').sort((a, b) => (a.waitlistAt || a.createdAt) - (b.waitlistAt || b.createdAt));
    const rate = reg.length ? Math.round((att.length / reg.length) * 100) : 0;
    const list = reg
      .filter((r) => filter === 'all' || (filter === 'attended' && r.status === 'attended') || (filter === 'absent' && r.status === 'going'))
      .filter((r) => !q || trLower(r.user.name).includes(trLower(q)))
      .sort((a, b) => a.user.name.localeCompare(b.user.name, 'tr'));
    const mark = (r: any, v: boolean) => {
      if (!app.guard(club.id)) return;
      A.setAttended(ev, r.userId, v)
        .then(() =>
          app.toast('TST-31', {
            name: r.user.name,
            undo: () => A.setAttended(ev, r.userId, !v).catch(handleError),
          }),
        )
        .catch(handleError);
    };
    const exportCsv = () =>
      runExport(async () => {
        const emails = await Promise.all(rs.map((r) => M.readContact(club.id, r.userId).catch(() => null)));
        downloadText(
          '\ufeff' +
            [['ad', 'eposta', 'durum', 'bilet', 'okutma']]
              .concat(rs.map((r, i) => [r.user.name, emails[i] || '', t('status.' + r.status), r.ticketCode || '', r.scannedAt ? new Date(r.scannedAt).toISOString() : '']))
              .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
              .join('\n'),
          slug(ev.title) + '-katilimcilar.csv',
          'text/csv;charset=utf-8',
        );
        app.toast('TST-29');
      });
    const clubEvents = sel()
      .clubEvents(club.id)
      .filter((e) => e.status !== 'draft')
      .sort((a, b) => b.startsAt - a.startsAt);
    return <>{<AppBar
        onBack={() => app.nav.back()}
        backAction="MGT-06.back"
        titleNode={
          <div className="col">
            <span className="t-caption">
              {t('attendance.title')}
              {' \xB7 '}
              {club.name}
            </span>
            <button
              type="button"
              className="row gap4 t-title-s"
              style={{
                textAlign: 'left',
              }}
              data-action="MGT-06.switchEvent"
              onClick={() => setMenu('events')}
            >
              <span
                className="ellipsis"
                style={{
                  maxWidth: '180px',
                }}
              >
                {ev.title}
              </span>
              <Icon name="chevron-down" size={16} />
            </button>
          </div>
        }
      >
        {readOnly ? null : (
          <IconButton
            icon="scan-line"
            label={t('event.cta.scan')}
            brand
            action="MGT-06.scan"
            onClick={() =>
              app.nav.push('MGT-07', {
                clubId: club.id,
                eventId: ev.id,
              })
            }
          />
        )}
        <IconButton icon="more-vertical" label={t('a11y.more')} action="MGT-06.menu" onClick={() => setMenu('top')} />
      </AppBar>}{<ROBanner readOnly={readOnly} />}{ev.startsAt > Date.now() ? <Banner kind="info" text={t('attendance.notStarted')} /> : null}{<div className="hscroll py8">
        {[
          ['all', t('attendance.registered'), reg.length],
          ['attended', t('status.attended'), att.length],
          ['absent', t('attendance.absent'), reg.length - att.length],
          ['waitlist', t('status.waitlist'), wl.length],
        ].map(([id, l, n]) => (
          <Chip key={id} label={`${l} ${n}`} selected={filter === id} action={'MGT-06.summary.' + id} onClick={() => setFilter(String(id))} />
        ))}
      </div>}{<div className="px16 col gap8 pb16">
        <div className="row gap8">
          <Progress value={rate} max={100} kind="success" label={t('attendance.rate')} />
          <span className="t-label-m tnum">
            {t('attendance.rate')}
            {' %'}
            {rate}
          </span>
        </div>
        <Input icon="search" placeholder={t('members.search')} value={q} onInput={setQ} action="MGT-06.search" ariaLabel={t('members.search')} />
      </div>}{<Scroll routeKey={route.key}>
        <ListState
          status={live}
          n={5}
          emptyProps={{
            illustration: 'empty-applications',
            title: t('attendance.empty'),
          }}
        >
          {filter !== 'waitlist' ? (
            list.length ? (
              list.map((r) => (
                <div key={r.userId} className="tile is-plain">
                  <Avatar user={r.user} size={40} />
                  <span className="tile-text">
                    <span
                      className="t-body-m c-heading"
                      style={{
                        display: 'block',
                      }}
                    >
                      {r.user.name}
                    </span>
                    <span className="t-caption">{deptYear(r.user)}</span>
                  </span>
                  <StatusBadge
                    status={r.status === 'attended' ? 'attended' : 'going'}
                    label={r.status === 'attended' ? t('status.attended') : t('attendance.registeredOne')}
                  />
                  <Switch
                    checked={r.status === 'attended'}
                    onChange={(v: boolean) => mark(r, v)}
                    action={'MGT-06.attended.' + r.userId}
                    label={t('status.attended')}
                    disabled={readOnly}
                    onDisabledClick={() => app.toast('TST-26')}
                  />
                </div>
              ))
            ) : (
              <EmptyState illustration="empty-applications" title={q ? t('members.noResults') : t('attendance.empty')} compact />
            )
          ) : null}
          {filter === 'all' || filter === 'waitlist'
            ? <>{<div className="group-head">
                  <span className="t-overline">{t('status.waitlist')}</span>
                  <span className="t-caption tnum">{wl.length}</span>
                </div>}{wl.length ? (
                  wl.map((r, i) => (
                    <div key={r.userId} className="tile is-plain">
                      <span
                        className="badge-count"
                        style={{
                          background: 'var(--text-muted)',
                        }}
                      >
                        {i + 1}
                      </span>
                      <Avatar user={r.user} size={36} />
                      <span className="tile-text">
                        <span
                          className="t-body-m c-heading"
                          style={{
                            display: 'block',
                          }}
                        >
                          {r.user.name}
                        </span>
                        <span className="t-caption">{deptYear(r.user)}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="tonal"
                        label={t('attendance.promote')}
                        disabled={(ev.capacity != null && reg.length >= ev.capacity) || readOnly}
                        action={'MGT-06.promote.' + r.userId}
                        onClick={() => {
                          if (!app.guard(club.id)) return;
                          A.promote(ev, r.userId)
                            .then(() =>
                              app.toast('TST-X13', {
                                name: r.user.name,
                              }),
                            )
                            .catch(handleError);
                        }}
                        onDisabledClick={() => app.toast(readOnly ? 'TST-26' : 'TST-X14')}
                      />
                    </div>
                  ))
                ) : (
                  <p className="t-body-s c-muted px16 pb16">{t('attendance.noWaitlist')}</p>
                )}</>
            : null}
        </ListState>
      </Scroll>}{menu === 'top' ? (
        <PopMenu id="MGT-06" onClose={() => setMenu(null)}>
          <Tile
            title={exporting ? t('common.loading') : t('mgtMembers.export')}
            leading={<Icon name="download" size={20} />}
            action="MGT-06.export"
            onClick={() => {
              setMenu(null);
              exportCsv();
            }}
          />
          <Tile
            title={t('attendance.markAll')}
            leading={<Icon name="check-check" size={20} />}
            disabled={readOnly}
            action="MGT-06.markAll"
            onClick={() => {
              setMenu(null);
              if (!app.guard(club.id)) return;
              app.openDialog('DLG-17', {
                kind: 'attendance',
                count: reg.length,
                onConfirm: async () => {
                  await A.markAllAttended(ev);
                  app.closeDialog();
                  app.toast('TST-31', {
                    name: t('attendance.allRegistered'),
                  });
                },
              });
            }}
          />
          <Tile
            title={ev.registrationOpen ? t('attendance.closeReg') : t('attendance.openReg')}
            leading={<Icon name={ev.registrationOpen ? 'lock' : 'lock-open'} size={20} />}
            disabled={readOnly}
            action="MGT-06.toggleRegistration"
            onClick={() => {
              setMenu(null);
              if (!app.guard(club.id)) return;
              A.toggleRegistration(ev)
                .then(() =>
                  app.toast('TST-X15', {
                    open: !ev.registrationOpen,
                  }),
                )
                .catch(handleError);
            }}
          />
        </PopMenu>
      ) : null}{menu === 'events' ? (
        <PopMenu id="MGT-06" onClose={() => setMenu(null)}>
          {clubEvents.map((e) => (
            <Tile
              key={e.id}
              title={e.title}
              subtitle={app.fmt.dateShort(e.startsAt)}
              trailing={e.id === ev.id ? <Icon name="check" size={18} class="c-brand" /> : null}
              action={'MGT-06.switchEvent.' + e.id}
              onClick={() => {
                setMenu(null);
                app.nav.replace('MGT-06', {
                  clubId: club.id,
                  eventId: e.id,
                });
              }}
            />
          ))}
        </PopMenu>
      ) : null}</>;
  },
};

/* MGT-07 scanner */
/** Kamera + jsQR ile QR okuma. Kamera yoksa/izin verilmezse elle kod girişi. */
function useQrCamera(active: boolean, front: boolean, onCode: (data: string) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<'starting' | 'on' | 'denied' | 'unavailable'>('starting');
  const [torchOk, setTorchOk] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const cb = useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    if (!active) return;
    let stop = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return setState('unavailable');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: front ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (e: any) {
        return setState(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'unavailable');
      }
      if (stop) return stream.getTracks().forEach((t) => t.stop());
      const v = videoRef.current!;
      v.srcObject = stream;
      v.setAttribute('playsinline', 'true');
      await v.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const caps: any = track.getCapabilities ? track.getCapabilities() : {};
      setTorchOk(!!caps.torch);
      setState('on');
      const jsQR = (await import('jsqr')).default;
      const tick = () => {
        if (stop) return;
        if (v.readyState >= 2 && ctx && v.videoWidth) {
          const w = 480;
          const h = Math.round((v.videoHeight / v.videoWidth) * w);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const r = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
          if (r && r.data) cb.current(r.data);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
    };
  }, [active, front]);
  const setTorch = (on: boolean) => {
    const tr: any = trackRef.current;
    if (tr && tr.applyConstraints) tr.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {});
  };
  return { videoRef, state, torchOk, setTorch };
}
S['MGT-07'] = {
  tab: 'clubs',
  title: 'scan.title',
  comp: function Scanner({ params }: any) {
    const { readOnly, allowed, loading } = useMgt(params);
    const ev = sel().event(params.eventId);
    const evLoad = useLoader(LD.eventLoader(params.eventId));
    const [torch, setTorch] = useState(false);
    const [front, setFront] = useState(false);
    const [manual, setManual] = useState(false);
    const [code, setCode] = useState('');
    const busy = useRef(false);
    const last = useRef<{ data: string; at: number }>({ data: '', at: 0 });
    const sheetOpen = ui.sheets.some((x) => x.id === 'SHT-24');
    const handle = async (input: string) => {
      if (!ev || busy.current) return;
      busy.current = true;
      try {
        const r = await A.scanTicket(ev, input);
        if (navigator.vibrate) navigator.vibrate(r.outcome === 'valid' ? 60 : [40, 60, 40]);
        if (r.rsvp) void loadUsers([r.rsvp.userId]);
        if (r.outcome === 'valid')
          app.openSheet('SHT-24', {
            kind: 'valid',
            userId: r.rsvp!.userId,
            eventId: ev.id,
            undo: () => A.setAttended(ev, r.rsvp!.userId, false).catch(handleError),
          });
        else if (r.outcome === 'alreadyScanned')
          app.openSheet('SHT-24', { kind: 'used', userId: r.rsvp!.userId, scannedAt: r.rsvp!.scannedAt, eventId: ev.id });
        else app.openSheet('SHT-24', { kind: 'invalid', reason: r.rsvp ? 'other' : 'none' });
      } catch (e) {
        handleError(e);
      } finally {
        busy.current = false;
      }
    };
    const cam = useQrCamera(!!ev && allowed && !readOnly && !manual, front, (data) => {
      if (sheetOpen || busy.current) return;
      const now = Date.now();
      if (data === last.current.data && now - last.current.at < 4000) return;
      last.current = { data, at: now };
      void handle(data);
    });
    if (!ev && evLoad.status === 'error') return <NotFoundInline />;
    if (!allowed || !ev || readOnly) return <NoAccess loading={loading || !ev} screen="MGT-07" />;
    const att = ev.attendedCount || 0;
    const reg = sel().registeredCount(ev);
    const verify = () => {
      const c = code.trim().toUpperCase();
      if (!c) return;
      void handle(c).then(() => setCode(''));
    };
    const header = (
      <div
        className="row gap4"
        style={{
          padding: '4px 8px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <IconButton onCover icon="x" label={t('a11y.close')} action="MGT-07.close" onClick={() => app.nav.back()} />
        <div
          className="flex1 col"
          style={{
            padding: '0 8px',
          }}
        >
          <span
            className="t-title-s ellipsis"
            style={{
              color: '#fff',
            }}
          >
            {ev.title}
          </span>
          <span
            className="t-caption"
            style={{
              color: 'rgba(255,255,255,.7)',
            }}
          >
            {t('scan.counter', {
              a: att,
              b: reg,
            })}
          </span>
        </div>
        {cam.torchOk ? (
          <IconButton
            onCover
            icon="flashlight"
            label={t('scan.torch')}
            action="MGT-07.torch"
            onClick={() => {
              cam.setTorch(!torch);
              setTorch(!torch);
            }}
            style={sx(
              torch
                ? {
                    background: '#fff',
                    color: '#000',
                  }
                : undefined,
            )}
          />
        ) : null}
        <IconButton onCover icon="switch-camera" label={t('scan.flip')} action="MGT-07.flip" onClick={() => setFront(!front)} />
      </div>
    );
    const manualBox = (
      <div
        className="row gap8"
        style={{
          alignItems: 'flex-end',
        }}
      >
        <div
          className="flex1"
          style={{
            color: 'var(--text-primary)',
          }}
        >
          <Input
            label={t('scan.enterCode')}
            value={code}
            onInput={(v: string) => setCode(v.toUpperCase().slice(0, 12))}
            placeholder="GU-XXXX-XXXX"
            action="MGT-07.codeInput"
            autofocus
            onEnter={verify}
          />
        </div>
        <Button label={t('scan.verify')} action="MGT-07.verify" onClick={verify} disabled={code.trim().length < 12} onDisabledClick={() => {}} />
      </div>
    );
    if (cam.state === 'denied' || cam.state === 'unavailable')
      return (
        <div
          className="scan-view"
          style={{
            paddingTop: 'var(--safe-top)',
          }}
        >
          {header}
          <div
            className="empty flex1"
            style={{
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <Icon name="camera-off" size={64} />
            <h2
              className="t-title-m"
              style={{
                color: '#fff',
              }}
            >
              {cam.state === 'denied' ? t('scan.permissionTitle') : t('web.scan.noCamera')}
            </h2>
            <p
              className="t-body-s"
              style={{
                color: 'rgba(255,255,255,.7)',
              }}
            >
              {cam.state === 'denied' ? t('web.scan.permissionDesc') : t('web.scan.noCameraDesc')}
            </p>
          </div>
          <div
            className="col gap12"
            style={{
              padding: '16px 16px calc(var(--safe-bottom) + 16px)',
              background: 'rgba(0,0,0,.35)',
            }}
          >
            {manualBox}
          </div>
        </div>
      );
    return (
      <div
        className="scan-view"
        style={{
          paddingTop: 'var(--safe-top)',
        }}
      >
        {!manual ? (
          <video
            ref={cam.videoRef}
            muted
            playsInline
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: front ? 'scaleX(-1)' : 'none',
              opacity: cam.state === 'on' ? 0.9 : 0,
            }}
          />
        ) : null}
        {header}
        <div
          className="flex1 col"
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div className="scan-box">
            <i />
            <i />
            <i />
            <i />
            {cam.state === 'on' && !manual ? <span className="scanline" /> : null}
          </div>
          <p
            className="t-body-s center"
            style={{
              color: 'rgba(255,255,255,.85)',
              maxWidth: '260px',
              textShadow: '0 1px 4px rgba(0,0,0,.6)',
            }}
          >
            {manual ? t('web.scan.manualHint') : cam.state === 'starting' ? t('web.scan.starting') : t('scan.hint')}
          </p>
        </div>
        <div
          className="col gap12"
          style={{
            padding: '16px 16px calc(var(--safe-bottom) + 16px)',
            background: 'rgba(0,0,0,.45)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {manual ? (
            <>
              {manualBox}
              <Button
                variant="text"
                icon="camera"
                label={t('web.scan.useCamera')}
                action="MGT-07.useCamera"
                onClick={() => setManual(false)}
                style={{ color: '#fff' }}
              />
            </>
          ) : (
            <Button
              variant="outline"
              icon="pencil"
              label={t('scan.manualCode')}
              action="MGT-07.manualCode"
              onClick={() => setManual(true)}
              style={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,.4)',
                background: 'transparent',
              }}
            />
          )}
        </div>
      </div>
    );
  },
};

/* MGT-08 content */
S['MGT-08'] = {
  tab: 'clubs',
  title: 'content.title',
  comp: function Content({ params, route }: any) {
    const { u, club, readOnly, allowed, loading } = useMgt(params);
    const [tab, setTab] = useState(params.tab || 'posts');
    const [q, setQ] = useState('');
    const [menu, setMenu] = useState<any>(null);
    const postsLoad = useLoader(allowed ? LD.mgtPostsLoader(club.id) : null);
    if (!allowed) return <NoAccess loading={loading} screen="MGT-08" />;
    void u;
    const ids: string[] = db.extra['mgtPosts:' + club.id] || [];
    const known = new Set(ids);
    const posts = [...ids.map((id) => db.posts[id]), ...sel().allPostsOf(club.id).filter((p) => !known.has(p.id))]
      .filter((p) => p && !p.isDeleted)
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt - a.createdAt)
      .filter((p) => (tab === 'posts' ? p.type === 'post' : tab === 'announcements' ? p.type === 'announcement' : p.type === 'poll'))
      .filter((p) => !q || trLower((p.title || '') + ' ' + p.text).includes(trLower(q)));
    const pin = (p: any) => {
      if (!app.guard(club.id)) return;
      A.setPinned(p, !p.pinned)
        .then(() =>
          app.toast('TST-53', {
            pinned: !p.pinned,
          }),
        )
        .catch(handleError);
    };
    return <>{<MgtHeader club={club} title={t('content.title')} screen="MGT-08" />}{<ROBanner readOnly={readOnly} />}{<div className="px16 pb16 col gap8">
        <Segmented
          options={[
            {
              id: 'posts',
              label: t('content.tab.posts'),
            },
            {
              id: 'announcements',
              label: t('content.tab.announcements'),
            },
            {
              id: 'polls',
              label: t('content.tab.polls'),
            },
          ]}
          value={tab}
          onChange={setTab}
          action="MGT-08.tab"
        />
        <Input icon="search" placeholder={t('common.search')} value={q} onInput={setQ} action="MGT-08.search" ariaLabel={t('common.search')} />
      </div>}{<Scroll routeKey={route.key} onRefresh={postsLoad.reload} refreshAction="MGT-08.refresh">
        <ListState
          status={postsLoad.status !== 'ok' && posts.length ? 'ok' : postsLoad.status}
          onRetry={postsLoad.reload}
          n={4}
          emptyProps={{
            illustration: 'empty-posts',
            title: t('content.empty'),
          }}
        >
          {posts.length ? (
            posts.map((p) => {
              return (
                <Tile
                  key={p.id}
                  leading={
                    <span className={cx('notif-icon', p.type === 'announcement' ? 'ni-brand' : p.type === 'poll' ? 'ni-info' : 'ni-neutral')}>
                      <Icon name={p.type === 'announcement' ? 'megaphone' : p.type === 'poll' ? 'chart-column' : 'file-text'} size={18} />
                    </span>
                  }
                  title={
                    <span className="row gap6">
                      {p.pinned ? <Icon name="pin" size={14} class="c-brand" /> : null}
                      <span className="clamp1">{p.title || p.text}</span>
                    </span>
                  }
                  subtitle={`${app.fmt.rel(p.createdAt)} · ${t('content.stats', {
                    likes: p.likeCount || 0,
                    comments: p.commentCount || 0,
                  })}${p.isHidden ? ' · ' + t('content.hidden') : ''}`}
                  action={'MGT-08.row.' + p.id}
                  onClick={() =>
                    app.nav.push('FED-02', {
                      clubId: club.id,
                      postId: p.id,
                    })
                  }
                  trailing={
                    <IconButton
                      icon="more-vertical"
                      label={t('a11y.more')}
                      action={'MGT-08.menu.' + p.id}
                      onClick={(e: any) => {
                        e.stopPropagation();
                        setMenu(p);
                      }}
                    />
                  }
                />
              );
            })
          ) : (
            <EmptyState illustration="empty-posts" title={t('content.empty')} />
          )}
        </ListState>
      </Scroll>}{readOnly ? null : (
        <button
          type="button"
          className="fab"
          aria-label={t('compose.title')}
          data-action="MGT-08.create"
          onClick={() =>
            app.nav.push('FED-03', {
              clubId: club.id,
            })
          }
        >
          <Icon name="plus" size={22} />
          {t('feed.type.post')}
        </button>
      )}{menu ? (
        <PopMenu id="MGT-08" onClose={() => setMenu(null)}>
          <Tile
            title={menu.pinned ? t('post.unpin') : t('post.pin')}
            leading={<Icon name={menu.pinned ? 'pin-off' : 'pin'} size={20} />}
            disabled={readOnly}
            action={'MGT-08.pin.' + menu.id}
            onClick={() => {
              setMenu(null);
              pin(menu);
            }}
          />
          <Tile
            title={t('common.edit')}
            leading={<Icon name="pencil" size={20} />}
            disabled={readOnly}
            action={'MGT-08.edit.' + menu.id}
            onClick={() => {
              setMenu(null);
              if (!app.guard(club.id)) return;
              app.nav.push('FED-03', {
                clubId: club.id,
                edit: menu.id,
              });
            }}
          />
          <Tile
            title={t('common.delete')}
            danger
            leading={<Icon name="trash-2" size={20} />}
            disabled={readOnly}
            action={'MGT-08.delete.' + menu.id}
            onClick={() => {
              setMenu(null);
              if (!app.guard(club.id)) return;
              app.openDialog('DLG-10', {
                postId: menu.id,
              });
            }}
          />
        </PopMenu>
      ) : null}</>;
  },
};

/* MGT-09 club settings */
S['MGT-09'] = {
  tab: 'clubs',
  title: 'clubSettings.title',
  comp: function ClubSettings({ params }: any) {
    const { u, club, readOnly, allowed, loading } = useMgt(params);
    const [busy, run] = useBusy();
    const [logoBusy, runLogo] = useBusy();
    if (!allowed) return <NoAccess loading={loading} screen="MGT-09" />;
    void u;
    const social: any = club.social || {};
    const [f, set, reset] = useForm('clubSettings-' + club.id, {
      categoryId: club.categoryId,
      summary: club.summary || '',
      about: club.about || '',
      email: social.email || '',
      instagram: social.instagram || '',
      web: social.web || '',
      applicationsOpen: club.applicationsOpen,
      approvalRequired: club.approvalRequired,
      requireNote: !!club.requireNote,
      cover: {
        palette: club.palette,
        pattern: club.pattern,
        seed: club.coverSeed,
        path: club.coverPath || null,
      },
      errors: {},
      dirty: false,
    });
    const upd = (p: any) => {
      if (readOnly) {
        app.toast('TST-26');
        return;
      }
      set({
        ...p,
        dirty: true,
      });
    };
    const ro = () => app.toast('TST-26');
    const back = () => {
      if (f.dirty)
        app.openDialog('DLG-25', {
          onSave: () => {
            app.closeDialog();
            save();
          },
          onDiscard: () => {
            app.closeDialog();
            reset();
            app.nav.back();
          },
          onKeep: () => app.closeDialog(),
        });
      else {
        reset();
        app.nav.back();
      }
    };
    const save = () =>
      run(async () => {
        const e: any = {};
        if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = t('auth.err.email');
        if (f.instagram && !/^@?[\w.]{2,30}$/.test(f.instagram)) e.instagram = t('clubSettings.err.instagram');
        if (f.web && !/^https?:\/\/.+\..+/.test(f.web)) e.web = t('clubSettings.err.web');
        set({
          errors: e,
        });
        if (Object.keys(e).length) return;
        if (!app.guard(club.id)) return;
        const wasOpen = club.applicationsOpen;
        let coverPath: string | null = f.cover.path || null;
        if (f.cover.file) {
          const { prepareImage, upload, StoragePaths } = await import('../data/repo/storage');
          coverPath = await upload(StoragePaths.club(club.id), await prepareImage(f.cover.file, 1600));
        }
        await A.updateClubSettings(club.id, {
          summary: f.summary.trim(),
          about: f.about.trim(),
          social: {
            email: f.email.trim() || null,
            instagram: !f.instagram.trim() ? null : f.instagram.trim().startsWith('@') ? f.instagram.trim() : '@' + f.instagram.trim(),
            web: f.web.trim() || null,
          },
          applicationsOpen: f.applicationsOpen,
          approvalRequired: f.approvalRequired,
          requireNote: f.requireNote,
          palette: f.cover.palette,
          pattern: f.cover.pattern,
          coverSeed: f.cover.seed,
          coverPath,
        });
        reset();
        app.toast('TST-21');
        if (wasOpen !== f.applicationsOpen)
          setTimeout(
            () =>
              app.toast('TST-54', {
                open: f.applicationsOpen,
              }),
            1200,
          );
      });
    const adv: any = club.advisor;
    const advisor = adv ? sel().user(adv.userId) || { id: adv.userId || 'advisor', name: adv.name, avatarSeed: adv.name } : null;
    return (
      <>
        <MgtHeader club={club} title={t('clubSettings.title')} screen="MGT-09" back={back} />
        <ROBanner readOnly={readOnly} />
        <Scroll routeKey={'clubsettings-' + club.id}>
          <div className="col gap20 px16 pt8 pb24">
            <div className="col gap8">
              <span className="t-overline">{t('clubSettings.group.look')}</span>
              <div className="row gap12">
                <button
                  type="button"
                  className="emblem"
                  data-action="MGT-09.logo"
                  style={{ position: 'relative', overflow: 'hidden', padding: 0 }}
                  onClick={() =>
                    readOnly
                      ? ro()
                      : app.openSheet('SHT-16', {
                          hasPhoto: !!club.logoPath,
                          onRemove: () =>
                            runLogo(async () => {
                              await A.updateClubSettings(club.id, { logoPath: null });
                              app.toast('TST-57');
                            }),
                          onPick: (file: File) =>
                            runLogo(async () => {
                              await A.uploadClubImage(club.id, file, 'logo');
                              app.toast('TST-57');
                            }),
                        })
                  }
                  aria-label={t('clubSettings.logo')}
                  aria-busy={logoBusy ? 'true' : undefined}
                >
                  <ClubEmblem club={club} size={30} style={{ width: '100%', height: '100%', border: 0 }} />
                </button>
                <button
                  type="button"
                  className="cover r16-9 flex1"
                  style={{
                    borderRadius: '16px',
                    position: 'relative',
                    height: '72px',
                    aspectRatio: 'auto',
                  }}
                  data-action="MGT-09.cover"
                  onClick={() =>
                    readOnly
                      ? ro()
                      : app.openSheet('SHT-31', {
                          value: f.cover,
                          icon: club.iconName,
                          onSelect: (c: any) =>
                            upd({
                              cover: c.file ? { ...c, path: null, url: URL.createObjectURL(c.file) } : { ...c, path: null, file: null, url: null },
                            }),
                        })
                  }
                  aria-label={t('clubSettings.cover')}
                >
                  {f.cover.url ? (
                    <img src={f.cover.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Cover seed={f.cover.seed} icon={club.iconName} palette={f.cover.palette} pattern={f.cover.pattern} path={f.cover.path} style={{ position: 'absolute', inset: 0, height: '100%' }} />
                  )}
                  <span
                    className="badge badge-neutral"
                    style={{
                      position: 'absolute',
                      right: '8px',
                      bottom: '8px',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    {t('clubSettings.cover')}
                  </span>
                </button>
              </div>
            </div>
            <div className="col gap12">
              <span className="t-overline">{t('clubSettings.group.info')}</span>
              <div
                role="button"
                tabIndex={0}
                data-action="MGT-09.lockedName"
                onClick={() => app.toast('TST-20')}
                onKeyDown={(e) => e.key === 'Enter' && app.toast('TST-20')}
              >
                <Input label={t('clubSettings.name')} value={club.name} locked help={t('clubSettings.nameLocked')} action="MGT-09.name" />
              </div>
              <Picker
                label={t('clubSettings.category')}
                icon="layout-grid"
                value={t('cat.' + f.categoryId)}
                action="MGT-09.category"
                onClick={() => app.toast('TST-20')}
              />
              <Input
                label={t('clubSettings.summary')}
                value={f.summary}
                onInput={(v) =>
                  upd({
                    summary: v.slice(0, 160),
                  })
                }
                maxLength={160}
                counter
                action="MGT-09.summary"
                disabled={readOnly}
              />
              <Input
                label={t('clubSettings.about')}
                multiline
                rows={5}
                value={f.about}
                onInput={(v) =>
                  upd({
                    about: v.slice(0, 1000),
                  })
                }
                maxLength={1000}
                counter
                action="MGT-09.about"
                disabled={readOnly}
              />
            </div>
            <div className="col gap12">
              <span className="t-overline">{t('clubSettings.group.contact')}</span>
              <Input
                label={t('auth.email')}
                icon="mail"
                value={f.email}
                onInput={(v) =>
                  upd({
                    email: v,
                  })
                }
                error={f.errors.email}
                action="MGT-09.email"
                disabled={readOnly}
              />
              <Input
                label="Instagram"
                icon="camera"
                value={f.instagram}
                onInput={(v) =>
                  upd({
                    instagram: v,
                  })
                }
                error={f.errors.instagram}
                action="MGT-09.instagram"
                disabled={readOnly}
              />
              <Input
                label={t('club.contact.web')}
                icon="globe"
                value={f.web}
                onInput={(v) =>
                  upd({
                    web: v,
                  })
                }
                error={f.errors.web}
                action="MGT-09.web"
                disabled={readOnly}
              />
            </div>
            <div className="col gap8">
              <span className="t-overline">{t('clubSettings.group.join')}</span>
              <Card>
                {[
                  ['applicationsOpen', 'lock-open'],
                  ['approvalRequired', 'shield-check'],
                  ['requireNote', 'file-text'],
                ].map(([k, icon], i) => <Fragment key={k}>{i ? <div className="divider" /> : null}{<div  className="tile is-plain in-card">
                    <Icon name={icon} size={20} class="c-muted" />
                    <span className="tile-text">
                      <span
                        className="t-body-m c-heading"
                        style={{
                          display: 'block',
                        }}
                      >
                        {t('clubSettings.' + k)}
                      </span>
                      <span className="t-caption">{t('clubSettings.' + k + 'Help')}</span>
                    </span>
                    <Switch
                      checked={f[k]}
                      onChange={(v) =>
                        upd({
                          [k]: v,
                        })
                      }
                      action={'MGT-09.toggle.' + k}
                      label={t('clubSettings.' + k)}
                      disabled={readOnly}
                      onDisabledClick={ro}
                    />
                  </div>}</Fragment>)}
              </Card>
              {!f.approvalRequired ? <Banner kind="warning" text={t('clubSettings.instantWarning')} card /> : null}
            </div>
            <div className="col gap8">
              <span className="t-overline">{t('club.advisor')}</span>
              <Card>
                {advisor ? <UserRow user={advisor} sub={t('clubSettings.advisorLocked')} inCard /> : <p className="t-body-s c-muted p16">{t('web.club.noAdvisor')}</p>}
              </Card>
            </div>
          </div>
        </Scroll>
        <StickyCTA>
          <Button
            full
            label={t('common.save')}
            loading={busy}
            disabled={!f.dirty || readOnly}
            action="MGT-09.save"
            onClick={save}
            onDisabledClick={() => app.toast(readOnly ? 'TST-26' : 'TST-X9')}
          />
        </StickyCTA>
      </>
    );
  },
};

/* MGT-10 activity */
S['MGT-10'] = {
  tab: 'clubs',
  title: 'activity.title',
  comp: function Activity({ params, route }: any) {
    const { club, readOnly, allowed, loading } = useMgt(params);
    const [filter, setFilter] = useState('all');
    const cat = filter === 'all' ? null : filter;
    const actLoad = useLoader(allowed ? LD.activityLoader(club.id, cat) : null);
    const [more, runMore] = useBusy();
    if (!allowed) return <NoAccess loading={loading} screen="MGT-10" />;
    const page = db.extra['activity:' + club.id + ':' + (cat || 'all')];
    const acts: any[] = (page?.items || []).filter((a: any) => filter === 'all' || ACT_CAT[a.kind] === filter);
    const groups: any[] = [];
    acts.forEach((a) => {
      // Gelecek tarihli kayıt gerçekte oluşmaz (sunucu zamanı); örnek veride olursa bugüne sabitlenir.
      const ts = Math.min(a.createdAt, Date.now());
      const k = dayKey(ts);
      const g = groups.find((x) => x.k === k);
      if (g) g.items.push(a);
      else
        groups.push({
          k,
          ts,
          items: [a],
        });
    });
    return (
      <>
        <MgtHeader club={club} title={t('activity.title')} screen="MGT-10" />
        <ROBanner readOnly={readOnly} />
        <div className="hscroll py8">
          {['all', 'membership', 'event', 'content', 'settings'].map((f) => (
            <Chip
              key={f}
              label={f === 'all' ? t('common.all') : t('activity.cat.' + f)}
              selected={filter === f}
              action={'MGT-10.filter.' + f}
              onClick={() => setFilter(f)}
            />
          ))}
        </div>
        <Scroll routeKey={route.key}>
          <ListState
            status={actLoad.status !== 'ok' && acts.length ? 'ok' : actLoad.status}
            onRetry={actLoad.reload}
            n={6}
            emptyProps={{
              illustration: 'empty-notifications',
              title: t('activity.empty'),
            }}
          >
            {groups.length ? (
              <>{groups.map((g) => (
                  <div key={g.k}>
                    <div className="group-head">
                      <span
                        className="t-overline"
                        style={{
                          textTransform: 'none',
                        }}
                      >
                        {app.fmt.dayLabel(g.ts)}
                      </span>
                    </div>
                    {g.items.map((a) => (
                      <ActivityRow key={a.id} a={a} screen="MGT-10" club={club} />
                    ))}
                  </div>
                ))}
                {page?.hasMore ? (
                  <div className="p16 center">
                    <Button
                      variant="text"
                      label={t('web.loadMore')}
                      loading={more}
                      action="MGT-10.loadMore"
                      onClick={() => runMore(() => LD.loadMoreActivity(club.id, cat))}
                    />
                  </div>
                ) : (
                  <ListEnd />
                )}</>
            ) : (
              <EmptyState illustration="empty-notifications" title={t('activity.empty')} />
            )}
          </ListState>
        </Scroll>
      </>
    );
  },
};
