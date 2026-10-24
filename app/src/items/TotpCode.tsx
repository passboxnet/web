import { useEffect, useState } from "react";
import { loadCore } from "../core";

type Core = Awaited<ReturnType<typeof loadCore>>;

/** Reads the period from an otpauth:// URI; plain secrets use the standard 30 seconds. */
function periodOf(uriOrSecret: string): number {
  const match = /[?&]period=(\d+)/i.exec(uriOrSecret);
  const period = match ? Number(match[1]) : 30;
  return period > 0 ? period : 30;
}

const now = () => Math.floor(Date.now() / 1000);

/** Current code, seconds remaining and period for a TOTP secret, updated every second. */
export function useTotp(uri: string): { code: string; remaining: number; period: number } | "invalid" | undefined {
  const [core, setCore] = useState<Core>();
  const [time, setTime] = useState(now);

  useEffect(() => {
    loadCore().then(setCore);
    const timer = setInterval(() => setTime(now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!core) return undefined;
  try {
    const period = periodOf(uri);
    return { code: core.totpCode(uri, time), remaining: period - (time % period), period };
  } catch {
    return "invalid";
  }
}

export function CountdownRing({ remaining, period }: { remaining: number; period: number }) {
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const urgent = remaining <= 5;
  return (
    <span className="relative inline-flex size-7 items-center justify-center">
      <svg viewBox="0 0 20 20" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="10" cy="10" r={radius} className="fill-none stroke-border" strokeWidth="2" />
        <circle
          cx="10"
          cy="10"
          r={radius}
          className={urgent ? "fill-none stroke-danger" : "fill-none stroke-accent"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - remaining / period)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span
        className={urgent ? "text-2xs font-medium tabular-nums text-danger" : "text-2xs tabular-nums text-text-muted"}
      >
        {remaining}
      </span>
    </span>
  );
}
