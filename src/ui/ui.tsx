/* Ortak arayüz bileşenleri — tasarım prototipi ui.js'nin React karşılığı. Her etkileşimli öğe data-action taşır. */
import { Children, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { app, useFocusTrap } from '../app/app';
import { t } from '../i18n';
import { cx, dayKey, startOfDay } from '../lib/util';
import { sx } from '../lib/sx';
import { Icon } from './Icon';
import { Avatar, Illustration } from './art';
import type { LoadStatus } from '../app/data';

/* ===== COMPONENTS ===== shared UI primitives. Every interactive element carries data-action. */
const act = (a) => a || 'UNSET';
function Spinner({ size = 20 }: any) {
  return (
    <span
      className="spinner"
      style={{
        width: size + 'px',
        height: size + 'px',
      }}
      role="status"
      aria-label={t('common.loading')}
    />
  );
}
function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  iconOnly,
  loading,
  disabled,
  full,
  action,
  label,
  children,
  onClick,
  onDisabledClick,
  class: cls,
  style,
  autofocus,
  title,
  forceState,
}: any) {
  const isDis = !!disabled;
  const handle = (e) => {
    if (loading) return;
    if (isDis) {
      if (onDisabledClick) onDisabledClick(e);
      return;
    }
    if (onClick) onClick(e);
  };
  const vcls =
    {
      primary: 'btn-primary',
      tonal: 'btn-tonal',
      outline: 'btn-outline',
      text: 'btn-text',
      'danger-outline': 'btn-danger-outline',
      danger: 'btn-danger',
      ghost: 'btn-ghost',
    }[variant] || 'btn-primary';
  return (
    <button
      type="button"
      className={cx(
        'btn',
        vcls,
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        full && 'btn-full',
        loading && 'is-loading',
        forceState && 'is-' + forceState,
        cls,
      )}
      style={sx(style)}
      aria-disabled={isDis ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      aria-label={iconOnly ? label : undefined}
      title={title}
      data-action={act(action)}
      onClick={handle}
      data-autofocus={autofocus ? '1' : undefined}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 18 : 20} /> : null}
      {iconOnly ? null : (
        <span className="btn-label">
          {label}
          {children}
        </span>
      )}
      {iconRight ? <Icon name={iconRight} size={18} /> : null}
      {loading ? <Spinner /> : null}
    </button>
  );
}
function IconButton({ icon, label, action, onClick, size = 24, badge, onCover, disabled, class: cls, brand, small, style, onDisabledClick, autofocus }: any) {
  const handle = (e) => {
    if (disabled) {
      if (onDisabledClick) onDisabledClick(e);
      return;
    }
    if (onClick) onClick(e);
  };
  return (
    <button
      type="button"
      className={cx('iconbtn', onCover && 'on-cover', brand && 'is-brand', small && 'is-sm', cls)}
      style={sx(style)}
      aria-label={label}
      title={label}
      aria-disabled={disabled ? 'true' : undefined}
      data-action={act(action)}
      onClick={handle}
      data-autofocus={autofocus ? '1' : undefined}
    >
      <Icon name={icon} size={size} />
      {badge ? <span className="dot-badge">{badge > 9 ? '9+' : badge}</span> : null}
    </button>
  );
}
function Input({
  label,
  value,
  onInput,
  type = 'text',
  placeholder,
  help,
  error,
  icon,
  trailing,
  multiline,
  maxLength,
  counter,
  action,
  readOnly,
  locked,
  autofocus,
  id,
  onEnter,
  rows,
  disabled,
  onClick,
  inputMode,
  name,
  ariaLabel,
}: any) {
  const over = maxLength && value && value.length > maxLength;
  const showCounter = counter && maxLength && (value || '').length >= (counter === true ? Math.floor(maxLength * 0.8) : counter);
  const common: any = {
    value: value || '',
    placeholder,
    onInput: (e) => onInput && onInput(e.target.value),
    'data-action': act(action),
    readOnly: readOnly || locked,
    disabled,
    id,
    'aria-label': ariaLabel || label,
    'aria-invalid': error ? 'true' : undefined,
    maxLength: maxLength ? maxLength + 20 : undefined,
    'data-autofocus': autofocus ? '1' : undefined,
    onKeyDown: (e) => {
      if (e.key === 'Enter' && onEnter && !multiline) {
        e.preventDefault();
        onEnter();
      }
    },
    name,
    inputMode,
    onClick,
  };
  return (
    <div className="field">
      {label ? (
        <label className="field-label" htmlFor={id}>
          <span>{label}</span>
          {showCounter ? (
            <span className={cx('field-counter', over && 'is-over')}>
              {(value || '').length}/{maxLength}
            </span>
          ) : null}
        </label>
      ) : null}
      <div className={cx('input', multiline && 'is-multiline', error && 'is-error', (readOnly || locked) && 'is-readonly', disabled && 'is-disabled')}>
        {icon ? (
          <span className="in-icon">
            <Icon name={icon} size={20} />
          </span>
        ) : null}
        {multiline ? <textarea rows={rows || 4} {...common} /> : <input type={type} {...common} />}
        {locked ? (
          <span className="in-icon">
            <Icon name="lock" size={18} />
          </span>
        ) : null}
        {trailing}
      </div>
      {error ? (
        <div className="field-help is-error" role="alert">
          <Icon name="triangle-alert" size={14} />
          <span>{error}</span>
        </div>
      ) : help ? (
        <div className="field-help">{help}</div>
      ) : null}
    </div>
  );
}
function Picker({ label, value, placeholder, onClick, action, error, icon, help, disabled }: any) {
  return (
    <div className="field">
      {label ? (
        <span className="field-label">
          <span>{label}</span>
        </span>
      ) : null}
      <button
        type="button"
        className={cx('picker', error && 'is-error')}
        data-action={act(action)}
        onClick={onClick}
        aria-disabled={disabled ? 'true' : undefined}
        aria-haspopup="dialog"
      >
        {icon ? (
          <span className="in-icon c-muted">
            <Icon name={icon} size={20} />
          </span>
        ) : null}
        <span className={cx('flex1 ellipsis', !value && 'ph')}>{value || placeholder}</span>
        <Icon name="chevron-down" size={20} class="c-muted" />
      </button>
      {error ? (
        <div className="field-help is-error" role="alert">
          <Icon name="triangle-alert" size={14} />
          <span>{error}</span>
        </div>
      ) : help ? (
        <div className="field-help">{help}</div>
      ) : null}
    </div>
  );
}
function Switch({ checked, onChange, action, label, disabled, onDisabledClick }: any) {
  const handle = () => {
    if (disabled) {
      if (onDisabledClick) onDisabledClick();
      return;
    }
    onChange && onChange(!checked);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked ? 'true' : 'false'}
      aria-label={label}
      aria-disabled={disabled ? 'true' : undefined}
      className="switch"
      data-action={act(action)}
      onClick={handle}
    >
      <i />
    </button>
  );
}
function Checkbox({ checked, onChange, action, label, disabled }: any) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked ? 'true' : 'false'}
      aria-label={label}
      aria-disabled={disabled ? 'true' : undefined}
      className="check"
      data-action={act(action)}
      onClick={() => !disabled && onChange && onChange(!checked)}
    >
      {checked ? <Icon name="check" size={16} stroke={3} /> : null}
    </button>
  );
}
function Radio({ checked, onChange, action, label, disabled }: any) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked ? 'true' : 'false'}
      aria-label={label}
      aria-disabled={disabled ? 'true' : undefined}
      className="radio"
      data-action={act(action)}
      onClick={() => !disabled && onChange && onChange()}
    >
      <i />
    </button>
  );
}
function OptionRow({ label, sub, checked, type = 'radio', onClick, action, trailing, disabled, leading }: any) {
  return (
    <button
      type="button"
      role={type === 'radio' ? 'radio' : 'checkbox'}
      aria-checked={checked ? 'true' : 'false'}
      aria-disabled={disabled ? 'true' : undefined}
      className="option-row"
      data-action={act(action)}
      onClick={() => !disabled && onClick && onClick()}
      style={sx(
        disabled
          ? {
              opacity: 0.5,
            }
          : undefined,
      )}
    >
      {leading}
      <span className="flex1">
        <span
          className="t-body-m c-heading"
          style={{
            display: 'block',
          }}
        >
          {label}
        </span>
        {sub ? (
          <span
            className="t-body-s c-muted"
            style={{
              display: 'block',
            }}
          >
            {sub}
          </span>
        ) : null}
      </span>
      {trailing}
      <span className={type === 'radio' ? 'radio' : 'check'} aria-checked={checked ? 'true' : 'false'} aria-hidden="true">
        {type === 'radio' ? <i /> : checked ? <Icon name="check" size={16} stroke={3} /> : null}
      </span>
    </button>
  );
}
function Chip({ label, icon, selected, onClick, action, count, removable, onRemove, disabled, input, class: cls }: any) {
  return (
    <button
      type="button"
      className={cx('chip', selected && 'is-selected', input && 'is-input', cls)}
      aria-pressed={selected != null ? (selected ? 'true' : 'false') : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      data-action={act(action)}
      onClick={(e) => !disabled && onClick && onClick(e)}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      <span>{label}</span>
      {count ? <span className="chip-count">{count}</span> : null}
      {removable ? (
        <span
          role="button"
          aria-label={t('common.remove')}
          data-action={act(action) + '.remove'}
          onClick={(e) => {
            e.stopPropagation();
            onRemove && onRemove();
          }}
          style={{
            display: 'inline-flex',
            marginRight: '-4px',
          }}
        >
          <Icon name="x" size={14} />
        </span>
      ) : null}
    </button>
  );
}
function Segmented({ options, value, onChange, action, class: cls }: any) {
  return (
    <div className={cx('seg', cls)} role="tablist">
      {options.map((o) => (
        <button
          type="button"
          role="tab"
          key={o.id}
          aria-selected={value === o.id ? 'true' : 'false'}
          data-action={act(action) + '.' + o.id}
          onClick={() => onChange && onChange(o.id)}
        >
          {o.icon ? <Icon name={o.icon} size={16} /> : null}
          <span className="ellipsis">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
function Tabs({ tabs, value, onChange, action, sticky, scroll }: any) {
  return (
    <div className={cx('tabs', sticky && 'is-sticky', scroll && 'is-scroll')} role="tablist">
      {tabs.map((tb) => (
        <button
          type="button"
          role="tab"
          key={tb.id}
          aria-selected={value === tb.id ? 'true' : 'false'}
          data-action={act(action) + '.' + tb.id}
          onClick={() => onChange && onChange(tb.id)}
        >
          <span>{tb.label}</span>
          {tb.count != null ? <span className="badge-count">{tb.count}</span> : null}
          {tb.icon ? <Icon name={tb.icon} size={16} /> : null}
        </button>
      ))}
    </div>
  );
}
const ROLE_BADGE = {
  president: ['badge-president', 'crown'],
  board: ['badge-board', 'shield-check'],
  advisor: ['badge-advisor', 'graduation-cap'],
  member: ['badge-member', 'user-check'],
  superadmin: ['badge-superadmin', 'badge-check'],
};
const STATUS_BADGE = {
  pending: ['badge-pending', 'hourglass'],
  approved: ['badge-success', 'circle-check'],
  going: ['badge-success', 'circle-check'],
  attended: ['badge-success', 'circle-check'],
  active: ['badge-success', 'circle-check'],
  rejected: ['badge-danger', 'circle-x'],
  cancelled: ['badge-danger', 'circle-x'],
  removed: ['badge-danger', 'user-x'],
  absent: ['badge-neutral', 'circle-x'],
  full: ['badge-full', 'users'],
  waitlist: ['badge-pending', 'hourglass'],
  members: ['badge-neutral', 'lock'],
  draft: ['badge-neutral', 'file-text'],
  published: ['badge-success', 'circle-check'],
  suspended: ['badge-danger', 'ban'],
  past: ['badge-neutral', 'history'],
  open: ['badge-pending', 'flag'],
  resolved: ['badge-success', 'circle-check'],
  valid: ['badge-success', 'circle-check'],
  used: ['badge-neutral', 'check-check'],
  void: ['badge-danger', 'circle-x'],
};
function Badge({ kind = 'neutral', label, icon, class: cls }: any) {
  return (
    <span className={cx('badge', 'badge-' + kind, cls)}>
      {icon ? <Icon name={icon} size={12} stroke={2.2} /> : null}
      <span>{label}</span>
    </span>
  );
}
function RoleBadge({ role, class: cls }: any) {
  const [k, i] = ROLE_BADGE[role] || ROLE_BADGE.member;
  return (
    <span className={cx('badge', k, cls)}>
      <Icon name={i} size={12} stroke={2.2} />
      <span>{t('role.' + role)}</span>
    </span>
  );
}
function StatusBadge({ status, label, class: cls }: any) {
  const [k, i] = STATUS_BADGE[status] || ['badge-neutral', 'info'];
  return (
    <span className={cx('badge', k, cls)}>
      <Icon name={i} size={12} stroke={2.2} />
      <span>{label || t('status.' + status)}</span>
    </span>
  );
}
function Card({ children, tappable, onClick, action, class: cls, style, muted, highlight, label }: any) {
  if (tappable)
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        className={cx('card is-tappable', muted && 'is-muted', highlight && 'is-highlight', cls)}
        style={sx(style)}
        data-action={act(action)}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick && onClick(e);
          }
        }}
      >
        {children}
      </div>
    );
  return (
    <div className={cx('card', muted && 'is-muted', highlight && 'is-highlight', cls)} style={sx(style)}>
      {children}
    </div>
  );
}
function Tile({ leading, title, subtitle, trailing, onClick, action, danger, disabled, chevron, inCard, plain, class: cls, sub2, titleClass }: any) {
  const inner = [
    leading,
    <span className="tile-text">
      <span
        className={cx('t-body-m', danger ? 'c-danger' : 'c-heading', titleClass)}
        style={{
          display: 'block',
        }}
      >
        {title}
      </span>
      {subtitle ? (
        <span
          className="t-body-s c-muted"
          style={{
            display: 'block',
          }}
        >
          {subtitle}
        </span>
      ) : null}
      {sub2 ? (
        <span
          className="t-caption"
          style={{
            display: 'block',
          }}
        >
          {sub2}
        </span>
      ) : null}
    </span>,
    trailing != null ? <span className="trailing">{trailing}</span> : null,
    chevron ? (
      <span className="trailing">
        <Icon name="chevron-right" size={20} />
      </span>
    ) : null,
  ];
  if (!onClick) return <div className={cx('tile is-plain', inCard && 'in-card', danger && 'is-danger', cls)}>{Children.toArray(inner)}</div>;
  // Sağ tarafta etkileşimli öğe varsa iç içe <button> geçersiz HTML olur: rol=button taşıyan div kullan.
  if (trailing != null)
    return (
      <div
        role="button"
        tabIndex={0}
        className={cx('tile', inCard && 'in-card', plain && 'is-plain', danger && 'is-danger', cls)}
        style={{ cursor: 'pointer' }}
        aria-disabled={disabled ? 'true' : undefined}
        data-action={act(action)}
        onClick={onClick}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
            e.preventDefault();
            onClick(e);
          }
        }}
      >
        {Children.toArray(inner)}
      </div>
    );
  return (
    <button
      type="button"
      className={cx('tile', inCard && 'in-card', plain && 'is-plain', danger && 'is-danger', cls)}
      aria-disabled={disabled ? 'true' : undefined}
      data-action={act(action)}
      onClick={onClick}
    >
      {Children.toArray(inner)}
    </button>
  );
}
function AppBar({ title, large, onBack, backAction, children, surface, subtitle, closeIcon, titleNode }: any) {
  return (
    <header className={cx('appbar', large && 'appbar-large', surface && 'is-surface')}>
      {onBack ? (
        <IconButton
          icon={closeIcon ? 'x' : 'arrow-left'}
          label={closeIcon ? t('a11y.close') : t('a11y.back')}
          action={backAction || 'NAV.back'}
          onClick={onBack}
        />
      ) : null}
      {large ? (
        <h1 className="t-title-l flex1 ellipsis">{title}</h1>
      ) : (
        <div className="appbar-title">
          {titleNode || <h1 className="t-title-s ellipsis">{title}</h1>}
          {subtitle ? <div className="t-caption ellipsis">{subtitle}</div> : null}
        </div>
      )}
      {children}
    </header>
  );
}
function Banner({ kind = 'info', icon, text, actionLabel, onAction, action, onDismiss, dismissAction, card, children }: any) {
  const defIcon = {
    offline: 'wifi-off',
    info: 'info',
    warning: 'triangle-alert',
    danger: 'circle-x',
    readonly: 'eye',
    success: 'circle-check',
  }[kind];
  return (
    <div className={cx('banner', 'banner-' + kind, card && 'is-card')} role={kind === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon || defIcon} size={18} />
      <span className="banner-text">
        {text}
        {children}
      </span>
      {actionLabel ? (
        <button type="button" className="btn btn-text" data-action={act(action)} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          className="iconbtn is-sm"
          style={{
            color: 'inherit',
          }}
          aria-label={t('a11y.dismiss')}
          data-action={act(dismissAction)}
          onClick={onDismiss}
        >
          <Icon name="x" size={18} />
        </button>
      ) : null}
    </div>
  );
}
function Progress({ value = 0, max = 100, kind, thin, label }: any) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className={cx('prog', kind && 'is-' + kind, thin && 'is-thin')}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <i
        style={{
          width: pct + '%',
        }}
      />
    </div>
  );
}
function Donut({ value = 0, size = 96, stroke = 10, label }: any) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-surface-muted)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--brand-primary)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          transition: 'stroke-dasharray .6s var(--ease-standard)',
        }}
      />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" fontFamily="Montserrat" fontWeight="700" fontSize={size / 4.5} fill="var(--text-heading)">
        %{Math.round(value)}
      </text>
    </svg>
  );
}
function Skeleton({ w = '100%', h = 14, circle, class: cls, style }: any) {
  return (
    <span
      className={cx('sk', circle && 'circle', cls)}
      style={{
        width: typeof w === 'number' ? w + 'px' : w,
        height: typeof h === 'number' ? h + 'px' : h,
        ...(style || {}),
      }}
      aria-hidden="true"
    />
  );
}
function SkeletonList({ n = 4, variant = 'tile' }: any) {
  const items = Array.from({
    length: n,
  });
  if (variant === 'card')
    return (
      <div className="col gap12 px16" aria-busy="true" aria-label={t('common.loading')}>
        {items.map((_, i) => (
          <div className="card" key={i}>
            <Skeleton
              h={140}
              style={{
                borderRadius: 0,
              }}
            />
            <div className="card-body col gap8">
              <Skeleton w="60%" h={16} />
              <Skeleton w="90%" />
              <Skeleton w="40%" />
            </div>
          </div>
        ))}
      </div>
    );
  return (
    <div className="col" aria-busy="true" aria-label={t('common.loading')}>
      {items.map((_, i) => (
        <div className="tile is-plain" key={i}>
          <Skeleton w={40} h={40} circle />
          <span className="tile-text col gap6">
            <Skeleton w="55%" h={14} />
            <Skeleton w="80%" h={12} />
          </span>
        </div>
      ))}
    </div>
  );
}
function EmptyState({ illustration = 'empty-clubs', title, desc, cta, ctaAction, onCta, secondary, secondaryAction, onSecondary, compact }: any) {
  return (
    <div
      className="empty"
      style={sx(
        compact
          ? {
              padding: '20px 16px',
            }
          : undefined,
      )}
    >
      <Illustration name={illustration} size={compact ? 96 : 140} />
      <h3 className="t-title-s">{title}</h3>
      {desc ? (
        <p
          className="t-body-s c-sec"
          style={{
            maxWidth: '280px',
          }}
        >
          {desc}
        </p>
      ) : null}
      {cta ? <Button variant="primary" label={cta} action={ctaAction} onClick={onCta} /> : null}
      {secondary ? <Button variant="text" label={secondary} action={secondaryAction} onClick={onSecondary} /> : null}
    </div>
  );
}
function ErrorState({ onRetry, retryAction = 'SYS-02.retry', onHome, homeAction = 'SYS-02.home', inline }: any) {
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try { await (onRetry ? onRetry() : app.nav.back() || app.nav.resetTo('CLB-01')); } finally { setBusy(false); }
  };
  return (
    <div
      className="empty"
      role="alert"
      style={sx(
        inline
          ? {
              padding: '24px 16px',
            }
          : undefined,
      )}
    >
      <Illustration name="error" size={inline ? 96 : 140} />
      <h3 className="t-title-s">{t('sys.error.title')}</h3>
      <p
        className="t-body-s c-sec"
        style={{
          maxWidth: '280px',
        }}
      >
        {t('sys.error.desc')}
      </p>
      <div className="row gap8">
        <Button variant="primary" label={t('common.retry')} action={retryAction} onClick={retry} loading={busy} icon="refresh-cw" />
        {onHome ? <Button variant="text" label={t('sys.error.home')} action={homeAction} onClick={onHome} /> : null}
      </div>
    </div>
  );
}
function OfflineState({ onRetry, action = 'SYS-03.retry' }: any) {
  const [shake, setShake] = useState(false);
  const retry = () => {
    if (!app.online()) {
      setShake(true);
      setTimeout(() => setShake(false), 450);
      app.toast('TST-24');
    } else onRetry && onRetry();
  };
  return (
    <div className={cx('empty', shake && 'shake')}>
      <Illustration name="offline" />
      <h3 className="t-title-s">{t('sys.offline.title')}</h3>
      <p className="t-body-s c-sec">{t('sys.offline.fullDesc')}</p>
      <Button label={t('common.retry')} icon="refresh-cw" action={action} onClick={retry} />
    </div>
  );
}
function ListState({ children, status = 'ok', isEmpty, skeleton, empty, inlineError = true, n = 5, variant = 'tile', emptyProps, onRetry, retryAction }: { children?: any; status?: LoadStatus; isEmpty?: boolean; skeleton?: any; empty?: any; inlineError?: boolean; n?: number; variant?: string; emptyProps?: any; onRetry?: () => any; retryAction?: string }) {
  const st = status === 'idle' ? 'loading' : isEmpty && status !== 'loading' && status !== 'error' ? 'empty' : status;
  if (st === 'loading') return skeleton || <SkeletonList n={n} variant={variant} />;
  if (st === 'error') return <ErrorState inline={inlineError} onRetry={onRetry} retryAction={retryAction} />;
  if (st === 'empty')
    return (
      empty || (
        <EmptyState
          {...(emptyProps || {
            title: t('common.emptyGeneric'),
          })}
        />
      )
    );
  return children;
}
function SectionTitle({ title, actionLabel, onAction, action, sub }: any) {
  return (
    <div className="section-title">
      <div>
        <h2 className="t-title-m">{title}</h2>
        {sub ? <div className="t-caption">{sub}</div> : null}
      </div>
      {actionLabel ? (
        <button type="button" className="btn btn-text btn-sm" data-action={act(action)} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
function ListEnd({ label }: any) {
  return (
    <div
      className="center t-caption"
      style={{
        padding: '20px 16px 8px',
      }}
    >
      {'\u2014 '}
      {label || t('common.allDone')}
      {' \u2014'}
    </div>
  );
}
function StickyCTA({ children, inNav, style }: any) {
  return (
    <div className={cx('ctabar', inNav && 'in-nav')} style={sx(style)}>
      {children}
    </div>
  );
}
function Stepbar({ step, total }: any) {
  return (
    <div className="stepbar" role="progressbar" aria-valuenow={step} aria-valuemax={total} aria-label={`${step}/${total}`}>
      {Array.from({
        length: total,
      }).map((_, i) => (
        <i key={i} className={i < step ? 'is-done' : ''} />
      ))}
    </div>
  );
}
function DateBadge({ ts }: any) {
  return (
    <span className="date-badge">
      <b>{new Date(ts).getDate()}</b>
      <span>{app.fmt.monthShort(ts)}</span>
    </span>
  );
}
function KPI({ label, value, sub, accent, onClick, action, icon }: any) {
  return (
    <button
      type="button"
      className={cx('card kpi pressable', accent && 'is-accent')}
      style={{
        textAlign: 'left',
        width: '100%',
      }}
      data-action={act(action)}
      onClick={onClick}
    >
      <span className="row between">
        <span className="t-caption">{label}</span>
        {icon ? <Icon name={icon} size={16} class="c-muted" /> : null}
      </span>
      <span className="kpi-value">{value}</span>
      {sub ? <span className="t-body-s c-sec">{sub}</span> : null}
    </button>
  );
}
function Quick({ icon, label, onClick, action, disabled, onDisabledClick }: any) {
  return (
    <button
      type="button"
      className="quick pressable"
      data-action={act(action)}
      aria-disabled={disabled ? 'true' : undefined}
      onClick={() => (disabled ? onDisabledClick && onDisabledClick() : onClick && onClick())}
    >
      <span className="quick-icon">
        <Icon name={icon} size={20} />
      </span>
      <span>{label}</span>
    </button>
  );
}
function UserRow({ user, sub, trailing, onClick, action, badge, size = 40, inCard, chevron }: any) {
  const name = user ? user.name : t('common.deletedUser');
  return (
    <Tile
      leading={<Avatar user={user} size={size} />}
      title={
        <span className="row gap6 wrap">
          <span
            className="ellipsis"
            style={{
              maxWidth: '200px',
            }}
          >
            {name}
          </span>
          {badge}
        </span>
      }
      subtitle={sub}
      trailing={trailing}
      onClick={onClick}
      action={action}
      inCard={inCard}
      chevron={chevron}
    />
  );
}
function MiniLineChart({ data, action, labels, onPoint }: any) {
  const [sel, setSel] = useState<number | null>(null);
  const w = 320,
    h = 110,
    pad = 10;
  const max = Math.max(...data),
    min = Math.min(...data);
  const span = Math.max(1, max - min);
  const pts = data.map((v, i) => [pad + (i * (w - pad * 2)) / (data.length - 1), h - pad - ((v - min) / span) * (h - pad * 2)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <div className="rel">
      <svg className="mini-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={t('mgt.chart.aria')}>
        <path d={d + ` L${pts[pts.length - 1][0]} ${h} L${pts[0][0]} ${h} Z`} fill="var(--brand-primary-container)" opacity=".6" />
        <path d={d} fill="none" stroke="var(--brand-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r={sel === i ? 6 : 4}
            fill={sel === i ? 'var(--brand-primary)' : 'var(--bg-surface)'}
            stroke="var(--brand-primary)"
            strokeWidth="2"
            style={{
              cursor: 'pointer',
            }}
            role="button"
            tabIndex={0}
            aria-label={`${labels ? labels[i] : i}: ${data[i]}`}
            data-action={act(action) + '.' + i}
            onClick={() => {
              setSel(sel === i ? null : i);
              onPoint && onPoint(i);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSel(i);
            }}
          />
        ))}
      </svg>
      {sel != null ? (
        <div
          className="tooltip"
          style={{
            left: `${(pts[sel][0] / w) * 100}%`,
            top: `${(pts[sel][1] / h) * 100}%`,
          }}
        >
          {labels ? labels[sel] + ' · ' : ''}
          {data[sel]}
        </div>
      ) : null}
    </div>
  );
}
function Calendar({ month, selected, onSelect, action, dotsFor, min, max, onPrev, onNext, onToday, compact }: any) {
  const loc = app.locale();
  const mondayFirst = loc === 'tr';
  const d = new Date(month);
  const y = d.getFullYear(),
    m = d.getMonth();
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + (mondayFirst ? 6 : 0)) % 7;
  const daysIn = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const cells: any[] = [];
  for (let i = 0; i < 42; i++) {
    const dayN = i - startDow + 1;
    let date;
    let other = false;
    if (dayN < 1) {
      date = new Date(y, m - 1, prevDays + dayN);
      other = true;
    } else if (dayN > daysIn) {
      date = new Date(y, m + 1, dayN - daysIn);
      other = true;
    } else date = new Date(y, m, dayN);
    cells.push({
      date,
      other,
    });
  }
  const todayK = dayKey(Date.now());
  const selK = selected ? dayKey(selected) : null;
  const dowNames = Array.from(
    {
      length: 7,
    },
    (_, i) => {
      const base = new Date(2024, 0, mondayFirst ? 1 + i : 7 + i);
      return new Intl.DateTimeFormat(loc === 'tr' ? 'tr-TR' : 'en-GB', {
        weekday: 'short',
      })
        .format(base)
        .slice(0, 2);
    },
  );
  return (
    <div className="col gap8">
      <div className="row between">
        <IconButton icon="chevron-left" label={t('a11y.prevMonth')} action={act(action) + '.prevMonth'} onClick={onPrev} small />
        <span
          className="t-title-s"
          style={{
            textTransform: 'capitalize',
          }}
        >
          {app.fmt.monthYear(month)}
        </span>
        <span className="row gap4">
          {onToday ? (
            <button type="button" className="btn btn-text btn-sm" data-action={act(action) + '.today'} onClick={onToday}>
              {t('common.today')}
            </button>
          ) : null}
          <IconButton icon="chevron-right" label={t('a11y.nextMonth')} action={act(action) + '.nextMonth'} onClick={onNext} small />
        </span>
      </div>
      <div className="cal-head">
        {dowNames.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="cal-grid" role="grid">
        {cells.map(({ date, other }) => {
          const k = dayKey(date.getTime());
          const ts = date.getTime();
          const disabled = (min && ts < startOfDay(min)) || (max && ts > max);
          const dots = dotsFor ? Math.min(3, dotsFor(k)) : 0;
          return (
            <button
              type="button"
              key={k}
              role="gridcell"
              className={cx('cal-day', other && 'is-other', k === todayK && 'is-today', k === selK && 'is-selected')}
              style={sx(
                compact
                  ? {
                      minHeight: '36px',
                    }
                  : undefined,
              )}
              aria-disabled={disabled ? 'true' : undefined}
              aria-label={app.fmt.date(ts)}
              aria-selected={k === selK ? 'true' : 'false'}
              data-action={act(action) + '.day.' + k}
              onClick={() => !disabled && onSelect && onSelect(ts)}
            >
              <span>{date.getDate()}</span>
              {dots ? (
                <span className="dots">
                  {Array.from({
                    length: dots,
                  }).map((_, i) => (
                    <i key={i} />
                  ))}
                </span>
              ) : (
                <span className="dots" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function SuccessCheck({ size = 96 }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label={t('common.success')}>
      <circle cx="48" cy="48" r="40" fill="none" stroke="var(--state-success)" strokeWidth="4" className="circle-draw" />
      <path
        d="M30 49l12 12 24-26"
        fill="none"
        stroke="var(--state-success)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="check-draw"
      />
    </svg>
  );
}

/* scroll container with position memory + pull-to-refresh */
function Scroll({ children, onRefresh, refreshAction, class: cls, style, routeKey, noSafe }: any) {
  const ref = useRef<any>(null);
  const [pull, setPull] = useState(0);
  const startY = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const k = routeKey || 'x';
    const saved = app.nav.scroll[k];
    if (saved) el.scrollTop = saved;
    const onS = () => {
      app.nav.scroll[k] = el.scrollTop;
    };
    el.addEventListener('scroll', onS, {
      passive: true,
    });
    return () => el.removeEventListener('scroll', onS);
  }, [routeKey]);
  useEffect(() => {
    const el = ref.current;
    if (el && app.nav.scrollTopReq)
      el.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
  }, [app.nav.scrollTopReq]);
  const onDown = (e) => {
    if (!onRefresh || e.pointerType !== 'touch' || ref.current.scrollTop > 0) return;
    startY.current = e.clientY;
  };
  const onMove = (e) => {
    if (startY.current == null) return;
    const dy = e.clientY - startY.current;
    if (dy > 0 && ref.current.scrollTop === 0) setPull(Math.min(90, dy * 0.6));
  };
  const onUp = () => {
    if (startY.current == null) return;
    if (pull > 60 && onRefresh) {
      setRefreshing(true);
      Promise.resolve(onRefresh()).finally(() => setRefreshing(false));
    }
    startY.current = null;
    setPull(0);
  };
  return (
    <div
      ref={ref}
      className={cx('screen-scroll', noSafe && 'no-safe', cls)}
      style={sx(style)}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      data-action={onRefresh ? act(refreshAction) : undefined}
    >
      {onRefresh ? (
        <div
          style={{
            height: (refreshing ? 48 : pull) + 'px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: refreshing ? 'height .2s' : 'none',
            overflow: 'hidden',
          }}
          aria-hidden="true"
        >
          {refreshing ? (
            <Spinner />
          ) : pull > 0 ? (
            <Icon
              name="arrow-up"
              size={20}
              class="c-muted"
              style={{
                transform: `rotate(${pull > 60 ? 0 : 180}deg)`,
                transition: 'transform .2s',
              }}
            />
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* sheet + dialog frames */
function SheetFrame({ title, onClose, children, footer, full, menu, hideHeader, closeAction, dirty, id, flush, headerExtra }: any) {
  const ref = useRef<any>(null);
  const [dy, setDy] = useState(0);
  const start = useRef(null);
  const close = () => {
    if (dirty) {
      app.openDialog('DLG-25', {
        onDiscard: () => {
          app.closeDialog();
          onClose();
        },
        onKeep: () => app.closeDialog(),
      });
      return;
    }
    onClose();
  };
  useFocusTrap(ref, close);
  const onDown = (e) => {
    if (e.pointerType === 'mouse') return; // sürükleyerek kapatma yalnızca dokunmatikte
    const body = ref.current && ref.current.querySelector('.sheet-body');
    if (body && body.contains(e.target) && body.scrollTop > 0) return;
    if (e.target.closest('input,textarea,button,.wheel')) return;
    start.current = e.clientY;
  };
  const onMove = (e) => {
    if (start.current == null) return;
    setDy(Math.max(0, e.clientY - start.current));
  };
  const onUp = () => {
    if (start.current == null) return;
    if (dy > 120) close();
    setDy(0);
    start.current = null;
  };
  return (
    <div className="overlay-root">
      <div className="scrim" onClick={close} data-action={(id || 'SHT') + '.scrim'} />
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('sheet', full && 'sheet-full', menu && 'is-menu')}
        style={sx(
          dy
            ? {
                transform: `translateY(${dy}px)`,
                animation: 'none',
              }
            : undefined,
        )}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="sheet-handle" />
        {hideHeader ? null : (
          <div className="sheet-head">
            <h2 className="t-title-m">{title}</h2>
            {headerExtra}
            <IconButton icon="x" label={t('a11y.close')} action={closeAction || (id || 'SHT') + '.close'} onClick={close} />
          </div>
        )}
        <div className={cx('sheet-body', flush && 'is-flush')}>{children}</div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </section>
    </div>
  );
}
function DialogFrame({ title, body, children, actions, onClose, dismissable = true, id, danger, icon }: any) {
  const ref = useRef<any>(null);
  useFocusTrap(ref, dismissable ? onClose : null);
  return (
    <div
      className="overlay-root"
      style={{
        zIndex: '110',
      }}
    >
      <div className="scrim" onClick={dismissable ? onClose : undefined} data-action={(id || 'DLG') + '.scrim'} />
      <section ref={ref} role="dialog" aria-modal="true" aria-labelledby={(id || 'dlg') + '-title'} className="dialog">
        {icon ? (
          <span className={cx('notif-icon', danger ? 'ni-danger' : 'ni-brand')}>
            <Icon name={icon} size={20} />
          </span>
        ) : null}
        <h2 id={(id || 'dlg') + '-title'} className="t-title-m">
          {title}
        </h2>
        {body ? <p className="t-body-s c-sec prewrap">{body}</p> : null}
        {children}
        <div className="dialog-actions">{actions}</div>
      </section>
    </div>
  );
}
function PopMenu({ children, onClose, id }: any) {
  const ref = useRef<any>(null);
  useFocusTrap(ref, onClose);
  return (
    <div className="overlay-root">
      <div
        className="scrim"
        style={{
          background: 'transparent',
        }}
        onClick={onClose}
        data-action={(id || 'MENU') + '.scrim'}
      />
      <div ref={ref} className="popmenu" role="menu">
        {children}
      </div>
    </div>
  );
}
export {
  Spinner,
  Button,
  IconButton,
  Input,
  Picker,
  Switch,
  Checkbox,
  Radio,
  OptionRow,
  Chip,
  Segmented,
  Tabs,
  Badge,
  RoleBadge,
  StatusBadge,
  Card,
  Tile,
  AppBar,
  Banner,
  Progress,
  Donut,
  Skeleton,
  SkeletonList,
  EmptyState,
  ErrorState,
  OfflineState,
  ListState,
  SectionTitle,
  ListEnd,
  StickyCTA,
  Stepbar,
  DateBadge,
  KPI,
  Quick,
  UserRow,
  MiniLineChart,
  Calendar,
  SuccessCheck,
  Scroll,
  SheetFrame,
  DialogFrame,
  PopMenu,
  ROLE_BADGE,
  STATUS_BADGE,
};
