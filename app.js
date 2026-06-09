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
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name) {
  const icons = {
    source: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 3h7v7"></path>
        <path d="M10 14 21 3"></path>
        <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path>
      </svg>
    `,
    map: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 1 1 16 0Z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
    `,
    menu: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16"></path>
        <path d="M4 12h16"></path>
        <path d="M4 18h16"></path>
      </svg>
    `,
  };

  return icons[name] || "";
}

function eventActionsMarkup(event, mapId) {
  const sourceLabel = escapeHtml(event.sourceLabel || "Fonte");
  const sourceUrl = escapeHtml(event.sourceUrl || "");
  const menuUrl = escapeHtml(event.menuUrl || "");

  const sourceButton = event.sourceUrl
    ? `<a class="action-button" href="${sourceUrl}" target="_blank" rel="noopener noreferrer" aria-label="Apri fonte: ${sourceLabel}">${icon("source")}</a>`
    : `<span class="action-button is-disabled" aria-label="Fonte non disponibile">${icon("source")}</span>`;

  const menuButton = event.menuUrl
    ? `<a class="action-button" href="${menuUrl}" target="_blank" rel="noopener noreferrer" aria-label="Apri menu">${icon("menu")}</a>`
    : "";

  return `
    <div class="action-group">
      ${sourceButton}
      ${menuButton}
      <button class="action-button map-toggle" type="button" aria-expanded="false" aria-controls="${mapId}" aria-label="Mostra mappa">
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
  const unconfirmed = event.confirmed ? "" : `<span class="unconfirmed">Date da confermare</span>`;

  return `
    <article class="card is-${state.status}" style="--countdown-color: ${state.color}">
      <div class="card-header">
        <div class="meta-row">
          <span class="badge">${escapeHtml(state.label)}</span>
          <span class="date">${escapeHtml(ranges)}</span>
        </div>
        <h2>${escapeHtml(event.title)}</h2>
      </div>

      <p class="location">${escapeHtml(event.location)}</p>
      <p class="description">${escapeHtml(event.description)}</p>

      <footer class="card-footer">
        ${unconfirmed}
        ${eventActionsMarkup(event, mapId)}
      </footer>

      <div
        class="map-frame"
        id="${mapId}"
        data-map-src="${escapedMapUrl}"
        data-map-title="${escapedMapTitle}"
        hidden
      ></div>
    </article>
  `;
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("it-IT");
  const searched = query
    ? allEvents.filter((event) => searchableText(event).includes(query))
    : allEvents;

  const searchedStates = searched.map((event) => getEventState(event).status);
  const filtered = searched.filter((event) => enabledStatuses.has(getEventState(event).status));

  pastCount.textContent = `${searchedStates.filter((status) => status === "past").length} passati`;
  activeCount.textContent = `${searchedStates.filter((status) => status === "active").length} in corso`;
  futureCount.textContent = `${searchedStates.filter((status) => status === "future").length} futuri`;

  eventsContainer.innerHTML = filtered.map(renderCard).join("");
  emptyState.hidden = filtered.length !== 0;
}

function closeMobileMenu() {
  if (!topbar || !mobileMenuToggle) {
    return;
  }

  topbar.classList.remove("is-menu-open");
  mobileMenuToggle.setAttribute("aria-expanded", "false");
  mobileMenuToggle.setAttribute("aria-label", "Apri filtri");
}

function toggleMobileMenu(event) {
  event.preventDefault();
  event.stopPropagation();

  const isOpen = topbar.classList.toggle("is-menu-open");
  mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
  mobileMenuToggle.setAttribute("aria-label", isOpen ? "Chiudi filtri" : "Apri filtri");
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
  mobileMenuToggle.addEventListener("click", toggleMobileMenu);

  document.addEventListener("click", (event) => {
    if (!topbar.classList.contains("is-menu-open")) {
      return;
    }

    if (topbar.contains(event.target)) {
      return;
    }

    closeMobileMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && topbar.classList.contains("is-menu-open")) {
      closeMobileMenu();
      mobileMenuToggle.focus();
    }
  });
}

function initHeroParallax() {
  const hero = document.querySelector("#hero");
  const layers = document.querySelectorAll(".parallax-layer");

  if (!hero || layers.length === 0) {
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return;
  }

  const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

  const state = {
    targetScroll: 0,
    currentScroll: 0,
    targetMouseX: 0,
    targetMouseY: 0,
    currentMouseX: 0,
    currentMouseY: 0,
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
      1,
    );

    if (hasFinePointer && event && typeof event.clientX === "number") {
      const viewportX = event.clientX / (window.innerWidth || 1) - 0.5;
      const viewportY = event.clientY / (window.innerHeight || 1) - 0.5;
      state.targetMouseX = viewportX * config.maxMouseX;
      state.targetMouseY = viewportY * config.maxMouseY;
    }
  }

  function renderParallax() {
    state.currentScroll = lerp(state.currentScroll, state.targetScroll, config.scrollEase);
    state.currentMouseX = lerp(state.currentMouseX, state.targetMouseX, config.mouseEase);
    state.currentMouseY = lerp(state.currentMouseY, state.targetMouseY, config.mouseEase);

    hero.style.setProperty("--hero-scroll", state.currentScroll.toFixed(4));
    hero.style.setProperty("--mouse-x", `${state.currentMouseX.toFixed(2)}px`);
    hero.style.setProperty("--mouse-y", `${state.currentMouseY.toFixed(2)}px`);

    requestAnimationFrame(renderParallax);
  }

  window.addEventListener("scroll", updateTargets, { passive: true });
  window.addEventListener("resize", updateTargets);

  if (hasFinePointer) {
    window.addEventListener("pointermove", updateTargets, { passive: true });
  }

  updateTargets();
  renderParallax();
}

init();
initHeroParallax();
