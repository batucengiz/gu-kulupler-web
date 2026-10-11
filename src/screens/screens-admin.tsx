import {
  AppBar,
  Avatar,
  Badge,
  Button,
  CATEGORIES,
  Card,
  Chip,
  Donut,
  EmptyState,
  Icon,
  IconButton,
  Illustration,
  Input,
  KPI,
  ListState,
  MiniLineChart,
  Picker,
  PopMenu,
  Progress,
  RoleBadge,
  SCREENS,
  Scroll,
  Segmented,
  StatusBadge,
  StickyCTA,
  Switch,
  Tabs,
  Tile,
  UserRow,
  app,
  coverArtSVG,
  cx,
  deptYear,
  useBusy,
  useForm,
  useState,
  userName,
} from '../ui/kit';
/* ===== SCREENS: ADM (super admin) ===== */
const t = (k: string, p?: any) => app.t(k, p);
const S = SCREENS;
const sel = () => app.sel;
const ADMIN_SCREENS = [
  ['ADM-01', 'admin.seg.overview'],
  ['ADM-02', 'admin.seg.clubs'],
  ['ADM-04', 'admin.seg.reports'],
  ['ADM-05', 'admin.seg.users'],
];
function AdminNav({ current }: any) {
  return (
    <div className="px16 pb16">
      <Segmented
        options={ADMIN_SCREENS.map(([id, k]) => ({
          id,
          label: t(k),
        }))}
        value={current}
        onChange={(id) => app.nav.replace(id)}
        action={current + '.seg'}
      />
    </div>
  );
}
function NoAdmin({ screen }: any) {
  return (
    <>
      <AppBar onBack={() => app.nav.back()} backAction={screen + '.back'} title="" />
      <div className="empty">
        <Illustration name="locked" />
        <p className="t-body-s c-sec">{t('admin.noAccess')}</p>
      </div>
    </>
  );
}
const isSuper = () => sel().isSuper(app.uid());

