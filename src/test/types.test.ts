import { describe, expect, it } from "vitest";
import type { Tab, BrowserState } from "../types/browser";
import type { ModelConfig, ModelTier, ProviderHealth } from "../types/ai";

describe("Tab type shape", () => {
  it("accepts a valid fully-specified Tab object", () => {
    const tab: Tab = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      url: "https://example.com",
      title: "Example Domain",
      favicon: undefined,
      is_background: false,
      created_at: new Date().toISOString(),
      fallback_mode: false,
      loaded: true,
    };

    expect(tab.id).toBeTruthy();
    expect(tab.url).toBe("https://example.com");
    expect(tab.is_background).toBe(false);
    expect(tab.fallback_mode).toBe(false);
    expect(tab.loaded).toBe(true);
  });

  it("accepts a background tab with optional favicon omitted", () => {
    const tab: Tab = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      url: "https://background.example.com",
      title: "Background Tab",
      is_background: true,
      created_at: new Date().toISOString(),
      fallback_mode: false,
      loaded: false,
    };

    expect(tab.is_background).toBe(true);
    expect(tab.favicon).toBeUndefined();
  });

  it("accepts empty string values for string fields", () => {
    const tab: Tab = {
      id: "",
      url: "",
      title: "",
      favicon: "",
      is_background: false,
      created_at: "",
      fallback_mode: false,
      loaded: false,
    };

    expect(tab.id).toBe("");
    expect(tab.url).toBe("");
    expect(tab.title).toBe("");
    expect(tab.favicon).toBe("");
    expect(tab.created_at).toBe("");
  });

  it("accepts non-standard URL and timestamp strings", () => {
    const tab: Tab = {
      id: "tab-edge-case",
      url: "not-a-valid-url",
      title: "Invalid URL Example",
      is_background: false,
      created_at: "not-a-timestamp",
      fallback_mode: false,
      loaded: true,
    };

    expect(tab.url).toBe("not-a-valid-url");
    expect(tab.created_at).toBe("not-a-timestamp");
  });

  it("accepts an explicitly undefined optional favicon", () => {
    const tab: Tab = {
      id: "tab-no-favicon",
      url: "about:blank",
      title: "",
      favicon: undefined,
      is_background: false,
      created_at: new Date().toISOString(),
      fallback_mode: true,
      loaded: false,
    };

    expect(tab.favicon).toBeUndefined();
  });
});

describe("BrowserState type shape", () => {
  it("accepts an empty BrowserState with null activeTabId", () => {
    const state: BrowserState = {
      tabs: [],
      activeTabId: null,
    };

    expect(state.tabs).toEqual([]);
    expect(state.activeTabId).toBeNull();
  });

  it("accepts a populated state with an active tab id", () => {
    const tab: Tab = {
      id: "tab-1",
      url: "https://example.com",
      title: "Example",
      is_background: false,
      created_at: new Date().toISOString(),
      fallback_mode: false,
      loaded: true,
    };

    const state: BrowserState = {
      tabs: [tab],
      activeTabId: tab.id,
    };

    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabId).toBe("tab-1");
  });

  it("accepts an empty string as activeTabId", () => {
    const state: BrowserState = {
      tabs: [],
      activeTabId: "",
    };

    expect(state.activeTabId).toBe("");
  });
});

describe("ModelTier type", () => {
  it("accepts all three tier values", () => {
    const tiers: ModelTier[] = ["Local", "Freemium", "Premium"];

    expect(tiers).toHaveLength(3);
    expect(tiers).toEqual(["Local", "Freemium", "Premium"]);
  });
});

describe("ModelConfig type shape", () => {
  it("accepts a minimal config with required fields", () => {
    const config: ModelConfig = {
      tier: "Freemium",
      openrouter_key: null,
      ollama_url: "http://localhost:11434",
      selected_model: "meta-llama/llama-3-8b-instruct:free",
    };

    expect(config.tier).toBe("Freemium");
    expect(config.openrouter_key).toBeNull();
  });

  it("accepts a config with optional keys set", () => {
    const config: ModelConfig = {
      tier: "Freemium",
      openrouter_key: "***stored***",
      ollama_url: "http://localhost:11434",
      selected_model: "meta-llama/llama-3-8b-instruct:free",
      gemini_key: "***stored***",
      groq_key: null,
      hf_token: undefined,
    };

    expect(config.gemini_key).toBe("***stored***");
    expect(config.groq_key).toBeNull();
    expect(config.hf_token).toBeUndefined();
  });

  it("accepts all optional provider keys omitted", () => {
    const config: ModelConfig = {
      tier: "Local",
      openrouter_key: null,
      ollama_url: "http://localhost:11434",
      selected_model: "",
    };

    expect(config.gemini_key).toBeUndefined();
    expect(config.groq_key).toBeUndefined();
    expect(config.hf_token).toBeUndefined();
  });

  it("accepts null values for all nullable provider keys", () => {
    const config: ModelConfig = {
      tier: "Premium",
      openrouter_key: null,
      ollama_url: "http://localhost:11434",
      selected_model: "premium-model",
      gemini_key: null,
      groq_key: null,
      hf_token: null,
    };

    expect(config.openrouter_key).toBeNull();
    expect(config.gemini_key).toBeNull();
    expect(config.groq_key).toBeNull();
    expect(config.hf_token).toBeNull();
  });

  it("accepts empty strings for string configuration values", () => {
    const config: ModelConfig = {
      tier: "Freemium",
      openrouter_key: "",
      ollama_url: "",
      selected_model: "",
      gemini_key: "",
      groq_key: "",
      hf_token: "",
    };

    expect(config.openrouter_key).toBe("");
    expect(config.ollama_url).toBe("");
    expect(config.selected_model).toBe("");
    expect(config.gemini_key).toBe("");
    expect(config.groq_key).toBe("");
    expect(config.hf_token).toBe("");
  });

  it("accepts a non-standard ollama URL because it is typed as string", () => {
    const config: ModelConfig = {
      tier: "Local",
      openrouter_key: null,
      ollama_url: "not-a-valid-url",
      selected_model: "local-model",
    };

    expect(config.ollama_url).toBe("not-a-valid-url");
  });
});

describe("ProviderHealth type shape", () => {
  it("accepts a healthy provider entry", () => {
    const health: ProviderHealth = {
      provider: "Ollama",
      healthy: true,
    };

    expect(health.provider).toBe("Ollama");
    expect(health.healthy).toBe(true);
  });

  it("accepts an unhealthy provider entry", () => {
    const health: ProviderHealth = {
      provider: "Gemini",
      healthy: false,
    };

    expect(health.provider).toBe("Gemini");
    expect(health.healthy).toBe(false);
  });

  it("accepts an empty provider name", () => {
    const health: ProviderHealth = {
      provider: "",
      healthy: false,
    };

    expect(health.provider).toBe("");
    expect(health.healthy).toBe(false);
  });

  it("accepts arbitrary provider names", () => {
    const health: ProviderHealth = {
      provider: "CustomProvider",
      healthy: true,
    };

    expect(health.provider).toBe("CustomProvider");
    expect(health.healthy).toBe(true);
  });
});

