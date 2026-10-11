import {
  ALLOWED_EMAIL_DOMAINS,
  AppBar,
  Avatar,
  Button,
  Checkbox,
  Chip,
  ErrorState,
  INTERESTS,
  Icon,
  IconButton,
  Illustration,
  Input,
  Logo,
  OfflineState,
  Picker,
  SCREENS,
  Scroll,
  Stepbar,
  StickyCTA,
  SuccessCheck,
  Tabs,
  app,
  cx,
  escapeHtml,
  useBusy,
  useCountdown,
  useEffect,
  useForm,
  useRef,
  useState,
  A,
  session,
  setPrefs,
  handleError,
} from '../ui/kit';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_ENABLED } from '../lib/demo';
import * as AU from '../data/repo/auth';
import { errCode } from '../data/fs';
/* ===== SCREENS: SYS · ONB · AUT ===== */
const t = (k: string, p?: any) => app.t(k, p);
const S = SCREENS;
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
const domainOk = (e) => ALLOWED_EMAIL_DOMAINS.some((d) => (e || '').toLowerCase().endsWith('@' + d));

/* SYS-01 Splash */
S['SYS-01'] = {
  tab: null,
  title: 'sys.splash.title',
  comp: function Splash() {
    return (
      <div className="splash" aria-busy="true">
        <Logo size={96} />
        <span
          className="t-title-l"
          style={{
            letterSpacing: '.04em',
          }}
        >
          {app.APP_NAME}
        </span>
        <span
          className="t-caption"
          style={{
            position: 'absolute',
            bottom: '40px',
          }}
        >
          v{app.APP_VERSION}
        </span>
      </div>
    );
  },
};
/* SYS-02 Error */
S['SYS-02'] = {
  tab: null,
  title: 'sys.error.title',
  comp: function ErrorScreen() {
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="SYS-02.back" title="" />
        <div
          className="screen-scroll col"
          style={{
            justifyContent: 'center',
          }}
        >
          <ErrorState
            onRetry={() => location.reload()}
            onHome={() => app.home()}
          />
        </div>
      </>
    );
  },
};
/* SYS-03 Offline */
S['SYS-03'] = {
  tab: null,
  title: 'sys.offline.title',
  comp: function OfflineScreen() {
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="SYS-03.back" title="" />
        <div
          className="screen-scroll col"
          style={{
            justifyContent: 'center',
          }}
        >
          <OfflineState onRetry={() => (app.online() ? app.nav.back() || app.home() : app.toast('TST-24'))} />
        </div>
      </>
    );
  },
};
/* SYS-04 Not found */
S['SYS-04'] = {
  tab: null,
  title: 'sys.notFound.title',
  comp: function NotFound() {
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="SYS-04.back" title="" />
        <div
          className="screen-scroll col"
          style={{
            justifyContent: 'center',
          }}
        >
          <div className="empty">
            <Illustration name="locked" />
            <h2 className="t-title-s">{t('sys.notFound.title')}</h2>
            <p
              className="t-body-s c-sec"
              style={{
                maxWidth: '280px',
              }}
            >
              {t('sys.notFound.desc')}
            </p>
            <div className="row gap8">
              <Button variant="outline" label={t('common.back')} action="SYS-04.back" onClick={() => app.nav.back() || app.home()} />
              <Button label={t('sys.error.home')} action="SYS-04.home" onClick={() => app.home()} />
            </div>
          </div>
        </div>
      </>
    );
  },
};

