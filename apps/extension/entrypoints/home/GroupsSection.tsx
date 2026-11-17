import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import type { GroupColor } from '@tabyard/shared';
import { COLOR_DOT } from '../options/colors';

interface GroupInfo {
  id: number;
  title: string;
  color: GroupColor;
  count: number;
  firstTabId: number;
}

async function loadGroups(): Promise<GroupInfo[]> {
  const { id: windowId } = await browser.windows.getCurrent();
  const [groups, tabs] = await Promise.all([
    browser.tabGroups.query({ windowId }),
    browser.tabs.query({ windowId }),
  ]);
  return groups.flatMap((g) => {
    const members = tabs.filter((tab) => tab.groupId === g.id);
    const firstTabId = members[0]?.id;
    return firstTabId == null
      ? []
      : [{ id: g.id, title: g.title ?? '', color: g.color as GroupColor, count: members.length, firstTabId }];
  });
}

/** 当前窗口的标签组；点击展开并切到该组的第一个标签页 */
export function GroupsSection() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<GroupInfo[]>([]);

  useEffect(() => {
    const refresh = () => void loadGroups().then(setGroups);
    const onTabUpdated = (_id: number, info: { groupId?: number }) => {
      if (info.groupId !== undefined) refresh();
    };
    refresh();
    browser.tabGroups.onCreated.addListener(refresh);
    browser.tabGroups.onUpdated.addListener(refresh);
    browser.tabGroups.onRemoved.addListener(refresh);
    browser.tabs.onCreated.addListener(refresh);
    browser.tabs.onRemoved.addListener(refresh);
    browser.tabs.onAttached.addListener(refresh);
    browser.tabs.onDetached.addListener(refresh);
    browser.tabs.onUpdated.addListener(onTabUpdated);
    return () => {
      browser.tabGroups.onCreated.removeListener(refresh);
      browser.tabGroups.onUpdated.removeListener(refresh);
      browser.tabGroups.onRemoved.removeListener(refresh);
      browser.tabs.onCreated.removeListener(refresh);
      browser.tabs.onRemoved.removeListener(refresh);
      browser.tabs.onAttached.removeListener(refresh);
      browser.tabs.onDetached.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(onTabUpdated);
    };
  }, []);

  if (groups.length === 0) return null;

  const open = async (group: GroupInfo) => {
    await browser.tabGroups.update(group.id, { collapsed: false });
    await browser.tabs.update(group.firstTabId, { active: true });
  };

  return (
    <section className="w-full space-y-3">
      <h2 className="text-sm font-medium dark:[text-shadow:0_1px_6px_rgb(0_0_0/0.5)]">{t('newtab.groupsTitle')}</h2>
      <ul className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm shadow-sm transition-colors hover:bg-muted"
              onClick={() => void open(g)}
            >
              <span className={`size-2.5 rounded-full ${COLOR_DOT[g.color]}`} />
              <span>{g.title || t('newtab.untitledGroup')}</span>
              <span className="text-xs text-muted-foreground">{g.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
