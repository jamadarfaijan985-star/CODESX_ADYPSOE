/** Standard card wrapper used by every auth screen. */
export default function ScreenCard({
  id,
  kicker,
  title,
  lead,
  children,
  footer,
}) {
  const headingId = `${id}-title`;

  return (
    <section className="rf-glass" aria-labelledby={headingId}>
      <div className="rf-glass__head">
        <p className="rf-kicker">{kicker}</p>
        <h1 className="rf-glass__title" id={headingId}>
          {title}
        </h1>
        {lead ? <p className="rf-glass__lead">{lead}</p> : null}
      </div>

      <div className="rf-glass__body">{children}</div>

      {footer ? <div className="rf-glass__foot">{footer}</div> : null}
    </section>
  );
}