/* ADM-01 */
S['ADM-01'] = {
  tab: 'admin',
  title: 'nav.admin',
  comp: function Overview({ route }: any) {
    const [range, setRange] = useState('30');
    const [sort] = useState();
    if (!isSuper()) return <NoAdmin screen="ADM-01" />;
    const clubs = sel().allClubs();
    const active = clubs.filter((c) => c.status === 'active');
    const suspended = clubs.filter((c) => c.status === 'suspended');
    const users = Object.values(app.state.users).filter((u) => !u.deleted);
    const openReports = sel().reports('open');
    const k = range === '7' ? 0.35 : range === '30' ? 1 : 2.4;
    const wau = [120, 134, 141, 160, 158, 176, 190, 204].map((v) => Math.round(v * (range === '7' ? 0.9 : range === '30' ? 1 : 1.15)));
    const top = active
      .slice()
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 5);
    const max = top[0] ? top[0].memberCount : 1;
    const allPast = Object.values(app.state.events).filter((e) => e.endsAt < Date.now() && e.status === 'published');
    const regs = allPast.reduce((a, e) => a + sel().registered(e.id).length, 0);
    const atts = allPast.reduce((a, e) => a + sel().attended(e.id).length, 0);
    const rate = regs ? (atts / regs) * 100 : 0;
    return (
      <>
        <AppBar large title={t('nav.admin')}>
          <RoleBadge role="superadmin" />
        </AppBar>
        <AdminNav current="ADM-01" />
        <Scroll routeKey={route.key}>
          <div className="col gap20 px16 pb24">
            <div className="row gap8">
              {[
                ['7', t('admin.range.7')],
                ['30', t('admin.range.30')],
                ['term', t('admin.range.term')],
              ].map(([id, l]) => (
                <Chip key={id} label={l} selected={range === id} action={'ADM-01.range.' + id} onClick={() => setRange(id)} />
              ))}
            </div>
            <div className="grid2">
              <KPI
                label={t('admin.kpi.activeClubs')}
                value={active.length}
                icon="users-round"
                action="ADM-01.kpi.clubs"
                onClick={() => app.nav.replace('ADM-02')}
              />
              <KPI
                label={t('admin.kpi.users')}
                value={app.fmt.num(users.length)}
                sub={t('admin.kpi.newUsers', {
                  count: Math.round(18 * k),
                })}
                icon="user"
                action="ADM-01.kpi.users"
                onClick={() => app.nav.replace('ADM-05')}
              />
              <KPI
                label={t('admin.kpi.suspended')}
                value={suspended.length}
                icon="ban"
                action="ADM-01.kpi.suspended"
                onClick={() =>
                  app.nav.replace('ADM-02', {
                    tab: 'suspended',
                  })
                }
              />
              <KPI
                label={t('admin.kpi.openReports')}
                value={openReports.length}
                accent
                icon="flag"
                action="ADM-01.kpi.reports"
                onClick={() => app.nav.replace('ADM-04')}
              />
            </div>
            <Card class="card-body col gap8">
              <span className="t-label-l c-heading">{t('admin.wau')}</span>
              <MiniLineChart
                data={wau}
                labels={wau.map((_, i) =>
                  t('mgt.weekN', {
                    n: i - 7,
                  }),
                )}
                action="ADM-01.chart.point"
              />
            </Card>
            <Card class="card-body col gap10">
              <span className="t-label-l c-heading">{t('admin.topClubs')}</span>
              {top.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className="col gap4"
                  style={{
                    textAlign: 'left',
                    width: '100%',
                  }}
                  data-action={'ADM-01.topClub.' + c.id}
                  onClick={() =>
                    app.nav.push('CLB-03', {
                      id: c.id,
                    })
                  }
                >
                  <span className="row between">
                    <span className="t-body-s c-heading ellipsis">{c.name}</span>
                    <span className="t-caption tnum">{c.memberCount}</span>
                  </span>
                  <Progress value={c.memberCount} max={max} thin label={c.name} />
                </button>
              ))}
            </Card>
            <Card class="card-body row gap16">
              <Donut value={rate} label={t('admin.attendanceRate')} />
              <div className="col gap4 flex1">
                <span className="t-label-l c-heading">{t('admin.attendanceRate')}</span>
                <span className="t-body-s c-sec">
                  {t('admin.attendanceDesc', {
                    events: allPast.length,
                    attended: atts,
                    registered: regs,
                  })}
                </span>
              </div>
            </Card>
            <div className="col gap8">
              <h2 className="t-title-s">{t('admin.pendingTasks')}</h2>
              <Card>
                <Tile
                  inCard
                  leading={
                    <span className="notif-icon ni-warning">
                      <Icon name="flag" size={18} />
                    </span>
                  }
                  title={t('admin.task.reports', {
                    count: openReports.length,
                  })}
                  chevron
                  action="ADM-01.task.reports"
                  onClick={() => app.nav.replace('ADM-04')}
                />
                <div className="divider" />
                <Tile
                  inCard
                  leading={
                    <span className="notif-icon ni-danger">
                      <Icon name="ban" size={18} />
                    </span>
                  }
                  title={t('admin.task.suspended', {
                    count: suspended.length,
                  })}
                  chevron
                  action="ADM-01.task.suspended"
                  onClick={() =>
                    app.nav.replace('ADM-02', {
                      tab: 'suspended',
                    })
                  }
                />
              </Card>
            </div>
          </div>
        </Scroll>
      </>
    );
  },
};

