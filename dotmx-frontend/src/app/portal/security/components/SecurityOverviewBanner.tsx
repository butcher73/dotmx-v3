import {
  Shield,
  CheckCircle,
  AlertCircle,
  Sparkles,
  AlertTriangle,
  Lock,
} from "lucide-react";

interface SecurityOverviewBannerProps {
  score: number;
  factors: Array<{ name: string; points: number; enabled: boolean }>;
}

export function SecurityOverviewBanner({
  score,
  factors,
}: SecurityOverviewBannerProps) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-zinc-800/50 bg-linear-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 p-6 backdrop-blur-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
              score >= 80
                ? "bg-emerald-500/20 ring-2 ring-emerald-500/50"
                : score >= 60
                  ? "bg-blue-500/20 ring-2 ring-blue-500/50"
                  : score >= 40
                    ? "bg-amber-500/20 ring-2 ring-amber-500/50"
                    : "bg-red-500/20 ring-2 ring-red-500/50"
            }`}
          >
            <Shield
              className={`h-8 w-8 ${
                score >= 80
                  ? "text-emerald-400"
                  : score >= 60
                    ? "text-blue-400"
                    : score >= 40
                      ? "text-amber-400"
                      : "text-red-400"
              }`}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-2xl font-bold text-white">
                Security Score
              </span>
              <span
                className={`text-4xl font-black ${
                  score >= 80
                    ? "text-emerald-400"
                    : score >= 60
                      ? "text-blue-400"
                      : score >= 40
                        ? "text-amber-400"
                        : "text-red-400"
                }`}
              >
                {score}
              </span>
              <span className="text-xl text-zinc-500">/100</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              {score >= 80 ? (
                <>
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <span>Excellent! Your account is highly secure</span>
                </>
              ) : score >= 60 ? (
                <>
                  <CheckCircle className="h-4 w-4 text-blue-400" />
                  <span>Good security, but room for improvement</span>
                </>
              ) : score >= 40 ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span>Fair security - enable more features</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-red-400" />
                  <span>Critical: Enable security features immediately</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {factors.map((factor) => (
            <div
              key={factor.name}
              className={`rounded-xl border p-3 ${
                factor.enabled
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-zinc-700/50 bg-zinc-900/50"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                {factor.enabled ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-zinc-500" />
                )}
                <span
                  className={`text-xs font-medium ${factor.enabled ? "text-emerald-400" : "text-zinc-500"}`}
                >
                  +{factor.points}
                </span>
              </div>
              <div
                className={`text-xs ${factor.enabled ? "text-white" : "text-zinc-500"}`}
              >
                {factor.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
