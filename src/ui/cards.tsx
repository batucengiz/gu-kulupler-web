/* Alan kartları: kulüp, etkinlik, gönderi (+anket), bildirim satırı, üye ve başvuru satırları — prototip cards.js'in web karşılığı. */
import { useEffect, useRef, useState } from 'react';
import { app, useBusy, handleError } from '../app/app';
import { db } from '../app/data';
import * as A from '../app/actions';
import { openNotification } from '../app/flows';
import { cx } from '../lib/util';
import { sx } from '../lib/sx';
import { Icon } from './Icon';
import { Cover, Avatar, AvatarGroup, coverArtSVG } from './art';
import { useStorageUrl } from './useStorageUrl';
import { Badge, Button, IconButton, RoleBadge, StatusBadge, Card, Tile, Progress, DateBadge, Checkbox, PopMenu } from './ui';
const t = (k: string, p?: any) => app.t(k, p);
const sel = () => app.sel;
const placeName = (ev) => (ev.placeId ? t('place.' + ev.placeId) : ev.placeText || t('event.placeTbd'));
const catName = (club) => t('cat.' + club.categoryId);
const deptYear = (u) => !u ? '' : [u.department ? t('dept.' + u.department) : null, u.year ? t('year.' + u.year) : null].filter(Boolean).join(' · ');
const userName = (u) => (u ? u.name : t('common.deletedUser'));

