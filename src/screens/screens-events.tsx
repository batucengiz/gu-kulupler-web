import {
  AppBar,
  AvatarGroup,
  Badge,
  Banner,
  Button,
  Calendar,
  Card,
  Chip,
  Cover,
  DAY,
  DateBadge,
  EmptyState,
  EventCard,
  Icon,
  IconButton,
  ListEnd,
  ListState,
  NOTIF_CAT,
  NotificationRow,
  Picker,
  Progress,
  SCREENS,
  Scroll,
  Segmented,
  StatusBadge,
  StickyCTA,
  Switch,
  Tile,
  app,
  cx,
  dayKey,
  eventStatusFor,
  placeName,
  qrSVG,
  startOfDay,
  today0,
  useEffect,
  useState,
  ClubEmblem,
  LD,
  useLoader,
  A,
  handleError,
  notifPermission,
  session,
  SkeletonList,
  Fragment,
} from '../ui/kit';
import { NotFoundInline } from './screens-clubs';
import * as R from '../data/repo/rsvps';
import { ticketQrPayload } from '../lib/util';
/* ===== SCREENS: EVT · NTF ===== */
const t = (k: string, p?: any) => app.t(k, p);
const S = SCREENS;
const sel = () => app.sel;
const DEFAULT_EF: any = {
  date: 'all',
  from: null,
  to: null,
  clubs: [],
  types: [],
  visibility: 'all',
  freeOnly: false,
  sort: 'date',
};
const efOf = () => ({
  ...DEFAULT_EF,
  ...(app.state.ui.eventFilters || {}),
});
const efCount = (f: any) =>
  (f.date !== 'all' ? 1 : 0) +
  (f.clubs.length ? 1 : 0) +
  (f.types.length ? 1 : 0) +
  (f.visibility !== 'all' ? 1 : 0) +
  (f.freeOnly ? 1 : 0) +
  (f.sort !== 'date' ? 1 : 0);
function applyEventFilters(list: any[], f: any, _u?: string | null) {
  let out = list.slice();
  const t0 = today0();
  if (f.date === 'today') out = out.filter((e) => startOfDay(e.startsAt) === t0);
  if (f.date === 'week') out = out.filter((e) => e.startsAt >= t0 && e.startsAt < t0 + 7 * DAY);
  if (f.date === 'month') out = out.filter((e) => e.startsAt >= t0 && e.startsAt < t0 + 30 * DAY);
  if (f.date === 'custom' && f.from) out = out.filter((e) => e.startsAt >= startOfDay(f.from) && e.startsAt <= (f.to ? startOfDay(f.to) + DAY : Infinity));
  if (f.clubs.length) out = out.filter((e) => f.clubs.includes(e.clubId));
  if (f.types.length) out = out.filter((e) => f.types.includes(e.type));
  if (f.visibility !== 'all') out = out.filter((e) => e.visibility === f.visibility);
  if (f.freeOnly) out = out.filter((e) => !sel().isFull(e));
  if (f.sort === 'popular') out.sort((a, b) => sel().registeredCount(b) - sel().registeredCount(a));
  else out.sort((a, b) => a.startsAt - b.startsAt);
  return out;
}
export const eventFilters = {
  DEFAULT_EF,
  efOf,
  applyEventFilters,
  efCount,
};

