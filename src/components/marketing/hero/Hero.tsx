"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ListIcon, XIcon } from "@phosphor-icons/react";
import { mountHalcyon, type Halcyon } from "./halcyon";
import "./hero.css";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "/security", label: "Security" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/login", label: "Sign in" },
];

const WAKE: [number, number, number][] = [
  [0.5, 0.23, 220], [0.4, 0.21, 320], [0.6, 0.21, 360], [0.34, 0.19, 470], [0.66, 0.19, 510], [0.5, 0.25, 650],
];

const COUNT_MS = 1800;
const MAX_TILT = 12;
const SEEN_KEY = "ss-hero-seen";

const CARD = "/lumen-settleshort/card.png";
const LOGO = "/lumen-settleshort/logo.svg";

function Logo({ className }: { className: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation to gain
  return <img src={LOGO} alt="SettleShort" width={188} height={32} className={className} />;
}

function Words({ text, delay, className }: { text: string; delay: number; className?: string }) {
  return (
    <span className={className}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="lh-w" style={{ "--d": `${delay + i * 90}ms` } as React.CSSProperties}>
          {w}
          {i < text.split(" ").length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

function ReceiptCard() {
  // eslint-disable-next-line @next/next/no-img-element -- also used as the sheen mask, so it must be the raw file
  return <img src={CARD} alt="" width={900} height={1314} draggable={false} className="lh-card" />;
}

function Preloader({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const R = 190;
  const C = 2 * Math.PI * R;
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const exit = () => {
      const s0 = performance.now();
      const step = () => {
        const e = Math.min(1, (performance.now() - s0) / 900);
        const k = 1 - Math.pow(1 - e, 3);
        if (ref.current) ref.current.style.maskImage = ref.current.style.webkitMaskImage = `linear-gradient(to bottom, transparent ${k * 116}%, #000 ${k * 116}%)`;
        if (inner.current) inner.current.style.transform = `translateY(${k * 46}%) scale(${1 - 0.05 * k})`;
        if (e < 1) raf = requestAnimationFrame(step);
        else onDone();
      };
      raf = requestAnimationFrame(step);
    };
    const count = () => {
      const p = Math.min(1, (performance.now() - t0) / COUNT_MS);
      setN(Math.round(ease(p) * 100));
      if (p < 1) raf = requestAnimationFrame(count);
      else {
        onReveal();
        setTimeout(exit, 120);
      }
    };
    raf = requestAnimationFrame(count);
    return () => cancelAnimationFrame(raf);
  }, [onReveal, onDone]);
  return (
    <div ref={ref} className="lh-pre" role="status" aria-live="polite" aria-label={`Loading ${n}%`}>
      <div ref={inner} style={{ position: "absolute", inset: 0 }}>
        <Logo className="lh-pre-logo" />
        <div className="lh-ring" style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%" }}>
          <svg viewBox="0 0 385 385" aria-hidden>
            <defs>
              <linearGradient id="lh-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="5.58%" stopColor="#000" />
                <stop offset="59.63%" stopColor="#3700bd" />
                <stop offset="100%" stopColor="#d8c2eb" />
              </linearGradient>
            </defs>
            <circle cx="192.5" cy="192.5" r={R} fill="none" stroke="rgba(20,0,56,0.08)" strokeWidth="5" />
            <circle cx="192.5" cy="192.5" r={R} fill="none" stroke="url(#lh-g)" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - n / 100)} />
          </svg>
          <span className="lh-count">{n}</span>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const gl = useRef<Halcyon | null>(null);
  const [on, setOn] = useState(false);
  const [pre, setPre] = useState<boolean | null>(null);
  const [menu, setMenu] = useState(false);
  const reveal = useCallback(() => {
    setOn(true);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, []);
  const done = useCallback(() => setPre(false), []);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    const skip = reduced || seen;
    // Decided client-side: sessionStorage and the media query do not exist on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPre(!skip);
    if (skip) setOn(true);
    if (canvas.current) {
      try {
        gl.current = mountHalcyon(canvas.current, reduced);
      } catch {
        gl.current = null;
      }
    }
    if (skip) gl.current?.reveal();
    return () => gl.current?.destroy();
  }, []);

  useEffect(() => {
    if (!on) return;
    gl.current?.reveal();
    const ids = WAKE.map(([x, y, ms]) => setTimeout(() => gl.current?.spawnRipple(x, y), ms));
    return () => ids.forEach(clearTimeout);
  }, [on]);

  useEffect(() => {
    const el = root.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let tx = 0, ty = 0, rx = 0, ry = 0, raf = 0;
    const tick = () => {
      rx += (tx - rx) * 0.12;
      ry += (ty - ry) * 0.12;
      el.style.setProperty("--rx", rx.toFixed(3));
      el.style.setProperty("--ry", ry.toFixed(3));
      el.style.setProperty("--p", (50 - rx * 4).toFixed(2));
      if (Math.abs(tx - rx) + Math.abs(ty - ry) > 0.01) raf = requestAnimationFrame(tick);
      else raf = 0;
    };
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / innerWidth) * 2 - 1, ny = (e.clientY / innerHeight) * 2 - 1;
      tx = -ny * MAX_TILT;
      ty = nx * MAX_TILT;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

  return (
    <section ref={root} className={`lh${on ? " on" : ""}`} aria-label="SettleShort">
      <canvas ref={canvas} className="lh-canvas" aria-hidden />
      <div className="lh-rule" aria-hidden />

      <div className="lh-stage" aria-hidden>
        <div className="lh-rise">
          <div className="lh-tilt">
            <ReceiptCard />
            <div className="lh-sheen" />
          </div>
        </div>
      </div>
      <div className="lh-refl" aria-hidden>
        <div className="lh-rise">
          <div className="lh-tilt">
            <ReceiptCard />
          </div>
        </div>
      </div>

      <header className="lh-head lh-in lh-down" style={d(100)}>
        <Link href="/" className="lh-logo" aria-label="SettleShort home">
          <Logo className="lh-logo-img" />
        </Link>
        <nav aria-label="Main">
          <ul className="lh-nav">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <a href="/demo" className="lh-pill lh-head-cta">
          Open the demo <span className="lh-dot" />
        </a>
        <button type="button" className="lh-burger" aria-expanded={menu} aria-controls="lh-menu" aria-label={menu ? "Close menu" : "Open menu"} onClick={() => setMenu((m) => !m)}>
          {menu ? <XIcon size={20} aria-hidden /> : <ListIcon size={20} aria-hidden />}
        </button>
      </header>
      {menu && (
        <nav id="lh-menu" className="lh-menu" aria-label="Menu">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMenu(false)}>
              {l.label}
            </a>
          ))}
          <a href="/demo" className="lh-btn lh-btn-primary" style={{ marginTop: 6 }}>
            Open the demo <span className="lh-dot" />
          </a>
        </nav>
      )}

      <h1 className="lh-h1">
        <Words text="Receipt in. Settled out." delay={300} />
        <br />
        <Words text="One approve." delay={470} className="lh-l2" />
      </h1>

      <div className="lh-bottom">
        <p className="lh-copy lh-in" style={d(550)}>
          Receipts and “I paid for dinner” messages become claims. Duplicates get caught. PayPal pays your team, only after an admin approves.
        </p>
        <ul className="lh-feat lh-in" style={d(620)}>
          <li>Every field quotes the receipt</li>
          <li>Sandbox only. No real money moves</li>
        </ul>
        <div className="lh-ctas">
          <a href="/demo" className="lh-btn lh-btn-primary lh-in" style={d(680)}>
            Open the demo <span className="lh-dot" />
          </a>
          <a href="#how" className="lh-btn lh-btn-ghost lh-in" style={d(770)}>
            How it works
          </a>
        </div>
      </div>

      <p className="lh-outro" aria-hidden>
        <Words text="PayPal Payouts," delay={520} className="lh-l1" />
        <br />
        <Words text="one human approve." delay={640} />
      </p>

      {pre && <Preloader onReveal={reveal} onDone={done} />}
    </section>
  );
}
