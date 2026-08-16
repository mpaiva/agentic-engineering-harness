(function () {
  "use strict";

  var glyph = document.getElementById("hero-glyph");
  var caption = document.getElementById("hero-caption");
  var live = document.getElementById("hero-live");
  var buttons = document.querySelectorAll(".picker-btn");

  var currentEmoji = null;

  function selectEmoji(emoji, name, btn) {
    if (emoji === currentEmoji) {
      // Same already-hero emoji: no-op, no re-trigger.
      return;
    }
    currentEmoji = emoji;

    if (caption) {
      caption.remove();
      caption = null;
    }

    glyph.classList.remove("placeholder", "enter", "idle");
    glyph.removeAttribute("aria-hidden");
    glyph.textContent = emoji;

    // Force reflow so the browser re-triggers the animation on class re-add.
    void glyph.offsetWidth;

    glyph.classList.add("idle");

    live.textContent = "Now showing: " + name;

    buttons.forEach(function (b) {
      b.classList.toggle("selected", b === btn);
    });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectEmoji(btn.dataset.emoji, btn.getAttribute("aria-label"), btn);
    });
  });
})();
