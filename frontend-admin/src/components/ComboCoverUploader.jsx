// src/components/ComboCoverUploader.jsx
import { useRef, useState } from "react";
import { uploadComboCover } from "../services/combosApi";
import { proxyImg } from "../utils/imageProxy";

const FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='320' height='240'>
  <rect width='100%' height='100%' fill='#f3f4f6'/>
  <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
        font-family='Arial, sans-serif' font-size='14' fill='#9ca3af'>Sin imagen</text>
</svg>`);

export default function ComboCoverUploader({
  comboId,
  coverUrl = "",
  onUploaded,
}) {
  const [preview, setPreview] = useState(coverUrl);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const openPicker = () => inputRef.current?.click();

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const local = URL.createObjectURL(file);
    setPreview(local);
    setBusy(true);

    try {
      const res = await uploadComboCover(comboId, file); // -> { id, nombre, cover_url }
      setPreview(res.cover_url || "");
      onUploaded?.(res.cover_url || "");
    } catch (err) {
      alert(
        err?.response?.data?.error ||
          err.message ||
          "Error subiendo la imagen"
      );
      setPreview(coverUrl || "");
    } finally {
      setBusy(false);
    }
  };

  const display = preview || FALLBACK;
  const imgSrc =
    display.startsWith("http") && !display.includes("data:")
      ? proxyImg(display, 320, 240)
      : display;

  return (
    <div className="space-y-2">
      <div className="w-full aspect-[4/3] overflow-hidden rounded-xl border bg-neutral-50">
        <img
          src={imgSrc}
          alt="Portada del combo"
          className="h-full w-full object-cover"
          onError={(e) => (e.currentTarget.src = FALLBACK)}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openPicker}
          disabled={busy}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
        >
          {busy ? "Subiendo..." : "Cambiar imagen"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleChange}
          disabled={busy}
        />
      </div>
    </div>
  );
}
