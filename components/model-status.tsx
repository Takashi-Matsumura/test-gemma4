'use client';

import { useState, useEffect } from 'react';

type HealthResponse = {
  status: 'ok' | 'error';
  message?: string;
  models?: Array<{ id: string; [key: string]: unknown }>;
};

export function ModelStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const data: HealthResponse = await res.json();
      setHealth(data);
    } catch {
      setHealth({ status: 'error', message: 'Failed to reach health endpoint' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          llama.cpp サーバー状態
        </h2>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          再チェック
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">接続を確認中...</p>
      ) : health?.status === 'ok' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">接続済み</span>
          </div>
          {health.models && health.models.length > 0 && (
            <div>
              <p className="text-sm text-zinc-500 mb-1">ロード済みモデル:</p>
              <ul className="space-y-1">
                {health.models.map((model) => (
                  <li
                    key={model.id}
                    className="rounded-lg bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {model.id}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">未接続</span>
          </div>
          <p className="text-sm text-zinc-500">
            {health?.message || 'llama.cpp サーバーに接続できません'}
          </p>
          <p className="text-xs text-zinc-400">
            llama.cpp サーバーが http://localhost:8080 で動作していることを確認してください
          </p>
        </div>
      )}
    </div>
  );
}
