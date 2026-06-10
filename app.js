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

const tagMeta = {
  gastronomia: { label: "Gastronomia", tone: "red" },
  musica: { label: "Musica", tone: "violet" },
  tradizione: { label: "Tradizione", tone: "amber" },
  "torta-al-testo": { label: "Torta al testo", tone: "orange" },
  tartufo: { label: "Tartufo", tone: "brown" },
  gnocchi: { label: "Gnocchi", tone: "green" },
  baccala: { label: "Baccalà", tone: "blue" },
  rievocazione: { label: "Rievocazione", tone: "slate" },
  famiglia: { label: "Famiglia", tone: "pink" },
  "street-food": { label: "Street food", tone: "lime" },
  ballo: { label: "Ballo", tone: "purple" },
  sport: { label: "Sport", tone: "cyan" },
};

const DEFAULT_REVEAL_IMAGE_WIDTHS = [480, 768, 1024, 1366, 1448];

function revealImageFromData(event) {
  const raw = event.revealImage || event.image || null;
  if (!raw) return null;

  const config = typeof raw === "string" ? { key: raw } : raw;
  if (!config || typeof config !== "object") return null;

  const key = String(config.key || config.name || config.baseName || "")
    .replace(/^assets\//, "")
    .replace(/\.(png|jpe?g|webp)$/i, "")
    .toLocaleLowerCase("it-IT")
    .trim();

  if (!key) return null;

  const widths = Array.isArray(config.widths) && config.widths.length
    ? config.widths.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
    : DEFAULT_REVEAL_IMAGE_WIDTHS;

  if (!widths.length) return null;

  const basePath = String(config.basePath || `assets/${key}`).replace(/\.(png|jpe?g|webp)$/i, "");
  const format = String(config.format || "webp").replace(/^\./, "");
  const placeholder = String(config.placeholder || `${basePath}-placeholder.png`);
  const fallbackWidth = Number(config.fallbackWidth) || (widths.includes(1024) ? 1024 : widths.at(-1));

  return {
    key,
    alt: String(config.alt || ""),
    label: String(config.label || config.alt || `Immagine ${event.title || key}`),
    basePath,
    format,
    placeholder,
    widths,
    fallbackWidth,
    intrinsicWidth: Number(config.width) || widths.at(-1),
    intrinsicHeight: Number(config.height) || Math.round(widths.at(-1) * 0.75),
    revealStartVh: Number(config.revealStartVh),
    revealEndVh: Number(config.revealEndVh),
  };
}



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
  if (range.start === range.end) return dateFormatter.format(start);
  return `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`;
}

function countdownColor(daysUntil) {
  if (daysUntil > 7) return "hsl(4 74% 42%)";
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

  const activeRange = ranges.find((range) => today >= range.startDate && today <= range.endDate);
  if (activeRange) {
    return { status: "active", label: "In corso", range: activeRange, color: "hsl(142 70% 31%)", daysUntil: 0 };
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

  return { status: "past", label: "Conclusa", range: ranges.at(-1), color: "hsl(26 6% 38%)", daysUntil: null };
}

function firstStartDate(event) {
  return Math.min(...event.ranges.map((range) => parseISODate(range.start).getTime()));
}

function readableTag(tag) {
  return tagMeta[tag]?.label || tag.replaceAll("-", " ");
}

function searchableText(event) {
  const subEvents = (event.subEvents || [])
    .map((item) => `${item.date || ""} ${item.time || ""} ${item.title || ""} ${item.note || ""}`)
    .join(" ");

  return [
    event.title,
    event.location,
    event.description,
    event.detailsMarkdown,
    event.originalDate,
    event.sourceLabel,
    ...(event.tags || []).map(readableTag),
    subEvents,
  ]
    .join(" ")
    .toLocaleLowerCase("it-IT");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markdownToHtml(markdown = "") {
  const blocks = [];
  let inList = false;

  function closeList() {
    if (inList) {
      blocks.push("</ul>");
      inList = false;
    }
  }

  function inline(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  markdown.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) {
      closeList();
      return;
    }
    if (line.startsWith("### ")) {
      closeList();
      blocks.push(`<h4>${inline(line.slice(4))}</h4>`);
      return;
    }
    if (line.startsWith("## ")) {
      closeList();
      blocks.push(`<h3>${inline(line.slice(3))}</h3>`);
      return;
    }
    if (line.startsWith("- ")) {
      if (!inList) {
        blocks.push("<ul>");
        inList = true;
      }
      blocks.push(`<li>${inline(line.slice(2))}</li>`);
      return;
    }
    closeList();
    blocks.push(`<p>${inline(line)}</p>`);
  });

  closeList();
  return blocks.join("");
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
        <path d="M7 3v8"></path>
        <path d="M4.5 3v8"></path>
        <path d="M9.5 3v8"></path>
        <path d="M4.5 11c0 1.4 1.1 2.5 2.5 2.5S9.5 12.4 9.5 11"></path>
        <path d="M7 13.5V21"></path>
        <path d="M17 3c-2 1.7-3 3.9-3 6.5V13h3v8"></path>
        <path d="M17 3v18"></path>
      </svg>
    `,
    info: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4"></path>
        <path d="M12 8h.01"></path>
      </svg>
    `,
  };
  return icons[name] || "";
}

