import type { TurnDirection } from '@/types/navigation';

const PATHS: Record<TurnDirection, string> = {
  straight:     'M12 4 L12 20 M6 10 L12 4 L18 10',
  slight_left:  'M17 19 Q8 14 10 5 M14 5 L10 5 L10 9',
  left:         'M18 17 Q6 17 6 7 M10 3 L6 7 L10 11',
  sharp_left:   'M18 8 Q10 8 10 18 M6 12 L10 18 L14 12',
  slight_right: 'M7 19 Q16 14 14 5 M10 5 L14 5 L14 9',
  right:        'M6 17 Q18 17 18 7 M14 3 L18 7 L14 11',
  sharp_right:  'M6 8 Q14 8 14 18 M18 12 L14 18 L10 12',
  arrive:       'M12 4 L12 16 M7 11 L12 16 L17 11 M7 20 L17 20',
};

interface Props {
  direction: TurnDirection;
  size?: number;
  color?: string;
}

export function NavigationArrow({ direction, size = 48, color = 'white' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={PATHS[direction]} />
    </svg>
  );
}
