
/* AERORA Weather Intelligence
 * Front-end only. Weather and air-quality information comes from Open-Meteo.
 * No database, account, or API key is required for this educational project.
 */

const API = {
  geocoding: "https://geocoding-api.open-meteo.com/v1/search",
  forecast: "https://api.open-meteo.com/v1/forecast",
  airQuality: "https://air-quality-api.open-meteo.com/v1/air-quality"
};

const state = {
  location: null,
  weather: null,
  air: null,
  isLoading: false,
  toastTimer: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function safeNumber(value, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "--";
  return Number(value).toFixed(digits);
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number));
}

function showToast(message) {
  const toast = $("#toastMessage");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

function setBusy(busy, message = "") {
  state.isLoading = busy;
  const button = $("#searchForm button[type='submit']");
  const refresh = $("#refreshButton");

  if (button) {
    button.disabled = busy;
    const label = button.querySelector("span");
    if (label) label.textContent = busy ? "Loading…" : "Explore city";
    button.style.opacity = busy ? ".72" : "1";
  }

  if (refresh) {
    refresh.disabled = busy;
    refresh.style.opacity = busy ? ".55" : "1";
  }

  if (message) setText("#connectionLabel", message);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  const data = await response.json();

  if (data && data.error) {
    throw new Error(data.reason || "The data service returned an error.");
  }

  return data;
}

function locationLabel(place) {
  return [
    place.admin1,
    place.country
  ].filter((part) => part && part !== place.name).join(", ")
    || place.country
    || "Location selected";
}

async function searchPlaces(query) {
  const url = new URL(API.geocoding);

  url.search = new URLSearchParams({
    name: query.trim(),
    count: "7",
    language: "en",
    format: "json"
  });

  const data = await fetchJson(url);

  return Array.isArray(data.results) ? data.results : [];
}

function renderPlaceResults(results, query) {
  const container = $("#searchResults");
  if (!container) return;

  container.replaceChildren();
  container.hidden = false;

  if (!results.length) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent =
      `No matching city found for “${query}”. Try adding a country name.`;

    container.append(empty);
    return;
  }

  results.forEach((place) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result";

    const marker = document.createElement("span");
    marker.className = "search-result-icon";
    marker.textContent = "⌖";
    marker.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = place.name;

    const detail = document.createElement("small");
    detail.textContent = locationLabel(place);

    copy.append(name, detail);
    button.append(marker, copy);

    button.addEventListener("click", () => {
      $("#cityInput").value =
        [place.name, place.country].filter(Boolean).join(", ");

      container.hidden = true;
      loadWeather(place);
    });

    container.append(button);
  });
}

function hidePlaceResults() {
  const container = $("#searchResults");
  if (container) container.hidden = true;
}

function conditionForCode(code) {
  const c = Number(code);

  if (c === 0) return "Clear sky";
  if (c === 1) return "Mainly clear";
  if (c === 2) return "Partly cloudy";
  if (c === 3) return "Overcast";
  if ([45, 48].includes(c)) return "Foggy";
  if ([51, 53, 55].includes(c)) return "Drizzle";
  if ([56, 57].includes(c)) return "Freezing drizzle";
  if ([61, 63, 65].includes(c)) return "Rain";
  if ([66, 67].includes(c)) return "Freezing rain";
  if ([71, 73, 75, 77].includes(c)) return "Snow";
  if ([80, 81, 82].includes(c)) return "Rain showers";
  if ([85, 86].includes(c)) return "Snow showers";
  if ([95, 96, 99].includes(c)) return "Thunderstorm";

  return "Variable conditions";
}

function themeForWeather(code, isDay = 1) {
  const c = Number(code);

  if (!isDay) return "night";
  if ([95, 96, 99].includes(c)) return "storm";
  if ([71, 73, 75, 77, 85, 86].includes(c)) return "snow";

  if ([
    51, 53, 55, 56, 57,
    61, 63, 65, 66, 67,
    80, 81, 82
  ].includes(c)) return "rain";

  if ([45, 48].includes(c)) return "mist";
  if ([2, 3].includes(c)) return "cloudy";

  return "sunny";
}

