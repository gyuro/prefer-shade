'use client';

import { clsx } from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: Props) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500': variant === 'primary',
          'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:ring-gray-300': variant === 'secondary',
          'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-300': variant === 'ghost',
        },
        {
          'text-xs px-2.5 py-1.5': size === 'sm',
          'text-sm px-4 py-2': size === 'md',
          'text-base px-6 py-3': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
