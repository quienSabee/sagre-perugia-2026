const eventsContainer = document.querySelector("#events");
const searchInput = document.querySelector("#search");
const emptyState = document.querySelector("#empty-state");
const totalCount = document.querySelector("#total-count");
const activeCount = document.querySelector("#active-count");
const futureCount = document.querySelector("#future-count");

let allEvents = [];

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

  return `<a class="source" href="${event.sourceUrl}" target="_blank" rel="noreferrer">Fonte</a>`;
}

function renderCard(event) {
  const state = getEventState(event);
  const ranges = event.ranges.map(formatDateRange).join(" / ");
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
        ${sourceMarkup(event)}
        ${unconfirmed}
      </div>
    </article>
  `;
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("it-IT");
  const filtered = query
    ? allEvents.filter((event) => searchableText(event).includes(query))
    : allEvents;

  const states = filtered.map((event) => getEventState(event).status);

  totalCount.textContent = `${filtered.length} ${filtered.length === 1 ? "evento" : "eventi"}`;
  activeCount.textContent = `${states.filter((status) => status === "active").length} in corso`;
  futureCount.textContent = `${states.filter((status) => status === "future").length} futuri`;

  eventsContainer.innerHTML = filtered.map(renderCard).join("");
  emptyState.hidden = filtered.length !== 0;
}

async function init() {
  try {
    const response = await fetch("data/sagre.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    allEvents = await response.json();
    render();
  } catch (error) {
    eventsContainer.innerHTML = "";
    emptyState.hidden = false;
    emptyState.textContent = "Impossibile caricare data/sagre.json.";
    console.error(error);
  }
}

searchInput.addEventListener("input", render);
init();
