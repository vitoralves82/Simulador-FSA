
import React from 'react';

interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const Button: React.FC<ButtonProps> = ({ onClick, children, className = '', disabled = false, type = 'button' }) => {
  const baseClasses = "px-6 py-2 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-all duration-200";
  const enabledClasses = "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500";
  const disabledClasses = "bg-gray-300 text-gray-500 cursor-not-allowed";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${disabled ? disabledClasses : enabledClasses} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
