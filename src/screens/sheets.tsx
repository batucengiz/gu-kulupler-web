import {
  Avatar,
  Badge,
  Banner,
  Button,
  CATEGORIES,
  Calendar,
  Card,
  Chip,
  DEPARTMENTS,
  EVENT_TYPES,
  FACULTIES,
  Icon,
  IconButton,
  Input,
  OptionRow,
  PALETTES,
  PATTERNS,
  PATTERN_NAMES,
  PLACES,
  PopMenu,
  PostCard,
  RoleBadge,
  Segmented,
  SheetFrame,
  StatusBadge,
  Switch,
  Tile,
  UserRow,
  YEARS,
  app,
  catName,
  copyText,
  coverArtSVG,
  cx,
  deptYear,
  downloadText,
  pad2,
  placeName,
  slug,
  today0,
  useBusy,
  useEffect,
  useFocusTrap,
  useRef,
  useState,
  userName,
  ClubEmblem,
  useStorageUrl,
  SkeletonList,
  trLower,
  handleError,
  db,
  LIMITS,
  A,
  LD,
  useLoader,
  session,
  notifPermission,
  setPrefs,
  prefs,
  SHEETS as REG_SHEETS,
  MENUS as REG_MENUS,
} from '../ui/kit';
import { ui, routePath } from '../app/core';
import { usePostLive } from '../app/loaders';
import * as M from '../data/repo/memberships';
import * as U from '../data/repo/users';
import * as RP from '../data/repo/reports';
import * as P from '../data/repo/posts';
import * as CM from '../data/repo/comments';
import * as E from '../data/repo/events';
import { getClub } from '../data/repo/clubs';
import * as AU from '../data/repo/auth';
import { errCode } from '../data/fs';
import { clubFilters } from './screens-clubs';
import { eventFilters } from './screens-events';
/* ===== SHEETS ===== 34 bottom sheets (+ small popup menus). Registry: SHEETS[id] = { title, comp, sample } */
const t = (k: string, p?: any) => app.t(k, p);
const sel = () => app.sel;
const SHEETS: Record<string, any> = REG_SHEETS;
const MENUS: Record<string, any> = REG_MENUS;
/** Paylaşılabilir mutlak adres (web sürümünün gerçek yolu). */
export const shareUrl = (screen: string, params: any) => location.origin + routePath({ screen, params });
const Row = ({ icon, label, onClick, action, danger, disabled, sub, trailing }: any) => (
  <Tile
    leading={<Icon name={icon} size={22} class={danger ? 'c-danger' : 'c-heading'} />}
    title={label}
    subtitle={sub}
    danger={danger}
    disabled={disabled}
    action={action}
    onClick={onClick}
    trailing={trailing}
  />
);
const setLocale = (loc: string) => {
  app.dispatch('session.set', {
    locale: loc,
  });
  try {
    document.documentElement.lang = loc;
  } catch (e) {}
};

/* SHT-01 language */
SHEETS['SHT-01'] = {
  title: 'sht.01.title',
  sample: () => ({}),
  comp: ({ close }) => (
    <SheetFrame id="SHT-01" title={t('sht.01.title')} onClose={close}>
      {[
        ['tr', 'Türkçe', 'TR'],
        ['en', 'English', 'EN'],
      ].map(([id, l, s]) => (
        <OptionRow
          key={id}
          label={l}
          sub={s}
          checked={app.locale() === id}
          action={'SHT-01.select.' + id}
          onClick={() => {
            setLocale(id);
            close();
          }}
        />
      ))}
    </SheetFrame>
  ),
};
MENUS['SHT-01'] = ({ close }) => (
  <PopMenu id="SHT-01" onClose={close}>
    {[
      ['tr', 'Türkçe — TR'],
      ['en', 'English — EN'],
    ].map(([id, l]) => (
      <Tile
        key={id}
        title={l}
        trailing={app.locale() === id ? <Icon name="check" size={18} class="c-brand" /> : null}
        action={'SHT-01.select.' + id}
        onClick={() => {
          setLocale(id);
          close();
        }}
      />
    ))}
  </PopMenu>
);
MENUS['EVT-MENU'] = ({ props, close }: any) => {
  const ev = sel().event(props.eventId);
  if (!ev) return null;
  const r = ev && sel().myRsvp(ev.id, app.uid());
  return (
    <PopMenu id="EVT-02" onClose={close}>
      {r ? (
        <Tile
          title={t('event.reminder')}
          leading={<Icon name="bell-ring" size={20} />}
          action="EVT-02.menu.reminder"
          onClick={() => {
            close();
            app.openSheet('SHT-13', {
              eventId: ev.id,
            });
          }}
        />
      ) : null}
      <Tile
        title={t('event.addToCalendar')}
        leading={<Icon name="calendar-plus" size={20} />}
        action="EVT-02.menu.calendar"
        onClick={() => {
          close();
          app.openSheet('SHT-14', {
            eventId: ev.id,
          });
        }}
      />
      <Tile
        title={t('common.share')}
        leading={<Icon name="share-2" size={20} />}
        action="EVT-02.menu.share"
        onClick={() => {
          close();
          app.openSheet('SHT-15', {
            type: 'event',
            id: ev.id,
          });
        }}
      />
      <Tile
        title={t('event.report')}
        leading={<Icon name="flag" size={20} />}
        action="EVT-02.menu.report"
        onClick={() => {
          close();
          app.openSheet('SHT-10', {
            targetType: 'event',
            targetId: ev.id,
          });
        }}
      />
    </PopMenu>
  );
};