/* ADM-02 */
S['ADM-02'] = {
  tab: 'admin',
  title: 'adminClubs.title',
  comp: function AdminClubs({ params, route }: any) {
    const [tab, setTab] = useState(params.tab || 'active');
    const [q, setQ] = useState('');
    const [menu, setMenu] = useState<any>(null);
    if (!isSuper()) return <NoAdmin screen="ADM-02" />;
    const list = sel()
      .allClubs()
      .filter((c) => c.status === tab)
      .filter((c) => !q || c.name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return [
      <AppBar large title={t('nav.admin')}>
        <RoleBadge role="superadmin" />
      </AppBar>,
      <AdminNav current="ADM-02" />,
      <div className="px16 pb16 col gap8">
        <Segmented
          options={[
            {
              id: 'active',
              label: t('status.active'),
            },
            {
              id: 'suspended',
              label: t('status.suspended'),
            },
          ]}
          value={tab}
          onChange={setTab}
          action="ADM-02.tab"
        />
        <Input icon="search" placeholder={t('common.search')} value={q} onInput={setQ} action="ADM-02.search" ariaLabel={t('common.search')} />
      </div>,
      <Scroll routeKey={route.key}>
        <ListState
          n={5}
          emptyProps={{
            illustration: 'empty-clubs',
            title: t('adminClubs.empty'),
          }}
        >
          {list.length ? (
            list.map((c) => {
              const pres = sel().user(c.presidentId);
              return (
                <Tile
                  key={c.id}
                  leading={
                    <span className="emblem is-sm">
                      <Icon name={c.iconName} size={20} />
                    </span>
                  }
                  title={c.name}
                  subtitle={`${t('role.president')}: ${userName(pres)} · ${t('clubs.card.members', {
                    count: c.memberCount,
                  })}`}
                  sub2={<StatusBadge status={c.status} />}
                  action={'ADM-02.row.' + c.id}
                  onClick={() =>
                    app.nav.push('CLB-03', {
                      id: c.id,
                    })
                  }
                  trailing={
                    <IconButton
                      icon="more-vertical"
                      label={t('a11y.more')}
                      action={'ADM-02.menu.' + c.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenu(c);
                      }}
                    />
                  }
                />
              );
            })
          ) : (
            <EmptyState illustration="empty-clubs" title={t('adminClubs.empty')} />
          )}
        </ListState>
      </Scroll>,
      <button
        type="button"
        className="fab"
        style={{
          bottom: 'calc(var(--nav-h) + 16px)',
        }}
        data-action="ADM-02.create"
        onClick={() => app.nav.push('ADM-03')}
      >
        <Icon name="plus" size={22} />
        {t('adminClubs.create')}
      </button>,
      menu ? (
        <PopMenu id="ADM-02" onClose={() => setMenu(null)}>
          <Tile
            title={t('common.view')}
            leading={<Icon name="eye" size={20} />}
            action={'ADM-02.menu.' + menu.id + '.view'}
            onClick={() => {
              setMenu(null);
              app.nav.push('CLB-03', {
                id: menu.id,
              });
            }}
          />
          <Tile
            title={t('common.edit')}
            leading={<Icon name="pencil" size={20} />}
            action={'ADM-02.menu.' + menu.id + '.edit'}
            onClick={() => {
              setMenu(null);
              app.nav.push('ADM-03', {
                id: menu.id,
              });
            }}
          />
          <Tile
            title={t('adminClubs.changePresident')}
            leading={<Icon name="crown" size={20} />}
            action={'ADM-02.menu.' + menu.id + '.president'}
            onClick={() => {
              const c = menu;
              setMenu(null);
              app.openSheet('SHT-25', {
                mode: 'assign',
                clubId: c.id,
                onSelect: (uid) => {
                  app.closeSheet();
                  app.dispatch('membership.transfer', {
                    clubId: c.id,
                    fromId: c.presidentId,
                    toId: uid,
                  });
                  app.toast('TST-49', {
                    name: sel().user(uid).name,
                  });
                },
              });
            }}
          />
          <Tile
            title={menu.status === 'active' ? t('adminClubs.suspend') : t('adminClubs.activate')}
            danger={menu.status === 'active'}
            leading={<Icon name={menu.status === 'active' ? 'ban' : 'circle-check'} size={20} />}
            action={'ADM-02.menu.' + menu.id + '.suspend'}
            onClick={() => {
              const c = menu;
              setMenu(null);
              app.openDialog('DLG-28', {
                clubId: c.id,
              });
            }}
          />
        </PopMenu>
      ) : null,
    ];
  },
};