/* EVT-01 */
S['EVT-01'] = {
  tab: 'events',
  title: 'nav.events',
  comp: function Events({ route }: any) {
    const u = app.uid();
    const f = efOf();
    const view = app.state.ui.eventView || 'list';
    const [chip, setChip] = useState('all');
    const [month, setMonth] = useState(() => {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    });
    const [selDay, setSelDay] = useState(today0());
    const { status, reload } = useLoader(LD.upcomingLoader());
    const monthLoad = useLoader(view === 'calendar' ? LD.monthLoader(month) : null);
    let list = applyEventFilters(
      sel()
        .visibleEvents(u)
        .filter((e) => e.endsAt >= Date.now() || e.status === 'cancelled'),
      f,
      u,
    );
    const t0 = today0();
    if (chip === 'today') list = list.filter((e) => startOfDay(e.startsAt) === t0);
    if (chip === 'week') list = list.filter((e) => e.startsAt < t0 + 7 * DAY);
    if (chip === 'mine') list = list.filter((e) => sel().isMemberOf(e.clubId, u));
    if (chip === 'public') list = list.filter((e) => e.visibility === 'public');
    const groups = (
      [
        ['today', (e: any) => startOfDay(e.startsAt) === t0],
        ['tomorrow', (e: any) => startOfDay(e.startsAt) === t0 + DAY],
        ['week', (e: any) => e.startsAt >= t0 + 2 * DAY && e.startsAt < t0 + 7 * DAY],
        ['later', (e: any) => e.startsAt >= t0 + 7 * DAY],
        ['pastGroup', (e: any) => e.startsAt < t0],
      ] as Array<[string, (e: any) => boolean]>
    )
      .map(([k, fn]) => [k, list.filter(fn)] as const)
      .filter(([, l]) => l.length);
    const all = sel().visibleEvents(u);
    const dots = (k: string) => all.filter((e) => dayKey(e.startsAt) === k).length;
    const dayList = all.filter((e) => dayKey(e.startsAt) === dayKey(selDay)).sort((a, b) => a.startsAt - b.startsAt);
    const shift = (n: number) => {
      const d = new Date(month);
      d.setMonth(d.getMonth() + n);
      setMonth(d.getTime());
    };
    return <>{<AppBar large title={t('nav.events')}>
        <IconButton icon="ticket" label={t('events.tickets')} action="EVT-01.tickets" onClick={() => app.nav.push('EVT-04')} />
        <IconButton
          icon="search"
          label={t('common.search')}
          action="EVT-01.search"
          onClick={() =>
            app.nav.push('CLB-02', {
              tab: 'events',
            })
          }
        />
      </AppBar>}{<div className="px16 pb16">
        <Segmented
          options={[
            {
              id: 'list',
              label: t('events.view.list'),
              icon: 'list',
            },
            {
              id: 'calendar',
              label: t('events.view.calendar'),
              icon: 'calendar-days',
            },
          ]}
          value={view}
          onChange={(v) =>
            app.dispatch('ui.set', {
              eventView: v,
            })
          }
          action="EVT-01.view"
        />
      </div>}{view === 'list' ? (
        <div className="hscroll pb16">
          {[
            ['all', t('common.all')],
            ['today', t('time.today')],
            ['week', t('events.chip.week')],
            ['mine', t('events.chip.mine')],
            ['public', t('events.chip.public')],
          ].map(([id, l]) => (
            <Chip key={id} label={l} selected={chip === id} action={'EVT-01.chip.' + id} onClick={() => setChip(id)} />
          ))}
          <Chip
            icon="sliders-horizontal"
            label={t('common.filter')}
            count={efCount(f) || null}
            action="EVT-01.filter"
            onClick={() => app.openSheet('SHT-11')}
          />
        </div>
      ) : null}{<Scroll routeKey={route.key} onRefresh={() => (view === 'list' ? reload() : monthLoad.reload())} refreshAction="EVT-01.refresh">
        {view === 'list' ? (
          <ListState
            status={status !== 'ok' && groups.length ? 'ok' : status}
            onRetry={reload}
            n={4}
            variant="card"
            emptyProps={{
              illustration: 'empty-events',
              title: t('events.empty.title'),
              desc: t('events.empty.desc'),
              cta: efCount(f) ? t('clubs.empty.clear') : null,
              ctaAction: 'EVT-01.clearFilters',
              onCta: () =>
                app.dispatch('ui.set', {
                  eventFilters: null,
                  dataMode: 'normal',
                }),
            }}
          >
            {groups.length ? (
              <>{groups.map(([k, l]) => (
                  <div key={k}>
                    <div className="group-head">
                      <span className="t-overline">{t('events.group.' + k)}</span>
                      <span className="t-caption tnum">{l.length}</span>
                    </div>
                    <div className="col gap12 px16 pb16">
                      {l.map((e) => (
                        <EventCard key={e.id} ev={e} />
                      ))}
                    </div>
                  </div>
                ))}{<ListEnd />}</>
            ) : (
              <EmptyState
                illustration="empty-events"
                title={t('events.empty.title')}
                desc={t('events.empty.desc')}
                cta={efCount(f) || chip !== 'all' ? t('clubs.empty.clear') : null}
                ctaAction="EVT-01.clearFilters"
                onCta={() => {
                  setChip('all');
                  app.dispatch('ui.set', {
                    eventFilters: null,
                  });
                }}
              />
            )}
          </ListState>
        ) : (
          <div className="px16 col gap16">
            <Card class="card-body">
              <Calendar
                month={month}
                selected={selDay}
                onSelect={setSelDay}
                action="EVT-01"
                dotsFor={dots}
                onPrev={() => shift(-1)}
                onNext={() => shift(1)}
                onToday={() => {
                  const d = new Date();
                  d.setDate(1);
                  d.setHours(0, 0, 0, 0);
                  setMonth(d.getTime());
                  setSelDay(today0());
                }}
              />
            </Card>
            <h2
              className="t-title-s"
              style={{
                textTransform: 'capitalize',
              }}
            >
              {app.fmt.dayLabel(selDay)}
            </h2>
            {dayList.length ? (
              dayList.map((e) => <EventCard key={e.id} ev={e} compact />)
            ) : (
              <EmptyState illustration="empty-events" title={t('events.empty.day')} compact />
            )}
          </div>
        )}
      </Scroll>}</>;
  },
};

