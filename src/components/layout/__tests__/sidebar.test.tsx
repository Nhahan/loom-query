import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sidebar } from "../Sidebar";

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    title,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    title?: string;
  }) => (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  ),
}));

// Use vi.hoisted so these are available inside the hoisted vi.mock factory
const { mockSidebarState, mockThemeState } = vi.hoisted(() => {
  const mockSidebarState = {
    isCollapsed: false,
    toggleCollapsed: vi.fn(),
    setCollapsed: vi.fn(),
  };
  const mockThemeState = {
    isDark: false,
    toggleTheme: vi.fn(),
  };
  return { mockSidebarState, mockThemeState };
});

vi.mock("@/store", () => {
  const useSidebarStore = Object.assign(
    () => mockSidebarState,
    { persist: { rehydrate: vi.fn() } }
  );
  const useThemeStore = Object.assign(
    () => mockThemeState,
    { persist: { rehydrate: vi.fn() } }
  );
  return { useSidebarStore, useThemeStore };
});

describe("Sidebar", () => {
  beforeEach(() => {
    mockSidebarState.isCollapsed = false;
    mockSidebarState.toggleCollapsed.mockClear();
    mockThemeState.isDark = false;
    mockThemeState.toggleTheme.mockClear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all 7 nav items", async () => {
    await act(async () => {
      render(<Sidebar />);
    });
    expect(screen.getByText("대시보드")).toBeInTheDocument();
    expect(screen.getByText("자료실")).toBeInTheDocument();
    expect(screen.getByText("자료 업로드")).toBeInTheDocument();
    expect(screen.getByText("AI 질문하기")).toBeInTheDocument();
    expect(screen.getByText("API & 연동")).toBeInTheDocument();
    expect(screen.getByText("활동 기록")).toBeInTheDocument();
    expect(screen.getByText("설정")).toBeInTheDocument();
  });

  it("hides nav labels when collapsed", async () => {
    mockSidebarState.isCollapsed = true;
    await act(async () => {
      render(<Sidebar />);
    });
    expect(screen.queryByText("대시보드")).not.toBeInTheDocument();
    expect(screen.queryByText("자료실")).not.toBeInTheDocument();
    expect(screen.queryByText("AI 질문하기")).not.toBeInTheDocument();
  });

  it("calls toggle when collapse button is clicked", async () => {
    await act(async () => {
      render(<Sidebar />);
    });
    const collapseButton = screen.getByRole("button", { name: "사이드바 접기" });
    await act(async () => {
      fireEvent.click(collapseButton);
    });
    expect(mockSidebarState.toggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("calls theme toggle when dark mode button is clicked", async () => {
    await act(async () => {
      render(<Sidebar />);
    });
    const themeButton = screen.getByRole("button", { name: "다크 모드" });
    await act(async () => {
      fireEvent.click(themeButton);
    });
    expect(mockThemeState.toggleTheme).toHaveBeenCalledTimes(1);
  });

  it("shows light mode label when dark mode is active", async () => {
    mockThemeState.isDark = true;
    await act(async () => {
      render(<Sidebar />);
    });
    expect(screen.getByRole("button", { name: "라이트 모드" })).toBeInTheDocument();
  });

  it("shows expand label when sidebar is collapsed", async () => {
    mockSidebarState.isCollapsed = true;
    await act(async () => {
      render(<Sidebar />);
    });
    expect(screen.getByRole("button", { name: "사이드바 펼치기" })).toBeInTheDocument();
  });
});
