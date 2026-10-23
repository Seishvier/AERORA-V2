# AERORA — Weather Intelligence

A responsive, glass-style weather dashboard made with plain HTML, CSS, and JavaScript. It uses live Open-Meteo APIs for global city lookup, current weather, a 5-day forecast, and air-quality estimates. There is no database, account, build step, or API key for the non-commercial educational use case.

## Files

- `index.html` — page structure and content
- `style.css` — responsive layout, glass effects, and weather-responsive color themes
- `script.js` — city search, API requests, forecast rendering, recommendations, navigation, and QR generation
- `assets/weather-world.png` — original hero illustration

## Run locally

Because the app uses external APIs, open it through a local static web server rather than relying on `file://` where possible. For example, use the Live Server extension in VS Code, or run `python -m http.server 8000` from this directory and open `http://localhost:8000`.

When the site is running on localhost or opened as a local file, the share panel intentionally shows a placeholder instead of a misleading QR code. Once hosted on a public URL, AERORA automatically generates a QR code for that published page.

## Publish with GitHub Pages

1. Upload `index.html`, `style.css`, `script.js`, `README.md`, and the `assets` folder to the root of your GitHub repository.
2. Open the repository's **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select your main branch and the `/ (root)` folder, then save.
4. After GitHub Pages provides the public URL, open that URL. The QR code will now point to the live website, so another device can scan it.

## Data and limitations

- City lookup: Open-Meteo Geocoding API (location records based on GeoNames).
- Weather: Open-Meteo Forecast API.
- Air quality: Open-Meteo Air Quality API, including US AQI, PM2.5, and PM10 where available.
- Air-quality and weather values are model estimates and can differ from official local monitoring. The health, farming, and travel notes are general planning prompts, not official medical or agricultural advice.
- Review Open-Meteo's current terms and attribution requirements before using the project commercially: https://open-meteo.com/en/terms
- The QR code library is loaded from cdnjs; Google Fonts are used for typography. The application still has font fallbacks if Google Fonts is unavailable.
