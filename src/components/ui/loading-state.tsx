import { cn } from "@/lib/utils";

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      role="status"
      aria-hidden="true"
    />
  );
}

function LoadingState({
  text = "Loading...",
  variant = "inline",
  className,
}: {
  text?: string;
  variant?: "inline" | "centered";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground",
        variant === "centered" && "justify-center py-12",
        className
      )}
      role="status"
    >
      <Spinner />
      <span>{text}</span>
    </div>
  );
}

export { LoadingState, Spinner };
