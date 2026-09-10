(function () {
  const GITHUB_USERNAME = "mohamedsaif21";
  const CONTAINER_ID = "gh-activity";
  const MAX_FEED_ITEMS = 5;

  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;

  container.className = "gh-activity-card";

  // Render Initial Shell with Skeleton Loaders
  container.innerHTML = `
    <div class="gh-activity__header">
      <div class="gh-activity__title-group">
        <svg class="gh-activity__icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        <h3 class="gh-activity__title">Contributions & Commits</h3>
      </div>
      <span class="gh-activity__total" id="gh-total">
        <span class="gh-skeleton" style="width: 130px; height: 16px; display: inline-block;"></span>
      </span>
    </div>

    <div class="gh-heatmap-wrap">
      <div class="gh-heatmap" id="gh-heatmap">
        ${Array.from({ length: 52 * 7 }).map(() => '<div class="gh-heatmap__cell gh-skeleton gh-skeleton-cell"></div>').join('')}
      </div>
    </div>

    <div class="gh-legend">
      <span>Less</span>
      <span class="gh-legend__cell" data-level="0"></span>
      <span class="gh-legend__cell" data-level="1"></span>
      <span class="gh-legend__cell" data-level="2"></span>
      <span class="gh-legend__cell" data-level="3"></span>
      <span class="gh-legend__cell" data-level="4"></span>
      <span>More</span>
    </div>

    <div class="gh-feed-header">
      <h4 class="gh-feed-title">Latest Commits</h4>
      <a href="https://github.com/${GITHUB_USERNAME}" target="_blank" rel="noopener noreferrer" class="gh-feed-profile-link">
        View all on GitHub ↗
      </a>
    </div>

    <ul class="gh-feed" id="gh-feed">
      ${Array.from({ length: 3 }).map(() => `
        <li class="gh-skeleton-feed-item">
          <div class="gh-skeleton" style="width: 10px; height: 10px; border-radius: 50%;"></div>
          <div style="flex:1;">
            <div class="gh-skeleton gh-skeleton-line-long"></div>
            <div class="gh-skeleton gh-skeleton-line-short"></div>
          </div>
        </li>
      `).join('')}
    </ul>
  `;

  // Global Tooltip Singleton with Viewport Clamping
  let tooltip = document.querySelector(".gh-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "gh-tooltip";
    document.body.appendChild(tooltip);
  }

  let activeCell = null;

  function showTooltip(x, y, html) {
    tooltip.innerHTML = html;
    tooltip.classList.add("is-visible");

    const tipRect = tooltip.getBoundingClientRect();
    const padding = 12;

    // Viewport-safe bounds
    let left = x + 12;
    if (left + tipRect.width > window.innerWidth - padding) {
      left = x - tipRect.width - 12;
    }
    if (left < padding) left = padding;

    let top = y - tipRect.height - 10;
    if (top < padding) {
      top = y + 20;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hideTooltip() {
    tooltip.classList.remove("is-visible");
    if (activeCell) {
      activeCell.classList.remove("is-active");
      activeCell = null;
    }
  }

  // Dismiss tooltip when tapping outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".gh-heatmap__cell") && tooltip.classList.contains("is-visible")) {
      hideTooltip();
    }
  });

  document.addEventListener("touchstart", (e) => {
    if (!e.target.closest(".gh-heatmap__cell") && tooltip.classList.contains("is-visible")) {
      hideTooltip();
    }
  }, { passive: true });

  function formatDate(dateStr) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value || "";
    return div.innerHTML;
  }

  async function loadHeatmap() {
    const heatmapEl = document.getElementById("gh-heatmap");
    const totalEl = document.getElementById("gh-total");

    try {
      const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const days = data.contributions || [];

      const totalCount = data.total?.lastYear ?? days.reduce((sum, day) => sum + day.count, 0);
      if (totalEl) {
        totalEl.textContent = `${totalCount.toLocaleString()} contributions in the last year`;
      }

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
          const tooltipContent = `<strong>${day.count}</strong> contribution${day.count === 1 ? "" : "s"}<br>${formatDate(day.date)}`;

          // Desktop hover
          cell.addEventListener("mouseenter", (e) => showTooltip(e.clientX, e.clientY, tooltipContent));
          cell.addEventListener("mousemove", (e) => showTooltip(e.clientX, e.clientY, tooltipContent));
          cell.addEventListener("mouseleave", hideTooltip);

          // Mobile touch tap
          cell.addEventListener("click", (e) => {
            e.stopPropagation();
            if (activeCell === cell) {
              hideTooltip();
            } else {
              if (activeCell) activeCell.classList.remove("is-active");
              activeCell = cell;
              cell.classList.add("is-active");
              const rect = cell.getBoundingClientRect();
              showTooltip(rect.left + rect.width / 2, rect.top, tooltipContent);
            }
          });
        }
        fragment.appendChild(cell);
      });

      heatmapEl.innerHTML = "";
      heatmapEl.appendChild(fragment);
    } catch (error) {
      console.warn("Could not fetch contribution heatmap:", error);
      if (totalEl) totalEl.textContent = "Activity on GitHub";
      if (heatmapEl) {
        heatmapEl.innerHTML = `
          <div class="gh-empty-state" style="grid-column: 1 / -1;">
            <p class="gh-empty-desc">Contribution matrix active on GitHub profile.</p>
            <a href="https://github.com/${GITHUB_USERNAME}" target="_blank" rel="noopener noreferrer" class="gh-empty-btn">
              View Activity Matrix on GitHub ↗
            </a>
          </div>
        `;
      }
    }
  }

  async function loadFeed() {
    const feedEl = document.getElementById("gh-feed");
    try {
      const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/events/public`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const events = await response.json();
      const pushEvents = events.filter((event) => event.type === "PushEvent").slice(0, MAX_FEED_ITEMS);

      if (!pushEvents || pushEvents.length === 0) {
        feedEl.innerHTML = `
          <li class="gh-empty-state">
            <p class="gh-empty-desc">No recent public commits found.</p>
          </li>
        `;
        return;
      }

      const fragment = document.createDocumentFragment();
      pushEvents.forEach((event) => {
        const repo = event.repo.name;
        const commits = event.payload.commits || [];
        const commit = commits[commits.length - 1];
        const rawMessage = commit ? commit.message.split("\n")[0] : "Code update";
        const message = rawMessage.length > 85 ? rawMessage.substring(0, 85) + "…" : rawMessage;
        const sha = commit?.sha;
        const url = sha ? `https://github.com/${repo}/commit/${sha}` : `https://github.com/${repo}`;

        const item = document.createElement("li");
        item.className = "gh-feed__item";
        item.innerHTML = `
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="gh-feed__link" aria-label="Commit: ${escapeHtml(rawMessage)} in ${repo}">
            <span class="gh-feed__dot"></span>
            <span class="gh-feed__body">
              <span class="gh-feed__msg">${escapeHtml(message)}</span>
              <span class="gh-feed__meta">
                <span class="gh-feed__repo">${escapeHtml(repo.split("/")[1] || repo)}</span>
                <span>•</span>
                <span>${timeAgo(event.created_at)}</span>
              </span>
            </span>
            <span class="gh-feed__arrow" aria-hidden="true">↗</span>
          </a>
        `;
        fragment.appendChild(item);
      });

      feedEl.innerHTML = "";
      feedEl.appendChild(fragment);
    } catch (error) {
      console.warn("Could not fetch recent commits:", error);
      if (feedEl) {
        feedEl.innerHTML = `
          <li class="gh-empty-state">
            <p class="gh-empty-desc">Recent commits temporarily rate-limited or unavailable.</p>
            <a href="https://github.com/${GITHUB_USERNAME}?tab=repositories" target="_blank" rel="noopener noreferrer" class="gh-empty-btn">
              Explore Repositories on GitHub ↗
            </a>
          </li>
        `;
      }
    }
  }

  loadHeatmap();
  loadFeed();
})();