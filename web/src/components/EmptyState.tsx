import { PlusIcon } from "./icons";

interface Props {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: Props) {
  return (
    <div className="empty-state-block">
      <div className="empty-state-icon">
        <PlusIcon width={20} height={20} />
      </div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {actionLabel && onAction && (
        <button className="btn" onClick={onAction} style={{ marginTop: 14 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
