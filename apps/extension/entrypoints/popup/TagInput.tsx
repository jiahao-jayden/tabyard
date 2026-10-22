import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { normalizeTag, normalizeTags } from '@/utils/clip/tags';

export function TagInput({ tags, history, onChange }: {
  tags: string[];
  history: string[];
  onChange: (tags: string[]) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  const add = (value: string) => {
    if (!normalizeTag(value)) return;
    onChange(normalizeTags([...tags, value]));
    setInput('');
  };
  const remove = (tag: string) => onChange(tags.filter((item) => item !== tag));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !input && tags.length) remove(tags.at(-1)!);
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    add(input);
  };

  const suggestions = history.filter((tag) => !tags.includes(tag)).slice(0, 8);

  return (
    <div className="space-y-1.5">
      <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-card px-1.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex h-5 items-center gap-0.5 rounded-full bg-secondary pr-0.5 pl-2 text-xs text-secondary-foreground">
            #{tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={t('clip.removeTag', { tag })}
              className="grid size-4 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={tags.length ? '' : t('clip.tagPlaceholder')}
          aria-label={t('clip.tags')}
          className="h-5 min-w-16 flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="inline-flex h-5 items-center gap-0.5 rounded-full border border-dashed px-1.5 text-xs text-muted-foreground hover:border-solid hover:text-foreground"
            >
              <Plus className="size-3" />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
