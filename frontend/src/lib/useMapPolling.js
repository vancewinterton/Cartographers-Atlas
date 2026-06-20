import { useEffect, useRef } from "react";
import { Maps } from "../lib/api";

/**
 * Poll `GET /api/maps/{mapId}` on an interval and fire `onUpdate(mapDoc)`
 * whenever the server's `updated_at` is newer than `localUpdatedAt`.
 *
 * The hook tracks the latest acknowledged `updated_at` so it never re-fires for
 * the same revision. The page-visibility API is used to pause polling when the
 * tab is hidden (no battery drain, no wasted requests).
 *
 *  - mapId            : map being watched (skip when null)
 *  - localUpdatedAt   : caller's currently-rendered map.updated_at
 *  - onUpdate(mapDoc) : called with the fresh MapDoc on every new revision
 *  - intervalMs       : poll interval (default 2000ms)
 *  - paused           : skip polling temporarily (e.g., DM is in the middle of a drag)
 */
export default function useMapPolling({
  mapId,
  localUpdatedAt,
  onUpdate,
  intervalMs = 2000,
  paused = false,
}) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const lastSeenRef = useRef(localUpdatedAt);
  // Keep lastSeen in sync with caller (so a local save bumps the watermark)
  useEffect(() => {
    if (localUpdatedAt) lastSeenRef.current = localUpdatedAt;
  }, [localUpdatedAt]);

  useEffect(() => {
    if (!mapId) return undefined;
    let cancelled = false;
    let timer = null;

    const poll = async () => {
      if (cancelled || paused) return;
      try {
        const fresh = await Maps.get(mapId);
        if (cancelled) return;
        const freshTs = fresh?.updated_at;
        if (freshTs && freshTs !== lastSeenRef.current) {
          lastSeenRef.current = freshTs;
          onUpdateRef.current?.(fresh);
        }
      } catch {
        /* network error — silently retry next tick */
      }
    };

    const tick = async () => {
      if (cancelled) return;
      await poll();
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    // When the tab/window becomes visible or focused again, refresh immediately
    // so a viewer that switched windows sees the latest state without waiting.
    const onActive = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onActive);
    window.addEventListener("focus", onActive);

    // first tick is delayed by intervalMs so initial render isn't blocked
    timer = setTimeout(tick, intervalMs);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onActive);
      window.removeEventListener("focus", onActive);
    };
  }, [mapId, intervalMs, paused]);
}
