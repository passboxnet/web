import { useEffect, useState } from "react";
import { CopyButton } from "./CopyButton";
import { useCore } from "./useCore";

/** Reads the period from an otpauth:// URI; plain secrets use the standard 30 seconds. */
function periodOf(uriOrSecret: string): number {
  const match = /[?&]period=(\d+)/i.exec(uriOrSecret);
  const period = match ? Number(match[1]) : 30;
  return period > 0 ? period : 30;
}

function now() {
  return Math.floor(Date.now() / 1000);
}

export function TotpField({ uri }: { uri: string }) {
  const core = useCore();
  const [time, setTime] = useState(now);

  useEffect(() => {
    const timer = setInterval(() => setTime(now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!core) return <span className="text-sm text-text-muted">Loading…</span>;

  let code: string;
  try {
    code = core.totpCode(uri, time);
  } catch {
    return <span className="text-sm text-danger">Invalid one-time password setup</span>;
  }
  const period = periodOf(uri);
  const remaining = period - (time % period);

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-lg tracking-widest">
        {code.slice(0, 3)} {code.slice(3)}
      </span>
      <CountdownRing remaining={remaining} period={period} />
      <CopyButton value={code} label="one-time password" />
    </div>
  );
}

function CountdownRing({ remaining, period }: { remaining: number; period: number }) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const urgent = remaining <= 5;
  return (
    <svg viewBox="0 0 24 24" className="size-6 -rotate-90" role="img" aria-label={`${remaining} seconds remaining`}>
      <circle cx="12" cy="12" r={radius} className="fill-none stroke-border" strokeWidth="3" />
      <circle
        cx="12"
        cy="12"
        r={radius}
        className={urgent ? "fill-none stroke-danger" : "fill-none stroke-accent"}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - remaining / period)}
      />
    </svg>
  );
}
