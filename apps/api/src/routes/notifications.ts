import { Router } from "express";
import { localStore } from "../db/localStore.js";
import { getAccessScope } from "../middleware/scope.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", (req, res) => {
  const scope = getAccessScope(req);
  res.json(localStore.listNotifications(scope));
});

notificationsRouter.get("/summary", (req, res) => {
  const scope = getAccessScope(req);
  res.json(localStore.notificationSummary(scope));
});

notificationsRouter.post("/:id/read", (req, res, next) => {
  try {
    const scope = getAccessScope(req);
    localStore.markNotificationRead(req.params.id, scope);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});

notificationsRouter.post("/read-all", (req, res) => {
  const scope = getAccessScope(req);
  localStore.markAllNotificationsRead(scope);
  res.json({ ok: true });
});
