![weather-banana design](/website.png)
Frontend Preview

# weather-banana
AI weather image generator using Node.js, Open-Meteo, Gemini (Nano Banana, Gemini 2.5 Image Preview) &amp; 146k+ world cities database. City search uses JSON DB with coordinates for Open-Meteo API calls. Real-time weather data including local time generates realistic prompts for AI image generation based on city and current conditions.

![Node](https://img.shields.io/badge/Node-%E2%89%A5%2018-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![API](https://img.shields.io/badge/Open%E2%80%93Meteo-Live%20Weather-blue)
![Gemini](https://img.shields.io/badge/Google%20Gemini-Image%20Preview-4285F4)

Overview
--------
weather-banana is a tiny full-stack app that:
- Searches a local 146k+ cities database (`cities500.json`) in the browser.
- Fetches real-time weather for the chosen city from Open‑Meteo (hourly, timezone‑aware).
- Builds a concise, realistic prompt from weather conditions and local time.
- Generates an AI image via Google Gemini, saving the file on the server and returning a public URL.

The result is a quick way to visualize “the mood of the weather” for 146k cities right now.

Table of Contents
-----------------
- Getting Started
- Configuration (.env)
- Scripts
- API Endpoints
- Frontend Flow
- Project Structure
- Troubleshooting
- Notes & Tips
- Acknowledgements
- DISCLAIMER OF WARRANTY AND LIMITATION OF LIABILITY
- License

Getting Started
---------------
- Requirements: Node.js 18 or newer.
- Ensure `cities500.json` is present in the project root (it is in this repo).
- Create a `.env` file with your Google API key and (optionally) model.

Example `.env` (do not commit secrets):
```
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
GOOGLE_MODEL=gemini-2.5-flash-image-preview
# Optional: PORT=3000
```

Install and run (PowerShell shown):
```powershell
npm install
npm start
# Open http://localhost:3000
```

Configuration (.env)
--------------------
- `GOOGLE_API_KEY`: Required. Google Generative AI API key used server‑side.
- `GOOGLE_MODEL`: Optional. Defaults to `gemini-2.5-flash-image-preview`.
- `PORT`: Optional. Defaults to `3000`.

Security note: API keys never leave the server. Image generation calls are proxied by the backend; clients only receive a resulting image path.

Scripts
-------
- `npm start`: Run the Express server (`server.js`).

API Endpoints
-------------
- `GET /cities500.json`
  - Streams the cities database from the project root.
  - Returns 404 if the file is missing.

- `GET /api/env-check`
  - Returns a minimal health summary without leaking secrets.
  - Response fields: `hasGoogleKey`, `googleModel`, `node`.

- `GET /api/env-diagnose`
  - More detailed diagnostics (still masks sensitive values).
  - Useful for local troubleshooting if the app can’t find your `.env`.

- `POST /api/generate-image-google`
  - Uses the `@google/genai` SDK.
  - Request body (JSON):
    - `city` (string)
    - `conditions` (string)
    - `localTime` (string, optional)
  - Response: `{ path: "img/<file>.png" }` or a fallback SVG response (see below).

- `POST /api/generate-image-google2`
  - Uses the REST API directly (preferred if the SDK is unavailable).
  - Request body (JSON): same as above.
  - Response: `{ path: "img/<file>.png" }` or `{ path: "img/<file>.svg", fallback: true, reason: "..." }` when no image data is returned by Gemini.

Example cURL (REST endpoint):
```bash
curl -sS -X POST "http://localhost:3000/api/generate-image-google2" \
  -H "Content-Type: application/json" \
  -d '{
    "city": "London",
    "conditions": "partly cloudy, light wind",
    "localTime": "18:20"
  }'
```

Frontend Flow
-------------
- City search runs fully client‑side against `cities500.json` (no database required).
- After selecting a city, the app queries Open‑Meteo for the next hour’s conditions and timezone.
- The server then generates an image using Google Gemini and saves it to `public/img`.
- The UI updates with the image and a short conditions summary.

Project Structure
-----------------
- `server.js`: Express server, static hosting, API routes, image saving.
- `public/index.html`: Minimal UI.
- `public/app.js`: Client logic (city search, Open‑Meteo request, API calls).
- `public/styles.css`: Styling (including animated “elements” background).
- `cities500.json`: cities database (served from root).
- `examples/`: Sample output images (for reference).

Troubleshooting
---------------
- Missing API key:
  - Ensure `.env` exists and contains `GOOGLE_API_KEY`.
  - Check `GET /api/env-check` and `GET /api/env-diagnose` to confirm the server can read your `.env` (values are masked in responses).
- Missing cities database:
  - If `GET /cities500.json` returns 404, place `cities500.json` in project root.
- No image returned from Gemini:
  - The server will return a fallback SVG (with `fallback: true`). This usually indicates a temporary model issue or an unsupported request.
- Port already in use:
  - Set a custom `PORT` in `.env` (e.g., `PORT=4000`).

Notes & Tips
------------
- The REST endpoint `/api/generate-image-google2` is often more robust across environments because it avoids SDK compatibility issues.
- The prompt includes local time for realistic lighting; change it in `server.js` or `public/app.js` if you want a different style.
- Generated images are written to `public/img`. These files can grow; consider cleaning up periodically or adding retention logic for production.

Acknowledgements
----------------
- World cities database: [lmfmaier / cities-json](https://github.com/lmfmaier/cities-json)
- Weather data: [Open‑Meteo](https://open-meteo.com/)
- Image generation: [Nano Banana, Gemini 2.5 Image Preview](https://developers.googleblog.com/en/introducing-gemini-2-5-flash-image/)

DISCLAIMER OF WARRANTY AND LIMITATION OF LIABILITY
----------------
No Warranty: This software is provided "as is" and "as available" without any warranties of any kind, either express or implied, including but not limited to the implied warranties of merchantability, fitness for a particular purpose, or non-infringement. The authors and contributors make no representations or warranties about the accuracy, reliability, completeness, or timeliness of this software.
Limitation of Liability: In no event shall the authors, contributors, or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software. This includes, but is not limited to: direct, indirect, incidental, special, consequential, or punitive damages; loss of profits, revenue, data, or use; business interruption; or any other commercial damages or losses, even if advised of the possibility of such damages.
Use at Your Own Risk: You acknowledge that you use this software at your own risk and discretion. You are solely responsible for any damage to your computer system or loss of data that results from the use of this software.
No Support Obligation: The authors and contributors are under no obligation to provide support, updates, enhancements, or modifications to this software.
By using, copying, modifying, or distributing this software, you acknowledge that you have read this disclaimer and agree to be bound by its terms.

License
----------------
This work is licensed under a MIT License

MIT License

Copyright (c) 2025 XLeukon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


