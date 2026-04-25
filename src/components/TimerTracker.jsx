import { useEffect, useRef } from "react";
import { startTimer } from "../utils/timeTracker";

export default function TimerTracker({ onStart }) {
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = startTimer();

    if (onStart) {
      onStart(timerRef.current);
    }
  }, []);

  return null;
}