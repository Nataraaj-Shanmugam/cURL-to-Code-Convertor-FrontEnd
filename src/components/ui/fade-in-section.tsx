import { useLayoutEffect, useRef, useState } from "react";

/** True when the user asked the OS/browser for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Reveals a section as it scrolls into view. Content is visible by default: it is only hidden when
 * the section starts below the fold, motion is allowed and IntersectionObserver exists. Anything
 * else (no JS yet, reduced motion, an old browser, a section already on screen) just shows it, so
 * text is never stuck at opacity 0.
 */
export function FadeInSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  // Layout effect: the section is hidden before first paint, so below-fold content never flashes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setHidden(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHidden(false);
          observer.disconnect();
        }
      },
      { rootMargin: "-60px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      data-reveal={hidden ? "pending" : "done"}
      style={{
        opacity: hidden ? 0 : 1,
        transform: hidden ? "translateY(24px)" : "none",
        transition: `opacity 0.5s ${delay}s ease-out, transform 0.5s ${delay}s ease-out`,
      }}
    >
      {children}
    </div>
  );
}
