import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { ToastItem } from "../context/ToastContext";
import { CheckIcon, XIcon } from "./icons";

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <MotionConfig reducedMotion="user">
    <div className="toast-stack">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast toast-${t.variant}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <span className="toast-icon">{t.variant === "error" ? <XIcon width={14} height={14} /> : <CheckIcon width={14} height={14} />}</span>
            <span>{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
