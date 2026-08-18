"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";

interface Status {
  status: string;
  connected: boolean;
  phone?: string | null;
  qr?: string | null;
  error?: string;
  warning?: string;
}

const POLL_MS = 2500;

export function ConnectPanel() {
  const [state, setState] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/channel/status", { cache: "no-store" });
      const body: Status = await r.json();
      setState(body);
      // Keep polling until connected.
      if (!body.connected) timer.current = setTimeout(poll, POLL_MS);
    } catch {
      timer.current = setTimeout(poll, POLL_MS);
    }
  }, []);

  useEffect(() => {
    poll();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  const connect = async () => {
    setBusy(true);
    setWarning(null);
    try {
      const r = await fetch("/api/channel/connect", { method: "POST" });
      const body = await r.json();
      if (!r.ok) {
        setState((s) => ({ ...(s ?? { status: "disconnected", connected: false }), error: body.error }));
      } else {
        if (body.warning) setWarning(body.warning);
        if (timer.current) clearTimeout(timer.current);
        poll();
      }
    } finally {
      setBusy(false);
    }
  };

  const status = state?.status ?? "disconnected";
  const badgeStatus =
    status === "connected" ? "qualified" : status === "linking" ? "pending" : "not_qualified";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Connection</span>
          <StatusBadge status={badgeStatus} />
        </div>
        {status !== "connected" && (
          <button
            onClick={connect}
            disabled={busy}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Starting..." : status === "linking" ? "Restart linking" : "Connect WhatsApp"}
          </button>
        )}
      </div>

      {warning && (
        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">{warning}</p>
      )}
      {state?.error && (
        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">{state.error}</p>
      )}

      {status === "connected" && (
        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <p className="font-display text-lg font-medium">WhatsApp is linked</p>
          <p className="mt-1 text-sm text-muted">
            {state?.phone ? `Connected number: ${state.phone}` : "Your number is connected."} Incoming
            messages will start conversations automatically.
          </p>
        </div>
      )}

      {status === "linking" && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface/60 p-6 text-center">
          {state?.qr ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.qr}
                alt="WhatsApp QR code"
                className="h-64 w-64 rounded-lg bg-white p-2"
              />
              <div className="max-w-sm text-sm text-muted">
                On your phone open WhatsApp, go to Settings, Linked devices, Link a device, and scan
                this code. It refreshes automatically.
              </div>
            </>
          ) : (
            <p className="py-16 text-sm text-muted">Preparing the QR code...</p>
          )}
        </div>
      )}

      {status === "disconnected" && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="font-display text-lg font-medium">No number connected</p>
          <p className="mt-1 text-sm text-muted">
            Connect a WhatsApp number so your agent can receive and reply to messages.
          </p>
        </div>
      )}

      {status === "unreachable" && (
        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          The WhatsApp gateway is not reachable right now. Make sure it is running, then try again.
        </p>
      )}
    </div>
  );
}
