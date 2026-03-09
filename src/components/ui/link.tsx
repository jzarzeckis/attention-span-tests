import * as React from "react";

/**
 * A client-side navigation link that renders as a proper <a> element with href.
 * Intercepts clicks to prevent full page reloads and instead uses the History API,
 * dispatching a popstate event so App-level routing picks up the new location.
 *
 * Usage with Button asChild:
 *   <Button asChild variant="ghost"><Link href="/scoreboard">Scoreboard</Link></Button>
 */
export function Link({
  href,
  onClick,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Let modifier keys / middle-click open in new tab naturally
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    if (window.location.pathname !== href) {
      window.history.pushState({}, "", href);
      // Notify App's popstate listener so it syncs React state
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
    onClick?.(e);
  };

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
