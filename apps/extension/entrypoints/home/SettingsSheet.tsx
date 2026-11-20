import { useTranslation } from 'react-i18next';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { mutateNewtabSettings, type NewtabSettings } from '@/utils/newtab-settings';
import { Group, Row, ToggleRow } from './SettingsParts';
import { WallpaperSection } from './WallpaperSection';

const update = (patch: Partial<NewtabSettings>) => mutateNewtabSettings((s) => ({ ...s, ...patch }));

type SectionKey = keyof NewtabSettings['sections'];
const SECTIONS: SectionKey[] = ['shortcuts', 'bookmarks', 'collect', 'clock'];

export function SettingsSheet({ open, onClose, settings }: {
  open: boolean;
  onClose: () => void;
  settings: NewtabSettings;
}) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="panel-scrollbar pr-3">
        <SheetHeader>
          <SheetTitle>{t('newtab.settings')}</SheetTitle>
          <SheetDescription className="sr-only">{t('newtab.settings')}</SheetDescription>
        </SheetHeader>
        <div className="space-y-6">
          <Group title={t('newtab.sectionsTitle')}>
            {SECTIONS.map((key) => (
              <ToggleRow
                key={key}
                id={`nt-${key}`}
                label={t(`newtab.section.${key}`)}
                checked={settings.sections[key]}
                onChange={(value) => void update({ sections: { ...settings.sections, [key]: value } })}
              />
            ))}
            <ToggleRow
              id="nt-24h"
              label={t('newtab.clock24h')}
              checked={settings.clock24h}
              onChange={(value) => void update({ clock24h: value })}
            />
          </Group>

          <Group title={t('newtab.appearanceTitle')}>
            <Row label={t('newtab.themeTitle')}>
              <Select value={settings.theme} onValueChange={(v) => void update({ theme: v as NewtabSettings['theme'] })}>
                <SelectTrigger className="w-36" aria-label={t('newtab.themeTitle')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t('newtab.themeAuto')}</SelectItem>
                  <SelectItem value="light">{t('newtab.themeLight')}</SelectItem>
                  <SelectItem value="dark">{t('newtab.themeDark')}</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </Group>

          <WallpaperSection wallpaper={settings.wallpaper} />

          <Group title={t('newtab.behaviorTitle')}>
            <ToggleRow
              id="nt-suggestions"
              label={t('newtab.suggestions')}
              checked={settings.suggestions}
              onChange={(value) => void update({ suggestions: value })}
            />
            <ToggleRow
              id="nt-history"
              label={t('newtab.historySuggestions')}
              hint={t('newtab.historySuggestionsHint')}
              checked={settings.historySuggestions}
              onChange={(value) => void update({ historySuggestions: value })}
            />
            <ToggleRow
              id="nt-web-suggestions"
              label={t('newtab.webSuggestions')}
              hint={t('newtab.webSuggestionsHint')}
              checked={settings.webSuggestions}
              onChange={(value) => void update({ webSuggestions: value })}
            />
            <ToggleRow
              id="nt-open"
              label={t('newtab.openInNewTab')}
              checked={settings.openInNewTab}
              onChange={(value) => void update({ openInNewTab: value })}
            />
          </Group>
        </div>
      </SheetContent>
    </Sheet>
  );
}
