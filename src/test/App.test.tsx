import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("App", () => {
  it("renders without crashing", () => {
    const { container } = render(() => <App />);
    expect(container).toBeTruthy();
  });
});
