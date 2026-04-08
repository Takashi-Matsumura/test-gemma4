'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type MinutesPhase = 'idle' | 'extracting' | 'generating' | 'done' | 'error';

export interface MinutesProgress {
  phase: MinutesPhase;
  /** Current chunk being processed (1-based) */
  current: number;
  /** Total chunks to process */
  total: number;
}

export interface MinutesTiming {
  /** Elapsed time in ms (updates live while active) */
  elapsedMs: number;
  /** Time spent on extraction phase (set when extraction completes) */
  extractionMs: number;
  /** Total time (set when generation completes) */
  totalMs: number;
}

interface MeetingMetadata {
  topic?: string;
  agendaItems?: string[];
  duration?: string;
  goals?: string;
}

interface UseMinutesGenerationReturn {
  minutesText: string;
  progress: MinutesProgress;
  timing: MinutesTiming;
  minutesError: string | null;
  generateMinutes: (transcript: string, metadata?: MeetingMetadata) => Promise<void>;
  resetMinutes: () => void;
}

const INITIAL_PROGRESS: MinutesProgress = { phase: 'idle', current: 0, total: 0 };
const INITIAL_TIMING: MinutesTiming = { elapsedMs: 0, extractionMs: 0, totalMs: 0 };

export function useMinutesGeneration(): UseMinutesGenerationReturn {
  const [minutesText, setMinutesText] = useState('');
  const [progress, setProgress] = useState<MinutesProgress>(INITIAL_PROGRESS);
  const [timing, setTiming] = useState<MinutesTiming>(INITIAL_TIMING);
  const [minutesError, setMinutesError] = useState<string | null>(null);

  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<MinutesPhase>('idle');

  // Live elapsed time ticker
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTiming((prev) => ({ ...prev, elapsedMs: Date.now() - startTimeRef.current }));
    }, 200);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const resetMinutes = useCallback(() => {
    stopTimer();
    setMinutesText('');
    setProgress(INITIAL_PROGRESS);
    setTiming(INITIAL_TIMING);
    setMinutesError(null);
    phaseRef.current = 'idle';
  }, [stopTimer]);

  const generateMinutes = useCallback(async (transcript: string, metadata?: MeetingMetadata) => {
    if (!transcript.trim()) return;

    setMinutesText('');
    setMinutesError(null);
    setProgress({ phase: 'extracting', current: 0, total: 0 });
    setTiming(INITIAL_TIMING);
    phaseRef.current = 'extracting';
    startTimer();

    try {
      const res = await fetch('/api/facilitation/minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcript.trim(), metadata }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'progress') {
              const newPhase = event.phase as MinutesPhase;
              // Record extraction time when transitioning to generating
              if (newPhase === 'generating' && phaseRef.current === 'extracting') {
                const extractionMs = Date.now() - startTimeRef.current;
                setTiming((prev) => ({ ...prev, extractionMs }));
              }
              phaseRef.current = newPhase;
              setProgress({
                phase: newPhase,
                current: event.current ?? 0,
                total: event.total ?? 0,
              });
            } else if (event.type === 'text') {
              accumulated += event.content;
              setMinutesText(accumulated);
            } else if (event.type === 'done') {
              const totalMs = Date.now() - startTimeRef.current;
              stopTimer();
              phaseRef.current = 'done';
              setProgress({ phase: 'done', current: 0, total: 0 });
              setTiming((prev) => ({ ...prev, totalMs, elapsedMs: totalMs }));
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      if (phaseRef.current !== 'done') {
        const totalMs = Date.now() - startTimeRef.current;
        stopTimer();
        phaseRef.current = 'done';
        setProgress((prev) => prev.phase !== 'error' ? { ...prev, phase: 'done' } : prev);
        setTiming((prev) => ({ ...prev, totalMs, elapsedMs: totalMs }));
      }
    } catch (e) {
      stopTimer();
      setMinutesError(e instanceof Error ? e.message : 'Unknown error');
      setProgress({ phase: 'error', current: 0, total: 0 });
      phaseRef.current = 'error';
    }
  }, [startTimer, stopTimer]);

  return { minutesText, progress, timing, minutesError, generateMinutes, resetMinutes };
}