/* EVT-02 */
const shownCancelled = new Set();
S['EVT-02'] = {
  tab: 'events',
  title: 'event.title',
  comp: function EventDetail({ params }: any) {
    const u = app.uid();
    const ev = sel().event(params.id);
    const [py, setPy] = useState(0);
    const [more, setMore] = useState(false);
    const evLoad = useLoader(LD.eventLoader(params.id));
    const clubLoad = useLoader(ev && !sel().club(ev.clubId) ? LD.clubLoader(ev.clubId) : null);
    const isMgr = !!ev && (sel().isManager(ev.clubId, u) || sel().isSuper(u));
    useLoader(ev && isMgr ? LD.participantsLoader(ev.id, ev.clubId) : null);
    const myR = ev ? sel().myRsvp(ev.id, u) : null;
    useEffect(() => {
      if (myR && myR.status === 'waitlist') A.loadWaitPosition(myR.eventId).catch(() => {});
    }, [myR && myR.status, myR && myR.waitlistAt]);
    useEffect(() => {
      if (ev && ev.status === 'cancelled' && myR && !shownCancelled.has(ev.id)) {
        shownCancelled.add(ev.id);
        setTimeout(
          () =>
            app.openDialog('DLG-16', {
              eventId: ev.id,
            }),
          300,
        );
      }
    }, [ev && ev.id, ev && ev.status]);
    if (!ev || !sel().club(ev.clubId)) {
      if (evLoad.status === 'error' || clubLoad.status === 'error' || (ev && ev.isDeleted)) return <NotFoundInline />;
      return (
        <>
          <AppBar onBack={() => app.nav.back()} backAction="EVT-02.back" title="" />
          <SkeletonList n={4} variant="card" />
        </>
      );
    }
    const club = sel().club(ev.clubId)!;
    if ((club.status === 'suspended' && !sel().isSuper(u)) || ev.isDeleted || (ev.status === 'draft' && !sel().canManage(ev.clubId, u))) return <NotFoundInline />;
    const st = eventStatusFor(ev, u);
    const r = myR;
    const regN = sel().registeredCount(ev);
    const wlN = ev.waitlistCount || 0;
    const regList = isMgr ? sel().registered(ev.id) : [];
    const manager = isMgr;
    const advisor = sel().isAdvisor(ev.clubId, u);
    const inside = sel().canSeeInside(ev.clubId, u);
    const past = ev.endsAt < Date.now();
    const menu = () => {
      if (manager)
        app.openSheet('SHT-23', {
          eventId: ev.id,
        });
      else
        app.openMenu('EVT-MENU', {
          eventId: ev.id,
        });
    };
    const cta = () => {
      if (ev.status === 'cancelled')
        return (
          <Banner kind="danger" icon="calendar-x" text={`${t('event.cancelledBanner')} ${ev.cancelReason ? t('cancelReason.' + ev.cancelReason) : ''}`} />
        );
      if (manager)
        return (
          <StickyCTA>
            <Button
              variant="outline"
              icon="pencil"
              label={t('common.edit')}
              action="EVT-02.edit"
              onClick={() =>
                app.nav.push('MGT-05', {
                  clubId: ev.clubId,
                  eventId: ev.id,
                })
              }
            />
            <Button
              variant="tonal"
              icon="users"
              label={t('event.cta.attendees')}
              action="EVT-02.attendees"
              onClick={() =>
                app.nav.push('MGT-06', {
                  clubId: ev.clubId,
                  eventId: ev.id,
                })
              }
            />
            <Button
              icon="scan-line"
              label={t('event.cta.scan')}
              action="EVT-02.scan"
              onClick={() =>
                app.nav.push('MGT-07', {
                  clubId: ev.clubId,
                  eventId: ev.id,
                })
              }
            />
          </StickyCTA>
        );
      if (advisor) return <Banner kind="readonly" text={t('mgt.readOnlyBanner')} />;
      if (past)
        return (
          <StickyCTA>
            {st === 'attended' ? (
              <div
                className="flex1 row"
                style={{
                  justifyContent: 'center',
                }}
              >
                <StatusBadge status="attended" />
              </div>
            ) : (
              <Button full variant="outline" disabled label={t('event.ended')} action="EVT-02.ended" onDisabledClick={() => app.toast('TST-X6')} />
            )}
          </StickyCTA>
        );
      if (st === 'going')
        return (
          <StickyCTA>
            <Button
              variant="text"
              label={t('event.cta.leave')}
              action="EVT-02.leave"
              onClick={() =>
                app.openDialog('DLG-14', {
                  eventId: ev.id,
                })
              }
            />
            <Button
              icon="ticket"
              label={t('event.cta.ticket')}
              action="EVT-02.ticket"
              onClick={() =>
                app.nav.push('EVT-03', {
                  id: ev.id,
                })
              }
            />
          </StickyCTA>
        );
      if (st === 'waitlist')
        return (
          <StickyCTA>
            <div className="flex1 col">
              <span className="t-label-l c-heading">
                {t('event.waitlistPos', {
                  n: sel().waitPosition(ev.id, u),
                })}
              </span>
              <span className="t-caption">{t('event.waitlistNote')}</span>
            </div>
            <Button
              variant="outline"
              label={t('event.cta.leaveWaitlist')}
              action="EVT-02.leave"
              onClick={() =>
                app.openDialog('DLG-14', {
                  eventId: ev.id,
                  waitlist: true,
                })
              }
            />
          </StickyCTA>
        );
      if (st === 'members')
        return (
          <StickyCTA>
            <Button
              full
              variant="outline"
              icon="lock"
              label={t('event.cta.applyClub')}
              action="EVT-02.applyClub"
              onClick={() =>
                app.nav.push('CLB-03', {
                  id: ev.clubId,
                })
              }
            />
          </StickyCTA>
        );
      if (st === 'full')
        return (
          <StickyCTA>
            <Button
              full
              variant="tonal"
              icon="hourglass"
              label={t('event.cta.waitlist')}
              action="EVT-02.waitlist"
              onClick={() =>
                app.requireOnline() &&
                app.openDialog('DLG-15', {
                  eventId: ev.id,
                })
              }
            />
          </StickyCTA>
        );
      if (!ev.registrationOpen)
        return (
          <StickyCTA>
            <Button full variant="outline" disabled label={t('event.cta.closed')} action="EVT-02.join" onDisabledClick={() => app.toast('TST-X2')} />
          </StickyCTA>
        );
      return (
        <StickyCTA>
          <Button
            full
            size="lg"
            label={t('event.cta.join')}
            action="EVT-02.join"
            onClick={() =>
              app.requireOnline() &&
              app.openSheet('SHT-12', {
                eventId: ev.id,
              })
            }
          />
        </StickyCTA>
      );
    };
    return <>{<div
        className="screen-scroll no-safe"
        onScroll={(e) => setPy(Math.min(220, (e.currentTarget as HTMLElement).scrollTop))}
        style={{
          paddingTop: '0',
          marginTop: 'calc(-1 * var(--safe-top))',
        }}
      >
        <div
          className="parallax"
          style={{
            ['--py' as any]: py,
          }}
        >
          <Cover
            seed={ev.coverSeed}
            icon={club.iconName}
            palette={ev.coverPalette}
            pattern={ev.coverPattern}
            path={ev.coverPath}
            style={{
              height: '100%',
            }}
          />
          <div className="parallax-bar">
            <IconButton onCover icon="arrow-left" label={t('a11y.back')} action="EVT-02.back" onClick={() => app.nav.back()} />
            <span className="spacer" />
            <IconButton
              onCover
              icon="share-2"
              label={t('common.share')}
              action="EVT-02.share"
              onClick={() =>
                app.openSheet('SHT-15', {
                  type: 'event',
                  id: ev.id,
                })
              }
            />
            <IconButton onCover icon="more-vertical" label={t('a11y.more')} action="EVT-02.menu" onClick={menu} />
          </div>
        </div>
        {ev.status === 'cancelled' ? (
          <Banner kind="danger" icon="calendar-x" text={`${t('event.cancelledBanner')} — ${ev.cancelReason ? t('cancelReason.' + ev.cancelReason) : ''}`} />
        ) : null}
        {ev.status === 'draft' ? <Banner kind="info" icon="file-text" text={t('event.draftBanner')} /> : null}
        <div className="col gap8 px16 pt16">
          <h1 className="t-title-l">{ev.title}</h1>
          <button
            type="button"
            className="row gap8"
            style={{
              textAlign: 'left',
            }}
            data-action="EVT-02.club"
            onClick={() =>
              app.nav.push('CLB-03', {
                id: club.id,
              })
            }
            aria-label={club.name}
          >
            <ClubEmblem club={club} cls="is-xs" size={16} />
            <span className="t-body-m c-brand bold ellipsis">{club.name}</span>
            <Icon name="chevron-right" size={16} class="c-muted" />
          </button>
          <div className="row gap6 wrap">
            <Badge kind="neutral" label={t('eventType.' + ev.type)} />
            <Badge
              kind={ev.visibility === 'members' ? 'info' : 'success'}
              icon={ev.visibility === 'members' ? 'lock' : 'globe'}
              label={ev.visibility === 'members' ? t('event.visibility.members') : t('event.visibility.public')}
            />
            {st ? <StatusBadge status={st} /> : null}
          </div>
        </div>
        <div className="col gap12 px16 pt16 pb24">
          <Card>
            <Tile
              inCard
              leading={
                <span className="notif-icon ni-brand">
                  <Icon name="calendar-days" size={20} />
                </span>
              }
              title={app.fmt.dateLong(ev.startsAt)}
              subtitle={`${app.fmt.range(ev.startsAt, ev.endsAt)} · ${app.fmt.duration(ev.startsAt, ev.endsAt)}`}
            />
            <div className="divider" />
            <Tile
              inCard
              leading={
                <span className="notif-icon ni-info">
                  <Icon name="map-pin" size={20} />
                </span>
              }
              title={placeName(ev)}
              subtitle={t('event.placeCampus')}
              trailing={
                <Button
                  size="sm"
                  variant="text"
                  icon="navigation"
                  label={t('event.directions')}
                  action="EVT-02.directions"
                  onClick={() =>
                    app.openDialog('DLG-32', {
                      url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(placeName(ev) + ', Gümüşhane Üniversitesi'),
                    })
                  }
                />
              }
            />
            <div className="px16 pb16">
              <div className="map-ph row gap8" style={{ justifyContent: 'center' }}>
                <Icon name="map-pin" size={18} />
                <span className="ellipsis">{placeName(ev)} · {t('event.placeCampus')}</span>
              </div>
            </div>
          </Card>
          <Card class="card-body col gap8">
            <div className="row between">
              <span className="t-label-l c-heading row gap6">
                <Icon name="users" size={18} />
                {t('event.capacity')}
              </span>
              <span className="t-caption tnum">{ev.capacity != null ? `${regN}/${ev.capacity}` : t('event.unlimited')}</span>
            </div>
            {ev.capacity != null ? (
              <>
                <Progress
                  value={regN}
                  max={ev.capacity}
                  kind={regN >= ev.capacity ? 'muted' : regN / ev.capacity > 0.85 ? 'warning' : undefined}
                  label={t('event.capacity')}
                />
                <span className="t-body-s c-sec">
                  {regN >= ev.capacity
                    ? t('event.full')
                    : t('event.remaining', {
                        count: ev.capacity - regN,
                      })}
                  {wlN
                    ? ` · ${t('event.waitlistCount', {
                        count: wlN,
                      })}`
                    : ''}
                </span>
              </>
            ) : null}
          </Card>
          {!past && ev.status !== 'cancelled' ? (
            <Card>
              <Tile
                inCard
                leading={<Icon name="bell-ring" size={20} class="c-brand" />}
                title={t('event.reminder')}
                subtitle={r ? t('reminder.' + (r.reminder || 'none')) : t('event.reminderAfterJoin')}
                chevron
                action="EVT-02.reminder"
                onClick={() =>
                  r
                    ? app.openSheet('SHT-13', {
                        eventId: ev.id,
                      })
                    : app.toast('TST-X7')
                }
              />
              <div className="divider" />
              <Tile
                inCard
                leading={<Icon name="calendar-plus" size={20} class="c-brand" />}
                title={t('event.addToCalendar')}
                chevron
                action="EVT-02.addToCalendar"
                onClick={() =>
                  app.openSheet('SHT-14', {
                    eventId: ev.id,
                  })
                }
              />
            </Card>
          ) : null}
          <div className="col gap6">
            <h2 className="t-title-s">{t('event.about')}</h2>
            <p className={cx('t-body-m c-sec', !more && 'clamp3')}>{ev.desc}</p>
            {!more && (ev.desc || '').length > 160 ? (
              <button
                type="button"
                className="t-label-l c-brand"
                style={{
                  textAlign: 'left',
                }}
                data-action="EVT-02.more"
                onClick={() => setMore(true)}
              >
                {t('common.readMore')}
              </button>
            ) : null}
          </div>
          {inside && regN ? (
            <button
              type="button"
              className="row gap10"
              style={{
                textAlign: 'left',
              }}
              data-action="EVT-02.attendeesPreview"
              onClick={() =>
                manager
                  ? app.nav.push('MGT-06', {
                      clubId: ev.clubId,
                      eventId: ev.id,
                    })
                  : app.toast('TST-X8', {
                      count: regN,
                    })
              }
              aria-label={t('event.attendees')}
            >
              {regList.length ? (
                <AvatarGroup
                  users={regList
                    .slice(0, 5)
                    .map((x) => sel().user(x.userId))
                    .filter(Boolean)}
                  size={32}
                  total={regN}
                />
              ) : (
                <span className="notif-icon ni-brand">
                  <Icon name="users" size={18} />
                </span>
              )}
              <span className="t-body-s c-sec">
                {t('event.attendeesGoing', {
                  count: regN,
                })}
              </span>
            </button>
          ) : null}
          {!manager && !advisor ? (
            <Button
              variant="text"
              icon="flag"
              label={t('event.report')}
              action="EVT-02.report"
              onClick={() =>
                app.openSheet('SHT-10', {
                  targetType: 'event',
                  targetId: ev.id,
                  clubId: ev.clubId,
                })
              }
            />
          ) : null}
        </div>
      </div>}{cta()}</>;
  },
};

