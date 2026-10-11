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
  cx,
  deptYear,
  useBusy,
  useForm,
  useState,
  useEffect,
  userName,
  ClubEmblem,
  Cover,
  LD,
  useLoader,
  A,
  handleError,
  db,
  Fragment,
  trLower,
  useStorageUrl,
} from '../ui/kit';
import * as AD from '../data/repo/admin';
import * as U from '../data/repo/users';
import { errCode } from '../data/fs';
import type { Membership, User } from '../data/models';
import { pickFiles } from './sheets';

/* ===== SCREENS: ADM (süper admin) ===== */
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
        onChange={(id: string) => app.nav.replace(id)}
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
const AdminHeader = () => (
  <AppBar large title={t('nav.admin')}>
    <RoleBadge role="superadmin" />
  </AppBar>
);

/* ADM-01 */
S['ADM-01'] = {
  tab: 'admin',
  title: 'nav.admin',
  comp: function Overview({ route }: any) {
    const [range, setRange] = useState('30');
    const ok = isSuper();
    const clubsLoad = useLoader(ok ? LD.adminClubsLoader() : null);
    const ov = useLoader(ok ? LD.adminOverviewLoader(range) : null);
    if (!ok) return <NoAdmin screen="ADM-01" />;
    const data = db.extra['adm:overview:' + range];
    const clubs = sel().allClubs();
    const active = clubs.filter((c) => c.status === 'active');
    const suspended = clubs.filter((c) => c.status === 'suspended');
    const top = active
      .slice()
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 5);
    const max = top[0] ? Math.max(1, top[0].memberCount) : 1;
    const past = data?.past || { events: 0, registered: 0, attended: 0 };
    const rate = past.registered ? (past.attended / past.registered) * 100 : 0;
    const openReports = data ? data.openGroups : 0;
    const loading = !data && ov.status !== 'error';
    const reload = () => {
      void clubsLoad.reload();
      void ov.reload();
    };
    return (
      <>
        <AdminHeader />
        <AdminNav current="ADM-01" />
        <Scroll routeKey={route.key} onRefresh={reload} refreshAction="ADM-01.refresh">
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
            {ov.status === 'error' && !data ? (
              <EmptyState illustration="error" title={t('web.err.generic')} cta={t('common.retry')} ctaAction="ADM-01.retry" onCta={reload} compact />
            ) : null}
            <div className={cx('grid2', loading && 'is-loading')} aria-busy={loading || undefined}>
              <KPI label={t('admin.kpi.activeClubs')} value={active.length} icon="users-round" action="ADM-01.kpi.clubs" onClick={() => app.nav.replace('ADM-02')} />
              <KPI
                label={t('admin.kpi.users')}
                value={data ? app.fmt.num(data.stats.users) : '–'}
                sub={data ? t('admin.kpi.newUsers', { count: data.newUsers }) : undefined}
                icon="user"
                action="ADM-01.kpi.users"
                onClick={() => app.nav.replace('ADM-05')}
              />
              <KPI
                label={t('admin.kpi.suspended')}
                value={suspended.length}
                icon="ban"
                action="ADM-01.kpi.suspended"
                onClick={() => app.nav.replace('ADM-02', { tab: 'suspended' })}
              />
              <KPI
                label={t('admin.kpi.openReports')}
                value={data ? openReports : '–'}
                accent
                icon="flag"
                action="ADM-01.kpi.reports"
                onClick={() => app.nav.replace('ADM-04')}
              />
            </div>
            <Card class="card-body col gap8">
              <span className="t-label-l c-heading">{t('admin.wau')}</span>
              {data ? (
                <MiniLineChart data={data.weekly} labels={data.weekly.map((_: number, i: number) => t('mgt.weekN', { n: i - 7 }))} action="ADM-01.chart.point" />
              ) : (
                <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
              )}
            </Card>
            <Card class="card-body col gap10">
              <span className="t-label-l c-heading">{t('admin.topClubs')}</span>
              {top.length ? (
                top.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className="col gap4"
                    style={{ textAlign: 'left', width: '100%' }}
                    data-action={'ADM-01.topClub.' + c.id}
                    onClick={() => app.nav.push('CLB-03', { id: c.id })}
                  >
                    <span className="row between">
                      <span className="t-body-s c-heading ellipsis">{c.name}</span>
                      <span className="t-caption tnum">{c.memberCount}</span>
                    </span>
                    <Progress value={c.memberCount} max={max} thin label={c.name} />
                  </button>
                ))
              ) : (
                <div className="skeleton" style={{ height: 80, borderRadius: 12 }} />
              )}
            </Card>
            <Card class="card-body row gap16">
              <Donut value={rate} label={t('admin.attendanceRate')} />
              <div className="col gap4 flex1">
                <span className="t-label-l c-heading">{t('admin.attendanceRate')}</span>
                <span className="t-body-s c-sec">
                  {t('admin.attendanceDesc', {
                    events: past.events,
                    attended: past.attended,
                    registered: past.registered,
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
                  title={t('admin.task.reports', { count: openReports })}
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
                  title={t('admin.task.suspended', { count: suspended.length })}
                  chevron
                  action="ADM-01.task.suspended"
                  onClick={() => app.nav.replace('ADM-02', { tab: 'suspended' })}
                />
              </Card>
            </div>
          </div>
        </Scroll>
      </>
    );
  },
};

