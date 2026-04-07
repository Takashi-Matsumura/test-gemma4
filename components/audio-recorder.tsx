'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { encodeWav } from '@/lib/wav-encoder';

interface AudioRecorderProps {
  sessionId: string;
  onTranscript: (chunkText: string, fullTranscript: string, chunkIndex: number, processingTimeMs: number) => void;
  onError: (error: string) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  chunkIntervalMs?: number;
}

export function AudioRecorder({
  sessionId,
  onTranscript,
  onError,
  onRecordingStart,
  onRecordingStop,
  chunkIntervalMs = 5000,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [processing, setProcessing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    workletNodeRef.current?.port.postMessage({ type: 'stop' });
    workletNodeRef.current?.disconnect();
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current = null;
    workletNodeRef.current = null;
    streamRef.current = null;
    intervalRef.current = null;
    timerRef.current = null;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const sendChunk = useCallback(
    async (samples: Float32Array, sampleRate: number) => {
      if (samples.length === 0) return;

      setProcessing(true);
      try {
        const wavBlob = encodeWav(samples, sampleRate);
        const formData = new FormData();
        formData.append('audio', wavBlob, 'chunk.wav');
        formData.append('sessionId', sessionId);
        formData.append('language', 'ja');

        const res = await fetch('/api/facilitation/transcribe', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setChunkCount(data.chunkIndex);
        onTranscript(data.chunkText, data.fullTranscript, data.chunkIndex, data.processingTimeMs);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Transcription failed');
      } finally {
        setProcessing(false);
      }
    },
    [sessionId, onTranscript, onError],
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000 },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule('/audio-processor.js');
      const workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor');
      workletNodeRef.current = workletNode;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(workletNode);

      // Handle flush responses
      const sampleRate = audioContext.sampleRate;
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'buffer' && event.data.samples.length > 0) {
          sendChunk(event.data.samples, sampleRate);
        }
      };

      // Flush every chunkIntervalMs
      intervalRef.current = setInterval(() => {
        workletNode.port.postMessage({ type: 'flush' });
      }, chunkIntervalMs);

      // Elapsed timer
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
      setChunkCount(0);
      onRecordingStart?.();
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : 'マイクへのアクセスが拒否されました',
      );
    }
  }, [chunkIntervalMs, sendChunk, onError, onRecordingStart]);

  const stopRecording = useCallback(() => {
    // Flush remaining audio
    workletNodeRef.current?.port.postMessage({ type: 'flush' });
    setTimeout(() => cleanup(), 200);
    setIsRecording(false);
    setIsPaused(false);
    onRecordingStop?.();
  }, [cleanup, onRecordingStop]);

  const togglePause = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    if (isPaused) {
      ctx.resume();
      setIsPaused(false);
    } else {
      // Flush before pausing
      workletNodeRef.current?.port.postMessage({ type: 'flush' });
      ctx.suspend();
      setIsPaused(true);
    }
  }, [isPaused]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3">
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-white" />
          録音開始
        </button>
      ) : (
        <>
          <button
            onClick={togglePause}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {isPaused ? '再開' : '一時停止'}
          </button>
          <button
            onClick={stopRecording}
            className="rounded-xl bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            録音停止
          </button>
        </>
      )}

      {isRecording && (
        <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            {!isPaused && (
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            )}
            {formatElapsed(elapsed)}
          </span>
          <span>チャンク: {chunkCount}</span>
          {processing && (
            <span className="text-blue-500">処理中...</span>
          )}
        </div>
      )}
    </div>
  );
}
