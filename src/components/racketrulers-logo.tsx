import Image from "next/image";
import { cn } from "@/lib/utils";

interface RacketRulersLogoProps {
  className?: string;
  size?: number;
  variant?: "mark" | "full";
  inverse?: boolean;
}

export function RacketRulersLogo({
  className,
  size = 32,
  variant = "mark",
  inverse = false,
}: RacketRulersLogoProps) {
  if (variant === "full") {
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <LogoMark size={size} inverse={inverse} />
        <span className="text-lg font-bold tracking-tight">
          Racket
          <span className={inverse ? "opacity-80" : "text-primary"}>Rulers</span>
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
    <Image
      src="/logo-mark.png"
      alt="RacketRulers"
      width={1499}
      height={1362}
      priority
      style={{ height: size, width: "auto" }}
      className={cn(
        "shrink-0 object-contain",
        inverse && "brightness-0 invert",
        className,
      )}
    />
  );
}
