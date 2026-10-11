import {
  Button,
  Checkbox,
  DIALOGS,
  DialogFrame,
  Icon,
  Input,
  OptionRow,
  TOASTS,
  app,
  setPrefs,
  A,
  session,
  handleError,
  useBusy,
  useCountdown,
  useState,
} from '../ui/kit';
/* ===== DIALOGS ===== 32 dialogs. Registry: DIALOGS[id] = { title, comp, sample, dismissable } */
const t = (k: string, p?: any) => app.t(k, p);
const sel = () => app.sel;
const D = DIALOGS;
/** Eylem düğmesi: onClick bir Promise döndürürse bitene dek yükleniyor gösterir; hata → handleError. */
function ActButton({ onClick, ...rest }: any) {
  const [busy, run] = useBusy();
  return <Button {...rest} loading={busy || rest.loading} onClick={(e) => { if (busy) return; void run(async () => { await (onClick && onClick(e)); }); }} />;
}
const B = (label: string, action: string, onClick: (e?: any) => any, variant = 'primary', extra: any = {}) => (
  <ActButton key={action} label={label} action={action} onClick={onClick} variant={variant} {...extra} />
);
const nameOf = (userId: string) => (sel().user(userId) || ({} as any)).name || '';
const simple = (id: string, { danger, icon, body, actions, dismissable = true, titleParams }: any) => ({
  title: `dlg.${id}.title`,
  dismissable,
  comp: ({ props, close }) => (
    <DialogFrame
      id={'DLG-' + id}
      title={t(`dlg.${id}.title`, titleParams ? titleParams(props) : undefined)}
      body={body ? body(props) : t(`dlg.${id}.body`)}
      onClose={close}
      dismissable={dismissable}
      danger={danger}
      icon={icon}
      actions={actions(props, close)}
    />
  ),
});

