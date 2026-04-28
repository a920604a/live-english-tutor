import { isTrackReference, useTracks, VideoTrack } from "@livekit/components-react";
import { Track } from "livekit-client";
import type { TrackReference } from "@livekit/components-react";

interface VideoGridProps {
  cameraEnabled: boolean;
  screenEnabled: boolean;
}

export default function VideoGrid({ cameraEnabled, screenEnabled }: VideoGridProps) {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const cameraTrack = tracks.find(
    (t) => t.source === Track.Source.Camera && isTrackReference(t)
  );
  const screenTrack = tracks.find(
    (t) => t.source === Track.Source.ScreenShare && isTrackReference(t)
  );

  const hasCamera = cameraEnabled && !!cameraTrack && isTrackReference(cameraTrack);
  const hasScreen = screenEnabled && !!screenTrack && isTrackReference(screenTrack);

  if (!hasCamera && !hasScreen) return null;

  if (hasCamera && hasScreen) {
    return (
      <div className="relative w-full max-w-2xl mx-auto aspect-video rounded-xl overflow-hidden bg-black">
        <VideoTrack
          trackRef={screenTrack}
          className="w-full h-full object-contain"
        />
        <div className="absolute bottom-2 right-2 w-28 aspect-video rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
          <VideoTrack
            trackRef={cameraTrack}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    );
  }

  const track = (hasScreen ? screenTrack : cameraTrack) as TrackReference;
  return (
    <div className="w-full max-w-2xl mx-auto aspect-video rounded-xl overflow-hidden bg-black">
      <VideoTrack
        trackRef={track}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