function weatherSvg(code, isDay = 1) {
  const c = Number(code);
  const moon = !isDay || (c === 0 && !isDay);
  const rain = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(c);
  const snow = [71, 73, 75, 77, 85, 86].includes(c);
  const storm = [95, 96, 99].includes(c);
  const fog = [45, 48].includes(c);
  const cloudy = ![0, 1].includes(c) || moon;

  const sun = `<g class="svg-sun"><circle cx="31" cy="27" r="11" fill="#FFD36F"/><g stroke="#F0B45E" stroke-width="2.3" stroke-linecap="round"><path d="M31 9v4M31 41v4M13 27h4M45 27h4M18.3 14.3l3 3M40.7 36.7l3 3M43.7 14.3l-3 3M21.3 36.7l-3 3"/></g></g>`;
  const cloud = `<path d="M18.5 43h22.2c7.4 0 11.6-4.5 11.6-10.1 0-5.5-4.2-9.6-10.1-9.9C40.3 15.8 35.1 12 29.1 13.3c-5.2 1.1-8.3 5.2-8.7 10.5-6.7-.7-11.8 3.1-11.8 9.4 0 5.9 4.1 9.8 9.9 9.8Z" fill="#F7FBFF" stroke="#BCD0E4" stroke-width="1.8" stroke-linejoin="round"/>`;
  const rainDrops = `<g stroke="#74B9E7" stroke-width="2.6" stroke-linecap="round"><path d="m22 49-2.5 5M34 49l-2.5 5M46 49l-2.5 5"/></g>`;
  const snowFlakes = `<g stroke="#72B8D9" stroke-width="1.8" stroke-linecap="round"><path d="M21 49v8m-3.5-4h7m-6-2.5 5 5m0-5-5 5M37 49v8m-3.5-4h7m-6-2.5 5 5m0-5-5 5M50 49v8m-3.5-4h7m-6-2.5 5 5m0-5-5 5"/></g>`;
  const lightning = `<path d="m34 36-9 13h8l-2 9 12-16h-8l3-6Z" fill="#F2BC53" stroke="#F0B45E" stroke-linejoin="round"/>`;
  const fogLines = `<g stroke="#9DB5C9" stroke-width="2.4" stroke-linecap="round"><path d="M13 49h35M18 55h26M22 61h18"/></g>`;
  const nightMoon = `<path d="M38 8.5c-8.8 2.1-14.3 10.6-12.2 19.4 1.8 7.8 9.2 12.4 17 10.6-3.1 5.4-9.7 8.4-16 6.9-8.1-1.9-13.1-10-11.2-18.1C17.5 17 26.3 11.1 38 8.5Z" fill="#C7B5F6"/><path d="m47 12 1.2 3.3 3.3 1.2-3.3 1.2L47 21l-1.2-3.3-3.3-1.2 3.3-1.2L47 12Z" fill="#C7B5F6"/>`;

  let inner = "";

  if (moon) {
    inner = nightMoon + (cloudy && c !== 0 ? cloud : "");
    if (rain) inner += rainDrops;
    if (snow) inner += snowFlakes;
    if (storm) inner += lightning;
  } else if (c === 0 || c === 1) {
    inner = sun + (c === 1 ? `<path d="M44 39h5" stroke="#AFC3D9" stroke-width="2" stroke-linecap="round"/>` : "");
  } else if ([2, 3, 45, 48].includes(c)) {
    inner = c === 2 ? sun + cloud : cloud;
    if (fog) inner += fogLines;
  } else {
    inner = cloud;
    if (rain) inner += rainDrops;
    if (snow) inner += snowFlakes;
    if (storm) inner += lightning;
    if (fog) inner += fogLines;
  }

  return `<svg viewBox="0 0 64 68" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">${inner}</svg>`;
}

