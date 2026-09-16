import { rebonus, rebonusPrice, type Stat, type Stats } from "./core.ts";
export type Attempt = {
  number: number;
  cost: number;
  bonuses: Stats;
  decision: "accepted" | "rejected" | "pending";
};
export type Session = {
  current: Stats;
  candidate: Attempt | null;
  attempts: number;
  spent: number;
  history: Attempt[];
};
export const initialSession = (): Session => ({
  current: { hp: 23, spd: 22, ea: 22, pa: 23, ed: 23, pd: 23 },
  candidate: null,
  attempts: 0,
  spent: 0,
  history: [],
});
export function generate(
  session: Session,
  deprioritized: Stat[],
  rng: () => number,
): Session {
  if (session.candidate)
    throw new Error("Сначала примите или отклоните текущую попытку");
  const cost = rebonusPrice(session.current, deprioritized.length),
    bonuses = rebonus(deprioritized, rng);
  return {
    ...session,
    candidate: {
      number: session.attempts + 1,
      cost,
      bonuses,
      decision: "pending",
    },
    attempts: session.attempts + 1,
    spent: session.spent + cost,
  };
}
export function decide(session: Session, accept: boolean): Session {
  if (!session.candidate) throw new Error("Нет новой попытки");
  const decided: Attempt = {
    ...session.candidate,
    decision: accept ? "accepted" : "rejected",
  };
  return {
    ...session,
    current: accept ? { ...session.candidate.bonuses } : session.current,
    candidate: null,
    history: [decided, ...session.history].slice(0, 30),
  };
}
