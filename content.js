/**
 * content.js — Runs on https://www.facebook.com/groups/*
 *
 * Strategy: use ARIA roles ([role="feed"], [role="article"]) instead of
 * Facebook's compiled class names. ARIA roles are part of the accessibility
 * tree and far more stable across Facebook UI updates.
 *
 * Flow:
 *   popup.js sends "SCRAPE" message
 *   → content.js extracts visible post text
 *   → returns raw posts array to popup.js
 *   → popup.js forwards to background.js for API call
 */

/**
 * Scroll down the page incrementally to trigger lazy-loaded posts.
 * Returns a promise that resolves once scrolling is complete.
 */
function scrollFeed(scrollSteps = 5, delayMs = 1200) {
  return new Promise((resolve) => {
    let steps = 0;
    const interval = setInterval(() => {
      window.scrollBy(0, window.innerHeight);
      steps++;
      if (steps >= scrollSteps) {
        clearInterval(interval);
        resolve();
      }
    }, delayMs);
  });
}

/**
 * Walk an element and collect text only from leaf nodes — elements that
 * contain no child elements (only raw text nodes). This skips all UI chrome
 * like buttons, icons, reaction counts, and timestamps, which are always
 * wrapped in their own elements. Nested articles (comments) are excluded
 * by passing a clone with them already removed.
 *
 * Minimum length filters out single-word noise ("Like", "Reply", "·").
 */
function extractPureText(el, minLength = 3) {
  const seen = new Set();
  const parts = [];

  el.querySelectorAll("*").forEach((node) => {
    // Leaf element: has no element children, only text nodes
    const hasElementChild = Array.from(node.childNodes).some(
      (n) => n.nodeType === Node.ELEMENT_NODE
    );
    if (hasElementChild) return;

    const text = (node.textContent || "").trim();
    if (text.length < minLength) return;
    if (seen.has(text)) return;  // deduplicate repeated UI strings

    seen.add(text);
    parts.push(text);
  });

  return parts.join(" ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Extract posts and their visible comments from the feed.
 * Uses pure-text extraction — no UI noise.
 */
function extractPosts() {
  const allArticles = Array.from(document.querySelectorAll('[role="article"]'));

  if (allArticles.length === 0) {
    return { error: "No posts found. Make sure you are on a Facebook group page." };
  }

  // Top-level articles only (no article ancestor = a post, not a comment)
  const topLevelArticles = allArticles.filter(
    (el) => !el.parentElement?.closest('[role="article"]')
  );

  const posts = [];
  const now = new Date().toISOString();

  topLevelArticles.forEach((article) => {
    // --- Comments: nested articles, extract pure text from each ---
    const nestedArticles = Array.from(article.querySelectorAll('[role="article"]'));
    const comments = nestedArticles
      .map((c) => {
        const text = extractPureText(c);
        return text.length >= 10 ? { text, scraped_at: now } : null;
      })
      .filter(Boolean);

    // --- Post text: clone, remove nested articles, extract pure text ---
    const clone = article.cloneNode(true);
    clone.querySelectorAll('[role="article"]').forEach((n) => n.remove());
    const text = extractPureText(clone);

    if (text.length < 30) return;

    // Reaction count from aria-label (stable attribute, not visible text)
    const reactionEl = article.querySelector('[aria-label*="reaction"]');
    const reactions = reactionEl ? reactionEl.getAttribute("aria-label") : null;

    posts.push({ text, reactions, comments, url: window.location.href, scraped_at: now });
  });

  return posts;
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "SCRAPE") return;

  const shouldScroll = message.scroll ?? true;
  const scrollSteps = message.scrollSteps ?? 5;

  (async () => {
    if (shouldScroll) {
      sendResponse({ status: "scrolling" });
      await scrollFeed(scrollSteps);
    }

    const posts = extractPosts();
    // Send result back to popup via a separate message since sendResponse
    // can only be called once and we used it for the scrolling status above.
    chrome.runtime.sendMessage({ action: "POSTS_READY", posts });
  })();

  // Return true to keep the message channel open for async response
  return true;
});
