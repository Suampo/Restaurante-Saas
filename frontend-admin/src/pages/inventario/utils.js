export const fmt2 = (n) => Number(n ?? 0).toFixed(2);
export const cls = (...a) => a.filter(Boolean).join(" ");

/* Mini toast sin dependencias */
export function toast(msg) {
  try {
    const el = document.createElement("div");
    el.textContent = msg;
    el.className =
      "fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white shadow-lg";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  } catch {}
}
