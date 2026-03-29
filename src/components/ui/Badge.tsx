import { clsx } from 'clsx';

interface Props {
  label: string;
  variant?: 'green' | 'blue' | 'gray';
}

export function Badge({ label, variant = 'gray' }: Props) {
  return (
    <span
      className={clsx('inline-block text-xs font-semibold px-2 py-0.5 rounded-full', {
        'bg-green-100 text-green-700': variant === 'green',
        'bg-blue-100 text-blue-700': variant === 'blue',
        'bg-gray-100 text-gray-600': variant === 'gray',
      })}
    >
      {label}
    </span>
  );
}
