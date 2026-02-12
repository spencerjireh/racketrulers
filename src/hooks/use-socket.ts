"use client";

import { useEffect, useRef, useCallback } from "react";
import Pusher, { Channel } from "pusher-js";

const SOKETI_KEY = process.env.NEXT_PUBLIC_SOKETI_KEY!;
const SOKETI_HOST = process.env.NEXT_PUBLIC_SOKETI_HOST!;
const SOKETI_PORT = Number(process.env.NEXT_PUBLIC_SOKETI_PORT || "443");

let pusherInstance: Pusher | null = null;

function getPusher() {
  if (!pusherInstance) {
    pusherInstance = new Pusher(SOKETI_KEY, {
      wsHost: SOKETI_HOST,
      wsPort: SOKETI_PORT,
      wssPort: SOKETI_PORT,
      forceTLS: SOKETI_PORT === 443,
      enabledTransports: ["ws", "wss"],
      cluster: "",
    });
  }
  return pusherInstance;
}

export function useSocket(eventId?: string) {
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!eventId) return;

    const pusher = getPusher();
    const channel = pusher.subscribe(`event.${eventId}`);
    channelRef.current = channel;

    return () => {
      pusher.unsubscribe(`event.${eventId}`);
      channelRef.current = null;
    };
  }, [eventId]);

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
