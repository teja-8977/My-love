# LOVE MUSEUM ❤️

*Every picture tells a story. Every moment lives forever.*

A private, multiplayer 3D museum for two (or more). The host creates a museum, uploads 20 photos and 4 videos, and shares an invitation link or QR code. Guests sign in, design their avatar and request entry. Once the host clicks **START TOUR**, everyone walks the museum together in real time. You can sit side by side, watch videos in sync, dance, and chat with messages that float above your avatar.

Try it with no setup: `npm install && npm run dev`, then open <http://localhost:5173/demo>. This is a **solo, offline preview**. Multiplayer, uploads and invites need Supabase (see below).

---

## The journey

| Room | What's inside |
|---|---|
| I · Welcome to Our Story | Grand entrance, your names, welcome message, floating heart, chandeliers |
| II · Memory Gallery | 20 framed photos (aspect ratio preserved, never cropped), picture lights, captions, **E** to view large |
| III · Our Cinema | Large screen, curtains, star ceiling, sofas for two, **host-synchronized playback** of 4 uploaded videos |
| IV · Forever Together | Heart arch of roses and fairy lights, loveseat, candles, petals, moonlit painting |
| V · Celebration Hall | Animated dance floor, disco ball, shared music (3 generative tracks), confetti for everyone |
| VI · Our Final Memory | Your special message on the wall, and the exit door |

Rooms are connected by corridors and doorways. Each doorway has a sign naming the next room.

## Controls

| Key | Action |
|---|---|
| W A S D / arrows | Move |
| Shift | Run |
| Space | Jump |
| E | Interact · Sit · Stand · View photo · Cinema · Music · Exit |
| F | Dance (1–4 switch between Sway / Groove / Twirl / Heart hands) |
| Enter | Chat (messages float above you for 10 s) |
| Esc | Close any panel |
| Mouse drag / wheel | Orbit camera / zoom |

On touch devices a joystick and action buttons appear automatically.

---

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Three.js, React Three Fiber, Drei, postprocessing (bloom, vignette, neutral tone mapping)
- **Avatars:** fully procedural stylized characters, with 20+ options. Animations (idle, walk, run, jump, sit, wave, 4 dances) are procedural and blended smoothly. No external model files.
- **Backend:** Supabase
  - **Auth:** email + password or magic link
  - **Postgres + Row Level Security:** every museum is private
  - **Storage:** private bucket, one folder per museum (`<museum_id>/photos|videos`), served via short-lived signed URLs
  - **Realtime:** one *private* channel per museum (`museum:<id>`). Presence tracks who is inside. Broadcast carries positions (~12 Hz), chat, video sync, music, confetti and host events. Postgres change feeds drive the lobby.
- **Collision:** lightweight custom capsule-vs-box solver on the floor plan, plus a camera ray test so the camera never clips through walls.
- **Video sync:** the host is the source of truth. They broadcast state on every change and send a heartbeat every 2 s. Guests seek when drift exceeds 0.6 s.

```
src/
  avatar/        config (options, validation), procedural Avatar, animation poses
  auth/          AuthProvider, RequireAuth
  components/    UI kit, InviteCard (heart QR), AvatarPreview, ParticipantsList, HeroScene
  lib/           supabase client, typed API, image prep, live museum hook
  museum/
    layout.ts    floor plan: rooms, doors, colliders, photo slots, seats, interactables
    net/         MuseumNet (realtime presence + broadcast)
    audio/       CinemaController (synced <video> + VideoTexture), MusicEngine (WebAudio)
    player/      LocalPlayer (movement, camera, sit), RemotePlayers (interpolation), labels
    world/       architecture, props, procedural textures, six rooms
    ui/          HUD, chat, photo viewer, cinema/music panels, exit/host dialogs, touch
  pages/         Landing, Auth, Dashboard, AvatarStudio, ManageMuseum, Join, Lobby, Tour, Demo
supabase/migrations/0001_love_museum.sql
```

