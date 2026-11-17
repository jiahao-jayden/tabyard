import { cn } from 'cn';
import type { SearchSource, SearchSourceId } from '@/utils/search-sources';
import { SOURCE_ICONS } from './source-icons';

export function SourceIcon({ source, className }: { source: SearchSource; className?: string }) {
  return <img src={SOURCE_ICONS[source.id as SearchSourceId]} alt="" className={cn('object-contain', className)} />;
}