function dayLabel(dateString, timeZone, index) {
  if (index === 0) return "Today";

  const date = new Date(`${dateString}T12:00:00Z`);

  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: timeZone || "UTC"
    }).format(date);
  } catch {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC"
    });
  }
}

function prettyDate(dateString, timeZone) {
  const date = new Date(`${dateString}T12:00:00Z`);

  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: timeZone || "UTC"
    }).format(date);
  } catch {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    });
  }
}

function timeLabel(timeString, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone
    }).format(new Date());
  } catch {
    return (timeString || "").slice(11, 16) || "--:--";
  }
}

function matchingHourlyIndex(weather) {
  const currentHour = (weather?.current?.time || "").slice(0, 13);
  const times = weather?.hourly?.time || [];
  const exact = times.findIndex((item) => item.slice(0, 13) === currentHour);
  return exact >= 0 ? exact : 0;
}

function setMeter(id, percentage) {
  const el = $(id);
  if (el) el.style.width = `${clamp(Number(percentage) || 0, 0, 100)}%`;
}


function renderCurrentWeather(place, weather) {
  const current = weather.current || {};
  const daily = weather.daily || {};
  const currentCode = Number(current.weather_code ?? 0);
  const isDay = Number(current.is_day ?? 1);
  const theme = themeForWeather(currentCode, isDay);

  document.body.dataset.theme = theme;

  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "night" ? "#172841"
      : theme === "rain" ? "#d9e5f3"
      : "#e1f0ff"
  );

  setText("#cityName", place.name || "Selected location");
  setText("#cityCountry", place.country || "");
  setText(
    "#dateLabel",
    prettyDate(
      (daily.time || [])[0] || (current.time || "").slice(0, 10),
      weather.timezone
    )
  );
  setText("#localClock", `${timeLabel(current.time, weather.timezone)} LOCAL`);
  setText("#temperatureValue", safeNumber(current.temperature_2m));
  setText("#feelsLikeValue", `${safeNumber(current.apparent_temperature)}°C`);
  setText("#weatherDescription", conditionForCode(currentCode));
  setText("#heroStatus", "CURRENT CONDITIONS");
  setText(
    "#weatherSourceLine",
    `Live forecast · Updated ${current.time ? current.time.slice(11, 16) : "recently"}`
  );
  setText(
    "#highLowLabel",
    `High ${safeNumber((daily.temperature_2m_max || [])[0])}° / Low ${safeNumber((daily.temperature_2m_min || [])[0])}°`
  );
  setText("#heroStamp", String(currentCode).padStart(2, "0"));
  $("#heroWeatherIcon").innerHTML = weatherSvg(currentCode, isDay);

  const humidity = current.relative_humidity_2m;
  const wind = current.wind_speed_10m;
  const rainChance = (daily.precipitation_probability_max || [])[0];
  const uv = (daily.uv_index_max || [])[0];

  setText("#humidityValue", safeNumber(humidity));
  setText("#windValue", safeNumber(wind));
  setText("#rainValue", safeNumber(rainChance));
  setText("#uvValue", safeNumber(uv, 1));

  setText(
    "#humidityNote",
    Number.isFinite(humidity) && humidity >= 70
      ? "Air may feel humid"
      : "Relative humidity"
  );
  setText(
    "#windNote",
    Number.isFinite(wind) && wind >= 30
      ? "Breezy conditions"
      : "Near-surface wind"
  );
  setText(
    "#rainNote",
    Number.isFinite(rainChance) && rainChance >= 60
      ? "Bring rain protection"
      : "Chance of precipitation"
  );
  setText(
    "#uvNote",
    Number.isFinite(uv) && uv >= 6
      ? "Sun protection advised"
      : "Daily UV outlook"
  );

  setMeter("#humidityMeter", humidity);
  setMeter("#windMeter", Number(wind) * 2.2);
  setMeter("#rainMeter", rainChance);
  setMeter("#uvMeter", Number(uv) * 10);

  setText(
    "#forecastTimezone",
    (weather.timezone || "LOCAL TIME").replaceAll("_", " ").toUpperCase()
  );

  renderForecast(weather);
}

