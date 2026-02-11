"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

export function useSocket(eventId?: string) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    if (eventId) {
      socket.emit("join:event", eventId);
    }

    return () => {
      if (eventId) {
        socket.emit("leave:event", eventId);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [eventId]);

  const on = useCallback(
    (event: string, callback: (...args: unknown[]) => void) => {
      socketRef.current?.on(event, callback);
      return () => {
        socketRef.current?.off(event, callback);
      };
    },
    []
  );

  return { on };
}
