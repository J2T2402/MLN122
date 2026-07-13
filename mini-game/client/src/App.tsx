import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NetworkBanner } from "./shared/components/UI";

// Lazy load main app routes
const PlayerRoot = React.lazy(() => import("./apps/player/PlayerRoot"));
const ScreenRoot = React.lazy(() => import("./apps/screen/ScreenRoot"));
const HostRoot = React.lazy(() => import("./apps/host/HostRoot"));

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Suspense
          fallback={
            <div className="flex-1 flex flex-col items-center justify-center bg-primary-900 text-white font-display text-xl select-none">
              <svg className="animate-spin h-10 w-10 text-accent-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Đang thả neo, chuẩn bị khởi hành...
            </div>
          }
        >
          <Routes>
            <Route path="/play" element={<PlayerRoot />} />
            <Route path="/present" element={<ScreenRoot />} />
            <Route path="/host" element={<HostRoot />} />
            
            {/* Fallbacks */}
            <Route path="/" element={<Navigate to="/play" replace />} />
            <Route path="*" element={<Navigate to="/play" replace />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
};

export default App;
