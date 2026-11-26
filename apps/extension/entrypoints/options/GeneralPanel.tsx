import type { Plan } from '@/utils/plan';
import { CaptureCard } from './CaptureCard';
import { McpCard } from './McpCard';
import { NewtabCard } from './NewtabCard';
import { SyncCard } from './SyncCard';

/** 与具体功能无关的通用设置：云同步、MCP、新标签页、截图与录屏 */
export function GeneralPanel({ plan }: { plan: Plan }) {
  return (
    <>
      <SyncCard plan={plan} />
      <McpCard plan={plan} />
      <NewtabCard />
      <CaptureCard />
    </>
  );
}