---

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor →** paste the whole of [`supabase/migrations/0001_love_museum.sql`](supabase/migrations/0001_love_museum.sql) and click **Run**. It creates:
   - tables, RLS policies and helper functions
   - RPCs: invite lookup, request entry, transfer host, leave
   - the private `museum-media` storage bucket and its policies
   - Realtime authorization policies for private channels
3. **Realtime → Settings:** turn **off** "Allow public access". Only then are private channel policies enforced.
4. **Authentication → URL Configuration:**
   - **Site URL:** your app URL (e.g. `http://localhost:5173` for development)
   - **Redirect URLs:** add `http://localhost:5173/**` and your production URL `/**`
5. **Authentication → Providers → Email:** keep it enabled. If "Confirm email" is on, new users must click the email link before signing in. For quick local testing you can switch it off.
6. **Storage → Settings:** the global upload size limit on the free plan is 50 MB per file. Raise it, or keep videos under it (H.264 MP4 recommended).

### 2. Environment variables

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` key |

Only the **public anon key** goes in the frontend. Never put the `service_role` key in this app; every permission is enforced by RLS in the database.

### 3. Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

### 4. Deploy

It's a static SPA: deploy `dist/` to Vercel, Netlify or any static host. `vercel.json` and `public/_redirects` already rewrite all routes to `index.html`. Remember to add the production URL to Supabase's redirect URLs and set the two env vars in your host.

---

## How the flow works

1. **Create:** sign in, then *Create Your Museum*. You become the **host**: a database trigger adds you as an accepted host member.
2. **Customize:** design your avatar in the Avatar Studio (live 3D, rotate/zoom, reset, randomize, save).
3. **Fill:** in the host dashboard (*Manage*), upload photos (downscaled to ≤2400 px, never cropped) with captions and 4 videos, and edit the names, welcome message and final message.
4. **Invite:** share the link or the heart-shaped QR code. *New link* invalidates the old one.
5. **Join:** the guest opens the link, signs in, chooses an avatar and requests entry.
6. **Lobby:** you see "Your special person is waiting to enter your museum ❤️", then **Accept** or **Reject**.
7. **START TOUR:** accepted guests are sent into the 3D museum automatically.
8. **Exit:** at the exit door (or the door icon), guests can leave. The host can **hand over ownership**, **step out** with the tour left open, or **end the tour** for everyone. Every option notifies the others first.

### Security model

- Museums, members and media are protected by RLS. Only the host and *accepted* members can read a museum's content, and only the host can change it.
- Guests can't add themselves: they go through `request_entry()` with a valid invite code, and the host must accept.
- Storage objects can only be read by participants of the museum whose folder they live in, and written only by its host.
- The realtime channel `museum:<id>` is private. Receiving and sending require accepted membership.
- A database trigger prevents role tampering, and the host row can't be revoked.

### Reconnects

Presence removes players who disconnect, and the Supabase client automatically rejoins the channel; the HUD shows *Reconnecting…*. On refresh, your position is restored for that session, guests re-request the cinema and music state, and the database remains the source of truth for tour status and membership. Removed participants are kicked immediately via broadcast, and the database also blocks them.

---

## Notes & limits

- Desktop keyboard play is the priority. Touch controls are included for phones and tablets.
- Browsers may block autoplay with sound. If so, the cinema panel shows a one-click "watch together" button.
- Avatars and the museum are fully procedural, so there is nothing to license or download. If you later want photoreal characters, swap `src/avatar/Avatar.tsx` for rigged GLB models (e.g. via `useGLTF`). The animation state (`AnimState`) and networking stay the same.
- `?debug` on the demo/tour URL exposes the local player object on `window.__lm` for testing.

---

## Entry experience (QR → museum)

`/` and `/join/<code>` open the **3D entrance**: the LOVE MUSEUM arch, a personalised floating welcome
("Welcome to <names>'s Love Museum ❤️" from the museum's names, or "Welcome to Your Love Museum ❤️"), a guide
character with NEXT steps, then **CREATE A ROOM / JOIN A ROOM**. Sign-in happens in-scene (guest entry or email).
Everyone then customises an avatar → enters the **3D waiting lobby** (live participants, room ID, QR, link) →
the host presses **START MUSEUM ❤️** → a host-driven 5-second countdown is broadcast to everyone → the doors open
and all participants enter the museum together.

Extra setup for this flow:
1. Run `supabase/migrations/0002_entry_experience.sql` (room codes, public welcome lookup, guest-safe profiles).
2. Supabase → Authentication → Providers → enable **Anonymous sign-ins** (for "quick entry" without email).

## Selfie avatars (Avaturn)

Users can choose **CREATE AVATAR USING SELFIE**. The official `@avaturn/sdk` editor opens inside the app; it asks
for camera permission itself, captures (or accepts uploaded) photos, generates the 3D face and lets people change
hair, clothes, shoes and glasses without losing the likeness. On export the GLB is copied into the private
`avatar-models` bucket and recorded in the `avatar_models` table; the avatar reference travels with the user to the lobby
and museum, so every participant sees the same personalised character. Raw selfies are never stored by Love Museum.

The GLB uses a standard humanoid skeleton (Hips, Spine, LeftArm, LeftForeArm, LeftUpLeg, …), which is
retargeted at runtime onto the existing animation system (idle, walk, run, jump, sit, wave, 4 dances) —
no extra animation files needed. Providers are pluggable (`src/avatar/providers`), so MetaPerson or another service can be added later.

### Avaturn API flow (recommended)

Implemented from Avaturn's official OpenAPI spec (`https://api.avaturn.me/openapi.json`) and the
[create-avatar-with-API guide](https://docs.avaturn.me/docs/integration/api/create-avatar-with-api/):

1. **In-app camera** (`src/avatar/SelfieCapture.tsx`): front + left + right photos with a face guide,
   take / retake / upload, then *Create my 3D avatar*.
2. **Backend** `/api/avaturn` (`server/avaturn.ts`, deployed as the Vercel Function `api/avaturn.ts`, and run by
   Vite during `npm run dev`). It verifies the caller's Supabase session, keeps the secret key, and calls:
   - `POST /api/v1/users/new` once per user (mapping saved in `avaturn_users`)
   - `POST /api/v1/avatars/new` → `upload_url`, then forwards the photos as multipart
     `image-frontal`, `image-side-1`, `image-side-2`, `body-type`, `telephoto` (never stored)
   - `GET /api/v1/users/{id}/avatars?include_not_ready=true` → polls `pending → processing → ready | failed`
   - `POST /api/v1/sessions/new` with `{ type: "edit_existing", avatar_id }` → the SDK editor opens on that avatar
     so hair, clothes, shoes and glasses change without touching the face
   - `DELETE /api/v1/users/{id}/avatars/{avatar_id}` when the user deletes their avatar
3. On the editor's **export** the GLB is copied into the `avatar-models` bucket (in the browser, or server-side if
   the export link can't be fetched there) and shared with everyone in the museum.

Setup:
1. Run `supabase/migrations/0003_avatar_models.sql` and `0004_avaturn_api.sql`.
2. In the Avaturn developer portal, enable **API access**, generate a project **API token**, and choose an export type.
3. Set `AVATURN_API_KEY=<token>` in `.env.local` for local dev and in Vercel → Settings → Environment Variables
   for production. It has no `VITE_` prefix, so it never reaches the browser. The server also needs
   the Supabase URL and anon key (the existing `VITE_`/`NEXT_PUBLIC_` names are read automatically).
4. Without an API plan you can set `VITE_AVATURN_URL=https://<project>.avaturn.dev` instead. The Avaturn editor
   then takes the selfie itself.

Avaturn can also send `avatar.ready` webhooks; this app polls instead, so no public webhook URL is needed.