/* EVT-03 ticket */
S['EVT-03'] = {
  tab: 'events',
  title: 'ticket.title',
  comp: function Ticket({ params }: any) {
    const u = app.uid();
    const ev = sel().event(params.id);
    const r = sel().myRsvp(params.id, u);
    const me = app.me();
    const evLoad = useLoader(LD.eventLoader(params.id));
    const clubLoad = useLoader(ev && !sel().club(ev.clubId) ? LD.clubLoader(ev.clubId) : null);
    useEffect(() => {
      // bilet canlı: görevli okuttuğunda "kullanıldı" olarak güncellenir
      if (!u) return;
      return R.watchMyRsvp(params.id, u, (x) => session.setRsvp(params.id, x));
    }, [params.id, u]);
    if (!ev || !sel().club(ev.clubId) || !me) {
      if (evLoad.status === 'error' || clubLoad.status === 'error') return <NotFoundInline />;
      return (
        <>
          <AppBar onBack={() => app.nav.back()} backAction="EVT-03.back" title={t('ticket.title')} />
          <SkeletonList n={3} variant="card" />
        </>
      );
    }
    if (!r || r.status === 'waitlist' || r.status === 'cancelled') return <NotFoundInline />;
    const status = ev.status === 'cancelled' ? 'void' : r.status === 'attended' ? 'used' : 'valid';
    const club = sel().club(ev.clubId)!;
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="EVT-03.back" title={t('ticket.title')}>
          <IconButton
            icon="calendar-plus"
            label={t('event.addToCalendar')}
            action="EVT-03.addToCalendar"
            onClick={() =>
              app.openSheet('SHT-14', {
                eventId: ev.id,
              })
            }
          />
        </AppBar>
        <Scroll routeKey={'ticket-' + ev.id}>
          <div className="col gap16 px16">
            <div
              className="row"
              style={{
                justifyContent: 'center',
              }}
            >
              <Badge kind="info" icon="sun" label={t('web.ticket.brightness')} />
            </div>
            <div className="ticket">
              <div className="card-body col gap8">
                <div className="row between start">
                  <div className="col gap4 flex1">
                    <span className="t-overline">{club.name}</span>
                    <h1 className="t-title-m">{ev.title}</h1>
                  </div>
                  <StatusBadge status={status} label={t('ticket.status.' + status)} />
                </div>
                <span className="t-body-s c-sec row gap4">
                  <Icon name="calendar-days" size={14} />
                  {app.fmt.dateTime(ev.startsAt)}
                </span>
                <span className="t-body-s c-sec row gap4">
                  <Icon name="map-pin" size={14} />
                  {placeName(ev)}
                </span>
              </div>
              <div className="ticket-cut" />
              <div
                className="card-body col gap12"
                style={{
                  alignItems: 'center',
                }}
              >
                <div
                  className={cx('qr', status === 'used' && 'is-blur', status === 'void' && 'is-void')}
                  dangerouslySetInnerHTML={{
                    __html: qrSVG(ticketQrPayload(ev.id, r.ticketCode), 220),
                  }}
                />
                {status === 'used' ? (
                  <span className="row gap6 c-success t-label-l">
                    <Icon name="circle-check" size={18} />
                    {t('ticket.scannedAt', {
                      time: app.fmt.dateTime(r.scannedAt || Date.now()),
                    })}
                  </span>
                ) : null}
                <span
                  className="t-title-s tnum"
                  style={{
                    letterSpacing: '.12em',
                  }}
                >
                  {r.ticketCode}
                </span>
                <span className="t-body-m c-heading">{me.name}</span>
              </div>
            </div>
            <Button
              variant="text"
              label={t('ticket.openEvent')}
              action="EVT-03.openEvent"
              onClick={() =>
                app.nav.popTo('EVT-02') ||
                app.nav.push('EVT-02', {
                  id: ev.id,
                })
              }
            />
            {status === 'valid' && ev.endsAt > Date.now() ? (
              <Button
                variant="danger-outline"
                label={t('event.cta.leave')}
                action="EVT-03.leave"
                onClick={() =>
                  app.openDialog('DLG-14', {
                    eventId: ev.id,
                    onDone: () => app.nav.back(),
                  })
                }
              />
            ) : null}
          </div>
        </Scroll>
      </>
    );
  },
};

