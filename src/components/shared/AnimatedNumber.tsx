import { useMemo } from "react";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
}

/**
 * Numbers render statically. The shell has no motion; the name is retained so
 * existing call sites keep working.
 */
export function AnimatedNumber({ value, format }: AnimatedNumberProps) {
  const display = useMemo(
    () => (format ? format(value) : String(Math.round(value))),
    [format, value],
  );

  return <span className="tnum">{display}</span>;
}