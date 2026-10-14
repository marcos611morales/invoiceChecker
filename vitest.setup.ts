import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// "server-only" throws outside the react-server condition; make it a no-op under Vitest.
vi.mock("server-only", () => ({}));