function renderForecast(weather) {
  const daily = weather.daily || {};
  const timeZone = weather.timezone || "UTC";
  const dates = daily.time || [];
  const grid = $("#forecastGrid");

  grid.replaceChildren();

  dates.forEach((date, index) => {
    const code = (daily.weather_code || [])[index] ?? 0;
    const high = (daily.temperature_2m_max || [])[index];
    const low = (daily.temperature_2m_min || [])[index];
    const rain = (daily.precipitation_probability_max || [])[index];

    const article = document.createElement("article");
    article.className = `forecast-card glass${index === 0 ? " today" : ""}`;

    const day = document.createElement("div");
    day.className = "forecast-day-row";

    const dayName = document.createElement("span");
    dayName.textContent = dayLabel(date, timeZone, index);

    const dayNumber = document.createElement("small");
    dayNumber.textContent = date.slice(8, 10);

    day.append(dayName, dayNumber);

    const icon = document.createElement("div");
    icon.className = "forecast-icon";
    icon.innerHTML = weatherSvg(code, 1);

    const description = document.createElement("p");
    description.className = "forecast-condition";
    description.textContent = conditionForCode(code);

    const temps = document.createElement("div");
    temps.className = "forecast-temperatures";

    const highSpan = document.createElement("span");
    highSpan.textContent = `${safeNumber(high)}°`;

    const lowSpan = document.createElement("span");
    lowSpan.textContent = `${safeNumber(low)}°`;

    temps.append(highSpan, lowSpan);

    const rainLine = document.createElement("div");
    rainLine.className = "forecast-rain";
    rainLine.innerHTML = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.2c-1.8 2.9-5.1 6.6-5.1 9.8a5.1 5.1 0 0 0 10.2 0c0-3.2-3.3-6.9-5.1-9.8Z" stroke="currentColor" stroke-width="1.5"/></svg>`;

    const rainText = document.createElement("span");
    rainText.textContent = `${safeNumber(rain)}% rain`;

    rainLine.append(rainText);
    article.append(day, icon, description, temps, rainLine);
    grid.append(article);
  });

  setText(
    "#forecastFootnote",
    "High / low temperatures and precipitation chances are daily forecast estimates, not guarantees."
  );
}

function aqiCategory(value) {
  const aqi = Number(value);

  if (!Number.isFinite(aqi)) {
    return {
      label: "Unavailable",
      className: "",
      title: "Air-quality index unavailable",
      copy: "The current model estimate is not available for this location. Check an official local monitoring service for the latest reading."
    };
  }

  if (aqi <= 50) {
    return {
      label: "Good",
      className: "",
      title: "Air quality is in a good range",
      copy: "Air pollution poses little or no expected risk for most people at this estimated level. Continue to follow local advisories."
    };
  }

  if (aqi <= 100) {
    return {
      label: "Moderate",
      className: "moderate",
      title: "A moderate air-quality estimate",
      copy: "Most people can continue usual activities. People who are unusually sensitive to air pollution may choose to reduce prolonged, strenuous outdoor activity if they notice symptoms."
    };
  }

  if (aqi <= 150) {
    return {
      label: "Sensitive groups",
      className: "sensitive",
      title: "Sensitive groups may need extra care",
      copy: "Children, older adults, and people with heart or lung conditions may be more affected. Consider checking local guidance before prolonged outdoor exertion."
    };
  }

  if (aqi <= 200) {
    return {
      label: "Unhealthy",
      className: "unhealthy",
      title: "Consider limiting prolonged outdoor exertion",
      copy: "The model estimates an unhealthy level. Check official local alerts and consider moving strenuous activities indoors, especially for sensitive groups."
    };
  }

  if (aqi <= 300) {
    return {
      label: "Very unhealthy",
      className: "very-unhealthy",
      title: "A high pollution estimate",
      copy: "Reduce outdoor exposure and review official health guidance. Treat this forecast as a prompt to check authoritative local alerts."
    };
  }

  return {
    label: "Hazardous",
    className: "very-unhealthy",
    title: "A very high pollution estimate",
    copy: "Avoid relying on this model alone. Check official local alerts promptly and follow public-health recommendations for your area."
  };
}

