// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { es } from "@/lib/copy/es";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { IvaToggle } from "./IvaToggle";
import { TopBar } from "./TopBar";

afterEach(() => {
  cleanup();
  act(() => {
    useSettingsStore.setState({ ivaMode: "con" });
    useSessionStore.getState().clearAll();
  });
  window.localStorage.clear();
});

function bar(): HTMLElement {
  return screen.getByTestId("iva-toggle-bar");
}

function subbar(): HTMLElement {
  return screen.getByTestId("iva-toggle-subbar");
}

describe("IvaToggle: copy and accessible names (REGLA-03, D-05)", () => {
  it("the bar variant shows the full labels and the group is named 'Montos con o sin IVA'", () => {
    render(<IvaToggle variant="bar" />);
    const group = within(bar()).getByRole("group", {
      name: "Montos con o sin IVA",
    });
    expect(group).toBeInTheDocument();
    expect(within(group).getByText("Con IVA")).toBeInTheDocument();
    expect(within(group).getByText("Sin IVA")).toBeInTheDocument();
  });

  it("the sub-bar variant shows c/IVA and s/IVA but keeps the full accessible names", () => {
    render(<IvaToggle variant="subbar" />);
    const scope = within(subbar());
    expect(scope.getByText("c/IVA")).toBeInTheDocument();
    expect(scope.getByText("s/IVA")).toBeInTheDocument();
    expect(scope.getByRole("button", { name: "Con IVA" })).toBeInTheDocument();
    expect(scope.getByRole("button", { name: "Sin IVA" })).toBeInTheDocument();
    expect(scope.queryByText("Con IVA")).toBeNull();
  });

  it("uses the copy module for every visible string", () => {
    render(<IvaToggle variant="bar" />);
    const scope = within(bar());
    expect(scope.getByText(es.iva.con)).toBeInTheDocument();
    expect(scope.getByText(es.iva.sin)).toBeInTheDocument();
  });
});

