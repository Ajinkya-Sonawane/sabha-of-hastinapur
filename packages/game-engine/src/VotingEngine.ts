import { isConspirator, type PlayerId, type VoteResult } from "@sabha/protocol";
import { currentRoleIdOf } from "./CardEngine";
import { getRole } from "./roles/registry";
import type { InternalGameState, Vote } from "./types";

/**
 * Vote weights are computed entirely server-side from FINAL roles. The
 * client never learns why a vote weighed more (or less) than one.
 */
export function voteWeight(state: InternalGameState, voterId: PlayerId, targetId: PlayerId): number {
  const voterRole = getRole(currentRoleIdOf(state, voterId));
  const targetRole = currentRoleIdOf(state, targetId);
  const rule = voterRole.votingRule;
  if (rule?.type === "DOUBLE_AGAINST_CONSPIRATOR" && isConspirator(targetRole)) return 2;
  if (rule?.type === "NULL_AGAINST_ROLE" && targetRole === rule.role) return 0;
  return 1;
}

export function buildVote(state: InternalGameState, voterId: PlayerId, targetId: PlayerId): Vote {
  return { voterId, targetId, weight: voteWeight(state, voterId, targetId) };
}

/** Every tied highest-scoring player is eliminated. No votes (or all zero) eliminates nobody. */
export function tallyVotes(votes: Vote[]): VoteResult {
  const totals: Record<PlayerId, number> = {};
  for (const vote of votes) {
    totals[vote.targetId] = (totals[vote.targetId] ?? 0) + vote.weight;
  }
  const highestScore = Math.max(0, ...Object.values(totals));
  const primaryTargets =
    highestScore > 0
      ? (Object.keys(totals) as PlayerId[]).filter((pid) => totals[pid] === highestScore)
      : [];
  return { totals, highestScore, primaryTargets };
}
