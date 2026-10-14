// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useSessionStore } from "@/stores/sessionStore";
import { EmptyDropzone } from "./EmptyDropzone";
import { UploadRoot } from "./UploadRoot";

const run = vi.fn<(files: readonly File[]) => Promise<void>>();

vi.mock("./useImport", () => ({
  useImport: () => ({ run }),
}));

function folderInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector("input[webkitdirectory]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("folder input not found");
  }
  return input;
}

function seedIgnoredFile(): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(
      [
        {
          kind: "ignored",
          file: { name: "a.pdf", path: "a.pdf" },
          ignoredKind: "pdf",
        },
      ],
      store.generation,
    );
  });
}

function dragEnterWindow(target: Element): void {
  fireEvent.dragEnter(target, {
    dataTransfer: {
      types: ["Files"],
      files: [],
      items: [{ kind: "file", type: "application/xml" }],
    },
  });
}

beforeEach(() => {
  run.mockReset();
  run.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  act(() => {
    useSessionStore.getState().clearAll();
  });
});

describe("UploadRoot pickers", () => {
  it("passes every file of the folder picker to the import and resets the input", () => {
    const { container } = render(
      <UploadRoot>
        <EmptyDropzone />
      </UploadRoot>,
    );
    const input = folderInput(container);
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    const xml = new File(["<x/>"], "b.xml", { type: "text/xml" });
    fireEvent.change(input, { target: { files: [pdf, xml] } });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith([pdf, xml]);
    expect(input.value).toBe("");
  });

  it("does not restrict either picker by file type", () => {
    const { container } = render(
      <UploadRoot>
        <EmptyDropzone />
      </UploadRoot>,
    );
    const inputs = container.querySelectorAll("input[type=file]");
    expect(inputs.length).toBe(2);
    for (const input of inputs) {
      expect(input.hasAttribute("accept")).toBe(false);
    }
  });

  it("shows the empty-screen copy and disables both buttons while processing", () => {
    render(
      <UploadRoot>
        <EmptyDropzone />
      </UploadRoot>,
    );
    expect(
      screen.getByRole("heading", { name: "Arrastra tus XML o la carpeta aquí" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Por privacidad, las facturas no se guardan; vuelve a soltarlas para analizarlas",
      ),
    ).toBeInTheDocument();
    const files = screen.getByRole("button", { name: "Seleccionar archivos" });
    const folder = screen.getByRole("button", { name: "Seleccionar carpeta" });
    expect(files).toBeEnabled();
    expect(folder).toBeEnabled();
    act(() => {
      useSessionStore.getState().setProgress({ phase: "listing" });
    });
    expect(files).toBeDisabled();
    expect(folder).toBeDisabled();
  });
});

describe("UploadRoot window overlay", () => {
  it("shows the overlay when dragging over a loaded screen", () => {
    seedIgnoredFile();
    const { container } = render(
      <UploadRoot>
        <p>contenido</p>
      </UploadRoot>,
    );
    expect(screen.queryByTestId("drop-overlay")).toBeNull();
    const root = container.firstElementChild;
    if (root === null) throw new Error("root not found");
    act(() => dragEnterWindow(root));
    expect(screen.getByTestId("drop-overlay")).toHaveTextContent(
      "Suelta para agregar facturas",
    );
  });

  it("shows no overlay on the empty screen (the card switches instead)", () => {
    const { container } = render(
      <UploadRoot>
        <EmptyDropzone />
      </UploadRoot>,
    );
    const root = container.firstElementChild;
    if (root === null) throw new Error("root not found");
    act(() => dragEnterWindow(root));
    expect(screen.queryByTestId("drop-overlay")).toBeNull();
    expect(screen.getByTestId("empty-dropzone")).toHaveAttribute(
      "data-drag-over",
      "true",
    );
    expect(
      screen.getByRole("heading", { name: "Suelta los archivos para cargarlos" }),
    ).toBeInTheDocument();
  });

  it("shows no overlay while a batch is processing", () => {
    seedIgnoredFile();
    act(() => {
      useSessionStore.getState().setProgress({ phase: "listing" });
    });
    const { container } = render(
      <UploadRoot>
        <p>contenido</p>
      </UploadRoot>,
    );
    const root = container.firstElementChild;
    if (root === null) throw new Error("root not found");
    act(() => dragEnterWindow(root));
    expect(screen.queryByTestId("drop-overlay")).toBeNull();
  });
});
