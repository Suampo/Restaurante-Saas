// src/hooks/useRestaurantName.js
import { useEffect, useState } from "react";
import { fetchRestaurantName } from "../services/restaurantApi";

export default function useRestaurantName(restaurantId) {
  const [name, setName] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const n = await fetchRestaurantName(restaurantId);
        if (alive) setName(n || "");
      } catch {
        if (alive) setName("");
      }
    })();
    return () => { alive = false; };
  }, [restaurantId]);

  return name;
}
