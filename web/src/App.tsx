import { useState } from "react";
import type { WorkItemDetails } from "@agento-rojo/shared";
import { isEntraConfigured } from "./auth/msal";
import { getGithubPat } from "./auth/githubPat";
import HomeScreen from "./screens/HomeScreen";
import SettingsScreen from "./screens/SettingsScreen";
import SetupScreen from "./screens/SetupScreen";
import WorkItemFlow from "./screens/WorkItemFlow";

type Screen =
  | { kind: "home" }
  | { kind: "settings"; notice?: string }
  | { kind: "setup" }
  | { kind: "flow"; workItem: WorkItemDetails };

function initialScreen(): Screen {
  return getGithubPat()
    ? { kind: "home" }
    : { kind: "settings", notice: "Enter a GitHub fine-grained PAT to continue." };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Agento Rojo</span>
        <nav>
          <button type="button" onClick={() => setScreen({ kind: "home" })}>
            Home
          </button>
          <button type="button" onClick={() => setScreen({ kind: "settings" })}>
            Settings
          </button>
          <button type="button" onClick={() => setScreen({ kind: "setup" })}>
            Setup files
          </button>
        </nav>
      </header>

      {!isEntraConfigured() && (
        <div className="banner">
          Entra ID is not configured — set VITE_ENTRA_CLIENT_ID in web/.env to enable Azure DevOps sign-in.
        </div>
      )}

      <main className="app-main">
        {screen.kind === "home" && <HomeScreen onLoaded={(workItem) => setScreen({ kind: "flow", workItem })} />}
        {screen.kind === "settings" && <SettingsScreen notice={screen.notice} />}
        {screen.kind === "setup" && <SetupScreen />}
        {screen.kind === "flow" && (
          <WorkItemFlow
            key={screen.workItem.id}
            workItem={screen.workItem}
            onCancel={() => setScreen({ kind: "home" })}
          />
        )}
      </main>
    </div>
  );
}
