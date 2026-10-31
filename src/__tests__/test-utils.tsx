import { render, type RenderOptions } from '@testing-library/react';
import { createContext, useContext, useState, type ReactElement, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, type MemoryRouterProps } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  routerProps?: MemoryRouterProps;
}

// The app runs on a data router (needed by useBlocker), so tests do too. The router is created once
// per mounted wrapper and renders whatever `children` currently is, so `rerender` keeps router state.
const ChildrenContext = createContext<ReactNode>(null);

function RouteContent() {
  return <>{useContext(ChildrenContext)}</>;
}

function AllProviders({ children, routerProps }: { children: ReactNode; routerProps?: MemoryRouterProps }) {
  const [router] = useState(() =>
    createMemoryRouter([{ path: '*', element: <RouteContent /> }], {
      initialEntries: routerProps?.initialEntries,
      initialIndex: routerProps?.initialIndex,
    }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ChildrenContext.Provider value={children}>
        <RouterProvider router={router} />
      </ChildrenContext.Provider>
    </ThemeProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions,
) {
  const { routerProps, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders routerProps={routerProps}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

export { render };
