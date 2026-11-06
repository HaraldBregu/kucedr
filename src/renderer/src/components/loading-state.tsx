import { useEffect, useState } from 'react';
import { LoaderIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LoadingState({ label = 'Churning', startedAtMs, className }: {
  label?: string;
  startedAtMs?: number;
  className?: string;
}) {
  const [start] = useState(() => startedAtMs ?? Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  const total = Math.floor(Math.max(0, now - start) / 100) / 10;
  const elapsed = total < 60 ? `${total.toFixed(1)}s` : `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;

  return (
    <span className={cn('flex w-fit items-center gap-2.5 text-neutral-900 dark:text-neutral-100', className)}>
      <LoaderIcon role="status" aria-label="Loading" className="size-4 animate-spin motion-reduce:animate-none" />
      <span className="text-[13px] font-medium">{label}</span>
      <span role="timer" aria-label={`Elapsed time ${elapsed}`} className="font-mono text-[12px] tabular-nums text-neutral-400 dark:text-neutral-500">{elapsed}</span>
    </span>
  );
}
