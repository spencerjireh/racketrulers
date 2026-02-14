"use client";

import { useEffect, useRef, useCallback } from "react";
import Pusher, { Channel } from "pusher-js";

let pusherInstance: Pusher | null = null;

function getPusher() {
  if (!pusherInstance) {
    const key = process.env.NEXT_PUBLIC_SOKETI_KEY;
    const host = process.env.NEXT_PUBLIC_SOKETI_HOST;
    const port = Number(process.env.NEXT_PUBLIC_SOKETI_PORT || "443");

    if (!key || !host) {
      throw new Error(
        "Missing NEXT_PUBLIC_SOKETI_KEY or NEXT_PUBLIC_SOKETI_HOST env vars"
      );
    }

    pusherInstance = new Pusher(key, {
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS: port === 443,
      enabledTransports: ["ws", "wss"],
      cluster: "",
    });
  }
  return pusherInstance;
}

export function useSocket(tournamentId?: string) {
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!tournamentId) return;

    const pusher = getPusher();
    const channel = pusher.subscribe(`tournament.${tournamentId}`);
    channelRef.current = channel;

    return () => {
      pusher.unsubscribe(`tournament.${tournamentId}`);
      channelRef.current = null;
    };
  }, [tournamentId]);

  const on = useCallback(
    (event: string, callback: (...args: unknown[]) => void) => {
      const channel = channelRef.current;
      if (!channel) return () => {};

      channel.bind(event, callback);
      return () => {
        channel.unbind(event, callback);
      };
    },
    []
  );

  return { on };
}