function particulateCategory(value, type) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "Unavailable";
  }

  const v = Number(value);

  if (type === "pm25") {
    if (v <= 9) return "Low estimate";
    if (v <= 35.4) return "Moderate";
    if (v <= 55.4) return "Elevated";
    return "High estimate";
  }

  if (v <= 54) return "Low estimate";
  if (v <= 154) return "Moderate";
  if (v <= 254) return "Elevated";

  return "High estimate";
}

function valueFromAir(air, key) {
  const currentValue = air?.current?.[key];

  if (currentValue !== null && currentValue !== undefined) {
    return currentValue;
  }

  const hourly = air?.hourly?.[key];
  const times = air?.hourly?.time || [];
  const now = (air?.current?.time || "").slice(0, 13);
  const index = times.findIndex((value) => value.slice(0, 13) === now);

  if (Array.isArray(hourly) && index >= 0) return hourly[index];

  return Array.isArray(hourly) ? hourly[0] : null;
}

function renderAirQuality(air) {
  const rawAqi = valueFromAir(air, "us_aqi");
  const aqi = rawAqi === null || rawAqi === undefined
    ? Number.NaN
    : Number(rawAqi);

  const pm25 = valueFromAir(air, "pm2_5");
  const pm10 = valueFromAir(air, "pm10");
  const category = aqiCategory(aqi);

  setText("#aqiValue", safeNumber(aqi));
  setText("#pm25Value", safeNumber(pm25, 1));
  setText("#pm10Value", safeNumber(pm10, 1));
  setText("#aqiStatusTitle", category.title);
  setText("#aqiDescription", category.copy);

  const badge = $("#aqiBadge");
  badge.textContent = category.label;
  badge.className = `air-quality-pill ${category.className}`.trim();

  const gauge = $("#aqiGauge");
  if (gauge) {
    gauge.style.left = `${clamp((Number(aqi) || 0) / 500 * 100, 0, 100)}%`;
  }

  setText("#pm25Status", particulateCategory(pm25, "pm25"));
  setText("#pm10Status", particulateCategory(pm10, "pm10"));

  if (!Number.isFinite(Number(aqi))) {
    setText("#healthTipTitle", "Check an official local reading.");
    setText("#healthTipText", "This estimate is unavailable. Use local monitoring and public-health guidance for decisions.");
  } else if (Number(aqi) <= 50) {
    setText("#healthTipTitle", "A good moment to get some fresh air.");
    setText("#healthTipText", "The model estimate is in a good range. Keep an eye on changing conditions and local alerts.");
  } else if (Number(aqi) <= 100) {
    setText("#healthTipTitle", "Listen to how the air feels.");
    setText("#healthTipText", "People who are sensitive to pollution can take breaks and adjust outdoor activity if they feel discomfort.");
  } else {
    setText("#healthTipTitle", "Give outdoor exertion a second thought.");
    setText("#healthTipText", "Review official local air-quality guidance and consider reducing prolonged, strenuous activity outside.");
  }
}


