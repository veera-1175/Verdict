import { Router, type NextFunction, type Request, type Response } from "express";
import { localStore } from "../db/localStore.js";
import { getAccessScope, isAdminScope, isPlatformAdminScope } from "../middleware/scope.js";

export const profileRouter = Router();

function requireUser(req: Request, res: Response, next: NextFunction) {
  const scope = getAccessScope(req);
  if (scope.userId || isAdminScope(scope)) {
    next();
    return;
  }
  res.status(401).json({ error: "Authentication required" });
}

profileRouter.use(requireUser);

profileRouter.get("/", (req, res) => {
  const scope = getAccessScope(req);
  if (!scope.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const profile = localStore.getTeamMemberPublic(scope.userId);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  if (profile.role !== "platform_admin" && profile.org_id) {
    if (!localStore.isOrganizationActive(profile.org_id)) {
      res.status(403).json({ error: "This organization is deactivated. Contact the Platform Admin." });
      return;
    }
  }

  res.json({
    ...profile,
    github_username: profile.role === "platform_admin" ? "" : profile.github_username,
    avatar: profile.avatar ?? null,
    password_change_pending: profile.password_change_pending ?? false,
    onboarding_completed: profile.onboarding_completed ?? false,
  });
});

profileRouter.patch("/", (req, res, next) => {
  try {
    const scope = getAccessScope(req);
    if (!scope.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const member = localStore.findTeamMemberById(scope.userId);
    if (!member) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const name = typeof req.body?.name === "string" ? req.body.name : undefined;
    const completeOnboarding = req.body?.complete_onboarding === true;

    let avatar: string | null | undefined = undefined;
    if (req.body?.clear_avatar === true) {
      avatar = null;
    } else if (typeof req.body?.avatar === "string") {
      const raw = req.body.avatar.trim();
      if (raw === "") {
        avatar = null;
      } else if (!raw.startsWith("data:image/") && !/^https?:\/\//i.test(raw)) {
        res.status(400).json({ error: "Avatar must be an image data URL or https URL" });
        return;
      } else if (raw.length > 600_000) {
        res.status(400).json({ error: "Avatar too large — use a smaller image (max ~400KB)" });
        return;
      } else {
        avatar = raw;
      }
    }

    let password: string | undefined;
    if (member.role === "platform_admin") {
      const currentPassword =
        typeof req.body?.current_password === "string" ? req.body.current_password : "";
      const newPassword = typeof req.body?.new_password === "string" ? req.body.new_password : "";
      if (newPassword) {
        if (!currentPassword || member.password !== currentPassword) {
          res.status(401).json({ error: "Current password is incorrect" });
          return;
        }
        if (newPassword.length < 6) {
          res.status(400).json({ error: "New password must be at least 6 characters" });
          return;
        }
        password = newPassword;
      }
    }

    const updated = localStore.updateTeamMemberProfile(scope.userId, {
      name,
      complete_onboarding: completeOnboarding,
      ...(avatar !== undefined ? { avatar } : {}),
      ...(password !== undefined ? { password } : {}),
    });

    res.json({
      ...updated,
      github_username: updated.role === "platform_admin" ? "" : updated.github_username,
      avatar: updated.avatar ?? null,
    });
  } catch (err) {
    next(err);
  }
});

profileRouter.post("/password-request", (req, res, next) => {
  try {
    const scope = getAccessScope(req);
    if (!scope.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const currentPassword =
      typeof req.body?.current_password === "string" ? req.body.current_password : "";
    const newPassword = typeof req.body?.new_password === "string" ? req.body.new_password : "";

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "current_password and new_password are required" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }

    const member = localStore.findTeamMemberById(scope.userId);
    if (!member || member.password !== currentPassword) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    // Platform Admin has no password-change flow in the product
    if (isPlatformAdminScope(scope)) {
      res.status(400).json({
        error: "Platform Admin password is managed outside the app — no change request needed",
      });
      return;
    }

    const request = localStore.createPasswordRequest({
      userId: member.id,
      newPassword,
    });

    res.status(201).json({
      ok: true,
      pending: true,
      message: isAdminScope(scope)
        ? "Password change submitted — awaiting Platform Admin approval"
        : "Password change submitted — awaiting Org Admin approval",
      request_id: request.id,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("pending")) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});
