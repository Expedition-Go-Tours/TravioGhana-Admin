import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, createMemoryRouter, RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

interface WrapperOptions {
  initialEntries?: string[];
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & WrapperOptions,
) {
  const queryClient = createTestQueryClient();
  const { initialEntries = ["/"], ...renderOptions } = options ?? {};

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
          <Toaster />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient };
}

export function renderWithDataRouter(
  ui: ReactElement,
  options?: RenderOptions & { path?: string; initialEntries?: string[] },
) {
  const queryClient = createTestQueryClient();
  const { path = "/", initialEntries = ["/"], ...renderOptions } = options ?? {};

  const router = createMemoryRouter(
    [
      {
        path,
        element: (
          <QueryClientProvider client={queryClient}>
            {ui}
            <Toaster />
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries },
  );

  return { ...render(<RouterProvider router={router} />, renderOptions), queryClient };
}
