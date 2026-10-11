import {
  AppBar,
  Avatar,
  AvatarGroup,
  Badge,
  Banner,
  Button,
  CATEGORIES,
  Card,
  Chip,
  ClubCTA,
  ClubCard,
  Cover,
  DateBadge,
  EmptyState,
  EventCard,
  INTERESTS,
  Icon,
  IconButton,
  Illustration,
  Input,
  ListEnd,
  ListState,
  Logo,
  MemberRow,
  MyClubChip,
  POPULAR_SEARCHES,
  PopMenu,
  PostCard,
  Progress,
  RoleBadge,
  SCREENS,
  Scroll,
  SectionTitle,
  Segmented,
  SkeletonList,
  StatusBadge,
  StickyCTA,
  SuccessCheck,
  Switch,
  Tabs,
  Tile,
  UserRow,
  app,
  catName,
  copyText,
  coverArtSVG,
  cx,
  deptYear,
  placeName,
  startJoin,
  useBusy,
  useEffect,
  useForm,
  useMemo,
  useRef,
  useState,
  userName,
  A,
  LD,
  useLoader,
  db,
  session,
  prefs,
  handleError,
  openManage,
  ClubEmblem,
  useStorageUrl,
  notifPermission,
  Fragment,
} from '../ui/kit';
import * as P from '../data/repo/posts';
import { upload, prepareImage, StoragePaths } from '../data/repo/storage';
import { errCode } from '../data/fs';
import { istanbulDay } from '../lib/util';
/* ===== SCREENS: CLB · FED ===== */
const t = (k: string, p?: any) => app.t(k, p);
const S = SCREENS;
const sel = () => app.sel;
const DEFAULT_FILTERS = {
  categories: [],
  membership: 'all',
  openOnly: false,
  instantOnly: false,
  sort: 'popular',
};
const filtersOf = () => ({
  ...DEFAULT_FILTERS,
  ...(app.state.ui.clubFilters || {}),
});
const activeFilterCount = (f) =>
  (f.categories.length ? 1 : 0) + (f.membership !== 'all' ? 1 : 0) + (f.openOnly ? 1 : 0) + (f.instantOnly ? 1 : 0) + (f.sort !== 'popular' ? 1 : 0);
function applyClubFilters(list, f, u) {
  let out = list.filter((c) => c.status === 'active');
  if (f.categories.length) out = out.filter((c) => f.categories.includes(c.categoryId));
  if (f.membership === 'mine') out = out.filter((c) => sel().isMemberOf(c.id, u));
  if (f.membership === 'notMine') out = out.filter((c) => !sel().isMemberOf(c.id, u));
  if (f.openOnly) out = out.filter((c) => c.applicationsOpen);
  if (f.instantOnly) out = out.filter((c) => !c.approvalRequired);
  if (f.sort === 'popular') out.sort((a, b) => b.memberCount - a.memberCount);
  else if (f.sort === 'new') out.sort((a, b) => b.createdAt - a.createdAt);
  else out.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  return out;
}
export const clubFilters = {
  DEFAULT_FILTERS,
  filtersOf,
  applyClubFilters,
  activeFilterCount,
};

/* CLB-01 */
S['CLB-01'] = {
  tab: 'clubs',
  title: 'nav.clubs',
  comp: function Clubs({ route }: any) {
    const u = app.uid();
    const f = filtersOf();
    const grid = prefs.get().clubView === 'grid';
    const { status, reload } = useLoader(LD.clubsLoader());
    const mine = sel().myClubs(u);
    const all = applyClubFilters(sel().allClubs(), f, u);
    const nAct = activeFilterCount(f);
    const setF = (patch) =>
      app.dispatch('ui.set', {
        clubFilters: {
          ...f,
          ...patch,
        },
      });
    return (
      <>
        <AppBar large title={t('nav.clubs')}>
          <IconButton
            icon="search"
            label={t('common.search')}
            action="CLB-01.search"
            onClick={() =>
              app.nav.push('CLB-02', {
                tab: 'clubs',
              })
            }
          />
        </AppBar>
        <Scroll routeKey={route.key} onRefresh={() => Promise.all([reload(), session.reloadRsvps()])} refreshAction="CLB-01.refresh">
          {mine.length ? (
            <>
              <div
                className="section-title"
                style={{
                  marginTop: '0',
                }}
              >
                <h2 className="t-title-m">{t('clubs.my.title')}</h2>
              </div>
              <div className="hscroll pb16">
                {mine.map((m) => (
                  <MyClubChip
                    key={m.clubId}
                    club={m.club}
                    manager={m.role === 'board' || m.role === 'president'}
                    unread={sel()
                      .notifsFor(u)
                      .some((n) => !n.read && n.refs && n.refs.clubId === m.clubId)}
                  />
                ))}
                <button
                  type="button"
                  className="card is-tappable"
                  style={{
                    width: '100px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  data-action="CLB-01.myClubsAll"
                  onClick={() => app.nav.push('PRF-03')}
                >
                  <Icon name="arrow-right" size={22} class="c-brand" />
                  <span className="t-label-m c-brand">{t('common.all')}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="px16 pb16">
              <Card class="card-body row gap12" muted>
                <Illustration name="empty-clubs" size={72} />
                <div className="flex1 col gap6">
                  <span className="t-title-s">{t('clubs.first.title')}</span>
                  <span className="t-body-s c-sec">{t('clubs.first.desc')}</span>
                  <div>
                    <Button
                      size="sm"
                      variant="tonal"
                      label={t('clubs.first.cta')}
                      action="CLB-01.discover"
                      onClick={() => {
                        const el = document.querySelector('.screen .screen-scroll');
                        const target = document.getElementById('club-list');
                        if (el && target)
                          el.scrollTo({
                            top: target.offsetTop - 60,
                            behavior: 'smooth',
                          });
                      }}
                    />
                  </div>
                </div>
              </Card>
            </div>
          )}
          <div className="hscroll pb16">
            <Chip
              label={t('common.all')}
              selected={!f.categories.length}
              action="CLB-01.category.all"
              onClick={() =>
                setF({
                  categories: [],
                })
              }
            />
            {CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                icon={c.icon}
                label={t('cat.' + c.id)}
                selected={f.categories.length === 1 && f.categories[0] === c.id}
                action={'CLB-01.category.' + c.id}
                onClick={() =>
                  setF({
                    categories: f.categories.length === 1 && f.categories[0] === c.id ? [] : [c.id],
                  })
                }
              />
            ))}
          </div>
          <div className="row between px16 pb16" id="club-list">
            <span className="t-label-l c-sec tnum">
              {t('clubs.count', {
                count: all.length,
              })}
            </span>
            <span className="row gap4">
              <Button
                variant="outline"
                size="sm"
                icon="sliders-horizontal"
                label={t('common.filterSort')}
                action="CLB-01.filter"
                onClick={() => app.openSheet('SHT-04')}
              />
              {nAct ? (
                <span
                  className="badge-count"
                  aria-label={t('clubs.activeFilters', {
                    count: nAct,
                  })}
                >
                  {nAct}
                </span>
              ) : null}
              <IconButton
                icon={grid ? 'list' : 'layout-grid'}
                label={grid ? t('common.listView') : t('common.gridView')}
                action="CLB-01.toggleView"
                onClick={() =>
                  app.dispatch('session.set', {
                    clubView: grid ? 'list' : 'grid',
                  })
                }
              />
            </span>
          </div>
          <ListState n={6} variant="card" status={all.length ? 'ok' : status} onRetry={reload} retryAction="CLB-01.retry">
            {all.length ? (
              <>
                <div className={cx(grid ? 'grid2 px16' : 'col gap12 px16')}>
                  {all.map((c) => (
                    <ClubCard key={c.id} club={c} grid={grid} />
                  ))}
                </div>
                <ListEnd />
              </>
            ) : (
              <EmptyState
                illustration="empty-clubs"
                title={t('clubs.empty.title')}
                desc={t('clubs.empty.desc')}
                cta={t('clubs.empty.clear')}
                ctaAction="CLB-01.clearFilters"
                onCta={() =>
                  app.dispatch('ui.set', {
                    clubFilters: null,
                  })
                }
              />
            )}
          </ListState>
        </Scroll>
      </>
    );
  },
};

