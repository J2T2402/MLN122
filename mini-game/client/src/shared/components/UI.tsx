import React from "react";
import { Wifi, WifiOff, ShieldAlert, Play } from "lucide-react";
import { TeamId } from "../socket/events";

// 1. Primary Button with touch targets, scale effects, and loading states
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success" | "warning" | "boss";
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyle = "font-display font-semibold rounded-lg flex items-center justify-center transition-all duration-fast ease-out active:scale-97 select-none outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100";
  
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-600 shadow-md",
    secondary: "bg-neutral-100 text-neutral-900 border border-neutral-300 hover:bg-neutral-200 focus:ring-neutral-300",
    danger: "bg-danger text-white hover:bg-red-700 focus:ring-danger shadow-md",
    success: "bg-success text-white hover:bg-green-700 focus:ring-success shadow-md",
    warning: "bg-warning text-neutral-900 hover:bg-amber-600 focus:ring-warning shadow-md",
    boss: "bg-boss text-white hover:opacity-90 focus:ring-boss shadow-glow",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm min-h-[36px]",
    md: "px-4 py-2.5 text-base min-h-[44px]",
    lg: "px-6 py-3 text-lg min-h-[50px]",
    xl: "px-8 py-4 text-xl min-h-[56px] w-full", // thumb-first bottom-bar actions
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
};

// 2. Connection Status Indicator Badge
export const ConnectionBadge: React.FC<{ connected: boolean; reconnecting?: boolean }> = ({
  connected,
  reconnecting
}) => {
  if (reconnecting) {
    return (
      <span className="flex items-center gap-1.5 text-warning font-mono font-medium text-sm bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
        <span className="h-2.5 w-2.5 rounded-full bg-warning animate-pulse"></span>
        ĐANG NEO LẠI...
      </span>
    );
  }
  
  if (connected) {
    return (
      <span className="flex items-center gap-1.5 text-success font-mono font-medium text-sm bg-green-50 px-2 py-0.5 rounded border border-green-200">
        <span className="h-2.5 w-2.5 rounded-full bg-success"></span>
        LIVE
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-danger font-mono font-medium text-sm bg-red-50 px-2 py-0.5 rounded border border-red-200">
      <span className="h-2.5 w-2.5 rounded-full bg-danger"></span>
      MẤT MẠNG
    </span>
  );
};

// 3. Team badge chips using custom tokens
export const TeamBadge: React.FC<{ teamId: TeamId; className?: string }> = ({
  teamId,
  className = ""
}) => {
  const names: Record<TeamId, string> = {
    1: "Hồng San Hô",
    2: "Cam Hải Đăng",
    3: "Vàng Cánh Buồm",
    4: "Lục Rong Biển",
    5: "Lam Sóng Bạc",
    6: "Tím Hải Vương",
  };

  const bgClasses: Record<TeamId, string> = {
    1: "bg-red-50 text-team-1 border-team-1",
    2: "bg-orange-50 text-team-2 border-team-2",
    3: "bg-yellow-50 text-team-3 border-team-3",
    4: "bg-green-50 text-team-4 border-team-4",
    5: "bg-cyan-50 text-team-5 border-team-5",
    6: "bg-purple-50 text-team-6 border-team-6",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-sm font-semibold rounded border ${bgClasses[teamId]} ${className}`}>
      {names[teamId]}
    </span>
  );
};

// 4. Score Display Chip
export const ScoreChip: React.FC<{ score: number; className?: string }> = ({
  score,
  className = ""
}) => {
  return (
    <span className={`inline-flex items-center gap-1 bg-primary-100 text-primary-700 px-2.5 py-0.5 rounded-full text-sm font-mono font-bold border border-primary-300 ${className}`}>
      ⚡ {score}
    </span>
  );
};

// 5. Network Reconnecting Banner
export const NetworkBanner: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;
  return (
    <div className="bg-danger text-white py-2 px-4 text-center font-semibold text-sm flex items-center justify-center gap-2 z-50 sticky top-0 shadow-md">
      <WifiOff size={16} className="animate-bounce" />
      Mất kết nối — Đang cố gắng kết nối lại với tàu...
    </div>
  );
};

// 6. Pause Game Overlay
export const PausedOverlay: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-primary-900/90 flex flex-col items-center justify-center text-center p-6 z-50 animate-fade-in backdrop-blur-sm">
      <div className="bg-surface rounded-xl p-8 max-w-sm border border-primary-300 shadow-xl flex flex-col items-center">
        <div className="bg-primary-100 p-4 rounded-full text-primary-600 mb-4 animate-pulse">
          <Play size={40} className="ml-1 rotate-90" />
        </div>
        <h2 className="text-2xl font-bold font-display text-primary-900 mb-2">Tạm Dừng Hải Trình</h2>
        <p className="text-neutral-600 mb-6 text-base">MC đã tạm dừng để giảng bài. Hãy chuẩn bị tinh thần tiếp tục khi thuyền trưởng mở lại!</p>
        <span className="font-mono text-sm text-primary-600 tracking-wider animate-bounce">● ĐANG ĐỢI... ●</span>
      </div>
    </div>
  );
};

// 7. General Error / Sync Boundary Guard
export const ErrorBoundaryFallback: React.FC<{ message: string; code?: string; onRetry?: () => void }> = ({
  message,
  code,
  onRetry
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center bg-white rounded-lg border border-red-200 shadow-md max-w-sm mx-auto my-8">
      <ShieldAlert size={48} className="text-danger mb-4" />
      <h3 className="text-xl font-bold text-neutral-900 font-display mb-2">Đã xảy ra sự cố</h3>
      <p className="text-neutral-600 text-sm mb-4">{message}</p>
      {code && (
        <code className="text-xs font-mono bg-neutral-100 text-neutral-600 px-2 py-1 rounded mb-6 block">
          Error Code: {code}
        </code>
      )}
      {onRetry && (
        <Button onClick={onRetry} variant="primary" size="md">
          Thử kết nối lại
        </Button>
      )}
    </div>
  );
};
