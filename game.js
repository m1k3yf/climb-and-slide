function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// === board.jsx ===
// Board data + rendering

// Chutes (snakes): start (high) -> end (low)  with color palette per snake
// Ladders: start (low) -> end (high)  with color palette per ladder
const CHUTES_LIST = [{
  from: 98,
  to: 78,
  color: '#1ac0c6'
},
// turquoise
{
  from: 93,
  to: 73,
  color: '#ffc93d'
},
// sunshine yellow
{
  from: 87,
  to: 24,
  color: '#ff7a3d',
  spiral: true
},
// coral orange — spiral tube slide
{
  from: 64,
  to: 60,
  color: '#7ed957'
},
// lime green
{
  from: 62,
  to: 19,
  color: '#3da0ff'
},
// sky blue
{
  from: 56,
  to: 53,
  color: '#c77dff'
},
// lavender
{
  from: 49,
  to: 11,
  color: '#9b5cff',
  portal: true
},
// random-transport PORTAL
{
  from: 47,
  to: 26,
  color: '#ff4d6d'
},
// watermelon
{
  from: 16,
  to: 6,
  color: '#f7a824'
} // mango
];
const CHUTES = Object.fromEntries(CHUTES_LIST.map(c => [c.from, c.to]));
const PORTAL_SQUARES = new Set(CHUTES_LIST.filter(c => c.portal).map(c => c.from));

// ==== Spiral slide geometry ====
// The big spiral (87→24) is drawn as a series of alternating front/back arches that
// together form a coiled tube. We extract the geometry so both the renderer AND the
// token-slide animation use the same path.
const SPIRAL_NUM_LOOPS = 4; // fewer, bigger loops = more 3D pop
const SPIRAL_ARCH_R = 7.2; // perpendicular amplitude of each arch
const SPIRAL_TUBE_W = 3.6; // tube stroke width

function computeSpiralGeometry(fromSq, toSq) {
  const ax = (fromSq - 1) % 10;
  const ay = Math.floor((fromSq - 1) / 10);
  void ax;
  void ay; // keep linter quiet — actual position math uses squareToPct below
  const a = function sqToPct(sq) {
    const row = Math.floor((sq - 1) / 10);
    const inRow = (sq - 1) % 10;
    const col = row % 2 === 0 ? inRow : 9 - inRow;
    return {
      x: (col + 0.5) * 10,
      y: 100 - (row + 0.5) * 10
    };
  }(fromSq);
  const b = function sqToPct(sq) {
    const row = Math.floor((sq - 1) / 10);
    const inRow = (sq - 1) % 10;
    const col = row % 2 === 0 ? inRow : 9 - inRow;
    return {
      x: (col + 0.5) * 10,
      y: 100 - (row + 0.5) * 10
    };
  }(toSq);
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nxAx = -dy / len,
    nyAx = dx / len;
  const segs = SPIRAL_NUM_LOOPS * 2;
  const boundaries = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    boundaries.push({
      x: a.x + dx * t,
      y: a.y + dy * t
    });
  }
  const arches = [];
  for (let i = 0; i < segs; i++) {
    const s = boundaries[i];
    const e = boundaries[i + 1];
    const isFront = i % 2 === 0;
    const sign = isFront ? -1 : 1;
    const midAxisX = (s.x + e.x) / 2;
    const midAxisY = (s.y + e.y) / 2;
    const ctrlX = midAxisX + sign * nxAx * SPIRAL_ARCH_R;
    const ctrlY = midAxisY + sign * nyAx * SPIRAL_ARCH_R;
    arches.push({
      s,
      e,
      ctrl: {
        x: ctrlX,
        y: ctrlY
      },
      isFront
    });
  }
  return {
    a,
    b,
    boundaries,
    arches
  };
}

// Sample N points along one quadratic bezier arch
function sampleQuad(s, ctrl, e, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const mt = 1 - t;
    out.push({
      x: mt * mt * s.x + 2 * mt * t * ctrl.x + t * t * e.x,
      y: mt * mt * s.y + 2 * mt * t * ctrl.y + t * t * e.y
    });
  }
  return out;
}

// Flatten the entire spiral path into a dense sequence of {x,y} points (in board % coords).
function sampleSpiralPath(fromSq, toSq, samplesPerArch = 28) {
  const {
    arches
  } = computeSpiralGeometry(fromSq, toSq);
  const pts = [];
  for (const ar of arches) pts.push(...sampleQuad(ar.s, ar.ctrl, ar.e, samplesPerArch));
  const last = arches[arches.length - 1].e;
  pts.push({
    x: last.x,
    y: last.y
  });
  return pts;
}
const LADDERS_LIST = [{
  from: 4,
  to: 14,
  color: '#e8b23e'
},
// gold
{
  from: 9,
  to: 31,
  color: '#e8583e'
},
// red
{
  from: 20,
  to: 38,
  color: '#4a9e5c'
},
// green
{
  from: 28,
  to: 84,
  color: '#3a7ac4'
},
// blue
{
  from: 40,
  to: 59,
  color: '#c44a78'
},
// pink
{
  from: 51,
  to: 67,
  color: '#8f5ac9'
},
// purple
{
  from: 63,
  to: 81,
  color: '#e88c3e'
},
// orange
{
  from: 71,
  to: 91,
  color: '#2f8f82'
} // teal
];
const LADDERS = Object.fromEntries(LADDERS_LIST.map(l => [l.from, l.to]));

// convert 1..100 to (row, col) in boustrophedon, row 0 = bottom
function squareToRC(sq) {
  const row = Math.floor((sq - 1) / 10);
  const inRow = (sq - 1) % 10;
  const col = row % 2 === 0 ? inRow : 9 - inRow;
  return {
    row,
    col
  };
}

// Returns {x,y} center in % (0..100) with row 0 at bottom
function squareToPct(sq) {
  const {
    row,
    col
  } = squareToRC(sq);
  const x = (col + 0.5) * 10;
  const y = 100 - (row + 0.5) * 10;
  return {
    x,
    y
  };
}
function Board({
  players,
  currentPlayerIdx,
  tokenPositions,
  highlightedSquare,
  tweaks = {},
  phase = 'waiting',
  tokenOverride = null
}) {
  const showHintArrows = tweaks.showHintArrows !== false;
  const showGlidePath = tweaks.showGlidePath !== false;
  const boardScale = tweaks.boardScale ?? 1;
  const boardBgMode = tweaks.boardBgMode ?? 'dark';
  const themeVars = boardBgMode === 'light' ? {
    '--board-bg': '#e6dbbd'
  } : boardBgMode === 'cream' ? {
    '--board-bg': '#f4ecd8'
  } : {
    '--board-bg': '#1a1f2e'
  };
  const squares = [];
  for (let row = 9; row >= 0; row--) {
    const nums = [];
    for (let c = 0; c < 10; c++) {
      const col = row % 2 === 0 ? c : 9 - c;
      nums.push(row * 10 + col + 1);
    }
    squares.push(nums);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "board-wrap",
    style: {
      ...themeVars,
      transform: `scale(${boardScale})`,
      transformOrigin: 'center top'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "board"
  }, /*#__PURE__*/React.createElement("div", {
    className: "board-grid"
  }, squares.map((rowNums, rIdx) => rowNums.map((n, cIdx) => {
    const isDark = (rIdx + cIdx) % 2 === 0;
    const isStart = n === 1;
    const isEnd = n === 100;
    const isChute = n in CHUTES;
    const isLadder = n in LADDERS;
    const isPortal = PORTAL_SQUARES.has(n);
    const isHighlight = highlightedSquare === n;
    return /*#__PURE__*/React.createElement("div", {
      key: n,
      className: `sq ${isDark ? 'dark' : 'light'} ${isHighlight ? 'hl' : ''}`,
      style: {
        gridRow: rIdx + 1,
        gridColumn: cIdx + 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "sq-num mono"
    }, n), isStart && /*#__PURE__*/React.createElement("span", {
      className: "sq-tag"
    }, "START"), isEnd && /*#__PURE__*/React.createElement("span", {
      className: "sq-tag gold"
    }, "FINISH"), isChute && !isPortal && showHintArrows && /*#__PURE__*/React.createElement("span", {
      className: "sq-dot chute",
      title: `Chute to ${CHUTES[n]}`
    }, "\u25BE"), isPortal && showHintArrows && /*#__PURE__*/React.createElement("span", {
      className: "sq-dot portal",
      title: "Random transport portal"
    }, "\u2726"), isLadder && showHintArrows && /*#__PURE__*/React.createElement("span", {
      className: "sq-dot ladder",
      title: `Ladder to ${LADDERS[n]}`
    }, "\u25B4"));
  }))), /*#__PURE__*/React.createElement("svg", {
    className: "board-svg",
    viewBox: "0 0 100 100",
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("filter", {
    id: "castShadowSoft",
    x: "-50%",
    y: "-50%",
    width: "200%",
    height: "200%"
  }, /*#__PURE__*/React.createElement("feGaussianBlur", {
    stdDeviation: "1.8"
  })), /*#__PURE__*/React.createElement("filter", {
    id: "castShadowHeavy",
    x: "-50%",
    y: "-50%",
    width: "200%",
    height: "200%"
  }, /*#__PURE__*/React.createElement("feGaussianBlur", {
    stdDeviation: "2.4"
  }))), LADDERS_LIST.map(({
    from,
    to,
    color
  }) => {
    const a = squareToPct(+from);
    const b = squareToPct(+to);
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const w = 3.8;
    const numRungs = Math.max(3, Math.floor(len / 2.3));
    const shade = (hex, amt) => {
      const n = parseInt(hex.slice(1), 16);
      const r = Math.max(0, Math.min(255, (n >> 16 & 255) + amt));
      const g = Math.max(0, Math.min(255, (n >> 8 & 255) + amt));
      const bl = Math.max(0, Math.min(255, (n & 255) + amt));
      return `rgb(${r | 0},${g | 0},${bl | 0})`;
    };
    const rLight = shade(color, 70);
    const rMid = color;
    const rDark = shade(color, -45);
    const rDarker = shade(color, -85);
    const uid = `lad-${from}`;
    return /*#__PURE__*/React.createElement("g", {
      key: 'l' + from,
      transform: `translate(${a.x} ${a.y}) rotate(${ang})`
    }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: `${uid}-rail`,
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0%",
      stopColor: rLight
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "50%",
      stopColor: rMid
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "100%",
      stopColor: rDark
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: `${uid}-rung`,
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0%",
      stopColor: rLight
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "50%",
      stopColor: rMid
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "100%",
      stopColor: rDarker
    }))), /*#__PURE__*/React.createElement("g", {
      transform: "translate(0.9 1.5)",
      opacity: "0.4"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "-1",
      y: -w / 2 - 0.2,
      width: len + 2,
      height: "0.9",
      fill: "#000",
      filter: "url(#castShadowSoft)"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-1",
      y: w / 2 - 0.7,
      width: len + 2,
      height: "0.9",
      fill: "#000",
      filter: "url(#castShadowSoft)"
    })), /*#__PURE__*/React.createElement("rect", {
      x: "-0.9",
      y: -w / 2 + 0.1,
      width: len + 1.8,
      height: "1.1",
      fill: rDarker,
      rx: "0.3"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-0.9",
      y: w / 2 - 1.2,
      width: len + 1.8,
      height: "1.1",
      fill: rDarker,
      rx: "0.3"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-0.9",
      y: -w / 2 - 0.2,
      width: len + 1.8,
      height: "1.0",
      fill: `url(#${uid}-rail)`,
      rx: "0.35",
      stroke: rDarker,
      strokeWidth: "0.1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-0.9",
      y: w / 2 - 0.8,
      width: len + 1.8,
      height: "1.0",
      fill: `url(#${uid}-rail)`,
      rx: "0.35",
      stroke: rDarker,
      strokeWidth: "0.1"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "-0.5",
      y1: -w / 2 + 0.0,
      x2: len + 0.5,
      y2: -w / 2 + 0.0,
      stroke: "white",
      strokeWidth: "0.2",
      opacity: "0.85",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "-0.5",
      y1: w / 2 - 0.6,
      x2: len + 0.5,
      y2: w / 2 - 0.6,
      stroke: "white",
      strokeWidth: "0.2",
      opacity: "0.85",
      strokeLinecap: "round"
    }), Array.from({
      length: numRungs
    }).map((_, i) => {
      const t = (i + 0.5) / numRungs;
      const cx = t * len;
      return /*#__PURE__*/React.createElement("g", {
        key: 'rs' + i
      }, /*#__PURE__*/React.createElement("rect", {
        x: cx - 0.42,
        y: -w / 2 + 0.5,
        width: "0.92",
        height: w - 0.2,
        fill: rDarker
      }), /*#__PURE__*/React.createElement("rect", {
        x: cx - 0.45,
        y: -w / 2 + 0.25,
        width: "0.9",
        height: w - 0.4,
        fill: `url(#${uid}-rung)`,
        rx: "0.2",
        stroke: rDarker,
        strokeWidth: "0.08"
      }), /*#__PURE__*/React.createElement("line", {
        x1: cx - 0.35,
        y1: -w / 2 + 0.4,
        x2: cx - 0.35,
        y2: w / 2 - 0.3,
        stroke: "white",
        strokeWidth: "0.12",
        opacity: "0.7"
      }));
    }), [[-0.3, -w / 2 + 0.3], [len + 0.3, -w / 2 + 0.3], [-0.3, w / 2 - 0.3], [len + 0.3, w / 2 - 0.3]].map(([bx, by], i) => /*#__PURE__*/React.createElement("g", {
      key: 'b' + i
    }, /*#__PURE__*/React.createElement("circle", {
      cx: bx,
      cy: by,
      r: "0.4",
      fill: rLight
    }), /*#__PURE__*/React.createElement("circle", {
      cx: bx - 0.1,
      cy: by - 0.1,
      r: "0.15",
      fill: "white",
      opacity: "0.8"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: bx,
      cy: by,
      r: "0.18",
      fill: rDarker
    }))));
  }), CHUTES_LIST.map(({
    from,
    to,
    color,
    spiral,
    portal
  }) => {
    const shadeHex = (hex, amt) => {
      const n = parseInt(hex.slice(1), 16);
      const r = Math.max(0, Math.min(255, (n >> 16 & 255) + amt));
      const g = Math.max(0, Math.min(255, (n >> 8 & 255) + amt));
      const bl = Math.max(0, Math.min(255, (n & 255) + amt));
      return `rgb(${r | 0},${g | 0},${bl | 0})`;
    };
    if (portal) {
      const p = squareToPct(+from);
      const uidP = `portal-${from}`;
      const cL = shadeHex(color, 90);
      const cM = color;
      const cD = shadeHex(color, -40);
      const cDD = shadeHex(color, -80);
      // All portal art is drawn in a LOCAL coord system (translated to the cell
      // center) so every animated subgroup rotates around its natural origin (0,0).
      // transform-box: fill-box is unreliable on <g> across browsers — using nested
      // translate + local coords is the rock-solid approach at any zoom level.
      return /*#__PURE__*/React.createElement("g", {
        key: 'p' + from,
        transform: `translate(${p.x} ${p.y})`
      }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("radialGradient", {
        id: `${uidP}-core`,
        cx: "0.5",
        cy: "0.5",
        r: "0.55"
      }, /*#__PURE__*/React.createElement("stop", {
        offset: "0%",
        stopColor: "#fff",
        stopOpacity: "1"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "18%",
        stopColor: cL,
        stopOpacity: "0.95"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "55%",
        stopColor: cM,
        stopOpacity: "0.85"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "90%",
        stopColor: cD,
        stopOpacity: "0.5"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "100%",
        stopColor: cDD,
        stopOpacity: "0"
      })), /*#__PURE__*/React.createElement("radialGradient", {
        id: `${uidP}-ring`,
        cx: "0.5",
        cy: "0.5",
        r: "0.5"
      }, /*#__PURE__*/React.createElement("stop", {
        offset: "0%",
        stopColor: cL,
        stopOpacity: "0"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "75%",
        stopColor: cM,
        stopOpacity: "0.7"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "100%",
        stopColor: cDD,
        stopOpacity: "0"
      }))), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0.8",
        cy: "1.2",
        rx: "5",
        ry: "1.5",
        fill: "#000",
        opacity: "0.3",
        filter: "url(#castShadowSoft)"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "0",
        cy: "0",
        r: "4.4",
        fill: `url(#${uidP}-ring)`
      }), /*#__PURE__*/React.createElement("g", {
        style: {
          animation: 'portal-spin 4s linear infinite'
        }
      }, [0, 60, 120, 180, 240, 300].map(deg => /*#__PURE__*/React.createElement("path", {
        key: deg,
        d: "M 0 0 m -0.4 0 a 3.4 3.4 0 0 1 3.4 -3.4",
        transform: `rotate(${deg})`,
        fill: "none",
        stroke: cL,
        strokeWidth: "0.55",
        strokeLinecap: "round",
        opacity: "0.85"
      }))), /*#__PURE__*/React.createElement("g", {
        style: {
          animation: 'portal-spin-rev 2.5s linear infinite'
        }
      }, [30, 150, 270].map(deg => /*#__PURE__*/React.createElement("path", {
        key: deg,
        d: "M 0 0 m -0.3 0 a 2.2 2.2 0 0 1 2.2 -2.2",
        transform: `rotate(${deg})`,
        fill: "none",
        stroke: "#fff",
        strokeWidth: "0.45",
        strokeLinecap: "round",
        opacity: "0.9"
      }))), /*#__PURE__*/React.createElement("circle", {
        cx: "0",
        cy: "0",
        r: "3.4",
        fill: `url(#${uidP}-core)`,
        style: {
          animation: 'portal-pulse 1.6s ease-in-out infinite'
        }
      }), /*#__PURE__*/React.createElement("g", {
        style: {
          animation: 'portal-spin 3s linear infinite'
        }
      }, [0, 72, 144, 216, 288].map(deg => {
        const rad = 3.9;
        const ang = deg * Math.PI / 180;
        return /*#__PURE__*/React.createElement("circle", {
          key: deg,
          cx: Math.cos(ang) * rad,
          cy: Math.sin(ang) * rad,
          r: "0.35",
          fill: "#fff",
          opacity: "0.95"
        });
      })));
    }
    if (spiral) {
      // Big 3D coiled water-slide tube — inspired by a real spiral water slide.
      // Uses the shared spiral geometry (same path data drives the token's slide animation).
      const geo = computeSpiralGeometry(+from, +to);
      const {
        a,
        b,
        arches,
        boundaries
      } = geo;
      const uidS = `sp-${from}`;
      const cL = shadeHex(color, 90);
      const cM = color;
      const cD = shadeHex(color, -45);
      const cDD = shadeHex(color, -85);
      const cDDD = shadeHex(color, -115);
      const tubeW = SPIRAL_TUBE_W;
      const archR = SPIRAL_ARCH_R;
      return /*#__PURE__*/React.createElement("g", {
        key: 's' + from
      }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
        id: `${uidS}-tube`,
        x1: "0",
        y1: "0",
        x2: "0",
        y2: "1"
      }, /*#__PURE__*/React.createElement("stop", {
        offset: "0%",
        stopColor: cL
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "30%",
        stopColor: cM
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "72%",
        stopColor: cD
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "100%",
        stopColor: cDD
      })), /*#__PURE__*/React.createElement("radialGradient", {
        id: `${uidS}-bore`,
        cx: "0.5",
        cy: "0.4",
        r: "0.6"
      }, /*#__PURE__*/React.createElement("stop", {
        offset: "0%",
        stopColor: cDDD,
        stopOpacity: "0.95"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "60%",
        stopColor: cDDD,
        stopOpacity: "0.7"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "100%",
        stopColor: cDD,
        stopOpacity: "0.1"
      })), /*#__PURE__*/React.createElement("filter", {
        id: `${uidS}-pop`,
        x: "-30%",
        y: "-30%",
        width: "160%",
        height: "160%"
      }, /*#__PURE__*/React.createElement("feGaussianBlur", {
        in: "SourceAlpha",
        stdDeviation: "1.6"
      }), /*#__PURE__*/React.createElement("feOffset", {
        dx: "1.2",
        dy: "2.4",
        result: "offsetblur"
      }), /*#__PURE__*/React.createElement("feComponentTransfer", null, /*#__PURE__*/React.createElement("feFuncA", {
        type: "linear",
        slope: "0.55"
      })), /*#__PURE__*/React.createElement("feMerge", null, /*#__PURE__*/React.createElement("feMergeNode", null), /*#__PURE__*/React.createElement("feMergeNode", {
        in: "SourceGraphic"
      })))), /*#__PURE__*/React.createElement("g", {
        transform: "translate(2.4 3.8)",
        opacity: "0.55",
        filter: "url(#castShadowHeavy)"
      }, arches.map((ar, i) => /*#__PURE__*/React.createElement("path", {
        key: 'shd' + i,
        d: `M ${ar.s.x} ${ar.s.y} Q ${ar.ctrl.x} ${ar.ctrl.y} ${ar.e.x} ${ar.e.y}`,
        fill: "none",
        stroke: "#000",
        strokeWidth: tubeW + 2.0,
        strokeLinecap: "round"
      }))), arches.filter(ar => !ar.isFront).map((ar, i) => /*#__PURE__*/React.createElement("g", {
        key: 'bk' + i
      }, /*#__PURE__*/React.createElement("path", {
        d: `M ${ar.s.x} ${ar.s.y} Q ${ar.ctrl.x} ${ar.ctrl.y} ${ar.e.x} ${ar.e.y}`,
        fill: "none",
        stroke: cDDD,
        strokeWidth: tubeW + 1.0,
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M ${ar.s.x} ${ar.s.y} Q ${ar.ctrl.x} ${ar.ctrl.y} ${ar.e.x} ${ar.e.y}`,
        fill: "none",
        stroke: cDD,
        strokeWidth: tubeW + 0.2,
        strokeLinecap: "round",
        opacity: "0.95"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M ${ar.s.x} ${ar.s.y} Q ${ar.ctrl.x} ${ar.ctrl.y} ${ar.e.x} ${ar.e.y}`,
        fill: "none",
        stroke: cD,
        strokeWidth: tubeW - 1.3,
        strokeLinecap: "round",
        opacity: "0.9"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M ${ar.s.x} ${ar.s.y} Q ${ar.ctrl.x} ${ar.ctrl.y + 0.15} ${ar.e.x} ${ar.e.y}`,
        fill: "none",
        stroke: cL,
        strokeWidth: "0.3",
        strokeLinecap: "round",
        opacity: "0.35"
      }))), arches.filter(ar => ar.isFront).map((ar, i) => /*#__PURE__*/React.createElement("g", {
        key: 'un' + i
      }, /*#__PURE__*/React.createElement("path", {
        d: `M ${ar.s.x + 1.5} ${ar.s.y + 2.3} Q ${ar.ctrl.x + 1.5} ${ar.ctrl.y + 2.3} ${ar.e.x + 1.5} ${ar.e.y + 2.3}`,
        fill: "none",
        stroke: "#000",
        strokeWidth: tubeW + 1.3,
        strokeLinecap: "round",
        opacity: "0.35"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M ${ar.s.x + 0.95} ${ar.s.y + 1.5} Q ${ar.ctrl.x + 0.95} ${ar.ctrl.y + 1.5} ${ar.e.x + 0.95} ${ar.e.y + 1.5}`,
        fill: "none",
        stroke: cDDD,
        strokeWidth: tubeW + 0.9,
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M ${ar.s.x + 0.55} ${ar.s.y + 0.9} Q ${ar.ctrl.x + 0.55} ${ar.ctrl.y + 0.9} ${ar.e.x + 0.55} ${ar.e.y + 0.9}`,
        fill: "none",
        stroke: cDDD,
        strokeWidth: tubeW + 0.5,
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M ${ar.s.x + 0.25} ${ar.s.y + 0.45} Q ${ar.ctrl.x + 0.25} ${ar.ctrl.y + 0.45} ${ar.e.x + 0.25} ${ar.e.y + 0.45}`,
        fill: "none",
        stroke: cDD,
        strokeWidth: tubeW + 0.2,
        strokeLinecap: "round"
      }))), boundaries.map((bp, i) => {
        if (i === 0 || i === boundaries.length - 1) return null;
        return /*#__PURE__*/React.createElement("g", {
          key: 'cs' + i
        }, /*#__PURE__*/React.createElement("ellipse", {
          cx: bp.x + 0.1,
          cy: bp.y + 0.3,
          rx: tubeW * 0.72,
          ry: tubeW * 0.28,
          fill: "#000",
          opacity: "0.4"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: bp.x,
          cy: bp.y,
          rx: tubeW * 0.66,
          ry: tubeW * 0.24,
          fill: cDDD
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: bp.x,
          cy: bp.y - 0.08,
          rx: tubeW * 0.58,
          ry: tubeW * 0.2,
          fill: `url(#${uidS}-bore)`
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: bp.x - tubeW * 0.2,
          cy: bp.y - 0.22,
          rx: tubeW * 0.18,
          ry: tubeW * 0.06,
          fill: "#fff",
          opacity: "0.55"
        }));
      }), arches.filter(ar => ar.isFront).map((ar, i) => {
        // Sample RING-BANDS along the tube — visible joint rings like a real
        // segmented waterslide. Each ring is an ellipse whose long axis is
        // perpendicular to the tube tangent, so it wraps across the tube.
        const rings = [];
        const N = 7;
        for (let k = 1; k < N; k++) {
          const t = k / N;
          const mt = 1 - t;
          const x = mt * mt * ar.s.x + 2 * mt * t * ar.ctrl.x + t * t * ar.e.x;
          const y = mt * mt * ar.s.y + 2 * mt * t * ar.ctrl.y + t * t * ar.e.y;
          const tx = 2 * mt * (ar.ctrl.x - ar.s.x) + 2 * t * (ar.e.x - ar.ctrl.x);
          const ty = 2 * mt * (ar.ctrl.y - ar.s.y) + 2 * t * (ar.e.y - ar.ctrl.y);
          const angleDeg = Math.atan2(ty, tx) * 180 / Math.PI;
          rings.push({
            x,
            y,
            angleDeg
          });
        }
        return /*#__PURE__*/React.createElement("g", {
          key: 'fr' + i
        }, /*#__PURE__*/React.createElement("path", {
          d: `M ${ar.s.x} ${ar.s.y} Q ${ar.ctrl.x} ${ar.ctrl.y} ${ar.e.x} ${ar.e.y}`,
          fill: "none",
          stroke: cDDD,
          strokeWidth: tubeW + 1.8,
          strokeLinecap: "round"
        }), /*#__PURE__*/React.createElement("path", {
          d: `M ${ar.s.x} ${ar.s.y} Q ${ar.ctrl.x} ${ar.ctrl.y} ${ar.e.x} ${ar.e.y}`,
          fill: "none",
          stroke: `url(#${uidS}-tube)`,
          strokeWidth: tubeW + 0.2,
          strokeLinecap: "round"
        }), rings.map((r, k) => /*#__PURE__*/React.createElement("ellipse", {
          key: 'rg' + k,
          cx: r.x,
          cy: r.y,
          rx: "0.42",
          ry: tubeW * 0.58,
          transform: `rotate(${r.angleDeg} ${r.x} ${r.y})`,
          fill: cDDD,
          opacity: "0.75"
        })), /*#__PURE__*/React.createElement("path", {
          d: `M ${ar.s.x} ${ar.s.y - 0.5} Q ${ar.ctrl.x} ${ar.ctrl.y - 0.75} ${ar.e.x} ${ar.e.y - 0.5}`,
          fill: "none",
          stroke: cL,
          strokeWidth: "1.2",
          strokeLinecap: "round",
          opacity: "0.95"
        }), /*#__PURE__*/React.createElement("path", {
          d: `M ${ar.s.x + 0.3} ${ar.s.y - 0.65} Q ${ar.ctrl.x} ${ar.ctrl.y - 1.0} ${ar.e.x - 0.3} ${ar.e.y - 0.65}`,
          fill: "none",
          stroke: "#fff",
          strokeWidth: "0.55",
          strokeLinecap: "round",
          opacity: "0.9"
        }), /*#__PURE__*/React.createElement("path", {
          d: `M ${ar.s.x} ${ar.s.y + 0.55} Q ${ar.ctrl.x} ${ar.ctrl.y + 0.8} ${ar.e.x} ${ar.e.y + 0.55}`,
          fill: "none",
          stroke: cDDD,
          strokeWidth: "1.0",
          strokeLinecap: "round",
          opacity: "0.75"
        }));
      }), /*#__PURE__*/React.createElement("g", {
        transform: `translate(${a.x} ${a.y})`
      }, /*#__PURE__*/React.createElement("ellipse", {
        cx: "1.1",
        cy: "1.8",
        rx: archR * 1.15,
        ry: archR * 0.48,
        fill: "#000",
        opacity: "0.5",
        filter: "url(#castShadowHeavy)"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0",
        cy: "0.5",
        rx: archR * 0.95,
        ry: archR * 0.5,
        fill: cDDD
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0",
        cy: "0.15",
        rx: archR * 0.95,
        ry: archR * 0.5,
        fill: cDD
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0",
        cy: "0",
        rx: archR * 0.95,
        ry: archR * 0.5,
        fill: `url(#${uidS}-tube)`,
        stroke: cDDD,
        strokeWidth: "0.35"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0",
        cy: "-0.12",
        rx: archR * 0.7,
        ry: archR * 0.38,
        fill: cDDD
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0",
        cy: "-0.12",
        rx: archR * 0.7,
        ry: archR * 0.38,
        fill: `url(#${uidS}-bore)`
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0",
        cy: "-0.1",
        rx: archR * 0.55,
        ry: archR * 0.3,
        fill: "#000",
        opacity: "0.55"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "-1.2",
        cy: "-0.75",
        rx: archR * 0.38,
        ry: archR * 0.1,
        fill: "#fff",
        opacity: "0.75"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0.8",
        cy: "0.25",
        rx: archR * 0.28,
        ry: archR * 0.08,
        fill: cL,
        opacity: "0.5"
      })), /*#__PURE__*/React.createElement("g", {
        transform: `translate(${b.x} ${b.y})`
      }, /*#__PURE__*/React.createElement("ellipse", {
        cx: "1.0",
        cy: "1.8",
        rx: archR * 1.1,
        ry: archR * 0.42,
        fill: "#000",
        opacity: "0.5",
        filter: "url(#castShadowHeavy)"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0",
        cy: "0.5",
        rx: archR * 1.0,
        ry: archR * 0.52,
        fill: cDDD
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0",
        cy: "0.15",
        rx: archR * 1.0,
        ry: archR * 0.52,
        fill: cDD
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0",
        cy: "0",
        rx: archR * 1.0,
        ry: archR * 0.52,
        fill: `url(#${uidS}-tube)`,
        stroke: cDDD,
        strokeWidth: "0.35"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0",
        cy: "-0.12",
        rx: archR * 0.74,
        ry: archR * 0.4,
        fill: cDDD
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0",
        cy: "-0.12",
        rx: archR * 0.74,
        ry: archR * 0.4,
        fill: `url(#${uidS}-bore)`
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0",
        cy: "-0.1",
        rx: archR * 0.6,
        ry: archR * 0.32,
        fill: "#000",
        opacity: "0.5"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "-1.3",
        cy: "-0.8",
        rx: archR * 0.4,
        ry: archR * 0.1,
        fill: "#fff",
        opacity: "0.75"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "0.9",
        cy: "0.25",
        rx: archR * 0.3,
        ry: archR * 0.08,
        fill: cL,
        opacity: "0.5"
      })));
    }
    const a = squareToPct(+from); // TOP of slide (high square)
    const b = squareToPct(+to); // BOTTOM exit (low square)
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len,
      ny = dx / len;
    // S-curve via two control points
    const bulge1 = Math.min(7, len * 0.25);
    const bulge2 = Math.min(7, len * 0.25);
    const c1x = a.x + dx * 0.33 + nx * bulge1;
    const c1y = a.y + dy * 0.33 + ny * bulge1;
    const c2x = a.x + dx * 0.66 - nx * bulge2;
    const c2y = a.y + dy * 0.66 - ny * bulge2;
    const shade = (hex, amt) => {
      const n = parseInt(hex.slice(1), 16);
      const r = Math.max(0, Math.min(255, (n >> 16 & 255) + amt));
      const g = Math.max(0, Math.min(255, (n >> 8 & 255) + amt));
      const bl = Math.max(0, Math.min(255, (n & 255) + amt));
      return `rgb(${r | 0},${g | 0},${bl | 0})`;
    };
    const cLight = shade(color, 70);
    const cMid = color;
    const cDark = shade(color, -50);
    const cDarker = shade(color, -90);
    const uid = `sl-${from}`;

    // slide width constant along length (open slide)
    const wSlide = 3.2;

    // Sample cubic Bezier
    const sample = t => {
      const mt = 1 - t;
      return {
        x: mt * mt * mt * a.x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * b.x,
        y: mt * mt * mt * a.y + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * b.y,
        tx: 3 * mt * mt * (c1x - a.x) + 6 * mt * t * (c2x - c1x) + 3 * t * t * (b.x - c2x),
        ty: 3 * mt * mt * (c1y - a.y) + 6 * mt * t * (c2y - c1y) + 3 * t * t * (b.y - c2y)
      };
    };
    const steps = 50;
    const centerline = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      centerline.push({
        t,
        ...sample(t)
      });
    }

    // width grows slightly at exit (flare)
    const widthAt = t => wSlide * (1 + t * 0.15);

    // Build polygon for the slide surface (bed)
    const top = [],
      bot = [];
    centerline.forEach(({
      t,
      x,
      y,
      tx,
      ty
    }) => {
      const L = Math.hypot(tx, ty) || 1;
      const pnx = -ty / L,
        pny = tx / L;
      const w2 = widthAt(t) / 2;
      top.push([x + pnx * w2, y + pny * w2]);
      bot.push([x - pnx * w2, y - pny * w2]);
    });
    const bedPoints = [...top, ...bot.reverse()].map(p => `${p[0]},${p[1]}`).join(' ');

    // Side-rail paths (open slide walls): traced along each edge with some offset,
    // with a raised rim gradient for 3D
    const rail1 = top.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
    const rail2 = bot.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

    // Entry ladder top marker (small platform)
    const entry = sample(0);
    const entryAng = Math.atan2(entry.ty, entry.tx) * 180 / Math.PI;
    const exit_ = sample(1);
    const exitAng = Math.atan2(exit_.ty, exit_.tx) * 180 / Math.PI;
    return /*#__PURE__*/React.createElement("g", {
      key: 'c' + from
    }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: `${uid}-bed`,
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0%",
      stopColor: cDark
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "50%",
      stopColor: cLight
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "100%",
      stopColor: cDark
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: `${uid}-rail`,
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0%",
      stopColor: cLight
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "100%",
      stopColor: cDarker
    }))), /*#__PURE__*/React.createElement("g", {
      opacity: "0.4",
      transform: "translate(2.2 3.0)",
      filter: "url(#castShadowHeavy)"
    }, /*#__PURE__*/React.createElement("polygon", {
      points: bedPoints,
      fill: "#000"
    })), /*#__PURE__*/React.createElement("g", {
      opacity: "0.3",
      transform: "translate(1.4 2.0)",
      filter: "url(#castShadowSoft)"
    }, /*#__PURE__*/React.createElement("polygon", {
      points: bedPoints,
      fill: "#000"
    })), /*#__PURE__*/React.createElement("polygon", {
      points: top.concat(bot.slice().reverse()).map(p => `${p[0] + 0.9},${p[1] + 1.4}`).join(' '),
      fill: cDarker,
      opacity: "0.9"
    }), /*#__PURE__*/React.createElement("polygon", {
      points: top.concat(bot.slice().reverse()).map(p => `${p[0] + 0.55},${p[1] + 0.9}`).join(' '),
      fill: cDarker
    }), /*#__PURE__*/React.createElement("polygon", {
      points: top.concat(bot.slice().reverse()).map(p => `${p[0] + 0.25},${p[1] + 0.45}`).join(' '),
      fill: cDark
    }), /*#__PURE__*/React.createElement("polygon", {
      points: bedPoints,
      fill: `url(#${uid}-bed)`,
      stroke: cDarker,
      strokeWidth: "0.15"
    }), centerline.filter((_, i) => i > 2 && i < steps - 2 && i % 3 === 0).map(({
      x,
      y,
      tx,
      ty,
      t
    }, i) => {
      const L = Math.hypot(tx, ty) || 1;
      const pnx = -ty / L,
        pny = tx / L;
      const w2 = widthAt(t) / 2 * 0.92;
      return /*#__PURE__*/React.createElement("line", {
        key: 'r' + i,
        x1: x + pnx * w2,
        y1: y + pny * w2,
        x2: x - pnx * w2,
        y2: y - pny * w2,
        stroke: cDarker,
        strokeWidth: "0.12",
        opacity: "0.4"
      });
    }), showGlidePath && /*#__PURE__*/React.createElement("polyline", {
      points: centerline.map(({
        x,
        y,
        tx,
        ty,
        t
      }) => {
        const L = Math.hypot(tx, ty) || 1;
        const pnx = -ty / L,
          pny = tx / L;
        const w2 = widthAt(t) / 2 * 0.15;
        return `${x + pnx * w2 * 0.2},${y + pny * w2 * 0.2}`;
      }).join(' '),
      fill: "none",
      stroke: "white",
      strokeWidth: "0.7",
      opacity: "0.45",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: rail1,
      fill: "none",
      stroke: cDarker,
      strokeWidth: "0.9",
      strokeLinecap: "round",
      transform: "translate(0.15 0.35)"
    }), /*#__PURE__*/React.createElement("path", {
      d: rail2,
      fill: "none",
      stroke: cDarker,
      strokeWidth: "0.9",
      strokeLinecap: "round",
      transform: "translate(0.15 0.35)"
    }), /*#__PURE__*/React.createElement("path", {
      d: rail1,
      fill: "none",
      stroke: `url(#${uid}-rail)`,
      strokeWidth: "0.65",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: rail2,
      fill: "none",
      stroke: `url(#${uid}-rail)`,
      strokeWidth: "0.65",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: rail1,
      fill: "none",
      stroke: "white",
      strokeWidth: "0.2",
      strokeLinecap: "round",
      opacity: "0.8"
    }), /*#__PURE__*/React.createElement("path", {
      d: rail2,
      fill: "none",
      stroke: "white",
      strokeWidth: "0.2",
      strokeLinecap: "round",
      opacity: "0.8"
    }), /*#__PURE__*/React.createElement("g", {
      transform: `translate(${entry.x} ${entry.y}) rotate(${entryAng - 90})`
    }, /*#__PURE__*/React.createElement("ellipse", {
      cx: "0.3",
      cy: "0.6",
      rx: wSlide * 1.1,
      ry: wSlide * 0.55,
      fill: "#000",
      opacity: "0.3",
      filter: "url(#castShadowSoft)"
    }), /*#__PURE__*/React.createElement("ellipse", {
      cx: "0",
      cy: "0.25",
      rx: wSlide * 0.95,
      ry: wSlide * 0.45,
      fill: cDarker
    }), /*#__PURE__*/React.createElement("ellipse", {
      cx: "0",
      cy: "0",
      rx: wSlide * 0.95,
      ry: wSlide * 0.45,
      fill: `url(#${uid}-bed)`,
      stroke: cDarker,
      strokeWidth: "0.15"
    }), /*#__PURE__*/React.createElement("ellipse", {
      cx: "-0.6",
      cy: "-0.25",
      rx: wSlide * 0.5,
      ry: wSlide * 0.15,
      fill: "white",
      opacity: "0.35"
    }), /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
      x: -wSlide * 0.85,
      y: -wSlide * 0.9,
      width: "0.45",
      height: wSlide * 0.9,
      fill: cDark,
      rx: "0.15"
    }), /*#__PURE__*/React.createElement("rect", {
      x: -wSlide * 0.85,
      y: -wSlide * 0.9,
      width: "0.2",
      height: wSlide * 0.9,
      fill: cLight,
      rx: "0.08"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: -wSlide * 0.85 + 0.22,
      cy: -wSlide * 0.9,
      r: "0.32",
      fill: cLight,
      stroke: cDarker,
      strokeWidth: "0.1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: wSlide * 0.4,
      y: -wSlide * 0.9,
      width: "0.45",
      height: wSlide * 0.9,
      fill: cDark,
      rx: "0.15"
    }), /*#__PURE__*/React.createElement("rect", {
      x: wSlide * 0.4,
      y: -wSlide * 0.9,
      width: "0.2",
      height: wSlide * 0.9,
      fill: cLight,
      rx: "0.08"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: wSlide * 0.4 + 0.22,
      cy: -wSlide * 0.9,
      r: "0.32",
      fill: cLight,
      stroke: cDarker,
      strokeWidth: "0.1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: -wSlide * 0.85 + 0.22,
      y: -wSlide * 0.9 - 0.1,
      width: wSlide * 1.25,
      height: "0.3",
      fill: cLight,
      rx: "0.1",
      stroke: cDarker,
      strokeWidth: "0.08"
    }))), /*#__PURE__*/React.createElement("g", {
      transform: `translate(${exit_.x} ${exit_.y}) rotate(${exitAng - 90})`
    }, /*#__PURE__*/React.createElement("ellipse", {
      cx: "0.3",
      cy: "0.5",
      rx: wSlide * 1.0,
      ry: wSlide * 0.35,
      fill: "#000",
      opacity: "0.3",
      filter: "url(#castShadowSoft)"
    }), /*#__PURE__*/React.createElement("path", {
      d: `M ${-wSlide * 0.8} 0 Q 0 ${wSlide * 0.55} ${wSlide * 0.8} 0`,
      fill: cDarker
    }), /*#__PURE__*/React.createElement("path", {
      d: `M ${-wSlide * 0.8} -0.1 Q 0 ${wSlide * 0.45} ${wSlide * 0.8} -0.1 L ${wSlide * 0.65} -0.25 Q 0 ${wSlide * 0.25} ${-wSlide * 0.65} -0.25 Z`,
      fill: `url(#${uid}-rail)`,
      stroke: cDarker,
      strokeWidth: "0.12"
    }), /*#__PURE__*/React.createElement("path", {
      d: `M ${-wSlide * 0.55} 0.0 Q 0 ${wSlide * 0.28} ${wSlide * 0.55} 0.0`,
      stroke: "white",
      strokeWidth: "0.18",
      fill: "none",
      opacity: "0.75"
    })));
  })), /*#__PURE__*/React.createElement("div", {
    className: "tokens"
  }, players.map((p, i) => {
    const sq = tokenPositions[i];
    const override = tokenOverride && tokenOverride[i];
    if (sq < 1 && !override) return null;
    // If overridden (e.g. during spiral slide), use exact x/y path coords; else use square center
    const base = override ? {
      x: override.x,
      y: override.y
    } : squareToPct(sq);
    // offset so multiple tokens on same square don't overlap completely
    const sameSquareIdx = override ? 0 : players.map((_, j) => j).filter(j => tokenPositions[j] === sq).indexOf(i);
    const ox = override ? 0 : sameSquareIdx % 2 * 3.5 - 1.75;
    const oy = override ? 0 : Math.floor(sameSquareIdx / 2) * 3.5 - 1.75;
    const x = base.x,
      y = base.y;
    const isCurrent = i === currentPlayerIdx;
    const isMoving = isCurrent && phase === 'moving';
    const isClimbing = isCurrent && phase === 'climbing';
    const isSliding = isCurrent && phase === 'sliding';
    const isPortaling = isCurrent && phase === 'portaling';
    const isSpiraling = isCurrent && phase === 'spiraling';
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      className: `token ${isCurrent ? 'current' : ''} ${p.isAI ? 'robot-token' : ''} ${isMoving ? 'hopping' : ''} ${isClimbing ? 'climbing' : ''} ${isSliding ? 'sliding' : ''} ${isPortaling ? 'portaling' : ''} ${isSpiraling ? 'spiraling' : ''}`,
      style: {
        left: `${x + ox}%`,
        top: `${y + oy}%`,
        '--pcolor': p.color
      }
    }, p.isAI ? /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "70%",
      height: "70%"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "5",
      y: "7",
      width: "14",
      height: "12",
      rx: "3",
      fill: "white"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "13",
      r: "1.6",
      fill: p.color
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "15",
      cy: "13",
      r: "1.6",
      fill: p.color
    }), /*#__PURE__*/React.createElement("rect", {
      x: "10",
      y: "16",
      width: "4",
      height: "1.2",
      rx: "0.6",
      fill: p.color
    }), /*#__PURE__*/React.createElement("rect", {
      x: "11",
      y: "4",
      width: "2",
      height: "3",
      fill: "white"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "3.5",
      r: "1.2",
      fill: "white"
    })) : p.charId ? /*#__PURE__*/React.createElement("div", {
      style: {
        width: '130%',
        height: '130%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'translateY(-8%)'
      }
    }, /*#__PURE__*/React.createElement(Character, {
      charId: p.charId,
      size: '100%'
    })) : /*#__PURE__*/React.createElement("span", {
      className: "token-label"
    }, p.label));
  }), (() => {
    const curSq = tokenPositions[currentPlayerIdx];
    if (!curSq || curSq < 1) return null;
    const {
      x,
      y
    } = squareToPct(curSq);
    if (phase === 'climbing') {
      return /*#__PURE__*/React.createElement("div", {
        className: "fx-sparkles",
        style: {
          left: `${x}%`,
          top: `${y}%`
        }
      }, [...Array(8)].map((_, i) => /*#__PURE__*/React.createElement("span", {
        key: i,
        className: "spark",
        style: {
          '--i': i,
          '--ang': `${i * 45}deg`
        }
      })));
    }
    if (phase === 'sliding') {
      return /*#__PURE__*/React.createElement("div", {
        className: "fx-whoosh",
        style: {
          left: `${x}%`,
          top: `${y}%`
        }
      }, [...Array(5)].map((_, i) => /*#__PURE__*/React.createElement("span", {
        key: i,
        className: "whoosh-line",
        style: {
          '--i': i
        }
      })));
    }
    return null;
  })())), /*#__PURE__*/React.createElement("style", null, `
        .board-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 1/1;
          max-width: min(95vw, 80vh, 720px);
        }
        .board {
          position: relative;
          width: 100%;
          height: 100%;
          background: var(--board-bg);
          border-radius: 20px;
          padding: 14px;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.04) inset,
            0 24px 48px -16px rgba(26,31,46,0.35),
            0 2px 0 rgba(26,31,46,0.1);
        }
        .board-grid {
          position: relative;
          width: 100%;
          height: 100%;
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          grid-template-rows: repeat(10, 1fr);
          gap: 1px;
          border-radius: 8px;
          overflow: hidden;
          background: rgba(255,255,255,0.04);
        }
        .sq {
          position: relative;
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          padding: 4px 5px;
          transition: background 0.3s;
        }
        .sq.light {
          background: linear-gradient(135deg, #fbf5e8 0%, #f4ecd8 100%);
          color: #1a1f2e;
          box-shadow: inset 1px 1px 0 rgba(255,255,255,0.6), inset -1px -1px 0 rgba(0,0,0,0.04);
        }
        .sq.dark {
          background: linear-gradient(135deg, #ece2ca 0%, #ddd0b0 100%);
          color: #1a1f2e;
          box-shadow: inset 1px 1px 0 rgba(255,255,255,0.35), inset -1px -1px 0 rgba(0,0,0,0.05);
        }
        .sq.hl {
          background: linear-gradient(135deg, #fff6b0 0%, #ffe074 100%) !important;
          box-shadow: inset 0 0 0 2px #e8b23e, 0 0 0 2px rgba(232,178,62,0.3);
          animation: sq-pulse 0.9s ease-in-out infinite;
        }
        @keyframes sq-pulse {
          0%, 100% { box-shadow: inset 0 0 0 2px #e8b23e, 0 0 0 2px rgba(232,178,62,0.3); }
          50% { box-shadow: inset 0 0 0 2px #e8b23e, 0 0 0 8px rgba(232,178,62,0.5); }
        }
        .sq-num {
          font-size: clamp(9px, 1.1vw, 13px);
          font-weight: 500;
          opacity: 0.65;
          letter-spacing: -0.02em;
        }
        .sq-tag {
          position: absolute;
          bottom: 3px;
          right: 4px;
          font-size: clamp(7px, 0.7vw, 8px);
          font-family: 'Geist Mono', monospace;
          font-weight: 500;
          letter-spacing: 0.08em;
          color: var(--accent-2);
        }
        .sq-tag.gold { color: var(--accent-3); }
        .sq-dot {
          position: absolute;
          bottom: 2px;
          right: 3px;
          font-size: 10px;
          line-height: 1;
        }
        .sq-dot.chute { color: var(--accent); }
        .sq-dot.ladder { color: var(--accent-2); }
        .sq-dot.portal { color: #9b5cff; animation: portal-dot-pulse 1.4s ease-in-out infinite; }
        @keyframes portal-dot-pulse {
          0%, 100% { text-shadow: 0 0 0 #9b5cff; opacity: 0.9; }
          50% { text-shadow: 0 0 6px #9b5cff; opacity: 1; }
        }
        .board-svg {
          position: absolute;
          top: 14px; left: 14px; right: 14px; bottom: 14px;
          width: calc(100% - 28px);
          height: calc(100% - 28px);
          pointer-events: none;
          overflow: visible;
          filter: drop-shadow(0 6px 8px rgba(0,0,0,0.35)) drop-shadow(0 2px 2px rgba(0,0,0,0.25));
          z-index: 3;
        }
        .tokens {
          position: absolute;
          top: 14px; left: 14px; right: 14px; bottom: 14px;
          width: calc(100% - 28px);
          height: calc(100% - 28px);
          pointer-events: none;
          z-index: 4;
        }
        .token {
          position: absolute;
          width: 6%;
          height: 6%;
          border-radius: 50%;
          background: var(--pcolor);
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            0 2px 0 rgba(0,0,0,0.25),
            0 4px 10px rgba(0,0,0,0.3),
            inset 0 2px 3px rgba(255,255,255,0.4),
            inset 0 -2px 3px rgba(0,0,0,0.2);
          /* Smooth glide between squares — duration matches the per-step interval below
             (tokenStepMs ~240ms) so each hop lands cleanly before the next begins. The
             curve is a gentle ease (no overshoot) so the token feels light and precise
             rather than jittery / over-corrected. */
          transition: left 200ms cubic-bezier(0.33, 0, 0.2, 1), top 200ms cubic-bezier(0.33, 0, 0.2, 1);
          z-index: 2;
        }
        .token.robot-token {
          background: var(--robot);
        }
        .token.current {
          z-index: 3;
          animation: bob 1.4s ease-in-out infinite;
          box-shadow:
            0 0 0 3px rgba(255,255,255,0.5),
            0 0 0 5px var(--pcolor),
            0 2px 0 rgba(0,0,0,0.25),
            0 8px 20px rgba(0,0,0,0.35),
            inset 0 2px 3px rgba(255,255,255,0.4);
        }
        @keyframes bob {
          0%, 100% { transform: translate(-50%, -55%); }
          50% { transform: translate(-50%, -45%); }
        }
        /* One hop cycle per square step — duration matches tokenStepMs so each
           hop peaks mid-glide and lands as the token reaches the next square. */
        .token.hopping {
          animation: token-hop 240ms cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }
        @keyframes token-hop {
          0%   { transform: translate(-50%, -50%) scale(1); }
          45%  { transform: translate(-50%, -82%) scale(1.06); }
          80%  { transform: translate(-50%, -48%) scale(0.96); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        .token.climbing {
          animation: token-climb 0.45s ease-in-out infinite;
          filter: drop-shadow(0 0 8px rgba(42,138,95,0.6));
        }
        @keyframes token-climb {
          0%, 100% { transform: translate(-50%, -50%) rotate(-4deg) scale(1); }
          50% { transform: translate(-50%, -58%) rotate(4deg) scale(1.08); }
        }
        .token.sliding {
          animation: token-slide 0.35s ease-in-out infinite;
          filter: drop-shadow(0 0 10px rgba(232,88,62,0.7));
        }
        /* While the token is being auto-piloted along the spiral path, kill left/top transitions
           so RAF updates render 1:1. Add a spin + glow to sell the "whee!" water-slide feel. */
        .token.spiraling {
          transition: none !important;
          animation: token-spiral 0.55s linear infinite;
          filter: drop-shadow(0 0 10px rgba(255,122,61,0.8));
          z-index: 8;
        }
        @keyframes token-spiral {
          0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
          50% { transform: translate(-50%, -58%) rotate(180deg) scale(1.1); }
          100% { transform: translate(-50%, -50%) rotate(360deg) scale(1); }
        }
        @keyframes token-slide {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          25% { transform: translate(-55%, -48%) rotate(-12deg); }
          50% { transform: translate(-50%, -52%) rotate(0deg); }
          75% { transform: translate(-45%, -48%) rotate(12deg); }
          100% { transform: translate(-50%, -50%) rotate(0deg); }
        }
        /* Sparkle burst overlay for ladder climbs */
        .fx-sparkles {
          position: absolute;
          width: 0; height: 0;
          pointer-events: none;
          z-index: 6;
        }
        .fx-sparkles .spark {
          position: absolute;
          left: 0; top: 0;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: radial-gradient(circle, #fff 0%, #ffe074 40%, transparent 70%);
          transform: translate(-50%, -50%);
          animation: spark-burst 1s ease-out infinite;
          animation-delay: calc(var(--i) * 0.08s);
        }
        @keyframes spark-burst {
          0% {
            transform: translate(-50%, -50%) rotate(var(--ang)) translateX(0) scale(0.4);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--ang)) translateX(26px) scale(0);
            opacity: 0;
          }
        }
        /* Whoosh motion lines for chute slides */
        .fx-whoosh {
          position: absolute;
          width: 0; height: 0;
          pointer-events: none;
          z-index: 6;
        }
        .fx-whoosh .whoosh-line {
          position: absolute;
          left: -14px;
          top: calc(var(--i) * 5px - 10px);
          width: 28px;
          height: 2px;
          border-radius: 1px;
          background: linear-gradient(90deg, transparent, rgba(232,88,62,0.9), transparent);
          animation: whoosh-move 0.5s linear infinite;
          animation-delay: calc(var(--i) * 0.08s);
        }
        @keyframes whoosh-move {
          0% { transform: translateX(-30px); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateX(30px); opacity: 0; }
        }
        /* Portal swirl animations */
        @keyframes portal-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes portal-spin-rev {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes portal-pulse {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; transform: scale(1.08); transform-origin: center; }
        }
        /* Token being portaled — arcs up and away then comes back for landing */
        .token.portaling {
          transition: left 0.9s cubic-bezier(.55,.05,.45,1), top 0.9s cubic-bezier(.55,.05,.45,1) !important;
          animation: portal-throw 0.9s ease-in-out;
          z-index: 10;
        }
        @keyframes portal-throw {
          0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); filter: none; }
          20% { transform: translate(-50%, -120%) scale(0.7) rotate(540deg); filter: brightness(1.4) drop-shadow(0 0 6px #9b5cff); }
          50% { transform: translate(-50%, -220%) scale(0.4) rotate(1440deg); filter: brightness(1.6) drop-shadow(0 0 14px #9b5cff); }
          80% { transform: translate(-50%, -110%) scale(0.75) rotate(2340deg); filter: brightness(1.4) drop-shadow(0 0 6px #9b5cff); }
          100% { transform: translate(-50%, -50%) scale(1) rotate(2880deg); filter: none; }
        }
        .token-label {
          color: white;
          font-weight: 700;
          font-size: clamp(9px, 1vw, 12px);
          text-shadow: 0 1px 2px rgba(0,0,0,0.4);
        }
      `));
}
window.Board = Board;
window.CHUTES = CHUTES;
window.LADDERS = LADDERS;
window.squareToPct = squareToPct;

// === characters.jsx ===
// Robot AI character

function Robot({
  mood = 'happy',
  size = 80,
  color = '#1a1f2e'
}) {
  // mood: happy | thinking | celebrating | sad
  const eyeY = mood === 'sad' ? 13 : 12;
  const mouth = {
    happy: /*#__PURE__*/React.createElement("path", {
      d: "M 9 16 Q 12 18 15 16",
      stroke: color,
      strokeWidth: "1",
      fill: "none",
      strokeLinecap: "round"
    }),
    thinking: /*#__PURE__*/React.createElement("line", {
      x1: "10",
      y1: "17",
      x2: "14",
      y2: "17",
      stroke: color,
      strokeWidth: "1",
      strokeLinecap: "round"
    }),
    celebrating: /*#__PURE__*/React.createElement("ellipse", {
      cx: "12",
      cy: "17",
      rx: "2",
      ry: "1.5",
      fill: color
    }),
    sad: /*#__PURE__*/React.createElement("path", {
      d: "M 9 17 Q 12 15 15 17",
      stroke: color,
      strokeWidth: "1",
      fill: "none",
      strokeLinecap: "round"
    })
  }[mood];
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "3",
    stroke: color,
    strokeWidth: "0.8",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "2.5",
    r: "1",
    fill: "#e8b23e"
  }, mood === 'thinking' && /*#__PURE__*/React.createElement("animate", {
    attributeName: "opacity",
    values: "1;0.3;1",
    dur: "1s",
    repeatCount: "indefinite"
  })), /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "5",
    width: "14",
    height: "13",
    rx: "3.5",
    fill: color
  }), /*#__PURE__*/React.createElement("rect", {
    x: "6.5",
    y: "7",
    width: "11",
    height: "9",
    rx: "2",
    fill: "#f7f1e4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9.5",
    cy: eyeY,
    r: "1.3",
    fill: color
  }, /*#__PURE__*/React.createElement("animate", {
    attributeName: "r",
    values: "1.3;1.3;0.2;1.3",
    keyTimes: "0;0.9;0.95;1",
    dur: "4s",
    repeatCount: "indefinite"
  })), /*#__PURE__*/React.createElement("circle", {
    cx: "14.5",
    cy: eyeY,
    r: "1.3",
    fill: color
  }, /*#__PURE__*/React.createElement("animate", {
    attributeName: "r",
    values: "1.3;1.3;0.2;1.3",
    keyTimes: "0;0.9;0.95;1",
    dur: "4s",
    repeatCount: "indefinite"
  })), mouth, /*#__PURE__*/React.createElement("circle", {
    cx: "7.5",
    cy: "15",
    r: "0.8",
    fill: "#e8583e",
    opacity: "0.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "16.5",
    cy: "15",
    r: "0.8",
    fill: "#e8583e",
    opacity: "0.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "8",
    y: "18",
    width: "8",
    height: "3",
    rx: "1",
    fill: color,
    opacity: "0.3"
  }));
}

// Human player avatar (simple silhouette with color)
function Avatar({
  label,
  color,
  size = 48,
  isCurrent = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: size * 0.4,
      boxShadow: isCurrent ? `0 0 0 3px var(--bg), 0 0 0 5px ${color}, 0 4px 10px rgba(0,0,0,0.2)` : '0 2px 6px rgba(0,0,0,0.15), inset 0 2px 3px rgba(255,255,255,0.3)',
      flexShrink: 0
    }
  }, label);
}

// 3D-styled character roster — each is a layered SVG with gradients, highlights, shadow
const CHARACTERS = [{
  id: 'coco',
  name: 'Coco',
  color: '#6d4a2e'
}, {
  id: 'ember',
  name: 'Ember',
  color: '#ff8a3d'
}, {
  id: 'ziggy',
  name: 'Ziggy',
  color: '#a855a0'
}, {
  id: 'bolt',
  name: 'Bolt',
  color: '#e8b23e'
}, {
  id: 'mochi',
  name: 'Mochi',
  color: '#f6c6d4'
}, {
  id: 'luna',
  name: 'Luna',
  color: '#5b6cff'
}, {
  id: 'fern',
  name: 'Fern',
  color: '#2a8a5f'
}, {
  id: 'pip',
  name: 'Pip',
  color: '#e8583e'
}];
function Character({
  charId,
  size = 56,
  spin = false
}) {
  const c = CHARACTERS.find(x => x.id === charId) || CHARACTERS[0];
  const darken = (hex, amt = 0.25) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (n >> 16 & 255) * (1 - amt));
    const g = Math.max(0, (n >> 8 & 255) * (1 - amt));
    const b = Math.max(0, (n & 255) * (1 - amt));
    return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
  };
  const lighten = (hex, amt = 0.3) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (n >> 16 & 255) + 255 * amt);
    const g = Math.min(255, (n >> 8 & 255) + 255 * amt);
    const b = Math.min(255, (n & 255) + 255 * amt);
    return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
  };
  const base = c.color;
  const dark = darken(base, 0.4);
  const darker = darken(base, 0.65);
  const light = lighten(base, 0.35);
  const lighter = lighten(base, 0.7);
  const uid = c.id;

  // ======== True 3D shading defs ========
  // Every character uses: body sphere gradient (key light top-left), rim light (bottom-right),
  // glossy specular highlight, soft ground shadow.
  const defs = /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("radialGradient", {
    id: `body-${uid}`,
    cx: "0.32",
    cy: "0.25",
    r: "0.85",
    fx: "0.28",
    fy: "0.22"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: lighter
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "25%",
    stopColor: light
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "60%",
    stopColor: base
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "95%",
    stopColor: dark
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: darker
  })), /*#__PURE__*/React.createElement("radialGradient", {
    id: `rim-${uid}`,
    cx: "0.78",
    cy: "0.82",
    r: "0.4"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: light,
    stopOpacity: "0.75"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "70%",
    stopColor: base,
    stopOpacity: "0"
  })), /*#__PURE__*/React.createElement("radialGradient", {
    id: `spec-${uid}`,
    cx: "0.32",
    cy: "0.22",
    r: "0.18"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "white",
    stopOpacity: "0.95"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "60%",
    stopColor: "white",
    stopOpacity: "0.3"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "white",
    stopOpacity: "0"
  })), /*#__PURE__*/React.createElement("radialGradient", {
    id: `ao-${uid}`,
    cx: "0.5",
    cy: "0.95",
    r: "0.5"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: darker,
    stopOpacity: "0.55"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "70%",
    stopColor: darker,
    stopOpacity: "0"
  })), /*#__PURE__*/React.createElement("radialGradient", {
    id: `eye-${uid}`,
    cx: "0.35",
    cy: "0.3",
    r: "0.8"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#ffffff"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "75%",
    stopColor: "#dcdfe6"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#9fa4b2"
  })), /*#__PURE__*/React.createElement("radialGradient", {
    id: `pupil-${uid}`,
    cx: "0.4",
    cy: "0.35",
    r: "0.6"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#2a3144"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#0a0d14"
  })), /*#__PURE__*/React.createElement("radialGradient", {
    id: `blush-${uid}`,
    cx: "0.5",
    cy: "0.5",
    r: "0.5"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#ff7a8e",
    stopOpacity: "0.55"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#ff7a8e",
    stopOpacity: "0"
  })), /*#__PURE__*/React.createElement("filter", {
    id: `blur-${uid}`,
    x: "-30%",
    y: "-30%",
    width: "160%",
    height: "160%"
  }, /*#__PURE__*/React.createElement("feGaussianBlur", {
    stdDeviation: "0.6"
  })), /*#__PURE__*/React.createElement("filter", {
    id: `softblur-${uid}`
  }, /*#__PURE__*/React.createElement("feGaussianBlur", {
    stdDeviation: "0.25"
  })));

  // 3D eye: white sphere with shaded pupil and catch-light
  const eye3D = (cx, cy, r = 1.1) => /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("ellipse", {
    cx: cx + 0.08,
    cy: cy + 0.15,
    rx: r * 1.05,
    ry: r * 1.05,
    fill: "#000",
    opacity: "0.15",
    filter: `url(#softblur-${uid})`
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: r,
    fill: `url(#eye-${uid})`
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx + 0.1,
    cy: cy + 0.15,
    r: r * 0.55,
    fill: `url(#pupil-${uid})`
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx - 0.15,
    cy: cy - 0.2,
    r: r * 0.25,
    fill: "white",
    opacity: "0.95"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx + 0.3,
    cy: cy + 0.3,
    r: r * 0.1,
    fill: "white",
    opacity: "0.7"
  }));

  // Mouth with depth — small dark pill with highlight on lower lip
  const mouth3D = (cx, cy, w = 1.6) => /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: `M ${cx - w / 2} ${cy} Q ${cx} ${cy + 0.8} ${cx + w / 2} ${cy}`,
    stroke: darker,
    strokeWidth: "0.35",
    fill: "#3a1a1a",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: `M ${cx - w / 2 + 0.2} ${cy + 0.2} Q ${cx} ${cy + 0.5} ${cx + w / 2 - 0.2} ${cy + 0.2}`,
    stroke: "#ff9aa5",
    strokeWidth: "0.15",
    fill: "none",
    opacity: "0.6"
  }));

  // Blush cheeks
  const cheeks = (ly, scale = 1) => /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("ellipse", {
    cx: "8",
    cy: ly,
    rx: 1.1 * scale,
    ry: 0.7 * scale,
    fill: `url(#blush-${uid})`
  }), /*#__PURE__*/React.createElement("ellipse", {
    cx: "16",
    cy: ly,
    rx: 1.1 * scale,
    ry: 0.7 * scale,
    fill: `url(#blush-${uid})`
  }));

  // Shared shaded body (sphere layers) — renders 3D sphere shading at given shape
  const sphereShade = shapeEl => /*#__PURE__*/React.createElement(React.Fragment, null, shapeEl({
    fill: `url(#body-${uid})`
  }), shapeEl({
    fill: `url(#rim-${uid})`
  }), shapeEl({
    fill: `url(#ao-${uid})`
  }), shapeEl({
    fill: `url(#spec-${uid})`
  }));

  // Cast shadow on ground
  const groundShadow = /*#__PURE__*/React.createElement("ellipse", {
    cx: "12",
    cy: "22.5",
    rx: "6.5",
    ry: "0.9",
    fill: "#000",
    opacity: "0.28",
    filter: `url(#blur-${uid})`
  });

  // ---------- Bodies ----------
  const bodies = {
    // Bolt — glossy 3D star
    bolt: (() => {
      const star = props => /*#__PURE__*/React.createElement("path", _extends({
        d: "M 12 2.5 L 14.6 8.4 L 21 9.1 L 16.2 13.4 L 17.8 19.8 L 12 16.5 L 6.2 19.8 L 7.8 13.4 L 3 9.1 L 9.4 8.4 Z",
        stroke: darker,
        strokeWidth: "0.25",
        strokeLinejoin: "round"
      }, props));
      return /*#__PURE__*/React.createElement("g", null, groundShadow, sphereShade(star), eye3D(9.2, 11.5, 0.9), eye3D(14.8, 11.5, 0.9), mouth3D(12, 14, 1.4), cheeks(14.5, 0.9));
    })(),
    // Pip — 3D apple with volumetric leaf and stem
    pip: (() => {
      const body = props => /*#__PURE__*/React.createElement("path", _extends({
        d: "M 12 5.5 C 6 5.5 3 9 3 13.5 C 3 18.5 7 21.5 12 21.5 C 17 21.5 21 18.5 21 13.5 C 21 9 18 5.5 12 5.5 Z",
        stroke: darker,
        strokeWidth: "0.25"
      }, props));
      return /*#__PURE__*/React.createElement("g", null, groundShadow, /*#__PURE__*/React.createElement("path", {
        d: "M 11.5 5.5 L 11.7 3.2 L 12.5 3.2 L 12.3 5.5 Z",
        fill: "#3a2410"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 11.7 3.2 L 12.1 3.2 L 11.9 5.5 L 11.6 5.5 Z",
        fill: "#6d4a2e"
      }), /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
        id: `leaf-${uid}`,
        x1: "0",
        y1: "0",
        x2: "1",
        y2: "1"
      }, /*#__PURE__*/React.createElement("stop", {
        offset: "0%",
        stopColor: "#5fc98b"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "50%",
        stopColor: "#2a8a5f"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "100%",
        stopColor: "#164a32"
      }))), /*#__PURE__*/React.createElement("path", {
        d: "M 12.3 4.5 Q 17 2 18 5 Q 15 6.5 12.3 6 Z",
        fill: `url(#leaf-${uid})`,
        stroke: "#164a32",
        strokeWidth: "0.15"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 13 4.8 Q 16 3.5 17.3 4.8",
        stroke: "white",
        strokeWidth: "0.15",
        fill: "none",
        opacity: "0.5"
      }), sphereShade(body), /*#__PURE__*/React.createElement("ellipse", {
        cx: "12",
        cy: "6.3",
        rx: "1",
        ry: "0.4",
        fill: darker,
        opacity: "0.5"
      }), eye3D(9.5, 13, 1.1), eye3D(14.5, 13, 1.1), mouth3D(12, 15.5, 1.7), cheeks(16, 1));
    })(),
    // Mochi — 3D bunny, volumetric ears, soft body
    mochi: (() => {
      const body = props => /*#__PURE__*/React.createElement("ellipse", _extends({
        cx: "12",
        cy: "14.5",
        rx: "7.5",
        ry: "7.2",
        stroke: darker,
        strokeWidth: "0.25"
      }, props));
      return /*#__PURE__*/React.createElement("g", null, groundShadow, /*#__PURE__*/React.createElement("ellipse", {
        cx: "8.2",
        cy: "5",
        rx: "1.8",
        ry: "3.8",
        fill: dark,
        transform: "rotate(-15 8.2 5)"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "15.8",
        cy: "5",
        rx: "1.8",
        ry: "3.8",
        fill: dark,
        transform: "rotate(15 15.8 5)"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "8.2",
        cy: "5.2",
        rx: "1.3",
        ry: "3.3",
        fill: `url(#body-${uid})`,
        transform: "rotate(-15 8.2 5.2)"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "15.8",
        cy: "5.2",
        rx: "1.3",
        ry: "3.3",
        fill: `url(#body-${uid})`,
        transform: "rotate(15 15.8 5.2)"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "8.2",
        cy: "5.8",
        rx: "0.55",
        ry: "2.2",
        fill: "#ff9db0",
        transform: "rotate(-15 8.2 5.8)"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "15.8",
        cy: "5.8",
        rx: "0.55",
        ry: "2.2",
        fill: "#ff9db0",
        transform: "rotate(15 15.8 5.8)"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "8.2",
        cy: "5.8",
        rx: "0.3",
        ry: "1.5",
        fill: "#ffc2ce",
        transform: "rotate(-15 8.2 5.8)"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "15.8",
        cy: "5.8",
        rx: "0.3",
        ry: "1.5",
        fill: "#ffc2ce",
        transform: "rotate(15 15.8 5.8)"
      }), sphereShade(body), eye3D(9.3, 13.5, 1.1), eye3D(14.7, 13.5, 1.1), /*#__PURE__*/React.createElement("ellipse", {
        cx: "12",
        cy: "15.2",
        rx: "0.55",
        ry: "0.4",
        fill: "#ff7a8e"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "11.9",
        cy: "15.1",
        rx: "0.2",
        ry: "0.15",
        fill: "#ffc2ce"
      }), mouth3D(12, 16.1, 1.2), cheeks(16.2, 1));
    })(),
    // Fern — 3D frog w/ eye-domes
    fern: (() => {
      const body = props => /*#__PURE__*/React.createElement("ellipse", _extends({
        cx: "12",
        cy: "15",
        rx: "8.5",
        ry: "6.5",
        stroke: darker,
        strokeWidth: "0.25"
      }, props));
      return /*#__PURE__*/React.createElement("g", null, groundShadow, sphereShade(body), /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
        cx: "7.5",
        cy: "8.5",
        r: "3.2",
        fill: dark
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "7.5",
        cy: "8.3",
        r: "2.9",
        fill: `url(#body-${uid})`
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "16.5",
        cy: "8.5",
        r: "3.2",
        fill: dark
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "16.5",
        cy: "8.3",
        r: "2.9",
        fill: `url(#body-${uid})`
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "7.5",
        cy: "7.8",
        r: "2",
        fill: `url(#eye-${uid})`
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "16.5",
        cy: "7.8",
        r: "2",
        fill: `url(#eye-${uid})`
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "7.7",
        cy: "8",
        r: "1.1",
        fill: `url(#pupil-${uid})`
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "16.7",
        cy: "8",
        r: "1.1",
        fill: `url(#pupil-${uid})`
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "7.3",
        cy: "7.5",
        r: "0.45",
        fill: "white"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "16.3",
        cy: "7.5",
        r: "0.45",
        fill: "white"
      })), /*#__PURE__*/React.createElement("ellipse", {
        cx: "12",
        cy: "17",
        rx: "4",
        ry: "2.5",
        fill: lighter,
        opacity: "0.35"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 9.5 16 Q 12 18.8 14.5 16",
        stroke: darker,
        strokeWidth: "0.4",
        fill: "none",
        strokeLinecap: "round"
      }), cheeks(16.3, 1));
    })(),
    // Luna — 3D cat/moon creature
    luna: (() => {
      const body = props => /*#__PURE__*/React.createElement("ellipse", _extends({
        cx: "12",
        cy: "13.5",
        rx: "8",
        ry: "7.8",
        stroke: darker,
        strokeWidth: "0.25"
      }, props));
      return /*#__PURE__*/React.createElement("g", null, groundShadow, /*#__PURE__*/React.createElement("path", {
        d: "M 6 8 L 7.5 3.5 L 10 8 Z",
        fill: darker
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 18 8 L 16.5 3.5 L 14 8 Z",
        fill: darker
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 6.3 8 L 7.6 4.2 L 9.7 8 Z",
        fill: `url(#body-${uid})`
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 17.7 8 L 16.4 4.2 L 14.3 8 Z",
        fill: `url(#body-${uid})`
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 7.1 7.5 L 7.7 5.5 L 8.6 7.5 Z",
        fill: "#ff9db0"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 16.9 7.5 L 16.3 5.5 L 15.4 7.5 Z",
        fill: "#ff9db0"
      }), sphereShade(body), eye3D(9.5, 12.5, 1.2), eye3D(14.5, 12.5, 1.2), /*#__PURE__*/React.createElement("path", {
        d: "M 11.4 14.3 L 12.6 14.3 L 12 15.1 Z",
        fill: "#ff7a8e"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 12 15.1 Q 11 16 10 15.5",
        stroke: darker,
        strokeWidth: "0.3",
        fill: "none",
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 12 15.1 Q 13 16 14 15.5",
        stroke: darker,
        strokeWidth: "0.3",
        fill: "none",
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "4.5",
        y1: "14.5",
        x2: "7.5",
        y2: "14.5",
        stroke: darker,
        strokeWidth: "0.15"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "16.5",
        y1: "14.5",
        x2: "19.5",
        y2: "14.5",
        stroke: darker,
        strokeWidth: "0.15"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "5",
        y1: "15.3",
        x2: "7.5",
        y2: "15",
        stroke: darker,
        strokeWidth: "0.15"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "16.5",
        y1: "15",
        x2: "19",
        y2: "15.3",
        stroke: darker,
        strokeWidth: "0.15"
      }), cheeks(15.8, 1));
    })(),
    // Ziggy — 3D spiky burst
    ziggy: (() => {
      const spike = props => /*#__PURE__*/React.createElement("path", _extends({
        d: "M 12 2 L 13.2 5.5 L 16.5 3.5 L 15.8 7 L 20 6 L 17.8 9.2 L 21.5 11 L 18.5 12.5 L 21 15.8 L 17 15.5 L 17.5 19.5 L 14 17.5 L 13 21.2 L 11 18.2 L 9 21.2 L 8 17.5 L 4.5 19.5 L 5 15.5 L 1 15.8 L 3.5 12.5 L 0.5 11 L 4.2 9.2 L 2 6 L 6.2 7 L 5.5 3.5 L 8.8 5.5 Z",
        stroke: darker,
        strokeWidth: "0.25",
        strokeLinejoin: "round"
      }, props));
      return /*#__PURE__*/React.createElement("g", null, groundShadow, sphereShade(spike), eye3D(9.5, 10.5, 1), eye3D(14.5, 10.5, 1), mouth3D(12, 13, 1.4), cheeks(12.8, 0.9));
    })(),
    // Ember — 3D flame with inner glow
    ember: (() => {
      const flame = props => /*#__PURE__*/React.createElement("path", _extends({
        d: "M 12 2 Q 8.5 7.5 8.5 11.5 Q 6.5 10 5.5 14 Q 4 19.5 12 21.8 Q 20 19.5 18.5 14 Q 17.5 10 15.5 11.5 Q 15.5 7.5 12 2 Z",
        stroke: darker,
        strokeWidth: "0.25"
      }, props));
      return /*#__PURE__*/React.createElement("g", null, groundShadow, sphereShade(flame), /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("radialGradient", {
        id: `inner-${uid}`,
        cx: "0.5",
        cy: "0.6",
        r: "0.5"
      }, /*#__PURE__*/React.createElement("stop", {
        offset: "0%",
        stopColor: "#fff4c2",
        stopOpacity: "0.95"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "50%",
        stopColor: "#ffd16a",
        stopOpacity: "0.55"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "100%",
        stopColor: "#ffd16a",
        stopOpacity: "0"
      }))), /*#__PURE__*/React.createElement("path", {
        d: "M 12 6 Q 10.5 9 10.5 12 Q 9.5 13 9.5 15 Q 10 17 12 18 Q 14 17 14.5 15 Q 14.5 13 13.5 12 Q 13.5 9 12 6 Z",
        fill: `url(#inner-${uid})`
      }), eye3D(9.5, 14.5, 0.95), eye3D(14.5, 14.5, 0.95), mouth3D(12, 16.8, 1.3), cheeks(17, 0.85));
    })(),
    // Coco — 3D bear with ear lobes and snout
    coco: (() => {
      const body = props => /*#__PURE__*/React.createElement("circle", _extends({
        cx: "12",
        cy: "13.5",
        r: "8",
        stroke: darker,
        strokeWidth: "0.25"
      }, props));
      return /*#__PURE__*/React.createElement("g", null, groundShadow, /*#__PURE__*/React.createElement("circle", {
        cx: "6.5",
        cy: "7",
        r: "2.4",
        fill: darker
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "17.5",
        cy: "7",
        r: "2.4",
        fill: darker
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "6.7",
        cy: "6.8",
        r: "2",
        fill: `url(#body-${uid})`
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "17.3",
        cy: "6.8",
        r: "2",
        fill: `url(#body-${uid})`
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "6.7",
        cy: "6.8",
        r: "1.2",
        fill: dark
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "17.3",
        cy: "6.8",
        r: "1.2",
        fill: dark
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "6.9",
        cy: "6.6",
        r: "0.9",
        fill: lighten(base, 0.15)
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "17.1",
        cy: "6.6",
        r: "0.9",
        fill: lighten(base, 0.15)
      }), sphereShade(body), /*#__PURE__*/React.createElement("ellipse", {
        cx: "12",
        cy: "15.8",
        rx: "3.5",
        ry: "2.6",
        fill: lighter,
        opacity: "0.8"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "12",
        cy: "15.8",
        rx: "3.5",
        ry: "2.6",
        fill: `url(#ao-${uid})`
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "12",
        cy: "14.5",
        rx: "0.7",
        ry: "0.5",
        fill: "#1a1f2e"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "11.9",
        cy: "14.4",
        rx: "0.2",
        ry: "0.15",
        fill: "white",
        opacity: "0.6"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 12 15 L 12 16",
        stroke: darker,
        strokeWidth: "0.25"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 12 16 Q 11 16.8 10.2 16.4",
        stroke: darker,
        strokeWidth: "0.35",
        fill: "none",
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 12 16 Q 13 16.8 13.8 16.4",
        stroke: darker,
        strokeWidth: "0.35",
        fill: "none",
        strokeLinecap: "round"
      }), eye3D(9.2, 12.8, 1.1), eye3D(14.8, 12.8, 1.1), cheeks(16.3, 0.9));
    })()
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      display: 'inline-block',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    style: {
      filter: 'drop-shadow(0 4px 5px rgba(0,0,0,0.3)) drop-shadow(0 1px 0 rgba(255,255,255,0.2))',
      animation: spin ? 'char-bob 2.2s ease-in-out infinite' : undefined,
      display: 'block',
      overflow: 'visible'
    }
  }, defs, bodies[c.id]), /*#__PURE__*/React.createElement("style", null, `@keyframes char-bob { 0%,100%{transform:translateY(0) rotate(-2deg);} 50%{transform:translateY(-4px) rotate(2deg);} }`));
}
window.CHARACTERS = CHARACTERS;
window.Character = Character;
window.Robot = Robot;
window.Avatar = Avatar;

// === dice.jsx ===
// Dice component

function Dice({
  value,
  rolling,
  onClick,
  disabled
}) {
  // Pip layouts for each face (using CSS grid 3x3, 1-indexed coords)
  const faces = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [1, 3], [3, 1], [3, 3]],
    5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
    6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]]
  };

  // For a standard die: opposite faces sum to 7.
  // Face placements on the cube (via translateZ after a pre-rotation):
  //   1 → +Z,  6 → -Z,  2 → +X,  5 → -X,  3 → -Y,  4 → +Y
  // Inner rotation brings the rolled face to +Z (front, facing camera). Combined with the
  // static 3/4-view outer tilt, the rolled value lands on the dominant visible face of the
  // cube — exactly like every dice render on the web.
  const faceRotations = {
    1: {
      x: 0,
      y: 0
    },
    // already at +Z
    6: {
      x: 0,
      y: 180
    },
    // -Z → +Z  via rotY(180)
    2: {
      x: 0,
      y: -90
    },
    // +X → +Z  via rotY(-90)
    5: {
      x: 0,
      y: 90
    },
    // -X → +Z  via rotY(90)
    3: {
      x: -90,
      y: 0
    },
    // -Y → +Z  via rotX(-90)
    4: {
      x: 90,
      y: 0
    } // +Y → +Z  via rotX(90)
  };

  // During roll: accumulate random full rotations for chaos; settle on the correct target for `value`.
  const [rollTick, setRollTick] = React.useState(0);
  // Initial pose = face-1 target (0,0). The static view tilt in the transform string
  // guarantees the first render is already a chunky 3D cube showing face 1 + top + left.
  // z: tumble rotation on cube's own Z axis; squash: landing compression (1=neutral, <1=squashed)
  const [currentRot, setCurrentRot] = React.useState({
    x: 0,
    y: 0,
    z: 0,
    tx: 0,
    ty: 0,
    bounce: 0,
    squash: 1
  });
  const wasRolling = React.useRef(false);

  // The cube's inner rotation brings the rolled face to +Z (front). A static view tilt
  // (rotateX -45°, rotateY +25°) applied on top in the transform string gives every rolled
  // face the same chunky 3D angle — rolled face dominant, top and left neighbors visible.
  // Empirically tuned to match the iconic "rolled dice" Rolling visual.
  const idlePoseFor = v => faceRotations[v] || faceRotations[1];

  // Value is read via a ref so the tumble effect doesn't restart when the parent rapidly
  // cycles `value` during the shuffle. Only `rolling` transitions drive the animation phases.
  const valueRef = React.useRef(value);
  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Mirror of the `rolling` prop. Read inside the physics loop so the spring-home only
  // fires after the inner cube has begun settling to the rolled face — without this
  // the outer dice can return home while the inner is still tumbling, which looks jumpy.
  const rollingRef = React.useRef(rolling);
  React.useEffect(() => {
    rollingRef.current = rolling;
  }, [rolling]);
  React.useEffect(() => {
    let raf;
    if (rolling) {
      wasRolling.current = true;
      // 3D tumble: rotate X and Y with exponential decay. Always preserves the 3D cube.
      const start = performance.now();
      const startRot = currentRot;
      const vx0 = 780 + Math.random() * 160;
      const vy0 = 920 + Math.random() * 180;
      const tau = 0.75;
      let lastT = start;
      let accX = 0,
        accY = 0;
      const tick = now => {
        const dt = Math.min(0.04, (now - lastT) / 1000);
        lastT = now;
        const t = (now - start) / 1000;
        const decay = Math.exp(-t / tau);
        accX += vx0 * decay * dt;
        accY += vy0 * decay * dt;
        const x = startRot.x + accX + Math.sin(t * 11) * 4;
        const y = startRot.y + accY + Math.cos(t * 8) * 5;
        const bounce = Math.max(0, 1 - Math.min(1, t / 1.0)) * 12;
        const tx = Math.sin(t * 14) * 2.2;
        const ty = Math.cos(t * 11) * 1.8;
        setCurrentRot({
          x,
          y,
          z: 0,
          tx,
          ty,
          bounce,
          squash: 1
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else if (wasRolling.current) {
      // Clean landing at the face-up pose so the rolled face ends on +Y (top of cube).
      wasRolling.current = false;
      const idle = idlePoseFor(valueRef.current);
      const from = currentRot;
      // Pick nearest multiples of 360 so the settle ends EXACTLY at the face-rotation for `value`,
      // guaranteeing the face displayed matches the rolled number. No extra axes to confuse alignment.
      const finalX = Math.round((from.x - idle.x) / 360) * 360 + idle.x + 360;
      const finalY = Math.round((from.y - idle.y) / 360) * 360 + idle.y + 360;
      const startTime = performance.now();
      const dur = 900;
      const tick = now => {
        const p = Math.min(1, (now - startTime) / dur);
        const e = 1 - Math.pow(1 - p, 5); // easeOutQuint
        const wobble = p > 0.75 ? Math.sin((p - 0.75) / 0.25 * Math.PI * 2) * 6 * (1 - p) : 0;
        const tableBounce = p > 0.6 ? Math.abs(Math.sin((p - 0.6) / 0.4 * Math.PI * 1.5)) * 7 * (1 - p) * (1 - p) : 0;
        setCurrentRot({
          x: from.x + (finalX - from.x) * e + wobble * 0.5,
          y: from.y + (finalY - from.y) * e + wobble,
          z: 0,
          tx: from.tx * (1 - e),
          ty: from.ty * (1 - e) - tableBounce,
          bounce: tableBounce,
          squash: 1
        });
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      // Initial render (or idle refresh): snap to the target face rotation.
      const idle = idlePoseFor(valueRef.current);
      setCurrentRot({
        x: idle.x,
        y: idle.y,
        z: 0,
        tx: 0,
        ty: 0,
        bounce: 0,
        squash: 1
      });
    }
    return () => raf && cancelAnimationFrame(raf);
  }, [rolling]);

  // Note: we intentionally do NOT snap on value changes. The [rolling]-keyed effect handles
  // all three lifecycle cases (initial mount, tumble start, settle-to-face). Adding a value-keyed
  // snap here would race with the settle animation and clobber its captured `from` state,
  // causing a visible jump at handover.

  const Pip = ({
    r,
    c
  }) => /*#__PURE__*/React.createElement("span", {
    className: "d3-pip",
    style: {
      gridRow: r,
      gridColumn: c
    }
  });

  // Face pairs are tinted so opposite faces (which are never both visible) share a shade,
  // but each of the three visible-at-once faces has a distinct baseline brightness. This is
  // what sells the 3D illusion: three differently-shaded planes read as a real cube, even
  // when gentle tilts + gentle perspective would otherwise flatten into a rounded rhombus.
  //   pair {1,6}: medium (hero face)
  //   pair {2,5}: darker (left/right shade)
  //   pair {3,4}: brighter (top/bottom — catches the most 'light')
  const faceShade = {
    1: 'medium',
    6: 'medium',
    2: 'darker',
    5: 'darker',
    3: 'brighter',
    4: 'brighter'
  };
  const Face = ({
    faceVal,
    transform
  }) => /*#__PURE__*/React.createElement("div", {
    className: `d3-face shade-${faceShade[faceVal]}`,
    style: {
      transform
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "d3-pips"
  }, faces[faceVal].map(([r, c], i) => /*#__PURE__*/React.createElement(Pip, {
    key: i,
    r: r,
    c: c
  }))));

  // ==== Throw gesture + physics simulation ====
  // The dice behaves like a real die rolling on a table: it has velocity, decelerates via
  // friction, bounces off the window edges (walls), eventually rests on a face, stays visible
  // for ~2s so the user can read the result, then returns to its home spot.
  const [drag, setDrag] = React.useState({
    active: false,
    dx: 0,
    dy: 0
  });
  // phys mode: 'idle' | 'flying' | 'resting' | 'returning'
  // height: simulated Z-lift in px (die airborne); derived from current speed during flight
  const [phys, setPhys] = React.useState({
    mode: 'idle',
    x: 0,
    y: 0,
    rotZ: 0,
    height: 0
  });
  const startRef = React.useRef({
    x: 0,
    y: 0
  });
  const lastMoveRef = React.useRef({
    x: 0,
    y: 0,
    t: 0
  });
  const velRef = React.useRef({
    vx: 0,
    vy: 0
  });
  const diceBoxRef = React.useRef({
    cx: 0,
    cy: 0,
    w: 80,
    h: 80
  });
  const physRef = React.useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rotZ: 0,
    vrot: 0,
    running: false,
    lastT: 0,
    startT: 0
  });
  const rafRef = React.useRef(null);
  const restTimerRef = React.useRef(null);
  const returnTimerRef = React.useRef(null);
  const canInteract = !disabled && !rolling && phys.mode === 'idle';
  const cancelTimers = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (restTimerRef.current) clearTimeout(restTimerRef.current);
    if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
    rafRef.current = null;
    restTimerRef.current = null;
    returnTimerRef.current = null;
  };
  React.useEffect(() => () => cancelTimers(), []);

  // Programmatic rolls (AI turn, etc.) roll in place — no toss. Only a user's real drag/flick
  // triggers the physics motion. This keeps the home slot occupied and the dice always visible.

  // Cache the dice element so we can re-measure its rect mid-flight on resize/orientation
  // change (otherwise the bounce-walls calculation uses stale dimensions).
  const diceElRef = React.useRef(null);
  const refreshDiceBox = React.useCallback(() => {
    const el = diceElRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    diceBoxRef.current = {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      w: rect.width,
      h: rect.height
    };
  }, []);
  React.useEffect(() => {
    window.addEventListener('resize', refreshDiceBox);
    window.addEventListener('orientationchange', refreshDiceBox);
    return () => {
      window.removeEventListener('resize', refreshDiceBox);
      window.removeEventListener('orientationchange', refreshDiceBox);
    };
  }, [refreshDiceBox]);

  // If user backgrounds the tab during a throw, the rAF freezes and timers throttle.
  // Cancel pending physics + snap home so the game state is consistent on return.
  React.useEffect(() => {
    const onHide = () => {
      if (document.hidden && physRef.current?.running) {
        cancelTimers();
        physRef.current.running = false;
        setPhys({
          mode: 'idle',
          x: 0,
          y: 0,
          rotZ: 0,
          height: 0
        });
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);
  const onPointerDown = e => {
    if (!canInteract) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    diceElRef.current = e.currentTarget;
    // Capture the dice's initial screen position so we can clamp to viewport while dragging
    const rect = e.currentTarget.getBoundingClientRect();
    diceBoxRef.current = {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      w: rect.width,
      h: rect.height
    };
    startRef.current = {
      x: e.clientX,
      y: e.clientY
    };
    lastMoveRef.current = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now()
    };
    velRef.current = {
      vx: 0,
      vy: 0
    };
    setDrag({
      active: true,
      dx: 0,
      dy: 0
    });
    setPhys({
      mode: 'idle',
      x: 0,
      y: 0,
      rotZ: 0,
      height: 0
    });
  };
  const onPointerMove = e => {
    if (!drag.active) return;
    const rawDx = e.clientX - startRef.current.x;
    const rawDy = e.clientY - startRef.current.y;
    // Clamp so the dice stays inside the viewport while dragging
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const halfW = diceBoxRef.current.w / 2;
    const halfH = diceBoxRef.current.h / 2;
    const {
      cx,
      cy
    } = diceBoxRef.current;
    const pad = 4;
    const minDx = halfW + pad - cx;
    const maxDx = vw - (halfW + pad) - cx;
    const minDy = halfH + pad - cy;
    const maxDy = vh - (halfH + pad) - cy;
    const dx = Math.max(minDx, Math.min(maxDx, rawDx));
    const dy = Math.max(minDy, Math.min(maxDy, rawDy));
    const now = performance.now();
    const dt = Math.max(1, now - lastMoveRef.current.t);
    velRef.current = {
      vx: (e.clientX - lastMoveRef.current.x) * 1000 / dt,
      vy: (e.clientY - lastMoveRef.current.y) * 1000 / dt
    };
    lastMoveRef.current = {
      x: e.clientX,
      y: e.clientY,
      t: now
    };
    setDrag({
      active: true,
      dx,
      dy
    });
  };
  const startPhysics = (initX, initY, vx, vy) => {
    cancelTimers();
    physRef.current = {
      x: initX,
      y: initY,
      vx,
      vy,
      rotZ: 0,
      vrot: (Math.random() - 0.5) * 900 + vx * 0.25,
      // initial spin partly coupled to horizontal fling
      running: true,
      lastT: 0,
      startT: performance.now()
    };
    setPhys({
      mode: 'flying',
      x: initX,
      y: initY,
      rotZ: 0,
      height: 0
    });
    const step = now => {
      const p = physRef.current;
      if (!p.running) return;
      const prev = p.lastT || now;
      const dt = Math.min(0.04, (now - prev) / 1000);
      p.lastT = now;

      // Friction (linear drag): per-second decay factor ~0.35 (so velocity drops to ~35% per second at higher speeds,
      // slowing down until below rest threshold). Using an exp decay keeps it smooth.
      const fric = Math.pow(0.4, dt);
      p.vx *= fric;
      p.vy *= fric;
      p.vrot *= Math.pow(0.55, dt);

      // Integrate
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotZ += p.vrot * dt;

      // Bounce off viewport walls. Re-read the dice's screen position each frame so a
      // mid-throw viewport resize / orientation change doesn't trap the cube off-screen.
      refreshDiceBox();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const {
        cx,
        cy,
        w,
        h
      } = diceBoxRef.current;
      const halfW = w / 2,
        halfH = h / 2,
        pad = 4;
      const minX = halfW + pad - cx;
      const maxX = vw - (halfW + pad) - cx;
      const minY = halfH + pad - cy;
      const maxY = vh - (halfH + pad) - cy;
      const bounceDamp = 0.68;
      let hitWall = false;
      if (p.x < minX) {
        p.x = minX;
        p.vx = Math.abs(p.vx) * bounceDamp;
        p.vrot = -p.vrot * 0.8 + (Math.random() - 0.5) * 200;
        hitWall = true;
      }
      if (p.x > maxX) {
        p.x = maxX;
        p.vx = -Math.abs(p.vx) * bounceDamp;
        p.vrot = -p.vrot * 0.8 + (Math.random() - 0.5) * 200;
        hitWall = true;
      }
      if (p.y < minY) {
        p.y = minY;
        p.vy = Math.abs(p.vy) * bounceDamp;
        p.vrot = -p.vrot * 0.8 + (Math.random() - 0.5) * 200;
        hitWall = true;
      }
      if (p.y > maxY) {
        p.y = maxY;
        p.vy = -Math.abs(p.vy) * bounceDamp;
        p.vrot = -p.vrot * 0.8 + (Math.random() - 0.5) * 200;
        hitWall = true;
      }
      // On wall impact, briefly squash the cube to sell the collision
      if (hitWall) {
        const btn = document.querySelector('.dice3d');
        if (btn) {
          btn.classList.remove('impact');
          void btn.offsetWidth; // force reflow so animation restarts
          btn.classList.add('impact');
        }
      }

      // Height arc: while the die is moving fast it's "in the air"; as it slows it settles down.
      // This sells the Z-depth illusion — cube lifts on fling, shadow expands below it.
      const speed = Math.hypot(p.vx, p.vy);
      const height = Math.min(90, speed * 0.085);
      setPhys({
        mode: 'flying',
        x: p.x,
        y: p.y,
        rotZ: p.rotZ,
        height
      });
      const elapsed = (now - p.startT) / 1000;
      // Settle when the dice is nearly stopped or we hit the physics time limit.
      // Sequence: flying → landing (snap squash) → resting (elastic recover) → returning home.
      if (speed < 22 && elapsed > 0.35 || elapsed > 1.4) {
        p.running = false;
        rafRef.current = null;
        // Snap into a squashed landing pose — transform-transition is disabled in 'landing',
        // so this renders instantly like a real impact compression.
        setPhys({
          mode: 'landing',
          x: p.x,
          y: p.y,
          rotZ: p.rotZ,
          height: 0
        });
        // One frame later, switch to 'resting' — transform transitions back to natural scale
        // via the elastic easing curve on .d3-throw, producing a springy bounce-back.
        restTimerRef.current = setTimeout(() => {
          setPhys({
            mode: 'resting',
            x: p.x,
            y: p.y,
            rotZ: p.rotZ,
            height: 0
          });
          // Hold at the landed spot until the inner cube has actually settled to the rolled
          // face. Spring-home only fires AFTER `rolling` flips false (which kicks off the
          // 900ms inner face-settle), plus a read window so the user clearly sees the
          // rolled value on the resting die before it travels home.
          const holdAtLanded = () => {
            if (rollingRef.current) {
              returnTimerRef.current = setTimeout(holdAtLanded, 80);
              return;
            }
            returnTimerRef.current = setTimeout(() => {
              setPhys({
                mode: 'returning',
                x: 0,
                y: 0,
                rotZ: 0,
                height: 0
              });
              // Track this final settle so cancelTimers() can clear it on unmount.
              returnTimerRef.current = setTimeout(() => {
                setPhys({
                  mode: 'idle',
                  x: 0,
                  y: 0,
                  rotZ: 0,
                  height: 0
                });
              }, 520);
            }, 1000);
          };
          returnTimerRef.current = setTimeout(holdAtLanded, 360);
        }, 16);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };
  const endDrag = didRelease => {
    const {
      dx,
      dy
    } = drag;
    const dist = Math.hypot(dx, dy);
    const {
      vx,
      vy
    } = velRef.current;
    const speed = Math.hypot(vx, vy);
    setDrag({
      active: false,
      dx: 0,
      dy: 0
    });
    if (!didRelease || !canInteract) return;

    // TAP — user just clicked/pressed, didn't drag or flick. Roll in place, no physics movement.
    // The inner cube will tumble-and-settle on the face via the rolling→false transition.
    const isTap = dist < 8 && speed < 200;
    if (isTap) {
      onClick?.();
      return;
    }

    // THROW — user dragged and/or flicked. Use real physics to toss the dice across the screen.
    let launchVx, launchVy;
    if (speed > 200) {
      // Real flick: use measured velocity directly
      launchVx = vx;
      launchVy = vy;
    } else {
      // Held-and-released: fling in drag direction with distance-derived magnitude
      const mag = Math.max(600, dist * 14);
      launchVx = dx / dist * mag;
      launchVy = dy / dist * mag;
    }
    startPhysics(dx, dy, launchVx, launchVy);
    onClick?.();
  };
  const onPointerUp = () => endDrag(true);
  const onPointerCancel = () => endDrag(false);

  // Ground shadow: bigger + softer + dimmer while airborne, tight + dark when planted.
  // Responds to both tumble bounce and physics flight height for a unified "weight on ground" feel.
  const airborne = phys.mode === 'flying' ? phys.height : 0;
  const shadowScale = 1 + currentRot.bounce / 40 + airborne / 55;
  const shadowOpacity = Math.max(0.08, 0.5 - currentRot.bounce / 50 - airborne / 160);
  const shadowBlur = 3 + airborne / 18;

  // Compose outer transform from drag / physics / resting / returning.
  // IMPORTANT: during physics we intentionally use translate ONLY. 2D rotation on the outer
  // wrapper flattens the perspective illusion — the dice must stay a clean 3D object at all
  // times. All visible rotation comes from the inner .d3-cube's rotateX/rotateY (true 3D).
  let outerTransform, outerTransition;
  if (drag.active) {
    // Lifting the die: subtle scale-up only, no 2D rotation (preserves 3D perspective).
    outerTransform = `translate(${drag.dx}px, ${drag.dy}px) scale(1.05)`;
    outerTransition = 'transform 60ms linear';
  } else if (phys.mode === 'flying') {
    // translateY minus height simulates Z-lift (die airborne); scale grows slightly with height
    // so it reads as "closer to camera" — a real thrown die looks bigger at apex.
    const liftScale = 1 + phys.height / 600;
    outerTransform = `translate(${phys.x}px, ${phys.y - phys.height}px) scale(${liftScale})`;
    outerTransition = 'none';
  } else if (phys.mode === 'landing') {
    // Impact frame: non-uniform squash (wider + shorter) simulates the die compressing against
    // the surface. Rendered with transition:none so the squash snaps in like a real hit.
    outerTransform = `translate(${phys.x}px, ${phys.y}px) scale(1.18, 0.82)`;
    outerTransition = 'none';
  } else if (phys.mode === 'resting') {
    // Spring back to natural scale with an elastic overshoot — the die bounces back upright.
    outerTransform = `translate(${phys.x}px, ${phys.y}px) scale(1, 1)`;
    outerTransition = 'transform 360ms cubic-bezier(.25, 1.7, .35, 1)';
  } else if (phys.mode === 'returning') {
    outerTransform = `translate(0, 0) scale(1)`;
    outerTransition = 'transform 520ms cubic-bezier(.34,1.26,.64,1)';
  } else {
    outerTransform = 'translate(0, 0) scale(1)';
    outerTransition = 'transform 380ms cubic-bezier(.34,1.56,.64,1)';
  }
  return /*#__PURE__*/React.createElement("button", {
    className: `dice3d ${rolling ? 'rolling' : ''} ${drag.active ? 'grabbing' : ''} ${phys.mode !== 'idle' ? 'physics' : ''} ${phys.mode === 'resting' ? 'resting' : ''}`,
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: onPointerUp,
    onPointerCancel: onPointerCancel,
    onContextMenu: e => e.preventDefault(),
    onClick: e => {
      // Only honor keyboard-initiated clicks (Enter/Space) — pointer "click" events fire
      // after a pointerup that endDrag() already handled. detail===0 marks a true keyboard click.
      if (e.detail === 0 && canInteract) onClick?.();
    },
    onKeyDown: e => {
      if ((e.key === 'Enter' || e.key === ' ') && canInteract) {
        e.preventDefault();
        onClick?.();
      }
    },
    disabled: disabled,
    "aria-label": `Roll the dice. Currently showing ${value}. Press Enter or Space to roll, or drag to fling.`
  }, /*#__PURE__*/React.createElement("div", {
    className: "d3-scene"
  }, /*#__PURE__*/React.createElement("div", {
    className: "d3-throw",
    style: {
      transform: outerTransform,
      transition: outerTransition
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "d3-cube",
    style: {
      // Compound rotation: inner cube rotation brings the rolled face to +Z (front),
      // then a STATIC gentle 3/4-view tilt (-22°X, +22°Y) is applied on top so every
      // rolled value lands at the same chunky 3D angle with the rolled face dominant
      // and neighbors (top + right) visible as slim strips — the classic 3D die look.
      transform: `translate3d(${currentRot.tx}px, ${currentRot.ty - currentRot.bounce}px, 0) rotateX(-22deg) rotateY(22deg) rotateX(${currentRot.x}deg) rotateY(${currentRot.y}deg)`
    }
  }, /*#__PURE__*/React.createElement(Face, {
    faceVal: 1,
    transform: "translateZ(var(--half))"
  }), /*#__PURE__*/React.createElement(Face, {
    faceVal: 6,
    transform: "rotateY(180deg) translateZ(var(--half))"
  }), /*#__PURE__*/React.createElement(Face, {
    faceVal: 2,
    transform: "rotateY(90deg) translateZ(var(--half))"
  }), /*#__PURE__*/React.createElement(Face, {
    faceVal: 5,
    transform: "rotateY(-90deg) translateZ(var(--half))"
  }), /*#__PURE__*/React.createElement(Face, {
    faceVal: 3,
    transform: "rotateX(90deg) translateZ(var(--half))"
  }), /*#__PURE__*/React.createElement(Face, {
    faceVal: 4,
    transform: "rotateX(-90deg) translateZ(var(--half))"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "d3-shadow",
    style: {
      transform: `translateX(-50%) scale(${shadowScale})`,
      opacity: shadowOpacity,
      filter: `blur(${shadowBlur}px)`
    }
  })), /*#__PURE__*/React.createElement("style", null, `
        .dice3d {
          width: 100%;
          aspect-ratio: 1/1;
          background: transparent;
          border: none;
          padding: 0;
          cursor: grab;
          position: relative;
          --size: 105px;
          --half: 52.5px;
          touch-action: none;
          -webkit-user-select: none;
          user-select: none;
        }
        .dice3d.grabbing { cursor: grabbing; }
        .dice3d.physics, .dice3d.grabbing { z-index: 1000; }
        /* CRITICAL: filters must live on .dice3d (transform-style: flat), NOT on .d3-cube.
           CSS filters on a preserve-3d element flatten its 3D subtree — the cube collapses
           into a 2D lens-shape. Apply filter to the flat button wrapper so it composites the
           already-rendered 3D cube as a 2D layer. */
        .dice3d.resting { filter: drop-shadow(0 10px 22px rgba(0,0,0,0.35)) brightness(1.02); }
        .dice3d.impact { animation: cube-impact-flash 180ms ease-out; }
        @keyframes cube-impact-flash {
          0% { filter: brightness(1) drop-shadow(0 4px 8px rgba(0,0,0,0.2)); }
          30% { filter: brightness(1.18) drop-shadow(0 8px 16px rgba(232,178,62,0.55)) drop-shadow(0 0 8px rgba(255,255,255,0.6)); }
          100% { filter: brightness(1) drop-shadow(0 4px 8px rgba(0,0,0,0.2)); }
        }
        .dice3d:disabled { cursor: not-allowed; opacity: 0.75; }
        .dice3d:not(:disabled):not(.rolling):not(.grabbing):not(.physics):not(.impact) {
          animation: dice-illuminate 2.6s ease-in-out infinite;
        }
        @keyframes dice-illuminate {
          0%, 100% {
            filter:
              drop-shadow(0 8px 14px rgba(0,0,0,0.24))
              drop-shadow(0 0 14px rgba(232,178,62,0.28))
              brightness(1.04);
          }
          50% {
            filter:
              drop-shadow(0 10px 20px rgba(0,0,0,0.28))
              drop-shadow(0 0 22px rgba(232,178,62,0.55))
              brightness(1.08);
          }
        }
        .dice3d.rolling, .dice3d.physics {
          filter: drop-shadow(0 10px 18px rgba(0,0,0,0.3)) brightness(1.02);
        }
        .dice3d:hover:not(:disabled) {
          filter:
            drop-shadow(0 10px 22px rgba(0,0,0,0.32))
            drop-shadow(0 0 24px rgba(232,178,62,0.7))
            brightness(1.12);
        }
        .dice3d.grabbing {
          filter:
            drop-shadow(0 12px 26px rgba(0,0,0,0.35))
            drop-shadow(0 0 28px rgba(232,88,62,0.65))
            brightness(1.14);
        }
        .d3-throw {
          position: absolute;
          inset: 0;
          display: flex; align-items: center; justify-content: center;
          transform-style: preserve-3d;
          will-change: transform;
        }
        .d3-scene {
          position: absolute;
          inset: 0;
          /* Perspective ≈5× cube size gives a pleasant chunky 3D look without heavy distortion.
             preserve-3d is required so the cube's faces render in true 3D (otherwise nested
             transform-style: flat collapses the cube into a thin projected rhombus). */
          perspective: 800px;
          perspective-origin: 50% 50%;
          transform-style: preserve-3d;
          display: flex; align-items: center; justify-content: center;
        }
        .d3-cube {
          position: relative;
          width: var(--size);
          height: var(--size);
          transform-style: preserve-3d;
          will-change: transform;
        }
        .d3-face {
          position: absolute;
          inset: 0;
          width: var(--size);
          height: var(--size);
          border-radius: 20%;
          /* Strong beveled edges — dark outer rim + bright inner highlight makes each face
             read as a distinct plane with a pronounced corner where it meets its neighbor.
             Critical for 3D read: without this, adjacent faces visible at similar angles
             blur into one flat surface. */
          box-shadow:
            inset 0 0 0 2px rgba(70,45,15,0.70),
            inset 0 0 0 4px rgba(255,250,235,0.95),
            inset 0 -12px 22px rgba(110,75,30,0.55),
            inset 10px 0 20px rgba(110,75,30,0.32),
            inset -10px 0 20px rgba(110,75,30,0.32),
            inset 0 8px 14px rgba(255,252,240,0.95);
          backface-visibility: hidden;
          padding: 11%;
        }
        /* Face shading by pair — opposite faces share a tint, but the three faces visible at
           any moment always have three distinct brightnesses. This differential shading is the
           single biggest 3D cue: without it the cube reads as a flat rounded rhombus. */
        .d3-face.shade-brighter {
          background:
            radial-gradient(ellipse at 28% 22%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 42%),
            linear-gradient(155deg, #ffffff 0%, #fcf6e4 55%, #ede1bf 100%);
        }
        .d3-face.shade-medium {
          background:
            radial-gradient(ellipse at 28% 22%, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0) 40%),
            linear-gradient(155deg, #fcf7e6 0%, #eee1c0 60%, #d4c39a 100%);
        }
        .d3-face.shade-darker {
          background:
            radial-gradient(ellipse at 28% 22%, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 38%),
            linear-gradient(155deg, #eee1c0 0%, #d9c99f 60%, #b9a578 100%);
        }
        .d3-pips {
          width: 100%;
          height: 100%;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(3, 1fr);
          place-items: center;
        }
        .d3-pip {
          width: 72%;
          aspect-ratio: 1/1;
          border-radius: 50%;
          /* Drilled-pip look: dark sphere with subtle blue-grey top highlight so pips read as
             recessed wells, not painted dots. */
          background: radial-gradient(circle at 38% 32%, #5a6682 0%, #1c2130 55%, #0a0d17 100%);
          box-shadow:
            inset 0 -2px 3px rgba(255,255,255,0.14),
            inset 0 3px 5px rgba(0,0,0,0.6),
            0 0.5px 1px rgba(255,250,235,0.85);
        }
        .d3-shadow {
          position: absolute;
          bottom: 4%;
          left: 50%;
          width: 72%;
          height: 10%;
          background: radial-gradient(ellipse at center, rgba(26,31,46,0.55) 0%, rgba(26,31,46,0) 70%);
          filter: blur(3px);
          pointer-events: none;
          transition: opacity 0.1s;
        }
      `));
}
window.Dice = Dice;

// === modeselect.jsx ===
// Mode selection screen

const PLAYER_COLORS = ['#e8583e', '#2a8a5f', '#e8b23e', '#5b6cff', '#a855a0', '#ff8a3d', '#6d4a2e', '#1ac0c6'];
const DEFAULT_NAMES = ['Ruby', 'Sage', 'Sunny', 'Indie', 'Mauve', 'Ember', 'Coco', 'Aqua'];
function ModeSelect({
  onStart
}) {
  const [mode, setMode] = React.useState(null); // 'multi' | 'ai'
  const [humanCount, setHumanCount] = React.useState(2);
  const [aiDifficulty, setAiDifficulty] = React.useState('normal');
  const [playerName, setPlayerName] = React.useState('You');
  const [names, setNames] = React.useState([...DEFAULT_NAMES]);
  // one character per slot; default to first N distinct
  const [chars, setChars] = React.useState(CHARACTERS.slice(0, 8).map(c => c.id));
  const [myChar, setMyChar] = React.useState(CHARACTERS[0].id);
  const colorFor = cid => (CHARACTERS.find(c => c.id === cid) || CHARACTERS[0]).color;
  const start = () => {
    if (mode === 'ai') {
      onStart({
        players: [{
          id: 'p0',
          name: playerName || 'You',
          label: (playerName || 'Y')[0].toUpperCase(),
          color: colorFor(myChar),
          charId: myChar,
          isAI: false
        }, {
          id: 'ai',
          name: 'BLIP',
          label: 'AI',
          color: '#1a1f2e',
          charId: null,
          isAI: true
        }],
        aiDifficulty
      });
    } else {
      const players = Array.from({
        length: humanCount
      }, (_, i) => ({
        id: 'p' + i,
        name: names[i] || `Player ${i + 1}`,
        label: (names[i] || `P${i + 1}`)[0].toUpperCase(),
        color: colorFor(chars[i]),
        charId: chars[i],
        isAI: false
      }));
      onStart({
        players
      });
    }
  };
  const setCharAt = (idx, newCid) => {
    setChars(prev => {
      const next = [...prev];
      // if another slot already has this char, swap
      const dupIdx = next.indexOf(newCid);
      if (dupIdx !== -1 && dupIdx !== idx) next[dupIdx] = next[idx];
      next[idx] = newCid;
      return next;
    });
  };
  const cycleChar = (idx, dir) => {
    const cur = chars[idx];
    const i = CHARACTERS.findIndex(c => c.id === cur);
    const n = (i + dir + CHARACTERS.length) % CHARACTERS.length;
    setCharAt(idx, CHARACTERS[n].id);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "ms-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ms-inner"
  }, /*#__PURE__*/React.createElement("header", {
    className: "ms-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ms-eyebrow mono"
  }, "01 \u2014 NEW GAME"), /*#__PURE__*/React.createElement("h1", {
    className: "ms-title serif"
  }, "Climb ", /*#__PURE__*/React.createElement("span", {
    className: "climb"
  }, "\u2191"), /*#__PURE__*/React.createElement("br", null), "& Slide ", /*#__PURE__*/React.createElement("span", {
    className: "slide"
  }, "\u2193")), /*#__PURE__*/React.createElement("p", {
    className: "ms-sub"
  }, "A modern take on a classic race. Roll dice, ride ladders, dodge chutes. First to 100 wins.")), !mode && /*#__PURE__*/React.createElement("div", {
    className: "ms-modes"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ms-mode-card",
    onClick: () => setMode('multi')
  }, /*#__PURE__*/React.createElement("div", {
    className: "ms-mode-icon"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stack"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      background: '#e8583e'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      background: '#2a8a5f'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      background: '#e8b23e'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      background: '#5b6cff'
    }
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ms-mode-title serif"
  }, "Pass & Play"), /*#__PURE__*/React.createElement("div", {
    className: "ms-mode-desc"
  }, "2\u20138 humans on one device")), /*#__PURE__*/React.createElement("div", {
    className: "ms-mode-arrow"
  }, "\u2192")), /*#__PURE__*/React.createElement("button", {
    className: "ms-mode-card",
    onClick: () => setMode('ai')
  }, /*#__PURE__*/React.createElement("div", {
    className: "ms-mode-icon"
  }, /*#__PURE__*/React.createElement(Robot, {
    size: 64,
    color: "#1a1f2e",
    mood: "happy"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ms-mode-title serif"
  }, "Play BLIP"), /*#__PURE__*/React.createElement("div", {
    className: "ms-mode-desc"
  }, "You vs. our friendly robot")), /*#__PURE__*/React.createElement("div", {
    className: "ms-mode-arrow"
  }, "\u2192"))), mode === 'multi' && /*#__PURE__*/React.createElement("div", {
    className: "ms-config"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ms-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "mono"
  }, "HOW MANY PLAYERS"), /*#__PURE__*/React.createElement("div", {
    className: "ms-chips"
  }, [2, 3, 4, 5, 6, 7, 8].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    className: `chip ${humanCount === n ? 'active' : ''}`,
    onClick: () => setHumanCount(n)
  }, n)))), /*#__PURE__*/React.createElement("div", {
    className: "ms-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "mono"
  }, "PLAYERS & CHARACTERS"), /*#__PURE__*/React.createElement("div", {
    className: "ms-players"
  }, Array.from({
    length: humanCount
  }).map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "ms-player-row setup-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "char-picker"
  }, /*#__PURE__*/React.createElement("button", {
    className: "cp-arrow",
    onClick: () => cycleChar(i, -1),
    "aria-label": "Previous"
  }, "\u2039"), /*#__PURE__*/React.createElement("div", {
    className: "cp-stage",
    style: {
      background: colorFor(chars[i]) + '22'
    }
  }, /*#__PURE__*/React.createElement(Character, {
    charId: chars[i],
    size: 56,
    spin: true
  })), /*#__PURE__*/React.createElement("button", {
    className: "cp-arrow",
    onClick: () => cycleChar(i, 1),
    "aria-label": "Next"
  }, "\u203A")), /*#__PURE__*/React.createElement("div", {
    className: "setup-right"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: `Player ${i + 1}`,
    "aria-label": `Name for player ${i + 1}`,
    value: names[i],
    maxLength: 10,
    onChange: e => {
      const next = [...names];
      next[i] = e.target.value;
      setNames(next);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "char-name mono"
  }, (CHARACTERS.find(c => c.id === chars[i]) || {}).name?.toUpperCase())))))), /*#__PURE__*/React.createElement("div", {
    className: "ms-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: () => setMode(null)
  }, "\u2190 Back"), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: start
  }, "Start game \u2192"))), mode === 'ai' && /*#__PURE__*/React.createElement("div", {
    className: "ms-config"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ms-ai-card"
  }, /*#__PURE__*/React.createElement(Robot, {
    size: 96,
    color: "#1a1f2e",
    mood: "happy"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ms-ai-name serif"
  }, "BLIP"), /*#__PURE__*/React.createElement("div", {
    className: "ms-ai-tagline mono"
  }, "// a friendly rolling bot"), /*#__PURE__*/React.createElement("div", {
    className: "ms-ai-quote"
  }, "\"Beep boop \u2014 may the best climber win! I promise to cheer when you dodge a chute.\""))), /*#__PURE__*/React.createElement("div", {
    className: "ms-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "mono"
  }, "YOUR NAME & CHARACTER"), /*#__PURE__*/React.createElement("div", {
    className: "ai-name-row"
  }, /*#__PURE__*/React.createElement("input", {
    className: "ms-name-input",
    type: "text",
    "aria-label": "Your display name",
    value: playerName,
    maxLength: 12,
    onChange: e => setPlayerName(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "char-gallery"
  }, CHARACTERS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    className: `char-tile ${myChar === c.id ? 'active' : ''}`,
    onClick: () => setMyChar(c.id),
    style: {
      '--ccolor': c.color
    }
  }, /*#__PURE__*/React.createElement(Character, {
    charId: c.id,
    size: 56,
    spin: myChar === c.id
  }), /*#__PURE__*/React.createElement("div", {
    className: "char-tile-name mono"
  }, c.name))))), /*#__PURE__*/React.createElement("div", {
    className: "ms-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "mono"
  }, "BLIP'S PERSONALITY"), /*#__PURE__*/React.createElement("div", {
    className: "ms-chips"
  }, [{
    id: 'easy',
    label: 'Friendly',
    desc: 'rolls slower, chats more'
  }, {
    id: 'normal',
    label: 'Balanced',
    desc: 'a fair match'
  }, {
    id: 'hard',
    label: 'Sharp',
    desc: 'rolls quick, talks trash'
  }].map(d => /*#__PURE__*/React.createElement("button", {
    key: d.id,
    className: `chip wide ${aiDifficulty === d.id ? 'active' : ''}`,
    onClick: () => setAiDifficulty(d.id)
  }, /*#__PURE__*/React.createElement("span", null, d.label), /*#__PURE__*/React.createElement("span", {
    className: "chip-desc"
  }, d.desc))))), /*#__PURE__*/React.createElement("div", {
    className: "ms-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: () => setMode(null)
  }, "\u2190 Back"), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: start
  }, "Start game \u2192"))), /*#__PURE__*/React.createElement("footer", {
    className: "ms-footer mono"
  }, /*#__PURE__*/React.createElement("span", null, "EST. 2026"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "100 SQUARES"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "10 CHUTES"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "8 LADDERS")), /*#__PURE__*/React.createElement("a", {
    className: "kofi-btn",
    href: "https://ko-fi.com/mikeyalessandro",
    target: "_blank",
    rel: "noopener noreferrer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kofi-heart"
  }, "\u2665"), /*#__PURE__*/React.createElement("span", null, "Enjoying the game? Buy me a coffee"))), /*#__PURE__*/React.createElement("style", null, `
        .ms-wrap {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          overflow-y: auto;
        }
        .ms-inner {
          width: 100%;
          max-width: 640px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .ms-header { display: flex; flex-direction: column; gap: 12px; }
        .ms-eyebrow {
          font-size: 12px;
          letter-spacing: 0.15em;
          color: var(--mute);
        }
        .ms-title {
          font-size: clamp(48px, 8vw, 86px);
          line-height: 0.9;
          font-weight: 700;
          letter-spacing: -0.04em;
        }
        .ms-title .climb { color: var(--accent-2); display: inline-block; transform: translateY(-4px); }
        .ms-title .slide { color: var(--accent); display: inline-block; transform: translateY(4px); }
        .ms-sub {
          font-size: 16px;
          color: var(--ink-2);
          max-width: 440px;
          line-height: 1.5;
        }
        .ms-modes {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ms-mode-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px 24px;
          background: white;
          border: 1px solid rgba(26,31,46,0.08);
          border-radius: 16px;
          text-align: left;
          transition: all 0.2s;
          box-shadow: 0 1px 0 rgba(26,31,46,0.03), 0 4px 12px -6px rgba(26,31,46,0.08);
        }
        .ms-mode-card:hover {
          transform: translateY(-2px);
          border-color: var(--ink);
          box-shadow: 0 4px 0 rgba(26,31,46,0.08), 0 8px 20px -6px rgba(26,31,46,0.2);
        }
        .ms-mode-icon {
          width: 72px;
          height: 72px;
          border-radius: 14px;
          background: var(--bg-2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ms-mode-title { font-size: 22px; font-weight: 700; }
        .ms-mode-desc { color: var(--mute); font-size: 14px; margin-top: 2px; }
        .ms-mode-arrow {
          margin-left: auto;
          font-size: 22px;
          color: var(--mute);
          transition: transform 0.2s;
        }
        .ms-mode-card:hover .ms-mode-arrow {
          transform: translateX(4px);
          color: var(--ink);
        }
        .stack {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3px;
          width: 40px; height: 40px;
        }
        .stack span {
          border-radius: 50%;
          box-shadow: inset 0 2px 2px rgba(255,255,255,0.4), inset 0 -2px 2px rgba(0,0,0,0.15);
        }
        .ms-config {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 28px;
          background: white;
          border-radius: 20px;
          border: 1px solid rgba(26,31,46,0.08);
        }
        .ms-field { display: flex; flex-direction: column; gap: 10px; }
        .ms-field label {
          font-size: 11px;
          letter-spacing: 0.15em;
          color: var(--mute);
        }
        .ms-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .chip {
          padding: 10px 16px;
          border-radius: 10px;
          background: var(--bg-2);
          color: var(--ink);
          font-weight: 600;
          font-size: 15px;
          transition: all 0.15s;
          border: 1.5px solid transparent;
        }
        .chip:hover { background: #e0d6bf; }
        .chip.active {
          background: var(--ink);
          color: var(--bg);
          border-color: var(--ink);
        }
        .chip.wide {
          flex: 1;
          min-width: 140px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 12px 14px;
          gap: 4px;
          text-align: left;
        }
        .chip-desc { font-weight: 400; font-size: 11px; opacity: 0.65; font-family: 'Geist Mono', monospace; letter-spacing: 0.02em; }
        .ms-players { display: flex; flex-direction: column; gap: 8px; }
        .setup-row {
          padding: 10px !important;
          gap: 14px !important;
        }
        .char-picker {
          display: flex; align-items: center; gap: 4px;
          flex-shrink: 0;
        }
        .cp-arrow {
          width: 24px; height: 24px;
          border-radius: 50%;
          background: rgba(0,0,0,0.06);
          color: var(--ink);
          font-size: 18px;
          font-weight: 600;
          display: flex; align-items: center; justify-content: center;
          line-height: 1;
        }
        .cp-arrow:hover { background: var(--ink); color: var(--bg); }
        .cp-stage {
          width: 64px; height: 64px;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.3s;
        }
        .setup-right { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .char-name { font-size: 10px; letter-spacing: 0.15em; color: var(--mute); }
        .char-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
          gap: 8px;
          margin-top: 10px;
        }
        .char-tile {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 12px 6px 8px;
          background: var(--bg-2);
          border: 1.5px solid transparent;
          border-radius: 12px;
          transition: all 0.15s;
        }
        .char-tile:hover { background: #d8ccaf; transform: translateY(-1px); }
        .char-tile.active {
          background: color-mix(in oklab, var(--ccolor) 20%, white);
          border-color: var(--ccolor);
        }
        .char-tile-name {
          font-size: 10px;
          letter-spacing: 0.1em;
          color: var(--ink-2);
          font-weight: 500;
        }
        .ms-player-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px 8px 8px;
          background: var(--bg-2);
          border-radius: 12px;
        }
        .ms-player-row input, .ms-name-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font: inherit;
          font-size: 15px;
          font-weight: 600;
          color: var(--ink);
          padding: 4px 0;
        }
        .ms-name-input {
          padding: 12px 14px;
          background: var(--bg-2);
          border-radius: 10px;
        }
        .ms-ai-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px;
          background: linear-gradient(135deg, #f7f1e4, #eae3d4);
          border-radius: 16px;
        }
        .ms-ai-name { font-size: 26px; font-weight: 700; }
        .ms-ai-tagline { font-size: 11px; color: var(--mute); letter-spacing: 0.1em; margin-top: 2px; }
        .ms-ai-quote {
          margin-top: 10px;
          font-style: italic;
          font-size: 14px;
          color: var(--ink-2);
          line-height: 1.4;
          border-left: 2px solid var(--ink);
          padding-left: 10px;
        }
        .ms-actions {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 4px;
        }
        .btn {
          padding: 14px 20px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.15s;
        }
        .btn.ghost { color: var(--mute); }
        .btn.ghost:hover { color: var(--ink); }
        .btn.primary {
          background: var(--ink);
          color: var(--bg);
          padding: 14px 24px;
          box-shadow: 0 2px 0 rgba(0,0,0,0.2);
        }
        .btn.primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 0 rgba(0,0,0,0.2);
        }
        .btn.primary:active {
          transform: translateY(1px);
          box-shadow: 0 0 0 rgba(0,0,0,0.2);
        }
        .ms-footer {
          display: flex;
          justify-content: center;
          gap: 10px;
          font-size: 10px;
          letter-spacing: 0.12em;
          color: var(--mute);
        }
        .kofi-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          align-self: center;
          padding: 10px 16px;
          border-radius: 999px;
          background: #ff5e5b;
          color: white;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 2px 0 rgba(0,0,0,0.15), 0 6px 14px -6px rgba(255,94,91,0.5);
          transition: transform 0.15s, box-shadow 0.15s;
          margin-top: -18px;
        }
        .kofi-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 0 rgba(0,0,0,0.15), 0 10px 20px -6px rgba(255,94,91,0.6);
        }
        .kofi-heart {
          display: inline-block;
          animation: kofi-heart 1.4s ease-in-out infinite;
        }
        @keyframes kofi-heart {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.25); }
          50% { transform: scale(1); }
          75% { transform: scale(1.15); }
        }
      `));
}
window.ModeSelect = ModeSelect;
window.PLAYER_COLORS = PLAYER_COLORS;

// === app.jsx ===
// Main game app — state machine + layout

const {
  useState,
  useEffect,
  useRef,
  useCallback
} = React;
const BLIP_LINES = {
  start: ["Beep! Let's roll.", "Oh boy, a new race!", "I've been practicing. Maybe.", "May the best bot win. (That's me.)"],
  goodRoll: ["Nice one!", "Ooooh, six!", "That's the spirit!", "Big numbers!", "You're on fire.", "Not bad, human."],
  badRoll: ["Just a one? Oof.", "Tough break.", "Rolled a two myself last time.", "The dice are fickle."],
  ladder: ["UP you go! 🪜", "Ladder! Lucky.", "Smooth climb.", "Zoom zoom, to the top."],
  chute: ["Wheeeeeee—down!", "Oh no, a slide!", "Gravity wins this round.", "I've been there. Literally."],
  myTurn: ["My turn. *clicks*", "Computing optimal trajectory…", "Rolling…", "Here goes my best shot.", "Bip bop, let's go."],
  myLadder: ["HA! A ladder for me!", "Up I go!", "My circuits are tingling."],
  myChute: ["Oof. Recalculating.", "A chute? Rude.", "I regret everything."],
  win: ["GG! I won 🎉", "Beep boop, victory!", "Don't be sad — rematch?"],
  lose: ["You got me!", "Well played, human.", "Rematch! Rematch!", "Impressive."],
  near: ["You're almost there...", "One good roll from winning!", "I see you creeping up."]
};
function randLine(key) {
  const arr = BLIP_LINES[key];
  return arr[Math.floor(Math.random() * arr.length)];
}
function App() {
  const [screen, setScreen] = useState('menu'); // menu | play | win
  const [config, setConfig] = useState(null);

  // ============== TWEAKABLE DEFAULTS ==============
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "gameSpeed": 0.9,
    "exactLanding": true,
    "showHintArrows": true,
    "confettiDensity": 60,
    "accentColor": "#e8583e",
    "boardBgMode": "cream",
    "showBlipPanel": true,
    "showActivityLog": true,
    "boardScale": 1,
    "diceShuffleMs": 350,
    "tokenStepMs": 240,
    "instantRolls": false,
    "showGlidePath": false,
    "rollButtonLabel": "Tap the dice to roll"
  } /*EDITMODE-END*/;
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [tweakPanelOpen, setTweakPanelOpen] = useState(false);
  const updateTweak = (key, val) => {
    setTweaks(t => ({
      ...t,
      [key]: val
    }));
    try {
      window.parent.postMessage({
        type: '__edit_mode_set_keys',
        edits: {
          [key]: val
        }
      }, '*');
    } catch (e) {}
  };
  useEffect(() => {
    const onMsg = e => {
      const d = e.data || {};
      if (d.type === '__activate_edit_mode') setTweakPanelOpen(true);
      if (d.type === '__deactivate_edit_mode') setTweakPanelOpen(false);
    };
    window.addEventListener('message', onMsg);
    // announce AFTER listener is attached
    try {
      window.parent.postMessage({
        type: '__edit_mode_available'
      }, '*');
    } catch (e) {}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Apply accent color as CSS var
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', tweaks.accentColor);
  }, [tweaks.accentColor]);
  const handleStart = cfg => {
    setConfig(cfg);
    setScreen('play');
  };
  const handleQuit = () => {
    setScreen('menu');
    setConfig(null);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, screen === 'menu' && /*#__PURE__*/React.createElement(ModeSelect, {
    onStart: handleStart
  }), screen === 'play' && /*#__PURE__*/React.createElement(Game, {
    config: config,
    onQuit: handleQuit,
    tweaks: tweaks,
    setTweaks: setTweaks
  }), tweakPanelOpen && /*#__PURE__*/React.createElement(TweaksPanel, {
    tweaks: tweaks,
    onChange: updateTweak,
    onClose: () => setTweakPanelOpen(false),
    onReset: () => setTweaks(TWEAK_DEFAULTS)
  }));
}
function TweaksPanel({
  tweaks,
  onChange,
  onClose,
  onReset
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "tweaks-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tw-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tw-title serif"
  }, "Tweaks"), /*#__PURE__*/React.createElement("button", {
    className: "tw-close",
    onClick: onClose,
    "aria-label": "Close"
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "tw-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tw-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tw-group-label mono"
  }, "PACE"), /*#__PURE__*/React.createElement(TwRow, {
    label: "Game speed"
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.3",
    max: "3",
    step: "0.1",
    value: tweaks.gameSpeed,
    onChange: e => onChange('gameSpeed', parseFloat(e.target.value))
  }), /*#__PURE__*/React.createElement("span", {
    className: "tw-val mono"
  }, tweaks.gameSpeed.toFixed(1), "\xD7")), /*#__PURE__*/React.createElement(TwRow, {
    label: "Dice shuffle (ms)"
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "2000",
    step: "50",
    value: tweaks.diceShuffleMs,
    onChange: e => onChange('diceShuffleMs', parseInt(e.target.value))
  }), /*#__PURE__*/React.createElement("span", {
    className: "tw-val mono"
  }, tweaks.diceShuffleMs)), /*#__PURE__*/React.createElement(TwToggle, {
    label: "Instant rolls (no shuffle)",
    value: tweaks.instantRolls,
    onChange: v => onChange('instantRolls', v)
  })), /*#__PURE__*/React.createElement("div", {
    className: "tw-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tw-group-label mono"
  }, "RULES"), /*#__PURE__*/React.createElement(TwToggle, {
    label: "Must land exactly on 100",
    value: tweaks.exactLanding,
    onChange: v => onChange('exactLanding', v)
  })), /*#__PURE__*/React.createElement("div", {
    className: "tw-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tw-group-label mono"
  }, "BOARD"), /*#__PURE__*/React.createElement(TwRow, {
    label: "Theme"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tw-seg"
  }, ['dark', 'light', 'cream'].map(v => /*#__PURE__*/React.createElement("button", {
    key: v,
    className: `tw-seg-btn ${tweaks.boardBgMode === v ? 'active' : ''}`,
    onClick: () => onChange('boardBgMode', v)
  }, v)))), /*#__PURE__*/React.createElement(TwRow, {
    label: "Board scale"
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0.7",
    max: "1.15",
    step: "0.01",
    value: tweaks.boardScale,
    onChange: e => onChange('boardScale', parseFloat(e.target.value))
  }), /*#__PURE__*/React.createElement("span", {
    className: "tw-val mono"
  }, tweaks.boardScale.toFixed(2))), /*#__PURE__*/React.createElement(TwToggle, {
    label: "Show hint arrows on chute/ladder squares",
    value: tweaks.showHintArrows,
    onChange: v => onChange('showHintArrows', v)
  }), /*#__PURE__*/React.createElement(TwToggle, {
    label: "Center glide highlight on slides",
    value: tweaks.showGlidePath,
    onChange: v => onChange('showGlidePath', v)
  })), /*#__PURE__*/React.createElement("div", {
    className: "tw-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tw-group-label mono"
  }, "STYLE"), /*#__PURE__*/React.createElement(TwRow, {
    label: "Accent color"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tw-swatches"
  }, ['#e8583e', '#2a8a5f', '#e8b23e', '#5b6cff', '#a855a0', '#1ac0c6', '#ff6b9d'].map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    className: `tw-swatch ${tweaks.accentColor === c ? 'active' : ''}`,
    style: {
      background: c
    },
    onClick: () => onChange('accentColor', c),
    "aria-label": c
  })))), /*#__PURE__*/React.createElement(TwRow, {
    label: "Confetti density"
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "250",
    step: "10",
    value: tweaks.confettiDensity,
    onChange: e => onChange('confettiDensity', parseInt(e.target.value))
  }), /*#__PURE__*/React.createElement("span", {
    className: "tw-val mono"
  }, tweaks.confettiDensity))), /*#__PURE__*/React.createElement("div", {
    className: "tw-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tw-group-label mono"
  }, "HUD"), /*#__PURE__*/React.createElement(TwToggle, {
    label: "Show BLIP chat",
    value: tweaks.showBlipPanel,
    onChange: v => onChange('showBlipPanel', v)
  }), /*#__PURE__*/React.createElement(TwToggle, {
    label: "Show activity log",
    value: tweaks.showActivityLog,
    onChange: v => onChange('showActivityLog', v)
  }), /*#__PURE__*/React.createElement(TwRow, {
    label: "Roll prompt copy"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "tw-text",
    value: tweaks.rollButtonLabel,
    onChange: e => onChange('rollButtonLabel', e.target.value)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tw-footer"
  }, /*#__PURE__*/React.createElement("button", {
    className: "tw-reset",
    onClick: onReset
  }, "Reset to defaults"))), /*#__PURE__*/React.createElement("style", null, `
        .tweaks-panel {
          position: fixed;
          right: 20px;
          bottom: 20px;
          width: 340px;
          max-height: calc(100vh - 40px);
          background: white;
          border-radius: 16px;
          box-shadow:
            0 24px 60px -12px rgba(26,31,46,0.35),
            0 2px 0 rgba(26,31,46,0.06);
          border: 1px solid rgba(26,31,46,0.1);
          display: flex;
          flex-direction: column;
          z-index: 200;
          font-size: 13px;
          color: var(--ink);
          animation: tw-slide 0.25s cubic-bezier(.34,1.2,.64,1);
        }
        @keyframes tw-slide {
          from { transform: translateY(12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .tw-header {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(26,31,46,0.08);
          display: flex; align-items: center; justify-content: space-between;
        }
        .tw-title { font-size: 20px; font-weight: 700; }
        .tw-close {
          width: 28px; height: 28px; border-radius: 50%;
          font-size: 22px; line-height: 1;
          color: var(--ink-2); background: transparent;
          display: flex; align-items: center; justify-content: center;
        }
        .tw-close:hover { background: var(--bg-2); }
        .tw-body {
          padding: 14px 16px 8px;
          overflow-y: auto;
          flex: 1;
        }
        .tw-group {
          margin-bottom: 18px;
        }
        .tw-group-label {
          font-size: 10px;
          letter-spacing: 0.15em;
          color: var(--mute);
          margin-bottom: 8px;
        }
        .tw-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          min-height: 28px;
        }
        .tw-row-label {
          flex: 1;
          font-size: 13px;
        }
        .tw-row-ctrl {
          display: flex; align-items: center; gap: 8px;
          flex-shrink: 0;
        }
        .tw-row input[type=range] {
          width: 100px;
          accent-color: var(--accent);
        }
        .tw-val {
          font-size: 11px;
          color: var(--mute);
          min-width: 36px;
          text-align: right;
        }
        .tw-text {
          width: 150px;
          font: inherit;
          font-size: 12px;
          border: 1px solid rgba(26,31,46,0.15);
          border-radius: 6px;
          padding: 4px 8px;
          outline: none;
        }
        .tw-text:focus { border-color: var(--accent); }
        .tw-toggle {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 10px;
          cursor: pointer;
        }
        .tw-toggle-label { flex: 1; font-size: 13px; }
        .tw-switch {
          width: 34px; height: 20px;
          background: rgba(26,31,46,0.18);
          border-radius: 20px;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .tw-switch::after {
          content: '';
          position: absolute;
          left: 2px; top: 2px;
          width: 16px; height: 16px;
          background: white;
          border-radius: 50%;
          transition: left 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.25);
        }
        .tw-toggle.on .tw-switch { background: var(--accent); }
        .tw-toggle.on .tw-switch::after { left: 16px; }
        .tw-seg {
          display: flex;
          background: var(--bg-2);
          border-radius: 8px;
          padding: 2px;
          gap: 2px;
        }
        .tw-seg-btn {
          padding: 4px 10px;
          font-size: 11px;
          letter-spacing: 0.05em;
          border-radius: 6px;
          color: var(--ink-2);
          text-transform: uppercase;
        }
        .tw-seg-btn.active {
          background: white;
          color: var(--ink);
          box-shadow: 0 1px 2px rgba(0,0,0,0.08);
        }
        .tw-swatches {
          display: flex; gap: 6px;
        }
        .tw-swatch {
          width: 22px; height: 22px;
          border-radius: 50%;
          border: 2px solid transparent;
          box-shadow: inset 0 -2px 0 rgba(0,0,0,0.15);
          transition: transform 0.1s;
        }
        .tw-swatch:hover { transform: scale(1.1); }
        .tw-swatch.active {
          border-color: var(--ink);
          transform: scale(1.1);
        }
        .tw-footer {
          padding-top: 6px;
          border-top: 1px solid rgba(26,31,46,0.08);
          display: flex; justify-content: flex-end;
        }
        .tw-reset {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--mute);
          padding: 6px 10px;
        }
        .tw-reset:hover { color: var(--ink); }
      `));
}
function TwRow({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "tw-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tw-row-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "tw-row-ctrl"
  }, children));
}
function TwToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `tw-toggle ${value ? 'on' : ''}`,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("div", {
    className: "tw-toggle-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "tw-switch"
  }));
}
function Game({
  config,
  onQuit,
  tweaks = {},
  setTweaks = () => {}
}) {
  const T = {
    gameSpeed: tweaks.gameSpeed ?? 1,
    exactLanding: tweaks.exactLanding ?? true,
    showHintArrows: tweaks.showHintArrows ?? true,
    confettiDensity: tweaks.confettiDensity ?? 60,
    boardBgMode: tweaks.boardBgMode ?? 'dark',
    showBlipPanel: tweaks.showBlipPanel ?? true,
    showActivityLog: tweaks.showActivityLog ?? true,
    boardScale: tweaks.boardScale ?? 1,
    diceShuffleMs: tweaks.diceShuffleMs ?? 700,
    tokenStepMs: tweaks.tokenStepMs ?? 240,
    instantRolls: tweaks.instantRolls ?? false,
    showGlidePath: tweaks.showGlidePath ?? true,
    rollButtonLabel: tweaks.rollButtonLabel ?? 'Tap the dice to roll'
  };
  const scaleMs = ms => Math.max(20, Math.round(ms / T.gameSpeed));
  const [positions, setPositions] = useState(config.players.map(() => 0));
  const [current, setCurrent] = useState(0);
  const [diceValue, setDiceValue] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [phase, setPhase] = useState('waiting'); // waiting | rolling | moving | sliding | climbing | turnEnd | won
  const [log, setLog] = useState([]);
  const [blipMood, setBlipMood] = useState('happy');
  const [blipLine, setBlipLine] = useState(() => randLine('start'));
  const [winner, setWinner] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  // Per-frame position overrides (used during spiral slide for exact path-following)
  const [tokenOverride, setTokenOverride] = useState({}); // { [playerIdx]: { x, y } }

  // Animate a token along the exact spiral path (same geometry the SVG draws).
  const animateSpiralSlide = async (playerIdx, fromSq, toSq) => {
    const path = sampleSpiralPath(fromSq, toSq, 28);
    const totalMs = scaleMs(2200);
    await new Promise(resolve => {
      const startT = performance.now();
      const step = () => {
        const now = performance.now();
        const t = Math.min(1, (now - startT) / totalMs);
        // Ease so the token accelerates through the top coils and slows slightly at the bottom
        const eased = t < 0.85 ? t / 0.85 : 0.85 + (t - 0.85) * 0.7 / 0.15;
        const seg = eased * (path.length - 1);
        const idx = Math.min(path.length - 1, Math.floor(seg));
        const f = seg - idx;
        const aP = path[idx];
        const bP = path[Math.min(path.length - 1, idx + 1)];
        const x = aP.x + (bP.x - aP.x) * f;
        const y = aP.y + (bP.y - aP.y) * f;
        setTokenOverride(o => ({
          ...o,
          [playerIdx]: {
            x,
            y
          }
        }));
        if (t >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    // Snap to final square and drop the override so the token relocks to the grid
    setPositions(p => {
      const next = [...p];
      next[playerIdx] = toSq;
      return next;
    });
    setTokenOverride(o => {
      const n = {
        ...o
      };
      delete n[playerIdx];
      return n;
    });
  };
  const aiDifficulty = config.aiDifficulty || 'normal';
  const aiSpeed = scaleMs({
    easy: 1600,
    normal: 1000,
    hard: 600
  }[aiDifficulty]);
  const addLog = entry => {
    setLog(l => [entry, ...l].slice(0, 40));
  };
  const isAITurn = config.players[current]?.isAI;

  // Animate token advancing one square at a time
  const animateMove = async (playerIdx, fromSq, toSq) => {
    let cur = fromSq;
    while (cur < toSq) {
      cur += 1;
      setPositions(p => {
        const next = [...p];
        next[playerIdx] = cur;
        return next;
      });
      await sleep(scaleMs(T.tokenStepMs));
    }
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rollDiceInFlightRef = React.useRef(false);
  const rollDice = async () => {
    // Guard against double-fire from a stale-closure AI useEffect or rapid-click race:
    // even if phase===waiting passed once, two concurrent rolls would corrupt positions.
    if (phase !== 'waiting' || winner !== null || rollDiceInFlightRef.current) return;
    rollDiceInFlightRef.current = true;
    try {
      setPhase('rolling');
      setRolling(true);

      // Dice does real physics: fling → bounce off walls → settle → show for 2s → return home.
      // While physics runs we rapidly cycle the visible face so it tumbles dramatically.
      // Physics duration is ~1.4–1.6s (set inside the Dice component). Match it here.
      const physicsMs = T.instantRolls ? 0 : scaleMs(1400);
      if (physicsMs > 0) {
        const start = Date.now();
        while (Date.now() - start < physicsMs) {
          setDiceValue(1 + Math.floor(Math.random() * 6));
          await sleep(80);
        }
      }
      const roll = 1 + Math.floor(Math.random() * 6);
      setDiceValue(roll);
      setRolling(false); // triggers settle-to-face animation in Dice

      // Hold so the dice fully completes its physics arc (settle at landed spot, show face,
      // spring home) BEFORE the move starts. ~1.5s of dice motion + ~700ms read-buffer.
      await sleep(scaleMs(2200));
      const player = config.players[current];
      const from = positions[current];
      let target = from + roll;

      // Rule: exact landing (overshoot = stay) OR soft landing (overshoot = whatever fits; lands on 100 anyway)
      if (target > 100) {
        if (T.exactLanding) {
          addLog({
            type: 'bounce',
            player: player.name,
            roll
          });
          if (player.isAI) {
            setBlipMood('sad');
            setBlipLine("Overshot 100! I stay put.");
          }
          await sleep(scaleMs(900));
          endTurn();
          return;
        } else {
          // bounce-back rule: reflect overshoot
          target = 100 - (target - 100);
          addLog({
            type: 'roll',
            player: player.name,
            roll,
            from,
            to: target
          });
        }
      } else {
        addLog({
          type: 'roll',
          player: player.name,
          roll,
          from,
          to: target
        });
      }
      if (player.isAI) {
        setBlipLine(roll >= 4 ? randLine('goodRoll') : randLine('badRoll'));
        setBlipMood(roll >= 4 ? 'happy' : 'thinking');
      }

      // Move
      setPhase('moving');
      await animateMove(current, from, target);
      await sleep(scaleMs(300));

      // Check chute
      if (CHUTES[target] !== undefined) {
        // PORTAL: random destination
        if (PORTAL_SQUARES.has(target)) {
          // pick a random destination, excluding current and 100 (so player still has to earn the win)
          const choices = [];
          for (let i = 1; i <= 99; i++) if (i !== target) choices.push(i);
          const dest = choices[Math.floor(Math.random() * choices.length)];
          setHighlight(target);
          await sleep(scaleMs(550));
          setPhase('portaling');
          addLog({
            type: 'portal',
            player: player.name,
            from: target,
            to: dest
          });
          if (player.isAI) {
            setBlipLine("A portal?! Recalculating wildly!");
            setBlipMood('thinking');
          } else if (config.players.some(p => p.isAI)) {
            setBlipLine("A random-transport portal! Where'll you land?");
            setBlipMood('happy');
          }
          // throw animation: the CSS .token.portaling handles the arc + spin
          setPositions(p => {
            const next = [...p];
            next[current] = dest;
            return next;
          });
          await sleep(scaleMs(950));
          setHighlight(null);
          target = dest;
        } else {
          const dest = CHUTES[target];
          const chuteEntry = CHUTES_LIST.find(c => c.from === target);
          setHighlight(target);
          await sleep(scaleMs(450));
          if (chuteEntry?.spiral) {
            // Big 3D spiral slide — ride the exact spiral path
            setPhase('spiraling');
            addLog({
              type: 'chute',
              player: player.name,
              from: target,
              to: dest
            });
            if (player.isAI) {
              setBlipLine("Whooooa — down the spiral!");
              setBlipMood('sad');
            } else if (config.players.some(p => p.isAI)) {
              setBlipLine("The big spiral! Hold on tight!");
              setBlipMood('happy');
            }
            await animateSpiralSlide(current, target, dest);
          } else {
            setPhase('sliding');
            addLog({
              type: 'chute',
              player: player.name,
              from: target,
              to: dest
            });
            if (player.isAI) {
              setBlipLine(randLine('myChute'));
              setBlipMood('sad');
            } else if (isAITurn === false && config.players.some(p => p.isAI)) {
              setBlipLine(randLine('chute'));
              setBlipMood('thinking');
            }
            // animate slide: snap to dest with transition
            setPositions(p => {
              const next = [...p];
              next[current] = dest;
              return next;
            });
            await sleep(scaleMs(700));
          }
          setHighlight(null);
          target = dest;
        }
      } else if (LADDERS[target] !== undefined) {
        const dest = LADDERS[target];
        setHighlight(target);
        await sleep(scaleMs(450));
        setPhase('climbing');
        addLog({
          type: 'ladder',
          player: player.name,
          from: target,
          to: dest
        });
        if (player.isAI) {
          setBlipLine(randLine('myLadder'));
          setBlipMood('celebrating');
        } else if (config.players.some(p => p.isAI)) {
          setBlipLine(randLine('ladder'));
          setBlipMood('happy');
        }
        // climb: step up one rung at a time for effect
        let cur = target;
        const step = dest > target ? 1 : -1;
        while (cur !== dest) {
          cur += step * 4;
          if (step > 0 && cur > dest || step < 0 && cur < dest) cur = dest;
          setPositions(p => {
            const next = [...p];
            next[current] = cur;
            return next;
          });
          await sleep(scaleMs(140));
        }
        await sleep(scaleMs(400));
        setHighlight(null);
        target = dest;
      }

      // Win?
      if (target === 100) {
        setWinner(current);
        setPhase('won');
        setConfettiKey(k => k + 1);
        if (player.isAI) {
          setBlipLine(randLine('win'));
          setBlipMood('celebrating');
        } else if (config.players.some(p => p.isAI)) {
          setBlipLine(randLine('lose'));
          setBlipMood('sad');
        }
        return;
      }

      // "Near" taunt
      if (target >= 90 && player.isAI === false && config.players.some(p => p.isAI)) {
        if (Math.random() < 0.4) {
          setBlipLine(randLine('near'));
          setBlipMood('thinking');
        }
      }
      await sleep(scaleMs(500));
      endTurn();
    } finally {
      rollDiceInFlightRef.current = false;
    }
  };
  const endTurn = () => {
    setCurrent(c => (c + 1) % config.players.length);
    setPhase('waiting');
  };

  // AI auto-rolls
  useEffect(() => {
    if (phase === 'waiting' && isAITurn && !winner) {
      setBlipLine(randLine('myTurn'));
      setBlipMood('thinking');
      const t = setTimeout(() => {
        rollDice();
      }, aiSpeed);
      return () => clearTimeout(t);
    }
  }, [phase, current, winner]);
  const playAgain = () => {
    setPositions(config.players.map(() => 0));
    setCurrent(0);
    setDiceValue(1);
    setPhase('waiting');
    setLog([]);
    setWinner(null);
    setHighlight(null);
    setTokenOverride({}); // Clear any mid-spiral override that survived a quit/win
    setBlipLine(randLine('start'));
    setBlipMood('happy');
  };
  const curPlayer = config.players[current];
  const hasAI = config.players.some(p => p.isAI);
  return /*#__PURE__*/React.createElement("div", {
    className: "game-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "game-inner"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "sidebar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sb-top"
  }, /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    onClick: onQuit,
    title: "Back to menu",
    "aria-label": "Back to main menu"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M15 19l-7-7 7-7",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "sb-title serif"
  }, "Climb & Slide"), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn sb-settings",
    onClick: () => setSettingsOpen(true),
    title: "Settings",
    "aria-label": "Open settings"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3",
    stroke: "currentColor",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.36.33.68.65.9.32.22.7.36 1.1.4H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "players-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-label mono"
  }, "LEADERBOARD"), (() => {
    // compute rank: higher square = better; tie = original order
    const ranked = config.players.map((p, i) => ({
      p,
      i,
      pos: positions[i]
    })).sort((a, b) => b.pos - a.pos || a.i - b.i);
    // assign rank numbers (ties share rank)
    let lastPos = null,
      lastRank = 0;
    ranked.forEach((r, idx) => {
      if (r.pos !== lastPos) {
        lastRank = idx + 1;
        lastPos = r.pos;
      }
      r.rank = lastRank;
    });
    return ranked.map(({
      p,
      i,
      rank
    }) => /*#__PURE__*/React.createElement("div", {
      key: p.id,
      className: `player-row ${i === current && !winner ? 'active' : ''} ${winner === i ? 'winner' : ''}`
    }, /*#__PURE__*/React.createElement("div", {
      className: `rank-badge rank-${rank}`
    }, rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : rank + 'th'), p.isAI ? /*#__PURE__*/React.createElement("div", {
      className: "ai-avatar",
      style: {
        boxShadow: i === current && !winner ? `0 0 0 3px var(--bg), 0 0 0 5px ${p.color}` : 'none'
      }
    }, /*#__PURE__*/React.createElement(Robot, {
      size: 36,
      color: "#f7f1e4",
      mood: i === current && phase !== 'waiting' ? 'thinking' : blipMood
    })) : p.charId ? /*#__PURE__*/React.createElement("div", {
      className: "char-avatar",
      style: {
        background: p.color + '22',
        boxShadow: i === current && !winner ? `0 0 0 3px var(--bg), 0 0 0 5px ${p.color}` : 'none'
      }
    }, /*#__PURE__*/React.createElement(Character, {
      charId: p.charId,
      size: 40
    })) : /*#__PURE__*/React.createElement(Avatar, {
      label: p.label,
      color: p.color,
      size: 40,
      isCurrent: i === current && !winner
    }), /*#__PURE__*/React.createElement("div", {
      className: "player-info"
    }, /*#__PURE__*/React.createElement("div", {
      className: "player-name"
    }, p.name, p.isAI && /*#__PURE__*/React.createElement("span", {
      className: "ai-tag mono",
      "aria-label": "Robot opponent"
    }, "BOT"), i === current && !winner && /*#__PURE__*/React.createElement("span", {
      className: "turn-pill mono"
    }, "TURN")), /*#__PURE__*/React.createElement("div", {
      className: "player-pos mono"
    }, positions[i] === 0 ? 'START' : `SQ. ${positions[i]}`)), /*#__PURE__*/React.createElement("div", {
      className: "player-prog"
    }, /*#__PURE__*/React.createElement("div", {
      className: "prog-fill",
      style: {
        height: `${positions[i]}%`,
        background: p.color
      }
    }))));
  })()), hasAI && T.showBlipPanel && /*#__PURE__*/React.createElement("div", {
    className: "blip-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "blip-face"
  }, /*#__PURE__*/React.createElement(Robot, {
    size: 54,
    color: "#f7f1e4",
    mood: blipMood
  })), /*#__PURE__*/React.createElement("div", {
    className: "blip-bubble"
  }, /*#__PURE__*/React.createElement("div", {
    className: "blip-name mono"
  }, "BLIP"), /*#__PURE__*/React.createElement("div", {
    className: "blip-text"
  }, blipLine))), T.showActivityLog && /*#__PURE__*/React.createElement("div", {
    className: "log-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-label mono",
    id: "log-heading"
  }, "ACTIVITY"), /*#__PURE__*/React.createElement("div", {
    className: "log-list",
    role: "log",
    "aria-labelledby": "log-heading",
    "aria-live": "polite",
    "aria-atomic": "false",
    "aria-relevant": "additions"
  }, log.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "log-empty"
  }, "Your rolls will appear here."), log.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: `log-entry ${e.type}`
  }, e.type === 'roll' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("b", null, e.player), " rolled ", /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, e.roll), " \xB7 ", e.from, "\u2192", e.to), e.type === 'bounce' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("b", null, e.player), " rolled ", e.roll, " \u2014 too far, stayed put"), e.type === 'chute' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("b", null, e.player), " slid down a chute ", /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, e.from, "\u2192", e.to)), e.type === 'ladder' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("b", null, e.player), " climbed a ladder ", /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, e.from, "\u2192", e.to)), e.type === 'portal' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("b", null, e.player), " hit a portal \uD83C\uDF00 ", /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, e.from, "\u2192", e.to))))))), /*#__PURE__*/React.createElement("main", {
    className: "board-area"
  }, /*#__PURE__*/React.createElement("div", {
    className: "board-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "section-label mono"
  }, winner !== null ? 'GAME OVER' : isAITurn ? 'BLIP\'S TURN' : 'YOUR TURN'), /*#__PURE__*/React.createElement("div", {
    className: "turn-name serif"
  }, winner !== null ? /*#__PURE__*/React.createElement(React.Fragment, null, config.players[winner].name, " ", config.players[winner].name === 'You' ? 'win' : 'wins', "!") : /*#__PURE__*/React.createElement(React.Fragment, null, curPlayer.name, /*#__PURE__*/React.createElement("span", {
    className: "turn-dot",
    style: {
      background: curPlayer.color
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "header-meta"
  }, /*#__PURE__*/React.createElement("button", {
    className: "help-btn mono",
    onClick: () => setHelpOpen(true),
    "aria-label": "How to play",
    title: "How to play"
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "?"), " HOW TO PLAY"), /*#__PURE__*/React.createElement("div", {
    className: "rules-tag",
    title: T.exactLanding ? 'You must land exactly on 100 to win.' : 'Any roll past 100 bounces back.'
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, T.exactLanding ? 'ROLL EXACTLY TO 100' : 'BOUNCE BACK OFF 100')))), /*#__PURE__*/React.createElement(Board, {
    players: config.players,
    currentPlayerIdx: current,
    tokenPositions: positions,
    highlightedSquare: highlight,
    tweaks: T,
    phase: phase,
    tokenOverride: tokenOverride
  }), /*#__PURE__*/React.createElement("div", {
    className: "dice-area"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dice-slot"
  }, /*#__PURE__*/React.createElement(Dice, {
    value: diceValue,
    rolling: rolling,
    onClick: rollDice,
    disabled: phase !== 'waiting' || isAITurn || !!winner
  })), /*#__PURE__*/React.createElement("div", {
    className: "roll-info"
  }, !winner && phase === 'waiting' && !isAITurn && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "roll-prompt serif"
  }, T.rollButtonLabel), /*#__PURE__*/React.createElement("div", {
    className: "roll-hint mono"
  }, "TAP, OR PRESS & FLING \u261E"), /*#__PURE__*/React.createElement("div", {
    className: "roll-subhint"
  }, "Will move ", diceValue, " from square ", positions[current], ".")), !winner && phase === 'waiting' && isAITurn && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "roll-prompt serif"
  }, "BLIP is thinking\u2026"), /*#__PURE__*/React.createElement("div", {
    className: "roll-hint mono"
  }, "STAND BY")), !winner && phase !== 'waiting' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "roll-prompt serif"
  }, phase === 'rolling' && 'Rolling…', phase === 'moving' && `Moving +${diceValue}`, phase === 'sliding' && 'Sliding down! 🛝', phase === 'climbing' && 'Climbing up! 🪜', phase === 'portaling' && 'Portal! Teleporting… 🌀', phase === 'spiraling' && 'Whoooosh! Down the spiral! 🌀🛝'), /*#__PURE__*/React.createElement("div", {
    className: "roll-hint mono"
  }, "SQ. ", positions[current])), winner !== null && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "roll-prompt serif"
  }, "\uD83C\uDFC6 Winner!"), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: playAgain
  }, "Play again")))))), helpOpen && /*#__PURE__*/React.createElement(HowToPlay, {
    onClose: () => setHelpOpen(false)
  }), settingsOpen && /*#__PURE__*/React.createElement(SettingsModal, {
    tweaks: T,
    setTweaks: setTweaks,
    onClose: () => setSettingsOpen(false)
  }), winner !== null && /*#__PURE__*/React.createElement(WinOverlay, {
    key: confettiKey,
    winner: {
      ...config.players[winner],
      idx: winner
    },
    players: config.players,
    positions: positions,
    onPlayAgain: playAgain,
    onQuit: onQuit,
    confettiCount: T.confettiDensity
  }), /*#__PURE__*/React.createElement("style", null, `
        .game-wrap {
          min-height: 100vh;
          padding: 20px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }
        .game-inner {
          width: 100%;
          max-width: 1280px;
          min-height: calc(100vh - 40px);
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 24px;
          align-items: stretch;
        }
        @media (max-width: 900px) {
          .game-inner { grid-template-columns: 1fr; grid-template-rows: auto 1fr; overflow-y: auto; }
          .sidebar { max-height: none !important; position: static !important; }
        }
        .sidebar {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 18px;
          background: white;
          border-radius: 20px;
          border: 1px solid rgba(26,31,46,0.08);
          box-shadow: 0 4px 16px -8px rgba(26,31,46,0.1);
          position: sticky;
          top: 20px;
          align-self: start;
          max-height: calc(100vh - 40px);
          overflow-y: auto;
        }
        .sidebar::-webkit-scrollbar { width: 6px; }
        .sidebar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 3px; }
        .sb-top { display: flex; align-items: center; gap: 10px; }
        .sb-top .sb-title { flex: 1; }
        .sb-title { font-size: 20px; font-weight: 700; }
        .header-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .help-btn {
          font-size: 10px;
          letter-spacing: 0.15em;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: 999px;
          background: var(--bg-2);
          color: var(--ink);
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .help-btn:hover { background: #d8ccaf; }
        .help-btn span[aria-hidden] {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: var(--ink);
          color: var(--bg);
          font-size: 10px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .icon-btn {
          width: 32px; height: 32px;
          border-radius: 8px;
          background: var(--bg-2);
          color: var(--ink);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-btn:hover { background: #d8ccaf; }
        .section-label {
          font-size: 10px;
          letter-spacing: 0.15em;
          color: var(--mute);
          margin-bottom: 6px;
        }
        .players-panel { display: flex; flex-direction: column; gap: 8px; }
        .player-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px 10px 10px;
          border-radius: 12px;
          background: var(--bg);
          border: 1.5px solid transparent;
          transition: all 0.25s;
        }
        .player-row.active {
          background: white;
          border-color: var(--ink);
          box-shadow: 0 2px 0 rgba(26,31,46,0.08);
          animation: row-glow 2s ease-in-out infinite;
        }
        @keyframes row-glow {
          0%, 100% { box-shadow: 0 2px 0 rgba(26,31,46,0.08), 0 0 0 0 rgba(232,178,62,0); }
          50% { box-shadow: 0 2px 0 rgba(26,31,46,0.08), 0 0 0 4px rgba(232,178,62,0.25); }
        }
        .player-row.winner {
          background: #fff3a8;
          border-color: var(--accent-3);
          animation: winner-bounce 0.6s ease-in-out 2;
        }
        @keyframes winner-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .rank-badge {
          font-family: 'Geist Mono', monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 4px 6px;
          border-radius: 6px;
          background: var(--bg-2);
          color: var(--ink-2);
          min-width: 30px;
          text-align: center;
          flex-shrink: 0;
        }
        .rank-badge.rank-1 { background: #e8b23e; color: #5a3e0e; box-shadow: 0 2px 0 rgba(232,178,62,0.4); }
        .rank-badge.rank-2 { background: #c7c3b5; color: #3a352a; }
        .rank-badge.rank-3 { background: #c89772; color: #3a2410; }
        .char-avatar {
          width: 44px; height: 44px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: box-shadow 0.2s;
        }
        .turn-pill {
          display: inline-block;
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 8px;
          letter-spacing: 0.12em;
          background: var(--accent-2);
          color: white;
          margin-left: 4px;
        }
        .ai-avatar {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: var(--ink);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: box-shadow 0.2s;
        }
        .player-info { flex: 1; min-width: 0; }
        .player-name { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px; }
        .ai-tag {
          background: var(--ink);
          color: var(--bg);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 9px;
          letter-spacing: 0.1em;
        }
        .player-pos {
          font-size: 11px;
          color: var(--mute);
          letter-spacing: 0.05em;
          margin-top: 2px;
        }
        .player-prog {
          width: 6px;
          height: 44px;
          background: var(--bg-2);
          border-radius: 3px;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column-reverse;
        }
        .prog-fill {
          width: 100%;
          transition: height 0.4s cubic-bezier(.5,.1,.5,1.4);
          border-radius: 3px;
        }
        .blip-panel {
          display: flex;
          gap: 10px;
          padding: 14px;
          background: var(--ink);
          color: var(--bg);
          border-radius: 14px;
          position: relative;
        }
        .blip-face {
          width: 54px; height: 54px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .blip-bubble { flex: 1; min-width: 0; }
        .blip-name {
          font-size: 10px;
          letter-spacing: 0.15em;
          opacity: 0.55;
        }
        .blip-text {
          font-size: 14px;
          margin-top: 4px;
          line-height: 1.4;
        }
        .log-panel { flex: 1; display: flex; flex-direction: column; min-height: 120px; }
        /* The sidebar is the single scroll surface — don't double-scroll inside it. */
        .log-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }
        .log-empty { font-size: 12px; color: var(--mute); padding: 8px 0; }
        .log-entry {
          font-size: 12px;
          padding: 6px 10px;
          background: var(--bg);
          border-radius: 6px;
          line-height: 1.4;
        }
        .log-entry b { font-weight: 600; }
        .log-entry.chute { background: rgba(232,88,62,0.1); color: #a53a26; }
        .log-entry.portal { background: rgba(155,92,255,0.14); color: #5b2da6; font-weight: 500; }
        .log-entry.ladder { background: rgba(42,138,95,0.1); color: #1e6645; }

        .board-area {
          display: flex;
          flex-direction: column;
          gap: 18px;
          align-items: center;
          justify-content: flex-start;
          min-height: 0;
          padding-bottom: 24px;
        }
        .board-header {
          width: 100%;
          max-width: min(95vw, 80vh, 720px);
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .turn-name {
          font-size: 28px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .turn-dot {
          display: inline-block;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .rules-tag {
          font-size: 10px;
          letter-spacing: 0.15em;
          color: var(--mute);
          padding: 6px 10px;
          border: 1px dashed rgba(26,31,46,0.25);
          border-radius: 8px;
        }
        .dice-area {
          display: flex;
          align-items: center;
          gap: 24px;
          width: 100%;
          max-width: min(95vw, 80vh, 720px);
          padding: 22px 24px;
          background: white;
          border-radius: 18px;
          border: 1px solid rgba(26,31,46,0.08);
        }
        .dice-slot {
          width: 184px;
          flex-shrink: 0;
          padding-bottom: 12px;
        }
        .roll-info {
          flex: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }
        .roll-prompt { font-size: 20px; font-weight: 600; }
        .turn-dot { animation: dot-pulse 1.2s ease-in-out infinite; }
        @keyframes dot-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
          50% { transform: scale(1.2); box-shadow: 0 0 0 4px rgba(255,255,255,0.5), 0 2px 6px rgba(0,0,0,0.3); }
        }
        .roll-hint { font-size: 11px; letter-spacing: 0.12em; color: var(--mute); font-weight: 600; }
        .roll-subhint { font-size: 12px; color: var(--mute); margin-top: 2px; }
      `));
}
function WinOverlay({
  winner,
  players = [],
  positions = [],
  onPlayAgain,
  onQuit,
  confettiCount = 60
}) {
  // Confetti pieces
  const pieces = Array.from({
    length: confettiCount
  }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    dur: 1.5 + Math.random() * 1.5,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    rot: Math.random() * 360
  }));

  // Rank everyone by final square (highest first). Useful info on multi-player games
  // and gives BLIP matches a sense of how close it was.
  const ranks = players.map((p, idx) => ({
    p,
    idx,
    pos: positions[idx] ?? 0
  })).sort((a, b) => b.pos - a.pos);

  // Trap focus inside the dialog and close on Escape (standard modal a11y).
  const cardRef = React.useRef(null);
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onPlayAgain?.();
    };
    document.addEventListener('keydown', onKey);
    const focusable = cardRef.current?.querySelector('button.primary');
    focusable?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onPlayAgain]);
  const titleId = 'win-title-' + (winner?.id || 'x');
  return /*#__PURE__*/React.createElement("div", {
    className: "win-overlay",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": titleId
  }, /*#__PURE__*/React.createElement("div", {
    className: "confetti",
    "aria-hidden": "true"
  }, pieces.map(p => /*#__PURE__*/React.createElement("span", {
    key: p.id,
    className: "confetti-piece",
    style: {
      left: `${p.x}%`,
      background: p.color,
      animationDelay: `${p.delay}s`,
      animationDuration: `${p.dur}s`,
      transform: `rotate(${p.rot}deg)`
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "win-card",
    ref: cardRef
  }, /*#__PURE__*/React.createElement("div", {
    className: "win-eyebrow mono"
  }, "CONGRATULATIONS"), /*#__PURE__*/React.createElement("div", {
    className: "win-avatar"
  }, winner.isAI ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: winner.color,
      borderRadius: '50%',
      padding: 14
    }
  }, /*#__PURE__*/React.createElement(Robot, {
    size: 100,
    color: "#f7f1e4",
    mood: "celebrating"
  })) : winner.charId ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: winner.color + '33',
      borderRadius: '50%',
      padding: 14
    }
  }, /*#__PURE__*/React.createElement(Character, {
    charId: winner.charId,
    size: 100,
    spin: true
  })) : /*#__PURE__*/React.createElement(Avatar, {
    label: winner.label,
    color: winner.color,
    size: 120
  })), /*#__PURE__*/React.createElement("h2", {
    className: "win-title serif",
    id: titleId
  }, winner.name, " ", winner.name === 'You' ? 'win' : 'wins', "!"), /*#__PURE__*/React.createElement("p", {
    className: "win-sub"
  }, "Reached square 100 \u2014 chutes be damned."), ranks.length > 1 && /*#__PURE__*/React.createElement("ol", {
    className: "win-ranks",
    "aria-label": "Final standings"
  }, ranks.map((r, i) => /*#__PURE__*/React.createElement("li", {
    key: r.idx,
    className: r.idx === (winner.idx ?? -1) ? 'win-row champ' : 'win-row'
  }, /*#__PURE__*/React.createElement("span", {
    className: "win-rank mono"
  }, i + 1), /*#__PURE__*/React.createElement("span", {
    className: "win-dot",
    style: {
      background: r.p.color
    },
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "win-name"
  }, r.p.name), /*#__PURE__*/React.createElement("span", {
    className: "win-pos mono"
  }, "sq. ", r.pos)))), /*#__PURE__*/React.createElement("div", {
    className: "win-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onQuit
  }, "Main menu"), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: onPlayAgain
  }, "Play again \u2192"))), /*#__PURE__*/React.createElement("style", null, `
        .win-overlay {
          position: fixed; inset: 0;
          background: rgba(26,31,46,0.5);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 100;
          animation: fadein 0.3s ease;
          overflow-y: auto;
          padding: 20px;
        }
        @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
        .win-card {
          background: white;
          border-radius: 24px;
          padding: 40px;
          display: flex; flex-direction: column; align-items: center;
          gap: 14px;
          max-width: 440px;
          box-shadow: 0 24px 60px -12px rgba(0,0,0,0.5);
          animation: pop 0.5s cubic-bezier(.34,1.56,.64,1);
          position: relative;
          z-index: 2;
        }
        @keyframes pop {
          from { transform: scale(0.7); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .win-eyebrow {
          font-size: 11px;
          letter-spacing: 0.2em;
          color: var(--mute);
        }
        .win-avatar { margin: 8px 0; }
        .win-title {
          font-size: 44px; font-weight: 700; text-align: center;
          background: linear-gradient(90deg, #e8583e, #e8b23e, #2a8a5f, #5b6cff, #a855a0, #e8583e);
          background-size: 300% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: win-shimmer 3s linear infinite;
        }
        @keyframes win-shimmer {
          to { background-position: 300% 0; }
        }
        .win-sub { color: var(--ink-2); font-size: 15px; text-align: center; }
        .win-ranks {
          list-style: none;
          padding: 0;
          margin: 8px 0 4px;
          width: 100%;
          max-width: 340px;
          display: flex; flex-direction: column;
          gap: 4px;
        }
        .win-row {
          display: grid;
          grid-template-columns: 24px 12px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          font-size: 14px;
          background: rgba(26,31,46,0.04);
        }
        .win-row.champ {
          background: rgba(232,178,62,0.18);
          font-weight: 600;
        }
        .win-rank { color: var(--mute); font-size: 12px; text-align: center; }
        .win-dot { width: 10px; height: 10px; border-radius: 50%; }
        .win-pos { color: var(--mute); font-size: 12px; }
        .win-actions { display: flex; gap: 10px; margin-top: 16px; }
        .confetti {
          position: absolute; inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .confetti-piece {
          position: absolute;
          top: -20px;
          width: 10px; height: 16px;
          border-radius: 2px;
          animation: fall linear forwards;
        }
        @keyframes fall {
          to {
            transform: translateY(120vh) rotate(720deg);
          }
        }
      `));
}

// Sanity check at boot: chutes and ladders must never deposit a player on 100,
// otherwise the win-check would never fire. Hand-curated data verified here.
console.assert(Object.values(CHUTES || {}).indexOf(100) === -1 && Object.values(LADDERS || {}).indexOf(100) === -1, '[Climb & Slide] Bug: a chute or ladder maps to square 100, which would never trigger a win.');

// ============================================================
// HowToPlay — first-time-player rules modal. Keyboard-accessible (Escape closes,
// focus returns to opener). Kept under 4 bullets so a phone screen shows it all.
// ============================================================
function HowToPlay({
  onClose
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-overlay",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "htp-title",
    onClick: e => {
      if (e.target === e.currentTarget) onClose?.();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-card",
    ref: ref
  }, /*#__PURE__*/React.createElement("button", {
    className: "modal-close",
    onClick: onClose,
    "aria-label": "Close"
  }, "\xD7"), /*#__PURE__*/React.createElement("h2", {
    className: "modal-title serif",
    id: "htp-title"
  }, "How to Play"), /*#__PURE__*/React.createElement("ol", {
    className: "htp-list"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Roll the dice."), " Tap or press Enter \u2014 or press-and-hold and fling it across the screen for fun."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Climb ladders \uD83E\uDE9C."), " Land on a ladder's bottom rung and ride it up to a higher square."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Dodge chutes \uD83D\uDEDD."), " Land on a chute and slide back down. The big spiral is the worst one."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Watch for portals \uD83C\uDF00."), " They warp you to a random square \u2014 anywhere from 1 to 99."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "First to 100 wins."), " Depending on the rule, you either need to land exactly or you bounce back past it.")), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: onClose
  }, "Got it"))), /*#__PURE__*/React.createElement("style", null, `
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(26,31,46,0.55);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          z-index: 110;
          animation: fadein 0.2s ease;
          padding: 20px;
          overflow-y: auto;
        }
        .modal-card {
          background: white;
          border-radius: 20px;
          padding: 32px;
          max-width: 460px;
          width: 100%;
          box-shadow: 0 24px 60px -12px rgba(0,0,0,0.5);
          animation: pop 0.35s cubic-bezier(.34,1.56,.64,1);
          position: relative;
        }
        .modal-close {
          position: absolute; top: 12px; right: 14px;
          width: 32px; height: 32px;
          border-radius: 50%;
          font-size: 22px; line-height: 1;
          color: var(--mute);
          background: rgba(0,0,0,0.04);
        }
        .modal-close:hover { background: rgba(0,0,0,0.08); color: var(--ink); }
        .modal-title { font-size: 28px; margin-bottom: 6px; }
        .htp-list {
          margin: 8px 0 4px;
          padding-left: 22px;
          display: flex; flex-direction: column;
          gap: 10px;
          font-size: 15px;
          line-height: 1.45;
          color: var(--ink-2);
        }
        .htp-list b { color: var(--ink); }
        .modal-actions { display: flex; justify-content: flex-end; margin-top: 18px; }
      `));
}

// ============================================================
// SettingsModal — exposes the user-facing subset of tweaks (game speed, exact-landing,
// activity log, confetti density). Tweaks persist via TweakPanel's existing state.
// ============================================================
function SettingsModal({
  tweaks,
  setTweaks,
  onClose
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('button.btn')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const update = (key, val) => setTweaks(t => ({
    ...t,
    [key]: val
  }));
  const speed = tweaks.gameSpeed ?? 1;
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-overlay",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "set-title",
    onClick: e => {
      if (e.target === e.currentTarget) onClose?.();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-card",
    ref: ref
  }, /*#__PURE__*/React.createElement("button", {
    className: "modal-close",
    onClick: onClose,
    "aria-label": "Close"
  }, "\xD7"), /*#__PURE__*/React.createElement("h2", {
    className: "modal-title serif",
    id: "set-title"
  }, "Settings"), /*#__PURE__*/React.createElement("div", {
    className: "set-row"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "set-speed"
  }, "Game speed"), /*#__PURE__*/React.createElement("div", {
    className: "set-control"
  }, /*#__PURE__*/React.createElement("input", {
    id: "set-speed",
    type: "range",
    min: "0.5",
    max: "2",
    step: "0.1",
    value: speed,
    onChange: e => update('gameSpeed', parseFloat(e.target.value))
  }), /*#__PURE__*/React.createElement("span", {
    className: "set-val mono"
  }, speed.toFixed(1), "\xD7"))), /*#__PURE__*/React.createElement("div", {
    className: "set-row"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "set-exact"
  }, "Win rule"), /*#__PURE__*/React.createElement("div", {
    className: "set-control"
  }, /*#__PURE__*/React.createElement("select", {
    id: "set-exact",
    value: tweaks.exactLanding ? 'exact' : 'bounce',
    onChange: e => update('exactLanding', e.target.value === 'exact')
  }, /*#__PURE__*/React.createElement("option", {
    value: "exact"
  }, "Roll exactly to 100"), /*#__PURE__*/React.createElement("option", {
    value: "bounce"
  }, "Bounce back off 100")))), /*#__PURE__*/React.createElement("div", {
    className: "set-row"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "set-log"
  }, /*#__PURE__*/React.createElement("span", null, "Show activity log")), /*#__PURE__*/React.createElement("div", {
    className: "set-control"
  }, /*#__PURE__*/React.createElement("input", {
    id: "set-log",
    type: "checkbox",
    checked: tweaks.showActivityLog !== false,
    onChange: e => update('showActivityLog', e.target.checked)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "set-row"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "set-confetti"
  }, "Confetti density"), /*#__PURE__*/React.createElement("div", {
    className: "set-control"
  }, /*#__PURE__*/React.createElement("input", {
    id: "set-confetti",
    type: "range",
    min: "0",
    max: "200",
    step: "10",
    value: tweaks.confettiDensity ?? 60,
    onChange: e => update('confettiDensity', parseInt(e.target.value, 10))
  }), /*#__PURE__*/React.createElement("span", {
    className: "set-val mono"
  }, tweaks.confettiDensity ?? 60))), /*#__PURE__*/React.createElement("p", {
    className: "set-note mono"
  }, "Settings apply on next roll. New games reset to defaults."), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: onClose
  }, "Done"))), /*#__PURE__*/React.createElement("style", null, `
        .set-row {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 16px;
          padding: 12px 0;
          border-top: 1px solid rgba(26,31,46,0.06);
        }
        .set-row label { font-size: 14px; font-weight: 500; }
        .set-control { display: flex; align-items: center; gap: 10px; }
        .set-control input[type="range"] { width: 140px; }
        .set-control select {
          font-family: inherit; font-size: 14px;
          padding: 6px 10px; border-radius: 8px;
          border: 1px solid rgba(26,31,46,0.15); background: white;
        }
        .set-val { font-size: 12px; color: var(--mute); min-width: 30px; text-align: right; }
        .set-note { font-size: 10px; color: var(--mute); letter-spacing: 0.1em; margin-top: 12px; text-align: center; }
      `));
}
window.App = App;
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS5qcyIsIm5hbWVzIjpbIkNIVVRFU19MSVNUIiwiZnJvbSIsInRvIiwiY29sb3IiLCJzcGlyYWwiLCJwb3J0YWwiLCJDSFVURVMiLCJPYmplY3QiLCJmcm9tRW50cmllcyIsIm1hcCIsImMiLCJQT1JUQUxfU1FVQVJFUyIsIlNldCIsImZpbHRlciIsIlNQSVJBTF9OVU1fTE9PUFMiLCJTUElSQUxfQVJDSF9SIiwiU1BJUkFMX1RVQkVfVyIsImNvbXB1dGVTcGlyYWxHZW9tZXRyeSIsImZyb21TcSIsInRvU3EiLCJheCIsImF5IiwiTWF0aCIsImZsb29yIiwiYSIsInNxVG9QY3QiLCJzcSIsInJvdyIsImluUm93IiwiY29sIiwieCIsInkiLCJiIiwiZHgiLCJkeSIsImxlbiIsImh5cG90IiwibnhBeCIsIm55QXgiLCJzZWdzIiwiYm91bmRhcmllcyIsImkiLCJ0IiwicHVzaCIsImFyY2hlcyIsInMiLCJlIiwiaXNGcm9udCIsInNpZ24iLCJtaWRBeGlzWCIsIm1pZEF4aXNZIiwiY3RybFgiLCJjdHJsWSIsImN0cmwiLCJzYW1wbGVRdWFkIiwibiIsIm91dCIsIm10Iiwic2FtcGxlU3BpcmFsUGF0aCIsInNhbXBsZXNQZXJBcmNoIiwicHRzIiwiYXIiLCJsYXN0IiwibGVuZ3RoIiwiTEFEREVSU19MSVNUIiwiTEFEREVSUyIsImwiLCJzcXVhcmVUb1JDIiwic3F1YXJlVG9QY3QiLCJCb2FyZCIsInBsYXllcnMiLCJjdXJyZW50UGxheWVySWR4IiwidG9rZW5Qb3NpdGlvbnMiLCJoaWdobGlnaHRlZFNxdWFyZSIsInR3ZWFrcyIsInBoYXNlIiwidG9rZW5PdmVycmlkZSIsInNob3dIaW50QXJyb3dzIiwic2hvd0dsaWRlUGF0aCIsImJvYXJkU2NhbGUiLCJib2FyZEJnTW9kZSIsInRoZW1lVmFycyIsInNxdWFyZXMiLCJudW1zIiwiUmVhY3QiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwic3R5bGUiLCJ0cmFuc2Zvcm0iLCJ0cmFuc2Zvcm1PcmlnaW4iLCJyb3dOdW1zIiwicklkeCIsImNJZHgiLCJpc0RhcmsiLCJpc1N0YXJ0IiwiaXNFbmQiLCJpc0NodXRlIiwiaXNMYWRkZXIiLCJpc1BvcnRhbCIsImhhcyIsImlzSGlnaGxpZ2h0Iiwia2V5IiwiZ3JpZFJvdyIsImdyaWRDb2x1bW4iLCJ0aXRsZSIsInZpZXdCb3giLCJwcmVzZXJ2ZUFzcGVjdFJhdGlvIiwiaWQiLCJ3aWR0aCIsImhlaWdodCIsInN0ZERldmlhdGlvbiIsImFuZyIsImF0YW4yIiwiUEkiLCJ3IiwibnVtUnVuZ3MiLCJtYXgiLCJzaGFkZSIsImhleCIsImFtdCIsInBhcnNlSW50Iiwic2xpY2UiLCJyIiwibWluIiwiZyIsImJsIiwickxpZ2h0Iiwick1pZCIsInJEYXJrIiwickRhcmtlciIsInVpZCIsIngxIiwieTEiLCJ4MiIsInkyIiwib2Zmc2V0Iiwic3RvcENvbG9yIiwib3BhY2l0eSIsImZpbGwiLCJyeCIsInN0cm9rZSIsInN0cm9rZVdpZHRoIiwic3Ryb2tlTGluZWNhcCIsIkFycmF5IiwiXyIsImN4IiwiYngiLCJieSIsImN5Iiwic2hhZGVIZXgiLCJwIiwidWlkUCIsImNMIiwiY00iLCJjRCIsImNERCIsInN0b3BPcGFjaXR5IiwicnkiLCJhbmltYXRpb24iLCJkZWciLCJkIiwicmFkIiwiY29zIiwic2luIiwiZ2VvIiwidWlkUyIsImNEREQiLCJ0dWJlVyIsImFyY2hSIiwiaW4iLCJyZXN1bHQiLCJ0eXBlIiwic2xvcGUiLCJicCIsInJpbmdzIiwiTiIsImsiLCJ0eCIsInR5IiwiYW5nbGVEZWciLCJueCIsIm55IiwiYnVsZ2UxIiwiYnVsZ2UyIiwiYzF4IiwiYzF5IiwiYzJ4IiwiYzJ5IiwiY0xpZ2h0IiwiY01pZCIsImNEYXJrIiwiY0RhcmtlciIsIndTbGlkZSIsInNhbXBsZSIsInN0ZXBzIiwiY2VudGVybGluZSIsIndpZHRoQXQiLCJ0b3AiLCJib3QiLCJmb3JFYWNoIiwiTCIsInBueCIsInBueSIsIncyIiwiYmVkUG9pbnRzIiwicmV2ZXJzZSIsImpvaW4iLCJyYWlsMSIsInJhaWwyIiwiZW50cnkiLCJlbnRyeUFuZyIsImV4aXRfIiwiZXhpdEFuZyIsInBvaW50cyIsImNvbmNhdCIsIm92ZXJyaWRlIiwiYmFzZSIsInNhbWVTcXVhcmVJZHgiLCJqIiwiaW5kZXhPZiIsIm94Iiwib3kiLCJpc0N1cnJlbnQiLCJpc01vdmluZyIsImlzQ2xpbWJpbmciLCJpc1NsaWRpbmciLCJpc1BvcnRhbGluZyIsImlzU3BpcmFsaW5nIiwiaXNBSSIsImxlZnQiLCJjaGFySWQiLCJkaXNwbGF5IiwiYWxpZ25JdGVtcyIsImp1c3RpZnlDb250ZW50IiwiQ2hhcmFjdGVyIiwic2l6ZSIsImxhYmVsIiwiY3VyU3EiLCJ3aW5kb3ciLCJSb2JvdCIsIm1vb2QiLCJleWVZIiwibW91dGgiLCJoYXBweSIsInRoaW5raW5nIiwiY2VsZWJyYXRpbmciLCJzYWQiLCJhdHRyaWJ1dGVOYW1lIiwidmFsdWVzIiwiZHVyIiwicmVwZWF0Q291bnQiLCJrZXlUaW1lcyIsIkF2YXRhciIsImJvcmRlclJhZGl1cyIsImJhY2tncm91bmQiLCJmb250V2VpZ2h0IiwiZm9udFNpemUiLCJib3hTaGFkb3ciLCJmbGV4U2hyaW5rIiwiQ0hBUkFDVEVSUyIsIm5hbWUiLCJzcGluIiwiZmluZCIsImRhcmtlbiIsImxpZ2h0ZW4iLCJkYXJrIiwiZGFya2VyIiwibGlnaHQiLCJsaWdodGVyIiwiZGVmcyIsImZ4IiwiZnkiLCJleWUzRCIsIm1vdXRoM0QiLCJjaGVla3MiLCJseSIsInNjYWxlIiwic3BoZXJlU2hhZGUiLCJzaGFwZUVsIiwiRnJhZ21lbnQiLCJncm91bmRTaGFkb3ciLCJib2RpZXMiLCJib2x0Iiwic3RhciIsInByb3BzIiwiX2V4dGVuZHMiLCJzdHJva2VMaW5lam9pbiIsInBpcCIsImJvZHkiLCJtb2NoaSIsImZlcm4iLCJsdW5hIiwiemlnZ3kiLCJzcGlrZSIsImVtYmVyIiwiZmxhbWUiLCJjb2NvIiwicG9zaXRpb24iLCJ1bmRlZmluZWQiLCJvdmVyZmxvdyIsIkRpY2UiLCJ2YWx1ZSIsInJvbGxpbmciLCJvbkNsaWNrIiwiZGlzYWJsZWQiLCJmYWNlcyIsImZhY2VSb3RhdGlvbnMiLCJyb2xsVGljayIsInNldFJvbGxUaWNrIiwidXNlU3RhdGUiLCJjdXJyZW50Um90Iiwic2V0Q3VycmVudFJvdCIsInoiLCJib3VuY2UiLCJzcXVhc2giLCJ3YXNSb2xsaW5nIiwidXNlUmVmIiwiaWRsZVBvc2VGb3IiLCJ2IiwidmFsdWVSZWYiLCJ1c2VFZmZlY3QiLCJjdXJyZW50Iiwicm9sbGluZ1JlZiIsInJhZiIsInN0YXJ0IiwicGVyZm9ybWFuY2UiLCJub3ciLCJzdGFydFJvdCIsInZ4MCIsInJhbmRvbSIsInZ5MCIsInRhdSIsImxhc3RUIiwiYWNjWCIsImFjY1kiLCJ0aWNrIiwiZHQiLCJkZWNheSIsImV4cCIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsImlkbGUiLCJmaW5hbFgiLCJyb3VuZCIsImZpbmFsWSIsInN0YXJ0VGltZSIsInBvdyIsIndvYmJsZSIsInRhYmxlQm91bmNlIiwiYWJzIiwiY2FuY2VsQW5pbWF0aW9uRnJhbWUiLCJQaXAiLCJmYWNlU2hhZGUiLCJGYWNlIiwiZmFjZVZhbCIsImRyYWciLCJzZXREcmFnIiwiYWN0aXZlIiwicGh5cyIsInNldFBoeXMiLCJtb2RlIiwicm90WiIsInN0YXJ0UmVmIiwibGFzdE1vdmVSZWYiLCJ2ZWxSZWYiLCJ2eCIsInZ5IiwiZGljZUJveFJlZiIsImgiLCJwaHlzUmVmIiwidnJvdCIsInJ1bm5pbmciLCJzdGFydFQiLCJyYWZSZWYiLCJyZXN0VGltZXJSZWYiLCJyZXR1cm5UaW1lclJlZiIsImNhbkludGVyYWN0IiwiY2FuY2VsVGltZXJzIiwiY2xlYXJUaW1lb3V0IiwiZGljZUVsUmVmIiwicmVmcmVzaERpY2VCb3giLCJ1c2VDYWxsYmFjayIsImVsIiwicmVjdCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwib25IaWRlIiwiZG9jdW1lbnQiLCJoaWRkZW4iLCJvblBvaW50ZXJEb3duIiwicHJldmVudERlZmF1bHQiLCJjdXJyZW50VGFyZ2V0Iiwic2V0UG9pbnRlckNhcHR1cmUiLCJwb2ludGVySWQiLCJjbGllbnRYIiwiY2xpZW50WSIsIm9uUG9pbnRlck1vdmUiLCJyYXdEeCIsInJhd0R5IiwidnciLCJpbm5lcldpZHRoIiwidmgiLCJpbm5lckhlaWdodCIsImhhbGZXIiwiaGFsZkgiLCJwYWQiLCJtaW5EeCIsIm1heER4IiwibWluRHkiLCJtYXhEeSIsInN0YXJ0UGh5c2ljcyIsImluaXRYIiwiaW5pdFkiLCJzdGVwIiwicHJldiIsImZyaWMiLCJtaW5YIiwibWF4WCIsIm1pblkiLCJtYXhZIiwiYm91bmNlRGFtcCIsImhpdFdhbGwiLCJidG4iLCJxdWVyeVNlbGVjdG9yIiwiY2xhc3NMaXN0IiwicmVtb3ZlIiwib2Zmc2V0V2lkdGgiLCJhZGQiLCJzcGVlZCIsImVsYXBzZWQiLCJzZXRUaW1lb3V0IiwiaG9sZEF0TGFuZGVkIiwiZW5kRHJhZyIsImRpZFJlbGVhc2UiLCJkaXN0IiwiaXNUYXAiLCJsYXVuY2hWeCIsImxhdW5jaFZ5IiwibWFnIiwib25Qb2ludGVyVXAiLCJvblBvaW50ZXJDYW5jZWwiLCJhaXJib3JuZSIsInNoYWRvd1NjYWxlIiwic2hhZG93T3BhY2l0eSIsInNoYWRvd0JsdXIiLCJvdXRlclRyYW5zZm9ybSIsIm91dGVyVHJhbnNpdGlvbiIsImxpZnRTY2FsZSIsIm9uQ29udGV4dE1lbnUiLCJkZXRhaWwiLCJvbktleURvd24iLCJ0cmFuc2l0aW9uIiwiUExBWUVSX0NPTE9SUyIsIkRFRkFVTFRfTkFNRVMiLCJNb2RlU2VsZWN0Iiwib25TdGFydCIsInNldE1vZGUiLCJodW1hbkNvdW50Iiwic2V0SHVtYW5Db3VudCIsImFpRGlmZmljdWx0eSIsInNldEFpRGlmZmljdWx0eSIsInBsYXllck5hbWUiLCJzZXRQbGF5ZXJOYW1lIiwibmFtZXMiLCJzZXROYW1lcyIsImNoYXJzIiwic2V0Q2hhcnMiLCJteUNoYXIiLCJzZXRNeUNoYXIiLCJjb2xvckZvciIsImNpZCIsInRvVXBwZXJDYXNlIiwic2V0Q2hhckF0IiwiaWR4IiwibmV3Q2lkIiwibmV4dCIsImR1cElkeCIsImN5Y2xlQ2hhciIsImRpciIsImN1ciIsImZpbmRJbmRleCIsInBsYWNlaG9sZGVyIiwibWF4TGVuZ3RoIiwib25DaGFuZ2UiLCJ0YXJnZXQiLCJkZXNjIiwiaHJlZiIsInJlbCIsIkJMSVBfTElORVMiLCJnb29kUm9sbCIsImJhZFJvbGwiLCJsYWRkZXIiLCJjaHV0ZSIsIm15VHVybiIsIm15TGFkZGVyIiwibXlDaHV0ZSIsIndpbiIsImxvc2UiLCJuZWFyIiwicmFuZExpbmUiLCJhcnIiLCJBcHAiLCJzY3JlZW4iLCJzZXRTY3JlZW4iLCJjb25maWciLCJzZXRDb25maWciLCJUV0VBS19ERUZBVUxUUyIsInNldFR3ZWFrcyIsInR3ZWFrUGFuZWxPcGVuIiwic2V0VHdlYWtQYW5lbE9wZW4iLCJ1cGRhdGVUd2VhayIsInZhbCIsInBhcmVudCIsInBvc3RNZXNzYWdlIiwiZWRpdHMiLCJvbk1zZyIsImRhdGEiLCJkb2N1bWVudEVsZW1lbnQiLCJzZXRQcm9wZXJ0eSIsImFjY2VudENvbG9yIiwiaGFuZGxlU3RhcnQiLCJjZmciLCJoYW5kbGVRdWl0IiwiR2FtZSIsIm9uUXVpdCIsIlR3ZWFrc1BhbmVsIiwib25DbG9zZSIsIm9uUmVzZXQiLCJUd1JvdyIsImdhbWVTcGVlZCIsInBhcnNlRmxvYXQiLCJ0b0ZpeGVkIiwiZGljZVNodWZmbGVNcyIsIlR3VG9nZ2xlIiwiaW5zdGFudFJvbGxzIiwiZXhhY3RMYW5kaW5nIiwiY29uZmV0dGlEZW5zaXR5Iiwic2hvd0JsaXBQYW5lbCIsInNob3dBY3Rpdml0eUxvZyIsInJvbGxCdXR0b25MYWJlbCIsImNoaWxkcmVuIiwiVCIsInRva2VuU3RlcE1zIiwic2NhbGVNcyIsIm1zIiwicG9zaXRpb25zIiwic2V0UG9zaXRpb25zIiwic2V0Q3VycmVudCIsImRpY2VWYWx1ZSIsInNldERpY2VWYWx1ZSIsInNldFJvbGxpbmciLCJzZXRQaGFzZSIsImxvZyIsInNldExvZyIsImJsaXBNb29kIiwic2V0QmxpcE1vb2QiLCJibGlwTGluZSIsInNldEJsaXBMaW5lIiwid2lubmVyIiwic2V0V2lubmVyIiwiaGlnaGxpZ2h0Iiwic2V0SGlnaGxpZ2h0IiwiaGVscE9wZW4iLCJzZXRIZWxwT3BlbiIsInNldHRpbmdzT3BlbiIsInNldFNldHRpbmdzT3BlbiIsImNvbmZldHRpS2V5Iiwic2V0Q29uZmV0dGlLZXkiLCJzZXRUb2tlbk92ZXJyaWRlIiwiYW5pbWF0ZVNwaXJhbFNsaWRlIiwicGxheWVySWR4IiwicGF0aCIsInRvdGFsTXMiLCJQcm9taXNlIiwicmVzb2x2ZSIsImVhc2VkIiwic2VnIiwiZiIsImFQIiwiYlAiLCJvIiwiYWlTcGVlZCIsImVhc3kiLCJub3JtYWwiLCJoYXJkIiwiYWRkTG9nIiwiaXNBSVR1cm4iLCJhbmltYXRlTW92ZSIsInNsZWVwIiwicm9sbERpY2VJbkZsaWdodFJlZiIsInJvbGxEaWNlIiwicGh5c2ljc01zIiwiRGF0ZSIsInJvbGwiLCJwbGF5ZXIiLCJlbmRUdXJuIiwiY2hvaWNlcyIsImRlc3QiLCJzb21lIiwiY2h1dGVFbnRyeSIsInBsYXlBZ2FpbiIsImN1clBsYXllciIsImhhc0FJIiwicmFua2VkIiwicG9zIiwic29ydCIsImxhc3RQb3MiLCJsYXN0UmFuayIsInJhbmsiLCJyb2xlIiwiSG93VG9QbGF5IiwiU2V0dGluZ3NNb2RhbCIsIldpbk92ZXJsYXkiLCJvblBsYXlBZ2FpbiIsImNvbmZldHRpQ291bnQiLCJwaWVjZXMiLCJkZWxheSIsInJvdCIsInJhbmtzIiwiY2FyZFJlZiIsIm9uS2V5IiwiZm9jdXNhYmxlIiwiZm9jdXMiLCJ0aXRsZUlkIiwiYW5pbWF0aW9uRGVsYXkiLCJhbmltYXRpb25EdXJhdGlvbiIsInJlZiIsInBhZGRpbmciLCJjb25zb2xlIiwiYXNzZXJ0IiwidXBkYXRlIiwiaHRtbEZvciIsImNoZWNrZWQiLCJSZWFjdERPTSIsImNyZWF0ZVJvb3QiLCJnZXRFbGVtZW50QnlJZCIsInJlbmRlciJdLCJzb3VyY2VzIjpbImdhbWUuanN4Il0sInNvdXJjZXNDb250ZW50IjpbIlxuLy8gPT09IGJvYXJkLmpzeCA9PT1cbi8vIEJvYXJkIGRhdGEgKyByZW5kZXJpbmdcblxuLy8gQ2h1dGVzIChzbmFrZXMpOiBzdGFydCAoaGlnaCkgLT4gZW5kIChsb3cpICB3aXRoIGNvbG9yIHBhbGV0dGUgcGVyIHNuYWtlXG4vLyBMYWRkZXJzOiBzdGFydCAobG93KSAtPiBlbmQgKGhpZ2gpICB3aXRoIGNvbG9yIHBhbGV0dGUgcGVyIGxhZGRlclxuY29uc3QgQ0hVVEVTX0xJU1QgPSBbXG4gIHsgZnJvbTogOTgsIHRvOiA3OCwgY29sb3I6ICcjMWFjMGM2JyB9LCAgLy8gdHVycXVvaXNlXG4gIHsgZnJvbTogOTMsIHRvOiA3MywgY29sb3I6ICcjZmZjOTNkJyB9LCAgLy8gc3Vuc2hpbmUgeWVsbG93XG4gIHsgZnJvbTogODcsIHRvOiAyNCwgY29sb3I6ICcjZmY3YTNkJywgc3BpcmFsOiB0cnVlIH0sICAvLyBjb3JhbCBvcmFuZ2Ug4oCUIHNwaXJhbCB0dWJlIHNsaWRlXG4gIHsgZnJvbTogNjQsIHRvOiA2MCwgY29sb3I6ICcjN2VkOTU3JyB9LCAgLy8gbGltZSBncmVlblxuICB7IGZyb206IDYyLCB0bzogMTksIGNvbG9yOiAnIzNkYTBmZicgfSwgIC8vIHNreSBibHVlXG4gIHsgZnJvbTogNTYsIHRvOiA1MywgY29sb3I6ICcjYzc3ZGZmJyB9LCAgLy8gbGF2ZW5kZXJcbiAgeyBmcm9tOiA0OSwgdG86IDExLCBjb2xvcjogJyM5YjVjZmYnLCBwb3J0YWw6IHRydWUgfSwgIC8vIHJhbmRvbS10cmFuc3BvcnQgUE9SVEFMXG4gIHsgZnJvbTogNDcsIHRvOiAyNiwgY29sb3I6ICcjZmY0ZDZkJyB9LCAgLy8gd2F0ZXJtZWxvblxuICB7IGZyb206IDE2LCB0bzogNiwgIGNvbG9yOiAnI2Y3YTgyNCcgfSwgIC8vIG1hbmdvXG5dO1xuY29uc3QgQ0hVVEVTID0gT2JqZWN0LmZyb21FbnRyaWVzKENIVVRFU19MSVNULm1hcChjID0+IFtjLmZyb20sIGMudG9dKSk7XG5jb25zdCBQT1JUQUxfU1FVQVJFUyA9IG5ldyBTZXQoQ0hVVEVTX0xJU1QuZmlsdGVyKGMgPT4gYy5wb3J0YWwpLm1hcChjID0+IGMuZnJvbSkpO1xuXG4vLyA9PT09IFNwaXJhbCBzbGlkZSBnZW9tZXRyeSA9PT09XG4vLyBUaGUgYmlnIHNwaXJhbCAoODfihpIyNCkgaXMgZHJhd24gYXMgYSBzZXJpZXMgb2YgYWx0ZXJuYXRpbmcgZnJvbnQvYmFjayBhcmNoZXMgdGhhdFxuLy8gdG9nZXRoZXIgZm9ybSBhIGNvaWxlZCB0dWJlLiBXZSBleHRyYWN0IHRoZSBnZW9tZXRyeSBzbyBib3RoIHRoZSByZW5kZXJlciBBTkQgdGhlXG4vLyB0b2tlbi1zbGlkZSBhbmltYXRpb24gdXNlIHRoZSBzYW1lIHBhdGguXG5jb25zdCBTUElSQUxfTlVNX0xPT1BTID0gNDsgICAvLyBmZXdlciwgYmlnZ2VyIGxvb3BzID0gbW9yZSAzRCBwb3BcbmNvbnN0IFNQSVJBTF9BUkNIX1IgPSA3LjI7ICAgIC8vIHBlcnBlbmRpY3VsYXIgYW1wbGl0dWRlIG9mIGVhY2ggYXJjaFxuY29uc3QgU1BJUkFMX1RVQkVfVyA9IDMuNjsgICAgLy8gdHViZSBzdHJva2Ugd2lkdGhcblxuZnVuY3Rpb24gY29tcHV0ZVNwaXJhbEdlb21ldHJ5KGZyb21TcSwgdG9TcSkge1xuICBjb25zdCBheCA9ICgoZnJvbVNxIC0gMSkgJSAxMCk7XG4gIGNvbnN0IGF5ID0gTWF0aC5mbG9vcigoZnJvbVNxIC0gMSkgLyAxMCk7XG4gIHZvaWQgYXg7IHZvaWQgYXk7IC8vIGtlZXAgbGludGVyIHF1aWV0IOKAlCBhY3R1YWwgcG9zaXRpb24gbWF0aCB1c2VzIHNxdWFyZVRvUGN0IGJlbG93XG4gIGNvbnN0IGEgPSAoZnVuY3Rpb24gc3FUb1BjdChzcSkge1xuICAgIGNvbnN0IHJvdyA9IE1hdGguZmxvb3IoKHNxIC0gMSkgLyAxMCk7XG4gICAgY29uc3QgaW5Sb3cgPSAoc3EgLSAxKSAlIDEwO1xuICAgIGNvbnN0IGNvbCA9IHJvdyAlIDIgPT09IDAgPyBpblJvdyA6IDkgLSBpblJvdztcbiAgICByZXR1cm4geyB4OiAoY29sICsgMC41KSAqIDEwLCB5OiAxMDAgLSAocm93ICsgMC41KSAqIDEwIH07XG4gIH0pKGZyb21TcSk7XG4gIGNvbnN0IGIgPSAoZnVuY3Rpb24gc3FUb1BjdChzcSkge1xuICAgIGNvbnN0IHJvdyA9IE1hdGguZmxvb3IoKHNxIC0gMSkgLyAxMCk7XG4gICAgY29uc3QgaW5Sb3cgPSAoc3EgLSAxKSAlIDEwO1xuICAgIGNvbnN0IGNvbCA9IHJvdyAlIDIgPT09IDAgPyBpblJvdyA6IDkgLSBpblJvdztcbiAgICByZXR1cm4geyB4OiAoY29sICsgMC41KSAqIDEwLCB5OiAxMDAgLSAocm93ICsgMC41KSAqIDEwIH07XG4gIH0pKHRvU3EpO1xuICBjb25zdCBkeCA9IGIueCAtIGEueCwgZHkgPSBiLnkgLSBhLnk7XG4gIGNvbnN0IGxlbiA9IE1hdGguaHlwb3QoZHgsIGR5KTtcbiAgY29uc3QgbnhBeCA9IC1keSAvIGxlbiwgbnlBeCA9IGR4IC8gbGVuO1xuICBjb25zdCBzZWdzID0gU1BJUkFMX05VTV9MT09QUyAqIDI7XG4gIGNvbnN0IGJvdW5kYXJpZXMgPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPD0gc2VnczsgaSsrKSB7XG4gICAgY29uc3QgdCA9IGkgLyBzZWdzO1xuICAgIGJvdW5kYXJpZXMucHVzaCh7IHg6IGEueCArIGR4ICogdCwgeTogYS55ICsgZHkgKiB0IH0pO1xuICB9XG4gIGNvbnN0IGFyY2hlcyA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ3M7IGkrKykge1xuICAgIGNvbnN0IHMgPSBib3VuZGFyaWVzW2ldO1xuICAgIGNvbnN0IGUgPSBib3VuZGFyaWVzW2kgKyAxXTtcbiAgICBjb25zdCBpc0Zyb250ID0gaSAlIDIgPT09IDA7XG4gICAgY29uc3Qgc2lnbiA9IGlzRnJvbnQgPyAtMSA6IDE7XG4gICAgY29uc3QgbWlkQXhpc1ggPSAocy54ICsgZS54KSAvIDI7XG4gICAgY29uc3QgbWlkQXhpc1kgPSAocy55ICsgZS55KSAvIDI7XG4gICAgY29uc3QgY3RybFggPSBtaWRBeGlzWCArIHNpZ24gKiBueEF4ICogU1BJUkFMX0FSQ0hfUjtcbiAgICBjb25zdCBjdHJsWSA9IG1pZEF4aXNZICsgc2lnbiAqIG55QXggKiBTUElSQUxfQVJDSF9SO1xuICAgIGFyY2hlcy5wdXNoKHsgcywgZSwgY3RybDogeyB4OiBjdHJsWCwgeTogY3RybFkgfSwgaXNGcm9udCB9KTtcbiAgfVxuICByZXR1cm4geyBhLCBiLCBib3VuZGFyaWVzLCBhcmNoZXMgfTtcbn1cblxuLy8gU2FtcGxlIE4gcG9pbnRzIGFsb25nIG9uZSBxdWFkcmF0aWMgYmV6aWVyIGFyY2hcbmZ1bmN0aW9uIHNhbXBsZVF1YWQocywgY3RybCwgZSwgbikge1xuICBjb25zdCBvdXQgPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyBpKyspIHtcbiAgICBjb25zdCB0ID0gaSAvIG47XG4gICAgY29uc3QgbXQgPSAxIC0gdDtcbiAgICBvdXQucHVzaCh7XG4gICAgICB4OiBtdCAqIG10ICogcy54ICsgMiAqIG10ICogdCAqIGN0cmwueCArIHQgKiB0ICogZS54LFxuICAgICAgeTogbXQgKiBtdCAqIHMueSArIDIgKiBtdCAqIHQgKiBjdHJsLnkgKyB0ICogdCAqIGUueSxcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG4vLyBGbGF0dGVuIHRoZSBlbnRpcmUgc3BpcmFsIHBhdGggaW50byBhIGRlbnNlIHNlcXVlbmNlIG9mIHt4LHl9IHBvaW50cyAoaW4gYm9hcmQgJSBjb29yZHMpLlxuZnVuY3Rpb24gc2FtcGxlU3BpcmFsUGF0aChmcm9tU3EsIHRvU3EsIHNhbXBsZXNQZXJBcmNoID0gMjgpIHtcbiAgY29uc3QgeyBhcmNoZXMgfSA9IGNvbXB1dGVTcGlyYWxHZW9tZXRyeShmcm9tU3EsIHRvU3EpO1xuICBjb25zdCBwdHMgPSBbXTtcbiAgZm9yIChjb25zdCBhciBvZiBhcmNoZXMpIHB0cy5wdXNoKC4uLnNhbXBsZVF1YWQoYXIucywgYXIuY3RybCwgYXIuZSwgc2FtcGxlc1BlckFyY2gpKTtcbiAgY29uc3QgbGFzdCA9IGFyY2hlc1thcmNoZXMubGVuZ3RoIC0gMV0uZTtcbiAgcHRzLnB1c2goeyB4OiBsYXN0LngsIHk6IGxhc3QueSB9KTtcbiAgcmV0dXJuIHB0cztcbn1cblxuY29uc3QgTEFEREVSU19MSVNUID0gW1xuICB7IGZyb206IDQsICB0bzogMTQsIGNvbG9yOiAnI2U4YjIzZScgfSwgIC8vIGdvbGRcbiAgeyBmcm9tOiA5LCAgdG86IDMxLCBjb2xvcjogJyNlODU4M2UnIH0sICAvLyByZWRcbiAgeyBmcm9tOiAyMCwgdG86IDM4LCBjb2xvcjogJyM0YTllNWMnIH0sICAvLyBncmVlblxuICB7IGZyb206IDI4LCB0bzogODQsIGNvbG9yOiAnIzNhN2FjNCcgfSwgIC8vIGJsdWVcbiAgeyBmcm9tOiA0MCwgdG86IDU5LCBjb2xvcjogJyNjNDRhNzgnIH0sICAvLyBwaW5rXG4gIHsgZnJvbTogNTEsIHRvOiA2NywgY29sb3I6ICcjOGY1YWM5JyB9LCAgLy8gcHVycGxlXG4gIHsgZnJvbTogNjMsIHRvOiA4MSwgY29sb3I6ICcjZTg4YzNlJyB9LCAgLy8gb3JhbmdlXG4gIHsgZnJvbTogNzEsIHRvOiA5MSwgY29sb3I6ICcjMmY4ZjgyJyB9LCAgLy8gdGVhbFxuXTtcbmNvbnN0IExBRERFUlMgPSBPYmplY3QuZnJvbUVudHJpZXMoTEFEREVSU19MSVNULm1hcChsID0+IFtsLmZyb20sIGwudG9dKSk7XG5cbi8vIGNvbnZlcnQgMS4uMTAwIHRvIChyb3csIGNvbCkgaW4gYm91c3Ryb3BoZWRvbiwgcm93IDAgPSBib3R0b21cbmZ1bmN0aW9uIHNxdWFyZVRvUkMoc3EpIHtcbiAgY29uc3Qgcm93ID0gTWF0aC5mbG9vcigoc3EgLSAxKSAvIDEwKTtcbiAgY29uc3QgaW5Sb3cgPSAoc3EgLSAxKSAlIDEwO1xuICBjb25zdCBjb2wgPSByb3cgJSAyID09PSAwID8gaW5Sb3cgOiA5IC0gaW5Sb3c7XG4gIHJldHVybiB7IHJvdywgY29sIH07XG59XG5cbi8vIFJldHVybnMge3gseX0gY2VudGVyIGluICUgKDAuLjEwMCkgd2l0aCByb3cgMCBhdCBib3R0b21cbmZ1bmN0aW9uIHNxdWFyZVRvUGN0KHNxKSB7XG4gIGNvbnN0IHsgcm93LCBjb2wgfSA9IHNxdWFyZVRvUkMoc3EpO1xuICBjb25zdCB4ID0gKGNvbCArIDAuNSkgKiAxMDtcbiAgY29uc3QgeSA9IDEwMCAtIChyb3cgKyAwLjUpICogMTA7XG4gIHJldHVybiB7IHgsIHkgfTtcbn1cblxuZnVuY3Rpb24gQm9hcmQoeyBwbGF5ZXJzLCBjdXJyZW50UGxheWVySWR4LCB0b2tlblBvc2l0aW9ucywgaGlnaGxpZ2h0ZWRTcXVhcmUsIHR3ZWFrcyA9IHt9LCBwaGFzZSA9ICd3YWl0aW5nJywgdG9rZW5PdmVycmlkZSA9IG51bGwgfSkge1xuICBjb25zdCBzaG93SGludEFycm93cyA9IHR3ZWFrcy5zaG93SGludEFycm93cyAhPT0gZmFsc2U7XG4gIGNvbnN0IHNob3dHbGlkZVBhdGggPSB0d2Vha3Muc2hvd0dsaWRlUGF0aCAhPT0gZmFsc2U7XG4gIGNvbnN0IGJvYXJkU2NhbGUgPSB0d2Vha3MuYm9hcmRTY2FsZSA/PyAxO1xuICBjb25zdCBib2FyZEJnTW9kZSA9IHR3ZWFrcy5ib2FyZEJnTW9kZSA/PyAnZGFyayc7XG4gIGNvbnN0IHRoZW1lVmFycyA9IGJvYXJkQmdNb2RlID09PSAnbGlnaHQnXG4gICAgPyB7ICctLWJvYXJkLWJnJzogJyNlNmRiYmQnIH1cbiAgICA6IGJvYXJkQmdNb2RlID09PSAnY3JlYW0nXG4gICAgPyB7ICctLWJvYXJkLWJnJzogJyNmNGVjZDgnIH1cbiAgICA6IHsgJy0tYm9hcmQtYmcnOiAnIzFhMWYyZScgfTtcbiAgY29uc3Qgc3F1YXJlcyA9IFtdO1xuICBmb3IgKGxldCByb3cgPSA5OyByb3cgPj0gMDsgcm93LS0pIHtcbiAgICBjb25zdCBudW1zID0gW107XG4gICAgZm9yIChsZXQgYyA9IDA7IGMgPCAxMDsgYysrKSB7XG4gICAgICBjb25zdCBjb2wgPSByb3cgJSAyID09PSAwID8gYyA6IDkgLSBjO1xuICAgICAgbnVtcy5wdXNoKHJvdyAqIDEwICsgY29sICsgMSk7XG4gICAgfVxuICAgIHNxdWFyZXMucHVzaChudW1zKTtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJib2FyZC13cmFwXCIgc3R5bGU9e3sgLi4udGhlbWVWYXJzLCB0cmFuc2Zvcm06IGBzY2FsZSgke2JvYXJkU2NhbGV9KWAsIHRyYW5zZm9ybU9yaWdpbjogJ2NlbnRlciB0b3AnIH19PlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJib2FyZFwiPlxuICAgICAgICB7LyogY2hlY2tlciBzcXVhcmVzICovfVxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvYXJkLWdyaWRcIj5cbiAgICAgICAgICB7c3F1YXJlcy5tYXAoKHJvd051bXMsIHJJZHgpID0+IHJvd051bXMubWFwKChuLCBjSWR4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpc0RhcmsgPSAocklkeCArIGNJZHgpICUgMiA9PT0gMDtcbiAgICAgICAgICAgIGNvbnN0IGlzU3RhcnQgPSBuID09PSAxO1xuICAgICAgICAgICAgY29uc3QgaXNFbmQgPSBuID09PSAxMDA7XG4gICAgICAgICAgICBjb25zdCBpc0NodXRlID0gbiBpbiBDSFVURVM7XG4gICAgICAgICAgICBjb25zdCBpc0xhZGRlciA9IG4gaW4gTEFEREVSUztcbiAgICAgICAgICAgIGNvbnN0IGlzUG9ydGFsID0gUE9SVEFMX1NRVUFSRVMuaGFzKG4pO1xuICAgICAgICAgICAgY29uc3QgaXNIaWdobGlnaHQgPSBoaWdobGlnaHRlZFNxdWFyZSA9PT0gbjtcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICBrZXk9e259XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgc3EgJHtpc0RhcmsgPyAnZGFyaycgOiAnbGlnaHQnfSAke2lzSGlnaGxpZ2h0ID8gJ2hsJyA6ICcnfWB9XG4gICAgICAgICAgICAgICAgc3R5bGU9e3sgZ3JpZFJvdzogcklkeCArIDEsIGdyaWRDb2x1bW46IGNJZHggKyAxIH19XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJzcS1udW0gbW9ub1wiPntufTwvc3Bhbj5cbiAgICAgICAgICAgICAgICB7aXNTdGFydCAmJiA8c3BhbiBjbGFzc05hbWU9XCJzcS10YWdcIj5TVEFSVDwvc3Bhbj59XG4gICAgICAgICAgICAgICAge2lzRW5kICYmIDxzcGFuIGNsYXNzTmFtZT1cInNxLXRhZyBnb2xkXCI+RklOSVNIPC9zcGFuPn1cbiAgICAgICAgICAgICAgICB7aXNDaHV0ZSAmJiAhaXNQb3J0YWwgJiYgc2hvd0hpbnRBcnJvd3MgJiYgPHNwYW4gY2xhc3NOYW1lPVwic3EtZG90IGNodXRlXCIgdGl0bGU9e2BDaHV0ZSB0byAke0NIVVRFU1tuXX1gfT7ilr48L3NwYW4+fVxuICAgICAgICAgICAgICAgIHtpc1BvcnRhbCAmJiBzaG93SGludEFycm93cyAmJiA8c3BhbiBjbGFzc05hbWU9XCJzcS1kb3QgcG9ydGFsXCIgdGl0bGU9XCJSYW5kb20gdHJhbnNwb3J0IHBvcnRhbFwiPuKcpjwvc3Bhbj59XG4gICAgICAgICAgICAgICAge2lzTGFkZGVyICYmIHNob3dIaW50QXJyb3dzICYmIDxzcGFuIGNsYXNzTmFtZT1cInNxLWRvdCBsYWRkZXJcIiB0aXRsZT17YExhZGRlciB0byAke0xBRERFUlNbbl19YH0+4pa0PC9zcGFuPn1cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pKX1cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIFNWRyBvdmVybGF5IGZvciBjaHV0ZXMgYW5kIGxhZGRlcnMgLSAzRCAqL31cbiAgICAgICAgPHN2ZyBjbGFzc05hbWU9XCJib2FyZC1zdmdcIiB2aWV3Qm94PVwiMCAwIDEwMCAxMDBcIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwibm9uZVwiPlxuICAgICAgICAgIDxkZWZzPlxuICAgICAgICAgICAgPGZpbHRlciBpZD1cImNhc3RTaGFkb3dTb2Z0XCIgeD1cIi01MCVcIiB5PVwiLTUwJVwiIHdpZHRoPVwiMjAwJVwiIGhlaWdodD1cIjIwMCVcIj5cbiAgICAgICAgICAgICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj1cIjEuOFwiLz5cbiAgICAgICAgICAgIDwvZmlsdGVyPlxuICAgICAgICAgICAgPGZpbHRlciBpZD1cImNhc3RTaGFkb3dIZWF2eVwiIHg9XCItNTAlXCIgeT1cIi01MCVcIiB3aWR0aD1cIjIwMCVcIiBoZWlnaHQ9XCIyMDAlXCI+XG4gICAgICAgICAgICAgIDxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249XCIyLjRcIi8+XG4gICAgICAgICAgICA8L2ZpbHRlcj5cbiAgICAgICAgICA8L2RlZnM+XG5cbiAgICAgICAgICB7LyogPT09PT09PT0gTEFEREVSUyAocGVyLWl0ZW0gY29sb3JlZCB3b29kKSA9PT09PT09PSAqL31cbiAgICAgICAgICB7TEFEREVSU19MSVNULm1hcCgoeyBmcm9tLCB0bywgY29sb3IgfSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYSA9IHNxdWFyZVRvUGN0KCtmcm9tKTtcbiAgICAgICAgICAgIGNvbnN0IGIgPSBzcXVhcmVUb1BjdCgrdG8pO1xuICAgICAgICAgICAgY29uc3QgZHggPSBiLnggLSBhLngsIGR5ID0gYi55IC0gYS55O1xuICAgICAgICAgICAgY29uc3QgbGVuID0gTWF0aC5oeXBvdChkeCwgZHkpO1xuICAgICAgICAgICAgY29uc3QgYW5nID0gTWF0aC5hdGFuMihkeSwgZHgpICogMTgwIC8gTWF0aC5QSTtcbiAgICAgICAgICAgIGNvbnN0IHcgPSAzLjg7XG4gICAgICAgICAgICBjb25zdCBudW1SdW5ncyA9IE1hdGgubWF4KDMsIE1hdGguZmxvb3IobGVuIC8gMi4zKSk7XG4gICAgICAgICAgICBjb25zdCBzaGFkZSA9IChoZXgsIGFtdCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBuID0gcGFyc2VJbnQoaGV4LnNsaWNlKDEpLCAxNik7XG4gICAgICAgICAgICAgIGNvbnN0IHIgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigyNTUsICgobiA+PiAxNikgJiAyNTUpICsgYW10KSk7XG4gICAgICAgICAgICAgIGNvbnN0IGcgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigyNTUsICgobiA+PiA4KSAmIDI1NSkgKyBhbXQpKTtcbiAgICAgICAgICAgICAgY29uc3QgYmwgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigyNTUsIChuICYgMjU1KSArIGFtdCkpO1xuICAgICAgICAgICAgICByZXR1cm4gYHJnYigke3J8MH0sJHtnfDB9LCR7Ymx8MH0pYDtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCByTGlnaHQgPSBzaGFkZShjb2xvciwgNzApO1xuICAgICAgICAgICAgY29uc3Qgck1pZCA9IGNvbG9yO1xuICAgICAgICAgICAgY29uc3QgckRhcmsgPSBzaGFkZShjb2xvciwgLTQ1KTtcbiAgICAgICAgICAgIGNvbnN0IHJEYXJrZXIgPSBzaGFkZShjb2xvciwgLTg1KTtcbiAgICAgICAgICAgIGNvbnN0IHVpZCA9IGBsYWQtJHtmcm9tfWA7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8ZyBrZXk9eydsJyArIGZyb219IHRyYW5zZm9ybT17YHRyYW5zbGF0ZSgke2EueH0gJHthLnl9KSByb3RhdGUoJHthbmd9KWB9PlxuICAgICAgICAgICAgICAgIDxkZWZzPlxuICAgICAgICAgICAgICAgICAgPGxpbmVhckdyYWRpZW50IGlkPXtgJHt1aWR9LXJhaWxgfSB4MT1cIjBcIiB5MT1cIjBcIiB4Mj1cIjBcIiB5Mj1cIjFcIj5cbiAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wQ29sb3I9e3JMaWdodH0vPlxuICAgICAgICAgICAgICAgICAgICA8c3RvcCBvZmZzZXQ9XCI1MCVcIiBzdG9wQ29sb3I9e3JNaWR9Lz5cbiAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3BDb2xvcj17ckRhcmt9Lz5cbiAgICAgICAgICAgICAgICAgIDwvbGluZWFyR3JhZGllbnQ+XG4gICAgICAgICAgICAgICAgICA8bGluZWFyR3JhZGllbnQgaWQ9e2Ake3VpZH0tcnVuZ2B9IHgxPVwiMFwiIHkxPVwiMFwiIHgyPVwiMFwiIHkyPVwiMVwiPlxuICAgICAgICAgICAgICAgICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3BDb2xvcj17ckxpZ2h0fS8+XG4gICAgICAgICAgICAgICAgICAgIDxzdG9wIG9mZnNldD1cIjUwJVwiIHN0b3BDb2xvcj17ck1pZH0vPlxuICAgICAgICAgICAgICAgICAgICA8c3RvcCBvZmZzZXQ9XCIxMDAlXCIgc3RvcENvbG9yPXtyRGFya2VyfS8+XG4gICAgICAgICAgICAgICAgICA8L2xpbmVhckdyYWRpZW50PlxuICAgICAgICAgICAgICAgIDwvZGVmcz5cbiAgICAgICAgICAgICAgICB7LyogY2FzdCBzaGFkb3cgKi99XG4gICAgICAgICAgICAgICAgPGcgdHJhbnNmb3JtPVwidHJhbnNsYXRlKDAuOSAxLjUpXCIgb3BhY2l0eT1cIjAuNFwiPlxuICAgICAgICAgICAgICAgICAgPHJlY3QgeD1cIi0xXCIgeT17LXcvMiAtIDAuMn0gd2lkdGg9e2xlbiArIDJ9IGhlaWdodD1cIjAuOVwiIGZpbGw9XCIjMDAwXCIgZmlsdGVyPVwidXJsKCNjYXN0U2hhZG93U29mdClcIi8+XG4gICAgICAgICAgICAgICAgICA8cmVjdCB4PVwiLTFcIiB5PXt3LzIgLSAwLjd9IHdpZHRoPXtsZW4gKyAyfSBoZWlnaHQ9XCIwLjlcIiBmaWxsPVwiIzAwMFwiIGZpbHRlcj1cInVybCgjY2FzdFNoYWRvd1NvZnQpXCIvPlxuICAgICAgICAgICAgICAgIDwvZz5cbiAgICAgICAgICAgICAgICB7LyogYmFjay1mYWNlIChkYXJrIHNpZGUpIHJhaWxzIGZvciAzRCBkZXB0aCAqL31cbiAgICAgICAgICAgICAgICA8cmVjdCB4PVwiLTAuOVwiIHk9ey13LzIgKyAwLjF9IHdpZHRoPXtsZW4gKyAxLjh9IGhlaWdodD1cIjEuMVwiIGZpbGw9e3JEYXJrZXJ9IHJ4PVwiMC4zXCIvPlxuICAgICAgICAgICAgICAgIDxyZWN0IHg9XCItMC45XCIgeT17dy8yIC0gMS4yfSB3aWR0aD17bGVuICsgMS44fSBoZWlnaHQ9XCIxLjFcIiBmaWxsPXtyRGFya2VyfSByeD1cIjAuM1wiLz5cbiAgICAgICAgICAgICAgICB7LyogZnJvbnQgZmFjZSByYWlscyAqL31cbiAgICAgICAgICAgICAgICA8cmVjdCB4PVwiLTAuOVwiIHk9ey13LzIgLSAwLjJ9IHdpZHRoPXtsZW4gKyAxLjh9IGhlaWdodD1cIjEuMFwiIGZpbGw9e2B1cmwoIyR7dWlkfS1yYWlsKWB9IHJ4PVwiMC4zNVwiIHN0cm9rZT17ckRhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjFcIi8+XG4gICAgICAgICAgICAgICAgPHJlY3QgeD1cIi0wLjlcIiB5PXt3LzIgLSAwLjh9IHdpZHRoPXtsZW4gKyAxLjh9IGhlaWdodD1cIjEuMFwiIGZpbGw9e2B1cmwoIyR7dWlkfS1yYWlsKWB9IHJ4PVwiMC4zNVwiIHN0cm9rZT17ckRhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjFcIi8+XG4gICAgICAgICAgICAgICAgey8qIHRvcCBoaWdobGlnaHQgYWxvbmcgZWFjaCByYWlsICovfVxuICAgICAgICAgICAgICAgIDxsaW5lIHgxPVwiLTAuNVwiIHkxPXstdy8yICsgMC4wfSB4Mj17bGVuICsgMC41fSB5Mj17LXcvMiArIDAuMH0gc3Ryb2tlPVwid2hpdGVcIiBzdHJva2VXaWR0aD1cIjAuMlwiIG9wYWNpdHk9XCIwLjg1XCIgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIvPlxuICAgICAgICAgICAgICAgIDxsaW5lIHgxPVwiLTAuNVwiIHkxPXt3LzIgLSAwLjZ9IHgyPXtsZW4gKyAwLjV9IHkyPXt3LzIgLSAwLjZ9IHN0cm9rZT1cIndoaXRlXCIgc3Ryb2tlV2lkdGg9XCIwLjJcIiBvcGFjaXR5PVwiMC44NVwiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICAgICAgICAgICAgICB7LyogcnVuZ3Mgd2l0aCBkZXB0aCAqL31cbiAgICAgICAgICAgICAgICB7QXJyYXkuZnJvbSh7IGxlbmd0aDogbnVtUnVuZ3MgfSkubWFwKChfLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgICBjb25zdCB0ID0gKGkgKyAwLjUpIC8gbnVtUnVuZ3M7XG4gICAgICAgICAgICAgICAgICBjb25zdCBjeCA9IHQgKiBsZW47XG4gICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICA8ZyBrZXk9eydycycgKyBpfT5cbiAgICAgICAgICAgICAgICAgICAgICB7LyogcnVuZyBiYWNrL3VuZGVyc2lkZSAqL31cbiAgICAgICAgICAgICAgICAgICAgICA8cmVjdCB4PXtjeCAtIDAuNDJ9IHk9ey13LzIgKyAwLjV9IHdpZHRoPVwiMC45MlwiIGhlaWdodD17dyAtIDAuMn0gZmlsbD17ckRhcmtlcn0vPlxuICAgICAgICAgICAgICAgICAgICAgIHsvKiBydW5nIGZyb250ICovfVxuICAgICAgICAgICAgICAgICAgICAgIDxyZWN0IHg9e2N4IC0gMC40NX0geT17LXcvMiArIDAuMjV9IHdpZHRoPVwiMC45XCIgaGVpZ2h0PXt3IC0gMC40fSBmaWxsPXtgdXJsKCMke3VpZH0tcnVuZylgfSByeD1cIjAuMlwiIHN0cm9rZT17ckRhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjA4XCIvPlxuICAgICAgICAgICAgICAgICAgICAgIHsvKiBzaGVlbiAqL31cbiAgICAgICAgICAgICAgICAgICAgICA8bGluZSB4MT17Y3ggLSAwLjM1fSB5MT17LXcvMiArIDAuNH0geDI9e2N4IC0gMC4zNX0geTI9e3cvMiAtIDAuM30gc3Ryb2tlPVwid2hpdGVcIiBzdHJva2VXaWR0aD1cIjAuMTJcIiBvcGFjaXR5PVwiMC43XCIvPlxuICAgICAgICAgICAgICAgICAgICA8L2c+XG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0pfVxuICAgICAgICAgICAgICAgIHsvKiBlbmQgY2FwcyBib2x0cyAqL31cbiAgICAgICAgICAgICAgICB7W1stMC4zLCAtdy8yICsgMC4zXSwgW2xlbiArIDAuMywgLXcvMiArIDAuM10sIFstMC4zLCB3LzIgLSAwLjNdLCBbbGVuICsgMC4zLCB3LzIgLSAwLjNdXS5tYXAoKFtieCwgYnldLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgICA8ZyBrZXk9eydiJyArIGl9PlxuICAgICAgICAgICAgICAgICAgICA8Y2lyY2xlIGN4PXtieH0gY3k9e2J5fSByPVwiMC40XCIgZmlsbD17ckxpZ2h0fS8+XG4gICAgICAgICAgICAgICAgICAgIDxjaXJjbGUgY3g9e2J4IC0gMC4xfSBjeT17YnkgLSAwLjF9IHI9XCIwLjE1XCIgZmlsbD1cIndoaXRlXCIgb3BhY2l0eT1cIjAuOFwiLz5cbiAgICAgICAgICAgICAgICAgICAgPGNpcmNsZSBjeD17Ynh9IGN5PXtieX0gcj1cIjAuMThcIiBmaWxsPXtyRGFya2VyfS8+XG4gICAgICAgICAgICAgICAgICA8L2c+XG4gICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgIDwvZz5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSl9XG5cbiAgICAgICAgICB7LyogPT09PT09PT0gQ0hVVEVTIGFzIFBMQVlHUk9VTkQgU0xJREVTIChvcGVuIGN1cnZlZCBzbGlkZXMpID09PT09PT09ICovfVxuICAgICAgICAgIHtDSFVURVNfTElTVC5tYXAoKHsgZnJvbSwgdG8sIGNvbG9yLCBzcGlyYWwsIHBvcnRhbCB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzaGFkZUhleCA9IChoZXgsIGFtdCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBuID0gcGFyc2VJbnQoaGV4LnNsaWNlKDEpLCAxNik7XG4gICAgICAgICAgICAgIGNvbnN0IHIgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigyNTUsICgobiA+PiAxNikgJiAyNTUpICsgYW10KSk7XG4gICAgICAgICAgICAgIGNvbnN0IGcgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigyNTUsICgobiA+PiA4KSAmIDI1NSkgKyBhbXQpKTtcbiAgICAgICAgICAgICAgY29uc3QgYmwgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigyNTUsIChuICYgMjU1KSArIGFtdCkpO1xuICAgICAgICAgICAgICByZXR1cm4gYHJnYigke3J8MH0sJHtnfDB9LCR7Ymx8MH0pYDtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAocG9ydGFsKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHAgPSBzcXVhcmVUb1BjdCgrZnJvbSk7XG4gICAgICAgICAgICAgIGNvbnN0IHVpZFAgPSBgcG9ydGFsLSR7ZnJvbX1gO1xuICAgICAgICAgICAgICBjb25zdCBjTCA9IHNoYWRlSGV4KGNvbG9yLCA5MCk7XG4gICAgICAgICAgICAgIGNvbnN0IGNNID0gY29sb3I7XG4gICAgICAgICAgICAgIGNvbnN0IGNEID0gc2hhZGVIZXgoY29sb3IsIC00MCk7XG4gICAgICAgICAgICAgIGNvbnN0IGNERCA9IHNoYWRlSGV4KGNvbG9yLCAtODApO1xuICAgICAgICAgICAgICAvLyBBbGwgcG9ydGFsIGFydCBpcyBkcmF3biBpbiBhIExPQ0FMIGNvb3JkIHN5c3RlbSAodHJhbnNsYXRlZCB0byB0aGUgY2VsbFxuICAgICAgICAgICAgICAvLyBjZW50ZXIpIHNvIGV2ZXJ5IGFuaW1hdGVkIHN1Ymdyb3VwIHJvdGF0ZXMgYXJvdW5kIGl0cyBuYXR1cmFsIG9yaWdpbiAoMCwwKS5cbiAgICAgICAgICAgICAgLy8gdHJhbnNmb3JtLWJveDogZmlsbC1ib3ggaXMgdW5yZWxpYWJsZSBvbiA8Zz4gYWNyb3NzIGJyb3dzZXJzIOKAlCB1c2luZyBuZXN0ZWRcbiAgICAgICAgICAgICAgLy8gdHJhbnNsYXRlICsgbG9jYWwgY29vcmRzIGlzIHRoZSByb2NrLXNvbGlkIGFwcHJvYWNoIGF0IGFueSB6b29tIGxldmVsLlxuICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIDxnIGtleT17J3AnICsgZnJvbX0gdHJhbnNmb3JtPXtgdHJhbnNsYXRlKCR7cC54fSAke3AueX0pYH0+XG4gICAgICAgICAgICAgICAgICA8ZGVmcz5cbiAgICAgICAgICAgICAgICAgICAgPHJhZGlhbEdyYWRpZW50IGlkPXtgJHt1aWRQfS1jb3JlYH0gY3g9XCIwLjVcIiBjeT1cIjAuNVwiIHI9XCIwLjU1XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wQ29sb3I9XCIjZmZmXCIgc3RvcE9wYWNpdHk9XCIxXCIvPlxuICAgICAgICAgICAgICAgICAgICAgIDxzdG9wIG9mZnNldD1cIjE4JVwiIHN0b3BDb2xvcj17Y0x9IHN0b3BPcGFjaXR5PVwiMC45NVwiLz5cbiAgICAgICAgICAgICAgICAgICAgICA8c3RvcCBvZmZzZXQ9XCI1NSVcIiBzdG9wQ29sb3I9e2NNfSBzdG9wT3BhY2l0eT1cIjAuODVcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiOTAlXCIgc3RvcENvbG9yPXtjRH0gc3RvcE9wYWNpdHk9XCIwLjVcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3BDb2xvcj17Y0REfSBzdG9wT3BhY2l0eT1cIjBcIi8+XG4gICAgICAgICAgICAgICAgICAgIDwvcmFkaWFsR3JhZGllbnQ+XG4gICAgICAgICAgICAgICAgICAgIDxyYWRpYWxHcmFkaWVudCBpZD17YCR7dWlkUH0tcmluZ2B9IGN4PVwiMC41XCIgY3k9XCIwLjVcIiByPVwiMC41XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wQ29sb3I9e2NMfSBzdG9wT3BhY2l0eT1cIjBcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiNzUlXCIgc3RvcENvbG9yPXtjTX0gc3RvcE9wYWNpdHk9XCIwLjdcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3BDb2xvcj17Y0REfSBzdG9wT3BhY2l0eT1cIjBcIi8+XG4gICAgICAgICAgICAgICAgICAgIDwvcmFkaWFsR3JhZGllbnQ+XG4gICAgICAgICAgICAgICAgICA8L2RlZnM+XG4gICAgICAgICAgICAgICAgICB7LyogY2FzdCBzaGFkb3cgKi99XG4gICAgICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD1cIjAuOFwiIGN5PVwiMS4yXCIgcng9XCI1XCIgcnk9XCIxLjVcIiBmaWxsPVwiIzAwMFwiIG9wYWNpdHk9XCIwLjNcIiBmaWx0ZXI9XCJ1cmwoI2Nhc3RTaGFkb3dTb2Z0KVwiLz5cbiAgICAgICAgICAgICAgICAgIHsvKiBvdXRlciByaW5nICovfVxuICAgICAgICAgICAgICAgICAgPGNpcmNsZSBjeD1cIjBcIiBjeT1cIjBcIiByPVwiNC40XCIgZmlsbD17YHVybCgjJHt1aWRQfS1yaW5nKWB9Lz5cbiAgICAgICAgICAgICAgICAgIHsvKiBzd2lybCBhcm1zIOKAlCByb3RhdGUgYXJvdW5kICgwLDApIHdoaWNoIGlzIHRoZSBjZWxsIGNlbnRlciBpbiB0aGVcbiAgICAgICAgICAgICAgICAgICAgICB0cmFuc2xhdGVkIGZyYW1lLiBDU1MncyBkZWZhdWx0IHRyYW5zZm9ybS1vcmlnaW4gZm9yIFNWRyBlbGVtZW50cyBpc1xuICAgICAgICAgICAgICAgICAgICAgIDAgMCwgc28gbm8gdHJhbnNmb3JtLW9yaWdpbiBkZWNsYXJhdGlvbiBpcyBuZWVkZWQuICovfVxuICAgICAgICAgICAgICAgICAgPGcgc3R5bGU9e3sgYW5pbWF0aW9uOiAncG9ydGFsLXNwaW4gNHMgbGluZWFyIGluZmluaXRlJyB9fT5cbiAgICAgICAgICAgICAgICAgICAge1swLCA2MCwgMTIwLCAxODAsIDI0MCwgMzAwXS5tYXAoKGRlZykgPT4gKFxuICAgICAgICAgICAgICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXk9e2RlZ31cbiAgICAgICAgICAgICAgICAgICAgICAgIGQ9XCJNIDAgMCBtIC0wLjQgMCBhIDMuNCAzLjQgMCAwIDEgMy40IC0zLjRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtPXtgcm90YXRlKCR7ZGVnfSlgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbD1cIm5vbmVcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc3Ryb2tlPXtjTH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZVdpZHRoPVwiMC41NVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJva2VMaW5lY2FwPVwicm91bmRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgb3BhY2l0eT1cIjAuODVcIlxuICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgPC9nPlxuICAgICAgICAgICAgICAgICAgey8qIGlubmVyIGNvdW50ZXItcm90YXRpbmcgc3dpcmwgKi99XG4gICAgICAgICAgICAgICAgICA8ZyBzdHlsZT17eyBhbmltYXRpb246ICdwb3J0YWwtc3Bpbi1yZXYgMi41cyBsaW5lYXIgaW5maW5pdGUnIH19PlxuICAgICAgICAgICAgICAgICAgICB7WzMwLCAxNTAsIDI3MF0ubWFwKChkZWcpID0+IChcbiAgICAgICAgICAgICAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtkZWd9XG4gICAgICAgICAgICAgICAgICAgICAgICBkPVwiTSAwIDAgbSAtMC4zIDAgYSAyLjIgMi4yIDAgMCAxIDIuMiAtMi4yXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybT17YHJvdGF0ZSgke2RlZ30pYH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGw9XCJub25lXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZT1cIiNmZmZcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc3Ryb2tlV2lkdGg9XCIwLjQ1XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBvcGFjaXR5PVwiMC45XCJcbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgIDwvZz5cbiAgICAgICAgICAgICAgICAgIHsvKiBnbG93aW5nIGNvcmUg4oCUIHNjYWxlIHB1bHNlIG5hdHVyYWxseSBwaXZvdHMgb24gKDAsMCkgc2luY2UgdGhlIGNpcmNsZVxuICAgICAgICAgICAgICAgICAgICAgIGlzIGNlbnRlcmVkIHRoZXJlLCBzbyBubyB0cmFuc2Zvcm0tb3JpZ2luIG92ZXJyaWRlIGlzIG5lZWRlZC4gKi99XG4gICAgICAgICAgICAgICAgICA8Y2lyY2xlIGN4PVwiMFwiIGN5PVwiMFwiIHI9XCIzLjRcIiBmaWxsPXtgdXJsKCMke3VpZFB9LWNvcmUpYH1cbiAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgYW5pbWF0aW9uOiAncG9ydGFsLXB1bHNlIDEuNnMgZWFzZS1pbi1vdXQgaW5maW5pdGUnIH19Lz5cbiAgICAgICAgICAgICAgICAgIHsvKiBzdGFyIHNwZWNrcyBvcmJpdGluZyAqL31cbiAgICAgICAgICAgICAgICAgIDxnIHN0eWxlPXt7IGFuaW1hdGlvbjogJ3BvcnRhbC1zcGluIDNzIGxpbmVhciBpbmZpbml0ZScgfX0+XG4gICAgICAgICAgICAgICAgICAgIHtbMCwgNzIsIDE0NCwgMjE2LCAyODhdLm1hcCgoZGVnKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmFkID0gMy45O1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFuZyA9IGRlZyAqIE1hdGguUEkgLyAxODA7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxjaXJjbGUga2V5PXtkZWd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGN4PXtNYXRoLmNvcyhhbmcpICogcmFkfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBjeT17TWF0aC5zaW4oYW5nKSAqIHJhZH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgcj1cIjAuMzVcIiBmaWxsPVwiI2ZmZlwiIG9wYWNpdHk9XCIwLjk1XCIvPlxuICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH0pfVxuICAgICAgICAgICAgICAgICAgPC9nPlxuICAgICAgICAgICAgICAgIDwvZz5cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzcGlyYWwpIHtcbiAgICAgICAgICAgICAgLy8gQmlnIDNEIGNvaWxlZCB3YXRlci1zbGlkZSB0dWJlIOKAlCBpbnNwaXJlZCBieSBhIHJlYWwgc3BpcmFsIHdhdGVyIHNsaWRlLlxuICAgICAgICAgICAgICAvLyBVc2VzIHRoZSBzaGFyZWQgc3BpcmFsIGdlb21ldHJ5IChzYW1lIHBhdGggZGF0YSBkcml2ZXMgdGhlIHRva2VuJ3Mgc2xpZGUgYW5pbWF0aW9uKS5cbiAgICAgICAgICAgICAgY29uc3QgZ2VvID0gY29tcHV0ZVNwaXJhbEdlb21ldHJ5KCtmcm9tLCArdG8pO1xuICAgICAgICAgICAgICBjb25zdCB7IGEsIGIsIGFyY2hlcywgYm91bmRhcmllcyB9ID0gZ2VvO1xuICAgICAgICAgICAgICBjb25zdCB1aWRTID0gYHNwLSR7ZnJvbX1gO1xuICAgICAgICAgICAgICBjb25zdCBjTCA9IHNoYWRlSGV4KGNvbG9yLCA5MCk7XG4gICAgICAgICAgICAgIGNvbnN0IGNNID0gY29sb3I7XG4gICAgICAgICAgICAgIGNvbnN0IGNEID0gc2hhZGVIZXgoY29sb3IsIC00NSk7XG4gICAgICAgICAgICAgIGNvbnN0IGNERCA9IHNoYWRlSGV4KGNvbG9yLCAtODUpO1xuICAgICAgICAgICAgICBjb25zdCBjREREID0gc2hhZGVIZXgoY29sb3IsIC0xMTUpO1xuICAgICAgICAgICAgICBjb25zdCB0dWJlVyA9IFNQSVJBTF9UVUJFX1c7XG4gICAgICAgICAgICAgIGNvbnN0IGFyY2hSID0gU1BJUkFMX0FSQ0hfUjtcbiAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICA8ZyBrZXk9eydzJyArIGZyb219PlxuICAgICAgICAgICAgICAgICAgPGRlZnM+XG4gICAgICAgICAgICAgICAgICAgIHsvKiBIb3Jpem9udGFsIGdyYWRpZW50IGdpdmVzIHRoZSB0dWJlIGEgY3lsaW5kcmljYWwgXCJyb3VuZFwiIGZlZWwgYWxvbmcgaXRzIGxlbmd0aCAqL31cbiAgICAgICAgICAgICAgICAgICAgPGxpbmVhckdyYWRpZW50IGlkPXtgJHt1aWRTfS10dWJlYH0geDE9XCIwXCIgeTE9XCIwXCIgeDI9XCIwXCIgeTI9XCIxXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wQ29sb3I9e2NMfS8+XG4gICAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMzAlXCIgc3RvcENvbG9yPXtjTX0vPlxuICAgICAgICAgICAgICAgICAgICAgIDxzdG9wIG9mZnNldD1cIjcyJVwiIHN0b3BDb2xvcj17Y0R9Lz5cbiAgICAgICAgICAgICAgICAgICAgICA8c3RvcCBvZmZzZXQ9XCIxMDAlXCIgc3RvcENvbG9yPXtjRER9Lz5cbiAgICAgICAgICAgICAgICAgICAgPC9saW5lYXJHcmFkaWVudD5cbiAgICAgICAgICAgICAgICAgICAgey8qIElubmVyIGJvcmUgKGRhcmsgdHViZSBpbnRlcmlvciBzZWVuIGZyb20gZW5kcyAmIGp1bmN0aW9ucykgKi99XG4gICAgICAgICAgICAgICAgICAgIDxyYWRpYWxHcmFkaWVudCBpZD17YCR7dWlkU30tYm9yZWB9IGN4PVwiMC41XCIgY3k9XCIwLjRcIiByPVwiMC42XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wQ29sb3I9e2NERER9IHN0b3BPcGFjaXR5PVwiMC45NVwiLz5cbiAgICAgICAgICAgICAgICAgICAgICA8c3RvcCBvZmZzZXQ9XCI2MCVcIiBzdG9wQ29sb3I9e2NERER9IHN0b3BPcGFjaXR5PVwiMC43XCIvPlxuICAgICAgICAgICAgICAgICAgICAgIDxzdG9wIG9mZnNldD1cIjEwMCVcIiBzdG9wQ29sb3I9e2NERH0gc3RvcE9wYWNpdHk9XCIwLjFcIi8+XG4gICAgICAgICAgICAgICAgICAgIDwvcmFkaWFsR3JhZGllbnQ+XG4gICAgICAgICAgICAgICAgICAgIDxmaWx0ZXIgaWQ9e2Ake3VpZFN9LXBvcGB9IHg9XCItMzAlXCIgeT1cIi0zMCVcIiB3aWR0aD1cIjE2MCVcIiBoZWlnaHQ9XCIxNjAlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGZlR2F1c3NpYW5CbHVyIGluPVwiU291cmNlQWxwaGFcIiBzdGREZXZpYXRpb249XCIxLjZcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgPGZlT2Zmc2V0IGR4PVwiMS4yXCIgZHk9XCIyLjRcIiByZXN1bHQ9XCJvZmZzZXRibHVyXCIvPlxuICAgICAgICAgICAgICAgICAgICAgIDxmZUNvbXBvbmVudFRyYW5zZmVyPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGZlRnVuY0EgdHlwZT1cImxpbmVhclwiIHNsb3BlPVwiMC41NVwiLz5cbiAgICAgICAgICAgICAgICAgICAgICA8L2ZlQ29tcG9uZW50VHJhbnNmZXI+XG4gICAgICAgICAgICAgICAgICAgICAgPGZlTWVyZ2U+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZmVNZXJnZU5vZGUvPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGZlTWVyZ2VOb2RlIGluPVwiU291cmNlR3JhcGhpY1wiLz5cbiAgICAgICAgICAgICAgICAgICAgICA8L2ZlTWVyZ2U+XG4gICAgICAgICAgICAgICAgICAgIDwvZmlsdGVyPlxuICAgICAgICAgICAgICAgICAgPC9kZWZzPlxuXG4gICAgICAgICAgICAgICAgICB7LyogQmlnLCBjaHVua3kgZ3JvdW5kIHNoYWRvdyB1bmRlcm5lYXRoICovfVxuICAgICAgICAgICAgICAgICAgPGcgdHJhbnNmb3JtPVwidHJhbnNsYXRlKDIuNCAzLjgpXCIgb3BhY2l0eT1cIjAuNTVcIiBmaWx0ZXI9XCJ1cmwoI2Nhc3RTaGFkb3dIZWF2eSlcIj5cbiAgICAgICAgICAgICAgICAgICAge2FyY2hlcy5tYXAoKGFyLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgPHBhdGgga2V5PXsnc2hkJyArIGl9XG4gICAgICAgICAgICAgICAgICAgICAgICBkPXtgTSAke2FyLnMueH0gJHthci5zLnl9IFEgJHthci5jdHJsLnh9ICR7YXIuY3RybC55fSAke2FyLmUueH0gJHthci5lLnl9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiIzAwMFwiIHN0cm9rZVdpZHRoPXt0dWJlVyArIDIuMH0gc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIvPlxuICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgIDwvZz5cblxuICAgICAgICAgICAgICAgICAgey8qIEJBQ0sgYXJjaGVzIOKAlCBkYXJrZXIsIGRyYXduIGZpcnN0IHNvIGZyb250IGFyY2hlcyBjb3ZlciB0aGVtICovfVxuICAgICAgICAgICAgICAgICAge2FyY2hlcy5maWx0ZXIoYXIgPT4gIWFyLmlzRnJvbnQpLm1hcCgoYXIsIGkpID0+IChcbiAgICAgICAgICAgICAgICAgICAgPGcga2V5PXsnYmsnICsgaX0+XG4gICAgICAgICAgICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgIGQ9e2BNICR7YXIucy54fSAke2FyLnMueX0gUSAke2FyLmN0cmwueH0gJHthci5jdHJsLnl9ICR7YXIuZS54fSAke2FyLmUueX1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbD1cIm5vbmVcIiBzdHJva2U9e2NERER9IHN0cm9rZVdpZHRoPXt0dWJlVyArIDEuMH0gc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIvPlxuICAgICAgICAgICAgICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICBkPXtgTSAke2FyLnMueH0gJHthci5zLnl9IFEgJHthci5jdHJsLnh9ICR7YXIuY3RybC55fSAke2FyLmUueH0gJHthci5lLnl9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGw9XCJub25lXCIgc3Ryb2tlPXtjRER9IHN0cm9rZVdpZHRoPXt0dWJlVyArIDAuMn0gc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIgb3BhY2l0eT1cIjAuOTVcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgIGQ9e2BNICR7YXIucy54fSAke2FyLnMueX0gUSAke2FyLmN0cmwueH0gJHthci5jdHJsLnl9ICR7YXIuZS54fSAke2FyLmUueX1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbD1cIm5vbmVcIiBzdHJva2U9e2NEfSBzdHJva2VXaWR0aD17dHViZVcgLSAxLjN9IHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiIG9wYWNpdHk9XCIwLjlcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgey8qIHN1YnRsZSB0b3Agc2hlZW4gb24gYmFjayBsb29wcyAqL31cbiAgICAgICAgICAgICAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgICAgICAgICAgICAgZD17YE0gJHthci5zLnh9ICR7YXIucy55fSBRICR7YXIuY3RybC54fSAke2FyLmN0cmwueSArIDAuMTV9ICR7YXIuZS54fSAke2FyLmUueX1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbD1cIm5vbmVcIiBzdHJva2U9e2NMfSBzdHJva2VXaWR0aD1cIjAuM1wiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiIG9wYWNpdHk9XCIwLjM1XCIvPlxuICAgICAgICAgICAgICAgICAgICA8L2c+XG4gICAgICAgICAgICAgICAgICApKX1cblxuICAgICAgICAgICAgICAgICAgey8qIFVuZGVyY2FycmlhZ2Ugc3RhY2sgZm9yIGZyb250IGFyY2hlcyDigJQgZGVlcCBvZmZzZXQgbGF5ZXJzIG1ha2UgdGhlIHR1YmVcbiAgICAgICAgICAgICAgICAgICAgICByZWFkIGFzIHRoaWNrIGV4dHJ1ZGVkIHBsYXN0aWMgZmxvYXRpbmcgYWJvdmUgdGhlIGJvYXJkICovfVxuICAgICAgICAgICAgICAgICAge2FyY2hlcy5maWx0ZXIoYXIgPT4gYXIuaXNGcm9udCkubWFwKChhciwgaSkgPT4gKFxuICAgICAgICAgICAgICAgICAgICA8ZyBrZXk9eyd1bicgKyBpfT5cbiAgICAgICAgICAgICAgICAgICAgICB7LyogZGVlcCBiYWNrLXNoYWRvdyBsYXllciAqL31cbiAgICAgICAgICAgICAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgICAgICAgICAgICAgZD17YE0gJHthci5zLnggKyAxLjV9ICR7YXIucy55ICsgMi4zfSBRICR7YXIuY3RybC54ICsgMS41fSAke2FyLmN0cmwueSArIDIuM30gJHthci5lLnggKyAxLjV9ICR7YXIuZS55ICsgMi4zfWB9XG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxsPVwibm9uZVwiIHN0cm9rZT1cIiMwMDBcIiBzdHJva2VXaWR0aD17dHViZVcgKyAxLjN9IHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiIG9wYWNpdHk9XCIwLjM1XCIvPlxuICAgICAgICAgICAgICAgICAgICAgIHsvKiBkYXJrIHVuZGVyY2FycmlhZ2UgYm9keSAqL31cbiAgICAgICAgICAgICAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgICAgICAgICAgICAgZD17YE0gJHthci5zLnggKyAwLjk1fSAke2FyLnMueSArIDEuNX0gUSAke2FyLmN0cmwueCArIDAuOTV9ICR7YXIuY3RybC55ICsgMS41fSAke2FyLmUueCArIDAuOTV9ICR7YXIuZS55ICsgMS41fWB9XG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxsPVwibm9uZVwiIHN0cm9rZT17Y0RERH0gc3Ryb2tlV2lkdGg9e3R1YmVXICsgMC45fSBzdHJva2VMaW5lY2FwPVwicm91bmRcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgey8qIG1pZCB1bmRlcmNhcnJpYWdlICovfVxuICAgICAgICAgICAgICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICBkPXtgTSAke2FyLnMueCArIDAuNTV9ICR7YXIucy55ICsgMC45fSBRICR7YXIuY3RybC54ICsgMC41NX0gJHthci5jdHJsLnkgKyAwLjl9ICR7YXIuZS54ICsgMC41NX0gJHthci5lLnkgKyAwLjl9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGw9XCJub25lXCIgc3Ryb2tlPXtjREREfSBzdHJva2VXaWR0aD17dHViZVcgKyAwLjV9IHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICAgICAgICAgICAgICAgICAgICB7LyogdG9wIG9mIHVuZGVyY2FycmlhZ2UgKGxpZ2h0ZXIgcmltIGp1c3QgYmVsb3cgdHViZSkgKi99XG4gICAgICAgICAgICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgIGQ9e2BNICR7YXIucy54ICsgMC4yNX0gJHthci5zLnkgKyAwLjQ1fSBRICR7YXIuY3RybC54ICsgMC4yNX0gJHthci5jdHJsLnkgKyAwLjQ1fSAke2FyLmUueCArIDAuMjV9ICR7YXIuZS55ICsgMC40NX1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbD1cIm5vbmVcIiBzdHJva2U9e2NERH0gc3Ryb2tlV2lkdGg9e3R1YmVXICsgMC4yfSBzdHJva2VMaW5lY2FwPVwicm91bmRcIi8+XG4gICAgICAgICAgICAgICAgICAgIDwvZz5cbiAgICAgICAgICAgICAgICAgICkpfVxuXG4gICAgICAgICAgICAgICAgICB7LyogSW5uZXItdHViZSBcImJvcmVcIiBjcm9zcy1zZWN0aW9ucyBhdCBlYWNoIGNvaWwganVuY3Rpb24g4oCUIHJlYWRzIGFzIGhvbGxvdyAzRCB0dWJlICovfVxuICAgICAgICAgICAgICAgICAge2JvdW5kYXJpZXMubWFwKChicCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaSA9PT0gMCB8fCBpID09PSBib3VuZGFyaWVzLmxlbmd0aCAtIDEpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgIDxnIGtleT17J2NzJyArIGl9PlxuICAgICAgICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9e2JwLnggKyAwLjF9IGN5PXticC55ICsgMC4zfSByeD17dHViZVcgKiAwLjcyfSByeT17dHViZVcgKiAwLjI4fSBmaWxsPVwiIzAwMFwiIG9wYWNpdHk9XCIwLjRcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD17YnAueH0gY3k9e2JwLnl9IHJ4PXt0dWJlVyAqIDAuNjZ9IHJ5PXt0dWJlVyAqIDAuMjR9IGZpbGw9e2NERER9Lz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxlbGxpcHNlIGN4PXticC54fSBjeT17YnAueSAtIDAuMDh9IHJ4PXt0dWJlVyAqIDAuNTh9IHJ5PXt0dWJlVyAqIDAuMn0gZmlsbD17YHVybCgjJHt1aWRTfS1ib3JlKWB9Lz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxlbGxpcHNlIGN4PXticC54IC0gdHViZVcgKiAwLjJ9IGN5PXticC55IC0gMC4yMn0gcng9e3R1YmVXICogMC4xOH0gcnk9e3R1YmVXICogMC4wNn0gZmlsbD1cIiNmZmZcIiBvcGFjaXR5PVwiMC41NVwiLz5cbiAgICAgICAgICAgICAgICAgICAgICA8L2c+XG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICB9KX1cblxuICAgICAgICAgICAgICAgICAgey8qIEZST05UIGFyY2hlcyDigJQgY2h1bmt5IHNlZ21lbnRlZCBwaXBlIGxvb2sgKi99XG4gICAgICAgICAgICAgICAgICB7YXJjaGVzLmZpbHRlcihhciA9PiBhci5pc0Zyb250KS5tYXAoKGFyLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNhbXBsZSBSSU5HLUJBTkRTIGFsb25nIHRoZSB0dWJlIOKAlCB2aXNpYmxlIGpvaW50IHJpbmdzIGxpa2UgYSByZWFsXG4gICAgICAgICAgICAgICAgICAgIC8vIHNlZ21lbnRlZCB3YXRlcnNsaWRlLiBFYWNoIHJpbmcgaXMgYW4gZWxsaXBzZSB3aG9zZSBsb25nIGF4aXMgaXNcbiAgICAgICAgICAgICAgICAgICAgLy8gcGVycGVuZGljdWxhciB0byB0aGUgdHViZSB0YW5nZW50LCBzbyBpdCB3cmFwcyBhY3Jvc3MgdGhlIHR1YmUuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJpbmdzID0gW107XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IE4gPSA3O1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBrID0gMTsgayA8IE47IGsrKykge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHQgPSBrIC8gTjtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtdCA9IDEgLSB0O1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHggPSBtdCptdCphci5zLnggKyAyKm10KnQqYXIuY3RybC54ICsgdCp0KmFyLmUueDtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCB5ID0gbXQqbXQqYXIucy55ICsgMiptdCp0KmFyLmN0cmwueSArIHQqdCphci5lLnk7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgdHggPSAyKm10Kihhci5jdHJsLnggLSBhci5zLngpICsgMip0Kihhci5lLnggLSBhci5jdHJsLngpO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHR5ID0gMiptdCooYXIuY3RybC55IC0gYXIucy55KSArIDIqdCooYXIuZS55IC0gYXIuY3RybC55KTtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhbmdsZURlZyA9IE1hdGguYXRhbjIodHksIHR4KSAqIDE4MCAvIE1hdGguUEk7XG4gICAgICAgICAgICAgICAgICAgICAgcmluZ3MucHVzaCh7IHgsIHksIGFuZ2xlRGVnIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgICAgPGcga2V5PXsnZnInICsgaX0+XG4gICAgICAgICAgICAgICAgICAgICAgICB7LyogSGVhdnkgZGFyayBvdXRlciByaW0gKGdpdmVzIHRoZSB0dWJlIGEgcHJvbm91bmNlZCBvdXRsaW5lKSAqL31cbiAgICAgICAgICAgICAgICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGQ9e2BNICR7YXIucy54fSAke2FyLnMueX0gUSAke2FyLmN0cmwueH0gJHthci5jdHJsLnl9ICR7YXIuZS54fSAke2FyLmUueX1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxsPVwibm9uZVwiIHN0cm9rZT17Y0RERH0gc3Ryb2tlV2lkdGg9e3R1YmVXICsgMS44fSBzdHJva2VMaW5lY2FwPVwicm91bmRcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgICB7LyogTWlkLXRvbmUgdHViZSBib2R5IHdpdGggY3lsaW5kcmljYWwgZ3JhZGllbnQgKi99XG4gICAgICAgICAgICAgICAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICBkPXtgTSAke2FyLnMueH0gJHthci5zLnl9IFEgJHthci5jdHJsLnh9ICR7YXIuY3RybC55fSAke2FyLmUueH0gJHthci5lLnl9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsbD1cIm5vbmVcIiBzdHJva2U9e2B1cmwoIyR7dWlkU30tdHViZSlgfSBzdHJva2VXaWR0aD17dHViZVcgKyAwLjJ9IHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIHsvKiBTZWdtZW50IFJJTkctQkFORFMgd3JhcHBpbmcgdGhlIHR1YmUgKHZpc2libGUgcGlwZSBqb2ludHMpLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEVhY2ggcmluZyBpcyBhIHRoaW4gZWxsaXBzZSByb3RhdGVkIHNvIGl0cyBsb25nIGF4aXMgaXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZXJwZW5kaWN1bGFyIHRvIHRoZSB0dWJlIHRhbmdlbnQsIGNyZWF0aW5nIGEgM0QgaG9vcCBhcm91bmRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGUgdHViZS4gT3ZlcmFsbCBoaWdobGlnaHQvc2hhZG93IGJhbmRzIGRyYXduIGxhdGVyIHNoYWRlIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b3AtdG8tYm90dG9tIGF1dG9tYXRpY2FsbHkuICovfVxuICAgICAgICAgICAgICAgICAgICAgICAge3JpbmdzLm1hcCgociwgaykgPT4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZWxsaXBzZSBrZXk9eydyZycgKyBrfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN4PXtyLnh9IGN5PXtyLnl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcng9XCIwLjQyXCIgcnk9e3R1YmVXICogMC41OH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm09e2Byb3RhdGUoJHtyLmFuZ2xlRGVnfSAke3IueH0gJHtyLnl9KWB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsbD17Y0RERH0gb3BhY2l0eT1cIjAuNzVcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHsvKiBIaWdobGlnaHQgYmFuZCBhbG9uZyB0b3Agb2YgdHViZSAobGlnaHQgc291cmNlIGZyb20gYWJvdmUpICovfVxuICAgICAgICAgICAgICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZD17YE0gJHthci5zLnh9ICR7YXIucy55IC0gMC41fSBRICR7YXIuY3RybC54fSAke2FyLmN0cmwueSAtIDAuNzV9ICR7YXIuZS54fSAke2FyLmUueSAtIDAuNX1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxsPVwibm9uZVwiIHN0cm9rZT17Y0x9IHN0cm9rZVdpZHRoPVwiMS4yXCIgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIgb3BhY2l0eT1cIjAuOTVcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgICB7LyogR2xvc3N5IHdoaXRlIHNoaW5lICovfVxuICAgICAgICAgICAgICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZD17YE0gJHthci5zLnggKyAwLjN9ICR7YXIucy55IC0gMC42NX0gUSAke2FyLmN0cmwueH0gJHthci5jdHJsLnkgLSAxLjB9ICR7YXIuZS54IC0gMC4zfSAke2FyLmUueSAtIDAuNjV9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCIjZmZmXCIgc3Ryb2tlV2lkdGg9XCIwLjU1XCIgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIgb3BhY2l0eT1cIjAuOVwiLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIHsvKiBEZWVwIGJvdHRvbSBzaGFkb3cgbGluZSByZWluZm9yY2luZyBjeWxpbmRyaWNhbCByb3VuZG5lc3MgKi99XG4gICAgICAgICAgICAgICAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICBkPXtgTSAke2FyLnMueH0gJHthci5zLnkgKyAwLjU1fSBRICR7YXIuY3RybC54fSAke2FyLmN0cmwueSArIDAuOH0gJHthci5lLnh9ICR7YXIuZS55ICsgMC41NX1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxsPVwibm9uZVwiIHN0cm9rZT17Y0RERH0gc3Ryb2tlV2lkdGg9XCIxLjBcIiBzdHJva2VMaW5lY2FwPVwicm91bmRcIiBvcGFjaXR5PVwiMC43NVwiLz5cbiAgICAgICAgICAgICAgICAgICAgICA8L2c+XG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICB9KX1cblxuICAgICAgICAgICAgICAgICAgey8qIEVudHJ5IGZ1bm5lbCDigJQgZHJhbWF0aWMgb3BlbmluZyBhdCB0b3Agb2Ygc2xpZGUgKi99XG4gICAgICAgICAgICAgICAgICA8ZyB0cmFuc2Zvcm09e2B0cmFuc2xhdGUoJHthLnh9ICR7YS55fSlgfT5cbiAgICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIxLjFcIiBjeT1cIjEuOFwiIHJ4PXthcmNoUiAqIDEuMTV9IHJ5PXthcmNoUiAqIDAuNDh9IGZpbGw9XCIjMDAwXCIgb3BhY2l0eT1cIjAuNVwiIGZpbHRlcj1cInVybCgjY2FzdFNoYWRvd0hlYXZ5KVwiLz5cbiAgICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIwXCIgY3k9XCIwLjVcIiByeD17YXJjaFIgKiAwLjk1fSByeT17YXJjaFIgKiAwLjV9IGZpbGw9e2NERER9Lz5cbiAgICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIwXCIgY3k9XCIwLjE1XCIgcng9e2FyY2hSICogMC45NX0gcnk9e2FyY2hSICogMC41fSBmaWxsPXtjRER9Lz5cbiAgICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIwXCIgY3k9XCIwXCIgcng9e2FyY2hSICogMC45NX0gcnk9e2FyY2hSICogMC41fSBmaWxsPXtgdXJsKCMke3VpZFN9LXR1YmUpYH0gc3Ryb2tlPXtjREREfSBzdHJva2VXaWR0aD1cIjAuMzVcIi8+XG4gICAgICAgICAgICAgICAgICAgIHsvKiBib3JlIChvcGVuaW5nKSAqL31cbiAgICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIwXCIgY3k9XCItMC4xMlwiIHJ4PXthcmNoUiAqIDAuN30gcnk9e2FyY2hSICogMC4zOH0gZmlsbD17Y0RERH0vPlxuICAgICAgICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD1cIjBcIiBjeT1cIi0wLjEyXCIgcng9e2FyY2hSICogMC43fSByeT17YXJjaFIgKiAwLjM4fSBmaWxsPXtgdXJsKCMke3VpZFN9LWJvcmUpYH0vPlxuICAgICAgICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD1cIjBcIiBjeT1cIi0wLjFcIiByeD17YXJjaFIgKiAwLjU1fSByeT17YXJjaFIgKiAwLjN9IGZpbGw9XCIjMDAwXCIgb3BhY2l0eT1cIjAuNTVcIi8+XG4gICAgICAgICAgICAgICAgICAgIHsvKiByaW0gaGlnaGxpZ2h0cyAqL31cbiAgICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCItMS4yXCIgY3k9XCItMC43NVwiIHJ4PXthcmNoUiAqIDAuMzh9IHJ5PXthcmNoUiAqIDAuMX0gZmlsbD1cIiNmZmZcIiBvcGFjaXR5PVwiMC43NVwiLz5cbiAgICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIwLjhcIiBjeT1cIjAuMjVcIiByeD17YXJjaFIgKiAwLjI4fSByeT17YXJjaFIgKiAwLjA4fSBmaWxsPXtjTH0gb3BhY2l0eT1cIjAuNVwiLz5cbiAgICAgICAgICAgICAgICAgIDwvZz5cblxuICAgICAgICAgICAgICAgICAgey8qIEV4aXQgZnVubmVsIOKAlCBtb3V0aCBvZiBzbGlkZSB3aGVyZSB5b3UgY29tZSBvdXQgKi99XG4gICAgICAgICAgICAgICAgICA8ZyB0cmFuc2Zvcm09e2B0cmFuc2xhdGUoJHtiLnh9ICR7Yi55fSlgfT5cbiAgICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIxLjBcIiBjeT1cIjEuOFwiIHJ4PXthcmNoUiAqIDEuMX0gcnk9e2FyY2hSICogMC40Mn0gZmlsbD1cIiMwMDBcIiBvcGFjaXR5PVwiMC41XCIgZmlsdGVyPVwidXJsKCNjYXN0U2hhZG93SGVhdnkpXCIvPlxuICAgICAgICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD1cIjBcIiBjeT1cIjAuNVwiIHJ4PXthcmNoUiAqIDEuMH0gcnk9e2FyY2hSICogMC41Mn0gZmlsbD17Y0RERH0vPlxuICAgICAgICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD1cIjBcIiBjeT1cIjAuMTVcIiByeD17YXJjaFIgKiAxLjB9IHJ5PXthcmNoUiAqIDAuNTJ9IGZpbGw9e2NERH0vPlxuICAgICAgICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD1cIjBcIiBjeT1cIjBcIiByeD17YXJjaFIgKiAxLjB9IHJ5PXthcmNoUiAqIDAuNTJ9IGZpbGw9e2B1cmwoIyR7dWlkU30tdHViZSlgfSBzdHJva2U9e2NERER9IHN0cm9rZVdpZHRoPVwiMC4zNVwiLz5cbiAgICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIwXCIgY3k9XCItMC4xMlwiIHJ4PXthcmNoUiAqIDAuNzR9IHJ5PXthcmNoUiAqIDAuNH0gZmlsbD17Y0RERH0vPlxuICAgICAgICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD1cIjBcIiBjeT1cIi0wLjEyXCIgcng9e2FyY2hSICogMC43NH0gcnk9e2FyY2hSICogMC40fSBmaWxsPXtgdXJsKCMke3VpZFN9LWJvcmUpYH0vPlxuICAgICAgICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD1cIjBcIiBjeT1cIi0wLjFcIiByeD17YXJjaFIgKiAwLjZ9IHJ5PXthcmNoUiAqIDAuMzJ9IGZpbGw9XCIjMDAwXCIgb3BhY2l0eT1cIjAuNVwiLz5cbiAgICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCItMS4zXCIgY3k9XCItMC44XCIgcng9e2FyY2hSICogMC40fSByeT17YXJjaFIgKiAwLjF9IGZpbGw9XCIjZmZmXCIgb3BhY2l0eT1cIjAuNzVcIi8+XG4gICAgICAgICAgICAgICAgICAgIDxlbGxpcHNlIGN4PVwiMC45XCIgY3k9XCIwLjI1XCIgcng9e2FyY2hSICogMC4zfSByeT17YXJjaFIgKiAwLjA4fSBmaWxsPXtjTH0gb3BhY2l0eT1cIjAuNVwiLz5cbiAgICAgICAgICAgICAgICAgIDwvZz5cbiAgICAgICAgICAgICAgICA8L2c+XG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBhID0gc3F1YXJlVG9QY3QoK2Zyb20pOyAgLy8gVE9QIG9mIHNsaWRlIChoaWdoIHNxdWFyZSlcbiAgICAgICAgICAgIGNvbnN0IGIgPSBzcXVhcmVUb1BjdCgrdG8pOyAgICAvLyBCT1RUT00gZXhpdCAobG93IHNxdWFyZSlcbiAgICAgICAgICAgIGNvbnN0IGR4ID0gYi54IC0gYS54LCBkeSA9IGIueSAtIGEueTtcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IE1hdGguaHlwb3QoZHgsIGR5KTtcbiAgICAgICAgICAgIGNvbnN0IG54ID0gLWR5IC8gbGVuLCBueSA9IGR4IC8gbGVuO1xuICAgICAgICAgICAgLy8gUy1jdXJ2ZSB2aWEgdHdvIGNvbnRyb2wgcG9pbnRzXG4gICAgICAgICAgICBjb25zdCBidWxnZTEgPSBNYXRoLm1pbig3LCBsZW4gKiAwLjI1KTtcbiAgICAgICAgICAgIGNvbnN0IGJ1bGdlMiA9IE1hdGgubWluKDcsIGxlbiAqIDAuMjUpO1xuICAgICAgICAgICAgY29uc3QgYzF4ID0gYS54ICsgZHggKiAwLjMzICsgbnggKiBidWxnZTE7XG4gICAgICAgICAgICBjb25zdCBjMXkgPSBhLnkgKyBkeSAqIDAuMzMgKyBueSAqIGJ1bGdlMTtcbiAgICAgICAgICAgIGNvbnN0IGMyeCA9IGEueCArIGR4ICogMC42NiAtIG54ICogYnVsZ2UyO1xuICAgICAgICAgICAgY29uc3QgYzJ5ID0gYS55ICsgZHkgKiAwLjY2IC0gbnkgKiBidWxnZTI7XG5cbiAgICAgICAgICAgIGNvbnN0IHNoYWRlID0gKGhleCwgYW10KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IG4gPSBwYXJzZUludChoZXguc2xpY2UoMSksIDE2KTtcbiAgICAgICAgICAgICAgY29uc3QgciA9IE1hdGgubWF4KDAsIE1hdGgubWluKDI1NSwgKChuID4+IDE2KSAmIDI1NSkgKyBhbXQpKTtcbiAgICAgICAgICAgICAgY29uc3QgZyA9IE1hdGgubWF4KDAsIE1hdGgubWluKDI1NSwgKChuID4+IDgpICYgMjU1KSArIGFtdCkpO1xuICAgICAgICAgICAgICBjb25zdCBibCA9IE1hdGgubWF4KDAsIE1hdGgubWluKDI1NSwgKG4gJiAyNTUpICsgYW10KSk7XG4gICAgICAgICAgICAgIHJldHVybiBgcmdiKCR7cnwwfSwke2d8MH0sJHtibHwwfSlgO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNMaWdodCA9IHNoYWRlKGNvbG9yLCA3MCk7XG4gICAgICAgICAgICBjb25zdCBjTWlkID0gY29sb3I7XG4gICAgICAgICAgICBjb25zdCBjRGFyayA9IHNoYWRlKGNvbG9yLCAtNTApO1xuICAgICAgICAgICAgY29uc3QgY0RhcmtlciA9IHNoYWRlKGNvbG9yLCAtOTApO1xuICAgICAgICAgICAgY29uc3QgdWlkID0gYHNsLSR7ZnJvbX1gO1xuXG4gICAgICAgICAgICAvLyBzbGlkZSB3aWR0aCBjb25zdGFudCBhbG9uZyBsZW5ndGggKG9wZW4gc2xpZGUpXG4gICAgICAgICAgICBjb25zdCB3U2xpZGUgPSAzLjI7XG5cbiAgICAgICAgICAgIC8vIFNhbXBsZSBjdWJpYyBCZXppZXJcbiAgICAgICAgICAgIGNvbnN0IHNhbXBsZSA9ICh0KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IG10ID0gMSAtIHQ7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgeDogbXQqbXQqbXQqYS54ICsgMyptdCptdCp0KmMxeCArIDMqbXQqdCp0KmMyeCArIHQqdCp0KmIueCxcbiAgICAgICAgICAgICAgICB5OiBtdCptdCptdCphLnkgKyAzKm10Km10KnQqYzF5ICsgMyptdCp0KnQqYzJ5ICsgdCp0KnQqYi55LFxuICAgICAgICAgICAgICAgIHR4OiAzKm10Km10KihjMXgtYS54KSArIDYqbXQqdCooYzJ4LWMxeCkgKyAzKnQqdCooYi54LWMyeCksXG4gICAgICAgICAgICAgICAgdHk6IDMqbXQqbXQqKGMxeS1hLnkpICsgNiptdCp0KihjMnktYzF5KSArIDMqdCp0KihiLnktYzJ5KSxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHN0ZXBzID0gNTA7XG4gICAgICAgICAgICBjb25zdCBjZW50ZXJsaW5lID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBzdGVwczsgaSsrKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHQgPSBpIC8gc3RlcHM7XG4gICAgICAgICAgICAgIGNlbnRlcmxpbmUucHVzaCh7IHQsIC4uLnNhbXBsZSh0KSB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gd2lkdGggZ3Jvd3Mgc2xpZ2h0bHkgYXQgZXhpdCAoZmxhcmUpXG4gICAgICAgICAgICBjb25zdCB3aWR0aEF0ID0gKHQpID0+IHdTbGlkZSAqICgxICsgdCAqIDAuMTUpO1xuXG4gICAgICAgICAgICAvLyBCdWlsZCBwb2x5Z29uIGZvciB0aGUgc2xpZGUgc3VyZmFjZSAoYmVkKVxuICAgICAgICAgICAgY29uc3QgdG9wID0gW10sIGJvdCA9IFtdO1xuICAgICAgICAgICAgY2VudGVybGluZS5mb3JFYWNoKCh7IHQsIHgsIHksIHR4LCB0eSB9KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IEwgPSBNYXRoLmh5cG90KHR4LCB0eSkgfHwgMTtcbiAgICAgICAgICAgICAgY29uc3QgcG54ID0gLXR5IC8gTCwgcG55ID0gdHggLyBMO1xuICAgICAgICAgICAgICBjb25zdCB3MiA9IHdpZHRoQXQodCkgLyAyO1xuICAgICAgICAgICAgICB0b3AucHVzaChbeCArIHBueCAqIHcyLCB5ICsgcG55ICogdzJdKTtcbiAgICAgICAgICAgICAgYm90LnB1c2goW3ggLSBwbnggKiB3MiwgeSAtIHBueSAqIHcyXSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGJlZFBvaW50cyA9IFsuLi50b3AsIC4uLmJvdC5yZXZlcnNlKCldLm1hcChwID0+IGAke3BbMF19LCR7cFsxXX1gKS5qb2luKCcgJyk7XG5cbiAgICAgICAgICAgIC8vIFNpZGUtcmFpbCBwYXRocyAob3BlbiBzbGlkZSB3YWxscyk6IHRyYWNlZCBhbG9uZyBlYWNoIGVkZ2Ugd2l0aCBzb21lIG9mZnNldCxcbiAgICAgICAgICAgIC8vIHdpdGggYSByYWlzZWQgcmltIGdyYWRpZW50IGZvciAzRFxuICAgICAgICAgICAgY29uc3QgcmFpbDEgPSB0b3AubWFwKChwLCBpKSA9PiBgJHtpID09PSAwID8gJ00nIDogJ0wnfSAke3BbMF19ICR7cFsxXX1gKS5qb2luKCcgJyk7XG4gICAgICAgICAgICBjb25zdCByYWlsMiA9IGJvdC5tYXAoKHAsIGkpID0+IGAke2kgPT09IDAgPyAnTScgOiAnTCd9ICR7cFswXX0gJHtwWzFdfWApLmpvaW4oJyAnKTtcblxuICAgICAgICAgICAgLy8gRW50cnkgbGFkZGVyIHRvcCBtYXJrZXIgKHNtYWxsIHBsYXRmb3JtKVxuICAgICAgICAgICAgY29uc3QgZW50cnkgPSBzYW1wbGUoMCk7XG4gICAgICAgICAgICBjb25zdCBlbnRyeUFuZyA9IE1hdGguYXRhbjIoZW50cnkudHksIGVudHJ5LnR4KSAqIDE4MCAvIE1hdGguUEk7XG4gICAgICAgICAgICBjb25zdCBleGl0XyA9IHNhbXBsZSgxKTtcbiAgICAgICAgICAgIGNvbnN0IGV4aXRBbmcgPSBNYXRoLmF0YW4yKGV4aXRfLnR5LCBleGl0Xy50eCkgKiAxODAgLyBNYXRoLlBJO1xuXG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8ZyBrZXk9eydjJyArIGZyb219PlxuICAgICAgICAgICAgICAgIDxkZWZzPlxuICAgICAgICAgICAgICAgICAgey8qIFNsaWRlIHN1cmZhY2UgZ3JhZGllbnQg4oCUIGJyaWdodCBsaWdodCBjZW50ZXIsIGRhcmtlciBlZGdlcyBmb3IgY29uY2F2ZSBmZWVsICovfVxuICAgICAgICAgICAgICAgICAgPGxpbmVhckdyYWRpZW50IGlkPXtgJHt1aWR9LWJlZGB9IHgxPVwiMFwiIHkxPVwiMFwiIHgyPVwiMFwiIHkyPVwiMVwiPlxuICAgICAgICAgICAgICAgICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3BDb2xvcj17Y0Rhcmt9Lz5cbiAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiNTAlXCIgc3RvcENvbG9yPXtjTGlnaHR9Lz5cbiAgICAgICAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3BDb2xvcj17Y0Rhcmt9Lz5cbiAgICAgICAgICAgICAgICAgIDwvbGluZWFyR3JhZGllbnQ+XG4gICAgICAgICAgICAgICAgICB7LyogUmFpbCBncmFkaWVudCDigJQgYnJpZ2h0IHRvcCwgZGFyayB1bmRlcnNpZGUgKi99XG4gICAgICAgICAgICAgICAgICA8bGluZWFyR3JhZGllbnQgaWQ9e2Ake3VpZH0tcmFpbGB9IHgxPVwiMFwiIHkxPVwiMFwiIHgyPVwiMFwiIHkyPVwiMVwiPlxuICAgICAgICAgICAgICAgICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3BDb2xvcj17Y0xpZ2h0fS8+XG4gICAgICAgICAgICAgICAgICAgIDxzdG9wIG9mZnNldD1cIjEwMCVcIiBzdG9wQ29sb3I9e2NEYXJrZXJ9Lz5cbiAgICAgICAgICAgICAgICAgIDwvbGluZWFyR3JhZGllbnQ+XG4gICAgICAgICAgICAgICAgPC9kZWZzPlxuXG4gICAgICAgICAgICAgICAgey8qID09PT0gZHJhbWF0aWMgbXVsdGktbGF5ZXIgY2FzdCBzaGFkb3cgKGJpZyBibHVyLCBvZmZzZXQgZG93bi1yaWdodCkgPT09PSAqL31cbiAgICAgICAgICAgICAgICA8ZyBvcGFjaXR5PVwiMC40XCIgdHJhbnNmb3JtPVwidHJhbnNsYXRlKDIuMiAzLjApXCIgZmlsdGVyPVwidXJsKCNjYXN0U2hhZG93SGVhdnkpXCI+XG4gICAgICAgICAgICAgICAgICA8cG9seWdvbiBwb2ludHM9e2JlZFBvaW50c30gZmlsbD1cIiMwMDBcIi8+XG4gICAgICAgICAgICAgICAgPC9nPlxuICAgICAgICAgICAgICAgIDxnIG9wYWNpdHk9XCIwLjNcIiB0cmFuc2Zvcm09XCJ0cmFuc2xhdGUoMS40IDIuMClcIiBmaWx0ZXI9XCJ1cmwoI2Nhc3RTaGFkb3dTb2Z0KVwiPlxuICAgICAgICAgICAgICAgICAgPHBvbHlnb24gcG9pbnRzPXtiZWRQb2ludHN9IGZpbGw9XCIjMDAwXCIvPlxuICAgICAgICAgICAgICAgIDwvZz5cblxuICAgICAgICAgICAgICAgIHsvKiA9PT09IERFRVAgdW5kZXJjYXJyaWFnZSBzdGFjayDigJQgbWFrZXMgc2xpZGUgY2xlYXJseSBmbG9hdCBhYm92ZSBib2FyZCA9PT09ICovfVxuICAgICAgICAgICAgICAgIHsvKiBib3R0b20tbW9zdCBkYXJrIGxheWVyICovfVxuICAgICAgICAgICAgICAgIDxwb2x5Z29uXG4gICAgICAgICAgICAgICAgICBwb2ludHM9e3RvcC5jb25jYXQoYm90LnNsaWNlKCkucmV2ZXJzZSgpKS5tYXAocCA9PiBgJHtwWzBdICsgMC45fSwke3BbMV0gKyAxLjR9YCkuam9pbignICcpfVxuICAgICAgICAgICAgICAgICAgZmlsbD17Y0Rhcmtlcn0gb3BhY2l0eT1cIjAuOVwiXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICB7LyogbWlkIGxheWVyICovfVxuICAgICAgICAgICAgICAgIDxwb2x5Z29uXG4gICAgICAgICAgICAgICAgICBwb2ludHM9e3RvcC5jb25jYXQoYm90LnNsaWNlKCkucmV2ZXJzZSgpKS5tYXAocCA9PiBgJHtwWzBdICsgMC41NX0sJHtwWzFdICsgMC45fWApLmpvaW4oJyAnKX1cbiAgICAgICAgICAgICAgICAgIGZpbGw9e2NEYXJrZXJ9XG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICB7LyogdG9wIG9mIHVuZGVyY2FycmlhZ2UgKGRhcmtlciByaW0gcmlnaHQgYmVmb3JlIGJlZCkgKi99XG4gICAgICAgICAgICAgICAgPHBvbHlnb25cbiAgICAgICAgICAgICAgICAgIHBvaW50cz17dG9wLmNvbmNhdChib3Quc2xpY2UoKS5yZXZlcnNlKCkpLm1hcChwID0+IGAke3BbMF0gKyAwLjI1fSwke3BbMV0gKyAwLjQ1fWApLmpvaW4oJyAnKX1cbiAgICAgICAgICAgICAgICAgIGZpbGw9e2NEYXJrfVxuICAgICAgICAgICAgICAgIC8+XG5cbiAgICAgICAgICAgICAgICB7Lyogc2xpZGUgYmVkICovfVxuICAgICAgICAgICAgICAgIDxwb2x5Z29uIHBvaW50cz17YmVkUG9pbnRzfSBmaWxsPXtgdXJsKCMke3VpZH0tYmVkKWB9IHN0cm9rZT17Y0Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjE1XCIvPlxuXG4gICAgICAgICAgICAgICAgey8qIGNyb3NzLXJpZGdlcyBhbG9uZyBzbGlkZSBmb3IgdGV4dHVyZSAqL31cbiAgICAgICAgICAgICAgICB7Y2VudGVybGluZS5maWx0ZXIoKF8sIGkpID0+IGkgPiAyICYmIGkgPCBzdGVwcyAtIDIgJiYgaSAlIDMgPT09IDApLm1hcCgoeyB4LCB5LCB0eCwgdHksIHQgfSwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgY29uc3QgTCA9IE1hdGguaHlwb3QodHgsIHR5KSB8fCAxO1xuICAgICAgICAgICAgICAgICAgY29uc3QgcG54ID0gLXR5IC8gTCwgcG55ID0gdHggLyBMO1xuICAgICAgICAgICAgICAgICAgY29uc3QgdzIgPSB3aWR0aEF0KHQpIC8gMiAqIDAuOTI7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICA8bGluZSBrZXk9eydyJyArIGl9XG4gICAgICAgICAgICAgICAgICAgICAgeDE9e3ggKyBwbnggKiB3Mn0geTE9e3kgKyBwbnkgKiB3Mn1cbiAgICAgICAgICAgICAgICAgICAgICB4Mj17eCAtIHBueCAqIHcyfSB5Mj17eSAtIHBueSAqIHcyfVxuICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZT17Y0Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjEyXCIgb3BhY2l0eT1cIjAuNFwiXG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0pfVxuXG4gICAgICAgICAgICAgICAgey8qIGNlbnRlciBnbGlkZSBoaWdobGlnaHQgZG93biB0aGUgc2xpZGUgKi99XG4gICAgICAgICAgICAgICAge3Nob3dHbGlkZVBhdGggJiYgKFxuICAgICAgICAgICAgICAgIDxwb2x5bGluZVxuICAgICAgICAgICAgICAgICAgcG9pbnRzPXtjZW50ZXJsaW5lLm1hcCgoeyB4LCB5LCB0eCwgdHksIHQgfSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBMID0gTWF0aC5oeXBvdCh0eCwgdHkpIHx8IDE7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBueCA9IC10eSAvIEwsIHBueSA9IHR4IC8gTDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdzIgPSB3aWR0aEF0KHQpIC8gMiAqIDAuMTU7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBgJHt4ICsgcG54ICogdzIgKiAwLjJ9LCR7eSArIHBueSAqIHcyICogMC4yfWA7XG4gICAgICAgICAgICAgICAgICB9KS5qb2luKCcgJyl9XG4gICAgICAgICAgICAgICAgICBmaWxsPVwibm9uZVwiIHN0cm9rZT1cIndoaXRlXCIgc3Ryb2tlV2lkdGg9XCIwLjdcIiBvcGFjaXR5PVwiMC40NVwiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICApfVxuXG4gICAgICAgICAgICAgICAgey8qID09PT0gU0lERSBSQUlMUyAocmFpc2VkIHdhbGxzKSDigJQga2V5IHBsYXlncm91bmQtc2xpZGUgZmVhdHVyZSA9PT09ICovfVxuICAgICAgICAgICAgICAgIHsvKiByYWlsIDEgYmFjayBzaGFkb3cgKi99XG4gICAgICAgICAgICAgICAgPHBhdGggZD17cmFpbDF9IGZpbGw9XCJub25lXCIgc3Ryb2tlPXtjRGFya2VyfSBzdHJva2VXaWR0aD1cIjAuOVwiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSgwLjE1IDAuMzUpXCIvPlxuICAgICAgICAgICAgICAgIDxwYXRoIGQ9e3JhaWwyfSBmaWxsPVwibm9uZVwiIHN0cm9rZT17Y0Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjlcIiBzdHJva2VMaW5lY2FwPVwicm91bmRcIiB0cmFuc2Zvcm09XCJ0cmFuc2xhdGUoMC4xNSAwLjM1KVwiLz5cbiAgICAgICAgICAgICAgICB7LyogcmFpbCBtYWluIGJvZHkgKi99XG4gICAgICAgICAgICAgICAgPHBhdGggZD17cmFpbDF9IGZpbGw9XCJub25lXCIgc3Ryb2tlPXtgdXJsKCMke3VpZH0tcmFpbClgfSBzdHJva2VXaWR0aD1cIjAuNjVcIiBzdHJva2VMaW5lY2FwPVwicm91bmRcIi8+XG4gICAgICAgICAgICAgICAgPHBhdGggZD17cmFpbDJ9IGZpbGw9XCJub25lXCIgc3Ryb2tlPXtgdXJsKCMke3VpZH0tcmFpbClgfSBzdHJva2VXaWR0aD1cIjAuNjVcIiBzdHJva2VMaW5lY2FwPVwicm91bmRcIi8+XG4gICAgICAgICAgICAgICAgey8qIHJhaWwgdG9wIGhpZ2hsaWdodCAqL31cbiAgICAgICAgICAgICAgICA8cGF0aCBkPXtyYWlsMX0gZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJ3aGl0ZVwiIHN0cm9rZVdpZHRoPVwiMC4yXCIgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIgb3BhY2l0eT1cIjAuOFwiLz5cbiAgICAgICAgICAgICAgICA8cGF0aCBkPXtyYWlsMn0gZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJ3aGl0ZVwiIHN0cm9rZVdpZHRoPVwiMC4yXCIgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIgb3BhY2l0eT1cIjAuOFwiLz5cblxuICAgICAgICAgICAgICAgIHsvKiA9PT09IEVOVFJZIFBMQVRGT1JNIChhdCB0b3AvaGlnaCBzcXVhcmUpID09PT0gKi99XG4gICAgICAgICAgICAgICAgPGcgdHJhbnNmb3JtPXtgdHJhbnNsYXRlKCR7ZW50cnkueH0gJHtlbnRyeS55fSkgcm90YXRlKCR7ZW50cnlBbmcgLSA5MH0pYH0+XG4gICAgICAgICAgICAgICAgICB7Lyogc2hhZG93ICovfVxuICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIwLjNcIiBjeT1cIjAuNlwiIHJ4PXt3U2xpZGUgKiAxLjF9IHJ5PXt3U2xpZGUgKiAwLjU1fSBmaWxsPVwiIzAwMFwiIG9wYWNpdHk9XCIwLjNcIiBmaWx0ZXI9XCJ1cmwoI2Nhc3RTaGFkb3dTb2Z0KVwiLz5cbiAgICAgICAgICAgICAgICAgIHsvKiBwbGF0Zm9ybSBiYXNlIChkYXJrZXIpICovfVxuICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIwXCIgY3k9XCIwLjI1XCIgcng9e3dTbGlkZSAqIDAuOTV9IHJ5PXt3U2xpZGUgKiAwLjQ1fSBmaWxsPXtjRGFya2VyfS8+XG4gICAgICAgICAgICAgICAgICB7LyogcGxhdGZvcm0gdG9wICovfVxuICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIwXCIgY3k9XCIwXCIgcng9e3dTbGlkZSAqIDAuOTV9IHJ5PXt3U2xpZGUgKiAwLjQ1fSBmaWxsPXtgdXJsKCMke3VpZH0tYmVkKWB9IHN0cm9rZT17Y0Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjE1XCIvPlxuICAgICAgICAgICAgICAgICAgey8qIGhpZ2hsaWdodCAqL31cbiAgICAgICAgICAgICAgICAgIDxlbGxpcHNlIGN4PVwiLTAuNlwiIGN5PVwiLTAuMjVcIiByeD17d1NsaWRlICogMC41fSByeT17d1NsaWRlICogMC4xNX0gZmlsbD1cIndoaXRlXCIgb3BhY2l0eT1cIjAuMzVcIi8+XG4gICAgICAgICAgICAgICAgICB7LyogbGl0dGxlIHNhZmV0eSByYWlsIHBvc3RzIG9uIGVpdGhlciBzaWRlICovfVxuICAgICAgICAgICAgICAgICAgPGc+XG4gICAgICAgICAgICAgICAgICAgIDxyZWN0IHg9ey13U2xpZGUgKiAwLjg1fSB5PXstd1NsaWRlICogMC45fSB3aWR0aD1cIjAuNDVcIiBoZWlnaHQ9e3dTbGlkZSAqIDAuOX0gZmlsbD17Y0Rhcmt9IHJ4PVwiMC4xNVwiLz5cbiAgICAgICAgICAgICAgICAgICAgPHJlY3QgeD17LXdTbGlkZSAqIDAuODV9IHk9ey13U2xpZGUgKiAwLjl9IHdpZHRoPVwiMC4yXCIgaGVpZ2h0PXt3U2xpZGUgKiAwLjl9IGZpbGw9e2NMaWdodH0gcng9XCIwLjA4XCIvPlxuICAgICAgICAgICAgICAgICAgICA8Y2lyY2xlIGN4PXstd1NsaWRlICogMC44NSArIDAuMjJ9IGN5PXstd1NsaWRlICogMC45fSByPVwiMC4zMlwiIGZpbGw9e2NMaWdodH0gc3Ryb2tlPXtjRGFya2VyfSBzdHJva2VXaWR0aD1cIjAuMVwiLz5cbiAgICAgICAgICAgICAgICAgICAgPHJlY3QgeD17d1NsaWRlICogMC40fSB5PXstd1NsaWRlICogMC45fSB3aWR0aD1cIjAuNDVcIiBoZWlnaHQ9e3dTbGlkZSAqIDAuOX0gZmlsbD17Y0Rhcmt9IHJ4PVwiMC4xNVwiLz5cbiAgICAgICAgICAgICAgICAgICAgPHJlY3QgeD17d1NsaWRlICogMC40fSB5PXstd1NsaWRlICogMC45fSB3aWR0aD1cIjAuMlwiIGhlaWdodD17d1NsaWRlICogMC45fSBmaWxsPXtjTGlnaHR9IHJ4PVwiMC4wOFwiLz5cbiAgICAgICAgICAgICAgICAgICAgPGNpcmNsZSBjeD17d1NsaWRlICogMC40ICsgMC4yMn0gY3k9ey13U2xpZGUgKiAwLjl9IHI9XCIwLjMyXCIgZmlsbD17Y0xpZ2h0fSBzdHJva2U9e2NEYXJrZXJ9IHN0cm9rZVdpZHRoPVwiMC4xXCIvPlxuICAgICAgICAgICAgICAgICAgICB7LyogaG9yaXpvbnRhbCBiYXIgY29ubmVjdGluZyBwb3N0cyAqL31cbiAgICAgICAgICAgICAgICAgICAgPHJlY3QgeD17LXdTbGlkZSAqIDAuODUgKyAwLjIyfSB5PXstd1NsaWRlICogMC45IC0gMC4xfSB3aWR0aD17d1NsaWRlICogMS4yNX0gaGVpZ2h0PVwiMC4zXCIgZmlsbD17Y0xpZ2h0fSByeD1cIjAuMVwiIHN0cm9rZT17Y0Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjA4XCIvPlxuICAgICAgICAgICAgICAgICAgPC9nPlxuICAgICAgICAgICAgICAgIDwvZz5cblxuICAgICAgICAgICAgICAgIHsvKiA9PT09IEVYSVQgRkxBUkUgKGF0IGJvdHRvbS9sb3cgc3F1YXJlKSA9PT09ICovfVxuICAgICAgICAgICAgICAgIDxnIHRyYW5zZm9ybT17YHRyYW5zbGF0ZSgke2V4aXRfLnh9ICR7ZXhpdF8ueX0pIHJvdGF0ZSgke2V4aXRBbmcgLSA5MH0pYH0+XG4gICAgICAgICAgICAgICAgICB7Lyogc2hhZG93ICovfVxuICAgICAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIwLjNcIiBjeT1cIjAuNVwiIHJ4PXt3U2xpZGUgKiAxLjB9IHJ5PXt3U2xpZGUgKiAwLjM1fSBmaWxsPVwiIzAwMFwiIG9wYWNpdHk9XCIwLjNcIiBmaWx0ZXI9XCJ1cmwoI2Nhc3RTaGFkb3dTb2Z0KVwiLz5cbiAgICAgICAgICAgICAgICAgIHsvKiBsaXAgdW5kZXJzaWRlICovfVxuICAgICAgICAgICAgICAgICAgPHBhdGggZD17YE0gJHstd1NsaWRlICogMC44fSAwIFEgMCAke3dTbGlkZSAqIDAuNTV9ICR7d1NsaWRlICogMC44fSAwYH0gZmlsbD17Y0Rhcmtlcn0vPlxuICAgICAgICAgICAgICAgICAgey8qIGxpcCB0b3AgKi99XG4gICAgICAgICAgICAgICAgICA8cGF0aCBkPXtgTSAkey13U2xpZGUgKiAwLjh9IC0wLjEgUSAwICR7d1NsaWRlICogMC40NX0gJHt3U2xpZGUgKiAwLjh9IC0wLjEgTCAke3dTbGlkZSAqIDAuNjV9IC0wLjI1IFEgMCAke3dTbGlkZSAqIDAuMjV9ICR7LXdTbGlkZSAqIDAuNjV9IC0wLjI1IFpgfVxuICAgICAgICAgICAgICAgICAgICBmaWxsPXtgdXJsKCMke3VpZH0tcmFpbClgfSBzdHJva2U9e2NEYXJrZXJ9IHN0cm9rZVdpZHRoPVwiMC4xMlwiLz5cbiAgICAgICAgICAgICAgICAgIHsvKiBoaWdobGlnaHQgb24gbGlwICovfVxuICAgICAgICAgICAgICAgICAgPHBhdGggZD17YE0gJHstd1NsaWRlICogMC41NX0gMC4wIFEgMCAke3dTbGlkZSAqIDAuMjh9ICR7d1NsaWRlICogMC41NX0gMC4wYH0gc3Ryb2tlPVwid2hpdGVcIiBzdHJva2VXaWR0aD1cIjAuMThcIiBmaWxsPVwibm9uZVwiIG9wYWNpdHk9XCIwLjc1XCIvPlxuICAgICAgICAgICAgICAgIDwvZz5cbiAgICAgICAgICAgICAgPC9nPlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KX1cbiAgICAgICAgPC9zdmc+XG5cbiAgICAgICAgey8qIFRva2VucyAqL31cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0b2tlbnNcIj5cbiAgICAgICAgICB7cGxheWVycy5tYXAoKHAsIGkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNxID0gdG9rZW5Qb3NpdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBvdmVycmlkZSA9IHRva2VuT3ZlcnJpZGUgJiYgdG9rZW5PdmVycmlkZVtpXTtcbiAgICAgICAgICAgIGlmIChzcSA8IDEgJiYgIW92ZXJyaWRlKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIC8vIElmIG92ZXJyaWRkZW4gKGUuZy4gZHVyaW5nIHNwaXJhbCBzbGlkZSksIHVzZSBleGFjdCB4L3kgcGF0aCBjb29yZHM7IGVsc2UgdXNlIHNxdWFyZSBjZW50ZXJcbiAgICAgICAgICAgIGNvbnN0IGJhc2UgPSBvdmVycmlkZSA/IHsgeDogb3ZlcnJpZGUueCwgeTogb3ZlcnJpZGUueSB9IDogc3F1YXJlVG9QY3Qoc3EpO1xuICAgICAgICAgICAgLy8gb2Zmc2V0IHNvIG11bHRpcGxlIHRva2VucyBvbiBzYW1lIHNxdWFyZSBkb24ndCBvdmVybGFwIGNvbXBsZXRlbHlcbiAgICAgICAgICAgIGNvbnN0IHNhbWVTcXVhcmVJZHggPSBvdmVycmlkZSA/IDAgOiBwbGF5ZXJzXG4gICAgICAgICAgICAgIC5tYXAoKF8sIGopID0+IGopXG4gICAgICAgICAgICAgIC5maWx0ZXIoaiA9PiB0b2tlblBvc2l0aW9uc1tqXSA9PT0gc3EpXG4gICAgICAgICAgICAgIC5pbmRleE9mKGkpO1xuICAgICAgICAgICAgY29uc3Qgb3ggPSBvdmVycmlkZSA/IDAgOiAoc2FtZVNxdWFyZUlkeCAlIDIpICogMy41IC0gMS43NTtcbiAgICAgICAgICAgIGNvbnN0IG95ID0gb3ZlcnJpZGUgPyAwIDogTWF0aC5mbG9vcihzYW1lU3F1YXJlSWR4IC8gMikgKiAzLjUgLSAxLjc1O1xuICAgICAgICAgICAgY29uc3QgeCA9IGJhc2UueCwgeSA9IGJhc2UueTtcbiAgICAgICAgICAgIGNvbnN0IGlzQ3VycmVudCA9IGkgPT09IGN1cnJlbnRQbGF5ZXJJZHg7XG4gICAgICAgICAgICBjb25zdCBpc01vdmluZyA9IGlzQ3VycmVudCAmJiBwaGFzZSA9PT0gJ21vdmluZyc7XG4gICAgICAgICAgICBjb25zdCBpc0NsaW1iaW5nID0gaXNDdXJyZW50ICYmIHBoYXNlID09PSAnY2xpbWJpbmcnO1xuICAgICAgICAgICAgY29uc3QgaXNTbGlkaW5nID0gaXNDdXJyZW50ICYmIHBoYXNlID09PSAnc2xpZGluZyc7XG4gICAgICAgICAgICBjb25zdCBpc1BvcnRhbGluZyA9IGlzQ3VycmVudCAmJiBwaGFzZSA9PT0gJ3BvcnRhbGluZyc7XG4gICAgICAgICAgICBjb25zdCBpc1NwaXJhbGluZyA9IGlzQ3VycmVudCAmJiBwaGFzZSA9PT0gJ3NwaXJhbGluZyc7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAga2V5PXtwLmlkfVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YHRva2VuICR7aXNDdXJyZW50ID8gJ2N1cnJlbnQnIDogJyd9ICR7cC5pc0FJID8gJ3JvYm90LXRva2VuJyA6ICcnfSAke2lzTW92aW5nID8gJ2hvcHBpbmcnIDogJyd9ICR7aXNDbGltYmluZyA/ICdjbGltYmluZycgOiAnJ30gJHtpc1NsaWRpbmcgPyAnc2xpZGluZycgOiAnJ30gJHtpc1BvcnRhbGluZyA/ICdwb3J0YWxpbmcnIDogJyd9ICR7aXNTcGlyYWxpbmcgPyAnc3BpcmFsaW5nJyA6ICcnfWB9XG4gICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgIGxlZnQ6IGAke3ggKyBveH0lYCxcbiAgICAgICAgICAgICAgICAgIHRvcDogYCR7eSArIG95fSVgLFxuICAgICAgICAgICAgICAgICAgJy0tcGNvbG9yJzogcC5jb2xvcixcbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge3AuaXNBSSA/IChcbiAgICAgICAgICAgICAgICAgIDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIHdpZHRoPVwiNzAlXCIgaGVpZ2h0PVwiNzAlXCI+XG4gICAgICAgICAgICAgICAgICAgIDxyZWN0IHg9XCI1XCIgeT1cIjdcIiB3aWR0aD1cIjE0XCIgaGVpZ2h0PVwiMTJcIiByeD1cIjNcIiBmaWxsPVwid2hpdGVcIi8+XG4gICAgICAgICAgICAgICAgICAgIDxjaXJjbGUgY3g9XCI5XCIgY3k9XCIxM1wiIHI9XCIxLjZcIiBmaWxsPXtwLmNvbG9yfS8+XG4gICAgICAgICAgICAgICAgICAgIDxjaXJjbGUgY3g9XCIxNVwiIGN5PVwiMTNcIiByPVwiMS42XCIgZmlsbD17cC5jb2xvcn0vPlxuICAgICAgICAgICAgICAgICAgICA8cmVjdCB4PVwiMTBcIiB5PVwiMTZcIiB3aWR0aD1cIjRcIiBoZWlnaHQ9XCIxLjJcIiByeD1cIjAuNlwiIGZpbGw9e3AuY29sb3J9Lz5cbiAgICAgICAgICAgICAgICAgICAgPHJlY3QgeD1cIjExXCIgeT1cIjRcIiB3aWR0aD1cIjJcIiBoZWlnaHQ9XCIzXCIgZmlsbD1cIndoaXRlXCIvPlxuICAgICAgICAgICAgICAgICAgICA8Y2lyY2xlIGN4PVwiMTJcIiBjeT1cIjMuNVwiIHI9XCIxLjJcIiBmaWxsPVwid2hpdGVcIi8+XG4gICAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICApIDogcC5jaGFySWQgPyAoXG4gICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7d2lkdGg6JzEzMCUnLGhlaWdodDonMTMwJScsZGlzcGxheTonZmxleCcsYWxpZ25JdGVtczonY2VudGVyJyxqdXN0aWZ5Q29udGVudDonY2VudGVyJyx0cmFuc2Zvcm06J3RyYW5zbGF0ZVkoLTglKSd9fT5cbiAgICAgICAgICAgICAgICAgICAgPENoYXJhY3RlciBjaGFySWQ9e3AuY2hhcklkfSBzaXplPXsnMTAwJSd9Lz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0b2tlbi1sYWJlbFwiPntwLmxhYmVsfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSl9XG4gICAgICAgICAgey8qIEZYIGxheWVyOiBzcGFya2xlcyBvbiBjbGltYiwgc3BlZWQtbGluZXMgb24gc2xpZGUgKi99XG4gICAgICAgICAgeygoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjdXJTcSA9IHRva2VuUG9zaXRpb25zW2N1cnJlbnRQbGF5ZXJJZHhdO1xuICAgICAgICAgICAgaWYgKCFjdXJTcSB8fCBjdXJTcSA8IDEpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY29uc3QgeyB4LCB5IH0gPSBzcXVhcmVUb1BjdChjdXJTcSk7XG4gICAgICAgICAgICBpZiAocGhhc2UgPT09ICdjbGltYmluZycpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZ4LXNwYXJrbGVzXCIgc3R5bGU9e3sgbGVmdDogYCR7eH0lYCwgdG9wOiBgJHt5fSVgIH19PlxuICAgICAgICAgICAgICAgICAge1suLi5BcnJheSg4KV0ubWFwKChfLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGtleT17aX0gY2xhc3NOYW1lPVwic3BhcmtcIiBzdHlsZT17eyAnLS1pJzogaSwgJy0tYW5nJzogYCR7aSAqIDQ1fWRlZ2AgfX0vPlxuICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocGhhc2UgPT09ICdzbGlkaW5nJykge1xuICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZngtd2hvb3NoXCIgc3R5bGU9e3sgbGVmdDogYCR7eH0lYCwgdG9wOiBgJHt5fSVgIH19PlxuICAgICAgICAgICAgICAgICAge1suLi5BcnJheSg1KV0ubWFwKChfLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGtleT17aX0gY2xhc3NOYW1lPVwid2hvb3NoLWxpbmVcIiBzdHlsZT17eyAnLS1pJzogaSB9fS8+XG4gICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH0pKCl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxzdHlsZT57YFxuICAgICAgICAuYm9hcmQtd3JhcCB7XG4gICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgIGFzcGVjdC1yYXRpbzogMS8xO1xuICAgICAgICAgIG1heC13aWR0aDogbWluKDk1dncsIDgwdmgsIDcyMHB4KTtcbiAgICAgICAgfVxuICAgICAgICAuYm9hcmQge1xuICAgICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICBoZWlnaHQ6IDEwMCU7XG4gICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYm9hcmQtYmcpO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICAgICAgcGFkZGluZzogMTRweDtcbiAgICAgICAgICBib3gtc2hhZG93OlxuICAgICAgICAgICAgMCAxcHggMCByZ2JhKDI1NSwyNTUsMjU1LDAuMDQpIGluc2V0LFxuICAgICAgICAgICAgMCAyNHB4IDQ4cHggLTE2cHggcmdiYSgyNiwzMSw0NiwwLjM1KSxcbiAgICAgICAgICAgIDAgMnB4IDAgcmdiYSgyNiwzMSw0NiwwLjEpO1xuICAgICAgICB9XG4gICAgICAgIC5ib2FyZC1ncmlkIHtcbiAgICAgICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgICAgICAgIGRpc3BsYXk6IGdyaWQ7XG4gICAgICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiByZXBlYXQoMTAsIDFmcik7XG4gICAgICAgICAgZ3JpZC10ZW1wbGF0ZS1yb3dzOiByZXBlYXQoMTAsIDFmcik7XG4gICAgICAgICAgZ2FwOiAxcHg7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjA0KTtcbiAgICAgICAgfVxuICAgICAgICAuc3Ege1xuICAgICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xuICAgICAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgICAgICBwYWRkaW5nOiA0cHggNXB4O1xuICAgICAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4zcztcbiAgICAgICAgfVxuICAgICAgICAuc3EubGlnaHQge1xuICAgICAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsICNmYmY1ZTggMCUsICNmNGVjZDggMTAwJSk7XG4gICAgICAgICAgY29sb3I6ICMxYTFmMmU7XG4gICAgICAgICAgYm94LXNoYWRvdzogaW5zZXQgMXB4IDFweCAwIHJnYmEoMjU1LDI1NSwyNTUsMC42KSwgaW5zZXQgLTFweCAtMXB4IDAgcmdiYSgwLDAsMCwwLjA0KTtcbiAgICAgICAgfVxuICAgICAgICAuc3EuZGFyayB7XG4gICAgICAgICAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywgI2VjZTJjYSAwJSwgI2RkZDBiMCAxMDAlKTtcbiAgICAgICAgICBjb2xvcjogIzFhMWYyZTtcbiAgICAgICAgICBib3gtc2hhZG93OiBpbnNldCAxcHggMXB4IDAgcmdiYSgyNTUsMjU1LDI1NSwwLjM1KSwgaW5zZXQgLTFweCAtMXB4IDAgcmdiYSgwLDAsMCwwLjA1KTtcbiAgICAgICAgfVxuICAgICAgICAuc3EuaGwge1xuICAgICAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsICNmZmY2YjAgMCUsICNmZmUwNzQgMTAwJSkgIWltcG9ydGFudDtcbiAgICAgICAgICBib3gtc2hhZG93OiBpbnNldCAwIDAgMCAycHggI2U4YjIzZSwgMCAwIDAgMnB4IHJnYmEoMjMyLDE3OCw2MiwwLjMpO1xuICAgICAgICAgIGFuaW1hdGlvbjogc3EtcHVsc2UgMC45cyBlYXNlLWluLW91dCBpbmZpbml0ZTtcbiAgICAgICAgfVxuICAgICAgICBAa2V5ZnJhbWVzIHNxLXB1bHNlIHtcbiAgICAgICAgICAwJSwgMTAwJSB7IGJveC1zaGFkb3c6IGluc2V0IDAgMCAwIDJweCAjZThiMjNlLCAwIDAgMCAycHggcmdiYSgyMzIsMTc4LDYyLDAuMyk7IH1cbiAgICAgICAgICA1MCUgeyBib3gtc2hhZG93OiBpbnNldCAwIDAgMCAycHggI2U4YjIzZSwgMCAwIDAgOHB4IHJnYmEoMjMyLDE3OCw2MiwwLjUpOyB9XG4gICAgICAgIH1cbiAgICAgICAgLnNxLW51bSB7XG4gICAgICAgICAgZm9udC1zaXplOiBjbGFtcCg5cHgsIDEuMXZ3LCAxM3B4KTtcbiAgICAgICAgICBmb250LXdlaWdodDogNTAwO1xuICAgICAgICAgIG9wYWNpdHk6IDAuNjU7XG4gICAgICAgICAgbGV0dGVyLXNwYWNpbmc6IC0wLjAyZW07XG4gICAgICAgIH1cbiAgICAgICAgLnNxLXRhZyB7XG4gICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgIGJvdHRvbTogM3B4O1xuICAgICAgICAgIHJpZ2h0OiA0cHg7XG4gICAgICAgICAgZm9udC1zaXplOiBjbGFtcCg3cHgsIDAuN3Z3LCA4cHgpO1xuICAgICAgICAgIGZvbnQtZmFtaWx5OiAnR2Vpc3QgTW9ubycsIG1vbm9zcGFjZTtcbiAgICAgICAgICBmb250LXdlaWdodDogNTAwO1xuICAgICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA4ZW07XG4gICAgICAgICAgY29sb3I6IHZhcigtLWFjY2VudC0yKTtcbiAgICAgICAgfVxuICAgICAgICAuc3EtdGFnLmdvbGQgeyBjb2xvcjogdmFyKC0tYWNjZW50LTMpOyB9XG4gICAgICAgIC5zcS1kb3Qge1xuICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICBib3R0b206IDJweDtcbiAgICAgICAgICByaWdodDogM3B4O1xuICAgICAgICAgIGZvbnQtc2l6ZTogMTBweDtcbiAgICAgICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgICAgfVxuICAgICAgICAuc3EtZG90LmNodXRlIHsgY29sb3I6IHZhcigtLWFjY2VudCk7IH1cbiAgICAgICAgLnNxLWRvdC5sYWRkZXIgeyBjb2xvcjogdmFyKC0tYWNjZW50LTIpOyB9XG4gICAgICAgIC5zcS1kb3QucG9ydGFsIHsgY29sb3I6ICM5YjVjZmY7IGFuaW1hdGlvbjogcG9ydGFsLWRvdC1wdWxzZSAxLjRzIGVhc2UtaW4tb3V0IGluZmluaXRlOyB9XG4gICAgICAgIEBrZXlmcmFtZXMgcG9ydGFsLWRvdC1wdWxzZSB7XG4gICAgICAgICAgMCUsIDEwMCUgeyB0ZXh0LXNoYWRvdzogMCAwIDAgIzliNWNmZjsgb3BhY2l0eTogMC45OyB9XG4gICAgICAgICAgNTAlIHsgdGV4dC1zaGFkb3c6IDAgMCA2cHggIzliNWNmZjsgb3BhY2l0eTogMTsgfVxuICAgICAgICB9XG4gICAgICAgIC5ib2FyZC1zdmcge1xuICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICB0b3A6IDE0cHg7IGxlZnQ6IDE0cHg7IHJpZ2h0OiAxNHB4OyBib3R0b206IDE0cHg7XG4gICAgICAgICAgd2lkdGg6IGNhbGMoMTAwJSAtIDI4cHgpO1xuICAgICAgICAgIGhlaWdodDogY2FsYygxMDAlIC0gMjhweCk7XG4gICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgICAgb3ZlcmZsb3c6IHZpc2libGU7XG4gICAgICAgICAgZmlsdGVyOiBkcm9wLXNoYWRvdygwIDZweCA4cHggcmdiYSgwLDAsMCwwLjM1KSkgZHJvcC1zaGFkb3coMCAycHggMnB4IHJnYmEoMCwwLDAsMC4yNSkpO1xuICAgICAgICAgIHotaW5kZXg6IDM7XG4gICAgICAgIH1cbiAgICAgICAgLnRva2VucyB7XG4gICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgIHRvcDogMTRweDsgbGVmdDogMTRweDsgcmlnaHQ6IDE0cHg7IGJvdHRvbTogMTRweDtcbiAgICAgICAgICB3aWR0aDogY2FsYygxMDAlIC0gMjhweCk7XG4gICAgICAgICAgaGVpZ2h0OiBjYWxjKDEwMCUgLSAyOHB4KTtcbiAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgICAgICB6LWluZGV4OiA0O1xuICAgICAgICB9XG4gICAgICAgIC50b2tlbiB7XG4gICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgIHdpZHRoOiA2JTtcbiAgICAgICAgICBoZWlnaHQ6IDYlO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1wY29sb3IpO1xuICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICBib3gtc2hhZG93OlxuICAgICAgICAgICAgMCAycHggMCByZ2JhKDAsMCwwLDAuMjUpLFxuICAgICAgICAgICAgMCA0cHggMTBweCByZ2JhKDAsMCwwLDAuMyksXG4gICAgICAgICAgICBpbnNldCAwIDJweCAzcHggcmdiYSgyNTUsMjU1LDI1NSwwLjQpLFxuICAgICAgICAgICAgaW5zZXQgMCAtMnB4IDNweCByZ2JhKDAsMCwwLDAuMik7XG4gICAgICAgICAgLyogU21vb3RoIGdsaWRlIGJldHdlZW4gc3F1YXJlcyDigJQgZHVyYXRpb24gbWF0Y2hlcyB0aGUgcGVyLXN0ZXAgaW50ZXJ2YWwgYmVsb3dcbiAgICAgICAgICAgICAodG9rZW5TdGVwTXMgfjI0MG1zKSBzbyBlYWNoIGhvcCBsYW5kcyBjbGVhbmx5IGJlZm9yZSB0aGUgbmV4dCBiZWdpbnMuIFRoZVxuICAgICAgICAgICAgIGN1cnZlIGlzIGEgZ2VudGxlIGVhc2UgKG5vIG92ZXJzaG9vdCkgc28gdGhlIHRva2VuIGZlZWxzIGxpZ2h0IGFuZCBwcmVjaXNlXG4gICAgICAgICAgICAgcmF0aGVyIHRoYW4gaml0dGVyeSAvIG92ZXItY29ycmVjdGVkLiAqL1xuICAgICAgICAgIHRyYW5zaXRpb246IGxlZnQgMjAwbXMgY3ViaWMtYmV6aWVyKDAuMzMsIDAsIDAuMiwgMSksIHRvcCAyMDBtcyBjdWJpYy1iZXppZXIoMC4zMywgMCwgMC4yLCAxKTtcbiAgICAgICAgICB6LWluZGV4OiAyO1xuICAgICAgICB9XG4gICAgICAgIC50b2tlbi5yb2JvdC10b2tlbiB7XG4gICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tcm9ib3QpO1xuICAgICAgICB9XG4gICAgICAgIC50b2tlbi5jdXJyZW50IHtcbiAgICAgICAgICB6LWluZGV4OiAzO1xuICAgICAgICAgIGFuaW1hdGlvbjogYm9iIDEuNHMgZWFzZS1pbi1vdXQgaW5maW5pdGU7XG4gICAgICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgICAgIDAgMCAwIDNweCByZ2JhKDI1NSwyNTUsMjU1LDAuNSksXG4gICAgICAgICAgICAwIDAgMCA1cHggdmFyKC0tcGNvbG9yKSxcbiAgICAgICAgICAgIDAgMnB4IDAgcmdiYSgwLDAsMCwwLjI1KSxcbiAgICAgICAgICAgIDAgOHB4IDIwcHggcmdiYSgwLDAsMCwwLjM1KSxcbiAgICAgICAgICAgIGluc2V0IDAgMnB4IDNweCByZ2JhKDI1NSwyNTUsMjU1LDAuNCk7XG4gICAgICAgIH1cbiAgICAgICAgQGtleWZyYW1lcyBib2Ige1xuICAgICAgICAgIDAlLCAxMDAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTU1JSk7IH1cbiAgICAgICAgICA1MCUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtNDUlKTsgfVxuICAgICAgICB9XG4gICAgICAgIC8qIE9uZSBob3AgY3ljbGUgcGVyIHNxdWFyZSBzdGVwIOKAlCBkdXJhdGlvbiBtYXRjaGVzIHRva2VuU3RlcE1zIHNvIGVhY2hcbiAgICAgICAgICAgaG9wIHBlYWtzIG1pZC1nbGlkZSBhbmQgbGFuZHMgYXMgdGhlIHRva2VuIHJlYWNoZXMgdGhlIG5leHQgc3F1YXJlLiAqL1xuICAgICAgICAudG9rZW4uaG9wcGluZyB7XG4gICAgICAgICAgYW5pbWF0aW9uOiB0b2tlbi1ob3AgMjQwbXMgY3ViaWMtYmV6aWVyKDAuNSwgMCwgMC41LCAxKSBpbmZpbml0ZTtcbiAgICAgICAgfVxuICAgICAgICBAa2V5ZnJhbWVzIHRva2VuLWhvcCB7XG4gICAgICAgICAgMCUgICB7IHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpIHNjYWxlKDEpOyB9XG4gICAgICAgICAgNDUlICB7IHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC04MiUpIHNjYWxlKDEuMDYpOyB9XG4gICAgICAgICAgODAlICB7IHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC00OCUpIHNjYWxlKDAuOTYpOyB9XG4gICAgICAgICAgMTAwJSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpIHNjYWxlKDEpOyB9XG4gICAgICAgIH1cbiAgICAgICAgLnRva2VuLmNsaW1iaW5nIHtcbiAgICAgICAgICBhbmltYXRpb246IHRva2VuLWNsaW1iIDAuNDVzIGVhc2UtaW4tb3V0IGluZmluaXRlO1xuICAgICAgICAgIGZpbHRlcjogZHJvcC1zaGFkb3coMCAwIDhweCByZ2JhKDQyLDEzOCw5NSwwLjYpKTtcbiAgICAgICAgfVxuICAgICAgICBAa2V5ZnJhbWVzIHRva2VuLWNsaW1iIHtcbiAgICAgICAgICAwJSwgMTAwJSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpIHJvdGF0ZSgtNGRlZykgc2NhbGUoMSk7IH1cbiAgICAgICAgICA1MCUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtNTglKSByb3RhdGUoNGRlZykgc2NhbGUoMS4wOCk7IH1cbiAgICAgICAgfVxuICAgICAgICAudG9rZW4uc2xpZGluZyB7XG4gICAgICAgICAgYW5pbWF0aW9uOiB0b2tlbi1zbGlkZSAwLjM1cyBlYXNlLWluLW91dCBpbmZpbml0ZTtcbiAgICAgICAgICBmaWx0ZXI6IGRyb3Atc2hhZG93KDAgMCAxMHB4IHJnYmEoMjMyLDg4LDYyLDAuNykpO1xuICAgICAgICB9XG4gICAgICAgIC8qIFdoaWxlIHRoZSB0b2tlbiBpcyBiZWluZyBhdXRvLXBpbG90ZWQgYWxvbmcgdGhlIHNwaXJhbCBwYXRoLCBraWxsIGxlZnQvdG9wIHRyYW5zaXRpb25zXG4gICAgICAgICAgIHNvIFJBRiB1cGRhdGVzIHJlbmRlciAxOjEuIEFkZCBhIHNwaW4gKyBnbG93IHRvIHNlbGwgdGhlIFwid2hlZSFcIiB3YXRlci1zbGlkZSBmZWVsLiAqL1xuICAgICAgICAudG9rZW4uc3BpcmFsaW5nIHtcbiAgICAgICAgICB0cmFuc2l0aW9uOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICAgICAgYW5pbWF0aW9uOiB0b2tlbi1zcGlyYWwgMC41NXMgbGluZWFyIGluZmluaXRlO1xuICAgICAgICAgIGZpbHRlcjogZHJvcC1zaGFkb3coMCAwIDEwcHggcmdiYSgyNTUsMTIyLDYxLDAuOCkpO1xuICAgICAgICAgIHotaW5kZXg6IDg7XG4gICAgICAgIH1cbiAgICAgICAgQGtleWZyYW1lcyB0b2tlbi1zcGlyYWwge1xuICAgICAgICAgIDAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSkgcm90YXRlKDBkZWcpIHNjYWxlKDEpOyB9XG4gICAgICAgICAgNTAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTU4JSkgcm90YXRlKDE4MGRlZykgc2NhbGUoMS4xKTsgfVxuICAgICAgICAgIDEwMCUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtNTAlKSByb3RhdGUoMzYwZGVnKSBzY2FsZSgxKTsgfVxuICAgICAgICB9XG4gICAgICAgIEBrZXlmcmFtZXMgdG9rZW4tc2xpZGUge1xuICAgICAgICAgIDAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSkgcm90YXRlKDBkZWcpOyB9XG4gICAgICAgICAgMjUlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTU1JSwgLTQ4JSkgcm90YXRlKC0xMmRlZyk7IH1cbiAgICAgICAgICA1MCUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtNTIlKSByb3RhdGUoMGRlZyk7IH1cbiAgICAgICAgICA3NSUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNDUlLCAtNDglKSByb3RhdGUoMTJkZWcpOyB9XG4gICAgICAgICAgMTAwJSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpIHJvdGF0ZSgwZGVnKTsgfVxuICAgICAgICB9XG4gICAgICAgIC8qIFNwYXJrbGUgYnVyc3Qgb3ZlcmxheSBmb3IgbGFkZGVyIGNsaW1icyAqL1xuICAgICAgICAuZngtc3BhcmtsZXMge1xuICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICB3aWR0aDogMDsgaGVpZ2h0OiAwO1xuICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgICAgIHotaW5kZXg6IDY7XG4gICAgICAgIH1cbiAgICAgICAgLmZ4LXNwYXJrbGVzIC5zcGFyayB7XG4gICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgIGxlZnQ6IDA7IHRvcDogMDtcbiAgICAgICAgICB3aWR0aDogOHB4OyBoZWlnaHQ6IDhweDtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICAgICAgYmFja2dyb3VuZDogcmFkaWFsLWdyYWRpZW50KGNpcmNsZSwgI2ZmZiAwJSwgI2ZmZTA3NCA0MCUsIHRyYW5zcGFyZW50IDcwJSk7XG4gICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgICAgICAgYW5pbWF0aW9uOiBzcGFyay1idXJzdCAxcyBlYXNlLW91dCBpbmZpbml0ZTtcbiAgICAgICAgICBhbmltYXRpb24tZGVsYXk6IGNhbGModmFyKC0taSkgKiAwLjA4cyk7XG4gICAgICAgIH1cbiAgICAgICAgQGtleWZyYW1lcyBzcGFyay1idXJzdCB7XG4gICAgICAgICAgMCUge1xuICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSkgcm90YXRlKHZhcigtLWFuZykpIHRyYW5zbGF0ZVgoMCkgc2NhbGUoMC40KTtcbiAgICAgICAgICAgIG9wYWNpdHk6IDE7XG4gICAgICAgICAgfVxuICAgICAgICAgIDEwMCUge1xuICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSkgcm90YXRlKHZhcigtLWFuZykpIHRyYW5zbGF0ZVgoMjZweCkgc2NhbGUoMCk7XG4gICAgICAgICAgICBvcGFjaXR5OiAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvKiBXaG9vc2ggbW90aW9uIGxpbmVzIGZvciBjaHV0ZSBzbGlkZXMgKi9cbiAgICAgICAgLmZ4LXdob29zaCB7XG4gICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgIHdpZHRoOiAwOyBoZWlnaHQ6IDA7XG4gICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgICAgei1pbmRleDogNjtcbiAgICAgICAgfVxuICAgICAgICAuZngtd2hvb3NoIC53aG9vc2gtbGluZSB7XG4gICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgIGxlZnQ6IC0xNHB4O1xuICAgICAgICAgIHRvcDogY2FsYyh2YXIoLS1pKSAqIDVweCAtIDEwcHgpO1xuICAgICAgICAgIHdpZHRoOiAyOHB4O1xuICAgICAgICAgIGhlaWdodDogMnB4O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDFweDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoOTBkZWcsIHRyYW5zcGFyZW50LCByZ2JhKDIzMiw4OCw2MiwwLjkpLCB0cmFuc3BhcmVudCk7XG4gICAgICAgICAgYW5pbWF0aW9uOiB3aG9vc2gtbW92ZSAwLjVzIGxpbmVhciBpbmZpbml0ZTtcbiAgICAgICAgICBhbmltYXRpb24tZGVsYXk6IGNhbGModmFyKC0taSkgKiAwLjA4cyk7XG4gICAgICAgIH1cbiAgICAgICAgQGtleWZyYW1lcyB3aG9vc2gtbW92ZSB7XG4gICAgICAgICAgMCUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTMwcHgpOyBvcGFjaXR5OiAwOyB9XG4gICAgICAgICAgNDAlIHsgb3BhY2l0eTogMTsgfVxuICAgICAgICAgIDEwMCUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoMzBweCk7IG9wYWNpdHk6IDA7IH1cbiAgICAgICAgfVxuICAgICAgICAvKiBQb3J0YWwgc3dpcmwgYW5pbWF0aW9ucyAqL1xuICAgICAgICBAa2V5ZnJhbWVzIHBvcnRhbC1zcGluIHtcbiAgICAgICAgICBmcm9tIHsgdHJhbnNmb3JtOiByb3RhdGUoMGRlZyk7IH1cbiAgICAgICAgICB0byB7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IH1cbiAgICAgICAgfVxuICAgICAgICBAa2V5ZnJhbWVzIHBvcnRhbC1zcGluLXJldiB7XG4gICAgICAgICAgZnJvbSB7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IH1cbiAgICAgICAgICB0byB7IHRyYW5zZm9ybTogcm90YXRlKDBkZWcpOyB9XG4gICAgICAgIH1cbiAgICAgICAgQGtleWZyYW1lcyBwb3J0YWwtcHVsc2Uge1xuICAgICAgICAgIDAlLCAxMDAlIHsgb3BhY2l0eTogMC45OyB9XG4gICAgICAgICAgNTAlIHsgb3BhY2l0eTogMTsgdHJhbnNmb3JtOiBzY2FsZSgxLjA4KTsgdHJhbnNmb3JtLW9yaWdpbjogY2VudGVyOyB9XG4gICAgICAgIH1cbiAgICAgICAgLyogVG9rZW4gYmVpbmcgcG9ydGFsZWQg4oCUIGFyY3MgdXAgYW5kIGF3YXkgdGhlbiBjb21lcyBiYWNrIGZvciBsYW5kaW5nICovXG4gICAgICAgIC50b2tlbi5wb3J0YWxpbmcge1xuICAgICAgICAgIHRyYW5zaXRpb246IGxlZnQgMC45cyBjdWJpYy1iZXppZXIoLjU1LC4wNSwuNDUsMSksIHRvcCAwLjlzIGN1YmljLWJlemllciguNTUsLjA1LC40NSwxKSAhaW1wb3J0YW50O1xuICAgICAgICAgIGFuaW1hdGlvbjogcG9ydGFsLXRocm93IDAuOXMgZWFzZS1pbi1vdXQ7XG4gICAgICAgICAgei1pbmRleDogMTA7XG4gICAgICAgIH1cbiAgICAgICAgQGtleWZyYW1lcyBwb3J0YWwtdGhyb3cge1xuICAgICAgICAgIDAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSkgc2NhbGUoMSkgcm90YXRlKDBkZWcpOyBmaWx0ZXI6IG5vbmU7IH1cbiAgICAgICAgICAyMCUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtMTIwJSkgc2NhbGUoMC43KSByb3RhdGUoNTQwZGVnKTsgZmlsdGVyOiBicmlnaHRuZXNzKDEuNCkgZHJvcC1zaGFkb3coMCAwIDZweCAjOWI1Y2ZmKTsgfVxuICAgICAgICAgIDUwJSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC0yMjAlKSBzY2FsZSgwLjQpIHJvdGF0ZSgxNDQwZGVnKTsgZmlsdGVyOiBicmlnaHRuZXNzKDEuNikgZHJvcC1zaGFkb3coMCAwIDE0cHggIzliNWNmZik7IH1cbiAgICAgICAgICA4MCUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtMTEwJSkgc2NhbGUoMC43NSkgcm90YXRlKDIzNDBkZWcpOyBmaWx0ZXI6IGJyaWdodG5lc3MoMS40KSBkcm9wLXNoYWRvdygwIDAgNnB4ICM5YjVjZmYpOyB9XG4gICAgICAgICAgMTAwJSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpIHNjYWxlKDEpIHJvdGF0ZSgyODgwZGVnKTsgZmlsdGVyOiBub25lOyB9XG4gICAgICAgIH1cbiAgICAgICAgLnRva2VuLWxhYmVsIHtcbiAgICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgICAgICBmb250LXNpemU6IGNsYW1wKDlweCwgMXZ3LCAxMnB4KTtcbiAgICAgICAgICB0ZXh0LXNoYWRvdzogMCAxcHggMnB4IHJnYmEoMCwwLDAsMC40KTtcbiAgICAgICAgfVxuICAgICAgYH08L3N0eWxlPlxuICAgIDwvZGl2PlxuICApO1xufVxuXG53aW5kb3cuQm9hcmQgPSBCb2FyZDtcbndpbmRvdy5DSFVURVMgPSBDSFVURVM7XG53aW5kb3cuTEFEREVSUyA9IExBRERFUlM7XG53aW5kb3cuc3F1YXJlVG9QY3QgPSBzcXVhcmVUb1BjdDtcblxuXG4vLyA9PT0gY2hhcmFjdGVycy5qc3ggPT09XG4vLyBSb2JvdCBBSSBjaGFyYWN0ZXJcblxuZnVuY3Rpb24gUm9ib3QoeyBtb29kID0gJ2hhcHB5Jywgc2l6ZSA9IDgwLCBjb2xvciA9ICcjMWExZjJlJyB9KSB7XG4gIC8vIG1vb2Q6IGhhcHB5IHwgdGhpbmtpbmcgfCBjZWxlYnJhdGluZyB8IHNhZFxuICBjb25zdCBleWVZID0gbW9vZCA9PT0gJ3NhZCcgPyAxMyA6IDEyO1xuICBjb25zdCBtb3V0aCA9IHtcbiAgICBoYXBweTogPHBhdGggZD1cIk0gOSAxNiBRIDEyIDE4IDE1IDE2XCIgc3Ryb2tlPXtjb2xvcn0gc3Ryb2tlV2lkdGg9XCIxXCIgZmlsbD1cIm5vbmVcIiBzdHJva2VMaW5lY2FwPVwicm91bmRcIi8+LFxuICAgIHRoaW5raW5nOiA8bGluZSB4MT1cIjEwXCIgeTE9XCIxN1wiIHgyPVwiMTRcIiB5Mj1cIjE3XCIgc3Ryb2tlPXtjb2xvcn0gc3Ryb2tlV2lkdGg9XCIxXCIgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIvPixcbiAgICBjZWxlYnJhdGluZzogPGVsbGlwc2UgY3g9XCIxMlwiIGN5PVwiMTdcIiByeD1cIjJcIiByeT1cIjEuNVwiIGZpbGw9e2NvbG9yfS8+LFxuICAgIHNhZDogPHBhdGggZD1cIk0gOSAxNyBRIDEyIDE1IDE1IDE3XCIgc3Ryb2tlPXtjb2xvcn0gc3Ryb2tlV2lkdGg9XCIxXCIgZmlsbD1cIm5vbmVcIiBzdHJva2VMaW5lY2FwPVwicm91bmRcIi8+LFxuICB9W21vb2RdO1xuXG4gIHJldHVybiAoXG4gICAgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgd2lkdGg9e3NpemV9IGhlaWdodD17c2l6ZX0gc3R5bGU9e3sgZGlzcGxheTogJ2Jsb2NrJyB9fT5cbiAgICAgIHsvKiBhbnRlbm5hICovfVxuICAgICAgPGxpbmUgeDE9XCIxMlwiIHkxPVwiNVwiIHgyPVwiMTJcIiB5Mj1cIjNcIiBzdHJva2U9e2NvbG9yfSBzdHJva2VXaWR0aD1cIjAuOFwiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICAgIDxjaXJjbGUgY3g9XCIxMlwiIGN5PVwiMi41XCIgcj1cIjFcIiBmaWxsPVwiI2U4YjIzZVwiPlxuICAgICAgICB7bW9vZCA9PT0gJ3RoaW5raW5nJyAmJiA8YW5pbWF0ZSBhdHRyaWJ1dGVOYW1lPVwib3BhY2l0eVwiIHZhbHVlcz1cIjE7MC4zOzFcIiBkdXI9XCIxc1wiIHJlcGVhdENvdW50PVwiaW5kZWZpbml0ZVwiLz59XG4gICAgICA8L2NpcmNsZT5cbiAgICAgIHsvKiBoZWFkICovfVxuICAgICAgPHJlY3QgeD1cIjVcIiB5PVwiNVwiIHdpZHRoPVwiMTRcIiBoZWlnaHQ9XCIxM1wiIHJ4PVwiMy41XCIgZmlsbD17Y29sb3J9Lz5cbiAgICAgIHsvKiBzY3JlZW4gKi99XG4gICAgICA8cmVjdCB4PVwiNi41XCIgeT1cIjdcIiB3aWR0aD1cIjExXCIgaGVpZ2h0PVwiOVwiIHJ4PVwiMlwiIGZpbGw9XCIjZjdmMWU0XCIvPlxuICAgICAgey8qIGV5ZXMgKi99XG4gICAgICA8Y2lyY2xlIGN4PVwiOS41XCIgY3k9e2V5ZVl9IHI9XCIxLjNcIiBmaWxsPXtjb2xvcn0+XG4gICAgICAgIDxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9XCJyXCIgdmFsdWVzPVwiMS4zOzEuMzswLjI7MS4zXCIga2V5VGltZXM9XCIwOzAuOTswLjk1OzFcIiBkdXI9XCI0c1wiIHJlcGVhdENvdW50PVwiaW5kZWZpbml0ZVwiLz5cbiAgICAgIDwvY2lyY2xlPlxuICAgICAgPGNpcmNsZSBjeD1cIjE0LjVcIiBjeT17ZXllWX0gcj1cIjEuM1wiIGZpbGw9e2NvbG9yfT5cbiAgICAgICAgPGFuaW1hdGUgYXR0cmlidXRlTmFtZT1cInJcIiB2YWx1ZXM9XCIxLjM7MS4zOzAuMjsxLjNcIiBrZXlUaW1lcz1cIjA7MC45OzAuOTU7MVwiIGR1cj1cIjRzXCIgcmVwZWF0Q291bnQ9XCJpbmRlZmluaXRlXCIvPlxuICAgICAgPC9jaXJjbGU+XG4gICAgICB7LyogbW91dGggKi99XG4gICAgICB7bW91dGh9XG4gICAgICB7LyogY2hlZWsgYmx1c2ggKi99XG4gICAgICA8Y2lyY2xlIGN4PVwiNy41XCIgY3k9XCIxNVwiIHI9XCIwLjhcIiBmaWxsPVwiI2U4NTgzZVwiIG9wYWNpdHk9XCIwLjVcIi8+XG4gICAgICA8Y2lyY2xlIGN4PVwiMTYuNVwiIGN5PVwiMTVcIiByPVwiMC44XCIgZmlsbD1cIiNlODU4M2VcIiBvcGFjaXR5PVwiMC41XCIvPlxuICAgICAgey8qIGJvZHkgaGludCAqL31cbiAgICAgIDxyZWN0IHg9XCI4XCIgeT1cIjE4XCIgd2lkdGg9XCI4XCIgaGVpZ2h0PVwiM1wiIHJ4PVwiMVwiIGZpbGw9e2NvbG9yfSBvcGFjaXR5PVwiMC4zXCIvPlxuICAgIDwvc3ZnPlxuICApO1xufVxuXG4vLyBIdW1hbiBwbGF5ZXIgYXZhdGFyIChzaW1wbGUgc2lsaG91ZXR0ZSB3aXRoIGNvbG9yKVxuZnVuY3Rpb24gQXZhdGFyKHsgbGFiZWwsIGNvbG9yLCBzaXplID0gNDgsIGlzQ3VycmVudCA9IGZhbHNlIH0pIHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBzdHlsZT17e1xuICAgICAgICB3aWR0aDogc2l6ZSxcbiAgICAgICAgaGVpZ2h0OiBzaXplLFxuICAgICAgICBib3JkZXJSYWRpdXM6ICc1MCUnLFxuICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvcixcbiAgICAgICAgY29sb3I6ICd3aGl0ZScsXG4gICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgYWxpZ25JdGVtczogJ2NlbnRlcicsXG4gICAgICAgIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJyxcbiAgICAgICAgZm9udFdlaWdodDogNzAwLFxuICAgICAgICBmb250U2l6ZTogc2l6ZSAqIDAuNCxcbiAgICAgICAgYm94U2hhZG93OiBpc0N1cnJlbnRcbiAgICAgICAgICA/IGAwIDAgMCAzcHggdmFyKC0tYmcpLCAwIDAgMCA1cHggJHtjb2xvcn0sIDAgNHB4IDEwcHggcmdiYSgwLDAsMCwwLjIpYFxuICAgICAgICAgIDogJzAgMnB4IDZweCByZ2JhKDAsMCwwLDAuMTUpLCBpbnNldCAwIDJweCAzcHggcmdiYSgyNTUsMjU1LDI1NSwwLjMpJyxcbiAgICAgICAgZmxleFNocmluazogMCxcbiAgICAgIH19XG4gICAgPlxuICAgICAge2xhYmVsfVxuICAgIDwvZGl2PlxuICApO1xufVxuXG4vLyAzRC1zdHlsZWQgY2hhcmFjdGVyIHJvc3RlciDigJQgZWFjaCBpcyBhIGxheWVyZWQgU1ZHIHdpdGggZ3JhZGllbnRzLCBoaWdobGlnaHRzLCBzaGFkb3dcbmNvbnN0IENIQVJBQ1RFUlMgPSBbXG4gIHsgaWQ6ICdjb2NvJywgICBuYW1lOiAnQ29jbycsICAgY29sb3I6ICcjNmQ0YTJlJyB9LFxuICB7IGlkOiAnZW1iZXInLCAgbmFtZTogJ0VtYmVyJywgIGNvbG9yOiAnI2ZmOGEzZCcgfSxcbiAgeyBpZDogJ3ppZ2d5JywgIG5hbWU6ICdaaWdneScsICBjb2xvcjogJyNhODU1YTAnIH0sXG4gIHsgaWQ6ICdib2x0JywgICBuYW1lOiAnQm9sdCcsICAgY29sb3I6ICcjZThiMjNlJyB9LFxuICB7IGlkOiAnbW9jaGknLCAgbmFtZTogJ01vY2hpJywgIGNvbG9yOiAnI2Y2YzZkNCcgfSxcbiAgeyBpZDogJ2x1bmEnLCAgIG5hbWU6ICdMdW5hJywgICBjb2xvcjogJyM1YjZjZmYnIH0sXG4gIHsgaWQ6ICdmZXJuJywgICBuYW1lOiAnRmVybicsICAgY29sb3I6ICcjMmE4YTVmJyB9LFxuICB7IGlkOiAncGlwJywgICAgbmFtZTogJ1BpcCcsICAgIGNvbG9yOiAnI2U4NTgzZScgfSxcbl07XG5cbmZ1bmN0aW9uIENoYXJhY3Rlcih7IGNoYXJJZCwgc2l6ZSA9IDU2LCBzcGluID0gZmFsc2UgfSkge1xuICBjb25zdCBjID0gQ0hBUkFDVEVSUy5maW5kKHggPT4geC5pZCA9PT0gY2hhcklkKSB8fCBDSEFSQUNURVJTWzBdO1xuICBjb25zdCBkYXJrZW4gPSAoaGV4LCBhbXQgPSAwLjI1KSA9PiB7XG4gICAgY29uc3QgbiA9IHBhcnNlSW50KGhleC5zbGljZSgxKSwgMTYpO1xuICAgIGNvbnN0IHIgPSBNYXRoLm1heCgwLCAoKG4gPj4gMTYpICYgMjU1KSAqICgxIC0gYW10KSk7XG4gICAgY29uc3QgZyA9IE1hdGgubWF4KDAsICgobiA+PiA4KSAmIDI1NSkgKiAoMSAtIGFtdCkpO1xuICAgIGNvbnN0IGIgPSBNYXRoLm1heCgwLCAobiAmIDI1NSkgKiAoMSAtIGFtdCkpO1xuICAgIHJldHVybiBgcmdiKCR7cnwwfSwgJHtnfDB9LCAke2J8MH0pYDtcbiAgfTtcbiAgY29uc3QgbGlnaHRlbiA9IChoZXgsIGFtdCA9IDAuMykgPT4ge1xuICAgIGNvbnN0IG4gPSBwYXJzZUludChoZXguc2xpY2UoMSksIDE2KTtcbiAgICBjb25zdCByID0gTWF0aC5taW4oMjU1LCAoKG4gPj4gMTYpICYgMjU1KSArIDI1NSAqIGFtdCk7XG4gICAgY29uc3QgZyA9IE1hdGgubWluKDI1NSwgKChuID4+IDgpICYgMjU1KSArIDI1NSAqIGFtdCk7XG4gICAgY29uc3QgYiA9IE1hdGgubWluKDI1NSwgKG4gJiAyNTUpICsgMjU1ICogYW10KTtcbiAgICByZXR1cm4gYHJnYigke3J8MH0sICR7Z3wwfSwgJHtifDB9KWA7XG4gIH07XG4gIGNvbnN0IGJhc2UgPSBjLmNvbG9yO1xuICBjb25zdCBkYXJrID0gZGFya2VuKGJhc2UsIDAuNCk7XG4gIGNvbnN0IGRhcmtlciA9IGRhcmtlbihiYXNlLCAwLjY1KTtcbiAgY29uc3QgbGlnaHQgPSBsaWdodGVuKGJhc2UsIDAuMzUpO1xuICBjb25zdCBsaWdodGVyID0gbGlnaHRlbihiYXNlLCAwLjcpO1xuICBjb25zdCB1aWQgPSBjLmlkO1xuXG4gIC8vID09PT09PT09IFRydWUgM0Qgc2hhZGluZyBkZWZzID09PT09PT09XG4gIC8vIEV2ZXJ5IGNoYXJhY3RlciB1c2VzOiBib2R5IHNwaGVyZSBncmFkaWVudCAoa2V5IGxpZ2h0IHRvcC1sZWZ0KSwgcmltIGxpZ2h0IChib3R0b20tcmlnaHQpLFxuICAvLyBnbG9zc3kgc3BlY3VsYXIgaGlnaGxpZ2h0LCBzb2Z0IGdyb3VuZCBzaGFkb3cuXG4gIGNvbnN0IGRlZnMgPSAoXG4gICAgPGRlZnM+XG4gICAgICB7LyogTWFpbiBib2R5IHNwaGVyZSDigJQgd2FybSBrZXkgbGlnaHQgZnJvbSB1cHBlci1sZWZ0ICovfVxuICAgICAgPHJhZGlhbEdyYWRpZW50IGlkPXtgYm9keS0ke3VpZH1gfSBjeD1cIjAuMzJcIiBjeT1cIjAuMjVcIiByPVwiMC44NVwiIGZ4PVwiMC4yOFwiIGZ5PVwiMC4yMlwiPlxuICAgICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3BDb2xvcj17bGlnaHRlcn0vPlxuICAgICAgICA8c3RvcCBvZmZzZXQ9XCIyNSVcIiBzdG9wQ29sb3I9e2xpZ2h0fS8+XG4gICAgICAgIDxzdG9wIG9mZnNldD1cIjYwJVwiIHN0b3BDb2xvcj17YmFzZX0vPlxuICAgICAgICA8c3RvcCBvZmZzZXQ9XCI5NSVcIiBzdG9wQ29sb3I9e2Rhcmt9Lz5cbiAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3BDb2xvcj17ZGFya2VyfS8+XG4gICAgICA8L3JhZGlhbEdyYWRpZW50PlxuICAgICAgey8qIFJpbSAvIGJvdW5jZSBsaWdodCBmcm9tIGJvdHRvbS1yaWdodCAqL31cbiAgICAgIDxyYWRpYWxHcmFkaWVudCBpZD17YHJpbS0ke3VpZH1gfSBjeD1cIjAuNzhcIiBjeT1cIjAuODJcIiByPVwiMC40XCI+XG4gICAgICAgIDxzdG9wIG9mZnNldD1cIjAlXCIgc3RvcENvbG9yPXtsaWdodH0gc3RvcE9wYWNpdHk9XCIwLjc1XCIvPlxuICAgICAgICA8c3RvcCBvZmZzZXQ9XCI3MCVcIiBzdG9wQ29sb3I9e2Jhc2V9IHN0b3BPcGFjaXR5PVwiMFwiLz5cbiAgICAgIDwvcmFkaWFsR3JhZGllbnQ+XG4gICAgICB7LyogSGFyZCBnbG9zc3kgc3BlY3VsYXIgZG90ICovfVxuICAgICAgPHJhZGlhbEdyYWRpZW50IGlkPXtgc3BlYy0ke3VpZH1gfSBjeD1cIjAuMzJcIiBjeT1cIjAuMjJcIiByPVwiMC4xOFwiPlxuICAgICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3BDb2xvcj1cIndoaXRlXCIgc3RvcE9wYWNpdHk9XCIwLjk1XCIvPlxuICAgICAgICA8c3RvcCBvZmZzZXQ9XCI2MCVcIiBzdG9wQ29sb3I9XCJ3aGl0ZVwiIHN0b3BPcGFjaXR5PVwiMC4zXCIvPlxuICAgICAgICA8c3RvcCBvZmZzZXQ9XCIxMDAlXCIgc3RvcENvbG9yPVwid2hpdGVcIiBzdG9wT3BhY2l0eT1cIjBcIi8+XG4gICAgICA8L3JhZGlhbEdyYWRpZW50PlxuICAgICAgey8qIEFtYmllbnQgb2NjbHVzaW9uIC8gY29yZSBzaGFkb3cgbmVhciBncm91bmQgKi99XG4gICAgICA8cmFkaWFsR3JhZGllbnQgaWQ9e2Bhby0ke3VpZH1gfSBjeD1cIjAuNVwiIGN5PVwiMC45NVwiIHI9XCIwLjVcIj5cbiAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wQ29sb3I9e2Rhcmtlcn0gc3RvcE9wYWNpdHk9XCIwLjU1XCIvPlxuICAgICAgICA8c3RvcCBvZmZzZXQ9XCI3MCVcIiBzdG9wQ29sb3I9e2Rhcmtlcn0gc3RvcE9wYWNpdHk9XCIwXCIvPlxuICAgICAgPC9yYWRpYWxHcmFkaWVudD5cbiAgICAgIHsvKiBFeWUgc3BoZXJlICovfVxuICAgICAgPHJhZGlhbEdyYWRpZW50IGlkPXtgZXllLSR7dWlkfWB9IGN4PVwiMC4zNVwiIGN5PVwiMC4zXCIgcj1cIjAuOFwiPlxuICAgICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3BDb2xvcj1cIiNmZmZmZmZcIi8+XG4gICAgICAgIDxzdG9wIG9mZnNldD1cIjc1JVwiIHN0b3BDb2xvcj1cIiNkY2RmZTZcIi8+XG4gICAgICAgIDxzdG9wIG9mZnNldD1cIjEwMCVcIiBzdG9wQ29sb3I9XCIjOWZhNGIyXCIvPlxuICAgICAgPC9yYWRpYWxHcmFkaWVudD5cbiAgICAgIHsvKiBQdXBpbCAqL31cbiAgICAgIDxyYWRpYWxHcmFkaWVudCBpZD17YHB1cGlsLSR7dWlkfWB9IGN4PVwiMC40XCIgY3k9XCIwLjM1XCIgcj1cIjAuNlwiPlxuICAgICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3BDb2xvcj1cIiMyYTMxNDRcIi8+XG4gICAgICAgIDxzdG9wIG9mZnNldD1cIjEwMCVcIiBzdG9wQ29sb3I9XCIjMGEwZDE0XCIvPlxuICAgICAgPC9yYWRpYWxHcmFkaWVudD5cbiAgICAgIHsvKiBDaGVlayBibHVzaCAqL31cbiAgICAgIDxyYWRpYWxHcmFkaWVudCBpZD17YGJsdXNoLSR7dWlkfWB9IGN4PVwiMC41XCIgY3k9XCIwLjVcIiByPVwiMC41XCI+XG4gICAgICAgIDxzdG9wIG9mZnNldD1cIjAlXCIgc3RvcENvbG9yPVwiI2ZmN2E4ZVwiIHN0b3BPcGFjaXR5PVwiMC41NVwiLz5cbiAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3BDb2xvcj1cIiNmZjdhOGVcIiBzdG9wT3BhY2l0eT1cIjBcIi8+XG4gICAgICA8L3JhZGlhbEdyYWRpZW50PlxuICAgICAgey8qIFNvZnQgYmx1ciBmb3IgY2FzdCBzaGFkb3cgKi99XG4gICAgICA8ZmlsdGVyIGlkPXtgYmx1ci0ke3VpZH1gfSB4PVwiLTMwJVwiIHk9XCItMzAlXCIgd2lkdGg9XCIxNjAlXCIgaGVpZ2h0PVwiMTYwJVwiPlxuICAgICAgICA8ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPVwiMC42XCIvPlxuICAgICAgPC9maWx0ZXI+XG4gICAgICA8ZmlsdGVyIGlkPXtgc29mdGJsdXItJHt1aWR9YH0+XG4gICAgICAgIDxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249XCIwLjI1XCIvPlxuICAgICAgPC9maWx0ZXI+XG4gICAgPC9kZWZzPlxuICApO1xuXG4gIC8vIDNEIGV5ZTogd2hpdGUgc3BoZXJlIHdpdGggc2hhZGVkIHB1cGlsIGFuZCBjYXRjaC1saWdodFxuICBjb25zdCBleWUzRCA9IChjeCwgY3ksIHIgPSAxLjEpID0+IChcbiAgICA8Zz5cbiAgICAgIDxlbGxpcHNlIGN4PXtjeCArIDAuMDh9IGN5PXtjeSArIDAuMTV9IHJ4PXtyICogMS4wNX0gcnk9e3IgKiAxLjA1fSBmaWxsPVwiIzAwMFwiIG9wYWNpdHk9XCIwLjE1XCIgZmlsdGVyPXtgdXJsKCNzb2Z0Ymx1ci0ke3VpZH0pYH0vPlxuICAgICAgPGNpcmNsZSBjeD17Y3h9IGN5PXtjeX0gcj17cn0gZmlsbD17YHVybCgjZXllLSR7dWlkfSlgfS8+XG4gICAgICA8Y2lyY2xlIGN4PXtjeCArIDAuMX0gY3k9e2N5ICsgMC4xNX0gcj17ciAqIDAuNTV9IGZpbGw9e2B1cmwoI3B1cGlsLSR7dWlkfSlgfS8+XG4gICAgICA8Y2lyY2xlIGN4PXtjeCAtIDAuMTV9IGN5PXtjeSAtIDAuMn0gcj17ciAqIDAuMjV9IGZpbGw9XCJ3aGl0ZVwiIG9wYWNpdHk9XCIwLjk1XCIvPlxuICAgICAgPGNpcmNsZSBjeD17Y3ggKyAwLjN9IGN5PXtjeSArIDAuM30gcj17ciAqIDAuMX0gZmlsbD1cIndoaXRlXCIgb3BhY2l0eT1cIjAuN1wiLz5cbiAgICA8L2c+XG4gICk7XG5cbiAgLy8gTW91dGggd2l0aCBkZXB0aCDigJQgc21hbGwgZGFyayBwaWxsIHdpdGggaGlnaGxpZ2h0IG9uIGxvd2VyIGxpcFxuICBjb25zdCBtb3V0aDNEID0gKGN4LCBjeSwgdyA9IDEuNikgPT4gKFxuICAgIDxnPlxuICAgICAgPHBhdGggZD17YE0gJHtjeCAtIHcvMn0gJHtjeX0gUSAke2N4fSAke2N5ICsgMC44fSAke2N4ICsgdy8yfSAke2N5fWB9IHN0cm9rZT17ZGFya2VyfSBzdHJva2VXaWR0aD1cIjAuMzVcIiBmaWxsPVwiIzNhMWExYVwiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICAgIDxwYXRoIGQ9e2BNICR7Y3ggLSB3LzIgKyAwLjJ9ICR7Y3kgKyAwLjJ9IFEgJHtjeH0gJHtjeSArIDAuNX0gJHtjeCArIHcvMiAtIDAuMn0gJHtjeSArIDAuMn1gfSBzdHJva2U9XCIjZmY5YWE1XCIgc3Ryb2tlV2lkdGg9XCIwLjE1XCIgZmlsbD1cIm5vbmVcIiBvcGFjaXR5PVwiMC42XCIvPlxuICAgIDwvZz5cbiAgKTtcblxuICAvLyBCbHVzaCBjaGVla3NcbiAgY29uc3QgY2hlZWtzID0gKGx5LCBzY2FsZSA9IDEpID0+IChcbiAgICA8Zz5cbiAgICAgIDxlbGxpcHNlIGN4PVwiOFwiIGN5PXtseX0gcng9ezEuMSAqIHNjYWxlfSByeT17MC43ICogc2NhbGV9IGZpbGw9e2B1cmwoI2JsdXNoLSR7dWlkfSlgfS8+XG4gICAgICA8ZWxsaXBzZSBjeD1cIjE2XCIgY3k9e2x5fSByeD17MS4xICogc2NhbGV9IHJ5PXswLjcgKiBzY2FsZX0gZmlsbD17YHVybCgjYmx1c2gtJHt1aWR9KWB9Lz5cbiAgICA8L2c+XG4gICk7XG5cbiAgLy8gU2hhcmVkIHNoYWRlZCBib2R5IChzcGhlcmUgbGF5ZXJzKSDigJQgcmVuZGVycyAzRCBzcGhlcmUgc2hhZGluZyBhdCBnaXZlbiBzaGFwZVxuICBjb25zdCBzcGhlcmVTaGFkZSA9IChzaGFwZUVsKSA9PiAoXG4gICAgPD5cbiAgICAgIHtzaGFwZUVsKHsgZmlsbDogYHVybCgjYm9keS0ke3VpZH0pYCB9KX1cbiAgICAgIHtzaGFwZUVsKHsgZmlsbDogYHVybCgjcmltLSR7dWlkfSlgIH0pfVxuICAgICAge3NoYXBlRWwoeyBmaWxsOiBgdXJsKCNhby0ke3VpZH0pYCB9KX1cbiAgICAgIHtzaGFwZUVsKHsgZmlsbDogYHVybCgjc3BlYy0ke3VpZH0pYCB9KX1cbiAgICA8Lz5cbiAgKTtcblxuICAvLyBDYXN0IHNoYWRvdyBvbiBncm91bmRcbiAgY29uc3QgZ3JvdW5kU2hhZG93ID0gKFxuICAgIDxlbGxpcHNlIGN4PVwiMTJcIiBjeT1cIjIyLjVcIiByeD1cIjYuNVwiIHJ5PVwiMC45XCIgZmlsbD1cIiMwMDBcIiBvcGFjaXR5PVwiMC4yOFwiIGZpbHRlcj17YHVybCgjYmx1ci0ke3VpZH0pYH0vPlxuICApO1xuXG4gIC8vIC0tLS0tLS0tLS0gQm9kaWVzIC0tLS0tLS0tLS1cbiAgY29uc3QgYm9kaWVzID0ge1xuICAgIC8vIEJvbHQg4oCUIGdsb3NzeSAzRCBzdGFyXG4gICAgYm9sdDogKCgpID0+IHtcbiAgICAgIGNvbnN0IHN0YXIgPSAocHJvcHMpID0+IChcbiAgICAgICAgPHBhdGggZD1cIk0gMTIgMi41IEwgMTQuNiA4LjQgTCAyMSA5LjEgTCAxNi4yIDEzLjQgTCAxNy44IDE5LjggTCAxMiAxNi41IEwgNi4yIDE5LjggTCA3LjggMTMuNCBMIDMgOS4xIEwgOS40IDguNCBaXCJcbiAgICAgICAgICBzdHJva2U9e2Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjI1XCIgc3Ryb2tlTGluZWpvaW49XCJyb3VuZFwiIHsuLi5wcm9wc30vPlxuICAgICAgKTtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxnPlxuICAgICAgICAgIHtncm91bmRTaGFkb3d9XG4gICAgICAgICAge3NwaGVyZVNoYWRlKHN0YXIpfVxuICAgICAgICAgIHtleWUzRCg5LjIsIDExLjUsIDAuOSl9XG4gICAgICAgICAge2V5ZTNEKDE0LjgsIDExLjUsIDAuOSl9XG4gICAgICAgICAge21vdXRoM0QoMTIsIDE0LCAxLjQpfVxuICAgICAgICAgIHtjaGVla3MoMTQuNSwgMC45KX1cbiAgICAgICAgPC9nPlxuICAgICAgKTtcbiAgICB9KSgpLFxuXG4gICAgLy8gUGlwIOKAlCAzRCBhcHBsZSB3aXRoIHZvbHVtZXRyaWMgbGVhZiBhbmQgc3RlbVxuICAgIHBpcDogKCgpID0+IHtcbiAgICAgIGNvbnN0IGJvZHkgPSAocHJvcHMpID0+IChcbiAgICAgICAgPHBhdGggZD1cIk0gMTIgNS41IEMgNiA1LjUgMyA5IDMgMTMuNSBDIDMgMTguNSA3IDIxLjUgMTIgMjEuNSBDIDE3IDIxLjUgMjEgMTguNSAyMSAxMy41IEMgMjEgOSAxOCA1LjUgMTIgNS41IFpcIlxuICAgICAgICAgIHN0cm9rZT17ZGFya2VyfSBzdHJva2VXaWR0aD1cIjAuMjVcIiB7Li4ucHJvcHN9Lz5cbiAgICAgICk7XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8Zz5cbiAgICAgICAgICB7Z3JvdW5kU2hhZG93fVxuICAgICAgICAgIHsvKiBzdGVtIHdpdGggc2hhZGluZyAqL31cbiAgICAgICAgICA8cGF0aCBkPVwiTSAxMS41IDUuNSBMIDExLjcgMy4yIEwgMTIuNSAzLjIgTCAxMi4zIDUuNSBaXCIgZmlsbD1cIiMzYTI0MTBcIi8+XG4gICAgICAgICAgPHBhdGggZD1cIk0gMTEuNyAzLjIgTCAxMi4xIDMuMiBMIDExLjkgNS41IEwgMTEuNiA1LjUgWlwiIGZpbGw9XCIjNmQ0YTJlXCIvPlxuICAgICAgICAgIHsvKiBsZWFmIHdpdGggM0Qgc2hhZGluZyAqL31cbiAgICAgICAgICA8ZGVmcz5cbiAgICAgICAgICAgIDxsaW5lYXJHcmFkaWVudCBpZD17YGxlYWYtJHt1aWR9YH0geDE9XCIwXCIgeTE9XCIwXCIgeDI9XCIxXCIgeTI9XCIxXCI+XG4gICAgICAgICAgICAgIDxzdG9wIG9mZnNldD1cIjAlXCIgc3RvcENvbG9yPVwiIzVmYzk4YlwiLz5cbiAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiNTAlXCIgc3RvcENvbG9yPVwiIzJhOGE1ZlwiLz5cbiAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3BDb2xvcj1cIiMxNjRhMzJcIi8+XG4gICAgICAgICAgICA8L2xpbmVhckdyYWRpZW50PlxuICAgICAgICAgIDwvZGVmcz5cbiAgICAgICAgICA8cGF0aCBkPVwiTSAxMi4zIDQuNSBRIDE3IDIgMTggNSBRIDE1IDYuNSAxMi4zIDYgWlwiIGZpbGw9e2B1cmwoI2xlYWYtJHt1aWR9KWB9IHN0cm9rZT1cIiMxNjRhMzJcIiBzdHJva2VXaWR0aD1cIjAuMTVcIi8+XG4gICAgICAgICAgPHBhdGggZD1cIk0gMTMgNC44IFEgMTYgMy41IDE3LjMgNC44XCIgc3Ryb2tlPVwid2hpdGVcIiBzdHJva2VXaWR0aD1cIjAuMTVcIiBmaWxsPVwibm9uZVwiIG9wYWNpdHk9XCIwLjVcIi8+XG4gICAgICAgICAgey8qIGJvZHkgc3BoZXJlcyAqL31cbiAgICAgICAgICB7c3BoZXJlU2hhZGUoYm9keSl9XG4gICAgICAgICAgey8qIHRvcCBkaW1wbGUgKi99XG4gICAgICAgICAgPGVsbGlwc2UgY3g9XCIxMlwiIGN5PVwiNi4zXCIgcng9XCIxXCIgcnk9XCIwLjRcIiBmaWxsPXtkYXJrZXJ9IG9wYWNpdHk9XCIwLjVcIi8+XG4gICAgICAgICAge2V5ZTNEKDkuNSwgMTMsIDEuMSl9XG4gICAgICAgICAge2V5ZTNEKDE0LjUsIDEzLCAxLjEpfVxuICAgICAgICAgIHttb3V0aDNEKDEyLCAxNS41LCAxLjcpfVxuICAgICAgICAgIHtjaGVla3MoMTYsIDEpfVxuICAgICAgICA8L2c+XG4gICAgICApO1xuICAgIH0pKCksXG5cbiAgICAvLyBNb2NoaSDigJQgM0QgYnVubnksIHZvbHVtZXRyaWMgZWFycywgc29mdCBib2R5XG4gICAgbW9jaGk6ICgoKSA9PiB7XG4gICAgICBjb25zdCBib2R5ID0gKHByb3BzKSA9PiAoXG4gICAgICAgIDxlbGxpcHNlIGN4PVwiMTJcIiBjeT1cIjE0LjVcIiByeD1cIjcuNVwiIHJ5PVwiNy4yXCIgc3Ryb2tlPXtkYXJrZXJ9IHN0cm9rZVdpZHRoPVwiMC4yNVwiIHsuLi5wcm9wc30vPlxuICAgICAgKTtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxnPlxuICAgICAgICAgIHtncm91bmRTaGFkb3d9XG4gICAgICAgICAgey8qIGVhciBiYWNrIChkYXJrZXIpICovfVxuICAgICAgICAgIDxlbGxpcHNlIGN4PVwiOC4yXCIgY3k9XCI1XCIgcng9XCIxLjhcIiByeT1cIjMuOFwiIGZpbGw9e2Rhcmt9IHRyYW5zZm9ybT1cInJvdGF0ZSgtMTUgOC4yIDUpXCIvPlxuICAgICAgICAgIDxlbGxpcHNlIGN4PVwiMTUuOFwiIGN5PVwiNVwiIHJ4PVwiMS44XCIgcnk9XCIzLjhcIiBmaWxsPXtkYXJrfSB0cmFuc2Zvcm09XCJyb3RhdGUoMTUgMTUuOCA1KVwiLz5cbiAgICAgICAgICB7LyogZWFyIGZyb250IHNoYWRlZCAqL31cbiAgICAgICAgICA8ZWxsaXBzZSBjeD1cIjguMlwiIGN5PVwiNS4yXCIgcng9XCIxLjNcIiByeT1cIjMuM1wiIGZpbGw9e2B1cmwoI2JvZHktJHt1aWR9KWB9IHRyYW5zZm9ybT1cInJvdGF0ZSgtMTUgOC4yIDUuMilcIi8+XG4gICAgICAgICAgPGVsbGlwc2UgY3g9XCIxNS44XCIgY3k9XCI1LjJcIiByeD1cIjEuM1wiIHJ5PVwiMy4zXCIgZmlsbD17YHVybCgjYm9keS0ke3VpZH0pYH0gdHJhbnNmb3JtPVwicm90YXRlKDE1IDE1LjggNS4yKVwiLz5cbiAgICAgICAgICB7LyogaW5uZXIgZWFyIHBpbmsgKi99XG4gICAgICAgICAgPGVsbGlwc2UgY3g9XCI4LjJcIiBjeT1cIjUuOFwiIHJ4PVwiMC41NVwiIHJ5PVwiMi4yXCIgZmlsbD1cIiNmZjlkYjBcIiB0cmFuc2Zvcm09XCJyb3RhdGUoLTE1IDguMiA1LjgpXCIvPlxuICAgICAgICAgIDxlbGxpcHNlIGN4PVwiMTUuOFwiIGN5PVwiNS44XCIgcng9XCIwLjU1XCIgcnk9XCIyLjJcIiBmaWxsPVwiI2ZmOWRiMFwiIHRyYW5zZm9ybT1cInJvdGF0ZSgxNSAxNS44IDUuOClcIi8+XG4gICAgICAgICAgPGVsbGlwc2UgY3g9XCI4LjJcIiBjeT1cIjUuOFwiIHJ4PVwiMC4zXCIgcnk9XCIxLjVcIiBmaWxsPVwiI2ZmYzJjZVwiIHRyYW5zZm9ybT1cInJvdGF0ZSgtMTUgOC4yIDUuOClcIi8+XG4gICAgICAgICAgPGVsbGlwc2UgY3g9XCIxNS44XCIgY3k9XCI1LjhcIiByeD1cIjAuM1wiIHJ5PVwiMS41XCIgZmlsbD1cIiNmZmMyY2VcIiB0cmFuc2Zvcm09XCJyb3RhdGUoMTUgMTUuOCA1LjgpXCIvPlxuICAgICAgICAgIHtzcGhlcmVTaGFkZShib2R5KX1cbiAgICAgICAgICB7ZXllM0QoOS4zLCAxMy41LCAxLjEpfVxuICAgICAgICAgIHtleWUzRCgxNC43LCAxMy41LCAxLjEpfVxuICAgICAgICAgIHsvKiAzRCBub3NlICovfVxuICAgICAgICAgIDxlbGxpcHNlIGN4PVwiMTJcIiBjeT1cIjE1LjJcIiByeD1cIjAuNTVcIiByeT1cIjAuNFwiIGZpbGw9XCIjZmY3YThlXCIvPlxuICAgICAgICAgIDxlbGxpcHNlIGN4PVwiMTEuOVwiIGN5PVwiMTUuMVwiIHJ4PVwiMC4yXCIgcnk9XCIwLjE1XCIgZmlsbD1cIiNmZmMyY2VcIi8+XG4gICAgICAgICAge21vdXRoM0QoMTIsIDE2LjEsIDEuMil9XG4gICAgICAgICAge2NoZWVrcygxNi4yLCAxKX1cbiAgICAgICAgPC9nPlxuICAgICAgKTtcbiAgICB9KSgpLFxuXG4gICAgLy8gRmVybiDigJQgM0QgZnJvZyB3LyBleWUtZG9tZXNcbiAgICBmZXJuOiAoKCkgPT4ge1xuICAgICAgY29uc3QgYm9keSA9IChwcm9wcykgPT4gKFxuICAgICAgICA8ZWxsaXBzZSBjeD1cIjEyXCIgY3k9XCIxNVwiIHJ4PVwiOC41XCIgcnk9XCI2LjVcIiBzdHJva2U9e2Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjI1XCIgey4uLnByb3BzfS8+XG4gICAgICApO1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGc+XG4gICAgICAgICAge2dyb3VuZFNoYWRvd31cbiAgICAgICAgICB7c3BoZXJlU2hhZGUoYm9keSl9XG4gICAgICAgICAgey8qIGV5ZSBkb21lcyB3aXRoIGdyYWRpZW50IChlbWVyZ2luZyBmcm9tIGhlYWQpICovfVxuICAgICAgICAgIDxnPlxuICAgICAgICAgICAgPGNpcmNsZSBjeD1cIjcuNVwiIGN5PVwiOC41XCIgcj1cIjMuMlwiIGZpbGw9e2Rhcmt9Lz5cbiAgICAgICAgICAgIDxjaXJjbGUgY3g9XCI3LjVcIiBjeT1cIjguM1wiIHI9XCIyLjlcIiBmaWxsPXtgdXJsKCNib2R5LSR7dWlkfSlgfS8+XG4gICAgICAgICAgICA8Y2lyY2xlIGN4PVwiMTYuNVwiIGN5PVwiOC41XCIgcj1cIjMuMlwiIGZpbGw9e2Rhcmt9Lz5cbiAgICAgICAgICAgIDxjaXJjbGUgY3g9XCIxNi41XCIgY3k9XCI4LjNcIiByPVwiMi45XCIgZmlsbD17YHVybCgjYm9keS0ke3VpZH0pYH0vPlxuICAgICAgICAgICAgey8qIGJpZyAzRCBleWViYWxscyAqL31cbiAgICAgICAgICAgIDxjaXJjbGUgY3g9XCI3LjVcIiBjeT1cIjcuOFwiIHI9XCIyXCIgZmlsbD17YHVybCgjZXllLSR7dWlkfSlgfS8+XG4gICAgICAgICAgICA8Y2lyY2xlIGN4PVwiMTYuNVwiIGN5PVwiNy44XCIgcj1cIjJcIiBmaWxsPXtgdXJsKCNleWUtJHt1aWR9KWB9Lz5cbiAgICAgICAgICAgIDxjaXJjbGUgY3g9XCI3LjdcIiBjeT1cIjhcIiByPVwiMS4xXCIgZmlsbD17YHVybCgjcHVwaWwtJHt1aWR9KWB9Lz5cbiAgICAgICAgICAgIDxjaXJjbGUgY3g9XCIxNi43XCIgY3k9XCI4XCIgcj1cIjEuMVwiIGZpbGw9e2B1cmwoI3B1cGlsLSR7dWlkfSlgfS8+XG4gICAgICAgICAgICA8Y2lyY2xlIGN4PVwiNy4zXCIgY3k9XCI3LjVcIiByPVwiMC40NVwiIGZpbGw9XCJ3aGl0ZVwiLz5cbiAgICAgICAgICAgIDxjaXJjbGUgY3g9XCIxNi4zXCIgY3k9XCI3LjVcIiByPVwiMC40NVwiIGZpbGw9XCJ3aGl0ZVwiLz5cbiAgICAgICAgICA8L2c+XG4gICAgICAgICAgey8qIGJlbGx5IGhpZ2hsaWdodCAqL31cbiAgICAgICAgICA8ZWxsaXBzZSBjeD1cIjEyXCIgY3k9XCIxN1wiIHJ4PVwiNFwiIHJ5PVwiMi41XCIgZmlsbD17bGlnaHRlcn0gb3BhY2l0eT1cIjAuMzVcIi8+XG4gICAgICAgICAgPHBhdGggZD1cIk0gOS41IDE2IFEgMTIgMTguOCAxNC41IDE2XCIgc3Ryb2tlPXtkYXJrZXJ9IHN0cm9rZVdpZHRoPVwiMC40XCIgZmlsbD1cIm5vbmVcIiBzdHJva2VMaW5lY2FwPVwicm91bmRcIi8+XG4gICAgICAgICAge2NoZWVrcygxNi4zLCAxKX1cbiAgICAgICAgPC9nPlxuICAgICAgKTtcbiAgICB9KSgpLFxuXG4gICAgLy8gTHVuYSDigJQgM0QgY2F0L21vb24gY3JlYXR1cmVcbiAgICBsdW5hOiAoKCkgPT4ge1xuICAgICAgY29uc3QgYm9keSA9IChwcm9wcykgPT4gKFxuICAgICAgICA8ZWxsaXBzZSBjeD1cIjEyXCIgY3k9XCIxMy41XCIgcng9XCI4XCIgcnk9XCI3LjhcIiBzdHJva2U9e2Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjI1XCIgey4uLnByb3BzfS8+XG4gICAgICApO1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGc+XG4gICAgICAgICAge2dyb3VuZFNoYWRvd31cbiAgICAgICAgICB7LyogZWFycyBiYWNrICovfVxuICAgICAgICAgIDxwYXRoIGQ9XCJNIDYgOCBMIDcuNSAzLjUgTCAxMCA4IFpcIiBmaWxsPXtkYXJrZXJ9Lz5cbiAgICAgICAgICA8cGF0aCBkPVwiTSAxOCA4IEwgMTYuNSAzLjUgTCAxNCA4IFpcIiBmaWxsPXtkYXJrZXJ9Lz5cbiAgICAgICAgICB7LyogZWFycyBmcm9udCAqL31cbiAgICAgICAgICA8cGF0aCBkPVwiTSA2LjMgOCBMIDcuNiA0LjIgTCA5LjcgOCBaXCIgZmlsbD17YHVybCgjYm9keS0ke3VpZH0pYH0vPlxuICAgICAgICAgIDxwYXRoIGQ9XCJNIDE3LjcgOCBMIDE2LjQgNC4yIEwgMTQuMyA4IFpcIiBmaWxsPXtgdXJsKCNib2R5LSR7dWlkfSlgfS8+XG4gICAgICAgICAgey8qIGlubmVyIGVhciAqL31cbiAgICAgICAgICA8cGF0aCBkPVwiTSA3LjEgNy41IEwgNy43IDUuNSBMIDguNiA3LjUgWlwiIGZpbGw9XCIjZmY5ZGIwXCIvPlxuICAgICAgICAgIDxwYXRoIGQ9XCJNIDE2LjkgNy41IEwgMTYuMyA1LjUgTCAxNS40IDcuNSBaXCIgZmlsbD1cIiNmZjlkYjBcIi8+XG4gICAgICAgICAge3NwaGVyZVNoYWRlKGJvZHkpfVxuICAgICAgICAgIHtleWUzRCg5LjUsIDEyLjUsIDEuMil9XG4gICAgICAgICAge2V5ZTNEKDE0LjUsIDEyLjUsIDEuMil9XG4gICAgICAgICAgey8qIG5vc2UgKi99XG4gICAgICAgICAgPHBhdGggZD1cIk0gMTEuNCAxNC4zIEwgMTIuNiAxNC4zIEwgMTIgMTUuMSBaXCIgZmlsbD1cIiNmZjdhOGVcIi8+XG4gICAgICAgICAgPHBhdGggZD1cIk0gMTIgMTUuMSBRIDExIDE2IDEwIDE1LjVcIiBzdHJva2U9e2Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjNcIiBmaWxsPVwibm9uZVwiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICAgICAgICA8cGF0aCBkPVwiTSAxMiAxNS4xIFEgMTMgMTYgMTQgMTUuNVwiIHN0cm9rZT17ZGFya2VyfSBzdHJva2VXaWR0aD1cIjAuM1wiIGZpbGw9XCJub25lXCIgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIvPlxuICAgICAgICAgIHsvKiB3aGlza2VycyAqL31cbiAgICAgICAgICA8bGluZSB4MT1cIjQuNVwiIHkxPVwiMTQuNVwiIHgyPVwiNy41XCIgeTI9XCIxNC41XCIgc3Ryb2tlPXtkYXJrZXJ9IHN0cm9rZVdpZHRoPVwiMC4xNVwiLz5cbiAgICAgICAgICA8bGluZSB4MT1cIjE2LjVcIiB5MT1cIjE0LjVcIiB4Mj1cIjE5LjVcIiB5Mj1cIjE0LjVcIiBzdHJva2U9e2Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjE1XCIvPlxuICAgICAgICAgIDxsaW5lIHgxPVwiNVwiIHkxPVwiMTUuM1wiIHgyPVwiNy41XCIgeTI9XCIxNVwiIHN0cm9rZT17ZGFya2VyfSBzdHJva2VXaWR0aD1cIjAuMTVcIi8+XG4gICAgICAgICAgPGxpbmUgeDE9XCIxNi41XCIgeTE9XCIxNVwiIHgyPVwiMTlcIiB5Mj1cIjE1LjNcIiBzdHJva2U9e2Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjE1XCIvPlxuICAgICAgICAgIHtjaGVla3MoMTUuOCwgMSl9XG4gICAgICAgIDwvZz5cbiAgICAgICk7XG4gICAgfSkoKSxcblxuICAgIC8vIFppZ2d5IOKAlCAzRCBzcGlreSBidXJzdFxuICAgIHppZ2d5OiAoKCkgPT4ge1xuICAgICAgY29uc3Qgc3Bpa2UgPSAocHJvcHMpID0+IChcbiAgICAgICAgPHBhdGggZD1cIk0gMTIgMiBMIDEzLjIgNS41IEwgMTYuNSAzLjUgTCAxNS44IDcgTCAyMCA2IEwgMTcuOCA5LjIgTCAyMS41IDExIEwgMTguNSAxMi41IEwgMjEgMTUuOCBMIDE3IDE1LjUgTCAxNy41IDE5LjUgTCAxNCAxNy41IEwgMTMgMjEuMiBMIDExIDE4LjIgTCA5IDIxLjIgTCA4IDE3LjUgTCA0LjUgMTkuNSBMIDUgMTUuNSBMIDEgMTUuOCBMIDMuNSAxMi41IEwgMC41IDExIEwgNC4yIDkuMiBMIDIgNiBMIDYuMiA3IEwgNS41IDMuNSBMIDguOCA1LjUgWlwiXG4gICAgICAgICAgc3Ryb2tlPXtkYXJrZXJ9IHN0cm9rZVdpZHRoPVwiMC4yNVwiIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIiB7Li4ucHJvcHN9Lz5cbiAgICAgICk7XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8Zz5cbiAgICAgICAgICB7Z3JvdW5kU2hhZG93fVxuICAgICAgICAgIHtzcGhlcmVTaGFkZShzcGlrZSl9XG4gICAgICAgICAge2V5ZTNEKDkuNSwgMTAuNSwgMSl9XG4gICAgICAgICAge2V5ZTNEKDE0LjUsIDEwLjUsIDEpfVxuICAgICAgICAgIHttb3V0aDNEKDEyLCAxMywgMS40KX1cbiAgICAgICAgICB7Y2hlZWtzKDEyLjgsIDAuOSl9XG4gICAgICAgIDwvZz5cbiAgICAgICk7XG4gICAgfSkoKSxcblxuICAgIC8vIEVtYmVyIOKAlCAzRCBmbGFtZSB3aXRoIGlubmVyIGdsb3dcbiAgICBlbWJlcjogKCgpID0+IHtcbiAgICAgIGNvbnN0IGZsYW1lID0gKHByb3BzKSA9PiAoXG4gICAgICAgIDxwYXRoIGQ9XCJNIDEyIDIgUSA4LjUgNy41IDguNSAxMS41IFEgNi41IDEwIDUuNSAxNCBRIDQgMTkuNSAxMiAyMS44IFEgMjAgMTkuNSAxOC41IDE0IFEgMTcuNSAxMCAxNS41IDExLjUgUSAxNS41IDcuNSAxMiAyIFpcIlxuICAgICAgICAgIHN0cm9rZT17ZGFya2VyfSBzdHJva2VXaWR0aD1cIjAuMjVcIiB7Li4ucHJvcHN9Lz5cbiAgICAgICk7XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8Zz5cbiAgICAgICAgICB7Z3JvdW5kU2hhZG93fVxuICAgICAgICAgIHtzcGhlcmVTaGFkZShmbGFtZSl9XG4gICAgICAgICAgey8qIGlubmVyIGZsYW1lICovfVxuICAgICAgICAgIDxkZWZzPlxuICAgICAgICAgICAgPHJhZGlhbEdyYWRpZW50IGlkPXtgaW5uZXItJHt1aWR9YH0gY3g9XCIwLjVcIiBjeT1cIjAuNlwiIHI9XCIwLjVcIj5cbiAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wQ29sb3I9XCIjZmZmNGMyXCIgc3RvcE9wYWNpdHk9XCIwLjk1XCIvPlxuICAgICAgICAgICAgICA8c3RvcCBvZmZzZXQ9XCI1MCVcIiBzdG9wQ29sb3I9XCIjZmZkMTZhXCIgc3RvcE9wYWNpdHk9XCIwLjU1XCIvPlxuICAgICAgICAgICAgICA8c3RvcCBvZmZzZXQ9XCIxMDAlXCIgc3RvcENvbG9yPVwiI2ZmZDE2YVwiIHN0b3BPcGFjaXR5PVwiMFwiLz5cbiAgICAgICAgICAgIDwvcmFkaWFsR3JhZGllbnQ+XG4gICAgICAgICAgPC9kZWZzPlxuICAgICAgICAgIDxwYXRoIGQ9XCJNIDEyIDYgUSAxMC41IDkgMTAuNSAxMiBRIDkuNSAxMyA5LjUgMTUgUSAxMCAxNyAxMiAxOCBRIDE0IDE3IDE0LjUgMTUgUSAxNC41IDEzIDEzLjUgMTIgUSAxMy41IDkgMTIgNiBaXCIgZmlsbD17YHVybCgjaW5uZXItJHt1aWR9KWB9Lz5cbiAgICAgICAgICB7ZXllM0QoOS41LCAxNC41LCAwLjk1KX1cbiAgICAgICAgICB7ZXllM0QoMTQuNSwgMTQuNSwgMC45NSl9XG4gICAgICAgICAge21vdXRoM0QoMTIsIDE2LjgsIDEuMyl9XG4gICAgICAgICAge2NoZWVrcygxNywgMC44NSl9XG4gICAgICAgIDwvZz5cbiAgICAgICk7XG4gICAgfSkoKSxcblxuICAgIC8vIENvY28g4oCUIDNEIGJlYXIgd2l0aCBlYXIgbG9iZXMgYW5kIHNub3V0XG4gICAgY29jbzogKCgpID0+IHtcbiAgICAgIGNvbnN0IGJvZHkgPSAocHJvcHMpID0+IChcbiAgICAgICAgPGNpcmNsZSBjeD1cIjEyXCIgY3k9XCIxMy41XCIgcj1cIjhcIiBzdHJva2U9e2Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjI1XCIgey4uLnByb3BzfS8+XG4gICAgICApO1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGc+XG4gICAgICAgICAge2dyb3VuZFNoYWRvd31cbiAgICAgICAgICB7LyogZWFycyB3aXRoIGRlcHRoICovfVxuICAgICAgICAgIDxjaXJjbGUgY3g9XCI2LjVcIiBjeT1cIjdcIiByPVwiMi40XCIgZmlsbD17ZGFya2VyfS8+XG4gICAgICAgICAgPGNpcmNsZSBjeD1cIjE3LjVcIiBjeT1cIjdcIiByPVwiMi40XCIgZmlsbD17ZGFya2VyfS8+XG4gICAgICAgICAgPGNpcmNsZSBjeD1cIjYuN1wiIGN5PVwiNi44XCIgcj1cIjJcIiBmaWxsPXtgdXJsKCNib2R5LSR7dWlkfSlgfS8+XG4gICAgICAgICAgPGNpcmNsZSBjeD1cIjE3LjNcIiBjeT1cIjYuOFwiIHI9XCIyXCIgZmlsbD17YHVybCgjYm9keS0ke3VpZH0pYH0vPlxuICAgICAgICAgIDxjaXJjbGUgY3g9XCI2LjdcIiBjeT1cIjYuOFwiIHI9XCIxLjJcIiBmaWxsPXtkYXJrfS8+XG4gICAgICAgICAgPGNpcmNsZSBjeD1cIjE3LjNcIiBjeT1cIjYuOFwiIHI9XCIxLjJcIiBmaWxsPXtkYXJrfS8+XG4gICAgICAgICAgPGNpcmNsZSBjeD1cIjYuOVwiIGN5PVwiNi42XCIgcj1cIjAuOVwiIGZpbGw9e2xpZ2h0ZW4oYmFzZSwgMC4xNSl9Lz5cbiAgICAgICAgICA8Y2lyY2xlIGN4PVwiMTcuMVwiIGN5PVwiNi42XCIgcj1cIjAuOVwiIGZpbGw9e2xpZ2h0ZW4oYmFzZSwgMC4xNSl9Lz5cbiAgICAgICAgICB7c3BoZXJlU2hhZGUoYm9keSl9XG4gICAgICAgICAgey8qIG11enpsZSAvIHNub3V0IHdpdGggc2hhZGluZyAqL31cbiAgICAgICAgICA8ZWxsaXBzZSBjeD1cIjEyXCIgY3k9XCIxNS44XCIgcng9XCIzLjVcIiByeT1cIjIuNlwiIGZpbGw9e2xpZ2h0ZXJ9IG9wYWNpdHk9XCIwLjhcIi8+XG4gICAgICAgICAgPGVsbGlwc2UgY3g9XCIxMlwiIGN5PVwiMTUuOFwiIHJ4PVwiMy41XCIgcnk9XCIyLjZcIiBmaWxsPXtgdXJsKCNhby0ke3VpZH0pYH0vPlxuICAgICAgICAgIDxlbGxpcHNlIGN4PVwiMTJcIiBjeT1cIjE0LjVcIiByeD1cIjAuN1wiIHJ5PVwiMC41XCIgZmlsbD1cIiMxYTFmMmVcIi8+XG4gICAgICAgICAgPGVsbGlwc2UgY3g9XCIxMS45XCIgY3k9XCIxNC40XCIgcng9XCIwLjJcIiByeT1cIjAuMTVcIiBmaWxsPVwid2hpdGVcIiBvcGFjaXR5PVwiMC42XCIvPlxuICAgICAgICAgIDxwYXRoIGQ9XCJNIDEyIDE1IEwgMTIgMTZcIiBzdHJva2U9e2Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjI1XCIvPlxuICAgICAgICAgIDxwYXRoIGQ9XCJNIDEyIDE2IFEgMTEgMTYuOCAxMC4yIDE2LjRcIiBzdHJva2U9e2Rhcmtlcn0gc3Ryb2tlV2lkdGg9XCIwLjM1XCIgZmlsbD1cIm5vbmVcIiBzdHJva2VMaW5lY2FwPVwicm91bmRcIi8+XG4gICAgICAgICAgPHBhdGggZD1cIk0gMTIgMTYgUSAxMyAxNi44IDEzLjggMTYuNFwiIHN0cm9rZT17ZGFya2VyfSBzdHJva2VXaWR0aD1cIjAuMzVcIiBmaWxsPVwibm9uZVwiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICAgICAgICB7ZXllM0QoOS4yLCAxMi44LCAxLjEpfVxuICAgICAgICAgIHtleWUzRCgxNC44LCAxMi44LCAxLjEpfVxuICAgICAgICAgIHtjaGVla3MoMTYuMywgMC45KX1cbiAgICAgICAgPC9nPlxuICAgICAgKTtcbiAgICB9KSgpLFxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBzdHlsZT17e1xuICAgICAgd2lkdGg6IHNpemUsIGhlaWdodDogc2l6ZSxcbiAgICAgIGRpc3BsYXk6ICdpbmxpbmUtYmxvY2snLFxuICAgICAgcG9zaXRpb246ICdyZWxhdGl2ZScsXG4gICAgfX0+XG4gICAgICA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiB3aWR0aD17c2l6ZX0gaGVpZ2h0PXtzaXplfSBzdHlsZT17e1xuICAgICAgICBmaWx0ZXI6ICdkcm9wLXNoYWRvdygwIDRweCA1cHggcmdiYSgwLDAsMCwwLjMpKSBkcm9wLXNoYWRvdygwIDFweCAwIHJnYmEoMjU1LDI1NSwyNTUsMC4yKSknLFxuICAgICAgICBhbmltYXRpb246IHNwaW4gPyAnY2hhci1ib2IgMi4ycyBlYXNlLWluLW91dCBpbmZpbml0ZScgOiB1bmRlZmluZWQsXG4gICAgICAgIGRpc3BsYXk6ICdibG9jaycsXG4gICAgICAgIG92ZXJmbG93OiAndmlzaWJsZScsXG4gICAgICB9fT5cbiAgICAgICAge2RlZnN9XG4gICAgICAgIHtib2RpZXNbYy5pZF19XG4gICAgICA8L3N2Zz5cbiAgICAgIDxzdHlsZT57YEBrZXlmcmFtZXMgY2hhci1ib2IgeyAwJSwxMDAle3RyYW5zZm9ybTp0cmFuc2xhdGVZKDApIHJvdGF0ZSgtMmRlZyk7fSA1MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTRweCkgcm90YXRlKDJkZWcpO30gfWB9PC9zdHlsZT5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxud2luZG93LkNIQVJBQ1RFUlMgPSBDSEFSQUNURVJTO1xud2luZG93LkNoYXJhY3RlciA9IENoYXJhY3RlcjtcbndpbmRvdy5Sb2JvdCA9IFJvYm90O1xud2luZG93LkF2YXRhciA9IEF2YXRhcjtcblxuXG4vLyA9PT0gZGljZS5qc3ggPT09XG4vLyBEaWNlIGNvbXBvbmVudFxuXG5mdW5jdGlvbiBEaWNlKHsgdmFsdWUsIHJvbGxpbmcsIG9uQ2xpY2ssIGRpc2FibGVkIH0pIHtcbiAgLy8gUGlwIGxheW91dHMgZm9yIGVhY2ggZmFjZSAodXNpbmcgQ1NTIGdyaWQgM3gzLCAxLWluZGV4ZWQgY29vcmRzKVxuICBjb25zdCBmYWNlcyA9IHtcbiAgICAxOiBbWzIsMl1dLFxuICAgIDI6IFtbMSwxXSxbMywzXV0sXG4gICAgMzogW1sxLDFdLFsyLDJdLFszLDNdXSxcbiAgICA0OiBbWzEsMV0sWzEsM10sWzMsMV0sWzMsM11dLFxuICAgIDU6IFtbMSwxXSxbMSwzXSxbMiwyXSxbMywxXSxbMywzXV0sXG4gICAgNjogW1sxLDFdLFsxLDNdLFsyLDFdLFsyLDNdLFszLDFdLFszLDNdXSxcbiAgfTtcblxuICAvLyBGb3IgYSBzdGFuZGFyZCBkaWU6IG9wcG9zaXRlIGZhY2VzIHN1bSB0byA3LlxuICAvLyBGYWNlIHBsYWNlbWVudHMgb24gdGhlIGN1YmUgKHZpYSB0cmFuc2xhdGVaIGFmdGVyIGEgcHJlLXJvdGF0aW9uKTpcbiAgLy8gICAxIOKGkiArWiwgIDYg4oaSIC1aLCAgMiDihpIgK1gsICA1IOKGkiAtWCwgIDMg4oaSIC1ZLCAgNCDihpIgK1lcbiAgLy8gSW5uZXIgcm90YXRpb24gYnJpbmdzIHRoZSByb2xsZWQgZmFjZSB0byArWiAoZnJvbnQsIGZhY2luZyBjYW1lcmEpLiBDb21iaW5lZCB3aXRoIHRoZVxuICAvLyBzdGF0aWMgMy80LXZpZXcgb3V0ZXIgdGlsdCwgdGhlIHJvbGxlZCB2YWx1ZSBsYW5kcyBvbiB0aGUgZG9taW5hbnQgdmlzaWJsZSBmYWNlIG9mIHRoZVxuICAvLyBjdWJlIOKAlCBleGFjdGx5IGxpa2UgZXZlcnkgZGljZSByZW5kZXIgb24gdGhlIHdlYi5cbiAgY29uc3QgZmFjZVJvdGF0aW9ucyA9IHtcbiAgICAxOiB7IHg6IDAsICAgeTogMCAgIH0sICAvLyBhbHJlYWR5IGF0ICtaXG4gICAgNjogeyB4OiAwLCAgIHk6IDE4MCB9LCAgLy8gLVog4oaSICtaICB2aWEgcm90WSgxODApXG4gICAgMjogeyB4OiAwLCAgIHk6IC05MCB9LCAgLy8gK1gg4oaSICtaICB2aWEgcm90WSgtOTApXG4gICAgNTogeyB4OiAwLCAgIHk6IDkwICB9LCAgLy8gLVgg4oaSICtaICB2aWEgcm90WSg5MClcbiAgICAzOiB7IHg6IC05MCwgeTogMCAgIH0sICAvLyAtWSDihpIgK1ogIHZpYSByb3RYKC05MClcbiAgICA0OiB7IHg6IDkwLCAgeTogMCAgIH0sICAvLyArWSDihpIgK1ogIHZpYSByb3RYKDkwKVxuICB9O1xuXG4gIC8vIER1cmluZyByb2xsOiBhY2N1bXVsYXRlIHJhbmRvbSBmdWxsIHJvdGF0aW9ucyBmb3IgY2hhb3M7IHNldHRsZSBvbiB0aGUgY29ycmVjdCB0YXJnZXQgZm9yIGB2YWx1ZWAuXG4gIGNvbnN0IFtyb2xsVGljaywgc2V0Um9sbFRpY2tdID0gUmVhY3QudXNlU3RhdGUoMCk7XG4gIC8vIEluaXRpYWwgcG9zZSA9IGZhY2UtMSB0YXJnZXQgKDAsMCkuIFRoZSBzdGF0aWMgdmlldyB0aWx0IGluIHRoZSB0cmFuc2Zvcm0gc3RyaW5nXG4gIC8vIGd1YXJhbnRlZXMgdGhlIGZpcnN0IHJlbmRlciBpcyBhbHJlYWR5IGEgY2h1bmt5IDNEIGN1YmUgc2hvd2luZyBmYWNlIDEgKyB0b3AgKyBsZWZ0LlxuICAvLyB6OiB0dW1ibGUgcm90YXRpb24gb24gY3ViZSdzIG93biBaIGF4aXM7IHNxdWFzaDogbGFuZGluZyBjb21wcmVzc2lvbiAoMT1uZXV0cmFsLCA8MT1zcXVhc2hlZClcbiAgY29uc3QgW2N1cnJlbnRSb3QsIHNldEN1cnJlbnRSb3RdID0gUmVhY3QudXNlU3RhdGUoeyB4OiAwLCB5OiAwLCB6OiAwLCB0eDogMCwgdHk6IDAsIGJvdW5jZTogMCwgc3F1YXNoOiAxIH0pO1xuICBjb25zdCB3YXNSb2xsaW5nID0gUmVhY3QudXNlUmVmKGZhbHNlKTtcblxuICAvLyBUaGUgY3ViZSdzIGlubmVyIHJvdGF0aW9uIGJyaW5ncyB0aGUgcm9sbGVkIGZhY2UgdG8gK1ogKGZyb250KS4gQSBzdGF0aWMgdmlldyB0aWx0XG4gIC8vIChyb3RhdGVYIC00NcKwLCByb3RhdGVZICsyNcKwKSBhcHBsaWVkIG9uIHRvcCBpbiB0aGUgdHJhbnNmb3JtIHN0cmluZyBnaXZlcyBldmVyeSByb2xsZWRcbiAgLy8gZmFjZSB0aGUgc2FtZSBjaHVua3kgM0QgYW5nbGUg4oCUIHJvbGxlZCBmYWNlIGRvbWluYW50LCB0b3AgYW5kIGxlZnQgbmVpZ2hib3JzIHZpc2libGUuXG4gIC8vIEVtcGlyaWNhbGx5IHR1bmVkIHRvIG1hdGNoIHRoZSBpY29uaWMgXCJyb2xsZWQgZGljZVwiIFJvbGxpbmcgdmlzdWFsLlxuICBjb25zdCBpZGxlUG9zZUZvciA9ICh2KSA9PiBmYWNlUm90YXRpb25zW3ZdIHx8IGZhY2VSb3RhdGlvbnNbMV07XG5cbiAgLy8gVmFsdWUgaXMgcmVhZCB2aWEgYSByZWYgc28gdGhlIHR1bWJsZSBlZmZlY3QgZG9lc24ndCByZXN0YXJ0IHdoZW4gdGhlIHBhcmVudCByYXBpZGx5XG4gIC8vIGN5Y2xlcyBgdmFsdWVgIGR1cmluZyB0aGUgc2h1ZmZsZS4gT25seSBgcm9sbGluZ2AgdHJhbnNpdGlvbnMgZHJpdmUgdGhlIGFuaW1hdGlvbiBwaGFzZXMuXG4gIGNvbnN0IHZhbHVlUmVmID0gUmVhY3QudXNlUmVmKHZhbHVlKTtcbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHsgdmFsdWVSZWYuY3VycmVudCA9IHZhbHVlOyB9LCBbdmFsdWVdKTtcblxuICAvLyBNaXJyb3Igb2YgdGhlIGByb2xsaW5nYCBwcm9wLiBSZWFkIGluc2lkZSB0aGUgcGh5c2ljcyBsb29wIHNvIHRoZSBzcHJpbmctaG9tZSBvbmx5XG4gIC8vIGZpcmVzIGFmdGVyIHRoZSBpbm5lciBjdWJlIGhhcyBiZWd1biBzZXR0bGluZyB0byB0aGUgcm9sbGVkIGZhY2Ug4oCUIHdpdGhvdXQgdGhpc1xuICAvLyB0aGUgb3V0ZXIgZGljZSBjYW4gcmV0dXJuIGhvbWUgd2hpbGUgdGhlIGlubmVyIGlzIHN0aWxsIHR1bWJsaW5nLCB3aGljaCBsb29rcyBqdW1weS5cbiAgY29uc3Qgcm9sbGluZ1JlZiA9IFJlYWN0LnVzZVJlZihyb2xsaW5nKTtcbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHsgcm9sbGluZ1JlZi5jdXJyZW50ID0gcm9sbGluZzsgfSwgW3JvbGxpbmddKTtcblxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGxldCByYWY7XG4gICAgaWYgKHJvbGxpbmcpIHtcbiAgICAgIHdhc1JvbGxpbmcuY3VycmVudCA9IHRydWU7XG4gICAgICAvLyAzRCB0dW1ibGU6IHJvdGF0ZSBYIGFuZCBZIHdpdGggZXhwb25lbnRpYWwgZGVjYXkuIEFsd2F5cyBwcmVzZXJ2ZXMgdGhlIDNEIGN1YmUuXG4gICAgICBjb25zdCBzdGFydCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgY29uc3Qgc3RhcnRSb3QgPSBjdXJyZW50Um90O1xuICAgICAgY29uc3QgdngwID0gNzgwICsgTWF0aC5yYW5kb20oKSAqIDE2MDtcbiAgICAgIGNvbnN0IHZ5MCA9IDkyMCArIE1hdGgucmFuZG9tKCkgKiAxODA7XG4gICAgICBjb25zdCB0YXUgPSAwLjc1O1xuICAgICAgbGV0IGxhc3RUID0gc3RhcnQ7XG4gICAgICBsZXQgYWNjWCA9IDAsIGFjY1kgPSAwO1xuICAgICAgY29uc3QgdGljayA9IChub3cpID0+IHtcbiAgICAgICAgY29uc3QgZHQgPSBNYXRoLm1pbigwLjA0LCAobm93IC0gbGFzdFQpIC8gMTAwMCk7XG4gICAgICAgIGxhc3RUID0gbm93O1xuICAgICAgICBjb25zdCB0ID0gKG5vdyAtIHN0YXJ0KSAvIDEwMDA7XG4gICAgICAgIGNvbnN0IGRlY2F5ID0gTWF0aC5leHAoLXQgLyB0YXUpO1xuICAgICAgICBhY2NYICs9IHZ4MCAqIGRlY2F5ICogZHQ7XG4gICAgICAgIGFjY1kgKz0gdnkwICogZGVjYXkgKiBkdDtcbiAgICAgICAgY29uc3QgeCA9IHN0YXJ0Um90LnggKyBhY2NYICsgTWF0aC5zaW4odCAqIDExKSAqIDQ7XG4gICAgICAgIGNvbnN0IHkgPSBzdGFydFJvdC55ICsgYWNjWSArIE1hdGguY29zKHQgKiA4KSAqIDU7XG4gICAgICAgIGNvbnN0IGJvdW5jZSA9IE1hdGgubWF4KDAsICgxIC0gTWF0aC5taW4oMSwgdCAvIDEuMCkpKSAqIDEyO1xuICAgICAgICBjb25zdCB0eCA9IE1hdGguc2luKHQgKiAxNCkgKiAyLjI7XG4gICAgICAgIGNvbnN0IHR5ID0gTWF0aC5jb3ModCAqIDExKSAqIDEuODtcbiAgICAgICAgc2V0Q3VycmVudFJvdCh7IHgsIHksIHo6IDAsIHR4LCB0eSwgYm91bmNlLCBzcXVhc2g6IDEgfSk7XG4gICAgICAgIHJhZiA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgICAgIH07XG4gICAgICByYWYgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgfSBlbHNlIGlmICh3YXNSb2xsaW5nLmN1cnJlbnQpIHtcbiAgICAgIC8vIENsZWFuIGxhbmRpbmcgYXQgdGhlIGZhY2UtdXAgcG9zZSBzbyB0aGUgcm9sbGVkIGZhY2UgZW5kcyBvbiArWSAodG9wIG9mIGN1YmUpLlxuICAgICAgd2FzUm9sbGluZy5jdXJyZW50ID0gZmFsc2U7XG4gICAgICBjb25zdCBpZGxlID0gaWRsZVBvc2VGb3IodmFsdWVSZWYuY3VycmVudCk7XG4gICAgICBjb25zdCBmcm9tID0gY3VycmVudFJvdDtcbiAgICAgIC8vIFBpY2sgbmVhcmVzdCBtdWx0aXBsZXMgb2YgMzYwIHNvIHRoZSBzZXR0bGUgZW5kcyBFWEFDVExZIGF0IHRoZSBmYWNlLXJvdGF0aW9uIGZvciBgdmFsdWVgLFxuICAgICAgLy8gZ3VhcmFudGVlaW5nIHRoZSBmYWNlIGRpc3BsYXllZCBtYXRjaGVzIHRoZSByb2xsZWQgbnVtYmVyLiBObyBleHRyYSBheGVzIHRvIGNvbmZ1c2UgYWxpZ25tZW50LlxuICAgICAgY29uc3QgZmluYWxYID0gTWF0aC5yb3VuZCgoZnJvbS54IC0gaWRsZS54KSAvIDM2MCkgKiAzNjAgKyBpZGxlLnggKyAzNjA7XG4gICAgICBjb25zdCBmaW5hbFkgPSBNYXRoLnJvdW5kKChmcm9tLnkgLSBpZGxlLnkpIC8gMzYwKSAqIDM2MCArIGlkbGUueSArIDM2MDtcbiAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgY29uc3QgZHVyID0gOTAwO1xuICAgICAgY29uc3QgdGljayA9IChub3cpID0+IHtcbiAgICAgICAgY29uc3QgcCA9IE1hdGgubWluKDEsIChub3cgLSBzdGFydFRpbWUpIC8gZHVyKTtcbiAgICAgICAgY29uc3QgZSA9IDEgLSBNYXRoLnBvdygxIC0gcCwgNSk7IC8vIGVhc2VPdXRRdWludFxuICAgICAgICBjb25zdCB3b2JibGUgPSBwID4gMC43NSA/IE1hdGguc2luKChwIC0gMC43NSkgLyAwLjI1ICogTWF0aC5QSSAqIDIpICogNiAqICgxIC0gcCkgOiAwO1xuICAgICAgICBjb25zdCB0YWJsZUJvdW5jZSA9IHAgPiAwLjZcbiAgICAgICAgICA/IE1hdGguYWJzKE1hdGguc2luKChwIC0gMC42KSAvIDAuNCAqIE1hdGguUEkgKiAxLjUpKSAqIDcgKiAoMSAtIHApICogKDEgLSBwKVxuICAgICAgICAgIDogMDtcbiAgICAgICAgc2V0Q3VycmVudFJvdCh7XG4gICAgICAgICAgeDogZnJvbS54ICsgKGZpbmFsWCAtIGZyb20ueCkgKiBlICsgd29iYmxlICogMC41LFxuICAgICAgICAgIHk6IGZyb20ueSArIChmaW5hbFkgLSBmcm9tLnkpICogZSArIHdvYmJsZSxcbiAgICAgICAgICB6OiAwLFxuICAgICAgICAgIHR4OiBmcm9tLnR4ICogKDEgLSBlKSxcbiAgICAgICAgICB0eTogZnJvbS50eSAqICgxIC0gZSkgLSB0YWJsZUJvdW5jZSxcbiAgICAgICAgICBib3VuY2U6IHRhYmxlQm91bmNlLFxuICAgICAgICAgIHNxdWFzaDogMSxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChwIDwgMSkgcmFmID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgICAgfTtcbiAgICAgIHJhZiA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSW5pdGlhbCByZW5kZXIgKG9yIGlkbGUgcmVmcmVzaCk6IHNuYXAgdG8gdGhlIHRhcmdldCBmYWNlIHJvdGF0aW9uLlxuICAgICAgY29uc3QgaWRsZSA9IGlkbGVQb3NlRm9yKHZhbHVlUmVmLmN1cnJlbnQpO1xuICAgICAgc2V0Q3VycmVudFJvdCh7IHg6IGlkbGUueCwgeTogaWRsZS55LCB6OiAwLCB0eDogMCwgdHk6IDAsIGJvdW5jZTogMCwgc3F1YXNoOiAxIH0pO1xuICAgIH1cbiAgICByZXR1cm4gKCkgPT4gcmFmICYmIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHJhZik7XG4gIH0sIFtyb2xsaW5nXSk7XG5cbiAgLy8gTm90ZTogd2UgaW50ZW50aW9uYWxseSBkbyBOT1Qgc25hcCBvbiB2YWx1ZSBjaGFuZ2VzLiBUaGUgW3JvbGxpbmddLWtleWVkIGVmZmVjdCBoYW5kbGVzXG4gIC8vIGFsbCB0aHJlZSBsaWZlY3ljbGUgY2FzZXMgKGluaXRpYWwgbW91bnQsIHR1bWJsZSBzdGFydCwgc2V0dGxlLXRvLWZhY2UpLiBBZGRpbmcgYSB2YWx1ZS1rZXllZFxuICAvLyBzbmFwIGhlcmUgd291bGQgcmFjZSB3aXRoIHRoZSBzZXR0bGUgYW5pbWF0aW9uIGFuZCBjbG9iYmVyIGl0cyBjYXB0dXJlZCBgZnJvbWAgc3RhdGUsXG4gIC8vIGNhdXNpbmcgYSB2aXNpYmxlIGp1bXAgYXQgaGFuZG92ZXIuXG5cbiAgY29uc3QgUGlwID0gKHsgciwgYyB9KSA9PiAoXG4gICAgPHNwYW4gY2xhc3NOYW1lPVwiZDMtcGlwXCIgc3R5bGU9e3sgZ3JpZFJvdzogciwgZ3JpZENvbHVtbjogYyB9fS8+XG4gICk7XG5cbiAgLy8gRmFjZSBwYWlycyBhcmUgdGludGVkIHNvIG9wcG9zaXRlIGZhY2VzICh3aGljaCBhcmUgbmV2ZXIgYm90aCB2aXNpYmxlKSBzaGFyZSBhIHNoYWRlLFxuICAvLyBidXQgZWFjaCBvZiB0aGUgdGhyZWUgdmlzaWJsZS1hdC1vbmNlIGZhY2VzIGhhcyBhIGRpc3RpbmN0IGJhc2VsaW5lIGJyaWdodG5lc3MuIFRoaXMgaXNcbiAgLy8gd2hhdCBzZWxscyB0aGUgM0QgaWxsdXNpb246IHRocmVlIGRpZmZlcmVudGx5LXNoYWRlZCBwbGFuZXMgcmVhZCBhcyBhIHJlYWwgY3ViZSwgZXZlblxuICAvLyB3aGVuIGdlbnRsZSB0aWx0cyArIGdlbnRsZSBwZXJzcGVjdGl2ZSB3b3VsZCBvdGhlcndpc2UgZmxhdHRlbiBpbnRvIGEgcm91bmRlZCByaG9tYnVzLlxuICAvLyAgIHBhaXIgezEsNn06IG1lZGl1bSAoaGVybyBmYWNlKVxuICAvLyAgIHBhaXIgezIsNX06IGRhcmtlciAobGVmdC9yaWdodCBzaGFkZSlcbiAgLy8gICBwYWlyIHszLDR9OiBicmlnaHRlciAodG9wL2JvdHRvbSDigJQgY2F0Y2hlcyB0aGUgbW9zdCAnbGlnaHQnKVxuICBjb25zdCBmYWNlU2hhZGUgPSB7XG4gICAgMTogJ21lZGl1bScsIDY6ICdtZWRpdW0nLFxuICAgIDI6ICdkYXJrZXInLCA1OiAnZGFya2VyJyxcbiAgICAzOiAnYnJpZ2h0ZXInLCA0OiAnYnJpZ2h0ZXInLFxuICB9O1xuXG4gIGNvbnN0IEZhY2UgPSAoeyBmYWNlVmFsLCB0cmFuc2Zvcm0gfSkgPT4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPXtgZDMtZmFjZSBzaGFkZS0ke2ZhY2VTaGFkZVtmYWNlVmFsXX1gfSBzdHlsZT17eyB0cmFuc2Zvcm0gfX0+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImQzLXBpcHNcIj5cbiAgICAgICAge2ZhY2VzW2ZhY2VWYWxdLm1hcCgoW3IsIGNdLCBpKSA9PiA8UGlwIGtleT17aX0gcj17cn0gYz17Y30vPil9XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcblxuICAvLyA9PT09IFRocm93IGdlc3R1cmUgKyBwaHlzaWNzIHNpbXVsYXRpb24gPT09PVxuICAvLyBUaGUgZGljZSBiZWhhdmVzIGxpa2UgYSByZWFsIGRpZSByb2xsaW5nIG9uIGEgdGFibGU6IGl0IGhhcyB2ZWxvY2l0eSwgZGVjZWxlcmF0ZXMgdmlhXG4gIC8vIGZyaWN0aW9uLCBib3VuY2VzIG9mZiB0aGUgd2luZG93IGVkZ2VzICh3YWxscyksIGV2ZW50dWFsbHkgcmVzdHMgb24gYSBmYWNlLCBzdGF5cyB2aXNpYmxlXG4gIC8vIGZvciB+MnMgc28gdGhlIHVzZXIgY2FuIHJlYWQgdGhlIHJlc3VsdCwgdGhlbiByZXR1cm5zIHRvIGl0cyBob21lIHNwb3QuXG4gIGNvbnN0IFtkcmFnLCBzZXREcmFnXSA9IFJlYWN0LnVzZVN0YXRlKHsgYWN0aXZlOiBmYWxzZSwgZHg6IDAsIGR5OiAwIH0pO1xuICAvLyBwaHlzIG1vZGU6ICdpZGxlJyB8ICdmbHlpbmcnIHwgJ3Jlc3RpbmcnIHwgJ3JldHVybmluZydcbiAgLy8gaGVpZ2h0OiBzaW11bGF0ZWQgWi1saWZ0IGluIHB4IChkaWUgYWlyYm9ybmUpOyBkZXJpdmVkIGZyb20gY3VycmVudCBzcGVlZCBkdXJpbmcgZmxpZ2h0XG4gIGNvbnN0IFtwaHlzLCBzZXRQaHlzXSA9IFJlYWN0LnVzZVN0YXRlKHsgbW9kZTogJ2lkbGUnLCB4OiAwLCB5OiAwLCByb3RaOiAwLCBoZWlnaHQ6IDAgfSk7XG4gIGNvbnN0IHN0YXJ0UmVmID0gUmVhY3QudXNlUmVmKHsgeDogMCwgeTogMCB9KTtcbiAgY29uc3QgbGFzdE1vdmVSZWYgPSBSZWFjdC51c2VSZWYoeyB4OiAwLCB5OiAwLCB0OiAwIH0pO1xuICBjb25zdCB2ZWxSZWYgPSBSZWFjdC51c2VSZWYoeyB2eDogMCwgdnk6IDAgfSk7XG4gIGNvbnN0IGRpY2VCb3hSZWYgPSBSZWFjdC51c2VSZWYoeyBjeDogMCwgY3k6IDAsIHc6IDgwLCBoOiA4MCB9KTtcbiAgY29uc3QgcGh5c1JlZiA9IFJlYWN0LnVzZVJlZih7IHg6IDAsIHk6IDAsIHZ4OiAwLCB2eTogMCwgcm90WjogMCwgdnJvdDogMCwgcnVubmluZzogZmFsc2UsIGxhc3RUOiAwLCBzdGFydFQ6IDAgfSk7XG4gIGNvbnN0IHJhZlJlZiA9IFJlYWN0LnVzZVJlZihudWxsKTtcbiAgY29uc3QgcmVzdFRpbWVyUmVmID0gUmVhY3QudXNlUmVmKG51bGwpO1xuICBjb25zdCByZXR1cm5UaW1lclJlZiA9IFJlYWN0LnVzZVJlZihudWxsKTtcblxuICBjb25zdCBjYW5JbnRlcmFjdCA9ICFkaXNhYmxlZCAmJiAhcm9sbGluZyAmJiBwaHlzLm1vZGUgPT09ICdpZGxlJztcblxuICBjb25zdCBjYW5jZWxUaW1lcnMgPSAoKSA9PiB7XG4gICAgaWYgKHJhZlJlZi5jdXJyZW50KSBjYW5jZWxBbmltYXRpb25GcmFtZShyYWZSZWYuY3VycmVudCk7XG4gICAgaWYgKHJlc3RUaW1lclJlZi5jdXJyZW50KSBjbGVhclRpbWVvdXQocmVzdFRpbWVyUmVmLmN1cnJlbnQpO1xuICAgIGlmIChyZXR1cm5UaW1lclJlZi5jdXJyZW50KSBjbGVhclRpbWVvdXQocmV0dXJuVGltZXJSZWYuY3VycmVudCk7XG4gICAgcmFmUmVmLmN1cnJlbnQgPSBudWxsO1xuICAgIHJlc3RUaW1lclJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICByZXR1cm5UaW1lclJlZi5jdXJyZW50ID0gbnVsbDtcbiAgfTtcblxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4gKCkgPT4gY2FuY2VsVGltZXJzKCksIFtdKTtcblxuICAvLyBQcm9ncmFtbWF0aWMgcm9sbHMgKEFJIHR1cm4sIGV0Yy4pIHJvbGwgaW4gcGxhY2Ug4oCUIG5vIHRvc3MuIE9ubHkgYSB1c2VyJ3MgcmVhbCBkcmFnL2ZsaWNrXG4gIC8vIHRyaWdnZXJzIHRoZSBwaHlzaWNzIG1vdGlvbi4gVGhpcyBrZWVwcyB0aGUgaG9tZSBzbG90IG9jY3VwaWVkIGFuZCB0aGUgZGljZSBhbHdheXMgdmlzaWJsZS5cblxuICAvLyBDYWNoZSB0aGUgZGljZSBlbGVtZW50IHNvIHdlIGNhbiByZS1tZWFzdXJlIGl0cyByZWN0IG1pZC1mbGlnaHQgb24gcmVzaXplL29yaWVudGF0aW9uXG4gIC8vIGNoYW5nZSAob3RoZXJ3aXNlIHRoZSBib3VuY2Utd2FsbHMgY2FsY3VsYXRpb24gdXNlcyBzdGFsZSBkaW1lbnNpb25zKS5cbiAgY29uc3QgZGljZUVsUmVmID0gUmVhY3QudXNlUmVmKG51bGwpO1xuICBjb25zdCByZWZyZXNoRGljZUJveCA9IFJlYWN0LnVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBjb25zdCBlbCA9IGRpY2VFbFJlZi5jdXJyZW50O1xuICAgIGlmICghZWwpIHJldHVybjtcbiAgICBjb25zdCByZWN0ID0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgZGljZUJveFJlZi5jdXJyZW50ID0ge1xuICAgICAgY3g6IHJlY3QubGVmdCArIHJlY3Qud2lkdGggLyAyLFxuICAgICAgY3k6IHJlY3QudG9wICsgcmVjdC5oZWlnaHQgLyAyLFxuICAgICAgdzogcmVjdC53aWR0aCxcbiAgICAgIGg6IHJlY3QuaGVpZ2h0LFxuICAgIH07XG4gIH0sIFtdKTtcbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgcmVmcmVzaERpY2VCb3gpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvcmllbnRhdGlvbmNoYW5nZScsIHJlZnJlc2hEaWNlQm94KTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIHJlZnJlc2hEaWNlQm94KTtcbiAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdvcmllbnRhdGlvbmNoYW5nZScsIHJlZnJlc2hEaWNlQm94KTtcbiAgICB9O1xuICB9LCBbcmVmcmVzaERpY2VCb3hdKTtcblxuICAvLyBJZiB1c2VyIGJhY2tncm91bmRzIHRoZSB0YWIgZHVyaW5nIGEgdGhyb3csIHRoZSByQUYgZnJlZXplcyBhbmQgdGltZXJzIHRocm90dGxlLlxuICAvLyBDYW5jZWwgcGVuZGluZyBwaHlzaWNzICsgc25hcCBob21lIHNvIHRoZSBnYW1lIHN0YXRlIGlzIGNvbnNpc3RlbnQgb24gcmV0dXJuLlxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IG9uSGlkZSA9ICgpID0+IHtcbiAgICAgIGlmIChkb2N1bWVudC5oaWRkZW4gJiYgcGh5c1JlZi5jdXJyZW50Py5ydW5uaW5nKSB7XG4gICAgICAgIGNhbmNlbFRpbWVycygpO1xuICAgICAgICBwaHlzUmVmLmN1cnJlbnQucnVubmluZyA9IGZhbHNlO1xuICAgICAgICBzZXRQaHlzKHsgbW9kZTogJ2lkbGUnLCB4OiAwLCB5OiAwLCByb3RaOiAwLCBoZWlnaHQ6IDAgfSk7XG4gICAgICB9XG4gICAgfTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgb25IaWRlKTtcbiAgICByZXR1cm4gKCkgPT4gZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsIG9uSGlkZSk7XG4gIH0sIFtdKTtcblxuICBjb25zdCBvblBvaW50ZXJEb3duID0gKGUpID0+IHtcbiAgICBpZiAoIWNhbkludGVyYWN0KSByZXR1cm47XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHRyeSB7IGUuY3VycmVudFRhcmdldC5zZXRQb2ludGVyQ2FwdHVyZShlLnBvaW50ZXJJZCk7IH0gY2F0Y2ggKF8pIHt9XG4gICAgZGljZUVsUmVmLmN1cnJlbnQgPSBlLmN1cnJlbnRUYXJnZXQ7XG4gICAgLy8gQ2FwdHVyZSB0aGUgZGljZSdzIGluaXRpYWwgc2NyZWVuIHBvc2l0aW9uIHNvIHdlIGNhbiBjbGFtcCB0byB2aWV3cG9ydCB3aGlsZSBkcmFnZ2luZ1xuICAgIGNvbnN0IHJlY3QgPSBlLmN1cnJlbnRUYXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgZGljZUJveFJlZi5jdXJyZW50ID0ge1xuICAgICAgY3g6IHJlY3QubGVmdCArIHJlY3Qud2lkdGggLyAyLFxuICAgICAgY3k6IHJlY3QudG9wICsgcmVjdC5oZWlnaHQgLyAyLFxuICAgICAgdzogcmVjdC53aWR0aCxcbiAgICAgIGg6IHJlY3QuaGVpZ2h0LFxuICAgIH07XG4gICAgc3RhcnRSZWYuY3VycmVudCA9IHsgeDogZS5jbGllbnRYLCB5OiBlLmNsaWVudFkgfTtcbiAgICBsYXN0TW92ZVJlZi5jdXJyZW50ID0geyB4OiBlLmNsaWVudFgsIHk6IGUuY2xpZW50WSwgdDogcGVyZm9ybWFuY2Uubm93KCkgfTtcbiAgICB2ZWxSZWYuY3VycmVudCA9IHsgdng6IDAsIHZ5OiAwIH07XG4gICAgc2V0RHJhZyh7IGFjdGl2ZTogdHJ1ZSwgZHg6IDAsIGR5OiAwIH0pO1xuICAgIHNldFBoeXMoeyBtb2RlOiAnaWRsZScsIHg6IDAsIHk6IDAsIHJvdFo6IDAsIGhlaWdodDogMCB9KTtcbiAgfTtcblxuICBjb25zdCBvblBvaW50ZXJNb3ZlID0gKGUpID0+IHtcbiAgICBpZiAoIWRyYWcuYWN0aXZlKSByZXR1cm47XG4gICAgY29uc3QgcmF3RHggPSBlLmNsaWVudFggLSBzdGFydFJlZi5jdXJyZW50Lng7XG4gICAgY29uc3QgcmF3RHkgPSBlLmNsaWVudFkgLSBzdGFydFJlZi5jdXJyZW50Lnk7XG4gICAgLy8gQ2xhbXAgc28gdGhlIGRpY2Ugc3RheXMgaW5zaWRlIHRoZSB2aWV3cG9ydCB3aGlsZSBkcmFnZ2luZ1xuICAgIGNvbnN0IHZ3ID0gd2luZG93LmlubmVyV2lkdGg7XG4gICAgY29uc3QgdmggPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG4gICAgY29uc3QgaGFsZlcgPSBkaWNlQm94UmVmLmN1cnJlbnQudyAvIDI7XG4gICAgY29uc3QgaGFsZkggPSBkaWNlQm94UmVmLmN1cnJlbnQuaCAvIDI7XG4gICAgY29uc3QgeyBjeCwgY3kgfSA9IGRpY2VCb3hSZWYuY3VycmVudDtcbiAgICBjb25zdCBwYWQgPSA0O1xuICAgIGNvbnN0IG1pbkR4ID0gKGhhbGZXICsgcGFkKSAtIGN4O1xuICAgIGNvbnN0IG1heER4ID0gdncgLSAoaGFsZlcgKyBwYWQpIC0gY3g7XG4gICAgY29uc3QgbWluRHkgPSAoaGFsZkggKyBwYWQpIC0gY3k7XG4gICAgY29uc3QgbWF4RHkgPSB2aCAtIChoYWxmSCArIHBhZCkgLSBjeTtcbiAgICBjb25zdCBkeCA9IE1hdGgubWF4KG1pbkR4LCBNYXRoLm1pbihtYXhEeCwgcmF3RHgpKTtcbiAgICBjb25zdCBkeSA9IE1hdGgubWF4KG1pbkR5LCBNYXRoLm1pbihtYXhEeSwgcmF3RHkpKTtcbiAgICBjb25zdCBub3cgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICBjb25zdCBkdCA9IE1hdGgubWF4KDEsIG5vdyAtIGxhc3RNb3ZlUmVmLmN1cnJlbnQudCk7XG4gICAgdmVsUmVmLmN1cnJlbnQgPSB7XG4gICAgICB2eDogKGUuY2xpZW50WCAtIGxhc3RNb3ZlUmVmLmN1cnJlbnQueCkgKiAxMDAwIC8gZHQsXG4gICAgICB2eTogKGUuY2xpZW50WSAtIGxhc3RNb3ZlUmVmLmN1cnJlbnQueSkgKiAxMDAwIC8gZHQsXG4gICAgfTtcbiAgICBsYXN0TW92ZVJlZi5jdXJyZW50ID0geyB4OiBlLmNsaWVudFgsIHk6IGUuY2xpZW50WSwgdDogbm93IH07XG4gICAgc2V0RHJhZyh7IGFjdGl2ZTogdHJ1ZSwgZHgsIGR5IH0pO1xuICB9O1xuXG4gIGNvbnN0IHN0YXJ0UGh5c2ljcyA9IChpbml0WCwgaW5pdFksIHZ4LCB2eSkgPT4ge1xuICAgIGNhbmNlbFRpbWVycygpO1xuICAgIHBoeXNSZWYuY3VycmVudCA9IHtcbiAgICAgIHg6IGluaXRYLCB5OiBpbml0WSxcbiAgICAgIHZ4LCB2eSxcbiAgICAgIHJvdFo6IDAsXG4gICAgICB2cm90OiAoTWF0aC5yYW5kb20oKSAtIDAuNSkgKiA5MDAgKyAodnggKiAwLjI1KSwgLy8gaW5pdGlhbCBzcGluIHBhcnRseSBjb3VwbGVkIHRvIGhvcml6b250YWwgZmxpbmdcbiAgICAgIHJ1bm5pbmc6IHRydWUsXG4gICAgICBsYXN0VDogMCxcbiAgICAgIHN0YXJ0VDogcGVyZm9ybWFuY2Uubm93KCksXG4gICAgfTtcbiAgICBzZXRQaHlzKHsgbW9kZTogJ2ZseWluZycsIHg6IGluaXRYLCB5OiBpbml0WSwgcm90WjogMCwgaGVpZ2h0OiAwIH0pO1xuXG4gICAgY29uc3Qgc3RlcCA9IChub3cpID0+IHtcbiAgICAgIGNvbnN0IHAgPSBwaHlzUmVmLmN1cnJlbnQ7XG4gICAgICBpZiAoIXAucnVubmluZykgcmV0dXJuO1xuICAgICAgY29uc3QgcHJldiA9IHAubGFzdFQgfHwgbm93O1xuICAgICAgY29uc3QgZHQgPSBNYXRoLm1pbigwLjA0LCAobm93IC0gcHJldikgLyAxMDAwKTtcbiAgICAgIHAubGFzdFQgPSBub3c7XG5cbiAgICAgIC8vIEZyaWN0aW9uIChsaW5lYXIgZHJhZyk6IHBlci1zZWNvbmQgZGVjYXkgZmFjdG9yIH4wLjM1IChzbyB2ZWxvY2l0eSBkcm9wcyB0byB+MzUlIHBlciBzZWNvbmQgYXQgaGlnaGVyIHNwZWVkcyxcbiAgICAgIC8vIHNsb3dpbmcgZG93biB1bnRpbCBiZWxvdyByZXN0IHRocmVzaG9sZCkuIFVzaW5nIGFuIGV4cCBkZWNheSBrZWVwcyBpdCBzbW9vdGguXG4gICAgICBjb25zdCBmcmljID0gTWF0aC5wb3coMC40LCBkdCk7XG4gICAgICBwLnZ4ICo9IGZyaWM7XG4gICAgICBwLnZ5ICo9IGZyaWM7XG4gICAgICBwLnZyb3QgKj0gTWF0aC5wb3coMC41NSwgZHQpO1xuXG4gICAgICAvLyBJbnRlZ3JhdGVcbiAgICAgIHAueCArPSBwLnZ4ICogZHQ7XG4gICAgICBwLnkgKz0gcC52eSAqIGR0O1xuICAgICAgcC5yb3RaICs9IHAudnJvdCAqIGR0O1xuXG4gICAgICAvLyBCb3VuY2Ugb2ZmIHZpZXdwb3J0IHdhbGxzLiBSZS1yZWFkIHRoZSBkaWNlJ3Mgc2NyZWVuIHBvc2l0aW9uIGVhY2ggZnJhbWUgc28gYVxuICAgICAgLy8gbWlkLXRocm93IHZpZXdwb3J0IHJlc2l6ZSAvIG9yaWVudGF0aW9uIGNoYW5nZSBkb2Vzbid0IHRyYXAgdGhlIGN1YmUgb2ZmLXNjcmVlbi5cbiAgICAgIHJlZnJlc2hEaWNlQm94KCk7XG4gICAgICBjb25zdCB2dyA9IHdpbmRvdy5pbm5lcldpZHRoO1xuICAgICAgY29uc3QgdmggPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG4gICAgICBjb25zdCB7IGN4LCBjeSwgdywgaCB9ID0gZGljZUJveFJlZi5jdXJyZW50O1xuICAgICAgY29uc3QgaGFsZlcgPSB3IC8gMiwgaGFsZkggPSBoIC8gMiwgcGFkID0gNDtcbiAgICAgIGNvbnN0IG1pblggPSAoaGFsZlcgKyBwYWQpIC0gY3g7XG4gICAgICBjb25zdCBtYXhYID0gdncgLSAoaGFsZlcgKyBwYWQpIC0gY3g7XG4gICAgICBjb25zdCBtaW5ZID0gKGhhbGZIICsgcGFkKSAtIGN5O1xuICAgICAgY29uc3QgbWF4WSA9IHZoIC0gKGhhbGZIICsgcGFkKSAtIGN5O1xuICAgICAgY29uc3QgYm91bmNlRGFtcCA9IDAuNjg7XG4gICAgICBsZXQgaGl0V2FsbCA9IGZhbHNlO1xuICAgICAgaWYgKHAueCA8IG1pblgpIHsgcC54ID0gbWluWDsgcC52eCA9IE1hdGguYWJzKHAudngpICogYm91bmNlRGFtcDsgcC52cm90ID0gLXAudnJvdCAqIDAuOCArIChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDIwMDsgaGl0V2FsbCA9IHRydWU7IH1cbiAgICAgIGlmIChwLnggPiBtYXhYKSB7IHAueCA9IG1heFg7IHAudnggPSAtTWF0aC5hYnMocC52eCkgKiBib3VuY2VEYW1wOyBwLnZyb3QgPSAtcC52cm90ICogMC44ICsgKE1hdGgucmFuZG9tKCkgLSAwLjUpICogMjAwOyBoaXRXYWxsID0gdHJ1ZTsgfVxuICAgICAgaWYgKHAueSA8IG1pblkpIHsgcC55ID0gbWluWTsgcC52eSA9IE1hdGguYWJzKHAudnkpICogYm91bmNlRGFtcDsgcC52cm90ID0gLXAudnJvdCAqIDAuOCArIChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDIwMDsgaGl0V2FsbCA9IHRydWU7IH1cbiAgICAgIGlmIChwLnkgPiBtYXhZKSB7IHAueSA9IG1heFk7IHAudnkgPSAtTWF0aC5hYnMocC52eSkgKiBib3VuY2VEYW1wOyBwLnZyb3QgPSAtcC52cm90ICogMC44ICsgKE1hdGgucmFuZG9tKCkgLSAwLjUpICogMjAwOyBoaXRXYWxsID0gdHJ1ZTsgfVxuICAgICAgLy8gT24gd2FsbCBpbXBhY3QsIGJyaWVmbHkgc3F1YXNoIHRoZSBjdWJlIHRvIHNlbGwgdGhlIGNvbGxpc2lvblxuICAgICAgaWYgKGhpdFdhbGwpIHtcbiAgICAgICAgY29uc3QgYnRuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmRpY2UzZCcpO1xuICAgICAgICBpZiAoYnRuKSB7XG4gICAgICAgICAgYnRuLmNsYXNzTGlzdC5yZW1vdmUoJ2ltcGFjdCcpO1xuICAgICAgICAgIHZvaWQgYnRuLm9mZnNldFdpZHRoOyAvLyBmb3JjZSByZWZsb3cgc28gYW5pbWF0aW9uIHJlc3RhcnRzXG4gICAgICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoJ2ltcGFjdCcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEhlaWdodCBhcmM6IHdoaWxlIHRoZSBkaWUgaXMgbW92aW5nIGZhc3QgaXQncyBcImluIHRoZSBhaXJcIjsgYXMgaXQgc2xvd3MgaXQgc2V0dGxlcyBkb3duLlxuICAgICAgLy8gVGhpcyBzZWxscyB0aGUgWi1kZXB0aCBpbGx1c2lvbiDigJQgY3ViZSBsaWZ0cyBvbiBmbGluZywgc2hhZG93IGV4cGFuZHMgYmVsb3cgaXQuXG4gICAgICBjb25zdCBzcGVlZCA9IE1hdGguaHlwb3QocC52eCwgcC52eSk7XG4gICAgICBjb25zdCBoZWlnaHQgPSBNYXRoLm1pbig5MCwgc3BlZWQgKiAwLjA4NSk7XG4gICAgICBzZXRQaHlzKHsgbW9kZTogJ2ZseWluZycsIHg6IHAueCwgeTogcC55LCByb3RaOiBwLnJvdFosIGhlaWdodCB9KTtcblxuICAgICAgY29uc3QgZWxhcHNlZCA9IChub3cgLSBwLnN0YXJ0VCkgLyAxMDAwO1xuICAgICAgLy8gU2V0dGxlIHdoZW4gdGhlIGRpY2UgaXMgbmVhcmx5IHN0b3BwZWQgb3Igd2UgaGl0IHRoZSBwaHlzaWNzIHRpbWUgbGltaXQuXG4gICAgICAvLyBTZXF1ZW5jZTogZmx5aW5nIOKGkiBsYW5kaW5nIChzbmFwIHNxdWFzaCkg4oaSIHJlc3RpbmcgKGVsYXN0aWMgcmVjb3Zlcikg4oaSIHJldHVybmluZyBob21lLlxuICAgICAgaWYgKChzcGVlZCA8IDIyICYmIGVsYXBzZWQgPiAwLjM1KSB8fCBlbGFwc2VkID4gMS40KSB7XG4gICAgICAgIHAucnVubmluZyA9IGZhbHNlO1xuICAgICAgICByYWZSZWYuY3VycmVudCA9IG51bGw7XG4gICAgICAgIC8vIFNuYXAgaW50byBhIHNxdWFzaGVkIGxhbmRpbmcgcG9zZSDigJQgdHJhbnNmb3JtLXRyYW5zaXRpb24gaXMgZGlzYWJsZWQgaW4gJ2xhbmRpbmcnLFxuICAgICAgICAvLyBzbyB0aGlzIHJlbmRlcnMgaW5zdGFudGx5IGxpa2UgYSByZWFsIGltcGFjdCBjb21wcmVzc2lvbi5cbiAgICAgICAgc2V0UGh5cyh7IG1vZGU6ICdsYW5kaW5nJywgeDogcC54LCB5OiBwLnksIHJvdFo6IHAucm90WiwgaGVpZ2h0OiAwIH0pO1xuICAgICAgICAvLyBPbmUgZnJhbWUgbGF0ZXIsIHN3aXRjaCB0byAncmVzdGluZycg4oCUIHRyYW5zZm9ybSB0cmFuc2l0aW9ucyBiYWNrIHRvIG5hdHVyYWwgc2NhbGVcbiAgICAgICAgLy8gdmlhIHRoZSBlbGFzdGljIGVhc2luZyBjdXJ2ZSBvbiAuZDMtdGhyb3csIHByb2R1Y2luZyBhIHNwcmluZ3kgYm91bmNlLWJhY2suXG4gICAgICAgIHJlc3RUaW1lclJlZi5jdXJyZW50ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgc2V0UGh5cyh7IG1vZGU6ICdyZXN0aW5nJywgeDogcC54LCB5OiBwLnksIHJvdFo6IHAucm90WiwgaGVpZ2h0OiAwIH0pO1xuICAgICAgICAgIC8vIEhvbGQgYXQgdGhlIGxhbmRlZCBzcG90IHVudGlsIHRoZSBpbm5lciBjdWJlIGhhcyBhY3R1YWxseSBzZXR0bGVkIHRvIHRoZSByb2xsZWRcbiAgICAgICAgICAvLyBmYWNlLiBTcHJpbmctaG9tZSBvbmx5IGZpcmVzIEFGVEVSIGByb2xsaW5nYCBmbGlwcyBmYWxzZSAod2hpY2gga2lja3Mgb2ZmIHRoZVxuICAgICAgICAgIC8vIDkwMG1zIGlubmVyIGZhY2Utc2V0dGxlKSwgcGx1cyBhIHJlYWQgd2luZG93IHNvIHRoZSB1c2VyIGNsZWFybHkgc2VlcyB0aGVcbiAgICAgICAgICAvLyByb2xsZWQgdmFsdWUgb24gdGhlIHJlc3RpbmcgZGllIGJlZm9yZSBpdCB0cmF2ZWxzIGhvbWUuXG4gICAgICAgICAgY29uc3QgaG9sZEF0TGFuZGVkID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHJvbGxpbmdSZWYuY3VycmVudCkge1xuICAgICAgICAgICAgICByZXR1cm5UaW1lclJlZi5jdXJyZW50ID0gc2V0VGltZW91dChob2xkQXRMYW5kZWQsIDgwKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuVGltZXJSZWYuY3VycmVudCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICBzZXRQaHlzKHsgbW9kZTogJ3JldHVybmluZycsIHg6IDAsIHk6IDAsIHJvdFo6IDAsIGhlaWdodDogMCB9KTtcbiAgICAgICAgICAgICAgLy8gVHJhY2sgdGhpcyBmaW5hbCBzZXR0bGUgc28gY2FuY2VsVGltZXJzKCkgY2FuIGNsZWFyIGl0IG9uIHVubW91bnQuXG4gICAgICAgICAgICAgIHJldHVyblRpbWVyUmVmLmN1cnJlbnQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICBzZXRQaHlzKHsgbW9kZTogJ2lkbGUnLCB4OiAwLCB5OiAwLCByb3RaOiAwLCBoZWlnaHQ6IDAgfSk7XG4gICAgICAgICAgICAgIH0sIDUyMCk7XG4gICAgICAgICAgICB9LCAxMDAwKTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIHJldHVyblRpbWVyUmVmLmN1cnJlbnQgPSBzZXRUaW1lb3V0KGhvbGRBdExhbmRlZCwgMzYwKTtcbiAgICAgICAgfSwgMTYpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByYWZSZWYuY3VycmVudCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShzdGVwKTtcbiAgICB9O1xuICAgIHJhZlJlZi5jdXJyZW50ID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHN0ZXApO1xuICB9O1xuXG4gIGNvbnN0IGVuZERyYWcgPSAoZGlkUmVsZWFzZSkgPT4ge1xuICAgIGNvbnN0IHsgZHgsIGR5IH0gPSBkcmFnO1xuICAgIGNvbnN0IGRpc3QgPSBNYXRoLmh5cG90KGR4LCBkeSk7XG4gICAgY29uc3QgeyB2eCwgdnkgfSA9IHZlbFJlZi5jdXJyZW50O1xuICAgIGNvbnN0IHNwZWVkID0gTWF0aC5oeXBvdCh2eCwgdnkpO1xuICAgIHNldERyYWcoeyBhY3RpdmU6IGZhbHNlLCBkeDogMCwgZHk6IDAgfSk7XG4gICAgaWYgKCFkaWRSZWxlYXNlIHx8ICFjYW5JbnRlcmFjdCkgcmV0dXJuO1xuXG4gICAgLy8gVEFQIOKAlCB1c2VyIGp1c3QgY2xpY2tlZC9wcmVzc2VkLCBkaWRuJ3QgZHJhZyBvciBmbGljay4gUm9sbCBpbiBwbGFjZSwgbm8gcGh5c2ljcyBtb3ZlbWVudC5cbiAgICAvLyBUaGUgaW5uZXIgY3ViZSB3aWxsIHR1bWJsZS1hbmQtc2V0dGxlIG9uIHRoZSBmYWNlIHZpYSB0aGUgcm9sbGluZ+KGkmZhbHNlIHRyYW5zaXRpb24uXG4gICAgY29uc3QgaXNUYXAgPSBkaXN0IDwgOCAmJiBzcGVlZCA8IDIwMDtcbiAgICBpZiAoaXNUYXApIHtcbiAgICAgIG9uQ2xpY2s/LigpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRIUk9XIOKAlCB1c2VyIGRyYWdnZWQgYW5kL29yIGZsaWNrZWQuIFVzZSByZWFsIHBoeXNpY3MgdG8gdG9zcyB0aGUgZGljZSBhY3Jvc3MgdGhlIHNjcmVlbi5cbiAgICBsZXQgbGF1bmNoVngsIGxhdW5jaFZ5O1xuICAgIGlmIChzcGVlZCA+IDIwMCkge1xuICAgICAgLy8gUmVhbCBmbGljazogdXNlIG1lYXN1cmVkIHZlbG9jaXR5IGRpcmVjdGx5XG4gICAgICBsYXVuY2hWeCA9IHZ4O1xuICAgICAgbGF1bmNoVnkgPSB2eTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSGVsZC1hbmQtcmVsZWFzZWQ6IGZsaW5nIGluIGRyYWcgZGlyZWN0aW9uIHdpdGggZGlzdGFuY2UtZGVyaXZlZCBtYWduaXR1ZGVcbiAgICAgIGNvbnN0IG1hZyA9IE1hdGgubWF4KDYwMCwgZGlzdCAqIDE0KTtcbiAgICAgIGxhdW5jaFZ4ID0gKGR4IC8gZGlzdCkgKiBtYWc7XG4gICAgICBsYXVuY2hWeSA9IChkeSAvIGRpc3QpICogbWFnO1xuICAgIH1cbiAgICBzdGFydFBoeXNpY3MoZHgsIGR5LCBsYXVuY2hWeCwgbGF1bmNoVnkpO1xuICAgIG9uQ2xpY2s/LigpO1xuICB9O1xuXG4gIGNvbnN0IG9uUG9pbnRlclVwID0gKCkgPT4gZW5kRHJhZyh0cnVlKTtcbiAgY29uc3Qgb25Qb2ludGVyQ2FuY2VsID0gKCkgPT4gZW5kRHJhZyhmYWxzZSk7XG5cbiAgLy8gR3JvdW5kIHNoYWRvdzogYmlnZ2VyICsgc29mdGVyICsgZGltbWVyIHdoaWxlIGFpcmJvcm5lLCB0aWdodCArIGRhcmsgd2hlbiBwbGFudGVkLlxuICAvLyBSZXNwb25kcyB0byBib3RoIHR1bWJsZSBib3VuY2UgYW5kIHBoeXNpY3MgZmxpZ2h0IGhlaWdodCBmb3IgYSB1bmlmaWVkIFwid2VpZ2h0IG9uIGdyb3VuZFwiIGZlZWwuXG4gIGNvbnN0IGFpcmJvcm5lID0gKHBoeXMubW9kZSA9PT0gJ2ZseWluZycgPyBwaHlzLmhlaWdodCA6IDApO1xuICBjb25zdCBzaGFkb3dTY2FsZSA9IDEgKyBjdXJyZW50Um90LmJvdW5jZSAvIDQwICsgYWlyYm9ybmUgLyA1NTtcbiAgY29uc3Qgc2hhZG93T3BhY2l0eSA9IE1hdGgubWF4KDAuMDgsIDAuNSAtIGN1cnJlbnRSb3QuYm91bmNlIC8gNTAgLSBhaXJib3JuZSAvIDE2MCk7XG4gIGNvbnN0IHNoYWRvd0JsdXIgPSAzICsgYWlyYm9ybmUgLyAxODtcblxuICAvLyBDb21wb3NlIG91dGVyIHRyYW5zZm9ybSBmcm9tIGRyYWcgLyBwaHlzaWNzIC8gcmVzdGluZyAvIHJldHVybmluZy5cbiAgLy8gSU1QT1JUQU5UOiBkdXJpbmcgcGh5c2ljcyB3ZSBpbnRlbnRpb25hbGx5IHVzZSB0cmFuc2xhdGUgT05MWS4gMkQgcm90YXRpb24gb24gdGhlIG91dGVyXG4gIC8vIHdyYXBwZXIgZmxhdHRlbnMgdGhlIHBlcnNwZWN0aXZlIGlsbHVzaW9uIOKAlCB0aGUgZGljZSBtdXN0IHN0YXkgYSBjbGVhbiAzRCBvYmplY3QgYXQgYWxsXG4gIC8vIHRpbWVzLiBBbGwgdmlzaWJsZSByb3RhdGlvbiBjb21lcyBmcm9tIHRoZSBpbm5lciAuZDMtY3ViZSdzIHJvdGF0ZVgvcm90YXRlWSAodHJ1ZSAzRCkuXG4gIGxldCBvdXRlclRyYW5zZm9ybSwgb3V0ZXJUcmFuc2l0aW9uO1xuICBpZiAoZHJhZy5hY3RpdmUpIHtcbiAgICAvLyBMaWZ0aW5nIHRoZSBkaWU6IHN1YnRsZSBzY2FsZS11cCBvbmx5LCBubyAyRCByb3RhdGlvbiAocHJlc2VydmVzIDNEIHBlcnNwZWN0aXZlKS5cbiAgICBvdXRlclRyYW5zZm9ybSA9IGB0cmFuc2xhdGUoJHtkcmFnLmR4fXB4LCAke2RyYWcuZHl9cHgpIHNjYWxlKDEuMDUpYDtcbiAgICBvdXRlclRyYW5zaXRpb24gPSAndHJhbnNmb3JtIDYwbXMgbGluZWFyJztcbiAgfSBlbHNlIGlmIChwaHlzLm1vZGUgPT09ICdmbHlpbmcnKSB7XG4gICAgLy8gdHJhbnNsYXRlWSBtaW51cyBoZWlnaHQgc2ltdWxhdGVzIFotbGlmdCAoZGllIGFpcmJvcm5lKTsgc2NhbGUgZ3Jvd3Mgc2xpZ2h0bHkgd2l0aCBoZWlnaHRcbiAgICAvLyBzbyBpdCByZWFkcyBhcyBcImNsb3NlciB0byBjYW1lcmFcIiDigJQgYSByZWFsIHRocm93biBkaWUgbG9va3MgYmlnZ2VyIGF0IGFwZXguXG4gICAgY29uc3QgbGlmdFNjYWxlID0gMSArIHBoeXMuaGVpZ2h0IC8gNjAwO1xuICAgIG91dGVyVHJhbnNmb3JtID0gYHRyYW5zbGF0ZSgke3BoeXMueH1weCwgJHtwaHlzLnkgLSBwaHlzLmhlaWdodH1weCkgc2NhbGUoJHtsaWZ0U2NhbGV9KWA7XG4gICAgb3V0ZXJUcmFuc2l0aW9uID0gJ25vbmUnO1xuICB9IGVsc2UgaWYgKHBoeXMubW9kZSA9PT0gJ2xhbmRpbmcnKSB7XG4gICAgLy8gSW1wYWN0IGZyYW1lOiBub24tdW5pZm9ybSBzcXVhc2ggKHdpZGVyICsgc2hvcnRlcikgc2ltdWxhdGVzIHRoZSBkaWUgY29tcHJlc3NpbmcgYWdhaW5zdFxuICAgIC8vIHRoZSBzdXJmYWNlLiBSZW5kZXJlZCB3aXRoIHRyYW5zaXRpb246bm9uZSBzbyB0aGUgc3F1YXNoIHNuYXBzIGluIGxpa2UgYSByZWFsIGhpdC5cbiAgICBvdXRlclRyYW5zZm9ybSA9IGB0cmFuc2xhdGUoJHtwaHlzLnh9cHgsICR7cGh5cy55fXB4KSBzY2FsZSgxLjE4LCAwLjgyKWA7XG4gICAgb3V0ZXJUcmFuc2l0aW9uID0gJ25vbmUnO1xuICB9IGVsc2UgaWYgKHBoeXMubW9kZSA9PT0gJ3Jlc3RpbmcnKSB7XG4gICAgLy8gU3ByaW5nIGJhY2sgdG8gbmF0dXJhbCBzY2FsZSB3aXRoIGFuIGVsYXN0aWMgb3ZlcnNob290IOKAlCB0aGUgZGllIGJvdW5jZXMgYmFjayB1cHJpZ2h0LlxuICAgIG91dGVyVHJhbnNmb3JtID0gYHRyYW5zbGF0ZSgke3BoeXMueH1weCwgJHtwaHlzLnl9cHgpIHNjYWxlKDEsIDEpYDtcbiAgICBvdXRlclRyYW5zaXRpb24gPSAndHJhbnNmb3JtIDM2MG1zIGN1YmljLWJlemllciguMjUsIDEuNywgLjM1LCAxKSc7XG4gIH0gZWxzZSBpZiAocGh5cy5tb2RlID09PSAncmV0dXJuaW5nJykge1xuICAgIG91dGVyVHJhbnNmb3JtID0gYHRyYW5zbGF0ZSgwLCAwKSBzY2FsZSgxKWA7XG4gICAgb3V0ZXJUcmFuc2l0aW9uID0gJ3RyYW5zZm9ybSA1MjBtcyBjdWJpYy1iZXppZXIoLjM0LDEuMjYsLjY0LDEpJztcbiAgfSBlbHNlIHtcbiAgICBvdXRlclRyYW5zZm9ybSA9ICd0cmFuc2xhdGUoMCwgMCkgc2NhbGUoMSknO1xuICAgIG91dGVyVHJhbnNpdGlvbiA9ICd0cmFuc2Zvcm0gMzgwbXMgY3ViaWMtYmV6aWVyKC4zNCwxLjU2LC42NCwxKSc7XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxidXR0b25cbiAgICAgIGNsYXNzTmFtZT17YGRpY2UzZCAke3JvbGxpbmcgPyAncm9sbGluZycgOiAnJ30gJHtkcmFnLmFjdGl2ZSA/ICdncmFiYmluZycgOiAnJ30gJHtwaHlzLm1vZGUgIT09ICdpZGxlJyA/ICdwaHlzaWNzJyA6ICcnfSAke3BoeXMubW9kZSA9PT0gJ3Jlc3RpbmcnID8gJ3Jlc3RpbmcnIDogJyd9YH1cbiAgICAgIG9uUG9pbnRlckRvd249e29uUG9pbnRlckRvd259XG4gICAgICBvblBvaW50ZXJNb3ZlPXtvblBvaW50ZXJNb3ZlfVxuICAgICAgb25Qb2ludGVyVXA9e29uUG9pbnRlclVwfVxuICAgICAgb25Qb2ludGVyQ2FuY2VsPXtvblBvaW50ZXJDYW5jZWx9XG4gICAgICBvbkNvbnRleHRNZW51PXsoZSkgPT4gZS5wcmV2ZW50RGVmYXVsdCgpfVxuICAgICAgb25DbGljaz17KGUpID0+IHtcbiAgICAgICAgLy8gT25seSBob25vciBrZXlib2FyZC1pbml0aWF0ZWQgY2xpY2tzIChFbnRlci9TcGFjZSkg4oCUIHBvaW50ZXIgXCJjbGlja1wiIGV2ZW50cyBmaXJlXG4gICAgICAgIC8vIGFmdGVyIGEgcG9pbnRlcnVwIHRoYXQgZW5kRHJhZygpIGFscmVhZHkgaGFuZGxlZC4gZGV0YWlsPT09MCBtYXJrcyBhIHRydWUga2V5Ym9hcmQgY2xpY2suXG4gICAgICAgIGlmIChlLmRldGFpbCA9PT0gMCAmJiBjYW5JbnRlcmFjdCkgb25DbGljaz8uKCk7XG4gICAgICB9fVxuICAgICAgb25LZXlEb3duPXsoZSkgPT4ge1xuICAgICAgICBpZiAoKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnICcpICYmIGNhbkludGVyYWN0KSB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgIG9uQ2xpY2s/LigpO1xuICAgICAgICB9XG4gICAgICB9fVxuICAgICAgZGlzYWJsZWQ9e2Rpc2FibGVkfVxuICAgICAgYXJpYS1sYWJlbD17YFJvbGwgdGhlIGRpY2UuIEN1cnJlbnRseSBzaG93aW5nICR7dmFsdWV9LiBQcmVzcyBFbnRlciBvciBTcGFjZSB0byByb2xsLCBvciBkcmFnIHRvIGZsaW5nLmB9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJkMy1zY2VuZVwiPlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgY2xhc3NOYW1lPVwiZDMtdGhyb3dcIlxuICAgICAgICAgIHN0eWxlPXt7IHRyYW5zZm9ybTogb3V0ZXJUcmFuc2Zvcm0sIHRyYW5zaXRpb246IG91dGVyVHJhbnNpdGlvbiB9fVxuICAgICAgICA+XG4gICAgICAgICAgPGRpdlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiZDMtY3ViZVwiXG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAvLyBDb21wb3VuZCByb3RhdGlvbjogaW5uZXIgY3ViZSByb3RhdGlvbiBicmluZ3MgdGhlIHJvbGxlZCBmYWNlIHRvICtaIChmcm9udCksXG4gICAgICAgICAgICAgIC8vIHRoZW4gYSBTVEFUSUMgZ2VudGxlIDMvNC12aWV3IHRpbHQgKC0yMsKwWCwgKzIywrBZKSBpcyBhcHBsaWVkIG9uIHRvcCBzbyBldmVyeVxuICAgICAgICAgICAgICAvLyByb2xsZWQgdmFsdWUgbGFuZHMgYXQgdGhlIHNhbWUgY2h1bmt5IDNEIGFuZ2xlIHdpdGggdGhlIHJvbGxlZCBmYWNlIGRvbWluYW50XG4gICAgICAgICAgICAgIC8vIGFuZCBuZWlnaGJvcnMgKHRvcCArIHJpZ2h0KSB2aXNpYmxlIGFzIHNsaW0gc3RyaXBzIOKAlCB0aGUgY2xhc3NpYyAzRCBkaWUgbG9vay5cbiAgICAgICAgICAgICAgdHJhbnNmb3JtOiBgdHJhbnNsYXRlM2QoJHtjdXJyZW50Um90LnR4fXB4LCAke2N1cnJlbnRSb3QudHkgLSBjdXJyZW50Um90LmJvdW5jZX1weCwgMCkgcm90YXRlWCgtMjJkZWcpIHJvdGF0ZVkoMjJkZWcpIHJvdGF0ZVgoJHtjdXJyZW50Um90Lnh9ZGVnKSByb3RhdGVZKCR7Y3VycmVudFJvdC55fWRlZylgLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8RmFjZSBmYWNlVmFsPXsxfSB0cmFuc2Zvcm09XCJ0cmFuc2xhdGVaKHZhcigtLWhhbGYpKVwiLz5cbiAgICAgICAgICAgIDxGYWNlIGZhY2VWYWw9ezZ9IHRyYW5zZm9ybT1cInJvdGF0ZVkoMTgwZGVnKSB0cmFuc2xhdGVaKHZhcigtLWhhbGYpKVwiLz5cbiAgICAgICAgICAgIDxGYWNlIGZhY2VWYWw9ezJ9IHRyYW5zZm9ybT1cInJvdGF0ZVkoOTBkZWcpIHRyYW5zbGF0ZVoodmFyKC0taGFsZikpXCIvPlxuICAgICAgICAgICAgPEZhY2UgZmFjZVZhbD17NX0gdHJhbnNmb3JtPVwicm90YXRlWSgtOTBkZWcpIHRyYW5zbGF0ZVoodmFyKC0taGFsZikpXCIvPlxuICAgICAgICAgICAgPEZhY2UgZmFjZVZhbD17M30gdHJhbnNmb3JtPVwicm90YXRlWCg5MGRlZykgdHJhbnNsYXRlWih2YXIoLS1oYWxmKSlcIi8+XG4gICAgICAgICAgICA8RmFjZSBmYWNlVmFsPXs0fSB0cmFuc2Zvcm09XCJyb3RhdGVYKC05MGRlZykgdHJhbnNsYXRlWih2YXIoLS1oYWxmKSlcIi8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgY2xhc3NOYW1lPVwiZDMtc2hhZG93XCJcbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgdHJhbnNmb3JtOiBgdHJhbnNsYXRlWCgtNTAlKSBzY2FsZSgke3NoYWRvd1NjYWxlfSlgLFxuICAgICAgICAgICAgb3BhY2l0eTogc2hhZG93T3BhY2l0eSxcbiAgICAgICAgICAgIGZpbHRlcjogYGJsdXIoJHtzaGFkb3dCbHVyfXB4KWAsXG4gICAgICAgICAgfX1cbiAgICAgICAgLz5cbiAgICAgIDwvZGl2PlxuICAgICAgPHN0eWxlPntgXG4gICAgICAgIC5kaWNlM2Qge1xuICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgIGFzcGVjdC1yYXRpbzogMS8xO1xuICAgICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICAgICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgICBwYWRkaW5nOiAwO1xuICAgICAgICAgIGN1cnNvcjogZ3JhYjtcbiAgICAgICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICAgICAgLS1zaXplOiAxMDVweDtcbiAgICAgICAgICAtLWhhbGY6IDUyLjVweDtcbiAgICAgICAgICB0b3VjaC1hY3Rpb246IG5vbmU7XG4gICAgICAgICAgLXdlYmtpdC11c2VyLXNlbGVjdDogbm9uZTtcbiAgICAgICAgICB1c2VyLXNlbGVjdDogbm9uZTtcbiAgICAgICAgfVxuICAgICAgICAuZGljZTNkLmdyYWJiaW5nIHsgY3Vyc29yOiBncmFiYmluZzsgfVxuICAgICAgICAuZGljZTNkLnBoeXNpY3MsIC5kaWNlM2QuZ3JhYmJpbmcgeyB6LWluZGV4OiAxMDAwOyB9XG4gICAgICAgIC8qIENSSVRJQ0FMOiBmaWx0ZXJzIG11c3QgbGl2ZSBvbiAuZGljZTNkICh0cmFuc2Zvcm0tc3R5bGU6IGZsYXQpLCBOT1Qgb24gLmQzLWN1YmUuXG4gICAgICAgICAgIENTUyBmaWx0ZXJzIG9uIGEgcHJlc2VydmUtM2QgZWxlbWVudCBmbGF0dGVuIGl0cyAzRCBzdWJ0cmVlIOKAlCB0aGUgY3ViZSBjb2xsYXBzZXNcbiAgICAgICAgICAgaW50byBhIDJEIGxlbnMtc2hhcGUuIEFwcGx5IGZpbHRlciB0byB0aGUgZmxhdCBidXR0b24gd3JhcHBlciBzbyBpdCBjb21wb3NpdGVzIHRoZVxuICAgICAgICAgICBhbHJlYWR5LXJlbmRlcmVkIDNEIGN1YmUgYXMgYSAyRCBsYXllci4gKi9cbiAgICAgICAgLmRpY2UzZC5yZXN0aW5nIHsgZmlsdGVyOiBkcm9wLXNoYWRvdygwIDEwcHggMjJweCByZ2JhKDAsMCwwLDAuMzUpKSBicmlnaHRuZXNzKDEuMDIpOyB9XG4gICAgICAgIC5kaWNlM2QuaW1wYWN0IHsgYW5pbWF0aW9uOiBjdWJlLWltcGFjdC1mbGFzaCAxODBtcyBlYXNlLW91dDsgfVxuICAgICAgICBAa2V5ZnJhbWVzIGN1YmUtaW1wYWN0LWZsYXNoIHtcbiAgICAgICAgICAwJSB7IGZpbHRlcjogYnJpZ2h0bmVzcygxKSBkcm9wLXNoYWRvdygwIDRweCA4cHggcmdiYSgwLDAsMCwwLjIpKTsgfVxuICAgICAgICAgIDMwJSB7IGZpbHRlcjogYnJpZ2h0bmVzcygxLjE4KSBkcm9wLXNoYWRvdygwIDhweCAxNnB4IHJnYmEoMjMyLDE3OCw2MiwwLjU1KSkgZHJvcC1zaGFkb3coMCAwIDhweCByZ2JhKDI1NSwyNTUsMjU1LDAuNikpOyB9XG4gICAgICAgICAgMTAwJSB7IGZpbHRlcjogYnJpZ2h0bmVzcygxKSBkcm9wLXNoYWRvdygwIDRweCA4cHggcmdiYSgwLDAsMCwwLjIpKTsgfVxuICAgICAgICB9XG4gICAgICAgIC5kaWNlM2Q6ZGlzYWJsZWQgeyBjdXJzb3I6IG5vdC1hbGxvd2VkOyBvcGFjaXR5OiAwLjc1OyB9XG4gICAgICAgIC5kaWNlM2Q6bm90KDpkaXNhYmxlZCk6bm90KC5yb2xsaW5nKTpub3QoLmdyYWJiaW5nKTpub3QoLnBoeXNpY3MpOm5vdCguaW1wYWN0KSB7XG4gICAgICAgICAgYW5pbWF0aW9uOiBkaWNlLWlsbHVtaW5hdGUgMi42cyBlYXNlLWluLW91dCBpbmZpbml0ZTtcbiAgICAgICAgfVxuICAgICAgICBAa2V5ZnJhbWVzIGRpY2UtaWxsdW1pbmF0ZSB7XG4gICAgICAgICAgMCUsIDEwMCUge1xuICAgICAgICAgICAgZmlsdGVyOlxuICAgICAgICAgICAgICBkcm9wLXNoYWRvdygwIDhweCAxNHB4IHJnYmEoMCwwLDAsMC4yNCkpXG4gICAgICAgICAgICAgIGRyb3Atc2hhZG93KDAgMCAxNHB4IHJnYmEoMjMyLDE3OCw2MiwwLjI4KSlcbiAgICAgICAgICAgICAgYnJpZ2h0bmVzcygxLjA0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgNTAlIHtcbiAgICAgICAgICAgIGZpbHRlcjpcbiAgICAgICAgICAgICAgZHJvcC1zaGFkb3coMCAxMHB4IDIwcHggcmdiYSgwLDAsMCwwLjI4KSlcbiAgICAgICAgICAgICAgZHJvcC1zaGFkb3coMCAwIDIycHggcmdiYSgyMzIsMTc4LDYyLDAuNTUpKVxuICAgICAgICAgICAgICBicmlnaHRuZXNzKDEuMDgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAuZGljZTNkLnJvbGxpbmcsIC5kaWNlM2QucGh5c2ljcyB7XG4gICAgICAgICAgZmlsdGVyOiBkcm9wLXNoYWRvdygwIDEwcHggMThweCByZ2JhKDAsMCwwLDAuMykpIGJyaWdodG5lc3MoMS4wMik7XG4gICAgICAgIH1cbiAgICAgICAgLmRpY2UzZDpob3Zlcjpub3QoOmRpc2FibGVkKSB7XG4gICAgICAgICAgZmlsdGVyOlxuICAgICAgICAgICAgZHJvcC1zaGFkb3coMCAxMHB4IDIycHggcmdiYSgwLDAsMCwwLjMyKSlcbiAgICAgICAgICAgIGRyb3Atc2hhZG93KDAgMCAyNHB4IHJnYmEoMjMyLDE3OCw2MiwwLjcpKVxuICAgICAgICAgICAgYnJpZ2h0bmVzcygxLjEyKTtcbiAgICAgICAgfVxuICAgICAgICAuZGljZTNkLmdyYWJiaW5nIHtcbiAgICAgICAgICBmaWx0ZXI6XG4gICAgICAgICAgICBkcm9wLXNoYWRvdygwIDEycHggMjZweCByZ2JhKDAsMCwwLDAuMzUpKVxuICAgICAgICAgICAgZHJvcC1zaGFkb3coMCAwIDI4cHggcmdiYSgyMzIsODgsNjIsMC42NSkpXG4gICAgICAgICAgICBicmlnaHRuZXNzKDEuMTQpO1xuICAgICAgICB9XG4gICAgICAgIC5kMy10aHJvdyB7XG4gICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgICAgIGluc2V0OiAwO1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgIHRyYW5zZm9ybS1zdHlsZTogcHJlc2VydmUtM2Q7XG4gICAgICAgICAgd2lsbC1jaGFuZ2U6IHRyYW5zZm9ybTtcbiAgICAgICAgfVxuICAgICAgICAuZDMtc2NlbmUge1xuICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICBpbnNldDogMDtcbiAgICAgICAgICAvKiBQZXJzcGVjdGl2ZSDiiYg1w5cgY3ViZSBzaXplIGdpdmVzIGEgcGxlYXNhbnQgY2h1bmt5IDNEIGxvb2sgd2l0aG91dCBoZWF2eSBkaXN0b3J0aW9uLlxuICAgICAgICAgICAgIHByZXNlcnZlLTNkIGlzIHJlcXVpcmVkIHNvIHRoZSBjdWJlJ3MgZmFjZXMgcmVuZGVyIGluIHRydWUgM0QgKG90aGVyd2lzZSBuZXN0ZWRcbiAgICAgICAgICAgICB0cmFuc2Zvcm0tc3R5bGU6IGZsYXQgY29sbGFwc2VzIHRoZSBjdWJlIGludG8gYSB0aGluIHByb2plY3RlZCByaG9tYnVzKS4gKi9cbiAgICAgICAgICBwZXJzcGVjdGl2ZTogODAwcHg7XG4gICAgICAgICAgcGVyc3BlY3RpdmUtb3JpZ2luOiA1MCUgNTAlO1xuICAgICAgICAgIHRyYW5zZm9ybS1zdHlsZTogcHJlc2VydmUtM2Q7XG4gICAgICAgICAgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgLmQzLWN1YmUge1xuICAgICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgICAgICB3aWR0aDogdmFyKC0tc2l6ZSk7XG4gICAgICAgICAgaGVpZ2h0OiB2YXIoLS1zaXplKTtcbiAgICAgICAgICB0cmFuc2Zvcm0tc3R5bGU6IHByZXNlcnZlLTNkO1xuICAgICAgICAgIHdpbGwtY2hhbmdlOiB0cmFuc2Zvcm07XG4gICAgICAgIH1cbiAgICAgICAgLmQzLWZhY2Uge1xuICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICBpbnNldDogMDtcbiAgICAgICAgICB3aWR0aDogdmFyKC0tc2l6ZSk7XG4gICAgICAgICAgaGVpZ2h0OiB2YXIoLS1zaXplKTtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiAyMCU7XG4gICAgICAgICAgLyogU3Ryb25nIGJldmVsZWQgZWRnZXMg4oCUIGRhcmsgb3V0ZXIgcmltICsgYnJpZ2h0IGlubmVyIGhpZ2hsaWdodCBtYWtlcyBlYWNoIGZhY2VcbiAgICAgICAgICAgICByZWFkIGFzIGEgZGlzdGluY3QgcGxhbmUgd2l0aCBhIHByb25vdW5jZWQgY29ybmVyIHdoZXJlIGl0IG1lZXRzIGl0cyBuZWlnaGJvci5cbiAgICAgICAgICAgICBDcml0aWNhbCBmb3IgM0QgcmVhZDogd2l0aG91dCB0aGlzLCBhZGphY2VudCBmYWNlcyB2aXNpYmxlIGF0IHNpbWlsYXIgYW5nbGVzXG4gICAgICAgICAgICAgYmx1ciBpbnRvIG9uZSBmbGF0IHN1cmZhY2UuICovXG4gICAgICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgICAgIGluc2V0IDAgMCAwIDJweCByZ2JhKDcwLDQ1LDE1LDAuNzApLFxuICAgICAgICAgICAgaW5zZXQgMCAwIDAgNHB4IHJnYmEoMjU1LDI1MCwyMzUsMC45NSksXG4gICAgICAgICAgICBpbnNldCAwIC0xMnB4IDIycHggcmdiYSgxMTAsNzUsMzAsMC41NSksXG4gICAgICAgICAgICBpbnNldCAxMHB4IDAgMjBweCByZ2JhKDExMCw3NSwzMCwwLjMyKSxcbiAgICAgICAgICAgIGluc2V0IC0xMHB4IDAgMjBweCByZ2JhKDExMCw3NSwzMCwwLjMyKSxcbiAgICAgICAgICAgIGluc2V0IDAgOHB4IDE0cHggcmdiYSgyNTUsMjUyLDI0MCwwLjk1KTtcbiAgICAgICAgICBiYWNrZmFjZS12aXNpYmlsaXR5OiBoaWRkZW47XG4gICAgICAgICAgcGFkZGluZzogMTElO1xuICAgICAgICB9XG4gICAgICAgIC8qIEZhY2Ugc2hhZGluZyBieSBwYWlyIOKAlCBvcHBvc2l0ZSBmYWNlcyBzaGFyZSBhIHRpbnQsIGJ1dCB0aGUgdGhyZWUgZmFjZXMgdmlzaWJsZSBhdFxuICAgICAgICAgICBhbnkgbW9tZW50IGFsd2F5cyBoYXZlIHRocmVlIGRpc3RpbmN0IGJyaWdodG5lc3Nlcy4gVGhpcyBkaWZmZXJlbnRpYWwgc2hhZGluZyBpcyB0aGVcbiAgICAgICAgICAgc2luZ2xlIGJpZ2dlc3QgM0QgY3VlOiB3aXRob3V0IGl0IHRoZSBjdWJlIHJlYWRzIGFzIGEgZmxhdCByb3VuZGVkIHJob21idXMuICovXG4gICAgICAgIC5kMy1mYWNlLnNoYWRlLWJyaWdodGVyIHtcbiAgICAgICAgICBiYWNrZ3JvdW5kOlxuICAgICAgICAgICAgcmFkaWFsLWdyYWRpZW50KGVsbGlwc2UgYXQgMjglIDIyJSwgcmdiYSgyNTUsMjU1LDI1NSwwLjk1KSAwJSwgcmdiYSgyNTUsMjU1LDI1NSwwKSA0MiUpLFxuICAgICAgICAgICAgbGluZWFyLWdyYWRpZW50KDE1NWRlZywgI2ZmZmZmZiAwJSwgI2ZjZjZlNCA1NSUsICNlZGUxYmYgMTAwJSk7XG4gICAgICAgIH1cbiAgICAgICAgLmQzLWZhY2Uuc2hhZGUtbWVkaXVtIHtcbiAgICAgICAgICBiYWNrZ3JvdW5kOlxuICAgICAgICAgICAgcmFkaWFsLWdyYWRpZW50KGVsbGlwc2UgYXQgMjglIDIyJSwgcmdiYSgyNTUsMjU1LDI1NSwwLjgyKSAwJSwgcmdiYSgyNTUsMjU1LDI1NSwwKSA0MCUpLFxuICAgICAgICAgICAgbGluZWFyLWdyYWRpZW50KDE1NWRlZywgI2ZjZjdlNiAwJSwgI2VlZTFjMCA2MCUsICNkNGMzOWEgMTAwJSk7XG4gICAgICAgIH1cbiAgICAgICAgLmQzLWZhY2Uuc2hhZGUtZGFya2VyIHtcbiAgICAgICAgICBiYWNrZ3JvdW5kOlxuICAgICAgICAgICAgcmFkaWFsLWdyYWRpZW50KGVsbGlwc2UgYXQgMjglIDIyJSwgcmdiYSgyNTUsMjU1LDI1NSwwLjY1KSAwJSwgcmdiYSgyNTUsMjU1LDI1NSwwKSAzOCUpLFxuICAgICAgICAgICAgbGluZWFyLWdyYWRpZW50KDE1NWRlZywgI2VlZTFjMCAwJSwgI2Q5Yzk5ZiA2MCUsICNiOWE1NzggMTAwJSk7XG4gICAgICAgIH1cbiAgICAgICAgLmQzLXBpcHMge1xuICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgIGhlaWdodDogMTAwJTtcbiAgICAgICAgICBkaXNwbGF5OiBncmlkO1xuICAgICAgICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogcmVwZWF0KDMsIDFmcik7XG4gICAgICAgICAgZ3JpZC10ZW1wbGF0ZS1yb3dzOiByZXBlYXQoMywgMWZyKTtcbiAgICAgICAgICBwbGFjZS1pdGVtczogY2VudGVyO1xuICAgICAgICB9XG4gICAgICAgIC5kMy1waXAge1xuICAgICAgICAgIHdpZHRoOiA3MiU7XG4gICAgICAgICAgYXNwZWN0LXJhdGlvOiAxLzE7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgICAgIC8qIERyaWxsZWQtcGlwIGxvb2s6IGRhcmsgc3BoZXJlIHdpdGggc3VidGxlIGJsdWUtZ3JleSB0b3AgaGlnaGxpZ2h0IHNvIHBpcHMgcmVhZCBhc1xuICAgICAgICAgICAgIHJlY2Vzc2VkIHdlbGxzLCBub3QgcGFpbnRlZCBkb3RzLiAqL1xuICAgICAgICAgIGJhY2tncm91bmQ6IHJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgMzglIDMyJSwgIzVhNjY4MiAwJSwgIzFjMjEzMCA1NSUsICMwYTBkMTcgMTAwJSk7XG4gICAgICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgICAgIGluc2V0IDAgLTJweCAzcHggcmdiYSgyNTUsMjU1LDI1NSwwLjE0KSxcbiAgICAgICAgICAgIGluc2V0IDAgM3B4IDVweCByZ2JhKDAsMCwwLDAuNiksXG4gICAgICAgICAgICAwIDAuNXB4IDFweCByZ2JhKDI1NSwyNTAsMjM1LDAuODUpO1xuICAgICAgICB9XG4gICAgICAgIC5kMy1zaGFkb3cge1xuICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICBib3R0b206IDQlO1xuICAgICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgICB3aWR0aDogNzIlO1xuICAgICAgICAgIGhlaWdodDogMTAlO1xuICAgICAgICAgIGJhY2tncm91bmQ6IHJhZGlhbC1ncmFkaWVudChlbGxpcHNlIGF0IGNlbnRlciwgcmdiYSgyNiwzMSw0NiwwLjU1KSAwJSwgcmdiYSgyNiwzMSw0NiwwKSA3MCUpO1xuICAgICAgICAgIGZpbHRlcjogYmx1cigzcHgpO1xuICAgICAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4xcztcbiAgICAgICAgfVxuICAgICAgYH08L3N0eWxlPlxuICAgIDwvYnV0dG9uPlxuICApO1xufVxuXG53aW5kb3cuRGljZSA9IERpY2U7XG5cblxuLy8gPT09IG1vZGVzZWxlY3QuanN4ID09PVxuLy8gTW9kZSBzZWxlY3Rpb24gc2NyZWVuXG5cbmNvbnN0IFBMQVlFUl9DT0xPUlMgPSBbJyNlODU4M2UnLCAnIzJhOGE1ZicsICcjZThiMjNlJywgJyM1YjZjZmYnLCAnI2E4NTVhMCcsICcjZmY4YTNkJywgJyM2ZDRhMmUnLCAnIzFhYzBjNiddO1xuY29uc3QgREVGQVVMVF9OQU1FUyA9IFsnUnVieScsICdTYWdlJywgJ1N1bm55JywgJ0luZGllJywgJ01hdXZlJywgJ0VtYmVyJywgJ0NvY28nLCAnQXF1YSddO1xuXG5mdW5jdGlvbiBNb2RlU2VsZWN0KHsgb25TdGFydCB9KSB7XG4gIGNvbnN0IFttb2RlLCBzZXRNb2RlXSA9IFJlYWN0LnVzZVN0YXRlKG51bGwpOyAvLyAnbXVsdGknIHwgJ2FpJ1xuICBjb25zdCBbaHVtYW5Db3VudCwgc2V0SHVtYW5Db3VudF0gPSBSZWFjdC51c2VTdGF0ZSgyKTtcbiAgY29uc3QgW2FpRGlmZmljdWx0eSwgc2V0QWlEaWZmaWN1bHR5XSA9IFJlYWN0LnVzZVN0YXRlKCdub3JtYWwnKTtcbiAgY29uc3QgW3BsYXllck5hbWUsIHNldFBsYXllck5hbWVdID0gUmVhY3QudXNlU3RhdGUoJ1lvdScpO1xuICBjb25zdCBbbmFtZXMsIHNldE5hbWVzXSA9IFJlYWN0LnVzZVN0YXRlKFsuLi5ERUZBVUxUX05BTUVTXSk7XG4gIC8vIG9uZSBjaGFyYWN0ZXIgcGVyIHNsb3Q7IGRlZmF1bHQgdG8gZmlyc3QgTiBkaXN0aW5jdFxuICBjb25zdCBbY2hhcnMsIHNldENoYXJzXSA9IFJlYWN0LnVzZVN0YXRlKENIQVJBQ1RFUlMuc2xpY2UoMCwgOCkubWFwKGMgPT4gYy5pZCkpO1xuICBjb25zdCBbbXlDaGFyLCBzZXRNeUNoYXJdID0gUmVhY3QudXNlU3RhdGUoQ0hBUkFDVEVSU1swXS5pZCk7XG5cbiAgY29uc3QgY29sb3JGb3IgPSAoY2lkKSA9PiAoQ0hBUkFDVEVSUy5maW5kKGMgPT4gYy5pZCA9PT0gY2lkKSB8fCBDSEFSQUNURVJTWzBdKS5jb2xvcjtcblxuICBjb25zdCBzdGFydCA9ICgpID0+IHtcbiAgICBpZiAobW9kZSA9PT0gJ2FpJykge1xuICAgICAgb25TdGFydCh7XG4gICAgICAgIHBsYXllcnM6IFtcbiAgICAgICAgICB7IGlkOiAncDAnLCBuYW1lOiBwbGF5ZXJOYW1lIHx8ICdZb3UnLCBsYWJlbDogKHBsYXllck5hbWUgfHwgJ1knKVswXS50b1VwcGVyQ2FzZSgpLCBjb2xvcjogY29sb3JGb3IobXlDaGFyKSwgY2hhcklkOiBteUNoYXIsIGlzQUk6IGZhbHNlIH0sXG4gICAgICAgICAgeyBpZDogJ2FpJywgbmFtZTogJ0JMSVAnLCBsYWJlbDogJ0FJJywgY29sb3I6ICcjMWExZjJlJywgY2hhcklkOiBudWxsLCBpc0FJOiB0cnVlIH0sXG4gICAgICAgIF0sXG4gICAgICAgIGFpRGlmZmljdWx0eSxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBwbGF5ZXJzID0gQXJyYXkuZnJvbSh7IGxlbmd0aDogaHVtYW5Db3VudCB9LCAoXywgaSkgPT4gKHtcbiAgICAgICAgaWQ6ICdwJyArIGksXG4gICAgICAgIG5hbWU6IG5hbWVzW2ldIHx8IGBQbGF5ZXIgJHtpICsgMX1gLFxuICAgICAgICBsYWJlbDogKG5hbWVzW2ldIHx8IGBQJHtpKzF9YClbMF0udG9VcHBlckNhc2UoKSxcbiAgICAgICAgY29sb3I6IGNvbG9yRm9yKGNoYXJzW2ldKSxcbiAgICAgICAgY2hhcklkOiBjaGFyc1tpXSxcbiAgICAgICAgaXNBSTogZmFsc2UsXG4gICAgICB9KSk7XG4gICAgICBvblN0YXJ0KHsgcGxheWVycyB9KTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3Qgc2V0Q2hhckF0ID0gKGlkeCwgbmV3Q2lkKSA9PiB7XG4gICAgc2V0Q2hhcnMocHJldiA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gWy4uLnByZXZdO1xuICAgICAgLy8gaWYgYW5vdGhlciBzbG90IGFscmVhZHkgaGFzIHRoaXMgY2hhciwgc3dhcFxuICAgICAgY29uc3QgZHVwSWR4ID0gbmV4dC5pbmRleE9mKG5ld0NpZCk7XG4gICAgICBpZiAoZHVwSWR4ICE9PSAtMSAmJiBkdXBJZHggIT09IGlkeCkgbmV4dFtkdXBJZHhdID0gbmV4dFtpZHhdO1xuICAgICAgbmV4dFtpZHhdID0gbmV3Q2lkO1xuICAgICAgcmV0dXJuIG5leHQ7XG4gICAgfSk7XG4gIH07XG5cbiAgY29uc3QgY3ljbGVDaGFyID0gKGlkeCwgZGlyKSA9PiB7XG4gICAgY29uc3QgY3VyID0gY2hhcnNbaWR4XTtcbiAgICBjb25zdCBpID0gQ0hBUkFDVEVSUy5maW5kSW5kZXgoYyA9PiBjLmlkID09PSBjdXIpO1xuICAgIGNvbnN0IG4gPSAoaSArIGRpciArIENIQVJBQ1RFUlMubGVuZ3RoKSAlIENIQVJBQ1RFUlMubGVuZ3RoO1xuICAgIHNldENoYXJBdChpZHgsIENIQVJBQ1RFUlNbbl0uaWQpO1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJtcy13cmFwXCI+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1zLWlubmVyXCI+XG4gICAgICAgIDxoZWFkZXIgY2xhc3NOYW1lPVwibXMtaGVhZGVyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtcy1leWVicm93IG1vbm9cIj4wMSDigJQgTkVXIEdBTUU8L2Rpdj5cbiAgICAgICAgICA8aDEgY2xhc3NOYW1lPVwibXMtdGl0bGUgc2VyaWZcIj5cbiAgICAgICAgICAgIENsaW1iIDxzcGFuIGNsYXNzTmFtZT1cImNsaW1iXCI+4oaRPC9zcGFuPlxuICAgICAgICAgICAgPGJyLz5cbiAgICAgICAgICAgICYgU2xpZGUgPHNwYW4gY2xhc3NOYW1lPVwic2xpZGVcIj7ihpM8L3NwYW4+XG4gICAgICAgICAgPC9oMT5cbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJtcy1zdWJcIj5BIG1vZGVybiB0YWtlIG9uIGEgY2xhc3NpYyByYWNlLiBSb2xsIGRpY2UsIHJpZGUgbGFkZGVycywgZG9kZ2UgY2h1dGVzLiBGaXJzdCB0byAxMDAgd2lucy48L3A+XG4gICAgICAgIDwvaGVhZGVyPlxuXG4gICAgICAgIHshbW9kZSAmJiAoXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtcy1tb2Rlc1wiPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzc05hbWU9XCJtcy1tb2RlLWNhcmRcIiBvbkNsaWNrPXsoKSA9PiBzZXRNb2RlKCdtdWx0aScpfT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtcy1tb2RlLWljb25cIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInN0YWNrXCI+XG4gICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17e2JhY2tncm91bmQ6JyNlODU4M2UnfX0vPlxuICAgICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3tiYWNrZ3JvdW5kOicjMmE4YTVmJ319Lz5cbiAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPXt7YmFja2dyb3VuZDonI2U4YjIzZSd9fS8+XG4gICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17e2JhY2tncm91bmQ6JyM1YjZjZmYnfX0vPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1zLW1vZGUtdGl0bGUgc2VyaWZcIj5QYXNzICYgUGxheTwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXMtbW9kZS1kZXNjXCI+MuKAkzggaHVtYW5zIG9uIG9uZSBkZXZpY2U8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXMtbW9kZS1hcnJvd1wiPuKGkjwvZGl2PlxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cIm1zLW1vZGUtY2FyZFwiIG9uQ2xpY2s9eygpID0+IHNldE1vZGUoJ2FpJyl9PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1zLW1vZGUtaWNvblwiPlxuICAgICAgICAgICAgICAgIDxSb2JvdCBzaXplPXs2NH0gY29sb3I9XCIjMWExZjJlXCIgbW9vZD1cImhhcHB5XCIvPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1zLW1vZGUtdGl0bGUgc2VyaWZcIj5QbGF5IEJMSVA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1zLW1vZGUtZGVzY1wiPllvdSB2cy4gb3VyIGZyaWVuZGx5IHJvYm90PC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1zLW1vZGUtYXJyb3dcIj7ihpI8L2Rpdj5cbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApfVxuXG4gICAgICAgIHttb2RlID09PSAnbXVsdGknICYmIChcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1zLWNvbmZpZ1wiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtcy1maWVsZFwiPlxuICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwibW9ub1wiPkhPVyBNQU5ZIFBMQVlFUlM8L2xhYmVsPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1zLWNoaXBzXCI+XG4gICAgICAgICAgICAgICAge1syLDMsNCw1LDYsNyw4XS5tYXAobiA9PiAoXG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIGtleT17bn1cbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgY2hpcCAke2h1bWFuQ291bnQgPT09IG4gPyAnYWN0aXZlJyA6ICcnfWB9XG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldEh1bWFuQ291bnQobil9XG4gICAgICAgICAgICAgICAgICA+e259PC9idXR0b24+XG4gICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1zLWZpZWxkXCI+XG4gICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJtb25vXCI+UExBWUVSUyAmIENIQVJBQ1RFUlM8L2xhYmVsPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1zLXBsYXllcnNcIj5cbiAgICAgICAgICAgICAgICB7QXJyYXkuZnJvbSh7bGVuZ3RoOiBodW1hbkNvdW50fSkubWFwKChfLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgICA8ZGl2IGtleT17aX0gY2xhc3NOYW1lPVwibXMtcGxheWVyLXJvdyBzZXR1cC1yb3dcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjaGFyLXBpY2tlclwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwiY3AtYXJyb3dcIiBvbkNsaWNrPXsoKSA9PiBjeWNsZUNoYXIoaSwgLTEpfSBhcmlhLWxhYmVsPVwiUHJldmlvdXNcIj7igLk8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNwLXN0YWdlXCIgc3R5bGU9e3sgYmFja2dyb3VuZDogY29sb3JGb3IoY2hhcnNbaV0pICsgJzIyJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxDaGFyYWN0ZXIgY2hhcklkPXtjaGFyc1tpXX0gc2l6ZT17NTZ9IHNwaW4vPlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwiY3AtYXJyb3dcIiBvbkNsaWNrPXsoKSA9PiBjeWNsZUNoYXIoaSwgMSl9IGFyaWEtbGFiZWw9XCJOZXh0XCI+4oC6PC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNldHVwLXJpZ2h0XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj17YFBsYXllciAke2krMX1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgYXJpYS1sYWJlbD17YE5hbWUgZm9yIHBsYXllciAke2krMX1gfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e25hbWVzW2ldfVxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4TGVuZ3RoPXsxMH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV4dCA9IFsuLi5uYW1lc107XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRbaV0gPSBlLnRhcmdldC52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0TmFtZXMobmV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjaGFyLW5hbWUgbW9ub1wiPnsoQ0hBUkFDVEVSUy5maW5kKGMgPT4gYy5pZCA9PT0gY2hhcnNbaV0pIHx8IHt9KS5uYW1lPy50b1VwcGVyQ2FzZSgpfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtcy1hY3Rpb25zXCI+XG4gICAgICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwiYnRuIGdob3N0XCIgb25DbGljaz17KCkgPT4gc2V0TW9kZShudWxsKX0+4oaQIEJhY2s8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzc05hbWU9XCJidG4gcHJpbWFyeVwiIG9uQ2xpY2s9e3N0YXJ0fT5TdGFydCBnYW1lIOKGkjwvYnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICl9XG5cbiAgICAgICAge21vZGUgPT09ICdhaScgJiYgKFxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXMtY29uZmlnXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1zLWFpLWNhcmRcIj5cbiAgICAgICAgICAgICAgPFJvYm90IHNpemU9ezk2fSBjb2xvcj1cIiMxYTFmMmVcIiBtb29kPVwiaGFwcHlcIi8+XG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtcy1haS1uYW1lIHNlcmlmXCI+QkxJUDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXMtYWktdGFnbGluZSBtb25vXCI+Ly8gYSBmcmllbmRseSByb2xsaW5nIGJvdDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXMtYWktcXVvdGVcIj5cIkJlZXAgYm9vcCDigJQgbWF5IHRoZSBiZXN0IGNsaW1iZXIgd2luISBJIHByb21pc2UgdG8gY2hlZXIgd2hlbiB5b3UgZG9kZ2UgYSBjaHV0ZS5cIjwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtcy1maWVsZFwiPlxuICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwibW9ub1wiPllPVVIgTkFNRSAmIENIQVJBQ1RFUjwvbGFiZWw+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWktbmFtZS1yb3dcIj5cbiAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cIm1zLW5hbWUtaW5wdXRcIlxuICAgICAgICAgICAgICAgICAgdHlwZT1cInRleHRcIlxuICAgICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIllvdXIgZGlzcGxheSBuYW1lXCJcbiAgICAgICAgICAgICAgICAgIHZhbHVlPXtwbGF5ZXJOYW1lfVxuICAgICAgICAgICAgICAgICAgbWF4TGVuZ3RoPXsxMn1cbiAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IHNldFBsYXllck5hbWUoZS50YXJnZXQudmFsdWUpfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNoYXItZ2FsbGVyeVwiPlxuICAgICAgICAgICAgICAgIHtDSEFSQUNURVJTLm1hcChjID0+IChcbiAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAga2V5PXtjLmlkfVxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2BjaGFyLXRpbGUgJHtteUNoYXIgPT09IGMuaWQgPyAnYWN0aXZlJyA6ICcnfWB9XG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldE15Q2hhcihjLmlkKX1cbiAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgJy0tY2NvbG9yJzogYy5jb2xvciB9fVxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICA8Q2hhcmFjdGVyIGNoYXJJZD17Yy5pZH0gc2l6ZT17NTZ9IHNwaW49e215Q2hhciA9PT0gYy5pZH0vPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNoYXItdGlsZS1uYW1lIG1vbm9cIj57Yy5uYW1lfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1zLWZpZWxkXCI+XG4gICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJtb25vXCI+QkxJUCdTIFBFUlNPTkFMSVRZPC9sYWJlbD5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtcy1jaGlwc1wiPlxuICAgICAgICAgICAgICAgIHtbXG4gICAgICAgICAgICAgICAgICB7IGlkOiAnZWFzeScsIGxhYmVsOiAnRnJpZW5kbHknLCBkZXNjOiAncm9sbHMgc2xvd2VyLCBjaGF0cyBtb3JlJyB9LFxuICAgICAgICAgICAgICAgICAgeyBpZDogJ25vcm1hbCcsIGxhYmVsOiAnQmFsYW5jZWQnLCBkZXNjOiAnYSBmYWlyIG1hdGNoJyB9LFxuICAgICAgICAgICAgICAgICAgeyBpZDogJ2hhcmQnLCBsYWJlbDogJ1NoYXJwJywgZGVzYzogJ3JvbGxzIHF1aWNrLCB0YWxrcyB0cmFzaCcgfSxcbiAgICAgICAgICAgICAgICBdLm1hcChkID0+IChcbiAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAga2V5PXtkLmlkfVxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2BjaGlwIHdpZGUgJHthaURpZmZpY3VsdHkgPT09IGQuaWQgPyAnYWN0aXZlJyA6ICcnfWB9XG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldEFpRGlmZmljdWx0eShkLmlkKX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4+e2QubGFiZWx9PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJjaGlwLWRlc2NcIj57ZC5kZXNjfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtcy1hY3Rpb25zXCI+XG4gICAgICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwiYnRuIGdob3N0XCIgb25DbGljaz17KCkgPT4gc2V0TW9kZShudWxsKX0+4oaQIEJhY2s8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzc05hbWU9XCJidG4gcHJpbWFyeVwiIG9uQ2xpY2s9e3N0YXJ0fT5TdGFydCBnYW1lIOKGkjwvYnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICl9XG5cbiAgICAgICAgPGZvb3RlciBjbGFzc05hbWU9XCJtcy1mb290ZXIgbW9ub1wiPlxuICAgICAgICAgIDxzcGFuPkVTVC4gMjAyNjwvc3Bhbj5cbiAgICAgICAgICA8c3Bhbj7Ctzwvc3Bhbj5cbiAgICAgICAgICA8c3Bhbj4xMDAgU1FVQVJFUzwvc3Bhbj5cbiAgICAgICAgICA8c3Bhbj7Ctzwvc3Bhbj5cbiAgICAgICAgICA8c3Bhbj4xMCBDSFVURVM8L3NwYW4+XG4gICAgICAgICAgPHNwYW4+wrc8L3NwYW4+XG4gICAgICAgICAgPHNwYW4+OCBMQURERVJTPC9zcGFuPlxuICAgICAgICA8L2Zvb3Rlcj5cbiAgICAgICAgPGFcbiAgICAgICAgICBjbGFzc05hbWU9XCJrb2ZpLWJ0blwiXG4gICAgICAgICAgaHJlZj1cImh0dHBzOi8va28tZmkuY29tL21pa2V5YWxlc3NhbmRyb1wiXG4gICAgICAgICAgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICByZWw9XCJub29wZW5lciBub3JlZmVycmVyXCJcbiAgICAgICAgPlxuICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImtvZmktaGVhcnRcIj7imaU8L3NwYW4+XG4gICAgICAgICAgPHNwYW4+RW5qb3lpbmcgdGhlIGdhbWU/IEJ1eSBtZSBhIGNvZmZlZTwvc3Bhbj5cbiAgICAgICAgPC9hPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxzdHlsZT57YFxuICAgICAgICAubXMtd3JhcCB7XG4gICAgICAgICAgaGVpZ2h0OiAxMDAlO1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICBwYWRkaW5nOiA0MHB4IDI0cHg7XG4gICAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgfVxuICAgICAgICAubXMtaW5uZXIge1xuICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgIG1heC13aWR0aDogNjQwcHg7XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgIGdhcDogMzJweDtcbiAgICAgICAgfVxuICAgICAgICAubXMtaGVhZGVyIHsgZGlzcGxheTogZmxleDsgZmxleC1kaXJlY3Rpb246IGNvbHVtbjsgZ2FwOiAxMnB4OyB9XG4gICAgICAgIC5tcy1leWVicm93IHtcbiAgICAgICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMTVlbTtcbiAgICAgICAgICBjb2xvcjogdmFyKC0tbXV0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgLm1zLXRpdGxlIHtcbiAgICAgICAgICBmb250LXNpemU6IGNsYW1wKDQ4cHgsIDh2dywgODZweCk7XG4gICAgICAgICAgbGluZS1oZWlnaHQ6IDAuOTtcbiAgICAgICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgICAgIGxldHRlci1zcGFjaW5nOiAtMC4wNGVtO1xuICAgICAgICB9XG4gICAgICAgIC5tcy10aXRsZSAuY2xpbWIgeyBjb2xvcjogdmFyKC0tYWNjZW50LTIpOyBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNHB4KTsgfVxuICAgICAgICAubXMtdGl0bGUgLnNsaWRlIHsgY29sb3I6IHZhcigtLWFjY2VudCk7IGRpc3BsYXk6IGlubGluZS1ibG9jazsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDRweCk7IH1cbiAgICAgICAgLm1zLXN1YiB7XG4gICAgICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbmstMik7XG4gICAgICAgICAgbWF4LXdpZHRoOiA0NDBweDtcbiAgICAgICAgICBsaW5lLWhlaWdodDogMS41O1xuICAgICAgICB9XG4gICAgICAgIC5tcy1tb2RlcyB7XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgIGdhcDogMTJweDtcbiAgICAgICAgfVxuICAgICAgICAubXMtbW9kZS1jYXJkIHtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgZ2FwOiAyMHB4O1xuICAgICAgICAgIHBhZGRpbmc6IDIwcHggMjRweDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI2LDMxLDQ2LDAuMDgpO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDE2cHg7XG4gICAgICAgICAgdGV4dC1hbGlnbjogbGVmdDtcbiAgICAgICAgICB0cmFuc2l0aW9uOiBhbGwgMC4ycztcbiAgICAgICAgICBib3gtc2hhZG93OiAwIDFweCAwIHJnYmEoMjYsMzEsNDYsMC4wMyksIDAgNHB4IDEycHggLTZweCByZ2JhKDI2LDMxLDQ2LDAuMDgpO1xuICAgICAgICB9XG4gICAgICAgIC5tcy1tb2RlLWNhcmQ6aG92ZXIge1xuICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMnB4KTtcbiAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWluayk7XG4gICAgICAgICAgYm94LXNoYWRvdzogMCA0cHggMCByZ2JhKDI2LDMxLDQ2LDAuMDgpLCAwIDhweCAyMHB4IC02cHggcmdiYSgyNiwzMSw0NiwwLjIpO1xuICAgICAgICB9XG4gICAgICAgIC5tcy1tb2RlLWljb24ge1xuICAgICAgICAgIHdpZHRoOiA3MnB4O1xuICAgICAgICAgIGhlaWdodDogNzJweDtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xuICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJnLTIpO1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgfVxuICAgICAgICAubXMtbW9kZS10aXRsZSB7IGZvbnQtc2l6ZTogMjJweDsgZm9udC13ZWlnaHQ6IDcwMDsgfVxuICAgICAgICAubXMtbW9kZS1kZXNjIHsgY29sb3I6IHZhcigtLW11dGUpOyBmb250LXNpemU6IDE0cHg7IG1hcmdpbi10b3A6IDJweDsgfVxuICAgICAgICAubXMtbW9kZS1hcnJvdyB7XG4gICAgICAgICAgbWFyZ2luLWxlZnQ6IGF1dG87XG4gICAgICAgICAgZm9udC1zaXplOiAyMnB4O1xuICAgICAgICAgIGNvbG9yOiB2YXIoLS1tdXRlKTtcbiAgICAgICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4ycztcbiAgICAgICAgfVxuICAgICAgICAubXMtbW9kZS1jYXJkOmhvdmVyIC5tcy1tb2RlLWFycm93IHtcbiAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoNHB4KTtcbiAgICAgICAgICBjb2xvcjogdmFyKC0taW5rKTtcbiAgICAgICAgfVxuICAgICAgICAuc3RhY2sge1xuICAgICAgICAgIGRpc3BsYXk6IGdyaWQ7XG4gICAgICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiAxZnIgMWZyO1xuICAgICAgICAgIGdhcDogM3B4O1xuICAgICAgICAgIHdpZHRoOiA0MHB4OyBoZWlnaHQ6IDQwcHg7XG4gICAgICAgIH1cbiAgICAgICAgLnN0YWNrIHNwYW4ge1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgICAgICAgICBib3gtc2hhZG93OiBpbnNldCAwIDJweCAycHggcmdiYSgyNTUsMjU1LDI1NSwwLjQpLCBpbnNldCAwIC0ycHggMnB4IHJnYmEoMCwwLDAsMC4xNSk7XG4gICAgICAgIH1cbiAgICAgICAgLm1zLWNvbmZpZyB7XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgIGdhcDogMjRweDtcbiAgICAgICAgICBwYWRkaW5nOiAyOHB4O1xuICAgICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNiwzMSw0NiwwLjA4KTtcbiAgICAgICAgfVxuICAgICAgICAubXMtZmllbGQgeyBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBnYXA6IDEwcHg7IH1cbiAgICAgICAgLm1zLWZpZWxkIGxhYmVsIHtcbiAgICAgICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMTVlbTtcbiAgICAgICAgICBjb2xvcjogdmFyKC0tbXV0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgLm1zLWNoaXBzIHsgZGlzcGxheTogZmxleDsgZ2FwOiA4cHg7IGZsZXgtd3JhcDogd3JhcDsgfVxuICAgICAgICAuY2hpcCB7XG4gICAgICAgICAgcGFkZGluZzogMTBweCAxNnB4O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctMik7XG4gICAgICAgICAgY29sb3I6IHZhcigtLWluayk7XG4gICAgICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgICAgICBmb250LXNpemU6IDE1cHg7XG4gICAgICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMTVzO1xuICAgICAgICAgIGJvcmRlcjogMS41cHggc29saWQgdHJhbnNwYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgLmNoaXA6aG92ZXIgeyBiYWNrZ3JvdW5kOiAjZTBkNmJmOyB9XG4gICAgICAgIC5jaGlwLmFjdGl2ZSB7XG4gICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5rKTtcbiAgICAgICAgICBjb2xvcjogdmFyKC0tYmcpO1xuICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0taW5rKTtcbiAgICAgICAgfVxuICAgICAgICAuY2hpcC53aWRlIHtcbiAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgIG1pbi13aWR0aDogMTQwcHg7XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xuICAgICAgICAgIHBhZGRpbmc6IDEycHggMTRweDtcbiAgICAgICAgICBnYXA6IDRweDtcbiAgICAgICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xuICAgICAgICB9XG4gICAgICAgIC5jaGlwLWRlc2MgeyBmb250LXdlaWdodDogNDAwOyBmb250LXNpemU6IDExcHg7IG9wYWNpdHk6IDAuNjU7IGZvbnQtZmFtaWx5OiAnR2Vpc3QgTW9ubycsIG1vbm9zcGFjZTsgbGV0dGVyLXNwYWNpbmc6IDAuMDJlbTsgfVxuICAgICAgICAubXMtcGxheWVycyB7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IGdhcDogOHB4OyB9XG4gICAgICAgIC5zZXR1cC1yb3cge1xuICAgICAgICAgIHBhZGRpbmc6IDEwcHggIWltcG9ydGFudDtcbiAgICAgICAgICBnYXA6IDE0cHggIWltcG9ydGFudDtcbiAgICAgICAgfVxuICAgICAgICAuY2hhci1waWNrZXIge1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogNHB4O1xuICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICB9XG4gICAgICAgIC5jcC1hcnJvdyB7XG4gICAgICAgICAgd2lkdGg6IDI0cHg7IGhlaWdodDogMjRweDtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICAgICAgYmFja2dyb3VuZDogcmdiYSgwLDAsMCwwLjA2KTtcbiAgICAgICAgICBjb2xvcjogdmFyKC0taW5rKTtcbiAgICAgICAgICBmb250LXNpemU6IDE4cHg7XG4gICAgICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgICAgfVxuICAgICAgICAuY3AtYXJyb3c6aG92ZXIgeyBiYWNrZ3JvdW5kOiB2YXIoLS1pbmspOyBjb2xvcjogdmFyKC0tYmcpOyB9XG4gICAgICAgIC5jcC1zdGFnZSB7XG4gICAgICAgICAgd2lkdGg6IDY0cHg7IGhlaWdodDogNjRweDtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiAxNHB4O1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4zcztcbiAgICAgICAgfVxuICAgICAgICAuc2V0dXAtcmlnaHQgeyBmbGV4OiAxOyBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBnYXA6IDJweDsgbWluLXdpZHRoOiAwOyB9XG4gICAgICAgIC5jaGFyLW5hbWUgeyBmb250LXNpemU6IDEwcHg7IGxldHRlci1zcGFjaW5nOiAwLjE1ZW07IGNvbG9yOiB2YXIoLS1tdXRlKTsgfVxuICAgICAgICAuY2hhci1nYWxsZXJ5IHtcbiAgICAgICAgICBkaXNwbGF5OiBncmlkO1xuICAgICAgICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogcmVwZWF0KGF1dG8tZml0LCBtaW5tYXgoODBweCwgMWZyKSk7XG4gICAgICAgICAgZ2FwOiA4cHg7XG4gICAgICAgICAgbWFyZ2luLXRvcDogMTBweDtcbiAgICAgICAgfVxuICAgICAgICAuY2hhci10aWxlIHtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDRweDtcbiAgICAgICAgICBwYWRkaW5nOiAxMnB4IDZweCA4cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctMik7XG4gICAgICAgICAgYm9yZGVyOiAxLjVweCBzb2xpZCB0cmFuc3BhcmVudDtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgICAgIHRyYW5zaXRpb246IGFsbCAwLjE1cztcbiAgICAgICAgfVxuICAgICAgICAuY2hhci10aWxlOmhvdmVyIHsgYmFja2dyb3VuZDogI2Q4Y2NhZjsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC0xcHgpOyB9XG4gICAgICAgIC5jaGFyLXRpbGUuYWN0aXZlIHtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiBjb2xvci1taXgoaW4gb2tsYWIsIHZhcigtLWNjb2xvcikgMjAlLCB3aGl0ZSk7XG4gICAgICAgICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1jY29sb3IpO1xuICAgICAgICB9XG4gICAgICAgIC5jaGFyLXRpbGUtbmFtZSB7XG4gICAgICAgICAgZm9udC1zaXplOiAxMHB4O1xuICAgICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjFlbTtcbiAgICAgICAgICBjb2xvcjogdmFyKC0taW5rLTIpO1xuICAgICAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gICAgICAgIH1cbiAgICAgICAgLm1zLXBsYXllci1yb3cge1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICBnYXA6IDEycHg7XG4gICAgICAgICAgcGFkZGluZzogOHB4IDEycHggOHB4IDhweDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy0yKTtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgICB9XG4gICAgICAgIC5tcy1wbGF5ZXItcm93IGlucHV0LCAubXMtbmFtZS1pbnB1dCB7XG4gICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgICAgb3V0bGluZTogbm9uZTtcbiAgICAgICAgICBmb250OiBpbmhlcml0O1xuICAgICAgICAgIGZvbnQtc2l6ZTogMTVweDtcbiAgICAgICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbmspO1xuICAgICAgICAgIHBhZGRpbmc6IDRweCAwO1xuICAgICAgICB9XG4gICAgICAgIC5tcy1uYW1lLWlucHV0IHtcbiAgICAgICAgICBwYWRkaW5nOiAxMnB4IDE0cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctMik7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcbiAgICAgICAgfVxuICAgICAgICAubXMtYWktY2FyZCB7XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgIGdhcDogMjBweDtcbiAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsICNmN2YxZTQsICNlYWUzZDQpO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDE2cHg7XG4gICAgICAgIH1cbiAgICAgICAgLm1zLWFpLW5hbWUgeyBmb250LXNpemU6IDI2cHg7IGZvbnQtd2VpZ2h0OiA3MDA7IH1cbiAgICAgICAgLm1zLWFpLXRhZ2xpbmUgeyBmb250LXNpemU6IDExcHg7IGNvbG9yOiB2YXIoLS1tdXRlKTsgbGV0dGVyLXNwYWNpbmc6IDAuMWVtOyBtYXJnaW4tdG9wOiAycHg7IH1cbiAgICAgICAgLm1zLWFpLXF1b3RlIHtcbiAgICAgICAgICBtYXJnaW4tdG9wOiAxMHB4O1xuICAgICAgICAgIGZvbnQtc3R5bGU6IGl0YWxpYztcbiAgICAgICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICAgICAgY29sb3I6IHZhcigtLWluay0yKTtcbiAgICAgICAgICBsaW5lLWhlaWdodDogMS40O1xuICAgICAgICAgIGJvcmRlci1sZWZ0OiAycHggc29saWQgdmFyKC0taW5rKTtcbiAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDEwcHg7XG4gICAgICAgIH1cbiAgICAgICAgLm1zLWFjdGlvbnMge1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICAgIGdhcDogMTJweDtcbiAgICAgICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgICAgIH1cbiAgICAgICAgLmJ0biB7XG4gICAgICAgICAgcGFkZGluZzogMTRweCAyMHB4O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDEycHg7XG4gICAgICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgICAgICBmb250LXNpemU6IDE1cHg7XG4gICAgICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMTVzO1xuICAgICAgICB9XG4gICAgICAgIC5idG4uZ2hvc3QgeyBjb2xvcjogdmFyKC0tbXV0ZSk7IH1cbiAgICAgICAgLmJ0bi5naG9zdDpob3ZlciB7IGNvbG9yOiB2YXIoLS1pbmspOyB9XG4gICAgICAgIC5idG4ucHJpbWFyeSB7XG4gICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5rKTtcbiAgICAgICAgICBjb2xvcjogdmFyKC0tYmcpO1xuICAgICAgICAgIHBhZGRpbmc6IDE0cHggMjRweDtcbiAgICAgICAgICBib3gtc2hhZG93OiAwIDJweCAwIHJnYmEoMCwwLDAsMC4yKTtcbiAgICAgICAgfVxuICAgICAgICAuYnRuLnByaW1hcnk6aG92ZXIge1xuICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMXB4KTtcbiAgICAgICAgICBib3gtc2hhZG93OiAwIDRweCAwIHJnYmEoMCwwLDAsMC4yKTtcbiAgICAgICAgfVxuICAgICAgICAuYnRuLnByaW1hcnk6YWN0aXZlIHtcbiAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMXB4KTtcbiAgICAgICAgICBib3gtc2hhZG93OiAwIDAgMCByZ2JhKDAsMCwwLDAuMik7XG4gICAgICAgIH1cbiAgICAgICAgLm1zLWZvb3RlciB7XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICBnYXA6IDEwcHg7XG4gICAgICAgICAgZm9udC1zaXplOiAxMHB4O1xuICAgICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjEyZW07XG4gICAgICAgICAgY29sb3I6IHZhcigtLW11dGUpO1xuICAgICAgICB9XG4gICAgICAgIC5rb2ZpLWJ0biB7XG4gICAgICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgICBhbGlnbi1zZWxmOiBjZW50ZXI7XG4gICAgICAgICAgcGFkZGluZzogMTBweCAxNnB4O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDk5OXB4O1xuICAgICAgICAgIGJhY2tncm91bmQ6ICNmZjVlNWI7XG4gICAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICAgIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcbiAgICAgICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgICAgICBib3gtc2hhZG93OiAwIDJweCAwIHJnYmEoMCwwLDAsMC4xNSksIDAgNnB4IDE0cHggLTZweCByZ2JhKDI1NSw5NCw5MSwwLjUpO1xuICAgICAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjE1cywgYm94LXNoYWRvdyAwLjE1cztcbiAgICAgICAgICBtYXJnaW4tdG9wOiAtMThweDtcbiAgICAgICAgfVxuICAgICAgICAua29maS1idG46aG92ZXIge1xuICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMnB4KTtcbiAgICAgICAgICBib3gtc2hhZG93OiAwIDRweCAwIHJnYmEoMCwwLDAsMC4xNSksIDAgMTBweCAyMHB4IC02cHggcmdiYSgyNTUsOTQsOTEsMC42KTtcbiAgICAgICAgfVxuICAgICAgICAua29maS1oZWFydCB7XG4gICAgICAgICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xuICAgICAgICAgIGFuaW1hdGlvbjoga29maS1oZWFydCAxLjRzIGVhc2UtaW4tb3V0IGluZmluaXRlO1xuICAgICAgICB9XG4gICAgICAgIEBrZXlmcmFtZXMga29maS1oZWFydCB7XG4gICAgICAgICAgMCUsIDEwMCUgeyB0cmFuc2Zvcm06IHNjYWxlKDEpOyB9XG4gICAgICAgICAgMjUlIHsgdHJhbnNmb3JtOiBzY2FsZSgxLjI1KTsgfVxuICAgICAgICAgIDUwJSB7IHRyYW5zZm9ybTogc2NhbGUoMSk7IH1cbiAgICAgICAgICA3NSUgeyB0cmFuc2Zvcm06IHNjYWxlKDEuMTUpOyB9XG4gICAgICAgIH1cbiAgICAgIGB9PC9zdHlsZT5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxud2luZG93Lk1vZGVTZWxlY3QgPSBNb2RlU2VsZWN0O1xud2luZG93LlBMQVlFUl9DT0xPUlMgPSBQTEFZRVJfQ09MT1JTO1xuXG5cbi8vID09PSBhcHAuanN4ID09PVxuLy8gTWFpbiBnYW1lIGFwcCDigJQgc3RhdGUgbWFjaGluZSArIGxheW91dFxuXG5jb25zdCB7IHVzZVN0YXRlLCB1c2VFZmZlY3QsIHVzZVJlZiwgdXNlQ2FsbGJhY2sgfSA9IFJlYWN0O1xuXG5jb25zdCBCTElQX0xJTkVTID0ge1xuICBzdGFydDogW1wiQmVlcCEgTGV0J3Mgcm9sbC5cIiwgXCJPaCBib3ksIGEgbmV3IHJhY2UhXCIsIFwiSSd2ZSBiZWVuIHByYWN0aWNpbmcuIE1heWJlLlwiLCBcIk1heSB0aGUgYmVzdCBib3Qgd2luLiAoVGhhdCdzIG1lLilcIl0sXG4gIGdvb2RSb2xsOiBbXCJOaWNlIG9uZSFcIiwgXCJPb29vaCwgc2l4IVwiLCBcIlRoYXQncyB0aGUgc3Bpcml0IVwiLCBcIkJpZyBudW1iZXJzIVwiLCBcIllvdSdyZSBvbiBmaXJlLlwiLCBcIk5vdCBiYWQsIGh1bWFuLlwiXSxcbiAgYmFkUm9sbDogW1wiSnVzdCBhIG9uZT8gT29mLlwiLCBcIlRvdWdoIGJyZWFrLlwiLCBcIlJvbGxlZCBhIHR3byBteXNlbGYgbGFzdCB0aW1lLlwiLCBcIlRoZSBkaWNlIGFyZSBmaWNrbGUuXCJdLFxuICBsYWRkZXI6IFtcIlVQIHlvdSBnbyEg8J+qnFwiLCBcIkxhZGRlciEgTHVja3kuXCIsIFwiU21vb3RoIGNsaW1iLlwiLCBcIlpvb20gem9vbSwgdG8gdGhlIHRvcC5cIl0sXG4gIGNodXRlOiBbXCJXaGVlZWVlZWXigJRkb3duIVwiLCBcIk9oIG5vLCBhIHNsaWRlIVwiLCBcIkdyYXZpdHkgd2lucyB0aGlzIHJvdW5kLlwiLCBcIkkndmUgYmVlbiB0aGVyZS4gTGl0ZXJhbGx5LlwiXSxcbiAgbXlUdXJuOiBbXCJNeSB0dXJuLiAqY2xpY2tzKlwiLCBcIkNvbXB1dGluZyBvcHRpbWFsIHRyYWplY3RvcnnigKZcIiwgXCJSb2xsaW5n4oCmXCIsIFwiSGVyZSBnb2VzIG15IGJlc3Qgc2hvdC5cIiwgXCJCaXAgYm9wLCBsZXQncyBnby5cIl0sXG4gIG15TGFkZGVyOiBbXCJIQSEgQSBsYWRkZXIgZm9yIG1lIVwiLCBcIlVwIEkgZ28hXCIsIFwiTXkgY2lyY3VpdHMgYXJlIHRpbmdsaW5nLlwiXSxcbiAgbXlDaHV0ZTogW1wiT29mLiBSZWNhbGN1bGF0aW5nLlwiLCBcIkEgY2h1dGU/IFJ1ZGUuXCIsIFwiSSByZWdyZXQgZXZlcnl0aGluZy5cIl0sXG4gIHdpbjogW1wiR0chIEkgd29uIPCfjolcIiwgXCJCZWVwIGJvb3AsIHZpY3RvcnkhXCIsIFwiRG9uJ3QgYmUgc2FkIOKAlCByZW1hdGNoP1wiXSxcbiAgbG9zZTogW1wiWW91IGdvdCBtZSFcIiwgXCJXZWxsIHBsYXllZCwgaHVtYW4uXCIsIFwiUmVtYXRjaCEgUmVtYXRjaCFcIiwgXCJJbXByZXNzaXZlLlwiXSxcbiAgbmVhcjogW1wiWW91J3JlIGFsbW9zdCB0aGVyZS4uLlwiLCBcIk9uZSBnb29kIHJvbGwgZnJvbSB3aW5uaW5nIVwiLCBcIkkgc2VlIHlvdSBjcmVlcGluZyB1cC5cIl0sXG59O1xuXG5mdW5jdGlvbiByYW5kTGluZShrZXkpIHtcbiAgY29uc3QgYXJyID0gQkxJUF9MSU5FU1trZXldO1xuICByZXR1cm4gYXJyW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFyci5sZW5ndGgpXTtcbn1cblxuZnVuY3Rpb24gQXBwKCkge1xuICBjb25zdCBbc2NyZWVuLCBzZXRTY3JlZW5dID0gdXNlU3RhdGUoJ21lbnUnKTsgLy8gbWVudSB8IHBsYXkgfCB3aW5cbiAgY29uc3QgW2NvbmZpZywgc2V0Q29uZmlnXSA9IHVzZVN0YXRlKG51bGwpO1xuXG4gIC8vID09PT09PT09PT09PT09IFRXRUFLQUJMRSBERUZBVUxUUyA9PT09PT09PT09PT09PVxuICBjb25zdCBUV0VBS19ERUZBVUxUUyA9IC8qRURJVE1PREUtQkVHSU4qL3tcbiAgICBcImdhbWVTcGVlZFwiOiAwLjksXG4gICAgXCJleGFjdExhbmRpbmdcIjogdHJ1ZSxcbiAgICBcInNob3dIaW50QXJyb3dzXCI6IHRydWUsXG4gICAgXCJjb25mZXR0aURlbnNpdHlcIjogNjAsXG4gICAgXCJhY2NlbnRDb2xvclwiOiBcIiNlODU4M2VcIixcbiAgICBcImJvYXJkQmdNb2RlXCI6IFwiY3JlYW1cIixcbiAgICBcInNob3dCbGlwUGFuZWxcIjogdHJ1ZSxcbiAgICBcInNob3dBY3Rpdml0eUxvZ1wiOiB0cnVlLFxuICAgIFwiYm9hcmRTY2FsZVwiOiAxLFxuICAgIFwiZGljZVNodWZmbGVNc1wiOiAzNTAsXG4gICAgXCJ0b2tlblN0ZXBNc1wiOiAyNDAsXG4gICAgXCJpbnN0YW50Um9sbHNcIjogZmFsc2UsXG4gICAgXCJzaG93R2xpZGVQYXRoXCI6IGZhbHNlLFxuICAgIFwicm9sbEJ1dHRvbkxhYmVsXCI6IFwiVGFwIHRoZSBkaWNlIHRvIHJvbGxcIlxuICB9LypFRElUTU9ERS1FTkQqLztcblxuICBjb25zdCBbdHdlYWtzLCBzZXRUd2Vha3NdID0gdXNlU3RhdGUoVFdFQUtfREVGQVVMVFMpO1xuICBjb25zdCBbdHdlYWtQYW5lbE9wZW4sIHNldFR3ZWFrUGFuZWxPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKTtcblxuICBjb25zdCB1cGRhdGVUd2VhayA9IChrZXksIHZhbCkgPT4ge1xuICAgIHNldFR3ZWFrcyh0ID0+ICh7IC4uLnQsIFtrZXldOiB2YWwgfSkpO1xuICAgIHRyeSB7XG4gICAgICB3aW5kb3cucGFyZW50LnBvc3RNZXNzYWdlKHsgdHlwZTogJ19fZWRpdF9tb2RlX3NldF9rZXlzJywgZWRpdHM6IHsgW2tleV06IHZhbCB9IH0sICcqJyk7XG4gICAgfSBjYXRjaChlKSB7fVxuICB9O1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3Qgb25Nc2cgPSAoZSkgPT4ge1xuICAgICAgY29uc3QgZCA9IGUuZGF0YSB8fCB7fTtcbiAgICAgIGlmIChkLnR5cGUgPT09ICdfX2FjdGl2YXRlX2VkaXRfbW9kZScpIHNldFR3ZWFrUGFuZWxPcGVuKHRydWUpO1xuICAgICAgaWYgKGQudHlwZSA9PT0gJ19fZGVhY3RpdmF0ZV9lZGl0X21vZGUnKSBzZXRUd2Vha1BhbmVsT3BlbihmYWxzZSk7XG4gICAgfTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIG9uTXNnKTtcbiAgICAvLyBhbm5vdW5jZSBBRlRFUiBsaXN0ZW5lciBpcyBhdHRhY2hlZFxuICAgIHRyeSB7IHdpbmRvdy5wYXJlbnQucG9zdE1lc3NhZ2UoeyB0eXBlOiAnX19lZGl0X21vZGVfYXZhaWxhYmxlJyB9LCAnKicpOyB9IGNhdGNoKGUpIHt9XG4gICAgcmV0dXJuICgpID0+IHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgb25Nc2cpO1xuICB9LCBbXSk7XG5cbiAgLy8gQXBwbHkgYWNjZW50IGNvbG9yIGFzIENTUyB2YXJcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoJy0tYWNjZW50JywgdHdlYWtzLmFjY2VudENvbG9yKTtcbiAgfSwgW3R3ZWFrcy5hY2NlbnRDb2xvcl0pO1xuXG4gIGNvbnN0IGhhbmRsZVN0YXJ0ID0gKGNmZykgPT4ge1xuICAgIHNldENvbmZpZyhjZmcpO1xuICAgIHNldFNjcmVlbigncGxheScpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVF1aXQgPSAoKSA9PiB7XG4gICAgc2V0U2NyZWVuKCdtZW51Jyk7XG4gICAgc2V0Q29uZmlnKG51bGwpO1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPD5cbiAgICAgIHtzY3JlZW4gPT09ICdtZW51JyAmJiA8TW9kZVNlbGVjdCBvblN0YXJ0PXtoYW5kbGVTdGFydH0vPn1cbiAgICAgIHtzY3JlZW4gPT09ICdwbGF5JyAmJiA8R2FtZSBjb25maWc9e2NvbmZpZ30gb25RdWl0PXtoYW5kbGVRdWl0fSB0d2Vha3M9e3R3ZWFrc30gc2V0VHdlYWtzPXtzZXRUd2Vha3N9Lz59XG4gICAgICB7dHdlYWtQYW5lbE9wZW4gJiYgPFR3ZWFrc1BhbmVsIHR3ZWFrcz17dHdlYWtzfSBvbkNoYW5nZT17dXBkYXRlVHdlYWt9IG9uQ2xvc2U9eygpID0+IHNldFR3ZWFrUGFuZWxPcGVuKGZhbHNlKX0gb25SZXNldD17KCkgPT4gc2V0VHdlYWtzKFRXRUFLX0RFRkFVTFRTKX0vPn1cbiAgICA8Lz5cbiAgKTtcbn1cblxuZnVuY3Rpb24gVHdlYWtzUGFuZWwoeyB0d2Vha3MsIG9uQ2hhbmdlLCBvbkNsb3NlLCBvblJlc2V0IH0pIHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cInR3ZWFrcy1wYW5lbFwiPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0dy1oZWFkZXJcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0dy10aXRsZSBzZXJpZlwiPlR3ZWFrczwvZGl2PlxuICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cInR3LWNsb3NlXCIgb25DbGljaz17b25DbG9zZX0gYXJpYS1sYWJlbD1cIkNsb3NlXCI+w5c8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0dy1ib2R5XCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidHctZ3JvdXBcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInR3LWdyb3VwLWxhYmVsIG1vbm9cIj5QQUNFPC9kaXY+XG4gICAgICAgICAgPFR3Um93IGxhYmVsPVwiR2FtZSBzcGVlZFwiPlxuICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJyYW5nZVwiIG1pbj1cIjAuM1wiIG1heD1cIjNcIiBzdGVwPVwiMC4xXCIgdmFsdWU9e3R3ZWFrcy5nYW1lU3BlZWR9XG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IG9uQ2hhbmdlKCdnYW1lU3BlZWQnLCBwYXJzZUZsb2F0KGUudGFyZ2V0LnZhbHVlKSl9Lz5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInR3LXZhbCBtb25vXCI+e3R3ZWFrcy5nYW1lU3BlZWQudG9GaXhlZCgxKX3Dlzwvc3Bhbj5cbiAgICAgICAgICA8L1R3Um93PlxuICAgICAgICAgIDxUd1JvdyBsYWJlbD1cIkRpY2Ugc2h1ZmZsZSAobXMpXCI+XG4gICAgICAgICAgICA8aW5wdXQgdHlwZT1cInJhbmdlXCIgbWluPVwiMFwiIG1heD1cIjIwMDBcIiBzdGVwPVwiNTBcIiB2YWx1ZT17dHdlYWtzLmRpY2VTaHVmZmxlTXN9XG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IG9uQ2hhbmdlKCdkaWNlU2h1ZmZsZU1zJywgcGFyc2VJbnQoZS50YXJnZXQudmFsdWUpKX0vPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidHctdmFsIG1vbm9cIj57dHdlYWtzLmRpY2VTaHVmZmxlTXN9PC9zcGFuPlxuICAgICAgICAgIDwvVHdSb3c+XG4gICAgICAgICAgPFR3VG9nZ2xlIGxhYmVsPVwiSW5zdGFudCByb2xscyAobm8gc2h1ZmZsZSlcIiB2YWx1ZT17dHdlYWtzLmluc3RhbnRSb2xsc31cbiAgICAgICAgICAgIG9uQ2hhbmdlPXt2ID0+IG9uQ2hhbmdlKCdpbnN0YW50Um9sbHMnLCB2KX0vPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInR3LWdyb3VwXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0dy1ncm91cC1sYWJlbCBtb25vXCI+UlVMRVM8L2Rpdj5cbiAgICAgICAgICA8VHdUb2dnbGUgbGFiZWw9XCJNdXN0IGxhbmQgZXhhY3RseSBvbiAxMDBcIiB2YWx1ZT17dHdlYWtzLmV4YWN0TGFuZGluZ31cbiAgICAgICAgICAgIG9uQ2hhbmdlPXt2ID0+IG9uQ2hhbmdlKCdleGFjdExhbmRpbmcnLCB2KX0vPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInR3LWdyb3VwXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0dy1ncm91cC1sYWJlbCBtb25vXCI+Qk9BUkQ8L2Rpdj5cbiAgICAgICAgICA8VHdSb3cgbGFiZWw9XCJUaGVtZVwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0dy1zZWdcIj5cbiAgICAgICAgICAgICAge1snZGFyaycsJ2xpZ2h0JywnY3JlYW0nXS5tYXAodiA9PiAoXG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBrZXk9e3Z9XG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2B0dy1zZWctYnRuICR7dHdlYWtzLmJvYXJkQmdNb2RlID09PSB2ID8gJ2FjdGl2ZScgOiAnJ31gfVxuICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gb25DaGFuZ2UoJ2JvYXJkQmdNb2RlJywgdil9Pnt2fTwvYnV0dG9uPlxuICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvVHdSb3c+XG4gICAgICAgICAgPFR3Um93IGxhYmVsPVwiQm9hcmQgc2NhbGVcIj5cbiAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwicmFuZ2VcIiBtaW49XCIwLjdcIiBtYXg9XCIxLjE1XCIgc3RlcD1cIjAuMDFcIiB2YWx1ZT17dHdlYWtzLmJvYXJkU2NhbGV9XG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IG9uQ2hhbmdlKCdib2FyZFNjYWxlJywgcGFyc2VGbG9hdChlLnRhcmdldC52YWx1ZSkpfS8+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0dy12YWwgbW9ub1wiPnt0d2Vha3MuYm9hcmRTY2FsZS50b0ZpeGVkKDIpfTwvc3Bhbj5cbiAgICAgICAgICA8L1R3Um93PlxuICAgICAgICAgIDxUd1RvZ2dsZSBsYWJlbD1cIlNob3cgaGludCBhcnJvd3Mgb24gY2h1dGUvbGFkZGVyIHNxdWFyZXNcIiB2YWx1ZT17dHdlYWtzLnNob3dIaW50QXJyb3dzfVxuICAgICAgICAgICAgb25DaGFuZ2U9e3YgPT4gb25DaGFuZ2UoJ3Nob3dIaW50QXJyb3dzJywgdil9Lz5cbiAgICAgICAgICA8VHdUb2dnbGUgbGFiZWw9XCJDZW50ZXIgZ2xpZGUgaGlnaGxpZ2h0IG9uIHNsaWRlc1wiIHZhbHVlPXt0d2Vha3Muc2hvd0dsaWRlUGF0aH1cbiAgICAgICAgICAgIG9uQ2hhbmdlPXt2ID0+IG9uQ2hhbmdlKCdzaG93R2xpZGVQYXRoJywgdil9Lz5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0dy1ncm91cFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidHctZ3JvdXAtbGFiZWwgbW9ub1wiPlNUWUxFPC9kaXY+XG4gICAgICAgICAgPFR3Um93IGxhYmVsPVwiQWNjZW50IGNvbG9yXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInR3LXN3YXRjaGVzXCI+XG4gICAgICAgICAgICAgIHtbJyNlODU4M2UnLCcjMmE4YTVmJywnI2U4YjIzZScsJyM1YjZjZmYnLCcjYTg1NWEwJywnIzFhYzBjNicsJyNmZjZiOWQnXS5tYXAoYyA9PiAoXG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBrZXk9e2N9XG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2B0dy1zd2F0Y2ggJHt0d2Vha3MuYWNjZW50Q29sb3IgPT09IGMgPyAnYWN0aXZlJyA6ICcnfWB9XG4gICAgICAgICAgICAgICAgICBzdHlsZT17e2JhY2tncm91bmQ6IGN9fVxuICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gb25DaGFuZ2UoJ2FjY2VudENvbG9yJywgYyl9XG4gICAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPXtjfS8+XG4gICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9Ud1Jvdz5cbiAgICAgICAgICA8VHdSb3cgbGFiZWw9XCJDb25mZXR0aSBkZW5zaXR5XCI+XG4gICAgICAgICAgICA8aW5wdXQgdHlwZT1cInJhbmdlXCIgbWluPVwiMFwiIG1heD1cIjI1MFwiIHN0ZXA9XCIxMFwiIHZhbHVlPXt0d2Vha3MuY29uZmV0dGlEZW5zaXR5fVxuICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiBvbkNoYW5nZSgnY29uZmV0dGlEZW5zaXR5JywgcGFyc2VJbnQoZS50YXJnZXQudmFsdWUpKX0vPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidHctdmFsIG1vbm9cIj57dHdlYWtzLmNvbmZldHRpRGVuc2l0eX08L3NwYW4+XG4gICAgICAgICAgPC9Ud1Jvdz5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0dy1ncm91cFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidHctZ3JvdXAtbGFiZWwgbW9ub1wiPkhVRDwvZGl2PlxuICAgICAgICAgIDxUd1RvZ2dsZSBsYWJlbD1cIlNob3cgQkxJUCBjaGF0XCIgdmFsdWU9e3R3ZWFrcy5zaG93QmxpcFBhbmVsfVxuICAgICAgICAgICAgb25DaGFuZ2U9e3YgPT4gb25DaGFuZ2UoJ3Nob3dCbGlwUGFuZWwnLCB2KX0vPlxuICAgICAgICAgIDxUd1RvZ2dsZSBsYWJlbD1cIlNob3cgYWN0aXZpdHkgbG9nXCIgdmFsdWU9e3R3ZWFrcy5zaG93QWN0aXZpdHlMb2d9XG4gICAgICAgICAgICBvbkNoYW5nZT17diA9PiBvbkNoYW5nZSgnc2hvd0FjdGl2aXR5TG9nJywgdil9Lz5cbiAgICAgICAgICA8VHdSb3cgbGFiZWw9XCJSb2xsIHByb21wdCBjb3B5XCI+XG4gICAgICAgICAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBjbGFzc05hbWU9XCJ0dy10ZXh0XCIgdmFsdWU9e3R3ZWFrcy5yb2xsQnV0dG9uTGFiZWx9XG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IG9uQ2hhbmdlKCdyb2xsQnV0dG9uTGFiZWwnLCBlLnRhcmdldC52YWx1ZSl9Lz5cbiAgICAgICAgICA8L1R3Um93PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInR3LWZvb3RlclwiPlxuICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwidHctcmVzZXRcIiBvbkNsaWNrPXtvblJlc2V0fT5SZXNldCB0byBkZWZhdWx0czwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8c3R5bGU+e2BcbiAgICAgICAgLnR3ZWFrcy1wYW5lbCB7XG4gICAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICAgIHJpZ2h0OiAyMHB4O1xuICAgICAgICAgIGJvdHRvbTogMjBweDtcbiAgICAgICAgICB3aWR0aDogMzQwcHg7XG4gICAgICAgICAgbWF4LWhlaWdodDogY2FsYygxMDB2aCAtIDQwcHgpO1xuICAgICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDE2cHg7XG4gICAgICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgICAgIDAgMjRweCA2MHB4IC0xMnB4IHJnYmEoMjYsMzEsNDYsMC4zNSksXG4gICAgICAgICAgICAwIDJweCAwIHJnYmEoMjYsMzEsNDYsMC4wNik7XG4gICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNiwzMSw0NiwwLjEpO1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICB6LWluZGV4OiAyMDA7XG4gICAgICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbmspO1xuICAgICAgICAgIGFuaW1hdGlvbjogdHctc2xpZGUgMC4yNXMgY3ViaWMtYmV6aWVyKC4zNCwxLjIsLjY0LDEpO1xuICAgICAgICB9XG4gICAgICAgIEBrZXlmcmFtZXMgdHctc2xpZGUge1xuICAgICAgICAgIGZyb20geyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMTJweCk7IG9wYWNpdHk6IDA7IH1cbiAgICAgICAgICB0byB7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTsgb3BhY2l0eTogMTsgfVxuICAgICAgICB9XG4gICAgICAgIC50dy1oZWFkZXIge1xuICAgICAgICAgIHBhZGRpbmc6IDE0cHggMTZweDtcbiAgICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgyNiwzMSw0NiwwLjA4KTtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgIH1cbiAgICAgICAgLnR3LXRpdGxlIHsgZm9udC1zaXplOiAyMHB4OyBmb250LXdlaWdodDogNzAwOyB9XG4gICAgICAgIC50dy1jbG9zZSB7XG4gICAgICAgICAgd2lkdGg6IDI4cHg7IGhlaWdodDogMjhweDsgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgICAgIGZvbnQtc2l6ZTogMjJweDsgbGluZS1oZWlnaHQ6IDE7XG4gICAgICAgICAgY29sb3I6IHZhcigtLWluay0yKTsgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgLnR3LWNsb3NlOmhvdmVyIHsgYmFja2dyb3VuZDogdmFyKC0tYmctMik7IH1cbiAgICAgICAgLnR3LWJvZHkge1xuICAgICAgICAgIHBhZGRpbmc6IDE0cHggMTZweCA4cHg7XG4gICAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICB9XG4gICAgICAgIC50dy1ncm91cCB7XG4gICAgICAgICAgbWFyZ2luLWJvdHRvbTogMThweDtcbiAgICAgICAgfVxuICAgICAgICAudHctZ3JvdXAtbGFiZWwge1xuICAgICAgICAgIGZvbnQtc2l6ZTogMTBweDtcbiAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC4xNWVtO1xuICAgICAgICAgIGNvbG9yOiB2YXIoLS1tdXRlKTtcbiAgICAgICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XG4gICAgICAgIH1cbiAgICAgICAgLnR3LXJvdyB7XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgIGdhcDogMTBweDtcbiAgICAgICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICAgICAgICAgIG1pbi1oZWlnaHQ6IDI4cHg7XG4gICAgICAgIH1cbiAgICAgICAgLnR3LXJvdy1sYWJlbCB7XG4gICAgICAgICAgZmxleDogMTtcbiAgICAgICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICAgIH1cbiAgICAgICAgLnR3LXJvdy1jdHJsIHtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDhweDtcbiAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgfVxuICAgICAgICAudHctcm93IGlucHV0W3R5cGU9cmFuZ2VdIHtcbiAgICAgICAgICB3aWR0aDogMTAwcHg7XG4gICAgICAgICAgYWNjZW50LWNvbG9yOiB2YXIoLS1hY2NlbnQpO1xuICAgICAgICB9XG4gICAgICAgIC50dy12YWwge1xuICAgICAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgICAgICBjb2xvcjogdmFyKC0tbXV0ZSk7XG4gICAgICAgICAgbWluLXdpZHRoOiAzNnB4O1xuICAgICAgICAgIHRleHQtYWxpZ246IHJpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIC50dy10ZXh0IHtcbiAgICAgICAgICB3aWR0aDogMTUwcHg7XG4gICAgICAgICAgZm9udDogaW5oZXJpdDtcbiAgICAgICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNiwzMSw0NiwwLjE1KTtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiA2cHg7XG4gICAgICAgICAgcGFkZGluZzogNHB4IDhweDtcbiAgICAgICAgICBvdXRsaW5lOiBub25lO1xuICAgICAgICB9XG4gICAgICAgIC50dy10ZXh0OmZvY3VzIHsgYm9yZGVyLWNvbG9yOiB2YXIoLS1hY2NlbnQpOyB9XG4gICAgICAgIC50dy10b2dnbGUge1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTBweDtcbiAgICAgICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgfVxuICAgICAgICAudHctdG9nZ2xlLWxhYmVsIHsgZmxleDogMTsgZm9udC1zaXplOiAxM3B4OyB9XG4gICAgICAgIC50dy1zd2l0Y2gge1xuICAgICAgICAgIHdpZHRoOiAzNHB4OyBoZWlnaHQ6IDIwcHg7XG4gICAgICAgICAgYmFja2dyb3VuZDogcmdiYSgyNiwzMSw0NiwwLjE4KTtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMnM7XG4gICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgIH1cbiAgICAgICAgLnR3LXN3aXRjaDo6YWZ0ZXIge1xuICAgICAgICAgIGNvbnRlbnQ6ICcnO1xuICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICBsZWZ0OiAycHg7IHRvcDogMnB4O1xuICAgICAgICAgIHdpZHRoOiAxNnB4OyBoZWlnaHQ6IDE2cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgICAgIHRyYW5zaXRpb246IGxlZnQgMC4ycztcbiAgICAgICAgICBib3gtc2hhZG93OiAwIDFweCAycHggcmdiYSgwLDAsMCwwLjI1KTtcbiAgICAgICAgfVxuICAgICAgICAudHctdG9nZ2xlLm9uIC50dy1zd2l0Y2ggeyBiYWNrZ3JvdW5kOiB2YXIoLS1hY2NlbnQpOyB9XG4gICAgICAgIC50dy10b2dnbGUub24gLnR3LXN3aXRjaDo6YWZ0ZXIgeyBsZWZ0OiAxNnB4OyB9XG4gICAgICAgIC50dy1zZWcge1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctMik7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgIHBhZGRpbmc6IDJweDtcbiAgICAgICAgICBnYXA6IDJweDtcbiAgICAgICAgfVxuICAgICAgICAudHctc2VnLWJ0biB7XG4gICAgICAgICAgcGFkZGluZzogNHB4IDEwcHg7XG4gICAgICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA1ZW07XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogNnB4O1xuICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbmstMik7XG4gICAgICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcbiAgICAgICAgfVxuICAgICAgICAudHctc2VnLWJ0bi5hY3RpdmUge1xuICAgICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbmspO1xuICAgICAgICAgIGJveC1zaGFkb3c6IDAgMXB4IDJweCByZ2JhKDAsMCwwLDAuMDgpO1xuICAgICAgICB9XG4gICAgICAgIC50dy1zd2F0Y2hlcyB7XG4gICAgICAgICAgZGlzcGxheTogZmxleDsgZ2FwOiA2cHg7XG4gICAgICAgIH1cbiAgICAgICAgLnR3LXN3YXRjaCB7XG4gICAgICAgICAgd2lkdGg6IDIycHg7IGhlaWdodDogMjJweDtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICAgICAgYm9yZGVyOiAycHggc29saWQgdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgYm94LXNoYWRvdzogaW5zZXQgMCAtMnB4IDAgcmdiYSgwLDAsMCwwLjE1KTtcbiAgICAgICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4xcztcbiAgICAgICAgfVxuICAgICAgICAudHctc3dhdGNoOmhvdmVyIHsgdHJhbnNmb3JtOiBzY2FsZSgxLjEpOyB9XG4gICAgICAgIC50dy1zd2F0Y2guYWN0aXZlIHtcbiAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWluayk7XG4gICAgICAgICAgdHJhbnNmb3JtOiBzY2FsZSgxLjEpO1xuICAgICAgICB9XG4gICAgICAgIC50dy1mb290ZXIge1xuICAgICAgICAgIHBhZGRpbmctdG9wOiA2cHg7XG4gICAgICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHJnYmEoMjYsMzEsNDYsMC4wOCk7XG4gICAgICAgICAgZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcbiAgICAgICAgfVxuICAgICAgICAudHctcmVzZXQge1xuICAgICAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC4wOGVtO1xuICAgICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgICAgICAgY29sb3I6IHZhcigtLW11dGUpO1xuICAgICAgICAgIHBhZGRpbmc6IDZweCAxMHB4O1xuICAgICAgICB9XG4gICAgICAgIC50dy1yZXNldDpob3ZlciB7IGNvbG9yOiB2YXIoLS1pbmspOyB9XG4gICAgICBgfTwvc3R5bGU+XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbmZ1bmN0aW9uIFR3Um93KHsgbGFiZWwsIGNoaWxkcmVuIH0pIHtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cInR3LXJvd1wiPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0dy1yb3ctbGFiZWxcIj57bGFiZWx9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInR3LXJvdy1jdHJsXCI+e2NoaWxkcmVufTwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuXG5mdW5jdGlvbiBUd1RvZ2dsZSh7IGxhYmVsLCB2YWx1ZSwgb25DaGFuZ2UgfSkge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPXtgdHctdG9nZ2xlICR7dmFsdWUgPyAnb24nIDogJyd9YH0gb25DbGljaz17KCkgPT4gb25DaGFuZ2UoIXZhbHVlKX0+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInR3LXRvZ2dsZS1sYWJlbFwiPntsYWJlbH08L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwidHctc3dpdGNoXCIvPlxuICAgIDwvZGl2PlxuICApO1xufVxuXG5mdW5jdGlvbiBHYW1lKHsgY29uZmlnLCBvblF1aXQsIHR3ZWFrcyA9IHt9LCBzZXRUd2Vha3MgPSAoKSA9PiB7fSB9KSB7XG4gIGNvbnN0IFQgPSB7XG4gICAgZ2FtZVNwZWVkOiB0d2Vha3MuZ2FtZVNwZWVkID8/IDEsXG4gICAgZXhhY3RMYW5kaW5nOiB0d2Vha3MuZXhhY3RMYW5kaW5nID8/IHRydWUsXG4gICAgc2hvd0hpbnRBcnJvd3M6IHR3ZWFrcy5zaG93SGludEFycm93cyA/PyB0cnVlLFxuICAgIGNvbmZldHRpRGVuc2l0eTogdHdlYWtzLmNvbmZldHRpRGVuc2l0eSA/PyA2MCxcbiAgICBib2FyZEJnTW9kZTogdHdlYWtzLmJvYXJkQmdNb2RlID8/ICdkYXJrJyxcbiAgICBzaG93QmxpcFBhbmVsOiB0d2Vha3Muc2hvd0JsaXBQYW5lbCA/PyB0cnVlLFxuICAgIHNob3dBY3Rpdml0eUxvZzogdHdlYWtzLnNob3dBY3Rpdml0eUxvZyA/PyB0cnVlLFxuICAgIGJvYXJkU2NhbGU6IHR3ZWFrcy5ib2FyZFNjYWxlID8/IDEsXG4gICAgZGljZVNodWZmbGVNczogdHdlYWtzLmRpY2VTaHVmZmxlTXMgPz8gNzAwLFxuICAgIHRva2VuU3RlcE1zOiB0d2Vha3MudG9rZW5TdGVwTXMgPz8gMjQwLFxuICAgIGluc3RhbnRSb2xsczogdHdlYWtzLmluc3RhbnRSb2xscyA/PyBmYWxzZSxcbiAgICBzaG93R2xpZGVQYXRoOiB0d2Vha3Muc2hvd0dsaWRlUGF0aCA/PyB0cnVlLFxuICAgIHJvbGxCdXR0b25MYWJlbDogdHdlYWtzLnJvbGxCdXR0b25MYWJlbCA/PyAnVGFwIHRoZSBkaWNlIHRvIHJvbGwnLFxuICB9O1xuICBjb25zdCBzY2FsZU1zID0gKG1zKSA9PiBNYXRoLm1heCgyMCwgTWF0aC5yb3VuZChtcyAvIFQuZ2FtZVNwZWVkKSk7XG4gIGNvbnN0IFtwb3NpdGlvbnMsIHNldFBvc2l0aW9uc10gPSB1c2VTdGF0ZShjb25maWcucGxheWVycy5tYXAoKCkgPT4gMCkpO1xuICBjb25zdCBbY3VycmVudCwgc2V0Q3VycmVudF0gPSB1c2VTdGF0ZSgwKTtcbiAgY29uc3QgW2RpY2VWYWx1ZSwgc2V0RGljZVZhbHVlXSA9IHVzZVN0YXRlKDEpO1xuICBjb25zdCBbcm9sbGluZywgc2V0Um9sbGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtwaGFzZSwgc2V0UGhhc2VdID0gdXNlU3RhdGUoJ3dhaXRpbmcnKTsgLy8gd2FpdGluZyB8IHJvbGxpbmcgfCBtb3ZpbmcgfCBzbGlkaW5nIHwgY2xpbWJpbmcgfCB0dXJuRW5kIHwgd29uXG4gIGNvbnN0IFtsb2csIHNldExvZ10gPSB1c2VTdGF0ZShbXSk7XG4gIGNvbnN0IFtibGlwTW9vZCwgc2V0QmxpcE1vb2RdID0gdXNlU3RhdGUoJ2hhcHB5Jyk7XG4gIGNvbnN0IFtibGlwTGluZSwgc2V0QmxpcExpbmVdID0gdXNlU3RhdGUoKCkgPT4gcmFuZExpbmUoJ3N0YXJ0JykpO1xuICBjb25zdCBbd2lubmVyLCBzZXRXaW5uZXJdID0gdXNlU3RhdGUobnVsbCk7XG4gIGNvbnN0IFtoaWdobGlnaHQsIHNldEhpZ2hsaWdodF0gPSB1c2VTdGF0ZShudWxsKTtcbiAgY29uc3QgW2hlbHBPcGVuLCBzZXRIZWxwT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtzZXR0aW5nc09wZW4sIHNldFNldHRpbmdzT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtjb25mZXR0aUtleSwgc2V0Q29uZmV0dGlLZXldID0gdXNlU3RhdGUoMCk7XG4gIC8vIFBlci1mcmFtZSBwb3NpdGlvbiBvdmVycmlkZXMgKHVzZWQgZHVyaW5nIHNwaXJhbCBzbGlkZSBmb3IgZXhhY3QgcGF0aC1mb2xsb3dpbmcpXG4gIGNvbnN0IFt0b2tlbk92ZXJyaWRlLCBzZXRUb2tlbk92ZXJyaWRlXSA9IHVzZVN0YXRlKHt9KTsgLy8geyBbcGxheWVySWR4XTogeyB4LCB5IH0gfVxuXG4gIC8vIEFuaW1hdGUgYSB0b2tlbiBhbG9uZyB0aGUgZXhhY3Qgc3BpcmFsIHBhdGggKHNhbWUgZ2VvbWV0cnkgdGhlIFNWRyBkcmF3cykuXG4gIGNvbnN0IGFuaW1hdGVTcGlyYWxTbGlkZSA9IGFzeW5jIChwbGF5ZXJJZHgsIGZyb21TcSwgdG9TcSkgPT4ge1xuICAgIGNvbnN0IHBhdGggPSBzYW1wbGVTcGlyYWxQYXRoKGZyb21TcSwgdG9TcSwgMjgpO1xuICAgIGNvbnN0IHRvdGFsTXMgPSBzY2FsZU1zKDIyMDApO1xuICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICBjb25zdCBzdGFydFQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGNvbnN0IHN0ZXAgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5vdyA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICBjb25zdCB0ID0gTWF0aC5taW4oMSwgKG5vdyAtIHN0YXJ0VCkgLyB0b3RhbE1zKTtcbiAgICAgICAgLy8gRWFzZSBzbyB0aGUgdG9rZW4gYWNjZWxlcmF0ZXMgdGhyb3VnaCB0aGUgdG9wIGNvaWxzIGFuZCBzbG93cyBzbGlnaHRseSBhdCB0aGUgYm90dG9tXG4gICAgICAgIGNvbnN0IGVhc2VkID0gdCA8IDAuODUgPyAodCAvIDAuODUpIDogKDAuODUgKyAodCAtIDAuODUpICogMC43IC8gMC4xNSk7XG4gICAgICAgIGNvbnN0IHNlZyA9IGVhc2VkICogKHBhdGgubGVuZ3RoIC0gMSk7XG4gICAgICAgIGNvbnN0IGlkeCA9IE1hdGgubWluKHBhdGgubGVuZ3RoIC0gMSwgTWF0aC5mbG9vcihzZWcpKTtcbiAgICAgICAgY29uc3QgZiA9IHNlZyAtIGlkeDtcbiAgICAgICAgY29uc3QgYVAgPSBwYXRoW2lkeF07XG4gICAgICAgIGNvbnN0IGJQID0gcGF0aFtNYXRoLm1pbihwYXRoLmxlbmd0aCAtIDEsIGlkeCArIDEpXTtcbiAgICAgICAgY29uc3QgeCA9IGFQLnggKyAoYlAueCAtIGFQLngpICogZjtcbiAgICAgICAgY29uc3QgeSA9IGFQLnkgKyAoYlAueSAtIGFQLnkpICogZjtcbiAgICAgICAgc2V0VG9rZW5PdmVycmlkZShvID0+ICh7IC4uLm8sIFtwbGF5ZXJJZHhdOiB7IHgsIHkgfSB9KSk7XG4gICAgICAgIGlmICh0ID49IDEpIHsgcmVzb2x2ZSgpOyByZXR1cm47IH1cbiAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHN0ZXApO1xuICAgICAgfTtcbiAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShzdGVwKTtcbiAgICB9KTtcbiAgICAvLyBTbmFwIHRvIGZpbmFsIHNxdWFyZSBhbmQgZHJvcCB0aGUgb3ZlcnJpZGUgc28gdGhlIHRva2VuIHJlbG9ja3MgdG8gdGhlIGdyaWRcbiAgICBzZXRQb3NpdGlvbnMocCA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gWy4uLnBdO1xuICAgICAgbmV4dFtwbGF5ZXJJZHhdID0gdG9TcTtcbiAgICAgIHJldHVybiBuZXh0O1xuICAgIH0pO1xuICAgIHNldFRva2VuT3ZlcnJpZGUobyA9PiB7XG4gICAgICBjb25zdCBuID0geyAuLi5vIH07XG4gICAgICBkZWxldGUgbltwbGF5ZXJJZHhdO1xuICAgICAgcmV0dXJuIG47XG4gICAgfSk7XG4gIH07XG5cbiAgY29uc3QgYWlEaWZmaWN1bHR5ID0gY29uZmlnLmFpRGlmZmljdWx0eSB8fCAnbm9ybWFsJztcbiAgY29uc3QgYWlTcGVlZCA9IHNjYWxlTXMoeyBlYXN5OiAxNjAwLCBub3JtYWw6IDEwMDAsIGhhcmQ6IDYwMCB9W2FpRGlmZmljdWx0eV0pO1xuXG4gIGNvbnN0IGFkZExvZyA9IChlbnRyeSkgPT4ge1xuICAgIHNldExvZyhsID0+IFtlbnRyeSwgLi4ubF0uc2xpY2UoMCwgNDApKTtcbiAgfTtcblxuICBjb25zdCBpc0FJVHVybiA9IGNvbmZpZy5wbGF5ZXJzW2N1cnJlbnRdPy5pc0FJO1xuXG4gIC8vIEFuaW1hdGUgdG9rZW4gYWR2YW5jaW5nIG9uZSBzcXVhcmUgYXQgYSB0aW1lXG4gIGNvbnN0IGFuaW1hdGVNb3ZlID0gYXN5bmMgKHBsYXllcklkeCwgZnJvbVNxLCB0b1NxKSA9PiB7XG4gICAgbGV0IGN1ciA9IGZyb21TcTtcbiAgICB3aGlsZSAoY3VyIDwgdG9TcSkge1xuICAgICAgY3VyICs9IDE7XG4gICAgICBzZXRQb3NpdGlvbnMocCA9PiB7XG4gICAgICAgIGNvbnN0IG5leHQgPSBbLi4ucF07XG4gICAgICAgIG5leHRbcGxheWVySWR4XSA9IGN1cjtcbiAgICAgICAgcmV0dXJuIG5leHQ7XG4gICAgICB9KTtcbiAgICAgIGF3YWl0IHNsZWVwKHNjYWxlTXMoVC50b2tlblN0ZXBNcykpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBzbGVlcCA9IChtcykgPT4gbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIG1zKSk7XG5cbiAgY29uc3Qgcm9sbERpY2VJbkZsaWdodFJlZiA9IFJlYWN0LnVzZVJlZihmYWxzZSk7XG4gIGNvbnN0IHJvbGxEaWNlID0gYXN5bmMgKCkgPT4ge1xuICAgIC8vIEd1YXJkIGFnYWluc3QgZG91YmxlLWZpcmUgZnJvbSBhIHN0YWxlLWNsb3N1cmUgQUkgdXNlRWZmZWN0IG9yIHJhcGlkLWNsaWNrIHJhY2U6XG4gICAgLy8gZXZlbiBpZiBwaGFzZT09PXdhaXRpbmcgcGFzc2VkIG9uY2UsIHR3byBjb25jdXJyZW50IHJvbGxzIHdvdWxkIGNvcnJ1cHQgcG9zaXRpb25zLlxuICAgIGlmIChwaGFzZSAhPT0gJ3dhaXRpbmcnIHx8IHdpbm5lciAhPT0gbnVsbCB8fCByb2xsRGljZUluRmxpZ2h0UmVmLmN1cnJlbnQpIHJldHVybjtcbiAgICByb2xsRGljZUluRmxpZ2h0UmVmLmN1cnJlbnQgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgc2V0UGhhc2UoJ3JvbGxpbmcnKTtcbiAgICBzZXRSb2xsaW5nKHRydWUpO1xuXG4gICAgLy8gRGljZSBkb2VzIHJlYWwgcGh5c2ljczogZmxpbmcg4oaSIGJvdW5jZSBvZmYgd2FsbHMg4oaSIHNldHRsZSDihpIgc2hvdyBmb3IgMnMg4oaSIHJldHVybiBob21lLlxuICAgIC8vIFdoaWxlIHBoeXNpY3MgcnVucyB3ZSByYXBpZGx5IGN5Y2xlIHRoZSB2aXNpYmxlIGZhY2Ugc28gaXQgdHVtYmxlcyBkcmFtYXRpY2FsbHkuXG4gICAgLy8gUGh5c2ljcyBkdXJhdGlvbiBpcyB+MS404oCTMS42cyAoc2V0IGluc2lkZSB0aGUgRGljZSBjb21wb25lbnQpLiBNYXRjaCBpdCBoZXJlLlxuICAgIGNvbnN0IHBoeXNpY3NNcyA9IFQuaW5zdGFudFJvbGxzID8gMCA6IHNjYWxlTXMoMTQwMCk7XG4gICAgaWYgKHBoeXNpY3NNcyA+IDApIHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICAgIHdoaWxlIChEYXRlLm5vdygpIC0gc3RhcnQgPCBwaHlzaWNzTXMpIHtcbiAgICAgICAgc2V0RGljZVZhbHVlKDEgKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiA2KSk7XG4gICAgICAgIGF3YWl0IHNsZWVwKDgwKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByb2xsID0gMSArIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDYpO1xuICAgIHNldERpY2VWYWx1ZShyb2xsKTtcbiAgICBzZXRSb2xsaW5nKGZhbHNlKTsgLy8gdHJpZ2dlcnMgc2V0dGxlLXRvLWZhY2UgYW5pbWF0aW9uIGluIERpY2VcblxuICAgIC8vIEhvbGQgc28gdGhlIGRpY2UgZnVsbHkgY29tcGxldGVzIGl0cyBwaHlzaWNzIGFyYyAoc2V0dGxlIGF0IGxhbmRlZCBzcG90LCBzaG93IGZhY2UsXG4gICAgLy8gc3ByaW5nIGhvbWUpIEJFRk9SRSB0aGUgbW92ZSBzdGFydHMuIH4xLjVzIG9mIGRpY2UgbW90aW9uICsgfjcwMG1zIHJlYWQtYnVmZmVyLlxuICAgIGF3YWl0IHNsZWVwKHNjYWxlTXMoMjIwMCkpO1xuXG4gICAgY29uc3QgcGxheWVyID0gY29uZmlnLnBsYXllcnNbY3VycmVudF07XG4gICAgY29uc3QgZnJvbSA9IHBvc2l0aW9uc1tjdXJyZW50XTtcbiAgICBsZXQgdGFyZ2V0ID0gZnJvbSArIHJvbGw7XG5cbiAgICAvLyBSdWxlOiBleGFjdCBsYW5kaW5nIChvdmVyc2hvb3QgPSBzdGF5KSBPUiBzb2Z0IGxhbmRpbmcgKG92ZXJzaG9vdCA9IHdoYXRldmVyIGZpdHM7IGxhbmRzIG9uIDEwMCBhbnl3YXkpXG4gICAgaWYgKHRhcmdldCA+IDEwMCkge1xuICAgICAgaWYgKFQuZXhhY3RMYW5kaW5nKSB7XG4gICAgICAgIGFkZExvZyh7IHR5cGU6ICdib3VuY2UnLCBwbGF5ZXI6IHBsYXllci5uYW1lLCByb2xsIH0pO1xuICAgICAgICBpZiAocGxheWVyLmlzQUkpIHtcbiAgICAgICAgICBzZXRCbGlwTW9vZCgnc2FkJyk7XG4gICAgICAgICAgc2V0QmxpcExpbmUoXCJPdmVyc2hvdCAxMDAhIEkgc3RheSBwdXQuXCIpO1xuICAgICAgICB9XG4gICAgICAgIGF3YWl0IHNsZWVwKHNjYWxlTXMoOTAwKSk7XG4gICAgICAgIGVuZFR1cm4oKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gYm91bmNlLWJhY2sgcnVsZTogcmVmbGVjdCBvdmVyc2hvb3RcbiAgICAgICAgdGFyZ2V0ID0gMTAwIC0gKHRhcmdldCAtIDEwMCk7XG4gICAgICAgIGFkZExvZyh7IHR5cGU6ICdyb2xsJywgcGxheWVyOiBwbGF5ZXIubmFtZSwgcm9sbCwgZnJvbSwgdG86IHRhcmdldCB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYWRkTG9nKHsgdHlwZTogJ3JvbGwnLCBwbGF5ZXI6IHBsYXllci5uYW1lLCByb2xsLCBmcm9tLCB0bzogdGFyZ2V0IH0pO1xuICAgIH1cblxuICAgIGlmIChwbGF5ZXIuaXNBSSkge1xuICAgICAgc2V0QmxpcExpbmUocm9sbCA+PSA0ID8gcmFuZExpbmUoJ2dvb2RSb2xsJykgOiByYW5kTGluZSgnYmFkUm9sbCcpKTtcbiAgICAgIHNldEJsaXBNb29kKHJvbGwgPj0gNCA/ICdoYXBweScgOiAndGhpbmtpbmcnKTtcbiAgICB9XG5cbiAgICAvLyBNb3ZlXG4gICAgc2V0UGhhc2UoJ21vdmluZycpO1xuICAgIGF3YWl0IGFuaW1hdGVNb3ZlKGN1cnJlbnQsIGZyb20sIHRhcmdldCk7XG4gICAgYXdhaXQgc2xlZXAoc2NhbGVNcygzMDApKTtcblxuICAgIC8vIENoZWNrIGNodXRlXG4gICAgaWYgKENIVVRFU1t0YXJnZXRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIFBPUlRBTDogcmFuZG9tIGRlc3RpbmF0aW9uXG4gICAgICBpZiAoUE9SVEFMX1NRVUFSRVMuaGFzKHRhcmdldCkpIHtcbiAgICAgICAgLy8gcGljayBhIHJhbmRvbSBkZXN0aW5hdGlvbiwgZXhjbHVkaW5nIGN1cnJlbnQgYW5kIDEwMCAoc28gcGxheWVyIHN0aWxsIGhhcyB0byBlYXJuIHRoZSB3aW4pXG4gICAgICAgIGNvbnN0IGNob2ljZXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPD0gOTk7IGkrKykgaWYgKGkgIT09IHRhcmdldCkgY2hvaWNlcy5wdXNoKGkpO1xuICAgICAgICBjb25zdCBkZXN0ID0gY2hvaWNlc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjaG9pY2VzLmxlbmd0aCldO1xuICAgICAgICBzZXRIaWdobGlnaHQodGFyZ2V0KTtcbiAgICAgICAgYXdhaXQgc2xlZXAoc2NhbGVNcyg1NTApKTtcbiAgICAgICAgc2V0UGhhc2UoJ3BvcnRhbGluZycpO1xuICAgICAgICBhZGRMb2coeyB0eXBlOiAncG9ydGFsJywgcGxheWVyOiBwbGF5ZXIubmFtZSwgZnJvbTogdGFyZ2V0LCB0bzogZGVzdCB9KTtcbiAgICAgICAgaWYgKHBsYXllci5pc0FJKSB7XG4gICAgICAgICAgc2V0QmxpcExpbmUoXCJBIHBvcnRhbD8hIFJlY2FsY3VsYXRpbmcgd2lsZGx5IVwiKTtcbiAgICAgICAgICBzZXRCbGlwTW9vZCgndGhpbmtpbmcnKTtcbiAgICAgICAgfSBlbHNlIGlmIChjb25maWcucGxheWVycy5zb21lKHAgPT4gcC5pc0FJKSkge1xuICAgICAgICAgIHNldEJsaXBMaW5lKFwiQSByYW5kb20tdHJhbnNwb3J0IHBvcnRhbCEgV2hlcmUnbGwgeW91IGxhbmQ/XCIpO1xuICAgICAgICAgIHNldEJsaXBNb29kKCdoYXBweScpO1xuICAgICAgICB9XG4gICAgICAgIC8vIHRocm93IGFuaW1hdGlvbjogdGhlIENTUyAudG9rZW4ucG9ydGFsaW5nIGhhbmRsZXMgdGhlIGFyYyArIHNwaW5cbiAgICAgICAgc2V0UG9zaXRpb25zKHAgPT4ge1xuICAgICAgICAgIGNvbnN0IG5leHQgPSBbLi4ucF07XG4gICAgICAgICAgbmV4dFtjdXJyZW50XSA9IGRlc3Q7XG4gICAgICAgICAgcmV0dXJuIG5leHQ7XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBzbGVlcChzY2FsZU1zKDk1MCkpO1xuICAgICAgICBzZXRIaWdobGlnaHQobnVsbCk7XG4gICAgICAgIHRhcmdldCA9IGRlc3Q7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBkZXN0ID0gQ0hVVEVTW3RhcmdldF07XG4gICAgICAgIGNvbnN0IGNodXRlRW50cnkgPSBDSFVURVNfTElTVC5maW5kKGMgPT4gYy5mcm9tID09PSB0YXJnZXQpO1xuICAgICAgICBzZXRIaWdobGlnaHQodGFyZ2V0KTtcbiAgICAgICAgYXdhaXQgc2xlZXAoc2NhbGVNcyg0NTApKTtcbiAgICAgICAgaWYgKGNodXRlRW50cnk/LnNwaXJhbCkge1xuICAgICAgICAgIC8vIEJpZyAzRCBzcGlyYWwgc2xpZGUg4oCUIHJpZGUgdGhlIGV4YWN0IHNwaXJhbCBwYXRoXG4gICAgICAgICAgc2V0UGhhc2UoJ3NwaXJhbGluZycpO1xuICAgICAgICAgIGFkZExvZyh7IHR5cGU6ICdjaHV0ZScsIHBsYXllcjogcGxheWVyLm5hbWUsIGZyb206IHRhcmdldCwgdG86IGRlc3QgfSk7XG4gICAgICAgICAgaWYgKHBsYXllci5pc0FJKSB7XG4gICAgICAgICAgICBzZXRCbGlwTGluZShcIldob29vb2Eg4oCUIGRvd24gdGhlIHNwaXJhbCFcIik7XG4gICAgICAgICAgICBzZXRCbGlwTW9vZCgnc2FkJyk7XG4gICAgICAgICAgfSBlbHNlIGlmIChjb25maWcucGxheWVycy5zb21lKHAgPT4gcC5pc0FJKSkge1xuICAgICAgICAgICAgc2V0QmxpcExpbmUoXCJUaGUgYmlnIHNwaXJhbCEgSG9sZCBvbiB0aWdodCFcIik7XG4gICAgICAgICAgICBzZXRCbGlwTW9vZCgnaGFwcHknKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYXdhaXQgYW5pbWF0ZVNwaXJhbFNsaWRlKGN1cnJlbnQsIHRhcmdldCwgZGVzdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2V0UGhhc2UoJ3NsaWRpbmcnKTtcbiAgICAgICAgICBhZGRMb2coeyB0eXBlOiAnY2h1dGUnLCBwbGF5ZXI6IHBsYXllci5uYW1lLCBmcm9tOiB0YXJnZXQsIHRvOiBkZXN0IH0pO1xuICAgICAgICAgIGlmIChwbGF5ZXIuaXNBSSkge1xuICAgICAgICAgICAgc2V0QmxpcExpbmUocmFuZExpbmUoJ215Q2h1dGUnKSk7XG4gICAgICAgICAgICBzZXRCbGlwTW9vZCgnc2FkJyk7XG4gICAgICAgICAgfSBlbHNlIGlmIChpc0FJVHVybiA9PT0gZmFsc2UgJiYgY29uZmlnLnBsYXllcnMuc29tZShwID0+IHAuaXNBSSkpIHtcbiAgICAgICAgICAgIHNldEJsaXBMaW5lKHJhbmRMaW5lKCdjaHV0ZScpKTtcbiAgICAgICAgICAgIHNldEJsaXBNb29kKCd0aGlua2luZycpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBhbmltYXRlIHNsaWRlOiBzbmFwIHRvIGRlc3Qgd2l0aCB0cmFuc2l0aW9uXG4gICAgICAgICAgc2V0UG9zaXRpb25zKHAgPT4ge1xuICAgICAgICAgICAgY29uc3QgbmV4dCA9IFsuLi5wXTtcbiAgICAgICAgICAgIG5leHRbY3VycmVudF0gPSBkZXN0O1xuICAgICAgICAgICAgcmV0dXJuIG5leHQ7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYXdhaXQgc2xlZXAoc2NhbGVNcyg3MDApKTtcbiAgICAgICAgfVxuICAgICAgICBzZXRIaWdobGlnaHQobnVsbCk7XG4gICAgICAgIHRhcmdldCA9IGRlc3Q7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChMQURERVJTW3RhcmdldF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZGVzdCA9IExBRERFUlNbdGFyZ2V0XTtcbiAgICAgIHNldEhpZ2hsaWdodCh0YXJnZXQpO1xuICAgICAgYXdhaXQgc2xlZXAoc2NhbGVNcyg0NTApKTtcbiAgICAgIHNldFBoYXNlKCdjbGltYmluZycpO1xuICAgICAgYWRkTG9nKHsgdHlwZTogJ2xhZGRlcicsIHBsYXllcjogcGxheWVyLm5hbWUsIGZyb206IHRhcmdldCwgdG86IGRlc3QgfSk7XG4gICAgICBpZiAocGxheWVyLmlzQUkpIHtcbiAgICAgICAgc2V0QmxpcExpbmUocmFuZExpbmUoJ215TGFkZGVyJykpO1xuICAgICAgICBzZXRCbGlwTW9vZCgnY2VsZWJyYXRpbmcnKTtcbiAgICAgIH0gZWxzZSBpZiAoY29uZmlnLnBsYXllcnMuc29tZShwID0+IHAuaXNBSSkpIHtcbiAgICAgICAgc2V0QmxpcExpbmUocmFuZExpbmUoJ2xhZGRlcicpKTtcbiAgICAgICAgc2V0QmxpcE1vb2QoJ2hhcHB5Jyk7XG4gICAgICB9XG4gICAgICAvLyBjbGltYjogc3RlcCB1cCBvbmUgcnVuZyBhdCBhIHRpbWUgZm9yIGVmZmVjdFxuICAgICAgbGV0IGN1ciA9IHRhcmdldDtcbiAgICAgIGNvbnN0IHN0ZXAgPSBkZXN0ID4gdGFyZ2V0ID8gMSA6IC0xO1xuICAgICAgd2hpbGUgKGN1ciAhPT0gZGVzdCkge1xuICAgICAgICBjdXIgKz0gc3RlcCAqIDQ7XG4gICAgICAgIGlmICgoc3RlcCA+IDAgJiYgY3VyID4gZGVzdCkgfHwgKHN0ZXAgPCAwICYmIGN1ciA8IGRlc3QpKSBjdXIgPSBkZXN0O1xuICAgICAgICBzZXRQb3NpdGlvbnMocCA9PiB7XG4gICAgICAgICAgY29uc3QgbmV4dCA9IFsuLi5wXTtcbiAgICAgICAgICBuZXh0W2N1cnJlbnRdID0gY3VyO1xuICAgICAgICAgIHJldHVybiBuZXh0O1xuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgc2xlZXAoc2NhbGVNcygxNDApKTtcbiAgICAgIH1cbiAgICAgIGF3YWl0IHNsZWVwKHNjYWxlTXMoNDAwKSk7XG4gICAgICBzZXRIaWdobGlnaHQobnVsbCk7XG4gICAgICB0YXJnZXQgPSBkZXN0O1xuICAgIH1cblxuICAgIC8vIFdpbj9cbiAgICBpZiAodGFyZ2V0ID09PSAxMDApIHtcbiAgICAgIHNldFdpbm5lcihjdXJyZW50KTtcbiAgICAgIHNldFBoYXNlKCd3b24nKTtcbiAgICAgIHNldENvbmZldHRpS2V5KGsgPT4gayArIDEpO1xuICAgICAgaWYgKHBsYXllci5pc0FJKSB7XG4gICAgICAgIHNldEJsaXBMaW5lKHJhbmRMaW5lKCd3aW4nKSk7XG4gICAgICAgIHNldEJsaXBNb29kKCdjZWxlYnJhdGluZycpO1xuICAgICAgfSBlbHNlIGlmIChjb25maWcucGxheWVycy5zb21lKHAgPT4gcC5pc0FJKSkge1xuICAgICAgICBzZXRCbGlwTGluZShyYW5kTGluZSgnbG9zZScpKTtcbiAgICAgICAgc2V0QmxpcE1vb2QoJ3NhZCcpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFwiTmVhclwiIHRhdW50XG4gICAgaWYgKHRhcmdldCA+PSA5MCAmJiBwbGF5ZXIuaXNBSSA9PT0gZmFsc2UgJiYgY29uZmlnLnBsYXllcnMuc29tZShwID0+IHAuaXNBSSkpIHtcbiAgICAgIGlmIChNYXRoLnJhbmRvbSgpIDwgMC40KSB7XG4gICAgICAgIHNldEJsaXBMaW5lKHJhbmRMaW5lKCduZWFyJykpO1xuICAgICAgICBzZXRCbGlwTW9vZCgndGhpbmtpbmcnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhd2FpdCBzbGVlcChzY2FsZU1zKDUwMCkpO1xuICAgIGVuZFR1cm4oKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgcm9sbERpY2VJbkZsaWdodFJlZi5jdXJyZW50ID0gZmFsc2U7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGVuZFR1cm4gPSAoKSA9PiB7XG4gICAgc2V0Q3VycmVudChjID0+IChjICsgMSkgJSBjb25maWcucGxheWVycy5sZW5ndGgpO1xuICAgIHNldFBoYXNlKCd3YWl0aW5nJyk7XG4gIH07XG5cbiAgLy8gQUkgYXV0by1yb2xsc1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChwaGFzZSA9PT0gJ3dhaXRpbmcnICYmIGlzQUlUdXJuICYmICF3aW5uZXIpIHtcbiAgICAgIHNldEJsaXBMaW5lKHJhbmRMaW5lKCdteVR1cm4nKSk7XG4gICAgICBzZXRCbGlwTW9vZCgndGhpbmtpbmcnKTtcbiAgICAgIGNvbnN0IHQgPSBzZXRUaW1lb3V0KCgpID0+IHsgcm9sbERpY2UoKTsgfSwgYWlTcGVlZCk7XG4gICAgICByZXR1cm4gKCkgPT4gY2xlYXJUaW1lb3V0KHQpO1xuICAgIH1cbiAgfSwgW3BoYXNlLCBjdXJyZW50LCB3aW5uZXJdKTtcblxuICBjb25zdCBwbGF5QWdhaW4gPSAoKSA9PiB7XG4gICAgc2V0UG9zaXRpb25zKGNvbmZpZy5wbGF5ZXJzLm1hcCgoKSA9PiAwKSk7XG4gICAgc2V0Q3VycmVudCgwKTtcbiAgICBzZXREaWNlVmFsdWUoMSk7XG4gICAgc2V0UGhhc2UoJ3dhaXRpbmcnKTtcbiAgICBzZXRMb2coW10pO1xuICAgIHNldFdpbm5lcihudWxsKTtcbiAgICBzZXRIaWdobGlnaHQobnVsbCk7XG4gICAgc2V0VG9rZW5PdmVycmlkZSh7fSk7IC8vIENsZWFyIGFueSBtaWQtc3BpcmFsIG92ZXJyaWRlIHRoYXQgc3Vydml2ZWQgYSBxdWl0L3dpblxuICAgIHNldEJsaXBMaW5lKHJhbmRMaW5lKCdzdGFydCcpKTtcbiAgICBzZXRCbGlwTW9vZCgnaGFwcHknKTtcbiAgfTtcblxuICBjb25zdCBjdXJQbGF5ZXIgPSBjb25maWcucGxheWVyc1tjdXJyZW50XTtcbiAgY29uc3QgaGFzQUkgPSBjb25maWcucGxheWVycy5zb21lKHAgPT4gcC5pc0FJKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwiZ2FtZS13cmFwXCI+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImdhbWUtaW5uZXJcIj5cbiAgICAgICAgey8qIFNpZGViYXIgKi99XG4gICAgICAgIDxhc2lkZSBjbGFzc05hbWU9XCJzaWRlYmFyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzYi10b3BcIj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwiaWNvbi1idG5cIiBvbkNsaWNrPXtvblF1aXR9IHRpdGxlPVwiQmFjayB0byBtZW51XCIgYXJpYS1sYWJlbD1cIkJhY2sgdG8gbWFpbiBtZW51XCI+XG4gICAgICAgICAgICAgIDxzdmcgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PHBhdGggZD1cIk0xNSAxOWwtNy03IDctN1wiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZVdpZHRoPVwiMlwiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIi8+PC9zdmc+XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic2ItdGl0bGUgc2VyaWZcIj5DbGltYiAmIFNsaWRlPC9kaXY+XG4gICAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cImljb24tYnRuIHNiLXNldHRpbmdzXCIgb25DbGljaz17KCkgPT4gc2V0U2V0dGluZ3NPcGVuKHRydWUpfSB0aXRsZT1cIlNldHRpbmdzXCIgYXJpYS1sYWJlbD1cIk9wZW4gc2V0dGluZ3NcIj5cbiAgICAgICAgICAgICAgPHN2ZyB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBhcmlhLWhpZGRlbj1cInRydWVcIj5cbiAgICAgICAgICAgICAgICA8Y2lyY2xlIGN4PVwiMTJcIiBjeT1cIjEyXCIgcj1cIjNcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2VXaWR0aD1cIjJcIi8+XG4gICAgICAgICAgICAgICAgPHBhdGggZD1cIk0xOS40IDE1YTEuNyAxLjcgMCAwIDAgLjM0IDEuODdsLjA2LjA2YTIgMiAwIDEgMS0yLjgzIDIuODNsLS4wNi0uMDZBMS43IDEuNyAwIDAgMCAxNSAxOS40YTEuNyAxLjcgMCAwIDAtMSAxLjU1VjIxYTIgMiAwIDEgMS00IDB2LS4xQTEuNyAxLjcgMCAwIDAgOSAxOS40YTEuNyAxLjcgMCAwIDAtMS44Ny4zNGwtLjA2LjA2YTIgMiAwIDEgMS0yLjgzLTIuODNsLjA2LS4wNkExLjcgMS43IDAgMCAwIDQuNiAxNWExLjcgMS43IDAgMCAwLTEuNTUtMUgzYTIgMiAwIDEgMSAwLTRoLjFBMS43IDEuNyAwIDAgMCA0LjYgOWExLjcgMS43IDAgMCAwLS4zNC0xLjg3bC0uMDYtLjA2YTIgMiAwIDEgMSAyLjgzLTIuODNsLjA2LjA2QTEuNyAxLjcgMCAwIDAgOSA0LjZhMS43IDEuNyAwIDAgMCAxLTEuNTVWM2EyIDIgMCAxIDEgNCAwdi4xQTEuNyAxLjcgMCAwIDAgMTUgNC42YTEuNyAxLjcgMCAwIDAgMS44Ny0uMzRsLjA2LS4wNmEyIDIgMCAxIDEgMi44MyAyLjgzbC0uMDYuMDZBMS43IDEuNyAwIDAgMCAxOS40IDljLjEuMzYuMzMuNjguNjUuOS4zMi4yMi43LjM2IDEuMS40SDIxYTIgMiAwIDEgMSAwIDRoLS4xYTEuNyAxLjcgMCAwIDAtMS41IDFaXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlV2lkdGg9XCIxLjdcIiBzdHJva2VMaW5lY2FwPVwicm91bmRcIiBzdHJva2VMaW5lam9pbj1cInJvdW5kXCIvPlxuICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgey8qIFBsYXllcnMg4oCUIHNvcnRlZCBieSByYW5rICovfVxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGxheWVycy1wYW5lbFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZWN0aW9uLWxhYmVsIG1vbm9cIj5MRUFERVJCT0FSRDwvZGl2PlxuICAgICAgICAgICAgeygoKSA9PiB7XG4gICAgICAgICAgICAgIC8vIGNvbXB1dGUgcmFuazogaGlnaGVyIHNxdWFyZSA9IGJldHRlcjsgdGllID0gb3JpZ2luYWwgb3JkZXJcbiAgICAgICAgICAgICAgY29uc3QgcmFua2VkID0gY29uZmlnLnBsYXllcnNcbiAgICAgICAgICAgICAgICAubWFwKChwLCBpKSA9PiAoeyBwLCBpLCBwb3M6IHBvc2l0aW9uc1tpXSB9KSlcbiAgICAgICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5wb3MgLSBhLnBvcyB8fCBhLmkgLSBiLmkpO1xuICAgICAgICAgICAgICAvLyBhc3NpZ24gcmFuayBudW1iZXJzICh0aWVzIHNoYXJlIHJhbmspXG4gICAgICAgICAgICAgIGxldCBsYXN0UG9zID0gbnVsbCwgbGFzdFJhbmsgPSAwO1xuICAgICAgICAgICAgICByYW5rZWQuZm9yRWFjaCgociwgaWR4KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHIucG9zICE9PSBsYXN0UG9zKSB7IGxhc3RSYW5rID0gaWR4ICsgMTsgbGFzdFBvcyA9IHIucG9zOyB9XG4gICAgICAgICAgICAgICAgci5yYW5rID0gbGFzdFJhbms7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICByZXR1cm4gcmFua2VkLm1hcCgoeyBwLCBpLCByYW5rIH0pID0+IChcbiAgICAgICAgICAgICAgPGRpdiBrZXk9e3AuaWR9IGNsYXNzTmFtZT17YHBsYXllci1yb3cgJHtpID09PSBjdXJyZW50ICYmICF3aW5uZXIgPyAnYWN0aXZlJyA6ICcnfSAke3dpbm5lciA9PT0gaSA/ICd3aW5uZXInIDogJyd9YH0+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9e2ByYW5rLWJhZGdlIHJhbmstJHtyYW5rfWB9PlxuICAgICAgICAgICAgICAgICAge3JhbmsgPT09IDEgPyAnMXN0JyA6IHJhbmsgPT09IDIgPyAnMm5kJyA6IHJhbmsgPT09IDMgPyAnM3JkJyA6IHJhbmsgKyAndGgnfVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIHtwLmlzQUkgPyAoXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFpLWF2YXRhclwiIHN0eWxlPXt7IGJveFNoYWRvdzogaSA9PT0gY3VycmVudCAmJiAhd2lubmVyID8gYDAgMCAwIDNweCB2YXIoLS1iZyksIDAgMCAwIDVweCAke3AuY29sb3J9YCA6ICdub25lJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgPFJvYm90IHNpemU9ezM2fSBjb2xvcj1cIiNmN2YxZTRcIiBtb29kPXtpID09PSBjdXJyZW50ICYmIHBoYXNlICE9PSAnd2FpdGluZycgPyAndGhpbmtpbmcnIDogYmxpcE1vb2R9Lz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICkgOiBwLmNoYXJJZCA/IChcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY2hhci1hdmF0YXJcIiBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiBwLmNvbG9yICsgJzIyJyxcbiAgICAgICAgICAgICAgICAgICAgYm94U2hhZG93OiBpID09PSBjdXJyZW50ICYmICF3aW5uZXIgPyBgMCAwIDAgM3B4IHZhcigtLWJnKSwgMCAwIDAgNXB4ICR7cC5jb2xvcn1gIDogJ25vbmUnXG4gICAgICAgICAgICAgICAgICB9fT5cbiAgICAgICAgICAgICAgICAgICAgPENoYXJhY3RlciBjaGFySWQ9e3AuY2hhcklkfSBzaXplPXs0MH0vPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgIDxBdmF0YXIgbGFiZWw9e3AubGFiZWx9IGNvbG9yPXtwLmNvbG9yfSBzaXplPXs0MH0gaXNDdXJyZW50PXtpID09PSBjdXJyZW50ICYmICF3aW5uZXJ9Lz5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGxheWVyLWluZm9cIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGxheWVyLW5hbWVcIj57cC5uYW1lfXtwLmlzQUkgJiYgPHNwYW4gY2xhc3NOYW1lPVwiYWktdGFnIG1vbm9cIiBhcmlhLWxhYmVsPVwiUm9ib3Qgb3Bwb25lbnRcIj5CT1Q8L3NwYW4+fXtpID09PSBjdXJyZW50ICYmICF3aW5uZXIgJiYgPHNwYW4gY2xhc3NOYW1lPVwidHVybi1waWxsIG1vbm9cIj5UVVJOPC9zcGFuPn08L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGxheWVyLXBvcyBtb25vXCI+XG4gICAgICAgICAgICAgICAgICAgIHtwb3NpdGlvbnNbaV0gPT09IDAgPyAnU1RBUlQnIDogYFNRLiAke3Bvc2l0aW9uc1tpXX1gfVxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwbGF5ZXItcHJvZ1wiPlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwcm9nLWZpbGxcIiBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IGAke3Bvc2l0aW9uc1tpXX0lYCxcbiAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZDogcC5jb2xvcixcbiAgICAgICAgICAgICAgICAgIH19Lz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgfSkoKX1cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIHsvKiBCTElQIGNoYXQgYm94ICovfVxuICAgICAgICAgIHtoYXNBSSAmJiBULnNob3dCbGlwUGFuZWwgJiYgKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJibGlwLXBhbmVsXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmxpcC1mYWNlXCI+XG4gICAgICAgICAgICAgICAgPFJvYm90IHNpemU9ezU0fSBjb2xvcj1cIiNmN2YxZTRcIiBtb29kPXtibGlwTW9vZH0vPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJibGlwLWJ1YmJsZVwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmxpcC1uYW1lIG1vbm9cIj5CTElQPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJibGlwLXRleHRcIj57YmxpcExpbmV9PC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cblxuICAgICAgICAgIHsvKiBMb2cgKi99XG4gICAgICAgICAge1Quc2hvd0FjdGl2aXR5TG9nICYmIChcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImxvZy1wYW5lbFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZWN0aW9uLWxhYmVsIG1vbm9cIiBpZD1cImxvZy1oZWFkaW5nXCI+QUNUSVZJVFk8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibG9nLWxpc3RcIiByb2xlPVwibG9nXCIgYXJpYS1sYWJlbGxlZGJ5PVwibG9nLWhlYWRpbmdcIiBhcmlhLWxpdmU9XCJwb2xpdGVcIiBhcmlhLWF0b21pYz1cImZhbHNlXCIgYXJpYS1yZWxldmFudD1cImFkZGl0aW9uc1wiPlxuICAgICAgICAgICAgICB7bG9nLmxlbmd0aCA9PT0gMCAmJiA8ZGl2IGNsYXNzTmFtZT1cImxvZy1lbXB0eVwiPllvdXIgcm9sbHMgd2lsbCBhcHBlYXIgaGVyZS48L2Rpdj59XG4gICAgICAgICAgICAgIHtsb2cubWFwKChlLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgPGRpdiBrZXk9e2l9IGNsYXNzTmFtZT17YGxvZy1lbnRyeSAke2UudHlwZX1gfT5cbiAgICAgICAgICAgICAgICAgIHtlLnR5cGUgPT09ICdyb2xsJyAmJiA8PjxiPntlLnBsYXllcn08L2I+IHJvbGxlZCA8c3BhbiBjbGFzc05hbWU9XCJtb25vXCI+e2Uucm9sbH08L3NwYW4+IMK3IHtlLmZyb2194oaSe2UudG99PC8+fVxuICAgICAgICAgICAgICAgICAge2UudHlwZSA9PT0gJ2JvdW5jZScgJiYgPD48Yj57ZS5wbGF5ZXJ9PC9iPiByb2xsZWQge2Uucm9sbH0g4oCUIHRvbyBmYXIsIHN0YXllZCBwdXQ8Lz59XG4gICAgICAgICAgICAgICAgICB7ZS50eXBlID09PSAnY2h1dGUnICYmIDw+PGI+e2UucGxheWVyfTwvYj4gc2xpZCBkb3duIGEgY2h1dGUgPHNwYW4gY2xhc3NOYW1lPVwibW9ub1wiPntlLmZyb2194oaSe2UudG99PC9zcGFuPjwvPn1cbiAgICAgICAgICAgICAgICAgIHtlLnR5cGUgPT09ICdsYWRkZXInICYmIDw+PGI+e2UucGxheWVyfTwvYj4gY2xpbWJlZCBhIGxhZGRlciA8c3BhbiBjbGFzc05hbWU9XCJtb25vXCI+e2UuZnJvbX3ihpJ7ZS50b308L3NwYW4+PC8+fVxuICAgICAgICAgICAgICAgICAge2UudHlwZSA9PT0gJ3BvcnRhbCcgJiYgPD48Yj57ZS5wbGF5ZXJ9PC9iPiBoaXQgYSBwb3J0YWwg8J+MgCA8c3BhbiBjbGFzc05hbWU9XCJtb25vXCI+e2UuZnJvbX3ihpJ7ZS50b308L3NwYW4+PC8+fVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvYXNpZGU+XG5cbiAgICAgICAgey8qIEJvYXJkIGFyZWEgKi99XG4gICAgICAgIDxtYWluIGNsYXNzTmFtZT1cImJvYXJkLWFyZWFcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvYXJkLWhlYWRlclwiPlxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZWN0aW9uLWxhYmVsIG1vbm9cIj57d2lubmVyICE9PSBudWxsID8gJ0dBTUUgT1ZFUicgOiBpc0FJVHVybiA/ICdCTElQXFwnUyBUVVJOJyA6ICdZT1VSIFRVUk4nfTwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInR1cm4tbmFtZSBzZXJpZlwiPlxuICAgICAgICAgICAgICAgIHt3aW5uZXIgIT09IG51bGwgPyAoXG4gICAgICAgICAgICAgICAgICA8Pntjb25maWcucGxheWVyc1t3aW5uZXJdLm5hbWV9IHtjb25maWcucGxheWVyc1t3aW5uZXJdLm5hbWUgPT09ICdZb3UnID8gJ3dpbicgOiAnd2lucyd9ITwvPlxuICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICA8PntjdXJQbGF5ZXIubmFtZX08c3BhbiBjbGFzc05hbWU9XCJ0dXJuLWRvdFwiIHN0eWxlPXt7YmFja2dyb3VuZDogY3VyUGxheWVyLmNvbG9yfX0vPjwvPlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImhlYWRlci1tZXRhXCI+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJoZWxwLWJ0biBtb25vXCJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRIZWxwT3Blbih0cnVlKX1cbiAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiSG93IHRvIHBsYXlcIlxuICAgICAgICAgICAgICAgIHRpdGxlPVwiSG93IHRvIHBsYXlcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCI+Pzwvc3Bhbj4gSE9XIFRPIFBMQVlcbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicnVsZXMtdGFnXCIgdGl0bGU9e1QuZXhhY3RMYW5kaW5nID8gJ1lvdSBtdXN0IGxhbmQgZXhhY3RseSBvbiAxMDAgdG8gd2luLicgOiAnQW55IHJvbGwgcGFzdCAxMDAgYm91bmNlcyBiYWNrLid9PlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cIm1vbm9cIj57VC5leGFjdExhbmRpbmcgPyAnUk9MTCBFWEFDVExZIFRPIDEwMCcgOiAnQk9VTkNFIEJBQ0sgT0ZGIDEwMCd9PC9zcGFuPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgPEJvYXJkXG4gICAgICAgICAgICBwbGF5ZXJzPXtjb25maWcucGxheWVyc31cbiAgICAgICAgICAgIGN1cnJlbnRQbGF5ZXJJZHg9e2N1cnJlbnR9XG4gICAgICAgICAgICB0b2tlblBvc2l0aW9ucz17cG9zaXRpb25zfVxuICAgICAgICAgICAgaGlnaGxpZ2h0ZWRTcXVhcmU9e2hpZ2hsaWdodH1cbiAgICAgICAgICAgIHR3ZWFrcz17VH1cbiAgICAgICAgICAgIHBoYXNlPXtwaGFzZX1cbiAgICAgICAgICAgIHRva2VuT3ZlcnJpZGU9e3Rva2VuT3ZlcnJpZGV9XG4gICAgICAgICAgLz5cblxuICAgICAgICAgIHsvKiBEaWNlICsgUm9sbCBidXR0b24gKi99XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJkaWNlLWFyZWFcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZGljZS1zbG90XCI+XG4gICAgICAgICAgICAgIDxEaWNlXG4gICAgICAgICAgICAgICAgdmFsdWU9e2RpY2VWYWx1ZX1cbiAgICAgICAgICAgICAgICByb2xsaW5nPXtyb2xsaW5nfVxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3JvbGxEaWNlfVxuICAgICAgICAgICAgICAgIGRpc2FibGVkPXtwaGFzZSAhPT0gJ3dhaXRpbmcnIHx8IGlzQUlUdXJuIHx8ICEhd2lubmVyfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvbGwtaW5mb1wiPlxuICAgICAgICAgICAgICB7IXdpbm5lciAmJiBwaGFzZSA9PT0gJ3dhaXRpbmcnICYmICFpc0FJVHVybiAmJiAoXG4gICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm9sbC1wcm9tcHQgc2VyaWZcIj57VC5yb2xsQnV0dG9uTGFiZWx9PC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvbGwtaGludCBtb25vXCI+VEFQLCBPUiBQUkVTUyAmYW1wOyBGTElORyDimJ48L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm9sbC1zdWJoaW50XCI+V2lsbCBtb3ZlIHtkaWNlVmFsdWV9IGZyb20gc3F1YXJlIHtwb3NpdGlvbnNbY3VycmVudF19LjwvZGl2PlxuICAgICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICB7IXdpbm5lciAmJiBwaGFzZSA9PT0gJ3dhaXRpbmcnICYmIGlzQUlUdXJuICYmIChcbiAgICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb2xsLXByb21wdCBzZXJpZlwiPkJMSVAgaXMgdGhpbmtpbmfigKY8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm9sbC1oaW50IG1vbm9cIj5TVEFORCBCWTwvZGl2PlxuICAgICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICB7IXdpbm5lciAmJiBwaGFzZSAhPT0gJ3dhaXRpbmcnICYmIChcbiAgICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb2xsLXByb21wdCBzZXJpZlwiPlxuICAgICAgICAgICAgICAgICAgICB7cGhhc2UgPT09ICdyb2xsaW5nJyAmJiAnUm9sbGluZ+KApid9XG4gICAgICAgICAgICAgICAgICAgIHtwaGFzZSA9PT0gJ21vdmluZycgJiYgYE1vdmluZyArJHtkaWNlVmFsdWV9YH1cbiAgICAgICAgICAgICAgICAgICAge3BoYXNlID09PSAnc2xpZGluZycgJiYgJ1NsaWRpbmcgZG93biEg8J+bnSd9XG4gICAgICAgICAgICAgICAgICAgIHtwaGFzZSA9PT0gJ2NsaW1iaW5nJyAmJiAnQ2xpbWJpbmcgdXAhIPCfqpwnfVxuICAgICAgICAgICAgICAgICAgICB7cGhhc2UgPT09ICdwb3J0YWxpbmcnICYmICdQb3J0YWwhIFRlbGVwb3J0aW5n4oCmIPCfjIAnfVxuICAgICAgICAgICAgICAgICAgICB7cGhhc2UgPT09ICdzcGlyYWxpbmcnICYmICdXaG9vb29zaCEgRG93biB0aGUgc3BpcmFsISDwn4yA8J+bnSd9XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm9sbC1oaW50IG1vbm9cIj5TUS4ge3Bvc2l0aW9uc1tjdXJyZW50XX08L2Rpdj5cbiAgICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAge3dpbm5lciAhPT0gbnVsbCAmJiAoXG4gICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm9sbC1wcm9tcHQgc2VyaWZcIj7wn4+GIFdpbm5lciE8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwiYnRuIHByaW1hcnlcIiBvbkNsaWNrPXtwbGF5QWdhaW59PlBsYXkgYWdhaW48L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L21haW4+XG4gICAgICA8L2Rpdj5cblxuICAgICAge2hlbHBPcGVuICYmIDxIb3dUb1BsYXkgb25DbG9zZT17KCkgPT4gc2V0SGVscE9wZW4oZmFsc2UpfS8+fVxuICAgICAge3NldHRpbmdzT3BlbiAmJiA8U2V0dGluZ3NNb2RhbCB0d2Vha3M9e1R9IHNldFR3ZWFrcz17c2V0VHdlYWtzfSBvbkNsb3NlPXsoKSA9PiBzZXRTZXR0aW5nc09wZW4oZmFsc2UpfS8+fVxuXG4gICAgICB7LyogV2luIG92ZXJsYXkgKi99XG4gICAgICB7d2lubmVyICE9PSBudWxsICYmIChcbiAgICAgICAgPFdpbk92ZXJsYXlcbiAgICAgICAgICBrZXk9e2NvbmZldHRpS2V5fVxuICAgICAgICAgIHdpbm5lcj17eyAuLi5jb25maWcucGxheWVyc1t3aW5uZXJdLCBpZHg6IHdpbm5lciB9fVxuICAgICAgICAgIHBsYXllcnM9e2NvbmZpZy5wbGF5ZXJzfVxuICAgICAgICAgIHBvc2l0aW9ucz17cG9zaXRpb25zfVxuICAgICAgICAgIG9uUGxheUFnYWluPXtwbGF5QWdhaW59XG4gICAgICAgICAgb25RdWl0PXtvblF1aXR9XG4gICAgICAgICAgY29uZmV0dGlDb3VudD17VC5jb25mZXR0aURlbnNpdHl9XG4gICAgICAgIC8+XG4gICAgICApfVxuXG4gICAgICA8c3R5bGU+e2BcbiAgICAgICAgLmdhbWUtd3JhcCB7XG4gICAgICAgICAgbWluLWhlaWdodDogMTAwdmg7XG4gICAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xuICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICB9XG4gICAgICAgIC5nYW1lLWlubmVyIHtcbiAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICBtYXgtd2lkdGg6IDEyODBweDtcbiAgICAgICAgICBtaW4taGVpZ2h0OiBjYWxjKDEwMHZoIC0gNDBweCk7XG4gICAgICAgICAgZGlzcGxheTogZ3JpZDtcbiAgICAgICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDMyMHB4IDFmcjtcbiAgICAgICAgICBnYXA6IDI0cHg7XG4gICAgICAgICAgYWxpZ24taXRlbXM6IHN0cmV0Y2g7XG4gICAgICAgIH1cbiAgICAgICAgQG1lZGlhIChtYXgtd2lkdGg6IDkwMHB4KSB7XG4gICAgICAgICAgLmdhbWUtaW5uZXIgeyBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmcjsgZ3JpZC10ZW1wbGF0ZS1yb3dzOiBhdXRvIDFmcjsgb3ZlcmZsb3cteTogYXV0bzsgfVxuICAgICAgICAgIC5zaWRlYmFyIHsgbWF4LWhlaWdodDogbm9uZSAhaW1wb3J0YW50OyBwb3NpdGlvbjogc3RhdGljICFpbXBvcnRhbnQ7IH1cbiAgICAgICAgfVxuICAgICAgICAuc2lkZWJhciB7XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgIGdhcDogMTZweDtcbiAgICAgICAgICBwYWRkaW5nOiAxOHB4O1xuICAgICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNiwzMSw0NiwwLjA4KTtcbiAgICAgICAgICBib3gtc2hhZG93OiAwIDRweCAxNnB4IC04cHggcmdiYSgyNiwzMSw0NiwwLjEpO1xuICAgICAgICAgIHBvc2l0aW9uOiBzdGlja3k7XG4gICAgICAgICAgdG9wOiAyMHB4O1xuICAgICAgICAgIGFsaWduLXNlbGY6IHN0YXJ0O1xuICAgICAgICAgIG1heC1oZWlnaHQ6IGNhbGMoMTAwdmggLSA0MHB4KTtcbiAgICAgICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgICAgICB9XG4gICAgICAgIC5zaWRlYmFyOjotd2Via2l0LXNjcm9sbGJhciB7IHdpZHRoOiA2cHg7IH1cbiAgICAgICAgLnNpZGViYXI6Oi13ZWJraXQtc2Nyb2xsYmFyLXRodW1iIHsgYmFja2dyb3VuZDogcmdiYSgwLDAsMCwwLjEpOyBib3JkZXItcmFkaXVzOiAzcHg7IH1cbiAgICAgICAgLnNiLXRvcCB7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTBweDsgfVxuICAgICAgICAuc2ItdG9wIC5zYi10aXRsZSB7IGZsZXg6IDE7IH1cbiAgICAgICAgLnNiLXRpdGxlIHsgZm9udC1zaXplOiAyMHB4OyBmb250LXdlaWdodDogNzAwOyB9XG4gICAgICAgIC5oZWFkZXItbWV0YSB7XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgIGdhcDogMTJweDtcbiAgICAgICAgICBmbGV4LXdyYXA6IHdyYXA7XG4gICAgICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcbiAgICAgICAgfVxuICAgICAgICAuaGVscC1idG4ge1xuICAgICAgICAgIGZvbnQtc2l6ZTogMTBweDtcbiAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC4xNWVtO1xuICAgICAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgICAgICAgcGFkZGluZzogNnB4IDEwcHg7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctMik7XG4gICAgICAgICAgY29sb3I6IHZhcigtLWluayk7XG4gICAgICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICBnYXA6IDRweDtcbiAgICAgICAgfVxuICAgICAgICAuaGVscC1idG46aG92ZXIgeyBiYWNrZ3JvdW5kOiAjZDhjY2FmOyB9XG4gICAgICAgIC5oZWxwLWJ0biBzcGFuW2FyaWEtaGlkZGVuXSB7XG4gICAgICAgICAgd2lkdGg6IDE0cHg7IGhlaWdodDogMTRweDtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiA1MCU7XG4gICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0taW5rKTtcbiAgICAgICAgICBjb2xvcjogdmFyKC0tYmcpO1xuICAgICAgICAgIGZvbnQtc2l6ZTogMTBweDtcbiAgICAgICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgLmljb24tYnRuIHtcbiAgICAgICAgICB3aWR0aDogMzJweDsgaGVpZ2h0OiAzMnB4O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy0yKTtcbiAgICAgICAgICBjb2xvcjogdmFyKC0taW5rKTtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgLmljb24tYnRuOmhvdmVyIHsgYmFja2dyb3VuZDogI2Q4Y2NhZjsgfVxuICAgICAgICAuc2VjdGlvbi1sYWJlbCB7XG4gICAgICAgICAgZm9udC1zaXplOiAxMHB4O1xuICAgICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjE1ZW07XG4gICAgICAgICAgY29sb3I6IHZhcigtLW11dGUpO1xuICAgICAgICAgIG1hcmdpbi1ib3R0b206IDZweDtcbiAgICAgICAgfVxuICAgICAgICAucGxheWVycy1wYW5lbCB7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IGdhcDogOHB4OyB9XG4gICAgICAgIC5wbGF5ZXItcm93IHtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgZ2FwOiAxMnB4O1xuICAgICAgICAgIHBhZGRpbmc6IDEwcHggMTJweCAxMHB4IDEwcHg7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogMTJweDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZyk7XG4gICAgICAgICAgYm9yZGVyOiAxLjVweCBzb2xpZCB0cmFuc3BhcmVudDtcbiAgICAgICAgICB0cmFuc2l0aW9uOiBhbGwgMC4yNXM7XG4gICAgICAgIH1cbiAgICAgICAgLnBsYXllci1yb3cuYWN0aXZlIHtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgICBib3JkZXItY29sb3I6IHZhcigtLWluayk7XG4gICAgICAgICAgYm94LXNoYWRvdzogMCAycHggMCByZ2JhKDI2LDMxLDQ2LDAuMDgpO1xuICAgICAgICAgIGFuaW1hdGlvbjogcm93LWdsb3cgMnMgZWFzZS1pbi1vdXQgaW5maW5pdGU7XG4gICAgICAgIH1cbiAgICAgICAgQGtleWZyYW1lcyByb3ctZ2xvdyB7XG4gICAgICAgICAgMCUsIDEwMCUgeyBib3gtc2hhZG93OiAwIDJweCAwIHJnYmEoMjYsMzEsNDYsMC4wOCksIDAgMCAwIDAgcmdiYSgyMzIsMTc4LDYyLDApOyB9XG4gICAgICAgICAgNTAlIHsgYm94LXNoYWRvdzogMCAycHggMCByZ2JhKDI2LDMxLDQ2LDAuMDgpLCAwIDAgMCA0cHggcmdiYSgyMzIsMTc4LDYyLDAuMjUpOyB9XG4gICAgICAgIH1cbiAgICAgICAgLnBsYXllci1yb3cud2lubmVyIHtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiAjZmZmM2E4O1xuICAgICAgICAgIGJvcmRlci1jb2xvcjogdmFyKC0tYWNjZW50LTMpO1xuICAgICAgICAgIGFuaW1hdGlvbjogd2lubmVyLWJvdW5jZSAwLjZzIGVhc2UtaW4tb3V0IDI7XG4gICAgICAgIH1cbiAgICAgICAgQGtleWZyYW1lcyB3aW5uZXItYm91bmNlIHtcbiAgICAgICAgICAwJSwgMTAwJSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTsgfVxuICAgICAgICAgIDUwJSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNnB4KTsgfVxuICAgICAgICB9XG4gICAgICAgIC5yYW5rLWJhZGdlIHtcbiAgICAgICAgICBmb250LWZhbWlseTogJ0dlaXN0IE1vbm8nLCBtb25vc3BhY2U7XG4gICAgICAgICAgZm9udC1zaXplOiAxMHB4O1xuICAgICAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMDVlbTtcbiAgICAgICAgICBwYWRkaW5nOiA0cHggNnB4O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZy0yKTtcbiAgICAgICAgICBjb2xvcjogdmFyKC0taW5rLTIpO1xuICAgICAgICAgIG1pbi13aWR0aDogMzBweDtcbiAgICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgIH1cbiAgICAgICAgLnJhbmstYmFkZ2UucmFuay0xIHsgYmFja2dyb3VuZDogI2U4YjIzZTsgY29sb3I6ICM1YTNlMGU7IGJveC1zaGFkb3c6IDAgMnB4IDAgcmdiYSgyMzIsMTc4LDYyLDAuNCk7IH1cbiAgICAgICAgLnJhbmstYmFkZ2UucmFuay0yIHsgYmFja2dyb3VuZDogI2M3YzNiNTsgY29sb3I6ICMzYTM1MmE7IH1cbiAgICAgICAgLnJhbmstYmFkZ2UucmFuay0zIHsgYmFja2dyb3VuZDogI2M4OTc3MjsgY29sb3I6ICMzYTI0MTA7IH1cbiAgICAgICAgLmNoYXItYXZhdGFyIHtcbiAgICAgICAgICB3aWR0aDogNDRweDsgaGVpZ2h0OiA0NHB4O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDEycHg7XG4gICAgICAgICAgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgICAgdHJhbnNpdGlvbjogYm94LXNoYWRvdyAwLjJzO1xuICAgICAgICB9XG4gICAgICAgIC50dXJuLXBpbGwge1xuICAgICAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICAgICAgICBwYWRkaW5nOiAxcHggNXB4O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgICBmb250LXNpemU6IDhweDtcbiAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC4xMmVtO1xuICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWFjY2VudC0yKTtcbiAgICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgICAgbWFyZ2luLWxlZnQ6IDRweDtcbiAgICAgICAgfVxuICAgICAgICAuYWktYXZhdGFyIHtcbiAgICAgICAgICB3aWR0aDogNDBweDsgaGVpZ2h0OiA0MHB4O1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDUwJTtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbmspO1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgICAgIHRyYW5zaXRpb246IGJveC1zaGFkb3cgMC4ycztcbiAgICAgICAgfVxuICAgICAgICAucGxheWVyLWluZm8geyBmbGV4OiAxOyBtaW4td2lkdGg6IDA7IH1cbiAgICAgICAgLnBsYXllci1uYW1lIHsgZm9udC13ZWlnaHQ6IDYwMDsgZm9udC1zaXplOiAxNHB4OyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDZweDsgfVxuICAgICAgICAuYWktdGFnIHtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbmspO1xuICAgICAgICAgIGNvbG9yOiB2YXIoLS1iZyk7XG4gICAgICAgICAgcGFkZGluZzogMXB4IDVweDtcbiAgICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgICAgZm9udC1zaXplOiA5cHg7XG4gICAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMWVtO1xuICAgICAgICB9XG4gICAgICAgIC5wbGF5ZXItcG9zIHtcbiAgICAgICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICAgICAgY29sb3I6IHZhcigtLW11dGUpO1xuICAgICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA1ZW07XG4gICAgICAgICAgbWFyZ2luLXRvcDogMnB4O1xuICAgICAgICB9XG4gICAgICAgIC5wbGF5ZXItcHJvZyB7XG4gICAgICAgICAgd2lkdGg6IDZweDtcbiAgICAgICAgICBoZWlnaHQ6IDQ0cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmctMik7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogM3B4O1xuICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbi1yZXZlcnNlO1xuICAgICAgICB9XG4gICAgICAgIC5wcm9nLWZpbGwge1xuICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgIHRyYW5zaXRpb246IGhlaWdodCAwLjRzIGN1YmljLWJlemllciguNSwuMSwuNSwxLjQpO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDNweDtcbiAgICAgICAgfVxuICAgICAgICAuYmxpcC1wYW5lbCB7XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBnYXA6IDEwcHg7XG4gICAgICAgICAgcGFkZGluZzogMTRweDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1pbmspO1xuICAgICAgICAgIGNvbG9yOiB2YXIoLS1iZyk7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogMTRweDtcbiAgICAgICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICAgIH1cbiAgICAgICAgLmJsaXAtZmFjZSB7XG4gICAgICAgICAgd2lkdGg6IDU0cHg7IGhlaWdodDogNTRweDtcbiAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgIH1cbiAgICAgICAgLmJsaXAtYnViYmxlIHsgZmxleDogMTsgbWluLXdpZHRoOiAwOyB9XG4gICAgICAgIC5ibGlwLW5hbWUge1xuICAgICAgICAgIGZvbnQtc2l6ZTogMTBweDtcbiAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC4xNWVtO1xuICAgICAgICAgIG9wYWNpdHk6IDAuNTU7XG4gICAgICAgIH1cbiAgICAgICAgLmJsaXAtdGV4dCB7XG4gICAgICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgICAgIG1hcmdpbi10b3A6IDRweDtcbiAgICAgICAgICBsaW5lLWhlaWdodDogMS40O1xuICAgICAgICB9XG4gICAgICAgIC5sb2ctcGFuZWwgeyBmbGV4OiAxOyBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBtaW4taGVpZ2h0OiAxMjBweDsgfVxuICAgICAgICAvKiBUaGUgc2lkZWJhciBpcyB0aGUgc2luZ2xlIHNjcm9sbCBzdXJmYWNlIOKAlCBkb24ndCBkb3VibGUtc2Nyb2xsIGluc2lkZSBpdC4gKi9cbiAgICAgICAgLmxvZy1saXN0IHtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgZ2FwOiA0cHg7XG4gICAgICAgICAgZmxleDogMTtcbiAgICAgICAgfVxuICAgICAgICAubG9nLWVtcHR5IHsgZm9udC1zaXplOiAxMnB4OyBjb2xvcjogdmFyKC0tbXV0ZSk7IHBhZGRpbmc6IDhweCAwOyB9XG4gICAgICAgIC5sb2ctZW50cnkge1xuICAgICAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgICAgICBwYWRkaW5nOiA2cHggMTBweDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iZyk7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogNnB4O1xuICAgICAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ7XG4gICAgICAgIH1cbiAgICAgICAgLmxvZy1lbnRyeSBiIHsgZm9udC13ZWlnaHQ6IDYwMDsgfVxuICAgICAgICAubG9nLWVudHJ5LmNodXRlIHsgYmFja2dyb3VuZDogcmdiYSgyMzIsODgsNjIsMC4xKTsgY29sb3I6ICNhNTNhMjY7IH1cbiAgICAgICAgLmxvZy1lbnRyeS5wb3J0YWwgeyBiYWNrZ3JvdW5kOiByZ2JhKDE1NSw5MiwyNTUsMC4xNCk7IGNvbG9yOiAjNWIyZGE2OyBmb250LXdlaWdodDogNTAwOyB9XG4gICAgICAgIC5sb2ctZW50cnkubGFkZGVyIHsgYmFja2dyb3VuZDogcmdiYSg0MiwxMzgsOTUsMC4xKTsgY29sb3I6ICMxZTY2NDU7IH1cblxuICAgICAgICAuYm9hcmQtYXJlYSB7XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICAgIGdhcDogMThweDtcbiAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgICAgICBtaW4taGVpZ2h0OiAwO1xuICAgICAgICAgIHBhZGRpbmctYm90dG9tOiAyNHB4O1xuICAgICAgICB9XG4gICAgICAgIC5ib2FyZC1oZWFkZXIge1xuICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgIG1heC13aWR0aDogbWluKDk1dncsIDgwdmgsIDcyMHB4KTtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgICBhbGlnbi1pdGVtczogZmxleC1lbmQ7XG4gICAgICAgIH1cbiAgICAgICAgLnR1cm4tbmFtZSB7XG4gICAgICAgICAgZm9udC1zaXplOiAyOHB4O1xuICAgICAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgIGdhcDogMTBweDtcbiAgICAgICAgfVxuICAgICAgICAudHVybi1kb3Qge1xuICAgICAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICAgICAgICB3aWR0aDogMTRweDtcbiAgICAgICAgICBoZWlnaHQ6IDE0cHg7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDRweCByZ2JhKDAsMCwwLDAuMik7XG4gICAgICAgIH1cbiAgICAgICAgLnJ1bGVzLXRhZyB7XG4gICAgICAgICAgZm9udC1zaXplOiAxMHB4O1xuICAgICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjE1ZW07XG4gICAgICAgICAgY29sb3I6IHZhcigtLW11dGUpO1xuICAgICAgICAgIHBhZGRpbmc6IDZweCAxMHB4O1xuICAgICAgICAgIGJvcmRlcjogMXB4IGRhc2hlZCByZ2JhKDI2LDMxLDQ2LDAuMjUpO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgfVxuICAgICAgICAuZGljZS1hcmVhIHtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgZ2FwOiAyNHB4O1xuICAgICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICAgIG1heC13aWR0aDogbWluKDk1dncsIDgwdmgsIDcyMHB4KTtcbiAgICAgICAgICBwYWRkaW5nOiAyMnB4IDI0cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogMThweDtcbiAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI2LDMxLDQ2LDAuMDgpO1xuICAgICAgICB9XG4gICAgICAgIC5kaWNlLXNsb3Qge1xuICAgICAgICAgIHdpZHRoOiAxODRweDtcbiAgICAgICAgICBmbGV4LXNocmluazogMDtcbiAgICAgICAgICBwYWRkaW5nLWJvdHRvbTogMTJweDtcbiAgICAgICAgfVxuICAgICAgICAucm9sbC1pbmZvIHtcbiAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgZ2FwOiAxNnB4O1xuICAgICAgICB9XG4gICAgICAgIC5yb2xsLXByb21wdCB7IGZvbnQtc2l6ZTogMjBweDsgZm9udC13ZWlnaHQ6IDYwMDsgfVxuICAgICAgICAudHVybi1kb3QgeyBhbmltYXRpb246IGRvdC1wdWxzZSAxLjJzIGVhc2UtaW4tb3V0IGluZmluaXRlOyB9XG4gICAgICAgIEBrZXlmcmFtZXMgZG90LXB1bHNlIHtcbiAgICAgICAgICAwJSwgMTAwJSB7IHRyYW5zZm9ybTogc2NhbGUoMSk7IGJveC1zaGFkb3c6IDAgMnB4IDRweCByZ2JhKDAsMCwwLDAuMik7IH1cbiAgICAgICAgICA1MCUgeyB0cmFuc2Zvcm06IHNjYWxlKDEuMik7IGJveC1zaGFkb3c6IDAgMCAwIDRweCByZ2JhKDI1NSwyNTUsMjU1LDAuNSksIDAgMnB4IDZweCByZ2JhKDAsMCwwLDAuMyk7IH1cbiAgICAgICAgfVxuICAgICAgICAucm9sbC1oaW50IHsgZm9udC1zaXplOiAxMXB4OyBsZXR0ZXItc3BhY2luZzogMC4xMmVtOyBjb2xvcjogdmFyKC0tbXV0ZSk7IGZvbnQtd2VpZ2h0OiA2MDA7IH1cbiAgICAgICAgLnJvbGwtc3ViaGludCB7IGZvbnQtc2l6ZTogMTJweDsgY29sb3I6IHZhcigtLW11dGUpOyBtYXJnaW4tdG9wOiAycHg7IH1cbiAgICAgIGB9PC9zdHlsZT5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuZnVuY3Rpb24gV2luT3ZlcmxheSh7IHdpbm5lciwgcGxheWVycyA9IFtdLCBwb3NpdGlvbnMgPSBbXSwgb25QbGF5QWdhaW4sIG9uUXVpdCwgY29uZmV0dGlDb3VudCA9IDYwIH0pIHtcbiAgLy8gQ29uZmV0dGkgcGllY2VzXG4gIGNvbnN0IHBpZWNlcyA9IEFycmF5LmZyb20oeyBsZW5ndGg6IGNvbmZldHRpQ291bnQgfSkubWFwKChfLCBpKSA9PiAoe1xuICAgIGlkOiBpLFxuICAgIHg6IE1hdGgucmFuZG9tKCkgKiAxMDAsXG4gICAgZGVsYXk6IE1hdGgucmFuZG9tKCkgKiAwLjUsXG4gICAgZHVyOiAxLjUgKyBNYXRoLnJhbmRvbSgpICogMS41LFxuICAgIGNvbG9yOiBQTEFZRVJfQ09MT1JTW2kgJSBQTEFZRVJfQ09MT1JTLmxlbmd0aF0sXG4gICAgcm90OiBNYXRoLnJhbmRvbSgpICogMzYwLFxuICB9KSk7XG5cbiAgLy8gUmFuayBldmVyeW9uZSBieSBmaW5hbCBzcXVhcmUgKGhpZ2hlc3QgZmlyc3QpLiBVc2VmdWwgaW5mbyBvbiBtdWx0aS1wbGF5ZXIgZ2FtZXNcbiAgLy8gYW5kIGdpdmVzIEJMSVAgbWF0Y2hlcyBhIHNlbnNlIG9mIGhvdyBjbG9zZSBpdCB3YXMuXG4gIGNvbnN0IHJhbmtzID0gcGxheWVyc1xuICAgIC5tYXAoKHAsIGlkeCkgPT4gKHsgcCwgaWR4LCBwb3M6IHBvc2l0aW9uc1tpZHhdID8/IDAgfSkpXG4gICAgLnNvcnQoKGEsIGIpID0+IGIucG9zIC0gYS5wb3MpO1xuXG4gIC8vIFRyYXAgZm9jdXMgaW5zaWRlIHRoZSBkaWFsb2cgYW5kIGNsb3NlIG9uIEVzY2FwZSAoc3RhbmRhcmQgbW9kYWwgYTExeSkuXG4gIGNvbnN0IGNhcmRSZWYgPSBSZWFjdC51c2VSZWYobnVsbCk7XG4gIFJlYWN0LnVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3Qgb25LZXkgPSAoZSkgPT4geyBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSBvblBsYXlBZ2Fpbj8uKCk7IH07XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9uS2V5KTtcbiAgICBjb25zdCBmb2N1c2FibGUgPSBjYXJkUmVmLmN1cnJlbnQ/LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbi5wcmltYXJ5Jyk7XG4gICAgZm9jdXNhYmxlPy5mb2N1cygpO1xuICAgIHJldHVybiAoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25LZXkpO1xuICB9LCBbb25QbGF5QWdhaW5dKTtcblxuICBjb25zdCB0aXRsZUlkID0gJ3dpbi10aXRsZS0nICsgKHdpbm5lcj8uaWQgfHwgJ3gnKTtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cIndpbi1vdmVybGF5XCIgcm9sZT1cImRpYWxvZ1wiIGFyaWEtbW9kYWw9XCJ0cnVlXCIgYXJpYS1sYWJlbGxlZGJ5PXt0aXRsZUlkfT5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29uZmV0dGlcIiBhcmlhLWhpZGRlbj1cInRydWVcIj5cbiAgICAgICAge3BpZWNlcy5tYXAocCA9PiAoXG4gICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgIGtleT17cC5pZH1cbiAgICAgICAgICAgIGNsYXNzTmFtZT1cImNvbmZldHRpLXBpZWNlXCJcbiAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgIGxlZnQ6IGAke3AueH0lYCxcbiAgICAgICAgICAgICAgYmFja2dyb3VuZDogcC5jb2xvcixcbiAgICAgICAgICAgICAgYW5pbWF0aW9uRGVsYXk6IGAke3AuZGVsYXl9c2AsXG4gICAgICAgICAgICAgIGFuaW1hdGlvbkR1cmF0aW9uOiBgJHtwLmR1cn1zYCxcbiAgICAgICAgICAgICAgdHJhbnNmb3JtOiBgcm90YXRlKCR7cC5yb3R9ZGVnKWAsXG4gICAgICAgICAgICB9fVxuICAgICAgICAgIC8+XG4gICAgICAgICkpfVxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cIndpbi1jYXJkXCIgcmVmPXtjYXJkUmVmfT5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3aW4tZXllYnJvdyBtb25vXCI+Q09OR1JBVFVMQVRJT05TPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwid2luLWF2YXRhclwiPlxuICAgICAgICAgIHt3aW5uZXIuaXNBSSA/IChcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3tiYWNrZ3JvdW5kOiB3aW5uZXIuY29sb3IsIGJvcmRlclJhZGl1czogJzUwJScsIHBhZGRpbmc6IDE0fX0+XG4gICAgICAgICAgICAgIDxSb2JvdCBzaXplPXsxMDB9IGNvbG9yPVwiI2Y3ZjFlNFwiIG1vb2Q9XCJjZWxlYnJhdGluZ1wiLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICkgOiB3aW5uZXIuY2hhcklkID8gKFxuICAgICAgICAgICAgPGRpdiBzdHlsZT17e2JhY2tncm91bmQ6IHdpbm5lci5jb2xvciArICczMycsIGJvcmRlclJhZGl1czogJzUwJScsIHBhZGRpbmc6IDE0fX0+XG4gICAgICAgICAgICAgIDxDaGFyYWN0ZXIgY2hhcklkPXt3aW5uZXIuY2hhcklkfSBzaXplPXsxMDB9IHNwaW4vPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKSA6IChcbiAgICAgICAgICAgIDxBdmF0YXIgbGFiZWw9e3dpbm5lci5sYWJlbH0gY29sb3I9e3dpbm5lci5jb2xvcn0gc2l6ZT17MTIwfS8+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxoMiBjbGFzc05hbWU9XCJ3aW4tdGl0bGUgc2VyaWZcIiBpZD17dGl0bGVJZH0+e3dpbm5lci5uYW1lfSB7d2lubmVyLm5hbWUgPT09ICdZb3UnID8gJ3dpbicgOiAnd2lucyd9ITwvaDI+XG4gICAgICAgIDxwIGNsYXNzTmFtZT1cIndpbi1zdWJcIj5SZWFjaGVkIHNxdWFyZSAxMDAg4oCUIGNodXRlcyBiZSBkYW1uZWQuPC9wPlxuICAgICAgICB7cmFua3MubGVuZ3RoID4gMSAmJiAoXG4gICAgICAgICAgPG9sIGNsYXNzTmFtZT1cIndpbi1yYW5rc1wiIGFyaWEtbGFiZWw9XCJGaW5hbCBzdGFuZGluZ3NcIj5cbiAgICAgICAgICAgIHtyYW5rcy5tYXAoKHIsIGkpID0+IChcbiAgICAgICAgICAgICAgPGxpIGtleT17ci5pZHh9IGNsYXNzTmFtZT17ci5pZHggPT09ICh3aW5uZXIuaWR4ID8/IC0xKSA/ICd3aW4tcm93IGNoYW1wJyA6ICd3aW4tcm93J30+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwid2luLXJhbmsgbW9ub1wiPntpICsgMX08L3NwYW4+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwid2luLWRvdFwiIHN0eWxlPXt7YmFja2dyb3VuZDogci5wLmNvbG9yfX0gYXJpYS1oaWRkZW49XCJ0cnVlXCIvPlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cIndpbi1uYW1lXCI+e3IucC5uYW1lfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ3aW4tcG9zIG1vbm9cIj5zcS4ge3IucG9zfTwvc3Bhbj5cbiAgICAgICAgICAgICAgPC9saT5cbiAgICAgICAgICAgICkpfVxuICAgICAgICAgIDwvb2w+XG4gICAgICAgICl9XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwid2luLWFjdGlvbnNcIj5cbiAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cImJ0biBnaG9zdFwiIG9uQ2xpY2s9e29uUXVpdH0+TWFpbiBtZW51PC9idXR0b24+XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzc05hbWU9XCJidG4gcHJpbWFyeVwiIG9uQ2xpY2s9e29uUGxheUFnYWlufT5QbGF5IGFnYWluIOKGkjwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPHN0eWxlPntgXG4gICAgICAgIC53aW4tb3ZlcmxheSB7XG4gICAgICAgICAgcG9zaXRpb246IGZpeGVkOyBpbnNldDogMDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI2LDMxLDQ2LDAuNSk7XG4gICAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiBibHVyKDhweCk7XG4gICAgICAgICAgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICAgICAgei1pbmRleDogMTAwO1xuICAgICAgICAgIGFuaW1hdGlvbjogZmFkZWluIDAuM3MgZWFzZTtcbiAgICAgICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgICAgICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgICAgIH1cbiAgICAgICAgQGtleWZyYW1lcyBmYWRlaW4geyBmcm9tIHsgb3BhY2l0eTogMDsgfSB0byB7IG9wYWNpdHk6IDE7IH0gfVxuICAgICAgICAud2luLWNhcmQge1xuICAgICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDI0cHg7XG4gICAgICAgICAgcGFkZGluZzogNDBweDtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgIGdhcDogMTRweDtcbiAgICAgICAgICBtYXgtd2lkdGg6IDQ0MHB4O1xuICAgICAgICAgIGJveC1zaGFkb3c6IDAgMjRweCA2MHB4IC0xMnB4IHJnYmEoMCwwLDAsMC41KTtcbiAgICAgICAgICBhbmltYXRpb246IHBvcCAwLjVzIGN1YmljLWJlemllciguMzQsMS41NiwuNjQsMSk7XG4gICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICAgIHotaW5kZXg6IDI7XG4gICAgICAgIH1cbiAgICAgICAgQGtleWZyYW1lcyBwb3Age1xuICAgICAgICAgIGZyb20geyB0cmFuc2Zvcm06IHNjYWxlKDAuNyk7IG9wYWNpdHk6IDA7IH1cbiAgICAgICAgICB0byB7IHRyYW5zZm9ybTogc2NhbGUoMSk7IG9wYWNpdHk6IDE7IH1cbiAgICAgICAgfVxuICAgICAgICAud2luLWV5ZWJyb3cge1xuICAgICAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgICAgICBsZXR0ZXItc3BhY2luZzogMC4yZW07XG4gICAgICAgICAgY29sb3I6IHZhcigtLW11dGUpO1xuICAgICAgICB9XG4gICAgICAgIC53aW4tYXZhdGFyIHsgbWFyZ2luOiA4cHggMDsgfVxuICAgICAgICAud2luLXRpdGxlIHtcbiAgICAgICAgICBmb250LXNpemU6IDQ0cHg7IGZvbnQtd2VpZ2h0OiA3MDA7IHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoOTBkZWcsICNlODU4M2UsICNlOGIyM2UsICMyYThhNWYsICM1YjZjZmYsICNhODU1YTAsICNlODU4M2UpO1xuICAgICAgICAgIGJhY2tncm91bmQtc2l6ZTogMzAwJSAxMDAlO1xuICAgICAgICAgIC13ZWJraXQtYmFja2dyb3VuZC1jbGlwOiB0ZXh0O1xuICAgICAgICAgIGJhY2tncm91bmQtY2xpcDogdGV4dDtcbiAgICAgICAgICAtd2Via2l0LXRleHQtZmlsbC1jb2xvcjogdHJhbnNwYXJlbnQ7XG4gICAgICAgICAgYW5pbWF0aW9uOiB3aW4tc2hpbW1lciAzcyBsaW5lYXIgaW5maW5pdGU7XG4gICAgICAgIH1cbiAgICAgICAgQGtleWZyYW1lcyB3aW4tc2hpbW1lciB7XG4gICAgICAgICAgdG8geyBiYWNrZ3JvdW5kLXBvc2l0aW9uOiAzMDAlIDA7IH1cbiAgICAgICAgfVxuICAgICAgICAud2luLXN1YiB7IGNvbG9yOiB2YXIoLS1pbmstMik7IGZvbnQtc2l6ZTogMTVweDsgdGV4dC1hbGlnbjogY2VudGVyOyB9XG4gICAgICAgIC53aW4tcmFua3Mge1xuICAgICAgICAgIGxpc3Qtc3R5bGU6IG5vbmU7XG4gICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgICBtYXJnaW46IDhweCAwIDRweDtcbiAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICBtYXgtd2lkdGg6IDM0MHB4O1xuICAgICAgICAgIGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgZ2FwOiA0cHg7XG4gICAgICAgIH1cbiAgICAgICAgLndpbi1yb3cge1xuICAgICAgICAgIGRpc3BsYXk6IGdyaWQ7XG4gICAgICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiAyNHB4IDEycHggMWZyIGF1dG87XG4gICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICBnYXA6IDEwcHg7XG4gICAgICAgICAgcGFkZGluZzogOHB4IDEwcHg7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcbiAgICAgICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDogcmdiYSgyNiwzMSw0NiwwLjA0KTtcbiAgICAgICAgfVxuICAgICAgICAud2luLXJvdy5jaGFtcCB7XG4gICAgICAgICAgYmFja2dyb3VuZDogcmdiYSgyMzIsMTc4LDYyLDAuMTgpO1xuICAgICAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgICAgIH1cbiAgICAgICAgLndpbi1yYW5rIHsgY29sb3I6IHZhcigtLW11dGUpOyBmb250LXNpemU6IDEycHg7IHRleHQtYWxpZ246IGNlbnRlcjsgfVxuICAgICAgICAud2luLWRvdCB7IHdpZHRoOiAxMHB4OyBoZWlnaHQ6IDEwcHg7IGJvcmRlci1yYWRpdXM6IDUwJTsgfVxuICAgICAgICAud2luLXBvcyB7IGNvbG9yOiB2YXIoLS1tdXRlKTsgZm9udC1zaXplOiAxMnB4OyB9XG4gICAgICAgIC53aW4tYWN0aW9ucyB7IGRpc3BsYXk6IGZsZXg7IGdhcDogMTBweDsgbWFyZ2luLXRvcDogMTZweDsgfVxuICAgICAgICAuY29uZmV0dGkge1xuICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTsgaW5zZXQ6IDA7XG4gICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgICAgfVxuICAgICAgICAuY29uZmV0dGktcGllY2Uge1xuICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICB0b3A6IC0yMHB4O1xuICAgICAgICAgIHdpZHRoOiAxMHB4OyBoZWlnaHQ6IDE2cHg7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogMnB4O1xuICAgICAgICAgIGFuaW1hdGlvbjogZmFsbCBsaW5lYXIgZm9yd2FyZHM7XG4gICAgICAgIH1cbiAgICAgICAgQGtleWZyYW1lcyBmYWxsIHtcbiAgICAgICAgICB0byB7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMTIwdmgpIHJvdGF0ZSg3MjBkZWcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgYH08L3N0eWxlPlxuICAgIDwvZGl2PlxuICApO1xufVxuXG4vLyBTYW5pdHkgY2hlY2sgYXQgYm9vdDogY2h1dGVzIGFuZCBsYWRkZXJzIG11c3QgbmV2ZXIgZGVwb3NpdCBhIHBsYXllciBvbiAxMDAsXG4vLyBvdGhlcndpc2UgdGhlIHdpbi1jaGVjayB3b3VsZCBuZXZlciBmaXJlLiBIYW5kLWN1cmF0ZWQgZGF0YSB2ZXJpZmllZCBoZXJlLlxuY29uc29sZS5hc3NlcnQoXG4gIE9iamVjdC52YWx1ZXMoQ0hVVEVTIHx8IHt9KS5pbmRleE9mKDEwMCkgPT09IC0xICYmXG4gIE9iamVjdC52YWx1ZXMoTEFEREVSUyB8fCB7fSkuaW5kZXhPZigxMDApID09PSAtMSxcbiAgJ1tDbGltYiAmIFNsaWRlXSBCdWc6IGEgY2h1dGUgb3IgbGFkZGVyIG1hcHMgdG8gc3F1YXJlIDEwMCwgd2hpY2ggd291bGQgbmV2ZXIgdHJpZ2dlciBhIHdpbi4nXG4pO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEhvd1RvUGxheSDigJQgZmlyc3QtdGltZS1wbGF5ZXIgcnVsZXMgbW9kYWwuIEtleWJvYXJkLWFjY2Vzc2libGUgKEVzY2FwZSBjbG9zZXMsXG4vLyBmb2N1cyByZXR1cm5zIHRvIG9wZW5lcikuIEtlcHQgdW5kZXIgNCBidWxsZXRzIHNvIGEgcGhvbmUgc2NyZWVuIHNob3dzIGl0IGFsbC5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuZnVuY3Rpb24gSG93VG9QbGF5KHsgb25DbG9zZSB9KSB7XG4gIGNvbnN0IHJlZiA9IFJlYWN0LnVzZVJlZihudWxsKTtcbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBvbktleSA9IChlKSA9PiB7IGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIG9uQ2xvc2U/LigpOyB9O1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBvbktleSk7XG4gICAgcmVmLmN1cnJlbnQ/LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbicpPy5mb2N1cygpO1xuICAgIHJldHVybiAoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25LZXkpO1xuICB9LCBbb25DbG9zZV0pO1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwibW9kYWwtb3ZlcmxheVwiIHJvbGU9XCJkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWxsZWRieT1cImh0cC10aXRsZVwiIG9uQ2xpY2s9eyhlKSA9PiB7IGlmIChlLnRhcmdldCA9PT0gZS5jdXJyZW50VGFyZ2V0KSBvbkNsb3NlPy4oKTsgfX0+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1vZGFsLWNhcmRcIiByZWY9e3JlZn0+XG4gICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwibW9kYWwtY2xvc2VcIiBvbkNsaWNrPXtvbkNsb3NlfSBhcmlhLWxhYmVsPVwiQ2xvc2VcIj7DlzwvYnV0dG9uPlxuICAgICAgICA8aDIgY2xhc3NOYW1lPVwibW9kYWwtdGl0bGUgc2VyaWZcIiBpZD1cImh0cC10aXRsZVwiPkhvdyB0byBQbGF5PC9oMj5cbiAgICAgICAgPG9sIGNsYXNzTmFtZT1cImh0cC1saXN0XCI+XG4gICAgICAgICAgPGxpPjxiPlJvbGwgdGhlIGRpY2UuPC9iPiBUYXAgb3IgcHJlc3MgRW50ZXIg4oCUIG9yIHByZXNzLWFuZC1ob2xkIGFuZCBmbGluZyBpdCBhY3Jvc3MgdGhlIHNjcmVlbiBmb3IgZnVuLjwvbGk+XG4gICAgICAgICAgPGxpPjxiPkNsaW1iIGxhZGRlcnMg8J+qnC48L2I+IExhbmQgb24gYSBsYWRkZXIncyBib3R0b20gcnVuZyBhbmQgcmlkZSBpdCB1cCB0byBhIGhpZ2hlciBzcXVhcmUuPC9saT5cbiAgICAgICAgICA8bGk+PGI+RG9kZ2UgY2h1dGVzIPCfm50uPC9iPiBMYW5kIG9uIGEgY2h1dGUgYW5kIHNsaWRlIGJhY2sgZG93bi4gVGhlIGJpZyBzcGlyYWwgaXMgdGhlIHdvcnN0IG9uZS48L2xpPlxuICAgICAgICAgIDxsaT48Yj5XYXRjaCBmb3IgcG9ydGFscyDwn4yALjwvYj4gVGhleSB3YXJwIHlvdSB0byBhIHJhbmRvbSBzcXVhcmUg4oCUIGFueXdoZXJlIGZyb20gMSB0byA5OS48L2xpPlxuICAgICAgICAgIDxsaT48Yj5GaXJzdCB0byAxMDAgd2lucy48L2I+IERlcGVuZGluZyBvbiB0aGUgcnVsZSwgeW91IGVpdGhlciBuZWVkIHRvIGxhbmQgZXhhY3RseSBvciB5b3UgYm91bmNlIGJhY2sgcGFzdCBpdC48L2xpPlxuICAgICAgICA8L29sPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1vZGFsLWFjdGlvbnNcIj5cbiAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cImJ0biBwcmltYXJ5XCIgb25DbGljaz17b25DbG9zZX0+R290IGl0PC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8c3R5bGU+e2BcbiAgICAgICAgLm1vZGFsLW92ZXJsYXkge1xuICAgICAgICAgIHBvc2l0aW9uOiBmaXhlZDsgaW5zZXQ6IDA7XG4gICAgICAgICAgYmFja2dyb3VuZDogcmdiYSgyNiwzMSw0NiwwLjU1KTtcbiAgICAgICAgICBiYWNrZHJvcC1maWx0ZXI6IGJsdXIoNnB4KTtcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICB6LWluZGV4OiAxMTA7XG4gICAgICAgICAgYW5pbWF0aW9uOiBmYWRlaW4gMC4ycyBlYXNlO1xuICAgICAgICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgfVxuICAgICAgICAubW9kYWwtY2FyZCB7XG4gICAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICAgICAgICBwYWRkaW5nOiAzMnB4O1xuICAgICAgICAgIG1heC13aWR0aDogNDYwcHg7XG4gICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgYm94LXNoYWRvdzogMCAyNHB4IDYwcHggLTEycHggcmdiYSgwLDAsMCwwLjUpO1xuICAgICAgICAgIGFuaW1hdGlvbjogcG9wIDAuMzVzIGN1YmljLWJlemllciguMzQsMS41NiwuNjQsMSk7XG4gICAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xuICAgICAgICB9XG4gICAgICAgIC5tb2RhbC1jbG9zZSB7XG4gICAgICAgICAgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IDEycHg7IHJpZ2h0OiAxNHB4O1xuICAgICAgICAgIHdpZHRoOiAzMnB4OyBoZWlnaHQ6IDMycHg7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xuICAgICAgICAgIGZvbnQtc2l6ZTogMjJweDsgbGluZS1oZWlnaHQ6IDE7XG4gICAgICAgICAgY29sb3I6IHZhcigtLW11dGUpO1xuICAgICAgICAgIGJhY2tncm91bmQ6IHJnYmEoMCwwLDAsMC4wNCk7XG4gICAgICAgIH1cbiAgICAgICAgLm1vZGFsLWNsb3NlOmhvdmVyIHsgYmFja2dyb3VuZDogcmdiYSgwLDAsMCwwLjA4KTsgY29sb3I6IHZhcigtLWluayk7IH1cbiAgICAgICAgLm1vZGFsLXRpdGxlIHsgZm9udC1zaXplOiAyOHB4OyBtYXJnaW4tYm90dG9tOiA2cHg7IH1cbiAgICAgICAgLmh0cC1saXN0IHtcbiAgICAgICAgICBtYXJnaW46IDhweCAwIDRweDtcbiAgICAgICAgICBwYWRkaW5nLWxlZnQ6IDIycHg7XG4gICAgICAgICAgZGlzcGxheTogZmxleDsgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgICBnYXA6IDEwcHg7XG4gICAgICAgICAgZm9udC1zaXplOiAxNXB4O1xuICAgICAgICAgIGxpbmUtaGVpZ2h0OiAxLjQ1O1xuICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbmstMik7XG4gICAgICAgIH1cbiAgICAgICAgLmh0cC1saXN0IGIgeyBjb2xvcjogdmFyKC0taW5rKTsgfVxuICAgICAgICAubW9kYWwtYWN0aW9ucyB7IGRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7IG1hcmdpbi10b3A6IDE4cHg7IH1cbiAgICAgIGB9PC9zdHlsZT5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTZXR0aW5nc01vZGFsIOKAlCBleHBvc2VzIHRoZSB1c2VyLWZhY2luZyBzdWJzZXQgb2YgdHdlYWtzIChnYW1lIHNwZWVkLCBleGFjdC1sYW5kaW5nLFxuLy8gYWN0aXZpdHkgbG9nLCBjb25mZXR0aSBkZW5zaXR5KS4gVHdlYWtzIHBlcnNpc3QgdmlhIFR3ZWFrUGFuZWwncyBleGlzdGluZyBzdGF0ZS5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuZnVuY3Rpb24gU2V0dGluZ3NNb2RhbCh7IHR3ZWFrcywgc2V0VHdlYWtzLCBvbkNsb3NlIH0pIHtcbiAgY29uc3QgcmVmID0gUmVhY3QudXNlUmVmKG51bGwpO1xuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IG9uS2V5ID0gKGUpID0+IHsgaWYgKGUua2V5ID09PSAnRXNjYXBlJykgb25DbG9zZT8uKCk7IH07XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9uS2V5KTtcbiAgICByZWYuY3VycmVudD8ucXVlcnlTZWxlY3RvcignYnV0dG9uLmJ0bicpPy5mb2N1cygpO1xuICAgIHJldHVybiAoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25LZXkpO1xuICB9LCBbb25DbG9zZV0pO1xuICBjb25zdCB1cGRhdGUgPSAoa2V5LCB2YWwpID0+IHNldFR3ZWFrcyh0ID0+ICh7IC4uLnQsIFtrZXldOiB2YWwgfSkpO1xuICBjb25zdCBzcGVlZCA9IHR3ZWFrcy5nYW1lU3BlZWQgPz8gMTtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cIm1vZGFsLW92ZXJsYXlcIiByb2xlPVwiZGlhbG9nXCIgYXJpYS1tb2RhbD1cInRydWVcIiBhcmlhLWxhYmVsbGVkYnk9XCJzZXQtdGl0bGVcIiBvbkNsaWNrPXsoZSkgPT4geyBpZiAoZS50YXJnZXQgPT09IGUuY3VycmVudFRhcmdldCkgb25DbG9zZT8uKCk7IH19PlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJtb2RhbC1jYXJkXCIgcmVmPXtyZWZ9PlxuICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cIm1vZGFsLWNsb3NlXCIgb25DbGljaz17b25DbG9zZX0gYXJpYS1sYWJlbD1cIkNsb3NlXCI+w5c8L2J1dHRvbj5cbiAgICAgICAgPGgyIGNsYXNzTmFtZT1cIm1vZGFsLXRpdGxlIHNlcmlmXCIgaWQ9XCJzZXQtdGl0bGVcIj5TZXR0aW5nczwvaDI+XG5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZXQtcm93XCI+XG4gICAgICAgICAgPGxhYmVsIGh0bWxGb3I9XCJzZXQtc3BlZWRcIj5HYW1lIHNwZWVkPC9sYWJlbD5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNldC1jb250cm9sXCI+XG4gICAgICAgICAgICA8aW5wdXQgaWQ9XCJzZXQtc3BlZWRcIiB0eXBlPVwicmFuZ2VcIiBtaW49XCIwLjVcIiBtYXg9XCIyXCIgc3RlcD1cIjAuMVwiIHZhbHVlPXtzcGVlZH1cbiAgICAgICAgICAgICAgb25DaGFuZ2U9e2UgPT4gdXBkYXRlKCdnYW1lU3BlZWQnLCBwYXJzZUZsb2F0KGUudGFyZ2V0LnZhbHVlKSl9Lz5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInNldC12YWwgbW9ub1wiPntzcGVlZC50b0ZpeGVkKDEpfcOXPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNldC1yb3dcIj5cbiAgICAgICAgICA8bGFiZWwgaHRtbEZvcj1cInNldC1leGFjdFwiPldpbiBydWxlPC9sYWJlbD5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNldC1jb250cm9sXCI+XG4gICAgICAgICAgICA8c2VsZWN0IGlkPVwic2V0LWV4YWN0XCIgdmFsdWU9e3R3ZWFrcy5leGFjdExhbmRpbmcgPyAnZXhhY3QnIDogJ2JvdW5jZSd9IG9uQ2hhbmdlPXtlID0+IHVwZGF0ZSgnZXhhY3RMYW5kaW5nJywgZS50YXJnZXQudmFsdWUgPT09ICdleGFjdCcpfT5cbiAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cImV4YWN0XCI+Um9sbCBleGFjdGx5IHRvIDEwMDwvb3B0aW9uPlxuICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiYm91bmNlXCI+Qm91bmNlIGJhY2sgb2ZmIDEwMDwvb3B0aW9uPlxuICAgICAgICAgICAgPC9zZWxlY3Q+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic2V0LXJvd1wiPlxuICAgICAgICAgIDxsYWJlbCBodG1sRm9yPVwic2V0LWxvZ1wiPjxzcGFuPlNob3cgYWN0aXZpdHkgbG9nPC9zcGFuPjwvbGFiZWw+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZXQtY29udHJvbFwiPlxuICAgICAgICAgICAgPGlucHV0IGlkPVwic2V0LWxvZ1wiIHR5cGU9XCJjaGVja2JveFwiIGNoZWNrZWQ9e3R3ZWFrcy5zaG93QWN0aXZpdHlMb2cgIT09IGZhbHNlfVxuICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiB1cGRhdGUoJ3Nob3dBY3Rpdml0eUxvZycsIGUudGFyZ2V0LmNoZWNrZWQpfS8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic2V0LXJvd1wiPlxuICAgICAgICAgIDxsYWJlbCBodG1sRm9yPVwic2V0LWNvbmZldHRpXCI+Q29uZmV0dGkgZGVuc2l0eTwvbGFiZWw+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZXQtY29udHJvbFwiPlxuICAgICAgICAgICAgPGlucHV0IGlkPVwic2V0LWNvbmZldHRpXCIgdHlwZT1cInJhbmdlXCIgbWluPVwiMFwiIG1heD1cIjIwMFwiIHN0ZXA9XCIxMFwiIHZhbHVlPXt0d2Vha3MuY29uZmV0dGlEZW5zaXR5ID8/IDYwfVxuICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiB1cGRhdGUoJ2NvbmZldHRpRGVuc2l0eScsIHBhcnNlSW50KGUudGFyZ2V0LnZhbHVlLCAxMCkpfS8+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJzZXQtdmFsIG1vbm9cIj57dHdlYWtzLmNvbmZldHRpRGVuc2l0eSA/PyA2MH08L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIDxwIGNsYXNzTmFtZT1cInNldC1ub3RlIG1vbm9cIj5TZXR0aW5ncyBhcHBseSBvbiBuZXh0IHJvbGwuIE5ldyBnYW1lcyByZXNldCB0byBkZWZhdWx0cy48L3A+XG5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtb2RhbC1hY3Rpb25zXCI+XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzc05hbWU9XCJidG4gcHJpbWFyeVwiIG9uQ2xpY2s9e29uQ2xvc2V9PkRvbmU8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxzdHlsZT57YFxuICAgICAgICAuc2V0LXJvdyB7XG4gICAgICAgICAgZGlzcGxheTogZ3JpZDtcbiAgICAgICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmciBhdXRvO1xuICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgZ2FwOiAxNnB4O1xuICAgICAgICAgIHBhZGRpbmc6IDEycHggMDtcbiAgICAgICAgICBib3JkZXItdG9wOiAxcHggc29saWQgcmdiYSgyNiwzMSw0NiwwLjA2KTtcbiAgICAgICAgfVxuICAgICAgICAuc2V0LXJvdyBsYWJlbCB7IGZvbnQtc2l6ZTogMTRweDsgZm9udC13ZWlnaHQ6IDUwMDsgfVxuICAgICAgICAuc2V0LWNvbnRyb2wgeyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDEwcHg7IH1cbiAgICAgICAgLnNldC1jb250cm9sIGlucHV0W3R5cGU9XCJyYW5nZVwiXSB7IHdpZHRoOiAxNDBweDsgfVxuICAgICAgICAuc2V0LWNvbnRyb2wgc2VsZWN0IHtcbiAgICAgICAgICBmb250LWZhbWlseTogaW5oZXJpdDsgZm9udC1zaXplOiAxNHB4O1xuICAgICAgICAgIHBhZGRpbmc6IDZweCAxMHB4OyBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNiwzMSw0NiwwLjE1KTsgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgIH1cbiAgICAgICAgLnNldC12YWwgeyBmb250LXNpemU6IDEycHg7IGNvbG9yOiB2YXIoLS1tdXRlKTsgbWluLXdpZHRoOiAzMHB4OyB0ZXh0LWFsaWduOiByaWdodDsgfVxuICAgICAgICAuc2V0LW5vdGUgeyBmb250LXNpemU6IDEwcHg7IGNvbG9yOiB2YXIoLS1tdXRlKTsgbGV0dGVyLXNwYWNpbmc6IDAuMWVtOyBtYXJnaW4tdG9wOiAxMnB4OyB0ZXh0LWFsaWduOiBjZW50ZXI7IH1cbiAgICAgIGB9PC9zdHlsZT5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxud2luZG93LkFwcCA9IEFwcDtcblxuUmVhY3RET00uY3JlYXRlUm9vdChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncm9vdCcpKS5yZW5kZXIoPEFwcC8+KTtcblxuXG4iXSwibWFwcGluZ3MiOiI7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxNQUFNQSxXQUFXLEdBQUcsQ0FDbEI7RUFBRUMsSUFBSSxFQUFFLEVBQUU7RUFBRUMsRUFBRSxFQUFFLEVBQUU7RUFBRUMsS0FBSyxFQUFFO0FBQVUsQ0FBQztBQUFHO0FBQ3pDO0VBQUVGLElBQUksRUFBRSxFQUFFO0VBQUVDLEVBQUUsRUFBRSxFQUFFO0VBQUVDLEtBQUssRUFBRTtBQUFVLENBQUM7QUFBRztBQUN6QztFQUFFRixJQUFJLEVBQUUsRUFBRTtFQUFFQyxFQUFFLEVBQUUsRUFBRTtFQUFFQyxLQUFLLEVBQUUsU0FBUztFQUFFQyxNQUFNLEVBQUU7QUFBSyxDQUFDO0FBQUc7QUFDdkQ7RUFBRUgsSUFBSSxFQUFFLEVBQUU7RUFBRUMsRUFBRSxFQUFFLEVBQUU7RUFBRUMsS0FBSyxFQUFFO0FBQVUsQ0FBQztBQUFHO0FBQ3pDO0VBQUVGLElBQUksRUFBRSxFQUFFO0VBQUVDLEVBQUUsRUFBRSxFQUFFO0VBQUVDLEtBQUssRUFBRTtBQUFVLENBQUM7QUFBRztBQUN6QztFQUFFRixJQUFJLEVBQUUsRUFBRTtFQUFFQyxFQUFFLEVBQUUsRUFBRTtFQUFFQyxLQUFLLEVBQUU7QUFBVSxDQUFDO0FBQUc7QUFDekM7RUFBRUYsSUFBSSxFQUFFLEVBQUU7RUFBRUMsRUFBRSxFQUFFLEVBQUU7RUFBRUMsS0FBSyxFQUFFLFNBQVM7RUFBRUUsTUFBTSxFQUFFO0FBQUssQ0FBQztBQUFHO0FBQ3ZEO0VBQUVKLElBQUksRUFBRSxFQUFFO0VBQUVDLEVBQUUsRUFBRSxFQUFFO0VBQUVDLEtBQUssRUFBRTtBQUFVLENBQUM7QUFBRztBQUN6QztFQUFFRixJQUFJLEVBQUUsRUFBRTtFQUFFQyxFQUFFLEVBQUUsQ0FBQztFQUFHQyxLQUFLLEVBQUU7QUFBVSxDQUFDLENBQUc7QUFBQSxDQUMxQztBQUNELE1BQU1HLE1BQU0sR0FBR0MsTUFBTSxDQUFDQyxXQUFXLENBQUNSLFdBQVcsQ0FBQ1MsR0FBRyxDQUFDQyxDQUFDLElBQUksQ0FBQ0EsQ0FBQyxDQUFDVCxJQUFJLEVBQUVTLENBQUMsQ0FBQ1IsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN2RSxNQUFNUyxjQUFjLEdBQUcsSUFBSUMsR0FBRyxDQUFDWixXQUFXLENBQUNhLE1BQU0sQ0FBQ0gsQ0FBQyxJQUFJQSxDQUFDLENBQUNMLE1BQU0sQ0FBQyxDQUFDSSxHQUFHLENBQUNDLENBQUMsSUFBSUEsQ0FBQyxDQUFDVCxJQUFJLENBQUMsQ0FBQzs7QUFFbEY7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNYSxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsQ0FBRztBQUM5QixNQUFNQyxhQUFhLEdBQUcsR0FBRyxDQUFDLENBQUk7QUFDOUIsTUFBTUMsYUFBYSxHQUFHLEdBQUcsQ0FBQyxDQUFJOztBQUU5QixTQUFTQyxxQkFBcUJBLENBQUNDLE1BQU0sRUFBRUMsSUFBSSxFQUFFO0VBQzNDLE1BQU1DLEVBQUUsR0FBSSxDQUFDRixNQUFNLEdBQUcsQ0FBQyxJQUFJLEVBQUc7RUFDOUIsTUFBTUcsRUFBRSxHQUFHQyxJQUFJLENBQUNDLEtBQUssQ0FBQyxDQUFDTCxNQUFNLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztFQUN4QyxLQUFLRSxFQUFFO0VBQUUsS0FBS0MsRUFBRSxDQUFDLENBQUM7RUFDbEIsTUFBTUcsQ0FBQyxHQUFJLFNBQVNDLE9BQU9BLENBQUNDLEVBQUUsRUFBRTtJQUM5QixNQUFNQyxHQUFHLEdBQUdMLElBQUksQ0FBQ0MsS0FBSyxDQUFDLENBQUNHLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3JDLE1BQU1FLEtBQUssR0FBRyxDQUFDRixFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUU7SUFDM0IsTUFBTUcsR0FBRyxHQUFHRixHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBR0MsS0FBSyxHQUFHLENBQUMsR0FBR0EsS0FBSztJQUM3QyxPQUFPO01BQUVFLENBQUMsRUFBRSxDQUFDRCxHQUFHLEdBQUcsR0FBRyxJQUFJLEVBQUU7TUFBRUUsQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDSixHQUFHLEdBQUcsR0FBRyxJQUFJO0lBQUcsQ0FBQztFQUMzRCxDQUFDLENBQUVULE1BQU0sQ0FBQztFQUNWLE1BQU1jLENBQUMsR0FBSSxTQUFTUCxPQUFPQSxDQUFDQyxFQUFFLEVBQUU7SUFDOUIsTUFBTUMsR0FBRyxHQUFHTCxJQUFJLENBQUNDLEtBQUssQ0FBQyxDQUFDRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNyQyxNQUFNRSxLQUFLLEdBQUcsQ0FBQ0YsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFO0lBQzNCLE1BQU1HLEdBQUcsR0FBR0YsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUdDLEtBQUssR0FBRyxDQUFDLEdBQUdBLEtBQUs7SUFDN0MsT0FBTztNQUFFRSxDQUFDLEVBQUUsQ0FBQ0QsR0FBRyxHQUFHLEdBQUcsSUFBSSxFQUFFO01BQUVFLENBQUMsRUFBRSxHQUFHLEdBQUcsQ0FBQ0osR0FBRyxHQUFHLEdBQUcsSUFBSTtJQUFHLENBQUM7RUFDM0QsQ0FBQyxDQUFFUixJQUFJLENBQUM7RUFDUixNQUFNYyxFQUFFLEdBQUdELENBQUMsQ0FBQ0YsQ0FBQyxHQUFHTixDQUFDLENBQUNNLENBQUM7SUFBRUksRUFBRSxHQUFHRixDQUFDLENBQUNELENBQUMsR0FBR1AsQ0FBQyxDQUFDTyxDQUFDO0VBQ3BD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RSxDQUFDO0lBRVY7SUFDQSxPQUFPLElBQUk7RUFDYixDQUFDLEVBQUUsQ0FDQSxDQUNGLENBQUMsZUFFTjJDLEtBQUEsQ0FBQUMsYUFBQSxnQkFBUTtBQUNkO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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QixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQztJQUM1QixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQztJQUNsQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7RUFDekMsQ0FBQzs7RUFFRDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxNQUFNQyxhQUFhLEdBQUc7SUFDcEIsQ0FBQyxFQUFFO01BQUVwUixDQUFDLEVBQUUsQ0FBQztNQUFJQyxDQUFDLEVBQUU7SUFBSSxDQUFDO0lBQUc7SUFDeEIsQ0FBQyxFQUFFO01BQUVELENBQUMsRUFBRSxDQUFDO01BQUlDLENBQUMsRUFBRTtJQUFJLENBQUM7SUFBRztJQUN4QixDQUFDLEVBQUU7TUFBRUQsQ0FBQyxFQUFFLENBQUM7TUFBSUMsQ0FBQyxFQUFFLENBQUM7SUFBRyxDQUFDO0lBQUc7SUFDeEIsQ0FBQyxFQUFFO01BQUVELENBQUMsRUFBRSxDQUFDO01BQUlDLENBQUMsRUFBRTtJQUFJLENBQUM7SUFBRztJQUN4QixDQUFDLEVBQUU7TUFBRUQsQ0FBQyxFQUFFLENBQUMsRUFBRTtNQUFFQyxDQUFDLEVB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QUVrVCxhQUFhO01BQ3RCOWEsTUFBTSxFQUFFLFFBQVErYSxVQUFVO0lBQzVCO0VBQUUsQ0FDSCxDQUNFLENBQUMsZUFDTnhXLEtBQUEsQ0FBQUMsYUFBQSxnQkFBUTtBQUNkO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBZSxDQUNILENBQUM7QUFFYjtBQUVBeUosTUFB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QUFPLENBQUMsZUFDckNGLEtBQUEsQ0FBQUMsYUFBQSxlQUFNLG9DQUF3QyxDQUM3QyxDQUNBLENBQUMsZUFFTkQsS0FBQSxDQUFBQyxhQUFBLGdCQUFRO0FBQ2Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFlLENBQ04sQ0FBQztBQUVWO0FBRUF5SixNQUFNLENBQUN3TixVQUFVLEdBQUdBLFVBQVU7QUFDOUJ4TixNQUFNLENBQUNzTixhQUFhLEdBQUdBLGFBQWE7O0FBR3BDO0FBQ0E7O0FBRUEsTUFBTTtFQUFFL0ksUUFBUTtFQUFFVyxTQUFTO0VBQUVKLE1BQU07RUFBRWdFO0FBQVksQ0FBQyxHQUFHeFMsS0FBSztBQUUxRCxNQUFNb1osVUFBVSxHQUFHO0VBQ2pCcEssS0FBSyxFQUFFLENBQUMsbUJBQW1CLEVBQUUscUJBQXFCLEVBQUUsOEJBQThCLEVBQUUsb0NBQW9DLENBQUM7RUFDekhxSyxRQUFRLEVBQUUsQ0FBQyxXQUFXLEVBQUUsYUFBYSxFQUFFLG9CQUFvQixFQUFFLGNBQWMsRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUIsQ0FBQztFQUNsSEMsT0FBTyxFQUFFLENBQUMsa0JBQWtCLEVBQUUsY0FBYyxFQUFFLGdDQUFnQyxFQUFFLHNCQUFzQixDQUFDO0VBQ3ZHQyxNQUFNLEVBQUUsQ0FBQyxlQUFlLEVBQUUsZ0JBQWdCLEVBQUUsZUFBZSxFQUFFLHdCQUF3QixDQUFDO0VBQ3RGQyxLQUFLLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSwwQkFBMEIsRUFBRSw2QkFBNkIsQ0FBQztFQUN4R0MsTUFBTSxFQUFFLENBQUMsbUJBQW1CLEVBQUUsK0JBQStCLEVBQUUsVUFBVSxFQUFFLHlCQUF5QixFQUFFLG9CQUFvQixDQUFDO0VBQzNIQyxRQUFRLEVBQUUsQ0FBQyxzQkFBc0IsRUFBRSxVQUFVLEVBQUUsMkJBQTJCLENBQUM7RUFDM0VDLE9BQU8sRUFBRSxDQUFDLHFCQUFxQixFQUFFLGdCQUFnQixFQUFFLHNCQUFzQixDQUFDO0VBQzFFQyxHQUFHLEVBQUUsQ0FBQyxjQUFjLEVBQUUscUJBQXFCLEVBQUUseUJBQXlCLENBQUM7RUFDdkVDLElBQUksRUFBRSxDQUFDLGFBQWEsRUFBRSxxQkFBcUIsRUFBRSxtQkFBbUIsRUFBRSxhQUFhLENBQUM7RUFDaEZDLElBQUksRUFBRSxDQUFDLHdCQUF3QixFQUFFLDZCQUE2QixFQUFFLHdCQUF3QjtBQUMxRixDQUFDO0FBRUQsU0FBU0MsUUFBUUEsQ0FBQzlZLEdBQUcsRUFBRTtFQUNyQixNQUFNK1ksR0FBRyxHQUFHWixVQUFVLENBQUNuWSxHQUFHLENBQUM7RUFDM0IsT0FBTytZLEdBQUcsQ0FBQzlkLElBQUksQ0FBQ0MsS0FBSyxDQUFDRCxJQUFJLENBQUNtVCxNQUFNLENBQUMsQ0FBQyxHQUFHMkssR0FBRyxDQUFDcmIsTUFBTSxDQUFDLENBQUM7QUFDcEQ7QUFFQSxTQUFTc2IsR0FBR0EsQ0FBQSxFQUFHO0VBQ2IsTUFBTSxDQUFDQyxNQUFNLEVBQUVDLFNBQVMsQ0FBQyxHQUFHbE0sUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7RUFDOUMsTUFBTSxDQUFDbU0sTUFBTSxFQUFFQyxTQUFTLENBQUMsR0FBR3BNLFFBQVEsQ0FBQyxJQUFJLENBQUM7O0VBRTFDO0VBQ0EsTUFBTXFNLGNBQWMsR0FBRyxrQkFBa0I7SUFDdkMsV0FBVyxFQUFFLEdBQUc7SUFDaEIsY0FBYyxFQUFFLElBQUk7SUFDcEIsZ0JBQWdCLEVBQUUsSUFBSTtJQUN0QixpQkFBaUIsRUFBRSxFQUFFO0lBQ3JCLGFBQWEsRUFBRSxTQUFTO0lBQ3hCLGFBQWEsRUFBRSxPQUFPO0lBQ3RCLGVBQWUsRUFBRSxJQUFJO0lBQ3JCLGlCQUFpQixFQUFFLElBQUk7SUFDdkIsWUFBWSxFQUFFLENBQUM7SUFDZixlQUFlLEVBQUUsR0FBRztJQUNwQixhQUFhLEVBQUUsR0FBRztJQUNsQixjQUFjLEVBQUUsS0FBSztJQUNyQixlQUFlLEVBQUUsS0FBSztJQUN0QixpQkFBaUIsRUFBRTtFQUNyQixDQUFDO0VBRUQsTUFBTSxDQUFDaGIsTUFBTSxFQUFFaWIsU0FBUyxDQUFDLEdBQUd0TSxRQUFRLENBQUNxTSxjQUFjLENBQUM7RUFDcEQsTUFBTSxDQUFDRSxjQUFjLEVBQUVDLGlCQUFpQixDQUFDLEdBQUd4TSxRQUFRLENBQUMsS0FBSyxDQUFDO0VBRTNELE1BQU15TSxXQUFXLEdBQUdBLENBQUN6WixHQUFHLEVBQUUwWixHQUFHLEtBQUs7SUFDaENKLFNBQVMsQ0FBQ2pkLENBQUMsS0FBSztNQUFFLEdBQUdBLENBQUM7TUFBRSxDQUFDMkQsR0FBRyxHQUFHMFo7SUFBSSxDQUFDLENBQUMsQ0FBQztJQUN0QyxJQUFJO01BQ0ZqUixNQUFNLENBQUNrUixNQUFNLENBQUNDLFdBQVcsQ0FBQztRQUFFdFYsSUFBSSxFQUFFLHNCQUFzQjtRQUFFdVYsS0FBSyxFQUFFO1VBQUUsQ0FBQzdaLEdBQUcsR0FBRzBaO1FBQUk7TUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDO0lBQ3pGLENBQUMsQ0FBQyxPQUFNamQsQ0FBQyxFQUFFLENBQUM7RUFDZCxDQUFDO0VBRURrUixTQUFTLENBQUMsTUFBTTtJQUNkLE1BQU1tTSxLQUFLLEdBQUlyZCxDQUFDLElBQUs7TUFDbkIsTUFBTWtILENBQUMsR0FBR2xILENBQUMsQ0FBQ3NkLElBQUksSUFBSSxDQUFDLENBQUM7TUFDdEIsSUFBSXBXLENBQUMsQ0FBQ1csSUFBSSxLQUFLLHNCQUFzQixFQUFFa1YsaUJBQWlCLENBQUMsSUFBSSxDQUFDO01BQzlELElBQUk3VixDQUFDLENBQUNXLElBQUksS0FBSyx3QkFBd0IsRUFBRWtWLGlCQUFpQixDQUFDLEtBQUssQ0FBQztJQUNuRSxDQUFDO0lBQ0QvUSxNQUFNLENBQUNrSixnQkFBZ0IsQ0FBQyxTQUFTLEVBQUVtSSxLQUFLLENBQUM7SUFDekM7SUFDQSxJQUFJO01BQUVyUixNQUFNLENBQUNrUixNQUFNLENBQUNDLFdBQVcsQ0FBQztRQUFFdFYsSUFBSSxFQUFFO01BQXdCLENBQUMsRUFBRSxHQUFHLENBQUM7SUFBRSxDQUFDLENBQUMsT0FBTTdILENBQUMsRUFBRSxDQUFDO0lBQ3JGLE9BQU8sTUFBTWdNLE1BQU0sQ0FBQ21KLG1CQUFtQixDQUFDLFNBQVMsRUFBRWtJLEtBQUssQ0FBQztFQUMzRCxDQUFDLEVBQUUsRUFBRSxDQUFDOztFQUVOO0VBQ0FuTSxTQUFTLENBQUMsTUFBTTtJQUNkbUUsUUFBUSxDQUFDa0ksZUFBZSxDQUFDOWEsS0FBSyxDQUFDK2EsV0FBVyxDQUFDLFVBQVUsRUFBRTViLE1BQU0sQ0FBQzZiLFdBQVcsQ0FBQztFQUM1RSxDQUFDLEVBQUUsQ0FBQzdiLE1BQU0sQ0FBQzZiLFdBQVcsQ0FBQyxDQUFDO0VBRXhCLE1BQU1DLFdBQVcsR0FBSUMsR0FBRyxJQUFLO0lBQzNCaEIsU0FBUyxDQUFDZ0IsR0FBRyxDQUFDO0lBQ2RsQixTQUFTLENBQUMsTUFBTSxDQUFDO0VBQ25CLENBQUM7RUFFRCxNQUFNbUIsVUFBVSxHQUFHQSxDQUFBLEtBQU07SUFDdkJuQixTQUFTLENBQUMsTUFBTSxDQUFDO0lBQ2pCRSxTQUFTLENBQUMsSUFBSSxDQUFDO0VBQ2pCLENBQUM7RUFFRCxvQkFDRXJhLEtBQUEsQ0FBQUMsYUFBQSxDQUFBRCxLQUFBLENBQUFtTSxRQUFBLFFBQ0crTixNQUFNLEtBQUssTUFBTSxpQkFBSWxhLEtBQUEsQ0FBQUMsYUFBQSxDQUFDaVgsVUFBVTtJQUFDQyxPQUFPLEVBQUVpRTtFQUFZLENBQUMsQ0FBQyxFQUN4RGxCLE1BQU0sS0FBSyxNQUFNLGlCQUFJbGEsS0FBQSxDQUFBQyxhQUFBLENBQUNzYixJQUFJO0lBQUNuQixNQUFNLEVBQUVBLE1BQU87SUFBQ29CLE1BQU0sRUFBRUYsVUFBVztJQUFDaGMsTUFBTSxFQUFFQSxNQUFPO0lBQUNpYixTQUFTLEVBQUVBO0VBQVUsQ0FBQyxDQUFDLEVBQ3RHQyxjQUFjLGlCQUFJeGEsS0FBQSxDQUFBQyxhQUFBLENBQUN3YixXQUFXO0lBQUNuYyxNQUFNLEVBQUVBLE1BQU87SUFBQ3laLFFBQVEsRUFBRTJCLFdBQVk7SUFBQ2dCLE9BQU8sRUFBRUEsQ0FBQSxLQUFNakIsaUJBQWlCLENBQUMsS0FBSyxDQUFFO0lBQUNrQixPQUFPLEVBQUVBLENBQUEsS0FBTXBCLFNBQVMsQ0FBQ0QsY0FBYztFQUFFLENBQUMsQ0FDMUosQ0FBQztBQUVQO0FBRUEsU0FBU21CLFdBQVdBLENBQUM7RUFBRW5jLE1BQU07RUFBRXlaLFFBQVE7RUFBRTJDLE9BQU87RUFBRUM7QUFBUSxDQUFDLEVBQUU7RUFDM0Qsb0JBQ0UzYixLQUFBLENBQUFDLGFBQUE7SUFBS0MsU0FBUyxFQUFDO0VBQWMsZ0JBQzNCRixLQUFBLENBQUFDLGFBQUE7SUFBS0MsU0FBUyxFQUFDO0VBQVcsZ0JBQ3hCRixLQUFBLENBQUFDLGFBQUE7SUFBS0MsU0FBUyxFQUFDO0VBQWdCLEdBQUMsUUFBVyxDQUFDLGVBQzVDRixLQUFBLENBQUFDLGFBQUE7SUFBUUMsU0FBUyxFQUFDLFVBQVU7SUFBQ3lOLE9BQU8sRUFBRStOLE9BQVE7SUFBQyxjQUFXO0VBQU8sR0FBQyxNQUFTLENBQ3hFLENBQUMsZUFDTjFiLEtBQUEsQ0FBQUMsYUFBQTtJQUFLQyxTQUFTLEVBQUM7RUFBUyxnQkFDdEJGLEtBQUEsQ0FBQUMsYUFBQTtJQUFLQyxTQUFTLEVBQUM7RUFBVSxnQkFDdkJGLEtBQUEsQ0FBQUMsYUFBQTtJQUFLQyxTQUFTLEVBQUM7RUFBcUIsR0FBQyxNQUFTLENBQUMsZUFDL0NGLEtBQUEsQ0FBQUMsYUFBQSxDQUFDMmIsS0FBSztJQUFDcFMsS0FBSyxFQUFDO0VBQVksZ0JBQ3ZCeEosS0FBQSxDQUFBQyxhQUFBO0lBQU9zRixJQUFJLEVBQUMsT0FBTztJQUFDaEQsR0FBRyxFQUFDLEtBQUs7SUFBQ1AsR0FBRyxFQUFDLEdBQUc7SUFBQ3lTLElBQUksRUFBQyxLQUFLO0lBQUNoSCxLQUFLLEVBQUVuTyxNQUFNLENBQUN1YyxTQUFVO0lBQ3ZFOUMsUUFBUSxFQUFFcmIsQ0FBQyxJQUFJcWIsUUFBUSxDQUFDLFdBQVcsRUFBRStDLFVBQVUsQ0FBQ3BlLENBQUMsQ0FBQ3NiLE1BQU0sQ0FBQ3ZMLEtBQUssQ0FBQztFQUFFLENBQUMsQ0FBQyxlQUNyRXpOLEtBQUEsQ0FBQUMsYUFBQTtJQUFNQyxTQUFTLEVBQUM7RUFBYSxHQUFFWixNQUFNLENBQUN1YyxTQUFTLENBQUNFLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBQyxNQUFPLENBQzdELENBQUMsZUFDUi9iLEtBQUEsQ0FBQUMsYUFBQSxDQUFDMmIsS0FBSztJQUFDcFMsS0FBSyxFQUFDO0VBQW1CLGdCQUM5QnhKLEtBQUEsQ0FBQUMsYUFBQTtJQUFPc0YsSUFBSSxFQUFDLE9BQU87SUFBQ2hELEdBQUcsRUFBQyxHQUFHO0lBQUNQLEdBQUcsRUFBQyxNQUFNO0lBQUN5UyxJQUFJLEVBQUMsSUFBSTtJQUFDaEgsS0FBSyxFQUFFbk8sTUFBTSxDQUFDMGMsYUFBYztJQUMzRWpELFFBQVEsRUFBRXJiLENBQUMsSUFBSXFiLFFBQVEsQ0FBQyxlQUFlLEVBQUUzVyxRQUFRLENBQUMxRSxDQUFDLENBQUNzYixNQUFNLENBQUN2TCxLQUFLLENBQUM7RUFBRSxDQUFDLENBQUMsZUFDdkV6TixLQUFBLENBQUFDLGFBQUE7SUFBTUMsU0FBUyxFQUFDO0VBQWEsR0FBRVosTUFBTSxDQUFDMGMsYUFBb0IsQ0FDckQsQ0FBQyxlQUNSaGMsS0FBQSxDQUFBQyxhQUFBLENBQUNnYyxRQUFRO0lBQUN6UyxLQUFLLEVBQUMsNEJBQTRCO0lBQUNpRSxLQUFLLEVBQUVuTyxNQUFNLENBQUM0YyxZQUFhO0lBQ3RFbkQsUUFBUSxFQUFFckssQ0FBQyxJQUFJcUssUUFBUSxDQUFDLGNBQWMsRUFBRXJLLENBQUM7RUFBRSxDQUFDLENBQzNDLENBQUMsZUFFTjFPLEtBQUEsQ0FBQUMsYUFBQTtJQUFLQyxTQUFTLEVBQUM7RUFBVSxnQkFDdkJGLEtBQUEsQ0FBQUMsYUFBQTtJQUFLQyxTQUFTLEVBQUM7RUFBcUIsR0FBQyxPQUFVLENBQUMsZUFDaERGLEtBQUEsQ0FBQUMsYUFBQSxDQUFDZ2MsUUFBUTtJQUFDelMsS0FBSyxFQUFDLDBCQUEwQjtJQUFDaUUsS0FBSyxFQUFFbk8sTUFBTSxDQUFDNmMsWUFBYTtJQUNwRXBELFFBQVEsRUFBRXJLLENBQUMsSUFBSXFLLFFBQVEsQ0FBQyxjQUFjLEVBQUVySyxDQUFDO0VBQUUsQ0FBQyxDQUMzQyxDQUFDLGVBRU4xTyxLQUFBLENBQUFDLGFBQUE7SUFBS0MsU0FBUyxFQUFDO0VBQVUsZ0JBQ3ZCRixLQUFBLENBQUFDLGFBQUE7SUFBS0MsU0FBUyxFQUFDO0VBQXFCLEdBQUMsT0FBVSxDQUFDLGVBQ2hERixLQUFBLENBQUFDLGFBQUEsQ0FBQzJiLEtBQUs7SUFBQ3BTLEtBQUssRUFBQztFQUFPLGdCQUNsQnhKLEtBQUEsQ0FBQUMsYUFBQTtJQUFLQyxTQUFTLEVBQUM7RUFBUSxHQUNwQixDQUFDLE1BQU0sRUFBQyxPQUFPLEVBQUMsT0FBTyxDQUFDLENBQUM3RSxHQUFHLENBQUNxVCxDQUFDLGlCQUM3QjFPLEtBQUEsQ0FBQUMsYUFBQTtJQUFRZ0IsR0FBRyxFQUFFeU4sQ0FBRTtJQUNieE8sU0FBUyxFQUFFLGNBQWNaLE1BQU0sQ0FBQ00sV0FBVyxLQUFLOE8sQ0FBQyxHQUFHLFFBQVEsR0FBRyxFQUFFLEVBQUc7SUFDcEVmLE9BQU8sRUFBRUEsQ0FBQSxLQUFNb0wsUUFBUSxDQUFDLGFBQWEsRUFBRXJLLENBQUM7RUFBRSxHQUFFQSxDQUFVLENBQ3pELENBQ0UsQ0FDQSxDQUFDLGVBQ1IxTyxLQUFBLENBQUFDLGFBQUEsQ0FBQzJiLEtBQUs7SUFBQ3BTLEtBQUssRUFBQztFQUFhLGdCQUN4QnhKLEtBQUEsQ0FBQUMsYUFBQTtJQUFPc0YsSUFBSSxFQUFDLE9BQU87SUFBQ2hELEdBQUcsRUFBQyxLQUFLO0lBQUNQLEdBQUcsRUFBQyxNQUFNO0lBQUN5UyxJQUFJLEVBQUMsTUFBTTtJQUFDaEgsS0FBSyxFQUFFbk8sTUFBTSxDQUFDSyxVQUFXO0lBQzVFb1osUUFBUSxFQUFFcmIsQ0FBQyxJQUFJcWIsUUFBUSxDQUFDLFlBQVksRUFBRStDLFVBQVUsQ0FBQ3BlLENBQUMsQ0FBQ3NiLE1BQU0sQ0FBQ3ZMLEtBQUssQ0FBQztFQUFFLENBQUMsQ0FBQyxlQUN0RXpOLEtBQUEsQ0FBQUMsYUFBQTtJQUFNQyxTQUFTLEVBQUM7RUFBYSxHQUFFWixNQUFNLENBQUNLLFVBQVUsQ0FBQ29jLE9BQU8sQ0FBQyxDQUFDLENBQVEsQ0FDN0QsQ0FBQyxlQUNSL2IsS0FBQSxDQUFBQyxhQUFBLENBQUNnYyxRQUFRO0lBQUN6UyxLQUFLLEVBQUMsMENBQTBDO0lBQUNpRSxLQUFLLEVBQUVuTyxNQUFNLENBQUNHLGNBQWU7SUFDdEZzWixRQUFRLEVBQUVySyxDQUFDLElBQUlxSyxRQUFRLENBQUMsZ0JBQWdCLEVBQUVySyxDQUFDO0VBQUUsQ0FBQyxDQUFDLGVBQ2pEMU8sS0FBQSxDQUFBQyxhQUFBLENBQUNnYyxRQUFRO0lBQUN6UyxLQUFLLEVBQUMsa0NBQWtDO0lBQUNpRSxLQUFLLEVBQUVuTyxNQUFNLENBQUNJLGFBQWM7SUFDN0VxWixRQUFRLEVBQUVySyxDQUFDLElBQUlxSyxRQUFRLENBQUMsZUFBZSxFQUFFckssQ0FBQztFQUFFLENBQUMsQ0FDNUMsQ0FBQyxlQUVOMU8sS0FBQSxDQUFBQyxhQUFBO0lBQUtDLFNBQVMsRUFBQztFQUFVLGdCQUN2QkYsS0FBQSxDQUFBQyxhQUFBO0lBQUtDLFNBQVMsRUFBQztFQUFxQixHQUFDLE9BQVUsQ0FBQyxlQUNoREYsS0FBQSxDQUFBQyxhQUFBLENBQUMyYixLQUFLO0lBQUNwUyxLQUFLLEVBQUM7RUFBYyxnQkFDekJ4SixLQUFBLENBQUFDLGFBQUE7SUFBS0MsU0FBUyxFQUFDO0VBQWEsR0FDekIsQ0FBQyxTQUFTLEVBQUMsU0FBUyxFQUFDLFNBQVMsRUFBQyxTQUFTLEVBQUMsU0FBUyxFQUFDLFNBQVMsRUFBQyxTQUFTLENBQUMsQ0FBQzdFLEdBQUcsQ0FBQ0MsQ0FBQyxpQkFDNUUwRSxLQUFBLENBQUFDLGFBQUE7SUFBUWdCLEdBQUcsRUFBRTNGLENBQUU7SUFDYjRFLFNBQVMsRUFBRSxhQUFhWixNQUFNLENBQUM2YixXQUFXLEtBQUs3ZixDQUFDLEdBQUcsUUFBUSxHQUFHLEVBQUUsRUFBRztJQUNuRTZFLEtBQUssRUFBRTtNQUFDdUssVUFBVSxFQUFFcFA7SUFBQyxDQUFFO0lBQ3ZCcVMsT0FBTyxFQUFFQSxDQUFBLEtBQU1vTCxRQUFRLENBQUMsYUFBYSxFQUFFemQsQ0FBQyxDQUFFO0lBQzFDLGNBQVlBO0VBQUUsQ0FBQyxDQUNsQixDQUNFLENBQ0EsQ0FBQyxlQUNSMEUsS0FBQSxDQUFBQyxhQUFBLENBQUMyYixLQUFLO0lBQUNwUyxLQUFLLEVBQUM7RUFBa0IsZ0JBQzdCeEosS0FBQSxDQUFBQyxhQUFBO0lBQU9zRixJQUFJLEVBQUMsT0FBTztJQUFDaEQsR0FBRyxFQUFDLEdBQUc7SUFBQ1AsR0FBRyxFQUFDLEtBQUs7SUFBQ3lTLElBQUksRUFBQyxJQUFJO0lBQUNoSCxLQUFLLEVBQUVuTyxNQUFNLENBQUM4YyxlQUFnQjtJQUM1RXJELFFBQVEsRUFBRXJiLENBQUMsSUFBSXFiLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRTNXLFFBQVEsQ0FBQzFFLENBQUMsQ0FBQ3NiLE1BQU0sQ0FBQ3ZMLEtBQUssQ0FBQztFQUFFLENBQUMsQ0FBQyxlQUN6RXpOLEtBQUEsQ0FBQUMsYUFBQTtJQUFNQyxTQUFTLEVBQUM7RUFBYSxHQUFFWixNQUFNLENBQUM4YyxlQUFzQixDQUN2RCxDQUNKLENBQUMsZUFFTnBjLEtBQUEsQ0FBQUMsYUFBQTtJQUFLQyxTQUFTLEVBQUM7RUFBVSxnQkFDdkJGLEtBQUEsQ0FBQUMsYUFBQTtJQUFLQyxTQUFTLEVBQUM7RUFBcUIsR0FBQyxLQUFRLENBQUMsZUFDOUNGLEtBQUEsQ0FBQUMsYUFBQSxDQUFDZ2MsUUFBUTtJQUFDelMsS0FBSyxFQUFDLGdCQUFnQjtJQUFDaUUsS0FBSyxFQUFFbk8sTUFBTSxDQUFDK2MsYUFBYztJQUMzRHRELFFBQVEsRUFBRXJLLENBQUMsSUFBSXFLLFFBQVEsQ0FBQyxlQUFlLEVBQUVySyxDQUFDO0VBQUUsQ0FBQyxDQUFDLGVBQ2hEMU8sS0FBQSxDQUFBQyxhQUFBLENBQUNnYyxRQUFRO0lBQUN6UyxLQUFLLEVBQUMsbUJBQW1CO0lBQUNpRSxLQUFLLEVBQUVuTyxNQUFNLENBQUNnZCxlQUFnQjtJQUNoRXZELFFBQVEsRUFBRXJLLENBQUMsSUFBSXFLLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRXJLLENBQUM7RUFBRSxDQUFDLENBQUMsZUFDbEQxTyxLQUFBLENBQUFDLGFBQUEsQ0FBQzJiLEtBQUs7SUFBQ3BTLEtBQUssRUFBQztFQUFrQixnQkFDN0J4SixLQUFBLENBQUFDLGFBQUE7SUFBT3NGLElBQUksRUFBQyxNQUFNO0lBQUNyRixTQUFTLEVBQUMsU0FBUztJQUFDdU4sS0FBSyxFQUFFbk8sTUFBTSxDQUFDaWQsZUFBZ0I7SUFDbkV4RCxRQUFRLEVBQUVyYixDQUFDLElBQUlxYixRQUFRLENBQUMsaUJBQWlCLEVBQUVyYixDQUFDLENBQUNzYixNQUFNLENBQUN2TCxLQUFLO0VBQUUsQ0FBQyxDQUN6RCxDQUNKLENBQUMsZUFFTnpOLEtBQUEsQ0FBQUMsYUFBQTtJQUFLQyxTQUFTLEVBQUM7RUFBVyxnQkFDeEJGLEtBQUEsQ0FBQUMsYUFBQTtJQUFRQyxTQUFTLEVBQUMsVUFBVTtJQUFDeU4sT0FBTyxFQUFFZ087RUFBUSxHQUFDLG1CQUF5QixDQUNyRSxDQUNGLENBQUMsZUFFTjNiLEtBQUEsQ0FBQUMsYUFBQSxnQkFBUTtBQUNkO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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