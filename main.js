const postsContainer = document.getElementById("posts");
const loadMoreBtn = document.getElementById("loadMore");

let currentIndex = 0;
const batchSize = 10;
let jobID = [];

function formatDateFromTimestamp(timestampInSeconds) {
  const date = new Date(timestampInSeconds * 1000);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  return `${year}/${month}/${day}  ${hours}:${minutes}:${seconds}`;
}

async function fetchComments(id) {
  const res = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json?print=pretty`
  );
  const data = await res.json();
  if (data.type === "comment") {
    return data;
  }
  return null;
}

async function fetchIDs() {
  const resS = await fetch(
    "https://hacker-news.firebaseio.com/v0/maxitem.json?print=pretty"
  );
  jobID = await resS.json();
}

async function fetchPost(id) {
  const res = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`
  );
  const a = await res.json();
  return a;
}

async function displayStories() {
  let slice = [];
  for (let i = jobID; i > jobID - 100; i--) {
    slice.push(i);
  }
  jobID -= 100;
//   console.log(jobID);

  const promises = slice.map(fetchPost);
  const stories = await Promise.all(promises);
console.log(stories);

  for (const story of stories) {
    if (story.url) {
    const div = document.createElement("div");
    div.className = "post";
    let commentText = "";
    if (story.kids && story.kids.length > 0) {
      let comments = [];
      let count = 1;
      for (const kid of story.kids) {
        const comment = await fetchComments(kid);
        if (comment && comment.text) {
          comments.push(`${count++}- ${comment.text}`);
        }
      }
      if (comments.length > 0) {
        console.log(comments);
        commentText = comments.join("<hr>");
      } else {
        console.log(comments);
        commentText = "No Comment";
      }
    } else {
      commentText = "No Comment";
    }
    if (story.type != "comment" ){
        // console.log(!story.dead)
        div.innerHTML = `
        <h9>${story.type}</h9>
              <a href="${story.url}" target="_blank"><strong>${
          story.title
        }</strong></a>
              <p>By ${story.by} | Score: ${
          story.score
        } | Time:   ${formatDateFromTimestamp(story.time)}</p>
              <p>${commentText}</p>
            `;
        postsContainer.appendChild(div);
    }
    currentIndex += batchSize;
  }
}
}

loadMoreBtn.addEventListener("click", displayStories);

(async () => {
  await fetchIDs();
  await displayStories();
})();
