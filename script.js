const postsContainer = document.getElementById("posts");
const loader = document.getElementById("loader");
const storiesBtn = document.getElementById("storiesBtn");
const jobsBtn = document.getElementById("jobsBtn");
const pollsBtn = document.getElementById("pollsBtn");
const notification = document.getElementById("notification");

let currentType = "story";
let currentIds = [];
let currentIndex = 0;
const BATCH_SIZE = 10;
let latestIdsSnapshot = [];

const endpointMap = {
  story: "https://hacker-news.firebaseio.com/v0/newstories.json",
  job: "https://hacker-news.firebaseio.com/v0/jobstories.json",
  poll: "https://hn.algolia.com/api/v1/search_by_date?tags=poll&hitsPerPage=100"
};

async function fetchItem(id) {
  console.log(id);
  
  try {
    const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
    if (!res.ok) throw new Error(`Failed to fetch item ${id}`);
    return await res.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function fetchIds(type) {
  console.log(`Fetching IDs for type: ${type}`);
  
  try {
    const res = await fetch(endpointMap[type]);
    console.log(`Response for ${type}:`, res);
    
    if (!res.ok) throw new Error(`Failed to fetch IDs for ${type}`);
    const data = await res.json();
    if (type === "poll") {
      return data.hits.map(hit => hit.objectID);
    }
    return data;
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function loadNextBatch() {
  if (currentIndex >= currentIds.length) return;

  loader.style.display = "block";
  const ids = currentIds.slice(currentIndex, currentIndex + BATCH_SIZE);
  const posts = await Promise.all(ids.map(id => fetchItem(id)));

  for (let post of posts) {
    if (!post) continue;
    await renderPost(post);
  }

  currentIndex += BATCH_SIZE;
  loader.style.display = "none";
}

async function renderPost(post) {
  const el = document.createElement("div");
  el.className = "post";

  const commentsSection = document.createElement("div");
  commentsSection.className = "comments";
  commentsSection.style.display = "none";

  const pollOptionsSection = document.createElement("div");
  pollOptionsSection.className = "poll-options";

  const commentBtn = document.createElement("button");
  commentBtn.textContent = "💬 Show Comments";
  commentBtn.className = "comment-btn";
  commentBtn.addEventListener("click", async () => {
    if (commentsSection.style.display === "none") {
      commentsSection.style.display = "block";
      commentsSection.innerHTML = "<p>Loading comments...</p>";
      await renderComments(post.kids, commentsSection);
      commentBtn.textContent = "💬 Hide Comments";
    } else {
      commentsSection.style.display = "none";
      commentBtn.textContent = "💬 Show Comments";
    }
  });

  el.innerHTML = `
    <h3>${post.title || "No title"}</h3>
    <p><strong>By:</strong> ${post.by || "Unknown"}</p>
    <p><strong>Type:</strong> ${post.type}</p>
    <p><strong>Time:</strong> ${post.time ? new Date(post.time * 1000).toLocaleString() : "Unknown"}</p>
    <p><strong>Score:</strong> ${post.score || 0}</p>
    <p><strong>Comments:</strong> ${post.descendants || 0}</p>
    ${post.text ? `<div class="post-text">${post.text}</div>` : ""}
    ${
      post.url
        ? `<a href="${post.url}" class="post-link" target="_blank" rel="noopener noreferrer">🔗 Read Full Article</a>`
        : ""
    }
  `;

  el.appendChild(pollOptionsSection);
  el.appendChild(commentBtn);
  el.appendChild(commentsSection);
  postsContainer.appendChild(el);

  if (post.type === "poll" && Array.isArray(post.parts) && post.parts.length > 0) {
    pollOptionsSection.innerHTML = "<p>Loading poll options...</p>";
    const options = await Promise.all(post.parts.map(id => fetchItem(id)));
    const validOptions = options.filter(opt => opt && !opt.deleted && !opt.dead);
    
    // Sort poll options by time (newest first)
    validOptions.sort((a, b) => (b.time || 0) - (a.time || 0));

    pollOptionsSection.innerHTML = "";
    for (const opt of validOptions) {
      const optEl = document.createElement("p");
      optEl.className = "poll-option";
      optEl.innerHTML = `<span class="poll-option-text">${opt.text || "No text"}</span> - <strong class="poll-option-score">${opt.score || 0} votes</strong>`;
      pollOptionsSection.appendChild(optEl);
    }
    if (validOptions.length === 0) {
      pollOptionsSection.innerHTML = "<p>No poll options available.</p>";
    }
  }
}

async function renderComments(commentIds, container, level = 0) {
  if (!commentIds || commentIds.length === 0) {
    container.innerHTML = "<p class='no-comments'>No comments available.</p>";
    return;
  }

  const comments = await Promise.all(commentIds.map(id => fetchItem(id)));
  const valid = comments.filter(c => c && !c.deleted && !c.dead);

  // Sort comments by time (newest first) at every level
  valid.sort((a, b) => (b.time || 0) - (a.time || 0));

  if (level === 0) container.innerHTML = "";

  for (const data of valid) {
    const div = document.createElement("div");
    div.className = "comment";
    div.style.marginLeft = `${level * 20}px`;

    div.innerHTML = `
      <h4>💬 ${data.by || "Anonymous"}</h4>
      <p><strong>Time:</strong> ${data.time ? new Date(data.time * 1000).toLocaleString() : "Unknown"}</p>
      <div class="comment-text">${data.text || "..."}</div>
    `;

    container.appendChild(div);

    if (Array.isArray(data.kids) && data.kids.length > 0) {
      await renderComments(data.kids, container, level + 1);
    }
  }

  if (valid.length === 0 && level === 0) {
    container.innerHTML = "<p class='no-comments'>No comments available.</p>";
  }
}

async function loadContent(type) {
  postsContainer.innerHTML = "";
  currentIndex = 0;
  currentType = type;
  loader.style.display = "block";
  currentIds = await fetchIds(type);

  if (type !== "poll") {
    const items = await Promise.all(currentIds.map(id => fetchItem(id)));
    currentIds = items
      .filter(item => item)
      .sort((a, b) => (b.time || 0) - (a.time || 0))
      .map(item => item.id);
  }

  latestIdsSnapshot = [...currentIds];
  loader.style.display = "none";
  await loadNextBatch();
}

async function checkForNewStories() {
  console.log(`Checking for new stories of type: ${currentType}`);
  
  if (currentType !== "story") return;


  const latest = await fetchIds("story");
  if (JSON.stringify(latest.slice(0, 5)) !== JSON.stringify(latestIdsSnapshot.slice(0, 5))) {
    notification.style.display = "block";
    notification.onclick = () => {
      currentIds = latest;
      latestIdsSnapshot = [...latest];
      currentIndex = 0;
      postsContainer.innerHTML = "";
      notification.style.display = "none";
      loadNextBatch();
    };
  }
}
setInterval(checkForNewStories, 5000);

function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

const throttledScrollCheck = throttle(() => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    loadNextBatch();
  }
}, 1000);

setInterval(() => {
  throttledScrollCheck();
}, 1000);

storiesBtn.addEventListener("click", () => loadContent("story"));
jobsBtn.addEventListener("click", () => loadContent("job"));
pollsBtn.addEventListener("click", () => loadContent("poll"));

loadContent("story");