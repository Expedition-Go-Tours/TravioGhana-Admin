import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
}

export function AnimatedNumber({ value, format }: AnimatedNumberProps) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 60, damping: 20 });

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  const display = useTransform(spring, (v) => (format ? format(v) : String(Math.round(v))));

  return <motion.span>{display}</motion.span>;
}
