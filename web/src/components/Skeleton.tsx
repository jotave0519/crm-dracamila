import type { CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return <div className={`skeleton ${className}`.trim()} style={style} />;
}

export function SkeletonText({ width = "100%" }: { width?: string | number }) {
  return <Skeleton className="skeleton-text" style={{ width }} />;
}

export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <Skeleton className="skeleton-title" style={{ width: "50%" }} />
          <SkeletonText width="72%" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="mobile-list-item skeleton-row">
      <Skeleton className="skeleton-circle" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <SkeletonText width="62%" />
        <SkeletonText width="38%" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Estado de carregamento discreto (spinner + texto). Substitui o antigo
 *  `<div className="empty-state">Carregando...</div>` onde faz sentido. */
export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="loading-state">
      <span className="spinner" />
      {label}
    </div>
  );
}
