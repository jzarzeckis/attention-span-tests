import { useState, useEffect } from "react";

interface Props {
  onDone: () => void;
}

const STEPS = [
  { text: "Ready", cls: "text-muted-foreground" },
  { text: "Set", cls: "text-yellow-500" },
  { text: "Go!", cls: "text-green-500" },
] as const;

export function ReadySetGo({ onDone }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 800);
    const t2 = setTimeout(() => setStep(2), 1500);
    const t3 = setTimeout(onDone, 2100);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [onDone]);

  const { text, cls } = STEPS[step] ?? STEPS[0]!;

  return (
    <div className="w-full h-64 rounded-xl bg-muted flex items-center justify-center select-none">
      <span key={step} className={`text-8xl font-black ${cls}`}>
        {text}
      </span>
    </div>
  );
}
