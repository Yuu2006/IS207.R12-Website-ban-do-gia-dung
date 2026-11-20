export function Badge({ tone = 'neutral', className, children, ...rest }) {
  return <span className={['ds-badge', `ds-badge--${tone}`, className].filter(Boolean).join(' ')} {...rest}>{children}</span>;
}
