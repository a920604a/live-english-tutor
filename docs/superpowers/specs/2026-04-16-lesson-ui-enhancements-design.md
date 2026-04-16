# Lesson UI Enhancements — Design Spec

**Date:** 2026-04-16  
**Scope:** Three frontend + agent features for the live English tutor app

---

## Overview

Three features to improve the lesson experience:

1. **Captions** — toggleable chat-bubble transcript panel showing both agent and user speech
2. **Mic Toggle** — replace hold-to-speak with click-to-toggle
3. **Video Input** — camera + screen share with agent video understanding

---

## Architecture: LessonPage Refactor (Approach B)

`LessonPage.tsx` is refactored into explicit layout zones. All new feature state lives in `LessonPage` local state and is passed down via props.

### New File Structure

| Action | File |
|---|---|
| Modify | `pages/LessonPage.tsx` |
| Modify | `components/lesson/VoiceControls.tsx` |
| Modify | `hooks/useAgentData.ts` |
| Modify | `livekit-agent/agent/main.py` |
| New | `components/lesson/ToolBar.tsx` |
| New | `components/lesson/VideoGrid.tsx` |
| New | `components/lesson/CaptionPanel.tsx` |

### Layout Zones

```
┌──────────────────────────────────┐
│  Header (Emma logo + End button) │
│  ToolBar (cam / screen / caption)│
├──────────────────────────────────┤
│  MainStage                       │
│  ├─ VideoGrid (when video active)│
│  └─ EmmaAvatar + AgentStatus     │
│     (when no video)              │
├──────────────────────────────────┤
│  CaptionPanel (when enabled)     │
├──────────────────────────────────┤
│  VoiceControls (mic toggle)      │
│  CorrectionPanel                 │
└──────────────────────────────────┘
```

### State in LessonPage

```ts
const [captionsEnabled, setCaptionsEnabled] = useState(false);
const [cameraEnabled, setCameraEnabled]     = useState(false);
const [screenEnabled, setScreenEnabled]     = useState(false);
```

---

## Feature 1: Captions (CaptionPanel)

### Data Sources

- **Agent speech:** `useVoiceAssistant().agentTranscriptions` — LiveKit built-in, no extra work
- **User speech:** agent forwards via LiveKit data message, topic `tutor.transcript.user`

### Agent Change (`main.py`)

In the existing `on("user_input_transcribed")` callback, add a data publish alongside the backend post:

```python
@session.on("user_input_transcribed")
def on_transcript(event) -> None:
    if not event.is_final:
        return
    text = event.transcript
    asyncio.create_task(backend.post_message(role="student", content=text))
    # Forward to frontend captions
    asyncio.create_task(
        ctx.room.local_participant.publish_data(
            json.dumps({"text": text}).encode(),
            topic="tutor.transcript.user",
        )
    )
```

### Frontend: useAgentData.ts

Add `TranscriptEntry` accumulation (max 50 entries) by listening to:
- `tutor.transcript.user` data messages (existing `DataReceived` handler)
- `agentTranscriptions` from `useVoiceAssistant()` via a separate effect

```ts
interface TranscriptEntry {
  id: string;        // crypto.randomUUID()
  role: "user" | "agent";
  text: string;
}
```

Cap at 50 entries — drop oldest when exceeded.

### Frontend: CaptionPanel.tsx

- Chat bubble list, scrollable, auto-scrolls to bottom on new entry
- User messages: right-aligned, slate background
- Agent messages: left-aligned, indigo background
- Shown/hidden via `captionsEnabled` prop
- Default: **off**

---

## Feature 2: Mic Toggle (VoiceControls)

Replace `onPointerDown` / `onPointerUp` / `onPointerLeave` with `onClick` toggle.

### Behaviour

| State | Button color | Icon | Label |
|---|---|---|---|
| Off | slate-200 | 🔇 | "Tap to speak" |
| On | rose-500 + pulse ring | 🎙️ | "Tap to stop" |

No mode switching — hold-to-speak is fully removed.

---

## Feature 3: Video Input (VideoGrid + Agent)

### Agent Change (`main.py`)

Enable video input in `session.start()`:

```python
from livekit.agents import RoomInputOptions

await session.start(
    agent=agent,
    room=ctx.room,
    room_input_options=RoomInputOptions(
        video_enabled=True,
    ),
)
```

No model change required — `gemini-2.5-flash-native-audio-preview-12-2025` already supports video input through the LiveKit Google plugin. The plugin automatically forwards video frames to Gemini.

### Frontend: ToolBar.tsx

Three toggle buttons in the header area:

```
[ 🎥 Camera ]  [ 🖥 Screen ]  [ 💬 Captions ]
```

- Active state: indigo background
- Inactive state: slate-200 background
- Camera: calls `localParticipant.setCameraEnabled(true/false)`
- Screen: calls `localParticipant.setScreenShareEnabled(true/false)`
- Captions: toggles `captionsEnabled` state

### Frontend: VideoGrid.tsx

Displayed when at least one video source is active; replaces EmmaAvatar in MainStage.

| Active sources | Layout |
|---|---|
| Camera only | Single full video |
| Screen only | Single full video |
| Both | Screen large (left), camera small (top-right corner) |
| Neither | EmmaAvatar shown instead |

Uses `<VideoTrack>` from `@livekit/components-react` for rendering.

---

## Out of Scope

- Noise cancellation (`livekit-plugins-noise-cancellation`) — separate feature, not installed
- Agent video output (agent speaking with a face) — not supported by current model
- Persistent caption history across sessions

---

## Open Questions

None — all decisions made during brainstorming.