function renderRecommendations(weather, air) {
  const current = weather.current || {};
  const daily = weather.daily || {};

  const rainChance = Number((daily.precipitation_probability_max || [])[0]);
  const highTemp = Number((daily.temperature_2m_max || [])[0]);
  const uv = Number((daily.uv_index_max || [])[0]);
  const code = Number(current.weather_code ?? 0);

  const rawAqi = valueFromAir(air, "us_aqi");
  const aqi = rawAqi === null || rawAqi === undefined
    ? Number.NaN
    : Number(rawAqi);

  if (Number.isFinite(rainChance) && rainChance >= 70) {
    setText("#farmAdviceTitle", "Let the forecast guide your irrigation plan.");
    setText(
      "#farmAdviceText",
      `Rain is fairly likely today (${Math.round(rainChance)}% forecast probability). Check local soil moisture and drainage before adding more water, and protect vulnerable beds if heavy rain is expected.`
    );

    $("#farmChecklist").innerHTML =
      `<div><span class="check-mark">✓</span><span>Inspect drainage and avoid watering saturated soil.</span></div>
       <div><span class="check-mark">✓</span><span>Recheck rainfall timing before field work or spraying.</span></div>`;
  } else if (
    Number.isFinite(highTemp) &&
    highTemp >= 32 &&
    Number.isFinite(rainChance) &&
    rainChance < 35
  ) {
    setText("#farmAdviceTitle", "Check soil before the warmer hours.");
    setText(
      "#farmAdviceText",
      `The forecast high is ${Math.round(highTemp)}°C with a ${Math.round(rainChance)}% chance of rain. Check soil moisture directly and consider watering early only if your crop and soil need it.`
    );

    $("#farmChecklist").innerHTML =
      `<div><span class="check-mark">✓</span><span>Check the root zone rather than relying on air temperature alone.</span></div>
       <div><span class="check-mark">✓</span><span>Water early if needed; avoid runoff and overwatering.</span></div>`;
  } else if ([95, 96, 99].includes(code)) {
    setText("#farmAdviceTitle", "Put safety before field work.");
    setText(
      "#farmAdviceText",
      "Thunderstorm conditions are forecast. Pause exposed outdoor work when storms are nearby and follow local weather and farm-safety guidance."
    );

    $("#farmChecklist").innerHTML =
      `<div><span class="check-mark">✓</span><span>Secure lightweight tools and equipment where safe.</span></div>
       <div><span class="check-mark">✓</span><span>Resume outdoor work only after local conditions are safe.</span></div>`;
  } else {
    setText("#farmAdviceTitle", "Work with the forecast, not against it.");
    setText(
      "#farmAdviceText",
      `Rain chance is ${Number.isFinite(rainChance) ? `${Math.round(rainChance)}%` : "not available"} today. Use this forecast as one input alongside crop stage, soil moisture, and local field observations.`
    );

    $("#farmChecklist").innerHTML =
      `<div><span class="check-mark">✓</span><span>Confirm soil moisture before making irrigation decisions.</span></div>
       <div><span class="check-mark">✓</span><span>Use the rain forecast to plan the timing of field tasks.</span></div>`;
  }

  let score = 100;

  if (Number.isFinite(rainChance)) {
    if (rainChance >= 80) score -= 36;
    else if (rainChance >= 60) score -= 25;
    else if (rainChance >= 40) score -= 14;
  } else {
    score -= 10;
  }

  if (Number.isFinite(highTemp)) {
    if (highTemp >= 36 || highTemp <= 5) score -= 20;
    else if (highTemp >= 32 || highTemp <= 10) score -= 10;
  }

  if (Number.isFinite(uv) && uv >= 8) score -= 15;
  else if (Number.isFinite(uv) && uv >= 6) score -= 7;

  if ([95, 96, 99].includes(code)) score -= 28;

  score = clamp(Math.round(score), 12, 100);

  const rating = score >= 80
    ? "Very favourable"
    : score >= 60
      ? "Fairly suitable"
      : score >= 40
        ? "Mixed conditions"
        : "Plan flexibly";

  setText("#tourismScore", String(score));
  setText("#tourismScoreLabel", rating);
  setText("#tourismScoreDetail", "A simple weather suitability indicator");

  setText(
    "#tourismAdviceTitle",
    score >= 80
      ? "A promising window to explore."
      : score >= 60
        ? "A little planning goes a long way."
        : "Keep your plans flexible today."
  );

  let tripAdvice =
    "Check the local forecast before leaving, take water, and choose activities that fit the conditions.";

  if ([95, 96, 99].includes(code)) {
    tripAdvice =
      "Thunderstorms are forecast. Consider indoor alternatives and follow local warnings before going outdoors.";
  } else if (Number.isFinite(rainChance) && rainChance >= 60) {
    tripAdvice =
      "Rain is possible or likely. Bring waterproof layers and check trail, transport, and venue updates before departure.";
  } else if (Number.isFinite(uv) && uv >= 8) {
    tripAdvice =
      "UV levels may be high. Plan shade breaks, wear sun protection, and consider cooler hours for longer outdoor activities.";
  } else if (Number.isFinite(highTemp) && highTemp >= 32) {
    tripAdvice =
      "Warm conditions are expected. Carry water, take breaks, and favour shaded routes during the hottest hours.";
  }

  if (Number.isFinite(aqi) && aqi >= 101) {
    tripAdvice += " Also review official local air-quality advice before strenuous outdoor activities.";
  }

  setText("#tourismAdviceText", tripAdvice);

  setText(
    "#tourismChecklist",
    "Check official local alerts, transport updates, and opening hours. A forecast can guide a plan, but conditions can change."
  );

  setText(
    "#tripRainChip",
    `Rain ${Number.isFinite(rainChance) ? `${Math.round(rainChance)}%` : "—"}`
  );

  setText(
    "#tripUvChip",
    `UV ${Number.isFinite(uv) ? safeNumber(uv, 1) : "—"}`
  );
}

