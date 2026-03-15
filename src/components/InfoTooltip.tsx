/**
 * InfoTooltip — small ⓘ icon that shows a physics explanation on hover.
 * Uses position:fixed to escape overflow:hidden/auto parents (sidebars, panels).
 */

import { useState } from 'react';
import './InfoTooltip.css';

interface Props {
  text: string;
}

export function InfoTooltip({ text }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <span
      className="info-icon"
      onMouseEnter={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        // Try to keep tooltip on screen — clamp to viewport edges
        const x = Math.min(rect.right + 10, window.innerWidth - 260);
        const y = Math.max(rect.top - 4, 4);
        setPos({ x, y });
      }}
      onMouseLeave={() => setPos(null)}
    >
      ⓘ
      {pos && (
        <div
          className="info-tooltip-popup"
          style={{ left: pos.x, top: pos.y }}
        >
          {text}
        </div>
      )}
    </span>
  );
}
