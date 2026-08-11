'use client';

/**
 * The "web site" loaded inside the Browser app.
 *
 * Five pages plus a 404. Every word of copy on them comes from content/bio.ts —
 * the only strings written here are navigation labels and period jokes, which
 * are chrome, not content. If you want to change what the site says, edit
 * content/bio.ts and leave this file alone.
 */

import Image from 'next/image';
import type { ComponentType, ReactNode } from 'react';
import { bio } from '@/content/bio';
import { SELF_PORTRAIT } from '@/content/images';
import {
  ExternalLink,
  Headline,
  PageFooter,
  PageLink,
  Panel,
  Para,
  Paper,
  Rule,
  SubHead,
  WEB,
  useBrowserNav,
} from './retro';

/* ----------------------------------------------------------------- model -- */

export interface PageDef {
  /** Internal path; also what the location bar shows after the host. */
  path: string;
  /** Nav label and window title. */
  title: string;
  Component: ComponentType;
}

/* ------------------------------------------------------------ nav strip --- */

/** The link bar that sits under the banner on every page. */
function NavStrip({ current }: { current: string }) {
  return (
    <nav className="text-center text-[14px] leading-[1.8]">
      {PAGES.map((p, i) => (
        <span key={p.path}>
          {i > 0 && <span className="mx-1.5 opacity-50">|</span>}
          {p.path === current ? (
            <strong>{p.title}</strong>
          ) : (
            <PageLink to={p.path}>{p.title}</PageLink>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Banner + nav, shared by every page. */
function PageTop({ current, heading }: { current: string; heading?: ReactNode }) {
  return (
    <>
      <Headline>{heading ?? bio.name}</Headline>
      {!heading && (
        <p className="mt-1 text-center text-[16px] italic">{bio.tagline}</p>
      )}
      <Rule shade />
      <NavStrip current={current} />
      <Rule />
    </>
  );
}

/* ----------------------------------------------------------------- home --- */

function HomePage() {
  return (
    <Paper>
      <PageTop current="/" />

      <div className="flex flex-col gap-4 @[480px]:flex-row @[480px]:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <Image
              src={SELF_PORTRAIT}
              alt={`Portrait of ${bio.name}`}
              width={104}
              height={104}
              className="pixelated shrink-0 border-2"
              style={{ borderColor: WEB.rule }}
            />
            <dl className="min-w-0 text-[14px]">
              {bio.status && (
                <>
                  <dt className="font-bold">Currently</dt>
                  <dd className="mb-1.5">{bio.status}</dd>
                </>
              )}
              {bio.location && (
                <>
                  <dt className="font-bold">Location</dt>
                  <dd className="mb-1.5">{bio.location}</dd>
                </>
              )}
              {bio.email && (
                <>
                  <dt className="font-bold">Mail</dt>
                  <dd className="break-all">
                    <ExternalLink href={`mailto:${bio.email}`}>{bio.email}</ExternalLink>
                  </dd>
                </>
              )}
            </dl>
          </div>

          {bio.about[0] && (
            <>
              <Para>{bio.about[0]}</Para>
              <p className="my-2 text-[14px]">
                <PageLink to="/about.html">More about me &raquo;</PageLink>
              </p>
            </>
          )}
        </div>

        {bio.nowPlaying && bio.nowPlaying.length > 0 && (
          <aside className="w-full shrink-0 @[480px]:w-[210px]">
            <Panel title="Right now">
              <ul className="list-disc pl-4 text-[13px] leading-[1.6]">
                {bio.nowPlaying.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Panel>
          </aside>
        )}
      </div>

      <Rule />

      <SubHead>Contents</SubHead>
      <ul className="list-disc pl-5 text-[14px] leading-[1.7]">
        <li>
          <PageLink to="/about.html">About Me</PageLink> — the long version
        </li>
        <li>
          <PageLink to="/skills.html">Skills</PageLink> — things I work with
        </li>
        <li>
          <PageLink to="/links.html">Links</PageLink> — where else I am
        </li>
        <li>
          <PageLink to="/contact.html">Contact</PageLink> — say hello
        </li>
      </ul>

      <PageFooter>
        <div className="mb-1">
          You are visitor number{' '}
          <span
            className="px-1 font-mono tracking-[0.2em]"
            style={{ background: WEB.ink, color: WEB.paper }}
          >
            00000512
          </span>
        </div>
      </PageFooter>
    </Paper>
  );
}

/* ---------------------------------------------------------------- about --- */

function AboutPage() {
  return (
    <Paper>
      <PageTop current="/about.html" heading="About Me" />
      <div className="mx-auto max-w-[62ch]">
        {bio.about.map((paragraph, i) => (
          <Para key={i}>{paragraph}</Para>
        ))}
        <Rule />
        <p className="text-[14px]">
          <PageLink to="/skills.html">Next: what I work with &raquo;</PageLink>
        </p>
      </div>
      <PageFooter />
    </Paper>
  );
}

/* --------------------------------------------------------------- skills --- */

function SkillsPage() {
  return (
    <Paper>
      <PageTop current="/skills.html" heading="Skills" />
      <ul
        className="mx-auto max-w-[62ch] list-disc columns-1 gap-8 pl-5 text-[15px] leading-[1.8] @[420px]:columns-2"
        style={{ listStylePosition: 'outside' }}
      >
        {bio.skills.map((skill) => (
          <li key={skill} className="break-inside-avoid">
            {skill}
          </li>
        ))}
      </ul>
      <Rule />
      <p className="mx-auto max-w-[62ch] text-[14px]">
        <PageLink to="/links.html">Next: where else to find me &raquo;</PageLink>
      </p>
      <PageFooter />
    </Paper>
  );
}

/* ---------------------------------------------------------------- links --- */

function LinksPage() {
  return (
    <Paper>
      <PageTop current="/links.html" heading="Links" />
      <div className="mx-auto max-w-[62ch]">
        {bio.socials.length === 0 ? (
          <Para>No links yet.</Para>
        ) : (
          <ul className="my-2 space-y-2.5">
            {bio.socials.map((social) => (
              <li key={social.url} className="flex flex-col gap-0.5">
                <span className="text-[15px]">
                  <ExternalLink href={social.url} className="font-bold">
                    {social.label}
                  </ExternalLink>
                  {social.handle && (
                    <span className="ml-2 text-[13px] opacity-70">{social.handle}</span>
                  )}
                </span>
                <span className="text-[12px] break-all opacity-60">{social.url}</span>
              </li>
            ))}
          </ul>
        )}
        <Rule />
        <p className="text-[13px] italic opacity-70">
          External links open in a new window and leave this desktop.
        </p>
        <p className="mt-2 text-[14px]">
          <PageLink to="/contact.html">Next: contact &raquo;</PageLink>
        </p>
      </div>
      <PageFooter />
    </Paper>
  );
}

/* -------------------------------------------------------------- contact --- */

function ContactPage() {
  return (
    <Paper>
      <PageTop current="/contact.html" heading="Contact" />
      <div className="mx-auto max-w-[62ch]">
        {bio.email ? (
          <Panel title="Electronic mail">
            <p className="text-[17px] break-all">
              <ExternalLink href={`mailto:${bio.email}`}>{bio.email}</ExternalLink>
            </p>
          </Panel>
        ) : (
          <Para>No email address listed.</Para>
        )}

        {bio.location && (
          <p className="mt-3 text-[14px]">
            <span className="font-bold">Based in: </span>
            {bio.location}
          </p>
        )}

        {bio.socials.length > 0 && (
          <p className="mt-2 text-[14px]">
            Or find me on <PageLink to="/links.html">the links page</PageLink>.
          </p>
        )}

        <Rule />
        <p className="text-[13px] italic opacity-70">
          No contact form. It is 1996 — you get a mailto and you like it.
        </p>
      </div>
      <PageFooter />
    </Paper>
  );
}

/* ------------------------------------------------------------------ 404 --- */

/** Rendered for any path the location bar accepts but the site does not have. */
export function NotFoundPage({ path }: { path: string }) {
  const nav = useBrowserNav();
  return (
    <Paper>
      <Headline>404</Headline>
      <p className="mt-1 text-center text-[16px] italic">File Not Found</p>
      <Rule shade />
      <div className="mx-auto max-w-[62ch]">
        <Para>
          The requested URL <code className="break-all">{path}</code> was not found on this
          server. Possibly it was never here.
        </Para>
        <p className="my-3 text-[14px]">
          <button
            type="button"
            onClick={() => nav.navigate('/')}
            style={{ color: WEB.link }}
            className="cursor-pointer underline underline-offset-2"
          >
            Return to the home page
          </button>
        </p>
        <NavStrip current={path} />
      </div>
      <PageFooter />
    </Paper>
  );
}

/* -------------------------------------------------------------- registry -- */

/** Every real page on the site, in nav order. The first entry is the home page. */
export const PAGES: PageDef[] = [
  { path: '/', title: 'Home', Component: HomePage },
  { path: '/about.html', title: 'About Me', Component: AboutPage },
  { path: '/skills.html', title: 'Skills', Component: SkillsPage },
  { path: '/links.html', title: 'Links', Component: LinksPage },
  { path: '/contact.html', title: 'Contact', Component: ContactPage },
];

export const HOME_PATH = PAGES[0].path;

export function getPage(path: string): PageDef | undefined {
  return PAGES.find((p) => p.path === path);
}
