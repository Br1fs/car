import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  bootstrapActivityIfNeeded,
  clearActivityTimestamp,
  isIdleExceeded,
  touchActivity,
} from "../utils/idleSession";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click", "wheel"];
const BUMP_THROTTLE_MS = 2000;
const CHECK_INTERVAL_MS = 15000;

function performIdleLogout(navigate) {
  try {
    sessionStorage.setItem("authNotice", "idle");
  } catch {
    /* ignore */
  }
  clearActivityTimestamp();
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  navigate("/login", { replace: true });
}

/**
 * При отсутствии действий пользователя дольше порога — очистка сессии и редирект на /login.
 */
export default function IdleSessionWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const lastBumpRef = useRef(0);

  useEffect(() => {
    const runCheck = () => {
      if (!localStorage.getItem("token")) return;
      if (isIdleExceeded()) performIdleLogout(navigate);
    };

    const bump = () => {
      if (!localStorage.getItem("token")) return;
      const now = Date.now();
      if (now - lastBumpRef.current < BUMP_THROTTLE_MS) return;
      lastBumpRef.current = now;
      touchActivity();
    };

    bootstrapActivityIfNeeded();

    ACTIVITY_EVENTS.forEach((ev) => {
      window.addEventListener(ev, bump, { passive: true, capture: true });
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible") runCheck();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const intervalId = window.setInterval(runCheck, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => {
        window.removeEventListener(ev, bump, { capture: true });
      });
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(intervalId);
    };
  }, [navigate]);

  useEffect(() => {
    if (localStorage.getItem("token")) touchActivity();
  }, [location.pathname]);

  return null;
}
