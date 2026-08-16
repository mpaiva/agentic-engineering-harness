(function () {
  "use strict";

  function decodeCommand(raw) {
    // data-command attributes store literal newlines as &#10; entity via HTML parsing,
    // the DOM already gives us the decoded string, so just normalize here.
    return raw;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for environments without the async clipboard API.
    return new Promise(function (resolve, reject) {
      try {
        var textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  function onCopyClick(event) {
    var button = event.currentTarget;
    var command = decodeCommand(button.getAttribute("data-command") || "");
    copyText(command)
      .then(function () {
        var original = button.textContent;
        button.textContent = "Copied";
        button.classList.add("copied");
        window.setTimeout(function () {
          button.textContent = original;
          button.classList.remove("copied");
        }, 1500);
      })
      .catch(function () {
        button.textContent = "Copy failed";
        window.setTimeout(function () {
          button.textContent = "Copy";
        }, 1500);
      });
  }

  var THEME_KEY = "theme";
  var ICON_LIGHT = "\u2600\uFE0F"; // sun
  var ICON_DARK = "\u263E"; // moon

  function getStoredTheme() {
    try {
      var value = localStorage.getItem(THEME_KEY);
      return value === "dark" || value === "light" ? value : null;
    } catch (e) {
      return null;
    }
  }

  function systemPrefersDark() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }

  function effectiveTheme() {
    return getStoredTheme() || (systemPrefersDark() ? "dark" : "light");
  }

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute("data-theme", theme);
    var button = document.getElementById("theme-toggle");
    if (button) {
      var isDark = theme === "dark";
      button.setAttribute("aria-pressed", isDark ? "true" : "false");
      var icon = button.querySelector(".theme-toggle-icon");
      var label = button.querySelector(".theme-toggle-label");
      if (icon) {
        icon.textContent = isDark ? ICON_DARK : ICON_LIGHT;
      }
      if (label) {
        label.textContent = isDark ? "Dark" : "Light";
      }
    }
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {
        // localStorage unavailable (e.g. private browsing) — theme still
        // applies for this page view, persistence silently no-ops.
      }
    }
  }

  function onThemeToggleClick() {
    var current =
      document.documentElement.getAttribute("data-theme") || effectiveTheme();
    var next = current === "dark" ? "light" : "dark";
    applyTheme(next, true);
  }

  function initTheme() {
    applyTheme(effectiveTheme(), false);
    var button = document.getElementById("theme-toggle");
    if (button) {
      button.addEventListener("click", onThemeToggleClick);
    }
  }
  function setActiveTocLink(links, stepId) {
    links.forEach(function (link) {
      var isActive = link.getAttribute("href") === "#" + stepId;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function initToc() {
    var links = Array.prototype.slice.call(
      document.querySelectorAll(".toc-link")
    );
    var steps = Array.prototype.slice.call(
      document.querySelectorAll("li.step")
    );
    if (!links.length || !steps.length) {
      return;
    }

    // Step 1 is active by default, before any scroll or observer callback.
    setActiveTocLink(links, "step-1");

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              setActiveTocLink(links, entry.target.id);
            }
          });
        },
        { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
      );
      steps.forEach(function (step) {
        observer.observe(step);
      });
    }

    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        var targetId = link.getAttribute("href").slice(1);
        var targetEl = document.getElementById(targetId);
        if (!targetEl) {
          return;
        }
        event.preventDefault();
        var prefersReduced =
          window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        targetEl.scrollIntoView({
          behavior: prefersReduced ? "auto" : "smooth",
          block: "start",
        });
        if (window.history && window.history.pushState) {
          window.history.pushState(null, "", "#" + targetId);
        }
      });
    });
  }

  function init() {
    var buttons = document.querySelectorAll(".copy-btn");
    buttons.forEach(function (button) {
      button.addEventListener("click", onCopyClick);
    });
    initTheme();
    initToc();
    var printBtn = document.getElementById("print-btn");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        window.print();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
