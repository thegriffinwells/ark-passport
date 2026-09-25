# Ark Passport

Space pirate passport generator. Take a selfie or upload a photo, fill in your details, and export an animated 1080×1920 Instagram story MP4 with the song baked in.

Live: https://ark-passport.vercel.app

## Run locally

No build step — it's plain HTML/CSS/JS.

```sh
python3 -m http.server 5392
# open http://localhost:5392
```

## Files

- `index.html`, `style.css` — page and controls
- `app.js` — passport drawing, animated scene, camera, audio analysis, export
- `lib/mp4-muxer.min.js` — MP4 muxer used by the fast export
- `tracks/` — built-in songs

Pushing to `main` deploys to Vercel automatically.
