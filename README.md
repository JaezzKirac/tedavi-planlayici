# Treatment Planner (React + Vite + Three.js)

3D implant / crown / extraction / bone graft treatment plans for Clinic Group.
Staff sign in, mark the patient's current mouth (missing teeth, existing crowns and implants), choose the treatments
and play the 3D treatment animation. Opening the plan screen saves the
patient to the dashboard of the staff member who made it; the dashboard has a Copy link button for the patient link.

## Users
| User | Role |
|---|---|
| Thomas, Marian, Anxhela, Yağız, Adrian, Medo | staff: sees only their own patients |
| Marko | admin: sees every patient, can filter by staff member |

Passwords and the session secret are in `api/_lib/secrets.js` (temporary, hard-coded). **Keep the GitHub repo private**,
otherwise anyone can read them. To change a password, edit the value and redeploy. An environment variable with the
same name (e.g. `MARKO_PASSWORD`) overrides the value in the file. To add a person, add a line to `api/_lib/users.js`,
`STAFF` in `src/config.js` and `<ID>_PASSWORD` in `secrets.js`.

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173  (API included, data saved to .data/db.json)
npm run build      # production build -> dist/
```

## Deploy to Vercel
1. Push this folder to a **private** GitHub repo and import it in Vercel (framework: Vite). No environment variables needed.
2. For the shared dashboard, create a free database at upstash.com → **Redis → Create database**, open its
   **REST API** section and paste the URL and token into `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
   in `api/_lib/secrets.js`.
3. Push again; Vercel redeploys automatically.

## Video
The **Download video** button on the staff plan screen renders the animation frame by frame into a 720p MP4 at the selected speed (Chrome, Edge or Safari; needs WebCodecs).

## Patient links
- The dashboard's **Copy link** gives a link ending in `#p=...`: the plan is encoded in the link and the part after `#` is never sent to the server.
  Patients don't need an account; anyone with the link can see that plan.
- The link contains initials ("J. S."), not the full name.
  The dashboard always stores the full name.

## Structure
```
api/                      Vercel serverless functions
  login.js logout.js me.js  session (signed HttpOnly cookie)
  plans.js                list / create / update patient records
  _lib/                   users, secrets, password check, auth, storage (Upstash Redis or local file)
src/
  App.jsx                 patient view (#p=) or staff app (sign in, dashboard, create flow)
  config.js               clinic name / phone, staff list for the sign-in screen
  components/
    Login.jsx Dashboard.jsx Intake.jsx ChartScreen.jsx ToothChart.jsx PlanView.jsx
  three/JawScene.js       3D jaw, implant, crown, extraction, graft animations (Three.js r128)
  data/teeth.js           tooth geometry, names, sample patient
  data/timeline.js        treatment steps and animation timeline
  lib/share.js            link encoding / decoding
  lib/api.js              API calls
```
