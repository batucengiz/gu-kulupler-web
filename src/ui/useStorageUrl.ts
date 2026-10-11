import { useEffect, useState } from 'react';
import { urlOf } from '../data/repo/storage';
/** Storage yolunu indirme URL'sine çevirir (önbellekli). */
export function useStorageUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true; setUrl(null);
    if (path) urlOf(path).then((u) => { if (alive) setUrl(u); }).catch(() => undefined);
    return () => { alive = false; };
  }, [path]);
  return url;
}
