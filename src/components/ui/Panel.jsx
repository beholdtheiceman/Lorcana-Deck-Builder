// Side-rail panel with an uppercase kicker title
// (design/comps/*: .panel / .panel h3).
export default function Panel({ title, children, className = '', ...rest }) {
  return (
    <div
      className={`border rounded-lg p-[18px] ${className}`}
      style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
      {...rest}
    >
      {title && (
        <h3
          className="m-0 mb-3.5 font-semibold uppercase"
          style={{ fontSize: '11.5px', letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--sans)' }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}
