'use client';

/**
 * Retro-web primitives for the Browser's *viewport* — everything rendered
 * "inside the page", as opposed to the browser chrome around it.
 *
 * Deliberate exception to the design system: the OS chrome uses the System 7
 * tokens from globals.css, but the document loaded inside the browser is
 * supposed to look like a 1996 personal home page — Times, blue underlined
 * links, purple visited links, grey horizontal rules. Those colours are the
 * period-correct browser defaults, not theme colours, so they live here as
 * named constants instead of being pulled from @theme. That contrast between
 * the crisp Mac chrome and the shabby web page inside it is the joke.
 *
 * Contains NO copy about the site's owner — all of that comes from
 * content/bio.ts via site.tsx.
 */

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ urls -- */

/** The imaginary host every internal page lives on. */
export const SITE_HOST = 'home.local';

/** '/about.html' -> 'http://home.local/about.html' */
export function pageUrl(path: string): string {
  return `http://${SITE_HOST}${path}`;
}

/**
 * Turn whatever the user typed into the location bar into an internal path.
 * Accepts 'about', '/about.html', 'home.local/skills', 'http://home.local/'.
 * Unknown paths are still returned — the router renders a 404 for them, which
 * is far more fun than silently refusing to navigate.
 */
export function normalizePath(input: string): string {
  let s = input.trim().toLowerCase();
  if (!s) return '/';
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  if (s.startsWith(SITE_HOST)) s = s.slice(SITE_HOST.length);
  if (!s.startsWith('/')) s = `/${s}`;
  s = s.replace(/\/+$/, '') || '/';
  if (s === '/index.html' || s === '/home' || s === '/home.html') return '/';
  if (s !== '/' && !s.includes('.')) s += '.html';
  return s;
}

/* ------------------------------------------------------------- palette ---- */

/** Netscape 3's default document colours, near enough. */
export const WEB = {
  paper: '#ffffff',
  ink: '#111111',
  link: '#0000ee',
  visited: '#551a8b',
  rule: '#9a9a9a',
  panel: '#f0efe6',
  panelInk: '#3a3a34',
} as const;

/** The body face of every page that ever had a <blink> tag on it. */
export const WEB_SERIF = '"Times New Roman", Times, Georgia, serif';

/* ------------------------------------------------- navigation plumbing ---- */

interface BrowserNavApi {
  /** Follow an internal link. */
  navigate: (path: string) => void;
  /** Has this path been visited this session? Drives the purple link colour. */
  isVisited: (path: string) => boolean;
  /** Mirror a link target into the status bar, like a real browser. */
  setHover: (url: string | null) => void;
}

const NavContext = createContext<BrowserNavApi | null>(null);

export function BrowserNavProvider({
  value,
  children,
}: {
  value: BrowserNavApi;
  children: ReactNode;
}) {
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useBrowserNav(): BrowserNavApi {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useBrowserNav must be used inside <BrowserNavProvider>');
  return ctx;
}

/* ---------------------------------------------------------------- links --- */

const LINK_CLASS = 'underline underline-offset-2 cursor-pointer break-words';

/** An internal link. Real anchor, real href, intercepted for in-app routing. */
export function PageLink({
  to,
  children,
  className = '',
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  const nav = useBrowserNav();
  const url = pageUrl(to);
  return (
    <a
      href={url}
      onClick={(e) => {
        e.preventDefault();
        nav.navigate(to);
      }}
      onMouseEnter={() => nav.setHover(url)}
      onMouseLeave={() => nav.setHover(null)}
      onFocus={() => nav.setHover(url)}
      onBlur={() => nav.setHover(null)}
      style={{ color: nav.isVisited(to) ? WEB.visited : WEB.link }}
      className={`${LINK_CLASS} ${className}`}
    >
      {children}
    </a>
  );
}

/** A link that really does leave the OS. */
export function ExternalLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const nav = useBrowserNav();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => nav.setHover(href)}
      onMouseLeave={() => nav.setHover(null)}
      onFocus={() => nav.setHover(href)}
      onBlur={() => nav.setHover(null)}
      style={{ color: WEB.link }}
      className={`${LINK_CLASS} ${className}`}
    >
      {children}
    </a>
  );
}

/* ----------------------------------------------------------- typography --- */

/**
 * The document surface. Everything a page renders goes inside one of these.
 *
 * It is also the container-query root: pages lay themselves out against the
 * width of the *viewport element*, not the browser tab, so the page reflows
 * correctly when the OS window is resized as well as on a phone.
 */
export function Paper({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ fontFamily: WEB_SERIF, background: WEB.paper, color: WEB.ink }}
      className="@container min-h-full select-text px-4 py-4 text-[15px] leading-[1.5]"
    >
      {children}
    </div>
  );
}

/** The one big centred heading at the top of a page. */
export function Headline({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-center text-[26px] leading-tight font-bold @[480px]:text-[32px]">
      {children}
    </h1>
  );
}

/** Section heading inside a page. */
export function SubHead({ children }: { children: ReactNode }) {
  return <h2 className="mt-4 mb-1 text-[19px] font-bold">{children}</h2>;
}

/** The workhorse of the 1996 web. */
export function Rule({ shade = false }: { shade?: boolean }) {
  return (
    <hr
      className="my-3 border-0"
      style={{
        height: shade ? 3 : 2,
        background: WEB.rule,
        boxShadow: shade ? `inset 0 1px 0 0 ${WEB.paper}` : undefined,
      }}
    />
  );
}

export function Para({ children }: { children: ReactNode }) {
  return <p className="my-2">{children}</p>;
}

/** A bordered box — the 90s answer to a card. */
export function Panel({
  title,
  children,
  className = '',
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-2 p-2.5 ${className}`}
      style={{ borderColor: WEB.rule, background: WEB.panel, color: WEB.panelInk }}
    >
      {title && (
        <div className="mb-1.5 text-[13px] font-bold tracking-wide uppercase">{title}</div>
      )}
      {children}
    </div>
  );
}

/** Small centred print at the bottom of every page. */
export function PageFooter({ children }: { children?: ReactNode }) {
  return (
    <>
      <Rule shade />
      <div className="pb-2 text-center text-[12px]" style={{ color: WEB.panelInk }}>
        {children}
        <div className="mt-1">Best viewed at 800&times;600 &middot; Made with a text editor</div>
      </div>
    </>
  );
}
