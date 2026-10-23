export default function Badge({ children, variant = 'default', size = 'sm' }) {
  const sizeClasses = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs';

  const variants = {
    default: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
    primary: 'bg-white text-black font-medium border border-white',
    outline: 'bg-transparent text-zinc-300 border border-zinc-700',
    success: 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60',
    warning: 'bg-amber-950/60 text-amber-300 border border-amber-800/60',
    danger: 'bg-rose-950/60 text-rose-300 border border-rose-800/60',
    info: 'bg-sky-950/60 text-sky-300 border border-sky-800/60',
    roleStudent: 'bg-zinc-900 text-zinc-200 border border-zinc-700 font-mono tracking-wider',
    roleStaff: 'bg-zinc-800 text-white border border-zinc-600 font-mono tracking-wider',
    roleAdmin: 'bg-white text-black font-semibold border border-white font-mono tracking-wider',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded font-medium ${sizeClasses} ${variants[variant] || variants.default}`}>
      {children}
    </span>
  );
}
