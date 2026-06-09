import { Loader2 } from "lucide-react";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

const sizeStyles = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function Loader({ size = "md", className = "", text }: LoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2
        className={`animate-spin text-zinc-500 ${sizeStyles[size]} ${className}`}
      />
      {text && <p className="text-sm text-zinc-400">{text}</p>}
    </div>
  );
}

// Full Page Loader
interface FullPageLoaderProps {
  text?: string;
}

export function FullPageLoader({ text = "Loading..." }: FullPageLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader size="lg" text={text} />
    </div>
  );
}

// Inline Loader for buttons
interface InlineLoaderProps {
  className?: string;
}

export function InlineLoader({ className = "" }: InlineLoaderProps) {
  return <Loader2 className={`h-4 w-4 animate-spin ${className}`} />;
}
