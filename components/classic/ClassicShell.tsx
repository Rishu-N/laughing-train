'use client';

/**
 * The 1984 monochrome classic shell — the site's front door.
 *
 * OWNER: Classic Boot agent. This is a Phase 3 stub so the stage machine
 * compiles; replace its contents entirely.
 *
 * Call useStageStore.getState().beginUpdate() when the visitor accepts the
 * software update — that advances the stage machine into the transition.
 */
import { motion } from 'framer-motion';
import { useStageStore } from '@/lib/os/stageStore';

export default function ClassicShell() {
  const beginUpdate = useStageStore((s) => s.beginUpdate);

  return (
    <motion.div
      data-testid="classic-shell"
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-white text-black"
    >
      <p className="font-[family-name:var(--font-os-ui)] text-[11px]">
        Classic shell — Phase 3 stub
      </p>
      {/* data-testid is a contract with the e2e suite — see CONTRACT-PHASE3.md. */}
      <button
        type="button"
        data-testid="software-update-action"
        onClick={beginUpdate}
        className="border border-black px-3 py-1 font-[family-name:var(--font-os-ui)] text-[10px]"
      >
        Software Update
      </button>
    </motion.div>
  );
}
