import { cn } from "@/lib/utils";

interface TourneyHubLogoProps {
  className?: string;
  size?: number;
  variant?: "mark" | "full";
  inverse?: boolean;
}

export function TourneyHubLogo({
  className,
  size = 32,
  variant = "mark",
  inverse = false,
}: TourneyHubLogoProps) {
  if (variant === "full") {
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <LogoMark size={size} inverse={inverse} />
        <span className="text-lg font-bold tracking-tight">
          Tourney
          <span className={inverse ? "opacity-80" : "text-primary"}>Hub</span>
        </span>
      </div>
    );
  }

  return <LogoMark size={size} className={className} inverse={inverse} />;
}

function LogoMark({
  size = 32,
  className,
  inverse = false,
}: {
  size?: number;
  className?: string;
  inverse?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
    >
      <path
        d="M20 2L36 9V22C36 30.5 28.5 37 20 39C11.5 37 4 30.5 4 22V9L20 2Z"
        className={inverse ? "fill-primary-foreground" : "fill-primary"}
      />
      <path
        d="M12 14H28"
        className={inverse ? "stroke-primary" : "stroke-primary-foreground"}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M20 14V30"
        className={inverse ? "stroke-primary" : "stroke-primary-foreground"}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