/* SHT-02 department */
SHEETS['SHT-02'] = {
  title: 'sht.02.title',
  sample: () => ({
    value: 'd01',
    onSelect: () => {},
  }),
  comp: ({ props, close }) => {
    const [q, setQ] = useState('');
    const list = DEPARTMENTS.filter(
      (d) =>
        !q ||
        t('dept.' + d.id)
          .toLocaleLowerCase('tr')
          .includes(q.toLocaleLowerCase('tr')),
    );
    const selectedFirst = list.slice().sort((a, b) => (a.id === props.value ? -1 : b.id === props.value ? 1 : 0));
    const groups = FACULTIES.map((f) => [f, selectedFirst.filter((d) => d.faculty === f)] as const).filter(([, l]) => l.length);
    return (
      <SheetFrame id="SHT-02" title={t('sht.02.title')} onClose={close} full flush>
        <div className="px16 pb16">
          <Input icon="search" placeholder={t('common.search')} value={q} onInput={setQ} action="SHT-02.search" ariaLabel={t('common.search')} autofocus />
        </div>
        {groups.length ? (
          groups.map(([f, l]) => (
            <div key={f}>
              <div
                className="group-head"
                style={{
                  background: 'var(--bg-surface-raised)',
                }}
              >
                <span className="t-overline">{t('faculty.' + f)}</span>
              </div>
              {l.map((d) => (
                <OptionRow
                  key={d.id}
                  label={t('dept.' + d.id)}
                  checked={props.value === d.id}
                  action={'SHT-02.select.' + d.id}
                  onClick={() => {
                    props.onSelect && props.onSelect(d.id);
                    close();
                  }}
                />
              ))}
            </div>
          ))
        ) : (
          <p className="t-body-s c-muted center p16">{t('sht.02.empty')}</p>
        )}
      </SheetFrame>
    );
  },
};
/* SHT-03 year */
SHEETS['SHT-03'] = {
  title: 'sht.03.title',
  sample: () => ({
    value: '1',
    onSelect: () => {},
  }),
  comp: ({ props, close }) => (
    <SheetFrame id="SHT-03" title={t('sht.03.title')} onClose={close} flush>
      {YEARS.map((y) => (
        <OptionRow
          key={y}
          label={t('year.' + y)}
          checked={props.value === y}
          action={'SHT-03.select.' + y}
          onClick={() => {
            props.onSelect && props.onSelect(y);
            close();
          }}
        />
      ))}
    </SheetFrame>
  ),
};
/* SHT-04 club filter */
SHEETS['SHT-04'] = {
  title: 'sht.04.title',
  sample: () => ({}),
  comp: ({ close }) => {
    const { filtersOf, applyClubFilters, DEFAULT_FILTERS } = clubFilters;
    const [f, setF] = useState(filtersOf());
    const n = applyClubFilters(sel().allClubs(), f, app.uid()).length;
    const upd = (p) =>
      setF({
        ...f,
        ...p,
      });
    return (
      <SheetFrame
        id="SHT-04"
        title={t('sht.04.title')}
        onClose={close}
        footer={
          <>
            <Button
              variant="outline"
              label={t('common.clear')}
              action="SHT-04.clear"
              onClick={() =>
                setF({
                  ...DEFAULT_FILTERS,
                })
              }
            />
            <Button
              label={t('sht.04.show', {
                count: n,
              })}
              action="SHT-04.apply"
              onClick={() => {
                app.dispatch('ui.set', {
                  clubFilters: f,
                });
                close();
              }}
            />
          </>
        }
      >
        <div className="col gap20 pb16">
          <div className="col gap8">
            <span className="field-label">{t('sht.04.category')}</span>
            <div className="row wrap gap8">
              {CATEGORIES.map((c) => (
                <Chip
                  key={c.id}
                  icon={c.icon}
                  label={t('cat.' + c.id)}
                  selected={f.categories.includes(c.id)}
                  action={'SHT-04.category.' + c.id}
                  onClick={() =>
                    upd({
                      categories: f.categories.includes(c.id) ? f.categories.filter((x) => x !== c.id) : [...f.categories, c.id],
                    })
                  }
                />
              ))}
            </div>
          </div>
          <div className="col gap8">
            <span className="field-label">{t('sht.04.membership')}</span>
            <Segmented
              options={[
                {
                  id: 'all',
                  label: t('common.all'),
                },
                {
                  id: 'mine',
                  label: t('sht.04.mine'),
                },
                {
                  id: 'notMine',
                  label: t('sht.04.notMine'),
                },
              ]}
              value={f.membership}
              onChange={(v) =>
                upd({
                  membership: v,
                })
              }
              action="SHT-04.membership"
            />
          </div>
          <div className="row between">
            <span className="t-body-m">{t('sht.04.openOnly')}</span>
            <Switch
              checked={f.openOnly}
              onChange={(v) =>
                upd({
                  openOnly: v,
                })
              }
              action="SHT-04.toggle.openOnly"
              label={t('sht.04.openOnly')}
            />
          </div>
          <div className="row between">
            <span className="t-body-m">{t('sht.04.instantOnly')}</span>
            <Switch
              checked={f.instantOnly}
              onChange={(v) =>
                upd({
                  instantOnly: v,
                })
              }
              action="SHT-04.toggle.instantOnly"
              label={t('sht.04.instantOnly')}
            />
          </div>
          <div className="col gap4">
            <span className="field-label">{t('common.sort')}</span>
            {['popular', 'new', 'az'].map((s) => (
              <OptionRow
                key={s}
                label={t('sht.04.sort.' + s)}
                checked={f.sort === s}
                action={'SHT-04.sort.' + s}
                onClick={() =>
                  upd({
                    sort: s,
                  })
                }
              />
            ))}
          </div>
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-05 apply */
SHEETS['SHT-05'] = {
  title: 'sht.05.title',
  sample: () => ({
    clubId: 'c03',
  }),
  comp: ({ props, close }) => {
    const club = sel().club(props.clubId)!;
    const u = app.uid();
    const m = sel().membership(club.id, u);
    const [note, setNote] = useState(m && m.status === 'rejected' ? '' : (m && m.note) || '');
    const [err, setErr] = useState('');
    const [busy, run] = useBusy();
    const wait = !!(m && m.retryAfter && m.retryAfter > Date.now());
    const submit = () =>
      run(async () => {
        if (club.requireNote && !note.trim()) {
          setErr(t('auth.err.required'));
          return;
        }
        if (!app.requireOnline()) return;
        const r = await A.joinClub(club.id, note.trim());
        ui.closeAllSheets();
        if (r === 'joined') app.toast('TST-34', { action: () => app.nav.push('CLB-03', { id: club.id }) });
        else
          app.nav.push('CLB-04', {
            id: club.id,
          });
      });
    return (
      <SheetFrame
        id="SHT-05"
        title={t('sht.05.title')}
        onClose={close}
        dirty={!!note}
        footer={
          <Button
            size="lg"
            label={wait ? app.fmt.countdown(m!.retryAfter!) : t('sht.05.submit')}
            loading={busy}
            disabled={wait}
            action="SHT-05.submit"
            onClick={submit}
            onDisabledClick={() =>
              app.toast('TST-X4', {
                date: app.fmt.date(m!.retryAfter!),
              })
            }
          />
        }
      >
        <div className="col gap16 pb16">
          <div className="row gap12">
            <ClubEmblem club={club} cls="is-sm" size={20} />
            <div className="flex1">
              <div className="t-title-s">{club.name}</div>
              <div className="t-caption">
                {catName(club)}
                {' \xB7 '}
                {t('club.type.approval')}
              </div>
            </div>
          </div>
          <Input
            label={t('sht.05.why')}
            multiline
            rows={4}
            value={note}
            onInput={(v) => {
              setNote(v.slice(0, 300));
              setErr('');
            }}
            maxLength={300}
            counter
            error={err}
            help={club.requireNote ? t('common.required') : t('common.optional')}
            action="SHT-05.note"
            autofocus
          />
          <div
            className="row gap8 start"
            style={{
              alignItems: 'flex-start',
            }}
          >
            <Icon name="info" size={18} class="c-muted" />
            <p className="t-body-s c-sec flex1">
              {t('sht.05.privacy')}{' '}
              <button
                type="button"
                className="c-brand"
                data-action="SHT-05.legal"
                onClick={() => {
                  ui.closeAllSheets();
                  app.nav.push('AUT-06', {
                    tab: 'kvkk',
                  });
                }}
              >
                {t('legal.kvkk.short')}
              </button>
            </p>
          </div>
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-06 club menu */
SHEETS['SHT-06'] = {
  title: 'sht.06.title',
  sample: () => ({
    clubId: 'c01',
  }),
  comp: ({ props, close }) => {
    const club = sel().club(props.clubId)!;
    const u = app.uid();
    const mode = sel().mode(club.id, u);
    const member = ['member', 'manager', 'advisor'].includes(mode);
    const go = (fn: () => void) => () => {
      close();
      fn();
    };
    return (
      <SheetFrame id="SHT-06" title={club.name} onClose={close} menu flush>
        {member ? (
          <Row
            icon="bell"
            label={t('sht.06.notifications')}
            action="SHT-06.notifications"
            onClick={go(() =>
              app.openSheet('SHT-07', {
                clubId: club.id,
              }),
            )}
          />
        ) : null}
        <Row
          icon="share-2"
          label={t('common.share')}
          action="SHT-06.share"
          onClick={go(() =>
            app.openSheet('SHT-15', {
              type: 'club',
              id: club.id,
            }),
          )}
        />
        {member ? (
          <Row
            icon="users"
            label={t('members.title')}
            action="SHT-06.members"
            onClick={go(() =>
              app.nav.push('CLB-06', {
                id: club.id,
              }),
            )}
          />
        ) : null}
        <Row
          icon="flag"
          label={t('sht.06.report')}
          action="SHT-06.report"
          onClick={go(() =>
            app.openSheet('SHT-10', {
              targetType: 'club',
              targetId: club.id,
            }),
          )}
        />
        {mode === 'manager' || mode === 'super' ? (
          <Row
            icon="settings"
            label={t('clubSettings.title')}
            action="SHT-06.settings"
            onClick={go(() =>
              app.nav.push('MGT-09', {
                clubId: club.id,
              }),
            )}
          />
        ) : null}
        {mode === 'member' || mode === 'manager' ? (
          <Row
            icon="log-out"
            label={t('club.leave')}
            danger
            action="SHT-06.leave"
            onClick={go(() =>
              app.openDialog(mode === 'manager' && sel().isPresident(club.id, u) ? 'DLG-09' : 'DLG-08', {
                clubId: club.id,
              }),
            )}
          />
        ) : null}
      </SheetFrame>
    );
  },
};
/* SHT-07 club notif */
SHEETS['SHT-07'] = {
  title: 'sht.07.title',
  sample: () => ({
    clubId: 'c01',
  }),
  comp: ({ props, close }) => {
    const u = app.uid();
    const club = sel().club(props.clubId)!;
    const cs: any = sel().clubSettings(u, club.id);
    const set = (patch: any) => {
      A.updateClubPrefs(club.id, patch)
        .then(() => app.toast('TST-38'))
        .catch(handleError);
    };
    return (
      <SheetFrame id="SHT-07" title={t('sht.07.title')} onClose={close}>
        <p className="t-caption pb16">{club.name}</p>
        <div className="col">
          {[
            ['announcements', 'megaphone'],
            ['events', 'calendar-plus'],
            ['posts', 'file-text'],
          ].map(([k, icon]) => (
            <div
              key={k}
              className="tile is-plain"
              style={{
                paddingLeft: '0',
                paddingRight: '0',
              }}
            >
              <Icon name={icon} size={20} class="c-muted" />
              <span className="tile-text t-body-m c-heading">{t('sht.07.' + k)}</span>
              <Switch
                checked={cs[k] !== false && !cs.muted}
                onChange={(v) =>
                  set({
                    [k]: v,
                  })
                }
                action={'SHT-07.toggle.' + k}
                label={t('sht.07.' + k)}
                disabled={cs.muted}
                onDisabledClick={() => app.toast('TST-X16')}
              />
            </div>
          ))}
          <div className="divider" />
          <div
            className="tile is-plain"
            style={{
              paddingLeft: '0',
              paddingRight: '0',
            }}
          >
            <Icon name="bell-off" size={20} class="c-danger" />
            <span className="tile-text t-body-m c-heading">{t('sht.07.muteAll')}</span>
            <Switch
              checked={!!cs.muted}
              onChange={(v) =>
                set({
                  muted: v,
                  ...(v
                    ? {
                        announcements: false,
                        events: false,
                        posts: false,
                      }
                    : {
                        announcements: true,
                        events: true,
                        posts: true,
                      }),
                })
              }
              action="SHT-07.toggle.muted"
              label={t('sht.07.muteAll')}
            />
          </div>
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-08 post menu */
SHEETS['SHT-08'] = {
  title: 'sht.08.title',
  sample: () => ({
    postId: 'p01',
  }),
  comp: ({ props, close }) => {
    const u = app.uid();
    const post = sel().post(props.postId);
    if (!post) return null;
    const own = post.authorId === u;
    const manager = sel().isManager(post.clubId, u) || sel().isSuper(u);
    const saved = sel().isSaved(u, post.id);
    const go = (fn: () => void) => () => {
      close();
      fn();
    };
    return (
      <SheetFrame id="SHT-08" title={t('sht.08.title')} onClose={close} menu flush>
        <Row
          icon="bookmark"
          label={saved ? t('feed.unsave') : t('feed.save')}
          action="SHT-08.save"
          onClick={go(() => {
            if (!app.requireOnline()) return;
            A.toggleSave(post)
              .then((now) =>
                app.toast('TST-11', {
                  saved: now,
                  undo: () => A.toggleSave(sel().post(post.id) || post).catch(handleError),
                }),
              )
              .catch(handleError);
          })}
        />
        <Row
          icon="share-2"
          label={t('common.share')}
          action="SHT-08.share"
          onClick={go(() =>
            app.openSheet('SHT-15', {
              type: 'post',
              id: post.id,
            }),
          )}
        />
        <Row
          icon="link"
          label={t('sht.08.copyLink')}
          action="SHT-08.copyLink"
          onClick={go(() => {
            copyText(shareUrl('FED-02', { clubId: post.clubId, postId: post.id }));
            app.toast('TST-35');
          })}
        />
        {!own ? (
          <>
            <Row
              icon="flag"
              label={t('sht.06.report')}
              action="SHT-08.report"
              onClick={go(() =>
                app.openSheet('SHT-10', {
                  targetType: 'post',
                  targetId: post.id,
                  clubId: post.clubId,
                }),
              )}
            />
            <Row
              icon="ban"
              label={t('sht.08.blockUser')}
              action="SHT-08.block"
              onClick={go(() =>
                app.openDialog('DLG-13', {
                  userId: post.authorId,
                }),
              )}
            />
          </>
        ) : null}
        {manager ? (
          <>
            <div className="divider" />
            <Row
              icon="pencil"
              label={t('common.edit')}
              action="SHT-08.edit"
              onClick={go(() => {
                if (app.guard(post.clubId))
                  app.nav.push('FED-03', {
                    clubId: post.clubId,
                    edit: post.id,
                  });
              })}
            />
            <Row
              icon={post.pinned ? 'pin-off' : 'pin'}
              label={post.pinned ? t('post.unpin') : t('post.pin')}
              action="SHT-08.pin"
              onClick={go(() => {
                if (!app.guard(post.clubId)) return;
                A.setPinned(post, !post.pinned)
                  .then(() =>
                    app.toast('TST-53', {
                      pinned: !post.pinned,
                    }),
                  )
                  .catch(handleError);
              })}
            />
            <Row
              icon="trash-2"
              label={t('common.delete')}
              danger
              action="SHT-08.delete"
              onClick={go(
                () =>
                  app.guard(post.clubId) &&
                  app.openDialog('DLG-10', {
                    postId: post.id,
                  }),
              )}
            />
          </>
        ) : null}
      </SheetFrame>
    );
  },
};
/* SHT-09 comments */
SHEETS['SHT-09'] = {
  title: 'sht.09.title',
  sample: () => ({
    postId: 'p01',
  }),
  comp: ({ props, close }) => {
    const u = app.uid();
    const post = sel().post(props.postId);
    const [text, setText] = useState('');
    const [busy, run] = useBusy();
    usePostLive(props.postId, props.clubId || (post && post.clubId) || '');
    if (!post) return null;
    const comments = sel().postComments(post.id);
    const advisor = sel().isAdvisor(post.clubId, u);
    const send = () =>
      run(async () => {
        if (!text.trim() || !app.guard(post.clubId)) return;
        await A.addComment(post, text.trim());
        setText('');
        app.toast('TST-12');
      });
    return (
      <SheetFrame
        id="SHT-09"
        title={t('post.comments', {
          count: comments.length,
        })}
        onClose={close}
        headerExtra={
          <Button
            size="sm"
            variant="text"
            label={t('sht.09.seeAll')}
            action="SHT-09.seeAll"
            onClick={() => {
              close();
              app.nav.push('FED-02', {
                clubId: post.clubId,
                postId: post.id,
              });
            }}
          />
        }
        footer={
          advisor ? (
            <span className="t-body-s c-muted">{t('post.advisorNoComment')}</span>
          ) : (
            <div
              className="row gap8 flex1"
              style={{
                alignItems: 'flex-end',
              }}
            >
              <div className="flex1">
                <Input
                  multiline
                  rows={1}
                  value={text}
                  onInput={(v) => setText(v.slice(0, 500))}
                  maxLength={500}
                  counter={400}
                  placeholder={t('post.writeComment')}
                  action="SHT-09.input"
                  ariaLabel={t('post.writeComment')}
                />
              </div>
              <IconButton
                icon="send"
                label={t('common.send')}
                brand
                action="SHT-09.send"
                disabled={!text.trim() || busy}
                onClick={send}
                onDisabledClick={() => {}}
              />
            </div>
          )
        }
      >
        <div
          style={{
            minHeight: '200px',
          }}
        >
          {comments.length ? (
            comments.map((c) => {
              const a = sel().user(c.authorId);
              return (
                <div
                  key={c.id}
                  className="row gap10 start"
                  style={{
                    padding: '8px 0',
                    alignItems: 'flex-start',
                  }}
                >
                  <Avatar user={a} size={32} />
                  <div className="flex1 col gap2">
                    <span className="row gap6">
                      <span className="t-label-l c-heading">{userName(a)}</span>
                      <span className="t-caption">{app.fmt.rel(c.createdAt)}</span>
                    </span>
                    <p className="t-body-m break">{c.text}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p
              className="t-body-s c-muted center"
              style={{
                padding: '32px 0',
              }}
            >
              {t('post.noComments')}
            </p>
          )}
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-10 report */
SHEETS['SHT-10'] = {
  title: 'sht.10.title',
  sample: () => ({
    targetType: 'post',
    targetId: 'p17',
  }),
  comp: ({ props, close }) => {
    const [reason, setReason] = useState<any>(null);
    const [note, setNote] = useState('');
    const [err, setErr] = useState('');
    const [busy, run] = useBusy();
    const reasons = ['spam', 'harassment', 'inappropriate', 'misinformation', 'offtopic', 'other'];
    const submit = () =>
      run(async () => {
        if (!reason) {
          setErr(t('auth.err.required'));
          return;
        }
        if (reason === 'other' && !note.trim()) {
          setErr(t('sht.10.otherRequired'));
          return;
        }
        if (!app.requireOnline()) return;
        const u = app.uid();
        const post = props.targetType === 'post' ? sel().post(props.targetId) : props.postId ? sel().post(props.postId) : null;
        const ev = props.targetType === 'event' ? sel().event(props.targetId) : null;
        const clubId = props.clubId || (post && post.clubId) || (ev && ev.clubId) || (props.targetType === 'club' ? props.targetId : null);
        try {
          await A.report({ type: props.targetType, id: props.targetId, clubId }, reason, note.trim());
        } catch (e: any) {
          if (e && e.code === 'alreadyExists') {
            ui.closeAllSheets();
            app.toast('TST-X40', { text: t('web.report.already') });
            return;
          }
          throw e;
        }
        const comment = props.targetType === 'comment' && props.postId ? (db.comments[props.postId] || []).find((c: any) => c.id === props.targetId) : null;
        const authorId =
          props.targetType === 'post'
            ? post && post.authorId
            : props.targetType === 'comment'
              ? comment && comment.authorId
              : props.targetType === 'user'
                ? props.targetId
                : null;
        ui.closeAllSheets();
        app.openDialog('DLG-12', {
          userId: authorId && authorId !== u ? authorId : null,
        });
      });
    return (
      <SheetFrame
        id="SHT-10"
        title={t('sht.10.title')}
        onClose={close}
        dirty={!!reason}
        footer={<Button variant="danger" label={t('sht.10.submit')} loading={busy} action="SHT-10.submit" onClick={submit} />}
      >
        <div className="col gap8 pb16">
          <p className="t-body-s c-sec">{t('sht.10.desc')}</p>
          {reasons.map((r) => (
            <OptionRow
              key={r}
              label={t('reportReason.' + r)}
              checked={reason === r}
              action={'SHT-10.reason.' + r}
              onClick={() => {
                setReason(r);
                setErr('');
              }}
            />
          ))}
          {reason === 'other' ? (
            <Input
              label={t('sht.10.describe')}
              multiline
              rows={3}
              value={note}
              onInput={(v) => {
                setNote(v.slice(0, 200));
                setErr('');
              }}
              maxLength={200}
              counter
              action="SHT-10.note"
              autofocus
            />
          ) : null}
          {err ? (
            <div className="field-help is-error" role="alert">
              <Icon name="triangle-alert" size={14} />
              <span>{err}</span>
            </div>
          ) : null}
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-11 event filter */
SHEETS['SHT-11'] = {
  title: 'sht.11.title',
  sample: () => ({}),
  comp: ({ close }) => {
    const { efOf, applyEventFilters, DEFAULT_EF } = eventFilters;
    const [f, setF] = useState(efOf());
    const u = app.uid();
    const upd = (p: any) =>
      setF({
        ...f,
        ...p,
      });
    const n = applyEventFilters(
      sel()
        .visibleEvents(u)
        .filter((e) => e.endsAt >= Date.now()),
      f,
      u,
    ).length;
    const mine = sel()
      .myClubs(u)
      .map((m) => m.clubId);
    const clubs = sel()
      .visibleClubs()
      .sort((a, b) => (mine.includes(b.id) ? 1 : 0) - (mine.includes(a.id) ? 1 : 0));
    return (
      <SheetFrame
        id="SHT-11"
        title={t('sht.11.title')}
        onClose={close}
        footer={
          <>
            <Button
              variant="outline"
              label={t('common.clear')}
              action="SHT-11.clear"
              onClick={() =>
                setF({
                  ...DEFAULT_EF,
                })
              }
            />
            <Button
              label={t('sht.11.apply', {
                count: n,
              })}
              action="SHT-11.apply"
              onClick={() => {
                app.dispatch('ui.set', {
                  eventFilters: f,
                });
                close();
              }}
            />
          </>
        }
      >
        <div className="col gap20 pb16">
          <div className="col gap8">
            <span className="field-label">{t('sht.11.date')}</span>
            <div className="row wrap gap8">
              {[
                ['all', t('common.all')],
                ['today', t('time.today')],
                ['week', t('events.chip.week')],
                ['month', t('sht.11.month')],
                ['custom', t('sht.11.custom')],
              ].map(([id, l]) => (
                <Chip
                  key={id}
                  label={l}
                  selected={f.date === id}
                  action={'SHT-11.date.' + id}
                  onClick={() => {
                    if (id === 'custom')
                      app.openSheet('SHT-28', {
                        value: f.from || Date.now(),
                        onSelect: (from: number) =>
                          app.openSheet('SHT-28', {
                            value: f.to || from,
                            min: from,
                            title: t('sht.11.to'),
                            onSelect: (to: number) =>
                              upd({
                                date: 'custom',
                                from,
                                to,
                              }),
                          }),
                      });
                    else
                      upd({
                        date: id,
                      });
                  }}
                />
              ))}
            </div>
            {f.date === 'custom' && f.from ? (
              <span className="t-caption">
                {app.fmt.dateShort(f.from)}
                {' \u2192 '}
                {f.to ? app.fmt.dateShort(f.to) : '…'}
              </span>
            ) : null}
          </div>
          <div className="col gap8">
            <span className="field-label">{t('sht.11.club')}</span>
            <div className="row wrap gap8">
              {clubs.map((c) => (
                <Chip
                  key={c.id}
                  icon={mine.includes(c.id) ? 'user-check' : undefined}
                  label={c.name.split(' ').slice(0, 2).join(' ')}
                  selected={f.clubs.includes(c.id)}
                  action={'SHT-11.club.' + c.id}
                  onClick={() =>
                    upd({
                      clubs: f.clubs.includes(c.id) ? f.clubs.filter((x) => x !== c.id) : [...f.clubs, c.id],
                    })
                  }
                />
              ))}
            </div>
          </div>
          <div className="col gap8">
            <span className="field-label">{t('eventForm.type')}</span>
            <div className="row wrap gap8">
              {EVENT_TYPES.map((ty) => (
                <Chip
                  key={ty}
                  label={t('eventType.' + ty)}
                  selected={f.types.includes(ty)}
                  action={'SHT-11.type.' + ty}
                  onClick={() =>
                    upd({
                      types: f.types.includes(ty) ? f.types.filter((x) => x !== ty) : [...f.types, ty],
                    })
                  }
                />
              ))}
            </div>
          </div>
          <div className="col gap8">
            <span className="field-label">{t('eventForm.visibility')}</span>
            <Segmented
              options={[
                {
                  id: 'all',
                  label: t('common.all'),
                },
                {
                  id: 'public',
                  label: t('event.visibility.public'),
                },
                {
                  id: 'members',
                  label: t('event.visibility.members'),
                },
              ]}
              value={f.visibility}
              onChange={(v) =>
                upd({
                  visibility: v,
                })
              }
              action="SHT-11.visibility"
            />
          </div>
          <div className="row between">
            <span className="t-body-m">{t('sht.11.freeOnly')}</span>
            <Switch
              checked={f.freeOnly}
              onChange={(v) =>
                upd({
                  freeOnly: v,
                })
              }
              action="SHT-11.toggle.freeOnly"
              label={t('sht.11.freeOnly')}
            />
          </div>
          <div className="col gap4">
            <span className="field-label">{t('common.sort')}</span>
            {['date', 'popular'].map((s) => (
              <OptionRow
                key={s}
                label={t('sht.11.sort.' + s)}
                checked={f.sort === s}
                action={'SHT-11.sort.' + s}
                onClick={() =>
                  upd({
                    sort: s,
                  })
                }
              />
            ))}
          </div>
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-12 join confirm */
SHEETS['SHT-12'] = {
  title: 'sht.12.title',
  sample: () => ({
    eventId: 'e01',
  }),
  comp: ({ props, close }) => {
    const u = app.uid();
    const ev = sel().event(props.eventId)!;
    const [rem, setRem] = useState<any>(sel().settings().reminderTime || '1h');
    const [busy, run] = useBusy();
    const conflict = sel()
      .userRsvps(u)
      .some((r) => (r.status === 'going' || r.status === 'attended') && r.event.id !== ev.id && !r.event.isDeleted && r.event.status !== 'cancelled' && r.event.startsAt < ev.endsAt && r.event.endsAt > ev.startsAt);
    const confirm = () =>
      run(async () => {
        if (!app.requireOnline()) return;
        const res = await A.joinEvent(ev.id, rem);
        close();
        if (res.status === 'waitlist')
          app.toast('TST-43', {
            n: res.position || 1,
          });
        else
          app.toast('TST-41', {
            action: () =>
              app.nav.push('EVT-03', {
                id: ev.id,
              }),
          });
      });
    return (
      <SheetFrame
        id="SHT-12"
        title={t('sht.12.title')}
        onClose={close}
        footer={<Button size="lg" label={t('sht.12.confirm')} loading={busy} action="SHT-12.confirm" onClick={confirm} />}
      >
        <div className="col gap16 pb16">
          <Card muted class="card-body col gap4">
            <span className="t-title-s">{ev.title}</span>
            <span className="t-body-s c-sec row gap4">
              <Icon name="calendar-days" size={14} />
              {app.fmt.dateTime(ev.startsAt)}
            </span>
            <span className="t-body-s c-sec row gap4">
              <Icon name="map-pin" size={14} />
              {placeName(ev)}
            </span>
          </Card>
          <div className="col gap8">
            <span className="field-label">{t('event.reminder')}</span>
            <div className="row wrap gap8">
              {['none', '15m', '1h', '1d'].map((r) => (
                <Chip key={r} label={t('reminder.' + r)} selected={rem === r} action={'SHT-12.reminder.' + r} onClick={() => setRem(r)} />
              ))}
            </div>
          </div>
          {conflict ? <Banner kind="warning" text={t('sht.12.conflict')} card /> : null}
          {sel().isFull(ev) ? <Banner kind="info" text={t('sht.12.fullNote')} card /> : null}
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-13 reminder */
SHEETS['SHT-13'] = {
  title: 'sht.13.title',
  sample: () => ({
    eventId: 'e01',
  }),
  comp: ({ props, close }) => {
    const u = app.uid();
    const r = sel().myRsvp(props.eventId, u);
    const cur = r ? r.reminder : 'none';
    return (
      <SheetFrame id="SHT-13" title={t('sht.13.title')} onClose={close} flush>
        {['none', '15m', '1h', '1d'].map((v) => (
          <OptionRow
            key={v}
            label={t('reminder.' + v)}
            checked={cur === v}
            action={'SHT-13.select.' + v}
            onClick={() => {
              close();
              if (!r) return;
              A.setReminder(props.eventId, v as any)
                .then(() => {
                  app.toast('TST-37', {
                    off: v === 'none',
                  });
                  if (v !== 'none' && notifPermission() === 'default') app.openDialog('DLG-03');
                })
                .catch(handleError);
            }}
          />
        ))}
      </SheetFrame>
    );
  },
};
/* SHT-14 add to calendar */
const icsDate = (ts: number) =>
  new Date(ts)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
/** RFC 5545 metin kaçışı + 75 sekizlik satır katlama. */
const icsText = (v: string) => String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsFold = (line: string) => {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > 74) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
};
export function icsFor(ev: any) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GU Kulupler//TR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ev.id}@gu-kulupler`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(ev.startsAt)}`,
    `DTEND:${icsDate(ev.endsAt)}`,
    `SUMMARY:${icsText(ev.title)}`,
    `LOCATION:${icsText(placeName(ev))}`,
    `DESCRIPTION:${icsText((ev.desc || '') + '\n' + shareUrl('EVT-02', { id: ev.id }))}`,
    `URL:${shareUrl('EVT-02', { id: ev.id })}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
export const googleCalUrl = (ev: any) =>
  'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
  encodeURIComponent(ev.title) +
  '&dates=' +
  icsDate(ev.startsAt) +
  '/' +
  icsDate(ev.endsAt) +
  '&location=' +
  encodeURIComponent(placeName(ev)) +
  '&details=' +
  encodeURIComponent(shareUrl('EVT-02', { id: ev.id }));
SHEETS['SHT-14'] = {
  title: 'sht.14.title',
  sample: () => ({
    eventId: 'e01',
  }),
  comp: ({ props, close }) => {
    const ev = sel().event(props.eventId)!;
    const go = (fn: () => void) => () => {
      close();
      fn();
    };
    return (
      <SheetFrame id="SHT-14" title={t('sht.14.title')} onClose={close} menu flush>
        <Row
          icon="smartphone"
          label={t('sht.14.device')}
          sub=".ics"
          action="SHT-14.device"
          onClick={go(() => {
            downloadText(icsFor(ev), slug(ev.title) + '.ics', 'text/calendar;charset=utf-8');
            app.toast('TST-36');
          })}
        />
        <Row
          icon="globe"
          label={t('sht.14.google')}
          action="SHT-14.google"
          onClick={go(() =>
            app.openDialog('DLG-32', {
              url: googleCalUrl(ev),
            }),
          )}
        />
        <Row
          icon="link"
          label={t('sht.08.copyLink')}
          action="SHT-14.copyLink"
          onClick={go(() => {
            copyText(shareUrl('EVT-02', { id: ev.id }));
            app.toast('TST-35');
          })}
        />
      </SheetFrame>
    );
  },
};
/* SHT-15 share */
SHEETS['SHT-15'] = {
  title: 'sht.15.title',
  sample: () => ({
    type: 'club',
    id: 'c01',
  }),
  comp: ({ props, close }) => {
    const item: any = props.type === 'club' ? sel().club(props.id) : props.type === 'event' ? sel().event(props.id) : sel().post(props.id);
    const title = item ? item.name || item.title || item.text : '';
    const url =
      props.type === 'club'
        ? shareUrl('CLB-03', { id: props.id })
        : props.type === 'event'
          ? shareUrl('EVT-02', { id: props.id })
          : shareUrl('FED-02', { clubId: item ? item.clubId : '', postId: props.id });
    const canNative = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';
    const go = (fn: () => void) => () => {
      close();
      fn();
    };
    return (
      <SheetFrame id="SHT-15" title={t('sht.15.title')} onClose={close} menu flush>
        <div className="px16 pb16">
          <Card muted class="card-body col gap4">
            <span className="t-label-l c-heading clamp2">{title}</span>
            <span className="t-caption ellipsis">{url.replace(/^https?:\/\//, '')}</span>
          </Card>
        </div>
        <Row
          icon="link"
          label={t('sht.08.copyLink')}
          action="SHT-15.copyLink"
          onClick={go(() => {
            copyText(url);
            app.toast('TST-35');
          })}
        />
        <Row
          icon="message-circle"
          label="WhatsApp"
          action="SHT-15.whatsapp"
          onClick={go(() =>
            app.openDialog('DLG-32', {
              url: 'https://wa.me/?text=' + encodeURIComponent(url),
            }),
          )}
        />
        <Row
          icon="mail"
          label={t('auth.email')}
          action="SHT-15.email"
          onClick={go(() =>
            app.openDialog('DLG-32', {
              url: 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(url),
            }),
          )}
        />
        {canNative ? (
          <Row
            icon="more-horizontal"
            label={t('sht.15.other')}
            action="SHT-15.other"
            onClick={go(() => {
              (navigator as any).share({ title, url }).catch(() => {});
            })}
          />
        ) : null}
      </SheetFrame>
    );
  },
};
/* SHT-16 fotoğraf kaynağı — web: gerçek dosya seçici (kamera = capture girişi; masaüstünde dosya seçer). */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** Gizli <input type=file> ile seçim yaptırır; kullanıcı vazgeçerse hiçbir şey çağrılmaz. */
export function pickFiles(opts: { multi?: boolean; camera?: boolean; max?: number }, onFiles: (files: File[]) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  if (opts.multi) input.multiple = true;
  if (opts.camera) input.setAttribute('capture', 'environment');
  input.style.display = 'none';
  document.body.appendChild(input);
  const done = () => setTimeout(() => input.remove(), 0);
  input.addEventListener('change', () => {
    const all = Array.from(input.files || []);
    done();
    if (!all.length) return;
    const ok = all.filter((f) => (!f.type || IMAGE_TYPES.includes(f.type) || f.type.startsWith('image/')) && f.size <= MAX_IMAGE_BYTES);
    if (ok.length < all.length) app.toast('TST-X40', { text: t('web.image.invalid') });
    const max = opts.max || (opts.multi ? 4 : 1);
    if (ok.length > max) app.toast('TST-X5');
    if (ok.length) onFiles(ok.slice(0, max));
  });
  input.addEventListener('cancel', done);
  input.click();
}
SHEETS['SHT-16'] = {
  title: 'sht.16.title',
  comp: ({ props, close }: any) => {
    const pick = (camera: boolean) => () => {
      pickFiles({ multi: !!props.multi && !camera, camera, max: props.max }, (files) => {
        props.onPick && props.onPick(props.multi ? files : files[0]);
      });
      close();
    };
    return (
      <SheetFrame id="SHT-16" title={t('sht.16.title')} onClose={close} menu flush>
        <Row icon="camera" label={t('sht.16.camera')} action="SHT-16.camera" onClick={pick(true)} />
        <Row icon="images" label={t('sht.16.gallery')} action="SHT-16.gallery" onClick={pick(false)} />
        {props.hasPhoto ? (
          <Row
            icon="trash-2"
            label={t('sht.16.remove')}
            danger
            action="SHT-16.remove"
            onClick={() => {
              close();
              props.onRemove && props.onRemove();
            }}
          />
        ) : null}
      </SheetFrame>
    );
  },
};
/* SHT-17 theme */
SHEETS['SHT-17'] = {
  title: 'sht.17.title',
  sample: () => ({}),
  comp: ({ close }) => {
    const cur = prefs.get().theme || 'system';
    const Mini = ({ dark }: any) => (
      <span
        style={{
          display: 'block',
          width: '100%',
          height: '48px',
          borderRadius: '8px',
          background: dark ? '#17191C' : '#FAF9F6',
          border: '1px solid var(--border-default)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: '8px',
            top: '8px',
            width: '40%',
            height: '8px',
            borderRadius: '4px',
            background: '#D00A2D',
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: '8px',
            top: '22px',
            right: '8px',
            height: '16px',
            borderRadius: '4px',
            background: dark ? '#1E2024' : '#fff',
            border: '1px solid ' + (dark ? '#39414B' : '#E2E8F0'),
          }}
        />
      </span>
    );
    return (
      <SheetFrame id="SHT-17" title={t('sht.17.title')} onClose={close}>
        <div className="grid3 pb16">
          {['system', 'light', 'dark'].map((th) => (
            <button
              type="button"
              key={th}
              className={cx('option-card col gap8', cur === th && 'is-selected')}
              style={{
                alignItems: 'stretch',
              }}
              aria-pressed={cur === th ? 'true' : 'false'}
              data-action={'SHT-17.select.' + th}
              onClick={() => {
                setPrefs({ theme: th as any });
                close();
              }}
            >
              {th === 'system' ? (
                <span className="row gap4">
                  <span className="flex1">
                    <Mini dark={false} />
                  </span>
                  <span className="flex1">
                    <Mini dark />
                  </span>
                </span>
              ) : (
                <Mini dark={th === 'dark'} />
              )}
              <span className="t-label-m c-heading center">{t('theme.' + th)}</span>
            </button>
          ))}
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-18 managed club selector */
SHEETS['SHT-18'] = {
  title: 'sht.18.title',
  sample: () => ({}),
  comp: ({ props, close }) => {
    const list = sel().managedClubs(app.uid());
    return (
      <SheetFrame id="SHT-18" title={t('sht.18.title')} onClose={close} menu flush>
        {list.map((m) => (
          <Tile
            key={m.clubId}
            leading={<ClubEmblem club={m.club} cls="is-sm" size={20} />}
            title={m.club.name}
            subtitle={
              <span className="row gap6">
                <RoleBadge role={m.role} />
                {m.readOnly ? <Badge kind="neutral" icon="eye" label={t('common.readOnly')} /> : null}
              </span>
            }
            chevron
            action={'SHT-18.select.' + m.clubId}
            onClick={() => {
              if (props.onSelect) {
                props.onSelect(m.clubId);
                return;
              }
              close();
              app.nav.push('MGT-01', {
                clubId: m.clubId,
              });
            }}
          />
        ))}
        {!list.length ? <p className="t-body-s c-muted p16 center">{t('sht.18.empty')}</p> : null}
      </SheetFrame>
    );
  },
};
/** Karar çakışması (başka bir yönetici önce karar verdi): güncel durumu getir, DLG-18 ile bildir. */
export async function onDecisionConflict(clubId: string, userId: string) {
  const fresh = await M.getMembership(clubId, userId).catch(() => null);
  if (fresh) db.putMemberships([fresh]);
  app.openDialog('DLG-18', {
    result: fresh && fresh.status === 'active' ? t('status.approved') : fresh && fresh.status === 'pending' ? t('status.pending') : t('status.rejected'),
  });
}
/** Onay/ret: çakışmada DLG-18, diğer hatalarda genel işleyici. */
export async function decide(clubId: string, userId: string, fn: () => Promise<void>) {
  try {
    await fn();
    return true;
  } catch (e) {
    if (errCode(e) === 'conflict') await onDecisionConflict(clubId, userId);
    else handleError(e);
    return false;
  }
}
export const applicantUser = (m: any) =>
  sel().user(m.userId) || { id: m.userId, name: m.applicant ? m.applicant.name : t('common.deletedUser'), department: m.applicant?.department, year: m.applicant?.year, avatarSeed: m.applicant?.avatarSeed || m.userId };
SHEETS['SHT-19'] = {
  title: 'sht.19.title',
  comp: ({ props, close }: any) => {
    const u = app.uid();
    const m = sel().membership(props.clubId, props.userId);
    const club = sel().club(props.clubId);
    const readOnly = sel().isAdvisor(props.clubId, u);
    const [busy, run] = useBusy();
    useEffect(() => {
      // bildirimden açıldıysa başvuru belgesi henüz yüklenmemiş olabilir
      if (!m) M.getMembership(props.clubId, props.userId).then((x) => x && db.putMemberships([x])).catch(() => {});
      // eslint-disable-next-line
    }, []);
    if (!m || !club)
      return (
        <SheetFrame id="SHT-19" title={t('sht.19.title')} onClose={close}>
          <p className="t-body-s c-muted p16">{t('sht.19.gone')}</p>
        </SheetFrame>
      );
    const usr: any = applicantUser(m);
    const common = Object.values(db.memberships)
      .filter((x) => x.userId === usr.id && x.status === 'active' && x.clubId !== club.id && session.s.memberships[x.clubId]?.status === 'active')
      .map((x) => sel().club(x.clubId))
      .filter(Boolean) as any[];
    const decided = m.status !== 'pending';
    const canUndo = decided && m.decidedBy === u && !!m.decidedAt && Date.now() - m.decidedAt < LIMITS.managerUndoWindowMs && !readOnly;
    const approve = () =>
      run(async () => {
        if (!app.guard(club.id)) return;
        const ok = await decide(club.id, usr.id, () => A.approve(club.id, usr.id));
        close();
        if (ok)
          app.toast('TST-27', {
            name: usr.name,
            undo: () => A.undoDecision(club.id, usr.id).catch(handleError),
          });
      });
    return (
      <SheetFrame
        id="SHT-19"
        title={t('sht.19.title')}
        onClose={close}
        footer={
          decided ? (
            canUndo ? (
              <Button
                variant="outline"
                label={t('common.undo')}
                loading={busy}
                action="SHT-19.undo"
                onClick={() =>
                  run(async () => {
                    if (!app.guard(club.id)) return;
                    await A.undoDecision(club.id, usr.id);
                    close();
                    app.toast('TST-X17');
                  })
                }
              />
            ) : null
          ) : (
            <>
              <Button
                variant="outline"
                label={t('applications.reject')}
                disabled={readOnly}
                action="SHT-19.reject"
                onClick={() => {
                  if (!app.guard(club.id)) return;
                  app.openSheet('SHT-20', {
                    clubId: club.id,
                    userId: usr.id,
                  });
                }}
                onDisabledClick={() => app.toast('TST-26')}
              />
              <Button
                label={t('applications.approve')}
                disabled={readOnly}
                loading={busy}
                action="SHT-19.approve"
                onClick={approve}
                onDisabledClick={() => app.toast('TST-26')}
              />
            </>
          )
        }
      >
        <div className="col gap16 pb16">
          <div className="row gap12">
            <Avatar user={usr} size={56} />
            <div className="flex1 col gap2">
              <span className="t-title-s">{usr.name}</span>
              <span className="t-body-s c-sec">{deptYear(usr)}</span>
              <span className="t-caption">
                {t('applied.sentAt', {
                  date: app.fmt.dateTime(m.appliedAt),
                })}
              </span>
            </div>
          </div>
          {decided ? (
            <Banner
              kind={m.status === 'active' ? 'success' : 'danger'}
              text={m.status === 'active' ? t('status.approved') : t('status.rejected') + (m.rejectReason ? ' · ' + t('rejectReason.' + m.rejectReason) : '')}
              card
            />
          ) : null}
          <Card muted class="card-body col gap4">
            <span className="t-overline">{t('sht.19.note')}</span>
            <p className="t-body-m prewrap">{m.note || t('applications.noNote')}</p>
          </Card>
          <div className="col gap6">
            <span className="row between">
              <span className="t-body-s c-muted">{t('sht.19.prior')}</span>
              <span className="t-body-s c-heading">{m.priorCount ? t('common.yes') : t('common.no')}</span>
            </span>
            {common.length ? (
              <span className="row between start">
                <span className="t-body-s c-muted">{t('userprofile.commonClubs')}</span>
                <span
                  className="row wrap gap4 end"
                  style={{
                    maxWidth: '60%',
                  }}
                >
                  {common.map((c) => (
                    <Badge key={c.id} kind="neutral" label={c.name.split(' ')[0]} />
                  ))}
                </span>
              </span>
            ) : null}
          </div>
          <Button
            variant="text"
            icon="user"
            label={t('userprofile.view')}
            action="SHT-19.profile"
            onClick={() => {
              close();
              app.nav.push('CLB-07', {
                id: usr.id,
                clubId: club.id,
              });
            }}
          />
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-20 reject reason */
SHEETS['SHT-20'] = {
  title: 'sht.20.title',
  sample: () => ({
    clubId: 'c03',
    userId: 'u_cem',
  }),
  comp: ({ props, close }) => {
    const u = app.uid();
    const m = sel().membership(props.clubId, props.userId);
    const usr: any = m ? applicantUser(m) : sel().user(props.userId) || { name: '' };
    const [reason, setReason] = useState('quota');
    const [note, setNote] = useState('');
    const [busy, run] = useBusy();
    void u;
    const reject = () =>
      run(async () => {
        if (!app.guard(props.clubId)) return;
        const ok = await decide(props.clubId, props.userId, () => A.reject(props.clubId, props.userId, reason, note.trim()));
        ui.closeAllSheets();
        if (ok) {
          props.onDone && props.onDone();
          app.toast('TST-28', {
            name: usr.name,
            undo: () => A.undoDecision(props.clubId, props.userId).catch(handleError),
          });
        }
      });
    return (
      <SheetFrame
        id="SHT-20"
        title={t('sht.20.title')}
        onClose={close}
        footer={<Button variant="danger" label={t('applications.reject')} loading={busy} action="SHT-20.submit" onClick={reject} />}
      >
        <div className="col gap12 pb16">
          <p className="t-body-s c-sec">{usr.name}</p>
          <div className="row wrap gap8">
            {['quota', 'criteria', 'missing', 'other'].map((r) => (
              <Chip key={r} label={t('rejectReason.' + r)} selected={reason === r} action={'SHT-20.reason.' + r} onClick={() => setReason(r)} />
            ))}
          </div>
          <Input
            label={t('sht.20.note')}
            multiline
            rows={3}
            value={note}
            onInput={(v) => setNote(v.slice(0, 200))}
            maxLength={200}
            counter
            help={t('sht.20.visible')}
            action="SHT-20.note"
          />
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-21 member actions */
SHEETS['SHT-21'] = {
  title: 'sht.21.title',
  sample: () => ({
    clubId: 'c03',
    userId: 'u001',
  }),
  comp: ({ props, close }) => {
    const u = app.uid();
    const m = sel().membership(props.clubId, props.userId);
    const usr = sel().user(props.userId);
    const myRole = sel().roleIn(props.clubId, u);
    const isPres = myRole === 'president' || sel().isSuper(u);
    const canAct = isPres || (myRole === 'board' && m && m.role === 'member');
    void m;
    const go = (fn: () => void) => () => {
      close();
      fn();
    };
    return (
      <SheetFrame id="SHT-21" title={usr ? usr.name : t('sht.21.title')} onClose={close} menu flush>
        <Row
          icon="user"
          label={t('userprofile.view')}
          action="SHT-21.profile"
          onClick={go(() =>
            app.nav.push('CLB-07', {
              id: props.userId,
              clubId: props.clubId,
            }),
          )}
        />
        <Row
          icon="user-cog"
          label={t('userprofile.changeRole')}
          disabled={!isPres}
          sub={!isPres ? t('sht.21.presidentOnly') : null}
          action="SHT-21.changeRole"
          onClick={() =>
            isPres
              ? (close(),
                app.openSheet('SHT-22', {
                  clubId: props.clubId,
                  userId: props.userId,
                }))
              : app.toast('TST-X18')
          }
        />
        <Row
          icon="user-x"
          label={t('userprofile.remove')}
          danger
          disabled={!canAct}
          sub={!canAct ? t('sht.21.hierarchy') : null}
          action="SHT-21.remove"
          onClick={() =>
            canAct
              ? (close(),
                app.openDialog('DLG-19', {
                  clubId: props.clubId,
                  userId: props.userId,
                }))
              : app.toast('TST-X18')
          }
        />
      </SheetFrame>
    );
  },
};
/* SHT-22 role picker */
SHEETS['SHT-22'] = {
  title: 'sht.22.title',
  sample: () => ({
    clubId: 'c03',
    userId: 'u001',
  }),
  comp: ({ props, close }) => {
    const m = sel().membership(props.clubId, props.userId);
    const [role, setRole] = useState<string>(m ? m.role : 'member');
    return (
      <SheetFrame
        id="SHT-22"
        title={t('sht.22.title')}
        onClose={close}
        footer={
          <Button
            label={t('common.save')}
            disabled={!m || role === m.role}
            action="SHT-22.save"
            onClick={() => {
              close();
              app.openDialog('DLG-20', {
                clubId: props.clubId,
                userId: props.userId,
                role,
              });
            }}
            onDisabledClick={() => app.toast('TST-X9')}
          />
        }
      >
        <div className="col gap8 pb16">
          {['member', 'board'].map((r) => (
            <button
              type="button"
              key={r}
              className={cx('option-card', role === r && 'is-selected')}
              role="radio"
              aria-checked={role === r ? 'true' : 'false'}
              data-action={'SHT-22.role.' + r}
              onClick={() => setRole(r)}
            >
              <span className="radio" aria-checked={role === r ? 'true' : 'false'} aria-hidden="true">
                <i />
              </span>
              <span className="flex1 col gap4">
                <RoleBadge role={r} />
                <span className="t-body-s c-sec">{t('sht.22.' + r)}</span>
              </span>
            </button>
          ))}
          <p className="t-caption">{t('sht.22.transferNote')}</p>
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-23 event menu (manage) */
SHEETS['SHT-23'] = {
  title: 'sht.23.title',
  sample: () => ({
    eventId: 'e03',
  }),
  comp: ({ props, close }) => {
    const u = app.uid();
    const ev = sel().event(props.eventId);
    if (!ev) return null;
    void u;
    const go = (fn: () => void) => () => {
      close();
      if (app.guard(ev.clubId)) fn();
    };
    const goFree = (fn: () => void) => () => {
      close();
      fn();
    };
    return (
      <SheetFrame id="SHT-23" title={ev.title} onClose={close} menu flush>
        <Row
          icon="pencil"
          label={t('common.edit')}
          action="SHT-23.edit"
          onClick={go(() =>
            app.nav.push('MGT-05', {
              clubId: ev.clubId,
              eventId: ev.id,
            }),
          )}
        />
        <Row
          icon="copy"
          label={t('sht.23.duplicate')}
          action="SHT-23.duplicate"
          onClick={go(() => {
            A.duplicateEvent(ev, t('web.event.copySuffix'))
              .then(() => app.toast('TST-13'))
              .catch(handleError);
          })}
        />
        <Row
          icon="users"
          label={t('event.cta.attendees')}
          action="SHT-23.attendees"
          onClick={goFree(() =>
            app.nav.push('MGT-06', {
              clubId: ev.clubId,
              eventId: ev.id,
            }),
          )}
        />
        <Row
          icon="scan-line"
          label={t('event.cta.scan')}
          action="SHT-23.scan"
          onClick={go(() =>
            app.nav.push('MGT-07', {
              clubId: ev.clubId,
              eventId: ev.id,
            }),
          )}
        />
        <Row
          icon="share-2"
          label={t('common.share')}
          action="SHT-23.share"
          onClick={goFree(() =>
            app.openSheet('SHT-15', {
              type: 'event',
              id: ev.id,
            }),
          )}
        />
        {ev.status === 'published' ? (
          <>
            <Row
              icon="file-text"
              label={t('sht.23.unpublish')}
              action="SHT-23.unpublish"
              onClick={go(() => {
                A.unpublishEvent(ev)
                  .then(() => app.toast('TST-X19'))
                  .catch(handleError);
              })}
            />
            <Row
              icon="calendar-x"
              label={t('sht.23.cancel')}
              danger
              action="SHT-23.cancel"
              onClick={go(() =>
                app.openDialog('DLG-23', {
                  eventId: ev.id,
                }),
              )}
            />
          </>
        ) : null}
        {ev.status === 'draft' ? (
          <Row
            icon="trash-2"
            label={t('common.delete')}
            danger
            action="SHT-23.delete"
            onClick={go(() =>
              app.openDialog('DLG-31', {
                eventId: ev.id,
              }),
            )}
          />
        ) : null}
      </SheetFrame>
    );
  },
};
/* SHT-24 scan result */
SHEETS['SHT-24'] = {
  title: 'sht.24.title',
  sample: () => ({
    kind: 'valid',
    userId: 'u_mehmet',
    eventId: 'e01',
  }),
  comp: ({ props, close }) => {
    const usr = props.userId ? sel().user(props.userId) : null;
    const ev = props.eventId ? sel().event(props.eventId) : null;
    useEffect(() => {
      if (props.kind === 'valid') {
        const id = setTimeout(close, 2000);
        return () => clearTimeout(id);
      }
    }, []);
    const color = ({
      valid: 'success',
      used: 'warning',
      invalid: 'danger',
    } as any)[props.kind];
    const icon = ({
      valid: 'circle-check',
      used: 'check-check',
      invalid: 'circle-x',
    } as any)[props.kind];
    return (
      <SheetFrame
        id="SHT-24"
        title={t('sht.24.' + props.kind)}
        onClose={close}
        footer={
          <>
            {props.kind === 'valid' && props.undo ? (
              <Button
                variant="outline"
                label={t('common.undo')}
                action="SHT-24.undo"
                onClick={() => {
                  props.undo();
                  close();
                }}
              />
            ) : null}
            <Button label={t('sht.24.next')} action="SHT-24.next" onClick={close} />
          </>
        }
      >
        <div
          className="col gap12 pb16"
          style={{
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <span
            className={cx('notif-icon', 'ni-' + color)}
            style={{
              width: '72px',
              height: '72px',
            }}
          >
            <Icon name={icon} size={36} />
          </span>
          {usr ? (
            <>
              <Avatar user={usr} size={48} />
              <span className="t-title-s">{usr.name}</span>
            </>
          ) : null}
          <p className="t-body-s c-sec">
            {props.kind === 'valid'
              ? t('sht.24.validDesc')
              : props.kind === 'used'
                ? t('sht.24.usedDesc', {
                    time: app.fmt.time(props.scannedAt || Date.now()),
                  })
                : props.reason === 'none'
                  ? t('sht.24.invalidNone')
                  : t('sht.24.invalidDesc')}
          </p>
          {ev && props.kind === 'valid' ? (
            <span className="t-caption tnum">
              {t('scan.counter', {
                a: ev.attendedCount || 0,
                b: sel().registeredCount(ev),
              })}
            </span>
          ) : null}
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-25 kullanıcı arama — devir: kulübün aktif üyeleri; atama: ad öneki / e-posta ile Firestore araması. */
SHEETS['SHT-25'] = {
  title: 'sht.25.assign',
  comp: ({ props, close }: any) => {
    const [q, setQ] = useState('');
    const [found, setFound] = useState<any[]>([]);
    const [busy, setBusy] = useState(false);
    const transfer = props.mode === 'transfer';
    const membersLoad = useLoader(transfer && props.clubId ? LD.allMembersLoader(props.clubId) : null);
    useEffect(() => {
      if (transfer) return;
      const term = trLower(q.trim());
      let alive = true;
      const id = setTimeout(async () => {
        setBusy(true);
        try {
          const list = term.includes('@') ? await U.findUserByEmail(term) : (await U.listUsersByName(term)).items;
          if (alive) setFound(list.filter((u: any) => u.status === 'active' && !u.staff));
        } catch (e) {
          if (alive) handleError(e);
        } finally {
          if (alive) setBusy(false);
        }
      }, 300);
      return () => {
        alive = false;
        clearTimeout(id);
      };
      // eslint-disable-next-line
    }, [q, transfer]);
    const pool: any[] = transfer
      ? sel()
          .clubMembers(props.clubId)
          .filter((m) => m.role !== 'president' && m.role !== 'advisor' && m.user)
          .map((m) => m.user)
          .filter((u) => !q || trLower(u!.name).includes(trLower(q)))
          .sort((a, b) => a!.name.localeCompare(b!.name, 'tr'))
      : found;
    const loading = transfer ? membersLoad.status === 'loading' && !pool.length : busy && !pool.length;
    return (
      <SheetFrame id="SHT-25" title={transfer ? t('sht.25.transfer') : t('sht.25.assign')} onClose={close} full flush>
        <div className="px16 pb8">
          <Input
            icon="search"
            placeholder={t('adminUsers.search')}
            value={q}
            onInput={setQ}
            action="SHT-25.search"
            ariaLabel={t('common.search')}
            autofocus
          />
        </div>
        {loading ? <SkeletonList n={4} /> : null}
        {pool.slice(0, 40).map((u) => (
          <UserRow key={u.id} user={u} sub={deptYear(u)} action={'SHT-25.select.' + u.id} onClick={() => props.onSelect && props.onSelect(u.id, u)} chevron />
        ))}
        {!loading && !pool.length ? <p className="t-body-s c-muted center p16">{t('members.noResults')}</p> : null}
      </SheetFrame>
    );
  },
};
/* SHT-26 şikâyet ayrıntısı — aynı hedefe gelen şikâyetler tek grup (ADM-04). Bildirimden açılırsa reportId ile yüklenir. */
async function loadReportTarget(g: RP.ReportGroup): Promise<any> {
  const id = g.targetId;
  try {
    switch (g.targetType) {
      case 'post':
        return await P.getPost(id, { uid: app.uid()!, isManager: false, isSuper: true });
      case 'comment':
        return await CM.getComment(id, true);
      case 'user':
        return await U.getUser(id);
      case 'club':
        return await getClub(id);
      default:
        return await E.getEvent(id, true);
    }
  } catch {
    return null;
  }
}
SHEETS['SHT-26'] = {
  title: 'sht.26.title',
  comp: ({ props, close }: any) => {
    const [group, setGroup] = useState<RP.ReportGroup | null>(props.group || null);
    const [target, setTarget] = useState<any>(undefined);
    const [busy, run] = useBusy();
    useEffect(() => {
      let alive = true;
      (async () => {
        let g: RP.ReportGroup | null = props.group || null;
        if (!g && props.reportId) {
          const r = await RP.getReport(props.reportId).catch(() => null);
          if (r) {
            const open = await RP.listReportsForTarget(r.targetType, r.targetId).catch(() => [] as any[]);
            g = RP.groupReports([r, ...open.filter((x: any) => x.id !== r.id)])[0];
          }
        }
        if (!alive) return;
        setGroup(g);
        if (!g) {
          setTarget(null);
          return;
        }
        const tg = await loadReportTarget(g);
        if (!alive) return;
        setTarget(tg);
        if (g.targetType === 'post') db.putPosts(tg ? [tg] : []);
        if (g.targetType === 'club' && tg) db.putClubs([tg]);
        await U.loadUsers([...g.reports.map((x) => x.reporterId), tg && tg.authorId, g.targetType === 'user' ? g.targetId : null]);
      })().catch(handleError);
      return () => {
        alive = false;
      };
      // eslint-disable-next-line
    }, []);
    if (!group)
      return (
        <SheetFrame id="SHT-26" title={t('sht.26.title')} onClose={close} full>
          {target === null ? <p className="t-body-s c-muted p16">{t('saved.removed')}</p> : <SkeletonList n={3} />}
        </SheetFrame>
      );
    const r: any = {
      ...group.reports[0],
      status: group.reports.some((x) => x.status === 'open') ? 'open' : 'resolved',
      reasons: group.reports.slice().sort((a, b) => b.createdAt - a.createdAt),
    };
    const authorId = r.targetType === 'post' || r.targetType === 'comment' ? (target || ({} as any)).authorId : r.targetType === 'user' ? r.targetId : null;
    const onDone = () => props.onDone && props.onDone();
    const preview = () => {
      if (target === undefined) return <SkeletonList n={1} />;
      if (!target) return <p className="t-body-s c-muted">{t('saved.removed')}</p>;
      if (r.targetType === 'post') return <PostCard post={target} screen="SHT-26" hideActions showClub />;
      if (r.targetType === 'comment') {
        const a = sel().user(target.authorId);
        return (
          <Card
            muted
            class="card-body row gap10 start"
            style={{
              alignItems: 'flex-start',
            }}
          >
            <Avatar user={a} size={32} />
            <div className="col gap2 flex1">
              <span className="t-label-l c-heading">{userName(a)}</span>
              <p className="t-body-m">{target.text}</p>
            </div>
          </Card>
        );
      }
      if (r.targetType === 'user')
        return (
          <Card muted>
            <UserRow user={target} sub={deptYear(target)} inCard />
          </Card>
        );
      return (
        <Card muted class="card-body row gap12">
          {r.targetType === 'club' ? (
            <ClubEmblem club={target} cls="is-sm" size={20} />
          ) : (
            <span className="emblem is-sm">
              <Icon name="calendar" size={20} />
            </span>
          )}
          <span className="t-title-s">{target.name || target.title}</span>
        </Card>
      );
    };
    const closeReport = () =>
      run(async () => {
        if (!app.requireOnline()) return;
        await A.resolveReports(group, 'dismissed');
        onDone();
        close();
        app.toast('TST-56');
      });
    return (
      <SheetFrame
        id="SHT-26"
        title={t('sht.26.title')}
        onClose={close}
        full
        footer={
          r.status === 'open' ? (
            <>
              <Button variant="outline" label={t('sht.26.close')} loading={busy} action="SHT-26.closeReport" onClick={closeReport} />
              {authorId ? (
                  <Button
                    variant="danger-outline"
                    label={t('sht.26.suspendUser')}
                    action="SHT-26.suspendUser"
                    onClick={() =>
                      app.openDialog('DLG-30', {
                        userId: authorId,
                        group,
                        onDone,
                      })
                    }
                  />
                ) : null}
              {r.targetType === 'post' || r.targetType === 'comment' ? (
                  <Button
                    variant="danger"
                    label={t('sht.26.remove')}
                    action="SHT-26.removeContent"
                    onClick={() =>
                      app.openDialog('DLG-29', {
                        group,
                        onDone,
                      })
                    }
                  />
                ) : r.targetType === 'club' ? (
                  <Button
                    variant="danger"
                    label={t('adminClubs.suspend')}
                    action="SHT-26.suspendClub"
                    onClick={() =>
                      app.openDialog('DLG-28', {
                        clubId: r.targetId,
                        group,
                        onDone,
                      })
                    }
                  />
                ) : null}
            </>
          ) : null
        }
      >
        <div className="col gap16 pb16">
          <div className="row gap6 wrap">
            <Badge kind="neutral" label={t('reports.target.' + r.targetType)} />
            <StatusBadge status={r.status} />
            {r.action ? <Badge kind="info" label={t('reportAction.' + r.action)} /> : null}
          </div>
          {preview()}
          <div className="col gap8">
            <h3 className="t-title-s">
              {t('content.reports', {
                count: r.reasons.length,
              })}
            </h3>
            {r.reasons.map((x: any, i: number) => {
              const rep = sel().user(x.reporterId);
              return (
                <div
                  key={i}
                  className="row gap10 start"
                  style={{
                    alignItems: 'flex-start',
                  }}
                >
                  <Avatar user={rep} size={32} />
                  <div className="flex1 col gap2">
                    <span className="row gap6 wrap">
                      <span className="t-label-l c-heading">{userName(rep)}</span>
                      <Badge kind="danger" label={t('reportReason.' + x.reason)} />
                      <span className="t-caption">{app.fmt.rel(x.createdAt)}</span>
                    </span>
                    {x.note ? <p className="t-body-s c-sec">{x.note}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
          {r.status === 'resolved' ? (
            <Banner
              kind="success"
              text={t('sht.26.resolvedAt', {
                date: app.fmt.dateTime(r.resolvedAt || Date.now()),
                action: t('reportAction.' + r.action),
              })}
              card
            />
          ) : null}
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-27 user menu */
SHEETS['SHT-27'] = {
  title: 'sht.27.title',
  sample: () => ({
    userId: 'u001',
  }),
  comp: ({ props, close }) => {
    const usr = sel().user(props.userId);
    const u = app.uid();
    const blocked = session.s.blocked.includes(props.userId);
    const go = (fn: () => void) => () => {
      close();
      fn();
    };
    const c = props.commentId && props.postId ? (db.comments[props.postId] || []).find((x: any) => x.id === props.commentId) || null : null;
    return (
      <SheetFrame id="SHT-27" title={usr ? usr.name : t('sht.27.title')} onClose={close} menu flush>
        <Row
          icon="user"
          label={t('userprofile.view')}
          action="SHT-27.profile"
          onClick={go(() =>
            app.nav.push('CLB-07', {
              id: props.userId,
            }),
          )}
        />
        {props.canDelete && c ? (
          <Row
            icon="trash-2"
            label={t('sht.27.deleteComment')}
            danger
            action="SHT-27.deleteComment"
            onClick={go(() =>
              app.openDialog('DLG-11', {
                commentId: c.id,
                postId: c.postId,
              }),
            )}
          />
        ) : null}
        {c ? (
          <Row
            icon="flag"
            label={t('sht.27.reportComment')}
            action="SHT-27.reportComment"
            onClick={go(() =>
              app.openSheet('SHT-10', {
                targetType: 'comment',
                targetId: c.id,
                postId: c.postId,
                clubId: c.clubId,
              }),
            )}
          />
        ) : null}
        {props.userId !== u ? (
          <>
            <Row
              icon="ban"
              label={blocked ? t('userprofile.unblock') : t('sht.27.block')}
              danger={!blocked}
              action="SHT-27.block"
              onClick={go(() => {
                if (blocked) {
                  A.unblockUser(props.userId)
                    .then(() =>
                      app.toast('TST-09', {
                        name: usr ? usr.name : '',
                        unblocked: true,
                        undo: () => A.blockUser(props.userId).catch(handleError),
                      }),
                    )
                    .catch(handleError);
                } else
                  app.openDialog('DLG-13', {
                    userId: props.userId,
                  });
              })}
            />
            <Row
              icon="flag"
              label={t('sht.27.reportUser')}
              action="SHT-27.report"
              onClick={go(() =>
                app.openSheet('SHT-10', {
                  targetType: 'user',
                  targetId: props.userId,
                }),
              )}
            />
          </>
        ) : null}
      </SheetFrame>
    );
  },
};
/* SHT-28 date picker */
SHEETS['SHT-28'] = {
  title: 'sht.28.title',
  sample: () => ({
    value: Date.now(),
    onSelect: () => {},
  }),
  comp: ({ props, close }) => {
    const [sel_, setSel] = useState(props.value || Date.now());
    const [month, setMonth] = useState(() => {
      const d = new Date(props.value || Date.now());
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    });
    const shift = (n) => {
      const d = new Date(month);
      d.setMonth(d.getMonth() + n);
      setMonth(d.getTime());
    };
    return (
      <SheetFrame
        id="SHT-28"
        title={props.title || t('sht.28.title')}
        onClose={close}
        footer={
          <>
            <Button variant="outline" label={t('common.cancel')} action="SHT-28.cancel" onClick={close} />
            <Button
              label={t('common.ok')}
              action="SHT-28.ok"
              onClick={() => {
                close();
                props.onSelect && props.onSelect(sel_);
              }}
            />
          </>
        }
      >
        <div className="pb16">
          <Calendar
            month={month}
            selected={sel_}
            onSelect={setSel}
            action="SHT-28"
            min={props.min}
            max={props.max}
            onPrev={() => shift(-1)}
            onNext={() => shift(1)}
            onToday={() => {
              setSel(today0());
              const d = new Date();
              d.setDate(1);
              d.setHours(0, 0, 0, 0);
              setMonth(d.getTime());
            }}
            compact
          />
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-29 time picker */
function Wheel({ values, value, onChange, action, label }: any) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const i = values.indexOf(value);
    if (ref.current && i >= 0) ref.current.scrollTop = i * 40;
  }, []);
  const onScroll = (e) => {
    const i = Math.round(e.target.scrollTop / 40);
    if (values[i] != null && values[i] !== value) onChange(values[i]);
  };
  return (
    <div className="wheel" ref={ref} onScroll={onScroll} role="listbox" aria-label={label}>
      <div
        style={{
          height: '60px',
        }}
      />
      {values.map((v) => (
        <button
          type="button"
          key={v}
          role="option"
          aria-selected={v === value ? 'true' : 'false'}
          data-action={action + '.' + v}
          onClick={() => {
            onChange(v);
            if (ref.current)
              ref.current.scrollTo({
                top: values.indexOf(v) * 40,
                behavior: 'smooth',
              });
          }}
        >
          {pad2(v)}
        </button>
      ))}
      <div
        style={{
          height: '60px',
        }}
      />
    </div>
  );
}
SHEETS['SHT-29'] = {
  title: 'sht.29.title',
  sample: () => ({
    value: '18:00',
    onSelect: () => {},
  }),
  comp: ({ props, close }) => {
    const [h0, m0] = (props.value || '18:00').split(':').map(Number);
    const [h, setH] = useState(h0);
    const [m, setM] = useState((Math.round(m0 / 5) * 5) % 60);
    return (
      <SheetFrame
        id="SHT-29"
        title={t('sht.29.title')}
        onClose={close}
        footer={
          <>
            <Button variant="outline" label={t('common.cancel')} action="SHT-29.cancel" onClick={close} />
            <Button
              label={t('common.ok')}
              action="SHT-29.ok"
              onClick={() => {
                close();
                props.onSelect && props.onSelect(`${pad2(h)}:${pad2(m)}`);
              }}
            />
          </>
        }
      >
        <div
          className="row gap8 pb16"
          style={{
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '0',
              right: '0',
              top: '50%',
              height: '40px',
              transform: 'translateY(-50%)',
              borderTop: '1px solid var(--border-default)',
              borderBottom: '1px solid var(--border-default)',
              pointerEvents: 'none',
            }}
          />
          <Wheel
            values={Array.from(
              {
                length: 24,
              },
              (_, i) => i,
            )}
            value={h}
            onChange={setH}
            action="SHT-29.hour"
            label={t('sht.29.hour')}
          />
          <span className="t-title-m">:</span>
          <Wheel
            values={Array.from(
              {
                length: 12,
              },
              (_, i) => i * 5,
            )}
            value={m}
            onChange={setM}
            action="SHT-29.minute"
            label={t('sht.29.minute')}
          />
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-30 place */
SHEETS['SHT-30'] = {
  title: 'sht.30.title',
  sample: () => ({
    onSelect: () => {},
  }),
  comp: ({ props, close }) => {
    const [q, setQ] = useState('');
    const [custom, setCustom] = useState(props.text ? true : false);
    const [text, setText] = useState(props.text || '');
    const list = PLACES.filter(
      (p) =>
        !q ||
        t('place.' + p)
          .toLocaleLowerCase('tr')
          .includes(q.toLocaleLowerCase('tr')),
    );
    return (
      <SheetFrame
        id="SHT-30"
        title={t('sht.30.title')}
        onClose={close}
        full
        flush
        footer={
          custom ? (
            <Button
              label={t('common.ok')}
              disabled={!text.trim()}
              action="SHT-30.okCustom"
              onClick={() => {
                close();
                props.onSelect && props.onSelect(null, text.trim());
              }}
              onDisabledClick={() => {}}
            />
          ) : null
        }
      >
        <div className="px16 pb8">
          <Input icon="search" placeholder={t('common.search')} value={q} onInput={setQ} action="SHT-30.search" ariaLabel={t('common.search')} />
        </div>
        {list.map((p) => (
          <OptionRow
            key={p}
            label={t('place.' + p)}
            checked={props.value === p}
            leading={<Icon name="map-pin" size={18} class="c-muted" />}
            action={'SHT-30.select.' + p}
            onClick={() => {
              close();
              props.onSelect && props.onSelect(p, null);
            }}
          />
        ))}
        <div className="divider" />
        {custom ? (
          <div className="px16 pt16">
            <Input label={t('sht.30.customLabel')} value={text} onInput={setText} action="SHT-30.custom" autofocus />
          </div>
        ) : (
          <Row icon="pencil" label={t('sht.30.custom')} action="SHT-30.customToggle" onClick={() => setCustom(true)} />
        )}
      </SheetFrame>
    );
  },
};
/* SHT-31 cover picker */
SHEETS['SHT-31'] = {
  title: 'sht.31.title',
  sample: () => ({
    value: {
      palette: 'red',
      pattern: 'mountain',
      seed: 'x',
    },
    icon: 'mountain',
    onSelect: () => {},
  }),
  comp: ({ props, close }) => {
    const [c, setC] = useState<any>(
      props.value || {
        palette: 'red',
        pattern: 'mountain',
        seed: 'cover-' + Date.now(),
      },
    );
    const loc = app.locale() === 'tr' ? 0 : 1;
    return (
      <SheetFrame
        id="SHT-31"
        title={t('sht.31.title')}
        onClose={close}
        full
        footer={
          <>
            <Button
              variant="outline"
              icon="images"
              label={t('sht.31.gallery')}
              action="SHT-31.gallery"
              onClick={() =>
                app.openSheet('SHT-16', {
                  onPick: (file: File) => {
                    close();
                    props.onSelect &&
                      props.onSelect({
                        ...c,
                        file,
                      });
                  },
                })
              }
            />
            <Button
              label={t('sht.31.use')}
              action="SHT-31.use"
              onClick={() => {
                close();
                props.onSelect && props.onSelect(c);
              }}
            />
          </>
        }
      >
        <div className="col gap16 pb16">
          <div
            className="cover r16-9"
            style={{
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '0',
              }}
              dangerouslySetInnerHTML={{
                __html: coverArtSVG(c.seed, props.icon || 'sparkles', c.palette, c.pattern),
              }}
            />
          </div>
          {Object.values(PALETTES).map((p) => (
            <div key={p.id} className="col gap8">
              <span className="field-label">{p.name[loc]}</span>
              <div
                className="grid2"
                style={{
                  gridTemplateColumns: 'repeat(4,1fr)',
                  gap: '8px',
                }}
              >
                {PATTERNS.map((pt) => (
                  <button
                    type="button"
                    key={pt}
                    className="cover"
                    style={{
                      aspectRatio: '1',
                      borderRadius: '10px',
                      outline: c.palette === p.id && c.pattern === pt ? '3px solid var(--brand-primary)' : 'none',
                      outlineOffset: '2px',
                    }}
                    aria-pressed={c.palette === p.id && c.pattern === pt ? 'true' : 'false'}
                    aria-label={`${p.name[loc]} · ${PATTERN_NAMES[pt][loc]}`}
                    data-action={`SHT-31.template.${p.id}.${pt}`}
                    onClick={() =>
                      setC({
                        ...c,
                        palette: p.id,
                        pattern: pt,
                      })
                    }
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: '0',
                      }}
                      dangerouslySetInnerHTML={{
                        __html: coverArtSVG(c.seed, props.icon || 'sparkles', p.id, pt, {
                          w: 200,
                          h: 200,
                        }),
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Button
            variant="text"
            icon="refresh-cw"
            label={t('sht.31.shuffle')}
            action="SHT-31.shuffle"
            onClick={() =>
              setC({
                ...c,
                seed: 'cover-' + Math.random().toString(36).slice(2, 8),
              })
            }
          />
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-32 change password */
SHEETS['SHT-32'] = {
  title: 'sht.32.title',
  sample: () => ({}),
  comp: ({ close }) => {
    const [f, setF] = useState<any>({
      cur: '',
      nw: '',
      nw2: '',
      errors: {},
    });
    const [busy, run] = useBusy();
    const st = [f.nw.length >= 8, /[A-ZĞÜŞİÖÇ]/.test(f.nw), /\d/.test(f.nw), /[^A-Za-z0-9]/.test(f.nw)].filter(Boolean).length;
    const save = () =>
      run(async () => {
        const e: any = {};
        if (!f.cur) e.cur = t('auth.err.required');
        if (st < 3 || f.nw.length < LIMITS.passwordMinLength) e.nw = t('auth.err.password');
        if (f.nw2 !== f.nw) e.nw2 = t('auth.err.mismatch');
        setF({
          ...f,
          errors: e,
        });
        if (Object.keys(e).length) return;
        if (!app.requireOnline()) return;
        try {
          await AU.changePassword(f.cur, f.nw);
        } catch (err) {
          const c = errCode(err);
          if (c === 'wrongCredentials') return setF({ ...f, errors: { cur: t('auth.err.wrongPassword') } });
          if (c === 'weakPassword') return setF({ ...f, errors: { nw: t('auth.err.password') } });
          throw err;
        }
        close();
        app.toast('TST-44');
      });
    return (
      <SheetFrame
        id="SHT-32"
        title={t('sht.32.title')}
        onClose={close}
        dirty={!!(f.cur || f.nw)}
        footer={<Button label={t('common.save')} loading={busy} action="SHT-32.save" onClick={save} />}
      >
        <div className="col gap12 pb16">
          <Input
            label={t('sht.32.current')}
            type="password"
            icon="key-round"
            value={f.cur}
            onInput={(v) =>
              setF({
                ...f,
                cur: v,
              })
            }
            error={f.errors.cur}
            action="SHT-32.current"
            autofocus
          />
          <Input
            label={t('sht.32.new')}
            type="password"
            icon="key-round"
            value={f.nw}
            onInput={(v) =>
              setF({
                ...f,
                nw: v,
              })
            }
            error={f.errors.nw}
            action="SHT-32.new"
          />
          <div className="row gap4" aria-hidden="true">
            {[0, 1, 2, 3].map((k) => (
              <i
                key={k}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background:
                    k < st ? (st <= 1 ? 'var(--state-danger)' : st === 2 ? 'var(--state-warning)' : 'var(--state-success)') : 'var(--border-default)',
                }}
              />
            ))}
          </div>
          <Input
            label={t('sht.32.repeat')}
            type="password"
            icon="key-round"
            value={f.nw2}
            onInput={(v) =>
              setF({
                ...f,
                nw2: v,
              })
            }
            error={f.errors.nw2}
            action="SHT-32.repeat"
          />
        </div>
      </SheetFrame>
    );
  },
};
/* SHT-33 category */
SHEETS['SHT-33'] = {
  title: 'sht.33.title',
  sample: () => ({
    value: 'k01',
    onSelect: () => {},
  }),
  comp: ({ props, close }) => (
    <SheetFrame id="SHT-33" title={t('sht.33.title')} onClose={close} flush>
      {CATEGORIES.map((c) => (
        <OptionRow
          key={c.id}
          label={t('cat.' + c.id)}
          checked={props.value === c.id}
          leading={
            <span className="emblem is-xs">
              <Icon name={c.icon} size={16} />
            </span>
          }
          action={'SHT-33.select.' + c.id}
          onClick={() => {
            close();
            props.onSelect && props.onSelect(c.id);
          }}
        />
      ))}
    </SheetFrame>
  ),
};
/* SHT-34 görsel görüntüleyici — gerçek Storage görselleri; kaydırma, çift dokunuş yakınlaştırma, klavye okları. */
function ViewerImage({ img, club, zoomed }: any) {
  const url = useStorageUrl(img.url ? null : img.path);
  const src = img.url || url;
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxHeight: '100%',
        aspectRatio: img.w && img.h ? `${img.w} / ${img.h}` : '1',
        transform: zoomed ? 'scale(1.8)' : 'none',
        transition: 'transform .3s var(--ease-emphasized)',
      }}
    >
      {!src ? (
        <div
          style={{ position: 'absolute', inset: '0' }}
          dangerouslySetInnerHTML={{
            __html: coverArtSVG(img.path || 'img', club ? club.iconName : 'image', club ? club.palette : 'slate', undefined, { w: 600, h: 600 }),
          }}
        />
      ) : (
        <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
      )}
    </div>
  );
}
SHEETS['SHT-34'] = {
  title: 'sht.34.title',
  comp: ({ props, close }: any) => {
    const images: any[] = props.images || [];
    const [i, setI] = useState(props.index || 0);
    const [zoom, setZoom] = useState(false);
    const ref = useRef<any>(null);
    const [dy, setDy] = useState(0);
    const start = useRef<any>(null);
    const lastTap = useRef(0);
    const club = props.post ? sel().club(props.post.clubId) : null;
    const trapRef = useRef<any>(null);
    useFocusTrap(trapRef, close);
    const goTo = (k: number) => {
      const n = Math.max(0, Math.min(images.length - 1, k));
      if (ref.current) ref.current.scrollTo({ left: n * ref.current.clientWidth, behavior: 'smooth' });
      setZoom(false);
    };
    useEffect(() => {
      if (ref.current) ref.current.scrollLeft = (props.index || 0) * ref.current.clientWidth;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') goTo(Math.round(ref.current.scrollLeft / ref.current.clientWidth) + 1);
        if (e.key === 'ArrowLeft') goTo(Math.round(ref.current.scrollLeft / ref.current.clientWidth) - 1);
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
      // eslint-disable-next-line
    }, []);
    const onDown = (e: any) => {
      if (e.pointerType === 'mouse') return;
      start.current = e.clientY;
    };
    const onMove = (e: any) => {
      if (start.current != null && !zoom) setDy(Math.max(0, e.clientY - start.current));
    };
    const onUp = () => {
      if (dy > 120) close();
      setDy(0);
      start.current = null;
    };
    const tap = () => {
      const now = Date.now();
      if (now - lastTap.current < 300) setZoom(!zoom);
      lastTap.current = now;
    };
    return (
      <div
        className="viewer"
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('sht.34.title')}
        style={{
          transform: dy ? `translateY(${dy}px)` : 'none',
          opacity: dy ? 1 - dy / 400 : 1,
        }}
      >
        <div
          className="row between"
          style={{
            padding: 'calc(var(--safe-top) - 4px) 8px 0',
          }}
        >
          <IconButton onCover icon="x" label={t('a11y.close')} action="SHT-34.close" onClick={close} autofocus />
          <span
            className="t-label-l tnum"
            style={{
              color: '#fff',
            }}
          >
            {i + 1}/{images.length}
          </span>
          {props.post ? (
            <IconButton
              onCover
              icon="share-2"
              label={t('common.share')}
              action="SHT-34.share"
              onClick={() =>
                app.openSheet('SHT-15', {
                  type: 'post',
                  id: props.post.id,
                })
              }
            />
          ) : (
            <span style={{ width: 44 }} />
          )}
        </div>
        <div
          ref={ref}
          className="onb-track"
          style={{
            alignItems: 'center',
          }}
          onScroll={(e) => setI(Math.round((e.currentTarget as HTMLElement).scrollLeft / (e.currentTarget as HTMLElement).clientWidth))}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          data-action="SHT-34.swipe"
        >
          {images.map((img, k) => (
            <section
              key={img.path || img.url || k}
              style={{
                padding: '0',
                overflow: 'hidden',
              }}
              onClick={tap}
              data-action={'SHT-34.zoom.' + k}
              role="button"
              tabIndex={0}
              aria-label={t('sht.34.zoomHint')}
            >
              <ViewerImage img={img} club={club} zoomed={zoom && k === i} />
            </section>
          ))}
        </div>
        {images.length > 1 ? (
          <div className="viewer-nav">
            <IconButton onCover icon="chevron-left" label={t('a11y.prev')} action="SHT-34.prev" disabled={i === 0} onClick={() => goTo(i - 1)} onDisabledClick={() => {}} />
            <IconButton onCover icon="chevron-right" label={t('a11y.next')} action="SHT-34.next" disabled={i >= images.length - 1} onClick={() => goTo(i + 1)} onDisabledClick={() => {}} />
          </div>
        ) : null}
        <p
          className="t-caption center"
          style={{
            color: 'rgba(255,255,255,.6)',
            padding: '0 16px calc(var(--safe-bottom) + 12px)',
          }}
        >
          {t('sht.34.zoomHint')}
        </p>
      </div>
    );
  },
};
