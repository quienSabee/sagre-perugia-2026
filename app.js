const eventsContainer = document.querySelector("#events");
const searchInput = document.querySelector("#search");
const emptyState = document.querySelector("#empty-state");
const pastCount = document.querySelector("#past-count");
const activeCount = document.querySelector("#active-count");
const futureCount = document.querySelector("#future-count");
const filterButtons = document.querySelectorAll(".filter-button");
const topbar = document.querySelector(".topbar");
const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");

let allEvents = [];
const enabledStatuses = new Set(["active", "future"]);

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function localDate(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseISODate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function diffDays(from, to) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((localDate(to) - localDate(from)) / msPerDay);
}

function formatDateRange(range) {
  const start = parseISODate(range.start);
  const end = parseISODate(range.end);

  if (range.start === range.end) {
    return dateFormatter.format(start);
  }

  return `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`;
}

function countdownColor(daysUntil) {
  if (daysUntil > 7) {
    return "hsl(4 74% 42%)";
  }

  const clamped = Math.max(1, Math.min(7, daysUntil));
  const hue = 118 - ((clamped - 1) / 6) * 66;
  return `hsl(${Math.round(hue)} 76% 38%)`;
}

function getEventState(event, today = localDate()) {
  const ranges = event.ranges
    .map((range) => ({
      ...range,
      startDate: parseISODate(range.start),
      endDate: parseISODate(range.end),
    }))
    .sort((a, b) => a.startDate - b.startDate);

  const activeRange = ranges.find(
    (range) => today >= range.startDate && today <= range.endDate,
  );

  if (activeRange) {
    return {
      status: "active",
      label: "In corso",
      range: activeRange,
      color: "hsl(142 70% 31%)",
      daysUntil: 0,
    };
  }

  const nextRange = ranges.find((range) => range.startDate > today);

  if (nextRange) {
    const daysUntil = diffDays(today, nextRange.startDate);
    return {
      status: "future",
      label: daysUntil === 1 ? "Domani" : `Tra ${daysUntil} giorni`,
      range: nextRange,
      color: countdownColor(daysUntil),
      daysUntil,
    };
  }

  return {
    status: "past",
    label: "Conclusa",
    range: ranges.at(-1),
    color: "hsl(26 6% 38%)",
    daysUntil: null,
  };
}

function firstStartDate(event) {
  return Math.min(...event.ranges.map((range) => parseISODate(range.start).getTime()));
}

function searchableText(event) {
  return [
    event.title,
    event.location,
    event.description,
    event.originalDate,
    event.sourceLabel,
  ]
    .join(" ")
    .toLocaleLowerCase("it-IT");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function icon(name) {
  const icons = {
    source: `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M10 13a5 5 0 0 0 7.1 0l2.8-2.8a5 5 0 0 0-7.1-7.1l-1.6 1.6" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-2.8 2.8a5 5 0 0 0 7.1 7.1l1.6-1.6" />
      </svg>
    `,
    map: `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
        <path d="M9 3v15" />
        <path d="M15 6v15" />
      </svg>
    `,
    menu: `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 4h16" />
        <path d="M4 10h16" />
        <path d="M4 16h10" />
        <path d="M4 20h8" />
      </svg>
    `,
  };

  return icons[name];
}

function eventActionsMarkup(event, mapId) {
  const sourceLabel = escapeHtml(event.sourceLabel);
  const sourceUrl = escapeHtml(event.sourceUrl || "");
  const menuUrl = escapeHtml(event.menuUrl || "");

  const sourceButton = event.sourceUrl
    ? `
      <a class="action-button source-button" href="${sourceUrl}" target="_blank" rel="noreferrer" aria-label="Apri fonte: ${sourceLabel}" title="Fonte">
        ${icon("source")}
      </a>
    `
    : `
      <span class="action-button source-button is-disabled" aria-label="${sourceLabel}" title="${sourceLabel}">
        ${icon("source")}
      </span>
    `;

  const menuButton = event.menuUrl
    ? `
      <a class="action-button menu-button" href="${menuUrl}" target="_blank" rel="noreferrer" aria-label="Apri menù" title="Menù">
        ${icon("menu")}
      </a>
    `
    : "";

  return `
    <div class="action-group" aria-label="Azioni evento">
      ${sourceButton}
      ${menuButton}
      <button class="action-button map-toggle" type="button" aria-label="Mostra mappa" title="Mappa" aria-expanded="false" aria-controls="${mapId}">
        ${icon("map")}
      </button>
    </div>
  `;
}

function renderCard(event) {
  const state = getEventState(event);
  const ranges = event.ranges.map(formatDateRange).join(" / ");
  const mapId = `map-${event.id}`;
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${event.location}, Umbria, Italia`)}&output=embed`;
  const escapedMapUrl = escapeHtml(mapUrl);
  const escapedMapTitle = escapeHtml(`Mappa ${event.title}`);
  const unconfirmed = event.confirmed
    ? ""
    : `<span class="unconfirmed">Date da confermare</span>`;

  return `
    <article class="card is-${state.status}" style="--countdown-color: ${state.color}">
      <div class="card-header">
        <div class="meta-row">
          <span class="badge">${state.label}</span>
          <span class="date">${ranges}</span>
        </div>
        <h2>${event.title}</h2>
      </div>
      <p class="location">${event.location}</p>
      <p class="description">${event.description}</p>
      <div class="card-footer">
        ${unconfirmed}
        ${eventActionsMarkup(event, mapId)}
      </div>
      <div class="map-frame" id="${mapId}" data-map-src="${escapedMapUrl}" data-map-title="${escapedMapTitle}" hidden>
      </div>
    </article>
  `;
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("it-IT");
  const searched = query
    ? allEvents.filter((event) => searchableText(event).includes(query))
    : allEvents;

  const searchedStates = searched.map((event) => getEventState(event).status);
  const filtered = searched.filter((event) =>
    enabledStatuses.has(getEventState(event).status),
  );

  pastCount.textContent = `${searchedStates.filter((status) => status === "past").length} passati`;
  activeCount.textContent = `${searchedStates.filter((status) => status === "active").length} in corso`;
  futureCount.textContent = `${searchedStates.filter((status) => status === "future").length} futuri`;

  eventsContainer.innerHTML = filtered.map(renderCard).join("");
  emptyState.hidden = filtered.length !== 0;
}

async function init() {
  try {
    const response = await fetch("data/sagre.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    allEvents = (await response.json()).sort((a, b) => firstStartDate(a) - firstStartDate(b));
    render();
  } catch (error) {
    eventsContainer.innerHTML = "";
    emptyState.hidden = false;
    emptyState.textContent = "Impossibile caricare data/sagre.json.";
    console.error(error);
  }
}

searchInput.addEventListener("input", render);
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const status = button.dataset.status;

    if (enabledStatuses.has(status)) {
      enabledStatuses.delete(status);
      button.setAttribute("aria-pressed", "false");
    } else {
      enabledStatuses.add(status);
      button.setAttribute("aria-pressed", "true");
    }

    render();
  });
});
eventsContainer.addEventListener("click", (event) => {
  const button = event.target.closest(".map-toggle");

  if (!button) {
    return;
  }

  const map = document.getElementById(button.getAttribute("aria-controls"));
  const isOpen = button.getAttribute("aria-expanded") === "true";

  button.setAttribute("aria-expanded", String(!isOpen));
  button.setAttribute("aria-label", isOpen ? "Mostra mappa" : "Nascondi mappa");
  map.hidden = isOpen;

  if (!isOpen && map.childElementCount === 0) {
    const iframe = document.createElement("iframe");
    iframe.title = map.dataset.mapTitle;
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.src = map.dataset.mapSrc;
    map.append(iframe);
  }
});

