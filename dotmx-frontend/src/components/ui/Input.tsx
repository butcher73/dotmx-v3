import { LucideIcon } from "lucide-react";
import { InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  iconAction?: () => void;
  variant?: "default" | "filled";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      icon: Icon,
      iconPosition = "right",
      iconAction,
      variant = "default",
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "w-full rounded-lg border px-4 py-2.5 text-sm text-white transition-colors placeholder:text-zinc-500 focus:outline-none focus:ring-2";
    const variantStyles = {
      default: error
        ? "border-red-500/50 bg-zinc-900 ring-red-500/20 focus:border-red-500 focus:ring-red-500/30"
        : "border-zinc-800 bg-zinc-900 focus:border-blue-500 focus:ring-blue-500/20",
      filled: error
        ? "border-red-500/50 bg-zinc-800/50 ring-red-500/20 focus:border-red-500 focus:ring-red-500/30"
        : "border-zinc-700/50 bg-zinc-800/50 focus:border-blue-500 focus:ring-blue-500/20",
    };
    const iconPadding = Icon
      ? iconPosition === "left"
        ? "pl-10"
        : "pr-10"
      : "";

    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && iconPosition === "left" && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Icon className="h-5 w-5 text-zinc-500" />
            </div>
          )}
          <input
            ref={ref}
            className={`${baseStyles} ${variantStyles[variant]} ${iconPadding} ${className}`}
            {...props}
          />
          {Icon && iconPosition === "right" && (
            <div
              className={`absolute inset-y-0 right-0 flex items-center pr-3 ${iconAction ? "cursor-pointer" : "pointer-events-none"}`}
              onClick={iconAction}
            >
              <Icon
                className={`h-5 w-5 ${iconAction ? "text-zinc-400 hover:text-zinc-300" : "text-zinc-500"}`}
              />
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        {helperText && !error && (
          <p className="mt-1.5 text-xs text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

// Select Component
export interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
  variant?: "default" | "filled";
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      variant = "default",
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "w-full rounded-lg border px-4 py-2.5 text-sm text-white transition-colors focus:outline-none focus:ring-2";
    const variantStyles = {
      default: error
        ? "border-red-500/50 bg-zinc-900 ring-red-500/20 focus:border-red-500 focus:ring-red-500/30"
        : "border-zinc-800 bg-zinc-900 focus:border-blue-500 focus:ring-blue-500/20",
      filled: error
        ? "border-red-500/50 bg-zinc-800/50 ring-red-500/20 focus:border-red-500 focus:ring-red-500/30"
        : "border-zinc-700/50 bg-zinc-800/50 focus:border-blue-500 focus:ring-blue-500/20",
    };

    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`${baseStyles} ${variantStyles[variant]} ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        {helperText && !error && (
          <p className="mt-1.5 text-xs text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

// Textarea Component
export interface TextareaProps
  extends InputHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rows?: number;
  variant?: "default" | "filled";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      rows = 4,
      variant = "default",
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "w-full rounded-lg border px-4 py-2.5 text-sm text-white transition-colors placeholder:text-zinc-500 focus:outline-none focus:ring-2 resize-none";
    const variantStyles = {
      default: error
        ? "border-red-500/50 bg-zinc-900 ring-red-500/20 focus:border-red-500 focus:ring-red-500/30"
        : "border-zinc-800 bg-zinc-900 focus:border-blue-500 focus:ring-blue-500/20",
      filled: error
        ? "border-red-500/50 bg-zinc-800/50 ring-red-500/20 focus:border-red-500 focus:ring-red-500/30"
        : "border-zinc-700/50 bg-zinc-800/50 focus:border-blue-500 focus:ring-blue-500/20",
    };

    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          rows={rows}
          className={`${baseStyles} ${variantStyles[variant]} ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        {helperText && !error && (
          <p className="mt-1.5 text-xs text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
