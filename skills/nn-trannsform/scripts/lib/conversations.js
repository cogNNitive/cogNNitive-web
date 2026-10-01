const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Format a Date or timestamp string into YYYY-MM-DD_HHmmss.
 */
function formatSessionTimestamp(timestamp) {
  if (
    typeof timestamp === "string" &&
    /^\d{4}-\d{2}-\d{2}_\d{6}$/.test(timestamp)
  ) {
    return timestamp;
  }
  const d =
    timestamp instanceof Date
      ? timestamp
      : timestamp
        ? new Date(timestamp)
        : new Date();
  const iso = d.toISOString();
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 19).replace(/:/g, "");
  return `${datePart}_${timePart}`;
}

/**
 * Reserve a session transcript file silently.
 * Path: conversations/YYYY-MM-DD_HHmmss.md
 */
function reserveConversationSession(workspaceRoot, timestamp) {
  const stamp = formatSessionTimestamp(timestamp);
  const convDir = path.join(workspaceRoot, "conversations");
  fs.mkdirSync(convDir, { recursive: true });

  const fileName = `${stamp}.md`;
  const filePath = path.join(convDir, fileName);
  const relPath = path.join("conversations", fileName).replace(/\\/g, "/");
  const startedAt = (
    timestamp instanceof Date
      ? timestamp
      : timestamp
        ? new Date(timestamp)
        : new Date()
  ).toISOString();
  const sessionId = `session_${stamp}_${crypto.randomBytes(4).toString("hex")}`;

  const content = [
    "---",
    `session_id: "${sessionId}"`,
    `started_at: "${startedAt}"`,
    "status: in_progress",
    "turns: 0",
    "mutations: false",
    "---",
    "",
    `# Session Transcript: ${stamp}`,
    "",
  ].join("\n");

  fs.writeFileSync(filePath, content, "utf8");

  return {
    filePath,
    sessionFile: relPath,
    sessionId,
    timestamp: stamp,
    startedAt,
  };
}

/**
 * Evaluate conversation session retention.
 * Under the Guaranteed All-Session Retention policy, all sessions are preserved.
 * Discard is always false and files are never unlinked.
 */
function evaluateSessionDiscard({
  turns = 0,
  modelMutations = false,
  mutations = false,
  sessionFile = null,
} = {}) {
  const hasMutations = Boolean(modelMutations || mutations);
  const turnCount = Number(turns) || 0;

  return {
    discard: false,
    turns: turnCount,
    mutations: hasMutations,
    reason: "All sessions are retained by policy",
  };
}

/**
 * Generate 3 title suggestions based on conversation context / prompt.
 * First option is recommended.
 */
function generateTitleSuggestions(contextOrFirstPrompt) {
  const text = (contextOrFirstPrompt || "").trim();

  if (!text) {
    return [
      {
        title: "Architecture Exploration",
        slug: "architecture-exploration",
        recommended: true,
      },
      {
        title: "Workspace Modeling",
        slug: "workspace-modeling",
        recommended: false,
      },
      {
        title: "System Discussion",
        slug: "system-discussion",
        recommended: false,
      },
    ];
  }

  const stopwords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "for",
    "in",
    "on",
    "with",
    "by",
    "of",
    "at",
    "from",
    "we",
    "i",
    "you",
    "is",
    "are",
    "be",
    "this",
    "that",
    "need",
    "want",
    "please",
    "help",
    "me",
    "how",
    "can",
    "should",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));

  const slugify = (str) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const titleize = (slug) =>
    slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  if (words.length === 0) {
    return [
      {
        title: "Session Discussion",
        slug: "session-discussion",
        recommended: true,
      },
      { title: "Domain Modeling", slug: "domain-modeling", recommended: false },
      {
        title: "Architecture Notes",
        slug: "architecture-notes",
        recommended: false,
      },
    ];
  }

  const w1 = words.slice(0, Math.min(3, words.length)).join("-");
  const w2 =
    words.slice(Math.min(2, words.length)).join("-") || `${words[0]}-details`;
  const w3 =
    words.length > 2
      ? `${words[0]}-${words[words.length - 1]}-review`
      : `${words[0]}-review`;

  const slug1 = slugify(w1) || "session-topic";
  const slug2 = slugify(w2) !== slug1 ? slugify(w2) : `${slug1}-deep-dive`;
  const slug3 =
    slugify(w3) !== slug1 && slugify(w3) !== slug2
      ? slugify(w3)
      : `${slug1}-architecture`;

  return [
    { title: titleize(slug1), slug: slug1, recommended: true },
    { title: titleize(slug2), slug: slug2, recommended: false },
    { title: titleize(slug3), slug: slug3, recommended: false },
  ];
}

/**
 * Pad a 1-based turn sequence to the canonical 2-digit form (`01`..`99`,
 * `100`+ stays unpadded). Sub-1/NaN inputs clamp to `01`.
 */
function padTurn(seq) {
  return String(Math.max(1, Number(seq) || 1)).padStart(2, "0");
}

/**
 * Render the canonical turn heading for a promoted transcript:
 * `## NN Turn <NN>: <author-id>`. 1-based, 2-digit zero-padded numbering keeps
 * heading slugs (`nn-turn-01--author`) aligned with turn order. An unnamed
 * participant (missing/blank) renders the deterministic `unnamed` placeholder
 * so the `_source.md` write never blocks on naming.
 */
function resolveTurnHeading(seq, authorId) {
  const n = padTurn(seq);
  const author =
    typeof authorId === "string" && authorId.trim() !== ""
      ? authorId.trim()
      : "unnamed";
  return `## NN Turn ${n}: ${author}`;
}

/**
 * Standard Promotion Prompt Options Contract.
 */
