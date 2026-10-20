// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React, { createElement as h } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  ASSISTANT_AVATAR_MEDIUM_URL,
  ASSISTANT_AVATAR_SMALL_URL,
  ASSISTANT_AVATAR_URL,
  AssistantAvatar,
} from "./components/AssistantAvatar";

const LEGACY_AVATAR_URL =
  "/manus-storage/maalamati-assistant-avatar_1d2f6239.png";
const assistantSource = readFileSync(
  resolve(process.cwd(), "client", "src", "components", "MaalamatiAssistant.tsx"),
  "utf8",
);

beforeAll(() => {
  vi.stubGlobal("React", React);
});

afterEach(cleanup);

describe("صورة المساعد", () => {
  it("يستخدم صورة WEBP الأصلية الجديدة كصورة ديكورية", () => {
    render(h(AssistantAvatar, { className: "test-avatar" }));

    const image = screen.getByTestId("assistant-avatar-image") as HTMLImageElement;
    expect(ASSISTANT_AVATAR_URL).toMatch(/^\/manus-storage\/.+\.webp$/);
    expect(ASSISTANT_AVATAR_URL).not.toBe(LEGACY_AVATAR_URL);
    // The small round avatar loads a downscaled copy of the same portrait first.
    expect(image.getAttribute("src")).toBe(ASSISTANT_AVATAR_MEDIUM_URL);
    expect(image.getAttribute("srcset")).toContain(`${ASSISTANT_AVATAR_SMALL_URL} 128w`);
    expect(image.getAttribute("sizes")).toBe("56px");
    expect(image.getAttribute("alt")).toBe("");
    expect(image.className).toContain("h-full w-full object-cover");
    expect(image.className).toContain("test-avatar");
    expect(screen.queryByTestId("assistant-avatar-fallback")).toBeNull();
  });

  it("يرجع إلى الصورة الأصلية إذا فشلت النسخة المصغرة ثم إلى الأيقونة", () => {
    const { container } = render(h(AssistantAvatar));
    fireEvent.error(screen.getByTestId("assistant-avatar-image"));
    const original = screen.getByTestId("assistant-avatar-image") as HTMLImageElement;
    expect(original.getAttribute("src")).toBe(ASSISTANT_AVATAR_URL);
    expect(original.getAttribute("srcset")).toBeNull();
    fireEvent.error(original);
    expect(screen.getByTestId("assistant-avatar-fallback")).toBeTruthy();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
  it("يبقي الصورة العادية ظاهرة عند اكتمال التحميل", () => {
    render(h(AssistantAvatar));

    const image = screen.getByTestId("assistant-avatar-image");
    fireEvent.load(image);

    expect(screen.getByTestId("assistant-avatar-image")).toBe(image);
    expect(screen.queryByTestId("assistant-avatar-fallback")).toBeNull();
  });

  it("يستبدل الصورة الفاشلة ببديل واحد من دون صورة مكسورة أو إعادة محاولة للمصدر نفسه", () => {
    const { container, rerender } = render(
      h(AssistantAvatar, { src: "/manus-storage/broken-avatar.webp" }),
    );
    const image = screen.getByTestId("assistant-avatar-image");

    fireEvent.error(image);

    const fallback = screen.getByTestId("assistant-avatar-fallback");
    expect(fallback.tagName).toBe("SPAN");
    expect(fallback.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByTestId("assistant-avatar-image")).toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(0);

    rerender(h(AssistantAvatar, { src: "/manus-storage/broken-avatar.webp" }));
    expect(screen.getByTestId("assistant-avatar-fallback")).toBe(fallback);
    expect(screen.queryByTestId("assistant-avatar-image")).toBeNull();
  });

  it("يسمح بمحاولة تحميل جديدة عند تغير src", () => {
    const { rerender } = render(
      h(AssistantAvatar, { src: "/manus-storage/first-broken-avatar.webp" }),
    );
    fireEvent.error(screen.getByTestId("assistant-avatar-image"));
    expect(screen.getByTestId("assistant-avatar-fallback")).toBeTruthy();

    rerender(h(AssistantAvatar, { src: "/manus-storage/replacement-avatar.webp" }));

    const replacement = screen.getByTestId(
      "assistant-avatar-image",
    ) as HTMLImageElement;
    expect(replacement.getAttribute("src")).toBe(
      "/manus-storage/replacement-avatar.webp",
    );
    expect(screen.queryByTestId("assistant-avatar-fallback")).toBeNull();
  });

  it("يبقي المكوّن مستخدمًا في ترويسة المساعد وزر فتحه", () => {
    const headerSource = assistantSource.slice(
      assistantSource.indexOf("<header"),
      assistantSource.indexOf("</header>") + "</header>".length,
    );
    const launcherSource = assistantSource.slice(
      assistantSource.indexOf('className="assistant-launcher'),
      assistantSource.indexOf("</button>", assistantSource.indexOf('className="assistant-launcher')) + "</button>".length,
    );

    expect(assistantSource).toContain(
      'import { AssistantAvatar } from "@/components/AssistantAvatar";',
    );
    expect(headerSource).toContain("<AssistantAvatar />");
    expect(launcherSource).toContain("<AssistantAvatar />");
    expect(assistantSource).not.toContain(LEGACY_AVATAR_URL);
  });
});