/** Başkan atama (ADM-02 menüsü ve ADM-03 düzenleme): üye değilse üyelik + iletişim e-postası da yazılır. */
async function assignPresident(clubId: string, user: User) {
  const email = await U.getMyEmail(user.id).catch(() => null);
  try {
    await AD.assignPresident({ clubId, toUser: user, toEmail: email, actorId: app.uid()! });
  } catch (e) {
    if (errCode(e) === 'advisorCannotBePresident') {
      app.toast('TST-X40', { text: t('web.admin.advisorCannotBePresident') });
      return false;
    }
    throw e;
  }
  db.invalidate('adm:clubs');
  db.invalidate('board:' + clubId);
  db.invalidate('members:' + clubId);
  await A.reloadClubs().catch(() => {});
  const { getClub } = await import('../data/repo/clubs');
  db.putClubs([await getClub(clubId)]);
  return true;
}

/* ADM-02 */
S['ADM-02'] = {
  tab: 'admin',
  title: 'adminClubs.title',
  comp: function AdminClubs({ params, route }: any) {
    const [tab, setTab] = useState(params.tab || 'active');
    const [q, setQ] = useState('');
    const [menu, setMenu] = useState<any>(null);
    const ok = isSuper();
    const load = useLoader(ok ? LD.adminClubsLoader() : null);
    if (!ok) return <NoAdmin screen="ADM-02" />;
    const list = sel()
      .allClubs()
      .filter((c) => c.status === tab)
      .filter((c) => !q || trLower(c.name).includes(trLower(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return (
      <>
        <AdminHeader />
        <AdminNav current="ADM-02" />
        <div className="px16 pb16 col gap8">
          <Segmented
            options={[
              { id: 'active', label: t('status.active') },
              { id: 'suspended', label: t('status.suspended') },
            ]}
            value={tab}
            onChange={setTab}
            action="ADM-02.tab"
          />
          <Input icon="search" placeholder={t('common.search')} value={q} onInput={setQ} action="ADM-02.search" ariaLabel={t('common.search')} />
        </div>
        <Scroll routeKey={route.key} onRefresh={load.reload} refreshAction="ADM-02.refresh">
          <ListState
            status={load.status !== 'ok' && list.length ? 'ok' : load.status}
            onRetry={load.reload}
            n={5}
            emptyProps={{ illustration: 'empty-clubs', title: t('adminClubs.empty') }}
          >
            {list.length ? (
              <>
                {list.map((c) => {
                  const pres = sel().user(c.presidentId);
                  return (
                    <Tile
                      key={c.id}
                      leading={<ClubEmblem club={c} cls="is-sm" size={20} />}
                      title={c.name}
                      subtitle={`${t('role.president')}: ${userName(pres)} · ${t('clubs.card.members', { count: c.memberCount })}`}
                      sub2={c.status === 'suspended' ? <StatusBadge status={c.status} /> : null}
                      action={'ADM-02.row.' + c.id}
                      onClick={() => app.nav.push('CLB-03', { id: c.id })}
                      trailing={
                        <IconButton
                          icon="more-vertical"
                          label={t('a11y.more')}
                          action={'ADM-02.menu.' + c.id}
                          onClick={(e: any) => {
                            e.stopPropagation();
                            setMenu(c);
                          }}
                        />
                      }
                    />
                  );
                })}
                <div style={{ height: 72 }} />
              </>
            ) : (
              <EmptyState illustration="empty-clubs" title={t('adminClubs.empty')} />
            )}
          </ListState>
        </Scroll>
        <button type="button" className="fab" style={{ bottom: 'calc(var(--nav-h) + 16px)' }} data-action="ADM-02.create" onClick={() => app.nav.push('ADM-03')}>
          <Icon name="plus" size={22} />
          {t('adminClubs.create')}
        </button>
        {menu ? (
          <PopMenu id="ADM-02" onClose={() => setMenu(null)}>
            <Tile
              title={t('common.view')}
              leading={<Icon name="eye" size={20} />}
              action={'ADM-02.menu.' + menu.id + '.view'}
              onClick={() => {
                setMenu(null);
                app.nav.push('CLB-03', { id: menu.id });
              }}
            />
            <Tile
              title={t('common.edit')}
              leading={<Icon name="pencil" size={20} />}
              action={'ADM-02.menu.' + menu.id + '.edit'}
              onClick={() => {
                setMenu(null);
                app.nav.push('ADM-03', { id: menu.id });
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
                  onSelect: (_uid: string, user: User) => {
                    app.closeSheet();
                    if (!app.requireOnline()) return;
                    assignPresident(c.id, user)
                      .then((done) => done && app.toast('TST-49', { name: user.name }))
                      .catch(handleError);
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
                app.openDialog('DLG-28', { clubId: c.id, onDone: () => db.invalidate('adm') });
              }}
            />
          </PopMenu>
        ) : null}
      </>
    );
  },
};

/* ADM-03 */
const blankClubForm = () => ({
  name: '',
  categoryId: null as string | null,
  summary: '',
  about: '',
  iconName: 'sparkles',
  cover: { palette: 'red', pattern: 'mountain', seed: 'club-new-' + Date.now() } as any,
  logoFile: null as File | null,
  logoUrl: null as string | null,
  presidentId: null as string | null,
  advisorName: '',
  advisorTitle: '',
  applicationsOpen: true,
  approvalRequired: true,
  errors: {} as any,
  dirty: false,
});
function formOf(c: any) {
  return {
    ...blankClubForm(),
    name: c.name,
    categoryId: c.categoryId,
    summary: c.summary || '',
    about: c.about || '',
    iconName: c.iconName,
    cover: { palette: c.palette, pattern: c.pattern, seed: c.coverSeed, path: c.coverPath },
    presidentId: c.presidentId,
    advisorName: c.advisor?.name || '',
    advisorTitle: c.advisor?.title || '',
    applicationsOpen: c.applicationsOpen,
    approvalRequired: c.approvalRequired,
  };
}
function LogoPreview({ f, icon }: any) {
  const url = useStorageUrl(f.logoUrl ? null : f.logoPath);
  const src = f.logoUrl || url;
  return src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <Icon name={icon} size={30} />;
}
S['ADM-03'] = {
  tab: 'admin',
  title: 'clubForm.title',
  comp: function ClubForm({ params, route }: any) {
    const ok = isSuper();
    const editing = params.id ? sel().club(params.id) : null;
    const clubLoad = useLoader(ok && params.id && !editing ? LD.clubLoader(params.id) : null);
    const [busy, run] = useBusy();
    const key = 'clubForm-' + (params.id || 'new');
    const [f, set, reset] = useForm(key, () => (editing ? formOf(editing) : blankClubForm()));
    // Kulüp belgesi sonradan yüklendiyse form bir kez onunla doldurulur.
    useEffect(() => {
      if (editing && !f.dirty && f.name === '' && editing.name) set(formOf(editing));
      // eslint-disable-next-line
    }, [editing?.id]);
    const presLoad = useLoader(ok && f.presidentId && !sel().user(f.presidentId) ? { key: 'user:' + f.presidentId, fn: () => U.loadUsers([f.presidentId]) } : null);
    void presLoad;
    if (!ok) return <NoAdmin screen="ADM-03" />;
    if (params.id && !editing) {
      return clubLoad.status === 'error' ? (
        <>
          <AppBar onBack={() => app.nav.back()} backAction="ADM-03.close" closeIcon title={t('clubForm.editTitle')} />
          <EmptyState illustration="error" title={t('web.err.generic')} cta={t('common.retry')} ctaAction="ADM-03.retry" onCta={clubLoad.reload} />
        </>
      ) : (
        <>
          <AppBar onBack={() => app.nav.back()} backAction="ADM-03.close" closeIcon title={t('clubForm.editTitle')} />
          <div className="p16">
            <div className="skeleton" style={{ height: 240, borderRadius: 16 }} />
          </div>
        </>
      );
    }
    const upd = (p: any) => set({ ...p, dirty: true });
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
        const name = f.name.trim().replace(/\s+/g, ' ');
        if (!name) e.name = t('auth.err.required');
        else if (name.length < 3) e.name = t('web.err.nameLength', { min: 3, max: 80 });
        else if (sel().allClubs().some((c) => trLower(c.name) === trLower(name) && (!editing || c.id !== editing.id))) e.name = t('clubForm.err.unique');
        if (!f.categoryId) e.categoryId = t('auth.err.required');
        if (!f.presidentId) e.presidentId = t('auth.err.required');
        if (f.advisorTitle.trim() && !f.advisorName.trim()) e.advisorName = t('auth.err.required');
        set({ errors: e });
        if (Object.keys(e).length) return;
        if (!app.requireOnline()) return;
        const cat = CATEGORIES.find((c) => c.id === f.categoryId);
        const iconName = cat ? cat.icon : f.iconName;
        const advisor = f.advisorName.trim() ? { name: f.advisorName.trim(), title: f.advisorTitle.trim() } : null;
        const pres = sel().user(f.presidentId);
        try {
          if (editing) {
            const prevAdvisor = editing.advisor;
            const sameAdvisor = !!prevAdvisor && !!advisor && trLower(prevAdvisor.name) === trLower(advisor.name);
            await A.updateClubIdentity(editing.id, {
              name,
              categoryId: f.categoryId,
              iconName,
              founded: editing.founded,
              advisor: sameAdvisor ? { ...advisor!, userId: prevAdvisor!.userId ?? null } : editing.advisor,
            } as any);
            // Danışman değişti/kaldırıldı: bağlı danışman üyeliği de kapatılır (M13).
            if (!sameAdvisor && (advisor || prevAdvisor)) await AD.setAdvisor({ clubId: editing.id, advisor: advisor ? { ...advisor, userId: null } : null, user: null });
            const patch: any = {};
            (['summary', 'about', 'applicationsOpen', 'approvalRequired'] as const).forEach((k) => {
              const v = typeof f[k] === 'string' ? f[k].trim() : f[k];
              if (v !== (editing as any)[k]) patch[k] = v;
            });
            if (f.cover.palette !== editing.palette) patch.palette = f.cover.palette;
            if (f.cover.pattern !== editing.pattern) patch.pattern = f.cover.pattern;
            if (f.cover.seed && f.cover.seed !== editing.coverSeed) patch.coverSeed = f.cover.seed;
            if (!f.cover.file && !f.cover.path && editing.coverPath) patch.coverPath = null;
            if (Object.keys(patch).length) await A.updateClubSettings(editing.id, patch);
            if (f.cover.file) await A.uploadClubImage(editing.id, f.cover.file, 'cover');
            if (f.logoFile) await A.uploadClubImage(editing.id, f.logoFile, 'logo');
            if (f.presidentId !== editing.presidentId && pres) await assignPresident(editing.id, pres);
            app.toast('TST-21');
          } else {
            if (!pres) return;
            const email = (await U.getMyEmail(pres.id).catch(() => null)) || '';
            const id = await A.createClub(
              {
                name,
                categoryId: f.categoryId,
                iconName,
                founded: new Date().getFullYear(),
                summary: f.summary,
                about: f.about,
                palette: f.cover.palette,
                pattern: f.cover.pattern,
                approvalRequired: f.approvalRequired,
              },
              pres,
              email,
              advisor,
            );
            if (!f.applicationsOpen) await A.updateClubSettings(id, { applicationsOpen: false });
            if (f.cover.file) await A.uploadClubImage(id, f.cover.file, 'cover');
            if (f.logoFile) await A.uploadClubImage(id, f.logoFile, 'logo');
            app.toast('TST-33');
          }
        } catch (err) {
          if (errCode(err) === 'nameTaken') {
            set({ errors: { name: t('clubForm.err.unique') } });
            return;
          }
          throw err;
        }
        db.invalidate('adm');
        db.invalidate('clubs');
        reset();
        if (!app.nav.popTo('ADM-02')) app.nav.replace('ADM-02');
      });
    const pres = f.presidentId ? sel().user(f.presidentId) : null;
    const icon = f.categoryId ? (CATEGORIES.find((c) => c.id === f.categoryId) || ({} as any)).icon || f.iconName : f.iconName;
    return (
      <>
        <AppBar onBack={close} backAction="ADM-03.close" closeIcon title={editing ? t('clubForm.editTitle') : t('clubForm.title')} />
        <Scroll routeKey={route.key}>
          <div className="col gap16 px16 pt8 pb24">
            <Input
              label={t('clubSettings.name')}
              value={f.name}
              onInput={(v: string) => upd({ name: v.slice(0, 80), errors: { ...f.errors, name: null } })}
              error={f.errors.name}
              action="ADM-03.name"
              autofocus={!editing}
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
                  onSelect: (id: string) => upd({ categoryId: id, errors: { ...f.errors, categoryId: null } }),
                })
              }
            />
            <Input label={t('clubSettings.summary')} value={f.summary} onInput={(v: string) => upd({ summary: v.slice(0, 160) })} maxLength={160} counter action="ADM-03.summary" />
            <Input
              label={t('clubSettings.about')}
              multiline
              rows={4}
              value={f.about}
              onInput={(v: string) => upd({ about: v.slice(0, 1000) })}
              maxLength={1000}
              counter
              action="ADM-03.about"
            />
            <div className="row gap12">
              <button
                type="button"
                className="emblem"
                style={{ overflow: 'hidden' }}
                data-action="ADM-03.logo"
                onClick={() =>
                  pickFiles({}, (files: File[]) => {
                    const file = files[0];
                    if (file) upd({ logoFile: file, logoUrl: URL.createObjectURL(file) });
                  })
                }
                aria-label={t('clubSettings.logo')}
              >
                <LogoPreview f={{ ...f, logoPath: editing?.logoPath }} icon={icon} />
              </button>
              <button
                type="button"
                className="cover flex1"
                style={{ borderRadius: '16px', position: 'relative', height: '72px' }}
                data-action="ADM-03.cover"
                onClick={() =>
                  app.openSheet('SHT-31', {
                    value: f.cover,
                    icon,
                    onSelect: (c: any) =>
                      upd({ cover: c.file ? { ...c, path: null, url: URL.createObjectURL(c.file) } : { ...c, path: null, file: null, url: null } }),
                  })
                }
                aria-label={t('clubSettings.cover')}
              >
                {f.cover.url ? (
                  <img src={f.cover.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Cover seed={f.cover.seed} icon={icon} palette={f.cover.palette} pattern={f.cover.pattern} path={f.cover.path} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                )}
                <span className="badge badge-neutral" style={{ position: 'absolute', right: '8px', bottom: '8px', background: 'var(--bg-surface)' }}>
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
                    trailing={<Button size="sm" variant="text" label={t('common.remove')} action="ADM-03.removePresident" onClick={() => upd({ presidentId: null })} />}
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
                      onSelect: (uid: string) => {
                        app.closeSheet();
                        upd({ presidentId: uid, errors: { ...f.errors, presidentId: null } });
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
            <div className="row gap8 start">
              <div style={{ width: '120px' }}>
                <Input label={t('clubForm.advisorTitle')} value={f.advisorTitle} onInput={(v: string) => upd({ advisorTitle: v.slice(0, 40) })} placeholder="Dr." action="ADM-03.advisorTitle" />
              </div>
              <div className="flex1">
                <Input
                  label={t('club.advisor')}
                  value={f.advisorName}
                  onInput={(v: string) => upd({ advisorName: v.slice(0, 80), errors: { ...f.errors, advisorName: null } })}
                  error={f.errors.advisorName}
                  action="ADM-03.advisorName"
                />
              </div>
            </div>
            <Card>
              {[
                ['applicationsOpen', 'lock-open'],
                ['approvalRequired', 'shield-check'],
              ].map(([k, ic], i) => (
                <Fragment key={k}>
                  {i ? <div className="divider" /> : null}
                  <div className="tile is-plain in-card">
                    <Icon name={ic} size={20} class="c-muted" />
                    <span className="tile-text t-body-m c-heading">{t('clubSettings.' + k)}</span>
                    <Switch checked={f[k]} onChange={(v: boolean) => upd({ [k]: v })} action={'ADM-03.toggle.' + k} label={t('clubSettings.' + k)} />
                  </div>
                </Fragment>
              ))}
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
const TARGET_ICON: Record<string, string> = { post: 'file-text', comment: 'message-circle', user: 'user', club: 'users-round', event: 'calendar' };
S['ADM-04'] = {
  tab: 'admin',
  title: 'reports.title',
  comp: function Reports({ route }: any) {
    const [tab, setTab] = useState<'open' | 'resolved'>('open');
    const [type, setType] = useState('all');
    const ok = isSuper();
    const load = useLoader(ok ? LD.adminReportsLoader(tab) : null);
    useLoader(ok && tab !== 'open' ? LD.adminReportsLoader('open') : null);
    if (!ok) return <NoAdmin screen="ADM-04" />;
    const data = db.extra['adm:reports:' + tab] || { groups: [], previews: {} };
    const openCount = (db.extra['adm:reports:open']?.groups || []).length;
    const list: any[] = data.groups.filter((g: any) => type === 'all' || g.targetType === type);
    const preview = (g: any) => {
      const k = g.targetType + '_' + g.targetId;
      if (g.targetType === 'user') return userName(sel().user(g.targetId));
      if (g.targetType === 'club') return sel().club(g.targetId)?.name || t('saved.removed');
      return data.previews[k] ?? t('saved.removed');
    };
    const done = () => {
      db.invalidate('adm');
      void load.reload();
    };
    return (
      <>
        <AdminHeader />
        <AdminNav current="ADM-04" />
        <Tabs
          tabs={[
            { id: 'open', label: t('reports.tab.open'), count: openCount || undefined },
            { id: 'resolved', label: t('reports.tab.resolved') },
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
        <Scroll routeKey={route.key + tab} onRefresh={load.reload} refreshAction="ADM-04.refresh">
          <ListState
            status={load.status !== 'ok' && data.groups.length ? 'ok' : load.status}
            onRetry={load.reload}
            n={4}
            emptyProps={{ illustration: 'empty-notifications', title: t('reports.empty.' + tab) }}
          >
            {list.length ? (
              list.map((g) => {
                const reasons = g.reports.map((r: any) => r.reason);
                const top = reasons.sort((a: string, b: string) => reasons.filter((x: string) => x === b).length - reasons.filter((x: string) => x === a).length)[0];
                return (
                  <Tile
                    key={g.key}
                    leading={
                      <span className={cx('notif-icon', tab === 'open' ? 'ni-warning' : 'ni-success')}>
                        <Icon name={TARGET_ICON[g.targetType] || 'flag'} size={18} />
                      </span>
                    }
                    title={<span className="clamp1">{preview(g)}</span>}
                    subtitle={
                      <span className="row gap6 wrap">
                        <Badge kind="danger" label={t('reportReason.' + top)} />
                        {g.reports.length > 1 ? <Badge kind="pending" icon="flag" label={t('content.reports', { count: g.reports.length })} /> : null}
                        <span className="t-caption">{app.fmt.rel(g.latest)}</span>
                      </span>
                    }
                    chevron
                    action={'ADM-04.row.' + g.targetId}
                    onClick={() => app.openSheet('SHT-26', { group: g, onDone: done })}
                  />
                );
              })
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
    const [term, setTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const [menu, setMenu] = useState<any>(null);
    const [history, setHistory] = useState<any>(null);
    useEffect(() => {
      const id = setTimeout(() => setTerm(trLower(q.trim())), 300);
      return () => clearTimeout(id);
    }, [q]);
    const ok = isSuper();
    const load = useLoader(ok ? LD.adminUsersLoader(filter, term) : null);
    if (!ok) return <NoAdmin screen="ADM-05" />;
    const data = db.extra[`adm:users:${filter}:${term}`] || { ids: [], byUser: {} };
    const list = (data.ids as string[]).map((id) => sel().user(id)).filter((u): u is User => !!u);
    const msOf = (uid: string): Membership[] => data.byUser[uid] || [];
    return (
      <>
        <AdminHeader />
        <AdminNav current="ADM-05" />
        <div className="px16 pb8">
          <Input icon="search" placeholder={t('adminUsers.search')} value={q} onInput={setQ} action="ADM-05.search" ariaLabel={t('adminUsers.search')} />
        </div>
        <div className="hscroll py8">
          {[
            ['all', t('common.all')],
            ['suspended', t('status.suspended')],
            ['managers', t('adminUsers.managers')],
          ].map(([id, l]) => (
            <Chip key={id} label={l} selected={filter === id} action={'ADM-05.filter.' + id} onClick={() => setFilter(id)} />
          ))}
        </div>
        <Scroll routeKey={route.key} onRefresh={load.reload} refreshAction="ADM-05.refresh">
          <ListState
            status={load.status !== 'ok' && list.length ? 'ok' : load.status}
            onRetry={load.reload}
            n={6}
            emptyProps={{ illustration: 'empty-clubs', title: t('members.noResults') }}
          >
            {list.length ? (
              list.map((u) => {
                const ms = msOf(u.id);
                const active = ms.filter((m) => m.status === 'active');
                return (
                  <div key={u.id}>
                    <Tile
                      leading={<Avatar user={u} size={40} />}
                      title={
                        <span className="row gap6">
                          <span className="ellipsis" style={{ maxWidth: '180px' }}>
                            {u.name}
                          </span>
                          {u.status === 'suspended' ? <StatusBadge status="suspended" /> : null}
                        </span>
                      }
                      subtitle={`${deptYear(u) || '—'} · ${t('adminUsers.clubCount', { count: active.length })}`}
                      action={'ADM-05.row.' + u.id}
                      onClick={() => app.nav.push('CLB-07', { id: u.id })}
                      trailing={
                        <IconButton
                          icon="more-vertical"
                          label={t('a11y.more')}
                          action={'ADM-05.menu.' + u.id}
                          onClick={(e: any) => {
                            e.stopPropagation();
                            setMenu(u);
                          }}
                        />
                      }
                    />
                    {history === u.id ? (
                      <div className="px16 pb16">
                        <Card muted class="card-body col gap6">
                          {ms.length ? (
                            ms
                              .slice()
                              .sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0))
                              .map((m) => (
                                <div key={m.clubId} className="row between gap8">
                                  <span className="t-body-s c-heading ellipsis">{sel().club(m.clubId)?.name || '—'}</span>
                                  <StatusBadge status={m.status === 'active' ? 'active' : m.status} label={m.status === 'active' ? t('role.' + m.role) : undefined} />
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
        </Scroll>
        {menu ? (
          <PopMenu id="ADM-05" onClose={() => setMenu(null)}>
            <Tile
              title={t('userprofile.view')}
              leading={<Icon name="user" size={20} />}
              action={'ADM-05.menu.' + menu.id + '.profile'}
              onClick={() => {
                setMenu(null);
                app.nav.push('CLB-07', { id: menu.id });
              }}
            />
            {menu.id !== app.uid() ? (
              <Tile
                title={menu.status === 'suspended' ? t('adminUsers.unsuspend') : t('adminUsers.suspend')}
                danger={menu.status !== 'suspended'}
                leading={<Icon name={menu.status === 'suspended' ? 'circle-check' : 'ban'} size={20} />}
                action={'ADM-05.menu.' + menu.id + '.suspend'}
                onClick={() => {
                  const u = menu;
                  setMenu(null);
                  app.openDialog('DLG-30', { userId: u.id, onDone: () => db.invalidate('adm:users') });
                }}
              />
            ) : null}
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
        ) : null}
      </>
    );
  },
};
