import { showNativeContextMenu } from "@/lib/menu"

interface ContextMenuEvent {
  preventDefault: () => void
  stopPropagation: () => void
}

export function showMediaContextMenu(
  event: ContextMenuEvent,
  media: HTMLMediaElement | null,
  path: string,
) {
  showNativeContextMenu(
    event,
    [
      { id: "play-pause", label: media?.paused ? "Play" : "Pause", enabled: Boolean(media) },
      { id: "mute", label: media?.muted ? "Unmute" : "Mute", enabled: Boolean(media) },
      { type: "separator" },
      { id: "copy-path", label: "Copy Path" },
    ],
    {
      "play-pause": () => {
        if (!media) return
        if (media.paused) return media.play()
        media.pause()
      },
      mute: () => {
        if (media) media.muted = !media.muted
      },
      "copy-path": () => navigator.clipboard.writeText(path),
    },
  )
}