/** starts the join flow for a club from any screen (section 2.4 / SHT-05 rules) */
/** Onaysız kulübe anında katılım (TST-X3 / başvuru gönderildi) */
async function joinNow(clubId, note = '') {
  try {
    const r = await A.joinClub(clubId, note);
    if (r === 'joined') app.toast('TST-34', { action: () => app.nav.push('CLB-03', { id: clubId }) });
    return r;
  } catch (e) { handleError(e); return undefined; }
}
function startJoin(clubId) {
  const club = sel().club(clubId);
  if (!club) return;
  const u = app.uid();
  const m = sel().membership(clubId, u);
  if (!club.applicationsOpen) {
    app.toast('TST-X1');
    return;
  }
  if (m && m.retryAfter && m.retryAfter > Date.now()) {
    app.nav.push('CLB-05', {
      id: clubId,
    });
    return;
  }
  if (!club.approvalRequired) {
    if (!app.requireOnline()) return;
    void joinNow(clubId);
    return;
  }
  app.openSheet('SHT-05', {
    clubId,
  });
}
/** Kulüp amblemi: yüklenmiş logo varsa görsel, yoksa ikon. */
function ClubEmblem({ club, cls, size = 22, style }: any) {
  const url = useStorageUrl(club.logoPath);
  return (
    <span className={cx('emblem', cls)} style={sx(style)}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <Icon name={club.iconName} size={size} />}
    </span>
  );
}
function ClubCTA({ club, screen, size = 'md', full }: any) {
  const u = app.uid();
  const mode = sel().mode(club.id, u);
  const go = () =>
    app.nav.push('CLB-03', {
      id: club.id,
    });
  const status = () =>
    app.nav.push('CLB-05', {
      id: club.id,
    });
  if (club.status === 'suspended') return <Badge kind="danger" icon="ban" label={t('status.suspended')} />;
  if (mode === 'visitor')
    return club.applicationsOpen ? (
      <Button size={size} full={full} label={t('clubs.card.join')} action={`${screen}.join.${club.id}`} onClick={() => startJoin(club.id)} />
    ) : (
      <Button
        size={size}
        full={full}
        variant="outline"
        disabled
        label={t('clubs.card.closed')}
        action={`${screen}.join.${club.id}`}
        onDisabledClick={() => app.toast('TST-X1')}
      />
    );
  if (mode === 'pending')
    return (
      <Button
        size={size}
        full={full}
        variant="tonal"
        icon="hourglass"
        label={t('clubs.card.pending')}
        action={`${screen}.status.${club.id}`}
        onClick={status}
      />
    );
  if (mode === 'rejected')
    return (
      <Button
        size={size}
        full={full}
        variant="tonal"
        icon="circle-x"
        label={t('clubs.card.rejected')}
        action={`${screen}.status.${club.id}`}
        onClick={status}
        class="c-danger"
      />
    );
  if (mode === 'removed')
    return (
      <Button size={size} full={full} variant="tonal" icon="user-x" label={t('clubs.card.removed')} action={`${screen}.status.${club.id}`} onClick={status} />
    );
  return (
    <span className="row gap8">
      {mode === 'manager' ? (
        <Badge kind="president" icon="shield-check" label={t('clubs.card.manager')} />
      ) : mode === 'advisor' ? (
        <RoleBadge role="advisor" />
      ) : null}
      <Button size={size} full={full} variant="outline" label={t('clubs.card.open')} action={`${screen}.open.${club.id}`} onClick={go} />
    </span>
  );
}
function ClubCard({ club, screen = 'CLB-01', grid, highlight }: any) {
  const members = sel()
    .clubMembers(club.id)
    .map((m) => m.user);
  const u = app.uid();
  const mode = sel().mode(club.id, u);
  if (grid)
    return (
      <Card
        tappable
        action={`${screen}.card.${club.id}`}
        onClick={() =>
          app.nav.push('CLB-03', {
            id: club.id,
          })
        }
        label={club.name}
        highlight={highlight}
      >
        <Cover seed={club.coverSeed} icon={club.iconName} palette={club.palette} pattern={club.pattern} path={club.coverPath} ratio="3-2">
          <ClubEmblem
            club={club}
            cls="is-xs"
            size={16}
            style={{
              position: 'absolute',
              left: '10px',
              bottom: '10px',
              background: 'var(--bg-surface)',
            }}
          />
          {mode !== 'visitor' ? (
            <span
              style={{
                position: 'absolute',
                right: '8px',
                top: '8px',
              }}
            >
              <StatusBadge
                status={mode === 'pending' ? 'pending' : mode === 'rejected' ? 'rejected' : 'active'}
                label={mode === 'pending' ? t('status.pending') : mode === 'rejected' ? t('status.rejected') : t('clubs.card.memberShort')}
              />
            </span>
          ) : null}
        </Cover>
        <div
          className="col gap6"
          style={{
            padding: '10px 12px 12px',
          }}
        >
          <span className="t-title-s clamp2">{club.name}</span>
          <span className="t-caption">
            {catName(club)}
            {' \xB7 '}
            {t('clubs.card.members', {
              count: club.memberCount,
            })}
          </span>
          <div
            style={{
              display: 'flex',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ClubCTA club={club} screen={screen} size="sm" full />
          </div>
        </div>
      </Card>
    );
  return (
    <Card
      tappable
      action={`${screen}.card.${club.id}`}
      onClick={() =>
        app.nav.push('CLB-03', {
          id: club.id,
        })
      }
      label={club.name}
      highlight={highlight}
    >
      <Cover seed={club.coverSeed} icon={club.iconName} palette={club.palette} pattern={club.pattern} path={club.coverPath} ratio="16-9">
        {club.status === 'suspended' ? (
          <span
            style={{
              position: 'absolute',
              left: '12px',
              top: '12px',
            }}
          >
            <Badge kind="danger" icon="ban" label={t('status.suspended')} />
          </span>
        ) : null}
      </Cover>
      <div
        className="card-body col gap8"
        style={{
          paddingTop: '12px',
        }}
      >
        <div className="row gap12 start">
          <ClubEmblem club={club} cls="is-sm" size={22} />
          <div className="flex1 col gap4">
            <h3 className="t-title-s clamp2">{club.name}</h3>
            <div className="row gap6 wrap">
              <Badge kind="neutral" label={catName(club)} />
              <span className="t-caption tnum row gap4">
                <Icon name="users" size={14} />
                {t('clubs.card.members', {
                  count: club.memberCount,
                })}
              </span>
            </div>
          </div>
        </div>
        <p className="t-body-s c-sec clamp2">
          {club.summary} {club.about}
        </p>
        <div className="row between gap8">
          <span className="row gap6">
            {members.length ? <AvatarGroup users={members.slice(0, 3)} size={24} total={club.memberCount} /> : <Icon name={club.approvalRequired ? 'shield-check' : 'zap'} size={14} class="c-muted" />}
            <span className="t-caption">{club.approvalRequired ? t('club.type.approval') : t('club.type.instant')}</span>
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <ClubCTA club={club} screen={screen} size="sm" />
          </span>
        </div>
      </div>
    </Card>
  );
}
function MyClubChip({ club, screen = 'CLB-01', unread, manager }: any) {
  return (
    <button
      type="button"
      className="card is-tappable pressable"
      style={{
        width: '132px',
        textAlign: 'left',
      }}
      data-action={`${screen}.myClub.${club.id}`}
      onClick={() =>
        app.nav.push('CLB-03', {
          id: club.id,
        })
      }
      aria-label={club.name}
    >
      <Cover seed={club.coverSeed} icon={club.iconName} palette={club.palette} pattern={club.pattern} path={club.coverPath} ratio="16-9">
        {manager ? (
          <span
            style={{
              position: 'absolute',
              left: '6px',
              top: '6px',
            }}
          >
            <Badge kind="president" icon="shield-check" label={t('clubs.card.manager')} />
          </span>
        ) : null}
        {club.status === 'suspended' ? (
          <span
            style={{
              position: 'absolute',
              left: '6px',
              top: '6px',
            }}
          >
            <Badge kind="danger" icon="ban" label={t('status.suspended')} />
          </span>
        ) : null}
      </Cover>
      <div
        className="row gap6"
        style={{
          padding: '8px 10px 10px',
        }}
      >
        <span className="t-label-m c-heading clamp2 flex1">{club.name}</span>
        {unread ? <span className="dot" aria-label={t('clubs.my.unread')} /> : null}
      </div>
    </button>
  );
}

/* events */
function eventStatusFor(ev, u) {
  const r = sel().myRsvp(ev.id, u);
  const past = ev.endsAt < Date.now();
  if (ev.status === 'cancelled') return 'cancelled';
  if (ev.status === 'draft') return 'draft';
  if (past) {
    if (r && r.status === 'attended') return 'attended';
    if (r && r.status === 'going') return 'absent';
    return 'past';
  }
  if (r) {
    if (r.status === 'waitlist') return 'waitlist';
    if (r.status === 'going' || r.status === 'attended') return 'going';
  }
  if (ev.visibility === 'members' && !sel().canSeeInside(ev.clubId, u)) return 'members';
  if (sel().isFull(ev)) return 'full';
  return null;
}
function eventQuickAction(ev, _screen?: string) {
  const u = app.uid();
  const st = eventStatusFor(ev, u);
  const nav = app.nav;
  if (st === 'going')
    return {
      label: t('event.cta.ticket'),
      variant: 'tonal',
      icon: 'ticket',
      run: () =>
        nav.push('EVT-03', {
          id: ev.id,
        }),
    };
  if (st === 'attended' || st === 'absent' || st === 'past' || st === 'cancelled') return null;
  if (st === 'members')
    return {
      label: t('event.cta.applyClub'),
      variant: 'outline',
      icon: 'lock',
      run: () =>
        nav.push('CLB-03', {
          id: ev.clubId,
        }),
    };
  if (st === 'waitlist')
    return {
      label: t('status.waitlist'),
      variant: 'tonal',
      icon: 'hourglass',
      run: () =>
        nav.push('EVT-02', {
          id: ev.id,
        }),
    };
  if (st === 'full')
    return {
      label: t('event.cta.waitlist'),
      variant: 'outline',
      run: () => {
        if (!app.requireOnline()) return;
        app.openDialog('DLG-15', {
          eventId: ev.id,
        });
      },
    };
  if (!ev.registrationOpen)
    return {
      label: t('event.cta.closed'),
      variant: 'outline',
      disabled: true,
      run: () => app.toast('TST-X2'),
    };
  return {
    label: t('event.cta.join'),
    variant: 'primary',
    run: () => {
      if (!app.requireOnline()) return;
      app.openSheet('SHT-12', {
        eventId: ev.id,
      });
    },
  };
}
function EventCard({ ev, screen = 'EVT-01', compact, showClub = true, highlight }: any) {
  const club = sel().club(ev.clubId);
  const u = app.uid();
  const st = eventStatusFor(ev, u);
  const reg = sel().registeredCount(ev);
  const quick = eventQuickAction(ev, screen);
  return (
    <Card
      tappable
      action={`${screen}.card.${ev.id}`}
      onClick={() =>
        app.nav.push('EVT-02', {
          id: ev.id,
        })
      }
      label={ev.title}
      highlight={highlight}
    >
      <div
        className="row gap12 start"
        style={{
          padding: '12px',
        }}
      >
        <div
          className="col gap8"
          style={{
            alignItems: 'center',
          }}
        >
          <DateBadge ts={ev.startsAt} />
          {!compact ? (
            <Cover
              seed={ev.coverSeed}
              path={ev.coverPath}
              icon={club ? club.iconName : 'calendar'}
              palette={ev.coverPalette}
              pattern={ev.coverPattern}
              ratio="1-1"
              style={{
                width: '48px',
                borderRadius: '10px',
              }}
            />
          ) : null}
        </div>
        <div className="flex1 col gap4">
          <div className="row gap6 start">
            <h3 className="t-title-s clamp2 flex1">{ev.title}</h3>
            {st ? <StatusBadge status={st} /> : null}
          </div>
          {showClub && club ? (
            <button
              type="button"
              className="t-caption c-brand ellipsis"
              style={{
                textAlign: 'left',
              }}
              data-action={`${screen}.club.${ev.id}`}
              onClick={(e) => {
                e.stopPropagation();
                app.nav.push('CLB-03', {
                  id: club.id,
                });
              }}
            >
              {club.name}
            </button>
          ) : null}
          <span className="t-body-s c-sec row gap4">
            <Icon name="clock" size={14} />
            <span className="nowrap tnum">{app.fmt.time(ev.startsAt)}{' \xB7 '}</span>
            <Icon name="map-pin" size={14} />
            <span className="ellipsis" style={{ minWidth: 0 }}>{placeName(ev)}</span>
          </span>
          {ev.capacity != null ? (
            <div className="row gap8">
              <Progress
                value={reg}
                max={ev.capacity}
                kind={reg >= ev.capacity ? 'muted' : reg / ev.capacity > 0.85 ? 'warning' : undefined}
                thin
                label={t('event.capacity')}
              />
              <span className="t-caption tnum">
                {reg}/{ev.capacity}
              </span>
            </div>
          ) : (
            <span className="t-caption">
              {t('event.unlimited')}
              {' \xB7 '}
              {t('event.registeredCount', {
                count: reg,
              })}
            </span>
          )}
          {quick ? (
            <div className="row end" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant={quick.variant}
                icon={quick.icon}
                label={quick.label}
                disabled={quick.disabled}
                action={`${screen}.join.${ev.id}`}
                onClick={quick.run}
                onDisabledClick={quick.run}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/* posts */
function PollBlock({ post, screen }: any) {
  const u = app.uid();
  const poll = post.poll;
  const data = db.extra['poll:' + post.id];
  const [busy, run] = useBusy();
  useEffect(() => {
    if (!data && post.id !== 'preview') void A.loadPoll(post).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, !!data]);
  const counts = (data && data.counts) || {};
  const total = poll.options.reduce((a, o) => a + (counts[o.id] || 0), 0);
  const mine = data && data.mine ? poll.options.find((o) => o.id === data.mine) : null;
  const ended = poll.endsAt < Date.now();
  const showResults = !!mine || ended || !poll.showResultsAfterVote;
  const vote = (oid) => {
    if (mine) {
      app.toast('TST-10');
      return;
    }
    if (ended || busy || !data) return;
    if (sel().isAdvisor(post.clubId, u)) {
      app.toast('TST-26');
      return;
    }
    if (!app.requireOnline()) return;
    void run(async () => {
      await A.vote(post, oid);
      await A.loadPoll(post).catch(() => undefined);
      app.toast('TST-10');
    });
  };
  return (
    <div className="col gap6" onClick={(e) => e.stopPropagation()}>
      {poll.options.map((o) => {
        const pct = total ? Math.round(((counts[o.id] || 0) / total) * 100) : 0;
        return (
          <button
            type="button"
            key={o.id}
            className={cx('poll-opt', mine && mine.id === o.id && 'is-mine')}
            aria-pressed={mine && mine.id === o.id ? 'true' : 'false'}
            aria-disabled={ended || mine || busy ? 'true' : undefined}
            data-action={`${screen}.vote.${post.id}.${o.id}`}
            onClick={() => vote(o.id)}
          >
            {showResults ? (
              <span
                className="poll-fill"
                style={{
                  width: pct + '%',
                }}
              />
            ) : null}
            <span className="row between gap8">
              <span className="row gap6 t-body-s c-heading">
                {mine && mine.id === o.id ? <Icon name="circle-check" size={16} class="c-brand" /> : null}
                {o.text}
              </span>
              {showResults ? <span className="t-label-m tnum">%{pct}</span> : null}
            </span>
          </button>
        );
      })}
      <span className="t-caption row gap6">
        <Icon name="chart-column" size={14} />
        {t('feed.poll.votes', {
          count: total,
        })}
        {' \xB7 '}
        {ended
          ? t('feed.poll.ended')
          : t('feed.poll.remaining', {
              time: app.fmt.countdown(poll.endsAt),
            })}
      </span>
    </div>
  );
}
function GridImage({ img, club }: any) {
  const url = useStorageUrl(img.path);
  return (
    <>
      <span
        style={{ position: 'absolute', inset: '0' }}
        dangerouslySetInnerHTML={{ __html: coverArtSVG(img.path, club ? club.iconName : 'image', club ? club.palette : 'slate', undefined, { w: 400, h: 400 }) }}
      />
      {url ? <img src={url} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
    </>
  );
}
function ImageGrid({ images, post, screen, onOpen }: any) {
  const club = sel().club(post.clubId);
  const n = Math.min(4, images.length);
  return (
    <div className={cx('img-grid', 'n' + n)} onClick={(e) => e.stopPropagation()}>
      {images.slice(0, 4).map((img, i) => (
        <button
          type="button"
          key={img.path || img.key}
          aria-label={t('a11y.openImage', { n: i + 1 })}
          data-action={`${screen}.image.${post.id}.${i}`}
          onClick={() => (onOpen ? onOpen(i) : app.ui.openViewer({ images, index: i, post }))}
        >
          <GridImage img={img} club={club} />
          {i === 3 && images.length > 4 ? <span className="img-more t-title-m">+{images.length - 4}</span> : null}
        </button>
      ))}
    </div>
  );
}
function PostCard({ post, screen = 'FED-01', expanded, showClub, highlight, hideActions }: any) {
  const u = app.uid();
  const author = sel().user(post.authorId);
  const club = sel().club(post.clubId);
  const role = author ? sel().roleIn(post.clubId, author.id) : null;
  const [more, setMore] = useState(!!expanded);
  const [popped, setPopped] = useState(false);
  const liked = post.likes.includes(u);
  const saved = sel().isSaved(u, post.id);
  const canInteract = !sel().isAdvisor(post.clubId, u);
  const open = () =>
    app.nav.push('FED-02', {
      clubId: post.clubId,
      postId: post.id,
    });
  const like = (e) => {
    e.stopPropagation();
    if (!canInteract) {
      app.toast('TST-26');
      return;
    }
    if (!app.requireOnline()) return;
    if (!liked) {
      setPopped(true);
      setTimeout(() => setPopped(false), 400);
    }
    A.toggleLike(post).catch(handleError);
  };
  const save = (e) => {
    e.stopPropagation();
    if (!app.requireOnline()) return;
    A.toggleSave(post)
      .then((nowSaved) =>
        app.toast('TST-11', {
          saved: nowSaved,
          undo: () => {
            const cur = sel().post(post.id) || post;
            A.toggleSave(cur).catch(handleError);
          },
        }),
      )
      .catch(handleError);
  };
  const share = (e) => {
    e.stopPropagation();
    app.openSheet('SHT-15', {
      type: 'post',
      id: post.id,
    });
  };
  const comment = (e) => {
    e.stopPropagation();
    if (expanded) return;
    app.openSheet('SHT-09', {
      postId: post.id,
    });
  };
  const menu = (e) => {
    e.stopPropagation();
    app.openSheet('SHT-08', {
      postId: post.id,
    });
  };
  const long = post.text.length > 280;
  return (
    <article className={cx('card', highlight && 'is-highlight')} aria-label={post.title || post.text.slice(0, 40)}>
      {post.pinned ? (
        <div
          className="row gap4 t-caption"
          style={{
            padding: '10px 16px 0',
          }}
        >
          <Icon name="pin" size={14} />
          {t('feed.pinned')}
        </div>
      ) : null}
      <div
        className="row gap10 start"
        style={{
          padding: '12px 8px 0 16px',
          gap: '10px',
        }}
      >
        <button
          type="button"
          className="row gap10 flex1"
          style={{
            textAlign: 'left',
            gap: '10px',
          }}
          data-action={`${screen}.author.${post.id}`}
          onClick={() =>
            author &&
            app.nav.push('CLB-07', {
              id: author.id,
              clubId: post.clubId,
            })
          }
          aria-label={userName(author)}
        >
          <Avatar user={author} size={40} />
          <span className="flex1 col">
            <span className="row gap6 wrap">
              <span
                className="t-label-l c-heading ellipsis"
                style={{
                  maxWidth: '170px',
                }}
              >
                {userName(author)}
              </span>
              {role ? <RoleBadge role={role} /> : null}
            </span>
            <span className="t-caption">
              {showClub && club ? club.name + ' · ' : ''}
              {app.fmt.rel(post.createdAt)}
              {post.editedAt ? ' · ' + t('feed.edited') : ''}
            </span>
          </span>
        </button>
        <IconButton icon="more-horizontal" label={t('a11y.more')} action={`${screen}.menu.${post.id}`} onClick={menu} />
      </div>
      <div
        className="col gap10"
        style={{
          padding: '10px 16px 12px',
        }}
      >
        {post.type === 'announcement' ? (
          <span className="row gap6">
            <Badge kind="president" icon="megaphone" label={t('feed.type.announcement')} />
            {post.pushSent ? (
              <span className="t-caption row gap4">
                <Icon name="bell-ring" size={12} />
                {t('feed.pushSent')}
              </span>
            ) : null}
          </span>
        ) : post.type === 'poll' ? (
          <Badge kind="info" icon="chart-column" label={t('feed.type.poll')} />
        ) : null}
        {post.title ? <h3 className="t-title-s">{post.title}</h3> : null}
        <div
          role={expanded ? undefined : 'button'}
          tabIndex={expanded ? undefined : 0}
          data-action={`${screen}.post.${post.id}`}
          onClick={expanded ? undefined : open}
          onKeyDown={(e) => {
            if (!expanded && e.key === 'Enter') open();
          }}
          style={sx(
            expanded
              ? undefined
              : {
                  cursor: 'pointer',
                },
          )}
        >
          <p className={cx('t-body-m prewrap break', !more && long && 'clamp5')}>{post.text}</p>
          {long && !more ? (
            <button
              type="button"
              className="t-label-l c-brand mt4"
              data-action={`${screen}.more.${post.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setMore(true);
              }}
            >
              {t('common.readMore')}
            </button>
          ) : null}
        </div>
        {post.images && post.images.length ? <ImageGrid images={post.images} post={post} screen={screen} /> : null}
        {post.poll ? <PollBlock post={post} screen={screen} /> : null}
        {hideActions ? null : (
          <div
            className="row between"
            style={{
              margin: '0 -8px -4px',
            }}
          >
            <span className="row gap2">
              <button
                type="button"
                className="iconbtn"
                style={{
                  width: 'auto',
                  padding: '0 10px',
                  gap: '6px',
                  borderRadius: '12px',
                }}
                aria-pressed={liked ? 'true' : 'false'}
                aria-label={t('feed.like')}
                data-action={`${screen}.like.${post.id}`}
                onClick={like}
              >
                <Icon
                  name="heart"
                  size={22}
                  class={cx('heart', liked && 'is-liked', popped && 'is-liked')}
                  style={sx(
                    liked
                      ? {
                          fill: 'currentColor',
                        }
                      : undefined,
                  )}
                />
                <span className="t-label-m tnum">{post.likeCount || post.likes.length || ''}</span>
              </button>
              <button
                type="button"
                className="iconbtn"
                style={{
                  width: 'auto',
                  padding: '0 10px',
                  gap: '6px',
                  borderRadius: '12px',
                }}
                aria-label={t('feed.comment')}
                data-action={`${screen}.comment.${post.id}`}
                onClick={comment}
              >
                <Icon name="message-circle" size={22} />
                <span className="t-label-m tnum">
                  {post.commentCount || ''}
                </span>
              </button>
              <IconButton icon="share-2" label={t('common.share')} action={`${screen}.share.${post.id}`} onClick={share} />
            </span>
            <button
              type="button"
              className="iconbtn"
              aria-pressed={saved ? 'true' : 'false'}
              aria-label={saved ? t('feed.unsave') : t('feed.save')}
              data-action={`${screen}.save.${post.id}`}
              onClick={save}
            >
              <Icon
                name="bookmark"
                size={22}
                class={saved ? 'c-brand' : ''}
                style={sx(
                  saved
                    ? {
                        fill: 'currentColor',
                      }
                    : undefined,
                )}
              />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/* notifications */
const NOTIF_ICON = {
  application_received: ['user-plus', 'ni-brand'],
  application_approved: ['circle-check', 'ni-success'],
  application_rejected: ['circle-x', 'ni-danger'],
  removed_from_club: ['user-x', 'ni-danger'],
  role_changed: ['user-cog', 'ni-info'],
  announcement: ['megaphone', 'ni-brand'],
  event_new: ['calendar-plus', 'ni-info'],
  event_reminder: ['bell-ring', 'ni-warning'],
  event_cancelled: ['calendar-x', 'ni-danger'],
  waitlist_promoted: ['ticket', 'ni-success'],
  report_resolved: ['shield-check', 'ni-success'],
  new_report: ['flag', 'ni-warning'],
  system: ['info', 'ni-neutral'],
};
const NOTIF_CAT = {
  application_received: 'clubs',
  application_approved: 'clubs',
  application_rejected: 'clubs',
  removed_from_club: 'clubs',
  role_changed: 'clubs',
  announcement: 'clubs',
  report_resolved: 'clubs',
  new_report: 'clubs',
  event_new: 'events',
  event_reminder: 'events',
  event_cancelled: 'events',
  waitlist_promoted: 'events',
  system: 'system',
};
function notifParams(n) {
  const r = n.refs || {};
  const club = r.clubId ? sel().club(r.clubId) : null;
  const ev = r.eventId ? sel().event(r.eventId) : null;
  const post = r.postId ? sel().post(r.postId) : null;
  const user = r.applicantId ? sel().user(r.applicantId) : null;
  return {
    club: club ? club.name : '',
    event: ev ? ev.title : '',
    post: post ? post.title || post.text.slice(0, 60) : '',
    user: user ? user.name : '',
    role: r.role ? t('role.' + r.role) : '',
    time: ev ? app.fmt.time(ev.startsAt) : '',
    reason: ev && ev.cancelReason ? t('cancelReason.' + ev.cancelReason) : '',
  };
}
function notifTitle(n) {
  if (n.type === 'system') return t('notifType.system.' + ((n.refs && n.refs.textKey) || 'welcome') + '.title');
  return t(`notifType.${n.type}.title`, notifParams(n));
}
function notifBody(n) {
  if (n.type === 'system') return t('notifType.system.' + ((n.refs && n.refs.textKey) || 'welcome') + '.body');
  return t(`notifType.${n.type}.body`, notifParams(n));
}
function NotificationRow({ n, screen = 'NTF-01' }: any) {
  const [dx, setDx] = useState(0);
  const start = useRef<any>(null);
  const timer = useRef<any>(null);
  const [menu, setMenu] = useState(false);
  const moved = useRef(false);
  const [icon, cls] = NOTIF_ICON[n.type] || NOTIF_ICON.system;
  const del = () => {
    const snap = n;
    A.deleteNotification(n)
      .then(() =>
        app.toast('TST-16', {
          undo: () => A.restoreNotification(snap).catch(handleError),
        }),
      )
      .catch(handleError);
  };
  const toggleRead = () => A.markRead(n, !n.read).catch(handleError);
  const onDown = (e) => {
    if (e.button && e.button !== 0) return;
    start.current = e.clientX;
    moved.current = false;
    timer.current = setTimeout(() => {
      setMenu(true);
      moved.current = true;
    }, 550);
  };
  const onMove = (e) => {
    if (start.current == null) return;
    const d = e.clientX - start.current;
    if (Math.abs(d) > 8) {
      clearTimeout(timer.current);
      moved.current = true;
      setDx(Math.max(-140, Math.min(140, d)));
    }
  };
  const onUp = () => {
    clearTimeout(timer.current);
    if (start.current == null) return;
    if (dx < -90) {
      setDx(0);
      del();
    } else if (dx > 90) {
      setDx(0);
      toggleRead();
    } else setDx(0);
    start.current = null;
  };
  const tap = () => {
    if (moved.current) return;
    openNotification(n);
  };
  return (
    <div className="notif-row">
      <div className="notif-under">
        <span
          className={cx('row gap6', dx > 0 ? '' : 'hidden-vis')}
          style={{
            color: 'var(--state-info)',
          }}
        >
          <Icon name={n.read ? 'bell-ring' : 'check'} size={18} />
          {n.read ? t('notif.markUnread') : t('notif.markRead')}
        </span>
        <span
          className={cx('row gap6', dx < 0 ? '' : 'hidden-vis')}
          style={{
            color: 'var(--state-danger)',
          }}
        >
          {t('common.delete')}
          <Icon name="trash-2" size={18} />
        </span>
      </div>
      <div
        className="notif-front"
        style={{
          transform: `translateX(${dx}px)`,
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        data-action={`${screen}.swipe.${n.id}`}
      >
        <button
          type="button"
          className="tile"
          style={{
            alignItems: 'flex-start',
            padding: '12px 16px',
          }}
          data-action={`${screen}.item.${n.id}`}
          onClick={tap}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu(true);
          }}
          aria-label={notifTitle(n)}
        >
          <span className={cx('notif-icon', cls)}>
            <Icon name={icon} size={20} />
          </span>
          <span className="tile-text col gap2">
            <span className={cx('t-body-m', n.read ? 'c-heading' : 'c-heading bold')}>{notifTitle(n)}</span>
            <span className="t-body-s c-sec clamp2">{notifBody(n)}</span>
            <span className="t-caption">{app.fmt.rel(n.createdAt)}</span>
          </span>
          {!n.read ? (
            <span
              className="dot"
              style={{
                marginTop: '8px',
              }}
              aria-label={t('notif.unread')}
            />
          ) : null}
        </button>
      </div>
      {menu ? (
        <PopMenu id={screen} onClose={() => setMenu(false)}>
          <Tile
            title={n.read ? t('notif.markUnread') : t('notif.markRead')}
            leading={<Icon name="check" size={20} />}
            action={`${screen}.menu.${n.id}.read`}
            onClick={() => {
              setMenu(false);
              toggleRead();
            }}
          />
          <Tile
            title={t('common.delete')}
            leading={<Icon name="trash-2" size={20} />}
            action={`${screen}.menu.${n.id}.delete`}
            onClick={() => {
              setMenu(false);
              del();
            }}
            danger
          />
          <Tile
            title={t('notif.muteType')}
            leading={<Icon name="bell-off" size={20} />}
            action={`${screen}.menu.${n.id}.mute`}
            onClick={() => {
              setMenu(false);
              const key =
                {
                  announcement: 'announcements',
                  event_reminder: 'eventReminders',
                  event_new: 'newEvents',
                  application_approved: 'applicationResults',
                  application_rejected: 'applicationResults',
                  application_received: 'management',
                  new_report: 'management',
                  system: 'system',
                }[n.type] || 'system';
              A.updateSettings({ [key]: false })
                .then(() => app.toast('TST-19'))
                .catch(handleError);
            }}
          />
        </PopMenu>
      ) : null}
    </div>
  );
}

/* members & applications */
function MemberRow({ m, screen, onMenu, menuAction, sub, trailing, showRate, clubId }: any) {
  const u = m.user || { id: m.userId, name: m.applicant ? m.applicant.name : t('common.deletedUser'), department: m.applicant?.department, year: m.applicant?.year, avatarSeed: m.applicant?.avatarSeed || m.userId };
  const rate = showRate ? sel().attendanceRate(clubId || m.clubId, u.id) : null;
  return (
    <Tile
      leading={<Avatar user={u} size={40} />}
      title={
        <span className="row gap6 wrap">
          <span
            className="ellipsis"
            style={{
              maxWidth: '190px',
            }}
          >
            {u.name}
          </span>
          <RoleBadge role={m.role} />
        </span>
      }
      subtitle={sub || deptYear(u)}
      sub2={
        rate != null ? (
          <span className="row gap6">
            <Progress value={rate} max={100} thin kind="success" label={t('mgtMembers.rate')} />
            <span className="tnum">%{rate}</span>
          </span>
        ) : null
      }
      trailing={
        trailing !== undefined ? (
          trailing
        ) : onMenu ? (
          <IconButton
            icon="more-vertical"
            label={t('a11y.more')}
            action={menuAction || `${screen}.menu.${u.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onMenu();
            }}
          />
        ) : null
      }
      action={`${screen}.member.${u.id}`}
      onClick={() =>
        app.nav.push('CLB-07', {
          id: u.id,
          clubId: clubId || m.clubId,
        })
      }
    />
  );
}
function ApplicationRow({ m, screen = 'MGT-02', selecting, selected, onSelect, onApprove, onReject, onOpen, readOnly }: any) {
  const u = m.user || { id: m.userId, name: m.applicant.name, department: m.applicant.department, year: m.applicant.year, avatarSeed: m.applicant.avatarSeed };
  return (
    <div
      className="row gap8"
      style={{
        padding: '6px 8px 6px 16px',
        minHeight: '64px',
        position: 'relative',
      }}
    >
      {selecting ? <Checkbox checked={selected} onChange={onSelect} action={`${screen}.select.${u.id}`} label={u.name} /> : null}
      <button
        type="button"
        className="row gap12 flex1 start"
        style={{
          textAlign: 'left',
          padding: '4px 0',
        }}
        data-action={`${screen}.row.${u.id}`}
        onClick={onOpen}
        onContextMenu={(e) => {
          e.preventDefault();
          onSelect && onSelect(true);
        }}
      >
        <Avatar user={u} size={44} />
        <span className="flex1 col gap2">
          <span className="row gap6">
            <span
              className="t-label-l c-heading ellipsis"
              style={{
                maxWidth: '170px',
              }}
            >
              {u.name}
            </span>
            {m.priorCount ? <Badge kind="neutral" icon="history" label={t('applications.prior')} /> : null}
          </span>
          <span className="t-body-s c-muted ellipsis">{deptYear(u)}</span>
          {m.note ? (
            <span
              className="t-body-s c-sec clamp1"
              style={{
                fontStyle: 'italic',
              }}
            >
              “{m.note}”
            </span>
          ) : (
            <span className="t-caption">{t('applications.noNote')}</span>
          )}
          <span className="t-caption">{app.fmt.rel(m.appliedAt)}</span>
        </span>
      </button>
      {!selecting ? (
        <span className="row gap2">
          <IconButton
            icon="check"
            label={t('applications.approve')}
            action={`${screen}.approve.${u.id}`}
            onClick={onApprove}
            disabled={readOnly}
            onDisabledClick={() => app.toast('TST-26')}
            style={{
              color: 'var(--state-success)',
              background: 'var(--state-success-container)',
              width: '44px',
              height: '44px',
            }}
          />
          <IconButton
            icon="x"
            label={t('applications.reject')}
            action={`${screen}.reject.${u.id}`}
            onClick={onReject}
            disabled={readOnly}
            onDisabledClick={() => app.toast('TST-26')}
            style={{
              color: 'var(--state-danger)',
              background: 'var(--state-danger-container)',
              width: '44px',
              height: '44px',
            }}
          />
        </span>
      ) : null}
    </div>
  );
}
export {
  joinNow,
  ClubEmblem,
  placeName,
  catName,
  deptYear,
  userName,
  startJoin,
  ClubCTA,
  ClubCard,
  MyClubChip,
  eventStatusFor,
  eventQuickAction,
  EventCard,
  PollBlock,
  ImageGrid,
  PostCard,
  NOTIF_ICON,
  NOTIF_CAT,
  notifTitle,
  notifBody,
  NotificationRow,
  MemberRow,
  ApplicationRow,
};
