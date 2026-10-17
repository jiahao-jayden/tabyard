import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateBookmark, type Bookmark } from '@/utils/collect/store';

function EditForm({ bookmark, onClose }: { bookmark: Bookmark; onClose: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(bookmark.title);
  const [description, setDescription] = useState(bookmark.description);

  const submit = async () => {
    await updateBookmark(bookmark.id, { title: title.trim() || bookmark.title, description: description.trim() });
    onClose();
  };

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="space-y-2">
        <Label htmlFor="bm-title">{t('collect.fieldTitle')}</Label>
        <Input id="bm-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bm-desc">{t('collect.fieldDescription')}</Label>
        <Input id="bm-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <p className="truncate text-xs text-muted-foreground">{bookmark.url}</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t('collect.cancel')}</Button>
        <Button type="submit">{t('collect.save')}</Button>
      </DialogFooter>
    </form>
  );
}

export function EditBookmarkDialog({ bookmark, onClose }: { bookmark: Bookmark | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={bookmark !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('collect.edit')}</DialogTitle>
        </DialogHeader>
        {/* key 保证切换到另一条收藏时表单重新初始化 */}
        {bookmark && <EditForm key={bookmark.id} bookmark={bookmark} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
