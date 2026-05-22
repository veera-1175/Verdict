import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import Toast, { type ToastMessage } from "../components/Toast";

export type NotifyOptions = {
  message: string;
  type?: "success" | "error";
  path?: string;
};

type NotificationContextValue = {
  notify: (options: NotifyOptions) => void;
  notifySuccess: (message: string, options?: Omit<NotifyOptions, "message" | "type">) => void;
  notifyError: (message: string, options?: Omit<NotifyOptions, "message" | "type">) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used within NotificationProvider");
  return ctx;
}

export function NotificationProvider({
  children,
  navigate,
}: {
  children: ReactNode;
  navigate?: (path: string) => void;
}) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = useCallback(
    (options: NotifyOptions) => {
      const { message, type = "success", path } = options;
      setToast({ id: Date.now(), text: message, type });
      if (path && navigate) navigate(path);
    },
    [navigate],
  );

  const notifySuccess = useCallback(
    (message: string, options?: Omit<NotifyOptions, "message" | "type">) => {
      notify({ ...options, message, type: "success" });
    },
    [notify],
  );

  const notifyError = useCallback(
    (message: string, options?: Omit<NotifyOptions, "message" | "type">) => {
      notify({ ...options, message, type: "error" });
    },
    [notify],
  );

  return (
    <NotificationContext.Provider value={{ notify, notifySuccess, notifyError }}>
      {children}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </NotificationContext.Provider>
  );
}
