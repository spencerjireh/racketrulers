import "server-only";

const SOCKET_IO_SERVER_URL =
  process.env.SOCKET_IO_SERVER_URL || "http://localhost:3001";

export async function emitToEvent(
  eventId: string,
  event: string,
  payload: unknown
) {
  const res = await fetch(`${SOCKET_IO_SERVER_URL}/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, event, payload }),
  });

  if (!res.ok) {
    console.error("Failed to emit to Socket.IO server:", await res.text());
  }
}
