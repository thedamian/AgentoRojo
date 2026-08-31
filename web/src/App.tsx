import { useState } from "react";
import type { WorkItemDetails } from "@agento-rojo/shared";
import { isEntraConfigured } from "./auth/msal";
import { getConnectionProfile, hasUsableProfile, saveConnectionProfile, type ConnectionProfile } from "./auth/connectionProfile";
import ConnectionSetup from "./screens/ConnectionSetup";
import StoryShortcut from "./components/StoryShortcut";
import HomeScreen from "./screens/HomeScreen";
import SettingsScreen from "./screens/SettingsScreen";
import WorkItemFlow from "./screens/WorkItemFlow";

type Screen =
  | { kind: "home" }
  | { kind: "settings"; notice?: string }
  | { kind: "setup" }
  | { kind: "flow"; workItem: WorkItemDetails };

export default function App() {
  const [profile, setProfile] = useState<ConnectionProfile | null>(getConnectionProfile);
  const [screen, setScreen] = useState<Screen>(() => (hasUsableProfile(profile) ? { kind: "home" } : { kind: "setup" }));

  function updateProfile(next: ConnectionProfile) {
    saveConnectionProfile(next);
    setProfile(next);
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Agento Rojo</span>
        <nav>
          <button type="button" onClick={() => setScreen(hasUsableProfile(profile) ? { kind: "home" } : { kind: "setup" })}>
            Home
          </button>
          <button type="button" onClick={() => setScreen({ kind: "settings" })}>
            Settings
          </button>
          <button type="button" onClick={() => setScreen({ kind: "setup" })}>
            Connections
          </button>
        </nav>
      </header>

      {!isEntraConfigured() && (
        <div className="banner">
          Entra ID is not configured — set VITE_ENTRA_CLIENT_ID in web/.env to enable Azure DevOps sign-in.
        </div>
      )}

      <main className="app-main">
        {screen.kind === "home" && profile && (
          <HomeScreen
            profile={profile}
            onProfileChanged={updateProfile}
            onLoaded={(workItem) => setScreen({ kind: "flow", workItem })}
          />
        )}
        {screen.kind === "settings" && <SettingsScreen notice={screen.notice} onConfigure={() => setScreen({ kind: "setup" })} />}
        {screen.kind === "setup" && (
          <ConnectionSetup
            initialProfile={profile}
            onComplete={(next) => {
              updateProfile(next);
              setScreen({ kind: "home" });
            }}
          />
        )}
        {screen.kind === "flow" && (
          <WorkItemFlow
            key={screen.workItem.id}
            workItem={screen.workItem}
            onCancel={() => setScreen({ kind: "home" })}
          />
        )}
      </main>
      <StoryShortcut />
    </div>
  );
}
