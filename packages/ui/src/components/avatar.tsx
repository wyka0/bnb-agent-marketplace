import * as React from "react";
import { cn } from "../lib/utils.js";

interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Optional image source. When absent a fallback is rendered. */
  src?: string;
  /**
   * Accessible name for the avatar when a real image is rendered (applied to
   * the wrapper via aria-label — the <img> itself is decorative so a failed
   * or in-flight image can NEVER flash alt text or a broken-image icon).
   */
  alt?: string;
  /** Fallback initials/emoji shown while the image is missing, loading, or failed. */
  fallback: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeClass: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

/**
 * X.204 — deterministic image-fallback avatar.
 *
 * The initials fallback is ALWAYS rendered underneath; the image layer sits
 * on top and only becomes visible after a successful `onLoad`. A load
 * failure (`onError`) removes the image layer entirely. This guarantees:
 *   - no broken-image icon is ever visible (the image is transparent until
 *     it actually loads);
 *   - no alt text ever flashes inside the avatar (the <img> is decorative,
 *     `alt=""`; the accessible name lives on the wrapper via `aria-label`
 *     and only while a real image is shown);
 *   - the fallback initials remain the visible surface for missing, broken
 *     (404), empty, or still-loading sources — same dimensions/radius.
 */
function Avatar({ src, alt, fallback, size = "md", className, ...rest }: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      {...rest}
      role={showImage && loaded ? "img" : undefined}
      aria-label={showImage && loaded ? (alt ?? "") : undefined}
      aria-hidden={showImage && loaded ? undefined : true}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground",
        sizeClass[size],
        className
      )}
    >
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
        {fallback}
      </span>
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-150",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      ) : null}
    </span>
  );
}
Avatar.displayName = "Avatar";

export { Avatar };
