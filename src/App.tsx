import { useCallback, useEffect, useState } from "react";
import type { Route } from "./types";
import { NAV_ITEMS } from "./utils/constants";
import { navigate, parseRoute } from "./utils/routing";
import { FundsPage } from "./pages/FundsPage";
import { FundDetailPage } from "./pages/FundDetailPage";
import { VcsPage } from "./pages/VcsPage";
import { VcDetailPage } from "./pages/VcDetailPage";

function App() {
  const [route, setRoute] = useState<Route>(parseRoute());

  useEffect(() => {
    const onChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const handleNavClick = useCallback((hash: string) => {
    navigate(hash);
  }, []);

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
      <nav className="main-nav" aria-label="메인 내비게이션">
        <div className="nav-inner">
          <button className="nav-logo" onClick={() => handleNavClick("/")} aria-label="홈으로 이동">
            <span className="dot" />
            Korea VC Funds
          </button>
          <div className="nav-tabs" role="tablist">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.label}
                className={`nav-tab ${route.page === item.page || (route.page === "fund" && item.page === "funds") || (route.page === "vc" && item.page === "vcs") ? "active" : ""}`}
                onClick={() => handleNavClick(item.hash)}
                role="tab"
                aria-selected={route.page === item.page || (route.page === "fund" && item.page === "funds") || (route.page === "vc" && item.page === "vcs")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {route.page === "funds" && <FundsPage params={route.params} />}
      {route.page === "fund" && <FundDetailPage id={route.id} />}
      {route.page === "vcs" && <VcsPage params={route.params} />}
      {route.page === "vc" && <VcDetailPage id={route.id} />}
    </div>
  );
}

export default App;
