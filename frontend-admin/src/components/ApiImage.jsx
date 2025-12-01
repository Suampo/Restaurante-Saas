// frontend-admin/src/components/ApiImage.jsx
import { proxyImg } from "../utils/imageProxy";

const FALLBACK = "/no-image.png";

/**
 * Componente para imágenes que vienen de Supabase
 * y pasan por /img del backend-pedidos.
 *
 * - Aplica proxyImg(url, width, height)
 * - Añade loading="lazy" y decoding="async"
 * - Define width/height para evitar CLS
 */
export default function ApiImage({
  url,
  alt = "",
  width = 400,
  height = 300,
  className = "",
  fit = "cover",
  ...rest
}) {
  // Si no hay url, usamos fallback
  const src = url ? proxyImg(url, width, height) : FALLBACK;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      width={width}
      height={height}
      className={className}
      onError={(e) => {
        if (FALLBACK) {
          e.currentTarget.src = FALLBACK;
        }
      }}
      {...rest}
    />
  );
}
