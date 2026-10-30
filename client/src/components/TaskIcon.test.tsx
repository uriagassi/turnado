import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TaskIcon } from "./TaskIcon";
import type { TaskType } from "../api";

describe("TaskIcon", () => {
  it.each<TaskType>(["test", "doctor_visit", "form_17", "general_approval"])(
    "renders a decorative SVG that follows the text colour for %s",
    (type) => {
      const { container } = render(<TaskIcon type={type} />);
      const svg = container.querySelector("svg");

      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("stroke", "currentColor");
      expect(container.textContent).toBe("");
    },
  );
});