/* CLB-02 search */
function Highlight({ text, q }: any) {
  if (!q) return text;
  const i = text.toLocaleLowerCase('tr').indexOf(q.toLocaleLowerCase('tr'));
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <b>{text.slice(i, i + q.length)}</b>
      {text.slice(i + q.length)}
    </>
  );
}
S['CLB-02'] = {
  tab: 'clubs',
  title: 'search.title',
  comp: function Search({ params }: any) {
    const u = app.uid();
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [tab, setTab] = useState(params.tab || 'clubs');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
      setBusy(true);
      const id = setTimeout(() => {
        setDq(q.trim());
        setBusy(false);
      }, 250);
      return () => clearTimeout(id);
    }, [q]);
    const recents = prefs.get().recentSearches;
    useLoader(LD.clubsLoader());
    useLoader(tab === 'events' || dq ? LD.upcomingLoader() : null);
    const me = app.me();
    const suggested = useMemo(() => {
      const ints = (me && me.interests) || [];
      const cats = INTERESTS.filter((i) => ints.includes(i.id)).map((i) => i.cat);
      return sel()
        .visibleClubs()
        .filter((c) => !sel().isMemberOf(c.id, u))
        .sort((a, b) => (cats.includes(b.categoryId) ? 1 : 0) - (cats.includes(a.categoryId) ? 1 : 0))
        .slice(0, 3);
    }, [u]);
    const clubs = dq
      ? sel()
          .visibleClubs()
          .filter((c) => (c.name + ' ' + c.summary + ' ' + c.about + ' ' + catName(c)).toLocaleLowerCase('tr').includes(dq.toLocaleLowerCase('tr')))
      : [];
    const events = dq
      ? sel()
          .visibleEvents(u)
          .filter((e) => (e.title + ' ' + e.desc + ' ' + placeName(e)).toLocaleLowerCase('tr').includes(dq.toLocaleLowerCase('tr')))
      : [];
    const commit = () => {
      if (q.trim())
        app.dispatch('search.add', {
          q: q.trim(),
        });
    };
    return (
      <>
        <div
          className="row gap4"
          style={{
            padding: '4px 8px 4px 16px',
          }}
        >
          <div
            className="input flex1"
            style={{
              minHeight: '44px',
            }}
          >
            <Icon name="search" size={20} class="c-muted" />
            <input
              type="search"
              value={q}
              placeholder={t('search.placeholder')}
              aria-label={t('common.search')}
              data-action="CLB-02.input"
              data-autofocus="1"
              ref={(el) => {
                if (el && !el.dataset.f) {
                  el.dataset.f = '1';
                  setTimeout(() => el.focus(), 50);
                }
              }}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
            />
            {q ? <IconButton small icon="x" label={t('common.clear')} action="CLB-02.clear" onClick={() => setQ('')} /> : null}
          </div>
          <Button variant="text" label={t('common.cancel')} action="CLB-02.cancel" onClick={() => app.nav.back()} />
        </div>
        <Tabs
          tabs={[
            {
              id: 'clubs',
              label: t('nav.clubs'),
            },
            {
              id: 'events',
              label: t('nav.events'),
            },
          ]}
          value={tab}
          onChange={setTab}
          action="CLB-02.tab"
        />
        <Scroll routeKey="search">
          {!dq ? (
            <>
              {recents.length
                ? <>{<SectionTitle
                      key="rt"
                      title={t('search.recent')}
                      actionLabel={t('common.clear')}
                      action="CLB-02.clearRecent"
                      onAction={() => {
                        const prev = recents;
                        app.dispatch('search.set', {
                          list: [],
                        });
                        app.toast('TST-06', {
                          undo: () =>
                            app.dispatch('search.set', {
                              list: prev,
                            }),
                        });
                      }}
                    />}{recents.map((r, i) => (
                      <Tile
                        key={r}
                        leading={<Icon name="history" size={20} class="c-muted" />}
                        title={r}
                        action={'CLB-02.recent.' + i}
                        onClick={() => setQ(r)}
                        trailing={
                          <IconButton
                            small
                            icon="x"
                            label={t('common.remove')}
                            action={'CLB-02.removeRecent.' + i}
                            onClick={(e) => {
                              e.stopPropagation();
                              app.dispatch('search.remove', {
                                i,
                              });
                            }}
                          />
                        }
                      />
                    ))}</>
                : null}
              <SectionTitle title={t('search.popular')} />
              <div className="row wrap gap8 px16">
                {POPULAR_SEARCHES.map((p, i) => (
                  <Chip key={p} icon="trending-up" label={p} action={'CLB-02.popular.' + i} onClick={() => setQ(p)} />
                ))}
              </div>
              {tab === 'clubs' ? (
                <>
                  <SectionTitle title={t('search.suggested')} />
                  <div className="col gap12 px16">
                    {suggested.map((c) => (
                      <ClubCard key={c.id} club={c} screen="CLB-02" grid={false} />
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : busy ? (
            <SkeletonList n={3} />
          ) : tab === 'clubs' ? (
            clubs.length ? (
              <div className="col">
                {clubs.map((c) => (
                  <Tile
                    key={c.id}
                    leading={
                      <ClubEmblem club={c} cls="is-sm" size={20} />
                    }
                    title={<Highlight text={c.name} q={dq} />}
                    subtitle={`${catName(c)} · ${t('clubs.card.members', {
                      count: c.memberCount,
                    })}`}
                    chevron
                    action={'CLB-02.result.club.' + c.id}
                    onClick={() => {
                      commit();
                      app.nav.push('CLB-03', {
                        id: c.id,
                      });
                    }}
                  />
                ))}
              </div>
            ) : (
              <NoResults q={dq} onPick={setQ} />
            )
          ) : events.length ? (
            <div className="col">
              {events.map((e) => (
                <Tile
                  key={e.id}
                  leading={<DateBadge ts={e.startsAt} />}
                  title={<Highlight text={e.title} q={dq} />}
                  subtitle={`${(sel().club(e.clubId) || ({} as any)).name || ''} · ${app.fmt.date(e.startsAt)} ${app.fmt.time(e.startsAt)}`}
                  chevron
                  action={'CLB-02.result.event.' + e.id}
                  onClick={() => {
                    commit();
                    app.nav.push('EVT-02', {
                      id: e.id,
                    });
                  }}
                />
              ))}
            </div>
          ) : (
            <NoResults q={dq} onPick={setQ} />
          )}
        </Scroll>
      </>
    );
  },
};
function NoResults({ q, onPick }: any) {
  return (
    <div className="empty">
      <Illustration name="empty-clubs" size={100} />
      <h3 className="t-title-s">
        {t('search.noResults', {
          q,
        })}
      </h3>
      <div
        className="row wrap gap8"
        style={{
          justifyContent: 'center',
        }}
      >
        {POPULAR_SEARCHES.slice(0, 4).map((p, i) => (
          <Chip key={p} label={p} action={'CLB-02.suggest.' + i} onClick={() => onPick(p)} />
        ))}
      </div>
    </div>
  );
}

/* FED-01 feed (component used inside CLB-03) */
export function Feed({ clubId, screen = 'FED-01', highlightId }: any) {
  const u = app.uid();
  const manager = sel().isManager(clubId, u);
  const [filter, setFilter] = useState('all');
  const { status, reload } = useLoader({ key: 'feed:' + clubId, fn: () => A.loadFeed(clubId) });
  const page = db.feeds['feed:' + clubId];
  const [more, setMore] = useState(false);
  const posts = sel().clubPosts(clubId, u);
  const countRef = useRef(posts.length);
  const [fresh, setFresh] = useState(0);
  useEffect(() => {
    if (posts.length > countRef.current && countRef.current > 0) setFresh(posts.length - countRef.current);
    else countRef.current = posts.length;
  }, [posts.length]);
  const filtered = posts.filter(
    (p) =>
      filter === 'all' ||
      (filter === 'announcements' && p.type === 'announcement') ||
      (filter === 'polls' && p.type === 'poll') ||
      (filter === 'images' && p.images.length),
  );
  const loadMore = async () => {
    setMore(true);
    try {
      await A.loadFeed(clubId, true);
    } catch (e) {
      handleError(e);
    } finally {
      setMore(false);
    }
  };
  const compose = () =>
    app.nav.push('FED-03', {
      clubId,
    });
  return (
    <div className="col gap12 pt16">
      {manager ? (
        <div className="px16">
          <button
            type="button"
            className="card row gap12"
            style={{
              padding: '12px 16px',
              width: '100%',
              textAlign: 'left',
            }}
            data-action="FED-01.compose"
            onClick={compose}
          >
            <Avatar user={app.me()} size={36} />
            <span className="t-body-m c-muted flex1">{t('feed.composePlaceholder')}</span>
            <Icon name="pencil" size={18} class="c-brand" />
          </button>
        </div>
      ) : null}
      <div className="hscroll">
        {[
          ['all', t('common.all')],
          ['announcements', t('feed.filter.announcements')],
          ['polls', t('feed.filter.polls')],
          ['images', t('feed.filter.images')],
        ].map(([id, label]) => (
          <Chip key={id} label={label} selected={filter === id} action={'FED-01.filter.' + id} onClick={() => setFilter(id)} />
        ))}
      </div>
      {fresh ? (
        <div
          className="row"
          style={{
            justifyContent: 'center',
          }}
        >
          <Chip
            icon="arrow-up"
            label={t('feed.newPosts', {
              count: fresh,
            })}
            selected
            action="FED-01.newPosts"
            onClick={() => {
              countRef.current = posts.length;
              setFresh(0);
              const sc = document.querySelector('.screen .screen-scroll');
              sc &&
                sc.scrollTo({
                  top: 0,
                  behavior: 'smooth',
                });
            }}
          />
        </div>
      ) : null}
      <ListState n={3} variant="card" status={posts.length ? 'ok' : status} onRetry={reload} retryAction="FED-01.retry">
        {filtered.length ? (
          <>
            <div className="col gap12 px16">
              {filtered.map((p) => (
                <PostCard key={p.id} post={p} screen={screen} highlight={p.id === highlightId} />
              ))}
            </div>
            {page && page.hasMore ? (
              <div className="px16 pb16">
                <Button variant="outline" full label={t('web.loadMore')} loading={more} action="FED-01.loadMore" onClick={loadMore} />
              </div>
            ) : (
              <ListEnd />
            )}
          </>
        ) : (
          <EmptyState
            illustration="empty-posts"
            title={t('feed.empty.title')}
            desc={manager ? t('feed.empty.descManager') : t('feed.empty.desc')}
            cta={manager ? t('feed.empty.cta') : null}
            ctaAction="FED-01.compose"
            onCta={compose}
          />
        )}
      </ListState>
    </div>
  );
}
S['FED-01'] = {
  tab: 'clubs',
  title: 'feed.title',
  comp: function FeedScreen({ params }: any) {
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="FED-01.back" title={t('feed.title')} />
        <Scroll routeKey={'feed-' + params.id}>
          <Feed clubId={params.id} />
        </Scroll>
      </>
    );
  },
};

/* CLB-03 club detail */
S['CLB-03'] = {
  tab: 'clubs',
  title: 'club.title',
  comp: function ClubDetail({ params, route }: any) {
    const u = app.uid();
    const club = sel().club(params.id);
    const [tab, setTab] = useState(params.tab || 'about');
    const [py, setPy] = useState(0);
    const [more, setMore] = useState(false);
    const [evSeg, setEvSeg] = useState('upcoming');
    const clubLoad = useLoader(club ? null : LD.clubLoader(params.id));
    const inside = !!club && sel().canSeeInside(club.id, u);
    const boardLoad = useLoader(club ? LD.boardLoader(club.id, inside, club.presidentId) : null);
    const membersLoad = useLoader(club && inside && tab === 'members' ? LD.membersLoader(club.id, 5) : null);
    const eventsLoad = useLoader(club && tab === 'events' ? LD.clubPublicEventsLoader(club.id, inside) : null);
    if (!club) {
      if (clubLoad.status === 'error') return <NotFoundInline />;
      return (
        <>
          <AppBar onBack={() => app.nav.back()} backAction="CLB-03.back" title="" />
          <SkeletonList n={4} variant="card" />
        </>
      );
    }
    const mode = sel().mode(club.id, u);
    const members = LD.memberPageList(club.id).map((x) => ({ ...x, user: sel().user(x.userId) }));
    const boardList = sel().board(club.id);
    const president = sel().user(club.presidentId);
    const board = boardList.length ? boardList : president ? [{ userId: president.id, role: 'president', user: president }] : [];
    const adv = club.advisor;
    const advisor = adv && adv.userId ? sel().user(adv.userId) : null;
    const m = sel().membership(club.id, u);
    const social = club.social || {};
    const events = sel()
      .clubEvents(club.id)
      .filter((e) => e.status !== 'draft' && (inside || e.visibility === 'public'))
      .filter((e) => (evSeg === 'upcoming' ? e.endsAt >= Date.now() && e.status !== 'cancelled' : e.endsAt < Date.now() || e.status === 'cancelled'))
      .sort((a, b) => (evSeg === 'upcoming' ? a.startsAt - b.startsAt : b.startsAt - a.startsAt));
    const onScroll = (e) => setPy(Math.min(220, e.currentTarget.scrollTop));
    const link = (type, url) =>
      app.openDialog('DLG-32', {
        url,
        action: `CLB-03.about.link.${type}`,
      });
    const lockBlock = (text) => (
      <div className="empty">
        <Illustration name="locked" size={100} />
        <p className="t-body-m c-sec">{text}</p>
        {mode === 'visitor' || mode === 'pending' || mode === 'rejected' || mode === 'removed' ? <ClubCTA club={club} screen="CLB-03" /> : null}
      </div>
    );
    return (
      <>
      <div
        className="screen-scroll no-safe"
        onScroll={onScroll}
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
            seed={club.coverSeed}
            icon={club.iconName}
            palette={club.palette}
            pattern={club.pattern}
            path={club.coverPath}
            style={{
              height: '100%',
            }}
          />
          <div className="parallax-bar">
            <IconButton onCover icon="arrow-left" label={t('a11y.back')} action="CLB-03.back" onClick={() => app.nav.back()} />
            <span className="spacer" />
            <IconButton
              onCover
              icon="share-2"
              label={t('common.share')}
              action="CLB-03.share"
              onClick={() =>
                app.openSheet('SHT-15', {
                  type: 'club',
                  id: club.id,
                })
              }
            />
            <IconButton
              onCover
              icon="more-vertical"
              label={t('a11y.more')}
              action="CLB-03.menu"
              onClick={() =>
                app.openSheet('SHT-06', {
                  clubId: club.id,
                })
              }
            />
          </div>
        </div>
        {club.status === 'suspended' ? <Banner kind="warning" icon="ban" text={t('club.suspendedBanner')} /> : null}
        {mode === 'advisor' ? <Banner kind="readonly" text={t('mgt.readOnlyBanner')} /> : null}
        <div
          className="px16"
          style={{
            marginTop: '-36px',
            position: 'relative',
          }}
        >
          <ClubEmblem club={club} size={34} />
        </div>
        <div className="col gap8 px16 pt8">
          <h1 className="t-title-l">{club.name}</h1>
          <div className="row gap6 wrap">
            <Badge kind="neutral" label={catName(club)} />
            <Badge
              kind={club.approvalRequired ? 'info' : 'success'}
              icon={club.approvalRequired ? 'shield-check' : 'sparkles'}
              label={club.approvalRequired ? t('club.type.approval') : t('club.type.instant')}
            />
            {m && m.status === 'active' ? <RoleBadge role={m.role} /> : null}
          </div>
          <button
            type="button"
            className="row gap8"
            style={{
              textAlign: 'left',
            }}
            data-action="CLB-03.memberCount"
            onClick={() => setTab('members')}
            aria-label={t('clubs.card.members', {
              count: club.memberCount,
            })}
          >
            <AvatarGroup users={(members.length ? members : board).slice(0, 4).map((x) => x.user)} size={28} total={club.memberCount} />
            <span className="t-body-s c-sec tnum">
              {t('clubs.card.members', {
                count: club.memberCount,
              })}
            </span>
          </button>
        </div>
        <div className="pt16">
          <Tabs
            sticky
            tabs={[
              {
                id: 'about',
                label: t('club.tab.about'),
              },
              {
                id: 'events',
                label: t('club.tab.events'),
              },
              {
                id: 'posts',
                label: t('club.tab.posts'),
              },
              {
                id: 'members',
                label: t('club.tab.members'),
              },
            ]}
            value={tab}
            onChange={setTab}
            action="CLB-03.tab"
          />
        </div>
        {tab === 'about' ? (
          <div className="col gap20 px16 pt16 pb24">
            <div className="col gap8">
              <p className={cx('t-body-m', !more && 'clamp3')}>{club.about}</p>
              {!more ? (
                <button
                  type="button"
                  className="t-label-l c-brand"
                  style={{
                    textAlign: 'left',
                  }}
                  data-action="CLB-03.about.more"
                  onClick={() => setMore(true)}
                >
                  {t('common.readMore')}
                </button>
              ) : null}
              <span className="t-caption row gap4">
                <Icon name="landmark" size={14} />
                {t('club.founded', {
                  year: club.founded,
                })}
              </span>
            </div>
            {social.email || social.instagram || social.web ? (
              <Card>
                {[
                  social.email ? (
                    <Tile
                      key="email"
                      inCard
                      leading={<Icon name="mail" size={20} class="c-brand" />}
                      title={social.email}
                      subtitle={t('club.contact.email')}
                      action="CLB-03.about.link.email"
                      onClick={() => link('email', 'mailto:' + social.email)}
                    />
                  ) : null,
                  social.instagram ? (
                    <Tile
                      key="instagram"
                      inCard
                      leading={<Icon name="camera" size={20} class="c-brand" />}
                      title={social.instagram}
                      subtitle="Instagram"
                      action="CLB-03.about.link.instagram"
                      onClick={() => link('instagram', 'https://instagram.com/' + String(social.instagram).replace(/^@/, ''))}
                    />
                  ) : null,
                  social.web ? (
                    <Tile
                      key="web"
                      inCard
                      leading={<Icon name="globe" size={20} class="c-brand" />}
                      title={String(social.web).replace(/^https?:\/\//, '')}
                      subtitle={t('club.contact.web')}
                      action="CLB-03.about.link.web"
                      onClick={() => link('web', /^https?:/.test(String(social.web)) ? social.web : 'https://' + social.web)}
                    />
                  ) : null,
                ]
                  .filter(Boolean)
                  .flatMap((el, k) => (k ? [<div key={'d' + k} className="divider" />, el] : [el]))}
              </Card>
            ) : null}
            {adv ? (
            <div className="col gap8">
              <h2 className="t-title-s">{t('club.advisor')}</h2>
              <Card>
                <UserRow
                  user={advisor || { id: 'advisor', name: adv.name, avatarSeed: adv.name, avatarPath: null }}
                  sub={adv.title || t('role.advisor')}
                  action={'CLB-03.about.person.' + (advisor ? advisor.id : 'x')}
                  onClick={() =>
                    advisor &&
                    app.nav.push('CLB-07', {
                      id: advisor.id,
                      clubId: club.id,
                    })
                  }
                  inCard
                  chevron={!!advisor}
                />
              </Card>
            </div>
            ) : null}
            <div className="col gap8">
              <h2 className="t-title-s">{t('club.board')}</h2>
              <Card>
                {board.length === 0 && boardLoad.status === 'loading' ? <SkeletonList n={2} /> : null}
                {board.map((b, i) => <Fragment key={b.userId}>{i ? <div className="divider" /> : null}{<UserRow
                    key={b.userId}
                    user={b.user}
                    sub={deptYear(b.user)}
                    badge={<RoleBadge role={b.role} />}
                    action={'CLB-03.about.person.' + b.userId}
                    onClick={() =>
                      app.nav.push('CLB-07', {
                        id: b.userId,
                        clubId: club.id,
                      })
                    }
                    inCard
                    chevron
                  />}</Fragment>)}
              </Card>
            </div>
            <div className="col gap8">
              <h2 className="t-title-s">{t('club.conditions')}</h2>
              <ul className="col gap6 t-body-m c-sec">
                {(club.conditions || []).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <Button
              variant="text"
              icon="flag"
              label={t('club.report')}
              action="CLB-03.report"
              onClick={() =>
                app.openSheet('SHT-10', {
                  targetType: 'club',
                  targetId: club.id,
                })
              }
            />
          </div>
        ) : null}
        {tab === 'events' ? (
          <div className="col gap12 px16 pt16 pb24">
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
              ]}
              value={evSeg}
              onChange={setEvSeg}
              action="CLB-03.eventSeg"
            />
            {!inside ? <Banner kind="info" icon="lock" text={t('club.eventsVisitorNote')} /> : null}
            <ListState n={3} variant="card" status={events.length ? 'ok' : eventsLoad.status} onRetry={eventsLoad.reload} retryAction="CLB-03.events.retry">
              {events.length ? (
                events.map((e) => <EventCard key={e.id} ev={e} screen="CLB-03" compact showClub={false} />)
              ) : (
                <EmptyState illustration="empty-events" title={t('event.empty.title')} compact />
              )}
            </ListState>
          </div>
        ) : null}
        {tab === 'posts' ? inside ? <Feed clubId={club.id} highlightId={params.highlight} /> : lockBlock(t('club.postsLocked')) : null}
        {tab === 'members' ? (
          inside ? (
            <div className="col gap8 pt16 pb24">
              <div className="px16 t-label-l c-sec tnum">
                {t('clubs.card.members', {
                  count: club.memberCount,
                })}
              </div>
              {members.length === 0 && membersLoad.status !== 'error' ? <SkeletonList n={3} /> : null}
              {members.slice(0, 5).map((mm) => (
                <MemberRow key={mm.userId} m={mm} screen="CLB-03" clubId={club.id} />
              ))}
              <div className="px16">
                <Button
                  variant="outline"
                  full
                  label={t('club.allMembers')}
                  iconRight="arrow-right"
                  action="CLB-03.allMembers"
                  onClick={() =>
                    app.nav.push('CLB-06', {
                      id: club.id,
                    })
                  }
                />
              </div>
            </div>
          ) : (
            lockBlock(
              t('club.membersLocked', {
                count: club.memberCount,
              }),
            )
          )
        ) : null}
      </div>
      {club.status === 'suspended' ? null : mode === 'manager' || mode === 'super' ? (
        <StickyCTA>
          <Button
            icon="layout-grid"
            label={t('club.cta.manage')}
            action="CLB-03.openManage"
            onClick={() => openManage(club.id)}
          />
          <Button
            variant="tonal"
            icon="calendar-plus"
            label={t('club.cta.createEvent')}
            action="CLB-03.createEvent"
            onClick={() =>
              app.nav.push('MGT-05', {
                clubId: club.id,
              })
            }
          />
        </StickyCTA>
      ) : mode === 'advisor' ? (
        <StickyCTA>
          <Button
            variant="tonal"
            icon="eye"
            label={t('club.cta.viewManage')}
            action="CLB-03.openManage"
            onClick={() =>
              app.nav.push('MGT-01', {
                clubId: club.id,
              })
            }
          />
        </StickyCTA>
      ) : mode === 'member' ? null : (
        <StickyCTA>
          <div className="flex1 col gap4">
            {mode === 'visitor' && !club.applicationsOpen ? <span className="t-caption center">{t('club.closedNote')}</span> : null}
            {mode === 'rejected' && m && m.retryAfter && m.retryAfter > Date.now() ? (
              <span className="t-caption center">
                {t('application.retryAt', {
                  date: app.fmt.date(m.retryAfter),
                })}
              </span>
            ) : null}
            <ClubCTA club={club} screen="CLB-03" size="lg" full />
          </div>
        </StickyCTA>
      )}
      </>
    );
  },
};
export function NotFoundInline() {
  const C = SCREENS['SYS-04'].comp;
  return <C params={{}} />;
}

/* CLB-04 applied */
S['CLB-04'] = {
  tab: 'clubs',
  title: 'applied.title',
  comp: function Applied({ params }: any) {
    const u = app.uid();
    const club = sel().club(params.id);
    const m = sel().membership(params.id, u);
    const perm = notifPermission();
    if (!club) return <NotFoundInline />;
    return (
      <>
        <AppBar onBack={() => app.nav.popTo('CLB-03') || app.nav.back()} backAction="CLB-04.close" closeIcon title="" />
        <Scroll routeKey="applied">
          <div
            className="col gap16 px16 center"
            style={{
              alignItems: 'center',
              paddingTop: '16px',
            }}
          >
            <SuccessCheck size={110} />
            <h1 className="t-title-l">{t('applied.title')}</h1>
            <p className="t-body-m c-sec">{t('applied.desc')}</p>
            <Card
              class="card-body col gap8"
              style={{
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div className="row gap12">
                <ClubEmblem club={club} cls="is-sm" size={20} />
                <div className="flex1">
                  <div className="t-title-s">{club.name}</div>
                  <div className="t-caption">
                    {t('applied.sentAt', {
                      date: app.fmt.dateTime(m ? m.appliedAt : Date.now()),
                    })}
                  </div>
                </div>
              </div>
              {m && m.note ? (
                <p
                  className="t-body-s c-sec"
                  style={{
                    fontStyle: 'italic',
                  }}
                >
                  “{m.note}”
                </p>
              ) : null}
            </Card>
            {perm !== 'granted' ? (
              <Card
                muted
                class="card-body row gap12"
                style={{
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <Icon name="bell-ring" size={22} class="c-brand" />
                <span className="flex1 t-body-s">{t('applied.enableNotif')}</span>
                <Button size="sm" variant="tonal" label={t('common.open')} action="CLB-04.enableNotifications" onClick={() => app.openDialog('DLG-03')} />
              </Card>
            ) : null}
            <Button size="lg" full label={t('applied.browse')} action="CLB-04.browse" onClick={() => app.nav.openInTab('clubs', [])} />
            <Button
              variant="text"
              label={t('applied.myApplications')}
              action="CLB-04.myApplications"
              onClick={() =>
                app.nav.openInTab('profile', [
                  {
                    screen: 'PRF-03',
                    params: {
                      tab: 'pending',
                    },
                  },
                ])
              }
            />
          </div>
        </Scroll>
      </>
    );
  },
};

/* CLB-05 application status */
S['CLB-05'] = {
  tab: 'clubs',
  title: 'application.title',
  comp: function ApplicationStatus({ params }: any) {
    const u = app.uid();
    const club = sel().club(params.id);
    const m = sel().membership(params.id, u);
    const [note, setNote] = useState(m ? m.note : '');
    const [busy, run] = useBusy();
    if (!club) return <NotFoundInline />;
    const st0 = m ? m.status : 'none';
    const st = st0 === 'cancelled' || st0 === 'left' ? 'none' : st0;
    const steps = [
      {
        k: 'sent',
        done: true,
      },
      {
        k: 'review',
        done: st !== 'pending',
        active: st === 'pending',
      },
      {
        k: 'result',
        done: st === 'active' || st === 'rejected' || st === 'removed',
        danger: st === 'rejected' || st === 'removed',
      },
    ];
    const canRetry = sel().canReapply(m);
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="CLB-05.back" title={t('application.title')} />
        <Scroll routeKey="appstatus">
          <div className="col gap20 px16 pt8 pb24">
            <Card
              tappable
              action="CLB-05.openClub"
              onClick={() =>
                app.nav.push('CLB-03', {
                  id: club.id,
                })
              }
              label={club.name}
            >
              <div
                className="row gap12 card-body"
                style={{
                  padding: '12px 16px',
                }}
              >
                <ClubEmblem club={club} cls="is-sm" size={20} />
                <div className="flex1">
                  <div className="t-title-s">{club.name}</div>
                  <div className="t-caption">{catName(club)}</div>
                </div>
                <StatusBadge status={st === 'active' ? 'approved' : st === 'none' ? 'cancelled' : st} />
              </div>
            </Card>
            <div className="timeline">
              {steps.map((s, i) => (
                <div className="timeline-item" key={s.k}>
                  <div className="timeline-rail">
                    <span className={cx('timeline-dot', s.done && (s.danger ? 'is-danger' : 'is-done'), s.active && 'is-active')} />
                    {i < 2 ? <span className="timeline-line" /> : null}
                  </div>
                  <div className="col gap2 pb16">
                    <span className="t-label-l c-heading">{t('application.step.' + s.k)}</span>
                    <span className="t-caption">
                      {i === 0 && m
                        ? app.fmt.dateTime(m.appliedAt)
                        : i === 1
                          ? st === 'pending'
                            ? t('application.reviewing')
                            : m && m.decidedAt
                              ? app.fmt.dateTime(m.decidedAt)
                              : ''
                          : i === 2
                            ? st === 'active'
                              ? t('status.approved')
                              : st === 'rejected'
                                ? t('status.rejected')
                                : st === 'removed'
                                  ? t('status.removed')
                                  : t('application.waitingResult')
                            : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {st === 'pending' ? (
              <>
                <Input label={t('application.yourNote')} multiline maxLength={300} counter value={note} onInput={setNote} action="CLB-05.note" />
                <Button
                  variant="tonal"
                  label={t('common.save')}
                  loading={busy}
                  disabled={note === (m!.note || '')}
                  action="CLB-05.saveNote"
                  onClick={() =>
                    run(async () => {
                      if (!app.requireOnline()) return;
                      await A.saveApplicationNote(club.id, note.trim());
                      app.toast('TST-07');
                    })
                  }
                />
                <Button
                  variant="danger-outline"
                  label={t('application.cancel')}
                  action="CLB-05.cancel"
                  onClick={() =>
                    app.openDialog('DLG-07', {
                      clubId: club.id,
                    })
                  }
                />
              </>
            ) : null}
            {st === 'rejected' || st === 'removed'
              ? <>{m!.rejectReason ? (
                    <Card key="reason" muted class="card-body col gap4">
                      <span className="t-overline">{t('application.reason')}</span>
                      <span className="t-body-m">{t('rejectReason.' + m!.rejectReason)}</span>
                      {m!.rejectNote ? <span className="t-body-s c-sec">{m!.rejectNote}</span> : null}
                    </Card>
                  ) : null}{<div key="retry" className="row gap8">
                    <Badge
                      kind={canRetry ? 'success' : 'pending'}
                      icon="hourglass"
                      label={
                        canRetry
                          ? t('application.canReapply')
                          : t('application.retryAt', {
                              date: app.fmt.date(m!.retryAfter!),
                            })
                      }
                    />
                    {!canRetry ? <span className="t-caption">{app.fmt.countdown(m!.retryAfter!)}</span> : null}
                  </div>}{<Button
                    key="reapply"
                    label={t('application.reapply')}
                    disabled={!canRetry || !club.applicationsOpen}
                    action="CLB-05.reapply"
                    onClick={() => startJoin(club.id)}
                    onDisabledClick={() =>
                      app.toast(!club.applicationsOpen ? 'TST-X1' : 'TST-X4', {
                        date: app.fmt.date(m!.retryAfter!),
                      })
                    }
                  />}{!canRetry ? (
                    <p key="note" className="t-caption">
                      {t('application.retryNote')}
                    </p>
                  ) : null}</>
              : null}
            {st === 'active' ? (
              <>
                <Banner kind="success" text={t('application.approvedNote')} />
                <Button
                  label={t('application.goClub')}
                  action="CLB-05.openClub"
                  onClick={() =>
                    app.nav.push('CLB-03', {
                      id: club.id,
                    })
                  }
                />
              </>
            ) : null}
            {st === 'none' ? (
              <>
                <Banner kind="info" text={t('application.noneNote')} />
                <Button label={t('clubs.card.join')} action="CLB-05.reapply" onClick={() => startJoin(club.id)} />
              </>
            ) : null}
          </div>
        </Scroll>
      </>
    );
  },
};

/* CLB-06 members */
S['CLB-06'] = {
  tab: 'clubs',
  title: 'members.title',
  comp: function Members({ params }: any) {
    const u = app.uid();
    const club = sel().club(params.id);
    const [q, setQ] = useState('');
    const [role, setRole] = useState('all');
    const { status, reload } = useLoader(club && sel().canSeeInside(club.id, u) ? LD.allMembersLoader(club.id) : null);
    if (!club) return <NotFoundInline />;
    const manager = sel().isManager(club.id, u) || sel().isSuper(u);
    const nm = (m) => (m.user ? m.user.name : (m.applicant && m.applicant.name) || '');
    const all = sel()
      .clubMembers(club.id)
      .filter((m) => !q || nm(m).toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')))
      .filter((m) => role === 'all' || (role === 'board' && (m.role === 'board' || m.role === 'president')) || (role === 'member' && m.role === 'member'));
    const groups: Array<[string, any[]]> = (
      [
        ['president', all.filter((m) => m.role === 'president')],
        ['board', all.filter((m) => m.role === 'board')],
        ['advisor', all.filter((m) => m.role === 'advisor')],
        ['member', all.filter((m) => m.role === 'member').sort((a, b) => nm(a).localeCompare(nm(b), 'tr'))],
      ] as Array<[string, any[]]>
    ).filter(([, l]) => l.length);
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="CLB-06.back" title={t('members.title')} subtitle={club.name} />
        <div className="px16 pb16">
          <Input icon="search" placeholder={t('members.search')} value={q} onInput={setQ} action="CLB-06.search" ariaLabel={t('members.search')} />
        </div>
        <div className="hscroll pb16">
          {[
            ['all', t('common.all')],
            ['board', t('members.filter.board')],
            ['member', t('role.member')],
          ].map(([id, l]) => (
            <Chip key={id} label={l} selected={role === id} action={'CLB-06.filter.' + id} onClick={() => setRole(id)} />
          ))}
        </div>
        <Scroll routeKey={'members-' + club.id}>
          <ListState n={6} status={all.length ? 'ok' : status} onRetry={reload} retryAction="CLB-06.retry">
            {all.length ? (
              <>{<div key="total" className="px16 t-caption tnum pb16">
                  {t('members.total', {
                    count: all.length,
                  })}
                </div>}{groups.map(([r, list]) => (
                  <div key={r}>
                    <div className="group-head">
                      <span className="t-overline">{t('role.' + r)}</span>
                      <span className="t-caption tnum">{list.length}</span>
                    </div>
                    {list.map((m) => (
                      <MemberRow
                        key={m.userId}
                        m={m}
                        screen="CLB-06"
                        clubId={club.id}
                        onMenu={
                          manager && m.role !== 'president' && m.role !== 'advisor'
                            ? () =>
                                app.openSheet('SHT-21', {
                                  clubId: club.id,
                                  userId: m.userId,
                                })
                            : null
                        }
                      />
                    ))}
                  </div>
                ))}</>
            ) : (
              <EmptyState illustration="empty-clubs" title={t('members.noResults')} compact />
            )}
          </ListState>
        </Scroll>
      </>
    );
  },
};

/* CLB-07 other user's profile */
S['CLB-07'] = {
  tab: null,
  title: 'userprofile.title',
  comp: function UserProfile({ params }: any) {
    const u = app.uid();
    const usr = sel().user(params.id);
    const { status } = useLoader(LD.profileLoader(params.id, params.clubId));
    if (!usr) {
      if (status === 'loading' || status === 'idle')
        return (
          <>
            <AppBar onBack={() => app.nav.back()} backAction="CLB-07.back" title={t('userprofile.title')} />
            <SkeletonList n={3} />
          </>
        );
      return <NotFoundInline />;
    }
    const common = sel()
      .myClubs(u)
      .map((x) => x.club)
      .filter((c) => usr.id !== u && sel().membership(c.id, usr.id)?.status === 'active');
    const ctxClub = params.clubId ? sel().club(params.clubId) : null;
    const ctxM = ctxClub ? sel().membership(ctxClub.id, usr.id) : null;
    const managerCtx = ctxClub && (sel().isManager(ctxClub.id, u) || sel().isSuper(u)) && ctxM && ctxM.status === 'active' ? ctxM : null;
    const email = db.extra['email:' + usr.id] || null;
    const blocked = session.s.blocked.includes(usr.id);
    const visible = usr.status !== 'deleted' && (common.length > 0 || !!managerCtx || sel().isSuper(u) || usr.id === u);
    const roles = common
      .map((c) => ({
        club: c,
        role: sel().roleIn(c.id, usr.id),
      }))
      .filter((x) => x.role && x.role !== 'member');
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="CLB-07.back" title={t('userprofile.title')}>
          {usr.id !== u ? (
            <IconButton
              icon="more-vertical"
              label={t('a11y.more')}
              action="CLB-07.menu"
              onClick={() =>
                app.openSheet('SHT-27', {
                  userId: usr.id,
                })
              }
            />
          ) : null}
        </AppBar>
        <Scroll routeKey={'user-' + usr.id}>
          {blocked ? (
            <Banner
              kind="warning"
              icon="ban"
              text={t('userprofile.blockedBanner')}
              actionLabel={t('userprofile.unblock')}
              action="CLB-07.unblock"
              onAction={() =>
                A.unblockUser(usr.id)
                  .then(() =>
                    app.toast('TST-09', {
                      name: usr.name,
                      unblocked: true,
                      undo: () => A.blockUser(usr.id).catch(handleError),
                    }),
                  )
                  .catch(handleError)
              }
            />
          ) : null}
          <div
            className="col gap8 center px16 pt16"
            style={{
              alignItems: 'center',
            }}
          >
            <Avatar user={usr} size={96} />
            <h1 className="t-title-l">{usr.name}</h1>
            {visible ? <span className="t-body-m c-sec">{deptYear(usr)}</span> : null}
            {roles.length ? (
              <div
                className="row gap6 wrap"
                style={{
                  justifyContent: 'center',
                }}
              >
                {roles.map((r) => (
                  <RoleBadge key={r.club.id} role={r.role} />
                ))}
              </div>
            ) : null}
            {visible && usr.bio ? (
              <p
                className="t-body-s c-sec center"
                style={{
                  maxWidth: '280px',
                }}
              >
                {usr.bio}
              </p>
            ) : null}
          </div>
          {!visible ? (
            <div className="empty">
              <Illustration name="locked" size={96} />
              <p className="t-body-s c-sec">{t('userprofile.private')}</p>
            </div>
          ) : (
            <div className="col gap20 px16 pt24">
              {common.length ? (
                <div className="col gap8">
                  <h2 className="t-title-s">{t('userprofile.commonClubs')}</h2>
                  <div className="row wrap gap8">
                    {common.map((c) => (
                      <Chip
                        key={c.id}
                        icon={c.iconName}
                        label={c.name}
                        action={'CLB-07.club.' + c.id}
                        onClick={() =>
                          app.nav.push('CLB-03', {
                            id: c.id,
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {(managerCtx || sel().isSuper(u)) && email ? (
                <Card>
                  <Tile
                    inCard
                    leading={<Icon name="mail" size={20} class="c-muted" />}
                    title={email}
                    subtitle={t('auth.email')}
                    trailing={
                      <Button
                        size="sm"
                        variant="text"
                        icon="copy"
                        label={t('common.copy')}
                        action="CLB-07.copyEmail"
                        onClick={() => {
                          copyText(email);
                          app.toast('TST-08');
                        }}
                      />
                    }
                  />
                  {managerCtx ? (
                    <>
                      <div className="divider" />
                      <Tile
                        inCard
                        leading={<Icon name="shield-check" size={20} class="c-muted" />}
                        title={t('role.' + managerCtx.role)}
                        subtitle={t('userprofile.roleIn', {
                          club: ctxClub!.name,
                        })}
                      />
                      <div className="divider" />
                      <Tile
                        inCard
                        leading={<Icon name="calendar-check" size={20} class="c-muted" />}
                        title={managerCtx.decidedAt ? app.fmt.date(managerCtx.decidedAt) : '—'}
                        subtitle={t('userprofile.memberSince')}
                      />
                    </>
                  ) : null}
                </Card>
              ) : null}
              {managerCtx && managerCtx.role !== 'president' && managerCtx.role !== 'advisor' ? (
                <div className="col gap8">
                  {sel().isPresident(ctxClub!.id, u) || sel().isSuper(u) ? (
                    <Button
                      variant="outline"
                      icon="user-cog"
                      label={t('userprofile.changeRole')}
                      action="CLB-07.changeRole"
                      onClick={() =>
                        app.openSheet('SHT-22', {
                          clubId: ctxClub!.id,
                          userId: usr.id,
                        })
                      }
                    />
                  ) : null}
                  <Button
                    variant="danger-outline"
                    icon="user-x"
                    label={t('userprofile.remove')}
                    action="CLB-07.remove"
                    onClick={() =>
                      app.openDialog('DLG-19', {
                        clubId: ctxClub!.id,
                        userId: usr.id,
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          )}
        </Scroll>
      </>
    );
  },
};

/* FED-02 post detail */
S['FED-02'] = {
  tab: 'clubs',
  title: 'post.title',
  comp: function PostDetail({ params }: any) {
    const u = app.uid();
    const live = LD.usePostLive(params.postId, params.clubId);
    const post = sel().post(params.postId);
    const [text, setText] = useState('');
    const [busy, run] = useBusy();
    const canView = sel().canSeeInside(params.clubId, u);
    if (canView && (!post || live === 'loading') && live !== 'missing' && live !== 'error')
      return (
        <>
          <AppBar onBack={() => app.nav.back()} backAction="FED-02.back" title={t('post.title')} />
          <SkeletonList n={2} variant="card" />
        </>
      );
    if (canView && (!post || live === 'missing' || live === 'error' || post.isDeleted || (post.isHidden && !sel().isManager(post.clubId, u) && post.authorId !== u)))
      return <NotFoundInline />;
    const comments = post ? sel().postComments(post.id) : [];
    const advisor = sel().isAdvisor(params.clubId, u);
    const manager = sel().isManager(params.clubId, u) || sel().isSuper(u);
    const send = () =>
      run(async () => {
        if (!post || !text.trim()) return;
        if (!app.guard(post.clubId)) return;
        await A.addComment(post, text.trim());
        setText('');
        app.toast('TST-12');
        setTimeout(() => {
          const sc = document.querySelector('.screen .screen-scroll');
          sc &&
            sc.scrollTo({
              top: sc.scrollHeight,
              behavior: 'smooth',
            });
        }, 60);
      });
    const commentMenu = (c) => {
      if (c.authorId === u)
        app.openDialog('DLG-11', {
          commentId: c.id,
          postId: c.postId,
        });
      else if (manager)
        app.openSheet('SHT-27', {
          userId: c.authorId,
          commentId: c.id,
          postId: c.postId,
          clubId: c.clubId,
          canDelete: true,
        });
      else
        app.openSheet('SHT-27', {
          userId: c.authorId,
          commentId: c.id,
          postId: c.postId,
          clubId: c.clubId,
        });
    };
    if (!canView)
      return (
        <>
          <AppBar onBack={() => app.nav.back()} backAction="FED-02.back" title={t('post.title')} />
          <div className="empty">
            <Illustration name="locked" />
            <p className="t-body-m c-sec">{t('club.postsLocked')}</p>
            <Button
              label={t('club.goClub')}
              action="FED-02.club"
              onClick={() =>
                app.nav.push('CLB-03', {
                  id: params.clubId,
                })
              }
            />
          </div>
        </>
      );
    if (!post) return <NotFoundInline />;
    return (
      <>
      <AppBar onBack={() => app.nav.back()} backAction="FED-02.back" title={t('post.title')} subtitle={(sel().club(post.clubId) || ({} as any)).name} />
      <Scroll routeKey={'post-' + post.id}>
        <div className="px16 col gap16">
          <PostCard post={post} screen="FED-02" expanded showClub />
          <h2 className="t-title-s tnum">
            {t('post.comments', {
              count: comments.length,
            })}
          </h2>
          {comments.length ? (
            <div className="col gap4">
              {comments.map((c) => {
                const a = sel().user(c.authorId);
                const role = a ? sel().roleIn(post.clubId, a.id) : null;
                return (
                  <div
                    key={c.id}
                    className="row gap10 start"
                    style={{
                      padding: '8px 0',
                      alignItems: 'flex-start',
                    }}
                  >
                    <button
                      type="button"
                      data-action={'FED-02.author.' + c.id}
                      onClick={() =>
                        a &&
                        app.nav.push('CLB-07', {
                          id: a.id,
                          clubId: post.clubId,
                        })
                      }
                      aria-label={userName(a)}
                    >
                      <Avatar user={a} size={32} />
                    </button>
                    <div className="flex1 col gap2">
                      <span className="row gap6 wrap">
                        <span className="t-label-l c-heading">{userName(a)}</span>
                        {role && role !== 'member' ? <RoleBadge role={role} /> : null}
                        <span className="t-caption">{app.fmt.rel(c.createdAt)}</span>
                      </span>
                      <p className="t-body-m break">{c.text}</p>
                    </div>
                    <IconButton small icon="more-horizontal" label={t('a11y.more')} action={'FED-02.commentMenu.' + c.id} onClick={() => commentMenu(c)} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p
              className="t-body-s c-muted center"
              style={{
                padding: '16px',
              }}
            >
              {t('post.noComments')}
            </p>
          )}
        </div>
      </Scroll>
      {advisor ? (
        <Banner kind="readonly" text={t('post.advisorNoComment')} />
      ) : (
        <div
          className="ctabar"
          style={{
            alignItems: 'flex-end',
            gap: '8px',
          }}
        >
          <Avatar user={app.me()} size={36} />
          <div className="flex1">
            <Input
              multiline
              rows={1}
              value={text}
              onInput={(v) => setText(v.slice(0, 500))}
              maxLength={500}
              counter={400}
              placeholder={t('post.writeComment')}
              action="FED-02.commentInput"
              ariaLabel={t('post.writeComment')}
            />
          </div>
          <IconButton
            icon="send"
            label={t('common.send')}
            brand
            action="FED-02.sendComment"
            disabled={!text.trim() || busy}
            onClick={send}
            onDisabledClick={() => {}}
          />
        </div>
      )}
      </>
    );
  },
};

/* FED-03 compose */
S['FED-03'] = {
  tab: 'clubs',
  title: 'compose.title',
  comp: function Compose({ params }: any) {
    const u = app.uid();
    const editing = params.edit ? sel().post(params.edit) : null;
    const clubId = params.clubId || (editing && editing.clubId);
    const club = sel().club(clubId);
    const draft = (app.state.ui.drafts || {})[clubId];
    const init = () =>
      editing
        ? {
            postId: editing.id,
            type: editing.type,
            text: editing.text,
            title: editing.title || '',
            images: editing.images,
            pinned: editing.pinned,
            push: editing.pushSent,
            options: editing.poll ? editing.poll.options.map((o) => o.text) : ['', ''],
            duration: 3,
            showAfterVote: true,
            errors: {},
            dirty: false,
            preview: false,
          }
        : {
            postId: P.newPostId(),
            type: params.type === 'announcement' ? 'announcement' : 'post',
            text: '',
            title: '',
            images: [],
            pinned: false,
            push: true,
            options: ['', ''],
            duration: 3,
            showAfterVote: true,
            errors: {},
            dirty: false,
            preview: false,
            ...(draft || {}),
          };
    const [f, set, reset] = useForm('compose-' + clubId + (params.edit || ''), init);
    const [busy, run] = useBusy();
    const [menu, setMenu] = useState(false);
    const upd = (p) =>
      set({
        ...p,
        dirty: true,
      });
    useLoader(clubId && f.type === 'announcement' ? { key: 'ann:' + clubId, fn: async () => db.setExtra('ann:' + clubId + ':' + istanbulDay(Date.now()).key, await P.getTodayCount(clubId)) } : null);
    const used = sel().dailyAnnouncements(clubId);
    const limit = app.LIMITS.announcementDailyLimit;
    const limitReached = used >= limit;
    if (!club || !(sel().isManager(clubId, u) || sel().isSuper(u)))
      return (
        <>
          <AppBar onBack={() => app.nav.back()} backAction="FED-03.back" title={t('compose.title')} />
          <div className="empty">
            <Illustration name="locked" />
            <p className="t-body-s c-sec">{t('compose.noAccess')}</p>
          </div>
        </>
      );
    const valid =
      f.type === 'poll'
        ? f.text.trim() && f.options.filter((o) => o.trim()).length >= 2
        : f.type === 'announcement'
          ? f.title.trim() && f.text.trim()
          : f.text.trim();
    const validate = () => {
      const e: any = {};
      if (!f.text.trim()) e.text = t('auth.err.required');
      if (f.type === 'announcement' && !f.title.trim()) e.title = t('auth.err.required');
      if (f.type === 'poll') {
        const opts = f.options.map((o) => o.trim());
        if (opts.filter(Boolean).length < 2) e.options = t('compose.err.minOptions');
        else if (new Set(opts.filter(Boolean)).size !== opts.filter(Boolean).length) e.options = t('compose.err.dupOptions');
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
            saveDraft();
            app.closeDialog();
            reset();
            app.nav.back();
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
    const saveDraft = () => {
      app.dispatch('ui.set', {
        drafts: {
          ...(app.state.ui.drafts || {}),
          [clubId]: {
            ...f,
            dirty: false,
            errors: {},
            preview: false,
          },
        },
      });
      app.toast('TST-13');
    };
    const doPublish = (push) =>
      run(async () => {
        if (!app.guard(clubId)) return;
        const postId = f.postId;
        // yeni görselleri yükle (Storage kuralı metadata.clubId ile yöneticiyi doğrular)
        const images: any[] = [];
        for (const img of f.images) {
          if (img.path) images.push({ path: img.path, w: img.w, h: img.h });
          else {
            const path = await upload(StoragePaths.postImage(postId), { blob: img.blob, w: img.w, h: img.h }, { clubId });
            images.push({ path, w: img.w, h: img.h });
            upd({ images: f.images.map((x) => (x.key === img.key ? { path, w: img.w, h: img.h, key: img.key } : x)) });
          }
        }
        try {
          if (editing) {
            await A.updatePost(editing.id, {
              clubId,
              text: f.text.trim(),
              title: editing.type === 'announcement' ? f.title.trim() : editing.title,
              images: editing.type === 'post' ? images : editing.images,
              pinned: f.pinned,
            });
          } else {
            await A.createPost({
              clubId,
              postId,
              type: f.type,
              title: f.type === 'announcement' ? f.title.trim() : null,
              text: f.text.trim(),
              images: f.type === 'post' ? images : [],
              poll:
                f.type === 'poll'
                  ? { options: f.options.map((o) => o.trim()).filter(Boolean), durationDays: f.duration, showResultsAfterVote: f.showAfterVote }
                  : null,
              pinned: f.type !== 'poll' && f.pinned,
              push: f.type === 'announcement' && push,
            });
          }
        } catch (e) {
          if (errCode(e) === 'announcementLimit') {
            db.setExtra('ann:' + clubId + ':' + istanbulDay(Date.now()).key, limit);
            app.openDialog('DLG-24', {
              onPublishSilent: () => {
                app.closeDialog();
                doPublish(false);
              },
            });
            return;
          }
          throw e;
        }
        const drafts = {
          ...(app.state.ui.drafts || {}),
        };
        delete drafts[clubId];
        app.dispatch('ui.set', {
          drafts,
        });
        f.images.forEach((x) => x.url && URL.revokeObjectURL(x.url));
        reset();
        if (editing) {
          app.nav.back();
          app.toast('TST-14');
          return;
        }
        if (!app.nav.popTo('CLB-03')) app.nav.back();
        app.nav.replace('CLB-03', {
          id: clubId,
          tab: 'posts',
          highlight: postId,
        });
        app.toast('TST-14', {
          action: () =>
            app.nav.push('FED-02', {
              clubId,
              postId,
            }),
        });
      });
    const publish = () => {
      if (!validate()) return;
      if (f.type === 'announcement' && f.push && limitReached) {
        app.openDialog('DLG-24', {
          onPublishSilent: () => {
            app.closeDialog();
            doPublish(false);
          },
        });
        return;
      }
      doPublish(f.push);
    };
    const authorPreview: any = {
      id: 'preview',
      clubId,
      authorId: u,
      type: f.type,
      title: f.title,
      text: f.text || '…',
      images: f.images,
      poll:
        f.type === 'poll'
          ? {
              options: f.options.filter(Boolean).map((o, i) => ({
                id: 'o' + i,
                text: o,
              })),
              endsAt: Date.now() + f.duration * 864e5,
              showResultsAfterVote: true,
            }
          : null,
      pinned: f.pinned,
      createdAt: Date.now(),
      likes: [],
      likeCount: 0,
      commentCount: 0,
      pushSent: f.push,
    };
    return (
      <>
      <AppBar onBack={close} backAction="FED-03.close" closeIcon title={editing ? t('compose.editTitle') : t('compose.title')}>
        <IconButton icon="more-vertical" label={t('a11y.more')} action="FED-03.menu" onClick={() => setMenu(true)} />
        <Button
          size="sm"
          label={editing ? t('common.save') : t('compose.publish')}
          loading={busy}
          disabled={!valid}
          action="FED-03.publish"
          onClick={publish}
          onDisabledClick={validate}
        />
      </AppBar>
      {menu ? (
        <PopMenu id="FED-03" onClose={() => setMenu(false)}>
          <Tile
            title={t('compose.saveDraft')}
            leading={<Icon name="file-text" size={20} />}
            action="FED-03.saveDraft"
            onClick={() => {
              setMenu(false);
              saveDraft();
            }}
          />
          <Tile
            title={f.preview ? t('compose.edit') : t('compose.preview')}
            leading={<Icon name="eye" size={20} />}
            action="FED-03.preview"
            onClick={() => {
              setMenu(false);
              set({
                preview: !f.preview,
              });
            }}
          />
          <Tile
            title={t('compose.clear')}
            leading={<Icon name="trash-2" size={20} />}
            danger
            action="FED-03.clear"
            onClick={() => {
              setMenu(false);
              set({
                text: '',
                title: '',
                images: [],
                options: ['', ''],
                errors: {},
                dirty: true,
              });
            }}
          />
        </PopMenu>
      ) : null}
      <Scroll routeKey={'compose-' + clubId}>
        <div className="col gap16 px16 pt8 pb24">
          {f.preview ? (
            <>
              <Banner
                kind="info"
                icon="eye"
                text={t('compose.previewNote')}
                actionLabel={t('compose.edit')}
                action="FED-03.preview"
                onAction={() =>
                  set({
                    preview: false,
                  })
                }
              />
              <PostCard post={authorPreview} screen="FED-03" hideActions />
            </>
          ) : (
            <>
              {editing ? null : (
              <Segmented
                options={[
                  {
                    id: 'post',
                    label: t('feed.type.post'),
                    icon: 'file-text',
                  },
                  {
                    id: 'announcement',
                    label: t('feed.type.announcement'),
                    icon: 'megaphone',
                  },
                  {
                    id: 'poll',
                    label: t('feed.type.poll'),
                    icon: 'chart-column',
                  },
                ]}
                value={f.type}
                onChange={(v) =>
                  upd({
                    type: v,
                    errors: {},
                  })
                }
                action="FED-03.type"
              />
              )}
              <div className="row gap10">
                <Avatar user={app.me()} size={36} />
                <div className="flex1 col">
                  <span className="t-label-l c-heading">{(app.me() || ({} as any)).name}</span>
                  {sel().managedClubs(u).length > 1 ? (
                    <button
                      type="button"
                      className="t-caption c-brand row gap4"
                      data-action="FED-03.switchClub"
                      onClick={() =>
                        app.openSheet('SHT-18', {
                          onSelect: (cid) => {
                            app.closeSheet();
                            app.nav.replace('FED-03', {
                              clubId: cid,
                            });
                          },
                        })
                      }
                    >
                      {club.name} <Icon name="chevron-down" size={12} />
                    </button>
                  ) : (
                    <span className="t-caption">{club.name}</span>
                  )}
                </div>
              </div>
              {f.type === 'announcement' ? (
                <Input
                  label={t('compose.announcementTitle')}
                  value={f.title}
                  onInput={(v) =>
                    upd({
                      title: v.slice(0, 80),
                    })
                  }
                  maxLength={80}
                  counter
                  error={f.errors.title}
                  action="FED-03.title"
                />
              ) : null}
              <Input
                label={f.type === 'poll' ? t('compose.question') : t('compose.text')}
                multiline
                rows={f.type === 'poll' ? 2 : 5}
                value={f.text}
                onInput={(v) =>
                  upd({
                    text: v.slice(0, 1000),
                  })
                }
                maxLength={1000}
                counter
                error={f.errors.text}
                action="FED-03.text"
                placeholder={t('feed.composePlaceholder')}
                autofocus
              />
              {f.type === 'post' ? (
                <>
                  <div className="col gap8">
                    <div className="row between">
                      <span className="field-label">
                        {t('compose.images')}
                        {' ('}
                        {f.images.length}/4)
                      </span>
                      <Button
                        size="sm"
                        variant="tonal"
                        icon="image"
                        label={t('compose.addImage')}
                        disabled={f.images.length >= 4}
                        action="FED-03.addImage"
                        onClick={() =>
                          app.openSheet('SHT-16', {
                            multi: true,
                            max: 4 - f.images.length,
                            onPick: (files) =>
                              run(async () => {
                                const list = (Array.isArray(files) ? files : [files]).slice(0, 4 - f.images.length);
                                const added: any[] = [];
                                for (const file of list) {
                                  const pr = await prepareImage(file);
                                  added.push({ key: 'n' + Date.now() + Math.random(), blob: pr.blob, w: pr.w, h: pr.h, url: URL.createObjectURL(pr.blob) });
                                }
                                const cur = app.forms.data['compose-' + clubId + (params.edit || '')] || f;
                                upd({ images: [...cur.images, ...added].slice(0, 4) });
                              }),
                          })
                        }
                        onDisabledClick={() => app.toast('TST-X5')}
                      />
                    </div>
                    {f.images.length ? (
                      <div className="row gap8 wrap">
                        {f.images.map((s, i) => (
                          <div
                            key={s.key || s.path}
                            className="rel"
                            style={{
                              width: '72px',
                              height: '72px',
                              borderRadius: '12px',
                              overflow: 'hidden',
                            }}
                          >
                            <ComposeThumb img={s} club={club} />
                            <button
                              type="button"
                              className="iconbtn is-sm on-cover"
                              style={{
                                position: 'absolute',
                                right: '2px',
                                top: '2px',
                                width: '28px',
                                height: '28px',
                              }}
                              aria-label={t('common.remove')}
                              data-action={'FED-03.removeImage.' + i}
                              onClick={() =>
                                upd({
                                  images: f.images.filter((_, k) => k !== i),
                                })
                              }
                            >
                              <Icon name="x" size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="row between">
                    <span className="t-body-m">{t('compose.pin')}</span>
                    <Switch
                      checked={f.pinned}
                      onChange={(v) =>
                        upd({
                          pinned: v,
                        })
                      }
                      action="FED-03.pin"
                      label={t('compose.pin')}
                    />
                  </div>
                </>
              ) : null}
              {f.type === 'announcement' ? (
                <>
                  <div className="row between">
                    <div className="col">
                      <span className="t-body-m">{t('compose.pushToggle')}</span>
                      <span className="t-caption">{limitReached ? t('compose.limitReached') : t('compose.pushHelp')}</span>
                    </div>
                    <Switch
                      checked={f.push && !limitReached}
                      onChange={(v) =>
                        upd({
                          push: v,
                        })
                      }
                      action="FED-03.pushToggle"
                      label={t('compose.pushToggle')}
                      disabled={limitReached}
                      onDisabledClick={() =>
                        app.openDialog('DLG-24', {
                          onPublishSilent: () => app.closeDialog(),
                        })
                      }
                    />
                  </div>
                  <div className="col gap6">
                    <div className="row between t-caption">
                      <span>{t('compose.dailyQuota')}</span>
                      <span className="tnum">
                        {used}/{limit}
                      </span>
                    </div>
                    <Progress value={used} max={limit} kind={limitReached ? 'warning' : undefined} label={t('compose.dailyQuota')} />
                  </div>
                  <div className="row between">
                    <span className="t-body-m">{t('compose.pin')}</span>
                    <Switch
                      checked={f.pinned}
                      onChange={(v) =>
                        upd({
                          pinned: v,
                        })
                      }
                      action="FED-03.pin"
                      label={t('compose.pin')}
                    />
                  </div>
                  <div className="col gap6">
                    <span className="field-label">{t('compose.notifPreview')}</span>
                    <div
                      className="card card-body row gap12"
                      style={{
                        borderRadius: '16px',
                      }}
                    >
                      <span className="emblem is-xs">
                        <Logo size={20} />
                      </span>
                      <div className="flex1 col gap2">
                        <span className="row between">
                          <span className="t-label-m c-heading">{club.name}</span>
                          <span className="t-caption">{t('time.justNow')}</span>
                        </span>
                        <span className="t-label-l c-heading ellipsis">{f.title || t('compose.announcementTitle')}</span>
                        <span className="t-body-s c-sec clamp2">{f.text || t('compose.text')}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
              {f.type === 'poll' && !editing ? (
                <>
                  <div className="col gap8">
                    <span className="field-label">{t('compose.options')}</span>
                    {f.options.map((o, i) => (
                      <div key={i} className="row gap8">
                        <div className="flex1">
                          <Input
                            value={o}
                            onInput={(v) =>
                              upd({
                                options: f.options.map((x, k) => (k === i ? v.slice(0, 60) : x)),
                              })
                            }
                            placeholder={t('compose.optionN', {
                              n: i + 1,
                            })}
                            action={'FED-03.option.' + i}
                            ariaLabel={t('compose.optionN', {
                              n: i + 1,
                            })}
                          />
                        </div>
                        {f.options.length > 2 ? (
                          <IconButton
                            icon="trash-2"
                            label={t('common.remove')}
                            action={'FED-03.removeOption.' + i}
                            onClick={() =>
                              upd({
                                options: f.options.filter((_, k) => k !== i),
                              })
                            }
                          />
                        ) : null}
                      </div>
                    ))}
                    {f.errors.options ? (
                      <div className="field-help is-error" role="alert">
                        <Icon name="triangle-alert" size={14} />
                        <span>{f.errors.options}</span>
                      </div>
                    ) : null}
                    {f.options.length < 4 ? (
                      <Button
                        size="sm"
                        variant="text"
                        icon="plus"
                        label={t('compose.addOption')}
                        action="FED-03.addOption"
                        onClick={() =>
                          upd({
                            options: [...f.options, ''],
                          })
                        }
                      />
                    ) : null}
                  </div>
                  <div className="col gap6">
                    <span className="field-label">{t('compose.duration')}</span>
                    <Segmented
                      options={[1, 3, 7].map((d) => ({
                        id: String(d),
                        label: t('time.days', {
                          count: d,
                        }),
                      }))}
                      value={String(f.duration)}
                      onChange={(v) =>
                        upd({
                          duration: Number(v),
                        })
                      }
                      action="FED-03.duration"
                    />
                  </div>
                  <div className="row between">
                    <span className="t-body-m">{t('compose.showAfterVote')}</span>
                    <Switch
                      checked={f.showAfterVote}
                      onChange={(v) =>
                        upd({
                          showAfterVote: v,
                        })
                      }
                      action="FED-03.showAfterVote"
                      label={t('compose.showAfterVote')}
                    />
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </Scroll>
      </>
    );
  },
};
function ComposeThumb({ img, club }: any) {
  const remote = useStorageUrl(img.url ? null : img.path);
  const src = img.url || remote;
  return src ? (
    <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
  ) : (
    <div
      style={{ position: 'absolute', inset: '0' }}
      dangerouslySetInnerHTML={{ __html: coverArtSVG(img.path || 'x', club.iconName, club.palette, undefined, { w: 200, h: 200 }) }}
    />
  );
}
