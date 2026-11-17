import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

/** 订阅 storage.local 的某个键，以存储为唯一数据源；首次读取完成前返回 null */
export function useStored<T>(key: string, load: () => Promise<T>): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    const refresh = () => void load().then(setValue);
    refresh();
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && key in changes) refresh();
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, [key, load]);
  return value;
}
