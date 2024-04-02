# React Hooks

React [custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) are JavaScript functions that encapsulate and share logic across components in a React application. They are characterized by:

- Having a `use` prefix. I.e. `useAPIResource()`.
- Internally using native hooks (useState, useEffect, useRef) or other custom hooks.
- Not producing JSX as outputs.

If your function is described by the aforementioned list, it belongs to this folder. Otherwise, consider using `services/`.
