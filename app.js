const eventsContainer = document.querySelector("#events");
const searchInput = document.querySelector("#search");
const emptyState = document.querySelector("#empty-state");
const pastCount = document.querySelector("#past-count");
const activeCount = document.querySelector("#active-count");
const futureCount = document.querySelector("#future-count");
const filterButtons = document.querySelectorAll(".filter-button");

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

function sourceMarkup(event) {
  if (!event.sourceUrl) {
    return `<span class="source">${event.sourceLabel}</span>`;
  }

  return `<a class="source" href="${event.sourceUrl}" target="_blank" rel="noreferrer">${event.sourceLabel}</a>`;
}

function renderCard(event) {
  const state = getEventState(event);
  const ranges = event.ranges.map(formatDateRange).join(" / ");
  const mapId = `map-${event.id}`;
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${event.location}, Umbria, Italia`)}&output=embed`;
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
        <div class="card-links">
          ${sourceMarkup(event)}
          ${unconfirmed}
        </div>
        <button class="map-toggle" type="button" aria-expanded="false" aria-controls="${mapId}">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
            <path d="M9 3v15" />
            <path d="M15 6v15" />
          </svg>
          <span>Mappa</span>
        </button>
      </div>
      <div class="map-frame" id="${mapId}" hidden>
        <iframe
          title="Mappa ${event.title}"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          src="${mapUrl}">
        </iframe>
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
  map.hidden = isOpen;
});
init();
