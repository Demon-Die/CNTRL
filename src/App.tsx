import { listen } from "@tauri-apps/api/event";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { CommandBar } from "./components/CommandBar";
import { FindInPage } from "./components/FindInPage";
import { FirstRunConsent } from "./components/FirstRunConsent";
import { MacroLibrary } from "./components/MacroLibrary";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { TabBar } from "./components/TabBar";
import { UrlBar } from "./components/UrlBar";
import { WebView } from "./components/WebView";
import { eventBus } from "./core/events";
import { initAiStore } from "./stores/aiStore";
import { browserActions, browserState } from "./stores/browserStore";
import { macroActions, macroState } from "./stores/macroStore";
import "./App.css";

function App() {
  const [showMacroLibrary, setShowMacroLibrary] = createSignal(false);
  const [showShortcuts, setShowShortcuts] = createSignal(false);
  const [showFind, setShowFind] = createSignal(false);
  const [showConsent, setShowConsent] = createSignal(false);
  const [theme, setTheme] = createSignal<"dark" | "light">("dark");

  createEffect(() => {
    document.documentElement.setAttribute("data-theme", theme());
  });

  onMount(() => {
    // Register onCleanup synchronously at the top of onCleanup scope,
    // before any async execution. In SolidJS, onCleanup must be called
    // synchronously within the reactive scope to register properly.
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      if (e.key === "t" && !e.shiftKey) {
        e.preventDefault();
        eventBus.emit("TAB_OPEN_NEW", { url: "cntrl://home" });
      } else if (e.key === "w") {
        e.preventDefault();
        eventBus.emit("TAB_CLOSE_ACTIVE");
      } else if (e.key === "T" && e.shiftKey) {
        e.preventDefault();
        browserActions.reopenLastTab();
      } else if (e.key === "m") {
        e.preventDefault();
        setShowMacroLibrary((prev) => !prev);
      } else if (e.key === "L" && e.shiftKey) {
        e.preventDefault();
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
      } else if (e.key === "/") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      } else if (e.key === "f") {
        e.preventDefault();
        setShowFind((prev) => !prev);
      } else if (e.key === "p") {
        e.preventDefault();
        window.print();
      }
    };

    window.addEventListener("keydown", handler);

    let unlistenCmdW: (() => void) | undefined;
    onCleanup(() => {
      unlistenCmdW?.();
      window.removeEventListener("keydown", handler);
    });

    // Async initialization — runs after synchronous onCleanup is registered
    void (async () => {
      await initAiStore();
      await macroActions.init();
      await browserActions.fetchTabs();
      if (browserState.tabs.length === 0) {
        await browserActions.openTab("cntrl://home");
      }

      const consentAccepted = localStorage.getItem("cntrl_consent_accepted");
      if (!consentAccepted) {
        setShowConsent(true);
      }

      unlistenCmdW = await listen<null>("cmd-w", () => {
        if (browserState.activeTabId) {
          browserActions.closeTab(browserState.activeTabId);
        }
      });
    })();
  });

  const handleAcceptConsent = () => {
    localStorage.setItem("cntrl_consent_accepted", "true");
    setShowConsent(false);
  };

  return (
    <div class="app-container">
      <TabBar />
      <UrlBar />
      <WebView />
      <CommandBar />

      <Show when={showFind()}>
        <FindInPage onClose={() => setShowFind(false)} />
      </Show>

      <Show when={macroState.isRecording}>
        <div
          class="macro-recording-badge"
          onClick={() => setShowMacroLibrary(true)}
          style="cursor: pointer; pointer-events: auto;"
        >
          <span class="recording-dot">●</span> RECORDING MACRO
        </div>
      </Show>

      <Show when={showMacroLibrary()}>
        <MacroLibrary onClose={() => setShowMacroLibrary(false)} />
      </Show>

      <Show when={showShortcuts()}>
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      </Show>

      <Show when={showConsent()}>
        <FirstRunConsent onAccept={handleAcceptConsent} />
      </Show>
    </div>
  );
}

export default App;
