"use client";

import { useEffect, useState, useRef } from "react";

interface TimerProps {
  totalSeconds: number;
  onExpire: () => void;
  running: boolean;
}

export function Timer({ totalSeconds, onExpire, running }: TimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(totalSeconds);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    setTimeRemaining(totalSeconds);
    hasExpiredRef.current = false;
  }, [totalSeconds]);

  useEffect(() => {
    if (!running) return;
    hasExpiredRef.current = false;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [running]);

  // Call onExpire outside the state updater to avoid updating parent during render
  useEffect(() => {
    if (timeRemaining === 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpireRef.current();
    }
  }, [timeRemaining]);

  const percentage = (timeRemaining / totalSeconds) * 100;
  
  const getColor = () => {
    if (percentage > 50) return "#10B981"; // emerald
    if (percentage > 25) return "#F59E0B"; // amber
    return "#F43F5E"; // rose
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-14 h-14">
      <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={getColor()}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-xl font-bold font-heading"
          style={{ color: getColor() }}
        >
          {timeRemaining}
        </span>
      </div>
    </div>
  );
}