async function loadWeather(place) {
  if (state.isLoading) return;

  hidePlaceResults();
  setBusy(true, "Loading forecast data…");

  state.location = place;

  const common = {
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: "auto",
    forecast_days: "5",
    timeformat: "iso8601"
  };

  const weatherParams = new URLSearchParams({
    ...common,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,relative_humidity_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset",
    wind_speed_unit: "kmh",
    temperature_unit: "celsius"
  });

  const airParams = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: "auto",
    forecast_days: "2",
    current: "us_aqi,european_aqi,pm2_5,pm10",
    hourly: "us_aqi,european_aqi,pm2_5,pm10"
  });

  try {
    const [weather, air] = await Promise.all([
      fetchJson(`${API.forecast}?${weatherParams.toString()}`),
      fetchJson(`${API.airQuality}?${airParams.toString()}`).catch((error) => {
        console.warn("Air quality request failed:", error);
        return null;
      })
    ]);

    state.weather = weather;
    state.air = air;

    renderCurrentWeather(place, weather);

    if (air) renderAirQuality(air);
    else renderAirQuality(null);

    renderRecommendations(weather, air);

    const time = timeLabel(weather.current?.time, weather.timezone);

    setText("#connectionLabel", `Updated ${time}`);
    setText("#weatherSourceLine", `Open-Meteo · ${weather.timezone || "local time"}`);

    showToast(
      `Forecast updated for ${place.name}${place.country ? `, ${place.country}` : ""}.`
    );
  } catch (error) {
    console.error(error);

    setText("#connectionLabel", "Connection issue");

    showToast(
      "Could not load forecast data. Check your connection and try another city."
    );

    if (!state.weather) {
      setText("#weatherDescription", "Forecast temporarily unavailable");
      setText("#aqiStatusTitle", "Data could not be loaded");
      setText("#aqiDescription", "Please try again when your connection is available.");
    }
  } finally {
    setBusy(false);
  }
}

