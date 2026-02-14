import { useState, useCallback } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SetScore } from "@/server/lib/scoring-validation";

interface CascadeInfo {
  downstreamCount: number;
  scoredCount: number;
  pendingSetScores: SetScore[];
  gameId: string;
  type: "score" | "reset";
}

type CausePayload = {
  data?: {
    cause?: { type?: string; downstreamCount?: number; scoredCount?: number };
  };
};

export function useScoreEntry(
  tournamentId: string,
  invalidateKeys: () => void
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [scoringGameId, setScoringGameId] = useState<string | null>(null);
  const [cascadeInfo, setCascadeInfo] = useState<CascadeInfo | null>(null);
  const [pendingResetGameId, setPendingResetGameId] = useState<string | null>(
    null
  );
  const [lastSubmittedScores, setLastSubmittedScores] = useState<SetScore[]>([]);

  const invalidate = useCallback(() => {
    invalidateKeys();
    queryClient.invalidateQueries(
      trpc.games.listByTournament.queryFilter({ tournamentId })
    );
  }, [queryClient, trpc, tournamentId, invalidateKeys]);

  const updateScore = useMutation(
    trpc.games.updateScore.mutationOptions({
      onSuccess: () => {
        invalidate();
        setScoringGameId(null);
        setCascadeInfo(null);
        toast.success("Score saved");
      },
      onError: (err) => {
        const cause = (err as CausePayload).data?.cause;
        if (cause?.type === "CASCADE_REQUIRED" && scoringGameId) {
          setCascadeInfo({
            downstreamCount: cause.downstreamCount ?? 0,
            scoredCount: cause.scoredCount ?? 0,
            pendingSetScores: lastSubmittedScores,
            gameId: scoringGameId,
            type: "score",
          });
          return;
        }
        toast.error(err.message);
      },
    })
  );

  const updateStatus = useMutation(
    trpc.games.updateStatus.mutationOptions({
      onSuccess: () => {
        invalidate();
        setScoringGameId(null);
        toast.success("Status updated");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const resetScore = useMutation(
    trpc.games.resetScore.mutationOptions({
      onSuccess: () => {
        invalidate();
        setCascadeInfo(null);
        setPendingResetGameId(null);
        toast.success("Score reset");
      },
      onError: (err) => {
        const cause = (err as CausePayload).data?.cause;
        if (cause?.type === "CASCADE_REQUIRED" && pendingResetGameId) {
          setCascadeInfo({
            downstreamCount: cause.downstreamCount ?? 0,
            scoredCount: cause.scoredCount ?? 0,
            pendingSetScores: [],
            gameId: pendingResetGameId,
            type: "reset",
          });
          return;
        }
        setPendingResetGameId(null);
        toast.error(err.message);
      },
    })
  );

  function submitScore(gameId: string, setScores: SetScore[]) {
    setLastSubmittedScores(setScores);
    updateScore.mutate({ id: gameId, tournamentId, setScores });
  }

  function submitForfeit(gameId: string, winnerId: string) {
    updateStatus.mutate({
      id: gameId,
      tournamentId,
      status: "FORFEIT",
      forfeitWinnerId: winnerId,
    });
  }

  function submitCancel(gameId: string) {
    updateStatus.mutate({
      id: gameId,
      tournamentId,
      status: "CANCELLED",
    });
  }

  function submitReset(gameId: string) {
    setPendingResetGameId(gameId);
    resetScore.mutate({ id: gameId, tournamentId });
  }

  function confirmCascade() {
    if (!cascadeInfo) return;
    if (cascadeInfo.type === "reset") {
      resetScore.mutate({
        id: cascadeInfo.gameId,
        tournamentId,
        confirmCascade: true,
      });
    } else {
      updateScore.mutate({
        id: cascadeInfo.gameId,
        tournamentId,
        setScores: cascadeInfo.pendingSetScores,
        confirmCascade: true,
      });
    }
  }

  return {
    scoringGameId,
    setScoringGameId,
    cascadeInfo,
    setCascadeInfo,
    submitScore,
    submitForfeit,
    submitCancel,
    submitReset,
    confirmCascade,
    isPending: updateScore.isPending || updateStatus.isPending,
    isResetPending: resetScore.isPending,
  };
}