/* ADM-03 */
S['ADM-03'] = {
  tab: 'admin',
  title: 'clubForm.title',
  comp: function ClubForm({ params }: any) {
    const editing = params.id ? sel().club(params.id) : null;
    if (!isSuper()) return <NoAdmin screen="ADM-03" />;
    const init = () =>
      editing
        ? {
            name: editing.name,
            categoryId: editing.categoryId,
            summary: editing.summary,
            about: editing.about,
            iconName: editing.iconName,
            cover: {
              palette: editing.palette,
              pattern: editing.pattern,
              seed: editing.coverSeed,
            },
            presidentId: editing.presidentId,
            advisorName: (sel().user(editing.advisorId) || {}).name || '',
            advisorTitle: '',
            applicationsOpen: editing.applicationsOpen,
            approvalRequired: editing.approvalRequired,
            errors: {},
            dirty: false,
          }
        : {
            name: '',
            categoryId: null,
            summary: '',
            about: '',
            iconName: 'sparkles',
            cover: {
              palette: 'red',
              pattern: 'mountain',
              seed: 'club-new-' + Date.now(),
            },
            presidentId: null,
            advisorName: '',
            advisorTitle: '',
            applicationsOpen: true,
            approvalRequired: true,
            errors: {},
            dirty: false,
          };
    const [f, set, reset] = useForm('clubForm-' + (params.id || 'new'), init);
    const [busy, run] = useBusy();
    const upd = (p) =>
      set({
        ...p,
        dirty: true,
      });
    const close = () => {
      if (f.dirty)
        app.openDialog('DLG-25', {
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
        if (!f.name.trim()) e.name = t('auth.err.required');
        else if (
          sel()
            .allClubs()
            .some((c) => c.name.toLocaleLowerCase('tr') === f.name.trim().toLocaleLowerCase('tr') && (!editing || c.id !== editing.id))
        )
          e.name = t('clubForm.err.unique');
        if (!f.categoryId) e.categoryId = t('auth.err.required');
        if (!f.presidentId) e.presidentId = t('auth.err.required');
        set({
          errors: e,
        });
        if (Object.keys(e).length) return;
        if (!app.requireOnline()) return;
        await app.api();
        const cat = CATEGORIES.find((c) => c.id === f.categoryId);
        const patch = {
          name: f.name.trim(),
          categoryId: f.categoryId,
          summary: f.summary,
          about: f.about,
          iconName: cat ? cat.icon : f.iconName,
          palette: f.cover.palette,
          pattern: f.cover.pattern,
          coverSeed: f.cover.seed,
          applicationsOpen: f.applicationsOpen,
          approvalRequired: f.approvalRequired,
          advisorDisplay: f.advisorName ? `${f.advisorTitle} ${f.advisorName}`.trim() : null,
        };
        if (editing) {
          app.dispatch('club.update', {
            clubId: editing.id,
            patch,
            actorId: app.uid(),
          });
          if (f.presidentId !== editing.presidentId)
            app.dispatch('membership.transfer', {
              clubId: editing.id,
              fromId: editing.presidentId,
              toId: f.presidentId,
            });
          app.toast('TST-21');
        } else {
          app.dispatch('club.create', {
            club: {
              ...patch,
              advisorId: null,
            },
            presidentId: f.presidentId,
            actorId: app.uid(),
          });
          app.toast('TST-33');
        }
        reset();
        app.nav.popTo('ADM-02') || app.nav.replace('ADM-02');
      });
    const pres = f.presidentId ? sel().user(f.presidentId) : null;
    return (
      <>
        <AppBar onBack={close} backAction="ADM-03.close" closeIcon title={editing ? t('clubForm.editTitle') : t('clubForm.title')} />
        <Scroll routeKey={'clubform-' + (params.id || 'new')}>
          <div className="col gap16 px16 pt8 pb24">
            <Input
              label={t('clubSettings.name')}
              value={f.name}
              onInput={(v) =>
                upd({
                  name: v.slice(0, 80),
                })
              }
              error={f.errors.name}
              action="ADM-03.name"
              autofocus
            />
            <Picker
              label={t('clubSettings.category')}
              icon="layout-grid"
              value={f.categoryId ? t('cat.' + f.categoryId) : ''}
              placeholder={t('common.select')}
              error={f.errors.categoryId}
              action="ADM-03.category"
              onClick={() =>
                app.openSheet('SHT-33', {
                  value: f.categoryId,
                  onSelect: (id) =>
                    upd({
                      categoryId: id,
                      errors: {
                        ...f.errors,
                        categoryId: null,
                      },
                    }),
                })
              }
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
              action="ADM-03.summary"
            />
            <Input
              label={t('clubSettings.about')}
              multiline
              rows={4}
              value={f.about}
              onInput={(v) =>
                upd({
                  about: v.slice(0, 1000),
                })
              }
              maxLength={1000}
              counter
              action="ADM-03.about"
            />
            <div className="row gap12">
              <button
                type="button"
                className="emblem"
                data-action="ADM-03.logo"
                onClick={() =>
                  app.openSheet('SHT-16', {
                    onPick: () => app.toast('TST-57'),
                  })
                }
                aria-label={t('clubSettings.logo')}
              >
                <Icon name={f.categoryId ? (CATEGORIES.find((c) => c.id === f.categoryId) || {}).icon || f.iconName : f.iconName} size={30} />
              </button>
              <button
                type="button"
                className="cover flex1"
                style={{
                  borderRadius: '16px',
                  position: 'relative',
                  height: '72px',
                }}
                data-action="ADM-03.cover"
                onClick={() =>
                  app.openSheet('SHT-31', {
                    value: f.cover,
                    icon: f.iconName,
                    onSelect: (c) =>
                      upd({
                        cover: c,
                      }),
                  })
                }
                aria-label={t('clubSettings.cover')}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '0',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: coverArtSVG(f.cover.seed, f.iconName, f.cover.palette, f.cover.pattern),
                  }}
                />
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
            <div className="col gap8">
              <span className="field-label">
                <span>{t('clubForm.president')}</span>
              </span>
              {pres ? (
                <Card>
                  <UserRow
                    user={pres}
                    sub={deptYear(pres)}
                    inCard
                    trailing={
                      <Button
                        size="sm"
                        variant="text"
                        label={t('common.remove')}
                        action="ADM-03.removePresident"
                        onClick={() =>
                          upd({
                            presidentId: null,
                          })
                        }
                      />
                    }
                  />
                </Card>
              ) : (
                <Button
                  variant="outline"
                  icon="user-plus"
                  label={t('clubForm.assignPresident')}
                  action="ADM-03.assignPresident"
                  onClick={() =>
                    app.openSheet('SHT-25', {
                      mode: 'assign',
                      onSelect: (uid) => {
                        app.closeSheet();
                        upd({
                          presidentId: uid,
                          errors: {
                            ...f.errors,
                            presidentId: null,
                          },
                        });
                      },
                    })
                  }
                />
              )}
              {f.errors.presidentId ? (
                <div className="field-help is-error" role="alert">
                  <Icon name="triangle-alert" size={14} />
                  <span>{f.errors.presidentId}</span>
                </div>
              ) : null}
            </div>
            <div className="row gap8">
              <div
                style={{
                  width: '120px',
                }}
              >
                <Input
                  label={t('clubForm.advisorTitle')}
                  value={f.advisorTitle}
                  onInput={(v) =>
                    upd({
                      advisorTitle: v,
                    })
                  }
                  placeholder="Dr."
                  action="ADM-03.advisorTitle"
                />
              </div>
              <div className="flex1">
                <Input
                  label={t('club.advisor')}
                  value={f.advisorName}
                  onInput={(v) =>
                    upd({
                      advisorName: v,
                    })
                  }
                  action="ADM-03.advisorName"
                />
              </div>
            </div>
            <Card>
              {[
                ['applicationsOpen', 'lock-open'],
                ['approvalRequired', 'shield-check'],
              ].map(([k, icon], i) => [
                i ? <div className="divider" /> : null,
                <div key={k} className="tile is-plain in-card">
                  <Icon name={icon} size={20} class="c-muted" />
                  <span className="tile-text t-body-m c-heading">{t('clubSettings.' + k)}</span>
                  <Switch
                    checked={f[k]}
                    onChange={(v) =>
                      upd({
                        [k]: v,
                      })
                    }
                    action={'ADM-03.toggle.' + k}
                    label={t('clubSettings.' + k)}
                  />
                </div>,
              ])}
            </Card>
          </div>
        </Scroll>
        <StickyCTA>
          <Button full label={editing ? t('common.save') : t('clubForm.create')} loading={busy} action="ADM-03.save" onClick={save} />
        </StickyCTA>
      </>
    );
  },
};

