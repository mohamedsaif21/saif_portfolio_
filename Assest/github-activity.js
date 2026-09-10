(function () {
  const GITHUB_USERNAME = "mohamedsaif21";
  const CONTAINER_ID = "gh-activity";
  const MAX_FEED_ITEMS = 5;

  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;

  container.classList.add("gh-activity");
  container.innerHTML = `
    <div class="gh-activity__header">
      <h2 class="gh-activity__title">GitHub Activity</h2>
      <span class="gh-activity__total" id="gh-total"></span>
    </div>
    <div class="gh-heatmap-wrap">
      <div class="gh-heatmap" id="gh-heatmap"></div>
    </div>
    <div class="gh-legend">
      Less
      <span class="gh-legend__cell" style="background:#161b22"></span>
      <span class="gh-legend__cell" style="background:#0e4429"></span>
      <span class="gh-legend__cell" style="background:#006d32"></span>
      <span class="gh-legend__cell" style="background:#26a641"></span>
      <span class="gh-legend__cell" style="background:#39d353"></span>
      More
    </div>
    <ul class="gh-feed" id="gh-feed"></ul>
  `;

  const tooltip = document.createElement("div");
  tooltip.className = "gh-tooltip";
  document.body.appendChild(tooltip);

  function showTooltip(evt, html) {
    tooltip.innerHTML = html;
    tooltip.style.left = evt.clientX + 12 + "px";
    tooltip.style.top = evt.clientY + 12 + "px";
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    tooltip.classList.remove("is-visible");
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function timeAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(dateStr);
  }

  async function loadHeatmap() {
    const heatmapEl = document.getElementById("gh-heatmap");
    const totalEl = document.getElementById("gh-total");

    try {
      const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last`);
      if (!response.ok) throw new Error("Failed to load contributions");
      const data = await response.json();
      const days = data.contributions || [];
      totalEl.textContent = `${data.total?.lastYear ?? days.reduce((sum, day) => sum + day.count, 0)} contributions in the last year`;

      const first = days[0];
      const firstDow = first ? new Date(first.date + "T00:00:00").getDay() : 0;
      const cells = [...Array.from({ length: firstDow }, () => null), ...days];
      const fragment = document.createDocumentFragment();

      cells.forEach((day) => {
        const cell = document.createElement("div");
        cell.className = "gh-heatmap__cell";
        if (!day) {
          cell.style.visibility = "hidden";
        } else {
          cell.dataset.level = day.level;
          cell.addEventListener("mouseenter", (event) => showTooltip(event, `<strong>${day.count}</strong> contribution${day.count === 1 ? "" : "s"}<br>${formatDate(day.date)}`));
          cell.addEventListener("mousemove", (event) => showTooltip(event, `<strong>${day.count}</strong> contribution${day.count === 1 ? "" : "s"}<br>${formatDate(day.date)}`));
          cell.addEventListener("mouseleave", hideTooltip);
        }
        fragment.appendChild(cell);
      });
      heatmapEl.appendChild(fragment);
    } catch (error) {
      heatmapEl.innerHTML = `<p class="gh-activity__error">Couldn't load contribution graph right now.</p>`;
      console.error(error);
    }
  }

  async function loadFeed() {
    const feedEl = document.getElementById("gh-feed");
    try {
      const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/events/public`);
      if (!response.ok) throw new Error("Failed to load events");
      const events = await response.json();
      const pushEvents = events.filter((event) => event.type === "PushEvent").slice(0, MAX_FEED_ITEMS);

      if (pushEvents.length === 0) {
        feedEl.innerHTML = `<p class="gh-activity__error">No recent public commits.</p>`;
        return;
      }

      const fragment = document.createDocumentFragment();
      pushEvents.forEach((event) => {
        const repo = event.repo.name;
        const commit = event.payload.commits?.[event.payload.commits.length - 1];
        const message = commit ? commit.message.split("\n")[0] : "Updated repository";
        const sha = commit?.sha;
        const url = sha ? `https://github.com/${repo}/commit/${sha}` : `https://github.com/${repo}`;
        const item = document.createElement("li");
        item.className = "gh-feed__item";
        item.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="gh-feed__item"><span class="gh-feed__dot"></span><span class="gh-feed__body"><span class="gh-feed__msg">${escapeHtml(message)}</span><span class="gh-feed__meta"><span class="gh-feed__repo">${repo.split("/")[1]}</span> · ${timeAgo(event.created_at)}</span></span></a>`;
        fragment.appendChild(item);
      });
      feedEl.appendChild(fragment);
    } catch (error) {
      feedEl.innerHTML = `<p class="gh-activity__error">Couldn't load recent commits right now.</p>`;
      console.error(error);
    }
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  loadHeatmap();
  loadFeed();
})();