const PROMOTION_OPTIONS = [
  {
    title: "[full] (Recommended) Full Transcript (_source.md)",
    value: "full",
    description:
      "Promotes the complete transcript to sources/conversations/ and normalizes it",
  },
  {
    title: "[none] None (keep in conversations/ only)",
    value: "none",
    description:
      "Leaves the raw transcript registered in conversations/ without promoting to sources",
  },
];

/**
 * Finalize conversation session: update status to completed, set title and ended_at,
 * and rename to conversations/YYYY-MM-DD_<titleSlug>.md.
 * @param {Object} options
 * @param {string} options.sessionFile
 * @param {string} [options.titleSlug]
 * @param {string} [options.title]
 * @param {string} [options.endedAt]
 */
function finalizeConversationSession({
  sessionFile,
  titleSlug = "session",
  title = undefined,
  endedAt = undefined,
}) {
  if (!fs.existsSync(sessionFile)) {
    throw new Error(`Session file not found: ${sessionFile}`);
  }

  let content = fs.readFileSync(sessionFile, "utf8");
  const nowIso = endedAt || new Date().toISOString();
  const humanTitle =
    title ||
    (titleSlug ? titleSlug.replace(/[-_]/g, " ") : "Conversation Session");

  if (content.startsWith("---")) {
    const endIdx = content.indexOf("---", 3);
    if (endIdx !== -1) {
      let fm = content.slice(3, endIdx);
      const rest = content.slice(endIdx + 3);

      fm = fm.replace(/status:\s*[^\n]+/, "status: completed");
      if (!fm.includes("title:")) {
        fm += `title: "${humanTitle}"\n`;
      } else {
        fm = fm.replace(/title:\s*[^\n]+/, `title: "${humanTitle}"`);
      }
      if (!fm.includes("ended_at:")) {
        fm += `ended_at: "${nowIso}"\n`;
      } else {
        fm = fm.replace(/ended_at:\s*[^\n]+/, `ended_at: "${nowIso}"`);
      }
      content = `---${fm}---${rest}`;
    }
  }

  const dir = path.dirname(sessionFile);
  const oldBase = path.basename(sessionFile, ".md");
  const dateMatch = oldBase.match(/^(\d{4}-\d{2}-\d{2})/);
  const datePrefix = dateMatch
    ? dateMatch[1]
    : new Date().toISOString().slice(0, 10);

  let cleanSlug = titleSlug
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (cleanSlug.startsWith(datePrefix + "_")) {
    cleanSlug = cleanSlug.slice(datePrefix.length + 1);
  } else if (cleanSlug.startsWith(datePrefix + "-")) {
    cleanSlug = cleanSlug.slice(datePrefix.length + 1);
  }

  const newFileName = `${datePrefix}_${cleanSlug}.md`;
  const newFilePath = path.join(dir, newFileName);

  fs.writeFileSync(sessionFile, content, "utf8");
  if (newFilePath !== sessionFile) {
    fs.renameSync(sessionFile, newFilePath);
  }

  return {
    filePath: newFilePath,
    fileName: newFileName,
    status: "completed",
    title: humanTitle,
    endedAt: nowIso,
  };
}

/**
 * Promote conversation transcript into sources/conversations/ and normalize into sources/nn/conversations/.
 * @param {Object} options
 * @param {string} options.workspaceRoot
 * @param {string} options.sessionFile
 * @param {string} [options.titleSlug]
 * @param {string} [options.format]
 * @param {string} [options.summaryContent]
 * @param {string} [options.fullContent]
 */
async function promoteConversation({
  workspaceRoot,
  sessionFile,
  titleSlug = undefined,
  format = "full",
  summaryContent = undefined,
  fullContent = undefined,
}) {
  if (!format || format === "none") {
    return {
      format: "none",
      promotedFiles: [],
    };
  }

  const convDir = path.join(workspaceRoot, "sources", "conversations");
  fs.mkdirSync(convDir, { recursive: true });

  const rawSessionContent = fs.existsSync(sessionFile)
    ? fs.readFileSync(sessionFile, "utf8")
    : "";
  const sessionBasename = path.basename(sessionFile);
  const relSessionTranscript = `conversations/${sessionBasename}`;

  let slug = titleSlug || path.basename(sessionFile, ".md");
  slug = slug.replace(/(_summary|_source)$/, "");

  const promotedFiles = [];

  // `_summary.md` promotion is retired: the raw transcript is always registered
  // in conversations/, and the only promotion target is the full `_source.md`.
  // `summary` / `both` are accepted but no longer produce a file.
  if (format === "full") {
    const fullFileName = `${slug}_source.md`;
    const fullFilePath = path.join(convDir, fullFileName);

    let body = fullContent || rawSessionContent;
    if (body.startsWith("---")) {
      const endIdx = body.indexOf("---", 3);
      if (endIdx !== -1) {
        body = body.slice(endIdx + 3).trim();
      }
    }

    const fileContent = [
      "---",
      `origin_transcript: ${relSessionTranscript}`,
      "source_type: conversation_transcript",
      "---",
      "",
      body,
    ].join("\n");

    fs.writeFileSync(fullFilePath, fileContent, "utf8");
    promotedFiles.push(fullFilePath);
  }

  const scanner = require("../scanner");
  await scanner.scanAndProcess(workspaceRoot, { autoAcceptPrompt: true });

  return {
    format,
    promotedFiles,
  };
}

module.exports = {
  formatSessionTimestamp,
  reserveConversationSession,
  evaluateSessionDiscard,
  generateTitleSuggestions,
  padTurn,
  resolveTurnHeading,
  PROMOTION_OPTIONS,
  finalizeConversationSession,
  promoteConversation,
};