/* ADM-04 */
S['ADM-04'] = {
  tab: 'admin',
  title: 'reports.title',
  comp: function Reports({ params, route }: any) {
    const [tab, setTab] = useState('open');
    const [type, setType] = useState('all');
    if (!isSuper()) return <NoAdmin screen="ADM-04" />;
    const list = sel()
      .reports(tab)
      .filter((r) => type === 'all' || r.targetType === type);
    const preview = (r) => {
      const st = app.state;
      if (r.targetType === 'post') {
        const p = st.posts[r.targetId];
        return p ? p.title || p.text : t('saved.removed');
      }
      if (r.targetType === 'comment') {
        const c = st.comments[r.targetId];
        return c ? c.text : t('saved.removed');
      }
      if (r.targetType === 'user') return userName(st.users[r.targetId]);
      if (r.targetType === 'club') return (st.clubs[r.targetId] || {}).name || '';
      if (r.targetType === 'event') return (st.events[r.targetId] || {}).title || '';
      return '';
    };
    return (
      <>
        <AppBar large title={t('nav.admin')}>
          <RoleBadge role="superadmin" />
        </AppBar>
        <AdminNav current="ADM-04" />
        <Tabs
          tabs={[
            {
              id: 'open',
              label: t('reports.tab.open'),
              count: sel().reports('open').length || undefined,
            },
            {
              id: 'resolved',
              label: t('reports.tab.resolved'),
            },
          ]}
          value={tab}
          onChange={setTab}
          action="ADM-04.tab"
        />
        <div className="hscroll py8">
          {['all', 'post', 'comment', 'user', 'club', 'event'].map((ty) => (
            <Chip
              key={ty}
              label={ty === 'all' ? t('common.all') : t('reports.target.' + ty)}
              selected={type === ty}
              action={'ADM-04.filter.' + ty}
              onClick={() => setType(ty)}
            />
          ))}
        </div>
        <Scroll routeKey={route.key}>
          <ListState
            n={4}
            emptyProps={{
              illustration: 'empty-notifications',
              title: t('reports.empty.' + tab),
            }}
          >
            {list.length ? (
              list.map((r) => (
                <Tile
                  key={r.id}
                  leading={
                    <span className={cx('notif-icon', tab === 'open' ? 'ni-warning' : 'ni-success')}>
                      <Icon
                        name={
                          {
                            post: 'file-text',
                            comment: 'message-circle',
                            user: 'user',
                            club: 'users-round',
                            event: 'calendar',
                          }[r.targetType]
                        }
                        size={18}
                      />
                    </span>
                  }
                  title={<span className="clamp1">{preview(r)}</span>}
                  subtitle={
                    <span className="row gap6 wrap">
                      <Badge kind="danger" label={t('reportReason.' + r.reasons[0].reason)} />
                      {r.reasons.length > 1 ? (
                        <Badge
                          kind="pending"
                          icon="flag"
                          label={t('content.reports', {
                            count: r.reasons.length,
                          })}
                        />
                      ) : null}
                      <span className="t-caption">{app.fmt.rel(Math.max(...r.reasons.map((x) => x.createdAt)))}</span>
                    </span>
                  }
                  chevron
                  action={'ADM-04.row.' + r.id}
                  onClick={() =>
                    app.openSheet('SHT-26', {
                      reportId: r.id,
                    })
                  }
                />
              ))
            ) : (
              <EmptyState illustration="empty-notifications" title={t('reports.empty.' + tab)} />
            )}
          </ListState>
        </Scroll>
      </>
    );
  },
};