/* İzin diyalogları (DLG-03/04/05): web'de gerçek tarayıcı izni istenir. */
function permissionDialog(id: string, { icon, onAllow, notNow }: any) {
  D['DLG-' + id] = {
    comp: ({ props, close }: any) => (
      <DialogFrame
        id={'DLG-' + id}
        title={t(`dlg.${id}.title`)}
        body={t(`dlg.${id}.body`)}
        onClose={() => {
          notNow && notNow(props);
          close();
        }}
        icon={icon}
        actions={[
          B(t('dlg.permission.allow'), `DLG-${id}.allow`, async () => {
            close();
            await onAllow(props);
          }),
          B(
            t('dlg.permission.notNow'),
            `DLG-${id}.notNow`,
            () => {
              notNow && notNow(props);
              close();
            },
            'text',
          ),
        ]}
      />
    ),
  };
}
permissionDialog('03', {
  icon: 'bell-ring',
  onAllow: async () => {
    setPrefs({ notifAskedAt: Date.now() });
    if (typeof Notification === 'undefined') return;
    const r = await Notification.requestPermission();
    if (r === 'granted') app.toast('TST-19');
    else app.openDialog('DLG-03b');
  },
  notNow: () => setPrefs({ notifAskedAt: Date.now() }),
});
D['DLG-03b'] = {
  comp: ({ close }: any) => (
    <DialogFrame id="DLG-03b" title={t('web.notif.blockedTitle')} body={t('web.notif.blockedBody')} onClose={close} icon="bell-off" actions={[B(t('common.ok'), 'DLG-03b.ok', close)]} />
  ),
};
permissionDialog('04', {
  icon: 'camera',
  onAllow: (p) => p.onGranted && p.onGranted(),
  notNow: (p) => p.onDenied && p.onDenied(),
});
permissionDialog('05', {
  icon: 'images',
  onAllow: (p) => p.onGranted && p.onGranted(),
});
D['DLG-01'] = simple('01', {
  danger: true,
  icon: 'ban',
  actions: (p, close) => [
    B(t('dlg.01.support'), 'DLG-01.support', () => {
      close();
      app.openDialog('DLG-32', {
        url: 'mailto:destek@gumushane.edu.tr',
      });
    }),
    B(t('common.ok'), 'DLG-01.ok', close, 'text'),
  ],
});
D['DLG-02'] = {
  comp: ({ props, close }: any) => {
    const until = props.until || Date.now() + 30000;
    const left = useCountdown(until);
    return (
      <DialogFrame
        id="DLG-02"
        title={t('dlg.02.title')}
        body={left > 0 ? t('dlg.02.body', { s: left }) : t('dlg.02.unlocked')}
        onClose={close}
        icon="lock"
        actions={[
          B(t('common.ok'), 'DLG-02.ok', close),
          B(
            t('auth.forgot'),
            'DLG-02.forgot',
            () => {
              close();
              app.nav.push('AUT-04', { email: props.email });
            },
            'text',
          ),
        ]}
      />
    );
  },
};
D['DLG-06'] = simple('06', {
  icon: 'log-out',
  actions: (p, close) => [
    B(t('auth.logout'), 'DLG-06.logout', () => {
      close();
      void session.logout();
    }),
    B(t('common.giveUp'), 'DLG-06.cancel', close, 'text'),
  ],
});
D['DLG-07'] = simple('07', {
  danger: true,
  icon: 'x',
  body: (p) =>
    t('dlg.07.body', {
      club: (sel().club(p.clubId) || {}).name,
    }),
  actions: (p, close) => [
    B(
      t('application.cancel'),
      'DLG-07.confirm',
      async () => {
        if (!app.requireOnline()) return;
        await A.cancelApplication(p.clubId);
        close();
        app.toast('TST-40');
        if (app.nav.current().screen === 'CLB-05') app.nav.back();
      },
      'danger',
    ),
    B(t('common.giveUp'), 'DLG-07.cancel', close, 'text'),
  ],
});
D['DLG-08'] = simple('08', {
  danger: true,
  icon: 'log-out',
  body: (p) =>
    t('dlg.08.body', {
      club: (sel().club(p.clubId) || {}).name,
    }),
  actions: (p, close) => [
    B(
      t('club.leave'),
      'DLG-08.confirm',
      async () => {
        if (!app.requireOnline()) return;
        await A.leaveClub(p.clubId);
        close();
        app.ui.closeAllSheets();
        app.toast('TST-39');
      },
      'danger',
    ),
    B(t('common.giveUp'), 'DLG-08.cancel', close, 'text'),
  ],
});
D['DLG-09'] = simple('09', {
  icon: 'crown',
  actions: (p, close) => [
    B(t('mgtMembers.transfer'), 'DLG-09.transfer', () => {
      close();
      app.openSheet('SHT-25', {
        mode: 'transfer',
        clubId: p.clubId,
        onSelect: (uid) => {
          app.closeSheet();
          app.openDialog('DLG-21', {
            clubId: p.clubId,
            userId: uid,
          });
        },
      });
    }),
    B(t('common.ok'), 'DLG-09.ok', close, 'text'),
  ],
});
D['DLG-10'] = simple('10', {
  danger: true,
  icon: 'trash-2',
  actions: (p, close) => [
    B(
      t('common.delete'),
      'DLG-10.confirm',
      async () => {
        const post = sel().post(p.postId);
        if (!post || !app.guard(post.clubId)) return;
        await A.deletePost(post);
        close();
        app.ui.closeAllSheets();
        if (app.nav.current().screen === 'FED-02') app.nav.back();
        app.toast('TST-45', {
          what: t('feed.type.post'),
          undo: () => A.restorePost(post).catch(handleError),
        });
      },
      'danger',
    ),
    B(t('common.giveUp'), 'DLG-10.cancel', close, 'text'),
  ],
});
D['DLG-11'] = simple('11', {
  danger: true,
  icon: 'trash-2',
  actions: (p, close) => [
    B(
      t('common.delete'),
      'DLG-11.confirm',
      async () => {
        if (!app.requireOnline()) return;
        await A.deleteComment(p.postId, p.commentId);
        close();
        app.ui.closeAllSheets();
        p.onDone && p.onDone();
        app.toast('TST-45', {
          what: t('feed.comment'),
          undo: () =>
            A.restoreComment(p.postId, p.commentId)
              .then(() => p.onDone && p.onDone())
              .catch(handleError),
        });
      },
      'danger',
    ),
    B(t('common.giveUp'), 'DLG-11.cancel', close, 'text'),
  ],
});
D['DLG-12'] = simple('12', {
  icon: 'shield-check',
  actions: (p, close) => [
    B(t('common.ok'), 'DLG-12.ok', close),
    p.userId
      ? B(
          t('dlg.12.block', {
            name: nameOf(p.userId),
          }),
          'DLG-12.block',
          () => {
            close();
            app.openDialog('DLG-13', {
              userId: p.userId,
            });
          },
          'text',
        )
      : null,
  ],
});
D['DLG-13'] = simple('13', {
  danger: true,
  icon: 'ban',
  titleParams: (p) => ({
    name: nameOf(p.userId),
  }),
  actions: (p, close) => [
    B(
      t('sht.27.block'),
      'DLG-13.confirm',
      async () => {
        if (!app.requireOnline()) return;
        const name = nameOf(p.userId);
        await A.blockUser(p.userId);
        close();
        app.ui.closeAllSheets();
        app.toast('TST-09', {
          name,
          undo: () => A.unblockUser(p.userId).catch(handleError),
        });
      },
      'danger',
    ),
    B(t('common.giveUp'), 'DLG-13.cancel', close, 'text'),
  ],
});
D['DLG-14'] = simple('14', {
  danger: true,
  icon: 'calendar-x',
  body: (p) => (p.waitlist ? t('dlg.14.bodyWaitlist') : t('dlg.14.body')),
  actions: (p, close) => [
    B(
      t('common.giveUp'),
      'DLG-14.confirm',
      async () => {
        if (!app.requireOnline()) return;
        await A.leaveEvent(p.eventId);
        close();
        app.toast('TST-42');
        p.onDone && p.onDone();
      },
      'danger',
    ),
    B(t('dlg.14.stay'), 'DLG-14.cancel', close, 'text'),
  ],
});
D['DLG-15'] = simple('15', {
  icon: 'hourglass',
  body: (p) =>
    t('dlg.15.body', {
      n: ((sel().event(p.eventId) || ({} as any)).waitlistCount || 0) + 1,
    }),
  actions: (p, close) => [
    B(t('event.cta.waitlist'), 'DLG-15.confirm', async () => {
      if (!app.requireOnline()) return;
      const res = await A.joinEvent(p.eventId, sel().settings().reminderTime);
      close();
      if (res.status === 'going') app.toast('TST-41', { action: () => app.nav.push('EVT-03', { id: p.eventId }) });
      else app.toast('TST-43', { n: res.position || 1 });
    }),
    B(t('common.giveUp'), 'DLG-15.cancel', close, 'text'),
  ],
});
D['DLG-16'] = simple('16', {
  danger: true,
  icon: 'calendar-x',
  body: (p) => {
    const ev: any = sel().event(p.eventId) || {};
    return t('dlg.16.body', {
      event: ev.title,
      reason: ev.cancelReason ? t('cancelReason.' + ev.cancelReason) : '',
    });
  },
  actions: (p, close) => [
    B(t('common.ok'), 'DLG-16.ok', close),
    B(
      t('dlg.16.similar'),
      'DLG-16.similar',
      () => {
        close();
        app.nav.switchTab('events');
        app.nav.popTo('EVT-01');
      },
      'text',
    ),
  ],
});
D['DLG-17'] = simple('17', {
  icon: 'list-checks',
  body: (p) =>
    t('dlg.17.' + (p.kind || 'approve'), {
      count: p.count || 0,
    }),
  actions: (p, close) => [
    B(
      p.kind === 'reject' ? t('applications.reject') : t('common.confirm'),
      'DLG-17.confirm',
      () => (p.onConfirm ? p.onConfirm() : close()),
      p.kind === 'reject' ? 'danger' : 'primary',
    ),
    B(t('common.giveUp'), 'DLG-17.cancel', close, 'text'),
  ],
});
D['DLG-18'] = simple('18', {
  icon: 'refresh-cw',
  body: (p) =>
    t('dlg.18.body', {
      result: p.result || t('status.rejected'),
    }),
  actions: (p, close) =>
    B(t('common.ok'), 'DLG-18.ok', () => {
      close();
      p.onOk && p.onOk();
    }),
});
D['DLG-19'] = {
  comp: ({ props, close }) => {
    const usr: any = sel().user(props.userId) || {};
    const [reason, setReason] = useState('');
    return (
      <DialogFrame
        id="DLG-19"
        title={t('dlg.19.title', {
          name: usr.name,
        })}
        body={t('dlg.19.body')}
        onClose={close}
        danger
        icon="user-x"
        actions={[
          B(
            t('dlg.19.confirm'),
            'DLG-19.confirm',
            async () => {
              if (!app.guard(props.clubId)) return;
              await A.removeMember(props.clubId, props.userId, reason.trim());
              close();
              app.ui.closeAllSheets();
              if (app.nav.current().screen === 'CLB-07') app.nav.back();
              app.toast('TST-47', {
                name: usr.name,
                undo: () => A.undoRemoval(props.clubId, props.userId).catch(handleError),
              });
            },
            'danger',
          ),
          B(t('common.giveUp'), 'DLG-19.cancel', close, 'text'),
        ]}
      >
        <Input label={t('dlg.19.reason')} value={reason} onInput={setReason} multiline rows={2} maxLength={200} action="DLG-19.reason" />
      </DialogFrame>
    );
  },
};
D['DLG-20'] = simple('20', {
  icon: 'user-cog',
  body: (p) => {
    const m: any = sel().membership(p.clubId, p.userId) || {};
    return t('dlg.20.body', {
      name: nameOf(p.userId),
      oldRole: t('role.' + (m.role || 'member')),
      newRole: t('role.' + p.role),
    });
  },
  actions: (p, close) => [
    B(t('common.confirm'), 'DLG-20.confirm', async () => {
      if (!app.guard(p.clubId)) return;
      await A.setRole(p.clubId, p.userId, p.role);
      close();
      app.ui.closeAllSheets();
      app.toast('TST-46', {
        name: nameOf(p.userId),
        role: t('role.' + p.role),
      });
    }),
    B(t('common.giveUp'), 'DLG-20.cancel', close, 'text'),
  ],
});
D['DLG-21'] = {
  comp: ({ props, close }) => {
    const [step, setStep] = useState(1);
    const [word, setWord] = useState('');
    const usr: any = sel().user(props.userId) || {};
    const ok = word.trim().toLocaleUpperCase('tr') === 'DEVRET';
    return (
      <DialogFrame
        id="DLG-21"
        title={t('dlg.21.title')}
        body={
          step === 1
            ? t('dlg.21.body1', {
                name: usr.name,
              })
            : t('dlg.21.body2')
        }
        onClose={close}
        danger
        icon="crown"
        actions={[
          step === 1
            ? B(t('common.continue'), 'DLG-21.next', () => setStep(2), 'danger')
            : B(
                t('dlg.21.confirm'),
                'DLG-21.confirm',
                async () => {
                  if (!ok) return;
                  if (!app.guard(props.clubId)) return;
                  await A.transferPresidency(props.clubId, props.userId);
                  close();
                  app.ui.closeAllSheets();
                  app.toast('TST-49', {
                    name: usr.name,
                  });
                },
                'danger',
                {
                  disabled: !ok,
                  onDisabledClick: () => app.toast('TST-X20'),
                },
              ),
          B(t('common.giveUp'), 'DLG-21.cancel', close, 'text'),
        ]}
      >
        {step === 2 ? <Input value={word} onInput={setWord} placeholder="DEVRET" action="DLG-21.word" ariaLabel={t('dlg.21.body2')} autofocus /> : null}
      </DialogFrame>
    );
  },
};
D['DLG-22'] = {
  comp: ({ props, close }) => {
    const [notify, setNotify] = useState(true);
    return (
      <DialogFrame
        id="DLG-22"
        title={t('dlg.22.title')}
        body={t('dlg.22.body')}
        onClose={close}
        icon="calendar-check"
        actions={[
          B(t('eventForm.publish'), 'DLG-22.confirm', () => (props.onConfirm ? props.onConfirm(notify) : close())),
          B(t('dlg.22.back'), 'DLG-22.cancel', close, 'text'),
        ]}
      >
        <label
          className="row gap10"
          style={{
            cursor: 'pointer',
          }}
        >
          <Checkbox
            checked={notify}
            onChange={setNotify}
            action="DLG-22.notify"
            label={t('dlg.22.notify', {
              count: props.count || 0,
            })}
          />
          <span className="t-body-s">
            {t('dlg.22.notify', {
              count: props.count || 0,
            })}
          </span>
        </label>
      </DialogFrame>
    );
  },
};
D['DLG-23'] = {
  comp: ({ props, close }) => {
    const [reason, setReason] = useState<any>(null);
    const [err, setErr] = useState('');
    const ev = sel().event(props.eventId);
    const n = ev ? sel().registeredCount(ev) + (ev.waitlistCount || 0) : 0;
    return (
      <DialogFrame
        id="DLG-23"
        title={t('dlg.23.title')}
        body={t('dlg.23.body', {
          count: n,
        })}
        onClose={close}
        danger
        icon="calendar-x"
        actions={[
          B(
            t('dlg.23.confirm'),
            'DLG-23.confirm',
            async () => {
              if (!reason) {
                setErr(t('auth.err.required'));
                return;
              }
              if (!ev || !app.guard(ev.clubId)) return;
              await A.cancelEvent(ev, reason);
              close();
              app.ui.closeAllSheets();
              app.toast('TST-48');
            },
            'danger',
          ),
          B(t('common.giveUp'), 'DLG-23.cancel', close, 'text'),
        ]}
      >
        <div
          className="col"
          style={{
            margin: '0 -12px',
          }}
        >
          {['weather', 'speaker', 'venue', 'other'].map((r) => (
            <OptionRow
              key={r}
              label={t('cancelReason.' + r)}
              checked={reason === r}
              action={'DLG-23.reason.' + r}
              onClick={() => {
                setReason(r);
                setErr('');
              }}
            />
          ))}
        </div>
        {err ? (
          <div className="field-help is-error" role="alert">
            <Icon name="triangle-alert" size={14} />
            <span>{err}</span>
          </div>
        ) : null}
      </DialogFrame>
    );
  },
};
D['DLG-24'] = simple('24', {
  icon: 'megaphone',
  actions: (p, close) => [
    B(t('dlg.24.silent'), 'DLG-24.silent', () => (p.onPublishSilent ? p.onPublishSilent() : close())),
    B(t('common.giveUp'), 'DLG-24.cancel', close, 'text'),
  ],
});
D['DLG-25'] = simple('25', {
  icon: 'triangle-alert',
  actions: (p, close) => [
    p.onSave ? B(t('common.save'), 'DLG-25.save', p.onSave) : null,
    B(t('dlg.25.discard'), 'DLG-25.discard', () => (p.onDiscard ? p.onDiscard() : close()), 'danger-outline'),
    B(t('dlg.25.keep'), 'DLG-25.keep', () => (p.onKeep ? p.onKeep() : close()), 'text'),
  ],
});
D['DLG-26'] = simple('26', {
  icon: 'download',
  dismissable: false,
  actions: (p, close) =>
    B(t('dlg.26.update'), 'DLG-26.update', () => {
      close();
      location.reload();
    }),
});
D['DLG-27'] = simple('27', {
  icon: 'lock',
  dismissable: false,
  actions: (p, close) =>
    B(t('auth.login.cta'), 'DLG-27.login', () => {
      close();
      void session.logout();
    }),
});
D['DLG-28'] = {
  comp: ({ props, close }) => {
    const club: any = sel().club(props.clubId) || {};
    const suspending = club.status === 'active';
    const [reason, setReason] = useState('');
    const [err, setErr] = useState('');
    return (
      <DialogFrame
        id="DLG-28"
        title={
          suspending
            ? t('dlg.28.title', {
                club: club.name,
              })
            : t('dlg.28.titleActivate', {
                club: club.name,
              })
        }
        body={suspending ? t('dlg.28.body') : t('dlg.28.bodyActivate')}
        onClose={close}
        danger={suspending}
        icon={suspending ? 'ban' : 'circle-check'}
        actions={[
          B(
            suspending ? t('adminClubs.suspend') : t('adminClubs.activate'),
            'DLG-28.confirm',
            async () => {
              if (suspending && !reason.trim()) {
                setErr(t('auth.err.required'));
                return;
              }
              if (!app.requireOnline()) return;
              if (props.group && suspending) await A.resolveReports(props.group, 'suspended');
              await A.setClubStatus(club.id, suspending, reason.trim());
              props.onDone && props.onDone();
              close();
              app.ui.closeAllSheets();
              app.toast('TST-50', {
                suspended: suspending,
              });
            },
            suspending ? 'danger' : 'primary',
          ),
          B(t('common.giveUp'), 'DLG-28.cancel', close, 'text'),
        ]}
      >
        {suspending ? (
          <Input
            label={t('dlg.28.reason')}
            value={reason}
            onInput={(v) => {
              setReason(v);
              setErr('');
            }}
            multiline
            rows={2}
            maxLength={200}
            error={err}
            action="DLG-28.reason"
            autofocus
          />
        ) : null}
      </DialogFrame>
    );
  },
};
D['DLG-29'] = simple('29', {
  danger: true,
  icon: 'trash-2',
  actions: (p, close) => [
    B(
      t('dlg.29.confirm'),
      'DLG-29.confirm',
      async () => {
        if (!app.requireOnline()) return;
        await A.resolveReports(p.group, 'removed');
        p.onDone && p.onDone();
        close();
        app.ui.closeAllSheets();
        app.toast('TST-51');
      },
      'danger',
    ),
    B(t('common.giveUp'), 'DLG-29.cancel', close, 'text'),
  ],
});
D['DLG-30'] = {
  comp: ({ props, close }) => {
    const usr: any = sel().user(props.userId) || {};
    const suspending = usr.status !== 'suspended';
    const [reason, setReason] = useState('');
    const [err, setErr] = useState('');
    return (
      <DialogFrame
        id="DLG-30"
        title={
          suspending
            ? t('dlg.30.title', {
                name: usr.name,
              })
            : t('dlg.30.titleUnsuspend', {
                name: usr.name,
              })
        }
        body={suspending ? t('dlg.30.body') : t('dlg.30.bodyUnsuspend')}
        onClose={close}
        danger={suspending}
        icon={suspending ? 'ban' : 'circle-check'}
        actions={[
          B(
            suspending ? t('adminUsers.suspend') : t('adminUsers.unsuspend'),
            'DLG-30.confirm',
            async () => {
              if (suspending && !reason.trim()) {
                setErr(t('auth.err.required'));
                return;
              }
              if (!app.requireOnline()) return;
              if (props.group && suspending) await A.resolveReports(props.group, 'suspended');
              await A.setUserStatus(props.userId, suspending, reason.trim());
              props.onDone && props.onDone();
              close();
              app.ui.closeAllSheets();
              app.toast('TST-52', {
                suspended: suspending,
              });
            },
            suspending ? 'danger' : 'primary',
          ),
          B(t('common.giveUp'), 'DLG-30.cancel', close, 'text'),
        ]}
      >
        {suspending ? (
          <Input
            label={t('dlg.28.reason')}
            value={reason}
            onInput={(v) => {
              setReason(v);
              setErr('');
            }}
            multiline
            rows={2}
            maxLength={200}
            error={err}
            action="DLG-30.reason"
            autofocus
          />
        ) : null}
      </DialogFrame>
    );
  },
};
D['DLG-31'] = simple('31', {
  danger: true,
  icon: 'trash-2',
  actions: (p, close) => [
    B(
      t('common.delete'),
      'DLG-31.confirm',
      async () => {
        const ev = sel().event(p.eventId);
        if (!ev || !app.guard(ev.clubId)) return;
        await A.deleteEvent(ev);
        close();
        app.ui.closeAllSheets();
        if (['EVT-02', 'MGT-05'].includes(app.nav.current().screen)) app.nav.back();
        app.toast('TST-45', {
          what: t('status.draft'),
          undo: () => A.restoreEvent(ev).catch(handleError),
        });
      },
      'danger',
    ),
    B(t('common.giveUp'), 'DLG-31.cancel', close, 'text'),
  ],
});
D['DLG-32'] = {
  comp: ({ props, close }) => (
    <DialogFrame
      id="DLG-32"
      title={t('dlg.32.title')}
      onClose={close}
      icon="external-link"
      actions={[
        B(t('common.open'), 'DLG-32.open', () => {
          close();
          try {
            if (String(props.url).startsWith('mailto:')) location.href = props.url;
            else window.open(props.url, '_blank', 'noopener,noreferrer');
          } catch {
            /* engellendi */
          }
        }),
        B(t('common.giveUp'), 'DLG-32.cancel', close, 'text'),
      ]}
    >
      <p className="t-body-s c-sec">
        {t('dlg.32.body1')} <span className="code break">{props.url}</span>
      </p>
      <p className="t-body-s c-sec">{t('dlg.32.body2')}</p>
    </DialogFrame>
  ),
};