async function handleSearch(event) {
  event.preventDefault();

  if (state.isLoading) return;

  const input = $("#cityInput");
  const query = input.value.trim();

  if (query.length < 2) {
    showToast("Enter at least two characters to search for a city.");
    input.focus();
    return;
  }

  setBusy(true, "Finding locations…");

  try {
    const results = await searchPlaces(query);

    if (!results.length) {
      renderPlaceResults([], query);
      setText("#connectionLabel", "No matching city");
    } else if (results.length === 1) {
      hidePlaceResults();
      setBusy(false);
      await loadWeather(results[0]);
      return;
    } else {
      renderPlaceResults(results, query);
      setText("#connectionLabel", "Choose a location");
    }
  } catch (error) {
    console.error(error);

    showToast(
      "Location search failed. Please check your connection and try again."
    );

    setText("#connectionLabel", "Search unavailable");
  } finally {
    setBusy(false);
  }
}

function initializeQrCodes() {
  const qrStatus = $("#qrStatus");
  const qrContainers = $$(".qr-code");

  const isLocal =
    location.protocol === "file:" ||
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(location.hostname) ||
    !location.hostname;

  if (isLocal) {
    qrContainers.forEach((container) => {
      container.innerHTML =
        `<div class="qr-placeholder" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>`;
    });

    if (qrStatus) {
      qrStatus.textContent =
        "The shareable QR code activates automatically after you publish the site on GitHub Pages or another host.";
    }

    return;
  }

  const shareUrl = `${location.origin}${location.pathname}`;

  if (typeof window.QRCode !== "function") {
    if (qrStatus) {
      qrStatus.textContent =
        "QR library did not load. Check your internet connection and refresh the page.";
    }
    return;
  }

  qrContainers.forEach((container) => {
    container.replaceChildren();

    new window.QRCode(container, {
      text: shareUrl,
      width: 120,
      height: 120,
      colorDark: "#17364e",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M
    });
  });

  if (qrStatus) {
    qrStatus.textContent = "Ready to scan · opens this published website.";
  }
}

function initializeNavigation() {
  const links = $$(".nav-link");

  const sections = links
    .map((link) => document.getElementById(link.dataset.section))
    .filter(Boolean);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;

      links.forEach((link) => {
        const isActive = link.dataset.section === visible.target.id;

        link.classList.toggle("active", isActive);

        if (isActive) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }, {
      rootMargin: "-20% 0px -58% 0px",
      threshold: [0, .1, .25, .5]
    });

    sections.forEach((section) => observer.observe(section));
  }

  links.forEach((link) => {
    link.addEventListener("click", () => {
      links.forEach((item) => {
        item.classList.toggle("active", item === link);
      });
    });
  });
}

function initializePage() {
  $("#searchForm").addEventListener("submit", handleSearch);

  $("#refreshButton").addEventListener("click", () => {
    if (state.location) {
      loadWeather(state.location);
    } else {
      loadInitialCity();
    }
  });

  $("#cityInput").addEventListener("focus", () => {
    if ($("#searchResults").children.length) {
      $("#searchResults").hidden = false;
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-row")) {
      hidePlaceResults();
    }
  });

  $("#footerYear").textContent = String(new Date().getFullYear());

  initializeQrCodes();
  initializeNavigation();
  loadInitialCity();
}

async function loadInitialCity() {
  try {
    const results = await searchPlaces("Surabaya");

    const place =
      results.find(
        (item) =>
          item.name.toLowerCase() === "surabaya" &&
          item.country_code === "ID"
      ) || results[0];

    if (!place) throw new Error("Default city not found");

    $("#cityInput").value =
      `${place.name}, ${place.country || ""}`.replace(/,\s*$/, "");

    await loadWeather(place);
  } catch (error) {
    console.error(error);

    setText("#connectionLabel", "Waiting for connection");
    setText("#weatherDescription", "Search for a city to begin");

    showToast(
      "We could not load the default city. Try searching for a city manually."
    );
  }
}

document.addEventListener("DOMContentLoaded", initializePage);
