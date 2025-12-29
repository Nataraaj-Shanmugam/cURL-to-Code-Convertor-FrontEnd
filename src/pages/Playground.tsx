// src/pages/Playground.tsx
import { Link } from "react-router-dom";
import CurlPlayground from "@/components/features/curl/CurlPlayground";
import { useBackendStatus } from "@/contexts/BackendStatusContext";
import { AlertCircle, Server, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function Playground() {
  const { backendStatus, downtime, attempt, maxRetries, waitTimeSeconds, isBackendReady } = useBackendStatus();

  if (isBackendReady) return <CurlPlayground />;

  const isDown = backendStatus === "down";
  const isWarming = backendStatus === "warning" || backendStatus === "checking";

  const progress = clamp(downtime / waitTimeSeconds, 0, 1);
  const remaining = Math.max(0, waitTimeSeconds - downtime);

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={`relative overflow-hidden rounded-3xl border shadow-xl ${isDown
              ? "border-red-500/30 bg-gradient-to-br from-red-50/80 via-red-50/60 to-red-100/80 dark:from-red-950/40 dark:via-red-900/30 dark:to-red-900/40"
              : "border-border bg-gradient-to-br from-orange-50/80 via-amber-50/60 to-yellow-50/80 dark:from-orange-950/40 dark:via-amber-900/30 dark:to-yellow-900/40"
            }`}
        >
          {/* Animated background waves */}
          <div className="absolute inset-0 opacity-20">
            <div className={`absolute inset-0 animate-pulse ${isDown
                ? "bg-gradient-to-r from-red-400/20 via-red-400/20 to-red-500/20"
                : "bg-gradient-to-r from-orange-400/20 via-amber-400/20 to-yellow-400/20"
              }`} />
            <div className="absolute h-full w-full">
              <div className={`absolute left-0 top-0 h-full w-1/3 bg-gradient-to-r to-transparent animate-[slide_3s_ease-in-out_infinite] ${isDown ? "from-red-500/10" : "from-orange-500/10"
                }`} />
              <div className={`absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l to-transparent animate-[slide_3s_ease-in-out_infinite_reverse] ${isDown ? "from-red-500/10" : "from-yellow-500/10"
                }`} />
            </div>
          </div>

          {/* Top glow accent - enhanced */}
          <div
            className={`absolute -top-32 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full blur-3xl ${isDown ? "bg-red-500 opacity-20" : isWarming ? "bg-orange-500 opacity-25 animate-pulse" : "opacity-0"
              }`}
          />

          <div className="relative p-8 sm:p-10 z-10">
            <div className="flex items-start gap-5">
              {/* Icon with glow effect */}
              <div className="relative">
                <div className={`absolute inset-0 rounded-2xl blur-lg ${isDown ? "bg-red-500/30" : "bg-orange-500/30 animate-pulse"
                  }`} />
                <div
                  className={`relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ${isDown
                      ? "bg-gradient-to-br from-red-500 to-red-600"
                      : "bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500"
                    }`}
                >
                  {isDown ? (
                    <AlertCircle className="h-7 w-7 text-white" />
                  ) : (
                    <Server className="h-7 w-7 text-white" />
                  )}
                </div>
              </div>

              <div className="flex-1">
                {/* Title + chips */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <h1
                    className={`text-xl sm:text-3xl font-bold ${isDown
                        ? "text-red-700 dark:text-red-300"
                        : "bg-gradient-to-r from-orange-700 via-amber-700 to-yellow-700 dark:from-orange-400 dark:via-amber-400 dark:to-yellow-400 bg-clip-text text-transparent"
                      }`}
                  >
                    {isDown ? "Backend Temporarily Offline" : "🚀 Backend Warming Up"}
                  </h1>

                  {isWarming && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-1 text-xs font-semibold shadow-md">
                      <Sparkles className="h-3.5 w-3.5" />
                      Auto-retrying
                    </span>
                  )}
                </div>

                {/* Attempt badge */}
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 px-3 py-1.5 text-sm font-semibold shadow-sm mb-3">
                  <span className="text-slate-600 dark:text-slate-400">Retry Attempt</span>
                  <span className={isDown ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"}>
                    {Math.min(attempt, maxRetries)}/{maxRetries}
                  </span>
                </div>

                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {isDown
                    ? "Upon multiple attempts, backend is still down. Please try again after some time."
                    : "Backend is warming up... please wait. We'll unlock Playground automatically once backend is up and running"}
                </p>

                {isDown ? (
                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <Link
                      to="/"
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-red-600 hover:bg-red-700 text-white px-6 text-sm font-semibold shadow-lg transition"
                    >
                      Back to Home
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Progress section */}
                    <div className="mt-6 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 p-5 shadow-lg">
                      <div className="flex items-center justify-between text-sm mb-4">
                        {/* <span className="text-slate-600 dark:text-slate-400">Elapsed</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">
                          {formatMMSS(Math.min(downtime, waitTimeSeconds))}
                        </span> */}
                        <span className="text-slate-600 dark:text-slate-400">Remaining:  <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                          {formatMMSS(remaining)}
                        </span></span>
                       
                      </div>

                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80 shadow-inner">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 relative shadow-lg"
                          initial={{ width: "0%" }}
                          animate={{ width: `${Math.round(progress * 100)}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        >
                          {/* Shimmer effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
                        </motion.div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                      <Link
                        to="/"
                        className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-6 text-sm font-semibold shadow-md transition"
                      >
                        Back to Home
                      </Link>

                      <div className="flex-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                        💡 Tip: First deploy warm-up can take longer
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Add keyframes */}
          <style>{`
          @keyframes slide {
            0%, 100% { transform: translateX(-100%); }
            50% { transform: translateX(200%); }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
        </motion.div>

        <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          Playground stays locked until the backend is up
        </p>
      </div>
    </div>
  );
}