describe("IvaToggle: active state (REGLA-03)", () => {
  it("starts on Con IVA: pressed, with a check icon; Sin IVA is not pressed", () => {
    render(<IvaToggle variant="bar" />);
    const con = within(bar()).getByRole("button", { name: "Con IVA" });
    const sin = within(bar()).getByRole("button", { name: "Sin IVA" });
    expect(con).toHaveAttribute("aria-pressed", "true");
    expect(sin).toHaveAttribute("aria-pressed", "false");
    expect(con.querySelector("svg")).not.toBeNull();
    expect(sin.querySelector("svg")).toBeNull();
  });

  it("clicking the inactive item sets the mode in the settings store", () => {
    render(<IvaToggle variant="bar" />);
    fireEvent.click(within(bar()).getByRole("button", { name: "Sin IVA" }));
    expect(useSettingsStore.getState().ivaMode).toBe("sin");
    const sin = within(bar()).getByRole("button", { name: "Sin IVA" });
    const con = within(bar()).getByRole("button", { name: "Con IVA" });
    expect(sin).toHaveAttribute("aria-pressed", "true");
    expect(con).toHaveAttribute("aria-pressed", "false");
    expect(sin.querySelector("svg")).not.toBeNull();
    expect(con.querySelector("svg")).toBeNull();
  });

  it("clicking the active item leaves the mode unchanged and never empties the group", () => {
    render(<IvaToggle variant="bar" />);
    fireEvent.click(within(bar()).getByRole("button", { name: "Con IVA" }));
    expect(useSettingsStore.getState().ivaMode).toBe("con");
    const pressed = within(bar())
      .getAllByRole("button")
      .filter((item) => item.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveAccessibleName("Con IVA");

    act(() => {
      useSettingsStore.getState().setIvaMode("sin");
    });
    fireEvent.click(within(bar()).getByRole("button", { name: "Sin IVA" }));
    expect(useSettingsStore.getState().ivaMode).toBe("sin");
    expect(
      within(bar())
        .getAllByRole("button")
        .filter((item) => item.getAttribute("aria-pressed") === "true"),
    ).toHaveLength(1);
  });

  it("both variants follow the same store value", () => {
    render(
      <>
        <IvaToggle variant="bar" />
        <IvaToggle variant="subbar" />
      </>,
    );
    fireEvent.click(within(subbar()).getByRole("button", { name: "Sin IVA" }));
    expect(useSettingsStore.getState().ivaMode).toBe("sin");
    expect(
      within(bar()).getByRole("button", { name: "Sin IVA" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(subbar()).getByRole("button", { name: "Sin IVA" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("renders Con IVA before the store is rehydrated, then follows the stored mode", () => {
    window.localStorage.setItem(
      "invoicechecker:settings",
      JSON.stringify({ state: { ivaMode: "sin" }, version: 1 }),
    );
    render(<IvaToggle variant="bar" />);
    expect(
      within(bar()).getByRole("button", { name: "Con IVA" }),
    ).toHaveAttribute("aria-pressed", "true");
    act(() => {
      void useSettingsStore.persist.rehydrate();
    });
    expect(
      within(bar()).getByRole("button", { name: "Sin IVA" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

describe("IvaToggle: tooltips (D-05)", () => {
  it("shows the Con IVA explanation on focus", async () => {
    render(<IvaToggle variant="bar" />);
    const con = within(bar()).getByRole("button", { name: "Con IVA" });
    act(() => {
      con.focus();
    });
    fireEvent.focus(con);
    expect(
      await screen.findByText("Total de cada factura", {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it("shows the Sin IVA explanation on hover", async () => {
    render(<IvaToggle variant="bar" />);
    const sin = within(bar()).getByRole("button", { name: "Sin IVA" });
    fireEvent.mouseEnter(sin);
    fireEvent.mouseMove(sin);
    fireEvent.pointerEnter(sin);
    fireEvent.pointerMove(sin);
    expect(
      await screen.findByText(
        "Subtotal − Descuento + IEPS (quita solo el IVA)",
        {},
        { timeout: 2000 },
      ),
    ).toBeInTheDocument();
  });
});

describe("TopBar with the IVA control (D-05, UI Considerations E2)", () => {
  it("without showIva neither variant renders", () => {
    render(<TopBar />);
    expect(screen.queryByTestId("iva-toggle-bar")).toBeNull();
    expect(screen.queryByTestId("iva-toggle-subbar")).toBeNull();
  });

  it("with showIva the bar variant sits in the centre slot", () => {
    const { container } = render(<TopBar showIva />);
    const centre = container.querySelector('[data-slot="topbar-center"]');
    expect(centre).not.toBeNull();
    expect(centre).toContainElement(screen.getByTestId("iva-toggle-bar"));
  });

  it("with showIva the sub-bar strip follows the header and holds the sub-bar variant", () => {
    const { container } = render(<TopBar showIva />);
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    const strip = screen.getByTestId("iva-toggle-subbar").closest("[data-slot='iva-subbar']");
    expect(strip).not.toBeNull();
    expect(header?.nextElementSibling).toBe(strip);
    expect(strip?.className).toContain("sticky");
    expect(strip?.className).toContain("top-14");
    expect(strip?.className).toContain("h-13");
    expect(strip?.className).toContain("sm:hidden");
  });

  it("hides the bar variant under 640 px and the sub-bar variant from 640 px with CSS classes", () => {
    render(<TopBar showIva />);
    expect(bar().className).toContain("max-sm:hidden");
    expect(subbar().className).not.toContain("max-sm:hidden");
  });

  it("keeps the app name and the sign-out button", async () => {
    render(<TopBar showIva />);
    expect(screen.getByText(es.global.appName)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: es.global.logout }),
      ).toBeInTheDocument(),
    );
  });
});