/* EVT-04 my events */
S['EVT-04'] = {
  tab: 'events',
  title: 'myevents.title',
  comp: function MyEvents({ params }: any) {
    const u = app.uid();
    const [tab, setTab] = useState(params.tab || 'upcoming');
    const { status, reload } = useLoader(LD.myEventsLoader());
    const all = sel().userRsvps(u).filter((r) => r.status !== 'cancelled' && !r.event.isDeleted);
    useEffect(() => {
      if (tab === 'waitlist') all.filter((r) => r.status === 'waitlist').forEach((r) => A.loadWaitPosition(r.eventId).catch(() => {}));
      // eslint-disable-next-line
    }, [tab, all.length]);
    const list = all
      .filter((r) =>
        tab === 'upcoming'
          ? r.status !== 'waitlist' && r.event.endsAt >= Date.now() && r.event.status !== 'cancelled'
          : tab === 'past'
            ? r.event.endsAt < Date.now() || r.event.status === 'cancelled'
            : r.status === 'waitlist',
      )
      .sort((a, b) => (tab === 'past' ? b.event.startsAt - a.event.startsAt : a.event.startsAt - b.event.startsAt));
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="EVT-04.back" title={t('myevents.title')} />
        <div className="px16 pb16">
          <Segmented
            options={[
              {
                id: 'upcoming',
                label: t('event.upcoming'),
              },
              {
                id: 'past',
                label: t('event.past'),
              },
              {
                id: 'waitlist',
                label: t('status.waitlist'),
              },
            ]}
            value={tab}
            onChange={setTab}
            action="EVT-04.tab"
          />
        </div>
        <Scroll routeKey="myevents" onRefresh={reload} refreshAction="EVT-04.refresh">
          <ListState
            status={status !== 'ok' && list.length ? 'ok' : status}
            onRetry={reload}
            n={4}
            emptyProps={{
              illustration: 'empty-events',
              title: t('myevents.empty.' + tab),
              cta: t('events.discover'),
              ctaAction: 'EVT-04.discover',
              onCta: () => app.nav.openInTab('events', []),
            }}
          >
            {list.length ? (
              <div className="col">
                {list.map((r) => {
                  const ev = r.event;
                  const st = eventStatusFor(ev, u);
                  return (
                    <Tile
                      key={ev.id}
                      leading={<DateBadge ts={ev.startsAt} />}
                      title={ev.title}
                      subtitle={`${(sel().club(ev.clubId) || ({} as any)).name || ''} · ${app.fmt.dateShort(ev.startsAt)} ${app.fmt.time(ev.startsAt)}`}
                      sub2={st ? <StatusBadge status={st} /> : null}
                      action={'EVT-04.event.' + ev.id}
                      onClick={() =>
                        app.nav.push('EVT-02', {
                          id: ev.id,
                        })
                      }
                      trailing={
                        tab === 'upcoming' ? (
                          <>
                            <IconButton
                              icon="ticket"
                              label={t('event.cta.ticket')}
                              brand
                              action={'EVT-04.ticket.' + ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                app.nav.push('EVT-03', {
                                  id: ev.id,
                                });
                              }}
                            />
                            <IconButton
                              icon="x"
                              label={t('event.cta.leave')}
                              action={'EVT-04.leave.' + ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                app.openDialog('DLG-14', {
                                  eventId: ev.id,
                                });
                              }}
                            />
                          </>
                        ) : tab === 'waitlist' ? (
                          <>
                            <span className="t-caption tnum">
                              {t('event.waitlistPos', {
                                n: sel().waitPosition(ev.id, u),
                              })}
                            </span>
                            <IconButton
                              icon="x"
                              label={t('event.cta.leaveWaitlist')}
                              action={'EVT-04.leave.' + ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                app.openDialog('DLG-14', {
                                  eventId: ev.id,
                                  waitlist: true,
                                });
                              }}
                            />
                          </>
                        ) : null
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState
                illustration="empty-events"
                title={t('myevents.empty.' + tab)}
                cta={t('events.discover')}
                ctaAction="EVT-04.discover"
                onCta={() => app.nav.openInTab('events', [])}
              />
            )}
          </ListState>
        </Scroll>
      </>
    );
  },
};

/* NTF-01 */
S['NTF-01'] = {
  tab: 'notifications',
  title: 'nav.notifications',
  comp: function Notifications({ route }: any) {
    const u = app.uid();
    const [filter, setFilter] = useState('all');
    const all = sel().notifsFor(u);
    const perm = notifPermission();
    const dismissed = app.state.ui.dismissedNotifBanner;
    useEffect(() => {
      LD.loadNotifRefs(all).catch(() => {});
      // eslint-disable-next-line
    }, [all.length, all[0] && all[0].id]);
    const list = all.filter((n) => filter === 'all' || (filter === 'unread' && !n.read) || (NOTIF_CAT as any)[n.type] === filter);
    const t0 = today0();
    const groups = (
      [
        ['today', (n: any) => n.createdAt >= t0],
        ['yesterday', (n: any) => n.createdAt >= t0 - DAY && n.createdAt < t0],
        ['week', (n: any) => n.createdAt >= t0 - 7 * DAY && n.createdAt < t0 - DAY],
        ['older', (n: any) => n.createdAt < t0 - 7 * DAY],
      ] as Array<[string, (n: any) => boolean]>
    )
      .map(([k, fn]) => [k, list.filter(fn)] as const)
      .filter(([, l]) => l.length);
    return <>{<AppBar large title={t('nav.notifications')}>
        <IconButton
          icon="check-check"
          label={t('notif.markAllRead')}
          action="NTF-01.markAllRead"
          onClick={() => {
            if (!all.some((n) => !n.read)) return app.toast('TST-18');
            A.markAllRead()
              .then(() => app.toast('TST-18'))
              .catch(handleError);
          }}
        />
        <IconButton icon="settings" label={t('notif.settings')} action="NTF-01.settings" onClick={() => app.nav.push('NTF-02')} />
      </AppBar>}{perm !== 'granted' && perm !== 'unsupported' && !dismissed ? (
        <Banner
          kind="warning"
          icon="bell-off"
          text={t('notif.offBanner')}
          actionLabel={t('common.open')}
          action="NTF-01.enable"
          onAction={() => app.openDialog('DLG-03')}
          onDismiss={() =>
            app.dispatch('ui.set', {
              dismissedNotifBanner: true,
            })
          }
          dismissAction="NTF-01.dismissBanner"
        />
      ) : null}{<div className="hscroll py8">
        {[
          ['all', t('common.all')],
          ['unread', t('notif.unread')],
          ['clubs', t('nav.clubs')],
          ['events', t('nav.events')],
          ['system', t('notif.system')],
        ].map(([id, l]) => (
          <Chip key={id} label={l} selected={filter === id} action={'NTF-01.filter.' + id} onClick={() => setFilter(id)} />
        ))}
      </div>}{<Scroll routeKey={route.key} onRefresh={() => new Promise((r) => setTimeout(r, 400))} refreshAction="NTF-01.refresh">
        <ListState
          status={session.s.inboxLoaded ? 'ok' : 'loading'}
          n={6}
          emptyProps={{
            illustration: 'empty-notifications',
            title: t('notif.empty.title'),
            desc: t('notif.empty.desc'),
          }}
        >
          {groups.length ? (
            <>{groups.map(([k, l]) => (
                <div key={k}>
                  <div className="group-head">
                    <span className="t-overline">{t('time.group.' + k)}</span>
                  </div>
                  {l.map((n) => (
                    <NotificationRow key={n.id} n={n} />
                  ))}
                </div>
              ))}{<ListEnd />}</>
          ) : (
            <EmptyState illustration="empty-notifications" title={t('notif.empty.title')} desc={t('notif.empty.desc')} />
          )}
        </ListState>
      </Scroll>}</>;
  },
};

/* NTF-02 */
S['NTF-02'] = {
  tab: 'notifications',
  title: 'notifPrefs.title',
  comp: function NotifPrefs() {
    const u = app.uid();
    const st = sel().settings(u);
    const perm = notifPermission();
    const isManager = sel()
      .managedClubs(u)
      .some((m) => !m.readOnly);
    const set = (patch: any) => {
      A.updateSettings(patch)
        .then(() => app.toast('TST-19'))
        .catch(handleError);
    };
    const rows: Array<[string, string]> = [
      ['announcements', 'megaphone'],
      ['eventReminders', 'bell-ring'],
      ['newEvents', 'calendar-plus'],
      ['applicationResults', 'user-check'],
      ...(isManager ? ([['management', 'shield-check']] as Array<[string, string]>) : []),
      ['system', 'info'],
    ];
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="NTF-02.back" title={t('notifPrefs.title')} />
        <Scroll routeKey="ntfprefs">
          <div className="col gap16 px16 pb24">
            <Card class={cx('card-body row gap12')} muted>
              <span className={cx('notif-icon', perm === 'granted' ? 'ni-success' : 'ni-warning')}>
                <Icon name={perm === 'granted' ? 'bell-ring' : 'bell-off'} size={20} />
              </span>
              <div className="flex1 col">
                <span className="t-label-l c-heading">{t('notifPrefs.permission')}</span>
                <span className="t-caption">{perm === 'granted' ? t('common.on') : perm === 'unsupported' ? t('web.notif.unsupported') : t('common.off')}</span>
              </div>
              {perm !== 'granted' && perm !== 'unsupported' ? (
                <Button size="sm" variant="tonal" label={t('notifPrefs.enable')} action="NTF-02.permission" onClick={() => app.openDialog('DLG-03')} />
              ) : null}
            </Card>
            <Card>
              {rows.map(([k, icon], i) => (
                <Fragment key={k}>
                {i ? <div className="divider" /> : null}
                <div className="tile is-plain in-card">
                  <Icon name={icon} size={20} class="c-muted" />
                  <span className="tile-text t-body-m c-heading">{t('notifPrefs.' + k)}</span>
                  <Switch
                    checked={st[k] !== false}
                    onChange={(v) =>
                      set({
                        [k]: v,
                      })
                    }
                    action={'NTF-02.toggle.' + k}
                    label={t('notifPrefs.' + k)}
                  />
                </div>
                </Fragment>
              ))}
            </Card>
            <div className="col gap8">
              <span className="field-label">{t('notifPrefs.reminderTime')}</span>
              <Segmented
                options={[
                  {
                    id: '1h',
                    label: t('reminder.1h'),
                  },
                  {
                    id: '1d',
                    label: t('reminder.1d'),
                  },
                ]}
                value={st.reminderTime}
                onChange={(v) =>
                  set({
                    reminderTime: v,
                  })
                }
                action="NTF-02.reminderTime"
              />
            </div>
            <Card>
              <div className="tile is-plain in-card">
                <Icon name="moon" size={20} class="c-muted" />
                <span className="tile-text">
                  <span
                    className="t-body-m c-heading"
                    style={{
                      display: 'block',
                    }}
                  >
                    {t('notifPrefs.quiet')}
                  </span>
                  <span className="t-caption">{t('notifPrefs.quietDesc')}</span>
                </span>
                <Switch
                  checked={!!st.quiet}
                  onChange={(v) =>
                    set({
                      quiet: v,
                    })
                  }
                  action="NTF-02.quiet"
                  label={t('notifPrefs.quiet')}
                />
              </div>
              {st.quiet ? (
                <>
                  <div className="divider" />
                  <div className="row gap12 p16">
                    <div className="flex1">
                      <Picker
                        label={t('notifPrefs.quietFrom')}
                        value={st.quietFrom}
                        icon="clock"
                        action="NTF-02.quietFrom"
                        onClick={() =>
                          app.openSheet('SHT-29', {
                            value: st.quietFrom,
                            onSelect: (v: string) =>
                              set({
                                quietFrom: v,
                              }),
                          })
                        }
                      />
                    </div>
                    <div className="flex1">
                      <Picker
                        label={t('notifPrefs.quietTo')}
                        value={st.quietTo}
                        icon="clock"
                        action="NTF-02.quietTo"
                        onClick={() =>
                          app.openSheet('SHT-29', {
                            value: st.quietTo,
                            onSelect: (v: string) =>
                              set({
                                quietTo: v,
                              }),
                          })
                        }
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </Card>
            <div className="col gap8">
              <span className="field-label">{t('notifPrefs.perClub')}</span>
              <Card>
                {sel()
                  .myClubs(u)
                  .map((m, i) => {
                    const cs = sel().clubSettings(u, m.clubId);
                    return (
                      <Fragment key={m.clubId}>
                      {i ? <div className="divider" /> : null}
                      <Tile
                        inCard
                        leading={<ClubEmblem club={m.club} cls="is-xs" size={16} />}
                        title={m.club.name}
                        subtitle={cs.muted ? t('notifPrefs.muted') : t('notifPrefs.customize')}
                        chevron
                        action={'NTF-02.club.' + m.clubId}
                        onClick={() =>
                          app.openSheet('SHT-07', {
                            clubId: m.clubId,
                          })
                        }
                      />
                      </Fragment>
                    );
                  })}
                {!sel().myClubs(u).length ? <p className="t-body-s c-muted p16">{t('notifPrefs.noClubs')}</p> : null}
              </Card>
            </div>
          </div>
        </Scroll>
      </>
    );
  },
};
