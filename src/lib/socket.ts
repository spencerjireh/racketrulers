import "server-only";

import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.SOKETI_APP_ID!,
  key: process.env.SOKETI_APP_KEY!,
  secret: process.env.SOKETI_APP_SECRET!,
  host: process.env.SOKETI_HOST!,
  port: process.env.SOKETI_PORT || "443",
  useTLS: process.env.SOKETI_USE_TLS !== "false",
});

export async function emitToTournament(
  tournamentId: string,
  event: string,
  payload: unknown
) {
  try {
    await pusher.trigger(`tournament.${tournamentId}`, event, payload);
  } catch (err) {
    console.error("Failed to emit to Soketi:", err);
  }
}
