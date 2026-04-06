import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'gray' | 'upload';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  className = '',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  ...props
}) => {
  const isDisabled = !!props.disabled;
  const baseClasses = 'font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-2';

  const variants = {
    primary: 'bg-blue-500 text-white shadow-blue-500/25',
    secondary: 'bg-emerald-500 text-white shadow-emerald-500/25',
    success: 'bg-green-500 text-white shadow-green-500/25',
    danger: 'bg-red-500 text-white shadow-red-500/25',
    warning: 'bg-yellow-500 text-white shadow-yellow-500/25',
    gray: 'bg-gray-600 text-white shadow-gray-600/25',
    upload: 'bg-blue-600 text-white shadow-blue-600/25'
  };
  
  const sizes = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3.5 py-2 text-sm',
    lg: 'px-4 py-2.5 text-sm'
  };
  
  const disabledClasses = isDisabled
    ? 'opacity-50 cursor-not-allowed shadow-none hover:bg-none hover:shadow-none'
    : 'shadow-lg hover:shadow-xl cursor-pointer hover:cursor-pointer';

  const classes = [
    baseClasses,
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
    disabledClasses,
    className
  ].filter(Boolean).join(' ');
  
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
};

export default Button;
