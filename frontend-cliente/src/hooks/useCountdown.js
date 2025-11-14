// src/hooks/useCountdown.js
import { useEffect, useMemo, useRef, useState } from "react";

export default function useCountdown(expiresAtIso, { onExpire } = {}) {
  const [now, setNow] = useState(Date.now());
  const target = useMemo(
    () => (expiresAtIso ? new Date(expiresAtIso).getTime() : null),
    [expiresAtIso]
  );
  const timer = useRef(null);
  const leftMs = target ? Math.max(0, target - now) : 0;
  const expired = target ? leftMs === 0 : false;

  useEffect(() => {
    if (!target) return;
    timer.current && clearInterval(timer.current);
    timer.current = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer.current);
  }, [target]);

  useEffect(() => {
    if (expired && onExpire) onExpire();
  }, [expired, onExpire]);

  const mm = String(Math.floor(leftMs / 60000)).padStart(2, "0");
  const ss = String(Math.floor((leftMs % 60000) / 1000)).padStart(2, "0");
  return { expired, mm, ss, leftMs };
}
