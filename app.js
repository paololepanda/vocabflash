// VocabFlash — app.js — v1.2

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

  const otherDelimiters = [/\s{2,}/, /\s+-\s+/, /\s+–\s+/, /:\s*/, /,\s*/];
  const pairs = [];

  lines.forEach((line) => {
    // Tab = a genuine detected table column (from the PDF reader or a
    // pasted TSV). Be lenient: if there are extra stray tab-splits,
    // treat the first cell as the word and merge the rest as the answer,
    // rather than dropping the whole line.
    if (line.indexOf("\t") !== -1) {
      const tabParts = line.split(/\t+/).map((p) => p.trim()).filter((p) => p.length > 0);
      if (tabParts.length >= 2) {
        pairs.push({ en: tabParts[0], fr: tabParts.slice(1).join(" ") });
        return;
      }
    }
    for (const delim of otherDelimiters) {
      const parts = line.split(delim);
      if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
        pairs.push({ en: parts[0].trim(), fr: parts[1].trim() });
        return;
      }
    }
  });
  return pairs;
}

/* ================= FILE IMPORT (PDF / DOCX / TXT / CSV) ================= */
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

document.getElementById("fileImportInput").addEventListener("change", (e) => {
  document.getElementById("analyzeFileBtn").disabled = !e.target.files[0];
  document.getElementById("fileImportStatus").textContent = "";
});

function runFileImport() {
  const file = document.getElementById("fileImportInput").files[0];
  if (!file) return;
  document.getElementById("analyzeFileBtn").disabled = true;
  document.getElementById("fileImportStatus").textContent = "Analyse en cours...";
  extractTextFromFile(file)
    .then((text) => {
      document.getElementById("analyzeFileBtn").disabled = false;
      handleImportedText(text, file.name);
    })
    .catch((err) => {
      console.error(err);
      document.getElementById("fileImportStatus").textContent =
        "Erreur d'analyse. Vérifie le format du fichier.";
      document.getElementById("analyzeFileBtn").disabled = false;
    });
}

function extractTextFromFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "txt" || ext === "csv") {
    return file.text();
  } else if (ext === "pdf") {
    return extractTextFromPDF(file);
  } else if (ext === "doc" || ext === "docx") {
    return extractTextFromDocx(file);
  }
  return Promise.reject(new Error("Format non supporté"));
}

function groupTextItemsToLines(items) {
  if (!items.length) return "";

  // Sort all items reading-order: top-to-bottom, then left-to-right
  const sorted = items.slice().sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);

  // Cluster into rows using a y-tolerance instead of exact rounding,
  // so tiny sub-pixel offsets don't split one visual row into two.
  const Y_TOL = 3;
  const rows = [];
  let currentRow = [];
  let lastY = null;
  sorted.forEach((it) => {
    const y = it.transform[5];
    if (lastY === null || Math.abs(lastY - y) <= Y_TOL) {
      currentRow.push(it);
    } else {
      rows.push(currentRow);
      currentRow = [it];
    }
    lastY = y;
  });
  if (currentRow.length) rows.push(currentRow);

  // Within each row, merge fragments into cells based on gap size:
  // near-zero gap = same word split across runs (e.g. a hyphen), a
  // normal gap = same cell / new word, a large gap = new table column.
  const lines = rows.map((row) => {
    const rowSorted = row.slice().sort((a, b) => a.transform[4] - b.transform[4]);
    const avgHeight = rowSorted.reduce((s, it) => s + (it.height || 10), 0) / rowSorted.length || 10;
    const cells = [];
    let cellText = "";
    let prevRight = null;
    rowSorted.forEach((it) => {
      const x = it.transform[4];
      const w = it.width || it.str.length * avgHeight * 0.5;
      if (prevRight === null) {
        cellText = it.str;
      } else {
        const gap = x - prevRight;
        if (gap > avgHeight * 0.7) {
          cells.push(cellText.trim());
          cellText = it.str;
        } else if (gap > avgHeight * 0.12) {
          cellText += " " + it.str;
        } else {
          cellText += it.str;
        }
      }
      prevRight = x + w;
    });
    if (cellText) cells.push(cellText.trim());
    return cells.join("\t");
  });

  return lines.join("\n");
}

async function ocrPdfPage(page, pageNum, totalPages) {
  document.getElementById("fileImportStatus").textContent =
    "PDF scanné détecté — OCR page " + pageNum + "/" + totalPages + "...";
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL("image/png");
  const { data: { text } } = await Tesseract.recognize(dataUrl, "eng+fra");
  return text;
}

async function extractTextFromPDF(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += groupTextItemsToLines(content.items) + "\n";
  }
  if (fullText.trim().length < 20) {
    // Likely a scanned/image PDF with no selectable text layer: fall back to OCR
    fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      fullText += (await ocrPdfPage(page, i, pdf.numPages)) + "\n";
    }
  }
  return fullText;
}

async function extractTextFromDocx(file) {
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
}

function handleImportedText(rawText, fileName) {
  const pairs = parseVocabText(rawText);
  const lineCount = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0).length;
  const defaultName = fileName.replace(/\.[^.]+$/, "");

  // "Confident" = most non-empty lines were successfully split into a pair
  const confident = pairs.length > 0 && lineCount > 0 && pairs.length / lineCount >= 0.7;

  document.getElementById("fileImportStatus").textContent = "";

  if (confident) {
    packs.push({
      id: uid(),
      name: defaultName,
      createdAt: Date.now(),
      words: pairs.map((p) => ({ id: uid(), en: p.en, fr: p.fr })),
    });
    savePacks(packs);
    resetFileImportUI();
    toast('Liste "' + defaultName + '" importée (' + pairs.length + " mots)");
    goTo("screen-packs", true);
    renderPacks();
  } else {
    showReview(pairs);
    document.getElementById("packNameInput").value = defaultName;
    toast(
      pairs.length === 0
        ? "Aucune paire détectée automatiquement, vérifie et complète."
        : "Résultat incertain — vérifie les paires avant d'enregistrer."
    );
  }
}

function resetFileImportUI() {
  document.getElementById("fileImportInput").value = "";
  document.getElementById("analyzeFileBtn").disabled = true;
  document.getElementById("fileImportStatus").textContent = "";
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
  resetFileImportUI();

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

/* ================= SERVICE WORKER + AUTO-UPDATE ================= */
let waitingWorker = null;

function showUpdateBanner(worker) {
  waitingWorker = worker;
  document.getElementById("updateBanner").classList.add("show");
}

document.getElementById("updateBannerBtn").addEventListener("click", () => {
  if (waitingWorker) {
    waitingWorker.postMessage("SKIP_WAITING");
  }
  document.getElementById("updateBanner").classList.remove("show");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => {
        // A worker may already be waiting from a previous visit
        if (reg.waiting) showUpdateBanner(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateBanner(newWorker);
            }
          });
        });
      })
      .catch(() => {});
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
