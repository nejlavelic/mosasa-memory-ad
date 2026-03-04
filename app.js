"use strict";

/* =========================
   DOM
   ========================= */
const boardEl = document.getElementById("board");
const timeEl = document.getElementById("time");
const movesEl = document.getElementById("moves");
const impressionsEl = document.getElementById("impressions");
const clicksEl = document.getElementById("clicks");

const newGameBtn = document.getElementById("newGameBtn");
const showOffersBtn = document.getElementById("showOffersBtn");

const promoBox = document.getElementById("promoBox");
const ctaBtn = document.getElementById("ctaBtn");

/* =========================
   STATE
   ========================= */
let adsData = null;
let deck = [];
let firstPick = null;
let secondPick = null;
let lockBoard = false;

let moves = 0;
let impressions = 0;
let clicks = 0;

let seconds = 0;
let timerId = null;

let currentOffer = null;

/* =========================
   HELPERS
   ========================= */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function updateTimeUI() {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  timeEl.textContent = `${pad2(mm)}:${pad2(ss)}`;
}

function startTimer() {
  stopTimer();
  seconds = 0;
  updateTimeUI();
  timerId = setInterval(() => {
    seconds += 1;
    updateTimeUI();
  }, 1000);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function setMoves(n) {
  moves = n;
  movesEl.textContent = String(moves);
}

function setImpressions(n) {
  impressions = n;
  impressionsEl.textContent = String(impressions);
}

function setClicks(n) {
  clicks = n;
  clicksEl.textContent = String(clicks);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* =========================
   LOAD ADS
   ========================= */
async function loadAds() {
  const res = await fetch("ads.json");
  if (!res.ok) throw new Error("Ne mogu učitati ads.json");
  adsData = await res.json();
}

/* =========================
   GAME SETUP
   ========================= */
function buildDeckFromAds() {
  const items = adsData.items;

  // napravi parove (2x svaki item)
  const pairs = [];
  items.forEach((it) => {
    pairs.push({ ...it, cardId: `${it.id}-a` });
    pairs.push({ ...it, cardId: `${it.id}-b` });
  });

  deck = shuffle(pairs);
}

function resetPromo() {
  promoBox.innerHTML = `<p class="muted">Pogodi par da otključaš promotivnu poruku.</p>`;
  ctaBtn.disabled = true;
  currentOffer = null;
}

function newGame() {
  firstPick = null;
  secondPick = null;
  lockBoard = false;

  setMoves(0);
  resetPromo();

  buildDeckFromAds();
  renderBoard();

  startTimer();
}

/* =========================
   RENDER
   ========================= */
function renderBoard() {
  boardEl.innerHTML = "";
  deck.forEach((card) => {
    const cardEl = document.createElement("button");
    cardEl.className = "card";
    cardEl.type = "button";
    cardEl.setAttribute("aria-label", "Memory karta");
    cardEl.dataset.cardId = String(card.cardId);

    // FIX: dodaj card-inner sloj koji se rotira
    cardEl.innerHTML = `
      <div class="card-inner">
        <div class="face front">
          <img class="card-logo" src="assets/logo/logo.png" alt="MOSASA logo">
        </div>
        <div class="face back">
          <img src="${card.image}" alt="${card.title}">
        </div>
      </div>
    `;

    cardEl.addEventListener("click", () => onCardClick(card.cardId));
    boardEl.appendChild(cardEl);
  });
}

/* =========================
   GAME LOGIC
   ========================= */
function getCardElById(cardId) {
  return boardEl.querySelector(`[data-card-id="${cardId}"]`);
}

function flipCard(cardId, on) {
  const el = getCardElById(cardId);
  if (!el) return;
  if (on) el.classList.add("flipped");
  else el.classList.remove("flipped");
}

function markMatched(cardId) {
  const el = getCardElById(cardId);
  if (!el) return;
  el.classList.add("matched");
}

function isAlreadyOpen(cardId) {
  const el = getCardElById(cardId);
  return el?.classList.contains("flipped") || el?.classList.contains("matched");
}

function findCardByCardId(cardId) {
  return deck.find((c) => c.cardId === cardId);
}

function isPair(c1, c2) {
  return c1 && c2 && c1.id === c2.id;
}

function onCardClick(cardId) {
  if (lockBoard) return;
  if (isAlreadyOpen(cardId)) return;

  flipCard(cardId, true);

  if (!firstPick) {
    firstPick = cardId;
    return;
  }

  secondPick = cardId;
  lockBoard = true;

  setMoves(moves + 1);

  const cardA = findCardByCardId(firstPick);
  const cardB = findCardByCardId(secondPick);

  if (isPair(cardA, cardB)) {
    // matched
    setTimeout(() => {
      markMatched(firstPick);
      markMatched(secondPick);
      lockBoard = false;
      firstPick = null;
      secondPick = null;

      // prikazi promo za taj par
      showOffer(cardA);

      // provjeri win
      checkWin();
    }, 350);
  } else {
    // not matched
    setTimeout(() => {
      flipCard(firstPick, false);
      flipCard(secondPick, false);
      lockBoard = false;
      firstPick = null;
      secondPick = null;
    }, 700);
  }
}

/* =========================
   PROMO
   ========================= */
function showOffer(item) {
  currentOffer = item;
  setImpressions(impressions + 1);

  promoBox.innerHTML = `
    <h3 style="margin:0 0 6px; font-family: Cinzel, serif; color:#b9923c;">${item.title}</h3>
    <p style="margin:0; color:#6b6b6b;">${item.text}</p>
  `;

  ctaBtn.textContent = item.ctaText || "Kontaktiraj MOSASA";
  ctaBtn.disabled = false;
}

function resolveContactLink(key) {
  if (!adsData || !adsData.contacts) return "#";
  return adsData.contacts[key] || "#";
}

ctaBtn.addEventListener("click", () => {
  if (!currentOffer) return;

  const linkKey = currentOffer.ctaLinkKey;
  const url = resolveContactLink(linkKey);

  setClicks(clicks + 1);

  // otvori link
  window.open(url, "_blank", "noopener,noreferrer");
});

showOffersBtn.addEventListener("click", () => {
  // ručno prikaži random ponudu (opcijski)
  const items = adsData.items;
  const randomItem = items[Math.floor(Math.random() * items.length)];
  showOffer(randomItem);
});

/* =========================
   WIN
   ========================= */
function checkWin() {
  const allMatched = Array.from(boardEl.querySelectorAll(".card")).every((c) =>
    c.classList.contains("matched")
  );

  if (allMatched) {
    stopTimer();
    promoBox.innerHTML += `<p style="margin-top:10px; font-weight:700; color:#1f1f1f;">Bravo! Otključala si sve parove 🎉</p>`;
  }
}

/* =========================
   INIT
   ========================= */
newGameBtn.addEventListener("click", () => newGame());

(async function init() {
  try {
    await loadAds();
    resetPromo();
    setMoves(0);
    setImpressions(0);
    setClicks(0);
    newGame();
  } catch (err) {
    console.error(err);
    promoBox.innerHTML = `<p class="muted">Greška: ne mogu učitati ads.json.</p>`;
  }
})();