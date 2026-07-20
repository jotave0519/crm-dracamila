import { ReactNode } from "react";
import { useIsMobile } from "../hooks/useIsMobile";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** No desktop o formulario fica embutido na pagina; no mobile abre como bottom sheet. */
export function FormSheet({ open, onClose, children }: Props) {
  const isMobile = useIsMobile();

  if (!open) return null;
  if (!isMobile) return <>{children}</>;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
