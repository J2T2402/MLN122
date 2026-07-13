import React, { useEffect, useState } from "react";

interface CountdownRingProps {
  deadlineTs: number | null;
  clockOffset: number;
  durationSec: number;
  onTimeUp?: () => void;
}

export const CountdownRing: React.FC<CountdownRingProps> = ({
  deadlineTs,
  clockOffset,
  durationSec,
  onTimeUp
}) => {
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
  const [isLow, setIsLow] = useState<boolean>(false);
  const [isCritical, setIsCritical] = useState<boolean>(false);

  useEffect(() => {
    if (deadlineTs === null || durationSec <= 0) {
      setTimeLeftMs(0);
      return;
    }

    const interval = setInterval(() => {
      const nowServer = Date.now() + clockOffset;
      const diff = deadlineTs - nowServer;

      if (diff <= 0) {
        setTimeLeftMs(0);
        clearInterval(interval);
        if (onTimeUp) onTimeUp();
      } else {
        setTimeLeftMs(diff);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [deadlineTs, clockOffset, durationSec]);

  useEffect(() => {
    const sec = timeLeftMs / 1000;
    const ratio = durationSec > 0 ? sec / durationSec : 0;
    
    setIsLow(ratio <= 0.5 && ratio > 0.1);
    setIsCritical(ratio <= 0.1);
  }, [timeLeftMs, durationSec]);

  if (deadlineTs === null || durationSec <= 0) {
    return null;
  }

  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const progressRatio = Math.max(0, Math.min(1, timeLeftMs / (durationSec * 1000)));

  // SVG parameters
  const radius = 24;
  const stroke = 4;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - progressRatio * circumference;

  let colorClass = "stroke-primary-600";
  if (isCritical) {
    colorClass = "stroke-danger animate-pulse";
  } else if (isLow) {
    colorClass = "stroke-warning";
  }

  return (
    <div className={`relative flex items-center justify-center h-16 w-16 select-none ${isCritical ? "animate-bounce" : ""}`}>
      <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 48 48">
        {/* Track circle */}
        <circle
          className="stroke-neutral-300 fill-none"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Progress circle */}
        <circle
          className={`fill-none transition-all duration-100 ease-linear ${colorClass}`}
          strokeWidth={stroke}
          strokeDasharray={circumference + " " + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      {/* Label */}
      <span className={`absolute font-mono text-lg font-bold ${isCritical ? "text-danger" : isLow ? "text-warning" : "text-primary-700"}`}>
        {secondsLeft}
      </span>
    </div>
  );
};
