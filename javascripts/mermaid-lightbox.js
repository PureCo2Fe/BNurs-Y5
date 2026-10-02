/* ==========================================================================
   Mermaid Zoom Lightbox — Windows 11 Fluent style
   Double-click (or hover "⤢ expand" button) on any rendered .mermaid diagram
   to open an acrylic fullscreen overlay with wheel-zoom / drag-pan / reset.
   Vanilla JS, no dependencies. Every code path is wrapped defensively so a
   failure here can never break the host page.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------ helpers */
  function safe(fn) {
    try {
      return fn();
    } catch (err) {
      if (window.console && console.warn) {
        console.warn("[mermaid-lightbox]", err);
      }
      return undefined;
    }
  }

  var MIN_ZOOM = 0.25;
  var MAX_ZOOM = 8;
  var WHEEL_FACTOR = 1.15;
  var FIT_MAX_UPSCALE = 1.5; /* tiny diagrams may be shown up to 1.5x */

  /* mkdocs-material renders each mermaid diagram into a CLOSED shadow root
     (host div.mermaid -> attachShadow({mode:"closed"}) -> svg). Closed roots
     are invisible to querySelector, so capture every shadow root as it is
     created. This patch runs synchronously at parse time, long before the
     theme's async mermaid render, so no root is ever missed. */
  var shadowMap = (function () {
    var map = typeof WeakMap !== "undefined" ? new WeakMap() : null;
    safe(function () {
      if (!map || !window.Element || !Element.prototype.attachShadow) {
        return;
      }
      var original = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (init) {
        var root = original.call(this, init);
        try {
          map.set(this, root);
        } catch (e) {
          /* never break the host page */
        }
        return root;
      };
    });
    return map;
  })();

  /* find the rendered svg for a mermaid host: plain DOM first (covers any
     integration that inlines the svg), then the captured/open shadow root */
  function findSvg(host) {
    return safe(function () {
      var svg = host.querySelector("svg");
      if (svg) {
        return svg;
      }
      var root = (shadowMap && shadowMap.get(host)) || host.shadowRoot;
      if (root) {
        return root.querySelector("svg");
      }
      return null;
    }) || null;
  }

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  /* ------------------------------------------------------- overlay state */
  var overlay = null; /* .mlbx-overlay element        */
  var canvas = null; /* .mlbx-canvas  element        */
  var viewport = null; /* .mlbx-viewport (transformed) */
  var pctLabel = null; /* toolbar percentage readout   */
  var state = {
    open: false,
    scale: 1,
    fitScale: 1,
    tx: 0,
    ty: 0,
    svgW: 0,
    svgH: 0,
    prevBodyOverflow: "",
  };

  /* ---------------------------------------------- natural size of an svg */
  function naturalSize(svg) {
    return safe(function () {
      var vb = svg.viewBox && svg.viewBox.baseVal;
      if (vb && vb.width > 0 && vb.height > 0) {
        return { w: vb.width, h: vb.height };
      }
      var vbAttr = svg.getAttribute("viewBox");
      if (vbAttr) {
        var p = vbAttr.trim().split(/[\s,]+/).map(Number);
        if (p.length === 4 && p[2] > 0 && p[3] > 0) {
          return { w: p[2], h: p[3] };
        }
      }
      var w = parseFloat(svg.getAttribute("width"));
      var h = parseFloat(svg.getAttribute("height"));
      if (w > 0 && h > 0) {
        return { w: w, h: h };
      }
      var r = svg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return { w: r.width, h: r.height };
      }
      return { w: 800, h: 600 };
    }) || { w: 800, h: 600 };
  }

  /* -------------------------------------------------------- apply matrix */
  function applyTransform() {
    safe(function () {
      viewport.style.transform =
        "translate(" + state.tx + "px," + state.ty + "px) scale(" + state.scale + ")";
      var pct = Math.round((state.scale / state.fitScale) * 100);
      pctLabel.textContent = pct + "%";
    });
  }

  function fitToCanvas() {
    safe(function () {
      var cw = canvas.clientWidth;
      var ch = canvas.clientHeight;
      if (!cw || !ch || !state.svgW || !state.svgH) {
        return;
      }
      var s = Math.min(cw / state.svgW, ch / state.svgH);
      s = Math.min(s, FIT_MAX_UPSCALE);
      s = clamp(s, MIN_ZOOM, MAX_ZOOM);
      state.fitScale = s;
      state.scale = s;
      state.tx = (cw - state.svgW * s) / 2;
      state.ty = (ch - state.svgH * s) / 2;
      applyTransform();
    });
  }

  /* zoom keeping the canvas-space point (cx, cy) visually fixed */
  function zoomAt(cx, cy, factor) {
    safe(function () {
      var next = clamp(state.scale * factor, MIN_ZOOM, MAX_ZOOM);
      if (next === state.scale) {
        return;
      }
      var ratio = next / state.scale;
      state.tx = cx - ratio * (cx - state.tx);
      state.ty = cy - ratio * (cy - state.ty);
      state.scale = next;
      applyTransform();
    });
  }

  function canvasPoint(evt) {
    var r = canvas.getBoundingClientRect();
    return { x: evt.clientX - r.left, y: evt.clientY - r.top };
  }

  /* -------------------------------------------------------- build overlay */
  function makeButton(cls, label, title) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "mlbx-tbtn " + cls;
    b.textContent = label;
    b.title = title;
    return b;
  }

  function ensureOverlay() {
    return safe(function () {
      if (overlay) {
        return true;
      }

      overlay = document.createElement("div");
      overlay.className = "mlbx-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-label", "Mermaid diagram zoom view");

      canvas = document.createElement("div");
      canvas.className = "mlbx-canvas";

      viewport = document.createElement("div");
      viewport.className = "mlbx-viewport";
      canvas.appendChild(viewport);

      var toolbar = document.createElement("div");
      toolbar.className = "mlbx-toolbar";

      var btnOut = makeButton("mlbx-zoom-out", "−", "Zoom out");
      pctLabel = document.createElement("span");
      pctLabel.className = "mlbx-pct";
      pctLabel.textContent = "100%";
      var btnIn = makeButton("mlbx-zoom-in", "＋", "Zoom in");
      var btnReset = makeButton("mlbx-reset", "⤾ reset", "Reset to fit");
      var btnClose = makeButton("mlbx-close", "✕", "Close (Esc)");

      toolbar.appendChild(btnOut);
      toolbar.appendChild(pctLabel);
      toolbar.appendChild(btnIn);
      toolbar.appendChild(btnReset);
      toolbar.appendChild(btnClose);

      overlay.appendChild(canvas);
      overlay.appendChild(toolbar);
      document.body.appendChild(overlay);

      /* --- toolbar actions --- */
      btnIn.addEventListener("click", function () {
        safe(function () {
          zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, WHEEL_FACTOR * WHEEL_FACTOR);
        });
      });
      btnOut.addEventListener("click", function () {
        safe(function () {
          zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1 / (WHEEL_FACTOR * WHEEL_FACTOR));
        });
      });
      btnReset.addEventListener("click", function () {
        safe(fitToCanvas);
      });
      btnClose.addEventListener("click", function () {
        safe(closeOverlay);
      });

      /* --- wheel zoom centered on cursor --- */
      canvas.addEventListener(
        "wheel",
        function (e) {
          safe(function () {
            e.preventDefault();
            var p = canvasPoint(e);
            zoomAt(p.x, p.y, e.deltaY < 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR);
          });
        },
        { passive: false }
      );

      /* --- drag to pan --- */
      var dragging = false;
      var lastX = 0;
      var lastY = 0;
      canvas.addEventListener("pointerdown", function (e) {
        safe(function () {
          if (e.button !== 0) {
            return;
          }
          dragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          canvas.classList.add("mlbx-grabbing");
          if (canvas.setPointerCapture) {
            canvas.setPointerCapture(e.pointerId);
          }
          e.preventDefault();
        });
      });
      canvas.addEventListener("pointermove", function (e) {
        safe(function () {
          if (!dragging) {
            return;
          }
          state.tx += e.clientX - lastX;
          state.ty += e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;
          applyTransform();
        });
      });
      function endDrag() {
        safe(function () {
          dragging = false;
          canvas.classList.remove("mlbx-grabbing");
        });
      }
      canvas.addEventListener("pointerup", endDrag);
      canvas.addEventListener("pointercancel", endDrag);

      /* --- close gestures --- */
      overlay.addEventListener("click", function (e) {
        safe(function () {
          if (e.target === overlay) {
            closeOverlay();
          }
        });
      });
      canvas.addEventListener("dblclick", function (e) {
        safe(function () {
          if (e.target === canvas) {
            closeOverlay();
          }
        });
      });
      document.addEventListener("keydown", function (e) {
        safe(function () {
          if (state.open && e.key === "Escape") {
            closeOverlay();
          }
        });
      });

      window.addEventListener("resize", function () {
        safe(function () {
          if (state.open) {
            fitToCanvas();
          }
        });
      });

      return true;
    }) === true;
  }

  /* ------------------------------------------------------------ open/close */
  function openOverlay(diagramHost) {
    safe(function () {
      if (state.open) {
        return; /* already open — do not clobber prevBodyOverflow */
      }
      var svg = findSvg(diagramHost);
      if (!svg) {
        return;
      }
      if (!ensureOverlay()) {
        return;
      }

      var size = naturalSize(svg);
      state.svgW = size.w;
      state.svgH = size.h;

      var clone = svg.cloneNode(true);
      clone.removeAttribute("width");
      clone.removeAttribute("height");
      if (!clone.getAttribute("viewBox")) {
        clone.setAttribute("viewBox", "0 0 " + size.w + " " + size.h);
      }
      clone.style.width = size.w + "px";
      clone.style.height = size.h + "px";
      clone.style.maxWidth = "none";
      clone.style.maxHeight = "none";

      viewport.innerHTML = "";
      viewport.style.width = size.w + "px";
      viewport.style.height = size.h + "px";
      viewport.appendChild(clone);

      state.prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      overlay.classList.add("mlbx-open");
      state.open = true;

      /* fit synchronously: overlay is displayed now, and reading clientWidth
         forces layout, so measurements are real. No rAF race with early
         programmatic wheel/keyboard zoom. */
      fitToCanvas();
    });
  }

  function closeOverlay() {
    safe(function () {
      if (!state.open) {
        return;
      }
      state.open = false;
      overlay.classList.remove("mlbx-open");
      document.body.style.overflow = state.prevBodyOverflow || "";
      viewport.innerHTML = "";
    });
  }

  /* ------------------------------------------------- enhance each diagram */
  function enhance(host) {
    safe(function () {
      if (!host || host.getAttribute("data-mlbx") === "1") {
        return;
      }
      if (!findSvg(host)) {
        return; /* mermaid has not rendered into it yet */
      }
      host.setAttribute("data-mlbx", "1");
      host.classList.add("mlbx-host");
      host.setAttribute("title", "Double-click to zoom");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mlbx-expand-btn";
      btn.textContent = "⤢ expand";
      btn.title = "Open zoom view";
      btn.addEventListener("click", function (e) {
        safe(function () {
          e.preventDefault();
          e.stopPropagation();
          openOverlay(host);
        });
      });
      host.appendChild(btn);

      host.addEventListener("dblclick", function (e) {
        safe(function () {
          e.preventDefault();
          openOverlay(host);
        });
      });
    });
  }

  function scan(root) {
    safe(function () {
      var hosts = (root || document).querySelectorAll(".mermaid");
      for (var i = 0; i < hosts.length; i++) {
        enhance(hosts[i]);
      }
    });
  }

  /* -------------------------------------------------- observe async render */
  function start() {
    safe(function () {
      scan(document);

      if (!window.MutationObserver) {
        /* fallback: poll a few times for late renders */
        var tries = 0;
        var timer = window.setInterval(function () {
          safe(function () {
            scan(document);
            tries += 1;
            if (tries > 20) {
              window.clearInterval(timer);
            }
          });
        }, 500);
        return;
      }

      var observer = new MutationObserver(function (mutations) {
        safe(function () {
          var needScan = false;
          for (var i = 0; i < mutations.length; i++) {
            var m = mutations[i];
            for (var j = 0; j < m.addedNodes.length; j++) {
              var n = m.addedNodes[j];
              if (n.nodeType !== 1) {
                continue;
              }
              if (
                n.classList && n.classList.contains("mermaid") ||
                n.tagName === "svg" ||
                (n.querySelector && (n.querySelector("svg") || n.querySelector(".mermaid")))
              ) {
                needScan = true;
                break;
              }
            }
            if (needScan) {
              break;
            }
          }
          if (needScan) {
            scan(document);
          }
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      safe(start);
    });
  } else {
    safe(start);
  }
})();
