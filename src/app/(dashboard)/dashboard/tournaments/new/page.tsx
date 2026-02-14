import { CreateTournamentForm } from "@/components/tournaments/create-tournament-form";

export default function NewTournamentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Tournament</h1>
        <p className="text-muted-foreground">
          Set up a new tournament or competition
        </p>
      </div>
      <CreateTournamentForm />
    </div>
  );
}