if (mobileMenuToggle && topbar) {
  mobileMenuToggle.addEventListener("click", () => {
    const isOpen = topbar.classList.toggle("is-menu-open");
    mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
    mobileMenuToggle.setAttribute("aria-label", isOpen ? "Chiudi filtri" : "Apri filtri");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !topbar.classList.contains("is-menu-open")) {
      return;
    }

    topbar.classList.remove("is-menu-open");
    mobileMenuToggle.setAttribute("aria-expanded", "false");
    mobileMenuToggle.setAttribute("aria-label", "Apri filtri");
  });
}

init();

function initHeroParallax() {
  const hero = document.querySelector("#hero");
  const layers = document.querySelectorAll(".parallax-layer");

  if (!hero || layers.length === 0) {
    return;
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

  if (prefersReducedMotion) {
    return;
  }

  const state = {
    targetScroll: 0,
    currentScroll: 0,

    targetMouseX: 0,
    targetMouseY: 0,
    currentMouseX: 0,
    currentMouseY: 0,

    rafId: null,
  };

  const config = {
    scrollEase: 0.07,
    mouseEase: 0.045,
    maxMouseX: 32,
    maxMouseY: 20,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(current, target, ease) {
    return current + (target - current) * ease;
  }

  function updateTargets(event) {
    const rect = hero.getBoundingClientRect();
    const windowHeight = window.innerHeight || 1;

    state.targetScroll = clamp(
      -rect.top / Math.max(1, rect.height - windowHeight * 0.25),
      0,
      1
    );

    if (event && typeof event.clientX === "number") {
      const viewportX = event.clientX / (window.innerWidth || 1) - 0.5;
      const viewportY = event.clientY / (window.innerHeight || 1) - 0.5;

      state.targetMouseX = viewportX * config.maxMouseX;
      state.targetMouseY = viewportY * config.maxMouseY;
    }
  }

  function render() {
    state.currentScroll = lerp(
      state.currentScroll,
      state.targetScroll,
      config.scrollEase
    );

    state.currentMouseX = lerp(
      state.currentMouseX,
      state.targetMouseX,
      config.mouseEase
    );

    state.currentMouseY = lerp(
      state.currentMouseY,
      state.targetMouseY,
      config.mouseEase
    );

    hero.style.setProperty("--hero-scroll", state.currentScroll.toFixed(4));
    hero.style.setProperty("--mouse-x", `${state.currentMouseX.toFixed(2)}px`);
    hero.style.setProperty("--mouse-y", `${state.currentMouseY.toFixed(2)}px`);

    state.rafId = requestAnimationFrame(render);
  }

  window.addEventListener(
    "scroll",
    () => {
      updateTargets();
    },
    { passive: true }
  );

  window.addEventListener("resize", updateTargets);

  /*
    Importante:
    usiamo window, non hero.
    Così il movimento del mouse continua anche quando
    il cursore esce dall'hero.
  */
  if (hasFinePointer) {
    window.addEventListener(
      "pointermove",
      (event) => {
        updateTargets(event);
      },
      { passive: true }
    );
  }

  updateTargets();
  render();
}

initHeroParallax();
