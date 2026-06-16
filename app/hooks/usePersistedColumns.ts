import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "@remix-run/react";

import { readLocalColumns, writeLocalColumns } from "../utils/ui-preferences";

export function usePersistedColumns<T extends string>(
  shop: string,
  key: "poColumns" | "productColumns",
  defaults: T[],
  serverValues?: string[] | null,
) {
  const prefsFetcher = useFetcher();
  const [columns, setColumnsState] = useState<T[]>(() => {
    const local = readLocalColumns(shop, key);
    if (local?.length) return local as T[];
    if (serverValues?.length) return serverValues as T[];
    return defaults;
  });

  useEffect(() => {
    const local = readLocalColumns(shop, key);
    if (local?.length) {
      setColumnsState(local as T[]);
      return;
    }
    if (serverValues?.length) {
      setColumnsState(serverValues as T[]);
    }
  }, [shop, key, serverValues]);

  const setColumns = useCallback((next: T[]) => {
    setColumnsState(next);
    writeLocalColumns(shop, key, next);
    const fd = new FormData();
    fd.set("intent", "saveColumnPrefs");
    fd.set("key", key);
    fd.set("value", JSON.stringify(next));
    prefsFetcher.submit(fd, { method: "post", action: "/app/api/column-preferences" });
  }, [shop, key, prefsFetcher]);

  return [columns, setColumns] as const;
}