function eventActionsMarkup(event, mapId, detailsId) {
  const sourceLabel = escapeHtml(event.sourceLabel || "Fonte");
  const sourceUrl = escapeHtml(event.sourceUrl || "");
  const menuUrl = escapeHtml(event.menuUrl || "");

  const sourceButton = event.sourceUrl
    ? `<a class="action-button has-tooltip" href="${sourceUrl}" target="_blank" rel="noopener noreferrer" aria-label="Apri fonte: ${sourceLabel}" data-tooltip="Apri fonte">${icon("source")}</a>`
    : `<span class="action-button is-disabled has-tooltip" aria-label="Fonte non disponibile" data-tooltip="Fonte non disponibile">${icon("source")}</span>`;

  const menuButton = event.menuUrl && event.menuComplete
    ? `<a class="action-button has-tooltip" href="${menuUrl}" target="_blank" rel="noopener noreferrer" aria-label="Apri menù completo" data-tooltip="Menù completo">${icon("menu")}</a>`
    : "";

  return `
    <div class="action-group">
      ${sourceButton}
      ${menuButton}
      <button class="action-button details-toggle has-tooltip" type="button" aria-expanded="false" aria-controls="${detailsId}" aria-label="Mostra dettagli" data-tooltip="Dettagli">${icon("info")}</button>
      <button class="action-button map-toggle has-tooltip" type="button" aria-expanded="false" aria-controls="${mapId}" aria-label="Mostra mappa" data-tooltip="Mappa">${icon("map")}</button>
    </div>
  `;
}

function tagsMarkup(event) {
  return (event.tags || [])
    .map((tag) => {
      const meta = tagMeta[tag] || { label: readableTag(tag), tone: "red" };
      return `<span class="event-tag tag-${escapeHtml(meta.tone)}">${escapeHtml(meta.label)}</span>`;
    })
    .join("");
}

function eventRevealMarkup(event) {
  const image = revealImageFromData(event);
  if (!image) return "";

  const srcset = image.widths.map((width) => `${image.basePath}-${width}.${image.format} ${width}w`).join(", ");

  const tuning = [
    Number.isFinite(image.revealStartVh) ? `data-reveal-start-vh="${escapeHtml(image.revealStartVh)}"` : "",
    Number.isFinite(image.revealEndVh) ? `data-reveal-end-vh="${escapeHtml(image.revealEndVh)}"` : "",
  ].filter(Boolean).join(" ");

  return `
    <section class="festival-reveal" data-reveal-image="${escapeHtml(image.key)}" ${tuning} aria-label="${escapeHtml(image.label)}">
      <picture class="festival-reveal-media" style="--placeholder: url('${escapeHtml(image.placeholder)}')">
        <source type="image/${escapeHtml(image.format)}" srcset="${escapeHtml(srcset)}" sizes="100vw" />
        <img src="${escapeHtml(image.basePath)}-${escapeHtml(image.fallbackWidth)}.${escapeHtml(image.format)}" alt="${escapeHtml(image.alt)}" width="${escapeHtml(image.intrinsicWidth)}" height="${escapeHtml(image.intrinsicHeight)}" loading="lazy" decoding="async" />
      </picture>
    </section>
  `;
}

