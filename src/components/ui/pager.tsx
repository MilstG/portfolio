import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_SIZE = 10;

export function usePager<T>(items: T[], pageSize = DEFAULT_SIZE) {
  const [page, setPage] = useState(0);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const safePage = Math.min(page, totalPages - 1);
  const slice = useMemo(
    () => items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [items, safePage, pageSize],
  );

  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(total, (safePage + 1) * pageSize);

  return {
    page: safePage,
    setPage,
    totalPages,
    slice,
    total,
    from,
    to,
    pageSize,
  };
}

type PagerProps = {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onChange: (page: number) => void;
  className?: string;
  always?: boolean;
};

export function Pager({
  page,
  totalPages,
  total,
  from,
  to,
  onChange,
  className,
  always = false,
}: PagerProps) {
  if (!always && totalPages <= 1) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-t border-line pt-1.5 font-mono text-[10px] text-muted",
        className,
      )}
    >
      <span className="tabular-nums">
        {from}–{to} / {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Página anterior"
          disabled={page <= 0}
          onClick={() => onChange(page - 1)}
          className="inline-flex h-6 w-6 items-center justify-center border border-line text-fg disabled:cursor-not-allowed disabled:opacity-30 hover:border-accent hover:text-accent"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="min-w-[3.5rem] text-center tabular-nums text-subtle">
          {page + 1}/{totalPages}
        </span>
        <button
          type="button"
          aria-label="Página siguiente"
          disabled={page >= totalPages - 1}
          onClick={() => onChange(page + 1)}
          className="inline-flex h-6 w-6 items-center justify-center border border-line text-fg disabled:cursor-not-allowed disabled:opacity-30 hover:border-accent hover:text-accent"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
