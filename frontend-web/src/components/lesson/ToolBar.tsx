interface ToolBarProps {
  cameraEnabled: boolean;
  screenEnabled: boolean;
  captionsEnabled: boolean;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onToggleCaptions: () => void;
}

export default function ToolBar({
  cameraEnabled,
  screenEnabled,
  captionsEnabled,
  onToggleCamera,
  onToggleScreen,
  onToggleCaptions,
}: ToolBarProps) {
  const btn = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
      active
        ? "bg-indigo-600 text-white shadow-sm"
        : "bg-white/10 text-white/70 hover:bg-white/20"
    }`;

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-2">
      <button onClick={onToggleCamera} className={btn(cameraEnabled)}>
        🎥 <span>Camera</span>
      </button>
      <button onClick={onToggleScreen} className={btn(screenEnabled)}>
        🖥 <span>Screen</span>
      </button>
      <button onClick={onToggleCaptions} className={btn(captionsEnabled)}>
        💬 <span>Captions</span>
      </button>
    </div>
  );
}