function formatSubEventDate(value) {
  return dateFormatter.format(parseISODate(value));
}

function getDateState(dateValue, today = localDate()) {
  const date = parseISODate(dateValue);
  if (date < today) return { status: "past", label: "Passata", color: "hsl(26 6% 38%)" };
  if (date.getTime() === today.getTime()) return { status: "active", label: "Oggi", color: "hsl(142 70% 31%)" };
  const daysUntil = diffDays(today, date);
  return { status: "future", label: daysUntil === 1 ? "Domani" : `Tra ${daysUntil} giorni`, color: countdownColor(daysUntil) };
}

function subEventsMarkup(event) {
  const items = (event.subEvents || [])
    .filter((item) => item.date && item.title)
    .sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`));

  if (!items.length) return "";

  const grouped = items.reduce((acc, item) => {
    acc[item.date] ||= [];
    acc[item.date].push(item);
    return acc;
  }, {});

  return `
    <section class="sub-events" aria-label="Serate">
      <h4>Serate</h4>
      ${Object.entries(grouped)
        .map(([date, dayItems]) => {
          const state = getDateState(date);
          return `
            <div class="sub-event-day is-${state.status}" style="--countdown-color: ${state.color}">
              <header>
                <h5>${escapeHtml(formatSubEventDate(date))}</h5>
                <span class="badge sub-event-status">${escapeHtml(state.label)}</span>
              </header>
              <ul>
                ${dayItems
                  .map(
                    (item) => `<li>
                      <time class="sub-event-time">${escapeHtml(item.time || "")}</time>
                      <div class="sub-event-content">
                        <strong>${escapeHtml(item.title)}</strong>
                        ${item.note ? `<span>${escapeHtml(item.note)}</span>` : ""}
                      </div>
                    </li>`
                  )
                  .join("")}
              </ul>
            </div>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderCard(event) {
  const state = getEventState(event);
  const ranges = event.ranges.map(formatDateRange).join(" / ");
  const mapId = `map-${event.id}`;
  const detailsId = `details-${event.id}`;
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${event.location}, Umbria, Italia`)}&output=embed`;
  const escapedMapUrl = escapeHtml(mapUrl);
  const escapedMapTitle = escapeHtml(`Mappa ${event.title}`);
  const unconfirmed = event.confirmed ? "" : `<span class="unconfirmed">Date da confermare</span>`;

  return `
    <article class="card is-${state.status}" style="--countdown-color: ${state.color}">
      <span class="badge card-status">${escapeHtml(state.label)}</span>
      <div class="card-main">
        <p class="date">${escapeHtml(ranges)}</p>
        <h2>${escapeHtml(event.title)}</h2>
        <p class="location">${escapeHtml(event.location)}</p>
        <div class="card-tags">${tagsMarkup(event)}</div>
      </div>
      <p class="description">${escapeHtml(event.description)}</p>
      <footer class="card-footer">
        ${unconfirmed}
        ${eventActionsMarkup(event, mapId, detailsId)}
      </footer>
      <div class="details-panel markdown-content" id="${detailsId}" hidden>
        ${markdownToHtml(event.detailsMarkdown || "")}
        ${subEventsMarkup(event)}
      </div>
      <div class="map-frame" id="${mapId}" data-map-src="${escapedMapUrl}" data-map-title="${escapedMapTitle}" hidden></div>
      ${eventRevealMarkup(event)}
    </article>
  `;
}

function eventMatches(event, query) {
  return query ? searchableText(event).includes(query) : true;
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("it-IT");
  const searched = allEvents.filter((event) => eventMatches(event, query));
  const searchedStates = searched.map((event) => getEventState(event).status);
  const filtered = searched.filter((event) => enabledStatuses.has(getEventState(event).status));

  pastCount.textContent = `${searchedStates.filter((status) => status === "past").length} passati`;
  activeCount.textContent = `${searchedStates.filter((status) => status === "active").length} in corso`;
  futureCount.textContent = `${searchedStates.filter((status) => status === "future").length} futuri`;
  eventsContainer.innerHTML = filtered.map(renderCard).join("");
  emptyState.hidden = filtered.length !== 0;
  initResponsiveImages(eventsContainer);
  updateFestivalRevealTargets();
}

function closeMobileMenu() {
  if (!topbar || !mobileMenuToggle) return;
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

function closeSiblingPanel(button, panelSelector) {
  const card = button.closest(".card");
  if (!card) return;

  const siblingButton = card.querySelector(panelSelector === ".map-frame" ? ".map-toggle" : ".details-toggle");
  const siblingPanel = card.querySelector(panelSelector);

  if (!siblingButton || !siblingPanel) return;
  siblingButton.setAttribute("aria-expanded", "false");
  siblingButton.setAttribute("aria-label", panelSelector === ".map-frame" ? "Mostra mappa" : "Mostra dettagli");
  siblingButton.dataset.tooltip = panelSelector === ".map-frame" ? "Mappa" : "Dettagli";
  siblingPanel.hidden = true;
}

function ensureMapIframe(map) {
  if (map.childElementCount > 0) return;
  const iframe = document.createElement("iframe");
  iframe.title = map.dataset.mapTitle;
  iframe.loading = "lazy";
  iframe.referrerPolicy = "no-referrer-when-downgrade";
  iframe.src = map.dataset.mapSrc;
  map.append(iframe);
}

function handlePanelToggle(event) {
  const detailsButton = event.target.closest(".details-toggle");
  const mapButton = event.target.closest(".map-toggle");
  const button = detailsButton || mapButton;
  if (!button) return;

  const isDetails = Boolean(detailsButton);
  const panel = document.getElementById(button.getAttribute("aria-controls"));
  if (!panel) return;

  const isOpen = button.getAttribute("aria-expanded") === "true";

  if (isDetails) {
    closeSiblingPanel(button, ".map-frame");
    button.setAttribute("aria-expanded", String(!isOpen));
    button.setAttribute("aria-label", isOpen ? "Mostra dettagli" : "Nascondi dettagli");
    button.dataset.tooltip = isOpen ? "Dettagli" : "Chiudi dettagli";
    panel.hidden = isOpen;
    return;
  }

  closeSiblingPanel(button, ".details-panel");
  button.setAttribute("aria-expanded", String(!isOpen));
  button.setAttribute("aria-label", isOpen ? "Mostra mappa" : "Nascondi mappa");
  button.dataset.tooltip = isOpen ? "Mappa" : "Chiudi mappa";
  panel.hidden = isOpen;
  if (!isOpen) ensureMapIframe(panel);
}

async function init() {
  try {
    const response = await fetch("data/sagre.json?v=20260610-alpha-scroll-fix");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

eventsContainer.addEventListener("click", handlePanelToggle);

if (mobileMenuToggle && topbar) {
  mobileMenuToggle.addEventListener("click", toggleMobileMenu);
  mobileMenuToggle.addEventListener("pointerup", (event) => event.stopPropagation());

  document.addEventListener("click", (event) => {
    if (!topbar.classList.contains("is-menu-open")) return;
    if (topbar.contains(event.target)) return;
    closeMobileMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && topbar.classList.contains("is-menu-open")) {
      closeMobileMenu();
      mobileMenuToggle.focus();
    }
  });
}


function initResponsiveImages(root = document) {
  root.querySelectorAll(".parallax-picture, .festival-reveal-media").forEach((picture) => {
    const image = picture.querySelector("img");
    if (!image || picture.dataset.loadingInitialized === "true") return;
    picture.dataset.loadingInitialized = "true";

    function markLoaded() {
      picture.classList.add("is-loaded");
      if (picture.classList.contains("festival-reveal-media")) updateFestivalRevealTargets();
    }

    if (image.complete && image.naturalWidth > 0) {
      markLoaded();
      return;
    }

    image.addEventListener("load", markLoaded, { once: true });
    image.addEventListener("error", markLoaded, { once: true });
  });
}

const revealAnimationState = new WeakMap();

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function easeInOutSine(value) {
  return -(Math.cos(Math.PI * clamp01(value)) - 1) / 2;
}

function updateFestivalRevealTargets() {
  document.querySelectorAll(".festival-reveal").forEach((section) => {
    const image = section.querySelector("img");
    if (!image) return;

    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 1;
    const imageRatio = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalHeight / image.naturalWidth : 0.75;
    const imageHeight = Math.max(rect.width * imageRatio, rect.height * 1.28);
    const maxTravel = Math.max(0, imageHeight - rect.height);

    // La parte alta resta leggibile quando la sezione entra in viewport.
    // Il movimento comincia solo quando il blocco è già dentro la pagina
    // e finisce prima che sparisca, con easing lento ai limiti. I valori
    // possono essere sovrascritti per singola sagra con data-reveal-start-vh
    // e data-reveal-end-vh, espressi come frazione dell'altezza viewport.
    const startVh = Number(section.dataset.revealStartVh) || 0.68;
    const endVh = Number(section.dataset.revealEndVh) || -0.18;
    const startLine = viewportHeight * startVh;
    const endLine = viewportHeight * endVh;
    const rawProgress = clamp01((startLine - rect.top) / Math.max(1, startLine - endLine + rect.height));
    const easedProgress = easeInOutSine(rawProgress);
    const targetOffset = (0.5 - easedProgress) * maxTravel;

    const state = revealAnimationState.get(section) || { currentOffset: targetOffset };
    state.targetOffset = targetOffset;
    state.imageHeight = imageHeight;
    revealAnimationState.set(section, state);

    section.style.setProperty("--festival-image-height", `${imageHeight.toFixed(1)}px`);
  });
}

function renderFestivalRevealMotion() {
  document.querySelectorAll(".festival-reveal").forEach((section) => {
    const state = revealAnimationState.get(section);
    if (!state) return;

    state.currentOffset += (state.targetOffset - state.currentOffset) * 0.055;
    section.style.setProperty("--reveal-offset", `${state.currentOffset.toFixed(2)}px`);
  });

  requestAnimationFrame(renderFestivalRevealMotion);
}

function initFestivalImageReveal() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  let ticking = false;
  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateFestivalRevealTargets();
      ticking = false;
    });
  }

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  window.addEventListener("orientationchange", requestUpdate);
  updateFestivalRevealTargets();
  renderFestivalRevealMotion();
}

function initHeroParallax() {
  const hero = document.querySelector("#hero");
  const layers = document.querySelectorAll(".parallax-layer");
  if (!hero || layers.length === 0) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

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
    scrollEase: 0.09,
    mouseEase: 0.055,
    maxMouseX: hasFinePointer ? 46 : 0,
    maxMouseY: hasFinePointer ? 30 : 0,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(current, target, ease) {
    return current + (target - current) * ease;
  }

  function updateTargets(event) {
    const rect = hero.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 1;
    state.targetScroll = clamp(-rect.top / Math.max(1, rect.height - viewportHeight * 0.18), 0, 1);

    if (hasFinePointer && event && typeof event.clientX === "number") {
      const viewportX = event.clientX / (window.innerWidth || 1) - 0.5;
      const viewportY = event.clientY / viewportHeight - 0.5;
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
  window.addEventListener("orientationchange", updateTargets);
  if (hasFinePointer) window.addEventListener("pointermove", updateTargets, { passive: true });

  updateTargets();
  renderParallax();
}

init();
initResponsiveImages();
initHeroParallax();
initFestivalImageReveal();
