import * as React from "react";
import { cn } from "../lib/utils.js";

interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Optional image source. When absent a fallback is rendered. */
  src?: string;
  alt?: string;
  /** Fallback initials/emoji shown while the image is missing or loading. */
  fallback: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeClass: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

function Avatar({ src, alt, fallback, size = "md", className }: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const showFallback = !src || failed;
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground",
        sizeClass[size],
        className
      )}
    >
      {showFallback ? (
        <span aria-hidden>{fallback}</span>
      ) : (
        <img
          src={src}
          alt={alt ?? ""}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      )}
    </span>
  );
}
Avatar.displayName = "Avatar";

export { Avatar };
