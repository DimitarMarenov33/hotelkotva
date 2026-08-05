/* ==========================================================================
   KOTVA main.js — header behaviour, mobile nav, reveal-on-scroll,
   video lazy-loading / autoplay-on-view, mobile bottom CTA bar,
   FAQ plus/times toggle icon state.

   Unlike the dark Opal build, this header is light by default and only goes
   transparent while it sits over a hero video, so `is-transparent` is driven
   by the hero's height rather than a fixed 40px scroll threshold.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Data saver / very slow connection: this page carries ~40 short clips, so
     honour the browser's hint and show posters only. Posters are WebP and load
     regardless, so the page still looks complete — it just costs kilobytes
     instead of megabytes. Treated exactly like reduced motion below. */
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var lowData = !!(conn && (conn.saveData === true ||
    /^(slow-)?2g$/.test(conn.effectiveType || "")));
  var posterOnly = reduceMotion || lowData;

  /* ---------- Header: transparent over the hero, solid once past it ---------- */
  var header = document.querySelector(".site-header");
  var hero = document.querySelector(".hero");
  if (header) {
    var onScrollHeader = function () {
      /* Flip a little before the hero fully leaves, so the white bar never
         appears over the bright end of the footage. */
      var limit = hero ? hero.offsetHeight - header.offsetHeight - 20 : 40;
      header.classList.toggle("is-transparent", !!hero && window.scrollY < limit);
    };
    onScrollHeader();
    window.addEventListener("scroll", onScrollHeader, { passive: true });
    window.addEventListener("resize", onScrollHeader, { passive: true });
  }

  /* ---------- Mobile hamburger menu ---------- */
  var navToggle = document.querySelector(".nav-toggle");
  var mobileMenu = document.querySelector(".mobile-menu");
  if (navToggle && mobileMenu) {
    var setMenu = function (open) {
      mobileMenu.classList.toggle("is-open", open);
      mobileMenu.setAttribute("aria-hidden", open ? "false" : "true");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("menu-open", open);
    };
    navToggle.addEventListener("click", function () {
      setMenu(!mobileMenu.classList.contains("is-open"));
    });
    mobileMenu.querySelectorAll("a, button").forEach(function (el) {
      el.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileMenu.classList.contains("is-open")) setMenu(false);
    });
  }

  /* ---------- Mobile bottom CTA bar (after the hero widget scrolls past) ---------- */
  var bottomBar = document.querySelector(".mobile-cta-bar");
  var heroWidget = document.querySelector('.booking-widget[data-widget="hero"]');
  if (bottomBar && heroWidget && "IntersectionObserver" in window) {
    var barObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        bottomBar.classList.toggle("is-visible",
          !entry.isIntersecting && entry.boundingClientRect.top < 0);
      });
    }, { threshold: 0 });
    barObserver.observe(heroWidget);
  } else if (bottomBar && !heroWidget) {
    /* Pages with no hero widget (e.g. the aquapark page) show it right away. */
    bottomBar.classList.add("is-visible");
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  /* Stagger siblings inside a .reveal-stagger group. */
  document.querySelectorAll(".reveal-stagger").forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.style.setProperty("--stagger-i", i);
    });
  });

  /* ---------- Reduced motion: hero video falls back to its poster ---------- */
  var heroVideo = document.querySelector(".hero-video-wrap video");
  if (posterOnly && heroVideo) {
    heroVideo.pause();
    heroVideo.removeAttribute("autoplay");
    heroVideo.classList.add("reduced-motion-poster");
  }

  /* ---------- Lazy video loading + play-in-view ---------- */
  /* Promote data-poster to a real poster. Held back until the tile is near
     the viewport, because a poster attribute downloads on layout, not on view. */
  function showPoster(video) {
    if (!video.poster && video.dataset.poster) video.poster = video.dataset.poster;
  }

  var lazyVideos = document.querySelectorAll("video[data-src]");
  if (posterOnly) {
    /* Poster-only mode still needs the stills — they ARE the content here. */
    lazyVideos.forEach(function (video) {
      showPoster(video);
      video.removeAttribute("autoplay");
      video.classList.add("reduced-motion-poster");
    });
  } else if ("IntersectionObserver" in window) {
    var videoObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        if (entry.isIntersecting) {
          showPoster(video);
          if (!video.src && video.dataset.src) {
            var srcEl = video.querySelector("source");
            if (srcEl) {
              srcEl.src = video.dataset.src;
            } else {
              video.src = video.dataset.src;
            }
            video.load();
          }
          var playPromise = video.play();
          if (playPromise && playPromise.catch) playPromise.catch(function () {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.25, rootMargin: "400px 0px" });
    lazyVideos.forEach(function (video) { videoObserver.observe(video); });
  } else {
    lazyVideos.forEach(showPoster);
  }

  /* ---------- FAQ plus/times icon state ---------- */
  document.querySelectorAll(".faq-list details").forEach(function (details) {
    details.addEventListener("toggle", function () {
      var icon = details.querySelector(".faq-icon");
      if (icon) icon.textContent = details.open ? "×" : "+";
    });
  });

  /* ---------- Language selector: remember the explicit choice, navigate ---------- */
  document.querySelectorAll(".lang-select").forEach(function (sel) {
    sel.addEventListener("change", function () {
      var opt = sel.options[sel.selectedIndex];
      try { localStorage.setItem("kotva-lang", opt.getAttribute("data-code")); } catch (e) {}
      /* Keep query + hash so e.g. ?payment=cancelled survives the switch. */
      window.location.href = opt.value + window.location.search + window.location.hash;
    });
  });

  /* ---------- Smooth-scroll for in-page anchors ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href").slice(1);
      if (!id) return;
      var target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
    });
  });

  /* ---------- "Check prices & book" buttons jump to the nearest widget ---------- */
  document.querySelectorAll("[data-scroll-to-widget]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var widget = document.querySelector(".booking-widget");
      if (!widget) return;
      widget.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      var field = widget.querySelector('input[name="checkin"]');
      if (field) setTimeout(function () { field.focus({ preventScroll: true }); }, 500);
    });
  });
})();
