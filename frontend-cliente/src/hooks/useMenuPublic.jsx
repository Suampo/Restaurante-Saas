import { useContext } from "react";
import { MenuPublicCtx } from "./MenuProvider.jsx";

export function useMenuPublic() {
  const ctx = useContext(MenuPublicCtx);
  if (!ctx) throw new Error("useMenuPublic debe usarse dentro de <MenuProvider>");
  return ctx;
}
