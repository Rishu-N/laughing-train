'use client';

/**
 * ProjectApp — the ONE component behind every project window.
 *
 * `lib/apps/projects.apps.ts` generates one AppDefinition per entry in
 * content/projects.ts, all pointing at this same component with a different
 * `params.projectId`. Adding a project is a single content edit; this file
 * never changes for that. Every string a reader sees about the project comes
 * from content/projects.ts — only UI chrome labels ("Built with", "Links",
 * "Status") are hardcoded here.
 */
import Image from 'next/image';
import { useEffect } from 'react';
import { AppFrame, StatusBar, Toolbar, ToolbarSpacer } from '@/components/os/ui';
import { projects } from '@/content/projects';
import type { AppWindowProps } from '@/lib/os/types';

export default function ProjectApp({ params, setTitle }: AppWindowProps) {
  const projectId = params?.projectId;
  const project = projects.find((p) => p.id === projectId);

  // Keep the window title bar in sync with the project, once it resolves.
  useEffect(() => {
    if (project) setTitle(project.title);
  }, [project, setTitle]);

  if (!project) {
    return (
      <AppFrame
        toolbar={
          <Toolbar>
            <span>Project</span>
          </Toolbar>
        }
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="font-[family-name:var(--font-os-ui)] text-[13px] text-os-ink">
            Project not found
          </p>
          <p className="max-w-xs font-[family-name:var(--font-os-body)] text-[12px] text-os-ink-soft">
            {projectId
              ? `No project with id "${projectId}" exists in content/projects.ts.`
              : 'No project id was passed to this window.'}
          </p>
        </div>
      </AppFrame>
    );
  }

  return (
    <AppFrame
      toolbar={
        <Toolbar>
          <span className="truncate">{project.title}</span>
          <ToolbarSpacer />
          {project.status && (
            <span className="os-bevel-in shrink-0 rounded-[3px] bg-os-face px-1.5 py-0.5 text-[10px] text-os-ink-soft">
              {project.status}
            </span>
          )}
        </Toolbar>
      }
      status={
        <StatusBar>
          <span>{project.language}</span>
          <span aria-hidden>·</span>
          <span>{project.year}</span>
        </StatusBar>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        {/* Header: title, year, status chip, language */}
        <header className="flex flex-col gap-1 border-b border-os-ink pb-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h1 className="font-[family-name:var(--font-os-ui)] text-[15px] text-os-ink">
              {project.title}
            </h1>
            <span className="font-[family-name:var(--font-os-body)] text-[12px] text-os-ink-soft">
              {project.year}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="os-bevel rounded-[3px] bg-os-chrome px-1.5 py-0.5 text-[10px] os-chrome-text">
              {project.language}
            </span>
            {project.status && (
              <span className="os-bevel rounded-[3px] bg-os-chrome px-1.5 py-0.5 text-[10px] os-chrome-text">
                {project.status}
              </span>
            )}
          </div>
          <p className="font-[family-name:var(--font-os-body)] text-[13px] text-os-ink">
            {project.blurb}
          </p>
        </header>

        {/* Screenshot */}
        <div className="os-inset flex w-full items-center justify-center overflow-hidden bg-os-well p-2">
          <Image
            src={project.screenshot}
            alt={`Screenshot of ${project.title}`}
            width={800}
            height={500}
            className="pixelated h-auto w-full max-w-full object-contain"
            sizes="(max-width: 480px) 100vw, 640px"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          {project.description.map((paragraph, i) => (
            <p
              key={i}
              className="font-[family-name:var(--font-os-body)] text-[13px] leading-snug text-os-ink"
            >
              {paragraph}
            </p>
          ))}
        </div>

        {/* Tech stack */}
        {project.tech.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="font-[family-name:var(--font-os-ui)] text-[10px] text-os-ink-soft">
              Built with
            </span>
            <div className="flex flex-wrap gap-1.5">
              {project.tech.map((t) => (
                <span
                  key={t}
                  className="os-bevel rounded-[3px] bg-os-chrome px-1.5 py-0.5 text-[10px] os-chrome-text"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        {project.links.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="font-[family-name:var(--font-os-ui)] text-[10px] text-os-ink-soft">
              Links
            </span>
            <div className="flex flex-wrap gap-2">
              {project.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="os-button os-chrome-text inline-flex items-center no-underline active:os-bevel-in active:translate-y-px hover:brightness-[0.98]"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppFrame>
  );
}
