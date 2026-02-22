"use strict";

/**
 * MOSASA Memory Ad (4x4)
 * - 16 kartica = 8 parova
 * - nakon pogođenog para: prikaži promo (impresija++)
 * - CTA klik: clicks++
 */

const boardEl = document.getElementById("board");
const timeEl = document.getElementById("time");
const movesEl = document.getElementById("moves");
const impressionsEl = document.getElementById("impressions");
const clicksEl = document.getElementById("clicks");

const newGameBtn = document.getElementById("newGameBtn");
const showEndAdBtn = document.getElementById("showEndAdBtn");

const adBodyEl = document.getElementById("adBody");
const ctaBtn = document.getElementById("ctaBtn");
const ctaInfo = document.getElementById("ctaInfo");
const toastEl = document.getElementById("toast");

let adsData = null;
let deck = [];
let firstPick = null;
let secondPick = null;
let lockBoard = false;

let moves = 0;
let matchedPairs = 0;

let impressions = 0;
let clicks = 0;

let timerId = null;
let seconds = 0;

let currentCtaUrl = null;

// ---------- Helpers ----------
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 1400);
}

function formatTime(totalSeconds) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function startTimer() {
  stopTimer();
  seconds = 0;
  timeEl.textContent = formatTime(seconds);
  timerId = setInterval(() => {
    seconds++;
    timeEl.textContent = formatTime(seconds);
  }, 1000);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function shuffle(array) {
  // Fisher-Yates
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ---------- Ads / CTA ----------
function resolveContactUrl(key) {
  if (!adsData?.contacts) return null;
  const value = adsData.contacts[key];
  if (!value) return null;

  // phone -> tel link
  if (key === "phone") {
    const digits = String(value).replace(/\s+/g, "");
    return `tel:${digits}`;
  }
  return value;
}

function showAd(item, reason = "pair") {
  if (!item) return;

  // impresion = prikaz reklame
  impressions++;
  impressionsEl.textContent = String(impressions);

  const imgHtml = item.image
    ? `<img class="adimg" src="${item.image}" alt="${item.title}" onerror="this.style.display='none'">`
    : "";

  adBodyEl.innerHTML = `
    <h3 class="adcard-title">${item.title}</h3>
    <p class="adcard-text">${item.text}</p>
    ${imgHtml}
    <p class="small muted">Prikaz: ${reason === "pair" ? "pogođen par" : "kraj igre"}</p>
  `;

  // CTA
  const url = resolveContactUrl(item.ctaLinkKey);
  currentCtaUrl = url;

  ctaBtn.textContent = item.ctaText || "Kontaktiraj MOSASA";
  ctaBtn.disabled = !url;

  ctaInfo.textContent = url
    ? "Klik na CTA se evidentira kao klik u statistici."
    : "Nema definisanog linka (provjeri ads.json).";
}

// ---------- Game ----------
function buildDeckFromAds() {
  // Uzimamo tačno 8 itema (za 8 parova)
  const items = adsData.items.slice(0, 8);

  // Svaki item postaje par (2 kartice)
  const base = items.map((item) => ({
    pairId: item.id,
    title: item.title,
    image: item.image,
    adItem: item
  }));

  deck = shuffle([...base, ...base].map((c, idx) => ({ ...c, cardId: idx })));
}

function renderBoard() {
  boardEl.innerHTML = "";
  deck.forEach((card) => {
    const cardEl = document.createElement("button");
    cardEl.className = "card";
    cardEl.type = "button";
    cardEl.setAttribute("aria-label", "Memory karta");
    cardEl.dataset.cardId = String(card.cardId);

    cardEl.innerHTML = `
      <div class="face front">
        <div class="mark">MOSASA</div>
      </div>
      <div class="face back">
        <img src="${card.image}" alt="${card.title}" onerror="this.style.display='none'">
      </div>
    `;

    cardEl.addEventListener("click", () => onCardClick(card.cardId));
    boardEl.appendChild(cardEl);
  });
}

function getCardEl(cardId) {
  return boardEl.querySelector(`.card[data-card-id="${cardId}"]`);
}

function resetGameState() {
  firstPick = null;
  secondPick = null;
  lockBoard = false;

  moves = 0;
  matchedPairs = 0;
  movesEl.textContent = "0";

  impressions = 0;
  clicks = 0;
  impressionsEl.textContent = "0";
  clicksEl.textContent = "0";

  adBodyEl.innerHTML = `<p class="muted">Pogodi par da otključaš promotivnu poruku.</p>`;
  ctaBtn.textContent = "Kontaktiraj MOSASA";
  ctaBtn.disabled = true;
  ctaInfo.textContent = "CTA će biti aktivan kada se prikaže reklama.";
  currentCtaUrl = null;

  showEndAdBtn.disabled = true;
}

function onCardClick(cardId) {
  if (lockBoard) return;

  const card = deck.find((c) => c.cardId === cardId);
  const cardEl = getCardEl(cardId);
  if (!card || !cardEl) return;

  // ne dozvoli klik na već pogođenu ili već okrenutu
  if (cardEl.classList.contains("matched") || cardEl.classList.contains("flipped")) return;

  // prvi potez -> start timer
  if (!timerId) startTimer();

  cardEl.classList.add("flipped");

  if (!firstPick) {
    firstPick = card;
    return;
  }

  secondPick = card;
  moves++;
  movesEl.textContent = String(moves);

  checkMatch();
}

function checkMatch() {
  if (!firstPick || !secondPick) return;

  lockBoard = true;

  const isMatch = firstPick.pairId === secondPick.pairId;

  if (isMatch) {
    // označi kao matched
    const a = getCardEl(firstPick.cardId);
    const b = getCardEl(secondPick.cardId);
    a?.classList.add("matched");
    b?.classList.add("matched");

    matchedPairs++;
    toast("Pogođen par! 🎯");

    // prikaži reklamu za taj par
    showAd(firstPick.adItem, "pair");

    // omogućimo dugme za “ponudu” nakon bar jednog para
    showEndAdBtn.disabled = false;

    resetPicks();

    if (matchedPairs === 8) onWin();
    return;
  }

  // nije par -> vrati nazad nakon kratkog delay-a
  setTimeout(() => {
    getCardEl(firstPick.cardId)?.classList.remove("flipped");
    getCardEl(secondPick.cardId)?.classList.remove("flipped");
    resetPicks();
  }, 700);
}

function resetPicks() {
  firstPick = null;
  secondPick = null;
  lockBoard = false;
}

function onWin() {
  stopTimer();
  toast("Bravo! Završena igra 🏁");

  // prikaži “finalnu ponudu” (random item)
  const randomItem = adsData.items[Math.floor(Math.random() * adsData.items.length)];
  showAd(randomItem, "kraj igre");
}

// ---------- Init ----------
async function loadAds() {
  const res = await fetch("ads.json");
  if (!res.ok) throw new Error("Ne mogu učitati ads.json");
  return await res.json();
}

async function newGame() {
  if (!adsData) {
    adsData = await loadAds();
  }

  resetGameState();
  stopTimer();
  timeEl.textContent = "00:00";

  buildDeckFromAds();
  renderBoard();
}

newGameBtn.addEventListener("click", () => newGame());

showEndAdBtn.addEventListener("click", () => {
  const randomItem = adsData.items[Math.floor(Math.random() * adsData.items.length)];
  showAd(randomItem, "kraj igre");
});

ctaBtn.addEventListener("click", () => {
  if (!currentCtaUrl) return;

  clicks++;
  clicksEl.textContent = String(clicks);

  // otvori link u novom tabu (tel: radi na mobitelu)
  window.open(currentCtaUrl, "_blank", "noopener,noreferrer");
});

newGame().catch((err) => {
  console.error(err);
  toast("Greška: provjeri ads.json ili putanje slika.");
});