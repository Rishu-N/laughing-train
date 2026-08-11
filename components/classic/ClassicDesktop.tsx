'use client';

/**
 * The two icons that live on the desktop: the startup disk and the trash.
 *
 * OWNER: Classic Boot agent.
 *
 * Icon labels sit on a white chip because that is how a 1-bit Finder kept text
 * legible over a dithered desktop — there was no other way to do it.
 */
import { useClassicSystem } from '@/components/classic/ClassicContext';
import { ACCESSORY_META } from '@/components/classic/accessories/catalog';
import { ICON_TRASH } from '@/components/classic/icons';
import { BIT_FONT } from '@/components/classic/ui/Bit';
import PixelIcon from '@/components/classic/ui/PixelIcon';
import { CLASSIC_MENUBAR_HEIGHT } from '@/lib/classic/metrics';

export default function ClassicDesktop() {
  const { open, alert } = useClassicSystem();

  return (
    <div
      className={`${BIT_FONT} absolute right-2 flex flex-col items-center gap-3`}
      style={{ top: CLASSIC_MENUBAR_HEIGHT + 10 }}
    >
      <DesktopIcon
        label={ACCESSORY_META.disk.title}
        onClick={() => open('disk')}
        icon={<PixelIcon map={ACCESSORY_META.disk.icon} size={32} />}
      />
      <DesktopIcon
        label="Trash"
        onClick={() =>
          alert(
            'Trash',
            'The Trash is empty. It has been empty since 1984, which is either tidy or suspicious.',
          )
        }
        icon={<PixelIcon map={ICON_TRASH} size={32} />}
      />
    </div>
  );
}

function DesktopIcon({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-[64px] cursor-default flex-col items-center gap-1 text-black focus-visible:shadow-[inset_0_0_0_2px_#000] focus-visible:outline-none"
    >
      {icon}
      <span className="bg-white px-1 text-center text-[8px] leading-[11px]">
        {label}
      </span>
    </button>
  );
}
