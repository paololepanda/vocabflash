/* ---------- Storage ---------- */
const STORAGE_KEY = "vocabflash_packs_v1";

function loadPacks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}
function savePacks(packs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(packs));
}
let packs = loadPacks();

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function getGlobalWords() {
  const all = [];
  packs.forEach((p) => p.words.forEach((w) => all.push(w)));
  return all;
}

/* ---------- Navigation ---------- */
const screenTitles = {
  "screen-home": "VocabFlash",
  "screen-capture": "Nouvelle liste",
  "screen-packs": "Mes listes",
  "screen-quiz-setup": "Quiz",
  "screen-quiz": "Quiz",
  "screen-quiz-result": "Quiz terminé",
  "screen-memory-setup": "Jeu de mémoire",
  "screen-memory": "Jeu de mémoire",
  "screen-memory-result": "Résultat",
};
let navStack = ["screen-home"];

function goTo(id, replaceStack) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.getElementById("screenTitle").textContent = screenTitles[id] || "VocabFlash";
  document.getElementById("backBtn").style.visibility = id === "screen-home" ? "hidden" : "visible";
  if (!replaceStack) {
    if (navStack[navStack.length - 1] !== id) navStack.push(id);
  }
}
document.getElementById("backBtn").addEventListener("click", () => {
  if (navStack.length > 1) {
    navStack.pop();
    const prev = navStack[navStack.length - 1];
    goTo(prev, true);
  } else {
    goTo("screen-home", true);
  }
});

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ================= CAPTURE / OCR ================= */
let capturedDataUrl = null;

document.getElementById("photoInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    capturedDataUrl = reader.result;
    const img = document.getElementById("capturedPreview");
    img.src = capturedDataUrl;
    img.style.display = "block";
    document.getElementById("analyzeBtn").disabled = false;
    document.getElementById("ocrStatus").textContent = "";
  };
  reader.readAsDataURL(file);
});

function runOCR() {
  if (!capturedDataUrl) return;
  document.getElementById("analyzeBtn").disabled = true;
  document.getElementById("ocrStatus").textContent = "Analyse en cours...";
  Tesseract.recognize(capturedDataUrl, "eng+fra", {
    logger: (m) => {
      if (m.status === "recognizing text") {
        document.getElementById("ocrStatus").textContent =
          "Reconnaissance du texte... " + Math.round(m.progress * 100) + "%";
      }
    },
  })
    .then(({ data: { text } }) => {
      const pairs = parseVocabText(text);
      document.getElementById("ocrStatus").textContent = "";
      document.getElementById("analyzeBtn").disabled = false;
      showReview(pairs);
    })
    .catch((err) => {
      console.error(err);
      document.getElementById("ocrStatus").textContent =
        "Erreur d'analyse. Réessaie avec une photo plus nette.";
      document.getElementById("analyzeBtn").disabled = false;
    });
}

function parseVocabText(rawText) {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const delimiters = [/\t+/, /\s{2,}/, /\s+-\s+/, /\s+–\s+/, /:\s*/, /,\s*/];
  const pairs = [];

  lines.forEach((line) => {
    for (const delim of delimiters) {
      const parts = line.split(delim);
      if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
        pairs.push({ en: parts[0].trim(), fr: parts[1].trim() });
        return;
      }
    }
  });
  return pairs;
}

function showReview(pairs) {
  document.getElementById("capture-step-photo").style.display = "none";
  document.getElementById("capture-step-review").style.display = "block";
  const tbody = document.getElementById("reviewTbody");
  tbody.innerHTML = "";
  if (pairs.length === 0) {
    toast("Aucune paire détectée automatiquement, ajoute-les à la main.");
  }
  pairs.forEach((p) => addReviewRow(p.en, p.fr));
}

