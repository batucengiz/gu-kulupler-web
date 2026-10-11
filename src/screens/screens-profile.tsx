import {
  AppBar,
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  DEMO_PASSWORD,
  EmptyState,
  INTERESTS,
  Icon,
  IconButton,
  Illustration,
  Input,
  ListState,
  Logo,
  OptionRow,
  Picker,
  PopMenu,
  RoleBadge,
  SCREENS,
  Scroll,
  Segmented,
  StatusBadge,
  StickyCTA,
  SuccessCheck,
  Tabs,
  Tile,
  UserRow,
  app,
  clubFilters,
  deptYear,
  startJoin,
  useBusy,
  useForm,
  useState,
} from '../ui/kit';
/* ===== SCREENS: PRF · SET ===== */
const t = (k: string, p?: any) => app.t(k, p);
const S = SCREENS;
const sel = () => app.sel;

/* PRF-01 */
S['PRF-01'] = {
  tab: 'profile',
  title: 'nav.profile',
  comp: function Profile({ route }: any) {
    const u = app.uid();
    const me = app.me();
    if (!me) return null;
    const clubs = sel().myClubs(u);
    const managed = sel().managedClubs(u);
    const pending = sel().pendingOf(u);
    const attended = sel()
      .userRsvps(u)
      .filter((r) => r.status === 'attended').length;
    return (
      <>
        <AppBar large title={t('nav.profile')}>
          <IconButton icon="settings" label={t('settings.title')} action="PRF-01.settings" onClick={() => app.nav.push('SET-01')} />
        </AppBar>
        <Scroll routeKey={route.key}>
          <div className="col gap20 px16 pb24">
            <div className="row gap16">
              <button
                type="button"
                className="rel"
                data-action="PRF-01.avatar"
                onClick={() =>
                  app.openSheet('SHT-16', {
                    onPick: () => {},
                  })
                }
                aria-label={t('profile.changePhoto')}
              >
                <Avatar user={me} size={96} />
                <span
                  className="emblem is-xs"
                  style={{
                    position: 'absolute',
                    right: '-2px',
                    bottom: '-2px',
                    background: 'var(--brand-primary)',
                    color: '#fff',
                    border: '2px solid var(--bg-canvas)',
                  }}
                >
                  <Icon name="camera" size={14} />
                </span>
              </button>
              <div className="flex1 col gap6">
                <h2 className="t-title-m">{me.name}</h2>
                <span className="t-body-s c-sec">{deptYear(me)}</span>
                {me.global === 'superadmin' ? (
                  <span>
                    <RoleBadge role="superadmin" />
                  </span>
                ) : null}
                <div>
                  <Button size="sm" variant="outline" icon="pencil" label={t('profile.edit')} action="PRF-01.edit" onClick={() => app.nav.push('PRF-02')} />
                </div>
              </div>
            </div>
            <div className="grid3">
              {[
                ['clubs', clubs.length, () => app.nav.push('PRF-03')],
                [
                  'events',
                  attended,
                  () =>
                    app.nav.push('EVT-04', {
                      tab: 'past',
                    }),
                ],
                [
                  'pending',
                  pending.length,
                  () =>
                    app.nav.push('PRF-03', {
                      tab: 'pending',
                    }),
                ],
              ].map(([k, v, go]) => (
                <button
                  type="button"
                  key={k}
                  className="card kpi pressable"
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                  }}
                  data-action={'PRF-01.stat.' + k}
                  onClick={go}
                >
                  <span className="kpi-value">{v}</span>
                  <span className="t-caption">{t('profile.stat.' + k)}</span>
                </button>
              ))}
            </div>
            {managed.length ? (
              <Card>
                <div
                  className="row between"
                  style={{
                    padding: '12px 16px 4px',
                  }}
                >
                  <span className="t-overline">{t('profile.managed')}</span>
                </div>
                {managed.map((m) => (
                  <Tile
                    key={m.clubId}
                    inCard
                    leading={
                      <span className="emblem is-sm">
                        <Icon name={m.club.iconName} size={20} />
                      </span>
                    }
                    title={m.club.name}
                    subtitle={<RoleBadge role={m.role} />}
                    chevron
                    action={'PRF-01.managed.' + m.clubId}
                    onClick={() =>
                      app.nav.push('MGT-01', {
                        clubId: m.clubId,
                      })
                    }
                  />
                ))}
                <div
                  className="p16"
                  style={{
                    paddingTop: '4px',
                  }}
                >
                  <Button
                    full
                    variant="tonal"
                    icon="layout-grid"
                    label={t('profile.managePanel')}
                    action="PRF-01.managedAll"
                    onClick={() => app.flows.openManage()}
                  />
                </div>
              </Card>
            ) : null}
            <div className="col gap8">
              <div className="row between">
                <h2 className="t-title-s">{t('clubs.my.title')}</h2>
                {clubs.length ? (
                  <Button size="sm" variant="text" label={t('common.all')} action="PRF-01.allClubs" onClick={() => app.nav.push('PRF-03')} />
                ) : null}
              </div>
              {clubs.length ? (
                <Card>
                  {clubs.slice(0, 3).map((m, i) => [
                    i ? <div className="divider" /> : null,
                    <Tile
                      key={m.clubId}
                      inCard
                      leading={
                        <span className="emblem is-sm">
                          <Icon name={m.club.iconName} size={20} />
                        </span>
                      }
                      title={m.club.name}
                      subtitle={<RoleBadge role={m.role} />}
                      chevron
                      action={'PRF-01.club.' + m.clubId}
                      onClick={() =>
                        app.nav.push('CLB-03', {
                          id: m.clubId,
                        })
                      }
                    />,
                  ])}
                </Card>
              ) : (
                <Card muted class="card-body row gap12">
                  <Illustration name="empty-clubs" size={56} />
                  <span className="flex1 t-body-s c-sec">{t('profile.noClubs')}</span>
                  <Button size="sm" variant="tonal" label={t('events.discover')} action="PRF-01.discover" onClick={() => app.nav.switchTab('clubs')} />
                </Card>
              )}
            </div>
            <Card>
              <Tile
                inCard
                leading={<Icon name="ticket" size={20} class="c-brand" />}
                title={t('events.tickets')}
                chevron
                action="PRF-01.tickets"
                onClick={() => app.nav.push('EVT-04')}
              />
              <div className="divider" />
              <Tile
                inCard
                leading={<Icon name="bookmark" size={20} class="c-brand" />}
                title={t('saved.title')}
                chevron
                action="PRF-01.saved"
                onClick={() => app.nav.push('PRF-04')}
              />
              <div className="divider" />
              <Tile
                inCard
                leading={<Icon name="settings" size={20} class="c-brand" />}
                title={t('settings.title')}
                chevron
                action="PRF-01.settingsRow"
                onClick={() => app.nav.push('SET-01')}
              />
            </Card>
            {me.interests.length ? (
              <div className="col gap8">
                <h2 className="t-title-s">{t('profile.interests')}</h2>
                <div className="row wrap gap8">
                  {me.interests.map((i) => (
                    <Chip
                      key={i}
                      label={t('interest.' + i)}
                      action={'PRF-01.interest.' + i}
                      onClick={() => {
                        const cat = (INTERESTS.find((x) => x.id === i) || {}).cat;
                        app.dispatch('ui.set', {
                          clubFilters: {
                            ...clubFilters.filtersOf(),
                            categories: cat ? [cat] : [],
                          },
                        });
                        app.nav.switchTab('clubs');
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Scroll>
      </>
    );
  },
};

/* PRF-02 */
S['PRF-02'] = {
  tab: 'profile',
  title: 'editProfile.title',
  comp: function EditProfile() {
    const u = app.uid();
    const me = app.me();
    const [f, set, reset] = useForm('editProfile', {
      name: me.name,
      department: me.department,
      year: me.year,
      interests: me.interests,
      bio: me.bio || '',
      errors: {},
    });
    const [busy, run] = useBusy();
    const dirty =
      f.name !== me.name || f.department !== me.department || f.year !== me.year || f.bio !== (me.bio || '') || f.interests.join() !== me.interests.join();
    const back = () => {
      if (dirty)
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
        if (!f.name.trim()) e.name = t('auth.err.required');
        if (!f.interests.length) e.interests = t('auth.setup.minInterest');
        set({
          errors: e,
        });
        if (Object.keys(e).length) return;
        if (!app.requireOnline()) return;
        await app.api();
        app.dispatch('user.update', {
          userId: u,
          patch: {
            name: f.name.trim(),
            department: f.department,
            year: f.year,
            interests: f.interests,
            bio: f.bio,
          },
        });
        reset();
        app.nav.back();
        app.toast('TST-21');
      });
    const toggle = (id) => {
      if (f.interests.includes(id))
        set({
          interests: f.interests.filter((x) => x !== id),
        });
      else if (f.interests.length >= 5) app.toast('TST-04');
      else
        set({
          interests: [...f.interests, id],
        });
    };
    return (
      <>
        <AppBar onBack={back} backAction="PRF-02.back" title={t('editProfile.title')} />
        <Scroll routeKey="editprofile">
          <div className="col gap16 px16 pb24">
            <div
              className="col gap8"
              style={{
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                className="rel"
                data-action="PRF-02.avatar"
                onClick={() =>
                  app.openSheet('SHT-16', {
                    onPick: () => {},
                  })
                }
                aria-label={t('profile.changePhoto')}
              >
                <Avatar user={me} size={96} />
                <span
                  className="emblem is-xs"
                  style={{
                    position: 'absolute',
                    right: '-2px',
                    bottom: '-2px',
                    background: 'var(--brand-primary)',
                    color: '#fff',
                  }}
                >
                  <Icon name="camera" size={14} />
                </span>
              </button>
              <span className="t-caption">{t('profile.changePhoto')}</span>
            </div>
            <Input
              label={t('auth.fullName')}
              value={f.name}
              onInput={(v) =>
                set({
                  name: v,
                })
              }
              error={f.errors.name}
              action="PRF-02.name"
            />
            <Picker
              label={t('profile.department')}
              icon="graduation-cap"
              value={f.department ? t('dept.' + f.department) : ''}
              placeholder={t('common.select')}
              action="PRF-02.department"
              onClick={() =>
                app.openSheet('SHT-02', {
                  value: f.department,
                  onSelect: (id) =>
                    set({
                      department: id,
                    }),
                })
              }
            />
            <Picker
              label={t('profile.year')}
              icon="calendar-days"
              value={f.year ? t('year.' + f.year) : ''}
              placeholder={t('common.select')}
              action="PRF-02.year"
              onClick={() =>
                app.openSheet('SHT-03', {
                  value: f.year,
                  onSelect: (id) =>
                    set({
                      year: id,
                    }),
                })
              }
            />
            <div className="col gap8">
              <span className="field-label">
                <span>{t('profile.interests')}</span>
                <span className="field-counter">{f.interests.length}/5</span>
              </span>
              <div className="row wrap gap8">
                {INTERESTS.map((i) => (
                  <Chip
                    key={i.id}
                    label={t('interest.' + i.id)}
                    selected={f.interests.includes(i.id)}
                    action={'PRF-02.toggleInterest.' + i.id}
                    onClick={() => toggle(i.id)}
                  />
                ))}
              </div>
              {f.errors.interests ? (
                <div className="field-help is-error" role="alert">
                  <Icon name="triangle-alert" size={14} />
                  <span>{f.errors.interests}</span>
                </div>
              ) : null}
            </div>
            <Input
              label={t('editProfile.bio')}
              multiline
              rows={3}
              value={f.bio}
              onInput={(v) =>
                set({
                  bio: v.slice(0, 140),
                })
              }
              maxLength={140}
              counter={0}
              action="PRF-02.bio"
            />
            <div
              onClick={() => app.toast('TST-20')}
              data-action="PRF-02.lockedEmail"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && app.toast('TST-20')}
            >
              <Input label={t('auth.email')} value={me.email} locked help={t('editProfile.emailLocked')} action="PRF-02.email" />
            </div>
            <Banner kind="info" icon="shield" text={t('editProfile.privacy')} card />
          </div>
        </Scroll>
        <StickyCTA>
          <Button
            full
            label={t('common.save')}
            loading={busy}
            disabled={!dirty}
            action="PRF-02.save"
            onClick={save}
            onDisabledClick={() => app.toast('TST-X9')}
          />
        </StickyCTA>
      </>
    );
  },
};

/* PRF-03 */
S['PRF-03'] = {
  tab: 'profile',
  title: 'myclubs.title',
  comp: function MyClubs({ params }: any) {
    const u = app.uid();
    const [tab, setTab] = useState(params.tab || 'active');
    const [menu, setMenu] = useState<any>(null);
    const ms = sel()
      .myMemberships(u)
      .map((m) => ({
        ...m,
        club: sel().club(m.clubId),
      }))
      .filter((m) => m.club);
    const list = ms
      .filter((m) =>
        tab === 'active' ? m.status === 'active' : tab === 'pending' ? m.status === 'pending' : m.status === 'rejected' || m.status === 'removed',
      )
      .sort((a, b) => (b.decidedAt || b.appliedAt || 0) - (a.decidedAt || a.appliedAt || 0));
    const open = (m) =>
      app.nav.push(m.status === 'active' ? 'CLB-03' : 'CLB-05', {
        id: m.clubId,
      });
    return [
      <AppBar onBack={() => app.nav.back()} backAction="PRF-03.back" title={t('myclubs.title')} />,
      <Tabs
        tabs={[
          {
            id: 'active',
            label: t('myclubs.tab.active'),
          },
          {
            id: 'pending',
            label: t('myclubs.tab.pending'),
          },
          {
            id: 'history',
            label: t('myclubs.tab.history'),
          },
        ]}
        value={tab}
        onChange={setTab}
        action="PRF-03.tab"
      />,
      <Scroll routeKey="myclubs">
        <ListState
          n={4}
          emptyProps={{
            illustration: 'empty-applications',
            title: t('myclubs.empty.' + tab),
            cta: t('events.discover'),
            ctaAction: 'PRF-03.discover',
            onCta: () => app.nav.switchTab('clubs'),
          }}
        >
          {list.length ? (
            list.map((m) => (
              <Tile
                key={m.clubId}
                leading={
                  <span className="emblem is-sm">
                    <Icon name={m.club.iconName} size={20} />
                  </span>
                }
                title={m.club.name}
                subtitle={
                  <span className="row gap6 wrap">
                    {m.status === 'active' ? <RoleBadge role={m.role} /> : <StatusBadge status={m.status} />}
                    <span className="t-caption">{app.fmt.date(m.decidedAt || m.appliedAt)}</span>
                  </span>
                }
                action={'PRF-03.row.' + m.clubId}
                onClick={() => open(m)}
                trailing={
                  <IconButton
                    icon="more-vertical"
                    label={t('a11y.more')}
                    action={'PRF-03.menu.' + m.clubId}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu(m);
                    }}
                  />
                }
              />
            ))
          ) : (
            <EmptyState
              illustration="empty-applications"
              title={t('myclubs.empty.' + tab)}
              cta={t('events.discover')}
              ctaAction="PRF-03.discover"
              onCta={() => app.nav.switchTab('clubs')}
            />
          )}
        </ListState>
      </Scroll>,
      menu ? (
        <PopMenu id="PRF-03" onClose={() => setMenu(null)}>
          <Tile
            title={t('common.open')}
            leading={<Icon name="external-link" size={20} />}
            action={'PRF-03.menu.' + menu.clubId + '.open'}
            onClick={() => {
              setMenu(null);
              open(menu);
            }}
          />
          {menu.status === 'active' ? (
            <Tile
              title={t('club.leave')}
              danger
              leading={<Icon name="log-out" size={20} />}
              action={'PRF-03.menu.' + menu.clubId + '.leave'}
              onClick={() => {
                setMenu(null);
                if (menu.role === 'president')
                  app.openDialog('DLG-09', {
                    clubId: menu.clubId,
                  });
                else
                  app.openDialog('DLG-08', {
                    clubId: menu.clubId,
                  });
              }}
            />
          ) : null}
          {menu.status === 'pending' ? (
            <Tile
              title={t('application.cancel')}
              danger
              leading={<Icon name="x" size={20} />}
              action={'PRF-03.menu.' + menu.clubId + '.cancel'}
              onClick={() => {
                setMenu(null);
                app.openDialog('DLG-07', {
                  clubId: menu.clubId,
                });
              }}
            />
          ) : null}
          {menu.status === 'rejected' || menu.status === 'removed' ? (
            <Tile
              title={t('application.reapply')}
              disabled={!sel().canReapply(menu)}
              leading={<Icon name="refresh-cw" size={20} />}
              action={'PRF-03.menu.' + menu.clubId + '.reapply'}
              onClick={() => {
                setMenu(null);
                if (sel().canReapply(menu)) startJoin(menu.clubId);
                else
                  app.toast('TST-X4', {
                    date: app.fmt.date(menu.retryAfter),
                  });
              }}
            />
          ) : null}
        </PopMenu>
      ) : null,
    ];
  },
};

/* PRF-04 */
S['PRF-04'] = {
  tab: 'profile',
  title: 'saved.title',
  comp: function Saved() {
    const u = app.uid();
    const ids = app.state.saved[u] || [];
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="PRF-04.back" title={t('saved.title')} />
        <Scroll routeKey="saved">
          <ListState
            n={3}
            variant="card"
            emptyProps={{
              illustration: 'empty-posts',
              title: t('saved.empty'),
            }}
          >
            {ids.length ? (
              <div className="col gap12 px16">
                {ids.map((id) => {
                  const p = sel().post(id);
                  const removed = !p || p.deleted || p.hidden;
                  const club = p ? sel().club(p.clubId) : null;
                  const unsave = () => {
                    const snap = app.store.get();
                    app.dispatch('post.save', {
                      postId: id,
                      userId: u,
                    });
                    app.toast('TST-11', {
                      saved: false,
                      undo: () => app.store.restore(snap),
                    });
                  };
                  return (
                    <Card
                      key={id}
                      tappable={!removed}
                      action={'PRF-04.post.' + id}
                      onClick={() =>
                        !removed &&
                        app.nav.push('FED-02', {
                          clubId: p.clubId,
                          postId: id,
                        })
                      }
                      label={removed ? t('saved.removed') : p.text.slice(0, 40)}
                    >
                      <div className="card-body row gap12 start">
                        <div className="flex1 col gap4">
                          {removed ? (
                            <span className="t-label-l c-muted row gap6">
                              <Icon name="ban" size={16} />
                              {t('saved.removed')}
                            </span>
                          ) : (
                            [
                              <span className="t-caption">
                                {club.name}
                                {' \xB7 '}
                                {app.fmt.rel(p.createdAt)}
                              </span>,
                              p.title ? <span className="t-title-s">{p.title}</span> : null,
                              <p className="t-body-s c-sec clamp2">{p.text}</p>,
                            ]
                          )}
                        </div>
                        <IconButton
                          icon={removed ? 'trash-2' : 'bookmark'}
                          label={t('feed.unsave')}
                          brand
                          action={'PRF-04.unsave.' + id}
                          onClick={(e) => {
                            e.stopPropagation();
                            unsave();
                          }}
                          style={sx(
                            removed
                              ? undefined
                              : {
                                  fill: 'currentColor',
                                },
                          )}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <EmptyState illustration="empty-posts" title={t('saved.empty')} />
            )}
          </ListState>
        </Scroll>
      </>
    );
  },
};

/* SET-01 */
S['SET-01'] = {
  tab: 'profile',
  title: 'settings.title',
  comp: function Settings() {
    const s = app.state.session;
    const scale = s.textScale || 1;
    const group = (title, rows) => (
      <div className="col gap8">
        <span className="t-overline px16">{title}</span>
        <div className="px16">
          <Card>{rows.map((r, i) => [i ? <div className="divider" /> : null, r])}</Card>
        </div>
      </div>
    );
    const row = (icon, title, sub, action, onClick, opts = {}) => (
      <Tile
        inCard
        leading={<Icon name={icon} size={20} class={opts.danger ? 'c-danger' : 'c-brand'} />}
        title={title}
        subtitle={sub}
        chevron={!opts.noChevron}
        action={action}
        onClick={onClick}
        danger={opts.danger}
      />
    );
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="SET-01.back" title={t('settings.title')} />
        <Scroll routeKey="settings">
          <div className="col gap20 pb24">
            {group(t('settings.group.appearance'), [
              row('sun', t('settings.theme'), t('theme.' + (s.theme || 'system')), 'SET-01.theme', () => app.openSheet('SHT-17')),
              row('languages', t('settings.language'), app.locale() === 'tr' ? 'Türkçe' : 'English', 'SET-01.language', () => app.openSheet('SHT-01')),
              <div className="col gap8 p16">
                <div className="row between">
                  <span className="t-body-m c-heading row gap12">
                    <Icon name="file-text" size={20} class="c-brand" />
                    {t('settings.textSize')}
                  </span>
                  <span className="t-caption">Aa</span>
                </div>
                <Segmented
                  options={[
                    {
                      id: '1',
                      label: '%100',
                    },
                    {
                      id: '1.3',
                      label: '%130',
                    },
                    {
                      id: '1.6',
                      label: '%160',
                    },
                  ]}
                  value={String(scale)}
                  onChange={(v) =>
                    app.dispatch('session.set', {
                      textScale: Number(v),
                    })
                  }
                  action="SET-01.textScale"
                />
                <p className="t-body-m c-sec">{t('settings.textPreview')}</p>
              </div>,
            ])}
            {group(t('nav.notifications'), [row('bell', t('notifPrefs.title'), null, 'SET-01.notifications', () => app.nav.push('NTF-02'))])}
            {group(t('settings.group.privacy'), [
              row('ban', t('blocked.title'), null, 'SET-01.blocked', () => app.nav.push('SET-02')),
              row('shield', t('settings.privacyPolicy'), null, 'SET-01.privacy', () =>
                app.nav.push('AUT-06', {
                  tab: 'gizlilik',
                }),
              ),
              row('key-round', t('settings.changePassword'), null, 'SET-01.password', () => app.openSheet('SHT-32')),
            ])}
            {group(t('settings.group.support'), [
              row('life-buoy', t('support.title'), null, 'SET-01.support', () => app.nav.push('SET-05')),
              row('info', t('about.title'), null, 'SET-01.about', () => app.nav.push('SET-04')),
            ])}
            {group(t('settings.group.account'), [
              row('log-out', t('auth.logout'), null, 'SET-01.logout', () => app.openDialog('DLG-06'), {
                noChevron: true,
              }),
              row('trash-2', t('deleteAccount.title'), null, 'SET-01.delete', () => app.nav.push('SET-03'), {
                danger: true,
              }),
            ])}
            <p className="t-caption center">
              v{app.APP_VERSION}
              {' ('}
              {t('common.demo').toLowerCase()})
            </p>
          </div>
        </Scroll>
      </>
    );
  },
};

/* SET-02 */
S['SET-02'] = {
  tab: 'profile',
  title: 'blocked.title',
  comp: function Blocked() {
    const u = app.uid();
    const me = app.me();
    const list = (me.blocked || []).map((id) => sel().user(id)).filter(Boolean);
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="SET-02.back" title={t('blocked.title')} />
        <Scroll routeKey="blocked">
          <p className="t-body-s c-sec px16 pb16">{t('blocked.desc')}</p>
          {list.length ? (
            list.map((usr) => (
              <UserRow
                key={usr.id}
                user={usr}
                sub={deptYear(usr)}
                action={'SET-02.user.' + usr.id}
                onClick={() =>
                  app.nav.push('CLB-07', {
                    id: usr.id,
                  })
                }
                trailing={
                  <Button
                    size="sm"
                    variant="outline"
                    label={t('userprofile.unblock')}
                    action={'SET-02.unblock.' + usr.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      const snap = app.store.get();
                      app.dispatch('user.unblock', {
                        userId: u,
                        targetId: usr.id,
                      });
                      app.toast('TST-09', {
                        name: usr.name,
                        unblocked: true,
                        undo: () => app.store.restore(snap),
                      });
                    }}
                  />
                }
              />
            ))
          ) : (
            <EmptyState illustration="empty-clubs" title={t('blocked.empty')} compact />
          )}
        </Scroll>
      </>
    );
  },
};

/* SET-03 */
S['SET-03'] = {
  tab: 'profile',
  title: 'deleteAccount.title',
  comp: function DeleteAccount() {
    const u = app.uid();
    const [f, set, reset] = useForm('deleteAccount', {
      step: 1,
      reason: null,
      reasonText: '',
      password: '',
      confirm: '',
      err: '',
    });
    const [busy, run] = useBusy();
    const presidentOf = sel()
      .myMemberships(u)
      .filter((m) => m.status === 'active' && m.role === 'president')
      .map((m) => sel().club(m.clubId))
      .filter(Boolean);
    const confirmDelete = () =>
      run(async () => {
        if (f.password !== DEMO_PASSWORD) {
          set({
            err: t('auth.err.wrongPassword'),
          });
          return;
        }
        if (!app.requireOnline()) return;
        await app.api({
          delay: 1200,
        });
        app.dispatch('user.delete', {
          userId: u,
        });
        reset();
        app.ui.closeAllSheets();
        app.nav.resetTo('AUT-01');
        app.toast('TST-22');
      });
    const reasons = ['noUse', 'tooMany', 'privacy', 'graduated', 'other'];
    return (
      <>
        <AppBar
          onBack={() =>
            f.step > 1
              ? set({
                  step: f.step - 1,
                })
              : (reset(), app.nav.back())
          }
          backAction="SET-03.back"
          title={t('deleteAccount.title')}
          subtitle={`${f.step}/3`}
        />
        <Scroll routeKey="delete">
          <div className="col gap16 px16 pb24">
            {f.step === 1
              ? [
                  <Banner kind="danger" text={t('deleteAccount.warning')} card />,
                  <Card class="card-body col gap8">
                    <span className="t-overline">{t('deleteAccount.deleted')}</span>
                    <ul className="t-body-s c-sec col gap4">
                      {['memberships', 'applications', 'tickets', 'notifications'].map((k) => (
                        <li key={k}>{t('deleteAccount.item.' + k)}</li>
                      ))}
                    </ul>
                    <span className="t-overline mt8">{t('deleteAccount.kept')}</span>
                    <p className="t-body-s c-sec">{t('deleteAccount.keptDesc')}</p>
                  </Card>,
                  presidentOf.length ? (
                    <Card
                      class="card-body col gap8"
                      style={{
                        borderColor: 'var(--state-warning)',
                      }}
                    >
                      <span className="row gap6 t-label-l c-warning">
                        <Icon name="triangle-alert" size={18} />
                        {t('deleteAccount.presidentBlock')}
                      </span>
                      {presidentOf.map((c) => (
                        <div key={c.id} className="row between gap8">
                          <span className="t-body-s c-heading flex1 ellipsis">{c.name}</span>
                          <Button
                            size="sm"
                            variant="tonal"
                            label={t('deleteAccount.transfer')}
                            action={'SET-03.transfer.' + c.id}
                            onClick={() =>
                              app.nav.push('MGT-03', {
                                clubId: c.id,
                              })
                            }
                          />
                        </div>
                      ))}
                    </Card>
                  ) : null,
                ]
              : null}
            {f.step === 2 ? (
              <>
                <h2 className="t-title-m">{t('deleteAccount.reasonTitle')}</h2>
                <p className="t-body-s c-sec">{t('common.optional')}</p>
                <Card>
                  {reasons.map((r, i) => [
                    i ? <div className="divider" /> : null,
                    <OptionRow
                      key={r}
                      label={t('deleteAccount.reason.' + r)}
                      checked={f.reason === r}
                      action={'SET-03.reason.' + r}
                      onClick={() =>
                        set({
                          reason: r,
                        })
                      }
                    />,
                  ])}
                </Card>
                <Input
                  multiline
                  rows={3}
                  value={f.reasonText}
                  onInput={(v) =>
                    set({
                      reasonText: v.slice(0, 300),
                    })
                  }
                  maxLength={300}
                  counter
                  placeholder={t('deleteAccount.reasonPlaceholder')}
                  action="SET-03.reasonText"
                  ariaLabel={t('deleteAccount.reasonTitle')}
                />
              </>
            ) : null}
            {f.step === 3 ? (
              <>
                <h2 className="t-title-m">{t('deleteAccount.confirmTitle')}</h2>
                <Input
                  label={t('auth.password')}
                  type="password"
                  icon="key-round"
                  value={f.password}
                  onInput={(v) =>
                    set({
                      password: v,
                      err: '',
                    })
                  }
                  error={f.err}
                  action="SET-03.password"
                />
                <Input
                  label={t('deleteAccount.typeDelete')}
                  value={f.confirm}
                  onInput={(v) =>
                    set({
                      confirm: v,
                    })
                  }
                  placeholder="S\u0130L"
                  action="SET-03.confirmWord"
                />
              </>
            ) : null}
          </div>
        </Scroll>
        <StickyCTA>
          {f.step < 3 ? (
            <Button
              full
              variant={f.step === 1 ? 'danger-outline' : 'primary'}
              label={t('common.continue')}
              disabled={f.step === 1 && presidentOf.length > 0}
              action="SET-03.next"
              onClick={() =>
                set({
                  step: f.step + 1,
                })
              }
              onDisabledClick={() => app.toast('TST-X10')}
            />
          ) : (
            <Button
              full
              variant="danger"
              label={t('deleteAccount.confirmCta')}
              disabled={f.confirm.trim().toLocaleUpperCase('tr') !== 'SİL' || !f.password}
              loading={busy}
              action="SET-03.confirm"
              onClick={confirmDelete}
              onDisabledClick={() => app.toast('TST-X11')}
            />
          )}
        </StickyCTA>
      </>
    );
  },
};

/* SET-04 */
S['SET-04'] = {
  tab: 'profile',
  title: 'about.title',
  comp: function About() {
    const [open, setOpen] = useState<any>({});
    const toggle = (k) =>
      setOpen({
        ...open,
        [k]: !open[k],
      });
    const licenses = [
      ['lucide', 'Lucide', 'ISC', 'https://lucide.dev/license'],
      ['montserrat', 'Montserrat', 'SIL OFL 1.1', 'https://fonts.google.com/specimen/Montserrat/license'],
      ['inter', 'Inter', 'SIL OFL 1.1', 'https://fonts.google.com/specimen/Inter/license'],
    ];
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="SET-04.back" title={t('about.title')} />
        <Scroll routeKey="about">
          <div className="col gap20 px16 pb24">
            <div
              className="col gap8"
              style={{
                alignItems: 'center',
                paddingTop: '8px',
              }}
            >
              <Logo size={80} />
              <span
                className="t-title-m"
                style={{
                  letterSpacing: '.04em',
                }}
              >
                {app.APP_NAME}
              </span>
              <span className="t-caption">
                v{app.APP_VERSION}
                {' \xB7 '}
                {t('about.build')}
              </span>
              <p
                className="t-body-s c-sec center"
                style={{
                  maxWidth: '300px',
                }}
              >
                {t('about.desc')}
              </p>
            </div>
            <Card class="card-body col gap8">
              <span className="t-overline">{t('about.team')}</span>
              {[
                ['Ekin Yurdakul', t('about.team.pm')],
                ['Lale Korkut', t('about.team.design')],
                ['Baran Çelik', t('about.team.dev')],
              ].map(([n, r]) => (
                <div key={n} className="row gap10">
                  <Avatar name={n} seed={n} size={32} />
                  <span className="flex1 t-body-m c-heading">{n}</span>
                  <span className="t-caption">{r}</span>
                </div>
              ))}
            </Card>
            <Card>
              <div
                style={{
                  padding: '12px 16px 4px',
                }}
                className="t-overline"
              >
                {t('about.licenses')}
              </div>
              {licenses.map(([k, name, lic, url]) => (
                <div key={k}>
                  <Tile
                    inCard
                    title={name}
                    subtitle={lic}
                    trailing={<Icon name={open[k] ? 'chevron-up' : 'chevron-down'} size={20} />}
                    action={'SET-04.license.' + k}
                    onClick={() => toggle(k)}
                  />
                  {open[k] ? (
                    <div className="px16 pb16 col gap8">
                      <p className="t-body-s c-sec">{t('about.license.' + k)}</p>
                      <Button
                        size="sm"
                        variant="text"
                        icon="external-link"
                        label={t('about.viewLicense')}
                        action={'SET-04.licenseLink.' + k}
                        onClick={() =>
                          app.openDialog('DLG-32', {
                            url,
                          })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </Card>
            <Card>
              <Tile
                inCard
                title={t('about.releaseNotes')}
                subtitle={'v' + app.APP_VERSION}
                trailing={<Icon name={open.notes ? 'chevron-up' : 'chevron-down'} size={20} />}
                action="SET-04.releaseNotes"
                onClick={() => toggle('notes')}
              />
              {open.notes ? (
                <ul
                  className="t-body-s c-sec col gap4 px16 pb16"
                  style={{
                    paddingLeft: '32px',
                  }}
                >
                  {[1, 2, 3, 4].map((i) => (
                    <li key={i}>{t('about.note' + i)}</li>
                  ))}
                </ul>
              ) : null}
            </Card>
            <Card>
              <Tile
                inCard
                leading={<Icon name="scroll-text" size={20} class="c-brand" />}
                title={t('legal.kosullar.title')}
                chevron
                action="SET-04.terms"
                onClick={() =>
                  app.nav.push('AUT-06', {
                    tab: 'kosullar',
                  })
                }
              />
              <div className="divider" />
              <Tile
                inCard
                leading={<Icon name="shield" size={20} class="c-brand" />}
                title={t('legal.gizlilik.title')}
                chevron
                action="SET-04.privacy"
                onClick={() =>
                  app.nav.push('AUT-06', {
                    tab: 'gizlilik',
                  })
                }
              />
              <div className="divider" />
              <Tile
                inCard
                leading={<Icon name="life-buoy" size={20} class="c-brand" />}
                title={t('support.title')}
                chevron
                action="SET-04.support"
                onClick={() => app.nav.push('SET-05')}
              />
            </Card>
          </div>
        </Scroll>
      </>
    );
  },
};

/* SET-05 */
S['SET-05'] = {
  tab: 'profile',
  title: 'support.title',
  comp: function Support() {
    const u = app.uid();
    const [q, setQ] = useState('');
    const [open, setOpen] = useState<any>(null);
    const [f, set, reset] = useForm('support', {
      subject: null,
      message: '',
      attached: false,
      sent: null,
      errors: {},
    });
    const [busy, run] = useBusy();
    const [menu, setMenu] = useState(false);
    const faqs = [1, 2, 3, 4, 5, 6, 7, 8]
      .map((i) => ({
        i,
        q: t('faq.q' + i),
        a: t('faq.a' + i),
      }))
      .filter((x) => !q || (x.q + ' ' + x.a).toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')));
    const subjects = ['bug', 'suggestion', 'account', 'club', 'other'];
    const send = () =>
      run(async () => {
        const e: any = {};
        if (!f.subject) e.subject = t('auth.err.required');
        if (!f.message.trim()) e.message = t('auth.err.required');
        set({
          errors: e,
        });
        if (Object.keys(e).length) return;
        if (!app.requireOnline()) return;
        await app.api();
        const no = app.dispatch('support.send', {
          userId: u,
          subject: f.subject,
          message: f.message.trim(),
        });
        set({
          sent: no,
        });
        app.toast('TST-23', {
          no,
        });
      });
    return [
      <AppBar onBack={() => app.nav.back()} backAction="SET-05.back" title={t('support.title')} />,
      <Scroll routeKey="support">
        <div className="col gap16 px16 pb24">
          <Input icon="search" placeholder={t('support.searchFaq')} value={q} onInput={setQ} action="SET-05.search" ariaLabel={t('support.searchFaq')} />
          <h2 className="t-title-s">{t('support.faq')}</h2>
          <Card>
            {faqs.length ? (
              faqs.map((x, k) => (
                <div key={x.i}>
                  {k ? <div className="divider" /> : null}
                  <button
                    type="button"
                    className="tile in-card"
                    aria-expanded={open === x.i ? 'true' : 'false'}
                    data-action={'SET-05.faq.' + x.i}
                    onClick={() => setOpen(open === x.i ? null : x.i)}
                  >
                    <span className="tile-text t-body-m c-heading">{x.q}</span>
                    <Icon name={open === x.i ? 'chevron-up' : 'chevron-down'} size={20} class="c-muted" />
                  </button>
                  {open === x.i ? <p className="t-body-s c-sec px16 pb16">{x.a}</p> : null}
                </div>
              ))
            ) : (
              <p className="t-body-s c-muted p16">{t('support.noFaq')}</p>
            )}
          </Card>
          <h2 className="t-title-s">{t('support.contact')}</h2>
          {f.sent ? (
            <Card
              class="card-body col gap12"
              style={{
                alignItems: 'center',
              }}
            >
              <SuccessCheck size={72} />
              <span className="t-title-s">{t('support.sentTitle')}</span>
              <span className="t-body-s c-sec center">
                {t('support.sentDesc', {
                  no: f.sent,
                })}
              </span>
              <Button variant="outline" label={t('support.newRequest')} action="SET-05.newRequest" onClick={() => reset()} />
            </Card>
          ) : (
            <>
              <Picker
                label={t('support.subject')}
                value={f.subject ? t('support.subject.' + f.subject) : ''}
                placeholder={t('common.select')}
                error={f.errors.subject}
                action="SET-05.subject"
                onClick={() => setMenu(true)}
              />
              <Input
                label={t('support.message')}
                multiline
                rows={4}
                value={f.message}
                onInput={(v) =>
                  set({
                    message: v.slice(0, 500),
                  })
                }
                maxLength={500}
                counter
                error={f.errors.message}
                action="SET-05.message"
              />
              <div className="row gap8">
                <Button
                  size="sm"
                  variant={f.attached ? 'tonal' : 'outline'}
                  icon={f.attached ? 'circle-check' : 'image'}
                  label={f.attached ? t('support.attached') : t('support.attach')}
                  action="SET-05.attach"
                  onClick={() =>
                    app.openSheet('SHT-16', {
                      onPick: () =>
                        set({
                          attached: true,
                        }),
                    })
                  }
                />
                <span className="t-caption">{t('common.optional')}</span>
              </div>
              <Button full label={t('common.send')} loading={busy} action="SET-05.send" onClick={send} />
            </>
          )}
        </div>
      </Scroll>,
      menu ? (
        <PopMenu id="SET-05" onClose={() => setMenu(false)}>
          {subjects.map((s) => (
            <Tile
              key={s}
              title={t('support.subject.' + s)}
              trailing={f.subject === s ? <Icon name="check" size={18} class="c-brand" /> : null}
              action={'SET-05.subject.' + s}
              onClick={() => {
                set({
                  subject: s,
                  errors: {
                    ...f.errors,
                    subject: null,
                  },
                });
                setMenu(false);
              }}
            />
          ))}
        </PopMenu>
      ) : null,
    ];
  },
};
