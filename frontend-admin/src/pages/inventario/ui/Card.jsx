export default function Card({ title, children, className = "" }) {
  return (
    <div className={`rounded-xl bg-white p-4 shadow ring-1 ring-black/5 ${className}`}>
      {title ? <h3 className="mb-3 font-semibold">{title}</h3> : null}
      {children}
    </div>
  );
}
