/**
 * The room's shared whiteboard: Excalidraw (MIT), synced through @hydras/sync.
 *
 * - Local edits go to `room.board.applyLocal`, which writes only elements whose version
 *   moved forward. Remote changes come back through `subscribe` and are merged into the
 *   scene with the same version rule, without entering this user's undo history.
 * - Pointers travel as presence (not persisted) and render as Excalidraw collaborators.
 * - Fonts are served from this app (/excalidraw/fonts) so the board works offline and in
 *   the desktop app; nothing is fetched from a CDN.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CaptureUpdateAction,
  Excalidraw,
  FONT_FAMILY,
  MainMenu,
  WelcomeScreen,
} from '@excalidraw/excalidraw'
import type {
  BinaryFileData,
  BinaryFiles,
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from '@excalidraw/excalidraw/types'
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import '@excalidraw/excalidraw/index.css'
import './board.css'
import { HydrasMark } from '@hydras/ui'
import { mergeElements, type BoardElement, type BoardFile } from '@hydras/sync'
import { useCurrentRoom } from '../../app/room-context'
import { resolveTheme, useSettingsStore } from '../../app/settings-store'
import { useReadable } from '../../hooks/use-readable'

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[]
  }
}
window.EXCALIDRAW_ASSET_PATH = `${window.location.origin}/excalidraw/`

const POINTER_THROTTLE_MS = 50

type SceneElement = OrderedExcalidrawElement

const toBoard = (elements: readonly SceneElement[]) => elements as unknown as BoardElement[]
const toScene = (elements: readonly BoardElement[]) => elements as unknown as SceneElement[]
const toFiles = (files: readonly BoardFile[]) => files as unknown as BinaryFileData[]

export default function BoardView() {
  const room = useCurrentRoom()
  const peers = useReadable(room.peers)
  const themeKind = useSettingsStore((s) => resolveTheme(s).kind)
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const lastPointer = useRef(0)
  const knownFiles = useRef(new Set<string>())

  // Read once: Excalidraw takes initial data only on mount.
  const initialData = useMemo(() => {
    const files = room.board.files()
    for (const file of files) knownFiles.current.add(file.id)
    return {
      // Hydras defaults: clean lines (no sketchy roughness), a plain sans font, rounded
      // corners, and a transparent canvas so the app's own background shows through.
      appState: {
        viewBackgroundColor: 'transparent',
        currentItemRoughness: 0,
        currentItemFontFamily: FONT_FAMILY.Nunito,
        currentItemRoundness: 'round' as const,
        currentItemStrokeWidth: 1,
      },
      elements: toScene(room.board.elements()),
      files: Object.fromEntries(toFiles(files).map((f) => [f.id, f])) as BinaryFiles,
      scrollToContent: true,
    }
  }, [room])

  // Remote changes -> scene (never into this user's undo history).
  useEffect(() => {
    if (!api) return
    return room.board.subscribe((remote, files) => {
      const fresh = files.filter((f) => !knownFiles.current.has(f.id))
      if (fresh.length > 0) {
        for (const file of fresh) knownFiles.current.add(file.id)
        api.addFiles(toFiles(fresh))
      }
      const local = toBoard(api.getSceneElementsIncludingDeleted())
      api.updateScene({
        elements: toScene(mergeElements(local, remote)),
        captureUpdate: CaptureUpdateAction.NEVER,
      })
    })
  }, [api, room])

  // Other people's pointers -> Excalidraw collaborators.
  useEffect(() => {
    if (!api) return
    const collaborators = new Map<SocketId, Collaborator>()
    for (const peer of peers) {
      if (peer.isSelf || !peer.boardPointer) continue
      collaborators.set(String(peer.clientId) as SocketId, {
        username: peer.user.name,
        pointer: { x: peer.boardPointer.x, y: peer.boardPointer.y, tool: peer.boardPointer.tool },
        button: peer.boardPointer.button,
        color: { background: peer.user.color, stroke: peer.user.color },
      })
    }
    api.updateScene({ collaborators, captureUpdate: CaptureUpdateAction.NEVER })
  }, [api, peers])

  // Leaving the board clears our pointer for everyone else.
  useEffect(() => () => room.setBoardPointer(null), [room])

  const handleChange = (elements: readonly SceneElement[], _state: unknown, files: BinaryFiles) => {
    if (room.readOnly) return
    const newFiles = Object.values(files).filter((f) => !knownFiles.current.has(f.id))
    for (const file of newFiles) knownFiles.current.add(file.id)
    room.board.applyLocal(toBoard(elements), newFiles as unknown as BoardFile[])
  }

  const handlePointer = (payload: {
    pointer: { x: number; y: number; tool: 'pointer' | 'laser' }
    button: 'down' | 'up'
  }) => {
    const now = Date.now()
    if (now - lastPointer.current < POINTER_THROTTLE_MS) return
    lastPointer.current = now
    room.setBoardPointer({
      x: payload.pointer.x,
      y: payload.pointer.y,
      tool: payload.pointer.tool,
      button: payload.button,
    })
  }

  return (
    <div className="hydras-board h-full w-full" aria-label="Shared whiteboard">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        onChange={handleChange}
        onPointerUpdate={handlePointer}
        isCollaborating
        viewModeEnabled={room.readOnly}
        theme={themeKind}
        name={`${room.slug} board`}
        UIOptions={{
          canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Hints.ToolbarHint>
            <p>Pick a tool and start sketching. Everyone in the room sees it live.</p>
          </WelcomeScreen.Hints.ToolbarHint>
          <WelcomeScreen.Hints.MenuHint>
            <p>Export, search and clear the board</p>
          </WelcomeScreen.Hints.MenuHint>
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Logo>
              <span className="hydras-board__mark">
                <HydrasMark size={34} />
                hydras board
              </span>
            </WelcomeScreen.Center.Logo>
            <WelcomeScreen.Center.Heading>
              Sketch the plan next to the code.
            </WelcomeScreen.Center.Heading>
          </WelcomeScreen.Center>
        </WelcomeScreen>
      </Excalidraw>
    </div>
  )
}