function addReviewRow(en, fr) {
  const tbody = document.getElementById("reviewTbody");
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="text" class="rev-en" value="${escapeHtml(en || "")}"></td>
    <td><input type="text" class="rev-fr" value="${escapeHtml(fr || "")}"></td>
    <td><button class="del-row-btn" onclick="this.closest('tr').remove()">✕</button></td>
  `;
  tbody.appendChild(tr);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function savePackFromReview() {
  const rows = document.querySelectorAll("#reviewTbody tr");
  const words = [];
  rows.forEach((tr) => {
    const en = tr.querySelector(".rev-en").value.trim();
    const fr = tr.querySelector(".rev-fr").value.trim();
    if (en && fr) words.push({ id: uid(), en, fr });
  });
  if (words.length === 0) {
    toast("Ajoute au moins une paire avant d'enregistrer.");
    return;
  }
  let name = document.getElementById("packNameInput").value.trim();
  if (!name) name = "Liste du " + new Date().toLocaleDateString("fr-FR");

  packs.push({ id: uid(), name, createdAt: Date.now(), words });
  savePacks(packs);

  // reset capture screen
  document.getElementById("capture-step-photo").style.display = "block";
  document.getElementById("capture-step-review").style.display = "none";
  document.getElementById("photoInput").value = "";
  document.getElementById("capturedPreview").style.display = "none";
  document.getElementById("analyzeBtn").disabled = true;
  document.getElementById("packNameInput").value = "";
  capturedDataUrl = null;

  toast("Liste \"" + name + "\" enregistrée (" + words.length + " mots)");
  goTo("screen-packs", true);
  renderPacks();
}

/* ================= PACKS MANAGEMENT ================= */
function renderPacks() {
  const card = document.getElementById("packsListCard");
  const globalCount = getGlobalWords().length;
  let html = "";
  html += `<div class="pack-item"><div><div class="pack-name">Toutes les listes</div><div class="pack-count">${globalCount} mots au total</div></div></div>`;
  if (packs.length === 0) {
    html += `<div class="empty-state">Aucune liste pour le moment.<br>Prends une photo pour en créer une.</div>`;
  } else {
    packs.forEach((p) => {
      html += `<div class="pack-item">
        <div><div class="pack-name">${escapeHtml(p.name)}</div><div class="pack-count">${p.words.length} mots</div></div>
        <button class="del-row-btn" onclick="deletePack('${p.id}')">✕</button>
      </div>`;
    });
  }
  card.innerHTML = html;
}

function deletePack(id) {
  const p = packs.find((x) => x.id === id);
  if (!p) return;
  if (!confirm('Supprimer la liste "' + p.name + '" ?')) return;
  packs = packs.filter((x) => x.id !== id);
  savePacks(packs);
  renderPacks();
}

/* ================= SHARED LIST SELECTION ================= */
function refreshListChoices(kind) {
  const selectId = kind === "quiz" ? "quizListSelect" : "memoryListSelect";
  const select = document.getElementById(selectId);
  select.innerHTML = "";
  const globalOpt = document.createElement("option");
  globalOpt.value = "__global__";
  globalOpt.textContent = "Toutes les listes (" + getGlobalWords().length + " mots)";
  select.appendChild(globalOpt);
  packs.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name + " (" + p.words.length + " mots)";
    select.appendChild(opt);
  });
  if (kind === "quiz") {
    updateQuizListInfo();
    select.onchange = updateQuizListInfo;
  } else {
    updateMemoryPairOptions();
  }
}

function getWordsForSelection(value) {
  if (value === "__global__") return getGlobalWords();
  const p = packs.find((x) => x.id === value);
  return p ? p.words : [];
}

function updateQuizListInfo() {
  const value = document.getElementById("quizListSelect").value;
  const count = getWordsForSelection(value).length;
  document.getElementById("quizListInfo").textContent =
    count === 0
      ? "Cette liste est vide."
      : "Le quiz portera sur " + Math.min(20, count) + " carte(s) sur " + count + " mots disponibles.";
}

/* ================= QUIZ ================= */
let quizState = null;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeAnswer(s) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // strip accents
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function startQuiz() {
  const value = document.getElementById("quizListSelect").value;
  const words = getWordsForSelection(value);
  if (words.length === 0) {
    toast("Cette liste est vide.");
    return;
  }
  const count = Math.min(20, words.length);
  const chosen = shuffle(words).slice(0, count);
  const modes = ["strict", "tolerant", "qcm"];

  const questions = chosen.map((w) => {
    const direction = Math.random() < 0.5 ? "en2fr" : "fr2en";
    const mode = modes[Math.floor(Math.random() * modes.length)];
    const prompt = direction === "en2fr" ? w.en : w.fr;
    const answer = direction === "en2fr" ? w.fr : w.en;
    let options = null;
    if (mode === "qcm") {
      const pool = words.filter((x) => x !== w);
      const distractors = shuffle(pool)
        .slice(0, 3)
        .map((x) => (direction === "en2fr" ? x.fr : x.en));
      options = shuffle([answer, ...distractors]);
    }
    return { prompt, answer, direction, mode, options };
  });

  quizState = { questions, index: 0, score: 0 };
  goTo("screen-quiz");
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = quizState.questions[quizState.index];
  document.getElementById("quizProgress").textContent =
    "Carte " + (quizState.index + 1) + " / " + quizState.questions.length + " · Score : " + quizState.score;
  document.getElementById("quizWord").textContent = q.prompt;
  document.getElementById("quiz-feedback").textContent = "";
  document.getElementById("quiz-feedback").className = "";

  const pill = document.getElementById("quizModePill");
  const modeLabels = {
    strict: "Réponse exacte",
    tolerant: "Réponse tolérante",
    qcm: "Choix multiple",
  };
  pill.textContent = modeLabels[q.mode];
  pill.className = "pill mode-" + q.mode;

  const zone = document.getElementById("quizAnswerZone");
  zone.innerHTML = "";

  if (q.mode === "qcm") {
    const wrap = document.createElement("div");
    wrap.className = "qcm-options";
    q.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "btn secondary";
      btn.textContent = opt;
      btn.onclick = () => submitQuizAnswer(opt, btn);
      wrap.appendChild(btn);
    });
    zone.appendChild(wrap);
  } else {
    const input = document.createElement("input");
    input.type = "text";
    input.id = "quizTextAnswer";
    input.placeholder = "Ta réponse...";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    zone.appendChild(input);
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Valider";
    btn.onclick = () => submitQuizAnswer(input.value, btn);
    zone.appendChild(btn);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitQuizAnswer(input.value, btn);
    });
    setTimeout(() => input.focus(), 50);
  }
}

function submitQuizAnswer(given, triggerEl) {
  const q = quizState.questions[quizState.index];
  let isCorrect = false;
  if (q.mode === "qcm") {
    isCorrect = given === q.answer;
  } else if (q.mode === "strict") {
    isCorrect = given.trim().toLowerCase() === q.answer.trim().toLowerCase();
  } else {
    const a = normalizeAnswer(given);
    const b = normalizeAnswer(q.answer);
    isCorrect = a === b || levenshtein(a, b) <= 1;
  }

  const fb = document.getElementById("quiz-feedback");
  if (isCorrect) {
    quizState.score++;
    fb.textContent = "Correct !";
    fb.className = "good";
  } else {
    fb.textContent = "Raté — réponse : " + q.answer;
    fb.className = "bad";
  }

  document.querySelectorAll("#quizAnswerZone button, #quizAnswerZone input").forEach((el) => {
    el.disabled = true;
  });

  setTimeout(() => {
    quizState.index++;
    if (quizState.index >= quizState.questions.length) {
      finishQuiz();
    } else {
      renderQuizQuestion();
    }
  }, 900);
}

function finishQuiz() {
  goTo("screen-quiz-result");
  document.getElementById("quizScoreBig").textContent =
    quizState.score + " / " + quizState.questions.length;
  document.getElementById("quizScoreSub").textContent =
    quizState.score === quizState.questions.length
      ? "Sans faute, bravo !"
      : "Continue à t'entraîner.";
}

/* ================= MEMORY GAME ================= */
let memoryState = null;

function updateMemoryPairOptions() {
  const value = document.getElementById("memoryListSelect").value;
  const count = getWordsForSelection(value).length;
  const select = document.getElementById("memoryPairsSelect");
  select.innerHTML = "";
  const maxPairs = Math.min(count, 30); // sane display cap
  for (let n = 5; n <= maxPairs; n += 5) {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n + " paires (" + n * 2 + " cartes)";
    select.appendChild(opt);
  }
  if (select.options.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Pas assez de mots (5 minimum)";
    select.appendChild(opt);
  }
}

function startMemory() {
  const listValue = document.getElementById("memoryListSelect").value;
  const pairsValue = document.getElementById("memoryPairsSelect").value;
  if (!pairsValue) {
    toast("Ajoute au moins 5 mots à cette liste avant de jouer.");
    return;
  }
  launchMemoryLevel(listValue, parseInt(pairsValue, 10));
}

function launchMemoryLevel(listValue, pairsCount) {
  const words = getWordsForSelection(listValue);
  if (words.length < pairsCount) {
    // not enough vocab left to increase further
    showMemoryResult(true, "Bravo, tu as fait le tour de cette liste !", true);
    return;
  }
  const chosen = shuffle(words).slice(0, pairsCount);
  let cards = [];
  chosen.forEach((w) => {
    const pairId = uid();
    cards.push({ pairId, text: w.en, matched: false });
    cards.push({ pairId, text: w.fr, matched: false });
  });
  cards = shuffle(cards);

  memoryState = {
    listValue,
    pairsCount,
    cards,
    flipped: [],
    matchedPairs: 0,
    mistakes: 0,
    lock: false,
  };

  goTo("screen-memory");
  renderMemoryBoard();
}

function renderMemoryBoard() {
  document.getElementById("memoryLevelLabel").textContent =
    memoryState.pairsCount + " paires";
  document.getElementById("memoryMistakesLabel").textContent =
    "Erreurs : " + memoryState.mistakes;

  const grid = document.getElementById("memoryGrid");
  const cols = memoryState.cards.length <= 12 ? 3 : memoryState.cards.length <= 24 ? 4 : 5;
  grid.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
  grid.innerHTML = "";

  memoryState.cards.forEach((c, idx) => {
    const div = document.createElement("div");
    const isFlipped = memoryState.flipped.includes(idx) || c.matched;
    div.className = "mem-card" + (c.matched ? " matched" : "") + (!isFlipped ? " hidden-face" : "");
    div.textContent = isFlipped ? c.text : "";
    div.onclick = () => flipMemoryCard(idx);
    grid.appendChild(div);
  });
}

function flipMemoryCard(idx) {
  if (memoryState.lock) return;
  const c = memoryState.cards[idx];
  if (c.matched || memoryState.flipped.includes(idx)) return;
  if (memoryState.flipped.length === 2) return;

  memoryState.flipped.push(idx);
  renderMemoryBoard();

  if (memoryState.flipped.length === 2) {
    const [i1, i2] = memoryState.flipped;
    const c1 = memoryState.cards[i1];
    const c2 = memoryState.cards[i2];
    memoryState.lock = true;
    if (c1.pairId === c2.pairId) {
      setTimeout(() => {
        c1.matched = true;
        c2.matched = true;
        memoryState.matchedPairs++;
        memoryState.flipped = [];
        memoryState.lock = false;
        renderMemoryBoard();
        if (memoryState.matchedPairs === memoryState.pairsCount) {
          setTimeout(() => finishMemoryLevel(), 400);
        }
      }, 500);
    } else {
      memoryState.mistakes++;
      setTimeout(() => {
        memoryState.flipped = [];
        memoryState.lock = false;
        renderMemoryBoard();
      }, 700);
    }
  }
}

function finishMemoryLevel() {
  const perfect = memoryState.mistakes === 0;
  if (perfect) {
    const words = getWordsForSelection(memoryState.listValue);
    const nextPairs = memoryState.pairsCount + 5;
    if (words.length >= nextPairs) {
      showMemoryResult(true, "Sans faute ! Niveau suivant débloqué.", false, nextPairs);
    } else {
      showMemoryResult(true, "Sans faute, bravo ! Tu as fait le tour de cette liste.", true);
    }
  } else {
    showMemoryResult(false, "Niveau terminé avec " + memoryState.mistakes + " erreur(s).", false);
  }
}

function showMemoryResult(perfect, title, isMax, nextPairs) {
  goTo("screen-memory-result");
  document.getElementById("memoryResultTitle").textContent = title;
  document.getElementById("memoryResultDetail").textContent = perfect
    ? "0 erreur"
    : memoryState.mistakes + " erreur(s)";

  const nextBtn = document.getElementById("memoryNextLevelBtn");
  if (perfect && !isMax) {
    nextBtn.style.display = "block";
    nextBtn.textContent = "Niveau suivant (" + nextPairs + " paires)";
    nextBtn.onclick = () => launchMemoryLevel(memoryState.listValue, nextPairs);
  } else {
    nextBtn.style.display = "none";
  }
}

function retryMemorySameLevel() {
  launchMemoryLevel(memoryState.listValue, memoryState.pairsCount);
}

/* ================= SERVICE WORKER ================= */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