/* ADM-05 */
S['ADM-05'] = {
  tab: 'admin',
  title: 'adminUsers.title',
  comp: function AdminUsers({ route }: any) {
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('all');
    const [menu, setMenu] = useState<any>(null);
    const [history, setHistory] = useState<any>(null);
    if (!isSuper()) return <NoAdmin screen="ADM-05" />;
    const list = Object.values(app.state.users)
      .filter((u) => !u.deleted)
      .filter((u) => !q || (u.name + ' ' + u.email).toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')))
      .filter(
        (u) =>
          filter === 'all' ||
          (filter === 'suspended' && u.status === 'suspended') ||
          (filter === 'managers' &&
            sel()
              .managedClubs(u.id)
              .some((m) => !m.readOnly)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      .slice(0, 80);
    return [
      <AppBar large title={t('nav.admin')}>
        <RoleBadge role="superadmin" />
      </AppBar>,
      <AdminNav current="ADM-05" />,
      <div className="px16 pb8">
        <Input icon="search" placeholder={t('adminUsers.search')} value={q} onInput={setQ} action="ADM-05.search" ariaLabel={t('adminUsers.search')} />
      </div>,
      <div className="hscroll py8">
        {[
          ['all', t('common.all')],
          ['suspended', t('status.suspended')],
          ['managers', t('adminUsers.managers')],
        ].map(([id, l]) => (
          <Chip key={id} label={l} selected={filter === id} action={'ADM-05.filter.' + id} onClick={() => setFilter(id)} />
        ))}
      </div>,
      <Scroll routeKey={route.key}>
        <ListState
          n={6}
          emptyProps={{
            illustration: 'empty-clubs',
            title: t('members.noResults'),
          }}
        >
          {list.length ? (
            list.map((u) => {
              const clubs = sel().myClubs(u.id);
              return (
                <div key={u.id}>
                  <Tile
                    leading={<Avatar user={u} size={40} />}
                    title={
                      <span className="row gap6">
                        <span
                          className="ellipsis"
                          style={{
                            maxWidth: '180px',
                          }}
                        >
                          {u.name}
                        </span>
                        {u.status === 'suspended' ? <StatusBadge status="suspended" /> : null}
                      </span>
                    }
                    subtitle={`${deptYear(u)} · ${t('adminUsers.clubCount', {
                      count: clubs.length,
                    })}`}
                    action={'ADM-05.row.' + u.id}
                    onClick={() =>
                      app.nav.push('CLB-07', {
                        id: u.id,
                      })
                    }
                    trailing={
                      <IconButton
                        icon="more-vertical"
                        label={t('a11y.more')}
                        action={'ADM-05.menu.' + u.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenu(u);
                        }}
                      />
                    }
                  />
                  {history === u.id ? (
                    <div className="px16 pb16">
                      <Card muted class="card-body col gap6">
                        {sel().myMemberships(u.id).length ? (
                          sel()
                            .myMemberships(u.id)
                            .map((m) => (
                              <div key={m.clubId} className="row between gap8">
                                <span className="t-body-s c-heading ellipsis">{(sel().club(m.clubId) || {}).name}</span>
                                <StatusBadge
                                  status={m.status === 'active' ? 'active' : m.status}
                                  label={m.status === 'active' ? t('role.' + m.role) : undefined}
                                />
                              </div>
                            ))
                        ) : (
                          <span className="t-body-s c-muted">{t('adminUsers.noHistory')}</span>
                        )}
                      </Card>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <EmptyState illustration="empty-clubs" title={t('members.noResults')} />
          )}
        </ListState>
      </Scroll>,
      menu ? (
        <PopMenu id="ADM-05" onClose={() => setMenu(null)}>
          <Tile
            title={t('userprofile.view')}
            leading={<Icon name="user" size={20} />}
            action={'ADM-05.menu.' + menu.id + '.profile'}
            onClick={() => {
              setMenu(null);
              app.nav.push('CLB-07', {
                id: menu.id,
              });
            }}
          />
          <Tile
            title={menu.status === 'suspended' ? t('adminUsers.unsuspend') : t('adminUsers.suspend')}
            danger={menu.status !== 'suspended'}
            leading={<Icon name={menu.status === 'suspended' ? 'circle-check' : 'ban'} size={20} />}
            action={'ADM-05.menu.' + menu.id + '.suspend'}
            onClick={() => {
              const u = menu;
              setMenu(null);
              app.openDialog('DLG-30', {
                userId: u.id,
              });
            }}
          />
          <Tile
            title={t('adminUsers.history')}
            leading={<Icon name="history" size={20} />}
            action={'ADM-05.history.' + menu.id}
            onClick={() => {
              setHistory(history === menu.id ? null : menu.id);
              setMenu(null);
            }}
          />
        </PopMenu>
      ) : null,
    ];
  },
};