/* ===== TOASTS ===== 58 toasts (+ extra variants TST-X*). Registry: TOASTS[id] = { kind, text(props), actionLabel(props) } */
const T = TOASTS;
const def = (id: string, kind: any, text: (p: any) => string, actionLabel?: (p: any) => string | null) => {
  T['TST-' + id] = {
    kind,
    text,
    actionLabel,
  };
};
const undo = () => t('common.undo');
def('01', 'error', () => t('tst.01'));
def('02', 'info', () => t('tst.02'));
def('03', 'success', () => t('tst.03'));
def('04', 'info', () => t('tst.04'));
def('05', 'success', (p) =>
  t('tst.05', {
    name: p.name || '',
  }),
);
def('06', 'info', () => t('tst.06'), undo);
def('07', 'success', () => t('tst.07'));
def('08', 'success', () => t('tst.08'));
def(
  '09',
  'info',
  (p) =>
    p.unblocked
      ? t('tst.09.unblocked', {
          name: p.name,
        })
      : t('tst.09.blocked', {
          name: p.name,
        }),
  undo,
);
def('10', 'info', () => t('tst.10'));
def('11', 'success', (p) => (p.saved ? t('tst.11.saved') : t('tst.11.removed')), undo);
def('12', 'success', () => t('tst.12'));
def('13', 'success', () => t('tst.13'));
def(
  '14',
  'success',
  () => t('tst.14'),
  () => t('common.view'),
);
def('15', 'success', () => t('tst.15'));
def('16', 'info', () => t('tst.16'), undo);
def('17', 'success', () => t('tst.17'));
def('18', 'success', () => t('tst.18'));
def('19', 'success', () => t('tst.19'));
def('20', 'info', () => t('tst.20'));
def('21', 'success', () => t('tst.21'));
def('22', 'success', () => t('tst.22'));
def('23', 'success', (p) =>
  t('tst.23', {
    no: p.no || '#GU-4821',
  }),
);
def('24', 'error', () => t('tst.24'));
def('25', 'success', () => t('tst.25'));
def('26', 'info', () => t('tst.26'));
def(
  '27',
  'success',
  (p) =>
    t('tst.27', {
      name: p.name,
    }),
  undo,
);
def(
  '28',
  'info',
  (p) =>
    t('tst.28', {
      name: p.name,
    }),
  undo,
);
def('29', 'success', () => t('tst.29'));
def(
  '30',
  'success',
  () => t('tst.30'),
  () => t('common.view'),
);
def(
  '31',
  'success',
  (p) =>
    t('tst.31', {
      name: p.name,
    }),
  undo,
);
def(
  '32',
  'error',
  () => t('tst.32'),
  () => t('scan.goSettings'),
);
def('33', 'success', () => t('tst.33'));
def(
  '34',
  'success',
  () => t('tst.34'),
  () => t('application.goClub'),
);
def('35', 'success', () => t('tst.35'));
def('36', 'success', () => t('tst.36'));
def('37', 'success', (p) => (p.off ? t('tst.37.off') : t('tst.37.set')));
def('38', 'success', () => t('tst.38'));
def('39', 'info', () => t('tst.39'));
def('40', 'info', () => t('tst.40'));
def(
  '41',
  'success',
  () => t('tst.41'),
  () => t('event.cta.ticket'),
);
def('42', 'info', () => t('tst.42'));
def('43', 'success', (p) =>
  t('tst.43', {
    n: p.n || 1,
  }),
);
def('44', 'success', () => t('tst.44'));
def(
  '45',
  'info',
  (p) =>
    t('tst.45', {
      what: p.what || '',
    }),
  undo,
);
def('46', 'success', (p) =>
  t('tst.46', {
    name: p.name,
    role: p.role,
  }),
);
def(
  '47',
  'info',
  (p) =>
    t('tst.47', {
      name: p.name,
    }),
  undo,
);
def('48', 'info', () => t('tst.48'));
def('49', 'success', (p) =>
  t('tst.49', {
    name: p.name,
  }),
);
def('50', 'info', (p) => (p.suspended ? t('tst.50.suspended') : t('tst.50.activated')));
def('51', 'success', () => t('tst.51'));
def('52', 'info', (p) => (p.suspended ? t('tst.52.suspended') : t('tst.52.unsuspended')));
def('53', 'success', (p) => (p.pinned ? t('tst.53.pinned') : t('tst.53.unpinned')));
def('54', 'info', (p) => (p.open ? t('tst.54.opened') : t('tst.54.closed')));
def(
  '55',
  'info',
  (p) =>
    t('tst.55', {
      title: p.title || '',
    }),
  () => t('common.view'),
);
def('56', 'info', () => t('tst.56'));
def('57', 'success', () => t('tst.57'));
def('58', 'info', (p) =>
  t('tst.58', {
    what: p.what || '',
  }),
);
// extra situational toasts (not part of the numbered catalog)
def('X40', 'error', (p) => p.text || t('web.err.generic'));
def('X1', 'info', () => t('tst.x1'));
def('X2', 'info', () => t('tst.x2'));
def('X3', 'info', (p) =>
  t('tst.x3', {
    s: p.s || 0,
  }),
);
def('X4', 'info', (p) =>
  t('tst.x4', {
    date: p.date || '',
  }),
);
def('X5', 'info', () => t('tst.x5'));
def('X6', 'info', () => t('tst.x6'));
def('X7', 'info', () => t('tst.x7'));
def('X8', 'info', (p) =>
  t('tst.x8', {
    count: p.count || 0,
  }),
);
def('X9', 'info', () => t('tst.x9'));
def('X10', 'info', () => t('tst.x10'));
def('X11', 'info', () => t('tst.x11'));
def('X12', 'info', () => t('tst.x12'));
def('X13', 'success', (p) =>
  t('tst.x13', {
    name: p.name || '',
  }),
);
def('X14', 'info', () => t('tst.x14'));
def('X15', 'info', (p) => (p.open ? t('tst.x15.opened') : t('tst.x15.closed')));
def('X16', 'info', () => t('tst.x16'));
def('X17', 'success', () => t('tst.x17'));
def('X18', 'info', () => t('tst.x18'));
def('X19', 'success', () => t('tst.x19'));
def('X20', 'info', () => t('tst.x20'));
export const TOAST_IDS = Object.keys(T).filter((k) => /^TST-\d{2}$/.test(k));
