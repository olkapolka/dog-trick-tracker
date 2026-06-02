import useSWR from "swr";

const SCORE_KEY = "/api/tricks/score";

async function fetchScore(url: string): Promise<number> {
  const res = await fetch(url);
  if (!res.ok) return 0;
  const data = (await res.json()) as { score: number };
  return data.score;
}

interface Props {
  initialScore: number;
}

export default function TrainingPoints({ initialScore }: Props) {
  const { data: score } = useSWR(SCORE_KEY, fetchScore, { fallbackData: initialScore });

  return <span className="text-sm font-bold text-purple-300">{score}</span>;
}

export { SCORE_KEY };
