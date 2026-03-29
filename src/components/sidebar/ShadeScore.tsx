'use client';

interface Props {
  score: number; // 0–100
  label?: string;
}

export function ShadeScore({ score, label }: Props) {
  const color =
    score >= 60 ? 'bg-green-500' : score >= 30 ? 'bg-yellow-400' : 'bg-orange-400';

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs text-gray-500">{label}</span>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-sm font-bold text-gray-800 w-10 text-right">{score}%</span>
      </div>
    </div>
  );
}