/* ONB-01 Onboarding */
S['ONB-01'] = {
  tab: null,
  title: 'onb.title',
  comp: function Onboarding() {
    const [i, setI] = useState(0);
    const ref = useRef<any>(null);
    const slides = ['discover', 'join', 'follow'];
    const go = (n) => {
      const el = ref.current;
      if (!el) return;
      el.scrollTo({
        left: n * el.clientWidth,
        behavior: 'smooth',
      });
      setI(n);
    };
    const finish = () => {
      setPrefs({ onboardingDone: true });
      app.nav.resetTo('AUT-01');
    };
    return (
      <>
        <div
          className="row between"
          style={{
            padding: '4px 8px 0 16px',
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            icon="languages"
            label={app.locale().toUpperCase()}
            action="ONB-01.lang"
            onClick={() =>
              app.openMenu('SHT-01', {
                popup: true,
              })
            }
          />
          <Button variant="text" size="sm" label={t('onb.skip')} action="ONB-01.skip" onClick={finish} />
        </div>
        <div
          className="onb-track"
          ref={ref}
          onScroll={(e) => {
            const el = e.currentTarget;
            const n = Math.round(el.scrollLeft / el.clientWidth);
            if (n !== i) setI(n);
          }}
          data-action="ONB-01.swipe"
        >
          {slides.map((s) => (
            <section key={s} aria-label={t('onb.' + s + '.title')}>
              <Illustration name={'onb-' + s} size={200} />
              <h1 className="t-display">{t('onb.' + s + '.title')}</h1>
              <p className="t-body-l c-sec">{t('onb.' + s + '.desc')}</p>
            </section>
          ))}
        </div>
        <div
          className="col gap16"
          style={{
            padding: '0 24px calc(var(--safe-bottom) + 16px)',
          }}
        >
          <div className="dots" aria-hidden="true">
            {slides.map((s, k) => (
              <i key={s} className={k === i ? 'is-active' : ''} />
            ))}
          </div>
          {i < 2 ? (
            <Button size="lg" full label={t('onb.next')} iconRight="arrow-right" action="ONB-01.next" onClick={() => go(i + 1)} />
          ) : (
            <Button size="lg" full label={t('onb.start')} action="ONB-01.start" onClick={finish} />
          )}
        </div>
      </>
    );
  },
};

/* AUT-01 Login */
S['AUT-01'] = {
  tab: null,
  title: 'auth.login.title',
  comp: function Login() {
    const [f, set] = useForm('login', {
      email: '',
      password: '',
      show: false,
      errors: {},
      demoOpen: true,
      shake: false,
    });
    const [busy, run] = useBusy();
    const locked = useCountdown(f.email ? AU.lockedUntil(f.email) : null);
    const validate = () => {
      const e: any = {};
      if (!f.email) e.email = t('auth.err.required');
      else if (!emailOk(f.email)) e.email = t('auth.err.email');
      else if (!domainOk(f.email)) e.email = t('auth.err.domain');
      if (!f.password) e.password = t('auth.err.required');
      else if (f.password.length < 8) e.password = t('auth.err.password');
      set({
        errors: e,
      });
      if (Object.keys(e).length) {
        const first = document.getElementById(e.email ? 'login-email' : 'login-password');
        first && first.focus();
        return false;
      }
      return true;
    };
    const fail = (msg) => {
      set({ errors: { password: msg }, shake: true });
      setTimeout(() => set({ shake: false }), 450);
    };
    const login = (email, password) =>
      run(async () => {
        if (AU.lockedUntil(email)) {
          app.openDialog('DLG-02', { until: AU.lockedUntil(email), email });
          return;
        }
        if (!app.requireOnline()) return;
        try {
          await AU.signIn(email, password);
          set({ errors: {}, password: '' });
          // yönlendirme oturum dinleyicisinden gelir (doğrulama / profil / uygulama)
        } catch (e) {
          const c = errCode(e);
          if (c === 'wrongCredentials') {
            fail(t('auth.err.wrong'));
            app.toast('TST-01');
          } else if (c === 'lockedOut') {
            fail(t('auth.err.wrong'));
            app.openDialog('DLG-02', { until: AU.lockedUntil(email), email });
          } else if (c === 'domainNotAllowed') set({ errors: { email: t('auth.err.domain') } });
          else if (c === 'userDisabled') app.openDialog('DLG-01');
          else handleError(e);
        }
      });
    const demo = (acc) => {
      set({
        email: acc.email,
        password: DEMO_PASSWORD,
        errors: {},
      });
      setTimeout(() => login(acc.email, DEMO_PASSWORD), 300);
    };
    return (
      <Scroll routeKey="login">
        <div
          className="row end"
          style={{
            padding: '4px 8px 0',
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            icon="languages"
            iconRight="chevron-down"
            label={app.locale().toUpperCase()}
            action="AUT-01.lang"
            onClick={() =>
              app.openMenu('SHT-01', {
                popup: true,
              })
            }
          />
        </div>
        <div
          className="col gap8 center"
          style={{
            padding: '8px 24px 24px',
            alignItems: 'center',
          }}
        >
          <Logo size={72} />
          <h1 className="t-display mt8">{t('auth.login.welcome')}</h1>
          <p className="t-body-m c-sec">{t('app.tagline')}</p>
        </div>
        <form
          className={cx('col gap16 px16', f.shake && 'shake')}
          onSubmit={(e) => {
            e.preventDefault();
            if (validate()) login(f.email, f.password);
          }}
          data-action="AUT-01.form"
        >
          <Input
            id="login-email"
            label={t('auth.email')}
            type="email"
            inputMode="email"
            icon="mail"
            value={f.email}
            onInput={(v) =>
              set({
                email: v,
              })
            }
            placeholder="ad.soyad@ogr.gumushane.edu.tr"
            error={f.errors.email}
            action="AUT-01.email"
            autofocus
          />
          <Input
            id="login-password"
            label={t('auth.password')}
            type={f.show ? 'text' : 'password'}
            icon="key-round"
            value={f.password}
            onInput={(v) =>
              set({
                password: v,
              })
            }
            error={f.errors.password}
            action="AUT-01.password"
            onEnter={() => validate() && login(f.email, f.password)}
            trailing={
              <IconButton
                small
                icon={f.show ? 'eye-off' : 'eye'}
                label={f.show ? t('auth.hidePassword') : t('auth.showPassword')}
                action="AUT-01.togglePassword"
                onClick={() =>
                  set({
                    show: !f.show,
                  })
                }
              />
            }
          />
          <div
            className="row end"
            style={{
              marginTop: '-8px',
            }}
          >
            <Button variant="text" size="sm" label={t('auth.forgot')} action="AUT-01.forgot" onClick={() => app.nav.push('AUT-04', { email: f.email })} />
          </div>
          <Button
            size="lg"
            full
            label={
              locked > 0
                ? t('auth.lockedFor', {
                    s: locked,
                  })
                : t('auth.login.cta')
            }
            loading={busy}
            disabled={locked > 0}
            action="AUT-01.login"
            onClick={() => validate() && login(f.email, f.password)}
            onDisabledClick={() => app.openDialog('DLG-02', { until: AU.lockedUntil(f.email), email: f.email })}
          />
          <p className="t-body-s c-sec center">
            {t('auth.noAccount')}{' '}
            <button type="button" className="c-brand bold" data-action="AUT-01.register" onClick={() => app.nav.push('AUT-02')}>
              {t('auth.register.cta')}
            </button>
          </p>
        </form>
        {DEMO_ENABLED ? (
        <div className="px16 mt24">
          <button
            type="button"
            className="row between"
            style={{
              width: '100%',
              padding: '12px 4px',
            }}
            aria-expanded={f.demoOpen ? 'true' : 'false'}
            data-action="AUT-01.demoToggle"
            onClick={() =>
              set({
                demoOpen: !f.demoOpen,
              })
            }
          >
            <span className="t-overline">{t('auth.demoAccounts')}</span>
            <Icon name={f.demoOpen ? 'chevron-up' : 'chevron-down'} size={18} class="c-muted" />
          </button>
          {f.demoOpen ? (
            <div className="col gap8">
              {DEMO_ACCOUNTS.map((acc) => {
                const u = { id: acc.id, name: acc.name, avatarSeed: acc.id, avatarPath: null };
                return (
                  <button type="button" key={acc.id} className="account-row pressable" data-action={'AUT-01.demoAccount.' + acc.id} onClick={() => demo(acc)}>
                    <Avatar user={u} size={36} />
                    <span className="flex1 col">
                      <span className="t-label-l c-heading ellipsis">{u.name}</span>
                      <span className="t-caption">
                        {t(acc.roleKey)}
                        {' \xB7 '}
                        {t(acc.descKey)}
                      </span>
                    </span>
                    <Icon name="log-in" size={18} class="c-muted" />
                  </button>
                );
              })}
              <p className="t-caption center">
                {t('auth.demoPassword')}
                {': '}
                <span className="code">{DEMO_PASSWORD}</span>
              </p>
            </div>
          ) : null}
        </div>
        ) : null}
        <p
          className="t-caption center"
          style={{
            padding: '24px 24px 8px',
          }}
        >
          {t('auth.legalPrefix')}{' '}
          <button
            type="button"
            className="c-brand"
            data-action="AUT-01.terms"
            onClick={() =>
              app.nav.push('AUT-06', {
                tab: 'kosullar',
              })
            }
          >
            {t('legal.kosullar.title')}
          </button>{' '}
          {t('common.and')}{' '}
          <button
            type="button"
            className="c-brand"
            data-action="AUT-01.privacy"
            onClick={() =>
              app.nav.push('AUT-06', {
                tab: 'gizlilik',
              })
            }
          >
            {t('legal.gizlilik.title')}
          </button>{' '}
          {t('auth.legalSuffix')}
        </p>
      </Scroll>
    );
  },
};

/* AUT-02 Register */
const strength = (p) => [p.length >= 8, /[A-ZĞÜŞİÖÇ]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
S['AUT-02'] = {
  tab: null,
  title: 'auth.register.title',
  comp: function Register() {
    const [f, set] = useForm('register', {
      name: '',
      email: '',
      password: '',
      password2: '',
      show: false,
      legal: false,
      errors: {},
    });
    const [busy, run] = useBusy();
    const st = strength(f.password);
    const rules: Array<[boolean, string]> = [
      [f.password.length >= 8, t('auth.rule.len')],
      [/[A-ZĞÜŞİÖÇ]/.test(f.password), t('auth.rule.upper')],
      [/\d/.test(f.password), t('auth.rule.digit')],
    ];
    const submit = () =>
      run(async () => {
        const e: any = {};
        if (!f.name.trim()) e.name = t('auth.err.required');
        if (!f.email) e.email = t('auth.err.required');
        else if (!emailOk(f.email)) e.email = t('auth.err.email');
        else if (!domainOk(f.email)) e.email = t('auth.err.domain');
        if (st < 3) e.password = t('auth.err.password');
        if (f.password2 !== f.password) e.password2 = t('auth.err.mismatch');
        if (!f.legal) e.legal = t('auth.err.legal');
        set({
          errors: e,
        });
        if (Object.keys(e).length) {
          const id = Object.keys(e)[0];
          const el = document.getElementById('reg-' + id);
          el && el.focus();
          return;
        }
        if (!app.requireOnline()) return;
        try {
          delete app.forms.data.verify;
          await AU.register(f.name.trim(), f.email.trim(), f.password);
          // oturum dinleyicisi doğrulanmamış kullanıcıyı AUT-03'e yönlendirir
        } catch (err) {
          const c = errCode(err);
          if (c === 'emailExists') set({ errors: { email: t('auth.err.exists') } });
          else if (c === 'domainNotAllowed') set({ errors: { email: t('auth.err.domain') } });
          else if (c === 'weakPassword') set({ errors: { password: t('web.err.weakPassword') } });
          else handleError(err);
        }
      });
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="AUT-02.back" title={t('auth.register.title')}>
          <Button
            variant="ghost"
            size="sm"
            icon="languages"
            label={app.locale().toUpperCase()}
            action="AUT-02.lang"
            onClick={() =>
              app.openMenu('SHT-01', {
                popup: true,
              })
            }
          />
        </AppBar>
        <Scroll routeKey="register">
          <form
            className="col gap16 px16 pt8"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            data-action="AUT-02.form"
          >
            <Input
              id="reg-name"
              label={t('auth.fullName')}
              icon="user"
              value={f.name}
              onInput={(v) =>
                set({
                  name: v,
                })
              }
              error={f.errors.name}
              action="AUT-02.name"
              autofocus
            />
            <Input
              id="reg-email"
              label={t('auth.uniEmail')}
              type="email"
              inputMode="email"
              icon="mail"
              value={f.email}
              onInput={(v) =>
                set({
                  email: v,
                })
              }
              help={t('auth.register.emailHelp')}
              error={f.errors.email}
              action="AUT-02.email"
              placeholder="ad.soyad@ogr.gumushane.edu.tr"
            />
            <div className="col gap8">
              <Input
                id="reg-password"
                label={t('auth.password')}
                type={f.show ? 'text' : 'password'}
                icon="key-round"
                value={f.password}
                onInput={(v) =>
                  set({
                    password: v,
                  })
                }
                error={f.errors.password}
                action="AUT-02.password"
                trailing={
                  <IconButton
                    small
                    icon={f.show ? 'eye-off' : 'eye'}
                    label={f.show ? t('auth.hidePassword') : t('auth.showPassword')}
                    action="AUT-02.togglePassword"
                    onClick={() =>
                      set({
                        show: !f.show,
                      })
                    }
                  />
                }
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
              <ul
                className="col gap4"
                style={{
                  listStyle: 'none',
                  padding: '0',
                }}
              >
                {rules.map(([ok, label]) => (
                  <li key={label} className={cx('row gap6 t-body-s', ok ? 'c-success' : 'c-muted')}>
                    <Icon name={ok ? 'circle-check' : 'circle-x'} size={14} />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <Input
              id="reg-password2"
              label={t('auth.passwordRepeat')}
              type={f.show ? 'text' : 'password'}
              icon="key-round"
              value={f.password2}
              onInput={(v) =>
                set({
                  password2: v,
                })
              }
              error={f.errors.password2}
              action="AUT-02.password2"
            />
            <div className="col gap6">
              <div
                className="row gap12 start"
                style={{
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    paddingTop: '2px',
                  }}
                  id="reg-legal"
                >
                  <Checkbox
                    checked={f.legal}
                    onChange={(v) =>
                      set({
                        legal: v,
                      })
                    }
                    action="AUT-02.legalCheck"
                    label={t('auth.legalCheck')}
                  />
                </div>
                <p className="t-body-s c-sec flex1">
                  <button
                    type="button"
                    className="c-brand"
                    data-action="AUT-02.legal"
                    onClick={() =>
                      app.nav.push('AUT-06', {
                        tab: 'kvkk',
                        from: 'register',
                      })
                    }
                  >
                    {t('legal.kvkk.title')}
                  </button>{' '}
                  {t('common.and')}{' '}
                  <button
                    type="button"
                    className="c-brand"
                    data-action="AUT-02.legalPrivacy"
                    onClick={() =>
                      app.nav.push('AUT-06', {
                        tab: 'gizlilik',
                        from: 'register',
                      })
                    }
                  >
                    {t('legal.gizlilik.title')}
                  </button>{' '}
                  {t('auth.legalCheck')}
                </p>
              </div>
              {f.errors.legal ? (
                <div className="field-help is-error" role="alert">
                  <Icon name="triangle-alert" size={14} />
                  <span>{f.errors.legal}</span>
                </div>
              ) : null}
            </div>
            <Button size="lg" full label={t('auth.register.submit')} loading={busy} action="AUT-02.submit" onClick={submit} />
            <p className="t-body-s c-sec center">
              {t('auth.haveAccount')}{' '}
              <button type="button" className="c-brand bold" data-action="AUT-02.toLogin" onClick={() => app.nav.resetTo('AUT-01')}>
                {t('auth.login.cta')}
              </button>
            </p>
          </form>
        </Scroll>
      </>
    );
  },
};

/* AUT-03 Verify email */
S['AUT-03'] = {
  tab: null,
  title: 'auth.verify.title',
  comp: function Verify() {
    const email = session.s.email;
    const [f, set] = useForm('verify', {
      changing: false,
      newEmail: '',
      done: false,
      err: '',
      changedTo: '',
      resendAt: AU.resendAvailableAt(),
    });
    const [busy, run] = useBusy();
    const [sending, runSend] = useBusy();
    const left = useCountdown(f.resendAt);
    // sekmeye dönüldüğünde (e-postadaki bağlantı tıklandıktan sonra) sessizce yeniden denetle
    useEffect(() => {
      const onVis = () => {
        if (document.visibilityState === 'visible' && !f.done) AU.checkVerified().then((ok) => ok && success()).catch(() => undefined);
      };
      document.addEventListener('visibilitychange', onVis);
      return () => document.removeEventListener('visibilitychange', onVis);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [f.done]);
    const success = () => {
      set({ done: true });
      setTimeout(() => {
        delete app.forms.data.verify;
        void session.route();
      }, 1100);
    };
    const confirm = () =>
      run(async () => {
        if (!app.requireOnline()) return;
        const ok = await AU.checkVerified();
        if (!ok) {
          app.toast('TST-02');
          return;
        }
        success();
      });
    const resend = () =>
      runSend(async () => {
        if (!app.requireOnline()) return;
        try {
          await AU.sendVerification();
          set({ resendAt: AU.resendAvailableAt() });
          app.toast('TST-03');
        } catch (e) {
          if (errCode(e) === 'resendCooldown') {
            set({ resendAt: AU.resendAvailableAt() });
            return;
          }
          throw e;
        }
      });
    const changeEmail = () =>
      runSend(async () => {
        const ne = f.newEmail.trim();
        if (!emailOk(ne) || !domainOk(ne)) {
          set({ err: t('auth.err.domain') });
          return;
        }
        if (!app.requireOnline()) return;
        try {
          await AU.changeUnverifiedEmail(ne);
          set({ changing: false, newEmail: '', changedTo: ne });
          app.toast('TST-03');
        } catch (e) {
          const c = errCode(e);
          if (c === 'emailExists') set({ err: t('auth.err.exists') });
          else if (c === 'requiresRecentLogin') set({ err: t('web.err.recentLogin') });
          else throw e;
        }
      });
    if (!email)
      return (
        <div className="empty">
          <Button label={t('auth.login.cta')} action="AUT-03.toLogin" onClick={() => app.nav.resetTo('AUT-01')} />
        </div>
      );
    return (
      <Scroll routeKey="verify">
        <div
          className="col gap16 center"
          style={{
            padding: '40px 24px 24px',
            alignItems: 'center',
          }}
        >
          {f.done ? <SuccessCheck /> : <Illustration name="email-verify" size={160} />}
          <h1 className="t-title-l">{f.done ? t('auth.verify.success') : t('auth.verify.title')}</h1>
          <p
            className="t-body-m c-sec"
            dangerouslySetInnerHTML={{
              __html: t('auth.verify.desc', {
                email: `<b>${escapeHtml(email)}</b>`,
              }),
            }}
          />
          {f.changedTo ? (
            <p className="t-body-s c-sec" role="status">
              {t('web.verify.changeSent', { email: f.changedTo })}
            </p>
          ) : null}
          {f.done ? null : (
            <div
              className="col gap12"
              style={{
                width: '100%',
              }}
            >
              <Button size="lg" full label={t('auth.verify.confirm')} loading={busy} action="AUT-03.confirm" onClick={confirm} />
              <Button
                variant="outline"
                full
                label={
                  left > 0
                    ? t('auth.resendIn', {
                        s: left,
                      })
                    : t('auth.resend')
                }
                loading={sending && !f.changing}
                disabled={left > 0}
                action="AUT-03.resend"
                onClick={resend}
                onDisabledClick={() =>
                  app.toast('TST-X3', {
                    s: left,
                  })
                }
              />
              {f.changing ? (
                <div
                  className="row gap8 start"
                  style={{
                    alignItems: 'flex-end',
                  }}
                >
                  <div className="flex1">
                    <Input
                      label={t('auth.newEmail')}
                      type="email"
                      value={f.newEmail}
                      onInput={(v) =>
                        set({
                          newEmail: v,
                          err: '',
                        })
                      }
                      onEnter={changeEmail}
                      error={f.err}
                      action="AUT-03.newEmail"
                      autofocus
                    />
                  </div>
                  <Button label={t('common.update')} loading={sending} action="AUT-03.updateEmail" onClick={changeEmail} />
                </div>
              ) : (
                <Button
                  variant="text"
                  label={t('auth.changeEmail')}
                  action="AUT-03.changeEmail"
                  onClick={() =>
                    set({
                      changing: true,
                    })
                  }
                />
              )}
              <Button variant="text" label={t('auth.logout')} action="AUT-03.logout" onClick={() => app.openDialog('DLG-06')} />
            </div>
          )}
        </div>
      </Scroll>
    );
  },
};

/* AUT-04 Reset password */
S['AUT-04'] = {
  tab: null,
  title: 'auth.reset.title',
  comp: function Reset({ params }: any) {
    const [f, set] = useForm('reset', {
      email: params.email || '',
      sent: false,
      err: '',
      resendAt: 0,
    });
    const [busy, run] = useBusy();
    const left = useCountdown(f.resendAt);
    const send = () =>
      run(async () => {
        if (!f.email) {
          set({
            err: t('auth.err.required'),
          });
          return;
        }
        if (!emailOk(f.email)) {
          set({
            err: t('auth.err.email'),
          });
          return;
        }
        if (!app.requireOnline()) return;
        await AU.resetPassword(f.email);
        set({
          sent: true,
          err: '',
          resendAt: Date.now() + 60000,
        });
      });
    return (
      <>
        <AppBar onBack={() => app.nav.back()} backAction="AUT-04.back" title={t('auth.reset.title')} />
        <Scroll routeKey="reset">
          <div className="col gap16 px16 pt16">
            {f.sent ? (
              <div
                className="col gap12 center"
                style={{
                  alignItems: 'center',
                  paddingTop: '24px',
                }}
              >
                <SuccessCheck />
                <h2 className="t-title-m">{t('auth.reset.sentTitle')}</h2>
                <p className="t-body-m c-sec">
                  {t('auth.reset.sentDesc', {
                    email: f.email,
                  })}
                </p>
                <Button
                  size="lg"
                  full
                  label={t('auth.reset.toLogin')}
                  action="AUT-04.toLogin"
                  onClick={() => {
                    delete app.forms.data.reset;
                    app.nav.resetTo('AUT-01');
                  }}
                />
                <Button
                  variant="text"
                  label={
                    left > 0
                      ? t('auth.resendIn', {
                          s: left,
                        })
                      : t('auth.resend')
                  }
                  disabled={left > 0}
                  action="AUT-04.resend"
                  loading={busy}
                  onClick={() =>
                    run(async () => {
                      if (!app.requireOnline()) return;
                      await AU.resetPassword(f.email);
                      set({
                        resendAt: Date.now() + 60000,
                      });
                      app.toast('TST-03');
                    })
                  }
                  onDisabledClick={() =>
                    app.toast('TST-X3', {
                      s: left,
                    })
                  }
                />
              </div>
            ) : (
              <>
                <p className="t-body-m c-sec">{t('auth.reset.desc')}</p>
                <Input
                  label={t('auth.uniEmail')}
                  type="email"
                  icon="mail"
                  value={f.email}
                  onInput={(v) =>
                    set({
                      email: v,
                      err: '',
                    })
                  }
                  error={f.err}
                  action="AUT-04.email"
                  autofocus
                  onEnter={send}
                />
                <Button size="lg" full label={t('auth.reset.send')} loading={busy} action="AUT-04.send" onClick={send} />
              </>
            )}
          </div>
        </Scroll>
      </>
    );
  },
};

/* AUT-05 Setup profile */
S['AUT-05'] = {
  tab: null,
  title: 'auth.setup.title',
  comp: function Setup() {
    const me = app.me();
    const [f, set] = useForm('setup', {
      step: 1,
      photo: false,
      department: null,
      year: null,
      interests: [],
      errors: {},
    });
    const [busy, run] = useBusy();
    if (!me)
      return (
        <div className="empty">
          <Button label={t('auth.login.cta')} action="AUT-05.toLogin" onClick={() => app.nav.resetTo('AUT-01')} />
        </div>
      );
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
    const next = () => {
      if (f.step === 2) {
        const e: any = {};
        if (!f.department) e.department = t('auth.err.required');
        if (!f.year) e.year = t('auth.err.required');
        set({
          errors: e,
        });
        if (Object.keys(e).length) return;
      }
      if (f.step === 3) {
        if (!f.interests.length) {
          set({
            errors: {
              interests: t('auth.setup.minInterest'),
            },
          });
          return;
        }
        finish();
        return;
      }
      set({
        step: f.step + 1,
        errors: {},
      });
    };
    const finish = () =>
      run(async () => {
        if (!app.requireOnline()) return;
        await A.updateProfile({
          department: f.department,
          year: f.year,
          interests: f.interests,
          profileComplete: true,
        });
        delete app.forms.data.setup;
        app.toast('TST-05', {
          name: me.name.split(' ')[0],
        });
        await session.route(undefined, { first: true });
      });
    return (
      <>
        <AppBar
          onBack={() =>
            app.openDialog('DLG-25', {
              onDiscard: () => {
                app.closeDialog();
                void session.logout();
              },
              onKeep: () => app.closeDialog(),
            })
          }
          backAction="AUT-05.close"
          closeIcon
          titleNode={
            <div className="col gap6">
              <span className="t-caption">
                {t('auth.setup.progress', {
                  step: f.step,
                  total: 3,
                })}
              </span>
              <Stepbar step={f.step} total={3} />
            </div>
          }
        />
        <Scroll routeKey="setup">
          <div className="col gap16 px16 pt16">
            {f.step === 1 ? (
              <>
                <h1 className="t-title-l">{t('auth.setup.photoTitle')}</h1>
                <p className="t-body-m c-sec">{t('auth.setup.photoDesc')}</p>
                <div
                  className="col gap12 center"
                  style={{
                    alignItems: 'center',
                    padding: '16px 0',
                  }}
                >
                  <Avatar user={me} size={120} />
                  {f.photo ? (
                    <span className="badge badge-success">
                      <Icon name="circle-check" size={12} />
                      {t('auth.setup.photoAdded')}
                    </span>
                  ) : null}
                  <Button
                    variant="tonal"
                    icon="camera"
                    label={t('auth.setup.addPhoto')}
                    action="AUT-05.photo"
                    onClick={() =>
                      app.openSheet('SHT-16', {
                        onPick: (file) =>
                          run(async () => {
                            await A.uploadAvatar(file);
                            set({
                              photo: true,
                            });
                          }),
                      })
                    }
                  />
                  <Button
                    variant="text"
                    label={t('auth.setup.skipPhoto')}
                    action="AUT-05.skipPhoto"
                    onClick={() =>
                      set({
                        step: 2,
                      })
                    }
                  />
                </div>
              </>
            ) : null}
            {f.step === 2 ? (
              <>
                <h1 className="t-title-l">{t('auth.setup.eduTitle')}</h1>
                <p className="t-body-m c-sec">{t('auth.setup.eduDesc')}</p>
                <Picker
                  label={t('profile.department')}
                  icon="graduation-cap"
                  value={f.department ? t('dept.' + f.department) : ''}
                  placeholder={t('common.select')}
                  error={f.errors.department}
                  action="AUT-05.department"
                  onClick={() =>
                    app.openSheet('SHT-02', {
                      value: f.department,
                      onSelect: (id) =>
                        set({
                          department: id,
                          errors: {
                            ...f.errors,
                            department: null,
                          },
                        }),
                    })
                  }
                />
                <Picker
                  label={t('profile.year')}
                  icon="calendar-days"
                  value={f.year ? t('year.' + f.year) : ''}
                  placeholder={t('common.select')}
                  error={f.errors.year}
                  action="AUT-05.year"
                  onClick={() =>
                    app.openSheet('SHT-03', {
                      value: f.year,
                      onSelect: (id) =>
                        set({
                          year: id,
                          errors: {
                            ...f.errors,
                            year: null,
                          },
                        }),
                    })
                  }
                />
              </>
            ) : null}
            {f.step === 3
              ? [
                  <div key="h" className="row between">
                    <h1 className="t-title-l">{t('auth.setup.interestTitle')}</h1>
                    <span className="t-label-l tnum c-muted">{f.interests.length}/5</span>
                  </div>,
                  <p key="d" className="t-body-m c-sec">{t('auth.setup.interestDesc')}</p>,
                  <div key="c" className="row wrap gap8">
                    {INTERESTS.map((i) => (
                      <Chip
                        key={i.id}
                        label={t('interest.' + i.id)}
                        selected={f.interests.includes(i.id)}
                        action={'AUT-05.toggleInterest.' + i.id}
                        onClick={() => toggle(i.id)}
                      />
                    ))}
                  </div>,
                  f.errors.interests ? (
                    <div key="e" className="field-help is-error" role="alert">
                      <Icon name="triangle-alert" size={14} />
                      <span>{f.errors.interests}</span>
                    </div>
                  ) : null,
                ]
              : null}
          </div>
        </Scroll>
        <StickyCTA>
          {f.step > 1 ? (
            <Button
              variant="outline"
              label={t('common.back')}
              action="AUT-05.back"
              onClick={() =>
                set({
                  step: f.step - 1,
                  errors: {},
                })
              }
            />
          ) : null}
          <Button
            label={f.step === 3 ? t('common.finish') : t('common.continue')}
            loading={busy}
            action={f.step === 3 ? 'AUT-05.finish' : 'AUT-05.next'}
            onClick={next}
          />
        </StickyCTA>
      </>
    );
  },
};

/* AUT-06 Legal */
S['AUT-06'] = {
  tab: null,
  title: 'legal.title',
  comp: function Legal({ params }: any) {
    const [tab, setTab] = useState(params.tab || 'kvkk');
    const ref = useRef<any>(null);
    const items = [1, 2, 3, 4, 5, 6, 7];
    const jump = (n) => {
      const el = ref.current && ref.current.querySelector(`#legal-${tab}-${n}`);
      const sc = ref.current && ref.current.querySelector('.screen-scroll');
      if (el && sc)
        sc.scrollTo({
          top: el.offsetTop - 120,
          behavior: 'smooth',
        });
    };
    const accept = () => {
      const reg = app.forms.data.register;
      if (reg)
        app.forms.data.register = {
          ...reg,
          legal: true,
          errors: {
            ...(reg.errors || {}),
            legal: null,
          },
        };
      app.nav.back();
    };
    return (
      <div
        ref={ref}
        className="col flex1"
        style={{
          minHeight: '0',
        }}
      >
        <AppBar onBack={() => app.nav.back()} backAction="AUT-06.back" title={t('legal.title')} />
        <Tabs
          tabs={['kvkk', 'gizlilik', 'kosullar'].map((id) => ({
            id,
            label: t('legal.' + id + '.short'),
          }))}
          value={tab}
          onChange={(v) => setTab(v)}
          action="AUT-06.tab"
        />
        <div
          className="hscroll py8"
          style={{
            flex: 'none',
          }}
        >
          {items.map((n) => (
            <Chip key={n} label={`${n}. ${t(`legal.${tab}.h${n}`)}`} action={'AUT-06.jump.' + n} onClick={() => jump(n)} />
          ))}
        </div>
        <Scroll routeKey={'legal-' + tab}>
          <div className="col gap16 px16 pb16">
            <h1 className="t-title-l">{t('legal.' + tab + '.title')}</h1>
            <p className="t-caption">{t('legal.updated')}</p>
            {items.map((n) => (
              <section key={n} id={`legal-${tab}-${n}`} className="col gap4">
                <h2 className="t-title-s">
                  {n}
                  {'. '}
                  {t(`legal.${tab}.h${n}`)}
                </h2>
                <p className="t-body-m c-sec">{t(`legal.${tab}.b${n}`)}</p>
              </section>
            ))}
          </div>
        </Scroll>
        {params.from === 'register' ? (
          <StickyCTA>
            <Button full label={t('legal.accept')} action="AUT-06.accept" onClick={accept} />
          </StickyCTA>
        ) : null}
      </div>
    );
  },
};
